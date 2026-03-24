import { test, expect, ADMIN, EDITOR } from './fixtures';
import { expectToast } from './helpers/pages';
import { openEntryAs, overrideSoftLock, resolveConflict } from './helpers/collaboration';
import { discardChanges } from './helpers/entry-actions';
import { titleInput, ENTRY_TITLE_INPUT } from './helpers/locators';
import { createEntryViaAPI } from './helpers/api';
import { radixClick } from './helpers/radix';
import type { BrowserContext, Page } from '@playwright/test';

/**
 * Multi-user collaboration tests: presence indicators, soft edit locking,
 * and conflict detection/resolution.
 *
 * Prerequisite: spec 11 invited the editor into the admin's workspace.
 * Both users share the same workspace so they can view the same entries.
 */

const COLLAB_ENTRY_TITLE = 'Collaboration Test Entry';

// Shared entry URL — set by the first test, used by all subsequent tests
let entryUrl: string;

test.describe('Multi-User Collaboration', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  let adminCtx: BrowserContext;
  let adminPage: Page;
  let editorCtx: BrowserContext;
  let editorPage: Page;

  // ── Setup: create an entry in the shared workspace ──

  test('create a shared entry for collaboration tests', async ({ adminPage: page }) => {
    // Create entry via API (faster than UI)
    const { entryId, url } = await createEntryViaAPI(page, {
      title: COLLAB_ENTRY_TITLE,
      content: 'Collaboration test prompt content.',
    });
    entryUrl = url;
  });

  // ── Presence Indicators ──

  test('both users see each other in presence indicators', async ({ browser }) => {
    ({ context: adminCtx, page: adminPage } = await openEntryAs(browser, ADMIN, entryUrl));
    await adminPage.waitForTimeout(2_000); // SignalR presence sync

    ({ context: editorCtx, page: editorPage } = await openEntryAs(browser, EDITOR, entryUrl));
    await editorPage.waitForTimeout(2_000); // SignalR presence sync

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

    await adminCtx.close();
    await editorCtx.close();
  });

  test('editing state updates in presence indicators', async ({ browser }) => {
    ({ context: adminCtx, page: adminPage } = await openEntryAs(browser, ADMIN, entryUrl));

    // Make admin dirty by editing the title
    await titleInput(adminPage).fill('Temp Edit For Presence');
    await adminPage.waitForTimeout(500); // Dirty state debounce

    ({ context: editorCtx, page: editorPage } = await openEntryAs(browser, EDITOR, entryUrl));
    await editorPage.waitForTimeout(2_000); // SignalR presence sync

    // Editor should see admin with a pencil icon (editing state)
    const onlineSection = editorPage.locator('.flex.items-center.gap-2', { hasText: 'Online:' });
    await expect(onlineSection).toBeVisible({ timeout: 10_000 });
    await expect(onlineSection.locator('.lucide-pencil')).toBeVisible({ timeout: 5_000 });

    // Admin discards changes to clean up
    await discardChanges(adminPage);

    await adminCtx.close();
    await editorCtx.close();
  });

  // ── Soft Edit Locking ──

  test('soft lock banner appears when another user is editing', async ({ browser }) => {
    ({ context: adminCtx, page: adminPage } = await openEntryAs(browser, ADMIN, entryUrl));
    await titleInput(adminPage).fill('Editing In Progress');
    await adminPage.waitForTimeout(500); // Dirty state debounce

    ({ context: editorCtx, page: editorPage } = await openEntryAs(browser, EDITOR, entryUrl));
    await editorPage.waitForTimeout(2_000); // SignalR presence sync

    // Editor should see the soft lock banner
    await expect(editorPage.getByText('is currently editing this prompt')).toBeVisible({
      timeout: 10_000,
    });
    await expect(editorPage.getByRole('button', { name: /edit anyway/i })).toBeVisible();

    // Editor's title input should be read-only (soft locked)
    await expect(titleInput(editorPage)).toBeDisabled();

    // Clean up: admin discards
    await discardChanges(adminPage);

    await adminCtx.close();
    await editorCtx.close();
  });

  test('edit anyway overrides the soft lock', async ({ browser }) => {
    ({ context: adminCtx, page: adminPage } = await openEntryAs(browser, ADMIN, entryUrl));
    await titleInput(adminPage).fill('Editing In Progress');
    await adminPage.waitForTimeout(500); // Dirty state debounce

    ({ context: editorCtx, page: editorPage } = await openEntryAs(browser, EDITOR, entryUrl));
    await editorPage.waitForTimeout(2_000); // SignalR presence sync

    await expect(editorPage.getByText('is currently editing this prompt')).toBeVisible({
      timeout: 10_000,
    });

    // Click "Edit anyway" to trigger the confirmation dialog
    const editAnywayTrigger = editorPage.getByRole('button', { name: /edit anyway/i });
    await radixClick(editAnywayTrigger);

    const alertDialog = editorPage.getByRole('alertdialog');
    await alertDialog.waitFor({ state: 'visible' });
    const confirmBtn = alertDialog.getByRole('button', { name: /edit anyway/i });
    await radixClick(confirmBtn);

    // Editor should now be able to edit
    const editorTitle = titleInput(editorPage);
    await expect(editorTitle).toBeEnabled({ timeout: 5_000 });

    await editorTitle.fill('Override Test');
    await expect(editorTitle).toHaveValue('Override Test');

    // Discard changes on both sides
    await discardChanges(editorPage);
    await discardChanges(adminPage);

    await adminCtx.close();
    await editorCtx.close();
  });

  // ── Conflict Detection & Resolution ──

  test('conflict detection triggers on sequential saves', async ({ browser }) => {
    ({ context: adminCtx, page: adminPage } = await openEntryAs(browser, ADMIN, entryUrl));
    ({ context: editorCtx, page: editorPage } = await openEntryAs(browser, EDITOR, entryUrl));
    await editorPage.waitForTimeout(2_000); // SignalR presence sync

    await overrideSoftLock(editorPage);

    // Admin changes the title and saves
    await titleInput(adminPage).fill('Admin Conflict Title');
    await adminPage.waitForTimeout(300); // Debounce before save
    await adminPage.getByRole('button', { name: /^save$/i }).click();
    await expectToast(adminPage, 'Saved');

    // Editor changes the title and tries to save — should trigger conflict
    await titleInput(editorPage).fill('Editor Conflict Title');
    await editorPage.waitForTimeout(300); // Debounce before save
    await editorPage.getByRole('button', { name: /^save$/i }).click();

    // Conflict resolution overlay should appear
    await expect(editorPage.getByText('Resolve conflict')).toBeVisible({ timeout: 10_000 });
    await expect(editorPage.getByText('Your changes')).toBeVisible();
    await expect(editorPage.getByText('Server version')).toBeVisible();

    // "Keep mine" should be selected by default for the Title field
    const titleSection = editorPage.locator('.space-y-3', { hasText: 'Title' }).first();
    await expect(titleSection.getByRole('button', { name: /keep mine/i })).toBeVisible();
    await expect(titleSection.getByRole('button', { name: /keep theirs/i })).toBeVisible();

    await expect(editorPage.getByRole('button', { name: /save resolved/i })).toBeVisible();

    // Cancel the conflict
    await editorPage.getByRole('button', { name: /cancel/i }).click();

    await adminCtx.close();
    await editorCtx.close();
  });

  test('resolve conflict with keep mine', async ({ browser }) => {
    ({ context: adminCtx, page: adminPage } = await openEntryAs(browser, ADMIN, entryUrl));
    ({ context: editorCtx, page: editorPage } = await openEntryAs(browser, EDITOR, entryUrl));
    await editorPage.waitForTimeout(2_000); // SignalR presence sync

    await overrideSoftLock(editorPage);

    // Admin saves a title change
    await titleInput(adminPage).fill('Admin Title KeepMine');
    await adminPage.waitForTimeout(300); // Debounce before save
    await adminPage.getByRole('button', { name: /^save$/i }).click();
    await expectToast(adminPage, 'Saved');

    // Editor saves a different title — triggers conflict
    await titleInput(editorPage).fill('Editor Title KeepMine');
    await editorPage.waitForTimeout(300); // Debounce before save
    await editorPage.getByRole('button', { name: /^save$/i }).click();

    // Resolve with "Keep mine" (default)
    await resolveConflict(editorPage, 'mine');

    // Editor's title should persist
    await expect(titleInput(editorPage)).toHaveValue('Editor Title KeepMine', { timeout: 5_000 });

    // Save the resolved changes
    await editorPage.getByRole('button', { name: /^save$/i }).click();
    await expectToast(editorPage, 'Saved');

    // Reload and verify
    await editorPage.reload();
    await editorPage.waitForLoadState('networkidle');
    await expect(editorPage.locator(ENTRY_TITLE_INPUT)).toHaveValue('Editor Title KeepMine', {
      timeout: 10_000,
    });

    await adminCtx.close();
    await editorCtx.close();
  });

  test('resolve conflict with keep theirs', async ({ browser }) => {
    ({ context: adminCtx, page: adminPage } = await openEntryAs(browser, ADMIN, entryUrl));
    ({ context: editorCtx, page: editorPage } = await openEntryAs(browser, EDITOR, entryUrl));
    await editorPage.waitForTimeout(2_000); // SignalR presence sync

    await overrideSoftLock(editorPage);

    // Admin saves a title change
    await titleInput(adminPage).fill('Admin Title KeepTheirs');
    await adminPage.waitForTimeout(300); // Debounce before save
    await adminPage.getByRole('button', { name: /^save$/i }).click();
    await expectToast(adminPage, 'Saved');

    // Editor saves a different title — triggers conflict
    await titleInput(editorPage).fill('Editor Title KeepTheirs');
    await editorPage.waitForTimeout(300); // Debounce before save
    await editorPage.getByRole('button', { name: /^save$/i }).click();

    // Resolve with "Keep theirs"
    await resolveConflict(editorPage, 'theirs');

    // Title should now be admin's version
    await expect(titleInput(editorPage)).toHaveValue('Admin Title KeepTheirs', { timeout: 5_000 });

    // Save the resolved changes
    await editorPage.getByRole('button', { name: /^save$/i }).click();
    await expectToast(editorPage, 'Saved');

    // Reload and verify
    await editorPage.reload();
    await editorPage.waitForLoadState('networkidle');
    await expect(editorPage.locator(ENTRY_TITLE_INPUT)).toHaveValue('Admin Title KeepTheirs', {
      timeout: 10_000,
    });

    await adminCtx.close();
    await editorCtx.close();
  });
});
