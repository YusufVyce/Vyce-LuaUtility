export interface ScanResult {
  variables: Record<string, string>;
  propertyAccess: string[];
  waitForChild: string[];
}

/**
 * Lightweight line-based scan of Lua source. Not a real parser — it uses
 * regexes to pick out `local x = ...` declarations, `:WaitForChild(` calls,
 * and dotted property-access chains (`a.b.c`) for the heuristics in
 * `rules.ts` to reason about. Intentionally cheap (single pass, no AST) so
 * it stays fast on large scripts.
 */
export function scanCode(code: string): ScanResult {
  const result: ScanResult = {
    variables: {},
    propertyAccess: [],
    waitForChild: [],
  };

  if (!code) return result;

  const lines = code.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // local x = something
    const localMatch = line.match(
      /^local\s+([A-Za-z_]\w*)\s*=\s*(.+)$/
    );

    if (localMatch) {
      result.variables[localMatch[1]] = localMatch[2];
    }

    // :WaitForChild(
    if (line.includes(":WaitForChild(")) {
      result.waitForChild.push(line);
    }

    // object.property
    const accesses =
      line.match(/[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+/g);

    if (accesses) {
      result.propertyAccess.push(...accesses);
    }
  }

  return result;
}