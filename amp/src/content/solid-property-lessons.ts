import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const solidPropertyMethods: Record<string, ProblemMethod> = {
  "solid-property-select": {
    goal: "Select the prisms and pyramids with a stated property by checking their faces, edges and bases.",
    intuition:
      "A solid shape is a shape that takes up space, like a box. A face is one flat surface of a solid. An edge is where two faces meet. A corner is a point where edges meet. It is called a vertex. Congruent means exactly the same size and shape. Parallel means running the same way and never meeting, like a floor and a ceiling. Sides are the straight parts of a flat shape's outline. A prism is a solid with two congruent, parallel ends, called bases. A triangle is a flat shape with 3 sides. A pyramid is a solid with one base and triangle faces that meet at one top corner.",
    senses: {
      solid: "solid-shape",
      face: "face-solid",
      edge: "edge",
      base: "base-shape",
      vertex: "vertex",
      side: "side",
      square: "square-shape",
    },
    terms: [
      "face-solid",
      "edge",
      [
        "base-shape",
        "In a prism, the bases are the two matching ends. In a pyramid, the base is the face across from the top corner.",
      ],
      "congruent",
    ],
    method: [
      "Read what the property needs: a number of faces or edges, or a kind of face.",
      "Check each solid. Count its faces or edges from its base. A prism has 2 more faces than its base has sides, and a pyramid has 1 more.",
      "Select exactly the solids that have the property. Check that you chose the number asked for.",
    ],
    watch:
      "Check every solid. A solid with the right kind of bases can still have the wrong number of faces or edges.",
  },
};

export const solidPropertyPrinciples: Record<string, string> = {
  "solid-property-select":
    "A prism has two congruent, parallel bases joined by side faces, one for each side of a base. A pyramid has one base and triangle faces that meet at one vertex. If the base has $n$ sides, a prism has $n + 2$ faces, $3n$ edges and $2n$ vertices. A pyramid has $n + 1$ faces, $2n$ edges and $n + 1$ vertices. Here $3n$ means 3 times $n$.",
};

export const solidPropertyLessons = [
  {
    ...chainLesson({
      id: "solid-property-select-lesson",
      title: "Faces, edges and bases of prisms and pyramids",
      summary:
        "A solid shape is a shape that takes up space, like a box or a tent. A face is one flat surface of a solid. An edge is where two faces meet, like the fold on a box. You can check a solid by counting its faces and edges.",
      templateIds: ["solid-property-select"],
      objectives: [
        "Tell a prism from a pyramid by their bases and side faces.",
        "Count the faces and edges of a prism or a pyramid from its base.",
      ],
      openingTitle: "Bases and side faces",
      opening: [
        "Congruent means exactly the same size and shape. Parallel means running the same way and never meeting, like a floor and a ceiling. A side is one straight part of a flat shape's outline. A corner is where two sides meet.",
        "A prism is a solid with two congruent, parallel ends, called bases. Think of the two ends of a box. Flat side faces join the two bases, one for each side of a base.",
        "A triangle is a flat shape with 3 sides. A pyramid is a solid with just one base. Its other faces are triangles. The triangles all meet at one top corner. A corner of a solid is called a vertex.",
        "The base tells you the counts. A triangular prism has 2 triangle bases and 3 side faces, so it has 2 + 3 = 5 faces. A square is a flat shape with 4 equally long sides and 4 square corners. A square pyramid has 1 square base and 4 triangles, so it has 1 + 4 = 5 faces.",
      ],
      example: {
        prompt:
          "A pentagon is a flat shape with 5 sides. Does a pentagonal pyramid have two congruent parallel faces? How many faces does it have?",
        steps: [
          "A pyramid has only one base. Its triangles all lean in to meet at the top corner. So no two faces are parallel, and the answer to the first part is no.",
          "The base is a pentagon, with 5 sides. One triangle stands on each side of the base, so there are 5 triangle faces.",
          "Add the base: 1 + 5 = 6 faces.",
        ],
        answer: "No; it has 6 faces",
      },
      methodTitle: "Check each solid against the property",
      method: [
        "Faces: a prism has 2 bases plus one side face for each side of a base. A triangular prism has 2 + 3 = 5 faces. A pyramid has 1 base plus one triangle for each side of the base. A square pyramid has 1 + 4 = 5 faces.",
        "Edges: a prism has one edge along each side of each base. It also has one edge joining each pair of matching corners. A triangular prism has 3 + 3 + 3 = 9 edges. A pyramid has one edge along each side of the base. It also has one edge from each base corner up to the tip. A square pyramid has 4 + 4 = 8 edges.",
        "Check each solid in turn. Select exactly as many solids as the question asks for.",
      ],
      formalTitle: "Prisms and pyramids",
      formal: [
        "A prism has two congruent, parallel bases. A parallelogram is a four-sided shape whose opposite sides are parallel. A prism's side faces are parallelograms. A rectangle is a four-sided shape with 4 square corners. In a prism like a box, the side faces are rectangles. A pyramid has one base. Its side faces are triangles that meet at one vertex.",
        "Let $n$ stand for the number of sides of the base. A prism has $n + 2$ faces, $3n$ edges and $2n$ vertices. Here $3n$ means 3 times $n$. A pyramid has $n + 1$ faces, $2n$ edges and $n + 1$ vertices.",
      ],
      pitfalls: [
        "A pyramid never has two parallel faces. It has only one base.",
        "Count every face. Include the base, or both bases for a prism.",
        "Select exactly as many solids as the question asks for.",
      ],
      parentGuide:
        "Use a cereal box and a toy pyramid. Ask your learner how many flat faces each has. Then ask which faces match in size and face each other.",
    }),
    senses: {
      solid: "solid-shape",
      face: "face-solid",
      edge: "edge",
      base: "base-shape",
      vertex: "vertex",
      side: "side",
      square: "square-shape",
    },
    noLink: ["opposite"],
  },
];

export const solidPropertyFacetMappings: FacetMapping[] = [
  {
    templateId: "solid-property-select",
    facetId: "polygon-properties.solid-parts",
    extent: "partial",
    rationale:
      "Select exactly three of six named prisms and pyramids with three to six sides on the base that have a stated property: two congruent parallel faces, triangular side faces, 12 or more edges or fewer than 6 faces. The solids are named, not drawn. Does not assess drawn solids, curved solids, net or cross-section reasoning, or vertex counts.",
  },
];
