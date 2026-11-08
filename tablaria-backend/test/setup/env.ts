import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTestDatabaseUrl } from './test-database-url';

// Real process variables take precedence over .env in ConfigModule.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = getTestDatabaseUrl();
// Lets each test pick its own client IP via X-Forwarded-For, so rate limits don't leak between tests.
process.env.TRUST_PROXY_HOPS = '1';
process.env.MAIL_TRANSPORT = 'smtp';
// Attachments go to a scratch folder, never a real bucket.
process.env.STORAGE_DIR = join(tmpdir(), 'tablaria-e2e-storage');
for (const key of [
  'STORAGE_ENDPOINT',
  'STORAGE_BUCKET',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
]) {
  process.env[key] = '';
}
// The assistant is on in tests, with a fake key: they script the model and
// never reach the provider.
process.env.AI_API_KEY = 'test-key';
