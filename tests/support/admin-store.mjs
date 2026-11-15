import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Uses TEST_DATABASE_URL when supplied, otherwise the authorized local backend database.
// Credentials stay in the process; never log connection URLs or persist them in fixtures.
const envFile = new URL('../../../Backend-Blog/.env', import.meta.url);
const config = { ...(existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}), ...process.env };
if (!process.env.ADMIN_SESSION_DATABASE_URL) {
  const url = new URL('postgresql://localhost');
  url.hostname = config.DB_HOST || '127.0.0.1'; url.port = config.DB_PORT || '5433';
  url.username = config.DB_USER; url.password = config.DB_PASSWORD; url.pathname = '/' + config.DB_NAME;
  process.env.ADMIN_SESSION_DATABASE_URL = config.TEST_DATABASE_URL || url.toString();
}
if (!['localhost', '127.0.0.1'].includes(new URL(process.env.ADMIN_SESSION_DATABASE_URL).hostname)) throw new Error('Administrative tests require a local PostgreSQL');
process.env.ADMIN_SESSION_ENCRYPTION_KEY = randomBytes(32).toString('hex');
