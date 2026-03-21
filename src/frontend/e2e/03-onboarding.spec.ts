import { test, expect } from '@playwright/test';
import { waitForAppShell } from './helpers/pages';

const EDITOR = {
  name: 'E2E Editor',
  email: 'editor@e2e.test',
  password: 'E2ETestPassword123!',
};

test.describe('Second User Registration & Onboarding', () => {
  test('register second user — not super admin, gets Getting Started content', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Fill registration form
    await page.getByLabel('Name').fill(EDITOR.name);
    await page.getByLabel('Email').fill(EDITOR.email);
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(EDITOR.password);
    await passwordInputs.nth(1).fill(EDITOR.password);

    // Submit
    await page.getByRole('button', { name: /create account/i }).click();

    // Should redirect to dashboard (not setup wizard — only super admins see it)
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Verify NOT super admin — no Super Admin link in sidebar
    await expect(page.getByRole('link', { name: 'Super Admin', exact: true })).not.toBeVisible();

    // Verify Getting Started folder from OnboardingSeeder
    await expect(page.getByText('Getting Started')).toBeVisible({ timeout: 5_000 });

    // Save auth state for future specs
    await page.context().storageState({ path: 'e2e/.auth/editor.json' });
  });
});
