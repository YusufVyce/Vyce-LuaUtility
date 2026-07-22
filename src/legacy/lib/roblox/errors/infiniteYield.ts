import type { Cause, ErrorEntry } from "../../types";

export const INFINITE_YIELD: ErrorEntry = {
  id: "roblox-infinite-yield",
  title: "Infinite yield possible",
  pattern: /Infinite yield possible on/i,

  analyze(logText, codeText) {
    const match = logText.match(
      /Infinite yield possible on ['"]?([^'"\n]+)['"]?/i,
    );

    const targetStr = match ? match[1] : "object";

    const causes: Cause[] = [
      {
        percent: 85,
        text: `The script is stuck waiting for '${targetStr}', which has not been created yet or was named differently.`,
      },
    ];

    const fixes: string[] = [
      `Check that the spelling and casing of '${targetStr}' matches the Explorer hierarchy exactly.`,
    ];

    if (codeText && codeText.includes("WaitForChild")) {
      causes.push({
        percent: 15,
        text: `Race condition: the script responsible for creating '${targetStr}' errored or yielded forever before creating it.`,
      });

      fixes.push(
        "Add a timeout parameter to WaitForChild() so it fails fast instead of hanging silently.",
      );
    }

    return {
      explanation:
        "A :WaitForChild() call has waited longer than 5 seconds without finding its target and is logging a warning.",

      causes,
      fixes,

      example: `local target = parent:WaitForChild("${targetStr.split(":")[0]}", 5)
if not target then
    warn("Failed to load target")
    return
end`,
    };
  },
};