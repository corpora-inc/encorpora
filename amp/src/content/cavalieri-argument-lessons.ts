import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Methods, principles and the lesson for Cavalieri arguments (HSG.GMD.A.2):
 * the hemisphere against a cylinder with a cone removed, which gives the
 * sphere's volume, and the arguments for oblique solids, cones and pyramids.
 */

const senses = {
  base: "base-shape",
  side: "side",
  plane: "plane",
  solid: "solid-shape",
  solids: "solid-shape",
  face: "face-solid",
  center: "center",
  similar: "similar-figures",
  vertex: "vertex",
  height: "height",
};
const noLink = [
  "square",
  "squared",
  "third",
  "half",
  "factor",
  "scale",
  "opposite",
  "product",
  "whole",
  "part",
  "parts",
  "rule",
  "change",
  "changes",
];

export const cavalieriArgumentMethods: Record<string, ProblemMethod> = {
  "cavalieri-sphere-argument": {
    goal: "Justify, continue, check or choose the Cavalieri argument that a hemisphere's volume is $\\frac23\\pi r^3$.",
    intuition:
      "A hemisphere is half of a sphere. Stand one of radius $r$ beside a cylinder of radius $r$ and height $r$ with a cone carved out, tip down. Cut both at the same height $y$. The hemisphere's slice is a circle and the other slice is a ring, and they have the same area at every height. Cavalieri's principle then says the two solids hold the same volume.",
    senses,
    noLink,
    terms: ["cross-section", "cylinder", "cone", "sphere", "ring"],
    method: [
      "Hemisphere slice at height $y$: a right triangle with hypotenuse $r$ and leg $y$ gives radius $\\sqrt{r^2-y^2}$ and area $\\pi(r^2-y^2)$.",
      "Ring slice: the cone's radius equals its height, so the ring has radii $r$ and $y$ and area $\\pi r^2-\\pi y^2$.",
      "Equal at every height and equal heights, so by Cavalieri's principle the volumes are equal: $\\pi r^3-\\frac13\\pi r^3=\\frac23\\pi r^3$. Double it for the sphere.",
    ],
    watch:
      "Check every step, not the final answer. Matching slices at a few heights, equal bases, or a right conclusion do not make the argument complete.",
  },
  "cavalieri-slice-area-check": {
    goal: "Find two solids' slice areas at a given height and say what they show, or finish the sphere's volume computation.",
    intuition:
      "A slice is the flat shape where a plane parallel to the base cuts a solid. To compare two solids, compute both slice areas at the same height. If they match at every height, the solids have the same volume. If they differ at even one height, Cavalieri's principle cannot be used.",
    senses,
    noLink,
    terms: ["cross-section", "ring", "scale-factor"],
    method: [
      "Hemisphere: a radius $r$ to the slice's edge is a hypotenuse, so the slice area is $\\pi(r^2-y^2)$. Ring: $\\pi r^2-\\pi y^2$.",
      "Pyramid or cone: the slice is the base scaled by $\\frac{h-y}{h}$, so its area is $B\\left(\\frac{h-y}{h}\\right)^2$.",
      "Compare the two areas. Equal here, and equal by the same algebra at every height, means equal volumes; unequal here means the principle does not apply.",
    ],
    watch:
      "Lengths scale by the factor, but areas scale by its square. And a slice radius of a sphere is not $r-y$: use the right triangle.",
  },
  "cavalieri-other-solids-argument": {
    goal: "Choose the Cavalieri argument for oblique solids, cones and pyramids, and test whether the principle applies.",
    intuition:
      "Cavalieri's principle says: if two solids have the same height, and their slices at every height have equal areas, their volumes are equal. A leaning stack of coins keeps the volume of the straight stack. A cone matches a pyramid with the same base area and height. A prism splits into three pyramids of equal volume.",
    senses,
    noLink,
    terms: ["oblique", "cross-section", "prism", "pyramid", "cone"],
    method: [
      "Name the two solids being compared and check that they have the same height.",
      "Find the slice area at a general height $y$ in each: congruent to the base, or the base scaled by $\\frac{h-y}{h}$, or a formula such as $\\pi(r^2-y^2)$.",
      "If the areas are equal at every height, conclude equal volumes. If they differ at any height, the principle says nothing.",
    ],
    watch:
      "Equal bases and equal heights are not enough. A cone and a cylinder share both and still differ in volume.",
  },
};

export const cavalieriArgumentPrinciples: Record<string, string> = {
  "cavalieri-sphere-argument":
    "At height $y$, a hemisphere of radius $r$ has slice area $\\pi(r^2-y^2)$, and a cylinder of radius $r$ and height $r$ with a cone removed (tip at the base center) has slice area $\\pi r^2-\\pi y^2$. By Cavalieri's principle, the hemisphere's volume is $\\pi r^3-\\frac13\\pi r^3=\\frac23\\pi r^3$, so the sphere's is $\\frac43\\pi r^3$.",
  "cavalieri-slice-area-check":
    "Two solids of the same height whose slices at every height have equal areas have equal volumes. A slice of a pyramid or cone at height $y$ has area $B\\left(\\frac{h-y}{h}\\right)^2$; a slice of a hemisphere has area $\\pi(r^2-y^2)$.",
  "cavalieri-other-solids-argument":
    "Cavalieri's principle: two solids of the same height whose slices at every height have equal areas have equal volumes. It gives $\\pi r^2h$ for an oblique cylinder, $\\frac13Bh$ for a cone with the base area $B$ of a pyramid, and one third of a prism for each of its three pyramids.",
};

export const cavalieriArgumentLessons: Lesson[] = [
  chainLesson({
    id: "cavalieri-argument-lesson",
    title: "Cavalieri arguments for the sphere and other solids",
    summary:
      "Two solids of the same height whose slices at every height have equal areas have equal volumes. A hemisphere matches a cylinder with a cone removed, which gives the sphere's volume. Leaning solids keep their volume, and a cone matches a pyramid with the same base area and height.",
    senses,
    noLink,
    templateIds: [
      "cavalieri-sphere-argument",
      "cavalieri-slice-area-check",
      "cavalieri-other-solids-argument",
    ],
    objectives: [
      "Compute and compare slice areas at a height $y$, and decide whether Cavalieri's principle applies.",
      "Justify, check and complete the arguments for the volumes of a sphere, an oblique cylinder, a cone and a pyramid.",
    ],
    openingTitle: "Compare solids slice by slice",
    opening: [
      "Picture a stack of coins. Push it so it leans: it still holds the same coins, so it has the same volume. Each coin is a slice, the flat shape where a plane parallel to the base cuts the solid.",
      "Cavalieri's principle says this in general. If two solids have the same height, and their slices at every height have equal areas, then the solids have equal volumes.",
      "Every height matters. Two solids that match only at the bottom and the top, or that only share a base and a height, may hold different volumes.",
    ],
    example: {
      prompt:
        "A hemisphere of radius 5 cm stands beside a cylinder of radius 5 cm and height 5 cm with a cone removed, tip at the center of the base. A plane at height 3 cm cuts both. Compare the slices.",
      steps: [
        "The hemisphere's slice: a radius of 5 cm to its edge is the hypotenuse of a right triangle with leg 3 cm, so the slice radius is $\\sqrt{5^2-3^2}=4$ cm. Its area is $16\\pi$ cm².",
        "The other slice is a ring. The cone's radius equals its height, so at height 3 cm the inner radius is 3 cm. The area is $25\\pi-9\\pi=16\\pi$ cm².",
        "The same algebra works at every height: $\\pi(r^2-y^2)=\\pi r^2-\\pi y^2$. Both solids are 5 cm tall, so their volumes are equal.",
        "The hemisphere's volume is $\\pi\\cdot5^2\\cdot5-\\frac13\\pi\\cdot5^2\\cdot5=\\frac{250}{3}\\pi$ cm³, which is $\\frac23\\pi r^3$.",
      ],
      answer:
        "Both slices are $16\\pi$ cm²; the hemisphere's volume is $\\frac{250}{3}\\pi$ cm³",
    },
    methodTitle: "Find the slices, compare, conclude",
    method: [
      "Find each solid's slice area at a general height $y$: a circle, a ring, or a scaled copy of the base.",
      "Check that the areas are equal at every height and that the heights match.",
      "Then the volumes are equal: compute the one you know, such as $\\pi r^3-\\frac13\\pi r^3$ or $\\frac13Bh$.",
    ],
    formalTitle: "The principle and three of its results",
    formal: [
      "Cavalieri's principle: two solids between the same two parallel planes, whose slices by every parallel plane between them have equal areas, have equal volumes.",
      "Sphere: a hemisphere of radius $r$ matches a cylinder of radius $r$ and height $r$ with a cone removed, so $V_{\\text{hemisphere}}=\\frac23\\pi r^3$ and $V_{\\text{sphere}}=\\frac43\\pi r^3$.",
      "Oblique solids have the volume $Bh$ of the right solid with the same base and height. A cone has the volume $\\frac13Bh$ of a pyramid with the same base area and height, because both slices are $B\\left(\\frac{h-y}{h}\\right)^2$.",
    ],
    pitfalls: [
      "Using the principle when slices match only at some heights, or when only the bases and heights match.",
      "Writing a sphere's slice radius as $r-y$ instead of $\\sqrt{r^2-y^2}$.",
      "Scaling a slice's area by the length factor instead of its square.",
      "Accepting an argument because its final answer is right.",
    ],
    parentGuide:
      "Ask your learner to cut both solids at the same height and say how big each slice is. Then ask whether that is true at every height.",
  }),
];

const gmd = "cavalieri-principle.HSG.GMD.A.2";
export const cavalieriArgumentFacetMappings: FacetMapping[] = [
  {
    templateId: "cavalieri-sphere-argument",
    facetId: gmd,
    extent: "partial",
    rationale:
      "The Cavalieri argument for the sphere's volume (hemisphere against a cylinder with a cone removed): justify each step, choose the next step, find the flaw in five student arguments (two with right conclusions), and choose the complete argument. Recognition and completion, not free writing.",
  },
  {
    templateId: "cavalieri-slice-area-check",
    facetId: gmd,
    extent: "partial",
    rationale:
      "Computes exact slice areas at a numeric height for the hemisphere and the cylinder with a cone removed, for a pyramid and a cone with equal base and height, and for a hemisphere and a cone whose slices differ, with the conclusion each supports; and the closing volume computation for the sphere. The general-height equality is stated, not derived by the learner.",
  },
  {
    templateId: "cavalieri-other-solids-argument",
    facetId: gmd,
    extent: "partial",
    rationale:
      "Chooses the Cavalieri argument for an oblique cylinder, the reason a cone's slices match a pyramid's and its consequence, why two pyramids of a prism's dissection have equal volume, whether slices matching at two heights suffice, the flaw in a claim from equal bases and heights, and the correct statement of the principle.",
  },
  {
    templateId: "cavalieri-other-solids-argument",
    facetId: "cavalieri-principle.core",
    extent: "partial",
    rationale:
      "Applies Cavalieri's principle to leaning stacks and oblique cylinders, cones and pyramids, and tests its hypothesis of equal slices at every height.",
  },
];
