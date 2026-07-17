import { Platform, AnalyzerResult } from "./types";
import { CodeFacts } from "./types";
import { findMatch, type ErrorEntry } from "@/lib/error-parser";
import { analyzeSymbolIssues, buildExecutionPath } from "./semantic";

function buildBaseResult(entry: ErrorEntry | null, platform: Platform | undefined): Omit<AnalyzerResult, "rootCause" | "fix" | "correctedExample" | "evidence" | "executionPath" | "confidence" | "why" | "possibleRegressions" | "alternatives"> {
  const title = entry?.title ?? "Issue detected";
  const ruleId = entry ? entry.id : "code-analysis";
  return {
    matched: true,
    ruleId,
    title,
    platform: platform ?? entry?.platform ?? "roblox",
    rootCause: "",
    fix: "",
    correctedExample: undefined,
    evidence: [],
    executionPath: [],
    confidence: 0,
    why: "",
    possibleRegressions: [],
    alternatives: [],
  };
}

export function inferCause(
  logText: string,
  codeFacts: CodeFacts,
  platform: Platform | undefined,
): AnalyzerResult {
  const signal = logText.trim() ? findMatch(logText, codeFacts.lines.join("\n"), platform ?? "auto") : null;
  const entry = signal?.entry ?? null;
  const semanticIssues = analyzeSymbolIssues(codeFacts).map((issue) => ({
    reason: issue.reason,
    evidence: issue.evidence,
    confidence: issue.confidence,
  }));
  const fallbackIssues = analyzeCodeFacts(logText, codeFacts, entry);
  const issues = [...semanticIssues, ...fallbackIssues].sort((a, b) => b.confidence - a.confidence);
  const evidence = issues.flatMap((issue) => issue.evidence);
  const executionPath = buildExecutionPath(codeFacts);
  const confidence = Math.min(1, Math.max(0.35, evidence.length * 0.15 + (entry ? 0.2 : 0)));

  const rootCause = buildRootCause(logText, codeFacts, issues, entry);
  const fix = buildFix(logText, codeFacts, issues, entry);
  const possibleRegressions = inferRegressions(issues, entry);
  const alternatives = inferAlternatives(logText, codeFacts, entry, issues).map(
    (alternative) => alternative.hypothesis,
  );
  const why = buildWhy(rootCause, issues, entry);

  return {
    ...buildBaseResult(entry, platform),
    rootCause,
    fix,
    correctedExample: entry ? entry.analyze(logText, codeFacts.lines.join("\n")).example : undefined,
    evidence: [...new Set(evidence)],
    executionPath,
    confidence: Number((confidence * 100).toFixed(0)),
    why,
    possibleRegressions,
    alternatives,
  };
}

function analyzeCodeFacts(logText: string, codeFacts: CodeFacts, entry: ErrorEntry | null) {
  const issues = [] as Array<{ reason: string; evidence: string[]; confidence: number }>;
  const lower = logText.toLowerCase();

  if (entry?.id.includes("nil") || entry?.id.includes("null") || lower.includes("nil") || lower.includes("null") || lower.includes("undefined")) {
    issues.push({
      reason: "Missing guard or invalid reference before property access.",
      evidence: ["The error is consistent with a null/nil/undefined dereference."],
      confidence: 0.9,
    });
  }

  const staleSymbols = Object.values(codeFacts.symbolTable).filter((symbol) => symbol.mayBeStale);
  if (staleSymbols.length > 0) {
    staleSymbols.forEach((symbol) => {
      issues.push({
        reason: `Asynchronous or event-driven update may leave '${symbol.name}' stale.`,
        evidence: [`${symbol.name} is assigned in an async/event scope and later accessed outside that flow.`],
        confidence: 0.85,
      });
    });
  }

  const initialRefs = Object.values(codeFacts.symbolTable).filter((symbol) => symbol.referencedBeforeAssigned.length > 0);
  if (initialRefs.length > 0) {
    initialRefs.forEach((symbol) => {
      issues.push({
        reason: `Symbol '${symbol.name}' is used before initialization.`,
        evidence: symbol.referencedBeforeAssigned.map((line) => `Referenced before assigned at line ${line}.`),
        confidence: 0.92,
      });
    });
  }

  const asyncLoadCall = codeFacts.facts.find((fact) => /\b(LoadProfile|fetchData|Load\w*|fetch\w*|await|\.then\(|task\.|coroutine\.)\b/i.test(fact.raw));
  if (asyncLoadCall) {
    const callLine = asyncLoadCall.line;
    const staleCandidates = Object.values(codeFacts.symbolTable).filter(
      (symbol) =>
        symbol.assignments.some((assignmentLine) => assignmentLine < callLine) &&
        symbol.accesses.some((accessLine) => accessLine > callLine),
    );
    staleCandidates.forEach((symbol) => {
      issues.push({
        reason: `The value for '${symbol.name}' may be stale because an async or load action occurs after its initialization.`,
        evidence: [
          `${symbol.name} is initialized before line ${callLine} and accessed afterward, around an async/load transition.`,
        ],
        confidence: 0.88,
      });
    });
  }

  if (!entry && Object.values(codeFacts.symbolTable).some((symbol) => symbol.accesses.length > 0 && symbol.guards.length === 0)) {
    issues.push({
      reason: "Potential unchecked reference access.",
      evidence: ["Detected property access without an explicit null/nil/undefined guard."],
      confidence: 0.6,
    });
  }

  return issues.sort((a, b) => b.confidence - a.confidence);
}

function buildRootCause(logText: string, codeFacts: CodeFacts, issues: Array<{ reason: string; evidence: string[]; confidence: number }>, entry: ErrorEntry | null) {
  if (issues.length === 0) {
    return entry
      ? entry.analyze(logText, codeFacts.lines.join("\n")).explanation
      : "Unable to infer a stronger root cause from the provided code and error context.";
  }
  return [
    ...new Set(
      issues.map((issue) => issue.reason),
    )].join(" ");
}

function buildFix(logText: string, codeFacts: CodeFacts, issues: Array<{ reason: string; evidence: string[]; confidence: number }>, entry: ErrorEntry | null) {
  if (issues.some((issue) => issue.reason.includes("stale") || issue.reason.includes("async"))) {
    return "Verify asynchronous initialization and make sure the value is awaited or updated before it is accessed.";
  }
  if (issues.some((issue) => issue.reason.includes("before initialization"))) {
    return "Initialize the variable before using it, or guard it with a null/nil/undefined check before property access.";
  }
  if (entry) {
    const analysis = entry.analyze(logText, codeFacts.lines.join("\n"));
    return analysis.fixes[0] ?? "Review the code flow and add defensive checks around the failing reference.";
  }
  return "Review the line referenced by the error and ensure every object is valid before use. Add guards around uncertain values and keep async updates in sync.";
}

function inferRegressions(issues: Array<{ reason: string; evidence: string[]; confidence: number }>, entry: ErrorEntry | null) {
  const regressions: string[] = [];
  if (issues.some((issue) => issue.reason.includes("stale"))) {
    regressions.push("Future race conditions can occur when asynchronous initializations use shared state without awaiting them.");
  }
  if (issues.some((issue) => issue.reason.includes("before initialization"))) {
    regressions.push("The same symbol may fail again in adjacent lines or nested callbacks if initialization is not guaranteed.");
  }
  if (entry?.id.includes("unknown interaction")) {
    regressions.push("Discord interactions may continue to expire if replies are delayed or deferred incorrectly.");
  }
  return regressions;
}

function inferAlternatives(
  logText: string,
  codeFacts: CodeFacts,
  entry: ErrorEntry | null,
  issues: Array<{ reason: string; evidence: string[]; confidence: number }>,
) {
  const alternatives = [] as Array<{ hypothesis: string; confidence: number; evidence: string[] }>;
  if (!entry) {
    alternatives.push({
      hypothesis: "The failure may be caused by a mismatched API shape or platform-specific object not being available.",
      confidence: 0.45,
      evidence: ["No exact error pattern matched the provided log."],
    });
  }

  if (codeFacts.language === "lua" && issues.some((issue) => issue.reason.includes("async"))) {
    alternatives.push({
      hypothesis: "A missing WaitForChild() or delayed replication may be the real root cause.",
      confidence: 0.55,
      evidence: ["The code contains async/event-driven constructions with possible stale state."],
    });
  }

  return alternatives;
}

function buildWhy(rootCause: string, issues: Array<{ reason: string; evidence: string[]; confidence: number }>, entry: ErrorEntry | null) {
  const whyParts = [rootCause];
  if (entry) {
    whyParts.push(`Detected error type '${entry.title}' based on the log.`);
  }
  if (issues.length > 0) {
    whyParts.push(`This conclusion is supported by ${issues.length} semantic issue${issues.length > 1 ? "s" : ""}.`);
  }
  return whyParts.join(" ");
}
