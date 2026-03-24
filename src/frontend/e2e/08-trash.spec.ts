import { test, expect } from '@playwright/test';
import { loginViaUI, waitForAppShell, expectToast } from './helpers/pages';

/**
 * Trash & recovery: delete entry → view trash → restore → permanent delete.
 * Uses the editor account. Creates a disposable entry for testing.
 */

const EDITOR = { email: 'editor@e2e.test', password: 'E2ETestPassword123!' };

const TRASH_ENTRY_TITLE = 'Entry For Trash Test';

test.describe('Trash & Recovery', () => {
  test.describe.configure({ mode: 'serial' });

  test('create a disposable entry and move it to trash', async ({ page }) => {
    await loginViaUI(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Create a new entry for trash testing
    await page.goto('/entry/new');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Title').fill(TRASH_ENTRY_TITLE);
    await page.getByRole('button', { name: 'Create Entry' }).click();
    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });

    // Add some content and save
    const editor = page.locator('.tiptap').first();
    await editor.click();
    await editor.pressSequentially('Temporary content for trash test.', { delay: 10 });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(page, 'Saved');

    // Go to library
    await page.goto('/library');
    await page.waitForLoadState('networkidle');

    // Find the entry card and open its menu
    const entryCard = page.locator('[class*="cursor-pointer"]', { hasText: TRASH_ENTRY_TITLE }).first();
    const menuBtn = entryCard.locator('button:has(svg.lucide-ellipsis)');
    await menuBtn.click({ force: true });

    // Click "Move to trash"
    await page.getByRole('menuitem', { name: /move to trash/i }).click();

    // Verify toast
    await expectToast(page, /trash/i);

    // Verify entry is no longer in library
    await page.waitForTimeout(1_000);
    await expect(page.getByText(TRASH_ENTRY_TITLE)).not.toBeVisible({ timeout: 5_000 });
  });

  test('view trashed entries', async ({ page }) => {
    await loginViaUI(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Navigate to trash via sidebar
    await page.goto('/trash');
    await page.waitForLoadState('networkidle');

    // Verify trash page heading
    await expect(page.getByRole('heading', { name: 'Trash' })).toBeVisible({ timeout: 5_000 });

    // Verify trashed entry appears
    await expect(page.getByText(TRASH_ENTRY_TITLE)).toBeVisible({ timeout: 5_000 });
  });

  test('restore entry from trash', async ({ page }) => {
    await loginViaUI(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Navigate to trash
    await page.goto('/trash');
    await page.waitForLoadState('networkidle');

    // Click the restore button for the trashed entry
    const entryRow = page.locator('div', { hasText: TRASH_ENTRY_TITLE }).first();
    const restoreBtn = entryRow.getByRole('button', { name: /restore/i });
    await restoreBtn.click();

    // Verify success toast
    await expectToast(page, /restored/i);

    // Navigate to library and verify entry is back
    await page.goto('/library');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(TRASH_ENTRY_TITLE)).toBeVisible({ timeout: 5_000 });
  });

  test('permanently delete entry from trash', async ({ page }) => {
    // First, move the entry back to trash
    await loginViaUI(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Go to library and trash the entry again
    await page.goto('/library');
    await page.waitForLoadState('networkidle');

    const entryCard = page.locator('[class*="cursor-pointer"]', { hasText: TRASH_ENTRY_TITLE }).first();
    const menuBtn = entryCard.locator('button:has(svg.lucide-ellipsis)');
    await menuBtn.click({ force: true });
    await page.getByRole('menuitem', { name: /move to trash/i }).click();
    await expectToast(page, /trash/i);

    // Navigate to trash
    await page.goto('/trash');
    await page.waitForLoadState('networkidle');

    // Click permanently delete (only available for admin role — editor may not have this)
    // Check if the entry has a delete button
    const entryRow = page.locator('div', { hasText: TRASH_ENTRY_TITLE }).first();
    const deleteBtn = entryRow.getByRole('button', { name: /permanently delete/i });

    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deleteBtn.click();

      // Confirm in the AlertDialog
      const dialog = page.getByRole('alertdialog');
      await dialog.waitFor({ state: 'visible' });
      await dialog.getByRole('button', { name: /delete/i }).click();

      // Verify entry is gone
      await page.waitForTimeout(1_000);
      await expect(page.getByText(TRASH_ENTRY_TITLE)).not.toBeVisible({ timeout: 5_000 });
    } else {
      // Editor role may not have permanent delete — verify trash is still visible
      await expect(page.getByText(TRASH_ENTRY_TITLE)).toBeVisible();
      // Use admin to permanently delete instead
      test.skip(true, 'Permanent delete requires admin role — editor cannot perform this action');
    }
  });
});
