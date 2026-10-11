import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { PrismaClient as Prisma } from '@prisma/client';
import { hashPassword } from '../src/modules/auth/password.js';
import { hashResetToken } from '../src/modules/auth/auth-service.js';
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

describe('POST /api/v1/auth/register', () => {
  const REGISTER_EMAIL = 'it-registrant@evm.test';

  afterAll(async () => {
    await prisma.session.deleteMany({
      where: { user: { email: { in: [REGISTER_EMAIL, 'it-role-inject@evm.test'] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [REGISTER_EMAIL, 'it-role-inject@evm.test'] } },
    });
  });

  it('creates an employee account and signs the user in', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      fullName: 'IT Registrant',
      email: REGISTER_EMAIL,
      password: 'NewPass123!',
      department: 'Operations',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('EMPLOYEE');
    expect(res.body.data.email).toBe(REGISTER_EMAIL);
    expect(res.body.data.fullName).toBe('IT Registrant');
    expect(res.body.data.passwordHash).toBeUndefined();

    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('HttpOnly');

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(REGISTER_EMAIL);
  });

  it('rejects a duplicate email with 409 EMAIL_TAKEN', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Duplicate',
      email: REGISTER_EMAIL,
      password: 'NewPass123!',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('never trusts a role supplied by the client', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Role Injector',
      email: 'it-role-inject@evm.test',
      password: 'NewPass123!',
      role: 'DIRECTOR',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('EMPLOYEE');

    const stored = await prisma.user.findUnique({
      where: { email: 'it-role-inject@evm.test' },
    });
    expect(stored?.role).toBe('EMPLOYEE');
  });

  it('rejects a short password and an invalid email', async () => {
    const shortPassword = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Shorty',
      email: 'it-short@evm.test',
      password: 'short',
    });
    expect(shortPassword.status).toBe(400);
    expect(shortPassword.body.error.code).toBe('VALIDATION_ERROR');

    const badEmail = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Bad Email',
      email: 'not-an-email',
      password: 'NewPass123!',
    });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/forgot-password and /reset-password', () => {
  const RESET_EMAIL = 'it-reset@evm.test';
  const RESET_PASSWORD = 'OriginalPass123!';

  beforeAll(async () => {
    const passwordHash = await hashPassword(RESET_PASSWORD);
    await prisma.user.upsert({
      where: { email: RESET_EMAIL },
      update: { isActive: true, passwordHash },
      create: {
        email: RESET_EMAIL,
        fullName: 'IT Reset',
        role: 'EMPLOYEE' as const,
        passwordHash,
      },
    });
  });

  afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({
      where: { user: { email: RESET_EMAIL } },
    });
    await prisma.session.deleteMany({ where: { user: { email: RESET_EMAIL } } });
    await prisma.user.deleteMany({ where: { email: RESET_EMAIL } });
  });

  it('returns a generic 202 for known and unknown emails alike', async () => {
    const known = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: RESET_EMAIL });
    expect(known.status).toBe(202);
    expect(known.body.data.message).toMatch(/if an account exists/i);
    expect(known.body.data.devResetToken).toEqual(expect.any(String));

    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody-at-all@evm.test' });
    expect(unknown.status).toBe(202);
    expect(unknown.body.data.message).toMatch(/if an account exists/i);
    expect(unknown.body.data.devResetToken).toBeUndefined();
  });

  it('stores only a hash of the reset token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: RESET_EMAIL });
    const raw: string = res.body.data.devResetToken;

    const stored = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(raw) },
    });
    expect(stored).not.toBeNull();
    const leaked = await prisma.passwordResetToken.findFirst({
      where: { tokenHash: raw },
    });
    expect(leaked).toBeNull();
  });

  it('resets the password, revokes sessions, and rejects token reuse', async () => {
    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: RESET_EMAIL });
    const token: string = forgot.body.data.devResetToken;

    // A pre-existing session must be killed by the password change.
    const { cookie } = await login(app, RESET_EMAIL, RESET_PASSWORD);

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'RotatedPass123!' });
    expect(reset.status).toBe(204);

    const oldPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: RESET_EMAIL, password: RESET_PASSWORD });
    expect(oldPassword.status).toBe(401);

    const newPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: RESET_EMAIL, password: 'RotatedPass123!' });
    expect(newPassword.status).toBe(200);

    const revoked = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(revoked.status).toBe(401);

    const reuse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'AnotherPass123!' });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('RESET_TOKEN_INVALID');

    // Restore the original password so other suites can still log in if needed.
    await prisma.user.update({
      where: { email: RESET_EMAIL },
      data: { passwordHash: await hashPassword(RESET_PASSWORD) },
    });
  });

  it('rejects an unknown or malformed token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'definitely-not-a-real-token', newPassword: 'Whatever123!' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RESET_TOKEN_INVALID');
  });

  it('rejects an expired token', async () => {
    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: RESET_EMAIL });
    const token: string = forgot.body.data.devResetToken;

    await prisma.passwordResetToken.update({
      where: { tokenHash: hashResetToken(token) },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'ExpiredPass123!' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RESET_TOKEN_INVALID');
  });
});

describe('POST /api/v1/auth/login rememberMe', () => {
  it('issues a long-lived cookie when rememberMe is true', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMPLOYEE_EMAIL, password: PASSWORD, rememberMe: true });

    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    // 30 days = 2,592,000 seconds.
    expect(cookie).toContain('Max-Age=2592000');
  });

  it('keeps the default TTL without rememberMe', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMPLOYEE_EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    // 12h default = 43,200 seconds.
    expect(cookie).toContain('Max-Age=43200');
  });
});
