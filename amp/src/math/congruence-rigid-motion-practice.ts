import type { SemanticFigure, TemplateMetadata } from "./contracts";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { shuffle } from "./distribution-practice";
import {
  assembleProof,
  congruentPair,
  criterionMarks,
  decoyText,
  drawLetters,
  givenTex,
  lineExplanation,
  marksText,
  orderNote,
  orientationText,
  pairFigure,
  proofScript,
  reasonText,
  scriptReasons,
  turn,
  type DecoyKey,
  type Letters,
  type ReasonKey,
  type ScriptLine,
  type TrianglePair,
} from "./congruence-rigid-motion-kit";
import type { MultiPartChoiceResponse } from "./multi-part-choice";
import { serializeMultiPart } from "./multi-part-choice";
import { graph, scene as sceneOf } from "./scene/author";
import type { Element } from "./scene/spec";
import {
  figureAngleMark,
  figureTicks,
  sceneFigure,
} from "./geometry-teaching-figures";
import { proofWork, workSurface } from "./structured-work-kit";
import { defineAxis, type Random } from "./variation/axes";
import type { Surface } from "./variation/compose";

/**
 * HSG.CO.B.7: two triangles are congruent if and only if their six pairs of
 * corresponding parts are congruent, argued from the definition of
 * congruence (a sequence of rigid motions maps one onto the other).
 *
 * - six-parts-imply-rigid-motion-proof: the converse as a two-column proof
 *   (build, name the reasons, or order the lines).
 * - congruence-definition-reasoning: why a rigid motion forces each pair of
 *   parts congruent, which direction an argument proves, and the flaw in a
 *   student's construction.
 * - rigid-motion-from-six-parts-coordinates: the same construction on a
 *   grid, choosing each motion and the fact that forces each landing.
 */

export const congruenceRigidMotionTemplates: readonly TemplateMetadata[] = [
  {
    id: "six-parts-imply-rigid-motion-proof",
    version: 1,
    title: "Prove six congruent parts give a rigid motion",
    skillId: "congruence-criteria",
    gradeBand: "9–12",
    difficultyOffset: 0.5,
    requiredResponseCapability: "structured-work-v1",
    requiredFigureCapability: "scenes-v1",
    description:
      "Two-column proof that two triangles with six congruent corresponding parts are congruent by the rigid-motion definition: translate and rotate so $A$ lands on $D$ and $B$ on ray $DE$, use $AB=DE$ to land $B$ on $E$, reflect over line $DE$ when the orientations differ, pin the third vertex with an angle and a side or with two angles, and conclude by the definition, never by CPCTC or a criterion. Build the proof, choose its reasons, or order its lines; every valid order is accepted.",
    glossaryNoLink: ["side", "sides", "image", "point", "lands", "reflecting"],
  },
  {
    id: "congruence-definition-reasoning",
    version: 1,
    title: "Reason from the definition of congruence",
    skillId: "congruence-criteria",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    requiredResponseCapability: "single-choice-v1",
    requiredFigureCapability: "scenes-v1",
    description:
      "Choose the correct and complete explanation of why a sequence of rigid motions makes a given pair of corresponding sides or angles congruent; decide which direction of the biconditional an argument proves and what remains; or find the flaw in a student's construction of the rigid motion from six congruent parts (wrong center, skipped orientation, angles used to place a point, distance without a ray, a criterion cited for the definition), including arguments with no flaw.",
    glossaryNoLink: ["side", "sides", "image", "point", "lands", "step"],
  },
  {
    id: "rigid-motion-from-six-parts-coordinates",
    version: 1,
    title: "Build the rigid motion between two triangles",
    skillId: "congruence-criteria",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    requiredResponseCapability: "multi-part-choice-v1",
    requiredFigureCapability: "scenes-v1",
    description:
      "On a coordinate grid, two triangles have six congruent corresponding parts. Choose the translation that carries $A$ to $D$, the rotation about $D$ (a multiple of 90 degrees, or none) that puts the image of $B$ on $E$, why it lands exactly on $E$, whether a reflection over line $DE$ is needed, and why the third vertex then lands on its match.",
    glossaryNoLink: ["side", "image", "point", "lands"],
  },
];
const [proofTemplate, reasoningTemplate, coordinateTemplate] =
  congruenceRigidMotionTemplates as [
    TemplateMetadata,
    TemplateMetadata,
    TemplateMetadata,
  ];

const m = (s: string) => `$${s}$`;
const sixGivens = (L: Letters) =>
  (["AB", "BC", "CA", "A", "B", "C"] as const).map((k) => m(givenTex[k](L)));
const listText = (items: string[]) =>
  `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/* ============================================ six-parts proof (2.1) */

type PinPath = "sas" | "asa";
interface ProofCase {
  L: Letters;
  pair: TrianglePair;
  path: PinPath;
  script: ScriptLine[];
}

/** Statement decoys a six-parts proof may offer: each is false or carries
 * a reason that does not hold (all six parts are given, so a decoy may
 * never be a true statement that the givens justify). */
const SIX_DECOYS: DecoyKey[] = [
  "segmentTranslate",
  "rotateOntoE",
  "leapStatement",
  "circular",
  "wrongSide",
];
/** Distractor reasons, each wrong for every line of the proof. "Two points
 * determine one line" would justify the two-angle finish, so it is left
 * out of that proof. */
const sixDistractors = (path: PinPath): ReasonKey[] => [
  "cpctc",
  "criterion",
  "freeRotation",
  "reflectionKeepsOrientation",
  "dilation",
  "leap",
  "picture",
  ...(path === "asa" ? [] : (["twoPoints"] as ReasonKey[])),
];

function proofCase(r: Random, opposite: boolean, path: PinPath): ProofCase {
  const L = drawLetters(r);
  const pair = congruentPair(r, opposite);
  return { L, pair, path, script: proofScript(L, path, opposite) };
}

function sixProofRender(
  c: ProofCase,
  mode: "build" | "fill" | "order",
  r: Random,
): Surface {
  const { L, pair, path, script } = c;
  const opposite = pair.opposite;
  const decoys = shuffle(r, [...SIX_DECOYS])
    .slice(0, 2)
    .map((key) => ({ key, tex: decoyText(L, key, opposite, path) }));
  const reasonKeys = [
    ...scriptReasons(script),
    ...shuffle(r, sixDistractors(path)).slice(0, 4),
  ];
  const model = assembleProof(
    r,
    script,
    decoys,
    reasonKeys.map((key) => ({ key, label: reasonText(L, key, path) })),
  );
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
        ? "The statements are shown. Choose the reason for each blank line."
        : "The lines of the proof are shown out of order. Put them in order.";
  const { A, B, C, D, E, F } = L;
  const marks = criterionMarks("six");
  const figure = pairFigure(
    `Triangles ${A}${B}${C} and ${D}${E}${F}; ${marksText(L, marks)}.`,
    pair.at,
    L,
    marks,
  );
  const pinner =
    path === "sas"
      ? `the angle at $${D}$ and the length $${D}${F}$`
      : `the angles at $${D}$ and at $${E}$`;
  return workSurface(built, {
    prompt: `Use the figure. Given: ${listText(sixGivens(L))}; ${orientationText(L, pair)}. Prove that a sequence of rigid motions maps $\\triangle ${A}${B}${C}$ onto $\\triangle ${D}${E}${F}$ with $${A}\\to ${D}$, $${B}\\to ${E}$, $${C}\\to ${F}$, so $\\triangle ${A}${B}${C}\\cong\\triangle ${D}${E}${F}$. The proof may not cite CPCTC, SSS, SAS or ASA, because those are proved from this definition of congruence. ${task}`,
    hint: `Land one vertex at a time. Which motions put $${A}$ on $${D}$ and the image of $${B}$ on ray $${D}${E}$, and which given length then says it is exactly $${E}$? Before pinning $${C}$ with ${pinner}, compare the ways $${A}\\to ${B}\\to ${C}$ and $${D}\\to ${E}\\to ${F}$ run round.`,
    explanation: [
      `Congruent means a sequence of rigid motions maps one figure onto the other. The proof builds that sequence and lands $${A}$, $${B}$ and $${C}$ on $${D}$, $${E}$ and $${F}$ one at a time.`,
      ...script.map(
        (line, i) =>
          `${i + 1}. ${line.tex} ${reasonText(L, line.reason, path)} ${lineExplanation(L, line.key, path, opposite)}`,
      ),
      orderNote(L, path, opposite),
      `Only three of the six given facts were needed: $${givenTex.AB(L)}$, $${givenTex.A(L)}$ and ${path === "sas" ? m(givenTex.CA(L)) : m(givenTex.B(L))}. That is why ${path === "sas" ? "SAS" : "ASA"} works as a shortcut.`,
    ],
    figure,
  });
}

const sixProofFamily = chainFamily({
  template: proofTemplate,
  axes: {
    orientation: defineAxis("orientation", ["same", "opposite"] as const),
    pin: defineAxis("pin", ["side", "angle"] as const, { weights: [3, 2] }),
    mode: defineAxis("mode", ["build", "fill", "order"] as const, {
      legacy: "build",
      weights: [2, 2, 1],
    }),
  },
  model: (r, axes) =>
    proofCase(
      r,
      axes.orientation === "opposite",
      axes.pin === "side" ? "sas" : "asa",
    ),
  render: (c, axes, r) => sixProofRender(c, axes.mode, r),
  variant: (c) =>
    `${c.pair.opposite ? "reflect" : "no-reflect"}-${c.path === "sas" ? "side" : "angle"}`,
});

/* ===================================== definition reasoning (2.2) */

type ReasoningTask = "forward" | "direction" | "remains" | "flaw";
type Part = "AB" | "BC" | "CA" | "A" | "B" | "C";
type Flaw = "center" | "leap" | "angles" | "distance" | "criterion" | "none";
interface ReasoningCase {
  task: ReasoningTask;
  L: Letters;
  pair: TrianglePair;
  part: Part;
  argument: "forward" | "converse";
  flaw: Flaw;
  variant: string;
}

const FLAWS: Flaw[] = ["center", "leap", "angles", "distance", "criterion"];
function reasoningCase(r: Random, task: ReasoningTask): ReasoningCase {
  const L = drawLetters(r);
  const pair = congruentPair(r, r(0, 1) === 1);
  const part = pick(r, ["AB", "BC", "CA", "A", "B", "C"] as const);
  const argument = r(0, 1) === 0 ? "forward" : "converse";
  // One argument in five has no flaw.
  const flaw: Flaw = r(1, 5) === 1 ? "none" : pick(r, FLAWS);
  const variant =
    task === "forward"
      ? `forward-${part.length === 2 ? "side" : "angle"}`
      : task === "flaw"
        ? `flaw-${flaw}`
        : `${task}-${argument}`;
  return { task, L, pair, part, argument, flaw, variant };
}

type Vertex = "A" | "B" | "C";
const SIDE_IMAGE: Record<"AB" | "BC" | "CA", [Vertex, Vertex]> = {
  AB: ["A", "B"],
  BC: ["B", "C"],
  CA: ["C", "A"],
};
const MATCH: Record<"A" | "B" | "C", "D" | "E" | "F"> = {
  A: "D",
  B: "E",
  C: "F",
};
const motionsText = (L: Letters, opposite: boolean) =>
  `a translation, then a rotation about $${L.D}$${opposite ? `, then a reflection over line $${L.D}${L.E}$` : ""}`;

function forwardSurface(c: ReasoningCase, r: Random): Surface | null {
  const { L, pair, part } = c;
  const tri1 = `\\triangle ${L.A}${L.B}${L.C}`;
  const tri2 = `\\triangle ${L.D}${L.E}${L.F}`;
  const lead = `A sequence of rigid motions (${motionsText(L, pair.opposite)}) maps $${tri1}$ onto $${tri2}$ with $${L.A}\\to ${L.D}$, $${L.B}\\to ${L.E}$ and $${L.C}\\to ${L.F}$.`;
  /** A wrong explanation and, for the worked answer, what it gets wrong. */
  type Wrong = ChoiceOption & { fails: string };
  const cpctc: Wrong = {
    label: `$${tri1}\\cong${tri2}$, and corresponding parts of congruent triangles are congruent.`,
    feedback:
      "That cites CPCTC, the very fact this reasoning proves. An explanation from the definition says where the part lands and what rigid motions preserve.",
    fails: "citing CPCTC assumes what this argument proves",
  };
  let target: string,
    correct: string,
    wrong: Wrong[],
    hint: string,
    why: string[];
  if (part.length === 2) {
    const [p, q] = SIDE_IMAGE[part as "AB" | "BC" | "CA"];
    const [P, Q] = [L[p], L[q]];
    const [P2, Q2] = [L[MATCH[p]], L[MATCH[q]]];
    target = `$\\overline{${P}${Q}}\\cong\\overline{${P2}${Q2}}$`;
    correct = `$${P}\\to ${P2}$ and $${Q}\\to ${Q2}$, so $\\overline{${P}${Q}}$ lands on $\\overline{${P2}${Q2}}$, and rigid motions keep length: $${P}${Q}=${P2}${Q2}$.`;
    wrong = shuffle(r, [
      cpctc,
      {
        label: `The translation moves $${P}$ and $${Q}$ by one vector, so it keeps their distance: $${P}${Q}=${P2}${Q2}$.`,
        feedback: `The translation is only the first motion; the rotation${pair.opposite ? " and the reflection" : ""} move the segment again. The explanation has to follow the whole sequence to $\\overline{${P2}${Q2}}$.`,
        fails:
          "following only the translation leaves out the rest of the sequence",
      },
      {
        label: `The rotation keeps $${P}$ and $${Q}$ the same distance from its center $${L.D}$, so $${P}${Q}=${P2}${Q2}$.`,
        feedback: `Distance from the center $${L.D}$ is a different length from the distance between $${P}$ and $${Q}$, and it says nothing about where the segment lands.`,
        fails: `distances from the center $${L.D}$ say nothing about the length of $\\overline{${P}${Q}}$`,
      },
      {
        label: `$\\overline{${P}${Q}}$ and $\\overline{${P2}${Q2}}$ look equally long in the figure, so $${P}${Q}=${P2}${Q2}$.`,
        feedback:
          "A drawing can suggest equal lengths but cannot prove them. The reason must come from the rigid motions.",
        fails: "the look of the figure proves nothing",
      },
    ]).slice(0, 3);
    hint = `Follow the endpoints: where do $${P}$ and $${Q}$ land under the motions, and which quantity does every rigid motion keep?`;
    why = [
      `The motions carry $${P}$ to $${P2}$ and $${Q}$ to $${Q2}$, so they carry the segment between them, $\\overline{${P}${Q}}$, onto $\\overline{${P2}${Q2}}$.`,
      `Every rigid motion preserves distance, so the length does not change: $${P}${Q}=${P2}${Q2}$.`,
    ];
  } else {
    const v = part as "A" | "B" | "C";
    const others = (["A", "B", "C"] as const).filter((x) => x !== v);
    const V = L[v],
      W = L[MATCH[v]];
    const [X, Y] = others.map((x) => L[x]) as [string, string];
    const [X2, Y2] = others.map((x) => L[MATCH[x]]) as [string, string];
    target = `$\\angle ${V}\\cong\\angle ${W}$`;
    correct = `$${V}\\to ${W}$, and rays $${V}${X}$, $${V}${Y}$ land on rays $${W}${X2}$, $${W}${Y2}$; rigid motions keep angle measure.`;
    wrong = shuffle(r, [
      cpctc,
      {
        label: `The angles of each triangle add to $180^\\circ$, so the angles at $${V}$ and $${W}$ are equal.`,
        feedback:
          "Equal angle sums do not make single angles equal: $50^\\circ+60^\\circ+70^\\circ$ and $40^\\circ+60^\\circ+80^\\circ$ both make $180^\\circ$.",
        fails: "the angle sum does not make single angles equal",
      },
      {
        label: `The two sides that form $\\angle ${V}$ match the two that form $\\angle ${W}$, so the angles are equal.`,
        feedback:
          "Two sides alone do not fix the angle between them, and those sides have not been shown equal either. Say where the angle lands.",
        fails: "two sides do not fix the angle between them",
      },
      {
        label: `The translation slides $\\angle ${V}$ and the rotation turns it, so neither motion changes its size.`,
        feedback: `Keeping its size is half the reason. The explanation never shows that $\\angle ${V}$ lands on $\\angle ${W}$, so it never connects the two angles.`,
        fails: `keeping its size never shows that it lands on $\\angle ${W}$`,
      },
    ]).slice(0, 3);
    hint = `An angle is a vertex and two rays. Where do $${V}$, $${X}$ and $${Y}$ land, and which quantity does every rigid motion keep?`;
    why = [
      `The motions carry $${V}$ to $${W}$, $${X}$ to $${X2}$ and $${Y}$ to $${Y2}$, so ray $${V}${X}$ lands on ray $${W}${X2}$ and ray $${V}${Y}$ on ray $${W}${Y2}$: the angle lands on $\\angle ${W}$.`,
      `Every rigid motion preserves angle measure, so $m\\angle ${V}=m\\angle ${W}$.`,
    ];
  }
  const s = choiceSurface(r, {
    prompt: `${lead} Without citing CPCTC, which this reasoning proves, explain why ${target}. Which explanation is correct and complete?`,
    options: [{ label: correct, correct: true }, ...wrong],
    hint,
    explanation: [
      "By definition, congruent figures are figures that a sequence of rigid motions maps one onto the other. A complete explanation says what lands where and what rigid motions preserve.",
      ...why,
      `The other choices fail: ${wrong[0]!.fails}; ${wrong[1]!.fails}; and ${wrong[2]!.fails}.`,
    ],
  });
  if (!s) return null;
  return {
    ...s,
    figure: pairFigure(
      `Triangles ${L.A}${L.B}${L.C} and ${L.D}${L.E}${L.F}, the second turned${pair.opposite ? " and flipped" : ""} relative to the first.`,
      pair.at,
      L,
      {},
    ),
  };
}

function boardP(L: Letters) {
  return `a sequence of rigid motions maps $\\triangle ${L.A}${L.B}${L.C}$ onto $\\triangle ${L.D}${L.E}${L.F}$ with $${L.A}\\to ${L.D}$, $${L.B}\\to ${L.E}$, $${L.C}\\to ${L.F}$`;
}
function argumentText(L: Letters, argument: "forward" | "converse") {
  const { A, B, C, D, E, F } = L;
  return argument === "forward"
    ? `A sequence of rigid motions maps $\\triangle ${A}${B}${C}$ onto $\\triangle ${D}${E}${F}$ with $${A}\\to ${D}$, $${B}\\to ${E}$, $${C}\\to ${F}$. Then each side of $\\triangle ${A}${B}${C}$ lands on the matching side of $\\triangle ${D}${E}${F}$, and each angle on the matching angle. Rigid motions preserve distance and angle measure, so all six pairs of corresponding parts are congruent.`
    : `The six pairs of corresponding parts are congruent. Translate $${A}$ to $${D}$ and rotate about $${D}$ until the image of $${B}$ is on ray $${D}${E}$; since $${A}${B}=${D}${E}$, it is $${E}$. Reflect over line $${D}${E}$ if the image of $${C}$ is across it from $${F}$. Since $\\angle ${A}\\cong\\angle ${D}$, the image of $${C}$ is on ray $${D}${F}$, and since $${A}${C}=${D}${F}$, it is $${F}$. So a sequence of rigid motions maps $\\triangle ${A}${B}${C}$ onto $\\triangle ${D}${E}${F}$.`;
}

function directionSurface(c: ReasoningCase, r: Random): Surface | null {
  const { L, argument, task } = c;
  const board = `Let $P$ be the statement: ${boardP(L)}. Let $Q$ be the statement: ${listText(sixGivens(L))}. Argument: ${argumentText(L, argument)}`;
  const fwd = argument === "forward";
  const reaches = fwd
    ? "It starts from the rigid motions, statement $P$, and ends with the six congruent pairs, statement $Q$."
    : "It starts from the six congruent pairs, statement $Q$, and ends with the rigid motions, statement $P$.";
  const tri1 = `\\triangle ${L.A}${L.B}${L.C}`;
  const tri2 = `\\triangle ${L.D}${L.E}${L.F}`;
  if (task === "direction") {
    return choiceSurface(r, {
      prompt: `${board} Which statement does this argument prove?`,
      options: [
        {
          label: fwd ? "If $P$, then $Q$." : "If $Q$, then $P$.",
          correct: true,
        },
        {
          label: fwd ? "If $Q$, then $P$." : "If $P$, then $Q$.",
          feedback:
            "An argument proves “if (what it assumes), then (what it reaches)”. This one reads the other way.",
        },
        {
          label:
            "$P$ if and only if $Q$, since one argument proves both directions.",
          feedback:
            "One argument runs one way. An if-and-only-if statement needs both directions, usually two arguments.",
        },
        {
          label:
            "Neither: only a criterion such as SSS can show two triangles are congruent.",
          feedback:
            "Congruence is defined by rigid motions; SSS is a shortcut proved from that definition. The argument does prove one direction.",
        },
      ],
      hint: `Read the first sentence of the argument and its last. Which one talks about rigid motions mapping $${tri1}$ onto $${tri2}$, and which one about six pairs of parts?`,
      explanation: [
        "An argument that assumes one statement and reaches another proves “if (the assumed statement), then (the reached statement)”.",
        reaches,
        `So it proves ${fwd ? "“if $P$, then $Q$”" : "“if $Q$, then $P$”"}. Together with the other direction it would give $P$ if and only if $Q$: two triangles are congruent exactly when all six pairs of corresponding parts are congruent.`,
      ],
    });
  }
  const shown = fwd ? "if $P$, then $Q$" : "if $Q$, then $P$";
  return choiceSurface(r, {
    prompt: `${board} This argument proves “${shown}”. What else must be proved to conclude “$P$ if and only if $Q$”?`,
    options: [
      {
        label: fwd
          ? "If $Q$, then $P$: six congruent pairs give a sequence of rigid motions."
          : "If $P$, then $Q$: rigid motions make all six pairs congruent.",
        correct: true,
      },
      {
        label: fwd
          ? `That if rigid motions map $${tri2}$ onto $${tri1}$, the six pairs are congruent.`
          : `That if the six pairs are congruent, rigid motions map $${tri2}$ onto $${tri1}$.`,
        feedback:
          "Swapping the names of the triangles gives the same direction again: it still starts from what this argument starts from.",
      },
      {
        label:
          "Nothing: one direction of an if-and-only-if statement is enough.",
        feedback:
          "“$P$ if and only if $Q$” means both “if $P$, then $Q$” and “if $Q$, then $P$”. One direction is half of it.",
      },
      {
        label:
          "That the two triangles have the same orientation, so no reflection is needed.",
        feedback:
          "Orientation is not part of either statement: triangles with opposite orientations can be congruent, by a sequence that includes a reflection.",
      },
    ],
    hint: `Split “$P$ if and only if $Q$” into two if-then statements about $${tri1}$ and $${tri2}$. For each one, ask whether the argument above already proves it.`,
    explanation: [
      "“$P$ if and only if $Q$” means “if $P$, then $Q$” and also “if $Q$, then $P$”.",
      reaches,
      `What remains is the other direction, ${fwd ? "“if $Q$, then $P$”: six congruent pairs of parts give a sequence of rigid motions (translate, rotate, reflect if needed, then pin the third vertex)." : "“if $P$, then $Q$”: a sequence of rigid motions carries each part onto its match and preserves distance and angle measure."}`,
    ],
  });
}

function flawSurface(c: ReasoningCase, r: Random): Surface | null {
  const { L, pair, flaw } = c;
  const { A, B, C, D, E, F } = L;
  const step1 = `Translate by the vector from $${A}$ to $${D}$, so $${A}$ lands on $${D}$.`;
  const step2 = `Rotate about $${D}$ until the image of $${B}$ is on ray $${D}${E}$. Distance is preserved, so the image is the point of ray $${D}${E}$ at distance $${A}${B}=${D}${E}$ from $${D}$: it is $${E}$.`;
  const step3 = `If the image of $${C}$ is across line $${D}${E}$ from $${F}$, reflect over line $${D}${E}$; this keeps $${D}$ and $${E}$ in place and moves the image of $${C}$ to $${F}$'s side.`;
  const step4 = `Angle measure is preserved and $\\angle ${A}\\cong\\angle ${D}$, so the image of $${C}$ is on ray $${D}${F}$; since $${A}${C}=${D}${F}$, it is $${F}$.`;
  const step5 = `The motions map $\\triangle ${A}${B}${C}$ onto $\\triangle ${D}${E}${F}$, so the triangles are congruent by the definition of congruence.`;
  let steps = [step1, step2, step3, step4, step5];
  let real: ChoiceOption | null = null;
  if (flaw === "center") {
    steps[1] = `Rotate about the midpoint of $\\overline{${D}${E}}$ until the image of $${B}$ is on ray $${D}${E}$. Distance is preserved, so the image is the point at distance $${A}${B}=${D}${E}$ from $${D}$: it is $${E}$.`;
    real = {
      label: `Step 2 is wrong: rotating about a point other than $${D}$ moves the image of $${A}$ off $${D}$.`,
      correct: true,
    };
  } else if (flaw === "leap") {
    steps = [
      step1,
      step2,
      `Two vertices now match, so the image of $${C}$ must be $${F}$.`,
      step5,
    ];
    real = {
      label: `Step 3 is wrong: nothing pins the image of $${C}$ to $${F}$; it may be across line $${D}${E}$.`,
      correct: true,
    };
  } else if (flaw === "angles") {
    steps[1] = `Rotate about $${D}$ until the image of $${B}$ is on ray $${D}${E}$. Since $\\angle ${A}\\cong\\angle ${D}$ and $\\angle ${B}\\cong\\angle ${E}$, the image is $${E}$.`;
    real = {
      label: `Step 2 is wrong: equal angles do not fix how far along ray $${D}${E}$ the image of $${B}$ lands.`,
      correct: true,
    };
  } else if (flaw === "distance") {
    steps[3] = `Distance is preserved and $${A}${C}=${D}${F}$, so the image of $${C}$ is $${F}$.`;
    real = {
      label: `Step 4 is wrong: distance $${D}${F}$ from $${D}$ allows a whole circle of points, not just $${F}$.`,
      correct: true,
    };
  } else if (flaw === "criterion") {
    steps[4] = `By SAS, $\\triangle ${A}${B}${C}\\cong\\triangle ${D}${E}${F}$, so some sequence of rigid motions maps one onto the other.`;
    real = {
      label:
        "Step 5 is wrong: it cites SAS, which is proved by this very argument.",
      correct: true,
    };
  }
  const last = steps.length;
  const correctSteps = new Set(
    flaw === "center" || flaw === "angles"
      ? [1, 3, 4, 5]
      : flaw === "leap"
        ? [1, 2, 4]
        : flaw === "distance"
          ? [1, 2, 3, 5]
          : flaw === "criterion"
            ? [1, 2, 3, 4]
            : [1, 2, 3, 4, 5],
  );
  const accusations: { step: number; option: ChoiceOption }[] = [
    {
      step: 1,
      option: {
        label: `Step 1 is wrong: a translation can move $${A}$ onto $${D}$ only if $\\overline{${A}${B}}\\parallel\\overline{${D}${E}}$.`,
        feedback:
          "A translation can carry any point to any other point. Step 1 is correct.",
      },
    },
    {
      step: 2,
      option: {
        label: `Step 2 is wrong: rotations do not preserve distance, so the image of $${B}$ need not be $${E}$.`,
        feedback:
          "Rotations are rigid motions, so they do preserve distance. Step 2 is correct.",
      },
    },
    ...(steps.length === 5
      ? [
          {
            step: 3,
            option: {
              label: `Step 3 is wrong: a reflection over line $${D}${E}$ moves $${D}$ and $${E}$ off their places.`,
              feedback:
                "A reflection keeps every point of its line in place. Step 3 is correct.",
            },
          },
          {
            step: 4,
            option: {
              label:
                "Step 4 is wrong: an angle and one side cannot fix a point; all three sides are needed.",
              feedback:
                "The angle puts the image on one ray and the length puts it at one point of that ray. Step 4 is correct.",
            },
          },
        ]
      : []),
    {
      step: last,
      option: {
        label: `Step ${last} is wrong: the argument must also show that the triangles have equal areas.`,
        feedback:
          "Congruence needs only the rigid motions; equal area then follows. The last step is correct.",
      },
    },
  ];
  const falseFlaws = shuffle(
    r,
    accusations.filter((a) => correctSteps.has(a.step)),
  ).map((a) => a.option);
  const complete: ChoiceOption =
    flaw === "none"
      ? { label: "The argument is correct and complete.", correct: true }
      : {
          label: "The argument is correct and complete.",
          feedback:
            "One step does not follow. Check each step against what the steps before it have shown.",
        };
  const options =
    flaw === "none"
      ? [complete, ...falseFlaws.slice(0, 3)]
      : [real!, complete, ...falseFlaws.slice(0, 2)];
  const board = steps.map((s, i) => `Step ${i + 1}: ${s}`).join(" ");
  const marks = criterionMarks("six");
  const verdict =
    flaw === "none"
      ? "Every step follows, so the argument is correct and complete."
      : real!.label;
  const s = choiceSurface(r, {
    prompt: `Given: ${listText(sixGivens(L))}. A student argues that a sequence of rigid motions maps $\\triangle ${A}${B}${C}$ onto $\\triangle ${D}${E}${F}$ with $${A}\\to ${D}$, $${B}\\to ${E}$, $${C}\\to ${F}$, using only properties of rigid motions and the definition of congruence. ${board} Which is true of the argument?`,
    options,
    hint: `Check the steps in order, from Step 1 to Step ${steps.length}: what may each conclude from the steps before it? Ask what puts $${A}$ on $${D}$, what puts the image of $${B}$ exactly on $${E}$, and what pins the image of $${C}$ to $${F}$.`,
    explanation: [
      `A correct argument lands one vertex at a time: a translation puts $${A}$ on $${D}$; a rotation about $${D}$ puts the image of $${B}$ on ray $${D}${E}$, and the length $${A}${B}=${D}${E}$ makes it $${E}$; a reflection over line $${D}${E}$ is used if the image of $${C}$ is on the wrong side; the angle at $${D}$ puts it on ray $${D}${F}$, and the length $${A}${C}=${D}${F}$ makes it $${F}$; the definition of congruence concludes.`,
      verdict,
      "The other accusations are false: a translation can move any point to any point, rotations preserve distance, a reflection fixes its own line, an angle and a length together fix a point, and congruence needs no separate area check.",
    ],
  });
  if (!s) return null;
  return {
    ...s,
    figure: pairFigure(
      `Triangles ${A}${B}${C} and ${D}${E}${F}; ${marksText(L, marks)}.`,
      pair.at,
      L,
      marks,
    ),
  };
}

const reasoningFamily = chainFamily({
  template: reasoningTemplate,
  axes: {
    task: defineAxis(
      "task",
      ["forward", "direction", "remains", "flaw"] as const,
      {
        weights: [16, 5, 5, 14],
      },
    ),
  },
  model: (r, axes) => reasoningCase(r, axes.task),
  render: (c, _axes, r) =>
    c.task === "forward"
      ? forwardSurface(c, r)
      : c.task === "flaw"
        ? flawSurface(c, r)
        : directionSurface(c, r),
  variant: (c) => c.variant,
});

/* ===================================== coordinates (2.3) */

type Pt = [number, number];
type Theta = 0 | 90 | 180 | 270;
const rot = (p: Pt, t: Theta): Pt =>
  t === 0
    ? [p[0], p[1]]
    : t === 90
      ? [-p[1], p[0]]
      : t === 180
        ? [-p[0], -p[1]]
        : [p[1], -p[0]];
const vsub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const vadd = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sq = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
/** Mirror of w (a vector from D) across the direction u, which is
 * horizontal, vertical or diagonal, so the image stays on the grid. */
function mirror(w: Pt, u: Pt): Pt {
  if (u[1] === 0) return [w[0], -w[1]];
  if (u[0] === 0) return [-w[0], w[1]];
  if (u[0] === u[1]) return [w[1], w[0]];
  return [-w[1], -w[0]];
}
const inBox = (p: Pt) => Math.abs(p[0]) <= 8 && Math.abs(p[1]) <= 8;
const box = (ps: Pt[]) => ({
  x0: Math.min(...ps.map((p) => p[0])),
  x1: Math.max(...ps.map((p) => p[0])),
  y0: Math.min(...ps.map((p) => p[1])),
  y1: Math.max(...ps.map((p) => p[1])),
});
const apart = (a: Pt[], b: Pt[]) => {
  const p = box(a),
    q = box(b);
  return p.x1 < q.x0 || q.x1 < p.x0 || p.y1 < q.y0 || q.y1 < p.y0;
};

interface CoordinateCase {
  L: Letters;
  A: Pt;
  B: Pt;
  C: Pt;
  D: Pt;
  E: Pt;
  F: Pt;
  theta: Theta;
  reflect: boolean;
}
function coordinateCase(
  r: Random,
  theta: Theta,
  reflect: boolean,
): CoordinateCase {
  const L = drawLetters(r);
  for (let attempt = 0; attempt < 400; attempt++) {
    const k = r(2, 5) * (r(0, 1) ? 1 : -1);
    const dir = pick(r, [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ] as Pt[]);
    const A: Pt = [r(-8, 8), r(-8, 8)];
    const B = vadd(A, [dir[0] * k, dir[1] * k]);
    const C: Pt = [r(-8, 8), r(-8, 8)];
    if (![B, C].every(inBox)) continue;
    const s = [sq(A, B), sq(B, C), sq(C, A)];
    if (new Set(s).size < 3) continue;
    const area2 = Math.abs(
      (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]),
    );
    if (area2 < 12 || area2 > 60) continue;
    const D: Pt = [r(-8, 8), r(-8, 8)];
    // D is never the origin, so a turn about the origin moves D.
    if ((D[0] === A[0] && D[1] === A[1]) || (D[0] === 0 && D[1] === 0))
      continue;
    const u = rot(vsub(B, A), theta);
    const E = vadd(D, u);
    const w = rot(vsub(C, A), theta);
    const F = vadd(D, reflect ? mirror(w, u) : w);
    if (![D, E, F].every(inBox)) continue;
    if (!apart([A, B, C], [D, E, F])) continue;
    // No vertex on an axis, where its name would crowd the axis numbers.
    if ([A, B, C, D, E, F].some((p) => p[0] === 0 || p[1] === 0)) continue;
    // Distractors stay distinct: E − B differs from D − A.
    return { L, A, B, C, D, E, F, theta, reflect };
  }
  throw new Error("Need three retry: no placement");
}

const signed = (n: number) => (n < 0 ? `-${-n}` : `+${n}`);
const mapText = (v: Pt) =>
  `$(x,y)\\to(x${v[0] === 0 ? "" : signed(v[0])},\\,y${v[1] === 0 ? "" : signed(v[1])})$`;
const ptText = (name: string, p: Pt) => `$${name}(${p[0]},${p[1]})$`;
const turnText = (t: Theta, about: string) =>
  t === 180
    ? `$180^\\circ$ about ${about}`
    : `$${t}^\\circ$ counterclockwise about ${about}`;

function coordinateRender(c: CoordinateCase, r: Random): Surface {
  const { L, A, B, C, D, E, F, theta, reflect } = c;
  const v = vsub(D, A);
  // Part 1: the translation.
  const eb = vsub(E, B);
  const sourceSlip: Pt = eb[0] === v[0] && eb[1] === v[1] ? vsub(F, A) : eb;
  const p1 = [
    { label: mapText(v), ok: true },
    { label: mapText([-v[0], -v[1]]), ok: false },
    { label: mapText(vsub(E, A)), ok: false },
    { label: mapText(sourceSlip), ok: false },
  ];
  // Part 2: the rotation that puts the image of B on E.
  const p2 =
    theta === 0
      ? [
          { label: "No rotation is needed", ok: true },
          { label: turnText(90, `$${L.D}$`), ok: false },
          { label: turnText(180, `$${L.D}$`), ok: false },
          { label: turnText(270, `$${L.D}$`), ok: false },
        ]
      : [
          { label: turnText(theta, `$${L.D}$`), ok: true },
          { label: turnText(theta, "the origin"), ok: false },
          {
            label: turnText(
              theta === 180 ? 90 : ((360 - theta) as Theta),
              `$${L.D}$`,
            ),
            ok: false,
          },
          { label: turnText(theta, `$${L.E}$`), ok: false },
        ];
  const p3 = [
    {
      label: `It is on ray $${L.D}${L.E}$ at distance $${L.A}${L.B}=${L.D}${L.E}$ from $${L.D}$`,
      ok: true,
    },
    {
      label: `A rotation about $${L.D}$ can move any point onto any other point`,
      ok: false,
    },
    {
      label: `Its $x$-coordinate equals the $x$-coordinate of $${L.E}$`,
      ok: false,
    },
    {
      label: `Rigid motions preserve angles, and $\\angle ${L.B}\\cong\\angle ${L.E}$`,
      ok: false,
    },
  ];
  const p4 = [
    {
      label: `Yes: the image of $${L.C}$ is across line $${L.D}${L.E}$ from $${L.F}$`,
      ok: reflect,
    },
    {
      label: `No: the image of $${L.C}$ is on $${L.F}$'s side of line $${L.D}${L.E}$`,
      ok: !reflect,
    },
    { label: "Yes: congruent triangles always need a reflection", ok: false },
    { label: "No: a reflection is never needed after a rotation", ok: false },
  ];
  const p5 = [
    {
      label: `$\\angle ${L.A}\\cong\\angle ${L.D}$ puts it on ray $${L.D}${L.F}$; $${L.A}${L.C}=${L.D}${L.F}$ puts it at $${L.F}$`,
      ok: true,
    },
    { label: "Two vertices already match, so the third must too", ok: false },
    {
      label: `Distance is preserved, so it is $${L.A}${L.C}$ from $${L.D}$`,
      ok: false,
    },
    { label: "The two triangles look the same in the figure", ok: false },
  ];
  const blanksRaw: [string, string, { label: string; ok: boolean }[]][] = [
    ["move", `1. The translation that carries $${L.A}$ to $${L.D}$`, p1],
    [
      "turn",
      `2. The rotation that then carries the image of $${L.B}$ to $${L.E}$`,
      p2,
    ],
    ["land", `3. Why the image of $${L.B}$ is exactly $${L.E}$`, p3],
    ["flip", `4. Is a reflection over line $${L.D}${L.E}$ needed next?`, p4],
    ["pin", `5. Why the image of $${L.C}$ then lands exactly on $${L.F}$`, p5],
  ];
  const key: Record<string, string> = {};
  const blanks = blanksRaw.map(([id, label, options]) => {
    const shown = shuffle(r, [...options]);
    if (new Set(shown.map((o) => o.label)).size !== 4)
      throw new Error("Need three retry: options repeat");
    key[id] = "abcd"[shown.findIndex((o) => o.ok)]!;
    return {
      id,
      label,
      options: shown.map((o, i) => ({ id: "abcd"[i]!, label: o.label })),
    };
  });
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose an option for each step",
    layout: "slots",
    blanks,
  };
  const tri1 = `\\triangle ${L.A}${L.B}${L.C}`;
  const tri2 = `\\triangle ${L.D}${L.E}${L.F}`;
  const t1 = turn(A, B, C) > 0,
    t2 = turn(D, E, F) > 0;
  const lim = 9;
  // Gridlines every unit; axis numbers only at the window's ends and the
  // origin, so vertex names keep clear of them at phone width (the prompt
  // states every coordinate, and the gridlines count the units).
  const g = graph({
    x: [-lim, lim],
    y: [-lim, lim],
    grid: 1,
    labels: "ends",
  }).id("grid");
  for (const [p, q] of [
    [A, B],
    [B, C],
    [C, A],
  ] as [Pt, Pt][])
    g.segment(p, q, { color: "accent" });
  for (const [p, q] of [
    [D, E],
    [E, F],
    [F, D],
  ] as [Pt, Pt][])
    g.segment(p, q, { color: "warm" });
  (
    [
      [A, L.A, "accent"],
      [B, L.B, "accent"],
      [C, L.C, "accent"],
      [D, L.D, "warm"],
      [E, L.E, "warm"],
      [F, L.F, "warm"],
    ] as [Pt, string, "accent" | "warm"][]
  ).forEach(([p, name, color]) => g.point(p[0], p[1], name, { color }));
  // Matching marks: one, two and three ticks on corresponding sides, and
  // one, two and three arcs at corresponding angles (all six are given).
  const marks: Element[] = [];
  const tickPairs: [Pt, Pt, Pt, Pt, number][] = [
    [A, B, D, E, 1],
    [B, C, E, F, 2],
    [C, A, F, D, 3],
  ];
  tickPairs.forEach(([p, q, s1, s2, n], i) =>
    marks.push(
      ...figureTicks(`tk${i}a`, p, q, n),
      ...figureTicks(`tk${i}b`, s1, s2, n),
    ),
  );
  const arcAt: [Pt, Pt, Pt, number][] = [
    [A, B, C, 1],
    [B, C, A, 2],
    [C, A, B, 3],
    [D, E, F, 1],
    [E, F, D, 2],
    [F, D, E, 3],
  ];
  arcAt.forEach(([v, p, q, n], i) =>
    marks.push(...figureAngleMark(`ar${i}`, v, p, q, { arcs: n, r: 0.55 })),
  );
  const figure: SemanticFigure = sceneFigure(
    sceneOf(g, ...marks).build({
      title: `Triangle ${L.A}${L.B}${L.C} with ${L.A}(${A}), ${L.B}(${B}), ${L.C}(${C}) and triangle ${L.D}${L.E}${L.F} with ${L.D}(${D}), ${L.E}(${E}), ${L.F}(${F}), with matching marks`,
    }),
  );
  const image = (p: Pt) => vadd(D, rot(vsub(p, A), theta));
  // Images: B1, C1 after the translation; C2 after the rotation too.
  const B1 = vadd(B, v);
  const C2 = image(C);
  const step = (p: Pt) => `$(${p[0]},${p[1]})$`;
  const shownWrongTurn: Theta = theta === 180 ? 90 : ((360 - theta) as Theta);
  const missed = vadd(D, rot(vsub(B1, D), shownWrongTurn));
  const turnStep =
    theta === 0
      ? `2. After the translation, $${L.B}$ is at ${ptText(`${L.B}_1`, B1)}, which is already ${ptText(L.E, E)}: the step from $${L.D}$ to it, ${step(vsub(B1, D))}, is the step from $${L.D}$ to $${L.E}$. So no rotation is needed; any turn about $${L.D}$ would carry it off $${L.E}$.`
      : `2. After the translation, $${L.B}$ is at ${ptText(`${L.B}_1`, B1)}. From $${L.D}$ the step to it is ${step(vsub(B1, D))} and the step to $${L.E}$ is ${step(vsub(E, D))}, so a turn of ${turnText(theta, `$${L.D}$`)} carries $${L.B}_1$ to ${ptText(L.E, E)}. The center must be $${L.D}$, so that $${L.D}$ stays put; a turn about the origin or about $${L.E}$ moves it. ${theta === 180 ? `A $90^\\circ$ turn about $${L.D}$ goes only half as far, to $(${missed[0]},${missed[1]})$.` : `Turning $${shownWrongTurn}^\\circ$ counterclockwise instead goes the other way round, to $(${missed[0]},${missed[1]})$.`}`;
  const landStep =
    theta === 0
      ? `3. The translation puts $${L.B}_1$ on ray $${L.D}${L.E}$. Rigid motions preserve distance, so it is $${L.A}${L.B}$ from $${L.D}$, and $${L.A}${L.B}=${L.D}${L.E}$. Only one point of the ray is that far from $${L.D}$: the point $${L.E}$. One matching coordinate or an angle cannot fix a point.`
      : `3. The rotation keeps $${L.D}$ fixed and puts the image of $${L.B}$ on ray $${L.D}${L.E}$. Rigid motions preserve distance, so it is $${L.A}${L.B}$ from $${L.D}$, and $${L.A}${L.B}=${L.D}${L.E}$. Only one point of the ray is that far from $${L.D}$: the point $${L.E}$. One matching coordinate or an angle cannot fix a point.`;
  return {
    prompt: `Triangle $${L.A}${L.B}${L.C}$ has vertices ${ptText(L.A, A)}, ${ptText(L.B, B)} and ${ptText(L.C, C)}; triangle $${L.D}${L.E}${L.F}$ has vertices ${ptText(L.D, D)}, ${ptText(L.E, E)} and ${ptText(L.F, F)}. The six corresponding parts of $${tri1}$ and $${tri2}$ are congruent: ${listText(sixGivens(L))}. Build the sequence of rigid motions that maps $${tri1}$ onto $${tri2}$ with $${L.A}\\to ${L.D}$, $${L.B}\\to ${L.E}$, $${L.C}\\to ${L.F}$, and justify each landing.`,
    response,
    answer: serializeMultiPart(response, key),
    hint: `Start with the letters: do $${L.A}\\to ${L.B}\\to ${L.C}$ and $${L.D}\\to ${L.E}\\to ${L.F}$ run the same way round? Then slide ${ptText(L.A, A)} onto ${ptText(L.D, D)} and compare the step from $${L.D}$ to the image of $${L.B}$ with the step from $${L.D}$ to $${L.E}$.`,
    explanation: [
      `Orientation first: $${L.A}\\to ${L.B}\\to ${L.C}$ runs ${t1 ? "counterclockwise" : "clockwise"} and $${L.D}\\to ${L.E}\\to ${L.F}$ runs ${t2 ? "counterclockwise" : "clockwise"}, so ${reflect ? "a reflection will be needed" : "no reflection will be needed"}.`,
      `1. From ${ptText(L.A, A)} to ${ptText(L.D, D)}, $x$ changes by $${v[0]}$ and $y$ by $${v[1]}$, so the translation is ${mapText(v)}. The reversed vector moves the wrong way, and the vectors to $${L.E}$ or from $${L.B}$ start or end at the wrong vertex.`,
      turnStep,
      landStep,
      `4. ${theta === 0 ? "After the translation" : "After the translation and the rotation"}, the image of $${L.C}$ is ${ptText(`${L.C}_${theta === 0 ? 1 : 2}`, C2)}. ${reflect ? `It is across line $${L.D}${L.E}$ from ${ptText(L.F, F)}, so reflect over line $${L.D}${L.E}$: $${L.D}$ and $${L.E}$ stay put and the image moves to $${L.F}$'s side.` : `It is on the same side of line $${L.D}${L.E}$ as ${ptText(L.F, F)}, so no reflection is needed.`} Translations and rotations never change orientation; a reflection always reverses it.`,
      `5. Angle measure is preserved and $\\angle ${L.A}\\cong\\angle ${L.D}$, so the image of $${L.C}$ is on ray $${L.D}${L.F}$; distance is preserved and $${L.A}${L.C}=${L.D}${L.F}$, so it is $${L.F}$. Two matching vertices alone allow a mirror image, and a distance alone allows a whole circle.`,
      `All three vertices land on their matches, so the sequence maps $${tri1}$ onto $${tri2}$: by definition, $${tri1}\\cong${tri2}$.`,
    ],
    figure,
  };
}

const coordinateFamily = chainFamily({
  template: coordinateTemplate,
  axes: {
    turn: defineAxis("turn", ["t0", "t90", "t180", "t270"] as const, {
      legacy: "t90",
      weights: [15, 30, 25, 30],
    }),
    reflect: defineAxis("reflect", ["no", "yes"] as const),
  },
  model: (r, axes) =>
    coordinateCase(
      r,
      Number(axes.turn.slice(1)) as Theta,
      axes.reflect === "yes",
    ),
  render: (c, _axes, r) => coordinateRender(c, r),
  variant: (c) => `turn-${c.theta}-${c.reflect ? "reflect" : "no-reflect"}`,
});

export const congruenceRigidMotionGenerate = dispatch(
  congruenceRigidMotionTemplates,
  {
    "six-parts-imply-rigid-motion-proof": (seed) =>
      sixProofFamily.generate(seed).problem,
    "congruence-definition-reasoning": (seed) =>
      reasoningFamily.generate(seed).problem,
    "rigid-motion-from-six-parts-coordinates": (seed) =>
      coordinateFamily.generate(seed).problem,
  },
);
export const congruenceRigidMotionCases = {
  "six-parts-imply-rigid-motion-proof": sixProofFamily.generate,
  "congruence-definition-reasoning": reasoningFamily.generate,
  "rigid-motion-from-six-parts-coordinates": coordinateFamily.generate,
};
