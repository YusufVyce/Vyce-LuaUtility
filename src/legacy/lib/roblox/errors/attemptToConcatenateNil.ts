import { collectRobloxDiagnostics } from "../../analyzer/robloxDiagnostics";
import type { Cause, ErrorEntry } from "../../types";

export const ATTEMPT_TO_CONCATENATE_NIL: ErrorEntry = {
  id: "roblox-concatenate-nil",
  title: "Attempt to concatenate nil",
  pattern: /attempt to concatenate (a )?nil value|attempt to concatenate nil/i,
  keywords: ["attempt", "concatenate", "nil", "string", "format", "tostring", "text", "name"],
  aliases: [
    "attempt to concatenate nil",
    "attempt to concatenate a nil value",
    "concat nil value",
    "cannot concatenate nil",
  ],
  analyze(logText, codeText) {
    const causes: Cause[] = [];
    const fixes: string[] = [];
    const diagnostics = collectRobloxDiagnostics(codeText);
    const variable =
      logText.match(/concatenate (?:a )?nil value(?: \(([^)]+)\))?/i)?.[1] || "a value";
    let example = "";

    if (!codeText) {
      causes.push(
        { percent: 90, text: `${variable} is nil while Lua is joining values with '..'.` },
        { percent: 10, text: "A function or table lookup returned nil instead of text." },
      );
      fixes.push("Validate the value before concatenating and choose an appropriate fallback.");
      example = 'local label = playerName or "Unknown"\nprint("Player: " .. label)';
    } else if (codeText.includes("FindFirstChild(")) {
      causes.push(
        {
          percent: 93,
          text: "FindFirstChild() returned nil because the named Instance is absent, then its Name or Value was concatenated.",
        },
        { percent: 7, text: "The object was destroyed after the lookup." },
      );
      fixes.push(
        "Check the FindFirstChild() result before reading it; use WaitForChild(name, timeout) only when replication is expected.",
      );
      example =
        'local badge = player:FindFirstChild("Badge")\nlocal badgeName = badge and badge.Name or "No badge"\nprint("Badge: " .. badgeName)';
    } else if (codeText.includes("require(")) {
      causes.push(
        {
          percent: 94,
          text: "A ModuleScript value used in a string expression is nil, commonly because the module did not return its export.",
        },
        { percent: 6, text: "The required module returned a table without the requested field." },
      );
      fixes.push(
        "Ensure the ModuleScript ends with 'return module' and guard optional exported fields.",
      );
      example =
        'local config = require(script.Parent.Config)\nlocal title = config.Title or "Untitled"\nprint("Title: " .. title)';
    } else {
      causes.push(
        {
          percent: 86,
          text: "An optional property, attribute, or function result is nil in a '..' expression.",
        },
        { percent: 14, text: "A value was initialized after this code ran." },
      );
      fixes.push(
        "Use an explicit nil check or a fallback such as 'value or \"\"'; use tostring() only after deciding how nil should be displayed.",
      );
      example =
        'local displayName = player.DisplayName\nif displayName ~= nil then\n    print("Welcome, " .. displayName)\nend';
    }
    return {
      explanation:
        "Lua tried to join text with nil. The '..' operator requires both operands to be non-nil values.",
      causes,
      fixes,
      example,
      severity: "High",
      confidence: 95,
      ...diagnostics,
    };
  },
};
