import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

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
      goal: "Place the vertex halfway between the directrix and the focus along the axis of symmetry.",
      intuition:
        "A parabola is the set of points equally far from the focus and the directrix. The vertex is the point of the parabola closest to both, so it sits exactly halfway between them on the axis of symmetry.",
      terms: [
        "directrix",
        [
          "axis-of-symmetry",
          "It also passes through the focus and is perpendicular to the directrix.",
        ],
      ],
      method: [
        "Find the axis: the line through the focus perpendicular to the directrix.",
        "Halve the distance from the directrix to the focus.",
        "Move that half-distance from the directrix toward the focus along the axis.",
      ],
      watch:
        "The focus is at the full distance; the vertex is at half. Measure from the directrix, not from the origin.",
    },
    "event-complement-set": {
      goal: "List the members of a complement, or the complement of a union or intersection, in a sample space.",
      intuition:
        "The complement of an event contains everything in the sample space that is not in the event. A union contains outcomes in either event and an intersection contains outcomes in both, so their complements are found by listing what is left over.",
      terms: ["complement-probability", "union", "intersection"],
      method: [
        "Write the union or intersection first if the question asks for its complement.",
        "Go through the sample space in order and keep the members that are not in it.",
        "Check by counting: a set and its complement together have all members once.",
      ],
      watch:
        "The complement of a union is the set of outcomes in neither event, which is $A'\\cap B'$, not $A'\\cup B'$.",
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
    "A parabola with focus $F$ and directrix $\\ell$ is the set of points equidistant from them. Its vertex lies on the perpendicular from $F$ to $\\ell$, midway between $F$ and $\\ell$.",
  "event-complement-set":
    "For events $A,B$ in a sample space $S$: $A'=S\\setminus A$, $(A\\cup B)'=A'\\cap B'$ and $(A\\cap B)'=A'\\cup B'$ (De Morgan's laws).",
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
  chainLesson({
    id: "regents-parabola-vertex-distance",
    title: "Vertex halfway to the directrix",
    summary:
      "Find the vertex of a parabola from its directrix and the distance to its focus.",
    templateIds: ["parabola-vertex-distance"],
    objectives: [
      "Find the axis of symmetry from the focus and directrix.",
      "Place the vertex halfway between them.",
    ],
    openingTitle: "Equal distance from focus and line",
    opening: [
      "A parabola is the set of points that are the same distance from a point, the focus, and a line, the directrix. The vertex is the point on the parabola nearest the directrix.",
      "That point is on the line from the focus perpendicular to the directrix, exactly halfway between the focus and the directrix.",
    ],
    example: {
      prompt:
        "The directrix is $y=1$ and the focus is 6 units above it on $x=2$. Where is the vertex?",
      steps: [
        "The vertex is halfway: 3 units above the directrix.",
        "$y=1+3=4$, on $x=2$.",
      ],
      answer: "$(2,\\ 4)$",
    },
    methodTitle: "Half the distance",
    method: [
      "Axis through the focus, perpendicular to the directrix.",
      "Half the distance, measured from the directrix toward the focus.",
    ],
    formalTitle: "Why halfway",
    formal: [
      "For a point on the axis at distance $t$ from the directrix and $f-t$ from the focus, equality $t=f-t$ gives $t=\\frac f2$.",
      "The directrix and the axis are perpendicular.",
    ],
    pitfalls: [
      "The focus is at the full distance, not the vertex.",
      "The vertex is on the same side of the directrix as the focus.",
    ],
    parentGuide:
      "Ask your learner to sketch the directrix, the focus and the midpoint.",
  }),
  chainLesson({
    id: "regents-event-complement-set",
    title: "Complements of events as sets",
    summary: "List the members of $A'$, $(A\\cup B)'$ and $(A\\cap B)'$.",
    templateIds: ["event-complement-set"],
    objectives: [
      "List a complement from a sample space.",
      "Find the complement of a union or intersection.",
    ],
    openingTitle: "What is left over",
    opening: [
      "The sample space $S$ is the set of all outcomes. The complement $A'$ is every outcome in $S$ that is not in $A$.",
      "A union $A\\cup B$ has outcomes in $A$ or in $B$; an intersection $A\\cap B$ has outcomes in both. To find their complements, form the union or intersection first and list what is left.",
    ],
    example: {
      prompt:
        "$S=\\{1,2,3,4,5\\}$, $A=\\{1,2\\}$, $B=\\{2,3\\}$. Find $(A\\cup B)'$.",
      steps: [
        "$A\\cup B=\\{1,2,3\\}$.",
        "Outcomes of $S$ not in it: $\\{4,5\\}$.",
      ],
      answer: "$\\{4,5\\}$",
    },
    methodTitle: "Form the set, then complement",
    method: [
      "Write $A\\cup B$ or $A\\cap B$ if needed.",
      "Scan $S$ and keep members outside it.",
    ],
    formalTitle: "De Morgan's laws",
    formal: [
      "$(A\\cup B)'=A'\\cap B'$ and $(A\\cap B)'=A'\\cup B'$.",
      "The complement is always taken within the sample space $S$.",
    ],
    pitfalls: [
      "The complement of a union is outside both events.",
      "Do not list a member of $A$ in $A'$.",
    ],
    parentGuide:
      "Ask your learner to cross out members of the sample space as they are removed.",
  }),
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
