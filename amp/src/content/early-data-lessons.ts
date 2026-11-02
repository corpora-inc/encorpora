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
      "A picture graph uses small pictures to show counts. Each row is one choice, like apple. Here each picture stands for 1 child. Count the pictures in a row to find how many chose it.",
    templateIds: ["picture-graph-questions"],
    senses: { difference: "difference-subtract", "more than": "more-than" },
    objectives: [
      "Find how many are in each row, and how many in all.",
      "Find how many more or how many fewer one row has than another.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A picture can stand for one answer",
        paragraphs: [
          "Each child picks one fruit. For each child, draw one small picture next to the fruit they picked.",
          "A row with more pictures means more children picked it. Count the pictures to find how many.",
        ],
      },
      {
        title: "One picture, one student",
        paragraphs: [
          "Look at the picture graph. Each student picked one fruit. Each small picture stands for 1 student.",
          "Count a row to find how many picked that fruit. Apple has 7. Pear has 4. Plum has 5.",
          "To find how many students answered in all, add every row: 7 + 4 + 5 = 16.",
        ],
        illustration: "data-picture-one-to-one",
      },
      {
        title: "How many more? Match, then count what is left",
        paragraphs: [
          "Line up the apple row with the pear row. The first 4 apples each have a pear partner. 3 apples have no partner. So 3 more students picked apple than pear.",
          "That is the same as taking away: 7 − 4 = 3. The answer to a take-away is called the difference.",
          "How many fewer picked pear than apple? It is the same question turned around. The answer is also 3.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "One picture, one answer",
        paragraphs: [
          "In this kind of picture graph, each picture stands for exactly one answer. The count for a row is its number of pictures.",
          "How many more, or how many fewer, is the bigger count minus the smaller count.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The picture graph shows 7 apple, 4 pear and 5 plum. How many more students chose plum than pear?",
      steps: [
        "Count the two rows the question names. Plum has 5 pictures and pear has 4.",
        "Match them one to one: pair each pear picture with one plum picture. 1 plum picture has no partner, so plum has 1 more. Taking away gives the same answer: 5 − 4 = 1.",
      ],
      answer: "1",
    },
    pitfalls: [
      "How many more means take away, not add.",
      "How many fewer compares the same two rows. Take the smaller count from the bigger one.",
    ],
    parentGuide:
      "Ask family members to choose a favorite fruit and draw one circle per vote in rows. Ask how many voted in all, and how many more chose one fruit than another.",
  },
  {
    id: "scaled-graphs",
    title: "Graphs with a scale",
    summary:
      "A graph is a picture that shows counts. In a picture graph, small pictures show the counts. In some, one picture stands for more than 1, like 10 students. The key is the note that says how many each picture stands for. A bar graph shows counts with bars. Its scale is the numbers up the side. It may count by 2, 5 or 10. Read the key or the scale before you count.",
    templateIds: ["scaled-picture-graph", "scaled-bar-graph"],
    senses: {
      key: "key",
      scale: "scale-axis",
      difference: "difference-subtract",
      whole: "whole",
    },
    objectives: [
      "Read a picture graph where one picture stands for 2, 5 or 10, including half pictures.",
      "Read bar graphs whose scale counts by 2, 5 or 10, including bars that end halfway between lines, and solve one- and two-step questions.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One picture can stand for a group",
        paragraphs: [
          "A graph about many people can use one picture for 10 people. Then 4 pictures show 40 people, not 4.",
          "The key is the note on the graph that says how many each picture stands for. Always read it first.",
        ],
      },
      {
        title: "Read the key first",
        paragraphs: [
          "Look at the picture graph. Its rows of small pictures show how many students chose each pet. The key says each picture stands for 10 students. Half a picture stands for half of that: 5 students.",
          "Dog has 4 whole pictures and a half picture. Each whole picture is 10, so that is 4 × 10 + 5 = 45 students.",
          "Cat has 3 pictures, so 30 students. Dog has 45 − 30 = 15 more students than cat. That is one and a half pictures, written 1 1/2, which is 10 + 5 = 15.",
        ],
        illustration: "data-picture-key",
      },
      {
        title: "Count by the scale",
        paragraphs: [
          "Look at the bar graph. The scale is the numbers up the side. The lines across the graph count by 10.",
          "Tuesday's bar ends halfway between 40 and 50. Halfway between them is 45. Wednesday's bar ends halfway between 10 and 20, at 15.",
          "A two-step question needs two math steps, like adding and then subtracting. Compare Monday and Wednesday together with Thursday. First add Monday and Wednesday: 30 + 15 = 45. Thursday has 50, so subtract to compare: 50 − 45 = 5. Thursday alone collected 5 more cans than those two days together.",
        ],
        illustration: "data-scaled-bars",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Read the scale before counting",
        paragraphs: [
          "In a graph with a key or a scale, each picture or each space stands for the same number.",
          "Multiply the number of pictures or spaces by that number to find a count. When the key allows a half picture, it stands for half the key's number.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "In the bar graph, Monday is 30, Tuesday is 45 and Wednesday is 15 cans. How many more cans were collected on Tuesday and Wednesday together than on Monday?",
      steps: [
        "Together means add, so find the two days' total first: 45 + 15 = 60.",
        "How many more means subtract. Compare the total with Monday: 60 − 30 = 30.",
      ],
      answer: "30",
    },
    pitfalls: [
      "A picture or a space on the scale is not always 1. Read the key or the scale first.",
      "When a question compares two days together with another day, add the two days first. Then compare.",
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
    intuition:
      "A picture graph uses small pictures to show counts. Each row is one choice. Here each picture stands for 1 student. In all means every row put together, so add. How many more or how many fewer means take the smaller count away from the bigger count.",
    senses: { difference: "difference-subtract" },
    method: [
      "Count the pictures in each row the question names.",
      "For in all, add the rows.",
      "For more or fewer, subtract, or take away, the smaller count from the bigger count.",
    ],
    watch: "How many more asks you to take away, not to add.",
  },
  "scaled-picture-graph": {
    goal: "Read a picture graph whose symbol stands for 2, 5 or 10 and compare rows.",
    intuition:
      "A picture graph uses small pictures to show counts. The key is the note that says how many each picture stands for, like 2 students. Half a picture stands for half of that. With a key of 2, 3 whole pictures are 3 × 2 = 6, and a half picture adds 1 more.",
    terms: [["key", "Half a symbol stands for half the key's amount."]],
    senses: { key: "key", difference: "difference-subtract" },
    method: [
      "Read the key: how many does one picture stand for?",
      "For each row, multiply the whole pictures by the key. Add half the key for a half picture.",
      "Add or subtract the rows' counts, as the question asks.",
    ],
    watch: "Each picture stands for the key's number, not for 1.",
  },
  "scaled-bar-graph": {
    goal: "Read bars on a scale of 2, 5 or 10 and solve one- or two-step comparisons.",
    intuition:
      "A bar graph shows counts with bars. The scale is the numbers up the side. Here the lines may count by 2, 5 or 10, not by 1. A bar that ends halfway between two lines is halfway between their numbers. A two-step question needs two math steps, like adding and then subtracting.",
    terms: [
      [
        "scale-axis",
        "A bar ending halfway between two grid lines is half a scale step above the lower line.",
      ],
    ],
    senses: { scale: "scale-axis", difference: "difference-subtract" },
    method: [
      "Find what the scale counts by from its numbers.",
      "Read where each named bar ends, including halfway values.",
      "For a combined amount, add first. Then subtract to compare.",
    ],
    watch: "Read the numbers on the scale. Do not count the spaces as 1 each.",
  },
};
export const earlyDataPrinciples: Record<string, string> = {
  "sort-shapes-count":
    "Sorting puts each object in exactly one group. So the counts of all the groups add up to the number of objects.",
  "sort-shapes-most":
    "After sorting, the group with the biggest count has the most. The group with the smallest count has the fewest.",
  "picture-graph-questions":
    "Matching two rows picture by picture leaves some pictures with no partner. How many more is the bigger count minus the smaller count.",
  "scaled-picture-graph":
    "Each picture stands for the key's number. So a row's count is the whole pictures times the key, plus half the key for a half picture.",
  "scaled-bar-graph":
    "A bar's count is read on the scale. The number where the bar ends gives the amount, not the number of spaces below it.",
};
