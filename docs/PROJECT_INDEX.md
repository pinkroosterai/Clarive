# Clarive Project Index

> Auto-generated project documentation. Last updated: 2026-03-06

## Overview

Clarive is an open-source platform (AGPL-3.0) for managing, versioning, and AI-enhancing LLM prompts across teams. Multi-tenant SaaS architecture with role-based access control.

## Architecture

```
Frontend (React 18 + TS + Vite)  →  Backend (.NET 10 Minimal APIs)  →  PostgreSQL 16
        :8080                              :5000                          :5432
```

| Layer | Technology | Entry Point |
|-------|-----------|-------------|
| Frontend | React 18, TypeScript, Vite, Tailwind, shadcn/ui, Tiptap v3 | `src/frontend/src/main.tsx` |
| Backend | C# ASP.NET Core 10, EF Core 10, Npgsql | `src/backend/Clarive.Api/Program.cs` |
| Database | PostgreSQL 16 | EF Core Migrations |
| Auth | JWT + Refresh Tokens, Google OIDC, API Keys | `src/backend/Clarive.Api/Auth/` |
| AI | OpenAI via agent-based orchestration | `src/backend/Clarive.Api/Services/Agents/` |
| State | Zustand (auth), TanStack React Query (server) | `src/frontend/src/store/authStore.ts` |

---

## Repository Structure

```
Clarive/
├── src/
│   ├── backend/                    # .NET backend
│   │   ├── Clarive.Api/           # Main API project
│   │   ├── Clarive.sln            # Solution file
│   │   └── Dockerfile
│   └── frontend/                   # React frontend
│       ├── src/                    # Application source
│       ├── e2e/                    # Playwright E2E tests
│       ├── playwright.config.ts
│       └── Dockerfile
├── tests/
│   └── backend/
│       ├── Clarive.Api.IntegrationTests/
│       └── Clarive.Api.UnitTests/
├── deploy/
│   ├── docker-compose.yml          # Production compose
│   ├── docker-compose.dev.yml      # Development compose
│   └── .env.example
├── docs/
│   ├── architecture.md
│   ├── development-setup.md
│   ├── configuration.md
│   ├── deployment-guide.md
│   └── api-reference.yaml
├── .github/
│   └── workflows/
│       ├── ci.yml                  # CI pipeline
│       ├── release.yml
│       ├── docker-publish.yml
│       └── codeql-analysis.yml
├── docker-compose.yml              # Root dev compose
├── Makefile                        # 35+ dev commands
└── CLAUDE.md                       # AI assistant instructions
```

---

## Backend Structure

### `src/backend/Clarive.Api/`

#### Endpoints (18 files) — Minimal API route groups
| File | Route Group | Purpose |
|------|------------|---------|
| `AccountEndpoints.cs` | `/api/account` | Account management (register, verify email, password reset) |
| `AuthEndpoints.cs` | `/api/auth` | Login, logout, token refresh, Google OIDC |
| `EntryEndpoints.cs` | `/api/entries` | CRUD for prompt entries and versions |
| `FolderEndpoints.cs` | `/api/folders` | Folder management and hierarchy |
| `UserEndpoints.cs` | `/api/users` | User administration (tenant-scoped) |
| `ProfileEndpoints.cs` | `/api/profile` | Current user profile |
| `ApiKeyEndpoints.cs` | `/api/api-keys` | API key management |
| `InvitationEndpoints.cs` | `/api/invitations` | Team invitation workflows |
| `AiGenerationEndpoints.cs` | `/api/ai` | AI prompt generation (SSE streaming) |
| `ImportExportEndpoints.cs` | `/api/import-export` | Bulk import/export |
| `ConfigEndpoints.cs` | `/api/config` | System configuration |
| `DashboardEndpoints.cs` | `/api/dashboard` | Dashboard analytics |
| `TenantEndpoints.cs` | `/api/tenants` | Tenant/workspace management |
| `WorkspaceEndpoints.cs` | `/api/workspaces` | Workspace selection |
| `AuditLogEndpoints.cs` | `/api/audit-logs` | Audit trail |
| `ToolEndpoints.cs` | `/api/tools` | Tool descriptions for AI |
| `SuperEndpoints.cs` | `/api/super` | Super admin operations |
| `PublicApiEndpoints.cs` | `/api/v1` | Public API (API key auth) |

#### Models
```
Models/
├── Entities/          # 20 EF Core entities
│   ├── User.cs
│   ├── Tenant.cs
│   ├── TenantMembership.cs
│   ├── PromptEntry.cs
│   ├── PromptEntryVersion.cs
│   ├── Prompt.cs
│   ├── TemplateField.cs
│   ├── Folder.cs
│   ├── ApiKey.cs
│   ├── AuditLogEntry.cs
│   ├── Invitation.cs
│   ├── RefreshToken.cs
│   ├── LoginSession.cs
│   ├── PasswordResetToken.cs
│   ├── EmailVerificationToken.cs
│   ├── AiSession.cs
│   ├── ToolDescription.cs
│   ├── ServiceConfig.cs
│   ├── SystemConfig.cs
│   └── ITenantScoped.cs       # Multi-tenancy interface
├── Enums/
│   ├── VersionState.cs         # Draft → Published → Historical
│   ├── UserRole.cs
│   ├── AuditAction.cs
│   └── TemplateFieldType.cs
├── Requests/          # Endpoint request DTOs
├── Responses/         # Endpoint response DTOs
├── Results/           # Service layer result types
└── Agents/            # AI agent model types
```

#### Services (30 files)
| Service | Purpose |
|---------|---------|
| `EntryService.cs` | Core business logic for entries and versioning |
| `AccountService.cs` | Registration, email verification, password management |
| `UserManagementService.cs` | User CRUD, role assignment |
| `InvitationService.cs` | Invitation creation, acceptance, expiry |
| `AiGenerationService.cs` | AI generation orchestration |
| `ImportExportService.cs` | JSON import/export of entries |
| `McpImportService.cs` | MCP tool import |
| `AuditLogger.cs` | Audit trail logging |
| `AvatarService.cs` | Avatar generation |
| `Validator.cs` | Shared validation logic |
| `EncryptionService.cs` | AES-GCM encryption for config values |
| `ConfigRegistry.cs` | Dynamic configuration management |
| `TemplateParser.cs` | Prompt template parsing (`{{variable}}`) |
| `MaintenanceModeService.cs` | Maintenance mode toggle |
| `OnboardingSeeder.cs` | First-run seed data |

**Email providers** (conditional registration):
- `ResendEmailService.cs` — Resend API
- `SmtpEmailService.cs` — SMTP
- `ConsoleEmailService.cs` — Console fallback (dev)

**AI Agents** (`Services/Agents/`):
| File | Purpose |
|------|---------|
| `PromptOrchestrator.cs` | Multi-agent orchestration (generate, evaluate, clarify) |
| `OpenAIAgentFactory.cs` | OpenAI client factory |
| `AgentSessionPool.cs` | Session pooling for AI conversations |
| `TaskBuilder.cs` | Agent task construction |
| `AgentInstructions.cs` | System prompts for agents |
| `EvaluationNormalizer.cs` | Score normalization |

**Background Services** (`Services/Background/`):
| File | Purpose |
|------|---------|
| `TokenCleanupBackgroundService.cs` | Expired token cleanup |
| `AccountPurgeBackgroundService.cs` | Unverified account purge |
| `AiSessionCleanupService.cs` | Stale AI session cleanup |
| `MaintenanceModeSyncService.cs` | Maintenance mode sync |

#### Repositories (13 interfaces + 13 EF Core implementations)
| Repository | Entity |
|-----------|--------|
| `IEntryRepository` / `EfEntryRepository` | PromptEntry, PromptEntryVersion |
| `IFolderRepository` / `EfFolderRepository` | Folder |
| `IUserRepository` / `EfUserRepository` | User |
| `ITenantRepository` / `EfTenantRepository` | Tenant |
| `ITenantMembershipRepository` / `EfTenantMembershipRepository` | TenantMembership |
| `IApiKeyRepository` / `EfApiKeyRepository` | ApiKey |
| `IAuditLogRepository` / `EfAuditLogRepository` | AuditLogEntry |
| `IInvitationRepository` / `EfInvitationRepository` | Invitation |
| `IRefreshTokenRepository` / `EfRefreshTokenRepository` | RefreshToken |
| `ILoginSessionRepository` / `EfLoginSessionRepository` | LoginSession |
| `ITokenRepository` / `EfTokenRepository` | PasswordResetToken, EmailVerificationToken |
| `IAiSessionRepository` / `EfAiSessionRepository` | AiSession |
| `IToolRepository` / `EfToolRepository` | ToolDescription |

#### Auth (`Auth/`)
| File | Purpose |
|------|---------|
| `JwtService.cs` | JWT generation and validation |
| `JwtSettings.cs` | JWT configuration |
| `PasswordHasher.cs` | BCrypt password hashing |
| `ApiKeyAuthHandler.cs` | API key authentication handler |
| `HttpContextTenantProvider.cs` | Tenant extraction from JWT |
| `ITenantProvider.cs` | Tenant provider interface |
| `HttpContextExtensions.cs` | `GetTenantId()`, `GetUserId()` helpers |

#### Data (`Data/`)
- `ClariveDbContext.cs` — EF Core DbContext with global tenant query filter
- `Configurations/` — Entity type configurations

#### Configuration (`Configuration/`)
- `DbConfigurationProvider.cs` — AES-GCM encrypted config from database
- `DbConfigurationSource.cs` — Configuration source registration

#### Middleware (`Middleware/`)
- `ErrorHandlingMiddleware.cs` — Global exception handling
- `SecurityHeadersMiddleware.cs` — Security headers (CSP, HSTS, etc.)
- `MaintenanceModeMiddleware.cs` — Maintenance mode gate

---

## Frontend Structure

### `src/frontend/src/`

#### Pages (25 files)
| Page | Route | Purpose |
|------|-------|---------|
| `LoginPage.tsx` | `/login` | Authentication |
| `RegisterPage.tsx` | `/register` | Account creation |
| `ForgotPasswordPage.tsx` | `/forgot-password` | Password reset request |
| `ResetPasswordPage.tsx` | `/reset-password` | Password reset form |
| `VerifyEmailPage.tsx` | `/verify-email` | Email verification |
| `GoogleCallbackPage.tsx` | `/auth/google/callback` | Google OIDC callback |
| `AcceptInvitationPage.tsx` | `/accept-invitation` | Invitation acceptance |
| `WorkspaceSelectorPage.tsx` | `/workspaces` | Workspace selection |
| `SetupPage.tsx` | `/setup` | First-run setup |
| `DashboardPage.tsx` | `/dashboard` | Dashboard |
| `LibraryPage.tsx` | `/library` | Prompt library browser |
| `NewEntryPage.tsx` | `/entries/new` | Create new entry |
| `EntryEditorPage.tsx` | `/entries/:id` | Entry editor (Tiptap) |
| `WizardPage.tsx` | `/wizard` | AI prompt wizard |
| `EnhanceWizardPage.tsx` | `/wizard/enhance` | AI enhancement wizard |
| `TrashPage.tsx` | `/trash` | Soft-deleted entries |
| `ToolsPage.tsx` | `/tools` | AI tool management |
| `SettingsPage.tsx` | `/settings` | Workspace settings |
| `SuperDashboardPage.tsx` | `/super` | Super admin dashboard |
| `HelpPage.tsx` | `/help` | Help/documentation |
| `PrivacyPage.tsx` | `/privacy` | Privacy policy |
| `TermsPage.tsx` | `/terms` | Terms of service |
| `MaintenancePage.tsx` | `/maintenance` | Maintenance mode |
| `NotFound.tsx` | `*` | 404 page |

#### Components (14 feature directories)
```
components/
├── auth/              # Login/register forms, protected routes
├── editor/            # Tiptap editor, toolbar, version history
├── library/           # Entry cards, list views, search/filter
├── wizard/            # AI wizard steps, generation UI
├── dashboard/         # Dashboard widgets
├── settings/          # Settings panels (workspace, AI, email, auth)
├── super/             # Super admin components
├── tools/             # Tool management components
├── onboarding/        # First-run onboarding flow
├── layout/            # App shell, sidebar, header
├── common/            # Shared components (dialogs, badges, etc.)
├── dnd/               # Drag-and-drop (folder/entry reordering)
├── icons/             # Custom icons
├── ui/                # shadcn/ui primitives (button, dialog, etc.)
├── ThemeProvider.tsx   # Light/dark theme provider
└── NavLink.tsx         # Navigation link component
```

#### API Services (`services/api/` — 14 service files + 8 test files)
| Service | Backend Endpoint |
|---------|-----------------|
| `apiClient.ts` | Base fetch client (JWT refresh, SSE support) |
| `authService.ts` | `/api/auth` |
| `entryService.ts` | `/api/entries` |
| `folderService.ts` | `/api/folders` |
| `userService.ts` | `/api/users` |
| `profileService.ts` | `/api/profile` |
| `apiKeyService.ts` | `/api/api-keys` |
| `invitationService.ts` | `/api/invitations` |
| `wizardService.ts` | `/api/ai` |
| `configService.ts` | `/api/config` |
| `dashboardService.ts` | `/api/dashboard` |
| `tenantService.ts` | `/api/tenants` |
| `workspaceService.ts` | `/api/workspaces` |
| `auditService.ts` | `/api/audit-logs` |
| `importExportService.ts` | `/api/import-export` |
| `superService.ts` | `/api/super` |
| `toolService.ts` | `/api/tools` |

#### Hooks (10 files)
| Hook | Purpose |
|------|---------|
| `useEditorState.ts` | Editor data loading and state management |
| `useEditorMutations.ts` | Editor save/publish/delete mutations |
| `useEditorKeyboardShortcuts.ts` | Keyboard shortcuts (Ctrl+S, etc.) |
| `useEntryHistory.ts` | Version history navigation |
| `useQuestionAnswers.ts` | Template question/answer management |
| `useDndMutations.ts` | Drag-and-drop reorder mutations |
| `useAiEnabled.ts` | AI feature availability check |
| `useDebounce.ts` | Debounce utility hook |
| `useTheme.ts` | Theme preference management |
| `use-mobile.tsx` | Mobile viewport detection |

#### Lib/Utilities (`lib/`)
| File | Purpose |
|------|---------|
| `config.ts` | Runtime configuration |
| `queryClient.ts` | TanStack Query client setup |
| `validationSchemas.ts` | Zod validation schemas |
| `handleApiError.ts` | API error handling + toast |
| `formatters.ts` | Shared formatting utilities |
| `templateParser.ts` | Template `{{variable}}` parsing |
| `templateRenderer.ts` | Template rendering |
| `folderUtils.ts` | Folder tree utilities |
| `deepEqual.ts` | Deep equality comparison |
| `debounce.ts` | Debounce function |
| `passwordStrength.ts` | Password strength meter |
| `utils.ts` | General utilities (cn, etc.) |
| `dnd/` | Drag-and-drop utilities |
| `tiptap/` | Tiptap editor extensions |

#### Store
- `authStore.ts` — Zustand store for auth state (token, user, workspace)

#### Types
- `types/index.ts` — Shared TypeScript type definitions

---

## Test Structure

### Backend Integration Tests (`tests/backend/Clarive.Api.IntegrationTests/`)
**Infrastructure**: Testcontainers PostgreSQL + WebApplicationFactory
```
Tests/
├── Auth/              # Login, register, token refresh, Google OIDC
├── Account/           # Account management, email verification
├── Entries/           # Entry CRUD, versioning, publishing
├── Folders/           # Folder hierarchy operations
├── Users/             # User management
├── Invitations/       # Invitation workflows
├── Workspaces/        # Workspace operations
├── Dashboard/         # Dashboard data
├── AiGeneration/      # AI generation (mocked)
└── PublicApi/         # Public API (API key auth)

Fixtures/              # WebApplicationFactory, test container setup
Helpers/               # Auth helpers, test data, seed data
```

### Backend Unit Tests (`tests/backend/Clarive.Api.UnitTests/`)
**Infrastructure**: In-memory EF Core + NSubstitute
```
Services/
└── EntryService/      # Entry service business logic tests
```

### Frontend Unit Tests (colocated in `src/frontend/src/`)
**Infrastructure**: Vitest + jsdom
- Test files colocated with source: `*.test.ts` / `*.test.tsx`
- Test factories: `src/test/factories.ts`
- Test setup: `src/test/setup.ts`

### Frontend E2E Tests (`src/frontend/e2e/`)
**Infrastructure**: Playwright with role-based fixtures
| Spec | Coverage |
|------|----------|
| `auth.spec.ts` | Login, logout, session management |
| `auth-register.spec.ts` | Registration flow |
| `onboarding.spec.ts` | First-run onboarding |
| `entry-create.spec.ts` | Entry creation |
| `entry-editor.spec.ts` | Editor functionality |
| `library.spec.ts` | Library browsing, search, filter |
| `folders.spec.ts` | Folder management |
| `wizard-new.spec.ts` | AI wizard (new prompt) |
| `wizard-enhance.spec.ts` | AI wizard (enhance existing) |
| `roles.spec.ts` | Role-based access control |
| `settings.spec.ts` | Settings management |
| `tools.spec.ts` | Tool management |
| `trash.spec.ts` | Trash/restore operations |

```
fixtures/
├── auth.setup.ts      # Global auth setup (saves browser state per role)
└── test-fixtures.ts   # Role-based page fixtures (adminPage, editorPage, viewerPage)
helpers/
├── seed-data.ts       # Test seed data
├── pages.ts           # Page object helpers
├── sidebar.ts         # Sidebar interaction helpers
├── radix.ts           # Radix UI component helpers
└── wizard-mocks.ts    # AI wizard mock helpers
```

---

## Key Domain Concepts

### Entry Version Model
```
PromptEntry → PromptEntryVersion (1:N)
States: Draft → Published → Historical
```
- Publishing promotes a draft to published, previous published becomes historical
- Updates create new draft or modify existing draft in-place
- Each version contains the full prompt content and metadata

### Multi-Tenancy
- Global EF Core query filter on `ITenantScoped` entities
- Tenant ID extracted from JWT claims via `ITenantProvider`
- Null tenant ID enables cross-tenant queries (super admin)

### Template System
- Prompts support `{{variable}}` template fields
- Fields have types (text, number, select, etc.) defined by `TemplateFieldType`
- Template parsing: `TemplateParser` (backend) / `templateParser.ts` (frontend)

### AI Agent Architecture
```
PromptOrchestrator
├── Generation Agent    # Creates prompt content
├── Evaluation Agent    # Scores and critiques
└── Clarification Agent # Asks follow-up questions
```
- OpenAI integration via `IAgentFactory` → `OpenAIAgentFactory`
- Session pooling via `AgentSessionPool`
- SSE streaming for real-time generation feedback

---

## CI/CD

### GitHub Actions (`.github/workflows/`)
| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | Push/PR to `main` | Lint, test, build (parallel) |
| `release.yml` | Release tags | Production release |
| `docker-publish.yml` | Release | Docker image publishing |
| `codeql-analysis.yml` | Schedule/PR | Security scanning |

### CI Pipeline (`ci.yml`)
```
frontend-lint ─┐
frontend-test ─┤
frontend-build ┤→ docker-build (matrix)
backend-build ─┤
  ├─ backend-unit-tests
  └─ backend-integration-tests
```

---

## Development Commands

```bash
make install          # Install all dependencies
make dev-all          # Start database + frontend + backend
make stop-all         # Stop everything
make build            # Build both projects
make test             # Run all tests
make lint             # Lint frontend
make db-migrate       # Apply EF Core migrations
make db-migration-add NAME=X  # Generate migration
make db-reset         # Destroy and recreate DB
make db-shell         # Open psql shell
```

---

## Configuration

**Priority**: Environment variables → `appsettings.json` → DB-encrypted config (`DbConfigurationProvider`, AES-GCM)

**Key settings**:
- `JWT_SECRET` — Minimum 32 bytes
- `DATABASE_URL` — PostgreSQL connection string
- `OPENAI_API_KEY` — AI features
- Email provider (Resend API key or SMTP config)
- Google OIDC (client ID + secret)

---

## File Counts Summary

| Area | Count |
|------|-------|
| Backend Endpoints | 18 |
| Backend Services | ~30 |
| Backend Repositories | 13 |
| Backend Entities | 20 |
| Frontend Pages | 25 |
| Frontend Components (dirs) | 14 |
| Frontend API Services | 17 |
| Frontend Hooks | 10 |
| Integration Test Suites | 10 |
| E2E Test Specs | 13 |
