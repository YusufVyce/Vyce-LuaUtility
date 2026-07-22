import { describe, expect, it } from "vitest";
import { lexLuau } from "./lexer";
import { parseLuau } from "./parser";
import { analyzeLuauSemantics } from "./semanticAnalyzer";
import { tokenizeLuau } from "./tokenizer";

describe("lightweight Luau AST pipeline", () => {
  it("lexes, tokenizes, parses, and semantically analyzes core Luau constructs", () => {
    const code = [
      "local Players = game:GetService(\"Players\")",
      "local TweenService = game:GetService(\"TweenService\")",
      "local mod = require(script.Parent.Module)",
      "export type Payload = { id: number, name: string }",
      "",
      "local function run(player: Player): ()",
      "  for i = 1, 10, 1 do",
      "    if i > 5 then",
      "      continue",
      "    end",
      "  end",
      "",
      "  for _, child in ipairs(workspace:GetChildren()) do",
      "    if child:FindFirstChild(\"PrimaryPart\") then",
      "      break",
      "    end",
      "  end",
      "",
      "  while player do",
      "    repeat",
      "      task.defer(function() end)",
      "      task.spawn(function() end)",
      "      coroutine.resume(coroutine.create(function() end))",
      "      local x = pcall(function() return child:WaitForChild(\"Humanoid\", 5) end)",
      "      TweenService:Create(child, TweenInfo.new(1), { Size = UDim2.new(1,0,1,0) }):Play()",
      "    until player.Character",
      "    return mod",
      "  end",
      "end",
      "",
      "return { run = run }",
    ].join("\n");

    const lexemes = lexLuau(code);
    const tokenized = tokenizeLuau(lexemes);
    const parsed = parseLuau(tokenized.parserTokens);
    const context = analyzeLuauSemantics(parsed.ast, code, "StarterPlayerScripts.Test:1: attempt to index nil");

    expect(lexemes.length).toBeGreaterThan(10);
    expect(tokenized.parserTokens.length).toBeGreaterThan(10);
    expect(parsed.ast.body.length).toBeGreaterThan(2);
    expect(context.requires.length).toBe(1);
    expect(context.services).toContain("TweenService");
    expect(context.hasWaitForChild).toBe(true);
    expect(context.hasWaitForChildTimeout).toBe(true);
    expect(context.hasTaskSpawn).toBe(true);
    expect(context.hasTaskDefer).toBe(true);
    expect(context.hasCoroutine).toBe(true);
    expect(context.hasLoops).toBe(true);
    expect(context.moduleExports.length).toBeGreaterThan(0);
  });
});
