import { lexLuau } from "./luau/lexer";
import { parseLuau } from "./luau/parser";
import { analyzeLuauSemantics } from "./luau/semanticAnalyzer";
import { tokenizeLuau, type LuauToken } from "./luau/tokenizer";
import type { ExtractedContext } from "./types";

export function extractContext(codeText: string, logText: string, parserTokens?: unknown[]): ExtractedContext {
  const candidateTokens = (parserTokens ?? []).filter(Boolean) as LuauToken[];

  const tokenResult =
    candidateTokens.length > 0
      ? { parserTokens: candidateTokens }
      : tokenizeLuau(lexLuau(codeText));

  const parseResult = parseLuau(tokenResult.parserTokens);
  const context = analyzeLuauSemantics(parseResult.ast, codeText, logText);

  return {
    ...context,
    parserDiagnostics: parseResult.diagnostics,
    ast: parseResult.ast,
  };
}
