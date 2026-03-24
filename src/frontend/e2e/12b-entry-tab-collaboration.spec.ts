import { test, expect, ADMIN, EDITOR } from './fixtures';
import { expectToast } from './helpers/pages';
import { openEntryAs, overrideSoftLock, resolveConflict } from './helpers/collaboration';
import { promptEditor, titleInput } from './helpers/locators';
import { createEntryViaAPI, publishEntryViaAPI, createTabViaAPI } from './helpers/api';

/**
 * Multi-user tab collaboration tests: editing different tabs (no conflict)
 * and editing the same tab (conflict triggers).
 *
 * Prerequisite: spec 11 invited the editor into the admin's workspace.
 * Both users share the same workspace so they can view the same entries.
 */

const ENTRY_TITLE = 'Collab Tabs Entry';
const TAB_C_NAME = 'Tab C';

// Shared entry URL — set by the first test, used by subsequent tests
let entryUrl: string;

test.describe('Multi-User Tab Collaboration', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  test('create entry with Tab C for tab collaboration tests', async ({ adminPage: page }) => {
    // Create entry + publish + create Tab C via API (faster than UI)
    const { entryId, tabId, url } = await createEntryViaAPI(page, {
      title: ENTRY_TITLE,
      content: 'Tab collaboration test prompt.',
    });
    await publishEntryViaAPI(page, entryId, tabId);
    await createTabViaAPI(page, entryId, { name: TAB_C_NAME });

    entryUrl = url;
  });

  test('two users editing different tabs — no conflict', async ({ browser }) => {
    const admin = await openEntryAs(browser, ADMIN, entryUrl);
    const editor = await openEntryAs(browser, EDITOR, entryUrl);
    await editor.page.waitForTimeout(2_000); // SignalR presence sync

    await overrideSoftLock(admin.page);
    await overrideSoftLock(editor.page);

    // Editor switches to Tab C
    await editor.page.getByText(TAB_C_NAME, { exact: true }).click();
    await editor.page.waitForTimeout(500); // Tab content load

    // Admin edits Main tab prompt content and saves
    const adminEditor = promptEditor(admin.page);
    await adminEditor.click();
    await adminEditor.pressSequentially(' — admin main edit', { delay: 10 });
    await admin.page.waitForTimeout(500); // Debounce settle
    await admin.page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(admin.page, 'Saved');

    // Editor edits Tab C prompt content and saves
    const editorEditor = promptEditor(editor.page);
    await editorEditor.click();
    await editorEditor.pressSequentially(' — editor tab-c edit', { delay: 10 });
    await editor.page.waitForTimeout(500); // Debounce settle
    await editor.page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(editor.page, 'Saved');

    // Verify no conflict overlay appeared
    await expect(editor.page.getByText('Resolve conflict')).not.toBeVisible({ timeout: 3_000 });

    await admin.context.close();
    await editor.context.close();
  });

  test('two users editing same tab — conflict triggers', async ({ browser }) => {
    const admin = await openEntryAs(browser, ADMIN, entryUrl);
    const editor = await openEntryAs(browser, EDITOR, entryUrl);
    await editor.page.waitForTimeout(2_000); // SignalR presence sync

    await overrideSoftLock(admin.page);
    await overrideSoftLock(editor.page);

    // Admin edits Main title and saves
    await titleInput(admin.page).fill('Admin Same-Tab Title');
    await admin.page.waitForTimeout(300); // Debounce before save
    await admin.page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(admin.page, 'Saved');

    // Editor edits Main title and saves — should trigger conflict
    await titleInput(editor.page).fill('Editor Same-Tab Title');
    await editor.page.waitForTimeout(300); // Debounce before save
    await editor.page.getByRole('button', { name: /^save$/i }).click();

    // Conflict overlay should appear
    await expect(editor.page.getByText('Resolve conflict')).toBeVisible({ timeout: 10_000 });
    await expect(editor.page.getByText('Your changes')).toBeVisible();
    await expect(editor.page.getByText('Server version')).toBeVisible();

    // Resolve with "Keep mine"
    await resolveConflict(editor.page, 'mine');

    // Restore original title
    await titleInput(editor.page).fill(ENTRY_TITLE);
    await editor.page.waitForTimeout(300); // Debounce before save
    await editor.page.getByRole('button', { name: /^save$/i }).click();
    await expectToast(editor.page, 'Saved');

    await admin.context.close();
    await editor.context.close();
  });
});
