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

export const REMOTE_NETWORKING: ErrorEntry = {
  id: "roblox-remote-networking",
  title: "Remote networking error",

  pattern:
    /fireserver can only be called from the client|fireclient can only be called from the server|onserverevent can only be used on the server|onclientevent can only be used on the client|invokeserver can only be called from the client|invokeclient can only be called from the server|remoteevent|remotefunction/i,

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

    if (/fireserver can only be called from the client/i.test(logText)) {

      causes.push({
        percent:99,
        text:"FireServer() was called from a server Script instead of a LocalScript."
      });

      causes.push({
        percent:1,
        text:"The networking architecture is reversed."
      });

      fixes.push(
        "Move FireServer() into a LocalScript."
      );

      example =
`-- LocalScript

Remote:FireServer(data)`;

    }

    else if (/fireclient can only be called from the server/i.test(logText)) {

      causes.push({
        percent:99,
        text:"FireClient() was called from a LocalScript."
      });

      causes.push({
        percent:1,
        text:"The RemoteEvent direction is incorrect."
      });

      fixes.push(
        "Call FireClient() only from a server Script."
      );

      example =
`-- Script

Remote:FireClient(player,data)`;

    }

    else if (/onserverevent can only be used on the server/i.test(logText)) {

      causes.push({
        percent:98,
        text:"OnServerEvent was connected inside a LocalScript."
      });

      causes.push({
        percent:2,
        text:"The event listener is running on the wrong side."
      });

      fixes.push(
        "Move the OnServerEvent connection into a normal Script."
      );

      example =
`Remote.OnServerEvent:Connect(function(player)

end)`;

    }

    else if (/onclientevent can only be used on the client/i.test(logText)) {

      causes.push({
        percent:98,
        text:"OnClientEvent was connected inside a server Script."
      });

      causes.push({
        percent:2,
        text:"The listener belongs inside a LocalScript."
      });

      fixes.push(
        "Use OnClientEvent only inside LocalScripts."
      );

      example =
`Remote.OnClientEvent:Connect(function(data)

end)`;

    }
    else if (/invokeserver can only be called from the client/i.test(logText)) {

      causes.push({
        percent:99,
        text:"InvokeServer() was called from a server Script."
      });

      causes.push({
        percent:1,
        text:"InvokeServer() only works inside LocalScripts."
      });

      fixes.push(
        "Move InvokeServer() into a LocalScript."
      );

      example =
`local result =
Remote:InvokeServer(data)`;

    }

    else if (/invokeclient can only be called from the server/i.test(logText)) {

      causes.push({
        percent:99,
        text:"InvokeClient() was called from a LocalScript."
      });

      causes.push({
        percent:1,
        text:"InvokeClient() only works inside server Scripts."
      });

      fixes.push(
        "Move InvokeClient() into a server Script."
      );

      example =
`local result =
Remote:InvokeClient(player,data)`;

    }

    else if (
      codeText.includes(":FireServer(") &&
      codeText.includes("RemoteFunction")
    ) {

      causes.push({
        percent:97,
        text:"FireServer() is being called on a RemoteFunction."
      });

      causes.push({
        percent:3,
        text:"RemoteEvent and RemoteFunction were mixed up."
      });

      fixes.push(
        "Use InvokeServer() with RemoteFunction or change the object to a RemoteEvent."
      );

      example =
`local result =
RemoteFunction:InvokeServer(data)`;

    }

    else if (
      codeText.includes(":InvokeServer(") &&
      codeText.includes("RemoteEvent")
    ) {

      causes.push({
        percent:97,
        text:"InvokeServer() is being called on a RemoteEvent."
      });

      causes.push({
        percent:3,
        text:"The wrong remote class is being used."
      });

      fixes.push(
        "Use FireServer() with RemoteEvent or convert it to a RemoteFunction."
      );

      example =
`RemoteEvent:FireServer(data)`;

    }

    else {

      causes.push({
        percent:88,
        text:"The networking API is being used from the wrong execution context."
      });

      causes.push({
        percent:12,
        text:"The Remote object or execution side is incorrect."
      });

      fixes.push(
        "Verify whether the code runs on the client or server."
      );

      fixes.push(
        "Check whether the object is a RemoteEvent or RemoteFunction."
      );

      example =
`local Remote =
ReplicatedStorage:WaitForChild("Remote")`;

    }

    return {
      explanation:
        "A Roblox networking API is being used incorrectly. RemoteEvents and RemoteFunctions have strict client/server execution rules.",

      causes,
      fixes,
      example,

      severity: "High",
      confidence: 98,

      warnings: [
        {
          title: "Networking Context Error",
          description:
            "Remote APIs only work on their intended execution side (client or server).",
        },
      ],

      relatedErrors: [
        "invalid argument",
        "attempt to call a nil value",
        "requested module experienced an error while loading",
      ],

      preventionTips: [
        "Keep client and server logic separated.",
        "Use RemoteEvent for one-way communication.",
        "Use RemoteFunction only when a response is required.",
        "Store remotes inside ReplicatedStorage.",
      ],

      codeInsights,
      deprecatedApis,
      performanceIssues,
      securityIssues,
    };
  },
};