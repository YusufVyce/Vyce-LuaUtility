# Code Review & Refactor Summary

Scope: `src/lib/analyzer/*`, `src/lib/error-parser.ts`, `src/lib/roblox/*`,
`src/utils/analyzerEngine.ts`, `src/lib/analyzer/scanner/*`, plus project-wide
formatting/config. This is the core diagnosis engine of the app (regex/alias
matching over Roblox error logs + heuristic checks over pasted Lua code).

## Bugs fixed

1. **Debug logging shipped to production** — `src/utils/analyzerEngine.ts` had
   `console.log(scan)` / `console.log(warnings)` / `console.log(flow)` in the
   main analysis path. Removed. The data is now returned to the caller as
   `scanWarnings` / `variableFlow` on the result instead of just being logged
   and discarded.
2. **Errors silently swallowed** — the code-only analysis path had
   `catch (e) { return { ..., score: 0 } }` with `e` unused and no logging, so
   a broken rule would vanish without a trace. Replaced with a `safeAnalyze()`
   wrapper that logs which rule (`entry.id`) failed and why, and wrapped the
   whole `analyzeErrorAndCode` in a top-level try/catch so it **never throws**
   — it returns `{ matched: false, error }` for the UI to show gracefully.
3. **Duplicate warnings** — `scanner/rules.ts`'s leaderstats rule pushed one
   warning *per matching line* instead of once per script. Three unguarded
   `leaderstats` accesses produced three identical warnings. Fixed to warn
   once per scan (see `runScanRules` in `scanCode.test.ts` regression test).
4. **Divide-by-zero** in `analyzer/matcher.ts` (`score / rule.keywords.length`
   when a rule has no keywords) and in `error-parser.ts`'s `similarity()` for
   an empty alias string.
5. **No input-size guard** — `analyzeErrorAndCode` now rejects input over
   200,000 characters up front instead of running full regex/heuristic scans
   over an unbounded paste.

## Readability / consistency

- Translated the remaining non-English comments to English
  (`error-parser.ts`, `vite.config.ts`, `tsconfig.json`).
- Normalized inconsistent CRLF/LF line endings across 29 files (mixed line
  endings were causing noisy diffs).
- Added JSDoc explaining *why*, not just *what*, to the previously
  undocumented core functions: `findMatch`, `scanCode`, `runScanRules`,
  `analyzeErrorAndCode`, `analyzeCodeContext`, `calculateConfidenceScore`,
  `enrichAnalysis`.
- Cleaned up inconsistent spacing/indentation in `error-parser.ts` and
  `scanner/rules.ts`.

## Structural refactor: `contextAnalyzer.ts`

The 655-line `analyzeCodeContext()` was a single function with 25 near-
identical `if (condition) { issues.push({...}) }` blocks — every rule's
detection logic and its content (title/description/fix/example/severity)
were interleaved in one long control-flow chain.

Extracted into `src/lib/analyzer/contextRules.ts`: a `CONTEXT_RULES` array of
`{ ...issue content, test(ctx) }` entries. `contextAnalyzer.ts` now just
builds the shared `{ code, log, serverCtx, clientCtx }` context once and
evaluates each rule against it. This is a mechanical, behavior-preserving
transformation — same conditions, same output, same order (order matters:
`enrichAnalysis` uses the first matching rule's `correctedExample`).

Benefits:
- Every rule is visible as a self-contained record instead of buried in
  control flow — easier to audit, add to, or remove a single rule.
- New rules are additions to the array, not new branches in a 400-line
  function.
- Verified equivalent to the original via both a type-check and a runtime
  script that exercises every category of rule (execution context, nil
  risks, module analysis, character analysis, leaderstats, remotes,
  DataStore) plus the confidence-scoring and `enrichAnalysis` paths.

`matchRule`/`ROBLOX_CONSOLE_RULES` in `analyzer/matcher.ts` were left as-is
structurally (see "Not changed" below) since they're unused dead code, not
part of the live pipeline being refactored.

## Tests added

Set up `vitest` (`npm test` / `npm run test:watch`) with coverage for:

- `src/lib/error-parser.test.ts` — pattern matching, empty input, dictionary
  integrity (unique ids, valid patterns).
- `src/lib/analyzer/scanner/scanCode.test.ts` — variable/property extraction,
  and a regression test for the duplicate-warning fix.
- `src/lib/analyzer/contextAnalyzer.test.ts` — server/client context
  detection, representative rules from the new rule table, confidence
  scoring bounds.
- `src/utils/analyzerEngine.test.ts` — end-to-end `analyzeErrorAndCode`,
  including the new size guard and the no-throw guarantee on malformed input.

I don't have network access in this environment to `npm install`, so I
couldn't run `npm test` myself to get a final green checkmark — you'll need
to run `npm install && npm test` on your end. I did verify the refactor two
other ways in the meantime: a full `tsc --noEmit` pass over every touched
file (zero type errors), and a standalone runtime script (via `tsx`) that
exercises the same scenarios as the test files end-to-end against the actual
compiled logic — all 19 checks passed, confirming the `contextAnalyzer`
refactor is behavior-identical to the original and the new error handling
works as designed.

## Noted but intentionally not changed

- **Duplicate error-definition directories**: `src/lib/roblox/errors/` and
  `src/lib/analyzer/roblox/errors/` both hold `ErrorEntry` definitions,
  imported side by side into `error-parser.ts`. Works correctly, but it's
  confusing to have two homes for the same kind of data — worth
  consolidating into one location in a follow-up.
- **`analyzer/matcher.ts` is dead code** — `matchRobloxConsoleError` /
  `ROBLOX_CONSOLE_RULES` aren't imported anywhere in the app (confirmed via
  repo-wide search). Fixed its latent divide-by-zero bug but left it in
  place rather than deleting it unilaterally — worth a decision on whether
  it's meant to replace `findMatch()` or should be removed.
- **`src/components/`** (268KB, mostly shadcn/ui primitives) — reviewed at a
  glance; no correctness issues found. Out of scope for a deep pass given
  the size, but flagging that I didn't audit it as thoroughly as the
  analyzer core.

## Follow-up pass: `src/routes/index.tsx`

Reviewed the main page component (the one that actually calls
`analyzeErrorAndCode`) and found:

1. **Unreachable "awaiting input" placeholder** — the empty state was gated
   on `{!result && (...)}`, but `result` is a `useState` with an object
   default (`{ kind: "generic" }`), so it's *never* falsy. That branch could
   never render; instead, the "No exact match found" card (meant for a
   failed analysis) showed on first page load, before the user had done
   anything. Fixed by adding a real `"idle"` state that's distinct from
   `"generic"` (analysis ran, no match) and used as the initial/cleared
   state.
2. **New `error` field from `analyzerEngine` wasn't surfaced** — after
   adding `{ matched: false, error }` for internal-failure cases, nothing in
   the UI read it. Now `runAnalysis()` shows an error toast when
   `analysis.error` is present, distinguishing "the analyzer broke" from
   "no rule matched this input."
3. **Duplicated analysis-handling logic** — `triggerAnalysis()` and
   `insertExample()`'s auto-run path had ~35 lines of identical
   result-mapping code that could drift out of sync. Extracted into a
   shared `runAnalysis(log, code)` used by both.

Verified via `tsc --noEmit` against the edited file (all remaining errors
are pre-existing missing-`node_modules` noise for `react`/`@tanstack/*` —
none relate to the changed state shape or logic) and manually traced every
`result.kind` transition to confirm each of the three UI states (`idle`,
`match`, `generic`) is reachable and set from exactly the places intended.
