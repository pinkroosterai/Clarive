#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
EXAMPLE_FILE="$ROOT_DIR/.env.example"

C_RESET='\033[0m'
C_GREEN='\033[32m'
C_YELLOW='\033[33m'
C_CYAN='\033[36m'
C_BOLD='\033[1m'

# Generate a random secret (base64, URL-safe)
generate_secret() {
  openssl rand -base64 "$1" 2>/dev/null || head -c "$1" /dev/urandom | base64 | tr -d '\n'
}

if [ -f "$ENV_FILE" ]; then
  printf "${C_YELLOW}.env already exists. Overwrite? [y/N] ${C_RESET}"
  read -r ans
  if [ "$ans" != "y" ] && [ "$ans" != "Y" ]; then
    printf "${C_YELLOW}Skipped.${C_RESET}\n"
    exit 0
  fi
fi

if [ ! -f "$EXAMPLE_FILE" ]; then
  printf "Error: .env.example not found at %s\n" "$EXAMPLE_FILE" >&2
  exit 1
fi

# Generate secrets
PG_PASS=$(generate_secret 32)
JWT_SEC=$(generate_secret 48)
ENC_KEY=$(generate_secret 32)

# Copy template and replace placeholders
cp "$EXAMPLE_FILE" "$ENV_FILE"
sed -i "s|POSTGRES_PASSWORD=changeme|POSTGRES_PASSWORD=$PG_PASS|" "$ENV_FILE"
sed -i "s|JWT_SECRET=changeme-minimum-32-characters-long|JWT_SECRET=$JWT_SEC|" "$ENV_FILE"
sed -i "s|CONFIG_ENCRYPTION_KEY=changeme-base64-32-byte-key|CONFIG_ENCRYPTION_KEY=$ENC_KEY|" "$ENV_FILE"

printf "\n${C_BOLD}${C_GREEN}Setup complete!${C_RESET}\n\n"
printf "  ${C_CYAN}.env${C_RESET} created with generated secrets.\n\n"
printf "  ${C_BOLD}Next steps:${C_RESET}\n"
printf "    1. Review ${C_CYAN}.env${C_RESET} and set any optional values (OpenAI key, Google OAuth, etc.)\n"
printf "    2. Run: ${C_GREEN}docker compose up -d${C_RESET}\n"
printf "    3. Open: ${C_CYAN}http://localhost:8080${C_RESET}\n\n"
