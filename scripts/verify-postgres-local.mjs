import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

// Explicit local proof against the configured development PostgreSQL. Synthetic
// authentication keys and an unused loopback SMTP replace external services only
// in this child process; no credential file or external resource is changed.
const backend = parseEnv(readFileSync(new URL('../../Backend-Blog/.env', import.meta.url), 'utf8'));
if (!['127.0.0.1', 'localhost'].includes(backend.DB_HOST)) throw new Error('Local PostgreSQL required');
const url = new URL('postgresql://127.0.0.1');
url.port = backend.DB_PORT; url.username = backend.DB_USER; url.password = backend.DB_PASSWORD; url.pathname = '/' + backend.DB_NAME;
const env = { ...process.env, ...backend, DB_HOST: '127.0.0.1', DB_SSL: 'false',
  SMTP_HOST: '127.0.0.1', SMTP_PORT: '25252', SMTP_USER: 'synthetic', SMTP_PASS: 'synthetic', SMTP_FROM: 'synthetic@example.test',
  JWT_SECRET: randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
  TOTP_ENCRYPTION_KEY: randomBytes(32).toString('hex'), ADMIN_SESSION_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  ADMIN_SESSION_DATABASE_URL: url.toString(), MAIL_QUEUE_NAME: `proof-${randomUUID()}`,
  RATE_LIMIT_NAMESPACE: `proof-${randomUUID()}`, GRIFORIO_V2_ISOLATED: '1',
};
const child = spawn(process.execPath, ['--test', 'tests/session-v2-real-browser.test.mjs'], {
  cwd: new URL('..', import.meta.url), env, windowsHide: true, stdio: 'inherit',
});
const [code] = await once(child, 'exit'); process.exitCode = code ?? 1;
