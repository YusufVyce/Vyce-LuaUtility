import { extractVariableFlow } from "../../codeFlow";
import { tokenize } from "../../tokenizer";
import { analysis, type StaticErrorEntry } from "./shared";

export const INVALID_SERVICE: StaticErrorEntry = {
  id: "roblox-invalid-service",
  title: "Invalid Roblox service name",
  pattern: /(?:is not a valid service name|service .+ is not available)/i,
  keywords: ["service", "getservice", "valid", "name"],
  aliases: ["is not a valid service name", "service is not available"],
  severity: "Medium",
  confidence: 97,
  analyze(errorLine, codeSnippet) {
    const flows = extractVariableFlow(codeSnippet);
    const tokens = tokenize(codeSnippet.replace(/[^A-Za-z0-9_:.()"']/g, " "));
    const requested =
      /GetService\s*\(\s*["']([^"']+)/.exec(codeSnippet)?.[1] ||
      errorLine.match(/["']([^"']+)["']/)?.[1] ||
      "the requested name";
    return analysis(
      codeSnippet,
      `game:GetService() was called with '${requested}', which is not a Roblox service name available in this context.`,
      [
        {
          percent: 97,
          text: "The GetService string is misspelled, uses an Instance class name, or refers to a non-service.",
        },
        {
          percent: 3,
          text: "The service name was generated dynamically and resolved to invalid text.",
        },
      ],
      [
        "Use the exact documented service name, such as 'Players' or 'ReplicatedStorage'.",
        "Avoid dynamic GetService names; validate them against a fixed allowlist.",
      ],
      'local ReplicatedStorage = game:GetService("ReplicatedStorage")',
      "Medium",
      flows.length > 0 || tokens.length > 0 ? 97 : 92,
    );
  },
};
