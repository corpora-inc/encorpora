import type { TemplateMetadata } from "./contracts";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  type ChoiceOption,
} from "./chain-kit";
import {
  serializeMultiPart,
  type MultiPartChoiceResponse,
  type PartOption,
} from "./multi-part-choice";
import { selectFamily, selectModel, selectTemplate, st } from "./select-kit";
import { defineAxis, type Random } from "./variation/axes";
import {
  cosTwelfths,
  pick,
  shuffled,
  sinTwelfths,
  twelfthsPlain,
  twelfthsTex,
  unitCircleScene,
  type CircleArc,
  type CirclePoint,
} from "./unit-circle-extension-kit";

/**
 * HSF.TF.A.4: use the unit circle to explain symmetry (odd and even) and
 * periodicity. The angle θ has the point P = (a, b) = (cos θ, sin θ); −θ,
 * π − θ and π + θ have its reflections across the x-axis and the y-axis and
 * its half turn about the origin, and θ + 2πk has P itself. Every correct
 * option names a point and its coordinates; θ is never a special angle, so
 * no item can be answered by evaluating.
 */

/** A TeX value in prose: a bare unsigned number stays text (a lone "$0.6$"
 * reads as money), anything else is set as math. */
const mx = (tex: string) => (/^\d+(\.\d+)?$/.test(tex) ? tex : `$${tex}$`);
const scenes = { requiredFigureCapability: "scenes-v1" as const };
const base = {
  version: 1,
  skillId: "trigonometric-symmetry",
  gradeBand: "9–12" as const,
};
export const trigSymmetryReasoningTemplates: readonly TemplateMetadata[] = [
  {
    ...base,
    id: "unit-circle-symmetry-derivation",
    title: "Derive a symmetry from the unit circle",
    difficultyOffset: 0.4,
    requiredResponseCapability: "multi-part-choice-v1",
    ...scenes,
    description:
      "From the point $P = (a, b)$ for an angle $\\theta$, name how the point for $-\\theta$, $\\pi + \\theta$ or $\\pi - \\theta$ is placed, give its coordinates, and conclude that cosine is even, sine and tangent are odd, a half turn keeps tangent, or that $\\sin(\\pi - \\theta) = \\sin\\theta$ does not make sine even. Symbolic and numeric coordinates; all three parts must be right.",
  },
  {
    ...base,
    id: "trig-periodicity-explanation",
    title: "Explain periodicity with the unit circle",
    difficultyOffset: 0.45,
    requiredResponseCapability: "single-choice-v1",
    ...scenes,
    description:
      "Choose the unit-circle explanation of why sine and cosine repeat after whole turns and tangent after half a turn, find the flawed step in a faulty periodicity argument, or choose the angle that is a counterexample to a claimed period.",
  },
  selectTemplate({
    ...base,
    figure: "scenes-v1",
    id: "unit-circle-claim-check",
    title: "Which claims the unit circle justifies",
    difficultyOffset: 0.45,
    description:
      "From the points for $\\theta$, $-\\theta$, $\\pi - \\theta$ and $\\pi + \\theta$ with their coordinates, select every true and correctly justified claim about even and odd functions and periods, among claims that use the wrong reflection, a half turn as a period, or a reason that does not follow.",
  }),
];
const meta = (id: string) =>
  trigSymmetryReasoningTemplates.find((t) => t.id === id)!;

/* ------------------------------------------------------- the point P */

/** General-tier angles: 0.35, 0.40, …, 1.20 radians (never special). */
const FIRST = Array.from({ length: 18 }, (_, i) => (35 + 5 * i) / 100);
/** Concrete-tier points of the first quadrant (Pythagorean triples). */
const TRIPLES: readonly [number, number][] = [
  [0.6, 0.8],
  [0.8, 0.6],
  [0.28, 0.96],
  [0.96, 0.28],
];
export interface PointP {
  tier: "concrete" | "general";
  theta: number;
  /** cos θ and sin θ. */
  a: number;
  b: number;
  /** TeX of the first and second coordinate of P. */
  aT: string;
  bT: string;
}
/** The opposite of a TeX term: "a" → "-a", "-0.6" → "0.6". */
export const neg = (tex: string) =>
  tex.startsWith("-") ? tex.slice(1) : `-${tex}`;
const numTex = (v: number) => String(Math.round(v * 100) / 100);
export function drawPoint(r: Random, tier: "concrete" | "general"): PointP {
  const second = r(0, 1) === 1;
  if (tier === "general") {
    const v = pick(r, FIRST);
    const theta = second ? Math.PI - v : v;
    return {
      tier,
      theta,
      a: Math.cos(theta),
      b: Math.sin(theta),
      aT: "a",
      bT: "b",
    };
  }
  const [x, y] = pick(r, TRIPLES);
  const a = second ? -x : x;
  return {
    tier,
    theta: Math.atan2(y, a),
    a,
    b: y,
    aT: numTex(a),
    bT: numTex(y),
  };
}
const pt = (x: string, y: string) => `(${x}, ${y})`;
const plainPt = (x: string, y: string) =>
  `(${x.replace("-", "−")}, ${y.replace("-", "−")})`;
const definesP = (p: PointP) =>
  p.tier === "general"
    ? "so $a = \\cos\\theta$ and $b = \\sin\\theta$"
    : `so $\\cos\\theta = ${p.aT}$ and $\\sin\\theta = ${p.bT}$`;
const pointP = (p: PointP): CirclePoint => ({
  id: "P",
  angle: p.theta,
  label: `P${plainPt(p.aT, p.bT)}`,
});
const thetaArc = (theta: number): CircleArc => ({
  id: "theta",
  to: theta,
  r: 0.26,
  label: "θ",
});

/* --------------------------------- unit-circle-symmetry-derivation */

type Rel = "x" | "y" | "o" | "d";
type DerivationFamily =
  "neg-theta" | "neg-theta-tan" | "pi-plus-theta" | "pi-minus-theta";
const derivationAxis = defineAxis("family", [
  "neg-theta",
  "neg-theta-tan",
  "pi-plus-theta",
  "pi-minus-theta",
]);
const tierAxis = defineAxis("tier", ["concrete", "general"]);
const relOf: Record<DerivationFamily, Rel> = {
  "neg-theta": "x",
  "neg-theta-tan": "x",
  "pi-plus-theta": "o",
  "pi-minus-theta": "y",
};
export const targetOf: Record<
  DerivationFamily,
  { tex: string; plain: string; angle: (t: number) => number }
> = {
  "neg-theta": { tex: "-\\theta", plain: "−θ", angle: (t) => -t },
  "neg-theta-tan": { tex: "-\\theta", plain: "−θ", angle: (t) => -t },
  "pi-plus-theta": {
    tex: "\\pi + \\theta",
    plain: "π + θ",
    angle: (t) => Math.PI + t,
  },
  "pi-minus-theta": {
    tex: "\\pi - \\theta",
    plain: "π − θ",
    angle: (t) => Math.PI - t,
  },
};
const relLabel: Record<Rel, string> = {
  x: "the reflection of $P$ across the $x$-axis",
  y: "the reflection of $P$ across the $y$-axis",
  o: "the half turn of $P$ about the origin",
  d: "the reflection of $P$ across the line $y = x$",
};
/** Coordinates of P's image under each motion. */
export const imageOf = (rel: Rel, p: PointP): [string, string] =>
  ({
    x: [p.aT, neg(p.bT)] as [string, string],
    y: [neg(p.aT), p.bT] as [string, string],
    o: [neg(p.aT), neg(p.bT)] as [string, string],
    d: [p.bT, p.aT] as [string, string],
  })[rel];
/** Numeric coordinates of P's image under each motion. */
export const imageValue = (rel: Rel, p: PointP): [number, number] =>
  ({
    x: [p.a, -p.b] as [number, number],
    y: [-p.a, p.b] as [number, number],
    o: [-p.a, -p.b] as [number, number],
    d: [p.b, p.a] as [number, number],
  })[rel];
const relWhy: Record<Rel, Record<DerivationFamily, string>> = {
  x: {
    "neg-theta": "",
    "neg-theta-tan": "",
    "pi-plus-theta":
      "the $x$-axis reflection changes only the sign of $y$, but a half turn changes both signs",
    "pi-minus-theta":
      "the $x$-axis reflection is the point for $-\\theta$, not $\\pi - \\theta$",
  },
  y: {
    "neg-theta":
      "the $y$-axis reflection is the point for $\\pi - \\theta$, not $-\\theta$",
    "neg-theta-tan":
      "the $y$-axis reflection is the point for $\\pi - \\theta$, not $-\\theta$",
    "pi-plus-theta":
      "the $y$-axis reflection is the point for $\\pi - \\theta$, not $\\pi + \\theta$",
    "pi-minus-theta": "",
  },
  o: {
    "neg-theta":
      "the half turn is the point for $\\pi + \\theta$; a negative angle is not the opposite point",
    "neg-theta-tan":
      "the half turn is the point for $\\pi + \\theta$; a negative angle is not the opposite point",
    "pi-plus-theta": "",
    "pi-minus-theta":
      "the half turn is the point for $\\pi + \\theta$, not $\\pi - \\theta$",
  },
  d: {
    "neg-theta":
      "the line $y = x$ swaps the coordinates, which gives the point for $\\frac{\\pi}{2} - \\theta$",
    "neg-theta-tan":
      "the line $y = x$ swaps the coordinates, which gives the point for $\\frac{\\pi}{2} - \\theta$",
    "pi-plus-theta":
      "the line $y = x$ swaps the coordinates, which gives the point for $\\frac{\\pi}{2} - \\theta$",
    "pi-minus-theta":
      "the line $y = x$ swaps the coordinates, which gives the point for $\\frac{\\pi}{2} - \\theta$",
  },
};
type Concl = { label: string; correct?: true; why: string };
function conclusions(f: DerivationFamily, p: PointP): Concl[] {
  const { aT: a, bT: b } = p;
  if (f === "neg-theta")
    return [
      {
        label:
          "$\\cos(-\\theta)=\\cos\\theta$, $\\sin(-\\theta)=-\\sin\\theta$: cosine even, sine odd",
        correct: true,
        why: "",
      },
      {
        label:
          "$\\cos(-\\theta)=-\\cos\\theta$, $\\sin(-\\theta)=\\sin\\theta$: cosine odd, sine even",
        why: "It swaps the roles: the reflection keeps $x$, the cosine, and changes the sign of $y$, the sine",
      },
      {
        label:
          "$\\cos(-\\theta)=\\cos\\theta$, $\\sin(-\\theta)=\\sin\\theta$: both are even",
        why: `It ignores the sign change of the $y$-coordinate: $Q$ has $y$-coordinate ${mx(neg(b))}`,
      },
      {
        label:
          "$\\cos(-\\theta)=-\\cos\\theta$, $\\sin(-\\theta)=-\\sin\\theta$: both are odd",
        why: `It changes both signs, but the reflection keeps the $x$-coordinate ${mx(a)}`,
      },
    ];
  if (f === "neg-theta-tan")
    return [
      {
        label: `$\\tan(-\\theta)=\\frac{${neg(b)}}{${a}}=-\\tan\\theta$: tangent is odd`,
        correct: true,
        why: "",
      },
      {
        label: `$\\tan(-\\theta)=\\frac{${b}}{${a}}=\\tan\\theta$: tangent is even`,
        why: "It assumes the ratio keeps its sign, but only the $y$-coordinate changes sign",
      },
      {
        label: `$\\tan(-\\theta)=\\frac{${a}}{${neg(b)}}$: tangent is odd`,
        why: "It turns the ratio upside down: tangent is $y$ divided by $x$",
      },
      {
        label:
          "$\\tan(-\\theta)=\\tan\\theta$, since $\\tan(\\pi+\\theta)=\\tan\\theta$",
        why: "It uses a half turn, which is about a period, to answer a question about $-\\theta$",
      },
    ];
  if (f === "pi-plus-theta")
    return [
      {
        label: `$\\tan(\\pi+\\theta)=\\frac{${neg(b)}}{${neg(a)}}=\\tan\\theta$: tangent stays the same`,
        correct: true,
        why: "",
      },
      {
        label: `$\\tan(\\pi+\\theta)=\\frac{${neg(b)}}{${a}}=-\\tan\\theta$: only one sign flips`,
        why: "It keeps the $x$-coordinate, but a half turn changes the sign of both coordinates",
      },
      {
        label:
          "$\\sin(\\pi+\\theta)=\\sin\\theta$: a half turn is a period of sine",
        why: `It misses the sign change: $Q$ has $y$-coordinate ${mx(neg(b))}, so $\\sin(\\pi+\\theta)=-\\sin\\theta$`,
      },
      {
        label:
          "$\\cos(\\pi+\\theta)=\\cos\\theta$: a half turn is a period of cosine",
        why: `It misses the sign change: $Q$ has $x$-coordinate ${mx(neg(a))}, so $\\cos(\\pi+\\theta)=-\\cos\\theta$`,
      },
    ];
  return [
    {
      label:
        "No: even means $\\sin(-\\theta)=\\sin\\theta$, but $\\sin(-\\theta)=-\\sin\\theta$",
      correct: true,
      why: "",
    },
    {
      label:
        "Yes: $\\sin(\\pi-\\theta)=\\sin\\theta$ gives equal values, so sine is even",
      why: "Equal values at $\\theta$ and $\\pi - \\theta$ are a symmetry about the $y$-axis; even compares $\\theta$ with $-\\theta$",
    },
    {
      label: "Yes: $P$ and $Q$ have the same $y$-coordinate, so sine is even",
      why: "That is the same symmetry about the $y$-axis; even needs the point for $-\\theta$",
    },
    {
      label:
        "No: here $\\sin(\\pi-\\theta)=-\\sin\\theta$, so sine is odd instead",
      why: `It states a false equation: $P$ and $Q$ share the $y$-coordinate ${mx(b)}, so $\\sin(\\pi-\\theta)=\\sin\\theta$`,
    },
  ];
}
function partOptions<T extends { label: string; correct?: true }>(
  r: Random,
  items: T[],
) {
  const order = shuffled(r, items);
  const options: PartOption[] = order.map((o, i) => ({
    id: "abcdef"[i]!,
    label: o.label,
  }));
  return { options, key: options[order.findIndex((o) => o.correct)]!.id };
}
interface DerivationModel {
  family: DerivationFamily;
  p: PointP;
}
export const derivationFamily = chainFamily({
  template: meta("unit-circle-symmetry-derivation"),
  axes: { family: derivationAxis, tier: tierAxis },
  model: (r, axes): DerivationModel => ({
    family: axes.family,
    p: drawPoint(r, axes.tier),
  }),
  variant: (m) => `${m.family}-${m.p.tier}`,
  render: (m, _axes, r) => {
    const { family: f, p } = m;
    const key = relOf[f];
    const target = targetOf[f];
    const rels: Rel[] = ["x", "y", "o", "d"];
    const relOpts = partOptions(
      r,
      rels.map((x) => ({
        label: relLabel[x],
        ...(x === key ? { correct: true as const } : {}),
      })),
    );
    const coordOpts = partOptions(
      r,
      rels.map((x) => ({
        label: `$${pt(...imageOf(x, p))}$`,
        ...(x === key ? { correct: true as const } : {}),
      })),
    );
    const concl = conclusions(f, p);
    const conclOpts = partOptions(r, concl);
    const contrast = f === "pi-minus-theta";
    const response: MultiPartChoiceResponse = {
      kind: "multi-part-choice",
      label: "Choose an option for each part",
      layout: "slots",
      blanks: [
        { id: "motion", label: "How $Q$ is placed", options: relOpts.options },
        {
          id: "coords",
          label: "Coordinates of $Q$",
          options: coordOpts.options,
        },
        {
          id: "result",
          label: contrast
            ? "Does this show that sine is even?"
            : "What this shows",
          options: conclOpts.options,
        },
      ],
    };
    const [qx, qy] = imageOf(key, p);
    const P = pt(p.aT, p.bT);
    const Q = pt(qx, qy);
    const evenOdd =
      "A function $f$ is called even when $f(-\\theta) = f(\\theta)$ for every $\\theta$, and odd when $f(-\\theta) = -f(\\theta)$ for every $\\theta$.";
    const steps: Record<DerivationFamily, string[]> = {
      "neg-theta": [
        "The angle $-\\theta$ has the same arc length as $\\theta$, measured clockwise. So $Q$ is the mirror image of $P$ across the $x$-axis.",
        `A reflection across the $x$-axis keeps $x$ and changes the sign of $y$: $Q = ${Q}$.`,
        `$Q$ is the point for $-\\theta$, so $Q = (\\cos(-\\theta), \\sin(-\\theta))$. So $\\cos(-\\theta) = ${qx} = \\cos\\theta$ and $\\sin(-\\theta) = ${qy} = -\\sin\\theta$.`,
        `${evenOdd} This holds for every $\\theta$, so cosine is even and sine is odd.`,
      ],
      "neg-theta-tan": [
        "The angle $-\\theta$ has the same arc length as $\\theta$, measured clockwise. So $Q$ is the mirror image of $P$ across the $x$-axis.",
        `A reflection across the $x$-axis keeps $x$ and changes the sign of $y$: $Q = ${Q}$.`,
        `Tangent is the $y$-coordinate divided by the $x$-coordinate. So $\\tan(-\\theta) = \\frac{${qy}}{${qx}} = -\\frac{${p.bT}}{${p.aT}} = -\\tan\\theta$, wherever the $x$-coordinate is not 0.`,
        `${evenOdd} This holds for every such $\\theta$, so tangent is odd.`,
      ],
      "pi-plus-theta": [
        "An arc of $\\pi$ is half the circumference, $2\\pi$. So $Q$ is the point directly opposite $P$ through the origin: a half turn.",
        `A half turn changes the sign of both coordinates: $Q = ${Q}$.`,
        `So $\\cos(\\pi+\\theta) = -\\cos\\theta$ and $\\sin(\\pi+\\theta) = -\\sin\\theta$, while $\\tan(\\pi+\\theta) = \\frac{${qy}}{${qx}} = \\frac{${p.bT}}{${p.aT}} = \\tan\\theta$, wherever the $x$-coordinate is not 0.`,
        "A half turn changes sine and cosine but keeps tangent. That is why $\\pi$ is a period of tangent and not of sine or cosine.",
      ],
      "pi-minus-theta": [
        "The angle $\\pi - \\theta$ ends as far from the negative $x$-axis as $\\theta$ ends from the positive $x$-axis. So $Q$ is the mirror image of $P$ across the $y$-axis.",
        `A reflection across the $y$-axis changes the sign of $x$ and keeps $y$: $Q = ${Q}$.`,
        `So $\\sin(\\pi - \\theta) = ${qy} = \\sin\\theta$. This is a symmetry about the $y$-axis, the line where $\\theta = \\frac{\\pi}{2}$.`,
        `${evenOdd} The point for $-\\theta$ is the reflection across the $x$-axis, $${pt(p.aT, neg(p.bT))}$, so $\\sin(-\\theta) = ${neg(p.bT)} = -\\sin\\theta$, which is not $\\sin\\theta$. Sine is odd, not even.`,
      ],
    };
    const wrongRel = rels
      .filter((x) => x !== key)
      .map((x) => `${relLabel[x]} is wrong, because ${relWhy[x][f]}.`)
      .join(" ");
    const wrongConcl = concl
      .filter((c) => !c.correct)
      .map((c) => `${c.label}: wrong. ${c.why}.`)
      .join(" ");
    return {
      prompt: `On the unit circle, $P = ${P}$ is the point for the angle $\\theta$, ${definesP(p)}. $Q$ is the point for the angle $${target.tex}$.${contrast ? " A student says the figure shows that sine is even." : ""} Complete the explanation.`,
      response,
      answer: serializeMultiPart(response, {
        motion: relOpts.key,
        coords: coordOpts.key,
        result: conclOpts.key,
      }),
      hint: `Which line or point would you fold the circle along to land $P = ${P}$ on $Q$, the point for $${target.tex}$? Then ask what that fold does to each coordinate.`,
      explanation: [
        ...steps[f],
        `Wrong choices for how $Q$ is placed: ${wrongRel}`,
        `Each wrong pair of coordinates belongs to one of those wrong motions; $${pt(p.bT, p.aT)}$ swaps the coordinates.`,
        `Wrong conclusions: ${wrongConcl}`,
      ],
      figure: {
        kind: "scene" as const,
        scene: unitCircleScene({
          points: [
            pointP(p),
            { id: "Q", angle: target.angle(p.theta), label: "Q" },
          ],
          arcs: [
            thetaArc(p.theta),
            {
              id: "target",
              to: target.angle(p.theta),
              r: 0.44,
              label: target.plain,
              dash: f === "neg-theta" || f === "neg-theta-tan",
              color: "accent",
            },
          ],
          startLabel: false,
          title: `Unit circle. P${plainPt(p.aT, p.bT)} is the point for the angle θ. Q is the point for the angle ${target.plain}; its coordinates are not shown.`,
        }),
      },
    };
  },
});

/* ------------------------------------- trig-periodicity-explanation */

const periodAxis = defineAxis("family", [
  "full-turn",
  "tan-half-turn",
  "find-the-flaw",
  "counterexample",
]);
type Argument = "cos-half-turn" | "sine-additive" | "tan-two-pi" | "diameter";
const ARGUMENTS: readonly Argument[] = [
  "cos-half-turn",
  "sine-additive",
  "tan-two-pi",
  "diameter",
];
type Pair = { fn: "sin" | "cos"; c: 6 | 12 };
const PAIRS: readonly Pair[] = [
  { fn: "cos", c: 12 },
  { fn: "sin", c: 12 },
  { fn: "sin", c: 6 },
  { fn: "cos", c: 6 },
];
/** Angles, in twelfths of π, where f(θ + c) = f(θ) happens to hold. */
export const COINCIDENCES: Record<string, readonly number[]> = {
  "cos-12": [6, 18, -6],
  "sin-12": [0, 12, 24],
  "sin-6": [3, 15, -9],
  "cos-6": [-3, 9, 21],
};
/** Candidate counterexamples: multiples of π/6 or π/4 in [0, 2π). */
const SPECIAL = Array.from({ length: 24 }, (_, k) => k).filter(
  (k) => k % 2 === 0 || k % 3 === 0,
);
const valueAt = (fn: "sin" | "cos", k: number) =>
  fn === "sin" ? sinTwelfths(k) : cosTwelfths(k);
interface PeriodModel {
  family: (typeof periodAxis.values)[number];
  fn: "sin" | "cos";
  k: number;
  argument: Argument;
  pair: Pair;
  theta: number;
  pick: number;
}
const KS = [1, 2, 3, -1, -2] as const;
const fnWord = { sin: "sine", cos: "cosine" } as const;
const genericP = (theta: number): CirclePoint => ({
  id: "P",
  angle: theta,
  label: "P(a, b)",
});
const setup =
  "On the unit circle, $P = (a, b)$ is the point for the angle $\\theta$, so $a = \\cos\\theta$ and $b = \\sin\\theta$.";

function fullTurn(m: PeriodModel, r: Random) {
  const k = m.k;
  const fn = m.fn;
  // The added angle; an arc is a length, so a negative angle is an arc of
  // the same length travelled clockwise.
  const arc = `${2 * k}\\pi`;
  const length = `${2 * Math.abs(k)}\\pi`;
  const shift = k > 0 ? `\\theta + ${2 * k}\\pi` : `\\theta - ${-2 * k}\\pi`;
  const turnWords = ["", "one", "two", "three"][Math.abs(k)]!;
  const way = k < 0 ? " clockwise" : "";
  const anArc = k < 0 ? "a clockwise arc" : "an arc";
  const identity = `\\${fn}(${shift}) = \\${fn}\\theta`;
  return choiceSurface(r, {
    prompt: `${setup} Which explanation uses the unit circle to justify $${identity}$ for every real number $\\theta$?`,
    options: [
      {
        label: `${anArc[0]!.toUpperCase()}${anArc.slice(1)} of $${length}$ is ${turnWords} full turn${Math.abs(k) === 1 ? "" : "s"}, since the circumference is $2\\pi$; it ends back at $P$.`,
        correct: true,
      },
      {
        label: `$\\${fn}(${shift})$ splits as $\\${fn}\\theta + \\${fn}(${arc})$, so the two values must match.`,
        feedback: `${fnWord[fn][0]!.toUpperCase()}${fnWord[fn].slice(1)} does not split over a sum: $\\${fn}(x + y)$ is not $\\${fn} x + \\${fn} y$. The reason is the point: ${anArc} of $${length}$ returns to $P$.`,
      },
      {
        label: `The graph of ${fnWord[fn]} repeats every $2\\pi$, so its value at $${shift}$ repeats too.`,
        feedback:
          "This assumes the repeat it should explain, and it does not use the unit circle. The point after the arc is what shows it.",
      },
      {
        label:
          "An arc of length $\\pi$ already returns $P$ to its start, since the unit circle's diameter is 2.",
        feedback:
          "The circumference of a circle of diameter 2 is $2\\pi$, not $\\pi$. An arc of $\\pi$ reaches the opposite point $(-a, -b)$.",
      },
    ],
    hint: `Where does the point for $\\theta$ end up after an arc of $${length}$ travelled${way || " counterclockwise"}? Compare its coordinates with $P = (a, b)$.`,
    explanation: [
      "The unit circle has radius 1, so its circumference is $2\\pi \\times 1 = 2\\pi$.",
      `Adding $${arc}$ to the angle means travelling an arc of $${length}$${way || " counterclockwise"}: ${Math.abs(k) === 1 ? "one full turn" : `${Math.abs(k)} full turns`}. It starts at $P = (a, b)$ and ends at $P$ again.`,
      `The point for $${shift}$ is therefore $(a, b)$, so $\\cos(${shift}) = a = \\cos\\theta$ and $\\sin(${shift}) = b = \\sin\\theta$ for every $\\theta$.`,
      "Wrong choices: sine and cosine do not split over a sum; a graph that repeats is what is being explained, not a reason; and an arc of $\\pi$ is only half a turn, reaching $(-a, -b)$.",
    ],
  });
}
function halfTurn(r: Random) {
  return choiceSurface(r, {
    prompt: `${setup} Which explanation uses the unit circle to justify $\\tan(\\theta + \\pi) = \\tan\\theta$ for every $\\theta$ where tangent is defined?`,
    options: [
      {
        label:
          "An arc of $\\pi$ is half the circumference, so $\\theta + \\pi$ gives $(-a, -b)$, and $\\frac{-b}{-a} = \\frac{b}{a}$.",
        correct: true,
      },
      {
        label:
          "The point for $\\theta + \\pi$ is $(a, -b)$, and the sign of the ratio does not change.",
        feedback:
          "$(a, -b)$ is the point for $-\\theta$, and its ratio $\\frac{-b}{a}$ has the opposite sign. Half a turn reaches $(-a, -b)$.",
      },
      {
        label:
          "$\\tan\\pi = 0$, so $\\tan(\\theta + \\pi) = \\tan\\theta + \\tan\\pi = \\tan\\theta + 0 = \\tan\\theta$.",
        feedback:
          "Tangent does not split over a sum. The reason is the point $(-a, -b)$ reached by half a turn.",
      },
      {
        label:
          "Sine and cosine repeat every $2\\pi$, so their ratio repeats every $2\\pi$, and $\\pi$ is half of that.",
        feedback:
          "Repeating every $2\\pi$ does not make $\\pi$ a period; sine itself repeats every $2\\pi$ but not every $\\pi$. The half-turn point shows why tangent does.",
      },
    ],
    hint: "Where does an arc of $\\pi$, half of the circumference $2\\pi$, take $P = (a, b)$? Compare the new ratio of $y$ to $x$ with $\\frac{b}{a}$.",
    explanation: [
      "The circumference of the unit circle is $2\\pi$, so an arc of $\\pi$ is half of it. Moving $\\pi$ from $P$ lands on the point directly opposite, through the origin.",
      "The opposite point of $(a, b)$ is $(-a, -b)$.",
      "Tangent is $\\frac{y}{x}$, so $\\tan(\\theta + \\pi) = \\frac{-b}{-a} = \\frac{b}{a} = \\tan\\theta$ wherever $a \\ne 0$.",
      "So $\\pi$ is a period of tangent, even though sine and cosine each need $2\\pi$: both of their signs change at the half turn, and the ratio keeps its sign.",
      "Wrong choices: $(a, -b)$ is the point for $-\\theta$; tangent does not split over a sum; and repeating every $2\\pi$ does not give a repeat every $\\pi$.",
    ],
  });
}
function flaw(m: PeriodModel, r: Random) {
  const nothing = (label: string, feedback: string): ChoiceOption => ({
    label,
    feedback,
  });
  const args: Record<
    Argument,
    {
      steps: string;
      correct: string;
      wrong: ChoiceOption[];
      why: string[];
    }
  > = {
    "cos-half-turn": {
      steps:
        "Step 1: The point for $\\theta + \\pi$ is the half turn of $P$, which is $(-a, -b)$. Step 2: It has the same $x$-coordinate as $P$. Step 3: So $\\cos(\\theta + \\pi) = \\cos\\theta$, and $\\pi$ is a period of cosine.",
      correct:
        "Step 2: the half-turn point's $x$-coordinate is $-a$, not $a$, so $\\cos(\\theta + \\pi) = -\\cos\\theta$.",
      wrong: [
        {
          label:
            "Step 1: a half turn adds $2\\pi$ to the angle, not $\\pi$, so the point in Step 1 is wrong.",
          feedback:
            "Half a turn is half of $2\\pi$, which is $\\pi$. Step 1 is right.",
        },
        {
          label:
            "Step 3: equal values at $\\theta$ and $\\theta + \\pi$ for every $\\theta$ would not make $\\pi$ a period.",
          feedback:
            "They would: that is what a period means. The trouble is that the values are not equal.",
        },
        nothing(
          "Nothing is wrong: the three steps correctly show that cosine has period $\\pi$.",
          "Step 2 is false: the $x$-coordinate changes from $a$ to $-a$.",
        ),
      ],
      why: [
        "Step 1 is right: an arc of $\\pi$ is half the circumference $2\\pi$, so it reaches the opposite point $(-a, -b)$.",
        "Step 2 is the error: the $x$-coordinate of $(-a, -b)$ is $-a$, not $a$. So $\\cos(\\theta + \\pi) = -\\cos\\theta$.",
        "Step 3 rests on Step 2, so it fails too. Cosine needs a full turn, $2\\pi$, to repeat.",
      ],
    },
    "sine-additive": {
      steps:
        "Step 1: An arc of $2\\pi$ is one full turn. Step 2: So $\\sin(\\theta + 2\\pi) = \\sin\\theta + \\sin 2\\pi$. Step 3: $\\sin 2\\pi = 0$, so $\\sin(\\theta + 2\\pi) = \\sin\\theta$.",
      correct:
        "Step 2: sine does not split over a sum. The result is true because an arc of $2\\pi$ returns to $P$.",
      wrong: [
        {
          label:
            "Step 3: $\\sin 2\\pi$ is 1, not 0, so the correct sum is $\\sin\\theta + 1$ instead.",
          feedback:
            "The point for $2\\pi$ is $(1, 0)$, so $\\sin 2\\pi = 0$. Step 3's arithmetic is right; Step 2 is not.",
        },
        {
          label:
            "Step 1: an arc of $2\\pi$ is only half a turn, because the radius of the circle is 1.",
          feedback:
            "Radius 1 gives a circumference of $2\\pi$, so an arc of $2\\pi$ is a full turn. Step 1 is right.",
        },
        nothing(
          "Nothing is wrong: each step follows, and $\\sin(\\theta + 2\\pi) = \\sin\\theta$ is true.",
          "A true conclusion can rest on a false step. $\\sin(x + y)$ is not $\\sin x + \\sin y$.",
        ),
      ],
      why: [
        "Step 1 is right: the circumference is $2\\pi$.",
        "Step 2 is the error: sine does not split over a sum. For example, $\\sin\\left(\\frac{\\pi}{2} + \\frac{\\pi}{2}\\right) = \\sin\\pi = 0$, but $\\sin\\frac{\\pi}{2} + \\sin\\frac{\\pi}{2} = 2$.",
        "The conclusion is still true, for a different reason: an arc of $2\\pi$ returns to $P = (a, b)$, so the $y$-coordinate is $b$ again.",
      ],
    },
    "tan-two-pi": {
      steps:
        "Step 1: Sine and cosine repeat every $2\\pi$. Step 2: So $\\tan(\\theta + 2\\pi) = \\tan\\theta$, and $2\\pi$ is a period of tangent. Step 3: So $\\pi$ cannot also be a period of tangent.",
      correct:
        "Step 3: a function can repeat sooner than its parts; $\\theta + \\pi$ gives $(-a, -b)$, ratio $\\frac{b}{a}$.",
      wrong: [
        {
          label:
            "Step 2: tangent does not repeat after $2\\pi$, because it is undefined at some of those angles.",
          feedback:
            "Wherever tangent is defined, the point for $\\theta + 2\\pi$ is $P$ again, so the ratio repeats. Step 2 is right.",
        },
        {
          label:
            "Step 1: sine repeats every $\\pi$, not every $2\\pi$, since a half turn already returns to $P$.",
          feedback:
            "A half turn reaches $(-a, -b)$, not $P$. Sine repeats every $2\\pi$, so Step 1 is right.",
        },
        nothing(
          "Nothing is wrong: the smallest period of tangent is $2\\pi$, just like those of sine and cosine.",
          "Tangent repeats every $\\pi$: the half-turn point $(-a, -b)$ has the same ratio $\\frac{b}{a}$.",
        ),
      ],
      why: [
        "Step 1 is right: an arc of $2\\pi$ returns to $P$.",
        "Step 2 is right: the same point gives the same ratio $\\frac{b}{a}$.",
        "Step 3 is the error: having period $2\\pi$ does not rule out a shorter period. The half-turn point is $(-a, -b)$, and $\\frac{-b}{-a} = \\frac{b}{a}$, so $\\pi$ is a period of tangent.",
      ],
    },
    diameter: {
      steps:
        "Step 1: The unit circle's diameter is 2, so its circumference is $\\pi$. Step 2: So an arc of $\\pi$ goes around once and returns to $P$. Step 3: So $\\sin(\\theta + \\pi) = \\sin\\theta$, and $\\pi$ is a period of sine.",
      correct:
        "Step 1: the circumference is $2\\pi$, not $\\pi$, so an arc of $\\pi$ reaches the opposite point.",
      wrong: [
        {
          label:
            "Step 1: the unit circle's diameter is 1, not 2, since the radius and the diameter are equal.",
          feedback:
            "The diameter is twice the radius: $2 \\times 1 = 2$. The error is the circumference.",
        },
        {
          label:
            "Step 3: returning to the same point $P$ can still change the value of the sine.",
          feedback:
            "The same point has the same $y$-coordinate. Step 3 would follow if Step 2 were true.",
        },
        nothing(
          "Nothing is wrong: an arc of $\\pi$ returns to $P$, so $\\pi$ is a period of sine.",
          "An arc of $\\pi$ is half the circumference $2\\pi$. It reaches $(-a, -b)$, so $\\sin(\\theta + \\pi) = -\\sin\\theta$.",
        ),
      ],
      why: [
        "Step 1 is the error: the circumference is $\\pi$ times the diameter, $\\pi \\times 2 = 2\\pi$.",
        "So an arc of $\\pi$ is half a turn. It reaches the opposite point $(-a, -b)$, not $P$.",
        "That makes $\\sin(\\theta + \\pi) = -b = -\\sin\\theta$, so $\\pi$ is not a period of sine.",
      ],
    },
  };
  const a = args[m.argument];
  return choiceSurface(r, {
    prompt: `${setup} A student writes this argument. ${a.steps} Which statement identifies the error?`,
    options: [{ label: a.correct, correct: true }, ...a.wrong],
    hint: "Test each of the 3 steps against the unit circle: where does the added arc take $P = (a, b)$, and what are that point's coordinates?",
    explanation: [
      ...a.why,
      ...a.wrong.map(
        (o) => `${o.label.replace(/\.$/, "")}: wrong. ${o.feedback}`,
      ),
    ],
  });
}
function counterexample(m: PeriodModel, r: Random) {
  const { fn, c } = m.pair;
  const name = fnWord[fn];
  const cTex = twelfthsTex(c);
  const key = `${fn}-${c}`;
  const coincide = COINCIDENCES[key]!;
  const candidates = SPECIAL.filter(
    (k) => !coincide.some((z) => (((k - z) % 24) + 24) % 24 === 0),
  );
  const theta = candidates[m.pick % candidates.length]!;
  const at = valueAt(fn, theta),
    after = valueAt(fn, theta + c);
  const cosK = cosTwelfths(theta),
    sinK = sinTwelfths(theta);
  const cosA = cosTwelfths(theta + c),
    sinA = sinTwelfths(theta + c);
  const label = (k: number) => `$\\theta = ${twelfthsTex(k)}$`;
  const shown = coincide.map((z) => ({
    label: label(z),
    feedback: `At $\\theta = ${twelfthsTex(z)}$ both sides equal ${mx(valueAt(fn, z).tex)}, so the claim happens to hold there. Agreement at one angle proves nothing.`,
  }));
  return choiceSurface(r, {
    prompt: `A student claims that $${cTex}$ is a period of ${name}: $\\${fn}(\\theta + ${cTex}) = \\${fn}\\theta$ for every $\\theta$. Which value of $\\theta$ shows that the claim is false?`,
    options: [{ label: label(theta), correct: true }, ...shown],
    hint: `For a choice of $\\theta$, find the points for $\\theta$ and $\\theta + ${cTex}$ on the unit circle and compare their ${fn === "cos" ? "$x$" : "$y$"}-coordinates. The claim needs them equal at every angle.`,
    explanation: [
      `A period must work for every $\\theta$, so one angle where $\\${fn}(\\theta + ${cTex}) \\ne \\${fn}\\theta$ shows the claim is false.`,
      `At $\\theta = ${twelfthsTex(theta)}$ the point is $(${cosK.tex}, ${sinK.tex})$. Adding $${cTex}$ gives the point for $${twelfthsTex(theta + c)}$, which is $(${cosA.tex}, ${sinA.tex})$.`,
      `So $\\${fn}\\theta = ${at.tex}$ but $\\${fn}(\\theta + ${cTex}) = ${after.tex}$. They are not equal, so $${cTex}$ is not a period of ${name}.`,
      `The other choices are angles where both sides happen to agree: ${coincide.map((z) => `$\\theta = ${twelfthsTex(z)}$`).join(", ")}. Agreement at a few angles never proves a period, and it cannot disprove one either.`,
    ],
  });
}
export const periodFamily = chainFamily({
  template: meta("trig-periodicity-explanation"),
  axes: { family: periodAxis },
  model: (r, axes): PeriodModel => ({
    family: axes.family,
    fn: pick(r, ["sin", "cos"] as const),
    k: pick(r, KS),
    argument: pick(r, ARGUMENTS),
    pair: pick(r, PAIRS),
    theta: pick(r, FIRST),
    pick: r(0, 1000),
  }),
  variant: (m) =>
    m.family === "find-the-flaw"
      ? `flaw-${m.argument}`
      : m.family === "counterexample"
        ? `counterexample-${m.pair.fn}-${m.pair.c === 12 ? "pi" : "half-pi"}`
        : m.family,
  render: (m, _axes, r) => {
    const surface =
      m.family === "full-turn"
        ? fullTurn(m, r)
        : m.family === "tan-half-turn"
          ? halfTurn(r)
          : m.family === "find-the-flaw"
            ? flaw(m, r)
            : counterexample(m, r);
    if (!surface) return null;
    const th = m.theta;
    const c =
      m.family === "full-turn"
        ? 2 * Math.PI * m.k
        : m.family === "counterexample"
          ? (m.pair.c * Math.PI) / 12
          : Math.PI;
    const cPlain =
      m.family === "full-turn"
        ? m.k === 1
          ? "2π"
          : m.k === -1
            ? "−2π"
            : `${2 * m.k}π`.replace("-", "−")
        : m.family === "counterexample"
          ? twelfthsPlain(m.pair.c)
          : "π";
    const shift = m.family !== "find-the-flaw";
    const points: CirclePoint[] = [genericP(th)];
    if (shift && m.family !== "full-turn")
      points.push({ id: "Q", angle: th + c, label: "Q" });
    return {
      ...surface,
      figure: {
        kind: "scene" as const,
        scene: unitCircleScene({
          points,
          arcs: [thetaArc(th)],
          ...(shift
            ? { travel: c, travelFrom: th, travelLabel: `arc ${cPlain}` }
            : {}),
          startLabel: false,
          title: `Unit circle. P(a, b) is the point for the angle θ.${shift ? ` A path of length ${cPlain.replace("−", "")} starts at P${c < 0 ? " and runs clockwise" : ""}${m.family === "full-turn" ? " and ends at P again" : " and ends at Q"}.` : ""}`,
        }),
      },
    };
  },
});

/* ------------------------------------------- unit-circle-claim-check */

export interface ClaimStatement {
  id: string;
  label: string;
  holds: boolean;
  why: string;
}
export const CLAIMS: readonly ClaimStatement[] = [
  {
    id: "cos-even",
    label:
      "$\\cos(-\\theta) = \\cos\\theta$ for every $\\theta$, so cosine is even.",
    holds: true,
    why: "The point for $-\\theta$ is $(a, -b)$, with the same $x$-coordinate $a$ as $P$.",
  },
  {
    id: "sin-odd",
    label:
      "$\\sin(-\\theta) = -\\sin\\theta$ for every $\\theta$, so sine is odd.",
    holds: true,
    why: "The point for $-\\theta$ is $(a, -b)$: its $y$-coordinate is $-b$, the opposite of $P$'s.",
  },
  {
    id: "tan-odd",
    label:
      "$\\tan(-\\theta) = \\frac{-b}{a} = -\\tan\\theta$, so tangent is odd.",
    holds: true,
    why: "The point for $-\\theta$ is $(a, -b)$, so its ratio is $\\frac{-b}{a}$, the opposite of $\\frac{b}{a}$.",
  },
  {
    id: "tan-period",
    label:
      "$\\tan(\\theta + \\pi) = \\frac{-b}{-a} = \\tan\\theta$, so $\\pi$ is a period of tangent.",
    holds: true,
    why: "The point for $\\pi + \\theta$ is $(-a, -b)$; both signs change, so the ratio $\\frac{b}{a}$ stays.",
  },
  {
    id: "cos-full-turn",
    label:
      "$\\cos(\\theta + 2\\pi) = \\cos\\theta$ because an arc of $2\\pi$ returns to $P$.",
    holds: true,
    why: "The circumference is $2\\pi$, so the arc ends at $P = (a, b)$ again, with the same $x$-coordinate.",
  },
  {
    id: "sin-not-pi",
    label:
      "$\\sin(\\pi + \\theta) = -\\sin\\theta$, so $\\pi$ is not a period of sine.",
    holds: true,
    why: "The point for $\\pi + \\theta$ is $(-a, -b)$, whose $y$-coordinate is $-b$; since $b \\ne 0$ here, the values differ.",
  },
  {
    id: "sin-even",
    label: "$\\sin(\\pi - \\theta) = \\sin\\theta$, so sine is even.",
    holds: false,
    why: "The equation is true, since $(-a, b)$ shares $P$'s $y$-coordinate, but it is a symmetry about the $y$-axis. Even compares $-\\theta$, at $(a, -b)$, and $\\sin(-\\theta) = -b$.",
  },
  {
    id: "cos-odd",
    label: "$\\cos(\\pi - \\theta) = -\\cos\\theta$, so cosine is odd.",
    holds: false,
    why: "The equation is true, since $(-a, b)$ has $x$-coordinate $-a$, but odd compares $-\\theta$, at $(a, -b)$, where $\\cos(-\\theta) = a = \\cos\\theta$.",
  },
  {
    id: "sin-pi-period",
    label:
      "$\\sin(\\theta + \\pi) = \\sin\\theta$, so $\\pi$ is a period of sine.",
    holds: false,
    why: "The point for $\\pi + \\theta$ is $(-a, -b)$, so $\\sin(\\theta + \\pi) = -b$, not $b$.",
  },
  {
    id: "tan-even",
    label: "$\\tan(\\theta + \\pi) = \\tan\\theta$, so tangent is even.",
    holds: false,
    why: "The equation is true, but it is about a period. Even compares $-\\theta$: the point $(a, -b)$ gives $\\tan(-\\theta) = -\\tan\\theta$.",
  },
  {
    id: "tan-asymptotes",
    label: "Tangent is neither odd nor even because its graph has asymptotes.",
    holds: false,
    why: "The point for $-\\theta$ is $(a, -b)$, so $\\tan(-\\theta) = \\frac{-b}{a} = -\\tan\\theta$: tangent is odd.",
  },
  {
    id: "cos-sign",
    label: "$\\cos(-\\theta) = -\\cos\\theta$ because the angle is negative.",
    holds: false,
    why: "The point for $-\\theta$ is $(a, -b)$: the $x$-coordinate keeps its sign, so $\\cos(-\\theta) = \\cos\\theta$.",
  },
  {
    id: "sin-arc-length",
    label:
      "$\\sin(-\\theta) = \\sin\\theta$ because $-\\theta$ and $\\theta$ have the same arc length.",
    holds: false,
    why: "Same arc length, opposite direction: the point is $(a, -b)$, so $\\sin(-\\theta) = -b = -\\sin\\theta$.",
  },
];
export const claimFamily = selectFamily(
  meta("unit-circle-claim-check"),
  (r) => {
    const p = drawPoint(r, "general");
    const k = r(2, 4);
    const th = p.theta;
    return selectModel({
      variant: `true-${k}`,
      pool: CLAIMS.map((c) => st(c.label, c.holds, c.why)),
      total: 6,
      k,
      one: "statement",
      context:
        "On the unit circle, $P = (a, b)$ is the point for the angle $\\theta$, so $a = \\cos\\theta$ and $b = \\sin\\theta$. The figure also marks the point for $-\\theta$, $(a, -b)$; the point for $\\pi - \\theta$, $(-a, b)$; and the point for $\\pi + \\theta$, $(-a, -b)$.",
      ask: (n) => `Which ${n} statements are true, with a correct reason?`,
      hint: `For each statement, find the two marked points it compares, such as $P = (a, b)$ and the point for $-\\theta$. Do their coordinates agree as claimed, and does the reason fit the conclusion? Exactly ${k} statements pass both checks.`,
      figure: {
        kind: "scene",
        scene: unitCircleScene({
          points: [
            { id: "P", angle: th, label: "P(a, b)" },
            { id: "M", angle: -th, label: "(a, −b)", color: "accent" },
            {
              id: "N",
              angle: Math.PI - th,
              label: "(−a, b)",
              color: "accent",
            },
            {
              id: "H",
              angle: Math.PI + th,
              label: "(−a, −b)",
              color: "accent",
            },
          ],
          arcs: [{ id: "theta", to: th, r: 0.26, label: "θ" }],
          startLabel: false,
          title:
            "Unit circle. P(a, b) is the point for the angle θ. The point for −θ is (a, −b), for π − θ is (−a, b), and for π + θ is (−a, −b).",
        }),
      },
      lead: [
        "A function $f$ is called even when $f(-\\theta) = f(\\theta)$ for every $\\theta$, and odd when $f(-\\theta) = -f(\\theta)$. A period is a number $c$ with $f(\\theta + c) = f(\\theta)$ for every $\\theta$.",
        "The point for $-\\theta$ is the reflection of $P$ across the $x$-axis, $(a, -b)$; the point for $\\pi - \\theta$ is the reflection across the $y$-axis, $(-a, b)$; and the point for $\\pi + \\theta$ is the half turn, $(-a, -b)$.",
      ],
      tail: [
        "Only the point for $-\\theta$ decides even or odd, and only a whole or half turn decides a period.",
      ],
    });
  },
);

/* ------------------------------------------------------------ dispatch */

export const trigSymmetryReasoningGenerate = dispatch(
  trigSymmetryReasoningTemplates,
  {
    "unit-circle-symmetry-derivation": (seed) =>
      derivationFamily.generate(seed).problem,
    "trig-periodicity-explanation": (seed) =>
      periodFamily.generate(seed).problem,
    "unit-circle-claim-check": (seed) => claimFamily.generate(seed).problem,
  },
);
