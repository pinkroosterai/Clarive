# ── Stage: base ──────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS base
WORKDIR /app
EXPOSE 5000

# ── Stage: dev (hot-reload) ─────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS dev
WORKDIR /app/Clarive.Api
EXPOSE 5000
ENV DOTNET_WATCH_RESTART_ON_RUDE_EDIT=true
CMD ["sh", "-c", "dotnet restore && dotnet watch run --no-launch-profile"]

# ── Stage: build ─────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Clarive.Api/Clarive.Api.csproj Clarive.Api/
RUN dotnet restore Clarive.Api/Clarive.Api.csproj
COPY . .
RUN dotnet publish Clarive.Api/Clarive.Api.csproj \
    -c Release -o /app/publish --no-restore

# ── Stage: production ────────────────────────────────────────
FROM base AS production
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    mkdir -p /app/data/avatars && \
    chown -R appuser:appgroup /app
COPY --from=build --chown=appuser:appgroup /app/publish .
USER appuser
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/healthz/live || exit 1
ENTRYPOINT ["dotnet", "Clarive.Api.dll"]
