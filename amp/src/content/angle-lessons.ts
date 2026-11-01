import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const angleLessons: Lesson[] = [
  {
    id: "measuring-angles",
    title: "Measuring angles in degrees",
    summary:
      "A ray is a straight path that starts at a point and goes on forever in one direction. An angle is the opening between two rays that start at the same point. That shared starting point is called the vertex. The size of an angle is how far one ray turns to reach the other. A degree is a small piece of a turn: 360 degrees make one full turn.",
    templateIds: ["protractor-reading", "adjacent-angles", "turn-degrees"],
    senses: {
      degree: "degree-angle",
      vertex: "vertex",
      quarter: "fourth",
      center: "center",
    },
    noLink: ["scale", "scales", "part", "parts", "whole", "more than"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain a degree as 1 of 360 equal pieces of a full turn, and find an angle that is part of a turn.",
      "Measure with a protractor, and add or subtract angles that sit side by side without overlapping.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "An angle is a turn",
        paragraphs: [
          "Lay a pencil flat on a table and spin it around one end. A small spin makes a small angle. A bigger spin makes a bigger angle. How long the pencil is does not matter. Only the amount of turn does.",
          "Turn all the way around, back to where you started. That is a full turn: 360 degrees, written 360°. So 1 degree is 1 of 360 equal pieces of a full turn.",
          "A protractor is a see-through half circle with degree numbers printed around its curved edge. It has two rows of numbers. The outer row counts up from 0 on the left. The inner row counts up from 0 on the right.",
        ],
      },
      {
        title: "Degrees are pieces of a turn",
        paragraphs: [
          "Look at the picture. A quarter turn is one of 4 equal parts of a full turn: 360 ÷ 4 = 90°. That is a right angle, a square corner like the corner of a page.",
          "A half turn is 360 ÷ 2 = 180°. It is called a straight angle, because its two rays make one straight line.",
          "If a circle is cut into 12 equal angles at its middle, each one is $360 \\div 12 = 30$ degrees.",
        ],
        illustration: "degree-turns",
      },
      {
        title: "Reading a protractor",
        paragraphs: [
          "Put the protractor's center, the small mark in the middle of its straight edge, on the vertex. Turn the protractor so one ray lies on a 0. Then use the row of numbers that starts at 0 on that ray. Follow it to the other ray and read the number.",
          "Look at the picture. Ray $BA$ lies on 0 on the left, so read the outer row: angle $ABC$ is 50°. The inner row shows 130 there, but it counts from the right.",
          "Two angles can sit side by side, sharing a ray, with no overlap. Together they make one bigger angle. For example, 20° and 85° make 20 + 85 = 105°. If you know the big angle and one part, subtract: 105 − 20 = 85°.",
        ],
        illustration: "protractor-scales",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Degrees of turn",
        paragraphs: [
          "The measure of an angle is how far one ray turns around the vertex to reach the other ray. It is counted in degrees, and a full turn is 360°. To measure with a protractor, put its center on the vertex and one ray on 0. Then read the row of numbers that starts at 0 on that ray.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Ray $BA$ lies on 0 on the left of a protractor. Ray $BC$ crosses the outer scale at 50 and the inner scale at 130. What is angle $ABC$?",
      steps: [
        "Ray $BA$ is at 0 on the left. The outer row is the one that starts at 0 on the left, so use the outer row.",
        "Follow the outer row from 0 up to ray $BC$. It reads 50.",
        "Angle $ABC$ measures 50°. The 130 belongs to the inner row, which starts at 0 on the right, not on ray $BA$.",
      ],
      answer: "50",
      answerUnit: "degrees",
    },
    pitfalls: [
      "Read the row that is at 0 on the first ray, not whichever number looks closer.",
      "A small opening has a small measure. An acute angle is an angle narrower than a square corner, so it measures less than 90°.",
    ],
    parentGuide:
      "Open a door a little, then to a square corner, then wide. Each time, ask whether the opening is less than, equal to or more than 90 degrees. The corner of a sheet of paper is exactly 90 degrees, so it makes a good checker.",
  },
  {
    id: "lines-and-angles",
    title: "Lines, rays and kinds of angles",
    summary:
      "A line is a straight path that goes on forever in both directions. A ray is a straight path that starts at one point and goes on forever in one direction. A segment is the straight part between two endpoints, the points where it stops. Where two rays start at the same point, they make an angle, an opening between them.",
    templateIds: [
      "angle-classify",
      "line-ray-segment",
      "line-relationship",
      "classify-triangle-angles",
    ],
    senses: { vertex: "vertex", quarter: "fourth", square: "square-shape" },
    noLink: ["plane"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name lines, rays and line segments, and sort angles and triangles by their angles.",
      "Tell parallel lines from perpendicular lines and from other lines that cross.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Follow where a path can go",
        paragraphs: [
          "Think of three straight paths drawn with a ruler. One has a dot at each end, so it stops at both ends. One has a dot at one end and an arrow at the other, so it keeps going one way. One has an arrow at each end, so it keeps going both ways.",
          "A dot at an end shows a point where the path stops. An arrow shows that the path keeps going, even though the drawing has to stop.",
          "A square corner, like the corner of a page, is called a right angle. We compare other angles with it.",
          "Parallel lines are lines that go in the same direction and never meet, like train tracks. Perpendicular lines are lines that cross at a right angle.",
        ],
      },
      {
        title: "Lines, rays and segments",
        paragraphs: [
          "Look at the picture. A line has two arrows. A ray has one endpoint and one arrow. A segment has two endpoints.",
          "Capital letters name points. Ray $AB$ starts at point $A$ and goes through point $B$, then on forever. Ray $BA$ starts at $B$ instead, so it is a different ray.",
          "An angle is two rays that start at the same point. That shared point is called the vertex of the angle.",
        ],
        illustration: "line-ray-segment",
      },
      {
        title: "Kinds of angles and lines",
        paragraphs: [
          "Hold a square corner up to an angle. An acute angle is an angle narrower than the square corner. A right angle matches it exactly, 90°. An obtuse angle is an angle wider than a square corner but not yet a straight line. A straight angle is an angle whose two rays make one straight line, 180°.",
          "A triangle is a flat shape with 3 straight sides and 3 angles. It is named by its largest angle. If one angle is a right angle, it is a right triangle. If one angle is obtuse, it is an obtuse triangle. If all three are acute, it is an acute triangle.",
          "Parallel lines never meet, like train tracks. Perpendicular lines cross at a right angle, like two edges of a page that meet at a corner.",
          "A dot grid is a grid of evenly spaced dots. On a dot grid, describe a line by its step: how far across for how far up or down. Turning a step a quarter turn swaps the two numbers and flips up and down. So 2 across and 1 up turns into 1 across and 2 down. Lines with those two steps are perpendicular.",
        ],
        illustration: "angle-kinds",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Line and angle relationships",
        paragraphs: [
          "A line has no endpoints, a ray has one and a segment has two. Perpendicular lines meet at a right angle. Parallel lines on a flat surface never meet. An angle's kind depends only on how far one ray turns to reach the other, not on how long the rays are drawn.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "One line goes 1 across for every 2 up. Another goes 2 across for every 1 down. How are they related?",
      steps: [
        "Parallel lines go in the same direction. One line climbs up and the other goes down, so they are not parallel.",
        "Turn the step (1 across, 2 up) a quarter turn: swap the numbers and flip up and down. That gives (2 across, 1 down).",
        "That is exactly the second line's step. So the lines cross at a right angle, and they are perpendicular.",
      ],
      answer: "perpendicular",
    },
    pitfalls: [
      "Ray $AB$ starts at $A$. Ray $BA$ starts at $B$. They are different rays.",
      "Lines that cross close to a square corner are not perpendicular unless the angle is exactly a right angle.",
    ],
    parentGuide:
      "Look for parallel and perpendicular lines around the house: window frames, floor tiles, a ladder. Use the corner of a sheet of paper to test for right angles.",
  },
  {
    id: "lines-of-symmetry",
    title: "Lines of symmetry",
    summary:
      "Fold a paper shape in half. If the two halves match exactly, the fold line is a line of symmetry. A shape can have one line of symmetry, several, or none at all.",
    templateIds: ["symmetry-line-count", "symmetry-line-check"],
    senses: { side: "side", square: "square-shape" },
    noLink: ["edge", "leaves", "opposite", "models"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Decide whether a line is a line of symmetry.",
      "Count every line of symmetry of a shape.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Fold and match",
        paragraphs: [
          "Cut a heart from folded paper and open it. The two halves are mirror images: each one is the other flipped over. The fold down the middle is a line of symmetry.",
          "To test a line, imagine folding along it. Every side and every corner on one half must land exactly on a side or corner of the other half. Parts that lie on the fold stay where they are.",
        ],
      },
      {
        title: "Fold to test",
        paragraphs: [
          "Look at the picture. A rectangle is a shape with 4 straight sides and 4 square corners. A long rectangle folds onto itself along 2 lines. Each one goes through the middles of two sides that face each other.",
          "A diagonal is a line from one corner to the far corner. Folded on a diagonal, a long rectangle does not match: two corners stick out. A square is different. A square is a rectangle with 4 equally long sides, and its diagonals are lines of symmetry too.",
        ],
        illustration: "symmetry-folds",
      },
      {
        title: "Count them all",
        paragraphs: [
          "Try every fold that could work. Fold through two corners, through the middles of two sides, and from a corner to the middle of a side. Count each fold where the halves match exactly.",
          "Some shapes have all sides equally long and all corners equally wide. A shape like that has as many lines of symmetry as sides. With 3 sides it has 3, and with 6 sides it has 6.",
          "Some shapes have none. A triangle with three different side lengths has none. A parallelogram is a 4-sided shape whose facing sides run in the same direction and never meet. A slanted parallelogram with two long sides and two short sides has none either.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Reflection symmetry",
        paragraphs: [
          "A reflection is a flip of a shape over a line, like a mirror image. A line is a line of symmetry when flipping the shape over it leaves the shape looking exactly the same, in the same place. Each point lands on a point of the shape, the same distance from the line on the other side. Points on the line stay put. Folding paper shows this when the halves match exactly.",
        ],
      },
    ],
    workedExample: {
      prompt: "How many lines of symmetry does a square have?",
      steps: [
        "Fold through the middles of two sides that face each other. A square has 2 such pairs of sides, so that gives 2 lines.",
        "Fold from one corner to the far corner. All 4 sides are equally long, so the halves match. A square has 2 such folds, so that gives 2 more lines.",
        "Any other fold leaves a corner sticking out. So a square has 2 + 2 = 4 lines of symmetry.",
      ],
      answer: "4",
      answerUnit: "lines",
    },
    pitfalls: [
      "A line can cut a shape into two pieces of the same size without being a line of symmetry. The halves must match when folded.",
      "Test each diagonal by folding. A long rectangle's diagonals are not lines of symmetry, but a square's are.",
    ],
    parentGuide:
      "Cut shapes from paper and fold them. Before each fold, ask whether the halves will match, then check. Letters such as $A$, $H$ and $X$ make good tests.",
  },
];

const terms = {
  measure: ["degree-angle", "vertex"],
  lines: ["ray", "right-angle"],
  symmetry: ["line-of-symmetry"],
} satisfies Record<string, MethodTerm[]>;
const angleOpening =
  "A ray is a straight path that starts at a point and goes on forever one way. An angle is the opening between two rays that start at the same point, called the vertex.";
export const angleMethods: Record<string, ProblemMethod> = {
  "protractor-reading": {
    goal: "Find the measure of an angle on a protractor, in degrees.",
    intuition: `${angleOpening} A degree is one of 360 equal pieces of a full turn. A protractor is a see-through half circle with two rows of degree numbers. One row starts at 0 on the left, and the other starts at 0 on the right.`,
    senses: { degree: "degree-angle", vertex: "vertex" },
    noLink: ["scale", "scales"],
    terms: terms.measure,
    method: [
      "Find the ray that lies on 0. Find the row of numbers that starts at 0 there.",
      "Follow that same row to the other ray and read the number.",
    ],
    watch: "Do not switch rows. The other row gives 180 minus the measure.",
  },
  "adjacent-angles": {
    goal: "Two angles sit side by side. Find the whole angle or the missing part.",
    intuition: `${angleOpening} A degree is one of 360 equal pieces of a full turn. Two angles that share a ray and do not overlap make one bigger angle. Its measure is the sum of theirs, the two added together.`,
    senses: { degree: "degree-angle", vertex: "vertex" },
    terms: terms.measure,
    method: [
      "Name the whole angle and the two smaller angles that fill it.",
      "If the whole is unknown, add the two smaller angles. If one smaller angle is unknown, subtract the known one from the whole.",
    ],
    watch:
      "Check which angle the question asks for: the whole one or one of the smaller ones.",
  },
  "turn-degrees": {
    goal: "A circle is cut into equal angles. Find the shaded angle in degrees.",
    intuition: `${angleOpening} The center is the middle point of the circle. A degree is one of 360 equal pieces of a full turn, so a full turn around the center is 360°. Cutting the circle into equal angles shares those 360° equally.`,
    senses: { degree: "degree-angle", vertex: "vertex", center: "center" },
    terms: terms.measure,
    method: [
      "Divide 360° by the number of equal angles to find one of them.",
      "Multiply by the number of shaded angles.",
    ],
    watch:
      "Divide 360 by the number of equal angles, not by the number shaded.",
  },
  "angle-classify": {
    goal: "Sort an angle as acute, right, obtuse or straight.",
    intuition: `${angleOpening} A right angle is a square corner, like the corner of a page. It measures 90 degrees, where 360 degrees make a full turn. Other angles are named by comparing them with a right angle.`,
    senses: { vertex: "vertex", degree: "degree-angle" },
    noLink: ["change", "opposite"],
    terms: terms.lines,
    method: [
      "Compare the opening with a square corner.",
      "An acute angle is an angle narrower than a square corner. A right angle matches it exactly.",
      "An obtuse angle is an angle wider than a square corner but not yet straight. A straight angle is an angle whose rays make one straight line.",
    ],
    watch:
      "How long the rays are drawn does not change the angle. Only the opening matters.",
  },
  "line-ray-segment": {
    goal: "Name a straight figure as a line, a ray or a line segment.",
    intuition:
      "Capital letters name points, the exact places marked with dots. A line is a straight path that goes on forever both ways. A ray is a straight path that starts at one point and goes on forever one way. A segment is the straight part between two endpoints, the points where it stops.",
    terms: terms.lines,
    method: [
      "Look at each end. An arrow means the path keeps going. A dot with no arrow beyond it means the path stops there.",
      "Two arrows: a line. Two stopping ends: a segment. One of each: a ray. Name it starting with the letter at its dot end.",
    ],
    watch:
      "Ray $AB$ starts at point $A$, so the first letter names the endpoint.",
  },
  "line-relationship": {
    goal: "Tell whether two lines on a dot grid are parallel, perpendicular or neither.",
    intuition:
      "A dot grid is a grid of evenly spaced dots. Parallel lines are lines that go in the same direction and never meet. Perpendicular lines are lines that cross at a right angle, a square corner. Describe each line by its step: how far across for how far up or down.",
    senses: { square: "square-shape", quarter: "fourth" },
    terms: terms.lines,
    method: [
      "Write each line's step in its smallest numbers. For example, 2 across and 4 up is the same direction as 1 across and 2 up.",
      "Same step: parallel. Now turn one step a quarter turn: swap its two numbers and flip up and down. If that gives the other step, the lines are perpendicular. Otherwise: neither.",
    ],
    watch:
      "Lines that look nearly square can still be neither. Count the steps.",
  },
  "classify-triangle-angles": {
    goal: "Sort a triangle as acute, right or obtuse by its angles.",
    intuition:
      "A triangle is a flat shape with 3 straight sides and 3 angles. A right angle is a square corner. An acute angle is an angle narrower than a square corner. An obtuse angle is an angle wider than a square corner. A triangle is named by its largest angle.",
    senses: { side: "side", square: "square-shape" },
    noLink: ["opposite"],
    terms: terms.lines,
    method: [
      "Find the largest angle. It is the one across from the longest side.",
      "If it is a square corner, often marked with a small square, the triangle is a right triangle. If it is wider, the triangle is obtuse. If it is narrower, all three angles are acute, so the triangle is acute.",
    ],
    watch:
      "A triangle can have only one right or obtuse angle, so check the largest one.",
  },
  "symmetry-line-count": {
    goal: "Count the lines of symmetry of a shape.",
    intuition:
      "A line of symmetry is a fold line where the two halves of a shape match exactly. Each half is the mirror image of the other. To test a fold, every side and corner on one half must land on a side or corner of the other half.",
    senses: { side: "side", square: "square-shape" },
    noLink: ["leaves", "opposite", "edge"],
    terms: terms.symmetry,
    method: [
      "Try every fold that could work. Fold through two corners, through the middles of two sides, and from a corner to the middle of a side.",
      "Count each fold where every side and corner lands on a matching side or corner.",
    ],
    watch:
      "A long rectangle's diagonals, the lines from corner to far corner, are not lines of symmetry. A square's diagonals are.",
  },
  "symmetry-line-check": {
    goal: "Choose the dashed line that is a line of symmetry of a shape.",
    intuition:
      "A line of symmetry is a fold line where the two halves of a shape match exactly. Each half is the mirror image of the other. To test a fold, every side and corner on one half must land on a side or corner of the other half.",
    senses: { side: "side", square: "square-shape" },
    noLink: ["opposite", "edge"],
    terms: terms.symmetry,
    method: [
      "Imagine folding the shape along each dashed line.",
      "Choose the line where every side and corner lands exactly on a matching side or corner, or on the fold itself.",
    ],
    watch: "A line through the middle can still give halves that do not match.",
  },
};
export const anglePrinciples: Record<string, string> = {
  "protractor-reading":
    "An angle's measure counts degrees from 0 on one ray to the other ray, all on one row of numbers.",
  "adjacent-angles":
    "Angles that share a ray and do not overlap add up to the whole angle they make together.",
  "turn-degrees":
    "A full turn is 360°. To find a shaded angle, divide 360° by the number of equal angles, then multiply by the number shaded.",
  "angle-classify":
    "Angles are sorted by comparing them with a right angle, 90°: acute is less, obtuse is more but less than 180°, and straight is exactly 180°.",
  "line-ray-segment":
    "A line goes on forever both ways. A ray starts at an endpoint and goes on forever one way. A segment stops at two endpoints.",
  "line-relationship":
    "Parallel lines never meet. Perpendicular lines meet at a right angle.",
  "classify-triangle-angles":
    "A triangle is named by its largest angle: right if it is 90°, obtuse if it is more, acute if it is less.",
  "symmetry-line-count":
    "Each line of symmetry is a fold that matches the shape exactly onto itself.",
  "symmetry-line-check":
    "Flipping a shape over a line of symmetry lands every side and corner on a matching side or corner.",
};
