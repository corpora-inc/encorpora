import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const stripDiagramMethods: Record<string, ProblemMethod> = {
  "strip-diagram-match": {
    goal: "Read a strip diagram with a whole and its parts and choose the story or equation it shows.",
    intuition:
      "A strip diagram draws a story as a strip. The long strip above is the whole, and the strips below are its parts, each as wide as its amount. A part marked with a question mark is the amount you want to find. Parts of the same width are equal.",
    terms: [
      ["whole", "The total amount, drawn as the long strip."],
      ["part", "One piece of the whole, drawn under it."],
      ["equal parts", "Parts of the same width, which are the same amount."],
    ],
    method: [
      "Name the whole and each part: which numbers are given and which part has the question mark.",
      "See how the parts are made: one part set apart and then equal parts, or two parts added.",
      "Choose the story or equation with the same whole, the same known parts and the same unknown. Check that it uses each equal part the right number of times.",
    ],
    watch:
      "Check the number of equal parts and which amount is the whole. A story or equation with the same numbers can use a different structure.",
  },
};

export const stripDiagramPrinciples: Record<string, string> = {
  "strip-diagram-match":
    "In a strip diagram the parts together make the whole, so a diagram with parts $a$ and $n$ and whole $T$ shows $a+n=T$. A part followed by $k$ equal parts of size $n$ shows $a+k\\times n=T$. The equation is the same whichever part is unknown.",
};

export const stripDiagramLessons = [
  chainLesson({
    id: "strip-diagram-match-lesson",
    title: "Strip diagrams for stories and equations",
    summary:
      "Read a strip diagram and match it to a story or an equation with the same whole, parts and unknown.",
    templateIds: ["strip-diagram-match"],
    objectives: [
      "Identify the whole, the known parts and the unknown in a strip diagram.",
      "Choose the story or equation that has the same structure, including equal parts.",
    ],
    openingTitle: "The long strip is the whole",
    opening: [
      "A strip diagram is a picture of a story's numbers. The long strip on top is the whole. The strips under it are the parts, and together they are exactly as long as the whole.",
      "A part with a question mark is what we want to find. Strips of the same width are equal amounts, so a diagram with 3 equal marked strips means the unknown amount is used 3 times.",
    ],
    example: {
      prompt:
        "A strip diagram has a whole of 46. Under it are one part of 10 and 3 equal parts marked ?. Which equation matches?",
      steps: [
        "The whole is 46. It is made of a part of 10 and 3 equal unknown parts.",
        "The 3 equal parts are $3\\times n$ if each is $n$.",
        "Part plus parts equals whole: $10+3\\times n=46$.",
      ],
      answer: "$10+3\\times n=46$",
    },
    methodTitle: "Whole, parts, unknown",
    method: [
      "Name the whole and every part. Count the equal unknown parts.",
      "Write the parts added together, with the equal parts as a product, and set it equal to the whole.",
      "For a story, check it starts from the whole, sets aside the known part, and then does what the equal parts show.",
    ],
    formalTitle: "Parts and wholes",
    formal: [
      "The parts of a strip diagram add to its whole. With parts $a$ and $n$, the whole is $a+n$.",
      "If $k$ parts have the same size $n$, together they are $k\\times n$, so the whole is $a+k\\times n$.",
    ],
    pitfalls: [
      "Using the unknown only once when the diagram has several equal unknown parts.",
      "Multiplying the known part by the number of equal parts.",
      "Choosing a story that uses the same numbers but divides or multiplies in a different way.",
    ],
    parentGuide:
      "Ask your learner to say what each strip stands for, and to point to the strips that are equal.",
  }),
];

export const stripDiagramFacetMappings: FacetMapping[] = [
  {
    templateId: "strip-diagram-match",
    facetId: "multi-operation-stories.core",
    extent: "partial",
    rationale:
      "Single choice of the story or the equation for a drawn strip diagram: a whole of two parts with one unknown, or a whole with a known part and two to four equal unknown parts. Does not assess choosing or drawing the strip diagram for a story, comparison strips, or solving the equation.",
  },
];
