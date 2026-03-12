import { test, expect } from '@playwright/test';
import { waitForAppShell } from './helpers/pages';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await waitForAppShell(page);
  });

  test('dashboard page loads and displays heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('dashboard shows stat cards', async ({ page }) => {
    // Dashboard should display statistics
    const statCards = page.locator('[class*="card"], [data-testid*="stat"]');
    await expect(statCards.first()).toBeVisible({ timeout: 5_000 });
  });

  test('dashboard shows recent entries section', async ({ page }) => {
    // Should show recent entries or activity
    const recentSection = page.locator('text=/recent|activity|entries/i');
    await expect(recentSection.first()).toBeVisible({ timeout: 5_000 });
  });

  test('dashboard is accessible from sidebar', async ({ page }) => {
    // Navigate away and back via sidebar
    await page.goto('/library');
    await waitForAppShell(page);

    const dashboardLink = page.locator("[data-sidebar='sidebar']").getByRole('link', {
      name: /dashboard/i,
    });
    await dashboardLink.click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
