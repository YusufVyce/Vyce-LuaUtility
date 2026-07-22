export type PerformanceIssue = {
  pattern: string;
  title: string;
  impact: "Low" | "Medium" | "High";
  description: string;
};

export const ROBLOX_PERFORMANCE: PerformanceIssue[] = [
  {
    pattern: "GetDescendants(",
    title: "Expensive GetDescendants()",
    impact: "Medium",
    description:
      "GetDescendants() scans every descendant. Cache the result if it is used frequently."
  },
  {
    pattern: "GetChildren(",
    title: "Repeated GetChildren()",
    impact: "Low",
    description:
      "Avoid repeatedly calling GetChildren() every frame. Cache the table when possible."
  },
  {
    pattern: "while true do",
    title: "Infinite Loop",
    impact: "High",
    description:
      "Infinite loops without proper yielding can freeze or lag the server."
  },
  {
    pattern: "RunService.Heartbeat",
    title: "Heartbeat Connection",
    impact: "Medium",
    description:
      "Avoid expensive logic inside Heartbeat callbacks."
  },
  {
    pattern: "RenderStepped",
    title: "RenderStepped Usage",
    impact: "Medium",
    description:
      "Only run visual updates inside RenderStepped."
  }
];