import { tokenize } from "../../tokenizer";
import { analysis, type StaticErrorEntry } from "./shared";

const ROBLOX_METHODS = [
  "Destroy",
  "Clone",
  "GetChildren",
  "GetDescendants",
  "FindFirstChild",
  "WaitForChild",
  "GetService",
  "GetAttribute",
  "SetAttribute",
  "IsA",
  "Connect",
  "Disconnect",
  "FireServer",
  "FireClient",
  "FireAllClients",
  "InvokeServer",
  "InvokeClient",
  "PivotTo",
  "GetPivot",
  "MoveTo",
  "LoadCharacter",
];

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      const saved = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal +
          Number(left[leftIndex - 1].toLowerCase() !== right[rightIndex - 1].toLowerCase()),
      );
      diagonal = saved;
    }
  }
  return previous[right.length];
}

function lineBeforeError(errorLine: string, codeSnippet: string): string {
  const lineNumber = errorLine.match(/:(\d+):/)?.[1];
  const lines = codeSnippet.split(/\r?\n/);
  if (lineNumber) {
    const index = Number(lineNumber) - 1;
    if (index > 0 && /[:.]\s*[A-Za-z_]\w*\s*\(/.test(lines[index - 1])) {
      return lines[index - 1];
    }
    if (lines[index]) return lines[index];
  }
  for (let index = lines.length - 1; index >= 0; index--) {
    if (/[:.]\s*[A-Za-z_]\w*\s*\(/.test(lines[index])) {
      return lines[index];
    }
  }
  return "";
}

function closestRobloxMethod(candidate: string): string | null {
  const closest = ROBLOX_METHODS.map((method) => ({
    method,
    distance: editDistance(candidate, method),
  })).sort((left, right) => left.distance - right.distance)[0];
  return closest && closest.distance <= 2 ? closest.method : null;
}

export const NAMING_TYPO: StaticErrorEntry = {
  id: "roblox-api-naming-typo",
  title: "Possible Roblox API naming typo",
  pattern: /attempt to call (?:a )?nil value|attempt to call nil(?:\s|$)/i,
  keywords: ["attempt", "call", "nil", "method", "typo"],
  aliases: ["attempt to call a nil value", "possible Roblox API naming typo"],
  severity: "High",
  confidence: 94,
  analyze(errorLine, codeSnippet) {
    const sourceLine = lineBeforeError(errorLine, codeSnippet);
    const tokens = tokenize(sourceLine.replace(/([.:()])/g, " $1 "));
    const methodCall = /[:.]\s*([A-Za-z_]\w*)\s*\(/.exec(sourceLine)?.[1];
    const suggestion = methodCall ? closestRobloxMethod(methodCall) : null;

    if (methodCall && suggestion) {
      return analysis(
        codeSnippet,
        `'${methodCall}' is called on the source line, but it is not a valid method on the target object. It is likely a typo for Roblox API method '${suggestion}'.`,
        [
          {
            percent: 99,
            text: `'${methodCall}' is within two edits of '${suggestion}' and resolves to nil before the call.`,
          },
          {
            percent: 1,
            text: "The target object may also be a custom table with a similarly named missing method.",
          },
        ],
        [
          `Did you mean '${suggestion}' instead of '${methodCall}'?`,
          "Use Roblox Studio autocomplete to verify API method capitalization and spelling.",
        ],
        sourceLine.replace(
          new RegExp(`([:.]\\s*)${methodCall}(?=\\s*\\()`, "g"),
          `$1${suggestion}`,
        ),
        "High",
        99,
      );
    }

    return analysis(
      codeSnippet,
      "The called value is nil. No close Roblox API spelling match was found on the failing line, so this is more likely a missing custom function, module export, or callback.",
      [
        { percent: 85, text: "The method/function name does not resolve to a callable value." },
        { percent: 15, text: "The code context does not contain a recognizable Roblox API typo." },
      ],
      [
        "Verify the function declaration, ModuleScript export, and method spelling at the call site.",
      ],
      "if callback then\n    callback()\nend",
      "High",
      tokens.length > 0 ? 90 : 82,
    );
  },
};
