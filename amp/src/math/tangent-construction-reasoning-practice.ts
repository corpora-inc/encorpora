import type { TemplateMetadata } from "./contracts";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { shuffle } from "./distribution-practice";
import {
  figureName,
  figurePoint,
  figureScene,
  sceneFigure,
} from "./geometry-teaching-figures";
import type { Element, Scene } from "./scene/spec";
import { defineAxis, type Random } from "./variation/axes";

/**
 * HSG.C.A.4: construct a tangent from a point P outside circle O. The
 * construction: the perpendicular bisector of OP gives its midpoint M; the
 * circle with center M through O (diameter OP) meets circle O at T and T′;
 * lines PT and PT′ are the tangents, because the angle OTP is inscribed in a
 * semicircle and a line perpendicular to a radius at its endpoint is tangent.
 * Two types: know the steps (next step, order, which drawn line), and
 * justify them (why the circle on OP, why PT is tangent, a faulty
 * construction, the second fact of a complete justification). Performing the
 * construction needs a construction canvas, which the engine does not have.
 */

const band = "9–12" as const;
const choice = {
  requiredResponseCapability: "single-choice-v1" as const,
  requiredFigureCapability: "scenes-v1" as const,
};

export const tangentConstructionReasoningTemplates: readonly TemplateMetadata[] =
  [
    {
      id: "tangent-construct-steps",
      version: 1,
      title: "The steps of the tangent construction",
      skillId: "tangent-construction",
      gradeBand: band,
      difficultyOffset: 0.2,
      ...choice,
      description:
        "Know the compass-and-straightedge construction of a tangent from an outside point $P$: choose the next step after zero to three steps, choose the order of the steps when one listed step does not belong, or pick the drawn line that is the tangent the construction produces. Choosing stands in for performing the construction.",
    },
    {
      id: "tangent-construct-justify",
      version: 1,
      title: "Justify the tangent construction",
      skillId: "tangent-construction",
      gradeBand: band,
      difficultyOffset: 0.4,
      ...choice,
      description:
        "Explain why the tangent construction works: why the circle with diameter $\\overline{OP}$ finds the points of tangency, why line $PT$ is tangent, what is wrong with a faulty construction, and which second fact completes the justification.",
    },
  ];

/* ------------------------------------------------------------ geometry */

type Pt = [number, number];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const len = (a: Pt) => Math.hypot(a[0], a[1]);
const unit = (a: Pt): Pt => mul(a, 1 / len(a));
const polar = (rr: number, deg: number): Pt => [
  rr * Math.cos((deg * Math.PI) / 180),
  rr * Math.sin((deg * Math.PI) / 180),
];

/** Pythagorean (radius, OP) pairs: the tangent length is a whole number. */
export const PYTHAGOREAN: readonly [number, number][] = [
  [3, 5],
  [5, 13],
  [6, 10],
  [8, 17],
  [9, 15],
  [12, 20],
];

export interface Config {
  r: number;
  d: number;
  /** Direction of P from O, degrees. */
  phi: number;
  O: Pt;
  P: Pt;
  M: Pt;
  /** The two points of tangency: T counterclockwise of ray OP, T′ clockwise. */
  T: Pt;
  T2: Pt;
  /** Lengths are quoted (a Pythagorean pair) or not. */
  quoted: boolean;
}

export function config(r: Random, quoted: boolean): Config {
  let rad: number;
  let d: number;
  if (quoted) [rad, d] = pick(r, PYTHAGOREAN);
  else {
    rad = pick(r, [3, 4, 5, 6]);
    d = r(Math.ceil(1.6 * rad), 3 * rad);
  }
  const phi = 30 * r(0, 11);
  const alpha = (Math.acos(rad / d) * 180) / Math.PI;
  const P = polar(d, phi);
  return {
    r: rad,
    d,
    phi,
    O: [0, 0],
    P,
    M: mul(P, 0.5),
    T: polar(rad, phi + alpha),
    T2: polar(rad, phi - alpha),
    quoted,
  };
}

/** The tangent length from P, when the lengths are quoted. */
const tangentLength = (c: Config) => Math.round(Math.sqrt(c.d ** 2 - c.r ** 2));

/* ------------------------------------------------------------- figure */

type Stage = 0 | 1 | 2 | 3 | 4;
interface Extra {
  circles?: { id: string; center: Pt; r: number }[];
  lines?: { id: string; from: Pt; to: Pt; stroke?: "ink" | "warm" | "gold" }[];
  points?: { id: string; at: Pt; name: string; out: Pt }[];
  labels?: { id: string; at: Pt; text: string }[];
}

/** A long segment through two points, reaching past both. */
const through = (a: Pt, b: Pt, before: number, after: number): [Pt, Pt] => {
  const u = unit(sub(b, a));
  return [sub(a, mul(u, before)), add(b, mul(u, after))];
};

/**
 * Circle O (teal) and point P, with the canonical construction drawn up to
 * `stage`: 1 the perpendicular bisector of OP and M, 2 the circle with
 * center M through O, 3 the points T and T′, 4 the lines PT and PT′.
 */
export function constructionScene(
  c: Config,
  stage: Stage,
  extra: Extra = {},
  o: { lengths?: boolean; title?: string } = {},
): Scene {
  const { O, P, M, T, T2 } = c;
  const u = unit(P);
  const n: Pt = [-u[1], u[0]];
  const els: Element[] = [
    {
      type: "circle",
      id: "given",
      center: O,
      r: c.r,
      stroke: "accent",
      width: 2.25,
    },
    {
      type: "segment",
      id: "op",
      from: O,
      to: P,
      stroke: "muted",
      width: 1.5,
    },
  ];
  if (stage >= 1) {
    const reach = Math.max(c.d * 0.62, c.r + 1);
    els.push({
      type: "segment",
      id: "bis",
      from: add(M, mul(n, reach)),
      to: sub(M, mul(n, reach)),
      stroke: "muted",
      width: 1.5,
      dash: "dash",
    });
  }
  if (stage >= 2)
    els.push({
      type: "circle",
      id: "helper",
      center: M,
      r: c.d / 2,
      stroke: "muted",
      width: 1.5,
    });
  for (const circle of extra.circles ?? [])
    els.push({
      type: "circle",
      id: circle.id,
      center: circle.center,
      r: circle.r,
      stroke: "muted",
      width: 1.5,
    });
  if (stage >= 4)
    for (const [id, X] of [
      ["lpt", T],
      ["lpt2", T2],
    ] as const) {
      const [a, b] = through(P, X, 0, c.r * 0.6);
      els.push({
        type: "segment",
        id,
        from: a,
        to: b,
        stroke: "ink",
        width: 2,
      });
    }
  for (const line of extra.lines ?? [])
    els.push({
      type: "segment",
      id: line.id,
      from: line.from,
      to: line.to,
      stroke: line.stroke ?? "ink",
      width: 2,
    });
  if (o.lengths) {
    els.push(
      {
        type: "segment",
        id: "ot",
        from: O,
        to: T,
        stroke: "accent",
        width: 1.75,
      },
      {
        type: "text",
        id: "lenr",
        at: mul(T, 0.5),
        text: `${c.r}`,
        font: "math",
        halo: true,
        align: [0, 0],
        offset: [0, 0],
      },
      {
        type: "text",
        id: "lend",
        at: mul(P, 0.72),
        text: `${c.d}`,
        font: "math",
        halo: true,
        align: [0, -1],
        offset: [0, 6],
      },
    );
  }
  els.push(
    figurePoint("po", O),
    figureName("no", "O", O, mul(u, -1)),
    figurePoint("pp", P),
    figureName("np", "P", P, u),
  );
  if (stage >= 1) {
    // OP and the bisector cross at M at a right angle. The name sits on the
    // diagonal between them, toward P and away from T, centered 18 px out so
    // its box clears both strokes.
    const w = unit(sub(u, n));
    els.push(figurePoint("pm", M), {
      type: "text",
      id: "nm",
      at: M,
      text: "M",
      font: "math",
      bold: true,
      align: [0, 0],
      offset: [w[0] * 18, -w[1] * 18],
    });
  }
  if (stage >= 3)
    els.push(
      figurePoint("pt", T),
      figureName("nt", "T", T, T),
      figurePoint("pt2", T2),
      figureName("nt2", "T′", T2, T2),
    );
  for (const p of extra.points ?? [])
    els.push(
      figurePoint(`p${p.id}`, p.at),
      figureName(`n${p.id}`, p.name, p.at, p.out),
    );
  for (const l of extra.labels ?? [])
    els.push({
      type: "text",
      id: l.id,
      at: l.at,
      text: l.text,
      font: "math",
      bold: true,
      halo: true,
      align: [0, 0],
    });
  const marks = [
    "circle O, point P outside it",
    stage >= 1 ? "the perpendicular bisector of OP, midpoint M" : "",
    stage >= 2 ? "the circle with center M through O" : "",
    stage >= 3 ? "its crossings T and T′ with circle O" : "",
    stage >= 4 ? "lines PT and PT′" : "",
  ].filter(Boolean);
  return figureScene(
    o.title ?? `The tangent construction: ${marks.join(", ")}`,
    els,
  );
}

/* ----------------------------------------------- type 1: know the steps */

type StepsAsk = "next-step" | "order-steps" | "which-line";
export interface StepsCase {
  ask: StepsAsk;
  c: Config;
  /** next-step: steps already done. */
  k: 0 | 1 | 2 | 3;
  options: ChoiceOption[];
  prompt: string;
  hint: string;
  explanation: string[];
  scene: Scene;
  /** which-line: the tangent's label and each drawn line, for checks. */
  lines?: { label: string; role: string; a: Pt; b: Pt }[];
  /** order-steps: the decoy step's role. */
  decoy?: string;
}

const CANON = [
  "Construct the perpendicular bisector of $\\overline{OP}$ to find its midpoint $M$.",
  "Draw the circle with center $M$ through $O$.",
  "Mark the points $T$ and $T'$ where that circle meets circle $O$.",
  "Draw line $PT$ and line $PT'$.",
];
const RECAP = [
  "First, the perpendicular bisector of $\\overline{OP}$ gives its midpoint $M$.",
  "Second, the circle with center $M$ through $O$ also passes through $P$, so $\\overline{OP}$ is its diameter.",
  "Third, that circle meets circle $O$ at $T$ and $T'$. At each of them, $\\overline{OP}$ makes a right angle: an angle inscribed in a semicircle is a right angle.",
  "Fourth, lines $PT$ and $PT'$ are perpendicular to the radii $\\overline{OT}$ and $\\overline{OT'}$, so they are the tangents from $P$.",
];

function nextStepCase(c: Config, k: 0 | 1 | 2 | 3, r: Random): StepsCase {
  const helperRadiusR = c.d !== 2 * c.r;
  const sets: Record<0 | 1 | 2 | 3, ChoiceOption[]> = {
    0: [
      {
        label:
          "Construct the perpendicular bisector of $\\overline{OP}$ to find the midpoint $M$ of $\\overline{OP}$",
        correct: true,
      },
      {
        label:
          "Draw the circle with center $P$ through $O$; it meets circle $O$ at the points of tangency",
        feedback:
          "Points on that circle are as far from $P$ as $O$ is, but the angle they make with $O$ and $P$ is not a right angle, so they are not points of tangency.",
      },
      {
        label:
          "Draw the line through $P$ perpendicular to $\\overline{OP}$; it is the tangent",
        feedback:
          "That line is at distance $OP$ from $O$, more than the radius, so it misses the circle. A tangent is perpendicular to the radius at the point of contact, not to $\\overline{OP}$.",
      },
      {
        label:
          "Draw the line through $O$ perpendicular to $\\overline{OP}$; it meets circle $O$ at the points of tangency",
        feedback:
          "At such a point $X$ the right angle is at $O$, so the angle at $X$ in triangle $OXP$ is less than $90^\\circ$. Line $PX$ is not tangent.",
      },
    ],
    1: [
      {
        label:
          "Draw the circle with center $M$ through $O$, the circle with diameter $\\overline{OP}$",
        correct: true,
      },
      helperRadiusR
        ? {
            label:
              "Draw the circle with center $M$ and the radius of circle $O$; it meets circle $O$ at the points of tangency",
            feedback:
              "The helper circle must pass through $O$ and $P$, so its radius is $MO$, half of $OP$. A circle with the radius of circle $O$ does not, so its crossings do not make right angles.",
          }
        : {
            label:
              "Draw the circle with center $P$ and the radius of circle $O$; it meets circle $O$ at the points of tangency",
            feedback:
              "Points as far from $P$ as the radius do not make a right angle with $O$ and $P$. The circle must have $\\overline{OP}$ as its diameter.",
          },
      {
        label:
          "The perpendicular bisector of $\\overline{OP}$, already drawn, is the tangent from $P$",
        feedback:
          "The perpendicular bisector does not pass through $P$, so it cannot be the tangent from $P$.",
      },
      {
        label:
          "Draw the circle with center $P$ through $M$; it meets circle $O$ at the points of tangency",
        feedback:
          "Points half of $OP$ from $P$ do not make a right angle with $O$ and $P$. The circle needs $\\overline{OP}$ as its diameter, so its center is $M$.",
      },
    ],
    2: [
      {
        label:
          "Mark the points $T$ and $T'$ where the new circle meets circle $O$",
        correct: true,
      },
      {
        label:
          "Mark where the new circle meets line $OP$; those are the points of tangency",
        feedback:
          "The new circle meets line $OP$ at $O$ and $P$ themselves. Neither is on circle $O$ where a tangent from $P$ touches.",
      },
      {
        label:
          "Mark where the perpendicular bisector meets the new circle; those are the points of tangency",
        feedback:
          "Those points are not on circle $O$, so a line from $P$ through them does not touch circle $O$ there.",
      },
      {
        label:
          "Mark where the perpendicular bisector meets circle $O$; those are the points of tangency",
        feedback:
          "Points on the bisector are as far from $O$ as from $P$; the angle they make with $O$ and $P$ is not a right angle.",
      },
    ],
    3: [
      {
        label:
          "Draw the line through $P$ and $T$, and the line through $P$ and $T'$",
        correct: true,
      },
      {
        label: "Draw the line through $O$ and $T$",
        feedback:
          "Line $OT$ contains a radius and passes through the center; it does not pass through $P$. The tangent through $T$ is perpendicular to it.",
      },
      {
        label: "Draw the line through $T$ and $T'$",
        feedback:
          "Line $TT'$ cuts across circle $O$: it is a chord, not a tangent, and it does not pass through $P$.",
      },
      {
        label: "Draw the line through $M$ and $T$",
        feedback:
          "Line $MT$ is a radius of the helper circle. It does not pass through $P$ and is not perpendicular to $\\overline{OT}$.",
      },
    ],
  };
  const done = [
    "Only circle $O$, its center $O$ and the point $P$ are drawn.",
    "The perpendicular bisector of $\\overline{OP}$ is drawn, with midpoint $M$.",
    "The perpendicular bisector of $\\overline{OP}$ (midpoint $M$) and the circle with center $M$ through $O$ are drawn.",
    "The perpendicular bisector of $\\overline{OP}$, the circle with center $M$ through $O$, and the points $T$ and $T'$ where it meets circle $O$ are drawn.",
  ];
  const hints = [
    `Only circle $O$ and point $P$ are drawn. A point of tangency $T$ is a point of circle $O$ with $m\\angle OTP=90^\\circ$. For each choice, ask what it draws and whether what it claims is true.`,
    `So far the perpendicular bisector of $\\overline{OP}$ and its midpoint $M$ are drawn. For each choice, picture what it draws, then ask whether its points make a right angle with $O$ and $P$.`,
    `So far $M$ and the circle with center $M$ through $O$ are drawn. For each choice, find the points it would mark on the figure and the angle they make with $O$ and $P$.`,
    `$T$ and $T'$ are now marked on circle $O$. A tangent from $P$ meets circle $O$ at exactly one point; test each choice's line against that on the figure.`,
  ];
  const options = sets[k];
  const correct = options.find((o) => o.correct)!;
  return {
    ask: "next-step",
    c,
    k,
    options,
    prompt: `A tangent from point $P$ to circle $O$ is being constructed with compass and straightedge. ${done[k]} What is the next step?`,
    hint: hints[k]!,
    explanation: [
      "A tangent touches a circle at one point, and it is perpendicular to the radius drawn to that point. So the points of tangency $T$ are the points of circle $O$ where $m\\angle OTP=90^\\circ$.",
      ...RECAP,
      k === 0
        ? `Nothing is constructed yet, so the first step is: ${correct.label}.`
        : `${["One step is", "Two steps are", "Three steps are"][k - 1]} done, so the next step is: ${correct.label}.`,
      ...options
        .filter((o) => !o.correct)
        .map((o) => `Not "${o.label}": ${o.feedback}`),
    ],
    scene: constructionScene(c, k),
  };
}

const DECOYS = [
  {
    key: "circle-at-p",
    text: "Draw the circle with center $P$ through $O$.",
    replaces: 1,
    why: "with the circle centered at $P$, the next step marks points where $OP$ does not make a right angle, so the lines from $P$ cut the circle",
  },
  {
    key: "radius-line",
    text: "Draw the line through $O$ and $T$.",
    replaces: 3,
    why: "line $OT$ passes through the center and not through $P$; it contains a radius, not a tangent",
  },
  {
    key: "perpendicular-at-p",
    text: "Draw the line through $P$ perpendicular to $\\overline{OP}$.",
    replaces: 3,
    why: "that line misses circle $O$, since a tangent is perpendicular to the radius $\\overline{OT}$, not to $\\overline{OP}$",
  },
] as const;

function orderCase(c: Config, r: Random): StepsCase {
  const decoy = pick(r, DECOYS);
  // Steps 0–3 are canonical; 4 is the decoy. They are listed in a seeded order.
  const listed = shuffle(r, [0, 1, 2, 3, 4]);
  const number = (step: number) => listed.indexOf(step) + 1;
  const seq = (steps: number[]) => `$${steps.map(number).join(",\\ ")}$`;
  const swaps = shuffle(r, [
    {
      steps: [1, 0, 2, 3],
      why: "it draws the circle with center $M$ before $M$ has been found",
    },
    {
      steps: [0, 2, 1, 3],
      why: "it marks $T$ and $T'$ before the circle that finds them is drawn",
    },
    {
      steps: [0, 1, 3, 2],
      why: "it draws lines $PT$ and $PT'$ before $T$ and $T'$ are marked",
    },
  ]).slice(0, 2);
  const withDecoy = [0, 1, 2, 3].map((s) => (s === decoy.replaces ? 4 : s));
  const options: ChoiceOption[] = [
    { label: seq([0, 1, 2, 3]), correct: true },
    ...swaps.map((s) => ({
      label: seq(s.steps),
      feedback: `This order fails because ${s.why}.`,
    })),
    {
      label: seq(withDecoy),
      feedback: `This list uses step ${number(4)}, which does not belong: ${decoy.why}.`,
    },
  ];
  const text = (step: number) => (step === 4 ? decoy.text : CANON[step]!);
  const list = listed
    .map((step, i) => `Step ${i + 1}: ${text(step)}`)
    .join(" ");
  return {
    ask: "order-steps",
    c,
    k: 0,
    options,
    decoy: decoy.key,
    prompt: `These steps, four of them in the right order, construct the tangents from point $P$ to circle $O$. One step does not belong. ${list} Which list gives the construction in order?`,
    hint: `The circle centered at $M$ is drawn in step ${number(1)}, so the step that finds $M$ must come before it. Then ask which step needs $T$ and $T'$ to exist already, and which step is not part of the construction.`,
    explanation: [
      "Each step can use only points that earlier steps produced.",
      ...RECAP,
      `So the order is ${seq([0, 1, 2, 3])}. The step that does not belong is step ${number(4)}: ${decoy.why}.`,
      ...options
        .filter((o) => !o.correct)
        .map((o) => `Not ${o.label}: ${o.feedback}`),
    ],
    scene: constructionScene(c, 4),
  };
}

/** Angle in degrees between the directions of two lines (0–90). */
export const lineAngle = (u: Pt, v: Pt) => {
  const cos = Math.abs(u[0] * v[0] + u[1] * v[1]) / (len(u) * len(v));
  return (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
};
/** Distance from O = (0, 0) to the line through a and b. */
export const distanceFromO = (a: Pt, b: Pt) => {
  const d = sub(b, a);
  return Math.abs(a[0] * d[1] - a[1] * d[0]) / len(d);
};

function whichLineCase(c: Config, r: Random): StepsCase | null {
  const useT = r(0, 1) === 1;
  const T = useT ? c.T : c.T2;
  const T2 = useT ? c.T2 : c.T;
  const u = unit(c.P);
  const n: Pt = [-u[1], u[0]];
  const P = c.P;
  const reach = c.r * 0.9;
  // The decoys are structural and look different from a tangent: the chord
  // of contact TT′ (crosses the circle), the perpendicular to OP at P
  // (misses it) and the line through O and T (passes through the center).
  const raw = [
    { role: "tangent", seg: through(P, T, 0, reach) },
    { role: "chord", seg: through(T, T2, c.r * 0.5, c.r * 0.5) },
    {
      role: "perpendicular-at-p",
      seg: through(add(P, mul(n, -c.r)), add(P, mul(n, c.r)), 0, 0),
    },
    { role: "radius-line", seg: through(c.O, T, c.r * 0.5, reach) },
  ];
  // The two lines through P must point at least 8° apart there.
  if (lineAngle(sub(raw[0]!.seg[1], raw[0]!.seg[0]), n) > 82) return null;
  const order = shuffle(r, [0, 1, 2, 3]);
  const names = ["a", "b", "c", "d"];
  const lines = order.map((i, slot) => ({
    label: names[slot]!,
    role: raw[i]!.role,
    a: raw[i]!.seg[0],
    b: raw[i]!.seg[1],
  }));
  const tangent = lines.find((l) => l.role === "tangent")!;
  const feedback: Record<string, string> = {
    chord:
      "This line passes through $T$ and $T'$: it cuts across circle $O$ as a chord, and it does not pass through $P$.",
    "perpendicular-at-p":
      "This line is perpendicular to $\\overline{OP}$ at $P$. It is farther from $O$ than the radius, so it misses circle $O$.",
    "radius-line":
      "This line passes through the center $O$ and $T$: it contains a radius. It does not pass through $P$.",
  };
  const options: ChoiceOption[] = lines.map((l) =>
    l.role === "tangent"
      ? { label: `Line $${l.label}$`, correct: true }
      : { label: `Line $${l.label}$`, feedback: feedback[l.role]! },
  );
  const tip = (l: (typeof lines)[number]) => {
    const d = unit(sub(l.b, l.a));
    return add(l.b, mul(d, 0.35 * c.r));
  };
  const scene = constructionScene(
    c,
    3,
    {
      lines: lines.map((l) => ({ id: `l${l.label}`, from: l.a, to: l.b })),
      labels: lines.map((l) => ({
        id: `t${l.label}`,
        at: tip(l),
        text: l.label,
      })),
    },
    {
      title:
        "Circle O, point P, the circle with center M through O, the points T and T′, and four lines labeled a, b, c and d",
    },
  );
  return {
    ask: "which-line",
    c,
    k: 3,
    options: options.sort((p, q) => p.label.localeCompare(q.label)),
    lines,
    prompt:
      "The circle with center $M$ through $O$ has been drawn and meets circle $O$ at $T$ and $T'$. Four lines are drawn. Which line is the tangent from $P$ that the construction produces?",
    hint: `A tangent from $P$ meets circle $O$ at exactly one point. Follow each of the lines $a$, $b$, $c$ and $d$ on the figure: where does it meet circle $O$, and where does it start?`,
    explanation: [
      "A tangent touches a circle at one point, and it is perpendicular to the radius drawn to that point.",
      "The circle with center $M$ has $\\overline{OP}$ as a diameter, so at $T$, where it meets circle $O$, $m\\angle OTP=90^\\circ$ (an angle inscribed in a semicircle).",
      `So line $PT$ is perpendicular to the radius $\\overline{OT}$ at $T$: it is the tangent. That is line $${tangent.label}$.`,
      ...lines
        .filter((l) => l.role !== "tangent")
        .map((l) => `Line $${l.label}$: ${feedback[l.role]}`),
    ],
    scene,
  };
}

const stepsFamily = chainFamily({
  template: tangentConstructionReasoningTemplates[0]!,
  axes: {
    ask: defineAxis(
      "ask",
      ["next-step", "order-steps", "which-line"] as const,
      {
        weights: [8, 7, 5],
      },
    ),
  },
  model: (r, axes): StepsCase => {
    const c = config(r, false);
    if (axes.ask === "next-step")
      return nextStepCase(c, r(0, 3) as 0 | 1 | 2 | 3, r);
    if (axes.ask === "order-steps") return orderCase(c, r);
    const out = whichLineCase(c, r);
    if (!out) throw new Error("Need three retry: lines too close at P");
    return out;
  },
  render: (m, _axes, r) => {
    const surface = choiceSurface(r, {
      prompt: m.prompt,
      options: m.options,
      hint: m.hint,
      explanation: m.explanation,
    });
    if (!surface) return null;
    if (m.ask === "which-line") {
      // Lines a–d are listed in order; their drawn positions are shuffled.
      const opts = m.options.map((o, i) => ({
        id: `option-${"abcd"[i]}`,
        label: o.label,
      }));
      const feedback: Record<string, string> = {};
      let answer = "";
      m.options.forEach((o, i) => {
        if (o.correct) answer = `option-${"abcd"[i]}`;
        else feedback[`option-${"abcd"[i]}`] = o.feedback!;
      });
      return {
        ...surface,
        response: {
          kind: "choice" as const,
          label: "Choose one line",
          options: opts,
        },
        answer,
        choiceFeedback: feedback,
        figure: sceneFigure(m.scene),
      };
    }
    return { ...surface, figure: sceneFigure(m.scene) };
  },
  variant: (m) =>
    m.ask === "next-step"
      ? `next-step-${m.k}`
      : m.ask === "order-steps"
        ? `order-steps-${m.decoy}`
        : "which-line",
});

/* ------------------------------------------------ type 2: justify it */

type JustifyAsk =
  "reason-for-step" | "reason-tangent" | "find-flaw" | "complete-explanation";
type Script = "ana" | "ben" | "cara";
export interface JustifyCase {
  ask: JustifyAsk;
  c: Config;
  script: Script;
  /** complete-explanation: which fact is given. */
  given: "right-angle" | "tangent-rule";
  prompt: string;
  options: ChoiceOption[];
  hint: string;
  explanation: string[];
  scene: Scene;
  /** find-flaw: the faulty line, for checks. */
  faulty?: { a: Pt; b: Pt };
}

const RIGHT_ANGLE =
  "$m\\angle OTP=90^\\circ$, because it is inscribed in a semicircle of the circle with diameter $\\overline{OP}$";
const TANGENT_RULE =
  "A line perpendicular to a radius at its endpoint on the circle is tangent to the circle";

function lengthsLine(c: Config): string[] {
  if (!c.quoted) return [];
  const t = tangentLength(c);
  return [
    `With the right angle at $T$, triangle $OTP$ gives the tangent length: $PT=\\sqrt{${c.d}^2-${c.r}^2}=\\sqrt{${c.d * c.d - c.r * c.r}}=${t}$.`,
  ];
}
const quotedText = (c: Config) =>
  c.quoted ? ` Circle $O$ has radius $${c.r}$, and $OP=${c.d}$.` : "";

function justifyCase(r: Random, ask: JustifyAsk, quoted: boolean): JustifyCase {
  const c = config(r, quoted);
  const script = pick(r, ["ana", "ben", "cara"] as const);
  const given = pick(r, ["right-angle", "tangent-rule"] as const);
  const base = { ask, c, script, given };
  const intro = `Point $P$ is outside circle $O$. The construction drew the circle with center $M$ (the midpoint of $\\overline{OP}$) through $O$ and $P$; it meets circle $O$ at $T$ and $T'$.${quotedText(c)}`;
  const definition =
    "A tangent touches a circle at one point and is perpendicular to the radius drawn to that point.";
  if (ask === "reason-for-step") {
    const options: ChoiceOption[] = [
      {
        label:
          "An angle inscribed in a semicircle is a right angle, so $m\\angle OTP=90^\\circ$ where it meets circle $O$",
        correct: true,
      },
      {
        // False for every OP > r√2, which every figure has (OP ≥ 1.6r).
        label:
          "$T$ is as far from $O$ as from $P$, so it lies on the perpendicular bisector of $\\overline{OP}$",
        feedback:
          "False: $TO$ is the radius, and $TP$ is longer, since $TP^2 = OP^2 - TO^2$ is more than $TO^2$ here. $T$ is not on the bisector.",
      },
      {
        label:
          "$\\overline{OP}$ is a diameter of circle $O$, so $T$ is on circle $O$",
        feedback:
          "$\\overline{OP}$ is a diameter of the circle with center $M$, not of circle $O$; $P$ is outside circle $O$.",
      },
      {
        label:
          "Both circles pass through $T$, so they are tangent to each other at $T$",
        feedback:
          "The circles cross at $T$ (they also meet at $T'$). Two circles tangent at a point have centers in line with it, and $O$, $M$, $T$ are not in line.",
      },
    ];
    return {
      ...base,
      prompt: `${intro} Why does the circle with diameter $\\overline{OP}$ locate the points of tangency?`,
      options,
      hint: `At a point of tangency $T$, radius $\\overline{OT}$ and line $PT$ meet at a right angle. For each statement, ask whether it is true and whether it explains why the crossings of the two circles have that angle.${c.quoted ? ` Here $OP=${c.d}$.` : ""}`,
      explanation: [
        definition,
        "So a point $T$ of circle $O$ is a point of tangency exactly when $m\\angle OTP=90^\\circ$.",
        "Every point of the circle with diameter $\\overline{OP}$, other than $O$ and $P$, makes an angle inscribed in a semicircle, so the angle there is $90^\\circ$. Where that circle meets circle $O$ are the points of tangency.",
        ...lengthsLine(c),
        ...options
          .filter((o) => !o.correct)
          .map((o) => `Not "${o.label}": ${o.feedback}`),
      ],
      scene: constructionScene(c, 3, {}, { lengths: c.quoted }),
    };
  }
  if (ask === "reason-tangent") {
    const options: ChoiceOption[] = [
      {
        label:
          "$m\\angle OTP=90^\\circ$ (angle in a semicircle), and a line perpendicular to radius $\\overline{OT}$ at $T$ is tangent",
        correct: true,
      },
      {
        label:
          "$T$ lies on both circles, so line $PT$ touches each circle only at $T$",
        feedback:
          "Line $PT$ meets the circle with center $M$ twice, at $T$ and at $P$. Being on both circles does not make a line tangent.",
      },
      {
        label:
          "$PT=PT'$, because the two tangent segments from a point are equal",
        feedback:
          "That fact holds only for tangents, so using it assumes what is to be proved.",
      },
      {
        label:
          "$PT$ is shorter than $OP$, so line $PT$ cannot cross circle $O$",
        feedback:
          "Lines from $P$ that cross the circle also reach it in less than $OP$. Length does not decide tangency; the right angle at $T$ does.",
      },
    ];
    return {
      ...base,
      prompt: `${intro} Why is line $PT$ tangent to circle $O$?`,
      options,
      hint: `A tangent meets the circle at exactly one point. For each statement, ask whether it is true and whether it shows that line $PT$ meets circle $O$ at $T$ only.${c.quoted ? ` The radius is $${c.r}$.` : ""}`,
      explanation: [
        definition,
        "$\\overline{OP}$ is a diameter of the circle with center $M$, and $T$ is on that circle, so $\\angle OTP$ is inscribed in a semicircle: $m\\angle OTP=90^\\circ$.",
        "$\\overline{OT}$ is a radius of circle $O$, so line $PT$ is perpendicular to a radius at its endpoint on the circle. Such a line is tangent.",
        ...lengthsLine(c),
        ...options
          .filter((o) => !o.correct)
          .map((o) => `Not "${o.label}": ${o.feedback}`),
      ],
      scene: constructionScene(c, 4, {}, { lengths: c.quoted }),
    };
  }
  if (ask === "find-flaw") {
    const u = unit(c.P);
    const n: Pt = [-u[1], u[0]];
    if (script === "ana") {
      const x = (c.r * c.r) / (2 * c.d);
      const side = r(0, 1) ? 1 : -1;
      const A = add(mul(u, x), mul(n, side * Math.sqrt(c.r * c.r - x * x)));
      const [a, b] = through(c.P, A, 0, c.r * 1.2);
      const options: ChoiceOption[] = [
        {
          label:
            "$A$ is not on the circle with diameter $\\overline{OP}$, so $m\\angle OAP\\ne90^\\circ$ and line $PA$ crosses circle $O$",
          correct: true,
        },
        {
          label:
            "She should have used the radius of circle $O$ for the circle centered at $P$",
          feedback:
            "A point as far from $P$ as the radius still does not make a right angle with $O$ and $P$; the helper circle needs $\\overline{OP}$ as its diameter.",
        },
        {
          label:
            "Line $PA$ is tangent; she only needs to mark the second point too",
          feedback:
            "Line $PA$ is not perpendicular to radius $\\overline{OA}$, so it crosses circle $O$ at $A$ and at a second point; it is not tangent.",
        },
        {
          label: "The circle should be centered at $O$ through $P$",
          feedback:
            "A circle centered at $O$ through $P$ surrounds circle $O$ and never meets it, so it marks no point.",
        },
      ];
      return {
        ...base,
        faulty: { a, b },
        prompt: `Point $P$ is outside circle $O$.${quotedText(c)} Ana draws the circle with center $P$ through $O$, marks a point $A$ where it meets circle $O$, and draws line $PA$ as the tangent. Which statement identifies her error?`,
        options,
        hint: `Ana's circle has center $P$ and passes through $O$${c.quoted ? `, so its radius is $${c.d}$` : ""}. Check each statement against what her construction really produces at $A$.`,
        explanation: [
          definition,
          "So a tangent from $P$ touches circle $O$ at a point $T$ with $m\\angle OTP=90^\\circ$, and those points lie on the circle with diameter $\\overline{OP}$.",
          "Ana's circle is centered at $P$, so $PA=PO$ and triangle $PAO$ is isosceles. Its angle at $A$ is a base angle, less than $90^\\circ$, so line $PA$ is not perpendicular to radius $\\overline{OA}$ and crosses the circle again.",
          ...options
            .filter((o) => !o.correct)
            .map((o) => `Not "${o.label}": ${o.feedback}`),
        ],
        scene: constructionScene(
          c,
          0,
          {
            circles: [{ id: "ana", center: c.P, r: c.d }],
            lines: [{ id: "analine", from: a, to: b, stroke: "warm" }],
            points: [{ id: "a", at: A, name: "A", out: A }],
          },
          {
            title:
              "Ana's construction: circle O, point P, the circle with center P through O, its crossing A with circle O, and line PA",
          },
        ),
      };
    }
    if (script === "ben") {
      const [a, b] = through(c.O, c.T, c.r * 0.6, c.r * 0.9);
      const options: ChoiceOption[] = [
        {
          label:
            "Line $OT$ contains a radius; the tangent is the line through $P$ and $T$, perpendicular to $\\overline{OT}$",
          correct: true,
        },
        {
          label:
            "$T$ is wrong; he should use where the helper circle meets line $OP$",
          feedback:
            "The helper circle meets line $OP$ at $O$ and $P$, which are not points of circle $O$. $T$ is right.",
        },
        {
          label: "Line $OT$ is the tangent because $OT$ equals the radius",
          feedback:
            "$OT$ is the radius itself. A tangent is perpendicular to the radius, and line $OT$ passes through the center.",
        },
        {
          label: "He should draw the line through $T$ and $T'$",
          feedback:
            "Line $TT'$ is a chord of circle $O$; it cuts through the circle and misses $P$.",
        },
      ];
      return {
        ...base,
        faulty: { a, b },
        prompt: `Point $P$ is outside circle $O$.${quotedText(c)} Ben constructs the midpoint $M$ of $\\overline{OP}$ and the circle with center $M$ through $O$, marks $T$ where it meets circle $O$, and draws the line through $O$ and $T$ as the tangent. Which statement identifies his error?`,
        options,
        hint: `Ben's construction finds $T$ correctly${c.quoted ? `, with $OT=${c.r}$` : ""}. Check each statement against the line he draws and what a tangent from $P$ must do.`,
        explanation: [
          definition,
          "Ben's $T$ is on the circle with diameter $\\overline{OP}$, so $m\\angle OTP=90^\\circ$: $T$ is a point of tangency.",
          "But line $OT$ passes through the center; it contains the radius. The tangent is line $PT$, which is perpendicular to $\\overline{OT}$ at $T$ and passes through $P$.",
          ...options
            .filter((o) => !o.correct)
            .map((o) => `Not "${o.label}": ${o.feedback}`),
        ],
        scene: constructionScene(
          c,
          3,
          { lines: [{ id: "ben", from: a, to: b, stroke: "warm" }] },
          {
            title:
              "Ben's construction: the circle with center M through O, the points T and T′, and the line through O and T",
          },
        ),
      };
    }
    const [a, b] = through(
      add(c.P, mul(n, -c.r * 1.1)),
      add(c.P, mul(n, c.r * 1.1)),
      0,
      0,
    );
    const options: ChoiceOption[] = [
      {
        label:
          "A tangent is perpendicular to the radius at the point of contact, not to $\\overline{OP}$; her line misses circle $O$",
        correct: true,
      },
      {
        label:
          "Her line is tangent because it is perpendicular to a segment from the center",
        feedback:
          "The segment must be a radius to the point of contact. $\\overline{OP}$ is longer than the radius, and her line never meets the circle.",
      },
      {
        label:
          "She should draw it perpendicular to $\\overline{OP}$ at $O$ instead",
        feedback:
          "That line passes through the center, so it crosses the circle twice and misses $P$.",
      },
      {
        label: "Her line is tangent to circle $O$ at $P$",
        feedback:
          "$P$ is outside circle $O$, so no line touches circle $O$ at $P$.",
      },
    ];
    return {
      ...base,
      faulty: { a, b },
      prompt: `Point $P$ is outside circle $O$.${quotedText(c)} Cara draws the line through $P$ perpendicular to $\\overline{OP}$ as the tangent. Which statement identifies her error?`,
      options,
      hint: `Cara's line meets $\\overline{OP}$ at $P$ at a right angle. Check each statement against where her line lies compared with circle $O$${c.quoted ? `, of radius $${c.r}$` : ""}.`,
      explanation: [
        definition,
        "Every point of Cara's line is at least $OP$ from $O$, and $OP$ is more than the radius. So her line misses circle $O$.",
        "The right angle belongs at the point of contact $T$, between radius $\\overline{OT}$ and the tangent, which is why the construction looks for $T$ with $m\\angle OTP=90^\\circ$.",
        ...options
          .filter((o) => !o.correct)
          .map((o) => `Not "${o.label}": ${o.feedback}`),
      ],
      scene: constructionScene(
        c,
        0,
        { lines: [{ id: "cara", from: a, to: b, stroke: "warm" }] },
        {
          title:
            "Cara's construction: circle O, point P, and the line through P perpendicular to OP",
        },
      ),
    };
  }
  // complete-explanation: one fact is given, choose the other.
  const options: ChoiceOption[] =
    given === "tangent-rule"
      ? [
          { label: RIGHT_ANGLE, correct: true },
          {
            label:
              "$m\\angle TOP=90^\\circ$, because $\\overline{OP}$ is a diameter",
            feedback:
              "The right angle is at $T$, not at $O$; an angle inscribed in a semicircle has its vertex on the circle.",
          },
          {
            label:
              "$PT=PT'$, because the tangent segments from one point are equal",
            feedback:
              "That fact is about tangents, so using it assumes $PT$ is tangent, which is what is being proved.",
          },
          {
            label: "$\\overline{OP}$ bisects $\\angle TPT'$",
            feedback:
              "True by symmetry, but it says nothing about the angle between $PT$ and the radius $\\overline{OT}$.",
          },
        ]
      : [
          { label: TANGENT_RULE, correct: true },
          {
            label:
              "$PT=PT'$, because the tangent segments from one point are equal",
            feedback:
              "That fact is about tangents, so using it assumes $PT$ is tangent, which is what is being proved.",
          },
          {
            label: "$M$ is the same distance from $O$, $P$ and $T$",
            feedback:
              "True, but it only says $T$ is on the circle with diameter $\\overline{OP}$, which the given fact already used. It does not connect the right angle to tangency.",
          },
          {
            label:
              "A line through a point outside a circle meets the circle at most once",
            feedback:
              "False: a line from $P$ through the circle's interior meets it twice.",
          },
        ];
  const shown = given === "tangent-rule" ? TANGENT_RULE : RIGHT_ANGLE;
  return {
    ...base,
    prompt: `${intro} A complete justification that line $PT$ is tangent to circle $O$ needs two facts. One is: "${shown}." Which is the other?`,
    options,
    hint:
      given === "tangent-rule"
        ? `The quoted fact is a rule about lines and radii. For each other statement, ask whether it is true and whether it supplies what that rule needs for line $PT$ and radius $\\overline{OT}$.${c.quoted ? ` Here $OT=${c.r}$ and $OP=${c.d}$.` : ""}`
        : `The quoted fact gives $m\\angle OTP=90^\\circ$. For each other statement, ask whether it is true and whether it finishes the argument that line $PT$ is tangent.${c.quoted ? ` The radius is $${c.r}$.` : ""}`,
    explanation: [
      definition,
      `Fact 1: ${RIGHT_ANGLE}.`,
      `Fact 2: ${TANGENT_RULE}. Since $\\overline{OT}$ is a radius and $PT\\perp\\overline{OT}$ at $T$, line $PT$ is tangent.`,
      ...lengthsLine(c),
      ...options
        .filter((o) => !o.correct)
        .map((o) => `Not "${o.label}": ${o.feedback}`),
    ],
    scene: constructionScene(c, 4, {}, { lengths: c.quoted }),
  };
}

const justifyFamily = chainFamily({
  template: tangentConstructionReasoningTemplates[1]!,
  axes: {
    ask: defineAxis(
      "ask",
      [
        "reason-for-step",
        "reason-tangent",
        "find-flaw",
        "complete-explanation",
      ] as const,
      { weights: [6, 6, 5, 3] },
    ),
    lengths: defineAxis("lengths", ["none", "quoted"] as const),
  },
  model: (r, axes) => justifyCase(r, axes.ask, axes.lengths === "quoted"),
  render: (m, _axes, r) => {
    const surface = choiceSurface(r, {
      prompt: m.prompt,
      options: m.options,
      hint: m.hint,
      explanation: m.explanation,
    });
    return surface && { ...surface, figure: sceneFigure(m.scene) };
  },
  variant: (m) =>
    m.ask === "find-flaw"
      ? `find-flaw-${m.script}`
      : m.ask === "complete-explanation"
        ? `complete-explanation-${m.given}`
        : m.ask,
});

export const tangentConstructionReasoningGenerate = dispatch(
  tangentConstructionReasoningTemplates,
  {
    "tangent-construct-steps": (seed) => stepsFamily.generate(seed).problem,
    "tangent-construct-justify": (seed) => justifyFamily.generate(seed).problem,
  },
);
export const tangentConstructionReasoningCases = {
  "tangent-construct-steps": stepsFamily.generate,
  "tangent-construct-justify": justifyFamily.generate,
};
