import {
  AlertCircleIcon,
  FilePenLineIcon,
  InboxIcon,
  Loader2Icon,
  WalletIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { UserRole } from '@/api/types';
import { useAccountsDashboard } from '@/api/dashboard';
import { useVoucherList } from '@/api/vouchers';
import { useSession } from '@/auth/use-auth';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROLE_LABELS } from '@/lib/roles';

interface RoleContent {
  heading: string;
  summary: string;
  emptyTitle: string;
  emptyDescription: string;
}

const ROLE_CONTENT: Record<UserRole, RoleContent> = {
  EMPLOYEE: {
    heading: 'Your dashboard',
    summary: 'Track and submit your expense vouchers.',
    emptyTitle: 'No vouchers yet',
    emptyDescription: 'Create your first expense draft under My Vouchers.',
  },
  DIRECTOR: {
    heading: 'Review dashboard',
    summary: 'Approve or reject submitted expense vouchers.',
    emptyTitle: 'Nothing to review yet',
    emptyDescription: 'Submitted vouchers appear in your pending approval queue.',
  },
  ACCOUNTS: {
    heading: 'Accounts dashboard',
    summary: 'Review organisation-wide vouchers and approved expenses.',
    emptyTitle: 'No vouchers yet',
    emptyDescription: 'Vouchers appear here once employees create and submit them.',
  },
};

const ROLE_ICON: Record<UserRole, typeof InboxIcon> = {
  EMPLOYEE: FilePenLineIcon,
  DIRECTOR: InboxIcon,
  ACCOUNTS: WalletIcon,
};

const approvedDateFormatter = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });

function formatAmount(amount: string): string {
  const value = Number(amount);
  return Number.isFinite(value)
    ? value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount;
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function AccountsDashboard() {
  const summary = useAccountsDashboard();

  if (summary.isPending) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (summary.isError || !summary.data) {
    return (
      <div className="space-y-4">
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircleIcon className="mt-0.5 size-4" aria-hidden />
          Could not load the dashboard summary.
        </p>
        <Button variant="outline" onClick={() => void summary.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const data = summary.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total vouchers" value={data.total} />
        <KpiCard label="Pending approval" value={data.pendingApproval} />
        <KpiCard label="Approved" value={data.approved} />
        <KpiCard label="Rejected" value={data.rejected} />
        <KpiCard label="Approved amount" value={formatAmount(data.totalApprovedAmount)} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Recent approved vouchers</CardTitle>
              <CardDescription>The latest vouchers cleared by the Director.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/vouchers">All vouchers</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.recentApproved.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approved vouchers yet.</p>
          ) : (
            <ul className="divide-y">
              {data.recentApproved.map((voucher) => (
                <li
                  key={voucher.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm"
                >
                  <Link
                    to={`/vouchers/${voucher.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {voucher.voucherNumber}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {voucher.employee?.fullName ?? '—'} · {voucher.expenseTitle}
                  </span>
                  <span className="tabular-nums">{formatAmount(voucher.amount)}</span>
                  <span className="hidden text-muted-foreground tabular-nums sm:inline">
                    {voucher.approvedAt
                      ? approvedDateFormatter.format(new Date(voucher.approvedAt))
                      : '—'}
                  </span>
                  <StatusBadge status={voucher.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardPage() {
  const session = useSession();
  const pending = useVoucherList(
    session.data?.role === 'DIRECTOR' ? 'PENDING_APPROVAL' : undefined,
  );
  const user = session.data;

  if (!user) {
    return null;
  }

  const content = ROLE_CONTENT[user.role];
  const Icon = ROLE_ICON[user.role];
  const firstName = user.fullName.split(/\s+/)[0] ?? user.fullName;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={`${content.heading}, ${firstName}`}
        description={`${content.summary} — ${ROLE_LABELS[user.role]}${
          user.department ? ` · ${user.department}` : ''
        }`}
      />

      {user.role === 'DIRECTOR' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending approvals</CardTitle>
            <CardDescription>Vouchers submitted and waiting for your decision.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            {pending.isPending ? (
              <Skeleton className="h-9 w-16" />
            ) : pending.isError ? (
              <p className="text-sm text-muted-foreground">Could not load the queue.</p>
            ) : (
              <p className="text-3xl font-semibold tabular-nums">{pending.data.total}</p>
            )}
            <div className="flex items-center gap-2">
              <Button asChild>
                <Link to="/approvals">Open queue</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/vouchers">All vouchers</Link>
              </Button>
            </div>
          </CardContent>
          {pending.isFetching && !pending.isPending ? (
            <p className="flex items-center gap-2 px-6 pb-4 text-xs text-muted-foreground">
              <Loader2Icon className="size-3 animate-spin" aria-hidden /> Refreshing…
            </p>
          ) : null}
        </Card>
      ) : user.role === 'ACCOUNTS' ? (
        <AccountsDashboard />
      ) : (
        <EmptyState icon={Icon} title={content.emptyTitle} description={content.emptyDescription}>
          <Button asChild>
            <Link to="/vouchers">Go to my vouchers</Link>
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
