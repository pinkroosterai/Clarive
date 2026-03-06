# Configuration

All configuration is done via environment variables, loaded from `deploy/envs/<env>.env` files. See `deploy/.env.example` for a complete template.

## Database

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | PostgreSQL username | `clarive` |
| `POSTGRES_PASSWORD` | PostgreSQL password | (required) |
| `POSTGRES_DB` | Database name | `clarive` |

## Authentication

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | HMAC-SHA256 signing key (min 32 chars) | (required) |
| `JWT_ISSUER` | JWT issuer claim | `Clarive` |
| `JWT_AUDIENCE` | JWT audience claim | `Clarive` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | (optional) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | (optional) |
| `VITE_GOOGLE_CLIENT_ID` | Google client ID for frontend | (optional) |

## AI

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | API key for OpenAI-compatible provider | (optional, disables AI if blank) |
| `AI_ENDPOINT_URL` | Custom endpoint URL for OpenAI-compatible providers (Ollama, LiteLLM, vLLM, etc.) | (optional, uses OpenAI default) |
| `AI_DEFAULT_MODEL` | Default model for AI features | `gpt-4o-mini` |
| `AI_PREMIUM_MODEL` | Premium model | `gpt-4o` |

## Application

| Variable | Description | Default |
|----------|-------------|---------|
| `ASPNETCORE_ENVIRONMENT` | ASP.NET environment | `Production` |
| `CORS_ORIGINS` | Allowed CORS origin (frontend URL) | (required) |
| `VITE_API_URL` | API URL for frontend | `/api` |
| `CONFIG_ENCRYPTION_KEY` | AES-256-GCM key for secret storage | (required) |

## Email

| Variable | Description | Default |
|----------|-------------|---------|
| `EMAIL_PROVIDER` | Email delivery provider: `none`, `console`, `resend`, or `smtp` | `none` |
| `EMAIL_API_KEY` | Resend API key (only when provider is `resend`) | (optional) |
| `EMAIL_SMTP_HOST` | SMTP server hostname (only when provider is `smtp`) | (optional) |
| `EMAIL_SMTP_PORT` | SMTP server port | `587` |
| `EMAIL_SMTP_USERNAME` | SMTP authentication username | (optional) |
| `EMAIL_SMTP_PASSWORD` | SMTP authentication password | (optional) |
| `EMAIL_SMTP_USE_TLS` | Enable STARTTLS for SMTP connection | `true` |
| `EMAIL_FROM_ADDRESS` | Sender email address (for `resend` and `smtp`) | `noreply@clarive.app` |
| `EMAIL_FROM_NAME` | Sender display name (for `resend` and `smtp`) | `Clarive` |

**Provider details:**
- **`none`** (default) — No emails are sent. New users are automatically verified and can use all features immediately. Ideal for self-hosted setups that don't need email.
- **`console`** — Logs email content to stdout instead of sending. Users still need to verify their email (useful for development/debugging the verification flow).
- **`resend`** — Sends emails via the [Resend](https://resend.com) API. Requires `EMAIL_API_KEY`.
- **`smtp`** — Sends emails via an SMTP server. Requires `EMAIL_SMTP_HOST` at minimum.

## Rate Limiting

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_STRICT` | Strict rate limit (requests/window) | `5` |
