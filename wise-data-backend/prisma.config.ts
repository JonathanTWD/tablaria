import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Read directly instead of env() so `prisma generate` (postinstall, build)
    // works without a database; migrate commands still fail clearly if unset.
    url: process.env.DATABASE_URL ?? '',
  },
});
