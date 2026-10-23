import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { act, scene, step, triangle } from "../math/scene/author";

export const congruenceMethods: Record<string, ProblemMethod> = {
  "triangle-congruence-criteria": {
    goal: "Decide whether the corresponding givens determine congruent triangles, or complete a specified criterion.",
    terms: [
      [
        "congruent triangles",
        "Triangles that match exactly after translations, rotations or reflections.",
      ],
      [
        "corresponding parts",
        "Sides or angles paired by the stated vertex matching.",
      ],
      [
        "included angle",
        "The angle at the shared endpoint of two specified sides.",
      ],
      [
        "included side",
        "The side joining the vertices of two specified angles.",
      ],
    ],
    method: [
      "Use the vertex correspondence to pair sides and angles. Count only the equalities that are stated or marked.",
      "Check their positions: SSS uses three sides; SAS uses two sides and their included angle; ASA uses two angles and their included side; AAS uses two angles and another side.",
      "If a named criterion needs one more fact, identify the exact missing corresponding pair. Three angles permit scaling; two sides with a non-included angle require further reasoning and are not a general congruence criterion.",
    ],
    watch:
      "Check where the angle or side lies. Three pieces of information do not automatically prove congruence, and an unmarked feature supplies no given fact.",
  },
};
export const congruencePrinciples: Record<string, string> = {
  "triangle-congruence-criteria":
    "For nondegenerate triangles in a Euclidean plane, SSS, SAS, ASA and AAS give sufficient corresponding information for congruence. The included angle lies between the two specified sides; the included side joins the two specified angle vertices. AAA and SSA are not general congruence criteria.",
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
      "Use corresponding sides and angles to establish a triangle's size and shape.",
    templateIds: ["triangle-congruence-criteria"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Identify SSS, SAS, ASA and AAS from corresponding givens.",
      "Explain why AAA and SSA do not generally establish congruence.",
      "Complete a specified criterion with a corresponding side or angle pair.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "What must match?",
        paragraphs: [
          "A triangle has three straight sides and three vertices, the points where the sides meet. An angle is the opening between two sides at a vertex. You need to recognize sides and angles and know that a triangle's interior angles sum to $180^\\circ$.",
          "Congruent triangles match exactly after sliding, turning or reflecting, without stretching. These movements are called rigid motions because they preserve every length and angle. Corresponding parts are parts paired by a vertex matching: if $A$ matches $D$, $B$ matches $E$ and $C$ matches $F$, then side $AB$ matches $DE$ and angle $A$ matches angle $D$.",
          "A congruence criterion is a set of matching measurements sufficient to fix the whole triangle. The letter $\\mathrm{S}$ stands for side and $\\mathrm{A}$ for angle. The included angle of two sides is the angle at their common endpoint. The included side of two angles joins their vertices. For sides $AB$ and $AC$, the included angle is $\\angle A$; for angles $A$ and $B$, the included side is $AB$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Given $AB = DE = 4$ cm, $BC = EF = 5$ cm and $CA = FD = 3$ cm, which criterion proves triangle $ABC$ congruent to triangle $DEF$?",
      steps: [
        "Pair the endpoints: $A$ with $D$, $B$ with $E$, $C$ with $F$. Each stated equality compares corresponding sides.",
        "The three side pairs match: 4 cm, 5 cm and 3 cm. This is side-side-side, abbreviated SSS.",
        "To see why this fixes the triangle, match the 4 cm sides. The third vertex must be 3 cm from one endpoint and 5 cm from the other. Those distances locate it on two intersecting circles. The possible positions are reflections across the matched side, so both give congruent triangles.",
        "Check that the lengths can form a triangle: $3 + 4 > 5$. The other two triangle inequalities also hold. A reflection changes orientation but preserves the side lengths.",
      ],
      answer: "SSS",
    },
    closingSections: [
      {
        stage: "method",
        title: "Read the matching marks",
        paragraphs: [
          "The picture uses the example's lengths. Matching tick counts identify the three side pairs; the labels give lengths in centimeters. Follow each pair before comparing the whole triangles. A drawing that merely looks the same would not prove congruence.",
        ],
        illustration: "congruence-three-sides",
      },
      {
        stage: "method",
        title: "Why the other criteria work",
        paragraphs: [
          "SAS means two corresponding sides and their included angles match. For $AB$, $AC$ and $\\angle A$, first match the angle's two rays, then mark the specified length on each ray. Both remaining vertices are fixed. An angle at $B$ would not be between $AB$ and $AC$, so that information would be SSA instead.",
          "ASA means two corresponding angles and their included sides match. With angles $A$ and $B$ and side $AB$ fixed, the two angle rays from the side's endpoints locate the third vertex. AAS uses a non-included side, such as $BC$, instead. The missing angle is $180^\\circ$ minus the two given angles, so AAS supplies an ASA configuration too.",
          "AAA means all three corresponding angles match. Doubling every side preserves the angles but changes the size, so AAA establishes similarity, not congruence. Similar triangles have the same shape; congruent triangles also have the same size.",
          "SSA means two sides and a non-included angle match. Sometimes those measurements determine a triangle, but sometimes they permit two different triangles. For an exact counterexample, take $A=(0,0)$ and $B=(7,0)$. Both $C=(3,4)$ and $C=(4,3)$ give $AC=5$, $AB=7$ and $m\\angle B=45^\\circ$. Yet $BC=4\\sqrt{2}$ in the first case and $BC=3\\sqrt{2}$ in the second. Thus SSA is not a general criterion.",
        ],
      },
      {
        title: "The precise conditions",
        paragraphs: [
          "In Euclidean plane geometry, each of SSS, SAS, ASA and AAS is sufficient for congruence of two nondegenerate triangles under a consistent vertex correspondence. Nondegenerate means that the three vertices do not lie on one straight line. These criteria use equal corresponding side lengths and equal corresponding angle measures. A rotation, translation or reflection may be needed to make the match.",
          "Use only stated or marked information. To complete a named criterion, supply the exact missing pair in that criterion. For example, given equal angles at $A$ and $D$ and at $B$ and $E$, the additional pair $AB=DE$ completes ASA, while $BC=EF$ completes AAS.",
        ],
      },
    ],
    pitfalls: [
      "Check the included position before naming SAS or ASA.",
      "AAA gives no fixed side length.",
      "SSA is not a general criterion; check any special conditions separately.",
      "Keep the same vertex correspondence for every pair.",
    ],
    parentGuide:
      "Ask the learner to trace the endpoints of each corresponding side, then point to the included angle or side. Change one given's position and ask whether the same criterion still applies. For AAA, enlarge a paper triangle to demonstrate unchanged angles and changed lengths.",
  },
];
