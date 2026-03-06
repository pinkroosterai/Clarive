#!/bin/sh
set -e

# Escape a value for safe embedding in a JavaScript string literal.
# Prevents injection via env vars containing quotes, backslashes, or </script>.
escape_js() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/'"'"'/\\'"'"'/g; s/</\\u003c/g'
}

# Validate a numeric value, returning the default if invalid.
safe_number() {
  printf '%.4f' "$1" 2>/dev/null || printf '%.4f' "$2"
}

# Generate runtime config from environment variables.
# This makes the frontend Docker image portable across environments.
cat > /usr/share/nginx/html/config.js << JSEOF
window.__CLARIVE_CONFIG__ = {
  apiUrl: "$(escape_js "${VITE_API_URL:-/api}")",
  googleClientId: "$(escape_js "${VITE_GOOGLE_CLIENT_ID:-}")",
  sentryDsn: "$(escape_js "${VITE_SENTRY_DSN:-}")",
  sentryTracesSampleRate: $(safe_number "${VITE_SENTRY_TRACES_SAMPLE_RATE:-0}" "0"),
  sentryRelease: "$(escape_js "${VITE_SENTRY_RELEASE:-}")",
  mode: "production"
};
JSEOF

exec nginx -g 'daemon off;'
