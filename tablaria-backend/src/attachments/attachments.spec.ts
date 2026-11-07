import { cleanFileName, detectAttachmentType } from './file-type';
import { contentDisposition, S3Storage } from './storage/s3.storage';

describe('detectAttachmentType', () => {
  it('reads the type from the first bytes, whatever the name says', () => {
    expect(detectAttachmentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg',
    );
    expect(
      detectAttachmentType(
        Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'latin1'),
      ),
    ).toBe('image/webp');
    expect(detectAttachmentType(Buffer.from('%PDF-1.4'))).toBe(
      'application/pdf',
    );
    // SVG and HTML could run scripts when opened; they are never accepted.
    expect(detectAttachmentType(Buffer.from('<svg></svg>'))).toBeNull();
    expect(
      detectAttachmentType(Buffer.from('RIFF\x00\x00\x00\x00WAVE')),
    ).toBeNull();
  });
});

describe('cleanFileName', () => {
  it('keeps the name without folders or control characters', () => {
    expect(cleanFileName('C:\\fotos\\taladro.png')).toBe('taladro.png');
    expect(cleanFileName('../../etc/passwd')).toBe('passwd');
    expect(cleanFileName('fac\ntura.pdf')).toBe('factura.pdf');
    expect(cleanFileName('  ')).toBe('archivo');
    expect(cleanFileName(undefined)).toBe('archivo');
  });
});

describe('S3Storage', () => {
  const storage = new S3Storage({
    endpoint: 'https://s3.filebase.com/',
    region: 'us-east-1',
    bucket: 'tablaria-adjuntos',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
  });

  it('signs short-lived download links that name the file', async () => {
    const url = new URL(
      await storage.downloadUrl('attachments/abc', {
        name: 'Manual del taladro.pdf',
        contentType: 'application/pdf',
      }),
    );
    expect(url.origin + url.pathname).toBe(
      'https://s3.filebase.com/tablaria-adjuntos/attachments/abc',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get('response-content-type')).toBe(
      'application/pdf',
    );
  });

  it('names downloads safely, accents included', () => {
    expect(contentDisposition('Factura "mayo" ñ.pdf')).toBe(
      `inline; filename="Factura _mayo_ _.pdf"; filename*=UTF-8''Factura%20%22mayo%22%20%C3%B1.pdf`,
    );
  });
});
