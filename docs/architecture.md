# Architecture

## Overview

Clarive is a multi-tenant SaaS platform for managing, versioning, and AI-enhancing LLM prompts across teams. It consists of a React frontend, a C# ASP.NET Core backend, and a PostgreSQL database.

## System Diagram

```
                    ┌─────────────┐
                    │   Browser   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Nginx    │  (reverse proxy)
                    └──┬──────┬──┘
                       │      │
              ┌────────▼┐  ┌──▼────────┐
              │ Frontend │  │  Backend  │
              │ (React)  │  │ (ASP.NET) │
              └──────────┘  └─────┬─────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
              ┌─────▼─────┐ ┌────▼────┐ ┌──────▼──────┐
              │ PostgreSQL │ │ OpenAI  │ │   Google    │
              │            │ │   API   │ │   OAuth     │
              └────────────┘ └─────────┘ └─────────────┘
```

## Components

### Frontend (`src/frontend/`)
- **Stack**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **State**: Zustand (auth), TanStack Query (server state)
- **Editor**: Tiptap v3 rich text editor
- **Routing**: React Router v6
- **Serves on**: port 8080 (nginx in production, Vite in dev)

### Backend (`src/backend/Clarive.Api/`)
- **Stack**: ASP.NET Core 10 Minimal APIs, EF Core 10
- **Auth**: JWT (15-min access + 7-day refresh), Google OIDC, API keys
- **AI**: OpenAI via Microsoft.Extensions.AI
- **Serves on**: port 5000

### Database
- PostgreSQL 16 with EF Core migrations
- Multi-tenant via `tenant_id` on all entities
- Data: users, prompts, versions, folders, tools, configs

## Multi-tenancy

Each user belongs to one or more tenants (workspaces). All data is scoped by `tenant_id`. Tenant resolution happens via JWT claims on every request.

## Authentication Flow

1. User logs in via email/password or Google OIDC
2. Backend issues JWT access token (15 min) + refresh token (7 days, stored in DB)
3. Frontend stores tokens in memory (Zustand) and localStorage
4. Expired access tokens are refreshed automatically via interceptor
5. API key auth available for programmatic access

## AI Integration

- Prompt generation (wizard), enhancement, system message generation, and chain decomposition
- Uses OpenAI models via `Microsoft.Extensions.AI` abstraction
- Configurable default and premium models via environment variables or in-app settings
- Tavily web search integration for research-backed prompt generation
- MCP (Model Context Protocol) tool import support

## Deployment

See [deployment-guide.md](deployment-guide.md) for full details. Uses Docker Compose with Makefile commands: `make dev` for development (hot reload) and `make deploy` for production.
