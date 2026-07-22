import {
  ROBLOX_DIAGNOSTIC_KNOWLEDGE_BASE,
  runDynamicRobloxPipeline,
  type DynamicAnalysisResult,
  type MatchStrategy,
} from "@/lib/analyzer/pipeline";

export interface ErrorLineMapping {
  logLineReference?: number;
  resolvedCodeLine?: number;
  codeLineText?: string;
}

export interface StaticFinding {
  id: string;
  category:
    | "nil-safety"
    | "timing"
    | "type"
    | "architecture"
    | "performance"
    | "service-usage";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  line?: number;
  symbol?: string;
  evidence?: string;
}

export interface FixTemplateOption {
  id: string;
  priority: 1 | 2 | 3 | 4 | 5;
  title: string;
  whyItWorks: string;
  template: string;
}

export interface AdvancedAnalyzerOutput {
  matchStrategy: MatchStrategy;
  matchedRuleId?: string;
  errorLineMapping: ErrorLineMapping;
  errorSymbols: string[];
  staticFindings: StaticFinding[];
  prioritizedFixes: string[];
  fixTemplates: FixTemplateOption[];
  patternDatabaseSize: number;

  quickSummary?: string;
  likelyRootCause?: string;
  evidence?: Array<{ id: string; message: string; score: number; line?: number }>;
  matchingRules?: string[];
  highlightedCode?: Array<{ line: number; text: string; variable?: string; functionName?: string; property?: string }>;
  docs?: string[];
  relatedDiagnostics?: string[];
  relatedApis?: string[];
  performanceNotes?: Array<{ title: string; description: string }>;
  securityNotes?: Array<{ title: string; description: string }>;
  bestPractices?: Array<{ title: string; description: string }>;
  commonMistakes?: string[];
  estimatedFixTime?: string;
  difficulty?: "Easy" | "Moderate" | "Hard";
  hypotheses?: Array<{ title: string; confidence: number; rootCause: string }>;
}

function toAdvancedAnalyzerOutput(
  result: DynamicAnalysisResult,
  logText: string,
  codeText: string,
  existingFixes: string[] = [],
): AdvancedAnalyzerOutput {
  const lineReference = parseLogLineReference(logText);
  const lineText = lineReference ? getCodeLine(codeText, lineReference) : undefined;

  const staticFindings: StaticFinding[] = result.evidence.map((item) => ({
    id: item.id === "datastore-no-pcall" ? "nil-datastore-no-pcall" : item.id,
    category: toStaticCategory(result.selectedHypothesis.title),
    severity: item.id === "datastore-no-pcall" ? "critical" : toSeverityLabel(item.score),
    message: item.message,
    line: item.line,
    evidence: `score +${item.score}`,
  }));

  const candidateFixes = [
    ...existingFixes,
    ...result.hypotheses.flatMap((item) => [item.fixes.minimal, item.fixes.better]),
    result.fixes.minimal,
    result.fixes.better,
    result.fixes.production,
  ].filter((value, index, arr) => value && arr.indexOf(value) === index);

  const prioritizedFixes = candidateFixes.sort((a, b) => fixPriorityScore(a) - fixPriorityScore(b));

  const errorSymbols = result.highlightedCode
    .map((item) => item.variable ?? item.property ?? item.functionName)
    .filter((value): value is string => Boolean(value));

  return {
    matchStrategy: result.strategy,
    matchedRuleId: result.family,
    errorLineMapping: {
      logLineReference: lineReference,
      resolvedCodeLine: lineText ? lineReference : result.highlightedCode[0]?.line,
      codeLineText: lineText ?? result.highlightedCode[0]?.text,
    },
    errorSymbols,
    staticFindings,
    prioritizedFixes,
    fixTemplates: buildTemplates(result),
    patternDatabaseSize: result.knowledgeBaseSize,
    quickSummary: result.quickSummary,
    likelyRootCause: result.likelyRootCause,
    evidence: result.evidence,
    matchingRules: result.matchingRules,
    highlightedCode: result.highlightedCode,
    docs: result.docs,
    relatedDiagnostics: result.relatedDiagnostics,
    relatedApis: result.relatedApis,
    performanceNotes: result.performanceNotes,
    securityNotes: result.securityNotes,
    bestPractices: result.bestPractices,
    commonMistakes: result.commonMistakes,
    estimatedFixTime: result.estimatedFixTime,
    difficulty: result.difficulty,
    hypotheses: result.hypotheses.map((item) => ({
      title: item.title,
      confidence: item.confidence,
      rootCause: item.rootCause,
    })),
  };
}

function parseLogLineReference(logText: string): number | undefined {
  const match = logText.match(/:(\d+):/);
  if (!match) return undefined;
  const lineNo = Number.parseInt(match[1], 10);
  return Number.isFinite(lineNo) && lineNo > 0 ? lineNo : undefined;
}

function getCodeLine(codeText: string, lineNumber: number): string | undefined {
  const lines = codeText.split(/\r?\n/);
  if (lineNumber <= 0 || lineNumber > lines.length) return undefined;
  return lines[lineNumber - 1]?.trim() || undefined;
}

function toStaticCategory(domain: string): StaticFinding["category"] {
  const lowered = domain.toLowerCase();
  if (lowered.includes("performance")) return "performance";
  if (lowered.includes("network")) return "architecture";
  if (lowered.includes("replication") || lowered.includes("character")) return "timing";
  if (lowered.includes("type")) return "type";
  if (lowered.includes("runtime")) return "nil-safety";
  return "service-usage";
}

function toSeverityLabel(score: number): StaticFinding["severity"] {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function fixPriorityScore(fix: string): number {
  const text = fix.toLowerCase();
  if (/(nil|pcall|guard|verify|assert)/.test(text)) return 1;
  if (/(waitforchild|characteradded|timeout|replication)/.test(text)) return 2;
  if (/(type|cast|tonumber|tostring)/.test(text)) return 3;
  if (/(remote|fireserver|fireclient|invoke)/.test(text)) return 4;
  return 5;
}

function buildTemplates(result: DynamicAnalysisResult): FixTemplateOption[] {
  const fixes = result.fixes;
  return [
    {
      id: "minimal-fix",
      priority: 1,
      title: "Minimal Fix",
      whyItWorks: "Stops the immediate runtime failure at the highlighted point.",
      template: fixes.minimal,
    },
    {
      id: "better-fix",
      priority: 3,
      title: "Better Fix",
      whyItWorks: "Improves correctness by addressing the broader context around the failure.",
      template: fixes.better,
    },
    {
      id: "production-fix",
      priority: 5,
      title: "Production Fix",
      whyItWorks: "Hardens the subsystem against regressions and intermittent runtime behavior.",
      template: fixes.production,
    },
  ];
}

export function buildAdvancedAnalysis(
  logText: string,
  codeText: string,
  existingFixes: string[] = [],
): AdvancedAnalyzerOutput {
  const result = runDynamicRobloxPipeline(logText, codeText);
  const lineReference = parseLogLineReference(logText);
  const lineText = lineReference ? getCodeLine(codeText, lineReference) : undefined;

  if (!result) {
    return {
      matchStrategy: "none",
      errorLineMapping: {
        logLineReference: lineReference,
        resolvedCodeLine: lineText ? lineReference : undefined,
        codeLineText: lineText,
      },
      errorSymbols: [],
      staticFindings: [],
      prioritizedFixes: existingFixes,
      fixTemplates: [],
      patternDatabaseSize: ROBLOX_DIAGNOSTIC_KNOWLEDGE_BASE.length,
    };
  }

  return toAdvancedAnalyzerOutput(result, logText, codeText, existingFixes);
}

export function buildAdvancedAnalysisFromDynamicResult(
  result: DynamicAnalysisResult,
  logText: string,
  codeText: string,
  existingFixes: string[] = [],
): AdvancedAnalyzerOutput {
  return toAdvancedAnalyzerOutput(result, logText, codeText, existingFixes);
}