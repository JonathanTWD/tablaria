import { AwsClient } from 'aws4fetch';
import { FileStorage, type StoredFile } from './file-storage';

/** Download links stay valid this long: enough to open the file, not to share it. */
const DOWNLOAD_URL_TTL_SECONDS = 300;

export interface S3Settings {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * A private bucket of any S3-compatible service (Filebase in production),
 * reached with signed requests. Browsers download through presigned URLs.
 */
export class S3Storage extends FileStorage {
  readonly enabled = true;
  private readonly client: AwsClient;
  private readonly bucketUrl: string;

  constructor(settings: S3Settings) {
    super();
    this.client = new AwsClient({
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
      region: settings.region,
      service: 's3',
      // A struggling bucket should fail the request soon, not after minutes of backoff.
      retries: 2,
    });
    // Path-style addressing: every S3-compatible service supports it.
    this.bucketUrl = `${settings.endpoint.replace(/\/+$/, '')}/${encodeURIComponent(settings.bucket)}`;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const response = await this.client.fetch(this.url(key), {
      method: 'PUT',
      // A copy backed by a plain ArrayBuffer: fetch's types refuse a Buffer.
      body: new Uint8Array(body),
      headers: { 'Content-Type': contentType },
    });
    await expectOk(response, 'upload');
  }

  async delete(key: string): Promise<void> {
    const response = await this.client.fetch(this.url(key), {
      method: 'DELETE',
    });
    if (response.status !== 404) {
      await expectOk(response, 'delete');
    }
  }

  async downloadUrl(key: string, file: StoredFile): Promise<string> {
    const url = new URL(this.url(key));
    url.searchParams.set('X-Amz-Expires', String(DOWNLOAD_URL_TTL_SECONDS));
    // The bucket answers with the type and name the API checked, whatever the object says.
    url.searchParams.set('response-content-type', file.contentType);
    url.searchParams.set(
      'response-content-disposition',
      contentDisposition(file.name),
    );
    const signed = await this.client.sign(url.toString(), {
      method: 'GET',
      aws: { signQuery: true },
    });
    return signed.url;
  }

  async read(key: string): Promise<Buffer> {
    const response = await this.client.fetch(this.url(key));
    await expectOk(response, 'download');
    return Buffer.from(await response.arrayBuffer());
  }

  private url(key: string): string {
    return `${this.bucketUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
}

/** Opens in the browser (images, PDFs) under the original name. */
export function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

async function expectOk(response: Response, action: string): Promise<void> {
  if (!response.ok) {
    // The body is the service's XML error; its code is enough to diagnose.
    const body = await response.text().catch(() => '');
    const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1] ?? 'unknown';
    throw new Error(
      `Storage ${action} failed with ${response.status} (${code})`,
    );
  }
}
