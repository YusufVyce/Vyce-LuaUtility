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

export const SCRIPT_TIMEOUT: ErrorEntry = {
  id: "roblox-script-timeout",
  title: "Script execution timeout",

  pattern:
/script exhausted allowed execution time|execution timeout/i,

  analyze(logText, codeText) {

    const causes: Cause[] = [];
    const fixes: string[] = [];
    let example = "";

    const codeInsights: CodeInsight[] = [];
    const deprecatedApis: DeprecatedApi[] = [];
    const performanceIssues: Analysis["performanceIssues"] = [];
    const securityIssues: Analysis["securityIssues"] = [];

    for (const i of ROBLOX_INSIGHTS) {
      if (
        codeText.includes(i.pattern) ||
        codeText.includes(i.pattern.replace(":", "."))
      ) {
        codeInsights.push({
          title: i.title,
          description: i.description,
        });
      }
    }

    for (const d of ROBLOX_DEPRECATED) {
      if (codeText.includes(d.pattern)) {
        deprecatedApis.push({
          api: d.api,
          replacement: d.replacement,
          reason: d.reason,
        });
      }
    }

    for (const p of ROBLOX_PERFORMANCE) {
      if (codeText.includes(p.pattern)) {
        performanceIssues.push({
          title: p.title,
          impact: p.impact,
          description: p.description,
        });
      }
    }

    for (const s of ROBLOX_SECURITY) {
      if (codeText.includes(s.pattern)) {
        securityIssues.push({
          title: s.title,
          severity: s.severity,
          description: s.description,
        });
      }
    }

    if (
      codeText.includes("while true do") &&
      !codeText.includes("task.wait") &&
      !codeText.includes("wait(")
    ) {

      causes.push({
        percent:99,
        text:"An infinite while loop never yields execution."
      });

      causes.push({
        percent:1,
        text:"The loop blocks Roblox's scheduler."
      });

      fixes.push(
        "Insert task.wait() inside the loop."
      );

      example =
`while true do

    task.wait()

end`;

    }

    else if (
      codeText.includes("repeat") &&
      codeText.includes("until") &&
      !codeText.includes("task.wait")
    ) {

      causes.push({
        percent:98,
        text:"The repeat-until loop never yields."
      });

      fixes.push(
        "Yield periodically using task.wait()."
      );

      example =
`repeat

    task.wait()

until finished`;

    }

    else if (
      codeText.includes("function") &&
      codeText.includes("return")
    ) {

      causes.push({
        percent:94,
        text:"A recursive function may be calling itself indefinitely."
      });

      causes.push({
        percent:6,
        text:"The recursion has no valid exit condition."
      });

      fixes.push(
        "Add a termination condition before the recursive call."
      );

      example =
`local function Test(depth)

    if depth <= 0 then
        return
    end

    Test(depth - 1)

end`;
    }
    else if (
      /for\s+\w+\s*=/.test(codeText) &&
      !codeText.includes("task.wait")
    ) {

      causes.push({
        percent:97,
        text:"A large for-loop is executing without yielding."
      });

      causes.push({
        percent:3,
        text:"Too much work is being performed in a single frame."
      });

      fixes.push(
        "Split the work across multiple frames using task.wait()."
      );

      example =
`for i = 1,100000 do

    if i % 500 == 0 then
        task.wait()
    end

end`;

    }

    else {

      causes.push({
        percent:90,
        text:"The script exceeded Roblox's execution time limit."
      });

      causes.push({
        percent:10,
        text:"A long-running loop or expensive operation blocked execution."
      });

      fixes.push(
        "Profile the script and insert yields during expensive operations."
      );

      example =
`task.spawn(function()

    -- Heavy work

end)`;

    }

    return {
      explanation:
        "The script exceeded Roblox's execution time limit because it continuously executed without yielding or performed too much work in a single frame.",

      causes,
      fixes,
      example,

      severity: "Critical",
      confidence: 99,

      warnings: [
        {
          title: "Execution Timeout",
          description:
            "Roblox automatically stops scripts that monopolize execution time to keep the game responsive.",
        },
      ],

      relatedErrors: [
        "DataStore request was throttled",
        "Infinite yield possible",
        "attempt to perform arithmetic on nil",
      ],

      preventionTips: [
        "Yield regularly inside long-running loops.",
        "Break heavy work into smaller chunks.",
        "Avoid infinite recursion.",
        "Use task.spawn() or task.defer() for expensive background work.",
        "Profile scripts that iterate over large collections.",
      ],

      codeInsights,
      deprecatedApis,
      performanceIssues,
      securityIssues,
    };
  },
};