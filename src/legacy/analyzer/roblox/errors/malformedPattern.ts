import { extractVariableFlow } from "../../codeFlow";
import { tokenize } from "../../tokenizer";
import { analysis, type StaticErrorEntry } from "./shared";

const MALFORMED_PATTERN = /malformed pattern\s*\(([^)]+)\)|malformed pattern/i;

export const MALFORMED_PATTERN_ERROR: StaticErrorEntry = {
  id: "luau-malformed-pattern",
  title: "Malformed Luau string pattern",
  pattern: MALFORMED_PATTERN,
  keywords: ["malformed", "pattern", "string", "match", "gsub", "find"],
  aliases: ["malformed pattern", "malformed pattern missing bracket"],
  severity: "Medium",
  confidence: 98,
  analyze(errorLine, codeSnippet) {
    const flows = extractVariableFlow(codeSnippet);
    const tokens = tokenize(codeSnippet.replace(/([():,])/g, " $1 "));
    const detail = errorLine.match(MALFORMED_PATTERN)?.[1] || "an invalid magic-character sequence";
    const stringOperation = /string\.(match|gsub|find)\s*\(/.exec(codeSnippet)?.[1];
    const literalBrackets = /string\.(?:match|gsub|find)\s*\([^,]+,\s*["'][^"']*\[[^"']*["']/.test(
      codeSnippet,
    );

    return analysis(
      codeSnippet,
      `Luau rejected the string pattern because ${detail}. In string.${stringOperation || "match"}, '[', ']', '(', ')', '%', and other magic characters must be escaped with '%' when searched literally.`,
      [
        {
          percent: literalBrackets ? 99 : 93,
          text: literalBrackets
            ? "The pattern contains an unescaped '[' character, which starts a character class."
            : "The pattern has an unclosed or invalid magic-character expression.",
        },
        {
          percent: literalBrackets ? 1 : 7,
          text: "A pattern fragment was concatenated without escaping user-supplied text.",
        },
      ],
      [
        "Escape literal pattern characters with '%', for example '%[' and '%]'.",
        "Escape dynamic search text before passing it to string.match, string.find, or string.gsub.",
      ],
      'local literalOpenBracket = "%["\nlocal startIndex = string.find(text, literalOpenBracket)\n\nlocal result = string.gsub(text, "%(", "")',
      "Medium",
      flows.length > 0 || tokens.length > 0 ? 98 : 92,
    );
  },
};
