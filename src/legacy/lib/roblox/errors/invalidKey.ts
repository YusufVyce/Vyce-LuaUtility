import { collectRobloxDiagnostics } from "../../analyzer/robloxDiagnostics";
import type { Cause, ErrorEntry } from "../../types";

export const INVALID_KEY: ErrorEntry = {
  id: "roblox-invalid-key",
  title: "Invalid key",
  pattern: /invalid key|key .+ not found|is not a valid key/i,
  keywords: ["invalid", "key", "table", "dictionary", "attribute", "keycode", "lookup"],
  aliases: ["invalid key", "key not found", "not a valid key", "invalid dictionary key"],
  analyze(logText, codeText) {
    const causes: Cause[] = [];
    const fixes: string[] = [];
    const diagnostics = collectRobloxDiagnostics(codeText);
    const key = logText.match(/key\s+['"]?([^'"\s]+)['"]?/i)?.[1] || "requested key";
    let example = "";
    if (!codeText) {
      causes.push(
        {
          percent: 87,
          text: `The ${key} is not accepted by the table, API, or configuration being accessed.`,
        },
        { percent: 13, text: "The key comes from unvalidated player input or stale saved data." },
      );
      fixes.push(
        "Validate keys against the supported set before indexing or passing them to an API.",
      );
      example =
        "local rewards = { Daily = 100, Weekly = 500 }\nlocal reward = rewards[rewardName]\nif reward then\n    grantReward(player, reward)\nend";
    } else if (codeText.includes("GetAttribute(") || codeText.includes("SetAttribute(")) {
      causes.push(
        {
          percent: 89,
          text: "The Attribute key is invalid, missing, or differs in capitalization from the name set elsewhere.",
        },
        { percent: 11, text: "The code expects an attribute that was never created." },
      );
      fixes.push(
        "Use a shared constant for attribute names and handle a missing GetAttribute() result.",
      );
      example =
        'local LEVEL_ATTRIBUTE = "Level"\nlocal level = player:GetAttribute(LEVEL_ATTRIBUTE)\nif typeof(level) == "number" then\n    print(level)\nend';
    } else if (codeText.includes("RemoteEvent") || codeText.includes("OnServerEvent")) {
      causes.push(
        { percent: 91, text: "A client-selected key is outside the server's allowed dictionary." },
        { percent: 9, text: "Client and server use different configuration versions." },
      );
      fixes.push("Whitelist valid keys on the server instead of trusting keys sent by clients.");
      example =
        "local products = { Sword = 100, Shield = 150 }\nremote.OnServerEvent:Connect(function(player, productKey)\n    local price = products[productKey]\n    if not price then return end\n    purchase(player, productKey, price)\nend)";
    } else {
      causes.push(
        {
          percent: 82,
          text: "A table/configuration lookup uses a misspelled, nil, or unsupported key.",
        },
        { percent: 18, text: "A ModuleScript returned a configuration without the requested key." },
      );
      fixes.push(
        "Check the key exists with table[key] before use and verify ModuleScript exports.",
      );
      example =
        'local config = require(script.Parent.Config)\nlocal setting = config.Settings[settingName]\nif setting == nil then\n    warn("Unknown setting:", settingName)\n    return\nend';
    }
    return {
      explanation:
        "The operation received a key that is not valid in its current table, configuration, or Roblox API context.",
      causes,
      fixes,
      example,
      severity: "Medium",
      confidence: 91,
      ...diagnostics,
    };
  },
};
