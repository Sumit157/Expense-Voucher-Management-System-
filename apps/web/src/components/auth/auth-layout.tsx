import type { ReactNode } from 'react';
import { ZapIcon, ShieldCheckIcon, CircleCheckIcon } from 'lucide-react';
import { AuthIllustration } from './auth-illustration';
import { ThemeToggle } from '@/components/theme/theme-toggle';

/** Feature rows shown on the branding panel of every auth page. */
const FEATURES = [
  { icon: ZapIcon, label: 'Fast & Easy Submission' },
  { icon: CircleCheckIcon, label: 'Transparent Approval Process' },
  { icon: ShieldCheckIcon, label: 'Secure & Reliable' },
] as const;

function BrandHeader() {
  return (
    <div className="flex items-center gap-3">
      <img src="/logo-mark.svg" alt="" aria-hidden className="size-10 shrink-0" />
      <span className="text-lg font-bold tracking-tight text-[#102C27] dark:text-[#E7EDE9]">
        Expense Vouchers
      </span>
    </div>
  );
}

function FeatureList() {
  return (
    <ul className="flex flex-col gap-3">
      {FEATURES.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary"
          >
            <Icon className="size-4" />
          </span>
          <span className="text-sm font-medium text-foreground/85">{label}</span>
        </li>
      ))}
    </ul>
  );
}

export interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Two-column authentication shell: branding + illustration on the left,
 * the page's card on the right. Collapses to a single column on mobile.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col p-4 md:p-6 lg:p-8">
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-[#F5F3EA] shadow-[0_1px_2px_rgba(16,44,39,0.04),0_12px_40px_-16px_rgba(16,44,39,0.18)] lg:grid lg:grid-cols-[1fr_minmax(400px,44%)] lg:items-stretch dark:bg-[#0E1613] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_12px_40px_-16px_rgba(0,0,0,0.6)]">
        {/* Branding panel */}
        <div className="relative flex flex-col gap-8 px-6 pt-6 pb-8 md:px-10 md:pt-8 lg:px-12 lg:pt-10 lg:pb-12">
          <BrandHeader />

          <div className="flex flex-1 items-center">
            <div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="flex max-w-md flex-col gap-6">
                <h1 className="text-3xl font-bold tracking-tight text-balance text-[#102C27] md:text-4xl lg:leading-[1.12] dark:text-[#E7EDE9]">
                  Simplify Expense Management
                </h1>
                <p className="max-w-sm text-sm leading-relaxed text-[#64736D] md:text-base dark:text-[#8FA39A]">
                  Create, track and manage expense vouchers with ease. A simple and secure
                  platform for your organization.
                </p>
                <FeatureList />
              </div>

              <div
                aria-hidden
                className="pointer-events-none hidden justify-center overflow-hidden lg:flex"
              >
                <AuthIllustration className="h-auto w-full max-w-[420px] text-[#19A974] dark:text-[#2FA87E]" />
              </div>
            </div>
          </div>
        </div>

        {/* Card panel */}
        <div className="relative flex flex-col border-t border-border/60 bg-background px-6 py-8 md:px-10 lg:border-t-0 lg:border-l lg:px-12 lg:py-10 dark:border-border/40">
          <div className="absolute top-4 right-4 md:top-5 md:right-6">
            <ThemeToggle />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-sm">{children}</div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
