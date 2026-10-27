import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsGeometryMeasureMethods: Record<string, ProblemMethod> = {
  "geo-arc-length-rounded": {
    goal: "Find an arc as a fraction of the circumference when the central angle is not a friendly part of a full turn.",
    intuition:
      "A full turn is 360 degrees and the whole circle has length $2\\pi r$. A central angle of $\\theta$ degrees takes the fraction $\\frac{\\theta}{360}$ of the turn, so its arc takes the same fraction of the circumference.",
    terms: [
      ["central angle", "An angle whose vertex is the center of the circle."],
      [
        "arc length",
        "The distance along the circle between the two ends of an arc.",
      ],
    ],
    method: [
      "If a diameter is given, halve it to get the radius $r$.",
      "Compute the fraction $\\frac{\\theta}{360}$ and the circumference $2\\pi r$.",
      "Multiply, keep full calculator precision, and round only at the end to the place the question names.",
    ],
    watch:
      "Round last. Use the radius, not the diameter, in $2\\pi r$ unless you write the circumference as $\\pi d$. An angle over 180 degrees gives an arc longer than half the circle.",
  },
  "geo-ring-area": {
    goal: "Find the area between two circles with the same center by subtracting the inner circle from the outer circle.",
    intuition:
      "A walkway around a pool is the large circle with the pool removed. The large circle's radius is the pool's radius plus the walkway width, because the walkway extends outward from the edge on every side.",
    terms: [
      ["ring", "The region between two circles that share a center."],
      [
        "border width",
        "The distance from the inner circle to the outer circle.",
      ],
    ],
    method: [
      "Get the inner radius; halve a diameter if that is what is given.",
      "Add the border width once to get the outer radius.",
      "Compute $\\pi R^2-\\pi r^2$ and round at the end.",
    ],
    watch:
      "Add the width once, not twice: it is measured along a radius. Subtract the areas, not the radii.",
  },
  "geo-sphere-diameter": {
    goal: "Solve the sphere volume formula backward for the radius, then report the radius or the diameter.",
    intuition:
      "The volume formula $V=\\frac43\\pi r^3$ turns a radius into a volume. To go backward, undo each operation in reverse order: divide by $\\frac43\\pi$, then take a cube root.",
    terms: [
      [
        "cube root",
        "The number that, multiplied by itself three times, gives the original.",
      ],
      [
        "diameter",
        "A segment through the center joining two points of the sphere; it is twice the radius.",
      ],
    ],
    method: [
      "Write $\\frac43\\pi r^3=V$ and isolate $r^3=\\frac{3V}{4\\pi}$.",
      "Take the cube root with a calculator to get $r$.",
      "Read what is asked: double the radius for a diameter. Round only at the end.",
    ],
    watch:
      "A square root undoes a square, not a cube. Doubling the radius is the last step when the diameter is asked.",
  },
  "geo-trig-leg-degrees": {
    goal: "Choose sine or cosine to find a leg of a right triangle from the hypotenuse and an angle given in degrees.",
    intuition:
      "In a right triangle, the ratio of the side opposite an acute angle to the hypotenuse depends only on the angle. That ratio is the sine. The ratio of the adjacent leg to the hypotenuse is the cosine.",
    terms: [
      ["opposite leg", "The leg across the triangle from the angle."],
      [
        "adjacent leg",
        "The leg that touches the angle (the hypotenuse is the other side that touches it).",
      ],
    ],
    method: [
      "Mark the angle, the hypotenuse, and the leg you need as opposite or adjacent.",
      "Opposite and hypotenuse use sine; adjacent and hypotenuse use cosine.",
      "Multiply the hypotenuse by the ratio. Check the calculator is in degree mode.",
    ],
    watch:
      "A leg is shorter than the hypotenuse; if your answer is longer, you used the wrong ratio or the calculator is in radian mode.",
  },
  "geo-sas-triangle-area": {
    goal: "Use two sides and the angle between them to find the area, including for an obtuse angle.",
    intuition:
      "A triangle's area is half its base times its height. With two sides and the angle between them, the height of one side over the other is the other side times the sine of the angle, so no separate height is needed.",
    terms: [
      ["included angle", "The angle between two given sides."],
      [
        "sine",
        "The ratio opposite over hypotenuse; it also works for obtuse angles with a calculator.",
      ],
    ],
    method: [
      "Identify the two sides and confirm the angle sits between them.",
      "Compute $\\frac12ab\\sin C$ with the calculator in degree mode.",
      "Round at the end to the place requested.",
    ],
    watch:
      "The angle must be between the two sides. The sine of an obtuse angle is positive, and equals the sine of its supplement.",
  },
  "geo-isosceles-trig": {
    goal: "Split an isosceles triangle into two right triangles and use trigonometry to find a perimeter or a base angle.",
    intuition:
      "The altitude from the apex of an isosceles triangle splits it into two matching right triangles. It halves the apex angle and halves the base. Each right triangle has the altitude as one leg.",
    terms: [
      ["apex angle", "The angle between the two equal sides."],
      [
        "base angle",
        "An angle at either end of the base; the two base angles are equal.",
      ],
    ],
    method: [
      "Draw the altitude and label the half-angle and half-base.",
      "For the perimeter, find half the base with tangent and each equal side with cosine, then add all three sides.",
      "For a base angle, use the inverse tangent of height over half the base.",
    ],
    watch:
      "Use half the apex angle and half the base in the right triangle. The perimeter counts the whole base and both equal sides.",
  },
  "geo-volume-context": {
    goal: "Turn dimensions into a decimal volume, then apply a density or load size and round appropriately.",
    intuition:
      "Volume says how much space a solid fills. Density multiplies volume into weight or mass, and a load size divides volume into trips. Which operation to use depends on the units: pounds per cubic foot multiplies cubic feet.",
    terms: [
      ["density", "Mass or weight per unit of volume."],
      [
        "composite solid",
        "A solid made of two simpler solids joined together.",
      ],
    ],
    method: [
      "Choose each formula: cylinder $\\pi r^2h$, pyramid or cone one third of base area times height, prism base area times height.",
      "Add volumes of the joined solids; use the radius, not the diameter.",
      "Multiply by density, or divide by the load size and round up to a whole trip.",
    ],
    watch:
      "Round trips up, never to the nearest. Keep the units consistent between the volume and the density.",
  },
};

export const regentsGeometryMeasurePrinciples: Record<string, string> = {
  "geo-arc-length-rounded":
    "An arc cut by a central angle of $\\theta$ degrees in a circle of radius $r$ has length $\\frac{\\theta}{360}\\cdot2\\pi r$, because arc length is proportional to the central angle.",
  "geo-ring-area":
    "The region between concentric circles of radii $r<R$ has area $\\pi R^2-\\pi r^2=\\pi(R^2-r^2)$.",
  "geo-sphere-diameter":
    "A sphere of radius $r$ has volume $V=\\frac43\\pi r^3$, so $r=\\sqrt[3]{\\frac{3V}{4\\pi}}$ and the diameter is $2r$.",
  "geo-trig-leg-degrees":
    "In a right triangle with acute angle $A$, $\\sin A=\\frac{\\text{opposite}}{\\text{hypotenuse}}$ and $\\cos A=\\frac{\\text{adjacent}}{\\text{hypotenuse}}$, so each leg equals the hypotenuse times the matching ratio.",
  "geo-sas-triangle-area":
    "A triangle with sides $a$ and $b$ and included angle $C$ has area $\\frac12ab\\sin C$ for any angle $0^\\circ<C<180^\\circ$.",
  "geo-isosceles-trig":
    "The altitude to the base of an isosceles triangle is also the angle bisector of the apex angle and the perpendicular bisector of the base, so it forms two congruent right triangles.",
  "geo-volume-context":
    "A cylinder has volume $\\pi r^2h$; a pyramid or cone has one third of the volume of the prism or cylinder with the same base and height. Weight or mass equals density times volume, and the number of loads is the volume divided by the load size, rounded up.",
};

export const regentsGeometryMeasureLessons = [
  chainLesson({
    id: "regents-geometry-arc-and-ring",
    title: "Arcs and rings with a calculator",
    summary:
      "Find an arc from a central angle, and the area of a walkway around a circle, rounding only at the end.",
    templateIds: ["geo-arc-length-rounded", "geo-ring-area"],
    objectives: [
      "Find the length of an arc as the fraction $\\frac{\\theta}{360}$ of the circumference.",
      "Find the area of a ring as the outer circle minus the inner circle.",
    ],
    openingTitle: "A part of a circle is a fraction of the whole",
    opening: [
      "An arc is the piece of the circle between two points. If its central angle is a fraction of a full 360 degree turn, its length is the same fraction of the circumference.",
      "A walkway around a circular pool is a ring. Its area is what is left when the pool is cut out of the larger circle that includes the walkway.",
    ],
    example: {
      prompt:
        "A circle has a radius of 12 cm. A central angle of $140^\\circ$ intercepts an arc. Find the arc length to the nearest centimeter.",
      steps: [
        "The circumference is $2\\pi(12)\\approx75.398$ cm.",
        "The arc is $\\frac{140}{360}$ of it: $\\frac{140}{360}\\cdot75.398\\approx29.3$.",
        "To the nearest centimeter the arc is 29 cm.",
      ],
      answer: "29 cm",
    },
    methodTitle: "Fraction, then circumference; outer minus inner",
    method: [
      "Arc: radius, circumference, fraction $\\frac{\\theta}{360}$, multiply. Round once, at the end.",
      "Ring: inner radius, add the width once for the outer radius, then compute $\\pi R^2-\\pi r^2$.",
    ],
    formalTitle: "Why these formulas hold",
    formal: [
      "Arc length is proportional to the central angle, and the full angle 360 degrees gives the full circumference $2\\pi r$, so $s=\\frac{\\theta}{360}\\cdot2\\pi r$.",
      "The ring of radii $r<R$ is the difference of two disks, so its area is $\\pi R^2-\\pi r^2$. The width $R-r$ is measured along a radius.",
    ],
    pitfalls: [
      "Round at the end, not after the circumference.",
      "Halve a diameter before using it as a radius.",
      "Add the walkway width once, and subtract areas, not radii.",
    ],
    parentGuide:
      "Ask whether the answer is a plausible part of the whole circle: a 140 degree arc should be a bit more than a third of the circumference.",
  }),
  chainLesson({
    id: "regents-geometry-calculator-trig",
    title: "Trigonometry with a calculator",
    summary:
      "Use sine, cosine and tangent in degrees to find a leg, a triangle's area, a perimeter or a base angle.",
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
      "In any right triangle the ratios of its sides depend only on the acute angles. Sine compares the leg across from an angle with the hypotenuse, and cosine compares the leg beside it with the hypotenuse.",
      "A triangle that is not a right triangle can often be cut into right triangles. The altitude does this, and it is how the area formula with a sine comes about.",
    ],
    example: {
      prompt:
        "In right triangle $ABC$ the right angle is at $C$, $AB=25$ and $m\\angle A=31^\\circ$. Find $BC$ to the nearest tenth.",
      steps: [
        "$BC$ is opposite angle $A$ and $AB$ is the hypotenuse, so use sine.",
        "$\\sin31^\\circ=\\frac{BC}{25}$, so $BC=25\\sin31^\\circ\\approx12.876$.",
        "To the nearest tenth, $BC=12.9$.",
      ],
      answer: "12.9",
    },
    methodTitle: "Label the sides, then choose the ratio",
    method: [
      "Label opposite, adjacent and hypotenuse from the marked angle, then pick the ratio that uses the known and unknown sides.",
      "For a triangle with two sides and the included angle, compute $\\frac12ab\\sin C$.",
      "For an isosceles triangle, draw the altitude to the base and work in one right triangle.",
    ],
    formalTitle: "Where the formulas come from",
    formal: [
      "For an acute angle $A$ in a right triangle, $\\sin A$ and $\\cos A$ are fixed ratios of sides, so $\\text{leg}=\\text{hypotenuse}\\cdot\\sin A$ or $\\cos A$.",
      "The altitude on side $a$ has length $b\\sin C$, so area $\\frac12a(b\\sin C)$. For an obtuse $C$ the height is still $b\\sin C$ because $\\sin C=\\sin(180^\\circ-C)$.",
    ],
    pitfalls: [
      "Set the calculator to degrees.",
      "The angle in the area formula must lie between the two sides.",
      "In an isosceles triangle, use half the apex angle and half the base in the right triangle.",
    ],
    parentGuide:
      "Have your learner sketch the triangle and mark which side is opposite the angle before touching the calculator.",
  }),
  chainLesson({
    id: "regents-geometry-solid-measures",
    title: "From volume to size, weight and trips",
    summary:
      "Solve a sphere's volume formula backward and use volume with a density or load size.",
    templateIds: ["geo-sphere-diameter", "geo-volume-context"],
    objectives: [
      "Solve $V=\\frac43\\pi r^3$ for the radius and report the diameter.",
      "Find a decimal volume of a cylinder, composite solid or cone, then use density or a load size.",
    ],
    openingTitle: "Volume connects size, weight and trips",
    opening: [
      "Volume measures how much space a solid takes up. If you know the volume of a sphere, you can work backward to its radius by undoing the formula.",
      "Weight and mass follow from volume when you multiply by the density, and the number of trips follows from dividing by how much each trip carries.",
    ],
    example: {
      prompt:
        "A cylinder bucket has an inside diameter of 10 inches and a height of 12 inches. Find its volume in cubic inches to the nearest whole number.",
      steps: [
        "The radius is $10\\div2=5$ inches.",
        "$V=\\pi(5)^2(12)=300\\pi\\approx942.48$.",
        "The volume is about 942 cubic inches.",
      ],
      answer: "942 cubic inches",
    },
    methodTitle: "Formula, then undo or apply",
    method: [
      "Use the radius, not the diameter, and add the volumes of joined solids.",
      "To go backward from a sphere's volume, isolate $r^3$ and take a cube root.",
      "Multiply by density for weight or mass. Divide by the load size for trips and round up.",
    ],
    formalTitle: "Formulas and units",
    formal: [
      "Sphere: $V=\\frac43\\pi r^3$. Cylinder: $\\pi r^2h$. Cone and pyramid: one third of the base area times the height.",
      "A density such as pounds per cubic foot multiplies a volume in cubic feet to give pounds, so the units must match.",
    ],
    pitfalls: [
      "Use a cube root, not a square root, when solving for a sphere's radius.",
      "Round the number of trips up, since a partial trip is still a trip.",
      "Convert units so the volume and the density use the same length unit.",
    ],
    parentGuide:
      "Ask your learner to estimate the answer with 3 for $\\pi$ first, to catch a missed radius or a wrong power.",
  }),
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
