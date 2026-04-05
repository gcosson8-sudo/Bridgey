local HttpService = game:GetService("HttpService")

export type BridgeyError = {
	code: string,
	message: string,
	statusCode: number?,
	details: any?
}

export type ClientConfig = {
	baseUrl: string,
	apiKey: string,
	maxRetries: number?,
	retryDelaySeconds: number?
}

export type Client = typeof(setmetatable({} :: {
	baseUrl: string,
	apiKey: string,
	maxRetries: number,
	retryDelaySeconds: number
}, {}))

local Bridgey = {}
Bridgey.__index = Bridgey

local RETRIABLE_STATUS_CODES = {
	[429] = true,
	[500] = true,
	[502] = true,
	[503] = true,
	[504] = true,
}

local function joinUrl(baseUrl: string, path: string): string
	if string.sub(baseUrl, -1) == "/" then
		return string.sub(baseUrl, 1, -2) .. path
	end

	return baseUrl .. path
end

local function decodeJson(body: string): any?
	local success, decoded = pcall(function()
		return HttpService:JSONDecode(body)
	end)

	if success then
		return decoded
	end

	return nil
end

function Bridgey.new(config: ClientConfig): Client
	assert(config.baseUrl ~= "", "Bridgey baseUrl is required")
	assert(config.apiKey ~= "", "Bridgey apiKey is required")

	return setmetatable({
		baseUrl = config.baseUrl,
		apiKey = config.apiKey,
		maxRetries = config.maxRetries or 2,
		retryDelaySeconds = config.retryDelaySeconds or 0.75,
	}, Bridgey)
end

function Bridgey._request(self: Client, method: string, path: string, body: any?): (boolean, any)
	local attempt = 0

	while true do
		local requestOptions = {
			Url = joinUrl(self.baseUrl, path),
			Method = method,
			Headers = {
				["x-bridgey-api-key"] = self.apiKey,
			},
		}

		if body ~= nil then
			requestOptions.Headers["Content-Type"] = "application/json"
			requestOptions.Body = HttpService:JSONEncode(body)
		end

		local response = HttpService:RequestAsync(requestOptions)
		local decodedBody = if response.Body ~= "" then decodeJson(response.Body) else nil

		if response.Success then
			return true, decodedBody
		end

		local mappedError: BridgeyError = {
			code = if decodedBody and decodedBody.code then decodedBody.code else "http_error",
			message = if decodedBody and decodedBody.message then decodedBody.message else response.StatusMessage,
			statusCode = response.StatusCode,
			details = if decodedBody then decodedBody.details else nil,
		}

		if attempt < self.maxRetries and RETRIABLE_STATUS_CODES[response.StatusCode] then
			task.wait(self.retryDelaySeconds * (2 ^ attempt))
			attempt += 1
		else
			return false, mappedError
		end
	end
end

function Bridgey.createSession(self: Client, ttlMs: number?): (boolean, any)
	local payload: any = if ttlMs then { ttlMs = ttlMs } else {}
	return self:_request("POST", "/sessions", payload)
end

function Bridgey.runActions(self: Client, sessionId: string, actions: { any }, credentialRef: string?): (boolean, any)
	local payload: any = {
		actions = actions,
	}

	if credentialRef then
		payload.credentialRef = credentialRef
	end

	return self:_request("POST", "/sessions/" .. sessionId .. "/actions", payload)
end

function Bridgey.getDocument(self: Client, sessionId: string): (boolean, any)
	return self:_request("GET", "/sessions/" .. sessionId .. "/document", nil)
end

function Bridgey.closeSession(self: Client, sessionId: string): (boolean, any)
	return self:_request("DELETE", "/sessions/" .. sessionId, nil)
end

function Bridgey.fetchOnce(self: Client, actions: { any }, credentialRef: string?): (boolean, any)
	local created, sessionOrError = self:createSession()

	if not created then
		return false, sessionOrError
	end

	local session = sessionOrError
	local succeeded, result = self:runActions(session.sessionId, actions, credentialRef)
	self:closeSession(session.sessionId)

	if not succeeded then
		return false, result
	end

	return true, result
end

return Bridgey
