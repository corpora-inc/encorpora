/**
 * Exact algebra for typed expressions, equations and inequalities.
 *
 * A learner's line is parsed into a syntax tree (kept for the typeset preview
 * and for structural checks such as "is this a product?") and evaluated into
 * a rational function: a quotient of multivariate polynomials with exact
 * rational coefficients (bigint numerators and denominators). Two expressions
 * are identical when their rational functions are equal, which is decided by
 * cross-multiplying and expanding; no floating point is involved anywhere.
 *
 * Identity of rational functions is the algebra-class notion of equivalence:
 * (x² − 1)/(x − 1) is identical to x + 1 even though the first is undefined
 * at x = 1. Families that care about excluded values check them separately.
 *
 * This module is pure and loads in the browser (typeset preview) and on the
 * server (grading); the server's answer is authoritative.
 */

/* ------------------------------------------------------------ rationals */

export interface Q {
  readonly n: bigint;
  readonly d: bigint;
}
const babs = (a: bigint) => (a < 0n ? -a : a);
function bgcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
export function q(n: bigint | number, d: bigint | number = 1n): Q {
  let N = BigInt(n),
    D = BigInt(d);
  if (D === 0n) throw new ExpressionError("Division by zero");
  if (D < 0n) {
    N = -N;
    D = -D;
  }
  const g = bgcd(N, D) || 1n;
  return { n: N / g, d: D / g };
}
const ZERO = q(0);
const ONE = q(1);
export const qAdd = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const qMul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
export const qNeg = (a: Q): Q => ({ n: -a.n, d: a.d });
export const qInv = (a: Q) => q(a.d, a.n);
export const qEq = (a: Q, b: Q) => a.n === b.n && a.d === b.d;
export const qIsZero = (a: Q) => a.n === 0n;
export const qText = (a: Q) => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`);
/** Parses an integer, decimal or a/b literal exactly. */
export function qParse(text: string): Q | null {
  const s = text.trim().replaceAll("−", "-");
  const f = /^([+-]?\d{1,18})\/([+-]?\d{1,18})$/.exec(s);
  if (f) return BigInt(f[2]!) === 0n ? null : q(BigInt(f[1]!), BigInt(f[2]!));
  const m = /^([+-]?)(\d{0,18})(?:\.(\d{1,18}))?$/.exec(s);
  if (!m || (!m[2] && !m[3])) return null;
  const decimals = m[3] ?? "";
  return q(
    BigInt(`${m[1] === "-" ? "-" : ""}${m[2] || "0"}${decimals}`),
    10n ** BigInt(decimals.length),
  );
}

export class ExpressionError extends Error {}

/* ---------------------------------------------------------- polynomials */

/** A monomial key: variables in sorted order with exponents, "" for 1. */
type Monomial = string;
/** A polynomial: monomial key to nonzero coefficient. */
export type Poly = ReadonlyMap<Monomial, Q>;
/** Guards: a learner's entry is short, so anything this large is a typo
 * (or an attempt to make the server work hard). */
const MAX_TERMS = 400;
const MAX_DEGREE = 24;

function parseMonomial(key: Monomial): Map<string, number> {
  const out = new Map<string, number>();
  if (!key) return out;
  for (const part of key.split("*")) {
    const [v, e] = part.split("^");
    out.set(v!, Number(e));
  }
  return out;
}
function monomialKey(powers: Map<string, number>): Monomial {
  return [...powers.entries()]
    .filter(([, e]) => e !== 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([v, e]) => `${v}^${e}`)
    .join("*");
}
const degreeOf = (key: Monomial) =>
  [...parseMonomial(key).values()].reduce((s, e) => s + e, 0);
function multiplyMonomials(a: Monomial, b: Monomial): Monomial {
  const p = parseMonomial(a);
  for (const [v, e] of parseMonomial(b)) p.set(v, (p.get(v) ?? 0) + e);
  return monomialKey(p);
}
function guard(p: Map<Monomial, Q>): Poly {
  if (p.size > MAX_TERMS) throw new ExpressionError("Expression is too large");
  for (const key of p.keys())
    if (degreeOf(key) > MAX_DEGREE)
      throw new ExpressionError("Expression is too large");
  return p;
}
export const polyConst = (c: Q): Poly =>
  qIsZero(c) ? new Map() : new Map([["", c]]);
export const polyVar = (v: string): Poly => new Map([[`${v}^1`, ONE]]);
export function polyAdd(a: Poly, b: Poly): Poly {
  const out = new Map(a);
  for (const [k, c] of b) {
    const s = qAdd(out.get(k) ?? ZERO, c);
    if (qIsZero(s)) out.delete(k);
    else out.set(k, s);
  }
  return guard(out);
}
export const polyScale = (a: Poly, c: Q): Poly =>
  qIsZero(c)
    ? new Map()
    : new Map([...a].map(([k, v]) => [k, qMul(v, c)] as const));
export const polyNeg = (a: Poly) => polyScale(a, q(-1));
export const polySub = (a: Poly, b: Poly) => polyAdd(a, polyNeg(b));
export function polyMul(a: Poly, b: Poly): Poly {
  if (a.size * b.size > MAX_TERMS * 4)
    throw new ExpressionError("Expression is too large");
  const out = new Map<Monomial, Q>();
  for (const [ka, ca] of a)
    for (const [kb, cb] of b) {
      const k = multiplyMonomials(ka, kb);
      const s = qAdd(out.get(k) ?? ZERO, qMul(ca, cb));
      if (qIsZero(s)) out.delete(k);
      else out.set(k, s);
    }
  return guard(out);
}
export const polyIsZero = (a: Poly) => a.size === 0;
export function polyEq(a: Poly, b: Poly) {
  if (a.size !== b.size) return false;
  for (const [k, c] of a) {
    const o = b.get(k);
    if (!o || !qEq(o, c)) return false;
  }
  return true;
}
/** The constant value of a polynomial with no variables, else null. */
export function polyConstant(a: Poly): Q | null {
  if (a.size === 0) return ZERO;
  if (a.size === 1 && a.has("")) return a.get("")!;
  return null;
}
export const polyVariables = (a: Poly) =>
  new Set([...a.keys()].flatMap((k) => [...parseMonomial(k).keys()]));
export function polyDegree(a: Poly, v?: string): number {
  let best = 0;
  for (const k of a.keys()) {
    const m = parseMonomial(k);
    best = Math.max(best, v ? (m.get(v) ?? 0) : degreeOf(k));
  }
  return best;
}
/** Terms in a fixed order: higher total degree first, then by key. */
function orderedTerms(a: Poly): [Monomial, Q][] {
  return [...a].sort(([x], [y]) => {
    const dx = degreeOf(x),
      dy = degreeOf(y);
    return dx !== dy ? dy - dx : x < y ? -1 : x > y ? 1 : 0;
  });
}
/** The leading coefficient in that order; 0 for the zero polynomial. */
export const polyLead = (a: Poly): Q => orderedTerms(a)[0]?.[1] ?? ZERO;
/** The coefficient of the monomial given as variable powers. */
export function polyCoefficient(a: Poly, powers: Record<string, number>): Q {
  return a.get(monomialKey(new Map(Object.entries(powers)))) ?? ZERO;
}
/** Readable polynomial text (ASCII, for tests and diagnostics). */
export function polyText(a: Poly): string {
  if (!a.size) return "0";
  return orderedTerms(a)
    .map(([k, c], i) => {
      const neg = c.n < 0n;
      const mag = neg ? qNeg(c) : c;
      const vars = k
        ? k
            .split("*")
            .map((p) => p.replace("^1", ""))
            .join("")
        : "";
      const coef =
        vars && qEq(mag, ONE)
          ? ""
          : mag.d === 1n
            ? `${mag.n}`
            : `(${qText(mag)})`;
      return `${i === 0 ? (neg ? "-" : "") : neg ? " - " : " + "}${coef}${vars}`;
    })
    .join("");
}

/* ---------------------------------------------------- rational functions */

/** A rational function num/den; den is never the zero polynomial. */
export interface RF {
  readonly num: Poly;
  readonly den: Poly;
}
const rfOf = (num: Poly, den: Poly = polyConst(ONE)): RF => {
  if (polyIsZero(den)) throw new ExpressionError("Division by zero");
  return { num, den };
};
const constDen = (a: RF) => polyConstant(a.den);
/** Keep a constant denominator folded into the numerator. */
function tidy(a: RF): RF {
  const c = constDen(a);
  return c ? rfOf(polyScale(a.num, qInv(c))) : a;
}
export function rfAdd(a: RF, b: RF): RF {
  if (polyEq(a.den, b.den)) return tidy(rfOf(polyAdd(a.num, b.num), a.den));
  return tidy(
    rfOf(
      polyAdd(polyMul(a.num, b.den), polyMul(b.num, a.den)),
      polyMul(a.den, b.den),
    ),
  );
}
export const rfNeg = (a: RF): RF => rfOf(polyNeg(a.num), a.den);
export const rfSub = (a: RF, b: RF) => rfAdd(a, rfNeg(b));
export const rfMul = (a: RF, b: RF): RF =>
  tidy(rfOf(polyMul(a.num, b.num), polyMul(a.den, b.den)));
export function rfDiv(a: RF, b: RF): RF {
  if (polyIsZero(b.num)) throw new ExpressionError("Division by zero");
  return tidy(rfOf(polyMul(a.num, b.den), polyMul(a.den, b.num)));
}
export function rfPow(a: RF, e: number): RF {
  if (e === 0) {
    if (polyIsZero(a.num)) throw new ExpressionError("0 to the power 0");
    return rfOf(polyConst(ONE));
  }
  if (e < 0) return rfPow(rfDiv(rfOf(polyConst(ONE)), a), -e);
  let out = rfOf(polyConst(ONE));
  for (let i = 0; i < e; i++) out = rfMul(out, a);
  return out;
}
export const rfConst = (c: Q): RF => rfOf(polyConst(c));
/** True when a and b are the same rational function. */
export const rfEq = (a: RF, b: RF) =>
  polyEq(polyMul(a.num, b.den), polyMul(b.num, a.den));
export const rfIsZero = (a: RF) => polyIsZero(a.num);
/** The constant value of a, or null when it depends on a variable. */
export function rfConstant(a: RF): Q | null {
  const n = polyConstant(a.num),
    d = polyConstant(a.den);
  if (n && d) return qMul(n, qInv(d));
  if (polyIsZero(a.num)) return ZERO;
  // num = c·den for a constant c.
  const c = qMul(polyLead(a.num), qInv(polyLead(a.den)));
  return polyEq(a.num, polyScale(a.den, c)) ? c : null;
}
/** The constant k with a = k·b, when one exists and b is not zero. */
export function rfRatio(a: RF, b: RF): Q | null {
  if (rfIsZero(b)) return null;
  return rfConstant(rfDiv(a, b));
}
/** The quotient a/b as a rational function (b nonzero). */
export const rfQuotient = (a: RF, b: RF) => rfDiv(a, b);
export const rfVariables = (a: RF) =>
  new Set([...polyVariables(a.num), ...polyVariables(a.den)]);
/** The polynomial when the denominator is constant, else null. */
export function rfPolynomial(a: RF): Poly | null {
  const c = constDen(a);
  return c ? polyScale(a.num, qInv(c)) : null;
}

/* ---------------------------------------------------------------- syntax */

export type RelationOp = "=" | "<" | ">" | "<=" | ">=";
export type Node =
  | { t: "num"; value: Q; text: string }
  | { t: "var"; name: string }
  | { t: "add"; terms: { sign: 1 | -1; node: Node }[] }
  | { t: "mul"; factors: Node[]; explicit: boolean[] }
  | { t: "div"; num: Node; den: Node }
  | { t: "pow"; base: Node; exp: number }
  | { t: "neg"; node: Node }
  | { t: "group"; node: Node };
export interface Relation {
  left: Node;
  op?: RelationOp;
  right?: Node;
}
/** One typed line: an expression, a relation, or relations joined by "or". */
export interface Line {
  parts: Relation[];
}
export interface ParseOptions {
  /** Letters that may appear; any other letter is a typo. */
  variables: readonly string[];
  /** Allow =, <, >, ≤ and ≥ (one per part). */
  relations?: boolean;
  /** Require a relation in every part. */
  requireRelation?: boolean;
  /** Allow "or" (and commas) between relations, as in x = 2 or x = −3. */
  compound?: boolean;
  /** Allow ^ and superscripts. */
  powers?: boolean;
}
export type ParseResult =
  { ok: true; line: Line } | { ok: false; error: string };

export const MAX_EXPRESSION_LENGTH = 32;
const MAX_EXPONENT = 12;
const MAX_DIGITS = 12;

type Token =
  | { k: "num"; text: string }
  | { k: "var"; name: string }
  | { k: "op"; op: "+" | "-" | "*" | "/" | "^" | "(" | ")" }
  | { k: "rel"; op: RelationOp }
  | { k: "or" };
const superscripts: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

/** Typed variants a keyboard or a paste may produce, in one spelling. */
export function canonicalInput(raw: string): string {
  // Superscripts become ^ before NFKC folds them into plain digits.
  return raw
    .replace(
      /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,
      (m) => `^${[...m].map((c) => superscripts[c]).join("")}`,
    )
    .normalize("NFKC")
    .replace(/[−–—]/g, "-")
    .replace(/[×·∙⋅]/g, "*")
    .replace(/÷/g, "/")
    .replace(/≤|=</g, "<=")
    .replace(/≥|=>/g, ">=")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(raw: string, o: ParseOptions): Token[] {
  const s = canonicalInput(raw);
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === " ") {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d*\.?\d*)/.exec(s.slice(i))![1]!;
      if (m === "." || /\..*\./.test(m))
        throw new ExpressionError("Check the decimal point");
      if (m.replace(".", "").length > MAX_DIGITS)
        throw new ExpressionError("That number is too long");
      const prev = out.at(-1);
      if (prev?.k === "num")
        throw new ExpressionError("Put an operation between the two numbers");
      if (prev?.k === "var")
        throw new ExpressionError(
          `Write the number before the letter, as ${m}${prev.name}`,
        );
      out.push({ k: "num", text: m });
      i += m.length;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      // "or" between relations, when the field allows it.
      if (
        o.compound &&
        /^or\b/i.test(s.slice(i)) &&
        (i === 0 || !/[a-zA-Z]/.test(s[i - 1]!))
      ) {
        out.push({ k: "or" });
        i += 2;
        continue;
      }
      if (!o.variables.includes(c))
        throw new ExpressionError(
          o.variables.length
            ? `Use only ${listLetters(o.variables)} as ${o.variables.length === 1 ? "the letter" : "letters"}`
            : "Letters are not used here",
        );
      out.push({ k: "var", name: c });
      i++;
      continue;
    }
    if (c === "," && o.compound) {
      out.push({ k: "or" });
      i++;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (two === "<=" || two === ">=") {
      if (!o.relations)
        throw new ExpressionError("Write an expression, not a relation");
      out.push({ k: "rel", op: two });
      i += 2;
      continue;
    }
    if (c === "=" || c === "<" || c === ">") {
      if (!o.relations)
        throw new ExpressionError("Write an expression, not a relation");
      out.push({ k: "rel", op: c });
      i++;
      continue;
    }
    if ("+-*/^()".includes(c)) {
      if (c === "^" && !o.powers)
        throw new ExpressionError("Powers are not used here");
      out.push({ k: "op", op: c as "+" });
      i++;
      continue;
    }
    throw new ExpressionError(`“${c}” is not used in an answer`);
  }
  return out;
}
const listLetters = (v: readonly string[]) =>
  v.length < 2 ? v.join("") : `${v.slice(0, -1).join(", ")} and ${v.at(-1)}`;

class Parser {
  i = 0;
  constructor(
    readonly tokens: Token[],
    readonly o: ParseOptions,
  ) {}
  peek(): Token | undefined {
    return this.tokens[this.i];
  }
  isOp(op: string) {
    const t = this.peek();
    return t?.k === "op" && t.op === op;
  }
  line(): Line {
    const parts: Relation[] = [this.relation()];
    while (this.peek()?.k === "or") {
      this.i++;
      parts.push(this.relation());
    }
    if (this.i < this.tokens.length) {
      const t = this.peek()!;
      throw new ExpressionError(
        t.k === "op" && t.op === ")"
          ? "This ) has no matching ("
          : t.k === "rel"
            ? "Use one relation sign in each part"
            : "Check the end of the line",
      );
    }
    if (parts.length > 1 && !parts.every((p) => p.op))
      throw new ExpressionError(
        "Each part joined by “or” needs a relation sign",
      );
    if (this.o.requireRelation && !parts.every((p) => p.op))
      throw new ExpressionError(
        this.o.compound
          ? "Write an equation, such as x = 2"
          : "Write a relation with both sides",
      );
    return { parts };
  }
  relation(): Relation {
    const left = this.expr();
    const t = this.peek();
    if (t?.k !== "rel") return { left };
    this.i++;
    const right = this.expr();
    return { left, op: t.op, right };
  }
  expr(): Node {
    const terms: { sign: 1 | -1; node: Node }[] = [];
    let sign: 1 | -1 = 1;
    // A leading sign belongs to the first term.
    if (this.isOp("+") || this.isOp("-")) {
      sign = this.isOp("-") ? -1 : 1;
      this.i++;
    }
    terms.push({ sign, node: this.term() });
    while (this.isOp("+") || this.isOp("-")) {
      const s: 1 | -1 = this.isOp("-") ? -1 : 1;
      this.i++;
      if (this.isOp("+") || this.isOp("-"))
        throw new ExpressionError("Two signs in a row: use parentheses");
      terms.push({ sign: s, node: this.term() });
    }
    return terms.length === 1 && terms[0]!.sign === 1
      ? terms[0]!.node
      : { t: "add", terms };
  }
  /** Products and quotients, left to right; juxtaposition multiplies. */
  term(): Node {
    let node = this.power();
    const factors: Node[] = [node];
    const explicit: boolean[] = [];
    const flush = () =>
      factors.length === 1
        ? factors[0]!
        : ({
            t: "mul",
            factors: [...factors],
            explicit: [...explicit],
          } as Node);
    for (;;) {
      const t = this.peek();
      if (t?.k === "op" && t.op === "*") {
        this.i++;
        factors.push(this.power());
        explicit.push(true);
      } else if (t?.k === "op" && t.op === "/") {
        this.i++;
        const den = this.power();
        node = { t: "div", num: flush(), den };
        factors.length = 0;
        explicit.length = 0;
        factors.push(node);
      } else if (
        t &&
        (t.k === "var" ||
          (t.k === "op" && t.op === "(") ||
          (t.k === "num" && this.prevClosesGroup()))
      ) {
        factors.push(this.power());
        explicit.push(false);
      } else break;
    }
    return flush();
  }
  prevClosesGroup() {
    const prev = this.tokens[this.i - 1];
    return prev?.k === "op" && prev.op === ")";
  }
  power(): Node {
    const base = this.atom();
    if (!this.isOp("^")) return base;
    this.i++;
    let negative = false;
    let grouped = false;
    if (this.isOp("(")) {
      grouped = true;
      this.i++;
    }
    if (this.isOp("-")) {
      negative = true;
      this.i++;
    }
    const t = this.peek();
    if (t?.k !== "num" || t.text.includes("."))
      throw new ExpressionError("Use a whole-number power");
    this.i++;
    if (grouped) {
      if (!this.isOp(")")) throw new ExpressionError("Close the power’s (");
      this.i++;
    }
    const exp = Number(t.text) * (negative ? -1 : 1);
    if (Math.abs(exp) > MAX_EXPONENT)
      throw new ExpressionError("That power is too large");
    if (this.isOp("^"))
      throw new ExpressionError("Use parentheses for a power of a power");
    return { t: "pow", base, exp };
  }
  atom(): Node {
    const t = this.peek();
    if (!t)
      throw new ExpressionError(
        this.tokens.some((x) => x.k === "op" && x.op === "(")
          ? "Finish the line and close each ( with )"
          : "Finish the line",
      );
    if (t.k === "num") {
      this.i++;
      const value = qParse(t.text);
      if (!value) throw new ExpressionError("Check the number");
      return { t: "num", value, text: t.text };
    }
    if (t.k === "var") {
      this.i++;
      return { t: "var", name: t.name };
    }
    if (t.k === "op" && t.op === "(") {
      this.i++;
      if (this.isOp(")")) throw new ExpressionError("Empty parentheses");
      const node = this.expr();
      if (!this.isOp(")")) throw new ExpressionError("Close each ( with )");
      this.i++;
      return { t: "group", node };
    }
    if (t.k === "op" && (t.op === "-" || t.op === "+"))
      throw new ExpressionError("Two signs in a row: use parentheses");
    if (t.k === "rel")
      throw new ExpressionError("Write a side before the relation sign");
    if (t.k === "or") throw new ExpressionError("Write a relation before “or”");
    throw new ExpressionError(
      t.k === "op" && t.op === ")"
        ? "This ) has no matching ("
        : "Something is missing before this sign",
    );
  }
}

/** Parse one typed line. Errors are short, plain sentences for the learner. */
export function parseLine(raw: string, options: ParseOptions): ParseResult {
  if (typeof raw !== "string" || !raw.trim())
    return { ok: false, error: "Enter a line" };
  if (raw.length > MAX_EXPRESSION_LENGTH * 2)
    return { ok: false, error: "That line is too long" };
  try {
    const tokens = tokenize(raw, options);
    if (!tokens.length) return { ok: false, error: "Enter a line" };
    const line = new Parser(tokens, options).line();
    // Evaluate once so a hidden division by zero is caught at the field.
    for (const part of line.parts) {
      evaluate(part.left);
      if (part.right) evaluate(part.right);
    }
    return { ok: true, line };
  } catch (error) {
    if (error instanceof ExpressionError)
      return { ok: false, error: error.message };
    throw error;
  }
}

/** The exact value of an expression node. */
export function evaluate(node: Node): RF {
  switch (node.t) {
    case "num":
      return rfConst(node.value);
    case "var":
      return rfOf(polyVar(node.name));
    case "group":
      return evaluate(node.node);
    case "neg":
      return rfNeg(evaluate(node.node));
    case "add":
      return node.terms.reduce<RF>(
        (sum, { sign, node: n }) =>
          rfAdd(sum, sign < 0 ? rfNeg(evaluate(n)) : evaluate(n)),
        rfConst(ZERO),
      );
    case "mul":
      return node.factors.reduce<RF>(
        (p, f) => rfMul(p, evaluate(f)),
        rfConst(ONE),
      );
    case "div":
      return rfDiv(evaluate(node.num), evaluate(node.den));
    case "pow":
      return rfPow(evaluate(node.base), node.exp);
  }
}

/* -------------------------------------------------------- structure */

const unwrap = (node: Node): Node =>
  node.t === "group" ? unwrap(node.node) : node;
/** Top-level additive terms of a side: 3x + 6 − 2 has three. */
export function termCount(node: Node): number {
  const n = unwrap(node);
  return n.t === "add" ? n.terms.length : 1;
}
const isSum = (node: Node) => unwrap(node).t === "add";
/** How many products or quotients act on a sum: 3(x + 2) and (x + 6)/3 each
 * count once. Distributing removes them; factoring creates them. */
export function groupedProducts(node: Node): number {
  switch (node.t) {
    case "num":
    case "var":
      return 0;
    case "group":
    case "neg":
      return groupedProducts(node.node);
    case "add":
      return node.terms.reduce((s, t) => s + groupedProducts(t.node), 0);
    case "mul": {
      const inner = node.factors.reduce((s, f) => s + groupedProducts(f), 0);
      const sums = node.factors.filter(isSum).length;
      return inner + (sums && node.factors.length > 1 ? 1 : 0);
    }
    case "div":
      return (
        groupedProducts(node.num) +
        groupedProducts(node.den) +
        (isSum(node.num) ? 1 : 0)
      );
    case "pow":
      return (
        groupedProducts(node.base) + (isSum(node.base) && node.exp > 1 ? 1 : 0)
      );
  }
}
/** The non-constant factors of a side written as a product (with a power of
 * a factor repeated), or null when the side is not written as a product of
 * at least two non-constant factors. A constant factor is allowed. */
export function productFactors(node: Node): Node[] | null {
  const n = unwrap(node);
  const expand = (f: Node): Node[] => {
    const u = unwrap(f);
    if (u.t === "pow" && u.exp > 1) return Array(u.exp).fill(u.base);
    return [f];
  };
  const all =
    n.t === "mul" ? n.factors.flatMap(expand) : n.t === "pow" ? expand(n) : [n];
  const variable = all.filter((f) => rfConstant(evaluate(f)) === null);
  return variable.length >= 2 ? variable : null;
}
/** The variable alone on one side and a value without it on the other:
 * x = 4, 4 = x, h = 2A/b. Returns the value's node, or null. */
export function solvedFor(
  relation: Relation,
  variable: string,
): { value: Node; flipped: boolean } | null {
  if (!relation.right || !relation.op) return null;
  const alone = (n: Node) => {
    const u = unwrap(n);
    return u.t === "var" && u.name === variable;
  };
  const free = (n: Node) => !rfVariables(evaluate(n)).has(variable);
  if (alone(relation.left) && free(relation.right))
    return { value: relation.right, flipped: false };
  if (alone(relation.right) && free(relation.left))
    return { value: relation.left, flipped: true };
  return null;
}
/** The relation read from the other side: 3 < x is x > 3. */
export const flipOp = (op: RelationOp): RelationOp =>
  op === "<"
    ? ">"
    : op === ">"
      ? "<"
      : op === "<="
        ? ">="
        : op === ">="
          ? "<="
          : "=";

/* ---------------------------------------------------------------- text */

const opTex: Record<RelationOp, string> = {
  "=": "=",
  "<": "<",
  ">": ">",
  "<=": "\\le ",
  ">=": "\\ge ",
};
const opText: Record<RelationOp, string> = {
  "=": "=",
  "<": "<",
  ">": ">",
  "<=": "≤",
  ">=": "≥",
};
const startsWithDigit = (tex: string) => /^[0-9.]/.test(tex);
/** TeX for a node, keeping the learner's grouping. */
export function nodeTex(node: Node): string {
  switch (node.t) {
    case "num":
      return node.text.startsWith(".") ? `0${node.text}` : node.text;
    case "var":
      return node.name;
    case "group":
      return `\\left(${nodeTex(node.node)}\\right)`;
    case "neg":
      return `-${nodeTex(node.node)}`;
    case "add":
      return node.terms
        .map(
          ({ sign, node: n }, i) =>
            `${sign < 0 ? "-" : i ? "+" : ""}${nodeTex(n)}`,
        )
        .join("");
    case "mul":
      return node.factors
        .map((f, i) => {
          const tex = nodeTex(f);
          if (i === 0) return tex;
          const joint =
            node.explicit[i - 1] || startsWithDigit(tex) ? "\\cdot " : "";
          return `${joint}${tex}`;
        })
        .join("");
    case "div":
      return `\\frac{${nodeTex(unwrap(node.num))}}{${nodeTex(unwrap(node.den))}}`;
    case "pow": {
      const base = nodeTex(node.base);
      const braced =
        node.base.t === "num" ||
        node.base.t === "var" ||
        node.base.t === "group"
          ? base
          : `{${base}}`;
      return `${braced}^{${node.exp}}`;
    }
  }
}
export function lineTex(line: Line): string {
  return line.parts
    .map((p) =>
      p.op && p.right
        ? `${nodeTex(p.left)}${opTex[p.op]}${nodeTex(p.right)}`
        : nodeTex(p.left),
    )
    .join("\\ \\text{or}\\ ");
}
/** Plain text for a node (for answer text and screen readers). */
export function nodeText(node: Node): string {
  switch (node.t) {
    case "num":
      return node.text.startsWith(".") ? `0${node.text}` : node.text;
    case "var":
      return node.name;
    case "group":
      return `(${nodeText(node.node)})`;
    case "neg":
      return `−${nodeText(node.node)}`;
    case "add":
      return node.terms
        .map(
          ({ sign, node: n }, i) =>
            `${sign < 0 ? (i ? " − " : "−") : i ? " + " : ""}${nodeText(n)}`,
        )
        .join("");
    case "mul":
      return node.factors
        .map((f, i) => {
          const text = nodeText(f);
          if (i === 0) return text;
          return node.explicit[i - 1] || /^[0-9]/.test(text)
            ? ` × ${text}`
            : text;
        })
        .join("");
    case "div":
      return `${nodeText(node.num)}/${nodeText(node.den)}`;
    case "pow":
      return `${nodeText(node.base)}^${node.exp}`;
  }
}
export function lineText(line: Line): string {
  return line.parts
    .map((p) =>
      p.op && p.right
        ? `${nodeText(p.left)} ${opText[p.op]} ${nodeText(p.right)}`
        : nodeText(p.left),
    )
    .join(" or ");
}
/** The transport spelling of a typed line: canonical characters and no
 * spaces, with parts of a compound line joined by " or ". */
export function compactLine(raw: string, compound = false): string {
  const s = canonicalInput(raw);
  const parts = compound
    ? s.split(/\s*,\s*|\s+or\s+|(?<![a-zA-Z])or(?![a-zA-Z])/i)
    : [s];
  return parts.map((part) => part.replace(/ /g, "")).join(" or ");
}
