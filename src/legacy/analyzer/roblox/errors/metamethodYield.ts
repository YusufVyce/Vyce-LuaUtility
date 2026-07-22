import { extractVariableFlow } from "../../codeFlow";
import { tokenize } from "../../tokenizer";
import { analysis, type StaticErrorEntry } from "./shared";

export const METAMETHOD_YIELD: StaticErrorEntry = {
  id: "roblox-metamethod-yield",
  title: "Yield across metamethod/C-call boundary",
  pattern: /attempt to yield across (?:a )?(?:metamethod|C-call) boundary/i,
  keywords: ["yield", "metamethod", "c-call", "__index", "waitforchild", "datastore"],
  aliases: [
    "attempt to yield across metamethod boundary",
    "attempt to yield across C-call boundary",
  ],
  severity: "High",
  confidence: 99,
  analyze(_errorLine, codeSnippet) {
    const flows = extractVariableFlow(codeSnippet);
    const tokens = tokenize(codeSnippet.replace(/[^A-Za-z0-9_:.]/g, " "));
    const metamethod = /__(?:index|newindex|namecall|call)/.exec(codeSnippet)?.[0] || "metamethod";
    const yielding = /(?:WaitForChild|GetAsync|SetAsync|UpdateAsync|task\.wait|wait\s*\()/.exec(
      codeSnippet,
    )?.[0];
    return analysis(
      codeSnippet,
      `${yielding || "A yielding operation"} runs inside ${metamethod}. Luau cannot suspend execution across that metamethod/C-call boundary.`,
      [
        {
          percent: yielding ? 99 : 92,
          text: `${yielding || "The operation"} yields while the engine is resolving a metamethod.`,
        },
        {
          percent: 100 - (yielding ? 99 : 92),
          text: "A helper called by the metamethod yields indirectly.",
        },
      ],
      [
        "Load or wait for required data before installing/entering the metamethod.",
        "Make the metamethod read only already-available state; move DataStore work to a normal function.",
      ],
      "local data = store:GetAsync(key) -- do this outside __index\nlocal proxy = setmetatable({}, {\n    __index = function(_, name)\n        return data[name]\n    end,\n})",
      "High",
      flows.length > 0 || tokens.length > 0 ? 99 : 94,
    );
  },
};
