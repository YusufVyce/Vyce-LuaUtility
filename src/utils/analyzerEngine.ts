import {
  findMatch,
  type Platform,
  ERROR_DICT,
  detectPlatform,
} from "@/lib/error-parser";

export type AnalyzerResult =
  | {
      matched: true;
      ruleId: string;
      title: string;
      platform: Platform;
      rootCause: string;
      fix: string;
      correctedExample: string | undefined;
    }
  | { matched: false };

export type { Platform } from "@/lib/error-parser";

export function analyzeErrorAndCode(
  logText: string,
  codeText: string,
  platformFilter?: Platform,
): AnalyzerResult {
  // Prefer log-based matching when logText is provided
  const platformArg = platformFilter === undefined ? "auto" : platformFilter;
  if (logText && logText.trim().length > 0) {
    const match = findMatch(logText, codeText, platformArg as any);
    if (!match) return { matched: false };
    const analysis = match.entry.analyze(logText, codeText);
    return {
      matched: true,
      ruleId: match.entry.id,
      title: match.entry.title,
      platform: match.entry.platform,
      rootCause: analysis.explanation,
      fix: analysis.fixes[0] ?? "No recommended fix available.",
      correctedExample: analysis.example,
    };
  }

  // If no log provided but code exists, attempt code-only analysis using rule heuristics.
  if (codeText && codeText.trim().length > 0) {
    const detected =
      platformFilter === "auto" || platformFilter === undefined
        ? detectPlatform(codeText)
        : platformFilter;
    const candidates = detected
      ? ERROR_DICT.filter((e) => e.platform === detected)
      : ERROR_DICT;

    // Score candidates by whether their analyze() returns useful fixes/examples
    const scored = candidates
      .map((entry) => {
        try {
          const analysis = entry.analyze("", codeText);
          const score = (analysis.fixes?.length || 0) * 2 + (analysis.example ? 1 : 0) + (analysis.causes?.length || 0);
          return { entry, analysis, score };
        } catch (e) {
          return { entry, analysis: null, score: 0 };
        }
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return { matched: false };

    const best = scored[0];
    return {
      matched: true,
      ruleId: `code-only-${best.entry.id}`,
      title: best.entry.title + " (code-only)",
      platform: best.entry.platform,
      rootCause: best.analysis?.explanation ?? "Potential issue detected in code.",
      fix: best.analysis?.fixes?.[0] ?? "Review the code for reported issues.",
      correctedExample: best.analysis?.example,
    };
  }

  return { matched: false };
}
