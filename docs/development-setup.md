# Development Setup

## Prerequisites

- Docker with Docker Compose v2
- Git

For running tests and migrations locally (outside Docker):
- Node.js 20+
- .NET SDK 10.0

## Getting Started

Development runs entirely in Docker with hot reload.

```bash
# Clone the repo
git clone https://github.com/pinkroosterai/Clarive.git
cd Clarive

# Generate dev env file
make setup

# Start all services with hot reload
make dev
```

Open **http://localhost:8080**. The Vite dev server proxies `/api/` requests to the backend internally.

- Frontend hot reloads via Vite HMR
- Backend hot reloads via `dotnet watch`
- PostgreSQL is accessible on `localhost:5433` (mapped from container port 5432)

## Project Structure

```
Clarive/
├── src/
│   ├── frontend/          # React + TypeScript + Vite
│   └── backend/           # ASP.NET Core 10 + EF Core
├── tests/
│   └── backend/           # xUnit unit + integration tests
├── deploy/                # Docker Compose files + production env template
├── docs/                  # Documentation
├── scripts/               # Setup and utility scripts
└── Makefile               # All dev + deploy commands
```

## Common Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start all services with hot reload |
| `make stop` | Stop development services |
| `make restart` | Restart development services |
| `make dev-reset` | Stop, wipe database, and restart fresh |
| `make status` | Show running containers and health |
| `make logs` | Tail development service logs |
| `make build` | Build both projects (local, no Docker) |
| `make test` | Run all tests |
| `make test-frontend` | Run Vitest unit tests |
| `make test-backend` | Run xUnit unit + integration tests |
| `make test-e2e` | Run Playwright E2E tests |
| `make test-e2e-ui` | Run Playwright in interactive UI mode |
| `make test-filter FILTER=Auth` | Run filtered tests |
| `make lint` | Run ESLint on frontend |
| `make clean` | Remove build artifacts |

## Database

Development uses a PostgreSQL container with hardcoded credentials (`clarive`/`clarive`), accessible on `localhost:5433`.

```bash
make db-shell                         # Open psql shell
make db-migrate                       # Apply migrations (requires .NET SDK)
make db-migration-add NAME=MyChange   # Create new migration (requires .NET SDK)
make db-reset                         # Destroy and recreate database volumes
make dev-reset                        # Stop, wipe database, and restart fresh
```

## Environment Variables

Development uses hardcoded defaults in `deploy/docker-compose.dev.yml` — no `.env` configuration is needed for basic development.

For AI features, set `OPENAI_API_KEY` in `.env` (or export it in your shell). For OpenAI-compatible providers (Ollama, LiteLLM, etc.), also set `AI_ENDPOINT_URL`. For AI web search during generation, set `TAVILY_API_KEY`.

## Testing

### Frontend

Unit tests use Vitest and are co-located with source files (`*.test.ts`):

```bash
make test-frontend        # Run once
cd src/frontend && npx vitest  # Watch mode
```

E2E tests use Playwright:

```bash
make test-e2e       # Headless
make test-e2e-ui    # Interactive UI mode
```

### Backend

Unit and integration tests use xUnit:

```bash
make test-backend
make test-filter FILTER=AuthTests  # Run filtered tests
```

Integration tests use Testcontainers (auto-creates PostgreSQL containers).
