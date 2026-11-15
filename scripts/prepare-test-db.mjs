import pg from 'pg';

// Standalone frontend CI fixture. Application schema is owned by backend migrations.
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must explicitly identify the synthetic CI database');
const url = new URL(process.env.TEST_DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('CI fixture requires loopback PostgreSQL');
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
try {
  await db.query(`CREATE TABLE IF NOT EXISTS admin_bff_sessions (
    key text PRIMARY KEY,payload text NOT NULL,expires_at timestamptz NOT NULL,
    version bigint NOT NULL DEFAULT 0,lease_owner varchar(43),lease_until timestamptz,
    CHECK ((lease_owner IS NULL) = (lease_until IS NULL)))`);
  await db.query('CREATE INDEX IF NOT EXISTS idx_admin_bff_sessions_expiry ON admin_bff_sessions(expires_at)');
} finally { await db.end(); }
