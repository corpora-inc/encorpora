import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const senses = {
  cube: "cube",
  cubes: "cube",
  solid: "solid-shape",
  volume: "volume",
  unit: "unit",
};

export const namedUnitCubeChoiceLessons: Lesson[] = [
  {
    id: "named-unit-cube-choice",
    title: "Volume in a named unit",
    summary:
      "A unit cube can be 1 centimeter, 1 inch, or 1 foot on each edge, or one object such as a block. The volume is how many of those cubes fill the solid. Square units and lengths are different measures.",
    templateIds: ["named-unit-cube-choice"],
    senses,
    objectives: [
      "Name a volume in cubic centimeters, cubic inches, cubic feet, or the object used as the unit.",
      "Reject a square unit, a length, and a count of only the cubes you can see.",
    ],
    includeGeneratedRepresentation: false,
    sections: [
      {
        stage: "intuition",
        title: "The unit is one cube",
        paragraphs: [
          "Volume is how many equal cubes fill a solid, with no gaps and no overlaps. If each cube is 1 inch on every edge, the volume is a number of cubic inches.",
          "A shipping crate packed with 1-foot cubes is measured in cubic feet. A shoebox packed with blocks is measured in blocks. The count is the same kind of count. Only the unit name changes.",
        ],
      },
      {
        title: "Three counts that are not the volume",
        paragraphs: [
          "Square inches measure a flat cover, not a solid. Inches alone measure a length. Neither is a volume.",
          "A drawing shows the front, the top, and one side. Cubes in the middle are hidden. Counting only the cubes with a face you can see leaves those out.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "The unit travels with the count",
        paragraphs: [
          "If one layer holds $a$ cubes and there are $h$ layers, the volume is $a \\times h$ of those cubes. Write the unit the problem names after that count.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A prism is built from cubes with 1-inch edges. It is 3 cubes long, 3 cubes wide and 4 cubes high. Which describes its volume?",
      steps: [
        "One layer is 3 × 3 = 9 cubes. There are 4 layers: 9 × 4 = 36.",
        "Each cube is 1 cubic inch, so the volume is 36 cubic inches.",
        "36 square inches is an area. 36 inches is a length. The cubes you can see are fewer than 36, because some cubes are hidden.",
      ],
      answer: "36 cubic inches",
    },
    pitfalls: [
      "Do not write square units for a volume. Square units cover a flat face.",
      "Do not count only the faces you can see. Hidden cubes fill the solid too.",
    ],
    parentGuide:
      "Pack a small box with sugar cubes or blocks. Ask whether the volume is the number of blocks, the inches along one edge, or the squares on the outside.",
  },
];

export const namedUnitCubeChoiceMethods: Record<string, ProblemMethod> = {
  "named-unit-cube-choice": {
    goal: "Choose the volume of a cube-built solid in the unit the problem names.",
    intuition:
      "Volume counts the equal cubes that fill a solid. The unit may be a cubic centimeter, a cubic inch, a cubic foot, or one object such as a block. A square unit and a length are not volumes, and hidden cubes still count.",
    senses,
    terms: ["unit-cube", "volume"],
    method: [
      "Count one layer, then multiply by the number of layers.",
      "Write that count with the unit the problem names.",
      "Set aside a square unit, a length, and a count of only the visible cubes.",
    ],
    watch:
      "The cubes you can see are not the whole solid. Use the named unit, not a square unit or a length.",
  },
};

export const namedUnitCubeChoicePrinciples: Record<string, string> = {
  "named-unit-cube-choice":
    "Volume is a count of equal cubes. The unit is the cube the problem names, not a square unit or a length, and hidden cubes count.",
};

export const namedUnitCubeChoiceFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "named-unit-cube-choice",
    facetId: "volume-cubes.cube-prism-volume",
    extent: "partial",
    rationale:
      "Chooses a volume in cubic centimeters, cubic inches, cubic feet, or an improvised unit. Fractional edges and unit conversion are separate.",
  },
];
