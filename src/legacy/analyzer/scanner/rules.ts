/** @deprecated Legacy analyzer module retained for compatibility only. Do not import in production runtime. */
export interface ScanWarning {
  title: string;
  severity: "low" | "medium" | "high";
  message: string;
}

export interface ScanInput {
  variables: Record<string, string>;
  propertyAccess: string[];
  waitForChild: string[];
}

/**
 * Runs lint-style heuristics over a scanCode() result and produces warnings.
 *
 * Each rule below is expected to push at most one warning per scan, even if
 * the underlying condition is triggered by several lines of code — a repeated
 * `leaderstats` access without WaitForChild is one problem to fix, not N.
 */
export function runScanRules(scan: ScanInput): ScanWarning[] {
  const warnings: ScanWarning[] = [];

  const accessesLeaderstats = scan.propertyAccess.some((access) =>
    access.includes("leaderstats"),
  );
  if (accessesLeaderstats && scan.waitForChild.length === 0) {
    warnings.push({
      title: "Leaderstats access",
      severity: "high",
      message:
        "leaderstats is accessed without WaitForChild(). Replication timing may cause nil.",
    });
  }

  return warnings;
}
