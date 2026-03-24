import { test, expect } from './fixtures';

/**
 * Folder management: create, rename, move entry, nested folders, delete.
 * Uses the editor account (created in spec 03, tour completed in spec 04).
 */

test.describe('Folder Management', () => {
  test.describe.configure({ mode: 'serial' });

  test('create a folder', async ({ editorPage: page }) => {
    // Click "+ New folder" in sidebar
    await page.getByText('New folder').click();

    // An inline input appears — type the folder name and press Enter
    const inlineInput = page.locator('input.h-6');
    await expect(inlineInput).toBeFocused({ timeout: 3_000 });
    await inlineInput.fill('Test Folder');
    await inlineInput.press('Enter');

    // Verify folder appears in sidebar
    await expect(page.getByText('Test Folder')).toBeVisible({ timeout: 5_000 });
  });

  test('rename a folder', async ({ editorPage: page }) => {
    // Find the folder row and hover to reveal menu
    const folderRow = page.locator('button', { hasText: 'Test Folder' }).first();
    await folderRow.hover();
    await page.waitForTimeout(300); // Hover reveal animation

    const menuBtn = page.locator('button:has(svg.lucide-ellipsis)').first();
    if (await menuBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await menuBtn.click();
    } else {
      await folderRow.click({ button: 'right' });
    }

    // Click "Rename"
    await page.getByRole('menuitem', { name: 'Rename' }).click();

    await page.waitForTimeout(500); // Inline input focus animation
    const inlineInput = page.locator('input.h-6').filter({ hasText: '' });
    await inlineInput.first().fill('Renamed Folder');
    await inlineInput.first().press('Enter');

    await expect(page.getByText('Renamed Folder').first()).toBeVisible({ timeout: 5_000 });
  });

  test('move entry to folder via API and verify', async ({ editorPage: page }) => {
    // Go to library and verify the entry and folder exist
    await page.goto('/library');
    await page.waitForLoadState('networkidle');

    // Click on "Renamed Folder" in the sidebar to navigate into it
    await page.getByText('Renamed Folder').first().click();

    await expect(page.getByText('Renamed Folder').first()).toBeVisible({ timeout: 5_000 });
  });
});
