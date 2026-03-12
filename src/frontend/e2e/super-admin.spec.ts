import { test, expect } from '@playwright/test';

test.describe('Super Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/super');
    await page.waitForLoadState('networkidle');
  });

  test('super admin page loads for admin user', async ({ page }) => {
    // Admin should see super admin dashboard
    await expect(page.getByRole('heading', { name: /admin|super|system/i })).toBeVisible({
      timeout: 5_000,
    });
  });

  test('super admin shows users table', async ({ page }) => {
    // Should display a users section
    const usersSection = page.locator('text=/users/i');
    await expect(usersSection.first()).toBeVisible({ timeout: 5_000 });
  });

  test('super admin shows system stats', async ({ page }) => {
    // Should display system statistics
    const stats = page.locator('text=/total|entries|workspaces/i');
    await expect(stats.first()).toBeVisible({ timeout: 5_000 });
  });

  test('super admin shows configuration section', async ({ page }) => {
    // Should have config/settings tab or section
    const configTab = page.locator('text=/config|settings|configuration/i');
    await expect(configTab.first()).toBeVisible({ timeout: 5_000 });
  });
});
