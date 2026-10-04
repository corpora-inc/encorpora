/**
 * Safe arithmetic/algebra expression parser and evaluator.
 *
 * AI-authored and learner-typed expressions are DATA. This module never uses
 * eval/Function; it tokenizes a tiny grammar into an AST and walks it.
 *
 * Grammar (precedence low → high):
 *   sum     := product (('+' | '-') product)*
 *   product := unary (('*' | '/' | implicit) unary)*
 *   unary   := ('+' | '-') unary | power
 *   power   := atom ('^' unary)?            (right-associative; -x^2 = -(x^2))
 *   atom    := number | constant | variable | func '(' sum (',' sum)* ')' | '(' sum ')'
 * Implicit multiplication (2x, 3(x+1), (x+1)(x-1), 2pi) binds like '*', so 1/2x = (1/2)·x.
 */
export type Expr =
  | { t: 'num'; v: number }
  | { t: 'var'; name: string }
  | { t: 'neg'; a: Expr }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Expr; b: Expr }
  | { t: 'call'; fn: FunctionName; args: Expr[] };

export const FUNCTIONS = {
  sqrt: 1, abs: 1, sin: 1, cos: 1, tan: 1, ln: 1, log: 1, exp: 1, floor: 1, ceil: 1, round: 1, min: 2, max: 2,
} as const;
export type FunctionName = keyof typeof FUNCTIONS;
const CONSTANTS: Record<string, number> = { pi: Math.PI, 'π': Math.PI, e: Math.E };
const FUNCTION_NAMES = (Object.keys(FUNCTIONS) as FunctionName[]).sort((a, b) => b.length - a.length);

export const EXPR_MAX_LENGTH = 200;
const MAX_TOKENS = 160;
const MAX_DEPTH = 40;
const MAX_LITERAL = 1e12;

export class ExprError extends Error {}

type Token =
  | { k: 'num'; v: number }
  | { k: 'id'; v: string }
  | { k: 'fn'; v: FunctionName }
  | { k: 'op'; v: '+' | '-' | '*' | '/' | '^' }
  | { k: '(' } | { k: ')' } | { k: ',' };

const SUPERSCRIPTS: Record<string, string> = { '²': '^2', '³': '^3' };

function tokenize(source: string, variables: readonly string[]): Token[] {
  if (typeof source !== 'string') throw new ExprError('Expression must be text.');
  if (source.length > EXPR_MAX_LENGTH) throw new ExprError('Expression is too long.');
  const text = source.replace(/[²³]/g, c => SUPERSCRIPTS[c]!)
    .replace(/[−–]/g, '-').replace(/[×·⋅]/g, '*').replace(/÷/g, '/').replace(/\*\*/g, '^');
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)/.exec(text.slice(i));
      if (!m) throw new ExprError('Malformed number.');
      const v = Number(m[0]);
      if (!Number.isFinite(v) || v > MAX_LITERAL) throw new ExprError('Number is out of range.');
      tokens.push({ k: 'num', v }); i += m[0].length;
    } else if (/[A-Za-zπ]/.test(c)) {
      const rest = text.slice(i);
      const fn = FUNCTION_NAMES.find(f => rest.toLowerCase().startsWith(f) && /^\s*\(/.test(rest.slice(f.length)));
      if (fn) { tokens.push({ k: 'fn', v: fn }); i += fn.length; continue; }
      if (rest.startsWith('pi') && !variables.includes('p')) { tokens.push({ k: 'id', v: 'pi' }); i += 2; continue; }
      tokens.push({ k: 'id', v: c }); i++;
    } else if ('+-*/^'.includes(c)) { tokens.push({ k: 'op', v: c as '+' }); i++; }
    else if (c === '(' || c === '[') { tokens.push({ k: '(' }); i++; }
    else if (c === ')' || c === ']') { tokens.push({ k: ')' }); i++; }
    else if (c === ',') { tokens.push({ k: ',' }); i++; }
    else throw new ExprError(`Unexpected character “${c}”.`);
    if (tokens.length > MAX_TOKENS) throw new ExprError('Expression is too long.');
  }
  if (!tokens.length) throw new ExprError('Expression is empty.');
  return tokens;
}

/** Parse with an explicit allowlist of single-letter variables. Unknown letters are errors. */
export function parseExpr(source: string, variables: readonly string[] = []): Expr {
  const tokens = tokenize(source, variables);
  let pos = 0, depth = 0;
  const peek = () => tokens[pos];
  const enter = () => { if (++depth > MAX_DEPTH) throw new ExprError('Expression is nested too deeply.'); };
  const startsAtom = (t: Token | undefined) => !!t && (t.k === 'num' || t.k === 'id' || t.k === 'fn' || t.k === '(');
  function sum(): Expr {
    enter();
    let left = product();
    for (let t = peek(); t?.k === 'op' && (t.v === '+' || t.v === '-'); t = peek()) {
      pos++; left = { t: 'bin', op: t.v, a: left, b: product() };
    }
    depth--; return left;
  }
  function product(): Expr {
    let left = unary();
    for (;;) {
      const t = peek();
      if (t?.k === 'op' && (t.v === '*' || t.v === '/')) { pos++; left = { t: 'bin', op: t.v, a: left, b: unary() }; }
      else if (startsAtom(t)) {
        if (t!.k === 'num' && tokens[pos - 1]?.k === 'num') throw new ExprError('Two numbers need an operator between them.');
        left = { t: 'bin', op: '*', a: left, b: unary() };
      } else return left;
    }
  }
  function unary(): Expr {
    const t = peek();
    if (t?.k === 'op' && (t.v === '-' || t.v === '+')) {
      pos++; enter(); const a = unary(); depth--;
      return t.v === '-' ? { t: 'neg', a } : a;
    }
    return power();
  }
  function power(): Expr {
    const base = atom();
    const t = peek();
    if (t?.k === 'op' && t.v === '^') { pos++; enter(); const exponent = unary(); depth--; return { t: 'bin', op: '^', a: base, b: exponent }; }
    return base;
  }
  function atom(): Expr {
    const t = tokens[pos++];
    if (!t) throw new ExprError('Expression ends unexpectedly.');
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'id') {
      if (t.v in CONSTANTS && !variables.includes(t.v)) return { t: 'num', v: CONSTANTS[t.v]! };
      if (!variables.includes(t.v)) throw new ExprError(variables.length ? `Use only ${variables.join(', ')} as variables.` : 'This answer has no variables.');
      return { t: 'var', name: t.v };
    }
    if (t.k === 'fn') {
      if (tokens[pos++]?.k !== '(') throw new ExprError('Function needs parentheses.');
      const args = [sum()];
      while (peek()?.k === ',') { pos++; args.push(sum()); }
      if (tokens[pos++]?.k !== ')') throw new ExprError('Missing closing parenthesis.');
      if (args.length !== FUNCTIONS[t.v]) throw new ExprError(`${t.v} takes ${FUNCTIONS[t.v]} input(s).`);
      return { t: 'call', fn: t.v, args };
    }
    if (t.k === '(') {
      const inner = sum();
      if (tokens[pos++]?.k !== ')') throw new ExprError('Missing closing parenthesis.');
      return inner;
    }
    throw new ExprError('Expression is incomplete.');
  }
  const tree = sum();
  if (pos !== tokens.length) throw new ExprError(tokens[pos]?.k === ')' ? 'Unmatched closing parenthesis.' : 'Unexpected input after the expression.');
  return tree;
}

/** Evaluate an AST. Returns NaN (never throws) for undefined values such as 1/0 or sqrt(-1). */
export function evaluate(e: Expr, scope: Readonly<Record<string, number>> = {}): number {
  switch (e.t) {
    case 'num': return e.v;
    case 'var': return scope[e.name] ?? NaN;
    case 'neg': return -evaluate(e.a, scope);
    case 'bin': {
      const a = evaluate(e.a, scope), b = evaluate(e.b, scope);
      let r: number;
      switch (e.op) {
        case '+': r = a + b; break;
        case '-': r = a - b; break;
        case '*': r = a * b; break;
        case '/': r = b === 0 ? NaN : a / b; break;
        case '^': r = Math.abs(b) > 1000 ? NaN : Math.pow(a, b); break;
      }
      return Number.isFinite(r) ? r : NaN;
    }
    case 'call': {
      const [a = NaN, b = NaN] = e.args.map(x => evaluate(x, scope));
      const fns: Record<FunctionName, () => number> = {
        sqrt: () => a < 0 ? NaN : Math.sqrt(a), abs: () => Math.abs(a), sin: () => Math.sin(a), cos: () => Math.cos(a),
        tan: () => Math.tan(a), ln: () => a <= 0 ? NaN : Math.log(a), log: () => a <= 0 ? NaN : Math.log10(a),
        exp: () => Math.exp(a), floor: () => Math.floor(a), ceil: () => Math.ceil(a), round: () => Math.round(a),
        min: () => Math.min(a, b), max: () => Math.max(a, b),
      };
      const r = fns[e.fn]();
      return Number.isFinite(r) ? r : NaN;
    }
  }
}

/** Parse + evaluate a constant expression (no variables). Throws ExprError on syntax errors. */
export function evaluateConstant(source: string): number {
  return evaluate(parseExpr(source, []));
}

export function variablesUsed(e: Expr, out = new Set<string>()): Set<string> {
  if (e.t === 'var') out.add(e.name);
  else if (e.t === 'neg') variablesUsed(e.a, out);
  else if (e.t === 'bin') { variablesUsed(e.a, out); variablesUsed(e.b, out); }
  else if (e.t === 'call') e.args.forEach(a => variablesUsed(a, out));
  return out;
}

/** Deterministic PRNG so grading is reproducible for the same activity. */
export function seededRandom(seedText: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) { h ^= seedText.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const closeEnough = (a: number, b: number, relative = 1e-9) =>
  Math.abs(a - b) <= relative * Math.max(1, Math.abs(a), Math.abs(b));

export interface SamplePoint { [variable: string]: number }
/** Random real sample points (avoids integer coincidences such as x^2 = 2x at x = 2). */
export function samplePoints(variables: readonly string[], domain: readonly [number, number], count: number, seed: string): SamplePoint[] {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, () => Object.fromEntries(variables.map(v => [v, domain[0] + (domain[1] - domain[0]) * rand()])));
}

/**
 * Structural shape of a polynomial-like expression, used for "expanded"/"simplified" form checks.
 * Returns the list of additive terms' variable signatures, or null when the expression is not a
 * sum of monomials (e.g. contains parentheses multiplying a sum, division by variables, functions).
 */
export function monomialSignatures(e: Expr): string[] | null {
  const terms: Expr[] = [];
  const collect = (x: Expr) => {
    if (x.t === 'bin' && (x.op === '+' || x.op === '-')) { collect(x.a); collect(x.b); }
    else if (x.t === 'neg') collect(x.a);
    else terms.push(x);
  };
  collect(e);
  const signatures: string[] = [];
  for (const term of terms) {
    const powers = new Map<string, number>();
    const walk = (x: Expr): boolean => {
      if (x.t === 'num') return true;
      if (x.t === 'var') { powers.set(x.name, (powers.get(x.name) ?? 0) + 1); return true; }
      if (x.t === 'neg') return walk(x.a);
      if (x.t === 'bin' && x.op === '*') return walk(x.a) && walk(x.b);
      if (x.t === 'bin' && x.op === '/') return variablesUsed(x.b).size === 0 && walk(x.a);
      if (x.t === 'bin' && x.op === '^') {
        if (x.a.t === 'var' && x.b.t === 'num' && Number.isInteger(x.b.v) && x.b.v >= 0) { powers.set(x.a.name, (powers.get(x.a.name) ?? 0) + x.b.v); return true; }
        return variablesUsed(x).size === 0;
      }
      return false;
    };
    if (!walk(term)) return null;
    signatures.push([...powers].filter(([, p]) => p > 0).sort(([a], [b]) => a.localeCompare(b)).map(([v, p]) => `${v}^${p}`).join('*') || '1');
  }
  return signatures;
}
