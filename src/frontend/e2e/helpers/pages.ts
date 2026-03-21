import { Page, expect } from '@playwright/test';

/**
 * Lightweight locator helpers — not full page objects, just repeated patterns.
 */

/** Wait for the app shell to be fully loaded (sidebar visible). */
export async function waitForAppShell(page: Page): Promise<void> {
  await expect(page.locator("[data-sidebar='sidebar']").first()).toBeVisible({
    timeout: 10_000,
  });
}

/** Assert a toast with matching text appears. */
export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  const toast = page.locator('[data-sonner-toast]').first();
  await toast.waitFor({ state: 'visible', timeout: 5_000 });
  if (typeof text === 'string') {
    await expect(toast).toContainText(text);
  } else {
    await expect(toast).toHaveText(text);
  }
}

/** Fill in the login form and submit. */
export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
}

/** Wait for navigation to complete after login. */
export async function waitForAuthRedirect(page: Page): Promise<void> {
  // Dashboard is at '/', library at '/library', setup wizard at '/setup-wizard'
  await page.waitForURL(/\/(library|setup-wizard)?$/, { timeout: 15_000 });
}
