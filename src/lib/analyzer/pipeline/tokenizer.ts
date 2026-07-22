import type { TokenizedInput } from "./types";
import { lexLuau } from "./luau/lexer";
import { tokenizeLuau } from "./luau/tokenizer";

export function tokenizeInput(logText: string, codeText: string): TokenizedInput {
  const codeLexemes = lexLuau(codeText);
  const codeTokenized = tokenizeLuau(codeLexemes);

  const logTokens = logText
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  const tokens = [...logTokens, ...codeTokenized.tokenStrings];
  const tokenCounts: Record<string, number> = {};
  for (const token of tokens) tokenCounts[token] = (tokenCounts[token] ?? 0) + 1;

  return {
    tokens,
    tokenCounts,
    lineTokens: codeTokenized.lineTokens,
    parserTokens: codeTokenized.parserTokens,
  };
}
