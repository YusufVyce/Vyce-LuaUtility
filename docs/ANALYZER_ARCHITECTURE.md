# Analyzer Architecture

This project now includes a semantic root-cause analysis engine built to reason about error logs and source code together.

## Pipeline Overview

1. **Input normalization**
   - The analyzer receives an error log, a code snippet, and an optional platform override.
   - The platform is resolved using explicit user input or content hints.

2. **Language & platform detection**
   - `src/lib/analyzer/language.ts` identifies the likely language and platform from the code and log.
   - Supported languages: `lua`, `cs`, `js`, `ts`, `java`, `unknown`.

3. **Code facts extraction**
   - `src/lib/analyzer/parser.ts` scans the code line-by-line to extract declarations, assignments, property accesses, async triggers, event handlers, guards, imports, and exports.
   - It builds a lightweight `CodeFacts` model that contains symbol summaries and control-flow hints.

4. **Semantic issue discovery**
   - `src/lib/analyzer/semantic.ts` evaluates symbol usage and control flow to identify key problems such as:
     - use-before-assignment
     - stale references after asynchronous/event updates
     - unchecked property access without guards
   - This module is the first line of reasoning beyond simple keyword matching.

5. **Root cause inference**
   - `src/lib/analyzer/inference.ts` combines log-based signals with semantic code issues.
   - It produces a full analysis result with:
     - `rootCause`
     - `fix`
     - `evidence`
     - `executionPath`
     - `confidence`
     - `possibleRegressions`
     - `alternatives`

6. **Engine entry point**
   - `src/lib/analyzer/engine.ts` orchestrates detection, parsing, and inference.
   - `src/utils/analyzerEngine.ts` exposes the same `analyzeErrorAndCode()` interface used by the UI.

## Testing Strategy

- A dedicated unit test suite is added in `src/lib/analyzer/engine.test.ts`.
- Tests verify:
  - async stale reference reasoning
  - null-reference detection in Unity and Minecraft
  - Discord `Unknown interaction` reasoning
  - code-only evidence generation

## Extension Guide

To extend the analyzer:

- Add additional error signals in `src/lib/error-parser.ts`.
- Add more language-specific parsing heuristics in `src/lib/analyzer/parser.ts`.
- Add new semantic issue rules in `src/lib/analyzer/semantic.ts`.
- Add new inference templates in `src/lib/analyzer/inference.ts`.

## Design Goals

- Avoid hallucinated suggestions by grounding every statement in extracted code facts.
- Prefer semantic evidence over plain keyword matching.
- Keep the engine local-only and deterministic.
- Keep the UI compatible with the result shape while adding richer analysis metadata.
