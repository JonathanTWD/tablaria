import { ServiceUnavailableException } from '@nestjs/common';

export interface StoredFile {
  name: string;
  contentType: string;
}

/** Where attachments live (ADR-039): a bucket in production, the disk in development. */
export abstract class FileStorage {
  /** False when uploads are off: production without a bucket. */
  abstract readonly enabled: boolean;

  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;

  /** Removing a file that is already gone is not an error. */
  abstract delete(key: string): Promise<void>;

  /**
   * A short-lived URL the browser can fetch the file from, or null when the
   * API has to serve the bytes itself (see `read`).
   */
  abstract downloadUrl(key: string, file: StoredFile): Promise<string | null>;

  abstract read(key: string): Promise<Buffer>;
}

/** Production without a bucket: nothing can be uploaded, so nothing is stored. */
export class DisabledStorage extends FileStorage {
  readonly enabled = false;

  put(): Promise<void> {
    return Promise.reject(
      new ServiceUnavailableException('Attachments are not available'),
    );
  }

  delete(): Promise<void> {
    return Promise.resolve();
  }

  downloadUrl(): Promise<string | null> {
    return Promise.reject(
      new ServiceUnavailableException('Attachments are not available'),
    );
  }

  read(): Promise<Buffer> {
    return Promise.reject(
      new ServiceUnavailableException('Attachments are not available'),
    );
  }
}
