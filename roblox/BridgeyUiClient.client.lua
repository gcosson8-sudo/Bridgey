local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local EVENT_NAME = "BridgeyUiEvent"

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "BridgeyUi"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

local frame = Instance.new("Frame")
frame.Name = "Window"
frame.AnchorPoint = Vector2.new(0.5, 0.5)
frame.Position = UDim2.fromScale(0.5, 0.5)
frame.Size = UDim2.fromOffset(720, 460)
frame.BackgroundColor3 = Color3.fromRGB(242, 244, 247)
frame.BorderSizePixel = 0
frame.Parent = screenGui

local frameCorner = Instance.new("UICorner")
frameCorner.CornerRadius = UDim.new(0, 14)
frameCorner.Parent = frame

local frameStroke = Instance.new("UIStroke")
frameStroke.Color = Color3.fromRGB(195, 200, 208)
frameStroke.Parent = frame

local topBar = Instance.new("Frame")
topBar.Name = "TopBar"
topBar.Size = UDim2.new(1, 0, 0, 60)
topBar.BackgroundColor3 = Color3.fromRGB(228, 232, 238)
topBar.BorderSizePixel = 0
topBar.Parent = frame

local topCorner = Instance.new("UICorner")
topCorner.CornerRadius = UDim.new(0, 14)
topCorner.Parent = topBar

local topMask = Instance.new("Frame")
topMask.AnchorPoint = Vector2.new(0, 1)
topMask.Position = UDim2.fromScale(0, 1)
topMask.Size = UDim2.new(1, 0, 0, 14)
topMask.BackgroundColor3 = topBar.BackgroundColor3
topMask.BorderSizePixel = 0
topMask.Parent = topBar

local titleLabel = Instance.new("TextLabel")
titleLabel.Name = "Title"
titleLabel.BackgroundTransparency = 1
titleLabel.Position = UDim2.fromOffset(20, 10)
titleLabel.Size = UDim2.new(1, -170, 0, 24)
titleLabel.Font = Enum.Font.BuilderSansBold
titleLabel.Text = "Bridgey Browser"
titleLabel.TextColor3 = Color3.fromRGB(34, 39, 46)
titleLabel.TextSize = 20
titleLabel.TextXAlignment = Enum.TextXAlignment.Left
titleLabel.Parent = topBar

local subtitleLabel = Instance.new("TextLabel")
subtitleLabel.Name = "Subtitle"
subtitleLabel.BackgroundTransparency = 1
subtitleLabel.Position = UDim2.fromOffset(20, 33)
subtitleLabel.Size = UDim2.new(1, -170, 0, 16)
subtitleLabel.Font = Enum.Font.BuilderSans
subtitleLabel.Text = "Waiting for server..."
subtitleLabel.TextColor3 = Color3.fromRGB(92, 102, 115)
subtitleLabel.TextSize = 12
subtitleLabel.TextXAlignment = Enum.TextXAlignment.Left
subtitleLabel.Parent = topBar

local refreshButton = Instance.new("TextButton")
refreshButton.Name = "Refresh"
refreshButton.AnchorPoint = Vector2.new(1, 0.5)
refreshButton.Position = UDim2.new(1, -18, 0.5, 0)
refreshButton.Size = UDim2.fromOffset(110, 32)
refreshButton.AutoButtonColor = true
refreshButton.BackgroundColor3 = Color3.fromRGB(37, 99, 235)
refreshButton.BorderSizePixel = 0
refreshButton.Font = Enum.Font.BuilderSansBold
refreshButton.Text = "Refresh"
refreshButton.TextColor3 = Color3.fromRGB(255, 255, 255)
refreshButton.TextSize = 14
refreshButton.Parent = topBar

local refreshCorner = Instance.new("UICorner")
refreshCorner.CornerRadius = UDim.new(0, 8)
refreshCorner.Parent = refreshButton

local bodyFrame = Instance.new("ScrollingFrame")
bodyFrame.Name = "Body"
bodyFrame.Position = UDim2.fromOffset(16, 76)
bodyFrame.Size = UDim2.new(1, -32, 1, -92)
bodyFrame.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
bodyFrame.BorderSizePixel = 0
bodyFrame.CanvasSize = UDim2.fromOffset(0, 0)
bodyFrame.ScrollBarThickness = 8
bodyFrame.Parent = frame

local bodyCorner = Instance.new("UICorner")
bodyCorner.CornerRadius = UDim.new(0, 10)
bodyCorner.Parent = bodyFrame

local bodyStroke = Instance.new("UIStroke")
bodyStroke.Color = Color3.fromRGB(224, 228, 234)
bodyStroke.Parent = bodyFrame

local contentFrame = Instance.new("Frame")
contentFrame.Name = "Content"
contentFrame.BackgroundTransparency = 1
contentFrame.Position = UDim2.fromOffset(18, 18)
contentFrame.Size = UDim2.new(1, -36, 0, 0)
contentFrame.AutomaticSize = Enum.AutomaticSize.Y
contentFrame.Parent = bodyFrame

local contentLayout = Instance.new("UIListLayout")
contentLayout.Padding = UDim.new(0, 12)
contentLayout.SortOrder = Enum.SortOrder.LayoutOrder
contentLayout.Parent = contentFrame

local urlLabel = Instance.new("TextLabel")
urlLabel.Name = "Url"
urlLabel.LayoutOrder = 1
urlLabel.Size = UDim2.new(1, 0, 0, 36)
urlLabel.BackgroundColor3 = Color3.fromRGB(244, 247, 251)
urlLabel.BorderSizePixel = 0
urlLabel.Font = Enum.Font.BuilderSans
urlLabel.Text = "Waiting for page..."
urlLabel.TextColor3 = Color3.fromRGB(92, 102, 115)
urlLabel.TextSize = 14
urlLabel.TextWrapped = true
urlLabel.TextXAlignment = Enum.TextXAlignment.Left
urlLabel.Parent = contentFrame

local urlCorner = Instance.new("UICorner")
urlCorner.CornerRadius = UDim.new(0, 8)
urlCorner.Parent = urlLabel

local urlPadding = Instance.new("UIPadding")
urlPadding.PaddingLeft = UDim.new(0, 12)
urlPadding.PaddingRight = UDim.new(0, 12)
urlPadding.Parent = urlLabel

local sectionLabel = Instance.new("TextLabel")
sectionLabel.Name = "Section"
sectionLabel.LayoutOrder = 2
sectionLabel.BackgroundTransparency = 1
sectionLabel.Size = UDim2.new(1, 0, 0, 20)
sectionLabel.Font = Enum.Font.BuilderSansBold
sectionLabel.Text = "Page text"
sectionLabel.TextColor3 = Color3.fromRGB(42, 47, 53)
sectionLabel.TextSize = 15
sectionLabel.TextXAlignment = Enum.TextXAlignment.Left
sectionLabel.Parent = contentFrame

local textLabel = Instance.new("TextLabel")
textLabel.Name = "Text"
textLabel.LayoutOrder = 3
textLabel.BackgroundTransparency = 1
textLabel.Size = UDim2.new(1, 0, 0, 0)
textLabel.AutomaticSize = Enum.AutomaticSize.Y
textLabel.Font = Enum.Font.Code
textLabel.Text = "Connecting to Bridgey..."
textLabel.TextColor3 = Color3.fromRGB(37, 41, 47)
textLabel.TextSize = 16
textLabel.TextWrapped = true
textLabel.TextXAlignment = Enum.TextXAlignment.Left
textLabel.TextYAlignment = Enum.TextYAlignment.Top
textLabel.Parent = contentFrame

local function updateCanvas()
	bodyFrame.CanvasSize = UDim2.fromOffset(0, contentFrame.AbsoluteSize.Y + 36)
end

contentFrame:GetPropertyChangedSignal("AbsoluteSize"):Connect(updateCanvas)
textLabel:GetPropertyChangedSignal("AbsoluteSize"):Connect(updateCanvas)

local function setLoadingState(isLoading)
	refreshButton.Active = not isLoading
	refreshButton.Text = if isLoading then "Loading..." else "Refresh"
	refreshButton.BackgroundColor3 = if isLoading
		then Color3.fromRGB(99, 132, 197)
		else Color3.fromRGB(37, 99, 235)
end

local function showError(message: string)
	setLoadingState(false)
	titleLabel.Text = "Bridgey error"
	subtitleLabel.Text = "Request failed"
	urlLabel.Text = "Bridgey request failed"
	textLabel.Text = message
	updateCanvas()
end

local event: RemoteEvent? = nil

local function requestRefresh()
	if event == nil then
		showError(
			"BridgeyUiEvent was not found in ReplicatedStorage.\n\n" ..
			"Make sure the server script is a normal Script inside ServerScriptService."
		)
		return
	end

	event:FireServer("refresh")
end

refreshButton.MouseButton1Click:Connect(requestRefresh)

task.spawn(function()
	local found = ReplicatedStorage:WaitForChild(EVENT_NAME, 15)

	if found == nil then
		showError(
			"BridgeyUiEvent never appeared.\n\n" ..
			"The server script is missing, disabled, in the wrong place, or crashed."
		)
		return
	end

	if not found:IsA("RemoteEvent") then
		showError("BridgeyUiEvent exists, but it is not a RemoteEvent.")
		return
	end

	event = found

	event.OnClientEvent:Connect(function(payload)
		if payload.kind == "status" then
			setLoadingState(true)
			subtitleLabel.Text = payload.message or "Loading page..."
			urlLabel.Text = "Waiting for page..."
			textLabel.Text = ""
			updateCanvas()
			return
		end

		setLoadingState(false)

		if payload.kind == "snapshot" then
			titleLabel.Text = payload.title or "Bridgey Browser"
			subtitleLabel.Text = "Snapshot loaded"
			urlLabel.Text = payload.url or ""
			textLabel.Text = payload.bodyText or ""
			updateCanvas()
			return
		end

		if payload.kind == "error" then
			titleLabel.Text = payload.title or "Bridgey error"
			subtitleLabel.Text = "Request failed"
			urlLabel.Text = "Bridgey request failed"
			textLabel.Text = payload.message or "Unknown error"
			updateCanvas()
		end
	end)

	subtitleLabel.Text = "Asking server for page..."
	textLabel.Text = "Waiting for Bridgey response..."
	updateCanvas()
	requestRefresh()
end)

updateCanvas()
