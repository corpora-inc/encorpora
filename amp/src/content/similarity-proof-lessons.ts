import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "similarity-proof-aa",
    title: "Prove triangles similar by AA and write the proportion",
    goal: "Prove two triangles similar (the same shape) from two pairs of equal angles, then write matching sides as equal fractions.",
    summary:
      "Two triangles are called similar when they have the same shape, though maybe not the same size. If two angles of one triangle equal two angles of the other, the triangles are similar. This test is called AA, short for angle-angle. Then each side divided by its matching side gives the same number. An equation of equal fractions like this is called a proportion.",
    senses: {
      similar: "similar-figures",
      side: "side",
      vertex: "vertex",
      degrees: "degree-angle",
      "corresponding angles": "corresponding-angles",
    },
    noLink: ["third", "factor", "opposite", "rule", "square", "prime"],
    objectives: [
      "Find two pairs of congruent (equal) angles from perpendicular segments, parallel lines or a shared angle, and give a reason for each.",
      "Conclude that the triangles are similar by AA, and write the proportion of matching sides with the vertices in order.",
    ],
    background: [
      {
        title: "Similar triangles",
        paragraphs: [
          "Two triangles are similar when one is a scaled copy of the other. Every length is multiplied by the same number, called the scale factor, and every angle stays the same. A photo and its enlargement are similar. The symbol $\\sim$ means is similar to, and $\\triangle$ means triangle.",
          "The three angles of every triangle add to $180^\\circ$. So if two angles match, the third angles match too: each is $180^\\circ$ minus the same two numbers. Angles of $50^\\circ$ and $60^\\circ$ leave $70^\\circ$ in both triangles. Two matching pairs of angles are therefore enough. This is the AA test.",
          "In $\\triangle ADE\\sim\\triangle ABC$, the letters pair up in order: $A$ with $A$, $D$ with $B$, and $E$ with $C$. Matching corners (vertices) are called corresponding vertices. Side $AD$ matches side $AB$, because their end letters match. Write $AD$ for the length of side $AD$. Then each length divided by its partner gives the same number: $\\frac{AD}{AB}=\\frac{AE}{AC}=\\frac{DE}{BC}$.",
        ],
      },
      {
        title: "Where equal angles come from",
        paragraphs: [
          "Segments are straight pieces of lines. Perpendicular segments are segments that meet at a right angle, a square corner of $90^\\circ$. Any two right angles are equal.",
          "Parallel lines are lines that never meet. When another line crosses two parallel lines, angles in the same position at the two crossings are equal. These are called corresponding angles.",
          "An angle that both triangles share is equal to itself. This is called the reflexive property, and it can be a reason in a proof.",
        ],
      },
    ],
    intuition:
      "Two triangles are called similar when they have the same shape: one is a scaled copy of the other, with equal angles. We write $\\sim$ for is similar to. A triangle's three angles add to $180^\\circ$. So if two angles match, the third must match too, and the triangles are similar. This is the AA (angle-angle) test. Equal angles come from right angles, where perpendicular segments meet at $90^\\circ$. They also come from corresponding angles, where a line crosses two parallel lines, or from an angle both triangles share. A proof collects two such pairs one line at a time and states the similarity. Only then does it write the ratio of sides: one length divided by its matching length.",
    terms: ["similar-figures", "aa-similarity", "corresponding"],
    method: [
      "Write the givens first, each with the reason Given.",
      "Add one line for each pair of congruent angles: right angles from perpendicular segments, corresponding angles from parallel lines, or the angle both triangles share (reflexive property).",
      "State the similarity with the vertices in matching order, and give the reason AA.",
      "Write the proportion of matching sides, taking each fraction from the order of the similarity statement. The reason: corresponding sides of similar triangles are proportional.",
    ],
    watch:
      "The order of the letters is the matching. $\\triangle ADE\\sim\\triangle ABC$ matches $D$ with $B$ and $E$ with $C$. So $\\frac{AD}{AB}$ compares matching sides, and $\\frac{AD}{AC}$ does not.",
    principle:
      "Write $P'$, read “$P$ prime”, for the point that matches $P$. If $\\angle P\\cong\\angle P'$ and $\\angle Q\\cong\\angle Q'$, then $\\triangle PQR\\sim\\triangle P'Q'R'$. Corresponding sides satisfy $\\frac{PQ}{P'Q'}=\\frac{QR}{Q'R'}=\\frac{PR}{P'R'}$. A proof is valid when each line is a given or follows by its reason from lines above.",
    example: {
      prompt:
        "In triangle $ABC$, $D$ is on $\\overline{AB}$ and $E$ is on $\\overline{AC}$, with $\\overline{DE}\\parallel\\overline{BC}$. Prove $\\frac{AD}{AB}=\\frac{AE}{AC}$.",
      steps: [
        "1. $\\overline{DE}\\parallel\\overline{BC}$ — Given.",
        "2. $\\angle ADE\\cong\\angle ABC$ — Corresponding angles of parallel lines are congruent. Line $AB$ crosses both parallel segments, and these angles hold the same position at $D$ and at $B$.",
        "3. $\\angle AED\\cong\\angle ACB$ — Corresponding angles of parallel lines are congruent. This time line $AC$ crosses both, at $E$ and at $C$.",
        "4. $\\triangle ADE\\sim\\triangle ABC$ — AA. Lines 2 and 3 give two pairs of equal angles, and the letters follow the matches: $D$ with $B$, $E$ with $C$.",
        "5. $\\frac{AD}{AB}=\\frac{AE}{AC}$ — Corresponding sides of similar triangles are proportional. $AD$ matches $AB$, and $AE$ matches $AC$.",
      ],
      answer: "$\\frac{AD}{AB}=\\frac{AE}{AC}$ by AA similarity",
    },
    methodTitle: "Find the second pair of angles",
    methodText: [
      "Look for an angle both triangles share. It gives one pair for free, with the reason reflexive property: an angle equals itself.",
      "Then one more pair is enough. It can be a right angle in each triangle, from perpendicular segments, or a corresponding angle at a parallel line.",
    ],
    formal:
      "A dilation is a resizing: it multiplies every length by one number and keeps every angle. Two triangles with two congruent angle pairs also have a congruent third pair. A dilation followed by a rigid motion (a slide, turn or flip) then maps one triangle exactly onto the other. So every ratio of corresponding sides equals that one number.",
    pitfalls: [
      "Write the similarity statement with matching vertices in order. A swapped pair gives the wrong fractions.",
      "Write the proportion of matching sides only after the similarity is stated on an earlier line, because its reason depends on that line.",
    ],
    parentGuide:
      "Ask your learner which two angles they will match first. Then ask which letters of the similarity statement line up.",
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
