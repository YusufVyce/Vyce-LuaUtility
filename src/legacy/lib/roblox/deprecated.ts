export type DeprecatedRule = {
  pattern: string;
  api: string;
  replacement: string;
  reason: string;
};

export const ROBLOX_DEPRECATED: DeprecatedRule[] = [
  {
    pattern: "wait(",
    api: "wait()",
    replacement: "task.wait()",
    reason:
      "wait() is deprecated. task.wait() is more accurate and uses Roblox's modern scheduler."
  },

  {
    pattern: "spawn(",
    api: "spawn()",
    replacement: "task.spawn()",
    reason:
      "spawn() is deprecated. task.spawn() provides better scheduling."
  },

  {
    pattern: "delay(",
    api: "delay()",
    replacement: "task.delay()",
    reason:
      "delay() is deprecated. task.delay() should be used instead."
  }
];