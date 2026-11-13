import { randomBytes } from 'node:crypto';

// Real Redis, isolated by site namespace and a synthetic encryption key.
// Never read application credentials from .env files in these tests.
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379';
process.env.ADMIN_SESSION_ENCRYPTION_KEY = randomBytes(32).toString('hex');
