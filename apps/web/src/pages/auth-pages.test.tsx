import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/app/routes';
import { authBody, testUser } from '../../test/fixtures';
import { jsonResponse, renderWithProviders } from '../../test/test-utils';

describe('signup page', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  function mockAuth({ loggedIn = false }: { loggedIn?: boolean } = {}) {
    let meCalls = 0;
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes('/auth/me')) {
        meCalls += 1;
        if (loggedIn || meCalls > 1) {
          return jsonResponse(200, authBody(testUser));
        }
        return jsonResponse(401, {
          error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' },
        });
      }
      if (href.includes('/auth/register')) {
        return jsonResponse(201, authBody(testUser));
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });
  }

  function registerCalls(): unknown[] {
    return fetchMock.mock.calls.filter((call) => String(call[0]).includes('/auth/register'));
  }

  it('validates required fields before submitting', async () => {
    mockAuth();
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/signup' });

    await screen.findByRole('button', { name: 'Create account' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Full name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(registerCalls()).toHaveLength(0);
  });

  it('rejects a short password with a clear message', async () => {
    mockAuth();
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/signup' });

    await screen.findByRole('button', { name: 'Create account' });
    await user.type(screen.getByLabelText('Full name'), 'Grace Hopper');
    await user.type(screen.getByLabelText('Email'), 'grace@abc.test');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('Password must be at least 8 characters'),
    ).toBeInTheDocument();
    expect(registerCalls()).toHaveLength(0);
  });

  it('registers and routes to the dashboard', async () => {
    mockAuth();
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/signup' });

    await screen.findByRole('button', { name: 'Create account' });
    await user.type(screen.getByLabelText('Full name'), 'Grace Hopper');
    await user.type(screen.getByLabelText('Email'), 'grace@abc.test');
    await user.type(screen.getByLabelText('Password'), 'StrongPass123!');
    await user.type(screen.getByLabelText(/department/i), 'Research');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your dashboard, Ada' }),
    ).toBeInTheDocument();

    const calls = registerCalls();
    expect(calls).toHaveLength(1);
    const body = JSON.parse(String((calls[0] as [unknown, { body: string }])[1]?.body));
    expect(body.role).toBeUndefined();
    expect(body.fullName).toBe('Grace Hopper');
    expect(body.department).toBe('Research');
  });

  it('shows the server message for a duplicate email', async () => {
    mockAuth();
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes('/auth/me')) {
        return jsonResponse(401, {
          error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' },
        });
      }
      if (href.includes('/auth/register')) {
        return jsonResponse(409, {
          error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists' },
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/signup' });

    await screen.findByRole('button', { name: 'Create account' });
    await user.type(screen.getByLabelText('Full name'), 'Ada Again');
    await user.type(screen.getByLabelText('Email'), 'ada@abc.test');
    await user.type(screen.getByLabelText('Password'), 'StrongPass123!');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('An account with this email already exists');
  });

  it('links back to login', async () => {
    mockAuth();
    renderWithProviders(<AppRoutes />, { route: '/signup' });

    await screen.findByRole('button', { name: 'Create account' });
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});

describe('forgot-password page', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  function mockGuest() {
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes('/auth/me')) {
        return jsonResponse(401, {
          error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' },
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });
  }

  function forgotCalls(): unknown[] {
    return fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/auth/forgot-password'),
    );
  }

  it('validates the email before submitting', async () => {
    mockGuest();
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/forgot-password' });

    await screen.findByRole('button', { name: 'Send reset link' });
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(forgotCalls()).toHaveLength(0);
  });

  it('shows the generic success message after sending', async () => {
    mockGuest();
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes('/auth/me')) {
        return jsonResponse(401, {
          error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' },
        });
      }
      if (href.includes('/auth/forgot-password')) {
        return jsonResponse(202, {
          data: {
            message:
              'If an account exists for that email, a password reset link has been sent.',
          },
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/forgot-password' });

    await screen.findByRole('button', { name: 'Send reset link' });
    await user.type(screen.getByLabelText('Email'), 'ada@abc.test');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/if an account exists/i);
    expect(screen.getByRole('link', { name: /back to sign in/i })).toBeInTheDocument();
  });

  it('surfaces a dev reset link when the API returns one', async () => {
    mockGuest();
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes('/auth/me')) {
        return jsonResponse(401, {
          error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' },
        });
      }
      if (href.includes('/auth/forgot-password')) {
        return jsonResponse(202, {
          data: { message: 'If an account exists for that email.', devResetToken: 'tok-123' },
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/forgot-password' });

    await screen.findByRole('button', { name: 'Send reset link' });
    await user.type(screen.getByLabelText('Email'), 'ada@abc.test');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    const devLink = await screen.findByRole('link', { name: /reset password/i });
    expect(devLink).toHaveAttribute('href', '/reset-password?token=tok-123');
  });

  it('links back to login', async () => {
    mockGuest();
    renderWithProviders(<AppRoutes />, { route: '/forgot-password' });

    await screen.findByRole('button', { name: 'Send reset link' });
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});

describe('reset-password page', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  function mockGuest() {
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes('/auth/me')) {
        return jsonResponse(401, {
          error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' },
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });
  }

  it('shows an invalid-link state when the token is missing', async () => {
    mockGuest();
    renderWithProviders(<AppRoutes />, { route: '/reset-password' });

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(/missing its token/i);
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('requires matching passwords', async () => {
    mockGuest();
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, {
      route: '/reset-password?token=valid-token',
    });

    await screen.findByRole('button', { name: 'Update password' });
    await user.type(screen.getByLabelText('New password'), 'NewPass123!');
    await user.type(screen.getByLabelText('Confirm password'), 'Different123!');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    const resetCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/auth/reset-password'),
    );
    expect(resetCalls).toHaveLength(0);
  });

  it('submits the token and new password, then offers sign in', async () => {
    mockGuest();
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes('/auth/me')) {
        return jsonResponse(401, {
          error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' },
        });
      }
      if (href.includes('/auth/reset-password')) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, {
      route: '/reset-password?token=valid-token',
    });

    await screen.findByRole('button', { name: 'Update password' });
    await user.type(screen.getByLabelText('New password'), 'NewPass123!');
    await user.type(screen.getByLabelText('Confirm password'), 'NewPass123!');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/password has been updated/i);
    expect(screen.getByRole('link', { name: /go to sign in/i })).toBeInTheDocument();

    const resetCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/auth/reset-password'),
    );
    expect(resetCalls).toHaveLength(1);
    const body = JSON.parse(String((resetCalls[0] as [unknown, { body: string }])[1]?.body));
    expect(body).toEqual({ token: 'valid-token', newPassword: 'NewPass123!' });
  });

  it('shows the expired-link state for a rejected token', async () => {
    mockGuest();
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes('/auth/me')) {
        return jsonResponse(401, {
          error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' },
        });
      }
      if (href.includes('/auth/reset-password')) {
        return jsonResponse(400, {
          error: {
            code: 'RESET_TOKEN_INVALID',
            message: 'This reset link is invalid or has expired. Request a new one.',
          },
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, {
      route: '/reset-password?token=expired-token',
    });

    await screen.findByRole('button', { name: 'Update password' });
    await user.type(screen.getByLabelText('New password'), 'NewPass123!');
    await user.type(screen.getByLabelText('Confirm password'), 'NewPass123!');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid or has expired/i);
    expect(screen.getByRole('link', { name: /request a new link/i })).toBeInTheDocument();
  });
});
