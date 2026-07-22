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

export const CANNOT_CAST: ErrorEntry = {
  id: "roblox-cannot-cast",
  title: "Type casting error",

  pattern:
/cannot cast|unable to cast|expected .* got|cannot convert/i,

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

    if (/vector3/i.test(logText)) {

      causes.push({
        percent:99,
        text:"A Vector3 value was expected but another type was provided."
      });

      fixes.push(
        "Convert the value to a Vector3 before calling the API."
      );

      example =
`part.Position =
Vector3.new(0,10,0)`;

    }

    else if (/cframe/i.test(logText)) {

      causes.push({
        percent:99,
        text:"A CFrame was expected but another value was supplied."
      });

      fixes.push(
        "Pass a valid CFrame object."
      );

      example =
`part.CFrame =
CFrame.new(0,5,0)`;

    }

    else if (/instance/i.test(logText)) {

      causes.push({
        percent:98,
        text:"An Instance was expected but another type was passed."
      });

      fixes.push(
        "Verify the variable references a Roblox Instance."
      );

      example =
`local part =
workspace:WaitForChild("Part")`;

    }

    else if (/number/i.test(logText)) {

      causes.push({
        percent:98,
        text:"A numeric value was expected."
      });

      fixes.push(
        "Convert the value using tonumber() if necessary."
      );

      example =
`local value =
tonumber(text)`;

    }

    else if (/string/i.test(logText)) {

      causes.push({
        percent:98,
        text:"A string value was expected."
      });

      fixes.push(
        "Convert the value using tostring()."
      );

      example =
`tostring(value)`;

    }
    else if (/boolean|bool/i.test(logText)) {

      causes.push({
        percent:98,
        text:"A boolean value was expected."
      });

      fixes.push(
        "Return either true or false instead of another type."
      );

      example =
`local enabled = true`;

    }

    else if (/enum/i.test(logText)) {

      causes.push({
        percent:99,
        text:"An Enum value was expected."
      });

      fixes.push(
        "Pass a valid Roblox Enum item."
      );

      example =
`part.Material =
Enum.Material.Plastic`;

    }

    else if (/color3/i.test(logText)) {

      causes.push({
        percent:99,
        text:"A Color3 value was expected."
      });

      fixes.push(
        "Create the value using Color3.new() or Color3.fromRGB()."
      );

      example =
`part.Color =
Color3.fromRGB(255,0,0)`;

    }

    else if (/udim2/i.test(logText)) {

      causes.push({
        percent:99,
        text:"A UDim2 value was expected."
      });

      fixes.push(
        "Create the value using UDim2.new() or UDim2.fromScale()."
      );

      example =
`frame.Size =
UDim2.fromScale(1,1)`;

    }

    else {

      causes.push({
        percent:90,
        text:"A Roblox API received a value of the wrong type."
      });

      causes.push({
        percent:10,
        text:"The variable doesn't match the type expected by the API."
      });

      fixes.push(
        "Check the API documentation and verify every argument's type using typeof()."
      );

      example =
`print(typeof(value))`;

    }

    return {
      explanation:
        "A Roblox API rejected one or more values because their types don't match the expected parameter types.",

      causes,
      fixes,
      example,

      severity: "Medium",
      confidence: 97,

      warnings: [
        {
          title: "Type Mismatch",
          description:
            "Most casting errors are caused by passing the wrong value type to a Roblox API.",
        },
      ],

      relatedErrors: [
        "invalid argument",
        "attempt to perform arithmetic on nil",
        "attempt to index nil with",
      ],

      preventionTips: [
        "Use typeof() while debugging.",
        "Validate function arguments before calling Roblox APIs.",
        "Convert values with tonumber() or tostring() when appropriate.",
        "Read the API reference to confirm expected parameter types.",
      ],

      codeInsights,
      deprecatedApis,
      performanceIssues,
      securityIssues,
    };
  },
};