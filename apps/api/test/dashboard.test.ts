import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient, type VoucherStatus } from '@prisma/client';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp, login } from './helpers/test-app.js';
import { resolveTestDatabaseUrl } from './utils/test-db-url.js';

const PASSWORD = 'TestPass123!';
const ACCOUNTS = 'dash-accounts@evm.test';
const EMP1 = 'dash-emp1@evm.test';
const EMP2 = 'dash-emp2@evm.test';
const DIRECTOR = 'dash-dir@evm.test';

let prisma: PrismaClient;
let app: ReturnType<typeof createTestApp>;
let accountsCookie: string;
let emp1Cookie: string;
let emp2Cookie: string;
let directorCookie: string;
let emp1Id: string;

const PNG_SIGNATURE = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);

// Must match the upload dir wired into createTestApp.
const testUploadDir = path.join(os.tmpdir(), 'evm-test-signatures');

interface FixtureVoucher {
  id: string;
  voucherNumber: string;
}

async function seedVoucher(
  employeeId: string,
  overrides: {
    status: VoucherStatus;
    amount: string;
    voucherNumber: string;
    approvedAt?: Date;
    employeeSignatureFileId?: string;
    directorSignatureFileId?: string;
  },
): Promise<FixtureVoucher> {
  const voucher = await prisma.voucher.create({
    data: {
      voucherNumber: overrides.voucherNumber,
      voucherDate: new Date('2026-10-01T00:00:00.000Z'),
      expenseDate: new Date('2026-09-28T00:00:00.000Z'),
      department: 'Field Operations',
      expenseTitle: `Fixture ${overrides.voucherNumber}`,
      category: 'Travel',
      description: null,
      amount: new Prisma.Decimal(overrides.amount),
      status: overrides.status,
      employeeId,
      approvedAt: overrides.approvedAt ?? null,
      employeeSignatureFileId: overrides.employeeSignatureFileId ?? null,
      directorSignatureFileId: overrides.directorSignatureFileId ?? null,
    },
    select: { id: true, voucherNumber: true },
  });
  return voucher;
}

async function seedSignatureFile(uploaderId: string): Promise<string> {
  const storageKey = `sig-${randomUUID()}.png`;
  await fs.mkdir(testUploadDir, { recursive: true });
  await fs.writeFile(path.join(testUploadDir, storageKey), PNG_SIGNATURE);
  const file = await prisma.storedFile.create({
    data: {
      storageKey,
      originalName: 'signature.png',
      mimeType: 'image/png',
      sizeBytes: PNG_SIGNATURE.length,
      uploadedById: uploaderId,
    },
    select: { id: true },
  });
  return file.id;
}

beforeAll(async () => {
  prisma = new PrismaClient({ datasources: { db: { url: resolveTestDatabaseUrl() } } });
  const passwordHash = await hashPassword(PASSWORD);

  // Self-heal: wipe any rows left behind by a crashed earlier run of this
  // suite OR by other suites (org-wide totals are sensitive to any voucher
  // in the DB, not just this suite's users).
  const priorVouchers = await prisma.voucher.findMany({ select: { id: true } });
  const priorVoucherIds = priorVouchers.map((v) => v.id);
  if (priorVoucherIds.length > 0) {
    await prisma.voucherEvent.deleteMany({ where: { voucherId: { in: priorVoucherIds } } });
    await prisma.voucher.deleteMany({ where: { id: { in: priorVoucherIds } } });
  }
  await prisma.storedFile.deleteMany({});
  const priorUsers = await prisma.user.findMany({
    where: { email: { in: [ACCOUNTS, EMP1, EMP2, DIRECTOR] } },
    select: { id: true },
  });
  const priorIds = priorUsers.map((u) => u.id);
  if (priorIds.length > 0) {
    await prisma.session.deleteMany({ where: { userId: { in: priorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: priorIds } } });
  }

  const users = [
    { email: ACCOUNTS, fullName: 'Dash Accounts', role: 'ACCOUNTS' as const },
    {
      email: EMP1,
      fullName: 'Dash Emp One',
      role: 'EMPLOYEE' as const,
      employeeCode: 'DASH1',
      department: 'Field Operations',
    },
    {
      email: EMP2,
      fullName: 'Dash Emp Two',
      role: 'EMPLOYEE' as const,
      employeeCode: 'DASH2',
      department: 'Back Office',
    },
    { email: DIRECTOR, fullName: 'Dash Director', role: 'DIRECTOR' as const },
  ];
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { passwordHash, isActive: true },
      create: { ...user, passwordHash },
    });
  }
  const emp1 = await prisma.user.findUniqueOrThrow({ where: { email: EMP1 } });
  emp1Id = emp1.id;

  app = createTestApp(prisma);
  accountsCookie = (await login(app, ACCOUNTS, PASSWORD)).cookie;
  emp1Cookie = (await login(app, EMP1, PASSWORD)).cookie;
  emp2Cookie = (await login(app, EMP2, PASSWORD)).cookie;
  directorCookie = (await login(app, DIRECTOR, PASSWORD)).cookie;

  // Known fixture mix for reconciliation:
  // emp1: 2 drafts, 1 pending, 1 approved (1500.50, signed), 1 rejected
  // emp2: 1 pending, 1 approved (2000.00, approved earlier)
  await seedVoucher(emp1Id, { status: 'DRAFT', amount: '100.00', voucherNumber: 'EV-DASH-000001' });
  await seedVoucher(emp1Id, { status: 'DRAFT', amount: '200.00', voucherNumber: 'EV-DASH-000002' });
  await seedVoucher(emp1Id, {
    status: 'PENDING_APPROVAL',
    amount: '300.00',
    voucherNumber: 'EV-DASH-000003',
  });
  const emp1SignedFile = await seedSignatureFile(emp1Id);
  await seedVoucher(emp1Id, {
    status: 'APPROVED',
    amount: '1500.50',
    voucherNumber: 'EV-DASH-000004',
    approvedAt: new Date('2026-10-05T10:00:00.000Z'),
    employeeSignatureFileId: emp1SignedFile,
  });
  await seedVoucher(emp1Id, {
    status: 'REJECTED',
    amount: '400.00',
    voucherNumber: 'EV-DASH-000005',
  });

  const emp2 = await prisma.user.findUniqueOrThrow({ where: { email: EMP2 } });
  await seedVoucher(emp2.id, {
    status: 'PENDING_APPROVAL',
    amount: '500.00',
    voucherNumber: 'EV-DASH-000006',
  });
  await seedVoucher(emp2.id, {
    status: 'APPROVED',
    amount: '2000.00',
    voucherNumber: 'EV-DASH-000007',
    approvedAt: new Date('2026-10-02T10:00:00.000Z'),
  });
});

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: [ACCOUNTS, EMP1, EMP2, DIRECTOR] } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const vouchers = await prisma.voucher.findMany({
    where: { employeeId: { in: userIds } },
    select: { id: true },
  });
  const voucherIds = vouchers.map((v) => v.id);
  const files = await prisma.storedFile.findMany({
    where: { uploadedById: { in: userIds } },
    select: { storageKey: true },
  });
  await prisma.voucherEvent.deleteMany({ where: { voucherId: { in: voucherIds } } });
  await prisma.voucher.deleteMany({ where: { id: { in: voucherIds } } });
  await prisma.storedFile.deleteMany({ where: { uploadedById: { in: userIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await Promise.all(
    files.map((file) =>
      fs.unlink(path.join(testUploadDir, file.storageKey)).catch(() => undefined),
    ),
  );
  await prisma.$disconnect();
});

describe('GET /api/v1/dashboard/accounts', () => {
  it('reconciles totals and approved amount with the fixture data', async () => {
    const res = await request(app).get('/api/v1/dashboard/accounts').set('Cookie', accountsCookie);

    expect(res.status).toBe(200);
    const summary = res.body.data;
    expect(summary.total).toBe(7);
    expect(summary.pendingApproval).toBe(2);
    expect(summary.approved).toBe(2);
    expect(summary.rejected).toBe(1);
    expect(summary.totalApprovedAmount).toBe('3500.50');
  });

  it('returns the most recent approved vouchers with employees, newest approval first', async () => {
    const res = await request(app).get('/api/v1/dashboard/accounts').set('Cookie', accountsCookie);

    expect(res.status).toBe(200);
    const recent = res.body.data.recentApproved;
    expect(recent).toHaveLength(2);
    expect(recent[0].voucherNumber).toBe('EV-DASH-000004');
    expect(recent[0].employee.fullName).toBe('Dash Emp One');
    expect(recent[0].amount).toBe('1500.50');
    expect(recent[0].hasEmployeeSignature).toBe(true);
    expect(recent[1].voucherNumber).toBe('EV-DASH-000007');
    expect(recent[1].amount).toBe('2000.00');
  });

  it('excludes soft-deleted vouchers from every total', async () => {
    const draft = await prisma.voucher.findFirstOrThrow({
      where: { voucherNumber: 'EV-DASH-000002' },
    });
    await prisma.voucher.update({
      where: { id: draft.id },
      data: { deletedAt: new Date('2026-10-06T00:00:00.000Z') },
    });
    try {
      const res = await request(app).get('/api/v1/dashboard/accounts').set('Cookie', accountsCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(6);
    } finally {
      await prisma.voucher.update({ where: { id: draft.id }, data: { deletedAt: null } });
    }
  });

  it('is denied to Directors, Employees and anonymous callers', async () => {
    const director = await request(app).get('/api/v1/dashboard/accounts').set('Cookie', directorCookie);
    expect(director.status).toBe(403);
    expect(director.body.error.code).toBe('FORBIDDEN');

    const employee = await request(app).get('/api/v1/dashboard/accounts').set('Cookie', emp1Cookie);
    expect(employee.status).toBe(403);

    const anonymous = await request(app).get('/api/v1/dashboard/accounts');
    expect(anonymous.status).toBe(401);
  });
});

describe('GET /api/v1/dashboard/employee', () => {
  it('reconciles per-status counts and claimed amount with the fixture data', async () => {
    const res = await request(app).get('/api/v1/dashboard/employee').set('Cookie', emp1Cookie);

    expect(res.status).toBe(200);
    const summary = res.body.data;
    // emp1 fixture: 2 drafts, 1 pending, 1 approved, 1 rejected.
    expect(summary.total).toBe(5);
    expect(summary.drafts).toBe(2);
    expect(summary.pendingApproval).toBe(1);
    expect(summary.approved).toBe(1);
    expect(summary.rejected).toBe(1);
    // D-038: claimed = sum of all own live voucher amounts.
    expect(summary.totalClaimedAmount).toBe('2500.50');
  });

  it('scopes totals to the signed-in employee', async () => {
    const res = await request(app).get('/api/v1/dashboard/employee').set('Cookie', emp2Cookie);

    expect(res.status).toBe(200);
    // emp2 fixture: 1 pending, 1 approved.
    expect(res.body.data).toMatchObject({
      total: 2,
      drafts: 0,
      pendingApproval: 1,
      approved: 1,
      rejected: 0,
      totalClaimedAmount: '2500.00',
    });
  });

  it('excludes soft-deleted vouchers from every total', async () => {
    const draft = await prisma.voucher.findFirstOrThrow({
      where: { voucherNumber: 'EV-DASH-000001' },
    });
    await prisma.voucher.update({
      where: { id: draft.id },
      data: { deletedAt: new Date('2026-10-06T00:00:00.000Z') },
    });
    try {
      const res = await request(app).get('/api/v1/dashboard/employee').set('Cookie', emp1Cookie);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(4);
      expect(res.body.data.drafts).toBe(1);
      expect(res.body.data.totalClaimedAmount).toBe('2400.50');
    } finally {
      await prisma.voucher.update({ where: { id: draft.id }, data: { deletedAt: null } });
    }
  });

  it('is denied to Directors, Accounts and anonymous callers', async () => {
    const director = await request(app).get('/api/v1/dashboard/employee').set('Cookie', directorCookie);
    expect(director.status).toBe(403);
    expect(director.body.error.code).toBe('FORBIDDEN');

    const accounts = await request(app).get('/api/v1/dashboard/employee').set('Cookie', accountsCookie);
    expect(accounts.status).toBe(403);

    const anonymous = await request(app).get('/api/v1/dashboard/employee');
    expect(anonymous.status).toBe(401);
  });
});

describe('GET /api/v1/dashboard/director', () => {
  it('reconciles pending count and amount with the fixture data', async () => {
    const res = await request(app).get('/api/v1/dashboard/director').set('Cookie', directorCookie);

    expect(res.status).toBe(200);
    const summary = res.body.data;
    // Fixture pending: emp1 300.00 + emp2 500.00.
    expect(summary.pendingCount).toBe(2);
    expect(summary.totalPendingAmount).toBe('800.00');
  });

  it('counts approvals and rejections that happened today (local day)', async () => {
    // Fixture approvedAt values are in the past, so they never count as today.
    const baseline = await request(app).get('/api/v1/dashboard/director').set('Cookie', directorCookie);
    expect(baseline.body.data.approvedToday).toBe(0);
    expect(baseline.body.data.rejectedToday).toBe(0);

    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

    const approvedToday = await seedVoucher(emp1Id, {
      status: 'APPROVED',
      amount: '50.00',
      voucherNumber: 'EV-DASH-TODAY-APP',
      approvedAt: today,
    });
    const approvedYesterday = await seedVoucher(emp1Id, {
      status: 'APPROVED',
      amount: '60.00',
      voucherNumber: 'EV-DASH-DAY-BEFORE-APP',
      approvedAt: yesterday,
    });
    const rejectedToday = await seedVoucher(emp1Id, {
      status: 'REJECTED',
      amount: '70.00',
      voucherNumber: 'EV-DASH-TODAY-REJ',
    });
    await prisma.voucherEvent.create({
      data: {
        voucherId: rejectedToday.id,
        actorId: emp1Id,
        eventType: 'REJECTED',
        fromStatus: 'PENDING_APPROVAL',
        toStatus: 'REJECTED',
        reason: 'Dashboard fixture',
        createdAt: today,
      },
    });
    const rejectedYesterday = await seedVoucher(emp1Id, {
      status: 'REJECTED',
      amount: '80.00',
      voucherNumber: 'EV-DASH-DAY-BEFORE-REJ',
    });
    await prisma.voucherEvent.create({
      data: {
        voucherId: rejectedYesterday.id,
        actorId: emp1Id,
        eventType: 'REJECTED',
        fromStatus: 'PENDING_APPROVAL',
        toStatus: 'REJECTED',
        reason: 'Dashboard fixture',
        createdAt: yesterday,
      },
    });

    try {
      const res = await request(app).get('/api/v1/dashboard/director').set('Cookie', directorCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.approvedToday).toBe(1);
      expect(res.body.data.rejectedToday).toBe(1);
    } finally {
      const ids = [approvedToday.id, approvedYesterday.id, rejectedToday.id, rejectedYesterday.id];
      await prisma.voucherEvent.deleteMany({ where: { voucherId: { in: ids } } });
      await prisma.voucher.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it('returns the most recently created live vouchers as recent activity', async () => {
    const res = await request(app).get('/api/v1/dashboard/director').set('Cookie', directorCookie);

    expect(res.status).toBe(200);
    const recent = res.body.data.recentActivity;
    expect(recent).toHaveLength(5);
    // Newest-first; equal timestamps may be tiebroken by id, so only assert
    // that createdAt never increases as we walk the list.
    const created: string[] = recent.map((v: { createdAt: string }) => v.createdAt);
    for (let i = 1; i < created.length; i += 1) {
      expect(created[i]! <= created[i - 1]!).toBe(true);
    }
    expect(
      recent.every((v: { employee: { fullName: string } }) => v.employee.fullName.length > 0),
    ).toBe(true);
  });

  it('is denied to Employees, Accounts and anonymous callers', async () => {
    const employee = await request(app).get('/api/v1/dashboard/director').set('Cookie', emp1Cookie);
    expect(employee.status).toBe(403);
    expect(employee.body.error.code).toBe('FORBIDDEN');

    const accounts = await request(app).get('/api/v1/dashboard/director').set('Cookie', accountsCookie);
    expect(accounts.status).toBe(403);

    const anonymous = await request(app).get('/api/v1/dashboard/director');
    expect(anonymous.status).toBe(401);
  });
});

describe('Accounts access matrix (AUTH-05/AUTH-06)', () => {
  it('reads every voucher in the organisation, with and without a status filter', async () => {
    const all = await request(app).get('/api/v1/vouchers').set('Cookie', accountsCookie);
    expect(all.status).toBe(200);
    expect(all.body.data.total).toBe(7);
    expect(all.body.data.items.every((v: { employee: { fullName: string } }) => v.employee)).toBe(true);

    const pending = await request(app)
      .get('/api/v1/vouchers?status=PENDING_APPROVAL')
      .set('Cookie', accountsCookie);
    expect(pending.status).toBe(200);
    expect(pending.body.data.total).toBe(2);
  });

  it("reads another employee's voucher detail and event timeline", async () => {
    const list = await request(app).get('/api/v1/vouchers').set('Cookie', emp1Cookie);
    const own = list.body.data.items.find(
      (v: { voucherNumber: string }) => v.voucherNumber === 'EV-DASH-000004',
    );
    expect(own).toBeDefined();

    const detail = await request(app)
      .get(`/api/v1/vouchers/${own.id}`)
      .set('Cookie', accountsCookie);
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe('APPROVED');
    expect(detail.body.data.employee.fullName).toBe('Dash Emp One');

    const events = await request(app)
      .get(`/api/v1/vouchers/${own.id}/events`)
      .set('Cookie', accountsCookie);
    expect(events.status).toBe(200);
    expect(Array.isArray(events.body.data)).toBe(true);
  });

  it("reads authorised signatures on another employee's voucher", async () => {
    const list = await request(app).get('/api/v1/vouchers').set('Cookie', emp1Cookie);
    const own = list.body.data.items.find(
      (v: { voucherNumber: string }) => v.voucherNumber === 'EV-DASH-000004',
    );
    const res = await request(app)
      .get(`/api/v1/vouchers/${own.id}/signatures/employee`)
      .set('Cookie', accountsCookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.body.length).toBe(PNG_SIGNATURE.length);
  });

  it('is denied every voucher mutation', async () => {
    const list = await request(app).get('/api/v1/vouchers').set('Cookie', emp1Cookie);
    const draft = list.body.data.items.find(
      (v: { voucherNumber: string }) => v.voucherNumber === 'EV-DASH-000001',
    );
    const pending = list.body.data.items.find(
      (v: { voucherNumber: string }) => v.voucherNumber === 'EV-DASH-000003',
    );
    expect(draft).toBeDefined();
    expect(pending).toBeDefined();

    const create = await request(app)
      .post('/api/v1/vouchers')
      .set('Cookie', accountsCookie)
      .send({
        voucherDate: '2026-10-01',
        expenseDate: '2026-09-28',
        department: 'Finance',
        expenseTitle: 'Nope',
        category: 'Travel',
        amount: '10.00',
      });
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe('FORBIDDEN');

    const patch = await request(app)
      .patch(`/api/v1/vouchers/${draft.id}`)
      .set('Cookie', accountsCookie)
      .send({ expenseTitle: 'Hacked' });
    expect(patch.status).toBe(403);

    const remove = await request(app)
      .delete(`/api/v1/vouchers/${draft.id}`)
      .set('Cookie', accountsCookie);
    expect(remove.status).toBe(403);

    const submit = await request(app)
      .post(`/api/v1/vouchers/${draft.id}/submit`)
      .set('Cookie', accountsCookie);
    expect(submit.status).toBe(403);

    const approve = await request(app)
      .post(`/api/v1/vouchers/${pending.id}/approve`)
      .set('Cookie', accountsCookie);
    expect(approve.status).toBe(403);

    const reject = await request(app)
      .post(`/api/v1/vouchers/${pending.id}/reject`)
      .set('Cookie', accountsCookie)
      .send({ reason: 'No' });
    expect(reject.status).toBe(403);

    const sign = await request(app)
      .post(`/api/v1/vouchers/${draft.id}/signature/employee`)
      .set('Cookie', accountsCookie);
    expect(sign.status).toBe(403);

    // The draft is untouched.
    const unchanged = await request(app)
      .get(`/api/v1/vouchers/${draft.id}`)
      .set('Cookie', emp1Cookie);
    expect(unchanged.body.data.expenseTitle).toBe('Fixture EV-DASH-000001');
  });

  it('cannot reach other employees’ drafts as an employee (404, no probing)', async () => {
    const list = await request(app).get('/api/v1/vouchers').set('Cookie', emp2Cookie);
    expect(list.body.data.total).toBe(2);
    const emp1DraftId = (
      await prisma.voucher.findFirstOrThrow({ where: { voucherNumber: 'EV-DASH-000001' } })
    ).id;
    const foreign = await request(app)
      .get(`/api/v1/vouchers/${emp1DraftId}`)
      .set('Cookie', emp2Cookie);
    expect(foreign.status).toBe(404);
  });
});
