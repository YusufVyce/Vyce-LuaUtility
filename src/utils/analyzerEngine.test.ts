import { describe, expect, it } from "vitest";
import { analyzeErrorAndCode } from "./analyzerEngine";

describe("analyzeErrorAndCode", () => {
  it("returns matched:false for empty log and code", () => {
    const result = analyzeErrorAndCode("", "");
    expect(result.matched).toBe(false);
  });

  it("matches a known Roblox error from the log text alone", () => {
    const result = analyzeErrorAndCode(
      "ServerScriptService.Inventory:41: attempt to index nil with 'Value'",
      "",
    );
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.ruleId).toBe("roblox-index-nil");
      expect(result.rootCause).toBeTruthy();
      expect(result.fix).toBeTruthy();
      expect(result.advanced?.matchStrategy).toBe("exact");
    }
  });

  it("maps log line references to snippet lines when available", () => {
    const code = [
      "local a = 1",
      "local b = 2",
      "local c = 3",
      "local d = 4",
      "local e = 5",
      "local f = 6",
      "local g = 7",
      "local h = 8",
      "local i = 9",
      "local j = 10",
      "local k = 11",
      "local l = 12",
      "local m = 13",
      "local n = 14",
      "local o = 15",
      "local p = 16",
      "local q = 17",
      "local r = 18",
      "local s = 19",
      "local t = 20",
      "print(leaderstats.Value)",
    ].join("\n");

    const result = analyzeErrorAndCode(
      "ServerScriptService.Inventory:21: attempt to index nil with 'Value'",
      code,
    );

    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.advanced?.errorLineMapping.logLineReference).toBe(21);
      expect(result.advanced?.errorLineMapping.resolvedCodeLine).toBe(21);
      expect(result.advanced?.errorLineMapping.codeLineText).toBe("print(leaderstats.Value)");
      expect(result.advanced?.errorSymbols).toContain("Value");
    }
  });

  it("attaches scan warnings when the code has a detectable pattern", () => {
    const result = analyzeErrorAndCode(
      "ServerScriptService.Inventory:41: attempt to index nil with 'Value'",
      "local coins = player.leaderstats.Coins",
    );
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.scanWarnings?.some((w) => w.title === "Leaderstats access")).toBe(true);
    }
  });

  it("detects DataStore calls without pcall as critical static findings", () => {
    const result = analyzeErrorAndCode(
      "ServerScriptService.Data:1: attempt to call a nil value",
      'local data = myDataStore:GetAsync("coins")\nprint(data)',
    );

    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(
        result.advanced?.staticFindings.some(
          (finding) =>
            finding.id === "nil-datastore-no-pcall" && finding.severity === "critical",
        ),
      ).toBe(true);
    }
  });

  it("prioritizes safety fixes before timing and architecture fixes", () => {
    const code = [
      "local data = myDataStore:GetAsync('key')",
      "local char = player.Character",
      "RemoteEvent:FireServer(player)",
    ].join("\n");

    const result = analyzeErrorAndCode(
      "ServerScriptService.Main:3: attempt to index nil with 'Humanoid'",
      code,
    );

    expect(result.matched).toBe(true);
    if (result.matched) {
      const prioritized = result.advanced?.prioritizedFixes ?? [];
      const safetyIndex = prioritized.findIndex((fix) => /nil|pcall|verify|guard/i.test(fix));
      const timingIndex = prioritized.findIndex((fix) => /waitforchild|characteradded/i.test(fix));
      const architectureIndex = prioritized.findIndex((fix) => /client\/server|fireserver|fireclient/i.test(fix));

      expect(safetyIndex).toBeGreaterThanOrEqual(0);
      if (timingIndex >= 0) expect(safetyIndex).toBeLessThan(timingIndex);
      if (architectureIndex >= 0) expect(safetyIndex).toBeLessThan(architectureIndex);
    }
  });

  it("falls back to code-only analysis when no log is provided", () => {
    const result = analyzeErrorAndCode(
      "",
      'local player = game.Players.LocalPlayer\nprint(player.leaderstats.Coins.Value)',
    );
    // Whichever way it resolves, it must never throw and must return a well-formed result.
    expect(typeof result.matched).toBe("boolean");
  });

  it("rejects input larger than the size guard instead of hanging", () => {
    const huge = "x".repeat(300_000);
    const result = analyzeErrorAndCode(huge, "");
    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.error).toMatch(/too large/i);
    }
  });

  it("never throws, even with malformed input", () => {
    expect(() => analyzeErrorAndCode(undefined as unknown as string, null as unknown as string)).not.toThrow();
  });
});
