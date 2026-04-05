#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/add-allowlist.sh example.com

Reads BRIDGEY_ADMIN_KEYS and BRIDGEY_SITE_ADDRESS from .env,
then adds the domain to Bridgey's allowlist.
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
  local line

  line="$(grep "^${key}=" "${ENV_FILE}" | tail -n 1 || true)"
  if [[ -z "${line}" ]]; then
    return 0
  fi

  printf '%s\n' "${line#*=}"
}

main() {
  if [[ "${1:-}" == "" ]] || [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi

  local domain="$1"

  require_command curl

  if [[ ! -f "${ENV_FILE}" ]]; then
    echo ".env does not exist." >&2
    exit 1
  fi

  local admin_key
  local site_address
  local scheme
  local base_url

  admin_key="$(get_env_value "BRIDGEY_ADMIN_KEYS")"
  site_address="$(get_env_value "BRIDGEY_SITE_ADDRESS")"

  if [[ -z "${admin_key}" ]]; then
    echo "BRIDGEY_ADMIN_KEYS is missing from .env" >&2
    exit 1
  fi

  if [[ -z "${site_address}" ]]; then
    echo "BRIDGEY_SITE_ADDRESS is missing from .env" >&2
    exit 1
  fi

  if [[ "${site_address}" == :* ]]; then
    scheme="http"
    base_url="${scheme}://localhost"
  else
    scheme="https"
    base_url="${scheme}://${site_address}"
  fi

  curl -fsS -X POST "${base_url}/admin/allowlist" \
    -H "content-type: application/json" \
    -H "x-bridgey-admin-key: ${admin_key}" \
    -d "{\"action\":\"add\",\"domain\":\"${domain}\"}"

  printf '\nAdded %s to Bridgey allowlist via %s\n' "${domain}" "${base_url}"
}

main "$@"

