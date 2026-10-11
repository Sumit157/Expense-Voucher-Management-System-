import type { SortOrder, VoucherSortField, VoucherStatus } from '@evm/shared';

export type UserRole = 'EMPLOYEE' | 'DIRECTOR' | 'ACCOUNTS';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
  role: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export type { SortOrder, VoucherSortField, VoucherStatus };

export interface VoucherEmployee {
  id: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
}

/** Server DTO for a voucher (mirrors VoucherDto on the API). */
export interface Voucher {
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
  hasDirectorSignature: boolean;
  approvedAt: string | null;
  rejectionReason: string | null;
  employee: VoucherEmployee | null;
  createdAt: string;
  updatedAt: string;
}

export interface VoucherList {
  items: Voucher[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Server DTO for GET /dashboard/accounts (mirrors AccountsDashboardDto). */
export interface AccountsDashboard {
  total: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
  totalApprovedAmount: string;
  recentApproved: Voucher[];
}

/** Server DTO for GET /dashboard/employee (mirrors EmployeeDashboardDto). */
export interface EmployeeDashboard {
  total: number;
  drafts: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
  totalClaimedAmount: string;
}

/** Server DTO for GET /dashboard/director (mirrors DirectorDashboardDto). */
export interface DirectorDashboard {
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  totalPendingAmount: string;
  recentActivity: Voucher[];
}

/** One entry of the append-only voucher timeline (GET /vouchers/:id/events). */
export interface VoucherEvent {
  id: string;
  eventType: string;
  fromStatus: VoucherStatus | null;
  toStatus: VoucherStatus | null;
  reason: string | null;
  actor: { fullName: string; employeeCode: string | null } | null;
  createdAt: string;
}

/** JSON payload accepted by POST /vouchers and PATCH /vouchers/:id. */
export interface VoucherDraftInput {
  voucherDate: string;
  expenseDate: string;
  department: string;
  expenseTitle: string;
  category: string;
  description?: string | null;
  amount: string;
}
