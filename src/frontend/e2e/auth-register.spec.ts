import { test, expect } from '@playwright/test';

test.describe('Authentication — Registration', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // no pre-auth

  test('register with unique email creates account and redirects to /library', async ({ page }) => {
    const unique = `e2e_${Date.now()}@test.dev`;

    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await page.locator('#name').fill('E2E Test User');
    await page.locator('#email').fill(unique);
    await page.locator('#password').fill('StrongPass123!');
    await page.locator('#confirmPassword').fill('StrongPass123!');
    await page.getByRole('button', { name: 'Create account' }).click();

    // Should show success toast and redirect
    await expect(page).toHaveURL(/\/(library|dashboard)/, { timeout: 15_000 });
  });

  test('register with existing email shows error toast', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await page.locator('#name').fill('Duplicate User');
    await page.locator('#email').fill('admin@clarive.dev'); // seeded user
    await page.locator('#password').fill('StrongPass123!');
    await page.locator('#confirmPassword').fill('StrongPass123!');
    await page.getByRole('button', { name: 'Create account' }).click();

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 5_000 });
    await expect(toast).toContainText(/unable to create account|already|exists|taken/i);
    // Should remain on register page
    await expect(page).toHaveURL(/\/register/);
  });

  test('register with mismatched passwords shows client-side error', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await page.locator('#name').fill('Mismatch User');
    await page.locator('#email').fill('mismatch@test.dev');
    await page.locator('#password').fill('Password1!');
    await page.locator('#confirmPassword').fill('DifferentPassword!');
    await page.getByRole('button', { name: 'Create account' }).click();

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 5_000 });
    await expect(toast).toContainText(/passwords do not match/i);
  });

  test('register form validation — empty fields prevent submission', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    // Click submit without filling anything
    await page.getByRole('button', { name: 'Create account' }).click();

    // Should stay on register — browser native validation or toast
    await expect(page).toHaveURL(/\/register/);
  });
});
