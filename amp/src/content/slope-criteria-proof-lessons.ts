import type { FacetMapping } from "./coverage";
import { chainLesson } from "./chain-lesson-kit";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const noLink = ["slope", "parallel", "proof"];

export const slopeCriteriaProofMethods: Record<string, ProblemMethod> = {
  "slope-criteria-proof": {
    goal: "Choose the reason for each step of a parallel or perpendicular slope proof, in order.",
    intuition:
      "Parallel lines climb at the same rate, so their slopes match. A quarter turn swaps the run and the rise and reverses one direction, so the new slope is the negative reciprocal. You follow a proof that is already laid out. You do not invent it.",
    noLink,
    method: [
      "Start from the given: equal runs, or a stated rotation.",
      "Use the right angle where a horizontal run meets a vertical rise.",
      "Name the triangle fact, then the line fact. Do not use the conclusion as a reason for an earlier step.",
    ],
    watch:
      "AA shows the same shape, not equal rises. A reason that says the slopes are already equal is circular.",
  },
};

export const slopeCriteriaProofPrinciples: Record<string, string> = {
  "slope-criteria-proof":
    "If two lines are parallel, slope triangles with the same run are congruent by ASA, so the rises match and the slopes are equal. The converse uses SAS and the converse of corresponding angles. A 90 degree rotation sends a run of a and a rise of b to a slope of -a/b, and the product of the slopes is -1.",
};

export const slopeCriteriaProofLessons: Lesson[] = [
  chainLesson({
    id: "slope-criteria-proof-lesson",
    title: "Why parallel and perpendicular slopes work",
    summary:
      "Follow a proof that parallel lines share a slope, and that a quarter turn makes slopes whose product is -1. Each step asks for its reason. This practices following the proof, not inventing it.",
    noLink,
    templateIds: ["slope-criteria-proof"],
    objectives: [
      "Justify each step that parallel lines have equal slopes, and the converse.",
      "Justify the quarter-turn argument that perpendicular slopes multiply to -1.",
    ],
    openingTitle: "Same climb, or a turned triangle",
    opening: [
      "A slope is rise over run. If two lines are parallel, a horizontal run of the same length climbs the same rise on each.",
      "Turn that right triangle a quarter turn. The run stands up and the rise lies flat the other way. The new slope is the negative flip of the old one.",
      "The practice gives the steps in order. Your job is the reason for each step, not a proof you write from a blank page.",
    ],
    example: {
      prompt:
        "Lines l and m are parallel. Each slope triangle has run 1. Why are the rises equal?",
      steps: [
        "The runs are both given as 1, and each right angle is where a vertical rise meets a horizontal run.",
        "The parallel lines and the horizontal line make a pair of corresponding angles equal.",
        "ASA makes the triangles congruent, so the rises are corresponding parts and the slopes match.",
      ],
      answer: "The rises are equal because the triangles are congruent by ASA.",
    },
    methodTitle: "One reason at a time",
    method: [
      "Read what the step claims. A reason must support that claim, not a later one.",
      "For parallel lines, corresponding angles come before the triangles are congruent.",
      "For a quarter turn, the image of the run is vertical and one direction has reversed.",
    ],
    formalTitle: "The slope criteria",
    formal: [
      "Parallel lines have equal slopes. Lines with equal slopes are parallel.",
      "Perpendicular lines have slopes whose product is -1, when neither line is vertical.",
      "The argument uses congruent slope triangles. It is shown here as a proof to follow.",
    ],
    pitfalls: [
      "Choosing AA, which shows the same shape but not equal rises.",
      "Saying the lines are parallel because they have the same slope, inside a proof that assumes they are parallel.",
      "Flipping the slope but forgetting the sign, or changing the sign but not the fraction.",
    ],
    parentGuide:
      "Draw two parallel lines and the same run on each. Ask why the rises match before anyone mentions the word slope.",
  }),
];

export const slopeCriteriaProofFacetMappings: FacetMapping[] = [
  {
    templateId: "slope-criteria-proof",
    facetId: "slope-proofs.HSG.GPE.B.5",
    extent: "partial",
    rationale:
      "Complete an ordered proof of the parallel and perpendicular slope criteria by choosing one reason per step. Does not assess a proof the learner writes, or constructing the lines from scratch.",
  },
  {
    templateId: "slope-criteria-proof",
    facetId: "slope-proofs.core",
    extent: "partial",
    rationale:
      "Follow the slope proofs for parallel lines, the converse, and a quarter turn. The numeric perpendicular slope is one blank. This does not certify inventing a proof.",
  },
];
