import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const perimeterAreaChainMethods: Record<string, ProblemMethod> = {
  "perimeter-area-chain": {
    goal: "Find a square's or rectangle's area from its perimeter and a side, or its perimeter from its area and a side.",
    intuition:
      "Perimeter is the distance around a shape and area is the amount of flat space inside. Both come from the side lengths, so one measure lets you find the sides and then the other measure. A square has four equal sides.",
    terms: ["perimeter", "area"],
    method: [
      "Use the given measure to find a side: divide a square's perimeter by 4, find the side whose square is the area, divide half the perimeter minus the known side, or divide the area by the known side.",
      "Find the other measure from the sides: multiply for area, add all sides for perimeter.",
      "Check that the sides give back the measure you were given.",
    ],
    watch:
      "Perimeter adds lengths and area multiplies them. Half the perimeter is length plus width, so subtract the known side from it.",
  },
};

export const perimeterAreaChainPrinciples: Record<string, string> = {
  "perimeter-area-chain":
    "A rectangle with length $l$ and width $w$ has perimeter $2(l+w)$ and area $lw$. A square of side $s$ has perimeter $4s$ and area $s^2$. Either measure with one side determines the other side, and then the other measure.",
};

export const perimeterAreaChainLessons = [
  chainLesson({
    id: "perimeter-area-chain",
    title: "From perimeter to area and back",
    summary:
      "Use one measure of a square or rectangle to find a side, then the other measure.",
    templateIds: ["perimeter-area-chain"],
    objectives: [
      "Find the side of a square from its perimeter or area, then the other measure.",
      "Find the missing side of a rectangle from its perimeter or area and one side, then the other measure.",
    ],
    openingTitle: "The sides connect perimeter and area",
    opening: [
      "Perimeter is the distance around a shape: add the side lengths. Area is the space inside: for a rectangle, multiply length by width. Both are built from the same sides, so knowing one measure and enough of the sides lets you find the other measure.",
      "A square has four equal sides, so its perimeter is 4 times a side. A rectangle has two lengths and two widths, so half its perimeter is one length plus one width.",
    ],
    example: {
      prompt:
        "A rectangular patio has a perimeter of 36 meters and a width of 5 meters. What is its area?",
      steps: [
        "Half the perimeter is one length plus one width: $36\\div2=18$.",
        "The length is $18-5=13$ meters.",
        "The area is length times width: $13\\times5=65$ square meters.",
        "Check the perimeter: $2\\times(13+5)=36$.",
      ],
      answer: "65 square meters",
    },
    methodTitle: "Side first, then the other measure",
    method: [
      "From the given measure, find a missing side. Square perimeter: divide by 4. Square area: find the number that multiplies by itself to make the area. Rectangle perimeter: halve it and subtract the known side. Rectangle area: divide by the known side.",
      "Then compute the other measure from the sides: multiply for area, or add the sides for perimeter, using twice the sum of length and width for a rectangle.",
    ],
    formalTitle: "Why one side is enough",
    formal: [
      "For a rectangle, $P=2(l+w)$ gives $l=P/2-w$, and $A=lw$ gives $l=A/w$ for $w\\ne0$. Each formula gives the missing side exactly, so the other measure follows.",
      "For a square, $P=4s$ gives $s=P/4$. The equation $s^2=A$ has the positive solution $s=\\sqrt{A}$, the only one that is a length.",
    ],
    pitfalls: [
      "Do not multiply the perimeter by anything to get the area; find a side first.",
      "Halve the perimeter before subtracting the known side of a rectangle.",
      "Give the perimeter in length units and the area in square units.",
    ],
    parentGuide:
      "Ask your learner to sketch the shape, label the known side, and say which measure they will find first.",
  }),
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
