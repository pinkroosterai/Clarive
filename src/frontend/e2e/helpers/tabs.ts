import { Page, expect } from '@playwright/test';
import { expectToast } from './pages';
import { COMBOBOX_TRIGGER } from './locators';

/**
 * Create a new tab forked from a version. Skips if the tab already exists.
 *
 * @param forkFrom - Text of the version option to fork from (default: 'published')
 */
export async function createTab(
  page: Page,
  name: string,
  forkFrom = 'published'
): Promise<void> {
  // Skip if tab already exists
  if (await page.getByText(name).isVisible({ timeout: 1_000 }).catch(() => false)) {
    return;
  }

  await page.getByRole('button', { name: /create new tab/i }).click();
  await expect(page.getByRole('heading', { name: 'Create New Tab' })).toBeVisible({
    timeout: 5_000,
  });

  await page.getByLabel('Tab name').fill(name);

  // Select fork source via combobox
  const selectTrigger = page.locator(COMBOBOX_TRIGGER);
  await selectTrigger.click();
  const option = page.getByRole('option').filter({ hasText: forkFrom }).first();
  await option.waitFor({ state: 'visible' });
  await option.click();

  await page.getByRole('button', { name: /create tab/i }).click();
  await expect(page.getByRole('heading', { name: 'Create New Tab' })).not.toBeVisible({
    timeout: 5_000,
  });
  await expect(page.getByText(name)).toBeVisible({ timeout: 5_000 });
}

/**
 * Delete a tab by hovering to reveal the X button and clicking it.
 * No-op if the tab is not visible.
 */
export async function deleteTab(page: Page, name: string): Promise<void> {
  if (!(await page.getByText(name).isVisible().catch(() => false))) {
    return;
  }

  await page.getByText(name).hover();
  await page.waitForTimeout(300); // Hover reveal animation for delete button

  const tabButton = page.locator('button', { hasText: name });
  const deleteBtn = tabButton
    .locator('[role="button"]')
    .filter({ has: page.locator('.lucide-x') });

  if (await deleteBtn.isVisible().catch(() => false)) {
    await deleteBtn.click();
    await expectToast(page, 'Tab deleted');
  }
}

/**
 * Switch to a tab by clicking its name in the tab bar.
 * Uses `{ exact: true }` to avoid matching partial text (e.g., breadcrumbs).
 */
export async function switchTab(page: Page, name: string): Promise<void> {
  await page.getByText(name, { exact: true }).click();
  await page.waitForTimeout(500); // Wait for tab content to load
}
