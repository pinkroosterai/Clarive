import { test, expect } from '@playwright/test';
import { mockWizardEnhanceRoutes, MOCK_GENERATE_RESPONSE } from './helpers/wizard-mocks';

const EXISTING_ENTRY = {
  id: 'e2e-enhance-00000000-0000-0000-0000-000000000099',
  title: 'My Existing Prompt',
  systemMessage: null,
  prompts: [{ id: 'p-existing-1', content: 'Write something about {{topic}}.', order: 0 }],
};

test.describe('AI Wizard — Enhance Mode', () => {
  test.beforeEach(async ({ page }) => {
    await mockWizardEnhanceRoutes(page, EXISTING_ENTRY);
  });

  test('enhance page loads, analyzes entry, and shows review step', async ({ page }) => {
    await page.goto(`/entry/${EXISTING_ENTRY.id}/enhance`);

    // Wait for the review step to load with quality analysis
    // (the "Analyzing entry..." loading state flashes too quickly with mocked responses)
    await expect(page.getByText('Quality Analysis')).toBeVisible({
      timeout: 15_000,
    });

    // Step progress should show 2 steps: Review and Save (exact match)
    await expect(page.getByText('Review', { exact: true })).toBeVisible();
    await expect(page.getByText('Save', { exact: true })).toBeVisible();

    // Generated draft title should be in the read-only input
    await expect(page.locator("input[placeholder='Entry title']")).toHaveValue(
      MOCK_GENERATE_RESPONSE.draft.title
    );

    // Evaluation dimensions should be displayed
    await expect(page.getByText('Clarity').first()).toBeVisible();
    await expect(page.getByText('Specificity').first()).toBeVisible();
  });

  test('accept enhanced draft and save applies changes', async ({ page }) => {
    await page.goto(`/entry/${EXISTING_ENTRY.id}/enhance`);
    await page.getByText('Quality Analysis').waitFor({ timeout: 15_000 });

    // Click Accept to go to save step
    await page.getByRole('button', { name: /Accept/i }).click();

    // Should show enhance save dialog
    await expect(page.getByText('Apply enhanced version to current entry?')).toBeVisible({
      timeout: 5_000,
    });

    // Draft title should be shown
    await expect(page.getByText(MOCK_GENERATE_RESPONSE.draft.title)).toBeVisible();

    // Click Apply
    await page.getByRole('button', { name: /Apply/i }).click();

    // Verify toast
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toContainText('Entry enhanced');

    // Should navigate back to the entry editor
    await expect(page).toHaveURL(new RegExp(`/entry/${EXISTING_ENTRY.id}`));
  });

  test('close button navigates back to entry editor', async ({ page }) => {
    await page.goto(`/entry/${EXISTING_ENTRY.id}/enhance`);
    await page.getByText('Quality Analysis').waitFor({ timeout: 15_000 });

    // Click X close button — should show discard dialog since we have a draft
    await page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-x') })
      .first()
      .click();

    // Discard dialog
    await expect(page.getByText('Discard changes?')).toBeVisible();

    // Click Discard
    await page.getByRole('button', { name: /Discard/i }).click();

    // Should navigate to the entry editor
    await expect(page).toHaveURL(new RegExp(`/entry/${EXISTING_ENTRY.id}`));
  });
});
