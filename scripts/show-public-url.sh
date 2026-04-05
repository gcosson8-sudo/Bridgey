#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

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

find_quick_tunnel_url() {
  local url=""

  if command -v tmux >/dev/null 2>&1 && tmux has-session -t bridgey-tunnel 2>/dev/null; then
    url="$(tmux capture-pane -J -p -t bridgey-tunnel -S -200 2>/dev/null | awk '
      {
        for (i = 1; i <= NF; i += 1) {
          if ($i ~ /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/) {
            print $i
            exit
          }
        }
      }
    ')"
  fi

  if [[ -z "${url}" ]] && [[ -f "${ROOT_DIR}/.cloudflared.log" ]]; then
    url="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "${ROOT_DIR}/.cloudflared.log" | tail -n 1 || true)"
  fi

  printf '%s\n' "${url}"
}

site_address="$(get_env_value "BRIDGEY_SITE_ADDRESS")"

if [[ -n "${site_address}" ]] && [[ "${site_address}" != ":80" ]]; then
  printf 'https://%s\n' "${site_address}"
  exit 0
fi

quick_tunnel_url="$(find_quick_tunnel_url)"
if [[ -n "${quick_tunnel_url}" ]]; then
  printf '%s\n' "${quick_tunnel_url}"
  exit 0
fi

printf 'http://localhost\n'
