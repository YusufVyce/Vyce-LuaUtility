import { CodeFacts, SymbolSummary } from "./types";

export type SymbolIssue = {
  symbol: string;
  reason: string;
  evidence: string[];
  confidence: number;
};

export function analyzeSymbolIssues(codeFacts: CodeFacts): SymbolIssue[] {
  const issues: SymbolIssue[] = [];

  for (const symbol of Object.values(codeFacts.symbolTable)) {
    if (symbol.referencedBeforeAssigned.length > 0) {
      issues.push({
        symbol: symbol.name,
        reason: "Used before initialization",
        evidence: symbol.referencedBeforeAssigned.map((line) => `Access at line ${line} occurs before the first assignment.`),
        confidence: 0.9,
      });
    }

    if (symbol.mayBeStale) {
      issues.push({
        symbol: symbol.name,
        reason: "Possible stale reference after asynchronous assignment",
        evidence: [
          `The symbol '${symbol.name}' is assigned inside an async/event scope and later accessed afterward.`,
          `Assignments: ${symbol.asyncAssignments.join(", ")}; accesses: ${symbol.asyncAccesses.join(", ")}.`,
        ],
        confidence: 0.8,
      });
    }

    if (symbol.accesses.length > 0 && symbol.guards.length === 0 && symbol.declarations.length > 0 && symbol.assignments.length > 0) {
      const firstAccess = Math.min(...symbol.accesses);
      const lastGuard = symbol.guards[symbol.guards.length - 1] ?? -1;
      if (lastGuard < firstAccess) {
        issues.push({
          symbol: symbol.name,
          reason: "No guard exists before property access",
          evidence: [`'${symbol.name}' is accessed before any null/nil/undefined guard is found.`],
          confidence: 0.6,
        });
      }
    }
  }

  return issues.sort((a, b) => b.confidence - a.confidence);
}

export function buildExecutionPath(codeFacts: CodeFacts): string[] {
  const path: string[] = [];
  const eventScopes = codeFacts.facts.filter((fact) => fact.isEventScope).map((fact) => `event @ line ${fact.line}: ${fact.raw.trim()}`);
  const asyncScopes = codeFacts.facts.filter((fact) => fact.isAsyncScope).map((fact) => `async @ line ${fact.line}: ${fact.raw.trim()}`);

  if (eventScopes.length > 0) {
    path.push(...eventScopes.slice(0, 3));
  }
  if (asyncScopes.length > 0) {
    path.push(...asyncScopes.slice(0, 3));
  }

  if (path.length === 0) {
    path.push("Sequential execution from top to bottom.");
  }

  return path;
}
