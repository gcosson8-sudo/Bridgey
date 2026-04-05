#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/make-public.sh bridgey.example.com

What it does:
  - backs up .env
  - sets BRIDGEY_SITE_ADDRESS to your public hostname
  - rotates the Bridgey API key and admin key
  - creates BRIDGEY_MASTER_KEY if it is missing or still a placeholder
  - rebuilds and restarts the Docker stack

What it does NOT do:
  - it does not buy a domain
  - it does not edit your DNS provider
  - it does not publish your Roblox experience for you
EOF
}

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
}

get_env_value() {
  local key="$1"
  if [[ ! -f "${ENV_FILE}" ]]; then
    return 0
  fi

  local line
  line="$(grep "^${key}=" "${ENV_FILE}" | tail -n 1 || true)"
  if [[ -z "${line}" ]]; then
    return 0
  fi

  printf '%s\n' "${line#*=}"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp_file

  tmp_file="$(mktemp)"

  if [[ -f "${ENV_FILE}" ]]; then
    awk -v key="${key}" -v value="${value}" '
      BEGIN { replaced = 0 }
      index($0, key "=") == 1 {
        print key "=" value
        replaced = 1
        next
      }
      { print }
      END {
        if (replaced == 0) {
          print key "=" value
        }
      }
    ' "${ENV_FILE}" > "${tmp_file}"
  else
    printf '%s=%s\n' "${key}" "${value}" > "${tmp_file}"
  fi

  mv "${tmp_file}" "${ENV_FILE}"
}

main() {
  if [[ "${1:-}" == "" ]] || [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi

  local public_host="$1"

  require_command openssl
  require_command docker

  if [[ ! -f "${ENV_FILE}" ]]; then
    echo ".env does not exist. Start with .env.example first." >&2
    exit 1
  fi

  cp "${ENV_FILE}" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"

  local master_key
  local api_key
  local admin_key

  master_key="$(get_env_value "BRIDGEY_MASTER_KEY")"
  api_key="$(openssl rand -hex 24)"
  admin_key="$(openssl rand -hex 24)"

  if [[ -z "${master_key}" ]] || [[ "${master_key}" == "replace-with-32-byte-base64-value" ]]; then
    master_key="$(openssl rand -base64 32 | tr -d '\n')"
  fi

  set_env_value "BRIDGEY_MASTER_KEY" "${master_key}"
  set_env_value "BRIDGEY_API_KEYS" "${api_key}"
  set_env_value "BRIDGEY_ADMIN_KEYS" "${admin_key}"
  set_env_value "BRIDGEY_SITE_ADDRESS" "${public_host}"

  (
    cd "${ROOT_DIR}"
    docker compose up -d --build
  )

  cat <<EOF

Bridgey switched to public-host mode.

Host:
  https://${public_host}

Setup page:
  https://${public_host}/setup

New experience API key:
  ${api_key}

New admin key:
  ${admin_key}

Next:
  1. Make sure DNS for ${public_host} points to this machine.
  2. Make sure ports 80 and 443 reach this machine.
  3. Open https://${public_host}/setup
  4. Add your real website domains to the allowlist.
  5. Put the experience API key into your Roblox server script.
EOF
}

main "$@"

