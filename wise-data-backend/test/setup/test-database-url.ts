import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../.env'), quiet: true });

/**
 * Returns TEST_DATABASE_URL, refusing anything that could point at a
 * non-test database because the e2e suite wipes every table.
 */
export function getTestDatabaseUrl(): string {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
  }

  const databaseName = new URL(testUrl).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `TEST_DATABASE_URL must point to a database ending in "_test", got "${databaseName}"`,
    );
  }

  return testUrl;
}
