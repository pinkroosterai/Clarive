import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { waitForAppShell, expectToast } from './helpers/pages';
import { createEntryViaAPI } from './helpers/api';

const GROQ_MODEL_ID = process.env.GROQ_MODEL_ID ?? 'openai/gpt-oss-120b';

test.describe('Prompt Playground — Core Happy Path', () => {
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

  test('create entry with template variables for playground testing', async () => {
    // Create entry with template variables via API (faster than UI)
    const result = await createEntryViaAPI(page, {
      title: 'Playground Test Entry',
      content: 'Write a {{tone}} explanation about {{topic}} for beginners.',
    });

    entryId = result.entryId;
    expect(entryId).toBeTruthy();
  });

  test('navigate to playground and verify model selector', async () => {
    // Navigate to the playground
    await page.goto(`/entry/${entryId}/test`);
    await page.waitForLoadState('networkidle');

    // Verify playground loaded — URL should stay on /test (not redirect back)
    await page.waitForURL(/\/entry\/[a-f0-9-]+\/test$/, { timeout: 10_000 });

    // Verify toolbar loaded with Run and Enqueue buttons
    await expect(page.getByRole('button', { name: /^run$/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /enqueue/i })).toBeVisible();

    // Verify a model is selected (auto-selected from configured models)
    // The model trigger should show the model ID, not "Select model"
    await expect(page.getByText(GROQ_MODEL_ID)).toBeVisible({ timeout: 5_000 });

    // Verify template variables section is visible with 2 required fields
    await expect(page.getByText(/template variables/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/2 required/i)).toBeVisible();
  });

  test('fill template variables and run streaming test', async () => {
    // Fill template field inputs — labels are {{topic}} and {{tone}}
    // Inputs are text inputs with placeholder "value" (since type is string)
    const inputs = page.locator('input[placeholder="value"]');
    await expect(inputs).toHaveCount(2, { timeout: 5_000 });

    // Fill both template fields
    await inputs.first().fill('quantum computing');
    await inputs.last().fill('friendly');

    // Required badges should disappear
    await expect(page.getByText(/required/i).first()).not.toBeVisible({ timeout: 3_000 });

    // Run button should be enabled now
    const runButton = page.getByRole('button', { name: /^run$/i });
    await expect(runButton).toBeEnabled({ timeout: 3_000 });

    // Click Run
    await runButton.click();

    // Verify streaming starts — status bar at bottom shows "Generating response..."
    await expect(page.getByText(/generating response/i)).toBeVisible({ timeout: 15_000 });

    // Wait for streaming to complete — look for the run summary bar with token counts
    // The "Generating response..." text disappears and token output appears
    await expect(page.getByText(/\d+ output/)).toBeVisible({ timeout: 120_000 });

    // Verify elapsed time is shown in the run summary
    await expect(page.getByText(/^\d+s$/)).toBeVisible({ timeout: 5_000 });
  });

  test('verify history sidebar and judge scores', async () => {
    // Wait for judging to complete — the "Evaluating quality..." bar disappears
    // and a score appears in the run summary (X.X/10)
    await expect(page.getByText(/\d+\.\d\/10/)).toBeVisible({ timeout: 60_000 });

    // Toggle history sidebar
    await page.getByRole('button', { name: /toggle test history/i }).click();

    // Verify sidebar appears with run count
    await expect(page.getByText('History')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('(1)', { exact: true })).toBeVisible();

    // Verify the run entry shows the model name
    await expect(page.locator('.font-mono').filter({ hasText: GROQ_MODEL_ID })).toBeVisible({
      timeout: 5_000,
    });

    // Verify parameters are shown (temperature and max tokens)
    await expect(page.getByText(/t=\d/)).toBeVisible();
    await expect(page.getByText(/max=\d/)).toBeVisible();

    // Verify judge score badge on the run entry
    await expect(page.locator('[title*="Quality:"]')).toBeVisible({ timeout: 5_000 });
  });
});
