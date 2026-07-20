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

export const DATASTORE_ERROR: ErrorEntry = {
  id: "roblox-datastore",
  title: "DataStore error",

  pattern:
    /datastore|getasync failed|setasync failed|updateasync failed|request was throttled|request was added to queue|studioaccesstoapisnotallowed|invalid utf-8|key name exceeds maximum length|cannot store/i,

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


    if (/studioaccesstoapisnotallowed/i.test(logText)) {

      causes.push({
        percent: 99,
        text: "API access is not enabled in Roblox Studio. DataStore calls require API access to be enabled.",
      });

      causes.push({
        percent: 1,
        text: "Studio security settings are blocking external requests.",
      });

      fixes.push(
        "Open Game Settings → Security → Enable Studio Access to API Services."
      );

      example =
`-- In Roblox Studio:
-- Game Settings → Security →
-- Enable "Allow HTTP Requests" and
-- "Enable Studio Access to API Services"`;

    }

    else if (/too many requests|request was throttled/i.test(logText)) {

      causes.push({
        percent:98,
        text:"Too many DataStore requests are being sent."
      });

      causes.push({
        percent:2,
        text:"Save requests are happening too frequently."
      });

      fixes.push(
        "Batch DataStore operations and reduce request frequency."
      );

      example =
`task.wait(6)

DataStore:SetAsync(key,data)`;

    }

    else if (/request was added to queue/i.test(logText)) {

      causes.push({
        percent:97,
        text:"The DataStore request limit has temporarily been reached."
      });

      causes.push({
        percent:3,
        text:"Roblox queued the request automatically."
      });

      fixes.push(
        "Avoid saving every frame or every player action."
      );

      example =
`Save every 30-60 seconds
instead of every change.`;

    }

    else if (/invalid utf-8/i.test(logText)) {

      causes.push({
        percent:99,
        text:"The value being saved contains invalid UTF-8 characters."
      });

      causes.push({
        percent:1,
        text:"Corrupted or unsupported text is being stored."
      });

      fixes.push(
        "Validate and sanitize strings before saving."
      );

      example =
`text = tostring(text)`;

    }
    else if (/cannot store/i.test(logText)) {

      causes.push({
        percent:99,
        text:"The value being saved contains an unsupported data type."
      });

      causes.push({
        percent:1,
        text:"Instances, userdata or unsupported objects cannot be stored."
      });

      fixes.push(
        "Store only numbers, strings, booleans, tables and nil."
      );

      example =
`local data = {
    Coins = 100,
    Level = 5
}

DataStore:SetAsync(key,data)`;

    }

    else if (/getasync failed/i.test(logText)) {

      causes.push({
        percent:97,
        text:"GetAsync() failed because Roblox couldn't retrieve the requested key."
      });

      causes.push({
        percent:3,
        text:"The service may be temporarily unavailable."
      });

      fixes.push(
        "Wrap GetAsync() inside pcall() and retry if necessary."
      );

      example =
`local success,data =
pcall(function()
    return Store:GetAsync(key)
end)`;

    }

    else if (/setasync failed/i.test(logText)) {

      causes.push({
        percent:97,
        text:"SetAsync() failed while attempting to save data."
      });

      causes.push({
        percent:3,
        text:"The request exceeded limits or Roblox returned an internal error."
      });

      fixes.push(
        "Always call SetAsync() inside pcall()."
      );

      example =
`pcall(function()
    Store:SetAsync(key,data)
end)`;

    }

    else if (/updateasync failed/i.test(logText)) {

      causes.push({
        percent:97,
        text:"UpdateAsync() failed during the update callback."
      });

      causes.push({
        percent:3,
        text:"The callback returned an invalid value."
      });

      fixes.push(
        "Return valid data from the UpdateAsync callback."
      );

      example =
`Store:UpdateAsync(key,function(old)

    old = old or {}

    return old

end)`;

    }

    else if (/key name exceeds maximum length/i.test(logText)) {

      causes.push({
        percent:99,
        text:"The DataStore key is longer than Roblox allows."
      });

      causes.push({
        percent:1,
        text:"A generated key became excessively long."
      });

      fixes.push(
        "Use short, unique key names."
      );

      example =
`local key =
"Player_" .. player.UserId`;

    }

    else {

      causes.push({
        percent:90,
        text:"A DataStore operation failed."
      });

      causes.push({
        percent:10,
        text:"Roblox rejected the request due to configuration or service limitations."
      });

      fixes.push(
        "Wrap all DataStore operations in pcall() and inspect the returned error."
      );

      example =
`local success,result =
pcall(function()

    return Store:GetAsync(key)

end)`;

    }

    return enrichAnalysis({
      explanation:
        "A DataStore operation failed. The issue may be caused by API configuration, request limits, invalid data, or a temporary Roblox service problem.",

      causes,
      fixes,
      example,

      severity: "High",
      confidence: 98,

      warnings: [
        {
          title: "Persistent Data",
          description:
            "Always assume DataStore operations can fail and handle failures gracefully.",
        },
      ],

      relatedErrors: [
        "invalid argument",
        "module code did not return exactly one value",
        "attempt to index nil with",
      ],

      preventionTips: [
        "Always use pcall() for DataStore operations.",
        "Never save Instances or userdata.",
        "Throttle save requests.",
        "Use UpdateAsync for frequently changing data.",
        "Keep DataStore keys short and deterministic.",
      ],

      codeInsights,
      deprecatedApis,
      performanceIssues,
      securityIssues,
    }, logText, codeText);
  },
};