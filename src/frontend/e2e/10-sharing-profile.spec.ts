import { test, expect } from '@playwright/test';
import { loginViaUI, waitForAppShell, expectToast } from './helpers/pages';

/**
 * Share links and profile management: create share, view public, revoke,
 * edit profile, logout.
 *
 * Uses the editor account. The entry must be published (done in spec 06).
 */

const EDITOR = { email: 'editor@e2e.test', password: 'E2ETestPassword123!' };

// Track the share link URL across tests
let shareUrl: string;

test.describe('Sharing & Profile', () => {
  test.describe.configure({ mode: 'serial' });

  test('create a share link for a published entry', async ({ page }) => {
    await loginViaUI(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Navigate to the library and open a published entry (not the copy from spec 09)
    await page.goto('/library');
    await page.waitForLoadState('networkidle');

    // Click "E2E Test Entry v2" (the original, not the copy)
    // Use exact match to avoid the "(copy)" version
    await page.getByText('E2E Test Entry v2', { exact: true }).first().click();
    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });

    // If this entry is a draft (from the copy), scroll down to check
    // The share button only appears for published entries
    // Wait for the Actions panel to load
    await page.waitForTimeout(1_000);

    // Open share dialog from the Actions tab
    const shareBtn = page.getByRole('button', { name: /share link/i });
    await expect(shareBtn).toBeVisible({ timeout: 5_000 });
    await shareBtn.click();

    // Share dialog should appear
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });

    // Click "Create Share Link"
    await dialog.getByRole('button', { name: /create share link/i }).click();

    // Wait for link to be generated — the input field with the share URL appears
    const linkInput = dialog.locator('input[readonly]').first();
    await expect(linkInput).toBeVisible({ timeout: 15_000 });

    // Extract the share URL
    shareUrl = await linkInput.inputValue();
    expect(shareUrl).toContain('/share/');

    // Close dialog
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

    // Navigate to the share URL
    await page.goto(shareUrl);
    await page.waitForLoadState('networkidle');

    // Should see the entry content (not a login page)
    // Public share page shows the entry title and prompts
    await expect(page.getByText(/prompt/i).first()).toBeVisible({ timeout: 10_000 });

    // Should see "Shared via Clarive" footer
    await expect(page.getByText(/shared via clarive/i)).toBeVisible({ timeout: 5_000 });

    await context.close();
  });

  test('revoke share link', async ({ page }) => {
    await loginViaUI(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Navigate to the same published entry used in the create test
    await page.goto('/library');
    await page.waitForLoadState('networkidle');

    await page.getByText('E2E Test Entry v2', { exact: true }).first().click();
    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });
    await page.waitForTimeout(1_000);

    // Open share dialog — should now say "Manage Share Link"
    const shareBtn = page.getByRole('button', { name: /share link|manage share/i });
    await shareBtn.click();

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });

    // Click "Revoke"
    await dialog.getByRole('button', { name: /revoke/i }).click();

    // Confirm revocation if there's a confirmation dialog
    const confirmDialog = page.getByRole('alertdialog');
    if (await confirmDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmDialog.getByRole('button', { name: /revoke|confirm|yes/i }).click();
    }

    // Verify link is revoked — dialog should show "Create Share Link" again
    await expect(dialog.getByRole('button', { name: /create share link/i })).toBeVisible({
      timeout: 5_000,
    });

    // Close dialog
    await page.keyboard.press('Escape');
  });

  test('edit profile name', async ({ page }) => {
    await loginViaUI(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Navigate to Settings > Profile
    await page.goto('/settings?tab=profile');
    await page.waitForLoadState('networkidle');

    // Find the name input
    const nameInput = page.getByPlaceholder('Your name');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });

    // Save original name
    const originalName = await nameInput.inputValue();

    // Change the name
    await nameInput.fill('E2E Tester Updated');

    // Click "Save Changes"
    await page.getByRole('button', { name: /save changes/i }).click();

    // Verify success
    await expectToast(page, 'Profile updated');

    // Restore original name — clear and refill to trigger dirty detection
    await nameInput.clear();
    await nameInput.fill(originalName);
    await page.waitForTimeout(300);
    const saveBtn2 = page.getByRole('button', { name: /save changes/i });
    if (await saveBtn2.isEnabled({ timeout: 3_000 }).catch(() => false)) {
      await saveBtn2.click();
      await expectToast(page, 'Profile updated');
    }
  });

  test('logout and re-login', async ({ page }) => {
    await loginViaUI(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Click on user avatar/name in top-right header to open dropdown
    const userMenu = page.locator('header').getByRole('button').last();
    await userMenu.click();

    // Click "Logout" in the dropdown
    await page.getByRole('menuitem', { name: /logout/i }).click();

    // Should redirect to login page
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 5_000 });

    // Re-login to verify auth still works
    await loginViaUI(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Verify dashboard loads
    await expect(page.getByText('Dashboard').first()).toBeVisible({ timeout: 5_000 });

    // Save auth state for future specs
    await page.context().storageState({ path: 'e2e/.auth/editor.json' });
  });
});
