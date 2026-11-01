import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const variableStoryMethods: Record<string, ProblemMethod> = {
  "variable-in-situation": {
    goal: "Tell a quantity that can change, a variable, from a quantity that always stays the same, a constant.",
    intuition:
      "In a story, some numbers are set once and never change, like the pages read each night. Others take new values as the story goes on, like the number of nights. A letter can stand for a quantity that changes.",
    terms: ["variable", "constant"],
    method: [
      "List each quantity in the choices.",
      "Ask of each one: as the story goes on, does it take new values or does it always stay the same?",
      "A quantity that grows, shrinks or depends on a changing count is a variable. A rate, a fixed total or a fact such as 7 days in a week is a constant.",
    ],
    watch:
      "A total can depend on a count that changes, so it changes too. A number in the story, like the pages per night, stays fixed.",
  },
  "story-for-subtraction-sentence": {
    goal: "Match a subtraction sentence with the unknown in one place to the story that has the same numbers in the same roles.",
    intuition:
      "A subtraction story starts with an amount, takes some away and leaves some. Which of those three amounts is the unknown changes the story, even when the same three numbers are used. The sentence shows where the unknown sits.",
    terms: [
      ["subtraction", "The start is the amount before anything is taken away."],
      ["change", "In a take-away story, the change is the amount taken away."],
      ["difference-subtract", "Here, the result is the amount left."],
    ],
    method: [
      "Name the three roles in the sentence: the number before the minus sign is the start, the number after it is the amount taken away, and the number after the equal sign is what is left.",
      "Find where $n$ sits: that role is the unknown the story must ask for.",
      "Choose the story that asks for that role and gives the other two. Reject an addition story.",
    ],
    watch:
      "Stories with the same numbers can ask for different unknowns. Check what the question asks for, not only which numbers appear.",
  },
};

export const variableStoryPrinciples: Record<string, string> = {
  "variable-in-situation":
    "A variable is a symbol or quantity that can take more than one value in a situation; a constant has one fixed value. A quantity that depends on a changing count or amount also changes.",
  "story-for-subtraction-sentence":
    "A subtraction situation relates three amounts by start $-$ taken away $=$ left. Any one can be the unknown: $n=a-b$ asks for what is left, $a-n=c$ asks for the amount taken away, and $n-b=c$ asks for the start. The same numbers with addition describe a different situation.",
};

export const variableStoryLessons = [
  chainLesson({
    id: "variable-in-situation-lesson",
    title: "Quantities that change and quantities that stay the same",
    summary:
      "Tell a variable from a constant in a situation with a fixed rate or total.",
    templateIds: ["variable-in-situation"],
    objectives: [
      "Say what makes a quantity a variable and what makes it a constant.",
      "Pick the one changing quantity, or the one fixed quantity, in a short situation.",
    ],
    openingTitle: "Does it take new values?",
    opening: [
      "Ana saves 5 dollars every week. The 5 dollars is the same every week. The number of weeks goes up by one each time, and so does the total she has saved.",
      "A quantity that can take different values is a variable, and we often write a letter for it. A quantity that stays the same is a constant.",
    ],
    example: {
      prompt:
        "Sam reads 8 pages every night. Which quantity is a variable: the pages per night, the number of nights, or the minutes in an hour?",
      steps: [
        "Pages per night is 8 every night, so it is a constant.",
        "Minutes in an hour is always 60, so it is a constant.",
        "The number of nights grows as Sam keeps reading, so it is the variable.",
      ],
      answer: "The number of nights",
    },
    methodTitle: "Ask about each quantity",
    method: [
      "For each quantity ask: as time goes on, can it take a new value?",
      "A fixed rate, a fixed total and a fact about units are constants. A count of how long something goes on, and a total that depends on it, are variables.",
    ],
    formalTitle: "Variables and constants",
    formal: [
      "A variable represents a quantity whose value can vary across the situation. A constant is a quantity with one value throughout.",
      "If a quantity is determined by a variable, such as a total that depends on the number of weeks, it is a variable too.",
    ],
    pitfalls: [
      "Calling a number a variable only because the story uses a number. Numbers can be constants.",
      "Forgetting that a total depends on how long the story goes on, so it changes.",
      "Treating a fact such as 60 minutes in an hour as something that can change.",
    ],
    parentGuide:
      "Ask your learner what the number would be tomorrow, then next week. If it stays the same, it is a constant.",
  }),
  chainLesson({
    id: "subtraction-story-sentence-lesson",
    title: "Stories for a subtraction sentence",
    summary:
      "Match a subtraction sentence to the story that asks for its unknown.",
    templateIds: ["story-for-subtraction-sentence"],
    objectives: [
      "Name the start, the amount taken away and the amount left in a subtraction sentence.",
      "Choose the story that makes the unknown in the sentence the question.",
    ],
    openingTitle: "Start, take away, left",
    opening: [
      "A subtraction story has three amounts: the start, the amount taken away and the amount left. The sentence start $-$ taken away $=$ left puts them in order.",
      "Any one of the three can be the unknown. Mia has 20 stickers and gives away 8: the unknown is what is left. If she has some, gives away 8 and has 12 left, the unknown is the start.",
    ],
    example: {
      prompt:
        "Which story fits $n-8=12$? Story 1: Mia has 20 stickers and gives away 8. How many are left? Story 2: Mia has some stickers, gives away 8 and has 12 left. How many did she start with?",
      steps: [
        "In $n-8=12$, 8 is taken away and 12 is left, so $n$ is the start.",
        "Story 1 gives the start, 20, and asks for what is left, which is $20-8=n$.",
        "Story 2 gives the amount taken away, 8, and the amount left, 12, and asks for the start.",
      ],
      answer: "Story 2",
    },
    methodTitle: "Match the roles",
    method: [
      "In the sentence, the first number is the start, the number after the minus sign is taken away, and the number after the equal sign is left.",
      "The letter marks the unknown role. Pick the story whose question asks for that role.",
    ],
    formalTitle: "Three subtraction relationships",
    formal: [
      "With start $a$, taken away $b$ and left $c$: $a-b=c$. Sentences $n=a-b$, $a-n=c$ and $n-b=c$ each leave one amount unknown.",
      "Adding the taken away amount back to what is left gives the start: $c+b=a$, so addition stories belong to a different sentence.",
    ],
    pitfalls: [
      "Choosing a story only because it uses the same numbers.",
      "Choosing an addition story for a subtraction sentence.",
      "Not checking which amount the question asks about.",
    ],
    parentGuide:
      "Have your learner act the story out with counters and say which amount is hidden.",
  }),
];

export const variableStoryFacetMappings: FacetMapping[] = [
  {
    templateId: "variable-in-situation",
    facetId: "variable-expressions.core",
    extent: "partial",
    rationale:
      "Single choice of the one changing quantity or the one fixed quantity in a short story with a rate or a fixed total. Does not assess writing an expression with a letter, evaluating an expression, or naming the independent and dependent variable.",
  },
  {
    templateId: "story-for-subtraction-sentence",
    facetId: "one-step-equations.story-equation",
    extent: "partial",
    rationale:
      "Single choice of the story for a subtraction sentence with the result, the amount taken away or the start unknown, against an addition story, with whole numbers to 50. Does not assess writing the sentence for a story, solving the sentence, or multiplication and division stories.",
  },
];
