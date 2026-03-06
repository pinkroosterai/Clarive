# Deployment Guide

## Prerequisites

- Docker and Docker Compose v2
- A reverse proxy (e.g., Traefik, Caddy) on the `proxy` network
- Git

## Quick Start

```bash
# 1. Clone
git clone https://github.com/pinkroosterai/Clarive.git
cd Clarive

# 2. Create env file
cp deploy/.env.example deploy/envs/dev.env
# Edit deploy/envs/dev.env with your values

# 3. Build and deploy
make deploy
```

## Environment Files

Environment files live in `deploy/envs/` and are gitignored (they contain secrets). See `deploy/.env.example` for all available variables.

Each environment gets its own file:
- `deploy/envs/dev.env` — development
- `deploy/envs/prod.env` — production

## Pipeline

The deployment pipeline has two stages:

```
make deploy    →  Builds images from current HEAD, deploys to dev
make promote   →  Promotes the dev image tag to prod (no rebuild)
```

### Deploy to dev

```bash
make deploy
```

This will:
1. Build Docker images tagged with the current git short SHA
2. Start containers via `docker compose`
3. Run a health check on the backend
4. Record the tag in `.deploy-state/dev.tag`

### Promote to prod

```bash
make promote
```

This re-uses the exact images from dev — no rebuild occurs.

## Environment Management

```bash
make up ENV=prod          # Start environment
make down ENV=dev         # Stop environment
make restart-env ENV=prod # Restart environment
make recreate ENV=prod    # Recreate containers (picks up env changes)
make destroy ENV=prod     # Remove containers + volumes (destructive)
make status               # Show status of all environments
make logs ENV=dev         # Tail container logs
```

## Database

```bash
make db-migrate-env ENV=prod   # Apply EF Core migrations
make db-backup ENV=prod        # Backup database
make db-restore ENV=dev FILE=backups/xxx.sql.gz
make db-clone FROM=prod TO=dev # Clone prod → dev
```

## Docker Architecture

The compose file (`deploy/docker-compose.yml`) defines four services:
- `postgres` — PostgreSQL 16 with health check
- `backend` — ASP.NET Core API (port 5000)
- `frontend` — React app served by nginx (port 8080)

All services connect via an internal network. Frontend and backend also join the external `proxy` network for reverse proxy access.

## Health Checks

The backend exposes `/healthz/live` which is checked by Docker's built-in health check mechanism. The Makefile waits for the backend to become healthy after deploy.
