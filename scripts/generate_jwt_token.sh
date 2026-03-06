#!/usr/bin/env bash
set -euo pipefail

#
# Generate a valid JWT token for Clarive development.
# Uses the same secret, issuer, audience, and claim URIs as the C# backend.
#
# Usage:
#   ./scripts/generate_jwt_token.sh              # admin token (default)
#   ./scripts/generate_jwt_token.sh admin         # admin token
#   ./scripts/generate_jwt_token.sh editor        # editor token
#   ./scripts/generate_jwt_token.sh viewer        # viewer token
#
# Requires: jq, openssl
#

# ── Backend JWT config (from appsettings.json) ──────────────────────────────

SECRET="clarive-dev-secret-key-minimum-32-chars-long!!"
ISSUER="Clarive"
AUDIENCE="Clarive"
EXPIRY_HOURS=24

# ── Seed user data (from SeedData.cs) ───────────────────────────────────────

TENANT_ID="5222be3f-b477-b0eb-bfb6-8aabacafa6e3"

declare -A USER_IDS=(
  [admin]="3c22107c-0651-f328-9d16-c4eb18aed5c3"
  [editor]="4b61eb21-58a4-e1a2-396a-098f65f0ffce"
  [viewer]="703cb992-20a8-e2ca-fa2c-0f8cf04a4208"
)
declare -A USER_EMAILS=(
  [admin]="admin@clarive.dev"
  [editor]="jane@clarive.dev"
  [viewer]="sam@clarive.dev"
)
declare -A USER_NAMES=(
  [admin]="Admin User"
  [editor]="Jane Editor"
  [viewer]="Sam Viewer"
)

# ── .NET ClaimTypes URIs ────────────────────────────────────────────────────

CLAIM_NAME_ID="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
CLAIM_EMAIL="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
CLAIM_NAME="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
CLAIM_ROLE="http://schemas.microsoft.com/ws/2008/06/identity/claims/role"

# ── Helpers ─────────────────────────────────────────────────────────────────

base64url_encode() {
  openssl base64 -e -A | tr '+/' '-_' | tr -d '='
}

hmac_sha256() {
  openssl dgst -binary -sha256 -hmac "$SECRET"
}

# ── Resolve user role ───────────────────────────────────────────────────────

ROLE="${1:-admin}"

if [[ ! "${USER_IDS[$ROLE]+exists}" ]]; then
  echo "Error: unknown role '$ROLE'. Use: admin, editor, or viewer" >&2
  exit 1
fi

# ── Build header ────────────────────────────────────────────────────────────

HEADER=$(jq -cn '{alg:"HS256",typ:"JWT"}')

# ── Build payload ───────────────────────────────────────────────────────────

NOW=$(date +%s)
EXP=$((NOW + EXPIRY_HOURS * 3600))

PAYLOAD=$(jq -cn \
  --arg name_id "$CLAIM_NAME_ID" \
  --arg user_id "${USER_IDS[$ROLE]}" \
  --arg tenant "$TENANT_ID" \
  --arg email_key "$CLAIM_EMAIL" \
  --arg email "${USER_EMAILS[$ROLE]}" \
  --arg name_key "$CLAIM_NAME" \
  --arg name "${USER_NAMES[$ROLE]}" \
  --arg role_key "$CLAIM_ROLE" \
  --arg role "$ROLE" \
  --argjson exp "$EXP" \
  --arg iss "$ISSUER" \
  --arg aud "$AUDIENCE" \
  '{
    ($name_id): $user_id,
    tenantId: $tenant,
    ($email_key): $email,
    ($name_key): $name,
    ($role_key): $role,
    exp: $exp,
    iss: $iss,
    aud: $aud
  }')

# ── Sign and assemble ──────────────────────────────────────────────────────

HEADER_B64=$(printf '%s' "$HEADER" | base64url_encode)
PAYLOAD_B64=$(printf '%s' "$PAYLOAD" | base64url_encode)
SIGNATURE=$(printf '%s.%s' "$HEADER_B64" "$PAYLOAD_B64" | hmac_sha256 | base64url_encode)

TOKEN="${HEADER_B64}.${PAYLOAD_B64}.${SIGNATURE}"

echo ""
echo "Role:    $ROLE"
echo "User:    ${USER_NAMES[$ROLE]} <${USER_EMAILS[$ROLE]}>"
echo "Expires: $(date -d "@$EXP" '+%Y-%m-%d %H:%M:%S %Z')"
echo ""
echo "$TOKEN"
echo ""
