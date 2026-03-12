# Migration: Split-Image to Unified Image

This guide covers migrating from the old split-image deployment (separate `clarive-backend` and `clarive-frontend` containers) to the new unified image (single `clarive` container with backend + nginx frontend).

## Prerequisites

- Access to the server running the old deployment
- The updated `deploy/docker-compose.yml` (from this repo)
- The updated `deploy/.env` (review `deploy/.env.example` for new format)

## What changes

| Before (split) | After (unified) |
|----------------|-----------------|
| `clarive-backend` container (ASP.NET on :5000) | Single `clarive-app` container |
| `clarive-frontend` container (nginx on :8080) | Backend + nginx in one container on :8080 |
| 2 images: `clarive-backend:TAG`, `clarive-frontend:TAG` | 1 image: `clarive:TAG` |
| Frontend proxies to backend via Docker network | nginx proxies to backend via localhost:5000 |

## What does NOT change

- **PostgreSQL** — same container, same volume (`pgdata`), no data migration needed
- **Avatars** — same volume (`avatars`), same mount path (`/app/data/avatars`)
- **Environment variables** — same variable names, same values
- **Port** — still exposed on :8080 (configurable via `CLARIVE_PORT`)

## Migration steps

### 1. Pull the latest code

```bash
cd ~/Clarive
git pull origin main
```

### 2. Build the unified image

```bash
make build-image
# Or with a specific tag:
TAG=$(git rev-parse --short HEAD)
docker build --target production -t clarive:$TAG .
```

### 3. Review deploy/.env

Compare your existing `deploy/.env` against the updated `deploy/.env.example`. The variable names are the same, but verify nothing is missing. Key change: `AllowedHosts` now defaults to `*` in the compose file.

### 4. Stop the old stack

```bash
# If using make:
make undeploy

# Or directly:
docker compose -p clarive --env-file deploy/.env -f deploy/docker-compose.yml down
```

> **Important**: Do NOT use `down -v` — that would delete your database and avatar volumes.

### 5. Start the new stack

```bash
make deploy
```

This will:
1. Build the unified image (tagged with git SHA)
2. Start postgres + clarive containers
3. Wait for the health check to pass
4. Report success

### 6. Verify

```bash
# Check containers are running
make status

# Check health
docker inspect --format='{{.State.Health.Status}}' clarive-app

# Test the app
curl -s http://localhost:8080/healthz/live
```

Open the app in your browser and verify:
- Login works
- Existing data (entries, workspaces) is intact
- AI streaming works (if OpenAI key configured)

## Rollback

If something goes wrong:

### 1. Stop the new stack

```bash
make undeploy
```

### 2. Revert to the old compose file

```bash
git checkout HEAD~1 -- deploy/docker-compose.yml
```

### 3. Restart with old images

The old images (`clarive-backend:TAG`, `clarive-frontend:TAG`) are still on disk. Start them:

```bash
# Find the old tag
docker images | grep clarive-backend

# Deploy with that tag
CLARIVE_TAG=<old-tag> docker compose -p clarive --env-file deploy/.env -f deploy/docker-compose.yml up -d
```

### 4. Verify rollback

```bash
make status
curl -s http://localhost:8080/healthz/live
```

## Cleaning up old images

After confirming the unified deployment is stable, remove the old split images:

```bash
docker images | grep -E 'clarive-(backend|frontend)' | awk '{print $3}' | xargs docker rmi
```
