import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const solidPropertyMethods: Record<string, ProblemMethod> = {
  "solid-property-select": {
    goal: "Select the prisms and pyramids that have a stated property by checking each solid's faces, edges and bases.",
    intuition:
      "A solid has flat faces that meet along edges, and edges meet at corners called vertices. A prism has two bases that are the same size and shape and parallel to each other, joined by rectangular sides. A pyramid has one base, and its other faces are triangles that meet at one point.",
    terms: ["face-solid", "edge", "base-shape", "congruent"],
    method: [
      "Say what the property needs: a count of faces or edges, or a kind of face.",
      "Check each solid in turn: for a count, count the faces or edges; for bases, say how many bases it has and what shapes its other faces are.",
      "Select exactly the solids that meet the property, and check that you have selected the stated number.",
    ],
    watch:
      "Check every solid. A solid with the right kind of bases can still have the wrong number of faces or edges.",
  },
};

export const solidPropertyPrinciples: Record<string, string> = {
  "solid-property-select":
    "A prism has two congruent parallel bases and rectangular side faces. A pyramid has one base and triangular side faces that meet at one vertex. An $n$-sided prism has $n+2$ faces, $3n$ edges and $2n$ vertices; an $n$-sided pyramid has $n+1$ faces, $2n$ edges and $n+1$ vertices.",
};

export const solidPropertyLessons = [
  chainLesson({
    id: "solid-property-select-lesson",
    title: "Faces, edges and bases of prisms and pyramids",
    summary:
      "Choose the solids with a stated property by checking bases, faces and edges.",
    templateIds: ["solid-property-select"],
    objectives: [
      "Tell a prism from a pyramid by their bases and side faces.",
      "Count the faces and edges of a prism or a pyramid from its base.",
    ],
    openingTitle: "Bases and side faces",
    opening: [
      "A solid is a shape with faces that are flat surfaces. A prism has two bases of the same size and shape that are parallel, joined by rectangles. A pyramid has one base, and its side faces are triangles that meet at one point.",
      "The base tells you the counts. A triangular prism has 2 triangle bases and 3 rectangles, so 5 faces. A square pyramid has 1 square base and 4 triangles, so 5 faces.",
    ],
    example: {
      prompt:
        "Does a pentagonal pyramid have two congruent parallel faces, and how many faces does it have?",
      steps: [
        "A pyramid has one base, so it does not have two parallel bases.",
        "The base is a pentagon with 5 sides, so there are 5 triangular side faces.",
        "The faces are 1 base and 5 triangles: 6 faces. It has no two congruent parallel faces.",
      ],
      answer: "No; it has 6 faces",
    },
    methodTitle: "Check each solid against the property",
    method: [
      "A prism: 2 congruent parallel bases, so a base with $n$ sides gives $n+2$ faces and $3n$ edges. A pyramid: 1 base, so $n+1$ faces and $2n$ edges.",
      "Check each solid in turn and select exactly the number the question asks for.",
    ],
    formalTitle: "Prisms and pyramids",
    formal: [
      "A prism has two congruent, parallel bases and parallelogram side faces. A pyramid has one base and triangular side faces that meet at a vertex.",
      "For an $n$-sided base, a prism has $n+2$ faces, $3n$ edges and $2n$ vertices; a pyramid has $n+1$ faces, $2n$ edges and $n+1$ vertices.",
    ],
    pitfalls: [
      "Choosing a pyramid for two parallel faces: a pyramid has only one base.",
      "Counting only the side faces and leaving out the base or bases.",
      "Choosing more or fewer solids than the question asks for.",
    ],
    parentGuide:
      "Use a box and a tent: ask your learner how many flat faces each has and which faces are the same size.",
  }),
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
