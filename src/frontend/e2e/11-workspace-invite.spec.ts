import { test, expect } from '@playwright/test';
import { loginViaUI, waitForAppShell, expectToast } from './helpers/pages';
import { radixClick, radixSelect } from './helpers/radix';

/**
 * Workspace invitation flow: admin invites the editor user to the admin's
 * workspace, editor accepts and switches to it.
 *
 * After this spec, both users share a workspace so subsequent collaboration
 * tests can operate on the same entries.
 */

const ADMIN = { email: 'admin@e2e.test', password: 'E2ETestPassword123!' };
const EDITOR = { email: 'editor@e2e.test', password: 'E2ETestPassword123!' };

test.describe('Workspace Invitation', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin invites editor to workspace', async ({ page }) => {
    // Login as admin
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Complete onboarding via API to prevent tour
    await page.evaluate(() =>
      fetch('/api/profile/complete-onboarding', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('cl_token')}` },
      })
    );

    // Dismiss tour if it appeared
    const tourClose = page.locator('.driver-popover-close-btn');
    if (await tourClose.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await tourClose.click();
      await page.waitForTimeout(500);
    }

    // Navigate to Settings > Users
    await page.goto('/settings?tab=users');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1_000);

    // Click "Invite User" button
    await page.getByRole('button', { name: /invite user/i }).click();

    // Fill in the invite dialog
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await expect(dialog.getByText('Invite User')).toBeVisible();

    // Fill email
    await dialog.getByLabel('Email').fill(EDITOR.email);

    // Role defaults to "Editor" — leave as is

    // Send invitation
    await dialog.getByRole('button', { name: /send invitation/i }).click();

    // Verify success
    await expectToast(page, 'Invitation sent');

    // Save auth state
    await page.context().storageState({ path: 'e2e/.auth/admin.json' });
  });

  test('editor accepts invitation and switches workspace', async ({ page }) => {
    // Login as editor
    await loginViaUI(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // The invitation bell should be visible in the sidebar with pending count
    const bellButton = page.getByText('Invitations').first();
    await expect(bellButton).toBeVisible({ timeout: 10_000 });

    // Click the notification bell to open popover
    await bellButton.click();

    // Should see the pending invitation from admin's workspace
    const popover = page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover.getByText("E2E Admin's workspace")).toBeVisible({ timeout: 5_000 });

    // Accept the invitation
    await popover.getByRole('button', { name: /accept/i }).click();

    // Verify success toast
    await expectToast(page, /joined/i);

    // Close the popover by clicking elsewhere
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1_000);

    // Open workspace switcher — click on the current workspace name in sidebar header
    await page.getByText("E2E Editor's workspace").first().click();

    // Should see both workspaces in the dropdown
    const dropdownContent = page.locator('[role="menu"]');
    await expect(dropdownContent).toBeVisible({ timeout: 5_000 });

    // Click on admin's workspace to switch
    const adminWsItem = dropdownContent.getByRole('menuitem', { name: /E2E Admin's workspace/i });
    await adminWsItem.click();

    // Should redirect to dashboard with admin's workspace
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Verify we're now in admin's workspace — the sidebar header shows the workspace name
    const sidebarHeader = page.locator('[data-sidebar="menu"]').first();
    await expect(sidebarHeader.getByText("E2E Admin's workspace")).toBeVisible({ timeout: 5_000 });

    // Save auth state for future specs
    await page.context().storageState({ path: 'e2e/.auth/editor.json' });
  });
});
