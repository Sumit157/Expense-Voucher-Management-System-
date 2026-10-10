import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircleIcon, Loader2Icon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { useLogin } from '@/auth/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      navigate(from, { replace: true });
    } catch {
      // Error is rendered from login.error below.
    }
  });

  const serverError =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? 'Sign in failed. Please try again.'
        : null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
        >
          EV
        </span>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Expense Voucher Management System
        </p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="font-heading text-base leading-snug font-medium text-card-foreground">
            Sign in
          </h1>
          <CardDescription>Use your organization account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {serverError ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
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
                aria-invalid={!!form.formState.errors.email}
                {...form.register('email')}
              />
              <FieldError>{form.formState.errors.email?.message}</FieldError>
            </Field>

            <Field data-invalid={!!form.formState.errors.password}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!form.formState.errors.password}
                {...form.register('password')}
              />
              <FieldError>{form.formState.errors.password?.message}</FieldError>
            </Field>

            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? (
                <>
                  <Loader2Icon className="animate-spin" /> Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
