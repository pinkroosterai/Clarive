import { Page } from "@playwright/test";

/**
 * Shared mock data and route interception for AI Wizard E2E tests.
 * Intercepts all AI-related API calls to avoid real OpenAI usage.
 */

const SESSION_ID = "e2e-mock-session-00000000-0000-0000-0000-000000000001";
const ENTRY_ID = "e2e-mock-entry-00000000-0000-0000-0000-000000000002";

export const MOCK_PRE_GEN_RESPONSE = {
  sessionId: SESSION_ID,
  questions: [
    {
      text: "What tone should the prompt use?",
      suggestions: ["Formal", "Casual", "Technical"],
    },
    {
      text: "Should it include examples?",
      suggestions: ["Yes", "No"],
    },
  ],
  enhancements: ["Add error handling instructions", "Include output format"],
};

const MOCK_EVALUATION = {
  dimensions: {
    Clarity: { score: 8, feedback: "Well structured and clear" },
    Specificity: { score: 7, feedback: "Good detail level" },
    Structure: { score: 9, feedback: "Excellent layout" },
    Completeness: { score: 6, feedback: "Could cover more cases" },
    Autonomy: { score: 8, feedback: "Stands on its own" },
    Faithfulness: { score: 9, feedback: "Matches description well" },
  },
};

const MOCK_SCORE_HISTORY = [
  {
    iteration: 1,
    scores: MOCK_EVALUATION.dimensions,
    averageScore: 7.83,
  },
];

export const MOCK_GENERATE_RESPONSE = {
  sessionId: SESSION_ID,
  draft: {
    title: "Professional Email Writer",
    systemMessage: "You are an expert email writing assistant.",
    folderId: null,
    prompts: [
      {
        content:
          "Write a {{tone}} email about {{topic}} for the recipient {{name}}.",
        isTemplate: true,
      },
    ],
  },
  questions: [
    {
      text: "Should the prompt handle attachments?",
      suggestions: ["Yes", "No"],
    },
  ],
  enhancements: ["Add subject line generation"],
  evaluation: MOCK_EVALUATION,
  scoreHistory: MOCK_SCORE_HISTORY,
};

export const MOCK_REFINE_RESPONSE = {
  ...MOCK_GENERATE_RESPONSE,
  draft: {
    ...MOCK_GENERATE_RESPONSE.draft,
    title: "Professional Email Writer (Refined)",
    prompts: [
      {
        content:
          "Write a {{tone}} email about {{topic}} for {{name}}. Include a compelling subject line.",
        isTemplate: true,
      },
    ],
  },
  scoreHistory: [
    ...MOCK_SCORE_HISTORY,
    {
      iteration: 2,
      scores: {
        ...MOCK_EVALUATION.dimensions,
        Completeness: { score: 8, feedback: "Much more comprehensive now" },
      },
      averageScore: 8.17,
    },
  ],
};

export const MOCK_CREATED_ENTRY = {
  id: ENTRY_ID,
  title: "Professional Email Writer",
  systemMessage: "You are an expert email writing assistant.",
  prompts: [
    {
      id: "p-mock-001",
      content:
        "Write a {{tone}} email about {{topic}} for the recipient {{name}}.",
      order: 0,
    },
  ],
  folderId: null,
  version: 1,
  versionState: "draft",
  isTrashed: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: "Admin User",
  isTemplate: true,
  isChain: false,
  promptCount: 1,
  firstPromptPreview:
    "Write a {{tone}} email about {{topic}} for the recipient {{name}}.",
};

/**
 * Set up route mocks for the wizard "new" mode.
 * Call this before navigating to /entry/new/wizard.
 */
export async function mockWizardNewRoutes(page: Page): Promise<void> {
  // Billing balance — needed by DescribeStep credit check
  await page.route("**/api/billing/balance", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        freeCredits: 100,
        purchasedCredits: 0,
        totalCredits: 100,
        nextReplenishAt: null,
      }),
    })
  );

  // Tools — DescribeStep queries this
  await page.route("**/api/tools", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    })
  );

  // Pre-gen clarify (Step 1 → 2)
  await page.route("**/api/ai/pre-gen-clarify", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_PRE_GEN_RESPONSE),
    })
  );

  // Generate (Step 2 → 3)
  await page.route("**/api/ai/generate", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_GENERATE_RESPONSE),
    })
  );

  // Refine (Step 3 → stay on 3 with updated data)
  await page.route("**/api/ai/refine", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_REFINE_RESPONSE),
    })
  );

  // Create entry (Step 4 save)
  await page.route("**/api/entries", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CREATED_ENTRY),
      });
    }
    return route.continue();
  });
}

/**
 * Set up route mocks for the wizard "enhance" mode.
 * Call this before navigating to /entry/:id/enhance.
 */
export async function mockWizardEnhanceRoutes(
  page: Page,
  existingEntry: {
    id: string;
    title: string;
    systemMessage?: string | null;
    prompts: { id: string; content: string; order: number }[];
  }
): Promise<void> {
  // Billing balance
  await page.route("**/api/billing/balance", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        freeCredits: 100,
        purchasedCredits: 0,
        totalCredits: 100,
        nextReplenishAt: null,
      }),
    })
  );

  // Fetch existing entry
  await page.route(`**/api/entries/${existingEntry.id}`, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...existingEntry,
          folderId: null,
          version: 1,
          versionState: "draft",
          isTrashed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: "Admin User",
          isTemplate: false,
          isChain: false,
        }),
      });
    }
    // PUT for save
    if (route.request().method() === "PUT") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...existingEntry,
          ...MOCK_GENERATE_RESPONSE.draft,
          id: existingEntry.id,
          folderId: null,
          version: 1,
          versionState: "draft",
          isTrashed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: "Admin User",
        }),
      });
    }
    return route.continue();
  });

  // Enhance endpoint (bootstrap on mount)
  await page.route("**/api/ai/enhance", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_GENERATE_RESPONSE),
    })
  );

  // Refine
  await page.route("**/api/ai/refine", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_REFINE_RESPONSE),
    })
  );

  // Version history
  await page.route(`**/api/entries/${existingEntry.id}/versions`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          version: 1,
          versionState: "draft",
          publishedAt: null,
          publishedBy: null,
        },
      ]),
    })
  );
}
