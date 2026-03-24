import { Page, expect } from '@playwright/test';
import { expectToast } from './pages';

/** Click the Save button and wait for the "Saved" toast. */
export async function saveEntry(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^save$/i }).click();
  await expectToast(page, 'Saved');
}

/**
 * Publish the current entry: switch to Actions tab, click Publish,
 * confirm the dialog, and wait for the "Published" toast.
 */
export async function publishEntry(page: Page): Promise<void> {
  await page.getByRole('tab', { name: /actions/i }).click();
  await page.getByRole('button', { name: /^publish$/i }).click();

  const dialog = page.getByRole('alertdialog');
  await dialog.waitFor({ state: 'visible' });
  await dialog.getByRole('button', { name: /^publish$/i }).click();
  await expectToast(page, 'Published');
}

/**
 * Discard unsaved changes: click Discard Changes, confirm the dialog.
 */
export async function discardChanges(page: Page): Promise<void> {
  await page.getByRole('button', { name: /discard changes/i }).click();

  const dialog = page.getByRole('alertdialog');
  await dialog.waitFor({ state: 'visible' });
  await dialog.getByRole('button', { name: /discard/i }).click();
}

/**
 * Create a new entry via the /entry/new page, optionally adding content.
 * Returns the entry URL pathname.
 */
export async function createAndSaveEntry(
  page: Page,
  title: string,
  content?: string
): Promise<string> {
  await page.goto('/entry/new');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Create New Entry')).toBeVisible({ timeout: 10_000 });

  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Create Entry' }).click();
  await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });

  if (content) {
    const tiptapEditor = page.locator('.tiptap').first();
    await tiptapEditor.click();
    await tiptapEditor.pressSequentially(content, { delay: 10 });
    await page.waitForTimeout(500); // Debounce settle (150ms editor debounce + margin)
  }

  await page.getByRole('button', { name: /^save$/i }).click();
  await expectToast(page, 'Saved');

  return new URL(page.url()).pathname;
}
