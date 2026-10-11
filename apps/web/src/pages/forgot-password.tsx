import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircleIcon, ArrowLeftIcon, CheckCircle2Icon, Loader2Icon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { useForgotPassword } from '@/auth/use-auth';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

const forgotSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
});

type ForgotValues = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const forgot = useForgotPassword();

  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await forgot.mutateAsync(values);
    } catch {
      // Error is rendered from forgot.error below.
    }
  });

  const serverError =
    forgot.error instanceof ApiError
      ? forgot.error.message
      : forgot.error
        ? 'Request failed. Please try again.'
        : null;

  const sent = forgot.isSuccess;
  const devResetToken = forgot.data?.devResetToken;

  return (
    <AuthLayout>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Reset your password
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your account email and we&apos;ll send a reset link
        </p>
      </div>

      {sent ? (
        <div className="mt-7 flex flex-col gap-4">
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm text-foreground"
          >
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {forgot.data?.message}
          </p>
          {/* Dev-only affordance: the API returns the raw token outside production (D-044). */}
          {devResetToken ? (
            <p className="rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
              Development mode: open{' '}
              <Link
                to={`/reset-password?token=${encodeURIComponent(devResetToken)}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                reset password
              </Link>{' '}
              to continue.
            </p>
          ) : null}
          <Link
            to="/login"
            className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            Back to sign in
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

          <Field data-invalid={!!form.formState.errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              className="h-10 bg-secondary/30 dark:bg-input/30"
              aria-invalid={!!form.formState.errors.email}
              {...form.register('email')}
            />
            <FieldError>{form.formState.errors.email?.message}</FieldError>
          </Field>

          <Button
            type="submit"
            className="mt-1 h-11 w-full text-[0.95rem] font-semibold"
            disabled={forgot.isPending}
          >
            {forgot.isPending ? (
              <>
                <Loader2Icon className="animate-spin" /> Sending…
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
