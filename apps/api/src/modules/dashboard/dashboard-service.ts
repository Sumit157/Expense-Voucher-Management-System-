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

export interface DashboardService {
  getAccountsDashboard(actor: Actor): Promise<AccountsDashboardDto>;
}

/** Most recent approved vouchers shown on the Accounts dashboard. */
const RECENT_APPROVED_TAKE = 5;

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
          take: RECENT_APPROVED_TAKE,
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
  };
}
