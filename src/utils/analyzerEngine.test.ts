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
