import { Prisma } from '@prisma/client';
import type { PrismaClient, UserRole } from '@prisma/client';
import {
  EMPLOYEE_SELECT,
  VoucherError,
  toVoucherDto,
  type VoucherDto,
} from '../vouchers/voucher-service.js';

export interface Actor {
  id: string;
  role: UserRole;
}

export interface AccountsDashboardDto {
  total: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
  totalApprovedAmount: string;
  recentApproved: VoucherDto[];
}

export interface EmployeeDashboardDto {
  total: number;
  drafts: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
  /** D-038: sum of the employee's live voucher amounts across all statuses. */
  totalClaimedAmount: string;
}

export interface DirectorDashboardDto {
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  totalPendingAmount: string;
  /** Five most recently created live vouchers, any status. */
  recentActivity: VoucherDto[];
}

export interface DashboardService {
  getAccountsDashboard(actor: Actor): Promise<AccountsDashboardDto>;
  getEmployeeDashboard(actor: Actor): Promise<EmployeeDashboardDto>;
  getDirectorDashboard(actor: Actor): Promise<DirectorDashboardDto>;
}

/** Most recent vouchers shown on the Accounts and Director dashboards. */
const RECENT_TAKE = 5;

/**
 * D-039: "today" is the server-local calendar day. Timestamps in the database
 * are stored as UTC instants; approvedAt comparisons use a local-day range so
 * "approved today" matches what users see on their wall clocks.
 */
function localDayRange(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end };
}

export function createDashboardService(deps: { prisma: PrismaClient }): DashboardService {
  const { prisma } = deps;

  return {
    async getAccountsDashboard(actor) {
      if (actor.role !== 'ACCOUNTS') {
        throw new VoucherError(403, 'FORBIDDEN', 'Only accounts can view this dashboard');
      }
      // Totals are computed from database records (REQUIREMENTS.md dashboards);
      // soft-deleted vouchers never count (D-012).
      const live = { deletedAt: null } satisfies Prisma.VoucherWhereInput;
      const [counts, approvedSum, recentApproved] = await Promise.all([
        prisma.voucher.groupBy({ by: ['status'], where: live, _count: { _all: true } }),
        prisma.voucher.aggregate({
          where: { ...live, status: 'APPROVED' },
          _sum: { amount: true },
        }),
        prisma.voucher.findMany({
          where: { ...live, status: 'APPROVED' },
          include: { employee: { select: EMPLOYEE_SELECT } },
          orderBy: [{ approvedAt: 'desc' }, { createdAt: 'desc' }],
          take: RECENT_TAKE,
        }),
      ]);

      const byStatus = new Map(counts.map((row) => [row.status, row._count._all]));
      return {
        total: counts.reduce((sum, row) => sum + row._count._all, 0),
        pendingApproval: byStatus.get('PENDING_APPROVAL') ?? 0,
        approved: byStatus.get('APPROVED') ?? 0,
        rejected: byStatus.get('REJECTED') ?? 0,
        totalApprovedAmount: (approvedSum._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
        recentApproved: recentApproved.map(toVoucherDto),
      };
    },

    async getEmployeeDashboard(actor) {
      if (actor.role !== 'EMPLOYEE') {
        throw new VoucherError(403, 'FORBIDDEN', 'Only employees can view this dashboard');
      }
      const owned = { employeeId: actor.id, deletedAt: null } satisfies Prisma.VoucherWhereInput;
      const [counts, claimedSum] = await Promise.all([
        prisma.voucher.groupBy({ by: ['status'], where: owned, _count: { _all: true } }),
        prisma.voucher.aggregate({ where: owned, _sum: { amount: true } }),
      ]);

      const byStatus = new Map(counts.map((row) => [row.status, row._count._all]));
      return {
        total: counts.reduce((sum, row) => sum + row._count._all, 0),
        drafts: byStatus.get('DRAFT') ?? 0,
        pendingApproval: byStatus.get('PENDING_APPROVAL') ?? 0,
        approved: byStatus.get('APPROVED') ?? 0,
        rejected: byStatus.get('REJECTED') ?? 0,
        totalClaimedAmount: (claimedSum._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      };
    },

    async getDirectorDashboard(actor) {
      if (actor.role !== 'DIRECTOR') {
        throw new VoucherError(403, 'FORBIDDEN', 'Only directors can view this dashboard');
      }
      const live = { deletedAt: null } satisfies Prisma.VoucherWhereInput;
      const { start, end } = localDayRange();

      // D-040: there is no rejectedAt column, so rejected-today counts REJECTED
      // audit events created today. Rejection is terminal (D-032) and writes
      // exactly one REJECTED event per voucher, so event count == voucher count.
      const [counts, pendingSum, approvedToday, rejectedToday, recentActivity] =
        await Promise.all([
          prisma.voucher.groupBy({ by: ['status'], where: live, _count: { _all: true } }),
          prisma.voucher.aggregate({
            where: { ...live, status: 'PENDING_APPROVAL' },
            _sum: { amount: true },
          }),
          prisma.voucher.count({
            where: {
              ...live,
              status: 'APPROVED',
              approvedAt: { gte: start, lt: end },
            },
          }),
          prisma.voucherEvent.count({
            where: { eventType: 'REJECTED', createdAt: { gte: start, lt: end } },
          }),
          prisma.voucher.findMany({
            where: live,
            include: { employee: { select: EMPLOYEE_SELECT } },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: RECENT_TAKE,
          }),
        ]);

      const byStatus = new Map(counts.map((row) => [row.status, row._count._all]));
      return {
        pendingCount: byStatus.get('PENDING_APPROVAL') ?? 0,
        approvedToday,
        rejectedToday,
        totalPendingAmount: (pendingSum._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
        recentActivity: recentActivity.map(toVoucherDto),
      };
    },
  };
}
