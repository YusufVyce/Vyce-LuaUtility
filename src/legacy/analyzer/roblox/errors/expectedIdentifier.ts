import { extractVariableFlow } from "../../codeFlow";
import { tokenize } from "../../tokenizer";
import { analysis, type StaticErrorEntry } from "./shared";

export const EXPECTED_IDENTIFIER: StaticErrorEntry = {
  id: "luau-expected-identifier",
  title: "Expected identifier when parsing expression",
  pattern: /expected identifier when parsing expression/i,
  keywords: ["expected", "identifier", "parsing", "expression"],
  aliases: ["expected identifier when parsing expression"],
  severity: "High",
  confidence: 94,
  analyze(_errorLine, codeSnippet) {
    const flows = extractVariableFlow(codeSnippet);
    const tokens = tokenize(codeSnippet.replace(/([=,(){}])/g, " $1 "));
    const invalidDot = /\.\s*(?:\.|\)|\]|,|=|$)/m.test(codeSnippet);
    const keywordAfterDot = /\.(?:local|function|end|then|do)\b/.test(codeSnippet);
    return analysis(
      codeSnippet,
      invalidDot || keywordAfterDot
        ? "A dot member expression is missing a legal identifier after '.'. Luau encountered punctuation or a keyword where a variable/property name is required."
        : "Luau found invalid expression syntax where an identifier was required; inspect the exact reported line for a missing name, comma, or malformed member access.",
      [
        {
          percent: invalidDot || keywordAfterDot ? 97 : 86,
          text:
            invalidDot || keywordAfterDot
              ? "The snippet contains malformed dot access."
              : "An expression has a missing identifier or invalid token sequence.",
        },
        {
          percent: invalidDot || keywordAfterDot ? 3 : 14,
          text: "A generated string/template inserted invalid Luau syntax.",
        },
      ],
      [
        "Replace the malformed token with a valid variable/property name.",
        "Check the reported line and the preceding line for a missing comma or closing delimiter.",
      ],
      'local humanoid = character:WaitForChild("Humanoid")\nprint(humanoid.Health)',
      "High",
      flows.length > 0 || tokens.length > 0 ? 94 : 88,
    );
  },
};
