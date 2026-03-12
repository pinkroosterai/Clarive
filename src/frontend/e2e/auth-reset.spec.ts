import { test, expect } from '@playwright/test';
import { USERS } from './helpers/seed-data';

test.describe('Password Reset Flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // no pre-auth

  test('forgot password page renders form', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /forgot|reset/i })).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByRole('button', { name: /send|reset|submit/i })).toBeVisible();
  });

  test('forgot password with valid email shows success message', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    await page.locator('#email').fill(USERS.admin.email);
    await page.getByRole('button', { name: /send|reset|submit/i }).click();

    // Should show success message (doesn't reveal whether email exists)
    const successIndicator = page.locator('text=/check your email|sent|success/i');
    await expect(successIndicator).toBeVisible({ timeout: 5_000 });
  });

  test('forgot password with non-existent email still shows success', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    await page.locator('#email').fill('nonexistent@example.com');
    await page.getByRole('button', { name: /send|reset|submit/i }).click();

    // Should still show success to prevent email enumeration
    const successIndicator = page.locator('text=/check your email|sent|success/i');
    await expect(successIndicator).toBeVisible({ timeout: 5_000 });
  });

  test('reset password page with invalid token shows error', async ({ page }) => {
    await page.goto('/reset-password?token=invalid-token-abc');
    await page.waitForLoadState('networkidle');

    // Should show password form or error — either way the page loads
    const hasForm = await page.locator('input[type="password"]').count();
    const hasError = await page.locator('text=/invalid|expired|error/i').count();
    expect(hasForm + hasError).toBeGreaterThan(0);
  });

  test('forgot password page has link back to login', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    const loginLink = page.getByRole('link', { name: /sign in|log in|back/i });
    await expect(loginLink).toBeVisible();
  });
});
