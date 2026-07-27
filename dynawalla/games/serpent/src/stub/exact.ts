/**
 * Exact arithmetic for everything a child is graded on.
 *
 * There is no floating point in this file and there must never be one: every
 * value is an integer numerator over a positive integer denominator, every
 * comparison is an integer cross-multiplication. `0.1 + 0.2 !== 0.3` would mark
 * correct decimal work wrong *deterministically*, which is worse than flaky.
 *
 * Labels are the strings that appear on an orb. They are generated together
 * with their exact value — the parser below exists so that tests can check the
 * generator by an independent path, and so a hand-written label can never drift
 * from what the game believes it is worth.
 */

export type Frac = { n: number; d: number };

const MINUS = "−"; // − U+2212 MINUS SIGN, not a hyphen
const TIMES = "×"; // ×
const DIVIDE = "÷"; // ÷

export const GLYPH = { minus: MINUS, times: TIMES, divide: DIVIDE } as const;

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function frac(n: number, d: number): Frac {
  if (d === 0) throw new Error("zero denominator");
  if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error("non-integer fraction part");
  let nn = n;
  let dd = d;
  if (dd < 0) {
    nn = -nn;
    dd = -dd;
  }
  const g = gcd(nn, dd) || 1;
  return { n: nn / g, d: dd / g };
}

export const int = (n: number): Frac => ({ n, d: 1 });

/** Sign of a − b. Integer arithmetic only. */
export function cmp(a: Frac, b: Frac): number {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
}

export const eq = (a: Frac, b: Frac): boolean => cmp(a, b) === 0;

export function add(a: Frac, b: Frac): Frac {
  return frac(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function isIntegerFrac(a: Frac): boolean {
  return a.d === 1;
}

/**
 * Parse an orb label back to its exact value. Accepts:
 *   `12`  `7 + 5`  `20 − 8`  `3 × 4`  `48 ÷ 4`  `3/4`
 * `/` is always a fraction bar; division is always `÷`. Returns null for
 * anything it does not fully understand, so a test can assert on null rather
 * than silently trusting a bad parse.
 */
export function parseLabel(label: string): Frac | null {
  const s = label.trim();

  const fracMatch = /^(-?\d+)\/(\d+)$/.exec(s);
  if (fracMatch) {
    const n = Number(fracMatch[1]);
    const d = Number(fracMatch[2]);
    if (d === 0) return null;
    return frac(n, d);
  }

  const intMatch = /^-?\d+$/.exec(s);
  if (intMatch) return int(Number(s));

  const opMatch = new RegExp(`^(-?\\d+)\\s*([+${MINUS}${TIMES}${DIVIDE}])\\s*(-?\\d+)$`).exec(s);
  if (!opMatch) return null;
  const a = Number(opMatch[1]);
  const op = opMatch[2];
  const b = Number(opMatch[3]);
  switch (op) {
    case "+":
      return int(a + b);
    case MINUS:
      return int(a - b);
    case TIMES:
      return int(a * b);
    case DIVIDE:
      if (b === 0) return null;
      return frac(a, b);
    default:
      return null;
  }
}

/** How a condition is written on the arena floor, and what it accepts. */
export type Predicate =
  | { kind: "eq"; target: Frac }
  | { kind: "multiple"; base: number }
  | { kind: "gt"; ref: Frac }
  | { kind: "lt"; ref: Frac };

export function satisfies(p: Predicate, v: Frac): boolean {
  switch (p.kind) {
    case "eq":
      return eq(v, p.target);
    case "multiple":
      // Exact: v must be a whole number and a whole multiple of base.
      return v.d === 1 && v.n !== 0 && v.n % p.base === 0;
    case "gt":
      return cmp(v, p.ref) > 0;
    case "lt":
      return cmp(v, p.ref) < 0;
  }
}

/** The prompt string, which is also what the floor renders. */
export function promptFor(p: Predicate): string {
  switch (p.kind) {
    case "eq":
      return `= ${fracLabel(p.target)}`;
    case "multiple":
      return `${p.base} ${TIMES} ?`;
    case "gt":
      return `> ${fracLabel(p.ref)}`;
    case "lt":
      return `< ${fracLabel(p.ref)}`;
  }
}

/** A stable identity for a predicate — the game uses it to detect a mutation. */
export function predicateKey(p: Predicate): string {
  switch (p.kind) {
    case "eq":
      return `eq:${p.target.n}/${p.target.d}`;
    case "multiple":
      return `mul:${p.base}`;
    case "gt":
      return `gt:${p.ref.n}/${p.ref.d}`;
    case "lt":
      return `lt:${p.ref.n}/${p.ref.d}`;
  }
}

export function fracLabel(f: Frac): string {
  return f.d === 1 ? String(f.n) : `${f.n}/${f.d}`;
}
