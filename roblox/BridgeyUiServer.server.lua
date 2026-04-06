local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")

local EVENT_NAME = "BridgeyUiEvent"
local BRIDGEY_BASE_URL = "REPLACE_WITH_BRIDGEY_URL"
local BRIDGEY_API_KEY = "REPLACE_WITH_EXPERIENCE_API_KEY"
local TARGET_URL = "https://example.com"
local MAX_TEXT_BLOCKS = 12

local event = ReplicatedStorage:FindFirstChild(EVENT_NAME)

if event ~= nil and not event:IsA("RemoteEvent") then
	error(EVENT_NAME .. " must be a RemoteEvent")
end

if event == nil then
	event = Instance.new("RemoteEvent")
	event.Name = EVENT_NAME
	event.Parent = ReplicatedStorage
end

local Bridgey = nil
local bridgeyLoadError = nil

local bridgeyModule = ServerStorage:FindFirstChild("Bridgey")

if bridgeyModule == nil then
	bridgeyLoadError =
		"ServerStorage.Bridgey was not found.\n\n" ..
		"Create a ModuleScript named Bridgey inside ServerStorage and paste Bridgey.luau into it."
else
	local ok, result = pcall(require, bridgeyModule)

	if ok then
		Bridgey = result
	else
		bridgeyLoadError =
			"The Bridgey ModuleScript failed to load.\n\n" ..
			tostring(result)
	end
end

local function sendError(player, message)
	event:FireClient(player, {
		kind = "error",
		title = "Bridgey error",
		message = message,
	})
end

local function ensureConfigured(player)
	if bridgeyLoadError ~= nil then
		sendError(player, bridgeyLoadError)
		return false
	end

	if BRIDGEY_BASE_URL == "REPLACE_WITH_BRIDGEY_URL" then
		sendError(
			player,
			"BridgeyUiServer.server.lua is not configured yet.\n\n" ..
			"Set BRIDGEY_BASE_URL to your Bridgey server URL."
		)
		return false
	end

	if BRIDGEY_API_KEY == "REPLACE_WITH_EXPERIENCE_API_KEY" then
		sendError(
			player,
			"BridgeyUiServer.server.lua is not configured yet.\n\n" ..
			"Set BRIDGEY_API_KEY to your Bridgey experience API key."
		)
		return false
	end

	return true
end

local function buildBodyText(snapshot)
	local lines = {}

	for _, block in ipairs(snapshot.textBlocks or {}) do
		local text = tostring(block.text or ""):gsub("%s+", " "):match("^%s*(.-)%s*$")

		if text ~= "" then
			table.insert(lines, text)
		end

		if #lines >= MAX_TEXT_BLOCKS then
			break
		end
	end

	if #lines == 0 then
		return "No readable text was found on the page."
	end

	return table.concat(lines, "\n\n")
end

local function sendSnapshot(player)
	if not ensureConfigured(player) then
		return
	end

	event:FireClient(player, {
		kind = "status",
		message = "Loading page...",
	})

	local client = Bridgey.new({
		baseUrl = BRIDGEY_BASE_URL,
		apiKey = BRIDGEY_API_KEY,
	})

	local ok, result = client:fetchOnce({
		{
			type = "navigate",
			url = TARGET_URL,
		},
		{
			type = "wait_for_selector",
			selector = "body",
		},
	})

	if ok then
		local snapshot = result.snapshot or {}

		event:FireClient(player, {
			kind = "snapshot",
			title = snapshot.title or "Untitled page",
			url = snapshot.url or TARGET_URL,
			bodyText = buildBodyText(snapshot),
		})
		return
	end

	sendError(
		player,
		string.format("%s: %s", tostring(result.code), tostring(result.message))
	)
end

event.OnServerEvent:Connect(function(player, action)
	if action == "refresh" then
		sendSnapshot(player)
	end
end)
