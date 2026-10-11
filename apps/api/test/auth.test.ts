import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { PrismaClient as Prisma } from '@prisma/client';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp, login } from './helpers/test-app.js';
import { resolveTestDatabaseUrl } from './utils/test-db-url.js';

const PASSWORD = 'TestPass123!';
const EMPLOYEE_EMAIL = 'it-employee@evm.test';
const DIRECTOR_EMAIL = 'it-director@evm.test';
const ACCOUNTS_EMAIL = 'it-accounts@evm.test';
const INACTIVE_EMAIL = 'it-inactive@evm.test';

let prisma: PrismaClient;
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  prisma = new Prisma({ datasources: { db: { url: resolveTestDatabaseUrl() } } });
  const passwordHash = await hashPassword(PASSWORD);
  const users = [
    { email: EMPLOYEE_EMAIL, fullName: 'IT Employee', role: 'EMPLOYEE' as const },
    { email: DIRECTOR_EMAIL, fullName: 'IT Director', role: 'DIRECTOR' as const },
    { email: ACCOUNTS_EMAIL, fullName: 'IT Accounts', role: 'ACCOUNTS' as const },
    { email: INACTIVE_EMAIL, fullName: 'IT Inactive', role: 'EMPLOYEE' as const, isActive: false },
  ];
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { isActive: user.isActive ?? true, passwordHash },
      create: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive ?? true,
        passwordHash,
      },
    });
  }
  app = createTestApp(prisma);
});

afterAll(async () => {
  // Scope to this suite's own users: a broad `contains '@evm.test'` wipe
  // would also kill live sessions of concurrently-running suites (vouchers).
  await prisma.session.deleteMany({
    where: {
      user: { email: { in: [EMPLOYEE_EMAIL, DIRECTOR_EMAIL, ACCOUNTS_EMAIL, INACTIVE_EMAIL] } },
    },
  });
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/login', () => {
  it('logs in an employee and sets a hardened session cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMPLOYEE_EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('EMPLOYEE');
    expect(res.body.data.email).toBe(EMPLOYEE_EMAIL);
    expect(res.body.data.passwordHash).toBeUndefined();

    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  });

  it('logs in director and accounts roles', async () => {
    const director = await login(app, DIRECTOR_EMAIL, PASSWORD);
    expect(director.body.data?.role).toBe('DIRECTOR');
    const accounts = await login(app, ACCOUNTS_EMAIL, PASSWORD);
    expect(accounts.body.data?.role).toBe('ACCOUNTS');
  });

  it('rejects a wrong password with a generic error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMPLOYEE_EMAIL, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('returns the same generic error for an unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@evm.test', password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('rejects an inactive user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: INACTIVE_EMAIL, password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it('never trusts a role sent by the client', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMPLOYEE_EMAIL, password: PASSWORD, role: 'DIRECTOR' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('EMPLOYEE');
  });

  it('rejects a malformed body with VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects state-changing requests with a forged Origin header', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: EMPLOYEE_EMAIL, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /api/v1/auth/me and POST /api/v1/auth/logout', () => {
  it('rejects anonymous requests', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns the current user for a valid session and revokes it on logout', async () => {
    const { cookie } = await login(app, DIRECTOR_EMAIL, PASSWORD);

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(DIRECTOR_EMAIL);
    expect(me.body.data.role).toBe('DIRECTOR');

    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(204);

    const meAfter = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(meAfter.status).toBe(401);
  });

  it('allows logout without a session (idempotent)', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(204);
  });
});
