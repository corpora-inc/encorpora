import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const linkedEquationMethods: Record<string, ProblemMethod> = {
  "linked-division-equations": {
    goal: "Choose the linked equations or the combined equation for a story that splits or shares a total equally, then shares or multiplies.",
    intuition:
      "A two-step story needs two operations in the order the story tells them. The answer to the first step is a new number that the second step uses. A letter such as $a$ stands for that new number, so the first equation defines it and the second equation uses it.",
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
      "Write what the first sentence of the story does to the total: splitting or sharing equally is division.",
      "Write the second step using the result of the first: share it again by dividing, or find several of the equal groups by multiplying.",
      "Choose the option whose operations and numbers appear in this order, with the first result used in the second step.",
    ],
    watch:
      "Sharing equally divides and finding several equal groups multiplies. Match each number to the step that the story gives it.",
  },
  "linked-time-equations": {
    goal: "Choose the pair of linked equations, or the one combined equation, that finds the time remaining after two periods have passed.",
    intuition:
      "Time that has passed is taken away from the whole. After the first period some time is left; the second period takes away from what is left. The time remaining is the whole minus both periods.",
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
      "Write the first subtraction: the total minus the first period gives the time left after the first part.",
      "Write the second subtraction using that result: the time left minus the second period.",
      "Choose the option that subtracts both periods from the total, in that order, and never adds time back.",
    ],
    watch:
      "Both periods are taken away from the total. An equation that adds a period, or subtracts the total from a period, does not give the time left.",
  },
};

export const linkedEquationPrinciples: Record<string, string> = {
  "linked-division-equations":
    "A two-step story is modeled by an equation for each step, with the result of the first used in the second. Splitting a total $N$ equally into $g$ groups gives $N\\div g$ in each; $m$ of those groups hold $(N\\div g)\\times m$. The combined equation puts the first step in parentheses.",
  "linked-time-equations":
    "If a whole of $T$ minutes has had periods of $a$ and $b$ minutes pass, the minutes left are $(T-a)-b=T-(a+b)$. Subtracting in either order gives the same value, but each linked equation must use the result of the previous one.",
};

export const linkedEquationLessons = [
  chainLesson({
    id: "linked-equations",
    title: "Linked equations for a two-step story",
    summary:
      "Write the first step as an equation, use its result in the second step, and choose the pair or the combined equation.",
    templateIds: ["linked-division-equations", "linked-time-equations"],
    objectives: [
      "Write the equation for the first step of a two-step story and name its result with a letter.",
      "Use that result in a second equation, or combine both steps into one equation with parentheses.",
    ],
    openingTitle: "The first answer is an input of the second step",
    opening: [
      "Some stories take two steps. A class of 30 students splits into 2 equal groups, and each group then splits into 5 teams. The first step finds the size of a group, and the second step uses that size.",
      "Give the first result a letter, such as $a$. The first equation says what $a$ is: $30\\div2=a$. The second equation uses it: $a\\div5=t$. Putting both steps in one equation needs parentheses around the first step: $(30\\div2)\\div5=t$.",
    ],
    example: {
      prompt:
        "A movie is 90 minutes long. The first part lasts 35 minutes and the second part lasts 28 minutes. Write linked equations for the minutes left, $m$.",
      steps: [
        "After the first part, $90-35=a$, so $a=55$ minutes are left.",
        "The second part takes away 28 minutes: $a-28=m$.",
        "The linked equations are $90-35=a$ and $a-28=m$, and $m=55-28=27$.",
        "As one equation: $(90-35)-28=m$.",
      ],
      answer: "$90-35=a$ and $a-28=m$",
    },
    methodTitle: "One step at a time, in the story's order",
    method: [
      "Read the story one sentence at a time. Give each step an equation with the right operation: sharing equally divides, several equal groups multiply, time that passes subtracts.",
      "Use the result of each equation in the next. To write one equation, replace the result letter by its equation in parentheses.",
    ],
    formalTitle: "Why the order of the steps matters",
    formal: [
      "Each step is a function of the previous result, so the model is a composition: the second operation is applied to the value of the first. Division and subtraction are not commutative, so the numbers must sit in the positions the story gives them.",
      "Parentheses show which step is done first, so $(30\\div2)\\div5$ matches the story. Division is not associative: $30\\div(2\\div5)=75$ is a different number.",
    ],
    pitfalls: [
      "Match each operation to what the story does: divide to share, multiply for several equal groups, subtract for time that has passed.",
      "Put each number in the step the story gives it.",
      "Do not add time back when the story says time has passed.",
    ],
    parentGuide:
      "Ask your learner to read the story one sentence at a time and say what number each sentence creates.",
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
