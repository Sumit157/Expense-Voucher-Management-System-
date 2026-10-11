import os from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import { pino } from 'pino';
import { createApp } from '../../src/app.js';
import { loadEnv } from '../../src/env.js';
import type { Database } from '../../src/db.js';
import { createAuthRouter } from '../../src/modules/auth/auth-router.js';
import type { AuthUser } from '../../src/modules/auth/auth-service.js';
import { createSignatureStorage } from '../../src/modules/vouchers/signature-storage.js';
import { createVoucherService } from '../../src/modules/vouchers/voucher-service.js';
import { createVoucherRouter } from '../../src/modules/vouchers/voucher-router.js';
import { resolveTestDatabaseUrl } from '../utils/test-db-url.js';

const noOpDb: Database = {
  async ping() {},
  async close() {},
};

const testUploadDir = path.join(os.tmpdir(), 'evm-test-signatures');

interface ApiResponse {
  data?: AuthUser;
  error?: { code: string; message: string };
}

export function createTestApp(prisma: PrismaClient): Express {
  const env = loadEnv({
    NODE_ENV: 'test',
    PORT: '3000',
    LOG_LEVEL: 'silent',
    DATABASE_URL: resolveTestDatabaseUrl(),
    APP_ORIGIN: 'http://localhost:5173',
    API_ORIGIN: 'http://localhost:3000',
    SESSION_SECRET: 'test-secret-value-32-characters-min!',
    SESSION_TTL_HOURS: '12',
    UPLOAD_DIR: testUploadDir,
  });
  const logger = pino({ level: 'silent' });
  const authRouter = createAuthRouter({ env, logger, prisma });
  const storage = createSignatureStorage(testUploadDir);
  const voucherService = createVoucherService({ prisma, storage });
  const vouchersRouter = createVoucherRouter({ env, logger, prisma, service: voucherService });
  return createApp({ env, logger, db: noOpDb, authRouter, vouchersRouter });
}

export async function login(
  app: Express,
  email: string,
  password: string,
): Promise<{ cookie: string; body: ApiResponse }> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  const setCookie: unknown = res.headers['set-cookie'];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (typeof cookie !== 'string') {
    throw new Error('login response did not include a session cookie');
  }
  return { cookie, body: res.body as ApiResponse };
}
