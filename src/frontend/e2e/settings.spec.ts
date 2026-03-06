import { test, expect } from "@playwright/test";
import { USERS, API_KEYS } from "./helpers/seed-data";
import { radixClick } from "./helpers/radix";

test.describe("Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
  });

  test("settings page loads and shows all tabs @smoke", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");

    for (const tab of ["Users", "API Keys", "Billing", "Audit Log", "Import/Export", "Account"]) {
      await expect(page.getByRole("tab", { name: new RegExp(tab) })).toBeVisible();
    }
  });

  test("Users tab shows seeded users", async ({ page }) => {
    await page.getByRole("tab", { name: /Users/ }).click();

    // All 3 seeded users should appear in the table (scope to table to avoid header nav)
    const table = page.locator("table");
    await expect(table.getByText(USERS.admin.name)).toBeVisible();
    await expect(table.getByText(USERS.editor.name)).toBeVisible();
    await expect(table.getByText(USERS.viewer.name)).toBeVisible();

    // Current user (admin) should have "(you)" marker
    await expect(table.getByText("(you)")).toBeVisible();
  });

  test("Billing tab shows credit balance", async ({ page }) => {
    await page.getByRole("tab", { name: /Billing/ }).click();

    await expect(page.getByText("Credit Balance")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("credits").first()).toBeVisible();
    await expect(page.getByText(/\d+ free \+ \d+ purchased/)).toBeVisible();
  });

  test("Account tab shows delete account with confirmation dialog", async ({ page }) => {
    await page.getByRole("tab", { name: /Account/ }).click();

    await expect(page.getByText("Delete Account").first()).toBeVisible();

    // Open the delete dialog
    await page.getByRole("button", { name: /Delete Account/i }).click();

    // Dialog description should be visible
    await expect(
      page.getByText("This will schedule your account for permanent deletion")
    ).toBeVisible();

    // Confirmation input
    const confirmInput = page.locator("#delete-confirm");
    await expect(confirmInput).toBeVisible();

    // Delete button should be disabled initially
    const deleteBtn = page
      .getByRole("alertdialog")
      .locator("button")
      .filter({ hasText: /Delete Account/i });
    await expect(deleteBtn).toBeDisabled();

    // Type the confirmation text
    await confirmInput.fill("DELETE");

    // Delete button should be enabled now
    await expect(deleteBtn).toBeEnabled();

    // Cancel — do NOT actually delete the account!
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();

    // Dialog should close
    await expect(
      page.getByText("This will schedule your account for permanent deletion")
    ).not.toBeVisible();
  });
});

test.describe("Settings — API Keys", () => {
  test.describe.configure({ mode: "serial" });

  const newKeyName = `E2E Key ${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: /API Keys/ }).click();
    // Wait for keys to load
    await expect(page.getByText(API_KEYS.production.name)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("API Keys tab shows seeded keys", async ({ page }) => {
    await expect(page.getByText(API_KEYS.production.name)).toBeVisible();
    await expect(page.getByText(API_KEYS.development.name)).toBeVisible();

    // Key column shows masked prefixes (e.g. pf_live••••a3f8)
    const table = page.locator("table");
    await expect(table.locator("tr").nth(1)).toBeVisible();
    await expect(table.locator("tr").nth(2)).toBeVisible();
  });

  test("create new API key → key displayed", async ({ page }) => {
    // Click Create API Key trigger
    await page.getByRole("button", { name: /Create API Key/i }).click();

    // Dialog should open
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill key name
    await dialog.locator("input").fill(newKeyName);

    // Click Create
    await dialog.getByRole("button", { name: /^Create$/i }).click();

    // Key should be displayed in success state
    await expect(page.getByText("API Key Created")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Copy this key now")).toBeVisible();

    // Click Done
    await page.getByRole("button", { name: "Done" }).click();

    // Key should appear in the table
    await expect(page.getByText(newKeyName)).toBeVisible();
  });

  test("delete the created API key", async ({ page }) => {
    // Find the row with the new key and click its delete button
    const row = page.locator("tr").filter({ hasText: newKeyName });
    await row.locator("button").last().click();

    // Confirm dialog
    await expect(page.getByText(new RegExp(`Revoke ${newKeyName}`))).toBeVisible();

    // Click "Revoke Key" — AlertDialogAction, need radixClick
    const revokeBtn = page
      .getByRole("alertdialog")
      .getByRole("button", { name: /Revoke/i });
    await radixClick(revokeBtn);

    // Verify toast
    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toContainText("API key revoked");

    // Key should be removed
    await expect(page.getByText(newKeyName)).not.toBeVisible({ timeout: 5_000 });
  });
});
