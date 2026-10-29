import { INestApplication } from '@nestjs/common';
import {
  type AcceptedInvitation,
  type AuthUser,
  type InvitationPreview,
  MAX_ORGANIZATIONS_PER_USER,
  type OrganizationDetail,
  type OrganizationSummary,
  type PendingInvitation,
  type TableDetail,
  type TableSummary,
} from '@wisedata/shared';
import { App } from 'supertest/types';
import {
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';
import { extractToken, latestEmail } from './helpers/mailpit';

describe('Organizations (e2e)', () => {
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

  async function createOrganization(client: TestClient, name = 'Ferretería') {
    return (await client.post('/api/organizations').send({ name }).expect(201))
      .body as OrganizationDetail;
  }

  async function invite(
    client: TestClient,
    organizationId: string,
    email: string,
    role = 'EDITOR',
    status = 201,
  ) {
    return (
      await client
        .post(`/api/organizations/${organizationId}/invitations`)
        .send({ email, role })
        .expect(status)
    ).body as PendingInvitation;
  }

  /** A new account that joined the organization with `role` by invitation. */
  async function addMember(
    owner: TestClient,
    organizationId: string,
    role: string,
  ) {
    const client = await createSignedInClient(app);
    const user = await me(client);
    await invite(owner, organizationId, user.email, role);
    const token = extractToken(await latestEmail(user.email));
    await client.post('/api/invitations/accept').send({ token }).expect(200);
    return { client, user };
  }

  async function setup() {
    const owner = await createSignedInClient(app);
    const organization = await createOrganization(owner);
    const base = `/api/organizations/${organization.id}`;
    const table = (
      await owner
        .post(`${base}/tables`)
        .send({ name: 'Almacén', templateId: 'basic-inventory' })
        .expect(201)
    ).body as TableDetail;
    return { owner, ownerUser: await me(owner), organization, base, table };
  }

  it('creates organizations next to the personal space, which stays private', async () => {
    const owner = await createSignedInClient(app);
    const ownerUser = await me(owner);
    const organization = await createOrganization(owner, '  Ferretería  ');
    expect(organization).toMatchObject({
      name: 'Ferretería',
      personal: false,
      role: 'OWNER',
      memberCount: 1,
      tableCount: 0,
      members: [
        expect.objectContaining({ userId: ownerUser.id, role: 'OWNER' }),
      ],
      invitations: [],
    });

    const list = (await owner.get('/api/organizations').expect(200))
      .body as OrganizationSummary[];
    expect(list.map(({ name, personal }) => ({ name, personal }))).toEqual([
      { name: 'Personal', personal: true },
      { name: 'Ferretería', personal: false },
    ]);

    const personal = list[0];
    const personalBase = `/api/organizations/${personal.id}`;
    await owner.patch(personalBase).send({ name: 'Mía' }).expect(403);
    await owner.delete(personalBase).expect(403);
    await invite(owner, personal.id, 'luis@example.com', 'EDITOR', 403);
    await owner.delete(`${personalBase}/members/${ownerUser.id}`).expect(403);
    await owner.post('/api/organizations').send({ name: ' ' }).expect(400);
  });

  it('invites by email; members see its tables with their role', async () => {
    const { owner, ownerUser, organization, base, table } = await setup();
    const guest = await createSignedInClient(app);
    const guestUser = await me(guest);

    // Nothing of it is visible before joining.
    await guest.get(base).expect(404);
    await guest.get(`${base}/tables`).expect(404);
    await guest.get(`/api/tables/${table.id}`).expect(404);

    await invite(owner, organization.id, guestUser.email, 'VIEWER');
    const email = await latestEmail(guestUser.email);
    expect(email.Subject).toContain('organización');
    expect(email.Text).toContain('unirte a «Ferretería»');
    const token = extractToken(email);

    const preview = (
      await guest.post('/api/invitations/preview').send({ token }).expect(200)
    ).body as InvitationPreview;
    expect(preview).toMatchObject({
      target: { type: 'organization', id: organization.id, name: 'Ferretería' },
      invitedBy: ownerUser.email,
      role: 'VIEWER',
    });
    const accepted = (
      await guest.post('/api/invitations/accept').send({ token }).expect(200)
    ).body as AcceptedInvitation;
    expect(accepted.target).toEqual({
      type: 'organization',
      id: organization.id,
      name: 'Ferretería',
    });

    const tables = (await guest.get(`${base}/tables`).expect(200))
      .body as TableSummary[];
    expect(tables).toEqual([
      expect.objectContaining({ id: table.id, role: 'VIEWER' }),
    ]);
    const detail = (await guest.get(base).expect(200))
      .body as OrganizationDetail;
    expect(detail.role).toBe('VIEWER');
    expect(detail.members).toHaveLength(2);
    // Only admins see who is invited.
    expect(detail.invitations).toEqual([]);

    // Viewers read; they don't create, invite or rename.
    await guest
      .post(`/api/tables/${table.id}/records`)
      .send({ data: {} })
      .expect(403);
    await guest.post(`${base}/tables`).send({ name: 'Otra' }).expect(403);
    await invite(guest, organization.id, 'otra@example.com', 'VIEWER', 403);
    await guest.patch(base).send({ name: 'Mía' }).expect(403);
    // An organization's tables are not "shared with me" ones.
    expect((await guest.get('/api/tables/shared').expect(200)).body).toEqual(
      [],
    );
  });

  it('lets admins manage members, but only owners touch ownership', async () => {
    const { owner, organization, base } = await setup();
    const admin = await addMember(owner, organization.id, 'ADMIN');
    const editor = await addMember(owner, organization.id, 'EDITOR');
    const ownerUser = await me(owner);

    await admin.client
      .patch(`${base}/members/${editor.user.id}`)
      .send({ role: 'VIEWER' })
      .expect(200);
    await admin.client
      .patch(`${base}/members/${editor.user.id}`)
      .send({ role: 'OWNER' })
      .expect(403);
    await admin.client
      .patch(`${base}/members/${ownerUser.id}`)
      .send({ role: 'ADMIN' })
      .expect(403);
    await admin.client.delete(`${base}/members/${ownerUser.id}`).expect(403);
    await editor.client
      .patch(`${base}/members/${admin.user.id}`)
      .send({ role: 'VIEWER' })
      .expect(403);

    await admin.client
      .post(`${base}/tables`)
      .send({ name: 'Taller' })
      .expect(201);
    await admin.client.delete(base).expect(403);

    await admin.client.delete(`${base}/members/${editor.user.id}`).expect(204);
    await editor.client.get(base).expect(404);
    await admin.client.delete(`${base}/members/${editor.user.id}`).expect(404);
  });

  it('always keeps one owner', async () => {
    const { owner, organization, base } = await setup();
    const ownerUser = await me(owner);
    const other = await addMember(owner, organization.id, 'ADMIN');

    await owner.delete(`${base}/members/${ownerUser.id}`).expect(409);
    await owner
      .patch(`${base}/members/${ownerUser.id}`)
      .send({ role: 'ADMIN' })
      .expect(409);

    await owner
      .patch(`${base}/members/${other.user.id}`)
      .send({ role: 'OWNER' })
      .expect(200);
    // With a second owner the first one may leave.
    await owner.delete(`${base}/members/${ownerUser.id}`).expect(204);
    await owner.get(base).expect(404);
    const detail = (await other.client.get(base).expect(200))
      .body as OrganizationDetail;
    expect(detail.members).toEqual([
      expect.objectContaining({ userId: other.user.id, role: 'OWNER' }),
    ]);
  });

  it('lets members leave, and owners delete it with its tables', async () => {
    const { owner, organization, base, table } = await setup();
    const viewer = await addMember(owner, organization.id, 'VIEWER');

    await viewer.client.delete(`${base}/members/${viewer.user.id}`).expect(204);
    await viewer.client.get(`/api/tables/${table.id}`).expect(404);

    await owner.delete(base).expect(204);
    await owner.get(base).expect(404);
    await owner.get(`/api/tables/${table.id}`).expect(404);
  });

  it('keeps invitations to members unique and within limits', async () => {
    const { owner, organization, base } = await setup();
    const member = await addMember(owner, organization.id, 'EDITOR');
    await invite(owner, organization.id, member.user.email, 'ADMIN', 409);

    const invited = await invite(
      owner,
      organization.id,
      'nueva@example.com',
      'EDITOR',
    );
    const again = await invite(
      owner,
      organization.id,
      'nueva@example.com',
      'ADMIN',
    );
    const detail = (await owner.get(base).expect(200))
      .body as OrganizationDetail;
    // Re-inviting replaces the pending invitation.
    expect(detail.invitations).toEqual([
      expect.objectContaining({ id: again.id, role: 'ADMIN' }),
    ]);
    await owner.delete(`${base}/invitations/${invited.id}`).expect(404);
    await owner.delete(`${base}/invitations/${again.id}`).expect(204);
    // Owners are made by promotion, never invited.
    await invite(owner, organization.id, 'jefa@example.com', 'OWNER', 400);
  });

  it('refuses revoked invitations', async () => {
    const { owner, organization, base } = await setup();
    const guest = await createSignedInClient(app);
    const guestUser = await me(guest);

    const invitation = await invite(owner, organization.id, guestUser.email);
    const token = extractToken(await latestEmail(guestUser.email));
    await owner.delete(`${base}/invitations/${invitation.id}`).expect(204);
    await guest.post('/api/invitations/accept').send({ token }).expect(404);
    await guest.get(base).expect(404);
  });

  it('limits how many organizations a person creates', async () => {
    const owner = await createSignedInClient(app);
    for (let index = 0; index < MAX_ORGANIZATIONS_PER_USER; index++) {
      await createOrganization(owner, `Org ${index}`);
    }
    await owner
      .post('/api/organizations')
      .send({ name: 'Una más' })
      .expect(422);
  });
});
