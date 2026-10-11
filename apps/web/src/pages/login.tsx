import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircleIcon, ArrowRightIcon, Loader2Icon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { useLogin } from '@/auth/use-auth';
import { AuthLayout } from '@/components/auth/auth-layout';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
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
    <AuthLayout>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your organization account
        </p>
      </div>

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

        <Field data-invalid={!!form.formState.errors.password}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={!!form.formState.errors.password}
            {...form.register('password')}
          />
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>

        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
            <input
              type="checkbox"
              className="size-4 shrink-0 rounded-[4px] border border-input accent-primary"
              {...form.register('rememberMe')}
            />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          className="relative mt-1 h-11 w-full text-[0.95rem] font-semibold"
          disabled={login.isPending}
        >
          {login.isPending ? (
            <>
              <Loader2Icon className="animate-spin" /> Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRightIcon className="absolute right-4" aria-hidden />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to the organization?{' '}
        <Link
          to="/signup"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
