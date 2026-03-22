# Architecture

## Overview

Clarive is a multi-tenant platform for managing, versioning, and AI-enhancing LLM prompts. A React frontend talks to a C# backend, backed by PostgreSQL and Valkey. Everything ships as a single container with separate database and cache services.

## System Diagram

```
                    ┌─────────────┐
                    │   Browser   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Nginx    │  (reverse proxy, port 8080)
                    └──┬──────┬──┘
                       │      │
              ┌────────▼┐  ┌──▼────────┐
              │ Frontend │  │  Backend  │
              │ (React)  │  │ (ASP.NET) │
              └──────────┘  └─────┬─────┘
                                  │
                 ┌────────────┬───┴───┬─────────────┐
                 │            │       │             │
           ┌─────▼─────┐ ┌───▼───┐ ┌─▼───────┐ ┌──▼──────────┐
           │ PostgreSQL │ │Valkey │ │   AI    │ │   Google    │
           │     16     │ │  8    │ │ (OpenAI │ │   OAuth     │
           │            │ │(cache)│ │ compat) │ │             │
           └────────────┘ └───────┘ └─────────┘ └─────────────┘
```

Nginx serves the React build and proxies `/api/` to the .NET backend. Supervisor manages both processes inside the container. PostgreSQL and Valkey run as separate Docker services.

## Tech Stack

| Layer | What |
|---|---|
| Frontend | React 18, TypeScript, Vite 7, Tailwind CSS, shadcn/ui (Radix), Tiptap v3 |
| State | Zustand (auth only), TanStack React Query (server state) |
| Backend | C# ASP.NET Core 10 Minimal APIs |
| ORM | EF Core 10 (Npgsql) with 27 entity configurations |
| Database | PostgreSQL 16 with EF Core migrations |
| Cache | Valkey 8 (distributed cache with AOF persistence), tenant-scoped TenantCacheService |
| Auth | JWT (15-min access) + rotating refresh tokens (7-day), Google OIDC, API keys |
| AI | Any OpenAI-compatible provider via Microsoft.Extensions.AI, agent-based orchestration |
| Search | Tavily web search integration for research-backed generation |
| Testing | xUnit + Testcontainers (backend), Vitest (frontend unit), Playwright (E2E) |
| Infra | Docker Compose (app + PostgreSQL + Valkey), Makefile (35+ commands) |

## Components

### Frontend (`src/frontend/`)

React 18 SPA with TypeScript. All pages are lazy-loaded via `React.lazy()`. State management splits between Zustand (auth store only) and TanStack React Query (all server state). Forms use React Hook Form + Zod.

The editor is Tiptap v3 with custom extensions for template variable highlighting. Drag-and-drop uses @dnd-kit.

27 route pages, 15 component feature directories (~165 components), 26 API service modules, 22 custom hooks.

### Backend (`src/backend/Clarive.Api/`)

ASP.NET Core 10 Minimal APIs. Services return `ErrorOr<T>`, endpoints bridge errors to HTTP via `result.Errors.ToHttpResult(ctx)`. Request validation uses MiniValidation with Data Annotations.

29 endpoint groups (~135 routes), 27 application services, 26 EF Core repositories, 28 entity models.

Background services handle token cleanup, AI session cleanup, usage log cleanup, account purge, LiteLLM registry sync, and maintenance mode sync.

### Database

PostgreSQL 16 with EF Core migrations. Multi-tenant via `tenant_id` on all scoped entities (using `ITenantScoped` interface). Global query filters handle tenant isolation automatically.

`PromptEntry` and `PromptEntryVersion` use PostgreSQL's `xmin` system column for optimistic concurrency. The error middleware catches `DbUpdateConcurrencyException` and returns 409.

## Multi-Tenancy

Each user belongs to one or more tenants (workspaces). All data queries are scoped by `tenant_id` through EF Core global query filters. Tenant resolution happens via JWT claims on every request through `HttpContextTenantProvider`.

## Authentication Flow

1. User logs in via email/password or Google OIDC
2. Backend issues a JWT access token (15 min) + hashed refresh token (7 days, stored in DB)
3. Frontend stores tokens in localStorage
4. Expired access tokens refresh automatically via an interceptor in `apiClient.ts`
5. API key auth (`X-Api-Key` header, `cl_` prefix) available for programmatic access via the public API

## AI Integration

AI features use an agent-based orchestration pattern:

- **PromptOrchestrator** coordinates multi-step workflows (generate, refine, enhance, evaluate)
- **OpenAIAgentFactory** creates specialized agents (generation, evaluation, clarification, system message, decompose)
- **AgentSessionPool** manages AI session lifecycles
- **TaskBuilder** and **ChatOptionsBuilder** handle model configuration

All AI endpoints support SSE streaming via `Accept: text/event-stream`.

Works with any OpenAI-compatible API. Providers and models are configured through the Super Admin dashboard, not environment variables.

## Middleware Pipeline

1. ForwardedHeaders
2. SecurityHeadersMiddleware
3. ErrorHandlingMiddleware (catches `DbUpdateConcurrencyException` → 409)
4. MaintenanceModeMiddleware
5. Serilog RequestLogging
6. CORS
7. Swagger/SwaggerUI (development only)
8. Authentication (JWT + API Key)
9. Authorization
10. RateLimiter (`auth`: 20 req/min, `strict-auth`: 5 req/15min)

## Deployment

Single Docker image containing nginx + .NET, managed by supervisor. See [deployment-guide.md](deployment-guide.md).
