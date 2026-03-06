import { Page, expect } from "@playwright/test";

/**
 * Lightweight locator helpers — not full page objects, just repeated patterns.
 */

/** Wait for the app shell to be fully loaded (sidebar visible). */
export async function waitForAppShell(page: Page): Promise<void> {
  await expect(page.locator("[data-sidebar='sidebar']").first()).toBeVisible({
    timeout: 10_000,
  });
}

/** Get the visible toast message text. */
export async function getToastMessage(page: Page): Promise<string> {
  const toast = page.locator("[data-sonner-toast]").first();
  await toast.waitFor({ state: "visible", timeout: 5_000 });
  return (await toast.textContent()) ?? "";
}

/** Assert a toast with matching text appears. */
export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  const toast = page.locator("[data-sonner-toast]").first();
  await toast.waitFor({ state: "visible", timeout: 5_000 });
  if (typeof text === "string") {
    await expect(toast).toContainText(text);
  } else {
    await expect(toast).toHaveText(text);
  }
}

/** Navigate to library root and wait for content to load. */
export async function goToLibrary(page: Page): Promise<void> {
  await page.goto("/library");
  await page.waitForLoadState("networkidle");
}

/** Navigate to an entry editor by clicking its title in the library. */
export async function openEntryByTitle(page: Page, title: string): Promise<void> {
  await page.getByRole("link", { name: title }).first().click();
  await page.waitForURL(/\/entry\//);
}

/** Fill in the login form and submit. */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
}

/** Wait for navigation to complete after login. */
export async function waitForAuthRedirect(page: Page): Promise<void> {
  await page.waitForURL(/\/(library|dashboard)/, { timeout: 15_000 });
}
