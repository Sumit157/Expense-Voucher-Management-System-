import type { VoucherStatus } from '@evm/shared';
import { Badge } from '@/components/ui/badge';

const STATUS_META: Record<
  VoucherStatus,
  { label: string; variant: 'outline' | 'secondary' | 'default' | 'destructive' }
> = {
  DRAFT: { label: 'Draft', variant: 'outline' },
  PENDING_APPROVAL: { label: 'Pending approval', variant: 'secondary' },
  APPROVED: { label: 'Approved', variant: 'default' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
};

export function statusLabel(status: VoucherStatus): string {
  return STATUS_META[status].label;
}

export function StatusBadge({ status }: { status: VoucherStatus }) {
  const meta = STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
