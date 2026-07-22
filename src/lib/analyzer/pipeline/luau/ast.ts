export interface SourceLocation {
  line: number;
  column: number;
}

export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
}

export interface BaseNode {
  kind: string;
  range: SourceRange;
}

export interface Program extends BaseNode {
  kind: "Program";
  body: Statement[];
}

export interface Identifier extends BaseNode {
  kind: "Identifier";
  name: string;
  typeAnnotation?: TypeExpression;
}

export interface StringLiteral extends BaseNode {
  kind: "StringLiteral";
  value: string;
}

export interface NumberLiteral extends BaseNode {
  kind: "NumberLiteral";
  value: number;
  raw: string;
}

export interface BooleanLiteral extends BaseNode {
  kind: "BooleanLiteral";
  value: boolean;
}

export interface NilLiteral extends BaseNode {
  kind: "NilLiteral";
}

export interface VarargLiteral extends BaseNode {
  kind: "VarargLiteral";
}

export interface UnaryExpression extends BaseNode {
  kind: "UnaryExpression";
  operator: string;
  argument: Expression;
}

export interface BinaryExpression extends BaseNode {
  kind: "BinaryExpression";
  operator: string;
  left: Expression;
  right: Expression;
}

export interface MemberExpression extends BaseNode {
  kind: "MemberExpression";
  object: Expression;
  property: Identifier;
  computed: boolean;
}

export interface IndexExpression extends BaseNode {
  kind: "IndexExpression";
  object: Expression;
  index: Expression;
}

export interface CallExpression extends BaseNode {
  kind: "CallExpression";
  callee: Expression;
  args: Expression[];
  methodName?: Identifier;
}

export interface TableField extends BaseNode {
  kind: "TableField";
  key?: Expression;
  value: Expression;
  computed: boolean;
}

export interface TableConstructorExpression extends BaseNode {
  kind: "TableConstructorExpression";
  fields: TableField[];
}

export interface FunctionParameter {
  name: string;
  typeAnnotation?: TypeExpression;
  isVararg?: boolean;
}

export interface FunctionExpression extends BaseNode {
  kind: "FunctionExpression";
  params: FunctionParameter[];
  returnType?: TypeExpression;
  body: Statement[];
}

export interface LocalDeclarationStatement extends BaseNode {
  kind: "LocalDeclarationStatement";
  names: Identifier[];
  values: Expression[];
}

export interface AssignmentStatement extends BaseNode {
  kind: "AssignmentStatement";
  targets: Expression[];
  values: Expression[];
}

export interface FunctionDeclarationStatement extends BaseNode {
  kind: "FunctionDeclarationStatement";
  name: Expression;
  isLocal: boolean;
  params: FunctionParameter[];
  returnType?: TypeExpression;
  body: Statement[];
}

export interface CallStatement extends BaseNode {
  kind: "CallStatement";
  expression: CallExpression;
}

export interface ReturnStatement extends BaseNode {
  kind: "ReturnStatement";
  values: Expression[];
}

export interface IfClause {
  condition?: Expression;
  body: Statement[];
  isElse?: boolean;
}

export interface IfStatement extends BaseNode {
  kind: "IfStatement";
  clauses: IfClause[];
}

export interface WhileStatement extends BaseNode {
  kind: "WhileStatement";
  condition: Expression;
  body: Statement[];
}

export interface RepeatUntilStatement extends BaseNode {
  kind: "RepeatUntilStatement";
  condition: Expression;
  body: Statement[];
}

export interface ForNumericStatement extends BaseNode {
  kind: "ForNumericStatement";
  variable: Identifier;
  start: Expression;
  endExpr: Expression;
  step?: Expression;
  body: Statement[];
}

export interface ForGenericStatement extends BaseNode {
  kind: "ForGenericStatement";
  variables: Identifier[];
  iterators: Expression[];
  body: Statement[];
}

export interface BreakStatement extends BaseNode {
  kind: "BreakStatement";
}

export interface ContinueStatement extends BaseNode {
  kind: "ContinueStatement";
}

export interface TypeAliasStatement extends BaseNode {
  kind: "TypeAliasStatement";
  name: Identifier;
  definition: TypeExpression;
  exported: boolean;
}

export type Statement =
  | LocalDeclarationStatement
  | AssignmentStatement
  | FunctionDeclarationStatement
  | CallStatement
  | ReturnStatement
  | IfStatement
  | WhileStatement
  | RepeatUntilStatement
  | ForNumericStatement
  | ForGenericStatement
  | BreakStatement
  | ContinueStatement
  | TypeAliasStatement;

export type Expression =
  | Identifier
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | NilLiteral
  | VarargLiteral
  | UnaryExpression
  | BinaryExpression
  | MemberExpression
  | IndexExpression
  | CallExpression
  | TableConstructorExpression
  | FunctionExpression;

export interface TypeExpression {
  raw: string;
}
