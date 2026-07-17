import { buildCodeFacts } from "./parser";
import { detectCodeLanguage, resolvePlatform } from "./language";
import { inferCause } from "./inference";
import type { AnalyzerResult, Platform } from "./types";

export function analyzeCodeContext(
  logText: string,
  codeText: string,
  platformFilter?: Platform | "auto",
): AnalyzerResult {
  const platform = resolvePlatform(logText, codeText, platformFilter);
  const language = detectCodeLanguage(codeText);
  const codeFacts = buildCodeFacts(codeText, language);
  return inferCause(logText, codeFacts, platform);
}

export { AnalyzerResult, Platform };
