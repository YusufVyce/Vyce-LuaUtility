import { ROBLOX_INSIGHTS } from "../insights";
import { ROBLOX_DEPRECATED } from "../deprecated";
import { ROBLOX_PERFORMANCE } from "../performance";
import { ROBLOX_SECURITY } from "../security";

import type {
  Analysis,
  Cause,
  CodeInsight,
  DeprecatedApi,
  ErrorEntry,
} from "../../types";

export const MODULE_RETURN: ErrorEntry = {
  id: "roblox-module-return",
  title: "ModuleScript loading error",

  pattern:
    /module code did not return exactly one value|requested module experienced an error while loading|requested module was required recursively|error occurred while loading module/i,

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

    if (!codeText) {

      causes.push({
        percent:90,
        text:"A ModuleScript failed to load correctly."
      });

      fixes.push(
        "Paste the ModuleScript code so Detector can determine why it failed."
      );

      example =
`local Module = require(script.Module)

Module.Test()`;

    }

    else if (
      !codeText.includes("return")
    ) {

      causes.push({
        percent:99,
        text:"The ModuleScript never returns a value."
      });

      causes.push({
        percent:1,
        text:"Execution stops before reaching the end of the module."
      });

      fixes.push(
        "Return a table or another value at the end of the ModuleScript."
      );

      example =
`local Module = {}

function Module.Test()

end

return Module`;

    }

    else if (
      codeText.includes("return nil")
    ) {

      causes.push({
        percent:97,
        text:"The ModuleScript explicitly returns nil."
      });

      causes.push({
        percent:3,
        text:"The return value is being overwritten."
      });

      fixes.push(
        "Return a valid table or object instead of nil."
      );

      example =
`local Module = {}

return Module`;

    }

    else if (
      codeText.includes("require(")
    ) {

      causes.push({
        percent:94,
        text:"The module being required may have failed while loading."
      });

      causes.push({
        percent:6,
        text:"The required object is not a valid ModuleScript."
      });

      fixes.push(
        "Verify that require() is pointing to a valid ModuleScript."
      );

      example =
`local Module =
require(script.Parent.Module)

Module.Test()`;

    }
    else if (
      /required recursively/i.test(logText)
    ) {

      causes.push({
        percent:99,
        text:"Two or more ModuleScripts are requiring each other, creating a circular dependency."
      });

      causes.push({
        percent:1,
        text:"The dependency chain eventually requires the original module again."
      });

      fixes.push(
        "Break the circular dependency by moving shared code into a separate ModuleScript."
      );

      fixes.push(
        "Avoid calling require() between modules that depend on each other."
      );

      example =
`-- SharedModule

local Shared = {}

return Shared`;

    }

    else if (
      /experienced an error while loading/i.test(logText) ||
      /error occurred while loading module/i.test(logText)
    ) {

      causes.push({
        percent:97,
        text:"The ModuleScript threw an error before it finished loading."
      });

      causes.push({
        percent:3,
        text:"Another script required this module before initialization completed."
      });

      fixes.push(
        "Read the first error in the output window. It usually points to the exact failing line."
      );

      fixes.push(
        "Fix runtime errors inside the ModuleScript before requiring it."
      );

      example =
`local Module = {}

function Module.Test()

end

return Module`;

    }

    else if (
      codeText.includes("require(game") ||
      codeText.includes("require(workspace") ||
      codeText.includes("require(player")
    ) {

      causes.push({
        percent:95,
        text:"require() is likely being called on an Instance that is not a ModuleScript."
      });

      causes.push({
        percent:5,
        text:"The variable passed into require() references the wrong object."
      });

      fixes.push(
        "Ensure require() only receives ModuleScript instances."
      );

      example =
`local Module =
require(script.Parent.Module)

Module.Start()`;

    }

    else {

      causes.push({
        percent:88,
        text:"The ModuleScript failed to initialize correctly."
      });

      causes.push({
        percent:12,
        text:"The module contains an unexpected runtime error."
      });

      fixes.push(
        "Verify the module executes successfully from top to bottom."
      );

      fixes.push(
        "Check every require() call and every return statement."
      );

      example =
`local Module = {}

return Module`;

    }
    return {
      explanation:
        "A ModuleScript failed to load correctly. Roblox could not finish executing the module before it was required.",

      causes,
      fixes,
      example,

      severity: "High",
      confidence: 97,

      warnings: [
        {
          title: "ModuleScript Initialization Failed",
          description:
            "ModuleScripts must execute successfully and return exactly one value. Any runtime error or missing return prevents the module from loading.",
        },
      ],

      relatedErrors: [
        "attempt to call a nil value",
        "invalid argument",
        "attempt to index nil with",
        "requested module was required recursively",
      ],

      preventionTips: [
        "Always return exactly one value from every ModuleScript.",
        "Avoid circular require() dependencies.",
        "Keep module initialization lightweight.",
        "Move expensive code into functions instead of running it during module load.",
        "Verify every require() target is actually a ModuleScript.",
      ],

      codeInsights,
      deprecatedApis,
      performanceIssues,
      securityIssues,
    };
  },
};