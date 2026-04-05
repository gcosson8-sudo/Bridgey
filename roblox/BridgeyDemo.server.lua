local ServerStorage = game:GetService("ServerStorage")
local Bridgey = require(ServerStorage.Bridgey)

local BRIDGEY_BASE_URL = "REPLACE_WITH_BRIDGEY_URL"
local BRIDGEY_API_KEY = "REPLACE_WITH_EXPERIENCE_API_KEY"

local client = Bridgey.new({
	baseUrl = BRIDGEY_BASE_URL,
	apiKey = BRIDGEY_API_KEY,
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
	print("Bridgey title:", result.snapshot.title)

	for index, block in ipairs(result.snapshot.textBlocks) do
		print(("Text block %d: %s"):format(index, block.text))
	end
else
	warn("Bridgey error:", result.code, result.message)
end
