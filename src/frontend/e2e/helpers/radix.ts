import { Locator, Page } from "@playwright/test";

/**
 * Radix UI primitives (AlertDialog, Select, etc.) don't respond reliably to
 * standard Playwright `.click()`. They require a full pointer event sequence.
 *
 * This dispatches: pointerdown → pointerup → click (all bubbling).
 */
export async function radixClick(locator: Locator): Promise<void> {
  for (const type of ["pointerdown", "pointerup", "click"] as const) {
    await locator.dispatchEvent(type, { bubbles: true });
  }
}

/**
 * Open a Radix Select and pick an option by its visible text.
 */
export async function radixSelect(
  trigger: Locator,
  optionText: string
): Promise<void> {
  await radixClick(trigger);
  const option = trigger
    .page()
    .getByRole("option", { name: optionText, exact: true });
  await option.waitFor({ state: "visible" });
  await radixClick(option);
}

/**
 * Confirm a Radix AlertDialog by clicking the action button.
 */
export async function radixConfirm(page: Page): Promise<void> {
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor({ state: "visible" });
  const action = dialog.getByRole("button").filter({ hasText: /confirm|delete|yes|continue|remove/i });
  await radixClick(action);
}
