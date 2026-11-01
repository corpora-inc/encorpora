import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const similarSolidChainMethods: Record<string, ProblemMethod> = {
  "similar-solid-scale-chain": {
    goal: "From surface areas of similar prisms find the length scale, then the other volume, the total volume, or the other surface area.",
    intuition:
      "Two similar solids have the same shape and differ by a length scale: every length of one is the same multiple of the matching length of the other. Areas are made of two lengths, so they scale by the square of that multiple. Volumes are made of three lengths, so they scale by the cube.",
    terms: ["scale-factor", "similar-figures"],
    method: [
      "Write the ratio of the two given quantities and reduce it. A surface-area ratio is the square of the length ratio; a volume ratio is its cube.",
      "Take the square root (for areas) or cube root (for volumes) to get the length ratio.",
      "Apply the cube of the length ratio to a volume, or the square to a surface area, to find the other value, and add if the total is asked.",
    ],
    watch:
      "Areas use the square of the length scale and volumes the cube. Do not multiply a volume by the area ratio.",
  },
};

export const similarSolidChainPrinciples: Record<string, string> = {
  "similar-solid-scale-chain":
    "If two similar solids have corresponding lengths in ratio $k$, their surface areas are in ratio $k^2$ and their volumes in ratio $k^3$. Hence from an area ratio $m$ the length ratio is $\\sqrt{m}$ and the volume ratio is $m^{3/2}$, and from a volume ratio $v$ the area ratio is $v^{2/3}$.",
};

export const similarSolidChainLessons = [
  chainLesson({
    id: "similar-solid-scale-chain",
    title: "Surface area, length scale and volume",
    summary:
      "Go from a ratio of areas to the length scale, then to the ratio of volumes, or back from volumes to areas.",
    templateIds: ["similar-solid-scale-chain"],
    objectives: [
      "Find the length scale of two similar solids from a ratio of surface areas or of volumes.",
      "Use the scale to find the other volume, the total volume or the other surface area.",
    ],
    openingTitle: "Lengths, areas and volumes scale differently",
    opening: [
      "Two similar solids have the same shape. If every length of the larger is 3 times the matching length of the smaller, the length scale is 3. A surface is measured in squares of a length, so its area is $3^2=9$ times as large. A volume is measured in cubes of a length, so it is $3^3=27$ times as large.",
      "A ratio of areas therefore hides the length scale: take its square root. A ratio of volumes hides it too: take its cube root. Once you know the scale, you can move to the other kind of measurement.",
    ],
    example: {
      prompt:
        "Two similar prisms have surface areas 32 and 72 square centimeters. The smaller has volume 16 cubic centimeters. What is the total volume?",
      steps: [
        "Area ratio: $72\\div32=\\frac{9}{4}$, so the length scale is $\\sqrt{9/4}=\\frac{3}{2}$.",
        "Volume ratio: $(\\frac{3}{2})^3=\\frac{27}{8}$.",
        "The larger volume is $16\\times\\frac{27}{8}=54$ cubic centimeters.",
        "The total volume is $16+54=70$ cubic centimeters.",
      ],
      answer: "70 cubic centimeters",
    },
    methodTitle: "Ratio, root, then power",
    method: [
      "Reduce the ratio of the given measurements. Take the square root of an area ratio or the cube root of a volume ratio to get the length ratio.",
      "Raise the length ratio to the power 2 for another surface area or 3 for another volume. Multiply the known value by that, going from the smaller to the larger, or divide, going back.",
    ],
    formalTitle: "Why areas square and volumes cube",
    formal: [
      "If every length of solid $B$ is $k$ times the matching length of solid $A$, each face of $B$ has both its dimensions multiplied by $k$, so its area is multiplied by $k^2$ and so is the total surface area. A volume has three independent dimensions, so it is multiplied by $k^3$.",
      "The scale $k$ is positive, so it is the positive root of the area ratio, and the cube root of the volume ratio is unique.",
    ],
    pitfalls: [
      "Take the square root of an area ratio before using it for lengths or volumes.",
      "A volume scales by the cube of the length scale, not the square.",
      "Add the two volumes only when the total is asked.",
    ],
    parentGuide:
      "Ask your learner whether a length, an area or a volume is being compared, and which power of the scale that measurement needs.",
  }),
];

export const similarSolidChainFacetMappings: FacetMapping[] = [
  {
    templateId: "similar-solid-scale-chain",
    facetId: "dilation-properties.lengths-centers-invariants",
    extent: "partial",
    rationale:
      "Numeric entry for two similar rectangular prisms with whole-number scale ratios 2:3, 3:4, 2:5, 3:5, 4:5 and 3:7, from surface areas to the other volume or the total volume, and from volumes to the other surface area. Does not assess non-integer volumes, non-prism solids, deriving similarity, or radical length scales.",
  },
];
