import { useState } from 'react';
import { EyeIcon, EyeOffIcon, LockIcon } from 'lucide-react';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';

export interface PasswordInputProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'size'> {
  /** Renders a leading lock affordance to match the auth card design. */
  showLeadingIcon?: boolean;
}

/** Password field with an accessible show/hide toggle. */
export function PasswordInput({
  className,
  showLeadingIcon = true,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      {showLeadingIcon ? (
        <LockIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      ) : null}
      <Input
        type={visible ? 'text' : 'password'}
        className={cn(
          showLeadingIcon ? 'pl-9' : null,
          'pr-9',
          'h-10 bg-secondary/30 dark:bg-input/30',
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {visible ? (
          <EyeOffIcon className="size-4" aria-hidden />
        ) : (
          <EyeIcon className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
