import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const stripDiagramMethods: Record<string, ProblemMethod> = {
  "strip-diagram-match": {
    goal: "Read a strip diagram with a whole and its parts and choose the story or equation it shows.",
    intuition:
      "A strip diagram is a drawing that shows a story's amounts as strips. The long strip on top is the whole, the total amount. The shorter strips under it are the parts, each as wide as its amount. Together the parts are as long as the whole. A part marked with a question mark is the unknown, the amount to find. Strips of the same width are equal. An equation is two amounts joined by an equal sign, =, saying they are the same.",
    senses: { part: "part", parts: "part", whole: "whole" },
    terms: [
      ["whole", "In a strip diagram, the whole is the long strip."],
      "part",
      "equal-parts",
    ],
    method: [
      "Name the whole and each part. Which numbers are given, and which part has the question mark?",
      "See how the parts are made: one known part and some equal parts, or two parts added.",
      "Choose the story or equation with the same whole, the same known parts and the same unknown. Check that it uses each equal part the right number of times.",
    ],
    watch:
      "Count the equal parts, and check which amount is the whole. A story or equation can use the same numbers in a different way.",
  },
};

export const stripDiagramPrinciples: Record<string, string> = {
  "strip-diagram-match":
    "In a strip diagram the parts together make the whole. Let the letters stand for amounts. Parts $a$ and $n$ with whole $T$ show $a + n = T$. A part $a$ and $k$ equal parts of size $n$ show $a + k \\times n = T$. The equation is the same whichever part is unknown.",
};

export const stripDiagramLessons: Lesson[] = [
  {
    ...chainLesson({
      id: "strip-diagram-match-lesson",
      title: "Strip diagrams for stories and equations",
      summary:
        "A strip diagram is a drawing that shows a story's amounts as strips. The long strip shows the whole, the total amount. Shorter strips under it show the parts. An equation is two amounts joined by an equal sign, =, saying they are the same. Match a strip diagram to the story or equation with the same whole and parts.",
      templateIds: ["strip-diagram-match"],
      objectives: [
        "Find the whole, the known parts and the unknown part in a strip diagram.",
        "Choose the story or equation that has the same whole and parts, including equal parts.",
      ],
      openingTitle: "The long strip is the whole",
      opening: [
        "The long strip on top is the whole. The strips under it are the parts. Together the parts are exactly as long as the whole.",
        "A part marked with a question mark is the unknown, the amount we want to find. Strips of the same width stand for equal amounts.",
        "We can use a letter, such as $n$, for the unknown amount. Equal groups are groups that each have the same amount. Joining equal groups is called multiplication, written ×. So 3 equal strips of $n$ together are $3 \\times n$, read “3 times $n$”. It means $n + n + n$.",
      ],
      example: {
        prompt:
          "A strip diagram has a whole of 46. Under it are one part of 10 and 3 equal parts marked ?. Which equation matches?",
        steps: [
          "The whole is 46. It is made of a part of 10 and 3 equal unknown parts.",
          "Call each equal part $n$. The 3 equal parts are $n + n + n$, which is $3 \\times n$.",
          "The parts together make the whole: $10 + 3 \\times n = 46$.",
        ],
        answer: "$10+3\\times n=46$",
      },
      methodTitle: "Whole, parts, unknown",
      method: [
        "Name the whole and every part. Count the equal unknown parts.",
        "Add the parts, writing the equal parts as a multiplication. Set that equal to the whole.",
        "For a story, check that it has the same total, the same known part and the same number of equal parts. It can take parts away from the total or put parts together to make it.",
      ],
      formalTitle: "Parts and wholes",
      formal: [
        "Let the letters stand for amounts. The parts of a strip diagram add up to its whole. With parts $a$ and $n$, the whole is $a + n$.",
        "If $k$ parts each have size $n$, together they are $k \\times n$. So the whole is $a + k \\times n$. Multiply first, then add $a$.",
      ],
      pitfalls: [
        "Use the unknown once for each equal unknown part, not just once.",
        "Do not multiply the known part by the number of equal parts.",
        "A story with the same numbers can still divide or multiply in a different way. Check that it matches the strips.",
      ],
      parentGuide:
        "Ask your learner to say what each strip stands for, and to point to the strips that are equal.",
    }),
    senses: { part: "part", parts: "part", whole: "whole" },
  },
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
