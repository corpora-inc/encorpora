import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const linkedEquationMethods: Record<string, ProblemMethod> = {
  "linked-division-equations": {
    goal: "Choose the linked equations or the one combined equation for a story that shares a total equally, then shares or multiplies.",
    intuition:
      "Some stories take two steps. The answer to step one is used in step two. Dividing, shown by ÷, splits a number into equal groups. Multiplying, shown by ×, counts equal groups: $3 \\times 9$ is 3 groups of 9. A number sentence uses numbers and signs. An equation is a number sentence with an equals sign, like $108 \\div 2 = 54$. A letter such as $a$ stands for a number we do not know yet. Linked equations are two equations where the answer of the first is used in the second.",
    terms: [
      [
        "equation",
        "In linked equations, the answer to the first equation is used as a number in the second.",
      ],
      [
        "equation",
        "The combined equation does both steps at once, with the first step in parentheses.",
      ],
    ],
    method: [
      "Write step one. Splitting or sharing equally means divide: $108 \\div 2 = a$.",
      "Write step two with the answer $a$. Share it again by dividing, ÷. Or find how many are in several of the equal groups by multiplying, ×.",
      "Choose the choice with these numbers and signs in this order. Its first answer must be used in step two.",
    ],
    watch:
      "Sharing equally divides. Finding several equal groups multiplies. Put each number in the step where the story uses it.",
  },
  "linked-time-equations": {
    goal: "Choose the pair of linked equations, or the one combined equation, that finds the time left after two parts have passed.",
    intuition:
      "Some stories take two steps. The answer to step one is used in step two. A number sentence uses numbers and signs. An equation is a number sentence with an equals sign, like $80 - 23 = 57$. Time that has passed is taken away from the whole time. After the first part, some time is left. The second part is taken away from what is left. A letter such as $a$ stands for a number we do not know yet. Linked equations are two equations where the answer of the first is used in the second.",
    terms: [
      [
        "elapsed-time",
        "Time remaining is the total time minus all the time already elapsed.",
      ],
      [
        "equation",
        "In linked equations, the answer to the first equation is used as a number in the second.",
      ],
    ],
    method: [
      "Write step one: the whole time minus the first part gives the time left, $a$.",
      "Write step two with that answer: the time left, $a$, minus the second part.",
      "Choose the choice that takes both parts away from the whole, in that order. It never adds time back.",
    ],
    watch:
      "Take both parts away from the whole time. Adding a part, or taking the whole away from a part, does not give the time left.",
  },
};

export const linkedEquationPrinciples: Record<string, string> = {
  "linked-division-equations":
    "Share 30 equally among 6 friends: $30 \\div 6 = 5$ each. Then 3 of those friends hold $5 \\times 3 = 15$. Parentheses ( ) mark the step to do first, so $(30 \\div 6) \\times 3 = 5 \\times 3 = 15$. In general, let $N$ be the total and $g$ the number of equal shares. Each share is $N\\div g$. Then $m$ of those shares hold $(N\\div g)\\times m$.",
  "linked-time-equations":
    "Parentheses ( ) mark the step to do first. If 90 minutes have parts of 35 and 28 minutes, the minutes left are $(90-35)-28=55-28=27$. The two parts use $35+28=63$ minutes together, and $90-63=27$ too. So $(90-35)-28=90-(35+28)$. In general, let $T$ be the whole time and $p$ and $q$ the two parts. Then $(T-p)-q=T-(p+q)$ minutes are left. Each linked equation must use the answer of the one before.",
};

export const linkedEquationLessons = [
  chainLesson({
    id: "linked-equations",
    title: "Linked equations for a two-step story",
    summary:
      "Some stories take two steps. A number sentence uses numbers and signs, like 8 − 3 = 5. Write a number sentence for step one. Then use its answer in step two. You can also write both steps as one number sentence.",
    templateIds: ["linked-division-equations", "linked-time-equations"],
    objectives: [
      "Write a number sentence for the first step of a two-step story, and name its answer with a letter.",
      "Use that answer in a second number sentence, or put both steps in one number sentence.",
    ],
    openingTitle: "The first answer is used in the second step",
    opening: [
      "Some stories take two steps. Here is one.",
      "A class of 30 children splits into 2 equal groups. Then each group splits into 5 equal teams.",
      "Step one finds how many are in a group. Step two uses that number.",
      "The sign ÷ means split into equal groups. An equation is a number sentence with an equals sign, like 30 ÷ 2 = 15. It says 30 split into 2 equal groups is 15 in each.",
      "A letter can stand for a number we do not know yet. Let $a$ stand for the answer to step one: $30\\div2=a$.",
      "Step two uses $a$: $a\\div5=t$. Here $t$ stands for the number of children on each team.",
      "These two number sentences are called linked equations. The first answer links them.",
      "You can also write both steps in one number sentence. Parentheses ( ) go around step one, to show it comes first: $(30\\div2)\\div5=t$.",
    ],
    example: {
      prompt:
        "A movie is 90 minutes long. The first part lasts 35 minutes and the second part lasts 28 minutes. Write linked equations for the minutes left, $m$.",
      steps: [
        "Time that passes is taken away. After the first part, $90-35=a$. So $a=55$ minutes are left.",
        "The second part takes 28 more minutes away from what is left: $a-28=m$.",
        "So the linked equations are $90-35=a$ and $a-28=m$. That gives $m=55-28=27$ minutes.",
        "As one number sentence, put step one in parentheses: $(90-35)-28=m$.",
      ],
      answer: "$90-35=a$ and $a-28=m$",
    },
    methodTitle: "One step at a time, in the story's order",
    method: [
      "Read the story one sentence at a time. Pick the sign for each step. Sharing equally: divide, ÷, to find how many are in each group. Several equal groups: multiply, ×, to find how many in all. Time that passes: take away, −.",
      "Use each answer in the next step. For one number sentence, put step one in parentheses where its letter was. In $a-28=m$, the letter $a$ stands for $90-35$, so write $(90-35)-28=m$. The parentheses ( ) mark the step to do first.",
    ],
    formalTitle: "Why the order of the steps matters",
    formal: [
      "Step two works on the answer of step one. So the order of the steps matters.",
      "With dividing and taking away, the order of the numbers matters too. 30 ÷ 2 splits 30 things into 2 equal groups. 2 ÷ 30 would split just 2 things among 30 groups, a very different question. So put each number where the story puts it.",
      "Parentheses show which step comes first. $(30\\div2)\\div5=15\\div5=3$ matches the story. Moving parentheses can change the answer: $(12-4)-2=6$, but $12-(4-2)=10$.",
    ],
    pitfalls: [
      "Match each sign to the story. Divide to share. Multiply for several equal groups. Take away for time that has passed.",
      "Put each number in the step where the story uses it.",
      "Do not add time back when the story says time has passed.",
    ],
    parentGuide:
      "Ask your learner to read the story one sentence at a time and say what number each sentence makes.",
  }),
];

export const linkedEquationFacetMappings: FacetMapping[] = [
  {
    templateId: "linked-division-equations",
    facetId: "multiplicative-stories.operation-model",
    extent: "partial",
    rationale:
      "Single choice of the linked pair or the combined equation for a total halved and shared again, or shared equally and multiplied for several holders, with whole-number results. Does not assess solving the story, choosing equations with a letter for the unknown in other positions, or stories with remainders.",
  },
  {
    templateId: "linked-time-equations",
    facetId: "two-step-stories.core",
    extent: "partial",
    rationale:
      "Single choice of the linked pair or the combined equation that finds the minutes left after two periods within 100 minutes. Does not assess solving it, elapsed time across hours, or writing the equations unaided.",
  },
];
