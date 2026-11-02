import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const earlyDataLessons: Lesson[] = [
  {
    id: "sort-and-count",
    title: "Sort, then count",
    summary:
      "To sort means to put things into groups, so everything in a group is alike. Each thing goes into exactly one group. Then count each group. The group with the biggest count has the most. The group with the smallest count has the fewest.",
    templateIds: ["sort-shapes-count", "sort-shapes-most"],
    senses: {
      sort: "sort",
      square: "square-shape",
      squares: "square-shape",
      side: "side",
      sides: "side",
    },
    noLink: ["whole", "parts"],
    objectives: [
      "Sort objects into groups by one attribute, such as shape.",
      "Count each group and compare the counts to find the most and the fewest.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Give each object one home",
        paragraphs: [
          "Say a pile has red buttons and blue buttons. Move each red button to the red group and each blue button to the blue group.",
          "Now count the red group, then the blue group. Each button is in one group only. So no button is missed, and none is counted twice.",
          "Shapes can be sorted by kind. A circle is a round shape. A square has 4 sides, the straight parts around its outside. All 4 sides are the same size, and its 4 corners, where the sides meet, are like the corner of a page. A triangle has 3 straight sides.",
        ],
      },
      {
        title: "Sorting makes counting easy",
        paragraphs: [
          "Look at the picture. The nine shapes are sorted into 4 circles, 2 squares and 3 triangles.",
          "Every shape went into exactly one group. So the three counts together make all 9 shapes. The sign + means add, or put more with. The sign = means makes, or is the same as. We write 4 + 2 + 3 = 9. That is a good check.",
        ],
        illustration: "data-sorted-groups",
      },
      {
        title: "Compare the groups",
        paragraphs: [
          "After counting, the group with the biggest count has the most. The group with the smallest count has the fewest.",
          "Compare the counts, not how much room a group takes up. A few large shapes can cover more of the page than many small ones.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "A complete sort",
        paragraphs: [
          "A good sort puts each object into exactly one group. The count in each group is how many objects it has. Adding the counts of all the groups gives the total number of objects sorted.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Sort 4 circles, 2 squares and 3 triangles by kind. Which kind has the fewest shapes?",
      steps: [
        "Make one group for each kind: a circle group, a square group and a triangle group. Put each shape in its group.",
        "Count each group: 4 circles, 2 squares, 3 triangles.",
        "The smallest of 4, 2 and 3 is 2. So the squares have the fewest.",
      ],
      answer: "squares",
    },
    pitfalls: [
      "Touch each object once. Mark it as you count, so you do not count it again.",
      "Count all the objects too. The group counts put together should make that same number.",
    ],
    parentGuide:
      "Empty a handful of buttons, coins or blocks onto a table. Sort them by one feature, count each pile, and ask which pile has the most and which has the fewest.",
  },
  {
    id: "picture-graphs-one-to-one",
    title: "Read a picture graph",
    summary:
      "When each picture stands for one response, count the pictures in a row to find its total.",
    templateIds: ["picture-graph-questions"],
    objectives: [
      "Find the number in each category and the total of all categories.",
      "Find how many more or how many fewer one category has than another.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A picture can stand for one answer",
        paragraphs: [
          "If each child chooses one fruit, draw one small picture beside that fruit for each child. A row with more pictures means more children chose it. Count the pictures to find the exact number.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "One mark, one response",
        paragraphs: [
          "In a one-to-one picture graph, each symbol represents exactly one response. A category's frequency is its number of symbols, and the difference between two frequencies is found by subtracting their counts.",
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
      "Read the key first: each mark or grid step may stand for more than one response.",
    templateIds: ["scaled-picture-graph", "scaled-bar-graph"],
    objectives: [
      "Read a picture graph whose symbol stands for 2, 5 or 10, including half symbols.",
      "Read bars on a scale that counts by 2, 5 or 10, including bars that end halfway between lines, and solve one- and two-step comparisons.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One mark can stand for a whole group",
        paragraphs: [
          "A graph with many answers can use one symbol for 10 people. Four such symbols show 40 people, not 4. The key tells you how many answers each mark represents.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Read the scale before counting",
        paragraphs: [
          "In a scaled graph, a mark or equal interval represents a fixed number of responses. Multiply the number of marks or intervals by that scale to find a category's count; a half mark represents half of the full mark's value when the key allows it.",
        ],
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

const shapeSort =
  "To sort means to put things into groups, so everything in a group is alike. Here you sort shapes by kind. A circle is a round shape. A square has 4 sides, the straight parts around its outside. All 4 sides are the same size, and its 4 corners, where the sides meet, are like the corner of a page. A triangle has 3 straight sides. Each shape goes into exactly one group. The sign + means add, or put more with. The sign = means makes, or is the same as.";
export const earlyDataMethods: Record<string, ProblemMethod> = {
  "sort-shapes-count": {
    goal: "Sort shapes by kind, then count the shapes in one group.",
    intuition: `${shapeSort} Then count the group the question names.`,
    terms: ["sort"],
    senses: {
      sort: "sort",
      square: "square-shape",
      squares: "square-shape",
      side: "side",
      sides: "side",
    },
    noLink: ["whole", "parts"],
    method: [
      "Make a group for each kind of shape.",
      "Count the group the question names. Touch each shape once.",
    ],
    watch: "Count only the kind the question names. Skip the other shapes.",
  },
  "sort-shapes-most": {
    goal: "Sort shapes by kind and choose the group with the most or the fewest.",
    intuition: `${shapeSort} The group with the biggest count has the most. The group with the smallest count has the fewest.`,
    senses: {
      sort: "sort",
      square: "square-shape",
      squares: "square-shape",
      side: "side",
      sides: "side",
    },
    noLink: ["whole", "parts"],
    method: [
      "Sort the shapes into groups by kind.",
      "Count every group.",
      "For most, choose the biggest count. For fewest, choose the smallest count.",
    ],
    watch: "Compare the counts, not how much room the shapes take up.",
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
    terms: [["key", "Half a symbol stands for half the key's amount."]],
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
      [
        "scale-axis",
        "A bar ending halfway between two grid lines is half a scale step above the lower line.",
      ],
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
    "Sorting puts each object in exactly one group. So the counts of all the groups add up to the number of objects.",
  "sort-shapes-most":
    "After sorting, the group with the biggest count has the most. The group with the smallest count has the fewest.",
  "picture-graph-questions":
    "Matching two rows symbol by symbol leaves the difference unmatched: how many more = larger count − smaller count.",
  "scaled-picture-graph":
    "Each symbol stands for the key, so a row’s value is (whole symbols × key) + (half the key for a half symbol).",
  "scaled-bar-graph":
    "A bar’s value is read on the axis scale, so its height, not a count of grid squares, gives the amount.",
};
