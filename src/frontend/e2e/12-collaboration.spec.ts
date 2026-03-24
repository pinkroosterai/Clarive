import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { loginViaUI, waitForAppShell, expectToast } from './helpers/pages';
import { radixClick } from './helpers/radix';

/**
 * Multi-user collaboration tests: presence indicators, soft edit locking,
 * and conflict detection/resolution.
 *
 * Prerequisite: spec 11 invited the editor into the admin's workspace.
 * Both users share the same workspace so they can view the same entries.
 *
 * Uses two separate browser contexts (admin + editor) to simulate concurrent
 * editing of the same entry.
 */

const ADMIN = { email: 'admin@e2e.test', password: 'E2ETestPassword123!' };
const EDITOR = { email: 'editor@e2e.test', password: 'E2ETestPassword123!' };

const COLLAB_ENTRY_TITLE = 'Collaboration Test Entry';

// Shared entry URL — set by the first test, used by all subsequent tests
let entryUrl: string;

/** Log in and navigate to the shared collaboration entry by URL. */
async function openEntryAs(
  browser: Browser,
  user: { email: string; password: string }
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginViaUI(page, user.email, user.password);
  await page.waitForURL(/\/$/, { timeout: 15_000 });

  // Complete onboarding via API to prevent the tour from blocking interactions
  await page.evaluate(() =>
    fetch('/api/profile/complete-onboarding', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('cl_token')}`,
      },
    })
  );

  await waitForAppShell(page);

  // Dismiss onboarding tour if it appeared before the API call completed
  const tourClose = page.locator('.driver-popover-close-btn');
  if (await tourClose.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await tourClose.click();
    await page.waitForTimeout(500);
  }

  // Navigate to the shared entry by URL
  await page.goto(entryUrl);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('input[placeholder="Entry title"]')).toBeVisible({ timeout: 10_000 });

  return { context, page };
}

test.describe('Multi-User Collaboration', () => {
  test.describe.configure({ mode: 'serial' });

  // Collaboration tests can need time for SignalR connections
  test.setTimeout(60_000);

  let adminCtx: BrowserContext;
  let adminPage: Page;
  let editorCtx: BrowserContext;
  let editorPage: Page;

  // ── Setup: create an entry in the shared workspace ──

  test('create a shared entry for collaboration tests', async ({ page }) => {
    // Login as admin (entry owner in the shared workspace)
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Complete onboarding to prevent tour
    await page.evaluate(() =>
      fetch('/api/profile/complete-onboarding', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('cl_token')}` },
      })
    );
    const tourClose = page.locator('.driver-popover-close-btn');
    if (await tourClose.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await tourClose.click();
      await page.waitForTimeout(500);
    }

    // Create a new entry
    await page.goto('/entry/new');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Create New Entry')).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('Title').fill(COLLAB_ENTRY_TITLE);
    await page.getByRole('button', { name: 'Create Entry' }).click();

    await page.waitForURL(/\/entry\/[a-f0-9-]+$/, { timeout: 10_000 });
    entryUrl = new URL(page.url()).pathname;

    // Add some prompt content so the entry is non-trivial
    const tiptapEditor = page.locator('.tiptap').first();
    await tiptapEditor.click();
    await tiptapEditor.pressSequentially('Collaboration test prompt content.', { delay: 10 });
    await page.waitForTimeout(500);

    // Save
    await page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(page, 'Saved');
  });

  // ── Presence Indicators ──

  test('both users see each other in presence indicators', async ({ browser }) => {
    // Admin opens the entry first
    ({ context: adminCtx, page: adminPage } = await openEntryAs(browser, ADMIN));

    // Wait for SignalR to connect
    await adminPage.waitForTimeout(2_000);

    // Editor opens the same entry
    ({ context: editorCtx, page: editorPage } = await openEntryAs(browser, EDITOR));

    // Wait for presence to sync
    await editorPage.waitForTimeout(2_000);

    // Editor should see admin in the "Online:" section
    const editorOnlineSection = editorPage.locator('.flex.items-center.gap-2', {
      hasText: 'Online:',
    });
    await expect(editorOnlineSection).toBeVisible({ timeout: 10_000 });

    // Admin should see editor in the "Online:" section
    const adminOnlineSection = adminPage.locator('.flex.items-center.gap-2', {
      hasText: 'Online:',
    });
    await expect(adminOnlineSection).toBeVisible({ timeout: 10_000 });

    // Clean up
    await adminCtx.close();
    await editorCtx.close();
  });

  test('editing state updates in presence indicators', async ({ browser }) => {
    // Admin opens and starts editing (making isDirty=true)
    ({ context: adminCtx, page: adminPage } = await openEntryAs(browser, ADMIN));

    // Make admin dirty by editing the title
    const adminTitle = adminPage.locator('input[placeholder="Entry title"]');
    await adminTitle.fill('Temp Edit For Presence');
    await adminPage.waitForTimeout(500);

    // Editor opens the same entry
    ({ context: editorCtx, page: editorPage } = await openEntryAs(browser, EDITOR));
    await editorPage.waitForTimeout(2_000);

    // Editor should see admin in "Online:" with a pencil icon (editing state)
    const onlineSection = editorPage.locator('.flex.items-center.gap-2', { hasText: 'Online:' });
    await expect(onlineSection).toBeVisible({ timeout: 10_000 });
    await expect(onlineSection.locator('.lucide-pencil')).toBeVisible({ timeout: 5_000 });

    // Admin discards changes to clean up
    await adminPage.getByRole('button', { name: /discard changes/i }).click();
    const dialog = adminPage.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /discard/i }).click();

    await adminCtx.close();
    await editorCtx.close();
  });

  // ── Soft Edit Locking ──

  test('soft lock banner appears when another user is editing', async ({ browser }) => {
    // Admin opens and starts editing
    ({ context: adminCtx, page: adminPage } = await openEntryAs(browser, ADMIN));
    const adminTitle = adminPage.locator('input[placeholder="Entry title"]');
    await adminTitle.fill('Editing In Progress');
    await adminPage.waitForTimeout(500);

    // Editor opens the same entry
    ({ context: editorCtx, page: editorPage } = await openEntryAs(browser, EDITOR));
    await editorPage.waitForTimeout(2_000);

    // Editor should see the soft lock banner
    await expect(editorPage.getByText('is currently editing this prompt')).toBeVisible({
      timeout: 10_000,
    });

    // "Edit anyway" button should be visible
    await expect(editorPage.getByRole('button', { name: /edit anyway/i })).toBeVisible();

    // Editor's title input should be read-only (soft locked)
    const editorTitle = editorPage.locator('input[placeholder="Entry title"]');
    await expect(editorTitle).toBeDisabled();

    // Clean up: admin discards
    await adminPage.getByRole('button', { name: /discard changes/i }).click();
    const dialog = adminPage.getByRole('alertdialog');
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: /discard/i }).click();

    await adminCtx.close();
    await editorCtx.close();
  });

  test('edit anyway overrides the soft lock', async ({ browser }) => {
    // Admin opens and starts editing
    ({ context: adminCtx, page: adminPage } = await openEntryAs(browser, ADMIN));
    const adminTitle = adminPage.locator('input[placeholder="Entry title"]');
    await adminTitle.fill('Editing In Progress');
    await adminPage.waitForTimeout(500);

    // Editor opens the same entry
    ({ context: editorCtx, page: editorPage } = await openEntryAs(browser, EDITOR));
    await editorPage.waitForTimeout(2_000);

    // Wait for soft lock banner
    await expect(editorPage.getByText('is currently editing this prompt')).toBeVisible({
      timeout: 10_000,
    });

    // Click "Edit anyway" to trigger the confirmation dialog
    const editAnywayTrigger = editorPage.getByRole('button', { name: /edit anyway/i });
    await radixClick(editAnywayTrigger);

    // Confirm in the AlertDialog
    const alertDialog = editorPage.getByRole('alertdialog');
    await alertDialog.waitFor({ state: 'visible' });
    const confirmBtn = alertDialog.getByRole('button', { name: /edit anyway/i });
    await radixClick(confirmBtn);

    // Editor should now be able to edit — title input no longer read-only
    const editorTitle = editorPage.locator('input[placeholder="Entry title"]');
    await expect(editorTitle).toBeEnabled({ timeout: 5_000 });

    // Verify editor can actually type
    await editorTitle.fill('Override Test');
    await expect(editorTitle).toHaveValue('Override Test');

    // Discard changes on both sides
    await editorPage.getByRole('button', { name: /discard changes/i }).click();
    const editorDialog = editorPage.getByRole('alertdialog');
    await editorDialog.waitFor({ state: 'visible' });
    await editorDialog.getByRole('button', { name: /discard/i }).click();

    await adminPage.getByRole('button', { name: /discard changes/i }).click();
    const adminDialog = adminPage.getByRole('alertdialog');
    await adminDialog.waitFor({ state: 'visible' });
    await adminDialog.getByRole('button', { name: /discard/i }).click();

    await adminCtx.close();
    await editorCtx.close();
  });

  // ── Conflict Detection & Resolution ──

  test('conflict detection triggers on sequential saves', async ({ browser }) => {
    // Both users open the entry
    ({ context: adminCtx, page: adminPage } = await openEntryAs(browser, ADMIN));
    ({ context: editorCtx, page: editorPage } = await openEntryAs(browser, EDITOR));
    await editorPage.waitForTimeout(2_000);

    // If editor sees soft lock, override it
    const editAnywayBtn = editorPage.getByRole('button', { name: /edit anyway/i });
    if (await editAnywayBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await radixClick(editAnywayBtn);
      const alertDialog = editorPage.getByRole('alertdialog');
      await alertDialog.waitFor({ state: 'visible' });
      await radixClick(alertDialog.getByRole('button', { name: /edit anyway/i }));
      await editorPage.waitForTimeout(500);
    }

    // Admin changes the title and saves
    const adminTitle = adminPage.locator('input[placeholder="Entry title"]');
    await adminTitle.fill('Admin Conflict Title');
    await adminPage.waitForTimeout(300);
    await adminPage.getByRole('button', { name: /^save$/i }).click();
    await expectToast(adminPage, 'Saved');

    // Editor changes the title and tries to save — should trigger conflict
    const editorTitle = editorPage.locator('input[placeholder="Entry title"]');
    await editorTitle.fill('Editor Conflict Title');
    await editorPage.waitForTimeout(300);
    await editorPage.getByRole('button', { name: /^save$/i }).click();

    // Conflict resolution overlay should appear
    await expect(editorPage.getByText('Resolve conflict')).toBeVisible({ timeout: 10_000 });

    // Side-by-side columns should show both versions
    await expect(editorPage.getByText('Your changes')).toBeVisible();
    await expect(editorPage.getByText('Server version')).toBeVisible();

    // "Keep mine" should be selected by default for the Title field
    const titleSection = editorPage.locator('.space-y-3', { hasText: 'Title' }).first();
    await expect(titleSection.getByRole('button', { name: /keep mine/i })).toBeVisible();
    await expect(titleSection.getByRole('button', { name: /keep theirs/i })).toBeVisible();

    // "Save resolved" button should be visible
    await expect(editorPage.getByRole('button', { name: /save resolved/i })).toBeVisible();

    // Cancel the conflict — close both contexts (next tests set their own titles)
    await editorPage.getByRole('button', { name: /cancel/i }).click();

    await adminCtx.close();
    await editorCtx.close();
  });

  test('resolve conflict with keep mine', async ({ browser }) => {
    // Both users open the entry
    ({ context: adminCtx, page: adminPage } = await openEntryAs(browser, ADMIN));
    ({ context: editorCtx, page: editorPage } = await openEntryAs(browser, EDITOR));
    await editorPage.waitForTimeout(2_000);

    // Override soft lock if present
    const editAnywayBtn = editorPage.getByRole('button', { name: /edit anyway/i });
    if (await editAnywayBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await radixClick(editAnywayBtn);
      const alertDialog = editorPage.getByRole('alertdialog');
      await alertDialog.waitFor({ state: 'visible' });
      await radixClick(alertDialog.getByRole('button', { name: /edit anyway/i }));
      await editorPage.waitForTimeout(500);
    }

    // Admin saves a title change
    await adminPage.locator('input[placeholder="Entry title"]').fill('Admin Title KeepMine');
    await adminPage.waitForTimeout(300);
    await adminPage.getByRole('button', { name: /^save$/i }).click();
    await expectToast(adminPage, 'Saved');

    // Editor saves a different title — triggers conflict
    await editorPage.locator('input[placeholder="Entry title"]').fill('Editor Title KeepMine');
    await editorPage.waitForTimeout(300);
    await editorPage.getByRole('button', { name: /^save$/i }).click();

    // Wait for conflict resolution overlay
    await expect(editorPage.getByText('Resolve conflict')).toBeVisible({ timeout: 10_000 });

    // "Keep mine" is already selected by default — just click "Save resolved"
    await editorPage.getByRole('button', { name: /save resolved/i }).click();

    // Conflict should be resolved
    await expectToast(editorPage, 'Conflict resolved');

    // Editor's title should persist (keep mine)
    const editorTitle = editorPage.locator('input[placeholder="Entry title"]');
    await expect(editorTitle).toHaveValue('Editor Title KeepMine', { timeout: 5_000 });

    // Save the resolved changes — this verifies the rowVersion was updated correctly
    await editorPage.getByRole('button', { name: /^save$/i }).click();
    await expectToast(editorPage, 'Saved');

    // Reload and verify the save persisted
    await editorPage.reload();
    await editorPage.waitForLoadState('networkidle');
    await expect(editorPage.locator('input[placeholder="Entry title"]')).toHaveValue(
      'Editor Title KeepMine',
      { timeout: 10_000 }
    );

    await adminCtx.close();
    await editorCtx.close();
  });

  test('resolve conflict with keep theirs', async ({ browser }) => {
    // Both users open the entry
    ({ context: adminCtx, page: adminPage } = await openEntryAs(browser, ADMIN));
    ({ context: editorCtx, page: editorPage } = await openEntryAs(browser, EDITOR));
    await editorPage.waitForTimeout(2_000);

    // Override soft lock if present
    const editAnywayBtn = editorPage.getByRole('button', { name: /edit anyway/i });
    if (await editAnywayBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await radixClick(editAnywayBtn);
      const alertDialog = editorPage.getByRole('alertdialog');
      await alertDialog.waitFor({ state: 'visible' });
      await radixClick(alertDialog.getByRole('button', { name: /edit anyway/i }));
      await editorPage.waitForTimeout(500);
    }

    // Admin saves a title change
    await adminPage.locator('input[placeholder="Entry title"]').fill('Admin Title KeepTheirs');
    await adminPage.waitForTimeout(300);
    await adminPage.getByRole('button', { name: /^save$/i }).click();
    await expectToast(adminPage, 'Saved');

    // Editor saves a different title — triggers conflict
    await editorPage.locator('input[placeholder="Entry title"]').fill('Editor Title KeepTheirs');
    await editorPage.waitForTimeout(300);
    await editorPage.getByRole('button', { name: /^save$/i }).click();

    // Wait for conflict resolution overlay
    await expect(editorPage.getByText('Resolve conflict')).toBeVisible({ timeout: 10_000 });

    // Click "Keep theirs" for the title field
    const titleSection = editorPage.locator('.space-y-3', { hasText: 'Title' }).first();
    await titleSection.getByRole('button', { name: /keep theirs/i }).click();

    // Click "Save resolved"
    await editorPage.getByRole('button', { name: /save resolved/i }).click();

    // Conflict should be resolved
    await expectToast(editorPage, 'Conflict resolved');

    // Title should now be admin's version (keep theirs)
    const editorTitle = editorPage.locator('input[placeholder="Entry title"]');
    await expect(editorTitle).toHaveValue('Admin Title KeepTheirs', { timeout: 5_000 });

    // Save the resolved changes — this verifies the rowVersion was updated correctly
    await editorPage.getByRole('button', { name: /^save$/i }).click();
    await expectToast(editorPage, 'Saved');

    // Reload and verify the save persisted
    await editorPage.reload();
    await editorPage.waitForLoadState('networkidle');
    await expect(editorPage.locator('input[placeholder="Entry title"]')).toHaveValue(
      'Admin Title KeepTheirs',
      { timeout: 10_000 }
    );

    await adminCtx.close();
    await editorCtx.close();
  });
});
