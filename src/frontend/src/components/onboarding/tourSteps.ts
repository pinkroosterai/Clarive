import type { DriveStep } from "driver.js";

export interface OnboardingStep extends DriveStep {
  /** Static route to navigate to before highlighting this step */
  route?: string;
  /** Dynamically resolve the route at runtime (e.g., read entry ID from DOM) */
  resolveRoute?: () => string | null;
}

/** Index of the first editor step (for skip logic when library is empty) */
export const EDITOR_STEPS_START = 6;
/** Index of the last editor step */
export const EDITOR_STEPS_END = 9;

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // Step 0: Welcome modal (centered, no element)
  {
    popover: {
      title: "Welcome to Clarive",
      description:
        "Your workspace for crafting, versioning, and managing LLM prompts. Let's take a quick tour.",
      side: "over",
      popoverClass: "tour-popover tour-welcome-modal",
      showButtons: ["next", "close"],
      nextBtnText: "Start Tour",
    },
  },
  // Step 1: Dashboard stats
  {
    element: "[data-tour='dashboard-stats']",
    popover: {
      title: "Your Dashboard",
      description:
        "Track prompt usage, recent activity, and workspace stats at a glance.",
      side: "bottom",
      align: "start",
    },
  },
  // Step 2: Recent entries / activity
  {
    element: "[data-tour='dashboard-recent']",
    popover: {
      title: "Recent Work",
      description: "Jump back into your latest prompts right from here.",
      side: "top",
      align: "start",
    },
  },
  // Step 3: Sidebar navigation
  {
    element: "[data-tour='sidebar-nav']",
    popover: {
      title: "Your Workspace",
      description:
        "Navigate folders, access trash, and settings from the sidebar.",
      side: "right",
      align: "start",
    },
  },
  // Step 4: New Entry button in sidebar
  {
    element: "[data-tour='new-entry-btn']",
    popover: {
      title: "Create & AI Wizard",
      description:
        "Start a blank prompt or let the AI Wizard generate, evaluate, and refine prompts for you.",
      side: "right",
      align: "start",
    },
  },
  // Step 5: Library page (cross-page navigation)
  {
    route: "/library",
    element: "[data-tour='entry-card']",
    popover: {
      title: "The Prompt Library",
      description:
        "Browse, search, and organize all your prompts. Click any card to open the editor.",
      side: "bottom",
      align: "start",
    },
  },
  // Step 6: Prompt editor (cross-page — navigate into first entry)
  {
    resolveRoute: () => {
      const card = document.querySelector("[data-tour='entry-card']");
      const entryId = card?.getAttribute("data-entry-id");
      return entryId ? `/entry/${entryId}` : null;
    },
    element: "[data-tour='prompt-editor']",
    popover: {
      title: "The Prompt Editor",
      description:
        "Write and edit your prompts here. Add template variables with {{double braces}} for reusable inputs.",
      side: "bottom",
      align: "start",
    },
  },
  // Step 7: System message
  {
    element: "[data-tour='system-message']",
    popover: {
      title: "System Message",
      description:
        "Set the AI's behavior and persona. This is sent before your prompts to guide the model.",
      side: "bottom",
      align: "start",
    },
  },
  // Step 8: Action panel (right sidebar)
  {
    element: "[data-tour='editor-actions']",
    popover: {
      title: "Actions & AI Tools",
      description:
        "Save drafts, publish versions, or use AI to enhance and decompose your prompts.",
      side: "left",
      align: "start",
    },
  },
  // Step 9: Version panel
  {
    element: "[data-tour='version-panel']",
    popover: {
      title: "Version History",
      description:
        "Every save creates a version. Compare changes with diffs and restore any previous version.",
      side: "left",
      align: "start",
    },
  },
  // Step 10: Closing modal (centered, no element)
  {
    popover: {
      title: "You're All Set!",
      description:
        "Start creating prompts or explore the AI Wizard. Happy forging!",
      side: "over",
      popoverClass: "tour-popover tour-welcome-modal",
      showButtons: ["next"],
      nextBtnText: "Get Started",
    },
  },
];
