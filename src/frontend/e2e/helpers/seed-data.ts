/**
 * Mirrors the deterministic seed data from backend SeedData.cs.
 * Keep in sync with: backend/PromptForge.Api/Seed/SeedData.cs
 */

export const USERS = {
  admin: {
    email: "admin@clarive.dev",
    password: "password",
    name: "Admin User",
    role: "admin",
  },
  editor: {
    email: "jane@clarive.dev",
    password: "password",
    name: "Jane Editor",
    role: "editor",
  },
  viewer: {
    email: "sam@clarive.dev",
    password: "password",
    name: "Sam Viewer",
    role: "viewer",
  },
} as const;

export const FOLDERS = {
  contentWriting: { name: "Content Writing", parent: null },
  codeReview: { name: "Code Review", parent: null },
  dataAnalysis: { name: "Data Analysis", parent: null },
  blogPosts: { name: "Blog Posts", parent: "Content Writing" },
  securityAudits: { name: "Security Audits", parent: "Code Review" },
  technicalBlogs: { name: "Technical Blogs", parent: "Blog Posts" },
} as const;

/**
 * Entry IDs are deterministic MD5-based GUIDs matching backend SeedData.cs
 * Generated via: new Guid(MD5.HashData(Encoding.UTF8.GetBytes("entry-e-NNN")))
 */
export const ENTRIES = {
  blogPostGenerator: {
    id: "bfb93720-cf90-d1b2-56de-1dee3bc57278",
    title: "Blog Post Generator",
    folder: "Content Writing",
    state: "published",
    version: 2,
  },
  codeReviewPipeline: {
    id: "ac0235a2-a4b4-e4cc-da05-02adffab0fe4",
    title: "Code Review Pipeline",
    folder: "Code Review",
    state: "published",
    version: 3,
  },
  csvDataSummarizer: {
    id: "754c962e-80ec-d9ff-6909-de88b9d57cdc",
    title: "CSV Data Summarizer",
    folder: "Data Analysis",
    state: "draft",
    version: 1,
  },
  technicalTutorialWriter: {
    id: "c44ab623-4265-9e72-95cc-256f0364211b",
    title: "Technical Tutorial Writer",
    folder: "Technical Blogs",
    state: "published",
    version: 1,
  },
  salesReportAnalyzer: {
    id: "94369c1b-0212-385f-bff1-04beed6cf8c8",
    title: "Sales Report Analyzer",
    folder: "Data Analysis",
    state: "published",
    version: 4,
  },
  meetingNotesFormatter: {
    id: "0b81ed6f-bd05-bc04-45ea-b22c91a48ef2",
    title: "Meeting Notes Formatter",
    folder: null,
    state: "draft",
    version: 1,
  },
  owaspSecurityChecker: {
    id: "418b48fa-4839-227a-95b5-3539690c4d6a",
    title: "OWASP Security Checker",
    folder: "Security Audits",
    state: "published",
    version: 2,
  },
  emailToneAdjuster: {
    id: "5f4d3384-22d9-42ed-03b5-ac8d4181e71f",
    title: "Email Tone Adjuster",
    folder: null,
    state: "published",
    version: 1,
  },
  deprecatedBasicSummarizer: {
    id: "720b1e7d-face-695d-bfdd-90ecacce11fd",
    title: "Deprecated: Basic Summarizer",
    folder: "Content Writing",
    state: "published",
    trashed: true,
  },
  seoMetaDescriptionGenerator: {
    id: "e748e4a8-701b-d7e0-879a-357a8da75594",
    title: "SEO Meta Description Generator",
    folder: "Blog Posts",
    state: "published",
    version: 3,
  },
} as const;

export const API_KEYS = {
  production: {
    name: "Production API Key",
    value: "pf_seed_test_key_for_seed_a3f8",
    prefix: "pf_seed",
  },
  development: {
    name: "Development API Key",
    value: "pf_dev_test_key_for_seed_7b21",
    prefix: "pf_dev_",
  },
} as const;

/** Non-trashed, visible entries (what shows up in library root + subfolders) */
export const VISIBLE_ENTRIES = Object.values(ENTRIES).filter(
  (e) => !("trashed" in e && e.trashed)
);

/** Draft entries visible in the library */
export const DRAFT_ENTRIES = VISIBLE_ENTRIES.filter(
  (e) => e.state === "draft"
);

/** Published entries visible in the library */
export const PUBLISHED_ENTRIES = VISIBLE_ENTRIES.filter(
  (e) => e.state === "published"
);

/** Root-level folders (no parent) */
export const ROOT_FOLDERS = Object.values(FOLDERS).filter(
  (f) => f.parent === null
);
