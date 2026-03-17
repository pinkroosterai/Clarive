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
WORKDIR /src
COPY src/backend/Clarive.Api/Clarive.Api.csproj Clarive.Api/
RUN dotnet restore Clarive.Api/Clarive.Api.csproj
COPY src/backend/ .
RUN dotnet publish Clarive.Api/Clarive.Api.csproj \
    -c Release -o /app/publish

# ── Stage: frontend-build ────────────────────────────────────
FROM node:20-alpine AS frontend-build
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
WORKDIR /app
COPY src/frontend/package.json src/frontend/package-lock.json ./
RUN npm ci --ignore-scripts
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
COPY src/frontend/package.json src/frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY src/frontend/ .
EXPOSE 8080
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ── Stage: production ────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS production

# Install nginx and supervisord
RUN apk add --no-cache nginx supervisor && \
    mkdir -p /var/log/supervisor /run/nginx /usr/share/nginx/html /etc/nginx/snippets && \
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
    chown -R appuser:appgroup /var/log/supervisor && \
    # Nginx pid
    touch /run/nginx/nginx.pid && \
    chown appuser:appgroup /run/nginx/nginx.pid

WORKDIR /app

# Copy backend
COPY --from=backend-build --chown=appuser:appgroup /app/publish .

# Copy frontend
COPY --from=frontend-build --chown=appuser:appgroup /app/dist /usr/share/nginx/html

# Copy unified config files
COPY --chown=appuser:appgroup deploy/unified/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --chown=appuser:appgroup deploy/unified/nginx.conf /etc/nginx/http.d/default.conf
COPY --chown=appuser:appgroup deploy/unified/supervisord.conf /etc/supervisor/conf.d/clarive.conf
COPY --chown=appuser:appgroup deploy/unified/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/healthz/live || exit 1

USER appuser
ENTRYPOINT ["/docker-entrypoint.sh"]
