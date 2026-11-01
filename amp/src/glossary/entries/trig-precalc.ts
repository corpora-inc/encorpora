import type { GlossaryEntry } from "../types";

/** Right-triangle and unit-circle trigonometry, sinusoids, polar curves and conics. */
export const trigPrecalcEntries: GlossaryEntry[] = [
  {
    id: "30-60-90-triangle",
    term: "30°-60°-90° triangle",
    forms: ["30-60-90 triangle", "30-60-90 triangles"],
    plain:
      "A right triangle with angles of 30°, 60° and 90°. Its sides are in the ratio 1 : $\\sqrt{3}$ : 2, shortest first.",
    example:
      "If the short leg is 5, the long leg is $5\\sqrt{3}$ and the hypotenuse is 10.",
    uses: ["right-triangle", "angle", "side", "ratio", "leg", "hypotenuse"],
    band: "geometry",
  },
  {
    id: "45-45-90-triangle",
    term: "45°-45°-90° triangle",
    forms: ["45-45-90 triangle", "45-45-90 triangles"],
    plain:
      "A right triangle with two equal legs and two 45° angles. The hypotenuse is a leg times $\\sqrt{2}$.",
    example: "Legs of 6 give a hypotenuse of $6\\sqrt{2}$.",
    uses: ["right-triangle", "leg", "angle", "hypotenuse"],
    band: "geometry",
  },
  {
    id: "adjacent-leg",
    term: "adjacent leg",
    forms: ["adjacent leg", "adjacent legs", "adjacent side"],
    plain:
      "In a right triangle, the leg that touches a chosen acute angle. The hypotenuse touches it too, but it is not a leg.",
    example:
      "In right triangle $ABC$ with the right angle at $C$, side $AC$ is the leg adjacent to angle $A$.",
    uses: [
      "right-triangle",
      "leg",
      "acute-angle",
      "hypotenuse",
      "right-angle",
      "side",
      "angle",
    ],
    band: "geometry",
  },
  {
    id: "altitude",
    term: "altitude",
    forms: ["altitude", "altitudes"],
    plain:
      "A segment from a vertex of a triangle straight to the line through the opposite side, meeting it at a right angle.",
    example: "A triangle with base 10 and altitude 6 has area ½ × 10 × 6 = 30.",
    uses: [
      "segment",
      "vertex",
      "triangle",
      "line",
      "opposite-side-angle",
      "right-angle",
      "base-shape",
      "area",
    ],
    band: "geometry",
  },
  {
    id: "amplitude",
    term: "amplitude",
    forms: ["amplitude", "amplitudes"],
    plain:
      "How far a wave-shaped graph rises above or falls below its midline: half the distance from its lowest to its highest value.",
    example:
      "A wave between 2 and 8 has amplitude 3; $y=-4\\sin x$ has amplitude 4.",
    uses: ["midline", "distance", "half"],
    band: "algebra-2",
  },
  {
    id: "angle-of-depression",
    term: "angle of depression",
    forms: ["angle of depression", "angles of depression"],
    plain:
      "The angle between a level line and your line of sight when you look down at something.",
    example:
      "From a cliff, a boat seen 30° below level is at an angle of depression of 30°.",
    uses: ["angle", "line"],
    band: "geometry",
  },
  {
    id: "angle-of-elevation",
    term: "angle of elevation",
    forms: ["angle of elevation", "angles of elevation"],
    plain:
      "The angle between a level line and your line of sight when you look up at something.",
    example:
      "Looking up at a treetop 20° above level, the angle of elevation is 20°.",
    uses: ["angle", "line"],
    band: "geometry",
  },
  {
    id: "angular-speed",
    term: "angular speed",
    forms: ["angular speed", "angular velocity"],
    plain:
      "How much angle something turns through in each unit of time, such as radians per second.",
    example:
      "A wheel making 2 full turns each second has angular speed $4\\pi$ radians per second.",
    uses: ["angle", "unit", "radian"],
    band: "algebra-2",
  },
  {
    id: "arc",
    term: "arc",
    forms: ["arc", "arcs"],
    plain: "A connected piece of a circle between two points on it.",
    example: "A quarter of a circle with radius 4 is an arc of length $2\\pi$.",
    uses: ["circle", "point", "radius", "length", "fourth"],
    band: "geometry",
  },
  {
    id: "base-angle",
    term: "base angle",
    forms: ["base angle", "base angles"],
    plain:
      "In an isosceles triangle, either of the two angles at the ends of the base, across from the equal sides. The two base angles are equal.",
    example:
      "If the top angle of an isosceles triangle is 40°, each base angle is (180° − 40°) ÷ 2 = 70°.",
    uses: ["isosceles", "triangle", "angle", "base-shape", "side"],
    band: "8",
  },
  {
    id: "bearing",
    term: "bearing",
    forms: ["bearing", "bearings"],
    plain:
      "A direction given as an angle measured clockwise from north, written with three digits.",
    example: "Due east is a bearing of 090°; southwest is 225°.",
    uses: ["angle", "digit"],
    band: "geometry",
  },
  {
    id: "cofunction-identity",
    term: "cofunction identity",
    forms: [
      "cofunction identity",
      "cofunction identities",
      "cofunction",
      "cofunctions",
    ],
    plain:
      "The sine of an acute angle equals the cosine of its complementary angle: $\\sin A=\\cos(90^\\circ-A)$. Cosine and sine swap the same way.",
    example: "$\\sin 30^\\circ=\\cos 60^\\circ=0.5$.",
    uses: ["sine", "cosine", "acute-angle", "complementary-angles"],
    band: "geometry",
  },
  {
    id: "complementary-angles",
    term: "complementary angles",
    forms: ["complementary angles", "complementary angle", "complementary"],
    plain: "Two angles whose measures add to 90°.",
    example: "35° and 55° are complementary angles.",
    uses: ["angle"],
    band: "7",
  },
  {
    id: "cosine",
    term: "cosine",
    forms: ["cosine", "cosines"],
    plain:
      "For an acute angle in a right triangle, the length of the adjacent leg divided by the length of the hypotenuse.",
    example:
      "In a 3-4-5 right triangle, the angle beside the leg of length 4 has cosine $\\frac{4}{5}=0.8$.",
    uses: [
      "acute-angle",
      "right-triangle",
      "adjacent-leg",
      "hypotenuse",
      "length",
      "angle",
      "leg",
    ],
    band: "geometry",
  },
  {
    id: "coterminal-angles",
    term: "coterminal angles",
    forms: ["coterminal angles", "coterminal angle", "coterminal"],
    plain:
      "Angles in standard position that share the same terminal side. They differ by whole turns of 360°, or $2\\pi$.",
    example: "30°, 390° and −330° are coterminal angles.",
    uses: ["angle", "standard-position", "terminal-side"],
    band: "algebra-2",
    noLink: ["whole"],
  },
  {
    id: "double-cone",
    term: "double cone",
    forms: ["double cone", "double cones", "nappe", "nappes"],
    plain:
      "Two cones joined tip to tip along one center line, like an hourglass. Each cone is called a nappe.",
    example:
      "Slicing a double cone at different angles gives a circle, an ellipse, a parabola or a hyperbola.",
    uses: ["cone", "line", "angle", "circle", "parabola"],
    band: "precalculus",
    noLink: ["center"],
  },
  {
    id: "identity-equation",
    term: "identity",
    forms: ["identity", "identities"],
    plain:
      "An equation that is true for every allowed value of its variable, so both sides are always equal.",
    example:
      "$2(x+3)=2x+6$ for every $x$, and $\\sin^2\\theta+\\cos^2\\theta=1$ for every angle.",
    uses: ["equation", "variable", "angle", "side-of-equation"],
    band: "8",
    autoLink: false,
  },
  {
    id: "included-angle",
    term: "included angle",
    forms: ["included angle", "included angles"],
    plain:
      "The angle formed between two given sides, at the vertex where they meet.",
    example:
      "In triangle $ABC$, angle $B$ is the included angle between sides $AB$ and $BC$.",
    uses: ["angle", "side", "vertex", "triangle"],
    band: "7",
  },
  {
    id: "inverse-trig-function",
    term: "inverse trig function",
    forms: [
      "inverse trig function",
      "inverse trig functions",
      "inverse tangent",
      "inverse sine",
      "inverse cosine",
      "arctangent",
      "arcsine",
      "arccosine",
      "arctan",
      "arcsin",
      "arccos",
    ],
    plain:
      "A function that gives back the angle for a known trig ratio. $\\tan^{-1}$ undoes tangent, $\\sin^{-1}$ undoes sine, and $\\cos^{-1}$ undoes cosine.",
    example: "$\\tan^{-1}(1)=45^\\circ$ because $\\tan 45^\\circ=1$.",
    uses: ["function", "angle", "ratio", "tangent-trig", "sine", "cosine"],
    band: "geometry",
  },
  {
    id: "limacon",
    term: "limaçon",
    forms: [
      "limaçon",
      "limaçons",
      "limacon",
      "limacons",
      "cardioid",
      "cardioids",
    ],
    plain:
      "A looped polar curve $r=a+b\\cos\\theta$ or $r=a+b\\sin\\theta$. When $a=b$ it is a heart-shaped cardioid; when $a<b$ it has an inner loop.",
    example:
      "$r=2+2\\cos\\theta$ is a cardioid; $r=1+2\\cos\\theta$ has an inner loop.",
    uses: ["polar-coordinates"],
    band: "precalculus",
  },
  {
    id: "oblique-triangle",
    term: "oblique triangle",
    forms: ["oblique triangle", "oblique triangles"],
    plain: "A triangle with no right angle.",
    example:
      "A triangle with angles of 50°, 60° and 70° is an oblique triangle.",
    uses: ["triangle", "right-angle", "angle"],
    band: "precalculus",
  },
  {
    id: "opposite-side-angle",
    term: "opposite side",
    forms: ["opposite side", "opposite leg", "opposite legs"],
    plain:
      "The side of a triangle across from a given angle, not touching it. In a right triangle, the side across from an acute angle is called the opposite leg.",
    example:
      "In triangle $ABC$, side $a$ is opposite angle $A$; it joins $B$ and $C$.",
    uses: ["side", "triangle", "angle", "right-triangle", "leg", "acute-angle"],
    band: "geometry",
    autoLink: false,
    noLink: ["opposite"],
  },
  {
    id: "phase-shift",
    term: "phase shift",
    forms: ["phase shift", "phase shifts"],
    plain:
      "How far a wave-shaped graph is slid left or right from its usual starting position.",
    example:
      "$y=\\sin\\left(x-\\frac{\\pi}{4}\\right)$ is $y=\\sin x$ slid $\\frac{\\pi}{4}$ to the right.",
    uses: [],
    band: "algebra-2",
  },
  {
    id: "polar-coordinates",
    term: "polar coordinates",
    forms: ["polar coordinates", "polar coordinate"],
    plain:
      "A way to locate a point by its distance $r$ from the center, called the pole, and its angle $\\theta$ from the positive $x$-axis.",
    example:
      "The polar point $(2, 90^\\circ)$ is the point (0, 2) on the $x$-$y$ grid.",
    uses: ["point", "distance", "angle", "x-axis"],
    band: "precalculus",
    noLink: ["center"],
  },
  {
    id: "radian",
    term: "radian",
    forms: ["radian", "radians"],
    plain:
      "A unit of angle: one radian turns through an arc as long as the circle's radius. A half turn is $\\pi$ radians, or 180°.",
    example: "90° is $\\frac{\\pi}{2}$ radians, and 1 radian is about 57.3°.",
    uses: ["unit", "angle", "arc", "radius", "circle", "half"],
    band: "geometry",
  },
  {
    id: "radical",
    term: "radical",
    forms: ["radical", "radicals", "radical expression", "radical expressions"],
    plain:
      "An expression with a root sign, such as $\\sqrt{7}$ or $6\\sqrt{2}$.",
    uses: ["expression", "root-radical"],
    band: "geometry",
  },
  {
    id: "rationalize",
    term: "rationalize the denominator",
    forms: ["rationalize the denominator", "rationalize", "rationalizing"],
    plain:
      "Rewrite a fraction so that no square root is left in the denominator, by multiplying the top and bottom by the same number.",
    example:
      "$\\frac{3}{\\sqrt{2}}=\\frac{3\\sqrt{2}}{2}$, multiplying top and bottom by $\\sqrt{2}$.",
    uses: ["fraction", "square-root", "denominator"],
    band: "geometry",
  },
  {
    id: "reference-angle",
    term: "reference angle",
    forms: ["reference angle", "reference angles"],
    plain:
      "The acute angle between the terminal side of an angle and the $x$-axis. An angle's trig values match its reference angle's, up to sign.",
    example:
      "150° has reference angle 30°, so $\\sin 150^\\circ=\\sin 30^\\circ=0.5$.",
    uses: ["acute-angle", "terminal-side", "angle", "x-axis"],
    band: "algebra-2",
  },
  {
    id: "rose-curve",
    term: "rose curve",
    forms: ["rose curve", "rose curves"],
    plain:
      "A flower-shaped polar curve $r=a\\cos(n\\theta)$ or $r=a\\sin(n\\theta)$, with $n\\ge2$. It has $n$ petals when $n$ is odd and $2n$ when $n$ is even.",
    example: "$r=3\\sin(2\\theta)$ has 4 petals; $r=\\cos(3\\theta)$ has 3.",
    uses: ["polar-coordinates", "odd-number", "even-number"],
    band: "precalculus",
  },
  {
    id: "sine",
    term: "sine",
    forms: ["sine", "sines"],
    plain:
      "For an acute angle in a right triangle, the length of the opposite side divided by the length of the hypotenuse.",
    example:
      "In a 3-4-5 right triangle, the angle across from the side of length 3 has sine $\\frac{3}{5}=0.6$.",
    uses: [
      "acute-angle",
      "right-triangle",
      "opposite-side-angle",
      "hypotenuse",
      "length",
      "angle",
      "side",
    ],
    band: "geometry",
  },
  {
    id: "ssa",
    term: "SSA",
    forms: ["ssa"],
    plain:
      "Knowing two sides of a triangle and an angle not between them. It can fit no triangle, exactly one or two, so it is called the ambiguous case.",
    example:
      "With $a=6$, $b=8$ and $A=30^\\circ$, two different triangles fit.",
    uses: ["side", "triangle", "angle"],
    band: "precalculus",
  },
  {
    id: "standard-position",
    term: "standard position",
    forms: ["standard position"],
    plain:
      "An angle drawn with its vertex at the origin and its starting side on the positive $x$-axis, turning counterclockwise for positive angles.",
    example: "In standard position, 120° ends in the second quadrant.",
    uses: ["angle", "vertex", "origin", "side", "x-axis", "quadrant"],
    band: "algebra-2",
  },
  {
    id: "terminal-side",
    term: "terminal side",
    forms: ["terminal side", "terminal sides", "initial side", "initial sides"],
    plain:
      "The ray where an angle in standard position stops after turning from its initial side on the positive $x$-axis.",
    example:
      "For 120° in standard position, the terminal side lies in the second quadrant.",
    uses: ["ray", "angle", "standard-position", "x-axis", "quadrant"],
    band: "algebra-2",
  },
  {
    id: "unit-circle",
    term: "unit circle",
    forms: ["unit circle"],
    plain:
      "The circle of radius 1 centered at (0, 0). An angle turned from the positive $x$-axis ends at the point $(\\cos\\theta, \\sin\\theta)$.",
    example:
      "At 90° the point is (0, 1), so $\\cos 90^\\circ=0$ and $\\sin 90^\\circ=1$.",
    uses: ["circle", "radius", "angle", "x-axis", "point", "cosine", "sine"],
    band: "algebra-2",
  },
];
