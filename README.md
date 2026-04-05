# Bridgey

Bridgey lets Roblox experiences browse allowlisted websites through a controlled browser service. Roblox scripts call Bridgey over HTTPS, Bridgey drives a headless Chromium session with Playwright, and the service returns a DOM-first JSON snapshot that Luau can inspect without parsing raw HTML manually.

Bridgey also ships with a browser-based setup console at `/setup` for first-time deployment, allowlist management, credential creation, and Roblox copy-paste snippets.

There is also a very simple Roblox publish guide in [docs/ROBLOX_KID_GUIDE.md](docs/ROBLOX_KID_GUIDE.md).

## Workspace layout

- `apps/api`: Fastify API, auth guards, and admin endpoints.
- `packages/contracts`: Shared TypeScript runtime schemas and API types.
- `packages/browser-worker`: Playwright session manager, DOM normalization, allowlist enforcement, Postgres persistence, and credential vault.
- `packages/luau-sdk`: Luau client wrapper for Roblox scripts.
- `tests`: Unit tests and integration coverage for the browser/session flow.

## Quick start

1. Install Node.js 22+ and npm 10+.
2. Start Postgres with `docker compose up -d postgres` or point `DATABASE_URL` at an existing instance.
3. Copy `.env.example` to `.env` and set `BRIDGEY_MASTER_KEY` to a 32-byte base64 value.
4. Install dependencies with `npm install`.
5. Install Chromium for Playwright with `npx playwright install chromium`.
6. Start the API with `npm run dev`.
7. Open `http://localhost:3000/setup`.

## Docker deployment

The repo now includes a production-oriented Docker stack:

- `Dockerfile`: builds the API service and packages the Playwright runtime.
- `docker-compose.yml`: runs Bridgey API, Postgres, and a Caddy reverse proxy.
- `deploy/Caddyfile`: terminates HTTP or HTTPS and forwards traffic to the API container.

### Deploy on one host

1. Copy `.env.example` to `.env`.
2. Set `BRIDGEY_MASTER_KEY` to a real 32-byte base64 key.
3. Set `BRIDGEY_API_KEYS` and `BRIDGEY_ADMIN_KEYS` to strong random values.
4. Set `BRIDGEY_SITE_ADDRESS`:
   - Use `:80` for local or internal HTTP-only testing.
   - Use `bridgey.example.com` for public HTTPS with automatic certificates.
5. Start the stack with `docker compose up -d --build`.
6. Open `http://localhost/setup` for local mode or `https://your-domain/setup` for public mode.

Helper scripts:

- `./scripts/make-public.sh bridgey.example.com`
- `./scripts/add-allowlist.sh example.com`
- `./scripts/codespaces-init.sh example.com`
- `./scripts/show-public-url.sh`
- `./scripts/print-roblox-snippet.sh`
- `./scripts/use-sslip-hostname.sh`

The reverse proxy listens on ports `80` and `443`. The API itself stays internal on port `3000`.

### Deploy in GitHub Codespaces

If you want Bridgey off your Mac without renting a server, GitHub Codespaces can host the Docker stack for light use.

1. Push this repo to a private GitHub repository.
2. Create a Codespace from the repo.
3. In the Codespace terminal, run `./scripts/codespaces-init.sh example.com`.
4. Make port `80` public in the Codespace.
5. Use the public forwarded port URL as your Roblox `baseUrl`.

This route is convenient, but it is not production-grade:

- Codespaces can stop after idle time.
- Usage counts against GitHub Codespaces quota.
- The public URL is GitHub-managed rather than your own domain.

### First boot tasks

After the stack is up, allowlist at least one domain before Roblox requests hit the service:

```bash
curl -X POST https://bridgey.example.com/admin/allowlist \
  -H 'content-type: application/json' \
  -H 'x-bridgey-admin-key: bridgey-admin-key' \
  -d '{"action":"add","domain":"example.com"}'
```

If you use `BRIDGEY_SITE_ADDRESS=:80`, call the same endpoint over `http://`.

You can also do the same work in the setup console:

- open `/setup`
- paste the admin key
- add your first allowlisted domain
- create any credential references you need for login flows

### Deployment limits

- This stack is single-instance by design. Do not scale the `api` service horizontally yet because live browser sessions are stored in process memory.
- If you put Bridgey behind another load balancer, route all traffic to one API instance.

## Core endpoints

- `POST /sessions`
- `POST /sessions/:id/actions`
- `GET /sessions/:id/document`
- `DELETE /sessions/:id`
- `POST /admin/credentials`
- `POST /admin/allowlist`

All session routes require `x-bridgey-api-key`. Admin routes require `x-bridgey-admin-key`.

## Example action batch

```json
{
  "actions": [
    {
      "type": "navigate",
      "url": "https://example.com/login"
    },
    {
      "type": "type",
      "selector": "#username",
      "credentialField": "username"
    },
    {
      "type": "type",
      "selector": "#password",
      "credentialField": "password"
    },
    {
      "type": "submit",
      "selector": "#login-form"
    },
    {
      "type": "wait_for_selector",
      "selector": "#dashboard"
    }
  ],
  "credentialRef": "86f2ab74-36a7-4b65-b7f7-8627554aab48"
}
```

## Roblox usage

`packages/luau-sdk/src/Bridgey.luau` exposes:

- `Bridgey.new`
- `client:createSession`
- `client:runActions`
- `client:getDocument`
- `client:closeSession`
- `client:fetchOnce`

`fetchOnce` wraps the explicit create / run / close lifecycle for single-request flows.

Ready-made Roblox examples:

- `roblox/BridgeyDemo.server.lua`
- `roblox/BridgeyStatefulDemo.server.lua`
- `roblox/BridgeyUiServer.server.lua`
- `roblox/BridgeyUiClient.client.lua`

To print a ready-to-paste Roblox server script using your current Bridgey URL and API key:

```bash
./scripts/print-roblox-snippet.sh
```

## Test strategy

- `tests/unit`: allowlist, contract, and vault coverage.
- `tests/integration`: Playwright + Postgres workflow against local fixture pages.

Integration tests are opt-in. Run them with:

```bash
RUN_INTEGRATION=1 INTEGRATION_DATABASE_URL=postgres://bridgey:bridgey@localhost:5432/bridgey npm test
```
