/** @deprecated Legacy analyzer module retained for compatibility only. Do not import in production runtime. */
import { describe, expect, it } from "vitest";
import { ERROR_DICT, findMatch } from "./error-parser";

describe("findMatch", () => {
  it("returns null for empty or whitespace-only input", () => {
    expect(findMatch("")).toBeNull();
    expect(findMatch("   ")).toBeNull();
  });

  it("matches a known error message via regex pattern with full confidence", () => {
    const result = findMatch(
      "ServerScriptService.Inventory:41: attempt to index nil with 'Value'",
    );
    expect(result).not.toBeNull();
    expect(result?.matchType).toBe("pattern");
    expect(result?.confidence).toBe(100);
  });

  it("returns null for text that matches nothing in the dictionary", () => {
    const result = findMatch("this is not a roblox error at all, just prose");
    expect(result).toBeNull();
  });

  it("every entry in ERROR_DICT has a usable id, title, and pattern", () => {
    for (const entry of ERROR_DICT) {
      expect(entry.id).toBeTruthy();
      expect(entry.title).toBeTruthy();
      expect(entry.pattern).toBeInstanceOf(RegExp);
    }
  });

  it("ids are unique across the dictionary", () => {
    const ids = ERROR_DICT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
