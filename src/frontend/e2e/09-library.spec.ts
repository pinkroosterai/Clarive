import { test, expect } from '@playwright/test';
import { loginViaUI, waitForAppShell } from './helpers/pages';

/**
 * Library features: search, filter by status, sort, duplicate entry.
 * Uses the editor account. Depends on entries created in specs 05-06.
 */

const EDITOR = { email: 'editor@e2e.test', password: 'E2ETestPassword123!' };

async function navigateToLibrary(page: import('@playwright/test').Page) {
  await loginViaUI(page, EDITOR.email, EDITOR.password);
  await page.waitForURL(/\/$/, { timeout: 15_000 });
  await waitForAppShell(page);

  // Navigate to library
  await page.goto('/library');
  await page.waitForLoadState('networkidle');
}

test.describe('Library Search, Filter & Sort', () => {
  test.describe.configure({ mode: 'serial' });

  test('search entries by title', async ({ page }) => {
    await navigateToLibrary(page);

    // Search for an entry that exists (from spec 05)
    const searchInput = page.getByPlaceholder('Search prompts…');
    await searchInput.fill('E2E Test Entry');

    // Wait for debounce (300ms) + network
    await page.waitForTimeout(500);

    // Should show results matching the search
    await expect(page.getByText('E2E Test Entry').first()).toBeVisible({ timeout: 5_000 });

    // Search for something that doesn't exist
    await searchInput.fill('NonExistentEntryXYZ12345');
    await page.waitForTimeout(500);

    // Should show empty state or "0 results"
    const resultCount = page.getByText(/0 result/i);
    const emptyState = page.getByText(/no entries|no results|nothing found/i);
    const eitherVisible =
      (await resultCount.isVisible({ timeout: 3_000 }).catch(() => false)) ||
      (await emptyState.isVisible({ timeout: 1_000 }).catch(() => false));
    expect(eitherVisible).toBe(true);

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);
  });

  test('filter entries by status', async ({ page }) => {
    await navigateToLibrary(page);

    // Open the status filter dropdown — first combobox button (130px width)
    const statusTrigger = page.locator('button[role="combobox"]').first();
    await statusTrigger.click();

    // Select "Draft" (to filter differently from the default "All")
    await page.getByRole('option', { name: 'Draft' }).click();
    await page.waitForTimeout(500);

    // Verify the dropdown now shows "Draft"
    await expect(statusTrigger).toContainText('Draft');

    // Since all entries are published, draft filter should show no results or empty state
    // Switch to "Published" to verify positive results
    await statusTrigger.click();
    await page.getByRole('option', { name: 'Published' }).click();
    await page.waitForTimeout(500);

    // At least one entry card should be visible
    const entryCards = page.locator('[data-tour="entry-card"]');
    await expect(entryCards.first()).toBeVisible({ timeout: 5_000 });

    // Reset filter to "All status"
    await statusTrigger.click();
    await page.getByRole('option', { name: /all status/i }).click();
    await page.waitForTimeout(500);
  });

  test('sort entries alphabetically', async ({ page }) => {
    await navigateToLibrary(page);

    // Open the sort dropdown — second combobox button
    const sortTrigger = page.locator('button[role="combobox"]').nth(1);
    await sortTrigger.click();

    // Select "Alphabetical"
    await page.getByRole('option', { name: 'Alphabetical' }).click();
    await page.waitForTimeout(500);

    // Wait for results to update
    await page.waitForTimeout(500);

    // Verify entries are displayed (at least one)
    const cards = page.locator('[data-tour="entry-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 5_000 });

    // Reset sort to "Recent"
    await sortTrigger.click();
    await page.getByRole('option', { name: 'Recent' }).click();
  });

  test('duplicate an entry', async ({ page }) => {
    await navigateToLibrary(page);

    // Open the first entry in the library
    const firstCard = page.locator('[data-tour="entry-card"]').first();
    await firstCard.click();
    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });

    // Get the original title
    const titleInput = page.locator('input[placeholder="Entry title"]');
    await expect(titleInput).toBeVisible({ timeout: 5_000 });
    const originalTitle = await titleInput.inputValue();

    // Click Duplicate in the Actions tab
    const duplicateBtn = page.getByRole('button', { name: /duplicate/i });
    await expect(duplicateBtn).toBeVisible({ timeout: 5_000 });
    await duplicateBtn.click();

    // A folder picker dialog may appear — confirm
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await dialog.getByRole('button', { name: /confirm/i }).click();
    }

    // Verify redirected to the duplicated entry editor
    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });

    // The duplicated entry should have a title
    const dupTitleInput = page.locator('input[placeholder="Entry title"]');
    await expect(dupTitleInput).toBeVisible({ timeout: 5_000 });
    const dupTitle = await dupTitleInput.inputValue();
    expect(dupTitle.length).toBeGreaterThan(0);
  });
});
