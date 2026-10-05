/**
 * Activity Spec v2 quantities: exact values with a dimension, the closed unit registry, the one
 * expression grammar shared by quantity values, asks, candidates and distractor rules, and locale
 * formatting (README §3, §6).
 *
 * Every value is an exact rational (learning/rational.ts) plus a dimension: a power of length and,
 * when the power is not zero, a length unit. `count`, `number` and `fraction` are dimensionless;
 * `length` is length¹ and `area` is length². There is no unit conversion: an expression that mixes
 * units, or adds a length to an area, is rejected. Floats appear only at draw time (`toNumber`).
 *
 * Model output is untrusted. Expressions are parsed by a small bounded grammar (numbers, ids,
 * `id.member`, + − × ÷, parentheses, min, max), evaluated exactly, and never executed.
 */
import { add, compare, divide, multiply, rational, subtract, type Rational } from '../../learning/rational';

// ---------- kinds and units ----------
export const QUANTITY_KINDS = ['count', 'number', 'fraction', 'length', 'area'] as const;
export type QuantityKind = typeof QUANTITY_KINDS[number];
/** The power of length a kind measures. */
export const KIND_POWER: Readonly<Record<QuantityKind, number>> = { count: 0, number: 0, fraction: 0, length: 1, area: 2 };
/** Kinds whose quantities carry a length unit (`area` names the unit it squares). */
export const kindTakesUnit = (kind: QuantityKind) => KIND_POWER[kind] > 0;

interface UnitInfo { one: string; other: string; symbol: string }
/**
 * The closed length-unit registry. A `length` quantity is measured in the unit; an `area` quantity
 * in its square. `unit` is the generic grid unit of early area and perimeter ("square units").
 */
export const LENGTH_UNITS = {
  unit: { one: 'unit', other: 'units', symbol: 'units' },
  mm: { one: 'millimeter', other: 'millimeters', symbol: 'mm' },
  cm: { one: 'centimeter', other: 'centimeters', symbol: 'cm' },
  m: { one: 'meter', other: 'meters', symbol: 'm' },
  km: { one: 'kilometer', other: 'kilometers', symbol: 'km' },
  in: { one: 'inch', other: 'inches', symbol: 'in' },
  ft: { one: 'foot', other: 'feet', symbol: 'ft' },
  yd: { one: 'yard', other: 'yards', symbol: 'yd' },
  mi: { one: 'mile', other: 'miles', symbol: 'mi' },
} as const satisfies Record<string, UnitInfo>;
export type UnitId = keyof typeof LENGTH_UNITS;
export const UNIT_IDS = Object.keys(LENGTH_UNITS) as UnitId[];
export const isUnitId = (u: string): u is UnitId => Object.hasOwn(LENGTH_UNITS, u);

// ---------- values ----------
/** How a literal was written, kept only for display: `2/4` stays `2/4`, `2.50` keeps two places. */
export type NumberForm = { kind: 'fraction'; n: bigint; d: bigint } | { kind: 'decimal'; places: number };
export interface Value {
  q: Rational;
  /** Power of length: 0 dimensionless, 1 length, 2 area. */
  power: number;
  /** The length unit; null exactly when power is 0. */
  unit: UnitId | null;
  form?: NumberForm;
}
export interface Issue { code: string; message: string }
export type Result<T> = { ok: true; value: T } | { ok: false; error: Issue };
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (code: string, message: string): { ok: false; error: Issue } => ({ ok: false, error: { code, message } });

export const ZERO = rational(0n), ONE = rational(1n);
export const isInteger = (q: Rational) => q.d === 1n;
export const sameValue = (a: Value, b: Value) => compare(a.q, b.q) === 0;
export const toNumber = (q: Rational) => Number(q.n) / Number(q.d);
export const dimensionless = (q: Rational, form?: NumberForm): Value => ({ q, power: 0, unit: null, ...(form ? { form } : {}) });
const dimName = (v: Pick<Value, 'power' | 'unit'>) => v.power === 0 ? 'a plain number' : v.power === 1 ? `a length in ${v.unit}` : v.power === 2 ? `an area in square ${v.unit}` : `length^${v.power} in ${v.unit}`;

// ---------- expressions ----------
export type Expr =
  | { t: 'num'; q: Rational; form?: NumberForm }
  | { t: 'ref'; path: readonly string[] }
  | { t: 'neg'; e: Expr }
  | { t: 'op'; op: '+' | '-' | '*' | '/'; a: Expr; b: Expr }
  | { t: 'fn'; fn: 'min' | 'max'; args: readonly [Expr, Expr] };

export const MAX_EXPR_CHARS = 120;
// Each parenthesis level costs four recursion steps (sum, product, unary, atom): 40 allows about ten levels.
const MAX_DEPTH = 40, MAX_NODES = 48, MAX_NUMBER_DIGITS = 12;
/** The highest power of length any quantity kind measures (area). Raise it with a volume kind. */
export const MAX_POWER = 2;
/** Bound on numerators and denominators of every intermediate result. */
const MAX_MAGNITUDE = 10n ** 24n;
const ID = /^[a-z][a-z0-9]{0,7}$/;
const MEMBER = /^[a-z]{1,16}$/;

type Token = { k: 'num'; text: string } | { k: 'id'; path: string[] } | { k: 'op'; v: '+' | '-' | '*' | '/' } | { k: '(' | ')' | ',' };
function tokenize(source: string): Result<Token[]> {
  const tokens: Token[] = [];
  const s = source.replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/');
  for (let i = 0; i < s.length;) {
    const c = s[i]!;
    if (c === ' ') { i++; continue; }
    const num = /^\d+(?:\.\d+)?/.exec(s.slice(i));
    if (num) {
      if (num[0].replace('.', '').length > MAX_NUMBER_DIGITS) return fail('expr_number', `The number ${num[0].slice(0, 16)} is too long.`);
      tokens.push({ k: 'num', text: num[0] }); i += num[0].length; continue;
    }
    const word = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*/.exec(s.slice(i));
    if (word) {
      const path = word[0].split('.');
      if (!ID.test(path[0]!)) return fail('expr_id', `"${path[0]!.slice(0, 16)}" is not an id (a lowercase letter, then up to 7 letters or digits).`);
      if (path.length > 3 || path.slice(1).some(m => !MEMBER.test(m))) return fail('expr_id', `"${word[0].slice(0, 32)}" is not a reference: write id, id.member or id.member.member.`);
      tokens.push({ k: 'id', path }); i += word[0].length; continue;
    }
    if (c === '+' || c === '-' || c === '*' || c === '/') { tokens.push({ k: 'op', v: c }); i++; continue; }
    if (c === '(' || c === ')' || c === ',') { tokens.push({ k: c }); i++; continue; }
    return fail('expr_syntax', `Unexpected character "${c}" in an expression.`);
  }
  return ok(tokens);
}

/**
 * Parse an exact expression. Grammar (precedence low → high): sums, products (explicit, or implicit
 * before a parenthesis, as in "2(w+h)"), unary minus, atoms (numbers, references, `min(a, b)`,
 * `max(a, b)`, parentheses).
 */
export function parseExpr(source: string): Result<Expr> {
  if (typeof source !== 'string' || !source.trim()) return fail('expr_empty', 'An expression is empty.');
  if (source.length > MAX_EXPR_CHARS) return fail('expr_long', `An expression is longer than ${MAX_EXPR_CHARS} characters.`);
  const lexed = tokenize(source);
  if (!lexed.ok) return lexed;
  const t = lexed.value;
  let pos = 0, nodes = 0;
  const peek = () => t[pos];
  const node = (e: Expr, depth: number): Expr => {
    if (++nodes > MAX_NODES) throw new ParseError('expr_size', 'An expression has too many parts.');
    if (depth > MAX_DEPTH) throw new ParseError('expr_size', 'An expression is nested too deeply.');
    return e;
  };
  const sum = (depth: number): Expr => {
    let left = product(depth + 1);
    for (let p = peek(); p?.k === 'op' && (p.v === '+' || p.v === '-'); p = peek()) { pos++; left = node({ t: 'op', op: p.v, a: left, b: product(depth + 1) }, depth); }
    return left;
  };
  const product = (depth: number): Expr => {
    let left = unary(depth + 1);
    for (;;) {
      const p = peek();
      if (p?.k === 'op' && (p.v === '*' || p.v === '/')) { pos++; left = node({ t: 'op', op: p.v, a: left, b: unary(depth + 1) }, depth); continue; }
      // Implicit multiplication only between a number or ")" and "(": "2(w+h)", "(a)(b)". Never "2w" (is "1e3" 1·e3?),
      // and never after an id, where "f(x)" would read as a call.
      const prev = t[pos - 1];
      if (p?.k === '(' && (prev?.k === 'num' || prev?.k === ')')) { left = node({ t: 'op', op: '*', a: left, b: unary(depth + 1) }, depth); continue; }
      return left;
    }
  };
  const unary = (depth: number): Expr => {
    const p = peek();
    if (p?.k === 'op' && p.v === '-') { pos++; return node({ t: 'neg', e: unary(depth + 1) }, depth); }
    if (p?.k === 'op' && p.v === '+') { pos++; return unary(depth + 1); }
    return atom(depth + 1);
  };
  const atom = (depth: number): Expr => {
    const p = t[pos++];
    if (!p) throw new ParseError('expr_syntax', 'An expression ends too early.');
    if (p.k === 'num') return node({ t: 'num', ...literal(p.text) }, depth);
    if (p.k === '(') {
      const inner = sum(depth + 1);
      if (t[pos++]?.k !== ')') throw new ParseError('expr_syntax', 'A parenthesis is not closed.');
      return inner;
    }
    if (p.k === 'id') {
      if (p.path.length === 1 && (p.path[0] === 'min' || p.path[0] === 'max') && peek()?.k === '(') {
        pos++;
        const a = sum(depth + 1);
        if (t[pos++]?.k !== ',') throw new ParseError('expr_syntax', `${p.path[0]} takes two arguments: ${p.path[0]}(a, b).`);
        const b = sum(depth + 1);
        if (t[pos++]?.k !== ')') throw new ParseError('expr_syntax', `${p.path[0]}( is not closed.`);
        return node({ t: 'fn', fn: p.path[0], args: [a, b] }, depth);
      }
      return node({ t: 'ref', path: p.path }, depth);
    }
    throw new ParseError('expr_syntax', `Unexpected "${p.k === 'op' ? p.v : p.k}" in an expression.`);
  };
  try {
    const e = sum(0);
    if (pos < t.length) return fail('expr_syntax', 'An expression has extra text after its end.');
    return ok(literalForm(e));
  } catch (e) {
    if (e instanceof ParseError) return fail(e.code, e.message);
    throw e;
  }
}
class ParseError extends Error { constructor(readonly code: string, message: string) { super(message); } }

function literal(text: string): { q: Rational; form?: NumberForm } {
  const [whole, part] = text.split('.');
  if (part === undefined) return { q: rational(BigInt(whole!)) };
  return { q: rational(BigInt(whole! + part), 10n ** BigInt(part.length)), form: { kind: 'decimal', places: part.length } };
}
/**
 * A written number: an integer, a decimal, `a/b` with whole a and b ("2/4" keeps its terms), each
 * with an optional minus sign. Unary minus binds tighter than ÷, so "-3/4" arrives as (−3)/4.
 */
function literalForm(e: Expr): Expr {
  const whole = (x: Expr): bigint | null => {
    if (x.t === 'num' && !x.form) return x.q.n;
    if (x.t === 'neg' && x.e.t === 'num' && !x.e.form) return -x.e.q.n;
    return null;
  };
  if (e.t === 'op' && e.op === '/') {
    const n = whole(e.a), d = e.b.t === 'num' && !e.b.form ? e.b.q.n : null;
    if (n !== null && d !== null && d !== 0n) return { t: 'num', q: rational(n, d), form: { kind: 'fraction', n, d } };
  }
  if (e.t === 'neg') {
    const inner = literalForm(e.e);
    if (inner.t === 'num') {
      const form = inner.form?.kind === 'fraction' ? { kind: 'fraction' as const, n: -inner.form.n, d: inner.form.d } : inner.form;
      return { t: 'num', q: rational(-inner.q.n, inner.q.d), ...(form ? { form } : {}) };
    }
  }
  return e;
}

/** Every reference an expression makes, in order of appearance (with repeats removed). */
export function refsOf(e: Expr): string[][] {
  const out: string[][] = [];
  const seen = new Set<string>();
  const walk = (x: Expr) => {
    switch (x.t) {
      case 'ref': { const k = x.path.join('.'); if (!seen.has(k)) { seen.add(k); out.push([...x.path]); } return; }
      case 'neg': return walk(x.e);
      case 'op': walk(x.a); return walk(x.b);
      case 'fn': walk(x.args[0]); return walk(x.args[1]);
      default: return;
    }
  };
  walk(e);
  return out;
}
/** True when the expression is a written number, with no references and no arithmetic beyond a sign or a/b. */
export const isLiteral = (e: Expr) => e.t === 'num';

export type Resolver = (path: readonly string[]) => Result<Value>;
const bounded = (q: Rational): Result<Rational> => {
  const abs = (x: bigint) => x < 0n ? -x : x;
  return abs(q.n) >= MAX_MAGNITUDE || q.d >= MAX_MAGNITUDE ? fail('expr_magnitude', 'A value is too large to work with exactly.') : ok(q);
};
/**
 * Evaluate exactly, with dimensions. + − min max need matching dimensions; × adds powers and ÷
 * subtracts them, with one shared unit. A negative power (a plain number divided by a length) is
 * rejected, as is division by zero.
 */
export function evaluate(e: Expr, resolve: Resolver): Result<Value> {
  switch (e.t) {
    case 'num': return ok(dimensionless(e.q, e.form));
    case 'ref': return resolve(e.path);
    case 'neg': {
      const v = evaluate(e.e, resolve);
      return v.ok ? ok({ q: rational(-v.value.q.n, v.value.q.d), power: v.value.power, unit: v.value.unit }) : v;
    }
    case 'fn': {
      const a = evaluate(e.args[0], resolve); if (!a.ok) return a;
      const b = evaluate(e.args[1], resolve); if (!b.ok) return b;
      if (!sameDim(a.value, b.value)) return fail('dimension_mismatch', `${e.fn}() compares ${dimName(a.value)} with ${dimName(b.value)}.`);
      // min and max return the operand they pick, written form included ("6/8" stays "6/8").
      return ok((compare(a.value.q, b.value.q) <= 0) === (e.fn === 'min') ? a.value : b.value);
    }
    case 'op': {
      const a = evaluate(e.a, resolve); if (!a.ok) return a;
      const b = evaluate(e.b, resolve); if (!b.ok) return b;
      const x = a.value, y = b.value;
      if (e.op === '+' || e.op === '-') {
        if (!sameDim(x, y)) return fail('dimension_mismatch', `Cannot ${e.op === '+' ? 'add' : 'subtract'} ${dimName(y)} ${e.op === '+' ? 'to' : 'from'} ${dimName(x)}.`);
        const q = bounded((e.op === '+' ? add : subtract)(x.q, y.q));
        return q.ok ? ok({ q: q.value, power: x.power, unit: x.unit }) : q;
      }
      if (x.unit && y.unit && x.unit !== y.unit) return fail('dimension_mismatch', `Cannot combine ${x.unit} with ${y.unit}; there are no unit conversions.`);
      const unit = x.unit ?? y.unit;
      if (e.op === '*') {
        if (x.power + y.power > MAX_POWER) return fail('dimension_unsupported', `Multiplying ${dimName(x)} by ${dimName(y)} gives a power of length no quantity measures.`);
        const q = bounded(multiply(x.q, y.q));
        return q.ok ? ok({ q: q.value, power: x.power + y.power, unit: x.power + y.power ? unit : null }) : q;
      }
      if (y.q.n === 0n) return fail('division_by_zero', 'An expression divides by zero.');
      const power = x.power - y.power;
      if (power < 0) return fail('dimension_unsupported', `Dividing ${dimName(x)} by ${dimName(y)} gives a unit per length, which no quantity measures.`);
      const q = bounded(divide(x.q, y.q));
      return q.ok ? ok({ q: q.value, power, unit: power ? unit : null }) : q;
    }
  }
}
const sameDim = (a: Pick<Value, 'power' | 'unit'>, b: Pick<Value, 'power' | 'unit'>) => a.power === b.power && a.unit === b.unit;

// ---------- declared quantities ----------
export interface Noun { icon: string | null; one: string; other: string }
/** A quantity exactly as the model declares it (wire shape; README §3). */
export interface QuantityDecl { id: string; kind: QuantityKind; noun: Noun | null; unit: string | null; value: string }

/** The dimension a declaration promises: its kind's power, in its unit. */
export function declaredDim(decl: Pick<QuantityDecl, 'kind' | 'unit'>): Result<Pick<Value, 'power' | 'unit'>> {
  const power = KIND_POWER[decl.kind];
  if (power === 0) return decl.unit === null ? ok({ power, unit: null }) : fail('unit_unexpected', `A ${decl.kind} has no unit; set unit to null.`);
  if (decl.unit === null) return fail('unit_missing', `A ${decl.kind} needs a unit (${UNIT_IDS.join(', ')}).`);
  if (!isUnitId(decl.unit)) return fail('unit_unknown', `Unknown unit "${decl.unit.slice(0, 16)}"; use one of ${UNIT_IDS.join(', ')}.`);
  return ok({ power, unit: decl.unit });
}

/**
 * The typed value of a declared quantity. A literal takes its declaration's dimension; a derived
 * value must evaluate to exactly that dimension. Counts are whole and not negative, lengths and
 * areas are not negative.
 */
export function quantityValue(decl: QuantityDecl, expr: Expr, resolve: Resolver): Result<Value> {
  const dim = declaredDim(decl);
  if (!dim.ok) return dim;
  let value: Value;
  if (isLiteral(expr)) {
    const n = expr as Extract<Expr, { t: 'num' }>;
    value = { q: n.q, ...dim.value, ...(n.form ? { form: n.form } : {}) };
  } else {
    const v = evaluate(expr, resolve);
    if (!v.ok) return v;
    if (!sameDim(v.value, dim.value)) return fail('dimension_mismatch', `${decl.id} is declared as ${dimName(dim.value)}, but its value is ${dimName(v.value)}.`);
    value = v.value;
  }
  // A count is a whole number, so it never displays as a fraction ("4/2 apples").
  if (decl.kind === 'count' && value.form?.kind === 'fraction') { const { form: _f, ...whole } = value; value = whole; }
  return checkKind(decl.kind, value, decl.id);
}
/** What every value of a kind must satisfy. */
export function checkKind(kind: QuantityKind, value: Value, id: string): Result<Value> {
  const negative = value.q.n < 0n;
  if (kind === 'count' && (!isInteger(value.q) || negative)) return fail('count_not_whole', `${id} is a count, so it must be a whole number of at least 0 (it is ${formatPlain(value.q)}).`);
  if ((kind === 'length' || kind === 'area') && negative) return fail('measure_negative', `${id} is a ${kind}, so it cannot be negative.`);
  return ok(value);
}

// ---------- formatting ----------
export type Rich = ({ kind: 'text'; text: string } | { kind: 'math'; tex: string })[];
export const DEFAULT_LOCALE = 'en-US';

/** The exact decimal digits of q when its denominator has only the factors 2 and 5, else null. */
export function exactDecimal(q: Rational, minPlaces = 0): { int: bigint; frac: string; negative: boolean } | null {
  let d = q.d, twos = 0, fives = 0;
  while (d % 2n === 0n) { d /= 2n; twos++; }
  while (d % 5n === 0n) { d /= 5n; fives++; }
  if (d !== 1n) return null;
  const places = Math.max(twos, fives, minPlaces);
  const negative = q.n < 0n, n = negative ? -q.n : q.n;
  const scaled = n * 10n ** BigInt(places) / q.d;
  const digits = scaled.toString().padStart(places + 1, '0');
  return { int: BigInt(digits.slice(0, digits.length - places) || '0'), frac: places ? digits.slice(-places) : '', negative };
}
const formatters = new Map<string, { int: Intl.NumberFormat; decimal: string; minus: string }>();
function localeFormat(locale: string) {
  let f = formatters.get(locale);
  if (!f) {
    const int = new Intl.NumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 });
    const parts = new Intl.NumberFormat(locale).formatToParts(-1.5);
    f = { int, decimal: parts.find(p => p.type === 'decimal')?.value ?? '.', minus: parts.find(p => p.type === 'minusSign')?.value ?? '-' };
    formatters.set(locale, f);
  }
  return f;
}
/** "3/4", "12", "2.5": a locale-free exact rendering for messages and logs. */
export const formatPlain = (q: Rational) => q.d === 1n ? String(q.n) : `${q.n}/${q.d}`;

/**
 * The number part of a value: an integer or terminating decimal as locale text (grouping, decimal
 * separator), anything else as a TeX fraction. A written fraction keeps its written terms.
 */
export function formatNumber(value: Pick<Value, 'q' | 'form'>, locale = DEFAULT_LOCALE, asFraction = false): Rich {
  const form = value.form;
  if (form?.kind === 'fraction' && (asFraction || form.d !== 1n)) return [{ kind: 'math', tex: texFraction(form.n, form.d) }];
  if (asFraction && value.q.d !== 1n) return [{ kind: 'math', tex: texFraction(value.q.n, value.q.d) }];
  const dec = exactDecimal(value.q, form?.kind === 'decimal' ? form.places : 0);
  if (!dec) return [{ kind: 'math', tex: texFraction(value.q.n, value.q.d) }];
  const f = localeFormat(locale);
  return [{ kind: 'text', text: `${dec.negative ? f.minus : ''}${f.int.format(dec.int)}${dec.frac ? f.decimal + dec.frac : ''}` }];
}
const texFraction = (n: bigint, d: bigint) => `${n < 0n ? '-' : ''}\\frac{${n < 0n ? -n : n}}{${d}}`;

const pluralRules = new Map<string, Intl.PluralRules>();
/** CLDR plural category of a value, honouring written decimal places ("1.0 meters"). */
export function pluralCategory(value: Pick<Value, 'q' | 'form'>, locale = DEFAULT_LOCALE): Intl.LDMLPluralRule {
  if (value.q.d !== 1n && !exactDecimal(value.q)) return 'other';
  // Every printed decimal place counts ("1.0001 centimeters"); PluralRules would otherwise round to three.
  const places = Math.max(value.form?.kind === 'decimal' ? value.form.places : 0, exactDecimal(value.q)!.frac.length);
  const key = `${locale}|${places}`;
  let rules = pluralRules.get(key);
  if (!rules) { rules = new Intl.PluralRules(locale, { minimumFractionDigits: places, maximumFractionDigits: Math.max(places, 3) }); pluralRules.set(key, rules); }
  return rules.select(toNumber(value.q));
}
/** English has two categories; a category the model did not write falls back to `other`. */
export const nounFor = (noun: Pick<Noun, 'one' | 'other'>, category: Intl.LDMLPluralRule) => category === 'one' ? noun.one : noun.other;

/** Unit name for a power of a length unit: "centimeters", "square units". */
export function unitName(unit: UnitId, power: number, category: Intl.LDMLPluralRule): string {
  const u = LENGTH_UNITS[unit];
  const base = category === 'one' ? u.one : u.other;
  return power === 2 ? `square ${base}` : base;
}
/** Short unit label for an answer dock: "cm", "cm²", "square units". */
export function unitSymbol(unit: UnitId, power: number): string {
  if (unit === 'unit') return power === 2 ? 'square units' : 'units';
  return `${LENGTH_UNITS[unit].symbol}${power === 2 ? '²' : ''}`;
}

const SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** A whole number from 0 to 999,999 in English words; null for anything else or another language. */
export function numberWords(q: Rational, locale = DEFAULT_LOCALE): string | null {
  if (!/^en\b/i.test(locale) || q.d !== 1n || q.n < 0n || q.n > 999_999n) return null;
  const below1000 = (n: number): string => {
    const parts: string[] = [];
    if (n >= 100) { parts.push(`${SMALL[Math.floor(n / 100)]} hundred`); n %= 100; }
    if (n >= 20) parts.push(`${TENS[Math.floor(n / 10)]}${n % 10 ? `-${SMALL[n % 10]}` : ''}`);
    else if (n > 0 || !parts.length) parts.push(SMALL[n]!);
    return parts.join(' ');
  };
  const n = Number(q.n);
  if (n < 1000) return below1000(n);
  return `${below1000(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${below1000(n % 1000)}` : ''}`;
}

/** How a placeholder presents a value (README §6). '' is the full form. */
export const VALUE_ATTRS = ['', 'n', 'noun', 'one', 'other', 'word', 'unit'] as const;
export type ValueAttr = typeof VALUE_ATTRS[number];
export const isValueAttr = (a: string): a is ValueAttr => (VALUE_ATTRS as readonly string[]).includes(a);
/** A value with what it counts or measures in: the noun of a count, or the unit inside `value`. */
export interface Described { value: Value; noun: Noun | null; kind: QuantityKind }

/**
 * Present a described value. The full form is the number with its noun ("4 apples") or unit
 * ("20 square units"); fractions are TeX. `noun`, `one` and `other` fall back to the unit name, so
 * "How many {{s.area.other}}?" reads "How many square units?".
 */
export function formatValue(d: Described, attr: ValueAttr, locale = DEFAULT_LOCALE): Result<Rich> {
  const { value } = d;
  const number = formatNumber(value, locale, d.kind === 'fraction');
  const category = pluralCategory(value, locale);
  const words = (cat: Intl.LDMLPluralRule): string | null => d.noun ? nounFor(d.noun, cat) : value.unit ? unitName(value.unit, value.power, cat) : null;
  switch (attr) {
    case '': { const w = words(category); return ok(w ? [...number, { kind: 'text', text: ` ${w}` }] : number); }
    case 'n': return ok(number);
    case 'noun': case 'one': case 'other': {
      const w = words(attr === 'noun' ? category : attr);
      return w ? ok([{ kind: 'text', text: w }]) : fail('placeholder_no_noun', `This ${d.kind} has no noun or unit to name.`);
    }
    case 'word': {
      const w = numberWords(value.q, locale);
      return w ? ok([{ kind: 'text', text: w }]) : fail('placeholder_no_words', 'Number words are only for whole numbers up to 999,999 (English).');
    }
    case 'unit':
      return value.unit ? ok([{ kind: 'text', text: unitName(value.unit, value.power, category) }]) : fail('placeholder_no_unit', `This ${d.kind} has no unit.`);
  }
}
