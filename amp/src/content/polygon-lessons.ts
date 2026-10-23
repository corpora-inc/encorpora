import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const polygonLessons: Lesson[] = [
  {
    id: "polygons-and-solids",
    title: "Polygons, faces, edges and vertices",
    summary:
      "A polygon is a closed flat shape with straight sides. A prism has two matching ends; a pyramid has one base and sides meeting at a tip. Their flat faces meet along edges and their corners are vertices.",
    templateIds: ["name-polygon", "polygon-with-angles", "solid-parts"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name triangles, quadrilaterals, pentagons, hexagons and octagons, however irregular.",
      "Count the faces, edges and vertices of prisms and pyramids, hidden ones included.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Flat outline or solid object",
        paragraphs: [
          "A triangle drawn on paper is flat: its straight sides close around a region. A box can be held and turned; its flat faces meet along edges. Describe the flat outline and the solid's faces separately.",
        ],
      },
      {
        title: "Polygons",
        paragraphs: [
          "A polygon is a closed flat shape made of straight sides. Where two sides meet is an angle, so a polygon has as many angles as sides.",
          "The name counts the sides: tri- 3, quadri- 4, penta- 5, hexa- 6, octa- 8. The sides do not have to be equal, and a corner may point inward.",
        ],
        illustration: "polygon-names",
      },
      {
        title: "Faces, edges and vertices",
        paragraphs: [
          "A face is a flat surface of a solid. An edge is where two faces meet. A vertex is a corner where edges meet.",
          "A drawing shows only the front. Dashed lines show hidden edges, so count those too. A prism has two matching ends joined by flat sides; a pyramid has one base and triangles that meet at a point.",
        ],
        illustration: "solid-parts",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Flat and solid figures",
        paragraphs: [
          "A polygon is a closed flat figure made of straight segments, with one vertex where each neighboring pair meets. A polyhedron is a solid bounded by flat polygonal faces; its faces meet along edges and its edges at vertices. A drawing of a solid is a picture of it, not the solid itself.",
        ],
      },
    ],
    workedExample: {
      prompt: "How many edges does a triangular prism have?",
      steps: [
        "Each triangular end has 3 edges: $3 + 3 = 6$.",
        "3 more edges join the two ends.",
        "$6 + 3 = 9$ edges.",
      ],
      answer: "9",
      answerUnit: "edges",
    },
    pitfalls: [
      "Count hidden faces and edges: the drawing shows only the front.",
      "A polygon with 6 unequal sides is still a hexagon.",
    ],
    parentGuide:
      "Hold a cereal box. Count its faces by touching each one, then its edges by running a finger along each. Ask which ones you could not see from where you stand.",
  },
  {
    id: "quadrilaterals",
    title: "Squares, rectangles and rhombuses",
    summary:
      "Use side lengths and corner angles to tell four-sided shapes apart.",
    templateIds: ["classify-quadrilateral", "find-quadrilateral"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Read right-angle marks and tick marks on a quadrilateral.",
      "Name squares, rectangles and rhombuses, and recognize quadrilaterals that are none of them.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Four sides, different special features",
        paragraphs: [
          "Many flat shapes have four sides. Some have four square corners, some have four equal sides, and a square has both. Look at what is marked on the figure instead of relying on how it is tilted.",
        ],
      },
      {
        title: "Reading the marks",
        paragraphs: [
          "A small square in a corner marks a right angle. Sides with the same number of tick marks are the same length.",
          "A rectangle has 4 right angles. A rhombus has 4 equal sides. A square has 4 right angles and 4 equal sides, so it is a rectangle and a rhombus at once. Many quadrilaterals are none of these.",
        ],
        illustration: "quadrilateral-marks",
      },
      {
        title: "The most exact name",
        paragraphs: [
          "Check right angles first, then sides. 4 right angles and 4 equal sides: square. Only the right angles: rectangle. Only the equal sides: rhombus.",
          "A quadrilateral with neither, such as a slanted shape with two long and two short sides, is none of the three. It is still a quadrilateral.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Properties of four-sided figures",
        paragraphs: [
          "A quadrilateral is a polygon with four sides. A rectangle has four right angles; a rhombus has four equal side lengths. A square satisfies both definitions, regardless of how it is turned.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A quadrilateral has all 4 sides marked equal and has no right angles. What is its most exact name?",
      steps: [
        "4 equal sides: it is a rhombus.",
        "No right angles: it is not a rectangle, so it is not a square.",
        "The most exact name is rhombus.",
      ],
      answer: "rhombus",
    },
    pitfalls: [
      "A square is also a rectangle and a rhombus; when asked for the most exact name, say square.",
      "A tilted shape keeps its name: read the marks, not the direction.",
    ],
    parentGuide:
      "Fold a sheet of paper to check corners: a right angle fits the corner of the page exactly. Hunt for rectangles and squares at home and test their corners.",
  },
  {
    id: "quadrilateral-hierarchy",
    title: "The quadrilateral family tree",
    summary:
      "A quadrilateral is a closed flat shape with four straight sides. Its names describe its features: square corners, equal side lengths, or opposite sides that stay the same distance apart. One shape can meet several descriptions.",
    templateIds: [
      "quadrilateral-names",
      "hierarchy-statement",
      "inherited-property",
      "quadrilateral-hierarchy-multiselect",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name every category a quadrilateral belongs to.",
      "Use that a subcategory has every property of its category.",
      "Check every statement when several answers may be true.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A square can have several names",
        paragraphs: [
          "A right angle is a square corner, measuring $90^\\circ$ (90 degrees). Parallel sides lie on lines that stay the same distance apart and never meet. Opposite sides do not share a corner. A parallelogram has two pairs of parallel opposite sides.",
          "A rectangle has four right angles; a rhombus has four equal sides. A square has both features, so it is both a rectangle and a rhombus. Each of these shapes is also a parallelogram.",
        ],
      },
      {
        stage: "method",
        title: "Categories inside categories",
        paragraphs: [
          "A parallelogram has 2 pairs of parallel sides. A rectangle is a parallelogram with 4 right angles; a rhombus is a parallelogram with 4 equal sides; a square is both.",
          "Read the tree downward: each shape belongs to every category above it. So every property of parallelograms, such as opposite sides of equal length, is also true of every rectangle, rhombus and square.",
        ],
        illustration: "quadrilateral-tree",
      },
      {
        stage: "method",
        title: "Testing a statement",
        paragraphs: [
          "First compare the features the starting shape must have with the features being claimed. Every square has four right angles, so every square meets the rectangle definition.",
          "To disprove a statement, find a counterexample: one shape that fits its starting description but fails its claim. A rectangle 2 cm wide and 5 cm long is not a square, so the claim that every rectangle is a square is false. Failing to imagine a counterexample does not prove a statement true; use the definitions.",
          "When several statements may be true, test each separately. Keep every statement supported by the definitions, and check that the number selected matches the question.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Every special case belongs above it",
        paragraphs: [
          "A quadrilateral is a polygon (a closed flat shape with straight sides) with four sides. A parallelogram is a quadrilateral with two pairs of parallel opposite sides. A rectangle is a quadrilateral with four right angles. A rhombus is a quadrilateral with four equal sides. A square has both four equal sides and four right angles.",
          "These definitions include special cases: squares are rectangles and rhombuses; rectangles and rhombuses are parallelograms. A subcategory is a group inside a larger category, so every property of the larger category holds throughout the subcategory. The reverse inclusion need not hold.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which names fit a rhombus with no right angles?",
      steps: [
        "It has 4 equal sides: a rhombus.",
        "Opposite sides of a rhombus are parallel: a parallelogram.",
        "No right angles: not a rectangle and not a square. Every parallelogram is a quadrilateral.",
      ],
      answer: "rhombus, parallelogram, quadrilateral",
    },
    pitfalls: [
      "A square is not only a square: it is a rectangle, a rhombus, a parallelogram and a quadrilateral too.",
      "Inclusion runs one way: every square is a rectangle, but not every rectangle is a square.",
      "For a question with several true statements, check all choices before submitting the requested number.",
    ],
    parentGuide:
      "Play 'always, sometimes, never': is a rectangle always a parallelogram? Sometimes a square? Never a triangle? Ask for a drawing to prove each answer.",
  },
];

const terms = {
  polygon: [
    ["polygon", "A closed flat shape with straight sides."],
    ["angle", "Where two sides of a polygon meet."],
  ],
  solid: [
    ["face", "A flat surface of a solid."],
    ["edge", "Where two faces meet."],
    ["vertex", "A corner where edges meet. Plural: vertices."],
  ],
  quad: [
    ["right angle", "A square corner, marked with a small square."],
    ["tick marks", "Sides with the same number of ticks are equal."],
  ],
  tree: [
    ["parallelogram", "A quadrilateral with 2 pairs of parallel sides."],
    [
      "subcategory",
      "A category inside a larger one, like squares inside rectangles.",
    ],
  ],
} satisfies Record<string, [string, string][]>;
export const polygonMethods: Record<string, ProblemMethod> = {
  "name-polygon": {
    goal: "Given a polygon, name it by its number of sides.",
    terms: terms.polygon,
    method: [
      "Start at one corner and count the sides once around.",
      "Match the count: 3 triangle, 4 quadrilateral, 5 pentagon, 6 hexagon, 8 octagon.",
    ],
    watch: "Unequal sides and inward corners do not change the name.",
  },
  "polygon-with-angles": {
    goal: "Given a number of angles, choose the polygon that has exactly that many.",
    terms: terms.polygon,
    method: [
      "Count each shape's angles once around, starting from one corner.",
      "Choose the shape whose count matches exactly.",
    ],
    watch: "Count an inward-pointing corner as an angle too.",
  },
  "solid-parts": {
    goal: "Given a prism or pyramid, count its faces, edges or vertices.",
    terms: terms.solid,
    method: [
      "Find the base shape and how many sides it has.",
      "Prism: count both ends, then the parts joining them. Pyramid: count the base, then the parts rising to the point.",
      "Add, including the hidden parts shown dashed.",
    ],
    watch: "Dashed lines are hidden edges; they still count.",
  },
  "classify-quadrilateral": {
    goal: "Given a marked quadrilateral, choose its most exact name.",
    terms: terms.quad,
    method: [
      "4 right-angle marks? It is a rectangle.",
      "All 4 sides marked equal? It is a rhombus.",
      "Both: a square. Neither: just a quadrilateral.",
    ],
    watch: "A square is a rectangle too, but square is the more exact name.",
  },
  "find-quadrilateral": {
    goal: "Given a category, choose the quadrilateral that belongs to it, or the one in none.",
    terms: terms.quad,
    method: [
      "Say what the category needs: right angles, equal sides or both.",
      "Check each shape's marks against that.",
      "Choose the one that fits.",
    ],
    watch: "A slanted shape with 4 equal sides is a rhombus, not a square.",
  },
  "quadrilateral-names": {
    goal: "Given a marked quadrilateral, choose the list of every name that fits.",
    terms: terms.tree,
    method: [
      "2 pairs of parallel sides: it is a parallelogram.",
      "4 right angles adds rectangle; 4 equal sides adds rhombus; both adds square.",
      "Every one is a quadrilateral.",
    ],
    watch: "List every name, not only the most exact one.",
  },
  "hierarchy-statement": {
    goal: "Given statements about categories, choose the one that is always true.",
    terms: terms.tree,
    method: [
      "For each statement 'every $X$ is a Y', try to picture an $X$ that is not a $Y$.",
      "If you can, the statement is false.",
      "The statement with no such picture is true.",
    ],
    watch:
      "Inclusion runs one way: every square is a rectangle, not the reverse.",
  },
  "inherited-property": {
    goal: "Given a property of a category, choose the shape that must have it.",
    terms: terms.tree,
    method: [
      "Find the choice that is always in the category.",
      "A subcategory has every property of its category.",
    ],
    watch:
      "A shape that only sometimes belongs to the category need not have the property.",
  },
  "quadrilateral-hierarchy-multiselect": {
    goal: "Given statements about quadrilaterals, choose all 3 that are always true.",
    intuition:
      "A quadrilateral is a closed flat shape with four straight sides. A rectangle has four right angles, or square corners; a rhombus has four equal sides. A square has both, so it belongs to both groups. A parallelogram has two pairs of parallel opposite sides: the lines containing them never meet. A shape keeps every name whose description it meets.",
    terms: [
      ["quadrilateral", "A closed flat shape with four straight sides."],
      ["right angle", "A square corner, measuring $90^\\circ$ (90 degrees)."],
      ["opposite sides", "Sides that do not share a corner."],
      [
        "parallel sides",
        "Sides on lines that never meet and stay the same distance apart.",
      ],
      [
        "parallelogram",
        "A quadrilateral with two pairs of parallel opposite sides.",
      ],
      ["rectangle", "A quadrilateral with four right angles."],
      ["rhombus", "A quadrilateral with four equal sides."],
      [
        "square",
        "A quadrilateral with four equal sides and four right angles.",
      ],
      [
        "counterexample",
        "One example that fits the starting description but makes the claim false.",
      ],
    ],
    method: [
      "For each statement, compare the properties required by its starting description with the properties it claims.",
      "Keep a statement when the definitions guarantee its claim. Reject it if one counterexample fits the starting description but fails the claim.",
      "Check every statement separately, then select all 3 true statements.",
    ],
    watch:
      "Check the direction: every square is a rectangle, but a rectangle with unequal neighboring sides is not a square.",
  },
};
export const polygonPrinciples: Record<string, string> = {
  "name-polygon": "A polygon is named by how many sides it has.",
  "polygon-with-angles": "A polygon has as many angles as sides.",
  "solid-parts":
    "A prism has 2 matching ends joined by flat sides; a pyramid has 1 base and triangles that meet at a point.",
  "classify-quadrilateral":
    "Right angles make a rectangle, equal sides make a rhombus, and both make a square.",
  "find-quadrilateral":
    "A quadrilateral belongs to a category when it has that category's defining marks.",
  "quadrilateral-names":
    "A shape belongs to every category above it in the quadrilateral tree.",
  "hierarchy-statement":
    "Every $X$ is a $Y$ when each defining property of $Y$ is also a property of every $X$.",
  "inherited-property":
    "A subcategory has every property of the category that contains it.",
  "quadrilateral-hierarchy-multiselect":
    "An always-true claim follows from the defining properties of every shape it describes; one counterexample makes it false. Quadrilaterals have four sides, parallelograms have two pairs of parallel opposite sides, rectangles have four right angles, rhombuses have four equal sides, and squares have both. These categories include their special cases.",
};
