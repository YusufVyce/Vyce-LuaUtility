export type Platform = "roblox" | "unity" | "discord" | "minecraft";
export type CodeLanguage = "lua" | "cs" | "js" | "ts" | "java" | "unknown";

export type AlternativeHypothesis = {
  hypothesis: string;
  confidence: number;
  evidence: string[];
};

export type MatchedAnalysis = {
  matched: true;
  ruleId: string;
  title: string;
  platform: Platform;
  rootCause: string;
  fix: string;
  correctedExample?: string;
  evidence: string[];
  executionPath: string[];
  confidence: number;
  why: string;
  possibleRegressions: string[];
  alternatives: AlternativeHypothesis[];
};

export type AnalyzerResult = MatchedAnalysis | { matched: false };

export type CodeFact = {
  line: number;
  raw: string;
  normalized: string;
  declarations: string[];
  assignments: string[];
  accesses: string[];
  guards: string[];
  asyncTriggers: string[];
  eventHandlers: string[];
  imports: string[];
  exports: string[];
  isAsyncScope: boolean;
  isEventScope: boolean;
};

export type CodeFacts = {
  language: CodeLanguage;
  lines: string[];
  facts: CodeFact[];
  symbolTable: Record<string, SymbolSummary>;
};

export type SymbolSummary = {
  name: string;
  declarations: number[];
  assignments: number[];
  accesses: number[];
  guards: number[];
  asyncAssignments: number[];
  asyncAccesses: number[];
  eventAssignments: number[];
  eventAccesses: number[];
  referencedBeforeAssigned: number[];
  mayBeStale: boolean;
};
