#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/deploy"

C_RESET='\033[0m'
C_GREEN='\033[32m'
C_YELLOW='\033[33m'
C_CYAN='\033[36m'
C_RED='\033[31m'
C_BOLD='\033[1m'

# Generate a random secret (base64, URL-safe)
generate_secret() {
  openssl rand -base64 "$1" 2>/dev/null || head -c "$1" /dev/urandom | base64 | tr -d '\n'
}

write_env() {
  local target="$1"
  local template="$2"
  local label="$3"

  if [ -f "$target" ]; then
    printf "${C_YELLOW}%s already exists. Overwrite? [y/N] ${C_RESET}" "$label"
    read -r ans
    if [ "$ans" != "y" ] && [ "$ans" != "Y" ]; then
      printf "${C_YELLOW}  Skipped %s${C_RESET}\n" "$label"
      return 1
    fi
  fi

  if [ ! -f "$template" ]; then
    printf "${C_RED}Error: template not found at %s${C_RESET}\n" "$template" >&2
    return 1
  fi

  # Generate fresh secrets for each file
  local pg_pass jwt_sec enc_key
  pg_pass=$(generate_secret 32)
  jwt_sec=$(generate_secret 48)
  enc_key=$(generate_secret 32)

  cp "$template" "$target"

  # Replace secret placeholders — supports both formats:
  #   Blank values (self-hoster .env.example): POSTGRES_PASSWORD=
  #   CHANGE_ME values (deploy/.env.example):  POSTGRES_PASSWORD=CHANGE_ME
  sed -i "s|^POSTGRES_PASSWORD=$|POSTGRES_PASSWORD=$pg_pass|" "$target"
  sed -i "s|^POSTGRES_PASSWORD=CHANGE_ME$|POSTGRES_PASSWORD=$pg_pass|" "$target"
  sed -i "s|^JWT_SECRET=$|JWT_SECRET=$jwt_sec|" "$target"
  sed -i "s|^JWT_SECRET=CHANGE_ME.*$|JWT_SECRET=$jwt_sec|" "$target"
  sed -i "s|^CONFIG_ENCRYPTION_KEY=$|CONFIG_ENCRYPTION_KEY=$enc_key|" "$target"
  sed -i "s|^CONFIG_ENCRYPTION_KEY=CHANGE_ME.*$|CONFIG_ENCRYPTION_KEY=$enc_key|" "$target"

  printf "${C_GREEN}  Created %s${C_RESET}\n" "$label"
  return 0
}

printf "\n${C_BOLD}${C_CYAN}Clarive Setup${C_RESET}\n\n"

wrote_any=false

# Generate .env (self-hoster / simple deployment)
if write_env "$ROOT_DIR/.env" "$ROOT_DIR/.env.example" ".env (self-hosted — for docker compose up)"; then
  wrote_any=true
fi

# Generate deploy/.env (build-from-source deployment)
if write_env "$DEPLOY_DIR/.env" "$DEPLOY_DIR/.env.example" "deploy/.env (build-from-source — for make deploy)"; then
  wrote_any=true
fi

printf "\n"

if [ "$wrote_any" = true ]; then
  printf "${C_BOLD}${C_GREEN}Setup complete!${C_RESET}\n\n"
  printf "  ${C_BOLD}Self-hosted (Docker Hub image):${C_RESET}\n"
  printf "    ${C_GREEN}docker compose up -d${C_RESET}\n"
  printf "    Open: ${C_CYAN}http://localhost:8080${C_RESET}\n\n"
  printf "  ${C_BOLD}Build from source:${C_RESET}\n"
  printf "    1. Review ${C_CYAN}deploy/.env${C_RESET} and set optional values (OpenAI, OAuth, etc.)\n"
  printf "    2. ${C_GREEN}make deploy${C_RESET}    Build and start production stack\n"
  printf "    3. Open: ${C_CYAN}http://localhost:8080${C_RESET}\n\n"
  printf "  ${C_BOLD}Development:${C_RESET}\n"
  printf "    ${C_GREEN}make dev${C_RESET}          Start dev environment with hot reload\n\n"
else
  printf "${C_YELLOW}No files were created.${C_RESET}\n\n"
fi
