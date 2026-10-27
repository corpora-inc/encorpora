import type { TemplateMetadata } from "./contracts";
import { chainFamily, dispatch, pick } from "./chain-kit";
import { shuffle } from "./distribution-practice";
import {
  figureAngleMark,
  figureName,
  figureParallelMark,
  figureRightMark,
  figureScene,
  figureSegment,
  figureTicks,
  sceneFigure,
} from "./geometry-teaching-figures";
import type { Element, Point, Scene } from "./scene/spec";
import {
  proofWork,
  workModeAxis,
  workSurface,
  type ProofModel,
} from "./structured-work-kit";
import { defineAxis, type Random } from "./variation/axes";

/**
 * Two-column proofs that two triangles are similar by AA and that a
 * proportion of their sides follows. Statements and reasons come from banks
 * with unproved, out-of-order and false lines; any proof the claims support
 * is accepted, in any valid order.
 */

const capability = "structured-work-v1" as const;
export const similarityProofTemplates: readonly TemplateMetadata[] = [
  {
    id: "similarity-proof-aa",
    version: 1,
    title: "Write a two-column similarity proof",
    skillId: "similarity-proofs",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    requiredResponseCapability: capability,
    requiredFigureCapability: "scenes-v1",
    description:
      "Prove two triangles similar by AA and state the proportion of their sides: a segment perpendicular to a leg of a right triangle, the altitude to the hypotenuse, a segment parallel to a side, or two perpendiculars to the base of an isosceles triangle. Build the proof, name its reasons or order its lines.",
  },
];

const REASONS: Record<string, string> = {
  given: "Given",
  perpendicular: "Perpendicular lines form congruent right angles",
  corresponding: "Corresponding angles of parallel lines are congruent",
  reflexive: "Reflexive property of congruence",
  aa: "AA: two pairs of congruent angles make triangles similar",
  ratio: "Corresponding sides of similar triangles are proportional",
  sas: "SAS similarity",
  cpctc: "CPCTC (corresponding parts of congruent triangles)",
  altInt: "Alternate interior angles of parallel lines are congruent",
  midpoint: "Definition of midpoint",
  isosceles: "Base angles of an isosceles triangle are congruent",
  rearrange:
    "Exchanging the means of a proportion gives another true proportion",
};

type Claim = Record<string, string[][]>;
interface Statement {
  key: string;
  tex: string;
  claim: Claim;
}
interface Case {
  config: string;
  given: string[];
  goalTex: string;
  statements: Statement[];
  reasons: string[];
  path: [string, string][];
  goal: string;
  scene: Scene;
  hint: string;
  why: string[];
}

function assemble(r: Random, c: Case): ProofModel {
  const shown = shuffle(r, [...c.statements]);
  const sid = new Map(shown.map((s, i) => [s.key, `s${"abcdefghij"[i]}`]));
  const rid = new Map(c.reasons.map((k, i) => [k, `r${"abcdefghijkl"[i]}`]));
  const claims: ProofModel["claims"] = {};
  for (const s of c.statements) {
    const byReason: Record<string, string[][]> = {};
    for (const [reason, sets] of Object.entries(s.claim))
      if (rid.has(reason))
        byReason[rid.get(reason)!] = sets.map((set) =>
          set.map((k) => sid.get(k)!),
        );
    if (Object.keys(byReason).length) claims[sid.get(s.key)!] = byReason;
  }
  return {
    statements: shown.map((s) => ({ id: sid.get(s.key)!, label: s.tex })),
    reasons: c.reasons.map((k) => ({ id: rid.get(k)!, label: REASONS[k]! })),
    claims,
    goal: sid.get(c.goal)!,
    goalTex: c.statements.find((s) => s.key === c.goal)!.tex,
    path: c.path.map(([s, reason]) => [sid.get(s)!, rid.get(reason)!]),
  };
}

/* ------------------------------------------------------------- figure */

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
function figure(
  title: string,
  at: Record<string, Point>,
  letters: Record<string, string>,
  m: {
    segments: [string, string][];
    right?: [string, string, string][];
    angles?: [string, string, string, number][];
    parallel?: [string, string, number][];
    ticks?: [string, string, number][];
  },
): Scene {
  const pts = Object.values(at);
  const center: Point = [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
  const els: Element[] = [];
  for (const [a, b] of m.segments)
    els.push(figureSegment(`s${a}${b}`, at[a]!, at[b]!));
  for (const [a, b, n] of m.parallel ?? [])
    els.push(...figureParallelMark(`p${a}${b}`, at[a]!, at[b]!, n, 0.32));
  for (const [a, b, n] of m.ticks ?? [])
    els.push(...figureTicks(`t${a}${b}`, at[a]!, at[b]!, n));
  for (const [p, v, q, n] of m.angles ?? [])
    els.push(
      ...figureAngleMark(`a${p}${v}${q}`, at[v]!, at[p]!, at[q]!, {
        arcs: n,
        r: 0.55,
      }),
    );
  for (const [p, v, q] of m.right ?? [])
    els.push(figureRightMark(`r${p}${v}${q}`, at[v]!, at[p]!, at[q]!, 0.32));
  for (const k of Object.keys(at))
    els.push(figureName(`n${k}`, letters[k]!, at[k]!, sub(at[k]!, center)));
  return figureScene(title, els);
}

/* -------------------------------------------------------------- cases */

const math = (s: string) => `$${s}$`;
const overline = (a: string, b: string) => `\\overline{${a}${b}}`;
const ang = (a: string, b: string, c: string) => `\\angle ${a}${b}${c}`;
const tri = (a: string, b: string, c: string) => `\\triangle ${a}${b}${c}`;
const ratio = (a: string, b: string, c: string, d: string) =>
  `\\frac{${a}}{${b}}=\\frac{${c}}{${d}}`;
const given = (key: string, tex: string): Statement => ({
  key,
  tex,
  claim: { given: [[]] },
});
const letterSets7 = [
  ["A", "B", "C", "D", "E", "F", "H"],
  ["P", "Q", "R", "S", "T", "U", "W"],
  ["J", "K", "L", "M", "N", "X", "Y"],
] as const;
const letterSets = [
  ["A", "B", "C", "D", "E"],
  ["P", "Q", "R", "S", "T"],
  ["J", "K", "L", "M", "N"],
  ["F", "G", "H", "K", "M"],
] as const;

type Config = "perpendicular-leg" | "altitude" | "parallel" | "isosceles";

function similarityCase(r: Random, config: Config): Case {
  const set7 = pick(r, letterSets7);
  const set = config === "isosceles" ? set7 : pick(r, letterSets);
  const L: Record<string, string> = {
    A: set[0],
    B: set[1],
    C: set[2],
    D: set[3],
    E: set[4],
  };
  const [A, B, C, D, E] = [L.A!, L.B!, L.C!, L.D!, L.E!];
  if (config === "perpendicular-leg") {
    // Right angle at B; D on BA and E on AC with DE perpendicular to BA.
    const at: Record<string, Point> = {
      B: [0, 0],
      C: [6, 0],
      A: [0, 4.5],
      D: [0, 1.8],
      E: [3.6, 1.8],
    };
    const g1 = math(`${overline(A, B)}\\perp${overline(B, C)}`);
    const g2 = math(`${overline(A, B)}\\perp${overline(D, E)}`);
    const right = math(`${ang(A, D, E)}\\cong${ang(A, B, C)}`);
    const shared = math(`${ang(D, A, E)}\\cong${ang(B, A, C)}`);
    const sim = math(`${tri(A, D, E)}\\sim${tri(A, B, C)}`);
    const goal = math(ratio(`${A}${D}`, `${A}${B}`, `${D}${E}`, `${B}${C}`));
    return {
      config,
      given: [g1, g2],
      goalTex: goal,
      statements: [
        given("g1", g1),
        given("g2", g2),
        { key: "right", tex: right, claim: { perpendicular: [["g1", "g2"]] } },
        { key: "shared", tex: shared, claim: { reflexive: [[]] } },
        {
          key: "sim",
          tex: sim,
          claim: { aa: [["right", "shared"]] },
        },
        { key: "goal", tex: goal, claim: { ratio: [["sim"]] } },
        {
          key: "wrongOrder",
          tex: math(`${tri(A, D, E)}\\sim${tri(A, C, B)}`),
          claim: {},
        },
        {
          key: "wrongRatio",
          tex: math(ratio(`${A}${D}`, `${A}${B}`, `${D}${E}`, `${A}${C}`)),
          claim: {},
        },
      ],
      reasons: [
        "given",
        "perpendicular",
        "reflexive",
        "aa",
        "ratio",
        "sas",
        "cpctc",
      ],
      path: [
        ["g1", "given"],
        ["g2", "given"],
        ["right", "perpendicular"],
        ["shared", "reflexive"],
        ["sim", "aa"],
        ["goal", "ratio"],
      ],
      goal: "goal",
      scene: figure(
        `Right triangle ${A}${B}${C} with right angle at ${B} and segment ${D}${E} perpendicular to ${A}${B}`,
        at,
        L,
        {
          segments: [
            ["A", "B"],
            ["B", "C"],
            ["A", "C"],
            ["D", "E"],
          ],
          right: [
            ["A", "B", "C"],
            ["A", "D", "E"],
          ],
        },
      ),
      hint: `Both $\\overline{${B}${C}}$ and $\\overline{${D}${E}}$ are perpendicular to $\\overline{${A}${B}}$. Which angle of $${tri(A, D, E)}$ matches $${ang(A, B, C)}$, and which angle do the two triangles share at $${A}$?`,
      why: [
        `Perpendicular segments make right angles at $${B}$ and $${D}$, and all right angles are congruent: $${ang(A, D, E)}\\cong${ang(A, B, C)}$.`,
        `Both triangles contain the angle at $${A}$, so $${ang(D, A, E)}\\cong${ang(B, A, C)}$ by the reflexive property.`,
        `Two pairs of congruent angles make the triangles similar (AA), and corresponding sides of similar triangles are proportional: ${AD(A, D)} corresponds to ${AD(A, B)}, and ${AD(D, E)} to ${AD(B, C)}.`,
      ],
    };
  }
  if (config === "altitude") {
    // Right angle at C; CD is the altitude to the hypotenuse AB.
    const at: Record<string, Point> = {
      A: [0, 0],
      B: [6, 0],
      C: [1.2, 2.4],
      D: [1.2, 0],
    };
    const g1 = math(`${overline(A, C)}\\perp${overline(B, C)}`);
    const g2 = math(`${overline(C, D)}\\perp${overline(A, B)}`);
    const right = math(`${ang(A, D, C)}\\cong${ang(A, C, B)}`);
    const shared = math(`${ang(D, A, C)}\\cong${ang(C, A, B)}`);
    const sim = math(`${tri(A, D, C)}\\sim${tri(A, C, B)}`);
    const goal = math(ratio(`${A}${D}`, `${A}${C}`, `${A}${C}`, `${A}${B}`));
    return {
      config,
      given: [g1, g2],
      goalTex: goal,
      statements: [
        given("g1", g1),
        given("g2", g2),
        { key: "right", tex: right, claim: { perpendicular: [["g1", "g2"]] } },
        { key: "shared", tex: shared, claim: { reflexive: [[]] } },
        { key: "sim", tex: sim, claim: { aa: [["right", "shared"]] } },
        { key: "goal", tex: goal, claim: { ratio: [["sim"]] } },
        {
          key: "wrongOrder",
          tex: math(`${tri(A, D, C)}\\sim${tri(A, B, C)}`),
          claim: {},
        },
        {
          key: "wrongRatio",
          tex: math(ratio(`${A}${D}`, `${A}${C}`, `${C}${D}`, `${A}${B}`)),
          claim: {},
        },
      ],
      reasons: [
        "given",
        "perpendicular",
        "reflexive",
        "aa",
        "ratio",
        "sas",
        "cpctc",
      ],
      path: [
        ["g1", "given"],
        ["g2", "given"],
        ["right", "perpendicular"],
        ["shared", "reflexive"],
        ["sim", "aa"],
        ["goal", "ratio"],
      ],
      goal: "goal",
      scene: figure(
        `Right triangle ${A}${B}${C} with right angle at ${C} and altitude ${C}${D} to the hypotenuse ${A}${B}`,
        at,
        L,
        {
          segments: [
            ["A", "B"],
            ["B", "C"],
            ["A", "C"],
            ["C", "D"],
          ],
          right: [
            ["A", "C", "B"],
            ["A", "D", "C"],
          ],
        },
      ),
      hint: `Triangle $${tri(A, D, C)}$ is inside $${tri(A, B, C)}$. Which angle at $${D}$ matches the right angle at $${C}$, and which angle at $${A}$ do the triangles share?`,
      why: [
        `The perpendicular segments make right angles at $${C}$ and $${D}$, so $${ang(A, D, C)}\\cong${ang(A, C, B)}$.`,
        `Both triangles contain the angle at $${A}$: $${ang(D, A, C)}\\cong${ang(C, A, B)}$ by the reflexive property.`,
        `AA gives $${sim.slice(1, -1)}$. Matching sides in that order, ${AD(A, D)} corresponds to ${AD(A, C)}, and ${AD(A, C)} to ${AD(A, B)}.`,
      ],
    };
  }
  if (config === "isosceles") {
    // AB = AC; DE and HF are perpendicular to the base BC.
    const F = set7[5]!;
    const H = set7[6]!;
    const at: Record<string, Point> = {
      A: [3, 5],
      B: [0, 0],
      C: [6, 0],
      D: [1.2, 2],
      E: [1.2, 0],
      H: [4.8, 2],
      F: [4.8, 0],
    };
    const M: Record<string, string> = { ...L, F, H };
    const givenText = math(
      `${overline(A, B)}\\cong${overline(A, C)},\\ ${overline(D, E)}\\perp${overline(B, C)}\\text{ and }${overline(H, F)}\\perp${overline(B, C)}`,
    );
    const base = math(`${ang(A, B, C)}\\cong${ang(A, C, B)}`);
    const right = math(`${ang(D, E, B)}\\cong${ang(H, F, C)}`);
    const sim = math(`${tri(D, E, B)}\\sim${tri(H, F, C)}`);
    const prop = math(ratio(`${D}${E}`, `${H}${F}`, `${B}${E}`, `${C}${F}`));
    const goal = math(ratio(`${D}${E}`, `${B}${E}`, `${H}${F}`, `${C}${F}`));
    return {
      config,
      given: [givenText],
      goalTex: goal,
      statements: [
        given("g", givenText),
        { key: "base", tex: base, claim: { isosceles: [["g"]] } },
        { key: "right", tex: right, claim: { perpendicular: [["g"]] } },
        { key: "sim", tex: sim, claim: { aa: [["base", "right"]] } },
        { key: "prop", tex: prop, claim: { ratio: [["sim"]] } },
        { key: "goal", tex: goal, claim: { rearrange: [["prop"]] } },
        {
          key: "wrongOrder",
          tex: math(`${tri(D, E, B)}\\sim${tri(F, H, C)}`),
          claim: {},
        },
        {
          key: "wrongRatio",
          tex: math(ratio(`${D}${E}`, `${B}${E}`, `${H}${F}`, `${B}${C}`)),
          claim: {},
        },
      ],
      reasons: [
        "given",
        "isosceles",
        "perpendicular",
        "aa",
        "ratio",
        "rearrange",
        "reflexive",
        "sas",
      ],
      path: [
        ["g", "given"],
        ["base", "isosceles"],
        ["right", "perpendicular"],
        ["sim", "aa"],
        ["prop", "ratio"],
        ["goal", "rearrange"],
      ],
      goal: "goal",
      scene: figure(
        `Isosceles triangle ${A}${B}${C} with ${A}${B} equal to ${A}${C}, and segments ${D}${E} and ${H}${F} perpendicular to the base ${B}${C}`,
        at,
        M,
        {
          segments: [
            ["A", "B"],
            ["B", "C"],
            ["A", "C"],
            ["D", "E"],
            ["H", "F"],
          ],
          right: [
            ["D", "E", "B"],
            ["H", "F", "C"],
          ],
          ticks: [
            ["A", "B", 1],
            ["A", "C", 1],
          ],
        },
      ),
      hint: `Triangle $${A}${B}${C}$ is isosceles, so what do you know about its base angles at $${B}$ and $${C}$? Both segments $\\overline{${D}${E}}$ and $\\overline{${H}${F}}$ meet $\\overline{${B}${C}}$ at right angles, which gives a second pair of angles for triangles $${D}${E}${B}$ and $${H}${F}${C}$.`,
      why: [
        `Because $${overline(A, B)}\\cong${overline(A, C)}$, the base angles are congruent: $${ang(A, B, C)}\\cong${ang(A, C, B)}$. The perpendicular segments make right angles at $${E}$ and $${F}$, which are congruent.`,
        `Two pairs of congruent angles give $${tri(D, E, B)}\\sim${tri(H, F, C)}$ by AA, so corresponding sides are proportional: ${AD(D, E)} corresponds to ${AD(H, F)}, and ${AD(B, E)} to ${AD(C, F)}.`,
        `Exchanging the means of $${ratio(`${D}${E}`, `${H}${F}`, `${B}${E}`, `${C}${F}`)}$ gives $${ratio(`${D}${E}`, `${B}${E}`, `${H}${F}`, `${C}${F}`)}$.`,
      ],
    };
  }
  // DE parallel to BC, with D on AB and E on AC.
  const at: Record<string, Point> = {
    A: [2.2, 4.5],
    B: [0, 0],
    C: [6, 0],
    D: [1.1, 2.25],
    E: [4.1, 2.25],
  };
  const g = math(`${overline(D, E)}\\parallel${overline(B, C)}`);
  const a1 = math(`${ang(A, D, E)}\\cong${ang(A, B, C)}`);
  const a2 = math(`${ang(A, E, D)}\\cong${ang(A, C, B)}`);
  const shared = math(`${ang(D, A, E)}\\cong${ang(B, A, C)}`);
  const sim = math(`${tri(A, D, E)}\\sim${tri(A, B, C)}`);
  const goal = math(ratio(`${A}${D}`, `${A}${B}`, `${A}${E}`, `${A}${C}`));
  return {
    config,
    given: [g],
    goalTex: goal,
    statements: [
      given("g", g),
      { key: "a1", tex: a1, claim: { corresponding: [["g"]] } },
      { key: "a2", tex: a2, claim: { corresponding: [["g"]] } },
      { key: "shared", tex: shared, claim: { reflexive: [[]] } },
      {
        key: "sim",
        tex: sim,
        claim: {
          aa: [
            ["a1", "a2"],
            ["a1", "shared"],
            ["a2", "shared"],
          ],
        },
      },
      { key: "goal", tex: goal, claim: { ratio: [["sim"]] } },
      {
        key: "wrongOrder",
        tex: math(`${tri(A, D, E)}\\sim${tri(A, C, B)}`),
        claim: {},
      },
      {
        key: "wrongRatio",
        tex: math(ratio(`${A}${D}`, `${D}${B}`, `${A}${E}`, `${A}${C}`)),
        claim: {},
      },
    ],
    reasons: [
      "given",
      "corresponding",
      "reflexive",
      "aa",
      "ratio",
      "altInt",
      "midpoint",
    ],
    path: [
      ["g", "given"],
      ["a1", "corresponding"],
      ["a2", "corresponding"],
      ["sim", "aa"],
      ["goal", "ratio"],
    ],
    goal: "goal",
    scene: figure(
      `Triangle ${A}${B}${C} with segment ${D}${E} parallel to ${B}${C}`,
      at,
      L,
      {
        segments: [
          ["A", "B"],
          ["B", "C"],
          ["A", "C"],
          ["D", "E"],
        ],
        parallel: [
          ["D", "E", 1],
          ["B", "C", 1],
        ],
      },
    ),
    hint: `Because $\\overline{${D}${E}}\\parallel\\overline{${B}${C}}$, the sides $\\overline{${A}${B}}$ and $\\overline{${A}${C}}$ are transversals. Which angles at $${D}$ and $${B}$ are corresponding angles?`,
    why: [
      `Parallel lines cut by the transversals $\\overline{${A}${B}}$ and $\\overline{${A}${C}}$ give corresponding angles: $${ang(A, D, E)}\\cong${ang(A, B, C)}$ and $${ang(A, E, D)}\\cong${ang(A, C, B)}$.`,
      `Two pairs of congruent angles make $${tri(A, D, E)}\\sim${tri(A, B, C)}$ by AA. (The shared angle at $${A}$ could replace either pair.)`,
      `Corresponding sides are proportional: ${AD(A, D)} corresponds to ${AD(A, B)}, and ${AD(A, E)} to ${AD(A, C)}.`,
    ],
  };
}
/** A side's name in prose, typeset. */
function AD(a: string, b: string) {
  return `$${a}${b}$`;
}

function render(
  c: Case,
  mode: "build" | "fill" | "order",
  r: Random,
  lead: string,
) {
  const model = assemble(r, c);
  const built = proofWork(
    model,
    mode,
    r,
    mode === "order" ? "Order the proof" : "Your proof",
  );
  const task =
    mode === "build"
      ? "Build the proof: choose a statement and a reason for each line."
      : mode === "fill"
        ? "The statements of a proof are shown. Choose the reason for each blank line."
        : "The lines of a proof are shown out of order. Put them in order.";
  const lines = c.path.map(([s, reason], i) => {
    const st = c.statements.find((x) => x.key === s)!;
    return `${i + 1}. ${st.tex} — ${REASONS[reason]}.`;
  });
  return workSurface(built, {
    prompt: `${lead} Given: ${c.given.join(" and ")}. Prove: ${c.goalTex}. ${task}`,
    hint: c.hint,
    explanation: [...c.why, "A complete proof:", ...lines],
    figure: sceneFigure(c.scene),
  });
}

const family = chainFamily({
  template: similarityProofTemplates[0]!,
  axes: {
    mode: workModeAxis,
    config: defineAxis("config", [
      "perpendicular-leg",
      "altitude",
      "parallel",
      "isosceles",
    ] as const),
  },
  model: (r, axes) => similarityCase(r, axes.config),
  render: (c, axes, r) => render(c, axes.mode, r, "Use the figure."),
  variant: (c) => c.config,
});

export const similarityProofGenerate = dispatch(similarityProofTemplates, {
  "similarity-proof-aa": (seed) => family.generate(seed).problem,
});
export const similarityProofCases = {
  "similarity-proof-aa": family.generate,
};
