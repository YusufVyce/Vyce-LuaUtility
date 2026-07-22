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

export const MEMORY_LEAK: ErrorEntry = {
  id: "roblox-memory-leak",
  title: "Memory leak detected",

  pattern:
/memory|heap|out of memory|gc overhead|memory leak|allocation/i,

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
      codeText.includes("Heartbeat:Connect") &&
      codeText.includes(":Connect(function")
    ) {

      causes.push({
        percent:99,
        text:"A new event connection is created every Heartbeat."
      });

      causes.push({
        percent:1,
        text:"Event connections continuously accumulate."
      });

      fixes.push(
        "Create event connections once instead of inside Heartbeat."
      );

      example =
`local connection

connection =
part.Touched:Connect(function()

end)`;

    }

    else if (
      codeText.includes("while true do") &&
      codeText.includes("Instance.new")
    ) {

      causes.push({
        percent:99,
        text:"New Instances are continuously created inside an infinite loop."
      });

      causes.push({
        percent:1,
        text:"Objects are allocated faster than they can be garbage collected."
      });

      fixes.push(
        "Reuse existing objects or destroy unused ones."
      );

      example =
`local part =
Instance.new("Part")

while true do

    task.wait()

    part.Position += Vector3.new(1,0,0)

end`;

    }

    else if (
      codeText.includes("task.spawn") &&
      codeText.includes("while true do")
    ) {

      causes.push({
        percent:98,
        text:"Background tasks are continuously being spawned."
      });

      causes.push({
        percent:2,
        text:"Too many concurrent threads are being created."
      });

      fixes.push(
        "Reuse workers instead of creating endless task.spawn() threads."
      );

      example =
`task.spawn(function()

    while true do

        task.wait()

    end

end)`;

    }

    else if (
      codeText.includes("table.insert") &&
      !codeText.includes("table.clear")
    ) {

      causes.push({
        percent:97,
        text:"A table keeps growing without ever being cleared."
      });

      causes.push({
        percent:3,
        text:"Unused data remains in memory."
      });

      fixes.push(
        "Periodically clear or reuse large tables."
      );

      example =
`table.clear(cache)`;

    }
    else if (
      codeText.includes(":Connect(") &&
      !codeText.includes(":Disconnect(")
    ) {

      causes.push({
        percent:98,
        text:"One or more event connections are never disconnected."
      });

      causes.push({
        percent:2,
        text:"Unused RBXScriptConnections remain alive in memory."
      });

      fixes.push(
        "Store every connection and disconnect it when it is no longer needed."
      );

      example =
`local connection

connection =
part.Touched:Connect(function()

end)

connection:Disconnect()`;

    }

    else if (
      codeText.includes("RenderStepped:Connect")
    ) {

      causes.push({
        percent:98,
        text:"RenderStepped executes every frame and may continuously allocate memory."
      });

      causes.push({
        percent:2,
        text:"Heavy work is performed every rendered frame."
      });

      fixes.push(
        "Keep RenderStepped callbacks lightweight and disconnect unused listeners."
      );

      example =
`local connection

connection =
RunService.RenderStepped:Connect(function()

end)`;

    }

    else if (
      codeText.includes("coroutine.create") &&
      codeText.includes("while true do")
    ) {

      causes.push({
        percent:97,
        text:"Coroutine workers are created without termination."
      });

      causes.push({
        percent:3,
        text:"Background threads accumulate over time."
      });

      fixes.push(
        "Reuse coroutine workers or terminate them correctly."
      );

      example =
`local thread =
coroutine.create(function()

end)`;

    }

    else {

      causes.push({
        percent:90,
        text:"The script contains code that may gradually increase memory usage."
      });

      causes.push({
        percent:10,
        text:"Objects, connections or tables are not being released."
      });

      fixes.push(
        "Profile memory usage and clean up objects, connections and cached data."
      );

      example =
`connection:Disconnect()

table.clear(cache)`;

    }

    return {
      explanation:
        "The script contains patterns commonly associated with memory leaks, excessive allocations or unreleased resources.",

      causes,
      fixes,
      example,

      severity: "High",
      confidence: 96,

      warnings: [
        {
          title: "Potential Memory Leak",
          description:
            "Memory leaks usually become noticeable only after the game has been running for a while.",
        },
      ],

      relatedErrors: [
        "Script exhausted allowed execution time",
        "HTTP 429 Too Many Requests",
        "DataStore request was throttled",
      ],

      preventionTips: [
        "Disconnect RBXScriptConnections when finished.",
        "Destroy unused Instances.",
        "Avoid creating objects every frame.",
        "Clear large tables that are no longer needed.",
        "Keep Heartbeat and RenderStepped callbacks lightweight.",
      ],

      codeInsights,
      deprecatedApis,
      performanceIssues,
      securityIssues,
    };
  },
};