import { test, expect } from '@playwright/test';
import { loginViaUI, waitForAppShell, expectToast } from './helpers/pages';

const EDITOR = {
  email: 'editor@e2e.test',
  password: 'E2ETestPassword123!',
};

const ENTRY_TITLE = 'E2E Test Entry';
const V2_TITLE = 'E2E Test Entry v2';

/** Login, dismiss tour, and navigate to the entry on the dashboard. */
async function loginAndNavigate(page: import('@playwright/test').Page, title: string) {
  await loginViaUI(page, EDITOR.email, EDITOR.password);
  await page.waitForURL(/\/$/, { timeout: 15_000 });
  await waitForAppShell(page);
  await page.getByText(title).first().click();
  await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });
  await expect(page.getByText('Prompt #1')).toBeVisible({ timeout: 5_000 });
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
    await expectToast(page, 'published');

    // Verify badge shows Published v1
    await expect(page.getByText(/published\s+v1/i)).toBeVisible({ timeout: 5_000 });
  });

  test('edit published entry — creates draft notice', async ({ page }) => {
    // Entry list shows the PUBLISHED title
    await loginAndNavigate(page, ENTRY_TITLE);

    // Modify the title to trigger edit notice
    const titleInput = page.locator('input[placeholder="Entry title"]');
    await titleInput.fill(V2_TITLE);

    // Verify the "editing will create a new draft" notice
    await expect(page.getByText(/editing will create a new draft/i)).toBeVisible({ timeout: 3_000 });

    // Save the draft
    await page.getByRole('button', { name: /save draft/i }).click();
    await expectToast(page, 'Draft saved');

    // Badge should show Draft v2
    await expect(page.getByText(/draft\s+v2/i)).toBeVisible({ timeout: 5_000 });
  });

  test('view version history — v1 and v2 visible', async ({ page }) => {
    // Dashboard still shows the PUBLISHED title (v1 title), not draft title
    await loginAndNavigate(page, ENTRY_TITLE);

    // Switch to Versions tab
    await page.getByRole('tab', { name: /versions/i }).click();

    // Verify version history within the version panel
    const versionPanel = page.locator('[data-tour="version-panel"]');
    await expect(versionPanel.getByText('Version History')).toBeVisible({ timeout: 3_000 });
    await expect(versionPanel.getByText('v2')).toBeVisible();
    await expect(versionPanel.getByText('v1')).toBeVisible();
    await expect(versionPanel.getByText('Draft')).toBeVisible();
    await expect(versionPanel.getByText('Published')).toBeVisible();
  });

  test('publish v2 — v1 becomes historical', async ({ page }) => {
    await loginAndNavigate(page, ENTRY_TITLE);

    // Ensure Actions tab
    await page.getByRole('tab', { name: /actions/i }).click();

    // Publish
    await page.getByRole('button', { name: /^publish$/i }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /^publish$/i }).click();
    await expectToast(page, 'published');

    // Badge should show Published v2
    await expect(page.getByText(/published\s+v2/i)).toBeVisible({ timeout: 5_000 });

    // Check versions tab — v1 should now be Historical
    await page.getByRole('tab', { name: /versions/i }).click();
    await expect(page.getByText('Historical')).toBeVisible({ timeout: 3_000 });
  });

  test('view historical version v1 — read-only', async ({ page }) => {
    // After v2 publish, the dashboard now shows V2_TITLE
    await loginAndNavigate(page, V2_TITLE);

    // Switch to Versions tab and click v1
    await page.getByRole('tab', { name: /versions/i }).click();
    await expect(page.getByText('Version History')).toBeVisible({ timeout: 3_000 });

    // Click on v1 in the version timeline
    await page.locator('[data-tour="version-panel"]').getByText('v1').click();

    // Should navigate to /entry/:id/version/1
    await page.waitForURL(/\/entry\/[a-f0-9-]+\/version\/1$/, { timeout: 10_000 });

    // Read-only banner should be visible
    await expect(page.getByText(/viewing v1.*read-only/i)).toBeVisible({ timeout: 5_000 });

    // "Restore as draft" button should be available
    await expect(page.getByRole('button', { name: /restore as draft/i })).toBeVisible();

    // Title input should be disabled (read-only mode)
    const titleInput = page.locator('input[placeholder="Entry title"]');
    await expect(titleInput).toBeDisabled();
  });

  test('restore historical version as draft', async ({ page }) => {
    await loginAndNavigate(page, V2_TITLE);

    await page.getByRole('tab', { name: /versions/i }).click();
    await page.locator('[data-tour="version-panel"]').getByText('v1').click();
    await page.waitForURL(/\/entry\/[a-f0-9-]+\/version\/1$/, { timeout: 10_000 });
    await expect(page.getByText(/viewing v1.*read-only/i)).toBeVisible({ timeout: 5_000 });

    // Click "Restore as draft"
    await page.getByRole('button', { name: /restore as draft/i }).click();

    // Confirm the restore dialog
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await expect(dialog.getByText('Restore this version?')).toBeVisible();
    await dialog.getByRole('button', { name: /restore/i }).click();

    // Should get toast and navigate back to editor
    await expectToast(page, 'restored');
    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });

    // Verify v3 draft exists in the version panel
    await page.getByRole('tab', { name: /versions/i }).click();
    const versionPanel = page.locator('[data-tour="version-panel"]');
    await expect(versionPanel.getByText('v3')).toBeVisible({ timeout: 5_000 });
    await expect(versionPanel.getByText('Draft')).toBeVisible({ timeout: 3_000 });
  });

  test('delete draft — reverts to published v2', async ({ page }) => {
    // Dashboard still shows the PUBLISHED title (V2_TITLE)
    await loginAndNavigate(page, V2_TITLE);

    // Ensure Actions tab
    await page.getByRole('tab', { name: /actions/i }).click();

    // Click "Delete Draft"
    await page.getByRole('button', { name: /delete draft/i }).click();

    // Confirm deletion
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await expect(dialog.getByText('Delete this draft?')).toBeVisible();
    await dialog.getByRole('button', { name: /delete draft/i }).click();

    // Should get toast
    await expectToast(page, 'Draft deleted');

    // Wait for page to reload with published version
    await page.waitForTimeout(1_000);

    // Published v2 should be showing with the v2 title
    await expect(page.getByText(/published\s+v2/i)).toBeVisible({ timeout: 5_000 });
    const titleInput = page.locator('input[placeholder="Entry title"]');
    await expect(titleInput).toHaveValue(V2_TITLE, { timeout: 3_000 });
  });

  test('version diff dialog — compare v1 and v2', async ({ page }) => {
    await loginAndNavigate(page, V2_TITLE);

    // Switch to Versions tab
    await page.getByRole('tab', { name: /versions/i }).click();
    await expect(page.getByText('Version History')).toBeVisible({ timeout: 3_000 });

    // Click "Compare versions" button
    await page.getByRole('button', { name: /compare versions/i }).click();

    // Verify diff dialog opens
    const diffHeading = page.getByRole('heading', { name: 'Compare Versions' });
    await expect(diffHeading).toBeVisible({ timeout: 5_000 });

    // Verify both version selectors and title diff section
    await expect(page.getByText('Left (old)')).toBeVisible();
    await expect(page.getByText('Right (new)')).toBeVisible();

    // Close the dialog
    await page.keyboard.press('Escape');
    await expect(diffHeading).not.toBeVisible({ timeout: 3_000 });
  });
});
