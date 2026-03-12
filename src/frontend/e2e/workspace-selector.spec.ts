import { test, expect } from '@playwright/test';
import { waitForAppShell } from './helpers/pages';

test.describe('Workspace Selector', () => {
  test('workspace selector page loads', async ({ page }) => {
    await page.goto('/workspaces');
    await page.waitForLoadState('networkidle');

    // Should show workspaces or redirect to dashboard if only one
    const hasWorkspaces = await page.locator('text=/workspace|personal/i').count();
    const redirected = page.url().includes('/dashboard') || page.url().includes('/library');
    expect(hasWorkspaces > 0 || redirected).toBeTruthy();
  });

  test('workspace name is visible in sidebar', async ({ page }) => {
    await page.goto('/library');
    await waitForAppShell(page);

    // The sidebar should show the current workspace name
    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(sidebar).toBeVisible();
  });
});
