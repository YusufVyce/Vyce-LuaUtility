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

export const INVALID_ARGUMENT: ErrorEntry = {
  id: "roblox-invalid-argument",
  title: "Invalid argument",
  pattern: /invalid argument #?\d*/i,

  analyze(logText, codeText) {
    const argMatch = logText.match(/invalid argument #(\d+)/i);

    const argumentNumber = argMatch ? argMatch[1] : "?";

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
        text: `Argument #${argumentNumber} has an invalid type or value. Add the related script for a more accurate analysis.`,
      });

      fixes.push(
        "Paste the related code so Detector can identify which API received the invalid argument."
      );

      example =
`-- Example

workspace:FindFirstChild("Part")`;
    }

    else if (
      codeText.includes("FindFirstChild(")
    ) {

      causes.push({
        percent: 96,
        text: "FindFirstChild() received an invalid argument. It expects a string containing the object's name.",
      });

      causes.push({
        percent: 4,
        text: "The variable passed into FindFirstChild() is nil or another unsupported type.",
      });

      fixes.push(
        "Pass a valid string to FindFirstChild()."
      );

      fixes.push(
        "Use tostring() if the value may not already be a string."
      );

      example =
`local part = workspace:FindFirstChild("Part")

if part then
    print(part.Name)
end`;
    }

    else if (
      codeText.includes("WaitForChild(")
    ) {

      causes.push({
        percent: 94,
        text: "WaitForChild() expects the first argument to be a string.",
      });

      causes.push({
        percent: 6,
        text: "The variable passed into WaitForChild() is nil.",
      });

      fixes.push(
        "Verify the first parameter is a string."
      );

      example =
`local folder = workspace:WaitForChild("Folder",5)`;
    }

    else if (
      codeText.includes("Instance.new(")
    ) {

      causes.push({
        percent: 98,
        text: "Instance.new() received an invalid class name.",
      });

      causes.push({
        percent: 2,
        text: "The class name variable contains an unsupported value.",
      });

      fixes.push(
        "Use a valid Roblox class name such as 'Part', 'Folder' or 'Model'."
      );

      example =
`local part = Instance.new("Part")
part.Parent = workspace`;
    }
    else if (
      codeText.includes("TweenService:Create(")
    ) {

      causes.push({
        percent: 95,
        text: "TweenService:Create() received an invalid argument. One of the parameters has the wrong type.",
      });

      causes.push({
        percent: 5,
        text: "The TweenInfo, Instance or property table is invalid.",
      });

      fixes.push(
        "Verify the object, TweenInfo and goal table passed into TweenService:Create()."
      );

      example =
`local TweenService = game:GetService("TweenService")

local tween = TweenService:Create(
    part,
    TweenInfo.new(1),
    { Transparency = 1 }
)

tween:Play()`;
    }

    else if (
      codeText.includes("Vector3.new(")
    ) {

      causes.push({
        percent: 97,
        text: "Vector3.new() only accepts numeric values.",
      });

      causes.push({
        percent: 3,
        text: "One of the Vector3 parameters is nil or a string.",
      });

      fixes.push(
        "Convert values using tonumber() before creating the Vector3."
      );

      example =
`local position = Vector3.new(
    tonumber(x),
    tonumber(y),
    tonumber(z)
)`;
    }

    else if (
      codeText.includes("Color3.new(")
    ) {

      causes.push({
        percent: 96,
        text: "Color3.new() expects numeric RGB values.",
      });

      causes.push({
        percent: 4,
        text: "A Color3 parameter is nil or not a number.",
      });

      fixes.push(
        "Ensure every Color3.new() argument is a valid number."
      );

      example =
`local color = Color3.new(
    1,
    0,
    0
)`;
    }

    else if (
      codeText.includes("CFrame.new(")
    ) {

      causes.push({
        percent: 95,
        text: "CFrame.new() received invalid coordinates.",
      });

      causes.push({
        percent: 5,
        text: "One or more CFrame parameters are nil.",
      });

      fixes.push(
        "Validate every coordinate before creating the CFrame."
      );

      example =
`local cf = CFrame.new(
    x,
    y,
    z
)`;
    }

    else if (
      codeText.includes("Enum.")
    ) {

      causes.push({
        percent: 93,
        text: "An invalid Enum item was provided.",
      });

      causes.push({
        percent: 7,
        text: "The Enum name is misspelled or doesn't exist.",
      });

      fixes.push(
        "Check the Enum spelling and verify the item exists."
      );

      example =
`part.Material = Enum.Material.Plastic`;
    }

    else {

      causes.push({
        percent: 80,
        text: "A Roblox API received an argument of the wrong type or value.",
      });

      causes.push({
        percent: 20,
        text: "The variable passed into the function is nil or uninitialized.",
      });

      fixes.push(
        "Verify every argument before calling the Roblox API."
      );

      example =
`print(typeof(value))

assert(value ~= nil)

SomeFunction(value)`;
    }
    return {
      explanation: `Roblox rejected argument #${argumentNumber} because its type or value is invalid for the API being called.`,

      causes,
      fixes,
      example,

      severity: "Medium",
      confidence: 93,

      codeInsights,
      deprecatedApis,

      performanceIssues,
      securityIssues,
    };
  },
};