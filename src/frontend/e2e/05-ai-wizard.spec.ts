import { test, expect } from '@playwright/test';
import { expectToast } from './helpers/pages';

test.describe('AI Wizard — New Entry Generation', () => {
  test.skip(!process.env.GROQ_API_KEY, 'GROQ_API_KEY required');

  // AI operations need long timeouts
  test.setTimeout(180_000);

  test('generate and save a new entry via the AI wizard', async ({ page }) => {
    // Login the editor fresh via UI (auth state from spec 03 predates AI config)
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Email').fill('editor@e2e.test');
    await page.locator('input[type="password"]').fill('E2ETestPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // Navigate to the AI wizard
    await page.goto('/entry/new/wizard');
    await page.waitForLoadState('networkidle');

    // === Step 1: Describe ===
    await expect(page.getByText('What would you like to create?')).toBeVisible({ timeout: 15_000 });

    // Type a description
    const textarea = page.locator('#wizard-desc');
    await textarea.fill(
      'A prompt that helps software developers write clear and concise git commit messages given a diff summary and context about the change'
    );

    // Polish the description
    const originalText = await textarea.inputValue();
    const polishBtn = page.locator('button[title="Polish description with AI"]');
    await polishBtn.click();
    // Wait for polish to complete — textarea content changes from the original
    await expect(textarea).not.toHaveValue(originalText, { timeout: 30_000 });

    // Click Generate
    await page.getByRole('button', { name: /^generate$/i }).click();

    // === Wait for generation to complete ===
    // The loading overlay appears, then Step 2 appears when done
    // Use the Accept button as indicator that review step loaded
    await expect(page.getByRole('button', { name: /^accept$/i })).toBeVisible({
      timeout: 120_000,
    });

    // === Step 2: Review & Refine ===
    // Click Refine (with or without answering questions)
    await page.getByRole('button', { name: /^refine$/i }).click();

    // Wait for refine loading to appear then disappear
    await page.waitForTimeout(2_000); // let loading overlay appear
    // Wait until the Refine button reappears (loading done, review step re-rendered)
    await expect(page.getByRole('button', { name: /^refine$/i })).toBeVisible({ timeout: 120_000 });
    await page.waitForTimeout(1_000); // let motion animations settle

    // Accept the result
    await page.getByRole('button', { name: /^accept$/i }).click({ force: true });

    // === Step 3: Save ===
    await expect(page.getByText('Save as new draft entry?')).toBeVisible({ timeout: 10_000 });

    // Click Save
    await page.getByRole('button', { name: /^save$/i }).click();

    // Verify success
    await expectToast(page, 'Entry created');

    // Verify redirected to entry editor
    await page.waitForURL(/\/entry\/[0-9a-f]{8}-/, { timeout: 10_000 });

    // Verify the entry title is populated
    const titleInput = page.locator("input[placeholder='Entry title']");
    await expect(titleInput).toBeVisible({ timeout: 5_000 });
    const titleValue = await titleInput.inputValue();
    expect(titleValue.length).toBeGreaterThan(0);

    // Auth state updated — save for future specs
    await page.context().storageState({ path: 'e2e/.auth/editor.json' });
  });
});
