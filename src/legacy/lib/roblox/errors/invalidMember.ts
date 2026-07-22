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

export const INVALID_MEMBER: ErrorEntry = {
  id: "roblox-invalid-member",
  title: "Invalid member access",

  pattern:
/is not a valid member of/i,

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
        text:"A script attempted to access a property or child that doesn't exist."
      });

      fixes.push(
        "Paste the related code so Detector can determine why the member doesn't exist."
      );

      example =
`local character = player.Character

print(character.Humanoid)`;

    }

    else if (
      codeText.includes("WaitForChild(")
    ) {

      causes.push({
        percent:96,
        text:"The object still doesn't exist even after WaitForChild(), meaning the requested member is incorrect."
      });

      causes.push({
        percent:4,
        text:"The member name is misspelled."
      });

      fixes.push(
        "Verify the object's hierarchy and spelling."
      );

      example =
`local humanoid =
character:WaitForChild("Humanoid")

print(humanoid.Health)`;

    }

    else if (
      codeText.includes("FindFirstChild(")
    ) {

      causes.push({
        percent:95,
        text:"FindFirstChild() returned nil because the requested object doesn't exist."
      });

      causes.push({
        percent:5,
        text:"The child name is incorrect."
      });

      fixes.push(
        "Always check the FindFirstChild() result before using it."
      );

      example =
`local head =
character:FindFirstChild("Head")

if head then
    print(head.Position)
end`;

    }

    else if (
      codeText.includes(".Character")
    ) {

      causes.push({
        percent:97,
        text:"The player's Character has not loaded yet."
      });

      causes.push({
        percent:3,
        text:"The script is running before CharacterAdded."
      });

      fixes.push(
        "Wait for CharacterAdded before accessing Character members."
      );

      example =
`local character =
player.Character
or player.CharacterAdded:Wait()`;
    }
    else if (
      codeText.includes(".Humanoid")
    ) {

      causes.push({
        percent:97,
        text:"The Humanoid object doesn't exist under the current instance."
      });

      causes.push({
        percent:3,
        text:"The script is accessing the wrong parent object."
      });

      fixes.push(
        "Verify the object is actually a character model before accessing Humanoid."
      );

      example =
`local humanoid =
character:WaitForChild("Humanoid")

print(humanoid.Health)`;

    }

    else if (
      codeText.includes(".PrimaryPart")
    ) {

      causes.push({
        percent:96,
        text:"PrimaryPart has not been assigned for this model."
      });

      causes.push({
        percent:4,
        text:"The script expects a model but received another instance type."
      });

      fixes.push(
        "Assign the model's PrimaryPart before using it."
      );

      example =
`model.PrimaryPart = model:WaitForChild("HumanoidRootPart")

model:PivotTo(CFrame.new(0,5,0))`;

    }

    else if (
      codeText.includes("PlayerGui")
    ) {

      causes.push({
        percent:95,
        text:"PlayerGui is unavailable because the script is running on the server or using the wrong object."
      });

      causes.push({
        percent:5,
        text:"The LocalPlayer reference is invalid."
      });

      fixes.push(
        "Only access PlayerGui from a LocalScript using LocalPlayer."
      );

      example =
`local player =
game.Players.LocalPlayer

local gui =
player:WaitForChild("PlayerGui")`;

    }

    else if (
      codeText.includes(":FireServer(")
    ) {

      causes.push({
        percent:96,
        text:"FireServer() is being called on an object that is not a RemoteEvent."
      });

      causes.push({
        percent:4,
        text:"The RemoteEvent variable is nil."
      });

      fixes.push(
        "Verify the object is actually a RemoteEvent before calling FireServer()."
      );

      example =
`local remote =
ReplicatedStorage:WaitForChild("DamageEvent")

remote:FireServer(25)`;

    }

    else {

      causes.push({
        percent:88,
        text:"The requested property or child does not exist on this Roblox object."
      });

      causes.push({
        percent:12,
        text:"The object type is different than expected."
      });

      fixes.push(
        "Verify the object's class and hierarchy before accessing its members."
      );

      fixes.push(
        "Use WaitForChild() or FindFirstChild() when appropriate."
      );

      example =
`print(instance.ClassName)

print(instance:GetFullName())`;
    }
    return {
      explanation:
        "A script attempted to access a property, method or child that doesn't exist on the current Roblox object.",

      causes,
      fixes,
      example,

      severity: "High",
      confidence: 96,

      warnings: [
        {
          title: "Invalid Member Access",
          description:
            "This error usually means the object type, hierarchy or execution timing is different than expected.",
        },
      ],

      relatedErrors: [
        "attempt to index nil with",
        "invalid argument",
        "attempt to call a nil value",
        "infinite yield possible on",
      ],

      preventionTips: [
        "Use WaitForChild() for replicated objects.",
        "Check FindFirstChild() results before indexing.",
        "Verify the object's ClassName before accessing members.",
        "Use CharacterAdded when working with player characters.",
        "Print GetFullName() while debugging object hierarchy.",
      ],

      codeInsights,
      deprecatedApis,
      performanceIssues,
      securityIssues,
    };
  },
};