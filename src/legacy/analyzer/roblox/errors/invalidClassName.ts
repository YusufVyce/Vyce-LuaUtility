import { extractVariableFlow } from "../../codeFlow";
import { tokenize } from "../../tokenizer";
import { analysis, type StaticErrorEntry } from "./shared";

export const INVALID_CLASS_NAME: StaticErrorEntry = {
  id: "roblox-invalid-class-name",
  title: "Invalid Instance class name",
  pattern: /unable to create an? instance of class|invalid class name/i,
  keywords: ["unable", "create", "instance", "class"],
  aliases: ["unable to create an instance of class", "invalid class name"],
  severity: "Medium",
  confidence: 98,
  analyze(errorLine, codeSnippet) {
    const flows = extractVariableFlow(codeSnippet);
    const tokens = tokenize(codeSnippet.replace(/[^A-Za-z0-9_:.()"']/g, " "));
    const className =
      /Instance\.new\s*\(\s*["']([^"']+)/.exec(codeSnippet)?.[1] ||
      /class\s+["']([^"']+)/i.exec(errorLine)?.[1] ||
      "the supplied class name";
    return analysis(
      codeSnippet,
      `Instance.new() received '${className}', which is not a creatable Roblox class name.`,
      [
        {
          percent: 98,
          text: "The class name is misspelled, uses an Enum/property name, or refers to a non-instantiable class.",
        },
        { percent: 2, text: "A dynamic class-name variable resolved to invalid text." },
      ],
      [
        "Use a documented, creatable Roblox class name with exact capitalization.",
        "Prefer a fixed allowlist when class names are selected dynamically.",
      ],
      'local part = Instance.new("Part")\npart.Parent = workspace',
      "Medium",
      flows.length > 0 || tokens.length > 0 ? 98 : 93,
    );
  },
};
