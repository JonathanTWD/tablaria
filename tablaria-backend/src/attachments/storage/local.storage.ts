import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { FileStorage } from './file-storage';

/** Files on disk, for development and tests. The API serves them itself. */
export class LocalStorage extends FileStorage {
  readonly enabled = true;
  private readonly root: string;

  constructor(directory: string) {
    super();
    this.root = resolve(directory);
  }

  async put(key: string, body: Buffer): Promise<void> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  downloadUrl(): Promise<string | null> {
    return Promise.resolve(null);
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }

  private path(key: string): string {
    const path = resolve(join(this.root, key));
    // Keys are made by the API, but a path outside the folder is never right.
    if (!path.startsWith(this.root + sep)) {
      throw new Error(`Storage key outside the storage folder: ${key}`);
    }
    return path;
  }
}
