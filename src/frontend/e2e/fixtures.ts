import { test as base, expect, BrowserContext, Page } from '@playwright/test';
import { loginViaUI, waitForAppShell, completeOnboarding, dismissTour } from './helpers/pages';
import { ENTRY_TITLE_INPUT, TOUR_CLOSE_BTN } from './helpers/locators';

// Re-export expect so specs only need one import
export { expect };

// ── Shared credentials ──────────────────────────────────────────────

export const ADMIN = { email: 'admin@e2e.test', password: 'E2ETestPassword123!' };
export const EDITOR = { email: 'editor@e2e.test', password: 'E2ETestPassword123!' };

// ── Fixture types ───────────────────────────────────────────────────

type ClariveFixtures = {
  /** Editor page: logged in, dashboard loaded, ready to use. */
  editorPage: Page;
  /** Admin page: logged in, onboarding complete, tour dismissed, dashboard loaded. */
  adminPage: Page;
  /** Two browser contexts for multi-user collaboration tests. */
  collaborationContexts: {
    admin: { context: BrowserContext; page: Page };
    editor: { context: BrowserContext; page: Page };
  };
};

// ── Extended test ───────────────────────────────────────────────────

export const test = base.extend<ClariveFixtures>({
  editorPage: async ({ page }, use) => {
    await loginViaUI(page, EDITOR.email, EDITOR.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);
    await use(page);
  },

  adminPage: async ({ page }, use) => {
    await loginViaUI(page, ADMIN.email, ADMIN.password);
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await waitForAppShell(page);
    await completeOnboarding(page);
    await dismissTour(page);
    await use(page);
  },

  collaborationContexts: async ({ browser }, use) => {
    // Create admin context
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginViaUI(adminPage, ADMIN.email, ADMIN.password);
    await adminPage.waitForURL(/\/$/, { timeout: 15_000 });
    await completeOnboarding(adminPage);
    await waitForAppShell(adminPage);
    await dismissTour(adminPage);

    // Create editor context
    const editorContext = await browser.newContext();
    const editorPage = await editorContext.newPage();
    await loginViaUI(editorPage, EDITOR.email, EDITOR.password);
    await editorPage.waitForURL(/\/$/, { timeout: 15_000 });
    await completeOnboarding(editorPage);
    await waitForAppShell(editorPage);
    await dismissTour(editorPage);

    await use({
      admin: { context: adminContext, page: adminPage },
      editor: { context: editorContext, page: editorPage },
    });

    // Teardown: close both contexts
    await adminContext.close();
    await editorContext.close();
  },
});
