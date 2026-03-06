# Clarive Project Context

## Overview
Open-source platform for managing, versioning, and AI-enhancing LLM prompts across teams.
License: AGPL-3.0 | Repo: github.com/pinkroosterai/Clarive

## Architecture
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Tiptap v3 | Port 8080
- **Backend**: C# ASP.NET Core 10 Minimal APIs (.NET 10) | Port 5000
- **Database**: PostgreSQL 16 via EF Core 10 (Npgsql) | Port 5432
- **Auth**: JWT (15-min) + rotating refresh tokens (7-day), Google OIDC, API keys
- **AI**: OpenAI via Microsoft.Extensions.AI
- **State**: Zustand (auth), TanStack React Query (server state)
- **Testing**: xUnit + Testcontainers (backend), Vitest (frontend), Playwright (e2e)
- **Infra**: Docker Compose, Makefile

## Key Paths
- Solution: `src/backend/Clarive.sln`
- Backend project: `src/backend/Clarive.Api/`
- Frontend: `src/frontend/` (uses bun lockfile)
- Integration tests: `tests/backend/Clarive.Api.IntegrationTests/`
- Unit tests: `tests/backend/Clarive.Api.UnitTests/`

## Backend Structure (src/backend/Clarive.Api/)
Auth/, Configuration/, Data/, Endpoints/, Helpers/, HealthChecks/, Middleware/, Models/, Properties/, Repositories/, Seed/, Services/
Entry: Program.cs | Config: appsettings.json

## Dev Commands
- `make dev-all` — start db + frontend + backend
- `make test` — run all tests
- `make build` — build both projects
- `make lint` — lint frontend
- `make db-migrate` — apply EF Core migrations

## Dev Seed Users (password: `password`)
- admin@clarive.test (admin), editor@clarive.test (editor), viewer@clarive.test (viewer)
