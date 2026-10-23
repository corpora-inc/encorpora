import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const geometryProofMethods: Record<string, ProblemMethod> = {
  "geometry-proof-step": {
    goal: "Match a proof statement to a theorem whose conditions follow from the givens.",
    intuition:
      "A proof explains why a conclusion follows from given facts. Each step states a claim and gives a reason. A theorem is a proved rule you may use when its conditions hold. For angles, equal measures mean congruent angles; measures adding to $180^\\circ$ mean supplementary angles.",
    terms: [
      [
        "proof",
        "A chain of justified statements showing why a conclusion follows from given facts.",
      ],
      ["theorem", "A mathematical statement established by a proof."],
      ["congruent angles", "Angles with equal measures."],
      ["supplementary angles", "Two angles whose measures add to 180 degrees."],
    ],
    method: [
      "Read the exact target: does it assert equal angle measures or a sum? Identify every angle named in it.",
      "Check the givens for a crossing, a straight angle, parallel lines, or a triangle. Choose the theorem whose conditions and conclusion both match.",
    ],
    watch:
      "A true theorem is useful only when its conditions hold and its conclusion matches the step being justified.",
  },
};
export const geometryProofPrinciples: Record<string, string> = {
  "geometry-proof-step":
    "A proof step follows from its stated givens and an applicable definition or theorem. A drawing's appearance alone does not establish the required conditions.",
};
export const geometryProofLessons: Lesson[] = [
  {
    id: "reasons-in-angle-proofs",
    title: "Give each angle step a reason",
    summary:
      "Use the stated geometry to explain why an angle relationship must hold.",
    templateIds: ["geometry-proof-step"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Distinguish a proof statement from its reason.",
      "Check the conditions of four common angle theorems.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "What makes a reason fit?",
        paragraphs: [
          "An angle is the opening between two rays with the same endpoint, called its vertex. Its measure describes the size of that opening. The notation $m\\angle ABC$ means the measure of the angle with vertex $B$ and rays toward $A$ and $C$. You need to recognize straight lines, rays and triangles and add angle measures.",
          "A proof explains why a conclusion follows from stated facts, called givens. Each step has a statement and a reason. A theorem is a mathematical statement already established by proof; it can justify a new step when its conditions hold. Congruent angles have equal measures. Supplementary angles have measures adding to $180^\\circ$.",
          "First read what the step claims. Then identify its configuration from the givens. A line crossing two other lines is a transversal. Corresponding angles occupy matching positions at its two crossings. They need not have equal measures unless the crossed lines are parallel.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Triangle $ABC$ has interior angles $\\angle A$, $\\angle B$ and $\\angle C$. A proof writes $m\\angle A + m\\angle B + m\\angle C = 180^\\circ$. What justifies this statement?",
      steps: [
        "The statement adds the three interior angle measures, rather than equating two angles.",
        "The givens say these are exactly the interior angles of one triangle. That is the condition needed for the triangle angle-sum theorem.",
        "The theorem says the interior angles of a triangle in a Euclidean plane sum to $180^\\circ$. Its conclusion matches the proof statement.",
      ],
      answer: "The interior angles of a triangle sum to 180 degrees.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Why the triangle sum is a straight angle",
        paragraphs: [
          "The picture illustrates the same theorem with $50^\\circ$, $60^\\circ$ and $70^\\circ$. A line through $C$ parallel to $AB$ lets us copy the angles at $A$ and $B$ beside the angle at $C$, using equal angles made by a transversal of parallel lines. Together they fill a straight angle: $50^\\circ + 70^\\circ + 60^\\circ = 180^\\circ$. The proof works for every triangle, not just these example measures.",
        ],
        illustration: "triangle-sum-line",
      },
      {
        title: "The precise statements",
        paragraphs: [
          "In Euclidean plane geometry, opposite angles at the intersection of two straight lines are vertical angles and are congruent. Each is supplementary to the same adjacent angle, so subtracting that adjacent angle's measure from $180^\\circ$ gives equal measures.",
          "Two adjacent angles form a linear pair when they share one ray and their other rays are opposite. They are supplementary because they fill a straight angle. Corresponding angles formed by a transversal crossing two distinct parallel lines are congruent. Without parallel lines, corresponding positions alone do not establish equality.",
          "The three interior angles of a nondegenerate triangle in a Euclidean plane sum to $180^\\circ$. Nondegenerate means that its three vertices are not on one straight line. In each theorem, verify the stated conditions before using its conclusion.",
        ],
      },
    ],
    pitfalls: [
      "Match the theorem to the stated angle relationship, not just a familiar word.",
      "Check that parallel lines are given before claiming corresponding angles are equal.",
      "Use stated point order to determine whether rays are opposite.",
    ],
    parentGuide:
      "Ask the learner to name the conclusion and then identify the given fact that allows the chosen theorem. Ask why another true theorem does not justify this particular step.",
  },
];
