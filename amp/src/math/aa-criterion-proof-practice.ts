import type { TemplateMetadata } from "./contracts";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  gcd,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { shuffle } from "./distribution-practice";
import {
  figureAngleMark,
  figureScene,
  sceneFigure,
} from "./geometry-teaching-figures";
import {
  extentOf,
  placeLabels,
  strokesOf,
  type LabelSpec,
} from "./parallelogram-proof-kit";
import { relabel } from "./parallelogram-proof-practice";
import type { Element, Point, Scene } from "./scene/spec";
import {
  gradeStructuredWork,
  gradingFits,
  normalizeStructuredWork,
  structuralProblem,
  type StructuredWorkResponse,
  type WorkBank,
  type WorkField,
  type WorkGrading,
  type WorkRow,
} from "./structured-work";
import { defineAxis, type Random } from "./variation/axes";
import type { Surface } from "./variation/compose";

/**
 * Establishing the AA criterion from similarity transformations
 * (HSG.SRT.A.3). Given ∠A ≅ ∠D and ∠B ≅ ∠E, a dilation about A by
 * k = DE/AB makes AB′ = DE; ASA then gives a rigid motion from △AB′C′ onto
 * △DEF, and the dilation followed by that rigid motion maps △ABC onto
 * △DEF. Learners build or justify that proof (or its rigid-motion-first
 * twin), name the property behind one step, and find the flaw in an
 * argument. Text is written with role letters A–F and relabeled per seed;
 * D, E and F are the vertices matching A, B and C.
 */

const work = "structured-work-v1" as const;
export const aaCriterionTemplates: readonly TemplateMetadata[] = [
  {
    id: "aa-criterion-proof-build",
    version: 1,
    title: "Prove the AA criterion with a dilation and a rigid motion",
    skillId: "similarity-proofs",
    gradeBand: "9–12",
    difficultyOffset: 0.5,
    requiredResponseCapability: work,
    requiredFigureCapability: "scenes-v1",
    description:
      "Prove that two pairs of congruent angles make two triangles similar, using only transformations: dilate one triangle so the side between the angles matches, then ASA gives a rigid motion. Choose the reasons for a given proof (dilation first, or rigid motions first and then a dilation), or build the proof from statement and reason banks with circular, false-property, wrong-criterion and wrong-pair distractors.",
  },
  {
    id: "aa-criterion-step-reason",
    version: 1,
    title: "Name the transformation property behind an AA proof step",
    skillId: "similarity-proofs",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    requiredResponseCapability: "single-choice-v1",
    requiredFigureCapability: "scenes-v1",
    description:
      "Choose the property of similarity transformations that justifies one step of the proof of the AA criterion: angles kept by a dilation, the choice of scale factor, ASA for the image, composing a dilation with a rigid motion, lines through the center, why two angles suffice, why AA is not congruence, and the rigid-motion-first ray argument.",
  },
  {
    id: "aa-criterion-argument-check",
    version: 1,
    title: "Find the flaw in an argument for the AA criterion",
    skillId: "similarity-proofs",
    gradeBand: "9–12",
    difficultyOffset: 0.5,
    requiredResponseCapability: "single-choice-v1",
    requiredFigureCapability: "scenes-v1",
    description:
      "Find the first flawed sentence in a student's argument that two pairs of congruent angles make triangles similar (circular reasoning, no dilation, lengths kept, wrong criterion, AA used for congruence, wrong pair, angles scaled), or choose the one complete argument among four.",
  },
];

/* --------------------------------------------------------------- setup */

const firstSets = [
  ["A", "B", "C"],
  ["J", "K", "L"],
  ["M", "N", "P"],
] as const;
const secondSets = [
  ["D", "E", "F"],
  ["P", "Q", "R"],
  ["X", "Y", "Z"],
  ["R", "S", "T"],
] as const;
const scales: [number, number][] = [
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 3],
  [3, 2],
  [2, 1],
  [5, 2],
  [3, 1],
];

export interface Setup {
  first: readonly [string, string, string];
  second: readonly [string, string, string];
  /** ∠A ↔ the second triangle's second vertex, ∠B ↔ its first. */
  swapped: boolean;
  alpha: number;
  beta: number;
  gamma: number;
  ab: number;
  k: [number, number];
  de: number;
  rotate: number;
  reflect: boolean;
}

export function drawSetup(r: Random): Setup {
  let first: readonly [string, string, string];
  let second: readonly [string, string, string];
  do {
    first = pick(r, firstSets);
    second = pick(r, secondSets);
  } while (first.some((x) => second.includes(x)));
  const swapped = r(1, 10) <= 3;
  let alpha = 0,
    beta = 0,
    gamma = 0;
  do {
    alpha = r(30, 110);
    beta = r(30, 110);
    gamma = 180 - alpha - beta;
  } while (alpha === beta || gamma < 30 || gamma === alpha || gamma === beta);
  const k = pick(r, scales);
  const sides = Array.from({ length: 9 }, (_, i) => i + 4).filter(
    (ab) => (ab * k[0]) % k[1] === 0 && (ab * k[0]) / k[1] <= 24,
  );
  const ab = pick(r, sides);
  return {
    first,
    second,
    swapped,
    alpha,
    beta,
    gamma,
    ab,
    k,
    de: (ab * k[0]) / k[1],
    rotate: 15 * r(2, 22),
    reflect: r(0, 1) === 1,
  };
}

/** Role letter → printed letter. D, E, F are the vertices matching A, B, C. */
export function lettersOf(s: Setup): Record<string, string> {
  const [d, e, f] = s.second;
  return {
    A: s.first[0],
    B: s.first[1],
    C: s.first[2],
    D: s.swapped ? e : d,
    E: s.swapped ? d : e,
    F: f,
  };
}
const kTex = (s: Setup) =>
  s.k[1] === 1 ? `${s.k[0]}` : `\\frac{${s.k[0]}}{${s.k[1]}}`;
/** "\frac{12}{8}=\frac{3}{2}", or one fraction when DE/AB is in lowest terms. */
const ratioTex = (s: Setup) => {
  const g = gcd(s.de, s.ab);
  return g === 1 && s.ab !== 1
    ? `\\frac{${s.de}}{${s.ab}}`
    : `\\frac{${s.de}}{${s.ab}}=${kTex(s)}`;
};

/* -------------------------------------------------------------- figure */

type State = "setup" | "dilated" | "rays" | "rigid";
const rad = (d: number) => (d * Math.PI) / 180;
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const scaleAbout = (c: Point, p: Point, k: number): Point => [
  c[0] + (p[0] - c[0]) * k,
  c[1] + (p[1] - c[1]) * k,
];

/** Role coordinates: △ABC with AB along the x axis, its dilation image
 * about A, △DEF (turned and maybe flipped) to its right, and the rigid
 * copy of △ABC with A on D and B on ray DE. */
export function setupPoints(s: Setup) {
  const k = s.k[0] / s.k[1];
  const ac = (s.ab * Math.sin(rad(s.beta))) / Math.sin(rad(s.gamma));
  const S = 6 / Math.max(s.ab, s.de);
  const A: Point = [0, 0];
  const B: Point = [s.ab * S, 0];
  const C: Point = [
    ac * S * Math.cos(rad(s.alpha)),
    ac * S * Math.sin(rad(s.alpha)),
  ];
  const B1 = scaleAbout(A, B, k);
  const C1 = scaleAbout(A, C, k);
  const raw: Point[] = [
    [0, 0],
    [s.de * S, 0],
    [k * C[0], k * C[1]],
  ];
  const turn = (p: Point): Point => {
    const q: Point = s.reflect ? [p[0], -p[1]] : p;
    const c = Math.cos(rad(s.rotate)),
      n = Math.sin(rad(s.rotate));
    return [q[0] * c - q[1] * n, q[0] * n + q[1] * c];
  };
  const moved = raw.map(turn);
  const left = [A, B, C, B1, C1];
  const maxX = Math.max(...left.map((p) => p[0]));
  const midY =
    (Math.max(...left.map((p) => p[1])) + Math.min(...left.map((p) => p[1]))) /
    2;
  const minX2 = Math.min(...moved.map((p) => p[0]));
  const midY2 =
    (Math.max(...moved.map((p) => p[1])) +
      Math.min(...moved.map((p) => p[1]))) /
    2;
  const shift: Point = [maxX + 1.8 - minX2, midY - midY2];
  const [D, E, F] = moved.map(
    (p) => [p[0] + shift[0], p[1] + shift[1]] as Point,
  ) as [Point, Point, Point];
  const B2 = scaleAbout(D, E, 1 / k);
  const C2 = scaleAbout(D, F, 1 / k);
  return { A, B, C, B1, C1, D, E, F, B2, C2 };
}

function aaFigure(s: Setup, state: State): Scene {
  const P = setupPoints(s);
  const L = lettersOf(s);
  const els: Element[] = [];
  const minSide = (a: Point, b: Point, c: Point) =>
    Math.min(
      Math.hypot(...sub(a, b)),
      Math.hypot(...sub(b, c)),
      Math.hypot(...sub(c, a)),
    );
  const centroid = (a: Point, b: Point, c: Point): Point => [
    (a[0] + b[0] + c[0]) / 3,
    (a[1] + b[1] + c[1]) / 3,
  ];
  const tri = (
    id: string,
    pts: [Point, Point, Point],
    stroke: "accent" | "warm" | "gold",
    dash = false,
  ): Element => ({
    type: "polygon",
    id,
    points: pts,
    fill: "none",
    stroke,
    width: dash ? 1.75 : 2.25,
    ...(dash ? { dash: "dash" as const } : {}),
  });
  if (state === "rays") {
    const far = (p: Point, q: Point) => {
      const t = Math.max(Math.hypot(...p), Math.hypot(...q)) * 1.15;
      const u = Math.hypot(...p);
      return [(p[0] / u) * t, (p[1] / u) * t] as Point;
    };
    const ray = (id: string, to: Point): Element => ({
      type: "segment",
      id,
      from: P.A,
      to,
      stroke: "muted",
      width: 1.5,
      dash: "dash",
      arrow: "end",
    });
    els.push(ray("ray1", far(P.B, P.B1)), ray("ray2", far(P.C, P.C1)));
  }
  els.push(tri("abc", [P.A, P.B, P.C], "accent"));
  els.push(tri("def", [P.D, P.E, P.F], "warm"));
  if (state === "dilated" || state === "rays")
    els.push(tri("img", [P.A, P.B1, P.C1], "gold", true));
  if (state === "rigid") els.push(tri("copy", [P.D, P.B2, P.C2], "gold", true));
  const r1 = Math.min(0.6, Math.max(0.3, 0.22 * minSide(P.A, P.B, P.C)));
  const r2 = Math.min(0.6, Math.max(0.3, 0.22 * minSide(P.D, P.E, P.F)));
  els.push(
    ...figureAngleMark("aA", P.A, P.B, P.C, {
      arcs: 1,
      r: r1,
      stroke: "accent",
    }),
    ...figureAngleMark("aB", P.B, P.C, P.A, {
      arcs: 2,
      r: r1,
      stroke: "accent",
    }),
    ...figureAngleMark("aD", P.D, P.E, P.F, { arcs: 1, r: r2, stroke: "warm" }),
    ...figureAngleMark("aE", P.E, P.F, P.D, { arcs: 2, r: r2, stroke: "warm" }),
  );
  const g1 = centroid(P.A, P.B, P.C);
  const g2 = centroid(P.D, P.E, P.F);
  // Vertex names point away from their triangle; each label then takes the
  // nearest spot clear of every stroke, arc and label (placeLabels).
  const name = (id: string, text: string, at: Point, g: Point): LabelSpec => ({
    id,
    text,
    at,
    out: sub(at, g),
    bold: true,
  });
  const names: LabelSpec[] = [
    name("nA", L.A!, P.A, g1),
    name("nB", L.B!, P.B, g1),
    name("nC", L.C!, P.C, g1),
    name("nD", L.D!, P.D, g2),
    name("nE", L.E!, P.E, g2),
    name("nF", L.F!, P.F, g2),
  ];
  const drawn: Point[] = [P.A, P.B, P.C, P.D, P.E, P.F];
  if (state === "dilated" || state === "rays") {
    const g = centroid(P.A, P.B1, P.C1);
    names.push(
      name("nB1", `${L.B}′`, P.B1, g),
      name("nC1", `${L.C}′`, P.C1, g),
    );
    drawn.push(P.B1, P.C1);
  }
  if (state === "rigid") {
    const g = centroid(P.D, P.B2, P.C2);
    names.push(
      name("nB2", `${L.B}″`, P.B2, g),
      name("nC2", `${L.C}″`, P.C2, g),
    );
    drawn.push(P.B2, P.C2);
  }
  const sideLabel = (
    id: string,
    a: Point,
    b: Point,
    g: Point,
    text: string,
    t: number,
  ): LabelSpec => {
    const p: Point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const d = sub(b, a);
    let n: Point = [-d[1], d[0]];
    if (n[0] * (p[0] - g[0]) + n[1] * (p[1] - g[1]) < 0) n = [-n[0], -n[1]];
    return { id, text, at: p, out: n, halo: true };
  };
  els.push(
    ...placeLabels(
      [
        ...names,
        sideLabel("lAB", P.A, P.B, g1, `${s.ab}`, 0.3),
        sideLabel("lDE", P.D, P.E, g2, `${s.de}`, 0.5),
      ],
      strokesOf(els),
      extentOf(drawn),
    ),
  );
  const note =
    state === "dilated"
      ? `Dashed: the image ${L.A}${L.B}′${L.C}′ of a dilation about ${L.A}.`
      : state === "rays"
        ? `Dashed: the image ${L.A}${L.B}′${L.C}′ of a dilation about ${L.A}, and rays from ${L.A} through ${L.B} and ${L.C}.`
        : state === "rigid"
          ? `Dashed: a copy ${L.D}${L.B}″${L.C}″ of triangle ${L.A}${L.B}${L.C} moved by rigid motions so ${L.A} is on ${L.D}.`
          : undefined;
  return figureScene(
    `Triangle ${L.A}${L.B}${L.C} with ${L.A}${L.B} = ${s.ab} and triangle ${L.D}${L.E}${L.F} with ${L.D}${L.E} = ${s.de}; one arc at ${L.A} and ${L.D}, two arcs at ${L.B} and ${L.E}`,
    els,
    note,
  );
}

/* ------------------------------------------------------- proof (type 1) */

const REASONS = {
  r1: "A dilation multiplies every length by its scale factor",
  r2: "Dilations preserve angle measure",
  r3: "Given, with the transitive property of congruence",
  r4: "ASA: two angles and the included side",
  r5: "Definition of congruence: a rigid motion maps one figure onto the other",
  r6: "Definition of similarity: rigid motions and dilations map one figure onto the other",
  r7: "A dilation maps every line through its center to itself",
  angle: "Rigid motions and dilations preserve angle measure, with the given",
  r9: "Two different lines meet in at most one point",
  d1: "Corresponding sides of similar triangles are proportional",
  d2: "AA similarity",
  d3: "Dilations preserve length",
  d4: "SAS congruence",
  d5: "CPCTC (corresponding parts of congruent triangles)",
  d6: "Dilations multiply angle measures by the scale factor",
  d7: "Congruent triangles are similar",
  d8: "The angles of a triangle add to $180^\\circ$",
} as const;
type ReasonKey = keyof typeof REASONS;
const DISTRACTOR_WHY: Partial<Record<ReasonKey, string>> = {
  d1: "Proportional sides follow from similarity, the conclusion, so citing them is circular.",
  d2: "AA is the criterion being proved, so it cannot be a reason in its own proof.",
  d3: "Dilations do not preserve length; they multiply every length by $k$.",
  d4: "SAS needs two pairs of congruent sides, and only one pair is known.",
  d5: "CPCTC follows from a congruence; it does not establish one.",
  d6: "Dilations do not change angle measures.",
  d7: "It would only make $\\triangle AB'C'$ similar to $\\triangle DEF$, which says nothing about $\\triangle ABC$ until the dilation is composed with the rigid motion.",
  d8: "True of every triangle, but no line of this proof follows from it.",
};

type Claim = Partial<Record<ReasonKey, string[][]>>;
interface Line {
  key: string;
  tex: string;
  claim: Claim;
}
export type AaProof = "dilate-first" | "rigid-first";
interface ProofPlan {
  lines: Line[];
  path: [string, ReasonKey][];
  /** Statements that are false for every setup (build mode). */
  wrong: Line[];
  why: Record<string, string>;
}

const plans: Record<AaProof, ProofPlan> = {
  "dilate-first": {
    lines: [
      { key: "len", tex: "$AB'=k\\cdot AB=DE$", claim: { r1: [[]] } },
      {
        key: "keep",
        tex: "$\\angle B'AC'\\cong\\angle BAC$ and $\\angle AB'C'\\cong\\angle ABC$",
        claim: { r2: [[]] },
      },
      {
        key: "trans",
        tex: "$\\angle B'AC'\\cong\\angle D$ and $\\angle AB'C'\\cong\\angle E$",
        claim: { r3: [["keep"]] },
      },
      {
        key: "cong",
        tex: "$\\triangle AB'C'\\cong\\triangle DEF$",
        claim: { r4: [["len", "trans"]] },
      },
      {
        key: "rigid",
        tex: "A rigid motion maps $\\triangle AB'C'$ onto $\\triangle DEF$",
        claim: { r5: [["cong"]] },
      },
      {
        key: "sim",
        tex: "$\\triangle ABC\\sim\\triangle DEF$",
        claim: { r6: [["rigid"]] },
      },
    ],
    path: [
      ["len", "r1"],
      ["keep", "r2"],
      ["trans", "r3"],
      ["cong", "r4"],
      ["rigid", "r5"],
      ["sim", "r6"],
    ],
    wrong: [
      { key: "w1", tex: "$AB'=AB$ and $B'C'=BC$", claim: {} },
      { key: "w2", tex: "$m\\angle AB'C'=k\\cdot m\\angle ABC$", claim: {} },
    ],
    why: {
      len: "The dilation multiplies every length by $k$, and $k$ was chosen as $\\frac{DE}{AB}$.",
      keep: "A dilation keeps every angle measure.",
      trans:
        "Each angle of the image is congruent to an angle of $\\triangle ABC$, which is congruent to the matching angle of $\\triangle DEF$ by the givens.",
      cong: "Two pairs of congruent angles with the congruent sides $AB'$ and $DE$ between them: ASA.",
      rigid:
        "Congruent figures are exactly those that a rigid motion maps onto each other.",
      sim: "The dilation followed by the rigid motion maps $\\triangle ABC$ onto $\\triangle DEF$, and such a composition is a similarity transformation.",
    },
  },
  "rigid-first": {
    lines: [
      {
        key: "ray1",
        tex: "Ray $DC''$ lies along ray $DF$",
        claim: { angle: [[]] },
      },
      {
        key: "onray",
        tex: "$B'''$ lies on ray $DE$, and $C'''$ lies on ray $DF$",
        claim: { r7: [["ray1"]] },
      },
      {
        key: "land",
        tex: "$DB'''=k\\cdot DB''=DE$, so $B'''=E$",
        claim: { r1: [["onray"]] },
      },
      {
        key: "ray2",
        tex: "Ray $EC'''$ lies along ray $EF$",
        claim: { angle: [["land", "onray"]] },
      },
      { key: "pt", tex: "$C'''=F$", claim: { r9: [["onray", "ray2"]] } },
      {
        key: "sim",
        tex: "$\\triangle ABC\\sim\\triangle DEF$",
        claim: { r6: [["land", "pt"]] },
      },
    ],
    path: [
      ["ray1", "angle"],
      ["onray", "r7"],
      ["land", "r1"],
      ["ray2", "angle"],
      ["pt", "r9"],
      ["sim", "r6"],
    ],
    wrong: [],
    why: {
      ray1: "The rigid motions keep $\\angle A$, which is congruent to $\\angle D$, and the image of $C$ is on the same side of line $DE$ as $F$; so the image of ray $AC$ is ray $DF$.",
      onray:
        "The dilation is about $D$, so it maps line $DE$ and line $DF$ to themselves, and points on a ray from $D$ stay on that ray.",
      land: "The dilation multiplies $DB''=AB$ by $k=\\frac{DE}{AB}$, so $B'''$ is the point of ray $DE$ at distance $DE$ from $D$: the point $E$.",
      ray2: "Both transformations keep $\\angle B$, which is congruent to $\\angle E$, so the image of the angle at $B$ fits on the angle at $E$.",
      pt: "$C'''$ lies on line $DF$ and on line $EF$, and those different lines meet only at $F$.",
      sim: "Rigid motions followed by a dilation map $A$ to $D$, $B$ to $E$ and $C$ to $F$, and such a composition is a similarity transformation.",
    },
  },
};

function checked(
  response: StructuredWorkResponse,
  grading: WorkGrading,
  answer: string,
) {
  const problem = structuralProblem(response);
  if (problem) throw new Error(problem);
  if (!gradingFits(response, grading)) throw new Error("Rule does not fit");
  if (normalizeStructuredWork(response, answer) !== answer)
    throw new Error(`Answer key is not canonical: ${answer}`);
  if (!gradeStructuredWork(response, grading, answer))
    throw new Error(`Answer key is not credited: ${answer}`);
  return { response, workGrading: grading, answer };
}

type Variant =
  "reasons-dilate-first" | "build-dilate-first" | "reasons-rigid-first";

/** Three distractors: a false property, a circular reason and one more
 * (SAS whenever the ASA line is the learner's). */
function distractors(r: Random, sasBlank: boolean): ReasonKey[] {
  const falseProperty = pick(r, ["d3", "d6"] as const);
  const circular = pick(r, ["d1", "d2"] as const);
  const third: ReasonKey = sasBlank
    ? "d4"
    : pick(r, ["d4", "d5", "d7", "d8"] as const);
  return [falseProperty, circular, third];
}

function proofRender(r: Random, s: Setup, variant: Variant): Surface {
  const L = lettersOf(s);
  const proof: AaProof =
    variant === "reasons-rigid-first" ? "rigid-first" : "dilate-first";
  const plan = plans[proof];
  const build = variant === "build-dilate-first";
  const extra = build ? plan.wrong : [];
  const statements = shuffle(r, [...plan.lines, ...extra]);
  const sid = new Map(
    statements.map((x, i) => [x.key, `s${"abcdefghijkl"[i]}`]),
  );
  // Fill-ins: the dilate-first proof leaves rows 2, 3, 5, 7 and one of 4, 6
  // blank; the rigid-first proof rows 2, 3, 4, 6 and one of 5, 7 (rows
  // numbered from the construction, the proof's row 1).
  const blank = new Set<number>(
    proof === "dilate-first"
      ? [0, 1, 3, 5, pick(r, [2, 4])]
      : [0, 1, 2, 4, pick(r, [3, 5])],
  );
  const wrongReasons = distractors(r, proof === "dilate-first");
  const reasonKeys = shuffle(r, [
    ...new Set([...plan.path.map(([, k]) => k), ...wrongReasons]),
  ]);
  const rid = new Map(reasonKeys.map((k, i) => [k, `r${"abcdefghijkl"[i]}`]));
  const claims: Record<string, Record<string, string[][]>> = {};
  for (const line of plan.lines) {
    const by: Record<string, string[][]> = {};
    for (const [reason, sets] of Object.entries(line.claim) as [
      ReasonKey,
      string[][],
    ][])
      if (rid.has(reason))
        by[rid.get(reason)!] = sets.map((set) => set.map((k) => sid.get(k)!));
    claims[sid.get(line.key)!] = by;
  }
  const banks: WorkBank[] = [
    {
      id: "statements",
      label: "Statement",
      options: statements.map((x) => ({
        id: sid.get(x.key)!,
        label: relabel(x.tex, L),
      })),
    },
    {
      id: "reasons",
      label: "Reason",
      options: reasonKeys.map((k) => ({ id: rid.get(k)!, label: REASONS[k] })),
    },
  ];
  const field = (
    bank: "statements" | "reasons",
    given?: string,
  ): WorkField => ({
    kind: "choice",
    label: bank === "statements" ? "Statement" : "Reason",
    bank,
    ...(given !== undefined ? { given } : {}),
  });
  const rows: WorkRow[] = plan.path.map(([st, reason], i) => ({
    id: `r${i + 1}`,
    fields: build
      ? [field("statements"), field("reasons")]
      : [
          field("statements", sid.get(st)!),
          blank.has(i) ? field("reasons") : field("reasons", rid.get(reason)!),
        ],
  }));
  const answer = JSON.stringify(
    plan.path.map(([st, reason], i) =>
      build
        ? [sid.get(st)!, rid.get(reason)!]
        : ["", blank.has(i) ? rid.get(reason)! : ""],
    ),
  );
  const built = checked(
    {
      kind: "structured-work",
      label: "Your proof",
      layout: "proof",
      mode: build ? "build" : "fill",
      goal: relabel("$\\triangle ABC\\sim\\triangle DEF$", L),
      banks,
      rows,
    },
    { mode: "proof", goal: sid.get("sim")!, claims },
    answer,
  );
  const k = kTex(s);
  const given = `Given: $\\angle A\\cong\\angle D$ and $\\angle B\\cong\\angle E$, with $AB=${s.ab}$ and $DE=${s.de}$. Prove: $\\triangle ABC\\sim\\triangle DEF$, using only transformations and their properties.`;
  const construction =
    proof === "dilate-first"
      ? `The proof's first step, the construction: let $k=\\frac{DE}{AB}=${ratioTex(s)}$, and dilate $\\triangle ABC$ about center $A$ by the scale factor $k$; call the image $\\triangle AB'C'$.`
      : `The proof's first step, the construction: translate $\\triangle ABC$ so $A$ lands on $D$, rotate it about $D$ so the image of ray $AB$ lies along ray $DE$, and reflect it over line $DE$ if needed so the image of $C$ is on the same side as $F$; call the image $\\triangle DB''C''$. Then dilate $\\triangle DB''C''$ about $D$ by $k=\\frac{DE}{DB''}=${ratioTex(s)}$; call the image $\\triangle DB'''C'''$.`;
  const task = build
    ? "Build the rest of the proof: choose a statement and a reason for each line."
    : "The statements of the rest of the proof are shown. Choose the reason for each blank line.";
  const lines = plan.path.map(
    ([st, reason], i) =>
      `${i + 1}. ${plan.lines.find((x) => x.key === st)!.tex} — ${REASONS[reason]}.`,
  );
  const wrongWhy = wrongReasons.map(
    (key) => `“${REASONS[key]}”: ${DISTRACTOR_WHY[key]}`,
  );
  const explanation =
    proof === "dilate-first"
      ? [
          "The givens are two pairs of congruent angles. Side $\\overline{AB}$ lies between the angles at $A$ and $B$, and $\\overline{DE}$ between the angles at $D$ and $E$. The goal is a transformation that maps $\\triangle ABC$ onto $\\triangle DEF$.",
          `A rigid motion cannot change $AB=${s.ab}$ into $DE=${s.de}$, but a dilation can: with $k=${k}$, $AB'=${k}\\cdot ${s.ab}=${s.de}=DE$. Lengths are multiplied by $k$, and angles do not change.`,
          "Now $\\triangle AB'C'$ and $\\triangle DEF$ have two pairs of congruent angles and the congruent sides between them, so ASA makes them congruent, and by definition a rigid motion maps one onto the other.",
          "A dilation followed by a rigid motion is a similarity transformation, and this one maps $\\triangle ABC$ onto $\\triangle DEF$. So $\\triangle ABC\\sim\\triangle DEF$.",
          ...wrongWhy,
          "A complete proof, after the construction:",
          ...lines,
        ]
      : [
          `Rigid motions put $A$ on $D$ and $B$ on ray $DE$ but keep $AB=${s.ab}$, so they cannot reach $E$ with $DE=${s.de}$. A dilation about $D$ by $k=${k}$ finishes the job.`,
          "Angles are kept by both kinds of transformation, so the copy's angle at $D$ lies along $\\angle D$, and after the dilation its angle at $E$ lies along $\\angle E$.",
          "Lengths are multiplied by $k$, which puts $B'''$ exactly on $E$. Then $C'''$ is on line $DF$ and on line $EF$, and two different lines meet in only one point, $F$.",
          "Rigid motions followed by a dilation map $\\triangle ABC$ onto $\\triangle DEF$, so $\\triangle ABC\\sim\\triangle DEF$. Saying $DC'''=k\\cdot AC=DF$ instead would assume $\\frac{DF}{AC}=k$, a proportion that only the similarity gives.",
          ...wrongWhy,
          "A complete proof, after the construction:",
          ...lines,
        ];
  return {
    prompt: relabel(`Use the figure. ${given} ${construction} ${task}`, L),
    response: built.response,
    answer: built.answer,
    workGrading: built.workGrading,
    hint: relabel(
      proof === "dilate-first"
        ? `A rigid motion keeps $AB=${s.ab}$, so it cannot make it $DE=${s.de}$. Which transformation can change that length, and what does it leave unchanged?`
        : `The rigid motions keep $AB=${s.ab}$, so $B''$ is not yet $E$ when $DE=${s.de}$. Which property of the dilation about $D$ keeps points on rays from $D$, and which multiplies lengths?`,
      L,
    ),
    explanation: explanation.map((x) => relabel(x, L)),
    figure: sceneFigure(
      aaFigure(s, proof === "dilate-first" ? "dilated" : "rigid"),
    ),
  };
}

/* ------------------------------------------------- step reason (type 2) */

type Step =
  | "angle-kept"
  | "why-k"
  | "why-congruent"
  | "why-similar"
  | "on-ray"
  | "two-not-three"
  | "not-congruence"
  | "rigid-first-ray";
const steps: Step[] = [
  "angle-kept",
  "why-k",
  "why-congruent",
  "why-similar",
  "on-ray",
  "two-not-three",
  "not-congruence",
  "rigid-first-ray",
];

interface StepCase {
  step: string;
  ask: string;
  state: State;
  correct: string;
  wrong: [string, string][];
  hint: string;
  why: string;
}
function stepCase(s: Setup, step: Step): StepCase {
  const k = kTex(s);
  const ask = "Which statement justifies this step?";
  switch (step) {
    case "angle-kept":
      return {
        step: `After the dilation about $A$ by $k=${k}$, $m\\angle AB'C'=m\\angle ABC=${s.beta}^\\circ$.`,
        ask,
        state: "dilated",
        correct: "Dilations preserve angle measure.",
        wrong: [
          [
            `The dilation multiplies every length by $${k}$.`,
            "That property is true, but it is about lengths, and this step is about an angle.",
          ],
          [
            "$\\triangle AB'C'\\sim\\triangle ABC$ by AA.",
            "AA is the criterion being proved, so it cannot justify a step of its own proof.",
          ],
          [
            `Dilations multiply each angle measure by $${k}$.`,
            "Dilations do not change angle measures; this step says the angle stays the same.",
          ],
        ],
        hint: `The step says the angle at $B'$ still measures $${s.beta}^\\circ$ after the dilation by $${k}$. Is that a fact about lengths, angles or positions?`,
        why: "A dilation keeps the shape of every angle, so the image of $\\angle ABC$ has the same measure.",
      };
    case "why-k":
      return {
        step: `The proof chose $k=\\frac{DE}{AB}=${ratioTex(s)}$.`,
        ask: "Why this scale factor?",
        state: "setup",
        correct:
          "So that $AB'=k\\cdot AB=DE$: the congruent side between the angles that ASA needs.",
        wrong: [
          [
            "So that the dilation enlarges, since a scale factor must be greater than 1.",
            "A scale factor may be less than 1; $k$ is chosen so that $AB'$ equals $DE$, whether the triangle grows or shrinks.",
          ],
          [
            "So that the angles of $\\triangle ABC$ become the angles of $\\triangle DEF$.",
            "The angles already match by the givens, and a dilation does not change angles.",
          ],
          [
            "So that $k$ is a whole number, which a dilation requires.",
            "A dilation may have any positive scale factor, whole or not.",
          ],
        ],
        hint: `With $AB=${s.ab}$ and $DE=${s.de}$, multiply $AB$ by the chosen $k$. Which length of the image does that give, and which part of the congruence with $\\triangle DEF$ does it provide?`,
        why: "With that $k$ the image side $AB'$ equals $DE$, the side between the two pairs of congruent angles.",
      };
    case "why-congruent":
      return {
        step: "$\\triangle AB'C'\\cong\\triangle DEF$.",
        ask,
        state: "dilated",
        correct:
          "ASA: $\\angle B'AC'\\cong\\angle D$, $AB'=DE$ and $\\angle AB'C'\\cong\\angle E$.",
        wrong: [
          [
            "SAS: $AB'=DE$ and $\\angle B'AC'\\cong\\angle D$.",
            "SAS needs two pairs of congruent sides; only $AB'=DE$ is known.",
          ],
          [
            "AA: two pairs of angles are congruent.",
            "AA is the criterion being proved, and it gives similarity, not congruence.",
          ],
          [
            "SSS: a dilation keeps all three sides in proportion.",
            "SSS needs three pairs of congruent sides; only $AB'$ and $DE$ are known to be equal.",
          ],
        ],
        hint: `After the dilation by $${k}$, $AB'=${s.de}=DE$. Which congruent parts of $\\triangle AB'C'$ and $\\triangle DEF$ are known, and in what order do they sit?`,
        why: "The angles at $A$ and $B'$ match the angles at $D$ and $E$, and the side between them matches: angle, side, angle.",
      };
    case "why-similar":
      return {
        step: "Therefore $\\triangle ABC\\sim\\triangle DEF$.",
        ask,
        state: "dilated",
        correct:
          "A dilation followed by a rigid motion maps $\\triangle ABC$ onto $\\triangle DEF$.",
        wrong: [
          [
            "Congruent triangles are similar, and $\\triangle AB'C'\\cong\\triangle DEF$.",
            "That makes $\\triangle AB'C'$ similar to $\\triangle DEF$; it says nothing about $\\triangle ABC$ until the dilation is composed with the rigid motion.",
          ],
          [
            "Corresponding sides of $\\triangle ABC$ and $\\triangle DEF$ are proportional.",
            "Proportional sides are a consequence of the similarity, which is not proved yet.",
          ],
          [
            "The angles of $\\triangle ABC$ add to $180^\\circ$.",
            "True of every triangle; it does not map $\\triangle ABC$ onto $\\triangle DEF$.",
          ],
        ],
        hint: `The dilation by $${k}$ turned $AB=${s.ab}$ into $AB'=${s.de}$, and a rigid motion took $\\triangle AB'C'$ to $\\triangle DEF$. What does the definition of similarity ask for?`,
        why: "Two figures are similar when a sequence of rigid motions and dilations maps one onto the other. The dilation and then the rigid motion is such a sequence.",
      };
    case "on-ray":
      return {
        step: "After the dilation about $A$, $B'$ lies on ray $AB$ and $C'$ lies on ray $AC$.",
        ask,
        state: "rays",
        correct:
          "A dilation maps every line through its center to itself, so each image stays on its ray from $A$.",
        wrong: [
          [
            "A dilation maps each line to a different line parallel to it.",
            "That holds only for lines that miss the center; a line through the center maps to itself.",
          ],
          [
            "Rigid motions preserve distance.",
            "No rigid motion has been used yet, and distance does not place a point on a ray.",
          ],
          [
            "Because $\\angle A\\cong\\angle D$.",
            "That given compares the two triangles; it does not say where the dilation puts $B'$.",
          ],
        ],
        hint: `The dilation by $${k}$ has its center at $A$, and it moves $B$ from ${s.ab} to ${s.de} away from $A$. What does a dilation do to a line that passes through its center?`,
        why: "The center of a dilation stays fixed, and every other point moves along its line through the center, so lines through the center map to themselves.",
      };
    case "two-not-three":
      return {
        step: "The proof never uses $\\angle C\\cong\\angle F$.",
        ask: "Why does AA need only two pairs of angles?",
        state: "setup",
        correct: `The third pair is forced: $m\\angle C=180^\\circ-${s.alpha}^\\circ-${s.beta}^\\circ=${s.gamma}^\\circ=m\\angle F$.`,
        wrong: [
          [
            "The dilation makes $\\angle C$ and $\\angle F$ congruent.",
            "A dilation keeps $\\angle C$ as it is; $\\angle C\\cong\\angle F$ comes from the angle sum.",
          ],
          [
            "$\\angle C$ and $\\angle F$ might differ, but the proof does not need them.",
            "They cannot differ: each is $180^\\circ$ minus the same two angle measures.",
          ],
          [
            "Reflecting over line $AB$ makes $\\angle C$ match $\\angle F$.",
            "A reflection keeps every angle measure; it cannot make two angles equal.",
          ],
        ],
        hint: `With $m\\angle A=${s.alpha}^\\circ$ and $m\\angle B=${s.beta}^\\circ$, what must $m\\angle C$ be, and what must $m\\angle F$ be?`,
        why: "The angles of every triangle add to $180^\\circ$, so two matching pairs force the third.",
      };
    case "not-congruence":
      return {
        step: "AA gives $\\triangle ABC\\sim\\triangle DEF$, but not $\\triangle ABC\\cong\\triangle DEF$.",
        ask: "Why does AA not prove congruence?",
        state: "setup",
        correct:
          "A dilation by any $k\\ne1$ keeps both angles and changes every side, so two angles fix shape, not size.",
        wrong: [
          [
            "Rigid motions can change the size of a triangle.",
            "Rigid motions keep every length; that is why they cannot match $AB$ to $DE$.",
          ],
          [
            "AA gives congruence whenever the triangles are drawn to scale.",
            "How a figure is drawn does not change what the givens prove.",
          ],
          [
            "Similar triangles always have different side lengths.",
            "Congruent triangles are similar too; AA allows equal sizes but does not force them.",
          ],
        ],
        hint: `Here $AB=${s.ab}$ and $DE=${s.de}$, yet the angles match. What does a dilation change, and what does it keep?`,
        why: "Two angles fix a triangle's shape; a dilation by a factor other than 1 gives a triangle with the same angles and different sides.",
      };
    case "rigid-first-ray":
      return {
        step: "A translation and a rotation, with a reflection if needed, move $A$ onto $D$ and ray $AB$ onto ray $DE$. Then the image of ray $AC$ lies along ray $DF$.",
        ask,
        state: "rigid",
        correct:
          "Rigid motions preserve angle measure, so the image of $\\angle A$ fits exactly on $\\angle D$.",
        wrong: [
          [
            "Rigid motions preserve length, so $AC=DF$.",
            "Rigid motions do keep length, but $AC\\ne DF$: $\\triangle DEF$ is a scaled copy. The step is about a direction, not a length.",
          ],
          [
            "Because the image of $C$ lands on $F$.",
            "It does not: the image of $C$ is $AC$ from $D$, and $DF$ is $k$ times that. Only a dilation can finish the match.",
          ],
          [
            "Because $\\angle B\\cong\\angle E$.",
            "That pair is at $B$ and $E$; the direction of the ray from $D$ depends on the angle at $A$.",
          ],
        ],
        hint: `The copy keeps $AB=${s.ab}$, so it does not reach $E$ with $DE=${s.de}$. What does it keep that fixes the direction of the side from $D$?`,
        why: "The image of $\\angle A$ has the measure of $\\angle A$, which equals the measure of $\\angle D$, and both open from ray $DE$ on the same side, so their second rays coincide.",
      };
  }
}

function stepRender(r: Random, s: Setup, step: Step): Surface | null {
  const L = lettersOf(s);
  const c = stepCase(s, step);
  const options: ChoiceOption[] = [
    { label: relabel(c.correct, L), correct: true },
    ...c.wrong.map(([label, feedback]) => ({
      label: relabel(label, L),
      feedback: relabel(feedback, L),
    })),
  ];
  const recap = `To prove $\\triangle ABC\\sim\\triangle DEF$, the proof dilates $\\triangle ABC$ about $A$ by $k=\\frac{DE}{AB}$ to get $\\triangle AB'C'$, then maps $\\triangle AB'C'$ onto $\\triangle DEF$ by a rigid motion.`;
  const recapRigid =
    "To prove $\\triangle ABC\\sim\\triangle DEF$, this proof moves $\\triangle ABC$ by rigid motions first and dilates it afterward.";
  const surface = choiceSurface(r, {
    prompt: relabel(
      `Use the figure. In $\\triangle ABC$ and $\\triangle DEF$, $\\angle A\\cong\\angle D$ and $\\angle B\\cong\\angle E$, with $m\\angle A=${s.alpha}^\\circ$, $m\\angle B=${s.beta}^\\circ$, $AB=${s.ab}$ and $DE=${s.de}$. ${step === "rigid-first-ray" ? recapRigid : recap} Step: ${c.step} ${c.ask}`,
      L,
    ),
    options,
    hint: relabel(c.hint, L),
    explanation: [
      relabel(`The step: ${c.step}`, L),
      relabel(`${c.correct} ${c.why}`, L),
      ...c.wrong.map(([label, feedback]) =>
        relabel(
          `“${label.replace(/\.$/, "")}” does not justify the step. ${feedback}`,
          L,
        ),
      ),
    ],
  });
  if (!surface) return null;
  return { ...surface, figure: sceneFigure(aaFigure(s, c.state)) };
}

/* ---------------------------------------------- argument check (type 3) */

type Flaw =
  | "circular"
  | "no-dilation"
  | "length-kept"
  | "wrong-criterion"
  | "aa-for-congruence"
  | "wrong-pair"
  | "angles-scaled";
const flaws: Flaw[] = [
  "circular",
  "no-dilation",
  "length-kept",
  "wrong-criterion",
  "aa-for-congruence",
  "wrong-pair",
  "angles-scaled",
];
interface Argument {
  sentences: { text: string; why: string }[];
  bad: number;
  flaw: string;
  repair: string;
}
export function argument(s: Setup, flaw: Flaw): Argument {
  const k = kTex(s);
  const dilate = {
    text: `Dilate $\\triangle ABC$ about $A$ by $k=${k}$; call the image $\\triangle AB'C'$.`,
    why: "A dilation can always be applied; this one is the construction of the proof.",
  };
  const side = {
    text: `Then $AB'=${k}\\cdot ${s.ab}=${s.de}=DE$.`,
    why: "A dilation multiplies every length by its scale factor.",
  };
  switch (flaw) {
    case "circular":
      return {
        sentences: [
          {
            text: "We are given $\\angle A\\cong\\angle D$ and $\\angle B\\cong\\angle E$.",
            why: "Those are the givens.",
          },
          {
            text: `So $\\triangle ABC\\sim\\triangle DEF$, and $\\frac{DE}{AB}=\\frac{DF}{AC}=${k}$.`,
            why: "",
          },
          {
            text: `Dilate $\\triangle ABC$ about $A$ by $${k}$; the image $\\triangle AB'C'$ has the side lengths of $\\triangle DEF$.`,
            why: "The statement is true, but this argument reached it from the unproved sentence before it.",
          },
          {
            text: "So a dilation followed by a rigid motion maps $\\triangle ABC$ onto $\\triangle DEF$.",
            why: "The conclusion is true, but it rests on the unproved sentence 2.",
          },
        ],
        bad: 1,
        flaw: "It concludes the similarity, and proportional sides, before anything has been shown: it assumes what it is trying to prove.",
        repair: `Instead, dilate by $k=${k}$ first, then use ASA to get the rigid motion.`,
      };
    case "no-dilation":
      return {
        sentences: [
          {
            text: "Translate $\\triangle ABC$ so $A$ lands on $D$, then rotate it so ray $AB$ lies along ray $DE$, reflecting over line $DE$ if needed.",
            why: "Rigid motions can always do this.",
          },
          {
            text: "Since $\\angle A\\cong\\angle D$, the image of ray $AC$ lies along ray $DF$.",
            why: "Rigid motions preserve angle measure, so the image of $\\angle A$ fits on $\\angle D$.",
          },
          {
            text: "So the images of $B$ and $C$ land on $E$ and $F$.",
            why: "",
          },
          {
            text: "Therefore $\\triangle ABC\\sim\\triangle DEF$.",
            why: "The conclusion is true, but this argument reached it from the false sentence before it.",
          },
        ],
        bad: 2,
        flaw: `Rigid motions keep $AB=${s.ab}$, so the image of $B$ is ${s.ab} from $D$, not at $E$ where $DE=${s.de}$.`,
        repair: `Instead, add a dilation about $D$ by $k=${k}$, which moves the image of $B$ onto $E$.`,
      };
    case "length-kept":
      return {
        sentences: [
          dilate,
          {
            text: `Dilations preserve length, so $AB'=AB=${s.ab}$.`,
            why: "",
          },
          {
            text: "Dilations preserve angle measure, so $\\angle B'AC'\\cong\\angle D$ and $\\angle AB'C'\\cong\\angle E$.",
            why: "Dilations keep angle measures, and the givens match those angles to $\\angle D$ and $\\angle E$.",
          },
          {
            text: "A rigid motion then maps $\\triangle AB'C'$ onto $\\triangle DEF$.",
            why: "The statement is true (by ASA with $AB'=DE$), though this argument never showed $AB'=DE$.",
          },
        ],
        bad: 1,
        flaw: `Dilations multiply lengths by the scale factor: $AB'=${k}\\cdot ${s.ab}=${s.de}$, not ${s.ab}.`,
        repair: `Instead: $AB'=${k}\\cdot ${s.ab}=${s.de}=DE$.`,
      };
    case "wrong-criterion":
      return {
        sentences: [
          dilate,
          side,
          {
            text: "Dilations preserve angle measure, so $\\angle B'AC'\\cong\\angle D$.",
            why: "Dilations keep angle measures, and $\\angle A\\cong\\angle D$ is given.",
          },
          {
            text: "So $\\triangle AB'C'\\cong\\triangle DEF$ by SAS.",
            why: "",
          },
        ],
        bad: 3,
        flaw: "SAS needs two pairs of congruent sides with the angle between them; only $AB'=DE$ is known.",
        repair:
          "Instead, add $\\angle AB'C'\\cong\\angle E$ and use ASA: angle, included side, angle.",
      };
    case "aa-for-congruence":
      return {
        sentences: [
          dilate,
          side,
          {
            text: "Dilations preserve angle measure, so $\\triangle AB'C'$ has the same angles as $\\triangle DEF$.",
            why: "Dilations keep angle measures, the givens match two pairs, and the angle sum matches the third.",
          },
          {
            text: "So $\\triangle AB'C'\\cong\\triangle DEF$ by AA.",
            why: "",
          },
        ],
        bad: 3,
        flaw: "AA is the criterion being proved, and it gives similarity, not congruence.",
        repair:
          "Instead, use ASA: the angles at $A$ and $B'$ with the side $AB'=DE$ between them.",
      };
    case "wrong-pair":
      return {
        sentences: [
          dilate,
          {
            text: "Then $AB'=DE$, $\\angle B'AC'\\cong\\angle D$ and $\\angle AB'C'\\cong\\angle E$.",
            why: "The dilation multiplies $AB$ by $k$ and keeps the angles, which the givens match to $\\angle D$ and $\\angle E$.",
          },
          {
            text: "So $\\triangle AB'C'\\cong\\triangle DEF$ by ASA.",
            why: "Two angles and the side between them are congruent.",
          },
          {
            text: "Congruent triangles are similar, so $\\triangle ABC\\sim\\triangle DEF$.",
            why: "",
          },
        ],
        bad: 3,
        flaw: "Congruent triangles are similar, but the congruent pair is $\\triangle AB'C'$ and $\\triangle DEF$; that says nothing about $\\triangle ABC$ by itself.",
        repair:
          "Instead: the dilation followed by the rigid motion that maps $\\triangle AB'C'$ onto $\\triangle DEF$ maps $\\triangle ABC$ onto $\\triangle DEF$, so they are similar.",
      };
    case "angles-scaled":
      return {
        sentences: [
          dilate,
          side,
          {
            text: `Dilations multiply angle measures by $${k}$, so $\\angle AB'C'$ no longer matches $\\angle E$.`,
            why: "",
          },
          {
            text: "A rigid motion then maps $\\triangle AB'C'$ onto $\\triangle DEF$.",
            why: "The statement is true, by ASA with the kept angles and $AB'=DE$.",
          },
        ],
        bad: 2,
        flaw: "Dilations keep angle measures; $\\angle AB'C'$ still matches $\\angle ABC$, and so $\\angle E$.",
        repair: `Instead: $m\\angle AB'C'=m\\angle ABC=${s.beta}^\\circ=m\\angle E$.`,
      };
  }
}
const complete = (s: Setup) =>
  `Dilate $\\triangle ABC$ about $A$ by $k=\\frac{DE}{AB}=${kTex(s)}$, so $AB'=k\\cdot AB=DE$. Dilations preserve angle measure, so $\\angle B'AC'\\cong\\angle D$ and $\\angle AB'C'\\cong\\angle E$. By ASA, $\\triangle AB'C'\\cong\\triangle DEF$, so a rigid motion maps $\\triangle AB'C'$ onto $\\triangle DEF$. The dilation followed by that rigid motion maps $\\triangle ABC$ onto $\\triangle DEF$, so $\\triangle ABC\\sim\\triangle DEF$.`;

function choice(s: {
  prompt: string;
  choices: { label: string; correct: boolean; feedback: string }[];
  hint: string;
  explanation: string[];
  figure: Scene;
}): Surface {
  const choiceFeedback: Record<string, string> = {};
  let answer = "";
  const options = s.choices.map((c, i) => {
    const id = `option-${"abcd"[i]}`;
    if (c.correct) answer = id;
    else choiceFeedback[id] = c.feedback;
    return { id, label: c.label };
  });
  if (options.length !== 4 || !answer)
    throw new Error("Four options, one correct");
  return {
    prompt: s.prompt,
    response: { kind: "choice", label: "Choose one answer", options },
    answer,
    hint: s.hint,
    explanation: s.explanation,
    choiceFeedback,
    figure: sceneFigure(s.figure),
  };
}

function argumentRender(r: Random, s: Setup, task: Flaw | "complete"): Surface {
  const L = lettersOf(s);
  const facts = `Use the figure. In $\\triangle ABC$ and $\\triangle DEF$, $\\angle A\\cong\\angle D$ and $\\angle B\\cong\\angle E$, with $m\\angle A=${s.alpha}^\\circ$, $m\\angle B=${s.beta}^\\circ$, $AB=${s.ab}$ and $DE=${s.de}$.`;
  if (task === "complete") {
    const groups: Flaw[][] = [
      ["circular", "aa-for-congruence"],
      ["no-dilation", "wrong-pair"],
      ["length-kept", "angles-scaled", "wrong-criterion"],
    ];
    const items = shuffle(r, [
      { text: complete(s), feedback: "" },
      ...groups.map((g) => {
        const a = argument(s, pick(r, g));
        return {
          text: a.sentences.map((x) => x.text).join(" "),
          feedback: `That argument fails at “${a.sentences[a.bad]!.text}” ${a.flaw}`,
        };
      }),
    ]);
    return choice({
      prompt: relabel(
        `${facts} Which argument correctly and completely proves $\\triangle ABC\\sim\\triangle DEF$ from these givens?\n${items.map((x, i) => `Argument ${i + 1}: ${x.text}`).join("\n")}`,
        L,
      ),
      choices: items.map((x, i) => ({
        label: `Argument ${i + 1}`,
        correct: x.feedback === "",
        feedback: relabel(x.feedback, L),
      })),
      hint: relabel(
        `A complete argument must turn $AB=${s.ab}$ into $DE=${s.de}$ with a transformation, prove a congruence with a criterion whose parts are all known, and end with transformations that carry $\\triangle ABC$ onto $\\triangle DEF$. Check each of the 4 arguments for all three.`,
        L,
      ),
      explanation: [
        relabel(
          "A complete argument has six ideas: the scale factor $k=\\frac{DE}{AB}$, lengths multiplied by $k$, angles kept, ASA, the rigid motion that congruence gives, and the composition of the dilation and the rigid motion.",
          L,
        ),
        ...items.map((x, i) =>
          relabel(
            `Argument ${i + 1}: ${x.feedback || "Correct and complete: it has all six ideas, each justified."}`,
            L,
          ),
        ),
      ],
      figure: aaFigure(s, "setup"),
    });
  }
  const a = argument(s, task);
  const noFlaw = r(0, 1) === 1;
  const shown = a.sentences.map((_, i) => i);
  if (noFlaw) {
    const drop = pick(
      r,
      shown.filter((i) => i !== a.bad),
    );
    shown.splice(shown.indexOf(drop), 1);
  }
  const choices = shown.map((i) => ({
    label: `Sentence ${i + 1}`,
    correct: i === a.bad,
    feedback:
      i === a.bad
        ? ""
        : relabel(`Sentence ${i + 1}: ${a.sentences[i]!.why}`, L),
  }));
  if (noFlaw)
    choices.push({
      label: "There is no flaw",
      correct: false,
      feedback: relabel(`Sentence ${a.bad + 1} is a flaw. ${a.flaw}`, L),
    });
  return choice({
    prompt: relabel(
      `${facts} A student tries to prove $\\triangle ABC\\sim\\triangle DEF$:\n${a.sentences.map((x, i) => `Sentence ${i + 1}: ${x.text}`).join("\n")}\nWhich sentence is the first flaw in the argument?`,
      L,
    ),
    choices,
    hint: relabel(
      `Check each sentence against one property of a dilation or a rigid motion, or ask whether it assumes the similarity it is meant to prove. Keep in mind that $AB=${s.ab}$ and $DE=${s.de}$.`,
      L,
    ),
    explanation: [
      relabel(
        "Read the argument one sentence at a time. Each sentence must follow from the givens, a property of rigid motions or dilations, or the sentences before it.",
        L,
      ),
      relabel(`Sentence ${a.bad + 1} is the first flaw. ${a.flaw}`, L),
      relabel(a.repair, L),
      ...a.sentences
        .map((x, i) =>
          i === a.bad ? "" : relabel(`Sentence ${i + 1}: ${x.why}`, L),
        )
        .filter(Boolean),
    ],
    figure: aaFigure(s, "setup"),
  });
}

/* ------------------------------------------------------------ families */

const buildFamily = chainFamily({
  template: aaCriterionTemplates[0]!,
  axes: {
    proof: defineAxis(
      "proof",
      [
        "reasons-dilate-first",
        "build-dilate-first",
        "reasons-rigid-first",
      ] as const,
      { weights: [9, 6, 5] },
    ),
  },
  model: (r) => drawSetup(r),
  render: (s, axes, r) => proofRender(r, s, axes.proof),
  variant: (s) => (s.k[0] < s.k[1] ? "reduce" : "enlarge"),
});

const stepFamily = chainFamily({
  template: aaCriterionTemplates[1]!,
  axes: { step: defineAxis("step", steps) },
  model: (r) => drawSetup(r),
  render: (s, axes, r) => stepRender(r, s, axes.step),
  variant: (s) => (s.k[0] < s.k[1] ? "reduce" : "enlarge"),
});

const argumentTasks = [...flaws, "complete"] as const;
const argumentFamily = chainFamily({
  template: aaCriterionTemplates[2]!,
  axes: {
    task: defineAxis("task", argumentTasks, {
      weights: argumentTasks.map((x) => (x === "complete" ? 8 : 7)),
    }),
  },
  model: (r) => drawSetup(r),
  render: (s, axes, r) => argumentRender(r, s, axes.task),
  variant: (s) => (s.k[0] < s.k[1] ? "reduce" : "enlarge"),
});

export const aaCriterionGenerate = dispatch(aaCriterionTemplates, {
  "aa-criterion-proof-build": (seed) => buildFamily.generate(seed).problem,
  "aa-criterion-step-reason": (seed) => stepFamily.generate(seed).problem,
  "aa-criterion-argument-check": (seed) =>
    argumentFamily.generate(seed).problem,
});
export const aaCriterionCases = {
  "aa-criterion-proof-build": buildFamily.generate,
  "aa-criterion-step-reason": stepFamily.generate,
  "aa-criterion-argument-check": argumentFamily.generate,
};
