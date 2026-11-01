import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const GEO_SENSES = {
  side: "side",
  vertex: "vertex",
  degrees: "degree-angle",
  "corresponding angles": "corresponding-angles",
  similar: "similar-figures",
  image: "image-transformation",
  center: "center",
  radius: "radius",
  plane: "plane",
  base: "base-shape",
  face: "face-solid",
  edge: "edge",
  solid: "solid-shape",
  unit: "unit",
  tangent: "tangent-trig",
  "opposite leg": "opposite-side-angle",
  multiple: "multiple",
  "one third": "third",
} as const;
const GEO_NOLINK = [
  "opposite",
  "part",
  "parts",
  "rule",
  "rules",
  "third",
  "whole",
  "change",
  "changes",
  "square",
  "squares",
  "factor",
  "factors",
  "more than",
  "leaves",
  "mean",
  "product",
  "term",
  "terms",
  "scale",
  "prime",
  "opposite side",
  "mode",
  "key",
  "cubes",
];

export const regentsGeometryMeasureMethods: Record<string, ProblemMethod> = {
  "geo-arc-length-rounded": {
    goal: "Find an arc as a fraction of the circumference when the central angle is not a friendly part of a full turn.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A circle's radius $r$ is the distance from its center to the circle, and its diameter is twice that. The circumference, the distance around, is $2\\pi r$, where $\\pi$ (pi) is about 3.14. A central angle has its corner at the center, and its arc is the piece of the circle between its two sides. A full turn is $360^\\circ$, so an angle of $\\theta$ degrees is the fraction $\\frac{\\theta}{360}$ of a turn. Here $\\theta$ (theta) stands for the angle. Its arc is the same fraction of the circumference.",
    terms: ["central-angle", "arc-length"],
    method: [
      "If a diameter is given, halve it to get the radius $r$.",
      "Compute the fraction $\\frac{\\theta}{360}$ and the circumference $2\\pi r$.",
      "Multiply. Keep every calculator digit, and round only at the end, to the place the question names.",
    ],
    watch:
      "Round last. Use the radius, not the diameter, in $2\\pi r$, unless you write the circumference as $\\pi d$. An angle over 180 degrees gives an arc longer than half the circle.",
  },
  "geo-ring-area": {
    goal: "Find the area between two circles with the same center by subtracting the inner circle from the outer circle.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A ring is the flat region between two circles with the same center. A walkway around a round pool is a ring: the big circle with the pool cut out. A circle's area is $\\pi r^2$, where $r$ is its radius, the distance from the center to the circle. The big circle's radius is the pool's radius plus the walkway's width, because the walkway reaches out the same distance on every side.",
    terms: [
      "ring",
      [
        "ring",
        "The border width is the distance between the two circles: inner radius plus border width gives the outer radius.",
      ],
    ],
    method: [
      "Find the inner radius. If a diameter is given, halve it.",
      "Add the walkway width once to get the outer radius $R$.",
      "Compute $\\pi R^2-\\pi r^2$, the big area minus the small area, and round at the end.",
    ],
    watch:
      "Add the width once, not twice, because it is measured along a radius. Subtract the areas, not the radii.",
  },
  "geo-sphere-diameter": {
    goal: "Solve the sphere volume formula backward for the radius, then report the radius or the diameter.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A sphere is a ball shape. Its radius $r$ is the distance from its center to its surface, and its diameter is twice that. The volume formula $V=\\frac43\\pi r^3$ turns a radius into a volume, where $r^3$ means $r\\times r\\times r$. To go backward, undo each step in reverse order. Divide by $\\frac43\\pi$, then take the cube root: the number that, used three times as a factor, gives the result.",
    terms: ["cube-root", "diameter"],
    method: [
      "Write $\\frac43\\pi r^3=V$ and get $r^3$ alone: $r^3=\\frac{3V}{4\\pi}$.",
      "Take the cube root with a calculator to get $r$.",
      "Read what is asked: double the radius for a diameter. Round only at the end.",
    ],
    watch:
      "A square root undoes a square, not a cube. When the diameter is asked, doubling the radius is the last step.",
  },
  "geo-trig-leg-degrees": {
    goal: "Choose sine or cosine to find a leg of a right triangle from the hypotenuse and an angle given in degrees.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A right triangle has one square corner, a right angle. The side across from it is the hypotenuse, the longest side, and the other two sides are legs. For one of the other angles, the leg across from it is the opposite leg, and the leg touching it is the adjacent leg. The ratio of the opposite leg to the hypotenuse depends only on the angle. It is called the sine, written $\\sin$. The ratio of the adjacent leg to the hypotenuse is called the cosine, written $\\cos$.",
    terms: ["opposite-side-angle", "adjacent-leg"],
    method: [
      "Mark the angle, the hypotenuse, and the leg you need as opposite or adjacent to the angle.",
      "Opposite with hypotenuse uses sine. Adjacent with hypotenuse uses cosine.",
      "Multiply the hypotenuse by that ratio. Check that the calculator is in degree mode.",
    ],
    watch:
      "A leg is shorter than the hypotenuse. If your answer is longer, you used the wrong ratio or the calculator is in radian mode.",
  },
  "geo-sas-triangle-area": {
    goal: "Use two sides and the angle between them to find the area, including for an obtuse angle.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A triangle's area is half its base times its height, where the height is measured straight up from the base, at a right angle (a square corner). Suppose you know two sides, $a$ and $b$, and the angle $C$ between them. Then the height to side $a$ is $b\\sin C$: side $b$ times the sine of the angle, a number a calculator gives. So the area is $\\frac12ab\\sin C$, and no separate height is needed.",
    terms: ["included-angle", "sine"],
    method: [
      "Find the two sides, and check that the angle sits between them.",
      "Compute $\\frac12ab\\sin C$ with the calculator in degree mode.",
      "Round at the end, to the place asked for.",
    ],
    watch:
      "The angle must be between the two sides. The sine of an obtuse angle, one over $90^\\circ$, is positive and equals the sine of $180^\\circ$ minus that angle.",
  },
  "geo-isosceles-trig": {
    goal: "Split an isosceles triangle into two right triangles and use trigonometry to find a perimeter or a base angle.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "An isosceles triangle has two equal sides. They meet at the apex, and the angle there is the apex angle. The third side is the base. The altitude is the line from the apex straight down to the base, meeting it at a right angle, a square corner. It splits the triangle into two matching right triangles. It halves the apex angle and halves the base. In each right triangle, the altitude and half the base are the legs, and an equal side is the hypotenuse. Tangent is the ratio of the leg across from an angle to the leg beside it.",
    terms: [
      [
        "angle",
        "The apex angle of an isosceles triangle is the angle between its two equal sides.",
      ],
      "isosceles",
      "base-angle",
    ],
    method: [
      "Draw the altitude, and label the half-angle and the half-base.",
      "For the perimeter, find half the base with tangent and each equal side with cosine. Then add all three sides.",
      "For a base angle, use the inverse tangent of the height divided by half the base.",
    ],
    watch:
      "Use half the apex angle and half the base in the right triangle. The perimeter counts the whole base and both equal sides.",
  },
  "geo-volume-context": {
    goal: "Turn dimensions into a decimal volume, then apply a density or load size and round appropriately.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "Volume is how much space a solid fills. It is counted in cubic units, the cubes 1 unit long, wide and tall, such as cubic feet. Density is weight or mass per unit of volume, such as pounds per cubic foot. So multiply the volume by the density to get the weight. A load size is how much one trip carries, so divide the volume by it to count the trips. The units decide which to do: pounds per cubic foot times cubic feet gives pounds.",
    terms: ["density", "composite-figure"],
    method: [
      "Choose each formula: a cylinder is $\\pi r^2h$, a pyramid or cone is one third of base area times height, and a prism is base area times height.",
      "Add the volumes of joined solids. Use the radius, not the diameter.",
      "Multiply by the density, or divide by the load size and round up to a whole trip.",
    ],
    watch:
      "Round trips up, never to the nearest. Keep the units the same in the volume and the density.",
  },
};

export const regentsGeometryMeasurePrinciples: Record<string, string> = {
  "geo-arc-length-rounded":
    "An arc cut off by a central angle of $\\theta$ degrees, in a circle of radius $r$, has length $\\frac{\\theta}{360}\\cdot2\\pi r$. This holds because arc length grows in step with the central angle.",
  "geo-ring-area":
    "The region between two circles with the same center, with radii $r<R$, has area $\\pi R^2-\\pi r^2=\\pi(R^2-r^2)$.",
  "geo-sphere-diameter":
    "A sphere of radius $r$ has volume $V=\\frac43\\pi r^3$. So $r=\\sqrt[3]{\\frac{3V}{4\\pi}}$, the cube root, and the diameter is $2r$.",
  "geo-trig-leg-degrees":
    "In a right triangle with acute angle $A$, $\\sin A=\\frac{\\text{opposite}}{\\text{hypotenuse}}$ and $\\cos A=\\frac{\\text{adjacent}}{\\text{hypotenuse}}$. So each leg equals the hypotenuse times the matching ratio.",
  "geo-sas-triangle-area":
    "A triangle with sides $a$ and $b$ and included angle $C$, the angle between them, has area $\\frac12ab\\sin C$ for any angle $0^\\circ<C<180^\\circ$.",
  "geo-isosceles-trig":
    "The altitude to the base of an isosceles triangle also cuts the apex angle in half and meets the base at its midpoint, the point halfway along it. So it forms two congruent right triangles, the same size and shape.",
  "geo-volume-context":
    "A cylinder has volume $\\pi r^2h$. A pyramid or cone has one third of the volume of the prism or cylinder with the same base and height. Weight or mass equals density times volume. The number of loads is the volume divided by the load size, rounded up.",
};

export const regentsGeometryMeasureLessons = [
  {
    ...chainLesson({
      id: "regents-geometry-arc-and-ring",
      title: "Arcs and rings with a calculator",
      summary:
        "An arc is a piece of a circle. If its angle at the middle of the circle is $\\frac{140}{360}$ of a full turn, its length is $\\frac{140}{360}$ of the distance around. A walkway around a round pool is a ring, and its area is the big circle minus the pool. Use a calculator, and round only at the end.",
      templateIds: ["geo-arc-length-rounded", "geo-ring-area"],
      objectives: [
        "Find the length of an arc as the fraction $\\frac{\\theta}{360}$ of the circumference.",
        "Find the area of a ring as the outer circle minus the inner circle.",
      ],
      openingTitle: "A part of a circle is a fraction of the whole",
      opening: [
        "A circle's center is the point in its middle. Its radius, $r$, is the distance from the center to the circle, and its diameter is twice the radius. Its circumference, the distance around, is $2\\pi r$. Here $\\pi$ (pi) is a fixed number, about 3.14159, and a calculator has a key for it.",
        "An arc is the piece of the circle between two points. A central angle has its corner at the center, and its sides cut off an arc. A degree is a small unit of turn, and a full turn is 360 degrees. If the central angle is a fraction of the full turn, the arc is the same fraction of the circumference.",
        "A walkway around a round pool is a ring, the region between two circles with the same center. A circle's area is $\\pi r^2$, where $r^2$ means $r\\times r$. The ring's area is what is left when the pool is cut out of the larger circle.",
        "To round to the nearest centimeter, use the closest count of whole centimeters. Round only once, at the end, so small errors do not build up.",
      ],
      example: {
        prompt:
          "A circle has a radius of 12 cm. A central angle of $140^\\circ$ intercepts an arc. Find the arc length to the nearest centimeter.",
        steps: [
          "Find the whole circumference first: $2\\pi(12)\\approx75.398$ cm. The sign $\\approx$ means about equal.",
          "The angle is $\\frac{140}{360}$ of a full turn, so the arc is $\\frac{140}{360}$ of the circumference: $\\frac{140}{360}\\cdot75.398\\approx29.3$.",
          "Round once, at the end: to the nearest centimeter, the arc is 29 cm.",
        ],
        answer: "29 cm",
      },
      methodTitle: "Fraction, then circumference; outer minus inner",
      method: [
        "Arc: find the radius and the circumference, then multiply by the fraction $\\frac{\\theta}{360}$. Round once, at the end.",
        "Ring: find the inner radius, and add the width once for the outer radius. Then compute $\\pi R^2-\\pi r^2$.",
      ],
      formalTitle: "Why these formulas hold",
      formal: [
        "Arc length grows in step with the central angle. The full angle, 360 degrees, gives the full circumference $2\\pi r$. So an angle of $\\theta$ degrees, where $\\theta$ is the Greek letter theta, gives $s=\\frac{\\theta}{360}\\cdot2\\pi r$.",
        "A ring with radii $r<R$ is a big disk with a small disk removed, so its area is $\\pi R^2-\\pi r^2$. Its width, $R-r$, is measured along a radius.",
      ],
      pitfalls: [
        "Round at the end, not after finding the circumference.",
        "Halve a diameter before using it as a radius.",
        "Add the walkway width once, and subtract areas, not radii.",
      ],
      parentGuide:
        "Ask whether the answer is a sensible part of the whole circle. A 140 degree arc should be a bit more than a third of the circumference.",
    }),
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
  },
  {
    ...chainLesson({
      id: "regents-geometry-calculator-trig",
      title: "Trigonometry with a calculator",
      summary:
        "In a right triangle, the ratios of the sides depend only on the angles. Sine and cosine name two of these ratios, and a calculator gives their values. With them you can find a missing side from one side and an angle. They also give the area of any triangle from two sides and the angle between them.",
      templateIds: [
        "geo-trig-leg-degrees",
        "geo-sas-triangle-area",
        "geo-isosceles-trig",
      ],
      objectives: [
        "Choose sine or cosine to find a leg from the hypotenuse and an acute angle.",
        "Use $\\frac12ab\\sin C$ for the area when two sides and the angle between them are known.",
        "Cut an isosceles triangle into right triangles to find a perimeter or a base angle.",
      ],
      openingTitle: "A ratio tied to the angle",
      opening: [
        "A degree is the usual unit for angles, and a full turn is 360 degrees. A right triangle has one right angle, a square corner of $90^\\circ$. The side across from it is the hypotenuse, the longest side. The other two sides are called the legs. Pick one of the other angles, $A$. The leg across from $A$ is the opposite leg, and the leg touching $A$ is the adjacent leg.",
        "All right triangles with the same angle $A$ have the same shape, so their side ratios match. The sine of $A$, written $\\sin A$, is the opposite leg divided by the hypotenuse. The cosine, $\\cos A$, is the adjacent leg divided by the hypotenuse. Tangent is a third ratio: the opposite leg divided by the adjacent leg, written $\\tan A$.",
        "A triangle that is not a right triangle can often be cut into right triangles. An altitude is a straight line from a corner that meets the opposite side at a right angle. It does this. That is how the area formula with a sine comes about. Set the calculator to degree mode, because these angles are in degrees.",
      ],
      example: {
        prompt:
          "In right triangle $ABC$ the right angle is at $C$, $AB=25$ and $m\\angle A=31^\\circ$. Find $BC$ to the nearest tenth.",
        steps: [
          "Name the sides from angle $A$. $BC$ is across from $A$, so it is the opposite leg. $AB$ is across from the right angle, so it is the hypotenuse. Opposite and hypotenuse use sine.",
          "Write the ratio and solve: $\\sin31^\\circ=\\frac{BC}{25}$. Multiply both sides by 25: $BC=25\\sin31^\\circ\\approx12.876$.",
          "Round to the nearest tenth: $BC=12.9$.",
        ],
        answer: "12.9",
      },
      methodTitle: "Label the sides, then choose the ratio",
      method: [
        "Label the opposite leg, the adjacent leg and the hypotenuse from the marked angle. Then pick the ratio that uses the known side and the unknown side.",
        "For a triangle with two sides and the angle between them, compute $\\frac12ab\\sin C$.",
        "For an isosceles triangle, draw the altitude to the base and work in one right triangle.",
      ],
      formalTitle: "Where the formulas come from",
      formal: [
        "For an acute angle $A$ (under $90^\\circ$) in a right triangle, $\\sin A$ and $\\cos A$ are fixed ratios of sides. So a leg is the hypotenuse times $\\sin A$, or times $\\cos A$.",
        "In a triangle with sides $a$ and $b$ and the angle $C$ between them, the altitude to side $a$ has length $b\\sin C$. So the area is $\\frac12a(b\\sin C)$. For an obtuse $C$, over $90^\\circ$, the height is still $b\\sin C$, because $\\sin C=\\sin(180^\\circ-C)$.",
      ],
      pitfalls: [
        "Set the calculator to degrees.",
        "The angle in the area formula must lie between the two sides.",
        "In an isosceles triangle, use half the apex angle and half the base in the right triangle.",
      ],
      parentGuide:
        "Have your learner sketch the triangle and mark which side is opposite the angle before touching the calculator.",
    }),
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
  },
  {
    ...chainLesson({
      id: "regents-geometry-solid-measures",
      title: "From volume to size, weight and trips",
      summary:
        "Volume is the amount of space a solid takes up. If you know a ball's volume, you can work backward to its size by undoing the formula. Volume also leads to weight: multiply by the weight of each unit of volume. And it leads to a number of trips: divide by how much one trip carries, then round up.",
      templateIds: ["geo-sphere-diameter", "geo-volume-context"],
      objectives: [
        "Solve the sphere volume formula $V=\\frac43\\pi r^3$ for the radius, and report the diameter.",
        "Find the volume of a cylinder, a cone or a solid made of parts, then use a density or a load size.",
      ],
      openingTitle: "Volume connects size, weight and trips",
      opening: [
        "Volume measures how much space a solid takes up. It is counted in cubic units, the cubes 1 unit long, wide and tall, such as cubic inches. A cylinder is a can shape. Its volume is the area of its circular base times its height: $\\pi r^2h$. Here $r$ is the radius, the distance from the circle's middle point, called the center, to the circle, $h$ is the height, and $\\pi$ (pi) is about 3.14.",
        "A sphere is a ball. Its volume is $V=\\frac43\\pi r^3$, where $r^3$ means $r\\times r\\times r$. If you know the volume, you can work backward to the radius by undoing the formula. The last undo is a cube root: the number that, used three times as a factor, gives the value.",
        "Density is the weight or mass of each unit of volume, such as pounds per cubic foot. Multiply the volume by the density to get the weight. A load size is how much one trip carries. Divide the volume by it to count trips, and round up, because part of a trip is still a trip.",
      ],
      example: {
        prompt:
          "A cylinder bucket has an inside diameter of 10 inches and a height of 12 inches. Find its volume in cubic inches to the nearest whole number.",
        steps: [
          "The formula needs the radius, which is half the diameter: $10\\div2=5$ inches.",
          "A cylinder's volume is base area times height: $V=\\pi(5)^2(12)=300\\pi\\approx942.48$ cubic inches.",
          "Round to the nearest whole number: about 942 cubic inches.",
        ],
        answer: "942 cubic inches",
      },
      methodTitle: "Formula, then undo or apply",
      method: [
        "Use the radius, not the diameter, and add the volumes of joined solids.",
        "To go backward from a sphere's volume, get $r^3$ alone and take a cube root.",
        "Multiply by the density for weight or mass. Divide by the load size for trips, and round up.",
      ],
      formalTitle: "Formulas and units",
      formal: [
        "Sphere: $V=\\frac43\\pi r^3$. Cylinder: $\\pi r^2h$. Cone and pyramid: one third of the base area times the height.",
        "A density such as pounds per cubic foot multiplies a volume in cubic feet to give pounds, so the units must match.",
      ],
      pitfalls: [
        "Use a cube root, not a square root, when solving for a sphere's radius.",
        "Round the number of trips up, since part of a trip is still a trip.",
        "Convert units so the volume and the density use the same length unit.",
      ],
      parentGuide:
        "Ask your learner to estimate first, using 3 for $\\pi$. That catches a missed radius or a wrong power.",
    }),
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
  },
];

const m = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({ templateId, facetId, extent: "partial", rationale });
export const regentsGeometryMeasureFacetMappings: FacetMapping[] = [
  m(
    "geo-arc-length-rounded",
    "arc-sector-measure.core",
    "Numeric entry of a rounded arc length for minor and major arcs given a radius or a diameter. Does not assess radian measure, sector areas, or deriving the arc formula.",
  ),
  m(
    "geo-trig-leg-degrees",
    "right-triangle-trigonometry.core",
    "Numeric entry of the opposite or adjacent leg from the hypotenuse and an acute angle in degrees with a calculator. Does not assess finding an angle, the hypotenuse from a leg, or word problems with angles of elevation.",
  ),
  m(
    "geo-sas-triangle-area",
    "trigonometric-area.core",
    "Numeric entry of a rounded area from two decimal sides and an acute or obtuse included angle. Does not assess the derivation, the ambiguous case, or areas from three sides.",
  ),
  m(
    "geo-ring-area",
    "composite-measurement.core",
    "Numeric entry of the rounded area of a circular ring from an inner radius or diameter and a border width. Does not assess other composite regions or area in context with conversion.",
  ),
  m(
    "geo-sphere-diameter",
    "curved-solid-volume.core",
    "Numeric entry of a rounded radius or diameter solved from a sphere's volume. Does not assess cones or cylinders solved backward or volume in terms of pi.",
  ),
  m(
    "geo-isosceles-trig",
    "right-triangle-trigonometry.core",
    "Numeric entry of an isosceles triangle's perimeter from the apex angle and altitude, or a rounded base angle from the base and height. Does not assess other triangles split by an altitude or proofs that the altitude bisects the apex.",
  ),
  m(
    "geo-volume-context",
    "solid-volume-models.core",
    "Numeric entry of the weight of a cylinder of soil, the mass of a prism with a pyramid from a density, and the whole number of trips for a cone. Does not assess unit conversion between length units or surface area.",
  ),
];
