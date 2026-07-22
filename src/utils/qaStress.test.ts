import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeErrorAndCode } from "./analyzerEngine";

type Severity = "Low" | "Medium" | "High" | "Critical";

type ExpectedCase = {
  shouldMatch: boolean;
  expectedRuleId: string;
  expectedDiagnosis: string;
  expectedRootCause: string;
  expectedSeverity: Severity;
  expectedConfidenceRange: [number, number];
  expectedFixes: string[];
};

type Scenario = {
  id: string;
  category: string;
  sourceType: "ServerScript" | "LocalScript" | "ModuleScript" | "Plugin" | "Console";
  consoleError: string;
  code: string;
  expected: ExpectedCase;
};

type Topic = {
  category: string;
  sourceType: Scenario["sourceType"];
  scriptPath: string;
  logTemplate: string;
  codeTemplate: string;
  expected: ExpectedCase;
};

type CaseResult = {
  id: string;
  category: string;
  sourceType: Scenario["sourceType"];
  failedChecks: string[];
  expected: ExpectedCase;
  actual: {
    matched: boolean;
    ruleId?: string;
    title?: string;
    rootCause?: string;
    severity?: Severity;
    confidence?: number;
    fix?: string;
  };
};

const PLAYERS = ["Builderman", "NoobMaster", "ScripterDev", "QAUser", "LatencyFox"];

const BASE_TOPICS: Topic[] = [
  {
    category: "nil-index",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.Inventory",
    logTemplate: "{path}:{line}: attempt to index nil with 'Value'",
    codeTemplate:
      "local player = game.Players:FindFirstChild(\"{player}\")\nlocal stats = player and player:FindFirstChild(\"leaderstats\")\nprint(stats.Coins.Value)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-index-nil",
      expectedDiagnosis: "Nil Lifetime Breakdown",
      expectedRootCause: "Value is nil at runtime",
      expectedSeverity: "High",
      expectedConfidenceRange: [60, 99],
      expectedFixes: ["nil check", "WaitForChild", "guard"],
    },
  },
  {
    category: "call-nil",
    sourceType: "ModuleScript",
    scriptPath: "ReplicatedStorage.Modules.Profile",
    logTemplate: "{path}:{line}: attempt to call a nil value",
    codeTemplate:
      "local Profile = {}\nfunction Profile.Init() end\nlocal mod = require(script.Parent.Dependency)\nmod.Start()",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-call-nil",
      expectedDiagnosis: "Nil Lifetime Breakdown",
      expectedRootCause: "nil at call site",
      expectedSeverity: "High",
      expectedConfidenceRange: [60, 99],
      expectedFixes: ["guard", "module", "assert"],
    },
  },
  {
    category: "concat-nil",
    sourceType: "LocalScript",
    scriptPath: "StarterPlayerScripts.HUD",
    logTemplate: "{path}:{line}: attempt to concatenate nil with string",
    codeTemplate:
      "local player = game.Players.LocalPlayer\nlocal rank = player:GetAttribute(\"Rank\")\nlocal label = \"Rank: \" .. rank",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-concat-nil",
      expectedDiagnosis: "Nil Lifetime Breakdown",
      expectedRootCause: "nil concatenation",
      expectedSeverity: "High",
      expectedConfidenceRange: [60, 99],
      expectedFixes: ["tostring", "default", "guard"],
    },
  },
  {
    category: "arithmetic-nil",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.Economy",
    logTemplate: "{path}:{line}: attempt to perform arithmetic on nil",
    codeTemplate:
      "local dataStore = game:GetService(\"DataStoreService\"):GetDataStore(\"Coins\")\nlocal coins = dataStore:GetAsync(\"{player}\")\nlocal newTotal = coins + 10",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-arithmetic-nil",
      expectedDiagnosis: "Nil Lifetime Breakdown",
      expectedRootCause: "nil arithmetic",
      expectedSeverity: "High",
      expectedConfidenceRange: [55, 99],
      expectedFixes: ["default", "pcall", "retry"],
    },
  },
  {
    category: "compare-nil",
    sourceType: "ModuleScript",
    scriptPath: "ReplicatedStorage.Modules.State",
    logTemplate: "{path}:{line}: attempt to compare nil and number",
    codeTemplate:
      "local stamina = nil\nif stamina > 0 then\n  print(\"run\")\nend",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-compare-nil",
      expectedDiagnosis: "Nil Lifetime Breakdown",
      expectedRootCause: "nil comparison",
      expectedSeverity: "High",
      expectedConfidenceRange: [50, 99],
      expectedFixes: ["guard", "default value"],
    },
  },
  {
    category: "invalid-argument",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.TeleportController",
    logTemplate: "{path}:{line}: invalid argument #1 to 'TeleportAsync' (Instance expected, got string)",
    codeTemplate:
      "local TeleportService = game:GetService(\"TeleportService\")\nTeleportService:TeleportAsync(\"123456\", game.Players:GetPlayers())",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-invalid-argument",
      expectedDiagnosis: "Generic Runtime Context",
      expectedRootCause: "invalid argument",
      expectedSeverity: "Medium",
      expectedConfidenceRange: [30, 99],
      expectedFixes: ["validate", "type"],
    },
  },
  {
    category: "invalid-member",
    sourceType: "LocalScript",
    scriptPath: "StarterGui.MenuController",
    logTemplate: "{path}:{line}: 'TextColour3' is not a valid member of TextLabel",
    codeTemplate:
      "local label = script.Parent.Title\nlabel.TextColour3 = Color3.new(1, 0, 0)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-invalid-member",
      expectedDiagnosis: "Generic Runtime Context",
      expectedRootCause: "invalid member",
      expectedSeverity: "Medium",
      expectedConfidenceRange: [30, 99],
      expectedFixes: ["property", "spell", "member"],
    },
  },
  {
    category: "invalid-type",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.SpawnService",
    logTemplate: "{path}:{line}: Unable to cast string to Vector3",
    codeTemplate:
      "local part = Instance.new(\"Part\")\npart.Position = \"1,2,3\"",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-invalid-type",
      expectedDiagnosis: "Generic Runtime Context",
      expectedRootCause: "type mismatch",
      expectedSeverity: "Medium",
      expectedConfidenceRange: [30, 99],
      expectedFixes: ["Vector3", "tonumber", "type"],
    },
  },
  {
    category: "datastore-throttle",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.DataSaveLoop",
    logTemplate: "{path}:{line}: DataStore request was throttled. Try sending fewer requests.",
    codeTemplate:
      "local DataStoreService = game:GetService(\"DataStoreService\")\nlocal ds = DataStoreService:GetDataStore(\"Inv\")\nfor i = 1, 80 do\n  ds:SetAsync(tostring(i), i)\nend",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-datastore",
      expectedDiagnosis: "DataStore Reliability",
      expectedRootCause: "missing resiliency",
      expectedSeverity: "Critical",
      expectedConfidenceRange: [65, 99],
      expectedFixes: ["pcall", "retry", "budget"],
    },
  },
  {
    category: "remote-side-mismatch",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.RemoteHub",
    logTemplate: "{path}:{line}: attempt to call nil while invoking RemoteEvent",
    codeTemplate:
      "local event = game.ReplicatedStorage:WaitForChild(\"Ping\")\nevent:FireServer(\"hello\")",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-remote",
      expectedDiagnosis: "Remote Boundary Validation",
      expectedRootCause: "call direction mismatch",
      expectedSeverity: "High",
      expectedConfidenceRange: [55, 99],
      expectedFixes: ["FireClient", "server", "schema"],
    },
  },
  {
    category: "remotefunction-timeout",
    sourceType: "LocalScript",
    scriptPath: "StarterPlayerScripts.RpcClient",
    logTemplate: "{path}:{line}: RemoteFunction invocation queue exhausted for InvokeServer",
    codeTemplate:
      "local rf = game.ReplicatedStorage:WaitForChild(\"Compute\")\nlocal result = rf:InvokeServer({ id = \"{player}\" })\nprint(result.value)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-remote",
      expectedDiagnosis: "Remote Boundary Validation",
      expectedRootCause: "remote callback contract",
      expectedSeverity: "High",
      expectedConfidenceRange: [45, 99],
      expectedFixes: ["InvokeServer", "pcall", "timeout"],
    },
  },
  {
    category: "tween-invalid-property",
    sourceType: "LocalScript",
    scriptPath: "StarterPlayerScripts.TweenController",
    logTemplate: "{path}:{line}: Property Size cannot be tweened due to type mismatch",
    codeTemplate:
      "local TweenService = game:GetService(\"TweenService\")\nlocal part = workspace.Baseplate\nlocal info = TweenInfo.new(1)\nTweenService:Create(part, info, { Size = \"big\" }):Play()",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-tween",
      expectedDiagnosis: "Tween Property Compatibility",
      expectedRootCause: "invalid tween property/value",
      expectedSeverity: "High",
      expectedConfidenceRange: [50, 99],
      expectedFixes: ["TweenService", "goal", "type"],
    },
  },
  {
    category: "character-race",
    sourceType: "LocalScript",
    scriptPath: "StarterPlayerScripts.CharacterFx",
    logTemplate: "{path}:{line}: attempt to index nil with 'HumanoidRootPart'",
    codeTemplate:
      "local plr = game.Players.LocalPlayer\nlocal hrp = plr.Character.HumanoidRootPart\nprint(hrp.Position)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-index-nil",
      expectedDiagnosis: "Character Lifecycle Guarding",
      expectedRootCause: "before spawn lifecycle",
      expectedSeverity: "High",
      expectedConfidenceRange: [55, 99],
      expectedFixes: ["CharacterAdded", "WaitForChild"],
    },
  },
  {
    category: "animation",
    sourceType: "LocalScript",
    scriptPath: "StarterCharacterScripts.AnimDriver",
    logTemplate: "{path}:{line}: attempt to index nil with 'LoadAnimation'",
    codeTemplate:
      "local char = game.Players.LocalPlayer.Character\nlocal hum = char and char:FindFirstChildOfClass(\"Humanoid\")\nlocal track = hum:LoadAnimation(script.Walk)\ntrack:Play()",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-index-nil",
      expectedDiagnosis: "Character Lifecycle Guarding",
      expectedRootCause: "humanoid/animator not ready",
      expectedSeverity: "High",
      expectedConfidenceRange: [50, 99],
      expectedFixes: ["CharacterAdded", "WaitForChild", "Animator"],
    },
  },
  {
    category: "physics",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.ProjectilePhysics",
    logTemplate: "{path}:{line}: attempt to index nil with 'AssemblyLinearVelocity'",
    codeTemplate:
      "local projectile = workspace:FindFirstChild(\"Rocket\")\nprojectile.AssemblyLinearVelocity = Vector3.new(0, 250, 0)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-index-nil",
      expectedDiagnosis: "Nil Lifetime Breakdown",
      expectedRootCause: "projectile missing at runtime",
      expectedSeverity: "High",
      expectedConfidenceRange: [50, 99],
      expectedFixes: ["FindFirstChild", "guard"],
    },
  },
  {
    category: "wait-infinite-yield",
    sourceType: "ModuleScript",
    scriptPath: "ReplicatedStorage.Modules.Loader",
    logTemplate: "{path}:{line}: Infinite yield possible on 'Workspace:WaitForChild(\"Ghost\")'",
    codeTemplate:
      "local ghost = workspace:WaitForChild(\"Ghost\")\nprint(ghost.Name)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-wait",
      expectedDiagnosis: "Replication Timing and Wait Strategy",
      expectedRootCause: "replication order",
      expectedSeverity: "Medium",
      expectedConfidenceRange: [40, 99],
      expectedFixes: ["timeout", "fallback", "FindFirstChild"],
    },
  },
  {
    category: "httpservice-json",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.Webhook",
    logTemplate: "{path}:{line}: HttpService:JSONDecode failed: Expected value",
    codeTemplate:
      "local HttpService = game:GetService(\"HttpService\")\nlocal payload = \"{ bad json }\"\nlocal data = HttpService:JSONDecode(payload)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-http",
      expectedDiagnosis: "Generic Runtime Context",
      expectedRootCause: "serialization/json failure",
      expectedSeverity: "Medium",
      expectedConfidenceRange: [25, 99],
      expectedFixes: ["pcall", "validate json", "schema"],
    },
  },
  {
    category: "memorystore",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.Matchmaker",
    logTemplate: "{path}:{line}: MemoryStoreService queue request failed with timeout",
    codeTemplate:
      "local mss = game:GetService(\"MemoryStoreService\")\nlocal q = mss:GetQueue(\"match\", 60)\nq:AddAsync({ player = \"{player}\" }, 30)",
    expected: {
      shouldMatch: false,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "MemoryStore timeout",
      expectedRootCause: "service timeout",
      expectedSeverity: "High",
      expectedConfidenceRange: [60, 90],
      expectedFixes: ["retry", "backoff"],
    },
  },
  {
    category: "messagingservice",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.CrossServerBus",
    logTemplate: "{path}:{line}: MessagingService publish failed: HTTP 429",
    codeTemplate:
      "local MessagingService = game:GetService(\"MessagingService\")\nMessagingService:PublishAsync(\"topic\", { x = 1 })",
    expected: {
      shouldMatch: false,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "MessagingService throttle",
      expectedRootCause: "quota exceeded",
      expectedSeverity: "High",
      expectedConfidenceRange: [60, 90],
      expectedFixes: ["backoff", "throttle"],
    },
  },
  {
    category: "pathfinding",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.NPC.Path",
    logTemplate: "{path}:{line}: PathfindingService:ComputeAsync failed, no path found",
    codeTemplate:
      "local pfs = game:GetService(\"PathfindingService\")\nlocal path = pfs:CreatePath()\npath:ComputeAsync(Vector3.new(0,0,0), Vector3.new(999,999,999))",
    expected: {
      shouldMatch: false,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "Pathfinding failure",
      expectedRootCause: "navigation blocked",
      expectedSeverity: "Medium",
      expectedConfidenceRange: [45, 90],
      expectedFixes: ["fallback", "path status"],
    },
  },
  {
    category: "raycast",
    sourceType: "LocalScript",
    scriptPath: "StarterPlayerScripts.RayGun",
    logTemplate: "{path}:{line}: bad argument #2 to 'Raycast' (RaycastParams expected, got nil)",
    codeTemplate:
      "local result = workspace:Raycast(Vector3.zero, Vector3.new(0, -100, 0), nil)\nprint(result)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-invalid-argument",
      expectedDiagnosis: "Generic Runtime Context",
      expectedRootCause: "bad argument",
      expectedSeverity: "Medium",
      expectedConfidenceRange: [30, 99],
      expectedFixes: ["RaycastParams", "validate"],
    },
  },
  {
    category: "constraints",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.VehicleRig",
    logTemplate: "{path}:{line}: HingeConstraint requires Attachment0 and Attachment1",
    codeTemplate:
      "local hinge = Instance.new(\"HingeConstraint\")\nhinge.Parent = workspace.Car\nhinge.Enabled = true",
    expected: {
      shouldMatch: false,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "Constraint setup invalid",
      expectedRootCause: "missing attachments",
      expectedSeverity: "Medium",
      expectedConfidenceRange: [35, 85],
      expectedFixes: ["Attachment0", "Attachment1"],
    },
  },
  {
    category: "camera",
    sourceType: "LocalScript",
    scriptPath: "StarterPlayerScripts.CameraShake",
    logTemplate: "{path}:{line}: CurrentCamera is nil",
    codeTemplate:
      "local cam = workspace.CurrentCamera\ncam.CFrame = cam.CFrame * CFrame.new(0, 0, -1)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-index-nil",
      expectedDiagnosis: "Nil Lifetime Breakdown",
      expectedRootCause: "camera unavailable",
      expectedSeverity: "High",
      expectedConfidenceRange: [50, 99],
      expectedFixes: ["CurrentCamera", "wait", "guard"],
    },
  },
  {
    category: "marketplace",
    sourceType: "LocalScript",
    scriptPath: "StarterPlayerScripts.Purchases",
    logTemplate: "{path}:{line}: MarketplaceService:PromptProductPurchase can only be called from a LocalScript",
    codeTemplate:
      "local MarketplaceService = game:GetService(\"MarketplaceService\")\nMarketplaceService:PromptProductPurchase(game.Players.LocalPlayer, 12345)",
    expected: {
      shouldMatch: false,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "Marketplace side restriction",
      expectedRootCause: "wrong execution context",
      expectedSeverity: "High",
      expectedConfidenceRange: [50, 90],
      expectedFixes: ["LocalScript", "client"],
    },
  },
  {
    category: "teleport",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.Teleports",
    logTemplate: "{path}:{line}: TeleportService:TeleportAsync failed with error 773",
    codeTemplate:
      "local TeleportService = game:GetService(\"TeleportService\")\nTeleportService:TeleportAsync(123456, game.Players:GetPlayers())",
    expected: {
      shouldMatch: false,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "Teleport failed",
      expectedRootCause: "join restriction",
      expectedSeverity: "Medium",
      expectedConfidenceRange: [40, 85],
      expectedFixes: ["retry", "teleport options"],
    },
  },
  {
    category: "coroutine-dead",
    sourceType: "ModuleScript",
    scriptPath: "ReplicatedStorage.Modules.Tasks",
    logTemplate: "{path}:{line}: cannot resume dead coroutine",
    codeTemplate:
      "local co = coroutine.create(function() end)\ncoroutine.resume(co)\ncoroutine.resume(co)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "Generic Runtime Context",
      expectedRootCause: "dead coroutine",
      expectedSeverity: "Medium",
      expectedConfidenceRange: [25, 90],
      expectedFixes: ["status", "recreate coroutine"],
    },
  },
  {
    category: "task-library-race",
    sourceType: "LocalScript",
    scriptPath: "StarterPlayerScripts.Tasks",
    logTemplate: "{path}:{line}: attempt to index nil with 'Parent'",
    codeTemplate:
      "local gui = script.Parent\ntask.defer(function()\n  print(gui.Parent.Name)\nend)\ngui:Destroy()",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-index-nil",
      expectedDiagnosis: "Nil Lifetime Breakdown",
      expectedRootCause: "deferred race",
      expectedSeverity: "High",
      expectedConfidenceRange: [55, 99],
      expectedFixes: ["guard", "alive check"],
    },
  },
  {
    category: "bindables",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.BindableBridge",
    logTemplate: "{path}:{line}: BindableFunction invocation failed: callback returned nil",
    codeTemplate:
      "local bf = Instance.new(\"BindableFunction\")\nbf.OnInvoke = function() return nil end\nlocal data = bf:Invoke()\nprint(data.x)",
    expected: {
      shouldMatch: false,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "bindable contract mismatch",
      expectedRootCause: "callback contract",
      expectedSeverity: "Medium",
      expectedConfidenceRange: [40, 80],
      expectedFixes: ["contract", "nil guard"],
    },
  },
  {
    category: "stack-overflow",
    sourceType: "ModuleScript",
    scriptPath: "ReplicatedStorage.Modules.TreeWalk",
    logTemplate: "{path}:{line}: stack overflow",
    codeTemplate:
      "local function walk(node)\n  return walk(node)\nend\nwalk({})",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "Generic Runtime Context",
      expectedRootCause: "unbounded recursion",
      expectedSeverity: "High",
      expectedConfidenceRange: [25, 90],
      expectedFixes: ["base case", "depth limit"],
    },
  },
  {
    category: "plugin",
    sourceType: "Plugin",
    scriptPath: "Plugin.Main",
    logTemplate: "{path}:{line}: attempt to index nil with 'CreateDockWidgetPluginGui'",
    codeTemplate:
      "local toolbar = plugin:CreateToolbar(\"QA\")\nlocal widgetInfo = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float, true, false, 300, 200, 150, 150)\nlocal gui = plugin:CreateDockWidgetPluginGui(\"Panel\", widgetInfo)\nprint(gui.Title.Text)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-index-nil",
      expectedDiagnosis: "Nil Lifetime Breakdown",
      expectedRootCause: "plugin gui assumption",
      expectedSeverity: "High",
      expectedConfidenceRange: [55, 99],
      expectedFixes: ["guard", "plugin state"],
    },
  },
  {
    category: "streaming-enabled",
    sourceType: "LocalScript",
    scriptPath: "StarterPlayerScripts.StreamingProbe",
    logTemplate: "{path}:{line}: attempt to index nil with 'PrimaryPart'",
    codeTemplate:
      "local boss = workspace:FindFirstChild(\"Boss\")\nprint(boss.PrimaryPart.Position)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-index-nil",
      expectedDiagnosis: "Replication Timing and Wait Strategy",
      expectedRootCause: "streaming replication delay",
      expectedSeverity: "High",
      expectedConfidenceRange: [55, 99],
      expectedFixes: ["WaitForChild", "timeout"],
    },
  },
  {
    category: "attributes",
    sourceType: "LocalScript",
    scriptPath: "StarterGui.Attributes",
    logTemplate: "{path}:{line}: bad argument #1 to 'SetAttribute' (string expected, got nil)",
    codeTemplate:
      "local frame = script.Parent\nlocal key = nil\nframe:SetAttribute(key, true)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-invalid-argument",
      expectedDiagnosis: "Generic Runtime Context",
      expectedRootCause: "attribute key invalid",
      expectedSeverity: "Medium",
      expectedConfidenceRange: [30, 99],
      expectedFixes: ["validate", "attribute"],
    },
  },
  {
    category: "collectionservice",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.TagSystem",
    logTemplate: "{path}:{line}: CollectionService tag query returned stale instance",
    codeTemplate:
      "local CollectionService = game:GetService(\"CollectionService\")\nfor _, inst in ipairs(CollectionService:GetTagged(\"Enemy\")) do\n  print(inst.PrimaryPart.Position)\nend",
    expected: {
      shouldMatch: false,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "stale tagged instance",
      expectedRootCause: "destroyed instance in tag set",
      expectedSeverity: "Medium",
      expectedConfidenceRange: [40, 85],
      expectedFixes: ["IsDescendantOf", "guard"],
    },
  },
  {
    category: "modules-circular-require",
    sourceType: "ModuleScript",
    scriptPath: "ReplicatedStorage.Modules.A",
    logTemplate: "{path}:{line}: Requested module was required recursively",
    codeTemplate:
      "local B = require(script.Parent.B)\nreturn { run = function() B.run() end }",
    expected: {
      shouldMatch: false,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "circular dependency",
      expectedRootCause: "recursive require chain",
      expectedSeverity: "High",
      expectedConfidenceRange: [50, 90],
      expectedFixes: ["break cycle", "dependency inversion"],
    },
  },
  {
    category: "serialization-jsonencode",
    sourceType: "ServerScript",
    scriptPath: "ServerScriptService.Serializer",
    logTemplate: "{path}:{line}: HttpService:JSONEncode cannot encode mixed table keys",
    codeTemplate:
      "local HttpService = game:GetService(\"HttpService\")\nlocal payload = { [\"a\"] = 1, [2] = 3 }\nlocal encoded = HttpService:JSONEncode(payload)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-http",
      expectedDiagnosis: "Generic Runtime Context",
      expectedRootCause: "serialization incompatible",
      expectedSeverity: "Medium",
      expectedConfidenceRange: [25, 99],
      expectedFixes: ["normalize table", "json"],
    },
  },
  {
    category: "ansi-colored-log",
    sourceType: "Console",
    scriptPath: "ServerScriptService.Colored",
    logTemplate: "\u001b[31m{path}:{line}: attempt to index nil with 'Name'\u001b[0m",
    codeTemplate:
      "local target = workspace:FindFirstChild(\"Ghost\")\nprint(target.Name)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-index-nil",
      expectedDiagnosis: "Nil Lifetime Breakdown",
      expectedRootCause: "nil name access",
      expectedSeverity: "High",
      expectedConfidenceRange: [45, 99],
      expectedFixes: ["guard", "FindFirstChild"],
    },
  },
  {
    category: "unicode-emoji-log",
    sourceType: "Console",
    scriptPath: "StarterPlayerScripts.Unicode",
    logTemplate: "{path}:{line}: attempt to call a nil value 🔥 玩家",
    codeTemplate:
      "local fn = nil\nfn()",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-call-nil",
      expectedDiagnosis: "Nil Lifetime Breakdown",
      expectedRootCause: "nil function call",
      expectedSeverity: "High",
      expectedConfidenceRange: [40, 99],
      expectedFixes: ["guard", "function exists"],
    },
  },
  {
    category: "malformed-log",
    sourceType: "Console",
    scriptPath: "Unknown",
    logTemplate: ":::::::: ??? ### random corrupted console output {line}",
    codeTemplate:
      "local x = 1\nlocal y = 2\nprint(x + y)",
    expected: {
      shouldMatch: false,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "unsupported malformed log",
      expectedRootCause: "cannot parse message",
      expectedSeverity: "Low",
      expectedConfidenceRange: [0, 40],
      expectedFixes: ["clean log", "reproduce"],
    },
  },
  {
    category: "mixed-errors",
    sourceType: "Console",
    scriptPath: "ServerScriptService.Mixed",
    logTemplate:
      "{path}:{line}: attempt to index nil with 'Value'\n{path}:{line}: DataStore request was throttled\n{path}:{line}: RemoteEvent invocation discarded",
    codeTemplate:
      "local ds = game:GetService(\"DataStoreService\"):GetDataStore(\"X\")\nlocal v = nil\nprint(v.Value)\nds:SetAsync(\"k\", 1)",
    expected: {
      shouldMatch: false,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "multi-error aggregation",
      expectedRootCause: "multiple simultaneous failures",
      expectedSeverity: "High",
      expectedConfidenceRange: [45, 85],
      expectedFixes: ["split logs", "per-error analysis"],
    },
  },
  {
    category: "huge-stacktrace",
    sourceType: "Console",
    scriptPath: "ServerScriptService.Stacker",
    logTemplate: "{path}:{line}: attempt to index nil with 'Value'\nStack Begin\n{stack}\nStack End",
    codeTemplate:
      "local v = nil\nprint(v.Value)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-index-nil",
      expectedDiagnosis: "Nil Lifetime Breakdown",
      expectedRootCause: "nil access",
      expectedSeverity: "High",
      expectedConfidenceRange: [50, 99],
      expectedFixes: ["guard", "trace source"],
    },
  },
  {
    category: "only-code-no-log",
    sourceType: "ModuleScript",
    scriptPath: "ReplicatedStorage.Modules.CodeOnly",
    logTemplate: "",
    codeTemplate:
      "local DataStoreService = game:GetService(\"DataStoreService\")\nlocal ds = DataStoreService:GetDataStore(\"Items\")\nds:GetAsync(\"{player}\")",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-datastore",
      expectedDiagnosis: "DataStore Reliability",
      expectedRootCause: "code-only inference",
      expectedSeverity: "High",
      expectedConfidenceRange: [45, 99],
      expectedFixes: ["pcall", "retry"],
    },
  },
  {
    category: "only-log-no-code",
    sourceType: "Console",
    scriptPath: "ServerScriptService.LogOnly",
    logTemplate: "{path}:{line}: cannot resume dead coroutine",
    codeTemplate: "",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "Generic Runtime Context",
      expectedRootCause: "log only",
      expectedSeverity: "Low",
      expectedConfidenceRange: [15, 80],
      expectedFixes: ["inspect call stack"],
    },
  },
  {
    category: "empty-log-empty-code",
    sourceType: "Console",
    scriptPath: "Unknown",
    logTemplate: "",
    codeTemplate: "",
    expected: {
      shouldMatch: false,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "no signal",
      expectedRootCause: "empty input",
      expectedSeverity: "Low",
      expectedConfidenceRange: [0, 10],
      expectedFixes: ["provide input"],
    },
  },
];

function buildStackTraceLines(size: number): string {
  const lines: string[] = [];
  for (let i = 1; i <= size; i++) {
    lines.push(`Script 'ServerScriptService.Deep.Module${i}', Line ${i}`);
  }
  return lines.join("\n");
}

function materializeTopic(topic: Topic, index: number): Scenario {
  const player = PLAYERS[index % PLAYERS.length];
  const line = 8 + (index % 180);
  const stack = buildStackTraceLines(35 + (index % 25));

  const consoleError = topic.logTemplate
    .replaceAll("{path}", topic.scriptPath)
    .replaceAll("{line}", String(line))
    .replaceAll("{player}", player)
    .replaceAll("{stack}", stack);

  const code = topic.codeTemplate.replaceAll("{player}", player);

  return {
    id: `${topic.category}-${index + 1}`,
    category: topic.category,
    sourceType: topic.sourceType,
    consoleError,
    code,
    expected: topic.expected,
  };
}

function buildScenarioSet(multiplierPerTopic: number): Scenario[] {
  const cases: Scenario[] = [];
  for (let i = 0; i < BASE_TOPICS.length; i++) {
    const topic = BASE_TOPICS[i];
    for (let variant = 0; variant < multiplierPerTopic; variant++) {
      cases.push(materializeTopic(topic, i * multiplierPerTopic + variant));
    }
  }

  // Add explicit parser stressors.
  const hugeLog = "X".repeat(210_000);
  cases.push({
    id: "overflow-input-size-guard",
    category: "size-guard",
    sourceType: "Console",
    consoleError: hugeLog,
    code: "",
    expected: {
      shouldMatch: false,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "input too large",
      expectedRootCause: "size guard",
      expectedSeverity: "Low",
      expectedConfidenceRange: [0, 10],
      expectedFixes: ["trim input"],
    },
  });

  cases.push({
    id: "tab-heavy-duplicate-stack",
    category: "format-noise",
    sourceType: "Console",
    consoleError:
      "\t\tServerScriptService.Inventory:88:\tattempt to index nil with 'Value'\n" +
      buildStackTraceLines(120) +
      "\n" +
      buildStackTraceLines(120),
    code: "local t = nil\nprint(t.Value)",
    expected: {
      shouldMatch: true,
      expectedRuleId: "roblox-index-nil",
      expectedDiagnosis: "Nil Lifetime Breakdown",
      expectedRootCause: "nil index",
      expectedSeverity: "High",
      expectedConfidenceRange: [50, 99],
      expectedFixes: ["guard", "nil check"],
    },
  });

  cases.push({
    id: "huge-modulescript-size-guard",
    category: "huge-modulescript",
    sourceType: "ModuleScript",
    consoleError: "",
    code: `local blob = \"${"y".repeat(210_000)}\"\nreturn blob`,
    expected: {
      shouldMatch: false,
      expectedRuleId: "roblox-unknown",
      expectedDiagnosis: "input too large",
      expectedRootCause: "size guard",
      expectedSeverity: "Low",
      expectedConfidenceRange: [0, 10],
      expectedFixes: ["trim input"],
    },
  });

  return cases;
}

function includesLoose(haystack: string | undefined, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function evaluateCase(scenario: Scenario): CaseResult {
  const result = analyzeErrorAndCode(scenario.consoleError, scenario.code);

  const actual = {
    matched: result.matched,
    ruleId: result.matched ? result.ruleId : undefined,
    title: result.matched ? result.title : undefined,
    rootCause: result.matched ? result.rootCause : undefined,
    severity: result.matched ? result.severity : undefined,
    confidence: result.matched ? result.confidence : undefined,
    fix: result.matched ? result.fix : undefined,
  };

  const failedChecks: string[] = [];

  if (scenario.expected.shouldMatch && !actual.matched) {
    failedChecks.push("false-negative");
  }

  if (!scenario.expected.shouldMatch && actual.matched) {
    failedChecks.push("false-positive");
  }

  if (actual.matched && scenario.expected.shouldMatch) {
    if (scenario.expected.expectedRuleId !== actual.ruleId) {
      failedChecks.push("wrong-diagnosis");
    }

    if (scenario.expected.expectedSeverity !== actual.severity) {
      failedChecks.push("wrong-severity");
    }

    const confidence = actual.confidence ?? -1;
    if (
      confidence < scenario.expected.expectedConfidenceRange[0] ||
      confidence > scenario.expected.expectedConfidenceRange[1]
    ) {
      failedChecks.push("wrong-confidence");
    }

    const rootCauseOk = includesLoose(actual.rootCause, scenario.expected.expectedRootCause);
    if (!rootCauseOk) {
      failedChecks.push("wrong-root-cause");
    }

    const fixOk = scenario.expected.expectedFixes.some((keyword) => includesLoose(actual.fix, keyword));
    if (!fixOk) {
      failedChecks.push("wrong-fix");
    }

    const titleOk = includesLoose(actual.title, scenario.expected.expectedDiagnosis);
    if (!titleOk) {
      failedChecks.push("wrong-hypothesis-title");
    }
  }

  return {
    id: scenario.id,
    category: scenario.category,
    sourceType: scenario.sourceType,
    failedChecks,
    expected: scenario.expected,
    actual,
  };
}

function pct(hit: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((hit / total) * 100).toFixed(2));
}

describe("QA stress suite for Roblox analyzer", () => {
  it("builds >=500 scenarios and writes an adversarial quality report", () => {
    const scenarios = buildScenarioSet(16); // topic matrix + explicit stressors
    expect(scenarios.length).toBeGreaterThanOrEqual(500);

    const results = scenarios.map(evaluateCase);

    const total = results.length;
    const expectedPositives = scenarios.filter((s) => s.expected.shouldMatch).length;
    const expectedNegatives = total - expectedPositives;

    const falsePositives = results.filter((r) => r.failedChecks.includes("false-positive")).length;
    const falseNegatives = results.filter((r) => r.failedChecks.includes("false-negative")).length;

    const diagnosisCorrect = results.filter((r) => !r.failedChecks.includes("wrong-diagnosis")).length;
    const rootCauseCorrect = results.filter((r) => !r.failedChecks.includes("wrong-root-cause")).length;
    const confidenceCorrect = results.filter((r) => !r.failedChecks.includes("wrong-confidence")).length;
    const fixCorrect = results.filter((r) => !r.failedChecks.includes("wrong-fix")).length;

    const failedCases = results.filter((r) => r.failedChecks.length > 0);
    const failedCheckTotals = results.reduce<Record<string, number>>((acc, item) => {
      for (const check of item.failedChecks) {
        acc[check] = (acc[check] ?? 0) + 1;
      }
      return acc;
    }, {});

    const categoryCoverage = Object.fromEntries(
      Object.entries(
        results.reduce<Record<string, { total: number; failed: number }>>((acc, item) => {
          if (!acc[item.category]) {
            acc[item.category] = { total: 0, failed: 0 };
          }
          acc[item.category].total += 1;
          if (item.failedChecks.length > 0) acc[item.category].failed += 1;
          return acc;
        }, {}),
      ).map(([category, stats]) => [
        category,
        {
          ...stats,
          accuracy: pct(stats.total - stats.failed, stats.total),
        },
      ]),
    );

    const scorecard = {
      generatedAt: new Date().toISOString(),
      totalScenarios: total,
      expectedPositives,
      expectedNegatives,
      metrics: {
        detectionAccuracy: pct(total - falsePositives - falseNegatives, total),
        rootCauseAccuracy: pct(rootCauseCorrect, total),
        confidenceAccuracy: pct(confidenceCorrect, total),
        fixAccuracy: pct(fixCorrect, total),
        falsePositiveRate: pct(falsePositives, expectedNegatives),
        falseNegativeRate: pct(falseNegatives, expectedPositives),
        diagnosisAccuracy: pct(diagnosisCorrect, total),
      },
      failedPredictionCount: failedCases.length,
      failedCheckTotals,
      topFailures: failedCases.slice(0, 120),
      categoryCoverage,
    };

    const outDir = join(process.cwd(), "docs", "qa");
    mkdirSync(outDir, { recursive: true });

    writeFileSync(join(outDir, "stress-suite.json"), JSON.stringify(scenarios, null, 2), "utf8");
    writeFileSync(join(outDir, "stress-report.json"), JSON.stringify(scorecard, null, 2), "utf8");

    const lines = [
      "# QA Stress Report",
      `Total scenarios: ${scorecard.totalScenarios}`,
      `Detection accuracy: ${scorecard.metrics.detectionAccuracy}%`,
      `Root cause accuracy: ${scorecard.metrics.rootCauseAccuracy}%`,
      `Confidence accuracy: ${scorecard.metrics.confidenceAccuracy}%`,
      `Fix accuracy: ${scorecard.metrics.fixAccuracy}%`,
      `False positive rate: ${scorecard.metrics.falsePositiveRate}%`,
      `False negative rate: ${scorecard.metrics.falseNegativeRate}%`,
      `Diagnosis accuracy: ${scorecard.metrics.diagnosisAccuracy}%`,
      `Failed predictions: ${scorecard.failedPredictionCount}`,
      "",
      "## Notes",
      "Generated from automated adversarial scenarios spanning Roblox runtime, APIs, malformed logs, and parser stress inputs.",
    ];

    writeFileSync(join(outDir, "stress-report.md"), lines.join("\n"), "utf8");

    // This test validates report generation; quality thresholds are intentionally not asserted.
    expect(scorecard.totalScenarios).toBeGreaterThanOrEqual(500);
  });
});
