import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircleIcon, ArrowLeftIcon, CheckCircle2Icon, Loader2Icon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { useResetPassword } from '@/auth/use-auth';
import { AuthLayout } from '@/components/auth/auth-layout';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';

const resetSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetValues = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const reset = useResetPassword();

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await reset.mutateAsync({ token, newPassword: values.newPassword });
    } catch {
      // Error is rendered from reset.error below.
    }
  });

  const invalidToken = !token || (reset.error instanceof ApiError && reset.error.status === 400);

  const serverError =
    reset.error instanceof ApiError && reset.error.status !== 400
      ? reset.error.message
      : reset.error && !(reset.error instanceof ApiError)
        ? 'Password reset failed. Please try again.'
        : null;

  return (
    <AuthLayout>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Choose a new password
        </h1>
        <p className="text-sm text-muted-foreground">
          Your new password replaces the old one and signs out all sessions
        </p>
      </div>

      {invalidToken ? (
        <div className="mt-7 flex flex-col gap-4">
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {token
              ? 'This reset link is invalid or has expired. Request a new one.'
              : 'This reset link is missing its token. Request a new one.'}
          </p>
          <Link
            to="/forgot-password"
            className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            Request a new link
          </Link>
        </div>
      ) : reset.isSuccess ? (
        <div className="mt-7 flex flex-col gap-4">
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm text-foreground"
          >
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            Your password has been updated. Sign in with your new password.
          </p>
          <Link
            to="/login"
            className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            Go to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col gap-4">
          {serverError ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {serverError}
            </p>
          ) : null}

          <Field data-invalid={!!form.formState.errors.newPassword}>
            <FieldLabel htmlFor="newPassword">New password</FieldLabel>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              aria-invalid={!!form.formState.errors.newPassword}
              {...form.register('newPassword')}
            />
            <FieldError>{form.formState.errors.newPassword?.message}</FieldError>
          </Field>

          <Field data-invalid={!!form.formState.errors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              aria-invalid={!!form.formState.errors.confirmPassword}
              {...form.register('confirmPassword')}
            />
            <FieldError>{form.formState.errors.confirmPassword?.message}</FieldError>
          </Field>

          <Button
            type="submit"
            className="mt-1 h-11 w-full text-[0.95rem] font-semibold"
            disabled={reset.isPending}
          >
            {reset.isPending ? (
              <>
                <Loader2Icon className="animate-spin" /> Updating…
              </>
            ) : (
              'Update password'
            )}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
