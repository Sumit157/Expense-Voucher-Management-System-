import { AlertCircleIcon, ClipboardCheckIcon, Loader2Icon } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useVoucherList } from '@/api/vouchers';
import { useSession } from '@/auth/use-auth';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function formatCurrency(amount: string): string {
  const value = Number(amount);
  return Number.isFinite(value)
    ? value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount;
}

export function ApprovalsQueuePage() {
  const session = useSession();
  const list = useVoucherList('PENDING_APPROVAL');

  // Client-side guard only (D-025); the API scopes every request server-side.
  if (session.data && session.data.role !== 'DIRECTOR') {
    return <Navigate to="/dashboard" replace />;
  }

  if (list.isPending) {
    return (
      <div className="space-y-4">
        <PageHeader title="Pending Approvals" />
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
        <PageHeader title="Pending Approvals" />
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircleIcon className="mt-0.5 size-4" aria-hidden />
          Could not load the approval queue.
        </p>
        <Button variant="outline" onClick={() => void list.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const { items } = list.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pending Approvals"
        description={
          items.length > 0
            ? `${items.length} voucher${items.length === 1 ? '' : 's'} awaiting a decision`
            : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheckIcon}
          title="Nothing to review"
          description="Submitted vouchers appear here for approval or rejection."
        >
          <Button variant="outline" asChild>
            <Link to="/vouchers?status=PENDING_APPROVAL">View all pending</Link>
          </Button>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Voucher #</th>
                    <th className="px-4 py-3 font-medium">Employee</th>
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
                      <td className="px-4 py-3 text-muted-foreground">
                        {voucher.employee?.fullName ?? '—'}
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

      {list.isFetching ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2Icon className="size-3 animate-spin" aria-hidden /> Refreshing…
        </p>
      ) : null}
    </div>
  );
}
