import type { IncomingMessage, Server } from 'node:http';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type PresenceCell,
  type PresenceViewer,
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

interface Identity {
  userId: string;
  /** Shown to others with the same table open; null for demo accounts. */
  name: string | null;
}

interface Client {
  socket: WebSocket;
  userId: string | null;
  name: string | null;
  tables: Set<string>;
  /** Table id → the cell this connection has open there, if any. */
  editing: Map<string, PresenceCell>;
  /** Subscriptions waiting on the access check; they count toward the limit. */
  pending: Set<string>;
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
    Identity & { expiresAt: number }
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
  async issueTicket(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, demoExpiresAt: true },
    });
    const name = user.demoExpiresAt ? null : user.email.split('@')[0];
    const now = Date.now();
    for (const [ticket, { expiresAt }] of this.tickets) {
      if (expiresAt <= now) {
        this.tickets.delete(ticket);
      }
    }
    const ticket = generateSecureToken();
    this.tickets.set(ticket, { userId, name, expiresAt: now + TICKET_TTL_MS });
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
      name: null,
      tables: new Set(),
      editing: new Map(),
      pending: new Set(),
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
    if (message.type === 'editing') {
      // Only for tables this connection was allowed to subscribe to.
      if (client.tables.has(message.tableId)) {
        if (message.cell) {
          client.editing.set(message.tableId, message.cell);
        } else {
          client.editing.delete(message.tableId);
        }
        this.broadcastPresence(message.tableId);
      }
      return;
    }

    const { tableId } = message;
    if (client.tables.has(tableId) || client.pending.has(tableId)) {
      return;
    }
    if (
      client.tables.size + client.pending.size >=
      REALTIME_MAX_SUBSCRIPTIONS
    ) {
      this.send(client, {
        type: 'error',
        tableId,
        code: 'too_many_subscriptions',
      });
      return;
    }
    // Reserved before the await, so a burst of subscribes can't pass the limit.
    client.pending.add(tableId);
    // Same rule as the API: without access the table might as well not exist.
    const role = await tableRole(this.prisma, client.userId, tableId).finally(
      () => client.pending.delete(tableId),
    );
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
    this.broadcastPresence(tableId);
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
    client.name = stored.name;
    this.send(client, { type: 'ready' });
  }

  private leave(client: Client, tableId: string): void {
    client.tables.delete(tableId);
    client.editing.delete(tableId);
    const room = this.rooms.get(tableId);
    room?.delete(client);
    if (room?.size === 0) {
      this.rooms.delete(tableId);
    } else {
      this.broadcastPresence(tableId);
    }
  }

  /**
   * Everyone with the table open, once per person (several tabs count once),
   * sent to the same room. Only names and the cell being edited.
   */
  private broadcastPresence(tableId: string): void {
    const viewers = new Map<string, PresenceViewer>();
    for (const client of this.rooms.get(tableId) ?? []) {
      if (!client.userId) {
        continue;
      }
      const viewer = viewers.get(client.userId) ?? {
        userId: client.userId,
        name: client.name,
        editing: null,
      };
      viewer.editing ??= client.editing.get(tableId) ?? null;
      viewers.set(client.userId, viewer);
    }
    this.sendToRoom(tableId, {
      type: 'presence',
      tableId,
      viewers: [...viewers.values()],
    });
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
