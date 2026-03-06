import { test, expect } from "@playwright/test";

test.describe("Tools Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools");
    await page.waitForLoadState("networkidle");
  });

  test("tools page loads with heading and Add Tool button", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: /Tool Descriptions/i })
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Add Tool/i })
    ).toBeVisible();
  });

  test("create a tool via dialog and verify it appears", async ({ page }) => {
    const toolName = `e2e_tool_${Date.now()}`;
    const displayName = `E2E Test Tool ${Date.now()}`;
    const description = "A test tool created by E2E suite.";

    // Open Add Tool dialog
    await page.getByRole("button", { name: /Add Tool/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill form fields
    await dialog.locator("#add-name").fill(displayName);
    await dialog.locator("#add-toolName").fill(toolName);
    await dialog.locator("#add-desc").fill(description);

    // Click Create
    await dialog.getByRole("button", { name: /^Create$/i }).click();

    // Verify toast
    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toContainText("Tool created");

    // Tool card should appear in the grid
    await expect(page.getByText(displayName)).toBeVisible();
    await expect(page.getByText(toolName)).toBeVisible();
  });
});
