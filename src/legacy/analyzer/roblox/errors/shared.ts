import { collectRobloxDiagnostics } from "../../robloxDiagnostics";
import type { Analysis, Cause, ErrorEntry } from "../../../types";

export type StaticErrorEntry = ErrorEntry & {
  severity: NonNullable<Analysis["severity"]>;
  confidence: number;
};

export function analysis(
  codeSnippet: string,
  explanation: string,
  causes: Cause[],
  fixes: string[],
  example: string,
  severity: NonNullable<Analysis["severity"]>,
  confidence: number,
): Analysis {
  return {
    explanation,
    causes,
    fixes,
    example,
    severity,
    confidence,
    ...collectRobloxDiagnostics(codeSnippet),
  };
}
