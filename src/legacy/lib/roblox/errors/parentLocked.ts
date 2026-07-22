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

export const PARENT_LOCKED: ErrorEntry = {
  id: "roblox-parent-locked",
  title: "Parent property is locked",

  pattern:
/the parent property of .* is locked|parent property is locked/i,

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
      codeText.includes(":Destroy(")
    ) {

      causes.push({
        percent:99,
        text:"The instance was destroyed before attempting to change its Parent."
      });

      causes.push({
        percent:1,
        text:"The reference still points to a destroyed object."
      });

      fixes.push(
        "Do not reuse destroyed instances."
      );

      example =
`local part = workspace.Part

part:Destroy()

part = nil`;

    }

    else if (
      codeText.includes(".Parent =")
    ) {

      causes.push({
        percent:97,
        text:"The instance belongs to a locked Roblox container."
      });

      causes.push({
        percent:3,
        text:"The object is being re-parented while Roblox owns its lifecycle."
      });

      fixes.push(
        "Clone the object or wait until Roblox finishes managing it."
      );

      example =
`local clone = object:Clone()

clone.Parent = workspace`;

    }

    else if (
      codeText.includes("Character")
    ) {

      causes.push({
        percent:96,
        text:"The player's Character is being modified while Roblox is replacing or removing it."
      });

      causes.push({
        percent:4,
        text:"The Character reference is no longer valid."
      });

      fixes.push(
        "Wait for CharacterAdded before modifying the new character."
      );

      example =
`player.CharacterAdded:Wait()

local character = player.Character`;
    }
    else if (
      codeText.includes("Backpack")
    ) {

      causes.push({
        percent:97,
        text:"The Backpack or one of its contents is managed by Roblox and cannot be re-parented at this moment."
      });

      causes.push({
        percent:3,
        text:"The Tool is being moved while Roblox is equipping or unequipping it."
      });

      fixes.push(
        "Wait until the Tool has finished equipping or clone it before changing its parent."
      );

      example =
`local tool = player.Backpack:WaitForChild("Sword")

local clone = tool:Clone()

clone.Parent = workspace`;

    }

    else if (
      codeText.includes("PlayerGui")
    ) {

      causes.push({
        percent:97,
        text:"PlayerGui is being modified while Roblox is rebuilding the player's interface."
      });

      causes.push({
        percent:3,
        text:"The GUI is parented before the PlayerGui is ready."
      });

      fixes.push(
        "Wait for PlayerGui before inserting GUI objects."
      );

      example =
`local gui =
player:WaitForChild("PlayerGui")

screenGui.Parent = gui`;

    }

    else {

      causes.push({
        percent:92,
        text:"Roblox prevented the Parent property from being modified because the instance is locked."
      });

      causes.push({
        percent:8,
        text:"The object is currently owned or managed internally by Roblox."
      });

      fixes.push(
        "Clone the object or wait until Roblox finishes modifying it."
      );

      example =
`local clone =
instance:Clone()

clone.Parent = workspace`;

    }

    return {
      explanation:
        "Roblox blocked the Parent assignment because the instance is currently locked or managed by the engine.",

      causes,
      fixes,
      example,

      severity: "High",
      confidence: 98,

      warnings: [
        {
          title: "Locked Instance",
          description:
            "Some Roblox objects cannot be re-parented while the engine controls their lifecycle.",
        },
      ],

      relatedErrors: [
        "attempt to index nil with",
        "attempt to call a nil value",
        "invalid argument",
        "Parent property is locked",
      ],

      preventionTips: [
        "Never reuse destroyed instances.",
        "Clone objects before moving them.",
        "Wait for CharacterAdded before editing characters.",
        "Wait for PlayerGui before parenting UI.",
        "Avoid changing the parent of engine-managed objects.",
      ],

      codeInsights,
      deprecatedApis,
      performanceIssues,
      securityIssues,
    };
  },
};