import { Page } from '@playwright/test';

// ── Selector Constants ──────────────────────────────────────────────

/** Entry title input field. */
export const ENTRY_TITLE_INPUT = 'input[placeholder="Entry title"]';

/** Tiptap editor base selector. */
export const TIPTAP_EDITOR = '.tiptap';

/** System message section (data-tour attribute). */
export const SYSTEM_MESSAGE_SECTION = '[data-tour="system-message"]';

/** Version history panel (data-tour attribute). */
export const VERSION_PANEL = '[data-tour="version-panel"]';

/** Radix combobox trigger (used in selects/dropdowns). */
export const COMBOBOX_TRIGGER = '[role="combobox"]';

/** Onboarding tour close button. */
export const TOUR_CLOSE_BTN = '.driver-popover-close-btn';

// ── Locator Factory Functions ───────────────────────────────────────

/**
 * Returns the prompt content editor (last .tiptap on the page).
 * When a system message editor is visible, it's `.tiptap.first()`,
 * so the prompt editor is always `.tiptap.last()`.
 */
export function promptEditor(page: Page) {
  return page.locator(TIPTAP_EDITOR).last();
}

/**
 * Returns the system message editor (first .tiptap on the page).
 * Only valid when the system message section is visible.
 */
export function systemMsgEditor(page: Page) {
  return page.locator(TIPTAP_EDITOR).first();
}

/** Returns the entry title input locator. */
export function titleInput(page: Page) {
  return page.locator(ENTRY_TITLE_INPUT);
}
