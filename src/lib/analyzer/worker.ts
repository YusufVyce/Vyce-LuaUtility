import { detectCodeLanguage, resolvePlatform } from "./language";
import { buildCodeFacts } from "./parser";
import { inferCause } from "./inference";
import type { Platform } from "./types";

type Request = {
  id: string;
  logText: string;
  codeText: string;
  platform?: Platform | "auto";
};

type Response = {
  id: string;
  result: any;
};

self.addEventListener("message", (ev: MessageEvent<Request>) => {
  const { id, logText, codeText, platform } = ev.data;
  const timings: Record<string, number> = {};
  const totalStart = performance.now();

  // Wrap stages in try/catch so errors are reported back to main thread
  try {
    console.time(`[worker:${id}] total`);

    console.time(`[worker:${id}] resolvePlatform`);
    const t0 = performance.now();
    const resolvedPlatform = resolvePlatform(logText, codeText, platform);
    timings.resolvePlatform = performance.now() - t0;
    console.timeEnd(`[worker:${id}] resolvePlatform`);

    console.time(`[worker:${id}] detectLanguage`);
    const t1 = performance.now();
    const language = detectCodeLanguage(codeText);
    timings.detectLanguage = performance.now() - t1;
    console.timeEnd(`[worker:${id}] detectLanguage`);

    console.time(`[worker:${id}] buildCodeFacts`);
    const t2 = performance.now();
    const codeFacts = buildCodeFacts(codeText, language);
    timings.buildCodeFacts = performance.now() - t2;
    console.timeEnd(`[worker:${id}] buildCodeFacts`);

    console.time(`[worker:${id}] inferCause`);
    const t3 = performance.now();
    const analysis = inferCause(logText, codeFacts, resolvedPlatform);
    timings.inferCause = performance.now() - t3;
    console.timeEnd(`[worker:${id}] inferCause`);

    const total = performance.now() - totalStart;
    timings.total = total;

    try {
      (analysis as any).timings = timings;
    } catch (e) {
      // ignore non-writable
    }

    const payload: Response = { id, result: analysis };
    // @ts-ignore - worker global
    self.postMessage(payload);
    console.timeEnd(`[worker:${id}] total`);
  } catch (err) {
    // Send error back so main thread can resolve/recover
    const payload: Response = {
      id,
      result: { matched: false, __workerError: true, message: String(err), stack: (err && (err as Error).stack) || "" },
    };
    // @ts-ignore
    self.postMessage(payload);
    console.error("Analyzer worker error:", err);
  }
});

export {};
