import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const polygonLessons: Lesson[] = [
  {
    id: "polygons-and-solids",
    title: "Polygons, faces, edges and vertices",
    summary:
      "A side is one straight part of a flat shape's outline. A polygon is a closed flat shape with straight sides. Closed means its outline has no gaps. A solid shape is a shape that takes up space, like a box. A face is one flat surface of a solid. An edge is where two faces meet. A vertex is a corner, where edges meet.",
    noLink: ["part"],
    templateIds: ["name-polygon", "polygon-with-angles", "solid-parts"],
    senses: {
      side: "side",
      face: "face-solid",
      edge: "edge",
      vertex: "vertex",
      solid: "solid-shape",
      base: "base-shape",
      square: "square-shape",
    },
    includeGeneratedRepresentation: false,
    objectives: [
      "Name triangles, quadrilaterals, pentagons, hexagons and octagons, even with uneven sides.",
      "Count the faces, edges and vertices of prisms and pyramids, hidden ones included.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Flat outline or solid object",
        paragraphs: [
          "A triangle is a polygon with 3 sides. Draw one on paper. It is flat, so you can only trace around it.",
          "A box is different. You can hold it and turn it. Its faces meet along edges, and its edges meet at vertices.",
          "A prism is a solid with two matching flat ends joined by flat faces. A box is a prism. A triangular prism has triangle ends, like a tent.",
        ],
      },
      {
        title: "Polygons",
        paragraphs: [
          "Look at the picture. Count each shape's sides to find its name.",
          "A quadrilateral has 4 sides. A pentagon has 5 sides. A hexagon has 6 sides. An octagon has 8 sides, like a stop sign.",
          "An angle is the opening at a corner, between two sides. Each corner has one angle. So a polygon has as many angles as sides.",
          "The sides do not have to be equally long. A corner can even dent inward. The number of sides still gives the name.",
        ],
        illustration: "polygon-names",
      },
      {
        title: "Faces, edges and vertices",
        paragraphs: [
          "Look at the picture of a box. It has 6 faces, 12 edges and 8 vertices.",
          "A drawing cannot show every part of a solid at once. Dashed marks show the edges hidden at the back. Count those too.",
          "A pyramid is a solid with triangle faces that meet at a tip. Its base is the face the triangles stand on.",
        ],
        illustration: "solid-parts",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Flat and solid figures",
        paragraphs: [
          "A polygon is a closed flat shape made of straight sides. Each pair of sides that meet makes one vertex, or corner.",
          "A prism or a pyramid is a solid made of flat polygon faces. Its faces meet along edges. Its edges meet at vertices. A drawing of a solid is a picture of it, not the solid itself.",
        ],
      },
    ],
    workedExample: {
      prompt: "How many edges does a triangular prism have?",
      steps: [
        "Each triangle end has 3 edges, one along each side: $3 + 3 = 6$.",
        "Each corner of one end is joined to the matching corner of the other end. That makes 3 more edges.",
        "Add them: $6 + 3 = 9$ edges.",
      ],
      answer: "9",
      answerUnit: "edges",
    },
    pitfalls: [
      "Count the hidden faces and edges too. The dashed marks show them.",
      "A polygon with 6 sides is still a hexagon, even if its sides are not equally long.",
    ],
    parentGuide:
      "Hold a cereal box. Touch each face to count the faces. Run a finger along each edge to count the edges. Ask which ones you could not see at first.",
  },
  {
    id: "quadrilaterals",
    title: "Squares, rectangles and rhombuses",
    summary:
      "A quadrilateral is a flat shape with 4 straight sides. Some quadrilaterals have special names. You tell them apart by their corners and by the lengths of their sides.",
    noLink: ["change"],
    templateIds: ["classify-quadrilateral", "find-quadrilateral"],
    senses: { side: "side", square: "square-shape" },
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
          "A right angle is a square corner, like the corner of a page. Some quadrilaterals have 4 right angles. Some have 4 sides of equal length. A square has both.",
          "A rectangle has 4 right angles. A rhombus is a quadrilateral with 4 equal sides.",
          "Turning a shape does not change it. So read the marks on the shape, not the way it is tilted.",
        ],
      },
      {
        title: "Reading the marks",
        paragraphs: [
          "Look at the picture. A small square drawn in a corner marks a right angle. Tick marks are small dashes across sides. Sides with the same number of tick marks are the same length.",
          "A square has 4 right angles and 4 equal sides, so it is a rectangle and a rhombus at once. The last shape in the picture is none of these. It is still a quadrilateral.",
        ],
        illustration: "quadrilateral-marks",
      },
      {
        title: "The most exact name",
        paragraphs: [
          "Check the right angles first, then the sides. 4 right angles and 4 equal sides: square. Only the 4 right angles: rectangle. Only the 4 equal sides: rhombus.",
          "In these problems, every right angle and every pair of equal sides is marked. A quadrilateral with neither set of marks is none of the three. It is still a quadrilateral.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Properties of four-sided figures",
        paragraphs: [
          "A quadrilateral is a polygon, a closed flat shape with straight sides, that has 4 sides. A rectangle has 4 right angles. A rhombus has 4 sides of equal length. A square fits both descriptions, however it is turned.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A quadrilateral has all 4 sides marked equal and has no right angles. What is its most exact name?",
      steps: [
        "All 4 sides are marked equal. A quadrilateral with 4 equal sides is a rhombus.",
        "It has no right angles. A rectangle needs 4 right angles, so it is not a rectangle. A square needs them too, so it is not a square.",
        "The most exact name is rhombus.",
      ],
      answer: "rhombus",
    },
    pitfalls: [
      "A square is also a rectangle and a rhombus. When asked for the most exact name, say square.",
      "A tilted shape keeps its name. Read the marks, not the direction.",
    ],
    parentGuide:
      "Use the corner of a sheet of paper as a right-angle checker: a right angle fits it exactly. Hunt for rectangles and squares at home and test their corners.",
  },
  {
    id: "quadrilateral-hierarchy",
    title: "The quadrilateral family tree",
    summary:
      "A quadrilateral is a closed flat shape with 4 straight sides. Some quadrilaterals have special names, such as square. Each name stands for a set of features. One shape can have several names at once.",
    templateIds: [
      "quadrilateral-names",
      "hierarchy-statement",
      "inherited-property",
      "quadrilateral-hierarchy-multiselect",
    ],
    senses: { side: "side", square: "square-shape" },
    noLink: ["opposite", "more than"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name every category a quadrilateral belongs to.",
      "Use the fact that a subcategory has every property of its category.",
      "Check every statement when several answers may be true.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A square can have several names",
        paragraphs: [
          "A right angle is a square corner, like the corner of a page. Two sides are opposite when they do not share a corner, like the top and bottom of a picture frame. Parallel sides are sides that run in the same direction and never meet.",
          "A parallelogram is a quadrilateral with two pairs of parallel opposite sides. A rectangle is a quadrilateral with 4 right angles. A rhombus is a quadrilateral with 4 equal sides.",
          "A square has 4 right angles and 4 equal sides. So it is a rectangle and a rhombus at once. Rectangles, rhombuses and squares are all parallelograms too.",
        ],
      },
      {
        stage: "method",
        title: "Categories inside categories",
        paragraphs: [
          "A category is a group of shapes that fit one description. Look at the family tree in the picture. Quadrilateral is at the top. Parallelogram is below it. Rectangle and rhombus are below that, and square is at the bottom.",
          "Each shape belongs to every category above it. A subcategory is a smaller group inside a bigger group. So every property of parallelograms is true of every rectangle, rhombus and square. For example, the opposite sides of every parallelogram are equally long, so the same is true of every square.",
        ],
        illustration: "quadrilateral-tree",
      },
      {
        stage: "method",
        title: "Testing a statement",
        paragraphs: [
          "Compare the features the starting shape must have with the features being claimed. Every square has 4 right angles. So every square fits the description of a rectangle.",
          "A counterexample is one shape that fits the start of a statement but not its claim. To show a statement is false, find a counterexample. A rectangle 2 cm wide and 5 cm long is not a square. So “every rectangle is a square” is false.",
          "Not finding a counterexample does not show that a statement is true. Use the definitions to be sure.",
          "When several statements may be true, test each one on its own. Then check that you chose as many as the question asks for.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Every special case belongs above it",
        paragraphs: [
          "A quadrilateral is a polygon, a closed flat shape with straight sides, that has 4 sides. A parallelogram is a quadrilateral with two pairs of parallel opposite sides. A rectangle is a quadrilateral with 4 right angles. A rhombus is a quadrilateral with 4 equal sides. A square has 4 equal sides and 4 right angles.",
          "These definitions include special cases. Squares are rectangles and rhombuses. Rectangles and rhombuses are parallelograms. Every property of a bigger category holds for every shape in its subcategories. The reverse need not hold: not every rectangle is a square.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which names fit a rhombus with no right angles?",
      steps: [
        "It has 4 equal sides, so the name rhombus fits.",
        "Every rhombus is a parallelogram: its opposite sides are parallel. So the name parallelogram fits too.",
        "It has no right angles, so it is not a rectangle and not a square. Every parallelogram has 4 sides, so it is also a quadrilateral.",
      ],
      answer: "rhombus, parallelogram, quadrilateral",
    },
    pitfalls: [
      "A square has more than one name. It is a rectangle, a rhombus, a parallelogram and a quadrilateral too.",
      "The names fit one way only. Every square is a rectangle, but not every rectangle is a square.",
      "When several statements may be true, check every choice before you submit.",
    ],
    parentGuide:
      "Play “always, sometimes, never”. Is a rectangle always a parallelogram? Is it sometimes a square? Is it ever a triangle? A drawing can show “sometimes”. For “always” and “never”, ask your learner to explain with the definitions.",
  },
];

const terms = {
  polygon: ["polygon", "angle"],
  solid: ["face-solid", "edge", "vertex"],
  quad: [
    "right-angle",
    [
      "tick-mark",
      "Sides with the same number of tick marks are equal in length.",
    ],
  ],
  tree: ["parallelogram", "subcategory"],
} satisfies Record<string, MethodTerm[]>;
const quadOpening =
  "A quadrilateral is a flat shape with 4 straight sides. A right angle is a square corner, often marked with a small square. Tick marks are small dashes across sides: sides with the same number of ticks are equal. A rectangle has 4 right angles. A rhombus is a quadrilateral with 4 equal sides. A square has both.";
const treeOpening =
  "A quadrilateral is a flat shape with 4 straight sides. Opposite sides are sides that do not share a corner. Parallel sides are sides that run in the same direction and never meet. A parallelogram is a quadrilateral with two pairs of parallel opposite sides. A right angle is a square corner. A rectangle is a parallelogram with 4 right angles. A rhombus is a parallelogram with 4 equal sides. A square has both.";
const treeSenses = { side: "side", square: "square-shape" };
export const polygonMethods: Record<string, ProblemMethod> = {
  "name-polygon": {
    goal: "Name a polygon by counting its sides.",
    intuition:
      "A polygon is a closed flat shape with straight sides. A side is one straight part of its outline. A corner is where two sides meet. A polygon is named by how many sides it has. A triangle is a polygon with 3 sides. A quadrilateral is a polygon with 4 sides.",
    senses: { side: "side" },
    noLink: ["change", "part"],
    terms: terms.polygon,
    method: [
      "Start at one corner. Count the sides once around.",
      "Match the count. 3 sides is a triangle, 4 a quadrilateral, 5 a pentagon, 6 a hexagon and 8 an octagon.",
    ],
    watch:
      "Sides of different lengths and dented-in corners do not change the name.",
  },
  "polygon-with-angles": {
    goal: "Choose the polygon with exactly the given number of angles.",
    intuition:
      "A polygon is a closed flat shape with straight sides. A corner is where two sides meet. An angle is the opening at a corner, between its two sides. Each corner has one angle, so a polygon has as many angles as sides.",
    senses: { side: "side" },
    terms: terms.polygon,
    method: [
      "Start at one corner. Count each shape's angles once around.",
      "Choose the shape whose count matches exactly.",
    ],
    watch: "A corner that dents inward has an angle too. Count it.",
  },
  "solid-parts": {
    goal: "Count the faces, edges or vertices of a prism or a pyramid.",
    intuition:
      "A solid shape is a shape that takes up space, like a box. A face is one flat surface of a solid. An edge is where two faces meet. A vertex is a corner, where edges meet. A side is one straight part of a flat shape's outline. A triangle is a flat shape with 3 sides. A prism has two matching ends joined by flat faces. A pyramid has triangle faces that meet at a tip. A pyramid's base is the face its triangles stand on.",
    senses: {
      base: "base-shape",
      cube: "cube",
      square: "square-shape",
      side: "side",
      solid: "solid-shape",
    },
    noLink: ["parts", "part"],
    terms: terms.solid,
    method: [
      "Find the base and count its sides.",
      "Prism: count both ends, then the faces or edges joining them. Pyramid: count the base, then the faces or edges rising to the tip.",
      "Add them up, including the hidden ones drawn with dashes.",
    ],
    watch: "Dashed lines show hidden edges. They still count.",
  },
  "classify-quadrilateral": {
    goal: "Choose the most exact name for a marked quadrilateral.",
    intuition: quadOpening,
    terms: terms.quad,
    method: [
      "Are all 4 corners marked as right angles? Then it is a rectangle.",
      "Are all 4 sides marked equal? Then it is a rhombus.",
      "Both: a square. Neither: just a quadrilateral.",
    ],
    watch: "A square is a rectangle too, but square is the more exact name.",
  },
  "find-quadrilateral": {
    goal: "Choose the quadrilateral that belongs to a named group, or the one that belongs to none.",
    intuition: quadOpening,
    terms: terms.quad,
    method: [
      "Say what the group needs: 4 right angles, 4 equal sides or both.",
      "Check each shape's marks against that.",
      "Choose the one that fits.",
    ],
    watch:
      "A tilted shape keeps its name. A shape with 4 equal sides and no right angles is a rhombus, not a square.",
  },
  "quadrilateral-names": {
    goal: "Choose the list of every name that fits a marked quadrilateral.",
    intuition: `${treeOpening} One shape can have several names.`,
    senses: treeSenses,
    noLink: ["opposite"],
    terms: terms.tree,
    method: [
      "Two pairs of parallel sides: it is a parallelogram.",
      "4 right angles adds rectangle. 4 equal sides adds rhombus. Both add square.",
      "Every one of them is also a quadrilateral.",
    ],
    watch: "List every name that fits, not only the most exact one.",
  },
  "hierarchy-statement": {
    goal: "Choose the statement about groups of quadrilaterals that is always true.",
    intuition: `${treeOpening} A statement like “every square is a rectangle” is true when the definitions guarantee it.`,
    senses: treeSenses,
    noLink: ["opposite"],
    terms: terms.tree,
    method: [
      "For a statement like “every square is a rectangle”, list what the second shape must have.",
      "Check that the first shape always has all of it, by its definition.",
      "If one example of the first shape lacks it, the statement is false. That example is called a counterexample.",
    ],
    watch:
      "The names fit one way only. Every square is a rectangle, but not every rectangle is a square.",
  },
  "inherited-property": {
    goal: "Choose the shape that must have a property of a bigger group.",
    intuition: `${treeOpening} A subcategory is a smaller group inside a bigger group. It has every property of the bigger group.`,
    senses: treeSenses,
    terms: terms.tree,
    method: [
      "Find the choice that always belongs to the group named.",
      "That choice has every property of the group.",
    ],
    watch:
      "A shape that only sometimes belongs to the group does not have to have the property.",
  },
  "quadrilateral-hierarchy-multiselect": {
    goal: "Choose all 3 statements about quadrilaterals that are always true.",
    intuition:
      "A quadrilateral is a closed flat shape with 4 straight sides. A right angle is a square corner. A rectangle is a quadrilateral with 4 right angles. A rhombus is a quadrilateral with 4 equal sides. A square has both, so it belongs to both groups. Opposite sides are sides that do not share a corner. Parallel sides are sides that run in the same direction and never meet. A parallelogram is a quadrilateral whose opposite sides are parallel. A shape keeps every name whose description it fits.",
    senses: treeSenses,
    noLink: ["opposite", "part"],
    terms: [
      "quadrilateral",
      "right-angle",
      [
        "side",
        "Opposite sides of a polygon do not share a corner, like the top and bottom of a rectangle.",
      ],
      "parallel",
      "parallelogram",
      "rectangle",
      "rhombus",
      "square-shape",
      "counterexample",
    ],
    method: [
      "For each statement, compare what its starting shape must have with what it claims.",
      "Keep a statement when the definitions guarantee its claim. A counterexample is a shape that fits the start of a statement but not its claim. One counterexample makes the statement false.",
      "Check every statement on its own, then select all 3 true statements.",
    ],
    watch:
      "Check the direction. Every square is a rectangle, but a rectangle with a long side and a short side is not a square.",
  },
};
export const polygonPrinciples: Record<string, string> = {
  "name-polygon": "A polygon is named by how many sides it has.",
  "polygon-with-angles": "A polygon has as many angles as sides.",
  "solid-parts":
    "A prism has 2 matching ends joined by flat faces. A pyramid has 1 base and triangle faces that meet at a tip.",
  "classify-quadrilateral":
    "A quadrilateral with 4 right angles is a rectangle. One with 4 equal sides is a rhombus. One with both is a square.",
  "find-quadrilateral":
    "A quadrilateral belongs to a group when it has all of that group's marks.",
  "quadrilateral-names":
    "A shape belongs to every group above it in the quadrilateral family tree.",
  "hierarchy-statement":
    "A statement “every $X$ is a $Y$”, where $X$ and $Y$ stand for shape names, is true when every $X$ has each defining property of $Y$.",
  "inherited-property":
    "A subcategory has every property of the group that contains it.",
  "quadrilateral-hierarchy-multiselect":
    "A claim is always true when it follows from the definitions of every shape it describes. One counterexample makes it false. A quadrilateral has 4 sides. A parallelogram has two pairs of parallel opposite sides. A rectangle has 4 right angles. A rhombus has 4 equal sides. A square has both. Each group includes its special cases.",
};
