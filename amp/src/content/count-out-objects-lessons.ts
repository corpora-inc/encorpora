import type { FacetMapping } from "./coverage";
import { chainLesson } from "./chain-lesson-kit";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const noLink = ["loose", "stop"];

export const countOutObjectsMethods: Record<string, ProblemMethod> = {
  "count-out-objects": {
    goal: "Choose the ten-frame that shows a given number of counters from 1 to 20.",
    intuition:
      "Counting out means you stop when you reach the number you were given. A ten-frame is a grid of ten places. A full frame is ten, and the loose counters are the ones past ten.",
    terms: ["ten-frame"],
    noLink,
    method: [
      "Read the number you were asked to show.",
      "Count the counters in each frame. Empty places are not counters.",
      "For a teen, a full frame is ten. Add the loose counters. Stop at the asked number.",
    ],
    watch:
      "Do not pick one extra counter, and do not forget the full ten when the number is a teen.",
  },
};

export const countOutObjectsPrinciples: Record<string, string> = {
  "count-out-objects":
    "Given a number n from 1 to 20, the matching set has exactly n counters. A ten-frame holds ten. A number from 11 to 20 is one full ten plus the loose ones, n − 10.",
};

export const countOutObjectsLessons: Lesson[] = [
  chainLesson({
    id: "count-out-objects-lesson",
    title: "Count out that many",
    summary:
      "When you are given a number, count counters until you say that number, then stop. The frame that shows that many is the one you want.",
    noLink,
    templateIds: ["count-out-objects"],
    objectives: [
      "Choose the ten-frame that shows a given number from 1 to 20.",
      "Stop at that number: one more is too many, and a teen still includes its full ten.",
    ],
    openingTitle: "Stop when you say the number",
    opening: [
      "Counting out means you take counters one at a time until you say the number you were given. Then you stop.",
      "A ten-frame is a grid with ten places. Empty places are not counters.",
      "Eleven is one full ten and one loose counter. Forgetting the full ten leaves only the one.",
    ],
    example: {
      prompt: "Which frame shows 7 counters?",
      steps: [
        "The question asks for 7. Count the counters, not the empty places.",
        "A frame with 6 is one short. A frame with 8 is one too many.",
        "The frame with 7 counters is the one that matches.",
      ],
      answer: "The frame with 7 counters.",
    },
    methodTitle: "Match the frame to the number",
    method: [
      "Say the number you were asked for.",
      "Count the counters in a frame. Stop at that number.",
      "A teen uses a full ten plus the loose counters.",
    ],
    formalTitle: "Exactly that many",
    formal: [
      "A set shows n when it has n counters, no fewer and no more.",
      "One more than n is too many. One fewer is too few.",
      "From 11 to 20, n is 10 plus the loose counters. The loose counters alone are n − 10.",
    ],
    pitfalls: [
      "Choosing the frame with one extra counter.",
      "Choosing the frame that is one short.",
      "For a teen, choosing only the loose counters and forgetting the full ten.",
    ],
    parentGuide:
      "Give your learner a number and a pile. Have them move counters one by one and stop when they say that number.",
  }),
];

export const countOutObjectsFacetMappings: FacetMapping[] = [
  {
    templateId: "count-out-objects",
    facetId: "count-to-20.core",
    extent: "partial",
    rationale:
      "Choose the ten-frame that shows a given number from 1 to 20. This selects a counted set. It does not ask the learner to tap objects out of a pile.",
  },
];
