import { collectRobloxDiagnostics } from "../../analyzer/robloxDiagnostics";
import type { Cause, ErrorEntry } from "../../types";

export const ARITHMETIC_ON_BOOLEAN: ErrorEntry = {
  id: "roblox-arithmetic-on-boolean",
  title: "Attempt to perform arithmetic on boolean",
  pattern:
    /attempt to perform arithmetic.*boolean|attempt to (?:add|subtract|multiply|divide).*boolean/i,
  keywords: ["attempt", "arithmetic", "boolean", "true", "false", "number", "attribute", "value"],
  aliases: [
    "attempt to perform arithmetic on boolean",
    "attempt to perform arithmetic on a boolean value",
    "arithmetic boolean",
  ],
  analyze(_logText, codeText) {
    const causes: Cause[] = [];
    const fixes: string[] = [];
    const diagnostics = collectRobloxDiagnostics(codeText);
    let example = "";
    if (!codeText) {
      causes.push(
        { percent: 92, text: "true or false is being used where Lua expects a number." },
        { percent: 8, text: "A conditional expression was assigned to a numeric variable." },
      );
      fixes.push(
        "Keep boolean state separate from numeric counters; convert deliberately only when appropriate.",
      );
      example =
        "local isDoubleDamage = true\nlocal multiplier = isDoubleDamage and 2 or 1\nlocal damage = baseDamage * multiplier";
    } else if (codeText.includes("GetAttribute(")) {
      causes.push(
        {
          percent: 91,
          text: "An Attribute read as a boolean is being added, multiplied, or otherwise used as a number.",
        },
        { percent: 9, text: "The attribute was created with the wrong value type." },
      );
      fixes.push(
        "Store numeric attributes for arithmetic, or map a boolean to a numeric multiplier explicitly.",
      );
      example =
        'local boosted = player:GetAttribute("Boosted") == true\nlocal multiplier = boosted and 2 or 1\ncoins.Value += reward * multiplier';
    } else if (codeText.includes("Value")) {
      causes.push(
        { percent: 89, text: "A BoolValue.Value was used in a numeric calculation." },
        { percent: 11, text: "The wrong ValueBase instance was referenced." },
      );
      fixes.push(
        "Use an IntValue or NumberValue for quantities, and use BoolValue only for state.",
      );
      example =
        'local enabled = settings:WaitForChild("DoubleXP").Value\nlocal multiplier = enabled and 2 or 1\nexperience.Value += amount * multiplier';
    } else {
      causes.push(
        {
          percent: 84,
          text: "A comparison result or boolean flag is participating in arithmetic.",
        },
        {
          percent: 16,
          text: "A function documented as returning a number is returning a boolean on one branch.",
        },
      );
      fixes.push(
        "Use typeof(value) to verify the operand and return the same type from every function branch.",
      );
      example = "local amount = tonumber(input)\nif amount then\n    total += amount\nend";
    }
    return {
      explanation:
        "An arithmetic operator received a boolean. Roblox Lua does not automatically convert true/false into 1/0.",
      causes,
      fixes,
      example,
      severity: "High",
      confidence: 96,
      ...diagnostics,
    };
  },
};
