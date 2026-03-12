import { test, expect } from '@playwright/test';

test.describe('Invitation Acceptance Page', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // no pre-auth

  test('accept-invite page with invalid token shows error', async ({ page }) => {
    await page.goto('/accept-invite?token=invalid-invitation-token');
    await page.waitForLoadState('networkidle');

    // Should show error about invalid/expired invitation
    const errorIndicator = page.locator('text=/invalid|expired|error|not found/i');
    await expect(errorIndicator).toBeVisible({ timeout: 5_000 });
  });

  test('accept-invite page without token shows error', async ({ page }) => {
    await page.goto('/accept-invite');
    await page.waitForLoadState('networkidle');

    // Should show error or redirect
    const hasError = await page.locator('text=/invalid|missing|error|token/i').count();
    const redirected = page.url().includes('/login');
    expect(hasError > 0 || redirected).toBeTruthy();
  });
});
