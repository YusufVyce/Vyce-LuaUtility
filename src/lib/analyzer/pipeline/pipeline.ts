import { classifyErrorFamily } from "./classifier";
import { applyConfidenceScores } from "./confidenceScorer";
import { extractContext } from "./contextExtractor";
import { runEvidenceEngine } from "./evidenceEngine";
import { generateExplanation } from "./explanationGenerator";
import { generateFixes } from "./fixGenerator";
import { runHypothesisEngine } from "./hypothesisEngine";
import { ROBLOX_DIAGNOSTIC_KNOWLEDGE_BASE } from "./knowledgeBase";
import { normalizeInput } from "./normalizer";
import { analyzePerformance } from "./performanceAnalyzer";
import { getRelatedDiagnostics } from "./relatedDiagnostics";
import { analyzeSecurity } from "./securityAnalyzer";
import { analyzeBestPractices } from "./bestPracticesAnalyzer";
import { tokenizeInput } from "./tokenizer";
import type { DynamicAnalysisResult } from "./types";

function prioritizeHighlights(
  highlights: DynamicAnalysisResult["highlightedCode"],
  lineReference?: number,
): DynamicAnalysisResult["highlightedCode"] {
  if (!lineReference) return highlights.slice(0, 8);

  const exact = highlights.filter((item) => item.line === lineReference);
  const nearby = highlights.filter(
    (item) => item.line !== lineReference && Math.abs(item.line - lineReference) <= 2,
  );
  const remaining = highlights.filter((item) => Math.abs(item.line - lineReference) > 2);

  return [...exact, ...nearby, ...remaining].slice(0, 8);
}

export function runDynamicRobloxPipeline(logText: string, codeText: string): DynamicAnalysisResult | null {
  const normalized = normalizeInput(logText, codeText);
  if (!normalized.normalizedLog && !normalized.normalizedCode.trim()) {
    return null;
  }

  const tokenized = tokenizeInput(normalized.compactLog, normalized.normalizedCode);
  const classified = classifyErrorFamily(normalized.compactLog);
  const context = extractContext(normalized.normalizedCode, normalized.normalizedLog, tokenized.parserTokens);
  const signals = runEvidenceEngine(classified, context, tokenized, normalized.normalizedLog);
  const hypotheses = applyConfidenceScores(runHypothesisEngine(signals));
  const selectedHypothesis = hypotheses[0];

  if (!selectedHypothesis) {
    return null;
  }

  const explanationBlock = generateExplanation(selectedHypothesis, classified, context);
  const fixes = generateFixes(selectedHypothesis);
  const relatedDiagnostics = getRelatedDiagnostics(classified, context);
  const performanceNotes = analyzePerformance(context);
  const securityNotes = analyzeSecurity(context);
  const bestPractices = analyzeBestPractices(context);

  const matchingRules = selectedHypothesis.evidence.map((item) => item.id);
  const commonMistakes = selectedHypothesis.relatedErrors.slice(0, 5);

  return {
    title: selectedHypothesis.title,
    family: classified.family,
    strategy: classified.strategy,
    severity: selectedHypothesis.severity,
    confidence: selectedHypothesis.confidence,
    quickSummary: explanationBlock.quickSummary,
    likelyRootCause: selectedHypothesis.rootCause,
    explanation: explanationBlock.explanation,
    hypotheses,
    selectedHypothesis,
    evidence: selectedHypothesis.evidence,
    matchingRules,
    highlightedCode: prioritizeHighlights(context.highlights, classified.lineReference),
    fixes,
    docs: selectedHypothesis.docs,
    relatedDiagnostics,
    relatedApis: selectedHypothesis.relatedApis,
    performanceNotes,
    securityNotes,
    bestPractices,
    commonMistakes,
    estimatedFixTime: selectedHypothesis.estimatedFixTime,
    difficulty: selectedHypothesis.difficulty,
    knowledgeBaseSize: ROBLOX_DIAGNOSTIC_KNOWLEDGE_BASE.length,
  };
}
