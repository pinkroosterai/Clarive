import { test, expect } from './fixtures';
import { navigateToEntry, expectToast } from './helpers/pages';
import { deleteTab, switchTab } from './helpers/tabs';
import { saveEntry } from './helpers/entry-actions';
import {
  promptEditor,
  titleInput,
  ENTRY_TITLE_INPUT,
  COMBOBOX_TRIGGER,
  VERSION_PANEL,
} from './helpers/locators';

/**
 * Tab Lifecycle & Content Isolation tests.
 *
 * Prerequisites: spec 06 published v1 and v2 of "E2E Test Entry v2".
 * This spec tests creating, switching, editing, deleting tabs,
 * and restoring historical versions to new tabs.
 */

const ENTRY_TITLE = 'E2E Test Entry v2';
const TAB_B_NAME = 'Test Tab B';

test.describe('Tab Lifecycle & Content Isolation', () => {
  test.describe.configure({ mode: 'serial' });

  // ── Tab Creation ──
  // NOTE: This test exercises the create-tab UI flow inline because it IS the SUT.

  test('create a new tab forked from published version', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    await page.getByRole('button', { name: /create new tab/i }).click();
    await expect(page.getByRole('heading', { name: 'Create New Tab' })).toBeVisible({
      timeout: 5_000,
    });

    await page.getByLabel('Tab name').fill(TAB_B_NAME);

    const selectTrigger = page.locator(COMBOBOX_TRIGGER);
    await selectTrigger.click();
    const publishedOption = page.getByRole('option').filter({ hasText: 'published' }).first();
    await publishedOption.waitFor({ state: 'visible' });
    await publishedOption.click();

    await page.getByRole('button', { name: /create tab/i }).click();

    await expect(page.getByRole('heading', { name: 'Create New Tab' })).not.toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(TAB_B_NAME)).toBeVisible({ timeout: 5_000 });
  });

  // ── Tab Switching & Content Isolation ──

  test('switching tabs changes content correctly', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    const editor = promptEditor(page);
    const mainContent = await editor.textContent();

    await switchTab(page, TAB_B_NAME);
    const tabBContent = await editor.textContent();
    expect(tabBContent).toBeTruthy();

    await switchTab(page, 'Main');
    const mainContentAfter = await editor.textContent();
    expect(mainContentAfter).toBe(mainContent);
  });

  test('edits in one tab do not affect another tab', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    const editor = promptEditor(page);
    const mainContentBefore = await editor.textContent();

    await switchTab(page, TAB_B_NAME);
    await editor.click();
    await editor.pressSequentially(' — Tab B exclusive edit', { delay: 10 });

    await expect(page.getByText('Unsaved changes')).toBeVisible({ timeout: 3_000 });

    await saveEntry(page);

    await switchTab(page, 'Main');
    const mainContentAfter = await editor.textContent();
    expect(mainContentAfter).toBe(mainContentBefore);
    expect(mainContentAfter).not.toContain('Tab B exclusive edit');

    await switchTab(page, TAB_B_NAME);
    const tabBContentAfter = await editor.textContent();
    expect(tabBContentAfter).toContain('Tab B exclusive edit');
  });

  test('published view is read-only with banner', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    await page.getByText('Published').first().click();

    await expect(page.getByText(/read-only mode/i)).toBeVisible({ timeout: 5_000 });

    const title = titleInput(page);
    await expect(title).toBeDisabled();

    await switchTab(page, 'Main');
    await expect(title).toBeEnabled({ timeout: 3_000 });
  });

  // ── False Dirty State Regression ──

  test('switching tabs without edits does not trigger dirty state', async ({
    editorPage: page,
  }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    await expect(page.getByText('Unsaved changes')).not.toBeVisible({ timeout: 3_000 });

    await switchTab(page, TAB_B_NAME);
    await expect(page.getByText('Unsaved changes')).not.toBeVisible();

    await switchTab(page, 'Main');
    await expect(page.getByText('Unsaved changes')).not.toBeVisible();

    await page.getByText('Published').first().click();
    await page.waitForTimeout(500); // Published tab content load
    await switchTab(page, 'Main');
    await expect(page.getByText('Unsaved changes')).not.toBeVisible();
  });

  // ── Tab Management ──

  test('Main tab has no delete button', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    await page.getByText('Main').hover();
    await page.waitForTimeout(300); // Hover reveal animation

    const mainTabButton = page.locator('button', { hasText: 'Main' }).first();
    const deleteIcon = mainTabButton.locator('.lucide-x');
    await expect(deleteIcon).not.toBeVisible();
  });

  test('delete a non-Main tab redirects to Main tab', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    await expect(page.getByText(TAB_B_NAME)).toBeVisible();

    await switchTab(page, TAB_B_NAME);

    await deleteTab(page, TAB_B_NAME);

    await expect(page.getByText(TAB_B_NAME)).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Prompt #1').first()).toBeVisible({ timeout: 5_000 });
  });

  // ── Restore to Tab ──

  test('restore historical version to new tab via version panel', async ({
    editorPage: page,
  }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    await page.getByRole('tab', { name: /versions/i }).click();
    await expect(page.getByRole('heading', { name: 'Version History' })).toBeVisible({
      timeout: 3_000,
    });

    const versionPanel = page.locator(VERSION_PANEL);
    const v1Item = versionPanel.locator('button', { hasText: 'v1' });
    await v1Item.hover();
    await page.waitForTimeout(300); // Hover reveal animation

    const restoreBtn = v1Item.getByRole('button', { name: /restore/i });
    await expect(restoreBtn).toBeVisible({ timeout: 3_000 });
    await restoreBtn.click();

    const restoreDialog = page.getByRole('dialog');
    await restoreDialog.waitFor({ state: 'visible', timeout: 5_000 });
    const tabNameInput = page.getByLabel('New tab name');
    await expect(tabNameInput).toBeVisible();
    const prefilled = await tabNameInput.inputValue();
    expect(prefilled).toContain('Restored');

    await restoreDialog.getByRole('button', { name: /^restore$/i }).click();
    await expectToast(page, /restored v1 to new tab/i);

    const restoredTabButton = page.locator('button', { hasText: 'Restored v1' });
    await expect(restoredTabButton).toBeVisible({ timeout: 5_000 });

    await deleteTab(page, 'Restored v1');
  });
});
