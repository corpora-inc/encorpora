import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "two-column-congruence-proof",
    title: "Prove triangles congruent in two columns",
    summary:
      "A two-column proof pairs each statement with its reason, and a reason may use only the givens and the lines above it.",
    objectives: [
      "Choose the statements that lead from the givens to a triangle congruence, in an order where each one is already justified.",
      "Justify each statement with a definition, a theorem or a congruence criterion (SSS, SAS, ASA, AAS), and finish with the statement to prove.",
    ],
    intuition:
      "A congruence criterion needs three matching parts, such as two sides and the angle between them (SAS). A proof gathers those parts one line at a time: the givens first, then the parts the givens imply (a midpoint gives two equal segments, parallel lines give equal alternate interior angles, crossing lines give vertical angles), then the criterion that combines them.",
    terms: [
      [
        "included angle",
        "The angle formed by two sides of a triangle; SAS needs the angle between the two sides.",
      ],
      [
        "CPCTC",
        "Corresponding parts of congruent triangles are congruent: once the triangles are proved congruent, their matching sides and angles are too.",
      ],
      [
        "reflexive property",
        "A segment or angle is congruent to itself, as when two triangles share a side.",
      ],
    ],
    method: [
      "Mark the givens on the figure and decide which three pairs of parts the triangles share: sides, angles, or both.",
      "Write the givens first, each with the reason Given.",
      "Add one line for each pair of parts the givens imply, with the definition or theorem that implies it.",
      "End with the congruence statement and the criterion whose three parts are on the lines above. Name the vertices in matching order.",
    ],
    watch:
      "Match the vertices in order: if $A$ corresponds to $C$ and $B$ to $D$, write $\\triangle ABE\\cong\\triangle CDE$, not $\\triangle ABE\\cong\\triangle DCE$.",
    principle:
      "Two triangles are congruent when three pairs of parts match in one of the patterns SSS, SAS, ASA or AAS. A proof is valid when every statement is a given or follows, by its stated reason, from statements above it; the last statement is the claim.",
    example: {
      prompt:
        "Segments $\\overline{AD}$ and $\\overline{BC}$ cross at $E$, the midpoint of both. Prove $\\triangle ABE\\cong\\triangle DCE$.",
      steps: [
        "1. $E$ is the midpoint of $\\overline{AD}$ — Given.",
        "2. $E$ is the midpoint of $\\overline{BC}$ — Given.",
        "3. $\\overline{AE}\\cong\\overline{DE}$ — Definition of midpoint (from line 1).",
        "4. $\\overline{BE}\\cong\\overline{CE}$ — Definition of midpoint (from line 2).",
        "5. $\\angle AEB\\cong\\angle DEC$ — Vertical angles are congruent.",
        "6. $\\triangle ABE\\cong\\triangle DCE$ — SAS (lines 3, 5, 4).",
      ],
      answer: "$\\triangle ABE\\cong\\triangle DCE$ by SAS",
    },
    methodTitle: "Work backward from the criterion",
    methodText: [
      "Ask which criterion fits the parts you can reach. Equal segments from midpoints plus vertical angles point to SAS; parallel sides give angle pairs that point to ASA or AAS.",
      "Lines with no prerequisites, such as vertical angles or a shared side, can go anywhere before the line that uses them.",
    ],
    formal:
      "SSS, SAS, ASA and AAS each guarantee a rigid motion carrying one triangle onto the other. SSA does not: two different triangles can share two sides and a non-included angle. A statement proved by CPCTC must come after the congruence it uses.",
    pitfalls: [
      "SAS needs the angle between the two sides.",
      "Do not use CPCTC before the triangles are proved congruent.",
      "List the vertices of both triangles in corresponding order.",
    ],
    parentGuide:
      "Point to any line of your learner's proof and ask which earlier lines the reason uses.",
  },
  {
    id: "two-column-angle-proof",
    title: "Prove angle relationships with parallel lines",
    summary:
      "Vertical angles, corresponding angles and linear pairs connect the eight angles at a transversal; chains of them prove the rest.",
    objectives: [
      "Prove two angles congruent, or supplementary, by chaining vertical, corresponding and linear-pair relationships.",
      "Prove two lines parallel from congruent angles using the converse of the corresponding angles theorem.",
    ],
    intuition:
      "When a transversal crosses two parallel lines, the two crossings look the same: each angle at one crossing has a match, its corresponding angle, at the other. At one crossing, opposite angles are vertical and equal, and side-by-side angles form a straight line, adding to $180^\\circ$. Every other relationship is a chain of these.",
    terms: [
      [
        "corresponding angles",
        "Angles in the same position at the two crossings, such as both above the line and left of the transversal.",
      ],
      [
        "linear pair",
        "Two angles side by side whose outer rays form a straight line; their measures add to $180^\\circ$.",
      ],
      [
        "transitive property",
        "If $\\angle 1\\cong\\angle 2$ and $\\angle 2\\cong\\angle 3$, then $\\angle 1\\cong\\angle 3$.",
      ],
    ],
    method: [
      "Locate the two angles: same crossing or different crossings, which side of the transversal, above or below each line.",
      "Find a middle angle that relates to both: vertical to one and corresponding to the other, or a linear pair with one and corresponding to the other.",
      "Write the given, then one line for each relationship with its reason.",
      "Combine them: the transitive property for congruence, or substitution and the definition of supplementary angles for a sum of $180^\\circ$.",
    ],
    watch:
      "Corresponding angles are congruent only when the lines are parallel; to prove lines parallel, use the converse, which starts from congruent angles.",
    principle:
      "Vertical angles are congruent and linear pairs are supplementary for any two crossing lines. If two lines are parallel, corresponding angles are congruent; conversely, if corresponding angles are congruent, the lines are parallel. Alternate interior, alternate exterior and same-side interior relationships follow from these.",
    example: {
      prompt:
        "Lines $\\ell$ and $m$ are cut by transversal $t$, with angles numbered as in the figure, and $\\ell\\parallel m$. Prove $\\angle 3\\cong\\angle 6$.",
      steps: [
        "1. $\\ell\\parallel m$ — Given.",
        "2. $\\angle 3\\cong\\angle 2$ — Vertical angles are congruent.",
        "3. $\\angle 2\\cong\\angle 6$ — Corresponding angles of parallel lines are congruent.",
        "4. $\\angle 3\\cong\\angle 6$ — Transitive property of congruence.",
      ],
      answer: "$\\angle 3\\cong\\angle 6$",
    },
    methodTitle: "Two routes, one proof",
    methodText: [
      "Going through the other middle angle works too: $\\angle 3\\cong\\angle 7$ (corresponding) and $\\angle 7\\cong\\angle 6$ (vertical).",
      "For a supplementary pair, write the linear pair's sum, replace one angle by its congruent corresponding angle (substitution), then state the definition of supplementary angles.",
    ],
    formal:
      "These proofs show the alternate interior, alternate exterior and same-side interior angle theorems from two facts: the corresponding angles postulate and its converse. Each chain uses only relationships that hold at a single crossing (vertical angles, linear pairs) and one corresponding pair.",
    pitfalls: [
      "Check that a corresponding pair is in the same position at both crossings.",
      "Do not assume the lines are parallel when that is what you are proving.",
    ],
    parentGuide:
      "Ask your learner to point to the middle angle in their proof and say how it relates to each of the other two.",
  },
];

export const twoColumnProofContent = workContent(entries);

export const twoColumnProofFacetMappings: FacetMapping[] = [
  {
    templateId: "two-column-congruence-proof",
    facetId: "congruence-criteria.HSG.SRT.B.5",
    extent: "partial",
    rationale:
      "Complete two-column triangle congruence proofs built from statement and reason banks: parallel congruent sides with alternate interior and vertical angles (ASA or AAS, optionally CPCTC), a quadrilateral with one pair of sides parallel and congruent, a shared midpoint with vertical angles, an angle bisector or kite with a shared side, and a perpendicular bisector. Every line is checked against the lines above it, and any valid proof is accepted. Does not assess free-form written proofs or similarity proofs.",
  },
  {
    templateId: "two-column-congruence-proof",
    facetId: "congruence-criteria.HSG.CO.B.8",
    extent: "partial",
    rationale:
      "Each proof ends with a congruence justified by SSS, SAS, ASA or AAS whose three pairs of parts must be stated on earlier lines; SAS needs the included angle. Explaining the criteria through rigid motions is not assessed.",
  },
  {
    templateId: "two-column-angle-proof",
    facetId: "line-angle-proofs.HSG.CO.C.9",
    extent: "partial",
    rationale:
      "Two-column proofs that alternate interior or exterior angles are congruent, that same-side interior angles are supplementary, and that lines are parallel when alternate exterior angles are congruent, from vertical, corresponding and linear-pair relationships; any valid chain is accepted. Perpendicular bisector proofs are not in this family.",
  },
];
