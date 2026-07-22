import { collectRobloxDiagnostics } from "../../analyzer/robloxDiagnostics";
import type { Cause, ErrorEntry } from "../../types";

export const ATTEMPT_TO_COMPARE_NIL: ErrorEntry = {
  id: "roblox-compare-nil",
  title: "Attempt to compare nil",
  pattern: /attempt to compare (?:a )?nil value|attempt to compare nil/i,
  keywords: ["attempt", "compare", "nil", "greater", "less", "number", "leaderstats", "value"],
  aliases: [
    "attempt to compare nil",
    "attempt to compare a nil value",
    "cannot compare nil",
    "compare nil value",
  ],
  analyze(_logText, codeText) {
    const causes: Cause[] = [];
    const fixes: string[] = [];
    const diagnostics = collectRobloxDiagnostics(codeText);
    let example = "";
    if (!codeText) {
      causes.push(
        { percent: 90, text: "A nil value is being used with <, >, <=, or >=." },
        { percent: 10, text: "A function or lookup failed to produce the expected number." },
      );
      fixes.push(
        "Check for nil before ordering values and initialize numeric state with a meaningful default.",
      );
      example = 'local score = savedScore or 0\nif score >= 100 then\n    print("Winner")\nend';
    } else if (codeText.includes("leaderstats") || codeText.includes('WaitForChild("Coins"')) {
      causes.push(
        {
          percent: 92,
          text: "leaderstats or its value has not replicated/been created when the comparison runs.",
        },
        { percent: 8, text: "The player left before initialization completed." },
      );
      fixes.push(
        "Wait for leaderstats and the value with bounded WaitForChild() calls before reading Value.",
      );
      example =
        'local leaderstats = player:WaitForChild("leaderstats", 5)\nlocal coins = leaderstats and leaderstats:WaitForChild("Coins", 5)\nif coins and coins.Value >= 100 then\n    print("Enough coins")\nend';
    } else if (codeText.includes("GetAttribute(")) {
      causes.push(
        {
          percent: 90,
          text: "GetAttribute() returned nil because the attribute is missing or has not been set yet.",
        },
        { percent: 10, text: "The attribute name differs from the one assigned." },
      );
      fixes.push(
        "Set the attribute before it is read, or provide a numeric fallback only when zero is valid.",
      );
      example =
        'local level = player:GetAttribute("Level")\nif typeof(level) == "number" and level >= 10 then\n    unlockReward(player)\nend';
    } else {
      causes.push(
        { percent: 85, text: "A variable expected to be a comparable number/string is nil." },
        {
          percent: 15,
          text: "The value came from a missing table key or a function with no return value.",
        },
      );
      fixes.push(
        "Trace the source of both operands and validate their types before the comparison.",
      );
      example = 'if typeof(distance) == "number" and distance < 20 then\n    print("Nearby")\nend';
    }
    return {
      explanation:
        "Roblox cannot order nil against another value. Comparisons such as '<' and '>=' need compatible, non-nil operands.",
      causes,
      fixes,
      example,
      severity: "High",
      confidence: 94,
      ...diagnostics,
    };
  },
};
