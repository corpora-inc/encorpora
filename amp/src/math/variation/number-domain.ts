import { defineAxis } from "./axes";

/**
 * Number-domain adapters.
 *
 * 1. Rational display domains: one exact rational value written as an
 *    integer, fraction, mixed number, decimal, or with its sign shown.
 * 2. An exact real model for expressions built from rationals, π and square
 *    or cube roots, with sums, products, quotients by a single term and integer
 *    powers. A value is a sum of terms c·π^p·ᵏ√r (r reduced: no k-th power
 *    factor). π is transcendental and distinct reduced radicals are linearly
 *    independent over ℚ, so a value is rational exactly when its normalized
 *    form is a single term with p = 0 and no radical.
 */
export const numberDomainAxis = defineAxis("number-domain", [
  "integers",
  "fractions",
  "decimals",
  "negatives",
  "roots-and-pi",
  "with-powers",
]);
export type NumberDomain = (typeof numberDomainAxis.values)[number];

export type Rational = readonly [number, number];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
export const q = (n: number, d = 1): Rational => {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0)
    throw new Error("Rationals need safe integers and a nonzero denominator");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
const qmul = (a: Rational, b: Rational) => q(a[0] * b[0], a[1] * b[1]);
const qadd = (a: Rational, b: Rational) =>
  q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const qinv = (a: Rational) => q(a[1], a[0]);

/* ----------------------------------------------- rational display domains */

export type RationalStyle =
  "integer" | "fraction" | "mixed" | "decimal" | "signed";
/** The styles that can show a value exactly (decimal only if it terminates). */
export function rationalStyles(v: Rational): RationalStyle[] {
  const [n, d] = q(v[0], v[1]);
  let rest = d;
  for (const p of [2, 5]) while (rest % p === 0) rest /= p;
  return [
    ...(d === 1 ? (["integer"] as const) : (["fraction"] as const)),
    ...(d !== 1 && Math.abs(n) > d ? (["mixed"] as const) : []),
    ...(rest === 1 && d !== 1 ? (["decimal"] as const) : []),
    ...(n !== 0 ? (["signed"] as const) : []),
  ];
}
/** TeX for an exact rational in a display style. */
export function writeRational(v: Rational, style: RationalStyle): string {
  const [n, d] = q(v[0], v[1]);
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  switch (style) {
    case "integer":
      if (d !== 1) throw new Error("Not an integer");
      return `${n}`;
    case "fraction":
      return d === 1 ? `${n}` : `${sign}\\frac{${a}}{${d}}`;
    case "mixed": {
      const w = Math.floor(a / d),
        r = a % d;
      if (!r) return `${n}`;
      return w ? `${sign}${w}\\frac{${r}}{${d}}` : `${sign}\\frac{${r}}{${d}}`;
    }
    case "decimal": {
      let rest = d,
        places = 0;
      for (const p of [2, 5]) while (rest % p === 0) rest /= p;
      if (rest !== 1) throw new Error("Not a terminating decimal");
      while (10 ** places % d) places++;
      const scaled = (a * 10 ** places) / d;
      const digits = String(scaled).padStart(places + 1, "0");
      const body = places
        ? `${digits.slice(0, -places)}.${digits.slice(-places)}`
        : digits;
      return `${sign}${body}`;
    }
    case "signed":
      return n > 0
        ? `+${writeRational(v, d === 1 ? "integer" : "fraction")}`
        : writeRational(v, d === 1 ? "integer" : "fraction");
  }
}

/* -------------------------------------------------------- exact real model */

/** c·π^pi·ᵏ√radicand, radicand reduced; radicand 1 means no radical. */
export interface Term {
  c: Rational;
  pi: number;
  index: 2 | 3;
  radicand: number;
}
export type Real = readonly Term[];

/** n = s^k · r with r free of k-th powers. */
function extract(n: number, k: 2 | 3): { outside: number; inside: number } {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("Radicand ≥ 1");
  let outside = 1,
    inside = n;
  for (let p = 2; p ** k <= inside; p++)
    while (inside % p ** k === 0) {
      inside /= p ** k;
      outside *= p;
    }
  return { outside, inside };
}
const key = (t: Term) =>
  `${t.pi}|${t.radicand === 1 ? 1 : t.index}|${t.radicand}`;
function normalize(terms: readonly Term[]): Real {
  const sums = new Map<string, Term>();
  for (const raw of terms) {
    const t: Term = raw.radicand === 1 ? { ...raw, index: 2 } : raw;
    const old = sums.get(key(t));
    sums.set(key(t), old ? { ...old, c: qadd(old.c, t.c) } : t);
  }
  return [...sums.values()].filter((t) => t.c[0] !== 0);
}
export const rational = (n: number, d = 1): Real =>
  normalize([{ c: q(n, d), pi: 0, index: 2, radicand: 1 }]);
export const piReal: Real = [{ c: q(1), pi: 1, index: 2, radicand: 1 }];
export function rootReal(n: number, index: 2 | 3 = 2): Real {
  const { outside, inside } = extract(n, index);
  return normalize([{ c: q(outside), pi: 0, index, radicand: inside }]);
}
export const add = (a: Real, b: Real): Real => normalize([...a, ...b]);
export const neg = (a: Real): Real =>
  a.map((t) => ({ ...t, c: q(-t.c[0], t.c[1]) }));
export const sub = (a: Real, b: Real): Real => add(a, neg(b));
function mulTerm(a: Term, b: Term): Term {
  const c = qmul(a.c, b.c),
    pi = a.pi + b.pi;
  if (a.radicand === 1) return { c, pi, index: b.index, radicand: b.radicand };
  if (b.radicand === 1) return { c, pi, index: a.index, radicand: a.radicand };
  if (a.index !== b.index)
    throw new Error("Products of mixed root indexes are outside the model");
  const { outside, inside } = extract(a.radicand * b.radicand, a.index);
  return { c: qmul(c, q(outside)), pi, index: a.index, radicand: inside };
}
export const mul = (a: Real, b: Real): Real =>
  normalize(a.flatMap((x) => b.map((y) => mulTerm(x, y))));
/** Division by a single nonzero term (rationalizing its radical). */
export function div(a: Real, b: Real): Real {
  if (b.length !== 1) throw new Error("Divide only by a single term");
  const t = b[0]!;
  // 1/ᵏ√r = ᵏ√(r^(k-1)) / r
  const radical =
    t.radicand === 1
      ? rational(1)
      : rootReal(t.radicand ** (t.index - 1), t.index);
  const inverse = mul(
    [
      {
        c: qmul(qinv(t.c), q(1, t.radicand)),
        pi: -t.pi,
        index: 2,
        radicand: 1,
      },
    ],
    radical,
  );
  return mul(a, inverse);
}
export function pow(a: Real, k: number): Real {
  if (!Number.isInteger(k) || Math.abs(k) > 12) throw new Error("Bad power");
  let out = rational(1);
  for (let i = 0; i < Math.abs(k); i++) out = mul(out, a);
  return k < 0 ? div(rational(1), out) : out;
}
/** Rational exactly when the normalized value is 0 or one plain rational term. */
export const isRational = (a: Real): boolean =>
  a.length === 0 || (a.length === 1 && a[0]!.pi === 0 && a[0]!.radicand === 1);
export const rationalValue = (a: Real): Rational | null =>
  !isRational(a) ? null : a.length ? a[0]!.c : q(0);
export const approximate = (a: Real): number =>
  a.reduce(
    (s, t) =>
      s + (t.c[0] / t.c[1]) * Math.PI ** t.pi * t.radicand ** (1 / t.index),
    0,
  );

/* -------------------------------------------------- expressions and TeX */

/** An expression as written; its value comes from the exact model. */
export type Expr =
  | { k: "num"; n: number; d?: number }
  | { k: "pi" }
  | { k: "root"; n: number; index?: 2 | 3 }
  | { k: "add" | "sub" | "mul" | "frac"; a: Expr; b: Expr }
  | { k: "pow"; base: Expr; exp: number };
export const ex = {
  num: (n: number, d?: number): Expr => ({ k: "num", n, ...(d ? { d } : {}) }),
  pi: { k: "pi" } as Expr,
  root: (n: number, index: 2 | 3 = 2): Expr => ({ k: "root", n, index }),
  add: (a: Expr, b: Expr): Expr => ({ k: "add", a, b }),
  sub: (a: Expr, b: Expr): Expr => ({ k: "sub", a, b }),
  mul: (a: Expr, b: Expr): Expr => ({ k: "mul", a, b }),
  frac: (a: Expr, b: Expr): Expr => ({ k: "frac", a, b }),
  pow: (base: Expr, exp: number): Expr => ({ k: "pow", base, exp }),
};
export function valueOf(e: Expr): Real {
  switch (e.k) {
    case "num":
      return rational(e.n, e.d ?? 1);
    case "pi":
      return piReal;
    case "root":
      return rootReal(e.n, e.index ?? 2);
    case "add":
      return add(valueOf(e.a), valueOf(e.b));
    case "sub":
      return sub(valueOf(e.a), valueOf(e.b));
    case "mul":
      return mul(valueOf(e.a), valueOf(e.b));
    case "frac":
      return div(valueOf(e.a), valueOf(e.b));
    case "pow":
      return pow(valueOf(e.base), e.exp);
  }
}
const atomic = (e: Expr) =>
  e.k === "pi" || e.k === "root" || (e.k === "num" && !e.d && e.n >= 0);
/** TeX for an expression: 3\sqrt{2}, \pi^{2}, \left(\sqrt{5}\right)^{3}, \frac{…}{…}. */
export function tex(e: Expr): string {
  switch (e.k) {
    case "num":
      return e.d ? writeRational(q(e.n, e.d), "fraction") : `${e.n}`;
    case "pi":
      return "\\pi";
    case "root":
      return (e.index ?? 2) === 3 ? `\\sqrt[3]{${e.n}}` : `\\sqrt{${e.n}}`;
    case "add":
      return `${tex(e.a)}+${tex(e.b)}`;
    case "sub":
      return `${tex(e.a)}-${e.b.k === "add" || e.b.k === "sub" ? `\\left(${tex(e.b)}\\right)` : tex(e.b)}`;
    case "mul": {
      const wrap = (x: Expr) =>
        x.k === "add" || x.k === "sub" ? `\\left(${tex(x)}\\right)` : tex(x);
      // A leading whole number juxtaposes: 3\sqrt{2}, 2\pi; otherwise a dot.
      return e.a.k === "num" && !e.a.d && e.b.k !== "num"
        ? `${tex(e.a)}${wrap(e.b)}`
        : `${wrap(e.a)}\\cdot${wrap(e.b)}`;
    }
    case "frac":
      return `\\frac{${tex(e.a)}}{${tex(e.b)}}`;
    case "pow":
      return atomic(e.base) && e.base.k !== "root"
        ? `${tex(e.base)}^{${e.exp}}`
        : `\\left(${tex(e.base)}\\right)^{${e.exp}}`;
  }
}
/** A short exact statement of the value, for explanations: "5", "2\sqrt{2}", "\pi^{2}". */
export function texValue(a: Real): string {
  if (!a.length) return "0";
  return a
    .map((t, i) => {
      const [n, d] = t.c;
      const coefAbs =
        Math.abs(n) === 1 && d === 1
          ? ""
          : writeRational(q(Math.abs(n), d), "fraction");
      const piPart = t.pi === 0 ? "" : t.pi === 1 ? "\\pi" : `\\pi^{${t.pi}}`;
      const rad =
        t.radicand === 1
          ? ""
          : t.index === 3
            ? `\\sqrt[3]{${t.radicand}}`
            : `\\sqrt{${t.radicand}}`;
      const body = coefAbs + piPart + rad || "1";
      const sign = n < 0 ? "-" : i ? "+" : "";
      return `${sign}${body}`;
    })
    .join("");
}
