import { test, expect } from './fixtures';
import { loginViaUI, waitForAppShell, expectToast } from './helpers/pages';

/**
 * Share links and profile management: create share, view public, revoke,
 * edit profile, logout.
 *
 * Uses the editor account. The entry must be published (done in spec 06).
 */

// Track the share link URL across tests
let shareUrl: string;

test.describe('Sharing & Profile', () => {
  test.describe.configure({ mode: 'serial' });

  test('create a share link for a published entry', async ({ editorPage: page }) => {
    // Navigate to the library and open a published entry
    await page.goto('/library');
    await page.waitForLoadState('networkidle');

    await page.getByText('E2E Test Entry v2', { exact: true }).first().click();
    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });

    await page.waitForTimeout(1_000); // Actions panel load

    // Open share dialog from the Actions tab
    const shareBtn = page.getByRole('button', { name: /share link/i });
    await expect(shareBtn).toBeVisible({ timeout: 5_000 });
    await shareBtn.click();

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });

    await dialog.getByRole('button', { name: /create share link/i }).click();

    const linkInput = dialog.locator('input[readonly]').first();
    await expect(linkInput).toBeVisible({ timeout: 15_000 });

    shareUrl = await linkInput.inputValue();
    expect(shareUrl).toContain('/share/');

    const doneBtn = dialog.getByRole('button', { name: /done/i });
    if (await doneBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await doneBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });

  test('view shared entry as unauthenticated user', async ({ browser }) => {
    // Create a fresh context with NO auth
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(shareUrl);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/prompt/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/shared via clarive/i)).toBeVisible({ timeout: 5_000 });

    await context.close();
  });

  test('revoke share link', async ({ editorPage: page }) => {
    await page.goto('/library');
    await page.waitForLoadState('networkidle');

    await page.getByText('E2E Test Entry v2', { exact: true }).first().click();
    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });
    await page.waitForTimeout(1_000);

    const shareBtn = page.getByRole('button', { name: /share link|manage share/i });
    await shareBtn.click();

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });

    await dialog.getByRole('button', { name: /revoke/i }).click();

    const confirmDialog = page.getByRole('alertdialog');
    if (await confirmDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmDialog.getByRole('button', { name: /revoke|confirm|yes/i }).click();
    }

    await expect(dialog.getByRole('button', { name: /create share link/i })).toBeVisible({
      timeout: 5_000,
    });

    await page.keyboard.press('Escape');
  });

  test('edit profile name', async ({ editorPage: page }) => {
    await page.goto('/settings?tab=profile');
    await page.waitForLoadState('networkidle');

    const nameInput = page.getByPlaceholder('Your name');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });

    const originalName = await nameInput.inputValue();

    await nameInput.fill('E2E Tester Updated');

    await page.getByRole('button', { name: /save changes/i }).click();

    await expectToast(page, 'Profile updated');

    // Restore original name
    await nameInput.clear();
    await nameInput.fill(originalName);
    await page.waitForTimeout(300); // Debounce settle
    const saveBtn2 = page.getByRole('button', { name: /save changes/i });
    if (await saveBtn2.isEnabled({ timeout: 3_000 }).catch(() => false)) {
      await saveBtn2.click();
      await expectToast(page, 'Profile updated');
    }
  });

  test('logout and re-login', async ({ editorPage: page }) => {
    // Click on user avatar/name in top-right header to open dropdown
    const userMenu = page.locator('header').getByRole('button').last();
    await userMenu.click();

    await page.getByRole('menuitem', { name: /logout/i }).click();

    await page.waitForURL(/\/login/, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 5_000 });

    // Re-login to verify auth still works
    await loginViaUI(page, 'editor@e2e.test', 'E2ETestPassword123!');
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    await expect(page.getByText('Dashboard').first()).toBeVisible({ timeout: 5_000 });

    // Save auth state for future specs
    await page.context().storageState({ path: 'e2e/.auth/editor.json' });
  });
});
