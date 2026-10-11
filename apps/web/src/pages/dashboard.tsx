import { FilePenLineIcon, InboxIcon, Loader2Icon, WalletIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { UserRole } from '@/api/types';
import { useVoucherList } from '@/api/vouchers';
import { useSession } from '@/auth/use-auth';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
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
    heading: 'Processing dashboard',
    summary: 'Verify, schedule, and mark expense vouchers as paid.',
    emptyTitle: 'Nothing to process yet',
    emptyDescription: 'The accounts payment registry and processing workflow arrive in Phase 7.',
  },
};

const ROLE_ICON: Record<UserRole, typeof InboxIcon> = {
  EMPLOYEE: FilePenLineIcon,
  DIRECTOR: InboxIcon,
  ACCOUNTS: WalletIcon,
};

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
      ) : (
        <EmptyState icon={Icon} title={content.emptyTitle} description={content.emptyDescription}>
          {user.role === 'EMPLOYEE' ? (
            <Button asChild>
              <Link to="/vouchers">Go to my vouchers</Link>
            </Button>
          ) : null}
        </EmptyState>
      )}
    </div>
  );
}
