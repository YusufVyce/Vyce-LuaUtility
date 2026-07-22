import type {
  AssignmentStatement,
  BinaryExpression,
  BooleanLiteral,
  BreakStatement,
  CallExpression,
  CallStatement,
  ContinueStatement,
  Expression,
  ForGenericStatement,
  ForNumericStatement,
  FunctionDeclarationStatement,
  FunctionExpression,
  FunctionParameter,
  Identifier,
  IfClause,
  IfStatement,
  IndexExpression,
  LocalDeclarationStatement,
  MemberExpression,
  NilLiteral,
  NumberLiteral,
  Program,
  RepeatUntilStatement,
  ReturnStatement,
  SourceLocation,
  SourceRange,
  Statement,
  StringLiteral,
  TableConstructorExpression,
  TableField,
  TypeAliasStatement,
  TypeExpression,
  UnaryExpression,
  VarargLiteral,
  WhileStatement,
} from "./ast";
import type { LuauToken } from "./tokenizer";

const BINARY_PRECEDENCE: Record<string, number> = {
  or: 1,
  and: 2,
  "<": 3,
  ">": 3,
  "<=": 3,
  ">=": 3,
  "==": 3,
  "~=": 3,
  "..": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
  "^": 7,
};

const RIGHT_ASSOCIATIVE = new Set(["^", ".."]);

export interface LuauParseResult {
  ast: Program;
  diagnostics: string[];
}

function loc(token: LuauToken): SourceLocation {
  return { line: token.line, column: token.column };
}

function range(start: LuauToken, end: LuauToken): SourceRange {
  return { start: loc(start), end: loc(end) };
}

function placeholderIdentifier(token: LuauToken): Identifier {
  return {
    kind: "Identifier",
    name: "__error__",
    range: range(token, token),
  };
}

class LuauParser {
  private index = 0;
  private diagnostics: string[] = [];

  constructor(private readonly tokens: LuauToken[]) {}

  parse(): LuauParseResult {
    const start = this.current();
    const body = this.parseBlock(new Set(["<eof>"]));
    const end = this.current();

    return {
      ast: {
        kind: "Program",
        body,
        range: range(start, end),
      },
      diagnostics: this.diagnostics,
    };
  }

  private current(): LuauToken {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1];
  }

  private peek(offset = 1): LuauToken {
    return this.tokens[this.index + offset] ?? this.tokens[this.tokens.length - 1];
  }

  private advance(): LuauToken {
    const token = this.current();
    if (token.kind !== "Eof") {
      this.index++;
    }
    return token;
  }

  private atEof(): boolean {
    return this.current().kind === "Eof";
  }

  private checkKeyword(value: string): boolean {
    const token = this.current();
    return token.kind === "Keyword" && token.value === value;
  }

  private matchKeyword(value: string): boolean {
    if (!this.checkKeyword(value)) return false;
    this.advance();
    return true;
  }

  private checkSymbol(value: string): boolean {
    const token = this.current();
    return token.kind === "Symbol" && token.value === value;
  }

  private matchSymbol(value: string): boolean {
    if (!this.checkSymbol(value)) return false;
    this.advance();
    return true;
  }

  private consumeSymbol(value: string, message: string): LuauToken {
    if (this.checkSymbol(value)) return this.advance();
    this.error(this.current(), message);
    return this.current();
  }

  private consumeIdentifier(message: string): LuauToken {
    const token = this.current();
    if (token.kind === "Identifier") return this.advance();
    this.error(token, message);
    return token;
  }

  private error(token: LuauToken, message: string) {
    this.diagnostics.push(`L${token.line}:C${token.column} ${message}`);
  }

  private parseBlock(stopKeywords: Set<string>): Statement[] {
    const statements: Statement[] = [];

    while (!this.atEof()) {
      const token = this.current();
      if (token.kind === "Keyword" && stopKeywords.has(token.value)) {
        break;
      }
      if (token.kind === "Eof") break;

      const statement = this.parseStatement();
      if (statement) {
        statements.push(statement);
      } else {
        this.advance();
      }

      this.matchSymbol(";");
    }

    return statements;
  }

  private parseStatement(): Statement | null {
    const token = this.current();

    if (this.matchKeyword("local")) {
      if (this.matchKeyword("function")) {
        return this.parseFunctionDeclaration(true, token);
      }
      return this.parseLocalDeclaration(token);
    }

    if (this.matchKeyword("function")) {
      return this.parseFunctionDeclaration(false, token);
    }

    if (this.matchKeyword("if")) return this.parseIfStatement(token);
    if (this.matchKeyword("while")) return this.parseWhileStatement(token);
    if (this.matchKeyword("repeat")) return this.parseRepeatUntilStatement(token);
    if (this.matchKeyword("for")) return this.parseForStatement(token);

    if (this.matchKeyword("return")) {
      const values = this.startsExpression() ? this.parseExpressionList() : [];
      return {
        kind: "ReturnStatement",
        values,
        range: range(token, this.previous()),
      } satisfies ReturnStatement;
    }

    if (this.matchKeyword("break")) {
      return {
        kind: "BreakStatement",
        range: range(token, this.previous()),
      } satisfies BreakStatement;
    }

    if (this.matchKeyword("continue")) {
      return {
        kind: "ContinueStatement",
        range: range(token, this.previous()),
      } satisfies ContinueStatement;
    }

    if (this.matchKeyword("type") || (token.kind === "Keyword" && token.value === "export")) {
      if (token.value === "export") {
        this.advance();
        if (this.matchKeyword("type")) {
          return this.parseTypeAliasStatement(token, true);
        }
      } else {
        return this.parseTypeAliasStatement(token, false);
      }
    }

    return this.parseAssignmentOrCall();
  }

  private previous(): LuauToken {
    return this.tokens[Math.max(0, this.index - 1)] ?? this.current();
  }

  private parseTypeAliasStatement(start: LuauToken, exported: boolean): TypeAliasStatement {
    const nameToken = this.consumeIdentifier("Expected type alias identifier");
    const name: Identifier = {
      kind: "Identifier",
      name: nameToken.value,
      range: range(nameToken, nameToken),
    };

    this.consumeSymbol("=", "Expected '=' after type alias name");
    const definition = this.parseTypeAnnotationRaw(new Set([";", "end", "<eof>"]));

    return {
      kind: "TypeAliasStatement",
      name,
      definition,
      exported,
      range: range(start, this.previous()),
    };
  }

  private parseLocalDeclaration(start: LuauToken): LocalDeclarationStatement {
    const names: Identifier[] = [];
    do {
      const nameToken = this.consumeIdentifier("Expected local variable name");
      const id: Identifier = {
        kind: "Identifier",
        name: nameToken.value,
        range: range(nameToken, nameToken),
      };

      if (this.matchSymbol(":")) {
        id.typeAnnotation = this.parseTypeAnnotationRaw(new Set([",", "=", ";", "<eof>"]));
      }

      names.push(id);
    } while (this.matchSymbol(","));

    const values: Expression[] = this.matchSymbol("=") ? this.parseExpressionList() : [];

    return {
      kind: "LocalDeclarationStatement",
      names,
      values,
      range: range(start, this.previous()),
    };
  }

  private parseFunctionDeclaration(isLocal: boolean, start: LuauToken): FunctionDeclarationStatement {
    let nameExpr: Expression;

    if (isLocal) {
      const nameToken = this.consumeIdentifier("Expected local function name");
      nameExpr = {
        kind: "Identifier",
        name: nameToken.value,
        range: range(nameToken, nameToken),
      };
    } else {
      nameExpr = this.parseFunctionNameExpression();
    }

    const signature = this.parseFunctionSignatureAndBody(start);

    return {
      kind: "FunctionDeclarationStatement",
      name: nameExpr,
      isLocal,
      params: signature.params,
      returnType: signature.returnType,
      body: signature.body,
      range: range(start, signature.endToken),
    };
  }

  private parseFunctionNameExpression(): Expression {
    let expr: Expression;
    const first = this.consumeIdentifier("Expected function name");
    expr = {
      kind: "Identifier",
      name: first.value,
      range: range(first, first),
    };

    while (true) {
      if (this.matchSymbol(".")) {
        const part = this.consumeIdentifier("Expected member name after '.'");
        expr = {
          kind: "MemberExpression",
          object: expr,
          property: {
            kind: "Identifier",
            name: part.value,
            range: range(part, part),
          },
          computed: false,
          range: range(first, part),
        } satisfies MemberExpression;
        continue;
      }

      if (this.matchSymbol(":")) {
        const part = this.consumeIdentifier("Expected method name after ':'");
        expr = {
          kind: "MemberExpression",
          object: expr,
          property: {
            kind: "Identifier",
            name: part.value,
            range: range(part, part),
          },
          computed: false,
          range: range(first, part),
        } satisfies MemberExpression;
        continue;
      }

      break;
    }

    return expr;
  }

  private parseFunctionSignatureAndBody(startToken: LuauToken): {
    params: FunctionParameter[];
    returnType?: TypeExpression;
    body: Statement[];
    endToken: LuauToken;
  } {
    this.consumeSymbol("(", "Expected '(' after function name");
    const params: FunctionParameter[] = [];

    if (!this.checkSymbol(")")) {
      do {
        if (this.matchSymbol("...")) {
          params.push({ name: "...", isVararg: true });
          break;
        }

        const param = this.consumeIdentifier("Expected parameter name");
        const def: FunctionParameter = { name: param.value };
        if (this.matchSymbol(":")) {
          def.typeAnnotation = this.parseTypeAnnotationRaw(new Set([",", ")"]));
        }
        params.push(def);
      } while (this.matchSymbol(","));
    }

    this.consumeSymbol(")", "Expected ')' after function parameters");

    let returnType: TypeExpression | undefined;
    if (this.matchSymbol(":")) {
      returnType = this.parseTypeAnnotationRaw(new Set(["do", "end", "<eof>"]));
    }

    const body = this.parseBlock(new Set(["end"]));
    const endToken = this.checkKeyword("end") ? this.advance() : this.current();

    return { params, returnType, body, endToken };
  }

  private parseIfStatement(start: LuauToken): IfStatement {
    const clauses: IfClause[] = [];

    const firstCondition = this.parseExpression();
    this.matchKeyword("then");
    clauses.push({ condition: firstCondition, body: this.parseBlock(new Set(["elseif", "else", "end"])) });

    while (this.matchKeyword("elseif")) {
      const condition = this.parseExpression();
      this.matchKeyword("then");
      clauses.push({ condition, body: this.parseBlock(new Set(["elseif", "else", "end"])) });
    }

    if (this.matchKeyword("else")) {
      clauses.push({ isElse: true, body: this.parseBlock(new Set(["end"])) });
    }

    const endToken = this.checkKeyword("end") ? this.advance() : this.current();

    return {
      kind: "IfStatement",
      clauses,
      range: range(start, endToken),
    };
  }

  private parseWhileStatement(start: LuauToken): WhileStatement {
    const condition = this.parseExpression();
    this.matchKeyword("do");
    const body = this.parseBlock(new Set(["end"]));
    const endToken = this.checkKeyword("end") ? this.advance() : this.current();

    return {
      kind: "WhileStatement",
      condition,
      body,
      range: range(start, endToken),
    };
  }

  private parseRepeatUntilStatement(start: LuauToken): RepeatUntilStatement {
    const body = this.parseBlock(new Set(["until"]));
    this.matchKeyword("until");
    const condition = this.parseExpression();

    return {
      kind: "RepeatUntilStatement",
      body,
      condition,
      range: range(start, this.previous()),
    };
  }

  private parseForStatement(start: LuauToken): Statement {
    const firstName = this.consumeIdentifier("Expected for-loop variable");
    const variableId: Identifier = {
      kind: "Identifier",
      name: firstName.value,
      range: range(firstName, firstName),
    };

    if (this.matchSymbol("=")) {
      const startExpr = this.parseExpression();
      this.consumeSymbol(",", "Expected ',' after numeric for start expression");
      const endExpr = this.parseExpression();
      const step = this.matchSymbol(",") ? this.parseExpression() : undefined;
      this.matchKeyword("do");
      const body = this.parseBlock(new Set(["end"]));
      const endToken = this.checkKeyword("end") ? this.advance() : this.current();

      return {
        kind: "ForNumericStatement",
        variable: variableId,
        start: startExpr,
        endExpr,
        step,
        body,
        range: range(start, endToken),
      } satisfies ForNumericStatement;
    }

    const variables: Identifier[] = [variableId];
    while (this.matchSymbol(",")) {
      const next = this.consumeIdentifier("Expected iterator variable name");
      variables.push({
        kind: "Identifier",
        name: next.value,
        range: range(next, next),
      });
    }

    this.matchKeyword("in");
    const iterators = this.parseExpressionList();
    this.matchKeyword("do");
    const body = this.parseBlock(new Set(["end"]));
    const endToken = this.checkKeyword("end") ? this.advance() : this.current();

    return {
      kind: "ForGenericStatement",
      variables,
      iterators,
      body,
      range: range(start, endToken),
    } satisfies ForGenericStatement;
  }

  private parseAssignmentOrCall(): Statement | null {
    const start = this.current();
    const firstExpr = this.parsePrefixExpression();
    if (!firstExpr) return null;

    if (firstExpr.kind === "CallExpression" && !this.checkSymbol(",") && !this.checkSymbol("=")) {
      return {
        kind: "CallStatement",
        expression: firstExpr,
        range: range(start, this.previous()),
      } satisfies CallStatement;
    }

    const targets: Expression[] = [firstExpr];
    while (this.matchSymbol(",")) {
      const target = this.parsePrefixExpression();
      if (!target) break;
      targets.push(target);
    }

    if (this.matchSymbol("=")) {
      const values = this.parseExpressionList();
      return {
        kind: "AssignmentStatement",
        targets,
        values,
        range: range(start, this.previous()),
      } satisfies AssignmentStatement;
    }

    if (firstExpr.kind === "CallExpression") {
      return {
        kind: "CallStatement",
        expression: firstExpr,
        range: range(start, this.previous()),
      } satisfies CallStatement;
    }

    return null;
  }

  private startsExpression(): boolean {
    const token = this.current();
    if (token.kind === "Identifier" || token.kind === "Number" || token.kind === "String") return true;
    if (token.kind === "Keyword" && ["nil", "true", "false", "function", "not"].includes(token.value)) return true;
    if (token.kind === "Symbol" && ["(", "{", "-", "#", "..."].includes(token.value)) return true;
    return false;
  }

  private parseExpressionList(): Expression[] {
    const values: Expression[] = [];
    values.push(this.parseExpression());
    while (this.matchSymbol(",")) {
      values.push(this.parseExpression());
    }
    return values;
  }

  private parseExpression(minPrec = 0): Expression {
    let left = this.parseUnaryExpression();

    while (true) {
      const token = this.current();
      const op = token.kind === "Keyword" || token.kind === "Symbol" ? token.value : "";
      const precedence = BINARY_PRECEDENCE[op];
      if (!precedence || precedence < minPrec) break;

      this.advance();
      const nextMin = RIGHT_ASSOCIATIVE.has(op) ? precedence : precedence + 1;
      const right = this.parseExpression(nextMin);
      left = {
        kind: "BinaryExpression",
        operator: op,
        left,
        right,
        range: {
          start: left.range.start,
          end: right.range.end,
        },
      } satisfies BinaryExpression;
    }

    return left;
  }

  private parseUnaryExpression(): Expression {
    const token = this.current();
    const unaryOps = new Set(["-", "not", "#"]);
    const value = token.value;

    if ((token.kind === "Symbol" || token.kind === "Keyword") && unaryOps.has(value)) {
      this.advance();
      const argument = this.parseUnaryExpression();
      return {
        kind: "UnaryExpression",
        operator: value,
        argument,
        range: {
          start: loc(token),
          end: argument.range.end,
        },
      } satisfies UnaryExpression;
    }

    return this.parsePrefixExpression() ?? placeholderIdentifier(token);
  }

  private parsePrefixExpression(): Expression | null {
    const base = this.parsePrimaryExpression();
    if (!base) return null;
    return this.parseSuffixes(base);
  }

  private parsePrimaryExpression(): Expression | null {
    const token = this.current();

    if (token.kind === "Identifier") {
      this.advance();
      return {
        kind: "Identifier",
        name: token.value,
        range: range(token, token),
      };
    }

    if (token.kind === "Number") {
      this.advance();
      return {
        kind: "NumberLiteral",
        value: Number(token.value.replace(/_/g, "")) || 0,
        raw: token.value,
        range: range(token, token),
      } satisfies NumberLiteral;
    }

    if (token.kind === "String") {
      this.advance();
      return {
        kind: "StringLiteral",
        value: token.value,
        range: range(token, token),
      } satisfies StringLiteral;
    }

    if (token.kind === "Keyword" && token.value === "nil") {
      this.advance();
      return {
        kind: "NilLiteral",
        range: range(token, token),
      } satisfies NilLiteral;
    }

    if (token.kind === "Keyword" && (token.value === "true" || token.value === "false")) {
      this.advance();
      return {
        kind: "BooleanLiteral",
        value: token.value === "true",
        range: range(token, token),
      } satisfies BooleanLiteral;
    }

    if (token.kind === "Keyword" && token.value === "function") {
      this.advance();
      return this.parseFunctionExpression(token);
    }

    if (token.kind === "Symbol" && token.value === "...") {
      this.advance();
      return {
        kind: "VarargLiteral",
        range: range(token, token),
      } satisfies VarargLiteral;
    }

    if (this.matchSymbol("(")) {
      const expression = this.parseExpression();
      this.consumeSymbol(")", "Expected ')' to close expression");
      return expression;
    }

    if (this.checkSymbol("{")) {
      return this.parseTableConstructor();
    }

    return null;
  }

  private parseSuffixes(baseExpr: Expression): Expression {
    let expr = baseExpr;

    while (true) {
      if (this.matchSymbol(".")) {
        const propertyToken = this.consumeIdentifier("Expected member name after '.'");
        const property: Identifier = {
          kind: "Identifier",
          name: propertyToken.value,
          range: range(propertyToken, propertyToken),
        };
        expr = {
          kind: "MemberExpression",
          object: expr,
          property,
          computed: false,
          range: {
            start: expr.range.start,
            end: property.range.end,
          },
        } satisfies MemberExpression;
        continue;
      }

      if (this.matchSymbol("[")) {
        const index = this.parseExpression();
        const close = this.consumeSymbol("]", "Expected ']' after index expression");
        expr = {
          kind: "IndexExpression",
          object: expr,
          index,
          range: {
            start: expr.range.start,
            end: loc(close),
          },
        } satisfies IndexExpression;
        continue;
      }

      if (this.matchSymbol(":")) {
        const methodToken = this.consumeIdentifier("Expected method name after ':'");
        const args = this.parseCallArgs();
        const method: Identifier = {
          kind: "Identifier",
          name: methodToken.value,
          range: range(methodToken, methodToken),
        };

        expr = {
          kind: "CallExpression",
          callee: expr,
          args,
          methodName: method,
          range: {
            start: expr.range.start,
            end: args.length > 0 ? args[args.length - 1].range.end : method.range.end,
          },
        } satisfies CallExpression;
        continue;
      }

      if (this.startsCallArgs()) {
        const args = this.parseCallArgs();
        expr = {
          kind: "CallExpression",
          callee: expr,
          args,
          range: {
            start: expr.range.start,
            end: args.length > 0 ? args[args.length - 1].range.end : expr.range.end,
          },
        } satisfies CallExpression;
        continue;
      }

      break;
    }

    return expr;
  }

  private startsCallArgs(): boolean {
    const token = this.current();
    if (token.kind === "Symbol" && (token.value === "(" || token.value === "{")) return true;
    if (token.kind === "String") return true;
    return false;
  }

  private parseCallArgs(): Expression[] {
    const token = this.current();

    if (this.matchSymbol("(")) {
      const args = this.checkSymbol(")") ? [] : this.parseExpressionList();
      this.consumeSymbol(")", "Expected ')' after call arguments");
      return args;
    }

    if (token.kind === "String") {
      const str = this.parsePrimaryExpression();
      return str ? [str] : [];
    }

    if (this.checkSymbol("{")) {
      return [this.parseTableConstructor()];
    }

    return [];
  }

  private parseTableConstructor(): TableConstructorExpression {
    const open = this.consumeSymbol("{", "Expected '{' for table constructor");
    const fields: TableField[] = [];

    while (!this.atEof() && !this.checkSymbol("}")) {
      const start = this.current();

      if (this.matchSymbol("[")) {
        const key = this.parseExpression();
        this.consumeSymbol("]", "Expected ']' after computed table key");
        this.consumeSymbol("=", "Expected '=' after computed table key");
        const value = this.parseExpression();
        fields.push({
          kind: "TableField",
          key,
          value,
          computed: true,
          range: {
            start: loc(start),
            end: value.range.end,
          },
        });
      } else {
        const possibleKey = this.current();
        if (possibleKey.kind === "Identifier" && this.peek().kind === "Symbol" && this.peek().value === "=") {
          const keyToken = this.advance();
          this.advance();
          const value = this.parseExpression();
          fields.push({
            kind: "TableField",
            key: {
              kind: "Identifier",
              name: keyToken.value,
              range: range(keyToken, keyToken),
            },
            value,
            computed: false,
            range: {
              start: loc(start),
              end: value.range.end,
            },
          });
        } else {
          const value = this.parseExpression();
          fields.push({
            kind: "TableField",
            value,
            computed: false,
            range: {
              start: loc(start),
              end: value.range.end,
            },
          });
        }
      }

      if (!this.matchSymbol(",")) {
        this.matchSymbol(";");
      }
    }

    const close = this.consumeSymbol("}", "Expected '}' to close table constructor");

    return {
      kind: "TableConstructorExpression",
      fields,
      range: range(open, close),
    };
  }

  private parseFunctionExpression(start: LuauToken): FunctionExpression {
    const signature = this.parseFunctionSignatureAndBody(start);
    return {
      kind: "FunctionExpression",
      params: signature.params,
      returnType: signature.returnType,
      body: signature.body,
      range: range(start, signature.endToken),
    };
  }

  private parseTypeAnnotationRaw(stoppers: Set<string>): TypeExpression {
    const parts: string[] = [];
    let depthParen = 0;
    let depthBrace = 0;
    let depthBracket = 0;
    let depthAngle = 0;

    while (!this.atEof()) {
      const token = this.current();
      if (token.kind === "Symbol") {
        if (token.value === "(") depthParen++;
        if (token.value === ")") {
          if (depthParen === 0 && stoppers.has(")")) break;
          depthParen = Math.max(0, depthParen - 1);
        }
        if (token.value === "{") depthBrace++;
        if (token.value === "}") {
          if (depthBrace === 0 && stoppers.has("}")) break;
          depthBrace = Math.max(0, depthBrace - 1);
        }
        if (token.value === "[") depthBracket++;
        if (token.value === "]") {
          if (depthBracket === 0 && stoppers.has("]")) break;
          depthBracket = Math.max(0, depthBracket - 1);
        }
        if (token.value === "<") depthAngle++;
        if (token.value === ">" && depthAngle > 0) depthAngle--;
      }

      const atTopLevel = depthParen === 0 && depthBrace === 0 && depthBracket === 0 && depthAngle === 0;
      if (atTopLevel && stoppers.has(token.value)) break;
      if (token.kind === "Keyword" && atTopLevel && stoppers.has(token.value)) break;
      if (token.kind === "Eof") break;

      parts.push(token.value);
      this.advance();
    }

    return { raw: parts.join(" ").trim() };
  }
}

export function parseLuau(tokens: LuauToken[]): LuauParseResult {
  const parser = new LuauParser(tokens);
  return parser.parse();
}
