import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { EXAMPLES } from "@/lib/error-parser";
import {
  analyzeErrorAndCode,
  type AnalyzerResult,
} from "@/utils/analyzerEngine";

export const Route = createFileRoute("/")({
  component: ErrorParserPage,
});

type Analysis = {
  explanation: string;
  causes: { percent: number; text: string }[];
  fixes: string[];
  example?: string;

  severity?: "Low" | "Medium" | "High" | "Critical";
  confidence?: number;

  codeInsights?: {
  title: string;
  description: string;
}[];

deprecatedApis?: {
  api: string;
  replacement: string;
  reason: string;
}[];
};

type MatchResult = {
  entry: { id: string; title: string };
  analysis: Analysis;
};

type Toast = { id: number; message: string; variant: "info" | "error" };

function ErrorParserPage() {
  const [logText, setLogText] = useState("");
  const [codeText, setCodeText] = useState("");
  const [result, setResult] = useState<
    | { kind: "match"; data: MatchResult; analysis: Analysis; logSnapshot: string }
    | { kind: "generic" }
  >({ kind: "generic" });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [errorFlash, setErrorFlash] = useState(false);
  const [animateResult, setAnimateResult] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [exampleIndex, setExampleIndex] = useState(0);

  const errorRef = useRef<HTMLTextAreaElement>(null);
  const genericRef = useRef<HTMLDivElement>(null);

  // Ensure body gets our themed background/font while on this page.
  useEffect(() => {
    document.body.classList.add("ep-body");
    return () => document.body.classList.remove("ep-body");
  }, []);

  const canAnalyze = logText.trim().length > 0 || codeText.trim().length > 0;

  function showToast(message: string, variant: "info" | "error" = "info") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }

  function triggerAnalysis() {
    const log = logText.trim();
    const code = codeText.trim();
    if (!log && !code) {
      setErrorFlash(true);
      errorRef.current?.focus();
      showToast("Paste an error message or code first", "error");
      setTimeout(() => setErrorFlash(false), 900);
      return;
    }

    const analysis = analyzeErrorAndCode(log, code);

    if (analysis.matched) {
      const matchData: MatchResult = {
        entry: {
          id: analysis.ruleId,
          title: analysis.title,
        },
        analysis: {
  explanation: analysis.rootCause,
  causes: [{ percent: 100, text: analysis.rootCause }],
  fixes: [analysis.fix],
  example: analysis.correctedExample,

  severity: analysis.severity,
  confidence: analysis.confidence,

  codeInsights: analysis.codeInsights,
  deprecatedApis: analysis.deprecatedApis,
},
      };

      setResult({
        kind: "match",
        data: matchData,
        analysis: matchData.analysis,
        logSnapshot: log || code,
      });
      setAnimateResult(false);
      requestAnimationFrame(() => setAnimateResult(true));
    } else {
      setResult({ kind: "generic" });
      setTimeout(() => genericRef.current?.focus(), 0);
    }
  }

  function insertExample(triggerAfter = false) {
    const ex = EXAMPLES[exampleIndex % EXAMPLES.length];
    setExampleIndex((i) => i + 1);
    setLogText(ex.error);
    setCodeText(ex.code);
    showToast("Loaded Roblox Script example");
    if (triggerAfter) {
      setTimeout(() => {
        const analysis = analyzeErrorAndCode(ex.error, ex.code);
        
        if (analysis.matched) {
          const matchData: MatchResult = {
            entry: {
              id: analysis.ruleId,
              title: analysis.title,
            },
            analysis: {
  explanation: analysis.rootCause,
  causes: [{ percent: 100, text: analysis.rootCause }],
  fixes: [analysis.fix],
  example: analysis.correctedExample,

  severity: analysis.severity,
  confidence: analysis.confidence,

  codeInsights: analysis.codeInsights,
  deprecatedApis: analysis.deprecatedApis,
},
          };
          setResult({
            kind: "match",
            data: matchData,
            analysis: matchData.analysis,
            logSnapshot: ex.error,
          });
          setAnimateResult(false);
          requestAnimationFrame(() => setAnimateResult(true));
        } else {
          setResult({ kind: "generic" });
        }
      }, 0);
    }
  }

  function clearAll() {
    setLogText("");
    setCodeText("");
    setResult({ kind: "generic" });
    errorRef.current?.focus();
  }

  async function copyExample(code: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopyLabel("Copied ✓");
      showToast("Code copied to clipboard");
    } catch {
      setCopyLabel("Copy failed");
      showToast("Could not copy — select the text manually", "error");
    } finally {
      setTimeout(() => setCopyLabel("Copy"), 2000);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      triggerAnalysis();
    }
  }

  const analysis = result?.kind === "match"
    ? result.analysis
    : { explanation: "", causes: [], fixes: [], example: undefined };

  const entry = result?.kind === "match"
  ? result.data.entry
  : { id: "unknown", title: "Unknown error" };

  const logSnapshot = result?.kind === "match" ? result.logSnapshot : "";

  const metaLabel = useMemo(() => {
    if (result?.kind !== "match") return "";
    return `Roblox • ${entry.id}`;
  }, [entry, result]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:bg-emerald-500 focus:text-black focus:px-3 focus:py-2 focus:rounded focus:text-xs focus:font-semibold"
      >
        Skip to input
      </a>

      <div
        role="region"
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none w-[calc(100%-2rem)] max-w-xs"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs shadow-xl backdrop-blur-sm transition-all duration-300 ${
              t.variant === "error"
                ? "bg-red-950/90 border-red-500/30 text-red-300"
                : "bg-zinc-900/95 border-emerald-500/20 text-zinc-200"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      <div className="relative min-h-screen flex flex-col items-center px-6 pb-10">
  <div className="ep-aurora" aria-hidden="true" />

  <header className="relative z-10 w-full max-w-5xl pt-14 md:pt-20 pb-8 space-y-6 text-center">
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-[10px] tracking-[0.2em] uppercase text-emerald-300 mx-auto">
      <span className="ep-dot" />
      Dynamic Root Cause Analyzer
    </div>

    <h1 className="serif-title text-4xl md:text-6xl leading-[1.05] text-zinc-50">
      Got a error?
      <br />
      Let&apos;s{" "}
      <span className="italic bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent">
        FIX it.
      </span>
    </h1>

    <p className="text-sm md:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
      Paste your console error and the related script lines. The analyzer
      reads context to find the{" "}
      <span className="text-zinc-200">exact root cause</span> — not generic
      guesses.
    </p>

    <div className="mt-3 text-xs text-zinc-500">
      Made by YusufVyce
    </div>

    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-zinc-500">
      <span className="flex items-center gap-1.5">
        <span className="text-emerald-400">✓</span>
        90% Fixer
      </span>

      <span className="flex items-center gap-1.5">
        <span className="text-emerald-400">✓</span>
        Roblox script focused
      </span>

      <span className="flex items-center gap-1.5">
        <span className="text-emerald-400">✓</span>
        Instant helper
      </span>
    </div>
  </header>

  <main
    id="main"
    tabIndex={-1}
    className="relative z-10 w-full max-w-5xl space-y-6 outline-none"
  >
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-5 space-y-5 ep-card p-5">
        <div>
          <label
            htmlFor="errorInput"
            className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider mb-2"
          >
            <span className="ep-step">1</span>
            Console Error Log
          </label>

          <div
            className={`bg-black/40 border rounded-lg p-3 transition-all ${
              errorFlash
                ? "border-red-500/60 ring-2 ring-red-500/60"
                : "border-zinc-800/70 focus-within:border-emerald-500/40 focus-within:shadow-[0_0_0_3px_rgba(16,185,129,0.08)]"
            }`}
          >
            <textarea
              id="errorInput"
              ref={errorRef}
              rows={5}
              aria-required
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="ServerScriptService.Inventory:41: attempt to index nil with 'Value'"
              className="w-full bg-transparent text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none resize-y"
            />
          </div>
        </div>

              <div>
                <label
                  htmlFor="codeInput"
                  className="flex items-center gap-2 text-xs text-zinc-400 uppercase tracking-wider mb-2"
                >
                  <span className="ep-step">2</span>
                  Related Code Snippet
                  <span className="normal-case text-zinc-600 tracking-normal">
                    · optional
                  </span>
                </label>
                <div className="bg-black/40 border border-zinc-800/70 rounded-lg p-3 focus-within:border-emerald-500/40 focus-within:shadow-[0_0_0_3px_rgba(16,185,129,0.08)] transition-all">
                  <textarea
                    id="codeInput"
                    rows={8}
                    value={codeText}
                    onChange={(e) => setCodeText(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={"local coins = player.leaderstats.Coins\nprint(coins.Value)"}
                    className="w-full bg-transparent text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none resize-y font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  disabled={!canAnalyze}
                  onClick={triggerAnalysis}
                  className="ep-cta px-5 py-2.5 rounded-lg text-xs font-semibold tracking-wide"
                >
                  Analyze Root Cause →
                </button>
                <span className="text-[10px] text-zinc-600 hidden sm:inline font-mono">
                  ⌘/Ctrl + ↵
                </span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-3.5 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-400 text-xs transition-all"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => insertExample(false)}
                  className="ml-auto px-3.5 py-2 rounded-lg border border-zinc-800/70 hover:border-emerald-500/30 hover:text-emerald-300 text-zinc-500 text-xs transition-all"
                >
                  ↻ Insert Example
                </button>
              </div>
            </div>

            <div
              className="lg:col-span-7 relative min-h-[420px]"
              aria-live="polite"
            >
              {!result && (
                <div className="ep-card p-12 text-center space-y-4 border-dashed">
                  <div className="mx-auto w-14 h-14 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center text-2xl text-emerald-400 font-mono">
                    {"{ }"}
                  </div>
                  <p className="text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed">
                    Paste an error on the left and click{" "}
                    <span className="text-emerald-300 font-medium">
                      Analyze Root Cause
                    </span>{" "}
                    to see a breakdown here.
                  </p>
                  <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                    awaiting input
                  </div>
                </div>
              )}

              {result?.kind === "match" && (
                <div
                  className={`ep-card ep-card-accent p-6 space-y-6 ${
                    animateResult ? "slide-fade-enter-active" : "slide-fade-enter"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-emerald-500/10 pb-4">
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-emerald-400 tracking-[0.2em] uppercase font-semibold">
                        {metaLabel}
                      </div>
                      <h2 className="text-2xl font-bold text-zinc-50 serif-title">
                        {entry.title}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-2">
  {analysis.severity && (
    <div className="px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-medium">
      🔥 Severity: {analysis.severity}
    </div>
  )}

  {analysis.confidence !== undefined && (
    <div className="px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium">
      🎯 Confidence: {analysis.confidence}%
    </div>
  )}
</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full font-medium">
                        <span className="ep-dot" />
                        Pattern match
                      </div>
                      <div
                        className="text-[10px] text-zinc-600 mt-2 font-mono max-w-[220px] truncate"
                        title={logSnapshot}
                      >
                        {logSnapshot
                          ? logSnapshot.length > 100
                            ? logSnapshot.slice(0, 100) + "…"
                            : logSnapshot
                          : "No log snapshot available"}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6">
                    <section className="space-y-2">
                      <h3 className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                        <span className="ep-step">1</span> Error Context
                      </h3>
                      <p className="text-sm text-zinc-300 leading-relaxed">
                        {analysis.explanation || "No analysis available."}
                      </p>
                    </section>

                    <section className="space-y-2">
                      <h3 className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                        <span className="ep-step">2</span> Root Cause Analysis
                      </h3>
                      <div className="space-y-2.5 mt-1">
                        {(analysis.causes ?? []).map((c, i) => (
                          <CauseRow key={i} percent={c.percent} text={c.text} />
                        ))}
                      </div>
                    </section>

                    <section className="space-y-2">
                      <h3 className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                        <span className="ep-step">3</span> How to fix it
                      </h3>
                      <ol className="text-sm text-zinc-300 space-y-2 leading-relaxed pl-1">
                        {(analysis.fixes ?? []).map((f, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="text-emerald-400 font-mono text-xs pt-0.5 shrink-0">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ol>
                    </section>

                        {analysis.codeInsights && analysis.codeInsights.length > 0 && (
                  <section className="space-y-2">
    <h3 className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400 font-semibold">
  <span className="ep-step">5</span>
  Code Insights
</h3>

    <div className="space-y-3">
      {analysis.codeInsights.map((insight, index) => (
        <div
          key={index}
          className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4"
        >
          <div className="text-sm font-semibold text-emerald-300">
            {insight.title}
          </div>

          <div className="mt-1 text-xs text-zinc-300 leading-relaxed">
            {insight.description}
          </div>
        </div>
      ))}
    </div>
  </section>
)}

{analysis.deprecatedApis && analysis.deprecatedApis.length > 0 && (
  <section className="space-y-2">
    <h3 className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400 font-semibold">
      <span className="ep-step">6</span>
      Deprecated APIs
    </h3>

    <div className="space-y-3">
      {analysis.deprecatedApis.map((api, index) => (
        <div
          key={index}
          className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4"
        >
          <div className="text-sm font-semibold text-yellow-300">
            {api.api} → {api.replacement}
          </div>

          <div className="mt-1 text-xs text-zinc-300">
            {api.reason}
          </div>
        </div>
      ))}
    </div>
  </section>
)}

                    {analysis.example && (
                      <section className="space-y-2 border-t border-emerald-500/10 pt-5">
                        <div className="flex items-center justify-between">
                          <h3 className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                            <span className="ep-step">4</span> Corrected
                            Implementation
                          </h3>
                          <button
                            type="button"
                            onClick={() => copyExample(analysis.example ?? "")}
                            className="text-[11px] px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-300 hover:border-emerald-500/30 transition-all"
                          >
                            {copyLabel}
                          </button>
                        </div>
                        <pre className="bg-black/60 border border-zinc-800/80 p-4 rounded-lg text-xs text-emerald-300/90 overflow-auto font-mono max-h-64 leading-relaxed">
                          {analysis.example ?? ""}
                        </pre>
                      </section>
                    )}
                  </div>
                </div>
              )}

              {result?.kind === "generic" && (
                <div ref={genericRef} tabIndex={-1} className="ep-card p-6 space-y-4">
                  <div className="border-b border-zinc-800/60 pb-3">
                    <h3 className="text-lg font-bold text-zinc-100 serif-title">
                      No exact match found
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      The analyzer couldn't match this specific error trace
                      against its rule set yet.
                    </p>
                  </div>
                  <ul className="text-xs text-zinc-300 space-y-2 leading-relaxed">
                    <li className="flex gap-2">
                      <span className="text-emerald-400">→</span>
                      Make sure you pasted the full error line, including the
                      message after the colon.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-emerald-400">→</span>
                      Paste the code snippet that contains the exact line
                      referenced in the error.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-emerald-400">→</span>
                      Try switching the platform filter, or leave it on
                      Auto-detect.
                    </li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => insertExample(true)}
                    className="text-[11px] px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-emerald-300 hover:border-emerald-500/30 transition-all"
                  >
                    Try an example instead
                  </button>
                </div>
              )}
            </div>
          </section>
        </main>

        <footer className="relative z-10 w-full max-w-5xl mt-14 text-center text-[11px] text-zinc-600 flex items-center justify-center gap-2">
          <span className="ep-dot" />
          Made by YusufVyce
        </footer>
      </div>
    </>
  );
}

function CauseRow({ percent, text }: { percent: number; text: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(percent));
    return () => cancelAnimationFrame(raf);
  }, [percent]);
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-3 rounded flex flex-col gap-2">
      <div className="flex justify-between items-start gap-4">
        <span className="text-xs text-zinc-300">{text}</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono shrink-0">
          {percent}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Likelihood: ${percent}%`}
        className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden mt-1"
      >
        <div
          className="bg-emerald-500 h-full transition-[width] duration-500 ease-out"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}