import { collectRobloxDiagnostics } from "../../analyzer/robloxDiagnostics";
import type { Cause, ErrorEntry } from "../../types";

export const C_STACK_OVERFLOW: ErrorEntry = {
  id: "roblox-c-stack-overflow",
  title: "C stack overflow",
  pattern: /C stack overflow|C stack overflow detected/i,
  keywords: ["c", "stack", "overflow", "metatable", "index", "newindex", "recursion"],
  aliases: ["c stack overflow", "c stack overflow detected", "C stack limit", "c stack recursion"],
  analyze(_logText, codeText) {
    const causes: Cause[] = [];
    const fixes: string[] = [];
    const diagnostics = collectRobloxDiagnostics(codeText);
    let example = "";
    if (!codeText) {
      causes.push(
        {
          percent: 94,
          text: "A Lua-to-engine call chain recurses repeatedly, often from a metamethod, until the C stack is exhausted.",
        },
        { percent: 6, text: "A wrapped Roblox method is calling its own replacement." },
      );
      fixes.push(
        "Inspect metatable hooks and method wrappers for calls that re-enter themselves; call the saved original function instead.",
      );
      example =
        "local original = instance.Method\ninstance.Method = function(self, ...)\n    return original(self, ...)\nend";
    } else if (codeText.includes("__namecall") || codeText.includes("getnamecallmethod")) {
      causes.push(
        {
          percent: 96,
          text: "A __namecall hook invokes the hooked method again rather than the saved original implementation.",
        },
        { percent: 4, text: "The hook has no re-entry guard for calls it initiates." },
      );
      fixes.push(
        "Avoid intercepting engine calls in normal game code. If wrapping your own functions, retain and call the original exactly once.",
      );
      example =
        'local function tracedPurchase(originalPurchase, player, itemId)\n    print("Purchase", itemId)\n    return originalPurchase(player, itemId)\nend';
    } else if (codeText.includes("__index") || codeText.includes("__newindex")) {
      causes.push(
        {
          percent: 95,
          text: "A __index or __newindex metamethod accesses or assigns through the same table, recursively triggering itself.",
        },
        { percent: 5, text: "The backing storage is not separate from the proxy table." },
      );
      fixes.push("Store proxy data in a separate table and use rawget/rawset inside metamethods.");
      example =
        "local storage = {}\nlocal proxy = setmetatable({}, {\n    __index = function(_, key) return storage[key] end,\n    __newindex = function(_, key, value) storage[key] = value end,\n})";
    } else {
      causes.push(
        {
          percent: 88,
          text: "A native/Lua boundary is being re-entered indefinitely by a wrapper, metamethod, or recursive callback.",
        },
        {
          percent: 12,
          text: "An overridden function calls itself because the original reference was not preserved.",
        },
      );
      fixes.push(
        "Keep original function references before wrapping and add clear termination/re-entry conditions.",
      );
      example =
        "local function wrap(original)\n    return function(...)\n        return original(...)\n    end\nend";
    }
    return {
      explanation:
        "Roblox exhausted its underlying C call stack. This is commonly caused by recursive metamethods or function hooks that call themselves.",
      causes,
      fixes,
      example,
      severity: "Critical",
      confidence: 97,
      ...diagnostics,
    };
  },
};
