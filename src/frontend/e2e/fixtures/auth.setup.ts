import { test as setup, expect } from "@playwright/test";
import { USERS } from "../helpers/seed-data";
import { loginViaUI, waitForAuthRedirect } from "../helpers/pages";

const AUTH_DIR = "e2e/.auth";

/**
 * Global setup project — runs before all test projects.
 * Logs in as each seeded user role and persists browser state to disk.
 */

setup("authenticate as admin", async ({ page }) => {
  await loginViaUI(page, USERS.admin.email, USERS.admin.password);
  await waitForAuthRedirect(page);
  await expect(page).toHaveURL(/\/(library|dashboard)/);
  await page.context().storageState({ path: `${AUTH_DIR}/admin.json` });
});

setup("authenticate as editor", async ({ page }) => {
  await loginViaUI(page, USERS.editor.email, USERS.editor.password);
  await waitForAuthRedirect(page);
  await expect(page).toHaveURL(/\/(library|dashboard)/);
  await page.context().storageState({ path: `${AUTH_DIR}/editor.json` });
});

setup("authenticate as viewer", async ({ page }) => {
  await loginViaUI(page, USERS.viewer.email, USERS.viewer.password);
  await waitForAuthRedirect(page);
  await expect(page).toHaveURL(/\/(library|dashboard)/);
  await page.context().storageState({ path: `${AUTH_DIR}/viewer.json` });
});
