import type { TemplateMetadata } from "./contracts";
import { defineAxis, type Random } from "./variation/axes";
import { shuffle } from "./distribution-practice";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { lineTable } from "./scene/author";
import type { Surface } from "./variation/compose";
import type { Scene } from "./scene/spec";
import {
  gcd,
  n,
  rat,
  ratEq,
  qt,
  termText,
  twoTerm,
  type Rational,
} from "./algebra-one-kit";

/**
 * Choose-the-equation families for lines and linear systems:
 * - a second equation that gives a system no, infinitely many, exactly one
 *   or at least one solution;
 * - the slope-intercept equation of a line parallel to a given line through a
 *   stated intercept (or through an intercept of another line);
 * - the standard-form equation, or a vertically shifted rule, of a line
 *   given by a table whose inputs are spaced unevenly or are fractions.
 * Each family computes the relationship between lines from exact rational
 * arithmetic and labels every distractor by what it really is.
 */
const choiceCap = { requiredResponseCapability: "single-choice-v1" as const };

export const systemSecondEquationTemplate: TemplateMetadata = {
  id: "system-second-equation",
  version: 1,
  title: "Choose a second equation for a system",
  skillId: "linear-systems",
  gradeBand: "6–8",
  difficultyOffset: 0.2,
  description:
    "Given one linear equation (in standard or slope-intercept form), choose the second equation that makes the system have no solution, infinitely many solutions, exactly one solution or at least one solution.",
  ...choiceCap,
};
export const parallelLineInterceptTemplate: TemplateMetadata = {
  id: "parallel-line-intercept",
  version: 1,
  title: "Parallel line through an intercept",
  skillId: "slope-proofs",
  gradeBand: "9–12",
  difficultyOffset: 0,
  description:
    "Choose the slope-intercept equation of the line parallel to a given line (in standard or slope-intercept form) that passes through a stated intercept, or through the intercept of another line on the vertical axis.",
  ...choiceCap,
};
export const tableStandardFormTemplate: TemplateMetadata = {
  id: "table-standard-form",
  version: 1,
  title: "Equation of a line from a table with uneven steps",
  skillId: "linear-equation-modeling",
  gradeBand: "9–12",
  difficultyOffset: 0.1,
  description:
    "From a table of a linear function whose inputs are unevenly spaced or fractions, choose the line's equation in standard form, or the rule of the same function shifted up or down.",
  requiredFigureCapability: "scenes-v1",
  ...choiceCap,
};

/* ------------------------------------------------------------------ */
/* Rows a x + b y = c                                                  */
/* ------------------------------------------------------------------ */

interface Row {
  a: number;
  b: number;
  c: number;
}
const eq = (r: Row) => `$${twoTerm(r.a, r.b)} = ${n(r.c)}$`;
type Relation = "same" | "parallel" | "cross";
const relation = (p: Row, s: Row): Relation => {
  if (p.a * s.b - s.a * p.b !== 0) return "cross";
  return p.a * s.c === s.a * p.c && p.b * s.c === s.b * p.c
    ? "same"
    : "parallel";
};
const ratio = (p: Row, s: Row): Rational => rat(s.a, p.a);
/** (m, k) of y = m x + k as a row with integer coefficients, lowest terms. */
function standardRow(m: Rational, k: Rational): Row {
  const d = (m.d * k.d) / gcd(m.d, k.d);
  // m x - y = -k  scaled by d
  let a = (m.n * d) / m.d,
    b = -d,
    c = (-k.n * d) / k.d;
  const g = gcd(gcd(a, b), c) || 1;
  a /= g;
  b /= g;
  c /= g;
  if (a < 0 || (a === 0 && b < 0)) {
    a = -a;
    b = -b;
    c = -c;
  }
  return { a, b, c };
}
const q1 = (v: Rational) => qt(v);
const mulQ = (u: Rational, w: Rational) => rat(u.n * w.n, u.d * w.d);
const addQ = (u: Rational, w: Rational) =>
  rat(u.n * w.d + w.n * u.d, u.d * w.d);
const subQ = (u: Rational, w: Rational) =>
  rat(u.n * w.d - w.n * u.d, u.d * w.d);
/** y = m x + k as text; a fractional slope is written a/b x. */
function slopeIntercept(m: Rational, k: Rational, lhs = "y"): string {
  const coef =
    m.d === 1
      ? m.n === 1
        ? ""
        : m.n === -1
          ? "−"
          : n(m.n)
      : `${m.n < 0 ? "−" : ""}${Math.abs(m.n)}/${m.d}`;
  const x = m.n === 0 ? "" : `${coef}x`;
  const tail =
    k.n === 0 ? "" : ` ${k.n < 0 ? "−" : "+"} ${q1(rat(Math.abs(k.n), k.d))}`;
  return `${lhs} = ${x}${x ? tail : q1(k)}`;
}
const math = (s: string) => `$${s}$`;
/** Coefficient of x in working: 1x is x and −1x is −x. */
const coefX = (m: Rational) =>
  m.d === 1 && m.n === 1 ? "" : m.d === 1 && m.n === -1 ? "−" : qt(m);
/** m times a value in working, with the value in parentheses. */
const timesValue = (m: Rational, v: Rational) =>
  coefX(m) === "" ? qt(v) : `${coefX(m)}(${qt(v)})`;

/** Fractions in learner text are typeset: inside $...$ spans a/b becomes
 * \tfrac{a}{b}, and in prose (not in answer labels) a bare fraction is set as
 * math. */
const fractionPattern = /(−?)(\d+)\/(\d+)/g;
const tfrac = (s: string) =>
  s.replace(
    fractionPattern,
    (_m, sign: string, a: string, b: string) => `${sign}\\tfrac{${a}}{${b}}`,
  );
function texify(s: string, prose = true): string {
  return s
    .split("$")
    .map((part, i) =>
      i % 2 === 1
        ? tfrac(part)
        : prose
          ? part.replace(fractionPattern, (m) => `$${tfrac(m)}$`)
          : part,
    )
    .join("$");
}
const withFigure = (s: Surface | null, scene: Scene): Surface | null => {
  const done = tex(s);
  return done && { ...done, figure: { kind: "scene" as const, scene } };
};
function tex(s: Surface | null): Surface | null {
  if (!s) return s;
  const labelled =
    s.response.kind === "choice"
      ? {
          ...s.response,
          options: s.response.options.map((o) => ({
            ...o,
            label: texify(o.label, false),
          })),
        }
      : s.response;
  return {
    ...s,
    prompt: texify(s.prompt),
    hint: texify(s.hint),
    explanation: s.explanation.map((e) => texify(e)),
    response: labelled,
    ...(s.choiceFeedback
      ? {
          choiceFeedback: Object.fromEntries(
            Object.entries(s.choiceFeedback).map(([k, v]) => [k, texify(v)]),
          ),
        }
      : {}),
  };
}

/* ------------------------------------------------------------------ */
/* 1. A second equation for a system                                   */
/* ------------------------------------------------------------------ */

const sysAxes = {
  goal: defineAxis("goal", [
    "no-solution",
    "infinitely-many",
    "exactly-one",
    "at-least-one",
  ] as const),
  given: defineAxis("given", ["standard", "slope-intercept"] as const),
};
type Goal = "no-solution" | "infinitely-many" | "exactly-one" | "at-least-one";
interface SysModel {
  goal: Goal;
  given: "standard" | "slope-intercept";
  first: Row;
  /** Slope-intercept data of the displayed first equation. */
  m: Rational;
  k: number;
  correct: Row;
  wrong: Row[];
}

const nz = (r: Random, lo: number, hi: number) => {
  const v = r(lo, hi - 1);
  return v >= 0 ? v + 1 : v;
};
const scaled = (p: Row, s: number, d = 0): Row => ({
  a: p.a * s,
  b: p.b * s,
  c: p.c * s + d,
});
function candidate(r: Random, first: Row, want: Relation, kind = 0): Row {
  if (want === "same") return scaled(first, pick(r, [-3, -2, 2, 3]));
  if (want === "parallel") {
    if (kind === 1) {
      // The left side is scaled and the constant is not.
      return { ...scaled(first, pick(r, [-2, 2, 3])), c: first.c };
    }
    return scaled(first, pick(r, [-3, -2, -1, 1, 2, 3]), nz(r, -7, 7));
  }
  for (;;) {
    const row = { a: nz(r, -6, 6), b: nz(r, -6, 6), c: r(-16, 16) };
    if (relation(first, row) === "cross") return row;
  }
}
function sysModel(
  r: Random,
  ax: { goal: Goal; given: "standard" | "slope-intercept" },
): SysModel {
  let first: Row, m: Rational, k: number;
  if (ax.given === "standard") {
    first = { a: nz(r, -6, 6), b: nz(r, -6, 6), c: nz(r, -16, 16) };
    m = rat(-first.a, first.b);
    k = 0;
  } else {
    const q = pick(r, [1, 2, 3, 4]);
    const p = nz(r, -6, 6);
    if (gcd(p, q) !== 1) throw new Error("Need three retries");
    k = nz(r, -9, 9);
    m = rat(p, q);
    first = { a: -p, b: q, c: q * k };
  }
  const mk = (want: Relation, kind = 0) => candidate(r, first, want, kind);
  let correct: Row, wrong: Row[];
  switch (ax.goal) {
    case "no-solution":
      correct = mk("parallel");
      wrong = [mk("same"), mk("cross"), mk("cross")];
      break;
    case "infinitely-many":
      correct = mk("same");
      wrong = [mk("parallel", 1), mk("parallel"), mk("cross")];
      break;
    case "exactly-one":
      correct = mk("cross");
      wrong = [mk("same"), mk("parallel", 1), mk("parallel")];
      break;
    case "at-least-one":
      correct = mk(r(0, 1) ? "same" : "cross");
      wrong = [mk("parallel", 1), mk("parallel"), mk("parallel")];
      break;
  }
  const targets: Record<Goal, (rel: Relation) => boolean> = {
    "no-solution": (rel) => rel === "parallel",
    "infinitely-many": (rel) => rel === "same",
    "exactly-one": (rel) => rel === "cross",
    "at-least-one": (rel) => rel !== "parallel",
  };
  if (!targets[ax.goal](relation(first, correct)))
    throw new Error("Need three retries");
  if (wrong.some((w) => targets[ax.goal](relation(first, w))))
    throw new Error("Need three retries");
  // Two choices must never be the same equation written twice.
  const all = [correct, ...wrong];
  for (let i = 0; i < all.length; i++)
    for (let j = 0; j < i; j++)
      if (relation(all[i]!, all[j]!) === "same")
        throw new Error("Need three retries");
  return { goal: ax.goal, given: ax.given, first, m, k, correct, wrong };
}

const goalPhrase: Record<Goal, string> = {
  "no-solution": "has no solution",
  "infinitely-many": "has infinitely many solutions",
  "exactly-one": "has exactly one solution",
  "at-least-one": "has at least one solution",
};
const goalVerb: Record<Goal, string> = {
  "no-solution": "have no solution",
  "infinitely-many": "have infinitely many solutions",
  "exactly-one": "have exactly one solution",
  "at-least-one": "have at least one solution",
};
const firstText = (s: SysModel) =>
  s.given === "standard" ? eq(s.first) : math(slopeIntercept(s.m, rat(s.k)));

function verdict(first: Row, other: Row): string {
  const rel = relation(first, other);
  if (rel === "cross")
    return `The coefficients of $x$ and $y$ are not in proportion (${n(first.a)}:${n(first.b)} against ${n(other.a)}:${n(other.b)}), so the slopes differ and the lines cross at exactly one point.`;
  const k = ratio(first, other);
  const times = qt(k);
  const kc = rat(first.c * k.n, k.d);
  if (rel === "same")
    return `Both coefficients and the constant are ${times} times those of the first equation (${first.c < 0 ? `(${n(first.c)})` : first.c} × ${k.n < 0 || k.d !== 1 ? `(${times})` : times} = ${n(other.c)}), so it is the same line and every point on it is shared: infinitely many solutions.`;
  return `The coefficients of $x$ and $y$ are ${times} times those of the first equation, so the slopes match, but the constant would have to be ${qt(kc)} for the same line, not ${n(other.c)}. The lines are parallel and never meet: no solution.`;
}

export const systemSecondEquationFamily = chainFamily({
  template: systemSecondEquationTemplate,
  axes: sysAxes,
  model: sysModel,
  variant: (s) => `${s.goal}-${s.given}`,
  render: (s, _ax, r) => {
    const first = s.first;
    const standard =
      s.given === "slope-intercept"
        ? `Write the first equation with $x$ and $y$ on the left: ${eq(first)}. `
        : "";
    const options: ChoiceOption[] = [
      {
        label: `$${twoTerm(s.correct.a, s.correct.b)} = ${n(s.correct.c)}$`,
        correct: true,
      },
      ...s.wrong.map((w) => ({
        label: `$${twoTerm(w.a, w.b)} = ${n(w.c)}$`,
        feedback: verdict(first, w),
      })),
    ];
    const lead =
      s.goal === "no-solution"
        ? "Same slope, different line: the coefficients must be in proportion but the constant must not."
        : s.goal === "infinitely-many"
          ? "The same line written another way: every coefficient and the constant are multiplied by the same number."
          : s.goal === "exactly-one"
            ? "The slopes must differ, so the coefficients of the second equation are not in proportion to the first."
            : "A system has at least one solution unless the lines are parallel and different, so rule out the equations whose coefficients are in proportion but whose constant is not.";
    return tex(
      choiceSurface(r, {
        prompt: `The equation ${firstText(s)} is one equation of a system of two linear equations in $x$ and $y$. Which equation can be the second equation so that the system ${goalPhrase[s.goal]}?`,
        options,
        hint: `${standard}Compare the coefficients ${n(first.a)} and ${n(first.b)} and the constant ${n(first.c)} with each choice. ${lead}`,
        explanation: [
          `${standard}Compare each choice with ${eq(first)}: look at the ratio of the $x$-coefficients, of the $y$-coefficients and of the constants.`,
          verdict(first, s.correct),
          `So ${eq(s.correct)} makes the system ${goalVerb[s.goal]}.`,
        ],
        label: "Choose the second equation",
      }),
    );
  },
});

/* ------------------------------------------------------------------ */
/* 2. A parallel line through an intercept                             */
/* ------------------------------------------------------------------ */

const parAxes = {
  given: defineAxis("given", ["standard", "slope-intercept"] as const),
  anchor: defineAxis("anchor", [
    "y-intercept",
    "x-intercept",
    "other-line",
  ] as const),
};
interface ParModel {
  given: "standard" | "slope-intercept";
  anchor: "y-intercept" | "x-intercept" | "other-line";
  line: Row;
  /** Slope-intercept data of the displayed given line. */
  m: Rational;
  k: number;
  /** Point's coordinate: b of y-intercept (0, b), or h of (h, 0). */
  point: number;
  other: Row;
  /** Intercept of the new line. */
  b: Rational;
}
function parModel(
  r: Random,
  ax: { given: "standard" | "slope-intercept"; anchor: ParModel["anchor"] },
): ParModel {
  let line: Row,
    m: Rational,
    k = 0;
  if (ax.given === "standard") {
    line = { a: nz(r, -6, 6), b: nz(r, -6, 6), c: nz(r, -14, 14) };
    m = rat(-line.a, line.b);
  } else {
    const q = pick(r, [1, 2, 3, 4]);
    const p = nz(r, -6, 6);
    if (gcd(p, q) !== 1) throw new Error("Need three retries");
    k = nz(r, -9, 9);
    m = rat(p, q);
    line = { a: -p, b: q, c: q * k };
  }
  if (Math.abs(m.n) === 1 && m.d === 1 && r(0, 1))
    throw new Error("Need three retries");
  const other: Row = { a: 0, b: 0, c: 0 };
  let point: number;
  let b: Rational;
  if (ax.anchor === "x-intercept") {
    point = nz(r, -8, 8);
    b = rat(-m.n * point, m.d);
  } else {
    point = nz(r, -9, 9);
    b = rat(point);
    if (ax.anchor === "other-line") {
      other.b = nz(r, -4, 4);
      other.a = nz(r, -6, 6);
      other.c = other.b * point;
    }
  }
  if (b.n === 0) throw new Error("Need three retries");
  // The new intercept must differ from the given line's own.
  if (ratEq(b, rat(line.c, line.b))) throw new Error("Need three retries");
  return { given: ax.given, anchor: ax.anchor, line, m, k, point, other, b };
}
const lineText = (p: ParModel) =>
  p.given === "standard" ? eq(p.line) : math(slopeIntercept(p.m, rat(p.k)));
const nextTo = (v: Rational) => qt(v);

export const parallelLineInterceptFamily = chainFamily({
  template: parallelLineInterceptTemplate,
  axes: parAxes,
  model: parModel,
  variant: (p) => `${p.given}-${p.anchor}`,
  render: (p, _ax, r) => {
    const m = p.m;
    const own = rat(p.line.c, p.line.b);
    const inv = rat(-m.d, m.n);
    const cand: { text: string; feedback: string }[] = [];
    const add = (mm: Rational, bb: Rational, feedback: string) => {
      if (ratEq(mm, m) && ratEq(bb, p.b)) return;
      cand.push({ text: math(slopeIntercept(mm, bb)), feedback });
    };
    add(
      inv,
      p.b,
      `Its slope ${qt(inv)} is the negative reciprocal of ${qt(m)} (the fraction flipped, with the sign changed). That is the slope of a perpendicular line. A parallel line keeps the same slope, ${qt(m)}.`,
    );
    add(
      rat(-m.n, m.d),
      p.b,
      `Its slope ${qt(rat(-m.n, m.d))} is the opposite of the given slope ${qt(m)}. Parallel lines have equal slopes, signs included.`,
    );
    add(
      m,
      own,
      `It has the right slope but uses the given line's own $y$-intercept, ${qt(own)}. The new line must pass through the stated point instead.`,
    );
    add(
      m,
      rat(-p.b.n, p.b.d),
      `It has the right slope, but the sign of the $y$-intercept, where the line crosses the $y$-axis, is reversed. Substitute the stated point to find it.`,
    );
    if (p.given === "standard")
      add(
        rat(p.line.a, p.line.b),
        p.b,
        `Its slope ${qt(rat(p.line.a, p.line.b))} drops a minus sign. The slope of ${eq(p.line)} is the opposite of the $x$-coefficient divided by the $y$-coefficient, ${qt(m)}.`,
      );
    if (p.anchor === "x-intercept")
      add(
        m,
        rat(p.point),
        `It uses ${n(p.point)} as the $y$-intercept, but ${n(p.point)} is the $x$-coordinate of the point $(${n(p.point)}, 0)$. Substitute $x = ${n(p.point)}$ and $y = 0$ to find the constant.`,
      );
    const wrong = shuffle(r, cand).slice(0, 3);
    if (wrong.length < 3) return null;
    const options: ChoiceOption[] = [
      { label: math(slopeIntercept(m, p.b)), correct: true },
      ...wrong.map((w) => ({ label: w.text, feedback: w.feedback })),
    ];
    const slopeWork =
      p.given === "standard"
        ? [
            `Solving ${eq(p.line)} for $y$ means moving the $x$-term to the right side and dividing by the $y$-coefficient, ${n(p.line.b)}.`,
            `That leaves the opposite of the $x$-coefficient divided by the $y$-coefficient in front of $x$, so the slope is $−\\tfrac{${n(p.line.a)}}{${n(p.line.b)}} = ${qt(m)}$.`,
          ]
        : [
            `${lineText(p)} is already in that form, so its slope is the coefficient of $x$, the number multiplying $x$: ${qt(m)}.`,
          ];
    const pointText =
      p.anchor === "x-intercept"
        ? `$(${n(p.point)}, 0)$`
        : `$(0, ${n(p.point)})$`;
    const interceptWork =
      p.anchor === "x-intercept"
        ? [
            `An $x$-intercept is where a line crosses the $x$-axis, so $y = 0$ there. Line $t$ passes through ${pointText}.`,
            `Substitute $x = ${n(p.point)}$ and $y = 0$ into $y = ${coefX(m)}x + b$: $0 = ${timesValue(m, rat(p.point))} + b$, so $b = ${qt(p.b)}$.`,
          ]
        : p.anchor === "y-intercept"
          ? [
              `The $y$-intercept is the point on the $y$-axis, where $x = 0$. Line $t$ crosses there at ${pointText}, so $b = ${n(p.point)}$.`,
            ]
          : [
              `A $y$-intercept is where a line crosses the $y$-axis, so $x = 0$ there. Put $x = 0$ into ${eq(p.other)}: $${termText(p.other.b, "y")} = ${n(p.other.c)}$, so $y = ${n(p.point)}$.`,
              `Line $t$ passes through that point, ${pointText}, so $b = ${n(p.point)}$.`,
            ];
    const anchorText =
      p.anchor === "y-intercept"
        ? `has $y$-intercept ${pointText}`
        : p.anchor === "x-intercept"
          ? `passes through the point ${pointText}, its $x$-intercept`
          : `passes through the $y$-intercept of the line ${eq(p.other)}`;
    const hint =
      p.anchor === "other-line"
        ? `Parallel lines have equal slopes. Find the slope of ${lineText(p)}, then find where ${eq(p.other)} crosses the $y$-axis by putting $x = 0$.`
        : p.anchor === "x-intercept"
          ? `Parallel lines have equal slopes. Find the slope of ${lineText(p)}, then put the point ${pointText} into $y = mx + b$ to find $b$.`
          : `Parallel lines have equal slopes. Find the slope of ${lineText(p)}. The $y$-intercept ${pointText} gives $b$ directly.`;
    return tex(
      choiceSurface(r, {
        prompt: `Line $s$ has the equation ${lineText(p)}. Line $t$ is parallel to line $s$ and ${anchorText}. Which equation represents line $t$?`,
        options,
        hint,
        explanation: [
          `Write line $t$ as $y = mx + b$. Here $m$ is the slope, the change in $y$ for each step of 1 in $x$, and $b$ is the $y$-intercept.`,
          ...slopeWork,
          `Parallel lines never meet, so they rise at the same rate: they have equal slopes. Line $t$ has slope ${qt(m)}.`,
          ...interceptWork,
          `So line $t$ is ${math(slopeIntercept(m, p.b))}.`,
        ],
        label: "Choose the equation",
      }),
    );
  },
});

/* ------------------------------------------------------------------ */
/* 3. A table with uneven steps to an equation                         */
/* ------------------------------------------------------------------ */

const tabAxes = {
  inputs: defineAxis("inputs", ["uneven-steps", "fractions"] as const),
  ask: defineAxis("ask", ["standard-form", "shifted-rule"] as const),
};
interface TabModel {
  inputs: "uneven-steps" | "fractions";
  ask: "standard-form" | "shifted-rule";
  m: Rational;
  k: Rational;
  xs: Rational[];
  ys: Rational[];
  shift: number;
}
function tabModel(
  r: Random,
  ax: { inputs: TabModel["inputs"]; ask: TabModel["ask"] },
): TabModel {
  let m: Rational, xs: Rational[];
  const k = rat(nz(r, -9, 9));
  if (ax.inputs === "uneven-steps") {
    const q = pick(r, [1, 1, 2, 3]);
    const p = nz(r, -6, 6);
    if (gcd(p, q) !== 1) throw new Error("Need three retries");
    m = rat(p, q);
    const pool = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8];
    const picks: number[] = [];
    while (picks.length < 4) {
      const v = pool[r(0, pool.length - 1)]!;
      if (!picks.includes(v)) picks.push(v);
    }
    picks.sort((u, w) => u - w);
    const gaps = picks.slice(1).map((v, i) => v - picks[i]!);
    if (new Set(gaps).size < 2) throw new Error("Need three retries");
    xs = picks.map((u) => rat(u * q));
  } else {
    m = rat(nz(r, -5, 5));
    const picks: number[] = [];
    while (picks.length < 4) {
      const v = r(-5, 9);
      if (!picks.includes(v)) picks.push(v);
    }
    picks.sort((u, w) => u - w);
    if (picks.every((v) => v % 2 === 0)) throw new Error("Need three retries");
    xs = picks.map((u) => rat(u, 2));
  }
  const ys = xs.map((x) => rat(m.n * x.n + k.n * m.d * x.d, m.d * x.d));
  return {
    inputs: ax.inputs,
    ask: ax.ask,
    m,
    k,
    xs,
    ys,
    shift: nz(r, -6, 6),
  };
}
const cell = (v: Rational) => qt(v);
const diff = (u: Rational, w: Rational) =>
  rat(u.n * w.d - w.n * u.d, u.d * w.d);

export const tableStandardFormFamily = chainFamily({
  template: tableStandardFormTemplate,
  axes: tabAxes,
  model: tabModel,
  variant: (t) => `${t.inputs}-${t.ask}`,
  render: (t, _ax, r) => {
    const scene = lineTable(
      [
        ["x", ...t.xs.map(cell)],
        ["y", ...t.ys.map(cell)],
      ],
      { header: "column" },
    )
      .id("t")
      .scene({ title: "Table of values of a linear function" });
    const dx = diff(t.xs[1]!, t.xs[0]!),
      dy = diff(t.ys[1]!, t.ys[0]!);
    const slopeSteps = [
      `A linear function has the form $y = mx + b$. The slope $m$ is the change in $y$ divided by the change in $x$, and $b$ is the value of $y$ when $x = 0$.`,
      `Use the actual changes in the table, because its inputs are not one unit apart. From the first two columns, $x$ changes by ${qt(dx)} and $y$ changes by ${qt(dy)}, so the slope is $${qt(dy)} \\div ${dx.n < 0 || dx.d !== 1 ? `(${qt(dx)})` : qt(dx)} = ${qt(t.m)}$.`,
      t.xs.some((x) => x.n === 0)
        ? `The input 0 is in the table, and its output is the constant: $b = ${qt(t.k)}$.`
        : `The input 0 is not in the table, so use a point to find the constant $b$. Put $(${qt(t.xs[0]!)}, ${qt(t.ys[0]!)})$ into $y = ${coefX(t.m)}x + b$: $${qt(t.ys[0]!)} = ${timesValue(t.m, t.xs[0]!)} + b$, so $b = ${qt(t.k)}$.`,
    ];
    if (t.ask === "standard-form") {
      const row = standardRow(t.m, t.k);
      const cands: [Rational, Rational, string][] = [
        [
          rat(t.m.d, t.m.n),
          t.k,
          "It uses the change in $x$ divided by the change in $y$, which is upside down. The slope is the change in $y$ divided by the change in $x$.",
        ],
        [
          rat(-t.m.n, t.m.d),
          t.k,
          "Its slope has the opposite sign. Compare the direction of the table: check whether $y$ rises or falls as $x$ increases.",
        ],
        [
          t.m,
          rat(-t.k.n, t.k.d),
          "It has the right slope but the opposite constant term. Put a column of the table into it, and the two sides come out different.",
        ],
      ];
      // The per-column slip: the change in y between neighboring columns is
      // taken as the slope, with the line then drawn through the first column.
      const perColumn = dy;
      cands.push([
        perColumn,
        subQ(t.ys[0]!, mulQ(perColumn, t.xs[0]!)),
        `It treats the change in $y$ between neighboring columns, ${qt(dy)}, as the slope. The columns are ${qt(dx)} apart in $x$, so divide by that change.`,
      ]);
      const wrong = shuffle(
        r,
        cands
          .map(([mm, kk, feedback]) => ({
            row: standardRow(mm, kk),
            feedback,
          }))
          .filter(
            (c) =>
              !(c.row.a === row.a && c.row.b === row.b && c.row.c === row.c) &&
              c.row.a !== 0,
          ),
      ).slice(0, 3);
      if (wrong.length < 3) return null;
      const options: ChoiceOption[] = [
        { label: `$${twoTerm(row.a, row.b)} = ${n(row.c)}$`, correct: true },
        ...wrong.map((w) => ({
          label: `$${twoTerm(w.row.a, w.row.b)} = ${n(w.row.c)}$`,
          feedback: w.feedback,
        })),
      ];
      return withFigure(
        choiceSurface(r, {
          prompt:
            "The table shows values of a linear function. Which equation of the line is written in standard form?",
          options,
          hint: `From the first column to the second, the input changes from ${qt(t.xs[0]!)} to ${qt(t.xs[1]!)} (a change of ${qt(dx)}) and the output changes from ${qt(t.ys[0]!)} to ${qt(t.ys[1]!)} (a change of ${qt(dy)}). Divide the change in $y$ by the change in $x$ for the slope, then find the constant and move the $x$-term to the left.`,
          explanation: [
            ...slopeSteps,
            `So $y = ${coefX(t.m)}x ${t.k.n < 0 ? "−" : "+"} ${qt(rat(Math.abs(t.k.n), t.k.d))}$.`,
            `Standard form is $Ax + By = C$: the $x$- and $y$-terms on the left, a number on the right, whole-number coefficients (the numbers multiplying the variables) with no common factor, and $A$ positive.`,
            `Move the $x$-term to the left, clear any fractions, and make the $x$-coefficient positive: $${twoTerm(row.a, row.b)} = ${n(row.c)}$.`,
            `Check with a column: at $x = ${qt(t.xs[2]!)}$, $y = ${qt(t.ys[2]!)}$, the left side is $${n(row.a)}(${qt(t.xs[2]!)}) ${row.b < 0 ? "−" : "+"} ${Math.abs(row.b)}(${qt(t.ys[2]!)}) = ${qt(addQ(mulQ(rat(row.a), t.xs[2]!), mulQ(rat(row.b), t.ys[2]!)))}$, matching ${n(row.c)}.`,
            `So the equation in standard form is $${twoTerm(row.a, row.b)} = ${n(row.c)}$.`,
          ],
          label: "Choose the equation",
        }),
        scene,
      );
    }
    // shifted-rule
    const s = t.shift;
    const shifted = rat(t.k.n + s * t.k.d, t.k.d);
    const g = (kk: Rational, mm = t.m) => math(slopeIntercept(mm, kk, "g(x)"));
    const cands: [Rational, Rational, string][] = [
      [
        t.m,
        t.k,
        "This is $f(x)$ itself. The function $g$ adds the shift to every output, so its constant changes.",
      ],
      [
        t.m,
        rat(t.k.n - s * t.k.d, t.k.d),
        `Since $g(x) = f(x) ${s < 0 ? "−" : "+"} ${Math.abs(s)}$, the constant of $g$ is the constant of $f$ ${s < 0 ? "minus" : "plus"} ${Math.abs(s)}. This choice moves it the other way.`,
      ],
      [
        rat(-t.m.n, t.m.d),
        shifted,
        "Its slope has the opposite sign. A vertical shift does not change the slope, and the table fixes the slope of $f$.",
      ],
      [
        rat(t.m.n, t.m.d),
        rat(t.k.n + s * t.m.n * t.k.d, t.k.d * t.m.d),
        "It changes $x$ inside the rule, which shifts the graph sideways. The shift in $g$ is applied to the output, after multiplying by the slope.",
      ],
    ];
    const wrong = shuffle(
      r,
      cands
        .filter(([mm, kk]) => !(ratEq(mm, t.m) && ratEq(kk, shifted)))
        .map(([mm, kk, feedback]) => ({ text: g(kk, mm), feedback })),
    ).slice(0, 3);
    if (wrong.length < 3 || new Set(wrong.map((w) => w.text)).size < 3)
      return null;
    const options: ChoiceOption[] = [
      { label: g(shifted), correct: true },
      ...wrong.map((w) => ({ label: w.text, feedback: w.feedback })),
    ];
    return withFigure(
      choiceSurface(r, {
        prompt: `The table shows values of a linear function $f$. The function $g$ is defined by $g(x) = f(x) ${s < 0 ? "−" : "+"} ${Math.abs(s)}$. Which equation defines $g$?`,
        options,
        hint: `First find the rule for $f$ from the table: from the first column to the second, the input changes by ${qt(dx)} and the output changes by ${qt(dy)}. Then ${s < 0 ? `subtract ${-s} from` : `add ${s} to`} every output.`,
        explanation: [
          ...slopeSteps,
          `So $f(x) = ${coefX(t.m)}x ${t.k.n < 0 ? "−" : "+"} ${qt(rat(Math.abs(t.k.n), t.k.d))}$, where $f(x)$, read "$f$ of $x$", is the output for input $x$.`,
          `The rule $g(x) = f(x) ${s < 0 ? "−" : "+"} ${Math.abs(s)}$ ${s < 0 ? `subtracts ${-s} from` : `adds ${s} to`} every output of $f$. That moves the graph ${s < 0 ? "down" : "up"} and leaves the slope the same.`,
          `Only the constant changes: $${qt(t.k)} ${s < 0 ? "−" : "+"} ${Math.abs(s)} = ${qt(shifted)}$.`,
          `So the rule is ${g(shifted)}.`,
        ],
        label: "Choose the equation",
      }),
      scene,
    );
  },
});

export const systemLineChoiceTemplates = [
  systemSecondEquationTemplate,
  parallelLineInterceptTemplate,
  tableStandardFormTemplate,
] as const;
export const systemLineChoiceGenerate = dispatch(systemLineChoiceTemplates, {
  "system-second-equation": (seed) =>
    systemSecondEquationFamily.generate(seed).problem,
  "parallel-line-intercept": (seed) =>
    parallelLineInterceptFamily.generate(seed).problem,
  "table-standard-form": (seed) =>
    tableStandardFormFamily.generate(seed).problem,
});
