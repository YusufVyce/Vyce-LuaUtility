import type {
  AssignmentStatement,
  CallExpression,
  Expression,
  ForGenericStatement,
  ForNumericStatement,
  FunctionDeclarationStatement,
  FunctionExpression,
  Identifier,
  IfStatement,
  LocalDeclarationStatement,
  MemberExpression,
  Program,
  RepeatUntilStatement,
  ReturnStatement,
  Statement,
  TableConstructorExpression,
  TypeAliasStatement,
  WhileStatement,
} from "./ast";
import type { ExtractedContext, HighlightRange, SymbolRef } from "../types";

interface SemanticState {
  symbols: SymbolRef[];
  highlights: HighlightRange[];
  variables: Record<string, string>;
  functions: string[];
  methods: string[];
  requires: string[];
  services: Set<string>;
  apis: Set<string>;
  tweenGoals: Array<{ target: string; property: string; line: number }>;
  hasPcall: boolean;
  hasXpcall: boolean;
  hasWaitForChild: boolean;
  hasWaitForChildTimeout: boolean;
  hasFindFirstChild: boolean;
  hasCharacterAdded: boolean;
  hasPlayerAdded: boolean;
  hasTaskSpawn: boolean;
  hasTaskDefer: boolean;
  hasCoroutine: boolean;
  hasLoops: boolean;
  hasRecursiveFunction: boolean;
  hasRemoteUse: boolean;
  hasTweenUse: boolean;
  hasDataStoreUse: boolean;
  hasCharacterPropertyAccessWithoutSync: boolean;
  moduleExports: string[];
  requireChains: string[][];
  aliasToService: Map<string, string>;
  typeAliases: string[];
}

function pushUnique(list: string[], value: string) {
  if (!list.includes(value)) list.push(value);
}

const REMOTE_APIS = new Set([
  "FireServer",
  "FireClient",
  "FireAllClients",
  "InvokeServer",
  "InvokeClient",
  "OnServerEvent",
  "OnClientEvent",
  "OnServerInvoke",
  "OnClientInvoke",
]);

const KNOWN_APIS = new Set([
  ...REMOTE_APIS,
  "GetAsync",
  "SetAsync",
  "UpdateAsync",
  "WaitForChild",
  "FindFirstChild",
  "Create",
  "CharacterAdded",
  "PlayerAdded",
  "GetAttribute",
  "SetAttribute",
  "GetAttributes",
  "Bindables",
  "Connect",
  "Disconnect",
  "PublishAsync",
  "SubscribeAsync",
  "Raycast",
  "TeleportAsync",
  "PromptProductPurchase",
  "LoadAnimation",
]);

function addSymbol(state: SemanticState, symbol: SymbolRef) {
  if (state.symbols.some((item) => item.name === symbol.name && item.kind === symbol.kind && item.line === symbol.line)) {
    return;
  }
  state.symbols.push(symbol);
}

function addHighlight(state: SemanticState, lines: string[], line: number, variable?: string, functionName?: string, property?: string) {
  const text = lines[line - 1]?.trim() ?? "";
  if (!text) return;
  const existing = state.highlights.find((item) => item.line === line && item.text === text);
  if (existing) {
    if (!existing.variable && variable) existing.variable = variable;
    if (!existing.functionName && functionName) existing.functionName = functionName;
    if (!existing.property && property) existing.property = property;
    return;
  }
  state.highlights.push({ line, text, variable, functionName, property });
}

function expressionToText(expression: Expression): string {
  switch (expression.kind) {
    case "Identifier":
      return expression.name;
    case "StringLiteral":
      return `\"${expression.value}\"`;
    case "NumberLiteral":
      return expression.raw;
    case "BooleanLiteral":
      return expression.value ? "true" : "false";
    case "NilLiteral":
      return "nil";
    case "VarargLiteral":
      return "...";
    case "UnaryExpression":
      return `${expression.operator} ${expressionToText(expression.argument)}`;
    case "BinaryExpression":
      return `${expressionToText(expression.left)} ${expression.operator} ${expressionToText(expression.right)}`;
    case "MemberExpression":
      return `${expressionToText(expression.object)}.${expression.property.name}`;
    case "IndexExpression":
      return `${expressionToText(expression.object)}[${expressionToText(expression.index)}]`;
    case "CallExpression": {
      const callee = expressionToText(expression.callee);
      const args = expression.args.map(expressionToText).join(", ");
      if (expression.methodName) {
        return `${callee}:${expression.methodName.name}(${args})`;
      }
      return `${callee}(${args})`;
    }
    case "TableConstructorExpression":
      return "{...}";
    case "FunctionExpression":
      return "function(...) ... end";
    default:
      return "<expr>";
  }
}

function flattenMemberPath(expr: Expression): string | null {
  if (expr.kind === "Identifier") return expr.name;
  if (expr.kind === "MemberExpression") {
    const parent = flattenMemberPath(expr.object);
    if (!parent) return null;
    return `${parent}.${expr.property.name}`;
  }
  return null;
}

function getCallInfo(call: CallExpression): { calleePath: string | null; methodName?: string } {
  return {
    calleePath: flattenMemberPath(call.callee),
    methodName: call.methodName?.name,
  };
}

function inferServiceFromGetService(call: CallExpression): string | null {
  if (!call.methodName || call.methodName.name !== "GetService") return null;
  const first = call.args[0];
  if (!first || first.kind !== "StringLiteral") return null;
  const calleePath = flattenMemberPath(call.callee);
  if (calleePath !== "game") return null;
  return first.value;
}

function visitExpression(
  expression: Expression,
  state: SemanticState,
  lines: string[],
  currentFunction: string | null,
): void {
  switch (expression.kind) {
    case "Identifier": {
      addSymbol(state, {
        name: expression.name,
        kind: "variable",
        line: expression.range.start.line,
      });
      if (expression.name === "LocalPlayer") {
        state.apis.add("LocalPlayer");
      }
      return;
    }
    case "MemberExpression": {
      addSymbol(state, {
        name: expression.property.name,
        kind: "property",
        line: expression.range.start.line,
      });
      addHighlight(state, lines, expression.range.start.line, undefined, undefined, expression.property.name);

      if (expression.property.name === "CharacterAdded") state.hasCharacterAdded = true;
      if (expression.property.name === "PlayerAdded") state.hasPlayerAdded = true;
      if (KNOWN_APIS.has(expression.property.name)) {
        state.apis.add(expression.property.name);
      }

      const rootPath = flattenMemberPath(expression);
      if (rootPath?.includes(".Character.")) {
        state.hasCharacterPropertyAccessWithoutSync = true;
      }

      visitExpression(expression.object, state, lines, currentFunction);
      return;
    }
    case "IndexExpression": {
      visitExpression(expression.object, state, lines, currentFunction);
      visitExpression(expression.index, state, lines, currentFunction);
      return;
    }
    case "UnaryExpression": {
      visitExpression(expression.argument, state, lines, currentFunction);
      return;
    }
    case "BinaryExpression": {
      visitExpression(expression.left, state, lines, currentFunction);
      visitExpression(expression.right, state, lines, currentFunction);
      return;
    }
    case "FunctionExpression": {
      for (const stmt of expression.body) {
        visitStatement(stmt, state, lines, currentFunction);
      }
      return;
    }
    case "TableConstructorExpression": {
      for (const field of expression.fields) {
        if (field.key) visitExpression(field.key, state, lines, currentFunction);
        visitExpression(field.value, state, lines, currentFunction);
      }
      return;
    }
    case "CallExpression": {
      const info = getCallInfo(expression);
      if (info.calleePath) {
        const calleeTail = info.calleePath.split(".").pop();
        if (calleeTail && KNOWN_APIS.has(calleeTail)) {
          state.apis.add(calleeTail);
        }
      }

      if (info.methodName) {
        state.apis.add(info.methodName);
        pushUnique(state.methods, info.methodName);
      }

      const service = inferServiceFromGetService(expression);
      if (service) {
        state.services.add(service);
      }

      if (info.calleePath === "pcall") state.hasPcall = true;
      if (info.calleePath === "xpcall") state.hasXpcall = true;

      if (info.calleePath === "task.spawn") state.hasTaskSpawn = true;
      if (info.calleePath === "task.defer") state.hasTaskDefer = true;
      if ((info.calleePath ?? "").startsWith("coroutine.")) state.hasCoroutine = true;

      if (info.methodName === "WaitForChild") {
        state.hasWaitForChild = true;
        if (expression.args.length >= 2) state.hasWaitForChildTimeout = true;
      }
      if (info.methodName === "FindFirstChild") state.hasFindFirstChild = true;

      if ((info.methodName && REMOTE_APIS.has(info.methodName)) || (info.calleePath && REMOTE_APIS.has(info.calleePath))) {
        state.hasRemoteUse = true;
      }

      if (info.methodName === "Create" || info.calleePath?.endsWith("TweenService")) {
        const calleePath = flattenMemberPath(expression.callee) ?? "";
        const isTweenCreate =
          info.methodName === "Create" &&
          (calleePath.includes("TweenService") || state.aliasToService.get(calleePath) === "TweenService");

        if (isTweenCreate) {
          state.hasTweenUse = true;
          const targetExpr = expression.args[0];
          const goalsExpr = expression.args[2];
          if (goalsExpr && goalsExpr.kind === "TableConstructorExpression") {
            for (const field of goalsExpr.fields) {
              if (!field.key || field.key.kind !== "Identifier") continue;
              state.tweenGoals.push({
                target: targetExpr ? expressionToText(targetExpr) : "<unknown>",
                property: field.key.name,
                line: goalsExpr.range.start.line,
              });
            }
          }
        }
      }

      if (info.methodName && ["GetAsync", "SetAsync", "UpdateAsync"].includes(info.methodName)) {
        state.hasDataStoreUse = true;
      }

      if (currentFunction && info.calleePath === currentFunction) {
        state.hasRecursiveFunction = true;
      }

      if (info.methodName) {
        addSymbol(state, {
          name: info.methodName,
          kind: "method",
          line: expression.range.start.line,
        });
      }

      addHighlight(state, lines, expression.range.start.line);
      visitExpression(expression.callee, state, lines, currentFunction);
      for (const arg of expression.args) {
        visitExpression(arg, state, lines, currentFunction);
      }
      return;
    }
    default:
      return;
  }
}

function visitStatement(
  statement: Statement,
  state: SemanticState,
  lines: string[],
  currentFunction: string | null,
): void {
  switch (statement.kind) {
    case "LocalDeclarationStatement": {
      for (let i = 0; i < statement.names.length; i++) {
        const name = statement.names[i];
        const value = statement.values[i];
        const valueText = value ? expressionToText(value) : "";
        state.variables[name.name] = valueText;
        addSymbol(state, {
          name: name.name,
          kind: "variable",
          line: name.range.start.line,
        });
        addHighlight(state, lines, name.range.start.line, name.name);

        if (value?.kind === "CallExpression") {
          const service = inferServiceFromGetService(value);
          if (service) {
            state.services.add(service);
            state.aliasToService.set(name.name, service);
          }

          const callInfo = getCallInfo(value);
          if (callInfo.calleePath === "require" && value.args[0]) {
            const req = expressionToText(value.args[0]);
            state.requires.push(req);
            state.requireChains.push([name.name, req]);
          }
        }

        if (name.typeAnnotation) {
          state.typeAliases.push(name.typeAnnotation.raw);
        }
      }

      for (const value of statement.values) {
        visitExpression(value, state, lines, currentFunction);
      }
      return;
    }
    case "AssignmentStatement": {
      const assignment = statement as AssignmentStatement;
      for (let i = 0; i < assignment.targets.length; i++) {
        const target = assignment.targets[i];
        const value = assignment.values[i];
        if (target.kind === "Identifier") {
          state.variables[target.name] = value ? expressionToText(value) : "";
        }
      }
      for (const target of assignment.targets) visitExpression(target, state, lines, currentFunction);
      for (const value of assignment.values) visitExpression(value, state, lines, currentFunction);
      return;
    }
    case "FunctionDeclarationStatement": {
      const fn = statement as FunctionDeclarationStatement;
      const functionNameText = expressionToText(fn.name);
      state.functions.push(functionNameText);
      if (fn.name.kind === "MemberExpression") {
        pushUnique(state.methods, fn.name.property.name);
      }
      addSymbol(state, {
        name: functionNameText,
        kind: "function",
        line: fn.range.start.line,
      });
      addHighlight(state, lines, fn.range.start.line, undefined, functionNameText);

      for (const param of fn.params) {
        if (param.typeAnnotation) {
          state.typeAliases.push(param.typeAnnotation.raw);
        }
      }
      if (fn.returnType) {
        state.typeAliases.push(fn.returnType.raw);
      }

      for (const stmt of fn.body) {
        visitStatement(stmt, state, lines, functionNameText);
      }
      return;
    }
    case "CallStatement": {
      visitExpression(statement.expression, state, lines, currentFunction);
      return;
    }
    case "ReturnStatement": {
      const ret = statement as ReturnStatement;
      if (ret.values.length > 0 && currentFunction === null) {
        state.moduleExports.push(expressionToText(ret.values[0]));
      }
      for (const value of ret.values) visitExpression(value, state, lines, currentFunction);
      return;
    }
    case "IfStatement": {
      const ifStatement = statement as IfStatement;
      for (const clause of ifStatement.clauses) {
        if (clause.condition) visitExpression(clause.condition, state, lines, currentFunction);
        for (const stmt of clause.body) visitStatement(stmt, state, lines, currentFunction);
      }
      return;
    }
    case "WhileStatement": {
      state.hasLoops = true;
      const whileStmt = statement as WhileStatement;
      visitExpression(whileStmt.condition, state, lines, currentFunction);
      for (const stmt of whileStmt.body) visitStatement(stmt, state, lines, currentFunction);
      return;
    }
    case "RepeatUntilStatement": {
      state.hasLoops = true;
      const repeatStmt = statement as RepeatUntilStatement;
      for (const stmt of repeatStmt.body) visitStatement(stmt, state, lines, currentFunction);
      visitExpression(repeatStmt.condition, state, lines, currentFunction);
      return;
    }
    case "ForNumericStatement": {
      state.hasLoops = true;
      const forStmt = statement as ForNumericStatement;
      visitExpression(forStmt.start, state, lines, currentFunction);
      visitExpression(forStmt.endExpr, state, lines, currentFunction);
      if (forStmt.step) visitExpression(forStmt.step, state, lines, currentFunction);
      for (const stmt of forStmt.body) visitStatement(stmt, state, lines, currentFunction);
      return;
    }
    case "ForGenericStatement": {
      state.hasLoops = true;
      const forStmt = statement as ForGenericStatement;
      for (const iter of forStmt.iterators) visitExpression(iter, state, lines, currentFunction);
      for (const stmt of forStmt.body) visitStatement(stmt, state, lines, currentFunction);
      return;
    }
    case "TypeAliasStatement": {
      const typeStmt = statement as TypeAliasStatement;
      state.typeAliases.push(typeStmt.name.name);
      state.typeAliases.push(typeStmt.definition.raw);
      return;
    }
    case "BreakStatement":
    case "ContinueStatement":
      return;
    default:
      return;
  }
}

export function analyzeLuauSemantics(ast: Program, codeText: string, logText: string): ExtractedContext {
  const lines = codeText.split(/\r?\n/);
  const state: SemanticState = {
    symbols: [],
    highlights: [],
    variables: {},
    functions: [],
    methods: [],
    requires: [],
    services: new Set(),
    apis: new Set(),
    tweenGoals: [],
    hasPcall: false,
    hasXpcall: false,
    hasWaitForChild: false,
    hasWaitForChildTimeout: false,
    hasFindFirstChild: false,
    hasCharacterAdded: false,
    hasPlayerAdded: false,
    hasTaskSpawn: false,
    hasTaskDefer: false,
    hasCoroutine: false,
    hasLoops: false,
    hasRecursiveFunction: false,
    hasRemoteUse: false,
    hasTweenUse: false,
    hasDataStoreUse: false,
    hasCharacterPropertyAccessWithoutSync: false,
    moduleExports: [],
    requireChains: [],
    aliasToService: new Map(),
    typeAliases: [],
  };

  for (const stmt of ast.body) {
    visitStatement(stmt, state, lines, null);
  }

  const isServerByLog = /(serverscriptservice|server script|script\.)/i.test(logText);
  const isClientByLog = /(localscript|starterplayer|startergui|playergui)/i.test(logText);

  const hasServerCodeSignals =
    state.services.has("DataStoreService") ||
    state.services.has("MessagingService") ||
    state.services.has("MemoryStoreService") ||
    [...state.apis].some((api) => api.startsWith("OnServer") || api === "FireClient" || api === "FireAllClients");

  const hasClientCodeSignals =
    [...state.apis].includes("LocalPlayer") ||
    [...state.apis].some((api) => api.startsWith("OnClient") || api === "FireServer" || api === "InvokeServer");

  const side: ExtractedContext["side"] =
    isServerByLog || hasServerCodeSignals
      ? "server"
      : isClientByLog || hasClientCodeSignals
        ? "client"
        : "unknown";

  return {
    symbols: state.symbols,
    highlights: state.highlights,
    variables: state.variables,
    functions: state.functions,
    methods: state.methods,
    requires: state.requires,
    services: [...state.services],
    apis: [...state.apis],
    side,
    hasPcall: state.hasPcall,
    hasXpcall: state.hasXpcall,
    hasWaitForChild: state.hasWaitForChild,
    hasWaitForChildTimeout: state.hasWaitForChildTimeout,
    hasFindFirstChild: state.hasFindFirstChild,
    hasCharacterAdded: state.hasCharacterAdded,
    hasPlayerAdded: state.hasPlayerAdded,
    hasTaskSpawn: state.hasTaskSpawn,
    hasTaskDefer: state.hasTaskDefer,
    hasCoroutine: state.hasCoroutine,
    hasLoops: state.hasLoops,
    hasRecursiveFunction: state.hasRecursiveFunction,
    hasRemoteUse: state.hasRemoteUse,
    hasTweenUse: state.hasTweenUse,
    hasDataStoreUse: state.hasDataStoreUse,
    hasCharacterPropertyAccessWithoutSync: state.hasCharacterPropertyAccessWithoutSync,
    tweenGoals: state.tweenGoals,
    moduleExports: state.moduleExports,
    requireChains: state.requireChains,
    ast,
    parserDiagnostics: [],
  };
}
