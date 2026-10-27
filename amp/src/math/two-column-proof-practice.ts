import type { TemplateMetadata } from "./contracts";
import { chainFamily, dispatch, pick } from "./chain-kit";
import { shuffle } from "./distribution-practice";
import {
  figureAngleMark,
  figureName,
  figureParallelMark,
  figurePoint,
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
 * Two-column proofs built from statement and reason banks. The model of a
 * proof is a set of claims: each statement, the reasons that can justify it
 * and, for each reason, the statements that must already be proved. Any
 * proof the claims support is accepted, in any valid order. Banks hold the
 * needed statements, true statements that only follow later (a part
 * proved by CPCTC) and false ones (a wrong correspondence).
 */

const capability = "structured-work-v1" as const;
export const twoColumnProofTemplates: readonly TemplateMetadata[] = [
  {
    id: "two-column-congruence-proof",
    version: 1,
    title: "Write a two-column triangle congruence proof",
    skillId: "congruence-criteria",
    gradeBand: "9–12",
    difficultyOffset: 0.3,
    requiredResponseCapability: capability,
    requiredFigureCapability: "scenes-v1",
    description:
      "Build a two-column proof that two triangles are congruent, choosing each statement and reason: parallel and congruent sides with alternate interior and vertical angles, a quadrilateral with one pair of sides parallel and congruent, crossing segments with a shared midpoint, an angle bisector or a shared side, and a perpendicular bisector; or name the reasons of a given proof, or order its lines.",
  },
  {
    id: "two-column-angle-proof",
    version: 1,
    title: "Write a two-column parallel-line angle proof",
    skillId: "line-angle-proofs",
    gradeBand: "9–12",
    difficultyOffset: 0.1,
    requiredResponseCapability: capability,
    requiredFigureCapability: "scenes-v1",
    description:
      "Prove an angle relationship for two lines cut by a transversal from vertical, corresponding and linear-pair angles: two angles congruent, two angles supplementary, or the lines parallel; build the proof, name its reasons or order its lines.",
  },
];

/* --------------------------------------------------------- statements */

type Claim = Record<string, string[][]>;
interface Statement {
  key: string;
  tex: string;
  claim: Claim;
}
interface Reason {
  key: string;
  label: string;
}
const REASONS: Record<string, string> = {
  given: "Given",
  vertical: "Vertical angles are congruent",
  altInt: "Alternate interior angles of parallel lines are congruent",
  corr: "Corresponding angles of parallel lines are congruent",
  midpoint: "Definition of midpoint",
  bisector: "Definition of angle bisector",
  reflexive: "Reflexive property of congruence",
  perpendicular: "Perpendicular lines form congruent right angles",
  parallelogram:
    "One pair of opposite sides parallel and congruent makes a parallelogram",
  diagonals: "The diagonals of a parallelogram bisect each other",
  opposite: "Opposite sides of a parallelogram are congruent",
  sss: "SSS",
  sas: "SAS",
  asa: "ASA",
  aas: "AAS",
  cpctc: "CPCTC (corresponding parts of congruent triangles)",
  transitive: "Transitive property of congruence",
  linearPair: "Angles that form a linear pair are supplementary",
  substitution: "Substitution property of equality",
  supplementary: "Definition of supplementary angles",
  converseCorr:
    "If corresponding angles are congruent, then the lines are parallel",
  converseAlt:
    "If alternate interior angles are congruent, then the lines are parallel",
  altExt: "Alternate exterior angles of parallel lines are congruent",
  congruentMeasure: "Congruent angles have equal measures",
};
const criteria = ["sss", "sas", "asa", "aas"];

/** Turn keyed statements and reasons into banks with ids by display
 * position (so an id never tells a proof's order) and the claims and path
 * in those ids. */
function assemble(
  r: Random,
  statements: Statement[],
  reasonKeys: string[],
  path: [statement: string, reason: string][],
  goal: string,
): ProofModel {
  const shown = shuffle(r, [...statements]);
  const sid = new Map(shown.map((s, i) => [s.key, `s${"abcdefghij"[i]}`]));
  const reasons: Reason[] = reasonKeys.map((key) => ({
    key,
    label: REASONS[key]!,
  }));
  const rid = new Map(reasons.map((x, i) => [x.key, `r${"abcdefghijkl"[i]}`]));
  const claims: ProofModel["claims"] = {};
  for (const s of statements) {
    const byReason: Record<string, string[][]> = {};
    for (const [reason, sets] of Object.entries(s.claim)) {
      if (!rid.has(reason)) continue;
      byReason[rid.get(reason)!] = sets.map((set) =>
        set.map((k) => sid.get(k)!),
      );
    }
    if (Object.keys(byReason).length) claims[sid.get(s.key)!] = byReason;
  }
  const goalStatement = statements.find((s) => s.key === goal)!;
  return {
    statements: shown.map((s) => ({ id: sid.get(s.key)!, label: s.tex })),
    reasons: reasons.map((x) => ({ id: rid.get(x.key)!, label: x.label })),
    claims,
    goal: sid.get(goal)!,
    goalTex: goalStatement.tex,
    path: path.map(([s, reason]) => [sid.get(s)!, rid.get(reason)!]),
  };
}

const seg = (a: string, b: string) => `$\\overline{${a}${b}}$`;
const segs = (a: string, b: string) => `\\overline{${a}${b}}`;
const ang = (a: string, b: string, c: string) => `\\angle ${a}${b}${c}`;
const tri = (a: string, b: string, c: string) => `\\triangle ${a}${b}${c}`;
const math = (s: string) => `$${s}$`;

/* ------------------------------------------------------------ figures */

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const avg = (...ps: Point[]): Point => [
  ps.reduce((s, p) => s + p[0], 0) / ps.length,
  ps.reduce((s, p) => s + p[1], 0) / ps.length,
];
/** Where segment pq meets segment rs. */
function cross(p: Point, q: Point, r: Point, s: Point): Point {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
  return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
}
type Marks = {
  segments: [string, string][];
  names: string[];
  ticks?: [string, string, number][];
  parallel?: [string, string, number][];
  angles?: [string, string, string, number][];
  right?: [string, string, string][];
};
function figure(
  title: string,
  at: Record<string, Point>,
  letters: Record<string, string>,
  m: Marks,
): Scene {
  const center = avg(...Object.values(at));
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
  for (const k of m.names) {
    const out = sub(at[k]!, center);
    els.push(figureName(`n${k}`, letters[k]!, at[k]!, out));
    if (k === "E") els.push(figurePoint("pe", at[k]!));
  }
  return figureScene(title, els);
}

/* --------------------------------------------------------- congruence */

type CongruenceConfig =
  | "parallel-sides"
  | "parallelogram"
  | "midpoint"
  | "bisector"
  | "kite"
  | "perpendicular";
interface ProofCase {
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
const letterSets = [
  ["A", "B", "C", "D", "E"],
  ["P", "Q", "R", "S", "T"],
  ["J", "K", "L", "M", "N"],
  ["F", "G", "H", "K", "M"],
  ["S", "M", "I", "L", "E"],
] as const;

function congruenceCase(
  r: Random,
  config: CongruenceConfig,
  cpctc: boolean,
): ProofCase {
  const set = pick(r, letterSets);
  const L: Record<string, string> = {
    A: set[0],
    B: set[1],
    C: set[2],
    D: set[3],
    E: set[4],
  };
  const [A, B, C, D, E] = [L.A!, L.B!, L.C!, L.D!, L.E!];
  const given = (key: string, tex: string): Statement => ({
    key,
    tex,
    claim: { given: [[]] },
  });
  if (config === "parallel-sides") {
    const at: Record<string, Point> = {
      A: [0, 3],
      B: [5, 3],
      C: [4, 0],
      D: [-1, 0],
    };
    at.E = cross(at.A!, at.C!, at.B!, at.D!);
    const goalTri = math(`${tri(A, B, E)}\\cong${tri(C, D, E)}`);
    const statements: Statement[] = [
      given("par", math(`${segs(A, B)}\\parallel${segs(C, D)}`)),
      given("cong", math(`${segs(A, B)}\\cong${segs(C, D)}`)),
      {
        key: "a1",
        tex: math(`${ang(B, A, E)}\\cong${ang(D, C, E)}`),
        claim: { altInt: [["par"]] },
      },
      {
        key: "a2",
        tex: math(`${ang(A, B, E)}\\cong${ang(C, D, E)}`),
        claim: { altInt: [["par"]] },
      },
      {
        key: "v",
        tex: math(`${ang(A, E, B)}\\cong${ang(C, E, D)}`),
        claim: { vertical: [[]] },
      },
      {
        key: "tri",
        tex: goalTri,
        claim: {
          asa: [["a1", "cong", "a2"]],
          aas: [
            ["a1", "v", "cong"],
            ["a2", "v", "cong"],
          ],
        },
      },
      {
        key: "seg",
        tex: math(`${segs(A, E)}\\cong${segs(C, E)}`),
        claim: { cpctc: [["tri"]] },
      },
      {
        key: "wrong",
        tex: math(`${tri(A, B, E)}\\cong${tri(D, C, E)}`),
        claim: {},
      },
      {
        key: "false",
        tex: math(`${segs(A, E)}\\cong${segs(B, E)}`),
        claim: {},
      },
    ];
    const goal = cpctc ? "seg" : "tri";
    return {
      config,
      given: [
        math(`${segs(A, B)}\\parallel${segs(C, D)}`),
        math(`${segs(A, B)}\\cong${segs(C, D)}`),
      ],
      goalTex: cpctc ? math(`${segs(A, E)}\\cong${segs(C, E)}`) : goalTri,
      statements,
      reasons: [
        "given",
        "vertical",
        "altInt",
        "corr",
        "midpoint",
        "reflexive",
        ...criteria,
        "cpctc",
      ],
      path: [
        ["par", "given"],
        ["cong", "given"],
        ["a1", "altInt"],
        ["a2", "altInt"],
        ["tri", "asa"],
        ...(cpctc ? ([["seg", "cpctc"]] as [string, string][]) : []),
      ],
      goal,
      scene: figure(
        `Segments ${A}${C} and ${B}${D} crossing at ${E}, with ${A}${B} parallel and congruent to ${C}${D}`,
        at,
        L,
        {
          segments: [
            ["A", "B"],
            ["C", "D"],
            ["A", "C"],
            ["B", "D"],
          ],
          names: ["A", "B", "C", "D", "E"],
          parallel: [
            ["A", "B", 1],
            ["D", "C", 1],
          ],
          ticks: [
            ["A", "B", 1],
            ["C", "D", 1],
          ],
        },
      ),
      hint: `${seg(A, B)} and ${seg(C, D)} are parallel, and ${seg(A, C)} crosses both. Which angles of $\\triangle ${A}${B}${E}$ and $\\triangle ${C}${D}${E}$ does that make congruent?`,
      why: [
        `Because $${segs(A, B)}\\parallel${segs(C, D)}$, the transversals $${segs(A, C)}$ and $${segs(B, D)}$ make alternate interior angles congruent: $${ang(B, A, E)}\\cong${ang(D, C, E)}$ and $${ang(A, B, E)}\\cong${ang(C, D, E)}$.`,
        `The given side $${segs(A, B)}\\cong${segs(C, D)}$ lies between those angles, so ASA applies. (The vertical angles at $${E}$ with one pair of alternate interior angles give AAS instead.)`,
        ...(cpctc
          ? [
              `$${segs(A, E)}$ and $${segs(C, E)}$ are corresponding parts of the congruent triangles, so they are congruent by CPCTC.`,
            ]
          : []),
      ],
    };
  }
  if (config === "parallelogram") {
    const at: Record<string, Point> = {
      A: [0, 0],
      B: [5.6, 0],
      C: [7, 3],
      D: [1.4, 3],
    };
    at.E = cross(at.A!, at.C!, at.B!, at.D!);
    const goalTri = math(`${tri(A, B, E)}\\cong${tri(C, D, E)}`);
    const statements: Statement[] = [
      given("par", math(`${segs(A, D)}\\parallel${segs(B, C)}`)),
      given("cong", math(`${segs(A, D)}\\cong${segs(B, C)}`)),
      {
        key: "pg",
        tex: `$${A}${B}${C}${D}$ is a parallelogram`,
        claim: { parallelogram: [["par", "cong"]] },
      },
      {
        key: "bis",
        tex: math(
          `${segs(A, E)}\\cong${segs(C, E)}\\text{ and }${segs(B, E)}\\cong${segs(D, E)}`,
        ),
        claim: { diagonals: [["pg"]] },
      },
      {
        key: "opp",
        tex: math(`${segs(A, B)}\\cong${segs(C, D)}`),
        claim: { opposite: [["pg"]], cpctc: [["tri"]] },
      },
      {
        key: "v",
        tex: math(`${ang(A, E, B)}\\cong${ang(C, E, D)}`),
        claim: { vertical: [[]] },
      },
      {
        key: "tri",
        tex: goalTri,
        claim: { sas: [["bis", "v"]], sss: [["bis", "opp"]] },
      },
      {
        key: "wrong",
        tex: math(`${tri(A, B, E)}\\cong${tri(D, C, E)}`),
        claim: {},
      },
      {
        key: "false",
        tex: math(`${segs(A, E)}\\cong${segs(B, E)}`),
        claim: {},
      },
    ];
    return {
      config,
      given: [
        math(`${segs(A, D)}\\parallel${segs(B, C)}`),
        math(`${segs(A, D)}\\cong${segs(B, C)}`),
      ],
      goalTex: goalTri,
      statements,
      reasons: [
        "given",
        "parallelogram",
        "diagonals",
        "opposite",
        "vertical",
        "altInt",
        "midpoint",
        ...criteria,
        "cpctc",
      ],
      path: [
        ["par", "given"],
        ["cong", "given"],
        ["pg", "parallelogram"],
        ["bis", "diagonals"],
        ["v", "vertical"],
        ["tri", "sas"],
      ],
      goal: "tri",
      scene: figure(
        `Quadrilateral ${A}${B}${C}${D} with diagonals meeting at ${E}; ${A}${D} is parallel and congruent to ${B}${C}`,
        at,
        L,
        {
          segments: [
            ["A", "B"],
            ["B", "C"],
            ["C", "D"],
            ["D", "A"],
            ["A", "C"],
            ["B", "D"],
          ],
          names: ["A", "B", "C", "D", "E"],
          parallel: [
            ["A", "D", 1],
            ["B", "C", 1],
          ],
          ticks: [
            ["A", "D", 1],
            ["B", "C", 1],
          ],
        },
      ),
      hint: `One pair of opposite sides of $${A}${B}${C}${D}$, ${seg(A, D)} and ${seg(B, C)}, is both parallel and congruent. What kind of quadrilateral is it, and what do its diagonals do?`,
      why: [
        `A quadrilateral with one pair of opposite sides both parallel and congruent is a parallelogram, so $${A}${B}${C}${D}$ is a parallelogram.`,
        `The diagonals of a parallelogram bisect each other, so $${segs(A, E)}\\cong${segs(C, E)}$ and $${segs(B, E)}\\cong${segs(D, E)}$. With the vertical angles at $${E}$, SAS proves the triangles congruent. (Opposite sides $${segs(A, B)}\\cong${segs(C, D)}$ with the bisected diagonals give SSS instead.)`,
      ],
    };
  }
  if (config === "midpoint") {
    const at: Record<string, Point> = {
      A: [0, 3],
      D: [6, 0],
      B: [0.5, 0],
      C: [5.5, 3],
    };
    at.E = avg(at.A!, at.D!);
    const goalTri = math(`${tri(A, B, E)}\\cong${tri(D, C, E)}`);
    const statements: Statement[] = [
      given("m1", `$${E}$ is the midpoint of ${seg(A, D)}`),
      given("m2", `$${E}$ is the midpoint of ${seg(B, C)}`),
      {
        key: "s1",
        tex: math(`${segs(A, E)}\\cong${segs(D, E)}`),
        claim: { midpoint: [["m1"]] },
      },
      {
        key: "s2",
        tex: math(`${segs(B, E)}\\cong${segs(C, E)}`),
        claim: { midpoint: [["m2"]] },
      },
      {
        key: "v",
        tex: math(`${ang(A, E, B)}\\cong${ang(D, E, C)}`),
        claim: { vertical: [[]] },
      },
      { key: "tri", tex: goalTri, claim: { sas: [["s1", "v", "s2"]] } },
      {
        key: "side",
        tex: math(`${segs(A, B)}\\cong${segs(D, C)}`),
        claim: { cpctc: [["tri"]] },
      },
      {
        key: "wrong",
        tex: math(`${tri(A, B, E)}\\cong${tri(C, D, E)}`),
        claim: {},
      },
      {
        key: "false",
        tex: math(`${segs(A, E)}\\cong${segs(B, E)}`),
        claim: {},
      },
    ];
    return {
      config,
      given: [
        `$${E}$ is the midpoint of ${seg(A, D)}`,
        `$${E}$ is the midpoint of ${seg(B, C)}`,
      ],
      goalTex: goalTri,
      statements,
      reasons: [
        "given",
        "midpoint",
        "vertical",
        "reflexive",
        "altInt",
        "bisector",
        ...criteria,
        "cpctc",
      ],
      path: [
        ["m1", "given"],
        ["m2", "given"],
        ["s1", "midpoint"],
        ["s2", "midpoint"],
        ["v", "vertical"],
        ["tri", "sas"],
      ],
      goal: "tri",
      scene: figure(
        `Segments ${A}${D} and ${B}${C} crossing at their common midpoint ${E}`,
        at,
        L,
        {
          segments: [
            ["A", "D"],
            ["B", "C"],
            ["A", "B"],
            ["D", "C"],
          ],
          names: ["A", "B", "C", "D", "E"],
          ticks: [
            ["A", "E", 1],
            ["E", "D", 1],
            ["B", "E", 2],
            ["E", "C", 2],
          ],
        },
      ),
      hint: `A midpoint splits a segment into two congruent parts. Which parts of ${seg(A, D)} and ${seg(B, C)} does $${E}$ make congruent, and what angle lies between them?`,
      why: [
        `By the definition of midpoint, $${segs(A, E)}\\cong${segs(D, E)}$ and $${segs(B, E)}\\cong${segs(C, E)}$.`,
        `The angles at $${E}$ between those sides are vertical angles, so SAS proves $${tri(A, B, E)}\\cong${tri(D, C, E)}$.`,
      ],
    };
  }
  if (config === "bisector" || config === "kite") {
    const at: Record<string, Point> = {
      A: [0, 3.6],
      B: [-2.4, 0.9],
      D: [2.4, 0.9],
      C: [0, -0.6],
    };
    const goalTri = math(`${tri(A, B, C)}\\cong${tri(A, D, C)}`);
    const common: Statement[] = [
      {
        key: "rf",
        tex: math(`${segs(A, C)}\\cong${segs(A, C)}`),
        claim: { reflexive: [[]] },
      },
      {
        key: "wrong",
        tex: math(`${tri(A, B, C)}\\cong${tri(C, D, A)}`),
        claim: {},
      },
    ];
    if (config === "bisector") {
      const statements: Statement[] = [
        given("g1", math(`${segs(A, B)}\\cong${segs(A, D)}`)),
        given("g2", `${seg(A, C)} bisects $${ang(B, A, D)}$`),
        {
          key: "a",
          tex: math(`${ang(B, A, C)}\\cong${ang(D, A, C)}`),
          claim: { bisector: [["g2"]] },
        },
        ...common,
        { key: "tri", tex: goalTri, claim: { sas: [["g1", "a", "rf"]] } },
        {
          key: "base",
          tex: math(`${segs(B, C)}\\cong${segs(D, C)}`),
          claim: { cpctc: [["tri"]] },
        },
        {
          key: "false",
          tex: math(`${segs(A, B)}\\cong${segs(B, C)}`),
          claim: {},
        },
      ];
      return {
        config,
        given: [
          math(`${segs(A, B)}\\cong${segs(A, D)}`),
          `${seg(A, C)} bisects $${ang(B, A, D)}$`,
        ],
        goalTex: goalTri,
        statements,
        reasons: [
          "given",
          "bisector",
          "reflexive",
          "midpoint",
          "vertical",
          "altInt",
          ...criteria,
          "cpctc",
        ],
        path: [
          ["g1", "given"],
          ["g2", "given"],
          ["a", "bisector"],
          ["rf", "reflexive"],
          ["tri", "sas"],
        ],
        goal: "tri",
        scene: figure(
          `Quadrilateral ${A}${B}${C}${D} with diagonal ${A}${C} bisecting the angle at ${A}`,
          at,
          L,
          {
            segments: [
              ["A", "B"],
              ["B", "C"],
              ["C", "D"],
              ["D", "A"],
              ["A", "C"],
            ],
            names: ["A", "B", "C", "D"],
            ticks: [
              ["A", "B", 1],
              ["A", "D", 1],
            ],
            angles: [
              ["B", "A", "C", 1],
              ["C", "A", "D", 1],
            ],
          },
        ),
        hint: `The two triangles share ${seg(A, C)}. Which angles at $${A}$ does the bisector make congruent, and which sides are given?`,
        why: [
          `An angle bisector splits an angle into two congruent angles: $${ang(B, A, C)}\\cong${ang(D, A, C)}$.`,
          `$${segs(A, C)}$ is a side of both triangles, congruent to itself by the reflexive property. With the given $${segs(A, B)}\\cong${segs(A, D)}$, the included angles make SAS.`,
        ],
      };
    }
    // Kite: SSS, then the diagonal bisects the angle at A by CPCTC.
    const goalAngle = math(`${ang(B, A, C)}\\cong${ang(D, A, C)}`);
    const statements: Statement[] = [
      given("g1", math(`${segs(A, B)}\\cong${segs(A, D)}`)),
      given("g2", math(`${segs(C, B)}\\cong${segs(C, D)}`)),
      ...common,
      { key: "tri", tex: goalTri, claim: { sss: [["g1", "g2", "rf"]] } },
      { key: "ang", tex: goalAngle, claim: { cpctc: [["tri"]] } },
      {
        key: "false",
        tex: math(`${segs(A, B)}\\cong${segs(C, B)}`),
        claim: {},
      },
    ];
    return {
      config,
      given: [
        math(`${segs(A, B)}\\cong${segs(A, D)}`),
        math(`${segs(C, B)}\\cong${segs(C, D)}`),
      ],
      goalTex: goalAngle,
      statements,
      reasons: [
        "given",
        "reflexive",
        "bisector",
        "midpoint",
        "vertical",
        ...criteria,
        "cpctc",
      ],
      path: [
        ["g1", "given"],
        ["g2", "given"],
        ["rf", "reflexive"],
        ["tri", "sss"],
        ["ang", "cpctc"],
      ],
      goal: "ang",
      scene: figure(`Kite ${A}${B}${C}${D} with diagonal ${A}${C}`, at, L, {
        segments: [
          ["A", "B"],
          ["B", "C"],
          ["C", "D"],
          ["D", "A"],
          ["A", "C"],
        ],
        names: ["A", "B", "C", "D"],
        ticks: [
          ["A", "B", 1],
          ["A", "D", 1],
          ["C", "B", 2],
          ["C", "D", 2],
        ],
      }),
      hint: `Two pairs of sides are given, and the triangles $${tri(A, B, C)}$ and $${tri(A, D, C)}$ also share ${seg(A, C)}. Prove the triangles congruent first.`,
      why: [
        `$${segs(A, C)}$ is a side of both triangles and is congruent to itself by the reflexive property. With the two given pairs of sides, SSS proves $${tri(A, B, C)}\\cong${tri(A, D, C)}$.`,
        `$${ang(B, A, C)}$ and $${ang(D, A, C)}$ are corresponding parts of the congruent triangles, so they are congruent by CPCTC: the diagonal bisects the angle at $${A}$.`,
      ],
    };
  }
  // Perpendicular bisector: D is the foot from C and the midpoint of AB.
  const at: Record<string, Point> = {
    C: [0, 3.2],
    A: [-2.7, 0],
    B: [2.7, 0],
    D: [0, 0],
  };
  const goalTri = math(`${tri(A, D, C)}\\cong${tri(B, D, C)}`);
  const statements: Statement[] = [
    given("p", math(`${segs(C, D)}\\perp${segs(A, B)}`)),
    given("m", `$${D}$ is the midpoint of ${seg(A, B)}`),
    {
      key: "r",
      tex: math(`${ang(A, D, C)}\\cong${ang(B, D, C)}`),
      claim: { perpendicular: [["p"]] },
    },
    {
      key: "s",
      tex: math(`${segs(A, D)}\\cong${segs(B, D)}`),
      claim: { midpoint: [["m"]] },
    },
    {
      key: "rf",
      tex: math(`${segs(C, D)}\\cong${segs(C, D)}`),
      claim: { reflexive: [[]] },
    },
    { key: "tri", tex: goalTri, claim: { sas: [["s", "r", "rf"]] } },
    {
      key: "legs",
      tex: math(`${segs(A, C)}\\cong${segs(B, C)}`),
      claim: { cpctc: [["tri"]] },
    },
    {
      key: "wrong",
      tex: math(`${tri(A, D, C)}\\cong${tri(C, D, B)}`),
      claim: {},
    },
  ];
  return {
    config,
    given: [
      math(`${segs(C, D)}\\perp${segs(A, B)}`),
      `$${D}$ is the midpoint of ${seg(A, B)}`,
    ],
    goalTex: goalTri,
    statements,
    reasons: [
      "given",
      "perpendicular",
      "midpoint",
      "reflexive",
      "vertical",
      "bisector",
      ...criteria,
      "cpctc",
    ],
    path: [
      ["p", "given"],
      ["m", "given"],
      ["r", "perpendicular"],
      ["s", "midpoint"],
      ["rf", "reflexive"],
      ["tri", "sas"],
    ],
    goal: "tri",
    scene: figure(
      `Triangle ${A}${B}${C} with segment ${C}${D} perpendicular to ${A}${B} at its midpoint ${D}`,
      at,
      L,
      {
        segments: [
          ["A", "B"],
          ["C", "A"],
          ["C", "B"],
          ["C", "D"],
        ],
        names: ["A", "B", "C", "D"],
        ticks: [
          ["A", "D", 1],
          ["D", "B", 1],
        ],
        right: [["B", "D", "C"]],
      },
    ),
    hint: `${seg(C, D)} is perpendicular to ${seg(A, B)} and $${D}$ is its midpoint. Which angle pair and which side pair does each given make congruent, and which side do the triangles share?`,
    why: [
      `Perpendicular segments meet at right angles, and all right angles are congruent, so $${ang(A, D, C)}\\cong${ang(B, D, C)}$. The midpoint gives $${segs(A, D)}\\cong${segs(B, D)}$.`,
      `The shared side $${segs(C, D)}$ is congruent to itself, and the right angles lie between the congruent sides, so SAS applies.`,
    ],
  };
}

/* ------------------------------------------------------- transversal */

/** Angles 1–8 where transversal t crosses ℓ (1–4) and m (5–8): each group
 * reads upper-left, upper-right, lower-left, lower-right. */
interface Position {
  line: "l" | "m";
  side: "left" | "right";
  half: "above" | "below";
}
const positions: Record<number, Position> = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [
    n,
    {
      line: n <= 4 ? "l" : "m",
      side: (n - 1) % 2 === 0 ? "left" : "right",
      half: (n - 1) % 4 < 2 ? "above" : "below",
    },
  ]),
) as Record<number, Position>;
const interior = (p: Position) =>
  (p.line === "l" && p.half === "below") ||
  (p.line === "m" && p.half === "above");
type Relation =
  | "vertical"
  | "linear-pair"
  | "corresponding"
  | "alternate-interior"
  | "alternate-exterior"
  | "same-side-interior"
  | "other";
export function angleRelation(a: number, b: number): Relation {
  const p = positions[a]!,
    q = positions[b]!;
  if (p.line === q.line) {
    if (p.side !== q.side && p.half !== q.half) return "vertical";
    if (p.side !== q.side || p.half !== q.half) return "linear-pair";
    return "other";
  }
  if (p.side === q.side && p.half === q.half) return "corresponding";
  if (p.side !== q.side && p.half !== q.half)
    return interior(p) && interior(q)
      ? "alternate-interior"
      : !interior(p) && !interior(q)
        ? "alternate-exterior"
        : "other";
  if (p.side === q.side && p.half !== q.half && interior(p) && interior(q))
    return "same-side-interior";
  return "other";
}
const angleOf = (n: number) => `\\angle ${n}`;
const congruent = (a: number, b: number) =>
  math(`${angleOf(a)}\\cong${angleOf(b)}`);
const partner = (n: number, rel: Relation) =>
  [1, 2, 3, 4, 5, 6, 7, 8].find((k) => k !== n && angleRelation(n, k) === rel)!;
/** The angle at the other crossing in the corresponding position. */
const corresponding = (n: number) =>
  [1, 2, 3, 4, 5, 6, 7, 8].find(
    (k) => angleRelation(n, k) === "corresponding",
  )!;

function transversalScene(parallel: boolean): Scene {
  const Y1 = 2.4,
    Y0 = 0;
  const X = (y: number): Point => [3.4 + (y - 1.2) * 0.62, y];
  const p1 = X(Y1),
    p0 = X(Y0);
  const xs = [-0.6, 7.2] as const;
  const q = 0.95;
  const num = (n: number, c: Point, dx: number, dy: number): Element => ({
    type: "text",
    id: `a${n}`,
    at: [c[0] + dx * q, c[1] + dy * q],
    text: String(n),
    font: "math",
    size: "sm",
    bold: true,
    color: "accent",
    halo: true,
    align: [0, 0],
  });
  return figureScene(
    `Lines ℓ and m cut by a transversal t, with eight numbered angles${parallel ? "; ℓ is parallel to m" : ""}`,
    [
      figureSegment("l", [xs[0], Y1], [xs[1], Y1]),
      figureSegment("m", [xs[0], Y0], [xs[1], Y0]),
      figureSegment("t", X(-0.9), X(3.3)),
      ...(parallel
        ? [
            ...figureParallelMark("pl", [xs[0], Y1], [xs[1], Y1], 1, 0.12),
            ...figureParallelMark("pm", [xs[0], Y0], [xs[1], Y0], 1, 0.12),
          ]
        : []),
      figureName("ln", "ℓ", [xs[1], Y1], [1, 0]),
      figureName("mn", "m", [xs[1], Y0], [1, 0]),
      figureName("tn", "t", X(3.3), [0.3, 1]),
      num(1, p1, -0.85, 0.55),
      num(2, p1, 0.85, 0.55),
      num(3, p1, -0.85, -0.55),
      num(4, p1, 0.85, -0.55),
      num(5, p0, -0.85, 0.55),
      num(6, p0, 0.85, 0.55),
      num(7, p0, -0.85, -0.55),
      num(8, p0, 0.85, -0.55),
    ],
  );
}

type AngleProof = "congruent" | "supplementary" | "parallel";
function angleCase(r: Random, kind: AngleProof): ProofCase {
  const par = "$\\ell\\parallel m$";
  if (kind === "congruent") {
    // Alternate interior or exterior angles, proved through a vertical
    // angle and a corresponding angle (two routes).
    const p = pick(r, [1, 2, 3, 4]);
    const q = [5, 6, 7, 8].find((k) => {
      const rel = angleRelation(p, k);
      return rel === "alternate-interior" || rel === "alternate-exterior";
    })!;
    const v = partner(p, "vertical"); // corresponds to q
    const c = corresponding(p); // vertical to q
    const lin = partner(p, "linear-pair");
    const rel = angleRelation(p, q);
    const statements: Statement[] = [
      { key: "par", tex: par, claim: { given: [[]] } },
      { key: "pv", tex: congruent(p, v), claim: { vertical: [[]] } },
      { key: "vq", tex: congruent(v, q), claim: { corr: [["par"]] } },
      { key: "pc", tex: congruent(p, c), claim: { corr: [["par"]] } },
      { key: "cq", tex: congruent(c, q), claim: { vertical: [[]] } },
      {
        key: "goal",
        tex: congruent(p, q),
        claim: {
          transitive: [
            ["pv", "vq"],
            ["pc", "cq"],
          ],
        },
      },
      { key: "false", tex: congruent(p, lin), claim: {} },
    ];
    return {
      config: `congruent-${rel}`,
      given: [par],
      goalTex: congruent(p, q),
      statements,
      reasons: [
        "given",
        "vertical",
        "corr",
        "transitive",
        "linearPair",
        "supplementary",
        "converseCorr",
      ],
      path: [
        ["par", "given"],
        ["pv", "vertical"],
        ["vq", "corr"],
        ["goal", "transitive"],
      ],
      goal: "goal",
      scene: transversalScene(true),
      hint: `$\\angle ${p}$ and $\\angle ${q}$ are at different crossings. Find an angle at the same crossing as $\\angle ${p}$ that is vertical to it and also corresponds to $\\angle ${q}$.`,
      why: [
        `$\\angle ${p}$ and $\\angle ${v}$ are vertical angles, so they are congruent.`,
        `$\\angle ${v}$ and $\\angle ${q}$ are corresponding angles and $\\ell\\parallel m$, so they are congruent. The transitive property links the two: $\\angle ${p}\\cong\\angle ${q}$. (Going through $\\angle ${c}$, the corresponding angle of $\\angle ${p}$, also works.)`,
      ],
    };
  }
  if (kind === "supplementary") {
    // Same-side interior angles p (on ℓ) and q (on m).
    const p = pick(r, [3, 4]);
    const q = [5, 6].find((k) => angleRelation(p, k) === "same-side-interior")!;
    const u = corresponding(q); // on ℓ, a linear pair with p
    const w = corresponding(p); // on m, a linear pair with q
    const sumTex = math(`m${angleOf(p)}+m${angleOf(q)}=180^\\circ`);
    const statements: Statement[] = [
      { key: "par", tex: par, claim: { given: [[]] } },
      {
        key: "lp1",
        tex: math(`m${angleOf(p)}+m${angleOf(u)}=180^\\circ`),
        claim: { linearPair: [[]] },
      },
      {
        key: "eq1",
        tex: math(`m${angleOf(u)}=m${angleOf(q)}`),
        claim: { corr: [["par"]] },
      },
      {
        key: "lp2",
        tex: math(`m${angleOf(q)}+m${angleOf(w)}=180^\\circ`),
        claim: { linearPair: [[]] },
      },
      {
        key: "eq2",
        tex: math(`m${angleOf(w)}=m${angleOf(p)}`),
        claim: { corr: [["par"]] },
      },
      {
        key: "sum",
        tex: sumTex,
        claim: {
          substitution: [
            ["lp1", "eq1"],
            ["lp2", "eq2"],
          ],
        },
      },
      {
        key: "goal",
        tex: `$${angleOf(p)}$ and $${angleOf(q)}$ are supplementary`,
        claim: { supplementary: [["sum"]] },
      },
      { key: "false", tex: congruent(p, q), claim: {} },
    ];
    return {
      config: "supplementary",
      given: [par],
      goalTex: `$${angleOf(p)}$ and $${angleOf(q)}$ are supplementary`,
      statements,
      reasons: [
        "given",
        "vertical",
        "corr",
        "linearPair",
        "substitution",
        "supplementary",
        "transitive",
      ],
      path: [
        ["par", "given"],
        ["lp1", "linearPair"],
        ["eq1", "corr"],
        ["sum", "substitution"],
        ["goal", "supplementary"],
      ],
      goal: "goal",
      scene: transversalScene(true),
      hint: `$\\angle ${p}$ forms a linear pair with an angle at the same crossing. Which angle at the other crossing corresponds to that one?`,
      why: [
        `$\\angle ${p}$ and $\\angle ${u}$ form a linear pair, so their measures add to $180^\\circ$.`,
        `$\\angle ${u}$ and $\\angle ${q}$ are corresponding angles of parallel lines, so their measures are equal. Substituting gives $m\\angle ${p}+m\\angle ${q}=180^\\circ$, which is the definition of supplementary angles.`,
      ],
    };
  }
  // Prove ℓ ∥ m from congruent alternate exterior angles.
  const p = pick(r, [1, 2]);
  const q = [7, 8].find((k) => angleRelation(p, k) === "alternate-exterior")!;
  const v = partner(p, "vertical"); // corresponds to q
  const c = partner(q, "vertical"); // corresponds to p
  const statements: Statement[] = [
    { key: "g", tex: congruent(p, q), claim: { given: [[]] } },
    { key: "pv", tex: congruent(p, v), claim: { vertical: [[]] } },
    { key: "vq", tex: congruent(v, q), claim: { transitive: [["pv", "g"]] } },
    { key: "qc", tex: congruent(q, c), claim: { vertical: [[]] } },
    { key: "pc", tex: congruent(p, c), claim: { transitive: [["g", "qc"]] } },
    {
      key: "goal",
      tex: par,
      claim: { converseCorr: [["vq"], ["pc"]] },
    },
    { key: "false", tex: congruent(p, partner(p, "linear-pair")), claim: {} },
  ];
  return {
    config: "parallel",
    given: [congruent(p, q)],
    goalTex: par,
    statements,
    reasons: [
      "given",
      "vertical",
      "transitive",
      "corr",
      "converseCorr",
      "converseAlt",
      "linearPair",
    ],
    path: [
      ["g", "given"],
      ["pv", "vertical"],
      ["vq", "transitive"],
      ["goal", "converseCorr"],
    ],
    goal: "goal",
    scene: transversalScene(false),
    hint: `You know $\\angle ${p}\\cong\\angle ${q}$. Find an angle vertical to $\\angle ${p}$ that sits in the same position as $\\angle ${q}$ at its crossing.`,
    why: [
      `$\\angle ${p}\\cong\\angle ${v}$ as vertical angles, and $\\angle ${p}\\cong\\angle ${q}$ is given, so $\\angle ${v}\\cong\\angle ${q}$ by the transitive property.`,
      `$\\angle ${v}$ and $\\angle ${q}$ are corresponding angles, and they are congruent, so the lines are parallel.`,
    ],
  };
}

/* ------------------------------------------------------------ render */

function renderProof(
  c: ProofCase,
  mode: "build" | "fill" | "order",
  r: Random,
  lead: string,
) {
  const model = assemble(r, c.statements, c.reasons, c.path, c.goal);
  const built = proofWork(
    model,
    mode,
    r,
    mode === "order" ? "Order the proof" : "Your proof",
  );
  const given = c.given.join(" and ");
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
    prompt: `${lead} Given: ${given}. Prove: ${c.goalTex}. ${task}`,
    hint: c.hint,
    explanation: [...c.why, "A complete proof:", ...lines],
    figure: sceneFigure(c.scene),
  });
}

const congruence = chainFamily({
  template: twoColumnProofTemplates[0]!,
  axes: {
    mode: workModeAxis,
    config: defineAxis("config", [
      "parallel-sides",
      "parallelogram",
      "midpoint",
      "bisector",
      "kite",
      "perpendicular",
    ] as const),
  },
  model: (r, axes) => {
    // The CPCTC extension adds a line; a six-line proof leaves no room.
    const cpctc = axes.config === "parallel-sides" && r(0, 1) === 1;
    return congruenceCase(r, axes.config, cpctc);
  },
  render: (c, axes, r) => renderProof(c, axes.mode, r, "Use the figure."),
  variant: (c) => `${c.config}${c.goal === "seg" ? "-cpctc" : ""}`,
});
const angles = chainFamily({
  template: twoColumnProofTemplates[1]!,
  axes: {
    mode: workModeAxis,
    proof: defineAxis("proof", [
      "congruent",
      "supplementary",
      "parallel",
    ] as const),
  },
  model: (r, axes) => angleCase(r, axes.proof),
  render: (c, axes, r) =>
    renderProof(
      c,
      axes.mode,
      r,
      "In the figure, lines $\\ell$ and $m$ are cut by transversal $t$.",
    ),
  variant: (c) => c.config,
});

export const twoColumnProofGenerate = dispatch(twoColumnProofTemplates, {
  "two-column-congruence-proof": (seed) => congruence.generate(seed).problem,
  "two-column-angle-proof": (seed) => angles.generate(seed).problem,
});
export const twoColumnProofCases = {
  "two-column-congruence-proof": congruence.generate,
  "two-column-angle-proof": angles.generate,
};
