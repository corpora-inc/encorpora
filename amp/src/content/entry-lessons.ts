import type { Lesson } from "./lessons.js";
export const entryLessons: Lesson[] = [
  {
    id: "line-up-and-compare",
    title: "Line up and compare",
    summary: "Start together. Look at the other ends.",
    templateIds: ["compare-aligned-lengths"],
    objectives: [
      "Compare the lengths of two aligned objects.",
      "Distinguish longer, shorter and the same length.",
    ],
    sections: [
      {
        title: "Start together",
        paragraphs: [
          "Put two strips beside each other. Slide them until one end of each strip lines up. Keep both strips straight.",
          "Point to the ends that line up. Those are the starts. Look toward the other ends.",
        ],
      },
      {
        title: "Look at the other ends",
        paragraphs: [
          "The strip that reaches farther from the shared start is longer. The strip that stops sooner is shorter.",
          "If the other ends line up too, the strips have the same length. You do not need to count anything to compare these lengths.",
        ],
      },
      {
        title: "Move, then check",
        paragraphs: [
          "Slide one strip away from the shared start. It may look as if it reaches farther, but sliding did not make the strip longer. Line up the starts again before comparing.",
          "Try turning both strips so they stand up on the page. Line up the bottoms and compare the tops. The comparison still works.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Two straight strips start at the same line. The top strip ends before the bottom strip. Which strip is longer?",
      steps: [
        "Find the shared starting line.",
        "Follow each strip to its other end.",
        "The bottom strip reaches farther from the shared start. It is longer.",
      ],
      answer: "The bottom strip.",
    },
    pitfalls: [
      "Line up one end before deciding which object is longer.",
      "Look at length, not color or thickness.",
      "Longer tells how the lengths compare. It does not tell how many units longer.",
    ],
    parentGuide:
      "Read the short invitation aloud and let the learner point or touch. Use two straight paper strips with clearly different lengths, then equal lengths. No counting, numerals or ruler is required. Ask the learner to line up the starts before explaining. Teach the words longer, shorter and same length through the action. A selected answer shows one comparison; moving real objects and explaining the alignment require separate observation.",
  },
  {
    id: "meet-three-shapes",
    title: "Meet three shapes",
    summary: "Look at the shape, even when it turns.",
    templateIds: ["identify-basic-shape"],
    objectives: [
      "Recognize a circle, triangle and square.",
      "Notice that turning or resizing a shape does not change its name.",
    ],
    sections: [
      {
        title: "Trace the edge",
        paragraphs: [
          "Trace a circle with your finger. Its edge curves all the way around, with no corners. The circles in these pictures are evenly round.",
          "Trace a triangle. Follow its straight sides around the edge. It has three sides and three corners. The triangles can be tall, wide or turned.",
        ],
      },
      {
        title: "Meet a square",
        paragraphs: [
          "Trace a square. Its four straight sides have equal lengths. Its four corners match the square corner of a sheet of paper.",
          "Turn the square so a corner points up. It is still a square. Turning did not change its sides or corners.",
        ],
      },
      {
        title: "Name the shape, not its color",
        paragraphs: [
          "A small blue circle and a large orange circle are both circles. Color and size do not decide the name.",
          "Point to a shape and say its name, or match it to another example. Then turn the example and look again.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A square is turned so one corner points up. Its sides and corners have not changed. What is its name?",
      steps: [
        "Look at the edge and the corners.",
        "Turning changes the way the shape faces.",
        "It is still a square.",
      ],
      answer: "Square.",
    },
    pitfalls: [
      "A square does not become a different shape just because a corner points up.",
      "A triangle can have sides of different lengths. It still has three straight sides.",
      "A shape with four equal sides is not always a square; the corners must be square corners too.",
    ],
    parentGuide:
      "Start with matching and pointing, using spoken names if needed. Counting sides is an observation to teach, not an entry requirement. Offer varied orientations and sizes, with high-contrast outlines that do not rely on color. Let the child trace physical shapes. Compare a square with a non-square rectangle or slanted rhombus only after the basic examples are familiar. Recognition choices do not assess independent drawing, full classification or proof; a reader who cannot decode answer labels may need read-aloud support.",
  },
];
