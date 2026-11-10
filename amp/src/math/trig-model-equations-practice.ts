import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import {
  defineGenerate,
  entry,
  multiPartCapability,
  multiPartProblem,
  need,
  pick,
  shuffle,
  type Random,
} from "./multi-part-support";
import { f as fn, graph } from "./scene/author";
import { defineAxis } from "./variation/axes";

/**
 * HSF.TF.B.7: solve trigonometric equations that come from sinusoidal
 * models (tides, a Ferris wheel, temperature, daylight, a spring) with
 * inverse functions, evaluate the solutions with a calculator in radian
 * mode, and interpret them in context. Three types:
 *
 * - `trig-model-inverse-setup` (multi-part choice): isolate the
 *   trigonometric expression, write one solution with the inverse
 *   function, and evaluate the first time in the domain.
 * - `trig-model-solve-interval` (single choice): the complete solution set
 *   on the domain, the next solution after a given one, or the count.
 * - `trig-model-interpret-solutions` (single choice): instants, recurrence,
 *   no solution, a negative time, and when the quantity is above or below.
 *
 * Every model keeps exact parameters; solutions are computed in double
 * precision and rounded only for display. A seed whose solutions sit near a
 * rounding boundary, near an end of the domain, or too close together is
 * redrawn, so each shown value is unambiguous.
 */

const band = "9–12" as const;
const skillId = "trigonometric-equations";
const graphs = { requiredFigureCapability: "scenes-v1" as const };
export const trigModelEquationsTemplates: readonly TemplateMetadata[] = [
  {
    id: "trig-model-inverse-setup",
    version: 1,
    title: "Set up and solve with an inverse function",
    skillId,
    gradeBand: band,
    difficultyOffset: 0.6,
    ...multiPartCapability,
    ...graphs,
    description:
      "From a sinusoidal model of a tide, a Ferris wheel, a day's temperature, daylight or a spring, isolate the sine or cosine, choose the inverse-function expression for one solution, and give the first time in the domain to the nearest hundredth (or day), found with a calculator in radian mode.",
  },
  {
    id: "trig-model-solve-interval",
    version: 1,
    title: "All solutions on the model's domain",
    skillId,
    gradeBand: band,
    difficultyOffset: 0.7,
    requiredResponseCapability: "single-choice-v1",
    ...graphs,
    description:
      "Find every time in a sinusoidal model's domain when it reaches a value, the next time after a given one, or how many times it does. The second solution comes from symmetry ($\\pi-\\theta$ for sine, $-\\theta$ for cosine) and more come from adding periods.",
  },
  {
    id: "trig-model-interpret-solutions",
    version: 1,
    title: "Interpret the solutions of a model",
    skillId,
    gradeBand: band,
    difficultyOffset: 0.55,
    requiredResponseCapability: "single-choice-v1",
    ...graphs,
    description:
      "Interpret solutions of a sinusoidal model's equation in context: instants rather than durations, repeats every period, no solution when the value is outside the model's range, a negative time shifted by a period, and the times the quantity is above or below the value.",
  },
];

/* ------------------------------------------------------------ contexts */

type ContextId = "tide" | "ferris" | "temperature" | "daylight" | "spring";
type Form = "sin" | "cos" | "neg-cos";
interface Context {
  id: ContextId;
  fnName: string;
  /** "The water depth at a harbor, in meters, $t$ hours after midnight". */
  quantity: string;
  /** Unit symbol after a value: "m", "°C"; empty for daylight hours. */
  unit: string;
  timeUnit: string;
  /** "hours after midnight", for a time value. */
  after: string;
  /** "the depth is 4.2 m" for a value. */
  is: (k: string) => string;
  /** The axis names. */
  axes: [string, string];
  /** "every 12.4 hours". */
  periodWords: (p: string) => string;
}
const CONTEXTS: Record<ContextId, Context> = {
  tide: {
    id: "tide",
    fnName: "d",
    quantity:
      "The water depth at a harbor, in meters, $t$ hours after midnight",
    unit: "m",
    timeUnit: "hours",
    after: "hours after midnight",
    is: (k) => `the depth is ${k} m`,
    axes: ["t (hours)", "depth (m)"],
    periodWords: (p) => `The tide repeats every ${p} hours.`,
  },
  ferris: {
    id: "ferris",
    fnName: "h",
    quantity:
      "A rider boards a Ferris wheel at its lowest point. The rider's height above the ground, in meters, $t$ seconds after boarding",
    unit: "m",
    timeUnit: "seconds",
    after: "seconds after boarding",
    is: (k) => `the rider is ${k} m above the ground`,
    axes: ["t (seconds)", "height (m)"],
    periodWords: (p) => `The wheel turns once every ${p} seconds.`,
  },
  temperature: {
    id: "temperature",
    fnName: "T",
    quantity:
      "The air temperature, in degrees Celsius, $t$ hours after midnight",
    unit: "°C",
    timeUnit: "hours",
    after: "hours after midnight",
    is: (k) => `the temperature is ${k} °C`,
    axes: ["t (hours)", "temperature (°C)"],
    periodWords: () => "The pattern repeats every 24 hours.",
  },
  daylight: {
    id: "daylight",
    fnName: "L",
    quantity:
      "The number of hours of daylight in a city $t$ days after January 1",
    unit: "",
    timeUnit: "days",
    after: "days after January 1",
    is: (k) => `there are ${k} hours of daylight`,
    axes: ["t (days)", "daylight (hours)"],
    periodWords: () => "The pattern repeats every 365 days.",
  },
  spring: {
    id: "spring",
    fnName: "s",
    quantity:
      "A weight bobs on a spring. Its displacement from rest, in centimeters, $t$ seconds after a timer starts",
    unit: "cm",
    timeUnit: "seconds",
    after: "seconds after the timer starts",
    is: (k) => `the displacement is ${k} cm`,
    axes: ["t (seconds)", "displacement (cm)"],
    periodWords: (p) => `It completes one cycle every ${p} seconds.`,
  },
};

/* --------------------------------------------------------------- model */

export interface TrigModel {
  ctx: ContextId;
  form: Form;
  A: number;
  D: number;
  P: number;
  /** Horizontal shift; 0 for neg-cos. */
  C: number;
  k: number;
  /** Domain [0, T]. */
  T: number;
  /** The isolated equation's right side: sin(·) = r, cos(·) = r. */
  r: number;
  /** Decimal places shown for times: 2, or 0 for whole days. */
  dp: 0 | 2;
  /** Every solution in [0, T], ascending (empty when |r| > 1). */
  sols: number[];
}
const round = (n: number, places = 6) =>
  Math.round(n * 10 ** places) / 10 ** places;
/** A parameter as text: 12.4, 3, −2 (TeX minus inside formulas). */
export const num = (n: number) => String(round(n, 4));
const B = (m: Pick<TrigModel, "P">) => (2 * Math.PI) / m.P;
/** The model's value at t. */
export function modelValue(m: TrigModel, t: number): number {
  const b = B(m);
  if (m.form === "sin") return m.A * Math.sin(b * (t - m.C)) + m.D;
  if (m.form === "cos") return m.A * Math.cos(b * (t - m.C)) + m.D;
  return m.D - m.A * Math.cos(b * t);
}
/** The principal angle: arcsin r for sine, arccos r for the cosines. */
const principal = (m: TrigModel, r = m.r) =>
  m.form === "sin" ? Math.asin(r) : Math.acos(r);
/** Times of the two branches for one angle θ (radians), before periods. */
function branches(m: TrigModel, theta: number): [number, number] {
  const s = theta / B(m);
  if (m.form === "sin") return [m.C + s, m.C + m.P / 2 - s];
  if (m.form === "cos") return [m.C + s, m.C - s];
  return [s, -s];
}
/** Every time base + nP inside [lo, hi]. */
function periodic(m: TrigModel, base: number, lo = 0, hi = m.T): number[] {
  const out: number[] = [];
  for (let n = Math.ceil((lo - base) / m.P); base + n * m.P <= hi; n++)
    out.push(base + n * m.P);
  return out;
}
const setOf = (m: TrigModel, bases: number[]) =>
  bases.flatMap((b) => periodic(m, b)).sort((a, b) => a - b);
export const solutionsOf = (m: TrigModel) =>
  Math.abs(m.r) > 1 ? [] : setOf(m, branches(m, principal(m)));

const SPECIAL = [0, 0.5, Math.SQRT1_2, Math.sqrt(3) / 2];
const special = (r: number) =>
  SPECIAL.some((s) => Math.abs(Math.abs(r) - s) < 0.02);
/** The shown time. */
export const shown = (m: Pick<TrigModel, "dp">, t: number) =>
  m.dp === 2 ? t.toFixed(2) : String(Math.round(t));
const nearHalf = (x: number) => {
  const f = x - Math.floor(x);
  return f > 0.35 && f < 0.65;
};
/** True when shown values are clearly different. */
const apart = (m: Pick<TrigModel, "dp">, a: number, b: number) =>
  Math.abs(a - b) > (m.dp === 2 ? 0.05 : 2);
/** A shown value is unambiguous: not near a rounding boundary. */
const clean = (m: Pick<TrigModel, "dp">, t: number) =>
  !nearHalf(m.dp === 2 ? t * 100 : t);

/** Draw a model of one context and form, with r of the requested sign. */
function drawModel(
  rr: Random,
  ctx: ContextId,
  form: Form,
  o: { sign?: 1 | -1; outside?: boolean; shift?: boolean } = {},
): TrigModel {
  let A: number, D: number, P: number, C: number, T: number;
  let step = 0.1; // the target's step
  switch (ctx) {
    case "tide":
      A = 0.5 * rr(2, 6);
      D = 0.5 * rr(6, 12);
      need(D - A >= 0.5, "a positive depth");
      P = pick(rr, [12, 12.4, 12.5]);
      C = 0.5 * rr(o.shift ? 1 : 0, 10);
      T = 24;
      break;
    case "ferris":
      A = rr(10, 25);
      D = A + rr(1, 3);
      P = pick(rr, [20, 24, 30, 36, 40, 45, 60]);
      C = 0;
      T = 2 * P;
      step = 1;
      break;
    case "temperature":
      A = rr(4, 12);
      D = rr(10, 25);
      P = 24;
      C = pick(rr, [14, 15, 16]);
      T = 24;
      break;
    case "daylight":
      A = 0.5 * rr(4, 9);
      D = 12;
      P = 365;
      C = 80;
      T = 365;
      break;
    case "spring":
      A = rr(3, 10);
      D = 0;
      // 1.5–4 seconds: a 1-second period would read "every 1 seconds".
      P = 0.5 * rr(3, 8);
      C = o.shift ? pick(rr, [P / 8, P / 4]) : pick(rr, [0, P / 8, P / 4]);
      T = 2 * P;
      step = 1;
      break;
    default:
      throw new Error(`Unknown context ${ctx as string}`);
  }
  const base = {
    ctx,
    form,
    A,
    D,
    P,
    C,
    T,
    dp: ctx === "daylight" ? 0 : 2,
  } as const;
  const ratio = (k: number) => (form === "neg-cos" ? (D - k) / A : (k - D) / A);
  for (let attempt = 0; attempt < 40; attempt++) {
    let k: number;
    if (o.outside) {
      const s = rr(0, 1) ? 1 : -1;
      const over = step === 1 ? rr(1, 2) : 0.1 * rr(5, 20);
      k = round(D + s * (A + over));
      if (ctx !== "spring" && ctx !== "temperature" && k <= 0) continue;
      const r = ratio(k);
      if (!(Math.abs(r) > 1.1 && Math.abs(r) <= 1.8)) continue;
      return { ...base, k, r, sols: [] };
    }
    const lo = Math.ceil((D - 0.9 * A) / step),
      hi = Math.floor((D + 0.9 * A) / step);
    k = round(rr(lo, hi) * step);
    const r = ratio(k);
    if (Math.abs(r) > 0.9 || special(r)) continue;
    if (o.sign && Math.sign(r) !== o.sign) continue;
    const m: TrigModel = { ...base, k, r, sols: [] };
    m.sols = solutionsOf(m);
    const edge = m.dp === 2 ? 0.05 : 1;
    if (m.sols.length < 2) continue;
    if (m.sols.some((t) => t < edge || t > T - edge || !clean(m, t))) continue;
    if (m.sols.some((t, i) => i > 0 && !apart(m, t, m.sols[i - 1]!))) continue;
    return m;
  }
  throw new Error("Need a model with clean solutions");
}

/* ------------------------------------------------------------ writing */

/** B as TeX: 2π/P reduced, e.g. \frac{\pi}{6}, \frac{5\pi}{31}. */
function fracPi(n: number, d: number, piOnTop: boolean): string {
  const g = gcd(n, d);
  const [p, q] = [n / g, d / g];
  if (piOnTop) {
    const top = p === 1 ? "\\pi" : `${p}\\pi`;
    return q === 1 ? top : `\\frac{${top}}{${q}}`;
  }
  return `\\frac{${p}}{${q === 1 ? "" : q}\\pi}`;
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** P as a fraction p/q with q in {1, 2, 10}. */
const periodFraction = (P: number): [number, number] => {
  for (const q of [1, 2, 10])
    if (Number.isInteger(round(P * q))) return [round(P * q), q];
  throw new Error("period");
};
export const bTex = (m: Pick<TrigModel, "P">) => {
  const [p, q] = periodFraction(m.P);
  return fracPi(2 * q, p, true);
};
/** 1/B as TeX: P/(2π) reduced, e.g. \frac{6}{\pi}, \frac{31}{5\pi}. */
export const invBTex = (m: Pick<TrigModel, "P">) => {
  const [p, q] = periodFraction(m.P);
  return fracPi(p, 2 * q, false);
};
/** An exact value of a tenths ratio a/b as TeX: 0.35, -\frac{8}{15}. */
export function ratioTex(a: number, b: number): string {
  const n = Math.round(a * 10),
    d = Math.round(b * 10);
  if (n === 0) return "0";
  const g = gcd(Math.abs(n), Math.abs(d));
  let [p, q] = [n / g, d / g];
  if (q < 0) [p, q] = [-p, -q];
  let rest = q;
  for (const f of [2, 5]) while (rest % f === 0) rest /= f;
  if (rest === 1 && String(Math.abs(p / q)).length <= 5) return num(p / q);
  return `${p < 0 ? "-" : ""}\\frac{${Math.abs(p)}}{${q}}`;
}
/** The isolated equation's right side, exactly. */
const rTex = (m: TrigModel) =>
  m.form === "neg-cos" ? ratioTex(m.D - m.k, m.A) : ratioTex(m.k - m.D, m.A);
const trig = (m: TrigModel) => (m.form === "sin" ? "\\sin" : "\\cos");
const inverse = (m: TrigModel) => (m.form === "sin" ? "\\arcsin" : "\\arccos");
/** The argument B(t − C), or Bt. */
const argTex = (m: TrigModel) =>
  m.C === 0 ? `${bTex(m)} t` : `${bTex(m)}(t-${num(m.C)})`;
/** A leading coefficient: 1 is not written. */
const coef = (a: number) => (a === 1 ? "" : num(a));
export function modelTex(m: TrigModel): string {
  const name = `${CONTEXTS[m.ctx].fnName}(t)`;
  if (m.form === "neg-cos")
    return `${name}=${num(m.D)}-${coef(m.A)}\\cos\\left(${argTex(m)}\\right)`;
  const tail = m.D === 0 ? "" : `+${num(m.D)}`;
  return `${name}=${coef(m.A)}${trig(m)}\\left(${argTex(m)}\\right)${tail}`;
}
/** A value in prose: a true minus sign, no float noise. */
const numText = (v: number) => (v < 0 ? `−${num(-v)}` : num(v));
const valueText = (m: TrigModel, v = m.k) => {
  const u = CONTEXTS[m.ctx].unit;
  return u ? `${numText(v)} ${u}` : numText(v);
};
/** "The water depth … is modeled by $d(t)=…$ for $0\le t\le 24$. …" */
function setting(m: TrigModel, open = false): string {
  const c = CONTEXTS[m.ctx];
  const domain = open ? "$t\\ge0$" : `$0\\le t\\le ${num(m.T)}$`;
  return `${c.quantity} is modeled by $${modelTex(m)}$ for ${domain}, with the angle in radians. ${c.periodWords(num(m.P))}`;
}
const is = (m: TrigModel, v = m.k) => CONTEXTS[m.ctx].is(numText(v));
const after = (m: TrigModel) => CONTEXTS[m.ctx].after;
const roundWords = (m: TrigModel) =>
  m.dp === 2 ? "to the nearest hundredth" : "to the nearest day";
const thetaText = (theta: number) => theta.toFixed(4);

/** The model's graph over its domain, with the dashed line y = k. */
function modelFigure(m: TrigModel, marks: number[] = []): SemanticFigure {
  const c = CONTEXTS[m.ctx];
  const lo0 = Math.min(m.D - m.A, m.k),
    hi0 = Math.max(m.D + m.A, m.k);
  const ys = niceStep((hi0 - lo0) / 6);
  let lo = Math.floor((lo0 - 0.15 * (hi0 - lo0)) / ys) * ys;
  if (lo0 >= 0 && lo < 0) lo = 0;
  const hi = Math.ceil((hi0 + 0.15 * (hi0 - lo0)) / ys) * ys;
  const xs = niceStep(m.T / 12);
  const curve =
    m.form === "sin"
      ? fn.sin(m.A, B(m), { h: m.C, k: m.D })
      : m.form === "cos"
        ? fn.cos(m.A, B(m), { h: m.C, k: m.D })
        : fn.cos(-m.A, B(m), { k: m.D });
  let g = graph({
    x: [0, m.T],
    y: [lo, hi],
    grid: [xs, ys],
    tick: [2 * xs, 2 * ys],
    labels: "auto",
    axisNames: c.axes,
    frame: true,
  })
    .id("g")
    .curve(curve, { color: "accent" })
    .line({ m: 0, b: m.k }, { dash: "dash", color: "gold" });
  for (const t of marks)
    g = g.point(round(t, 4), m.k, undefined, { color: "warm" });
  return {
    kind: "scene",
    scene: g.scene({
      title: `Graph of the model over its domain with a dashed horizontal line at ${valueText(m)}`,
    }),
  };
}
function niceStep(raw: number) {
  for (const s of [0.25, 0.5, 1, 2, 2.5, 5, 10, 15, 20, 25, 30, 50, 100])
    if (s >= raw) return s;
  return 100;
}

/* ------------------------------------------------------------ problems */

type Opt = { label: string; correct?: true; feedback?: string };
function choiceProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  built: {
    prompt: string;
    options: Opt[];
    hint: string;
    explanation: string[];
    figure: SemanticFigure;
    keepOrder?: boolean;
  },
): GeneratedProblem {
  const options = built.keepOrder
    ? built.options
    : shuffle(r, [...built.options]);
  need(
    options.length === 4 &&
      options.filter((o) => o.correct).length === 1 &&
      new Set(options.map((o) => o.label)).size === 4,
    "four distinct options",
  );
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const shownOptions = options.map((o, i) => {
    const id = `option-${"abcd"[i]}`;
    if (o.correct) answer = id;
    else choiceFeedback[id] = o.feedback!;
    return { id, label: o.label };
  });
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, meta.version, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: meta.skillId,
      response: {
        kind: "choice",
        label: "Choose one answer",
        options: shownOptions,
      },
      figure: built.figure,
    },
    answer,
    hint: built.hint,
    explanation: built.explanation,
    choiceFeedback,
  };
}
/** Values that are not solutions of the model, for wrong options. */
const notSolution = (m: TrigModel, t: number) =>
  !Number.isFinite(t) || Math.abs(modelValue(m, t) - m.k) > 0.01 * m.A;
/** The first n candidates whose shown values differ from `taken` and from
 * each other. */
function distinctValues<T extends { value: number }>(
  m: TrigModel,
  taken: number[],
  pool: T[],
  n: number,
): T[] {
  const out: T[] = [];
  const used = [...taken];
  for (const c of pool) {
    if (!Number.isFinite(c.value)) continue;
    if (used.every((u) => apart(m, u, c.value)) && clean(m, c.value)) {
      out.push(c);
      used.push(c.value);
    }
    if (out.length === n) break;
  }
  need(out.length === n, "distinct wrong values");
  return out;
}

/** The explanation's first steps: isolate and invert. */
function solveSteps(m: TrigModel): string[] {
  const theta = principal(m);
  const range =
    m.form === "sin" ? "[-\\frac{\\pi}{2},\\frac{\\pi}{2}]" : "[0,\\pi]";
  const isolate =
    m.form === "neg-cos"
      ? `Subtract ${num(m.D)} and divide by $-${num(m.A)}$: $\\cos\\left(${argTex(m)}\\right)=${rTex(m)}$.`
      : `${m.D === 0 ? "Divide" : `Subtract ${num(m.D)} and divide`} by ${num(m.A)}: $${trig(m)}\\left(${argTex(m)}\\right)=${rTex(m)}$. Isolate the ${m.form === "sin" ? "sine" : "cosine"} before using an inverse.`;
  return [
    isolate,
    `$${inverse(m)}$ gives the one angle in $${range}$ with this ${m.form === "sin" ? "sine" : "cosine"}: $${argTex(m)}=${inverse(m)}\\left(${rTex(m)}\\right)\\approx ${thetaText(theta)}$ radians.`,
  ];
}
const firstShift = (m: TrigModel) =>
  m.form === "neg-cos" ? "" : m.C === 0 ? "" : `${num(m.C)}+`;

/* ---------------------------------------- 1. set up and solve (slots) */

const setupAxes = {
  model: defineAxis("model", ["sin-shift", "cos-shift", "negcos"] as const),
  sign: defineAxis("sign", ["positive", "negative"] as const, {
    weights: [3, 1],
  }),
};

function setupProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  axes: {
    model: "sin-shift" | "cos-shift" | "negcos";
    sign: "positive" | "negative";
  },
): GeneratedProblem {
  const sign = axes.sign === "negative" ? -1 : 1;
  const m =
    axes.model === "negcos"
      ? drawModel(r, "ferris", "neg-cos", { sign })
      : axes.model === "cos-shift"
        ? drawModel(r, pick(r, ["temperature", "tide"] as const), "cos", {
            sign,
          })
        : drawModel(
            r,
            pick(r, ["tide", "daylight", "spring"] as const),
            "sin",
            {
              sign,
              shift: true,
            },
          );
  const theta = principal(m);
  const inv = invBTex(m);
  const shift = firstShift(m);
  const expr = (f: string, arg = rTex(m), scale = inv, add = shift) =>
    `$t=${add}${scale}${f}\\left(${arg}\\right)$`;
  // Part A: the isolated equation.
  const lhs = `${trig(m)}\\left(${argTex(m)}\\right)`;
  const eq = (v: string) => `$${lhs}=${v}$`;
  const isolatedWrong =
    m.form === "neg-cos"
      ? [
          { v: (m.k - m.D) / m.A, t: ratioTex(m.k - m.D, m.A) },
          { v: m.D - m.k, t: num(m.D - m.k) },
          { v: m.k, t: num(m.k) },
          { v: m.k / m.A, t: ratioTex(m.k, m.A) },
          { v: (m.D - m.k) * m.A, t: num((m.D - m.k) * m.A) },
        ]
      : [
          { v: m.k - m.D, t: num(m.k - m.D) },
          { v: m.k / m.A, t: ratioTex(m.k, m.A) },
          { v: m.k, t: num(m.k) },
          { v: (m.D - m.k) / m.A, t: ratioTex(m.D - m.k, m.A) },
          { v: (m.k - m.D) * m.A, t: num((m.k - m.D) * m.A) },
        ];
  const aWrong = isolatedWrong
    .filter((w) => Math.abs(w.v - m.r) > 1e-9)
    .filter(
      (w, i, all) => all.findIndex((x) => Math.abs(x.v - w.v) < 1e-9) === i,
    )
    .slice(0, 3)
    .map((w) => eq(w.t));
  need(aWrong.length === 3, "three wrong isolated equations");
  // Part B: one solution; wrong expressions are checked not to be solutions.
  const other = m.form === "sin" ? "\\arccos" : "\\arcsin";
  const bWrong: { label: string; value: number }[] = [
    ...(shift
      ? [{ label: expr(inverse(m), rTex(m), inv, ""), value: theta / B(m) }]
      : []),
    { label: expr(inverse(m), rTex(m), "", shift), value: (m.C || 0) + theta },
    {
      label: expr(other, rTex(m)),
      value:
        (m.C || 0) +
        (m.form === "sin" ? Math.acos(m.r) : Math.asin(m.r)) / B(m),
    },
    {
      label: expr(inverse(m), rTex(m), bTex(m), shift),
      value: (m.C || 0) + theta * B(m),
    },
  ].filter((w) => notSolution(m, w.value));
  need(bWrong.length >= 3, "three wrong expressions");
  // Part C: the first time, against tracked slips.
  const first = m.sols[0]!;
  const principalTime = branches(m, theta)[0];
  const degrees = (theta * 180) / Math.PI;
  const cPool = [
    { value: branches(m, degrees)[0], why: "degrees" },
    ...(shift ? [{ value: theta / B(m), why: "no-shift" }] : []),
    { value: m.sols[1]!, why: "second" },
    { value: principalTime, why: "principal" },
    { value: (m.C || 0) + theta, why: "no-divide" },
  ];
  const cWrong = distinctValues(m, [first], cPool, 3);
  const tl = (t: number) => `$${shown(m, t)}$`;
  const ctx = CONTEXTS[m.ctx];
  const prompt = `${setting(m)} Find the first time $t\\ge0$ when ${is(m)}. Use a calculator in radian mode.`;
  const firstNote =
    Math.abs(principalTime - first) < 1e-9
      ? `This is the first time: the other solution in this cycle, $t\\approx${shown(m, m.sols[1]!)}$, comes later.`
      : principalTime < 0
        ? `This time is negative, before the domain begins. The first time in the domain is $t\\approx${shown(m, first)}$, ${m.form === "sin" ? "from the second angle, $\\pi-\\theta$," : "from the angle $-\\theta$,"} plus whole periods.`
        : `The angle $-\\theta$ has the same cosine and gives another solution, $t=${m.C ? num(m.C) : ""}-${inv}\\arccos\\left(${rTex(m)}\\right)${(() => {
            const n = Math.round((first - branches(m, theta)[1]) / m.P);
            return n > 0 ? `+${n === 1 ? "" : n}${num(m.P)}` : "";
          })()}\\approx ${shown(m, first)}$. It comes first, so it is the answer.`;
  return multiPartProblem(meta, seed, r, {
    prompt,
    layout: "slots",
    label: "Choose an answer for each part",
    slots: [
      {
        id: "isolate",
        label: `A. An equation equivalent to $${ctx.fnName}(t)=${num(m.k)}$, with the ${m.form === "sin" ? "sine" : "cosine"} alone`,
        correct: eq(rTex(m)),
        wrong: aWrong,
      },
      {
        id: "inverse",
        label: "B. An expression for one solution of that equation",
        correct: expr(inverse(m)),
        wrong: shuffle(
          r,
          bWrong.map((w) => w.label),
        ).slice(0, 3),
      },
      {
        id: "first",
        label: `C. The first time $t\\ge0$, ${roundWords(m)}`,
        correct: tl(first),
        wrong: cWrong.map((w) => tl(w.value)),
      },
    ],
    figure: modelFigure(m),
    hint: `Treat $${lhs}$ as one unknown. ${m.form === "neg-cos" ? `Subtract ${num(m.D)} and divide by $-${num(m.A)}$` : `${m.D === 0 ? "D" : `Subtract ${num(m.D)} and d`}ivide by ${num(m.A)}`} first, then apply the inverse ${m.form === "sin" ? "sine" : "cosine"} and undo the $${bTex(m)}$${shift ? ` and the shift of ${num(m.C)}` : ""}. Keep the calculator in radians.`,
    explanation: [
      ...solveSteps(m),
      `Multiply by $${inv}$${shift ? ` and add ${num(m.C)}` : ""}: $t=${shift}${inv}${inverse(m)}\\left(${rTex(m)}\\right)\\approx ${shown(m, principalTime)}$. Dividing by $${bTex(m)}$ is multiplying by $${inv}$; leaving it out, or using the other inverse, gives a time that does not solve the equation.`,
      firstNote,
      `In degree mode the calculator would give ${degrees.toFixed(2)} instead of ${thetaText(theta)}, and the time would be wrong: the model's angle is in radians.`,
      `So ${is(m)} first about ${shown(m, first)} ${after(m)}. On the graph, the dashed line meets the curve there first.`,
    ],
  });
}

/* ------------------------------------- 2. the solution set (single choice) */

const intervalAxes = {
  ask: defineAxis("ask", ["all", "next", "count"] as const, {
    weights: [5, 4, 2],
  }),
};
const MODELS: readonly [ContextId, Form][] = [
  ["tide", "sin"],
  ["tide", "cos"],
  ["ferris", "neg-cos"],
  ["temperature", "cos"],
  ["daylight", "sin"],
  ["spring", "sin"],
];
const setTex = (m: TrigModel, ts: number[]) =>
  `$\\{${ts.map((t) => shown(m, t)).join(",\\ ")}\\}$`;
const sameSet = (m: TrigModel, a: number[], b: number[]) =>
  a.length === b.length && a.every((t, i) => !apart(m, t, b[i]!));

function intervalProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  ask: "all" | "next" | "count",
): GeneratedProblem {
  const [ctxId, form] = pick(r, MODELS);
  const m = drawModel(r, ctxId, form, { sign: r(0, 1) ? 1 : -1 });
  const theta = principal(m);
  const [a, b] = branches(m, theta);
  const s = theta / B(m);
  const ctx = CONTEXTS[m.ctx];
  const symmetry =
    m.form === "sin"
      ? `$\\arcsin$ gives only angles in $[-\\frac{\\pi}{2},\\frac{\\pi}{2}]$. The other angle in one turn with the same sine is $\\pi-\\theta$.`
      : `$\\arccos$ gives only angles in $[0,\\pi]$. The other angle in one turn with the same cosine is $-\\theta$, because cosine is even.`;
  const steps = [
    ...solveSteps(m),
    symmetry,
    `The two angles give the times $t\\approx${shown(m, a)}$ and $t\\approx${shown(m, b)}$${b < 0 ? ", which is before the domain begins" : ""}.`,
    `The model repeats every ${num(m.P)} ${ctx.timeUnit}: add or subtract ${num(m.P)} while $t$ stays in $[0,${num(m.T)}]$. The times are ${setTex(m, m.sols)}, one for each crossing of the dashed line.`,
  ];
  const hintBase = `Your calculator gives one angle, $\\theta=${inverse(m)}\\left(${rTex(m)}\\right)$. Which other angle in one turn has the same ${m.form === "sin" ? "sine" : "cosine"}? Turn both into times, then add ${num(m.P)} ${ctx.timeUnit} at a time while $t\\le${num(m.T)}$.`;

  if (ask === "all") {
    const wrongPartner =
      m.form === "sin"
        ? m.C - s
        : m.form === "cos"
          ? m.C + m.P / 2 - s
          : m.P / 2 - s;
    const ignoresShift = m.form === "sin" ? m.P / 2 - m.C - s : -m.C - s;
    const thetaDeg = (theta * 180) / Math.PI;
    const candidates: { set: number[]; feedback: string }[] = [
      {
        set: setOf(m, [a]),
        feedback: `This keeps only the angle the calculator gives. The inverse gives one angle; the ${m.form === "sin" ? "sine" : "cosine"} has the same value at a second angle in each turn.`,
      },
      {
        set: setOf(m, [a, wrongPartner]),
        feedback: `The second angle comes from the wrong rule. For ${m.form === "sin" ? "sine it is $\\pi-\\theta$, not $-\\theta$" : "cosine it is $-\\theta$, not $\\pi-\\theta$"}.`,
      },
      ...(m.form === "neg-cos"
        ? []
        : [
            {
              set: setOf(m, [a, ignoresShift]),
              feedback: `The second time was reflected without the shift of ${num(m.C)}: undo the shift after using the second angle.`,
            },
          ]),
      {
        set: m.sols.filter((t) => t <= m.P),
        feedback: `These are only the times in the first cycle. The model repeats every ${num(m.P)} ${ctx.timeUnit}, so add ${num(m.P)} while $t\\le${num(m.T)}$.`,
      },
      {
        set: setOf(m, branches(m, thetaDeg)),
        feedback:
          "These come from an angle in degrees. The model's angle is in radians, so the calculator must be in radian mode.",
      },
    ];
    const chosen: { set: number[]; feedback: string }[] = [];
    for (const c of candidates) {
      if (!c.set.length || !c.set.every((t) => clean(m, t))) continue;
      if (sameSet(m, c.set, m.sols)) continue;
      if (chosen.some((x) => sameSet(m, x.set, c.set))) continue;
      if (setTex(m, c.set).length > 120) continue;
      chosen.push(c);
    }
    need(chosen.length >= 3, "three wrong sets");
    // At least one wrong set has as many times as the key.
    const same = chosen.filter((c) => c.set.length === m.sols.length);
    need(same.length >= 1, "a wrong set of the key's size");
    const picked = [same[0]!, ...chosen.filter((c) => c !== same[0])].slice(
      0,
      3,
    );
    return choiceProblem(meta, seed, r, {
      prompt: `${setting(m)} Find all times in $0\\le t\\le ${num(m.T)}$ when ${is(m)}. Round ${roundWords(m)}.`,
      options: [
        { label: setTex(m, m.sols), correct: true },
        ...picked.map((c) => ({
          label: setTex(m, c.set),
          feedback: c.feedback,
        })),
      ],
      figure: modelFigure(m),
      hint: hintBase,
      explanation: steps,
    });
  }

  if (ask === "next") {
    const i = r(0, m.sols.length - 2);
    const t1 = m.sols[i]!,
      t2 = m.sols[i + 1]!;
    need(clean(m, t1), "a clean given time");
    /** The first time after t1 congruent to t modulo the period. */
    const nextAfter = (t: number) => {
      let v = t;
      while (v <= t1 + 1e-9) v += m.P;
      while (v - m.P > t1 + 1e-9) v -= m.P;
      return v;
    };
    const partner =
      m.form === "sin"
        ? 2 * m.C - t1
        : m.form === "cos"
          ? 2 * m.C + m.P / 2 - t1
          : m.P / 2 - t1;
    const noShift =
      m.form === "sin" ? m.P / 2 - t1 : m.form === "cos" ? -t1 : NaN;
    const pool = [
      {
        value: t1 + m.P,
        feedback: `That is a full period later. The value repeats sooner, at the second solution in the cycle.`,
      },
      {
        value: t1 + m.P / 2,
        feedback: `Half a period later the model is on the other side of its midline: $${num(2 * m.D - m.k)}$, not ${valueText(m)}.`,
      },
      {
        value: nextAfter(partner),
        feedback: `The second angle came from the wrong rule: for ${m.form === "sin" ? "sine use $\\pi-\\theta$" : "cosine use $-\\theta$"}.`,
      },
      {
        value: nextAfter(noShift),
        feedback: `The reflection left out the shift of ${num(m.C)}.`,
      },
    ].filter(
      (c) => notSolution(m, c.value) || Math.abs(c.value - (t1 + m.P)) < 1e-9,
    );
    const wrong = distinctValues(m, [t2, t1], pool, 3);
    const unitText = ctx.timeUnit;
    return choiceProblem(meta, seed, r, {
      prompt: `${setting(m)} ${is(m)[0]!.toUpperCase()}${is(m).slice(1)} at about $t=${shown(m, t1)}$. Find the next time ${is(m)}. Round ${roundWords(m)}.`,
      options: [
        { label: `$t\\approx${shown(m, t2)}$`, correct: true },
        ...wrong.map((w) => ({
          label: `$t\\approx${shown(m, w.value)}$`,
          feedback: w.feedback,
        })),
      ],
      figure: modelFigure(m),
      hint: `At $t\\approx${shown(m, t1)}$ the angle is one of the two in a turn with this ${m.form === "sin" ? "sine" : "cosine"}. Find the other angle, turn it into a time, and add ${num(m.P)} ${unitText} if it comes before ${shown(m, t1)}.`,
      explanation: [
        ...steps.slice(0, 4),
        `The solutions in order are ${setTex(m, m.sols)}. The one after $t\\approx${shown(m, t1)}$ is $t\\approx${shown(m, t2)}$.`,
        `A full period later, $t\\approx${shown(m, t1 + m.P)}$, the value repeats too, but not first; half a period later the model is at $${num(2 * m.D - m.k)}$.`,
      ],
    });
  }

  // How many times.
  const count = m.sols.length;
  need(count >= 2 && count <= 4, "a count of 2 to 4");
  return choiceProblem(meta, seed, r, {
    prompt: `${setting(m)} How many times in $0\\le t\\le ${num(m.T)}$ is it true that ${is(m)}?`,
    options: [1, 2, 3, 4].map((n) =>
      n === count
        ? { label: String(n), correct: true as const }
        : {
            label: String(n),
            feedback:
              n === 1
                ? "The inverse gives one angle, but a second angle in each turn has the same value, and the model repeats."
                : n < count
                  ? `That counts too few. Count both solutions in each cycle, and every cycle that fits in $0\\le t\\le ${num(m.T)}$.`
                  : `That counts too many. Each cycle has two solutions; check which of them lie in $0\\le t\\le ${num(m.T)}$.`,
          },
    ),
    keepOrder: true,
    figure: modelFigure(m),
    hint: `${is(m)[0]!.toUpperCase()}${is(m).slice(1)} twice in each full cycle of ${num(m.P)} ${ctx.timeUnit}. How many cycles, and which parts of them, fit in $0\\le t\\le ${num(m.T)}$?`,
    explanation: [
      `${valueText(m)} lies between the model's least value, ${valueText(m, m.D - m.A)}, and its greatest, ${valueText(m, m.D + m.A)}, so the model reaches it twice in each cycle.`,
      ...steps,
      `That is ${count} times: the dashed line crosses the curve ${count} times on the graph.`,
    ],
  });
}

/* ---------------------------------------- 3. interpret the solutions */

const interpretAxes = {
  meaning: defineAxis("meaning", [
    "instants",
    "recurrence",
    "no-solution",
    "negative-time",
    "above-below",
  ] as const),
};

function interpretProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  meaning: (typeof interpretAxes.meaning.values)[number],
): GeneratedProblem {
  const Is = (m: TrigModel, v?: number) => {
    const t = is(m, v);
    return `${t[0]!.toUpperCase()}${t.slice(1)}`;
  };
  if (meaning === "no-solution") {
    const [ctxId, form] = pick(r, MODELS);
    const m = drawModel(r, ctxId, form, { outside: true });
    const above = m.k > m.D;
    const ctx = CONTEXTS[m.ctx];
    const edge = above ? m.D + m.A : m.D - m.A;
    const extreme = above ? "greatest" : "least";
    return choiceProblem(meta, seed, r, {
      prompt: `${setting(m)} Solving $${ctx.fnName}(t)=${num(m.k)}$ leads to $${trig(m)}\\left(${argTex(m)}\\right)=${rTex(m)}$, and a calculator gives an error for $${inverse(m)}\\left(${rTex(m)}\\right)$. What does this mean?`,
      options: [
        {
          label: `The value ${valueText(m)} is never reached: the model's ${extreme} value is ${valueText(m, edge)}.`,
          correct: true,
        },
        {
          label:
            "The calculator is in the wrong mode; in degree mode it would give a time.",
          feedback: `No angle has a ${m.form === "sin" ? "sine" : "cosine"} of $${rTex(m)}$, in radians or in degrees: the value is outside $[-1,1]$.`,
        },
        {
          label: `The equation has the solution $t=${num(m.C)}$.`,
          feedback: `At $t=${num(m.C)}$ the model gives ${valueText(m, modelValue(m, m.C))}, not ${valueText(m)}.`,
        },
        {
          label: `The value ${valueText(m)} is reached once per cycle, at the ${above ? "highest" : "lowest"} point.`,
          feedback: `The ${above ? "highest" : "lowest"} point is ${valueText(m, edge)}. ${valueText(m)} is beyond it, so it is never reached.`,
        },
      ],
      figure: modelFigure(m),
      hint: `A ${m.form === "sin" ? "sine" : "cosine"} is always between $-1$ and $1$. Here it would have to equal $${rTex(m)}$. What are the model's least and greatest values, ${num(m.D)} minus and plus ${num(m.A)}?`,
      explanation: [
        `A ${m.form === "sin" ? "sine" : "cosine"} is always between $-1$ and $1$, so no angle has a ${m.form === "sin" ? "sine" : "cosine"} of $${rTex(m)}$. That is why the calculator gives an error, in either mode.`,
        `The model ranges from $${num(m.D)}-${num(m.A)}=${num(m.D - m.A)}$ to $${num(m.D)}+${num(m.A)}=${num(m.D + m.A)}$. ${valueText(m)} is outside that range, so the equation has no solution: the ${ctx.axes[1].replace(/ \(.*\)$/, "")} never reaches it.`,
        "On the graph, the dashed line never meets the curve.",
      ],
    });
  }

  if (meaning === "negative-time") {
    // Cosine tide with 0 < C < θ/B: the −θ branch gives a negative time.
    let m: TrigModel | null = null;
    for (let i = 0; i < 30 && !m; i++) {
      const c = drawModel(r, "tide", "cos", { shift: true });
      const s0 = principal(c) / B(c);
      if (c.C < s0 - 0.3) m = c;
    }
    need(m !== null, "a negative branch");
    const mm = m!;
    const theta = principal(mm);
    const t0 = theta / B(mm) - mm.C;
    const later = mm.P - t0;
    need(clean(mm, t0) && apart(mm, t0, later), "a clean negative time");
    need(notSolution(mm, t0), "an absolute value that is not a solution");
    need(
      mm.sols.every((t) => apart(mm, t, t0)),
      "an absolute value apart from the solutions",
    );
    return choiceProblem(meta, seed, r, {
      prompt: `${setting(mm)} Solving $d(t)=${num(mm.k)}$ with the inverse cosine, one student gets $t=${num(mm.C)}-${invBTex(mm)}\\arccos\\left(${rTex(mm)}\\right)\\approx-${shown(mm, t0)}$. What does this negative time mean?`,
      options: [
        {
          label: `It is before midnight. Adding one period gives a later time with the same depth: about ${shown(mm, later)} hours.`,
          correct: true,
        },
        {
          label: "A negative time means the equation has no solution.",
          feedback: `The graph crosses the dashed line in the domain. A negative time is a solution before the domain begins; shift it by a period.`,
        },
        {
          label: `Take the absolute value: the time is about ${shown(mm, t0)} hours.`,
          feedback: `At $t\\approx${shown(mm, t0)}$ the model gives about $${modelValue(mm, t0).toFixed(2)}$ m, not ${valueText(mm)}. The value repeats after a period, not after a sign change.`,
        },
        {
          label: "The model is wrong, because time cannot be negative.",
          feedback:
            "The formula works for every $t$; a negative $t$ is simply a time before midnight. The tide repeats, so adding a period gives a time in the domain.",
        },
      ],
      figure: modelFigure(mm),
      hint: `The tide repeats every ${num(mm.P)} hours. What time in the domain has the same depth as $t\\approx-${shown(mm, t0)}$?`,
      explanation: [
        `$t\\approx-${shown(mm, t0)}$ solves the equation, but it is ${shown(mm, t0)} hours before midnight, outside $0\\le t\\le 24$.`,
        `The model repeats every ${num(mm.P)} hours, so $t\\approx-${shown(mm, t0)}+${num(mm.P)}=${shown(mm, later)}$ gives the same depth, ${valueText(mm)}. It is in the domain.`,
        `Its absolute value, ${shown(mm, t0)}, is not a solution, and a negative time does not make the model wrong. All the times in the domain are ${setTex(mm, mm.sols)}.`,
      ],
    });
  }

  // The remaining meanings use a model whose domain shows the repeat.
  const ctxId = pick(r, ["tide", "ferris", "spring"] as const);
  const form: Form =
    ctxId === "ferris"
      ? "neg-cos"
      : ctxId === "tide"
        ? pick(r, ["sin", "cos"] as const)
        : "sin";
  const m = drawModel(r, ctxId, form, { sign: r(0, 1) ? 1 : -1 });
  const ctx = CONTEXTS[m.ctx];
  const [t1, t2] = [m.sols[0]!, m.sols[1]!];
  need(m.sols.length >= 3 && t1 + m.P <= m.T, "a repeat inside the domain");
  const T1 = shown(m, t1),
    T2 = shown(m, t2);
  const unit = ctx.timeUnit;

  if (meaning === "instants") {
    const options: Opt[] = [
      {
        label: `${Is(m)} at about ${T1} ${unit} and again at about ${T2} ${unit}.`,
        correct: true,
      },
      {
        label: `${Is(m)} for about ${T1} ${unit}, then it changes.`,
        feedback: `A solution is an instant, not a length of time: ${is(m)} at the moment $t\\approx${T1}$.`,
      },
      {
        label: `${Is(m)} the whole time from ${T1} to ${T2} ${unit}.`,
        feedback: `Between the two solutions the model is above or below ${valueText(m)}; it equals ${valueText(m)} only at the two instants.`,
      },
      {
        label: `${Is(m)} only at about ${T1} ${unit}.`,
        feedback: `The inverse function gives one angle, but there is a second time in each cycle: $t\\approx${T2}$.`,
      },
    ];
    return choiceProblem(meta, seed, r, {
      prompt: `${setting(m)} Solving $${ctx.fnName}(t)=${num(m.k)}$ gives $t\\approx${T1}$ and $t\\approx${T2}$ as the first two solutions. Which statement correctly interprets them?`,
      options,
      figure: modelFigure(m, [t1, t2]),
      hint: `Say each solution as a sentence with units: $t\\approx${T1}$ is a time in ${unit} ${after(m).replace(/^\w+ /, "")}, and $${ctx.fnName}(t)=${num(m.k)}$ is the value at that time.`,
      explanation: [
        `$t$ is a time, in ${unit} ${after(m).replace(/^\w+ /, "")}, and $${ctx.fnName}(t)$ is the value at that time.`,
        `A solution of $${ctx.fnName}(t)=${num(m.k)}$ is a time at which ${is(m)}: an instant, not a duration.`,
        `A sinusoid passes each value between its least and greatest twice per cycle, so ${is(m)} at about ${T1} and again at about ${T2} ${unit}, and it repeats every ${num(m.P)} ${unit}. Between them it is above or below ${valueText(m)}.`,
      ],
    });
  }

  if (meaning === "recurrence") {
    const gapText = shown(m, t2 - t1);
    return choiceProblem(meta, seed, r, {
      prompt: `${setting(m, true)} The first two solutions of $${ctx.fnName}(t)=${num(m.k)}$ are $t\\approx${T1}$ and $t\\approx${T2}$. Which statement gives every time that ${is(m)}?`,
      options: [
        {
          label: `At about ${T1} and ${T2} ${unit}, and every ${num(m.P)} ${unit} after each of those.`,
          correct: true,
        },
        {
          label: `At about ${T1} and ${T2} ${unit}, and every ${num(m.P / 2)} ${m.P === 2 ? unit.slice(0, -1) : unit} after each of those.`,
          feedback: `Half a period later the model is on the other side of its midline. It repeats a value after a full period, ${num(m.P)} ${unit}.`,
        },
        {
          label: `At about ${T1} and ${T2} ${unit}, and every ${num(2 * m.P)} ${unit} after each of those.`,
          feedback: `Those times are solutions, but the list skips every other cycle: the model repeats every ${num(m.P)} ${unit}.`,
        },
        {
          label: `At about ${T1} ${unit}, then every ${gapText} ${unit} after that.`,
          feedback: `The two solutions in a cycle are not evenly spaced. Gaps of ${gapText} would be right only for the midline value.`,
        },
      ],
      figure: modelFigure(m),
      hint: `The model's period is ${num(m.P)} ${unit}. After $t\\approx${T1}$ and $t\\approx${T2}$, when does each value come back?`,
      explanation: [
        `A sinusoid repeats every period: here $${ctx.fnName}(t+${num(m.P)})=${ctx.fnName}(t)$ for every $t$.`,
        `So each solution comes back every ${num(m.P)} ${unit}: ${T1}, ${shown(m, t1 + m.P)}, … and ${T2}, ${shown(m, t2 + m.P)}, …`,
        `These are all the times: each cycle holds exactly two. Half a period shifts the model to the other side of its midline, and the two solutions are not evenly spaced.`,
      ],
    });
  }

  // Above or below.
  const above = modelValue(m, (t1 + t2) / 2) > m.k;
  const askAbove = r(0, 1) === 1;
  const inner = above === askAbove;
  const t3 = t1 + m.P;
  const word = askAbove ? "greater than" : "less than";
  const span = (a: string, b: string) => `$t$ between about ${a} and ${b}`;
  return choiceProblem(meta, seed, r, {
    prompt: `${setting(m)} Solving $${ctx.fnName}(t)=${num(m.k)}$ gives the consecutive solutions $t\\approx${T1}$ and $t\\approx${T2}$, and the next one is $t\\approx${shown(m, t3)}$. Which statement is true?`,
    options: [
      {
        label: `The value is ${word} ${valueText(m)} for ${inner ? span(T1, T2) : span(T2, shown(m, t3))}.`,
        correct: true,
      },
      {
        label: `The value is ${word} ${valueText(m)} for ${inner ? span(T2, shown(m, t3)) : span(T1, T2)}.`,
        feedback: `Check a time in that stretch on the graph or in the model: there the value is ${askAbove ? "below" : "above"} ${valueText(m)}.`,
      },
      {
        label: `The value is ${word} ${valueText(m)} for exactly half of each ${num(m.P)}-${unit.slice(0, -1)} cycle.`,
        feedback: `That is true only for the midline value, ${valueText(m, m.D)}. Here the two stretches have different lengths.`,
      },
      {
        label: `The value is ${word} ${valueText(m)} only at about ${T1} and ${T2} ${unit}.`,
        feedback: `At the solutions the value equals ${valueText(m)}. ${askAbove ? "Above" : "Below"} it is a stretch of time between them.`,
      },
    ],
    figure: modelFigure(m, [t1, t2]),
    hint: `Pick a time between ${T1} and ${T2}, such as their midpoint, and find the model's value there. Is it above or below ${valueText(m)}?`,
    explanation: [
      `Between consecutive solutions the model stays on one side of ${valueText(m)}.`,
      `At the midpoint of ${T1} and ${T2} the model is about ${valueText(m, round(modelValue(m, (t1 + t2) / 2), 2))}, ${above ? "above" : "below"} ${valueText(m)}. So the value is ${above ? "above" : "below"} ${valueText(m)} between about ${T1} and ${T2}, and ${above ? "below" : "above"} it from about ${T2} to ${shown(m, t3)}.`,
      `The two stretches are not each half a cycle, because ${valueText(m)} is not the midline value ${valueText(m, m.D)}.`,
    ],
  });
}

export const trigModelEquationsGenerate = defineGenerate(
  trigModelEquationsTemplates,
  {
    "trig-model-inverse-setup": entry(setupAxes, ({ meta, seed, r, axes }) =>
      setupProblem(meta, seed, r, axes),
    ),
    "trig-model-solve-interval": entry(
      intervalAxes,
      ({ meta, seed, r, axes }) => intervalProblem(meta, seed, r, axes.ask),
    ),
    "trig-model-interpret-solutions": entry(
      interpretAxes,
      ({ meta, seed, r, axes }) =>
        interpretProblem(meta, seed, r, axes.meaning),
    ),
  },
);
