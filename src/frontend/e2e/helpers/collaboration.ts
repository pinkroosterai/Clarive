import { Browser, BrowserContext, Page, expect } from '@playwright/test';
import { loginViaUI, waitForAppShell, expectToast } from './pages';
import { radixClick } from './radix';
import { ENTRY_TITLE_INPUT, TOUR_CLOSE_BTN } from './locators';

/**
 * Open an entry as a specific user in a new browser context.
 * Handles login, onboarding completion, tour dismissal, and navigation.
 */
export async function openEntryAs(
  browser: Browser,
  user: { email: string; password: string },
  entryUrl: string
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginViaUI(page, user.email, user.password);
  await page.waitForURL(/\/$/, { timeout: 15_000 });

  // Complete onboarding via API to prevent the tour from blocking interactions
  await page.evaluate(() =>
    fetch('/api/profile/complete-onboarding', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('cl_token')}` },
    })
  );

  await waitForAppShell(page);

  // Dismiss onboarding tour if it appeared before the API call completed
  const tourClose = page.locator(TOUR_CLOSE_BTN);
  if (await tourClose.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await tourClose.click();
    await page.waitForTimeout(500); // Tour close animation settle
  }

  // Navigate to the entry
  await page.goto(entryUrl);
  await page.waitForLoadState('networkidle');
  await expect(page.locator(ENTRY_TITLE_INPUT)).toBeVisible({ timeout: 10_000 });

  return { context, page };
}

/**
 * Override soft edit lock if present.
 * Checks for "Edit anyway" button, clicks it, and confirms the alert dialog.
 */
export async function overrideSoftLock(page: Page): Promise<void> {
  const editAnywayBtn = page.getByRole('button', { name: /edit anyway/i });
  if (await editAnywayBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await radixClick(editAnywayBtn);
    const alertDialog = page.getByRole('alertdialog');
    await alertDialog.waitFor({ state: 'visible' });
    await radixClick(alertDialog.getByRole('button', { name: /edit anyway/i }));
    await page.waitForTimeout(500); // AlertDialog close animation + soft lock release
  }
}

/**
 * Resolve a conflict after a concurrent save.
 *
 * @param strategy - 'mine' keeps your changes (default), 'theirs' accepts server version
 */
export async function resolveConflict(
  page: Page,
  strategy: 'mine' | 'theirs' = 'mine'
): Promise<void> {
  await expect(page.getByText('Resolve conflict')).toBeVisible({ timeout: 10_000 });

  if (strategy === 'theirs') {
    // Click "Keep theirs" on all conflicting fields
    const keepTheirsButtons = page.getByRole('button', { name: /keep theirs/i });
    const count = await keepTheirsButtons.count();
    for (let i = 0; i < count; i++) {
      await keepTheirsButtons.nth(i).click();
    }
  }

  await page.getByRole('button', { name: /save resolved/i }).click();
  await expectToast(page, 'Conflict resolved');
}
