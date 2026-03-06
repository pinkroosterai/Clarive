import { test, expect } from '@playwright/test';
import { FOLDERS } from './helpers/seed-data';

test.describe('Entry Creation', () => {
  const uniqueTitle = `E2E Create ${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await page.goto('/entry/new');
    await page.waitForLoadState('networkidle');
  });

  test('create entry via /entry/new → saves and navigates to editor @smoke', async ({ page }) => {
    await page.locator('#title').fill(uniqueTitle);
    await page.getByRole('button', { name: 'Create Entry' }).click();

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Entry created');
    await expect(page).toHaveURL(/\/entry\/[0-9a-f]{8}-/);

    // Verify editor loaded with the title
    await expect(page.locator("input[placeholder='Entry title']")).toHaveValue(uniqueTitle);
    await expect(page.getByRole('button', { name: /Save Draft/i })).toBeVisible();
  });

  test('create entry into a specific folder', async ({ page }) => {
    const folderTitle = `E2E Folder Entry ${Date.now()}`;
    await page.locator('#title').fill(folderTitle);

    // Open the folder select and pick "Content Writing"
    await page.locator('#folder').click();
    await page.getByRole('option', { name: FOLDERS.contentWriting.name }).click();

    await page.getByRole('button', { name: 'Create Entry' }).click();

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Entry created');
    await expect(page).toHaveURL(/\/entry\/[0-9a-f]{8}-/);
  });

  test('create entry with Enter key shortcut', async ({ page }) => {
    const enterTitle = `E2E Enter ${Date.now()}`;
    await page.locator('#title').fill(enterTitle);
    await page.locator('#title').press('Enter');

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Entry created');
    await expect(page).toHaveURL(/\/entry\/[0-9a-f]{8}-/);
  });

  test('create button is disabled when title is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Create Entry' })).toBeDisabled();

    // Typing enables it
    await page.locator('#title').fill('Something');
    await expect(page.getByRole('button', { name: 'Create Entry' })).toBeEnabled();

    // Clearing disables it again
    await page.locator('#title').clear();
    await expect(page.getByRole('button', { name: 'Create Entry' })).toBeDisabled();
  });

  test('AI wizard link is visible on new entry page', async ({ page }) => {
    const wizardLink = page.getByRole('link', {
      name: /AI Wizard/i,
    });
    await expect(wizardLink).toBeVisible();
    await expect(wizardLink).toHaveAttribute('href', '/entry/new/wizard');
  });
});
