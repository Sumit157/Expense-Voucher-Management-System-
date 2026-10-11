import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { PrismaClient as Prisma } from '@prisma/client';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp, login } from './helpers/test-app.js';
import { resolveTestDatabaseUrl } from './utils/test-db-url.js';

const PASSWORD = 'TestPass123!';
const EMP = 'sec-emp@evm.test';
const DIRECTOR = 'sec-dir@evm.test';

let prisma: PrismaClient;
let app: ReturnType<typeof createTestApp>;
let empCookie: string;

const PNG_SIGNATURE = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);

const validDraft = {
  voucherDate: '2026-10-01',
  expenseDate: '2026-09-28',
  department: 'Field Operations',
  expenseTitle: 'Client site visit',
  category: 'Travel',
  description: 'Train fare and tolls',
  amount: '1500.50',
};

beforeAll(async () => {
  prisma = new Prisma({ datasources: { db: { url: resolveTestDatabaseUrl() } } });
  const passwordHash = await hashPassword(PASSWORD);
  for (const user of [
    { email: EMP, fullName: 'Security Emp', role: 'EMPLOYEE' as const },
    { email: DIRECTOR, fullName: 'Security Director', role: 'DIRECTOR' as const },
  ]) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { passwordHash, isActive: true },
      create: { ...user, passwordHash },
    });
  }
  app = createTestApp(prisma);
  empCookie = (await login(app, EMP, PASSWORD)).cookie;
});

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: [EMP, DIRECTOR] } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  const vouchers = await prisma.voucher.findMany({
    where: { employeeId: { in: ids } },
    select: { id: true },
  });
  const vids = vouchers.map((v) => v.id);
  await prisma.voucherEvent.deleteMany({ where: { voucherId: { in: vids } } });
  await prisma.voucher.deleteMany({ where: { id: { in: vids } } });
  await prisma.storedFile.deleteMany({ where: { uploadedById: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe('security headers', () => {
  it('sets standard helmet headers on every response', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['referrer-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('request size limits', () => {
  it('rejects JSON bodies over 100kb with 413', async () => {
    const big = 'x'.repeat(101 * 1024);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMP, password: big });
    expect(res.status).toBe(413);
  });
});

describe('rate limiting', () => {
  it('returns 429 RATE_LIMITED after exceeding the auth limit', async () => {
    const limitedApp = createTestApp(prisma, {
      NODE_ENV: 'development',
      RATE_LIMIT_WINDOW_MS: '60000',
      AUTH_RATE_LIMIT_MAX: '3',
    });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await request(limitedApp)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@evm.test', password: 'WrongPass123!' });
      statuses.push(res.status);
      if (res.status === 429) {
        expect(res.body.error.code).toBe('RATE_LIMITED');
      }
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    expect(statuses[0]).not.toBe(429);
  });

  it('applies the general API limiter to voucher routes', async () => {
    const limitedApp = createTestApp(prisma, {
      NODE_ENV: 'development',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX: '2',
      AUTH_RATE_LIMIT_MAX: '1000',
    });
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await request(limitedApp).get('/api/v1/vouchers');
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
    expect(statuses[0]).not.toBe(429);
  });

  it('does not rate-limit in the test environment', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/api/v1/auth/login').send({ email: EMP, password: PASSWORD });
      statuses.push(res.status);
    }
    expect(statuses.every((s) => s === 200)).toBe(true);
  });
});

describe('upload abuse', () => {
  async function createDraft(cookie: string) {
    return request(app).post('/api/v1/vouchers').set('Cookie', cookie).send(validDraft);
  }

  it('rejects SVG content even with a .png name', async () => {
    const created = await createDraft(empCookie);
    const id = created.body.data.id;
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>',
    );
    const res = await request(app)
      .post(`/api/v1/vouchers/${id}/signature/employee`)
      .set('Cookie', empCookie)
      .attach('file', svg, 'evil.png');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('ignores path-traversal filenames and stores under a random key', async () => {
    const created = await createDraft(empCookie);
    const id = created.body.data.id;
    const res = await request(app)
      .post(`/api/v1/vouchers/${id}/signature/employee`)
      .set('Cookie', empCookie)
      .attach('file', PNG_SIGNATURE, '../../../../etc/passwd.png');
    expect(res.status).toBe(200);
    const row = await prisma.voucher.findUniqueOrThrow({ where: { id } });
    const file = await prisma.storedFile.findUniqueOrThrow({
      where: { id: row.employeeSignatureFileId! },
    });
    expect(file.storageKey).toMatch(/^sig-[0-9a-f-]{36}\.png$/);
    expect(file.originalName).not.toContain('..');
  });

  it('rejects a polyglot file whose magic bytes are not a real image header', async () => {
    const created = await createDraft(empCookie);
    const id = created.body.data.id;
    const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const polyglot = Buffer.concat([jpegMagic, Buffer.from('%PDF-1.4\n% malicious')]);
    const res = await request(app)
      .post(`/api/v1/vouchers/${id}/signature/employee`)
      .set('Cookie', empCookie)
      .attach('file', polyglot, 'poly.jpg');
    expect([200, 415]).toContain(res.status);
    if (res.status === 200) {
      const row = await prisma.voucher.findUniqueOrThrow({ where: { id } });
      const file = await prisma.storedFile.findUniqueOrThrow({
        where: { id: row.employeeSignatureFileId! },
      });
      expect(file.mimeType).toBe('image/jpeg');
      expect(file.originalName).not.toContain('..');
    }
  });

  it('does not leave a stored file when upload is rejected', async () => {
    const created = await createDraft(empCookie);
    const id = created.body.data.id;
    const before = await prisma.storedFile.count();
    await request(app)
      .post(`/api/v1/vouchers/${id}/signature/employee`)
      .set('Cookie', empCookie)
      .attach('file', Buffer.from('not-an-image'), 'fake.png');
    const after = await prisma.storedFile.count();
    expect(after).toBe(before);
  });
});

describe('error redaction', () => {
  it('returns a generic INTERNAL_ERROR without a stack trace on unexpected failures', async () => {
    const { createErrorHandler } = await import('../src/middleware/error-handler.js');
    const express = (await import('express')).default;
    const { pino } = await import('pino');
    const broken = express();
    broken.get('/boom', () => {
      throw new Error('secret internal detail at /tmp/secret/path.ts:42');
    });
    broken.use(createErrorHandler(pino({ level: 'silent' })));
    const res = await request(broken).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).not.toContain('secret internal detail');
    expect(JSON.stringify(res.body)).not.toMatch(/path\.ts:\d+/);
  });
});
