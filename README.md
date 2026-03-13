<p align="center">
  <img src="docs/images/logo.svg" alt="Clarive" width="120" />
</p>

<h1 align="center">Clarive</h1>

<p align="center">
  <strong>Stop hardcoding prompts. Start managing them.</strong>
</p>

<p align="center">
  <a href="https://github.com/pinkroosterai/Clarive/stargazers"><img src="https://img.shields.io/github/stars/pinkroosterai/Clarive?style=flat-square" alt="GitHub Stars" /></a>
  <a href="https://github.com/pinkroosterai/Clarive/actions/workflows/ci.yml"><img src="https://github.com/pinkroosterai/Clarive/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/pinkroosterai/Clarive/releases"><img src="https://img.shields.io/github/v/release/pinkroosterai/Clarive?style=flat-square" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
  <a href="https://hub.docker.com/r/pinkrooster/clarive"><img src="https://img.shields.io/docker/pulls/pinkrooster/clarive?style=flat-square" alt="Docker Pulls" /></a>
</p>

<p align="center">
  The open-source platform for managing, versioning, and AI-enhancing LLM prompts across teams.<br />
  Version control, AI-powered refinement with quality scoring, team workspaces — all self-hosted in a single container.
</p>

<p align="center">
  <img src="docs/images/screenshot.png" alt="Clarive — prompt library and editor" width="800" />
</p>

---

## Why Clarive?

Most teams building with LLMs hit the same wall:

- **Prompts are scattered** across code, Notion pages, spreadsheets, and Slack messages
- **No version history** — when a prompt change breaks production, you can't roll back
- **Non-technical teammates are locked out** — editing a prompt requires a code deploy
- **No quality tracking** — you have no idea if your latest tweak actually improved anything

Clarive gives your prompts the same discipline as your code: version control, quality metrics, team collaboration, and a real editor — without the overhead.

---

## Deploy in 60 Seconds

```bash
cp .env.example .env
# Fill in the 3 secrets (generation commands are in the file)
docker compose up -d
```

Open **http://localhost:8080** and create your first account.

> This pulls the pre-built image from [Docker Hub](https://hub.docker.com/r/pinkrooster/clarive). To build from source instead, see [Getting Started](#build-from-source).

---

## Table of Contents

- [Features](#features)
- [How Clarive Compares](#how-clarive-compares)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [Community & Support](#community--support)
- [Star History](#star-history)
- [License](#license)

## Features

### AI-Powered Prompt Refinement

<p align="center">
  <img src="docs/images/wizard.png" alt="Clarive AI wizard — multi-turn prompt refinement" width="700" />
</p>

Not just one-shot generation — Clarive maintains a multi-turn conversation with AI agents that iteratively improve your prompts.

- **Generation wizard**: Describe what you need, review AI-generated variations, refine through follow-up questions
- **Quality scoring with history**: Track how your prompt's score improves across refinement iterations
- **Web search integration**: Tavily-powered research injects real-time context into prompt generation
- **System message generation**: Automatically generate system prompts from your content
- **Chain decomposition**: Break monolithic prompts into multi-step workflows

### Version Control for Prompts

Full lifecycle management: **Draft → Published → Historical** — with the same rigor you'd expect from code versioning.

- Version comparison with inline diffs (word-by-word, color-coded)
- Undo/redo with snapshot history
- Roll back to any previous version instantly
- Optimistic concurrency protection (no overwriting teammates' changes)

### Rich Editor

<p align="center">
  <img src="docs/images/editor.png" alt="Clarive editor with template variable highlighting" width="700" />
</p>

- WYSIWYG Markdown editor powered by Tiptap v3
- Live template variable highlighting (`{{variable}}` rendered inline)
- Multi-prompt entries with drag-and-drop reordering
- System message section with dedicated editing

### Team Collaboration

<p align="center">
  <img src="docs/images/library.png" alt="Clarive prompt library with folders and tags" width="700" />
</p>

- Role-based access control: Admin, Editor, Viewer
- Multi-workspace support with seamless switching
- Email invitations with role assignment
- Full audit log of all changes (who changed what, when)
- Tag-based organization with AND/OR filtering

### Developer API

- REST API with OpenAPI spec at `/api-docs`
- API key authentication for programmatic access (`X-Api-Key` header)
- Import/export in JSON, YAML, and Markdown
- Rate limiting and structured error codes

### Self-Hosted Simplicity

- **One container** — nginx + .NET API managed by supervisor, all on port 8080
- **One command** — `docker compose up -d` and you're running
- **MIT licensed** — no open-core traps, no enterprise license keys for basic features
- **Your data stays yours** — PostgreSQL on your infrastructure

---

## How Clarive Compares

| Feature | Clarive | Langfuse | PromptLayer | Agenta |
|---|:---:|:---:|:---:|:---:|
| Prompt versioning | Yes | Yes | Yes | Yes |
| Multi-turn AI refinement | Yes | — | — | — |
| Quality scoring with history | Yes | — | — | — |
| Web search-backed generation | Yes | — | — | — |
| Rich WYSIWYG editor | Yes | — | Yes | — |
| Chain decomposition | Yes | — | — | — |
| Self-hosted (single container) | Yes | Yes (complex) | — | Yes |
| Team RBAC & audit logs | Yes | Paid | Paid | Paid |
| Public REST API | Yes | Yes | Yes | Yes |
| MIT license | Yes | MIT (EE) | — | MIT (EE) |
| LLM observability / tracing | — | Yes | Yes | Yes |

Clarive focuses on **prompt authoring, refinement, and team management**. If you need LLM observability and tracing, tools like Langfuse complement Clarive well.

---

## Architecture

Clarive runs as a single unified container: nginx serves the React frontend and reverse-proxies `/api/` requests to the .NET backend. Supervisor manages both processes.

```
               :8080 (nginx)
┌─────────────────────────────────┐     ┌──────────────┐
│         Clarive Container       │     │  PostgreSQL   │
│  ┌──────────┐   ┌────────────┐  │────▶│     16        │
│  │  nginx   │──▶│ .NET 10 API│  │     │               │
│  │ (frontend)│  │ (backend)  │  │     └──────────────┘
│  └──────────┘   └────────────┘  │
│         supervisor              │
└─────────────────────────────────┘
```

<details>
<summary><strong>Tech Stack</strong></summary>

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

</details>

<details>
<summary><strong>Project Structure</strong></summary>

```
Clarive/
├── src/
│   ├── frontend/          # React 18 + TypeScript + Vite
│   └── backend/           # ASP.NET Core 10 Minimal APIs
├── tests/
│   └── backend/           # xUnit integration + unit tests
├── docs/                  # Architecture, API spec, guides
├── deploy/                # Build-from-source Compose + env template
│   └── unified/           # nginx, supervisord, entrypoint configs
├── scripts/               # Setup, release, and utility scripts
├── Dockerfile             # Multi-stage: production, dev-backend, dev-frontend
├── docker-compose.yml     # Self-host Compose (Docker Hub pull)
├── .env.example           # Self-host env template (3 required secrets)
└── Makefile               # Dev + deploy commands
```

</details>

---

## Getting Started

### Self-Hosting (Docker Hub)

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) with Docker Compose v2.

```bash
cp .env.example .env
# Generate and fill in the 3 secrets (commands are in the file)
docker compose up -d
```

Open **http://localhost:8080**. All traffic (frontend + API) is served through a single port via nginx reverse proxy.

To pin a specific version, set `CLARIVE_VERSION` in `.env` (e.g., `CLARIVE_VERSION=1.0.0`). By default it pulls `latest`.

To configure optional features (AI, Google OAuth, email), see [Configuration](#configuration).

### Build from Source

For contributors or custom deployments, build the image locally:

```bash
git clone https://github.com/pinkroosterai/Clarive.git
cd Clarive
make setup    # generates deploy/.env with random secrets
make deploy   # builds unified image and starts the stack
```

This uses `deploy/docker-compose.yml` which builds from the root `Dockerfile`. Edit `deploy/.env` for full configuration options.

### Local Development

<details>
<summary><strong>Development setup with hot reload</strong></summary>

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
| `make build-image` | Build unified production image locally |
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

</details>

## Configuration

Configuration is done via environment variables.

- **Self-hosting** (Docker Hub): `.env` (root) — used by `docker compose up`
- **Build from source**: `deploy/.env` — used by `make deploy`

`make setup` auto-generates both files with random secrets.

<details>
<summary><strong>Environment variables reference</strong></summary>

| Variable | Description | Required | Default |
|---|---|---|---|
| `POSTGRES_PASSWORD` | Database password | Yes | — |
| `JWT_SECRET` | JWT signing key (min 32 chars) | Yes | — |
| `CONFIG_ENCRYPTION_KEY` | Encryption key for stored secrets | Yes | — |
| `CORS_ORIGINS` | Allowed CORS origins | No | `http://localhost:8080` |
| `CLARIVE_PORT` | Host port to expose | No | `8080` |
| `CLARIVE_VERSION` | Docker Hub image tag (self-host only) | No | `latest` |
| `OPENAI_API_KEY` | OpenAI-compatible API key (AI features disabled if blank) | No | — |
| `AI_ENDPOINT_URL` | Custom endpoint for OpenAI-compatible providers | No | — |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | No | — |
| `ALLOW_REGISTRATION` | Allow new user registration | No | `true` |
| `EMAIL_PROVIDER` | `none`, `console`, `resend`, or `smtp` | No | `none` |

</details>

See [docs/configuration.md](docs/configuration.md) for the full reference.

## Contributing

Contributions are welcome! Whether it's a bug fix, a new feature, or documentation improvements — we'd love your help.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes and add tests
4. Run `make test` and `make lint` to verify
5. Submit a pull request

Looking for a place to start? Check out issues labeled [**good first issue**](https://github.com/pinkroosterai/Clarive/labels/good%20first%20issue).

For bug reports and feature requests, use [GitHub Issues](https://github.com/pinkroosterai/Clarive/issues).

## Community & Support

- [GitHub Issues](https://github.com/pinkroosterai/Clarive/issues) — bug reports and feature requests
- [GitHub Discussions](https://github.com/pinkroosterai/Clarive/discussions) — questions, ideas, and community chat

If you find Clarive useful, consider giving it a star — it helps others discover the project.

## Star History

<a href="https://star-history.com/#pinkroosterai/Clarive&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=pinkroosterai/Clarive&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=pinkroosterai/Clarive&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=pinkroosterai/Clarive&type=Date" />
 </picture>
</a>

## License

This project is licensed under the [MIT License](LICENSE).
