import { test, expect } from '@playwright/test';
import { radixClick } from './helpers/radix';

const GROQ_MODEL_ID = process.env.GROQ_MODEL_ID ?? 'openai/gpt-oss-120b';
const EXTRA_MODEL_ID = 'openai/gpt-oss-20b';

test.describe('Super Admin — AI Model Configuration', () => {
  test.skip(!process.env.GROQ_API_KEY, 'GROQ_API_KEY required');

  test('add models to provider and assign to all actions via Quick Setup', async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    await context.addInitScript(() =>
      sessionStorage.setItem('cl_setup_wizard_dismissed', 'true')
    );
    const page = await context.newPage();

    await page.goto('/super?tab=ai');
    await page.waitForLoadState('networkidle');

    // --- Step 1: Expand the Groq provider card ---
    const groqRow = page.locator('div').filter({ hasText: /^Groq\s*Active/ }).first();
    await groqRow.locator('button').first().click();
    await expect(page.getByText('Add Model')).toBeVisible({ timeout: 5_000 });

    // --- Step 2: Fetch models from provider ---
    await page.getByTitle('Fetch available models from provider').click();
    await expect(page.getByText(/select model to add/i)).toBeVisible({ timeout: 15_000 });

    // --- Step 3: Add primary model (GROQ_MODEL_ID) ---
    await page.getByText(/select model to add/i).click();
    await page.getByPlaceholder('Search models...').fill(GROQ_MODEL_ID);
    await page.waitForTimeout(300); // cmdk search debounce
    await page.locator('[cmdk-item]').filter({ hasText: GROQ_MODEL_ID }).first().click();
    await expect(page.locator('td', { hasText: GROQ_MODEL_ID }).first()).toBeVisible({
      timeout: 5_000,
    });

    // --- Step 4: Add secondary model (openai/gpt-oss-20b) ---
    // Use the combobox button with role selector and click it
    const addModelCombo = page.locator('button[role="combobox"]').first();
    await addModelCombo.click({ force: true });
    await page.waitForTimeout(300); // Radix popover open animation
    // If popover didn't open, try dispatching pointer events
    const searchVisible = await page.getByPlaceholder('Search models...').isVisible().catch(() => false);
    if (!searchVisible) {
      await radixClick(addModelCombo);
      await page.waitForTimeout(300); // Radix popover open animation
    }
    await expect(page.getByPlaceholder('Search models...')).toBeVisible({ timeout: 5_000 });
    await page.getByPlaceholder('Search models...').fill(EXTRA_MODEL_ID);
    await page.waitForTimeout(500); // cmdk search debounce
    await page.locator('[cmdk-item]').filter({ hasText: EXTRA_MODEL_ID }).first().click();
    await expect(page.locator('td', { hasText: EXTRA_MODEL_ID }).first()).toBeVisible({
      timeout: 5_000,
    });

    // --- Step 4b: Enable function calling + structured response on primary model ---
    // Quick Setup only shows models with these capabilities enabled.
    // Each model row has 3 switches: [reasoning, functionCalling, structuredResponse]
    const primaryModelRow = page.locator('tr').filter({ hasText: GROQ_MODEL_ID }).first();
    const switches = primaryModelRow.locator('[role="switch"]');
    // Toggle function calling (index 1)
    await switches.nth(1).click();
    // Toggle structured response (index 2)
    await switches.nth(2).click();

    // --- Step 5: Quick Setup — assign primary model to all 8 actions ---
    await page.keyboard.press('Escape');

    const configSection = page.getByText('CONFIGURATION');
    await configSection.scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /quick setup/i }).click();

    await page.getByText(/select model for all actions/i).click();
    await page.getByPlaceholder('Search models...').fill(GROQ_MODEL_ID);
    await page.waitForTimeout(300); // cmdk search debounce
    await page.locator('[cmdk-item]').filter({ hasText: GROQ_MODEL_ID }).first().click();

    // --- Step 6: Save changes ---
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByRole('button', { name: /save changes/i })).toBeDisabled({
      timeout: 10_000,
    });

    // --- Step 7: Verify ---
    // No warning banner about unassigned actions
    await expect(page.getByText(/actions? need.*model assignment/i)).not.toBeVisible();
    // Both models appear in provider card header
    await expect(page.getByText('2 models')).toBeVisible();

    await context.close();
  });
});
