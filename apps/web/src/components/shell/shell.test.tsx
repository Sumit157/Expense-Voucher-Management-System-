import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/app/routes';
import { authBody, testUser } from '../../../test/fixtures';
import { jsonResponse, renderWithProviders } from '../../../test/test-utils';

describe('sign out', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('ends the session and returns to the login page', async () => {
    fetchMock.mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.includes('/auth/me')) {
        return jsonResponse(200, authBody(testUser));
      }
      if (href.includes('/auth/logout')) {
        expect(init?.method).toBe('POST');
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/dashboard' });

    await screen.findByRole('heading', { level: 1, name: 'Your dashboard, Ada' });

    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.click(await screen.findByRole('menuitem', { name: /sign out/i }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/auth/logout'))).toBe(
      true,
    );
  });
});
