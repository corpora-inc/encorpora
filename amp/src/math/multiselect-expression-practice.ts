import type { GeneratedProblem } from "./contracts";
import { dispatch, pick } from "./chain-kit";
import { graph, numberLine, scene } from "./scene/author";
import type { Random } from "./variation/axes";
import {
  sample,
  selectFamily,
  selectModel,
  selectTemplate,
  st,
} from "./select-kit";
import type { Statement } from "./variation/statement-set";

/**
 * Select-every-true-statement families for expressions, equations and
 * relationships: story models, equal expressions, customary equivalents,
 * additive and multiplicative relationships, equivalent quadratic forms,
 * regression predictions, functions on a graph, roots on a number line and
 * statements about a dot plot. Each statement's truth is computed from the
 * numbers it states.
 */

/** Add each statement once, by label. */
function dedupe(pool: Statement[]): Statement[] {
  const seen = new Set<string>();
  return pool.filter((s) => (seen.has(s.label) ? false : !!seen.add(s.label)));
}

/* --------------------------------------------------------- story models */

export const storyExpressionTemplate = selectTemplate({
  id: "story-expression-select",
  title: "Select the expressions or sentences that fit a story",
  skillId: "multi-operation-stories",
  gradeBand: "3–5",
  difficultyOffset: 0.3,
  description:
    "Select every expression or number sentence that finds an unknown part of a story: a total with two parts taken away, or a part of a total whose other part is known.",
});

const removalStories = [
  {
    start: (t: number) => `A farm stand has $${t}$ apples.`,
    first: (a: number) => `It sells $${a}$ apples before noon`,
    second: (b: number) => `and $${b}$ apples after noon.`,
    ask: "How many apples are left?",
  },
  {
    start: (t: number) => `A library has $${t}$ new books on a cart.`,
    first: (a: number) => `Staff shelve $${a}$ books in the morning`,
    second: (b: number) => `and $${b}$ books in the afternoon.`,
    ask: "How many books are still on the cart?",
  },
  {
    start: (t: number) => `A school bought $${t}$ markers.`,
    first: (a: number) => `Grade 3 used $${a}$ markers`,
    second: (b: number) => `and grade 4 used $${b}$ markers.`,
    ask: "How many markers are left?",
  },
];
const partStories = [
  {
    total: (t: number) => `A trip is $${t}$ miles long.`,
    known: (k: number) => `There are $${k}$ miles left to drive.`,
    ask: "Select the number sentences that can find the number of miles already driven.",
    unit: "miles already driven",
  },
  {
    total: (t: number) => `A book has $${t}$ pages.`,
    known: (k: number) => `Maya has $${k}$ pages left to read.`,
    ask: "Select the number sentences that can find the number of pages Maya has already read.",
    unit: "pages already read",
  },
  {
    total: (t: number) => `A sticker album holds $${t}$ stickers.`,
    known: (k: number) => `There are $${k}$ empty spaces.`,
    ask: "Select the number sentences that can find the number of spaces already filled.",
    unit: "spaces already filled",
  },
];

function storyExpression(r: Random) {
  const variant = pick(r, ["two-removals", "unknown-part"]);
  if (variant === "two-removals") {
    // T exceeds the two amounts taken away (at most 280) so some remain.
    const T = r(300, 600);
    const a = r(30, 140);
    const b = r(30, 140);
    const left = T - a - b;
    const s = pick(r, removalStories);
    const forms: { tex: string; value: number }[] = [
      { tex: `${T}-${a}-${b}`, value: T - a - b },
      { tex: `${T}-${b}-${a}`, value: T - b - a },
      { tex: `${T}-(${a}+${b})`, value: T - (a + b) },
      { tex: `(${T}-${a})-${b}`, value: T - a - b },
      { tex: `${T}-${a}+${b}`, value: T - a + b },
      { tex: `${T}+${a}-${b}`, value: T + a - b },
      { tex: `${a}+${b}-${T}`, value: a + b - T },
      { tex: `${T}-(${a}-${b})`, value: T - (a - b) },
      { tex: `${a}+${b}`, value: a + b },
      { tex: `${T}+${a}+${b}`, value: T + a + b },
      { tex: `${T}-${a}`, value: T - a },
    ];
    const pool = dedupe(
      forms.map((f) =>
        st(
          `$${f.tex}$`,
          f.value === left,
          f.value === left
            ? `$${f.tex}=${f.value}$, the number left after both amounts are taken away.`
            : `$${f.tex}=${f.value}$, not the $${left}$ that remain after $${a}$ and $${b}$ are both taken from $${T}$.`,
        ),
      ),
    );
    return selectModel({
      variant,
      pool,
      total: 5,
      k: r(2, 3),
      context: `${s.start(T)} ${s.first(a)} ${s.second(b)} ${s.ask}`,
      ask: (k) => `Select the ${k} expressions that find the answer.`,
      one: "expression",
      hint: () =>
        `Start with the whole, $${T}$. Both $${a}$ and $${b}$ are taken away from it, so the amount left is smaller than $${T}$. Which expressions take away both amounts, one after the other or together?`,
    });
  }
  const T = r(120, 480);
  const known = r(20, T - 20);
  const answer = T - known;
  const s = pick(r, partStories);
  const box = "\\square";
  // value of the unknown box that makes each sentence true
  const sentences: { tex: string; value: number }[] = [
    { tex: `${T}-${known}=${box}`, value: T - known },
    { tex: `${box}+${known}=${T}`, value: T - known },
    { tex: `${known}+${box}=${T}`, value: T - known },
    { tex: `${T}-${box}=${known}`, value: T - known },
    { tex: `${T}+${known}=${box}`, value: T + known },
    { tex: `${box}-${known}=${T}`, value: T + known },
    { tex: `${known}+${T}=${box}`, value: T + known },
    { tex: `${known}-${T}=${box}`, value: known - T },
    { tex: `${box}+${T}=${known}`, value: known - T },
    { tex: `${box}-${T}=${known}`, value: T + known },
  ];
  const pool = dedupe(
    sentences.map((f) =>
      st(
        `$${f.tex}$`,
        f.value === answer,
        f.value === answer
          ? `The $${box}$ in $${f.tex}$ is $${f.value}$, the ${s.unit}.`
          : `The $${box}$ in $${f.tex}$ is $${f.value}$, which is not the ${s.unit}.`,
      ),
    ),
  );
  return selectModel({
    variant,
    pool,
    total: 5,
    k: r(2, 3),
    context: `${s.total(T)} ${s.known(known)} Let $${box}$ stand for the ${s.unit}.`,
    ask: (k) => `Select the ${k} number sentences that can find $${box}$.`,
    one: "number sentence",
    plural: "number sentences",
    hint: () =>
      `The whole is $${T}$ and one part is $${known}$. Say the story with $${box}$: the part with the unknown plus the part you know makes the whole, or the whole take away the known part leaves the unknown.`,
  });
}

/* ------------------------------------------------------ equal expressions */

export const equalExpressionTemplate = selectTemplate({
  id: "equal-expression-select",
  title: "Select the expressions with the same value",
  skillId: "numerical-expressions",
  gradeBand: "3–5",
  difficultyOffset: 0.3,
  description:
    "Select every expression with the same value as one that has a subtraction inside parentheses, among rewrites that move or drop the parentheses.",
});

type Ex = number | { o: "+" | "-" | "×" | "÷"; l: Ex; r: Ex } | { p: Ex };
const bin = (l: Ex, o: "+" | "-" | "×" | "÷", r: Ex): Ex => ({ o, l, r });
const paren = (e: Ex): Ex => ({ p: e });
const prec = (e: Ex): number =>
  typeof e === "number" || "p" in e ? 3 : e.o === "+" || e.o === "-" ? 1 : 2;
const opTex = { "+": "+", "-": "-", "×": "\\times", "÷": "\\div" } as const;
function exTex(e: Ex, parent = 0, rightOfNonAssoc = false): string {
  if (typeof e === "number") return String(e);
  if ("p" in e) return `(${exTex(e.p)})`;
  const own = prec(e);
  const body = `${exTex(e.l, own)}${opTex[e.o]}${exTex(e.r, own, e.o === "-" || e.o === "÷")}`;
  return own < parent || (own === parent && rightOfNonAssoc)
    ? `(${body})`
    : body;
}
type Fr = [number, number];
const fgcd = (a: number, b: number): number =>
  b ? fgcd(b, a % b) : Math.abs(a);
const norm = ([n, d]: Fr): Fr => {
  const g = fgcd(n, d) || 1;
  return d < 0 ? [-n / g, -d / g] : [n / g, d / g];
};
function exVal(e: Ex): Fr {
  if (typeof e === "number") return [e, 1];
  if ("p" in e) return exVal(e.p);
  const [a, b] = exVal(e.l);
  const [c, d] = exVal(e.r);
  switch (e.o) {
    case "+":
      return norm([a * d + c * b, b * d]);
    case "-":
      return norm([a * d - c * b, b * d]);
    case "×":
      return norm([a * c, b * d]);
    case "÷":
      return c === 0 ? [Number.NaN, 1] : norm([a * d, b * c]);
  }
}
const sameVal = (x: Ex, y: Ex) => {
  const [a, b] = exVal(x);
  const [c, d] = exVal(y);
  return a === c && b === d;
};
const fmtVal = ([n, d]: Fr) => (d === 1 ? String(n) : `\\frac{${n}}{${d}}`);

function equalExpression(r: Random) {
  const variant = pick(r, [
    "multiplied-difference",
    "added-difference",
    "divided-difference",
  ]);
  let base: Ex;
  let cands: Ex[];
  let hintStep: string;
  if (variant === "multiplied-difference") {
    const a = r(3, 9);
    const c = r(2, 6);
    const b = c + r(3, 9);
    base = bin(a, "×", paren(bin(b, "-", c)));
    cands = [
      bin(paren(bin(b, "-", c)), "×", a),
      bin(bin(a, "×", b), "-", bin(a, "×", c)),
      bin(bin(a, "×", b), "-", c),
      bin(bin(a, "×", b), "+", bin(a, "×", c)),
      bin(a, "×", paren(bin(b, "+", c))),
      bin(bin(a, "-", c), "×", b),
      bin(paren(bin(b, "-", c)), "+", a),
      bin(a, "×", b),
      bin(bin(a, "×", c), "-", bin(a, "×", b)),
    ];
    hintStep = `Do the subtraction $${b}-${c}$ in the parentheses first, then multiply by $${a}$. To test a rewrite, find its value the same way, doing parentheses, then multiplication and division, then addition and subtraction.`;
  } else if (variant === "added-difference") {
    const a = r(4, 20);
    const c = r(2, 8);
    const b = c + r(3, 12);
    base = bin(a, "+", paren(bin(b, "-", c)));
    cands = [
      bin(bin(a, "+", b), "-", c),
      bin(paren(bin(b, "-", c)), "+", a),
      bin(bin(a, "-", c), "+", b),
      bin(a, "+", bin(b, "+", c)),
      bin(bin(a, "-", b), "+", c),
      bin(a, "-", paren(bin(b, "-", c))),
      bin(bin(a, "+", b), "+", c),
      bin(a, "-", bin(b, "+", c)),
      bin(bin(a, "+", c), "-", b),
    ];
    hintStep = `Find $${b}-${c}$ first because it is in parentheses, then add $${a}$. Work out each choice in the order its parentheses and operations require and compare the values.`;
  } else {
    const d = pick(r, [2, 3, 4, 5, 6]);
    const m2 = r(2, 5);
    const m1 = m2 + r(2, 6);
    const b = d * m1;
    const c = d * m2;
    base = bin(paren(bin(b, "-", c)), "÷", d);
    cands = [
      bin(bin(b, "÷", d), "-", bin(c, "÷", d)),
      bin(paren(bin(b, "÷", d)), "-", paren(bin(c, "÷", d))),
      bin(b, "-", bin(c, "÷", d)),
      bin(bin(b, "÷", d), "-", c),
      bin(paren(bin(b, "+", c)), "÷", d),
      bin(d, "÷", paren(bin(b, "-", c))),
      bin(paren(bin(b, "-", c)), "×", d),
      bin(bin(b, "÷", d), "+", bin(c, "÷", d)),
    ];
    hintStep = `Subtract $${b}-${c}$ inside the parentheses first, then divide by $${d}$. When you test a rewrite, divide before you subtract if the division comes first in the order of operations.`;
  }
  const baseTex = exTex(base);
  const value = exVal(base);
  const pool = dedupe(
    cands
      .filter((c) => !Number.isNaN(exVal(c)[0]) && exTex(c) !== baseTex)
      .map((c) => {
        const holds = sameVal(c, base);
        const v = exVal(c);
        return st(
          `$${exTex(c)}$`,
          holds,
          holds
            ? `$${exTex(c)}=${fmtVal(v)}$, the same as $${baseTex}=${fmtVal(value)}$.`
            : `$${exTex(c)}=${fmtVal(v)}$, not $${fmtVal(value)}$.`,
        );
      }),
  );
  return selectModel({
    variant,
    pool,
    total: 5,
    k: r(2, 3),
    context: `Look at the expression $${baseTex}$.`,
    ask: (k) => `Select the ${k} expressions that have the same value.`,
    one: "expression",
    hint: () => hintStep,
  });
}

/* ----------------------------------------------------- customary units */

export const customaryEquivalentTemplate = selectTemplate({
  id: "customary-equivalent-select",
  title: "Select the equal customary measurements",
  skillId: "unit-conversion",
  gradeBand: "3–5",
  difficultyOffset: 0.4,
  description:
    "Select every measurement equal to a stated length, capacity or weight, written in one unit or in two units such as feet and inches.",
});

interface Unit {
  one: string;
  many: string;
  size: number;
}
const unitSets: Record<
  string,
  { units: Unit[]; targets: number[]; big: number }
> = {
  length: {
    units: [
      { one: "yard", many: "yards", size: 36 },
      { one: "foot", many: "feet", size: 12 },
      { one: "inch", many: "inches", size: 1 },
    ],
    targets: [2, 3, 4, 5, 6, 7, 8],
    big: 0,
  },
  capacity: {
    units: [
      { one: "gallon", many: "gallons", size: 16 },
      { one: "quart", many: "quarts", size: 4 },
      { one: "pint", many: "pints", size: 2 },
      { one: "cup", many: "cups", size: 1 },
    ],
    targets: [2, 3, 4, 5, 6],
    big: 0,
  },
  weight: {
    units: [
      { one: "pound", many: "pounds", size: 16 },
      { one: "ounce", many: "ounces", size: 1 },
    ],
    targets: [2, 3, 4, 5, 6, 7, 8, 9],
    big: 0,
  },
};
const amount = (n: number, u: Unit) => `$${n}$ ${n === 1 ? u.one : u.many}`;

function customaryEquivalent(r: Random) {
  const variant = pick(r, ["length", "capacity", "weight"]);
  const set = unitSets[variant]!;
  const target = pick(r, set.targets);
  const top = set.units[0]!;
  const total = target * top.size;
  const forms: { text: string; value: number }[] = [];
  const add = (parts: [number, Unit][]) => {
    if (parts.some(([n]) => n < 0)) return;
    const body = parts
      .filter(([n]) => n > 0)
      .map(([n, u]) => amount(n, u))
      .join(" ");
    if (!body) return;
    forms.push({
      text: body,
      value: parts.reduce((s, [n, u]) => s + n * u.size, 0),
    });
  };
  const small = set.units.slice(1);
  for (const u of small) {
    add([[total / u.size, u]]);
    add([[total / u.size + 1, u]]);
    add([[total / u.size - 1, u]]);
    // a conversion with the next unit's size used in place of this one's
    add([[target * (top.size / (u.size === 1 ? 2 : 1)), u]]);
  }
  // two-unit forms: one fewer of the largest unit plus the remainder
  for (let i = 0; i < set.units.length - 1; i++) {
    const big = set.units[i]!;
    for (let j = i + 1; j < set.units.length; j++) {
      const little = set.units[j]!;
      for (const give of [1, 2]) {
        const bigCount = Math.floor(total / big.size) - give;
        if (bigCount < 1) continue;
        const rest = total - bigCount * big.size;
        if (rest % little.size) continue;
        add([
          [bigCount, big],
          [rest / little.size, little],
        ]);
        add([
          [bigCount, big],
          [rest / little.size + 1, little],
        ]);
        add([
          [bigCount + 1, big],
          [rest / little.size, little],
        ]);
        add([
          [bigCount, big],
          [Math.max(0, rest / little.size - 1), little],
        ]);
      }
    }
  }
  const unitName = (n: number) =>
    n === 1
      ? set.units[set.units.length - 1]!.one
      : set.units[set.units.length - 1]!.many;
  const pool = dedupe(
    forms.map((f) =>
      st(
        f.text,
        f.value === total,
        f.value === total
          ? `${f.text} is $${f.value}$ ${unitName(f.value)}, the same as ${amount(target, top)}, which is $${target}\\times${top.size}=${total}$ ${unitName(total)}.`
          : `${f.text} is $${f.value}$ ${unitName(f.value)}, not $${total}$.`,
      ),
    ),
  );
  const last = set.units[set.units.length - 1]!;
  return selectModel({
    variant,
    pool,
    total: 5,
    k: r(2, 3),
    context: "",
    ask: (k) =>
      `Select the ${k} measurements that are equal to ${amount(target, top)}.`,
    one: "measurement",
    hint: () =>
      `Change ${amount(target, top)} into ${last.many}, the smallest unit in the choices: there are ${set.units.map((u, i) => (i ? "" : `$${u.size}$ ${last.many} in 1 ${u.one}`)).join("")}. Change each choice into ${last.many} too and compare.`,
  });
}

/* ------------------------------------- additive or multiplicative rules */

export const additiveMultiplicativeTemplate = selectTemplate({
  id: "additive-multiplicative-select",
  title: "Select the true statements about two rules",
  skillId: "related-patterns",
  gradeBand: "3–5",
  difficultyOffset: 0.3,
  description:
    "Select every true statement about one multiplicative rule, $y$ equals a number times $x$, and one additive rule, $y$ equals $x$ plus a number, including the value of $y$ for a given $x$.",
});

function additiveMultiplicative(r: Random) {
  const m = r(2, 9);
  const c = r(2, 9);
  const mult = (x: number) => m * x;
  const add = (x: number) => x + c;
  const xs = [1, 2, 3, 4, 5, 6];
  const times = (f: (x: number) => number, k: number) =>
    xs.every((x) => f(x) === k * x);
  const more = (f: (x: number) => number, k: number) =>
    xs.every((x) => f(x) === x + k);
  const isMult = (f: (x: number) => number) =>
    f(1) >= 2 && xs.every((x) => f(x) === f(1) * x);
  const isAdd = (f: (x: number) => number) =>
    f(1) >= 2 && xs.every((x) => f(x) - x === f(1) - 1);
  const rules = [
    { name: `y=${m}x`, f: mult },
    { name: `y=x+${c}`, f: add },
  ] as const;
  const pool: Statement[] = [];
  for (const { name, f } of rules) {
    pool.push(
      st(
        `$${name}$ is a multiplicative rule`,
        isMult(f),
        isMult(f)
          ? `Every $y$ is the same number times $x$.`
          : `The values of $y$ are not a constant number times $x$: for $x=1$ and $x=2$, $y$ is $${f(1)}$ and $${f(2)}$.`,
      ),
      st(
        `$${name}$ is an additive rule`,
        isAdd(f),
        isAdd(f)
          ? `Every $y$ is $x$ plus the same number.`
          : `$y-x$ is not the same for every $x$: it is $${f(1) - 1}$ for $x=1$ and $${f(2) - 2}$ for $x=2$.`,
      ),
    );
    for (const k of [m, c]) {
      pool.push(
        st(
          `In $${name}$, $y$ is always $${k}$ times $x$`,
          times(f, k),
          times(f, k)
            ? `$y=${k}x$ for every $x$.`
            : `For $x=2$, $y=${f(2)}$, and $${k}\\times2=${k * 2}$.`,
        ),
        st(
          `In $${name}$, $y$ is always $${k}$ more than $x$`,
          more(f, k),
          more(f, k)
            ? `$y=x+${k}$ for every $x$.`
            : `For $x=2$, $y=${f(2)}$, and $2+${k}=${2 + k}$.`,
        ),
      );
    }
    for (const x of [3, 4, 5]) {
      for (const v of [f(x), x + m, m * x + c - c + x, c * x, x + c + m].filter(
        (v, i, a) => a.indexOf(v) === i,
      )) {
        pool.push(
          st(
            `In $${name}$, when $x=${x}$, $y=${v}$`,
            f(x) === v,
            f(x) === v
              ? `Substituting $x=${x}$ gives $y=${v}$.`
              : `Substituting $x=${x}$ gives $y=${f(x)}$, not $${v}$.`,
          ),
        );
      }
    }
  }
  return selectModel({
    variant: m === c ? "same-number" : "different-numbers",
    pool: dedupe(pool),
    total: 6,
    k: r(2, 3),
    context: `Two rules relate $x$ and $y$: $y=${m}x$ and $y=x+${c}$. A rule is multiplicative when $y$ is always the same number times $x$, and additive when $y$ is always $x$ plus the same number.`,
    ask: (k) => `Select the ${k} true statements.`,
    hint: () =>
      `Try the rules with two values of $x$, such as $x=1$ and $x=2$. In $y=${m}x$, see how $y$ changes as $x$ goes up by $1$; do the same for $y=x+${c}$, and decide whether each statement describes what you see.`,
  });
}

/* --------------------------------------------- equivalent quadratic forms */

export const equivalentTrinomialTemplate = selectTemplate({
  id: "equivalent-trinomial-select",
  title: "Select the equivalent factored and expanded forms",
  skillId: "factor-quadratics",
  gradeBand: "9–12",
  difficultyOffset: 0.2,
  description:
    "Select every expression equal to a trinomial, or to a product of two binomials, among factored, partly distributed and expanded forms with sign and cross-term errors.",
});

type Poly = [number, number, number];
const term = (c: number, v: string, first: boolean) => {
  const abs = Math.abs(c);
  const body = abs === 1 && v ? v : `${abs}${v}`;
  return `${c < 0 ? "-" : first ? "" : "+"}${body}`;
};
const polyTex = (p: Poly) => {
  let out = "";
  [
    [p[0], "x^2"],
    [p[1], "x"],
    [p[2], ""],
  ].forEach(([c, v]) => {
    if (c !== 0) out += term(c as number, v as string, out === "");
  });
  return out || "0";
};
const lin = (p: number, q: number) => `(${polyTex([0, p, q])})`;
const mulLin = (p: number, q: number, rr: number, s: number): Poly => [
  p * rr,
  p * s + q * rr,
  q * s,
];
const eqPoly = (x: Poly, y: Poly) => x.every((v, i) => v === y[i]);

/** Teaching lines around the verdicts; the family oracle rebuilds them from
 * the prompt, so change both together. */
export const trinomialLead = (variant: string, givenTex: string) => [
  variant === "given-trinomial"
    ? `Two expressions are equivalent when they are equal for every value of $x$. To check, expand each choice and compare it with $${givenTex}$.`
    : `Two expressions are equivalent when they are equal for every value of $x$. To check, expand $${givenTex}$ and each choice, then compare.`,
  "To expand a product of two binomials (expressions with two terms), multiply every term of one by every term of the other. Then combine like terms, the terms with the same power of $x$.",
];
export const trinomialTail =
  "So the equivalent expressions are exactly the ones that expand to the same $x^2$ term, $x$ term and constant term.";

function equivalentTrinomial(r: Random) {
  const variant = pick(r, ["given-trinomial", "given-factored"]);
  let p = 1;
  let rr = 1;
  let q = 0;
  let s = 0;
  for (let g = 0; g < 200; g++) {
    p = pick(r, [1, 1, 1, 2, 3]);
    rr = pick(r, [1, 1, 2, 3]);
    q = (r(0, 1) ? 1 : -1) * r(1, 9);
    s = (r(0, 1) ? 1 : -1) * r(1, 9);
    const t = mulLin(p, q, rr, s);
    if (t[1] !== 0 && t[2] !== 0 && q !== s) break;
  }
  const target = mulLin(p, q, rr, s);
  const [a, b, c] = target;
  /** `fits` says why a matching form matches; `slip` names the error in a
   * form that does not match. */
  type Cand = { tex: string; poly: Poly; fits?: string; slip?: string };
  const f1: Cand = { tex: `${lin(p, q)}${lin(rr, s)}`, poly: target };
  const middle = "$x$ coefficient (the number multiplying $x$)";
  const cands: Cand[] = [
    f1,
    {
      tex: `${lin(-p, -q)}${lin(-rr, -s)}`,
      poly: mulLin(-p, -q, -rr, -s),
      fits: "Both factors have every sign changed, and two sign changes cancel in a product.",
    },
    {
      tex: `${polyTex([0, p, 0])}${lin(rr, s)}${q < 0 ? "-" : "+"}${Math.abs(q)}${lin(rr, s)}`,
      poly: [p * rr, p * s + q * rr, q * s],
      fits: "It is each term of the first factor times the whole second factor, a step partway through expanding.",
    },
    {
      tex: `${polyTex([p * rr, 0, 0])}${term(p * s, "x", false)}${term(q * rr, "x", false)}${term(q * s, "", false)}`,
      poly: [p * rr, p * s + q * rr, q * s],
      fits: "It is the four products before the two $x$ terms are combined.",
    },
    { tex: `x${lin(a, b)}${term(c, "", false)}`, poly: [a, b, c] },
    // errors
    {
      tex: `${lin(p, q)}${lin(rr, -s)}`,
      poly: mulLin(p, q, rr, -s),
      slip: "The constant in the second factor has the wrong sign.",
    },
    {
      tex: `${lin(p, s)}${lin(rr, q)}`,
      poly: mulLin(p, s, rr, q),
      slip: "The two constants are swapped between the factors.",
    },
    {
      tex: `${lin(p, -q)}${lin(rr, s)}`,
      poly: mulLin(p, -q, rr, s),
      slip: "The constant in the first factor has the wrong sign.",
    },
    {
      tex: `${lin(-p, -q)}${lin(rr, s)}`,
      poly: mulLin(-p, -q, rr, s),
      slip: "Only one factor has its signs changed, which changes the sign of the whole product.",
    },
    {
      tex: `${polyTex([0, p, 0])}${lin(rr, s)}${q < 0 ? "+" : "-"}${Math.abs(q)}${lin(rr, s)}`,
      poly: [p * rr, p * s - q * rr, -q * s],
      slip: "The second part has the wrong sign: the constant of the first factor keeps its own sign.",
    },
    {
      tex: `${polyTex([p * rr, 0, 0])}${term(p * s, "x", false)}${term(-q * rr, "x", false)}${term(q * s, "", false)}`,
      poly: [p * rr, p * s - q * rr, q * s],
      slip: "One of the two middle products has the wrong sign.",
    },
    {
      tex: `x${lin(a, b + 1)}${term(c, "", false)}`,
      poly: [a, b + 1, c],
      slip: `Its ${middle} is one more than it should be.`,
    },
    {
      tex: `x${lin(a, b)}${term(-c, "", false)}`,
      poly: [a, b, -c],
      slip: "Its constant term has the wrong sign.",
    },
    {
      tex: `x${lin(a, c)}${term(b, "", false)}`,
      poly: [a, c, b],
      slip: `It swaps the ${middle} and the constant term.`,
    },
  ];
  let shown: Cand[];
  let givenTex: string;
  if (variant === "given-trinomial") {
    givenTex = polyTex(target);
    shown = cands;
  } else {
    givenTex = f1.tex;
    const std: Cand[] = [
      { tex: polyTex(target), poly: target },
      {
        tex: polyTex([a, c, b]),
        poly: [a, c, b],
        slip: `It swaps the ${middle} and the constant term.`,
      },
      {
        tex: polyTex([a, -b, c]),
        poly: [a, -b, c],
        slip: `Its ${middle} has the wrong sign.`,
      },
      {
        tex: polyTex([a, b, -c]),
        poly: [a, b, -c],
        slip: "Its constant term has the wrong sign.",
      },
      {
        tex: polyTex([a, b + 1, c]),
        poly: [a, b + 1, c],
        slip: `Its ${middle} is one more than it should be.`,
      },
    ];
    shown = [...std, ...cands.slice(2)];
  }
  // Two wrong forms that expand to one polynomial are one distractor twice.
  const wrongSeen = new Set<string>();
  const pool = dedupe(
    shown
      .filter((x) => x.tex !== givenTex)
      .filter(
        (x) =>
          eqPoly(x.poly, target) ||
          (!wrongSeen.has(x.poly.join(",")) &&
            !!wrongSeen.add(x.poly.join(","))),
      )
      .map((x) => {
        const holds = eqPoly(x.poly, target);
        const expanded = x.tex === polyTex(x.poly);
        // A slip that happens to give the same product is not a slip.
        const why = holds ? x.fits : x.slip;
        const note = why ? ` ${why}` : "";
        return st(
          `$${x.tex}$`,
          holds,
          holds
            ? expanded
              ? `Multiplying out $${givenTex}$ and combining like terms gives exactly $${x.tex}$.`
              : `Expanding $${x.tex}$ gives $${polyTex(target)}$, the same trinomial.${note}`
            : expanded
              ? `$${x.tex}$ is a different trinomial from $${polyTex(target)}$.${note}`
              : `Expanding $${x.tex}$ gives $${polyTex(x.poly)}$, not $${polyTex(target)}$.${note}`,
        );
      }),
  );
  return selectModel({
    variant,
    pool,
    total: 5,
    k: r(2, 3),
    lead: trinomialLead(variant, givenTex),
    tail: [trinomialTail],
    context:
      variant === "given-trinomial"
        ? `Look at the trinomial $${givenTex}$.`
        : `Look at the product $${givenTex}$.`,
    ask: (k) => `Select the ${k} expressions that are equivalent to it.`,
    one: "expression",
    hint: () =>
      variant === "given-trinomial"
        ? `Expand each choice: multiply every term of one factor by every term of the other and combine the $x$ terms. The $x^2$ term must be $${a === 1 ? "" : a}x^2$ and the constant term must be $${c}$.`
        : `Expand $${givenTex}$ first: multiply every term of one factor by every term of the other, then combine the $x$ terms. Compare that with each choice, also expanded if it is not already.`,
  });
}

/* ---------------------------------------------------- regression predictions */

export const regressionPredictionTemplate = selectTemplate({
  id: "regression-prediction-select",
  title: "Select the true predictions from a fitted line",
  skillId: "regression-interpretation",
  gradeBand: "9–12",
  difficultyOffset: 0.2,
  description:
    "Select every true statement about the predictions and the meaning of the slope and intercept of a stated line of best fit.",
});

const regContexts = [
  {
    x: "hours studied",
    xu: "hour",
    y: "test score",
    yu: "points",
    who: "A student who studies for",
  },
  {
    x: "hours of practice",
    xu: "hour",
    y: "free throws made",
    yu: "free throws",
    who: "A player who practices for",
  },
  {
    x: "minutes of exercise",
    xu: "minute",
    y: "calories burned",
    yu: "calories",
    who: "A person who exercises for",
  },
];
/** Teaching lines around the verdicts; the family oracle rebuilds them from
 * the prompt, so change both together. */
export const regressionLead = (
  eq: string,
  slope: string,
  intercept: string,
) => [
  `A line of best fit is a line drawn close to the data points. In $${eq}$, $\\hat{y}$, read "$y$-hat", is the predicted value for an input $x$.`,
  `The slope, the number multiplying $x$, is $${slope}$. It is the predicted change in $\\hat{y}$ when $x$ goes up by $1$.`,
  `The intercept, the number added on, is $${intercept}$. It is the prediction at $x=0$.`,
  "To predict, substitute the value of $x$ and work out $\\hat{y}$.",
];
export const regressionTail =
  "So the true statements are exactly the ones that match the line's predictions, its slope and its intercept.";

function regressionPrediction(r: Random) {
  const c = pick(r, regContexts);
  const negative = r(0, 1) === 1;
  // Tenths so every prediction is an exact one-decimal number.
  const mT = (negative ? -1 : 1) * r(12, 48);
  // The line stays above zero through x = 8: no true prediction is negative.
  const bT = r(Math.max(300, Math.abs(mT) * 8), 700);
  const fmt = (t: number) => (t / 10).toFixed(1);
  const pred = (x: number) => mT * x + bT; // tenths
  const eq = `\\hat{y}=${mT < 0 ? "-" : ""}${fmt(Math.abs(mT))}x+${fmt(bT)}`;
  const pool: Statement[] = [];
  const work = (x: number) =>
    `$\\hat{y}=${fmt(mT)}(${x})+${fmt(bT)}=${fmt(pred(x))}$`;
  for (const x of [2, 4, 6, 8]) {
    const slips = new Map<number, string>([
      [
        mT * x,
        ` $${fmt(mT * x)}$ is only the slope times $${x}$. It leaves out the intercept, $${fmt(bT)}$.`,
      ],
      [
        pred(x) + mT,
        ` $${fmt(pred(x) + mT)}$ is the prediction for $${x + 1}$ ${c.xu}s, one ${c.xu} too many.`,
      ],
      [
        bT - mT * x,
        ` $${fmt(bT - mT * x)}$ subtracts the slope times $${x}$ instead of adding it.`,
      ],
    ]);
    for (const v of [pred(x), mT * x, pred(x) + mT, bT - mT * x]) {
      pool.push(
        st(
          `The line predicts $${fmt(v)}$ ${c.yu} for $${x}$ ${x === 1 ? c.xu : `${c.xu}s`}`,
          v === pred(x),
          v === pred(x)
            ? `Substituting $x=${x}$ gives ${work(x)}.`
            : `Substituting $x=${x}$ gives ${work(x)}, not $${fmt(v)}$.${slips.get(v) ?? ""}`,
        ),
      );
    }
  }
  for (const v of [mT, -mT, bT, mT + 10]) {
    pool.push(
      st(
        `Each added ${c.xu} changes the predicted ${c.y} by $${fmt(v)}$`,
        v === mT,
        v === mT
          ? `The slope, the number multiplying $x$, is $${fmt(mT)}$. It is the predicted change in $\\hat{y}$ for each added ${c.xu}.`
          : `The predicted change per added ${c.xu} is the slope, the number multiplying $x$, which is $${fmt(mT)}$.${v === -mT ? " This statement has the opposite sign." : v === bT ? ` $${fmt(bT)}$ is the intercept, the prediction at $x=0$.` : ""}`,
      ),
    );
  }
  for (const v of [bT, mT, bT + mT]) {
    pool.push(
      st(
        `For $0$ ${c.xu}s, the predicted ${c.y} is $${fmt(v)}$`,
        v === bT,
        v === bT
          ? `At $x=0$ the $x$-term is 0, so $\\hat{y}$ equals the intercept, $${fmt(bT)}$.`
          : `At $x=0$ the $x$-term is 0, so $\\hat{y}=${fmt(bT)}$, the intercept.${v === mT ? ` $${fmt(mT)}$ is the slope.` : ` $${fmt(v)}$ is the prediction for $1$ ${c.xu}.`}`,
      ),
    );
  }
  const pairs: [number, number][] = [
    [2, 7],
    [3, 8],
    [1, 6],
    [4, 9],
  ];
  for (const [lo, hi] of pairs) {
    const more = pred(hi) > pred(lo);
    pool.push(
      st(
        `The predicted ${c.y} is greater for $${hi}$ ${c.xu}s than for $${lo}$ ${lo === 1 ? c.xu : `${c.xu}s`}`,
        more,
        `The slope is ${mT < 0 ? "negative, so predictions go down" : "positive, so predictions go up"} as $x$ grows. The line predicts $${fmt(pred(hi))}$ for $${hi}$ and $${fmt(pred(lo))}$ for $${lo}$, so the prediction for $${hi}$ is ${more ? "greater" : "less"}.`,
      ),
    );
  }
  return selectModel({
    variant: negative ? "negative-slope" : "positive-slope",
    pool: dedupe(pool),
    total: 5,
    k: r(2, 3),
    lead: regressionLead(eq, fmt(mT), fmt(bT)),
    tail: [regressionTail],
    context: `A line of best fit for ${c.x} ($x$) and ${c.y} ($\\hat{y}$) is $${eq}$. The data have $x$ between $0$ and $10$.`,
    ask: (k) => `Select the ${k} true statements.`,
    hint: () =>
      `To predict, put the number of ${c.xu}s in for $x$ in $${eq}$ and work out $\\hat{y}$. For a statement about change or about $0$, ask which number in the equation is the slope and which is the intercept.`,
  });
}

/* --------------------------------------------------- functions on a graph */

export const functionPairTemplate = selectTemplate({
  figure: "scenes-v1",
  id: "function-pair-select",
  title: "Select the points that keep a graph a function",
  skillId: "function-notation",
  gradeBand: "6–8",
  difficultyOffset: 0.2,
  description:
    "Read the points of a relation graphed on a coordinate plane and select every ordered pair that can be added so that the relation is still a function.",
});

function functionPair(r: Random) {
  const n = r(4, 5);
  const xs = sample(r, [0, 1, 2, 3, 4, 5, 6, 7, 8], n);
  const points = xs.map((x) => ({ x, y: r(1, 8) }));
  const used = new Map(points.map((p) => [p.x, p.y]));
  const pool: Statement[] = [];
  for (let x = 0; x <= 8; x++)
    for (let y = 0; y <= 8; y++) {
      if (used.get(x) === y) continue;
      const clash = used.has(x);
      pool.push(
        st(
          `$(${x},${y})$`,
          !clash,
          clash
            ? `$x=${x}$ already has the point $(${x},${used.get(x)})$, so adding $(${x},${y})$ gives two outputs for the same input.`
            : `No point has $x=${x}$ yet, so $(${x},${y})$ gives $x=${x}$ exactly one output.`,
        ),
      );
    }
  const g = graph({ x: [0, 9], y: [0, 9], grid: 1, tick: 1, aspect: 1 });
  for (const p of points) g.point(p.x, p.y);
  return selectModel({
    variant: `${n}-points`,
    pool: sample(r, pool, pool.length),
    total: 5,
    k: r(2, 3),
    context: "The graph shows a relation that is a function.",
    ask: (k) =>
      `Select the ${k} ordered pairs that can be added to the graph so that it is still a function.`,
    one: "ordered pair",
    hint: (shown) =>
      `A relation is a function when each $x$ has only one $y$. List the $x$ values already on the graph, starting with $x=${points[0]!.x}$. A new point can use an $x$ that is not on that list. ${shown.filter((x) => x.holds).length} of the five ordered pairs can be added.`,
    figure: { kind: "scene", scene: g.scene() },
  });
}

/* ------------------------------------------------ roots on a number line */

export const rootApproximationTemplate = selectTemplate({
  figure: "scenes-v1",
  id: "root-approximation-select",
  title: "Select the approximate values of marked points",
  skillId: "approximate-roots",
  gradeBand: "6–8",
  difficultyOffset: 0.3,
  description:
    "Read points marked on a number line between two integers, each at the square root of a whole number, and select every true approximation to the nearest tenth.",
});

function rootApproximation(r: Random) {
  const s = r(2, 8);
  // whole numbers n with s*s < n < (s+1)^2 whose square root is within 0.02 of a tenth
  const near = (n: number) => {
    const v = Math.sqrt(n);
    const t = Math.round(v * 10) / 10;
    return Math.abs(v - t) <= 0.02 ? t : null;
  };
  const ns: number[] = [];
  for (let n = s * s + 1; n < (s + 1) * (s + 1); n++) {
    const t = near(n);
    if (t !== null && t > s && t < s + 1) ns.push(n);
  }
  if (ns.length < 4) throw new Error("Need three retry: not enough roots");
  // four points whose tenths differ by at least two tenths
  let chosen: number[] = [];
  for (let g = 0; g < 50 && chosen.length < 4; g++) {
    chosen = [];
    for (const n of sample(r, ns, ns.length)) {
      if (chosen.every((m) => Math.abs(near(n)! - near(m)!) >= 0.2 - 1e-9))
        chosen.push(n);
      if (chosen.length === 4) break;
    }
  }
  if (chosen.length < 4) throw new Error("Need three retry: points too close");
  chosen.sort((x, y) => x - y);
  const letters = ["A", "B", "C", "D"];
  const tenth = (i: number) => near(chosen[i]!)!;
  const t = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
  const pool: Statement[] = [];
  chosen.forEach((_, i) => {
    const trueV = tenth(i);
    for (const d of [0, -0.2, 0.2, -0.1, 0.1, -0.3, 0.3]) {
      const v = Math.round((trueV + d) * 10) / 10;
      if (v <= s || v >= s + 1) continue;
      pool.push(
        st(
          `Point $${letters[i]}$ is about $${t(v)}$`,
          d === 0,
          d === 0
            ? `Point $${letters[i]}$ is at $\\sqrt{${chosen[i]}}\\approx${Math.sqrt(chosen[i]!).toFixed(2)}$, which is about $${t(v)}$ to the nearest tenth.`
            : `Point $${letters[i]}$ is at $\\sqrt{${chosen[i]}}\\approx${Math.sqrt(chosen[i]!).toFixed(2)}$, about $${t(trueV)}$, not $${t(v)}$.`,
        ),
      );
    }
  });
  const line = numberLine({
    min: s,
    max: s + 1,
    step: 0.1,
    labels: [s, s + 0.2, s + 0.4, s + 0.6, s + 0.8, s + 1],
  });
  chosen.forEach((n, i) => line.mark(Math.sqrt(n), { label: letters[i]! }));
  return selectModel({
    variant: "tenths-line",
    pool,
    total: 5,
    k: r(2, 3),
    context: `The number line shows points $A$, $B$, $C$ and $D$ between $${s}$ and $${s + 1}$. Each point is at the square root of a whole number.`,
    ask: (k) =>
      `Select the ${k} statements that give a true approximation to the nearest tenth.`,
    hint: (statements) => {
      const letter = statements[0]!.label.match(/\$([A-D])\$/)![1]!;
      return `Each small space on the line is $0.1$. Start at $${s}$ and count spaces toward $${s + 1}$ to point $${letter}$ to read its value to the nearest tenth, then do the same for the other points and compare with the statements.`;
    },
    figure: { kind: "scene", scene: line.scene() },
  });
}

/* ----------------------------------------------------------- dot plot data */

export const dotPlotStatementsTemplate = selectTemplate({
  figure: "scenes-v1",
  id: "dot-plot-statement-select",
  title: "Select the statements a dot plot supports",
  skillId: "mean-median",
  gradeBand: "6–8",
  difficultyOffset: 0.2,
  description:
    "Read a dot plot of thirty values and select every statement about counts, shares, the most common value and the greatest value that the plot supports.",
});

function dotPlotStatements(r: Random) {
  const lo = 1;
  const hi = r(6, 8);
  let counts: number[] = [];
  for (let g = 0; g < 400; g++) {
    counts = Array.from({ length: hi - lo + 1 }, () => r(1, 7));
    const sum = counts.reduce((a, b) => a + b, 0);
    const top = Math.max(...counts);
    if (sum === 30 && counts.filter((c) => c === top).length === 1) break;
    counts = [];
  }
  if (!counts.length) throw new Error("Need three retry: counts");
  const n = 30;
  const values: number[] = [];
  counts.forEach((c, i) => values.push(...Array(c).fill(lo + i)));
  const cnt = (v: number) => counts[v - lo] ?? 0;
  const mode = lo + counts.indexOf(Math.max(...counts));
  const atLeast = (t: number) => values.filter((v) => v >= t).length;
  const atMost = (t: number) => values.filter((v) => v <= t).length;
  const pool: Statement[] = [];
  const dots = (c: number) => `$${c}$ ${c === 1 ? "dot" : "dots"}`;
  const turns = (c: number) => `$${c}$ ${c === 1 ? "turn" : "turns"}`;
  for (const v of sample(
    r,
    Array.from({ length: hi - lo + 1 }, (_, i) => lo + i),
    4,
  )) {
    for (const d of [0, 1, -1, 2]) {
      const c = cnt(v) + d;
      if (c < 1) continue;
      pool.push(
        st(
          `Exactly ${turns(c)} scored $${v}$`,
          d === 0,
          `The plot shows ${dots(cnt(v))} at $${v}$.`,
        ),
      );
    }
  }
  for (const t of [3, 4, 5, hi - 1]) {
    for (const d of [0, 2, -2]) {
      const c = atLeast(t) + d;
      if (c < 1 || c > n) continue;
      pool.push(
        st(
          `${turns(c)} scored at least $${t}$`,
          d === 0,
          `The dots at $${t}$ and above number $${atLeast(t)}$.`,
        ),
      );
    }
  }
  for (const v of Array.from({ length: hi - lo + 1 }, (_, i) => lo + i))
    pool.push(
      st(
        `The most common score was $${v}$`,
        v === mode,
        v === mode
          ? `$${v}$ has the tallest stack, ${dots(cnt(v))}.`
          : `$${v}$ has ${dots(cnt(v))}, fewer than the ${dots(cnt(mode))} at $${mode}$.`,
      ),
    );
  for (const t of [3, 4, 5]) {
    const half = atMost(t) > n / 2;
    pool.push(
      st(
        `More than half of the turns scored $${t}$ or less`,
        half,
        `$${atMost(t)}$ of the $${n}$ turns scored $${t}$ or less, which is ${half ? "more" : "not more"} than half.`,
      ),
    );
  }
  for (let a = lo; a <= hi; a++)
    for (let b = a + 1; b <= hi; b++) {
      if (r(0, 5)) continue;
      pool.push(
        st(
          `More turns scored $${a}$ than scored $${b}$`,
          cnt(a) > cnt(b),
          `There are ${dots(cnt(a))} at $${a}$ and ${dots(cnt(b))} at $${b}$.`,
        ),
      );
    }
  pool.push(
    st(
      `The greatest score was $${hi}$`,
      true,
      `The last dots on the plot are at $${hi}$.`,
    ),
    st(
      `The greatest score was $${hi - 1}$`,
      false,
      `There are ${dots(cnt(hi))} at $${hi}$, so $${hi}$ was scored.`,
    ),
    st(
      `The least score was $${lo + 1}$`,
      false,
      `There are ${dots(cnt(lo))} at $${lo}$, so $${lo}$ was scored.`,
    ),
  );
  return selectModel({
    variant:
      hi - lo + 1 <= 6
        ? "short-scale"
        : hi - lo + 1 === 7
          ? "medium-scale"
          : "long-scale",
    pool: dedupe(pool),
    total: 5,
    k: r(2, 3),
    context: `The dot plot shows the points scored in each of $${n}$ turns of a game. Each dot is one turn.`,
    ask: (k) => `Select the ${k} statements that the dot plot supports.`,
    one: "statement",
    hint: (shown) =>
      `Count the dots above each score from $${lo}$ to $${hi}$. Write the counts under the line, check that they add to $${n}$, and use them to test each statement. ${shown.filter((x) => x.holds).length} of the five statements are supported.`,
    figure: {
      kind: "scene",
      scene: scene({
        type: "dotPlot",
        id: "plot",
        min: lo - 1,
        max: hi + 1,
        mark: "dot",
        groups: [{ values }],
        unit: "points",
      }).build({ title: `A dot plot of ${n} game scores`, maxHeight: 480 }),
    },
  });
}

/* ------------------------------------------------------------ registry */

const families = {
  "story-expression-select": selectFamily(
    storyExpressionTemplate,
    storyExpression,
  ),
  "equal-expression-select": selectFamily(
    equalExpressionTemplate,
    equalExpression,
  ),
  "customary-equivalent-select": selectFamily(
    customaryEquivalentTemplate,
    customaryEquivalent,
  ),
  "additive-multiplicative-select": selectFamily(
    additiveMultiplicativeTemplate,
    additiveMultiplicative,
  ),
  "equivalent-trinomial-select": selectFamily(
    equivalentTrinomialTemplate,
    equivalentTrinomial,
  ),
  "regression-prediction-select": selectFamily(
    regressionPredictionTemplate,
    regressionPrediction,
  ),
  "function-pair-select": selectFamily(functionPairTemplate, functionPair),
  "root-approximation-select": selectFamily(
    rootApproximationTemplate,
    rootApproximation,
  ),
  "dot-plot-statement-select": selectFamily(
    dotPlotStatementsTemplate,
    dotPlotStatements,
  ),
};
export const multiselectExpressionFamilies = families;
export const multiselectExpressionTemplates = [
  storyExpressionTemplate,
  equalExpressionTemplate,
  customaryEquivalentTemplate,
  additiveMultiplicativeTemplate,
  equivalentTrinomialTemplate,
  regressionPredictionTemplate,
  functionPairTemplate,
  rootApproximationTemplate,
  dotPlotStatementsTemplate,
] as const;
export const multiselectExpressionGenerate = dispatch(
  multiselectExpressionTemplates,
  Object.fromEntries(
    Object.entries(families).map(([id, f]) => [
      id,
      (seed: string): GeneratedProblem =>
        (
          f as { generate: (s: string) => { problem: GeneratedProblem } }
        ).generate(seed).problem,
    ]),
  ),
);
