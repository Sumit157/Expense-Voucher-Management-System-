import { Prisma } from '@prisma/client';
import type { PrismaClient, Voucher, VoucherStatus, UserRole } from '@prisma/client';
import { EXPENSE_CATEGORIES } from '@evm/shared';
import { sniffImageMime, type SignatureStorage } from './signature-storage.js';

/** Server-side error carrying an API.md stable code. */
export class VoucherError extends Error {
  readonly status: number;
  readonly code: string;
  readonly expose = true;
  readonly details?: { field: string; message: string }[];

  constructor(
    status: number,
    code: string,
    message: string,
    details?: { field: string; message: string }[],
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface Actor {
  id: string;
  role: UserRole;
}

export interface DraftInput {
  voucherDate: string;
  expenseDate: string;
  department: string;
  expenseTitle: string;
  category: string;
  description?: string | null;
  amount: string;
}

export interface EmployeeRef {
  id: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
}

export interface VoucherDto {
  id: string;
  voucherNumber: string;
  voucherDate: string;
  expenseDate: string;
  department: string;
  expenseTitle: string;
  category: string;
  description: string | null;
  amount: string;
  status: VoucherStatus;
  hasEmployeeSignature: boolean;
  approvedAt: string | null;
  rejectionReason: string | null;
  employee: EmployeeRef | null;
  createdAt: string;
  updatedAt: string;
}

type VoucherWithEmployee = Voucher & {
  employee: {
    id: string;
    fullName: string;
    employeeCode: string | null;
    department: string | null;
  } | null;
};

const EMPLOYEE_SELECT = {
  id: true,
  fullName: true,
  employeeCode: true,
  department: true,
} as const;

const CATEGORY_SET: ReadonlySet<string> = new Set(EXPENSE_CATEGORIES);

export function isSupportedCategory(category: string): boolean {
  return CATEGORY_SET.has(category);
}

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function fromDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toVoucherDto(voucher: VoucherWithEmployee): VoucherDto {
  return {
    id: voucher.id,
    voucherNumber: voucher.voucherNumber,
    voucherDate: fromDateOnly(voucher.voucherDate),
    expenseDate: fromDateOnly(voucher.expenseDate),
    department: voucher.department,
    expenseTitle: voucher.expenseTitle,
    category: voucher.category,
    description: voucher.description,
    amount: voucher.amount.toFixed(2),
    status: voucher.status,
    hasEmployeeSignature: voucher.employeeSignatureFileId !== null,
    approvedAt: voucher.approvedAt?.toISOString() ?? null,
    rejectionReason: voucher.rejectionReason,
    employee: voucher.employee,
    createdAt: voucher.createdAt.toISOString(),
    updatedAt: voucher.updatedAt.toISOString(),
  };
}

/**
 * Prisma retries only the statement, not the transaction. Retryable classes
 * (DATABASE.md 4): transaction write conflict (P2034), transaction timeout
 * (P2028), and raw-query errors carrying MySQL deadlock (1213) or lock-wait
 * timeout (1205) — surfaced by Prisma as P2010 with meta.code set.
 */
function isRetryableTransactionError(error: unknown): boolean {
  const err = error as { code?: string; meta?: { code?: string | number } };
  if (!err?.code) {
    return false;
  }
  if (err.code === 'P2034' || err.code === 'P2028') {
    return true;
  }
  if (err.code === 'P2010') {
    const mysqlCode = String(err.meta?.code ?? '');
    return mysqlCode === '1213' || mysqlCode === '1205';
  }
  return false;
}

async function withTransactionRetry<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  attempts = 5,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(fn);
    } catch (error) {
      if (attempt < attempts - 1 && isRetryableTransactionError(error)) {
        await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
        continue;
      }
      throw error;
    }
  }
}

async function recordEvent(
  tx: Prisma.TransactionClient,
  event: {
    voucherId: string;
    actorId: string;
    eventType: string;
    fromStatus?: VoucherStatus;
    toStatus?: VoucherStatus;
    reason?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.voucherEvent.create({
    data: {
      voucherId: event.voucherId,
      actorId: event.actorId,
      eventType: event.eventType,
      fromStatus: event.fromStatus ?? null,
      toStatus: event.toStatus ?? null,
      reason: event.reason ?? null,
      metadata: event.metadata ?? undefined,
    },
  });
}

export interface VoucherServiceDeps {
  prisma: PrismaClient;
  storage: SignatureStorage;
}

export interface VoucherService {
  createDraft(actor: Actor, input: DraftInput): Promise<VoucherDto>;
  listVouchers(
    actor: Actor,
    filter: { status?: VoucherStatus },
  ): Promise<{ items: VoucherDto[]; total: number }>;
  getVoucher(actor: Actor, id: string): Promise<VoucherDto>;
  updateDraft(actor: Actor, id: string, patch: Partial<DraftInput>): Promise<VoucherDto>;
  deleteDraft(actor: Actor, id: string): Promise<void>;
  attachEmployeeSignature(
    actor: Actor,
    id: string,
    file: { buffer: Buffer; originalName: string },
    maxBytes: number,
  ): Promise<VoucherDto>;
  readEmployeeSignature(actor: Actor, id: string): Promise<{ buffer: Buffer; mimeType: string }>;
}

export function createVoucherService(deps: VoucherServiceDeps): VoucherService {
  const { prisma, storage } = deps;

  /**
   * Load a voucher for an actor with the Phase 4 access rules:
   * - soft-deleted vouchers are invisible (D-012);
   * - employees may touch only their own records;
   * - Director/Accounts may read any record.
   * Non-owner access returns 404 (not 403) so voucher ids cannot be probed.
   */
  async function loadForActor(
    tx: Prisma.TransactionClient | PrismaClient,
    actor: Actor,
    id: string,
  ): Promise<VoucherWithEmployee> {
    const voucher = await tx.voucher.findFirst({
      where: { id, deletedAt: null },
      include: { employee: { select: EMPLOYEE_SELECT } },
    });
    if (!voucher) {
      throw new VoucherError(404, 'NOT_FOUND', 'Voucher not found');
    }
    const isOwner = voucher.employeeId === actor.id;
    const isReader = actor.role === 'DIRECTOR' || actor.role === 'ACCOUNTS';
    if (!isOwner && !isReader) {
      throw new VoucherError(404, 'NOT_FOUND', 'Voucher not found');
    }
    return voucher;
  }

  async function loadOwnedDraft(id: string, actor: Actor): Promise<VoucherWithEmployee> {
    const voucher = await loadForActor(prisma, actor, id);
    if (voucher.employeeId !== actor.id) {
      // Owners only for mutations; readers never mutate.
      throw new VoucherError(404, 'NOT_FOUND', 'Voucher not found');
    }
    if (voucher.status !== 'DRAFT') {
      throw new VoucherError(409, 'INVALID_VOUCHER_STATE', 'Only draft vouchers can be modified');
    }
    return voucher;
  }

  /**
   * D-006/D-009: per-year counter row locked with SELECT ... FOR UPDATE,
   * incremented and consumed in the same transaction as the voucher insert;
   * the unique index on voucher_number is the final backstop.
   */
  async function allocateVoucherNumber(
    tx: Prisma.TransactionClient,
    year: number,
  ): Promise<string> {
    // ON DUPLICATE KEY UPDATE takes the record lock in X mode immediately;
    // plain INSERT IGNORE would take an S lock that inverts with the
    // following SELECT ... FOR UPDATE under REPEATABLE READ (deadlock 1213).
    await tx.$executeRaw`
      INSERT INTO voucher_counters (year, next_value) VALUES (${year}, 1)
      ON DUPLICATE KEY UPDATE next_value = next_value`;
    const rows = await tx.$queryRaw<{ next_value: number }[]>`
      SELECT next_value FROM voucher_counters WHERE year = ${year} FOR UPDATE`;
    const next = rows[0]?.next_value;
    if (typeof next !== 'number') {
      throw new Error(`voucher counter missing for year ${year}`);
    }
    await tx.$executeRaw`UPDATE voucher_counters SET next_value = ${next + 1} WHERE year = ${year}`;
    return `EV-${year}-${String(next).padStart(6, '0')}`;
  }

  const service: VoucherService = {
    async createDraft(actor, input) {
      if (actor.role !== 'EMPLOYEE') {
        throw new VoucherError(403, 'FORBIDDEN', 'Only employees can create vouchers');
      }
      return withTransactionRetry(prisma, async (tx) => {
        const voucherDate = toDateOnly(input.voucherDate);
        const voucherNumber = await allocateVoucherNumber(tx, voucherDate.getUTCFullYear());
        const created = await tx.voucher.create({
          data: {
            voucherNumber,
            voucherDate,
            expenseDate: toDateOnly(input.expenseDate),
            department: input.department,
            expenseTitle: input.expenseTitle,
            category: input.category,
            description: input.description ?? null,
            amount: new Prisma.Decimal(input.amount),
            status: 'DRAFT',
            employeeId: actor.id,
          },
          include: { employee: { select: EMPLOYEE_SELECT } },
        });
        await recordEvent(tx, {
          voucherId: created.id,
          actorId: actor.id,
          eventType: 'CREATED',
          toStatus: 'DRAFT',
          metadata: { voucherNumber },
        });
        return toVoucherDto(created);
      });
    },

    async listVouchers(actor, filter) {
      const where: Prisma.VoucherWhereInput = {
        deletedAt: null,
        ...(actor.role === 'EMPLOYEE' ? { employeeId: actor.id } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.voucher.findMany({
          where,
          include: { employee: { select: EMPLOYEE_SELECT } },
          orderBy: { createdAt: 'desc' },
          // Hard cap until Phase 8 delivers real pagination.
          take: 100,
        }),
        prisma.voucher.count({ where }),
      ]);
      return { items: rows.map(toVoucherDto), total };
    },

    async getVoucher(actor, id) {
      const voucher = await loadForActor(prisma, actor, id);
      return toVoucherDto(voucher);
    },

    async updateDraft(actor, id, patch) {
      await loadOwnedDraft(id, actor);
      return withTransactionRetry(prisma, async (tx) => {
        const data: Prisma.VoucherUpdateManyMutationInput = {};
        if (patch.voucherDate !== undefined) data.voucherDate = toDateOnly(patch.voucherDate);
        if (patch.expenseDate !== undefined) data.expenseDate = toDateOnly(patch.expenseDate);
        if (patch.department !== undefined) data.department = patch.department;
        if (patch.expenseTitle !== undefined) data.expenseTitle = patch.expenseTitle;
        if (patch.category !== undefined) data.category = patch.category;
        if (patch.description !== undefined) data.description = patch.description;
        if (patch.amount !== undefined) data.amount = new Prisma.Decimal(patch.amount);

        const result = await tx.voucher.updateMany({
          // Conditional write: if a concurrent transition left DRAFT, fail.
          where: { id, employeeId: actor.id, status: 'DRAFT', deletedAt: null },
          data,
        });
        if (result.count === 0) {
          throw new VoucherError(
            409,
            'INVALID_VOUCHER_STATE',
            'Only draft vouchers can be modified',
          );
        }
        const updated = await tx.voucher.findUniqueOrThrow({
          where: { id },
          include: { employee: { select: EMPLOYEE_SELECT } },
        });
        await recordEvent(tx, {
          voucherId: id,
          actorId: actor.id,
          eventType: 'UPDATED_DRAFT',
          fromStatus: 'DRAFT',
          toStatus: 'DRAFT',
        });
        return toVoucherDto(updated);
      });
    },

    async deleteDraft(actor, id) {
      await loadOwnedDraft(id, actor);
      await withTransactionRetry(prisma, async (tx) => {
        const result = await tx.voucher.updateMany({
          where: { id, employeeId: actor.id, status: 'DRAFT', deletedAt: null },
          data: { deletedAt: new Date() },
        });
        if (result.count === 0) {
          throw new VoucherError(
            409,
            'INVALID_VOUCHER_STATE',
            'Only draft vouchers can be deleted',
          );
        }
        // D-012: soft delete keeps the row so the audit trail survives.
        await recordEvent(tx, {
          voucherId: id,
          actorId: actor.id,
          eventType: 'DELETED_DRAFT',
          fromStatus: 'DRAFT',
        });
      });
    },

    async attachEmployeeSignature(actor, id, file, maxBytes) {
      await loadOwnedDraft(id, actor);

      if (file.buffer.length === 0 || file.buffer.length > maxBytes) {
        throw new VoucherError(413, 'FILE_TOO_LARGE', 'Signature image exceeds the size limit');
      }
      const mimeType = sniffImageMime(file.buffer);
      if (!mimeType) {
        throw new VoucherError(
          415,
          'UNSUPPORTED_FILE_TYPE',
          'Signature must be a PNG, JPEG or WebP image',
        );
      }

      // Bytes first: a crash here leaves an orphan file, never a dangling
      // reference (the safe direction).
      const saved = await storage.save(file.buffer, mimeType);

      let previousFileId: string | null = null;
      try {
        await withTransactionRetry(prisma, async (tx) => {
          const current = await tx.voucher.findUnique({
            where: { id },
            select: { employeeSignatureFileId: true },
          });
          previousFileId = current?.employeeSignatureFileId ?? null;
          const fileRow = await tx.storedFile.create({
            data: {
              storageKey: saved.storageKey,
              originalName: file.originalName.slice(0, 255),
              mimeType,
              sizeBytes: file.buffer.length,
              sha256: saved.sha256,
              uploadedById: actor.id,
            },
          });
          const result = await tx.voucher.updateMany({
            where: { id, employeeId: actor.id, status: 'DRAFT', deletedAt: null },
            data: { employeeSignatureFileId: fileRow.id },
          });
          if (result.count === 0) {
            throw new VoucherError(
              409,
              'INVALID_VOUCHER_STATE',
              'Only draft vouchers can be signed',
            );
          }
        });
      } catch (error) {
        await storage.remove(saved.storageKey);
        throw error;
      }

      // Replace: drop the superseded file after commit (best-effort).
      if (previousFileId) {
        const previous = await prisma.storedFile
          .delete({ where: { id: previousFileId } })
          .catch(() => null);
        if (previous) {
          await storage.remove(previous.storageKey).catch(() => undefined);
        }
      }

      return service.getVoucher(actor, id);
    },

    async readEmployeeSignature(actor, id) {
      const voucher = await loadForActor(prisma, actor, id);
      if (!voucher.employeeSignatureFileId) {
        throw new VoucherError(404, 'NOT_FOUND', 'Signature not found');
      }
      const fileRow = await prisma.storedFile.findUnique({
        where: { id: voucher.employeeSignatureFileId },
      });
      if (!fileRow) {
        throw new VoucherError(404, 'NOT_FOUND', 'Signature not found');
      }
      const buffer = await storage.read(fileRow.storageKey);
      if (!buffer) {
        throw new VoucherError(404, 'NOT_FOUND', 'Signature not found');
      }
      return { buffer, mimeType: fileRow.mimeType };
    },
  };

  return service;
}
