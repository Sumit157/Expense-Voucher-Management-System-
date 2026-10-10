import { FilePenLineIcon, InboxIcon, WalletIcon } from 'lucide-react';
import type { UserRole } from '@/api/types';
import { useSession } from '@/auth/use-auth';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
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
    emptyDescription:
      'Drafting and submitting expense vouchers arrives in Phase 4. Your vouchers will appear here.',
  },
  DIRECTOR: {
    heading: 'Review dashboard',
    summary: 'Approve, return, or reject submitted expense vouchers.',
    emptyTitle: 'Nothing to review yet',
    emptyDescription:
      'The director approval queue arrives in Phase 5, with reporting dashboards in Phase 6.',
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
        description={`${content.summary} · ${ROLE_LABELS[user.role]}${
          user.department ? ` · ${user.department}` : ''
        }`}
      />
      <EmptyState icon={Icon} title={content.emptyTitle} description={content.emptyDescription} />
    </div>
  );
}
