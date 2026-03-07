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
./scripts/setup.sh   # generates .env with random secrets
docker compose up -d  # starts postgres, backend, frontend
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
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  PostgreSQL   │
│  React / TS  │     │  .NET 10 API  │     │     16        │
│  Vite / nginx│     │  EF Core 10   │     │               │
└──────────────┘     └──────────────┘     └──────────────┘
     :8080                :5000                :5432
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
├── deploy/                # Internal deployment compose + env templates
├── scripts/               # Setup and utility scripts
├── docker-compose.yml     # Self-host compose (GHCR images)
├── .env.example           # Configuration template
└── Makefile               # Developer commands
```

## Getting Started

### Self-Hosting (Docker)

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

```bash
git clone https://github.com/pinkroosterai/Clarive.git
cd Clarive

# Option A: auto-generate .env with random secrets
./scripts/setup.sh

# Option B: manual
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, JWT_SECRET, CONFIG_ENCRYPTION_KEY

# Start everything
docker compose up -d
```

Open **http://localhost:8080**. The backend runs on port 5000.

To pin a specific version, set `CLARIVE_VERSION` in your `.env`:

```env
CLARIVE_VERSION=1.2.0
```

### Local Development

**Prerequisites:** [Node.js](https://nodejs.org/) 20+, [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0), [Docker](https://docs.docker.com/get-docker/).

```bash
make install    # install frontend + backend dependencies
make dev-all    # start database + frontend + backend
```

Frontend: http://localhost:8080 | Backend: http://localhost:5000

Three seed users are created in development (password: `password`):
- `admin@clarive.test` (admin)
- `editor@clarive.test` (editor)
- `viewer@clarive.test` (viewer)

#### Useful Commands

| Command | Description |
|---|---|
| `make dev-all` | Start database + frontend + backend |
| `make stop-all` | Stop everything |
| `make build` | Build both projects |
| `make test` | Run all tests |
| `make test-backend` | Run backend integration + unit tests |
| `make test-frontend` | Run frontend tests (Vitest) |
| `make lint` | Lint frontend |
| `make db-migrate` | Apply EF Core migrations |
| `make db-shell` | Open psql shell |
| `make db-reset` | Destroy and recreate database |
| `make clean` | Remove build artifacts |
| `make help` | Show all commands |

## Configuration

All configuration is done via environment variables. Copy `.env.example` to `.env` or run `./scripts/setup.sh` to auto-generate secrets.

| Variable | Description | Required | Default |
|---|---|---|---|
| `POSTGRES_PASSWORD` | Database password | Yes | — |
| `JWT_SECRET` | JWT signing key (min 32 chars) | Yes | — |
| `CONFIG_ENCRYPTION_KEY` | Encryption key for stored secrets | Yes | — |
| `OPENAI_API_KEY` | OpenAI-compatible API key (AI features disabled if blank) | No | — |
| `AI_ENDPOINT_URL` | Custom endpoint for OpenAI-compatible providers | No | — |
| `TAVILY_API_KEY` | Tavily API key for AI web search during generation | No | — |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | No | — |
| `CORS_ORIGINS` | Allowed CORS origins | No | `http://localhost:8080` |
| `ALLOW_REGISTRATION` | Allow new user registration | No | `true` |
| `FRONTEND_PORT` | Frontend port | No | `8080` |
| `BACKEND_PORT` | Backend port | No | `5000` |
| `EMAIL_PROVIDER` | `none`, `console`, `resend`, or `smtp` | No | `none` |
| `CLARIVE_VERSION` | Docker image tag | No | `latest` |

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
