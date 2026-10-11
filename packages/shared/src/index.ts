export const API_BASE_PATH = '/api/v1';

/**
 * Supported expense categories (DECISIONS.md D-015). The server rejects any
 * voucher whose category is not in this list; the web form builds its select
 * from it so both sides cannot drift apart.
 */
export const EXPENSE_CATEGORIES = [
  'Travel',
  'Local Transport',
  'Accommodation',
  'Meals',
  'Office Supplies',
  'Communications',
  'Training',
  'Client Entertainment',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const VOUCHER_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const;

export type VoucherStatus = (typeof VOUCHER_STATUSES)[number];

/**
 * Allow-listed sort fields for GET /vouchers (API.md). Both the API validation
 * and the web sort control build from this list so they cannot drift; unknown
 * sortBy values are rejected with 400 rather than silently ignored.
 */
export const VOUCHER_SORT_FIELDS = [
  'createdAt',
  'voucherDate',
  'expenseDate',
  'amount',
  'voucherNumber',
  'status',
] as const;

export type VoucherSortField = (typeof VOUCHER_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;

export type SortOrder = (typeof SORT_ORDERS)[number];
