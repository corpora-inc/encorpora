import { workContent } from "./structured-work-lesson-kit";

export const triangleTheoremProofContent = workContent([
  {
    id: "two-column-triangle-proof",
    title: "Prove triangle relationships",
    goal: "Build a proof from given facts, with a reason for each new statement.",
    summary:
      "A proof explains why a claim must follow from the facts given. Split a figure into triangles that match exactly. Once they match, their corresponding sides and angles match too. For midpoint and median proofs, use these matches to build a parallelogram, a quadrilateral whose opposite sides are parallel.",
    objectives: [
      "Prove the equal base angles of a triangle with two equal sides, and prove the converse.",
      "Prove midpoint, median and perpendicular-bisector relationships without assuming the conclusion.",
    ],
    intuition:
      "Two triangles are congruent when they have the same size and shape. Three matching parts can establish this: three sides (SSS), two sides and their included angle (SAS), or two angles and a side (ASA or AAS). Then every corresponding part matches. A proof writes this chain in order, with the supporting facts before the statement that uses them.",
    terms: [
      "congruent",
      "midpoint",
      "median-triangle",
      "perpendicular-bisector",
    ],
    senses: { median: "median-triangle", medians: "median-triangle" },
    method: [
      "Identify the claim to prove and the facts given. Mark shared sides and equal parts supplied by a midpoint or angle bisector.",
      "Choose a congruence test from those facts. Put supporting statements before the triangle-congruence statement. Then use corresponding parts of congruent triangles, abbreviated CPCTC.",
      "For a midpoint or median argument, use the proved matches to establish a parallelogram. Then apply its opposite-side or diagonal properties.",
      "For an exactly-if claim, prove both directions. A statement's contrapositive is the same implication, so it does not replace the converse.",
    ],
    watch:
      "The theorem you are proving cannot be a reason in its own proof. An angle bisector divides an angle equally; it does not by definition make a perpendicular line.",
    principle:
      "A valid proof uses only givens, definitions and established results. SSS, SAS, ASA or AAS establish congruence; corresponding parts then agree. One pair of opposite sides both equal and parallel establishes a parallelogram, whose diagonals bisect each other.",
    example: {
      prompt:
        "Triangle $ABC$ has $AB=AC$. Segment $AD$ bisects angle $BAC$. Prove angle $B$ equals angle $C$.",
      steps: [
        "$AB=AC$ is given.",
        "$\\angle BAD=\\angle CAD$ by the definition of angle bisector.",
        "$AD=AD$ because the side is shared.",
        "$\\triangle BAD\\cong\\triangle CAD$ by SAS.",
        "$\\angle B=\\angle C$ because corresponding parts of congruent triangles agree.",
      ],
      answer: "$\\angle B\\cong\\angle C$",
    },
    methodTitle: "Build the argument in justified steps",
    methodText: [
      "A midpoint divides a segment into two equal lengths. An angle bisector divides an angle into two equal angles. Use the definition that matches the actual given.",
      "For a perpendicular bisector, equal halves and the shared perpendicular give SAS. Conversely, equal endpoint distances give SSS; equal adjacent angles totaling 180° must each be 90°.",
      "For a triangle midsegment, extend it by its own length and prove the added triangle congruent. The resulting parallelogram shows that the midsegment is parallel to the third side and half its length.",
      "For medians, join midpoints in the original triangle and in the triangle formed by two medians. Equal parallel midsegments make a parallelogram. Its bisected diagonals give the two-to-one ratio. Repeating the argument forces the third median through the same point.",
    ],
    formal:
      "An isosceles triangle has congruent base angles, and the converse holds. A segment joining two side midpoints is parallel to the third side and half its length. The three medians meet at one point, two-thirds of the way from each vertex. Points on a segment's perpendicular bisector are exactly those equidistant from its endpoints.",
    pitfalls: [
      "SSA does not guarantee congruent triangles.",
      "Use the converse of an angle theorem when equal angles are given and parallelism is the conclusion.",
      "A median joins a vertex to the opposite midpoint; it need not be perpendicular or have the same length as another median.",
    ],
    parentGuide:
      "Ask which earlier facts support each line. For two independent lines, check that either order is justified.",
  },
]);
