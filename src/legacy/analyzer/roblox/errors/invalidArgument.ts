import { extractVariableFlow } from "../../codeFlow";
import { tokenize } from "../../tokenizer";
import { analysis, type StaticErrorEntry } from "./shared";

type ArgumentDetails = {
  index: string;
  functionName: string;
  expectedType: string;
  receivedType: string;
};

const INVALID_ARGUMENT_PATTERN =
  /invalid argument\s+#(\d+)\s+to\s+['"]([^'"]+)['"]\s*\(\s*(.+?)\s+expected\s*,\s*got\s+([^)]+?)\s*\)/i;

function parseArgumentDetails(errorLine: string): ArgumentDetails | null {
  const match = errorLine.match(INVALID_ARGUMENT_PATTERN);
  if (!match) return null;

  return {
    index: match[1],
    functionName: match[2],
    expectedType: match[3].trim(),
    receivedType: match[4].trim(),
  };
}

export const INVALID_ARGUMENT: StaticErrorEntry = {
  id: "roblox-invalid-argument",
  title: "Invalid argument type",
  pattern: INVALID_ARGUMENT_PATTERN,
  keywords: ["invalid", "argument", "expected", "got"],
  aliases: ["invalid argument", "bad argument", "expected got"],
  severity: "High",
  confidence: 97,
  analyze(errorLine, codeSnippet) {
    const details = parseArgumentDetails(errorLine);
    const flows = extractVariableFlow(codeSnippet);
    const tokens = tokenize(codeSnippet.replace(/([():,])/g, " $1 "));

    if (!details) {
      return analysis(
        codeSnippet,
        "Roblox rejected an argument, but the console line does not include enough type information to identify the exact conversion error.",
        [
          { percent: 85, text: "A required API argument has the wrong type or value." },
          {
            percent: 15,
            text: "The full console message was truncated before its expected/got details.",
          },
        ],
        [
          "Provide the complete console line containing the function name and expected/got types.",
          "Validate the argument with typeof() or IsA() immediately before the API call.",
        ],
        'if typeof(value) == "string" then\n    workspace:FindFirstChild(value)\nend',
        "High",
        82,
      );
    }

    const expected = details.expectedType.toLowerCase();
    const received = details.receivedType.toLowerCase();
    const functionName = details.functionName.toLowerCase();

    if (
      (functionName === "pairs" || functionName === "ipairs") &&
      expected === "table" &&
      received === "instance"
    ) {
      return analysis(
        codeSnippet,
        `'${details.functionName}' received a Roblox Instance, not a table. The loop must iterate a table returned by :GetChildren() or :GetDescendants(), rather than the Instance itself.`,
        [
          {
            percent: 99,
            text: `Argument #${details.index} to ${details.functionName} is an Instance; ${details.functionName} only iterates tables.`,
          },
          {
            percent: 1,
            text: "The instance was passed through a variable that was expected to contain a child list.",
          },
        ],
        [
          "Call :GetChildren() for direct children or :GetDescendants() for the full hierarchy before iterating.",
          "Keep the Instance reference and the resulting child table in separate variables.",
        ],
        "for _, child in ipairs(folder:GetChildren()) do\n    print(child.Name)\nend",
        "High",
        99,
      );
    }

    const taskFunction = ["spawn", "task.spawn", "task.defer"].includes(functionName);
    const scheduledCall = /(?:task\.)?(?:spawn|defer)\s*\(\s*([A-Za-z_]\w*)\s*\(/.exec(codeSnippet);
    if (taskFunction && /function|thread/.test(expected)) {
      if (scheduledCall) {
        return analysis(
          codeSnippet,
          `'${details.functionName}(${scheduledCall[1]}())' invokes '${scheduledCall[1]}' immediately and passes its return value. ${details.functionName} requires a function or coroutine thread reference.`,
          [
            {
              percent: 99,
              text: `The scheduler argument calls '${scheduledCall[1]}' instead of passing it as a callback.`,
            },
            {
              percent: 1,
              text: "The called function returns a value that is not a function or coroutine.",
            },
          ],
          [
            "Remove the inner call parentheses to pass the function reference.",
            "Use an anonymous function only when the scheduled callback needs arguments.",
          ],
          `task.spawn(${scheduledCall[1]})\n\n-- With arguments:\ntask.spawn(function()\n    ${scheduledCall[1]}(argument)\nend)`,
          "High",
          99,
        );
      }

      return analysis(
        codeSnippet,
        `${details.functionName} expects a function or coroutine thread in argument #${details.index}, but received ${details.receivedType}.`,
        [
          {
            percent: 94,
            text: "The scheduler callback variable is not a function/thread at the call site.",
          },
          { percent: 6, text: "A callback result was passed instead of the callback reference." },
        ],
        [
          "Pass a function reference, such as task.spawn(worker), rather than a value.",
          "Check callback variables with typeof(callback) == 'function' before scheduling.",
        ],
        "task.defer(function()\n    updateProfile(player)\nend)",
        "High",
        tokens.length > 0 ? 96 : 91,
      );
    }

    const vectorCFrameMismatch =
      (expected === "vector3" && received === "cframe") ||
      (expected === "cframe" && received === "vector3");
    if (vectorCFrameMismatch && /\+/.test(codeSnippet)) {
      const flowHint = flows.find((flow) => /Vector3\.new|CFrame\.new/.test(flow.source));
      return analysis(
        codeSnippet,
        `${details.expectedType} and ${details.receivedType} cannot be added directly. Use CFrame position/translation APIs or operate on Vector3 values of the same type.`,
        [
          {
            percent: 98,
            text: `A '+' expression combines ${details.expectedType} with ${details.receivedType}${flowHint ? ` near '${flowHint.variable}'` : ""}.`,
          },
          {
            percent: 2,
            text: "A function result has a different spatial type than the expression expects.",
          },
        ],
        [
          "For a CFrame translation, multiply by CFrame.new(offset) instead of adding a Vector3.",
          "Use cframe.Position when the operation should be purely Vector3 arithmetic.",
        ],
        "local offset = Vector3.new(0, 5, 0)\npart.CFrame = part.CFrame * CFrame.new(offset)\n\nlocal position = part.Position + offset",
        "High",
        98,
      );
    }

    return analysis(
      codeSnippet,
      `${details.functionName} argument #${details.index} requires ${details.expectedType}, but the supplied value is ${details.receivedType}.`,
      [
        {
          percent: 94,
          text: `The value passed to ${details.functionName} has type ${details.receivedType}, not ${details.expectedType}.`,
        },
        {
          percent: 6,
          text: "A function result or API return value was used without type validation.",
        },
      ],
      [
        `Convert or replace argument #${details.index} with a valid ${details.expectedType} value before calling ${details.functionName}.`,
        "Use typeof() for Luau values and IsA() for Roblox Instances at the call site.",
      ],
      `local value = getValue()\nif typeof(value) == "${details.expectedType.toLowerCase()}" then\n    ${details.functionName}(value)\nend`,
      "High",
      97,
    );
  },
};
