import { extractVariableFlow } from "../../codeFlow";
import { tokenize } from "../../tokenizer";
import { analysis, type StaticErrorEntry } from "./shared";

export const ATTEMPT_TO_INDEX_STRING: StaticErrorEntry = {
  id: "roblox-index-string",
  title: "Attempt to index string",
  pattern: /attempt to index (?:a )?string value|attempt to index string(?:\s|$)/i,
  keywords: ["attempt", "index", "string", "method", "fireserver", "onserverevent"],
  aliases: ["attempt to index string", "attempt to index a string value"],
  severity: "High",
  confidence: 96,
  analyze(_errorLine, codeSnippet) {
    const flows = extractVariableFlow(codeSnippet);
    const tokens = tokenize(codeSnippet.replace(/[^A-Za-z0-9_:.()]/g, " "));
    const colonMethod = /function\s+([A-Za-z_]\w*):([A-Za-z_]\w*)\s*\(/.exec(codeSnippet);
    const dotCall =
      colonMethod &&
      new RegExp(`\\b${colonMethod[1]}\\.${colonMethod[2]}\\s*\\(`).test(codeSnippet);
    if (dotCall) {
      return analysis(
        codeSnippet,
        "The colon-defined method is called with '.', so its first explicit argument becomes self. That argument is a string and the method later indexes self.",
        [
          {
            percent: 98,
            text: `Call '${colonMethod![1]}:${colonMethod![2]}(...)', not '${colonMethod![1]}.${colonMethod![2]}(...)'.`,
          },
          { percent: 2, text: "A separate call site may pass a string as the receiver." },
        ],
        [
          "Use ':' when calling a method declared with ':'.",
          "Keep self as the implicit receiver; do not pass it manually.",
        ],
        `function ${colonMethod![1]}:${colonMethod![2]}()\n    print(self.Name)\nend\n\n${colonMethod![1]}:${colonMethod![2]}()`,
        "High",
        99,
      );
    }
    const remoteHandler = /OnServerEvent\s*:\s*Connect\s*\(\s*function\s*\(([^)]*)\)/.exec(
      codeSnippet,
    );
    if (remoteHandler && !/^\s*player\b/.test(remoteHandler[1])) {
      return analysis(
        codeSnippet,
        "The OnServerEvent callback omits its implicit Player parameter. Every later parameter is shifted left, so a client string can be indexed as though it were the Player or another object.",
        [
          {
            percent: 97,
            text: "OnServerEvent always passes player as its first callback parameter.",
          },
          { percent: 3, text: "The client/server argument order differs." },
        ],
        [
          "Add 'player' as the first OnServerEvent callback parameter.",
          "Validate the remaining remote arguments with typeof() before indexing them.",
        ],
        'remote.OnServerEvent:Connect(function(player, message)\n    if typeof(message) ~= "string" then return end\n    print(player.Name, message)\nend)',
        "High",
        98,
      );
    }
    const stringFlow = flows.find((flow) => /^['"]/.test(flow.source));
    return analysis(
      codeSnippet,
      `A string${stringFlow ? ` assigned to '${stringFlow.variable}'` : ""} is being used with property or method access. Strings do not have Roblox Instance members.`,
      [
        {
          percent: 90,
          text: "The indexed variable was assigned text or received text from a function/remote.",
        },
        {
          percent: 10,
          text: "A method receiver was replaced by a string through an argument-order mistake.",
        },
      ],
      [
        "Trace the variable assignment and pass the intended Instance/table instead.",
        "Use typeof() at the failing line to verify the receiver before indexing.",
      ],
      'if typeof(target) == "Instance" then\n    print(target.Name)\nend',
      "High",
      tokens.length > 0 ? 94 : 88,
    );
  },
};
