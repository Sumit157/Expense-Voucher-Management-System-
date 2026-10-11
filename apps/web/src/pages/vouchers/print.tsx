import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, PrinterIcon, ReceiptTextIcon } from 'lucide-react';
import { useSession } from '@/auth/use-auth';
import { useVoucher } from '@/api/vouchers';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function employeeSignatureUrl(id: string): string {
  return `/api/v1/vouchers/${id}/signatures/employee`;
}

function directorSignatureUrl(id: string): string {
  return `/api/v1/vouchers/${id}/signatures/director`;
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function PrintField({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

/** Print-friendly voucher document — Director and Accounts only (D-036). */
export function VoucherPrintPage() {
  const { id = '' } = useParams<{ id: string }>();
  const session = useSession();
  const voucher = useVoucher(id);
  const role = session.data?.role;
  const canPrint = role === 'DIRECTOR' || role === 'ACCOUNTS';

  useEffect(() => {
    if (!canPrint || voucher.isPending || !voucher.data) {
      return;
    }
    const previous = document.title;
    document.title = `${voucher.data.voucherNumber} · Expense Voucher`;
    return () => {
      document.title = previous;
    };
  }, [canPrint, voucher.isPending, voucher.data]);

  if (!canPrint) {
    // Client-side guard (D-025 pattern); the API still enforces access.
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <EmptyState
          icon={ReceiptTextIcon}
          title="Print view is for Directors and Accounts"
          description="Open the voucher detail page instead."
        >
          <Button variant="outline" asChild>
            <Link to={`/vouchers/${id}`}>Back to voucher</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  if (voucher.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (voucher.isError || !voucher.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <EmptyState
          icon={ReceiptTextIcon}
          title="Voucher not found"
          description="It may have been deleted, or you do not have access to it."
        >
          <Button variant="outline" asChild>
            <Link to="/vouchers">Back to all vouchers</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  const data = voucher.data;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Screen-only actions — hidden by print:hidden when printing. */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/vouchers/${data.id}`}>
            <ArrowLeftIcon aria-hidden /> Back to voucher
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <PrinterIcon aria-hidden /> Print
        </Button>
      </div>

      <article className="rounded-lg border bg-background p-6 shadow-sm sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Expense Voucher
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{data.voucherNumber}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{data.expenseTitle}</p>
          </div>
          <div className="text-right">
            <StatusBadge status={data.status} />
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              Printed {dateTimeFormatter.format(new Date())}
            </p>
          </div>
        </header>

        <dl className="grid gap-x-10 gap-y-4 py-6 sm:grid-cols-2">
          <PrintField label="Voucher date" value={dateFormatter.format(new Date(`${data.voucherDate}T00:00:00.000Z`))} />
          <PrintField label="Expense date" value={dateFormatter.format(new Date(`${data.expenseDate}T00:00:00.000Z`))} />
          <PrintField label="Department" value={data.department} />
          <PrintField label="Category" value={data.category} />
          <PrintField
            label="Employee"
            value={
              <>
                {data.employee?.fullName ?? '—'}
                {data.employee?.employeeCode ? (
                  <span className="text-muted-foreground"> ({data.employee.employeeCode})</span>
                ) : null}
              </>
            }
          />
          <PrintField
            label="Amount"
            value={<span className="text-lg font-semibold tabular-nums">{data.amount}</span>}
          />
          {data.description ? (
            <PrintField
              label="Description"
              className="sm:col-span-2"
              value={<span className="whitespace-pre-wrap">{data.description}</span>}
            />
          ) : null}
        </dl>

        {data.status === 'REJECTED' && data.rejectionReason ? (
          <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-destructive">
              Rejection reason
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{data.rejectionReason}</p>
          </div>
        ) : null}

        <div className="grid gap-6 border-t pt-6 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Employee signature
            </p>
            {data.hasEmployeeSignature ? (
              <img
                src={employeeSignatureUrl(data.id)}
                alt="Employee signature"
                className="mt-2 max-h-24 rounded-md border bg-background p-2"
              />
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Not signed.</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Director signature
            </p>
            {data.hasDirectorSignature ? (
              <img
                src={directorSignatureUrl(data.id)}
                alt="Director signature"
                className="mt-2 max-h-24 rounded-md border bg-background p-2"
              />
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Not approved yet.</p>
            )}
            {data.approvedAt ? (
              <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                Approved {dateTimeFormatter.format(new Date(data.approvedAt))}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="mt-6 border-t pt-4 text-[10px] text-muted-foreground">
          Expense Voucher Management System · {data.voucherNumber} · Generated{' '}
          {dateTimeFormatter.format(new Date())}
        </footer>
      </article>
    </div>
  );
}
