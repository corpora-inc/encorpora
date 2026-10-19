import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const earlyDataLessons: Lesson[] = [
  {
    id: "sort-and-count",
    title: "Sort, then count",
    summary: "Put things that match into groups, then count each group.",
    templateIds: ["sort-shapes-count", "sort-shapes-most"],
    objectives: [
      "Sort objects into groups by one attribute, such as shape.",
      "Count each group and compare the counts to find the most and the fewest.",
    ],
    sections: [
      {
        title: "Sorting makes counting easy",
        paragraphs: [
          "To sort is to put each object in the group it matches. Every object goes in exactly one group, so no object is counted twice or missed.",
          "These nine shapes sort into 4 circles, 2 squares and 3 triangles. The three counts add back to 9, the number of shapes in the picture.",
        ],
        illustration: "data-sorted-groups",
      },
      {
        title: "Compare the groups",
        paragraphs: [
          "After counting, the group with the greatest count has the most. The group with the least count has the fewest.",
          "Compare counts, not how much space a group takes up: a few large shapes can cover more of the page than many small ones.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Sort 4 circles, 2 squares and 3 triangles by kind. Which kind has the fewest shapes?",
      steps: [
        "Count each group: 4 circles, 2 squares, 3 triangles.",
        "2 is the least of 4, 2 and 3.",
      ],
      answer: "squares",
    },
    pitfalls: [
      "Touch each object once; mark it as you count so it is not counted again.",
      "Check that the group counts add up to the total number of objects.",
    ],
    parentGuide:
      "Empty a handful of buttons, coins or blocks onto a table. Sort them by one feature, count each pile, and ask which pile has the most and which has the fewest.",
  },
  {
    id: "picture-graphs-one-to-one",
    title: "Read a picture graph",
    summary:
      "Each symbol is one answer; match rows symbol by symbol to compare.",
    templateIds: ["picture-graph-questions"],
    objectives: [
      "Find the number in each category and the total of all categories.",
      "Find how many more or how many fewer one category has than another.",
    ],
    sections: [
      {
        title: "One symbol, one student",
        paragraphs: [
          "In this picture graph, each student chose one fruit, and each symbol stands for 1 student. Count a row to find how many chose that fruit.",
          "Add every row to find how many students answered in all: 7 + 4 + 5 = 16.",
        ],
        illustration: "data-picture-one-to-one",
      },
      {
        title: "How many more? Match, then count what is left",
        paragraphs: [
          "Line up the apple row with the pear row. The first 4 apple symbols each have a pear partner; 3 apple symbols have none. So 3 more students chose apple than pear.",
          "“How many fewer chose pear than apple?” asks the same thing from the other side. The answer is also 3: 7 − 4 = 3.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The picture graph shows 7 apple, 4 pear and 5 plum. How many more students chose plum than pear?",
      steps: [
        "Plum has 5 symbols and pear has 4.",
        "Match them one to one: 1 plum symbol has no partner. 5 − 4 = 1.",
      ],
      answer: "1",
    },
    pitfalls: [
      "“How many more” is a difference, not a total: subtract, do not add.",
      "“How many fewer” compares the same two rows; it is never a negative number.",
    ],
    parentGuide:
      "Ask family members to choose a favorite fruit and draw one circle per vote in rows. Ask how many voted in all, and how many more chose one fruit than another.",
  },
  {
    id: "scaled-graphs",
    title: "Graphs with a scale",
    summary:
      "When a symbol or grid step stands for more than 1, multiply by the key or count by the scale.",
    templateIds: ["scaled-picture-graph", "scaled-bar-graph"],
    objectives: [
      "Read a picture graph whose symbol stands for 2, 5 or 10, including half symbols.",
      "Read bars on a scale that counts by 2, 5 or 10, including bars that end halfway between lines, and solve one- and two-step comparisons.",
    ],
    sections: [
      {
        title: "Read the key first",
        paragraphs: [
          "Here each symbol stands for 10 students. Dog has 4 whole symbols and a half symbol: 4 × 10 + 5 = 45. Half a symbol is half the key.",
          "Cat has 3 symbols, 30 students. Dog has 1 1/2 more symbols than cat, and 1 1/2 symbols stand for 15 students: 45 − 30 = 15.",
        ],
        illustration: "data-picture-key",
      },
      {
        title: "Count by the scale",
        paragraphs: [
          "The grid lines count by 10s. Tuesday’s bar ends halfway between 40 and 50, which is 45. Wednesday’s ends halfway between 10 and 20, at 15.",
          "A two-step question needs two operations. Compare Monday and Wednesday together with Thursday: first add, 30 + 15 = 45; then subtract, 50 − 45 = 5. Thursday alone collected 5 more cans than those two days together.",
        ],
        illustration: "data-scaled-bars",
      },
    ],
    workedExample: {
      prompt:
        "In the bar graph, Monday is 30, Tuesday is 45 and Wednesday is 15 cans. How many more cans were collected on Tuesday and Wednesday together than on Monday?",
      steps: ["Together: 45 + 15 = 60.", "Compare with Monday: 60 − 30 = 30."],
      answer: "30",
    },
    pitfalls: [
      "A grid step or a symbol is not always 1. Read the key or the scale before counting.",
      "In a two-step question, finish the first step (the total) before comparing.",
    ],
    parentGuide:
      "Make a picture graph where each sticker stands for 2 votes. Show 7 votes with three stickers and half a sticker, and ask your child to explain why.",
  },
];

export const earlyDataMethods: Record<string, ProblemMethod> = {
  "sort-shapes-count": {
    goal: "Count the shapes in one group after sorting by kind.",
    terms: [["sort", "Put each object in the one group it matches."]],
    method: [
      "Make a group for each kind of shape.",
      "Count the group the question names, touching each shape once.",
    ],
    watch: "Count only the named kind; skip shapes of other kinds.",
  },
  "sort-shapes-most": {
    goal: "Sort shapes by kind and choose the group with the most or the fewest.",
    method: [
      "Sort the shapes into groups by kind.",
      "Count every group.",
      "Choose the greatest count for most, the least for fewest.",
    ],
    watch: "Compare the counts, not how much space the shapes cover.",
  },
  "picture-graph-questions": {
    goal: "Use a picture graph where each symbol is one student to find a total or a difference.",
    method: [
      "Count the symbols in each row the question names.",
      "For “in all”, add the rows. For “more” or “fewer”, subtract the smaller count from the larger.",
    ],
    watch: "“How many more” asks for a difference, not a total.",
  },
  "scaled-picture-graph": {
    goal: "Read a picture graph whose symbol stands for 2, 5 or 10 and compare rows.",
    terms: [
      ["key", "What one symbol stands for. Half a symbol is half the key."],
    ],
    method: [
      "Read the key.",
      "For each row, multiply whole symbols by the key and add half the key for a half symbol.",
      "Add or subtract the row values as the question asks.",
    ],
    watch: "Each symbol stands for the key, not for 1.",
  },
  "scaled-bar-graph": {
    goal: "Read bars on a scale of 2, 5 or 10 and solve one- or two-step comparisons.",
    terms: [
      ["scale", "The amount between neighboring grid lines."],
      ["halfway", "Half a scale step above the line below."],
    ],
    method: [
      "Find the scale from the axis labels.",
      "Read where each named bar ends, including halfway values.",
      "Add first for a combined amount; then subtract to compare.",
    ],
    watch: "Read values on the axis; do not count grid squares as 1.",
  },
};
export const earlyDataPrinciples: Record<string, string> = {
  "sort-shapes-count":
    "Sorting puts each object in exactly one group, so the group counts add to the whole collection.",
  "sort-shapes-most":
    "After sorting, the group with the greatest count has the most and the one with the least count has the fewest.",
  "picture-graph-questions":
    "Matching two rows symbol by symbol leaves the difference unmatched: how many more = larger count − smaller count.",
  "scaled-picture-graph":
    "Each symbol stands for the key, so a row’s value is (whole symbols × key) + (half the key for a half symbol).",
  "scaled-bar-graph":
    "A bar’s value is read on the axis scale, so its height, not a count of grid squares, gives the amount.",
};
