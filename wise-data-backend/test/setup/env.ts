import { getTestDatabaseUrl } from './test-database-url';

// Real process variables take precedence over .env in ConfigModule.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = getTestDatabaseUrl();
// Lets each test pick its own client IP via X-Forwarded-For, so rate limits don't leak between tests.
process.env.TRUST_PROXY_HOPS = '1';
process.env.MAIL_TRANSPORT = 'smtp';
