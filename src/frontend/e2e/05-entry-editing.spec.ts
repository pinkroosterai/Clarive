import { test, expect, EDITOR } from './fixtures';
import { navigateToEntry, expectToast } from './helpers/pages';
import { saveEntry, discardChanges } from './helpers/entry-actions';
import { titleInput, systemMsgEditor, SYSTEM_MESSAGE_SECTION } from './helpers/locators';

const ENTRY_TITLE = 'E2E Test Entry';
const PROMPT_CONTENT =
  'You are a helpful assistant that writes clear documentation for software projects.';

test.describe('Entry Editing Lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  test('create a new entry manually', async ({ editorPage: page }) => {
    await page.goto('/entry/new');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Create New Entry')).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('Title').fill(ENTRY_TITLE);
    await page.getByRole('button', { name: 'Create Entry' }).click();

    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });

    await expect(titleInput(page)).toHaveValue(ENTRY_TITLE, { timeout: 5_000 });
    await expect(page.getByText('Prompt #1')).toBeVisible();
    await expect(page.getByText('Unpublished')).toBeVisible();
  });

  test('write prompt content and save', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    const editor = systemMsgEditor(page); // first .tiptap — no system message visible yet, so first is prompt
    await editor.click();
    await editor.pressSequentially(PROMPT_CONTENT, { delay: 10 });

    await expect(page.getByText('Unsaved changes')).toBeVisible({ timeout: 3_000 });

    await saveEntry(page);

    await expect(page.getByRole('button', { name: /saved!/i })).toBeVisible();
    await expect(page.getByText('Unsaved changes')).not.toBeVisible({ timeout: 5_000 });
  });

  test('edit title, verify dirty state, then discard', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    await expect(page.getByText('Unsaved changes')).not.toBeVisible();

    const title = titleInput(page);
    await title.fill('Temporary Title Change');

    await expect(page.getByText('Unsaved changes')).toBeVisible({ timeout: 3_000 });

    await discardChanges(page);

    await expect(title).toHaveValue(ENTRY_TITLE, { timeout: 3_000 });
    await expect(page.getByText('Unsaved changes')).not.toBeVisible({ timeout: 3_000 });
  });

  test('undo and redo changes', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    const title = titleInput(page);

    // Make a change — wait beyond coalesce window (1s) to ensure snapshot
    await title.fill('Undo Test Title');
    await page.waitForTimeout(1200); // Undo coalesce window (1s) must elapse for snapshot

    const undoBtn = page.getByRole('button', { name: 'Undo' });
    await expect(undoBtn).toBeEnabled({ timeout: 3_000 });
    await undoBtn.click();

    await expect(title).toHaveValue(ENTRY_TITLE, { timeout: 3_000 });

    const redoBtn = page.getByRole('button', { name: 'Redo' });
    await expect(redoBtn).toBeEnabled({ timeout: 3_000 });
    await redoBtn.click();

    await expect(title).toHaveValue('Undo Test Title', { timeout: 3_000 });

    await discardChanges(page);
  });

  test('add, reorder, and delete follow-up prompts', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    await page.getByRole('button', { name: /add follow-up prompt/i }).click();
    await expect(page.getByText('Prompt #2')).toBeVisible({ timeout: 3_000 });

    const secondEditor = page.locator('.tiptap').nth(1);
    await secondEditor.click();
    await secondEditor.pressSequentially('Follow-up prompt content', { delay: 10 });
    await page.waitForTimeout(500); // Debounce settle

    await page.getByRole('button', { name: 'Move up' }).last().click();
    await page.waitForTimeout(500); // Prompt reorder animation

    await page.getByRole('button', { name: 'Move down' }).first().click();
    await page.waitForTimeout(500); // Prompt reorder animation

    await page.getByRole('button', { name: /remove/i }).last().click();

    await expect(page.getByText('Prompt #1')).toBeVisible();
    await expect(page.getByText('Prompt #2')).not.toBeVisible();

    await discardChanges(page);
  });

  test('add and remove system message', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    const addBtn = page.getByRole('button', { name: /add system message/i });
    const systemSection = page.locator(SYSTEM_MESSAGE_SECTION);

    if (await addBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await addBtn.click();
    }

    await expect(systemSection).toBeVisible({ timeout: 3_000 });

    const sysEditor = systemMsgEditor(page);
    await sysEditor.click();
    await sysEditor.pressSequentially('You are an AI assistant.', { delay: 10 });
    await page.waitForTimeout(500); // Debounce settle

    // Remove system message via X button
    await systemSection.locator('button').filter({ has: page.locator('.lucide-x') }).click();

    await expect(addBtn).toBeVisible({ timeout: 3_000 });

    await discardChanges(page);
  });

  test('add and remove tags', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    await page.getByRole('tab', { name: /details/i }).click();
    await expect(page.getByText('Tags')).toBeVisible({ timeout: 3_000 });

    const tagInput = page.getByPlaceholder('Add tag...');
    await tagInput.fill('e2e-test');
    await tagInput.press('Enter');
    await expect(page.locator('.flex-wrap').getByText('e2e-test')).toBeVisible({ timeout: 3_000 });

    await tagInput.fill('documentation');
    await tagInput.press('Enter');
    await expect(page.locator('.flex-wrap').getByText('documentation')).toBeVisible({
      timeout: 3_000,
    });

    // Remove first tag
    const tagBadges = page.locator('.flex-wrap > div');
    const e2eTagBadge = tagBadges.filter({ hasText: 'e2e-test' }).first();
    await e2eTagBadge.locator('button').click();

    await expect(page.locator('.flex-wrap').getByText('e2e-test')).not.toBeVisible({
      timeout: 3_000,
    });
    await expect(page.locator('.flex-wrap').getByText('documentation')).toBeVisible();
  });

  test('toggle favorite', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    // Dismiss first-use hint if visible
    const dismissHint = page.getByRole('button', { name: /dismiss hint/i });
    if (await dismissHint.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await dismissHint.click();
      await page.waitForTimeout(300); // Hint dismiss animation
    }

    const favoriteBtn = page.getByRole('button', { name: /add to favorites/i });
    await favoriteBtn.click({ force: true });

    await expect(page.getByRole('button', { name: /remove from favorites/i })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('button', { name: /remove from favorites/i }).click({ force: true });
    await expect(page.getByRole('button', { name: /add to favorites/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});
