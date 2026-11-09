import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { MethodTerm } from "../glossary/types";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Lessons, methods and principles for building shapes from sticks and clay
 * balls (K.G.B.5) and for showing joining and taking away (K.OA.A.1).
 */

const shapeTerms: MethodTerm[] = [
  ["side", "Each side of a stick model is one stick."],
  ["corner", "Each corner of a stick model is one clay ball."],
];
const sentenceTerms: MethodTerm[] = [
  "addition",
  "subtraction",
  [
    "number-sentence",
    "Here a number sentence uses + or − and may end in = and the total.",
  ],
];

export const kBuildRepresentMethods: Record<string, ProblemMethod> = {
  "sticks-and-balls-needed": {
    goal: "Count the sticks or clay balls a model of a shape needs, or the sticks still missing.",
    intuition:
      "You can build a shape with sticks and balls of clay. A side is one straight part of the shape's outline, and each side is one stick. A corner is a place where two sides meet, and each corner is one clay ball. So a triangle model needs 3 sticks and 3 balls. A cube model is a square on the bottom, a square on top, and 4 posts: 12 sticks and 8 balls.",
    senses: { side: "side", sides: "side", square: "square-shape" },
    terms: shapeTerms,
    method: [
      "Name the shape. Count its sides for sticks and its corners for clay balls.",
      "To finish a build, find two balls next to each other with no stick between them. Count those gaps.",
      "For a cube, count in parts: 4 sticks on the bottom, 4 on top and 4 posts.",
    ],
    watch:
      "When some sticks are already placed, count only the gaps, not every side of the shape.",
  },
  "check-the-drawing": {
    goal: "Choose the one drawing that really is the named shape.",
    intuition:
      "A drawing is a real shape only when it closes, so the line comes back to where it started. Every side must be straight. A side is one straight part of the outline. The number of sides must match the name: a triangle has 3, a square and a rectangle have 4, and a hexagon has 6. A square corner is a corner like the corner of a page. Squares and rectangles need 4 square corners, and a square also needs 4 sides of the same length. Turning a drawing does not change its name.",
    senses: { side: "side", sides: "side", square: "square-shape" },
    terms: [...shapeTerms.slice(0, 1), "square-corner"],
    method: [
      "Check each drawing: does it close, and are all its sides straight?",
      "Count the sides. For a square or a rectangle, check for 4 square corners too.",
      "Choose the drawing that passes every check, even if it is turned.",
    ],
    watch:
      "A turned shape keeps its name. Do not skip a drawing just because it stands on a corner or points down.",
  },
  "drawing-mistake": {
    goal: "Say what is wrong with a child's drawing of a shape, or that nothing is wrong.",
    intuition:
      "A drawing of a shape must close, so the line comes back to its start. Every side must be straight. A side is one straight part of the outline. It must have the right number of sides for its name. A square corner is a corner like the corner of a page, and squares and rectangles need 4 of them. Turning a drawing is never a mistake.",
    senses: { side: "side", sides: "side", square: "square-shape" },
    terms: [...shapeTerms.slice(0, 1), "square-corner"],
    method: [
      "Follow the drawing all the way around. Check that it closes and that every side is straight.",
      "Count the sides. For a square or a rectangle, look for 4 square corners.",
      "If every check passes, nothing is wrong, even when the shape is turned.",
    ],
    watch:
      "Turning is never the mistake. A triangle that points down is still a triangle.",
  },
  "picture-to-number-sentence": {
    goal: "Choose the number sentence that tells what happens in a picture or a story.",
    intuition:
      "A number sentence is a short way to write what happens with numbers, like $4 + 3$. Plus, written +, means 2 groups come together. Minus, written −, means some go away. First see what happens in the picture or story. Then count the groups.",
    terms: sentenceTerms,
    method: [
      "Decide what happens: do more come in, or do some go away?",
      "Count the first group, then the group that moves. Write + for coming in and − for going away.",
      "If the sentence has =, the number after it is how many there are at the end.",
    ],
    watch:
      "Read the action, not just the numbers. A minus sentence with the same numbers is wrong when more come in.",
  },
  "number-sentence-to-picture": {
    goal: "Choose the picture that shows an addition or subtraction number sentence.",
    intuition:
      "A number sentence is a short way to write what happens with numbers. Plus, written +, means 2 groups come together. Minus, written −, means some go away. In the pictures, an arrow shows counters coming in, and faded counters are going away. A ten frame is a box of 10 spaces in 2 rows of 5. On a ten frame, crossed-out counters are taken away.",
    terms: [...sentenceTerms, "ten-frame"],
    method: [
      "Read the sign. Plus means a picture of 2 groups joining. Minus means a picture of some going away.",
      "Count the groups in each picture that shows the right action. Match them to the numbers in the sentence.",
    ],
    watch:
      "A picture of only the answer does not show the sentence. Look for both numbers and the action.",
  },
};

export const kBuildRepresentPrinciples: Record<string, string> = {
  "sticks-and-balls-needed":
    "A flat shape made of straight sides is its corners joined by sides. A stick model has one stick for each side and one clay ball for each corner, so a closed shape needs as many balls as sticks. A cube model needs 12 sticks and 8 balls.",
  "check-the-drawing":
    "A drawing is a triangle, square, rectangle or hexagon only when it is closed, every side is straight, and it has the right number of sides. A square or a rectangle also needs 4 square corners, and a square needs 4 sides of the same length. Turning or resizing a shape does not change its name.",
  "drawing-mistake":
    "A shape drawing can fail by not closing, by having a curved side, by having the wrong number of sides, or (for a square or a rectangle) by having corners that are not square corners. Turning is never a mistake.",
  "picture-to-number-sentence":
    "Joining is addition and taking away is subtraction. A number sentence shows the starting group, the sign of the action and the group that moves; with =, it also shows the result.",
  "number-sentence-to-picture":
    "Plus is shown by 2 groups coming together and minus by some of a group going away. The picture for a number sentence shows both of its numbers and its action, not only the result.",
};

export const kBuildRepresentLessons: Lesson[] = [
  chainLesson({
    id: "k-build-represent-shapes-lesson",
    title: "Build and check shapes with sticks and clay balls",
    summary:
      "A shape you can build has corners joined by straight sides, and it closes. Each side is one stick, and each corner is one ball of clay. A drawing is a real shape only when it closes, its sides are straight, and it has the right number of sides.",
    senses: { side: "side", sides: "side", square: "square-shape" },
    templateIds: [
      "sticks-and-balls-needed",
      "check-the-drawing",
      "drawing-mistake",
    ],
    objectives: [
      "Count the sticks and clay balls a model of a triangle, square, rectangle, hexagon or cube needs.",
      "Tell whether a drawing is a real shape, and name what is wrong when it is not.",
    ],
    openingTitle: "Sticks for sides, balls for corners",
    opening: [
      "Build a triangle with toothpicks and small balls of dough. A side is one straight part of the outline: each side is one toothpick. A corner is where two sides meet: each corner is one ball. A triangle uses 3 toothpicks and 3 balls.",
      "A shape must close: the last stick comes back to the first ball. Its sides must be straight. And the number of sides must match the name. A square corner is a corner like the corner of a page. A square has 4 sides of the same length and 4 square corners.",
      "A turned shape is still the same shape. A square standing on a corner is still a square.",
    ],
    example: {
      prompt:
        "All the clay balls of a hexagon are placed, and 4 sticks are placed. How many more sticks are needed to finish the hexagon?",
      steps: [
        "A hexagon has 6 sides, so it needs 6 sticks and 6 clay balls.",
        "4 sticks are already placed.",
        "Find the balls next to each other with no stick between them. There are 2 gaps, so 2 more sticks are needed.",
        "Check: 4 placed and 2 more make 6, one stick for each side.",
      ],
      answer: "2 more sticks",
    },
    methodTitle: "Check like a builder",
    method: [
      "Count sides for sticks and corners for balls. For a cube, count the bottom square, the top square and the 4 posts.",
      "To judge a drawing, check three things: does it close, are all its sides straight, and does it have the right number of sides?",
      "For a square or a rectangle, also check for 4 square corners. For a square, check that the 4 sides are the same length.",
    ],
    formalTitle: "What makes a shape",
    formal: [
      "A polygon is a closed shape made of straight sides. Each pair of sides that meet makes a corner, so a polygon has as many corners as sides.",
      "A triangle has 3 sides, a square and a rectangle have 4, and a hexagon has 6. A rectangle has 4 square corners, and a square is a rectangle whose 4 sides are the same length.",
      "A cube has 12 edges and 8 corners, so its stick model needs 12 sticks and 8 clay balls.",
    ],
    pitfalls: [
      "Counting every side when some sticks are already placed, instead of counting the gaps.",
      "Calling a drawing with a gap or a curved side a shape.",
      "Thinking a turned square is not a square.",
    ],
    parentGuide:
      "Build a few shapes together with toothpicks and dough or play clay. Ask how many toothpicks and how many balls each shape needs before you build it.",
  }),
  chainLesson({
    id: "k-build-represent-sentences-lesson",
    title: "Pictures and number sentences for joining and taking away",
    summary:
      "When more come in, we add, and we write plus, +. When some go away, we take away, and we write minus, −. A number sentence such as $4 + 3$ tells what happens. A picture can show the same thing with counters.",
    templateIds: ["picture-to-number-sentence", "number-sentence-to-picture"],
    objectives: [
      "Choose the number sentence that tells about a picture or a story of joining or taking away.",
      "Choose the picture that shows an addition or subtraction number sentence.",
    ],
    openingTitle: "What happens decides the sign",
    opening: [
      "Look at what happens first. 4 ducks are on a pond, and 3 more come. More coming in is joining, so we add: $4 + 3$.",
      "6 apples are in a bowl, and Maya eats 2. Some going away is taking away, so we subtract: $6 - 2$.",
      "A number sentence is a short way to write what happens with numbers. With an equal sign, =, it also says how many there are at the end: $4 + 3 = 7$.",
    ],
    example: {
      prompt:
        "A picture shows 4 teal counters in a group and 3 rust counters with an arrow coming in. Which number sentence shows it?",
      steps: [
        "Count the teal group: 4.",
        "Count the rust group: 3. The arrow shows them coming in.",
        "Coming in is joining, so it is plus: $4 + 3$.",
        "Count all of them: 7. So $4 + 3 = 7$.",
      ],
      answer: "$4 + 3$",
    },
    methodTitle: "Action first, then count",
    method: [
      "Decide the action: more come in (plus) or some go away (minus).",
      "Count the starting group and the group that moves.",
      "Write the first number, the sign, then the second number. With =, add the number at the end.",
    ],
    formalTitle: "Joining and taking away",
    formal: [
      "Joining two groups is addition. The parts are the numbers added, and the total is their sum.",
      "Taking some away from a group is subtraction. The number at the start comes first, then the number taken away, and the number left is the difference.",
      "A picture, a story, fingers and a number sentence can all show the same joining or taking away.",
    ],
    pitfalls: [
      "Writing minus when more come in, or plus when some go away.",
      "Writing only the total instead of a sentence that shows both groups.",
      "Swapping the number taken away and the number left.",
    ],
    parentGuide:
      "Act out small stories with toys: 4 cars, then 2 more drive in. Ask your learner to say the number sentence, then to show it with the toys.",
  }),
];

export const kBuildRepresentFacetMappings: FacetMapping[] = [
  {
    templateId: "sticks-and-balls-needed",
    facetId: "build-and-draw-shapes.core",
    extent: "partial",
    rationale:
      "Counting the sticks (sides) and clay balls (corners) a model of a triangle, square, rectangle, hexagon or cube needs, the sticks missing from a partial build, and the balls that join a set of sticks. Pictured objects are named in words with the shape's outline. The learner does not place sticks or balls on a peg board.",
  },
  {
    templateId: "check-the-drawing",
    facetId: "build-and-draw-shapes.core",
    extent: "partial",
    rationale:
      "Choosing the one drawing that is a triangle, square, rectangle or hexagon among drawings that are open, have a curved side, have one side too many or too few, or have corners or sides that do not fit. Judging drawings stands in for drawing; the learner does not draw.",
  },
  {
    templateId: "drawing-mistake",
    facetId: "build-and-draw-shapes.core",
    extent: "partial",
    rationale:
      "Naming the one flaw in a child's drawing of a shape (not closed, a curved side, the wrong number of sides, or corners that are not square corners), or that nothing is wrong when the shape is only turned. The learner does not draw.",
  },
  {
    templateId: "picture-to-number-sentence",
    facetId: "represent-join-separate.core",
    extent: "partial",
    rationale:
      "Reading a counter picture of joining or taking away, a spoken story, or a picture of things as an expression, an equation or a sentence of words, within 10. Fingers and claps are not shown, and the learner does not act out or say an explanation.",
  },
  {
    templateId: "number-sentence-to-picture",
    facetId: "represent-join-separate.core",
    extent: "partial",
    rationale:
      "Choosing the counter picture or ten frame that shows an addition or subtraction expression or equation within 10. The learner chooses a drawing and does not build one with counters or fingers.",
  },
];
