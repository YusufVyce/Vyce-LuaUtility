import {
  buildAdvancedAnalysisFromDynamicResult,
  type AdvancedAnalyzerOutput,
} from "@/lib/analyzer/advancedRobloxAnalyzer";
import { runDynamicRobloxPipeline } from "@/lib/analyzer/pipeline";

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
      advanced?: AdvancedAnalyzerOutput;
    }
  | { matched: false; error?: string };

/**
 * Analyzes a Roblox error log and/or surrounding Luau code using a modular,
 * evidence-scored pipeline.
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
    const safeLogText = typeof logText === "string" ? logText : "";
    const safeCodeText = typeof codeText === "string" ? codeText : "";

    if (safeLogText.length > MAX_INPUT_LENGTH || safeCodeText.length > MAX_INPUT_LENGTH) {
      return {
        matched: false,
        error: `Input too large to analyze (limit is ${MAX_INPUT_LENGTH.toLocaleString()} characters).`,
      };
    }

    return analyzeWithPipeline(safeLogText, safeCodeText);
  } catch (error) {
    console.error("[analyzerEngine] analyzeErrorAndCode failed unexpectedly:", error);
    return { matched: false, error: "An unexpected error occurred while analyzing this input." };
  }
}

const LEGACY_RULE_IDS: Record<string, string> = {
  INDEX_NIL: "roblox-index-nil",
  CALL_NIL: "roblox-call-nil",
  CONCAT_NIL: "roblox-concat-nil",
  ARITHMETIC_NIL: "roblox-arithmetic-nil",
  COMPARE_NIL: "roblox-compare-nil",
  INVALID_ARGUMENT: "roblox-invalid-argument",
  INVALID_MEMBER: "roblox-invalid-member",
  INVALID_TYPE: "roblox-invalid-type",
  DATASTORE: "roblox-datastore",
  REMOTE: "roblox-remote",
  TWEEN: "roblox-tween",
  CHARACTER: "roblox-character",
  WAIT: "roblox-wait",
  TIMEOUT: "roblox-timeout",
  HTTP: "roblox-http",
  MEMORY: "roblox-memory",
  UNKNOWN: "roblox-unknown",
};

function analyzeWithPipeline(logText: string, codeText: string): AnalyzerResult {
  if (logText.trim().length === 0 && codeText.trim().length === 0) {
    return { matched: false };
  }

  const dynamic = runDynamicRobloxPipeline(logText, codeText);
  if (!dynamic) {
    return { matched: false };
  }

  const fixes = [dynamic.fixes.minimal, dynamic.fixes.better, dynamic.fixes.production];
  const causes: Cause[] = dynamic.hypotheses.map((item) => ({
    percent: item.confidence,
    text: `${item.title}: ${item.rootCause}`,
  }));

  const analysisLike: Analysis = {
    explanation: dynamic.explanation,
    causes,
    fixes,
    severity: dynamic.severity,
    confidence: dynamic.confidence,
    codeInsights: dynamic.bestPractices.map((item) => ({
      title: item.title,
      description: item.description,
    })),
    deprecatedApis: [],
    performanceIssues: dynamic.performanceNotes.map((item) => ({
      title: item.title,
      impact: "Medium" as const,
      description: item.description,
    })),
    securityIssues: dynamic.securityNotes.map((item) => ({
      title: item.title,
      severity: "High" as const,
      description: item.description,
    })),
  };

  const advanced = buildAdvancedAnalysisFromDynamicResult(dynamic, logText, codeText, fixes);

  return {
    matched: true,
    ruleId: LEGACY_RULE_IDS[dynamic.family] ?? "roblox-unknown",
    title: dynamic.title,
    rootCause: analysisLike.explanation,
    fix: fixes[0],
    correctedExample: undefined,
    severity: analysisLike.severity,
    confidence: analysisLike.confidence,
    codeInsights: analysisLike.codeInsights,
    deprecatedApis: analysisLike.deprecatedApis as DeprecatedApi[],
    causes: analysisLike.causes,
    fixes: analysisLike.fixes,
    advanced,
  };
}
