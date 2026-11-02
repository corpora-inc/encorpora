import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const variableStoryMethods: Record<string, ProblemMethod> = {
  "variable-in-situation": {
    goal: "Decide which quantity in a story can change, a variable, and which always stays the same, a constant.",
    senses: { change: "change" },
    noLink: ["part", "more than", "whole"],
    intuition:
      "A quantity is an amount you can count or measure, such as a number of nights or a number of pages. A quantity that can take different values (be different numbers) is called a variable. A quantity that keeps the same value the whole time is called a constant. Sam reads 8 pages every night. The story fixes the 8 pages each night, so it is a constant. The number of nights grows: 1, 2, 3, and so on. So it is a variable. The total pages read so far grows by 8 each night, so it is a variable too.",
    terms: [
      [
        "variable",
        "Here the variable is the quantity that changes, such as the number of nights. A letter like $n$ can stand for it.",
      ],
      "constant",
    ],
    method: [
      "Read each choice and name the quantity it describes.",
      "Ask: could this quantity be a different number at another time, or in another case of the same story?",
      "If the story fixes it for the whole time, like 8 pages every night, it is a constant. A fact such as 7 days in a week is a constant too.",
      "If it grows, shrinks or can be different from case to case, like the number of nights, it is a variable.",
    ],
    watch:
      "Check what the story says about each quantity, not just whether it has a number. The story may fix a total, like 24 markers to share, or it may build one up night after night.",
  },
  "story-for-subtraction-sentence": {
    goal: "Match a subtraction sentence with one unknown amount to the story that asks for that same amount.",
    noLink: ["leaves", "change", "changes", "side"],
    intuition:
      "A subtraction story starts with an amount, takes some away, and ends with what is left. So it has three amounts: the start, the amount taken away and the amount left. In $20 - 8 = 12$, 20 is the start, 8 is taken away and 12 is left. The unknown is the amount the story asks you to find. In a subtraction sentence, a short math statement such as $20 - 8 = 12$, a letter such as $n$ stands for it. The same three numbers can tell different stories, depending on which amount is unknown.",
    terms: [
      ["subtraction", "The start is the amount before anything is taken away."],
      ["change", "In a take-away story, the change is the amount taken away."],
      ["difference-subtract", "Here, the result is the amount left."],
    ],
    method: [
      "Name the roles. The number before the minus sign is the start. The number after the minus sign is the amount taken away. The number on the other side of the equals sign is the amount left.",
      "Find where $n$ sits. That amount is the one the story must ask for.",
      "Choose the story that gives the other two amounts and asks for that one.",
      "A story where someone gets more and asks how many in all joins two amounts. Its sentence adds, so it does not match this take-away sentence.",
    ],
    watch:
      "Stories with the same numbers can ask for different amounts. Check what the question asks for, not only which numbers appear.",
  },
};

export const variableStoryPrinciples: Record<string, string> = {
  "variable-in-situation":
    "A variable is a quantity that can have more than one value in a situation. A constant is a quantity with one value for the whole situation. A count that grows over time is a variable. So is a total built up from it, such as the pages read so far.",
  "story-for-subtraction-sentence":
    "A take-away story relates three amounts: start $-$ taken away $=$ left. Any one of them can be the unknown. $n = 20 - 8$ asks for the amount left. $20 - n = 12$ asks for the amount taken away. $n - 8 = 12$ asks for the start. A story where someone gets more and asks for the total is a joining story. It is written with addition (putting amounts together), such as $8 + 12 = n$.",
};

export const variableStoryLessons = [
  {
    ...chainLesson({
      id: "variable-in-situation-lesson",
      title: "Quantities that change and quantities that stay the same",
      summary:
        "A quantity is an amount you can count or measure, like a number of weeks or of dollars. Some quantities in a story change and some stay the same. A quantity that can change is called a variable. A quantity that always stays the same is called a constant.",
      templateIds: ["variable-in-situation"],
      objectives: [
        "Say what makes a quantity a variable and what makes it a constant.",
        "Pick the one changing quantity, or the one fixed quantity, in a short story.",
      ],
      openingTitle: "Can it change?",
      opening: [
        "Ana saves 5 dollars every week. The story says she saves the same 5 dollars each week. So that amount never changes.",
        "Other quantities in the story do change. The number of weeks she has saved goes up by 1 each week: 1, 2, 3, and so on. The total she has saved goes up by 5 dollars each week: 5, 10, 15, and so on.",
        "A value is the number a quantity has at one moment. A quantity that can take different values is called a variable. We often write a letter for it, such as $w$ for the number of weeks. A quantity that keeps one value the whole time is called a constant. The 5 dollars each week is a constant. So is a fact that is always true, like 7 days in a week.",
      ],
      example: {
        prompt:
          "Sam reads 8 pages every night. Which quantity is a variable: the pages per night, the number of nights, or the minutes in an hour?",
        steps: [
          "Ask of each quantity: can it be a different number later in the story?",
          "Pages per night: the story says Sam reads 8 pages every night. It is always 8, so it is a constant.",
          "Minutes in an hour: an hour always has 60 minutes. It is always 60, so it is a constant.",
          "Number of nights: after 1 night it is 1, after 2 nights it is 2, and it keeps growing. It takes different values, so it is the variable.",
        ],
        answer: "The number of nights",
      },
      methodTitle: "Ask about each quantity",
      method: [
        "For each quantity, ask: could it be a different number at another time, or in another case of the story?",
        "The story may fix an amount for the whole time, like 8 pages every night. Then it is a constant. A fact about measuring, such as 60 minutes in an hour or 100 cents in a dollar, is a constant too.",
        "A count that grows as time passes, like the number of nights, is a variable. So is a total built up from it, like the pages read so far, because it grows by 8 each night.",
      ],
      formalTitle: "Variables and constants",
      formal: [
        "A variable is a quantity that can have more than one value in a situation. A constant is a quantity that has the same value throughout the situation.",
        "To decide, look at what the story says about the quantity, not just whether a number is written. A total that grows with a changing count, such as the dollars saved after each week, is a variable.",
      ],
      pitfalls: [
        "A number written in the story is not always a variable. The 8 pages each night is written as a number, and it is a constant.",
        "Some totals are fixed by the story, like a teacher who has 24 markers to share. Others build up, like the pages read so far, and those are variables. Check what the story says about each total.",
        "A fact such as 60 minutes in an hour never changes. It is a constant.",
      ],
      parentGuide:
        "Pick a quantity from the story. Ask your learner whether the story lets it be a different number at some point. If the story fixes it for the whole time, it is a constant. If it can grow, shrink or differ from case to case, it is a variable.",
    }),
    senses: { change: "change" },
    noLink: ["units", "whole", "more than"],
  },
  {
    ...chainLesson({
      id: "subtraction-story-sentence-lesson",
      title: "Stories for a subtraction sentence",
      summary:
        "Subtraction means taking an amount away. A subtraction sentence is a short math statement like $20 - 8 = 12$. It tells a take-away story with three amounts: the start, the amount taken away and the amount left. A letter such as $n$ can stand for one unknown amount. The story that fits asks for that same amount.",
      templateIds: ["story-for-subtraction-sentence"],
      objectives: [
        "Name the start, the amount taken away and the amount left in a subtraction sentence.",
        "Choose the story whose question asks for the unknown amount in the sentence.",
      ],
      openingTitle: "Start, take away, left",
      opening: [
        "A subtraction story has three amounts. The start is how many there are at first. The amount taken away is how many are removed. The amount left is how many remain. The sentence start $-$ taken away $=$ left puts them in that order.",
        "For example, Mia has 20 stickers and gives away 8. She has 12 left, because $20 - 8 = 12$. Here 20 is the start, 8 is taken away and 12 is left.",
        "Any one of the three amounts can be the unknown, the number the story asks you to find. A letter such as $n$ stands for it in the sentence. If Mia has 20 stickers and gives away 8, the story asks for what is left: $20 - 8 = n$. If Mia has some, gives away 8 and has 12 left, the story asks for the start: $n - 8 = 12$.",
      ],
      example: {
        prompt:
          "Which story fits $n-8=12$? Story 1: Mia has 20 stickers and gives away 8. How many are left? Story 2: Mia has some stickers, gives away 8 and has 12 left. How many did she start with?",
        steps: [
          "Read $n - 8 = 12$ as start $-$ taken away $=$ left. The letter $n$ is in the start's place, 8 is taken away, and 12 is left. So the story must ask for the start.",
          "Story 1 gives the start, 20, and asks how many are left. Its sentence is $20 - 8 = n$, with $n$ in the place of the amount left. That does not match.",
          "Story 2 gives the amount taken away, 8, and the amount left, 12. It asks how many Mia started with. That is the start, where $n$ sits, so Story 2 fits.",
        ],
        answer: "Story 2",
      },
      methodTitle: "Match the roles",
      method: [
        "When the subtraction comes first, as in $20 - 8 = 12$, the number before the minus sign is the start. The number after the minus sign is the amount taken away. The number after the equals sign is the amount left.",
        "Sometimes the sentence is written the other way round, as in $n = 20 - 8$. Then the amount left comes first, before the equals sign. The start minus the amount taken away comes after it.",
        "The letter marks the unknown amount. Pick the story whose question asks for that amount, and check that the other two numbers play the same roles.",
      ],
      formalTitle: "Three subtraction relationships",
      formal: [
        "Call the start $a$, the amount taken away $b$ and the amount left $c$. Then $a - b = c$.",
        "Each sentence leaves one amount unknown. $n = a - b$ asks for the amount left. $a - n = c$ asks for the amount taken away. $n - b = c$ asks for the start.",
        "The same three amounts are also linked by addition: the amount left plus the amount taken away is the start, $c + b = a$. A story where someone gets more and asks for the total is a different situation. Its sentence adds, such as $8 + 12 = n$.",
      ],
      pitfalls: [
        "Choosing a story only because it uses the same numbers. Check that each number plays the same role.",
        "Choosing a story where someone gets more and asks for the total. That story joins two amounts, so its sentence is an addition (putting amounts together), such as $8 + 12 = n$.",
        "Not checking which amount the question asks for. It must be the amount where the letter sits.",
      ],
      parentGuide:
        "Act the story out with counters. Ask your learner which amount is hidden, and where that amount sits in the sentence.",
    }),
    noLink: ["leaves"],
  },
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
