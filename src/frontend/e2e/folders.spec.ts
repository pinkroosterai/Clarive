import { test, expect } from '@playwright/test';
import { FOLDERS } from './helpers/seed-data';
import { getSidebar, openFolderMenu, expandFolder } from './helpers/sidebar';

/**
 * Wait for the inline folder input to appear, fill it and submit via Enter.
 *
 * Gotchas addressed:
 * - Radix DropdownMenu returns focus to the trigger after closing, which can
 *   steal focus from the autoFocused InlineInput and trigger its onBlur→submit.
 *   We wait for the menu to fully close before interacting.
 * - Uses page.keyboard.press("Enter") to avoid DOM detachment issues if React
 *   re-mounts the input after fill().
 */
async function fillInlineInput(
  page: import('@playwright/test').Page,
  sidebar: ReturnType<typeof getSidebar>,
  name: string
) {
  const input = sidebar.locator('input').last();
  await input.waitFor({ state: 'visible', timeout: 5_000 });
  // Wait for any Radix dropdown menu to fully close (prevents focus theft)
  await page
    .locator("[role='menu']")
    .waitFor({ state: 'hidden' })
    .catch(() => {});
  await input.fill(name);
  await page.keyboard.press('Enter');
}

test.describe('Folder CRUD', () => {
  test.describe.configure({ mode: 'serial' });

  const uniqueName = `E2E Test ${Date.now()}`;
  const renamedName = `${uniqueName} Ren`;
  const childName = `${uniqueName} Sub`;

  test.beforeEach(async ({ page }) => {
    await page.goto('/library');
    await page.waitForLoadState('networkidle');
  });

  test('create a new folder at root level', async ({ page }) => {
    const sidebar = getSidebar(page);

    await sidebar.getByText('New folder').click();
    await fillInlineInput(page, sidebar, uniqueName);

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Folder created');
    await expect(sidebar.getByText(uniqueName)).toBeVisible();
  });

  test('create a nested subfolder inside existing folder', async ({ page }) => {
    const sidebar = getSidebar(page);

    await openFolderMenu(page, uniqueName);
    await page.getByRole('menuitem', { name: /new subfolder/i }).click();

    await fillInlineInput(page, sidebar, childName);

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Folder created');
    await expect(sidebar.getByText(childName)).toBeVisible();
  });

  test('rename a folder', async ({ page }) => {
    const sidebar = getSidebar(page);

    await openFolderMenu(page, uniqueName);
    await page.getByRole('menuitem', { name: /rename/i }).click();

    await fillInlineInput(page, sidebar, renamedName);

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Folder renamed');
    await expect(sidebar.getByText(renamedName)).toBeVisible();
  });

  test('delete the child subfolder (empty folder)', async ({ page }) => {
    const sidebar = getSidebar(page);

    // Expand the parent folder tree node to reveal the child
    await expandFolder(page, renamedName);

    // Wait for the child to appear in the DOM
    await sidebar
      .getByText(childName, { exact: false })
      .waitFor({ state: 'visible', timeout: 5_000 });

    await openFolderMenu(page, childName);
    await page.getByRole('menuitem', { name: /delete/i }).click();

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Folder deleted');
    await expect(sidebar.getByText(childName)).not.toBeVisible();
  });

  test('delete the root test folder (cleanup)', async ({ page }) => {
    await openFolderMenu(page, renamedName);
    await page.getByRole('menuitem', { name: /delete/i }).click();

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Folder deleted');
    await expect(getSidebar(page).getByText(renamedName)).not.toBeVisible();
  });

  test('cannot delete non-empty folder', async ({ page }) => {
    await openFolderMenu(page, FOLDERS.contentWriting.name);
    await page.getByRole('menuitem', { name: /delete/i }).click();

    // Expect an error toast (folder has children)
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 5_000 });

    // Folder should still be in the sidebar
    await expect(getSidebar(page).getByText(FOLDERS.contentWriting.name)).toBeVisible();
  });
});
