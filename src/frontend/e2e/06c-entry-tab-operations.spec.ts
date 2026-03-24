import { test, expect, Page } from '@playwright/test';
import { loginViaUI, waitForAppShell, expectToast } from './helpers/pages';

/**
 * Tab-Scoped Operations tests: save and publish.
 *
 * Prerequisites:
 * - Spec 06 published v1/v2 of "E2E Test Entry v2"
 * - Spec 06b created/deleted tabs (entry should have only Main tab + Published)
 *
 * AI tests are in 13b-entry-tab-ai.spec.ts (runs after spec 13).
 * Collaboration tests are in 12b-entry-tab-collaboration.spec.ts (runs after spec 11).
 */

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


