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
| `OPENAI_API_KEY` | OpenAI API key | (optional, disables AI if blank) |
| `AI_DEFAULT_MODEL` | Default model for AI features | `gpt-5-mini` |
| `AI_PREMIUM_MODEL` | Premium model | `gpt-5.2` |

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
| `EMAIL_PROVIDER` | `resend` or `console` | `console` |
| `EMAIL_API_KEY` | Resend API key | (optional) |
| `EMAIL_FROM_ADDRESS` | Sender email address | `noreply@clarive.app` |
| `EMAIL_FROM_NAME` | Sender display name | `Clarive` |

## Monitoring

| Variable | Description | Default |
|----------|-------------|---------|
| `SENTRY_DSN` | Frontend Sentry/Bugsink DSN | (optional) |
| `SENTRY_BACKEND_DSN` | Backend Sentry/Bugsink DSN | (optional) |
| `SENTRY_TRACES_SAMPLE_RATE` | Trace sampling rate | `0.0` |
| `SENTRY_RELEASE` | Release tag for Sentry | (optional) |

## Rate Limiting

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_STRICT` | Strict rate limit (requests/window) | `5` |
