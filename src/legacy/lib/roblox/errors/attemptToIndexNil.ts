import { ROBLOX_INSIGHTS } from "../insights";
import { ROBLOX_DEPRECATED } from "../deprecated";
import { ROBLOX_PERFORMANCE } from "../performance";
import { ROBLOX_SECURITY } from "../security";
import { enrichAnalysis } from "../../../analyzer/contextAnalyzer";

import type {
  Analysis,
  Cause,
  CodeInsight,
  DeprecatedApi,
  ErrorEntry,
} from "../../types";

export const ATTEMPT_TO_INDEX_NIL: ErrorEntry = {
  id: "roblox-index-nil",
  title: "Attempt to index nil",
  pattern: /attempt to index (?:a )?nil value|attempt to index nil(?:\s|$)/i,

keywords: [
  "attempt",
  "index",
  "nil",
  "value",
  "field",
  "property",
  "table",
  "leaderstats",
  "waitforchild",
  "findfirstchild",
  "module",
  "require"
],

aliases: [
  "attempt to index nil",
  "attempt to index a nil value",
  "attempted to index nil",
  "attempt to index field",
  "attempt to index property",
  "attempt to index value",
  "attempt to index with value"
],

  analyze(logText, codeText) {
    const propMatch = logText.match(/with ['"]?([^'"]+)['"]?/i);
    const targetProperty = propMatch ? propMatch[1] : "unknown property";

    const causes: Cause[] = [];
    const fixes: string[] = [];

    let example = "";

    const codeInsights: CodeInsight[] = [];
    const deprecatedApis: DeprecatedApi[] = [];

    const performanceIssues: Analysis["performanceIssues"] = [];
    const securityIssues: Analysis["securityIssues"] = [];

    for (const insight of ROBLOX_INSIGHTS) {
      const matched =
        codeText.includes(insight.pattern) ||
        codeText.includes(insight.pattern.replace(":", "."));

      if (matched) {
        codeInsights.push({
          title: insight.title,
          description: insight.description,
        });
      }
    }

    for (const deprecated of ROBLOX_DEPRECATED) {
      if (codeText.includes(deprecated.pattern)) {
        deprecatedApis.push({
          api: deprecated.api,
          replacement: deprecated.replacement,
          reason: deprecated.reason,
        });
      }
    }

    for (const issue of ROBLOX_PERFORMANCE) {
      if (codeText.includes(issue.pattern)) {
        performanceIssues.push({
          title: issue.title,
          impact: issue.impact,
          description: issue.description,
        });
      }
    }

    for (const issue of ROBLOX_SECURITY) {
      if (codeText.includes(issue.pattern)) {
        securityIssues.push({
          title: issue.title,
          severity: issue.severity,
          description: issue.description,
        });
      }
    }

    if (!codeText) {
      causes.push({
        percent: 90,
        text: `You are trying to access .${targetProperty} on an object that is currently nil. Add the related code above for a more precise analysis.`,
      });

      fixes.push(`Add a nil check before accessing .${targetProperty}.`);

      example = `if myObject then
  print(myObject.${targetProperty})
end`;
    }

    else if (
      codeText.includes(`.${targetProperty}`) &&
      (
        codeText.includes("leaderstats") ||
        codeText.includes("player.")
      )
    ) {
      causes.push({
        percent: 88,
        text: "Data dependency issue: leaderstats or the value inside it has not replicated to the client yet when the script runs.",
      });

      causes.push({
        percent: 12,
        text: "The player object is invalid, or the player left the game before initialization finished.",
      });

      fixes.push(
        "Use :WaitForChild() instead of direct dot notation for objects created at runtime."
      );

      fixes.push(
        "Check that the player/character still exists before reading from it."
      );

      example =
`local leaderstats = player:WaitForChild("leaderstats", 5)
if not leaderstats then return end

local targetValue = leaderstats:WaitForChild("Coins", 5)
if targetValue then
    print(targetValue.${targetProperty})
end`;
}
    else if (codeText.includes("[") && codeText.includes("]")) {
      causes.push({
        percent: 94,
        text: `Table/dictionary lookup returned nil. The key you used does not exist in the table, so indexing .${targetProperty} on the result fails.`,
      });

      causes.push({
        percent: 6,
        text: "The table itself is nil, or failed to initialize before this line ran.",
      });

      fixes.push(
        "Verify the key exists in the table before accessing its properties."
      );

      example =
`local item = data.Items[selectedItem]

if item then
    print(item.${targetProperty})
else
    warn("Item key not found in dictionary: ", tostring(selectedItem))
end`;
    }

    else if (codeText.includes("require(")) {
      causes.push({
        percent: 95,
        text: `require() returned nil. You are trying to read .${targetProperty} from a module that errored silently, or one that is recursively requiring itself.`,
      });

      fixes.push(
        "Check the required ModuleScript for errors and confirm it ends with 'return module'."
      );
    }

    else {
      causes.push({
        percent: 80,
        text: `The object you're reading .${targetProperty} from was destroyed, misspelled, or never instantiated.`,
      });

      causes.push({
        percent: 20,
        text: "Scope issue: the variable exists, but in a different block than the one erroring.",
      });

      fixes.push(
        "Trace where the variable is defined. Use :FindFirstChild() with a nil check instead of assuming it exists."
      );

      example =
`local obj = workspace:FindFirstChild("TargetName")

if obj then
    print(obj.${targetProperty})
end`;
    }

    return enrichAnalysis({
      explanation: `The script tried to read or modify the '${targetProperty}' property of an object, but that object does not exist in memory (it is nil).`,

      causes,
      fixes,
      example,

      severity: "High",
      confidence: 94,

      codeInsights,
      deprecatedApis,

      performanceIssues,
      securityIssues,
    }, logText, codeText);
  },
};
