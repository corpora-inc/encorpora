import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const angleLessons: Lesson[] = [
  {
    id: "measuring-angles",
    title: "Measuring angles in degrees",
    summary:
      "An angle measures a turn: a full turn is 360°, and a protractor counts degrees from 0 on one ray.",
    templateIds: ["protractor-reading", "adjacent-angles", "turn-degrees"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain a degree as 1/360 of a full turn, and find an angle as a fraction of a turn.",
      "Measure with a protractor, and add or subtract angles that do not overlap.",
    ],
    sections: [
      {
        title: "Degrees are pieces of a turn",
        paragraphs: [
          "Turn all the way around a point and you make a full turn: 360 degrees, written 360°. One degree is 1/360 of a full turn.",
          "A quarter turn is 90°, a right angle. A half turn is 180°, a straight angle. If a circle is cut into 12 equal angles, each is $360 \\div 12 = 30$ degrees.",
        ],
        illustration: "degree-turns",
      },
      {
        title: "Reading a protractor",
        paragraphs: [
          "Put the protractor's center on the vertex and line up one ray with 0. A protractor has two scales: one starts at 0 on the right, the other at 0 on the left. Use the scale that is at 0 on your ray.",
          "Angles that share a ray and do not overlap add: the whole angle is the sum of its parts, and a missing part is the whole minus the known part.",
        ],
        illustration: "protractor-scales",
      },
    ],
    workedExample: {
      prompt:
        "Ray BA lies on 0 on the left of a protractor. Ray BC crosses the outer scale at 50 and the inner scale at 130. What is angle ABC?",
      steps: [
        "Ray BA is at 0 on the left, where the outer scale starts.",
        "Follow the outer scale to ray BC: it reads 50.",
        "Angle ABC measures 50°; the 130 belongs to the scale that starts on the right.",
      ],
      answer: "50",
      answerUnit: "degrees",
    },
    pitfalls: [
      "Read the scale that is at 0 on the first ray, not whichever number is nearer.",
      "A small opening is a small measure: check that an acute angle reads less than 90.",
    ],
    parentGuide:
      "Open a door a little, then to a right angle, then wide. Ask whether each opening is less than, equal to or more than 90 degrees, then check with a protractor app or paper corner.",
  },
  {
    id: "lines-and-angles",
    title: "Lines, rays and kinds of angles",
    summary:
      "Lines go on both ways, rays one way and segments stop; angles are acute, right, obtuse or straight, and lines can be parallel or perpendicular.",
    templateIds: [
      "angle-classify",
      "line-ray-segment",
      "line-relationship",
      "classify-triangle-angles",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name lines, rays and line segments, and classify angles and triangles by their angles.",
      "Tell parallel lines from perpendicular lines and from other crossing lines.",
    ],
    sections: [
      {
        title: "Lines, rays and segments",
        paragraphs: [
          "A line goes on forever both ways; arrows show this. A ray starts at a point and goes on forever one way; ray AB starts at A. A line segment stops at both endpoints.",
          "An angle is two rays that share an endpoint, the vertex.",
        ],
        illustration: "line-ray-segment",
      },
      {
        title: "Kinds of angles and lines",
        paragraphs: [
          "Compare an angle with a square corner. Smaller is acute, exactly a square corner is right, wider is obtuse, and a straight line is a straight angle. A triangle is named by its largest angle.",
          "Parallel lines go the same direction and never meet. Perpendicular lines cross at a right angle. On a dot grid, perpendicular lines take steps turned a quarter turn: 2 across and 1 up becomes 1 across and 2 down.",
        ],
        illustration: "angle-kinds",
      },
    ],
    workedExample: {
      prompt:
        "One line goes 1 across for every 2 up. Another goes 2 across for every 1 down. How are they related?",
      steps: [
        "The steps are different, so the lines are not parallel.",
        "Turning (1 across, 2 up) a quarter turn gives (2 across, 1 down).",
        "The lines are perpendicular.",
      ],
      answer: "perpendicular",
    },
    pitfalls: [
      "Ray AB starts at A; ray BA starts at B. They are different rays.",
      "Lines that cross at an angle close to a right angle are not perpendicular unless it is exactly a right angle.",
    ],
    parentGuide:
      "Find parallel and perpendicular lines around the house: window frames, floor tiles, a ladder. Use the corner of a sheet of paper to test right angles.",
  },
  {
    id: "lines-of-symmetry",
    title: "Lines of symmetry",
    summary:
      "A line of symmetry folds a shape into two halves that match exactly.",
    templateIds: ["symmetry-line-count", "symmetry-line-check"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Decide whether a line is a line of symmetry.",
      "Count every line of symmetry of a shape.",
    ],
    sections: [
      {
        title: "Fold to test",
        paragraphs: [
          "Fold a shape along a line. If the two halves match exactly, with every corner landing on a corner, the line is a line of symmetry.",
          "A rectangle has 2 lines of symmetry, through the middles of opposite sides. Its diagonal is not one: folded on a diagonal, the corners stick out.",
        ],
        illustration: "symmetry-folds",
      },
      {
        title: "Count them all",
        paragraphs: [
          "Try folds through opposite corners and through the middles of opposite sides. A regular shape with n equal sides has n lines of symmetry.",
          "Some shapes have none: a slanted parallelogram and a triangle with three different sides cannot be folded into matching halves.",
        ],
      },
    ],
    workedExample: {
      prompt: "How many lines of symmetry does a square have?",
      steps: [
        "Folds through the middles of opposite sides: 2 lines.",
        "Folds through opposite corners: 2 more lines.",
        "A square has 4 lines of symmetry.",
      ],
      answer: "4",
      answerUnit: "lines",
    },
    pitfalls: [
      "A line that cuts a shape into two equal areas is not always a line of symmetry: the halves must match when folded.",
      "Check the diagonals of rectangles and parallelograms by folding; they are not lines of symmetry.",
    ],
    parentGuide:
      "Cut shapes from paper and fold them. Ask before each fold whether the halves will match, then check. Letters such as A, H and X make good tests.",
  },
];

const terms = {
  measure: [
    ["degree", "One 360th of a full turn, written 1°."],
    ["vertex", "The point where the two rays of an angle meet."],
  ],
  lines: [
    ["ray", "Part of a line that starts at a point and goes on one way."],
    ["right angle", "A square corner: 90°."],
  ],
  symmetry: [
    [
      "line of symmetry",
      "A fold line that makes the two halves match exactly.",
    ],
  ],
} satisfies Record<string, [string, string][]>;
export const angleMethods: Record<string, ProblemMethod> = {
  "protractor-reading": {
    goal: "Given an angle on a protractor, find its measure in degrees.",
    terms: terms.measure,
    method: [
      "Find the ray that lies on 0, and the scale that starts at 0 there.",
      "Follow that same scale to the other ray and read the number.",
    ],
    watch: "Do not switch scales: the other scale gives 180 minus the measure.",
  },
  "adjacent-angles": {
    goal: "Given two angles side by side, find the whole or a missing part.",
    terms: terms.measure,
    method: [
      "Name the whole angle and the two parts that fill it.",
      "Whole unknown: add the parts. Part unknown: subtract the known part from the whole.",
    ],
    watch: "Check which angle the question names: the whole or one part.",
  },
  "turn-degrees": {
    goal: "Given a circle cut into equal angles, find the shaded angle in degrees.",
    terms: terms.measure,
    method: [
      "A full turn is 360°: divide by the number of equal angles to get one.",
      "Multiply by the number of shaded angles.",
    ],
    watch:
      "Divide 360 by the number of equal angles, not by the number shaded.",
  },
  "angle-classify": {
    goal: "Given an angle, classify it as acute, right, obtuse or straight.",
    terms: terms.lines,
    method: [
      "Compare the opening with a square corner.",
      "Smaller: acute. Equal: right. Wider: obtuse. A straight line: straight.",
    ],
    watch: "The length of the rays does not change the angle.",
  },
  "line-ray-segment": {
    goal: "Given a straight figure, name it as a line, a ray or a line segment.",
    terms: terms.lines,
    method: [
      "Look at each end: an arrow goes on forever; a point stops.",
      "Two arrows: line. Two points: segment. One of each: a ray named from its starting point.",
    ],
    watch: "Ray AB starts at A, so the first letter is the endpoint.",
  },
  "line-relationship": {
    goal: "Given two lines on a dot grid, tell whether they are parallel, perpendicular or neither.",
    terms: terms.lines,
    method: [
      "Count each line's steps: how far across for how far up or down.",
      "Same steps: parallel. Steps turned a quarter turn: perpendicular. Otherwise neither.",
    ],
    watch:
      "Lines that look nearly square can still be neither: count the steps.",
  },
  "classify-triangle-angles": {
    goal: "Given a triangle, classify it as acute, right or obtuse.",
    terms: terms.lines,
    method: [
      "Find the largest angle, opposite the longest side.",
      "A right-angle mark: right. Wider than a square corner: obtuse. Otherwise acute.",
    ],
    watch:
      "Only one angle of a triangle can be right or obtuse; check the largest.",
  },
  "symmetry-line-count": {
    goal: "Given a shape, count its lines of symmetry.",
    terms: terms.symmetry,
    method: [
      "Try folds through opposite corners and the middles of opposite sides.",
      "Count each fold where every corner lands on a corner.",
    ],
    watch: "Diagonals of rectangles are not lines of symmetry.",
  },
  "symmetry-line-check": {
    goal: "Given dashed lines across a shape, choose the line of symmetry.",
    terms: terms.symmetry,
    method: [
      "Imagine folding along each dashed line.",
      "Choose the one where each corner lands exactly on another corner or on the fold.",
    ],
    watch: "A line through the middle can still give halves that do not match.",
  },
};
export const anglePrinciples: Record<string, string> = {
  "protractor-reading":
    "An angle's measure counts degrees from 0 on one ray to the other ray, on one scale.",
  "adjacent-angles":
    "Angles that share a ray and do not overlap add to the whole angle.",
  "turn-degrees": "A full turn is 360°, so an angle is its fraction of 360°.",
  "angle-classify":
    "Angles are classified by comparing them with a right angle, 90°.",
  "line-ray-segment":
    "Lines continue both ways, rays one way from an endpoint, and segments stop at two endpoints.",
  "line-relationship":
    "Parallel lines never meet; perpendicular lines meet at a right angle.",
  "classify-triangle-angles": "A triangle is named by its largest angle.",
  "symmetry-line-count":
    "Each line of symmetry is a fold that matches the shape to itself.",
  "symmetry-line-check":
    "A line of symmetry reflects every corner of a shape onto a corner.",
};
