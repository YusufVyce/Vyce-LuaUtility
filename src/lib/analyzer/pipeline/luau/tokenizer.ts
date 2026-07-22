import type { LuauLexeme } from "./lexer";

export type LuauTokenKind =
  | "Identifier"
  | "Keyword"
  | "Number"
  | "String"
  | "Symbol"
  | "Newline"
  | "Eof";

export interface LuauToken {
  kind: LuauTokenKind;
  value: string;
  line: number;
  column: number;
}

const KEYWORDS = new Set([
  "and",
  "break",
  "continue",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
  "type",
  "export",
]);

function lexemeToToken(lexeme: LuauLexeme): LuauToken | null {
  switch (lexeme.kind) {
    case "word":
      return {
        kind: KEYWORDS.has(lexeme.value) ? "Keyword" : "Identifier",
        value: lexeme.value,
        line: lexeme.line,
        column: lexeme.column,
      };
    case "number":
      return {
        kind: "Number",
        value: lexeme.value,
        line: lexeme.line,
        column: lexeme.column,
      };
    case "string":
      return {
        kind: "String",
        value: lexeme.value,
        line: lexeme.line,
        column: lexeme.column,
      };
    case "symbol":
      return {
        kind: "Symbol",
        value: lexeme.value,
        line: lexeme.line,
        column: lexeme.column,
      };
    case "newline":
      return {
        kind: "Newline",
        value: "\n",
        line: lexeme.line,
        column: lexeme.column,
      };
    case "comment":
      return null;
    case "eof":
      return {
        kind: "Eof",
        value: "<eof>",
        line: lexeme.line,
        column: lexeme.column,
      };
    default:
      return null;
  }
}

export interface LuauTokenizationResult {
  parserTokens: LuauToken[];
  tokenStrings: string[];
  tokenCounts: Record<string, number>;
  lineTokens: Array<{ line: number; tokens: string[] }>;
}

export function tokenizeLuau(lexemes: LuauLexeme[]): LuauTokenizationResult {
  const parserTokens: LuauToken[] = [];

  for (const lexeme of lexemes) {
    const token = lexemeToToken(lexeme);
    if (!token) continue;
    if (token.kind !== "Newline") {
      parserTokens.push(token);
    }
  }

  const tokenStrings = parserTokens
    .filter((token) => token.kind !== "Eof")
    .map((token) => token.value.toLowerCase());

  const tokenCounts: Record<string, number> = {};
  for (const token of tokenStrings) {
    tokenCounts[token] = (tokenCounts[token] ?? 0) + 1;
  }

  const lineBucket = new Map<number, string[]>();
  for (const token of parserTokens) {
    if (token.kind === "Eof") continue;
    const store = lineBucket.get(token.line) ?? [];
    store.push(token.value.toLowerCase());
    lineBucket.set(token.line, store);
  }

  const lineTokens = [...lineBucket.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([line, tokens]) => ({ line, tokens }));

  return {
    parserTokens,
    tokenStrings,
    tokenCounts,
    lineTokens,
  };
}
