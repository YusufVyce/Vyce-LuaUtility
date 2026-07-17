import { CodeFacts, CodeFact, CodeLanguage, SymbolSummary } from "./types";

const identifierPattern = /[A-Za-z_]\w*/g;
const propertyAccessPattern = /\b([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)\b/g;
const asyncTriggerPattern = /\b(await|async\b|\.then\(|task\.(spawn|defer)|coroutine\.(wrap|resume|create)|Promise\b)\b/gi;
const eventTriggerPattern = /\b(\.Connect\(|\.on\(|\.addEventListener\(|onPlayerAdded|interactionCreate|PlayerAdded|PlayerRemoving|onCommand\()/i;
const importPattern = /\b(?:import\s+.*\s+from|require\(|module\.exports|export\b|using\s+UnityEngine|import\s+org\.bukkit\.)/i;
const guardPattern = /\b(if\s+not\s+|if\s*\(|if\s+\(|!=\s*null|==\s*nil|~=\s*nil|!=\s*undefined|==\s*null)\b/i;
const declarationPattern = /\b(local\s+|const\s+|let\s+|var\s+|Player\s+|int\s+|float\s+|double\s+|string\s+|var\s+)\s*([A-Za-z_]\w*)/i;
const assignmentPattern = /([A-Za-z_]\w*)\s*=\s*/g;

function collectSymbols(raw: string): string[] {
  const names = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = identifierPattern.exec(raw)) !== null) {
    names.add(match[0]);
  }
  return [...names];
}

function findPropertyAccesses(raw: string): string[] {
  propertyAccessPattern.lastIndex = 0;
  const accesses = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = propertyAccessPattern.exec(raw)) !== null) {
    const property = match[1];
    if (!property.includes("if") && !property.includes("for") && !property.includes("while")) {
      accesses.add(property);
    }
  }
  return [...accesses];
}

function captureNames(regex: RegExp, raw: string): string[] {
  regex.lastIndex = 0;
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    if (match[2]) {
      found.add(match[2]);
    } else if (match[1]) {
      found.add(match[1]);
    }
  }
  return [...found];
}

function accessRoots(accesses: string[]): string[] {
  return accesses.map((access) => access.split(".")[0]);
}

export function buildCodeFacts(codeText: string, language: CodeLanguage): CodeFacts {
  const lines = codeText.split(/\r?\n/);
  const facts: CodeFact[] = [];
  const symbolTable: Record<string, SymbolSummary> = {};

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const normalized = raw.replace(/\s+/g, " ").trim();
    const declarations = captureNames(declarationPattern, raw);
    const assignments = captureNames(assignmentPattern, raw);
    const accesses = findPropertyAccesses(raw).filter((access) => !access.includes("console") && !access.includes("print") && !access.includes("warn"));
    const asyncTriggers = raw.match(asyncTriggerPattern)?.map((t) => t.trim()) ?? [];
    const eventHandlers = raw.match(eventTriggerPattern)?.map((t) => t.trim()) ?? [];
    const imports = importPattern.test(raw) ? [raw.trim()] : [];
    const exports: string[] = [];
    const guards = guardPattern.test(raw) ? [raw.trim()] : [];
    const isAsyncScope = /\b(async\s+function|function\s+.*async|task\.(spawn|defer)|coroutine\.(wrap|resume|create)|\.then\(|await\b)/i.test(raw);
    const isEventScope = eventTriggerPattern.test(raw);
    const accessRootsList = accessRoots(accesses);

    const symbolNames = new Set<string>([...declarations, ...assignments, ...accessRootsList]);
    for (const name of symbolNames) {
      const entry = symbolTable[name] ?? {
        name,
        declarations: [],
        assignments: [],
        accesses: [],
        guards: [],
        asyncAssignments: [],
        asyncAccesses: [],
        eventAssignments: [],
        eventAccesses: [],
        referencedBeforeAssigned: [],
        mayBeStale: false,
      };

      if (declarations.includes(name)) {
        entry.declarations.push(index + 1);
      }
      if (assignments.includes(name)) {
        entry.assignments.push(index + 1);
        if (isAsyncScope) {
          entry.asyncAssignments.push(index + 1);
        }
        if (isEventScope) {
          entry.eventAssignments.push(index + 1);
        }
      }
      if (accessRootsList.includes(name)) {
        entry.accesses.push(index + 1);
        if (isAsyncScope) {
          entry.asyncAccesses.push(index + 1);
        }
        if (isEventScope) {
          entry.eventAccesses.push(index + 1);
        }
      }
      if (guards.some((guard) => guard.includes(name))) {
        entry.guards.push(index + 1);
      }

      symbolTable[name] = entry;
    }

    facts.push({
      line: index + 1,
      raw,
      normalized,
      declarations,
      assignments,
      accesses,
      guards,
      asyncTriggers,
      eventHandlers,
      imports,
      exports,
      isAsyncScope,
      isEventScope,
    });
  }

  for (const summary of Object.values(symbolTable)) {
    const firstAssignment = summary.assignments[0] ?? Number.MAX_SAFE_INTEGER;
    for (const accessLine of summary.accesses) {
      if (accessLine < firstAssignment) {
        summary.referencedBeforeAssigned.push(accessLine);
      }
    }
    summary.mayBeStale =
      summary.asyncAssignments.length > 0 &&
      summary.accesses.some((line) => summary.asyncAssignments.some((assignLine) => assignLine < line));
  }

  return { language, lines, facts, symbolTable };
}
