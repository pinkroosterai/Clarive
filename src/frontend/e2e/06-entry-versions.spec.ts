import { test, expect, EDITOR } from './fixtures';
import { navigateToEntry, expectToast } from './helpers/pages';
import { publishEntry } from './helpers/entry-actions';
import { titleInput, VERSION_PANEL } from './helpers/locators';

const ENTRY_TITLE = 'E2E Test Entry';
const V2_TITLE = 'E2E Test Entry v2';

// Captured in first test, used by subsequent tests to avoid dashboard title lookup
let entryUrl: string;

/** Navigate to the entry (by URL if available, otherwise by dashboard title). */
async function goToEntry(page: import('@playwright/test').Page, title: string) {
  if (entryUrl) {
    await page.goto(entryUrl);
    await page.waitForLoadState('networkidle');
  } else {
    await page.getByText(title).first().click();
    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });
    entryUrl = new URL(page.url()).pathname;
  }
  await expect(page.getByText('Prompt #1').first()).toBeVisible({ timeout: 5_000 });
}

test.describe('Entry Versioning & History', () => {
  test.describe.configure({ mode: 'serial' });

  test('publish entry as v1', async ({ editorPage: page }) => {
    await goToEntry(page, ENTRY_TITLE);
    await publishEntry(page);

    // Verify badge shows Published
    await expect(page.getByText(/published/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('edit published entry — save updates tab', async ({ editorPage: page }) => {
    await goToEntry(page, ENTRY_TITLE);

    const title = titleInput(page);
    await title.click();
    await title.fill('');
    await title.pressSequentially(V2_TITLE, { delay: 10 });

    await page.waitForTimeout(500); // Debounce settle before save

    await page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(page, 'Saved');

    // Verify title persisted by reloading
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(title).toHaveValue(V2_TITLE, { timeout: 10_000 });
  });

  test('view version history — v1 visible', async ({ editorPage: page }) => {
    await goToEntry(page, V2_TITLE);

    await page.getByRole('tab', { name: /versions/i }).click();

    const versionPanel = page.locator(VERSION_PANEL);
    await expect(versionPanel.getByText('Version History')).toBeVisible({ timeout: 3_000 });
    await expect(versionPanel.getByText('v1')).toBeVisible();
    await expect(versionPanel.getByText('Published')).toBeVisible();
  });

  test('publish v2 — v1 becomes historical', async ({ editorPage: page }) => {
    await goToEntry(page, V2_TITLE);
    await publishEntry(page);

    // Check versions tab — v1 should now be Historical
    await page.getByRole('tab', { name: /versions/i }).click();
    await expect(page.getByText('Historical')).toBeVisible({ timeout: 3_000 });
  });

  test('view historical version v1 — read-only', async ({ editorPage: page }) => {
    await goToEntry(page, V2_TITLE);

    await page.getByRole('tab', { name: /versions/i }).click();
    await expect(page.getByRole('heading', { name: 'Version History' })).toBeVisible({
      timeout: 3_000,
    });

    await page.locator(VERSION_PANEL).getByText('v1').click();

    await page.waitForURL(/\/entry\/[a-f0-9-]+\/version\/1$/, { timeout: 10_000 });
    await expect(page.getByText(/viewing v1.*read-only/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /restore to tab/i })).toBeVisible();
    await expect(titleInput(page)).toBeDisabled();
  });

  test('version diff dialog — compare v1 and v2', async ({ editorPage: page }) => {
    await goToEntry(page, V2_TITLE);

    await page.getByRole('tab', { name: /versions/i }).click();
    await expect(page.getByRole('heading', { name: 'Version History' })).toBeVisible({
      timeout: 3_000,
    });

    await page.getByRole('button', { name: /compare versions/i }).click();

    const diffHeading = page.getByRole('heading', { name: 'Compare Versions' });
    await expect(diffHeading).toBeVisible({ timeout: 5_000 });

    await expect(page.getByText('Left (old)')).toBeVisible();
    await expect(page.getByText('Right (new)')).toBeVisible();

    // Close the dialog
    const closeBtn = page.getByRole('dialog').getByRole('button', { name: /close/i });
    if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300); // Radix dialog close animation
      await page.keyboard.press('Escape');
    }
    await expect(diffHeading).not.toBeVisible({ timeout: 5_000 });
  });
});
