import { describe, expect, it } from "vitest";

import {
  CANONICAL_PATTERN_BY_ID,
  CANONICAL_PATTERN_DATABASE,
  CANONICAL_PATTERN_STATS,
  lookupCanonicalPattern,
} from "@/lib/analyzer/canonicalPatternDatabase";

describe("canonicalPatternDatabase", () => {
  it("contains exactly 810 sequential unique IDs", () => {
    expect(CANONICAL_PATTERN_DATABASE).toHaveLength(810);

    const ids = CANONICAL_PATTERN_DATABASE.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(810);

    for (let i = 1; i <= 810; i += 1) {
      expect(ids[i - 1]).toBe(i);
      expect(CANONICAL_PATTERN_BY_ID.get(i)?.id).toBe(i);
    }
  });

  it("has unique signatures and valid metadata fields", () => {
    const signatures = CANONICAL_PATTERN_DATABASE.map((entry) => entry.signature);
    expect(new Set(signatures).size).toBe(810);

    const categories = new Set(CANONICAL_PATTERN_DATABASE.map((entry) => entry.category));
    expect(categories.size).toBe(18);

    for (const entry of CANONICAL_PATTERN_DATABASE) {
      expect(["Critical", "High", "Medium", "Low"]).toContain(entry.severity);
      expect(["exact", "regex", "partial"]).toContain(entry.matchType);
      expect(entry.commonCauses.length).toBeGreaterThanOrEqual(1);
      expect(entry.commonCauses.length).toBeLessThanOrEqual(5);
      expect(entry.contextClues.length).toBeGreaterThanOrEqual(1);
      expect(entry.fixTemplates.length).toBeGreaterThanOrEqual(3);
      expect(entry.fixTemplates.length).toBeLessThanOrEqual(5);
      expect(entry.prevention.length).toBeGreaterThanOrEqual(1);
      expect(entry.relatedPatterns.length).toBeGreaterThanOrEqual(1);
      for (const relatedId of entry.relatedPatterns) {
        expect(relatedId).toBeGreaterThanOrEqual(1);
        expect(relatedId).toBeLessThanOrEqual(810);
        expect(CANONICAL_PATTERN_BY_ID.has(relatedId)).toBe(true);
      }
    }
  });

  it("keeps expected category counts by spec", () => {
    expect(CANONICAL_PATTERN_STATS.total).toBe(810);
    expect(CANONICAL_PATTERN_STATS.byCategory["NIL REFERENCE"]).toBe(60);
    expect(CANONICAL_PATTERN_STATS.byCategory["TYPE MISMATCH"]).toBe(80);
    expect(CANONICAL_PATTERN_STATS.byCategory["TIMING & ASYNC"]).toBe(60);
    expect(CANONICAL_PATTERN_STATS.byCategory["STACK & RECURSION"]).toBe(40);
    expect(CANONICAL_PATTERN_STATS.byCategory["CLIENT/SERVER"]).toBe(50);
    expect(CANONICAL_PATTERN_STATS.byCategory["DATASTORE & PERFORMANCE"]).toBe(50);
    expect(CANONICAL_PATTERN_STATS.byCategory["TWEEN & ANIMATION"]).toBe(50);
    expect(CANONICAL_PATTERN_STATS.byCategory["GUI & INSTANCES"]).toBe(80);
    expect(CANONICAL_PATTERN_STATS.byCategory["PHYSICS & CONSTRAINTS"]).toBe(60);
    expect(CANONICAL_PATTERN_STATS.byCategory["SERVICES & APIS"]).toBe(60);
    expect(CANONICAL_PATTERN_STATS.byCategory["SECURITY & SANDBOX"]).toBe(40);
    expect(CANONICAL_PATTERN_STATS.byCategory["MEMORY & RESOURCES"]).toBe(30);
    expect(CANONICAL_PATTERN_STATS.byCategory["UTF-8 & ENCODING"]).toBe(20);
    expect(CANONICAL_PATTERN_STATS.byCategory["MODULES & REQUIRE"]).toBe(50);
    expect(CANONICAL_PATTERN_STATS.byCategory["MATH & NUMBER"]).toBe(20);
    expect(CANONICAL_PATTERN_STATS.byCategory["DATE & TIME"]).toBe(20);
    expect(CANONICAL_PATTERN_STATS.byCategory["RANDOM & NOISE"]).toBe(20);
    expect(CANONICAL_PATTERN_STATS.byCategory["TABLE OPERATIONS"]).toBe(20);
  });

  it("matches at least 50 sampled canonical signatures exactly", () => {
    const sampleIds = [
      1, 10, 20, 30, 40, 50, 60,
      61, 76, 96, 116, 131, 140,
      141, 156, 171, 186, 200,
      201, 221, 240,
      241, 256, 271, 290,
      291, 311, 326, 340,
      341, 366, 381, 390,
      391, 411, 431, 451, 470,
      471, 491, 501, 516, 530,
      531, 551, 566, 581, 590,
      591, 601, 616, 630,
      631, 646, 660,
      661, 671, 680,
      681, 701, 716, 730,
      731, 740, 750,
      751, 760, 770,
      771, 780, 790,
      791, 800, 810,
    ];

    expect(sampleIds.length).toBeGreaterThanOrEqual(50);

    for (const id of sampleIds) {
      const entry = CANONICAL_PATTERN_BY_ID.get(id);
      expect(entry).toBeTruthy();
      const matched = lookupCanonicalPattern(entry!.signature);
      expect(matched?.id).toBe(id);
    }
  });

  it("supports regex and partial fallback matching", () => {
    const regexLog = "bad argument #1 to 'FindFirstChild' (table expected, got nil)";
    const regexMatch = lookupCanonicalPattern(regexLog);
    expect(regexMatch?.id).toBe(76);

    const regexServiceLog = "TeleportService:Teleport failed - not authorized";
    const regexServiceMatch = lookupCanonicalPattern(regexServiceLog);
    expect(regexServiceMatch?.id).toBe(534);

    const partialLog = "Runtime error: DateTime.fromIsoDate invalid format while parsing user input";
    const partialMatch = lookupCanonicalPattern(partialLog);
    expect(partialMatch?.id).toBe(754);
  });
});
