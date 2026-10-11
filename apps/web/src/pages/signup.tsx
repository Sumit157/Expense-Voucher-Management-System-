import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircleIcon, ArrowRightIcon, Loader2Icon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { useRegister } from '@/auth/use-auth';
import { AuthLayout } from '@/components/auth/auth-layout';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(150),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  department: z.string().trim().max(120).optional(),
});

type SignupValues = z.infer<typeof signupSchema>;

function fieldDetail(
  error: unknown,
): string | null {
  if (error instanceof ApiError && error.details?.length) {
    return error.details[0]?.message ?? null;
  }
  return null;
}

export function SignupPage() {
  const navigate = useNavigate();
  const register = useRegister();

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', department: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await register.mutateAsync({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        department: values.department?.trim() || undefined,
      });
      navigate('/dashboard', { replace: true });
    } catch {
      // Error is rendered from register.error below.
    }
  });

  const serverError =
    register.error instanceof ApiError
      ? (fieldDetail(register.error) ?? register.error.message)
      : register.error
        ? 'Account creation failed. Please try again.'
        : null;

  return (
    <AuthLayout>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Register with your work email to start submitting vouchers
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

        <Field data-invalid={!!form.formState.errors.fullName}>
          <FieldLabel htmlFor="fullName">Full name</FieldLabel>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="Ada Lovelace"
            className="h-10 bg-secondary/30 dark:bg-input/30"
            aria-invalid={!!form.formState.errors.fullName}
            {...form.register('fullName')}
          />
          <FieldError>{form.formState.errors.fullName?.message}</FieldError>
        </Field>

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
            autoComplete="new-password"
            aria-invalid={!!form.formState.errors.password}
            {...form.register('password')}
          />
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>

        <Field data-invalid={!!form.formState.errors.department}>
          <FieldLabel htmlFor="department">
            Department <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="department"
            autoComplete="organization-title"
            placeholder="Engineering"
            className="h-10 bg-secondary/30 dark:bg-input/30"
            aria-invalid={!!form.formState.errors.department}
            {...form.register('department')}
          />
          <FieldError>{form.formState.errors.department?.message}</FieldError>
        </Field>

        <Button
          type="submit"
          className="relative mt-1 h-11 w-full text-[0.95rem] font-semibold"
          disabled={register.isPending}
        >
          {register.isPending ? (
            <>
              <Loader2Icon className="animate-spin" /> Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRightIcon className="absolute right-4" aria-hidden />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
