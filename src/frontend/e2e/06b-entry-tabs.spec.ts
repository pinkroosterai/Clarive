import { test, expect } from '@playwright/test';
import { loginViaUI, waitForAppShell, expectToast } from './helpers/pages';

/**
 * Tab Lifecycle & Content Isolation tests.
 *
 * Prerequisites: spec 06 published v1 and v2 of "E2E Test Entry v2".
 * This spec tests creating, switching, editing, deleting tabs,
 * and restoring historical versions to new tabs.
 */

const EDITOR = {
  email: 'editor@e2e.test',
  password: 'E2ETestPassword123!',
};

const ENTRY_TITLE = 'E2E Test Entry v2';
const TAB_B_NAME = 'Test Tab B';

/** Login and navigate to the entry editor. */
async function loginAndNavigate(page: import('@playwright/test').Page) {
  await loginViaUI(page, EDITOR.email, EDITOR.password);
  await page.waitForURL(/\/$/, { timeout: 15_000 });
  await waitForAppShell(page);
  await page.getByText(ENTRY_TITLE).first().click();
  await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });
  await expect(page.getByText('Prompt #1')).toBeVisible({ timeout: 5_000 });
}

test.describe('Tab Lifecycle & Content Isolation', () => {
  test.describe.configure({ mode: 'serial' });

  // ── Tab Creation ──

  test('create a new tab forked from published version', async ({ page }) => {
    await loginAndNavigate(page);

    // Click the create tab button (Plus icon with tooltip "Create new tab")
    await page.getByRole('button', { name: /create new tab/i }).click();

    // Dialog should appear
    await expect(page.getByRole('heading', { name: 'Create New Tab' })).toBeVisible({
      timeout: 5_000,
    });

    // Fill tab name
    await page.getByLabel('Tab name').fill(TAB_B_NAME);

    // Select fork version via Radix Select — pick the published version
    const selectTrigger = page.locator('[role="combobox"]');
    await selectTrigger.click();
    // Pick the option containing "published"
    const publishedOption = page.getByRole('option').filter({ hasText: 'published' }).first();
    await publishedOption.waitFor({ state: 'visible' });
    await publishedOption.click();

    // Click Create Tab
    await page.getByRole('button', { name: /create tab/i }).click();

    // Wait for dialog to close and new tab to appear
    await expect(page.getByRole('heading', { name: 'Create New Tab' })).not.toBeVisible({
      timeout: 5_000,
    });

    // Verify the new tab appears in the tab bar
    await expect(page.getByText(TAB_B_NAME)).toBeVisible({ timeout: 5_000 });
  });

  // ── Tab Switching & Content Isolation ──

  test('switching tabs changes content correctly', async ({ page }) => {
    await loginAndNavigate(page);

    // Get Main tab content first
    const editor = page.locator('.tiptap').first();
    const mainContent = await editor.textContent();

    // Switch to Tab B
    await page.getByText(TAB_B_NAME).click();
    await page.waitForTimeout(500);

    // Tab B should have content (forked from published version)
    const tabBContent = await editor.textContent();
    expect(tabBContent).toBeTruthy();

    // Switch back to Main
    await page.getByText('Main').click();
    await page.waitForTimeout(500);

    // Main content should be unchanged
    const mainContentAfter = await editor.textContent();
    expect(mainContentAfter).toBe(mainContent);
  });

  test('edits in one tab do not affect another tab', async ({ page }) => {
    await loginAndNavigate(page);

    // Get Main tab content
    const editor = page.locator('.tiptap').first();
    const mainContentBefore = await editor.textContent();

    // Switch to Tab B
    await page.getByText(TAB_B_NAME).click();
    await page.waitForTimeout(500);

    // Edit Tab B content
    await editor.click();
    await editor.pressSequentially(' — Tab B exclusive edit', { delay: 10 });
    await page.waitForTimeout(300);

    // Switch to Main — content should NOT contain the edit
    await page.getByText('Main').click();
    await page.waitForTimeout(500);

    const mainContentAfter = await editor.textContent();
    expect(mainContentAfter).toBe(mainContentBefore);
    expect(mainContentAfter).not.toContain('Tab B exclusive edit');

    // Switch back to Tab B — edits should be preserved
    await page.getByText(TAB_B_NAME).click();
    await page.waitForTimeout(500);

    const tabBContentAfter = await editor.textContent();
    expect(tabBContentAfter).toContain('Tab B exclusive edit');

    // Discard changes to clean up
    await page.getByRole('button', { name: /discard changes/i }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /discard/i }).click();
  });

  test('published view is read-only with banner', async ({ page }) => {
    await loginAndNavigate(page);

    // Click Published tab
    await page.getByText('Published').first().click();
    await page.waitForTimeout(500);

    // Read-only banner should be visible
    await expect(page.getByText(/viewing published version.*read-only/i)).toBeVisible({
      timeout: 5_000,
    });

    // Title input should be disabled
    const titleInput = page.locator('input[placeholder="Entry title"]');
    await expect(titleInput).toBeDisabled();

    // Switch back to Main to return to editable state
    await page.getByText('Main').click();
    await page.waitForTimeout(500);
    await expect(titleInput).toBeEnabled({ timeout: 3_000 });
  });

  // ── False Dirty State Regression ──

  test('switching tabs without edits does not trigger dirty state', async ({ page }) => {
    await loginAndNavigate(page);

    // Ensure clean state
    await expect(page.getByText('Unsaved changes')).not.toBeVisible({ timeout: 3_000 });

    // Switch to Tab B — wait beyond debounce (150ms)
    await page.getByText(TAB_B_NAME).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Unsaved changes')).not.toBeVisible();

    // Switch back to Main
    await page.getByText('Main').click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Unsaved changes')).not.toBeVisible();

    // Switch to Published view and back
    await page.getByText('Published').first().click();
    await page.waitForTimeout(500);
    await page.getByText('Main').click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Unsaved changes')).not.toBeVisible();
  });

  // ── Tab Management ──

  test('Main tab has no delete button', async ({ page }) => {
    await loginAndNavigate(page);

    // Hover over Main tab
    await page.getByText('Main').hover();
    await page.waitForTimeout(300);

    // No X icon should appear within the Main tab area
    // The delete button has tooltip "Delete tab" — verify it's not visible
    // We check that the lucide-x icon near Main tab is not present
    const mainTabButton = page.locator('button', { hasText: 'Main' }).first();
    const deleteIcon = mainTabButton.locator('.lucide-x');
    await expect(deleteIcon).not.toBeVisible();
  });

  test('delete a non-Main tab redirects to Main tab', async ({ page }) => {
    await loginAndNavigate(page);

    // Verify Tab B exists
    await expect(page.getByText(TAB_B_NAME)).toBeVisible();

    // Switch to Tab B first so we can verify redirect after deletion
    await page.getByText(TAB_B_NAME).click();
    await page.waitForTimeout(500);

    // Hover over Tab B to reveal delete button
    await page.getByText(TAB_B_NAME).hover();
    await page.waitForTimeout(300);

    // Click the X button (delete) on Tab B
    const tabBButton = page.locator('button', { hasText: TAB_B_NAME });
    const deleteBtn = tabBButton.locator('[role="button"]').filter({ has: page.locator('.lucide-x') });
    await deleteBtn.click();

    // Verify toast
    await expectToast(page, 'Tab deleted');

    // Tab B should be gone from the bar
    await expect(page.getByText(TAB_B_NAME)).not.toBeVisible({ timeout: 5_000 });

    // Should have redirected to Main tab — verify editor is still functional
    await expect(page.getByText('Prompt #1')).toBeVisible({ timeout: 5_000 });
  });

  // ── Restore to Tab ──

  test('restore historical version to new tab', async ({ page }) => {
    await loginAndNavigate(page);

    // Navigate to Versions tab
    await page.getByRole('tab', { name: /versions/i }).click();
    await expect(page.getByText('Version History')).toBeVisible({ timeout: 3_000 });

    // Click on v1 in the version timeline
    await page.locator('[data-tour="version-panel"]').getByText('v1').click();

    // Wait for historical view
    await page.waitForURL(/\/entry\/[a-f0-9-]+\/version\/1$/, { timeout: 10_000 });

    // Read-only banner should show
    await expect(page.getByText(/viewing v1.*read-only/i)).toBeVisible({ timeout: 5_000 });

    // Click "Restore to tab"
    await page.getByRole('button', { name: /restore to tab/i }).click();

    // Restore dialog should appear with pre-filled name
    const restoreDialog = page.getByRole('dialog');
    await restoreDialog.waitFor({ state: 'visible' });
    const tabNameInput = page.getByLabel('New tab name');
    await expect(tabNameInput).toBeVisible();
    const prefilled = await tabNameInput.inputValue();
    expect(prefilled).toContain('Restored');

    // Click Restore button
    await restoreDialog.getByRole('button', { name: /^restore$/i }).click();

    // Verify toast
    await expectToast(page, /restored v1 to new tab/i);

    // Should navigate back to the entry editor
    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });

    // The restored tab should appear in the tab bar
    await expect(page.getByText(/restored/i)).toBeVisible({ timeout: 5_000 });

    // Clean up: delete the restored tab so downstream specs aren't affected
    await page.getByText(/restored/i).hover();
    await page.waitForTimeout(300);
    const restoredTabButton = page.locator('button', { hasText: /restored/i });
    const restoredDeleteBtn = restoredTabButton
      .locator('[role="button"]')
      .filter({ has: page.locator('.lucide-x') });
    await restoredDeleteBtn.click();
    await expectToast(page, 'Tab deleted');
  });
});
