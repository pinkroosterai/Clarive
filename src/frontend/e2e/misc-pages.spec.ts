import { test, expect } from '@playwright/test';

test.describe('Miscellaneous Pages', () => {
  test('terms page renders', async ({ page }) => {
    await page.goto('/terms');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /terms/i })).toBeVisible();
  });

  test('privacy page renders', async ({ page }) => {
    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /privacy/i })).toBeVisible();
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await page.waitForLoadState('networkidle');

    const notFound = page.locator('text=/not found|404|page.*exist/i');
    await expect(notFound.first()).toBeVisible({ timeout: 5_000 });
  });

  test('help page renders', async ({ page }) => {
    await page.goto('/help');
    await page.waitForLoadState('networkidle');

    // Help page or redirect
    const hasHelp = await page.locator('text=/help|documentation|guide/i').count();
    const redirected = !page.url().includes('/help');
    expect(hasHelp > 0 || redirected).toBeTruthy();
  });
});
