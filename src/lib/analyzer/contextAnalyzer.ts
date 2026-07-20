import type { Analysis, Cause } from "../types";
import { findMatch } from "../error-parser";
import { extractVariableFlow } from "./codeFlow";
import { CONTEXT_RULES, type ContextIssue, type ContextRuleInput } from "./contextRules";

export type { ContextIssue } from "./contextRules";

/**
 * Helper to check if the code represents a Server-side Script.
 */
export function isServerScript(logText: string, codeText: string): boolean {
  const logLower = logText.toLowerCase();
  if (
    logLower.includes("serverscriptservice") ||
    logLower.includes("serverscript") ||
    logLower.includes("server script")
  ) {
    return true;
  }
  // Check code signatures
  if (
    codeText.includes("DataStoreService") ||
    codeText.includes("HttpService") ||
    codeText.includes("MessagingService")
  ) {
    return true;
  }
  // Default to server if we see general script references but not localscript
  if (logLower.includes("script") && !logLower.includes("localscript")) {
    return true;
  }
  return false;
}

/**
 * Helper to check if the code represents a Client-side LocalScript.
 */
export function isLocalScript(logText: string, codeText: string): boolean {
  const logLower = logText.toLowerCase();
  if (
    logLower.includes("localscript") ||
    logLower.includes("starterplayer") ||
    logLower.includes("startergui") ||
    logLower.includes("playergui")
  ) {
    return true;
  }
  if (
    codeText.includes("LocalPlayer") ||
    codeText.includes("MouseButton1Click") ||
    codeText.includes("TouchTap")
  ) {
    return true;
  }
  return false;
}

/**
 * Analyzes the Lua code and log text for common Roblox patterns and issues.
 *
 * The actual heuristics live in `CONTEXT_RULES` (contextRules.ts) as a table
 * of `{ ...issue content, test(ctx) }` entries; this function just builds the
 * shared context once and evaluates each rule against it, in order. Order is
 * significant: `enrichAnalysis` uses the first matching issue's
 * `correctedExample` as the representative example for the whole analysis.
 */
export function analyzeCodeContext(codeText: string, logText: string): ContextIssue[] {
  const code = codeText.trim();
  const log = logText.trim();

  if (!code) return [];

  const ctx: ContextRuleInput = {
    code,
    log,
    serverCtx: isServerScript(log, code),
    clientCtx: isLocalScript(log, code),
  };

  const issues: ContextIssue[] = [];
  for (const rule of CONTEXT_RULES) {
    if (!rule.test(ctx)) continue;
    // Strip the `test` function off — callers only care about the issue content.
    const { test: _test, ...issue } = rule;
    issues.push(issue);
  }

  return issues;
}

/**
 * Calculates a 0-100 confidence score for how sure the analyzer is about its
 * diagnosis, based on how many independent signals (regex match, context
 * rules, known Roblox APIs, nil-prone chains, traceable variable flow) agree.
 */
export function calculateConfidenceScore(
  logText: string,
  codeText: string,
  hasIssues: boolean,
): number {
  let score = 0;

  // 1. Regex Match (40 pts)
  const match = findMatch(logText);
  if (match) {
    score += 40;
  }

  // 2. Context Pattern Match (+20 pts)
  if (hasIssues) {
    score += 20;
  }

  // 3. Roblox API detection (+15 pts)
  const hasRobloxApi =
    codeText.includes("game:") ||
    codeText.includes("GetService") ||
    codeText.includes("WaitForChild") ||
    codeText.includes("FindFirstChild") ||
    codeText.includes("Instance.new") ||
    codeText.includes("Players") ||
    codeText.includes("workspace");
  if (hasRobloxApi) {
    score += 15;
  }

  // 4. Nil Chain detection (+15 pts)
  const hasNilChain =
    /\w+\.\w+\.\w+\.\w+/.test(codeText) ||
    codeText.includes("FindFirstChild") ||
    codeText.includes("WaitForChild") ||
    /:FindFirstChild\([^)]+\)\.Value/.test(codeText);
  if (hasNilChain) {
    score += 15;
  }

  // 5. Variable Flow (+10 pts)
  const flows = extractVariableFlow(codeText);
  if (flows.length > 0) {
    score += 10;
  }

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Enriches the initial analysis object using the Context Analyzer: detected
 * context issues become the top-ranked causes/fixes/example, and the
 * analysis's own original causes are kept but scaled down beneath them.
 */
export function enrichAnalysis(analysis: Analysis, logText: string, codeText: string): Analysis {
  const issues = analyzeCodeContext(codeText, logText);
  const confidence = calculateConfidenceScore(logText, codeText, issues.length > 0);

  // If no issues were found, just return original with calculated confidence
  if (issues.length === 0) {
    return {
      ...analysis,
      confidence,
    };
  }

  // Detected context issues become the highest-ranked causes.
  const rankedCauses: Cause[] = issues.map((issue) => ({
    percent: issue.likelihood,
    text: `${issue.title}: ${issue.description}`,
  }));

  // Include the analysis's original causes too, but scaled down so they sit
  // beneath the detected context issues rather than competing with them.
  if (analysis.causes && analysis.causes.length > 0) {
    const sortedOriginals = [...analysis.causes].sort((a, b) => b.percent - a.percent);

    const maxLikelihood = issues.reduce((max, issue) => Math.max(max, issue.likelihood), 0);
    // e.g. if maxLikelihood is 95, scale originals down to start around 80.
    const scaleMax = Math.max(30, maxLikelihood - 15);

    sortedOriginals.forEach((cause, idx) => {
      const scaledPercent = Math.max(10, Math.round(scaleMax * (cause.percent / 100) * (1 - idx * 0.2)));
      const isDuplicate = rankedCauses.some((rc) =>
        rc.text.toLowerCase().includes(cause.text.toLowerCase().slice(0, 20)),
      );
      if (!isDuplicate) {
        rankedCauses.push({ percent: scaledPercent, text: cause.text });
      }
    });
  }

  rankedCauses.sort((a, b) => b.percent - a.percent);

  // Context-derived fixes are the most actionable, so they go first.
  const enrichedFixes = [...analysis.fixes];
  for (const issue of issues) {
    if (!enrichedFixes.includes(issue.suggestedFix)) {
      enrichedFixes.unshift(issue.suggestedFix);
    }
  }

  // The first matching rule's example is the most representative one.
  const bestExample = issues[0]?.correctedExample || analysis.example;

  const enrichedInsights = [...(analysis.codeInsights || [])];
  for (const issue of issues) {
    if (!enrichedInsights.some((insight) => insight.title === issue.title)) {
      enrichedInsights.push({ title: issue.title, description: issue.description });
    }
  }

  return {
    ...analysis,
    causes: rankedCauses,
    fixes: enrichedFixes,
    example: bestExample,
    confidence,
    codeInsights: enrichedInsights,
  };
}
