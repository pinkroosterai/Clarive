import { test, expect } from '@playwright/test';
import { USERS } from './helpers/seed-data';
import { loginViaUI, waitForAuthRedirect } from './helpers/pages';

test.describe('Authentication — Login & Logout', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // no pre-auth

  test('login with valid admin credentials redirects to /library @smoke', async ({ page }) => {
    await loginViaUI(page, USERS.admin.email, USERS.admin.password);
    await waitForAuthRedirect(page);
    await expect(page).toHaveURL(/\/library/);
  });

  test('login with invalid password shows error toast @smoke', async ({ page }) => {
    await loginViaUI(page, USERS.admin.email, 'wrong-password');
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 5_000 });
    await expect(toast).toContainText(/invalid|incorrect|unauthorized/i);
    // Should remain on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('login with non-existent email shows error toast', async ({ page }) => {
    await loginViaUI(page, 'nobody@example.com', 'password');
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 5_000 });
    await expect(toast).toContainText(/incorrect|invalid|not found/i);
  });

  test('protected route redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/library');
    await expect(page).toHaveURL(/\/login/);
  });

  test('protected route /settings redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login persists across page reload', async ({ page }) => {
    await loginViaUI(page, USERS.admin.email, USERS.admin.password);
    await waitForAuthRedirect(page);
    await expect(page).toHaveURL(/\/library/);

    // Reload the page — should stay authenticated
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/(library|dashboard)/);
  });

  test('login page redirects to /library if already authenticated', async ({ page }) => {
    // First, log in
    await loginViaUI(page, USERS.admin.email, USERS.admin.password);
    await waitForAuthRedirect(page);

    // Now navigate back to /login — should redirect
    await page.goto('/login');
    await expect(page).toHaveURL(/\/library/);
  });

  test('logout clears session and redirects to /login', async ({ page }) => {
    // Log in first
    await loginViaUI(page, USERS.admin.email, USERS.admin.password);
    await waitForAuthRedirect(page);
    await expect(page).toHaveURL(/\/library/);

    // Open user dropdown and click Logout
    await page.getByRole('button', { name: /admin user/i }).click();
    await page.getByRole('menuitem', { name: /logout/i }).click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Verify protected route is no longer accessible
    await page.goto('/library');
    await expect(page).toHaveURL(/\/login/);
  });
});
