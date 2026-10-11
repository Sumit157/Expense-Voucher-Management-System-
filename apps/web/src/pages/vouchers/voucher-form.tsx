import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { EXPENSE_CATEGORIES } from '@evm/shared';
import type { VoucherDraftInput } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const dateSchema = z
  .string()
  .min(1, 'This date is required')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date');

/** Client mirror of the server's draft validation (same rules, same messages). */
const voucherFormSchema = z.object({
  voucherDate: dateSchema,
  expenseDate: dateSchema,
  department: z.string().trim().min(1, 'Department is required').max(120, 'Too long'),
  expenseTitle: z.string().trim().min(1, 'Title is required').max(200, 'Too long'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().max(5000, 'Too long').optional(),
  amount: z
    .string()
    .trim()
    .min(1, 'Amount is required')
    .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter a positive amount with up to 2 decimals')
    .refine((value) => Number(value) > 0, 'Must be greater than zero'),
});

export type VoucherFormValues = z.infer<typeof voucherFormSchema>;

export function toDraftInput(values: VoucherFormValues): VoucherDraftInput {
  return {
    voucherDate: values.voucherDate,
    expenseDate: values.expenseDate,
    department: values.department,
    expenseTitle: values.expenseTitle,
    category: values.category,
    description: values.description?.trim() ? values.description.trim() : null,
    amount: values.amount,
  };
}

interface VoucherFormProps {
  defaultValues?: Partial<VoucherFormValues>;
  onSubmit: (values: VoucherFormValues) => void;
  pending?: boolean;
  serverError?: string | null;
  serverFieldErrors?: { field: string; message: string }[];
  submitLabel: string;
}

export function VoucherForm({
  defaultValues,
  onSubmit,
  pending = false,
  serverError,
  serverFieldErrors,
  submitLabel,
}: VoucherFormProps) {
  const form = useForm<VoucherFormValues>({
    resolver: zodResolver(voucherFormSchema),
    defaultValues: {
      voucherDate: '',
      expenseDate: '',
      department: '',
      expenseTitle: '',
      category: '',
      description: '',
      amount: '',
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (!serverFieldErrors?.length) {
      return;
    }
    for (const { field, message } of serverFieldErrors) {
      if (field in voucherFormSchema.shape) {
        form.setError(field as keyof VoucherFormValues, {
          type: 'server',
          message,
        });
      }
    }
  }, [serverFieldErrors, form]);

  const { errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.voucherDate}>
          <FieldLabel htmlFor="voucherDate">Voucher date</FieldLabel>
          <Input
            id="voucherDate"
            type="date"
            aria-invalid={!!errors.voucherDate}
            {...form.register('voucherDate')}
          />
          <FieldError>{errors.voucherDate?.message}</FieldError>
        </Field>

        <Field data-invalid={!!errors.expenseDate}>
          <FieldLabel htmlFor="expenseDate">Expense date</FieldLabel>
          <Input
            id="expenseDate"
            type="date"
            aria-invalid={!!errors.expenseDate}
            {...form.register('expenseDate')}
          />
          <FieldError>{errors.expenseDate?.message}</FieldError>
        </Field>
      </div>

      <Field data-invalid={!!errors.expenseTitle}>
        <FieldLabel htmlFor="expenseTitle">Expense title</FieldLabel>
        <Input
          id="expenseTitle"
          placeholder="Client site visit"
          aria-invalid={!!errors.expenseTitle}
          {...form.register('expenseTitle')}
        />
        <FieldError>{errors.expenseTitle?.message}</FieldError>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.category}>
          <FieldLabel htmlFor="category">Category</FieldLabel>
          <select
            id="category"
            aria-invalid={!!errors.category}
            className={cn(
              'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm',
              'shadow-xs transition-[color,box-shadow] outline-none',
              'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
              'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
              'dark:bg-input/30',
              errors.category && 'border-destructive',
            )}
            {...form.register('category')}
          >
            <option value="">Select a category…</option>
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <FieldError>{errors.category?.message}</FieldError>
        </Field>

        <Field data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="amount">Amount</FieldLabel>
          <Input
            id="amount"
            inputMode="decimal"
            placeholder="0.00"
            aria-invalid={!!errors.amount}
            {...form.register('amount')}
          />
          <FieldError>{errors.amount?.message}</FieldError>
        </Field>
      </div>

      <Field data-invalid={!!errors.department}>
        <FieldLabel htmlFor="department">Department</FieldLabel>
        <Input
          id="department"
          placeholder="Field Operations"
          aria-invalid={!!errors.department}
          {...form.register('department')}
        />
        <FieldError>{errors.department?.message}</FieldError>
      </Field>

      <Field data-invalid={!!errors.description}>
        <FieldLabel htmlFor="description">Description (optional)</FieldLabel>
        <textarea
          id="description"
          rows={3}
          aria-invalid={!!errors.description}
          className={cn(
            'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm',
            'shadow-xs transition-[color,box-shadow] outline-none',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
            'dark:bg-input/30',
          )}
          {...form.register('description')}
        />
        <FieldError>{errors.description?.message}</FieldError>
      </Field>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
