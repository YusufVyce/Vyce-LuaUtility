import { collectRobloxDiagnostics } from "../../analyzer/robloxDiagnostics";
import type { Cause, ErrorEntry } from "../../types";

export const TABLE_INDEX_IS_NIL: ErrorEntry = {
  id: "roblox-table-index-nil",
  title: "Table index is nil",
  pattern: /table index is nil|table index is not a valid key/i,
  keywords: ["table", "index", "nil", "key", "dictionary", "lookup", "pairs"],
  aliases: [
    "table index is nil",
    "table index is not a valid key",
    "nil table key",
    "invalid table index",
  ],
  analyze(_logText, codeText) {
    const causes: Cause[] = [];
    const fixes: string[] = [];
    const diagnostics = collectRobloxDiagnostics(codeText);
    let example = "";
    if (!codeText) {
      causes.push(
        {
          percent: 91,
          text: "A nil value is being used as a table key, such as data[nil] or data[nil] = value.",
        },
        { percent: 9, text: "A lookup key was not initialized before the table operation." },
      );
      fixes.push(
        "Validate the key before indexing; do not silently replace a required key with an arbitrary fallback.",
      );
      example = "if itemId ~= nil then\n    inventory[itemId] = item\nend";
    } else if (codeText.includes("FindFirstChild(")) {
      causes.push(
        {
          percent: 90,
          text: "A missing Instance from FindFirstChild() is being used as a table key.",
        },
        { percent: 10, text: "The Instance was destroyed before the table update." },
      );
      fixes.push(
        "Check FindFirstChild() before using the result or its attributes as dictionary keys.",
      );
      example =
        "local tool = player.Backpack:FindFirstChild(toolName)\nif tool then\n    equippedByTool[tool] = player\nend";
    } else if (codeText.includes("GetAttribute(")) {
      causes.push(
        {
          percent: 92,
          text: "GetAttribute() returned nil and that optional attribute is used as the table index.",
        },
        { percent: 8, text: "The attribute name is misspelled or is set after this code runs." },
      );
      fixes.push("Set the attribute before use, then check it is non-nil and the expected type.");
      example =
        'local slot = tool:GetAttribute("Slot")\nif typeof(slot) == "number" then\n    loadout[slot] = tool\nend';
    } else {
      causes.push(
        {
          percent: 86,
          text: "A function result, table field, or loop variable used as a key is nil.",
        },
        { percent: 14, text: "The key was cleared while code still expects it to exist." },
      );
      fixes.push("Log the key source and guard table reads/writes with a non-nil key check.");
      example =
        "local profile = profiles[player.UserId]\nif profile then\n    profile.Items[itemName] = true\nend";
    }
    return {
      explanation:
        "Lua tables cannot be indexed with nil. The key inside brackets, or the key assigned through a table operation, was nil.",
      causes,
      fixes,
      example,
      severity: "High",
      confidence: 95,
      ...diagnostics,
    };
  },
};
