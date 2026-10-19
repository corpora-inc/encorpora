import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const foundations: Lesson["sections"] = [
  {
    title: "Locate the center and measure the radius",
    paragraphs: [
      "A circle is the set of points in a flat surface that are all the same distance from one point, called the center. A radius joins the center to a point on the circle; radius also names that segment's length. Every radius of one circle has the same length.",
      "A diameter joins two points on the circle and passes through the center. It consists of two radii, so its length is twice the radius. Write r for the radius and d for the diameter: $d = 2r$ and $r = d/2$. If a diameter is given, divide it by 2 before using a formula that requires the radius.",
      "Circumference is the distance once around the circle's curved boundary. Area measures how much of the flat surface lies inside that boundary. A length in centimeters uses cm; an area in square centimeters counts units the size of a square with sides of 1 cm.",
    ],
  },
  {
    title: "Keep pi exact",
    paragraphs: [
      "Divide a circle's circumference by its diameter. Every circle gives the same ratio, called pi and written $\\pi$. A ratio compares two quantities by division. Pi is approximately 3.14159, but that shortened decimal is not its exact value. Leaving $\\pi$ in an answer keeps the measure exact.",
      "A coefficient is the number multiplying another quantity. In $7\\pi$ cm, the coefficient of $\\pi$ is 7. In $\\frac{5}{2}\\pi$ cm, it is 5/2. These questions write the measure as $a\\pi$ and ask only for a. The letter a is a place for the unknown coefficient; the complete measure also includes $\\pi$ and its unit.",
      "You need multiplication and division of positive numbers and fractions. A fraction's denominator names how many equal parts make one whole; its numerator counts those parts. Thus 3/2 is three halves, or 1 whole and 1 half. The fraction also means division: 3 divided by 2. Multiply fractions by multiplying their numerators and their denominators, then divide both by a shared factor to reduce the result.",
      "To divide a fraction by 2, multiply it by 1/2. For example, $\\frac{3}{2} \\div 2 = \\frac{3}{2} \\times \\frac{1}{2} = \\frac{3}{4}$. Three halves become three quarters when their total size is halved.",
    ],
  },
];
const angles: Lesson["sections"] = [
  {
    title: "Measure a turn at the center",
    paragraphs: [
      "An angle measures the turn between two rays that start at the same point. A ray begins at a point and extends in one direction. Degrees divide a full turn into 360 equal parts. A quarter-turn is 90 degrees; a half-turn is 180 degrees.",
      "A central angle has its vertex, or meeting point, at the circle's center. Its rays follow two radii. An arc is a portion of the circle's boundary between two endpoints. A sector is the region bounded by two radii and the arc between them.",
      "Two endpoints divide a circle into two arcs. The stated central angle identifies which one to use. An angle less than 180 degrees selects less than half the circle; 180 degrees selects half. A reflex angle is greater than 180 degrees and less than 360 degrees, so it selects more than half. A 270-degree angle selects three quarters, not the other 90-degree quarter.",
    ],
  },
];

export const circleMeasurementLessons: Lesson[] = [
  {
    id: "circle-circumference-coefficient",
    title: "Measure a circle's circumference",
    summary: "The distance around a circle is pi times its diameter.",
    templateIds: ["circle-circumference-coefficient"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Distinguish a radius, a diameter, and a circumference.",
      "Calculate an exact circumference and identify its coefficient of pi.",
    ],
    sections: [
      ...foundations,
      {
        title: "Use the circumference-to-diameter ratio",
        paragraphs: [
          "Write C for circumference. The definition of pi gives $C/d = \\pi$. Multiply both sides by the positive diameter d to get $C = \\pi d$. Since $d = 2r$, the same formula is $C = 2\\pi r$.",
          "The diameter is a straight distance through the center; circumference follows the curved boundary. Pi is greater than 3 and less than 4, so a circumference is greater than three diameters and less than four. This gives a size check without replacing the exact answer by a decimal.",
        ],
        illustration: "circle-circumference",
      },
    ],
    workedExample: {
      prompt:
        "A circle has a diameter of 10 cm. Its circumference is $a\\pi$ cm. What is a?",
      steps: [
        "The given length is the diameter: d = 10 cm. The radius is half of it: r = 10 ÷ 2 = 5 cm.",
        "Use the diameter formula: $C = \\pi d = \\pi \\times 10 = 10\\pi$ cm.",
        "The coefficient is the number multiplying $\\pi$, so a = 10. The complete circumference is $10\\pi$ cm.",
        "Check using the radius: $C = 2\\pi r = 2 \\times \\pi \\times 5 = 10\\pi$ cm. Both forms give the same measure.",
      ],
      answer: "10",
    },
    pitfalls: [
      "Use the diameter in $C = \\pi d$ or the radius in $C = 2\\pi r$.",
      "Circumference is a length, so its unit is cm rather than square centimeters.",
      "When the question asks for a in $a\\pi$, enter the coefficient only.",
    ],
    parentGuide:
      "Ask how doubling a circle's radius changes its diameter and circumference. Use the formula to explain why both double.",
  },
  {
    id: "circle-area-coefficient",
    title: "Measure the area inside a circle",
    summary: "A circle's area is pi times the square of its radius.",
    templateIds: ["circle-area-coefficient"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain why radius and square units appear in the area formula.",
      "Calculate exact circle area from a radius or diameter.",
    ],
    sections: [
      ...foundations,
      {
        title: "Why the radius is squared",
        paragraphs: [
          "Imagine cutting the region inside a circle into many narrow wedges. A wedge, called a sector, is bounded by two radii and the curved boundary between their endpoints. Arrange the wedges alternately with their tips up and down. This rearrangement preserves the area.",
          "As the wedges become narrower, the rearranged shape approaches a rectangle. Its height approaches r. Its width approaches half the circumference because half the curved boundary runs along each long side. The bends along those sides shrink as the wedges narrow.",
          "A rectangle's area is width times height. The circle therefore has area $A = (C/2)r = \\pi r^2$. Here uppercase A names the area, and $r^2$ means $r \\times r$. Squaring a length in centimeters produces square centimeters. Lowercase a in the question names the coefficient of $\\pi$.",
        ],
        illustration: "circle-area",
      },
      {
        title: "Divide a diameter before squaring",
        paragraphs: [
          "A diameter is twice a radius. Using its square directly would give four times the correct area: $d^2 = (2r)^2 = 4r^2$. First find $r = d/2$, then multiply the radius by itself.",
          "For a fractional radius, square the whole fraction. If $r = \\frac{3}{2}$ cm, then $r^2 = \\frac{3}{2} \\times \\frac{3}{2} = \\frac{9}{4}$ square centimeters, so $A = \\frac{9}{4}\\pi$ square centimeters. The coefficient a is 9/4.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A circle has a diameter of 6 cm. Its area is $a\\pi$ square centimeters. What is a?",
      steps: [
        "Find the radius: r = 6 ÷ 2 = 3 cm.",
        "Square the radius: $r^2 = 3 \\times 3 = 9$ square centimeters.",
        "Multiply by pi: $A = \\pi r^2 = 9\\pi$ square centimeters. The requested coefficient is a = 9.",
        "Check with half the circumference times the radius. The circumference is $6\\pi$ cm, so $A = \\frac{1}{2} \\times 6\\pi \\times 3 = 9\\pi$ square centimeters.",
      ],
      answer: "9",
    },
    pitfalls: [
      "Square the radius, not the diameter.",
      "Squaring means multiplying a number by itself, not multiplying it by 2.",
      "Area measures the inside region and uses square units.",
    ],
    parentGuide:
      "Ask why doubling the radius quadruples area but only doubles circumference. Compare $\\pi(2r)^2$ with $2\\pi(2r)$.",
  },
  {
    id: "arc-length-coefficient",
    title: "Measure an arc of a circle",
    summary:
      "An arc takes the same fraction of the circumference as its central angle takes of a full turn.",
    templateIds: ["arc-length-coefficient"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Use a central angle to identify a fraction of a circle's boundary.",
      "Calculate exact arc lengths, including arcs greater than a semicircle.",
    ],
    sections: [
      ...foundations,
      ...angles,
      {
        title: "Take a fraction of the circumference",
        paragraphs: [
          "Equal turns at the center cut off equal lengths along one circle. A 1-degree turn cuts off 1/360 of its circumference. An angle of 150 degrees therefore cuts off 150/360, or 5/12, of the circumference.",
          "Write the central angle as $\\theta$ (the Greek letter theta), measured in degrees, and write L for arc length. Since the full circumference is $2\\pi r$, the arc length is $L = \\frac{\\theta}{360} \\times 2\\pi r$. Divide the angle by 360, then multiply that fraction by the circumference.",
          "Arc length follows the curved boundary. It is different from a chord, which is the straight segment joining the arc's endpoints. A radius joins the center to an endpoint; it also is not the arc length.",
        ],
        illustration: "circle-arc",
      },
    ],
    workedExample: {
      prompt:
        "A circle has a diameter of 12 cm. An arc corresponds to a central angle of 150 degrees. Its length is $a\\pi$ cm. What is a?",
      steps: [
        "Find the radius: r = 12 ÷ 2 = 6 cm. The full circumference is $C = 2\\pi r = 12\\pi$ cm.",
        "Find the fraction of a full turn: $\\frac{150}{360} = \\frac{5}{12}$, dividing numerator and denominator by 30.",
        "Multiply that fraction by the circumference: $L = \\frac{5}{12} \\times 12\\pi = 5\\pi$ cm.",
        "The requested coefficient is a = 5. Check: 150 degrees is less than 180 degrees, and $5\\pi$ cm is less than the half-circumference $6\\pi$ cm.",
      ],
      answer: "5",
    },
    pitfalls: [
      "Divide an angle in degrees by 360, not by 180.",
      "A reflex angle selects the longer arc. Use the stated angle rather than subtracting it from 360.",
      "Use circumference for arc length; arc length is not an area.",
    ],
    parentGuide:
      "For the same circle, compare arcs of 90, 180, and 270 degrees. Explain their lengths as one quarter, one half, and three quarters of the circumference.",
  },
  {
    id: "sector-area-coefficient",
    title: "Measure a sector of a circle",
    summary:
      "A sector takes the same fraction of the circle's area as its central angle takes of a full turn.",
    templateIds: ["sector-area-coefficient"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Identify the region selected by a central angle.",
      "Calculate exact sector areas, including sectors greater than half a circle.",
    ],
    sections: [
      ...foundations,
      ...angles,
      {
        title: "Take a fraction of the circle's area",
        paragraphs: [
          "The area of a full circle is $\\pi r^2$, where $r^2$ means $r \\times r$. One way to see this formula is to rearrange very narrow sectors alternately tip-up and tip-down: they approach a rectangle of height r and width half the circumference, $\\pi r$. Multiplying gives $\\pi r^2$.",
          "Equal central angles cut out equal areas in the same circle. A 1-degree sector is 1/360 of the full area. Write the angle as $\\theta$ (theta), measured in degrees, and the sector area as S. Then $S = \\frac{\\theta}{360} \\times \\pi r^2$.",
          "Find the radius, square it, and multiply by the angle's fraction of a full turn. Keep $\\pi$ in the complete area. A sector's area uses square centimeters; its curved boundary has a length measured in centimeters.",
        ],
        illustration: "circle-sector",
      },
    ],
    workedExample: {
      prompt:
        "A circle has a radius of 4 cm. A sector has a central angle of 270 degrees. Its area is $a\\pi$ square centimeters. What is a?",
      steps: [
        "The radius is r = 4 cm. Square it: $r^2 = 4 \\times 4 = 16$. The full circle has area $16\\pi$ square centimeters.",
        "Find the fraction of a full turn: $\\frac{270}{360} = \\frac{3}{4}$, dividing numerator and denominator by 90.",
        "Take three quarters of the full area: $S = \\frac{3}{4} \\times 16\\pi = 12\\pi$ square centimeters. Thus a = 12.",
        "Check the omitted quarter: $\\frac{1}{4} \\times 16\\pi = 4\\pi$ square centimeters. The two areas sum to $12\\pi + 4\\pi = 16\\pi$, the full circle's area.",
      ],
      answer: "12",
    },
    pitfalls: [
      "Use the circle's area, not its circumference.",
      "Find the radius before squaring if the given length is a diameter.",
      "A 270-degree sector is three quarters of the circle, not one quarter.",
    ],
    parentGuide:
      "Ask how the sector area changes when the angle doubles while the radius stays fixed, and when the radius doubles while the angle stays fixed. The first doubles the area; the second quadruples it.",
  },
];

/** The most common error for each circle measure, stated as what to do. */
const circleWatch: Record<string, string> = {
  "circle-circumference-coefficient":
    "Use the diameter, not the radius: a circle of radius 5 cm has circumference 10π cm, not 5π cm.",
  "circle-area-coefficient":
    "Square the radius, not the diameter, and do not double it: radius 3 cm gives area 9π, not 6π or 36π.",
  "arc-length-coefficient":
    "Take the angle's fraction of the circumference, 2πr, not of the area.",
  "sector-area-coefficient":
    "Take the angle's fraction of the area, πr², not of the circumference.",
};
export const circleMeasurementMethods: Record<string, ProblemMethod> =
  Object.fromEntries(
    circleMeasurementLessons.map((lesson) => [
      lesson.id,
      {
        goal: lesson.objectives[1]!,
        terms: [
          ["radius", "The distance from the center to the circle."],
          [
            "coefficient",
            "The number multiplying pi; a names the number requested.",
          ],
        ],
        method:
          lesson.id === "circle-circumference-coefficient"
            ? [
                "If a radius is given, double it to find the diameter.",
                "Circumference is pi times the diameter.",
                "Enter the diameter's numerical value as a.",
              ]
            : lesson.id === "circle-area-coefficient"
              ? [
                  "If a diameter is given, divide it by 2 to find the radius.",
                  "Square the radius: multiply it by itself.",
                  "Area is pi times that square. Enter the square as a.",
                ]
              : [
                  "Find the radius; halve a given diameter.",
                  "Divide the stated angle by 360.",
                  lesson.id === "arc-length-coefficient"
                    ? "Multiply that fraction by twice the radius."
                    : "Multiply that fraction by the square of the radius.",
                  "Enter this exact coefficient a; retain pi and units in the complete measure.",
                ],
        watch: circleWatch[lesson.id]!,
      },
    ]),
  );
export const circleMeasurementPrinciples: Record<string, string> = {
  "circle-circumference-coefficient":
    "Every circle has the same circumference-to-diameter ratio, pi.",
  "circle-area-coefficient":
    "Circle area is pi times the square of the radius; a diameter contains two radii.",
  "arc-length-coefficient":
    "An arc's fraction of the circumference equals its central angle divided by 360 degrees.",
  "sector-area-coefficient":
    "A sector's fraction of the circle's area equals its central angle divided by 360 degrees.",
};
