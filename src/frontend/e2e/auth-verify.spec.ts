import { test, expect } from '@playwright/test';

test.describe('Email Verification Page', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // no pre-auth

  test('verify-email page with invalid token shows error', async ({ page }) => {
    await page.goto('/verify-email?token=invalid-verification-token');
    await page.waitForLoadState('networkidle');

    // Should show some error or invalid token message
    const errorIndicator = page.locator('text=/invalid|expired|error|failed/i');
    await expect(errorIndicator).toBeVisible({ timeout: 5_000 });
  });

  test('verify-email page without token shows error', async ({ page }) => {
    await page.goto('/verify-email');
    await page.waitForLoadState('networkidle');

    // Should show error or redirect
    const hasError = await page.locator('text=/invalid|missing|error|token/i').count();
    const redirectedToLogin = page.url().includes('/login');
    expect(hasError > 0 || redirectedToLogin).toBeTruthy();
  });
});
