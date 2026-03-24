import { test, expect, Page } from '@playwright/test';
import { loginViaUI, waitForAppShell, expectToast } from './helpers/pages';

/**
 * Tab-scoped AI tools test: verifies AI operations only affect the active tab.
 *
 * Prerequisites:
 * - Spec 06 published v1/v2 of "E2E Test Entry v2"
 * - Spec 13 configured AI models via Quick Setup
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

    // Wait for generation to complete
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
