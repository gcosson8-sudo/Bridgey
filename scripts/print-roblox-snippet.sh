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

public_url="${1:-}"
if [[ -z "${public_url}" ]]; then
  public_url="$("${ROOT_DIR}/scripts/show-public-url.sh")"
fi

api_key="$(get_env_value "BRIDGEY_API_KEYS")"

if [[ -z "${api_key}" ]]; then
  echo "BRIDGEY_API_KEYS is missing from .env" >&2
  exit 1
fi

cat <<EOF
ModuleScript source:
  /Users/administrator/Desktop/Whisky/Bridgey/packages/luau-sdk/src/Bridgey.luau

Recommended demo script:
  /Users/administrator/Desktop/Whisky/Bridgey/roblox/BridgeyDemo.server.lua

Paste this into a Script in ServerScriptService:

\`\`\`lua
local ServerStorage = game:GetService("ServerStorage")
local Bridgey = require(ServerStorage.Bridgey)

local client = Bridgey.new({
	baseUrl = "${public_url}",
	apiKey = "${api_key}",
})

local ok, result = client:fetchOnce({
	{
		type = "navigate",
		url = "https://example.com",
	},
	{
		type = "wait_for_selector",
		selector = "body",
	},
})

if ok then
	print(result.snapshot.title)
else
	warn(result.code, result.message)
end
\`\`\`
EOF
