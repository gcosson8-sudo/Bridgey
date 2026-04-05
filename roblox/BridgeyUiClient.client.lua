local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local EVENT_NAME = "BridgeyUiEvent"

local player = Players.LocalPlayer
local event = ReplicatedStorage:WaitForChild(EVENT_NAME)

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "BridgeyUi"
screenGui.ResetOnSpawn = false
screenGui.Parent = player:WaitForChild("PlayerGui")

local frame = Instance.new("Frame")
frame.Name = "Window"
frame.AnchorPoint = Vector2.new(0.5, 0.5)
frame.Position = UDim2.fromScale(0.5, 0.5)
frame.Size = UDim2.fromOffset(680, 420)
frame.BackgroundColor3 = Color3.fromRGB(242, 244, 247)
frame.BorderSizePixel = 0
frame.Parent = screenGui

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 14)
corner.Parent = frame

local stroke = Instance.new("UIStroke")
stroke.Color = Color3.fromRGB(195, 200, 208)
stroke.Parent = frame

local topBar = Instance.new("Frame")
topBar.Name = "TopBar"
topBar.Size = UDim2.new(1, 0, 0, 48)
topBar.BackgroundColor3 = Color3.fromRGB(228, 232, 238)
topBar.BorderSizePixel = 0
topBar.Parent = frame

local topCorner = Instance.new("UICorner")
topCorner.CornerRadius = UDim.new(0, 14)
topCorner.Parent = topBar

local titleLabel = Instance.new("TextLabel")
titleLabel.Name = "Title"
titleLabel.BackgroundTransparency = 1
titleLabel.Position = UDim2.fromOffset(18, 10)
titleLabel.Size = UDim2.new(1, -160, 0, 28)
titleLabel.Font = Enum.Font.GothamSemibold
titleLabel.Text = "Bridgey Browser"
titleLabel.TextColor3 = Color3.fromRGB(34, 39, 46)
titleLabel.TextSize = 20
titleLabel.TextXAlignment = Enum.TextXAlignment.Left
titleLabel.Parent = topBar

local subtitleLabel = Instance.new("TextLabel")
subtitleLabel.Name = "Subtitle"
subtitleLabel.BackgroundTransparency = 1
subtitleLabel.Position = UDim2.fromOffset(18, 28)
subtitleLabel.Size = UDim2.new(1, -160, 0, 16)
subtitleLabel.Font = Enum.Font.Gotham
subtitleLabel.Text = "Waiting for page..."
subtitleLabel.TextColor3 = Color3.fromRGB(92, 102, 115)
subtitleLabel.TextSize = 12
subtitleLabel.TextXAlignment = Enum.TextXAlignment.Left
subtitleLabel.Parent = topBar

local refreshButton = Instance.new("TextButton")
refreshButton.Name = "Refresh"
refreshButton.AnchorPoint = Vector2.new(1, 0.5)
refreshButton.Position = UDim2.new(1, -16, 0.5, 0)
refreshButton.Size = UDim2.fromOffset(110, 30)
refreshButton.AutoButtonColor = true
refreshButton.BackgroundColor3 = Color3.fromRGB(37, 99, 235)
refreshButton.BorderSizePixel = 0
refreshButton.Font = Enum.Font.GothamSemibold
refreshButton.Text = "Refresh"
refreshButton.TextColor3 = Color3.fromRGB(255, 255, 255)
refreshButton.TextSize = 14
refreshButton.Parent = topBar

local refreshCorner = Instance.new("UICorner")
refreshCorner.CornerRadius = UDim.new(0, 8)
refreshCorner.Parent = refreshButton

local scrollingFrame = Instance.new("ScrollingFrame")
scrollingFrame.Name = "Body"
scrollingFrame.Position = UDim2.fromOffset(16, 64)
scrollingFrame.Size = UDim2.new(1, -32, 1, -80)
scrollingFrame.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
scrollingFrame.BorderSizePixel = 0
scrollingFrame.CanvasSize = UDim2.fromOffset(0, 0)
scrollingFrame.ScrollBarThickness = 8
scrollingFrame.Parent = frame

local bodyCorner = Instance.new("UICorner")
bodyCorner.CornerRadius = UDim.new(0, 10)
bodyCorner.Parent = scrollingFrame

local bodyStroke = Instance.new("UIStroke")
bodyStroke.Color = Color3.fromRGB(224, 228, 234)
bodyStroke.Parent = scrollingFrame

local bodyLabel = Instance.new("TextLabel")
bodyLabel.Name = "Text"
bodyLabel.BackgroundTransparency = 1
bodyLabel.Position = UDim2.fromOffset(14, 14)
bodyLabel.Size = UDim2.new(1, -28, 0, 0)
bodyLabel.AutomaticSize = Enum.AutomaticSize.Y
bodyLabel.Font = Enum.Font.Code
bodyLabel.Text = "Press Refresh to load a page."
bodyLabel.TextColor3 = Color3.fromRGB(37, 41, 47)
bodyLabel.TextSize = 16
bodyLabel.TextWrapped = true
bodyLabel.TextXAlignment = Enum.TextXAlignment.Left
bodyLabel.TextYAlignment = Enum.TextYAlignment.Top
bodyLabel.Parent = scrollingFrame

local function updateCanvas()
	scrollingFrame.CanvasSize = UDim2.fromOffset(0, bodyLabel.AbsoluteSize.Y + 28)
end

bodyLabel:GetPropertyChangedSignal("AbsoluteSize"):Connect(updateCanvas)

local function setLoadingState(isLoading)
	refreshButton.Active = not isLoading
	refreshButton.Text = if isLoading then "Loading..." else "Refresh"
	refreshButton.BackgroundColor3 = if isLoading
		then Color3.fromRGB(99, 132, 197)
		else Color3.fromRGB(37, 99, 235)
end

event.OnClientEvent:Connect(function(payload)
	if payload.kind == "status" then
		setLoadingState(true)
		subtitleLabel.Text = payload.message or "Loading page..."
		bodyLabel.Text = ""
		updateCanvas()
		return
	end

	setLoadingState(false)

	if payload.kind == "snapshot" then
		titleLabel.Text = payload.title or "Bridgey Browser"
		subtitleLabel.Text = payload.url or ""
		bodyLabel.Text = payload.bodyText or ""
		updateCanvas()
		return
	end

	if payload.kind == "error" then
		titleLabel.Text = payload.title or "Bridgey error"
		subtitleLabel.Text = "Request failed"
		bodyLabel.Text = payload.message or "Unknown error"
		updateCanvas()
	end
end)

refreshButton.MouseButton1Click:Connect(function()
	event:FireServer("refresh")
end)

event:FireServer("refresh")
