import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  FilePlusIcon,
  HistoryIcon,
  PenLineIcon,
  ReceiptTextIcon,
  SendIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react';
import { ApiError } from '@/api/client';
import { useSession } from '@/auth/use-auth';
import {
  useDeleteVoucher,
  useSubmitVoucher,
  useUploadEmployeeSignature,
  useVoucher,
  useVoucherEvents,
} from '@/api/vouchers';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function signatureUrl(id: string): string {
  return `/api/v1/vouchers/${id}/signatures/employee`;
}

const EVENT_LABELS: Record<string, string> = {
  CREATED: 'Draft created',
  UPDATED_DRAFT: 'Draft updated',
  SUBMITTED: 'Submitted for approval',
  DELETED_DRAFT: 'Draft deleted',
};

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CREATED: FilePlusIcon,
  UPDATED_DRAFT: PenLineIcon,
  SUBMITTED: SendIcon,
  DELETED_DRAFT: Trash2Icon,
};

const eventTimestampFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function VoucherDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const session = useSession();
  const voucher = useVoucher(id);
  const events = useVoucherEvents(id);
  const deleteVoucher = useDeleteVoucher();
  const submitVoucher = useSubmitVoucher();
  const upload = useUploadEmployeeSignature();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  if (voucher.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (voucher.isError || !voucher.data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Voucher" />
        <EmptyState
          icon={ReceiptTextIcon}
          title="Voucher not found"
          description="It may have been deleted, or you do not have access to it."
        >
          <Button variant="outline" asChild>
            <Link to="/vouchers">Back to my vouchers</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  const data = voucher.data;
  const isOwner = session.data?.id === data.employee?.id;
  const canEdit = isOwner && data.status === 'DRAFT';
  const canSubmit = canEdit && data.hasEmployeeSignature;

  const onDelete = () => {
    deleteVoucher
      .mutateAsync(data.id)
      .then(() => {
        toast.success(`${data.voucherNumber} deleted`);
        navigate('/vouchers', { replace: true });
      })
      .catch(() => {
        toast.error('Could not delete the voucher');
        setConfirmingDelete(false);
      });
  };

  const onSubmit = () => {
    submitVoucher
      .mutateAsync(data.id)
      .then(() => {
        toast.success('Voucher submitted for approval');
        setConfirmingSubmit(false);
      })
      .catch((error: unknown) => {
        setConfirmingSubmit(false);
        if (error instanceof ApiError && error.code === 'SIGNATURE_REQUIRED') {
          toast.error('Upload your signature before submitting');
        } else if (error instanceof ApiError && error.code === 'INVALID_VOUCHER_STATE') {
          toast.error('This voucher is no longer a draft');
        } else {
          toast.error('Could not submit the voucher');
        }
      });
  };

  const onFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    upload
      .mutateAsync({ id: data.id, file })
      .then(() => toast.success('Signature saved'))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === 'FILE_TOO_LARGE') {
          toast.error('Signature must be 2 MB or smaller');
        } else if (error instanceof ApiError && error.code === 'UNSUPPORTED_FILE_TYPE') {
          toast.error('Signature must be a PNG, JPEG or WebP image');
        } else {
          toast.error('Could not upload the signature');
        }
      });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/vouchers">
            <ArrowLeftIcon aria-hidden /> My vouchers
          </Link>
        </Button>
      </div>

      <PageHeader
        title={data.voucherNumber}
        description={data.expenseTitle}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={data.status} />
            {canEdit ? (
              confirmingSubmit ? (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={submitVoucher.isPending}
                    onClick={onSubmit}
                  >
                    {submitVoucher.isPending ? 'Submitting…' : 'Yes, submit'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmingSubmit(false)}>
                    Cancel
                  </Button>
                </>
              ) : confirmingDelete ? (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteVoucher.isPending}
                    onClick={onDelete}
                  >
                    {deleteVoucher.isPending ? 'Deleting…' : 'Yes, delete'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmingDelete(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/vouchers/${data.id}/edit`}>
                      <PenLineIcon aria-hidden /> Edit
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmingDelete(true)}>
                    <Trash2Icon aria-hidden /> Delete
                  </Button>
                  <Button size="sm" disabled={!canSubmit} onClick={() => setConfirmingSubmit(true)}>
                    <SendIcon aria-hidden /> Submit
                  </Button>
                </>
              )
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expense details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Voucher date
              </dt>
              <dd className="text-sm tabular-nums">{data.voucherDate}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Expense date
              </dt>
              <dd className="text-sm tabular-nums">{data.expenseDate}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Category
              </dt>
              <dd className="text-sm">{data.category}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Department
              </dt>
              <dd className="text-sm">{data.department}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Employee
              </dt>
              <dd className="text-sm">
                {data.employee?.fullName ?? '—'}
                {data.employee?.employeeCode ? (
                  <span className="text-muted-foreground"> ({data.employee.employeeCode})</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Amount
              </dt>
              <dd className="text-lg font-semibold tabular-nums">{data.amount}</dd>
            </div>
            {data.description ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </dt>
                <dd className="whitespace-pre-wrap text-sm">{data.description}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employee signature</CardTitle>
          <CardDescription>Stored privately and only visible to authorized users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.hasEmployeeSignature ? (
            <img
              src={signatureUrl(data.id)}
              alt="Employee signature"
              className="max-h-32 rounded-md border bg-background p-2"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No signature yet.</p>
          )}

          {canEdit ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={onFileSelected}
                aria-label="Signature image file"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={upload.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon aria-hidden />
                {upload.isPending
                  ? 'Uploading…'
                  : data.hasEmployeeSignature
                    ? 'Replace signature'
                    : 'Upload signature'}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">PNG, JPEG or WebP — up to 2 MB.</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {data.status === 'DRAFT' ? (
        <p className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {canSubmit
            ? 'Ready to submit. After submission this voucher becomes read-only and enters the approval queue.'
            : 'This draft is saved but not yet submitted. Upload your signature to enable submission.'}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HistoryIcon aria-hidden className="size-4" /> Activity
          </CardTitle>
          <CardDescription>Append-only audit trail of this voucher.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.isPending ? (
            <Skeleton className="h-20 w-full" />
          ) : events.isError ? (
            <p className="text-sm text-muted-foreground">Could not load the activity timeline.</p>
          ) : events.data && events.data.length > 0 ? (
            <ol className="space-y-3">
              {events.data.map((event) => {
                const Icon = EVENT_ICONS[event.eventType] ?? HistoryIcon;
                return (
                  <li key={event.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground [&>svg]:size-3">
                      <Icon aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p>
                        {EVENT_LABELS[event.eventType] ?? event.eventType}
                        {event.actor ? (
                          <span className="text-muted-foreground"> — {event.actor.fullName}</span>
                        ) : null}
                      </p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {eventTimestampFormatter.format(new Date(event.createdAt))}
                      </p>
                      {event.reason ? (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                          Reason: {event.reason}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
