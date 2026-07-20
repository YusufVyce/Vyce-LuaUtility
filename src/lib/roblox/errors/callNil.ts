import { ROBLOX_INSIGHTS } from "../insights";
import { ROBLOX_DEPRECATED } from "../deprecated";
import { ROBLOX_PERFORMANCE } from "../performance";
import { ROBLOX_SECURITY } from "../security";
import { enrichAnalysis } from "@/lib/analyzer/contextAnalyzer";

import type {
  Analysis,
  Cause,
  CodeInsight,
  DeprecatedApi,
  ErrorEntry,
} from "../../types";

export const ATTEMPT_TO_CALL_NIL: ErrorEntry = {
  id: "roblox-call-nil",
  title: "Attempt to call a nil value",
  pattern: /attempt to call (?:a )?nil value|attempt to call nil|attempted to call a nil value/i,

  analyze(logText, codeText) {
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

    // Checking code specific patterns
    if (!codeText) {
      causes.push({
        percent: 90,
        text: "The variable or function being called is nil. Without the related code, the exact source cannot be pinpointed.",
      });

      fixes.push("Ensure the function exists before calling it.");
      fixes.push("Provide the related script for a deeper analysis.");

      example =
`if myFunction then
    myFunction()
end`;
    }

    else if (codeText.includes("require(")) {
      causes.push({
        percent: 93,
        text: "The required ModuleScript returned nil or failed before returning its exports.",
      });

      causes.push({
        percent: 7,
        text: "A circular require caused the module to be partially initialized.",
      });

      fixes.push(
        "Verify the ModuleScript finishes with 'return module'."
      );

      fixes.push(
        "Check Output for errors thrown inside the required module."
      );

      example =
`local Module = require(script.Module)

if Module then
    Module.Start()
end`;
    }

    else if (
      codeText.includes("callback") ||
      codeText.includes("Callback")
    ) {
      causes.push({
        percent: 96,
        text: "The callback variable is nil because it was never assigned before execution.",
      });

      causes.push({
        percent: 4,
        text: "The callback was overwritten with nil somewhere else.",
      });

      fixes.push(
        "Assign the callback before invoking it."
      );

      fixes.push(
        "Verify callback parameters are optional before calling them."
      );

      example =
`if callback then
    callback()
end`;
    }
    else if (
      codeText.includes(".") &&
      (
        codeText.includes("()") ||
        codeText.includes(":")
      )
    ) {
      causes.push({
        percent: 92,
        text: "A function inside a module or object does not exist. The field you're calling is nil.",
      });

      causes.push({
        percent: 8,
        text: "The object itself failed to initialize before the function call.",
      });

      fixes.push(
        "Verify the function exists in the returned module or object."
      );

      fixes.push(
        "Double-check the spelling and capitalization of the function."
      );

      example =
`local Module = require(script.Module)

if Module.Run then
    Module.Run()
end`;
    }

    else if (
      codeText.includes("function") &&
      codeText.includes("(")
    ) {
      causes.push({
        percent: 85,
        text: "The function name is misspelled or does not exist in the current scope.",
      });

      causes.push({
        percent: 15,
        text: "The function exists in another script or module but was never imported.",
      });

      fixes.push(
        "Verify the function name matches its declaration exactly."
      );

      fixes.push(
        "Check for case-sensitive spelling mistakes."
      );

      example =
`local function DoSomething()
    print("Hello")
end

DoSomething()`;
    }

    else {
      causes.push({
        percent: 70,
        text: "The value you're trying to call is nil because it was never assigned a function.",
      });

      causes.push({
        percent: 20,
        text: "The variable was accidentally overwritten with nil.",
      });

      causes.push({
        percent: 10,
        text: "The object was destroyed or became unavailable before execution.",
      });

      fixes.push(
        "Print the variable before calling it to confirm it contains a function."
      );

      fixes.push(
        "Use assertions or nil checks before invoking callbacks."
      );

      fixes.push(
        "Trace where the variable receives its value."
      );

      example =
`assert(myFunction, "Function is nil")

myFunction()`;
    }

    return enrichAnalysis({
      explanation:
        "The script attempted to execute a value as a function, but that value is nil. This usually means the function does not exist, failed to load, or was never assigned.",

      causes,
      fixes,
      example,

      severity: "High",
      confidence: 95,

      codeInsights,
      deprecatedApis,

      performanceIssues,
      securityIssues,
    }, logText, codeText);
  },
};