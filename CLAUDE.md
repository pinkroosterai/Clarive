# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clarive is an open-source platform for managing, versioning, and AI-enhancing LLM prompts across teams. MIT licensed.

## Architecture

```
                     :8080 (nginx)
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  PostgreSQL   │
│  React / TS  │     │  .NET 10 API │     │     16        │
│  Vite / nginx│     │  EF Core 10  │     │               │
└──────────────┘     └──────────────┘     └──────────────┘
  nginx proxies
  /api/ → backend
```

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), Tiptap v3 editor
- **Backend**: C# ASP.NET Core 10 Minimal APIs, EF Core 10 (Npgsql), ErrorOr, MiniValidation, Humanizer
- **Auth**: JWT (15-min) + rotating refresh tokens (7-day), Google OIDC, API key auth (`X-Api-Key` header)
- **AI**: Multi-provider (OpenAI-compatible) via Microsoft.Extensions.AI + Microsoft.Agents.AI agent-based orchestration (generation, evaluation, clarification agents), Tavily web search. Providers and models configured via Super Admin > AI.
- **State**: Zustand (auth store only), TanStack React Query (server state)

## Common Commands

Everything runs through Docker (dev and prod). No local SDK required for `make dev` or `make deploy`.

```bash
# Setup & Deploy
make setup            # Generate .env (dev) and deploy/.env (prod) with random secrets
# Server deployment → cd /home/najgeetsrev/ClariveDeployServer && ./deploy.sh clarive <dev|prod>

# Development (all Docker, hot reload via volume mounts)
make dev              # Start all services with hot reload (Vite HMR + dotnet watch)
make stop             # Stop development services
make restart          # Restart development services
make dev-reset        # Stop, wipe database, and restart fresh
make logs             # Tail development service logs
make status           # Show running containers and health status

# Database
make db-shell         # Open psql shell (auto-detects dev or prod)
make db-migrate       # Apply EF Core migrations (requires dotnet SDK)
make db-migration-add NAME=MyMigration  # Create new migration (requires dotnet SDK)
make db-reset         # Destroy and recreate database volumes

# Build / Test (requires local dotnet SDK + Node.js)
make build            # Build both projects (local, no Docker)
make test             # Run all tests (frontend + backend)
make test-frontend    # Run frontend tests (Vitest)
make test-backend     # Run backend unit + integration tests
make test-filter FILTER=Auth  # Run filtered tests
make test-e2e         # Run Playwright E2E tests
make lint             # Lint frontend (ESLint)
make clean            # Remove build artifacts
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

# Frontend E2E (Playwright — requires running dev environment)
cd src/frontend
npx playwright test e2e/auth.spec.ts
npx playwright test -g "test name"
npx playwright test --debug          # Debug mode
```

## Deployment

Server deployment is managed centrally via **ClariveDeployServer**.

```bash
# From the deploy server:
cd /home/najgeetsrev/ClariveDeployServer
./deploy.sh clarive prod        # demo.clarive.app
./deploy.sh clarive dev         # demo-dev.clarive.app
./deploy.sh clarive prod --status
```

The Makefile retains `make dev` / `make stop` / `make logs` for **local development only**.
See `/home/najgeetsrev/ClariveDeployServer/README.md` for full deployment docs.

### Demo-dev test account
- URL: https://demo-dev.clarive.app
- Email: `pinkroosterai@gmail.com`
- Password: `3Ph2P5hFWqtw4nL`

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

### Error Handling (ErrorOr)
Services return `ErrorOr<T>` for operations that can fail. Endpoints consume via:
```csharp
var result = await service.DoSomethingAsync(...);
if (result.IsError)
    return result.Errors.ToHttpResult(ctx);  // bridges to ctx.ErrorResult()
return Results.Ok(result.Value);
```
- `Error.NotFound(code, desc)` → 404, `Error.Validation(...)` → 422, `Error.Conflict(...)` → 409
- `Error.Custom(429, ...)` for non-standard status codes
- `ErrorOr<Success>` with `Result.Success` for void-success operations
- Extension in `Helpers/ErrorOrExtensions.cs` maps ErrorType to HTTP status codes

### Request Validation (MiniValidation)
Request records use Data Annotations (`[property: Required]`, `[property: StringLength(...)]`, etc.):
```csharp
if (Validator.ValidateRequest(request) is { } validationErr) return validationErr;
```
- `Validator.ValidateRequest<T>()` in `Services/Validator.cs` uses `MiniValidator.TryValidate()`
- Returns 422 with `VALIDATION_ERROR` code on first error; null if valid
- `Validator.IsValidEmail()` and `Validator.MinPasswordLength` still available for service-layer business logic

### Repository + Service Layers
- **Repositories**: Interface-based (`IFooRepository` → `EfFooRepository`), scoped lifetime, tenant-isolated via global query filter on `ITenantScoped`
- **Services**: Business logic with constructor injection (primary constructors), explicit DB transactions via `db.Database.BeginTransactionAsync()`
- Service methods return `ErrorOr<T>` for failable operations
- **Important**: Do NOT enable `EnableRetryOnFailure` on Npgsql — the codebase has 14+ explicit `BeginTransactionAsync()` calls which are incompatible with `NpgsqlRetryingExecutionStrategy`

### Multi-Tenancy
Global EF Core query filter on all `ITenantScoped` entities. `ITenantProvider` (scoped) extracts tenant from JWT claims. Null tenant ID allows cross-tenant queries (superuser).

### Entry Version Model
`PromptEntry` → `PromptEntryVersion` with states: Draft → Published → Historical. Publishing promotes draft, marks previous published as historical. Updates create new draft or modify existing draft in-place.

### Optimistic Concurrency
`PromptEntry` and `PromptEntryVersion` use PostgreSQL `xmin` system column as a concurrency token. `ErrorHandlingMiddleware` catches `DbUpdateConcurrencyException` → 409 Conflict with `CONCURRENCY_CONFLICT` code. Integration tests in `EntryConcurrencyTests.cs` verify this behavior.

### DI Registration Pattern
- Repositories: scoped
- Services (business logic — EntryService, AccountService, AuthService, ProfileService, etc.): scoped
- Services (cryptographic — JwtService, PasswordHasher): singleton
- Email: conditional (`ResendEmailService`, `SmtpEmailService`, or `ConsoleEmailService`)
- AI: `IAgentFactory` singleton, `IPromptOrchestrator` scoped
- 4 background hosted services (cleanup, maintenance sync)

### Configuration Priority
Environment variables → `appsettings.json` → DB-encrypted config (`DbConfigurationProvider`, AES-GCM). JWT secret requires minimum 32 bytes.

## Frontend Patterns

### Directory Structure (`src/frontend/src/`)
- `pages/` — route-level page components (lazy-loaded)
- `components/` — organized by feature (auth, editor, library, wizard, settings, ui, etc.)
- `services/api/` — 17 domain-specific API service files using shared `apiClient`
- `hooks/` — custom React hooks (useEditorState, useEditorMutations, useDnd, etc.)
- `store/` — single Zustand auth store (`authStore.ts`)
- `types/` — shared TypeScript types
- `lib/` — utilities (config, queryClient, validators, handleApiError)

### API Client (`services/api/apiClient.ts`)
Custom fetch-based client with automatic JWT refresh on 401, streaming SSE support (`api.postSSE`), and structured `ApiError` class. Tokens stored in localStorage (`cl_token`, `cl_refresh`).

### Routing
React Router v6 in `App.tsx`. `<ProtectedRoute>` triggers `initializeAuth()`. `<SuperRoute>` for admin. Code splitting via `React.lazy()`.

### Forms & Validation
React Hook Form + Zod schemas (in `lib/validationSchemas.ts`). Error display via Sonner toasts. Non-RHF forms (dialogs, inline inputs) use Zod `safeParse` for inline validation with error messages (e.g., `inviteUserSchema`, `apiKeyNameSchema`, `workspaceNameSchema`).

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
- `Fixture.Services` exposes the DI container for direct DB access in tests (e.g., concurrency tests use `IgnoreQueryFilters()` to bypass tenant scoping)

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
