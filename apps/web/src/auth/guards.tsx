import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullScreenError, FullScreenLoading } from '@/components/shared/full-screen';
import { useSession } from '@/auth/use-auth';

/** Access gate: requires a live server session (server enforces independently). */
export function RequireAuth() {
  const location = useLocation();
  const session = useSession();

  if (session.isPending) {
    return <FullScreenLoading />;
  }
  if (session.isError) {
    return <FullScreenError onRetry={() => void session.refetch()} />;
  }
  if (session.data === null) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return <Outlet />;
}

/** Guest gate: signed-in users skip the login page. */
export function GuestOnly() {
  const location = useLocation();
  const session = useSession();
  const from = (location.state as { from?: string } | null)?.from;

  if (session.isPending) {
    return <FullScreenLoading />;
  }
  if (session.data !== null) {
    return <Navigate to={from ?? '/dashboard'} replace />;
  }
  return <Outlet />;
}
