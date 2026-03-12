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

- **postgres** — PostgreSQL 16 with health check
- **backend** — ASP.NET Core API (internal port 5000, not exposed to host)
- **frontend** — React app served by nginx (port 8080), proxies `/api/` to backend

All services communicate over Docker's default network. Only port 8080 is exposed to the host.

```
Browser → :8080 (nginx)
                ├── /api/*  → backend:5000
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
ALLOWED_HOSTS=your-domain.example.com;127.0.0.1
```

Then redeploy with `make deploy`.
