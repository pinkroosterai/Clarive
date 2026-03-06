# Development Setup

## Prerequisites

- Node.js 20+
- .NET SDK 9.0
- Docker (for PostgreSQL)
- Git

## Getting Started

```bash
# Clone the repo
git clone https://github.com/pinkroosterai/Clarive.git
cd Clarive

# Install dependencies
make install

# Start the database
make db-start

# Apply migrations
make db-migrate

# Start frontend + backend
make dev
```

The app will be available at:
- Frontend: http://localhost:8080
- Backend: http://localhost:5000
- Swagger: http://localhost:5000/swagger

## Project Structure

```
clarive/
├── src/
│   ├── frontend/          # React + TypeScript + Vite
│   └── backend/           # ASP.NET Core 9 + EF Core
├── tests/
│   └── backend/           # xUnit unit + integration tests
├── deploy/                # Docker Compose + env files
├── docs/                  # Documentation
├── scripts/               # Admin CLI and utilities
└── Makefile               # All dev + deploy commands
```

## Common Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start frontend + backend |
| `make stop` | Stop both services |
| `make dev-all` | Start database + frontend + backend |
| `make build` | Build both for production |
| `make test` | Run all tests |
| `make test-frontend` | Run Vitest unit tests |
| `make test-backend` | Run xUnit unit + integration tests |
| `make test-e2e` | Run Playwright E2E tests |
| `make lint` | Run ESLint on frontend |
| `make clean` | Remove build artifacts |

## Database

Local development uses a PostgreSQL container:

```bash
make db-start       # Start PostgreSQL
make db-stop        # Stop PostgreSQL
make db-status      # Show status
make db-shell       # Open psql shell
make db-migrate     # Apply migrations
make db-migration-add NAME=MyMigration  # Create new migration
make db-reset       # Destroy and recreate data
```

## Environment Variables

The backend reads configuration from `appsettings.json` and environment variables. For local development, the defaults work out of the box with the local PostgreSQL container.

For AI features, set `OPENAI_API_KEY` in your environment or `appsettings.Development.json`. For OpenAI-compatible providers (Ollama, LiteLLM, etc.), also set `AI_ENDPOINT_URL`.

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
