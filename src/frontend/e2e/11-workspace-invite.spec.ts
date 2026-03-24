import { test, expect, EDITOR } from './fixtures';
import { waitForAppShell, expectToast } from './helpers/pages';
import { radixClick, radixSelect } from './helpers/radix';

/**
 * Workspace invitation flow: admin invites the editor user to the admin's
 * workspace, editor accepts and switches to it.
 *
 * After this spec, both users share a workspace so subsequent collaboration
 * tests can operate on the same entries.
 */

test.describe('Workspace Invitation', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  test('admin invites editor to workspace', async ({ adminPage: page }) => {
    // Navigate to Settings > Users tab
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: /users/i }).click();
    await page.waitForTimeout(1_000); // UserManagement panel load

    // Scroll down past WorkspaceSection to reach UserManagement
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const inviteButton = page.getByRole('button', { name: /invite user/i });
    await expect(inviteButton).toBeVisible({ timeout: 30_000 });
    await inviteButton.click();

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await expect(dialog.getByText('Invite User')).toBeVisible();

    await dialog.getByLabel('Email').fill(EDITOR.email);

    await dialog.getByRole('button', { name: /send invitation/i }).click();

    await expectToast(page, 'Invitation sent');

    // Save auth state
    await page.context().storageState({ path: 'e2e/.auth/admin.json' });
  });

  test('editor accepts invitation and switches workspace', async ({ editorPage: page }) => {
    // The invitation bell should be visible in the sidebar with pending count
    const bellButton = page.getByText('Invitations').first();
    await expect(bellButton).toBeVisible({ timeout: 10_000 });

    await bellButton.click();

    const popover = page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover.getByText("E2E Admin's workspace")).toBeVisible({ timeout: 5_000 });

    await popover.getByRole('button', { name: /accept/i }).click();

    await expectToast(page, /joined/i);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1_000); // Popover close animation

    // Open workspace switcher
    await page.getByText("E2E Editor's workspace").first().click();

    const dropdownContent = page.locator('[role="menu"]');
    await expect(dropdownContent).toBeVisible({ timeout: 5_000 });

    const adminWsItem = dropdownContent.getByRole('menuitem', {
      name: /E2E Admin's workspace/i,
    });
    await adminWsItem.click();

    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    const sidebarHeader = page.locator('[data-sidebar="menu"]').first();
    await expect(sidebarHeader.getByText("E2E Admin's workspace")).toBeVisible({ timeout: 5_000 });

    // Save auth state for future specs
    await page.context().storageState({ path: 'e2e/.auth/editor.json' });
  });
});
