import { test, expect } from './fixtures';
import { titleInput } from './helpers/locators';

/**
 * Library features: search, filter by status, sort, duplicate entry.
 * Uses the editor account. Depends on entries created in specs 05-06.
 */

/** Navigate to library (page is already logged in via fixture). */
async function goToLibrary(page: import('@playwright/test').Page) {
  await page.goto('/library');
  await page.waitForLoadState('networkidle');
}

test.describe('Library Search, Filter & Sort', () => {
  test.describe.configure({ mode: 'serial' });

  test('search entries by title', async ({ editorPage: page }) => {
    await goToLibrary(page);

    const searchInput = page.getByPlaceholder('Search prompts…');
    await searchInput.fill('E2E Test Entry');
    await page.waitForTimeout(500); // Search debounce

    await expect(page.getByText('E2E Test Entry').first()).toBeVisible({ timeout: 5_000 });

    await searchInput.fill('NonExistentEntryXYZ12345');
    await page.waitForTimeout(500); // Search debounce

    const resultCount = page.getByText(/0 result/i);
    const emptyState = page.getByText(/no entries|no results|nothing found/i);
    const eitherVisible =
      (await resultCount.isVisible({ timeout: 3_000 }).catch(() => false)) ||
      (await emptyState.isVisible({ timeout: 1_000 }).catch(() => false));
    expect(eitherVisible).toBe(true);

    await searchInput.clear();
    await page.waitForTimeout(500); // Search debounce
  });

  test('filter entries by status', async ({ editorPage: page }) => {
    await goToLibrary(page);

    const statusTrigger = page.locator('button[role="combobox"]').first();
    await statusTrigger.click();

    await page.getByRole('option', { name: 'Unpublished' }).click();

    await expect(statusTrigger).toContainText('Unpublished');

    await statusTrigger.click();
    await page.getByRole('option', { name: 'Published', exact: true }).click();
    await page.waitForTimeout(500); // Filter results load

    const entryCards = page.locator('[data-tour="entry-card"]');
    await expect(entryCards.first()).toBeVisible({ timeout: 5_000 });

    await statusTrigger.click();
    await page.getByRole('option', { name: /all status/i }).click();
    await page.waitForTimeout(500); // Filter results load
  });

  test('sort entries alphabetically', async ({ editorPage: page }) => {
    await goToLibrary(page);

    const sortTrigger = page.locator('button[role="combobox"]').nth(1);
    await sortTrigger.click();

    await page.getByRole('option', { name: 'Alphabetical' }).click();
    await page.waitForTimeout(500); // Sort results load

    const cards = page.locator('[data-tour="entry-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 5_000 });

    await sortTrigger.click();
    await page.getByRole('option', { name: 'Recent' }).click();
  });

  test('duplicate an entry', async ({ editorPage: page }) => {
    await goToLibrary(page);

    const firstCard = page.locator('[data-tour="entry-card"]').first();
    await firstCard.click();
    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });

    const title = titleInput(page);
    await expect(title).toBeVisible({ timeout: 5_000 });
    const originalTitle = await title.inputValue();

    // Duplicate is inside the "More actions" dropdown
    const moreActionsBtn = page.getByRole('button', { name: /more actions/i });
    await expect(moreActionsBtn).toBeVisible({ timeout: 5_000 });
    await moreActionsBtn.click();

    const duplicateItem = page.getByRole('menuitem', { name: /duplicate/i });
    await expect(duplicateItem).toBeVisible({ timeout: 3_000 });
    await duplicateItem.click();

    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await dialog.getByRole('button', { name: /confirm/i }).click();
    }

    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });

    const dupTitle = titleInput(page);
    await expect(dupTitle).toBeVisible({ timeout: 5_000 });
    const dupTitleValue = await dupTitle.inputValue();
    expect(dupTitleValue.length).toBeGreaterThan(0);
  });
});
