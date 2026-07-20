import { describe, expect, it } from "vitest";
import {
  analyzeCodeContext,
  calculateConfidenceScore,
  isLocalScript,
  isServerScript,
} from "./contextAnalyzer";

describe("isServerScript", () => {
  it("detects ServerScriptService references in the log", () => {
    expect(isServerScript("ServerScriptService.Main:12: error", "")).toBe(true);
  });

  it("detects server-only APIs in the code", () => {
    expect(isServerScript("", 'game:GetService("DataStoreService")')).toBe(true);
  });

  it("does not flag a LocalScript log as server", () => {
    expect(isServerScript("StarterPlayerScripts.LocalScript:1: error", "")).toBe(false);
  });
});

describe("isLocalScript", () => {
  it("detects LocalPlayer usage in code", () => {
    expect(isLocalScript("", "local player = Players.LocalPlayer")).toBe(true);
  });

  it("detects StarterGui references in the log", () => {
    expect(isLocalScript("StarterGui.ScreenGui.LocalScript:5", "")).toBe(true);
  });
});

describe("analyzeCodeContext", () => {
  it("returns no issues for empty code", () => {
    expect(analyzeCodeContext("", "")).toEqual([]);
  });

  it("flags LocalPlayer usage inside a server script as Critical", () => {
    const issues = analyzeCodeContext(
      "local player = game.Players.LocalPlayer",
      "ServerScriptService.Main:1: error",
    );
    const issue = issues.find((i) => i.id === "LocalPlayerInsideServerScript");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("Critical");
  });

  it("flags DataStore calls made outside pcall", () => {
    const issues = analyzeCodeContext(
      'local data = myDataStore:GetAsync("key")',
      "",
    );
    expect(issues.some((i) => i.id === "GetAsyncOutsidePcall")).toBe(true);
  });

  it("does not flag DataStore calls that are wrapped in pcall", () => {
    const issues = analyzeCodeContext(
      'local ok, data = pcall(function() return myDataStore:GetAsync("key") end)',
      "",
    );
    expect(issues.some((i) => i.id === "GetAsyncOutsidePcall")).toBe(false);
  });
});

describe("calculateConfidenceScore", () => {
  it("caps the score at 100", () => {
    const score = calculateConfidenceScore(
      "attempt to index nil with 'Value'",
      'local x = game:GetService("Players").LocalPlayer.leaderstats.Coins.Value -- FindFirstChild WaitForChild',
      true,
    );
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns 0 for input with no matching signals", () => {
    const score = calculateConfidenceScore("", "", false);
    expect(score).toBe(0);
  });
});
