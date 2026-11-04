/**
 * Formula columns (ADR-033): a small expression language, parsed by hand and
 * never run through `eval` or SQL. Columns are written between braces; the
 * API stores their ids (`{id}`) and the interface shows their names.
 */

export const FORMULA_MAX_LENGTH = 1000;
/** Parsed nodes a formula may have, so no expression makes the server work hard. */
export const FORMULA_MAX_NODES = 100;

export const FORMULA_RESULT_TYPES = ["number", "text", "boolean", "date"] as const;
export type FormulaType = (typeof FORMULA_RESULT_TYPES)[number];

/** A value inside a formula; dates are ISO strings ("2026-11-04"). */
export type FormulaValue = number | string | boolean | null;

type BinaryOperator = "+" | "-" | "*" | "/" | "&" | "=" | "<>" | "<" | ">" | "<=" | ">=";

export type FormulaNode =
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "column"; ref: string }
  | { kind: "negate"; operand: FormulaNode }
  | { kind: "binary"; operator: BinaryOperator; left: FormulaNode; right: FormulaNode }
  | { kind: "call"; fn: FormulaFunction; args: FormulaNode[] };

export type FormulaErrorCode =
  | "empty"
  | "tooLong"
  | "tooComplex"
  | "unexpected"
  | "unclosedText"
  | "unclosedColumn"
  | "unknownFunction"
  | "arguments"
  | "unknownColumn"
  | "columnNotAllowed"
  | "types";

/** Why a formula is not valid; `detail` names the token, function or column. */
export class FormulaError extends Error {
  constructor(
    readonly code: FormulaErrorCode,
    readonly detail = "",
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "FormulaError";
  }
}

// Functions -------------------------------------------------------------

const FUNCTIONS = {
  if: { min: 2, max: 3 },
  and: { min: 1, max: 10 },
  or: { min: 1, max: 10 },
  not: { min: 1, max: 1 },
  isblank: { min: 1, max: 1 },
  round: { min: 1, max: 2 },
  abs: { min: 1, max: 1 },
  min: { min: 1, max: 10 },
  max: { min: 1, max: 10 },
  upper: { min: 1, max: 1 },
  lower: { min: 1, max: 1 },
  len: { min: 1, max: 1 },
  today: { min: 0, max: 0 },
  days: { min: 2, max: 2 },
} as const;

export type FormulaFunction = keyof typeof FUNCTIONS;

/** Spanish names first, as the interface shows them; English ones also work. */
export const FORMULA_FUNCTION_NAMES: Record<FormulaFunction, string> = {
  if: "SI",
  and: "Y",
  or: "O",
  not: "NO",
  isblank: "ESVACIO",
  round: "REDONDEAR",
  abs: "ABS",
  min: "MIN",
  max: "MAX",
  upper: "MAYUSC",
  lower: "MINUSC",
  len: "LARGO",
  today: "HOY",
  days: "DIAS",
};

const FUNCTION_BY_NAME = new Map<string, FormulaFunction>(
  (Object.keys(FUNCTIONS) as FormulaFunction[]).flatMap((fn) => [
    [fn.toUpperCase(), fn],
    [FORMULA_FUNCTION_NAMES[fn], fn],
  ]),
);

const BOOLEAN_BY_NAME = new Map([
  ["VERDADERO", true],
  ["TRUE", true],
  ["FALSO", false],
  ["FALSE", false],
]);

// Tokens ----------------------------------------------------------------

type Token =
  | { kind: "number"; value: number; start: number; end: number }
  | { kind: "text"; value: string; start: number; end: number }
  | { kind: "column"; ref: string; start: number; end: number }
  | { kind: "name"; name: string; start: number; end: number }
  | { kind: "symbol"; symbol: string; start: number; end: number };

const SYMBOLS = ["<>", "<=", ">=", "+", "-", "*", "/", "&", "=", "<", ">", "(", ")", ",", ";"];

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expression.length) {
    const char = expression[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    const start = i;
    if (char === "{") {
      let ref = "";
      i++;
      // A doubled brace is a brace inside the column name.
      for (;;) {
        if (i >= expression.length) {
          throw new FormulaError("unclosedColumn");
        }
        if (expression[i] === "}") {
          if (expression[i + 1] !== "}") {
            break;
          }
          i++;
        }
        ref += expression[i];
        i++;
      }
      tokens.push({ kind: "column", ref: ref.trim(), start, end: i + 1 });
      i++;
      continue;
    }
    if (char === '"') {
      let value = "";
      i++;
      // A doubled quote is a quote inside the text, as in spreadsheets.
      for (;;) {
        if (i >= expression.length) {
          throw new FormulaError("unclosedText");
        }
        if (expression[i] === '"') {
          if (expression[i + 1] !== '"') {
            break;
          }
          i++;
        }
        value += expression[i];
        i++;
      }
      tokens.push({ kind: "text", value, start, end: i + 1 });
      i++;
      continue;
    }
    // A decimal comma, as written in Spanish; a point works too.
    const number = /^\d+([.,]\d+)?/.exec(expression.slice(i));
    if (number) {
      i += number[0].length;
      tokens.push({ kind: "number", value: Number(number[0].replace(",", ".")), start, end: i });
      continue;
    }
    const name = /^[\p{L}_][\p{L}\d_.]*/u.exec(expression.slice(i));
    if (name) {
      i += name[0].length;
      tokens.push({ kind: "name", name: name[0].toUpperCase(), start, end: i });
      continue;
    }
    const symbol = SYMBOLS.find((candidate) => expression.startsWith(candidate, i));
    if (!symbol) {
      throw new FormulaError("unexpected", char);
    }
    i += symbol.length;
    tokens.push({ kind: "symbol", symbol, start, end: i });
  }
  return tokens;
}

// Parser ----------------------------------------------------------------

const COMPARISONS = ["=", "<>", "<", ">", "<=", ">="];

/**
 * Parses a formula. Precedence, from loosest: comparisons, `&`, `+ -`,
 * `* /`, unary minus. Function arguments are separated by `;`, or by `,`
 * when it can't be a decimal comma (`MAX(2,5)` is 2.5; `MAX(2; 5)` is 5).
 */
export function parseFormula(expression: string): FormulaNode {
  if (expression.trim() === "") {
    throw new FormulaError("empty");
  }
  if (expression.length > FORMULA_MAX_LENGTH) {
    throw new FormulaError("tooLong");
  }
  const tokens = tokenize(expression);
  let position = 0;
  let nodes = 0;

  const node = <T extends FormulaNode>(value: T): T => {
    nodes++;
    if (nodes > FORMULA_MAX_NODES) {
      throw new FormulaError("tooComplex");
    }
    return value;
  };
  const peekSymbol = (...symbols: string[]): string | null => {
    const token = tokens[position];
    return token?.kind === "symbol" && symbols.includes(token.symbol) ? token.symbol : null;
  };
  const expect = (symbol: string) => {
    if (!peekSymbol(symbol)) {
      throw unexpected();
    }
    position++;
  };
  const unexpected = () => {
    const token = tokens[position];
    return new FormulaError("unexpected", token ? expression.slice(token.start, token.end) : "");
  };

  const binaryLevel = (operators: string[], next: () => FormulaNode, chain: boolean) => () => {
    let left = next();
    let operator = peekSymbol(...operators);
    while (operator) {
      position++;
      left = node({ kind: "binary", operator: operator as BinaryOperator, left, right: next() });
      // `a < b < c` means nothing useful: comparisons don't chain.
      operator = chain ? peekSymbol(...operators) : null;
    }
    return left;
  };

  const primary = (): FormulaNode => {
    const token = tokens[position];
    if (!token) {
      throw unexpected();
    }
    position++;
    switch (token.kind) {
      case "number":
        return node({ kind: "number", value: token.value });
      case "text":
        return node({ kind: "text", value: token.value });
      case "column":
        return node({ kind: "column", ref: token.ref });
      case "name": {
        if (!peekSymbol("(")) {
          const value = BOOLEAN_BY_NAME.get(token.name);
          if (value === undefined) {
            throw new FormulaError("unknownFunction", token.name);
          }
          return node({ kind: "boolean", value });
        }
        const fn = FUNCTION_BY_NAME.get(token.name);
        if (!fn) {
          throw new FormulaError("unknownFunction", token.name);
        }
        position++;
        const args: FormulaNode[] = [];
        if (!peekSymbol(")")) {
          args.push(comparison());
          while (peekSymbol(",", ";")) {
            position++;
            args.push(comparison());
          }
        }
        expect(")");
        const { min, max } = FUNCTIONS[fn];
        if (args.length < min || args.length > max) {
          throw new FormulaError("arguments", FORMULA_FUNCTION_NAMES[fn]);
        }
        return node({ kind: "call", fn, args });
      }
      case "symbol":
        if (token.symbol === "(") {
          const inner = comparison();
          expect(")");
          return inner;
        }
        if (token.symbol === "-") {
          return node({ kind: "negate", operand: primary() });
        }
        position--;
        throw unexpected();
    }
  };
  const multiplicative = binaryLevel(["*", "/"], primary, true);
  const additive = binaryLevel(["+", "-"], multiplicative, true);
  const concatenation = binaryLevel(["&"], additive, true);
  const comparison = binaryLevel(COMPARISONS, concatenation, false);

  const root = comparison();
  if (position < tokens.length) {
    throw unexpected();
  }
  return root;
}

/** The columns a formula cites, as written between its braces. */
export function formulaColumnRefs(node: FormulaNode): string[] {
  switch (node.kind) {
    case "column":
      return [node.ref];
    case "negate":
      return formulaColumnRefs(node.operand);
    case "binary":
      return [...formulaColumnRefs(node.left), ...formulaColumnRefs(node.right)];
    case "call":
      return node.args.flatMap(formulaColumnRefs);
    default:
      return [];
  }
}

/** A column as cited in a formula; a brace in its name is doubled. */
export function formulaColumnRef(name: string): string {
  return `{${name.replaceAll("}", "}}")}}`;
}

/** The column a formula cites: by id, by its exact name, or by name in any case. */
export function findFormulaColumn<T extends { id: string; name: string }>(
  columns: readonly T[],
  ref: string,
): T | undefined {
  return (
    columns.find(({ id }) => id === ref) ??
    columns.find(({ name }) => name === ref) ??
    columns.find(({ name }) => name.toLocaleLowerCase() === ref.toLocaleLowerCase())
  );
}

/**
 * Rewrites the columns between braces, keeping the rest as typed: names to
 * ids before saving, ids to names to show it. `rename` returns undefined to
 * leave a reference as it is. Text in quotes is never touched.
 */
export function renameFormulaColumns(
  expression: string,
  rename: (ref: string) => string | undefined,
): string {
  let tokens: Token[];
  try {
    tokens = tokenize(expression);
  } catch {
    return expression;
  }
  let result = "";
  let last = 0;
  for (const token of tokens) {
    if (token.kind === "column") {
      const renamed = rename(token.ref);
      if (renamed !== undefined) {
        result += expression.slice(last, token.start) + formulaColumnRef(renamed);
        last = token.end;
      }
    }
  }
  return result + expression.slice(last);
}

// Types -----------------------------------------------------------------

/**
 * A rollup inside a formula: min and max of dates are dates, and everything
 * else (counts, sums, averages) is a number. `targetType` is the type of the
 * column it adds up, or undefined when it counts.
 */
export function formulaTypeOfRollup(targetType: string | undefined): FormulaType {
  return targetType === "date" ? "date" : "number";
}

/**
 * The formula type of a cited column: a type, null when it can't be cited, or
 * "unknown" when it can but its type isn't known here (the interface can't
 * always see what a lookup shows); an unknown type fits anything.
 */
export type FormulaColumnType = FormulaType | "unknown" | null;
type CheckedType = FormulaType | "unknown";

/** How a plain column type reads inside a formula; null when it can't be cited. */
export function formulaTypeOfColumn(type: string): FormulaType | null {
  switch (type) {
    case "text":
    case "select":
      return "text";
    case "number":
    case "currency":
      return "number";
    case "date":
    case "boolean":
      return type;
    default:
      return null;
  }
}

/**
 * Checks that every column exists and every operator and function gets the
 * types it needs, and returns the type of the result.
 */
export function checkFormula(
  node: FormulaNode,
  columnType: (ref: string) => FormulaColumnType | undefined,
): CheckedType {
  const fits = (type: CheckedType, ...allowed: FormulaType[]) =>
    type === "unknown" || allowed.includes(type);
  const require = (type: CheckedType, what: string, ...allowed: FormulaType[]) => {
    if (!fits(type, ...allowed)) {
      throw new FormulaError("types", what);
    }
  };
  const same = (a: CheckedType, b: CheckedType, what: string): CheckedType => {
    if (a !== "unknown" && b !== "unknown" && a !== b) {
      throw new FormulaError("types", what);
    }
    return a === "unknown" ? b : a;
  };

  const check = (current: FormulaNode): CheckedType => {
    switch (current.kind) {
      case "number":
      case "text":
      case "boolean":
        return current.kind;
      case "column": {
        const type = columnType(current.ref);
        if (type === undefined) {
          throw new FormulaError("unknownColumn", current.ref);
        }
        if (type === null) {
          throw new FormulaError("columnNotAllowed", current.ref);
        }
        return type;
      }
      case "negate":
        require(check(current.operand), "-", "number");
        return "number";
      case "binary": {
        const left = check(current.left);
        const right = check(current.right);
        const { operator } = current;
        if (operator === "&") {
          require(left, operator, "text", "number", "date");
          require(right, operator, "text", "number", "date");
          return "text";
        }
        if (operator === "=" || operator === "<>") {
          same(left, right, operator);
          return "boolean";
        }
        if (COMPARISONS.includes(operator)) {
          require(same(left, right, operator), operator, "number", "text", "date");
          return "boolean";
        }
        require(left, operator, "number");
        require(right, operator, "number");
        return "number";
      }
      case "call": {
        const name = FORMULA_FUNCTION_NAMES[current.fn];
        const args = current.args.map(check);
        const all = (...allowed: FormulaType[]) => args.forEach((arg) => require(arg, name, ...allowed));
        switch (current.fn) {
          case "if":
            require(args[0], name, "boolean");
            return args.length === 3 ? same(args[1], args[2], name) : args[1];
          case "and":
          case "or":
          case "not":
            all("boolean");
            return "boolean";
          case "isblank":
            return "boolean";
          case "round":
          case "abs":
          case "min":
          case "max":
            all("number");
            return "number";
          case "upper":
          case "lower":
            all("text");
            return "text";
          case "len":
            all("text");
            return "number";
          case "today":
            return "date";
          case "days":
            all("date");
            return "number";
        }
      }
    }
  };
  return check(node);
}

// Evaluation ------------------------------------------------------------

/**
 * A cell as a formula value: null when empty or when it doesn't hold what its
 * type says, so a stray stored value never breaks the calculation.
 */
export function formulaInput(type: FormulaType, value: unknown): FormulaValue {
  switch (type) {
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    case "boolean":
      return typeof value === "boolean" ? value : null;
    case "date":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    case "text":
      return typeof value === "string" && value !== "" ? value : null;
  }
}

const DAY_MS = 86_400_000;

function compare(a: FormulaValue, b: FormulaValue): number {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  // Text compares like a spreadsheet does, ignoring case.
  return String(a).localeCompare(String(b), "es", { sensitivity: "accent" });
}

function asText(value: FormulaValue): string {
  return value === null ? "" : String(value);
}

/**
 * Computes a checked formula. Any calculation with an empty cell is empty,
 * as is dividing by zero; `&` reads an empty cell as no text. `today` is the
 * current date as an ISO string.
 */
export function evaluateFormula(
  node: FormulaNode,
  read: (ref: string) => FormulaValue,
  today: string,
): FormulaValue {
  const evaluate = (current: FormulaNode): FormulaValue => {
    switch (current.kind) {
      case "number":
      case "text":
      case "boolean":
        return current.value;
      case "column":
        return read(current.ref);
      case "negate": {
        const value = evaluate(current.operand);
        return typeof value === "number" ? -value : null;
      }
      case "binary": {
        const left = evaluate(current.left);
        const right = evaluate(current.right);
        switch (current.operator) {
          case "&":
            return asText(left) + asText(right);
          case "=":
          case "<>": {
            const equal =
              left === null || right === null ? left === right : compare(left, right) === 0;
            return current.operator === "=" ? equal : !equal;
          }
          case "<":
          case ">":
          case "<=":
          case ">=": {
            if (left === null || right === null) {
              return null;
            }
            const order = compare(left, right);
            return {
              "<": order < 0,
              ">": order > 0,
              "<=": order <= 0,
              ">=": order >= 0,
            }[current.operator];
          }
          default: {
            if (typeof left !== "number" || typeof right !== "number") {
              return null;
            }
            switch (current.operator) {
              case "+":
                return left + right;
              case "-":
                return left - right;
              case "*":
                return left * right;
              case "/":
                return right === 0 ? null : left / right;
            }
          }
        }
        return null;
      }
      case "call": {
        if (current.fn === "if") {
          // Only the branch taken is computed; an empty condition is false.
          const condition = evaluate(current.args[0]);
          const branch = condition === true ? current.args[1] : current.args[2];
          return branch ? evaluate(branch) : null;
        }
        const args = current.args.map(evaluate);
        switch (current.fn) {
          case "and":
            return args.every((arg) => arg === true);
          case "or":
            return args.some((arg) => arg === true);
          case "not":
            return typeof args[0] === "boolean" ? !args[0] : null;
          case "isblank":
            return args[0] === null;
          case "round": {
            const [value, digits = 0] = args;
            if (typeof value !== "number" || typeof digits !== "number") {
              return null;
            }
            const factor = 10 ** Math.min(Math.max(Math.trunc(digits), 0), 10);
            return Math.round(value * factor) / factor;
          }
          case "abs":
            return typeof args[0] === "number" ? Math.abs(args[0]) : null;
          case "min":
          case "max": {
            const values = args.filter((arg): arg is number => typeof arg === "number");
            if (values.length === 0) {
              return null;
            }
            return current.fn === "min" ? Math.min(...values) : Math.max(...values);
          }
          case "upper":
          case "lower": {
            const value = args[0];
            if (typeof value !== "string") {
              return null;
            }
            return current.fn === "upper" ? value.toLocaleUpperCase("es") : value.toLocaleLowerCase("es");
          }
          case "len":
            return asText(args[0]).length;
          case "today":
            return today;
          case "days": {
            const [end, start] = args;
            if (typeof end !== "string" || typeof start !== "string") {
              return null;
            }
            return Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS);
          }
        }
      }
    }
  };
  return cleanResult(evaluate(node));
}

/** Empty cells are null, never "" or NaN; float noise such as 0.1 + 0.2 is rounded off. */
function cleanResult(value: FormulaValue): FormulaValue {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Number(value.toPrecision(15)) : null;
  }
  return value === "" ? null : value;
}
