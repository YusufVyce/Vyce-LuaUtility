export type LuauLexemeKind =
  | "word"
  | "number"
  | "string"
  | "symbol"
  | "newline"
  | "comment"
  | "eof";

export interface LuauLexeme {
  kind: LuauLexemeKind;
  value: string;
  line: number;
  column: number;
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\r";
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isIdentifierStart(char: string): boolean {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_";
}

function isIdentifierPart(char: string): boolean {
  return isIdentifierStart(char) || isDigit(char);
}

const THREE_CHAR_SYMBOLS = new Set(["..."]);
const TWO_CHAR_SYMBOLS = new Set([
  "==",
  "~=",
  "<=",
  ">=",
  "::",
  "->",
  "..",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "^=",
]);

export function lexLuau(source: string): LuauLexeme[] {
  const lexemes: LuauLexeme[] = [];
  let i = 0;
  let line = 1;
  let column = 1;

  const push = (kind: LuauLexemeKind, value: string, tokenLine: number, tokenColumn: number) => {
    lexemes.push({ kind, value, line: tokenLine, column: tokenColumn });
  };

  while (i < source.length) {
    const char = source[i];

    if (char === "\n") {
      push("newline", "\n", line, column);
      i++;
      line++;
      column = 1;
      continue;
    }

    if (isWhitespace(char)) {
      i++;
      column++;
      continue;
    }

    if (char === "-" && source[i + 1] === "-") {
      const tokenLine = line;
      const tokenColumn = column;
      i += 2;
      column += 2;

      if (source[i] === "[" && source[i + 1] === "[") {
        i += 2;
        column += 2;
        let comment = "";
        while (i < source.length && !(source[i] === "]" && source[i + 1] === "]")) {
          const c = source[i];
          comment += c;
          i++;
          if (c === "\n") {
            line++;
            column = 1;
          } else {
            column++;
          }
        }
        if (i < source.length) {
          i += 2;
          column += 2;
        }
        push("comment", comment, tokenLine, tokenColumn);
        continue;
      }

      let comment = "";
      while (i < source.length && source[i] !== "\n") {
        comment += source[i];
        i++;
        column++;
      }
      push("comment", comment, tokenLine, tokenColumn);
      continue;
    }

    if (char === "'" || char === '"') {
      const quote = char;
      const tokenLine = line;
      const tokenColumn = column;
      i++;
      column++;

      let value = "";
      while (i < source.length) {
        const c = source[i];
        if (c === "\\") {
          const next = source[i + 1] ?? "";
          value += c + next;
          i += 2;
          column += 2;
          continue;
        }
        if (c === quote) {
          i++;
          column++;
          break;
        }
        value += c;
        i++;
        if (c === "\n") {
          line++;
          column = 1;
        } else {
          column++;
        }
      }

      push("string", value, tokenLine, tokenColumn);
      continue;
    }

    if (isDigit(char)) {
      const tokenLine = line;
      const tokenColumn = column;
      let value = "";

      while (i < source.length && (isDigit(source[i]) || source[i] === "." || /[a-fA-FxX_]/.test(source[i] ?? ""))) {
        value += source[i];
        i++;
        column++;
      }

      push("number", value, tokenLine, tokenColumn);
      continue;
    }

    if (isIdentifierStart(char)) {
      const tokenLine = line;
      const tokenColumn = column;
      let value = "";
      while (i < source.length && isIdentifierPart(source[i])) {
        value += source[i];
        i++;
        column++;
      }
      push("word", value, tokenLine, tokenColumn);
      continue;
    }

    const tokenLine = line;
    const tokenColumn = column;
    const three = source.slice(i, i + 3);
    if (THREE_CHAR_SYMBOLS.has(three)) {
      push("symbol", three, tokenLine, tokenColumn);
      i += 3;
      column += 3;
      continue;
    }

    const two = source.slice(i, i + 2);
    if (TWO_CHAR_SYMBOLS.has(two)) {
      push("symbol", two, tokenLine, tokenColumn);
      i += 2;
      column += 2;
      continue;
    }

    push("symbol", char, tokenLine, tokenColumn);
    i++;
    column++;
  }

  push("eof", "<eof>", line, column);
  return lexemes;
}
