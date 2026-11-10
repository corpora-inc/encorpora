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
  figureParallelMark,
  figurePoint,
  figureRightMark,
  figureScene,
  figureSegment,
  figureTicks,
  sceneFigure,
} from "./geometry-teaching-figures";
import {
  extentOf,
  placeLabels,
  strokesOf,
  type LabelSpec,
} from "./parallelogram-proof-kit";
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
 * Proofs of the parallelogram theorems (HSG.CO.C.11): opposite sides and
 * opposite angles are congruent, the diagonals bisect each other, the two
 * converses that reach "parallelogram", and rectangle ⇔ parallelogram with
 * congruent diagonals. Every proof is written once with role letters
 * A, B, C, D (counterclockwise) and E (the diagonals' crossing); a seed
 * picks a label set and one of the eight ways to place the roles on the
 * drawn parallelogram, so every statement stays true for the figure.
 *
 * The claims of a proof list every reason in its bank that justifies a
 * statement and the statements that reason needs. A theorem about
 * parallelograms is never a claim inside a converse proof, and no proof
 * may cite the theorem it proves.
 */

const work = "structured-work-v1" as const;
export const parallelogramProofTemplates: readonly TemplateMetadata[] = [
  {
    id: "parallelogram-proof-fill",
    version: 1,
    title: "Complete a parallelogram proof",
    skillId: "parallelogram-proofs",
    gradeBand: "9–12",
    difficultyOffset: 0.3,
    requiredResponseCapability: work,
    requiredFigureCapability: "scenes-v1",
    description:
      "Complete a two-column proof of a parallelogram theorem or converse by choosing the reasons for two or three blank lines, or the missing statement of one line: opposite sides, opposite angles, bisecting diagonals, the converses from bisecting diagonals and from congruent opposite sides, and congruent diagonals of a rectangle and its converse. Banks hold converse-for-theorem, circular, wrong-criterion and false-theorem distractors.",
  },
  {
    id: "parallelogram-proof-order",
    version: 1,
    title: "Put a parallelogram proof in order",
    skillId: "parallelogram-proofs",
    gradeBand: "9–12",
    difficultyOffset: 0.2,
    requiredResponseCapability: work,
    requiredFigureCapability: "scenes-v1",
    description:
      "Order the shuffled lines of a two-column proof of a parallelogram theorem, a converse, or a rectangle diagonal theorem so that every line follows from lines above it; any valid order is credited.",
  },
  {
    id: "parallelogram-converse-reasoning",
    version: 1,
    title: "Theorem or converse: audit a parallelogram argument",
    skillId: "parallelogram-proofs",
    gradeBand: "9–12",
    difficultyOffset: 0.4,
    requiredResponseCapability: "single-choice-v1",
    requiredFigureCapability: "scenes-v1",
    description:
      "Find the unjustified line of a parallelogram proof (converse for theorem, circular reason, wrong criterion, CPCTC too early, false theorem); decide which single fact is or is not enough to prove a quadrilateral is a parallelogram; choose the figure that is a counterexample to a near-converse; or choose the correct and complete explanation of a theorem or of why its converse differs.",
  },
];

/* ------------------------------------------------------------ reasons */

export const REASONS = {
  given: "Given",
  defPar: "Definition of parallelogram",
  altInt: "Alternate interior angles of parallel lines are congruent",
  converseAlt:
    "If alternate interior angles are congruent, then the lines are parallel",
  corr: "Corresponding angles of parallel lines are congruent",
  sameSide: "Same-side interior angles of parallel lines are supplementary",
  consec: "Consecutive angles of a parallelogram are supplementary",
  congSupp: "Angles supplementary to the same angle are congruent",
  reflexive: "Reflexive property of congruence",
  vertical: "Vertical angles are congruent",
  sss: "SSS",
  sas: "SAS",
  asa: "ASA",
  ssa: "SSA",
  aaa: "AAA",
  cpctc: "CPCTC (corresponding parts of congruent triangles)",
  oppSides: "Opposite sides of a parallelogram are congruent",
  oppAngles: "Opposite angles of a parallelogram are congruent",
  diagBisect: "Diagonals of a parallelogram bisect each other",
  defRect: "Definition of rectangle",
  rightCong: "All right angles are congruent",
  suppRight: "Congruent supplementary angles are right angles",
  rectDiag: "Diagonals of a rectangle are congruent",
  perpDiag: "Diagonals of a parallelogram are perpendicular",
  consecCong: "Consecutive angles of a parallelogram are congruent",
} as const;
export type ReasonKey = keyof typeof REASONS;

/* ------------------------------------------------------------- labels */

/** Role letters: A, B, C, D counterclockwise, E where the diagonals meet. */
const ROLES = ["A", "B", "C", "D", "E"] as const;
type Role = (typeof ROLES)[number];
export const labelSets = [
  ["A", "B", "C", "D", "E"],
  ["P", "Q", "R", "S", "T"],
  ["W", "X", "Y", "Z", "V"],
  ["J", "K", "L", "M", "N"],
] as const;
type Letters = Record<Role, string>;

/** Rewrite the role letters inside every $…$ span (one pass, so a swap
 * never collides). Prose outside math names no vertex. */
export function relabel(text: string, map: Readonly<Record<string, string>>) {
  return text.replace(/\$[^$]*\$/g, (span) =>
    span.replace(/[A-Z]/g, (ch) => map[ch] ?? ch),
  );
}

/* -------------------------------------------------------------- proofs */

type Claim = Partial<Record<ReasonKey, string[][]>>;
interface Line {
  key: string;
  tex: string;
  claim: Claim;
}
export type ProofId = "a" | "b" | "c" | "d" | "e" | "f" | "g";
interface Marks {
  arrows?: boolean;
  /** Diagonal AC dashed as an auxiliary segment. */
  auxAc?: boolean;
  diagonals?: boolean;
  crossing?: boolean;
  sideTicks?: boolean;
  halfTicks?: boolean;
  right?: boolean;
}
export interface Proof {
  id: ProofId;
  /** The theorem, in words. */
  theorem: string;
  shape: "parallelogram" | "quadrilateral" | "rectangle";
  given: string;
  prove: string;
  /** A sentence after the givens (an auxiliary segment). */
  note?: string;
  lines: Line[];
  path: [string, ReasonKey][];
  distractors: ReasonKey[];
  /** Lines whose reason a fill-in may blank. */
  keyLines: string[];
  /** Lines whose statement a fill-in may blank, with three wrong
   * statements each. */
  statementBlanks: Partial<Record<string, Line[]>>;
  why: Record<string, string>;
  decoy: Partial<Record<string, string>>;
  direction: string;
  marks: Marks;
}

const t = (key: string, tex: string, claim: Claim = {}): Line => ({
  key,
  tex,
  claim,
});
const PAR = "$ABCD$ is a parallelogram";
const BOTH_PARALLEL =
  "$\\overline{AB}\\parallel\\overline{DC}$ and $\\overline{AD}\\parallel\\overline{BC}$";

const proofs: Record<ProofId, Proof> = {
  a: {
    id: "a",
    theorem: "Opposite sides of a parallelogram are congruent.",
    shape: "parallelogram",
    given: PAR,
    prove:
      "$\\overline{AB}\\cong\\overline{CD}$ and $\\overline{BC}\\cong\\overline{DA}$",
    note: "Diagonal $\\overline{AC}$ is drawn.",
    lines: [
      t("g", PAR, { given: [[]], defPar: [["par"]] }),
      t("par", BOTH_PARALLEL, { defPar: [["g"]], converseAlt: [["alt"]] }),
      t(
        "alt",
        "$\\angle BAC\\cong\\angle DCA$ and $\\angle DAC\\cong\\angle BCA$",
        { altInt: [["par"]], cpctc: [["tri"]] },
      ),
      t("refl", "$\\overline{AC}\\cong\\overline{CA}$", { reflexive: [[]] }),
      t("tri", "$\\triangle ABC\\cong\\triangle CDA$", {
        asa: [["alt", "refl"]],
      }),
      t(
        "goal",
        "$\\overline{AB}\\cong\\overline{CD}$ and $\\overline{BC}\\cong\\overline{DA}$",
        { cpctc: [["tri"]] },
      ),
    ],
    path: [
      ["g", "given"],
      ["par", "defPar"],
      ["alt", "altInt"],
      ["refl", "reflexive"],
      ["tri", "asa"],
      ["goal", "cpctc"],
    ],
    distractors: ["converseAlt", "corr", "sameSide", "sas", "ssa", "oppSides"],
    keyLines: ["par", "alt", "tri", "goal"],
    statementBlanks: {
      alt: [
        t(
          "x1",
          "$\\angle BAC\\cong\\angle DAC$ and $\\angle DCA\\cong\\angle BCA$",
        ),
        t(
          "x2",
          "$\\angle BAC\\cong\\angle BCA$ and $\\angle DAC\\cong\\angle DCA$",
        ),
        t("x3", "$\\overline{AC}\\cong\\overline{BD}$"),
      ],
      tri: [
        t("x1", "$\\triangle ABC\\cong\\triangle ACD$"),
        t("x2", "$\\triangle ABC\\cong\\triangle ADC$"),
        t("x3", "$\\triangle ABC\\cong\\triangle DAC$"),
      ],
    },
    why: {
      g: "It is the given.",
      par: "By definition, a parallelogram has both pairs of opposite sides parallel.",
      alt: "Diagonal $\\overline{AC}$ crosses both pairs of parallel sides. The angles it makes inside each pair, on opposite sides of it, are alternate interior angles, so they are congruent.",
      refl: "$\\overline{AC}$ is a side of both triangles, and a segment is congruent to itself.",
      tri: "Side $\\overline{AC}$ lies between the two pairs of congruent angles, so ASA (angle, included side, angle) applies.",
      goal: "The triangles are congruent, so their corresponding parts are congruent (CPCTC): $\\overline{AB}$ matches $\\overline{CD}$, and $\\overline{BC}$ matches $\\overline{DA}$.",
    },
    decoy: {
      par: "The definition is about parallel sides; nothing yet says the sides are congruent.",
      alt: "The converse would conclude parallel lines, but this line concludes congruent angles.",
      tri: "SAS would need two pairs of congruent sides, and only $\\overline{AC}$ is known.",
      goal: "“Opposite sides of a parallelogram are congruent” is the theorem being proved, so it cannot be a reason here.",
    },
    direction:
      "The proof starts from a parallelogram and must reach congruent opposite sides, so the theorem about opposite sides cannot be a reason.",
    marks: { arrows: true, auxAc: true },
  },
  b: {
    id: "b",
    theorem: "Opposite angles of a parallelogram are congruent.",
    shape: "parallelogram",
    given: PAR,
    prove: "$\\angle DAB\\cong\\angle BCD$ and $\\angle ABC\\cong\\angle CDA$",
    lines: [
      t("g", PAR, { given: [[]], defPar: [["par"]] }),
      t("par", BOTH_PARALLEL, { defPar: [["g"]] }),
      t(
        "s1",
        "$\\angle ABC$ is supplementary to $\\angle DAB$ and to $\\angle BCD$",
        { sameSide: [["par"]] },
      ),
      t("s2", "$\\angle CDA$ and $\\angle DAB$ are supplementary", {
        sameSide: [["par"]],
      }),
      t(
        "goal",
        "$\\angle DAB\\cong\\angle BCD$ and $\\angle ABC\\cong\\angle CDA$",
        { congSupp: [["s1", "s2"]] },
      ),
    ],
    path: [
      ["g", "given"],
      ["par", "defPar"],
      ["s1", "sameSide"],
      ["s2", "sameSide"],
      ["goal", "congSupp"],
    ],
    distractors: [
      "altInt",
      "oppAngles",
      "corr",
      "rightCong",
      "suppRight",
      "vertical",
    ],
    keyLines: ["par", "s1", "s2", "goal"],
    statementBlanks: {},
    why: {
      g: "It is the given.",
      par: "By definition, a parallelogram has both pairs of opposite sides parallel.",
      s1: "Side $\\overline{AB}$ crosses $\\overline{AD}\\parallel\\overline{BC}$, and side $\\overline{BC}$ crosses $\\overline{AB}\\parallel\\overline{DC}$. Each time the two angles lie inside the parallel lines on the same side of the crossing line, so they are supplementary.",
      s2: "Side $\\overline{AD}$ crosses $\\overline{AB}\\parallel\\overline{DC}$; $\\angle CDA$ and $\\angle DAB$ are same-side interior angles.",
      goal: "$\\angle DAB$ and $\\angle BCD$ are both supplementary to $\\angle ABC$, and $\\angle ABC$ and $\\angle CDA$ are both supplementary to $\\angle DAB$. Angles supplementary to the same angle are congruent.",
    },
    decoy: {
      par: "The definition gives the parallel sides that same-side interior angles need.",
      s1: "Alternate interior angles are congruent; these angles add to $180^\\circ$.",
      s2: "Alternate interior angles are congruent; these angles add to $180^\\circ$.",
      goal: "“Opposite angles of a parallelogram are congruent” is the theorem being proved, so it cannot be a reason here.",
    },
    direction:
      "The proof starts from a parallelogram and must reach congruent opposite angles, so the theorem about opposite angles cannot be a reason.",
    marks: { arrows: true },
  },
  c: {
    id: "c",
    theorem: "The diagonals of a parallelogram bisect each other.",
    shape: "parallelogram",
    given: "$ABCD$ is a parallelogram whose diagonals meet at $E$",
    prove:
      "$\\overline{AC}$ and $\\overline{BD}$ bisect each other, that is, $\\overline{AE}\\cong\\overline{CE}$ and $\\overline{BE}\\cong\\overline{DE}$",
    lines: [
      t("g", PAR, { given: [[]] }),
      t("par", "$\\overline{AB}\\parallel\\overline{DC}$", {
        defPar: [["g"]],
      }),
      t(
        "alt",
        "$\\angle BAE\\cong\\angle DCE$ and $\\angle ABE\\cong\\angle CDE$",
        { altInt: [["par"]], cpctc: [["tri"]] },
      ),
      t("opp", "$\\overline{AB}\\cong\\overline{CD}$", {
        oppSides: [["g"]],
        cpctc: [["tri"]],
      }),
      t("tri", "$\\triangle ABE\\cong\\triangle CDE$", {
        asa: [["alt", "opp"]],
      }),
      t(
        "goal",
        "$\\overline{AE}\\cong\\overline{CE}$ and $\\overline{BE}\\cong\\overline{DE}$",
        { cpctc: [["tri"]] },
      ),
    ],
    path: [
      ["g", "given"],
      ["par", "defPar"],
      ["alt", "altInt"],
      ["opp", "oppSides"],
      ["tri", "asa"],
      ["goal", "cpctc"],
    ],
    distractors: [
      "diagBisect",
      "converseAlt",
      "vertical",
      "sas",
      "aaa",
      "corr",
    ],
    keyLines: ["par", "alt", "opp", "tri", "goal"],
    statementBlanks: {
      alt: [
        t(
          "x1",
          "$\\angle BAE\\cong\\angle ABE$ and $\\angle DCE\\cong\\angle CDE$",
        ),
        t(
          "x2",
          "$\\angle BAE\\cong\\angle CDE$ and $\\angle ABE\\cong\\angle DCE$",
        ),
        t(
          "x3",
          "$\\angle BAE\\cong\\angle DAE$ and $\\angle ABE\\cong\\angle CBE$",
        ),
      ],
      tri: [
        t("x1", "$\\triangle ABE\\cong\\triangle DCE$"),
        t("x2", "$\\triangle ABE\\cong\\triangle ADE$"),
        t("x3", "$\\triangle ABE\\cong\\triangle CBE$"),
      ],
    },
    why: {
      g: "It is the given.",
      par: "By definition, the opposite sides of a parallelogram are parallel.",
      alt: "The diagonals cross $\\overline{AB}\\parallel\\overline{DC}$: $\\overline{AC}$ makes alternate interior angles at $A$ and $C$, and $\\overline{BD}$ makes them at $B$ and $D$.",
      opp: "Opposite sides of a parallelogram are congruent, a theorem proved earlier with one diagonal and ASA.",
      tri: "Side $\\overline{AB}$ lies between the angles at $A$ and $B$, and side $\\overline{CD}$ between the angles at $C$ and $D$, so ASA applies.",
      goal: "Corresponding parts of the congruent triangles match: $\\overline{AE}$ with $\\overline{CE}$, and $\\overline{BE}$ with $\\overline{DE}$. So $E$ is the midpoint of both diagonals.",
    },
    decoy: {
      par: "The definition gives parallel sides; congruent sides come from a theorem.",
      alt: "The converse would conclude parallel lines, but this line concludes congruent angles.",
      opp: "The definition of a parallelogram says nothing about side lengths, so the theorem is needed.",
      tri: "SAS would need $\\overline{AE}\\cong\\overline{CE}$ or $\\overline{BE}\\cong\\overline{DE}$, which is what is being proved.",
      goal: "“Diagonals of a parallelogram bisect each other” is the theorem being proved, so it cannot be a reason here.",
    },
    direction:
      "The proof starts from a parallelogram and must show that $E$ is the midpoint of both diagonals. The theorem about bisecting diagonals cannot be a reason; the theorem about opposite sides, proved earlier, can.",
    marks: { arrows: true, diagonals: true, crossing: true },
  },
  d: {
    id: "d",
    theorem:
      "A quadrilateral whose diagonals bisect each other is a parallelogram.",
    shape: "quadrilateral",
    given:
      "the diagonals of quadrilateral $ABCD$ meet at $E$, with $\\overline{AE}\\cong\\overline{CE}$ and $\\overline{BE}\\cong\\overline{DE}$",
    prove: PAR,
    lines: [
      t(
        "g",
        "$\\overline{AE}\\cong\\overline{CE}$ and $\\overline{BE}\\cong\\overline{DE}$",
        { given: [[]] },
      ),
      t(
        "vert",
        "$\\angle AEB\\cong\\angle CED$ and $\\angle AED\\cong\\angle CEB$",
        { vertical: [[]] },
      ),
      t(
        "tri",
        "$\\triangle AEB\\cong\\triangle CED$ and $\\triangle AED\\cong\\triangle CEB$",
        { sas: [["g", "vert"]] },
      ),
      t(
        "cp",
        "$\\angle BAE\\cong\\angle DCE$ and $\\angle DAE\\cong\\angle BCE$",
        { cpctc: [["tri"]], altInt: [["par"]] },
      ),
      t("par", BOTH_PARALLEL, {
        converseAlt: [["cp"]],
        defPar: [["goal"]],
      }),
      t("goal", PAR, { defPar: [["par"]] }),
    ],
    path: [
      ["g", "given"],
      ["vert", "vertical"],
      ["tri", "sas"],
      ["cp", "cpctc"],
      ["par", "converseAlt"],
      ["goal", "defPar"],
    ],
    distractors: ["altInt", "diagBisect", "oppSides", "asa", "sss", "corr"],
    keyLines: ["vert", "tri", "cp", "par", "goal"],
    statementBlanks: {
      // Every wrong statement is false. The vertical-angles line comes
      // second, so it gets six: a blind pick among the statements not yet
      // used then succeeds no more often than on any other blank (5 in 12).
      vert: [
        t("x1", "$\\angle BAE\\cong\\angle BCE$"),
        t("x2", "$\\angle AEB\\cong\\angle AED$"),
        t("x3", "$\\overline{AE}\\cong\\overline{BE}$"),
        t("x4", "$\\angle AEB\\cong\\angle CEB$"),
        t("x5", "$\\angle BAE\\cong\\angle DAE$"),
        t("x6", "$\\overline{AB}\\cong\\overline{AD}$"),
      ],
      tri: [
        t(
          "x1",
          "$\\triangle AEB\\cong\\triangle DEC$ and $\\triangle AED\\cong\\triangle BEC$",
        ),
        t(
          "x2",
          "$\\triangle AEB\\cong\\triangle CED$ and $\\triangle AED\\cong\\triangle BEC$",
        ),
        t(
          "x3",
          "$\\triangle AEB\\cong\\triangle AED$ and $\\triangle CEB\\cong\\triangle CED$",
        ),
      ],
      cp: [
        t(
          "x1",
          "$\\angle BAE\\cong\\angle DAE$ and $\\angle BCE\\cong\\angle DCE$",
        ),
        t(
          "x2",
          "$\\angle BAE\\cong\\angle BCE$ and $\\angle DAE\\cong\\angle DCE$",
        ),
        t("x3", "$\\angle AEB\\cong\\angle AED$"),
      ],
    },
    why: {
      g: "It is the given.",
      vert: "$\\overline{AC}$ and $\\overline{BD}$ cross at $E$. Angles across from each other at the crossing are vertical angles, so they are congruent.",
      tri: "In each pair of triangles, two pairs of sides are congruent (given) and the vertical angles lie between them, so SAS applies.",
      cp: "The triangles are congruent, so corresponding angles match: the angles at $A$ match the angles at $C$ (CPCTC).",
      par: "Diagonal $\\overline{AC}$ makes congruent alternate interior angles with $\\overline{AB}$ and $\\overline{DC}$, and with $\\overline{AD}$ and $\\overline{BC}$. By the converse of the alternate interior angles theorem, each pair is parallel.",
      goal: "Both pairs of opposite sides are parallel, which is the definition of a parallelogram.",
    },
    decoy: {
      vert: "The angles at $E$ are across from each other, not a linear pair.",
      tri: "ASA would need two pairs of congruent angles; here two sides and the angle between them are known.",
      cp: "The alternate interior angles theorem would need parallel sides, which are not known yet.",
      par: "The alternate interior angles theorem runs the other way: it starts from parallel lines.",
      goal: "Theorems about parallelograms cannot be used before $ABCD$ is known to be one.",
    },
    direction:
      "The proof starts from bisected diagonals and must reach “parallelogram,” so no theorem about parallelograms may be used along the way.",
    marks: { diagonals: true, crossing: true, halfTicks: true },
  },
  e: {
    id: "e",
    theorem:
      "A quadrilateral whose opposite sides are congruent is a parallelogram.",
    shape: "quadrilateral",
    given:
      "in quadrilateral $ABCD$, $\\overline{AB}\\cong\\overline{CD}$ and $\\overline{AD}\\cong\\overline{CB}$",
    prove: PAR,
    note: "Diagonal $\\overline{AC}$ is drawn.",
    lines: [
      t(
        "g",
        "$\\overline{AB}\\cong\\overline{CD}$ and $\\overline{AD}\\cong\\overline{CB}$",
        { given: [[]], oppSides: [["goal"]] },
      ),
      t("refl", "$\\overline{AC}\\cong\\overline{CA}$", { reflexive: [[]] }),
      t("tri", "$\\triangle ABC\\cong\\triangle CDA$", {
        sss: [["g", "refl"]],
      }),
      t(
        "cp",
        "$\\angle BAC\\cong\\angle DCA$ and $\\angle BCA\\cong\\angle DAC$",
        { cpctc: [["tri"]], altInt: [["par"]] },
      ),
      t(
        "par",
        "$\\overline{AB}\\parallel\\overline{DC}$ and $\\overline{BC}\\parallel\\overline{DA}$",
        { converseAlt: [["cp"]], defPar: [["goal"]] },
      ),
      t("goal", PAR, { defPar: [["par"]] }),
    ],
    path: [
      ["g", "given"],
      ["refl", "reflexive"],
      ["tri", "sss"],
      ["cp", "cpctc"],
      ["par", "converseAlt"],
      ["goal", "defPar"],
    ],
    distractors: ["oppSides", "altInt", "sas", "ssa", "diagBisect", "corr"],
    keyLines: ["tri", "cp", "par", "goal"],
    statementBlanks: {
      tri: [
        t("x1", "$\\triangle ABC\\cong\\triangle ACD$"),
        t("x2", "$\\triangle ABC\\cong\\triangle ADC$"),
        t("x3", "$\\triangle ABC\\cong\\triangle DAC$"),
      ],
      cp: [
        t(
          "x1",
          "$\\angle BAC\\cong\\angle DAC$ and $\\angle BCA\\cong\\angle DCA$",
        ),
        t(
          "x2",
          "$\\angle BAC\\cong\\angle BCA$ and $\\angle DAC\\cong\\angle DCA$",
        ),
        t("x3", "$\\overline{AC}\\cong\\overline{BD}$"),
      ],
    },
    why: {
      g: "It is the given.",
      refl: "$\\overline{AC}$ is a side of both triangles, and a segment is congruent to itself.",
      tri: "$\\overline{AB}\\cong\\overline{CD}$, $\\overline{BC}\\cong\\overline{DA}$ and the shared side $\\overline{AC}$ give three pairs of congruent sides, so SSS applies.",
      cp: "The triangles are congruent, so corresponding angles match: the angle at $A$ in one triangle matches the angle at $C$ in the other (CPCTC).",
      par: "Diagonal $\\overline{AC}$ makes congruent alternate interior angles with each pair of opposite sides, so by the converse of the alternate interior angles theorem each pair is parallel.",
      goal: "Both pairs of opposite sides are parallel, which is the definition of a parallelogram.",
    },
    decoy: {
      tri: "SAS would need a congruent angle between two sides, and no angle is known yet.",
      cp: "The alternate interior angles theorem would need parallel sides, which are not known yet.",
      par: "The alternate interior angles theorem runs the other way: it starts from parallel lines.",
      goal: "Theorems about parallelograms cannot be used before $ABCD$ is known to be one.",
    },
    direction:
      "The proof starts from congruent opposite sides and must reach “parallelogram,” so no theorem about parallelograms may be used along the way.",
    marks: { sideTicks: true, auxAc: true },
  },
  f: {
    id: "f",
    theorem: "The diagonals of a rectangle are congruent.",
    shape: "rectangle",
    given: "$ABCD$ is a rectangle",
    prove: "$\\overline{DB}\\cong\\overline{CA}$",
    lines: [
      t(
        "pr",
        "$ABCD$ is a parallelogram, and $\\angle DAB$ and $\\angle CBA$ are right angles",
        { defRect: [[]] },
      ),
      t("opp", "$\\overline{AD}\\cong\\overline{BC}$", {
        oppSides: [["pr"]],
      }),
      t("rt", "$\\angle DAB\\cong\\angle CBA$", { rightCong: [["pr"]] }),
      t("refl", "$\\overline{AB}\\cong\\overline{BA}$", { reflexive: [[]] }),
      t("tri", "$\\triangle DAB\\cong\\triangle CBA$", {
        sas: [["opp", "rt", "refl"]],
      }),
      t("goal", "$\\overline{DB}\\cong\\overline{CA}$", { cpctc: [["tri"]] }),
    ],
    path: [
      ["pr", "defRect"],
      ["opp", "oppSides"],
      ["rt", "rightCong"],
      ["refl", "reflexive"],
      ["tri", "sas"],
      ["goal", "cpctc"],
    ],
    distractors: ["rectDiag", "perpDiag", "asa", "sss", "defPar", "oppAngles"],
    keyLines: ["pr", "opp", "tri", "goal"],
    statementBlanks: {
      tri: [
        t("x1", "$\\triangle DAB\\cong\\triangle ABC$"),
        t("x2", "$\\triangle DAB\\cong\\triangle CAB$"),
        t("x3", "$\\triangle DAB\\cong\\triangle BAC$"),
      ],
    },
    why: {
      pr: "By definition, a rectangle is a parallelogram whose angles are right angles.",
      opp: "$ABCD$ is a parallelogram, so its opposite sides are congruent.",
      rt: "Every right angle measures $90^\\circ$, so all right angles are congruent.",
      refl: "$\\overline{AB}$ is a side of both triangles, and a segment is congruent to itself.",
      tri: "Sides $\\overline{DA}$ and $\\overline{AB}$ with the angle between them match sides $\\overline{CB}$ and $\\overline{BA}$ with the angle between them, so SAS applies.",
      goal: "The diagonals are corresponding parts of the congruent triangles (CPCTC).",
    },
    decoy: {
      pr: "The definition of a parallelogram says nothing about right angles.",
      opp: "The definition of a rectangle names its angles, not its side lengths; the side fact comes from the theorem about parallelograms.",
      tri: "ASA would need a second pair of congruent angles at the ends of $\\overline{AB}$.",
      goal: "“Diagonals of a rectangle are congruent” is the theorem being proved, so it cannot be a reason here.",
    },
    direction:
      "The proof starts from a rectangle and must reach congruent diagonals, so the theorem about a rectangle's diagonals cannot be a reason. The given is used through the definition of a rectangle on the first line.",
    marks: { right: true, diagonals: true },
  },
  g: {
    id: "g",
    theorem: "A parallelogram with congruent diagonals is a rectangle.",
    shape: "parallelogram",
    given:
      "$ABCD$ is a parallelogram with $\\overline{AC}\\cong\\overline{BD}$",
    prove:
      "$\\angle DAB$ and $\\angle CBA$ are right angles. A parallelogram with a right angle is a rectangle, so this proves that $ABCD$ is a rectangle",
    lines: [
      t("opp", "$\\overline{AD}\\cong\\overline{BC}$", { oppSides: [[]] }),
      t("refl", "$\\overline{AB}\\cong\\overline{BA}$", { reflexive: [[]] }),
      t("tri", "$\\triangle DAB\\cong\\triangle CBA$", {
        sss: [["opp", "refl"]],
      }),
      t("cp", "$\\angle DAB\\cong\\angle CBA$", {
        cpctc: [["tri"]],
        rightCong: [["goal"]],
      }),
      t("sup", "$\\angle DAB$ and $\\angle CBA$ are supplementary", {
        consec: [[]],
      }),
      t("goal", "$\\angle DAB$ and $\\angle CBA$ are right angles", {
        suppRight: [["cp", "sup"]],
      }),
    ],
    path: [
      ["opp", "oppSides"],
      ["refl", "reflexive"],
      ["tri", "sss"],
      ["cp", "cpctc"],
      ["sup", "consec"],
      ["goal", "suppRight"],
    ],
    distractors: [
      "perpDiag",
      "sas",
      "rightCong",
      "defRect",
      "rectDiag",
      "oppAngles",
    ],
    keyLines: ["opp", "tri", "cp", "sup", "goal"],
    statementBlanks: {
      tri: [
        t("x1", "$\\triangle DAB\\cong\\triangle ABC$"),
        t("x2", "$\\triangle DAB\\cong\\triangle CAB$"),
        t("x3", "$\\triangle DAB\\cong\\triangle BAC$"),
      ],
      cp: [
        t("x1", "$\\angle DAB\\cong\\angle ADB$"),
        t("x2", "$\\angle ADB\\cong\\angle ABD$"),
        t("x3", "$\\overline{DA}\\cong\\overline{AB}$"),
      ],
    },
    why: {
      opp: "$ABCD$ is a parallelogram, so its opposite sides are congruent.",
      refl: "$\\overline{AB}$ is a side of both triangles, and a segment is congruent to itself.",
      tri: "$\\overline{DA}\\cong\\overline{CB}$, the shared side $\\overline{AB}$, and the given diagonals $\\overline{DB}\\cong\\overline{CA}$ give three pairs of congruent sides, so SSS applies.",
      cp: "The angles at $A$ and $B$ are corresponding parts of the congruent triangles (CPCTC).",
      sup: "$\\angle DAB$ and $\\angle CBA$ are consecutive angles of the parallelogram, so their measures add to $180^\\circ$.",
      goal: "Two angles that are congruent and add to $180^\\circ$ each measure $90^\\circ$.",
    },
    decoy: {
      opp: "The given names the diagonals, not the sides; the side fact comes from the theorem about parallelograms.",
      tri: "SAS would need a congruent angle, and no angle is known yet.",
      cp: "“All right angles are congruent” would need the right angles, which are what is being proved.",
      sup: "Opposite angles of a parallelogram are congruent, but these two angles are consecutive, not opposite.",
      goal: "The definition of a rectangle cannot be used before $ABCD$ is known to be one.",
    },
    direction:
      "The proof starts from a parallelogram with congruent diagonals and must reach right angles, so no theorem about rectangles may be used. The given is used directly by the first lines.",
    marks: { arrows: true, diagonals: true },
  },
};
export const proofIds = Object.keys(proofs) as ProofId[];
export const proofOf = (id: ProofId): Proof => proofs[id];

/* -------------------------------------------------------------- figure */

export interface Layout {
  w: number;
  h: number;
  s: number;
  /** Position of role A (0 lower left, then counterclockwise). */
  start: number;
  /** Roles run clockwise around the positions. */
  flip: boolean;
  set: number;
}
const SCALE = 0.6;
/** Role coordinates for a layout: positions P0 (0,0), P1 (w,0),
 * P2 (w+s,h), P3 (s,h); E is the middle of the diagonals. */
export function rolePoints(l: Layout): Record<Role, Point> {
  const P: Point[] = [
    [0, 0],
    [l.w, 0],
    [l.w + l.s, l.h],
    [l.s, l.h],
  ].map(([x, y]) => [x! * SCALE, y! * SCALE] as Point);
  const at = (i: number) => P[(((l.start + (l.flip ? -i : i)) % 4) + 4) % 4]!;
  const [A, B, C, D] = [at(0), at(1), at(2), at(3)];
  const E: Point = [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2];
  return { A, B, C, D, E };
}
export const lettersOf = (set: number): Letters => {
  const s = labelSets[set]!;
  return { A: s[0], B: s[1], C: s[2], D: s[3], E: s[4] };
};

function drawLayout(r: Random, rectangle: boolean): Layout {
  return {
    w: r(7, 10),
    h: r(4, 6),
    s: rectangle ? 0 : pick(r, [-3, -2, 2, 3]),
    start: r(0, 3),
    flip: r(0, 1) === 1,
    set: r(0, labelSets.length - 1),
  };
}

function figure(p: Proof, l: Layout): Scene {
  const at = rolePoints(l);
  const L = lettersOf(l.set);
  const m = p.marks;
  const center = at.E;
  const els: Element[] = [];
  const q = (["A", "B", "C", "D"] as const).map((k) => at[k]);
  els.push({
    type: "polygon",
    id: "body",
    points: q,
    fill: "none",
    stroke: "ink",
    width: 2.5,
  });
  if (m.auxAc)
    els.push(
      figureSegment("dac", at.A, at.C, {
        dash: true,
        stroke: "accent",
        width: 2,
      }),
    );
  if (m.diagonals)
    els.push(
      figureSegment("dac", at.A, at.C, { stroke: "accent", width: 2 }),
      figureSegment("dbd", at.B, at.D, { stroke: "accent", width: 2 }),
    );
  if (m.arrows)
    els.push(
      ...figureParallelMark("pab", at.A, at.B, 1, 0.5),
      ...figureParallelMark("pdc", at.D, at.C, 1, 0.5),
      ...figureParallelMark("pad", at.A, at.D, 2, 0.5),
      ...figureParallelMark("pbc", at.B, at.C, 2, 0.5),
    );
  if (m.sideTicks)
    els.push(
      ...figureTicks("tab", at.A, at.B, 1),
      ...figureTicks("tcd", at.C, at.D, 1),
      ...figureTicks("tad", at.A, at.D, 2),
      ...figureTicks("tbc", at.B, at.C, 2),
    );
  if (m.halfTicks)
    els.push(
      ...figureTicks("tae", at.A, at.E, 1),
      ...figureTicks("tce", at.C, at.E, 1),
      ...figureTicks("tbe", at.B, at.E, 2),
      ...figureTicks("tde", at.D, at.E, 2),
    );
  if (m.right)
    for (const [v, a, b] of [
      ["A", "B", "D"],
      ["B", "C", "A"],
      ["C", "D", "B"],
      ["D", "A", "C"],
    ] as const)
      els.push(figureRightMark(`r${v}`, at[v], at[a], at[b], 0.32));
  if (m.crossing) els.push(figurePoint("pe", at.E));
  const names: LabelSpec[] = (["A", "B", "C", "D"] as const).map((k) => ({
    id: `n${k}`,
    text: L[k],
    at: at[k],
    out: [at[k][0] - center[0], at[k][1] - center[1]],
    bold: true,
  }));
  if (m.crossing)
    names.push({ id: "nE", text: L.E, at: at.E, out: [0.1, -1], bold: true });
  els.push(
    ...placeLabels(
      names,
      strokesOf(els),
      extentOf((["A", "B", "C", "D"] as const).map((k) => at[k])),
    ),
  );
  return figureScene(relabel(title(p), L).replace(/\$/g, ""), els);
}
function title(p: Proof) {
  const m = p.marks;
  const name =
    p.shape === "rectangle"
      ? "Rectangle"
      : p.shape === "quadrilateral"
        ? "Quadrilateral"
        : "Parallelogram";
  const parts = [`${name} $ABCD$`];
  if (m.auxAc) parts.push("with diagonal $AC$ dashed");
  if (m.diagonals)
    parts.push(
      m.crossing ? "with diagonals meeting at $E$" : "with both diagonals",
    );
  if (m.arrows)
    parts.push("; arrows mark $AB$ parallel to $DC$ and $AD$ parallel to $BC$");
  if (m.sideTicks) parts.push("; ticks mark $AB = CD$ and $AD = CB$");
  if (m.halfTicks) parts.push("; ticks mark $AE = CE$ and $BE = DE$");
  if (m.right) parts.push("; right angles at every corner");
  return parts.join(" ").replace(/ ;/g, ";");
}

/* ----------------------------------------------------- proof response */

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

type FillShape =
  | { kind: "reasons"; blanks: Set<string> }
  | { kind: "statement"; line: string };

/** The proof's banks and claims in display ids: statements and reasons are
 * lettered by their shuffled display position, so an id never tells a
 * line's place. */
function banks(
  r: Random,
  p: Proof,
  L: Letters,
  extra: Line[],
): {
  statements: WorkBank;
  reasons: WorkBank;
  sid: Map<string, string>;
  rid: Map<ReasonKey, string>;
  claims: Record<string, Record<string, string[][]>>;
} {
  const all = [...p.lines, ...extra];
  const shown = shuffle(r, [...all]);
  const sid = new Map(shown.map((s, i) => [s.key, `s${"abcdefghijkl"[i]}`]));
  const keys = [
    ...new Set([...p.path.map(([, reason]) => reason), ...p.distractors]),
  ];
  const order = shuffle(r, [...keys]);
  const rid = new Map(order.map((k, i) => [k, `r${"abcdefghijkl"[i]}`]));
  const claims: Record<string, Record<string, string[][]>> = {};
  for (const s of all) {
    const by: Record<string, string[][]> = {};
    for (const [reason, sets] of Object.entries(s.claim) as [
      ReasonKey,
      string[][],
    ][])
      if (rid.has(reason))
        by[rid.get(reason)!] = sets.map((set) => set.map((k) => sid.get(k)!));
    if (Object.keys(by).length) claims[sid.get(s.key)!] = by;
  }
  return {
    statements: {
      id: "statements",
      label: "Statement",
      options: shown.map((s) => ({
        id: sid.get(s.key)!,
        label: relabel(s.tex, L),
      })),
    },
    reasons: {
      id: "reasons",
      label: "Reason",
      options: order.map((k) => ({ id: rid.get(k)!, label: REASONS[k] })),
    },
    sid,
    rid,
    claims,
  };
}

const field = (bank: "statements" | "reasons", given?: string): WorkField => ({
  kind: "choice",
  label: bank === "statements" ? "Statement" : "Reason",
  bank,
  ...(given !== undefined ? { given } : {}),
});

export function fillProof(
  r: Random,
  p: Proof,
  L: Letters,
  shape: FillShape,
  label: string,
) {
  const extra =
    shape.kind === "statement" ? (p.statementBlanks[shape.line] ?? []) : [];
  if (shape.kind === "statement" && extra.length < 3)
    throw new Error(`No statement blank on ${p.id}.${shape.line}`);
  const b = banks(r, p, L, extra);
  const goalKey = p.path.at(-1)![0];
  const grading: WorkGrading = {
    mode: "proof",
    goal: b.sid.get(goalKey)!,
    claims: b.claims,
  };
  const rows: WorkRow[] = p.path.map(([s, reason], i) => {
    const S = b.sid.get(s)!;
    const R = b.rid.get(reason)!;
    const fields =
      shape.kind === "reasons"
        ? [
            field("statements", S),
            shape.blanks.has(s) ? field("reasons") : field("reasons", R),
          ]
        : s === shape.line
          ? [field("statements"), field("reasons", R)]
          : [field("statements", S), field("reasons", R)];
    return { id: `r${i + 1}`, fields };
  });
  const answer = JSON.stringify(
    p.path.map(([s, reason]) =>
      shape.kind === "reasons"
        ? ["", shape.blanks.has(s) ? b.rid.get(reason)! : ""]
        : s === shape.line
          ? [b.sid.get(s)!, ""]
          : ["", ""],
    ),
  );
  return checked(
    {
      kind: "structured-work",
      label,
      layout: "proof",
      mode: "fill",
      goal: relabel(p.lines.find((x) => x.key === goalKey)!.tex, L),
      banks: [b.statements, b.reasons],
      rows,
    },
    grading,
    answer,
  );
}

/** Every line given and shown shuffled: never already a valid order, and
 * at least half of the lines away from their place in the worked proof. */
export function orderProof(r: Random, p: Proof, L: Letters, label: string) {
  const b = banks(r, p, L, []);
  const goalKey = p.path.at(-1)![0];
  const grading: WorkGrading = {
    mode: "proof",
    goal: b.sid.get(goalKey)!,
    claims: b.claims,
  };
  const base = {
    kind: "structured-work" as const,
    label,
    layout: "proof" as const,
    mode: "order" as const,
    goal: relabel(p.lines.find((x) => x.key === goalKey)!.tex, L),
    banks: [b.statements, b.reasons],
  };
  const rows: WorkRow[] = p.path.map(([s, reason], i) => ({
    id: `r${i + 1}`,
    fields: [
      field("statements", b.sid.get(s)!),
      field("reasons", b.rid.get(reason)!),
    ],
  }));
  const n = rows.length;
  for (let attempt = 0; attempt < 400; attempt++) {
    const order = shuffle(r, [...rows.keys()]);
    const moved = order.filter((k, i) => k !== i).length;
    if (moved < Math.ceil(n / 2)) continue;
    // The Given line is never shown first: finding it is part of the task.
    if (p.path[order[0]!]![1] === "given") continue;
    const shown = order.map((k, i) => ({ ...rows[k]!, id: `r${i + 1}` }));
    const response: StructuredWorkResponse = { ...base, rows: shown };
    if (
      gradeStructuredWork(
        response,
        grading,
        JSON.stringify(shown.map((x) => x.id)),
      )
    )
      continue;
    const display = new Map(order.map((k, i) => [k, `r${i + 1}`]));
    const key = JSON.stringify(rows.map((_, k) => display.get(k)!));
    return checked(response, grading, key);
  }
  throw new Error("Need three retry: no unsolved order to show");
}

/* ------------------------------------------------------------ surfaces */

const lineText = (p: Proof, L: Letters, i: number, reason?: ReasonKey) => {
  const [s, key] = p.path[i]!;
  const st = p.lines.find((x) => x.key === s)!;
  return `${i + 1}. ${relabel(st.tex, L)} — ${REASONS[reason ?? key]}.`;
};
const proofLines = (p: Proof, L: Letters) =>
  p.path.map((_, i) => lineText(p, L, i));
const lineNo = (p: Proof, key: string) =>
  p.path.findIndex(([s]) => s === key) + 1;
const setup = (p: Proof, L: Letters) =>
  relabel(
    `Given: ${p.given}. ${p.note ? `${p.note} ` : ""}Prove: ${p.prove}.`,
    L,
  ).replace(/^Given: in/, "Given: In");

/** Prerequisite lines of each line of the worked proof, by its reason. */
function needs(p: Proof): number[][] {
  return p.path.map(([s, reason]) => {
    const sets = p.lines.find((x) => x.key === s)!.claim[reason] ?? [[]];
    return sets[0]!.map((k) => lineNo(p, k));
  });
}

/** Each line's needs, from the last line back: "Line 6 needs line 5; …". */
function backward(p: Proof): string {
  const need = needs(p);
  const parts = need
    .map((set, i) =>
      set.length
        ? `line ${i + 1} needs ${set.length > 1 ? "lines" : "line"} ${set.join(" and ")}`
        : `line ${i + 1} needs nothing above it`,
    )
    .reverse();
  const text = parts.join("; ");
  return `Work backward through the reasons: ${text}.`;
}

/** "Line 4 needs nothing above it, so it may come anywhere before line 5." */
function floating(p: Proof): string[] {
  const n = p.path.length;
  const need = needs(p);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const earliest = Math.max(0, ...need[i]!) + 1;
    const users = need
      .map((set, j) => (set.includes(i + 1) ? j + 1 : null))
      .filter((x): x is number => x !== null);
    const latest = users.length ? Math.min(...users) - 1 : n;
    if (latest > earliest)
      out.push(
        `Line ${i + 1} needs ${need[i]!.length ? `only ${need[i]!.map((k) => `line ${k}`).join(" and ")}` : "nothing above it"}, so it could also be ${latest === earliest + 1 ? `line ${earliest === i + 1 ? latest : earliest}` : `anywhere from line ${earliest} to line ${latest}`}.`,
      );
  }
  return out;
}

/** What a statement concludes, read from its form. */
function ending(tex: string): string {
  if (tex.includes("is a parallelogram,"))
    return "names the kind of figure $ABCD$ is and its right angles";
  if (tex.includes("is a parallelogram"))
    return "says what kind of figure $ABCD$ is";
  if (tex.includes("\\parallel")) return "concludes parallel sides";
  if (tex.includes("\\triangle")) return "concludes congruent triangles";
  if (tex.includes("right angles")) return "concludes right angles";
  if (tex.includes("supplementary")) return "concludes supplementary angles";
  if (tex.includes("\\angle")) return "concludes congruent angles";
  return "concludes congruent segments";
}

function fillHint(p: Proof, L: Letters, shape: FillShape) {
  if (shape.kind === "statement") {
    const i = lineNo(p, shape.line);
    const reason = REASONS[p.path[i - 1]![1]];
    return relabel(
      `The blank is line ${i}, and its reason is “${reason}.” Read what that reason concludes, then find the statement of that form that the lines above line ${i} make true.`,
      L,
    );
  }
  const blank = p.path.flatMap(([s], i) =>
    shape.blanks.has(s)
      ? [
          `on line ${i + 1} the statement ${ending(p.lines.find((x) => x.key === s)!.tex)}`,
        ]
      : [],
  );
  const list =
    blank.length > 2
      ? `${blank.slice(0, -1).join(", ")} and ${blank.at(-1)}`
      : blank.join(" and ");
  return relabel(
    `A reason must end the way its line ends: ${list}. ${p.shape === "quadrilateral" ? "$ABCD$ is not known to be a parallelogram until the last line, so no parallelogram theorem can be a reason before then." : "A theorem cannot be a reason in its own proof."}`,
    L,
  );
}

function fillRender(
  r: Random,
  p: Proof,
  l: Layout,
  kind: "reasons" | "statement",
) {
  const L = lettersOf(l.set);
  let shape: FillShape;
  if (kind === "statement") {
    const lines = Object.keys(p.statementBlanks);
    shape = { kind: "statement", line: pick(r, lines) };
  } else {
    // Two or three key lines, never two with the same correct reason.
    const count = r(2, 3);
    const chosen = new Set<string>();
    const used = new Set<ReasonKey>();
    for (const key of shuffle(r, [...p.keyLines])) {
      const reason = p.path.find(([s]) => s === key)![1];
      if (chosen.size < count && !used.has(reason)) {
        chosen.add(key);
        used.add(reason);
      }
    }
    shape = { kind: "reasons", blanks: chosen };
  }
  const built = fillProof(r, p, L, shape, "Your proof");
  const task =
    shape.kind === "reasons"
      ? "The statements of the proof are shown. Choose the reason for each blank line."
      : "One line's statement is blank and its reason is shown. Choose the statement that belongs on that line.";
  const blanks =
    shape.kind === "reasons"
      ? p.path.flatMap(([s], i) => (shape.blanks.has(s) ? [i] : []))
      : [lineNo(p, shape.line) - 1];
  const explain = blanks.map((i) => {
    const s = p.path[i]![0];
    const reason = REASONS[p.path[i]![1]];
    const decoy = p.decoy[s];
    return relabel(
      shape.kind === "reasons"
        ? `Line ${i + 1}: ${reason}. ${p.why[s]}${decoy ? ` ${decoy}` : ""}`
        : `Line ${i + 1} must be a statement that “${reason}” concludes from the lines above it: ${p.lines.find((x) => x.key === s)!.tex}. ${p.why[s]}`,
      L,
    );
  });
  return {
    prompt: `Use the figure. ${setup(p, L)} ${task}`,
    response: built.response,
    answer: built.answer,
    workGrading: built.workGrading,
    hint: fillHint(p, L, shape),
    explanation: [
      relabel(p.direction, L),
      ...explain,
      "The complete proof:",
      ...proofLines(p, L),
    ],
    figure: sceneFigure(figure(p, l)),
  } satisfies Surface;
}

function orderRender(r: Random, p: Proof, l: Layout) {
  const L = lettersOf(l.set);
  const built = orderProof(r, p, L, "Order the proof");
  const n = p.path.length;
  const need = needs(p);
  const last = p.path[n - 1]!;
  const lastNeeds = need[n - 1]!;
  return {
    prompt: `Use the figure. ${setup(p, L)} The lines of the proof are shown out of order. Put them in order so that every line follows from lines above it.`,
    response: built.response,
    answer: built.answer,
    workGrading: built.workGrading,
    hint: relabel(
      `The last line states what is proved: ${p.lines.find((x) => x.key === last[0])!.tex}. Ask which lines its reason, “${REASONS[last[1]]},” needs above it, then work backward.`,
      L,
    ),
    explanation: [
      relabel(
        `The last line states what is proved. Its reason, “${REASONS[last[1]]},” needs ${lastNeeds.length > 1 ? "the facts" : "the fact"} on ${lastNeeds.map((k) => `line ${k}`).join(" and ")} above it.`,
        L,
      ),
      backward(p),
      relabel(p.direction, L),
      "One valid order:",
      ...proofLines(p, L),
      ...floating(p),
    ],
    figure: sceneFigure(figure(p, l)),
  } satisfies Surface;
}

/* ------------------------------------------------- converse reasoning */

type Flaw =
  "direction" | "circular" | "criterion" | "cpctc-early" | "false-theorem";
interface FlawCase {
  proof: ProofId;
  /** The altered line, by key. */
  line: string;
  /** A replaced reason, or a swap with the line above (CPCTC too early). */
  reason?: ReasonKey;
  swap?: true;
  why: string;
}
const flawCases: Record<Flaw, FlawCase[]> = {
  direction: [
    {
      proof: "d",
      line: "par",
      reason: "altInt",
      why: "It concludes parallel lines from a theorem that starts from parallel lines. The correct reason is the converse: if alternate interior angles are congruent, then the lines are parallel.",
    },
    {
      proof: "e",
      line: "par",
      reason: "altInt",
      why: "It concludes parallel lines from a theorem that starts from parallel lines. The correct reason is the converse: if alternate interior angles are congruent, then the lines are parallel.",
    },
  ],
  circular: [
    {
      proof: "a",
      line: "goal",
      reason: "oppSides",
      why: "It cites the theorem being proved. The correct reason is CPCTC, from the congruent triangles on the line above.",
    },
    {
      proof: "c",
      line: "goal",
      reason: "diagBisect",
      why: "It cites the theorem being proved. The correct reason is CPCTC, from the congruent triangles on the line above.",
    },
    {
      proof: "d",
      line: "par",
      reason: "defPar",
      why: "It gets parallel sides from the definition of a parallelogram before $ABCD$ is known to be one. The correct reason is the converse of the alternate interior angles theorem.",
    },
    {
      proof: "e",
      line: "par",
      reason: "defPar",
      why: "It gets parallel sides from the definition of a parallelogram before $ABCD$ is known to be one. The correct reason is the converse of the alternate interior angles theorem.",
    },
  ],
  criterion: [
    {
      proof: "a",
      line: "tri",
      reason: "sas",
      why: "SAS needs two pairs of congruent sides with the angle between them, but only $\\overline{AC}$ is known. Two angles and the included side make it ASA.",
    },
    {
      proof: "c",
      line: "tri",
      reason: "sas",
      why: "SAS needs two pairs of congruent sides with the angle between them, but only $\\overline{AB}\\cong\\overline{CD}$ is known. Two angles and the included side make it ASA.",
    },
    {
      proof: "d",
      line: "tri",
      reason: "asa",
      why: "ASA needs two pairs of congruent angles, but only the vertical angles are known. Two sides and the angle between them make it SAS.",
    },
    {
      proof: "e",
      line: "tri",
      reason: "ssa",
      why: "SSA is not a congruence test. The three pairs of congruent sides make it SSS.",
    },
  ],
  "cpctc-early": [
    {
      proof: "a",
      line: "goal",
      swap: true,
      why: "It uses CPCTC before the triangles are proved congruent; the congruence must come first.",
    },
    {
      proof: "c",
      line: "goal",
      swap: true,
      why: "It uses CPCTC before the triangles are proved congruent; the congruence must come first.",
    },
    {
      proof: "d",
      line: "cp",
      swap: true,
      why: "It uses CPCTC before the triangles are proved congruent; the congruence must come first.",
    },
    {
      proof: "e",
      line: "cp",
      swap: true,
      why: "It uses CPCTC before the triangles are proved congruent; the congruence must come first.",
    },
  ],
  "false-theorem": [
    {
      proof: "g",
      line: "cp",
      reason: "consecCong",
      why: "Consecutive angles of a parallelogram are supplementary, not congruent. The correct reason is CPCTC, from the congruent triangles on the line above.",
    },
  ],
};
const flawIds = Object.keys(flawCases) as Flaw[];

interface Shown {
  key: string;
  reason: ReasonKey;
}
/** The flawed argument's lines in order, and the flawed line's index. */
export function flawedLines(c: FlawCase): { lines: Shown[]; bad: number } {
  const p = proofs[c.proof];
  const lines: Shown[] = p.path.map(([key, reason]) => ({
    key,
    reason: key === c.line && c.reason ? c.reason : reason,
  }));
  let bad = lines.findIndex((x) => x.key === c.line);
  if (c.swap) {
    [lines[bad - 1], lines[bad]] = [lines[bad]!, lines[bad - 1]!];
    bad -= 1;
  }
  return { lines, bad };
}

function flawRender(r: Random, flaw: Flaw, l: Layout) {
  const c = pick(r, flawCases[flaw]);
  const p = proofs[c.proof];
  const L = lettersOf(l.set);
  const { lines, bad } = flawedLines(c);
  const text = (x: Shown, i: number) =>
    relabel(
      `${i + 1}. ${p.lines.find((y) => y.key === x.key)!.tex} — ${REASONS[x.reason]}.`,
      L,
    );
  // Four candidate lines, the flawed one among them; a Given line is
  // never a candidate.
  const candidates = lines
    .map((x, i) => i)
    .filter((i) => i === bad || lines[i]!.reason !== "given");
  const others = shuffle(
    r,
    candidates.filter((i) => i !== bad),
  ).slice(0, 3);
  const options = [bad, ...others].sort((a, b) => a - b);
  const n = lines.length;
  const choices = options.map((i) => ({
    label: `Line ${i + 1}`,
    correct: i === bad,
    feedback:
      i === bad
        ? ""
        : relabel(`Line ${i + 1} is justified: ${p.why[lines[i]!.key]}`, L),
  }));
  return ordered({
    prompt: `${setup(p, L)} A student wrote this proof:\n${lines.map(text).join("\n")}\nExactly one line is not justified by its reason and the lines above it. Which line is it?`,
    choices,
    hint: relabel(
      `Check all ${n} lines in order. For each, ask whether its reason concludes exactly that statement and whether everything the reason needs is already on a line above. Remember what is known about $ABCD$ at each step.`,
      L,
    ),
    explanation: [
      relabel(p.direction, L),
      relabel(`Line ${bad + 1} is the flaw. ${c.why}`, L),
      "The corrected proof:",
      ...proofLines(p, L),
    ],
    figure: sceneFigure(figure(p, l)),
  });
}

/** A single choice whose options keep their order (line, figure and
 * explanation numbers). */
function ordered(s: {
  prompt: string;
  choices: { label: string; correct: boolean; feedback: string }[];
  hint: string;
  explanation: string[];
  figure?: Surface["figure"];
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
    ...(s.figure ? { figure: s.figure } : {}),
  };
}

/* "Enough to prove a parallelogram?" Each insufficient condition keeps a
 * counterexample quadrilateral (A, B, C, D in order) that satisfies it and
 * is not a parallelogram. */
export const enoughFacts = [
  {
    key: "sides",
    tex: "$\\overline{AB}\\cong\\overline{CD}$ and $\\overline{AD}\\cong\\overline{BC}$",
    why: "Both pairs of opposite sides congruent: a diagonal splits $ABCD$ into triangles congruent by SSS, so alternate interior angles are congruent and both pairs of sides are parallel.",
  },
  {
    key: "diagonals",
    tex: "$\\overline{AC}$ and $\\overline{BD}$ bisect each other",
    why: "Diagonals that bisect each other give triangles congruent by SAS with the vertical angles, so both pairs of opposite sides are parallel.",
  },
  {
    key: "one-pair",
    tex: "$\\overline{AB}\\parallel\\overline{CD}$ and $\\overline{AB}\\cong\\overline{CD}$",
    why: "One pair of sides both parallel and congruent: diagonal $\\overline{AC}$ gives triangles congruent by SAS, so $\\overline{AD}\\parallel\\overline{BC}$ as well.",
  },
  {
    key: "angles",
    tex: "$\\angle A\\cong\\angle C$ and $\\angle B\\cong\\angle D$",
    why: "Both pairs of opposite angles congruent: the four angles add to $360^\\circ$, so $m\\angle A+m\\angle B=180^\\circ$, and same-side interior angles that are supplementary make the sides parallel.",
  },
  {
    key: "definition",
    tex: "$\\overline{AB}\\parallel\\overline{CD}$ and $\\overline{AD}\\parallel\\overline{BC}$",
    why: "Both pairs of opposite sides parallel is the definition of a parallelogram.",
  },
] as const;
export const notEnoughFacts = [
  {
    key: "leg-base",
    tex: "$\\overline{AB}\\cong\\overline{CD}$ and $\\overline{AD}\\parallel\\overline{BC}$",
    why: "An isosceles trapezoid with bases $\\overline{AD}$ and $\\overline{BC}$ and congruent legs $\\overline{AB}$ and $\\overline{CD}$ fits, and it is not a parallelogram.",
    example: [
      [1, 3],
      [0, 0],
      [5, 0],
      [4, 3],
    ],
  },
  {
    key: "base-leg",
    tex: "$\\overline{AB}\\parallel\\overline{CD}$ and $\\overline{AD}\\cong\\overline{BC}$",
    why: "An isosceles trapezoid with bases $\\overline{AB}$ and $\\overline{CD}$ and congruent legs $\\overline{AD}$ and $\\overline{BC}$ fits, and it is not a parallelogram.",
    example: [
      [0, 0],
      [5, 0],
      [4, 3],
      [1, 3],
    ],
  },
  {
    key: "equal-diagonals",
    tex: "$\\overline{AC}\\cong\\overline{BD}$",
    why: "An isosceles trapezoid has congruent diagonals, and it is not a parallelogram.",
    example: [
      [0, 0],
      [5, 0],
      [4, 3],
      [1, 3],
    ],
  },
  {
    key: "one-side-pair",
    tex: "$\\overline{AB}\\cong\\overline{CD}$",
    why: "An isosceles trapezoid with congruent legs $\\overline{AB}$ and $\\overline{CD}$ fits, and it is not a parallelogram.",
    example: [
      [1, 3],
      [0, 0],
      [5, 0],
      [4, 3],
    ],
  },
  {
    key: "one-angle-pair",
    tex: "$\\angle A\\cong\\angle C$",
    why: "A kite with its line of symmetry through $B$ and $D$ has $\\angle A\\cong\\angle C$, and it is not a parallelogram.",
    example: [
      [-2, 0],
      [0, 3],
      [2, 0],
      [0, -1],
    ],
  },
  {
    key: "perpendicular",
    tex: "$\\overline{AC}\\perp\\overline{BD}$",
    why: "A kite has perpendicular diagonals, and it is not a parallelogram.",
    example: [
      [-2, 0],
      [0, 3],
      [2, 0],
      [0, -1],
    ],
  },
] as const;

function enoughRender(r: Random, l: Layout) {
  const L = lettersOf(l.set);
  const not = r(0, 1) === 1;
  const options: ChoiceOption[] = not
    ? [
        {
          label: pick(r, notEnoughFacts).tex,
          correct: true,
        },
        ...shuffle(r, [...enoughFacts]).map((f) => ({
          label: f.tex,
          feedback: `That fact is enough. ${f.why}`,
        })),
      ]
    : [
        { label: pick(r, enoughFacts.slice(0, 4)).tex, correct: true },
        ...shuffle(r, [...notEnoughFacts]).map((f) => ({
          label: f.tex,
          feedback: `Not enough. ${f.why}`,
        })),
      ];
  const all = [...enoughFacts, ...notEnoughFacts] as readonly {
    tex: string;
    why: string;
  }[];
  const correct = options[0]!;
  const s = choiceSurface(r, {
    prompt: relabel(
      `In quadrilateral $ABCD$, which one of these facts ${not ? "is not enough" : "is enough"}, on its own, to prove that $ABCD$ is a parallelogram?`,
      L,
    ),
    options: options.map((o) => ({
      ...o,
      label: relabel(o.label, L),
      ...(o.feedback ? { feedback: relabel(o.feedback, L) } : {}),
    })),
    hint: relabel(
      not
        ? "Try to draw a quadrilateral $ABCD$ that fits each fact but is not a parallelogram, such as an isosceles trapezoid or a kite. The fact you can do that for is not enough."
        : "For each fact, try to draw a quadrilateral $ABCD$ that fits it but is not a parallelogram, such as an isosceles trapezoid or a kite. Only one fact leaves no way to do that.",
      L,
    ),
    explanation: [
      "A fact is enough when every quadrilateral with that fact is a parallelogram. It is not enough when one counterexample exists: a quadrilateral that fits the fact and is not a parallelogram.",
      relabel(
        `${correct.label}: ${all.find((f) => f.tex === correct.label)!.why}`,
        L,
      ),
      not
        ? "Each other fact is a proved test for a parallelogram."
        : "Each other fact has a counterexample, an isosceles trapezoid or a kite.",
    ],
  });
  return s;
}

/* Counterexample figures: four small quadrilaterals in a two-by-two grid,
 * each marked only with what it is given. */
type Panel = {
  key: string;
  points: Point[];
  label: string;
  marks: {
    arrows?: [number, number][];
    ticks?: [number, number, number][];
    right?: boolean;
    diagonals?: boolean;
    diagonalTicks?: boolean;
    lengths?: [number, number, string][];
  };
  feedback: string;
};
type ClaimKey = "leg-base" | "equal-diagonals";
const claims: Record<ClaimKey, { claim: string; panels: Panel[] }> = {
  "leg-base": {
    claim:
      "If one pair of opposite sides of a quadrilateral is congruent and the other pair is parallel, the quadrilateral is a parallelogram.",
    panels: [
      {
        key: "isosceles-trapezoid",
        points: [
          [0, 0],
          [4, 0],
          [3, 2.4],
          [1, 2.4],
        ],
        label:
          "a quadrilateral with parallel bottom and top sides of lengths 4 and 2 and congruent left and right sides",
        marks: {
          arrows: [
            [0, 1],
            [3, 2],
          ],
          ticks: [
            [1, 2, 1],
            [3, 0, 1],
          ],
          lengths: [
            [0, 1, "4"],
            [2, 3, "2"],
          ],
        },
        feedback: "",
      },
      {
        key: "rectangle",
        points: [
          [0, 0],
          [4, 0],
          [4, 2.4],
          [0, 2.4],
        ],
        label:
          "a quadrilateral with four right angles, parallel top and bottom sides and congruent left and right sides",
        marks: {
          arrows: [
            [0, 1],
            [3, 2],
          ],
          ticks: [
            [1, 2, 1],
            [3, 0, 1],
          ],
          right: true,
        },
        feedback:
          "That figure fits the condition, but with four right angles it is a rectangle, which is a parallelogram. A counterexample must fit the condition and not be a parallelogram.",
      },
      {
        key: "kite",
        points: [
          [2, 0],
          [3.6, 1.7],
          [2, 2.6],
          [0.4, 1.7],
        ],
        label:
          "a quadrilateral whose two lower sides are congruent and whose two upper sides are congruent",
        marks: {
          ticks: [
            [0, 1, 1],
            [3, 0, 1],
            [1, 2, 2],
            [2, 3, 2],
          ],
        },
        feedback:
          "That figure has no pair of opposite sides marked congruent and no parallel sides, so it does not fit the condition. A counterexample must fit the condition.",
      },
      {
        key: "trapezoid",
        points: [
          [0, 0],
          [4.4, 0],
          [3.4, 2.4],
          [0.5, 2.4],
        ],
        label:
          "a quadrilateral with parallel top and bottom sides and left and right sides of different lengths",
        marks: {
          arrows: [
            [0, 1],
            [3, 2],
          ],
        },
        feedback:
          "That figure has parallel sides, but its other two sides are not congruent, so it does not fit the condition. A counterexample must fit the condition.",
      },
    ],
  },
  "equal-diagonals": {
    claim:
      "If the diagonals of a quadrilateral are congruent, the quadrilateral is a rectangle.",
    panels: [
      {
        key: "isosceles-trapezoid",
        points: [
          [0, 0],
          [4, 0],
          [3, 2.4],
          [1, 2.4],
        ],
        label:
          "a quadrilateral with parallel top and bottom sides of different lengths and two diagonals marked congruent",
        marks: {
          arrows: [
            [0, 1],
            [3, 2],
          ],
          diagonals: true,
          diagonalTicks: true,
        },
        feedback: "",
      },
      {
        key: "square",
        points: [
          [0.6, 0],
          [3.4, 0],
          [3.4, 2.8],
          [0.6, 2.8],
        ],
        label:
          "a quadrilateral with four congruent sides, four right angles and two diagonals marked congruent",
        marks: {
          ticks: [
            [0, 1, 1],
            [1, 2, 1],
            [2, 3, 1],
            [3, 0, 1],
          ],
          right: true,
          diagonals: true,
          diagonalTicks: true,
        },
        feedback:
          "That figure has congruent diagonals, but with four right angles it is a square, and a square is a rectangle. A counterexample must fit the condition and not be a rectangle.",
      },
      {
        key: "rhombus",
        points: [
          [2, 0],
          [3.8, 1.3],
          [2, 2.6],
          [0.2, 1.3],
        ],
        label:
          "a quadrilateral with four congruent sides and two diagonals of different lengths, not marked congruent",
        marks: {
          ticks: [
            [0, 1, 1],
            [1, 2, 1],
            [2, 3, 1],
            [3, 0, 1],
          ],
          diagonals: true,
        },
        feedback:
          "That figure's diagonals are not congruent, so it does not fit the condition. A counterexample must fit the condition.",
      },
      {
        key: "kite",
        points: [
          [2, 0],
          [3.6, 1.7],
          [2, 2.6],
          [0.4, 1.7],
        ],
        label:
          "a quadrilateral with two pairs of congruent neighboring sides and two diagonals of different lengths",
        marks: {
          ticks: [
            [0, 1, 1],
            [3, 0, 1],
            [1, 2, 2],
            [2, 3, 2],
          ],
          diagonals: true,
        },
        feedback:
          "That figure's diagonals are not congruent, so it does not fit the condition. A counterexample must fit the condition.",
      },
    ],
  },
};
export const counterexampleClaims = claims;

function panelScene(order: Panel[]): Scene {
  const els: Element[] = [];
  const names: LabelSpec[] = [];
  const lengths: LabelSpec[] = [];
  const corners: Point[] = [];
  order.forEach((panel, i) => {
    const dx = (i % 2) * 6;
    const dy = i < 2 ? 0 : -4.6;
    const P = panel.points.map(([x, y]) => [x! + dx, y! + dy] as Point);
    const id = `f${i + 1}`;
    els.push({
      type: "polygon",
      id: `${id}q`,
      points: P,
      fill: "none",
      stroke: "ink",
      width: 2.25,
    });
    const m = panel.marks;
    if (m.diagonals)
      els.push(
        figureSegment(`${id}d1`, P[0]!, P[2]!, {
          stroke: "accent",
          width: 1.75,
        }),
        figureSegment(`${id}d2`, P[1]!, P[3]!, {
          stroke: "accent",
          width: 1.75,
        }),
      );
    if (m.diagonalTicks) {
      const at = (a: Point, b: Point, k: number): Point => [
        a[0] + (b[0] - a[0]) * k,
        a[1] + (b[1] - a[1]) * k,
      ];
      els.push(
        ...figureTicks(`${id}e1`, P[0]!, at(P[0]!, P[2]!, 0.5), 1),
        ...figureTicks(`${id}e2`, P[1]!, at(P[1]!, P[3]!, 0.5), 1),
      );
    }
    for (const [a, b] of m.arrows ?? [])
      els.push(...figureParallelMark(`${id}p${a}${b}`, P[a]!, P[b]!, 1, 0.5));
    for (const [a, b, n] of m.ticks ?? [])
      els.push(...figureTicks(`${id}t${a}${b}`, P[a]!, P[b]!, n));
    if (m.right)
      for (let v = 0; v < 4; v++)
        els.push(
          figureRightMark(
            `${id}r${v}`,
            P[v]!,
            P[(v + 1) % 4]!,
            P[(v + 3) % 4]!,
            0.28,
          ),
        );
    const cx = P.reduce((s, p) => s + p[0], 0) / 4;
    const cy = P.reduce((s, p) => s + p[1], 0) / 4;
    // Each figure's name sits under it; a length sits beside its side,
    // inside the shape when the name takes the room below.
    names.push({
      id: `${id}n`,
      text: `Figure ${i + 1}`,
      at: [cx, dy],
      out: [0, -1],
      font: "sans",
      size: "sm",
      bold: true,
    });
    for (const [a, b, text] of m.lengths ?? []) {
      const mx = (P[a]![0] + P[b]![0]) / 2;
      const my = (P[a]![1] + P[b]![1]) / 2;
      lengths.push({
        id: `${id}l${a}${b}`,
        text,
        at: [mx, my],
        out: [0, my < cy ? -1 : 1],
        size: "sm",
        halo: true,
      });
    }
    corners.push(...P);
  });
  els.push(
    ...placeLabels([...names, ...lengths], strokesOf(els), extentOf(corners)),
  );
  return figureScene(
    "Four quadrilaterals, Figure 1 to Figure 4, each marked with what it is given",
    els,
  );
}

function counterexampleRender(r: Random) {
  const key = pick(r, Object.keys(claims) as ClaimKey[]);
  const c = claims[key];
  const order = shuffle(r, [...c.panels]);
  const at = order.findIndex((p) => p.feedback === "");
  return ordered({
    prompt: `Taylor claims: “${c.claim}” Which figure is a counterexample to Taylor's claim?`,
    choices: order.map((p, i) => ({
      label: `Figure ${i + 1}`,
      correct: i === at,
      feedback: p.feedback,
    })),
    hint:
      key === "leg-base"
        ? "A counterexample to this claim needs one pair of sides marked congruent and the other pair marked parallel, and it must not be a parallelogram. Check each of the 4 figures for both."
        : "A counterexample to this claim needs diagonals marked congruent, and it must not be a rectangle. Check each of the 4 figures for both.",
    explanation: [
      "A counterexample must pass two tests: it fits the if-part of the claim, and it breaks the then-part.",
      ...order.map(
        (p, i) =>
          `Figure ${i + 1} is ${p.label}. ${p.feedback || (key === "leg-base" ? "It fits the if-part, and because its parallel sides have different lengths (4 and 2), it is not a parallelogram: it is an isosceles trapezoid, the counterexample." : "It fits the if-part, and because its parallel sides have different lengths, it is not a parallelogram, so it is not a rectangle: it is an isosceles trapezoid, the counterexample.")}`,
      ),
    ],
    figure: sceneFigure(panelScene(order)),
  });
}

/* Correct and complete explanations. */
type ExplanationTask = {
  question: string;
  proof: ProofId;
  options: { text: string; feedback: string }[];
};
const explanationTasks: Record<
  "rectangle-diagonals" | "bisecting-diagonals",
  ExplanationTask
> = {
  "rectangle-diagonals": {
    question: "Why are the diagonals of rectangle $ABCD$ congruent?",
    proof: "f",
    options: [
      {
        text: "$ABCD$ is a parallelogram, so $\\overline{AD}\\cong\\overline{BC}$. The right angles $\\angle DAB$ and $\\angle CBA$ are congruent, and $\\overline{AB}$ is shared. So $\\triangle DAB\\cong\\triangle CBA$ by SAS, and $\\overline{DB}\\cong\\overline{CA}$ by CPCTC.",
        feedback: "",
      },
      {
        text: "The sides of a rectangle are perpendicular, so its diagonals must match.",
        feedback:
          "That explanation restates the claim. It names no congruent triangles and no congruence criterion, so nothing shows the diagonals are congruent.",
      },
      {
        text: "$\\overline{AD}\\cong\\overline{BC}$ and $\\overline{AB}$ is shared, so $\\triangle DAB\\cong\\triangle CBA$ by SSS, and $\\overline{DB}\\cong\\overline{CA}$.",
        feedback:
          "SSS would need $\\overline{DB}\\cong\\overline{CA}$, the very fact being explained. The right angles make it SAS.",
      },
      {
        text: "In the figure, both diagonals measure the same length with a ruler.",
        feedback:
          "A measurement checks one drawing; it does not show that the diagonals of every rectangle are congruent.",
      },
    ],
  },
  "bisecting-diagonals": {
    question:
      "Why do the diagonals of parallelogram $ABCD$, which meet at $E$, bisect each other?",
    proof: "c",
    options: [
      {
        text: "$\\overline{AB}\\parallel\\overline{DC}$ gives alternate interior angles $\\angle BAE\\cong\\angle DCE$ and $\\angle ABE\\cong\\angle CDE$, and $\\overline{AB}\\cong\\overline{CD}$. So $\\triangle ABE\\cong\\triangle CDE$ by ASA, and $\\overline{AE}\\cong\\overline{CE}$ and $\\overline{BE}\\cong\\overline{DE}$ by CPCTC.",
        feedback: "",
      },
      {
        text: "$E$ is the center of the parallelogram, so it must be the midpoint of each diagonal.",
        feedback:
          "That explanation restates the claim: being the center is what needs proof. It names no congruent triangles.",
      },
      {
        text: "$\\overline{AB}\\cong\\overline{CD}$ and $\\angle AEB\\cong\\angle CED$, so $\\triangle ABE\\cong\\triangle CDE$ by SAS, and so $\\overline{AE}\\cong\\overline{CE}$.",
        feedback:
          "SAS needs two pairs of sides with the angle between them. Here only one pair of sides is known, and the vertical angle is not between two known sides.",
      },
      {
        text: "In the figure, $E$ looks like the midpoint of both diagonals, so they bisect each other.",
        feedback:
          "How a drawing looks is not a reason; it does not show the fact for every parallelogram.",
      },
    ],
  },
};
type ExplanationKey = keyof typeof explanationTasks | "converse";

function explanationRender(r: Random, l: Layout) {
  const key = pick(r, [
    "rectangle-diagonals",
    "bisecting-diagonals",
    "converse",
  ] as ExplanationKey[]);
  const L = lettersOf(l.set);
  if (key === "converse") {
    return choiceSurface(r, {
      prompt:
        "The diagonals of every rectangle are congruent. Does that mean a quadrilateral with congruent diagonals must be a rectangle?",
      options: [
        {
          label:
            "No: an isosceles trapezoid has congruent diagonals but is not a rectangle.",
          correct: true,
        },
        {
          label: "Yes: the converse of a true theorem is always true.",
          feedback:
            "A converse is a different claim and needs its own proof. This one is false: an isosceles trapezoid is a counterexample.",
        },
        {
          label: "No: a square also has congruent diagonals.",
          feedback:
            "A square is a rectangle, so it fits both parts of the converse and is not a counterexample.",
        },
        {
          label: "Yes: congruent diagonals always force four right angles.",
          feedback:
            "Only inside a parallelogram do congruent diagonals force right angles. An isosceles trapezoid has congruent diagonals and no right angles.",
        },
      ],
      hint: "The converse swaps the if-part and the then-part. To show it false, look for a quadrilateral whose diagonals are congruent but which has no right angles.",
      explanation: [
        "The theorem says: if a quadrilateral is a rectangle, its diagonals are congruent. The converse says: if the diagonals are congruent, it is a rectangle.",
        "A converse needs its own proof, and this one is false. An isosceles trapezoid has congruent diagonals, because its two halves are mirror images, but its angles are not right angles.",
        "Inside a parallelogram the converse does hold: a parallelogram with congruent diagonals is a rectangle.",
      ],
    });
  }
  const task = explanationTasks[key];
  const order = shuffle(r, [...task.options]);
  const p = proofs[task.proof];
  return ordered({
    prompt: relabel(
      `${task.question} Which explanation is correct and complete?\n${order.map((o, i) => `Explanation ${i + 1}: ${o.text}`).join("\n")}`,
      L,
    ),
    choices: order.map((o, i) => ({
      label: `Explanation ${i + 1}`,
      correct: o.feedback === "",
      feedback: relabel(o.feedback, L),
    })),
    hint: relabel(
      key === "rectangle-diagonals"
        ? "Of the 4 explanations, look for one that names two triangles that contain the diagonals $\\overline{DB}$ and $\\overline{CA}$, proves them congruent with a criterion whose parts are all known, and then uses CPCTC."
        : "Of the 4 explanations, look for one that proves $\\triangle ABE\\cong\\triangle CDE$ with a criterion whose parts are all known, before using CPCTC on $\\overline{AE}$ and $\\overline{CE}$.",
      L,
    ),
    explanation: [
      "A complete explanation names two congruent triangles, proves them congruent with a criterion whose parts are all known, and then uses CPCTC.",
      ...order.map((o, i) =>
        relabel(
          `Explanation ${i + 1}: ${o.feedback || "Correct and complete: every fact it uses is known, the criterion fits its parts, and CPCTC gives the claim."}`,
          L,
        ),
      ),
      "The proof in two columns:",
      ...proofLines(p, L),
    ],
    figure: sceneFigure(figure(p, { ...l, s: p.id === "f" ? 0 : l.s })),
  });
}

/* ------------------------------------------------------------ families */

const fillFamily = chainFamily({
  template: parallelogramProofTemplates[0]!,
  axes: {
    fill: defineAxis("fill", ["reasons", "statement"] as const, {
      weights: [7, 3],
    }),
  },
  model: (r, axes) => {
    const ids =
      axes.fill === "statement"
        ? proofIds.filter(
            (id) => Object.keys(proofs[id].statementBlanks).length,
          )
        : proofIds;
    const proof = pick(r, ids);
    return {
      proof,
      layout: drawLayout(r, proof === "f" || proof === "g"),
    };
  },
  render: (m, axes, r) => fillRender(r, proofs[m.proof], m.layout, axes.fill),
  variant: (m) => `proof-${m.proof}`,
});

const orderFamily = chainFamily({
  template: parallelogramProofTemplates[1]!,
  axes: {
    proof: defineAxis("proof", proofIds),
  },
  model: (r, axes) => ({
    proof: axes.proof,
    layout: drawLayout(r, axes.proof === "f" || axes.proof === "g"),
  }),
  render: (m, _axes, r) => orderRender(r, proofs[m.proof], m.layout),
  variant: (m) => `proof-${m.proof}`,
});

const tasks = [
  ...flawIds.map((f) => `flaw-${f}` as const),
  "enough",
  "counterexample",
  "explanation",
] as const;
type Task = (typeof tasks)[number];
const reasoningFamily = chainFamily({
  template: parallelogramProofTemplates[2]!,
  axes: {
    // The four kinds of task are equally likely; a flaw kind is one fifth
    // of the find-the-flaw share.
    task: defineAxis("task", tasks, {
      weights: tasks.map((x) => (x.startsWith("flaw-") ? 1 : 5)),
    }),
  },
  model: (r, axes) => ({
    task: axes.task as Task,
    layout: drawLayout(r, false),
  }),
  render: (m, _axes, r) => {
    if (m.task.startsWith("flaw-")) {
      const flaw = m.task.slice(5) as Flaw;
      const rect = flawCases[flaw].some((c) => c.proof === "g");
      return flawRender(r, flaw, rect ? { ...m.layout, s: 0 } : m.layout);
    }
    if (m.task === "enough") return enoughRender(r, m.layout);
    if (m.task === "counterexample") return counterexampleRender(r);
    return explanationRender(r, m.layout);
  },
  variant: (m) => m.task,
});

export const parallelogramProofGenerate = dispatch(
  parallelogramProofTemplates,
  {
    "parallelogram-proof-fill": (seed) => fillFamily.generate(seed).problem,
    "parallelogram-proof-order": (seed) => orderFamily.generate(seed).problem,
    "parallelogram-converse-reasoning": (seed) =>
      reasoningFamily.generate(seed).problem,
  },
);
export const parallelogramProofCases = {
  "parallelogram-proof-fill": fillFamily.generate,
  "parallelogram-proof-order": orderFamily.generate,
  "parallelogram-converse-reasoning": reasoningFamily.generate,
};
