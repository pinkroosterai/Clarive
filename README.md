<p align="center">
  <img src="docs/images/logo.svg" alt="Clarive" width="120" />
</p>

<h1 align="center">Clarive</h1>

<p align="center">
  <a href="https://github.com/pinkroosterai/Clarive/actions/workflows/ci.yml"><img src="https://github.com/pinkroosterai/Clarive/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/pinkroosterai/Clarive/releases"><img src="https://img.shields.io/github/v/release/pinkroosterai/Clarive?style=flat-square" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/.NET_10-512BD4?style=flat-square&logo=dotnet&logoColor=white" alt=".NET 10" />
  <img src="https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/PostgreSQL_16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
</p>

<p align="center">
  An open-source platform for managing, versioning, and AI-enhancing LLM prompts across teams.
</p>

<p align="center">
  <img src="docs/images/screenshot.png" alt="Clarive — prompt library and editor" width="800" />
</p>

## Quick Start

```bash
git clone https://github.com/pinkroosterai/Clarive.git
cd Clarive
make setup    # generates .env files with random secrets
make deploy   # builds images and starts postgres, backend, frontend
```

Open **http://localhost:8080** and create your first account.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Self-Hosting (Docker)](#self-hosting-docker)
  - [Local Development](#local-development)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [Community & Support](#community--support)
- [License](#license)

## Features

**Prompt Management**
- Full lifecycle: draft, published, and historical states with version tracking
- WYSIWYG Markdown editor powered by Tiptap v3 with template variable highlighting
- Nested folder organization with drag-and-drop
- Version comparison with inline diffs, undo/redo with snapshot history
- Import/export in JSON, YAML, and Markdown

**AI-Powered**
- Prompt generation wizard: describe what you need, review AI output, then save
- Enhancement workflow: improve existing prompts with AI-suggested refinements
- Configurable models (default and premium tiers)

**Multi-Tenant Teams**
- Role-based access control (admin, editor, viewer)
- JWT + refresh token auth with Google OIDC
- Email verification and password reset flows
- API key authentication for programmatic access

**Developer Experience**
- REST API with OpenAPI spec
- Integration tests via Testcontainers
- One-command Docker Compose deployment
- Makefile with developer commands for everything

## Architecture

```
                         :8080
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  PostgreSQL   │
│  React / TS  │     │  .NET 10 API  │     │     16        │
│  Vite / nginx│     │  EF Core 10   │     │               │
└──────────────┘     └──────────────┘     └──────────────┘
  nginx proxies
  /api/ → backend
```

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Tiptap v3 |
| State | Zustand (auth), TanStack React Query (server state) |
| Backend | C# ASP.NET Core 10 Minimal APIs |
| Database | PostgreSQL 16 via EF Core 10 (Npgsql) |
| Auth | JWT (15-min) + rotating refresh tokens (7-day), Google OIDC, API keys |
| AI | OpenAI via Microsoft.Extensions.AI |
| Testing | xUnit + Testcontainers, Vitest, Playwright |
| Infra | Docker Compose, Makefile |

```
Clarive/
├── src/
│   ├── frontend/          # React 18 + TypeScript + Vite
│   └── backend/           # ASP.NET Core 10 Minimal APIs
├── tests/
│   └── backend/           # xUnit integration + unit tests
├── docs/                  # Architecture, API spec, guides
├── deploy/                # Docker Compose files + production env template
├── scripts/               # Setup and utility scripts
├── .env.example           # Development env template
└── Makefile               # Dev + deploy commands
```

## Getting Started

### Self-Hosting (Docker)

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) with Docker Compose v2.

```bash
git clone https://github.com/pinkroosterai/Clarive.git
cd Clarive
make setup    # generates deploy/.env with random secrets
make deploy   # builds images and starts the stack
```

Open **http://localhost:8080**. All traffic (frontend + API) is served through a single port via nginx reverse proxy.

To configure optional features (AI, Google OAuth, email), edit `deploy/.env` before deploying. See [Configuration](#configuration) for all variables.

### Local Development

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) with Docker Compose v2.

Development runs entirely in Docker with hot reload (Vite HMR for frontend, `dotnet watch` for backend).

```bash
make setup    # generates .env with dev defaults
make dev      # starts postgres, backend, and frontend with hot reload
```

Open **http://localhost:8080**. The Vite dev server proxies `/api/` requests to the backend internally.

#### Useful Commands

| Command | Description |
|---|---|
| `make dev` | Start all services with hot reload |
| `make stop` | Stop development services |
| `make restart` | Restart development services |
| `make dev-reset` | Stop, wipe database, and restart fresh |
| `make status` | Show running containers and health |
| `make logs` | Tail development service logs |
| `make build` | Build both projects (local, no Docker) |
| `make test` | Run all tests (frontend + backend) |
| `make test-backend` | Run backend unit + integration tests |
| `make test-frontend` | Run frontend tests (Vitest) |
| `make test-e2e` | Run Playwright E2E tests |
| `make test-filter FILTER=Auth` | Run filtered tests |
| `make lint` | Lint frontend |
| `make db-shell` | Open psql shell |
| `make db-migrate` | Apply EF Core migrations |
| `make db-migration-add NAME=X` | Create a new migration |
| `make db-reset` | Destroy and recreate database volumes |
| `make clean` | Remove build artifacts |
| `make help` | Show all commands |

## Configuration

Configuration is done via environment variables. `make setup` generates env files with random secrets automatically.

- **Development**: `.env` (root) — used by `make dev`
- **Production**: `deploy/.env` — used by `make deploy`

| Variable | Description | Required | Default |
|---|---|---|---|
| `POSTGRES_PASSWORD` | Database password | Yes | — |
| `JWT_SECRET` | JWT signing key (min 32 chars) | Yes | — |
| `CONFIG_ENCRYPTION_KEY` | Encryption key for stored secrets | Yes | — |
| `OPENAI_API_KEY` | OpenAI-compatible API key (AI features disabled if blank) | No | — |
| `AI_ENDPOINT_URL` | Custom endpoint for OpenAI-compatible providers | No | — |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | No | — |
| `CORS_ORIGINS` | Allowed CORS origins | No | `http://localhost:8080` |
| `ALLOW_REGISTRATION` | Allow new user registration | No | `true` |
| `FRONTEND_PORT` | Frontend port | No | `8080` |
| `EMAIL_PROVIDER` | `none`, `console`, `resend`, or `smtp` | No | `none` |

See [docs/configuration.md](docs/configuration.md) for the full reference.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes and add tests
4. Run `make test` and `make lint` to verify
5. Submit a pull request

For bug reports and feature requests, use [GitHub Issues](https://github.com/pinkroosterai/Clarive/issues).

## Community & Support

- [GitHub Issues](https://github.com/pinkroosterai/Clarive/issues) — bug reports and feature requests
- [GitHub Discussions](https://github.com/pinkroosterai/Clarive/discussions) — questions, ideas, and community chat

## License

This project is licensed under the [MIT License](LICENSE).
