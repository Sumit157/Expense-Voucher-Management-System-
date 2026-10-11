import {
  AlertCircleIcon,
  Loader2Icon,
  PlusIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
  SearchIcon,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { EXPENSE_CATEGORIES, VOUCHER_SORT_FIELDS, VOUCHER_STATUSES } from '@evm/shared';
import { useVoucherList, type VoucherListQuery } from '@/api/vouchers';
import type { VoucherSortField, VoucherStatus } from '@/api/types';
import { useSession } from '@/auth/use-auth';
import { Pagination } from '@/components/shared/pagination';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_LABELS: Record<string, string> = {
  ALL: 'All statuses',
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const SORT_LABELS: Record<VoucherSortField, string> = {
  createdAt: 'Created',
  voucherDate: 'Voucher date',
  expenseDate: 'Expense date',
  amount: 'Amount',
  voucherNumber: 'Voucher number',
  status: 'Status',
};

function isVoucherStatus(value: string | null): value is VoucherStatus {
  return value !== null && (VOUCHER_STATUSES as readonly string[]).includes(value);
}

function isSortField(value: string | null): value is VoucherSortField {
  return value !== null && (VOUCHER_SORT_FIELDS as readonly string[]).includes(value);
}

function parsePage(raw: string | null): number {
  const page = Number(raw ?? '1');
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

function parsePageSize(raw: string | null): number | undefined {
  if (raw === null) {
    return undefined;
  }
  const pageSize = Number(raw);
  return Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100 ? pageSize : undefined;
}

function formatCurrency(amount: string): string {
  const value = Number(amount);
  return Number.isFinite(value)
    ? value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount;
}

export function VoucherListPage() {
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEmployee = session.data?.role === 'EMPLOYEE';
  const isAccounts = session.data?.role === 'ACCOUNTS';

  // Approved-voucher focus (Phase 7): Accounts lands on the approved view
  // unless they explicitly pick another filter — including "All statuses".
  const rawStatus = searchParams.get('status');
  const status = isVoucherStatus(rawStatus) ? rawStatus : undefined;
  const effectiveStatus = searchParams.has('status')
    ? status
    : isAccounts
      ? 'APPROVED'
      : undefined;
  const rawSortBy = searchParams.get('sortBy');

  const query: VoucherListQuery = {
    status: effectiveStatus,
    search: searchParams.get('search') || undefined,
    department: searchParams.get('department') || undefined,
    category: searchParams.get('category') || undefined,
    fromDate: searchParams.get('fromDate') || undefined,
    toDate: searchParams.get('toDate') || undefined,
    minAmount: searchParams.get('minAmount') || undefined,
    maxAmount: searchParams.get('maxAmount') || undefined,
    sortBy: isSortField(rawSortBy) ? rawSortBy : undefined,
    sortOrder: searchParams.get('sortOrder') === 'asc' ? 'asc' : undefined,
    page: parsePage(searchParams.get('page')),
    pageSize: parsePageSize(searchParams.get('pageSize')),
  };
  const list = useVoucherList(query);
  const title = isEmployee ? 'My Vouchers' : 'All Vouchers';

  const hasActiveFilters =
    searchParams.has('search') ||
    searchParams.has('department') ||
    searchParams.has('category') ||
    searchParams.has('fromDate') ||
    searchParams.has('toDate') ||
    searchParams.has('minAmount') ||
    searchParams.has('maxAmount') ||
    searchParams.has('status');

  /** Set or clear filters; any filter change returns to page 1. */
  const updateParams = (updates: Record<string, string | undefined>) => {
    // Functional update: two rapid changes (e.g. sort field then direction)
    // must not clobber each other through a stale searchParams closure.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined || value === '') {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }
        if (!('page' in updates)) {
          next.delete('page');
        }
        return next;
      },
      { replace: true },
    );
  };

  const controlClass =
    'h-9 w-full rounded-md border bg-background px-2 text-sm aria-invalid:border-destructive';

  if (list.isPending) {
    return (
      <div className="space-y-4">
        <PageHeader title={title} />
        <Skeleton className="h-24 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="space-y-4">
        <PageHeader title={title} />
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircleIcon className="mt-0.5 size-4" aria-hidden />
          Could not load vouchers.
        </p>
        <Button variant="outline" onClick={() => void list.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const { items, total, page, pageSize, totalPages } = list.data;
  const sortField = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder ?? 'desc';
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={total > 0 ? `${total} voucher${total === 1 ? '' : 's'}` : undefined}
        actions={
          isEmployee ? (
            <Button asChild>
              <Link to="/vouchers/new">
                <PlusIcon aria-hidden /> New voucher
              </Link>
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="space-y-3 px-4 py-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm lg:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Search</span>
              <span className="relative block">
                <SearchIcon
                  className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  type="search"
                  value={searchParams.get('search') ?? ''}
                  onChange={(event) => updateParams({ search: event.target.value })}
                  placeholder="Voucher number or employee name"
                  className={`${controlClass} pl-8`}
                  aria-label="Search vouchers"
                />
              </span>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <select
                value={effectiveStatus ?? 'ALL'}
                onChange={(event) => updateParams({ status: event.target.value })}
                className={controlClass}
                aria-label="Filter by status"
              >
                {VOUCHER_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {STATUS_LABELS[option]}
                  </option>
                ))}
                <option value="ALL">All statuses</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Category</span>
              <select
                value={searchParams.get('category') ?? ''}
                onChange={(event) => updateParams({ category: event.target.value })}
                className={controlClass}
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {EXPENSE_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Department</span>
              <input
                type="text"
                value={searchParams.get('department') ?? ''}
                onChange={(event) => updateParams({ department: event.target.value })}
                placeholder="Any department"
                maxLength={120}
                className={controlClass}
                aria-label="Filter by department"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Voucher date from</span>
              <input
                type="date"
                value={searchParams.get('fromDate') ?? ''}
                onChange={(event) => updateParams({ fromDate: event.target.value })}
                className={controlClass}
                aria-label="Voucher date from"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Voucher date to</span>
              <input
                type="date"
                value={searchParams.get('toDate') ?? ''}
                onChange={(event) => updateParams({ toDate: event.target.value })}
                className={controlClass}
                aria-label="Voucher date to"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Min amount</span>
              <input
                type="text"
                inputMode="decimal"
                value={searchParams.get('minAmount') ?? ''}
                onChange={(event) => updateParams({ minAmount: event.target.value })}
                placeholder="0.00"
                className={controlClass}
                aria-label="Minimum amount"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Max amount</span>
              <input
                type="text"
                inputMode="decimal"
                value={searchParams.get('maxAmount') ?? ''}
                onChange={(event) => updateParams({ maxAmount: event.target.value })}
                placeholder="Any"
                className={controlClass}
                aria-label="Maximum amount"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Sort by</span>
              <select
                value={sortField}
                onChange={(event) => updateParams({ sortBy: event.target.value })}
                className={controlClass}
                aria-label="Sort by"
              >
                {VOUCHER_SORT_FIELDS.map((option) => (
                  <option key={option} value={option}>
                    {SORT_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Sort direction</span>
              <select
                value={sortOrder}
                onChange={(event) => updateParams({ sortOrder: event.target.value })}
                className={controlClass}
                aria-label="Sort direction"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
          </div>
          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSearchParams(
                  () => new URLSearchParams(),
                  { replace: true },
                )
              }
            >
              <RotateCcwIcon aria-hidden /> Clear filters
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          icon={ReceiptTextIcon}
          title={hasActiveFilters ? 'No vouchers match these filters' : 'No vouchers yet'}
          description={
            hasActiveFilters
              ? 'Try adjusting or clearing the filters.'
              : isEmployee
                ? 'Create your first expense draft — you can edit or delete it until you submit it for approval.'
                : 'Vouchers appear here once employees create them.'
          }
        >
          {isEmployee && !hasActiveFilters ? (
            <Button asChild>
              <Link to="/vouchers/new">
                <PlusIcon aria-hidden /> New voucher
              </Link>
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Voucher #</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Title</th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((voucher) => (
                    <tr key={voucher.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <Link
                          to={`/vouchers/${voucher.id}`}
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {voucher.voucherNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {voucher.voucherDate}
                      </td>
                      <td className="hidden max-w-48 truncate px-4 py-3 md:table-cell">
                        {voucher.expenseTitle}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                        {voucher.category}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatCurrency(voucher.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={voucher.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            Showing {rangeStart}–{rangeEnd} of {total}
          </p>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(nextPage) => updateParams({ page: String(nextPage) })}
          />
        </div>
      ) : null}

      {list.isFetching ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2Icon className="size-3 animate-spin" aria-hidden /> Refreshing…
        </p>
      ) : null}
    </div>
  );
}
