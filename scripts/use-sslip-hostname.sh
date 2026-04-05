#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
FORCE=0

usage() {
  cat <<'EOF'
Usage:
  ./scripts/use-sslip-hostname.sh
  ./scripts/use-sslip-hostname.sh --force
  ./scripts/use-sslip-hostname.sh 90.90.254.146.sslip.io

What it does:
  - detects your public IP
  - proposes a free hostname using sslip.io
  - switches BRIDGEY_SITE_ADDRESS to that hostname
  - rebuilds Docker and tests https://HOST/health

What it needs:
  - ports 80 and 443 from the internet must already reach this Mac
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

  if [[ ! -f "${ENV_FILE}" ]]; then
    return 0
  fi

  line="$(grep "^${key}=" "${ENV_FILE}" | tail -n 1 || true)"
  if [[ -n "${line}" ]]; then
    printf '%s\n' "${line#*=}"
  fi
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

if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
  shift
fi

require_command curl
require_command docker
require_command openssl

public_ip="$(curl -fsS https://api.ipify.org)"
local_ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
sslip_host="${1:-${public_ip}.sslip.io}"

if [[ "${FORCE}" -eq 0 ]]; then
  tls_subject="$(
    echo | openssl s_client -connect "${public_ip}:443" -servername "${sslip_host}" 2>/dev/null |
      openssl x509 -noout -subject 2>/dev/null || true
  )"

  if [[ "${tls_subject}" == *"Livebox"* ]] || [[ "${tls_subject}" == *"Orange"* ]]; then
    cat <<EOF
Bridgey was not switched yet.

Reason:
  public port 443 is still answered by your router, not by this Mac.

What I detected:
  ${tls_subject}

What to fix first:
  - forward TCP 80 to ${local_ip}:80
  - forward TCP 443 to ${local_ip}:443

Then rerun:
  ./scripts/use-sslip-hostname.sh

If you want to switch anyway before forwarding is fixed:
  ./scripts/use-sslip-hostname.sh --force ${sslip_host}
EOF
    exit 1
  fi
fi

if [[ -f "${ENV_FILE}" ]]; then
  cp "${ENV_FILE}" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
fi

set_env_value "BRIDGEY_SITE_ADDRESS" "${sslip_host}"

(
  cd "${ROOT_DIR}"
  docker compose up -d --build
)

printf 'Waiting for Bridgey to answer on https://%s/health\n' "${sslip_host}"

for _ in $(seq 1 30); do
  if curl -fsS "https://${sslip_host}/health" >/dev/null 2>&1; then
    cat <<EOF
Bridgey public hostname is now:
  https://${sslip_host}

Setup page:
  https://${sslip_host}/setup
EOF
    exit 0
  fi
  sleep 2
done

cat <<EOF
Bridgey was switched to:
  https://${sslip_host}

But the health check did not succeed yet.
The most likely cause is still missing port forwarding for 80/443.
EOF
exit 1
