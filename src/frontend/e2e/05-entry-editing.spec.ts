import { test, expect } from '@playwright/test';
import { loginViaUI, waitForAppShell, expectToast } from './helpers/pages';

const EDITOR = {
  email: 'editor@e2e.test',
  password: 'E2ETestPassword123!',
};

const ENTRY_TITLE = 'E2E Test Entry';
const PROMPT_CONTENT = 'You are a helpful assistant that writes clear documentation for software projects.';

/** Login and navigate to the E2E Test Entry editor page. */
async function navigateToEntry(page: import('@playwright/test').Page) {
  await loginViaUI(page, EDITOR.email, EDITOR.password);
  await page.waitForURL(/\/$/, { timeout: 15_000 });
  await waitForAppShell(page);

  await page.getByText(ENTRY_TITLE).first().click();
  await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });
  await expect(page.getByText('Prompt #1')).toBeVisible({ timeout: 5_000 });
}

test.describe('Entry Editing Lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  test('create a new entry manually', async ({ page }) => {
    await loginViaUI(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Navigate to new entry page
    await page.goto('/entry/new');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Create New Entry')).toBeVisible({ timeout: 10_000 });

    // Fill title
    await page.getByLabel('Title').fill(ENTRY_TITLE);

    // Submit
    await page.getByRole('button', { name: 'Create Entry' }).click();

    // Should redirect to the editor page
    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });

    // Verify editor loaded
    await expect(page.locator('input[placeholder="Entry title"]')).toHaveValue(ENTRY_TITLE, {
      timeout: 5_000,
    });
    await expect(page.getByText('Prompt #1')).toBeVisible();
    await expect(page.getByText('Unpublished')).toBeVisible();
  });

  test('write prompt content and save', async ({ page }) => {
    await navigateToEntry(page);

    // Type content into the Tiptap editor
    const tiptapEditor = page.locator('.tiptap').first();
    await tiptapEditor.click();
    await tiptapEditor.pressSequentially(PROMPT_CONTENT, { delay: 10 });

    // Wait for debounce (MarkdownEditor has 150ms debounce)
    await page.waitForTimeout(500);

    // Verify unsaved indicator appears
    await expect(page.getByText('Unsaved changes')).toBeVisible({ timeout: 3_000 });

    // Click Save
    await page.getByRole('button', { name: /^save$/i }).click();

    // Verify save toast
    await expectToast(page, 'Saved');

    // Verify button shows "Saved!" briefly
    await expect(page.getByRole('button', { name: /saved!/i })).toBeVisible();

    // Should return to clean state
    await expect(page.getByText('Unsaved changes')).not.toBeVisible({ timeout: 5_000 });
  });

  test('edit title, verify dirty state, then discard', async ({ page }) => {
    await navigateToEntry(page);

    // Verify clean state
    await expect(page.getByText('Unsaved changes')).not.toBeVisible();

    // Edit the title
    const titleInput = page.locator('input[placeholder="Entry title"]');
    await titleInput.fill('Temporary Title Change');

    // Verify dirty indicator
    await expect(page.getByText('Unsaved changes')).toBeVisible({ timeout: 3_000 });

    // Discard changes
    await page.getByRole('button', { name: /discard changes/i }).click();

    // Confirmation dialog should appear
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await expect(dialog.getByText('Discard all changes?')).toBeVisible();

    // Confirm discard
    await dialog.getByRole('button', { name: /discard/i }).click();

    // Title should revert to original
    await expect(titleInput).toHaveValue(ENTRY_TITLE, { timeout: 3_000 });

    // No more dirty indicator
    await expect(page.getByText('Unsaved changes')).not.toBeVisible({ timeout: 3_000 });
  });

  test('undo and redo changes', async ({ page }) => {
    await navigateToEntry(page);

    const titleInput = page.locator('input[placeholder="Entry title"]');

    // Make a change — wait beyond coalesce window (1s) to ensure snapshot
    await titleInput.fill('Undo Test Title');
    await page.waitForTimeout(1200);

    // Verify undo button is enabled and click it
    const undoBtn = page.getByRole('button', { name: 'Undo' });
    await expect(undoBtn).toBeEnabled({ timeout: 3_000 });
    await undoBtn.click();

    // Title should revert
    await expect(titleInput).toHaveValue(ENTRY_TITLE, { timeout: 3_000 });

    // Redo should bring it back
    const redoBtn = page.getByRole('button', { name: 'Redo' });
    await expect(redoBtn).toBeEnabled({ timeout: 3_000 });
    await redoBtn.click();

    await expect(titleInput).toHaveValue('Undo Test Title', { timeout: 3_000 });

    // Discard to clean up
    await page.getByRole('button', { name: /discard changes/i }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /discard/i }).click();
  });

  test('add, reorder, and delete follow-up prompts', async ({ page }) => {
    await navigateToEntry(page);

    // Add a follow-up prompt
    await page.getByRole('button', { name: /add follow-up prompt/i }).click();

    // Verify second prompt card appears
    await expect(page.getByText('Prompt #2')).toBeVisible({ timeout: 3_000 });

    // Type content in the second prompt
    const secondEditor = page.locator('.tiptap').nth(1);
    await secondEditor.click();
    await secondEditor.pressSequentially('Follow-up prompt content', { delay: 10 });
    await page.waitForTimeout(500);

    // Move prompt #2 up — use .last() since prompt #1's Move up is disabled but still exists
    await page.getByRole('button', { name: 'Move up' }).last().click();
    await page.waitForTimeout(500);

    // Move it back down — use .first() since it's now the first prompt
    await page.getByRole('button', { name: 'Move down' }).first().click();
    await page.waitForTimeout(500);

    // Delete the second prompt via Remove button
    await page.getByRole('button', { name: /remove/i }).last().click();
    await page.waitForTimeout(500);

    // Verify only one prompt remains
    await expect(page.getByText('Prompt #1')).toBeVisible();
    await expect(page.getByText('Prompt #2')).not.toBeVisible();

    // Discard to clean up
    await page.getByRole('button', { name: /discard changes/i }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /discard/i }).click();
  });

  test('add and remove system message', async ({ page }) => {
    await navigateToEntry(page);

    const addBtn = page.getByRole('button', { name: /add system message/i });
    const systemSection = page.locator('[data-tour="system-message"]');

    // If system message section is not visible, add it
    if (await addBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await addBtn.click();
    }

    // Verify system message section is visible
    await expect(systemSection).toBeVisible({ timeout: 3_000 });

    // Type in the system message editor (first .tiptap is the system message editor)
    const systemEditor = page.locator('.tiptap').first();
    await systemEditor.click();
    await systemEditor.pressSequentially('You are an AI assistant.', { delay: 10 });
    await page.waitForTimeout(500);

    // Remove system message via X button
    await systemSection.locator('button').filter({ has: page.locator('.lucide-x') }).click();
    await page.waitForTimeout(500);

    // "Add system message" button should reappear
    await expect(addBtn).toBeVisible({ timeout: 3_000 });

    // Discard changes
    await page.getByRole('button', { name: /discard changes/i }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /discard/i }).click();
  });

  test('add and remove tags', async ({ page }) => {
    await navigateToEntry(page);

    // Switch to Details tab
    await page.getByRole('tab', { name: /details/i }).click();
    await expect(page.getByText('Tags')).toBeVisible({ timeout: 3_000 });

    // Add a tag
    const tagInput = page.getByPlaceholder('Add tag...');
    await tagInput.fill('e2e-test');
    await tagInput.press('Enter');

    // Verify tag badge appears
    await expect(page.locator('.flex-wrap').getByText('e2e-test')).toBeVisible({ timeout: 3_000 });

    // Add another tag
    await tagInput.fill('documentation');
    await tagInput.press('Enter');
    await expect(page.locator('.flex-wrap').getByText('documentation')).toBeVisible({
      timeout: 3_000,
    });

    // Remove first tag by clicking the X button inside its badge
    // The Badge component renders as <div class="... gap-1 ...">tagname<button><X/></button></div>
    const tagBadges = page.locator('.flex-wrap > div');
    const e2eTagBadge = tagBadges.filter({ hasText: 'e2e-test' }).first();
    await e2eTagBadge.locator('button').click();

    // Verify tag is removed
    await expect(page.locator('.flex-wrap').getByText('e2e-test')).not.toBeVisible({
      timeout: 3_000,
    });

    // Second tag should still exist
    await expect(page.locator('.flex-wrap').getByText('documentation')).toBeVisible();
  });

  test('toggle favorite', async ({ page }) => {
    await navigateToEntry(page);

    // Dismiss first-use hint if visible (can overlay the star button)
    const dismissHint = page.getByRole('button', { name: /dismiss hint/i });
    if (await dismissHint.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await dismissHint.click();
      await page.waitForTimeout(300);
    }

    // Click the favorite star button
    const favoriteBtn = page.getByRole('button', { name: /add to favorites/i });
    await favoriteBtn.click({ force: true });

    // Verify it now says "Remove from favorites"
    await expect(page.getByRole('button', { name: /remove from favorites/i })).toBeVisible({
      timeout: 10_000,
    });

    // Toggle back
    await page.getByRole('button', { name: /remove from favorites/i }).click({ force: true });
    await expect(page.getByRole('button', { name: /add to favorites/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});
