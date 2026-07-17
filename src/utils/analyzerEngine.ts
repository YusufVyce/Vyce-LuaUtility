import { analyzeCodeContext, type AnalyzerResult } from "@/lib/analyzer/engine";
import type { Platform } from "@/lib/error-parser";

export type { Platform } from "@/lib/error-parser";
export type { AnalyzerResult };

export function analyzeErrorAndCode(
  logText: string,
  codeText: string,
  platformFilter?: Platform | "auto",
): AnalyzerResult {
  return analyzeCodeContext(logText, codeText, platformFilter);
}
