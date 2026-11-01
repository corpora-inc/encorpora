import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const geometryProofMethods: Record<string, ProblemMethod> = {
  "geometry-proof-step": {
    goal: "A proof step makes a claim about angles. Choose the rule (theorem) that proves it from the given facts.",
    intuition:
      "A proof explains why a conclusion, the claim being proved, follows from facts you are given, called givens. Each step states a claim and gives a reason. A theorem is a rule already proved. You may use it when its conditions, the things it needs, are known to be true. An angle is formed by two rays (lines that start at a point and go on in one direction) with the same starting point. Its measure is its size in degrees (°), and a straight line makes 180°. Angles with equal measures are congruent. Two angles whose measures add to $180^\\circ$ are supplementary.",
    terms: ["proof", "theorem", "congruent", "supplementary"],
    method: [
      "Read the claim exactly. Does it say two angle measures are equal, or that measures add to a total? Find every angle it names.",
      "Look in the givens for crossing lines, points on one straight line, parallel lines (lines that never meet), or a triangle.",
      "Choose the rule whose conditions are known to be true, from the givens or from earlier steps, and whose conclusion is the claim.",
    ],
    watch:
      "A true rule proves a step only when its conditions are already known. They can come from the givens or from earlier steps. Its conclusion must also be exactly the claim.",
  },
};
export const geometryProofPrinciples: Record<string, string> = {
  "geometry-proof-step":
    "A proof step follows from the givens and a definition or theorem whose conditions they make true. How a drawing looks does not prove those conditions.",
};
export const geometryProofLessons: Lesson[] = [
  {
    id: "reasons-in-angle-proofs",
    title: "Give each angle step a reason",
    summary:
      "A proof shows, step by step, why something must be true. Each step makes a claim and gives a reason, such as a rule that has already been proved. A rule fits a step only when two things hold. What the rule needs must already be known, from the given facts or from earlier steps. And what the rule says must match the claim.",
    templateIds: ["geometry-proof-step"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Tell apart a proof step's statement (its claim) and its reason (why the claim is true).",
      "Check the conditions of four common angle rules before using them.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Angles and how to name them",
        paragraphs: [
          "A ray is part of a line that starts at one point and goes on forever in one direction. An angle is formed by two rays that start at the same point, called the vertex. The size of the opening between the rays is the angle's measure, given in degrees (°). One degree is a tiny turn: a full turn is 360 degrees, and a straight line makes a half-turn, 180°.",
          "The symbol $\\angle$ means angle. An angle is named by three points, with the vertex in the middle: $\\angle ABC$ is the angle at vertex $B$, with one ray toward $A$ and one toward $C$. A ray is named by its starting point first, so ray $BC$ starts at $B$ and passes through $C$. Writing $m\\angle ABC$ means the measure of that angle in degrees. When only one angle sits at a corner, the vertex alone can name it, as in $\\angle A$.",
          "Two angles are congruent when they have equal measures. Two angles are supplementary when their measures add to 180°, like 110° and 70°.",
        ],
      },
      {
        stage: "intuition",
        title: "Statements, reasons and givens",
        paragraphs: [
          "A proof explains why a conclusion, the statement you want to prove, must follow from facts you are told at the start. Those starting facts are called the givens. Each step of a proof has a statement, which is the claim, and a reason, which says why the claim is true.",
          "A theorem is a math rule that has already been proved, so it may be used as a reason. Every theorem has conditions (what must be true before you can use it) and a conclusion (what it then tells you). Use a theorem only when its conditions are already known, from the givens or from earlier steps, and its conclusion is the step's claim.",
        ],
      },
      {
        stage: "intuition",
        title: "Four rules about angles",
        paragraphs: [
          "Two angles that sit side by side and together fill a straight line form a linear pair. For example, points $A$, $B$ and $D$ lie on one straight line, in that order, and ray $BC$ points off the line. Then $\\angle ABC$ and $\\angle CBD$ form a linear pair. Their measures add to 180°, so they are supplementary. If one is 110°, the other is 70°.",
          "When two straight lines cross, they make four angles. Two angles across from each other are called vertical angles, and they have equal measures. For example, if one angle is 40°, its neighbor is 180° − 40° = 140°. The angle across from the first is 180° − 140° = 40° again, because both form a linear pair with the same neighbor.",
          "Two lines are parallel when they run side by side and never meet, like train rails. A third line crossing both is called a transversal. At each crossing it makes four angles. Angles in the same position at the two crossings, such as both upper right, are called corresponding angles. They are equal when the two crossed lines are parallel. If the crossed lines are not parallel, they are not equal.",
          "The three angles inside a triangle are called its interior angles. Their sum, the total you get by adding them, is always 180°, as in 50° + 60° + 70° = 180°. This is the triangle angle-sum rule.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Triangle $ABC$ has interior angles $\\angle A$, $\\angle B$ and $\\angle C$. A proof writes $m\\angle A + m\\angle B + m\\angle C = 180^\\circ$. What justifies this statement?",
      steps: [
        "Read the claim. It adds three angle measures and says the total is $180^\\circ$. It does not say that two angles are equal.",
        "Read the givens. The three angles are the interior angles of one triangle, $ABC$. That is exactly the condition of the triangle angle-sum rule.",
        "That rule says the interior angles of a triangle add to $180^\\circ$. Its conclusion is the claim, so it is the reason.",
      ],
      answer: "The interior angles of a triangle sum to 180 degrees.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Why the angles of a triangle add to 180°",
        paragraphs: [
          "Here is why the triangle rule is true. The picture shows a triangle with angles $50^\\circ$, $60^\\circ$ and $70^\\circ$. Through corner $C$, draw a line parallel to side $AB$, the side joining $A$ and $B$.",
          "Side $AC$ crosses both parallel lines, so it is a transversal. A transversal makes equal angles on opposite sides of itself, between the two parallel lines; these are called alternate interior angles. So side $AC$ makes an angle at $C$ equal to the angle at $A$. In the same way, side $BC$ makes an angle at $C$ equal to the angle at $B$.",
          "The copies of the angles at $A$ and $B$ now sit on either side of the angle at $C$. Together the three fill the straight line, a straight angle of 180°: $50^\\circ + 70^\\circ + 60^\\circ = 180^\\circ$. Nothing depended on these numbers, so the same argument works for every triangle.",
        ],
        illustration: "triangle-sum-line",
      },
      {
        title: "The precise statements",
        paragraphs: [
          "Vertical angles, the angles across from each other where two straight lines cross, are congruent: their measures are equal.",
          "Two angles that share a vertex and one ray, without overlapping, are called adjacent. Two adjacent angles form a linear pair when their other two rays point in opposite directions along one line. The angles of a linear pair are supplementary: their measures add to 180°.",
          "Corresponding angles formed by a transversal (a line crossing two others) are congruent when the two crossed lines are parallel. Without parallel lines, matching positions alone prove nothing.",
          "The three interior angles of a triangle add to $180^\\circ$, provided its three corners do not all lie on one straight line. These facts hold in ordinary flat geometry, called Euclidean geometry. Before using any of them, check that its conditions are true.",
        ],
      },
    ],
    pitfalls: [
      "Pick the rule that matches what the step claims: equal measures, or a total of 180°. A familiar word in the problem is not enough.",
      "Check that the lines are given as parallel before saying corresponding angles are equal. Lines that only look parallel in a drawing do not count.",
      "Use the stated order of points to decide whether two rays point in opposite directions along one line.",
    ],
    parentGuide:
      "Ask the learner to say the step's claim first. Then ask which given fact allows the chosen rule. Finally, ask why a different true rule does not prove this particular step.",
  },
];
