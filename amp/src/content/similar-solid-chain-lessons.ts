import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const similarSolidChainMethods: Record<string, ProblemMethod> = {
  "similar-solid-scale-chain": {
    goal: "Use the surface areas of two similar prisms to find their length scale, then the other volume, the total volume or the other surface area.",
    senses: {
      similar: "similar-figures",
      side: "side",
      face: "face-solid",
      solid: "solid-shape",
      squared: "square-number",
    },
    noLink: [
      "factor",
      "cube",
      "cubes",
      "square",
      "squares",
      "change",
      "scale",
      "scales",
    ],
    intuition:
      "Two solids are similar when they have the same shape: every length of one is the same number times the matching length of the other. That number is the length scale, also called the scale factor. A prism is a solid with two matching flat ends joined by flat faces, like a box. Its surface area is the total area of all its faces. Area is counted in squares, which have two lengths, so areas grow by the scale times itself: the scale squared. Volume, the space inside, is counted in cubes, which have three lengths. So volumes grow by the scale cubed, the scale used three times as a factor. With a scale of 2, areas grow 4 times and volumes grow 8 times.",
    terms: ["scale-factor", "similar-figures"],
    method: [
      "Divide the two given amounts and simplify the fraction. A surface-area ratio is the length scale squared. A volume ratio is the length scale cubed.",
      "Undo the power to get the length scale. Take the square root of an area ratio: the number that times itself gives it. Take the cube root of a volume ratio.",
      "Cube the length scale to change a volume, or square it to change a surface area. Multiply going from smaller to larger, and add both volumes if the total is asked.",
    ],
    watch:
      "Areas use the length scale squared, and volumes use it cubed. Do not multiply a volume by the area ratio.",
  },
};

export const similarSolidChainPrinciples: Record<string, string> = {
  "similar-solid-scale-chain":
    "If matching lengths of two similar solids are in ratio $k$, their surface areas are in ratio $k^2$ ($k$ times $k$) and their volumes are in ratio $k^3$ ($k$ times $k$ times $k$). So from an area ratio $m$, the length ratio is $\\sqrt{m}$ and the volume ratio is $(\\sqrt{m})^3$. From a volume ratio $v$, the length ratio is $\\sqrt[3]{v}$ and the area ratio is $(\\sqrt[3]{v})^2$.",
};

export const similarSolidChainLessons = [
  {
    ...chainLesson({
      id: "similar-solid-scale-chain",
      title: "Surface area, length scale and volume",
      summary:
        "Two solids are similar when one is a scaled copy of the other. If every length is 2 times as long, each surface area is $2 \\times 2 = 4$ times as large. The volume, the space inside, is $2 \\times 2 \\times 2 = 8$ times as large. So a ratio of areas or of volumes reveals the length scale. From the length scale you can find any other area or volume.",
      templateIds: ["similar-solid-scale-chain"],
      objectives: [
        "Find the length scale of two similar solids from a ratio of surface areas or of volumes.",
        "Use the length scale to find the other volume, the total volume or the other surface area.",
      ],
      openingTitle: "Lengths, areas and volumes scale differently",
      opening: [
        "Two solids are similar when they have the same shape: every length of the larger is the same number times the matching length of the smaller. That number is called the length scale, or scale factor. A prism is a solid with two matching flat ends joined by flat faces, like a box. Its surface area is the total area of all its faces. Its volume is the amount of space inside.",
        "Suppose every length of the larger box is 3 times as long. Each face is 3 times as long and 3 times as wide, so its area is $3 \\times 3 = 9$ times as large. We write $3^2 = 9$, read “3 squared”. The box is also 3 times as tall, so its volume is $3 \\times 3 \\times 3 = 27$ times as large. We write $3^3 = 27$, read “3 cubed”.",
        "Going backward, a ratio of areas hides the length scale. Undo the squaring with a square root: the number that times itself gives the ratio. For example, $\\sqrt{9} = 3$. A ratio of volumes hides it too. Undo the cubing with a cube root: $\\sqrt[3]{27} = 3$, because $3 \\times 3 \\times 3 = 27$. Once you know the length scale, you can move to the other kind of measurement.",
      ],
      example: {
        prompt:
          "Two similar prisms have surface areas 40 and 90 square centimeters. The smaller has volume 16 cubic centimeters. What is the total volume?",
        steps: [
          "Compare the surface areas: $90\\div40=\\frac{9}{4}$. Area grows by the length scale squared, so undo the squaring. The length scale is $\\sqrt{9/4}=\\frac{3}{2}$, because $\\frac{3}{2}\\times\\frac{3}{2}=\\frac{9}{4}$.",
          "Volume grows by the length scale cubed: $(\\frac{3}{2})^3=\\frac{3}{2}\\times\\frac{3}{2}\\times\\frac{3}{2}=\\frac{27}{8}$.",
          "The larger prism's volume is the smaller one's times $\\frac{27}{8}$: $16\\times\\frac{27}{8}=54$ cubic centimeters.",
          "The question asks for the total volume, so add both: $16+54=70$ cubic centimeters.",
        ],
        answer: "70 cubic centimeters",
      },
      methodTitle: "Ratio, root, then power",
      method: [
        "Simplify the ratio of the given measurements. Take the square root of an area ratio, or the cube root of a volume ratio, to get the length ratio.",
        "Raise the length ratio to the power 2 for another surface area, or 3 for another volume. A power counts how many times a number is used as a factor. Multiply the known value by the result going from the smaller solid to the larger, or divide going back.",
      ],
      formalTitle: "Why areas square and volumes cube",
      formal: [
        "Say every length of solid $B$ is $k$ times the matching length of solid $A$. Each face of $B$ has both its length and its width multiplied by $k$. So its area is multiplied by $k \\times k = k^2$, and so is the total surface area. A volume has three directions, length, width and height, so it is multiplied by $k^3$.",
        "The scale $k$ is positive, so it is the positive square root of the area ratio. The cube root of the volume ratio has only one value, so it gives $k$ directly.",
      ],
      pitfalls: [
        "Take the square root of an area ratio before using it for lengths or volumes.",
        "A volume grows by the cube of the length scale, not the square.",
        "Add the two volumes only when the total is asked.",
      ],
      parentGuide:
        "Ask your learner whether a length, an area or a volume is being compared. Then ask which power of the scale that measurement needs: 1, 2 or 3.",
    }),
    senses: {
      similar: "similar-figures",
      side: "side",
      face: "face-solid",
      solid: "solid-shape",
      squared: "square-number",
    },
    noLink: ["factor", "cube", "cubes", "square", "squares", "scale", "scales"],
  },
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
