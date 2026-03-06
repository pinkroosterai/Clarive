import { test, expect } from '@playwright/test';
import { radixClick } from './helpers/radix';

/**
 * Helper: create a fresh draft entry via the API-like UI flow so we have
 * an isolated entry for editing tests. Returns the entry URL.
 */
async function createTestEntry(
  page: import('@playwright/test').Page,
  title: string
): Promise<string> {
  await page.goto('/entry/new');
  await page.waitForLoadState('networkidle');
  await page.locator('#title').fill(title);
  await page.getByRole('button', { name: 'Create Entry' }).click();
  // UUID pattern — must NOT match /entry/new
  await page.waitForURL(/\/entry\/[0-9a-f]{8}-/);
  return page.url();
}

test.describe('Entry Editor — Editing & Saving', () => {
  let entryUrl: string;
  const title = `E2E Edit ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: 'e2e/.auth/admin.json',
    });
    const page = await ctx.newPage();
    entryUrl = await createTestEntry(page, title);
    await ctx.close();
  });

  test('edit entry title and save', async ({ page }) => {
    await page.goto(entryUrl);
    await page.waitForLoadState('networkidle');

    const titleInput = page.locator("input[placeholder='Entry title']");
    await expect(titleInput).toHaveValue(title);

    // Modify title
    const newTitle = `${title} Updated`;
    await titleInput.clear();
    await titleInput.fill(newTitle);

    // Unsaved indicator should appear
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    // Save
    await page.getByRole('button', { name: /Save Draft/i }).click();
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Draft saved');

    // Unsaved indicator should disappear
    await expect(page.getByText('Unsaved changes')).not.toBeVisible();
  });

  test('edit prompt content via Tiptap editor and save', async ({ page }) => {
    await page.goto(entryUrl);
    await page.waitForLoadState('networkidle');

    // Find the Tiptap editor (ProseMirror contenteditable)
    const editor = page.locator(".tiptap[contenteditable='true']").first();
    await editor.click();
    await editor.fill('This is my test prompt content.');

    // Wait for dirty state
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    // Save with Ctrl+S
    await page.keyboard.press('Control+s');
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Draft saved');
  });

  test('unsaved changes indicator appears on edit', async ({ page }) => {
    await page.goto(entryUrl);
    await page.waitForLoadState('networkidle');

    // Initially no unsaved indicator
    await expect(page.getByText('Unsaved changes')).not.toBeVisible();

    // Edit title to trigger dirty state
    const titleInput = page.locator("input[placeholder='Entry title']");
    const currentTitle = await titleInput.inputValue();
    await titleInput.fill(currentTitle + '!');

    // Indicator appears
    await expect(page.getByText('Unsaved changes')).toBeVisible();
  });

  test('discard changes reverts to last saved state', async ({ page }) => {
    await page.goto(entryUrl);
    await page.waitForLoadState('networkidle');

    const titleInput = page.locator("input[placeholder='Entry title']");
    const originalTitle = await titleInput.inputValue();

    // Make a change
    await titleInput.fill('Temporary title change');
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    // Click Discard Changes
    await page.getByRole('button', { name: /Discard Changes/i }).click();

    // Confirm in the dialog
    const discardBtn = page.getByRole('alertdialog').getByRole('button', { name: 'Discard' });
    await radixClick(discardBtn);

    // Verify toast
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Changes discarded');

    // Title should revert
    await expect(titleInput).toHaveValue(originalTitle);
    await expect(page.getByText('Unsaved changes')).not.toBeVisible();
  });
});

test.describe('Entry Editor — Publishing & Versioning', () => {
  test.describe.configure({ mode: 'serial' });

  let entryUrl: string;
  const title = `E2E Publish ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: 'e2e/.auth/admin.json',
    });
    const page = await ctx.newPage();
    entryUrl = await createTestEntry(page, title);

    // Add some content so publish is meaningful
    await page.locator(".tiptap[contenteditable='true']").first().click();
    await page.locator(".tiptap[contenteditable='true']").first().fill('Prompt for publishing.');
    await page.keyboard.press('Control+s');
    await page.locator('[data-sonner-toast]').first().waitFor({ state: 'visible' });

    await ctx.close();
  });

  test('version badge shows Draft v1 for new entry', async ({ page }) => {
    await page.goto(entryUrl);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Draft v1')).toBeVisible();
  });

  test('publish draft → version badge changes to Published', async ({ page }) => {
    await page.goto(entryUrl);
    await page.waitForLoadState('networkidle');

    // Click Publish button (exact match to avoid version panel "Published" text)
    await page.getByRole('button', { name: 'Publish', exact: true }).click();

    // Confirm in the dialog
    const publishBtn = page.getByRole('alertdialog').getByRole('button', { name: 'Publish' });
    await radixClick(publishBtn);

    // Verify toast
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Entry published');

    // Badge should now say Published
    await expect(page.getByText(/Published v1/)).toBeVisible();
  });

  test('editing published entry creates a new draft version', async ({ page }) => {
    await page.goto(entryUrl);
    await page.waitForLoadState('networkidle');

    // Edit the title to create a draft
    const titleInput = page.locator("input[placeholder='Entry title']");
    await titleInput.fill(`${title} v2`);

    // Save as new draft
    await page.keyboard.press('Control+s');
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Draft saved');

    // Should now show Draft v2
    await expect(page.getByText('Draft v2')).toBeVisible();
  });

  test('version history panel shows multiple versions', async ({ page }) => {
    await page.goto(entryUrl);
    await page.waitForLoadState('networkidle');

    // Version History section should be visible
    await expect(page.getByText('Version History')).toBeVisible();

    // Should show v1 and v2 in the version panel (scoped to avoid badge/breadcrumb matches)
    const versionPanel = page.locator('text=Version History').locator('..');
    await expect(versionPanel.getByText('v1').first()).toBeVisible();
    await expect(versionPanel.getByText('v2').first()).toBeVisible();
  });

  test('view historical version shows read-only banner', async ({ page }) => {
    await page.goto(entryUrl);
    await page.waitForLoadState('networkidle');

    // Click v1 in the version history (the published/historical version)
    const versionButtons = page.locator('button').filter({ hasText: 'v1' });
    // Find the one in the version panel (not the badge)
    await versionButtons.last().click();

    // Should navigate to version URL
    await expect(page).toHaveURL(/\/version\/1$/);

    // Read-only banner should be visible
    await expect(page.getByText(/Viewing v1.*read-only/)).toBeVisible();

    // Save button should not be visible
    await expect(page.getByRole('button', { name: /Save Draft/i })).not.toBeVisible();
  });

  test('compare versions dialog opens', async ({ page }) => {
    await page.goto(entryUrl);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Compare versions/i }).click();

    // Dialog should open — use the heading inside the dialog
    await expect(page.getByRole('heading', { name: 'Compare Versions' })).toBeVisible();

    // Should have version select dropdowns
    await expect(page.getByText('Left (old)')).toBeVisible();
    await expect(page.getByText('Right (new)')).toBeVisible();
  });

  test('publish v2 draft makes v1 historical', async ({ page }) => {
    await page.goto(entryUrl);
    await page.waitForLoadState('networkidle');

    // Publish v2 — use exact match to avoid matching version panel "Published" text
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    const publishBtn = page.getByRole('alertdialog').getByRole('button', { name: 'Publish' });
    await radixClick(publishBtn);

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Entry published');
    await expect(page.getByText(/Published v2/)).toBeVisible();
  });

  test('restore historical version as draft', async ({ page }) => {
    await page.goto(entryUrl);
    await page.waitForLoadState('networkidle');

    // Navigate to the historical version (v1 is now historical)
    const versionButtons = page.locator('button').filter({ hasText: 'v1' });
    await versionButtons.last().click();
    await expect(page).toHaveURL(/\/version\/1$/);

    // Click "Restore as draft"
    await page.getByRole('button', { name: /Restore as draft/i }).click();

    // Confirm in dialog
    const restoreBtn = page.getByRole('alertdialog').getByRole('button', { name: 'Restore' });
    await radixClick(restoreBtn);

    // Verify toast
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Version restored as new draft');

    // Should navigate to the new draft
    await expect(page).toHaveURL(/\/entry\/[0-9a-f]{8}-/);
  });
});
