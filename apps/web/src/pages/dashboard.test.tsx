import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/app/routes';
import type { AccountsDashboard, AuthUser, Voucher } from '@/api/types';
import { authBody, testUser } from '../../test/fixtures';
import { jsonResponse, renderWithProviders } from '../../test/test-utils';

const accountsUser: AuthUser = {
  ...testUser,
  id: 'user-acc',
  email: 'acc@abc.test',
  fullName: 'Avery Accounts',
  employeeCode: null,
  department: 'Finance',
  role: 'ACCOUNTS',
};

const approvedVoucher: Voucher = {
  id: 'v9',
  voucherNumber: 'EV-2026-000009',
  voucherDate: '2026-10-01',
  expenseDate: '2026-09-28',
  department: 'Field Operations',
  expenseTitle: 'Client site visit',
  category: 'Travel',
  description: null,
  amount: '1500.50',
  status: 'APPROVED',
  hasEmployeeSignature: true,
  hasDirectorSignature: true,
  approvedAt: '2026-10-05T10:00:00.000Z',
  rejectionReason: null,
  employee: {
    id: 'user-1',
    fullName: 'Ada Lovelace',
    employeeCode: 'E-001',
    department: 'Engineering',
  },
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-05T10:00:00.000Z',
};

const summary: AccountsDashboard = {
  total: 7,
  pendingApproval: 2,
  approved: 2,
  rejected: 1,
  totalApprovedAmount: '3500.50',
  recentApproved: [approvedVoucher],
};

describe('accounts dashboard', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  function mockDashboard(overrides: Partial<AccountsDashboard> = {}) {
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes('/auth/me')) {
        return jsonResponse(200, authBody(accountsUser));
      }
      if (href.includes('/dashboard/accounts')) {
        return jsonResponse(200, { data: { ...summary, ...overrides } });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });
  }

  it('shows reconciled KPI totals and the recent approved list', async () => {
    mockDashboard();
    renderWithProviders(<AppRoutes />, { route: '/dashboard' });

    expect(await screen.findByText('Accounts dashboard, Avery')).toBeInTheDocument();

    expect(await screen.findByText('Total vouchers')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
    expect(screen.getAllByText('2')).toHaveLength(2);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('3,500.50')).toBeInTheDocument();

    expect(await screen.findByRole('link', { name: 'EV-2026-000009' })).toHaveAttribute(
      'href',
      '/vouchers/v9',
    );
    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
  });

  it('shows an empty recent list when nothing is approved yet', async () => {
    mockDashboard({ approved: 0, totalApprovedAmount: '0.00', recentApproved: [] });
    renderWithProviders(<AppRoutes />, { route: '/dashboard' });

    expect(await screen.findByText('No approved vouchers yet.')).toBeInTheDocument();
    expect(screen.getByText('0.00')).toBeInTheDocument();
  });

  it('surfaces a retryable error state when the summary fails to load', async () => {
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes('/auth/me')) {
        return jsonResponse(200, authBody(accountsUser));
      }
      if (href.includes('/dashboard/accounts')) {
        return jsonResponse(500, {
          error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });
    renderWithProviders(<AppRoutes />, { route: '/dashboard' });

    expect(await screen.findByText('Could not load the dashboard summary.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
