import { ROBLOX_DIAGNOSTIC_KNOWLEDGE_BASE } from "./knowledgeBase";
import type {
  ClassifiedError,
  Evidence,
  ExtractedContext,
  RuleSignal,
  Severity,
  TokenizedInput,
} from "./types";

function mkEvidence(id: string, message: string, score: number, line?: number): Evidence {
  return { id, message, score, line };
}

function severityFromScore(score: number): Severity {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

function buildSignal(
  id: string,
  title: string,
  domain: string,
  rootCause: string,
  evidence: Evidence[],
  docs: string[],
  relatedApis: string[],
  relatedErrors: string[],
  fixes: RuleSignal["fixes"],
  estimatedFixTime: string,
  difficulty: RuleSignal["difficulty"],
): RuleSignal {
  const score = evidence.reduce((sum, item) => sum + item.score, 0);
  return {
    id,
    title,
    domain,
    severity: severityFromScore(score),
    rootCause,
    evidence,
    fixes,
    docs,
    relatedApis,
    relatedErrors,
    estimatedFixTime,
    difficulty,
  };
}

function knowledgeForFamily(family: ClassifiedError["family"]): RuleSignal["docs"] {
  const unique = new Set<string>();
  for (const item of ROBLOX_DIAGNOSTIC_KNOWLEDGE_BASE) {
    if (item.family !== family) continue;
    for (const doc of item.docs) unique.add(doc);
    if (unique.size >= 6) break;
  }
  return [...unique];
}

function buildNilSignal(context: ExtractedContext, errorLine?: number): RuleSignal {
  const evidence: Evidence[] = [mkEvidence("family-nil", "Error family indicates nil access/call", 25, errorLine)];

  if (context.hasFindFirstChild) evidence.push(mkEvidence("findfirstchild", "FindFirstChild may return nil", 18));
  if (context.hasWaitForChild) evidence.push(mkEvidence("waitforchild", "WaitForChild appears in snippet; timing-dependent hierarchy access", 10));
  if (context.requires.length > 0) evidence.push(mkEvidence("require-path", "Module require() chain may return nil or partial export", 16));
  if (context.hasCharacterAdded === false && context.apis.includes("CharacterAdded") === false) {
    if (context.hasCharacterPropertyAccessWithoutSync) {
      evidence.push(mkEvidence("character-race", "Character accessed without CharacterAdded synchronization", 22));
    }
  }

  const topSymbol = context.symbols.find((item) => item.kind === "variable" || item.kind === "property");
  const rootCause = topSymbol
    ? `Value '${topSymbol.name}' is likely nil at the call/index site due to timing or initialization order.`
    : "A value is nil at runtime because initialization, replication, or module export did not complete before use.";

  return buildSignal(
    "nil-root-cause",
    "Nil Lifetime Breakdown",
    "Nil Safety",
    rootCause,
    evidence,
    knowledgeForFamily("INDEX_NIL"),
    ["FindFirstChild", "WaitForChild", "CharacterAdded", "require"],
    ["attempt to index nil", "attempt to call nil", "attempt to concatenate nil", "attempt to compare nil"],
    {
      minimal: "Guard the exact access/call with a nil check before using the value.",
      better: "Restructure initialization so the dependency is created/replicated before this line runs.",
      production: "Add explicit readiness orchestration (CharacterAdded/WaitForChild timeout/module contract asserts) and telemetry for missing dependencies.",
    },
    "5-15 min",
    "Easy",
  );
}

function buildRemoteSignal(context: ExtractedContext, errorLine?: number): RuleSignal {
  const evidence: Evidence[] = [mkEvidence("remote-usage", "Remote API usage detected", 20, errorLine)];

  if (context.side === "server" && context.apis.some((api) => api === "FireServer" || api === "InvokeServer")) {
    evidence.push(mkEvidence("remote-side-mismatch", "Server code is calling client-only remote methods", 35));
  }
  if (context.side === "client" && context.apis.some((api) => api === "FireClient" || api === "FireAllClients" || api === "InvokeClient")) {
    evidence.push(mkEvidence("remote-side-mismatch", "Client code is calling server-only remote methods", 35));
  }
  if (!context.hasPcall && context.apis.some((api) => api.includes("Invoke"))) {
    evidence.push(mkEvidence("invoke-no-guard", "Invoke* call has no pcall guard", 15));
  }

  return buildSignal(
    "remote-boundary",
    "Remote Boundary Validation",
    "Networking",
    "Remote call direction or callback contract does not match the current execution side.",
    evidence,
    knowledgeForFamily("REMOTE"),
    ["RemoteEvent", "RemoteFunction", "OnServerEvent", "OnClientEvent"],
    ["attempt to call nil", "invalid argument", "cannot cast"],
    {
      minimal: "Use FireServer/InvokeServer only on clients and FireClient/FireAllClients/InvokeClient only on servers.",
      better: "Define typed remote payload contracts and validate every argument at the receiver.",
      production: "Introduce a centralized networking layer that enforces side-safe wrappers and schema validation.",
    },
    "15-40 min",
    "Moderate",
  );
}

function buildDataStoreSignal(context: ExtractedContext, errorLine?: number): RuleSignal {
  const evidence: Evidence[] = [mkEvidence("datastore-usage", "DataStore API usage detected", 22, errorLine)];
  if (!context.hasPcall) evidence.push(mkEvidence("datastore-no-pcall", "DataStore request is missing pcall retry guard", 30));
  if (context.hasLoops) evidence.push(mkEvidence("datastore-loop", "DataStore call appears near loop constructs, risk of throttling", 25));

  return buildSignal(
    "datastore-reliability",
    "DataStore Reliability",
    "DataStore",
    "DataStore operations lack resiliency controls (pcall, retries, budget awareness, or write coalescing).",
    evidence,
    knowledgeForFamily("DATASTORE"),
    ["GetAsync", "SetAsync", "UpdateAsync", "GetRequestBudgetForRequestType"],
    ["HTTP 429", "request was throttled", "attempt to call nil"],
    {
      minimal: "Wrap DataStore calls in pcall and handle failures.",
      better: "Add bounded retry with exponential backoff and UpdateAsync over SetAsync for contested keys.",
      production: "Implement a write queue with budget checks, deduplication, and telemetry-driven fallback storage.",
    },
    "20-60 min",
    "Hard",
  );
}

function buildTweenSignal(context: ExtractedContext, errorLine?: number, logText = ""): RuleSignal {
  const evidence: Evidence[] = [mkEvidence("tween-usage", "TweenService:Create usage detected", 20, errorLine)];

  for (const goal of context.tweenGoals) {
    if (goal.property.toLowerCase() === "size") {
      evidence.push(mkEvidence("tween-size", `Tween goal modifies property '${goal.property}'`, 12, goal.line));
      if (/cannot be tweened/i.test(logText)) {
        evidence.push(mkEvidence("tween-invalid-property", "Runtime reports property cannot be tweened", 38, goal.line));
      }
    }
  }

  return buildSignal(
    "tween-property-compat",
    "Tween Property Compatibility",
    "TweenService",
    "Tween target/property pair is invalid, readonly, or uses an incompatible datatype for TweenService interpolation.",
    evidence,
    knowledgeForFamily("TWEEN"),
    ["TweenService:Create", "TweenInfo", "GuiObject.Size", "BasePart.Size"],
    ["property cannot be tweened", "invalid argument #3", "unable to cast to UDim2"],
    {
      minimal: "Verify the tween goal property exists and accepts tweening on the target instance class.",
      better: "Validate goal value types (UDim2/Vector3/number) before constructing TweenService:Create.",
      production: "Create typed tween builders per instance class with whitelist validation for tweenable properties.",
    },
    "10-25 min",
    "Moderate",
  );
}

function buildCharacterSignal(context: ExtractedContext, errorLine?: number): RuleSignal {
  const evidence: Evidence[] = [mkEvidence("character-api", "Character/Humanoid API usage detected", 18, errorLine)];
  if (!context.hasCharacterAdded) evidence.push(mkEvidence("characteradded-missing", "CharacterAdded synchronization missing", 26));
  if (!context.hasWaitForChild) evidence.push(mkEvidence("character-wait", "Character child access is not guarded by WaitForChild timeout", 16));

  return buildSignal(
    "character-lifecycle",
    "Character Lifecycle Guarding",
    "Character",
    "Character/Humanoid access runs before spawn or respawn lifecycle is stable.",
    evidence,
    knowledgeForFamily("CHARACTER"),
    ["Players.LocalPlayer", "CharacterAdded", "CharacterAppearanceLoaded", "HumanoidRootPart"],
    ["attempt to index nil with Humanoid", "attempt to index nil with Character"],
    {
      minimal: "Wait for CharacterAdded and then WaitForChild('Humanoid', timeout).",
      better: "Handle respawn by reconnecting lifecycle listeners and cleaning stale references.",
      production: "Implement a character state machine that emits readiness events for all dependent systems.",
    },
    "10-30 min",
    "Moderate",
  );
}

function buildWaitSignal(context: ExtractedContext, errorLine?: number): RuleSignal {
  const evidence: Evidence[] = [mkEvidence("wait-apis", "WaitForChild/FindFirstChild usage detected", 14, errorLine)];
  if (context.hasFindFirstChild) evidence.push(mkEvidence("findfirstchild-nil", "FindFirstChild can return nil without timeout semantics", 18));
  if (context.hasWaitForChild && !context.hasWaitForChildTimeout) {
    evidence.push(mkEvidence("waitforchild-timeout", "WaitForChild appears without explicit timeout", 20));
  }

  return buildSignal(
    "wait-race",
    "Replication Timing and Wait Strategy",
    "Replication",
    "The snippet relies on replication order assumptions that can intermittently produce nil references.",
    evidence,
    knowledgeForFamily("WAIT"),
    ["WaitForChild", "FindFirstChild", "StreamingEnabled", "ReplicatedStorage"],
    ["infinite yield possible", "attempt to index nil"],
    {
      minimal: "Add explicit nil checks around FindFirstChild results and return early on miss.",
      better: "Use WaitForChild with bounded timeout and fallback behavior.",
      production: "Adopt explicit dependency bootstrapping with deterministic readiness events.",
    },
    "5-20 min",
    "Easy",
  );
}

export function runRuleEngine(
  classified: ClassifiedError,
  context: ExtractedContext,
  tokenized: TokenizedInput,
  logText: string,
): RuleSignal[] {
  const signals: RuleSignal[] = [];

  if (["INDEX_NIL", "CALL_NIL", "CONCAT_NIL", "ARITHMETIC_NIL", "COMPARE_NIL"].includes(classified.family)) {
    signals.push(buildNilSignal(context, classified.lineReference));
  }

  if (classified.family === "REMOTE" || context.hasRemoteUse) {
    signals.push(buildRemoteSignal(context, classified.lineReference));
  }

  if (classified.family === "DATASTORE" || context.hasDataStoreUse) {
    signals.push(buildDataStoreSignal(context, classified.lineReference));
  }

  if (classified.family === "TWEEN" || context.hasTweenUse || /cannot be tweened/i.test(logText)) {
    signals.push(buildTweenSignal(context, classified.lineReference, logText));
  }

  if (classified.family === "CHARACTER" || context.apis.includes("CharacterAdded") || context.apis.includes("Humanoid")) {
    signals.push(buildCharacterSignal(context, classified.lineReference));
  }

  if (classified.family === "WAIT" || context.hasFindFirstChild || context.hasWaitForChild) {
    signals.push(buildWaitSignal(context, classified.lineReference));
  }

  if (signals.length === 0) {
    const evidence: Evidence[] = [mkEvidence("unknown-family", "No specialized family matched; using generic context scoring", 20)];
    if (tokenized.tokens.length > 20) evidence.push(mkEvidence("token-depth", "Sufficient token depth for contextual fallback", 10));
    if (context.symbols.length > 0) evidence.push(mkEvidence("symbol-extract", "Extracted symbols from code snippet", 15));

    signals.push(
      buildSignal(
        "generic-runtime",
        "Generic Runtime Context",
        "Runtime",
        "The runtime failure likely comes from initialization order, missing exports, or side mismatch around extracted symbols.",
        evidence,
        knowledgeForFamily("UNKNOWN"),
        context.apis.slice(0, 8),
        ["attempt to index nil", "attempt to call nil", "invalid argument"],
        {
          minimal: "Trace the highlighted symbol and add runtime guards at the failing access line.",
          better: "Refactor startup flow to initialize dependencies before use.",
          production: "Introduce deterministic bootstrapping with health assertions and typed module boundaries.",
        },
        "15-45 min",
        "Moderate",
      ),
    );
  }

  return signals;
}
