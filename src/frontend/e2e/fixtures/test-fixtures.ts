import { test as base, expect, Page } from "@playwright/test";
import { waitForAppShell } from "../helpers/pages";

/**
 * Custom fixtures that extend Playwright's base test with role-specific pages.
 *
 * Usage:
 *   import { test, expect } from "../fixtures/test-fixtures";
 *
 *   test("admin can do X", async ({ adminPage }) => { ... });
 *   test("viewer can see Y", async ({ viewerPage }) => { ... });
 */

type RoleFixtures = {
  /** Page authenticated as admin (default — same as `page` in chromium project) */
  adminPage: Page;
  /** Page authenticated as editor */
  editorPage: Page;
  /** Page authenticated as viewer */
  viewerPage: Page;
};

export const test = base.extend<RoleFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/admin.json",
    });
    const page = await context.newPage();
    await page.goto("/library");
    await waitForAppShell(page);
    await use(page);
    await context.close();
  },

  editorPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/editor.json",
    });
    const page = await context.newPage();
    await page.goto("/library");
    await waitForAppShell(page);
    await use(page);
    await context.close();
  },

  viewerPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/viewer.json",
    });
    const page = await context.newPage();
    await page.goto("/library");
    await waitForAppShell(page);
    await use(page);
    await context.close();
  },
});

export { expect };
