import { extractVariableFlow } from "../../codeFlow";
import { tokenize } from "../../tokenizer";
import { analysis, type StaticErrorEntry } from "./shared";

export const CYCLIC_PARENTING: StaticErrorEntry = {
  id: "roblox-cyclic-parenting",
  title: "Cyclic Instance parenting",
  pattern: /attempt to set parent of .* to itself or a descendant/i,
  keywords: ["attempt", "set", "parent", "itself", "descendant"],
  aliases: ["attempt to set parent to itself or a descendant", "cyclic parenting"],
  severity: "High",
  confidence: 99,
  analyze(errorLine, codeSnippet) {
    const flows = extractVariableFlow(codeSnippet);
    const tokens = tokenize(codeSnippet.replace(/([.:=])/g, " $1 "));
    const parentMatch = errorLine.match(/parent of\s+(.+?)\s+to itself or a descendant/i);
    const instanceName = parentMatch?.[1] || "the Instance";
    const selfParenting = /([A-Za-z_]\w*)\.Parent\s*=\s*\1\b/.test(codeSnippet);

    return analysis(
      codeSnippet,
      `${instanceName} is being parented to itself or to one of its descendants. Roblox rejects this because it would create an infinite hierarchy loop.`,
      [
        {
          percent: selfParenting ? 99 : 96,
          text: selfParenting
            ? "The same variable is assigned to its own Parent property."
            : "A reparenting operation makes an ancestor become the child of its descendant.",
        },
        {
          percent: selfParenting ? 1 : 4,
          text: "A clone/move helper selected an invalid destination within the source hierarchy.",
        },
      ],
      [
        "Parent the Instance to a sibling, an ancestor, or a separate container—not to itself or any descendant.",
        "Create a new container with Instance.new() when the hierarchy needs a separate destination.",
      ],
      'local container = Instance.new("Folder")\ncontainer.Name = "MovedObjects"\ncontainer.Parent = workspace\n\nobject.Parent = container',
      "High",
      flows.length > 0 || tokens.length > 0 ? 99 : 94,
    );
  },
};
