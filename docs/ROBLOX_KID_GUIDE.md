# Bridgey Roblox Guide

This is the tiny-brain version on purpose.

## What is happening?

- Bridgey is your helper robot.
- Roblox cannot read random websites by itself.
- Bridgey reads the website for Roblox and sends back nice clean data.

## Big picture

1. Make Bridgey live on the internet.
2. Tell Bridgey which websites are allowed.
3. Put the Bridgey Lua file into Roblox.
4. Turn on Roblox web requests.
5. Publish your game.

## Part 1. Make Bridgey live on the internet

You need:

- a domain name like `bridgey.yourdomain.com`
- DNS pointing that domain at the computer running Bridgey
- ports `80` and `443` reaching that computer

Then run:

```bash
cd /Users/administrator/Desktop/Whisky/Bridgey
./scripts/make-public.sh bridgey.yourdomain.com
```

That script does these jobs for you:

- changes Bridgey from local mode to public mode
- makes fresh secret keys
- rebuilds Docker
- restarts Bridgey

Then open:

```text
https://bridgey.yourdomain.com/setup
```

If you want the free-no-account version that uses your public IP as a hostname, try:

```bash
cd /Users/administrator/Desktop/Whisky/Bridgey
./scripts/use-sslip-hostname.sh
```

If your router is not forwarding ports `80` and `443` to this Mac yet, that script will stop and tell you instead of breaking the working setup.

## Part 2. Tell Bridgey which websites are allowed

If you want Bridgey to read `example.com`, run:

```bash
cd /Users/administrator/Desktop/Whisky/Bridgey
./scripts/add-allowlist.sh example.com
```

Or use the `/setup` page and click the Allowlist tab.

## Part 3. Put Bridgey into Roblox Studio

1. Open Roblox Studio.
2. Open your game.
3. Make a `ModuleScript` in `ServerStorage`.
4. Name it `Bridgey`.
5. Open [/Users/administrator/Desktop/Whisky/Bridgey/packages/luau-sdk/src/Bridgey.luau](/Users/administrator/Desktop/Whisky/Bridgey/packages/luau-sdk/src/Bridgey.luau) and copy the whole file into that ModuleScript.

You can also open these ready-made Roblox server scripts:

- [/Users/administrator/Desktop/Whisky/Bridgey/roblox/BridgeyDemo.server.lua](/Users/administrator/Desktop/Whisky/Bridgey/roblox/BridgeyDemo.server.lua)
- [/Users/administrator/Desktop/Whisky/Bridgey/roblox/BridgeyStatefulDemo.server.lua](/Users/administrator/Desktop/Whisky/Bridgey/roblox/BridgeyStatefulDemo.server.lua)

If you want Bridgey to print the exact snippet with your current URL and API key:

```bash
cd /Users/administrator/Desktop/Whisky/Bridgey
./scripts/print-roblox-snippet.sh
```

## Part 4. Make a server script

1. In `ServerScriptService`, add a normal `Script`.
2. Paste this:

```lua
local ServerStorage = game:GetService("ServerStorage")
local Bridgey = require(ServerStorage.Bridgey)

local client = Bridgey.new({
	baseUrl = "https://bridgey.yourdomain.com",
	apiKey = "PUT_YOUR_EXPERIENCE_API_KEY_HERE",
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
```

Important:

- put your Bridgey public URL into `baseUrl`
- put your Bridgey experience API key into `apiKey`
- do not use the admin key in Roblox

## Part 5. Let Roblox talk to the internet

1. In Roblox Studio, open `File`.
2. Open `Game Settings` or `Experience Settings`.
3. Open `Security`.
4. Turn on `Allow HTTP Requests`.
5. Save.

## Part 6. Publish your game

1. Click `File > Publish to Roblox`.
2. Test the game in Studio.
3. If it works, publish again after changes.
4. In the Creator Dashboard, make the experience public.

## Part 7. What you must keep secret

- `BRIDGEY_ADMIN_KEYS` is super secret. Never put it in Roblox.
- `BRIDGEY_API_KEYS` goes only in server-side Roblox scripts.
- website usernames and passwords should stay in Bridgey, not in Roblox.

## If something breaks

- Open `http://localhost/setup` for local mode or `https://your-domain/setup` for public mode.
- Check the health page: `/health`
- Check Docker:

```bash
cd /Users/administrator/Desktop/Whisky/Bridgey
docker compose ps
docker compose logs api --tail=100
docker compose logs caddy --tail=100
```

## The shortest version

```text
Make Bridgey public.
Allow the website.
Paste Bridgey.luau into Roblox.
Turn on Allow HTTP Requests.
Publish the game.
```
