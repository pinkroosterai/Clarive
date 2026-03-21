import { test, expect } from '@playwright/test';
import { waitForAppShell } from './helpers/pages';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL_ID = process.env.GROQ_MODEL_ID;

test.describe('Setup Wizard', () => {
  test.skip(!GROQ_API_KEY, 'GROQ_API_KEY env var required');

  test('configure AI provider and complete wizard', async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await context.newPage();

    await page.goto('/setup-wizard');
    await page.waitForLoadState('networkidle');

    // Step 0: Welcome — click "Get Started"
    await expect(page.getByText('Configure Your Instance')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /get started/i }).click();

    // Step 1: AI Provider — fill Groq details
    await expect(page.getByRole('heading', { name: 'AI Provider' })).toBeVisible();
    await page.getByPlaceholder('e.g., OpenAI, Azure OpenAI, Ollama').fill('Groq');
    await page.getByPlaceholder('Leave empty for default OpenAI endpoint').fill('https://api.groq.com/openai/v1');
    await page.getByPlaceholder('sk-...').fill(GROQ_API_KEY!);

    // Save & Continue — wait for next step to appear
    await page.getByRole('button', { name: /save & continue/i }).click();

    // Step 2: Email — skip (default is "none")
    await expect(page.getByRole('heading', { name: 'Email Service' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /skip/i }).click();

    // Step 3: Google OAuth — skip
    await expect(page.getByRole('heading', { name: /Google OAuth/i })).toBeVisible();
    await page.getByRole('button', { name: /skip/i }).click();

    // Step 4: Complete — verify configured services listed
    await expect(page.getByRole('heading', { name: 'Setup Complete' })).toBeVisible();
    await expect(page.getByText('Configured: AI Provider')).toBeVisible();
    await page.getByRole('button', { name: /go to dashboard/i }).click();

    // Should be on dashboard now
    await waitForAppShell(page);
    await page.waitForURL(/\/$/, { timeout: 10_000 });

    // Verify setup-status API confirms setup is done
    const baseURL = page.url().replace(/\/$/, '');
    const response = await page.request.get(`${baseURL}/api/super/setup-status`);
    const data = await response.json();
    expect(data.requiresSetup).toBe(false);

    // Save updated auth state (may have new cookies/tokens)
    await page.context().storageState({ path: 'e2e/.auth/admin.json' });
    await context.close();
  });
});
