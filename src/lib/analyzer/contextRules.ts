/**
 * Declarative table of Lua/Roblox context heuristics.
 *
 * Each rule is a pure `test(ctx)` predicate over the trimmed code/log text
 * plus the pre-computed server/client context flags, paired with the static
 * issue content to report when it matches. `analyzeCodeContext` in
 * `contextAnalyzer.ts` just walks this list in order and collects the
 * matches — the order matters because the first matching issue's
 * `correctedExample` is used as the "best example" for the overall analysis.
 *
 * Keeping this as data (rather than a long chain of `if (...) issues.push()`
 * blocks) makes it easy to see every rule at a glance, and to add, remove,
 * or unit-test one rule without touching the others.
 */

export interface ContextIssue {
  id: string;
  category: string;
  title: string;
  description: string;
  suggestedFix: string;
  correctedExample: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  likelihood: number;
}

export interface ContextRuleInput {
  /** Trimmed Lua source. */
  code: string;
  /** Trimmed log/error text. */
  log: string;
  /** Whether the code looks like it runs in a server-side Script. */
  serverCtx: boolean;
  /** Whether the code looks like it runs in a client-side LocalScript. */
  clientCtx: boolean;
}

export interface ContextRule extends ContextIssue {
  test: (ctx: ContextRuleInput) => boolean;
}

// Shared regexes used by more than one rule below, so they're only compiled once.
const FIND_FIRST_CHILD_CALL_RE =
  /:FindFirstChild(?:OfClass|WhichIsA)?\s*\(\s*["']([^"']+)["']\s*\)/g;
const FIND_FIRST_CHILD_DIRECT_ACCESS_RE =
  /:FindFirstChild(?:OfClass|WhichIsA)?\s*\([^)]+\)\s*[.:]/;

export const CONTEXT_RULES: ContextRule[] = [
  // ==========================================
  // 1. EXECUTION CONTEXT
  // ==========================================
  {
    id: "LocalPlayerInsideServerScript",
    category: "Execution Context",
    title: "LocalPlayer accessed inside Server Script",
    description:
      "Players.LocalPlayer is only accessible in client scripts (LocalScripts). It returns nil on the server, causing a crash when indexed.",
    suggestedFix:
      "Move this client-oriented code to a LocalScript, or retrieve the Player object through events (e.g. PlayerAdded) or from remote triggers.",
    correctedExample: `-- Client-side (LocalScript)
local Players = game:GetService("Players")
local player = Players.LocalPlayer
print("Hello " .. player.Name)`,
    severity: "Critical",
    likelihood: 95,
    test: (ctx) => /(?:game\.)?Players?\.LocalPlayer\b/.test(ctx.code) && ctx.serverCtx,
  },
  {
    id: "FireServerInsideServerScript",
    category: "Execution Context",
    title: "FireServer called from Server Script",
    description:
      "FireServer() is client-to-server. A server Script cannot fire an event to itself this way.",
    suggestedFix:
      "Use FireClient() or FireAllClients() to communicate with clients, or invoke functions directly within the server script.",
    correctedExample: `-- Server-side (Script)
local RemoteEvent = game.ReplicatedStorage:WaitForChild("MyRemote")
-- To send to a client, you need a player object:
RemoteEvent:FireClient(player, data)`,
    severity: "High",
    likelihood: 90,
    test: (ctx) => ctx.code.includes("FireServer") && ctx.serverCtx,
  },
  {
    id: "FireClientInsideLocalScript",
    category: "Execution Context",
    title: "FireClient called from LocalScript",
    description:
      "FireClient() is server-to-client and cannot be invoked from client-side LocalScripts.",
    suggestedFix: "Use FireServer() to send data to the server instead.",
    correctedExample: `-- Client-side (LocalScript)
local RemoteEvent = game.ReplicatedStorage:WaitForChild("MyRemote")
RemoteEvent:FireServer(data)`,
    severity: "High",
    likelihood: 90,
    test: (ctx) => ctx.code.includes("FireClient") && ctx.clientCtx,
  },
  {
    id: "CharacterAddedMissing",
    category: "Execution Context",
    title: "Character accessed directly without CharacterAdded",
    description:
      "Accessing player.Character directly can return nil if the player's character model has not spawned or fully loaded yet.",
    suggestedFix: "Use player.CharacterAdded:Wait() to ensure the character exists before reference.",
    correctedExample: `local character = player.Character or player.CharacterAdded:Wait()`,
    severity: "Medium",
    likelihood: 75,
    test: (ctx) => /\.Character\b/.test(ctx.code) && !ctx.code.includes("CharacterAdded"),
  },
  {
    id: "PlayerAddedMisuse",
    category: "Execution Context",
    title: "PlayerAdded event listener inside LocalScript",
    description:
      "Players.PlayerAdded might miss the local player or other players who joined before this client script executed.",
    suggestedFix: "Iterate through existing players using GetPlayers() before connecting PlayerAdded.",
    correctedExample: `local Players = game:GetService("Players")
local function setupPlayer(player)
    -- Initialize player setup
end
-- Handle already connected players
for _, player in ipairs(Players:GetPlayers()) do
    task.spawn(setupPlayer, player)
end
Players.PlayerAdded:Connect(setupPlayer)`,
    severity: "High",
    likelihood: 80,
    test: (ctx) => ctx.code.includes("PlayerAdded") && ctx.clientCtx,
  },

  // ==========================================
  // 2. NIL RISKS
  // ==========================================
  {
    id: "FindFirstChildWithoutNilCheck",
    category: "Nil Risks",
    title: "FindFirstChild used without a nil validation",
    description:
      "FindFirstChild returns nil if the child does not exist. Accessing properties on it without checking can cause a crash.",
    suggestedFix: "Store the result in a variable and perform a conditional nil check before indexing properties.",
    correctedExample: `local child = parent:FindFirstChild("TargetName")
if child then
    print(child.Name)
end`,
    severity: "High",
    likelihood: 85,
    test: (ctx) => {
      const ffcMatches = ctx.code.match(FIND_FIRST_CHILD_CALL_RE);
      if (!ffcMatches) return false;

      // Very rough signal that *some* nil check exists somewhere in the script.
      const hasNilCheck = ctx.code.includes("if ") || ctx.code.includes(" and ");
      // Directly chaining off the FindFirstChild call is unsafe regardless.
      const directAccess = FIND_FIRST_CHILD_DIRECT_ACCESS_RE.test(ctx.code);

      return directAccess || !hasNilCheck;
    },
  },
  {
    id: "WaitForChildMissing",
    category: "Nil Risks",
    title: "WaitForChild missing on dynamically replicating instances",
    description:
      "Referencing folder collections like leaderstats, PlayerGui, or Backpack with dot notation can crash if replication latency causes them to be nil initially.",
    suggestedFix: "Use :WaitForChild() to pause script execution until the instance is replicated.",
    correctedExample: `local leaderstats = player:WaitForChild("leaderstats", 5)`,
    severity: "High",
    likelihood: 85,
    test: (ctx) =>
      (ctx.code.includes(".leaderstats") ||
        ctx.code.includes(".PlayerGui") ||
        ctx.code.includes(".Backpack")) &&
      !ctx.code.includes("WaitForChild"),
  },
  {
    id: "WaitForChildWithoutTimeout",
    category: "Nil Risks",
    title: "WaitForChild called without timeout",
    description:
      "WaitForChild() with no timeout parameter yields the thread infinitely if the asset is missing, potentially locking the script.",
    suggestedFix: "Add a timeout argument (e.g. 5 seconds) as the second parameter.",
    correctedExample: `local target = parent:WaitForChild("Target", 5)
if not target then
    warn("Target failed to load within timeout")
end`,
    severity: "Medium",
    likelihood: 70,
    test: (ctx) => /:WaitForChild\s*\(\s*["'][^"']+["']\s*\)/.test(ctx.code),
  },
  {
    id: "ValueAfterFindFirstChild",
    category: "Nil Risks",
    title: "Indexing Value immediately after FindFirstChild",
    description:
      "Accessing the .Value property directly after FindFirstChild() crashes the script instantly if the value instance is missing.",
    suggestedFix: "Save the value object in a local variable and verify it is not nil first.",
    correctedExample: `local valObject = parent:FindFirstChild("MyValue")
local val = valObject and valObject.Value`,
    severity: "High",
    likelihood: 90,
    test: (ctx) => /:FindFirstChild(?:OfClass|WhichIsA)?\s*\([^)]+\)\.Value/.test(ctx.code),
  },
  {
    id: "NestedIndexingAfterPossibleNil",
    category: "Nil Risks",
    title: "Nested indexing without intermediate nil validation",
    description:
      "Chaining property access (e.g. player.leaderstats.Coins.Value) will trigger a crash if any element in the hierarchy returns nil.",
    suggestedFix: "Break down the chain using WaitForChild or FindFirstChild with nil checks.",
    correctedExample: `local leaderstats = player:WaitForChild("leaderstats", 5)
local coins = leaderstats and leaderstats:WaitForChild("Coins", 5)
local coinsValue = coins and coins.Value`,
    severity: "Medium",
    likelihood: 75,
    test: (ctx) =>
      /\w+\.\w+\.\w+\.\w+/.test(ctx.code) &&
      !ctx.code.includes("FindFirstChild") &&
      !ctx.code.includes("WaitForChild"),
  },

  // ==========================================
  // 3. MODULE ANALYSIS
  // ==========================================
  {
    id: "RecursiveRequire",
    category: "Module Analysis",
    title: "Recursive require cycle detected",
    description:
      "A cyclic require occurs when a module directly or indirectly requires itself, causing Lua to throw an execution error.",
    suggestedFix:
      "Structure your architecture so that common logic is isolated in a helper module or resolve dependencies via Event emitters.",
    correctedExample: `-- Instead of direct circular requiring, use BindableEvents or a shared service
local Event = game.ReplicatedStorage:WaitForChild("SharedEvent")`,
    severity: "Critical",
    likelihood: 95,
    test: (ctx) => {
      const logLower = ctx.log.toLowerCase();
      return (
        logLower.includes("cyclic") ||
        logLower.includes("cycle") ||
        /require\s*\(\s*script\s*\)/i.test(ctx.code)
      );
    },
  },
  {
    id: "ModuleScriptMissingReturn",
    category: "Module Analysis",
    title: "ModuleScript lacks return statement",
    description:
      "ModuleScripts must return exactly one value (typically a table or function) so they can be loaded by other scripts.",
    suggestedFix: "Ensure the module finishes with a return statement of the module table/function.",
    correctedExample: `local Module = {}
function Module.doWork()
    -- code
end
return Module`,
    severity: "High",
    likelihood: 90,
    test: (ctx) =>
      ctx.code.includes("ModuleScript") ||
      (/local\s+\w+\s*=\s*\{\}/.test(ctx.code) && !ctx.code.includes("return")),
  },
  {
    id: "RequireAssignedNeverChecked",
    category: "Module Analysis",
    title: "Required module assigned but never checked or used",
    description:
      "A ModuleScript was successfully required but is never utilized or validated in the script body.",
    suggestedFix: "Check if the module import is redundant or verify that initialization routines are called.",
    correctedExample: `local MyModule = require(path.to.module)
if MyModule then
    MyModule.init()
end`,
    severity: "Low",
    likelihood: 60,
    test: (ctx) => {
      const reqMatch = ctx.code.match(/local\s+([A-Za-z_]\w*)\s*=\s*require\(/);
      if (!reqMatch) return false;

      const varName = reqMatch[1];
      const isChecked =
        ctx.code.includes(`if ${varName}`) ||
        ctx.code.includes(`if not ${varName}`) ||
        ctx.code.includes(`${varName}.`) ||
        ctx.code.includes(`${varName}(`);

      return !isChecked;
    },
  },

  // ==========================================
  // 4. CHARACTER ANALYSIS
  // ==========================================
  {
    id: "CharacterAccessedBeforeAdded",
    category: "Character Analysis",
    title: "Player Character referenced before CharacterAdded",
    description:
      "Accessing player.Character directly can yield nil because the character model loads asynchronously.",
    suggestedFix: "Retrieve the character with a fallback block using CharacterAdded:Wait().",
    correctedExample: `local character = player.Character or player.CharacterAdded:Wait()`,
    severity: "High",
    likelihood: 80,
    test: (ctx) => /\bCharacter\b/.test(ctx.code) && !ctx.code.includes("CharacterAdded"),
  },
  {
    id: "HumanoidAccessedBeforeCharacter",
    category: "Character Analysis",
    title: "Humanoid indexed before checking Character",
    description:
      "Referencing the Humanoid of a player will throw a nil index error if the Character has not spawned yet.",
    suggestedFix: "Wait for the Character first, and then fetch the Humanoid component using WaitForChild.",
    correctedExample: `local character = player.Character or player.CharacterAdded:Wait()
local humanoid = character:WaitForChild("Humanoid", 5)`,
    severity: "High",
    likelihood: 85,
    test: (ctx) =>
      /\.Humanoid\b|FindFirstChild\s*\(\s*["']Humanoid["']\s*\)/.test(ctx.code) &&
      !ctx.code.includes("CharacterAdded"),
  },
  {
    id: "BackpackAccessedTooEarly",
    category: "Character Analysis",
    title: "Player Backpack indexed directly",
    description:
      "Directly reading player.Backpack during player loading may return nil as inventory components take time to initialize.",
    suggestedFix: "Ensure the Backpack exists by calling WaitForChild with a timeout.",
    correctedExample: `local backpack = player:WaitForChild("Backpack", 5)`,
    severity: "Medium",
    likelihood: 75,
    test: (ctx) =>
      /\.Backpack\b/.test(ctx.code) && !/:WaitForChild\s*\(\s*["']Backpack["']\s*/.test(ctx.code),
  },

  // ==========================================
  // 5. LEADERSTATS ANALYSIS
  // ==========================================
  {
    id: "LeaderstatsAccessedWithoutWaitForChild",
    category: "Leaderstats Analysis",
    title: "leaderstats indexed directly",
    description: "Accessing player.leaderstats directly will error out if replication takes longer than script load.",
    suggestedFix: "Use :WaitForChild('leaderstats') to yield safely.",
    correctedExample: `local leaderstats = player:WaitForChild("leaderstats", 5)`,
    severity: "High",
    likelihood: 85,
    test: (ctx) =>
      /\.leaderstats\b/.test(ctx.code) && !/:WaitForChild\s*\(\s*["']leaderstats["']\s*/.test(ctx.code),
  },
  {
    id: "CoinsAccessedWithoutCheckingLeaderstats",
    category: "Leaderstats Analysis",
    title: "Stat accessed without validating leaderstats",
    description:
      "Reading or writing statistics without validating the leaderstats folder can cause a crash if leaderstats is nil.",
    suggestedFix: "Perform a check on the leaderstats folder first.",
    correctedExample: `local leaderstats = player:WaitForChild("leaderstats", 5)
local coins = leaderstats and leaderstats:WaitForChild("Coins", 5)`,
    severity: "High",
    likelihood: 80,
    test: (ctx) =>
      /leaderstats\.(Coins|Points|Cash|Money|Level|Value)/.test(ctx.code) &&
      !/if\s+leaderstats\b/.test(ctx.code),
  },

  // ==========================================
  // 6. REMOTE ANALYSIS
  // ==========================================
  {
    id: "FireServerMisuse",
    category: "Remote Analysis",
    title: "LocalPlayer passed manually in FireServer",
    description:
      "Calling FireServer(player) is incorrect. Roblox automatically passes the local player as the first argument, shifting all your other parameters.",
    suggestedFix: "Remove the player parameter from FireServer().",
    correctedExample: `RemoteEvent:FireServer(data)`,
    severity: "Critical",
    likelihood: 95,
    test: (ctx) =>
      /:FireServer\s*\(\s*(?:game\.)?Players?\.LocalPlayer\b/.test(ctx.code) ||
      /:FireServer\s*\(\s*player\b/.test(ctx.code),
  },
  {
    id: "FireClientMisuse",
    category: "Remote Analysis",
    title: "FireClient called without Player reference",
    description:
      "FireClient() must receive the targeted Player object as its first argument so the server knows where to send the event.",
    suggestedFix: "Pass the targeted player as the first argument.",
    correctedExample: `RemoteEvent:FireClient(targetPlayer, data)`,
    severity: "Critical",
    likelihood: 90,
    test: (ctx) =>
      ctx.code.includes("FireClient") &&
      ctx.serverCtx &&
      !/:FireClient\s*\(\s*[a-zA-Z_]\w*\s*,/.test(ctx.code),
  },
  {
    id: "InvokeServerMisuse",
    category: "Remote Analysis",
    title: "LocalPlayer passed manually in InvokeServer",
    description:
      "Like FireServer, InvokeServer() automatically sends the sending player. Passing it manually causes parameter shifting.",
    suggestedFix: "Remove the player parameter from InvokeServer().",
    correctedExample: `local result = RemoteFunction:InvokeServer(data)`,
    severity: "Critical",
    likelihood: 95,
    test: (ctx) =>
      /:InvokeServer\s*\(\s*(?:game\.)?Players?\.LocalPlayer\b/.test(ctx.code) ||
      /:InvokeServer\s*\(\s*player\b/.test(ctx.code),
  },
  {
    id: "InvokeClientMisuse",
    category: "Remote Analysis",
    title: "InvokeClient called on the server",
    description:
      "Calling InvokeClient() is heavily discouraged by Roblox because client errors, timeouts, or infinite yields will hang the server thread indefinitely.",
    suggestedFix:
      "Replace RemoteFunction:InvokeClient() with a RemoteEvent (FireClient) and handle response updates asynchronously.",
    correctedExample: `-- Use RemoteEvents instead:
RemoteEvent:FireClient(player, data)
-- Listen to client response on another RemoteEvent:
ResponseEvent.OnServerEvent:Connect(function(player, response)
    -- Handle response
end)`,
    severity: "Critical",
    likelihood: 90,
    test: (ctx) => ctx.code.includes("InvokeClient"),
  },

  // ==========================================
  // 7. DATASTORE ANALYSIS
  // ==========================================
  {
    id: "GetAsyncOutsidePcall",
    category: "DataStore",
    title: "DataStore GetAsync called outside pcall",
    description:
      "DataStore requests are external HTTP calls that frequently fail due to API limits or connection errors. Unwrapped calls can crash the script.",
    suggestedFix: "Wrap the GetAsync operation in a pcall block to catch runtime errors.",
    correctedExample: `local success, data = pcall(function()
    return myDataStore:GetAsync(key)
end)
if not success then
    warn("Failed to retrieve DataStore data")
end`,
    severity: "High",
    likelihood: 85,
    test: (ctx) => ctx.code.includes("GetAsync") && !ctx.code.includes("pcall"),
  },
  {
    id: "SetAsyncOutsidePcall",
    category: "DataStore",
    title: "DataStore SetAsync called outside pcall",
    description:
      "DataStore writes (SetAsync) will throw errors if throttled, which interrupts game loops if not wrapped in pcall.",
    suggestedFix: "Always wrap SetAsync writes in a pcall block and log any failure reasons.",
    correctedExample: `local success, err = pcall(function()
    myDataStore:SetAsync(key, value)
end)
if not success then
    warn("Data save failed: " .. tostring(err))
end`,
    severity: "High",
    likelihood: 85,
    test: (ctx) => ctx.code.includes("SetAsync") && !ctx.code.includes("pcall"),
  },
  {
    id: "UpdateAsyncMisuse",
    category: "DataStore",
    title: "UpdateAsync misused or called outside pcall",
    description:
      "UpdateAsync requires a transformation callback function as the second parameter and must be run inside a pcall to handle server-side errors safely.",
    suggestedFix: "Define a callback parameter and invoke the call inside a pcall wrapper.",
    correctedExample: `local success, err = pcall(function()
    myDataStore:UpdateAsync(key, function(oldValue)
        local newValue = oldValue or {}
        newValue.Coins = (newValue.Coins or 0) + 10
        return newValue
    end)
end)`,
    severity: "High",
    likelihood: 90,
    test: (ctx) => {
      if (!ctx.code.includes("UpdateAsync")) return false;
      const isPcall = ctx.code.includes("pcall");
      const hasCallback = /UpdateAsync\s*\(\s*[^,]+,\s*(?:function|local)/i.test(ctx.code);
      return !isPcall || !hasCallback;
    },
  },
];
