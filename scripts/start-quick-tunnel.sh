#!/bin/bash

set -euo pipefail

exec /opt/homebrew/bin/cloudflared tunnel --no-autoupdate --url http://localhost:80
