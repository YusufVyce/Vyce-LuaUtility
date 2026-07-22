/** @deprecated Legacy analyzer module retained for compatibility only. Do not import in production runtime. */
import { normalize } from "./normalize";
import { tokenize } from "./tokenizer";
import { MALFORMED_PATTERN_ERROR } from "./roblox/errors/malformedPattern";
import { CYCLIC_PARENTING } from "./roblox/errors/cyclicParenting";
import { NAMING_TYPO } from "./roblox/errors/namingTypo";

export interface MatchRule {
  id: string;
  keywords: string[];
  pattern?: RegExp;
}

export interface MatchResult {
  id: string;
  score: number;
  confidence: number;
}

export function matchRule(input: string, rules: MatchRule[]): MatchResult | null {
  const words = tokenize(normalize(input));

  let best: MatchResult | null = null;

  for (const rule of rules) {
    if (rule.pattern?.test(input)) {
      return { id: rule.id, score: rule.keywords.length, confidence: 100 };
    }

    let score = 0;

    for (const keyword of rule.keywords) {
      if (words.includes(keyword.toLowerCase())) {
        score++;
      }
    }

    const confidence =
      rule.keywords.length === 0 ? 0 : Math.round((score / rule.keywords.length) * 100);

    if (!best || confidence > best.confidence) {
      best = {
        id: rule.id,
        score,
        confidence,
      };
    }
  }

  return best;
}

/**
 * Console messages that require exact routing. Broad keyword matching must not
 * route "attempt to index string" or "attempt to index number" to nil.
 */
export const ROBLOX_CONSOLE_RULES: MatchRule[] = [
  {
    id: CYCLIC_PARENTING.id,
    pattern: CYCLIC_PARENTING.pattern,
    keywords: CYCLIC_PARENTING.keywords ?? ["parent", "descendant"],
  },
  {
    id: NAMING_TYPO.id,
    pattern: NAMING_TYPO.pattern,
    keywords: NAMING_TYPO.keywords ?? ["attempt", "call", "nil"],
  },
  {
    id: MALFORMED_PATTERN_ERROR.id,
    pattern: MALFORMED_PATTERN_ERROR.pattern,
    keywords: MALFORMED_PATTERN_ERROR.keywords ?? ["malformed", "pattern"],
  },
  {
    id: "roblox-index-nil",
    pattern: /attempt to index (?:a )?nil value|attempt to index nil(?:\s|$)/i,
    keywords: ["attempt", "index", "nil"],
  },
  {
    id: "roblox-index-string",
    pattern: /attempt to index (?:a )?string value|attempt to index string(?:\s|$)/i,
    keywords: ["attempt", "index", "string"],
  },
  {
    id: "roblox-index-number",
    pattern: /attempt to index (?:a )?number value|attempt to index number(?:\s|$)/i,
    keywords: ["attempt", "index", "number"],
  },
  {
    id: "roblox-metamethod-yield",
    pattern: /attempt to yield across (?:a )?(?:metamethod|C-call) boundary/i,
    keywords: ["yield", "metamethod", "boundary"],
  },
  {
    id: "roblox-cyclic-reference",
    pattern: /table has a cyclic reference|cyclic table reference/i,
    keywords: ["table", "cyclic", "reference"],
  },
  {
    id: "roblox-not-a-function",
    pattern: /passed value is not a function/i,
    keywords: ["passed", "value", "function"],
  },
  {
    id: "roblox-argument-nil",
    pattern: /argument #?\d+ (?:missing or nil|is missing or nil)|bad argument #?\d+.*nil/i,
    keywords: ["argument", "nil"],
  },
  {
    id: "luau-expected-identifier",
    pattern: /expected identifier when parsing expression/i,
    keywords: ["expected", "identifier", "parsing"],
  },
  {
    id: "roblox-invalid-service",
    pattern: /(?:is not a valid service name|service .+ is not available)/i,
    keywords: ["service", "valid", "name"],
  },
  {
    id: "luau-dead-coroutine",
    pattern: /cannot resume dead coroutine/i,
    keywords: ["resume", "dead", "coroutine"],
  },
  {
    id: "roblox-invalid-class-name",
    pattern: /unable to create an? instance of class|invalid class name/i,
    keywords: ["unable", "create", "instance", "class"],
  },
];

export function matchRobloxConsoleError(input: string): MatchResult | null {
  return matchRule(input, ROBLOX_CONSOLE_RULES);
}
