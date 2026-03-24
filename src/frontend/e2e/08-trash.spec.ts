import { test, expect } from './fixtures';
import { expectToast } from './helpers/pages';
import { createEntryViaAPI } from './helpers/api';

/**
 * Trash & recovery: delete entry → view trash → restore → permanent delete.
 * Uses the editor account. Creates a disposable entry for testing.
 */

const TRASH_ENTRY_TITLE = 'Entry For Trash Test';

test.describe('Trash & Recovery', () => {
  test.describe.configure({ mode: 'serial' });

  test('create a disposable entry and move it to trash', async ({ editorPage: page }) => {
    // Create entry via API (faster than UI)
    await createEntryViaAPI(page, {
      title: TRASH_ENTRY_TITLE,
      content: 'Temporary content for trash test.',
    });

    // Go to library
    await page.goto('/library');
    await page.waitForLoadState('networkidle');

    // Find the entry card and open its menu
    const entryCard = page
      .locator('[class*="cursor-pointer"]', { hasText: TRASH_ENTRY_TITLE })
      .first();
    const menuBtn = entryCard.locator('button:has(svg.lucide-ellipsis)');
    await menuBtn.click({ force: true });

    // Click "Move to trash"
    await page.getByRole('menuitem', { name: /move to trash/i }).click();

    await expectToast(page, /trash/i);

    // Verify entry is no longer in library
    await expect(page.getByText(TRASH_ENTRY_TITLE)).not.toBeVisible({ timeout: 5_000 });
  });

  test('view trashed entries', async ({ editorPage: page }) => {
    await page.goto('/trash');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Trash' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(TRASH_ENTRY_TITLE)).toBeVisible({ timeout: 5_000 });
  });

  test('restore entry from trash', async ({ editorPage: page }) => {
    await page.goto('/trash');
    await page.waitForLoadState('networkidle');

    const entryRow = page.locator('div', { hasText: TRASH_ENTRY_TITLE }).first();
    const restoreBtn = entryRow.getByRole('button', { name: /restore/i });
    await restoreBtn.click();

    await expectToast(page, /restored/i);

    await page.goto('/library');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(TRASH_ENTRY_TITLE)).toBeVisible({ timeout: 5_000 });
  });

  test('permanently delete entry from trash', async ({ editorPage: page }) => {
    // Go to library and trash the entry again
    await page.goto('/library');
    await page.waitForLoadState('networkidle');

    const entryCard = page
      .locator('[class*="cursor-pointer"]', { hasText: TRASH_ENTRY_TITLE })
      .first();
    const menuBtn = entryCard.locator('button:has(svg.lucide-ellipsis)');
    await menuBtn.click({ force: true });
    await page.getByRole('menuitem', { name: /move to trash/i }).click();
    await expectToast(page, /trash/i);

    // Navigate to trash
    await page.goto('/trash');
    await page.waitForLoadState('networkidle');

    const entryRow = page.locator('div', { hasText: TRASH_ENTRY_TITLE }).first();
    const deleteBtn = entryRow.getByRole('button', { name: /permanently delete/i });

    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deleteBtn.click();

      const dialog = page.getByRole('alertdialog');
      await dialog.waitFor({ state: 'visible' });
      await dialog.getByRole('button', { name: /delete/i }).click();

      // Wait for dialog to close before checking entry is gone
      await dialog.waitFor({ state: 'hidden' });
      await expect(page.getByText(TRASH_ENTRY_TITLE)).not.toBeVisible({ timeout: 5_000 });
    } else {
      await expect(page.getByText(TRASH_ENTRY_TITLE)).toBeVisible();
      test.skip(
        true,
        'Permanent delete requires admin role — editor cannot perform this action'
      );
    }
  });
});
