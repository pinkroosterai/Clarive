import { test, expect } from '@playwright/test';
import { ENTRIES } from './helpers/seed-data';

test.describe('Viewer Restrictions', () => {
  test.use({ storageState: 'e2e/.auth/viewer.json' });

  test('viewer can browse library and view entries', async ({ page }) => {
    // Navigate directly to a known seeded entry
    await page.goto(`/entry/${ENTRIES.emailToneAdjuster.id}`);
    await page.waitForLoadState('networkidle');

    // Entry loads in read-only mode — title input is disabled
    const titleInput = page.locator("input[placeholder='Entry title']");
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toBeDisabled();
  });

  test('viewer cannot edit entries — action buttons hidden', async ({ page }) => {
    await page.goto(`/entry/${ENTRIES.emailToneAdjuster.id}`);
    await page.waitForLoadState('networkidle');

    // Entire ActionPanel is hidden for viewers — no edit/publish/save buttons
    await expect(page.getByRole('button', { name: /Save Draft/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Discard Changes/i })).not.toBeVisible();
  });

  test('viewer cannot manage API keys or delete account', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // API Keys tab shows access denied message
    await page.getByRole('tab', { name: /API Keys/ }).click();
    await expect(page.getByText(/Only the account admin can manage API keys/i)).toBeVisible();

    // Users tab — no Invite User or Transfer Ownership buttons
    await page.getByRole('tab', { name: /Users/ }).click();
    await expect(page.getByRole('button', { name: /Invite User/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Transfer Ownership/i })).not.toBeVisible();

    // Account tab — no Delete Account section
    await page.getByRole('tab', { name: /Account/ }).click();
    await expect(page.getByRole('button', { name: /Delete Account/i })).not.toBeVisible();
  });
});

test.describe('Editor Permissions', () => {
  test.use({ storageState: 'e2e/.auth/editor.json' });

  test('editor can create and edit but cannot manage settings', async ({ page }) => {
    // Navigate directly to a draft entry — editor should have full edit access
    await page.goto(`/entry/${ENTRIES.meetingNotesFormatter.id}`);
    await page.waitForLoadState('networkidle');

    // Edit action buttons should be visible for editor
    await expect(page.getByRole('button', { name: /Save Draft/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();

    // But settings admin features should be restricted
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // API Keys — access denied
    await page.getByRole('tab', { name: /API Keys/ }).click();
    await expect(page.getByText(/Only the account admin can manage API keys/i)).toBeVisible();

    // Account — no Delete Account section
    await page.getByRole('tab', { name: /Account/ }).click();
    await expect(page.getByRole('button', { name: /Delete Account/i })).not.toBeVisible();
  });
});
