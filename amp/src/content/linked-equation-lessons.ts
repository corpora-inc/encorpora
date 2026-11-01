import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const linkedEquationMethods: Record<string, ProblemMethod> = {
  "linked-division-equations": {
    goal: "Choose the linked equations or the one combined equation for a story that shares a total equally, then shares or multiplies.",
    intuition:
      "Some stories take two steps. The answer to step one is used in step two. An equation is a number sentence with an equals sign, like $108 \\div 2 = 54$. The sign ÷ means split into equal groups. The sign × means groups of: $3 \\times 9$ is 3 groups of 9. A letter such as $a$ stands for a number we do not know yet. Linked equations are two equations where the answer of the first is used in the second.",
    terms: [
      [
        "equation",
        "In linked equations, the answer to the first equation is an input to the second.",
      ],
      [
        "equation",
        "The combined equation does both steps at once, with the first step in parentheses.",
      ],
    ],
    method: [
      "Write step one. Splitting or sharing equally means divide: $108 \\div 2 = a$.",
      "Write step two with the answer $a$. Share it again by dividing, or find several of the equal groups by multiplying.",
      "Choose the choice with these numbers and signs in this order. Its first answer must be used in step two.",
    ],
    watch:
      "Sharing equally divides. Finding several equal groups multiplies. Put each number in the step where the story uses it.",
  },
  "linked-time-equations": {
    goal: "Choose the pair of linked equations, or the one combined equation, that finds the time left after two parts have passed.",
    intuition:
      "Some stories take two steps. The answer to step one is used in step two. An equation is a number sentence with an equals sign, like $80 - 23 = 57$. Time that has passed is taken away from the whole time. After the first part, some time is left. The second part is taken away from what is left. A letter such as $a$ stands for a number we do not know yet.",
    terms: [
      [
        "elapsed-time",
        "Time remaining is the total time minus all the time already elapsed.",
      ],
      [
        "equation",
        "In linked equations, the answer to the first equation is an input to the second.",
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
    "Split 30 into 2 equal groups: $30 \\div 2 = 15$ in each. Then 3 of those groups hold $(30 \\div 2) \\times 3 = 45$. In general, a total $N$ split into $g$ equal groups puts $N\\div g$ in each, and $m$ of those groups hold $(N\\div g)\\times m$. The parentheses ( ) show which step is done first.",
  "linked-time-equations":
    "If 90 minutes have parts of 35 and 28 minutes, the minutes left are $(90-35)-28=90-(35+28)=27$. In general, with $T$ minutes in all and parts of $a$ and $b$ minutes, $(T-a)-b=T-(a+b)$ minutes are left. Each linked equation must use the answer of the one before.",
};

export const linkedEquationLessons = [
  chainLesson({
    id: "linked-equations",
    title: "Linked equations for a two-step story",
    summary:
      "Some stories take two steps. Write a number sentence for step one. Then use its answer in step two. You can also write both steps as one number sentence.",
    templateIds: ["linked-division-equations", "linked-time-equations"],
    objectives: [
      "Write a number sentence for the first step of a two-step story, and name its answer with a letter.",
      "Use that answer in a second number sentence, or put both steps in one number sentence.",
    ],
    openingTitle: "The first answer is used in the second step",
    opening: [
      "Some stories take two steps. Here is one.",
      "A class of 30 children splits into 2 equal groups. Then each group splits into 5 teams.",
      "Step one finds how many are in a group. Step two uses that number.",
      "An equation is a number sentence with an equals sign, like 30 ÷ 2 = 15. The sign ÷ means split into equal groups. So 30 split into 2 equal groups is 15 in each.",
      "A letter can stand for a number we do not know yet. Let $a$ stand for the answer to step one: $30\\div2=a$.",
      "Step two uses $a$: $a\\div5=t$. Here $t$ stands for the children on each team.",
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
      "Read the story one sentence at a time. Pick the sign for each step. Sharing equally: divide, ÷. Several equal groups: multiply, ×. Time that passes: take away, −.",
      "Use each answer in the next step. For one number sentence, put step one in parentheses where its letter was.",
    ],
    formalTitle: "Why the order of the steps matters",
    formal: [
      "Step two works on the answer of step one. So the order of the steps matters.",
      "With dividing and taking away, the order of the numbers matters too. 30 ÷ 2 is 15, but 2 ÷ 30 is a small part of 1. So put each number where the story puts it.",
      "Parentheses show which step comes first. $(30\\div2)\\div5=3$ matches the story. Moving them changes the answer: $30\\div(2\\div5)=75$.",
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
