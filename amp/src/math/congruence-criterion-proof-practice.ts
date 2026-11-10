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
  add,
  anglesOf,
  assembleProof,
  blankStatementWork,
  congruentPair,
  criterionGivens,
  criterionMarks,
  criterionName,
  decoyText,
  dist,
  drawLetters,
  drawSides,
  givenTex,
  imageC,
  lineExplanation,
  marksText,
  orderNote,
  orientationText,
  pairFigure,
  place,
  proofScript,
  reasonMisconception,
  reasonText,
  rotateVec,
  scriptReasons,
  sub,
  turn,
  type DecoyKey,
  type GivenKey,
  type Letters,
  type Path,
  type ReasonKey,
  type Role,
  type RowKey,
  type ScriptLine,
  type TrianglePair,
} from "./congruence-rigid-motion-kit";
import { figureSegment, figureTicks } from "./geometry-teaching-figures";
import type { Element, Point } from "./scene/spec";
import { proofWork, workSurface } from "./structured-work-kit";
import { defineAxis, type Random } from "./variation/axes";
import type { Surface } from "./variation/compose";

/**
 * HSG.CO.B.8: SAS, ASA and SSS follow from the rigid-motion definition of
 * congruence. One shared script (translate A to D and rotate about D, land
 * B on E with AB = DE, reflect over line DE when the orientations differ,
 * then pin the third vertex by the criterion's remaining givens) is
 * ordered, completed and justified, and the same argument is shown to
 * fail for SSA and AAA.
 */

export const congruenceCriterionProofTemplates: readonly TemplateMetadata[] = [
  {
    id: "rigid-motion-criterion-proof",
    version: 1,
    title: "Prove SAS, ASA or SSS with rigid motions",
    skillId: "congruence-criteria",
    gradeBand: "9–12",
    difficultyOffset: 0.6,
    requiredResponseCapability: "structured-work-v1",
    requiredFigureCapability: "scenes-v1",
    description:
      "Two-column rigid-motion proof that SAS, ASA or SSS gives congruent triangles: translate and rotate so $A$ lands on $D$ and $B$ on ray $DE$, use $AB=DE$ to land $B$ on $E$, reflect over line $DE$ when the orientations differ, then pin the third vertex with an angle and a side, two angles, or two circles. Order the lines, choose the missing statements from a bank with phantom-given, circular and unpinned decoys, or choose the missing reasons; every valid order is accepted.",
    glossaryNoLink: ["side", "sides", "image", "point", "lands", "reflecting"],
  },
  {
    id: "rigid-motion-criterion-reason",
    version: 1,
    title: "Justify a step of a rigid-motion congruence proof",
    skillId: "congruence-criteria",
    gradeBand: "9–12",
    difficultyOffset: 0.5,
    requiredResponseCapability: "single-choice-v1",
    requiredFigureCapability: "scenes-v1",
    description:
      "For one step of the rigid-motion proof of SAS, ASA or SSS: choose the complete justification (a property of rigid motions together with the fact that pins a point or ray), name the given the step uses, decide from the triangles' orientations whether a reflection is needed, or decide which criterion a finish proves or whether it has a gap.",
    glossaryNoLink: ["side", "sides", "image", "point", "lands", "step"],
  },
  {
    id: "rigid-motion-criterion-flaw",
    version: 1,
    title: "Find the flaw in a rigid-motion congruence proof",
    skillId: "congruence-criteria",
    gradeBand: "9–12",
    difficultyOffset: 0.6,
    requiredResponseCapability: "single-choice-v1",
    requiredFigureCapability: "scenes-v1",
    description:
      "Find the one wrong line, and the reason it is wrong, in a rigid-motion proof of SAS, ASA or SSS (a translation said to turn a segment, a rotation said to reach any point, a given that was not given, a circular step, a reflection said to move its own line); or find where the same argument first fails for SSA, whose circle can meet the ray twice, and for AAA, which has no length to fix the second vertex.",
    glossaryNoLink: ["side", "sides", "image", "point", "lands", "line"],
  },
];
const [proofTemplate, reasonTemplate, flawTemplate] =
  congruenceCriterionProofTemplates as [
    TemplateMetadata,
    TemplateMetadata,
    TemplateMetadata,
  ];

const m = (s: string) => `$${s}$`;
const listText = (items: string[]) =>
  `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const givensText = (L: Letters, keys: GivenKey[]) =>
  listText(keys.map((k) => m(givenTex[k](L))));
const tri = (L: Letters) => ({
  abc: `\\triangle ${L.A}${L.B}${L.C}`,
  def: `\\triangle ${L.D}${L.E}${L.F}`,
});
const correspondence = (L: Letters) =>
  `$${L.A}\\to ${L.D}$, $${L.B}\\to ${L.E}$, $${L.C}\\to ${L.F}$`;

interface CriterionCase {
  L: Letters;
  pair: TrianglePair;
  path: Path;
  script: ScriptLine[];
}
function criterionCase(
  r: Random,
  path: Path,
  opposite: boolean,
): CriterionCase {
  const L = drawLetters(r);
  const pair = congruentPair(r, opposite);
  return { L, pair, path, script: proofScript(L, path, opposite) };
}
function criterionFigure(c: CriterionCase, marked = true) {
  const { L, pair, path } = c;
  const marks = marked ? criterionMarks(path) : {};
  return pairFigure(
    `Triangles ${L.A}${L.B}${L.C} and ${L.D}${L.E}${L.F}${marked ? `; ${marksText(L, marks)}` : ""}.`,
    pair.at,
    L,
    marks,
  );
}
/** The given each line consumes, if any. */
const consumed = (path: Path, key: RowKey): GivenKey[] =>
  key === "be"
    ? ["AB"]
    : key === "ray"
      ? ["A"]
      : key === "rays"
        ? ["A", "B"]
        : key === "circ"
          ? ["CA", "BC"]
          : key === "pin" && path === "sas"
            ? ["CA"]
            : [];

/* ================================================ proof (2.1) */

/** Distractor reasons for a criterion's proof, each wrong for every line.
 * "Two points determine one line" would justify the two-angle finish. */
const proofDistractors = (path: Path): ReasonKey[] => [
  "cpctc",
  "criterion",
  "freeRotation",
  "reflectionKeepsOrientation",
  "leap",
  "picture",
  "reflectionMovesLine",
  ...(path === "asa" ? [] : (["twoPoints"] as ReasonKey[])),
  ...(path === "sss" ? (["oneMeeting"] as ReasonKey[]) : []),
];
/** Statement decoys tied to the line they imitate. */
function decoysFor(key: RowKey, path: Path, opposite: boolean): DecoyKey[] {
  if (key === "be") return ["rotateOntoE", "angleLandsB", "segmentTranslate"];
  if (key === "or")
    return opposite
      ? ["reflectMovesD", "noReflection", "wrongSide"]
      : ["noReflection", "wrongSide"];
  // In ASA the line above the last one already puts the point on both
  // rays, so "on ray DF, so it is F" would be defensible there.
  return [
    "circular",
    ...(path === "asa" ? [] : (["rayOnly"] as DecoyKey[])),
    "phantom",
    ...(path === "sss" ? (["oneMeetingStatement"] as DecoyKey[]) : []),
  ];
}
/** Why each decoy statement cannot be a line of the proof. */
const DECOY_WHY: Record<DecoyKey, string> = {
  segmentTranslate:
    "a translation cannot turn a segment, so it lands only one point",
  rotateOntoE:
    "a rotation keeps each point's distance from its center, so it cannot carry the vertex just anywhere",
  angleLandsB:
    "an angle at the moving point does not fix how far along the ray it is",
  leapStatement: "two matching vertices do not pin the third",
  circular: "it assumes the congruence the proof is proving",
  noReflection: "it assumes the congruence; orientation decides the side",
  reflectMovesD: "a reflection keeps every point of its own line in place",
  wrongSide: "the orientations put the image on the other side",
  rayOnly: "a ray alone does not pin the point",
  phantom: "it uses a pair that is not given",
  oneMeetingStatement: "two circles can meet in two points",
};

type ProofTask = "order" | "statements" | "reasons";
function proofRender(c: CriterionCase, task: ProofTask, r: Random): Surface {
  const { L, pair, path, script } = c;
  const opposite = pair.opposite;
  // Blank statements: two of lines 2 to 5, at least one of them a finish
  // line (4 or 5) that belongs to this criterion.
  const finishLine = r(3, 4);
  const other = pick(
    r,
    [1, 2, 3, 4].filter((i) => i !== finishLine),
  );
  const blanks = new Set([finishLine, other]);
  const decoyKeys =
    task === "statements"
      ? [
          ...new Set(
            [...blanks].flatMap((i) =>
              decoysFor(script[i]!.key, path, opposite),
            ),
          ),
        ]
      : shuffle(
          r,
          (
            [
              "rotateOntoE",
              "circular",
              "rayOnly",
              "phantom",
              "wrongSide",
            ] as DecoyKey[]
          ).filter((k) => path !== "asa" || k !== "rayOnly"),
        ).slice(0, 3);
  const decoys = shuffle(r, decoyKeys)
    .slice(0, 6)
    .map((key) => ({ key, tex: decoyText(L, key, opposite, path) }));
  const reasonKeys = [
    ...scriptReasons(script),
    ...shuffle(r, proofDistractors(path)).slice(0, 4),
  ];
  const model = assembleProof(
    r,
    script,
    decoys,
    reasonKeys.map((key) => ({ key, label: reasonText(L, key, path) })),
  );
  const built =
    task === "statements"
      ? blankStatementWork(model, blanks, "Your proof")
      : proofWork(
          model,
          task === "order" ? "order" : "fill",
          r,
          task === "order" ? "Order the proof" : "Your proof",
        );
  const what =
    task === "order"
      ? "The lines of the proof are shown out of order. Put them in order."
      : task === "statements"
        ? "The reasons are shown. Choose the statement for each blank line."
        : "The statements are shown. Choose the reason for each blank line.";
  const t = tri(L);
  const name = criterionName[path];
  const givens = criterionGivens[path];
  const pins =
    path === "sas"
      ? `the angle at $${L.D}$ puts the image of $${L.C}$ on a ray and the length $${L.A}${L.C}=${L.D}${L.F}$ fixes it on that ray`
      : path === "asa"
        ? `the angles at $${L.D}$ and $${L.E}$ put the image of $${L.C}$ on two rays`
        : `the lengths $${L.A}${L.C}=${L.D}${L.F}$ and $${L.B}${L.C}=${L.E}${L.F}$ put the image of $${L.C}$ on two circles`;
  return workSurface(built, {
    prompt: `Use the figure. Given: ${givensText(L, givens)}; ${orientationText(L, pair)}. Prove ${name} from the definition of congruence: show that a sequence of rigid motions maps $${t.abc}$ onto $${t.def}$ with ${correspondence(L)}. The proof may not cite CPCTC or a congruence criterion. ${what}`,
    hint: `Every proof of a criterion starts the same way: land $${L.A}$ on $${L.D}$, use $${L.A}${L.B}=${L.D}${L.E}$ to land the image of $${L.B}$ on $${L.E}$, and flip over line $${L.D}${L.E}$ only if the triangles run opposite ways round. Here ${pins}.`,
    explanation: [
      `Congruent means a sequence of rigid motions maps one triangle onto the other. A proof of ${name} builds that sequence and uses each given exactly where a point or a ray must land.`,
      ...script.map((line, i) => {
        const uses = consumed(path, line.key);
        return `${i + 1}. ${line.tex} ${reasonText(L, line.reason, path)} ${lineExplanation(L, line.key, path, opposite)} ${uses.length ? `Given used: ${listText(uses.map((k) => m(givenTex[k](L))))}.` : "No given is used here."}`;
      }),
      orderNote(L, path, opposite),
      // One sentence for each decoy statement or distractor reason shown.
      ...(task === "statements"
        ? decoys.map(
            (d) =>
              `“${d.tex.replace(/\.$/, "")}” cannot be a line of this proof: ${DECOY_WHY[d.key]}.`,
          )
        : task === "reasons"
          ? reasonKeys
              .filter((k) => !scriptReasons(script).includes(k))
              .map(
                (k) =>
                  `“${reasonText(L, k, path).replace(/\.$/, "")}” justifies no line: ${reasonMisconception[k]}.`,
              )
          : []),
    ],
    figure: criterionFigure(c),
  });
}

const proofFamily = chainFamily({
  template: proofTemplate,
  axes: {
    criterion: defineAxis("criterion", ["sas", "asa", "sss"] as const),
    orientation: defineAxis("orientation", ["same", "opposite"] as const),
    task: defineAxis("task", ["order", "statements", "reasons"] as const),
  },
  model: (r, axes) =>
    criterionCase(r, axes.criterion, axes.orientation === "opposite"),
  render: (c, axes, r) => proofRender(c, axes.task, r),
  variant: (c) => `${c.path}-${c.pair.opposite ? "reflect" : "no-reflect"}`,
});

/* ================================================ reasons (2.2) */

type Question = "justify" | "given" | "reflect" | "which";
interface ReasonCase extends CriterionCase {
  question: Question;
  step: RowKey | "ray-e" | "circ-d" | "circ-e";
  gap: boolean;
}
function reasonCase(
  r: Random,
  path: Path,
  opposite: boolean,
  question: Question,
): ReasonCase {
  const c = criterionCase(r, path, opposite);
  const justifiable: ReasonCase["step"][] = [
    "be",
    "or",
    ...(path === "sss" ? [] : (["ray"] as ReasonCase["step"][])),
    "pin",
  ];
  // One step in four uses no given pair, matching one option in four.
  const givenSteps: ReasonCase["step"][] =
    path === "sas"
      ? ["tr", "be", "ray", "pin"]
      : path === "asa"
        ? ["be", "ray", "ray-e", "pin"]
        : ["be", "circ-d", "circ-e", "pin"];
  const step =
    question === "justify" ? pick(r, justifiable) : pick(r, givenSteps);
  return { ...c, question, step, gap: r(1, 4) === 1 };
}

const setupText = (c: CriterionCase) => {
  const { L, path } = c;
  const t = tri(L);
  return `$${t.abc}$ and $${t.def}$ have ${givensText(L, criterionGivens[path])}. A proof of ${criterionName[path]} by rigid motions translates $${L.A}$ to $${L.D}$ and rotates about $${L.D}$ until the image $${L.B}'$ of $${L.B}$ is on ray $${L.D}${L.E}$; $${L.C}'$ is the image of $${L.C}$.`;
};

function justifySurface(c: ReasonCase, r: Random): Surface | null {
  const { L, path, pair, step } = c;
  const { A, B, C, D, E, F } = L;
  const opposite = pair.opposite;
  const Cs = imageC(L, opposite);
  const where = opposite
    ? ` After a reflection over line $${D}${E}$, the image of $${C}$ is $${C}''$.`
    : "";
  let question: string, options: ChoiceOption[], why: string;
  if (step === "be") {
    question = `Why must $${B}'$ be the point $${E}$, rather than another point of ray $${D}${E}$?`;
    options = [
      {
        label: `$${D}${B}'=${A}${B}=${D}${E}$ by preserved distance, and only one point of ray $${D}${E}$ is that far from $${D}$.`,
        correct: true,
      },
      {
        label: `Rigid motions preserve distance, so $${D}${B}'=${A}${B}$, the length of the side it came from.`,
        feedback: `True, but it never connects $${B}'$ to $${E}$: it needs $${A}${B}=${D}${E}$ and the fact that a ray has one point at each distance from its endpoint.`,
      },
      {
        label: `Angle measure is preserved, so $m\\angle ${D}${B}'${C}'=m\\angle ${B}$, and that angle fixes where $${B}'$ is.`,
        feedback:
          "An angle at the moving point does not fix how far along the ray it is. A length does.",
      },
      {
        label: `A rotation about $${D}$ can carry $${B}'$ to any point of ray $${D}${E}$, so it can carry it to $${E}$.`,
        feedback: `A rotation about $${D}$ keeps every point's distance from $${D}$, so it cannot slide $${B}'$ along the ray.`,
      },
      {
        label: `The triangles are congruent, so the image of $${B}$ has to land on its match, the point $${E}$.`,
        feedback: "That assumes the congruence the proof is trying to show.",
      },
    ];
    why = `Distance is preserved, so $${D}${B}'=${A}${B}$, and $${A}${B}=${D}${E}$ is given. The ray from $${D}$ through $${E}$ has exactly one point at distance $${D}${E}$ from $${D}$, so $${B}'=${E}$.`;
  } else if (step === "or") {
    const sideWord = opposite ? "across line" : "on the same side of line";
    question = `Why is $${C}'$ ${opposite ? `across line $${D}${E}$ from $${F}$` : `on the same side of line $${D}${E}$ as $${F}$`}?`;
    options = [
      {
        label: `Translations and rotations keep orientation, and the two triangles run ${opposite ? "opposite ways" : "the same way"} round.`,
        correct: true,
      },
      {
        label: `Distance is preserved, so $${C}'$ is exactly as far from line $${D}${E}$ as $${C}$ was from line $${A}${B}$.`,
        feedback: `True, but a point that far from the line could be on either side. Orientation decides the side.`,
      },
      {
        label:
          "A rotation reverses orientation while a translation keeps it, so the rotation decided the side.",
        feedback: "Rotations keep orientation; only a reflection reverses it.",
      },
      {
        label: `The triangles are congruent, so $${C}'$ has to be ${sideWord} $${D}${E}$ ${opposite ? "from" : "as"} $${F}$.`,
        feedback: "That assumes the congruence the proof is trying to show.",
      },
    ];
    why = `Translations and rotations keep orientation, so $${D}\\to ${E}\\to ${C}'$ runs the way $${A}\\to ${B}\\to ${C}$ does. The two triangles run ${opposite ? "opposite ways" : "the same way"} round, so $${C}'$ is ${opposite ? `across line $${D}${E}$ from $${F}$` : `on $${F}$'s side of line $${D}${E}$`}.`;
  } else if (step === "ray") {
    question = `Why must $${Cs}$ be on ray $${D}${F}$?`;
    options = [
      {
        label: `Angles are kept and $\\angle ${A}\\cong\\angle ${D}$; on $${F}$'s side one ray from $${D}$ makes that angle with $\\overline{${D}${E}}$.`,
        correct: true,
      },
      {
        label: `Rigid motions preserve angle measure, so $m\\angle ${E}${D}${Cs}=m\\angle ${A}$ after all of the motions.`,
        feedback: `True, but it never connects the ray to $${F}$: it needs $\\angle ${A}\\cong\\angle ${D}$ and the fact that only one ray on that side makes the angle.`,
      },
      {
        label: `Distance is preserved, so $${D}${Cs}=${A}${C}$, and that length points the ray from $${D}$ toward $${F}$.`,
        feedback: `A length from $${D}$ allows a whole circle of points; it does not choose a direction.`,
      },
      {
        label: `The triangles are congruent, so ray $${D}${Cs}$ has to lie along its match, which is ray $${D}${F}$.`,
        feedback: "That assumes the congruence the proof is trying to show.",
      },
    ];
    why = `Angle measure is preserved, so $m\\angle ${E}${D}${Cs}=m\\angle ${A}$, and $\\angle ${A}\\cong\\angle ${D}$ is given. On $${F}$'s side of line $${D}${E}$ exactly one ray from $${D}$ makes that angle with $\\overline{${D}${E}}$: ray $${D}${F}$.`;
  } else if (path === "sas") {
    question = `$${Cs}$ is on ray $${D}${F}$. Why must $${Cs}$ be $${F}$?`;
    options = [
      {
        label: `$${D}${Cs}=${A}${C}=${D}${F}$ by preserved distance; just one point of ray $${D}${F}$ is that far from $${D}$.`,
        correct: true,
      },
      {
        label: `Rigid motions preserve distance, so $${D}${Cs}=${A}${C}$, the length of the side it came from.`,
        feedback: `True, but it never connects $${Cs}$ to $${F}$: it needs $${A}${C}=${D}${F}$ and the one point of the ray at that distance.`,
      },
      {
        label: `Angle measure is preserved, so $m\\angle ${D}${Cs}${E}=m\\angle ${C}$, and that angle fixes where $${Cs}$ is.`,
        feedback: `$\\angle ${C}\\cong\\angle ${F}$ is not given in SAS, and an angle at the moving point does not fix where it sits on the ray.`,
      },
      {
        label: `$${Cs}$ is on ray $${D}${F}$, and $${F}$ is the vertex of $\\triangle ${D}${E}${F}$ that lies on that ray.`,
        feedback: `Every point of the ray is on it. A length is needed to pick out $${F}$.`,
      },
    ];
    why = `Distance is preserved, so $${D}${Cs}=${A}${C}$, and $${A}${C}=${D}${F}$ is given. Ray $${D}${F}$ has exactly one point at distance $${D}${F}$ from $${D}$: the point $${F}$.`;
  } else if (path === "asa") {
    question = `$${Cs}$ is on ray $${D}${F}$ and on ray $${E}${F}$. Why must $${Cs}$ be $${F}$?`;
    options = [
      {
        label: `Lines $${D}${F}$ and $${E}${F}$ are different, so they share at most one point, and $${F}$ is on both.`,
        correct: true,
      },
      {
        label: `Two rays from different points always meet, so these two rays meet, and they meet at $${F}$.`,
        feedback:
          "Two rays need not meet at all, and meeting says nothing about meeting only once. The point is that two different lines share at most one point.",
      },
      {
        label: `Distance is preserved, so $${D}${Cs}=${A}${C}=${D}${F}$, and that distance along ray $${D}${F}$ ends at $${F}$.`,
        feedback: `$${A}${C}=${D}${F}$ is not given in ASA; the proof may use only $${A}${B}=${D}${E}$ and the two angles.`,
      },
      {
        label: `$${Cs}$ is on ray $${D}${F}$, and $${F}$ is the vertex of $\\triangle ${D}${E}${F}$ that lies on that ray.`,
        feedback: `Every point of the ray is on it. The second ray is what picks out $${F}$.`,
      },
    ];
    why = `$${D}$, $${E}$ and $${F}$ are not on one line, so lines $${D}${F}$ and $${E}${F}$ are different and share only the point $${F}$. $${Cs}$ is on both, so $${Cs}=${F}$.`;
  } else {
    question = `$${D}${Cs}=${D}${F}$, $${E}${Cs}=${E}${F}$, and $${Cs}$ is on $${F}$'s side of line $${D}${E}$. Why must $${Cs}$ be $${F}$?`;
    options = [
      {
        label: `Circles about $${D}$ and $${E}$ meet at most twice, in mirror images across $${D}${E}$: one per side.`,
        correct: true,
      },
      {
        label: `The circles about $${D}$ and $${E}$ meet in exactly one point, so $${Cs}$ is that point, which is $${F}$.`,
        feedback: `Two circles can meet in two points. What rules out the second one is that it lies on the other side of line $${D}${E}$.`,
      },
      {
        label: `Rigid motions preserve distance, so $${D}${Cs}=${A}${C}$ and $${E}${Cs}=${B}${C}$ after all of the motions.`,
        feedback:
          "True, but it never says why only one point fits both distances.",
      },
      {
        label: `The triangles are congruent, so $${Cs}$ has to land on its match, which is the point $${F}$.`,
        feedback: "That assumes the congruence the proof is trying to show.",
      },
    ];
    why = `$${Cs}$ and $${F}$ both lie on the circle about $${D}$ of radius $${D}${F}$ and the circle about $${E}$ of radius $${E}${F}$. Those circles meet in at most two points, mirror images across line $${D}${E}$, so each side of the line holds at most one: $${Cs}=${F}$.`;
  }
  const correct = options.find((o) => o.correct)!;
  const wrong = shuffle(
    r,
    options.filter((o) => !o.correct),
  ).slice(0, 3);
  const s = choiceSurface(r, {
    prompt: `${setupText(c)}${where} ${question}`,
    options: [correct, ...wrong],
    hint: `Say what this step claims about $\\triangle ${L.A}${L.B}${L.C}$ and $\\triangle ${L.D}${L.E}${L.F}$. Which facts leave exactly one possibility for it: what rigid motions keep (lengths, angles, orientation), a given, or a fact about lines and circles?`,
    explanation: [
      "Each step needs a reason that leaves exactly one possibility: a property of rigid motions with the given it needs, or a fact about lines, circles or orientation.",
      why,
      "A reason that states only the preserved quantity is incomplete; one that uses a pair that is not given, or the congruence being proved, is not a reason at all.",
    ],
  });
  return s && { ...s, figure: criterionFigure(c) };
}

function stepName(c: ReasonCase): string {
  const { L } = c;
  const Cs = imageC(L, c.pair.opposite);
  switch (c.step) {
    case "tr":
      return `the line that translates $${L.A}$ to $${L.D}$ and rotates about $${L.D}$ until $${L.B}'$ is on ray $${L.D}${L.E}$`;
    case "be":
      return `the line that shows $${L.B}'=${L.E}$`;
    case "or":
      return c.pair.opposite
        ? `the line that reflects over line $${L.D}${L.E}$ because $${L.C}'$ is across it from $${L.F}$`
        : `the line that shows $${L.C}'$ is on $${L.F}$'s side of line $${L.D}${L.E}$`;
    case "ray":
      return `the line that puts $${Cs}$ on ray $${L.D}${L.F}$`;
    case "ray-e":
      return `the line that puts $${Cs}$ on ray $${L.E}${L.F}$`;
    case "circ-d":
      return `the line that shows $${L.D}${Cs}=${L.D}${L.F}$`;
    case "circ-e":
      return `the line that shows $${L.E}${Cs}=${L.E}${L.F}$`;
    default:
      return `the line that shows $${Cs}=${L.F}$`;
  }
}
function stepGiven(c: ReasonCase): GivenKey | null {
  switch (c.step) {
    case "be":
      return "AB";
    case "ray":
      return "A";
    case "ray-e":
      return "B";
    case "circ-d":
      return "CA";
    case "circ-e":
      return "BC";
    case "pin":
      return c.path === "sas" ? "CA" : null;
    default:
      return null;
  }
}
const givenUse: Record<GivenKey, (L: Letters) => string> = {
  AB: (L) =>
    `$${L.A}${L.B}=${L.D}${L.E}$ is what puts $${L.B}'$ at $${L.E}$ rather than elsewhere on the ray.`,
  BC: (L) =>
    `$${L.B}${L.C}=${L.E}${L.F}$ puts the image of $${L.C}$ on the circle about $${L.E}$ of radius $${L.E}${L.F}$.`,
  CA: (L) =>
    `$${L.A}${L.C}=${L.D}${L.F}$ fixes how far the image of $${L.C}$ is from $${L.D}$.`,
  A: (L) =>
    `$\\angle ${L.A}\\cong\\angle ${L.D}$ turns the ray from $${L.D}$ toward the image of $${L.C}$ onto ray $${L.D}${L.F}$.`,
  B: (L) =>
    `$\\angle ${L.B}\\cong\\angle ${L.E}$ turns the ray from $${L.E}$ toward the image of $${L.C}$ onto ray $${L.E}${L.F}$.`,
  C: (L) => `$\\angle ${L.C}\\cong\\angle ${L.F}$ is not used by these proofs.`,
};
const noGiven = (c: ReasonCase): string => {
  const { L } = c;
  switch (c.step) {
    case "tr":
      return `A translation can carry $${L.A}$ to $${L.D}$ and a rotation about $${L.D}$ can turn any ray from $${L.D}$ onto ray $${L.D}${L.E}$, whatever the triangles are.`;
    case "or":
      return "The side comes from orientation: translations and rotations keep it, a reflection reverses it. None of the three given pairs is needed.";
    case "pin":
      return c.path === "asa"
        ? `Once the image of $${L.C}$ is on both rays, two different lines meeting at most once finishes it; the givens were used on the line before.`
        : `Once the two distances are known, two circles meeting at most twice, one point on each side of line $${L.D}${L.E}$, finishes it; the givens were used on the line before.`;
    default:
      return "";
  }
};

function givenSurface(c: ReasonCase, r: Random): Surface | null {
  const { L, path } = c;
  const keys = criterionGivens[path];
  const answer = stepGiven(c);
  const none = "No given pair.";
  const options: ChoiceOption[] = [
    ...keys.map((k): ChoiceOption =>
      k === answer
        ? { label: m(givenTex[k](L)), correct: true }
        : {
            label: m(givenTex[k](L)),
            feedback: `That pair is used on a different line: ${givenUse[k](L)}`,
          },
    ),
    answer === null
      ? { label: none, correct: true }
      : {
          label: none,
          feedback: `This line needs a given: ${givenUse[answer](L)}`,
        },
  ];
  // The finish names the image after the reflection, so say there is one.
  const where = c.pair.opposite
    ? ` After a reflection over line $${L.D}${L.E}$, the image of $${L.C}$ is $${L.C}''$.`
    : "";
  const s = choiceSurface(r, {
    prompt: `${setupText(c)}${where} Which given does ${stepName(c)} use?`,
    options,
    hint: `Read ${stepName(c)}. What does it claim, and what does that claim rest on: properties of rigid motions, a fact about lines or circles, one of the given pairs, or several of these?`,
    explanation: [
      "A given is used where something must land: a length fixes a distance, and an angle fixes a ray on one side of a line. A line that only moves the triangle, or only combines earlier lines, uses no given pair.",
      answer ? givenUse[answer](L) : noGiven(c),
      `In ${criterionName[path]}, $${givenTex.AB(L)}$ lands $${L.B}'$ on $${L.E}$, and ${listText(keys.filter((k) => k !== "AB").map((k) => m(givenTex[k](L))))} pin the image of $${L.C}$.`,
    ],
  });
  return s && { ...s, figure: criterionFigure(c) };
}

function reflectSurface(c: ReasonCase, r: Random): Surface | null {
  const { L, pair } = c;
  const opposite = pair.opposite;
  const ccw1 = pair.abcCounterclockwise;
  const ccw2 = opposite ? !ccw1 : ccw1;
  const s = choiceSurface(r, {
    prompt: `${setupText(c)} Use the figure. After the translation and the rotation, $${L.B}'=${L.E}$. Where is $${L.C}'$?`,
    options: [
      {
        label: `On $${L.F}$'s side of line $${L.D}${L.E}$, so no reflection over line $${L.D}${L.E}$ is needed.`,
        ...(opposite
          ? {
              feedback: `The triangles run opposite ways round, and translations and rotations keep orientation, so $${L.C}'$ ends up across line $${L.D}${L.E}$ from $${L.F}$.`,
            }
          : { correct: true as const }),
      },
      {
        label: `Across line $${L.D}${L.E}$ from $${L.F}$, so a reflection over line $${L.D}${L.E}$ is needed.`,
        ...(opposite
          ? { correct: true as const }
          : {
              feedback: `The triangles run the same way round, and translations and rotations keep orientation, so $${L.C}'$ is already on $${L.F}$'s side.`,
            }),
      },
      {
        label: `On line $${L.D}${L.E}$ itself, neither on one side nor the other.`,
        feedback: `Then $${L.D}$, $${L.E}$ and $${L.C}'$ would be on one line, and $\\triangle ${L.A}${L.B}${L.C}$ would be flat.`,
      },
      {
        label:
          "It cannot be known until the figure is measured with a ruler and protractor.",
        feedback:
          "The order of the letters round each triangle decides it, before any measuring.",
      },
    ],
    hint: `Go round each triangle in letter order: does $${L.A}\\to ${L.B}\\to ${L.C}$ turn the same way as $${L.D}\\to ${L.E}\\to ${L.F}$? Which of the two motions so far could change that?`,
    explanation: [
      `In the figure, $${L.A}\\to ${L.B}\\to ${L.C}$ runs ${ccw1 ? "counterclockwise" : "clockwise"} and $${L.D}\\to ${L.E}\\to ${L.F}$ runs ${ccw2 ? "counterclockwise" : "clockwise"}.`,
      `Translations and rotations keep orientation, so $${L.D}\\to ${L.E}\\to ${L.C}'$ still runs ${ccw1 ? "counterclockwise" : "clockwise"}. ${opposite ? `That is the opposite way to $${L.D}\\to ${L.E}\\to ${L.F}$, so $${L.C}'$ is across line $${L.D}${L.E}$ from $${L.F}$, and a reflection over line $${L.D}${L.E}$ is needed. It keeps $${L.D}$ and $${L.E}$ in place.` : `That is the way $${L.D}\\to ${L.E}\\to ${L.F}$ runs, so $${L.C}'$ is on $${L.F}$'s side and no reflection is needed.`}`,
      `$${L.C}'$ cannot be on line $${L.D}${L.E}$, because the triangle is not flat, and no measuring is needed: the order of the letters decides.`,
    ],
  });
  return s && { ...s, figure: criterionFigure(c) };
}

function whichSurface(c: ReasonCase, r: Random): Surface | null {
  const { L, pair, path, gap } = c;
  const { A, B, C, D, E, F } = L;
  const Cs = imageC(L, pair.opposite);
  const common = `A proof translates $${A}$ to $${D}$ and rotates about $${D}$ until $${B}'$ is on ray $${D}${E}$; since $${A}${B}=${D}${E}$, $${B}'=${E}$. ${pair.opposite ? `Then it reflects over line $${D}${E}$, so $${C}''$, the image of $${C}$, is on $${F}$'s side.` : `$${C}'$, the image of $${C}$, is on $${F}$'s side of line $${D}${E}$.`}`;
  const finish = gap
    ? path === "sas"
      ? `Since $\\angle ${A}\\cong\\angle ${D}$, $${Cs}$ is on ray $${D}${F}$. So $${Cs}=${F}$.`
      : path === "asa"
        ? `Since $\\angle ${B}\\cong\\angle ${E}$, $${Cs}$ is on ray $${E}${F}$. So $${Cs}=${F}$.`
        : `Since $${A}${C}=${D}${F}$, $${Cs}$ is $${D}${F}$ from $${D}$. So $${Cs}=${F}$.`
    : path === "sas"
      ? `Since $\\angle ${A}\\cong\\angle ${D}$, $${Cs}$ is on ray $${D}${F}$. Since $${A}${C}=${D}${F}$, it is the point of that ray at distance $${D}${F}$ from $${D}$, so $${Cs}=${F}$.`
      : path === "asa"
        ? `Since $\\angle ${A}\\cong\\angle ${D}$ and $\\angle ${B}\\cong\\angle ${E}$, $${Cs}$ is on rays $${D}${F}$ and $${E}${F}$. Those rays meet only at $${F}$, so $${Cs}=${F}$.`
        : `Since $${A}${C}=${D}${F}$ and $${B}${C}=${E}${F}$, $${Cs}$ is $${D}${F}$ from $${D}$ and $${E}${F}$ from $${E}$. On $${F}$'s side only $${F}$ is, so $${Cs}=${F}$.`;
  const crit = (p: Path): ChoiceOption =>
    !gap && p === path
      ? { label: criterionName[p], correct: true }
      : {
          label: criterionName[p],
          feedback: gap
            ? "The finish skips a step: one fact puts the image on a ray or at a distance, but nothing pins it to a single point."
            : `${criterionName[p]} would use ${listText(criterionGivens[p].map((k) => m(givenTex[k](L))))}; this finish uses ${listText(criterionGivens[path].map((k) => m(givenTex[k](L))))}.`,
        };
  const noneOption: ChoiceOption = gap
    ? { label: "None: the finish has a gap.", correct: true }
    : {
        label: "None: the finish has a gap.",
        feedback: "Each landing is pinned: the finish is complete.",
      };
  const s = choiceSurface(r, {
    prompt: `${common} It finishes: ${finish} Which criterion does this proof prove?`,
    options: [crit("sas"), crit("asa"), crit("sss"), noneOption],
    hint: `List the givens the proof uses, starting with $${A}${B}=${D}${E}$. Then check the last landing: is $${Cs}$ pinned to exactly one point, or only to a ray or a circle?`,
    explanation: [
      `Every criterion proof uses $${A}${B}=${D}${E}$ to land $${B}'$ on $${E}$; the finish uses the other two givens to pin the image of $${C}$ to one point.`,
      gap
        ? path === "sas" || path === "asa"
          ? `This finish puts $${Cs}$ on one ray and stops. A ray has infinitely many points, so it needs a length (SAS) or a second ray (ASA): it has a gap.`
          : `This finish puts $${Cs}$ at distance $${D}${F}$ from $${D}$ and stops. That is a whole circle of points; it needs the second distance (SSS): it has a gap.`
        : `It uses ${listText(criterionGivens[path].map((k) => m(givenTex[k](L))))} and pins $${Cs}$ to one point, so it proves ${criterionName[path]}.`,
      "SAS pins with an angle and a length from one vertex, ASA with an angle at each end of the given side, SSS with a length from each end and the side of line it is on.",
    ],
  });
  return s && { ...s, figure: criterionFigure(c, false) };
}

const reasonFamily = chainFamily({
  template: reasonTemplate,
  axes: {
    criterion: defineAxis("criterion", ["sas", "asa", "sss"] as const),
    orientation: defineAxis("orientation", ["same", "opposite"] as const),
    question: defineAxis("question", [
      "justify",
      "given",
      "reflect",
      "which",
    ] as const),
  },
  model: (r, axes) =>
    reasonCase(
      r,
      axes.criterion,
      axes.orientation === "opposite",
      axes.question,
    ),
  render: (c, _axes, r) =>
    c.question === "justify"
      ? justifySurface(c, r)
      : c.question === "given"
        ? givenSurface(c, r)
        : c.question === "reflect"
          ? reflectSurface(c, r)
          : whichSurface(c, r),
  variant: (c) =>
    c.question === "which"
      ? `which-${c.path}${c.gap ? "-gap" : ""}`
      : c.question === "reflect"
        ? `reflect-${c.pair.opposite ? "yes" : "no"}`
        : `${c.question}-${c.path}-${c.step}`,
});

/* ================================================ flaws (2.3) */

type Planted =
  | "segment"
  | "any-point"
  | "phantom"
  | "circular"
  | "move-line"
  | "assume-side";
interface FlawCase {
  kind: "planted" | "ssa" | "aaa";
  L: Letters;
  at: Record<Role, Point>;
  opposite: boolean;
  abcCounterclockwise: boolean;
  path: Path;
  planted: Planted;
  /** Dashed comparison drawing: the image of C (SSA) or of the triangle
   * (AAA) after the motions. */
  extra: Element[];
}

/** Every (AB, angle A, BC) with integer sides 9–14 and BC < AB, angle A
 * 30° to 50°, where the circle about B of radius BC meets the ray from A
 * twice (for an acute A, exactly when AB·sin A < BC < AB), the two meets
 * are clearly apart, and both triangles keep every angle in [30°, 110°]. */
const SSA_TRIPLES: {
  c: number;
  angleA: number;
  a: number;
  near: number;
  far: number;
}[] = [];
for (let c = 9; c <= 14; c++)
  for (let angleA = 30; angleA <= 50; angleA++) {
    const h = c * Math.sin((angleA * Math.PI) / 180);
    for (let a = Math.ceil(h); a < c; a++) {
      if (!(a > h + 0.3)) continue;
      const root = Math.sqrt(a * a - h * h);
      const near = c * Math.cos((angleA * Math.PI) / 180) - root;
      const far = near + 2 * root;
      if (near < 3 || far - near < 2.5) continue;
      const open = (b: number) =>
        Object.values(anglesOf(a, b, c)).every((x) => x >= 30 && x <= 110);
      if (open(near) && open(far))
        SSA_TRIPLES.push({ c, angleA, a, near, far });
    }
  }
if (SSA_TRIPLES.length < 8) throw new Error("Too few SSA triangles");

/** Two triangles that share AB, BC and the angle at A but not AC. */
function ssaPair(r: Random, opposite: boolean) {
  for (;;) {
    const { c, angleA, a, near, far } = pick(r, SSA_TRIPLES);
    const abcFar = r(0, 1) === 1;
    const [bAbc, bDef] = abcFar ? [far, near] : [near, far];
    const k = 5 / Math.max(c, far, a);
    const T = (b: number): Point[] => [
      [0, 0],
      [c, 0],
      [
        b * Math.cos((angleA * Math.PI) / 180),
        b * Math.sin((angleA * Math.PI) / 180),
      ],
    ];
    const mirror = r(0, 1) === 1;
    const first = 15 * r(0, 23);
    let delta: number;
    do delta = 15 * r(2, 22);
    while (delta === 180);
    const pose = (t: Point[], flip: boolean, deg: number) =>
      t.map((p) => rotateVec([p[0] * k, (flip ? -p[1] : p[1]) * k], deg));
    const at = place(
      pose(T(bAbc), mirror, first),
      pose(T(bDef), mirror !== opposite, first + delta),
    );
    return { at, sides: { a, c, bAbc, bDef }, angleA };
  }
}

function flawCase(
  r: Random,
  kind: FlawCase["kind"],
  path: Path,
  opposite: boolean,
): FlawCase {
  const L = drawLetters(r);
  if (kind === "planted") {
    const pair = congruentPair(r, opposite);
    const planted = pick(r, [
      "segment",
      "any-point",
      "phantom",
      "circular",
      opposite ? "move-line" : "assume-side",
    ] as Planted[]);
    return {
      kind,
      L,
      at: pair.at,
      opposite,
      abcCounterclockwise: pair.abcCounterclockwise,
      path,
      planted,
      extra: [],
    };
  }
  if (kind === "ssa") {
    const { at } = ssaPair(r, opposite);
    // The image of C after the motions: on ray DF at distance AC from D.
    const u = sub(at.F, at.D);
    const len = Math.hypot(u[0], u[1]);
    const P = add(at.D, [
      (u[0] / len) * dist(at.A, at.C),
      (u[1] / len) * dist(at.A, at.C),
    ]);
    const extra: Element[] = [
      figureSegment("xEP", at.E, P, { dash: true }),
      figureSegment("xDP", at.D, P, { dash: true }),
      ...figureTicks("xt", at.E, P, 2),
    ];
    return {
      kind,
      L,
      at,
      opposite,
      abcCounterclockwise: turn(at.A, at.B, at.C) > 0,
      path,
      planted: "segment",
      extra,
    };
  }
  // AAA: △ABC is a scaled copy of △DEF.
  const sides = drawSides(r);
  const s = pick(r, [0.6, 0.65, 0.7, 1.4, 1.5]);
  const t: Point[] = [
    [0, 0],
    [sides.c, 0],
    (() => {
      const cosA =
        (sides.b ** 2 + sides.c ** 2 - sides.a ** 2) / (2 * sides.b * sides.c);
      return [sides.b * cosA, sides.b * Math.sqrt(1 - cosA * cosA)] as Point;
    })(),
  ];
  const k = 5 / (Math.max(sides.a, sides.b, sides.c) * Math.max(1, s));
  const mirror = r(0, 1) === 1;
  const first = 15 * r(0, 23);
  let delta: number;
  do delta = 15 * r(2, 22);
  while (delta === 180);
  const pose = (scale: number, flip: boolean, deg: number) =>
    t.map((p) =>
      rotateVec([p[0] * k * scale, (flip ? -p[1] : p[1]) * k * scale], deg),
    );
  const at = place(
    pose(s, mirror, first),
    pose(1, mirror !== opposite, first + delta),
  );
  // After the motions, △ABC sits at D as the copy of △DEF scaled by s.
  const B2 = add(at.D, [(at.E[0] - at.D[0]) * s, (at.E[1] - at.D[1]) * s]);
  const C2 = add(at.D, [(at.F[0] - at.D[0]) * s, (at.F[1] - at.D[1]) * s]);
  const extra: Element[] = [
    figureSegment("xDB", at.D, B2, { dash: true }),
    figureSegment("xBC", B2, C2, { dash: true }),
    figureSegment("xCD", C2, at.D, { dash: true }),
  ];
  return {
    kind,
    L,
    at,
    opposite,
    abcCounterclockwise: turn(at.A, at.B, at.C) > 0,
    path,
    planted: "segment",
    extra,
  };
}

interface Line {
  tex: string;
  reason: string;
}
function plantedArgument(c: FlawCase): {
  lines: Line[];
  at: number;
  real: string;
  misdiagnosis: string;
} {
  const { L, path, opposite, planted } = c;
  const { A, B, C, D, E, F } = L;
  const Cs = imageC(L, opposite);
  const script = proofScript(L, path, opposite);
  const lines: Line[] = script.map((s) => ({
    tex: s.tex,
    reason: reasonText(L, s.reason, path),
  }));
  const angleWord = path === "asa" ? "distance" : "angle";
  switch (planted) {
    case "segment":
      lines[0] = {
        tex: `Translate $\\triangle ${A}${B}${C}$ so that $\\overline{${A}${B}}$ lands on $\\overline{${D}${E}}$; call the image $\\triangle ${D}${B}'${C}'$.`,
        reason:
          "A translation can carry any segment onto any other segment of the same length.",
      };
      return {
        lines,
        at: 1,
        real: `Line 1 is wrong: a translation cannot turn $\\overline{${A}${B}}$; it can land $${A}$ on $${D}$, not the whole segment.`,
        misdiagnosis:
          "Line 1 is wrong: a translation does not preserve length, so the image is a different size.",
      };
    case "any-point":
      lines[1] = {
        tex: `$${B}'=${E}$.`,
        reason: `A rotation about $${D}$ can carry any point onto any other point.`,
      };
      return {
        lines,
        at: 2,
        real: `Line 2 is wrong: a rotation about $${D}$ keeps distances from $${D}$; only $${A}${B}=${D}${E}$ can put $${B}'$ at $${E}$.`,
        misdiagnosis: `Line 2 is wrong: $${B}'$ only reaches ray $${D}${E}$ after a reflection over line $${D}${E}$.`,
      };
    case "phantom":
      lines[4] =
        path === "sas"
          ? {
              tex: `$m\\angle ${D}${E}${Cs}=m\\angle ${B}=m\\angle ${E}$, so $${Cs}$ is also on ray $${E}${F}$, and $${Cs}=${F}$.`,
              reason:
                "Rigid motions preserve angle measure, and two different lines meet in at most one point.",
            }
          : path === "asa"
            ? {
                tex: `$${D}${Cs}=${A}${C}=${D}${F}$, so $${Cs}=${F}$.`,
                reason: reasonText(L, "dist", path),
              }
            : {
                tex: `$m\\angle ${E}${D}${Cs}=m\\angle ${A}=m\\angle ${D}$, so $${Cs}$ is on ray $${D}${F}$, and $${D}${Cs}=${D}${F}$ makes $${Cs}=${F}$.`,
                reason:
                  "Rigid motions preserve angle measure and distance, and a ray has exactly one point at a given distance from its endpoint.",
              };
      return {
        lines,
        at: 5,
        real:
          path === "sas"
            ? `Line 5 is wrong: it uses $\\angle ${B}\\cong\\angle ${E}$, which is not given.`
            : path === "asa"
              ? `Line 5 is wrong: it uses $\\overline{${A}${C}}\\cong\\overline{${D}${F}}$, which is not given.`
              : `Line 5 is wrong: it uses $\\angle ${A}\\cong\\angle ${D}$, which is not given.`,
        misdiagnosis: `Line 5 is wrong: rigid motions do not preserve ${angleWord}${angleWord === "angle" ? " measure" : ""}, so that equation fails.`,
      };
    case "circular":
      lines[4] = {
        tex: `$${Cs}=${F}$.`,
        reason: reasonText(L, "cpctc", path),
      };
      return {
        lines,
        at: 5,
        real: `Line 5 is wrong: CPCTC assumes $\\triangle ${A}${B}${C}\\cong\\triangle ${D}${E}${F}$, the very thing being proved.`,
        misdiagnosis:
          "Line 5 is wrong: it has to come before line 4, because line 4 uses it.",
      };
    case "move-line":
      lines[2] = {
        tex: `$${C}'$ is across line $${D}${E}$ from $${F}$; reflect over line $${D}${E}$, which swaps $${D}$ and $${E}$, so $${C}''$ is on $${F}$'s side.`,
        reason: "A reflection swaps the two ends of any segment on its line.",
      };
      return {
        lines,
        at: 3,
        real: `Line 3 is wrong: a reflection over line $${D}${E}$ keeps $${D}$ and $${E}$ in place; it does not swap them.`,
        misdiagnosis:
          "Line 3 is wrong: the triangles have the same orientation, so no reflection is needed.",
      };
    case "assume-side":
      lines[2] = {
        tex: `$${C}'$ and $${F}$ are on the same side of line $${D}${E}$.`,
        reason: "The triangles are congruent, so no reflection is needed.",
      };
      return {
        lines,
        at: 3,
        real: "Line 3 is wrong: its reason assumes the congruence that the proof is meant to show.",
        misdiagnosis: `Line 3 is wrong: a reflection over line $${D}${E}$ is still needed before the angle step.`,
      };
  }
}

/** False accusations of a correct line, by line key. */
function accusation(
  L: Letters,
  key: RowKey,
  path: Path,
  opposite: boolean,
  n: number,
): string {
  const { D, E } = L;
  switch (key) {
    case "tr":
      return `Line ${n} is wrong: a rotation about $${D}$ moves $${D}$ too, so the image of $${L.A}$ leaves $${D}$.`;
    case "be":
      return `Line ${n} is wrong: rotations do not preserve distance, so $${D}${L.B}'$ need not equal $${L.A}${L.B}$.`;
    case "or":
      return opposite
        ? `Line ${n} is wrong: a reflection over line $${D}${E}$ moves $${D}$ and $${L.B}'$ off the line.`
        : `Line ${n} is wrong: which side of line $${D}${E}$ holds $${L.C}'$ cannot be known without measuring.`;
    case "ray":
    case "rays":
      return `Line ${n} is wrong: on one side of line $${D}${E}$, two rays from $${D}$ can make the same angle with $\\overline{${D}${E}}$.`;
    case "circ":
      return `Line ${n} is wrong: rigid motions preserve angles but not distances, so these lengths can change.`;
    case "pin":
      return path === "sas"
        ? `Line ${n} is wrong: a ray can hold two different points at the same distance from its endpoint.`
        : path === "asa"
          ? `Line ${n} is wrong: two different lines can cross in two points, so $${imageC(L, opposite)}$ need not be $${L.F}$.`
          : `Line ${n} is wrong: two circles can meet in three or more points, so $${imageC(L, opposite)}$ need not be $${L.F}$.`;
    case "conc":
      return `Line ${n} is wrong: it should cite the criterion, not the definition of congruence.`;
  }
}

const lineBoard = (lines: Line[]) =>
  lines
    .map((l, i) => `Line ${i + 1}: ${l.tex} (${l.reason.replace(/\.$/, "")}.)`)
    .join(" ");

function plantedSurface(c: FlawCase, r: Random): Surface | null {
  const { L, path, opposite } = c;
  const script = proofScript(L, path, opposite);
  const arg = plantedArgument(c);
  const others = shuffle(
    r,
    script
      .map((s, i) => ({ key: s.key, n: i + 1 }))
      .filter((x) => x.n !== arg.at),
  ).slice(0, 2);
  const options: ChoiceOption[] = [
    { label: arg.real, correct: true },
    {
      label: arg.misdiagnosis,
      feedback: `Line ${arg.at} is the wrong line, but not for that reason.`,
    },
    ...others.map((x) => ({
      label: accusation(L, x.key, path, opposite, x.n),
      feedback: `Line ${x.n} is correct: ${lineExplanation(L, x.key, path, opposite)}`,
    })),
  ];
  const t = tri(L);
  const s = choiceSurface(r, {
    prompt: `Use the figure. Given: ${givensText(L, criterionGivens[path])}; ${orientationText(L, c)}. A student proves ${criterionName[path]} by rigid motions, showing that a sequence of rigid motions maps $${t.abc}$ onto $${t.def}$ with ${correspondence(L)}. ${lineBoard(arg.lines)} Exactly one line is wrong. Which line, and why?`,
    options,
    hint: `Check each line against what it may use: the givens ${givensText(L, criterionGivens[path])}, properties of rigid motions, and lines above it. Which line lands something without a fact that pins it, or uses something that is not available?`,
    explanation: [
      `A correct proof of ${criterionName[path]} translates $${L.A}$ to $${L.D}$, rotates about $${L.D}$, lands $${L.B}'$ on $${L.E}$ with $${L.A}${L.B}=${L.D}${L.E}$, reflects over line $${L.D}${L.E}$ only when the orientations differ, and pins the image of $${L.C}$ with the other two givens.`,
      arg.real,
      `The correct line ${arg.at}: ${script[arg.at - 1]!.tex} ${reasonText(L, script[arg.at - 1]!.reason, path)}`,
      // The three wrong choices on screen, each with what is wrong with it.
      ...options.slice(1).map((o) => `“${o.label}” ${o.feedback}`),
    ],
  });
  return (
    s && {
      ...s,
      figure: pairFigure(
        `Triangles ${L.A}${L.B}${L.C} and ${L.D}${L.E}${L.F}; ${marksText(L, criterionMarks(path))}.`,
        c.at,
        L,
        criterionMarks(path),
      ),
    }
  );
}

function breakdownSurface(c: FlawCase, r: Random): Surface | null {
  const { L, opposite, kind } = c;
  const { A, B, C, D, E, F } = L;
  const Cs = imageC(L, opposite);
  const ssa = kind === "ssa";
  const givens: GivenKey[] = ssa ? ["AB", "BC", "A"] : ["A", "B", "C"];
  const orLine = proofScript(L, "asa", opposite)[2]!;
  const tr = proofScript(L, "asa", opposite)[0]!;
  const lines: Line[] = ssa
    ? [
        { tex: tr.tex, reason: reasonText(L, "tr", "asa") },
        {
          tex: proofScript(L, "asa", opposite)[1]!.tex,
          reason: reasonText(L, "dist", "asa"),
        },
        { tex: orLine.tex, reason: reasonText(L, orLine.reason, "asa") },
        {
          tex: `$m\\angle ${E}${D}${Cs}=m\\angle ${A}=m\\angle ${D}$, so $${Cs}$ is on ray $${D}${F}$.`,
          reason: reasonText(L, "ang", "asa"),
        },
        {
          tex: `$${E}${Cs}=${B}${C}=${E}${F}$, so $${Cs}=${F}$.`,
          reason: reasonText(L, "dist", "asa"),
        },
        {
          tex: proofScript(L, "asa", opposite)[5]!.tex,
          reason: reasonText(L, "def", "asa"),
        },
      ]
    : [
        { tex: tr.tex, reason: reasonText(L, "tr", "asa") },
        {
          tex: `$${B}'$ is on ray $${D}${E}$, so $${B}'=${E}$.`,
          reason: "Rigid motions preserve angle measure.",
        },
        { tex: orLine.tex, reason: reasonText(L, orLine.reason, "asa") },
        {
          tex: proofScript(L, "asa", opposite)[3]!.tex,
          reason: reasonText(L, "ang", "asa"),
        },
        {
          tex: proofScript(L, "asa", opposite)[4]!.tex,
          reason: reasonText(L, "lines", "asa"),
        },
        {
          tex: proofScript(L, "asa", opposite)[5]!.tex,
          reason: reasonText(L, "def", "asa"),
        },
      ];
  const correct = ssa
    ? `Line 5: $${Cs}$ is on ray $${D}${F}$ and on the circle about $${E}$ of radius $${E}${F}$, which can meet the ray twice.`
    : `Line 2: no given length says how far along ray $${D}${E}$ the point $${B}'$ is, so it need not be $${E}$.`;
  const wrong: ChoiceOption[] = shuffle(r, [
    {
      label: `Line 1: the translation should carry $\\overline{${A}${B}}$ onto $\\overline{${D}${E}}$ instead of only $${A}$ onto $${D}$.`,
      feedback: `Translations cannot turn a segment; landing $${A}$ on $${D}$ and then rotating is correct.`,
    },
    ssa
      ? {
          label: `Line 4: on $${F}$'s side, more than one ray from $${D}$ makes the angle $m\\angle ${D}$ with $\\overline{${D}${E}}$.`,
          feedback:
            "Only one ray on a given side makes a given angle; line 4 is correct.",
        }
      : {
          label: "Line 5: two different lines can meet in more than one point.",
          feedback:
            "Two different lines share at most one point; line 5 would be correct if line 2 were.",
        },
    ssa
      ? {
          label: `Line 2: rotations do not preserve distance, so $${B}'$ need not be $${E}$.`,
          feedback: `Rotations preserve distance and $${A}${B}=${D}${E}$ is given, so line 2 is correct.`,
        }
      : {
          label: `Line 4: the angle at $${E}$ cannot be used, because $\\angle ${C}\\cong\\angle ${F}$ already gives the third angle.`,
          feedback: `Using $\\angle ${B}\\cong\\angle ${E}$ is allowed; the trouble starts earlier, at line 2.`,
        },
    {
      label:
        "No line fails: the triangles only look different because they are drawn in different positions.",
      feedback:
        "The dashed copy shows where the motions really carry the triangle; the argument cannot be valid.",
    },
  ]).slice(0, 3);
  const t = tri(L);
  const s = choiceSurface(r, {
    prompt: `Use the figure. Given: ${givensText(L, givens)}; ${orientationText(L, c)}. A student tries to prove $${t.abc}\\cong${t.def}$ with ${correspondence(L)} by rigid motions. ${lineBoard(lines)} The argument is not valid. Which line is the first that does not follow, and why?`,
    options: [{ label: correct, correct: true }, ...wrong],
    hint: `The givens are ${givensText(L, givens)}. Read the lines in order and, for each point or ray that lands, ask which given or fact leaves it exactly one place to go.`,
    explanation: (ssa
      ? [
          `Lines 1 to 4 are correct: they use $${givenTex.AB(L)}$ and $${givenTex.A(L)}$, and they put $${Cs}$ on ray $${D}${F}$.`,
          `Line 5 uses $${B}${C}=${E}${F}$: $${Cs}$ is on the circle about $${E}$ of radius $${E}${F}$. That circle can cross ray $${D}${F}$ twice, at $${F}$ and at a second point; here $${A}${C}\\ne ${D}${F}$, so the dashed triangle shows $${Cs}$ at the second point.`,
          "SSA gives a ray and a circle, and they can meet twice. That is why SSA is not a congruence criterion, while SAS (a ray and a distance from its endpoint) and SSS (two circles and a side of a line) pin one point.",
        ]
      : [
          `Line 1 is correct. Line 2 is the first failure: equal angles do not fix size, so $${B}'$ can be anywhere on ray $${D}${E}$; nothing makes it $${E}$.`,
          `Here $\\triangle ${A}${B}${C}$ is a scaled copy of $\\triangle ${D}${E}${F}$: the dashed triangle shows where the motions really carry it, with $${B}'$ short of or beyond $${E}$.`,
          "AAA gives the shape but not the size. Every valid criterion includes a length, which is what lands the second vertex on its match.",
        ]
    ).concat(wrong.map((o) => `“${o.label}” ${o.feedback}`)),
  });
  return (
    s && {
      ...s,
      figure: pairFigure(
        `Triangles ${A}${B}${C} and ${D}${E}${F}; ${marksText(L, criterionMarks(ssa ? "ssa" : "aaa"))}; dashed: where the motions carry ${ssa ? `${C}` : `triangle ${A}${B}${C}`}.`,
        c.at,
        L,
        criterionMarks(ssa ? "ssa" : "aaa"),
        c.extra,
      ),
    }
  );
}

const flawFamily = chainFamily({
  template: flawTemplate,
  axes: {
    kind: defineAxis("kind", ["planted", "ssa", "aaa"] as const, {
      weights: [2, 1, 1],
    }),
    criterion: defineAxis("criterion", ["sas", "asa", "sss"] as const),
    orientation: defineAxis("orientation", ["same", "opposite"] as const),
  },
  model: (r, axes) =>
    flawCase(r, axes.kind, axes.criterion, axes.orientation === "opposite"),
  render: (c, _axes, r) =>
    c.kind === "planted" ? plantedSurface(c, r) : breakdownSurface(c, r),
  variant: (c) => (c.kind === "planted" ? `planted-${c.planted}` : c.kind),
});

export const congruenceCriterionProofGenerate = dispatch(
  congruenceCriterionProofTemplates,
  {
    "rigid-motion-criterion-proof": (seed) =>
      proofFamily.generate(seed).problem,
    "rigid-motion-criterion-reason": (seed) =>
      reasonFamily.generate(seed).problem,
    "rigid-motion-criterion-flaw": (seed) => flawFamily.generate(seed).problem,
  },
);
export const congruenceCriterionProofCases = {
  "rigid-motion-criterion-proof": proofFamily.generate,
  "rigid-motion-criterion-reason": reasonFamily.generate,
  "rigid-motion-criterion-flaw": flawFamily.generate,
};
