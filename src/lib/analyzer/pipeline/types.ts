export type Severity = "Low" | "Medium" | "High" | "Critical";

export type ErrorFamily =
  | "INDEX_NIL"
  | "CALL_NIL"
  | "CONCAT_NIL"
  | "ARITHMETIC_NIL"
  | "COMPARE_NIL"
  | "INVALID_ARGUMENT"
  | "INVALID_MEMBER"
  | "INVALID_TYPE"
  | "DATASTORE"
  | "REMOTE"
  | "TWEEN"
  | "CHARACTER"
  | "WAIT"
  | "TIMEOUT"
  | "HTTP"
  | "MEMORY"
  | "UNKNOWN";

export type MatchStrategy = "exact" | "partial" | "fallback" | "none";

export interface NormalizedInput {
  originalLog: string;
  originalCode: string;
  normalizedLog: string;
  normalizedCode: string;
  compactLog: string;
}

export interface TokenizedInput {
  tokens: string[];
  tokenCounts: Record<string, number>;
  lineTokens: Array<{ line: number; tokens: string[] }>;
  parserTokens?: unknown[];
}

export interface ClassifiedError {
  family: ErrorFamily;
  strategy: MatchStrategy;
  matchedPattern?: string;
  lineReference?: number;
}

export interface SymbolRef {
  name: string;
  kind: "variable" | "function" | "method" | "property" | "service" | "api";
  line?: number;
}

export interface HighlightRange {
  line: number;
  text: string;
  variable?: string;
  functionName?: string;
  property?: string;
}

export interface ExtractedContext {
  symbols: SymbolRef[];
  highlights: HighlightRange[];
  variables: Record<string, string>;
  functions: string[];
  methods: string[];
  requires: string[];
  requireChains: string[][];
  moduleExports: string[];
  services: string[];
  apis: string[];
  side: "client" | "server" | "unknown";
  hasPcall: boolean;
  hasXpcall: boolean;
  hasWaitForChild: boolean;
  hasWaitForChildTimeout: boolean;
  hasFindFirstChild: boolean;
  hasCharacterAdded: boolean;
  hasPlayerAdded: boolean;
  hasTaskSpawn: boolean;
  hasTaskDefer: boolean;
  hasCoroutine: boolean;
  hasLoops: boolean;
  hasRecursiveFunction: boolean;
  hasCharacterPropertyAccessWithoutSync: boolean;
  hasRemoteUse: boolean;
  hasTweenUse: boolean;
  hasDataStoreUse: boolean;
  tweenGoals: Array<{ target: string; property: string; line: number }>;
  parserDiagnostics: string[];
  ast?: unknown;
}

export interface Evidence {
  id: string;
  message: string;
  score: number;
  line?: number;
}

export interface RuleSignal {
  id: string;
  title: string;
  domain: string;
  severity: Severity;
  rootCause: string;
  evidence: Evidence[];
  fixes: {
    minimal: string;
    better: string;
    production: string;
  };
  docs: string[];
  relatedApis: string[];
  relatedErrors: string[];
  estimatedFixTime: string;
  difficulty: "Easy" | "Moderate" | "Hard";
}

export interface Hypothesis {
  id: string;
  title: string;
  rootCause: string;
  severity: Severity;
  evidence: Evidence[];
  score: number;
  confidence: number;
  fixes: RuleSignal["fixes"];
  docs: string[];
  relatedApis: string[];
  relatedErrors: string[];
  estimatedFixTime: string;
  difficulty: "Easy" | "Moderate" | "Hard";
}

export interface DiagnosticKnowledge {
  id: string;
  family: ErrorFamily;
  domain: string;
  title: string;
  triggers: string[];
  docs: string[];
  relatedApis: string[];
  relatedErrors: string[];
}

export interface AnalyzerNote {
  title: string;
  description: string;
}

export interface DynamicAnalysisResult {
  title: string;
  family: ErrorFamily;
  strategy: MatchStrategy;
  severity: Severity;
  confidence: number;
  quickSummary: string;
  likelyRootCause: string;
  explanation: string;
  hypotheses: Hypothesis[];
  selectedHypothesis: Hypothesis;
  evidence: Evidence[];
  matchingRules: string[];
  highlightedCode: HighlightRange[];
  fixes: RuleSignal["fixes"];
  docs: string[];
  relatedDiagnostics: string[];
  relatedApis: string[];
  performanceNotes: AnalyzerNote[];
  securityNotes: AnalyzerNote[];
  bestPractices: AnalyzerNote[];
  commonMistakes: string[];
  estimatedFixTime: string;
  difficulty: "Easy" | "Moderate" | "Hard";
  knowledgeBaseSize: number;
}
