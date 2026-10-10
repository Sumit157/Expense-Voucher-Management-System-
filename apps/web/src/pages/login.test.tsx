import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/app/routes';
import { authBody, testUser } from '../../test/fixtures';
import { jsonResponse, renderWithProviders } from '../../test/test-utils';

describe('login page', () => {
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
      if (href.includes('/auth/login')) {
        return jsonResponse(401, {
          error: { code: 'UNAUTHENTICATED', message: 'Invalid email or password' },
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });
  }

  function loginCalls(): unknown[] {
    return fetchMock.mock.calls.filter((call) => String(call[0]).includes('/auth/login'));
  }

  it('blocks submission until required fields are valid', async () => {
    mockAuth();
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/login' });

    await screen.findByRole('button', { name: 'Sign in' });
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(loginCalls()).toHaveLength(0);
  });

  it('shows the generic server message for invalid credentials', async () => {
    mockAuth();
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/login' });

    await screen.findByRole('button', { name: 'Sign in' });
    await user.type(screen.getByLabelText('Email'), 'ada@abc.test');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(loginCalls()).toHaveLength(1);
  });

  it('signs in and routes to the dashboard', async () => {
    let meCalls = 0;
    fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes('/auth/me')) {
        meCalls += 1;
        return meCalls > 1
          ? jsonResponse(200, authBody(testUser))
          : jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' } });
      }
      if (href.includes('/auth/login')) {
        return jsonResponse(200, authBody(testUser));
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/login' });

    await screen.findByRole('button', { name: 'Sign in' });
    await user.type(screen.getByLabelText('Email'), 'ada@abc.test');
    await user.type(screen.getByLabelText('Password'), 'SeedDevPassword123!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your dashboard, Ada' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
  });
});
