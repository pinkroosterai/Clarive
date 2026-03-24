import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { waitForAppShell, expectToast } from './helpers/pages';
import { createEntryViaAPI } from './helpers/api';

const GROQ_MODEL_ID = process.env.GROQ_MODEL_ID ?? 'openai/gpt-oss-120b';

test.describe('Test Matrix — Core Happy Path', () => {
  test.skip(!process.env.GROQ_API_KEY, 'GROQ_API_KEY required');
  test.describe.configure({ mode: 'serial' });

  // AI operations need long timeouts
  test.setTimeout(180_000);

  let page: Page;
  let context: BrowserContext;
  let entryId: string;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    // Dismiss setup wizard for super admin
    await context.addInitScript(() =>
      sessionStorage.setItem('cl_setup_wizard_dismissed', 'true')
    );
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('create entry with template variables for matrix testing', async () => {
    // Navigate to app first so localStorage is accessible for API helper
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Create entry with template variables via API (faster than UI)
    const result = await createEntryViaAPI(page, {
      title: 'Matrix Test Entry',
      content: 'Write a {{tone}} explanation about {{topic}} for beginners.',
    });

    entryId = result.entryId;
    expect(entryId).toBeTruthy();
  });

  test('navigate to test matrix and verify toolbar', async () => {
    // Navigate to the test matrix
    await page.goto(`/entry/${entryId}/test`);
    await page.waitForLoadState('networkidle');

    // Verify matrix page loaded — URL should stay on /test
    await page.waitForURL(/\/entry\/[a-f0-9-]+\/test$/, { timeout: 10_000 });

    // Verify toolbar loaded with Add Version, Add Model, and Run All
    await expect(page.getByText('Add Version')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Add Model')).toBeVisible();
    await expect(page.getByRole('button', { name: /run all/i })).toBeVisible();

    // Verify template variables section is visible with 2 required fields
    await expect(page.getByText(/template variables/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/2 required/i)).toBeVisible();

    // Verify empty state message
    await expect(page.getByText(/add versions and models/i)).toBeVisible();
  });

  test('add version and model to create matrix cell', async () => {
    // Add a version (Main tab)
    await page.getByRole('combobox').filter({ hasText: 'Add Version' }).click();
    await page.getByRole('option', { name: 'Main' }).click();

    // Verify version row appeared
    await expect(page.getByText('Main')).toBeVisible({ timeout: 3_000 });

    // Add a model
    await page.getByRole('combobox').filter({ hasText: 'Add Model' }).click();
    await page.getByRole('option', { name: GROQ_MODEL_ID }).click();

    // Verify model column appeared and cell exists
    await expect(page.getByText(GROQ_MODEL_ID)).toBeVisible({ timeout: 3_000 });

    // Run All should now be enabled (we have at least one cell)
    await expect(page.getByRole('button', { name: /run all/i })).toBeEnabled();
  });

  test('fill template variables and run matrix cell', async () => {
    // Fill template field inputs
    const inputs = page.locator('input[placeholder="value"]');
    await expect(inputs).toHaveCount(2, { timeout: 5_000 });

    await inputs.first().fill('quantum computing');
    await inputs.last().fill('friendly');

    // Required badges should disappear
    await expect(page.getByText(/required/i).first()).not.toBeVisible({ timeout: 3_000 });

    // Click the cell to select it
    const cell = page.getByRole('button', { name: new RegExp(`Main on ${GROQ_MODEL_ID}`) });
    await cell.click();

    // Detail drawer should show the empty cell message
    await expect(page.getByText(/hasn't been run yet/i)).toBeVisible({ timeout: 3_000 });

    // Double-click to run the cell
    await cell.dblclick();

    // Cell should show running state (spinner)
    // Detail drawer should show streaming content
    await expect(page.getByText(/generating/i)).toBeVisible({ timeout: 15_000 });

    // Wait for completion — cell status changes from running to completed
    // The detail drawer should show response content and a score
    await expect(page.getByText(/score/i)).toBeVisible({ timeout: 120_000 });
  });

  test('verify history panel shows the run', async () => {
    // Toggle history panel
    await page.getByRole('button', { name: /toggle history/i }).click();

    // Verify history section appears with at least 1 run
    await expect(page.getByText(/test history/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(GROQ_MODEL_ID).first()).toBeVisible();
  });
});
