import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const perimeterAreaChainMethods: Record<string, ProblemMethod> = {
  "perimeter-area-chain": {
    goal: "Find a square's or rectangle's area from its perimeter and a side, or its perimeter from its area and a side.",
    intuition:
      "Perimeter is the distance all the way around a shape: add its side lengths. A unit square is a square with sides 1 unit long. Area is how much flat space a shape covers, counted in unit squares. For a rectangle, area is length times width. A square has 4 equally long sides. Both measures come from the sides. So find a missing side first, then the other measure.",
    senses: { side: "side", square: "square-shape", unit: "unit" },
    terms: ["perimeter", "area"],
    method: [
      "Find a missing side. Square perimeter: divide by 4. Square area: find the number that times itself makes the area.",
      "Rectangle perimeter: halve it, then subtract the known side. Rectangle area: divide by the known side.",
      "Find the other measure. Multiply length by width for area, or add all 4 sides for perimeter.",
      "Check that the sides give back the measure you were given.",
    ],
    watch:
      "Perimeter adds lengths and area multiplies them. Half the perimeter is length plus width, so subtract the known side from that half.",
  },
};

export const perimeterAreaChainPrinciples: Record<string, string> = {
  "perimeter-area-chain":
    "A rectangle with length $l$ and width $w$ has perimeter $2(l + w)$, which means 2 times $l + w$. Its area is $l \\times w$. A square with side $s$ has perimeter $4s$ (4 times $s$) and area $s^2$ ($s$ times $s$). One measure and one side give the other side, and then the other measure.",
};

export const perimeterAreaChainLessons = [
  {
    ...chainLesson({
      id: "perimeter-area-chain",
      title: "From perimeter to area and back",
      summary:
        "Perimeter is the distance all the way around a shape. A unit square is a square with sides 1 unit long. Area is how much flat space a shape covers, counted in unit squares. Both measures come from the side lengths. If you know one measure and enough sides, you can find the missing side. Then you can find the other measure.",
      templateIds: ["perimeter-area-chain"],
      objectives: [
        "Find the side of a square from its perimeter or area, then the other measure.",
        "Find the missing side of a rectangle from its perimeter or area and one side, then the other measure.",
      ],
      openingTitle: "The sides connect perimeter and area",
      opening: [
        "Picture a rectangular patio 13 meters long and 5 meters wide. Walk all the way around it: 13 + 5 + 13 + 5 = 36 meters. That distance is its perimeter.",
        "Now cover it with square tiles that are 1 meter on each side. There are 5 rows of 13 tiles, so 13 × 5 = 65 tiles. Its area is 65 square meters.",
        "A rectangle has two lengths and two widths. So half its perimeter is one length plus one width: 36 ÷ 2 = 18, and 13 + 5 = 18. That is how a perimeter helps you find a missing side.",
        "A square has 4 equally long sides. So its perimeter is 4 times one side. Its area is one side times itself.",
      ],
      example: {
        prompt:
          "A rectangular patio has a perimeter of 36 meters and a width of 5 meters. What is its area?",
        steps: [
          "A rectangle has two lengths and two widths. So half the perimeter is one length plus one width: $36 \\div 2 = 18$ meters.",
          "Take away the width to find the length: $18 - 5 = 13$ meters.",
          "Area is length times width: $13 \\times 5 = 65$ square meters.",
          "Check with the perimeter: $2 \\times (13 + 5) = 36$ meters, the perimeter we were given.",
        ],
        answer: "65 square meters",
      },
      methodTitle: "Side first, then the other measure",
      method: [
        "First use the measure you are given to find a missing side.",
        "Square, perimeter given: divide by 4, because the 4 sides are equal. Square, area given: find the number that times itself makes the area. For an area of 49, the side is 7, because 7 × 7 = 49.",
        "Rectangle, perimeter given: halve it, then subtract the known side. Rectangle, area given: divide the area by the known side.",
        "Then find the other measure. For area, multiply length by width. For perimeter, add all 4 sides. That is the same as 2 times the sum of length and width.",
      ],
      formalTitle: "Why one side is enough",
      formal: [
        "Let $l$ stand for a rectangle's length, $w$ for its width, $P$ for its perimeter and $A$ for its area. Then $P = 2(l + w)$, which means 2 times the sum $l + w$. Also $A = l \\times w$.",
        "So $l = P \\div 2 - w$. When $w$ is not 0, also $l = A \\div w$. Each gives the missing side exactly, so the other measure follows.",
        "For a square with side $s$, $P = 4s$, meaning 4 times $s$. So $s = P \\div 4$. Its area is $s^2$ ($s$ squared, meaning $s \\times s$). The side is the positive number that times itself makes $A$. A side cannot be negative, so there is only one answer.",
      ],
      pitfalls: [
        "Do not multiply the perimeter by anything to get the area. Find a side first.",
        "For a rectangle, halve the perimeter before you subtract the known side.",
        "Give the perimeter in length units, such as meters. Give the area in square units, such as square meters.",
      ],
      parentGuide:
        "Ask your learner to sketch the shape and label the known side. Then ask which measure they will find first.",
    }),
    senses: { side: "side", square: "square-shape", unit: "unit" },
  },
];

export const perimeterAreaChainFacetMappings: FacetMapping[] = [
  {
    templateId: "perimeter-area-chain",
    facetId: "area-perimeter-models.core",
    extent: "partial",
    rationale:
      "Numeric entry for a square's area from its perimeter and perimeter from its area, and a rectangle's area from its perimeter and width and perimeter from its area and width, with whole-number sides up to 21. Does not assess composite figures, drawing, fractional sides, or maximum-area reasoning.",
  },
];
