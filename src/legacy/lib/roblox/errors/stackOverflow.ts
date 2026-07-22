import { collectRobloxDiagnostics } from "../../analyzer/robloxDiagnostics";
import type { Cause, ErrorEntry } from "../../types";

export const STACK_OVERFLOW: ErrorEntry = {
  id: "roblox-stack-overflow",
  title: "Stack overflow",
  pattern: /stack overflow|stack overflow detected/i,
  keywords: ["stack", "overflow", "recursion", "function", "callback", "signal", "metatable"],
  aliases: [
    "stack overflow",
    "stack overflow detected",
    "maximum stack depth",
    "recursive call overflow",
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
          text: "A function repeatedly calls itself, directly or through another function, without a terminating condition.",
        },
        { percent: 9, text: "An event callback is re-triggering the event it listens to." },
      );
      fixes.push(
        "Find the repeating call chain and add a base case or a guard that stops re-entry.",
      );
      example =
        "local function countDown(value)\n    if value <= 0 then return end\n    print(value)\n    countDown(value - 1)\nend";
    } else if (codeText.includes(".Changed") || codeText.includes("GetPropertyChangedSignal")) {
      causes.push(
        {
          percent: 92,
          text: "A Changed/property callback writes the same observed property, immediately firing itself again.",
        },
        { percent: 8, text: "Two property callbacks are updating each other in a loop." },
      );
      fixes.push(
        "Compare the new value before assigning and use a re-entry guard when a callback must update related state.",
      );
      example =
        'local updating = false\npart:GetPropertyChangedSignal("Name"):Connect(function()\n    if updating then return end\n    updating = true\n    -- Update other state without assigning Name again.\n    updating = false\nend)';
    } else if (codeText.includes("__index") || codeText.includes("setmetatable")) {
      causes.push(
        {
          percent: 94,
          text: "A metatable __index implementation accesses the same missing key through the table, recursively invoking itself.",
        },
        {
          percent: 6,
          text: "The fallback table is also configured with the same recursive metatable.",
        },
      );
      fixes.push(
        "Use rawget() inside metamethods and keep fallback tables separate from the metatable target.",
      );
      example =
        "local methods = {}\nlocal object = setmetatable({}, {\n    __index = function(self, key)\n        return rawget(methods, key)\n    end,\n})";
    } else {
      causes.push(
        { percent: 84, text: "Recursive control flow has no reachable base case." },
        { percent: 16, text: "A callback or Bindable event forms an indirect recursive cycle." },
      );
      fixes.push(
        "Replace unbounded recursion with an iterative loop when appropriate, and disconnect/guard event feedback loops.",
      );
      example =
        "local function findAncestor(instance, className)\n    while instance do\n        if instance:IsA(className) then return instance end\n        instance = instance.Parent\n    end\nend";
    }
    return {
      explanation:
        "The Lua call stack grew until Roblox's stack limit was reached, normally due to direct or indirect recursion.",
      causes,
      fixes,
      example,
      severity: "Critical",
      confidence: 96,
      ...diagnostics,
    };
  },
};
