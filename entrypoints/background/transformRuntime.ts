export type TransformRowContext = Record<string, string>;

export type TransformNowContext = {
  timestamp: number;
  unix: number;
  date: string;
  time: string;
  datetime: string;
  iso: string;
  year: number;
  month: number;
  day: number;
};

export const toTextValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
};

const toTwoDigits = (value: number) => String(value).padStart(2, '0');

export const buildTransformNowContext = (timestamp: number): TransformNowContext => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = toTwoDigits(date.getMonth() + 1);
  const day = toTwoDigits(date.getDate());
  const hours = toTwoDigits(date.getHours());
  const minutes = toTwoDigits(date.getMinutes());
  const seconds = toTwoDigits(date.getSeconds());
  return {
    timestamp,
    unix: Math.floor(timestamp / 1000),
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}:${seconds}`,
    datetime: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
    iso: date.toISOString(),
    year,
    month: Number(month),
    day: Number(day),
  };
};

export const transformHelpers = {
  trim: (value: unknown) => toTextValue(value).trim(),
  upper: (value: unknown) => toTextValue(value).toUpperCase(),
  lower: (value: unknown) => toTextValue(value).toLowerCase(),
  slice: (value: unknown, start?: number, end?: number) => toTextValue(value).slice(start, end),
  replace: (value: unknown, search: string, replacement: string) =>
    toTextValue(value).split(toTextValue(search)).join(toTextValue(replacement)),
  padStart: (value: unknown, maxLength: number, fillString?: string) =>
    toTextValue(value).padStart(maxLength, fillString),
  padEnd: (value: unknown, maxLength: number, fillString?: string) =>
    toTextValue(value).padEnd(maxLength, fillString),
  leftPad: (value: unknown, maxLength: number, fillString?: string) =>
    toTextValue(value).padStart(maxLength, fillString),
  rightPad: (value: unknown, maxLength: number, fillString?: string) =>
    toTextValue(value).padEnd(maxLength, fillString),
  leftpad: (value: unknown, maxLength: number, fillString?: string) =>
    toTextValue(value).padStart(maxLength, fillString),
  rightpad: (value: unknown, maxLength: number, fillString?: string) =>
    toTextValue(value).padEnd(maxLength, fillString),
  substr: (value: unknown, start: number, length?: number) =>
    typeof length === 'number' ? toTextValue(value).substr(start, length) : toTextValue(value).substr(start),
};

type Token =
  | { type: 'identifier'; value: string }
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'symbol'; value: string };

type ExprNode =
  | { type: 'literal'; value: unknown }
  | { type: 'identifier'; name: string }
  | { type: 'member'; object: ExprNode; property: ExprNode; computed: boolean }
  | { type: 'call'; callee: ExprNode; args: ExprNode[] }
  | { type: 'binary'; op: '??' | '+' | '-'; left: ExprNode; right: ExprNode };

const isIdentifierStart = (char: string) => /[A-Za-z_$]/.test(char);
const isIdentifierPart = (char: string) => /[A-Za-z0-9_$]/.test(char);

const tokenizeExpression = (input: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === '/' && input[index + 1] === '/') {
      break;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      index += 1;
      let value = '';
      while (index < input.length) {
        const nextChar = input[index];
        if (nextChar === '\\') {
          const escaped = input[index + 1] ?? '';
          const mapped =
            escaped === 'n'
              ? '\n'
              : escaped === 'r'
                ? '\r'
                : escaped === 't'
                  ? '\t'
                  : escaped;
          value += mapped;
          index += 2;
          continue;
        }
        if (nextChar === quote) {
          index += 1;
          break;
        }
        value += nextChar;
        index += 1;
      }
      tokens.push({ type: 'string', value });
      continue;
    }
    if (/\d/.test(char)) {
      let raw = char;
      index += 1;
      while (index < input.length && /[\d.]/.test(input[index])) {
        raw += input[index];
        index += 1;
      }
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) {
        throw new Error(`Invalid numeric literal: ${raw}`);
      }
      tokens.push({ type: 'number', value: numeric });
      continue;
    }
    if (char === '?' && input[index + 1] === '?') {
      tokens.push({ type: 'symbol', value: '??' });
      index += 2;
      continue;
    }
    if ('.(),[]+-'.includes(char)) {
      tokens.push({ type: 'symbol', value: char });
      index += 1;
      continue;
    }
    if (isIdentifierStart(char)) {
      let name = char;
      index += 1;
      while (index < input.length && isIdentifierPart(input[index])) {
        name += input[index];
        index += 1;
      }
      tokens.push({ type: 'identifier', value: name });
      continue;
    }
    throw new Error(`Unsupported token in expression: ${char}`);
  }
  return tokens;
};

class ExpressionParser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ExprNode {
    const node = this.parseNullish();
    if (this.peek()) {
      throw new Error(`Unexpected token: ${this.peek()!.type === 'symbol' ? this.peek()!.value : 'value'}`);
    }
    return node;
  }

  private parseNullish(): ExprNode {
    let left = this.parseAdditive();
    while (this.matchSymbol('??')) {
      const right = this.parseAdditive();
      left = { type: 'binary', op: '??', left, right };
    }
    return left;
  }

  private parseAdditive(): ExprNode {
    let left = this.parsePostfix();
    while (true) {
      if (this.matchSymbol('+')) {
        const right = this.parsePostfix();
        left = { type: 'binary', op: '+', left, right };
        continue;
      }
      if (this.matchSymbol('-')) {
        const right = this.parsePostfix();
        left = { type: 'binary', op: '-', left, right };
        continue;
      }
      return left;
    }
  }

  private parsePostfix(): ExprNode {
    let node = this.parsePrimary();
    while (true) {
      if (this.matchSymbol('.')) {
        const token = this.consumeIdentifier('Expected property name after "."');
        node = {
          type: 'member',
          object: node,
          property: { type: 'literal', value: token.value },
          computed: false,
        };
        continue;
      }
      if (this.matchSymbol('[')) {
        const property = this.parseNullish();
        this.expectSymbol(']', 'Expected "]" after computed property');
        node = { type: 'member', object: node, property, computed: true };
        continue;
      }
      if (this.matchSymbol('(')) {
        const args: ExprNode[] = [];
        if (!this.matchSymbol(')')) {
          do {
            args.push(this.parseNullish());
          } while (this.matchSymbol(','));
          this.expectSymbol(')', 'Expected ")" after function arguments');
        }
        node = { type: 'call', callee: node, args };
        continue;
      }
      return node;
    }
  }

  private parsePrimary(): ExprNode {
    const token = this.peek();
    if (!token) {
      throw new Error('Expression is empty.');
    }
    if (token.type === 'string') {
      this.index += 1;
      return { type: 'literal', value: token.value };
    }
    if (token.type === 'number') {
      this.index += 1;
      return { type: 'literal', value: token.value };
    }
    if (token.type === 'identifier') {
      this.index += 1;
      if (token.value === 'true') {
        return { type: 'literal', value: true };
      }
      if (token.value === 'false') {
        return { type: 'literal', value: false };
      }
      if (token.value === 'null') {
        return { type: 'literal', value: null };
      }
      if (token.value === 'undefined') {
        return { type: 'literal', value: undefined };
      }
      return { type: 'identifier', name: token.value };
    }
    if (this.matchSymbol('(')) {
      const node = this.parseNullish();
      this.expectSymbol(')', 'Expected ")" after expression');
      return node;
    }
    throw new Error('Unsupported primary expression.');
  }

  private peek() {
    return this.tokens[this.index];
  }

  private matchSymbol(value: string) {
    const token = this.peek();
    if (!token || token.type !== 'symbol' || token.value !== value) {
      return false;
    }
    this.index += 1;
    return true;
  }

  private expectSymbol(value: string, errorMessage: string) {
    if (!this.matchSymbol(value)) {
      throw new Error(errorMessage);
    }
  }

  private consumeIdentifier(errorMessage: string) {
    const token = this.peek();
    if (!token || token.type !== 'identifier') {
      throw new Error(errorMessage);
    }
    this.index += 1;
    return token;
  }
}

const evaluateExpressionNode = (node: ExprNode, scope: Record<string, unknown>): unknown => {
  if (node.type === 'literal') {
    return node.value;
  }
  if (node.type === 'identifier') {
    if (node.name in scope) {
      return scope[node.name];
    }
    return undefined;
  }
  if (node.type === 'binary') {
    const left = evaluateExpressionNode(node.left, scope);
    if (node.op === '??') {
      return left ?? evaluateExpressionNode(node.right, scope);
    }
    const right = evaluateExpressionNode(node.right, scope);
    if (node.op === '+') {
      return (left as any) + (right as any);
    }
    return Number(left) - Number(right);
  }
  if (node.type === 'member') {
    const object = evaluateExpressionNode(node.object, scope);
    if (object === null || object === undefined) {
      return undefined;
    }
    const property = node.computed
      ? evaluateExpressionNode(node.property, scope)
      : (node.property as { type: 'literal'; value: unknown }).value;
    return (object as Record<string, unknown>)[String(property)];
  }
  const callee = evaluateExpressionNode(node.callee, scope);
  if (typeof callee !== 'function') {
    throw new Error('Attempted to call a non-function expression.');
  }
  const args = node.args.map((arg) => evaluateExpressionNode(arg, scope));
  let thisArg: unknown = undefined;
  if (node.callee.type === 'member') {
    thisArg = evaluateExpressionNode(node.callee.object, scope);
  }
  return (callee as (...fnArgs: unknown[]) => unknown).apply(thisArg, args);
};

const evaluateExpression = (expression: string, scope: Record<string, unknown>) => {
  const tokens = tokenizeExpression(expression);
  const parser = new ExpressionParser(tokens);
  const ast = parser.parse();
  return evaluateExpressionNode(ast, scope);
};

const splitStatements = (code: string) => {
  const statements: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;
  let parenDepth = 0;
  let bracketDepth = 0;
  for (let index = 0; index < code.length; index += 1) {
    const char = code[index];
    if (quote) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      current += char;
      continue;
    }
    if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += char;
      continue;
    }
    if (char === '[') {
      bracketDepth += 1;
      current += char;
      continue;
    }
    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += char;
      continue;
    }
    if (char === ';' && parenDepth === 0 && bracketDepth === 0) {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
      continue;
    }
    current += char;
  }
  const rest = current.trim();
  if (rest) {
    statements.push(rest);
  }
  return statements;
};

export const runSafeTransformCode = (input: {
  code: string;
  input: string;
  row?: TransformRowContext;
  nowTimestamp?: number;
}): string => {
  const scope: Record<string, unknown> = {
    input: input.input,
    row: input.row ?? {},
    now: buildTransformNowContext(input.nowTimestamp ?? Date.now()),
    helpers: transformHelpers,
    String,
    Number,
    Boolean,
  };
  const statements = splitStatements(input.code);
  for (const statement of statements) {
    const line = statement.trim();
    if (!line || line.startsWith('//')) {
      continue;
    }
    const declaration = /^(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([\s\S]+)$/.exec(line);
    if (declaration) {
      const [, name, expression] = declaration;
      scope[name] = evaluateExpression(expression.trim(), scope);
      continue;
    }
    const returnMatch = /^return\s+([\s\S]+)$/.exec(line);
    if (returnMatch) {
      const value = evaluateExpression(returnMatch[1].trim(), scope);
      return toTextValue(value);
    }
    throw new Error(`Unsupported statement in JS transform: ${line}`);
  }
  return '';
};
