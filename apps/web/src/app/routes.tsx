import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestOnly, RequireAuth } from '@/auth/guards';
import { AppShellLayout } from '@/components/shell/app-shell';
import { ApprovalsQueuePage } from '@/pages/approvals';
import { DashboardPage } from '@/pages/dashboard';
import { LoginPage } from '@/pages/login';
import { NotFoundPage } from '@/pages/not-found';
import { VoucherCreatePage } from '@/pages/vouchers/create';
import { VoucherDetailPage } from '@/pages/vouchers/detail';
import { VoucherEditPage } from '@/pages/vouchers/edit';
import { VoucherListPage } from '@/pages/vouchers/list';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppShellLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/vouchers" element={<VoucherListPage />} />
          <Route path="/vouchers/new" element={<VoucherCreatePage />} />
          <Route path="/vouchers/:id" element={<VoucherDetailPage />} />
          <Route path="/vouchers/:id/edit" element={<VoucherEditPage />} />
          <Route path="/approvals" element={<ApprovalsQueuePage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
