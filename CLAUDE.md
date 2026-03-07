# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clarive is an open-source platform for managing, versioning, and AI-enhancing LLM prompts across teams. MIT licensed.

## Architecture

```
Frontend (React 18 + TS + Vite)  →  Backend (.NET 10 Minimal APIs)  →  PostgreSQL 16
        :8080                              :5000                          :5432
```

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), Tiptap v3 editor
- **Backend**: C# ASP.NET Core 10 Minimal APIs, EF Core 10 (Npgsql)
- **Auth**: JWT (15-min) + rotating refresh tokens (7-day), Google OIDC, API key auth (`X-Api-Key` header)
- **AI**: OpenAI via agent-based orchestration (generation, evaluation, clarification agents), Tavily web search
- **State**: Zustand (auth store only), TanStack React Query (server state)

## Common Commands

```bash
make install          # Install frontend (npm) + backend (dotnet) dependencies
make dev-all          # Start database + frontend + backend
make stop-all         # Stop everything
make build            # Build both projects
make test             # Run all tests
make lint             # Lint frontend (ESLint)
make db-migrate       # Apply EF Core migrations
make db-migration-add NAME=MyMigration  # Generate new migration
make db-reset         # Destroy and recreate database
make db-shell         # Open psql shell
```

### Running Individual Tests

```bash
# Backend unit tests
cd tests/backend/Clarive.Api.UnitTests
dotnet test --filter "FullyQualifiedName~ClassName"
dotnet test --filter "FullyQualifiedName~ClassName.MethodName"

# Backend integration tests (requires Docker for Testcontainers)
cd tests/backend/Clarive.Api.IntegrationTests
dotnet test --filter "FullyQualifiedName~ClassName"

# Frontend unit tests
cd src/frontend
npx vitest src/path/to/file.test.ts
npx vitest -t "test name" --run

# Frontend E2E (Playwright — requires dev servers running)
cd src/frontend
npx playwright test e2e/auth.spec.ts
npx playwright test -g "test name"
npx playwright test --debug          # Debug mode
npm run test:e2e:ui                  # Interactive UI
```

## Backend Patterns

### Endpoint Convention
Static extension methods in `Endpoints/` using Minimal API groups:
```csharp
public static class FooEndpoints {
    public static RouteGroupBuilder MapFooEndpoints(this IEndpointRouteBuilder app) {
        var group = app.MapGroup("/api/foo").WithTags("Foo").RequireAuthorization();
        group.MapGet("/", HandleList);
        return group;
    }
    private static async Task<IResult> HandleList(HttpContext ctx, IFooRepository repo, CancellationToken ct) {
        var tenantId = ctx.GetTenantId();
        // ...
        return Results.Ok(response);
    }
}
```
- Handlers are static `Task<IResult>` methods with DI via parameters
- Tenant extracted from JWT via `ctx.GetTenantId()`, `ctx.GetUserId()` extensions
- Errors returned via `ctx.ErrorResult(statusCode, errorCode, message)`
- Endpoints registered in `Program.cs` as `app.MapFooEndpoints()`

### Repository + Service Layers
- **Repositories**: Interface-based (`IFooRepository` → `EfFooRepository`), scoped lifetime, tenant-isolated via global query filter on `ITenantScoped`
- **Services**: Business logic with constructor injection (primary constructors), explicit DB transactions via `db.Database.BeginTransactionAsync()`
- Validation methods return `string?` (null = valid)

### Multi-Tenancy
Global EF Core query filter on all `ITenantScoped` entities. `ITenantProvider` (scoped) extracts tenant from JWT claims. Null tenant ID allows cross-tenant queries (superuser).

### Entry Version Model
`PromptEntry` → `PromptEntryVersion` with states: Draft → Published → Historical. Publishing promotes draft, marks previous published as historical. Updates create new draft or modify existing draft in-place.

### DI Registration Pattern
- Repositories: scoped
- Services (business logic): scoped
- Services (cryptographic — JwtService, PasswordHasher): singleton
- Email: conditional (`ResendEmailService` or `ConsoleEmailService`)
- AI: `IAgentFactory` singleton, `IPromptOrchestrator` scoped
- 4 background hosted services (cleanup, maintenance sync)

### Configuration Priority
Environment variables → `appsettings.json` → DB-encrypted config (`DbConfigurationProvider`, AES-GCM). JWT secret requires minimum 32 bytes.

## Frontend Patterns

### Directory Structure (`src/frontend/src/`)
- `pages/` — route-level page components (lazy-loaded)
- `components/` — organized by feature (auth, editor, library, wizard, settings, ui, etc.)
- `services/api/` — 26 domain-specific API service files using shared `apiClient`
- `hooks/` — custom React hooks (useEditorState, useEditorMutations, useDnd, etc.)
- `store/` — single Zustand auth store (`authStore.ts`)
- `types/` — shared TypeScript types
- `lib/` — utilities (config, queryClient, validators, handleApiError)

### API Client (`services/api/apiClient.ts`)
Custom fetch-based client with automatic JWT refresh on 401, streaming SSE support (`api.postSSE`), and structured `ApiError` class. Tokens stored in localStorage (`cl_token`, `cl_refresh`).

### Routing
React Router v6 in `App.tsx`. `<ProtectedRoute>` triggers `initializeAuth()`. `<SuperRoute>` for admin. Code splitting via `React.lazy()`.

### Forms & Validation
React Hook Form + Zod schemas (in `lib/validationSchemas.ts`). Error display via Sonner toasts.

### Path Alias
`@/` maps to `src/` (configured in vite.config.ts and tsconfig).

## Test Infrastructure

### Backend Integration Tests
- Testcontainers PostgreSQL (Docker required) + `WebApplicationFactory<Program>`
- Shared fixture via xUnit `[Collection("Integration")]` — one container per test run
- AI, Email, MCP services mocked with test doubles
- Seed data with deterministic GUIDs (`TestData.cs` mirrors `SeedData.DeterministicGuid()`)
- Auth via `AuthHelper.GetAdminTokenAsync()` (tokens cached per email)
- Seed users: `admin@clarive.dev`, `jane@clarive.dev`, `sam@clarive.dev` (password: "password")

### Backend Unit Tests
- In-memory EF Core database + NSubstitute mocks for repositories
- Base class `EntryServiceTestBase` with factory methods

### Frontend Unit Tests
- Vitest + jsdom, globals enabled (no imports for describe/it/expect)
- API client mocked via `vi.mock()`, test factories in `src/test/factories.ts`

### Frontend E2E Tests
- Playwright with global auth setup (`e2e/fixtures/auth.setup.ts`) — logs in as each role, saves browser state
- Role-based fixtures: `adminPage`, `editorPage`, `viewerPage`
- Seed data helpers in `e2e/helpers/seed-data.ts` mirror backend seeds
- Dev users: `admin@clarive.test`, `editor@clarive.test`, `viewer@clarive.test` (password: "password")

## CI Pipeline (`.github/workflows/ci.yml`)

Runs on push/PR to `main`. Parallel jobs: frontend-lint, frontend-test, frontend-build, backend-build → backend-unit-tests + backend-integration-tests, docker-build (matrix). Cancels in-progress on new push.
