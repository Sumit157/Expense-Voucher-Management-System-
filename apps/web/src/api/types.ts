import type { VoucherStatus } from '@evm/shared';

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

export type { VoucherStatus };

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
  approvedAt: string | null;
  rejectionReason: string | null;
  employee: VoucherEmployee | null;
  createdAt: string;
  updatedAt: string;
}

export interface VoucherList {
  items: Voucher[];
  total: number;
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
