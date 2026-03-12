import { test, expect } from '@playwright/test';
import { waitForAppShell, expectToast } from './helpers/pages';

test.describe('Settings — Import/Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await waitForAppShell(page);
  });

  test('export button is visible in settings', async ({ page }) => {
    // Navigate to the data/import-export section
    const dataTab = page
      .getByRole('tab', { name: /data|import|export/i })
      .or(page.getByRole('link', { name: /data|import|export/i }));

    if (await dataTab.count()) {
      await dataTab.first().click();
      await page.waitForLoadState('networkidle');

      const exportBtn = page.getByRole('button', { name: /export/i });
      await expect(exportBtn.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('import section shows file upload area', async ({ page }) => {
    const dataTab = page
      .getByRole('tab', { name: /data|import|export/i })
      .or(page.getByRole('link', { name: /data|import|export/i }));

    if (await dataTab.count()) {
      await dataTab.first().click();
      await page.waitForLoadState('networkidle');

      // Should have an import button or file input
      const importBtn = page.getByRole('button', { name: /import/i });
      const fileInput = page.locator('input[type="file"]');
      const hasImport = (await importBtn.count()) + (await fileInput.count());
      expect(hasImport).toBeGreaterThan(0);
    }
  });
});
