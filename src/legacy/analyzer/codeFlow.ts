/** @deprecated Legacy analyzer module retained for compatibility only. Do not import in production runtime. */
export interface VariableFlow {
  variable: string;
  source: string;
}

export function extractVariableFlow(code: string): VariableFlow[] {
  const flows: VariableFlow[] = [];

  const lines = code.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("local ")) continue;

    const match = trimmed.match(
      /^local\s+([A-Za-z_]\w*)\s*=\s*(.+)$/
    );

    if (!match) continue;

    flows.push({
      variable: match[1],
      source: match[2].trim(),
    });
  }

  return flows;
}