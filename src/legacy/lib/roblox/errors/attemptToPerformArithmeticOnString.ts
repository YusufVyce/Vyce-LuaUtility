import { collectRobloxDiagnostics } from "../../analyzer/robloxDiagnostics";
import type { Cause, ErrorEntry } from "../../types";

export const ARITHMETIC_ON_STRING: ErrorEntry = {
  id: "roblox-arithmetic-on-string",
  title: "Attempt to perform arithmetic on string",
  pattern:
    /attempt to perform arithmetic.*string|attempt to (?:add|subtract|multiply|divide).*string/i,
  keywords: ["attempt", "arithmetic", "string", "number", "tonumber", "textbox", "text", "value"],
  aliases: [
    "attempt to perform arithmetic on string",
    "attempt to perform arithmetic on a string value",
    "arithmetic string",
  ],
  analyze(_logText, codeText) {
    const causes: Cause[] = [];
    const fixes: string[] = [];
    const diagnostics = collectRobloxDiagnostics(codeText);
    let example = "";
    if (!codeText) {
      causes.push(
        { percent: 91, text: "Text is being used as a number in an arithmetic expression." },
        { percent: 9, text: "Input conversion failed or was skipped." },
      );
      fixes.push("Convert external text with tonumber() and reject invalid input.");
      example =
        "local amount = tonumber(amountText)\nif amount then\n    coins.Value += amount\nend";
    } else if (codeText.includes("TextBox") || codeText.includes(".Text")) {
      causes.push(
        { percent: 94, text: "TextBox.Text is always a string, even when it contains digits." },
        { percent: 6, text: "The input is empty or includes non-numeric characters." },
      );
      fixes.push(
        "Use tonumber(textBox.Text), validate the result, and enforce server-side validation for client-provided values.",
      );
      example =
        "local amount = tonumber(amountBox.Text)\nif not amount or amount < 1 then return end\nrequestPurchase:FireServer(amount)";
    } else if (codeText.includes("GetAsync(") || codeText.includes("DataStore")) {
      causes.push(
        {
          percent: 88,
          text: "Persisted data is stored or loaded as text while the game expects a number.",
        },
        { percent: 12, text: "Older saved data has a different schema." },
      );
      fixes.push(
        "Validate DataStore data after pcall and migrate strings with tonumber() before calculating.",
      );
      example =
        "local success, saved = pcall(function() return store:GetAsync(player.UserId) end)\nlocal coins = success and tonumber(saved) or 0";
    } else {
      causes.push(
        {
          percent: 84,
          text: "A string variable or formatted API result is used with a numeric operator.",
        },
        { percent: 16, text: "A function returns text on one code path and a number on another." },
      );
      fixes.push(
        "Inspect operand types with typeof() and preserve numeric values until presentation time.",
      );
      example =
        'local result = tonumber(value)\nassert(result, "Expected a numeric value")\nprint(result + 1)';
    }
    return {
      explanation:
        "An arithmetic operator received a string. Convert validated numeric text to a number before calculating.",
      causes,
      fixes,
      example,
      severity: "High",
      confidence: 96,
      ...diagnostics,
    };
  },
};
