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
      "A bar chart shows counts with bars. Each bar is one group, like oak trees. Read how tall a bar is on the scale, the numbers up the side. That number is the count. The total is how many there are in all. To find it, add the counts of the groups you need.",
    templateIds: ["bar-chart-total"],
    senses: { scale: "scale-axis" },
    noLink: ["part"],
    objectives: [
      "Read each bar's count on the scale.",
      "Add the counts of all the groups a question names.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Read each bar before adding",
        paragraphs: [
          "A bar chart is a picture of counts. Each bar stands for one group of things, like oak trees. A taller bar means more things.",
          "The scale is the row of numbers up the side. To read a bar, look across from its top to the scale. That number is the count for the group.",
          "To find how many in all, read every bar you need first. Then add those counts.",
        ],
      },
      {
        title: "Read what each bar counts",
        paragraphs: [
          "The name under each bar tells which group it counts. The words beside the scale tell what is counted. In these charts, it is trees.",
          "Sometimes each line on the scale counts by 1. Sometimes it counts by 2 or 5. So read the numbers on the scale, not the number of lines.",
        ],
      },
      {
        title: "Find the total",
        paragraphs: [
          "Each tree is in only one group. So add the counts to find how many trees there are in all. Add each group once.",
          "Do not count the bars. The number of bars tells how many groups there are, not how many trees.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Bar values and totals",
        paragraphs: [
          "A bar's height on the scale is the count for its group.",
          "When each thing is in just one group, the total is all the groups' counts added together.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A chart shows 4 oak trees, 7 pine trees, and 3 maple trees. How many trees are shown?",
      steps: [
        "Each tree is in just one group, so add the three counts to find how many in all.",
        "4 + 7 + 3 = 14. There are 14 trees.",
      ],
      answer: "14",
    },
    pitfalls: [
      "Do not add the numbers on the scale. Add the counts the bars show.",
      "Do not count the same group twice.",
    ],
    parentGuide:
      "Make a chart of three kinds of household objects and compare its total with a direct count.",
  },
  {
    id: "bar-chart-comparison",
    title: "Compare two chart categories",
    summary:
      "A bar chart shows counts with bars. Each bar is one group. The scale is the row of numbers up the side. A bar's height on the scale is its count. To find how many more one group has than another, subtract, or take away, the smaller count from the bigger count. The answer is called the difference.",
    templateIds: ["bar-chart-difference"],
    senses: { scale: "scale-axis", difference: "difference-subtract" },
    objectives: [
      "Find the two groups a question names.",
      "Subtract to find how many more.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare the two counts",
        paragraphs: [
          "A bar chart shows counts with bars. Each bar is one group, like oak trees. The scale is the row of numbers up the side. Look across from the top of a bar to the scale to read its count.",
          "Say one bar shows 12 and another shows 8. The first group has 4 more, because 12 − 8 = 4. The answer to a subtraction is called the difference.",
        ],
      },
      {
        title: "Use only the bars you need",
        paragraphs: [
          "A question may name only two groups, even when the chart has more bars. Read those two counts. Leave the other bars out.",
          "Both bars use the same scale. Read the numbers on the scale. Do not measure the bars with a ruler.",
        ],
      },
      {
        title: "Match, then count what is left",
        paragraphs: [
          "Picture matching each tree in the smaller group with one tree in the bigger group. Some trees in the bigger group have no partner. Those are how many more the bigger group has.",
          "Subtracting finds that number faster. Subtract the smaller count from the bigger count. Check by adding the difference back to the smaller count.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Compare bar heights with numbers",
        paragraphs: [
          "When two bars use the same scale, how many more is the bigger count minus the smaller count.",
          "On the chart, read it on the scale: count from the top of the shorter bar up to the top of the taller bar, using the scale's numbers.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A chart shows 9 oak trees and 5 pine trees. How many more oak trees are there?",
      steps: [
        "Match each pine tree with an oak tree. The oak trees left with no partner are how many more. Taking away the smaller count finds them: 9 − 5 = 4.",
        "Check by adding back: the pine trees plus the extra oak trees should make the oak count. 5 + 4 = 9, so there are 4 more oak trees.",
      ],
      answer: "4",
    },
    pitfalls: [
      "How many more asks you to subtract, not to add.",
      "Use only the groups the question names.",
    ],
    parentGuide:
      "Arrange two rows of counters and pair them before connecting the unmatched counters to subtraction.",
  },
  {
    id: "clock-duration",
    title: "Count elapsed minutes",
    summary:
      "Elapsed time is how much time passes from a start time to an end time. One hour is 60 minutes. To find it, count on in minutes from the start time to the end time. If the end time is in a later hour, count to the next o'clock first.",
    templateIds: ["clock-elapsed-minutes"],
    noLink: ["boundary"],
    objectives: [
      "Read a start time on a clock with hands.",
      "Find the minutes that pass, even when the hour changes.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Move from start to finish",
        paragraphs: [
          "Say a trip starts at 2:45 and ends at 3:10. Count on from the start. At 2:45 the long hand is at 9. Moving to 12 passes 3 numbers, and each is 5 minutes. So from 2:45 to 3:00 is 15 minutes. From 3:00 to 3:10 is 10 more minutes. In all, 15 + 10 = 25 minutes.",
          "Going past 3:00 does not start the count over. Keep adding.",
        ],
      },
      {
        title: "Read both hands",
        paragraphs: [
          "A clock has two hands. The short hand shows the hour. The long hand shows the minutes. Each time the long hand moves from one number to the next, 5 minutes pass.",
          "The short hand moves slowly between the numbers. At 3:30 it is halfway between 3 and 4, not right on 3.",
        ],
      },
      {
        title: "Count forward",
        paragraphs: [
          "If the end time is in a later hour, count from the start time to the next o'clock. Then add 60 minutes for each whole hour after that. Then count on to the end time. Add up those minutes.",
          "If both times are in the same hour, just subtract, or take away, the minutes. From 3:15 to 3:40 is 40 − 15 = 25 minutes.",
          "In these questions, the end time is later in the same morning.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Elapsed time",
        paragraphs: [
          "Elapsed time is how long it is from the start time forward to the end time. One hour is 60 minutes.",
          "Passing an o'clock, or noon, does not start the count over. Count through it and keep adding.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A lesson begins at 3:45 and ends at 4:20 the same morning. How long does it last?",
      steps: [
        "The lesson ends in the next hour, so count to 4:00 first. From 3:45 to 4:00 is 15 minutes.",
        "Then count on to the end time. From 4:00 to 4:20 is 20 minutes.",
        "Add the two parts: 15 + 20 = 35 minutes.",
      ],
      answer: "35",
    },
    pitfalls: [
      "An hour has 60 minutes, not 100.",
      "The answer is an amount of time, like 35 minutes, not a time on the clock.",
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
