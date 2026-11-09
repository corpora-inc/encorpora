import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const senses = {
  cube: "cube",
  cubes: "cube",
  layer: "volume",
  product: "product-multiply",
  volume: "volume",
  edge: "edge",
};

export const packEqualsProductLessons: Lesson[] = [
  {
    id: "pack-equals-product",
    title: "The layer count matches the edge product",
    summary:
      "A rectangular prism packed with unit cubes can be counted by layers or by multiplying its three edges. Any face can be the base. The count does not change.",
    templateIds: [
      "pack-equals-product-work",
      "pack-equals-product-select",
      "pack-equals-product-picture",
    ],
    senses,
    objectives: [
      "Show that the cubes in one layer times the number of layers equals the product of the three edges.",
      "Recognize every grouping of the three edges as the same volume.",
    ],
    includeGeneratedRepresentation: false,
    sections: [
      {
        stage: "intuition",
        title: "Two ways to count the same cubes",
        paragraphs: [
          "Picture a box that is 3 cubes long, 4 cubes wide and 5 cubes high. The bottom layer is 3 × 4 = 12 cubes. Five layers make 12 × 5 = 60 cubes.",
          "Multiplying the edges gives 3 × 4 × 5 = 60. Same cubes. Tip the box onto another face and the layers change, but the product does not.",
        ],
      },
      {
        title: "Any face can be the bottom",
        paragraphs: [
          "5 × (3 × 4) is 5 layers of 12. 3 × (4 × 5) is 3 layers of 20. (3 × 5) × 4 is 4 layers of 15. Each product is 60.",
          "Adding the edges, or multiplying only two of them, does not count every cube.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "The product is the count",
        paragraphs: [
          "For whole-number edges $\\ell$, $w$ and $h$, the volume in unit cubes is $\\ell \\times w \\times h$. Grouping does not change a product: $(\\ell \\times w) \\times h = \\ell \\times (w \\times h)$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A prism is 3 cubes long, 4 cubes wide and 5 cubes high. Show that the layers and the edges give the same volume.",
      steps: [
        "The bottom layer is 3 × 4 = 12 cubes. There are 5 layers: 12 × 5 = 60.",
        "The edges multiply to 3 × 4 × 5 = 60.",
        "Both results are 60, so the count and the product are equal.",
      ],
      answer: "60",
    },
    pitfalls: [
      "Do not add the three edges. Volume multiplies them.",
      "Two edges give only one layer. Multiply by the third edge as well.",
    ],
    parentGuide:
      "Build a 3 by 4 by 5 block from sugar cubes. Count one layer, then the layers. Then multiply 3 × 4 × 5 and compare. Turn the block on its side and count again.",
  },
];

export const packEqualsProductMethods: Record<string, ProblemMethod> = {
  "pack-equals-product-work": {
    goal: "Show that a layer count and the product of the three edges are the same volume.",
    intuition:
      "The bottom layer holds length times width cubes. The height is the number of those layers. Multiplying the three edges counts the same cubes.",
    senses,
    terms: ["unit-cube", "volume", "product-multiply"],
    method: [
      "Multiply length by width to get one layer.",
      "Multiply that layer by the height.",
      "Multiply the three edges and compare the two results.",
    ],
    watch: "The two results match. Do not add an edge instead of multiplying.",
  },
  "pack-equals-product-select": {
    goal: "Choose every product of the three edges that counts the cubes in the prism.",
    intuition:
      "Any order of the three edges is the same product. A sum, a product of only two edges, or a base with the height added is not the volume.",
    senses,
    terms: ["volume", "product-multiply"],
    method: [
      "Find the three edges on the prism.",
      "Keep each product that uses all three edges.",
      "Reject a sum, a product of two edges, and a base with the height added.",
    ],
    watch: "Parentheses change which face is the base. They do not change the product.",
  },
  "pack-equals-product-picture": {
    goal: "Choose the prism that shows the asked number of layers of the asked base.",
    intuition:
      "A layer is one flat level of cubes. The picture you want has that many cubes in a layer and that many layers. A different base or a different height is a different solid.",
    senses,
    terms: ["unit-cube", "volume"],
    method: [
      "Read how many cubes are in one layer, and how many layers.",
      "On each picture, multiply the two base edges and count the layers.",
      "Choose the picture where both numbers match.",
    ],
    watch: "A square base is not the one you want just because its area is close.",
  },
};

export const packEqualsProductPrinciples: Record<string, string> = {
  "pack-equals-product-work":
    "The cubes in one layer times the number of layers equals the product of the three edges.",
  "pack-equals-product-select":
    "Every grouping of the three edges counts the cubes. Adding edges, or using only two, does not.",
  "pack-equals-product-picture":
    "A prism of $\\ell$ by $w$ by $h$ unit cubes is $h$ layers of $\\ell \\times w$ cubes, and the other faces are the other groupings.",
};

export const packEqualsProductFacetMappings: readonly FacetMapping[] = [
  "pack-equals-product-work",
  "pack-equals-product-select",
  "pack-equals-product-picture",
].map((templateId) => ({
  templateId,
  facetId: "volume-cubes.cube-prism-volume",
  extent: "partial" as const,
  rationale:
    "Shows that packing by layers equals the product of three whole-number edges. Fractional edges and a given base area without the edges are separate.",
}));
