import { test, expect } from "@playwright/test";
import { radixClick } from "./helpers/radix";

test.describe("Trash — Delete, Restore & Permanent Delete", () => {
  test.describe.configure({ mode: "serial" });

  const entryTitle = `E2E Trash ${Date.now()}`;
  let entryId: string;

  test("create an entry and move it to trash from library", async ({
    page,
  }) => {
    // Create entry
    await page.goto("/entry/new");
    await page.waitForLoadState("networkidle");
    await page.locator("#title").fill(entryTitle);
    await page.getByRole("button", { name: "Create Entry" }).click();
    await page.waitForURL(/\/entry\/[0-9a-f]{8}-/);
    entryId = page.url().split("/entry/")[1];

    // Go to library
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    // Find the entry card and open its dropdown menu
    const card = page.locator(".group").filter({ hasText: entryTitle }).first();
    // The MoreHorizontal button is inside the card header
    const menuTrigger = card.locator("button").filter({ has: page.locator("svg") }).last();
    await menuTrigger.click({ force: true });

    // Click "Move to trash"
    await page.getByRole("menuitem", { name: /Move to trash/i }).click();

    // Verify toast
    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toContainText("Moved to trash");

    // Entry should no longer be visible in library
    await expect(page.getByText(entryTitle)).not.toBeVisible({ timeout: 5_000 });
  });

  test("trash page shows the deleted entry", async ({ page }) => {
    await page.goto("/trash");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trash");
    await expect(page.getByText(entryTitle)).toBeVisible();
  });

  test("restore entry from trash", async ({ page }) => {
    await page.goto("/trash");
    await page.waitForLoadState("networkidle");

    // Find the row with our entry and click its restore button
    const row = page.locator("div").filter({ hasText: entryTitle }).last();
    const restoreBtn = row.getByTitle("Restore");
    await restoreBtn.click();

    // Verify toast
    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toContainText("Entry restored");

    // Entry should no longer be in trash page content
    // (title may still appear in sidebar after restore, so scope to main content)
    await expect(page.locator("main").getByText(entryTitle)).not.toBeVisible({ timeout: 5_000 });

    // Verify it's back in library
    await page.goto("/library");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(entryTitle).first()).toBeVisible();
  });

  test("permanently delete entry from trash", async ({ page }) => {
    // First, trash the entry again
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    const card = page.locator(".group").filter({ hasText: entryTitle }).first();
    const menuTrigger = card.locator("button").filter({ has: page.locator("svg") }).last();
    await menuTrigger.click({ force: true });
    await page.getByRole("menuitem", { name: /Move to trash/i }).click();
    await page.locator("[data-sonner-toast]").first().waitFor({ state: "visible" });

    // Navigate to trash
    await page.goto("/trash");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(entryTitle)).toBeVisible();

    // Click the permanently delete button (Trash2 icon with title)
    const row = page.locator("div").filter({ hasText: entryTitle }).last();
    const deleteBtn = row.getByTitle("Permanently delete");
    await deleteBtn.click();

    // Confirm in the dialog
    const confirmBtn = page.getByRole("alertdialog").getByRole("button", { name: "Delete" });
    await radixClick(confirmBtn);

    // Verify toast
    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toContainText("Entry permanently deleted");

    // Entry should be gone
    await expect(page.getByText(entryTitle)).not.toBeVisible({ timeout: 5_000 });
  });

  test("trash page shows empty state when no entries are trashed", async ({
    page,
  }) => {
    // This test depends on no other test entries being in trash
    // We just permanently deleted the last one, so check the current state
    await page.goto("/trash");
    await page.waitForLoadState("networkidle");

    // If there's a seed entry in trash, we can't guarantee empty state.
    // Instead, verify the page heading and structure
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trash");

    // The "Deprecated: Basic Summarizer" is seeded as trashed, so we might
    // see it. Just verify the trash page renders correctly.
    const content = page.locator("body");
    const hasItems = await content.getByText("Deprecated: Basic Summarizer").isVisible().catch(() => false);
    if (!hasItems) {
      // Empty state should be showing
      await expect(page.getByText("Trash is empty")).toBeVisible();
    }
  });
});
