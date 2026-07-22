import { extractVariableFlow } from "../../codeFlow";
import { tokenize } from "../../tokenizer";
import { analysis, type StaticErrorEntry } from "./shared";

export const NOT_A_FUNCTION: StaticErrorEntry = {
  id: "roblox-not-a-function",
  title: "Passed value is not a function",
  pattern: /passed value is not a function/i,
  keywords: ["passed", "value", "function", "connect", "event"],
  aliases: ["passed value is not a function", "value is not a function"],
  severity: "High",
  confidence: 97,
  analyze(_errorLine, codeSnippet) {
    const flows = extractVariableFlow(codeSnippet);
    const tokens = tokenize(codeSnippet.replace(/([():,])/g, " $1 "));
    const connectCall = /:Connect\s*\(\s*([A-Za-z_]\w*)\s*\(.*?\)\s*\)/.exec(codeSnippet);
    if (connectCall) {
      return analysis(
        codeSnippet,
        `':Connect(${connectCall[1]}())' calls '${connectCall[1]}' immediately and passes its return value to Connect. Connect requires the function itself, not the result of calling it.`,
        [
          {
            percent: 99,
            text: `The callback '${connectCall[1]}' has parentheses inside Connect().`,
          },
          { percent: 1, text: "The called function returns a non-function value." },
        ],
        [
          "Remove the callback call parentheses.",
          "Pass arguments through an anonymous callback when needed.",
        ],
        `event:Connect(${connectCall[1]})\n\n-- With arguments:\nevent:Connect(function(...)\n    ${connectCall[1]}(...)\nend)`,
        "High",
        99,
      );
    }
    const hasConnect = tokens.includes("Connect") || codeSnippet.includes(":Connect(");
    return analysis(
      codeSnippet,
      hasConnect
        ? "Event:Connect received a value rather than a callback function."
        : "A Roblox callback API received a non-function value.",
      [
        {
          percent: hasConnect ? 94 : 85,
          text: hasConnect
            ? "The argument passed to :Connect is not a function reference."
            : "A callback argument was evaluated or overwritten before registration.",
        },
        {
          percent: hasConnect ? 6 : 15,
          text: "The callback variable is nil or stores another type.",
        },
      ],
      [
        "Pass a function reference or an anonymous function to Connect.",
        "Check callback variables with typeof(callback) == 'function' before registration.",
      ],
      "event:Connect(function(player)\n    handlePlayer(player)\nend)",
      "High",
      flows.length > 0 ? 96 : 90,
    );
  },
};
