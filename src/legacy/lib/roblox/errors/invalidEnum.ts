import { collectRobloxDiagnostics } from "../../analyzer/robloxDiagnostics";
import type { Cause, ErrorEntry } from "../../types";

export const INVALID_ENUM: ErrorEntry = {
  id: "roblox-invalid-enum",
  title: "Invalid Enum",
  pattern: /invalid enum|is not a valid member of enum|invalid enum item/i,
  keywords: ["invalid", "enum", "member", "enumitem", "material", "keycode", "humanoidstate"],
  aliases: [
    "invalid enum",
    "invalid enum item",
    "not a valid member of enum",
    "enum member does not exist",
  ],
  analyze(logText, codeText) {
    const causes: Cause[] = [];
    const fixes: string[] = [];
    const diagnostics = collectRobloxDiagnostics(codeText);
    const enumName = logText.match(/member of Enum\.([\w]+)/i)?.[1] || "Enum";
    let example = "";
    if (!codeText) {
      causes.push(
        {
          percent: 92,
          text: `The requested ${enumName} item does not exist or is spelled incorrectly.`,
        },
        { percent: 8, text: "A string was supplied where an EnumItem is required." },
      );
      fixes.push("Use autocomplete or Roblox's API reference to select a valid Enum item.");
      example = "part.Material = Enum.Material.Plastic";
    } else if (codeText.includes("Enum.KeyCode")) {
      causes.push(
        {
          percent: 94,
          text: "The KeyCode member is misspelled or does not exist on the current Enum.",
        },
        { percent: 6, text: "Input was stored as text instead of an Enum.KeyCode item." },
      );
      fixes.push(
        "Use Enum.KeyCode.<member> directly; map strings to a whitelist rather than constructing enum names dynamically.",
      );
      example = "if input.KeyCode == Enum.KeyCode.E then\n    interact()\nend";
    } else if (codeText.includes("Enum.") && codeText.includes("=")) {
      causes.push(
        {
          percent: 91,
          text: "A property expecting an EnumItem received an invalid enum member or text value.",
        },
        {
          percent: 9,
          text: "The enum category is correct but the item name is outdated/misspelled.",
        },
      );
      fixes.push("Assign the exact EnumItem for the property rather than a string.");
      example = "humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.Viewer";
    } else {
      causes.push(
        { percent: 85, text: "The enum category or member in the failing call is invalid." },
        { percent: 15, text: "A dynamically selected enum name lacks a safe validation path." },
      );
      fixes.push(
        "Replace dynamic enum lookup with a typed whitelist table of supported EnumItems.",
      );
      example =
        "local materials = { Plastic = Enum.Material.Plastic, Wood = Enum.Material.Wood }\npart.Material = materials[selected] or Enum.Material.Plastic";
    }
    return {
      explanation:
        "Roblox could not resolve the Enum item. Enum categories and member names are case-sensitive and only predefined items are valid.",
      causes,
      fixes,
      example,
      severity: "Medium",
      confidence: 95,
      ...diagnostics,
    };
  },
};
