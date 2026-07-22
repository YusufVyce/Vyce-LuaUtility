import { extractVariableFlow } from "../../codeFlow";
import { tokenize } from "../../tokenizer";
import { analysis, type StaticErrorEntry } from "./shared";

export const DEAD_COROUTINE: StaticErrorEntry = {
  id: "luau-dead-coroutine",
  title: "Cannot resume dead coroutine",
  pattern: /cannot resume dead coroutine/i,
  keywords: ["cannot", "resume", "dead", "coroutine"],
  aliases: ["cannot resume dead coroutine"],
  severity: "High",
  confidence: 98,
  analyze(_errorLine, codeSnippet) {
    const flows = extractVariableFlow(codeSnippet);
    const tokens = tokenize(codeSnippet.replace(/[^A-Za-z0-9_:.()]/g, " "));
    const resumeCount = (codeSnippet.match(/coroutine\.resume\s*\(/g) || []).length;
    return analysis(
      codeSnippet,
      "coroutine.resume() is being called after that coroutine function returned, errored, or was already exhausted. A dead coroutine cannot be restarted.",
      [
        {
          percent: resumeCount > 1 ? 96 : 89,
          text:
            resumeCount > 1
              ? "The same coroutine is likely resumed more than once without recreating it."
              : "The coroutine completed or failed before this resume call.",
        },
        {
          percent: resumeCount > 1 ? 4 : 11,
          text: "An error inside the coroutine ended it before the next resume.",
        },
      ],
      [
        "Check coroutine.status(thread) before resuming and recreate completed workers.",
        "Capture the return values from coroutine.resume to handle an error that killed the coroutine.",
      ],
      'if coroutine.status(worker) == "suspended" then\n    local ok, err = coroutine.resume(worker)\n    if not ok then warn(err) end\nend',
      "High",
      flows.length > 0 || tokens.length > 0 ? 98 : 92,
    );
  },
};
