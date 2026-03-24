import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { loginViaUI, waitForAppShell, expectToast } from './helpers/pages';
import { radixClick } from './helpers/radix';

/**
 * Multi-user tab collaboration tests: editing different tabs (no conflict)
 * and editing the same tab (conflict triggers).
 *
 * Prerequisite: spec 11 invited the editor into the admin's workspace.
 * Both users share the same workspace so they can view the same entries.
 */

const ADMIN = { email: 'admin@e2e.test', password: 'E2ETestPassword123!' };
const EDITOR = { email: 'editor@e2e.test', password: 'E2ETestPassword123!' };
const ENTRY_TITLE = 'Collab Tabs Entry';
const TAB_C_NAME = 'Tab C';

// Shared entry URL — set by the first test, used by subsequent tests
let entryUrl: string;

/** Open the entry as a specific user in a new browser context. */
async function openEntryAs(
  browser: Browser,
  user: { email: string; password: string }
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginViaUI(page, user.email, user.password);
  await page.waitForURL(/\/$/, { timeout: 15_000 });

  // Complete onboarding to prevent tour
  await page.evaluate(() =>
    fetch('/api/profile/complete-onboarding', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('cl_token')}` },
    })
  );

  await waitForAppShell(page);

  const tourClose = page.locator('.driver-popover-close-btn');
  if (await tourClose.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await tourClose.click();
    await page.waitForTimeout(500);
  }

  await page.goto(entryUrl);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('input[placeholder="Entry title"]')).toBeVisible({
    timeout: 10_000,
  });

  return { context, page };
}

test.describe('Multi-User Tab Collaboration', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  test('create entry with Tab C for tab collaboration tests', async ({ page }) => {
    // Login as admin (shared workspace owner)
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Complete onboarding to prevent tour
    await page.evaluate(() =>
      fetch('/api/profile/complete-onboarding', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('cl_token')}` },
      })
    );
    const tourClose = page.locator('.driver-popover-close-btn');
    if (await tourClose.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await tourClose.click();
      await page.waitForTimeout(500);
    }

    // Create a new entry in the shared workspace
    await page.goto('/entry/new');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Create New Entry')).toBeVisible({ timeout: 10_000 });
    await page.getByLabel('Title').fill(ENTRY_TITLE);
    await page.getByRole('button', { name: 'Create Entry' }).click();
    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });

    // Add prompt content
    const tiptapEditor = page.locator('.tiptap').first();
    await tiptapEditor.click();
    await tiptapEditor.pressSequentially('Tab collaboration test prompt.', { delay: 10 });
    await page.waitForTimeout(500);

    // Save
    await page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(page, 'Saved');

    // Publish so we can fork a tab from the published version
    await page.getByRole('tab', { name: /actions/i }).click();
    await page.getByRole('button', { name: /^publish$/i }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /^publish$/i }).click();
    await expectToast(page, 'Published');

    // Create Tab C forked from published version
    await page.getByRole('button', { name: /create new tab/i }).click();
    await expect(page.getByRole('heading', { name: 'Create New Tab' })).toBeVisible({
      timeout: 5_000,
    });
    await page.getByLabel('Tab name').fill(TAB_C_NAME);
    const selectTrigger = page.locator('[role="combobox"]');
    await selectTrigger.click();
    const publishedOption = page.getByRole('option').filter({ hasText: 'published' }).first();
    await publishedOption.waitFor({ state: 'visible' });
    await publishedOption.click();
    await page.getByRole('button', { name: /create tab/i }).click();
    await expect(page.getByRole('heading', { name: 'Create New Tab' })).not.toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(TAB_C_NAME, { exact: true })).toBeVisible({ timeout: 5_000 });

    // Capture URL for other tests
    entryUrl = new URL(page.url()).pathname;
  });

  test('two users editing different tabs — no conflict', async ({ browser }) => {
    // Both users open the entry
    const admin = await openEntryAs(browser, ADMIN);
    const editor = await openEntryAs(browser, EDITOR);
    await editor.page.waitForTimeout(2_000);

    // Override soft lock for both users if present
    for (const ctx of [admin, editor]) {
      const editAnywayBtn = ctx.page.getByRole('button', { name: /edit anyway/i });
      if (await editAnywayBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await radixClick(editAnywayBtn);
        const alertDialog = ctx.page.getByRole('alertdialog');
        await alertDialog.waitFor({ state: 'visible' });
        await radixClick(alertDialog.getByRole('button', { name: /edit anyway/i }));
        await ctx.page.waitForTimeout(500);
      }
    }

    // Editor switches to Tab C
    await editor.page.getByText(TAB_C_NAME, { exact: true }).click();
    await editor.page.waitForTimeout(500);

    // Admin edits Main tab prompt content and saves
    const adminEditor = admin.page.locator('.tiptap').last();
    await adminEditor.click();
    await adminEditor.pressSequentially(' — admin main edit', { delay: 10 });
    await admin.page.waitForTimeout(500);
    await admin.page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(admin.page, 'Saved');

    // Editor edits Tab C prompt content and saves
    // With tab-level concurrency, different-tab saves should NOT conflict
    const editorEditor = editor.page.locator('.tiptap').last();
    await editorEditor.click();
    await editorEditor.pressSequentially(' — editor tab-c edit', { delay: 10 });
    await editor.page.waitForTimeout(500);
    await editor.page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(editor.page, 'Saved');

    // Verify no conflict overlay appeared
    await expect(editor.page.getByText('Resolve conflict')).not.toBeVisible({ timeout: 3_000 });

    await admin.context.close();
    await editor.context.close();
  });

  test('two users editing same tab — conflict triggers', async ({ browser }) => {
    // Both open entry on Main tab
    const admin = await openEntryAs(browser, ADMIN);
    const editor = await openEntryAs(browser, EDITOR);
    await editor.page.waitForTimeout(2_000);

    // Override soft lock for both users if present
    for (const ctx of [admin, editor]) {
      const editAnywayBtn = ctx.page.getByRole('button', { name: /edit anyway/i });
      if (await editAnywayBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await radixClick(editAnywayBtn);
        const alertDialog = ctx.page.getByRole('alertdialog');
        await alertDialog.waitFor({ state: 'visible' });
        await radixClick(alertDialog.getByRole('button', { name: /edit anyway/i }));
        await ctx.page.waitForTimeout(500);
      }
    }

    // Admin edits Main title and saves
    await admin.page.locator('input[placeholder="Entry title"]').fill('Admin Same-Tab Title');
    await admin.page.waitForTimeout(300);
    await admin.page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(admin.page, 'Saved');

    // Editor edits Main title and saves — should trigger conflict
    await editor.page.locator('input[placeholder="Entry title"]').fill('Editor Same-Tab Title');
    await editor.page.waitForTimeout(300);
    await editor.page.getByRole('button', { name: /^save$/i }).click();

    // Conflict overlay should appear
    await expect(editor.page.getByText('Resolve conflict')).toBeVisible({ timeout: 10_000 });
    await expect(editor.page.getByText('Your changes')).toBeVisible();
    await expect(editor.page.getByText('Server version')).toBeVisible();

    // Resolve with "Keep mine"
    await editor.page.getByRole('button', { name: /save resolved/i }).click();
    await expectToast(editor.page, 'Conflict resolved');

    // Restore original title
    await editor.page.locator('input[placeholder="Entry title"]').fill(ENTRY_TITLE);
    await editor.page.waitForTimeout(300);
    await editor.page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(editor.page, 'Saved');

    await admin.context.close();
    await editor.context.close();
  });
});
