import { test, expect } from './fixtures';
import { navigateToEntry, expectToast } from './helpers/pages';
import { createTab, deleteTab, switchTab } from './helpers/tabs';
import { saveEntry } from './helpers/entry-actions';
import { promptEditor, titleInput, ENTRY_TITLE_INPUT } from './helpers/locators';

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

const ENTRY_TITLE = 'E2E Test Entry v2';
const TAB_C_NAME = 'Tab C';

// ════════════════════════════════════════════════════════════════
// Phase 1: Tab-Scoped Save & Publish
// ════════════════════════════════════════════════════════════════

test.describe('Tab-Scoped Save & Publish', () => {
  test.describe.configure({ mode: 'serial' });

  test('save on Tab C does not affect Main tab', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);
    await createTab(page, TAB_C_NAME);

    // Get Main tab content for comparison
    await switchTab(page, 'Main');
    const mainTitleBefore = await titleInput(page).inputValue();

    // Switch to Tab C and edit
    await switchTab(page, TAB_C_NAME);

    const editor = promptEditor(page);
    await editor.click();
    await editor.pressSequentially(' — Tab C scoped edit', { delay: 10 });
    await page.waitForTimeout(300); // Debounce settle

    // Save Tab C
    await saveEntry(page);

    // Verify dirty indicator cleared
    await expect(page.getByText('Unsaved changes')).not.toBeVisible({ timeout: 5_000 });

    // Switch to Main — title and content should be unchanged
    await switchTab(page, 'Main');

    const mainTitleAfter = await titleInput(page).inputValue();
    expect(mainTitleAfter).toBe(mainTitleBefore);

    const mainContent = await promptEditor(page).textContent();
    expect(mainContent).not.toContain('Tab C scoped edit');
  });

  test('save on Main tab does not affect Tab C', async ({ editorPage: page }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    // Ensure Tab C exists
    await expect(page.getByText(TAB_C_NAME)).toBeVisible({ timeout: 5_000 });

    // Get Tab C content
    await switchTab(page, TAB_C_NAME);
    const tabCContent = await promptEditor(page).textContent();

    // Switch to Main and edit title
    await switchTab(page, 'Main');

    const title = titleInput(page);
    const originalTitle = await title.inputValue();
    await title.fill('Main Save Test');

    // Save Main
    await saveEntry(page);

    // Switch to Tab C — content should be unchanged
    await switchTab(page, TAB_C_NAME);

    const tabCContentAfter = await promptEditor(page).textContent();
    expect(tabCContentAfter).toBe(tabCContent);

    // Restore original title on Main
    await switchTab(page, 'Main');
    await title.fill(originalTitle);
    await saveEntry(page);
  });

  test('publish from active tab shows correct content in Published view', async ({
    editorPage: page,
  }) => {
    await navigateToEntry(page, ENTRY_TITLE);

    // Switch to Actions tab and publish (from Main tab)
    await page.getByRole('tab', { name: /actions/i }).click();
    await page.getByRole('button', { name: /^publish$/i }).click();

    // Confirm publish dialog
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /^publish$/i }).click();
    await expectToast(page, 'Published');

    await page.waitForTimeout(2_000); // Toast dismiss before clicking Published tab

    // Click Published tab — should show read-only content
    const publishedTab = page
      .locator('button', { hasText: 'Published' })
      .filter({ has: page.locator('.lucide-eye') });
    await publishedTab.click();
    await expect(page.getByText(/read-only mode/i)).toBeVisible({ timeout: 5_000 });

    // Switch back to Tab C — should still be editable
    await switchTab(page, TAB_C_NAME);
    await expect(page.locator(ENTRY_TITLE_INPUT)).toBeEnabled({ timeout: 3_000 });

    // Clean up Tab C for downstream specs
    await deleteTab(page, TAB_C_NAME);
  });
});
