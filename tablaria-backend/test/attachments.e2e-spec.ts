import { INestApplication } from '@nestjs/common';
import type {
  Attachment,
  AuthUser,
  TableDetail,
  TableRecord,
} from '@tablaria/shared';
import { MAX_ATTACHMENTS_PER_RECORD } from '@tablaria/shared';
import { App } from 'supertest/types';
import { AttachmentsService } from '../src/attachments/attachments.service';
import { FileStorage } from '../src/attachments/storage/file-storage';
import { PrismaService } from '../src/database/prisma.service';
import {
  createClient,
  createSignedInClient,
  createTestApp,
  resetDatabase,
  type TestClient,
} from './helpers/app';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('rest of a tiny image'),
]);
const PDF = Buffer.from('%PDF-1.7\nmanual del taladro');

describe('Attachments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let storage: FileStorage;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    storage = app.get(FileStorage);
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function userId(client: TestClient): Promise<string> {
    return ((await client.get('/api/auth/me').expect(200)).body as AuthUser).id;
  }

  /** An owner's table with one record, and the attachments URL of that record. */
  async function setup() {
    const owner = await createSignedInClient(app);
    const table = (
      await owner.post('/api/tables').send({ name: 'Productos' }).expect(201)
    ).body as TableDetail;
    const record = (
      await owner
        .post(`/api/tables/${table.id}/records`)
        .send({ data: {} })
        .expect(201)
    ).body as TableRecord;
    const base = `/api/tables/${table.id}/records/${record.id}/attachments`;
    return { owner, table, record, base };
  }

  function upload(
    client: TestClient,
    base: string,
    body: Buffer,
    name: string,
  ) {
    return client
      .post(`${base}?${new URLSearchParams({ name })}`)
      .set('Content-Type', 'application/octet-stream')
      .send(body);
  }

  it('stores photos and documents of a record, by what they really are', async () => {
    const { owner, base } = await setup();

    const photo = (
      await upload(owner, base, PNG, 'C:\\fotos\\taladro.png').expect(201)
    ).body as Attachment;
    expect(photo).toMatchObject({
      name: 'taladro.png',
      contentType: 'image/png',
      size: PNG.length,
    });
    // A PDF named like an image is still a PDF.
    const manual = (await upload(owner, base, PDF, 'manual.jpg').expect(201))
      .body as Attachment;
    expect(manual.contentType).toBe('application/pdf');

    const list = (await owner.get(base).expect(200)).body as Attachment[];
    expect(list.map(({ id }) => id)).toEqual([photo.id, manual.id]);

    const file = await owner.get(`${base}/${photo.id}`).expect(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['content-disposition']).toContain('taladro.png');
    expect(Buffer.from(file.body as Buffer)).toEqual(PNG);
  });

  it('refuses files that are not images or PDFs, and empty or oversized ones', async () => {
    const { owner, base } = await setup();

    await upload(
      owner,
      base,
      Buffer.from('<svg onload="alert(1)"/>'),
      'logo.png',
    ).expect(415);
    await upload(
      owner,
      base,
      Buffer.from('MZ fake program'),
      'factura.pdf',
    ).expect(415);
    await owner.post(base).expect(400);
    await upload(
      owner,
      base,
      Buffer.alloc(5 * 1024 * 1024 + 1, 0xff),
      'big.jpg',
    ).expect(413);

    expect(await prisma.attachment.count()).toBe(0);
  });

  it('limits the files of a record and the storage of a space', async () => {
    const { owner, base, table } = await setup();
    for (let index = 0; index < MAX_ATTACHMENTS_PER_RECORD; index++) {
      await upload(owner, base, PNG, `foto-${index}.png`).expect(201);
    }
    await upload(owner, base, PNG, 'una-mas.png').expect(422);

    // Other records of the same space share its quota.
    const other = (
      await owner
        .post(`/api/tables/${table.id}/records`)
        .send({ data: {} })
        .expect(201)
    ).body as TableRecord;
    await prisma.attachment.updateMany({ data: { size: 5 * 1024 * 1024 } });
    await upload(
      owner,
      `/api/tables/${table.id}/records/${other.id}/attachments`,
      PNG,
      'foto.png',
    ).expect(422);
  });

  it('lets viewers open files, and only editors add or remove them', async () => {
    const { owner, table, base } = await setup();
    const photo = (await upload(owner, base, PNG, 'foto.png').expect(201))
      .body as Attachment;
    const viewer = await createSignedInClient(app);
    await prisma.tableShare.create({
      data: { tableId: table.id, userId: await userId(viewer), role: 'VIEWER' },
    });

    await viewer.get(base).expect(200);
    await viewer.get(`${base}/${photo.id}`).expect(200);
    await upload(viewer, base, PNG, 'otra.png').expect(403);
    await viewer.delete(`${base}/${photo.id}`).expect(403);

    // Without access, the record does not exist.
    const stranger = await createSignedInClient(app);
    await stranger.get(base).expect(404);
    await stranger.get(`${base}/${photo.id}`).expect(404);
    await upload(stranger, base, PNG, 'otra.png').expect(404);
    await createClient(app).get(base).expect(401);
  });

  it('removes the file from storage with the attachment or its record', async () => {
    const { owner, table, record, base } = await setup();
    const photo = (await upload(owner, base, PNG, 'foto.png').expect(201))
      .body as Attachment;
    const manual = (await upload(owner, base, PDF, 'manual.pdf').expect(201))
      .body as Attachment;

    await owner.delete(`${base}/${photo.id}`).expect(204);
    await expect(storage.read(`attachments/${photo.id}`)).rejects.toThrow();
    await owner.get(`${base}/${photo.id}`).expect(404);

    // Deleting the record (or its table, or the account) only detaches the
    // file; the cleanup removes it from storage.
    await owner
      .delete(`/api/tables/${table.id}/records/${record.id}`)
      .expect(204);
    expect(
      await prisma.attachment.findUnique({ where: { id: manual.id } }),
    ).toMatchObject({
      recordId: null,
    });
    await app
      .get(AttachmentsService)
      .removeOrphans({ uploadedBefore: new Date(Date.now() + 1000) });
    expect(await prisma.attachment.count()).toBe(0);
    await expect(storage.read(`attachments/${manual.id}`)).rejects.toThrow();
  });

  it('is not available in the demo', async () => {
    const visitor = createClient(app);
    await visitor.post('/api/auth/demo').expect(201);
    const [table] = (await visitor.get('/api/tables').expect(200))
      .body as TableDetail[];
    const record = await prisma.record.findFirstOrThrow({
      where: { tableId: table.id },
    });
    await upload(
      visitor,
      `/api/tables/${table.id}/records/${record.id}/attachments`,
      PNG,
      'foto.png',
    ).expect(403);
  });
});
