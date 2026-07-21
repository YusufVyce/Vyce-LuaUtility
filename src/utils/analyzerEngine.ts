import { extractVariableFlow, type VariableFlow } from "@/lib/analyzer/codeFlow";
import {
  buildAdvancedAnalysis,
  type AdvancedAnalyzerOutput,
} from "@/lib/analyzer/advancedRobloxAnalyzer";
import { runScanRules, type ScanWarning } from "@/lib/analyzer/scanner/rules";
import { scanCode } from "@/lib/analyzer/scanner/scanCode";
import { findMatch, ERROR_DICT } from "@/lib/error-parser";
import { enrichAnalysis } from "@/lib/analyzer/contextAnalyzer";

import type { Analysis, Cause, DeprecatedApi } from "@/lib/types";

/** Hard ceiling on input size so a pathological paste can't stall the UI thread. */
const MAX_INPUT_LENGTH = 200_000;

export type AnalyzerResult =
  | {
      severity?: "Low" | "Medium" | "High" | "Critical";
      confidence?: number;
      matched: true;
      ruleId: string;
      title: string;
      rootCause: string;
      fix: string;
      correctedExample: string | undefined;
      causes?: Cause[];
      fixes?: string[];

      codeInsights?: {
        title: string;
        description: string;
      }[];

      deprecatedApis?: DeprecatedApi[];
      scanWarnings?: ScanWarning[];
      variableFlow?: VariableFlow[];
      advanced?: AdvancedAnalyzerOutput;
    }
  | { matched: false; error?: string };

/**
 * Runs a single ErrorEntry's analyze() in isolation so that one misbehaving
 * (or third-party/community-contributed) rule can never take down the whole
 * analysis pipeline. Failures are logged with enough context to debug which
 * rule broke, then treated as "no useful signal" rather than a crash.
 */
function safeAnalyze(
  entry: (typeof ERROR_DICT)[number],
  logText: string,
  codeText: string,
): Analysis | null {
  try {
    return entry.analyze(logText, codeText);
  } catch (error) {
    console.error(`[analyzerEngine] rule "${entry.id}" threw during analyze():`, error);
    return null;
  }
}

/**
 * Analyzes a Roblox error log and/or the surrounding Lua code, returning a
 * best-effort diagnosis. Prefers matching against the log text (fast, high
 * confidence); when no log is supplied it falls back to scoring code-only
 * heuristics across the rule dictionary.
 *
 * This function never throws: any unexpected failure is caught, logged, and
 * surfaced to the caller as `{ matched: false, error }` so the UI can show a
 * graceful "couldn't analyze this" state instead of crashing.
 */
export function analyzeErrorAndCode(
  logText: string,
  codeText: string,
): AnalyzerResult {
  try {
    if (logText.length > MAX_INPUT_LENGTH || codeText.length > MAX_INPUT_LENGTH) {
      return {
        matched: false,
        error: `Input too large to analyze (limit is ${MAX_INPUT_LENGTH.toLocaleString()} characters).`,
      };
    }

    // Prefer log-based matching when logText is provided: it's a direct
    // regex/alias match against known Roblox error signatures, so it's both
    // cheaper and more reliable than scoring every rule against raw code.
    if (logText.trim().length > 0) {
      return analyzeFromLog(logText, codeText);
    }

    // No log to anchor on: fall back to scoring code-only heuristics.
    if (codeText.trim().length > 0) {
      return analyzeFromCodeOnly(codeText);
    }

    return { matched: false };
  } catch (error) {
    console.error("[analyzerEngine] analyzeErrorAndCode failed unexpectedly:", error);
    return { matched: false, error: "An unexpected error occurred while analyzing this input." };
  }
}

function analyzeFromLog(logText: string, codeText: string): AnalyzerResult {
  const match = findMatch(logText);
  if (!match) return { matched: false };

  const rawAnalysis = safeAnalyze(match.entry, logText, codeText);
  if (!rawAnalysis) {
    return { matched: false, error: `The "${match.entry.title}" rule failed to analyze this input.` };
  }

  const analysis = enrichAnalysis(rawAnalysis, logText, codeText);

  // Structural scan of the code (variable declarations, WaitForChild usage,
  // property-access chains) feeds additional lint-style warnings. These are
  // computed but not currently attached to the result — surfaced here as
  // `scanWarnings` so callers/UI can opt into them without recomputing.
  const scan = scanCode(codeText);
  const scanWarnings = runScanRules(scan);
  const variableFlow = extractVariableFlow(codeText);
  const advanced = buildAdvancedAnalysis(logText, codeText, analysis.fixes);

  return {
    matched: true,
    ruleId: match.entry.id,
    title: match.entry.title,
    rootCause: analysis.explanation,
    fix: analysis.fixes[0] ?? "No recommended fix available.",
    correctedExample: analysis.example,
    severity: analysis.severity,
    confidence: analysis.confidence ?? match.confidence,
    codeInsights: analysis.codeInsights,
    deprecatedApis: analysis.deprecatedApis,
    causes: analysis.causes,
    fixes: analysis.fixes,
    advanced,
    ...(scanWarnings.length > 0 ? { scanWarnings } : {}),
    ...(variableFlow.length > 0 ? { variableFlow } : {}),
  };
}

function analyzeFromCodeOnly(codeText: string): AnalyzerResult {
  // Score every rule by how much useful signal its analyze() call produces
  // for this code (more fixes / an example / more causes = a better guess).
  const scored = ERROR_DICT.map((entry) => {
    const analysis = safeAnalyze(entry, "", codeText);
    if (!analysis) return { entry, analysis: null, score: 0 };

    const score =
      (analysis.fixes?.length ?? 0) * 2 +
      (analysis.example ? 1 : 0) +
      (analysis.causes?.length ?? 0);

    return { entry, analysis, score };
  })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || !best.analysis) return { matched: false };

  const analysis = enrichAnalysis(best.analysis, "", codeText);
  const advanced = buildAdvancedAnalysis("", codeText, analysis.fixes);

  return {
    matched: true,
    ruleId: `code-only-${best.entry.id}`,
    title: `${best.entry.title} (code-only)`,
    rootCause: analysis.explanation,
    fix: analysis.fixes[0] ?? "Review the code for reported issues.",
    correctedExample: analysis.example,
    severity: analysis.severity,
    confidence: analysis.confidence,
    codeInsights: analysis.codeInsights,
    deprecatedApis: analysis.deprecatedApis,
    causes: analysis.causes,
    fixes: analysis.fixes,
    advanced,
  };
}
