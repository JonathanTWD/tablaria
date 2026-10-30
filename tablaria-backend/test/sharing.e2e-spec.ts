import { INestApplication } from '@nestjs/common';
import type {
  AcceptedInvitation,
  AuthUser,
  InvitationPreview,
  PendingInvitation,
  SharedTableSummary,
  TableDetail,
  TableSharing,
} from '@tablaria/shared';
import { App } from 'supertest/types';
import {
  createClient,
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
  uniqueEmail,
} from './helpers/app';
import { extractToken, latestEmail, listEmails } from './helpers/mailpit';

describe('Sharing tables (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function me(client: TestClient): Promise<AuthUser> {
    return (await client.get('/api/auth/me').expect(200)).body as AuthUser;
  }

  async function setup() {
    const owner = await createSignedInClient(app);
    const table = (
      await owner
        .post('/api/tables')
        .send({ name: 'Almacén', templateId: 'basic-inventory' })
        .expect(201)
    ).body as TableDetail;
    const guest = await createSignedInClient(app);
    return {
      owner,
      ownerUser: await me(owner),
      table,
      guest,
      guestUser: await me(guest),
      base: `/api/tables/${table.id}`,
    };
  }

  async function invite(
    client: TestClient,
    tableId: string,
    email: string,
    role = 'EDITOR',
    status = 201,
  ) {
    return (
      await client
        .post(`/api/tables/${tableId}/invitations`)
        .send({ email, role })
        .expect(status)
    ).body as PendingInvitation;
  }

  async function tokenFor(email: string): Promise<string> {
    return extractToken(await latestEmail(email));
  }

  it('invites by email, and the invited account accepts and gets the role', async () => {
    const { owner, ownerUser, table, guest, guestUser, base } = await setup();
    const invitation = await invite(owner, table.id, guestUser.email, 'EDITOR');
    expect(invitation).toMatchObject({
      email: guestUser.email,
      role: 'EDITOR',
    });

    const email = await latestEmail(guestUser.email);
    expect(email.Subject).toContain(ownerUser.email);
    expect(email.Text).toContain('«Almacén»');
    const token = extractToken(email);

    const preview = (
      await guest.post('/api/invitations/preview').send({ token }).expect(200)
    ).body as InvitationPreview;
    expect(preview).toMatchObject({
      target: { type: 'table', id: table.id, name: 'Almacén' },
      invitedBy: ownerUser.email,
      role: 'EDITOR',
      email: guestUser.email,
    });

    const accepted = (
      await guest.post('/api/invitations/accept').send({ token }).expect(200)
    ).body as AcceptedInvitation;
    expect(accepted).toEqual({
      target: { type: 'table', id: table.id, name: 'Almacén' },
    });

    const opened = (await guest.get(base).expect(200)).body as TableDetail;
    expect(opened.role).toBe('EDITOR');
    // Access through a share, not as a member of the owner's space.
    expect(opened.member).toBe(false);
    const shared = (await guest.get('/api/tables/shared').expect(200))
      .body as SharedTableSummary[];
    expect(shared).toEqual([
      expect.objectContaining({
        id: table.id,
        role: 'EDITOR',
        sharedBy: ownerUser.email,
      }),
    ]);
    // Shared tables are not part of the guest's own space.
    expect((await guest.get('/api/tables').expect(200)).body).toEqual([]);

    const sharing = (await owner.get(`${base}/sharing`).expect(200))
      .body as TableSharing;
    expect(sharing.members).toEqual([
      expect.objectContaining({
        userId: guestUser.id,
        email: guestUser.email,
        role: 'EDITOR',
      }),
    ]);
    expect(sharing.invitations).toEqual([]);

    // Single use.
    await guest.post('/api/invitations/accept').send({ token }).expect(404);
  });

  it('only lets the invited address see or accept the invitation', async () => {
    const { owner, table, guestUser, base } = await setup();
    await invite(owner, table.id, guestUser.email);
    const token = await tokenFor(guestUser.email);

    const someoneElse = await createSignedInClient(app);
    await someoneElse
      .post('/api/invitations/preview')
      .send({ token })
      .expect(403);
    await someoneElse
      .post('/api/invitations/accept')
      .send({ token })
      .expect(403);
    await someoneElse.get(base).expect(404);
    await createClient(app)
      .post('/api/invitations/accept')
      .send({ token })
      .expect(401);
    await someoneElse
      .post('/api/invitations/accept')
      .send({ token: 'not-a-real-token' })
      .expect(404);
  });

  it('keeps sharing in the hands of admins', async () => {
    const { owner, table, guest, guestUser, base } = await setup();
    await invite(owner, table.id, guestUser.email, 'EDITOR');
    await guest
      .post('/api/invitations/accept')
      .send({ token: await tokenFor(guestUser.email) })
      .expect(200);

    await guest.get(`${base}/sharing`).expect(403);
    await invite(guest, table.id, uniqueEmail(), 'VIEWER', 403);
    await guest
      .patch(`${base}/shares/${guestUser.id}`)
      .send({ role: 'EDITOR' })
      .expect(403);

    const stranger = await createSignedInClient(app);
    await stranger.get(`${base}/sharing`).expect(404);
    await invite(stranger, table.id, uniqueEmail(), 'VIEWER', 404);

    // A share can never grant more than editing.
    await owner
      .post(`${base}/invitations`)
      .send({ email: uniqueEmail(), role: 'ADMIN' })
      .expect(400);
  });

  it('never lets the public demo send invitations', async () => {
    const demo = createClient(app);
    await demo.post('/api/auth/demo').expect(201);
    const [table] = (await demo.get('/api/tables').expect(200))
      .body as TableDetail[];
    const email = uniqueEmail();

    await invite(demo, table.id, email, 'VIEWER', 403);
    expect(await listEmails(email)).toEqual([]);
  });

  it('answers the same for addresses with or without an account', async () => {
    const { owner, table, ownerUser, guestUser } = await setup();
    const withAccount = await invite(
      owner,
      table.id,
      guestUser.email,
      'VIEWER',
    );
    const withoutAccount = await invite(
      owner,
      table.id,
      uniqueEmail(),
      'VIEWER',
    );
    expect(Object.keys(withAccount).sort()).toEqual(
      Object.keys(withoutAccount).sort(),
    );

    // People who already have access cannot be invited again, the owner included.
    await invite(owner, table.id, ownerUser.email, 'VIEWER', 409);
  });

  it('replaces a pending invitation and lets admins revoke it', async () => {
    const { owner, table, guest, guestUser, base } = await setup();
    await invite(owner, table.id, guestUser.email, 'VIEWER');
    const firstToken = await tokenFor(guestUser.email);
    const second = await invite(owner, table.id, guestUser.email, 'EDITOR');
    const secondToken = await tokenFor(guestUser.email);
    expect(secondToken).not.toBe(firstToken);

    await guest
      .post('/api/invitations/accept')
      .send({ token: firstToken })
      .expect(404);
    expect(
      ((await owner.get(`${base}/sharing`).expect(200)).body as TableSharing)
        .invitations,
    ).toEqual([expect.objectContaining({ id: second.id, role: 'EDITOR' })]);

    await owner.delete(`${base}/invitations/${second.id}`).expect(204);
    await guest
      .post('/api/invitations/accept')
      .send({ token: secondToken })
      .expect(404);
  });

  it('lets admins change or remove a share, and anyone leave a shared table', async () => {
    const { owner, table, guest, guestUser, base } = await setup();
    await invite(owner, table.id, guestUser.email, 'EDITOR');
    await guest
      .post('/api/invitations/accept')
      .send({ token: await tokenFor(guestUser.email) })
      .expect(200);
    const nameColumn = table.columns[0].id;

    await owner
      .patch(`${base}/shares/${guestUser.id}`)
      .send({ role: 'VIEWER' })
      .expect(200);
    await guest
      .post(`${base}/records`)
      .send({ data: { [nameColumn]: 'Guantes' } })
      .expect(403);

    await guest.delete(`${base}/shares/${guestUser.id}`).expect(204);
    await guest.get(base).expect(404);
    await owner.delete(`${base}/shares/${guestUser.id}`).expect(404);
  });

  it('limits how many invitation emails an address can get', async () => {
    const { owner, table } = await setup();
    const email = uniqueEmail();
    for (let attempt = 0; attempt < 5; attempt++) {
      await invite(owner, table.id, email, 'VIEWER');
    }
    await invite(owner, table.id, email, 'VIEWER', 429);
  });

  it('keeps counting invitations after their table is deleted', async () => {
    const { owner } = await setup();
    const email = uniqueEmail();
    const newTable = async () =>
      (
        (await owner.post('/api/tables').send({ name: 'Temporal' }).expect(201))
          .body as TableDetail
      ).id;

    const first = await newTable();
    for (let attempt = 0; attempt < 3; attempt++) {
      await invite(owner, first, email, 'VIEWER');
    }
    const token = await tokenFor(email);
    await owner.delete(`/api/tables/${first}`).expect(204);

    const second = await newTable();
    await invite(owner, second, email, 'VIEWER');
    await invite(owner, second, email, 'VIEWER');
    await invite(owner, second, email, 'VIEWER', 429);

    // The invitation of the deleted table can no longer be used.
    const invited = await createSignedInClient(app);
    await invited.post('/api/invitations/accept').send({ token }).expect(404);
  });
});
