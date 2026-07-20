import { describe, expect, it } from "vitest";
import { scanCode } from "./scanCode";
import { runScanRules } from "./rules";

describe("scanCode", () => {
  it("returns empty result for empty input", () => {
    const result = scanCode("");
    expect(result.variables).toEqual({});
    expect(result.propertyAccess).toEqual([]);
    expect(result.waitForChild).toEqual([]);
  });

  it("extracts local variable declarations", () => {
    const result = scanCode('local player = game.Players.LocalPlayer');
    expect(result.variables.player).toBe("game.Players.LocalPlayer");
  });

  it("collects WaitForChild call lines", () => {
    const result = scanCode(
      'local backpack = player:WaitForChild("Backpack")',
    );
    expect(result.waitForChild).toHaveLength(1);
  });

  it("collects dotted property-access chains", () => {
    const result = scanCode("local coins = player.leaderstats.Coins");
    expect(result.propertyAccess).toContain("player.leaderstats.Coins");
  });
});

describe("runScanRules", () => {
  it("warns once (not once per occurrence) when leaderstats is accessed repeatedly without WaitForChild", () => {
    const scan = scanCode(
      [
        "local coins = player.leaderstats.Coins",
        "local gems = player.leaderstats.Gems",
        "local rank = player.leaderstats.Rank",
      ].join("\n"),
    );

    const warnings = runScanRules(scan);
    const leaderstatsWarnings = warnings.filter(
      (w) => w.title === "Leaderstats access",
    );
    expect(leaderstatsWarnings).toHaveLength(1);
  });

  it("does not warn when leaderstats access is guarded by WaitForChild", () => {
    const scan = scanCode(
      [
        'local leaderstats = player:WaitForChild("leaderstats")',
        "local coins = leaderstats.Coins",
      ].join("\n"),
    );

    const warnings = runScanRules(scan);
    expect(warnings.filter((w) => w.title === "Leaderstats access")).toHaveLength(0);
  });
});
