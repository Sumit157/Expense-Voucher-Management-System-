import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { useSession } from '@/auth/use-auth';
import { useCreateVoucher } from '@/api/vouchers';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { VoucherForm, toDraftInput, type VoucherFormValues } from './voucher-form';

export function VoucherCreatePage() {
  const navigate = useNavigate();
  const session = useSession();
  const create = useCreateVoucher();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<{ field: string; message: string }[]>(
    [],
  );

  const onSubmit = (values: VoucherFormValues) => {
    setServerError(null);
    setServerFieldErrors([]);
    create
      .mutateAsync(toDraftInput(values))
      .then((voucher) => {
        toast.success('Draft created');
        navigate(`/vouchers/${voucher.id}`, { replace: true });
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
        title="New voucher"
        description="Drafts can be edited or deleted until you submit them."
      />
      <Card>
        <CardHeader>
          <CardDescription>Fill in the expense details below.</CardDescription>
        </CardHeader>
        <CardContent>
          <VoucherForm
            defaultValues={{ department: session.data?.department ?? '' }}
            onSubmit={onSubmit}
            pending={create.isPending}
            serverError={serverError}
            serverFieldErrors={serverFieldErrors}
            submitLabel="Create draft"
          />
        </CardContent>
      </Card>
    </div>
  );
}
