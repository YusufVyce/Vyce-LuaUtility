import { collectRobloxDiagnostics } from "../../analyzer/robloxDiagnostics";
import type { Cause, ErrorEntry } from "../../types";

export const INVALID_TYPE: ErrorEntry = {
  id: "roblox-invalid-type",
  title: "Invalid type",
  pattern: /invalid type|expected type .+ got .+|expected .+ got .+/i,
  keywords: ["invalid", "type", "expected", "got", "typeof", "instance", "argument", "remote"],
  aliases: ["invalid type", "expected type got", "wrong type", "type mismatch"],
  analyze(logText, codeText) {
    const causes: Cause[] = [];
    const fixes: string[] = [];
    const diagnostics = collectRobloxDiagnostics(codeText);
    const expected =
      logText.match(/expected\s+([^,]+?)(?:,?\s+got|\s+got)/i)?.[1] || "a different type";
    let example = "";
    if (!codeText) {
      causes.push(
        {
          percent: 88,
          text: `A Roblox API expected ${expected}, but received a value of another type.`,
        },
        {
          percent: 12,
          text: "A variable changed type because of an unvalidated function return or input.",
        },
      );
      fixes.push("Inspect typeof(value) and validate it immediately before the API call.");
      example = 'if typeof(value) == "number" then\n    updateScore(value)\nend';
    } else if (codeText.includes("OnServerEvent") || codeText.includes("FireServer(")) {
      causes.push(
        {
          percent: 93,
          text: "Remote data has the wrong type. Client input must be treated as untrusted on the server.",
        },
        { percent: 7, text: "Client and server disagree on the remote argument order." },
      );
      fixes.push(
        "Validate every remote argument with typeof()/IsA() on the server and reject invalid requests.",
      );
      example =
        'remote.OnServerEvent:Connect(function(player, amount)\n    if typeof(amount) ~= "number" or amount < 0 then return end\n    grantCoins(player, amount)\nend)';
    } else if (codeText.includes("LocalPlayer")) {
      causes.push(
        {
          percent: 94,
          text: "Players.LocalPlayer is only available to LocalScripts running on the client, not server Scripts.",
        },
        { percent: 6, text: "The script is executing in a server-only container." },
      );
      fixes.push(
        "Pass the Player from PlayerAdded/OnServerEvent on the server; use LocalPlayer only in a client LocalScript.",
      );
      example = "game.Players.PlayerAdded:Connect(function(player)\n    print(player.Name)\nend)";
    } else {
      causes.push(
        {
          percent: 83,
          text: "An API or property received an incompatible Lua or Roblox Instance type.",
        },
        { percent: 17, text: "A nil check was omitted and nil reached the API." },
      );
      fixes.push(
        "Check Roblox API parameter requirements and use typeof() for primitives or IsA() for Instances.",
      );
      example = 'if part and part:IsA("BasePart") then\n    part.Anchored = true\nend';
    }
    return {
      explanation: `Roblox rejected a value because it was not ${expected} expected by the operation.`,
      causes,
      fixes,
      example,
      severity: "Medium",
      confidence: 93,
      ...diagnostics,
    };
  },
};
