#!/usr/bin/env bash
set -euo pipefail

# ── Clarive Release Script ──────────────────────────────────
# Creates a GitHub release with auto-generated notes, builds
# the unified Docker image, and pushes it to Docker Hub.
#
# Usage:
#   bash scripts/release.sh                      # interactive
#   bash scripts/release.sh --version 1.2.0      # non-interactive
#   bash scripts/release.sh --version 1.2.0 -y   # skip confirmation
# ─────────────────────────────────────────────────────────────

DOCKER_IMAGE="pinkrooster/clarive"
VERSION=""
AUTO_CONFIRM=false

# Colors
C_RESET='\033[0m'
C_GREEN='\033[32m'
C_YELLOW='\033[33m'
C_CYAN='\033[36m'
C_RED='\033[31m'
C_BOLD='\033[1m'
C_DIM='\033[2m'

info()  { printf "${C_CYAN}%s${C_RESET}\n" "$1"; }
ok()    { printf "${C_GREEN}%s${C_RESET}\n" "$1"; }
warn()  { printf "${C_YELLOW}%s${C_RESET}\n" "$1"; }
err()   { printf "${C_RED}%s${C_RESET}\n" "$1" >&2; }

confirm() {
  if $AUTO_CONFIRM; then return 0; fi
  printf "${C_BOLD}%s [y/N] ${C_RESET}" "$1"
  read -r ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

# ── Parse arguments ───────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version|-v)
      VERSION="$2"
      shift 2
      ;;
    --yes|-y)
      AUTO_CONFIRM=true
      shift
      ;;
    --help|-h)
      printf "Usage: %s [--version X.Y.Z] [--yes]\n" "$0"
      printf "  --version, -v   Semver version (e.g. 1.2.0)\n"
      printf "  --yes, -y       Skip confirmation prompt\n"
      printf "  --help, -h      Show this help\n"
      exit 0
      ;;
    *)
      err "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# ── Pre-flight checks ──────────────────────────────────────

info "Running pre-flight checks..."

# Must be in repo root
if [[ ! -f "Makefile" ]]; then
  err "Error: Run this script from the repository root."
  exit 1
fi

# Required tools
for cmd in git gh docker make; do
  if ! command -v "$cmd" &>/dev/null; then
    err "Error: $cmd is not installed."
    exit 1
  fi
done

# gh authenticated
if ! gh auth status &>/dev/null; then
  err "Error: GitHub CLI is not authenticated. Run: gh auth login"
  exit 1
fi

# Docker logged in
if ! docker info 2>/dev/null | grep -q "Username"; then
  err "Error: Not logged in to Docker Hub. Run: docker login"
  exit 1
fi

# Must be on main
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" != "main" ]]; then
  err "Error: Must be on the main branch. Currently on: $BRANCH"
  exit 1
fi

# Clean working tree
if [[ -n "$(git status --porcelain)" ]]; then
  err "Error: Working tree is not clean. Commit or stash changes first."
  git status --short
  exit 1
fi

# Up to date with remote
git fetch origin main --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [[ "$LOCAL" != "$REMOTE" ]]; then
  err "Error: Local main is not in sync with origin/main."
  err "  Local:  $LOCAL"
  err "  Remote: $REMOTE"
  err "  Run: git pull --rebase origin main"
  exit 1
fi

ok "Pre-flight checks passed."

# ── Version input ───────────────────────────────────────────

# Show latest tag for reference
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
printf "\n${C_DIM}Latest tag: %s${C_RESET}\n" "$LATEST_TAG"

if [[ -z "$VERSION" ]]; then
  printf "${C_BOLD}Enter version (semver, e.g. 1.0.0): ${C_RESET}"
  read -r VERSION
fi

# Validate semver format
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  err "Error: Invalid semver format. Expected: X.Y.Z (e.g. 1.0.0)"
  exit 1
fi

TAG="v${VERSION}"

# Check tag doesn't already exist
if git rev-parse "$TAG" &>/dev/null; then
  err "Error: Tag $TAG already exists."
  exit 1
fi

# ── Run tests ───────────────────────────────────────────────

printf "\n"
info "Running tests..."
if ! make test; then
  err "Tests failed. Aborting release."
  exit 1
fi
ok "All tests passed."

# ── Confirmation ────────────────────────────────────────────

printf "\n${C_BOLD}Release summary:${C_RESET}\n"
printf "  Tag:          ${C_CYAN}%s${C_RESET}\n" "$TAG"
printf "  GitHub:       ${C_CYAN}gh release create %s${C_RESET}\n" "$TAG"
printf "  Docker:       ${C_CYAN}%s:%s${C_RESET} + ${C_CYAN}%s:latest${C_RESET}\n" "$DOCKER_IMAGE" "$VERSION" "$DOCKER_IMAGE"
printf "\n"

if ! confirm "Proceed with release?"; then
  warn "Cancelled."
  exit 0
fi

# ── Tag and push ────────────────────────────────────────────

printf "\n"
info "Creating tag $TAG..."
git tag -a "$TAG" -m "Release $TAG"
git push origin "$TAG"
ok "Tag $TAG pushed."

# ── GitHub release ──────────────────────────────────────────

info "Creating GitHub release..."
gh release create "$TAG" \
  --title "Clarive $TAG" \
  --generate-notes \
  --latest
ok "GitHub release created."

# ── Docker build and push ──────────────────────────────────

info "Building Docker image..."
docker build --target production -t "${DOCKER_IMAGE}:${VERSION}" -t "${DOCKER_IMAGE}:latest" .
ok "Image built: ${DOCKER_IMAGE}:${VERSION}"

info "Pushing to Docker Hub..."
docker push "${DOCKER_IMAGE}:${VERSION}"
docker push "${DOCKER_IMAGE}:latest"
ok "Pushed ${DOCKER_IMAGE}:${VERSION} and :latest"

# ── Done ────────────────────────────────────────────────────

printf "\n${C_BOLD}${C_GREEN}Release $TAG complete!${C_RESET}\n"
printf "  GitHub:  ${C_CYAN}$(gh browse --no-browser 2>/dev/null || echo "https://github.com")/releases/tag/%s${C_RESET}\n" "$TAG"
printf "  Docker:  ${C_CYAN}https://hub.docker.com/r/%s/tags${C_RESET}\n" "$DOCKER_IMAGE"
printf "\n"
