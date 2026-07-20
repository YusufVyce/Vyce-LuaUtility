/* ============================================================
   Lifetime Analyzer
   Tracks variables across async boundaries and object lifetime.
============================================================ */

export type AsyncBoundaryType =
  | "wait"
  | "task.wait"
  | "task.spawn"
  | "task.delay"
  | "delay"
  | "spawn"
  | "coroutine.wrap"
  | "coroutine.resume"
  | "coroutine.yield";

export interface AsyncBoundary {
  line: number;

  type: AsyncBoundaryType;

  raw: string;
}

export interface DestroyEvent {
  variable: string;

  line: number;

  method:
    | "Destroy"
    | "ParentNil";
}

export interface Assignment {

  variable: string;

  value: string;

  line: number;
}

export interface VariableUsage {

  variable: string;

  line: number;

  expression: string;
}

export interface LifetimeWarning {

  variable: string;

  line: number;

  confidence: number;

  reason: string;

  recommendation: string;
}

export interface LifetimeReport {

  asyncBoundaries: AsyncBoundary[];

  assignments: Assignment[];

  usages: VariableUsage[];

  destroyEvents: DestroyEvent[];

  warnings: LifetimeWarning[];
}

/* ============================================================
   Regex Collection
============================================================ */

const ASYNC_REGEX = [
  /\bwait\s*\(/i,
  /\btask\.wait\s*\(/i,
  /\btask\.spawn\s*\(/i,
  /\btask\.delay\s*\(/i,
  /\bdelay\s*\(/i,
  /\bspawn\s*\(/i,
  /\bcoroutine\.wrap\s*\(/i,
  /\bcoroutine\.resume\s*\(/i,
  /\bcoroutine\.yield\s*\(/i,
];

const ASSIGNMENT_REGEX =
  /^\s*local\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i;

const DESTROY_REGEX =
  /([A-Za-z_]\w*)\s*:\s*Destroy\s*\(/i;

const PARENT_NIL_REGEX =
  /([A-Za-z_]\w*)\.Parent\s*=\s*nil/i;

const VARIABLE_USAGE_REGEX =
  /([A-Za-z_]\w*)\./g;

/* ============================================================
   Helper Functions
============================================================ */

function normalizeLine(
  line: string,
): string {

  return line.trim();

}

function isComment(
  line: string,
): boolean {

  return normalizeLine(line).startsWith("--");

}

function isEmpty(
  line: string,
): boolean {

  return normalizeLine(line).length === 0;

}

function splitLines(
  code: string,
): string[] {

  return code
    .replace(/\r\n/g, "\n")
    .split("\n");

}

function parseAsyncType(
  line: string,
): AsyncBoundaryType | null {

  if (/task\.wait/i.test(line))
    return "task.wait";

  if (/wait\s*\(/i.test(line))
    return "wait";

  if (/task\.spawn/i.test(line))
    return "task.spawn";

  if (/task\.delay/i.test(line))
    return "task.delay";

  if (/spawn\s*\(/i.test(line))
    return "spawn";

  if (/delay\s*\(/i.test(line))
    return "delay";

  if (/coroutine\.wrap/i.test(line))
    return "coroutine.wrap";

  if (/coroutine\.resume/i.test(line))
    return "coroutine.resume";

  if (/coroutine\.yield/i.test(line))
    return "coroutine.yield";

  return null;

}
/* ============================================================
   Scanner
============================================================ */

function scanAssignments(
  lines: string[],
): Assignment[] {

  const assignments: Assignment[] = [];

  for (let i = 0; i < lines.length; i++) {

    const line = lines[i];

    if (isEmpty(line) || isComment(line))
      continue;

    const match = line.match(ASSIGNMENT_REGEX);

    if (!match)
      continue;

    assignments.push({

      variable: match[1],

      value: match[2].trim(),

      line: i + 1,

    });

  }

  return assignments;

}

function scanAsyncBoundaries(
  lines: string[],
): AsyncBoundary[] {

  const result: AsyncBoundary[] = [];

  for (let i = 0; i < lines.length; i++) {

    const line = lines[i];

    if (isEmpty(line) || isComment(line))
      continue;

    let matched = false;

    for (const regex of ASYNC_REGEX) {

      if (!regex.test(line))
        continue;

      const type = parseAsyncType(line);

      if (!type)
        continue;

      result.push({

        line: i + 1,

        type,

        raw: line.trim(),

      });

      matched = true;

      break;

    }

    if (matched)
      continue;

  }

  return result;

}

function scanDestroyEvents(
  lines: string[],
): DestroyEvent[] {

  const events: DestroyEvent[] = [];

  for (let i = 0; i < lines.length; i++) {

    const line = lines[i];

    if (isEmpty(line) || isComment(line))
      continue;

    const destroy = line.match(DESTROY_REGEX);

    if (destroy) {

      events.push({

        variable: destroy[1],

        line: i + 1,

        method: "Destroy",

      });

    }

    const parentNil = line.match(PARENT_NIL_REGEX);

    if (parentNil) {

      events.push({

        variable: parentNil[1],

        line: i + 1,

        method: "ParentNil",

      });

    }

  }

  return events;

}

function scanVariableUsages(
  lines: string[],
): VariableUsage[] {

  const usages: VariableUsage[] = [];

  for (let i = 0; i < lines.length; i++) {

    const line = lines[i];

    if (isEmpty(line) || isComment(line))
      continue;

    let match: RegExpExecArray | null;

    VARIABLE_USAGE_REGEX.lastIndex = 0;

    while (

      (match = VARIABLE_USAGE_REGEX.exec(line)) !== null

    ) {

      usages.push({

        variable: match[1],

        expression: line.trim(),

        line: i + 1,

      });

    }

  }

  return usages;

}
/* ============================================================
   Lifetime Analysis
============================================================ */

function analyzeAsyncUsage(
  report: LifetimeReport,
): LifetimeWarning[] {

  const warnings: LifetimeWarning[] = [];

  for (const boundary of report.asyncBoundaries) {

    for (const assignment of report.assignments) {

      if (assignment.line > boundary.line)
        continue;

      for (const usage of report.usages) {

        if (usage.variable !== assignment.variable)
          continue;

        if (usage.line <= boundary.line)
          continue;

        warnings.push({

          variable: assignment.variable,

          line: usage.line,

          confidence: 80,

          reason:
            `${assignment.variable} is used after ${boundary.type}(). The reference may have become stale.`,

          recommendation:
            `Re-fetch or validate '${assignment.variable}' after ${boundary.type}().`,

        });

      }

    }

  }

  return warnings;

}

/* ============================================================
   Destroy Analysis
============================================================ */

function analyzeDestroyedObjects(
  report: LifetimeReport,
): LifetimeWarning[] {

  const warnings: LifetimeWarning[] = [];

  for (const destroy of report.destroyEvents) {

    for (const usage of report.usages) {

      if (usage.variable !== destroy.variable)
        continue;

      if (usage.line <= destroy.line)
        continue;

      warnings.push({

        variable: destroy.variable,

        line: usage.line,

        confidence: 100,

        reason:
          `${destroy.variable} was used after ${destroy.method}.`,

        recommendation:
          `Do not access '${destroy.variable}' after it has been destroyed. Re-fetch the instance.`,

      });

    }

  }

  return warnings;

}

/* ============================================================
   Duplicate Cleanup
============================================================ */

function mergeWarnings(

  warnings: LifetimeWarning[],

): LifetimeWarning[] {

  const result: LifetimeWarning[] = [];

  const seen = new Set<string>();

  for (const warning of warnings) {

    const key =
      warning.variable +
      "|" +
      warning.line +
      "|" +
      warning.reason;

    if (seen.has(key))
      continue;

    seen.add(key);

    result.push(warning);

  }

  result.sort(

    (a, b) =>

      b.confidence - a.confidence

  );

  return result;

}