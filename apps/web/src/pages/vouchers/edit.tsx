import { useState } from 'react';
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { useUpdateVoucher, useVoucher } from '@/api/vouchers';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VoucherForm, toDraftInput, type VoucherFormValues } from './voucher-form';

export function VoucherEditPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const voucher = useVoucher(id);
  const update = useUpdateVoucher();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<{ field: string; message: string }[]>(
    [],
  );

  if (voucher.isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader title="Edit voucher" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (voucher.isError || !voucher.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader title="Edit voucher" />
        <p role="alert" className="text-sm text-destructive">
          This voucher could not be loaded. It may have been deleted.
        </p>
        <Button variant="outline" asChild>
          <Link to="/vouchers">Back to my vouchers</Link>
        </Button>
      </div>
    );
  }

  const data = voucher.data;
  if (data.status !== 'DRAFT') {
    return <Navigate to={`/vouchers/${data.id}`} replace />;
  }

  const onSubmit = (values: VoucherFormValues) => {
    setServerError(null);
    setServerFieldErrors([]);
    update
      .mutateAsync({ id: data.id, input: toDraftInput(values) })
      .then(() => {
        toast.success('Draft updated');
        navigate(`/vouchers/${data.id}`, { replace: true });
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError) {
          setServerError(error.details?.length ? null : error.message);
          if (error.details?.length) {
            setServerFieldErrors(error.details);
          }
        } else {
          setServerError('Could not save the voucher. Please try again.');
        }
      });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title={`Edit ${data.voucherNumber}`}
        description="Draft changes save only when you submit the form."
      />
      <Card>
        <CardHeader>
          <CardDescription>Update the expense details below.</CardDescription>
        </CardHeader>
        <CardContent>
          <VoucherForm
            defaultValues={{
              voucherDate: data.voucherDate,
              expenseDate: data.expenseDate,
              department: data.department,
              expenseTitle: data.expenseTitle,
              category: data.category,
              description: data.description ?? '',
              amount: data.amount,
            }}
            onSubmit={onSubmit}
            pending={update.isPending}
            serverError={serverError}
            serverFieldErrors={serverFieldErrors}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
