#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
ALLOW_DOMAIN="${1:-example.com}"

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
}

get_env_value() {
  local key="$1"
  local line

  if [[ ! -f "${ENV_FILE}" ]]; then
    return 0
  fi

  line="$(grep "^${key}=" "${ENV_FILE}" | tail -n 1 || true)"
  if [[ -n "${line}" ]]; then
    printf '%s\n' "${line#*=}"
  fi
}

main() {
  require_command docker
  require_command openssl
  require_command curl

  local master_key
  local api_key
  local admin_key

  master_key="$(get_env_value "BRIDGEY_MASTER_KEY")"
  api_key="$(openssl rand -hex 24)"
  admin_key="$(openssl rand -hex 24)"

  if [[ -z "${master_key}" ]]; then
    master_key="$(openssl rand -base64 32 | tr -d '\n')"
  fi

  cat > "${ENV_FILE}" <<EOF
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgres://bridgey:bridgey@localhost:5432/bridgey
BRIDGEY_MASTER_KEY=${master_key}
BRIDGEY_API_KEYS=${api_key}
BRIDGEY_ADMIN_KEYS=${admin_key}
BRIDGEY_SESSION_TTL_MS=900000
BRIDGEY_MAX_SESSIONS=50
BRIDGEY_SITE_ADDRESS=:80
EOF

  cd "${ROOT_DIR}"
  docker compose up -d --build

  until curl -fsS http://127.0.0.1/health >/dev/null 2>&1; do
    sleep 2
  done

  curl -fsS -X POST http://127.0.0.1/admin/allowlist \
    -H 'content-type: application/json' \
    -H "x-bridgey-admin-key: ${admin_key}" \
    -d "{\"action\":\"add\",\"domain\":\"${ALLOW_DOMAIN}\"}" >/dev/null

  cat <<EOF
Bridgey is running in this Codespace.

Setup:
  http://127.0.0.1/setup

Experience API key:
  ${api_key}

Admin key:
  ${admin_key}

Allowlisted domain:
  ${ALLOW_DOMAIN}
EOF
}

main "$@"
