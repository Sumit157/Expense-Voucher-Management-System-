import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/app/routes';
import { authBody, testUser } from '../../test/fixtures';
import { jsonResponse, renderWithProviders } from '../../test/test-utils';

describe('route guards', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('redirects anonymous visitors from a protected route to the login page', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Unauthenticated' } }),
    );

    renderWithProviders(<AppRoutes />, { route: '/dashboard' });

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('renders the authenticated dashboard with role-aware shell', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, authBody(testUser)));

    renderWithProviders(<AppRoutes />, { route: '/dashboard' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your dashboard, Ada' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Dashboard' })).not.toHaveLength(0);
    expect(screen.getByText(/Employee · Engineering/)).toBeInTheDocument();
  });

  it('renders the 404 page for unknown routes', async () => {
    renderWithProviders(<AppRoutes />, { route: '/does-not-exist' });

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
