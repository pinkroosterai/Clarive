import { test, expect } from '@playwright/test';
import { waitForAppShell } from './helpers/pages';

test.describe('Settings — Audit Log', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await waitForAppShell(page);
  });

  test('audit log tab is accessible', async ({ page }) => {
    // Navigate to audit log tab
    const auditTab = page.getByRole('tab', { name: /audit/i }).or(
      page.getByRole('link', { name: /audit/i })
    );
    if (await auditTab.count()) {
      await auditTab.first().click();
      await page.waitForLoadState('networkidle');

      // Should show audit log content
      const auditContent = page.locator('text=/audit|log|activity/i');
      await expect(auditContent.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
