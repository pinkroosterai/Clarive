import { test, expect } from '@playwright/test';
import { ENTRIES, FOLDERS } from './helpers/seed-data';
import { getSidebar } from './helpers/sidebar';

test.describe('Library — Browsing & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/library');
    await page.waitForLoadState('networkidle');
  });

  test('library page loads and shows seeded entries in folder @smoke', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('All Prompts');

    // Navigate to a folder with known seeded entries
    // (root library may have many accumulated E2E entries pushing seeded ones off page 1)
    const sidebar = getSidebar(page);
    await sidebar.getByText(FOLDERS.contentWriting.name).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(ENTRIES.blogPostGenerator.title).first()).toBeVisible();
  });

  test('clicking an entry card navigates to the editor @smoke', async ({ page }) => {
    // Navigate to folder with known seeded entry
    const sidebar = getSidebar(page);
    await sidebar.getByText(FOLDERS.contentWriting.name).click();
    await page.waitForLoadState('networkidle');

    await page.getByText(ENTRIES.blogPostGenerator.title).first().click();
    await expect(page).toHaveURL(/\/entry\//);
  });

  test('search filters entries by title', async ({ page }) => {
    // Navigate to Content Writing folder for stable dataset
    const sidebar = getSidebar(page);
    await sidebar.getByText(FOLDERS.contentWriting.name).click();
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder('Search prompts…');
    await searchInput.fill('Blog');
    await page.waitForTimeout(400);

    // "Blog Post Generator" matches "Blog" — should be visible
    await expect(page.getByText(ENTRIES.blogPostGenerator.title).first()).toBeVisible();

    // Clear and search for something that doesn't match any Content Writing entry
    await searchInput.fill('xyznonexistent999');
    await page.waitForTimeout(400);
    await expect(page.getByText('No prompts match your filters.')).toBeVisible();
  });

  test('status filter shows only drafts', async ({ page }) => {
    // Navigate to Data Analysis folder — has both draft and published entries
    const sidebar = getSidebar(page);
    await sidebar.getByText(FOLDERS.dataAnalysis.name).click();
    await page.waitForLoadState('networkidle');

    // Verify both entries are visible before filtering
    await expect(page.getByText(ENTRIES.csvDataSummarizer.title).first()).toBeVisible();
    await expect(page.getByText(ENTRIES.salesReportAnalyzer.title).first()).toBeVisible();

    // Apply draft filter
    const statusSelect = page.locator("button[role='combobox']").first();
    await statusSelect.click();
    await page.getByRole('option', { name: 'Draft' }).click();
    await page.waitForTimeout(200);

    // Draft entry should be visible, published entry should not
    await expect(page.getByText(ENTRIES.csvDataSummarizer.title).first()).toBeVisible();
    await expect(page.getByText(ENTRIES.salesReportAnalyzer.title).first()).not.toBeVisible();
  });

  test('clicking a folder in sidebar navigates to that folder', async ({ page }) => {
    const sidebar = getSidebar(page);
    await sidebar.getByText(FOLDERS.contentWriting.name).click();

    await expect(page).toHaveURL(/\/library\/folder\//);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(FOLDERS.contentWriting.name);
  });

  test("'All Prompts' sidebar link returns to library root", async ({ page }) => {
    const sidebar = getSidebar(page);
    await sidebar.getByText(FOLDERS.contentWriting.name).click();
    await expect(page).toHaveURL(/\/library\/folder\//);

    await sidebar.getByText('All Prompts').click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('All Prompts');
  });

  test('search with no results shows empty state', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search prompts…');
    await searchInput.fill('xyznonexistent999');
    await page.waitForTimeout(400);

    await expect(page.getByText('No prompts match your filters.')).toBeVisible();
  });
});
