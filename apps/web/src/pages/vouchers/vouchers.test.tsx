import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/app/routes';
import type { AuthUser } from '@/api/types';
import { authBody, testUser } from '../../../test/fixtures';
import { jsonResponse, renderWithProviders } from '../../../test/test-utils';

const directorUser: AuthUser = {
  ...testUser,
  id: 'user-dir',
  email: 'dir@abc.test',
  fullName: 'Dana Director',
  employeeCode: null,
  department: null,
  role: 'DIRECTOR',
};

const voucherFixture = {
  id: 'v1',
  voucherNumber: 'EV-2026-000042',
  voucherDate: '2026-10-01',
  expenseDate: '2026-09-28',
  department: 'Field Operations',
  expenseTitle: 'Client site visit',
  category: 'Travel',
  description: null,
  amount: '1500.50',
  status: 'DRAFT',
  hasEmployeeSignature: false,
  hasDirectorSignature: false,
  approvedAt: null,
  rejectionReason: null,
  employee: {
    id: testUser.id,
    fullName: testUser.fullName,
    employeeCode: testUser.employeeCode,
    department: testUser.department,
  },
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

describe('voucher pages', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  function mockApi(
    options: {
      list?: unknown;
      detail?: unknown;
      created?: unknown;
      events?: unknown;
      submitted?: unknown;
      approved?: unknown;
      rejected?: unknown;
      user?: AuthUser;
    } = {},
  ) {
    fetchMock.mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      const method = init?.method ?? 'GET';
      if (href.includes('/auth/me')) {
        return jsonResponse(200, authBody(options.user ?? testUser));
      }
      if (href.includes('/vouchers/v1/submit') && method === 'POST') {
        return jsonResponse(200, {
          data: options.submitted ?? { ...voucherFixture, status: 'PENDING_APPROVAL' },
        });
      }
      if (href.includes('/vouchers/v1/approve') && method === 'POST') {
        return jsonResponse(200, {
          data: options.approved ?? {
            ...voucherFixture,
            status: 'APPROVED',
            approvedAt: '2026-10-01T12:00:00.000Z',
            hasDirectorSignature: true,
          },
        });
      }
      if (href.includes('/vouchers/v1/reject') && method === 'POST') {
        return jsonResponse(200, {
          data: options.rejected ?? {
            ...voucherFixture,
            status: 'REJECTED',
            rejectionReason: 'Needs original bills',
          },
        });
      }
      if (href.includes('/vouchers/v1/events')) {
        return jsonResponse(200, { data: options.events ?? [] });
      }
      if (href.includes('/vouchers/v1')) {
        return jsonResponse(200, { data: options.detail ?? voucherFixture });
      }
      if (href.endsWith('/vouchers') && method === 'POST') {
        return jsonResponse(201, { data: options.created ?? voucherFixture });
      }
      if (href.endsWith('/vouchers') && method === 'DELETE') {
        return new Response(null, { status: 204 }) as unknown as Response;
      }
      if (href.includes('/vouchers')) {
        return jsonResponse(200, {
          data: options.list ?? { items: [voucherFixture], total: 1 },
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });
  }

  it('lists vouchers with number, amount and status', async () => {
    mockApi();
    renderWithProviders(<AppRoutes />, { route: '/vouchers' });

    expect(await screen.findByRole('link', { name: 'EV-2026-000042' })).toHaveAttribute(
      'href',
      '/vouchers/v1',
    );
    expect(within(screen.getByRole('table')).getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('1,500.50')).toBeInTheDocument();
    expect(screen.getByText('1 voucher')).toBeInTheDocument();
  });

  it('shows the empty state when there are no vouchers', async () => {
    mockApi({ list: { items: [], total: 0 } });
    renderWithProviders(<AppRoutes />, { route: '/vouchers' });

    expect(await screen.findByText('No vouchers yet')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /New voucher/ }).length).toBeGreaterThan(0);
  });

  it('blocks creating a voucher until required fields are valid', async () => {
    mockApi();
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/vouchers/new' });

    const submit = await screen.findByRole('button', { name: 'Create draft' });
    await user.click(submit);

    expect((await screen.findAllByText('This date is required')).length).toBeGreaterThan(0);
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Amount is required')).toBeInTheDocument();
    const postCalls = fetchMock.mock.calls.filter(
      (call) =>
        (call[1] as RequestInit | undefined)?.method === 'POST' &&
        String(call[0]).endsWith('/vouchers'),
    );
    expect(postCalls).toHaveLength(0);
  });

  it('creates a draft and routes to its detail page', async () => {
    mockApi();
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/vouchers/new' });

    await screen.findByRole('button', { name: 'Create draft' });
    fireEvent.change(screen.getByLabelText('Voucher date'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Expense date'), { target: { value: '2026-09-28' } });
    fireEvent.change(screen.getByLabelText('Expense title'), {
      target: { value: 'Client site visit' },
    });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Travel' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1500.50' } });
    fireEvent.change(screen.getByLabelText('Department'), {
      target: { value: 'Field Operations' },
    });
    await user.click(screen.getByRole('button', { name: 'Create draft' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'EV-2026-000042' }),
    ).toBeInTheDocument();

    const postCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(String((postCall![1] as RequestInit).body));
    expect(body).toMatchObject({
      voucherDate: '2026-10-01',
      expenseDate: '2026-09-28',
      department: 'Field Operations',
      expenseTitle: 'Client site visit',
      category: 'Travel',
      amount: '1500.50',
      description: null,
    });
  });

  it('lets the owner delete a draft after confirmation', async () => {
    mockApi();
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/vouchers/v1' });

    await screen.findByRole('heading', { level: 1, name: 'EV-2026-000042' });
    expect(screen.getByRole('link', { name: /Edit/ })).toHaveAttribute('href', '/vouchers/v1/edit');

    await user.click(screen.getByRole('button', { name: /Delete/ }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'My Vouchers' }),
    ).toBeInTheDocument();
    const deleteCalls = fetchMock.mock.calls.filter(
      (call) => (call[1] as RequestInit | undefined)?.method === 'DELETE',
    );
    expect(deleteCalls).toHaveLength(1);
    expect(String(deleteCalls[0]?.[0])).toContain('/vouchers/v1');
  });

  it('disables submit until an employee signature exists', async () => {
    mockApi();
    renderWithProviders(<AppRoutes />, { route: '/vouchers/v1' });

    await screen.findByRole('heading', { level: 1, name: 'EV-2026-000042' });
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    expect(screen.getByText(/Upload your signature to enable submission/)).toBeInTheDocument();
  });

  it('lets the owner submit a signed draft after confirmation', async () => {
    const signedDraft = { ...voucherFixture, hasEmployeeSignature: true };
    const pending = { ...signedDraft, status: 'PENDING_APPROVAL' };
    mockApi({ detail: signedDraft, submitted: pending });
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/vouchers/v1' });

    await screen.findByRole('heading', { level: 1, name: 'EV-2026-000042' });
    await user.click(screen.getByRole('button', { name: /Submit/ }));
    await user.click(screen.getByRole('button', { name: 'Yes, submit' }));

    expect(await screen.findByText('Pending approval')).toBeInTheDocument();
    const submitCalls = fetchMock.mock.calls.filter(
      (call) =>
        (call[1] as RequestInit | undefined)?.method === 'POST' &&
        String(call[0]).includes('/submit'),
    );
    expect(submitCalls).toHaveLength(1);
    expect(String(submitCalls[0]?.[0])).toContain('/vouchers/v1/submit');
  });

  it('renders the activity timeline with actors', async () => {
    const events = [
      {
        id: 'e1',
        eventType: 'CREATED',
        fromStatus: null,
        toStatus: 'DRAFT',
        reason: null,
        actor: { fullName: testUser.fullName, employeeCode: testUser.employeeCode },
        createdAt: '2026-10-01T10:00:00.000Z',
      },
      {
        id: 'e2',
        eventType: 'SUBMITTED',
        fromStatus: 'DRAFT',
        toStatus: 'PENDING_APPROVAL',
        reason: null,
        actor: { fullName: testUser.fullName, employeeCode: testUser.employeeCode },
        createdAt: '2026-10-01T11:00:00.000Z',
      },
    ];
    mockApi({
      detail: { ...voucherFixture, status: 'PENDING_APPROVAL' },
      events,
    });
    renderWithProviders(<AppRoutes />, { route: '/vouchers/v1' });

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Draft created');
    expect(items[0]).toHaveTextContent('Ada Lovelace');
    expect(items[1]).toHaveTextContent('Submitted for approval');
  });

  it('shows approve/reject controls to the director on a pending voucher only', async () => {
    mockApi({
      user: directorUser,
      detail: { ...voucherFixture, status: 'PENDING_APPROVAL' },
    });
    const directorView = renderWithProviders(<AppRoutes />, { route: '/vouchers/v1' });

    await screen.findByRole('heading', { level: 1, name: 'EV-2026-000042' });
    expect(screen.getByRole('button', { name: 'Approve voucher' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reject voucher/ })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument();
    directorView.unmount();

    // Employees never see decision controls.
    mockApi();
    renderWithProviders(<AppRoutes />, { route: '/vouchers/v1' });
    await screen.findByRole('heading', { level: 1, name: 'EV-2026-000042' });
    expect(screen.queryByRole('button', { name: 'Approve voucher' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject voucher/ })).not.toBeInTheDocument();
  });

  it('lets the director reject with a typed reason', async () => {
    mockApi({
      user: directorUser,
      detail: { ...voucherFixture, status: 'PENDING_APPROVAL' },
    });
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/vouchers/v1' });

    await screen.findByRole('heading', { level: 1, name: 'EV-2026-000042' });
    await user.type(screen.getByLabelText(/Reject with reason/), 'Needs original bills');
    await user.click(screen.getByRole('button', { name: /Reject voucher/ }));
    await user.click(screen.getByRole('button', { name: 'Yes, reject' }));

    expect((await screen.findAllByText('Rejected')).length).toBeGreaterThan(0);
    const rejectCalls = fetchMock.mock.calls.filter(
      (call) =>
        (call[1] as RequestInit | undefined)?.method === 'POST' &&
        String(call[0]).includes('/reject'),
    );
    expect(rejectCalls).toHaveLength(1);
    const body = JSON.parse(String((rejectCalls[0]![1] as RequestInit).body));
    expect(body).toEqual({ reason: 'Needs original bills' });
  });

  it('submits an approved decision once a signature file is chosen', async () => {
    mockApi({
      user: directorUser,
      detail: { ...voucherFixture, status: 'PENDING_APPROVAL' },
    });
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/vouchers/v1' });

    await screen.findByRole('heading', { level: 1, name: 'EV-2026-000042' });
    const fileInput = screen.getByLabelText('Director signature image file');
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'sign.png', {
      type: 'image/png',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const approveButton = screen.getByRole('button', { name: 'Approve voucher' });
    expect(approveButton).toBeEnabled();
    await user.click(approveButton);
    await user.click(screen.getByRole('button', { name: 'Yes, approve' }));

    expect(await screen.findByText('Approved')).toBeInTheDocument();
    const approveCalls = fetchMock.mock.calls.filter(
      (call) =>
        (call[1] as RequestInit | undefined)?.method === 'POST' &&
        String(call[0]).includes('/approve'),
    );
    expect(approveCalls).toHaveLength(1);
  });

  it('lists pending vouchers on the director approvals queue', async () => {
    const pending = {
      ...voucherFixture,
      status: 'PENDING_APPROVAL',
      employee: { ...voucherFixture.employee, fullName: 'Grace Employee' },
    };
    mockApi({ user: directorUser, list: { items: [pending], total: 1 } });
    renderWithProviders(<AppRoutes />, { route: '/approvals' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pending Approvals' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'EV-2026-000042' })).toHaveAttribute(
      'href',
      '/vouchers/v1',
    );
    expect(screen.getByText('Grace Employee')).toBeInTheDocument();
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
  });
});
