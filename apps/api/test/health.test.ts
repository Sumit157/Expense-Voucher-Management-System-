import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import type { Database } from '../src/db.js';

const testEnv = loadEnv({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'mysql://user:pass@127.0.0.1:3306/expense_voucher',
  APP_ORIGIN: 'http://localhost:5173',
  API_ORIGIN: 'http://localhost:3000',
  SESSION_SECRET: 'test-secret-value-32-characters!!',
});

const logger = pino({ level: 'silent' });

function buildApp(db: Database) {
  return createApp({ env: testEnv, logger, db });
}

const okDb: Database = {
  async ping() {},
  async close() {},
};

const downDb: Database = {
  async ping() {
    throw new Error('connection refused');
  },
  async close() {},
};

describe('health endpoints', () => {
  it('GET /healthz returns 200 without touching the database', async () => {
    const res = await request(buildApp(downDb)).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('GET /readyz returns 200 when the database is reachable', async () => {
    const res = await request(buildApp(okDb)).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ready', database: 'up' });
  });

  it('GET /readyz returns 503 when the database is unreachable', async () => {
    const res = await request(buildApp(downDb)).get('/readyz');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns a structured 404 for unknown routes', async () => {
    const res = await request(buildApp(okDb)).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
