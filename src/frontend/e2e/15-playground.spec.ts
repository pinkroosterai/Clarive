import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { waitForAppShell, loginViaUI } from './helpers/pages';
import { createEntryViaAPI } from './helpers/api';

const GROQ_MODEL_ID = process.env.GROQ_MODEL_ID ?? 'openai/gpt-oss-120b';

const ADMIN = { email: 'admin@e2e.test', password: 'E2ETestPassword123!' };

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
    // Navigate to app — if auth state is stale (snapshot restore), log in via UI
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Detect if we landed on login page (stale JWT + consumed refresh token after snapshot restore)
    if (page.url().includes('/login')) {
      await loginViaUI(page, ADMIN.email, ADMIN.password);
      await page.waitForURL(/\/$/, { timeout: 15_000 });
      await waitForAppShell(page);
    }

    // Create entry with template variables via API (faster than UI)
    const result = await createEntryViaAPI(page, {
      title: 'Matrix Test Entry',
      content: 'Write a {{tone}} explanation about {{topic}} for beginners.',
    });

    entryId = result.entryId;
    expect(entryId).toBeTruthy();
  });

  test('navigate to test matrix and verify layout', async () => {
    // Navigate to the test matrix
    await page.goto(`/entry/${entryId}/test`);
    await page.waitForLoadState('networkidle');

    // Verify matrix page loaded — URL should stay on /test
    await page.waitForURL(/\/entry\/[a-f0-9-]+\/test$/, { timeout: 10_000 });

    // Verify action bar has Run All button
    await expect(page.getByRole('button', { name: 'Run All', exact: true })).toBeVisible({ timeout: 10_000 });

    // Verify sidebar tabs exist (Setup is default active tab)
    await expect(page.getByRole('tab', { name: /setup/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /config/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /preview/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /results/i })).toBeVisible();

    // Verify Setup tab contains Add Version and Add Model pickers
    await expect(page.getByRole('combobox').filter({ hasText: 'Add Version' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('combobox').filter({ hasText: 'Add Model' })).toBeVisible();

    // Verify template variables section is visible with 2 empty fields
    await expect(page.getByText(/variables \(2\)/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/2 empty/i)).toBeVisible();
  });

  test('add version and model to create matrix cell', async () => {
    // Add a version (Main tab)
    await page.getByRole('combobox').filter({ hasText: 'Add Version' }).click();
    await page.getByRole('option', { name: 'Main' }).click();

    // No cell exists yet (cells = versions × models), but verify the version
    // label appeared in the grid header area
    await page.waitForTimeout(500);

    // Add a model
    await page.getByRole('combobox').filter({ hasText: 'Add Model' }).click();
    await page.getByRole('option', { name: GROQ_MODEL_ID }).click();

    // Verify model column appeared — cell button should exist with version×model label
    // Use .first() because the cell has both the main button and a hover "Run" overlay button
    await expect(
      page.getByRole('button', { name: new RegExp(`Main on ${GROQ_MODEL_ID}`) }).first()
    ).toBeVisible({ timeout: 3_000 });

    // Run All should now be enabled (we have at least one cell)
    await expect(page.getByRole('button', { name: 'Run All', exact: true })).toBeEnabled();
  });

  test('fill template variables and run matrix cell', async () => {
    // Fill template field inputs
    const inputs = page.locator('input[placeholder="value"]');
    await expect(inputs).toHaveCount(2, { timeout: 5_000 });

    await inputs.first().fill('quantum computing');
    await inputs.last().fill('friendly');

    // "2 empty" badge should disappear after filling both fields
    await expect(page.getByText(/\d+ empty/i)).not.toBeVisible({ timeout: 3_000 });

    // Click the cell to select it (use .first() — cell has a hover "Run" overlay button too)
    const cell = page.getByRole('button', { name: new RegExp(`Main on ${GROQ_MODEL_ID}`) }).first();
    await cell.click();

    // Sidebar should auto-switch to Results tab and show the empty cell message
    await expect(page.getByText(/not scored yet/i)).toBeVisible({ timeout: 3_000 });

    // Double-click to run the cell
    await cell.dblclick();

    // Wait for completion — the Evaluation section header and score label appear.
    // Skip asserting the transient "Evaluating..." state — fast models (e.g. Groq)
    // may complete before the 100ms poll interval catches it.
    await expect(page.getByText(/good|fair|poor/i)).toBeVisible({ timeout: 120_000 });
  });

  test('verify history panel shows the run', async () => {
    // Toggle history panel
    await page.getByRole('button', { name: /toggle history/i }).click();

    // Verify history section appears with at least 1 run
    await expect(page.getByText(/test history/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(GROQ_MODEL_ID).first()).toBeVisible();
  });
});
