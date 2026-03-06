import { Locator, Page } from '@playwright/test';

/**
 * Get the sidebar locator.
 */
export function getSidebar(page: Page): Locator {
  return page.locator("[data-sidebar='sidebar']").first();
}

/**
 * Open the three-dot dropdown menu for a folder in the sidebar.
 * Strategy: find the folder name span, then use xpath to go up to the row div
 * and find the last button (the MoreHorizontal trigger).
 */
export async function openFolderMenu(page: Page, folderName: string): Promise<void> {
  const sidebar = getSidebar(page);
  // Find the span containing the folder name
  const nameSpan = sidebar.locator('span.truncate', { hasText: folderName }).first();
  // Navigate up to the row container (the div that contains chevron, name button, and menu trigger)
  // The structure is: div > button > span.truncate (the name is 2 levels deep)
  // We need the grandparent div which also has the menu trigger button
  const row = nameSpan
    .locator(
      "xpath=ancestor::div[contains(@class, 'flex') and contains(@class, 'items-center') and contains(@class, 'w-full')]"
    )
    .first();
  await row.hover();
  // The menu trigger is the last button in the row
  const menuTrigger = row.locator('button').last();
  await menuTrigger.click({ force: true });
}

/**
 * Expand a folder in the sidebar tree by clicking its chevron.
 */
export async function expandFolder(page: Page, folderName: string): Promise<void> {
  const sidebar = getSidebar(page);
  const nameSpan = sidebar.locator('span.truncate', { hasText: folderName }).first();
  const row = nameSpan
    .locator(
      "xpath=ancestor::div[contains(@class, 'flex') and contains(@class, 'items-center') and contains(@class, 'w-full')]"
    )
    .first();
  // Button order: [0] DragHandle, [1] CollapsibleTrigger (chevron), [2] name, [3] menu
  const chevron = row.locator('button').nth(1);
  await chevron.click();
}
