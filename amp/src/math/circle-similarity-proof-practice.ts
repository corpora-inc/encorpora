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
import { graph, scene as sceneOf } from "./scene/author";
import type { Element, Scene } from "./scene/spec";
import { selectFamily, selectModel, selectTemplate, st } from "./select-kit";
import {
  gradeStructuredWork,
  gradingFits,
  normalizeStructuredWork,
  structuralProblem,
  type StructuredWorkResponse,
  type WorkBank,
  type WorkField,
  type WorkGrading,
} from "./structured-work";
import {
  proofWork,
  workModeAxis,
  workSurface,
  type ProofModel,
  type WorkMode,
} from "./structured-work-kit";
import type { Statement } from "./variation/statement-set";
import { defineAxis, type Random } from "./variation/axes";

/**
 * HSG.C.A.1: prove that all circles are similar. A translation carries one
 * center onto the other; a dilation about that center by the ratio of the
 * radii carries the translated circle onto the second circle. Three types:
 * build, order or complete the two-column proof; justify a step, find the
 * one flawed step, or choose the complete explanation; and the symbolic
 * sequence that works for every pair of circles, with the statements that
 * hold for all pairs (concentric and equal radii included).
 */

const band = "9–12" as const;
const scenes = { requiredFigureCapability: "scenes-v1" as const };

export const circleSimilarityProofTemplates: readonly TemplateMetadata[] = [
  {
    id: "circle-similarity-proof-steps",
    version: 1,
    title: "Build the proof that two circles are similar",
    skillId: "circle-similarity",
    gradeBand: band,
    difficultyOffset: 0.5,
    requiredResponseCapability: "structured-work-v1",
    ...scenes,
    description:
      "A two-column proof that circle $A$ is similar to circle $B$: translate center $A$ onto $B$, dilate about $B$ by the ratio of the radii, conclude similarity, and (with letters for the radii) generalize to all circles. Build it from banks with false statements and invalid reasons, order its lines, or supply a missing line. Numeric radii prove only that one pair is similar.",
  },
  {
    id: "circle-similarity-justify-flaw",
    version: 1,
    title: "Justify or find the flaw in a circle-similarity argument",
    skillId: "circle-similarity",
    gradeBand: band,
    difficultyOffset: 0.4,
    requiredResponseCapability: "single-choice-v1",
    ...scenes,
    description:
      "Choose the reason for one step of the proof that all circles are similar, find the one step that does not follow (inverted factor, wrong center, an example taken as proof, circular reasoning, a translation said to change size, a consequence taken as a cause) or say there is none, or choose the correct and complete explanation.",
  },
  selectTemplate({
    figure: "scenes-v1",
    id: "circle-similarity-general-map",
    title: "The transformation that maps any circle onto any other",
    skillId: "circle-similarity",
    gradeBand: band,
    difficultyOffset: 0.3,
    description:
      "Select every transformation sequence that maps a circle with center $(a,b)$ and radius $r$ onto a circle with center $(c,d)$ and radius $s$ for every choice of the letters, or every statement true for any two circles, including concentric circles and equal radii.",
  }),
];

/* ------------------------------------------------------------ helpers */

type Pt = [number, number];
const CENTERS = [
  ["A", "B"],
  ["P", "Q"],
  ["O_1", "O_2"],
  ["C", "D"],
] as const;
const RADII = [
  ["r", "s"],
  ["r_1", "r_2"],
  ["a", "b"],
  ["p", "q"],
] as const;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const fracTex = (n: number, d: number) => {
  const g = gcd(n, d) || 1;
  return d / g === 1 ? `${n / g}` : `\\frac{${n / g}}{${d / g}}`;
};
/** A name for scene text: TeX subscripts are drawn by the scene typesetter. */
const prime = (c: string) => `${c}′`;
const vec = (a: string, b: string) => `\\overrightarrow{${a}${b}}`;

/** The two circles and how their radii are written. */
export interface Sym {
  c1: string;
  c2: string;
  /** Radius text (a letter, or a number in a numeric proof). */
  r: string;
  s: string;
  /** Scale factor s/r and its inverse, as TeX. */
  k: string;
  kInv: string;
  numeric: { r: number; s: number } | null;
  /** Display radii, proportional to the true radii when numeric. */
  rd: number;
  sd: number;
}

function symbols(r: Random, numeric: boolean): Sym {
  let names: readonly [string, string];
  let radii: readonly [string, string];
  do {
    names = pick(r, CENTERS);
    radii = pick(r, RADII);
  } while (names[0][0]!.toLowerCase() === radii[0][0]);
  const [c1, c2] = names;
  const bigger = r(0, 1) === 1; // s > r
  if (numeric) {
    // Radii in 1..12, never equal; the larger at most 4 times the smaller
    // so both circles stay readable when drawn to scale.
    const small = r(1, 9);
    const big = r(small + 1, Math.min(12, 4 * small));
    const [rv, sv] = bigger ? [small, big] : [big, small];
    const unit = 2.6 / Math.max(rv, sv);
    return {
      c1,
      c2,
      r: `${rv}`,
      s: `${sv}`,
      k: fracTex(sv, rv),
      kInv: fracTex(rv, sv),
      numeric: { r: rv, s: sv },
      rd: rv * unit,
      sd: sv * unit,
    };
  }
  const small = 1 + 0.1 * r(0, 4);
  const big = small * (1.5 + 0.1 * r(0, 6));
  const [rd, sd] = bigger ? [small, big] : [big, small];
  const [rs, ss] = radii;
  return {
    c1,
    c2,
    r: rs,
    s: ss,
    k: `\\frac{${ss}}{${rs}}`,
    kInv: `\\frac{${rs}}{${ss}}`,
    numeric: null,
    rd,
    sd,
  };
}

/** Where the figure puts the two centers. */
const centersOf = (y: Sym): { A: Pt; B: Pt } => ({
  A: [0, 0],
  B: [y.rd + Math.max(y.rd, y.sd) + 0.9, 0],
});

const radiusLabel = (
  id: string,
  text: string,
  from: Pt,
  angle: number,
  length: number,
): Element => {
  const t = (angle * Math.PI) / 180;
  const mid: Pt = [
    from[0] + (Math.cos(t) * length) / 2,
    from[1] + (Math.sin(t) * length) / 2,
  ];
  // Beside the radius, on its counterclockwise side.
  const n: Pt = [-Math.sin(t), Math.cos(t)];
  return {
    type: "text",
    id,
    at: mid,
    text,
    font: "math",
    halo: true,
    align: [n[0] > 0.3 ? -1 : n[0] < -0.3 ? 1 : 0, n[1] > 0.3 ? 1 : -1],
    offset: [n[0] * 8, -n[1] * 8],
  };
};
const ray = (from: Pt, angle: number, length: number): Pt => [
  from[0] + Math.cos((angle * Math.PI) / 180) * length,
  from[1] + Math.sin((angle * Math.PI) / 180) * length,
];

export type ExtraCircle = { center: Pt; r: number; label: string };
/**
 * Circle c1 (teal) and circle c2 (ink) to scale, their centers and labeled
 * radii, the translation arrow from c1 to c2 and, when asked, the dashed
 * translated circle c1′ (center c2, radius r) or another dashed image.
 */
export function circlesScene(
  y: Sym,
  o: { translated?: "named" | "image" | null; extra?: ExtraCircle } = {},
): Scene {
  const { A, B } = centersOf(y);
  const els: Element[] = [
    {
      type: "circle",
      id: "c1",
      center: A,
      r: y.rd,
      stroke: "accent",
      width: 2.25,
    },
    {
      type: "circle",
      id: "c2",
      center: B,
      r: y.sd,
      stroke: "ink",
      width: 2.25,
    },
  ];
  const translated = o.translated === undefined ? "named" : o.translated;
  if (translated)
    els.push({
      type: "circle",
      id: "c1p",
      center: B,
      r: y.rd,
      stroke: "muted",
      width: 1.75,
      dash: "dash",
    });
  if (o.extra)
    els.push({
      type: "circle",
      id: "img",
      center: o.extra.center,
      r: o.extra.r,
      stroke: "gold",
      width: 2,
      dash: "dash",
    });
  els.push(
    {
      type: "segment",
      id: "slide",
      from: A,
      to: B,
      stroke: "gold",
      width: 1.75,
      arrow: "end",
    },
    {
      type: "segment",
      id: "ra",
      from: A,
      to: ray(A, 120, y.rd),
      stroke: "accent",
      width: 2,
    },
    radiusLabel("ral", y.r, A, 120, y.rd),
    {
      type: "segment",
      id: "rb",
      from: B,
      to: ray(B, 60, y.sd),
      stroke: "ink",
      width: 2,
    },
    radiusLabel("rbl", y.s, B, 60, y.sd),
    figurePoint("pa", A),
    figurePoint("pb", B),
    figureName("na", y.c1, A, [0, -1]),
    figureName("nb", y.c2, B, [0, -1]),
  );
  if (translated) {
    const at = ray(B, 225, y.rd);
    els.push({
      type: "text",
      id: "npl",
      at,
      text: translated === "named" ? prime(y.c1) : "image",
      font: translated === "named" ? "math" : "sans",
      size: "sm",
      color: "muted",
      // A halo around the raised prime would paint over the letter's top.
      ...(translated === "named" ? {} : { halo: true }),
      align: [1, 1],
      offset: [-9, 9],
    });
  }
  if (o.extra) {
    const at = ray(o.extra.center, 315, o.extra.r);
    els.push({
      type: "text",
      id: "nim",
      at,
      text: o.extra.label,
      font: "sans",
      size: "sm",
      color: "gold",
      halo: true,
      align: [-1, -1],
      offset: [4, -4],
    });
  }
  const radii = y.numeric
    ? `radius ${y.r} and radius ${y.s}`
    : `radii ${y.r} and ${y.s}`;
  return figureScene(
    `Circle ${y.c1.replace("_", "")} and circle ${y.c2.replace("_", "")} with ${radii}${translated === "named" ? `, and the dashed circle ${y.c1.replace("_", "")}′: center ${y.c2.replace("_", "")}, radius ${y.r}` : ""}`,
    els,
  );
}

/* --------------------------------------------- type 1: the proof itself */

type LineKey =
  | "move"
  | "onto"
  | "similar"
  | "all"
  | "slide"
  | "rev"
  | "center"
  | "inv"
  | "diff";
type ReasonKey =
  | "rigid"
  | "dil"
  | "sim"
  | "general"
  | "shape"
  | "measure"
  | "rigidDil"
  | "invDil";

export interface ProofCase {
  y: Sym;
  /** The proof's lines in a valid order. */
  path: [LineKey, ReasonKey][];
  statements: Record<LineKey, string>;
  reasons: Record<ReasonKey, string>;
  /** statement → reason → alternative prerequisite sets (keys). */
  claims: Partial<Record<LineKey, Partial<Record<ReasonKey, LineKey[][]>>>>;
  /** Statements and reasons shown in the banks. */
  bankLines: LineKey[];
  bankReasons: ReasonKey[];
  goal: LineKey;
  /** Fill mode: the missing line's index in `path`. */
  blank: number;
}

export function proofTexts(y: Sym) {
  const { c1, c2, r, s, k, kInv } = y;
  const statements: Record<LineKey, string> = {
    move: `The translation by $${vec(c1, c2)}$ maps circle $${c1}$ onto circle $${c1}'$, with center $${c2}$ and radius $${r}$`,
    onto: `The dilation about $${c2}$ by $${k}$ maps circle $${c1}'$ onto circle $${c2}$`,
    similar: `Circle $${c1}$ is similar to circle $${c2}$`,
    all: "All circles are similar",
    slide: `The translation by $${vec(c1, c2)}$ maps circle $${c1}$ onto circle $${c2}$`,
    rev: `The translation by $${vec(c2, c1)}$ maps circle $${c1}$ onto a circle with center $${c2}$`,
    center: `The dilation about $${c1}$ by $${k}$ maps circle $${c1}$ onto circle $${c2}$`,
    inv: `The dilation about $${c2}$ by $${kInv}$ maps circle $${c1}'$ onto circle $${c2}$`,
    diff: y.numeric
      ? `The dilation about $${c2}$ by $${y.numeric.s - y.numeric.r}$ maps circle $${c1}'$ onto circle $${c2}$`
      : `The dilation about $${c2}$ by $${s}-${r}$ maps circle $${c1}'$ onto circle $${c2}$`,
  };
  const reasons: Record<ReasonKey, string> = {
    rigid: `A translation carries $${c1}$ to $${c2}$ and keeps every distance`,
    dil: `A dilation about $${c2}$ by $${k}$ multiplies each distance from $${c2}$ along its ray by $${k}$, and $${k}\\cdot ${r}=${s}$`,
    sim: "Figures are similar when a sequence of rigid motions and dilations maps one onto the other",
    general: `Circles $${c1}$ and $${c2}$ were any two circles: no fact about their centers or radii was used`,
    shape: "Both circles have the same shape",
    measure:
      "Measuring shows circumference $\\div$ diameter $\\approx 3.14$ for both circles",
    rigidDil: "A dilation is a rigid motion, so it keeps every distance",
    invDil: `A dilation about $${c2}$ by $${k}$ multiplies each distance from $${c2}$ by $${kInv}$`,
  };
  return { statements, reasons };
}

/** True when a numeric "dilate by s − r" statement is a non-step: s > r and
 * radius r(s − r) is not s. */
const diffUsable = (y: Sym) =>
  !y.numeric ||
  (y.numeric.s - y.numeric.r >= 2 &&
    y.numeric.r * (y.numeric.s - y.numeric.r) !== y.numeric.s);

export function proofCase(r: Random, numeric: boolean): ProofCase {
  const y = symbols(r, numeric);
  const { statements, reasons } = proofTexts(y);
  const path: [LineKey, ReasonKey][] = [
    ["move", "rigid"],
    ["onto", "dil"],
    ["similar", "sim"],
  ];
  if (!numeric) path.push(["all", "general"]);
  const claims: ProofCase["claims"] = {
    move: { rigid: [[]] },
    onto: { dil: [["move"]] },
    similar: { sim: [["move", "onto"]] },
    ...(numeric ? {} : { all: { general: [["similar"]] } }),
  };
  const falseLines: LineKey[] = ["slide", "rev", "center", "inv"];
  if (diffUsable(y)) falseLines.push("diff");
  // A numeric proof cannot conclude "all circles": that line and the
  // generality reason sit in the banks as non-steps.
  const bankLines: LineKey[] = [
    "move",
    "onto",
    "similar",
    "all",
    ...falseLines,
  ];
  const bankReasons: ReasonKey[] = [
    "rigid",
    "dil",
    "sim",
    "general",
    "shape",
    "measure",
    "rigidDil",
    "invDil",
  ];
  const goal: LineKey = numeric ? "similar" : "all";
  // The missing line of a fill-in is never the goal line.
  const blank = r(0, path.length - 2);
  return {
    y,
    path,
    statements,
    reasons,
    claims,
    bankLines,
    bankReasons,
    goal,
    blank,
  };
}

function assemble(r: Random, c: ProofCase): ProofModel {
  const lines = shuffle(r, [...c.bankLines]);
  const sid = new Map(lines.map((k, i) => [k, `s${"abcdefghij"[i]}`]));
  const reasonOrder = shuffle(r, [...c.bankReasons]);
  const rid = new Map(reasonOrder.map((k, i) => [k, `r${"abcdefghij"[i]}`]));
  const claims: ProofModel["claims"] = {};
  for (const [s, byReason] of Object.entries(c.claims) as [
    LineKey,
    Partial<Record<ReasonKey, LineKey[][]>>,
  ][]) {
    const out: Record<string, string[][]> = {};
    for (const [reason, sets] of Object.entries(byReason) as [
      ReasonKey,
      LineKey[][],
    ][])
      out[rid.get(reason)!] = sets.map((set) => set.map((k) => sid.get(k)!));
    claims[sid.get(s)!] = out;
  }
  return {
    statements: lines.map((k) => ({ id: sid.get(k)!, label: c.statements[k] })),
    reasons: reasonOrder.map((k) => ({ id: rid.get(k)!, label: c.reasons[k] })),
    claims,
    goal: sid.get(c.goal)!,
    goalTex: c.statements[c.goal],
    path: c.path.map(([s, reason]) => [sid.get(s)!, rid.get(reason)!]),
  };
}

/** A proof with one line missing: its statement and reason are the
 * learner's; every other line is given. */
function missingLineWork(m: ProofModel, blank: number, label: string) {
  const banks: WorkBank[] = [
    { id: "statements", label: "Statement", options: m.statements },
    { id: "reasons", label: "Reason", options: m.reasons },
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
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label,
    layout: "proof",
    mode: "fill",
    goal: m.goalTex,
    banks,
    rows: m.path.map(([s, reason], i) => ({
      id: `r${i + 1}`,
      fields:
        i === blank
          ? [field("statements"), field("reasons")]
          : [field("statements", s), field("reasons", reason)],
    })),
  };
  const workGrading: WorkGrading = {
    mode: "proof",
    goal: m.goal,
    claims: m.claims,
  };
  const answer = JSON.stringify(
    m.path.map(([s, reason], i) => (i === blank ? [s, reason] : ["", ""])),
  );
  const problem = structuralProblem(response);
  if (problem) throw new Error(problem);
  if (!gradingFits(response, workGrading)) throw new Error("Rule does not fit");
  if (normalizeStructuredWork(response, answer) !== answer)
    throw new Error(`Answer key is not canonical: ${answer}`);
  if (!gradeStructuredWork(response, workGrading, answer))
    throw new Error(`Answer key is not credited: ${answer}`);
  return { response, workGrading, answer };
}

const subject = (y: Sym) =>
  `Circle $${y.c1}$ has center $${y.c1}$ and radius $${y.r}$. Circle $${y.c2}$ has center $${y.c2}$ and radius $${y.s}$.`;

function proofExplanation(c: ProofCase, mode: WorkMode): string[] {
  const { y, statements, reasons } = c;
  const { c1, c2, r, s, k } = y;
  const lines = c.path.map(
    ([st, reason], i) => `${i + 1}. ${statements[st]} — ${reasons[reason]}.`,
  );
  const falseLines = c.bankLines.filter(
    (l) => !c.path.some(([p]) => p === l) && l !== "all",
  );
  const whyFalse: Record<string, string> = {
    slide: `a translation alone keeps radius $${r}$`,
    rev: `the translation by $${vec(c2, c1)}$ moves the center away from $${c2}$`,
    center: `a dilation about $${c1}$ keeps the center at $${c1}$`,
    inv: `a factor of $${y.kInv}$ makes the radius $${y.kInv}\\cdot ${r}$, not $${s}$`,
    diff: y.numeric
      ? `a factor of $${y.numeric.s - y.numeric.r}$ makes the radius $${(y.numeric.s - y.numeric.r) * y.numeric.r}$, not $${s}$`
      : `a factor of $${s}-${r}$ makes the radius $(${s}-${r})${r}$, which is not $${s}$ in general`,
  };
  return [
    "Two figures are similar when a sequence of rigid motions (translations, rotations, reflections) and dilations maps one onto the other. A circle is every point at one distance, its radius, from its center.",
    `Two circles differ only in center and radius. A translation can move the center; a dilation can change the radius.`,
    `The translation by $${vec(c1, c2)}$ moves $${c1}$ to $${c2}$ and keeps every distance, so circle $${c1}$ goes to circle $${c1}'$: center $${c2}$, radius $${r}$.`,
    `The dilation about $${c2}$ by $${k}$ keeps $${c2}$ fixed and moves each point along its ray from $${c2}$ to $${k}$ times its distance. Radius $${r}$ becomes $${k}\\cdot ${r}=${s}$, and every point $${s}$ from $${c2}$ comes from the point $${r}$ from $${c2}$ on its ray. So circle $${c1}'$ goes exactly onto circle $${c2}$.`,
    `A translation followed by a dilation maps circle $${c1}$ onto circle $${c2}$, so circle $${c1}$ is similar to circle $${c2}$.`,
    y.numeric
      ? `This proof uses the radii $${r}$ and $${s}$, so it shows only that these two circles are similar. The statement "All circles are similar" needs the same steps with letters for the radii.`
      : `Nothing about $${c1}$, $${c2}$, $${r}$ or $${s}$ was used except that they are centers and radii. Concentric circles need a translation by the zero vector, and equal radii a factor of $1$. So all circles are similar.`,
    `The other statements in the bank are false in general: ${falseLines.map((l) => whyFalse[l]).join("; ")}.`,
    ...(mode === "fill"
      ? [
          `The missing line is line ${c.blank + 1}: ${statements[c.path[c.blank]![0]]}, because ${reasons[c.path[c.blank]![1]].replace(/^([A-Z])(?=[a-z ])/, (x) => x.toLowerCase())}.`,
        ]
      : []),
    "A complete proof:",
    ...lines,
  ];
}

function proofHint(c: ProofCase, mode: WorkMode): string {
  const { c1, c2, r, s } = c.y;
  if (mode === "order")
    return `A line can use only circles named above it. Find the line that first names circle $${c1}'$, of radius $${r}$, then the lines that need it, ending with what you prove.`;
  if (mode === "fill") {
    const next = c.path[c.blank + 1]![0];
    return `Line ${c.blank + 1} is missing. Line ${c.blank + 2} says: ${c.statements[next]}. Which fact must be proved before it, and which reason proves that fact?`;
  }
  return `A translation never changes a radius, and a dilation keeps its own center fixed. Which transformation carries center $${c1}$ to $${c2}$, and which then turns radius $${r}$ into radius $${s}$?`;
}

const proofFamily = chainFamily({
  template: circleSimilarityProofTemplates[0]!,
  axes: {
    mode: workModeAxis,
    radii: defineAxis("radii", ["symbolic", "numeric"] as const, {
      weights: [7, 3],
    }),
  },
  model: (r, axes) => ({
    ...proofCase(r, axes.radii === "numeric"),
    mode: axes.mode as WorkMode,
  }),
  render: (c, axes, r) => {
    const model = assemble(r, c);
    const mode = axes.mode;
    const built =
      mode === "fill"
        ? missingLineWork(model, c.blank, "Your proof")
        : proofWork(
            model,
            mode,
            r,
            mode === "order" ? "Order the proof" : "Your proof",
          );
    const task =
      mode === "build"
        ? "Build the proof: choose a statement and a reason for each line. Some statements and reasons do not belong."
        : mode === "order"
          ? "The lines of the proof are shown out of order. Put them in order."
          : `Line ${c.blank + 1} of the proof is missing. Choose its statement and its reason.`;
    const claim = c.y.numeric
      ? `Prove that circle $${c.y.c1}$ is similar to circle $${c.y.c2}$.`
      : "They stand for any two circles. Prove that all circles are similar.";
    return workSurface(built, {
      prompt: `${subject(c.y)} ${claim} ${task}`,
      hint: proofHint(c, mode),
      explanation: proofExplanation(c, mode),
      figure: sceneFigure(circlesScene(c.y)),
    });
  },
  variant: (c) =>
    `${c.y.numeric ? "numeric" : "symbolic"}${c.mode === "fill" ? `-missing-${c.path[c.blank]![0]}` : ""}`,
});

/* ------------------------------- type 2: justify or find the flaw */

type Star = "move" | "onto" | "similar" | "all";
type Flaw = "inverted" | "center" | "example" | "circular" | "slide" | "ratio";
type Ask = "justify" | "flaw" | "explain";
const STARS: Star[] = ["move", "onto", "similar", "all"];
const FLAWS: Flaw[] = [
  "inverted",
  "center",
  "example",
  "circular",
  "slide",
  "ratio",
];

export interface ArgumentCase {
  ask: Ask;
  y: Sym;
  star: Star;
  flaw: Flaw;
  /** The argument's steps (justify and flaw), without "Step k:". */
  steps: string[];
  /** 0-based index of the flawed step (flaw only). */
  flawed: number;
  options: ChoiceOption[];
  extra?: ExtraCircle;
  translated: "named" | "image" | null;
  /** Private: what the flawed step really produces (center, radius in
   * figure units) against circle c2. */
  image?: { center: Pt; r: number };
}

/** The four steps of the valid argument. */
export function validSteps(y: Sym): string[] {
  const { c1, c2, r, k } = y;
  return [
    `Translate by $${vec(c1, c2)}$. The image of circle $${c1}$ is circle $${c1}'$, with center $${c2}$ and radius $${r}$.`,
    `Dilate about $${c2}$ by $${k}$. The image of circle $${c1}'$ is circle $${c2}$.`,
    `A translation followed by a dilation maps circle $${c1}$ onto circle $${c2}$, so circle $${c1}$ is similar to circle $${c2}$.`,
    `Circles $${c1}$ and $${c2}$ were any two circles, so all circles are similar.`,
  ];
}

const NO_FLAW = "There is no flaw; the argument is a valid proof.";

function justifyOptions(r: Random, y: Sym, star: Star): ChoiceOption[] {
  const { c1, c2, r: rr, s, k, kInv } = y;
  let a = 0;
  let b = 0;
  do {
    a = r(2, 9);
    b = r(2, 12);
  } while (a === b);
  const sets: Record<Star, ChoiceOption[]> = {
    move: [
      {
        label: `A translation carries $${c1}$ to $${c2}$ and keeps every distance, so each point stays $${rr}$ from the center`,
        correct: true,
      },
      {
        label: "A translation multiplies every length by the same factor",
        feedback:
          "That describes a dilation. A translation keeps every length, which is exactly why the radius stays the same.",
      },
      {
        label: `Circles $${c1}$ and $${c2}$ have the same shape`,
        feedback:
          "Having the same shape is what similar means, so this assumes what the proof sets out to show.",
      },
      {
        label: `Circle $${c1}$ and circle $${c2}$ have the same center`,
        feedback: `They do not: $${c1}$ and $${c2}$ are different points. The translation is what carries $${c1}$ onto $${c2}$.`,
      },
    ],
    onto: [
      {
        label: `Dilating about $${c2}$ multiplies each distance from $${c2}$ by $${k}$, and $${k}\\cdot ${rr}=${s}$`,
        correct: true,
      },
      {
        label: "Dilations map circles to circles",
        feedback: `True, but it does not say which circle. The step needs the image to have center $${c2}$ and radius $${s}$.`,
      },
      {
        label: `The circumference becomes $${k}\\cdot 2\\pi ${rr}=2\\pi ${s}$`,
        feedback: `True, but a circle with that circumference could have its center anywhere. The reason must put the center at $${c2}$.`,
      },
      {
        label: `Dilating about $${c2}$ multiplies each distance from $${c2}$ by $${kInv}$`,
        feedback: `False: it multiplies each distance by $${k}$. A factor of $${kInv}$ would give radius $${kInv}\\cdot ${rr}$, not $${s}$.`,
      },
    ],
    similar: [
      {
        label:
          "Figures are similar when a sequence of rigid motions and dilations maps one onto the other",
        correct: true,
      },
      {
        label: "A dilation is a rigid motion",
        feedback:
          "False: a dilation changes lengths unless its factor is $1$. The proof needs a translation (rigid) followed by a dilation (not rigid).",
      },
      {
        label: "Every circle's circumference is $2\\pi$ times its radius",
        feedback:
          "A formula both circles share is not a transformation that maps one onto the other.",
      },
      {
        label: `The ratio of their areas is $\\frac{${s}^2}{${rr}^2}$`,
        feedback:
          "That ratio is a consequence of the circles being similar, so it cannot be the reason they are.",
      },
    ],
    all: [
      {
        label: `No fact about $${c1}$, $${c2}$, $${rr}$ or $${s}$ was used except that they are two circles' centers and radii`,
        correct: true,
      },
      {
        label: `The same steps work for radii $${a}$ and $${b}$`,
        feedback:
          "One pair of radii is one example. A general claim needs an argument that works for every pair.",
      },
      {
        label: "Every circle's circumference divided by its diameter is $\\pi$",
        feedback:
          "That constant ratio is a consequence of all circles being similar, not a reason for it.",
      },
      {
        label:
          "Every circle is a dilation of a unit circle, so all circles are congruent",
        feedback:
          "A dilation changes size, so circles of different radii are not congruent. They are similar.",
      },
    ],
  };
  return sets[star];
}

function flawArgument(
  r: Random,
  flaw: Flaw,
): Omit<ArgumentCase, "ask" | "star" | "flaw"> {
  const y = symbols(r, flaw === "example");
  const { c1, c2, r: rr, s, k, kInv } = y;
  const valid = validSteps(y);
  const { A, B } = centersOf(y);
  const kd = y.sd / y.rd;
  const noFlaw = (why: string): ChoiceOption => ({
    label: NO_FLAW,
    feedback: why,
  });
  switch (flaw) {
    case "inverted": {
      const image = { center: B, r: (y.rd * y.rd) / y.sd };
      return {
        y,
        steps: [
          valid[0]!,
          `Dilate about $${c2}$ by $${kInv}$. The image of circle $${c1}'$ is circle $${c2}$.`,
          valid[2]!,
          valid[3]!,
        ],
        flawed: 1,
        translated: "named",
        extra: { ...image, label: "step 2 image" },
        image,
        options: [
          {
            label: `Step 2: the dilation makes the radius $${kInv}\\cdot ${rr}$, not $${s}$`,
            correct: true,
          },
          {
            label: `Step 2: the dilation should be about $${c1}$, not $${c2}$`,
            feedback: `About $${c1}$ the center would leave $${c2}$. The center $${c2}$ is right; the factor is inverted and must be $${k}$.`,
          },
          {
            label:
              "Step 1: a translation cannot move a circle onto another circle's center",
            feedback: `A translation can do that: the translation by $${vec(c1, c2)}$ moves every point by the vector from $${c1}$ to $${c2}$, so the center lands on $${c2}$.`,
          },
          noFlaw(
            `Step 2 gives the dashed circle of radius $${kInv}\\cdot ${rr}$. It is circle $${c2}$ only when $${rr}=${s}$.`,
          ),
        ],
      };
    }
    case "center": {
      const image = {
        center: [A[0] + kd * (B[0] - A[0]), A[1] + kd * (B[1] - A[1])] as Pt,
        r: y.sd,
      };
      return {
        y,
        steps: [
          valid[0]!,
          `Dilate about $${c1}$ by $${k}$. The image of circle $${c1}'$ is circle $${c2}$.`,
          valid[2]!,
          valid[3]!,
        ],
        flawed: 1,
        translated: "named",
        extra: { ...image, label: "step 2 image" },
        image,
        options: [
          {
            label: `Step 2: a dilation about $${c1}$ moves the center $${c2}$ of circle $${c1}'$ off $${c2}$`,
            correct: true,
          },
          {
            label: `Step 2: the scale factor should be $${kInv}$`,
            feedback: `A factor of $${kInv}$ would make the radius $${kInv}\\cdot ${rr}$. The factor $${k}$ is right; the center must be $${c2}$.`,
          },
          {
            label:
              "Step 3: a translation followed by a dilation is not a similarity transformation",
            feedback:
              "A translation followed by a dilation is a similarity transformation: a similarity transformation is any sequence of rigid motions and dilations.",
          },
          noFlaw(
            `Dilating about $${c1}$ moves the center $${c2}$ along ray $${c1}${c2}$ to $${k}$ times its distance from $${c1}$, so the dashed image misses circle $${c2}$.`,
          ),
        ],
      };
    }
    case "example": {
      return {
        y,
        steps: [
          valid[0]!,
          valid[1]!,
          valid[2]!,
          "Therefore all circles are similar.",
        ],
        flawed: 3,
        translated: "named",
        options: [
          {
            label: `Step 4: the steps used radii $${rr}$ and $${s}$ only, so they prove only that these two circles are similar`,
            correct: true,
          },
          {
            label:
              "Step 4: circles with different radii are not similar, because they are not congruent",
            feedback:
              "Similar figures need not be congruent; a dilation changes size. All circles are similar, but this argument does not prove it.",
          },
          {
            label: `Step 2: the scale factor should be $${kInv}$`,
            feedback: `Radius $${rr}$ times $${k}$ is $${s}$, so $${k}$ is right.`,
          },
          noFlaw(
            `Steps 1 to 3 use the radii $${rr}$ and $${s}$. One example cannot prove a claim about every pair of circles.`,
          ),
        ],
      };
    }
    case "circular": {
      return {
        y,
        steps: [
          valid[0]!,
          `Circle $${c1}'$ and circle $${c2}$ have the same shape, so a similarity transformation maps circle $${c1}'$ onto circle $${c2}$.`,
          `A translation followed by that similarity transformation maps circle $${c1}$ onto circle $${c2}$, so circle $${c1}$ is similar to circle $${c2}$.`,
          valid[3]!,
        ],
        flawed: 1,
        translated: "named",
        options: [
          {
            label:
              "Step 2: having the same shape is what similar means, so it assumes what is being proved",
            correct: true,
          },
          {
            label: `Step 2: circle $${c1}'$ and circle $${c2}$ do not have the same shape`,
            feedback:
              "They do; all circles are similar. The flaw is that step 2 assumes this instead of showing a transformation.",
          },
          {
            label:
              "Step 3: a translation followed by a similarity transformation is not a similarity transformation",
            feedback:
              "A translation followed by a similarity transformation is still a sequence of rigid motions and dilations, so it is a similarity transformation.",
          },
          noFlaw(
            `Step 2 never names the dilation (center $${c2}$, factor $${k}$). It uses "same shape", which is the claim being proved.`,
          ),
        ],
      };
    }
    case "slide": {
      const image = { center: B, r: y.rd };
      return {
        y,
        steps: [
          `Translate by $${vec(c1, c2)}$. The image of circle $${c1}$ is circle $${c2}$.`,
          `A translation is a rigid motion, so circle $${c1}$ is similar to circle $${c2}$.`,
          valid[3]!,
        ],
        flawed: 0,
        translated: "image",
        image,
        options: [
          {
            label: `Step 1: a translation keeps radius $${rr}$, so the image is not circle $${c2}$, whose radius is $${s}$`,
            correct: true,
          },
          {
            label: `Step 1: the translation should be by $${vec(c2, c1)}$`,
            feedback: `By $${vec(c2, c1)}$ the center would move away from $${c2}$. The vector $${vec(c1, c2)}$ is right; the radius is the problem.`,
          },
          {
            label:
              "Step 2: a rigid motion cannot show that two figures are similar",
            feedback:
              "A rigid motion is a similarity transformation with scale factor $1$, so step 2 follows from step 1.",
          },
          noFlaw(
            `The translation's image is the dashed circle: center $${c2}$ but radius $${rr}$. It misses circle $${c2}$ whenever $${rr}\\ne ${s}$.`,
          ),
        ],
      };
    }
    case "ratio": {
      return {
        y,
        steps: [
          "Every circle's circumference divided by its diameter is $\\pi$.",
          `So circles $${c1}$ and $${c2}$ have the same ratio of circumference to diameter, and circle $${c1}$ is similar to circle $${c2}$.`,
          valid[3]!,
        ],
        flawed: 1,
        translated: null,
        options: [
          {
            label:
              "Step 2: an equal ratio is a result of similarity; it is not a transformation mapping one circle onto the other",
            correct: true,
          },
          {
            label:
              "Step 2: circumference divided by diameter is $2\\pi$, not $\\pi$",
            feedback:
              "The ratio is $\\pi$, since circumference is $\\pi$ times the diameter. The number is right; the conclusion does not follow.",
          },
          {
            label:
              "Step 1: circumference divided by diameter is larger for larger circles",
            feedback:
              "Circumference divided by diameter is $\\pi$ for every circle, so step 1 is a true fact.",
          },
          noFlaw(
            "Step 2 names no rigid motion and no dilation. Similar means such a sequence maps one figure onto the other.",
          ),
        ],
      };
    }
  }
}

function argumentCase(r: Random, ask: Ask): ArgumentCase {
  const star = pick(r, STARS);
  const flaw = pick(r, FLAWS);
  if (ask === "flaw") return { ask, star, flaw, ...flawArgument(r, flaw) };
  const y = symbols(r, false);
  if (ask === "justify")
    return {
      ask,
      star,
      flaw,
      y,
      steps: validSteps(y),
      flawed: -1,
      translated: "named",
      options: justifyOptions(r, y, star),
    };
  const { c1, c2 } = y;
  const wrong: ChoiceOption[] = shuffle(r, [
    {
      label: "Dilations map circles to circles",
      feedback: `True, but incomplete: it does not say which transformations map circle $${c1}$ onto circle $${c2}$, whose centers differ.`,
    },
    {
      label: "All circles have the same shape",
      feedback:
        "Having the same shape is what similar means, so this repeats the claim instead of explaining it.",
    },
    {
      label: "For every circle, circumference divided by diameter is $\\pi$",
      feedback:
        "That constant ratio follows from circles being similar; it is not a transformation from one circle to another.",
    },
    {
      label: "A translation can map any circle onto any other circle",
      feedback:
        "A translation keeps the radius, so it maps a circle only onto a circle of the same radius.",
    },
  ] as ChoiceOption[]).slice(0, 3);
  return {
    ask,
    star,
    flaw,
    y,
    steps: [],
    flawed: -1,
    translated: null,
    options: [
      {
        label:
          "Translate one center onto the other, then dilate about it by the ratio of the radii: one circle lands on the other",
        correct: true,
      },
      ...wrong,
    ],
  };
}

const stepList = (steps: string[]) =>
  steps.map((s, i) => `Step ${i + 1}: ${s}`).join(" ");

function argumentPrompt(c: ArgumentCase): string {
  const { c1, c2, r, s } = c.y;
  const setup = `Circle $${c1}$ has center $${c1}$ and radius $${r}$; circle $${c2}$ has center $${c2}$ and radius $${s}$.`;
  if (c.ask === "justify")
    return `${setup} Here is a proof that all circles are similar. ${stepList(c.steps)} Which reason justifies step ${STARS.indexOf(c.star) + 1}?`;
  if (c.ask === "flaw")
    return `${setup} Here is an argument that all circles are similar. ${stepList(c.steps)} Does a step fail to follow from the facts and steps before it? Choose the flawed step and why, or choose that there is no flaw.`;
  return `${setup} Why are all circles similar? Choose the explanation that is correct and complete.`;
}

function argumentHint(c: ArgumentCase): string {
  const { c1, c2, r, s } = c.y;
  if (c.ask === "justify")
    return `Read the claim in step ${STARS.indexOf(c.star) + 1} about circles $${c1}$ and $${c2}$, and choose the reason that proves that claim. A fact that holds only once the circles are known to be similar cannot be the reason.`;
  if (c.ask === "flaw")
    return `Start at step 1 and test each step against the steps before it. After a translation, compare radius $${r}$ with radius $${s}$; for a dilation, check its center and track radius $${r}$; for a conclusion, ask what was actually shown.`;
  return `Circles $${c1}$ and $${c2}$ differ in where their centers are and in their radii, $${r}$ and $${s}$. A complete explanation names a transformation that fixes each difference.`;
}

function argumentExplanation(c: ArgumentCase): string[] {
  const { c1, c2, r, s, k } = c.y;
  const definition =
    "Two figures are similar when a sequence of rigid motions and dilations maps one onto the other.";
  const replay = `The proof: translate by $${vec(c1, c2)}$ (center $${c1}$ goes to $${c2}$, radius stays $${r}$), then dilate about $${c2}$ by $${k}$ (radius $${r}$ becomes $${k}\\cdot ${r}=${s}$). That sequence maps circle $${c1}$ onto circle $${c2}$.`;
  const correct = c.options.find((o) => o.correct)!;
  const wrong = c.options.filter((o) => !o.correct);
  if (c.ask === "justify")
    return [
      definition,
      replay,
      `The reason for step ${STARS.indexOf(c.star) + 1}: ${correct.label.charAt(0).toLowerCase()}${correct.label.slice(1)}.`,
      ...wrong.map((o) => `Not "${o.label}": ${o.feedback}`),
    ];
  if (c.ask === "flaw") {
    const accused = wrong.find(
      (o) =>
        o.label !== NO_FLAW && !o.label.startsWith(`Step ${c.flawed + 1}:`),
    );
    const sameStep = wrong.find((o) =>
      o.label.startsWith(`Step ${c.flawed + 1}:`),
    );
    return [
      definition,
      replay,
      `Step ${c.flawed + 1} is the flaw: ${correct.label.replace(/^Step \d+: /, "")}.`,
      ...(c.extra
        ? [
            "The dashed gold circle in the figure is what that step really produces.",
          ]
        : []),
      ...(accused
        ? [`${accused.label.replace(/:.*/, "")} is valid. ${accused.feedback}`]
        : []),
      ...(sameStep
        ? [
            `The other reason given for step ${c.flawed + 1} is wrong. ${sameStep.feedback}`,
          ]
        : []),
      "So the argument has exactly one flawed step.",
    ];
  }
  return [
    definition,
    replay,
    `The circles were any two circles, so the same two transformations work for every pair. That is the correct and complete explanation.`,
    ...wrong.map((o) => `Not "${o.label}": ${o.feedback}`),
  ];
}

const argumentFamily = chainFamily({
  template: circleSimilarityProofTemplates[1]!,
  axes: {
    ask: defineAxis("ask", ["justify", "flaw", "explain"] as const, {
      weights: [2, 3, 1],
    }),
  },
  model: (r, axes) => argumentCase(r, axes.ask),
  render: (c, _axes, r) => {
    const surface = choiceSurface(r, {
      prompt: argumentPrompt(c),
      options: c.options,
      hint: argumentHint(c),
      explanation: argumentExplanation(c),
      label: c.ask === "flaw" ? "Choose the flaw" : "Choose one",
    });
    return (
      surface && {
        ...surface,
        figure: sceneFigure(
          circlesScene(c.y, {
            translated: c.translated,
            ...(c.extra ? { extra: c.extra } : {}),
          }),
        ),
      }
    );
  },
  variant: (c) =>
    c.ask === "justify"
      ? `justify-${c.star}`
      : c.ask === "flaw"
        ? `flaw-${c.flaw}`
        : "explain",
});

/* ------------------------------------- type 3: the general sequence */

/** Letters a, b, c, d (centers) and r, s (radii) for one substitution. */
export type Vals = {
  a: number;
  b: number;
  c: number;
  d: number;
  r: number;
  s: number;
};
type Op =
  | { t: "tr"; v: (x: Vals) => Pt }
  | { t: "dil"; at: (x: Vals) => Pt; k: (x: Vals) => number };
export interface SeqOption {
  key: string;
  label: string;
  ops: Op[];
  why: string;
}
/** The image of circle (a, b), r under a sequence. */
export function runSeq(ops: Op[], x: Vals): { center: Pt; r: number } {
  let center: Pt = [x.a, x.b];
  let radius = x.r;
  for (const op of ops)
    if (op.t === "tr") {
      const v = op.v(x);
      center = [center[0] + v[0], center[1] + v[1]];
    } else {
      const at = op.at(x);
      const k = op.k(x);
      center = [
        at[0] + k * (center[0] - at[0]),
        at[1] + k * (center[1] - at[1]),
      ];
      radius = Math.abs(k) * radius;
    }
  return { center, r: radius };
}
const lands = (ops: Op[], x: Vals) => {
  const out = runSeq(ops, x);
  return (
    Math.abs(out.center[0] - x.c) < 1e-9 &&
    Math.abs(out.center[1] - x.d) < 1e-9 &&
    Math.abs(out.r - x.s) < 1e-9
  );
};

/** Signed TeX term: "+3", "-3", "" for 0 is handled by callers. */
const signed = (n: number) => (n < 0 ? `-${-n}` : `+${n}`);
/** c − k·a written with a known number a, k = s/r. */
const minusKa = (cTex: string, a: number) =>
  a === 0
    ? cTex
    : `${cTex}${a < 0 ? "+" : "-"}${Math.abs(a) === 1 ? "" : Math.abs(a)}\\frac{s}{r}`;

export interface SeqCase {
  /** Numeric centers, or null for letters. */
  centers: { a: number; b: number; c: number; d: number } | null;
  options: SeqOption[];
}

export function seqOptions(centers: SeqCase["centers"]): SeqOption[] {
  const fixed = centers;
  const A = (x: Vals): Pt => (fixed ? [fixed.a, fixed.b] : [x.a, x.b]);
  const B = (x: Vals): Pt => (fixed ? [fixed.c, fixed.d] : [x.c, x.d]);
  const AB = (x: Vals): Pt => [B(x)[0] - A(x)[0], B(x)[1] - A(x)[1]];
  const k = (x: Vals) => x.s / x.r;
  const aT = fixed ? `(${fixed.a},${fixed.b})` : "(a,b)";
  const bT = fixed ? `(${fixed.c},${fixed.d})` : "(c,d)";
  const v = fixed
    ? `\\langle ${fixed.c - fixed.a},\\ ${fixed.d - fixed.b}\\rangle`
    : "\\langle c-a,\\ d-b\\rangle";
  const vRev = fixed
    ? `\\langle ${fixed.a - fixed.c},\\ ${fixed.b - fixed.d}\\rangle`
    : "\\langle a-c,\\ b-d\\rangle";
  const vOrigin = fixed
    ? `\\langle ${minusKa(`${fixed.c}`, fixed.a)},\\ ${minusKa(`${fixed.d}`, fixed.b)}\\rangle`
    : "\\langle c-\\frac{s}{r}a,\\ d-\\frac{s}{r}b\\rangle";
  const tr = (f: (x: Vals) => Pt): Op => ({ t: "tr", v: f });
  const dil = (at: (x: Vals) => Pt, kk: (x: Vals) => number): Op => ({
    t: "dil",
    at,
    k: kk,
  });
  const origin = (): Pt => [0, 0];
  return [
    {
      key: "translate-dilate",
      label: `Translate by $${v}$, then dilate about $${bT}$ by $\\frac{s}{r}$`,
      ops: [tr(AB), dil(B, k)],
      why: `The translation moves the center to $${bT}$ and keeps radius $r$; the dilation about $${bT}$ keeps that center and makes the radius $\\frac{s}{r}\\cdot r=s$.`,
    },
    {
      key: "dilate-translate",
      label: `Dilate about $${aT}$ by $\\frac{s}{r}$, then translate by $${v}$`,
      ops: [dil(A, k), tr(AB)],
      why: `The dilation about the center $${aT}$ keeps the center and makes the radius $s$; the translation then moves the center to $${bT}$.`,
    },
    {
      key: "origin-compensated",
      label: `Dilate about $(0,0)$ by $\\frac{s}{r}$, then translate by $${vOrigin}$`,
      ops: [
        dil(origin, k),
        tr((x) => [B(x)[0] - k(x) * A(x)[0], B(x)[1] - k(x) * A(x)[1]]),
      ],
      why: `The dilation about the origin sends the center to $\\frac{s}{r}$ times its coordinates and makes the radius $s$; this translation then moves that point exactly to $${bT}$.`,
    },
    {
      key: "inverted",
      label: `Translate by $${v}$, then dilate about $${bT}$ by $\\frac{r}{s}$`,
      ops: [tr(AB), dil(B, (x) => x.r / x.s)],
      why: "The factor is inverted: the radius becomes $\\frac{r}{s}\\cdot r=\\frac{r^2}{s}$, which is $s$ only when $r=s$.",
    },
    {
      key: "reversed",
      label: `Translate by $${vRev}$, then dilate about $${bT}$ by $\\frac{s}{r}$`,
      ops: [tr((x) => [-AB(x)[0], -AB(x)[1]]), dil(B, k)],
      why: `The vector points the wrong way: the center moves to $${fixed ? `(${2 * fixed.a - fixed.c},${2 * fixed.b - fixed.d})` : "(2a-c,\\ 2b-d)"}$, and the dilation about $${bT}$ cannot bring it back to $${bT}$.`,
    },
    {
      key: "origin",
      label: `Dilate about $(0,0)$ by $\\frac{s}{r}$, then translate by $${v}$`,
      ops: [dil(origin, k), tr(AB)],
      why: `The dilation about the origin moves the center to $\\frac{s}{r}$ times its coordinates, so after the translation it is off $${bT}$ unless $r=s$ or the center was the origin.`,
    },
    {
      key: "old-center",
      label: `Translate by $${v}$, then dilate about $${aT}$ by $\\frac{s}{r}$`,
      ops: [tr(AB), dil(A, k)],
      why: `After the translation the center is $${bT}$; a dilation about $${aT}$ moves it off $${bT}$, so the dilation must be about the center the circle has at that moment.`,
    },
    {
      key: "difference",
      label: `Translate by $${v}$, then dilate about $${bT}$ by $s-r$`,
      ops: [tr(AB), dil(B, (x) => x.s - x.r)],
      why: "A dilation multiplies: the radius becomes $(s-r)r$, which is not $s$ in general (for $r=1$ and $s=3$ it is $2$).",
    },
    {
      key: "area-ratio",
      label: `Translate by $${v}$, then dilate about $${bT}$ by $\\frac{s^2}{r^2}$`,
      ops: [tr(AB), dil(B, (x) => (x.s * x.s) / (x.r * x.r))],
      why: "$\\frac{s^2}{r^2}$ is the ratio of the areas; the radius becomes $\\frac{s^2}{r}$, not $s$.",
    },
  ];
}

/** Fixed sample substitutions: distinct centers, unequal radii. */
export const SAMPLES: Vals[] = [
  { a: 1, b: 2, c: 7, d: -3, r: 2, s: 5 },
  { a: -4, b: 3, c: 2, d: 6, r: 6, s: 1.5 },
  { a: 0.5, b: -2, c: -6, d: -1, r: 3, s: 4.5 },
  { a: 3, b: 3, c: -2, d: 8, r: 1, s: 3 },
  { a: -1, b: -5, c: 4, d: 2, r: 4, s: 2.5 },
  { a: 2.5, b: 0, c: 0, d: 4, r: 5, s: 7 },
];
const sampleFor = (centers: SeqCase["centers"]): Vals[] =>
  centers ? SAMPLES.map((x) => ({ ...x, ...centers })) : SAMPLES;
/** Holds for every sample substitution: computed, never asserted. */
export const holdsForAll = (o: SeqOption, centers: SeqCase["centers"]) =>
  sampleFor(centers).every((x) => lands(o.ops, x));

const STATEMENT_NAMES = [
  ["A", "B"],
  ["P", "Q"],
  ["M", "N"],
] as const;

function circlesPlane(
  n: readonly [string, string],
  centers: SeqCase["centers"],
  rd: number,
  sd: number,
): Scene {
  // Letters only: the circles sit in opposite quadrants, clear of the axes
  // and of each other's names.
  const [a, b, c, d] = centers
    ? [centers.a, centers.b, centers.c, centers.d]
    : [-(rd + 1.4), rd + 1.8, sd + 1.4, -(sd + 1.2)];
  const lo = Math.min(a - rd, c - sd, -1) - 1.2;
  const hi = Math.max(a + rd, c + sd, 1) + 1.2;
  const ylo = Math.min(b - rd, d - sd, -1) - 1.2;
  const yhi = Math.max(b + rd, d + sd, 1) + 1.2;
  const g = graph({
    x: [Math.floor(lo), Math.ceil(hi)],
    y: [Math.floor(ylo), Math.ceil(yhi)],
    grid: centers ? 1 : false,
    tick: 2,
    aspect: 1,
    labels: centers ? "auto" : "none",
    axisNames: ["x", "y"],
  })
    .circle([a, b], rd, { showCenter: true })
    .circle([c, d], sd, { showCenter: true })
    .point(a, b, undefined, { color: "accent" })
    .point(c, d, undefined, { color: "ink" });
  // Center names sit under each circle, clear of its outline.
  const under = (
    id: string,
    text: string,
    x: number,
    y: number,
    rad: number,
  ): Element => ({
    type: "text",
    id,
    at: [x, y - rad],
    text,
    font: "math",
    bold: true,
    halo: true,
    align: [0, -1],
    offset: [0, 6],
  });
  return sceneOf(
    g,
    under("na", centers ? `${n[0]}(${a}, ${b})` : `${n[0]}(a, b)`, a, b, rd),
    under("nb", centers ? `${n[1]}(${c}, ${d})` : `${n[1]}(c, d)`, c, d, sd),
  ).build({
    title: `Circle ${n[0]} with center ${centers ? `(${a}, ${b})` : "(a, b)"} and radius r, and circle ${n[1]} with center ${centers ? `(${c}, ${d})` : "(c, d)"} and radius s`,
  });
}

type MapAsk = "sequence" | "statements";
const generalFamily = selectFamily(
  circleSimilarityProofTemplates[2]!,
  (r, axes) => {
    const ask = axes.ask as MapAsk;
    const n = pick(r, STATEMENT_NAMES);
    const rd = 1 + 0.2 * r(0, 3);
    const sd = rd * (r(0, 1) ? 1.5 + 0.1 * r(0, 4) : 0.55 + 0.05 * r(0, 2));
    const k = r(2, 3);
    if (ask === "sequence") {
      let centers: SeqCase["centers"] = null;
      if (axes.coords === "numeric") {
        do {
          centers = { a: r(-8, 8), b: r(-8, 8), c: r(-8, 8), d: r(-8, 8) };
        } while (
          (centers.a === 0 && centers.b === 0) ||
          Math.hypot(centers.c - centers.a, centers.d - centers.b) <
            rd + sd + 1 ||
          Math.max(Math.abs(centers.a), Math.abs(centers.b)) + rd > 9 ||
          Math.max(Math.abs(centers.c), Math.abs(centers.d)) + sd > 9
        );
      }
      const options = seqOptions(centers);
      const pool: Statement[] = options.map((o) =>
        st(o.label, holdsForAll(o, centers), o.why),
      );
      const where = centers
        ? `center $(${centers.a},${centers.b})$`
        : "center $(a,b)$";
      const whereB = centers
        ? `center $(${centers.c},${centers.d})$`
        : "center $(c,d)$";
      return selectModel({
        variant: `sequence-${centers ? "numeric" : "symbolic"}`,
        pool,
        total: 5,
        k,
        context: `Circle $${n[0]}$ has ${where} and radius $r$. Circle $${n[1]}$ has ${whereB} and radius $s$.`,
        ask: (kk) =>
          `Which sequences map circle $${n[0]}$ onto circle $${n[1]}$ for every ${centers ? "pair of positive radii $r$ and $s$" : "choice of $a$, $b$, $c$, $d$ and positive $r$, $s$"}? Select the ${kk} sequences that do.`,
        one: "sequence",
        hint: (shown) =>
          `For each of the ${shown.length} sequences, track where the center ${centers ? `$(${centers.a},${centers.b})$` : "$(a,b)$"} of circle $${n[0]}$ goes and what radius $r$ becomes; ${shown.filter((s) => s.holds).length} of them end at circle $${n[1]}$. The vector is end minus start, the factor is new radius over old, and a dilation must be about the center the circle has at that moment.`,
        figure: sceneFigure(circlesPlane(n, centers, rd, sd)),
        lead: [
          `A sequence works when it sends the center of circle $${n[0]}$ to ${centers ? `$(${centers.c},${centers.d})$` : "$(c,d)$"} and radius $r$ to $s$, whatever the letters stand for.`,
        ],
        tail: [
          "A translation keeps the radius; a dilation multiplies the radius by its factor and moves the center unless the dilation is about that center.",
        ],
      });
    }
    const [X, Y] = n;
    const pool: Statement[] = [
      st(
        "The dilation's scale factor is $\\frac{s}{r}$, the ratio of the radii",
        true,
        "It must turn radius $r$ into $s$, and $\\frac{s}{r}\\cdot r=s$.",
      ),
      st(
        `If the circles are concentric, a dilation alone maps circle $${X}$ onto circle $${Y}$`,
        true,
        "Concentric circles share a center, so the translation is by the zero vector; the dilation about that center does the rest.",
      ),
      st(
        "If $r=s$, the scale factor is $1$ and the circles are congruent, a special case of similar",
        true,
        "A dilation by $1$ moves no point, so the translation alone maps one circle onto the other.",
      ),
      st(
        `Any rigid motion that carries center $${X}$ to center $${Y}$ can replace the translation`,
        true,
        `A rigid motion keeps every distance, so it maps circle $${X}$ onto the circle with center $${Y}$ and radius $r$, just as the translation does.`,
      ),
      st(
        `A translation alone maps circle $${X}$ onto circle $${Y}$`,
        false,
        "Only when $r=s$: a translation keeps the radius $r$.",
      ),
      st(
        "The dilation must be centered at the origin",
        false,
        `It must be centered at $${Y}$, the center after the translation; a dilation about another point moves the center off $${Y}$.`,
      ),
      st(
        "The scale factor is $\\frac{s^2}{r^2}$",
        false,
        "That is the ratio of the areas; the radius would become $\\frac{s^2}{r}$, not $s$.",
      ),
      st(
        "The scale factor is $s-r$",
        false,
        "A dilation multiplies the radius: for $r=1$ and $s=3$, the factor $2$ gives radius $2$, not $3$.",
      ),
      st(
        "Circles with different radii are not similar because they are not congruent",
        false,
        "Similar figures need not be congruent: a dilation changes size and keeps shape.",
      ),
      st(
        "The proof works only when $r<s$",
        false,
        "When $r>s$ the factor $\\frac{s}{r}$ is less than $1$ and shrinks the circle; every step is the same.",
      ),
    ];
    return selectModel({
      variant: "statements",
      pool,
      total: 5,
      k,
      context: `The proof that all circles are similar translates circle $${X}$ (radius $r$) so that its center lands on the center of circle $${Y}$ (radius $s$), then dilates about that center.`,
      ask: (kk) =>
        `Select the ${kk} statements that are true for any two circles $${X}$ and $${Y}$.`,
      hint: (shown) =>
        `${shown.filter((s) => s.holds).length} of the statements about circles $${X}$ and $${Y}$ hold for every pair. Test each one on special cases: concentric circles, equal radii, and $r$ larger than $s$.`,
      figure: sceneFigure(circlesPlane(n, null, rd, sd)),
      lead: [
        "A statement is true for any two circles only if no pair of centers and radii breaks it.",
      ],
    });
  },
  {
    ask: defineAxis("ask", ["sequence", "statements"] as const),
    coords: defineAxis("coords", ["symbolic", "numeric"] as const, {
      weights: [7, 3],
    }),
  },
);

export const circleSimilarityProofGenerate = dispatch(
  circleSimilarityProofTemplates,
  {
    "circle-similarity-proof-steps": (seed) =>
      proofFamily.generate(seed).problem,
    "circle-similarity-justify-flaw": (seed) =>
      argumentFamily.generate(seed).problem,
    "circle-similarity-general-map": (seed) =>
      generalFamily.generate(seed).problem,
  },
);
export const circleSimilarityProofCases = {
  "circle-similarity-proof-steps": proofFamily.generate,
  "circle-similarity-justify-flaw": argumentFamily.generate,
  "circle-similarity-general-map": generalFamily.generate,
};
