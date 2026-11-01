import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { act, scene, step, triangle } from "../math/scene/author";

export const congruenceMethods: Record<string, ProblemMethod> = {
  "triangle-congruence-criteria": {
    goal: "Decide whether the given matching sides and angles prove two triangles congruent, or name the one fact a test still needs.",
    senses: {
      side: "side",
      vertex: "vertex",
      degrees: "degree-angle",
      similar: "similar-figures",
    },
    noLink: [
      "opposite",
      "parts",
      "part",
      "third",
      "whole",
      "leaves",
      "intersection",
    ],
    intuition:
      "Two triangles are congruent when they have the same size and shape, so one fits exactly on the other. Corresponding parts are the sides and angles that match up when you pair the corners in order. If $A$ goes with $D$ and $B$ with $E$, side $AB$ goes with side $DE$. In the test names, S means a matching pair of sides and A a matching pair of angles. SSS is three pairs of sides. SAS is two pairs of sides and the angle between them. ASA is two pairs of angles and the side between them. AAS is two pairs of angles and a side not between them. Three matching angles (AAA), or two sides and an angle not between them (SSA), do not prove congruence.",
    terms: [
      "congruent",
      "corresponding",
      "included-angle",
      ["side", "The included side joins the vertices of the two given angles."],
    ],
    method: [
      "Pair the corners in the given order, then pair the sides and angles. Count only the equal pairs that are stated or marked.",
      "Check where each part sits. In SAS the angle is between the two sides. In ASA the side joins the two angles. AAS uses two angles and a side that is not between them.",
      "If a named test needs one more fact, find the exact missing matching pair. Three angles allow a bigger or smaller copy. Two sides with an angle not between them can make two different triangles.",
    ],
    watch:
      "Check where the angle or side sits. Three facts do not automatically prove congruence. A feature with no mark or statement is not a given fact.",
  },
};
export const congruencePrinciples: Record<string, string> = {
  "triangle-congruence-criteria":
    "SSS, SAS, ASA and AAS each give enough matching information to prove two triangles congruent. The included angle lies between the two named sides. The included side joins the corners of the two named angles. AAA and SSA are not congruence tests in general. These facts hold for true triangles, whose corners are not all on one line, in ordinary flat geometry.",
};
export const congruenceScenes = {
  "congruence-three-sides": scene(
    triangle([
      [0, 0],
      [4, 0],
      [0, 3],
    ])
      .names("A", "B", "C")
      .side(0, { label: 4, ticks: 1 })
      .side(1, { label: 5, ticks: 2 })
      .side(2, { label: 3, ticks: 3 })
      .id("first"),
    triangle([
      [10, 0],
      [6, 0],
      [10, 3],
    ])
      .names("D", "E", "F")
      .side(0, { label: 4, ticks: 1 })
      .side(1, { label: 5, ticks: 2 })
      .side(2, { label: 3, ticks: 3 })
      .id("second"),
  ).build({
    title: "Three corresponding side pairs of lengths 4, 5 and 3 centimeters",
    note: "A corresponds to D, B to E and C to F. One tick marks AB and DE, two mark BC and EF, and three mark CA and FD. No angle equality is given.",
    steps: [
      step(
        "Match the sides with one tick: each has length 4 cm.",
        act.highlight("first.side.0"),
        act.highlight("second.side.0"),
      ),
      step(
        "Match the sides with two ticks and with three ticks: the other lengths are 5 cm and 3 cm.",
        act.highlight("first.side.1"),
        act.highlight("second.side.1"),
        act.highlight("first.side.2"),
        act.highlight("second.side.2"),
      ),
      step(
        "All three corresponding sides match. A reflection can reverse orientation without changing any length: SSS proves congruence.",
        act.highlight("first"),
        act.highlight("second"),
      ),
    ],
  }),
};
export const congruenceLessons: Lesson[] = [
  {
    id: "triangle-congruence-givens",
    title: "When triangle givens fix the whole shape",
    summary:
      "Two triangles are congruent when they are exactly the same size and shape. You do not need to measure all six parts, the three sides and the three angles. Certain sets of three matching parts are enough to fix the whole triangle. These sets are called congruence tests; one is three matching sides. Other sets of three, such as three matching angles, are not enough.",
    templateIds: ["triangle-congruence-criteria"],
    senses: {
      side: "side",
      vertex: "vertex",
      degrees: "degree-angle",
      similar: "similar-figures",
      radius: "radius",
      center: "center",
      image: "image-transformation",
    },
    noLink: [
      "opposite",
      "parts",
      "part",
      "third",
      "square root",
      "certain",
      "whole",
      "leaves",
      "more than",
      "change",
      "changes",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Recognize the tests SSS, SAS, ASA and AAS from the matching sides and angles you are given.",
      "Explain why three matching angles (AAA), or two sides and an angle not between them (SSA), do not prove congruence in general.",
      "Name the one matching side or angle that completes a given test.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "What must match?",
        paragraphs: [
          "A triangle has three straight sides and three corners, called vertices (one corner is a vertex). An angle is the opening between two sides at a vertex, measured in degrees (°). The three angles inside any triangle add to $180^\\circ$.",
          "Two triangles are congruent when one can be moved exactly onto the other by sliding, turning or flipping, with no stretching. These moves are called rigid motions, because they keep every length and every angle the same. The parts that land on each other are called corresponding parts. If $A$ matches $D$, $B$ matches $E$ and $C$ matches $F$, then side $AB$ matches side $DE$. The angle at $A$, written $\\angle A$, matches $\\angle D$.",
          "A congruence test, also called a criterion, is a set of matching parts that is enough to fix the whole triangle. In the names, S stands for a side and A for an angle. The included angle of two sides is the angle at the corner they share: for sides $AB$ and $AC$, it is $\\angle A$. The included side of two angles is the side joining their corners: for $\\angle A$ and $\\angle B$, it is side $AB$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Given $AB = DE = 4$ cm, $BC = EF = 5$ cm and $CA = FD = 3$ cm, which criterion proves triangle $ABC$ congruent to triangle $DEF$?",
      steps: [
        "Pair the corners by the order of the letters: $A$ with $D$, $B$ with $E$, $C$ with $F$. Each given equality then compares matching sides.",
        "All three pairs of sides match: 4 cm, 5 cm and 3 cm. Three matching sides is the test side-side-side, written SSS.",
        "Here is why three sides fix the triangle. Lay the 4 cm sides on top of each other. The third corner must be 3 cm from one end and 5 cm from the other. So it lies where a circle of radius 3 cm around one end crosses a circle of radius 5 cm around the other. (The radius is the distance from a circle's center to any point on the circle.)",
        "The two circles cross at two points, one on each side of the matched side. Each point is the mirror image (reflection) of the other across that side, so both give congruent triangles.",
        "Check that the lengths can make a triangle: any two sides must add to more than the third. Here $3 + 4 = 7 > 5$, $3 + 5 = 8 > 4$ and $4 + 5 = 9 > 3$.",
      ],
      answer: "SSS",
    },
    closingSections: [
      {
        stage: "method",
        title: "Read the matching marks",
        paragraphs: [
          "The picture uses the example's lengths. Small marks called ticks show which sides match: sides with the same number of ticks are equal. The labels give the lengths in centimeters. Follow each pair before you compare the whole triangles. A drawing that only looks the same does not prove congruence.",
        ],
        illustration: "congruence-three-sides",
      },
      {
        stage: "method",
        title: "Why the other tests work",
        paragraphs: [
          "SAS means two matching sides and the angle between them match. Take sides $AB$ and $AC$ with $\\angle A$ between them. Copy the angle first, so its two rays (half-lines) point the same ways. Then mark each side's length along its ray. Both remaining corners are now fixed. An angle at $B$ would not be between $AB$ and $AC$, so that information would be SSA instead.",
          "ASA means two matching angles and the side between them match. Fix side $AB$ and the angles at $A$ and $B$. A ray leaves each end of the side at its angle. The two rays cross at exactly one point, the third corner. AAS uses a side that is not between the angles, such as $BC$. The missing angle is $180^\\circ$ minus the two given angles, so all three angles are known. Then the given side lies between two known angles, and ASA applies.",
          "AAA means all three matching angles are equal. Doubling every side keeps the angles but changes the size. So AAA shows the triangles are similar (the same shape), not congruent (the same shape and size).",
          "SSA means two sides and an angle not between them match. Sometimes that fixes one triangle, but sometimes two different triangles fit. Here is an exact example on a grid. Take $A = (0, 0)$ and $B = (7, 0)$. Both $C = (3, 4)$ and $C = (4, 3)$ give $AC = 5$, $AB = 7$ and an angle of $45^\\circ$ at $B$. But side $BC$ is $4\\sqrt{2}$ in the first triangle and $3\\sqrt{2}$ in the second. Here $\\sqrt{2}$, the square root of 2, is the number that times itself makes 2, about 1.41. So SSA is not a test in general.",
        ],
      },
      {
        title: "The precise conditions",
        paragraphs: [
          "In ordinary flat geometry, called Euclidean geometry, each of SSS, SAS, ASA and AAS proves two triangles congruent. The corners must be matched the same way for every pair. The triangles must be true triangles, meaning their three corners do not lie on one straight line. The tests compare equal matching side lengths and equal matching angle measures. A rotation (turn), translation (slide) or reflection (flip) may be needed to line the triangles up.",
          "Use only facts that are stated or marked. To complete a named test, supply the exact missing pair. Suppose the angles at $A$ and $D$ are equal, and so are the angles at $B$ and $E$. Then $AB = DE$ completes ASA, because $AB$ lies between those two angles. Instead, $BC = EF$ completes AAS, because $BC$ does not.",
        ],
      },
    ],
    pitfalls: [
      "Check that the angle or side lies between the others before you name SAS or ASA.",
      "Three matching angles (AAA) fix the shape but not the size.",
      "SSA is not a test in general. Check any special conditions separately.",
      "Keep the same corner matching for every pair.",
    ],
    parentGuide:
      "Ask the learner to trace the two ends of each matching side, then point to the included angle or side. Move one given to a different spot and ask whether the same test still works. For AAA, enlarge a paper triangle on a copier: the angles stay the same while the lengths change.",
  },
];
