import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { loginViaUI, waitForAppShell, expectToast } from './helpers/pages';
import { radixClick } from './helpers/radix';

/**
 * Tab-Scoped Operations tests: save, publish, AI tools, and collaboration.
 *
 * Prerequisites:
 * - Spec 06 published v1/v2 of "E2E Test Entry v2"
 * - Spec 06b created/deleted tabs (entry should have only Main tab + Published)
 * - Specs 02 + 13 configured AI providers (for AI tests)
 * - Spec 11 invited editor into admin's workspace (for collaboration tests)
 */

const ADMIN = { email: 'admin@e2e.test', password: 'E2ETestPassword123!' };
const EDITOR = { email: 'editor@e2e.test', password: 'E2ETestPassword123!' };
const ENTRY_TITLE = 'E2E Test Entry v2';
const TAB_C_NAME = 'Tab C';

/** Login as editor and navigate to the entry. */
async function loginAndNavigate(page: Page) {
  await loginViaUI(page, EDITOR.email, EDITOR.password);
  await page.waitForURL(/\/$/, { timeout: 15_000 });
  await waitForAppShell(page);
  await page.getByText(ENTRY_TITLE).first().click();
  await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });
  await expect(page.getByText('Prompt #1')).toBeVisible({ timeout: 5_000 });
}

/** Create Tab C forked from the published version (skips if already exists). */
async function createTabC(page: Page) {
  // Skip if Tab C already exists
  if (await page.getByText(TAB_C_NAME).isVisible({ timeout: 1_000 }).catch(() => false)) {
    return;
  }

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
  await expect(page.getByText(TAB_C_NAME)).toBeVisible({ timeout: 5_000 });
}

/** Delete Tab C to clean up. */
async function deleteTabC(page: Page) {
  // Switch to Tab C if not already on it
  if (await page.getByText(TAB_C_NAME).isVisible().catch(() => false)) {
    await page.getByText(TAB_C_NAME).hover();
    await page.waitForTimeout(300);
    const tabButton = page.locator('button', { hasText: TAB_C_NAME });
    const deleteBtn = tabButton
      .locator('[role="button"]')
      .filter({ has: page.locator('.lucide-x') });
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
      await expectToast(page, 'Tab deleted');
    }
  }
}

// ════════════════════════════════════════════════════════════════
// Phase 1: Tab-Scoped Save & Publish
// ════════════════════════════════════════════════════════════════

test.describe('Tab-Scoped Save & Publish', () => {
  test.describe.configure({ mode: 'serial' });

  test('save on Tab C does not affect Main tab', async ({ page }) => {
    await loginAndNavigate(page);
    await createTabC(page);

    // Get Main tab content for comparison
    await page.getByText('Main', { exact: true }).click();
    await page.waitForTimeout(500);
    const mainTitleBefore = await page.locator('input[placeholder="Entry title"]').inputValue();

    // Switch to Tab C and edit
    await page.getByText(TAB_C_NAME).click();
    await page.waitForTimeout(500);

    const editor = page.locator('.tiptap').last();
    await editor.click();
    await editor.pressSequentially(' — Tab C scoped edit', { delay: 10 });
    await page.waitForTimeout(300);

    // Save Tab C
    await page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(page, 'Saved');

    // Verify dirty indicator cleared
    await expect(page.getByText('Unsaved changes')).not.toBeVisible({ timeout: 5_000 });

    // Switch to Main — title and content should be unchanged
    await page.getByText('Main', { exact: true }).click();
    await page.waitForTimeout(500);

    const mainTitleAfter = await page.locator('input[placeholder="Entry title"]').inputValue();
    expect(mainTitleAfter).toBe(mainTitleBefore);

    const mainContent = await page.locator('.tiptap').last().textContent();
    expect(mainContent).not.toContain('Tab C scoped edit');
  });

  test('save on Main tab does not affect Tab C', async ({ page }) => {
    await loginAndNavigate(page);

    // Ensure Tab C exists
    await expect(page.getByText(TAB_C_NAME)).toBeVisible({ timeout: 5_000 });

    // Get Tab C content
    await page.getByText(TAB_C_NAME).click();
    await page.waitForTimeout(500);
    const tabCContent = await page.locator('.tiptap').last().textContent();

    // Switch to Main and edit title
    await page.getByText('Main', { exact: true }).click();
    await page.waitForTimeout(500);

    const titleInput = page.locator('input[placeholder="Entry title"]');
    const originalTitle = await titleInput.inputValue();
    await titleInput.fill('Main Save Test');

    // Save Main
    await page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(page, 'Saved');

    // Switch to Tab C — content should be unchanged
    await page.getByText(TAB_C_NAME).click();
    await page.waitForTimeout(500);

    const tabCContentAfter = await page.locator('.tiptap').last().textContent();
    expect(tabCContentAfter).toBe(tabCContent);

    // Restore original title on Main
    await page.getByText('Main', { exact: true }).click();
    await page.waitForTimeout(500);
    await titleInput.fill(originalTitle);
    await page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(page, 'Saved');
  });

  test('publish from active tab shows correct content in Published view', async ({ page }) => {
    await loginAndNavigate(page);

    // Switch to Actions tab and publish (from Main tab)
    await page.getByRole('tab', { name: /actions/i }).click();
    await page.getByRole('button', { name: /^publish$/i }).click();

    // Confirm publish dialog
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /^publish$/i }).click();
    await expectToast(page, 'Published');

    // Wait for toast to disappear before clicking Published tab
    await page.waitForTimeout(2_000);

    // Click Published tab — should show read-only content
    // Use locator that targets the tab bar Published button (has Eye icon)
    const publishedTab = page.locator('button', { hasText: 'Published' }).filter({ has: page.locator('.lucide-eye') });
    await publishedTab.click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/read-only mode/i)).toBeVisible({
      timeout: 5_000,
    });

    // Switch back to Tab C — should still be editable
    await page.getByText(TAB_C_NAME).click();
    await page.waitForTimeout(500);
    const titleInput = page.locator('input[placeholder="Entry title"]');
    await expect(titleInput).toBeEnabled({ timeout: 3_000 });

    // Clean up Tab C for downstream specs
    await deleteTabC(page);
  });
});

// ════════════════════════════════════════════════════════════════
// Phase 2: Tab-Scoped AI Tools
// ════════════════════════════════════════════════════════════════

test.describe('Tab-Scoped AI Tools', () => {
  test.skip(!process.env.GROQ_API_KEY, 'GROQ_API_KEY required');
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test('generate system message on tab only affects that tab', async ({ page }) => {
    await loginAndNavigate(page);

    // Check if Main has a system message already
    const mainHasSystemMsg =
      await page.locator('[data-tour="system-message"]').isVisible().catch(() => false);

    // Create Tab C for this test
    await createTabC(page);

    // Ensure we're on Tab C
    await page.getByText(TAB_C_NAME).click();
    await page.waitForTimeout(500);

    // Ensure Tab C has no system message (remove if present)
    const sysMsgSection = page.locator('[data-tour="system-message"]');
    if (await sysMsgSection.isVisible().catch(() => false)) {
      await sysMsgSection.locator('button').filter({ has: page.locator('.lucide-x') }).click();
      await page.waitForTimeout(300);
    }

    // Navigate to Actions tab and click Generate System Message
    await page.getByRole('tab', { name: /actions/i }).click();
    await page.waitForTimeout(500);

    const generateBtn = page.getByRole('button', { name: /generate system message/i });
    await expect(generateBtn).toBeVisible({ timeout: 5_000 });
    await generateBtn.click();

    // Wait for generation to complete — button text changes to "Generating…"
    // then system message section appears
    await expect(page.locator('[data-tour="system-message"]')).toBeVisible({ timeout: 60_000 });

    // Verify system message has content
    const systemEditor = page.locator('[data-tour="system-message"] .tiptap');
    await expect(systemEditor).toBeVisible({ timeout: 5_000 });
    const systemMsgContent = await systemEditor.textContent();
    expect(systemMsgContent!.length).toBeGreaterThan(0);

    // Save Tab C with the generated system message
    await page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(page, 'Saved');

    // Switch to Main tab — system message state should be unchanged
    await page.getByText('Main', { exact: true }).click();
    await page.waitForTimeout(500);

    const mainSysMsgNow =
      await page.locator('[data-tour="system-message"]').isVisible().catch(() => false);
    expect(mainSysMsgNow).toBe(mainHasSystemMsg);

    // Clean up Tab C
    await deleteTabC(page);
  });
});

// ════════════════════════════════════════════════════════════════
// Phase 3: Multi-User Tab Collaboration
// ════════════════════════════════════════════════════════════════

test.describe('Multi-User Tab Collaboration', () => {
  // These tests require workspace sharing (spec 11) which can't be included in the
  // snapshot without side effects. Run as part of the full suite only.
  test.skip(true, 'Requires workspace sharing from spec 11 — run full suite');
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  // Shared entry URL — captured once, reused by collaboration tests
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

  test('capture entry URL for collaboration tests', async ({ page }) => {
    await loginAndNavigate(page);
    entryUrl = new URL(page.url()).pathname;

    // Also ensure Tab C exists for cross-tab test
    await createTabC(page);
  });

  test('two users editing different tabs — no conflict', async ({ browser }) => {
    // Admin opens entry on Main tab
    const admin = await openEntryAs(browser, ADMIN);
    await admin.page.waitForTimeout(1_000);

    // Editor opens entry and switches to Tab C
    const editor = await openEntryAs(browser, EDITOR);
    await editor.page.waitForTimeout(1_000);

    // Override soft lock if present for editor
    const editAnywayBtn = editor.page.getByRole('button', { name: /edit anyway/i });
    if (await editAnywayBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await radixClick(editAnywayBtn);
      const alertDialog = editor.page.getByRole('alertdialog');
      await alertDialog.waitFor({ state: 'visible' });
      await radixClick(alertDialog.getByRole('button', { name: /edit anyway/i }));
      await editor.page.waitForTimeout(500);
    }

    // Editor switches to Tab C
    await editor.page.getByText(TAB_C_NAME).click();
    await editor.page.waitForTimeout(500);

    // Admin edits Main tab title
    await admin.page.locator('input[placeholder="Entry title"]').fill('Admin Cross-Tab Edit');
    await admin.page.waitForTimeout(300);
    await admin.page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(admin.page, 'Saved');

    // Editor edits Tab C content
    const editorEditor = editor.page.locator('.tiptap').last();
    await editorEditor.click();
    await editorEditor.pressSequentially(' — editor cross-tab edit', { delay: 10 });
    await editor.page.waitForTimeout(300);

    // Editor saves Tab C — should NOT trigger conflict (different tabs)
    await editor.page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(editor.page, 'Saved');

    // Verify no conflict overlay appeared
    await expect(editor.page.getByText('Resolve conflict')).not.toBeVisible({ timeout: 3_000 });

    // Restore admin's title
    await admin.page.locator('input[placeholder="Entry title"]').fill(ENTRY_TITLE);
    await admin.page.waitForTimeout(300);
    await admin.page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(admin.page, 'Saved');

    await admin.context.close();
    await editor.context.close();
  });

  test('two users editing same tab — conflict triggers', async ({ browser }) => {
    // Both open entry on Main tab
    const admin = await openEntryAs(browser, ADMIN);
    const editor = await openEntryAs(browser, EDITOR);
    await editor.page.waitForTimeout(2_000);

    // Override soft lock if present for editor
    const editAnywayBtn = editor.page.getByRole('button', { name: /edit anyway/i });
    if (await editAnywayBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await radixClick(editAnywayBtn);
      const alertDialog = editor.page.getByRole('alertdialog');
      await alertDialog.waitFor({ state: 'visible' });
      await radixClick(alertDialog.getByRole('button', { name: /edit anyway/i }));
      await editor.page.waitForTimeout(500);
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

  test('clean up Tab C after collaboration tests', async ({ page }) => {
    await loginAndNavigate(page);
    await deleteTabC(page);
  });
});
