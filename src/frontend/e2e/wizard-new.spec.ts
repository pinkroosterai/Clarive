import { test, expect } from '@playwright/test';
import {
  mockWizardNewRoutes,
  MOCK_PRE_GEN_RESPONSE,
  MOCK_GENERATE_RESPONSE,
  MOCK_CREATED_ENTRY,
} from './helpers/wizard-mocks';

test.describe('AI Wizard — New Mode', () => {
  test.beforeEach(async ({ page }) => {
    await mockWizardNewRoutes(page);
    await page.goto('/entry/new/wizard');
    await page.waitForLoadState('networkidle');
  });

  test('wizard page loads with step 1 (Describe)', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'AI Wizard' })).toBeVisible();

    // Step progress shows Describe as active (exact match to avoid other "Describe" elements)
    await expect(page.getByText('Describe', { exact: true })).toBeVisible();

    // Textarea and Generate button visible
    await expect(page.locator('#wizard-desc')).toBeVisible();
    await expect(page.getByRole('button', { name: /Generate/i })).toBeVisible();

    // Generate is disabled when textarea is empty
    await expect(page.getByRole('button', { name: /Generate/i })).toBeDisabled();
  });

  test('step 1: enter description and proceed to step 2 (Clarify)', async ({ page }) => {
    await page
      .locator('#wizard-desc')
      .fill('A prompt that helps write professional emails given a topic and tone');

    // Generate button should now be enabled
    await expect(page.getByRole('button', { name: /Generate/i })).toBeEnabled();

    await page.getByRole('button', { name: /Generate/i }).click();

    // Wait for step 2 to load
    await expect(page.getByText('Help us refine your prompt')).toBeVisible({ timeout: 10_000 });

    // Clarification questions from mock should appear
    for (const q of MOCK_PRE_GEN_RESPONSE.questions) {
      await expect(page.getByText(q.text)).toBeVisible();
    }

    // Suggestion chips should appear for first question
    for (const s of MOCK_PRE_GEN_RESPONSE.questions[0].suggestions) {
      await expect(page.getByText(s).first()).toBeVisible();
    }
  });

  test('step 2: answer questions and proceed to step 3 (Review)', async ({ page }) => {
    // Navigate to step 2
    await page.locator('#wizard-desc').fill('Test prompt description');
    await page.getByRole('button', { name: /Generate/i }).click();
    await expect(page.getByText('Help us refine your prompt')).toBeVisible({ timeout: 10_000 });

    // Click a suggestion chip for the first question
    await page.getByText('Formal').first().click();

    // Click Continue
    await page.getByRole('button', { name: /Continue/i }).click();

    // Wait for step 3 (Review) to load
    await expect(page.getByText('Quality Analysis')).toBeVisible({
      timeout: 10_000,
    });

    // Draft title should be in the read-only input
    await expect(page.locator("input[placeholder='Entry title']")).toHaveValue(
      MOCK_GENERATE_RESPONSE.draft.title
    );

    // Evaluation scores should be displayed (use .first() since dimension names may appear in feedback)
    await expect(page.getByText('Clarity').first()).toBeVisible();
    await expect(page.getByText('Specificity').first()).toBeVisible();
    await expect(page.getByText('Structure').first()).toBeVisible();
  });

  test('step 2: skip questions and proceed directly to review', async ({ page }) => {
    // Navigate to step 2
    await page.locator('#wizard-desc').fill('Test prompt description');
    await page.getByRole('button', { name: /Generate/i }).click();
    await expect(page.getByText('Help us refine your prompt')).toBeVisible({ timeout: 10_000 });

    // Click Skip
    await page.getByRole('button', { name: /Skip/i }).click();

    // Should land on review step
    await expect(page.getByText('Quality Analysis')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('step 3: review shows generated draft with quality scores', async ({ page }) => {
    // Navigate to step 3
    await page.locator('#wizard-desc').fill('Test prompt description');
    await page.getByRole('button', { name: /Generate/i }).click();
    await page.getByText('Help us refine your prompt').waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Skip/i }).click();
    await page.getByText('Quality Analysis').waitFor({ timeout: 10_000 });

    // Verify quality scores are present
    const dimensions = [
      'Clarity',
      'Specificity',
      'Structure',
      'Completeness',
      'Autonomy',
      'Faithfulness',
    ];
    for (const dim of dimensions) {
      await expect(page.getByText(dim).first()).toBeVisible();
    }

    // Accept button should be visible
    await expect(page.getByRole('button', { name: /Accept/i })).toBeVisible();

    // Refine button should be visible
    await expect(page.getByRole('button', { name: /Refine/i })).toBeVisible();
  });

  test('step 3: accept draft and proceed to step 4 (Save)', async ({ page }) => {
    // Navigate to step 3
    await page.locator('#wizard-desc').fill('Test prompt description');
    await page.getByRole('button', { name: /Generate/i }).click();
    await page.getByText('Help us refine your prompt').waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Skip/i }).click();
    await page.getByText('Quality Analysis').waitFor({ timeout: 10_000 });

    // Click Accept
    await page.getByRole('button', { name: /Accept/i }).click();

    // Should land on save step
    await expect(page.getByText('Save as new draft entry?')).toBeVisible({ timeout: 5_000 });

    // Draft title should be shown
    await expect(page.getByText(MOCK_GENERATE_RESPONSE.draft.title)).toBeVisible();

    // Save button should be visible
    await expect(page.getByRole('button', { name: /Save/i })).toBeVisible();
  });

  test('step 4: save creates entry and navigates to editor', async ({ page }) => {
    // Navigate through all steps to step 4
    await page.locator('#wizard-desc').fill('Test prompt description');
    await page.getByRole('button', { name: /Generate/i }).click();
    await page.getByText('Help us refine your prompt').waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Skip/i }).click();
    await page.getByText('Quality Analysis').waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Accept/i }).click();
    await page.getByText('Save as new draft entry?').waitFor({ timeout: 5_000 });

    // Click Save
    await page.getByRole('button', { name: /^Save$/i }).click();

    // Verify toast
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Entry created');

    // Should navigate to the new entry editor
    await expect(page).toHaveURL(new RegExp(`/entry/${MOCK_CREATED_ENTRY.id}`));
  });

  test('step progress indicator shows correct states', async ({ page }) => {
    // Step 1: all step labels should be visible (exact match avoids hint/label conflicts)
    await expect(page.getByText('Describe', { exact: true })).toBeVisible();
    await expect(page.getByText('Clarify', { exact: true })).toBeVisible();
    await expect(page.getByText('Review', { exact: true })).toBeVisible();
    await expect(page.getByText('Save', { exact: true })).toBeVisible();

    // Navigate to step 2
    await page.locator('#wizard-desc').fill('Test prompt description');
    await page.getByRole('button', { name: /Generate/i }).click();
    await page.getByText('Help us refine your prompt').waitFor({ timeout: 10_000 });

    // Step 2: "Clarify" should now be active (indicated by heading)
    await expect(page.getByText('Help us refine your prompt')).toBeVisible();
  });

  test('close button with draft shows discard confirmation', async ({ page }) => {
    // Navigate to step 3 (so we have a draft)
    await page.locator('#wizard-desc').fill('Test prompt description');
    await page.getByRole('button', { name: /Generate/i }).click();
    await page.getByText('Help us refine your prompt').waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: /Skip/i }).click();
    await page.getByText('Quality Analysis').waitFor({ timeout: 10_000 });

    // Click the X close button
    await page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-x') })
      .first()
      .click();

    // Discard dialog should appear
    await expect(page.getByText('Discard changes?')).toBeVisible();
    await expect(page.getByText('You will lose the generated draft')).toBeVisible();

    // Click "Keep editing" to stay
    await page.getByRole('button', { name: /Keep editing/i }).click();

    // Should still be on the review step
    await expect(page.getByText('Quality Analysis')).toBeVisible();
  });
});
