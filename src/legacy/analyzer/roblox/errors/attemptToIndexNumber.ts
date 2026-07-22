import { extractVariableFlow } from "../../codeFlow";
import { tokenize } from "../../tokenizer";
import { analysis, type StaticErrorEntry } from "./shared";

export const ATTEMPT_TO_INDEX_NUMBER: StaticErrorEntry = {
  id: "roblox-index-number",
  title: "Attempt to index number",
  pattern: /attempt to index (?:a )?number value|attempt to index number(?:\s|$)/i,
  keywords: ["attempt", "index", "number", "value", "remote"],
  aliases: ["attempt to index number", "attempt to index a number value"],
  severity: "High",
  confidence: 96,
  analyze(_errorLine, codeSnippet) {
    const flows = extractVariableFlow(codeSnippet);
    const numericFlow = flows.find((flow) => /^-?\d+(?:\.\d+)?$/.test(flow.source));
    const tokens = tokenize(codeSnippet.replace(/[^A-Za-z0-9_.]/g, " "));
    return analysis(
      codeSnippet,
      `A number${numericFlow ? ` assigned to '${numericFlow.variable}'` : ""} is used as an object/table receiver. Numeric values cannot expose members such as .Value, .Name, or :Destroy().`,
      [
        {
          percent: numericFlow ? 96 : 86,
          text: numericFlow
            ? `'${numericFlow.variable}' is initialized as a number before it is indexed.`
            : "A numeric calculation or Value property result is later treated as an Instance/table.",
        },
        {
          percent: numericFlow ? 4 : 14,
          text: "A remote or function returned a number where an object was expected.",
        },
      ],
      [
        "Keep the Instance reference and its numeric value in separate variables.",
        "Validate remote/function return types with typeof() before member access.",
      ],
      'local coinsValue = leaderstats:WaitForChild("Coins")\nlocal coins = coinsValue.Value\nprint(coins)\n-- Use coinsValue.Name when an Instance member is needed.',
      "High",
      tokens.length > 0 ? 95 : 88,
    );
  },
};
