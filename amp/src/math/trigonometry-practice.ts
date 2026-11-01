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
const fnName: Record<Fn, string> = {
  sin: "sine",
  cos: "cosine",
  tan: "tangent",
};
/** Where each quadrant sits, so "quadrant II" is never a bare name. */
const quarter = ["", "upper-right", "upper-left", "lower-left", "lower-right"];
const quadrantName = (q: number) =>
  `quadrant ${ordinal[q]}, the ${quarter[q]} quarter of the plane`;
const UNIT_CIRCLE =
  "The unit circle is the circle of radius 1 centered at the origin, $(0, 0)$. An angle starts on the positive $x$-axis and turns counterclockwise; the ray where it stops is its terminal side.";

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
/** Why a function has its sign in a quadrant, from the point's coordinates. */
function signReason(fn: Fn, quad: number): string {
  const x = quad === 1 || quad === 4 ? "positive" : "negative";
  const y = quad === 1 || quad === 2 ? "positive" : "negative";
  if (fn === "sin") return `sine is the $y$-coordinate, and $y$ is ${y} there`;
  if (fn === "cos")
    return `cosine is the $x$-coordinate, and $x$ is ${x} there`;
  return x === y
    ? `tangent is $y \\div x$, and $x$ and $y$ have the same sign there`
    : `tangent is $y \\div x$, and $x$ and $y$ have opposite signs there`;
}

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
          "The coordinates are swapped. The $x$-coordinate is the cosine, $\\cos\\theta$, and the $y$-coordinate is the sine, $\\sin\\theta$.",
      },
      {
        label: pt(-c, s),
        feedback: `The $x$-coordinate has the wrong sign. In ${quadrantName(quad)}, $x$ is ${c < 0 ? "negative" : "positive"}.`,
      },
      {
        label: pt(c, -s),
        feedback: `The $y$-coordinate has the wrong sign. In ${quadrantName(quad)}, $y$ is ${s < 0 ? "negative" : "positive"}.`,
      },
      {
        label: pt(-c, -s),
        feedback: `Both signs are reversed. The sizes are right, but the signs come from the quadrant: here, ${quadrantName(quad)}.`,
      },
    ];
    hint = `Name the quadrant that $\\theta=${angleTex(base, radians)}$ ends in. Then find its reference angle, the acute angle between the terminal side and the $x$-axis. The point is $(\\cos\\theta,\\sin\\theta)$.`;
    explanation = [
      UNIT_CIRCLE,
      "Every point on the unit circle is $(\\cos\\theta, \\sin\\theta)$. The $x$-coordinate is the cosine and the $y$-coordinate is the sine.",
      `$\\theta=${angleTex(base, radians)}$ ends in ${quadrantName(quad)}.`,
      `Its reference angle, the acute angle between the terminal side and the $x$-axis, is $${angleTex(ref, radians)}$.`,
      `At that reference angle, $\\cos=${exact(Math.abs(c))}$ and $\\sin=${exact(Math.abs(s))}$. These are the sizes of the two coordinates.`,
      `In quadrant ${ordinal[quad]}, $x$ is ${c < 0 ? "negative" : "positive"} and $y$ is ${s < 0 ? "negative" : "positive"}, so give each coordinate that sign.`,
      `The terminal side meets the unit circle at ${correct}.`,
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
        ? `That is $\\${other}$ at this angle, a different function. $\\${fn}$ is ${reading[fn]}.`
        : `$\\${fn}$ is ${reading[fn]}. Find the axis point for this angle first, then read that part of it.`;
    };
    cands = all.map((label) => ({ label, feedback: why(label) }));
    prompt = `What is $${fnTex(fn)}\\left(${angleTex(deg, radians)}\\right)$? If it has no value, choose the answer that says so.`;
    hint = `Locate $${angleTex(deg, radians)}$ on the unit circle, the circle of radius 1 around the origin: it ends on an axis. Read that point's coordinates, then use that $${fnTex(fn)}$ is ${reading[fn]}.`;
    const n = normalize(deg);
    const pointOf: Record<number, string> = {
      0: "(1, 0)",
      90: "(0, 1)",
      180: "(-1, 0)",
      270: "(0, -1)",
    };
    const wraps = deg !== n;
    explanation = [
      UNIT_CIRCLE,
      ...(wraps
        ? [
            `$${angleTex(deg, radians)}$ differs from $${angleTex(n, radians)}$ by a whole turn, so both angles end in the same place.`,
          ]
        : []),
      `$${angleTex(deg, radians)}$ ends on an axis, at the point $${pointOf[n]}$ of the unit circle.`,
      `$${fnTex(fn)}$ is ${reading[fn]}.`,
      ...(fn === "tan"
        ? [
            correct === "Undefined"
              ? "Here the $x$-coordinate is 0. Dividing by zero has no value, so the tangent is undefined."
              : "Here the $y$-coordinate is 0, and 0 divided by a nonzero number is 0.",
          ]
        : []),
      correct === "Undefined"
        ? `So $${fnTex(fn)}\\left(${angleTex(deg, radians)}\\right)$ is undefined: it has no value.`
        : `So $${fnTex(fn)}\\left(${angleTex(deg, radians)}\\right)=${correct.replace(/^\$|\$$/g, "")}$.`,
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
        feedback: `The size is right but the sign is not. In quadrant ${ordinal[quadrantOf(deg)]}, $${fnTex(fn)}$ is ${sg > 0 ? "positive" : "negative"}, because ${signReason(fn, quadrantOf(deg))}.`,
      },
      {
        label: withSign(ofRef(fn, 90 - ref)),
        feedback: `This uses $${angleTex(90 - ref, radians)}$, the angle measured from the $y$-axis. The reference angle is measured from the $x$-axis, so it is $${angleTex(ref, radians)}$.`,
      },
      {
        label: withSign(ofRef(others[0]!, ref)),
        feedback: `That is the size of $${fnTex(others[0]!)}$ at the reference angle, a different function. $${fnTex(fn)}$ is ${reading[fn]}.`,
      },
      {
        label: withSign(ofRef(others[1]!, ref)),
        feedback: `That is the size of $${fnTex(others[1]!)}$ at the reference angle, a different function. $${fnTex(fn)}$ is ${reading[fn]}.`,
      },
      ...[30, 60, 45].map((a) => ({
        label: withSign(ofRef(fn, a)),
        feedback: `That is $${fnTex(fn)}$ of a different special angle. The reference angle here is $${angleTex(ref, radians)}$, so use the value of $${fnTex(fn)}$ there.`,
      })),
    ];
    const turns =
      variant === 3
        ? ` $${angleTex(deg, radians)}$ is coterminal with $${angleTex(normalize(deg), radians)}$: it ends in the same place, because it differs by ${Math.abs(Math.round((deg - normalize(deg)) / 360))} full turn${Math.abs(Math.round((deg - normalize(deg)) / 360)) === 1 ? "" : "s"}.`
        : "";
    prompt = `Find the exact value of $${fnTex(fn)}\\left(${angleTex(deg, radians)}\\right)$ (angle in ${unitName}).`;
    hint =
      variant === 3
        ? `First add or subtract whole turns to replace $${angleTex(deg, radians)}$ by the coterminal angle, the angle between $0$ and one full turn that ends in the same place. Then find its quadrant and reference angle.`
        : `Find the quadrant of $${angleTex(deg, radians)}$ and its reference angle, the acute angle it makes with the $x$-axis. The reference angle gives the size; the quadrant gives the sign.`;
    explanation = [
      UNIT_CIRCLE,
      ...(turns ? [turns.trim()] : []),
      `The angle $${angleTex(normalize(deg), radians)}$ ends in ${quadrantName(quadrantOf(deg))}.`,
      `Its reference angle, the acute angle between the terminal side and the $x$-axis, is $${angleTex(ref, radians)}$.`,
      `At the reference angle, $${fnTex(fn)}\\left(${angleTex(ref, radians)}\\right)=${exact(refVal)}$. This known special-angle value gives the size of the answer.`,
      `In quadrant ${ordinal[quadrantOf(deg)]}, $${fnTex(fn)}$ is ${sg > 0 ? "positive" : "negative"}, because ${signReason(fn, quadrantOf(deg))}.`,
      `So the exact value is $${fnTex(fn)}\\left(${angleTex(deg, radians)}\\right)=${correct.replace(/^\$|\$$/g, "")}$.`,
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
    "The size is right but the sign is not. Sketch where the new angle ends on the unit circle, then use the sign of that coordinate there.";
  if (askFn === "tan") {
    cands.push(
      { label: fracNum(-tanNum, tanDen), feedback: signFeedback },
      {
        label: fracNum(tanDen, tanNum),
        feedback:
          "This fraction is upside down. Tangent is sine divided by cosine, $\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}$, not cosine divided by sine.",
      },
      {
        label: fracNum(-tanDen, tanNum),
        feedback:
          "This fraction is upside down. Tangent is sine divided by cosine. Then check the sign for the new angle.",
      },
    );
  } else {
    cands.push({ label: dec(-ans), feedback: signFeedback });
    const otherFeedback = `That is a value of ${askFn === "sin" ? "cosine" : "sine"}, the other coordinate. The question asks for $${fnTex(askFn)}$, so follow that coordinate.`;
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
        "This multiplies sine by cosine, which no symmetry does. Moving the angle can only change the sign of a coordinate or swap which one you read.",
    });
  }
  const givenText =
    givenFn === "sin"
      ? `\\sin\\theta=${tex(given)}`
      : `\\cos\\theta=${tex(given)}`;
  const need = acute ? " with $\\theta$ acute" : "";
  const askText = `${fnTex(askFn)}\\left(${expr}\\right)`;
  const prompt = `Given $${givenText}$${need}, find $${askText}$.`;
  const fnWord = (fn: Fn) =>
    fn === "tan" ? "tangent" : fn === "sin" ? "sine" : "cosine";
  // How the move σθ + kπ acts on the point (cos θ, sin θ).
  const moves: string[] = [];
  if (sigma === -1)
    moves.push(
      "The angle $-\\theta$ turns the same amount the other way, clockwise. That reflects the point across the $x$-axis: $x$ stays the same and $y$ changes sign.",
    );
  if (k !== 0 && half === -1)
    moves.push(
      `Adding or subtracting $${Math.abs(k) === 1 ? "\\pi" : `${Math.abs(k)}\\pi`}$ is an odd number of half turns. A half turn moves the point to the opposite side of the origin, so both $x$ and $y$ change sign.`,
    );
  if (k !== 0 && half === 1)
    moves.push(
      `Adding or subtracting $${Math.abs(k)}\\pi$ is ${Math.abs(k) / 2} whole turn${Math.abs(k) === 2 ? "" : "s"}, since one turn is $2\\pi$. A whole turn brings the point back to the same place.`,
    );
  const factor = askFn === "sin" ? half * sigma : askFn === "cos" ? half : sigma;
  const effect =
    askFn === "tan"
      ? `Tangent is $\\frac{\\sin}{\\cos}$, the $y$-coordinate divided by the $x$-coordinate. ${factor === 1 ? "Here the signs of $x$ and $y$ change together or not at all, so the tangent keeps its sign." : "Here exactly one of $x$ and $y$ changes sign, so the tangent changes sign."}`
      : `${askFn === "sin" ? "Sine is the $y$-coordinate" : "Cosine is the $x$-coordinate"}, so the ${fnWord(askFn)} of the new angle ${factor === 1 ? "has the same sign as" : "has the opposite sign to"} the ${fnWord(askFn)} of $\\theta$.`;
  const hint = `On the unit circle, compare where $${expr}$ ends with where $\\theta$ ends: a reflection across the $x$-axis, a half turn, or whole turns. ${
    acute
      ? `Because $\\theta$ is acute, use $\\sin^2\\theta+\\cos^2\\theta=1$ to find the other coordinate from the given value, ${tex(given)}.`
      : `Then decide whether the ${fnWord(askFn)} keeps or flips the sign of the given value, ${tex(given)}.`
  }`;
  const explanation = [
    "On the unit circle, the circle of radius 1 around the origin, the angle $\\theta$ ends at the point $(\\cos\\theta, \\sin\\theta)$. Cosine is the $x$-coordinate and sine is the $y$-coordinate.",
    `We know $${givenText}$.`,
    ...(acute
      ? [
          `Because $\\theta$ is acute, between $0$ and $\\frac{\\pi}{2}$, both coordinates are positive. The Pythagorean identity, $\\sin^2\\theta+\\cos^2\\theta=1$, is the circle's equation $x^2+y^2=1$.`,
          `It gives $\\${givenFn === "sin" ? "cos" : "sin"}\\theta=\\sqrt{1-${tex(gMag)}^2}=${tex(oMag)}$.`,
        ]
      : []),
    ...moves,
    effect,
    `So $${askText}=${correct.replace(/^\$|\$$/g, "")}$.`,
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
        "This multiplies $2\\pi$ by $B$. A larger $B$ makes the wave repeat sooner, so the period is $2\\pi$ divided by $B$.",
      ),
      wrong(
        piTex(bd, bn),
        "This uses $\\pi$, half a cycle. Sine finishes one full cycle when its input grows by $2\\pi$.",
      ),
      wrong(
        bd === 1 ? `${bn}` : `\\frac{${bn}}{${bd}}`,
        "This is $B$ itself, the number multiplying $x$. The period is the length of one cycle, $2\\pi\\div B$.",
      ),
      wrong(
        "2\\pi",
        "This is the period of plain $\\sin x$. Here $x$ is multiplied by $B$, which changes the period to $2\\pi\\div B$.",
      ),
    ];
    prompt = `What is the period of $${simple}$?`;
    hint = `Sine repeats each time its input, here $${B === "" ? "x" : B + "x"}$, grows by $2\\pi$. Work out how far $x$ must move for that when $B=${coeffTex(bn, bd) || "1"}$.`;
    explanation = [
      "The period is the horizontal length of one full cycle: one complete wave, after which the pattern repeats.",
      `Sine finishes one cycle each time its input grows by $2\\pi$. Here the input is $${B}x$, so $B=${coeffTex(bn, bd) || "1"}$ is the number multiplying $x$.`,
      `So $x$ must grow until $${B}\\,\\Delta x=2\\pi$, where $\\Delta x$ means the change in $x$. That gives $\\Delta x=2\\pi\\div ${bd === 1 ? bn : `\\frac{${bn}}{${bd}}`}=${periodTex}$.`,
      `Check: when $x$ grows by $${periodTex}$, the input $${B}x$ grows by $2\\pi$, which is one full cycle.`,
      `The period of $${simple}$ is $${periodTex}$.`,
    ];
  } else if (variant === 1) {
    correct = math(`${amp}`);
    cands = [
      {
        label: math(`${A}`),
        feedback:
          "This keeps the negative sign. Amplitude is a distance from the midline, so it is never negative: use $|A|$.",
      },
      {
        label: math(`${2 * amp}`),
        feedback:
          "That is the full height from minimum to maximum. The amplitude is measured from the midline, so it is half of that.",
      },
      {
        label: math(`${amp + Math.abs(k)}`),
        feedback:
          "This adds the vertical shift $k$. Adding $k$ moves the whole wave up or down; it does not make it taller. The amplitude is $|A|$.",
      },
      {
        label: math(`${amp * bn}`),
        feedback:
          "This multiplies by $B$, but $B$ only squeezes the wave sideways. The height comes from $|A|$ alone.",
      },
      {
        label: math(`${bn}`),
        feedback:
          "This is $B$, which sets the period, how often the wave repeats. The amplitude is $|A|$, the number multiplying the sine.",
      },
      {
        label: math(`${Math.abs(k)}`),
        feedback:
          "This is $k$, the number added at the end. It moves the midline up or down. The amplitude is $|A|$.",
      },
      {
        label: math(`${amp + 1}`),
        feedback:
          "The amplitude is exactly $|A|$, the absolute value of the number multiplying the sine.",
      },
      {
        label: math(`${amp + 2}`),
        feedback:
          "The amplitude is exactly $|A|$, the absolute value of the number multiplying the sine.",
      },
      {
        label: math(`${amp - 1}`),
        feedback:
          "The amplitude is exactly $|A|$, the absolute value of the number multiplying the sine.",
      },
    ];
    prompt = `What is the amplitude of $${simple}$?`;
    hint = `Amplitude is how far the curve rises above, or falls below, its midline, the horizontal center line. In $${simple}$, find the number that multiplies $\\sin$.`;
    explanation = [
      "The midline is the horizontal center line of the wave. The amplitude is how far the wave rises above it, or falls below it.",
      "Sine alone swings between $-1$ and $1$. Multiplying by $A$ stretches that swing to between $-|A|$ and $|A|$.",
      `Here $A=${A}$, the number multiplying $\\sin$. The amplitude is its absolute value, its distance from zero: $|${A}|=${amp}$.`,
      ...(A < 0
        ? [
            "The negative sign flips the wave upside down. It does not change how far the wave reaches.",
          ]
        : []),
      `Check: the maximum and minimum are each ${amp} from the midline, so they differ by ${2 * amp}.`,
      `The amplitude of $${simple}$ is ${amp}.`,
    ];
  } else if (variant === 2) {
    const kk = k === 0 ? 3 : k;
    const eq = `y=${lead(A)}\\sin\\left(${B}x\\right)${signedTerm(kk)}`;
    correct = math(`y=${kk}`);
    cands = [
      {
        label: math(`y=${-kk}`),
        feedback:
          "The sign is reversed. The midline is $y=k$, where $k$ is the number added at the end, with its own sign.",
      },
      {
        label: math(`y=${kk + amp}`),
        feedback:
          "That is the maximum, the midline plus the amplitude. The midline is halfway between the maximum and minimum.",
      },
      {
        label: math(`y=${amp}`),
        feedback:
          "This uses $|A|$, the amplitude, which is a height above the midline. The midline is set by the number added at the end.",
      },
      {
        label: math("y=0"),
        feedback:
          "The $x$-axis, $y=0$, is the midline only when nothing is added at the end. Here the wave has been moved up or down.",
      },
      {
        label: math(`y=${kk - amp}`),
        feedback:
          "That is the minimum, the midline minus the amplitude. The midline is set by the number added at the end.",
      },
      {
        label: math(`y=${kk + 1}`),
        feedback:
          "The midline is exactly $y=k$, where $k$ is the number added at the end.",
      },
    ];
    prompt = `What is the equation of the midline of $${eq}$?`;
    hint = `The midline is the horizontal line the curve swings above and below. Which term in $${eq}$ moves the whole curve up or down?`;
    explanation = [
      "The midline is the horizontal line halfway between the wave's highest and lowest points.",
      "Sine alone swings evenly above and below $y=0$. Adding a number $k$ at the end lifts every point by $k$, so the center line moves to $y=k$.",
      `Here the number added at the end is $k=${kk}$.`,
      `Check: the maximum $${kk + amp}$ and the minimum $${kk - amp}$ are each ${amp} away from $${kk}$.`,
      `The midline of $${eq}$ is $y=${kk}$.`,
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
          "The direction is reversed. Subtracting inside, $x-h$, moves the curve right; adding, $x+h$, moves it left.",
      },
      {
        label: horiz(right, piTex(hn * bn, hd * bd)),
        feedback:
          "This multiplies by $B$. The bracket is already factored as $B(x-h)$, so the shift is the number next to $x$ inside it.",
      },
      {
        label: horiz(!right, piTex(hn * bn, hd * bd)),
        feedback:
          "This multiplies by $B$ and flips the direction. The shift is the number subtracted from $x$ inside the bracket, as it stands.",
      },
      {
        label: horiz(right, piTex(hn * bd, hd * bn)),
        feedback:
          "This divides by $B$ again. The bracket is already factored as $B(x-h)$, so the shift can be read directly.",
      },
    ];
    prompt = `Describe the horizontal shift of $${factored}$ compared with $y=${lead(A)}\\sin(${B}x)${signedTerm(k)}$.`;
    hint = `A horizontal shift slides the graph left or right. Look inside the factored bracket $${B}\\left(${shiftTex(hn, hd, hSign)}\\right)$: the shift is what is subtracted from $x$, and a plus sign means the opposite direction.`;
    explanation = [
      "A horizontal shift slides the whole graph left or right without changing its shape.",
      `In $y=A\\sin(B(x-h))+k$, the number $h$ subtracted from $x$ is the shift. Here the bracket reads $${shiftTex(hn, hd, hSign)}$, so $h=${hSign > 0 ? piTex(hn, hd) : "-" + piTex(hn, hd)}$.`,
      `Why: to give the same input as before, $x$ must be $${piTex(hn, hd)}$ ${right ? "larger" : "smaller"}. So every point of the graph moves ${right ? "right" : "left"}.`,
      `Check: at $x=${hSign > 0 ? "" : "-"}${piTex(hn, hd)}$ the bracket is 0, so the curve is on its midline there, where plain sine starts at $x=0$.`,
      `So the graph is shifted ${correct}.`,
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
          "This reads the constant before factoring. Factor out $B$ first: $Bx-c=B(x-c\\div B)$, so the shift is $c\\div B$.",
      },
      {
        label: side(!right, piTex(hn, hd)),
        feedback:
          "The direction is reversed. A constant subtracted inside the sine shifts the graph right; an added constant shifts it left.",
      },
      {
        label: side(right, piTex(hn * bInt * bInt, hd)),
        feedback:
          "This multiplies the constant by $B$. Factoring $B$ out of $Bx-c$ divides the constant by $B$.",
      },
      {
        label: side(!right, c),
        feedback:
          "This skips factoring and flips the direction. Factor out $B$ to divide the constant by $B$; a subtracted constant shifts right.",
      },
    ];
    prompt = `Find the horizontal shift of $${eq}$.`;
    hint = `The shift can only be read once $x$ stands alone in a bracket. Factor $${bInt}$ out of $${bInt}x${cPos ? "-" : "+"}${c}$ so that it reads $${bInt}(x-h)$ or $${bInt}(x+h)$.`;
    explanation = [
      "A horizontal shift slides the whole graph left or right without changing its shape. It is the number subtracted from $x$ once the input is written as $B(x-h)$.",
      `Factor out $B=${bInt}$, the number multiplying $x$, by dividing each term by ${bInt}: $${bInt}x${cPos ? "-" : "+"}${c}=${bInt}\\left(x${cPos ? "-" : "+"}${piTex(hn, hd)}\\right)$.`,
      `Inside the bracket, ${cPos ? "subtracting" : "adding"} $${piTex(hn, hd)}$ moves the graph ${right ? "right" : "left"}, because $x$ must change by that much to give the same input as before.`,
      `Check: when $x=${hSign > 0 ? "" : "-"}${piTex(hn, hd)}$ the bracket is 0, so the curve crosses its midline there.`,
      `So the graph is shifted $${piTex(hn, hd)}$ units ${right ? "right" : "left"}.`,
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
          "This uses the highest $y$-value as $A$. The amplitude is half the distance from the lowest point to the highest point.",
      },
      {
        label: eqOf(Ag, piTex(1, P), kg),
        feedback:
          "This uses $\\pi\\div P$, which is half of $B$. One full cycle takes $x$ a distance $P$, so $B=2\\pi\\div P$.",
      },
      {
        label: eqOf(-Ag, bTex, kg),
        feedback:
          "The sign of $A$ is reversed. If the curve rises from the midline at $x=0$, $A$ is positive; if it falls, $A$ is negative.",
      },
      {
        label: eqOf(Ag, bTex, kg === 0 ? 1 : 0),
        feedback:
          "The added constant is wrong. It equals the midline, the $y$-value halfway between the highest and lowest points.",
      },
      {
        label: eqOf(Ag, piTex(4, P), kg),
        feedback:
          "This $B$ makes the curve repeat twice as often as the graph does. Measure one full cycle, then use $B=2\\pi\\div$ period.",
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
    hint = `Read the highest and lowest points to find the midline, the center line, and $A$. Then measure the $x$-distance for one full cycle starting at $x=0$ and use $B=2\\pi\\div$ period.`;
    explanation = [
      "In $y=A\\sin(Bx)+k$, $|A|$ is the amplitude (the height above the center line), $B$ sets how often the wave repeats, and $k$ is the midline.",
      `The highest point is $y=${kg + aabs}$ and the lowest is $y=${kg - aabs}$. The midline is halfway between them: $y=${kg}$, so $k=${kg}$.`,
      `The amplitude is half the distance from lowest to highest: $|A|=${aabs}$.`,
      `At $x=0$ the curve ${Ag > 0 ? "rises" : "falls"} from the midline. Plain sine rises there, so ${Ag > 0 ? "$A$ is positive" : "the wave is flipped and $A$ is negative"}: $A=${Ag}$.`,
      `One full cycle, the length before the wave repeats, is ${P}. Sine repeats after an input of $2\\pi$, so $B=2\\pi\\div${P}=${bTex}$.`,
      `The equation that matches the graph is ${correct}.`,
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
          "This uses $A$ with its negative sign. A negative $A$ only flips the curve; the largest and smallest values are still $k+|A|$ and $k-|A|$.",
      },
      {
        label: math(`${amp}`),
        feedback:
          "This is the amplitude alone, a distance from the midline. Add it to, or subtract it from, the midline value $k$.",
      },
      {
        label: math(`${which === "maximum" ? kk - amp : kk + amp}`),
        feedback: `That is the ${which === "maximum" ? "minimum, the midline minus the amplitude" : "maximum, the midline plus the amplitude"}. The question asks for the ${which}.`,
      },
      {
        label: math(`${kk}`),
        feedback:
          "That is the midline, halfway between the highest and lowest values. Move the amplitude up or down from it.",
      },
      {
        label: math(`${(kk + amp) * (which === "maximum" ? 1 : -1) + 7}`),
        feedback: `This is not built from the midline and amplitude. The ${which} is $k${which === "maximum" ? "+" : "-"}|A|$.`,
      },
    ];
    prompt = `What is the ${which} value of $${eq}$?`;
    hint = `Sine takes every value from $-1$ to $1$. Use the amplitude $|A|$, the height above the center line, and the midline $k$ to find the ${which} of $${eq}$.`;
    explanation = [
      "In $y=A\\sin(Bx)+k$, the midline $y=k$ is the center line, and the amplitude $|A|$ is how far the wave reaches above and below it.",
      `Here the number added at the end gives the midline $y=${kk}$. The number multiplying $\\sin$ gives the amplitude $|${A}|=${amp}$.`,
      `Sine is at most 1 and at least $-1$, so the wave reaches ${amp} ${which === "maximum" ? "above" : "below"} the midline at its ${which === "maximum" ? "highest" : "lowest"}: $${kk}${which === "maximum" ? "+" : "-"}${amp}=${value}$.`,
      `Check: the ${which === "maximum" ? "minimum" : "maximum"} is $${which === "maximum" ? kk - amp : kk + amp}$, the same distance ${amp} from the midline on the other side.`,
      `The ${which} value of $${eq}$ is ${value}.`,
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
/** What the restricted range of each inverse covers on the unit circle. */
const invHalf: Record<Inv, string> = {
  arcsin: "the right half of the unit circle, from straight down to straight up",
  arccos: "the top half of the unit circle, from the positive $x$-axis to the negative $x$-axis",
  arctan: "the right half of the unit circle, not including straight up or down",
};
const invName: Record<Inv, string> = {
  arcsin: "the inverse sine",
  arccos: "the inverse cosine",
  arctan: "the inverse tangent",
};
/** One sentence naming an inverse and why its range is restricted. */
const invIntro = (inv: Inv) =>
  `$\\${inv}$, ${invName[inv]}, answers the question "which angle has this ${fnName[invOuter[inv]]}?" Many angles do, so it always returns the one in ${invRange[inv]}: ${invHalf[inv]}.`;
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
            "That angle has the same sine, but it is outside the range. $\\arcsin$ only returns angles from $-\\frac{\\pi}{2}$ to $\\frac{\\pi}{2}$.",
        },
        {
          label: t(-a),
          feedback:
            "The sign is reversed. $\\arcsin$ of a negative number is a negative angle, and of a positive number a positive angle.",
        },
        {
          label: t(6 - a),
          feedback:
            "This is the complement, the angle whose cosine has that value. $\\arcsin$ asks for the angle whose sine has it.",
        },
        {
          label: t(a < 0 ? 24 + a : a + 24),
          feedback:
            "That angle ends in the same place, a whole turn away, but it lies outside the range of $\\arcsin$, $-\\frac{\\pi}{2}$ to $\\frac{\\pi}{2}$.",
        },
        {
          label: t(a + 6),
          feedback:
            "This angle does not have the given sine. Find the reference angle from the value's size, then place it from $-\\frac{\\pi}{2}$ to $\\frac{\\pi}{2}$.",
        },
        {
          label: t(a - 6),
          feedback:
            "This angle does not have the given sine. Find the reference angle from the value's size, then place it from $-\\frac{\\pi}{2}$ to $\\frac{\\pi}{2}$.",
        },
      ];
    if (inverse === "arccos")
      return [
        {
          label: t(-a),
          feedback:
            "This angle is negative. $\\arccos$ returns angles from 0 to $\\pi$, the top half of the circle, so it is never negative.",
        },
        {
          label: t(12 - a),
          feedback:
            "That angle has the opposite cosine, a sign error. A negative cosine gives an angle past $\\frac{\\pi}{2}$; a positive one gives an angle below it.",
        },
        {
          label: t(6 - a),
          feedback:
            "This is the complement, the angle whose sine has that value. $\\arccos$ asks for the angle whose cosine has it.",
        },
        {
          label: t(24 - a),
          feedback:
            "That angle has the same cosine, but it is outside the range. $\\arccos$ only returns angles from 0 to $\\pi$.",
        },
        {
          label: t(a + 6),
          feedback:
            "This angle does not have the given cosine. Find the reference angle from the value's size, then place it from 0 to $\\pi$.",
        },
        {
          label: t(a - 6),
          feedback:
            "This angle does not have the given cosine. Find the reference angle from the value's size, then place it from 0 to $\\pi$.",
        },
      ];
    return [
      {
        label: t(a + 12),
        feedback:
          "That angle has the same tangent, but it is outside the range. $\\arctan$ only returns angles between $-\\frac{\\pi}{2}$ and $\\frac{\\pi}{2}$.",
      },
      {
        label: t(-a),
        feedback:
          "The sign is reversed. $\\arctan$ of a negative number is a negative angle, and of a positive number a positive angle.",
      },
      {
        label: t(6 - a),
        feedback:
          "This is the complement, whose tangent is the reciprocal (one divided by the value). Use the angle whose tangent is the value itself.",
      },
      {
        label: t(a - 12),
        feedback:
          "That angle has the same tangent, but it is outside the range of $\\arctan$, between $-\\frac{\\pi}{2}$ and $\\frac{\\pi}{2}$.",
      },
      {
        label: t(a + 6),
        feedback:
          "This angle does not have the given tangent. Find the reference angle from the value's size, then place it between $-\\frac{\\pi}{2}$ and $\\frac{\\pi}{2}$.",
      },
      {
        label: t(a - 6),
        feedback:
          "This angle does not have the given tangent. Find the reference angle from the value's size, then place it between $-\\frac{\\pi}{2}$ and $\\frac{\\pi}{2}$.",
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
    hint = `$\\${inv}(${valueTex(v)})$ is the one angle in the range ${invRange[inv]} whose ${fnName[invOuter[inv]]} is $${valueTex(v)}$. First find the reference angle, the first-quadrant angle whose ${fnName[invOuter[inv]]} has that size.`;
    const refTw = toTwelfths(invFn(inv, Math.abs(v)));
    const place =
      v === 0
        ? `In that range, the angle with $\\${invOuter[inv]}$ equal to 0 is $${piTwelfths(a)}$.`
        : v > 0
          ? `The value is positive, so the angle is the reference angle itself, $${piTwelfths(a)}$.`
          : inv === "arccos"
            ? `The value is negative, so the angle lies past $\\frac{\\pi}{2}$, on the left: $\\pi-${piTwelfths(refTw)}=${piTwelfths(a)}$.`
            : `The value is negative, so the angle turns clockwise, below the $x$-axis: $${piTwelfths(a)}$.`;
    explanation = [
      invIntro(inv),
      `Set the sign aside first. The reference angle is the angle from 0 to $\\frac{\\pi}{2}$ whose ${fnName[invOuter[inv]]} is $\\left|${valueTex(v)}\\right|$, the size of the value. It is $${piTwelfths(refTw)}$.`,
      place,
      `So $\\${inv}\\left(${valueTex(v)}\\right)=${piTwelfths(a)}$.`,
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
        feedback: `This assumes the inverse simply cancels $\\${outer}$. It does only for angles in its range, ${invRange[inv]}, and this angle is outside it.`,
      },
      ...angleCands(inv, a),
    ];
    prompt = `Find the exact value of $\\${inv}\\left(\\${outer}\\left(${piTwelfths(x)}\\right)\\right)$ in radians.`;
    hint = `Work from the inside out. First evaluate $\\${outer}\\left(${piTwelfths(x)}\\right)$. Then ask which angle in ${invRange[inv]} has that value.`;
    explanation = [
      invIntro(inv),
      `Work from the inside out. First, $\\${outer}\\left(${piTwelfths(x)}\\right)=${exact(val)}$.`,
      `Next, $\\${inv}$ of that value is the angle in ${invRange[inv]} whose ${fnName[outer]} is $${exact(val)}$. That angle is $${piTwelfths(a)}$.`,
      `It differs from $${piTwelfths(x)}$ because $${piTwelfths(x)}$ is outside the range, even though both angles have the same ${fnName[outer]}.`,
      `So $\\${inv}\\left(\\${outer}\\left(${piTwelfths(x)}\\right)\\right)=${piTwelfths(a)}$.`,
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
          "The sign is reversed. Find the angle in the restricted range first; where it ends decides the sign of the result.",
        ),
        guess(
          alt(invOuter[inv]),
          "That is the value you started with. The inverse and the outer function are different, so evaluate the outer one at the angle.",
        ),
        guess(
          evalFn(outer, Math.PI - ang),
          "This uses the supplement, $\\pi$ minus the angle. The inverse returns the angle in its restricted range, so use that angle.",
        ),
        guess(
          Math.abs(res) === 0.5 ? SQ3 / 2 : 0.5,
          "This is the value of the outer function at a different special angle. Use the angle the inverse returned.",
        ),
        guess(
          res === 0 ? 1 : 0,
          "This is not the outer function's value at the angle the inverse returned. Find that angle, then evaluate.",
        ),
        guess(
          Math.SQRT2 / 2,
          "This is not the outer function's value at the angle the inverse returned. Find that angle, then evaluate.",
        ),
      ].filter((c): c is Cand => c !== null);
      const a = toTwelfths(ang);
      answerRadians = a;
      prompt = `Find the exact value of $\\${outer}\\left(\\${inv}\\left(${valueTex(v)}\\right)\\right)$.`;
      hint = `Work from the inside out: find $\\${inv}\\left(${valueTex(v)}\\right)$ in its restricted range, ${invRange[inv]}, then apply $\\${outer}$ to that angle.`;
      explanation = [
        invIntro(inv),
        `Work from the inside out. The angle in ${invRange[inv]} whose ${fnName[invOuter[inv]]} is $${valueTex(v)}$ is $${piTwelfths(a)}$.`,
        `Now apply $\\${outer}$ to that angle. $\\${outer}$ is ${reading[outer]}.`,
        `$\\${outer}\\left(${piTwelfths(a)}\\right)=${exact(res)}$.`,
        `So $\\${outer}\\left(\\${inv}\\left(${valueTex(v)}\\right)\\right)=${exact(res)}$.`,
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
          "This lists only one angle. On one full turn this value occurs at another angle too; find it from the reference angle.",
      },
      {
        label: same(mirrored),
        feedback:
          "These angles give the opposite sign. The sign of the value decides which quadrants hold the solutions.",
      },
      ...(fn === "tan"
        ? [
            {
              label: same(
                solutions.map((k) => (k + 6) % 24).sort((a, b) => a - b),
              ),
              feedback:
                "These are a quarter turn off. Tangent repeats every half turn, so its solutions are half a turn apart.",
            },
          ]
        : [
            {
              label: same(cofunction),
              feedback: `Those angles solve the ${fnName[cofn]} equation, a different function. The question uses ${fnName[fn]}.`,
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
        feedback: `These angles are all off by $${radians ? piTwelfths(3) : degTex(45)}$. Recheck the reference angle, then use the quadrants where the value has this sign.`,
      },
    ];
    prompt = `Solve $${equationTex}$ for all $x$ with ${interval}.`;
    hint = `First get $${fnTex(fn)}\\,x$ alone on one side of $${equationTex}$. Then find the reference angle, the acute angle with that size of value, and use the sign to choose the quadrants.`;
    void unit;
    const refTw = (() => {
      const base = solutions.map((k) => Math.min(k, 24 - k, Math.abs(12 - k)));
      return base.length ? Math.min(...base) : 0;
    })();
    const isolated = equationTex.startsWith(fnTex(fn));
    const quadrants: Record<Fn, [string, string]> = {
      sin: ["I and II", "III and IV"],
      cos: ["I and IV", "II and III"],
      tan: ["I and III", "II and IV"],
    };
    const onAxis = target === 0 || (fn !== "tan" && Math.abs(target) === 1);
    explanation = [
      `To solve means to find every angle $x$ with ${interval} that makes the equation true.`,
      isolated
        ? `The ${fnName[fn]} is already alone: $${fnTex(fn)}\\,x=${exact(target)}$.`
        : `First get the ${fnName[fn]} alone by undoing the other operations on both sides: $${fnTex(fn)}\\,x=${exact(target)}$.`,
      `Set the sign aside. The reference angle, the angle from the $x$-axis whose ${fnName[fn]} has size $${exact(Math.abs(target))}$, is $${radians ? piTwelfths(refTw) : degTex(refTw * 15)}$.`,
      onAxis
        ? `This value occurs where the terminal side lies on an axis, so the solutions are axis angles.`
        : `The ${fnName[fn]} is ${target > 0 ? "positive" : "negative"} in quadrants ${quadrants[fn][target > 0 ? 0 : 1]}, so there is one solution in each, at the reference angle from the $x$-axis.`,
      solutions.length === 1
        ? `So the only solution with ${interval} is $x=${setTex(solutions, radians)}$.`
        : `So the solutions with ${interval} are $${setTex(solutions, radians)}$.`,
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
          ? "Tangent takes every real value, so some angle always works."
          : "Sine and cosine reach every value from $-1$ to $1$, and this value is in that range, so solutions exist.";
      if (doubled && n * 2 === count)
        return "This counts one turn only. Because the angle is $2x$, it travels twice around the circle while $x$ covers one turn, so the count doubles.";
      if (n > count)
        return count === 1 || count === 2
          ? "This counts too many. The interval leaves out $2\\pi$, and some values occur only once per turn, at an axis."
          : "This counts too many. List the solutions angle by angle over the whole interval.";
      return "This misses some solutions. Count every angle in the interval where the function takes this value, in each quadrant that allows it.";
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
      : `Picture $${fnTex(fn)}\\,x=${pickT.tex}$ on the unit circle, the circle of radius 1 around the origin: how many points of one turn have this value? Check whether an endpoint is included.`;
    explanation = [
      doubled
        ? `Let $u=2x$, a new name for the doubled angle. As $x$ covers one turn, $0\\le x<2\\pi$, $u$ covers two turns, $0\\le u<4\\pi$.`
        : `The interval $0\\le x<2\\pi$ is one turn of the unit circle. It leaves out $2\\pi$, which is the same point as 0.`,
      offGrid
        ? `Tangent has period $\\pi$, so $u=2x$ takes the value $${pickT.tex}$ once in each half turn of $u$ (for example $u=${target > 0 ? "\\frac{\\pi}{4}" : "\\frac{3\\pi}{4}"}+n\\pi$).`
        : `The equation is satisfied at $x\\in\\{${setTex(found, true)}\\}$ in $[0,2\\pi)$.`,
      `So $${equationTex}$ has ${count} solution${count === 1 ? "" : "s"} with $0\\le x<2\\pi$.`,
    ];
    if (count === 0)
      explanation[1] = `No angle has ${fnName[fn]} equal to $${pickT.tex}$${Math.abs(target) > 1 ? ", because sine and cosine are coordinates on a circle of radius 1, so they always lie between $-1$ and $1$" : ""}.`;
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
          feedback: `The size is right but the sign is not. Here ${where}, so $\\${otherName}\\theta$ is ${missing < 0 ? "negative" : "positive"}.`,
        },
        {
          label: fracNum(
            Math.abs(missing) * 0 +
              (c * c - givenN * givenN) * Math.sign(missing),
            c * c,
          ),
          feedback:
            "This stops at the square. The identity gives the squared value; take the square root to get the value itself.",
        },
        {
          label: fracNum(givenN, c),
          feedback:
            "That is the value you were given, the other coordinate. Use the identity to find the missing one.",
        },
        {
          label: fracNum(-givenN, c),
          feedback:
            "That is the given value with its sign flipped, not the other function. Use $\\sin^2\\theta+\\cos^2\\theta=1$ to find the missing one.",
        },
        {
          label: fracNum(Math.abs(missing), c),
          feedback: `The size is right, but the sign must come from the quadrant. Here ${where}, so $\\${otherName}\\theta$ is ${missing < 0 ? "negative" : "positive"}.`,
        },
      ];
      prompt = `Given $\\${givenFn}\\theta=${fracTex(givenN, c)}$ and ${where}, find $\\${otherName}\\theta$.`;
      hint = `Use $\\sin^2\\theta+\\cos^2\\theta=1$ with $\\${givenFn}\\theta=${fracTex(givenN, c)}$ to find the size of $\\${otherName}\\theta$, then use ${where.startsWith("$\\theta") ? "the quadrant" : "the stated signs"} for its sign.`;
      explanation = [
        "On the unit circle, the circle of radius 1 around the origin, the point for angle $\\theta$ is $(\\cos\\theta, \\sin\\theta)$.",
        "Its distance from the origin is 1, so the Pythagorean identity holds: $\\sin^2\\theta+\\cos^2\\theta=1$. Here $\\sin^2\\theta$ means $(\\sin\\theta)^2$.",
        `Solve it for the missing part: $\\${otherName}^2\\theta=1-\\left(${fracTex(givenN, c)}\\right)^2=\\frac{${c * c - givenN * givenN}}{${c * c}}$.`,
        `Take the square root: $|\\${otherName}\\theta|=\\frac{${Math.abs(missing)}}{${c}}$. The bars mean size without sign.`,
        `${where.charAt(0).toUpperCase()}${where.slice(1)}, so $\\${otherName}\\theta$ is ${missing < 0 ? "negative" : "positive"}.`,
        `So $\\${otherName}\\theta=${fracTex(missing, c)}$.`,
      ];
    } else {
      const tn = sinN;
      const td = cosN;
      correct = fracNum(tn, td);
      cands = [
        {
          label: fracNum(-tn, td),
          feedback: `The size is right but the sign is not. Tangent is sine divided by cosine, so its sign comes from both signs. Here ${where}.`,
        },
        {
          label: fracNum(td, tn),
          feedback:
            "This fraction is upside down. Tangent is sine divided by cosine, not cosine divided by sine.",
        },
        {
          label: fracNum(-td, tn),
          feedback:
            "This fraction is upside down and the sign is off. Tangent is sine divided by cosine.",
        },
        {
          label: fracNum(Math.abs(givenN), c),
          feedback:
            "That is the size of the given value, not the tangent. Tangent is sine divided by cosine.",
        },
      ];
      prompt = `Given $\\${givenFn}\\theta=${fracTex(givenN, c)}$ and ${where}, find $\\tan\\theta$.`;
      hint = `Starting from $\\${givenFn}\\theta=${fracTex(givenN, c)}$, find the missing coordinate from $\\sin^2\\theta+\\cos^2\\theta=1$, choose its sign from ${where.startsWith("$\\theta") ? "the quadrant" : "the stated signs"}, then divide: $\\tan\\theta=\\sin\\theta\\div\\cos\\theta$.`;
      explanation = [
        "On the unit circle, the point for angle $\\theta$ is $(\\cos\\theta, \\sin\\theta)$. Tangent is $y$ divided by $x$: $\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}$.",
        "So we need both coordinates. The Pythagorean identity, $\\sin^2\\theta+\\cos^2\\theta=1$, says the point is 1 unit from the origin.",
        `Solve it for the missing part: $\\${otherName}^2\\theta=1-\\left(${fracTex(givenN, c)}\\right)^2=\\frac{${c * c - givenN * givenN}}{${c * c}}$, so $|\\${otherName}\\theta|=\\frac{${Math.abs(missing)}}{${c}}$.`,
        `${where.charAt(0).toUpperCase()}${where.slice(1)}, which fixes the sign: $\\${otherName}\\theta=${fracTex(missing, c)}$.`,
        `Divide: $\\tan\\theta=\\frac{${fracTex(sinN, c)}}{${fracTex(cosN, c)}}=${fracTex(tn, td)}$. The two denominators of ${c} cancel.`,
        `So $\\tan\\theta=${fracTex(tn, td)}$.`,
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
          "This keeps a denominator of 2. Each product multiplies two fractions with denominator 2, so its denominator is $2\\cdot2=4$.",
      },
      wrongTex(
        p,
        -q,
        fn === "sin"
          ? "The middle sign is wrong. In $\\sin(A+B)$ the two products are added; in $\\sin(A-B)$ they are subtracted."
          : "The middle sign is wrong. Cosine flips it: in $\\cos(A+B)$ the products are subtracted; in $\\cos(A-B)$ they are added.",
      ),
      wrongTex(
        -p,
        -q,
        "The whole value has the wrong sign. Check which quadrant the angle is in: there it must be positive or negative.",
      ),
      wrongTex(
        -p,
        q,
        "Both terms carry the wrong signs. Rewrite the formula, then substitute each exact value with its own sign.",
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
    const formula =
      fn === "sin"
        ? `\\sin A\\cos B${op}\\cos A\\sin B`
        : `\\cos A\\cos B${op === "+" ? "-" : "+"}\\sin A\\sin B`;
    // Each special value is (numerator)/2; a product of two is (numerator)/4.
    const top = (v: number) =>
      Math.abs(v - 0.5) < 1e-9
        ? "1"
        : Math.abs(v - Math.SQRT2 / 2) < 1e-9
          ? "\\sqrt{2}"
          : "\\sqrt{3}";
    const half = (v: number) => `\\frac{${top(v)}}{2}`;
    const productTop = (u: number, v: number) =>
      top(u) === "1" ? top(v) : top(v) === "1" ? top(u) : "\\sqrt{6}";
    const [u1, v1, u2, v2] = fn === "sin" ? [sA, cB, cA, sB] : [cA, cB, sA, sB];
    const middle = fn === "sin" ? op : op === "+" ? "-" : "+";
    explanation = [
      `The angle $${pretty(angle)}$ is not a special angle, but it is ${op === "+" ? "the sum" : "the difference"} of two: $${pretty(angle)}=${pretty(A)}${op}${pretty(B)}$.`,
      `The angle ${op === "+" ? "sum" : "difference"} formula for ${fn === "sin" ? "sine" : "cosine"} rewrites it with values we know: $${fnTex(fn)}(A${op}B)=${formula}$.`,
      `Use $A=${pretty(A)}$ and $B=${pretty(B)}$: $${half(u1)}\\cdot${half(v1)}${middle}${half(u2)}\\cdot${half(v2)}$.`,
      `Multiply tops and bottoms. Each product has denominator $2\\cdot2=4$: $\\frac{${productTop(u1, v1)}}{4}${middle}\\frac{${productTop(u2, v2)}}{4}$.`,
      `Combine over the common denominator 4: $${sumTex(p, q)}$.`,
      `So the exact value of $${fnTex(fn)}\\left(${pretty(angle)}\\right)$ is ${correct}.`,
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
          "This uses the same angle. Sine and cosine of one angle differ; sine of an angle equals cosine of its complement.",
      },
      {
        label: math(piTex(q + 2 * p, 2 * q)),
        feedback:
          "This adds the angle to $\\frac{\\pi}{2}$. The complement is $\\frac{\\pi}{2}$ minus the angle.",
      },
      {
        label: math(piTex(q - p, q)),
        feedback:
          "That is $\\pi$ minus the angle, the supplement, which has the same sine. Sine and cosine swap at the complement, $\\frac{\\pi}{2}$ minus the angle.",
      },
      {
        label: math(piTex(p - 2 * q, 2 * q)),
        feedback:
          "This subtracts in the wrong order. Subtract the angle from $\\frac{\\pi}{2}$.",
      },
      {
        label: math(piTex(q - 2 * p, q)),
        feedback:
          "This measures from $\\pi$. The complement is measured from $\\frac{\\pi}{2}$, a right angle.",
      },
      {
        label: math(piTex(2 * p, q)),
        feedback:
          "This doubles the angle. Subtract the angle from $\\frac{\\pi}{2}$ instead.",
      },
    ];
    const ang = piTex(p, q);
    prompt = askSin
      ? `If $\\sin\\left(${ang}\\right)=\\cos(k)$ and $0<k<\\frac{\\pi}{2}$, what is $k$?`
      : `If $\\cos\\left(${ang}\\right)=\\sin(k)$ and $0<k<\\frac{\\pi}{2}$, what is $k$?`;
    if (!askSin) {
      // cos(pπ/q) = sin(π/2 − pπ/q): same complement.
    }
    hint = `Complementary angles are angles whose sum is $\\frac{\\pi}{2}$, a right angle. Sine of one equals cosine of the other, so subtract $${ang}$ from $\\frac{\\pi}{2}$.`;
    explanation = [
      "Complementary angles add up to $\\frac{\\pi}{2}$, a right angle. They are the two acute angles of a right triangle.",
      "The side opposite one acute angle is next to the other. So the sine of one angle equals the cosine of its complement.",
      `As a rule: ${askSin ? "$\\sin x=\\cos\\left(\\frac{\\pi}{2}-x\\right)$" : "$\\cos x=\\sin\\left(\\frac{\\pi}{2}-x\\right)$"} for every angle $x$.`,
      `So $k=\\frac{\\pi}{2}-${ang}=${wrapAns}$, which lies between 0 and $\\frac{\\pi}{2}$ as required.`,
      `Check: $${ang}+${wrapAns}=\\frac{\\pi}{2}$, so the two angles are complementary.`,
      `So $k=${wrapAns}$.`,
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
const LAW_OF_SINES =
  "The law of sines: in any triangle, each side divided by the sine of the angle across from it gives the same number.";
const LAW_OF_COSINES =
  "The law of cosines, $c^2=a^2+b^2-2ab\\cos C$, links three sides and one angle; $C$ is the angle across from side $c$.";
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
            "The sines are swapped. Side $b$ is across from $B$, so $\\sin B$ goes on top: $b=a\\sin B\\div\\sin A$.",
        },
        {
          label: lengthLabel((a * B) / A),
          feedback:
            "This scales by the angles themselves. Sides are proportional to the sines of the opposite angles, not to the angles.",
        },
        {
          label: lengthLabel((a * cosD(B)) / cosD(A)),
          feedback:
            "This uses cosines. The law of sines pairs each side with the sine of the angle across from it.",
        },
        {
          label: lengthLabel((a * sinD(B)) / sinD(C)),
          feedback: `Side $a$ is opposite $A=${A}^\\circ$, not $C$. Pair each side with the angle across from it.`,
        },
      ];
      prompt = `In triangle $ABC$, $A=${A}^\\circ$, $B=${B}^\\circ$ and $a=${a}$ units (side $a$ is opposite $A$). Find side $b$ to the nearest tenth.`;
      hint = `Side $a$ is across from $A=${A}^\\circ$ and side $b$ is across from $B=${B}^\\circ$. By the law of sines, set the two ratios $\\frac{a}{\\sin A}$ and $\\frac{b}{\\sin B}$ equal.`;
      explanation = [
        LAW_OF_SINES,
        `Side $a$ is across from $A$, and side $b$ is across from $B$. So $\\frac{b}{\\sin B}=\\frac{a}{\\sin A}$.`,
        "Multiply both sides by $\\sin B$ to get $b$ alone: $b=\\frac{a\\sin B}{\\sin A}$.",
        `Substitute the given values: $b=\\frac{${a}\\sin ${B}^\\circ}{\\sin ${A}^\\circ}\\approx${tenth(val)}$.`,
        `Side $b$ is about ${tenth(val)} units long.`,
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
        "This adds $2ab\\cos C$. The law of cosines subtracts it: $c^2=a^2+b^2-2ab\\cos C$.",
        "That is $c^2$, the side squared. Take the square root to find $c$.",
        "That is the Pythagorean theorem, which needs a right angle. Include the correction $-2ab\\cos C$.",
        "The factor 2 was dropped. The correction term is $2ab\\cos C$.",
      ];
      cands = cands0.map((v, i) => ({
        label: lengthLabel(v),
        feedback: why[i]!,
      }));
      prompt = `In triangle $ABC$, $a=${a}$ units, $b=${b}$ units and the angle between them is $C=${C}^\\circ$. Find side $c$ to the nearest tenth.`;
      hint = `Two sides and the angle between them are known, so use the law of cosines for the side across from $C=${C}^\\circ$: $c^2=a^2+b^2-2ab\\cos C$.`;
      explanation = [
        LAW_OF_COSINES,
        "It is the Pythagorean theorem, $c^2=a^2+b^2$, with a correction $2ab\\cos C$ for an angle that is not $90^\\circ$.",
        `Substitute $a=${a}$, $b=${b}$ and $C=${C}^\\circ$: $c^2=${a}^2+${b}^2-2(${a})(${b})\\cos ${C}^\\circ\\approx${tenth(val * val)}$.`,
        `Take the square root, because the formula gives $c^2$: $c\\approx${tenth(val)}$.`,
        `Side $c$ is about ${tenth(val)} units long.`,
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
            "This is the supplement, $180^\\circ$ minus the angle. The cosine is negative only for an obtuse angle, so check the sign of $a^2+b^2-c^2$.",
        },
        {
          label: degreeLabel(A),
          feedback:
            "That is the angle across from side $a$. Angle $C$ is across from side $c$, so $c^2$ is the subtracted square.",
        },
        {
          label: degreeLabel(
            (Math.acos((c * c - a * a - b * b) / (2 * a * b)) * 180) / Math.PI,
          ),
          feedback:
            "The numerator has the wrong signs. It is $a^2+b^2-c^2$, with only $c^2$ subtracted.",
        },
        {
          label: degreeLabel(
            (Math.asin(Math.min(1, (c * sinD(30)) / a)) * 180) / Math.PI + 7,
          ),
          feedback:
            "This does not use all three sides. With three sides known, the law of cosines gives the angle.",
        },
        {
          label: degreeLabel(C + 12),
          feedback:
            "This is off by a computing slip. Work out $\\frac{a^2+b^2-c^2}{2ab}$ carefully, then take its inverse cosine.",
        },
      ];
      prompt = `A triangle has sides $a=${a}$, $b=${b}$ and $c=${c}$ units. Find the angle $C$ opposite side $c$ to the nearest degree.`;
      hint = `Solve the law of cosines for $\\cos C$: $\\cos C=\\frac{a^2+b^2-c^2}{2ab}$ with $a=${a}$, $b=${b}$, $c=${c}$. Then take the inverse cosine, the angle with that cosine.`;
      explanation = [
        LAW_OF_COSINES,
        "Solve it for $\\cos C$: add $2ab\\cos C$ and subtract $c^2$ on both sides, then divide by $2ab$. This gives $\\cos C=\\frac{a^2+b^2-c^2}{2ab}$.",
        `Substitute: $\\cos C=\\frac{${a * a}+${b * b}-${c * c}}{2(${a})(${b})}=\\frac{${a * a + b * b - c * c}}{${2 * a * b}}$.`,
        `The inverse cosine, $\\arccos$, gives the angle with that cosine: $C=\\arccos\\left(\\frac{${a * a + b * b - c * c}}{${2 * a * b}}\\right)\\approx${Math.round(C)}^\\circ$.`,
        `Angle $C$ is about $${Math.round(C)}^\\circ$.`,
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
            "This is the obtuse supplement, $180^\\circ$ minus the angle. Side $b$ is shorter than side $a$, so $B$ is smaller than $A$ and must be acute.",
        },
        {
          label: degreeLabel((A * b) / a),
          feedback:
            "This scales the angle by the sides. Sides are proportional to the sines of the opposite angles, not to the angles.",
        },
        {
          label: degreeLabel(
            (Math.asin(Math.min(1, (b * sinD(A)) / (a + 8))) * 180) / Math.PI,
          ),
          feedback:
            "This does not use the given sides as stated. Substitute them into $\\sin B=\\frac{b\\sin A}{a}$.",
        },
        {
          label: degreeLabel(
            (Math.acos(Math.max(-1, Math.min(1, s))) * 180) / Math.PI,
          ),
          feedback:
            "This takes the inverse cosine. The value is $\\sin B$, so take the inverse sine.",
        },
        {
          label: degreeLabel(B + 10),
          feedback:
            "This is off by a computing slip. Work out $\\frac{b\\sin A}{a}$ carefully, then take its inverse sine.",
        },
      ];
      prompt = `In triangle $ABC$, $A=${A}^\\circ$, $a=${a}$ units and $b=${b}$ units. Find angle $B$ to the nearest degree.`;
      hint = `Side $b$ is across from $B$ and side $a$ is across from $A=${A}^\\circ$. Solve $\\frac{\\sin B}{b}=\\frac{\\sin A}{a}$ for $\\sin B$, then decide whether $B$ is acute.`;
      explanation = [
        LAW_OF_SINES,
        "So $\\frac{\\sin B}{b}=\\frac{\\sin A}{a}$. Multiply both sides by $b$: $\\sin B=\\frac{b\\sin A}{a}$.",
        `Substitute: $\\sin B=\\frac{${b}\\sin ${A}^\\circ}{${a}}\\approx${s.toFixed(3)}$.`,
        "Two angles between $0^\\circ$ and $180^\\circ$ have this sine: an acute one and its supplement, $180^\\circ$ minus it.",
        `Since $b<a$, angle $B$ is smaller than $A$, because a shorter side faces a smaller angle. So $B$ is the acute one: $B\\approx${Math.round(B)}^\\circ$.`,
        `Angle $B$ is about $${Math.round(B)}^\\circ$.`,
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
        return `Side $a=${a}$ is at least as long as the height, the shortest distance to the opposite side, so it does close a triangle.`;
      if (n === 1)
        return count === 0
          ? "Side $a$ is shorter than the height $b\\sin A$, the shortest distance to the opposite side, so it cannot reach it."
          : count === 2
            ? "When $b\\sin A<a<b$ with $A$ acute, side $a$ can swing to either of two positions, so two triangles fit."
            : "Compare $a$ with the height $b\\sin A$ and with $b$: those two lengths decide the count.";
      return count === 0
        ? "Two triangles need $a$ longer than the height $b\\sin A$ but shorter than $b$, with $A$ acute. Here $a$ does not reach at all."
        : "Two positions work only when $A$ is acute and $b\\sin A<a<b$. Compare $a$ with $b$: a side at least as long as $b$ lands in only one place.";
    };
    cands = [
      ...names.map((l, i) => ({ label: l, feedback: reasonFor(i) })),
      {
        label: "Not enough information",
        feedback:
          "Two sides and an angle not between them are enough to decide the count: compare $a$ with $b\\sin A$ and with $b$.",
      },
    ];
    prompt = `In triangle $ABC$, $A=${A}^\\circ$, $a=${a}$ units and $b=${b}$ units. How many different triangles have these measurements?`;
    hint = `Side $a$ must swing from $C$ to meet the third side. Compute the height $h=b\\sin A=${b}\\sin ${A}^\\circ$ and compare $a=${a}$ with $h$ and with $b=${b}$.`;
    explanation = [
      "Two sides and an angle not between them (side-side-angle) can give zero, one or two triangles. Picture side $a$ swinging from $C$ like a gate.",
      `The height is the shortest distance from $C$ to the third side: $h=b\\sin A=${b}\\sin ${A}^\\circ\\approx${h.toFixed(2)}$.`,
      A < 90
        ? "With $A$ acute: if $a<h$, side $a$ cannot reach. If $a=h$, it meets at a right angle, once. If $h<a<b$, it can land in two places. If $a\\ge b$, only one place works."
        : "With $A$ obtuse, the side across from it must be the longest side. So a triangle exists only if $a>b$, and then there is one.",
      `Here $a=${a}$${A < 90 ? `, $h\\approx${h.toFixed(2)}$` : ""} and $b=${b}$.`,
      `So there ${count === 0 ? "is no triangle" : count === 1 ? "is exactly one triangle" : "are two different triangles"} with these measurements.`,
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
const AREA_RULE =
  "The area of a triangle is half the base times the height. With two sides $a$ and $b$ and the angle $C$ between them, the height on side $a$ is $b\\sin C$.";
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
          "The factor $\\frac12$ is missing. A triangle is half of a parallelogram, so its area is $\\frac12ab\\sin C$, not $ab\\sin C$.",
      },
      {
        label: math(fracTex(a * b, 2)),
        feedback:
          "This leaves out $\\sin C$. The sides are not base and height unless $C$ is a right angle, so multiply by $\\sin C$.",
      },
      {
        label: math(radTex(a * b * m, 8, rad)),
        feedback:
          "This halves twice. Multiply $\\frac12ab$ by $\\sin C$ once; the $\\frac12$ inside $\\sin C$ is not a second halving.",
      },
      {
        label: math(
          cm === 0 ? "0" : `${cosSign}${radTex(a * b * cm, 4, crad)}`,
        ),
        feedback:
          "This uses cosine. The height comes from the sine of the angle between the sides, so use $\\sin C$.",
      },
    ];
    prompt = `Two sides of a triangle measure ${a} units and ${b} units, and the angle between them is $${C}^\\circ$. What is the exact area in square units?`;
    hint = `The angle $${C}^\\circ$ is between the sides ${a} and ${b}, the included angle. Use area $=\\frac12ab\\sin C$ and the exact value of $\\sin ${C}^\\circ$.`;
    explanation = [
      AREA_RULE,
      `So area $=\\frac12ab\\sin C$. Here $a=${a}$, $b=${b}$ and $C=${C}^\\circ$: area $=\\frac12(${a})(${b})\\sin ${C}^\\circ$.`,
      `$${C}^\\circ$ is a special angle, so its sine has an exact value: $\\sin ${C}^\\circ=${exact(sinD(C))}$.`,
      `Multiply: $\\frac12\\cdot${a * b}\\cdot${exact(sinD(C))}=${correct.replace(/^\$|\$$/g, "")}$.`,
      `The exact area is $${correct.replace(/^\$|\$$/g, "")}$ square units.`,
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
          feedback:
            "The factor $\\frac12$ is missing. A triangle is half of a parallelogram, so its area is $\\frac12ab\\sin C$.",
        },
        {
          label: math(tenth(wrongs[1]!)),
          feedback:
            "This leaves out $\\sin C$. The two sides are not base and height unless the angle is $90^\\circ$.",
        },
        {
          label: math(tenth(wrongs[2]!)),
          feedback:
            "This uses cosine. The height comes from the sine of the included angle, so use $\\sin C$.",
        },
        {
          label: math(tenth(Math.abs(wrongs[3]!))),
          feedback:
            "The calculator was in radian mode. The angle is in degrees, so set the calculator to degrees.",
        },
      ];
      if (new Set([correct, ...cands.map((c) => c.label)]).size < 4) continue;
      prompt = `A triangle has sides ${a} units and ${b} units with an included angle of $${C}^\\circ$. Find its area to the nearest tenth of a square unit.`;
      hint = `Use area $=\\frac12ab\\sin C$ with $a=${a}$, $b=${b}$ and $C=${C}^\\circ$, the angle between the two sides. Use degree mode.`;
      explanation = [
        AREA_RULE,
        `So area $=\\frac12ab\\sin C=\\frac12(${a})(${b})\\sin ${C}^\\circ$.`,
        `With the calculator in degree mode, $\\sin ${C}^\\circ\\approx${sinD(C).toFixed(4)}$.`,
        `Multiply: $\\frac12\\cdot${a * b}\\cdot${sinD(C).toFixed(4)}\\approx${tenth(val)}$.`,
        `The area is about ${tenth(val)} square units.`,
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
          "This forgets the $\\frac12$. Multiply the area by 2 to clear it before dividing by $b\\sin C$.",
      },
      {
        label: math(`${a * b}`),
        feedback:
          "This does not divide by $\\sin C$. Undo every factor: $a=\\frac{2\\cdot\\text{area}}{b\\sin C}$.",
      },
      {
        label: lenLabel(a * m, 2, rad),
        feedback:
          "This multiplies by $\\sin C$ instead of dividing. To undo a multiplication, divide.",
      },
      {
        label: math(`${2 * a}`),
        feedback:
          "This doubles once too often. The 2 appears only once, to clear the $\\frac12$.",
      },
    ];
    prompt = `A triangle has area $${areaTexLabel}$ square units. Two sides are $a$ and $b=${b}$ units, and the angle between them is $C=${C}^\\circ$. Find $a$.`;
    hint = `Start from area $=\\frac12ab\\sin C$ with $b=${b}$ and $C=${C}^\\circ$, and solve for $a$: multiply by 2, then divide by $b\\sin C$.`;
    explanation = [
      AREA_RULE,
      `So area $=\\frac12ab\\sin C$. Put in what we know: $${areaTexLabel}=\\frac12\\cdot a\\cdot${b}\\cdot\\sin ${C}^\\circ$.`,
      `$${C}^\\circ$ is a special angle: $\\sin ${C}^\\circ=${exact(sinD(C))}$.`,
      `Multiply the known numbers on the right: $${areaTexLabel}=${radTex(b * m, 4, rad)}\\,a$.`,
      `Divide both sides by $${radTex(b * m, 4, rad)}$ to get $a$ alone: $a=${a}$.`,
      `Side $a$ is ${a} units long.`,
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
          ? "Supplementary angles, which add to $180^\\circ$, have equal sines. So the areas are equal; an obtuse angle does not make the triangle larger."
          : "The two sides are the same, so only the sines of the angles can differ. Compare them."
        : rel === 1
          ? i === 0
            ? "The sines of the two included angles differ, so the areas differ."
            : "This picks the smaller sine. With equal sides, the larger sine gives the taller triangle and the larger area."
          : i === 0
            ? "The sines of the two included angles differ, so the areas differ."
            : "This picks the smaller sine. With equal sides, the larger sine gives the taller triangle and the larger area.";
    cands = [
      ...names.map((l, i) => ({ label: l, feedback: why(i) })),
      {
        label: "They cannot be compared without the third side",
        feedback:
          "The third side is not needed. Two sides and the angle between them give the area through $\\frac12ab\\sin C$.",
      },
    ];
    prompt = `Triangle 1 has sides ${a} and ${b} units with included angle $${C1}^\\circ$. Triangle 2 has the same two side lengths with included angle $${C2}^\\circ$. How do their areas compare?`;
    hint = `Both areas equal $\\frac12(${a})(${b})\\sin C$, where $C$ is the angle between the sides. So compare $\\sin ${C1}^\\circ$ with $\\sin ${C2}^\\circ$; think of the heights above the base.`;
    explanation = [
      AREA_RULE,
      `So area 1 $=\\frac12(${a})(${b})\\sin ${C1}^\\circ$ and area 2 $=\\frac12(${a})(${b})\\sin ${C2}^\\circ$. Only the sines differ.`,
      `$\\sin ${C1}^\\circ=${exact(s1)}$ and $\\sin ${C2}^\\circ=${exact(s2)}$.`,
      rel === 0
        ? "The sines are equal: an angle and its supplement give the same height above the base."
        : `The ${rel === 1 ? "first" : "second"} sine is larger, so that triangle is taller and covers more area.`,
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
          "This uses the highest value as the amplitude. The amplitude is half the distance from lowest to highest.",
      },
      {
        label: math(model(lead0, piTex(1, P), k, form)),
        feedback:
          "This $B$ makes one cycle take twice the period. One cycle takes the period $P$, so $B=2\\pi\\div P$.",
      },
      {
        label: math(model(lead0, bTex, A, form)),
        feedback:
          "This adds the amplitude where the midline belongs. The midline is halfway between the maximum and minimum.",
      },
      {
        label: math(model(lead0, bTex, min, form)),
        feedback:
          "This adds the minimum where the midline belongs. The midline is the average of the maximum and minimum.",
      },
      {
        label: math(model(-lead0, bTex, k, form)),
        feedback:
          variant === 1
            ? "This starts at the top. The ride starts at its lowest point, so the cosine must be flipped with a minus sign."
            : "This starts at the bottom. Plain cosine starts at its maximum, which matches the start here.",
      },
      {
        label: math(model(lead0, bTex, k, opposite as "sin" | "cos")),
        feedback:
          variant === 2
            ? "This starts at a maximum. Sine starts at the midline going up, which matches the start here; cosine starts at a maximum."
            : "This starts on the midline. Sine starts at the midline at $t=0$; cosine starts at a maximum.",
      },
      {
        label: math(model(lead0, piTex(4, P), k, form)),
        feedback:
          "This $B$ makes the cycle half as long as the given period. Use $B=2\\pi\\div P$.",
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
    const unitWord =
      variant === 0 ? (context ? "feet" : "cm") : variant === 1 ? "meters" : "cm";
    explanation = [
      "A sinusoidal model is a wave: $h(t)=A\\cos(Bt)+k$ or $A\\sin(Bt)+k$. Here $k$ is the midline, $A$ the amplitude, and $B$ sets the period.",
      `The midline is the center height, halfway between the highest and lowest: $k=\\frac{${max}+${min}}{2}=${k}$.`,
      `The amplitude is how far the wave reaches from the midline, half the full swing: $A=\\frac{${max}-${min}}{2}=${A}$.`,
      `One cycle takes ${P} units of time, the period. The wave repeats when $Bt$ grows by $2\\pi$, so $B=\\frac{2\\pi}{${P}}=${bTex}$.`,
      variant === 0
        ? "At $t=0$ the height is at its maximum. Cosine starts at its maximum, so use $+A\\cos$."
        : variant === 1
          ? "At $t=0$ the height is at its minimum. Cosine starts at its maximum, so flip it with a minus sign: $-A\\cos$."
          : "At $t=0$ the height is on the midline and rising. Sine starts that way, so use $+A\\sin$.",
      `The model for the height in ${unitWord} is ${correct}.`,
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
            "That is the maximum, a height, not a distance from the midline. The amplitude is half the distance from minimum to maximum.",
        },
        {
          label: math(`${2 * A}`),
          feedback:
            "That is the full swing from minimum to maximum. The amplitude is measured from the midline, so it is half of that.",
        },
        {
          label: math(`${k}`),
          feedback:
            "That is the midline value, halfway between the extremes. The amplitude is the distance from it to an extreme.",
        },
        {
          label: math(`${min}`),
          feedback:
            "That is the minimum, a height, not a distance. The amplitude is half the distance from minimum to maximum.",
        },
      ];
      prompt = `A periodic quantity has a maximum of ${max} and a minimum of ${min}. What is the amplitude of a sinusoidal model of it?`;
      hint = `Amplitude is the distance from the midline, the center line, to an extreme. Find the distance between ${max} and ${min} first, then take the part of it that reaches from the midline.`;
      explanation = [
        "The amplitude is how far a wave reaches from its midline, the center line halfway between the highest and lowest values.",
        `The full swing from minimum to maximum is $${max}-${min}=${2 * A}$.`,
        "The midline sits in the middle, so it splits that swing into two equal halves.",
        `So the amplitude is $${2 * A}\\div2=${A}$.`,
      ];
    } else if (which === "midline") {
      correct = math(`y=${k}`);
      cands = [
        {
          label: math(`y=${A}`),
          feedback:
            "That is the amplitude, a distance, not a height. The midline is halfway between the minimum and maximum.",
        },
        {
          label: math(`y=${max}`),
          feedback:
            "That is the maximum, the top of the wave. The midline is halfway between the top and bottom.",
        },
        {
          label: math(`y=${min}`),
          feedback:
            "That is the minimum, the bottom of the wave. The midline is halfway between the top and bottom.",
        },
        {
          label: math(`y=${2 * A}`),
          feedback:
            "That is the distance from minimum to maximum. The midline is their average: add them and divide by 2.",
        },
        {
          label: math(`y=${k + 1}`),
          feedback:
            "This is off by one. Add the maximum and minimum, then divide by 2.",
        },
      ];
      prompt = `A periodic quantity has a maximum of ${max} and a minimum of ${min}. What is the equation of the midline of a sinusoidal model of it?`;
      hint = `The midline is halfway between the extreme values ${max} and ${min}. Add them and divide by 2.`;
      explanation = [
        "The midline is the horizontal center line of a wave, halfway between its highest and lowest values.",
        `Halfway between two numbers is their average: add them and divide by 2. $\\frac{${max}+${min}}{2}=${k}$.`,
        `The midline is $y=${k}$.`,
      ];
    } else {
      correct = math(bTex);
      cands = [
        {
          label: math(`${P}`),
          feedback:
            "That is the period itself, the length of one cycle. $B$ is $2\\pi$ divided by the period.",
        },
        {
          label: math(piTex(1, P)),
          feedback:
            "This uses $\\pi$, half a cycle, so the period would be twice as long. Use $B=2\\pi\\div P$.",
        },
        {
          label: math(piTex(P, 2)),
          feedback:
            "This multiplies by the period. A longer period means a smaller $B$, so divide $2\\pi$ by the period.",
        },
        {
          label: math(piTex(4, P)),
          feedback:
            "This uses $4\\pi$, two cycles, so the period would be half as long. Use $B=2\\pi\\div P$.",
        },
      ];
      prompt = `A sinusoidal model $y=A\\sin(Bt)+k$ has period ${P} (in the same units as $t$). What is $B$?`;
      hint = `The sine function repeats when its input $Bt$ grows by $2\\pi$. One period is ${P}, so set $B\\cdot ${P}=2\\pi$ and solve for $B$.`;
      explanation = [
        "The period is the time for one full cycle of the wave. Sine finishes one cycle when its input grows by $2\\pi$.",
        `Here the input is $Bt$. Over one period, $t$ grows by ${P}, so $Bt$ grows by $B\\cdot${P}$.`,
        `That must equal one cycle: $B\\cdot${P}=2\\pi$.`,
        `Divide both sides by ${P}: $B=\\frac{2\\pi}{${P}}=${bTex}$.`,
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
      "The cosine term has the wrong sign. Find the sign of the cosine at this angle, and keep any minus sign in front.",
      "This leaves off the midline. Add $k$ after computing the cosine term.",
      "That is the maximum height. Evaluate the cosine at $Bt$ instead of assuming the top.",
      "That is the midline, reached only a quarter of a period from the start.",
      "That is the minimum, reached only half a period from the start.",
      "This uses a cosine of $\\pm\\frac12$, which is wrong at this angle. Find the cosine of $Bt$ exactly.",
      "This uses a cosine of $\\pm\\frac12$, which is wrong at this angle. Find the cosine of $Bt$ exactly.",
    ];
    cands = wrongs.map((v, i) => ({ label: math(`${v}`), feedback: whys[i]! }));
    const eq = `h(t)=${form === 1 ? "" : "-"}${AA}\\cos\\left(${bTex}t\\right)+${kk}`;
    prompt = context
      ? `The height in feet of a tide is modeled by $${eq}$, where $t$ is in hours. What is $h(${timing.frac})$?`
      : `The height in meters of a rider on a wheel is modeled by $${eq}$, where $t$ is in minutes. What is $h(${timing.frac})$?`;
    hint = `Evaluate the angle $${bTex}\\cdot${timing.frac}$ first. Then find the cosine of that angle and finish $${form === 1 ? "" : "-"}${AA}\\cos(\\cdot)+${kk}$.`;
    const angle = piTex(2 * timing.frac, P);
    const cosTex =
      timing.cos === 0
        ? "0"
        : timing.cos === 0.5
          ? "\\frac12"
          : timing.cos === -0.5
            ? "-\\frac12"
            : "-1";
    explanation = [
      `$h(${timing.frac})$, read "$h$ of ${timing.frac}", is the height when $t=${timing.frac}$. Substitute ${timing.frac} for $t$.`,
      `Start inside the cosine: $${bTex}\\cdot${timing.frac}=${angle}$.`,
      `This angle is a special angle on the unit circle: $\\cos\\left(${angle}\\right)=${cosTex}$.`,
      `Multiply by ${form === 1 ? AA : `$-${AA}$`}, then add the midline ${kk}: $${form === 1 ? "" : "-"}${AA}\\left(${cosTex}\\right)+${kk}=${val}$.`,
      `So $h(${timing.frac})=${val}$: the height is ${val} ${context ? "feet" : "meters"} at that time.`,
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
