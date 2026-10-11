import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/app/routes';
import { authBody, testUser } from '../../../test/fixtures';
import { jsonResponse, renderWithProviders } from '../../../test/test-utils';

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
    } = {},
  ) {
    fetchMock.mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      const method = init?.method ?? 'GET';
      if (href.includes('/auth/me')) {
        return jsonResponse(200, authBody(testUser));
      }
      if (href.includes('/vouchers/v1/submit') && method === 'POST') {
        return jsonResponse(200, {
          data: options.submitted ?? { ...voucherFixture, status: 'PENDING_APPROVAL' },
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
      if (href.endsWith('/vouchers')) {
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
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('1,500.50')).toBeInTheDocument();
    expect(screen.getByText('1 voucher in total')).toBeInTheDocument();
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
});
