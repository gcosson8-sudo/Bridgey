local ServerStorage = game:GetService("ServerStorage")
local Bridgey = require(ServerStorage.Bridgey)

local BRIDGEY_BASE_URL = "REPLACE_WITH_BRIDGEY_URL"
local BRIDGEY_API_KEY = "REPLACE_WITH_EXPERIENCE_API_KEY"

local client = Bridgey.new({
	baseUrl = BRIDGEY_BASE_URL,
	apiKey = BRIDGEY_API_KEY,
})

local created, sessionOrError = client:createSession()

if not created then
	warn("Bridgey createSession failed:", sessionOrError.code, sessionOrError.message)
	return
end

local sessionId = sessionOrError.sessionId
local ran, actionResult = client:runActions(sessionId, {
	{
		type = "navigate",
		url = "https://example.com",
	},
	{
		type = "wait_for_selector",
		selector = "body",
	},
})

if not ran then
	client:closeSession(sessionId)
	warn("Bridgey runActions failed:", actionResult.code, actionResult.message)
	return
end

print("Stateful title:", actionResult.snapshot.title)

local gotDocument, documentOrError = client:getDocument(sessionId)
if gotDocument then
	print("Current URL:", documentOrError.snapshot.url)
else
	warn("Bridgey getDocument failed:", documentOrError.code, documentOrError.message)
end

local closed, closedResult = client:closeSession(sessionId)
if not closed then
	warn("Bridgey closeSession failed:", closedResult.code, closedResult.message)
end
