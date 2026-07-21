import { findMatch } from "@/lib/error-parser";
import { isLocalScript, isServerScript } from "@/lib/analyzer/contextAnalyzer";
import { scanCode } from "@/lib/analyzer/scanner/scanCode";
import {
  CANONICAL_PATTERN_DATABASE,
  CANONICAL_PATTERN_STATS,
  lookupCanonicalPattern,
  type CanonicalPatternCategory,
  type CanonicalPatternDefinition,
  type CanonicalPatternSeverity,
} from "@/lib/analyzer/canonicalPatternDatabase";

export type MatchStrategy = "exact" | "partial" | "fallback" | "none";

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
  patternDatabaseMatch?: {
    id: number;
    category: PatternCategory;
    signatureText: string;
    severity: PatternSeverity;
    causes: string[];
    prevention: string[];
  };
}

export type PatternSeverity = CanonicalPatternSeverity;
export type PatternCategory = CanonicalPatternCategory;
export type PatternDefinition = CanonicalPatternDefinition;

export const ERROR_PATTERN_DATABASE: PatternDefinition[] = CANONICAL_PATTERN_DATABASE;
export const ERROR_PATTERN_DATABASE_STATS = CANONICAL_PATTERN_STATS;

function findPatternDatabaseMatch(logText: string): PatternDefinition | null {
  return lookupCanonicalPattern(logText);
}

function toFindingSeverity(severity: PatternSeverity): StaticFinding["severity"] {
  switch (severity) {
    case "Critical":
      return "critical";
    case "High":
      return "high";
    case "Medium":
      return "medium";
    case "Low":
      return "low";
    default:
      return "medium";
  }
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

function extractErrorSymbols(logText: string): string[] {
  const symbols = new Set<string>();
  const addMatch = (re: RegExp) => {
    for (const match of logText.matchAll(re)) {
      const symbol = match[1]?.trim();
      if (symbol) symbols.add(symbol);
    }
  };

  addMatch(/with\s+['"]([^'"]+)['"]/gi);
  addMatch(/(?:global|local|field|method)\s+['"]([^'"]+)['"]/gi);
  addMatch(/index\s+['"]([^'"]+)['"]/gi);

  return [...symbols];
}

function getLineNumberForSnippet(codeText: string, snippet: string): number | undefined {
  const lines = codeText.split(/\r?\n/);
  const idx = lines.findIndex((line) => line.includes(snippet));
  return idx >= 0 ? idx + 1 : undefined;
}

function hasNilCheck(codeText: string, variableName: string): boolean {
  const escaped = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`if\\s+${escaped}\\b`),
    new RegExp(`if\\s+not\\s+${escaped}\\b`),
    new RegExp(`\\b${escaped}\\s+and\\s+`),
    new RegExp(`assert\\s*\\(\\s*${escaped}\\b`),
  ];

  return patterns.some((pattern) => pattern.test(codeText));
}

function analyzeStaticFindings(logText: string, codeText: string, errorSymbols: string[]): StaticFinding[] {
  const findings: StaticFinding[] = [];
  const pushFinding = (finding: StaticFinding) => {
    const dupe = findings.some(
      (item) => item.id === finding.id && item.line === finding.line && item.symbol === finding.symbol,
    );
    if (!dupe) findings.push(finding);
  };

  const scan = scanCode(codeText);
  const serverCtx = isServerScript(logText, codeText);
  const clientCtx = isLocalScript(logText, codeText);

  for (const [variable, source] of Object.entries(scan.variables)) {
    if (!/FindFirstChild(?:OfClass|WhichIsA)?\s*\(/.test(source)) continue;
    if (!codeText.includes(`${variable}.`)) continue;
    if (hasNilCheck(codeText, variable)) continue;

    pushFinding({
      id: "nil-findfirstchild-no-check",
      category: "nil-safety",
      severity: "high",
      message: `Variable '${variable}' comes from FindFirstChild and is indexed without a nil check.`,
      line: getLineNumberForSnippet(codeText, `${variable}.`),
      symbol: variable,
      evidence: source,
    });
  }

  if (/\.Character\b/.test(codeText) && !codeText.includes("CharacterAdded")) {
    pushFinding({
      id: "timing-character-without-characteradded",
      category: "timing",
      severity: "high",
      message: "player.Character is accessed without CharacterAdded/Wait, so timing can produce nil.",
      line: getLineNumberForSnippet(codeText, ".Character"),
      symbol: "Character",
    });
  }

  if (/\.(leaderstats|PlayerGui|Backpack)\b/.test(codeText) && !codeText.includes("WaitForChild")) {
    pushFinding({
      id: "timing-replication-without-waitforchild",
      category: "timing",
      severity: "high",
      message: "Replicating instances are read through dot access without WaitForChild.",
      line: getLineNumberForSnippet(codeText, ".leaderstats") ?? getLineNumberForSnippet(codeText, ".PlayerGui"),
    });
  }

  for (const rawLine of codeText.split(/\r?\n/)) {
    if (!/:WaitForChild\s*\(\s*['"][^'"]+['"]\s*\)/.test(rawLine)) continue;
    pushFinding({
      id: "timing-waitforchild-no-timeout",
      category: "timing",
      severity: "medium",
      message: "WaitForChild is called without a timeout and can yield forever.",
      line: getLineNumberForSnippet(codeText, rawLine.trim()),
      evidence: rawLine.trim(),
    });
  }

  const textSourcedVars = Object.entries(scan.variables)
    .filter(([, source]) => /\.Text\b/.test(source))
    .map(([name]) => name);

  for (const variable of textSourcedVars) {
    const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const arithmeticRe = new RegExp(`\\b${escaped}\\b\\s*[+\\-*/<>]`);
    if (!arithmeticRe.test(codeText) || codeText.includes(`tonumber(${variable})`)) continue;

    pushFinding({
      id: "type-text-arithmetic",
      category: "type",
      severity: "medium",
      message: `Variable '${variable}' appears to come from .Text and is used in arithmetic/comparison without tonumber().`,
      line: getLineNumberForSnippet(codeText, variable),
      symbol: variable,
    });
  }

  const functionRe = /function\s+([A-Za-z_]\w*)\s*\([^)]*\)([\s\S]*?)end/gm;
  for (const match of codeText.matchAll(functionRe)) {
    const functionName = match[1];
    const body = match[2] || "";
    const callRe = new RegExp(`\\b${functionName}\\s*\\(`);
    if (!callRe.test(body)) continue;

    const line = match.index !== undefined
      ? codeText.slice(0, match.index).split(/\r?\n/).length
      : undefined;

    pushFinding({
      id: "performance-infinite-recursion",
      category: "performance",
      severity: "high",
      message: `Function '${functionName}' calls itself in its own body and may recurse forever without a stop condition.`,
      line,
      symbol: functionName,
    });
  }

  const hasDataStoreCall = /(GetAsync|SetAsync|UpdateAsync)\s*\(/.test(codeText);
  if (hasDataStoreCall && !/pcall\s*\(/.test(codeText)) {
    pushFinding({
      id: "nil-datastore-no-pcall",
      category: "nil-safety",
      severity: "critical",
      message: "DataStore operations run without pcall, so transient service failures can crash execution.",
      line:
        getLineNumberForSnippet(codeText, "GetAsync(") ??
        getLineNumberForSnippet(codeText, "SetAsync(") ??
        getLineNumberForSnippet(codeText, "UpdateAsync("),
    });
  }

  if (/(for\s+.+\s+do|while\s+.+\s+do)[\s\S]{0,240}(SetAsync|UpdateAsync)\s*\(/m.test(codeText)) {
    pushFinding({
      id: "performance-datastore-in-loop",
      category: "performance",
      severity: "high",
      message: "DataStore write appears inside a loop and may hit throttling quickly.",
    });
  }

  if (serverCtx && /:(FireServer|InvokeServer)\s*\(/.test(codeText)) {
    pushFinding({
      id: "architecture-server-calls-client-api",
      category: "architecture",
      severity: "critical",
      message: "Server context detected while using FireServer/InvokeServer; this API should be called from clients.",
      line:
        getLineNumberForSnippet(codeText, "FireServer(") ??
        getLineNumberForSnippet(codeText, "InvokeServer("),
    });
  }

  if (clientCtx && /:(FireClient|FireAllClients|InvokeClient)\s*\(/.test(codeText)) {
    pushFinding({
      id: "architecture-client-calls-server-api",
      category: "architecture",
      severity: "critical",
      message: "Client context detected while using FireClient/FireAllClients/InvokeClient; these APIs should be called from servers.",
      line:
        getLineNumberForSnippet(codeText, "FireClient(") ??
        getLineNumberForSnippet(codeText, "FireAllClients(") ??
        getLineNumberForSnippet(codeText, "InvokeClient("),
    });
  }

  if (/game\.(Players|ReplicatedStorage|Workspace|Lighting|ServerStorage|StarterGui)\b/.test(codeText)) {
    pushFinding({
      id: "service-usage-direct-game-property",
      category: "service-usage",
      severity: "low",
      message: "Direct game.Service access found. Prefer game:GetService(" + '"ServiceName"' + ") for consistency and plugin safety.",
    });
  }

  if (/HttpService\s*:\s*(GetAsync|PostAsync|RequestAsync)\s*\(/.test(codeText) && !/pcall\s*\(/.test(codeText)) {
    pushFinding({
      id: "nil-http-no-pcall",
      category: "nil-safety",
      severity: "high",
      message: "HttpService request is not wrapped with pcall, so network failures may throw.",
      line:
        getLineNumberForSnippet(codeText, "GetAsync(") ??
        getLineNumberForSnippet(codeText, "PostAsync(") ??
        getLineNumberForSnippet(codeText, "RequestAsync("),
    });
  }

  for (const symbol of errorSymbols) {
    const line = getLineNumberForSnippet(codeText, symbol);
    if (!line) continue;

    pushFinding({
      id: "error-symbol-in-code",
      category: "nil-safety",
      severity: "medium",
      message: `Symbol '${symbol}' from the error appears in the snippet and should be guarded before access.`,
      line,
      symbol,
    });
  }

  return findings;
}

function fixPriorityScore(fix: string): number {
  const text = fix.toLowerCase();
  if (/(nil check|guard|pcall|verify|exists|assert)/.test(text)) return 1;
  if (/(waitforchild|characteradded|yield|timeout)/.test(text)) return 2;
  if (/(tonumber|tostring|type conversion|convert)/.test(text)) return 3;
  if (/(fireserver|fireclient|client|server|remoteevent|remotefunction)/.test(text)) return 4;
  if (/(datastore|batch|cache|debounce|throttl)/.test(text)) return 5;
  return 3;
}

function buildFixTemplates(findings: StaticFinding[]): FixTemplateOption[] {
  const templates: FixTemplateOption[] = [];

  const hasNilRisk = findings.some((item) => item.category === "nil-safety");
  const hasTimingRisk = findings.some((item) => item.category === "timing");
  const hasTypeRisk = findings.some((item) => item.category === "type");
  const hasArchitectureRisk = findings.some((item) => item.category === "architecture");
  const hasPerformanceRisk = findings.some((item) => item.category === "performance");

  if (hasNilRisk) {
    templates.push({
      id: "template-nil-guard",
      priority: 1,
      title: "Nil Guard Template",
      whyItWorks: "It ensures values exist before indexing/calling them, preventing immediate nil crashes.",
      template: `local {{variable_name}} = {{parent}}:FindFirstChild("{{child_name}}")
if {{variable_name}} then
    -- Safe to use {{variable_name}} here
else
    warn("Missing {{child_name}}")
end`,
    });

    templates.push({
      id: "template-pcall-risky-call",
      priority: 1,
      title: "pcall Wrapper Template",
      whyItWorks: "It captures runtime/service failures and keeps the script alive instead of throwing.",
      template: `local ok, result = pcall(function()
    return {{risky_expression}}
end)
if not ok then
    warn("Operation failed:", result)
    return
end`,
    });
  }

  if (hasTimingRisk) {
    templates.push({
      id: "template-characteradded",
      priority: 2,
      title: "Character Timing Template",
      whyItWorks: "It waits for the character and humanoid to exist before property access.",
      template: `player.CharacterAdded:Connect(function(char)
    local humanoid = char:WaitForChild("Humanoid", 5)
    if humanoid then
        {{humanoid_usage}}
    end
end)`,
    });

    templates.push({
      id: "template-waitforchild-timeout",
      priority: 2,
      title: "WaitForChild Timeout Template",
      whyItWorks: "It prevents infinite yielding by using an explicit timeout and fallback path.",
      template: `local {{instance_var}} = {{parent}}:WaitForChild("{{instance_name}}", 5)
if not {{instance_var}} then
    warn("{{instance_name}} was not replicated in time")
    return
end`,
    });
  }

  if (hasTypeRisk) {
    templates.push({
      id: "template-type-conversion",
      priority: 3,
      title: "Type Conversion Template",
      whyItWorks: "It normalizes user/input values into numeric/string forms before arithmetic or comparisons.",
      template: `local n = tonumber({{value_expression}})
if not n then
    warn("Expected a number but got:", tostring({{value_expression}}))
    return
end
{{numeric_usage}}`,
    });
  }

  if (hasArchitectureRisk) {
    templates.push({
      id: "template-remote-boundary",
      priority: 4,
      title: "Remote Boundary Template",
      whyItWorks: "It enforces correct client/server direction for RemoteEvent communication.",
      template: `-- LocalScript
RemoteEvent:FireServer({{payload}})

-- Server Script
RemoteEvent.OnServerEvent:Connect(function(player, payload)
    RemoteEvent:FireClient(player, {{response_payload}})
end)`,
    });
  }

  if (hasPerformanceRisk) {
    templates.push({
      id: "template-datastore-batch",
      priority: 5,
      title: "DataStore Batch Template",
      whyItWorks: "It reduces write frequency and avoids throttling by batching/scheduling persistence.",
      template: `local pending = {}
local function queueSave(userId, data)
    pending[userId] = data
end

task.spawn(function()
    while true do
        task.wait(10)
        for userId, data in pairs(pending) do
            local ok, err = pcall(function()
                DataStore:SetAsync(userId, data)
            end)
            if ok then
                pending[userId] = nil
            else
                warn("Save failed", userId, err)
            end
        end
    end
end)`,
    });
  }

  return templates.sort((a, b) => a.priority - b.priority);
}

function dedupeKeepOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

export function buildAdvancedAnalysis(
  logText: string,
  codeText: string,
  existingFixes: string[] = [],
): AdvancedAnalyzerOutput {
  const match = findMatch(logText);
  const patternDatabaseMatch = findPatternDatabaseMatch(logText);

  const matchStrategy: MatchStrategy = match
    ? match.matchType === "pattern"
      ? "exact"
      : "partial"
    : codeText.trim().length > 0 || logText.trim().length > 0
      ? "fallback"
      : "none";

  const logLineReference = parseLogLineReference(logText);
  const codeLineText = logLineReference ? getCodeLine(codeText, logLineReference) : undefined;

  const errorSymbols = extractErrorSymbols(logText);
  const staticFindings = analyzeStaticFindings(logText, codeText, errorSymbols);

  if (patternDatabaseMatch) {
    staticFindings.unshift({
      id: `pattern-db-${patternDatabaseMatch.id}`,
      category: "service-usage",
      severity: toFindingSeverity(patternDatabaseMatch.severity),
      message: `Pattern DB matched '${patternDatabaseMatch.category}' signature: ${patternDatabaseMatch.signature}`,
    });
  }

  const generatedFixes = staticFindings.map((finding) => {
    switch (finding.category) {
      case "nil-safety":
        return "Add nil checks and pcall wrappers around the failing access/call before using the value.";
      case "timing":
        return "Use CharacterAdded/WaitForChild with timeouts before accessing replicated objects.";
      case "type":
        return "Convert dynamic values with tonumber()/tostring() before arithmetic or comparisons.";
      case "architecture":
        return "Correct client/server API boundaries for FireServer, FireClient, and RemoteFunction calls.";
      case "performance":
        return "Batch DataStore writes and avoid recursive or loop-driven hot paths without guards.";
      case "service-usage":
        return "Prefer game:GetService() over direct game.Service access for stable service lookup.";
      default:
        return "Apply targeted guards and refactor the failing path.";
    }
  });

  const prioritizedFixes = dedupeKeepOrder([...existingFixes, ...generatedFixes]).sort(
    (a, b) => fixPriorityScore(a) - fixPriorityScore(b),
  );

  const fixTemplates = buildFixTemplates(staticFindings);

  if (patternDatabaseMatch) {
    patternDatabaseMatch.fixTemplates.forEach((template, index) => {
      fixTemplates.push({
        id: `template-pattern-db-${patternDatabaseMatch.id}-${index + 1}`,
        priority: 3,
        title: template.title || `Pattern DB Fix ${index + 1}`,
        whyItWorks: template.rationale || `Mapped from ${patternDatabaseMatch.category} playbook for this signature.`,
        template: template.template,
      });
    });
  }

  const dedupedTemplates: FixTemplateOption[] = [];
  const seenTemplateBodies = new Set<string>();
  for (const template of fixTemplates.sort((a, b) => a.priority - b.priority)) {
    if (seenTemplateBodies.has(template.template)) continue;
    seenTemplateBodies.add(template.template);
    dedupedTemplates.push(template);
  }

  return {
    matchStrategy,
    matchedRuleId: match?.entry.id,
    errorLineMapping: {
      logLineReference,
      resolvedCodeLine: codeLineText ? logLineReference : undefined,
      codeLineText,
    },
    errorSymbols,
    staticFindings,
    prioritizedFixes,
    fixTemplates: dedupedTemplates,
    patternDatabaseSize: ERROR_PATTERN_DATABASE.length,
    ...(patternDatabaseMatch
      ? {
          patternDatabaseMatch: {
            id: patternDatabaseMatch.id,
            category: patternDatabaseMatch.category,
            signatureText: patternDatabaseMatch.signature,
            severity: patternDatabaseMatch.severity,
            causes: patternDatabaseMatch.commonCauses,
            prevention: patternDatabaseMatch.prevention,
          },
        }
      : {}),
  };
}
