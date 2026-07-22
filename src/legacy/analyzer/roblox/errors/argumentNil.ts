import { extractVariableFlow } from "../../codeFlow";
import { tokenize } from "../../tokenizer";
import { analysis, type StaticErrorEntry } from "./shared";

export const ARGUMENT_NIL: StaticErrorEntry = {
  id: "roblox-argument-nil",
  title: "Required argument is missing or nil",
  pattern: /argument #?\d+ (?:missing or nil|is missing or nil)|bad argument #?\d+.*nil/i,
  keywords: ["argument", "missing", "nil", "function"],
  aliases: ["argument missing or nil", "bad argument nil"],
  severity: "High",
  confidence: 95,
  analyze(errorLine, codeSnippet) {
    const flows = extractVariableFlow(codeSnippet);
    const tokens = tokenize(codeSnippet.replace(/[^A-Za-z0-9_:.]/g, " "));
    const number = errorLine.match(/argument #?(\d+)/i)?.[1] || "required";
    const nilFlow = flows.find((flow) => flow.source === "nil");
    return analysis(
      codeSnippet,
      `Argument #${number} is nil or absent at the API call. The called function requires a value in that parameter position.`,
      [
        {
          percent: nilFlow ? 98 : 90,
          text: nilFlow
            ? `'${nilFlow.variable}' is explicitly assigned nil before it is passed.`
            : "A function result, optional lookup, or omitted argument is passed to a required parameter.",
        },
        {
          percent: nilFlow ? 2 : 10,
          text: "The caller and function signature use different argument orders.",
        },
      ],
      [
        "Validate the argument at the call site and return early when it is nil.",
        "Use the API's required type/value instead of a default unless that default is valid.",
      ],
      'local part = workspace:FindFirstChild("Target")\nif not part then return end\nTweenService:Create(part, TweenInfo.new(1), { Transparency = 1 }):Play()',
      "High",
      tokens.length > 0 ? 95 : 88,
    );
  },
};
