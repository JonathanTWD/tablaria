import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { getTestDatabaseUrl } from './test-database-url';

/** Creates the test database if needed and applies pending migrations. */
export default function globalSetup(): void {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: resolve(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: getTestDatabaseUrl() },
    stdio: 'pipe',
  });
}
