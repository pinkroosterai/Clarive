# Development Setup

## Prerequisites

- Docker with Docker Compose v2
- Git

For running tests and migrations locally (outside Docker):
- Node.js 22+
- .NET SDK 10.0

## Getting Started

Development runs entirely in Docker with hot reload. No local SDKs needed.

```bash
git clone https://github.com/pinkroosterai/Clarive.git
cd Clarive
make setup    # generates .env with dev defaults
make dev      # starts postgres, valkey, backend, and frontend with hot reload
```

Open **http://localhost:8080**. The Vite dev server proxies `/api/` requests to the backend.

- Frontend hot reloads via Vite HMR
- Backend hot reloads via `dotnet watch`
- PostgreSQL is accessible on `localhost:5433` (mapped from container port 5432)
- Valkey cache is accessible on `localhost:6379`

## Building from Source

If you want to build the production image locally instead of pulling from Docker Hub:

```bash
make setup        # generates deploy/.env with random secrets
make deploy       # builds the unified image and starts the stack
```

This uses `deploy/docker-compose.yml` which builds from the root `Dockerfile`. Tweak `deploy/.env` for configuration. You can also build just the image without starting anything:

```bash
make build-image  # builds the production Docker image
```

## Project Structure

```
Clarive/
├── src/
│   ├── frontend/                # React + TypeScript + Vite
│   │   ├── src/
│   │   │   ├── pages/           # 27 route pages (lazy-loaded)
│   │   │   ├── components/      # 15 feature directories (~165 components)
│   │   │   ├── services/api/    # 26 API service modules
│   │   │   ├── hooks/           # 22 custom hooks
│   │   │   ├── store/           # Zustand auth store
│   │   │   ├── lib/             # Utilities, validation, config
│   │   │   └── types/           # Shared TypeScript types
│   │   └── e2e/                 # 14 Playwright specs
│   └── backend/                 # 6-project layered solution
│       ├── Clarive.Api/         # 29 endpoint groups (~135 routes), middleware
│       ├── Clarive.Application/ # 27 application services (feature-based modules)
│       ├── Clarive.Domain/      # 28 entities, 8 value objects, 26 repo interfaces
│       ├── Clarive.Infrastructure/ # 26 repositories, 27 EF configs, 31 migrations
│       ├── Clarive.AI/          # Agent orchestration, pipeline, evaluation
│       └── Clarive.Auth/        # JWT + Google OIDC
├── tests/backend/
│   ├── Clarive.Api.UnitTests/           # ~479 unit tests
│   └── Clarive.Api.IntegrationTests/    # ~334 tests (Testcontainers)
├── docs/                        # Architecture, OpenAPI spec, guides
├── deploy/                      # Production compose + container configs
│   └── unified/                 # nginx, supervisord, entrypoint
├── Dockerfile                   # Multi-stage build
├── docker-compose.yml           # Self-host compose (Docker Hub)
├── .env.example                 # 3 required secrets
└── Makefile                     # 35+ commands
```

## Common Commands

| Command | What it does |
|---|---|
| `make dev` | Start everything with hot reload |
| `make stop` | Stop dev services |
| `make restart` | Restart dev services |
| `make dev-reset` | Nuke the database and start fresh |
| `make status` | Show what's running |
| `make logs` | Tail logs |
| `make build` | Build both projects (local, no Docker) |
| `make build-image` | Build the production Docker image |
| `make test` | Run all tests (frontend + backend) |
| `make test-backend` | Backend unit + integration tests |
| `make test-frontend` | Frontend tests (Vitest) |
| `make test-e2e` | Playwright E2E tests |
| `make test-e2e-ui` | Playwright in interactive UI mode |
| `make test-filter FILTER=Auth` | Run filtered tests |
| `make lint` | Lint frontend |
| `make db-shell` | Open a psql shell |
| `make db-migrate` | Apply EF Core migrations |
| `make db-migration-add NAME=X` | Create a new migration |
| `make db-reset` | Destroy and recreate database volumes |
| `make clean` | Remove build artifacts |
| `make help` | See all 35+ commands |

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

Development uses hardcoded defaults in `deploy/docker-compose.dev.yml`. No `.env` configuration needed for basic development.

For AI features, add an AI provider (with API key, endpoint, and models) via **Super Admin > AI > Providers**, then select Default and Premium models in **AI > Settings**. For web search during generation, set the Tavily API key in **Super Admin > Settings > AI**.

See [configuration.md](configuration.md) for the full configuration reference.

## Testing

See [contributing.md](contributing.md) for the full testing breakdown. Quick version:

```bash
make test              # everything
make test-backend      # xUnit unit + integration (Testcontainers)
make test-frontend     # Vitest
make test-e2e          # Playwright
```

## Further Reading

- [Architecture](architecture.md) — system design, tech stack, auth flow, AI integration
- [Contributing](contributing.md) — workflow, testing, code conventions
- [Configuration](configuration.md) — all environment variables
- [Deployment Guide](deployment-guide.md) — production deployment
