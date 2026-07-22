import { extractVariableFlow } from "../../codeFlow";
import { tokenize } from "../../tokenizer";
import { analysis, type StaticErrorEntry } from "./shared";

export const CYCLIC_REFERENCE: StaticErrorEntry = {
  id: "roblox-cyclic-reference",
  title: "Table has a cyclic reference",
  pattern: /table has a cyclic reference|cyclic table reference/i,
  keywords: ["table", "cyclic", "reference", "jsonencode", "datastore"],
  aliases: ["table has a cyclic reference", "cyclic table reference"],
  severity: "High",
  confidence: 99,
  analyze(_errorLine, codeSnippet) {
    const flows = extractVariableFlow(codeSnippet);
    const tokens = tokenize(codeSnippet.replace(/[^A-Za-z0-9_:.=]/g, " "));
    const selfReference =
      /([A-Za-z_]\w*)\s*\[.+?\]\s*=\s*\1\b/.exec(codeSnippet) ||
      /([A-Za-z_]\w*)\.\w+\s*=\s*\1\b/.exec(codeSnippet);
    const serializer =
      /(?:JSONEncode|SetAsync|UpdateAsync)/.exec(codeSnippet)?.[0] || "the serializer";
    return analysis(
      codeSnippet,
      `${serializer} received a table that eventually contains itself. JSON and DataStore serialization require an acyclic tree of supported values.`,
      [
        {
          percent: selfReference ? 99 : 92,
          text: selfReference
            ? `'${selfReference[1]}' is assigned into itself, creating a cycle.`
            : "A nested table links back to an ancestor before serialization.",
        },
        {
          percent: selfReference ? 1 : 8,
          text: "The data contains an unsupported object or a shared graph that becomes cyclic during conversion.",
        },
      ],
      [
        "Remove parent/back-reference fields from the persisted/JSON payload.",
        "Serialize only plain, acyclic data; store IDs instead of Instance/table references.",
      ],
      "local payload = { coins = profile.Coins, items = {} }\nfor name, owned in pairs(profile.Items) do\n    payload.items[name] = owned\nend\nlocal encoded = HttpService:JSONEncode(payload)",
      "High",
      flows.length > 0 || tokens.length > 0 ? 99 : 94,
    );
  },
};
