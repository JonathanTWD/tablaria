import type { IncomingMessage, Server } from 'node:http';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  REALTIME_MAX_SUBSCRIPTIONS,
  type RealtimeClientMessage,
  realtimeClientMessageSchema,
  type RealtimeScope,
  type RealtimeServerMessage,
} from '@wisedata/shared';
import { WebSocket, WebSocketServer } from 'ws';
import { generateSecureToken } from '../auth/secure-token';
import { API_PREFIX } from '../common/api-prefix';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../database/prisma.service';
import { tableRole } from '../tables/table-access';

export const REALTIME_PATH = `/${API_PREFIX}/realtime`;

const TICKET_TTL_MS = 30_000;
/** A connection must authenticate this soon after opening, or it is closed. */
const AUTH_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 30_000;
const MAX_CONNECTIONS_PER_USER = 10;
/** Client messages are tiny JSON commands; anything bigger is not ours. */
const MAX_MESSAGE_BYTES = 1024;

/** Close codes in the 4000-4999 range are free for applications. */
const CLOSE = {
  unauthorized: 4401,
  forbiddenOrigin: 4403,
  tooManyConnections: 4429,
  badMessage: 4400,
} as const;

interface Client {
  socket: WebSocket;
  userId: string | null;
  tables: Set<string>;
  alive: boolean;
}

/**
 * Tells browsers that a table changed so they refetch it (ADR-020). Messages
 * never carry data: whoever receives one still reads through the API, which
 * checks access on every request.
 */
@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly allowedOrigins: Set<string>;
  private readonly publicUrl: string | null;
  private readonly tickets = new Map<
    string,
    { userId: string; expiresAt: number }
  >();
  private readonly clients = new Set<Client>();
  /** Table id → clients subscribed to it. */
  private readonly rooms = new Map<string, Set<Client>>();
  private server: WebSocketServer | null = null;
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.allowedOrigins = new Set([
      ...config.get('CORS_ORIGINS', { infer: true }),
      new URL(config.get('APP_URL', { infer: true })).origin,
    ]);
    this.publicUrl = config.get('REALTIME_URL', { infer: true }) ?? null;
  }

  /** Where browsers should connect; null means the app's own origin. */
  get url(): string | null {
    return this.publicUrl;
  }

  /** A single-use ticket, valid for a few seconds, to open one connection. */
  issueTicket(userId: string): string {
    const now = Date.now();
    for (const [ticket, { expiresAt }] of this.tickets) {
      if (expiresAt <= now) {
        this.tickets.delete(ticket);
      }
    }
    const ticket = generateSecureToken();
    this.tickets.set(ticket, { userId, expiresAt: now + TICKET_TTL_MS });
    return ticket;
  }

  /** Accepts WebSocket upgrades on REALTIME_PATH of the API's HTTP server. */
  attach(httpServer: Server): void {
    this.server = new WebSocketServer({
      server: httpServer,
      path: REALTIME_PATH,
      maxPayload: MAX_MESSAGE_BYTES,
    });
    this.server.on('connection', (socket, request) =>
      this.onConnection(socket, request),
    );
    this.heartbeat = setInterval(() => this.checkHeartbeats(), HEARTBEAT_MS);
  }

  onModuleDestroy(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
    }
    for (const client of this.clients) {
      client.socket.terminate();
    }
    this.server?.close();
  }

  /** Something in the table changed; subscribers refetch what `scope` covers. */
  publish(tableId: string, scope: RealtimeScope): void {
    this.sendToRoom(tableId, { type: 'changed', tableId, scope });
  }

  /** The user lost access: their open pages stop listening to the table. */
  revoke(tableId: string, userId: string): void {
    const room = this.rooms.get(tableId);
    for (const client of room ?? []) {
      if (client.userId === userId) {
        this.leave(client, tableId);
        this.send(client, { type: 'revoked', tableId });
      }
    }
  }

  private onConnection(socket: WebSocket, request: IncomingMessage): void {
    // Browsers always send Origin; refusing others stops pages on other sites
    // from opening connections with a ticket they somehow got.
    if (!this.allowedOrigins.has(request.headers.origin ?? '')) {
      socket.close(CLOSE.forbiddenOrigin, 'Origin not allowed');
      return;
    }
    const client: Client = {
      socket,
      userId: null,
      tables: new Set(),
      alive: true,
    };
    this.clients.add(client);
    const authTimer = setTimeout(() => {
      if (!client.userId) {
        socket.close(CLOSE.unauthorized, 'Not authenticated');
      }
    }, AUTH_TIMEOUT_MS);

    socket.on('pong', () => {
      client.alive = true;
    });
    socket.on('message', (raw, isBinary) => {
      // The protocol is JSON text; binary frames are not ours.
      if (isBinary || !Buffer.isBuffer(raw)) {
        socket.close(CLOSE.badMessage, 'Invalid message');
        return;
      }
      void this.onMessage(client, raw.toString('utf8'));
    });
    socket.on('close', () => {
      clearTimeout(authTimer);
      for (const tableId of client.tables) {
        this.leave(client, tableId);
      }
      this.clients.delete(client);
    });
    socket.on('error', (error) =>
      this.logger.warn(`Realtime socket error: ${error.message}`),
    );
  }

  private async onMessage(client: Client, raw: string): Promise<void> {
    let message: RealtimeClientMessage;
    try {
      message = realtimeClientMessageSchema.parse(JSON.parse(raw));
    } catch {
      client.socket.close(CLOSE.badMessage, 'Invalid message');
      return;
    }

    if (message.type === 'auth') {
      this.authenticate(client, message.ticket);
      return;
    }
    if (!client.userId) {
      client.socket.close(CLOSE.unauthorized, 'Not authenticated');
      return;
    }
    if (message.type === 'unsubscribe') {
      this.leave(client, message.tableId);
      return;
    }

    const { tableId } = message;
    if (
      client.tables.size >= REALTIME_MAX_SUBSCRIPTIONS &&
      !client.tables.has(tableId)
    ) {
      this.send(client, {
        type: 'error',
        tableId,
        code: 'too_many_subscriptions',
      });
      return;
    }
    // Same rule as the API: without access the table might as well not exist.
    const role = await tableRole(this.prisma, client.userId, tableId);
    if (!role) {
      this.send(client, { type: 'error', tableId, code: 'not_found' });
      return;
    }
    if (client.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    client.tables.add(tableId);
    const room = this.rooms.get(tableId) ?? new Set<Client>();
    room.add(client);
    this.rooms.set(tableId, room);
    this.send(client, { type: 'subscribed', tableId });
  }

  private authenticate(client: Client, ticket: string): void {
    const stored = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    if (client.userId || !stored || stored.expiresAt <= Date.now()) {
      client.socket.close(CLOSE.unauthorized, 'Invalid ticket');
      return;
    }
    const open = [...this.clients].filter(
      ({ userId }) => userId === stored.userId,
    ).length;
    if (open >= MAX_CONNECTIONS_PER_USER) {
      client.socket.close(CLOSE.tooManyConnections, 'Too many connections');
      return;
    }
    client.userId = stored.userId;
    this.send(client, { type: 'ready' });
  }

  private leave(client: Client, tableId: string): void {
    client.tables.delete(tableId);
    const room = this.rooms.get(tableId);
    room?.delete(client);
    if (room?.size === 0) {
      this.rooms.delete(tableId);
    }
  }

  private sendToRoom(tableId: string, message: RealtimeServerMessage): void {
    for (const client of this.rooms.get(tableId) ?? []) {
      this.send(client, message);
    }
  }

  private send(client: Client, message: RealtimeServerMessage): void {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message));
    }
  }

  /** Proxies drop idle connections and dead peers never close: ping, and drop the silent ones. */
  private checkHeartbeats(): void {
    for (const client of this.clients) {
      if (!client.alive) {
        client.socket.terminate();
        continue;
      }
      client.alive = false;
      client.socket.ping();
    }
  }
}
