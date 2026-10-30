import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import type {
  AuthUser,
  PendingInvitation,
  RealtimeServerMessage,
  RealtimeTicket,
  TableDetail,
} from '@tablaria/shared';
import { App } from 'supertest/types';
import { WebSocket } from 'ws';
import {
  createClient,
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';
import { extractToken, latestEmail } from './helpers/mailpit';

const ALLOWED_ORIGIN = (
  process.env.CORS_ORIGINS ?? 'http://localhost:5173'
).split(',')[0];

/** A WebSocket connection that records what it receives, to await it in tests. */
class Connection {
  readonly messages: RealtimeServerMessage[] = [];
  closeCode: number | null = null;
  private readonly socket: WebSocket;
  private readonly opened: Promise<void>;

  constructor(url: string, origin = ALLOWED_ORIGIN) {
    this.socket = new WebSocket(url, { origin });
    this.opened = new Promise((resolve, reject) => {
      this.socket.once('open', () => resolve());
      this.socket.once('error', reject);
    });
    this.socket.on('message', (raw: Buffer) =>
      this.messages.push(
        JSON.parse(raw.toString('utf8')) as RealtimeServerMessage,
      ),
    );
    this.socket.on('close', (code) => {
      this.closeCode = code;
    });
  }

  async send(message: object): Promise<void> {
    await this.opened;
    this.socket.send(JSON.stringify(message));
  }

  /** Waits for a message matching `predicate`, failing after a short while. */
  async next(
    predicate: (message: RealtimeServerMessage) => boolean,
  ): Promise<RealtimeServerMessage> {
    for (let attempt = 0; attempt < 40; attempt++) {
      const found = this.messages.find(predicate);
      if (found) {
        return found;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(
      `No matching message; got ${JSON.stringify(this.messages)}`,
    );
  }

  async closed(): Promise<number> {
    for (let attempt = 0; attempt < 40 && this.closeCode === null; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return this.closeCode ?? -1;
  }

  close(): void {
    this.socket.close();
  }
}

describe('Realtime updates (e2e)', () => {
  let app: INestApplication<App>;
  let url: string;
  const connections: Connection[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    const { port } = (
      app.getHttpServer() as unknown as Server
    ).address() as AddressInfo;
    url = `ws://127.0.0.1:${port}/api/realtime`;
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterEach(() => {
    connections.splice(0).forEach((connection) => connection.close());
  });

  afterAll(async () => {
    await app.close();
  });

  async function connect(client: TestClient): Promise<Connection> {
    const { ticket } = (await client.post('/api/realtime/ticket').expect(200))
      .body as RealtimeTicket;
    const connection = new Connection(url);
    connections.push(connection);
    await connection.send({ type: 'auth', ticket });
    await connection.next(({ type }) => type === 'ready');
    return connection;
  }

  async function createTable(client: TestClient) {
    const table = (
      await client
        .post('/api/tables')
        .send({ name: 'Almacén', templateId: 'basic-inventory' })
        .expect(201)
    ).body as TableDetail;
    return { table, nameColumn: table.columns[0].id };
  }

  it('tells subscribers when records change, without sending any data', async () => {
    const owner = await createSignedInClient(app);
    const { table, nameColumn } = await createTable(owner);
    const connection = await connect(owner);
    await connection.send({ type: 'subscribe', tableId: table.id });
    await connection.next(({ type }) => type === 'subscribed');

    await owner
      .post(`/api/tables/${table.id}/records`)
      .send({ data: { [nameColumn]: 'Guantes' } })
      .expect(201);

    expect(await connection.next(({ type }) => type === 'changed')).toEqual({
      type: 'changed',
      tableId: table.id,
      scope: 'records',
    });
    expect(JSON.stringify(connection.messages)).not.toContain('Guantes');
  });

  it('only lets people with access listen to a table', async () => {
    const owner = await createSignedInClient(app);
    const { table } = await createTable(owner);
    const stranger = await connect(await createSignedInClient(app));

    await stranger.send({ type: 'subscribe', tableId: table.id });
    expect(await stranger.next(({ type }) => type === 'error')).toEqual({
      type: 'error',
      tableId: table.id,
      code: 'not_found',
    });
  });

  it('stops a person from listening the moment they lose access', async () => {
    const owner = await createSignedInClient(app);
    const { table, nameColumn } = await createTable(owner);
    const guest = await createSignedInClient(app);
    const guestUser = (await guest.get('/api/auth/me').expect(200))
      .body as AuthUser;
    await owner
      .post(`/api/tables/${table.id}/invitations`)
      .send({ email: guestUser.email, role: 'VIEWER' })
      .expect(201)
      .then(({ body }) => body as PendingInvitation);
    await guest
      .post('/api/invitations/accept')
      .send({ token: extractToken(await latestEmail(guestUser.email)) })
      .expect(200);

    const connection = await connect(guest);
    await connection.send({ type: 'subscribe', tableId: table.id });
    await connection.next(({ type }) => type === 'subscribed');

    await owner
      .delete(`/api/tables/${table.id}/shares/${guestUser.id}`)
      .expect(204);
    await connection.next(({ type }) => type === 'revoked');

    connection.messages.length = 0;
    await owner
      .post(`/api/tables/${table.id}/records`)
      .send({ data: { [nameColumn]: 'Bridas' } })
      .expect(201);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(connection.messages).toEqual([]);
  });

  it('refuses connections without a valid, unused ticket or from other sites', async () => {
    const owner = await createSignedInClient(app);
    const { ticket } = (await owner.post('/api/realtime/ticket').expect(200))
      .body as RealtimeTicket;
    await createClient(app).post('/api/realtime/ticket').expect(401);

    const first = new Connection(url);
    connections.push(first);
    await first.send({ type: 'auth', ticket });
    await first.next(({ type }) => type === 'ready');

    const reused = new Connection(url);
    connections.push(reused);
    await reused.send({ type: 'auth', ticket });
    expect(await reused.closed()).toBe(4401);

    const unauthenticated = new Connection(url);
    connections.push(unauthenticated);
    await unauthenticated.send({
      type: 'subscribe',
      tableId: crypto.randomUUID(),
    });
    expect(await unauthenticated.closed()).toBe(4401);

    const otherSite = new Connection(url, 'https://evil.example');
    connections.push(otherSite);
    expect(await otherSite.closed()).toBe(4403);
  });

  it('shows who has the table open and which cell they are editing', async () => {
    const owner = await createSignedInClient(app);
    const { table, nameColumn } = await createTable(owner);
    const record = (
      await owner
        .post(`/api/tables/${table.id}/records`)
        .send({ data: { [nameColumn]: 'Guantes' } })
        .expect(201)
    ).body as { id: string };
    const guest = await createSignedInClient(app);
    const guestUser = (await guest.get('/api/auth/me').expect(200))
      .body as AuthUser;
    await owner
      .post(`/api/tables/${table.id}/invitations`)
      .send({ email: guestUser.email, role: 'EDITOR' })
      .expect(201);
    await guest
      .post('/api/invitations/accept')
      .send({ token: extractToken(await latestEmail(guestUser.email)) })
      .expect(200);

    const ownerSocket = await connect(owner);
    await ownerSocket.send({ type: 'subscribe', tableId: table.id });
    const guestSocket = await connect(guest);
    await guestSocket.send({ type: 'subscribe', tableId: table.id });

    const presence =
      (count: number, editing = false) =>
      (message: RealtimeServerMessage) =>
        message.type === 'presence' &&
        message.viewers.length === count &&
        message.viewers.some((viewer) => (viewer.editing !== null) === editing);
    const both = await ownerSocket.next(presence(2));
    expect(both).toMatchObject({
      viewers: expect.arrayContaining([
        {
          userId: guestUser.id,
          name: guestUser.email.split('@')[0],
          editing: null,
        },
      ]) as unknown,
    });
    // Names only: other people's emails never travel.
    expect(JSON.stringify(ownerSocket.messages)).not.toContain(guestUser.email);

    const cell = { recordId: record.id, columnId: nameColumn };
    await guestSocket.send({ type: 'editing', tableId: table.id, cell });
    expect(await ownerSocket.next(presence(2, true))).toMatchObject({
      viewers: expect.arrayContaining([
        expect.objectContaining({ userId: guestUser.id, editing: cell }),
      ]) as unknown,
    });

    guestSocket.close();
    await ownerSocket.next(presence(1));
  });
});
