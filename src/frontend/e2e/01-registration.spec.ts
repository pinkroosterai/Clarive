import { test, expect } from '@playwright/test';
import { waitForAppShell } from './helpers/pages';

const ADMIN = {
  name: 'E2E Admin',
  email: 'admin@e2e.test',
  password: 'E2ETestPassword123!',
};

test.describe('First User Registration', () => {
  test('register first user — auto-promoted to super admin', async ({ page }) => {
    // On empty database, app shows the SetupPage (not RegisterPage)
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify setup page is shown
    await expect(page.getByText('Set Up Your Instance')).toBeVisible({ timeout: 10_000 });

    // Fill registration form
    await page.getByLabel('Name').fill(ADMIN.name);
    await page.getByLabel('Email').fill(ADMIN.email);
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(ADMIN.password);
    await passwordInputs.nth(1).fill(ADMIN.password);

    // Submit
    await page.getByRole('button', { name: /create admin account/i }).click();

    // Should redirect to app (then to setup wizard since first user is super admin)
    await page.waitForURL(/\/(setup-wizard)?$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Verify super admin status — sidebar shows "Super Admin" link
    await expect(page.getByRole('link', { name: 'Super Admin', exact: true })).toBeVisible({ timeout: 5_000 });

    // Verify Getting Started folder from OnboardingSeeder
    await expect(page.getByText('Getting Started')).toBeVisible({ timeout: 5_000 });

    // Save auth state for subsequent specs
    await page.context().storageState({ path: 'e2e/.auth/admin.json' });
  });
});
