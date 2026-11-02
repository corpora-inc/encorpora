import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const r2fParabolaSenses = {
  vertex: "vertex-parabola",
  focus: "focus",
  side: "side",
  sides: "side",
  square: "square-shape",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};
const r2fSetSenses = {
  complement: "complement-probability",
  complements: "complement-probability",
  event: "event",
  events: "event",
  intersection: "intersection",
  intersections: "intersection",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};

export const regentsAlgebraTwoFunctionsMethods: Record<string, ProblemMethod> =
  {
    "normal-probability": {
      goal: "Turn values into $z$-scores and use technology to find the area between two values or above one value.",
      noLink: ["whole"],
      intuition:
        "In a normal distribution the share of values between two numbers is the area under the bell curve between them. A calculator or table gives the area below any value once you know how many standard deviations it is from the mean.",
      terms: [
        [
          "z-score",
          "$z = \\frac{x - \\mu}{\\sigma}$, with mean $\\mu$ and standard deviation $\\sigma$.",
        ],
        [
          "normal-distribution",
          "The mean is written $\\mu$ and the standard deviation $\\sigma$.",
        ],
      ],
      method: [
        "Find $z=\\frac{x-\\mu}{\\sigma}$ for each boundary value.",
        "Between two values: area below the larger minus area below the smaller. Above a value: 1 minus the area below it.",
        "For a count, multiply the area by the sample size and round at the end.",
      ],
      watch:
        "Divide by $\\sigma$, not $\\sigma^2$. The 68-95-99.7 rule, about 68%, 95% and 99.7% within 1, 2 and 3 standard deviations of the mean, gives approximate areas only for boundaries a whole number of standard deviations from the mean. For other boundaries, use technology.",
    },
    "tangent-quadrant-cosine": {
      goal: "Build a reference triangle from the tangent, find the hypotenuse, and choose the sign of cosine from the quadrant.",
      senses: {
        side: "side",
        sides: "side",
        squared: "square-number",
        root: "root-radical",
      },
      intuition:
        "For an angle in a quadrant, the reference triangle is the right triangle its ending side makes with the $x$-axis. Its legs are the two shorter sides, and its hypotenuse is the longest side. The tangent is the opposite leg divided by the adjacent leg, with a sign, so it gives the two legs. The hypotenuse is the square root of the legs squared and added. Cosine is the $x$-coordinate divided by the hypotenuse, so the quadrant tells whether it is positive or negative.",
      terms: [
        [
          "reference-angle",
          "The reference triangle is the right triangle the terminal side forms with the $x$-axis.",
        ],
        "rationalize",
      ],
      method: [
        "Take the opposite leg as the top of $|\\tan\\theta|$, the tangent without its sign. Take the adjacent leg as the bottom, which is 1 for a whole number.",
        "The hypotenuse is $\\sqrt{\\text{opp}^2+\\text{adj}^2}$. The size of cosine, $|\\cos\\theta|$, is $\\frac{\\text{adj}}{\\text{hyp}}$. Multiply its top and bottom by the root to clear the root from the bottom.",
        "Cosine is positive in Quadrants I and IV, where $x$ is positive. It is negative in Quadrants II and III.",
      ],
      watch:
        "Cosine uses the adjacent side. Choose the sign from the quadrant, not from the sign of the tangent.",
    },
    "special-angle-match": {
      goal: "Use reference angles, quadrant signs and cofunctions to match the exact value of a trigonometric expression.",
      senses: { plane: "plane" },
      noLink: ["part", "leaves", "change"],
      intuition:
        "Angles here are in radians: $\\pi$ radians is a half turn, $180^\\circ$. An obtuse angle, between $\\frac{\\pi}{2}$ and $\\pi$, ends in Quadrant II, the upper left. Its reference angle is the acute angle back to the $x$-axis: $\\pi$ minus the angle. The angle has the same sine as its reference angle and the opposite cosine, because $x$ is negative in Quadrant II. Also, for any angle $\\alpha$ (alpha), $\\sin\\alpha=\\cos\\left(\\frac{\\pi}{2}-\\alpha\\right)$. For an acute $\\alpha$, the angles $\\alpha$ and $\\frac{\\pi}{2}-\\alpha$ add up to a right angle. Together these let you write one value in several ways.",
      terms: [
        "reference-angle",
        [
          "cofunction-identity",
          "In radians: $\\sin\\theta=\\cos\\left(\\frac{\\pi}{2}-\\theta\\right)$.",
        ],
      ],
      method: [
        "Find the reference angle and the sign for the quadrant. In Quadrant II, sine has the sign of $y$, positive, and cosine has the sign of $x$, negative.",
        "Write the exact value of the expression.",
        "Find the exact value of each choice and compare. Only one matches in both size and sign.",
      ],
      watch:
        "Check the sign: cosine is negative in Quadrant II. Two expressions can have the same size but different signs.",
    },
    "odd-sine-parameters": {
      goal: "Use $f(-x)=-f(x)$ to decide which shifts keep a sine function odd.",
      senses: { opposite: "opposite-number", quarter: "fourth" },
      noLink: ["rule"],
      intuition:
        "An odd function has $f(-x)=-f(x)$ for every $x$. Its graph looks the same after a half turn about the origin $(0,0)$, and it passes through the origin if 0 is an allowed input. Sine has this symmetry. In $A\\sin(Bx-C)+D$ with $A\\ne0$ and $B>0$, the number $D$ slides the graph up or down, and $C$ slides it sideways by $\\frac{C}{B}$. Either slide usually breaks the symmetry. Angles are in radians: $\\pi$ radians is a half turn.",
      terms: [
        "odd-function",
        [
          "phase-shift",
          "For $\\sin(Bx-C)$ with $B>0$, the graph moves $\\frac{C}{B}$ to the right.",
        ],
      ],
      method: [
        "Compute $f(0)$. An odd function defined at 0 must give 0, because $f(0)=-f(0)$ only when $f(0)=0$.",
        "Test $f(-x)$ against $-f(x)$ with the given $C$ and $D$.",
        "A quarter-period phase shift, a slide by a quarter of one full wave, turns sine into cosine. Cosine is even, not odd.",
      ],
      watch:
        "A vertical shift $D\\ne0$ means the function cannot be odd. With $C=0$, it makes $f(0)=D$, not 0.",
    },
    "parabola-vertex-distance": {
      goal: "Place the vertex of a parabola halfway between its directrix (a line) and its focus (a point).",
      intuition:
        "A parabola is a U-shaped curve. It can be drawn from a point, called the focus, and a line, called the directrix: the parabola is every point that is the same distance from both. Its turning point is called the vertex. The vertex lies on the line through the focus that meets the directrix at a right angle (a square corner). Since the vertex is equally far from the focus and the directrix, it sits exactly halfway between them.",
      terms: [
        "directrix",
        [
          "axis-of-symmetry",
          "It also passes through the focus and is perpendicular to the directrix.",
        ],
      ],
      senses: r2fParabolaSenses,
      noLink: [
        "part",
        "parts",
        "change",
        "changes",
        "leaves",
        "key",
        "jumps",
        "jump",
        "third",
        "mean",
        "means",
        "sort",
        "image",
        "images",
        "solid",
        "scales",
        "net",
        "inverse",
        "population",
        "whole",
        "more than",
        "period",
        "periods",
        "quarter",
        "quarters",
        "one quarter",
        "mirror image",
        "rule",
        "rules",
        "opposite",
        "opposites",
        "unit",
        "units",
        "average",
        "decreasing",
        "increasing",
        "model",
        "models",
        "pattern",
        "patterns",
      ],
      method: [
        "Find the axis of symmetry: the line through the focus that meets the directrix at a right angle.",
        "Halve the distance from the directrix to the focus.",
        "Move that half-distance from the directrix toward the focus, along the axis.",
      ],
      watch:
        "The focus is the full distance from the directrix, and the vertex is half of it. Measure from the directrix, not from 0.",
    },
    "event-complement-set": {
      goal: "List the members of a complement, or of the complement of a union or intersection, in a sample space.",
      intuition:
        "The sample space $S$ is the list of every possible outcome. An event is a group of outcomes. Every outcome in $S$ that is not in $A$ is called the complement of $A$, written $A'$. The union $A \\cup B$ holds the outcomes in $A$ or $B$ or both. The intersection $A \\cap B$ holds the outcomes in both. To find the complement of a union or intersection, form it first, then list what is left over.",
      terms: ["complement-probability", "union", "intersection"],
      senses: r2fSetSenses,
      noLink: [
        "part",
        "parts",
        "change",
        "changes",
        "leaves",
        "key",
        "jumps",
        "jump",
        "third",
        "mean",
        "means",
        "sort",
        "image",
        "images",
        "solid",
        "scales",
        "net",
        "inverse",
        "population",
        "whole",
        "more than",
        "period",
        "periods",
        "quarter",
        "quarters",
        "one quarter",
        "mirror image",
        "rule",
        "rules",
        "opposite",
        "opposites",
        "unit",
        "units",
        "average",
        "decreasing",
        "increasing",
        "model",
        "models",
        "pattern",
        "patterns",
      ],
      method: [
        "If the question asks for the complement of a union or intersection, write that set first.",
        "Go through the sample space in order, and keep the members that are not in it.",
        "Check by counting: a set and its complement together list every member of $S$ exactly once.",
      ],
      watch:
        "The complement of a union is the outcomes in neither event, which is $A' \\cap B'$, not $A' \\cup B'$.",
    },
  };

export const regentsAlgebraTwoFunctionsPrinciples: Record<string, string> = {
  "normal-probability":
    "If $X$ is normal with mean $\\mu$ and standard deviation $\\sigma$, then $z=\\frac{X-\\mu}{\\sigma}$ is standard normal. $P(a<X<b)=\\Phi(z_b)-\\Phi(z_a)$ and $P(X>a)=1-\\Phi(z_a)$, where $\\Phi$ is the area to the left.",
  "tangent-quadrant-cosine":
    "Draw the angle $\\theta$ (theta) in standard position, starting on the positive $x$-axis. For a point $(x,y)$ other than the origin on its ending side, $r=\\sqrt{x^2+y^2}>0$, $\\cos\\theta=\\frac xr$, and $\\tan\\theta=\\frac yx$ when $x\\ne0$. The sign of $\\cos\\theta$ is the sign of $x$: positive in Quadrants I and IV.",
  "special-angle-match":
    "Let $\\alpha$ (alpha) be an angle with $0<\\alpha<\\frac{\\pi}{2}$. Then $\\sin(\\pi-\\alpha)=\\sin\\alpha$, $\\cos(\\pi-\\alpha)=-\\cos\\alpha$ and $\\sin\\alpha=\\cos\\left(\\frac{\\pi}{2}-\\alpha\\right)$.",
  "odd-sine-parameters":
    "A function is odd when $f(-x)=-f(x)$ for every $x$. For $f(x)=A\\sin(Bx-C)+D$ with $A\\ne0$ and $B\\ne0$, $f$ is odd exactly when $D=0$ and $C$ is an integer multiple of $\\pi$, such as $-\\pi$, 0 or $\\pi$. The choices here use $C=0$ as the only such value.",
  "parabola-vertex-distance":
    "A parabola with focus $F$ and directrix $\\ell$ is the set of points the same distance from both. Its vertex lies on the line through $F$ at a right angle to $\\ell$, halfway between $F$ and $\\ell$.",
  "event-complement-set":
    "For events $A$ and $B$ in a sample space $S$: $A'$ is everything in $S$ that is not in $A$. Also $(A \\cup B)' = A' \\cap B'$ and $(A \\cap B)' = A' \\cup B'$. These two rules are called De Morgan's laws.",
};

export const regentsAlgebraTwoFunctionsLessons = [
  chainLesson({
    id: "regents-normal-probability",
    title: "Normal probabilities with technology",
    summary:
      "Many measurements, such as test scores, follow a bell-shaped pattern called a normal distribution. The share of values between two numbers is the area under the bell curve between them. A calculator gives that area, which turns into a percent, or a count when multiplied by the group size.",
    templateIds: ["normal-probability"],
    senses: { mean: "mean-average", interval: "interval" },
    noLink: ["rule"],
    objectives: [
      "Convert values to $z$-scores.",
      "Use areas to find a percent between two values or a count above one.",
    ],
    openingTitle: "Share of values is area under the curve",
    opening: [
      "A normal distribution is a symmetric bell curve with a mean $\\mu$ and a standard deviation $\\sigma$. The share of values in an interval equals the area under the curve over that interval.",
      "A $z$-score tells how many standard deviations a value is from the mean. A calculator or table gives the area below a $z$-score.",
    ],
    example: {
      prompt:
        "Scores are normal with mean 70 and standard deviation 10. What percent are between 60 and 85?",
      steps: [
        "$z_{60}=-1$ and $z_{85}=1.5$.",
        "Area below $1.5$: $0.9332$. Area below $-1$: $0.1587$.",
        "$0.9332-0.1587=0.7745$, about $77.5\\%$.",
      ],
      answer: "$77.5\\%$",
    },
    methodTitle: "Standardize, then subtract areas",
    method: [
      "Compute each $z$.",
      "Between: subtract the smaller area from the larger. Above: subtract the area from 1.",
      "Round only at the end.",
    ],
    formalTitle: "The model",
    formal: [
      "If $X$ is normal$(\\mu,\\sigma)$ then $Z=\\frac{X-\\mu}{\\sigma}$ is standard normal, and $P(a<X<b)=\\Phi(z_b)-\\Phi(z_a)$.",
      "The 68-95-99.7 rule is the special case of $z=\\pm1,\\pm2,\\pm3$.",
    ],
    pitfalls: [
      "Divide by $\\sigma$, not by $\\sigma^2$.",
      "The area below the larger value includes the area below the smaller value; subtract it.",
      "The empirical rule does not give areas at non-whole $z$.",
    ],
    parentGuide:
      "Ask your learner to sketch the bell curve and shade the region before using a calculator.",
  }),
  chainLesson({
    id: "regents-tangent-quadrant-cosine",
    title: "Cosine from tangent and quadrant",
    summary:
      "An angle $\\theta$ (theta) starts on the positive $x$-axis and turns about the origin. Take a point $(x, y)$ on its ending side, a distance $r$ from the origin. Then its tangent is $\\tan\\theta = \\frac{y}{x}$, and its cosine is $\\cos\\theta = \\frac{x}{r}$. For example, $\\tan\\theta = -2$ in Quadrant II, the upper left, fits the point $(-1, 2)$. Its distance is $r = \\sqrt{1 + 4} = \\sqrt{5}$, so $\\cos\\theta = -\\frac{1}{\\sqrt5}$.",
    templateIds: ["tangent-quadrant-cosine"],
    senses: {
      side: "side",
      sides: "side",
      tangent: "tangent-trig",
      "opposite leg": "opposite-side-angle",
      squared: "square-number",
      plane: "plane",
      root: "root-radical",
    },
    noLink: ["change", "opposite"],
    objectives: [
      "Build a reference triangle from a tangent value.",
      "Find the exact cosine, rationalize, and choose the sign by quadrant.",
    ],
    openingTitle: "Tangent gives the legs, quadrant gives the sign",
    opening: [
      "In a right triangle, the hypotenuse is the longest side, across from the right angle. The other two sides are the legs. For an acute angle, the tangent is the opposite leg (across from the angle) divided by the adjacent leg (next to it). A tangent of 6 fits legs 6 and 1, or any pair in the same ratio, such as 12 and 2. The Pythagorean theorem says the two legs squared add up to the hypotenuse squared. So the hypotenuse is $\\sqrt{6^2+1^2}=\\sqrt{37}$.",
      "The cosine is the adjacent leg divided by the hypotenuse. For an angle drawn on the coordinate plane, the reference triangle is the right triangle its ending side makes with the $x$-axis. Its horizontal leg is $|x|$, the size of $x$, and its hypotenuse is $r$. So cosine is $\\frac{x}{r}$, which has the sign of $x$. The axes cut the plane into four quadrants, numbered I to IV counterclockwise from the upper right. $x$ is negative in Quadrants II and III, so cosine is negative there.",
    ],
    example: {
      prompt:
        "Angle $\\theta$ is in Quadrant II and $\\tan\\theta=-2$. Find $\\cos\\theta$.",
      steps: [
        "In Quadrant II, $x$ is negative and $y$ is positive. $\\tan\\theta=\\frac{y}{x}=-2$ fits $y=2$ and $x=-1$. So the reference triangle has legs 2 and 1.",
        "The legs squared add up to the hypotenuse squared, so the hypotenuse is $\\sqrt{2^2+1^2}=\\sqrt5$.",
        "Cosine is adjacent over hypotenuse, so its size is $\\frac{1}{\\sqrt5}$. Multiply the top and bottom by $\\sqrt5$ to clear the root from the bottom: $\\frac{\\sqrt5}{5}$.",
        "In Quadrant II, $x$ is negative, so cosine is negative: $\\cos\\theta=-\\frac{\\sqrt5}{5}$.",
      ],
      answer: "$-\\dfrac{\\sqrt5}{5}$",
    },
    methodTitle: "Legs, hypotenuse, sign",
    method: [
      "Read the legs from the tangent: the opposite leg is the top of $|\\tan\\theta|$, the tangent without its sign. The adjacent leg is the bottom, which is 1 for a whole number.",
      "Find the hypotenuse: the square root of the two legs squared and added.",
      "Divide the adjacent leg by the hypotenuse, and clear any root from the bottom. Give the result the sign of $x$ in that quadrant.",
    ],
    formalTitle: "Coordinates",
    formal: [
      "For a point $(x,y)$ other than the origin on the ending side of $\\theta$: $r=\\sqrt{x^2+y^2}$, $\\cos\\theta=\\frac xr$, and $\\tan\\theta=\\frac yx$ when $x\\ne0$.",
      "For $n>0$, $\\frac{1}{\\sqrt n}=\\frac{\\sqrt n}{n}$. Multiplying the top and bottom by $\\sqrt n$ does not change the value.",
    ],
    pitfalls: [
      "Adjacent over hypotenuse is cosine. Opposite over hypotenuse is sine.",
      "A negative tangent alone does not decide the sign of cosine. It only says the angle is in Quadrant II or IV.",
    ],
    parentGuide:
      "Ask your learner to draw the angle in its quadrant and label the coordinates' signs.",
  }),
  chainLesson({
    id: "regents-special-angle-match",
    title: "Equal values at special angles",
    summary:
      "Different angles can have the same sine or cosine. For example, $\\sin 150^\\circ = \\sin 30^\\circ = \\frac12$, and $\\cos 60^\\circ$ is also $\\frac12$. To match two expressions, find the exact value of each and compare. The size comes from the reference angle, the acute angle back to the $x$-axis. The sign comes from the quadrant the angle ends in.",
    templateIds: ["special-angle-match"],
    senses: { quarter: "fourth", square: "square-number" },
    noLink: ["change", "complement"],
    objectives: [
      "Use reference angles and quadrant signs.",
      "Use the cofunction identity to rewrite sine as cosine.",
    ],
    openingTitle: "Reference angle, sign, cofunction",
    opening: [
      "This lesson measures angles in radians: a half turn is $\\pi$ radians, the same as $180^\\circ$. So $\\frac{\\pi}{2}$ is a quarter turn, $90^\\circ$. The angle $\\frac{2\\pi}{3}$ is between $\\frac{\\pi}{2}$ and $\\pi$, so it ends in Quadrant II, the upper left.",
      "The reference angle of $\\frac{2\\pi}{3}$ is $\\pi-\\frac{2\\pi}{3}=\\frac{\\pi}{3}$. Sine and cosine have the same size as at the reference angle, and only the sign can change. Sine, the $y$-coordinate, is positive in Quadrant II. So $\\sin\\frac{2\\pi}{3}=\\sin\\frac{\\pi}{3}=\\frac{\\sqrt3}{2}$, where $\\sqrt3$ is the positive number whose square is 3.",
      "Two angles are complementary when they add up to $\\frac{\\pi}{2}$, a right angle. The sine of an angle equals the cosine of its complement: $\\sin\\alpha=\\cos\\left(\\frac{\\pi}{2}-\\alpha\\right)$, where $\\alpha$ (alpha) names the angle. This is called the cofunction identity. So $\\frac{\\sqrt3}{2}=\\sin\\frac{\\pi}{3}$ is also $\\cos\\frac{\\pi}{6}$.",
    ],
    example: {
      prompt:
        "Which equals $\\sin\\frac{2\\pi}{3}$: $\\cos\\frac{\\pi}{6}$ or $\\cos\\frac{\\pi}{3}$?",
      steps: [
        "The reference angle of $\\frac{2\\pi}{3}$ is $\\frac{\\pi}{3}$, and sine is positive in Quadrant II. So $\\sin\\frac{2\\pi}{3}=\\sin\\frac{\\pi}{3}=\\frac{\\sqrt3}{2}$.",
        "Find each choice from the right triangle with angles $\\frac{\\pi}{6}$, $\\frac{\\pi}{3}$ and $\\frac{\\pi}{2}$ ($30^\\circ$, $60^\\circ$ and $90^\\circ$): $\\cos\\frac{\\pi}{6}=\\frac{\\sqrt3}{2}$ and $\\cos\\frac{\\pi}{3}=\\frac12$.",
        "Only $\\cos\\frac{\\pi}{6}$ has the same value and sign, $\\frac{\\sqrt3}{2}$.",
      ],
      answer: "$\\cos\\frac{\\pi}{6}$",
    },
    methodTitle: "Exact values side by side",
    method: [
      "Find the exact value of the given expression, from its reference angle and its quadrant's sign.",
      "Find the exact value of each choice the same way.",
      "Keep the choice that matches in both size and sign.",
    ],
    formalTitle: "Identities",
    formal: [
      "For every angle $\\alpha$: $\\sin(\\pi-\\alpha)=\\sin\\alpha$ and $\\cos(\\pi-\\alpha)=-\\cos\\alpha$.",
      "Also $\\sin\\alpha=\\cos\\left(\\frac{\\pi}{2}-\\alpha\\right)$ for every angle $\\alpha$.",
    ],
    pitfalls: [
      "Cosine, the $x$-coordinate, is negative in Quadrant II.",
      "Do not match only the size. The sign must agree too.",
    ],
    parentGuide:
      "Ask your learner to write the exact value next to every choice.",
  }),
  chainLesson({
    id: "regents-odd-sine-parameters",
    title: "When is a sine function odd?",
    summary:
      "A function is called odd when $f(-x) = -f(x)$ for every $x$. Its graph looks the same after a half turn about the origin $(0, 0)$. The sine function is odd: $\\sin(-x) = -\\sin x$. Sliding its graph up, down or sideways can break this symmetry. This lesson finds which slides keep $f(x)=A\\sin(Bx-C)+D$ odd.",
    templateIds: ["odd-sine-parameters"],
    senses: {
      opposite: "opposite-number",
      quarter: "fourth",
      period: "period",
    },
    objectives: [
      "State and test $f(-x)=-f(x)$.",
      "Explain why a vertical or quarter-period shift removes oddness.",
    ],
    openingTitle: "Symmetry about the origin",
    opening: [
      "An odd function has $f(-x)=-f(x)$ for every $x$ in its domain, its set of allowed inputs. If 0 is an allowed input, put in $x=0$: $f(0)=-f(0)$. Only 0 equals its own opposite, so $f(0)=0$. Angles here are in radians, where $\\pi$ radians is a half turn. Sine is odd: for example, $\\sin\\left(-\\frac{\\pi}{2}\\right)=-1=-\\sin\\frac{\\pi}{2}$.",
      "In $f(x)=A\\sin(Bx-C)+D$, the number $D$ is a vertical shift: it slides the graph up or down. Shifting $A\\sin(Bx)$ up by $D$ breaks the symmetry, because $f(0)$ becomes $D$, not 0. Here $A\\ne0$ and $B>0$. The number $C$ slides the graph sideways by $\\frac{C}{B}$, which is called a phase shift. Sliding by a quarter of one full wave, a quarter period, turns sine into cosine. Cosine is even, $\\cos(-x)=\\cos x$, so it is not odd.",
    ],
    example: {
      prompt: "Is $f(x)=2\\sin(3x)+1$ odd?",
      steps: [
        "An odd function must have $f(0)=0$, so test $x=0$ first.",
        "$\\sin 0=0$, so $f(0)=2 \\cdot 0+1=1$. This is not 0.",
        "So $f$ is not odd. The $+1$, a vertical shift, broke the symmetry.",
      ],
      answer: "No",
    },
    methodTitle: "Test the origin, then the symmetry",
    method: [
      "Check whether $f(0)=0$. If it is not, the function is not odd.",
      "If $f(0)=0$, compare $f(-x)$ with $-f(x)$ for every $x$.",
      "Name the effect of each shift: $D\\ne0$ slides the graph up or down, and a quarter-period phase shift turns sine into cosine.",
    ],
    formalTitle: "Definition and conditions",
    formal: [
      "$f$ is odd if $f(-x)=-f(x)$ for all $x$ in its domain.",
      "Since $\\sin(-u)=-\\sin u$ for every $u$, $A\\sin(Bx)$ is odd for all numbers $A$ and $B$.",
    ],
    pitfalls: [
      "Taking $C=\\frac{\\pi}{2}$ turns $\\sin(Bx-C)$ into $-\\cos(Bx)$, an even function, not an odd one.",
      "A vertical shift $D\\ne0$ never gives an odd function. With $C=0$, it makes $f(0)=D$, not 0.",
    ],
    parentGuide:
      "Ask your learner what the graph does at $x=0$ for each choice.",
  }),
  {
    ...chainLesson({
      id: "regents-parabola-vertex-distance",
      title: "Vertex halfway to the directrix",
      summary:
        "A parabola is a U-shaped curve. It can be built from a point, called the focus, and a line, called the directrix. Every point on the curve is the same distance from the focus as from the line. The vertex is the turning point of the curve, so it is exactly halfway between the focus and the line.",
      templateIds: ["parabola-vertex-distance"],
      objectives: [
        "Find the axis of symmetry from the focus and the directrix.",
        "Place the vertex halfway between the focus and the directrix.",
      ],
      openingTitle: "Equal distance from focus and line",
      opening: [
        "A parabola is a U-shaped curve. One way to describe it uses a point, called the focus, and a line, called the directrix. The parabola is every point that is the same distance from the focus as from the directrix.",
        "The distance from a point to a line is measured straight across, along a path that meets the line at a right angle (a square corner). Lines that meet at a right angle are called perpendicular.",
        "The vertex is the turning point of the parabola, the point nearest the directrix. It lies on the line through the focus that is perpendicular to the directrix. That line splits the parabola into two mirror halves, so it is called the axis of symmetry.",
        "The vertex is on the parabola, so it is the same distance from the focus as from the directrix. On the axis, the only such point is the one exactly halfway between them.",
      ],
      example: {
        prompt:
          "The directrix is $y=1$ and the focus is 6 units above it on $x=2$. Where is the vertex?",
        steps: [
          "The directrix $y = 1$ is a horizontal line. The axis of symmetry goes through the focus at a right angle to it, so it is the vertical line $x = 2$.",
          "The focus is 6 units above the directrix. The vertex is halfway, so it is $6 \\div 2 = 3$ units above the directrix.",
          "Count up 3 from the directrix along $x = 2$: $y = 1 + 3 = 4$. So the vertex is at $(2, 4)$.",
        ],
        answer: "$(2,\\ 4)$",
      },
      methodTitle: "Half the distance",
      method: [
        "Draw the axis of symmetry: the line through the focus, perpendicular to the directrix.",
        "Take half the distance from the directrix to the focus, and measure it from the directrix toward the focus.",
      ],
      formalTitle: "Why halfway",
      formal: [
        "Let the focus be $f$ units from the directrix. Take a point on the axis between them, $t$ units from the directrix. It is then $f - t$ units from the focus.",
        "The point is on the parabola when the two distances are equal: $t = f - t$. Adding $t$ to both sides gives $2t = f$, so $t = \\frac{f}{2}$.",
      ],
      pitfalls: [
        "The focus is the full distance from the directrix. The vertex is only half of it.",
        "The vertex is on the same side of the directrix as the focus.",
      ],
      parentGuide:
        "Ask your learner to sketch the directrix, the focus and the point halfway between them, then to explain why that point is on the curve.",
    }),
    senses: r2fParabolaSenses,
    noLink: [
      "part",
      "parts",
      "change",
      "changes",
      "leaves",
      "key",
      "jumps",
      "jump",
      "third",
      "mean",
      "means",
      "sort",
      "image",
      "images",
      "solid",
      "scales",
      "net",
      "inverse",
      "population",
      "whole",
      "more than",
      "period",
      "periods",
      "quarter",
      "quarters",
      "one quarter",
      "mirror image",
      "rule",
      "rules",
      "opposite",
      "opposites",
      "unit",
      "units",
      "average",
      "decreasing",
      "increasing",
      "model",
      "models",
      "pattern",
      "patterns",
    ],
  },
  {
    ...chainLesson({
      id: "regents-event-complement-set",
      title: "Complements of events as sets",
      summary:
        "Roll a number from 1 to 5. A group of possible results is called an event. If event $A$ is “roll a 1 or a 2”, then the rolls not in $A$ are 3, 4 and 5. Those leftover outcomes are called the complement of $A$, written $A'$. This lesson lists complements, including the complement of “in $A$ or $B$” and of “in both $A$ and $B$”.",
      templateIds: ["event-complement-set"],
      objectives: [
        "List the complement of an event from a sample space.",
        "Find the complement of a union (in either event) or an intersection (in both events).",
      ],
      openingTitle: "What is left over",
      opening: [
        "An outcome is one possible result, like rolling a 3. The sample space $S$ is the set of all outcomes. Curly brackets list the members of a set: $S = \\{1, 2, 3, 4, 5\\}$. An event is a group of outcomes, such as $A = \\{1, 2\\}$.",
        "The complement of $A$, written $A'$, is every outcome in $S$ that is not in $A$. Here $A' = \\{3, 4, 5\\}$.",
        "The union $A \\cup B$ holds the outcomes in $A$ or in $B$ or in both. The outcomes in both are called the intersection, $A \\cap B$.",
        "To find the complement of a union or an intersection, form that set first. Then list what is left over in $S$.",
      ],
      example: {
        prompt:
          "$S=\\{1,2,3,4,5\\}$, $A=\\{1,2\\}$, $B=\\{2,3\\}$. Find $(A\\cup B)'$.",
        steps: [
          "Form the union first: the outcomes in $A$ or $B$ are 1, 2 and 3. So $A \\cup B = \\{1, 2, 3\\}$. List 2 only once.",
          "Go through $S$ and keep what is not in the union: 4 and 5. So $(A \\cup B)' = \\{4, 5\\}$.",
          "Check by counting: $\\{1, 2, 3\\}$ and $\\{4, 5\\}$ together list all five outcomes, each once.",
        ],
        answer: "$\\{4,5\\}$",
      },
      methodTitle: "Form the set, then complement",
      method: [
        "If needed, write $A \\cup B$ or $A \\cap B$ first.",
        "Go through $S$ and keep the members that are outside that set.",
      ],
      formalTitle: "De Morgan's laws",
      formal: [
        "Two rules connect complements with unions and intersections: $(A \\cup B)' = A' \\cap B'$ and $(A \\cap B)' = A' \\cup B'$. They are called De Morgan's laws. In words, “not in either” means “outside $A$ and outside $B$”.",
        "A complement is always taken within the sample space $S$.",
      ],
      pitfalls: [
        "The complement of a union is the outcomes outside both events.",
        "Do not list a member of $A$ in $A'$.",
      ],
      parentGuide:
        "Ask your learner to write out the sample space and cross out members as they are removed.",
    }),
    senses: r2fSetSenses,
    noLink: [
      "part",
      "parts",
      "change",
      "changes",
      "leaves",
      "key",
      "jumps",
      "jump",
      "third",
      "mean",
      "means",
      "sort",
      "image",
      "images",
      "solid",
      "scales",
      "net",
      "inverse",
      "population",
      "whole",
      "more than",
      "period",
      "periods",
      "quarter",
      "quarters",
      "one quarter",
      "mirror image",
      "rule",
      "rules",
      "opposite",
      "opposites",
      "unit",
      "units",
      "average",
      "decreasing",
      "increasing",
      "model",
      "models",
      "pattern",
      "patterns",
    ],
  },
];

const m = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({ templateId, facetId, extent: "partial", rationale });
export const regentsAlgebraTwoFunctionsFacetMappings: FacetMapping[] = [
  m(
    "normal-probability",
    "normal-distributions.HSS.ID.A.4",
    "Single choice for the percent between two values or the expected count above a value in a stated normal model, found with a calculator or table, rounded as stated. Does not assess reading a table, inverse normal values, or explaining the model's fit.",
  ),
  m(
    "tangent-quadrant-cosine",
    "trigonometric-identities.core",
    "Single choice for the exact, rationalized cosine from a tangent in Quadrant II, III or IV. Does not assess other functions from a given function, the Pythagorean identity by name, or angles in radians.",
  ),
  m(
    "special-angle-match",
    "trigonometric-symmetry.core",
    "Single choice for expressions equal to the sine or cosine of $\\frac{2\\pi}{3}$, $\\frac{3\\pi}{4}$ or $\\frac{5\\pi}{6}$. Does not assess tangent targets, angles beyond Quadrant II, or radian conversion.",
  ),
  m(
    "odd-sine-parameters",
    "trigonometric-graphs.core",
    "Single choice for the phase shift and vertical shift that make a sine function odd. Does not assess even or neither classification of other functions, or drawing the graph.",
  ),
  m(
    "parabola-vertex-distance",
    "parabola-locus.core",
    "Single choice for the vertex given a horizontal or vertical directrix and the distance to a focus on a stated side and line. Does not assess writing the equation, finding the focus from an equation, or the locus definition proof.",
  ),
  m(
    "event-complement-set",
    "event-sets.set-operations",
    "Single choice for $A'$, $(A\\cup B)'$ and $(A\\cap B)'$ in a sample space of 7 to 9 named outcomes. Does not assess probabilities of events, Venn diagrams, or counting.",
  ),
];
