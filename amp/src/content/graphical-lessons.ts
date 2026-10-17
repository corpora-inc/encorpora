import type { Lesson } from "./lessons.js";
export const graphicalLessons: Lesson[] = [
  {
    id: "coordinate-reading",
    title: "Read a point on a coordinate grid",
    summary: "Use the horizontal and vertical scales to describe a location.",
    templateIds: ["coordinate-point-reading"],
    objectives: [
      "Identify horizontal and vertical coordinates.",
      "Interpret positive negative and zero coordinates.",
    ],
    sections: [
      {
        title: "Start at the origin",
        paragraphs: [
          "The origin is where the two zero lines meet. In an ordered pair (x, y), x describes horizontal position and y describes vertical position.",
          "Follow the horizontal scale to locate x. Positive values are to the right and negative values are to the left. Then use the vertical scale: positive values go up and negative values go down.",
        ],
      },
      {
        title: "Read the requested coordinate",
        paragraphs: [
          "For a point at (−3, 2), the x-coordinate is −3 and the y-coordinate is 2. A question asking for just one coordinate needs one number, not both.",
          "Check the grid scale before counting squares. These practice grids use one unit per step.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Point P is three units left and two units above the origin. What is its x-coordinate?",
      steps: [
        "Left corresponds to negative horizontal values.",
        "The horizontal position is −3; the vertical position is 2.",
      ],
      answer: "−3",
    },
    pitfalls: [
      "Do not reverse x and y.",
      "A point on an axis has one coordinate equal to zero.",
    ],
    parentGuide:
      "Place a counter on graph paper and ask the learner to describe horizontal and vertical position separately.",
  },
  {
    id: "graph-slope",
    title: "Slope measures change",
    summary:
      "Compare vertical change with horizontal change between two points.",
    templateIds: ["graphed-line-slope"],
    objectives: [
      "Read two points from a graph.",
      "Compute an exact signed slope.",
    ],
    sections: [
      {
        title: "Use the same direction twice",
        paragraphs: [
          "Choose a starting point and an ending point. Subtract their y-coordinates to find vertical change, then subtract their x-coordinates in the same order to find horizontal change.",
          "Slope is vertical change divided by horizontal change. Moving right along a rising line gives a positive slope; moving right along a falling line gives a negative slope.",
        ],
      },
      {
        title: "Keep the ratio exact",
        paragraphs: [
          "A rise of three units over a run of four units gives slope 3/4. Fractions can express slope exactly without rounding.",
          "A horizontal line has zero vertical change and slope zero. A vertical line has zero horizontal change and undefined slope; these practice questions use distinct horizontal coordinates.",
        ],
      },
    ],
    workedExample: {
      prompt: "A line passes through (−2, 1) and (2, 3). Find its slope.",
      steps: [
        "Vertical change: 3 − 1 = 2.",
        "Horizontal change: 2 − (−2) = 4.",
        "Divide: 2/4 = 1/2.",
      ],
      answer: "1/2",
    },
    pitfalls: [
      "Subtract both coordinates in the same point order.",
      "Use changes between points, not either point’s y/x ratio.",
    ],
    parentGuide:
      "Ask the learner to trace a horizontal move and a vertical move between the two plotted points.",
  },
  {
    id: "bar-chart-totals",
    title: "Combine counts from a chart",
    summary: "Read category values before finding a total.",
    templateIds: ["bar-chart-total"],
    objectives: [
      "Read category labels and value scales.",
      "Add all named category counts.",
    ],
    sections: [
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
    summary: "A difference tells how much one count exceeds another.",
    templateIds: ["bar-chart-difference"],
    objectives: [
      "Select the two categories named in a question.",
      "Subtract to find how many more.",
    ],
    sections: [
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
    summary: "Measure how much time passes between a start and an end.",
    templateIds: ["clock-elapsed-minutes"],
    objectives: [
      "Read an analog starting time.",
      "Find elapsed time across an hour boundary.",
    ],
    sections: [
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
    summary: "Count intervals between two locations on a number line.",
    templateIds: ["number-line-distance"],
    objectives: [
      "Locate signed integers.",
      "Calculate a nonnegative distance.",
    ],
    sections: [
      {
        title: "Count spaces between locations",
        paragraphs: [
          "Each tick marks a number. The distance between neighboring ticks is one unit. Count the spaces traveled, not the number of tick marks you see.",
          "If one point is left of zero and the other is right of zero, travel to zero and then continue to the other point. Add those two distances.",
        ],
      },
      {
        title: "Subtract positions",
        paragraphs: [
          "Subtract the left point from the right point to get their distance. Equivalently, use the absolute value of the difference in either order.",
          "Distance has no direction, so it cannot be negative. The distance from −3 to 4 equals the distance from 4 to −3.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is the distance between −3 and 4?",
      steps: [
        "From −3 to 0 is 3 units.",
        "From 0 to 4 is 4 units.",
        "3 + 4 = 7 units.",
      ],
      answer: "7",
    },
    pitfalls: [
      "Do not count both endpoint ticks as extra units.",
      "A negative position can have a positive distance from another position.",
    ],
    parentGuide:
      "Draw a number line and move a counter one interval per step, including journeys across zero.",
  },
];
