import { test, expect } from "@playwright/test";
import { USERS } from "./helpers/seed-data";
import { loginViaUI, waitForAuthRedirect, waitForAppShell } from "./helpers/pages";
import { getSidebar } from "./helpers/sidebar";

/**
 * Register a unique user and land on the library page.
 * New users have onboardingCompleted = false and get starter templates.
 */
async function registerNewUser(page: import("@playwright/test").Page) {
  const unique = `onboard_${Date.now()}@test.dev`;

  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.locator("#name").fill("Onboarding Test");
  await page.locator("#email").fill(unique);
  await page.locator("#password").fill("StrongPass123!");
  await page.locator("#confirmPassword").fill("StrongPass123!");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/(library|dashboard)/, { timeout: 15_000 });
  await waitForAppShell(page);
}

test.describe("Onboarding — Tour Flow", () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // no pre-auth

  test("new user sees the onboarding tour tooltip on first login", async ({
    page,
  }) => {
    await registerNewUser(page);

    // The tour tooltip should appear (rendered as a dialog portal)
    const tourDialog = page.getByRole("dialog");
    await expect(tourDialog).toBeVisible({ timeout: 5_000 });

    // First step is "Your workspace" (sidebar step)
    await expect(tourDialog.getByText("Your workspace")).toBeVisible();
    await expect(tourDialog.getByText("1 of 4")).toBeVisible();
  });

  test("tour can be progressed through all 4 steps with Next button", async ({
    page,
  }) => {
    await registerNewUser(page);

    const tourDialog = page.getByRole("dialog");
    await expect(tourDialog).toBeVisible({ timeout: 5_000 });

    // Step 1: Your workspace
    await expect(tourDialog.getByText("Your workspace")).toBeVisible();
    await expect(tourDialog.getByText("1 of 4")).toBeVisible();
    await tourDialog.getByRole("button", { name: "Next" }).click();

    // Step 2: AI-Powered Creation
    await expect(tourDialog.getByText("AI-Powered Creation")).toBeVisible();
    await expect(tourDialog.getByText("2 of 4")).toBeVisible();
    await tourDialog.getByRole("button", { name: "Next" }).click();

    // Step 3: The Prompt Editor
    await expect(tourDialog.getByText("The Prompt Editor")).toBeVisible();
    await expect(tourDialog.getByText("3 of 4")).toBeVisible();
    await tourDialog.getByRole("button", { name: "Next" }).click();

    // Step 4: You're All Set!
    await expect(tourDialog.getByText("You're All Set!")).toBeVisible();
    await expect(tourDialog.getByText("4 of 4")).toBeVisible();

    // Last step shows "Finish" instead of "Next"
    await expect(tourDialog.getByRole("button", { name: "Finish" })).toBeVisible();
    await tourDialog.getByRole("button", { name: "Finish" }).click();

    // Tour should disappear after finishing
    await expect(tourDialog).not.toBeVisible({ timeout: 3_000 });
  });

  test("tour can be skipped via 'Skip tour' button", async ({ page }) => {
    await registerNewUser(page);

    const tourDialog = page.getByRole("dialog");
    await expect(tourDialog).toBeVisible({ timeout: 5_000 });

    // Click "Skip tour"
    await tourDialog.getByText("Skip tour").click();

    // Tour should disappear
    await expect(tourDialog).not.toBeVisible({ timeout: 3_000 });
  });

  test("tour does not reappear after page reload once completed", async ({
    page,
  }) => {
    await registerNewUser(page);

    const tourDialog = page.getByRole("dialog");
    await expect(tourDialog).toBeVisible({ timeout: 5_000 });

    // Wait for the completeOnboarding API call to finish before skipping
    const apiPromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/auth/complete-onboarding") && resp.status() === 204,
    );
    await tourDialog.getByText("Skip tour").click();
    await apiPromise;
    await expect(tourDialog).not.toBeVisible({ timeout: 3_000 });

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");
    await waitForAppShell(page);

    // Tour should NOT reappear (server has onboardingCompleted = true)
    await page.waitForTimeout(1_000);
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

test.describe("Onboarding — Starter Templates", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("new user gets a 'Getting Started' folder with starter entries", async ({
    page,
  }) => {
    await registerNewUser(page);

    // Dismiss the tour first
    const tourDialog = page.getByRole("dialog");
    await expect(tourDialog).toBeVisible({ timeout: 5_000 });
    await tourDialog.getByText("Skip tour").click();
    await expect(tourDialog).not.toBeVisible({ timeout: 3_000 });

    // Check sidebar for "Getting Started" folder
    const sidebar = getSidebar(page);
    await expect(sidebar.getByText("Getting Started")).toBeVisible();

    // Navigate to the Getting Started folder
    await sidebar.getByText("Getting Started").click();
    await page.waitForLoadState("networkidle");

    // Verify starter template entries are present
    await expect(page.getByText("Blog Post Writer")).toBeVisible();
    await expect(page.getByText("Code Review Assistant")).toBeVisible();
    await expect(page.getByText("Email Composer")).toBeVisible();
  });
});

test.describe("Onboarding — Existing Users", () => {
  test("existing admin user does not see the onboarding tour", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      storageState: "e2e/.auth/admin.json",
    });
    const page = await ctx.newPage();
    await page.goto("/library");
    await waitForAppShell(page);

    // Wait a moment for any potential tour to appear
    await page.waitForTimeout(1_000);

    // No tour dialog should be visible
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await ctx.close();
  });
});
