import { Page, expect } from '@playwright/test';
import { TOUR_CLOSE_BTN } from './locators';

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

/**
 * Navigate to an entry by clicking its title on the dashboard.
 * Assumes the page is already logged in and on the dashboard.
 * Waits for the editor to load (Prompt #1 visible).
 */
export async function navigateToEntry(page: Page, entryTitle: string): Promise<void> {
  await page.getByText(entryTitle).first().click();
  await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });
  await expect(page.getByText('Prompt #1')).toBeVisible({ timeout: 5_000 });
}

/**
 * Login and navigate to an entry by clicking its title on the dashboard.
 * Waits for the editor to load (Prompt #1 visible).
 */
export async function loginAndNavigateToEntry(
  page: Page,
  user: { email: string; password: string },
  entryTitle: string
): Promise<void> {
  await loginViaUI(page, user.email, user.password);
  await page.waitForURL(/\/$/, { timeout: 15_000 });
  await waitForAppShell(page);
  await navigateToEntry(page, entryTitle);
}

/**
 * Complete onboarding via API call to prevent the tour from appearing.
 * Uses the auth token from localStorage.
 */
export async function completeOnboarding(page: Page): Promise<void> {
  await page.evaluate(() =>
    fetch('/api/profile/complete-onboarding', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('cl_token')}` },
    })
  );
}

/**
 * Dismiss the onboarding tour popover if it is visible.
 */
export async function dismissTour(page: Page): Promise<void> {
  const tourClose = page.locator(TOUR_CLOSE_BTN);
  if (await tourClose.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await tourClose.click();
    await page.waitForTimeout(500); // Tour close animation settle
  }
}
