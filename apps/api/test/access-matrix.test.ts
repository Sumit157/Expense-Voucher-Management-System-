import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { PrismaClient as Prisma } from '@prisma/client';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp, login } from './helpers/test-app.js';
import { resolveTestDatabaseUrl } from './utils/test-db-url.js';

const PASSWORD = 'TestPass123!';
const EMP_A = 'matrix-emp-a@evm.test';
const EMP_B = 'matrix-emp-b@evm.test';
const DIRECTOR = 'matrix-dir@evm.test';
const ACCOUNTS = 'matrix-acc@evm.test';

const validDraft = {
  voucherDate: '2026-10-01',
  expenseDate: '2026-09-28',
  department: 'Field Operations',
  expenseTitle: 'Matrix probe',
  category: 'Travel',
  description: 'Access matrix fixture',
  amount: '50.00',
};

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);

let prisma: PrismaClient;
let app: ReturnType<typeof createTestApp>;
let empACookie: string;
let empBCookie: string;
let directorCookie: string;
let accountsCookie: string;
let draftId: string;

beforeAll(async () => {
  prisma = new Prisma({ datasources: { db: { url: resolveTestDatabaseUrl() } } });
  const passwordHash = await hashPassword(PASSWORD);
  const users = [
    { email: EMP_A, fullName: 'Matrix Emp A', role: 'EMPLOYEE' as const },
    { email: EMP_B, fullName: 'Matrix Emp B', role: 'EMPLOYEE' as const },
    { email: DIRECTOR, fullName: 'Matrix Director', role: 'DIRECTOR' as const },
    { email: ACCOUNTS, fullName: 'Matrix Accounts', role: 'ACCOUNTS' as const },
  ];
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { passwordHash, isActive: true },
      create: { ...user, passwordHash },
    });
  }
  app = createTestApp(prisma);
  empACookie = (await login(app, EMP_A, PASSWORD)).cookie;
  empBCookie = (await login(app, EMP_B, PASSWORD)).cookie;
  directorCookie = (await login(app, DIRECTOR, PASSWORD)).cookie;
  accountsCookie = (await login(app, ACCOUNTS, PASSWORD)).cookie;

  const created = await request(app)
    .post('/api/v1/vouchers')
    .set('Cookie', empACookie)
    .send(validDraft);
  draftId = created.body.data.id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: [EMP_A, EMP_B, DIRECTOR, ACCOUNTS] } },
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

describe('full access matrix (TESTING.md)', () => {
  it('create: Employee Yes, Director 403, Accounts 403', async () => {
    const emp = await request(app).post('/api/v1/vouchers').set('Cookie', empACookie).send(validDraft);
    expect(emp.status).toBe(201);

    const dir = await request(app).post('/api/v1/vouchers').set('Cookie', directorCookie).send(validDraft);
    expect(dir.status).toBe(403);
    expect(dir.body.error.code).toBe('FORBIDDEN');

    const acc = await request(app).post('/api/v1/vouchers').set('Cookie', accountsCookie).send(validDraft);
    expect(acc.status).toBe(403);
    expect(acc.body.error.code).toBe('FORBIDDEN');
  });

  it('submit: Employee owner Yes, Employee stranger 404, Director 403, Accounts 403', async () => {
    await request(app)
      .post(`/api/v1/vouchers/${draftId}/signature/employee`)
      .set('Cookie', empACookie)
      .attach('file', PNG, 'sig.png');

    const stranger = await request(app)
      .post(`/api/v1/vouchers/${draftId}/submit`)
      .set('Cookie', empBCookie);
    expect(stranger.status).toBe(404);

    const dir = await request(app)
      .post(`/api/v1/vouchers/${draftId}/submit`)
      .set('Cookie', directorCookie);
    expect(dir.status).toBe(403);

    const acc = await request(app)
      .post(`/api/v1/vouchers/${draftId}/submit`)
      .set('Cookie', accountsCookie);
    expect(acc.status).toBe(403);

    const owner = await request(app)
      .post(`/api/v1/vouchers/${draftId}/submit`)
      .set('Cookie', empACookie);
    expect(owner.status).toBe(200);
    expect(owner.body.data.status).toBe('PENDING_APPROVAL');
  });

  it('approve/reject: Director Yes, Employee 403, Accounts 403, owner 404', async () => {
    const asEmployee = await request(app)
      .post(`/api/v1/vouchers/${draftId}/reject`)
      .set('Cookie', empACookie)
      .send({ reason: 'should not work' });
    expect(asEmployee.status).toBe(403);

    const asAccounts = await request(app)
      .post(`/api/v1/vouchers/${draftId}/approve`)
      .set('Cookie', accountsCookie)
      .attach('file', PNG, 'dir.png');
    expect(asAccounts.status).toBe(403);

    const approved = await request(app)
      .post(`/api/v1/vouchers/${draftId}/approve`)
      .set('Cookie', directorCookie)
      .attach('file', PNG, 'dir.png');
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');
  });

  it('read another employee voucher: Employee 404, Director 200, Accounts 200', async () => {
    const stranger = await request(app)
      .get(`/api/v1/vouchers/${draftId}`)
      .set('Cookie', empBCookie);
    expect(stranger.status).toBe(404);

    const dir = await request(app)
      .get(`/api/v1/vouchers/${draftId}`)
      .set('Cookie', directorCookie);
    expect(dir.status).toBe(200);

    const acc = await request(app)
      .get(`/api/v1/vouchers/${draftId}`)
      .set('Cookie', accountsCookie);
    expect(acc.status).toBe(200);
  });

  it('signatures: owner 200, stranger 404, Director/Accounts 200', async () => {
    const owner = await request(app)
      .get(`/api/v1/vouchers/${draftId}/signatures/employee`)
      .set('Cookie', empACookie);
    expect(owner.status).toBe(200);

    const stranger = await request(app)
      .get(`/api/v1/vouchers/${draftId}/signatures/employee`)
      .set('Cookie', empBCookie);
    expect(stranger.status).toBe(404);

    const dir = await request(app)
      .get(`/api/v1/vouchers/${draftId}/signatures/employee`)
      .set('Cookie', directorCookie);
    expect(dir.status).toBe(200);

    const acc = await request(app)
      .get(`/api/v1/vouchers/${draftId}/signatures/director`)
      .set('Cookie', accountsCookie);
    expect(acc.status).toBe(200);
  });
});

describe('mass-assignment protection', () => {
  it('PATCH ignores status, approval, voucherNumber, employeeId and signature flags', async () => {
    const res = await request(app)
      .patch(`/api/v1/vouchers/${draftId}`)
      .set('Cookie', empACookie)
      .send({
        expenseTitle: 'Updated title only',
        status: 'APPROVED',
        voucherNumber: 'EV-1999-999999',
        employeeId: '00000000-0000-0000-0000-000000000000',
        approvedAt: '2020-01-01T00:00:00.000Z',
        hasEmployeeSignature: false,
        hasDirectorSignature: true,
        employeeSignatureFileId: null,
        directorSignatureFileId: null,
      });
    // Approved vouchers reject further PATCH with 409; either 409 or a
    // successful update that leaves protected fields untouched is fine.
    if (res.status === 200) {
      const row = await prisma.voucher.findUniqueOrThrow({ where: { id: draftId } });
      expect(row.status).toBe('APPROVED');
      expect(row.voucherNumber).not.toBe('EV-1999-999999');
      expect(row.approvedAt).not.toEqual(new Date('2020-01-01T00:00:00.000Z'));
      expect(row.directorSignatureFileId).not.toBeNull();
    } else {
      expect(res.status).toBe(409);
    }
  });

  it('create ignores client-supplied voucherNumber, status and employeeId', async () => {
    const res = await request(app)
      .post('/api/v1/vouchers')
      .set('Cookie', empACookie)
      .send({
        ...validDraft,
        voucherNumber: 'EV-1999-111111',
        status: 'APPROVED',
        employeeId: '00000000-0000-0000-0000-000000000000',
        approvedAt: '2020-01-01T00:00:00.000Z',
      });
    expect(res.status).toBe(201);
    const voucher = res.body.data;
    expect(voucher.voucherNumber).toMatch(/^EV-\d{4}-\d{6}$/);
    expect(voucher.voucherNumber).not.toBe('EV-1999-111111');
    expect(voucher.status).toBe('DRAFT');
    expect(voucher.approvedAt == null).toBe(true);

    const row = await prisma.voucher.findUniqueOrThrow({ where: { id: voucher.id } });
    expect(row.employeeId).not.toBe('00000000-0000-0000-0000-000000000000');
  });
});
