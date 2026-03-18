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
  mode: "production"
};
JSEOF

# Start nginx in the background (serves static files + proxies /api/ to dotnet)
nginx

# Run dotnet as the foreground process (PID 1 — receives SIGTERM for graceful shutdown)
# Docker Compose restart policy handles container-level restarts if dotnet crashes
export ASPNETCORE_URLS='http://+:5000'
exec dotnet /app/Clarive.Api.dll
