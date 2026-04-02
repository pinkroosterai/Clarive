# Changelog

All notable changes to Clarive are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.4.0] - 2026-04-02

### Added

- **Playground token usage**: Inline token usage and estimated cost per run
- **Onboarding tour polish**: Improved tour UX with better hint scoping

### Changed

- Playground toolbar: improved usability and action placement
- Extracted shared token/cost formatting utilities in playground

### Fixed

- Onboarding tour showing read-only editor and minor UX issues
- Onboarding hint scoping issues
- Log retention reduced to 7 days; removed playground grid padding
- OnboardingSeederTests updated for tab versions

### Maintenance

- Upgraded frontend packages to latest minor/patch versions

## [1.3.0] - 2026-03-27

### Added

- **Tabs and publish model**: Redesigned versioning as Tabs + Publish model with named variants
- **Test Matrix**: Unified test matrix replacing separate Playground and A/B Test pages, with config sidebar, comparison panel, heatmap, searchable picker, and run buttons
- **Matrix report generator**: PDF export for matrix reports
- **GitHub OAuth**: GitHub OAuth login and registration
- **Tab-level concurrency**: Conflict detection moved to tab level
- **E2E snapshot workflow**: Database snapshot/restore for fast E2E iteration
- **Tab lifecycle E2E specs**: Tab lifecycle and scoped operations E2E tests

### Changed

- Playground toolbar improved with better action placement
- Removed framer-motion animations from editor for instant tab switching
- Sidebar nav reordered — Dashboard promoted above folders
- Test Matrix button replaces Run Prompt + Compare Versions
- Removed abandoned A/B test and test dataset features from backend

### Fixed

- Editor: separated metadata read-only from content read-only
- Database: guarded ab_test_runs migrations with IF EXISTS for fresh databases
- Help links migrated to docs.clarive.app; all users can now delete account
- Tab content loading on switch, tab bar visibility on published entries
- False dirty state prevented when switching tabs
- 6 critical bugs in tabs system resolved
- AI tab threading through tabId for active tab content
- Published view defaulting when opening published entries
- Published version score shown in library instead of draft

### Maintenance

- Help system removed in-app, replaced with links to docs.clarive.app
- Extensive help documentation written and published
- Dead code removal (1,707 lines of orphaned playground code)
- 16 failing tests updated for tab refactor and API renames

## [1.2.0] - 2026-03-22

### Added

- **AI merge conflict resolution**: AI-powered conflict resolution for prompt entries
- **Audit log and trash cleanup jobs**: Background jobs for log retention and trash cleanup
- **GitHub OAuth redirect**: Proper error handling for OAuth redirect errors
- **Super Admin create user**: Full page with multi-workspace assignment
- **Public API tab endpoints**: Read-only variant access via public API

### Changed

- AiGenerationService split into generation and utility services
- EntryService split into EntryService + EntryVersionService + EntryActivityService
- Extracted IUnitOfWork to replace direct DbContext usage in Application services
- Extracted NormalizePagination to shared PaginationHelper
- Extracted GetWorkingVersionAsync to deduplicate version-loading
- Differentiated NOT_FOUND error codes by entity type
- Extracted DashboardService from DashboardEndpoints
- Extracted UserCascadeDeleter for shared user deletion logic

### Fixed

- `Task.Result` replaced with `await` after `Task.WhenAll()`
- Playground sidebar widened from 360px to 540px
- ScrollArea content overflow from `display:table`
- Duplicate copy button removed from playground run results
- Super admin: cascade hard delete to all user-owned content
- Loading state stuck on rapid workspace switching
- OAuth divider hidden when no providers configured
- Tab bar shown on published-only entries to allow tab creation
- Never-run background jobs now trigger on startup

### Maintenance

- Removed 14 orphaned files with zero references
- Dead code removal, duplicate usings, and stale gitignore entries
- E2E spec selectors updated for redesigned sidebar
- Stale test assertions aligned with current components

## [1.1.1] - 2026-03-17

### Fixed

- Release script: resolved 3 blocking issues
- 5 stale test assertions in entryService and playgroundService
- Removed CONCURRENTLY from trigram index migration (incompatible with transactions)

### Changed

- Created TagService and ApiKeyService abstractions
- Extracted ClariveDbContext usage from Application layer into repository abstractions
- Removed Auth → Infrastructure layer violation
- Split PlaygroundResultsArea into focused sub-components
- Removed non-null assertions on reactive state in WorkspaceSection
- Extracted WithReadLock/WithWriteLock helpers in OpenAIAgentFactory
- Extracted ITenantCacheService interface from concrete class
- Deleted unused TransactionExtensions after IUnitOfWork migration

## [1.1.0] - 2026-03-17

### Added

- **Real-time presence**: Presence indicators in prompt editor with soft edit locking and warning banner
- **Conflict resolution**: Full-page conflict detection with side-by-side diff, manual merge, and live preview
- **Quality evaluation tab**: On-demand prompt evaluation with quality scoring
- **Enhanced duplicate**: Folder picker, tags, and editor action for duplication
- **Resizable sidebar**: Drag-to-resize with persistent width state
- **Library improvements**: Folder search, breadcrumbs, colors, and drag-drop undo
- **Structured logging**: Serilog correlation enrichers, auth security logging, and AI pipeline logging
- **Email overhaul**: Redesigned templates with 7 notification types
- **Anti-spam**: Honeypot and timing validation on registration
- **Quartz.NET jobs**: Persistent job scheduling with admin dashboard and live polling
- **MCP server management**: MCP tool management with scheduled sync, tool invocation in playground
- **MCP tools in wizard**: Tool descriptions and parameters shown in wizard selection
- **FusionCache**: Replaced TenantCacheService with FusionCache (L1 in-memory + L2 distributed)
- **Playground features**: AI-generated template field examples, navigation guard during streaming, numeric slider fields

### Changed

- Editor sidebar reordered with headers and persistent wizard scores
- Playground settings moved to inline secondary toolbar
- Unfoldered prompts shown beneath All Prompts in sidebar
- Wizard textarea auto-grows; polish button disabled after use
- Application layer restructured from Clarive.Core into feature-based Clarive.Application
- AI layer restructured by responsibility
- Eliminated wasteful bootstrap LLM call in EnhanceAsync
- 6-project backend architecture established (extracted Domain, Infrastructure, AI, Auth libraries)

### Fixed

- Sidebar collapsed state read from cookie on initialization
- HTTP cache removed on folder tree endpoint to fix stale data after mutations
- FolderTree TDZ crash from declaration order
- Playground history sidebar defaulted to closed
- Tool call rendering unified between streaming and historical runs
- Tool calls shown in chronological order
- MCP tool schemas sanitized for OpenAI compatibility
- Wizard full generated prompts shown without height constraint
- Browser autofill prevented on MCP server dialog fields
- Playground stale closures in batch orchestration effects

## [1.0.1] - 2026-03-13

### Fixed

- ConfigTests updated for new config response shape
- Super admin restart banner auto-clears when server has restarted
- ESLint warnings fixed across frontend codebase
- Swallowed decryption exceptions logged in AI provider resolution

### Changed

- Extracted InTransactionAsync helper to eliminate transaction boilerplate
- Centralized NotFound errors into DomainErrors class
- Per-provider API mode with think tag parsing for AI

### Added

- Function calling and response schema capability flags for AI models
- Multi-provider model support in playground with AI logging
- PostgreSQL log persistence and Super Admin log viewer
- HTTP Cache-Control headers for stable GET endpoints
- Valkey distributed cache infrastructure with TenantCacheService

## [1.0.0] - 2026-03-12

Initial release of Clarive.

### Added

- **Prompt management**: Rich text editor with Tiptap v3, versioning, folders, tags, favorites, and activity timeline
- **AI Wizard**: Multi-step prompt generation with agent-based orchestration (generation, evaluation, clarification)
- **Playground**: Prompt testing with streaming LLM responses, LLM-as-judge scoring, multi-model comparison, reasoning output display, and run history
- **Multi-provider AI**: OpenAI-compatible provider management with per-action model configuration, capability detection, and model whitelisting
- **Public API**: API key authentication, entry listing, tag discovery, rate limiting with X-RateLimit headers, and optional key expiry
- **Share links**: Public read-only prompt access with password protection
- **Team workspace**: Multi-tenant workspaces with invitations, role-based access, and collaboration
- **Super Admin dashboard**: Bento layout with user management, AI provider configuration, settings, and log viewer
- **Setup wizard**: First-run configuration for admin account, workspace, email, and AI providers
- **Authentication**: JWT + refresh tokens, Google OIDC, registration with email verification
- **Editor features**: Tabbed sidebar (details, versions, actions), publish workflow, unsaved changes guard, keyboard shortcuts
- **Library**: Server-side search, filtering, and sorting with quality score badges
- **Import/Export**: Workspace-level prompt import and export
- **Deployment**: Unified multi-stage Dockerfile, Docker Compose orchestration, Makefile with 35+ commands
- **Testing**: Unit tests (xUnit + Vitest), integration tests (Testcontainers), E2E tests (Playwright)
- **Observability**: Structured logging with Serilog, AI usage analytics, health checks
- **Security**: CSP headers, AllowedHosts validation, rate limiting, Google OIDC nonce validation, avatar magic byte validation
- **Documentation**: User-facing docs at docs.clarive.app, API reference, README for self-hosters

[1.4.0]: https://github.com/pinkroosterai/Clarive/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/pinkroosterai/Clarive/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/pinkroosterai/Clarive/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/pinkroosterai/Clarive/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/pinkroosterai/Clarive/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/pinkroosterai/Clarive/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/pinkroosterai/Clarive/releases/tag/v1.0.0
