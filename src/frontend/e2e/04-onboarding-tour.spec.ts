import { test, expect } from '@playwright/test';
import { loginViaUI, waitForAppShell } from './helpers/pages';

const EDITOR = {
  email: 'editor@e2e.test',
  password: 'E2ETestPassword123!',
};

test.describe('Onboarding Tour', () => {
  test('editor sees tour on first dashboard visit and completes it', async ({ page }) => {
    await loginViaUI(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // === Step 0: Welcome modal ===
    const popover = page.locator('.driver-popover');
    await expect(popover).toBeVisible({ timeout: 5_000 });
    await expect(popover.getByText('Welcome to Clarive')).toBeVisible();
    await expect(popover.getByText("Let's take a quick tour")).toBeVisible();

    // Click "Start Tour" to begin
    await popover.locator('button', { hasText: 'Start Tour' }).click();

    // === Step 1: Dashboard stats ===
    await expect(popover.getByText('Your Dashboard')).toBeVisible({ timeout: 3_000 });
    await popover.locator('button', { hasText: /next/i }).click();

    // === Step 2: Recent entries ===
    await expect(popover.getByText('Recent Work')).toBeVisible({ timeout: 3_000 });
    await popover.locator('button', { hasText: /next/i }).click();

    // === Step 3: Sidebar navigation ===
    await expect(popover.getByText('Your Workspace')).toBeVisible({ timeout: 3_000 });
    await popover.locator('button', { hasText: /next/i }).click();

    // === Step 4: New Entry button ===
    await expect(popover.getByText('Create & AI Wizard')).toBeVisible({ timeout: 3_000 });
    await popover.locator('button', { hasText: /next/i }).click();

    // === Step 5: Library page (cross-page navigation) ===
    await page.waitForURL(/\/library/, { timeout: 5_000 });
    await expect(popover.getByText('The Prompt Library')).toBeVisible({ timeout: 5_000 });
    await popover.locator('button', { hasText: /next/i }).click();

    // === Step 6: Prompt editor (navigates into first entry) ===
    await page.waitForURL(/\/entry\//, { timeout: 5_000 });
    await expect(popover.getByText('The Prompt Editor')).toBeVisible({ timeout: 5_000 });
    await popover.locator('button', { hasText: /next/i }).click();

    // === Step 7: System message ===
    await expect(popover.getByText('System Message')).toBeVisible({ timeout: 3_000 });
    await popover.locator('button', { hasText: /next/i }).click();

    // === Step 8: Action panel ===
    await expect(popover.getByText('Actions & AI Tools')).toBeVisible({ timeout: 3_000 });
    await popover.locator('button', { hasText: /next/i }).click();

    // === Step 9: Version history ===
    await expect(popover.getByText('Version History')).toBeVisible({ timeout: 3_000 });
    await popover.locator('button', { hasText: /next/i }).click();

    // === Step 10: Closing modal ===
    await expect(popover.getByText("You're All Set!")).toBeVisible({ timeout: 3_000 });
    await popover.locator('button', { hasText: 'Get Started' }).click();

    // Tour overlay should disappear
    await expect(page.locator('.driver-overlay')).not.toBeVisible({ timeout: 3_000 });
  });

  test('tour does not appear on subsequent visits', async ({ page }) => {
    await loginViaUI(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);

    // Wait a moment, then verify no tour popover
    await page.waitForTimeout(2_000);
    await expect(page.locator('.driver-popover')).not.toBeVisible();
  });
});
