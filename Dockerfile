# ── Clarive Unified Dockerfile ────────────────────────────────
# All build targets for Clarive live here:
#
#   production    — Single image with .NET backend + nginx frontend (Docker Hub)
#   dev-backend   — .NET SDK with dotnet watch for hot reload
#   dev-frontend  — Node with Vite dev server for hot reload
#   backend-build — (internal) Compiles the .NET backend
#   frontend-build — (internal) Builds the React frontend
#
# Production:   docker build --target production -t pinkrooster/clarive:latest .
# Dev backend:  docker build --target dev-backend -t clarive-backend-dev .
# Dev frontend: docker build --target dev-frontend -t clarive-frontend-dev .

# ── Stage: backend-build ─────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /repo
# Copy build infrastructure files needed for restore (CPM, SDK pin, props)
COPY global.json Directory.Build.props Directory.Packages.props ./
COPY src/backend/Directory.Build.props src/backend/
COPY src/backend/Clarive.Domain/Clarive.Domain.csproj src/backend/Clarive.Domain/
COPY src/backend/Clarive.Infrastructure/Clarive.Infrastructure.csproj src/backend/Clarive.Infrastructure/
COPY src/backend/Clarive.AI/Clarive.AI.csproj src/backend/Clarive.AI/
COPY src/backend/Clarive.Auth/Clarive.Auth.csproj src/backend/Clarive.Auth/
COPY src/backend/Clarive.Application/Clarive.Application.csproj src/backend/Clarive.Application/
COPY src/backend/Clarive.Api/Clarive.Api.csproj src/backend/Clarive.Api/
RUN --mount=type=cache,target=/root/.nuget/packages \
    dotnet restore src/backend/Clarive.Api/Clarive.Api.csproj
COPY src/backend/ src/backend/
RUN --mount=type=cache,target=/root/.nuget/packages \
    dotnet publish src/backend/Clarive.Api/Clarive.Api.csproj \
    -c Release -o /app/publish

# ── Stage: frontend-build ────────────────────────────────────
FROM node:20-alpine AS frontend-build
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
WORKDIR /app
COPY src/frontend/package.json src/frontend/package-lock.json src/frontend/.npmrc ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts
COPY src/frontend/ .
RUN npm run build

# ── Stage: dev-backend (hot reload) ──────────────────────────
# Runs as root in dev — volume mounts from host need matching permissions.
# Production stage uses a non-root user.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS dev-backend
WORKDIR /app/Clarive.Api
EXPOSE 5000
ENV DOTNET_WATCH_RESTART_ON_RUDE_EDIT=true
CMD ["sh", "-c", "dotnet restore && dotnet watch run --no-launch-profile"]

# ── Stage: dev-frontend (hot reload) ─────────────────────────
FROM node:20-alpine AS dev-frontend
WORKDIR /app
COPY src/frontend/package.json src/frontend/package-lock.json src/frontend/.npmrc ./
RUN npm ci --ignore-scripts
COPY src/frontend/ .
EXPOSE 8080
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ── Stage: production ────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS production

# Disable ICU globalization libraries (~28-30MB savings) — Clarive uses English only
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=true
ENV ASPNETCORE_URLS=http://+:5000

# Install nginx (no supervisord — entrypoint manages processes directly)
RUN apk add --no-cache nginx && \
    mkdir -p /run/nginx /usr/share/nginx/html /etc/nginx/snippets && \
    # Create app user
    addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    mkdir -p /app/data/avatars && \
    chown -R appuser:appgroup /app && \
    # Nginx directories writable
    chown -R appuser:appgroup /var/lib/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    chown -R appuser:appgroup /run/nginx && \
    chown -R appuser:appgroup /usr/share/nginx/html && \
    # Nginx pid
    touch /run/nginx/nginx.pid && \
    chown appuser:appgroup /run/nginx/nginx.pid

WORKDIR /app

# Copy backend
COPY --from=backend-build --chown=appuser:appgroup /app/publish .

# Copy API reference
COPY --chown=appuser:appgroup docs/api-reference.yaml ./docs/api-reference.yaml

# Copy frontend
COPY --from=frontend-build --chown=appuser:appgroup /app/dist /usr/share/nginx/html

# Copy unified config files
COPY --chown=appuser:appgroup deploy/unified/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --chown=appuser:appgroup deploy/unified/nginx.conf /etc/nginx/http.d/default.conf
COPY --chown=appuser:appgroup deploy/unified/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/healthz/live || exit 1

USER appuser
ENTRYPOINT ["/docker-entrypoint.sh"]
