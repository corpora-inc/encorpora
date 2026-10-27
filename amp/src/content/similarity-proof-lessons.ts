import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "similarity-proof-aa",
    title: "Prove triangles similar by AA and write the proportion",
    summary:
      "Two pairs of congruent angles make triangles similar (AA); then every pair of corresponding sides is in the same ratio.",
    objectives: [
      "Find two pairs of congruent angles from perpendicular segments, parallel lines or a shared angle, and justify each.",
      "Conclude similarity by AA and write the proportion of corresponding sides, matching the vertices in order.",
    ],
    intuition:
      "Triangles with the same angles have the same shape, one a scaled copy of the other. Two angles are enough, because the third angle is what is left of $180^\\circ$. A proof collects those two pairs of angles one line at a time, states the similarity, and only then reads off the ratio of sides.",
    terms: [
      [
        "similar triangles",
        "Triangles whose corresponding angles are congruent and whose corresponding sides are in the same ratio.",
      ],
      [
        "AA",
        "If two angles of one triangle are congruent to two angles of another, the triangles are similar.",
      ],
      [
        "corresponding sides",
        "Sides that join corresponding vertices, such as $AD$ and $AB$ when $A$ matches $A$ and $D$ matches $B$.",
      ],
    ],
    method: [
      "Write the givens first, each with the reason Given.",
      "Add one line for each pair of congruent angles: right angles from perpendicular segments, corresponding angles from parallel lines, or the angle both triangles share (reflexive property).",
      "State the similarity with the vertices in matching order, and give the reason AA.",
      "Write the proportion of corresponding sides, taking each ratio from the order of the similarity statement, with the reason that corresponding sides of similar triangles are proportional.",
    ],
    watch:
      "The order of the letters is the correspondence. $\\triangle ADE\\sim\\triangle ABC$ matches $D$ with $B$ and $E$ with $C$, so $\\frac{AD}{AB}$ is a ratio of corresponding sides and $\\frac{AD}{AC}$ is not.",
    principle:
      "If $\\angle P\\cong\\angle P'$ and $\\angle Q\\cong\\angle Q'$ then $\\triangle PQR\\sim\\triangle P'Q'R'$, and corresponding sides satisfy $\\frac{PQ}{P'Q'}=\\frac{QR}{Q'R'}=\\frac{PR}{P'R'}$. A proof is valid when each line is a given or follows by its reason from lines above.",
    example: {
      prompt:
        "In triangle $ABC$, $D$ is on $\\overline{AB}$ and $E$ is on $\\overline{AC}$, with $\\overline{DE}\\parallel\\overline{BC}$. Prove $\\frac{AD}{AB}=\\frac{AE}{AC}$.",
      steps: [
        "1. $\\overline{DE}\\parallel\\overline{BC}$ — Given.",
        "2. $\\angle ADE\\cong\\angle ABC$ — Corresponding angles of parallel lines are congruent.",
        "3. $\\angle AED\\cong\\angle ACB$ — Corresponding angles of parallel lines are congruent.",
        "4. $\\triangle ADE\\sim\\triangle ABC$ — AA.",
        "5. $\\frac{AD}{AB}=\\frac{AE}{AC}$ — Corresponding sides of similar triangles are proportional.",
      ],
      answer: "$\\frac{AD}{AB}=\\frac{AE}{AC}$ by AA similarity",
    },
    methodTitle: "Find the second pair of angles",
    methodText: [
      "Look for an angle both triangles share. It is one pair for free, justified by the reflexive property.",
      "Then one more pair is enough: a right angle in each triangle from perpendicular segments, or a corresponding angle at a parallel line.",
    ],
    formal:
      "A dilation preserves angles and multiplies lengths by one factor. Two triangles with two congruent angle pairs also have a third congruent pair, and a dilation followed by a rigid motion maps one onto the other, so all corresponding side ratios equal that factor.",
    pitfalls: [
      "Write the similarity statement with matching vertices in order; a swapped pair gives the wrong ratios.",
      "A proportion is a reason only after the similarity is stated on an earlier line.",
    ],
    parentGuide:
      "Ask your learner which two angles they will match first, and which letters of the similarity statement line up.",
  },
];

export const similarityProofContent = workContent(entries);

export const similarityProofFacetMappings: FacetMapping[] = [
  {
    templateId: "similarity-proof-aa",
    facetId: "similarity-proofs.HSG.SRT.B.5",
    extent: "partial",
    rationale:
      "A two-column proof of AA similarity and one proportion of corresponding sides, built from statement and reason banks that include out-of-order and false statements, filled in or ordered; any valid proof is accepted. Four configurations: a segment perpendicular to a leg of a right triangle, the altitude to the hypotenuse, a segment parallel to a side, and two perpendiculars to the base of an isosceles triangle (base angles, then a rearranged proportion). Does not assess proofs written freely without banks, SAS or SSS similarity, or proofs of the Pythagorean theorem.",
  },
];
