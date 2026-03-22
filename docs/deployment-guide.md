# Deployment Guide

## Prerequisites

- Docker and Docker Compose v2
- Git

## Quick Start

```bash
# 1. Clone
git clone https://github.com/pinkroosterai/Clarive.git
cd Clarive

# 2. Generate env file with random secrets
make setup

# 3. (Optional) Edit deploy/.env to configure AI, OAuth, email, etc.

# 4. Build and deploy
make deploy
```

Open **http://localhost:8080**. All traffic (frontend + API) is served through a single port via nginx reverse proxy.

## Environment Files

`make setup` generates two env files:

| File | Purpose | Used by |
|------|---------|---------|
| `.env` | Development defaults (hardcoded credentials) | `make dev` |
| `deploy/.env` | Production secrets (randomly generated) | `make deploy` |

Templates are at `.env.example` and `deploy/.env.example`.

## Deployment Commands

```bash
make setup      # Generate env files with random secrets
make deploy     # Build images from HEAD and start the production stack
make undeploy   # Stop and remove the production stack
make status     # Show running containers (dev + prod)
```

### What `make deploy` does

1. Builds Docker images tagged with the current git short SHA
2. Starts postgres, backend, and frontend containers
3. Waits for the backend health check to pass
4. Reports the deployed tag and URL

## Database

```bash
make db-shell                         # Open psql shell (auto-detects dev or prod)
make db-migrate                       # Apply EF Core migrations (requires .NET SDK)
make db-migration-add NAME=MyChange   # Create a new migration (requires .NET SDK)
make db-reset                         # Destroy all database volumes (with confirmation)
```

## Docker Architecture

The compose file (`deploy/docker-compose.yml`) defines three services:

- **app** — Unified container: nginx reverse proxy + ASP.NET Core backend (port 8080). Nginx serves the React frontend as static files and proxies `/api/` to the backend.
- **postgres** — PostgreSQL 16 with health check
- **valkey** — Valkey 8 cache with AOF persistence, 256MB maxmemory, allkeys-lru eviction

Only port 8080 is exposed to the host. Valkey and PostgreSQL are internal-only.

```
Browser → :8080 (nginx inside app container)
                ├── /api/*  → localhost:5000 (ASP.NET Core)
                └── /*      → static files / SPA fallback
```

## Health Checks

The backend exposes `/healthz/live` and `/healthz/ready` endpoints. Docker's built-in health check mechanism monitors these, and `make deploy` waits for the backend to become healthy before reporting success.

## Updating

```bash
git pull
make deploy    # rebuilds images from the new code and redeploys
```

## Custom Domain

To serve Clarive on a custom domain, update `deploy/.env`:

```env
CORS_ORIGINS=https://your-domain.example.com
```

Then redeploy with `make deploy`.
