import { test, expect } from '@playwright/test';
import { loginViaUI, waitForAppShell, expectToast } from './helpers/pages';

const EDITOR = {
  email: 'editor@e2e.test',
  password: 'E2ETestPassword123!',
};

const ENTRY_TITLE = 'E2E Test Entry';
const V2_TITLE = 'E2E Test Entry v2';

// Captured in first test, used by subsequent tests to avoid dashboard title lookup
let entryUrl: string;

/** Login and navigate to the entry (by URL if available, otherwise by dashboard title). */
async function loginAndNavigate(page: import('@playwright/test').Page, title: string) {
  await loginViaUI(page, EDITOR.email, EDITOR.password);
  await page.waitForURL(/\/$/, { timeout: 15_000 });
  await waitForAppShell(page);

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

  test('publish entry as v1', async ({ page }) => {
    await loginAndNavigate(page, ENTRY_TITLE);

    // Ensure Actions tab
    await page.getByRole('tab', { name: /actions/i }).click();

    // Click Publish
    await page.getByRole('button', { name: /^publish$/i }).click();

    // Confirm publish dialog
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await expect(dialog.getByText('Publish this entry?')).toBeVisible();
    await dialog.getByRole('button', { name: /^publish$/i }).click();

    // Verify toast
    await expectToast(page, 'Published');

    // Verify badge shows Published
    await expect(page.getByText(/published/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('edit published entry — save updates tab', async ({ page }) => {
    await loginAndNavigate(page, ENTRY_TITLE);

    // Modify the title — clear first, then type to ensure React onChange fires
    const titleInput = page.locator('input[placeholder="Entry title"]');
    await titleInput.click();
    await titleInput.fill('');
    await titleInput.pressSequentially(V2_TITLE, { delay: 10 });

    // Wait for local state to sync before saving
    await page.waitForTimeout(500);

    // Save — tabs are always editable, no draft ceremony
    await page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(page, 'Saved');

    // Verify title persisted by reloading
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(titleInput).toHaveValue(V2_TITLE, { timeout: 10_000 });
  });

  test('view version history — v1 visible', async ({ page }) => {
    // After publishing v1, navigate to the entry
    await loginAndNavigate(page, V2_TITLE);

    // Switch to Versions tab
    await page.getByRole('tab', { name: /versions/i }).click();

    // Verify version history within the version panel
    const versionPanel = page.locator('[data-tour="version-panel"]');
    await expect(versionPanel.getByText('Version History')).toBeVisible({ timeout: 3_000 });
    await expect(versionPanel.getByText('v1')).toBeVisible();
    await expect(versionPanel.getByText('Published')).toBeVisible();
  });

  test('publish v2 — v1 becomes historical', async ({ page }) => {
    await loginAndNavigate(page, V2_TITLE);

    // Ensure Actions tab
    await page.getByRole('tab', { name: /actions/i }).click();

    // Publish
    await page.getByRole('button', { name: /^publish$/i }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /^publish$/i }).click();
    await expectToast(page, 'Published');

    // Check versions tab — v1 should now be Historical
    await page.getByRole('tab', { name: /versions/i }).click();
    await expect(page.getByText('Historical')).toBeVisible({ timeout: 3_000 });
  });

  test('view historical version v1 — read-only', async ({ page }) => {
    await loginAndNavigate(page, V2_TITLE);

    // Switch to Versions tab and click v1
    await page.getByRole('tab', { name: /versions/i }).click();
    await expect(page.getByRole('heading', { name: 'Version History' })).toBeVisible({ timeout: 3_000 });

    // Click on v1 in the version timeline
    await page.locator('[data-tour="version-panel"]').getByText('v1').click();

    // Should navigate to /entry/:id/version/1
    await page.waitForURL(/\/entry\/[a-f0-9-]+\/version\/1$/, { timeout: 10_000 });

    // Read-only banner should be visible
    await expect(page.getByText(/viewing v1.*read-only/i)).toBeVisible({ timeout: 5_000 });

    // "Restore to tab" button should be available
    await expect(page.getByRole('button', { name: /restore to tab/i })).toBeVisible();

    // Title input should be disabled (read-only mode)
    const titleInput = page.locator('input[placeholder="Entry title"]');
    await expect(titleInput).toBeDisabled();
  });

  test('version diff dialog — compare v1 and v2', async ({ page }) => {
    await loginAndNavigate(page, V2_TITLE);

    // Switch to Versions tab
    await page.getByRole('tab', { name: /versions/i }).click();
    await expect(page.getByRole('heading', { name: 'Version History' })).toBeVisible({ timeout: 3_000 });

    // Click "Compare versions" button
    await page.getByRole('button', { name: /compare versions/i }).click();

    // Verify diff dialog opens
    const diffHeading = page.getByRole('heading', { name: 'Compare Versions' });
    await expect(diffHeading).toBeVisible({ timeout: 5_000 });

    // Verify both version selectors and title diff section
    await expect(page.getByText('Left (old)')).toBeVisible();
    await expect(page.getByText('Right (new)')).toBeVisible();

    // Close the dialog via the X button (Escape doesn't reliably close Radix dialogs)
    const closeBtn = page.getByRole('dialog').getByRole('button', { name: /close/i });
    if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      // Fallback: press Escape twice (Radix sometimes needs it)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
    }
    await expect(diffHeading).not.toBeVisible({ timeout: 5_000 });
  });
});
