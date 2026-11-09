import type { ContentFamily } from "./registry/types";
import { chainLesson } from "../content/chain-lesson-kit";
import type { ProblemMethod } from "../content/problem-lessons";
import {
  generateStoryForExpression,
  storyForExpressionTemplates,
} from "../math/multiplication-clause-practice";

const method = (goal: string, steps: string[]): ProblemMethod => ({
  goal,
  method: steps,
  watch: "Match the structure, not just the two numbers printed on every card.",
});

export const family = {
  id: "story-for-expression",
  practice: {
    templates: storyForExpressionTemplates,
    generate: generateStoryForExpression,
    preserveAlgebra: true,
  },
  lessons: [
    chainLesson({
      id: "story-for-expression-lesson",
      title: "Stories for a product or a quotient",
      summary:
        "A product is equal groups whose total is not known yet. A quotient starts from a known total and asks for the groups or the size of each group. Sharing and grouping are the same division.",
      templateIds: ["story-for-expression", "story-both-interpretations"],
      objectives: [
        "Match a multiplication or division expression to the story with the same structure.",
        "Select both the sharing story and the grouping story for one quotient.",
      ],
      openingTitle: "Three numbers, and which one is missing",
      opening: [
        "Equal groups have three numbers: how many groups, how many in each group, and the total. A product asks for the total. A quotient already knows the total.",
        "56 ÷ 8 can be 56 stickers shared by 8 friends, or 56 stickers in packs of 8. Both are the same division. 8 bags of 56 is a product, because the total is not known yet.",
      ],
      example: {
        prompt: "Which story can be written as 56 ÷ 8?",
        steps: [
          "56 is the total, and it is already known, so the story must start with 56 things.",
          "8 is either the number of groups or the number in each group.",
          "56 stickers shared equally by 8 friends asks how many each friend gets. That is 56 ÷ 8.",
        ],
        answer: "56 stickers shared equally by 8 friends",
      },
      methodTitle: "Read which number is the total",
      method: [
        "If the total is given, the story is division. 8 can be the number of shares or the size of each group.",
        "If the total is missing, the story is multiplication. Do not choose a story that only adds or takes away.",
      ],
      formalTitle: "The same quotient, two questions",
      formal: [
        "If total = divisor × quotient, then total ÷ divisor is the quotient. Sharing asks for the size of each group. Grouping asks for the number of groups. Both equal the quotient.",
      ],
      pitfalls: [
        "A story that uses the quotient as the number of groups is a different division.",
        "Swapping the total and the divisor, as in 8 ÷ 56, does not match a story that starts with the total.",
      ],
      parentGuide:
        "Ask which number is the total. If the total is already on the table, the story is division. If the story is building the total from equal groups, it is multiplication.",
    }),
  ],
  methods: {
    "story-for-expression": method(
      "Match a product or a quotient to the story with the same structure.",
      [
        "A product is equal groups with the total unknown.",
        "A quotient gives the total and either the number of groups or the number in each group.",
        "Reject addition, subtraction, and a swapped division.",
      ],
    ),
    "story-both-interpretations": method(
      "Select both the sharing story and the grouping story for one division.",
      [
        "Sharing and grouping both start from the same total and the same divisor.",
        "Leave out the product story and the story that uses the quotient as the divisor.",
      ],
    ),
  },
  principles: {
    "story-for-expression":
      "total = groups × amount. A product asks for the total. A quotient gives the total and asks for the groups or the amount.",
    "story-both-interpretations":
      "total ÷ divisor is both a sharing question and a grouping question. They name the same three numbers.",
  },
} satisfies ContentFamily;
