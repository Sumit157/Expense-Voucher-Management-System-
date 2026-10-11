import { AlertCircleIcon, FilePenLineIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { UserRole, Voucher } from '@/api/types';
import {
  useAccountsDashboard,
  useDirectorDashboard,
  useEmployeeDashboard,
} from '@/api/dashboard';
import { useSession } from '@/auth/use-auth';
import { StatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROLE_LABELS } from '@/lib/roles';

interface RoleContent {
  heading: string;
  summary: string;
}

const ROLE_CONTENT: Record<UserRole, RoleContent> = {
  EMPLOYEE: {
    heading: 'Your dashboard',
    summary: 'Track and submit your expense vouchers.',
  },
  DIRECTOR: {
    heading: 'Review dashboard',
    summary: 'Approve or reject submitted expense vouchers.',
  },
  ACCOUNTS: {
    heading: 'Accounts dashboard',
    summary: 'Review organisation-wide vouchers and approved expenses.',
  },
};

const dateFormatter = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });

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

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-4">
      <p
        role="alert"
        className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      >
        <AlertCircleIcon className="mt-0.5 size-4" aria-hidden />
        Could not load the dashboard summary.
      </p>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function KpiSkeletons({ count }: { count: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

function VoucherRows({
  vouchers,
  emptyLabel,
  dateAccessor,
}: {
  vouchers: Voucher[];
  emptyLabel: string;
  dateAccessor: (voucher: Voucher) => string | null;
}) {
  if (vouchers.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="divide-y">
      {vouchers.map((voucher) => (
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
            {(() => {
              const date = dateAccessor(voucher);
              return date ? dateFormatter.format(new Date(date)) : '—';
            })()}
          </span>
          <StatusBadge status={voucher.status} />
        </li>
      ))}
    </ul>
  );
}

function AccountsDashboard() {
  const summary = useAccountsDashboard();

  if (summary.isPending) {
    return <KpiSkeletons count={5} />;
  }
  if (summary.isError || !summary.data) {
    return <DashboardError onRetry={() => void summary.refetch()} />;
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
          <VoucherRows
            vouchers={data.recentApproved}
            emptyLabel="No approved vouchers yet."
            dateAccessor={(voucher) => voucher.approvedAt}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeeDashboard() {
  const summary = useEmployeeDashboard();

  if (summary.isPending) {
    return <KpiSkeletons count={5} />;
  }
  if (summary.isError || !summary.data) {
    return <DashboardError onRetry={() => void summary.refetch()} />;
  }

  const data = summary.data;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total vouchers" value={data.total} />
        <KpiCard label="Drafts" value={data.drafts} />
        <KpiCard label="Pending approval" value={data.pendingApproval} />
        <KpiCard label="Approved" value={data.approved} />
        <KpiCard label="Rejected" value={data.rejected} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <KpiCard label="Total claimed amount" value={formatAmount(data.totalClaimedAmount)} />
        <Card>
          <CardContent className="flex h-full items-center justify-between gap-4 px-4 py-4">
            <p className="text-sm text-muted-foreground">
              Start a new expense draft or continue an existing one.
            </p>
            <Button asChild>
              <Link to="/vouchers/new">
                <FilePenLineIcon aria-hidden /> New voucher
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DirectorDashboard() {
  const summary = useDirectorDashboard();

  if (summary.isPending) {
    return (
      <div className="space-y-4">
        <KpiSkeletons count={4} />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (summary.isError || !summary.data) {
    return <DashboardError onRetry={() => void summary.refetch()} />;
  }

  const data = summary.data;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Pending approvals" value={data.pendingCount} />
        <KpiCard label="Approved today" value={data.approvedToday} />
        <KpiCard label="Rejected today" value={data.rejectedToday} />
        <KpiCard label="Pending amount" value={formatAmount(data.totalPendingAmount)} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Recent voucher activity</CardTitle>
              <CardDescription>The newest vouchers across the organisation.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" asChild>
                <Link to="/approvals">Open queue</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/vouchers">All vouchers</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <VoucherRows
            vouchers={data.recentActivity}
            emptyLabel="No vouchers yet."
            dateAccessor={(voucher) => voucher.createdAt}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardPage() {
  const session = useSession();
  const user = session.data;

  if (!user) {
    return null;
  }

  const content = ROLE_CONTENT[user.role];
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
        <DirectorDashboard />
      ) : user.role === 'ACCOUNTS' ? (
        <AccountsDashboard />
      ) : (
        <EmployeeDashboard />
      )}
    </div>
  );
}
