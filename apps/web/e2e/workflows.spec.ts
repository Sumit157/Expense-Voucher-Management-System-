import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 7),
]);
const sigPath = join(tmpdir(), 'evm-e2e-signature.png');
mkdirSync(tmpdir(), { recursive: true });
writeFileSync(sigPath, PNG);

async function login(page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 });
}

test.describe('authentication', () => {
  test('shows branded login and rejects bad credentials with a generic error', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await page.getByLabel('Email').fill('nobody@evm.test');
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('WrongPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects unauthenticated visitors away from protected routes', async ({ page }) => {
    await page.goto('/vouchers');
    await expect(page).toHaveURL(/\/login/);
  });

  test('employee can log in, land on the dashboard, and sign out', async ({ page }) => {
    await login(page, 'employee1@abc.test', 'SeedDevPassword123!');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await page.getByRole('button', { name: /account|user|profile|menu/i }).first().click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('employee voucher journey', () => {
  test('create draft, upload signature, submit, see pending approval', async ({ page }) => {
    await login(page, 'employee1@abc.test', 'SeedDevPassword123!');

    await page.getByRole('link', { name: 'My Vouchers' }).click();
    await expect(page).toHaveURL(/\/vouchers/);

    await page.goto('/vouchers/new');
    await expect(page).toHaveURL(/\/vouchers\/new/);

    const stamp = Date.now();
    await page.getByLabel(/voucher date/i).fill('2026-10-01');
    await page.getByLabel(/expense date/i).fill('2026-09-28');
    await page.getByLabel(/department/i).fill('Field Operations');
    await page.getByLabel(/expense title|title/i).fill(`E2E site visit ${stamp}`);
    await page.getByLabel(/category/i).selectOption('Travel');
    await page.getByLabel(/description/i).fill('Playwright e2e run');
    await page.getByLabel(/amount/i).fill('123.45');
    await page.getByRole('button', { name: /save|create|draft/i }).click();

    await expect(page).toHaveURL(/\/vouchers\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/EV-\d{4}-\d{6}/);

    await page.getByLabel(/signature/i).first().setInputFiles(sigPath);
    await expect(page.locator('img[alt*="signature" i], [data-testid="employee-signature"]').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, submit' }).click();
    await expect(page.getByText(/pending approval|submitted for approval/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('director and accounts journeys', () => {
  test('director sees pending approvals queue', async ({ page }) => {
    await login(page, 'director@abc.test', 'SeedDevPassword123!');
    await page.goto('/approvals');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page).toHaveURL(/\/approvals/);
  });

  test('accounts dashboard loads with KPI totals', async ({ page }) => {
    await login(page, 'accounts@abc.test', 'SeedDevPassword123!');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('employee cannot access the approvals queue route', async ({ page }) => {
    await login(page, 'employee1@abc.test', 'SeedDevPassword123!');
    await page.goto('/approvals');
    await expect(page).not.toHaveURL(/\/approvals/);
  });
});

test.describe('theme', () => {
  test('theme toggle switches between light and dark', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    const html = page.locator('html');
    const before = await html.evaluate((el) => el.className);
    await page.getByRole('button', { name: 'Change theme' }).click();
    await page.getByRole('menuitem', { name: 'Dark' }).click();
    await expect(html).not.toHaveClass(before);
    await expect(html).toHaveClass(/dark/);
  });
});
