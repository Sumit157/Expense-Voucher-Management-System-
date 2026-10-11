import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { PrismaClient as Prisma } from '@prisma/client';
import { hashPassword } from '../src/modules/auth/password.js';
import { createTestApp, login } from './helpers/test-app.js';
import { resolveTestDatabaseUrl } from './utils/test-db-url.js';

const PASSWORD = 'TestPass123!';
const EMP1 = 'voucher-emp1@evm.test';
const EMP2 = 'voucher-emp2@evm.test';
const DIRECTOR = 'voucher-dir@evm.test';

const validDraft = {
  voucherDate: '2026-10-01',
  expenseDate: '2026-09-28',
  department: 'Field Operations',
  expenseTitle: 'Client site visit',
  category: 'Travel',
  description: 'Train fare and tolls',
  amount: '1500.50',
};

let prisma: PrismaClient;
let app: ReturnType<typeof createTestApp>;
let emp1Cookie: string;
let emp2Cookie: string;
let directorCookie: string;

const PNG_SIGNATURE = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);

function binaryParser(
  res: { on: (event: string, cb: (chunk?: Buffer) => void) => void },
  cb: (err: Error | null, body?: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk?: Buffer) => {
    if (chunk) {
      chunks.push(chunk);
    }
  });
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

async function createDraft(cookie: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/vouchers')
    .set('Cookie', cookie)
    .send({ ...validDraft, ...overrides });
  return res;
}

beforeAll(async () => {
  prisma = new Prisma({ datasources: { db: { url: resolveTestDatabaseUrl() } } });
  const passwordHash = await hashPassword(PASSWORD);
  const users = [
    {
      email: EMP1,
      fullName: 'Voucher Emp One',
      role: 'EMPLOYEE' as const,
      employeeCode: 'VCH001',
      department: 'Field Operations',
    },
    {
      email: EMP2,
      fullName: 'Voucher Emp Two',
      role: 'EMPLOYEE' as const,
      employeeCode: 'VCH002',
      department: 'Back Office',
    },
    { email: DIRECTOR, fullName: 'Voucher Director', role: 'DIRECTOR' as const },
  ];
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { passwordHash, isActive: true },
      create: { ...user, passwordHash },
    });
  }
  app = createTestApp(prisma);
  emp1Cookie = (await login(app, EMP1, PASSWORD)).cookie;
  emp2Cookie = (await login(app, EMP2, PASSWORD)).cookie;
  directorCookie = (await login(app, DIRECTOR, PASSWORD)).cookie;
});

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: [EMP1, EMP2, DIRECTOR] } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const vouchers = await prisma.voucher.findMany({
    where: { employeeId: { in: userIds } },
    select: { id: true },
  });
  const voucherIds = vouchers.map((v) => v.id);
  await prisma.voucherEvent.deleteMany({ where: { voucherId: { in: voucherIds } } });
  await prisma.voucher.deleteMany({ where: { id: { in: voucherIds } } });
  await prisma.storedFile.deleteMany({ where: { uploadedById: { in: userIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('POST /api/v1/vouchers (create draft)', () => {
  it('creates a draft with a server-generated voucher number and CREATED event', async () => {
    const res = await createDraft(emp1Cookie);

    expect(res.status).toBe(201);
    const voucher = res.body.data;
    expect(voucher.voucherNumber).toMatch(/^EV-\d{4}-\d{6}$/);
    expect(voucher.status).toBe('DRAFT');
    expect(voucher.amount).toBe('1500.50');
    expect(voucher.category).toBe('Travel');
    expect(voucher.hasEmployeeSignature).toBe(false);
    expect(voucher.employee.fullName).toBe('Voucher Emp One');

    const events = await prisma.voucherEvent.findMany({
      where: { voucherId: voucher.id, eventType: 'CREATED' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.toStatus).toBe('DRAFT');
  });

  it('rejects missing/invalid fields with per-field validation details', async () => {
    const res = await request(app).post('/api/v1/vouchers').set('Cookie', emp1Cookie).send({
      voucherDate: '2026-10-01',
      expenseDate: 'not-a-date',
      department: '',
      expenseTitle: '',
      category: 'Nonexistent Category',
      amount: '0',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toContain('expenseDate');
    expect(fields).toContain('department');
    expect(fields).toContain('expenseTitle');
    expect(fields).toContain('category');
    expect(fields).toContain('amount');
  });

  it('rejects the director role with 403', async () => {
    const res = await createDraft(directorCookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects anonymous requests with 401', async () => {
    const res = await request(app).post('/api/v1/vouchers').send(validDraft);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('GET /api/v1/vouchers (list)', () => {
  it('scopes employees to their own vouchers and lets Director see all', async () => {
    const own = await createDraft(emp1Cookie, { expenseTitle: 'Own list voucher' });
    expect(own.status).toBe(201);
    const other = await createDraft(emp2Cookie, { expenseTitle: 'Other list voucher' });
    expect(other.status).toBe(201);

    const emp1List = await request(app).get('/api/v1/vouchers').set('Cookie', emp1Cookie);
    expect(emp1List.status).toBe(200);
    expect(emp1List.body.data.items.length).toBeGreaterThan(0);
    expect(
      emp1List.body.data.items.every(
        (v: { employee: { id: string } }) =>
          v.employee.id === emp1List.body.data.items[0].employee.id,
      ),
    ).toBe(true);
    expect(emp1List.body.data.items.some((v: { id: string }) => v.id === other.body.data.id)).toBe(
      false,
    );

    const dirList = await request(app).get('/api/v1/vouchers').set('Cookie', directorCookie);
    expect(dirList.status).toBe(200);
    expect(dirList.body.data.total).toBeGreaterThanOrEqual(emp1List.body.data.total + 1);
    expect(dirList.body.data.items.some((v: { id: string }) => v.id === other.body.data.id)).toBe(
      true,
    );
  });

  it('validates the status query parameter', async () => {
    const res = await request(app).get('/api/v1/vouchers?status=BOGUS').set('Cookie', emp1Cookie);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/vouchers/:id (detail)', () => {
  it('returns the voucher to its owner, 404 to another employee, 200 to Director', async () => {
    const created = await createDraft(emp1Cookie, { expenseTitle: 'Detail voucher' });
    const id = created.body.data.id;

    const owner = await request(app).get(`/api/v1/vouchers/${id}`).set('Cookie', emp1Cookie);
    expect(owner.status).toBe(200);
    expect(owner.body.data.id).toBe(id);

    const stranger = await request(app).get(`/api/v1/vouchers/${id}`).set('Cookie', emp2Cookie);
    expect(stranger.status).toBe(404);

    const director = await request(app).get(`/api/v1/vouchers/${id}`).set('Cookie', directorCookie);
    expect(director.status).toBe(200);
  });

  it('returns 404 for unknown ids and 400 for malformed ids', async () => {
    const unknown = await request(app)
      .get('/api/v1/vouchers/00000000-0000-4000-8000-000000000000')
      .set('Cookie', emp1Cookie);
    expect(unknown.status).toBe(404);

    const malformed = await request(app)
      .get('/api/v1/vouchers/not-a-uuid')
      .set('Cookie', emp1Cookie);
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/v1/vouchers/:id (update draft)', () => {
  it('updates owned draft fields and appends UPDATED_DRAFT', async () => {
    const created = await createDraft(emp1Cookie, { expenseTitle: 'Before edit' });
    const id = created.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/vouchers/${id}`)
      .set('Cookie', emp1Cookie)
      .send({ expenseTitle: 'After edit', amount: '240.00' });

    expect(res.status).toBe(200);
    expect(res.body.data.expenseTitle).toBe('After edit');
    expect(res.body.data.amount).toBe('240.00');

    const events = await prisma.voucherEvent.findMany({
      where: { voucherId: id, eventType: 'UPDATED_DRAFT' },
    });
    expect(events).toHaveLength(1);
  });

  it('denies other employees (404) and rejects empty patches (400)', async () => {
    const created = await createDraft(emp1Cookie);
    const id = created.body.data.id;

    const stranger = await request(app)
      .patch(`/api/v1/vouchers/${id}`)
      .set('Cookie', emp2Cookie)
      .send({ expenseTitle: 'Hijack attempt' });
    expect(stranger.status).toBe(404);

    const empty = await request(app)
      .patch(`/api/v1/vouchers/${id}`)
      .set('Cookie', emp1Cookie)
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects mutations on non-draft vouchers with INVALID_VOUCHER_STATE', async () => {
    const created = await createDraft(emp1Cookie);
    const id = created.body.data.id;
    await prisma.voucher.update({ where: { id }, data: { status: 'PENDING_APPROVAL' } });

    const res = await request(app)
      .patch(`/api/v1/vouchers/${id}`)
      .set('Cookie', emp1Cookie)
      .send({ expenseTitle: 'Should not apply' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_VOUCHER_STATE');

    const hidden = await prisma.voucher.findUniqueOrThrow({ where: { id } });
    expect(hidden.expenseTitle).not.toBe('Should not apply');
  });

  it('denies Directors the edit role with 403', async () => {
    const created = await createDraft(emp1Cookie);
    const res = await request(app)
      .patch(`/api/v1/vouchers/${created.body.data.id}`)
      .set('Cookie', directorCookie)
      .send({ expenseTitle: 'Director edit' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/vouchers/:id (soft delete)', () => {
  it('soft-deletes the owner draft, keeps the row, appends DELETED_DRAFT', async () => {
    const created = await createDraft(emp1Cookie, { expenseTitle: 'Delete me' });
    const id = created.body.data.id;

    const stranger = await request(app).delete(`/api/v1/vouchers/${id}`).set('Cookie', emp2Cookie);
    expect(stranger.status).toBe(404);

    const res = await request(app).delete(`/api/v1/vouchers/${id}`).set('Cookie', emp1Cookie);
    expect(res.status).toBe(204);

    const detail = await request(app).get(`/api/v1/vouchers/${id}`).set('Cookie', emp1Cookie);
    expect(detail.status).toBe(404);

    const list = await request(app).get('/api/v1/vouchers').set('Cookie', emp1Cookie);
    expect(list.body.data.items.some((v: { id: string }) => v.id === id)).toBe(false);

    const row = await prisma.voucher.findUnique({ where: { id } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();

    const event = await prisma.voucherEvent.findFirst({
      where: { voucherId: id, eventType: 'DELETED_DRAFT' },
    });
    expect(event).not.toBeNull();
    expect(event?.fromStatus).toBe('DRAFT');

    const repeat = await request(app).delete(`/api/v1/vouchers/${id}`).set('Cookie', emp1Cookie);
    expect(repeat.status).toBe(404);
  });
});

describe('voucher number generation (D-006/D-009)', () => {
  it('issues sequential numbers in the EV-YYYY-NNNNNN format', async () => {
    const first = await createDraft(emp1Cookie, { voucherDate: '2026-11-05' });
    const second = await createDraft(emp1Cookie, { voucherDate: '2026-11-05' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const a = first.body.data.voucherNumber;
    const b = second.body.data.voucherNumber;
    expect(a).toMatch(/^EV-2026-\d{6}$/);
    expect(b).toMatch(/^EV-2026-\d{6}$/);
    expect(Number(b.slice(-6))).toBe(Number(a.slice(-6)) + 1);
  });

  it('never issues duplicate numbers under concurrent creation', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createDraft(emp1Cookie, { expenseTitle: `Concurrent ${i}` }),
      ),
    );
    expect(responses.every((r) => r.status === 201)).toBe(true);
    const numbers = responses.map((r) => r.body.data.voucherNumber as string);
    expect(new Set(numbers).size).toBe(5);
  });
});

describe('POST /api/v1/vouchers/:id/signature/employee', () => {
  it('stores a content-sniffed PNG and streams it back to owner and Director only', async () => {
    const created = await createDraft(emp1Cookie, { expenseTitle: 'Sign me' });
    const id = created.body.data.id;

    const none = await request(app)
      .get(`/api/v1/vouchers/${id}/signatures/employee`)
      .set('Cookie', emp1Cookie);
    expect(none.status).toBe(404);

    const upload = await request(app)
      .post(`/api/v1/vouchers/${id}/signature/employee`)
      .set('Cookie', emp1Cookie)
      .attach('file', PNG_SIGNATURE, 'signature.png');
    expect(upload.status).toBe(200);
    expect(upload.body.data.hasEmployeeSignature).toBe(true);

    const asOwner = await request(app)
      .get(`/api/v1/vouchers/${id}/signatures/employee`)
      .set('Cookie', emp1Cookie)
      .buffer(true)
      .parse(binaryParser);
    expect(asOwner.status).toBe(200);
    expect(asOwner.headers['content-type']).toBe('image/png');
    expect(asOwner.headers['cache-control']).toContain('no-store');
    expect(Buffer.compare(asOwner.body, PNG_SIGNATURE)).toBe(0);

    const asDirector = await request(app)
      .get(`/api/v1/vouchers/${id}/signatures/employee`)
      .set('Cookie', directorCookie);
    expect(asDirector.status).toBe(200);

    const asStranger = await request(app)
      .get(`/api/v1/vouchers/${id}/signatures/employee`)
      .set('Cookie', emp2Cookie);
    expect(asStranger.status).toBe(404);
  });

  it('replaces a previous signature and removes the superseded file row', async () => {
    const created = await createDraft(emp1Cookie, { expenseTitle: 'Resign me' });
    const id = created.body.data.id;

    const first = await request(app)
      .post(`/api/v1/vouchers/${id}/signature/employee`)
      .set('Cookie', emp1Cookie)
      .attach('file', PNG_SIGNATURE, 'signature.png');
    expect(first.status).toBe(200);
    const afterFirst = await prisma.voucher.findUniqueOrThrow({ where: { id } });
    const firstFileId = afterFirst.employeeSignatureFileId!;

    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)]);
    const second = await request(app)
      .post(`/api/v1/vouchers/${id}/signature/employee`)
      .set('Cookie', emp1Cookie)
      .attach('file', jpeg, 'signature.jpg');
    expect(second.status).toBe(200);

    const stream = await request(app)
      .get(`/api/v1/vouchers/${id}/signatures/employee`)
      .set('Cookie', emp1Cookie)
      .buffer(true)
      .parse(binaryParser);
    expect(stream.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(stream.body, jpeg)).toBe(0);

    const row = await prisma.voucher.findUniqueOrThrow({ where: { id } });
    const current = await prisma.storedFile.findUnique({
      where: { id: row.employeeSignatureFileId! },
    });
    expect(current?.mimeType).toBe('image/jpeg');
    const superseded = await prisma.storedFile.findUnique({ where: { id: firstFileId } });
    expect(superseded).toBeNull();
  });

  it('rejects non-image content with 415 and oversized files with 413', async () => {
    const created = await createDraft(emp1Cookie);
    const id = created.body.data.id;

    const fake = await request(app)
      .post(`/api/v1/vouchers/${id}/signature/employee`)
      .set('Cookie', emp1Cookie)
      .attach('file', Buffer.from('definitely not an image'), 'fake.png');
    expect(fake.status).toBe(415);
    expect(fake.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');

    const oversized = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(2 * 1024 * 1024 + 16, 3),
    ]);
    const tooBig = await request(app)
      .post(`/api/v1/vouchers/${id}/signature/employee`)
      .set('Cookie', emp1Cookie)
      .attach('file', oversized, 'big.png');
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.error.code).toBe('FILE_TOO_LARGE');

    const afterFailures = await prisma.voucher.findUniqueOrThrow({ where: { id } });
    expect(afterFailures.employeeSignatureFileId).toBeNull();
  });

  it('rejects signing for other employees and non-draft vouchers', async () => {
    const created = await createDraft(emp1Cookie);
    const id = created.body.data.id;

    const stranger = await request(app)
      .post(`/api/v1/vouchers/${id}/signature/employee`)
      .set('Cookie', emp2Cookie)
      .attach('file', PNG_SIGNATURE, 'signature.png');
    expect(stranger.status).toBe(404);

    await prisma.voucher.update({ where: { id }, data: { status: 'PENDING_APPROVAL' } });
    const notDraft = await request(app)
      .post(`/api/v1/vouchers/${id}/signature/employee`)
      .set('Cookie', emp1Cookie)
      .attach('file', PNG_SIGNATURE, 'signature.png');
    expect(notDraft.status).toBe(409);
    expect(notDraft.body.error.code).toBe('INVALID_VOUCHER_STATE');
  });
});
