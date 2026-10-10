import { MenuIcon } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import type { AuthUser } from '@/api/types';
import { useSession } from '@/auth/use-auth';
import { FullScreenLoading } from '@/components/shared/full-screen';
import { navForRole, type NavItem } from '@/components/shell/nav';
import { UserMenu } from '@/components/shell/user-menu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
      >
        EV
      </span>
      <span className="text-sm font-semibold tracking-tight text-foreground">Expense Vouchers</span>
    </span>
  );
}

function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        )
      }
    >
      <item.icon className="size-4" aria-hidden />
      {item.label}
    </NavLink>
  );
}

export function AppShellLayout() {
  const session = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const user = session.data as AuthUser | null;

  if (!user) {
    return <FullScreenLoading />;
  }

  const items = navForRole(user.role);

  return (
    <div className="flex min-h-dvh w-full bg-background">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Brand />
        </div>
        <nav aria-label="Main navigation" className="flex-1 space-y-1 p-3">
          {items.map((item) => (
            <NavItemLink key={item.to} item={item} />
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation menu"
              >
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="border-b p-4">
                <SheetTitle className="text-left">
                  <Brand />
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="Main navigation" className="space-y-1 p-3">
                {items.map((item) => (
                  <NavItemLink
                    key={item.to}
                    item={item}
                    onNavigate={() => setMobileNavOpen(false)}
                  />
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <span className="lg:hidden">
            <Brand />
          </span>

          <span className="ml-auto">
            <UserMenu user={user} />
          </span>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
