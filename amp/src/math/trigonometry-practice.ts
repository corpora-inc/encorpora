import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import {
  obliqueFigure,
  sceneFigure,
  sidesFromAngles,
} from "./geometry-teaching-figures";
import { assemble, random, type Random } from "./distribution-practice";
import { f, graph } from "./scene/author";

/** High-school trigonometry beyond right triangles: exact circle values,
 * symmetry, sinusoid parameters, inverses, equations, identities, oblique
 * triangles, trigonometric area and periodic models. Every case keeps a private
 * exact model; only the prompt and shuffled choices reach the learner. */

const choice = { requiredResponseCapability: "single-choice-v1" } as const;
const meta = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
  extra: Partial<TemplateMetadata> = {},
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "9–12",
  difficultyOffset,
  ...choice,
  description,
  ...extra,
});

export const trigonometryTemplates: readonly TemplateMetadata[] = [
  meta(
    "special-angle-exact-value",
    "Exact values at special angles",
    "special-angle-values",
    0.2,
    "Find the exact sine, cosine, tangent or unit-circle point for a special angle in any quadrant, in degrees or radians, including coterminal and axis angles.",
  ),
  meta(
    "trig-symmetry-value",
    "Unit-circle symmetry",
    "trigonometric-symmetry",
    0.35,
    "Use odd, even, supplement, half-turn and full-turn symmetry to find a trigonometric value from one given value.",
  ),
  meta(
    "sinusoid-parameters",
    "Amplitude, period, midline and shift",
    "trigonometric-graphs",
    0.3,
    "Read amplitude, period, midline, extreme values and horizontal shift from $y = A\\sin(B(x - h)) + k$, or choose the equation of a plotted sinusoid.",
    { requiredFigureCapability: "scenes-v1" },
  ),
  meta(
    "inverse-trig-value",
    "Inverse trigonometric values",
    "inverse-trigonometry",
    0.45,
    "Evaluate arcsin, arccos and arctan at special values within their restricted ranges, including $\\arcsin(\\sin x)$ for $x$ outside the range and compositions.",
  ),
  meta(
    "trig-equation-solutions",
    "Solve trigonometric equations",
    "trigonometric-equations",
    0.5,
    "Find all solutions of a simple trigonometric equation on one turn, or count solutions including double-angle and endpoint cases.",
  ),
  meta(
    "trig-identity-value",
    "Identities and angle sums",
    "trigonometric-identities",
    0.5,
    "Use the Pythagorean identity with a quadrant, angle-sum formulas for exact values, and the cofunction relation in radians.",
  ),
  meta(
    "oblique-triangle-solve",
    "Law of sines and law of cosines",
    "oblique-triangles",
    0.45,
    "Find a side or angle of a non-right triangle with the law of sines or cosines, or count the triangles in the ambiguous side-side-angle case.",
    { requiredFigureCapability: "scenes-v1" },
  ),
  meta(
    "trig-triangle-area",
    "Triangle area from two sides and the angle",
    "trigonometric-area",
    0.35,
    "Use area $=\\frac12ab\\sin C$ for exact and rounded areas, to find a missing side from the area, and to compare areas with supplementary angles.",
  ),
  meta(
    "sinusoid-model",
    "Build a periodic model",
    "periodic-modeling",
    0.45,
    "Turn a maximum, minimum, period and starting position into the amplitude, midline and $B$ of a sinusoidal model, then use the model.",
  ),
];

/* ---------- shared exact-value helpers ---------- */

type Cand = { label: string; feedback: string };
type Choice = { label: string; correct?: true; feedback?: string };
const math = (tex: string) => `$${tex}$`;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
const sign = (r: Random) => (r(0, 1) ? 1 : -1);
const tex = (n: number) => String(n);

function assertSeed(seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
}

/** Correct choice plus the first three distinct wrong choices. */
function choicesFrom(correct: string, cands: Cand[]): Choice[] {
  const seen = new Set([correct]);
  const wrong = cands.filter((c) => {
    if (seen.has(c.label)) return false;
    seen.add(c.label);
    return true;
  });
  if (wrong.length < 3)
    throw new Error(
      `Insufficient distinct choices: ${correct} / ${cands.map((c) => c.label).join(" ; ")}`,
    );
  return [{ label: correct, correct: true }, ...wrong.slice(0, 3)];
}

/** A rational number as TeX, reduced, sign in front. */
function fracTex(n: number, d: number): string {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  const body = d === 1 ? `${Math.abs(n)}` : `\\frac{${Math.abs(n)}}{${d}}`;
  return n < 0 ? `-${body}` : body;
}

/** (n/d)π reduced as TeX; 0 for zero. */
function piTex(n: number, d: number): string {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  if (n === 0) return "0";
  const top = Math.abs(n) === 1 ? "\\pi" : `${Math.abs(n)}\\pi`;
  const body = d === 1 ? top : `\\frac{${top}}{${d}}`;
  return n < 0 ? `-${body}` : body;
}
const piTwelfths = (k: number) => piTex(k, 12);
const degTex = (d: number) => `${d}^\\circ`;

const SQ3 = Math.sqrt(3);
const EXACT: readonly [number, string][] = [
  [0, "0"],
  [0.5, "\\frac{1}{2}"],
  [Math.SQRT2 / 2, "\\frac{\\sqrt{2}}{2}"],
  [SQ3 / 2, "\\frac{\\sqrt{3}}{2}"],
  [1, "1"],
  [SQ3 / 3, "\\frac{\\sqrt{3}}{3}"],
  [SQ3, "\\sqrt{3}"],
];
/** The exact TeX of a special-angle value. */
function exact(x: number): string {
  const hit = EXACT.find(([v]) => Math.abs(v - Math.abs(x)) < 1e-9);
  if (!hit) throw new Error(`Not a special value: ${x}`);
  return x < -1e-9 ? `-${hit[1]}` : hit[1];
}
const exactLabel = (x: number) => math(exact(x));

type Fn = "sin" | "cos" | "tan";
const evalFn = (fn: Fn, radians: number) =>
  fn === "sin"
    ? Math.sin(radians)
    : fn === "cos"
      ? Math.cos(radians)
      : Math.tan(radians);
const deg2rad = (d: number) => (d * Math.PI) / 180;
/** Value at an angle in degrees; null where tangent is undefined. */
function valueAt(fn: Fn, deg: number): number | null {
  if (fn === "tan" && Math.abs(Math.cos(deg2rad(deg))) < 1e-9) return null;
  return evalFn(fn, deg2rad(deg));
}
const valueLabel = (fn: Fn, deg: number) => {
  const v = valueAt(fn, deg);
  return v === null ? "Undefined" : exactLabel(v);
};
/** An angle given in degrees, written in degrees or in radians. */
const angleTex = (deg: number, radians: boolean) =>
  radians ? piTex(deg, 180) : degTex(deg);
const normalize = (deg: number) => ((deg % 360) + 360) % 360;
const quadrantOf = (deg: number) => Math.floor(normalize(deg) / 90) + 1;
const ordinal = ["", "I", "II", "III", "IV"];
const referenceOf = (deg: number) => {
  const n = normalize(deg);
  return n <= 90 ? n : n <= 180 ? 180 - n : n <= 270 ? n - 180 : 360 - n;
};
const fnTex = (fn: Fn) => `\\${fn}`;

/* ---------- 1. special angles ---------- */

const quadrantSign: Record<Fn, number[]> = {
  sin: [0, 1, 1, -1, -1],
  cos: [0, 1, -1, -1, 1],
  tan: [0, 1, -1, 1, -1],
};
const reading: Record<Fn, string> = {
  sin: "the $y$-coordinate of the point on the unit circle",
  cos: "the $x$-coordinate of the point on the unit circle",
  tan: "$y$ divided by $x$, the slope of the terminal side",
};

export function specialAngleCase(seed: string) {
  assertSeed(seed);
  const id = "special-angle-exact-value";
  const r = random(id, seed);
  const variant = r(0, 4);
  const radians = r(0, 1) === 1;
  const fn = pick<Fn>(r, ["sin", "cos", "tan"]);
  const ref = pick(r, [30, 45, 60]);
  const quad = r(2, 4);
  const base = quad === 2 ? 180 - ref : quad === 3 ? 180 + ref : 360 - ref;
  let deg = base;
  let prompt = "";
  let correct = "";
  let hint = "";
  let cands: Cand[] = [];
  let explanation: string[] = [];
  const unitName = radians ? "radians" : "degrees";

  if (variant === 4) {
    // Unit-circle point (cos, sin).
    const c = Math.cos(deg2rad(base));
    const s = Math.sin(deg2rad(base));
    const pt = (x: number, y: number) =>
      math(`\\left(${exact(x)},\\ ${exact(y)}\\right)`);
    correct = pt(c, s);
    prompt = `The terminal side of the angle $\\theta=${angleTex(base, radians)}$ meets the unit circle at a point $(x,y)$. Which point is it?`;
    cands = [
      {
        label: pt(s, c),
        feedback:
          "The $x$-coordinate is $\\cos\\theta$ and the $y$-coordinate is $\\sin\\theta$; these two are swapped.",
      },
      {
        label: pt(-c, s),
        feedback: "Check the sign of the $x$-coordinate in this quadrant.",
      },
      {
        label: pt(c, -s),
        feedback: "Check the sign of the $y$-coordinate in this quadrant.",
      },
      {
        label: pt(-c, -s),
        feedback:
          "Both signs are reversed. Decide the signs from the quadrant the angle ends in.",
      },
    ];
    hint = `Name the quadrant that $\\theta=${angleTex(base, radians)}$ ends in and its reference angle, the acute angle between the terminal side and the $x$-axis. The point is $(\\cos\\theta,\\sin\\theta)$.`;
    explanation = [
      `$\\theta=${angleTex(base, radians)}$ ends in quadrant ${ordinal[quad]}, with reference angle $${angleTex(ref, radians)}$.`,
      `At the reference angle, $\\cos=${exact(Math.abs(c))}$ and $\\sin=${exact(Math.abs(s))}$.`,
      `In quadrant ${ordinal[quad]}, $x$ is ${c < 0 ? "negative" : "positive"} and $y$ is ${s < 0 ? "negative" : "positive"}.`,
      `The point is ${correct}.`,
    ];
  } else if (variant === 2) {
    // Axis angle, tan undefined at 90 and 270.
    const axis = pick(r, [0, 90, 180, 270]);
    deg = axis + 360 * pick(r, [-1, 0, 0, 1]);
    const all = ["0", "1", "-1"].map((v) => math(v)).concat(["Undefined"]);
    correct = valueLabel(fn, deg);
    const why = (label: string): string => {
      const other = (["sin", "cos", "tan"] as Fn[]).find(
        (g) => g !== fn && valueLabel(g, deg) === label,
      );
      return other
        ? `That is $\\${other}$ at this angle. $\\${fn}$ is ${reading[fn]}.`
        : `$\\${fn}$ is ${reading[fn]}. Locate the point for this angle first.`;
    };
    cands = all.map((label) => ({ label, feedback: why(label) }));
    prompt = `What is $${fnTex(fn)}\\left(${angleTex(deg, radians)}\\right)$? If it has no value, choose the answer that says so.`;
    hint = `Locate $${angleTex(deg, radians)}$ on the unit circle: it ends on an axis. Read the coordinates of that point, then use that $${fnTex(fn)}$ is ${reading[fn]}.`;
    const n = normalize(deg);
    const pointOf: Record<number, string> = {
      0: "(1, 0)",
      90: "(0, 1)",
      180: "(-1, 0)",
      270: "(0, -1)",
    };
    explanation = [
      `$${angleTex(deg, radians)}$ ends on the axis at the point $${pointOf[n]}$ of the unit circle.`,
      `$${fnTex(fn)}$ is ${reading[fn]}${fn === "tan" ? (correct === "Undefined" ? ", and the $x$-coordinate is 0, so division by zero makes it undefined" : "") : ""}.`,
      correct === "Undefined"
        ? "So the value is undefined."
        : `So the value is ${correct}.`,
    ];
  } else {
    // 0 degrees, 1 radians (same model), 3 coterminal. Variant 3 adds turns.
    if (variant === 3) deg = base + 360 * pick(r, [-2, -1, 1, 2]);
    const sg = quadrantSign[fn][quadrantOf(deg)]!;
    const refVal = Math.abs(valueAt(fn, ref)!);
    correct = valueLabel(fn, deg);
    const ofRef = (g: Fn, a: number) => Math.abs(valueAt(g, a)!);
    const withSign = (v: number) => exactLabel(sg * v);
    const others = (["sin", "cos", "tan"] as Fn[]).filter((g) => g !== fn);
    cands = [
      {
        label: exactLabel(-sg * refVal),
        feedback: `Check the sign: in quadrant ${ordinal[quadrantOf(deg)]}, $${fnTex(fn)}$ is ${sg > 0 ? "positive" : "negative"}.`,
      },
      {
        label: withSign(ofRef(fn, 90 - ref)),
        feedback: `The reference angle is $${angleTex(ref, radians)}$, not $${angleTex(90 - ref, radians)}$. Measure from the $x$-axis.`,
      },
      {
        label: withSign(ofRef(others[0]!, ref)),
        feedback: `That is the size of $${fnTex(others[0]!)}$ at the reference angle. Use $${fnTex(fn)}$.`,
      },
      {
        label: withSign(ofRef(others[1]!, ref)),
        feedback: `That is the size of $${fnTex(others[1]!)}$ at the reference angle. Use $${fnTex(fn)}$.`,
      },
      ...[30, 60, 45].map((a) => ({
        label: withSign(ofRef(fn, a)),
        feedback: `The reference angle is $${angleTex(ref, radians)}$; recall the value of $${fnTex(fn)}$ there.`,
      })),
    ];
    const turns =
      variant === 3
        ? ` It is coterminal with $${angleTex(normalize(deg), radians)}$, because it differs by ${Math.abs(Math.round((deg - normalize(deg)) / 360))} full turn${Math.abs(Math.round((deg - normalize(deg)) / 360)) === 1 ? "" : "s"}.`
        : "";
    prompt = `Find the exact value of $${fnTex(fn)}\\left(${angleTex(deg, radians)}\\right)$ (angle in ${unitName}).`;
    hint =
      variant === 3
        ? `First replace $${angleTex(deg, radians)}$ by the coterminal angle between $0$ and a full turn. Then find its quadrant and reference angle.`
        : `Find the quadrant of $${angleTex(deg, radians)}$ and its reference angle, the acute angle it makes with the $x$-axis. The reference angle gives the size; the quadrant gives the sign.`;
    explanation = [
      ...(turns ? [turns.trim()] : []),
      `The angle $${angleTex(normalize(deg), radians)}$ ends in quadrant ${ordinal[quadrantOf(deg)]}; its reference angle is $${angleTex(ref, radians)}$.`,
      `At the reference angle, $${fnTex(fn)}=${exact(refVal)}$ in size.`,
      `In quadrant ${ordinal[quadrantOf(deg)]}, $${fnTex(fn)}$ is ${sg > 0 ? "positive" : "negative"}, so $${fnTex(fn)}\\left(${angleTex(deg, radians)}\\right)=${correct.replace(/^\$|\$$/g, "")}$.`,
    ];
  }
  const choices = choicesFrom(correct, cands);
  const r2 = random(id, seed);
  void r2;
  const problem = assemble(trigonometryTemplates[0]!, seed, r, {
    prompt,
    answer: "",
    hint,
    explanation,
    choices,
  });
  return { variant, fn, deg, radians, correct, problem };
}

/* ---------- 2. symmetry ---------- */

const triples: readonly [number, number][] = [
  [0.6, 0.8],
  [0.8, 0.6],
  [0.28, 0.96],
  [0.96, 0.28],
];
const dec = (x: number) => math(tex(Math.round(x * 100) / 100));
const fracNum = (n: number, d: number) => math(fracTex(n, d));

export function symmetryCase(seed: string) {
  assertSeed(seed);
  const id = "trig-symmetry-value";
  const r = random(id, seed);
  const variant = r(0, 5);
  const [s0, c0] = pick(r, triples);
  const givenFn: "sin" | "cos" = r(0, 1) ? "sin" : "cos";
  // Variants 4 and 5 need θ acute so the other function is determined.
  const acute = variant >= 4;
  const gSign = acute ? 1 : sign(r);
  const gMag = givenFn === "sin" ? s0 : c0;
  const oMag = givenFn === "sin" ? c0 : s0;
  const given = gSign * gMag;
  let askFn: Fn = variant >= 4 ? (variant === 5 ? "tan" : "cos") : givenFn;
  if (variant === 4) askFn = givenFn === "sin" ? "cos" : "sin";
  // Angle expression σθ + kπ.
  let sigma = 1;
  let k = 0;
  if (variant === 0) sigma = -1;
  if (variant === 1) {
    sigma = -1;
    k = 1;
  }
  if (variant === 2) k = pick(r, [1, -1]);
  if (variant === 3) k = 2 * pick(r, [-2, -1, 1, 2, 3]);
  if (variant === 4 || variant === 5) {
    sigma = pick(r, [-1, 1]);
    k = pick(r, [-1, 0, 1, 2]);
    if (sigma === 1 && k === 0) k = 1;
  }
  const expr = (() => {
    const part = sigma === -1 ? "-\\theta" : "\\theta";
    if (k === 0) return part;
    const shift = Math.abs(k) === 1 ? "\\pi" : `${Math.abs(k)}\\pi`;
    if (sigma === -1 && k > 0) return `${shift}${part}`;
    return k > 0 ? `${part}+${shift}` : `${part}-${shift}`;
  })();
  // Exact value by symmetry of the unit-circle point.
  const sinT = givenFn === "sin" ? gSign * gMag : gSign * oMag; // sign only matters when acute
  const cosT = givenFn === "cos" ? gSign * gMag : gSign * oMag;
  const half = k % 2 === 0 ? 1 : -1;
  let ans: number;
  let tanNum = 0;
  let tanDen = 1;
  if (askFn === "sin")
    ans = half * sigma * (givenFn === "sin" ? gSign * gMag : sinT);
  else if (askFn === "cos")
    ans = half * (givenFn === "cos" ? gSign * gMag : cosT);
  else {
    // tan(σθ + kπ) = σ tan θ
    const sNum = Math.round(sinT * 100);
    const cNum = Math.round(cosT * 100);
    tanNum = sigma * sNum;
    tanDen = cNum;
    ans = tanNum / tanDen;
  }
  const correct = askFn === "tan" ? fracNum(tanNum, tanDen) : dec(ans);
  const mag = Math.abs(ans);
  const cands: Cand[] = [];
  const signFeedback =
    "Check the sign. Sketch where the angle ends on the unit circle and use that quadrant's sign, or use the symmetry rule for this angle.";
  if (askFn === "tan") {
    cands.push(
      { label: fracNum(-tanNum, tanDen), feedback: signFeedback },
      {
        label: fracNum(tanDen, tanNum),
        feedback:
          "Tangent is sine divided by cosine, not cosine divided by sine.",
      },
      {
        label: fracNum(-tanDen, tanNum),
        feedback:
          "Tangent is sine divided by cosine; also check the sign for this angle.",
      },
    );
  } else {
    cands.push({ label: dec(-ans), feedback: signFeedback });
    const otherFeedback =
      "That is a value of the other function. Use the function named in the question, and its given value.";
    const others = acute ? [gMag, oMag] : [oMag];
    for (const o of others) {
      if (Math.abs(o - mag) < 1e-9) continue;
      cands.push(
        { label: dec(o), feedback: otherFeedback },
        { label: dec(-o), feedback: otherFeedback },
      );
    }
    if (!acute)
      cands.push({
        label: dec(given === ans ? -given : given),
        feedback: signFeedback,
      });
    cands.push({
      label: dec(gMag * oMag),
      feedback:
        "Do not multiply the two values; apply the symmetry rule to the one needed.",
    });
  }
  const givenText =
    givenFn === "sin"
      ? `\\sin\\theta=${tex(given)}`
      : `\\cos\\theta=${tex(given)}`;
  const need = acute ? " with $\\theta$ acute" : "";
  const askText = `${fnTex(askFn)}\\left(${expr}\\right)`;
  const prompt = `Given $${givenText}$${need}, find $${askText}$.`;
  const rule =
    askFn === "tan"
      ? "Tangent repeats every half turn, $\\tan(\\theta+\\pi)=\\tan\\theta$, and $\\tan(-\\theta)=-\\tan\\theta$."
      : askFn === "sin"
        ? "Sine is odd, $\\sin(-\\theta)=-\\sin\\theta$, and adding a half turn reverses it."
        : "Cosine is even, $\\cos(-\\theta)=\\cos\\theta$, and adding a half turn reverses it.";
  const hint = `Compare the angle $${expr}$ with $\\theta$ on the unit circle: is it a reflection, a half turn, or whole turns? ${
    acute
      ? `Because $\\theta$ is acute, the Pythagorean identity gives the other coordinate from $${givenText}$.`
      : `Only the given value, $${givenText.replace(/^([^=]*)=(.*)$/, "$2=$1")}$, is needed; its sign follows the rule.`
  }`;
  const explanation = [
    rule,
    `Apply it to the given value $${givenText}$.`,
    ...(acute
      ? [
          `Because $\\theta$ is acute, $\\sin^2\\theta+\\cos^2\\theta=1$ gives $\\${givenFn === "sin" ? "cos" : "sin"}\\theta=${tex(oMag)}$.`,
        ]
      : []),
    `$${askText}$ is the ${askFn === "tan" ? "tangent" : askFn === "sin" ? "sine" : "cosine"} of $${expr}$, which is ${sigma === -1 ? "the reflection of $\\theta$ across the $x$-axis" : "$\\theta$"}${k === 0 ? "" : half === -1 ? " turned through an odd number of half turns" : " turned through whole turns"}, so the value is ${correct}.`,
  ];
  const choices = choicesFrom(correct, cands);
  const problem = assemble(trigonometryTemplates[1]!, seed, r, {
    prompt,
    answer: "",
    hint,
    explanation,
    choices,
  });
  return {
    variant,
    givenFn,
    given,
    askFn,
    sigma,
    k,
    acute,
    expected: ans,
    problem,
  };
}

/* ---------- 3. sinusoid parameters ---------- */

/** Rational B as TeX coefficient. */
const coeffTex = (n: number, d: number) =>
  d === 1 ? (n === 1 ? "" : `${n}`) : `\\frac{${n}}{${d}}`;
const signedTerm = (v: number) => (v === 0 ? "" : v > 0 ? `+${v}` : `${v}`);
const lead = (a: number) => (a === 1 ? "" : a === -1 ? "-" : `${a}`);
const horizontal = (n: number, d: number) => `${piTex(Math.abs(n), d)}`;

export function sinusoidCase(seed: string) {
  assertSeed(seed);
  const id = "sinusoid-parameters";
  const r = random(id, seed);
  const variant = r(0, 6);
  const A = pick(r, [2, 3, 4, 5]) * sign(r);
  const k = r(0, 6) === 0 ? 0 : r(1, 6) * sign(r);
  const [bn, bd] = pick<[number, number]>(r, [
    [2, 1],
    [3, 1],
    [4, 1],
    [1, 2],
    [1, 3],
    [3, 2],
    [2, 3],
  ]);
  const [hn, hd] = pick<[number, number]>(r, [
    [1, 6],
    [1, 4],
    [1, 3],
    [1, 2],
    [2, 3],
    [3, 4],
  ]);
  const hSign = sign(r);
  const B = coeffTex(bn, bd);
  const shiftTex = (n: number, d: number, s: number) =>
    s > 0 ? `x-${piTex(n, d)}` : `x+${piTex(n, d)}`;
  const factored = `y=${lead(A)}\\sin\\left(${B}\\left(${shiftTex(hn, hd, hSign)}\\right)\\right)${signedTerm(k)}`;
  const simple = `y=${lead(A)}\\sin\\left(${B}x\\right)${signedTerm(k)}`;
  let prompt = "";
  let correct = "";
  let cands: Cand[] = [];
  let hint = "";
  let explanation: string[] = [];
  let figure:
    | { kind: "scene"; scene: ReturnType<ReturnType<typeof graph>["scene"]> }
    | undefined;
  let periodTex = "";
  const amp = Math.abs(A);

  if (variant === 0) {
    // Period 2π / B.
    periodTex = piTex(2 * bd, bn);
    const wrong = (t: string, why: string): Cand => ({
      label: math(t),
      feedback: why,
    });
    correct = math(periodTex);
    cands = [
      wrong(
        piTex(2 * bn, bd),
        "The period is $2\\pi$ divided by $B$, not multiplied by it.",
      ),
      wrong(
        piTex(bd, bn),
        "A sine curve finishes one cycle after $2\\pi$ in the argument, not $\\pi$.",
      ),
      wrong(
        bd === 1 ? `${bn}` : `\\frac{${bn}}{${bd}}`,
        "$B$ is the frequency factor. The period is $2\\pi\\div B$.",
      ),
      wrong("2\\pi", "$2\\pi$ is the period only when $B=1$."),
    ];
    prompt = `What is the period of $${simple}$?`;
    hint = `Sine repeats when its argument $${B === "" ? "x" : B + "x"}$ increases by $2\\pi$. Solve for how far $x$ must move when $B=${coeffTex(bn, bd) || "1"}$.`;
    explanation = [
      `One cycle of sine takes the argument $${B}x$ from 0 to $2\\pi$.`,
      `So $${B}\\,\\Delta x=2\\pi$, and the period is $\\Delta x=2\\pi\\div ${bd === 1 ? bn : `\\frac{${bn}}{${bd}}`}=${periodTex}$.`,
      `Check: when $x$ increases by $${periodTex}$, the argument increases by $2\\pi$, which is one full cycle.`,
    ];
  } else if (variant === 1) {
    correct = math(`${amp}`);
    cands = [
      {
        label: math(`${A}`),
        feedback:
          "Amplitude is a distance from the midline, so it is never negative. Use $|A|$.",
      },
      {
        label: math(`${2 * amp}`),
        feedback:
          "That is the full height from minimum to maximum. The amplitude is half of it.",
      },
      {
        label: math(`${amp + Math.abs(k)}`),
        feedback:
          "The vertical shift moves the midline; it does not change the amplitude, which is just $|A|$.",
      },
      {
        label: math(`${amp * bn}`),
        feedback:
          "$B$ controls the period, not the height. The amplitude is $|A|$.",
      },
      {
        label: math(`${bn}`),
        feedback:
          "$B$ controls the period. The amplitude is $|A|$, the number multiplying the sine.",
      },
      {
        label: math(`${Math.abs(k)}`),
        feedback:
          "$k$ is the vertical shift of the midline. The amplitude is $|A|$.",
      },
      {
        label: math(`${amp + 1}`),
        feedback:
          "The amplitude is exactly $|A|$, the coefficient of the sine.",
      },
      {
        label: math(`${amp + 2}`),
        feedback:
          "The amplitude is exactly $|A|$, the coefficient of the sine.",
      },
      {
        label: math(`${amp - 1}`),
        feedback:
          "The amplitude is exactly $|A|$, the coefficient of the sine.",
      },
    ];
    prompt = `What is the amplitude of $${simple}$?`;
    hint = `Amplitude is how far the curve rises above, or falls below, its midline. In $${simple}$, find the number that multiplies $\\sin$.`;
    explanation = [
      `The curve moves from the midline by $|A|$ each way.`,
      `Here $A=${A}$, so the amplitude is $|${A}|=${amp}$${A < 0 ? "; the negative sign reflects the curve but does not change the distance" : ""}.`,
      `Check: the maximum and minimum are each ${amp} from the midline, so they differ by ${2 * amp}.`,
    ];
  } else if (variant === 2) {
    const kk = k === 0 ? 3 : k;
    const eq = `y=${lead(A)}\\sin\\left(${B}x\\right)${signedTerm(kk)}`;
    correct = math(`y=${kk}`);
    cands = [
      {
        label: math(`y=${-kk}`),
        feedback: "The midline is at the added constant $k$, with its sign.",
      },
      {
        label: math(`y=${kk + amp}`),
        feedback:
          "That is the maximum value. The midline is halfway between maximum and minimum.",
      },
      {
        label: math(`y=${amp}`),
        feedback:
          "$|A|$ is the amplitude. The midline is the constant added at the end.",
      },
      {
        label: math("y=0"),
        feedback:
          "The $x$-axis is the midline only when there is no vertical shift.",
      },
      {
        label: math(`y=${kk - amp}`),
        feedback:
          "That is the minimum value. The midline is the constant added at the end.",
      },
      {
        label: math(`y=${kk + 1}`),
        feedback: "The midline is exactly the constant added at the end.",
      },
    ];
    prompt = `What is the equation of the midline of $${eq}$?`;
    hint = `The midline is the horizontal line the curve oscillates around. Which term in $${eq}$ shifts the whole curve up or down?`;
    explanation = [
      `$\\sin$ oscillates around 0, and the number added at the end moves that centre line to $y=k$.`,
      `Here $k=${kk}$, so the midline is $y=${kk}$.`,
      `Check: the maximum $${kk + amp}$ and the minimum $${kk - amp}$ are equally far from $y=${kk}$.`,
    ];
  } else if (variant === 3) {
    const right = hSign > 0;
    const horiz = (s: boolean, t: string) =>
      math(`${t}`) + (s ? " to the right" : " to the left");
    correct = horiz(right, piTex(hn, hd));
    cands = [
      {
        label: horiz(!right, piTex(hn, hd)),
        feedback:
          "In $x-h$ the curve moves right by $h$; $x+h$ moves it left. Read the sign inside the bracket.",
      },
      {
        label: horiz(right, piTex(hn * bn, hd * bd)),
        feedback:
          "The bracket is already factored as $B(x-h)$, so the shift is $h$ itself.",
      },
      {
        label: horiz(!right, piTex(hn * bn, hd * bd)),
        feedback:
          "Neither multiply by $B$ nor flip the direction: the shift is the number subtracted from $x$ inside the bracket.",
      },
      {
        label: horiz(right, piTex(hn * bd, hd * bn)),
        feedback:
          "The bracket is already factored as $B(x-h)$, so do not divide by $B$ again.",
      },
    ];
    prompt = `Describe the horizontal shift of $${factored}$ compared with $y=${lead(A)}\\sin(${B}x)${signedTerm(k)}$.`;
    hint = `Look inside the factored bracket $${B}\\left(${shiftTex(hn, hd, hSign)}\\right)$: the shift is what is subtracted from $x$. A plus sign means the opposite direction.`;
    explanation = [
      `The bracket has the form $x-h$ with $h=${hSign > 0 ? piTex(hn, hd) : "-" + piTex(hn, hd)}$.`,
      `Replacing $x$ by $x-h$ moves the graph $h$ units ${right ? "right" : "left"}, so the shift is ${correct}.`,
      `Check: at $x=${hSign > 0 ? "" : "-"}${piTex(hn, hd)}$ the bracket is 0, so the curve is on its midline there.`,
    ];
  } else if (variant === 4) {
    // Unfactored y = A sin(Bx − c): shift c/B.
    const bInt = pick(r, [2, 3, 4]);
    const c = piTex(bInt * hn, hd);
    const cPos = hSign > 0;
    const eq = `y=${lead(A)}\\sin\\left(${bInt}x${cPos ? "-" : "+"}${c}\\right)${signedTerm(k)}`;
    const right = cPos;
    const side = (rt: boolean, t: string) =>
      math(t) + (rt ? " to the right" : " to the left");
    correct = side(right, piTex(hn, hd));
    cands = [
      {
        label: side(right, c),
        feedback:
          "Factor out $B$ first: $Bx-c=B(x-c/B)$, so the shift is $c\\div B$.",
      },
      {
        label: side(!right, piTex(hn, hd)),
        feedback:
          "A subtracted constant inside shifts right; an added constant shifts left.",
      },
      {
        label: side(right, piTex(hn * bInt * bInt, hd)),
        feedback: "Divide the constant by $B$; do not multiply.",
      },
      {
        label: side(!right, c),
        feedback:
          "Factor out $B$ first and divide the constant by $B$; also check the direction.",
      },
    ];
    prompt = `Find the horizontal shift of $${eq}$.`;
    hint = `Factor $${bInt}$ out of $${bInt}x${cPos ? "-" : "+"}${c}$ so that it reads $${bInt}(x-h)$ or $${bInt}(x+h)$.`;
    explanation = [
      `Factor out $B=${bInt}$: $${bInt}x${cPos ? "-" : "+"}${c}=${bInt}\\left(x${cPos ? "-" : "+"}${piTex(hn, hd)}\\right)$.`,
      `The curve is shifted $${piTex(hn, hd)}$ units ${right ? "right" : "left"}.`,
      `Check: when $x=${hSign > 0 ? "" : "-"}${piTex(hn, hd)}$ the bracket is 0, so the curve crosses its midline there.`,
    ];
  } else if (variant === 5) {
    // Graph to equation. Period an integer, y = A sin(πx / (P/2)) + k with no phase shift.
    const P = pick(r, [2, 4, 6, 8]);
    const Ag = pick(r, [1, 2, 3, 4]) * sign(r);
    const kg = r(-3, 3);
    const aabs = Math.abs(Ag);
    const ystep = aabs >= 3 ? 2 : 1;
    const lo = Math.floor((kg - aabs - 1) / ystep) * ystep;
    const hi = Math.ceil((kg + aabs + 1) / ystep) * ystep;
    const xstep = P / 2;
    const bTex = piTex(2, P);
    const eqOf = (a: number, b: string, kk: number) =>
      math(`y=${lead(a)}\\sin\\left(${b}\\,x\\right)${signedTerm(kk)}`);
    correct = eqOf(Ag, bTex, kg);
    cands = [
      {
        label: eqOf(Ag > 0 ? kg + aabs : -(kg + aabs), bTex, kg),
        feedback:
          "Amplitude is half the distance from lowest to highest point, not the greatest height.",
      },
      {
        label: eqOf(Ag, piTex(1, P), kg),
        feedback:
          "One full cycle takes $x$ a distance $P$, so $B=2\\pi\\div P$. Check how long the graph takes to repeat.",
      },
      {
        label: eqOf(-Ag, bTex, kg),
        feedback:
          "Check whether the curve first rises or falls from the midline at $x=0$; a falling start means $A<0$.",
      },
      {
        label: eqOf(Ag, bTex, kg === 0 ? 1 : 0),
        feedback:
          "The midline is halfway between the highest and lowest points; it fixes the added constant.",
      },
      {
        label: eqOf(Ag, piTex(4, P), kg),
        feedback:
          "That makes the curve repeat twice as often as the graph does. Find one full cycle.",
      },
    ];
    figure = {
      kind: "scene",
      scene: graph({
        x: [0, 2 * P],
        y: [lo, hi],
        grid: [xstep, ystep],
        tick: [xstep, ystep],
        labels: "auto",
      })
        .curve(f.sin(Ag, (2 * Math.PI) / P, { k: kg }))
        .scene({ title: "A sinusoidal graph" }),
    };
    prompt =
      "Which equation matches the graph? Every choice has the form $y=A\\sin(Bx)+k$.";
    hint = `Read the highest and lowest points to find the midline and $A$. Then measure the $x$-distance for one full cycle starting at $x=0$ and use $B=2\\pi\\div$ period.`;
    explanation = [
      `The highest point is $y=${kg + aabs}$ and the lowest is $y=${kg - aabs}$, so the midline is $y=${kg}$ and $|A|=${aabs}$.`,
      `At $x=0$ the curve ${Ag > 0 ? "rises" : "falls"} from the midline, so $A=${Ag}$.`,
      `One cycle has length ${P}, so $B=2\\pi\\div${P}=${bTex}$.`,
      `The equation is ${correct}.`,
    ];
  } else {
    const kk = k === 0 ? -2 : k;
    const which = r(0, 1) ? "maximum" : "minimum";
    const eq = `y=${lead(A)}\\sin\\left(${B}x\\right)${signedTerm(kk)}`;
    const value = which === "maximum" ? kk + amp : kk - amp;
    correct = math(`${value}`);
    cands = [
      {
        label: math(`${which === "maximum" ? kk + A : kk - A}`),
        feedback:
          "A negative $A$ only flips the curve; the largest and smallest values are still $k+|A|$ and $k-|A|$.",
      },
      {
        label: math(`${amp}`),
        feedback:
          "$|A|$ is the distance from the midline. Add or subtract it from the midline value $k$.",
      },
      {
        label: math(`${which === "maximum" ? kk - amp : kk + amp}`),
        feedback: `That is the ${which === "maximum" ? "minimum" : "maximum"}.`,
      },
      {
        label: math(`${kk}`),
        feedback: "That is the midline, halfway between the extreme values.",
      },
      {
        label: math(`${(kk + amp) * (which === "maximum" ? 1 : -1) + 7}`),
        feedback: "Compute midline plus or minus amplitude.",
      },
    ];
    prompt = `What is the ${which} value of $${eq}$?`;
    hint = `Sine takes every value from $-1$ to $1$. Use the amplitude $|A|$ and the midline $k$ to find the ${which} of $${eq}$.`;
    explanation = [
      `The midline is $y=${kk}$ and the amplitude is $|${A}|=${amp}$.`,
      `The ${which} is the midline ${which === "maximum" ? "plus" : "minus"} the amplitude: $${kk}${which === "maximum" ? "+" : "-"}${amp}=${value}$.`,
      `Check: the ${which === "maximum" ? "minimum" : "maximum"} is $${which === "maximum" ? kk - amp : kk + amp}$, the same distance ${amp} from the midline on the other side.`,
    ];
  }
  const choices = choicesFrom(correct, cands);
  const problem = assemble(trigonometryTemplates[2]!, seed, r, {
    prompt,
    answer: "",
    hint,
    explanation,
    choices,
    ...(figure ? { figure } : {}),
  });
  return { variant, A, k, bn, bd, periodTex, problem };
}

/* ---------- 4. inverse trigonometry ---------- */

const specialSin = [
  -1,
  -SQ3 / 2,
  -Math.SQRT2 / 2,
  -0.5,
  0,
  0.5,
  Math.SQRT2 / 2,
  SQ3 / 2,
  1,
];
const specialTan = [-SQ3, -1, -SQ3 / 3, 0, SQ3 / 3, 1, SQ3];
type Inv = "arcsin" | "arccos" | "arctan";
const invFn = (inv: Inv, v: number) =>
  inv === "arcsin"
    ? Math.asin(v)
    : inv === "arccos"
      ? Math.acos(v)
      : Math.atan(v);
const invOuter: Record<Inv, Fn> = {
  arcsin: "sin",
  arccos: "cos",
  arctan: "tan",
};
const toTwelfths = (radians: number) => {
  const k = Math.round((radians * 12) / Math.PI);
  if (Math.abs((k * Math.PI) / 12 - radians) > 1e-9)
    throw new Error("Angle is not a multiple of π/12");
  return k;
};
const invRange: Record<Inv, string> = {
  arcsin: "$-\\frac{\\pi}{2}\\le y\\le\\frac{\\pi}{2}$",
  arccos: "$0\\le y\\le\\pi$",
  arctan: "$-\\frac{\\pi}{2}< y<\\frac{\\pi}{2}$",
};

export function inverseTrigCase(seed: string) {
  assertSeed(seed);
  const id = "inverse-trig-value";
  const r = random(id, seed);
  const variant = r(0, 4);
  const inv = pick<Inv>(r, ["arcsin", "arccos", "arctan"]);
  const valueTex = (v: number) => exact(v);
  let prompt = "";
  let correct = "";
  let cands: Cand[] = [];
  let hint = "";
  let explanation: string[] = [];
  let answerRadians = 0;

  const angleCands = (inverse: Inv, a: number): Cand[] => {
    // a is a multiple of π/12 given as twelfths
    const t = (k: number) => math(piTwelfths(k));
    if (inverse === "arcsin")
      return [
        {
          label: t(12 - a),
          feedback:
            "That angle has the same sine, but arcsin only returns angles from $-\\frac{\\pi}{2}$ to $\\frac{\\pi}{2}$.",
        },
        {
          label: t(-a),
          feedback:
            "Check the sign of the value: arcsin of a negative number is a negative angle.",
        },
        {
          label: t(6 - a),
          feedback:
            "That angle has the cosine of the required value. Use sine.",
        },
        {
          label: t(a < 0 ? 24 + a : a + 24),
          feedback:
            "That angle is coterminal but lies outside the range of arcsin.",
        },
        {
          label: t(a + 6),
          feedback: "Check which angle in the allowed range has this sine.",
        },
        {
          label: t(a - 6),
          feedback: "Check which angle in the allowed range has this sine.",
        },
      ];
    if (inverse === "arccos")
      return [
        {
          label: t(-a),
          feedback:
            "arccos returns angles from 0 to $\\pi$, so it is never negative.",
        },
        {
          label: t(12 - a),
          feedback:
            "That angle has the opposite cosine. Check the sign of the given value.",
        },
        {
          label: t(6 - a),
          feedback:
            "That angle has the required value as its sine. Use cosine.",
        },
        {
          label: t(24 - a),
          feedback:
            "That angle has the same cosine, but arccos only returns angles from 0 to $\\pi$.",
        },
        {
          label: t(a + 6),
          feedback: "Check which angle from 0 to $\\pi$ has this cosine.",
        },
        {
          label: t(a - 6),
          feedback: "Check which angle from 0 to $\\pi$ has this cosine.",
        },
      ];
    return [
      {
        label: t(a + 12),
        feedback:
          "That angle has the same tangent, but arctan only returns angles between $-\\frac{\\pi}{2}$ and $\\frac{\\pi}{2}$.",
      },
      { label: t(-a), feedback: "Check the sign of the given value." },
      {
        label: t(6 - a),
        feedback:
          "That angle has the reciprocal tangent. Check which angle has this tangent.",
      },
      {
        label: t(a - 12),
        feedback:
          "That angle has the same tangent, but it is outside the range of arctan.",
      },
      {
        label: t(a + 6),
        feedback: "Check which angle in the allowed range has this tangent.",
      },
      {
        label: t(a - 6),
        feedback: "Check which angle in the allowed range has this tangent.",
      },
    ];
  };

  if (variant <= 2 && !(variant === 0 && inv === "arctan")) {
    // direct evaluation
  }
  if (variant <= 2) {
    const v = inv === "arctan" ? pick(r, specialTan) : pick(r, specialSin);
    const a = toTwelfths(invFn(inv, v));
    answerRadians = a;
    correct = math(piTwelfths(a));
    cands = angleCands(inv, a);
    prompt = `Find the exact value of $\\${inv === "arcsin" ? "arcsin" : inv === "arccos" ? "arccos" : "arctan"}\\left(${valueTex(v)}\\right)$ in radians.`;
    hint = `$\\${inv}(${valueTex(v)})$ is the one angle in the range ${invRange[inv]} whose ${invOuter[inv]} is $${valueTex(v)}$. First find the reference angle with that size.`;
    explanation = [
      `${inv === "arcsin" ? "arcsin" : inv === "arccos" ? "arccos" : "arctan"} returns the angle $y$ in ${invRange[inv]} with ${invOuter[inv]} $y=${valueTex(v)}$.`,
      `The reference angle for $\\left|${valueTex(v)}\\right|$ is $${piTwelfths(toTwelfths(invFn(inv, Math.abs(v))))}$.`,
      `Placing it in the allowed range with the correct sign gives $${piTwelfths(a)}$.`,
    ];
  } else if (variant === 3) {
    // inv(fn(x)) with x outside the range.
    const xs: Record<Inv, number[]> = {
      arcsin: [9, 10, 14, 15, 20, -9, -10],
      arccos: [14, 15, 16, 20, -2, -3, -4],
      arctan: [9, 10, 14, 15, 20],
    };
    const x = pick(r, xs[inv]);
    const outer = invOuter[inv];
    const val = evalFn(outer, (x * Math.PI) / 12);
    if (Math.abs(val) > 1e12) throw new Error("tan pole");
    const a = toTwelfths(invFn(inv, val));
    answerRadians = a;
    correct = math(piTwelfths(a));
    cands = [
      {
        label: math(piTwelfths(x)),
        feedback: `The inverse only undoes ${outer} for angles in its restricted range, ${invRange[inv]}; this angle is outside it.`,
      },
      ...angleCands(inv, a),
    ];
    prompt = `Find the exact value of $\\${inv}\\left(\\${outer}\\left(${piTwelfths(x)}\\right)\\right)$ in radians.`;
    hint = `First evaluate the inside, $\\${outer}\\left(${piTwelfths(x)}\\right)$. Then ask which angle in ${invRange[inv]} has that value.`;
    explanation = [
      `Inside: $\\${outer}\\left(${piTwelfths(x)}\\right)=${exact(val)}$.`,
      `${inv} returns the angle in ${invRange[inv]} with that ${outer}.`,
      `That angle is $${piTwelfths(a)}$, which differs from $${piTwelfths(x)}$ because $${piTwelfths(x)}$ is outside the range.`,
    ];
  } else {
    // outer(inv(v)) exact value.
    for (;;) {
      const v = inv === "arctan" ? pick(r, specialTan) : pick(r, specialSin);
      const outers = (["sin", "cos", "tan"] as Fn[]).filter(
        (o) => o !== invOuter[inv],
      );
      const outer = pick(r, outers);
      const ang = invFn(inv, v);
      const res = evalFn(outer, ang);
      if (
        Math.abs(res) > 1e6 ||
        EXACT.every(([e]) => Math.abs(e - Math.abs(res)) > 1e-9)
      )
        continue;
      correct = exactLabel(res);
      const alt = (g: Fn) => evalFn(g, ang);
      const guess = (x: number, why: string): Cand | null =>
        Math.abs(x) > 1e6 ||
        EXACT.every(([e]) => Math.abs(e - Math.abs(x)) > 1e-9)
          ? null
          : { label: exactLabel(x), feedback: why };
      cands = [
        guess(
          -res,
          "Find the angle in the restricted range first; its sign decides the sign of the result.",
        ),
        guess(
          alt(invOuter[inv]),
          "That is the original value $v$. Evaluate the other function at the angle.",
        ),
        guess(
          evalFn(outer, Math.PI - ang),
          "The inverse returns an angle in a restricted range; use that angle, not its supplement.",
        ),
        guess(
          Math.abs(res) === 0.5 ? SQ3 / 2 : 0.5,
          "Check the value of the function at the reference angle.",
        ),
        guess(
          res === 0 ? 1 : 0,
          "Check the value of the function at the angle.",
        ),
        guess(Math.SQRT2 / 2, "Check the value of the function at the angle."),
      ].filter((c): c is Cand => c !== null);
      const a = toTwelfths(ang);
      answerRadians = a;
      prompt = `Find the exact value of $\\${outer}\\left(\\${inv}\\left(${valueTex(v)}\\right)\\right)$.`;
      hint = `Work from the inside out: find $\\${inv}\\left(${valueTex(v)}\\right)$ in its restricted range, ${invRange[inv]}, then apply $\\${outer}$ to that angle.`;
      explanation = [
        `$\\${inv}\\left(${valueTex(v)}\\right)=${piTwelfths(a)}$, the angle in ${invRange[inv]}.`,
        `Then $\\${outer}\\left(${piTwelfths(a)}\\right)=${exact(res)}$.`,
      ];
      break;
    }
  }
  const choices = choicesFrom(correct, cands);
  const problem = assemble(trigonometryTemplates[3]!, seed, r, {
    prompt,
    answer: "",
    hint,
    explanation,
    choices,
  });
  return { variant, inv, answerTwelfths: answerRadians, correct, problem };
}

/* ---------- 5. trigonometric equations ---------- */

const gridAngles = Array.from({ length: 24 }, (_, i) => i);
/** Solutions on [0, 2π) among multiples of π/12. */
function solveOnTurn(g: (x: number) => number, target: number): number[] {
  return gridAngles.filter((i) => {
    const x = (i * Math.PI) / 12;
    const v = g(x);
    return (
      Number.isFinite(v) && Math.abs(v) < 1e8 && Math.abs(v - target) < 1e-9
    );
  });
}
const setTex = (twelfths: number[], radians: boolean) =>
  twelfths.map((k) => (radians ? piTwelfths(k) : degTex(k * 15))).join(",\\ ");
const setLabel = (twelfths: number[], radians: boolean) =>
  twelfths.length ? math(setTex(twelfths, radians)) : "No solution";

export function trigEquationCase(seed: string) {
  assertSeed(seed);
  const id = "trig-equation-solutions";
  const r = random(id, seed);
  const variant = r(0, 4);
  const radians = r(0, 1) === 1;
  const interval = radians ? "$0\\le x<2\\pi$" : "$0^\\circ\\le x<360^\\circ$";
  const fn = pick<Fn>(r, ["sin", "cos", "tan"]);
  const unit = (x: number) => (radians ? x : (x * 180) / Math.PI);
  const trigAt = (name: Fn) => (x: number) => evalFn(name, x);
  const cofn: Fn = fn === "sin" ? "cos" : "sin";
  let prompt = "";
  let correct = "";
  let cands: Cand[] = [];
  let hint = "";
  let explanation: string[] = [];
  let solutions: number[] = [];
  let equationTex = "";
  let target = 0;

  if (variant <= 2) {
    // List all solutions.
    const targets =
      fn === "tan" ? specialTan : specialSin.filter((v) => Math.abs(v) < 1.01);
    target = pick(r, targets);
    // Write the equation in one of several equivalent forms.
    const t = Math.abs(target);
    const s = target < 0 ? "-" : "";
    let form: string;
    if (fn === "tan") {
      form =
        Math.abs(t - SQ3 / 3) < 1e-9
          ? `\\sqrt{3}\\tan x=${s}1`
          : t === 0
            ? "\\tan x=0"
            : Math.abs(t - SQ3) < 1e-9
              ? `\\tan x=${s}\\sqrt{3}`
              : `\\tan x=${s}1`;
    } else if (t === 0 || t === 1) {
      form = `${fnTex(fn)}\\,x=${s}${t}`;
    } else if (Math.abs(t - 0.5) < 1e-9) {
      form = r(0, 1)
        ? `2${fnTex(fn)}\\,x=${s}1`
        : `2${fnTex(fn)}\\,x${target < 0 ? "+" : "-"}1=0`;
    } else if (Math.abs(t - Math.SQRT2 / 2) < 1e-9) {
      form = `\\sqrt{2}${fnTex(fn)}\\,x=${s}1`;
    } else {
      form = r(0, 1)
        ? `2${fnTex(fn)}\\,x=${s}\\sqrt{3}`
        : `2${fnTex(fn)}\\,x${target < 0 ? "+" : "-"}\\sqrt{3}=0`;
    }
    equationTex = form;
    solutions = solveOnTurn(trigAt(fn), target);
    correct = setLabel(solutions, radians);
    const same = (set: number[]) => setLabel(set, radians);
    const mirrored = solveOnTurn(trigAt(fn), -target);
    const cofunction = solveOnTurn(trigAt(cofn), target);
    const wrapEnd = solutions.includes(0) ? [...solutions, 24] : null;
    cands = [
      {
        label: same(solutions.slice(0, 1)),
        feedback:
          "There is another angle on the circle with the same value. Count every angle in the interval.",
      },
      {
        label: same(mirrored),
        feedback:
          "Check the sign of the value: it decides which quadrants contain solutions.",
      },
      ...(fn === "tan"
        ? [
            {
              label: same(
                solutions.map((k) => (k + 6) % 24).sort((a, b) => a - b),
              ),
              feedback:
                "Tangent repeats every half turn, $\\pi$, not every quarter turn.",
            },
          ]
        : [
            {
              label: same(cofunction),
              feedback: `Those angles solve the ${cofn} equation. Use ${fn}.`,
            },
          ]),
      ...(wrapEnd
        ? [
            {
              label: same(wrapEnd),
              feedback: `The interval includes ${radians ? "0" : "$0^\\circ$"} but not a full turn, so the endpoint is not a solution.`,
            },
          ]
        : []),
      {
        label: same(solutions.map((k) => (k + 3) % 24).sort((a, b) => a - b)),
        feedback:
          "Check the reference angle and the quadrants where the value has this sign.",
      },
    ];
    prompt = `Solve $${equationTex}$ for all $x$ with ${interval}.`;
    hint = `First isolate $${fnTex(fn)}\\,x$ in $${equationTex}$. Then find the reference angle with that size and use the sign to choose the quadrants.`;
    explanation = [
      `Isolate: $${fnTex(fn)}\\,x=${exact(target)}$.`,
      `The reference angle is $${radians ? piTwelfths(Math.round(Math.abs(unit(Math.asin(1)))) && 0) : ""}$`,
    ];
    // Replace the clumsy reference line with an exact one.
    const refTw = (() => {
      const base = solutions.map((k) => Math.min(k, 24 - k, Math.abs(12 - k)));
      return base.length ? Math.min(...base) : 0;
    })();
    explanation = [
      `Isolate the function: $${fnTex(fn)}\\,x=${exact(target)}$.`,
      `The reference angle for a value of size $${exact(Math.abs(target))}$ is $${radians ? piTwelfths(refTw) : degTex(refTw * 15)}$.`,
      `There ${solutions.length === 1 ? "is one angle" : `are ${solutions.length} angles`} in the interval where $${fnTex(fn)}\\,x$ has this value: $${setTex(solutions, radians)}$.`,
    ];
  } else {
    // Count solutions. Variant 3: single angle with possible none/boundary; 4: double angle.
    const doubled = variant === 4;
    const multiple = doubled ? 2 : 1;
    const g = (x: number) => evalFn(fn, multiple * x);
    const choices3: { tex: string; v: number }[] =
      fn === "tan"
        ? [
            { tex: "1", v: 1 },
            { tex: "-1", v: -1 },
            { tex: "\\sqrt{3}", v: SQ3 },
            { tex: "0", v: 0 },
          ]
        : [
            { tex: "\\frac{1}{2}", v: 0.5 },
            { tex: "-\\frac{\\sqrt{3}}{2}", v: -SQ3 / 2 },
            { tex: "1", v: 1 },
            { tex: "-1", v: -1 },
            { tex: "0", v: 0 },
            ...(doubled ? [] : [{ tex: "\\frac{3}{2}", v: 1.5 }]),
          ];
    const pickT = pick(r, choices3);
    target = pickT.v;
    equationTex = `${fnTex(fn)}\\left(${doubled ? "2x" : "x"}\\right)=${pickT.tex}`;
    if (!doubled) equationTex = `${fnTex(fn)}\\,x=${pickT.tex}`;
    // Count on a fine grid: solutions of these equations lie on multiples of π/12.
    const found = gridAngles.filter((i) => {
      const v = g((i * Math.PI) / 12);
      return (
        Number.isFinite(v) && Math.abs(v) < 1e8 && Math.abs(v - target) < 1e-9
      );
    });
    solutions = found;
    // tan(2x) = ±1 has roots at odd multiples of π/8, between the π/12 steps.
    const count = Array.from({ length: 48 }, (_, i) => i).filter((i) => {
      const v = g((i * Math.PI) / 24);
      return (
        Number.isFinite(v) && Math.abs(v) < 1e8 && Math.abs(v - target) < 1e-9
      );
    }).length;
    const offGrid = count !== found.length;
    const labels = ["0", "1", "2", "4"];
    correct = `${count}`;
    if (!labels.includes(correct)) throw new Error(`Unexpected count ${count}`);
    const why = (n: number): string => {
      if (n === 0)
        return fn === "tan"
          ? "Tangent takes every real value, so some angle works."
          : "A value with size at most 1 is reached by sine and cosine, so solutions exist.";
      if (doubled && n * 2 === count)
        return "Because the angle is $2x$, it travels twice around the circle while $x$ covers one turn, doubling the count.";
      if (n > count)
        return count === 1 || count === 2
          ? "Count only the angles in the half-open interval, and watch whether a value occurs once or twice per turn."
          : "Count every solution of the equation for the whole interval.";
      return "Count every angle in the interval where the function takes this value, in each quadrant that allows it.";
    };
    cands = labels.map((l) => ({ label: l, feedback: why(Number(l)) }));
    // Boundary-specific feedback for the endpoint trap.
    if (!doubled && target === 1 && fn === "cos")
      cands = cands.map((c) =>
        c.label === "2"
          ? {
              ...c,
              feedback:
                "$x=0$ and $x=2\\pi$ give the same point, and the interval leaves out $2\\pi$. Count it once.",
            }
          : c,
      );
    prompt = `How many solutions does $${equationTex}$ have with $0\\le x<2\\pi$?`;
    hint = doubled
      ? `Let $u=2x$. As $x$ runs from $0$ to $2\\pi$, $u$ runs from $0$ to $4\\pi$, two full turns. Count the angles $u$ with $${fnTex(fn)}\\,u=${pickT.tex}$ in that range.`
      : `Picture $${fnTex(fn)}\\,x=${pickT.tex}$ on the unit circle: how many points of one turn have this value? Check whether an endpoint is included.`;
    explanation = [
      doubled
        ? `Let $u=2x$; then $u$ runs over $[0,4\\pi)$, two turns.`
        : `Look at one turn of the unit circle, $[0,2\\pi)$.`,
      offGrid
        ? `Tangent has period $\\pi$, so $u=2x$ takes the value $${pickT.tex}$ once in each half turn of $u$ (for example $u=${target > 0 ? "\\frac{\\pi}{4}" : "\\frac{3\\pi}{4}"}+n\\pi$).`
        : `The equation is satisfied at $x\\in\\{${setTex(found, true)}\\}$ in $[0,2\\pi)$.`,
      `That is ${count} solution${count === 1 ? "" : "s"}.`,
    ];
    if (count === 0)
      explanation[1] = `No angle has ${fn} equal to ${pickT.tex}${Math.abs(target) > 1 ? ", because sine and cosine values lie between $-1$ and $1$" : ""}, so there are no solutions.`;
    const choicesOut: Choice[] = labels.map((l) =>
      l === correct
        ? { label: l, correct: true }
        : { label: l, feedback: cands.find((c) => c.label === l)!.feedback },
    );
    const problem = assemble(trigonometryTemplates[4]!, seed, r, {
      prompt,
      answer: "",
      hint,
      explanation,
      choices: choicesOut,
    });
    return { variant, fn, doubled, target, solutions, radians, problem };
  }
  const choices = choicesFrom(correct, cands);
  const problem = assemble(trigonometryTemplates[4]!, seed, r, {
    prompt,
    answer: "",
    hint,
    explanation,
    choices,
  });
  return { variant, fn, doubled: false, target, solutions, radians, problem };
}

/* ---------- 6. identities ---------- */

const pyTriples: readonly [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
];
/** (p√6 + q√2)/4 with signs p, q in {±1}; or over 2 when den is 2. */
function sumTex(p: number, q: number, den = 4): string {
  if (p > 0) return `\\frac{\\sqrt{6}${q > 0 ? "+" : "-"}\\sqrt{2}}{${den}}`;
  if (q > 0) return `\\frac{\\sqrt{2}-\\sqrt{6}}{${den}}`;
  return `-\\frac{\\sqrt{6}+\\sqrt{2}}{${den}}`;
}
const sumValue = (p: number, q: number) =>
  (p * Math.sqrt(6) + q * Math.SQRT2) / 4;

export function identityCase(seed: string) {
  assertSeed(seed);
  const id = "trig-identity-value";
  const r = random(id, seed);
  const variant = r(0, 4);
  let prompt = "";
  let correct = "";
  let cands: Cand[] = [];
  let hint = "";
  let explanation: string[] = [];
  let model: Record<string, number> = {};

  if (variant <= 1) {
    const [a, b, c] = pick(r, pyTriples);
    const givenFn: "sin" | "cos" = r(0, 1) ? "sin" : "cos";
    const quad = r(1, 4);
    const sSign = quad <= 2 ? 1 : -1;
    const cSign = quad === 1 || quad === 4 ? 1 : -1;
    const sinN = (givenFn === "sin" ? a : b) * sSign;
    const cosN = (givenFn === "sin" ? b : a) * cSign;
    const givenN = givenFn === "sin" ? sinN : cosN;
    const missingSign = givenFn === "sin" ? cSign : sSign;
    const missingName = givenFn === "sin" ? "cos" : "sin";
    const where = r(0, 1)
      ? `$\\theta$ is in quadrant ${ordinal[quad]}`
      : `$\\${missingName}\\theta${missingSign > 0 ? ">" : "<"}0$`;
    const missing = givenFn === "sin" ? cosN : sinN;
    const ask: "other" | "tan" = variant === 0 ? "other" : "tan";
    const otherName = givenFn === "sin" ? "cos" : "sin";
    if (ask === "other") {
      correct = fracNum(missing, c);
      cands = [
        {
          label: fracNum(-missing, c),
          feedback: "Check the sign of the function in this quadrant.",
        },
        {
          label: fracNum(
            Math.abs(missing) * 0 +
              (c * c - givenN * givenN) * Math.sign(missing),
            c * c,
          ),
          feedback:
            "This is the square of the value. Take the square root: $\\cos^2\\theta=1-\\sin^2\\theta$ gives $\\cos\\theta$ only after the root.",
        },
        {
          label: fracNum(givenN, c),
          feedback:
            "That is the value you were given. Use the identity to find the other.",
        },
        {
          label: fracNum(-givenN, c),
          feedback:
            "That is the negative of the given value. Use $\\sin^2\\theta+\\cos^2\\theta=1$ to find the other function.",
        },
        {
          label: fracNum(Math.abs(missing), c),
          feedback: "Use the quadrant to decide the sign.",
        },
      ];
      prompt = `Given $\\${givenFn}\\theta=${fracTex(givenN, c)}$ and ${where}, find $\\${otherName}\\theta$.`;
      hint = `Use $\\sin^2\\theta+\\cos^2\\theta=1$ with $\\${givenFn}\\theta=${fracTex(givenN, c)}$ to find the size of $\\${otherName}\\theta$, then use ${where.startsWith("$\\theta") ? "the quadrant" : "the stated signs"} for its sign.`;
      explanation = [
        `$\\${otherName}^2\\theta=1-\\left(${fracTex(givenN, c)}\\right)^2=\\frac{${c * c - givenN * givenN}}{${c * c}}$.`,
        `So $|\\${otherName}\\theta|=\\frac{${Math.abs(missing)}}{${c}}$.`,
        `${where.charAt(0).toUpperCase()}${where.slice(1)}, so $\\${otherName}\\theta$ is ${missing < 0 ? "negative" : "positive"}: $\\${otherName}\\theta=${fracTex(missing, c)}$.`,
      ];
    } else {
      const tn = sinN;
      const td = cosN;
      correct = fracNum(tn, td);
      cands = [
        {
          label: fracNum(-tn, td),
          feedback:
            "Tangent is sine over cosine. Check its sign in this quadrant.",
        },
        {
          label: fracNum(td, tn),
          feedback:
            "Tangent is sine divided by cosine, not cosine divided by sine.",
        },
        {
          label: fracNum(-td, tn),
          feedback: "Tangent is sine divided by cosine.",
        },
        {
          label: fracNum(Math.abs(givenN), c),
          feedback: "That is the given value, not tangent.",
        },
      ];
      prompt = `Given $\\${givenFn}\\theta=${fracTex(givenN, c)}$ and ${where}, find $\\tan\\theta$.`;
      hint = `Starting from $\\${givenFn}\\theta=${fracTex(givenN, c)}$, find the missing coordinate from $\\sin^2\\theta+\\cos^2\\theta=1$, choose its sign from ${where.startsWith("$\\theta") ? "the quadrant" : "the stated signs"}, then divide: $\\tan\\theta=\\sin\\theta\\div\\cos\\theta$.`;
      explanation = [
        `$\\${otherName}^2\\theta=1-\\left(${fracTex(givenN, c)}\\right)^2=\\frac{${c * c - givenN * givenN}}{${c * c}}$, so $|\\${otherName}\\theta|=\\frac{${Math.abs(missing)}}{${c}}$.`,
        `${where.charAt(0).toUpperCase()}${where.slice(1)}, so $\\${otherName}\\theta=${fracTex(missing, c)}$.`,
        `$\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}=\\frac{${fracTex(sinN, c)}}{${fracTex(cosN, c)}}=${fracTex(tn, td)}$.`,
      ];
    }
    model = { sinN, cosN, c, ask: ask === "tan" ? 1 : 0 };
  } else if (variant === 2 || variant === 3) {
    const fn: "sin" | "cos" = r(0, 1) ? "sin" : "cos";
    const angle = pick(r, [15, 75, 105]);
    const radians = r(0, 1) === 1;
    const truth = evalFn(fn, deg2rad(angle));
    const signs = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ].filter(([p, q]) => Math.abs(sumValue(p!, q!) - truth) < 1e-9);
    if (signs.length !== 1)
      throw new Error("Angle-sum sign pair is not unique");
    const [p, q] = signs[0]! as [number, number];
    correct = math(sumTex(p, q));
    const wrongTex = (a: number, b: number, why: string): Cand => ({
      label: math(sumTex(a, b)),
      feedback: why,
    });
    cands = [
      {
        label: math(sumTex(Math.abs(p), q, 2)),
        feedback:
          "Multiply the denominators: the two products each have denominator $2\\cdot2=4$.",
      },
      wrongTex(
        p,
        -q,
        fn === "sin"
          ? "In $\\sin(A+B)$ the two products are added; in $\\sin(A-B)$ they are subtracted."
          : "In $\\cos(A+B)$ the products are subtracted; in $\\cos(A-B)$ they are added.",
      ),
      wrongTex(-p, -q, "Check the sign of the whole value in this quadrant."),
      wrongTex(
        -p,
        q,
        "Check the signs of both terms against the quadrant and the angle formula.",
      ),
    ];
    const split: Record<number, [number, number, string]> = {
      15: [45, 30, "-"],
      75: [45, 30, "+"],
      105: [60, 45, "+"],
    };
    const [A, B, op] = split[angle]!;
    const pretty = (d: number) => (radians ? piTex(d, 180) : degTex(d));
    prompt = `Find the exact value of $${fnTex(fn)}\\left(${pretty(angle)}\\right)$.`;
    hint = `Write $${pretty(angle)}$ as ${op === "+" ? "a sum" : "a difference"} of two special angles, $${pretty(A)}${op}${pretty(B)}$, then use the ${fn === "sin" ? "sine" : "cosine"} ${op === "+" ? "sum" : "difference"} formula with their exact values.`;
    const sA = Math.sin(deg2rad(A));
    const cA = Math.cos(deg2rad(A));
    const sB = Math.sin(deg2rad(B));
    const cB = Math.cos(deg2rad(B));
    void sA;
    void cA;
    void sB;
    void cB;
    const formula =
      fn === "sin"
        ? `\\sin A\\cos B${op}\\cos A\\sin B`
        : `\\cos A\\cos B${op === "+" ? "-" : "+"}\\sin A\\sin B`;
    explanation = [
      `Write $${pretty(angle)}=${pretty(A)}${op}${pretty(B)}$.`,
      `Use $${fnTex(fn)}(A${op}B)=${formula}$ with $A=${pretty(A)}$ and $B=${pretty(B)}$.`,
      `Substitute the exact values of sine and cosine at these angles and add the two products over the common denominator 4.`,
      `The result is ${correct}.`,
    ];
    model = { angle, p, q, fn: fn === "sin" ? 0 : 1 };
  } else {
    // Cofunction in radians: sin(pπ/q) = cos(k).
    const q = pick(r, [5, 7, 8, 9, 10, 11, 14]);
    const p = pick(
      r,
      [1, 2, 3].filter((x) => 2 * x < q && 4 * x !== q),
    );
    const askSin = r(0, 1) === 1;
    const num = q - 2 * p;
    const den = 2 * q;
    const wrapAns = piTex(num, den);
    correct = math(wrapAns);
    cands = [
      {
        label: math(piTex(p, q)),
        feedback:
          "Sine and cosine of the same angle are different; the cofunction pairs sine with cosine of the complement.",
      },
      {
        label: math(piTex(q + 2 * p, 2 * q)),
        feedback:
          "The complement is $\\frac{\\pi}{2}$ minus the angle, not plus.",
      },
      {
        label: math(piTex(q - p, q)),
        feedback:
          "That is $\\pi$ minus the angle (same sine, supplement). Use $\\frac{\\pi}{2}$ minus the angle.",
      },
      {
        label: math(piTex(p - 2 * q, 2 * q)),
        feedback: "Subtract the angle from $\\frac{\\pi}{2}$, in that order.",
      },
      {
        label: math(piTex(q - 2 * p, q)),
        feedback:
          "The complement is measured from $\\frac{\\pi}{2}$, not from $\\pi$.",
      },
      {
        label: math(piTex(2 * p, q)),
        feedback:
          "Subtract the angle from $\\frac{\\pi}{2}$; do not double it.",
      },
    ];
    const ang = piTex(p, q);
    prompt = askSin
      ? `If $\\sin\\left(${ang}\\right)=\\cos(k)$ and $0<k<\\frac{\\pi}{2}$, what is $k$?`
      : `If $\\cos\\left(${ang}\\right)=\\sin(k)$ and $0<k<\\frac{\\pi}{2}$, what is $k$?`;
    if (!askSin) {
      // cos(pπ/q) = sin(π/2 − pπ/q): same complement.
    }
    hint = `Sine and cosine of complementary angles are equal: angles whose sum is $\\frac{\\pi}{2}$. Subtract $${ang}$ from $\\frac{\\pi}{2}$.`;
    explanation = [
      `${askSin ? "$\\sin x=\\cos\\left(\\frac{\\pi}{2}-x\\right)$" : "$\\cos x=\\sin\\left(\\frac{\\pi}{2}-x\\right)$"} for every angle $x$.`,
      `So $k=\\frac{\\pi}{2}-${ang}=${wrapAns}$, which lies between 0 and $\\frac{\\pi}{2}$.`,
      `Check: $${ang}+${wrapAns}=\\frac{\\pi}{2}$, so the two angles are complementary.`,
    ];
    model = { p, q, askSin: askSin ? 1 : 0 };
  }
  const choices = choicesFrom(correct, cands);
  const problem = assemble(trigonometryTemplates[5]!, seed, r, {
    prompt,
    answer: "",
    hint,
    explanation,
    choices,
  });
  return { variant, model, correct, problem };
}

/* ---------- 7. oblique triangles ---------- */

const tenth = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
const safeRound = (x: number, step: number) => {
  const y = x / step;
  return Math.abs(y - Math.floor(y) - 0.5) > 0.04;
};

export function obliqueCase(seed: string) {
  assertSeed(seed);
  const id = "oblique-triangle-solve";
  const r = random(id, seed);
  const variant = r(0, 4);
  const sinD = (d: number) => Math.sin(deg2rad(d));
  const cosD = (d: number) => Math.cos(deg2rad(d));
  const num = (x: number, d: number) =>
    d === 0 ? String(Math.round(x)) : tenth(x);
  void num;
  let prompt = "";
  let hint = "";
  let correct = "";
  let cands: Cand[] = [];
  let explanation: string[] = [];
  let truth = 0;
  let figure: SemanticFigure | undefined;
  const lengthLabel = (x: number) => math(tenth(x));
  const degreeLabel = (x: number) => math(`${Math.round(x)}^\\circ`);

  for (let guard = 0; guard < 200; guard++) {
    if (variant === 0) {
      const A = r(35, 80);
      const B = r(30, 85);
      if (A + B > 150) continue;
      const a = r(6, 24);
      const val = (a * sinD(B)) / sinD(A);
      if (!safeRound(val * 10, 1) || !safeRound(a * 10, 1)) continue;
      const C = 180 - A - B;
      truth = val;
      correct = lengthLabel(val);
      cands = [
        {
          label: lengthLabel((a * sinD(A)) / sinD(B)),
          feedback:
            "The ratio is upside down: side $b$ is opposite $B$, so $b=a\\sin B\\div\\sin A$.",
        },
        {
          label: lengthLabel((a * B) / A),
          feedback:
            "Sides are proportional to the sines of the opposite angles, not to the angles.",
        },
        {
          label: lengthLabel((a * cosD(B)) / cosD(A)),
          feedback: "The law of sines uses sines, not cosines.",
        },
        {
          label: lengthLabel((a * sinD(B)) / sinD(C)),
          feedback: `Side $a$ is opposite $A=${A}^\\circ$, not $C$. Pair each side with the angle across from it.`,
        },
      ];
      prompt = `In triangle $ABC$, $A=${A}^\\circ$, $B=${B}^\\circ$ and $a=${a}$ units (side $a$ is opposite $A$). Find side $b$ to the nearest tenth.`;
      hint = `Side $a$ is across from $A=${A}^\\circ$ and side $b$ is across from $B=${B}^\\circ$. Set the two ratios $\\frac{a}{\\sin A}$ and $\\frac{b}{\\sin B}$ equal.`;
      explanation = [
        `The law of sines gives $\\frac{b}{\\sin B}=\\frac{a}{\\sin A}$.`,
        `$b=\\frac{${a}\\sin ${B}^\\circ}{\\sin ${A}^\\circ}$.`,
        `$b\\approx${tenth(val)}$ units.`,
      ];
      {
        const sd = sidesFromAngles(A, B, a);
        figure = sceneFigure(
          obliqueFigure({
            sides: [sd.a, sd.b, sd.c],
            shown: { a: String(a), b: null },
            angles: { A: `${A}°`, B: `${B}°` },
          }),
        );
      }
      if (new Set([correct, ...cands.map((c) => c.label)]).size < 4) continue;
      break;
    }
    if (variant === 1) {
      const a = r(5, 20);
      const b = r(5, 20);
      const C = pick(r, [35, 48, 62, 75, 110, 125, 132]);
      const val = Math.sqrt(a * a + b * b - 2 * a * b * cosD(C));
      if (!safeRound(val * 10, 1)) continue;
      truth = val;
      correct = lengthLabel(val);
      const cands0 = [
        Math.sqrt(a * a + b * b + 2 * a * b * cosD(C)),
        a * a + b * b - 2 * a * b * cosD(C),
        Math.sqrt(a * a + b * b),
        Math.sqrt(a * a + b * b - a * b * cosD(C)),
      ];
      const why = [
        "The law of cosines subtracts $2ab\\cos C$.",
        "That is $c^2$. Take the square root to find $c$.",
        "That is the Pythagorean theorem, which needs a right angle. Include $-2ab\\cos C$.",
        "The term is $2ab\\cos C$; the factor 2 was dropped.",
      ];
      cands = cands0.map((v, i) => ({
        label: lengthLabel(v),
        feedback: why[i]!,
      }));
      prompt = `In triangle $ABC$, $a=${a}$ units, $b=${b}$ units and the angle between them is $C=${C}^\\circ$. Find side $c$ to the nearest tenth.`;
      hint = `Two sides and the angle between them are known, so use the law of cosines for the side opposite $C=${C}^\\circ$: $c^2=a^2+b^2-2ab\\cos C$.`;
      explanation = [
        `$c^2=${a}^2+${b}^2-2(${a})(${b})\\cos ${C}^\\circ$.`,
        `$c^2\\approx${tenth(val * val)}$.`,
        `$c\\approx${tenth(val)}$ units.`,
      ];
      figure = sceneFigure(
        obliqueFigure({
          sides: [a, b, val],
          shown: { a: String(a), b: String(b), c: null },
          angles: { C: `${C}°` },
        }),
      );
      if (new Set([correct, ...cands.map((c) => c.label)]).size < 4) continue;
      break;
    }
    if (variant === 2) {
      const a = r(5, 16);
      const b = r(5, 16);
      const c = r(5, 16);
      if (a + b <= c || a + c <= b || b + c <= a) continue;
      const C =
        (Math.acos((a * a + b * b - c * c) / (2 * a * b)) * 180) / Math.PI;
      if (!safeRound(C, 1)) continue;
      truth = C;
      correct = degreeLabel(C);
      const A =
        (Math.acos((b * b + c * c - a * a) / (2 * b * c)) * 180) / Math.PI;
      cands = [
        {
          label: degreeLabel(180 - C),
          feedback:
            "The cosine is negative only for an obtuse angle. Check the sign of $a^2+b^2-c^2$.",
        },
        {
          label: degreeLabel(A),
          feedback: "That is the angle opposite $a$. $C$ is opposite side $c$.",
        },
        {
          label: degreeLabel(
            (Math.acos((c * c - a * a - b * b) / (2 * a * b)) * 180) / Math.PI,
          ),
          feedback: "The numerator is $a^2+b^2-c^2$, with $c^2$ subtracted.",
        },
        {
          label: degreeLabel(
            (Math.asin(Math.min(1, (c * sinD(30)) / a)) * 180) / Math.PI + 7,
          ),
          feedback: "Use all three sides in the law of cosines.",
        },
        {
          label: degreeLabel(C + 12),
          feedback: "Compute $\\arccos\\frac{a^2+b^2-c^2}{2ab}$ exactly.",
        },
      ];
      prompt = `A triangle has sides $a=${a}$, $b=${b}$ and $c=${c}$ units. Find the angle $C$ opposite side $c$ to the nearest degree.`;
      hint = `Solve the law of cosines for $\\cos C$: $\\cos C=\\frac{a^2+b^2-c^2}{2ab}$ with $a=${a}$, $b=${b}$, $c=${c}$, then take the inverse cosine.`;
      explanation = [
        `$c^2=a^2+b^2-2ab\\cos C$ gives $\\cos C=\\frac{${a * a}+${b * b}-${c * c}}{2(${a})(${b})}=\\frac{${a * a + b * b - c * c}}{${2 * a * b}}$.`,
        `$C=\\arccos\\left(\\frac{${a * a + b * b - c * c}}{${2 * a * b}}\\right)\\approx${Math.round(C)}^\\circ$.`,
      ];
      figure = sceneFigure(
        obliqueFigure({
          sides: [a, b, c],
          shown: { a: String(a), b: String(b), c: String(c) },
          angles: { C: null },
        }),
      );
      if (new Set([correct, ...cands.map((c) => c.label)]).size < 4) continue;
      break;
    }
    if (variant === 3) {
      const A = r(35, 130);
      const a = r(10, 24);
      const b = r(5, a - 1);
      const s = (b * sinD(A)) / a;
      if (s >= 0.97) continue;
      const B = (Math.asin(s) * 180) / Math.PI;
      if (!safeRound(B, 1)) continue;
      truth = B;
      correct = degreeLabel(B);
      cands = [
        {
          label: degreeLabel(180 - B),
          feedback:
            "Side $b$ is shorter than side $a$, so $B$ is smaller than $A$ and cannot be the obtuse supplement.",
        },
        {
          label: degreeLabel((A * b) / a),
          feedback: "Angles are not proportional to opposite sides; use sines.",
        },
        {
          label: degreeLabel(
            (Math.asin(Math.min(1, (b * sinD(A)) / (a + 8))) * 180) / Math.PI,
          ),
          feedback: "Use $\\sin B=\\frac{b\\sin A}{a}$ with the given sides.",
        },
        {
          label: degreeLabel(
            (Math.acos(Math.max(-1, Math.min(1, s))) * 180) / Math.PI,
          ),
          feedback:
            "Use the inverse sine of $\\sin B$, not the inverse cosine.",
        },
        {
          label: degreeLabel(B + 10),
          feedback: "Compute $\\arcsin\\frac{b\\sin A}{a}$ exactly.",
        },
      ];
      prompt = `In triangle $ABC$, $A=${A}^\\circ$, $a=${a}$ units and $b=${b}$ units. Find angle $B$ to the nearest degree.`;
      hint = `Side $b$ is across from $B$ and side $a$ is across from $A=${A}^\\circ$. Solve $\\frac{\\sin B}{b}=\\frac{\\sin A}{a}$ for $\\sin B$, then decide whether $B$ is acute.`;
      explanation = [
        `$\\sin B=\\frac{${b}\\sin ${A}^\\circ}{${a}}\\approx${s.toFixed(3)}$.`,
        `Since $b<a$, angle $B$ is smaller than $A$, so it is the acute angle: $B\\approx${Math.round(B)}^\\circ$.`,
      ];
      {
        const sd = sidesFromAngles(A, B, a);
        figure = sceneFigure(
          obliqueFigure({
            sides: [sd.a, sd.b, sd.c],
            shown: { a: String(a), b: String(b) },
            angles: { A: `${A}°`, B: null },
          }),
        );
      }
      if (new Set([correct, ...cands.map((c) => c.label)]).size < 4) continue;
      break;
    }
    // Ambiguous SSA: count triangles.
    const kind = r(0, 3);
    let A: number;
    let a: number;
    let b: number;
    if (kind === 0) {
      A = 30;
      b = 2 * r(3, 8);
      a = b / 2; // height equals a: one right triangle
    } else if (kind === 1) {
      A = pick(r, [30, 35, 40, 50, 55]);
      b = r(10, 20);
      const h = b * sinD(A);
      a = Math.floor(h * 10) / 10 - 0.5; // below the height
      a = Math.max(1, Math.round(a));
      if (a >= h) continue;
    } else if (kind === 2) {
      A = pick(r, [30, 35, 40, 50, 55]);
      b = r(10, 20);
      const h = b * sinD(A);
      a = r(Math.ceil(h + 0.3), b - 1);
      if (a <= h + 0.2 || a >= b) continue;
    } else {
      A = pick(r, [110, 120, 130, 140]);
      b = r(8, 16);
      a = r(4, 22);
      if (a === b) continue;
    }
    const h = b * sinD(A);
    let count: number;
    if (A < 90) {
      count = Math.abs(a - h) < 1e-9 ? 1 : a < h ? 0 : a >= b ? 1 : 2;
    } else {
      count = a > b ? 1 : 0;
    }
    const names = [
      "No triangle",
      "Exactly one triangle",
      "Two different triangles",
    ];
    correct = names[count]!;
    const reasonFor = (n: number): string => {
      if (n === 0)
        return `The side $a=${a}$ is at least as long as the height needed to reach the opposite side, so it can close the triangle.`;
      if (n === 1)
        return count === 0
          ? "A triangle needs side $a$ to be at least the height $b\\sin A$; check whether it reaches."
          : count === 2
            ? "When $b\\sin A<a<b$ with $A$ acute, side $a$ can swing to either of two positions."
            : "Compare $a$ with the height $b\\sin A$ and with $b$.";
      return count === 0
        ? "Two triangles need $a$ longer than the height $b\\sin A$ but shorter than $b$ with $A$ acute."
        : "Two positions work only when $A$ is acute and $b\\sin A<a<b$; compare $a$ with $b$.";
    };
    cands = [
      ...names.map((l, i) => ({ label: l, feedback: reasonFor(i) })),
      {
        label: "Not enough information",
        feedback:
          "Two sides and a non-included angle are enough to decide: compare $a$ with $b\\sin A$ and $b$.",
      },
    ];
    prompt = `In triangle $ABC$, $A=${A}^\\circ$, $a=${a}$ units and $b=${b}$ units. How many different triangles have these measurements?`;
    hint = `Side $a$ must swing to meet the ray opposite $A$. Compute the height $h=b\\sin A=${b}\\sin ${A}^\\circ$ and compare $a=${a}$ with $h$ and with $b=${b}$.`;
    explanation = [
      `The height from $C$ is $h=b\\sin A=${b}\\sin ${A}^\\circ\\approx${h.toFixed(2)}$.`,
      A < 90
        ? `$A$ is acute: no triangle if $a<h$, one right triangle if $a=h$, two if $h<a<b$, one if $a\\ge b$.`
        : `$A$ is obtuse: one triangle if $a>b$, none otherwise.`,
      `Here $a=${a}$, so there ${count === 0 ? "is no triangle" : count === 1 ? "is exactly one triangle" : "are two different triangles"}.`,
    ];
    truth = count;
    const out: Choice[] = cands.map((c) =>
      c.label === correct ? { label: c.label, correct: true } : c,
    );
    const problem = assemble(trigonometryTemplates[6]!, seed, r, {
      prompt,
      answer: "",
      hint,
      explanation,
      choices: out,
    });
    return { variant, truth, A, a, b, problem };
  }
  const choices = choicesFrom(correct, cands);
  const problem = assemble(trigonometryTemplates[6]!, seed, r, {
    prompt,
    ...(figure ? { figure } : {}),
    answer: "",
    hint,
    explanation,
    choices,
  });
  return { variant, truth, problem };
}

/* ---------- 8. trigonometric area ---------- */

/** (cn/cd)·√rad as TeX. */
function radTex(cn: number, cd: number, rad: number): string {
  const g = gcd(cn, cd) || 1;
  const n = cn / g;
  const d = cd / g;
  const root = rad === 1 ? "" : `\\sqrt{${rad}}`;
  const top = rad === 1 ? `${n}` : n === 1 ? root : `${n}${root}`;
  return d === 1 ? top : `\\frac{${top}}{${d}}`;
}
/** sin C = m√rad / 2 for special angles. */
const sinForm: Record<number, [number, number]> = {
  0: [0, 1],
  30: [1, 1],
  45: [1, 2],
  60: [1, 3],
  90: [2, 1],
  120: [1, 3],
  135: [1, 2],
  150: [1, 1],
};

export function trigAreaCase(seed: string) {
  assertSeed(seed);
  const id = "trig-triangle-area";
  const r = random(id, seed);
  const variant = r(0, 3);
  let prompt = "";
  let hint = "";
  let correct = "";
  let cands: Cand[] = [];
  let explanation: string[] = [];
  let area = 0;
  const sinD = (d: number) => Math.sin(deg2rad(d));
  if (variant === 0) {
    const C = pick(r, [30, 45, 60, 90, 120, 135, 150]);
    const a = r(4, 12);
    const b = r(3, 14);
    const [m, rad] = sinForm[C]!;
    area = 0.5 * a * b * sinD(C);
    const areaTex = (ab: number) => radTex(ab * m, 4, rad);
    const lab = (cn: number) => math(radTex(cn * m, 4, rad));
    correct = math(areaTex(a * b));
    const refC = C <= 90 ? C : 180 - C;
    const [cm, crad] = sinForm[90 - refC]!;
    const cosSign = C > 90 ? "-" : "";
    cands = [
      {
        label: lab(2 * a * b),
        feedback:
          "The factor $\\frac12$ is missing: area is $\\frac12ab\\sin C$, not $ab\\sin C$.",
      },
      {
        label: math(fracTex(a * b, 2)),
        feedback:
          "Include $\\sin C$: $\\frac12ab$ is the area only when $C$ is a right angle.",
      },
      {
        label: math(radTex(a * b * m, 8, rad)),
        feedback:
          "Multiply $\\frac12ab$ by $\\sin C$ once; a second factor of $\\frac12$ was applied.",
      },
      {
        label: math(
          cm === 0 ? "0" : `${cosSign}${radTex(a * b * cm, 4, crad)}`,
        ),
        feedback:
          "Use sine, not cosine, with the two sides and their included angle.",
      },
    ];
    prompt = `Two sides of a triangle measure ${a} units and ${b} units, and the angle between them is $${C}^\\circ$. What is the exact area in square units?`;
    hint = `The angle $${C}^\\circ$ is between the sides ${a} and ${b}. Use area $=\\frac12ab\\sin C$ and the exact value of $\\sin ${C}^\\circ$.`;
    explanation = [
      `Area $=\\frac12ab\\sin C=\\frac12(${a})(${b})\\sin ${C}^\\circ$.`,
      `$\\sin ${C}^\\circ=${exact(sinD(C))}$.`,
      `Area $=${correct.replace(/^\$|\$$/g, "")}$ square units.`,
    ];
    if (cands.length < 3) throw new Error("Insufficient area choices");
  } else if (variant === 1) {
    for (;;) {
      const C = r(25, 155);
      if (C === 90) continue;
      const a = r(5, 20);
      const b = r(5, 20);
      const val = 0.5 * a * b * sinD(C);
      if (!safeRound(val * 10, 1)) continue;
      const wrongs = [
        a * b * sinD(C),
        0.5 * a * b,
        0.5 * a * b * Math.abs(Math.cos(deg2rad(C))),
        0.5 * a * b * Math.sin(C),
      ];
      area = val;
      correct = math(tenth(val));
      cands = [
        {
          label: math(tenth(wrongs[0]!)),
          feedback: "The factor $\\frac12$ is missing.",
        },
        { label: math(tenth(wrongs[1]!)), feedback: "Include $\\sin C$." },
        {
          label: math(tenth(wrongs[2]!)),
          feedback: "Use sine of the included angle, not cosine.",
        },
        {
          label: math(tenth(Math.abs(wrongs[3]!))),
          feedback:
            "Set the calculator to degrees: the angle is given in degrees.",
        },
      ];
      if (new Set([correct, ...cands.map((c) => c.label)]).size < 4) continue;
      prompt = `A triangle has sides ${a} units and ${b} units with an included angle of $${C}^\\circ$. Find its area to the nearest tenth of a square unit.`;
      hint = `Use area $=\\frac12ab\\sin C$ with $a=${a}$, $b=${b}$ and $C=${C}^\\circ$ (angle between the two sides). Use degree mode.`;
      explanation = [
        `Area $=\\frac12(${a})(${b})\\sin ${C}^\\circ$.`,
        `$\\sin ${C}^\\circ\\approx${sinD(C).toFixed(4)}$, so area $\\approx${tenth(val)}$ square units.`,
      ];
      break;
    }
  } else if (variant === 2) {
    const C = pick(r, [30, 45, 60, 120, 135, 150]);
    const b = r(4, 12);
    const a = r(3, 14);
    const [m, rad] = sinForm[C]!;
    const areaTexLabel = radTex(a * b * m, 4, rad);
    area = 0.5 * a * b * sinD(C);
    const lenLabel = (cn: number, cd: number, rd: number) =>
      math(radTex(cn, cd, rd));
    correct = math(`${a}`);
    cands = [
      {
        label: math(fracTex(a, 2)),
        feedback:
          "Multiply the area by 2 before dividing by $b\\sin C$: the formula has $\\frac12$.",
      },
      {
        label: math(`${a * b}`),
        feedback: "Divide by $\\sin C$ as well: $a=\\frac{2A}{b\\sin C}$.",
      },
      {
        label: lenLabel(a * m, 2, rad),
        feedback:
          "Do not drop the factor $\\sin C$ from the area formula: divide by it, not multiply.",
      },
      {
        label: math(`${2 * a}`),
        feedback:
          "Solve $A=\\frac12ab\\sin C$ for $a$ once; the 2 appears only to clear the $\\frac12$.",
      },
    ];
    prompt = `A triangle has area $${areaTexLabel}$ square units. Two sides are $a$ and $b=${b}$ units, and the angle between them is $C=${C}^\\circ$. Find $a$.`;
    hint = `Start from area $=\\frac12ab\\sin C$ with $b=${b}$ and $C=${C}^\\circ$, and solve for $a$: multiply by 2, then divide by $b\\sin C$.`;
    explanation = [
      `$${areaTexLabel}=\\frac12\\cdot a\\cdot${b}\\cdot\\sin ${C}^\\circ$, and $\\sin ${C}^\\circ=${exact(sinD(C))}$.`,
      `So $${areaTexLabel}=${radTex(b * m, 4, rad)}\\,a$.`,
      `Divide: $a=${a}$ units.`,
    ];
  } else {
    // Compare areas with the same two sides and two included angles.
    const pairs: [number, number][] = [
      [30, 150],
      [60, 120],
      [45, 135],
      [30, 90],
      [150, 60],
      [120, 30],
      [90, 135],
    ];
    const [C1, C2] = pick(r, pairs);
    const a = r(6, 14);
    const b = r(6, 14);
    const s1 = sinD(C1);
    const s2 = sinD(C2);
    const rel = Math.abs(s1 - s2) < 1e-9 ? 0 : s1 > s2 ? 1 : 2;
    const names = [
      "The two areas are equal",
      "The first triangle has the greater area",
      "The second triangle has the greater area",
    ];
    correct = names[rel]!;
    const why = (i: number): string =>
      rel === 0
        ? i === 1 || i === 2
          ? "Supplementary angles have equal sines, so the areas are equal; an obtuse angle does not make the triangle larger."
          : "The two sides are the same."
        : rel === 1
          ? i === 0
            ? "The sines of the two included angles differ, so the areas differ."
            : "Compare $\\sin C_1$ and $\\sin C_2$; the larger sine gives the larger area."
          : i === 0
            ? "The sines of the two included angles differ, so the areas differ."
            : "Compare $\\sin C_1$ and $\\sin C_2$; the larger sine gives the larger area.";
    cands = [
      ...names.map((l, i) => ({ label: l, feedback: why(i) })),
      {
        label: "They cannot be compared without the third side",
        feedback:
          "Two sides and their included angle determine the area through $\\frac12ab\\sin C$.",
      },
    ];
    prompt = `Triangle 1 has sides ${a} and ${b} units with included angle $${C1}^\\circ$. Triangle 2 has the same two side lengths with included angle $${C2}^\\circ$. How do their areas compare?`;
    hint = `Both areas equal $\\frac12(${a})(${b})\\sin C$, so compare $\\sin ${C1}^\\circ$ with $\\sin ${C2}^\\circ$. Think of the heights above the base.`;
    explanation = [
      `Area 1 $=\\frac12(${a})(${b})\\sin ${C1}^\\circ$ and area 2 $=\\frac12(${a})(${b})\\sin ${C2}^\\circ$.`,
      `$\\sin ${C1}^\\circ=${exact(s1)}$ and $\\sin ${C2}^\\circ=${exact(s2)}$.`,
      `${correct}.`,
    ];
    const out: Choice[] = cands.map((c) =>
      c.label === correct ? { label: c.label, correct: true } : c,
    );
    const problem = assemble(trigonometryTemplates[7]!, seed, r, {
      prompt,
      answer: "",
      hint,
      explanation,
      choices: out,
    });
    return { variant, rel, C1, C2, area: 0, problem };
  }
  const choices = choicesFrom(correct, cands);
  const problem = assemble(trigonometryTemplates[7]!, seed, r, {
    prompt,
    answer: "",
    hint,
    explanation,
    choices,
  });
  return { variant, area, problem };
}

/* ---------- 9. periodic models ---------- */

export function periodicModelCase(seed: string) {
  assertSeed(seed);
  const id = "sinusoid-model";
  const r = random(id, seed);
  const variant = r(0, 4);
  const A = r(2, 14);
  let k = A + r(1, 10);
  while (k === 2 * A || k === 3 * A) k += 1;
  const P = pick(r, variant === 4 ? [12, 24] : [4, 6, 8, 10, 12, 24]);
  const max = k + A;
  const min = k - A;
  const bTex = piTex(2, P);
  const model = (a: number, b: string, kk: number, form: "sin" | "cos") =>
    `h(t)=${lead(a)}\\${form}\\left(${b}t\\right)${signedTerm(kk)}`;
  let prompt = "";
  let hint = "";
  let correct = "";
  let cands: Cand[] = [];
  let explanation: string[] = [];
  let expected: { A: number; B: number; k: number; form: string } | null = null;
  const context = r(0, 1);

  if (variant <= 2) {
    const form: "sin" | "cos" = variant === 2 ? "sin" : "cos";
    const lead0 = variant === 1 ? -A : A;
    expected = { A: lead0, B: (2 * Math.PI) / P, k, form };
    correct = math(model(lead0, bTex, k, form));
    const opposite = form === "cos" ? "sin" : "cos";
    cands = [
      {
        label: math(model(lead0 > 0 ? max : -max, bTex, k, form)),
        feedback:
          "The amplitude is half the distance from lowest to highest, not the highest value.",
      },
      {
        label: math(model(lead0, piTex(1, P), k, form)),
        feedback: "One cycle takes the period $P$, so $B=2\\pi\\div P$.",
      },
      {
        label: math(model(lead0, bTex, A, form)),
        feedback:
          "The midline is halfway between maximum and minimum, not the amplitude.",
      },
      {
        label: math(model(lead0, bTex, min, form)),
        feedback:
          "The midline is the average of the maximum and minimum, not the minimum.",
      },
      {
        label: math(model(-lead0, bTex, k, form)),
        feedback:
          variant === 1
            ? "The ride starts at its lowest point, so cosine must be reflected."
            : "Check the starting position: cosine starts at its maximum.",
      },
      {
        label: math(model(lead0, bTex, k, opposite as "sin" | "cos")),
        feedback:
          variant === 2
            ? "Sine starts at the midline going up; cosine starts at a maximum."
            : "Check where the model starts at $t=0$: sine starts at the midline.",
      },
      {
        label: math(model(lead0, piTex(4, P), k, form)),
        feedback: "That period is half the given period. Use $B=2\\pi\\div P$.",
      },
    ];
    if (variant === 0) {
      prompt = context
        ? `At $t=0$ hours the tide is at its highest, ${max} feet. The lowest tide is ${min} feet, and the cycle repeats every ${P} hours. Which function models the water height $h(t)$ in feet?`
        : `A weight on a spring is at its highest position, ${max} cm, at $t=0$ seconds. Its lowest position is ${min} cm and it completes one up-and-down cycle every ${P} seconds. Which function models its height $h(t)$ in cm?`;
      hint = `The model starts at its maximum, so it has the form $A\\cos(Bt)+k$. Midline $k$ is halfway between ${max} and ${min}; $A$ is half their difference; $B=2\\pi\\div ${P}$.`;
    } else if (variant === 1) {
      prompt = `A Ferris wheel rider boards at the lowest point, ${min} meters above the ground, at $t=0$ minutes. The highest point is ${max} meters, and one turn takes ${P} minutes. Which function models the rider's height $h(t)$ in meters?`;
      hint = `At $t=0$ the rider is at the minimum, so use $-A\\cos(Bt)+k$. Midline $k$ is halfway between ${min} and ${max}; $A$ is half their difference; $B=2\\pi\\div ${P}$.`;
    } else {
      prompt = `A buoy bobs between ${min} cm and ${max} cm above the sea floor. At $t=0$ seconds it passes through the midpoint of that range moving upward, and it completes a cycle every ${P} seconds. Which function models its height $h(t)$ in cm?`;
      hint = `Starting at the midline and rising is the pattern of $A\\sin(Bt)+k$. Midline $k$ is halfway between ${min} and ${max}; $A$ is half their difference; $B=2\\pi\\div ${P}$.`;
    }
    explanation = [
      `Midline: $k=\\frac{${max}+${min}}{2}=${k}$.`,
      `Amplitude: $A=\\frac{${max}-${min}}{2}=${A}$.`,
      `Frequency factor: $B=\\frac{2\\pi}{${P}}=${bTex}$.`,
      `At $t=0$ the quantity is ${variant === 0 ? "at its maximum, so use $+A\\cos$" : variant === 1 ? "at its minimum, so use $-A\\cos$" : "on the midline and rising, so use $+A\\sin$"}: ${correct}.`,
    ];
  } else if (variant === 3) {
    // One parameter.
    const which = pick(r, ["amplitude", "midline", "B"] as const);
    if (which === "amplitude") {
      correct = math(`${A}`);
      cands = [
        {
          label: math(`${max}`),
          feedback:
            "That is the maximum. The amplitude is half the distance from minimum to maximum.",
        },
        {
          label: math(`${2 * A}`),
          feedback:
            "That is the full range from minimum to maximum. The amplitude is half of it.",
        },
        {
          label: math(`${k}`),
          feedback: "That is the midline value, halfway between the extremes.",
        },
        {
          label: math(`${min}`),
          feedback:
            "That is the minimum. The amplitude is half the distance from minimum to maximum.",
        },
      ];
      prompt = `A periodic quantity has a maximum of ${max} and a minimum of ${min}. What is the amplitude of a sinusoidal model of it?`;
      hint = `Amplitude is the distance from the midline to an extreme. Find the distance between ${max} and ${min} first, then take the part of it that reaches from the midline.`;
      explanation = [
        `The range from minimum to maximum is $${max}-${min}=${2 * A}$.`,
        `The amplitude is half of it: $${A}$.`,
      ];
    } else if (which === "midline") {
      correct = math(`y=${k}`);
      cands = [
        {
          label: math(`y=${A}`),
          feedback:
            "That is the amplitude. The midline is halfway between the minimum and maximum.",
        },
        {
          label: math(`y=${max}`),
          feedback: "That is the maximum, not the midline.",
        },
        {
          label: math(`y=${min}`),
          feedback: "That is the minimum, not the midline.",
        },
        {
          label: math(`y=${2 * A}`),
          feedback:
            "That is the distance from minimum to maximum. The midline is their average.",
        },
        {
          label: math(`y=${k + 1}`),
          feedback: "Average the maximum and minimum exactly.",
        },
      ];
      prompt = `A periodic quantity has a maximum of ${max} and a minimum of ${min}. What is the equation of the midline of a sinusoidal model of it?`;
      hint = `The midline is halfway between the extreme values ${max} and ${min}. Add them and divide by 2.`;
      explanation = [
        `Midline value $=\\frac{${max}+${min}}{2}=${k}$.`,
        `The midline is $y=${k}$.`,
      ];
    } else {
      correct = math(bTex);
      cands = [
        {
          label: math(`${P}`),
          feedback: "The period is $P$; $B$ is $2\\pi\\div P$.",
        },
        {
          label: math(piTex(1, P)),
          feedback: "That period is twice as long. Use $B=2\\pi\\div P$.",
        },
        {
          label: math(piTex(P, 2)),
          feedback: "Divide $2\\pi$ by the period; do not multiply by it.",
        },
        {
          label: math(piTex(4, P)),
          feedback: "That period is half as long. Use $B=2\\pi\\div P$.",
        },
      ];
      prompt = `A sinusoidal model $y=A\\sin(Bt)+k$ has period ${P} (in the same units as $t$). What is $B$?`;
      hint = `The sine function repeats when $Bt$ increases by $2\\pi$. Set $B\\cdot ${P}=2\\pi$ and solve for $B$.`;
      explanation = [
        `One cycle needs $B\\cdot${P}=2\\pi$.`,
        `So $B=\\frac{2\\pi}{${P}}=${bTex}$.`,
      ];
    }
  } else {
    // Use the model: A cos(Bt) + k at a fraction of the period.
    const even = A % 2 === 0 ? A : A + 1;
    const AA = even;
    const kk = AA + r(1, 10);
    const form = r(0, 1) ? 1 : -1; // +cos start at max, −cos start at min
    const timing = pick(r, [
      { frac: P / 4, cos: 0, label: "quarter" },
      { frac: P / 2, cos: -1, label: "half" },
      { frac: P / 3, cos: -0.5, label: "third" },
      { frac: P / 6, cos: 0.5, label: "sixth" },
    ]);
    const val = kk + form * AA * timing.cos;
    correct = math(`${val}`);
    const wrongs = [
      kk - form * AA * timing.cos,
      form * AA * timing.cos,
      kk + AA,
      kk,
      kk - AA,
      kk + AA / 2,
      kk - AA / 2,
    ];
    const whys = [
      "Check the sign of the cosine at this angle.",
      "Add the midline $k$ after computing the cosine term.",
      "That is the maximum height; evaluate the cosine at $Bt$.",
      "That is the midline, reached only at a quarter of a period.",
      "That is the minimum, reached only at half a period.",
      "Check the cosine value at this angle; it is not $\\pm\\frac12$ here.",
      "Check the cosine value at this angle; it is not $\\pm\\frac12$ here.",
    ];
    cands = wrongs.map((v, i) => ({ label: math(`${v}`), feedback: whys[i]! }));
    const eq = `h(t)=${form === 1 ? "" : "-"}${AA}\\cos\\left(${bTex}t\\right)+${kk}`;
    prompt = context
      ? `The height in feet of a tide is modeled by $${eq}$, where $t$ is in hours. What is $h(${timing.frac})$?`
      : `The height in meters of a rider on a wheel is modeled by $${eq}$, where $t$ is in minutes. What is $h(${timing.frac})$?`;
    hint = `Evaluate the angle $${bTex}\\cdot${timing.frac}$ first. Then find the cosine of that angle and finish $${form === 1 ? "" : "-"}${AA}\\cos(\\cdot)+${kk}$.`;
    const angle = piTex(2 * timing.frac, P);
    explanation = [
      `$${bTex}\\cdot${timing.frac}=${angle}$.`,
      `$\\cos\\left(${angle}\\right)=${timing.cos === 0 ? "0" : timing.cos === 0.5 ? "\\frac12" : timing.cos === -0.5 ? "-\\frac12" : "-1"}$.`,
      `$h(${timing.frac})=${form === 1 ? "" : "-"}${AA}\\left(${timing.cos === 0 ? "0" : timing.cos === 0.5 ? "\\frac12" : timing.cos === -0.5 ? "-\\frac12" : "-1"}\\right)+${kk}=${val}$.`,
    ];
    expected = {
      A: form * AA,
      B: (2 * Math.PI) / P,
      k: kk,
      form: `eval:${timing.frac}`,
    };
  }
  const choices = choicesFrom(correct, cands);
  const problem = assemble(trigonometryTemplates[8]!, seed, r, {
    prompt,
    answer: "",
    hint,
    explanation,
    choices,
  });
  return { variant, A, k, P, max, min, expected, problem };
}

/* ---------- dispatch ---------- */

export function generateTrigonometryProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  switch (id) {
    case "special-angle-exact-value":
      return specialAngleCase(seed).problem;
    case "trig-symmetry-value":
      return symmetryCase(seed).problem;
    case "sinusoid-parameters":
      return sinusoidCase(seed).problem;
    case "inverse-trig-value":
      return inverseTrigCase(seed).problem;
    case "trig-equation-solutions":
      return trigEquationCase(seed).problem;
    case "trig-identity-value":
      return identityCase(seed).problem;
    case "oblique-triangle-solve":
      return obliqueCase(seed).problem;
    case "trig-triangle-area":
      return trigAreaCase(seed).problem;
    case "sinusoid-model":
      return periodicModelCase(seed).problem;
  }
  throw new Error(`Unknown trigonometry template ${id}`);
}
