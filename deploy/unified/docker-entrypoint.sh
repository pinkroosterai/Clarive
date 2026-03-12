#!/bin/sh
set -e

# Escape a value for safe embedding in a JavaScript string literal.
# Prevents injection via env vars containing quotes, backslashes, or </script>.
escape_js() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/'"'"'/\\'"'"'/g; s/</\\u003c/g'
}

# Generate runtime config from environment variables.
# This makes the image portable across environments.
cat > /usr/share/nginx/html/config.js << JSEOF
window.__CLARIVE_CONFIG__ = {
  apiUrl: "$(escape_js "${VITE_API_URL:-/api}")",
  googleClientId: "$(escape_js "${VITE_GOOGLE_CLIENT_ID:-}")",
  mode: "production"
};
JSEOF

exec supervisord -c /etc/supervisor/conf.d/clarive.conf
