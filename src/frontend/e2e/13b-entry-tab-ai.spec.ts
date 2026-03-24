import { test, expect } from './fixtures';
import { createTab, deleteTab, switchTab } from './helpers/tabs';
import { saveEntry } from './helpers/entry-actions';
import { SYSTEM_MESSAGE_SECTION } from './helpers/locators';
import { createEntryViaAPI, publishEntryViaAPI } from './helpers/api';

/**
 * Tab-scoped AI tools test: verifies AI operations only affect the active tab.
 *
 * Prerequisites:
 * - Spec 13 configured AI models via Quick Setup
 */

const ENTRY_TITLE = 'AI Tab Test Entry';
const TAB_C_NAME = 'Tab C';

test.describe('Tab-Scoped AI Tools', () => {
  test.skip(!process.env.GROQ_API_KEY, 'GROQ_API_KEY required');
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test('generate system message on tab only affects that tab', async ({ editorPage: page }) => {
    // Create entry via API in the current workspace (editor is in admin's workspace after spec 11)
    const { entryId, tabId } = await createEntryViaAPI(page, {
      title: ENTRY_TITLE,
      content: 'Write a clear explanation of quantum computing.',
    });
    await publishEntryViaAPI(page, entryId, tabId);
    await page.goto(`/entry/${entryId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Prompt #1')).toBeVisible({ timeout: 10_000 });

    // Check if Main has a system message already
    const mainHasSystemMsg = await page
      .locator(SYSTEM_MESSAGE_SECTION)
      .isVisible()
      .catch(() => false);

    // Create Tab C for this test
    await createTab(page, TAB_C_NAME);

    // Ensure we're on Tab C
    await switchTab(page, TAB_C_NAME);

    // Ensure Tab C has no system message (remove if present)
    const sysMsgSection = page.locator(SYSTEM_MESSAGE_SECTION);
    if (await sysMsgSection.isVisible().catch(() => false)) {
      await sysMsgSection.locator('button').filter({ has: page.locator('.lucide-x') }).click();
      await page.waitForTimeout(300); // System message removal animation
    }

    // Navigate to Actions tab and click Generate System Message
    await page.getByRole('tab', { name: /actions/i }).click();

    const generateBtn = page.getByRole('button', { name: /generate system message/i });
    await expect(generateBtn).toBeVisible({ timeout: 5_000 });
    await generateBtn.click();

    // Wait for generation to complete
    await expect(page.locator(SYSTEM_MESSAGE_SECTION)).toBeVisible({ timeout: 60_000 });

    // Verify system message has content
    const systemEditor = page.locator(`${SYSTEM_MESSAGE_SECTION} .tiptap`);
    await expect(systemEditor).toBeVisible({ timeout: 5_000 });
    const systemMsgContent = await systemEditor.textContent();
    expect(systemMsgContent!.length).toBeGreaterThan(0);

    // Save Tab C with the generated system message
    await saveEntry(page);

    // Switch to Main tab — system message state should be unchanged
    await switchTab(page, 'Main');

    const mainSysMsgNow = await page
      .locator(SYSTEM_MESSAGE_SECTION)
      .isVisible()
      .catch(() => false);
    expect(mainSysMsgNow).toBe(mainHasSystemMsg);

    // Clean up Tab C
    await deleteTab(page, TAB_C_NAME);
  });
});
