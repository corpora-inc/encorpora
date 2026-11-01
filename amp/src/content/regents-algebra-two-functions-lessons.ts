import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const r2fParabolaSenses = {
  vertex: "vertex-parabola",
  focus: "focus",
  side: "side",
  sides: "side",
  square: "square-shape",
  unit: "unit",
  units: "unit",
  average: "mean-average",
  base: "base-exponent",
  bases: "base-exponent",
  opposite: "opposite-number",
  opposites: "opposite-number",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  decreasing: "decreasing",
  increasing: "increasing",
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
  unit: "unit",
  units: "unit",
  average: "mean-average",
  base: "base-exponent",
  bases: "base-exponent",
  opposite: "opposite-number",
  opposites: "opposite-number",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  decreasing: "decreasing",
  increasing: "increasing",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};

export const regentsAlgebraTwoFunctionsMethods: Record<string, ProblemMethod> =
  {
    "normal-probability": {
      goal: "Turn values into $z$-scores and use technology to find the area between two values or above one value.",
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
        "Divide by $\\sigma$, not $\\sigma^2$. The 68-95-99.7 rule gives the area only at whole numbers of standard deviations.",
    },
    "tangent-quadrant-cosine": {
      goal: "Build a reference triangle from the tangent, find the hypotenuse, and choose the sign of cosine from the quadrant.",
      intuition:
        "The tangent is opposite over adjacent, so it gives the two legs of a reference triangle. The hypotenuse follows from the Pythagorean theorem, and the quadrant tells whether cosine, the horizontal coordinate, is positive or negative.",
      terms: [
        [
          "reference-angle",
          "The reference triangle is the right triangle the terminal side forms with the $x$-axis.",
        ],
        "rationalize",
      ],
      method: [
        "Take opposite $=|\\tan\\theta|$ numerator and adjacent $=$ denominator (1 for an integer).",
        "Hypotenuse $=\\sqrt{\\text{opp}^2+\\text{adj}^2}$ and $|\\cos\\theta|=\\frac{\\text{adj}}{\\text{hyp}}$, rationalized.",
        "Cosine is positive in Quadrants I and IV, negative in II and III.",
      ],
      watch:
        "Cosine uses the adjacent side. Choose the sign from the quadrant, not from the sign of the tangent.",
    },
    "special-angle-match": {
      goal: "Use reference angles, quadrant signs and cofunctions to match the exact value of a trigonometric expression.",
      intuition:
        "An obtuse angle has the same sine as its reference angle and the opposite cosine. The sine of an angle also equals the cosine of its complement. Together these let you rewrite one expression in many equal ways.",
      terms: [
        "reference-angle",
        [
          "cofunction-identity",
          "In radians: $\\sin\\theta=\\cos\\left(\\frac{\\pi}{2}-\\theta\\right)$.",
        ],
      ],
      method: [
        "Find the reference angle and the sign for the quadrant.",
        "Write the exact value of the expression.",
        "Compare it with the exact value of each choice; only one matches.",
      ],
      watch:
        "Check the sign: cosine is negative in Quadrant II. Two functions can share a magnitude but differ in sign.",
    },
    "odd-sine-parameters": {
      goal: "Use $f(-x)=-f(x)$ to decide which shifts keep a sine function odd.",
      intuition:
        "An odd function is symmetric about the origin: its graph passes through $(0,0)$ and turns into itself when rotated half a turn. Sine has this symmetry; moving the graph up or sideways usually destroys it.",
      terms: [
        "odd-function",
        [
          "phase-shift",
          "For $\\sin(Bx-C)$ with $B>0$, the graph moves $\\frac{C}{B}$ to the right.",
        ],
      ],
      method: [
        "Compute $f(0)$: an odd function must give 0.",
        "Test $f(-x)$ against $-f(x)$ with the given $C$ and $D$.",
        "Remember that a quarter-period phase shift turns sine into cosine, which is even.",
      ],
      watch:
        "A vertical shift makes $f(0)\\ne0$, so the function cannot be odd.",
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
        "The sample space $S$ is the list of every possible outcome. An event is a group of outcomes. The complement of event $A$, written $A'$, is every outcome in $S$ that is not in $A$. The union $A \\cup B$ holds the outcomes in $A$ or $B$ or both. The intersection $A \\cap B$ holds the outcomes in both. To find the complement of a union or intersection, form it first, then list what is left over.",
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
    "For an angle in standard position, $\\tan\\theta=\\frac yx$, $\\cos\\theta=\\frac xr$ and $r=\\sqrt{x^2+y^2}>0$. The sign of $\\cos\\theta$ is the sign of $x$: positive in Quadrants I and IV.",
  "special-angle-match":
    "For $0<\\alpha<\\frac{\\pi}{2}$: $\\sin(\\pi-\\alpha)=\\sin\\alpha$, $\\cos(\\pi-\\alpha)=-\\cos\\alpha$ and $\\sin\\alpha=\\cos(\\frac{\\pi}{2}-\\alpha)$.",
  "odd-sine-parameters":
    "A function is odd when $f(-x)=-f(x)$. For $f(x)=A\\sin(Bx-C)+D$ with $A,B\\ne0$, $f$ is odd exactly when $D=0$ and $C$ is a multiple of $\\pi$. The choices here use $C=0$ as the only such value.",
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
      "Find the share between two values, or the count above one, in a normal distribution.",
    templateIds: ["normal-probability"],
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
      "Use a reference triangle and the quadrant to find an exact cosine.",
    templateIds: ["tangent-quadrant-cosine"],
    objectives: [
      "Build a reference triangle from a tangent value.",
      "Find the exact cosine, rationalize, and choose the sign by quadrant.",
    ],
    openingTitle: "Tangent gives the legs, quadrant gives the sign",
    opening: [
      "In a right triangle, tangent is opposite over adjacent. A tangent of 6 means legs 6 and 1 (or any proportional pair). The hypotenuse follows from the Pythagorean theorem.",
      "Cosine is adjacent over hypotenuse. In standard position cosine is the $x$-coordinate over the radius, so it is negative in Quadrants II and III.",
    ],
    example: {
      prompt:
        "Angle $\\theta$ is in Quadrant II and $\\tan\\theta=-2$. Find $\\cos\\theta$.",
      steps: [
        "Legs 2 and 1, hypotenuse $\\sqrt5$.",
        "$|\\cos\\theta|=\\frac1{\\sqrt5}=\\frac{\\sqrt5}{5}$.",
        "Cosine is negative in Quadrant II: $-\\frac{\\sqrt5}{5}$.",
      ],
      answer: "$-\\dfrac{\\sqrt5}{5}$",
    },
    methodTitle: "Legs, hypotenuse, sign",
    method: [
      "Legs from the tangent.",
      "Hypotenuse by the Pythagorean theorem.",
      "Cosine as adjacent over hypotenuse, rationalized, with the quadrant's sign.",
    ],
    formalTitle: "Coordinates",
    formal: [
      "For a point $(x,y)$ on the terminal side, $r=\\sqrt{x^2+y^2}$, $\\tan\\theta=\\frac yx$, $\\cos\\theta=\\frac xr$.",
      "$\\frac{1}{\\sqrt n}=\\frac{\\sqrt n}{n}$ for $n>0$.",
    ],
    pitfalls: [
      "Adjacent over hypotenuse is cosine; opposite over hypotenuse is sine.",
      "A negative tangent does not by itself make cosine negative: it is Quadrant II or IV.",
    ],
    parentGuide:
      "Ask your learner to draw the angle in its quadrant and label the coordinates' signs.",
  }),
  chainLesson({
    id: "regents-special-angle-match",
    title: "Equal values at special angles",
    summary:
      "Match the sine or cosine of an obtuse special angle with another expression.",
    templateIds: ["special-angle-match"],
    objectives: [
      "Use reference angles and quadrant signs.",
      "Use the cofunction identity to rewrite sine as cosine.",
    ],
    openingTitle: "Reference angle, sign, cofunction",
    opening: [
      "The angle $\\frac{2\\pi}{3}$ is in Quadrant II. Its reference angle is $\\pi-\\frac{2\\pi}{3}=\\frac{\\pi}{3}$. Sine is positive in Quadrant II, so $\\sin\\frac{2\\pi}{3}=\\sin\\frac{\\pi}{3}=\\frac{\\sqrt3}{2}$.",
      "Sine and cosine are cofunctions: $\\sin\\alpha=\\cos\\left(\\frac{\\pi}{2}-\\alpha\\right)$. So $\\frac{\\sqrt3}{2}$ is also $\\cos\\frac{\\pi}{6}$.",
    ],
    example: {
      prompt:
        "Which equals $\\sin\\frac{2\\pi}{3}$: $\\cos\\frac{\\pi}{6}$ or $\\cos\\frac{\\pi}{3}$?",
      steps: [
        "$\\sin\\frac{2\\pi}{3}=\\frac{\\sqrt3}{2}$.",
        "$\\cos\\frac{\\pi}{6}=\\frac{\\sqrt3}{2}$ and $\\cos\\frac{\\pi}{3}=\\frac12$.",
      ],
      answer: "$\\cos\\frac{\\pi}{6}$",
    },
    methodTitle: "Exact values side by side",
    method: [
      "Exact value of the target.",
      "Exact value of each choice.",
      "Keep the one that matches in size and sign.",
    ],
    formalTitle: "Identities",
    formal: [
      "$\\sin(\\pi-\\alpha)=\\sin\\alpha$, $\\cos(\\pi-\\alpha)=-\\cos\\alpha$.",
      "$\\sin\\alpha=\\cos(\\frac{\\pi}{2}-\\alpha)$.",
    ],
    pitfalls: [
      "Cosine is negative in Quadrant II.",
      "Do not match only the magnitude; the sign must agree.",
    ],
    parentGuide:
      "Ask your learner to write the exact value next to every choice.",
  }),
  chainLesson({
    id: "regents-odd-sine-parameters",
    title: "When is a sine function odd?",
    summary: "Decide which shifts of $A\\sin(Bx-C)+D$ keep it odd.",
    templateIds: ["odd-sine-parameters"],
    objectives: [
      "State and test $f(-x)=-f(x)$.",
      "Explain why a vertical or quarter-period shift removes oddness.",
    ],
    openingTitle: "Symmetry about the origin",
    opening: [
      "An odd function satisfies $f(-x)=-f(x)$, so its graph is unchanged by a half-turn about the origin. Sine is odd.",
      "Shifting a sine graph up breaks this because $f(0)$ is no longer 0. Shifting it a quarter period sideways turns it into a cosine, which is even.",
    ],
    example: {
      prompt: "Is $f(x)=2\\sin(3x)+1$ odd?",
      steps: [
        "$f(0)=1\\ne0$.",
        "An odd function must have $f(0)=0$, so $f$ is not odd.",
      ],
      answer: "No",
    },
    methodTitle: "Test the origin, then the symmetry",
    method: [
      "Check $f(0)=0$.",
      "Compare $f(-x)$ with $-f(x)$.",
      "Name the effect of each shift.",
    ],
    formalTitle: "Definition and conditions",
    formal: [
      "$f$ is odd if $f(-x)=-f(x)$ for all $x$ in the domain.",
      "Since $\\sin(-u)=-\\sin u$, $A\\sin(Bx)$ is odd for every $A,B$.",
    ],
    pitfalls: [
      "A phase shift of $\\frac{\\pi}{2}$ gives an even function.",
      "A vertical shift $D\\ne0$ is never odd.",
    ],
    parentGuide:
      "Ask your learner what the graph does at $x=0$ for each choice.",
  }),
  {
    ...chainLesson({
      id: "regents-parabola-vertex-distance",
      title: "Vertex halfway to the directrix",
      summary:
        "A parabola is a U-shaped curve. It can be built from a point, called the focus, and a line, called the directrix. Every point on the curve is the same distance from the focus as from the line. The turning point of the curve, called the vertex, is therefore exactly halfway between the focus and the line.",
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
    ],
  },
  {
    ...chainLesson({
      id: "regents-event-complement-set",
      title: "Complements of events as sets",
      summary:
        "Roll a number from 1 to 5. If event $A$ is “roll a 1 or a 2”, then the rolls not in $A$ are 3, 4 and 5. Those leftover outcomes are called the complement of $A$, written $A'$. This lesson lists complements, including the complement of “in $A$ or $B$” and of “in both $A$ and $B$”.",
      templateIds: ["event-complement-set"],
      objectives: [
        "List the complement of an event from a sample space.",
        "Find the complement of a union (in either event) or an intersection (in both events).",
      ],
      openingTitle: "What is left over",
      opening: [
        "An outcome is one possible result, like rolling a 3. The sample space $S$ is the set of all outcomes. Curly brackets list the members of a set: $S = \\{1, 2, 3, 4, 5\\}$. An event is a group of outcomes, such as $A = \\{1, 2\\}$.",
        "The complement of $A$, written $A'$, is every outcome in $S$ that is not in $A$. Here $A' = \\{3, 4, 5\\}$.",
        "The union $A \\cup B$ holds the outcomes in $A$ or in $B$ or in both. The intersection $A \\cap B$ holds only the outcomes in both.",
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
