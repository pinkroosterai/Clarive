# Configuration

Clarive uses two layers of configuration:

1. **Environment variables** (`.env` file) — infrastructure secrets and Docker settings. Set before the container starts.
2. **Super Admin dashboard** — application settings (AI, email, auth, registration). Configurable at runtime without restarting.

Dashboard settings are stored encrypted in the database (AES-GCM via `CONFIG_ENCRYPTION_KEY`) and reload every 30 seconds. If the same setting exists as both an env var and a dashboard value, the dashboard wins.

## Environment Variables

These are the only settings you need in your `.env` file. Run `make setup` to generate them with random secrets, or copy from `.env.example`.

### Required

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | JWT signing key (min 32 chars) |
| `CONFIG_ENCRYPTION_KEY` | AES-256-GCM key for encrypting secrets stored in the database |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ORIGINS` | Allowed CORS origin (your frontend URL). Requires container restart to change. | `http://localhost:8080` |
| `CLARIVE_PORT` | Host port to expose | `8080` |
| `CLARIVE_VERSION` | Docker Hub image tag (self-host only) | `latest` |
| `POSTGRES_USER` | PostgreSQL username | `clarive` |
| `POSTGRES_DB` | Database name | `clarive` |
| `ASPNETCORE_ENVIRONMENT` | ASP.NET environment | `Production` |
| `VALKEY_URL` | Valkey cache connection (host:port) | `valkey:6379` |

> **Note:** `CORS_ORIGINS` is the only application setting that requires a container restart. Everything else can be changed at runtime through the dashboard.

## Super Admin Dashboard Settings

After your first deploy, log in as the super admin (the first account created) and go to **Super Admin > Settings**. All of these are configurable at runtime.

### AI

AI providers, models, and API keys are all configured through the dashboard.

**Setup flow:**
1. Go to **Super Admin > AI > Providers**
2. Add your OpenAI-compatible provider (API key, endpoint URL)
3. Configure which models are available
4. In **AI > Settings**, select which models to use as Default (everyday tasks) and Premium (generation wizard)

| Setting | Dashboard Path | Description | Default |
|---------|---------------|-------------|---------|
| Default Model | `Ai:DefaultModel` | Model for evaluation, clarification | `gpt-4o-mini` |
| Premium Model | `Ai:PremiumModel` | Model for prompt generation (wizard) | `gpt-4o` |
| Tavily API Key | `Ai:TavilyApiKey` | [Tavily](https://tavily.com) web search key (enables research-backed generation) | — |
| Allowed Models | `Ai:AllowedModels` | Restrict which models appear in the Playground | all |
| Temperature/MaxTokens overrides | per-model | Fine-tune model behavior | provider defaults |

### Email

| Setting | Dashboard Path | Description | Default |
|---------|---------------|-------------|---------|
| Provider | `Email:Provider` | `none`, `resend`, or `smtp` | `none` |
| Resend API Key | `Email:ApiKey` | Required when provider is `resend` | — |
| SMTP Host | `Email:SmtpHost` | Required when provider is `smtp` | — |
| SMTP Port | `Email:SmtpPort` | SMTP server port | `587` |
| SMTP Username | `Email:SmtpUsername` | SMTP auth username | — |
| SMTP Password | `Email:SmtpPassword` | SMTP auth password (encrypted) | — |
| SMTP TLS | `Email:SmtpUseTls` | Enable STARTTLS | `true` |
| From Address | `Email:FromAddress` | Sender email | `noreply@localhost` |
| From Name | `Email:FromName` | Sender display name | `Clarive` |

**Provider details:**
- **`none`** (default) — No emails sent. New users are auto-verified. Works fine for self-hosted setups that don't need email.
- **`resend`** — Sends via the [Resend](https://resend.com) API. Set the API key in the dashboard.
- **`smtp`** — Sends via any SMTP server. Configure host and credentials in the dashboard.

> In development, you can also use `console` (via env var `EMAIL_PROVIDER=console`) to log emails to stdout instead of sending them.

### Authentication

| Setting | Dashboard Path | Description | Default |
|---------|---------------|-------------|---------|
| Google Client ID | `Google:ClientId` | Google OAuth client ID | — |
| Google Client Secret | `Google:ClientSecret` | Google OAuth client secret (encrypted) | — |
| JWT Expiration | `Jwt:ExpirationMinutes` | Access token lifetime | 15 min |
| Refresh Token Expiration | `Jwt:RefreshTokenExpirationDays` | Refresh token lifetime | 7 days |

The Google sign-in button appears automatically when a client ID is configured.

### Application

| Setting | Dashboard Path | Description | Default |
|---------|---------------|-------------|---------|
| Allow Registration | `App:AllowRegistration` | Allow new user self-registration | `true` |
| Frontend URL | `App:FrontendUrl` | Used in email links, invitations, password resets | from `CORS_ORIGINS` |
| Rate Limit | `RateLimiting:PermitLimit` | Auth endpoint limit (requests/minute) | 20 |
| Strict Rate Limit | `RateLimiting:StrictPermitLimit` | Strict auth limit (requests/15min) | 5 |

## Configuration Priority

For settings that can exist in both places:

```
Dashboard setting (highest priority)
    ↓
Environment variable
    ↓
appsettings.json default (lowest priority)
```

If you set `GOOGLE_CLIENT_ID` as an env var at startup, it works as the initial value. But if someone later changes `Google:ClientId` in the dashboard, the dashboard value takes over.

## Environment Files

| File | Purpose | Used by |
|------|---------|---------|
| `.env` | Self-host config (Docker Hub image) | `docker compose up` |
| `deploy/.env` | Build-from-source config | `make deploy` |
| `.env.example` | Template for self-hosting | — |
| `deploy/.env.example` | Template for build-from-source | — |

`make setup` generates both files with random secrets.
