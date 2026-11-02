import type { Lesson } from "./lessons.js";
/** Glossary readings for the grade 6 and 8 graph lessons. */
const GRID_SENSES = {
  side: "side-of-equation",
  sides: "side-of-equation",
  term: "term-expression",
  terms: "term-expression",
  unit: "unit",
  units: "unit",
  difference: "difference-subtract",
  square: "square-shape",
  squares: "square-shape",
} as const;
const GRID_NO_LINK = [
  "whole",
  "part",
  "parts",
  "change",
  "changes",
  "opposite",
  "opposite sides",
  "mean",
  "means",
  "rule",
  "center",
  "scale",
  "rules",
];

export const graphicalLessons: Lesson[] = [
  {
    id: "coordinate-reading",
    title: "Read a point on a coordinate grid",
    summary:
      "A number line is a line with evenly spaced numbers. A coordinate grid has two of them that cross at 0: one going across and one going up and down. A point is an exact spot on the grid, named by two numbers written $(x, y)$. Start at the crossing point. The first number, $x$, says how far across (left if negative). The second, $y$, says how far up (down if negative).",
    templateIds: ["coordinate-point-reading"],
    senses: GRID_SENSES,
    noLink: GRID_NO_LINK,
    objectives: [
      "Tell the across number ($x$) of a point from its up-and-down number ($y$).",
      "Read positive, negative and zero coordinates from a grid.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two scales locate one point",
        paragraphs: [
          "A coordinate grid has two number lines. The across line is called the $x$-axis, and the up-and-down line is called the $y$-axis. They cross at 0. That crossing point is called the origin.",
          "A point's $x$-coordinate tells how far it is to the right or left of the origin. Its $y$-coordinate tells how far it is up or down. Read the two number lines one at a time.",
        ],
      },
      {
        title: "Start at the origin",
        paragraphs: [
          "A point is written as an ordered pair $(x, y)$: two numbers in a set order, across first and up-and-down second. The order matters, because $(2, 3)$ and $(3, 2)$ are different points.",
          "To read $x$, follow the across line. Numbers to the right of the origin are positive, and numbers to the left are negative, less than 0. Then read $y$ on the up-and-down line. Up is positive and down is negative.",
        ],
      },
      {
        title: "Read the requested coordinate",
        paragraphs: [
          "For the point $(-3, 2)$, the $x$-coordinate is $-3$ and the $y$-coordinate is 2. If a question asks for just one coordinate, give one number, not both.",
          "Check how much each grid square stands for before counting squares. These practice grids use 1 for each square.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Coordinates and axes",
        paragraphs: [
          "An ordered pair $(x, y)$ names a point's across position first and its up-and-down position second. Each axis has its own number scale. Both positions are measured from the same origin, $(0, 0)$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Point $P$ is three units left and two units above the origin. What is its $x$-coordinate?",
      steps: [
        "The $x$-coordinate is the across position. Left of the origin means a negative number, a number less than 0, so 3 units left is $-3$.",
        "The point is at $(-3, 2)$: across $-3$, up 2. The question asks only for $x$, which is $-3$.",
      ],
      answer: "−3",
    },
    pitfalls: [
      "Do not swap $x$ and $y$. The across number comes first.",
      "A point on an axis has one coordinate equal to 0.",
    ],
    parentGuide:
      "Place a counter on graph paper and ask your learner to say the across position and the up-and-down position separately.",
  },
  {
    id: "graph-slope",
    title: "Slope measures change",
    summary:
      "The slope of a line says how steep it is. Pick two points on the line with different across positions. The rise is how far up you go between them (negative if you go down). The run is how far across you go. The slope is the rise divided by the run. A line going up to the right has a positive slope; going down, negative.",
    templateIds: ["graphed-line-slope"],
    senses: GRID_SENSES,
    noLink: GRID_NO_LINK,
    objectives: [
      "Read the coordinates of two points from a graph.",
      "Work out the exact slope, with its sign, as a fraction.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count up compared with across",
        paragraphs: [
          "A point is written $(x, y)$. Start at $(0, 0)$, the origin, where the two axes cross. Go across $x$ (left if negative), then up $y$ (down if negative). So $(-2, 1)$ is 2 units left and 1 unit up.",
          "Say a line rises 3 units while it moves 2 units right. Its slope is the up-and-down change divided by the across change: 3 divided by 2, or $\\frac{3}{2}$. A slope farther from 0, such as 3 or $-3$, means a steeper line.",
        ],
      },
      {
        title: "Use the same direction twice",
        paragraphs: [
          "Choose a starting point and an ending point on the line. Subtract their $y$-coordinates to find the up-and-down change, called the rise. Subtract their $x$-coordinates in the same order to find the across change, called the run.",
          "Slope is the rise divided by the run. Moving right along a line that goes up gives a positive slope. Moving right along a line that goes down gives a negative slope.",
        ],
      },
      {
        title: "Keep the ratio exact",
        paragraphs: [
          "A rise of 3 units over a run of 4 units gives a slope of $\\frac{3}{4}$. A fraction gives the slope exactly, with no rounding.",
          "A flat (horizontal) line has no rise, so its slope is 0. A straight up-and-down (vertical) line has no run, and you cannot divide by 0, so its slope is undefined. The practice questions always use two points with different $x$-coordinates.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Rate of change on a graph",
        paragraphs: [
          "For two points on a line that is not vertical, with different $x$-coordinates, the slope is the change in $y$ divided by the change in $x$. Use the same start and end for both changes. Then any two different points on the line give the same slope.",
        ],
      },
    ],
    workedExample: {
      prompt: "A line passes through (−2, 1) and (2, 3). Find its slope.",
      steps: [
        "Start at $(-2, 1)$ and end at $(2, 3)$. The rise is the change in $y$: $3 - 1 = 2$.",
        "The run is the change in $x$, in the same order: $2 - (-2) = 2 + 2 = 4$.",
        "Divide the rise by the run: $\\frac{2}{4} = \\frac{1}{2}$. The slope is positive because the line goes up to the right.",
      ],
      answer: "1/2",
    },
    pitfalls: [
      "Subtract both coordinates in the same order: if you start with $(2, 3)$ for $y$, start with it for $x$ too.",
      "Use the changes between two points, not one point's $y$ divided by its $x$.",
    ],
    parentGuide:
      "Ask your learner to trace the across move and then the up-or-down move between the two plotted points, and say each length.",
  },
  {
    id: "bar-chart-totals",
    title: "Combine counts from a chart",
    summary:
      "Each bar shows one category's count; add the requested categories to find a total.",
    templateIds: ["bar-chart-total"],
    objectives: [
      "Read category labels and value scales.",
      "Add all named category counts.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Read each bar before adding",
        paragraphs: [
          "A bar chart gives one count for each category. If a question asks for the total across several categories, first read their heights using the chart's scale, then add those counts.",
        ],
      },
      {
        title: "Read what each bar counts",
        paragraphs: [
          "Each bar represents one category. Its height shows the count on the vertical scale. The label above each bar gives that same count.",
          "The category name tells which objects are counted. The vertical-axis label tells the unit: this chart counts trees.",
        ],
      },
      {
        title: "Find the combined count",
        paragraphs: [
          "When categories do not overlap, add their counts to find how many objects are represented altogether. Include each category exactly once.",
          "Read the numbers before calculating. Counting bars tells how many categories there are, not how many trees there are.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Bar values and totals",
        paragraphs: [
          "A bar's height represents the count for its category on the chart's stated scale. When categories do not overlap and cover the requested group, add their counts to obtain the total.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A chart shows 4 oak trees, 7 pine trees, and 3 maple trees. How many trees are shown?",
      steps: ["Add the three category counts.", "4 + 7 + 3 = 14."],
      answer: "14",
    },
    pitfalls: [
      "Do not add tick labels from the axis.",
      "Do not count the same category twice.",
    ],
    parentGuide:
      "Make a chart of three kinds of household objects and compare its total with a direct count.",
  },
  {
    id: "bar-chart-comparison",
    title: "Compare two chart categories",
    summary:
      "The difference between two bars tells how many more one category has.",
    templateIds: ["bar-chart-difference"],
    objectives: [
      "Select the two categories named in a question.",
      "Subtract to find how many more.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare the two requested counts",
        paragraphs: [
          "If one bar shows twelve and another shows eight, the first has four more. You need the difference between their heights, not the sum of every bar on the chart.",
        ],
      },
      {
        title: "Select the relevant bars",
        paragraphs: [
          "A comparison question may name only two categories even when the chart has more bars. Read the two requested counts and leave other categories out of the calculation.",
          "Both counts use the same unit and scale. Compare the values represented by the bars rather than measuring their physical heights on the page.",
        ],
      },
      {
        title: "Find the unmatched amount",
        paragraphs: [
          "Imagine matching one tree from the smaller group with one from the larger group. The unmatched trees show how many more the larger group contains.",
          "Subtract the smaller count from the larger count. Check by adding the difference back to the smaller count.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Compare bar heights numerically",
        paragraphs: [
          "When bars use one common scale, the difference between two category counts is the larger count minus the smaller. The distance between their tops represents this difference, not either bar's full height.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A chart shows 9 oak trees and 5 pine trees. How many more oak trees are there?",
      steps: ["Find the difference: 9 − 5 = 4.", "Check: 5 + 4 = 9."],
      answer: "4",
    },
    pitfalls: [
      "“How many more” asks for a difference, not a combined total.",
      "Use only the named categories.",
    ],
    parentGuide:
      "Arrange two rows of counters and pair them before connecting the unmatched counters to subtraction.",
  },
  {
    id: "clock-duration",
    title: "Count elapsed minutes",
    summary:
      "Count forward from the starting clock time to the ending time to find how long passed.",
    templateIds: ["clock-elapsed-minutes"],
    objectives: [
      "Read an analog starting time.",
      "Find elapsed time across an hour boundary.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Move from start to finish",
        paragraphs: [
          "If a trip starts at 2:45 and ends at 3:10, count fifteen minutes to 3:00 and ten more to 3:10. That is twenty-five minutes altogether. Crossing an hour does not restart time.",
        ],
      },
      {
        title: "Read both hands",
        paragraphs: [
          "The shorter hand indicates the hour. The longer hand indicates minutes: each numbered step represents five minutes.",
          "Between hours, the short hand moves gradually toward the next number. At 3:30 it is halfway between 3 and 4, not exactly on 3.",
        ],
      },
      {
        title: "Count forward",
        paragraphs: [
          "Count from the starting time to the next convenient hour, then from that hour to the ending time. Add those minute intervals.",
          "These questions give a later ending time on the same morning, so there is no midnight or next-day ambiguity.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Elapsed time",
        paragraphs: [
          "Elapsed time is the forward difference between an ending clock time and a starting clock time. Crossing an hour or noon does not restart the count; convert to a common minute count or count through the boundary.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A lesson begins at 3:45 and ends at 4:20 the same morning. How long does it last?",
      steps: [
        "From 3:45 to 4:00 is 15 minutes.",
        "From 4:00 to 4:20 is 20 minutes.",
        "15 + 20 = 35 minutes.",
      ],
      answer: "35",
    },
    pitfalls: [
      "An hour contains sixty minutes, not one hundred.",
      "Elapsed minutes describe a duration, not a clock reading.",
    ],
    parentGuide:
      "Move clock hands forward while counting minutes; include practice where the hour changes.",
  },
  {
    id: "number-line-separation",
    title: "Distance between signed numbers",
    summary:
      "A number line shows numbers in order, with tick marks (short lines) evenly spaced and negative numbers (the numbers less than 0) to the left of 0. When neighboring ticks are 1 apart, each space is one unit. The distance between two numbers is how many units apart they are. Count the spaces between them, not the tick marks. A distance is never negative.",
    templateIds: ["number-line-distance"],
    senses: GRID_SENSES,
    noLink: GRID_NO_LINK,
    objectives: [
      "Find positive and negative whole numbers on a number line.",
      "Work out the distance between two of them, which is never negative.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count the spaces between points",
        paragraphs: [
          "A number line has evenly spaced marks, called ticks, with 0 in the middle. Negative numbers sit to the left of 0 and positive numbers to the right.",
          "From $-2$ to 3, move 2 spaces to reach 0, then 3 more to reach 3. So the points are $2 + 3 = 5$ units apart. Count the spaces you move across, not the labels you pass.",
        ],
      },
      {
        title: "Count spaces between locations",
        paragraphs: [
          "Each tick marks a number. Here the distance between neighboring ticks is one unit. Count the spaces traveled, not the tick marks you see: from 1 to 4 passes 4 ticks but only 3 spaces.",
          "If one point is left of 0 and the other is right of 0, travel to 0 first. Then keep going to the other point. Add those two distances.",
        ],
      },
      {
        title: "Subtract positions",
        paragraphs: [
          "You can also subtract: the right point minus the left point gives the distance. For $-3$ and 4, that is $4 - (-3) = 4 + 3 = 7$.",
          "Distance has no direction, so it cannot be negative. The distance from $-3$ to 4 is the same as the distance from 4 to $-3$. The size of a number without its sign is called its absolute value, written with bars: $|-7| = 7$. So subtracting in either order and taking the absolute value also works.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Distance on a number line",
        paragraphs: [
          "For numbers $a$ and $b$ on a number line with equal spaces, the distance between them is $|b - a|$, the size of their difference without its sign. When each space is one unit, it counts the spaces between them, whichever one is farther right. It is never negative.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is the distance between −3 and 4?",
      steps: [
        "The numbers are on opposite sides of 0, so go through 0. From $-3$ to 0 is 3 units.",
        "From 0 to 4 is 4 more units.",
        "Add the two parts: $3 + 4 = 7$ units.",
      ],
      answer: "7",
    },
    pitfalls: [
      "Do not count the end ticks as extra units. Count spaces, not ticks.",
      "A negative number can be a positive distance from another number. The distance is never negative.",
    ],
    parentGuide:
      "Draw a number line and move a counter one space at a time, including trips across 0. Count the moves aloud.",
  },
];
