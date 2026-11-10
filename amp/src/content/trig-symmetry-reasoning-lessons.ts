import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * HSF.TF.A.4: the unit circle explains why cosine is even, sine and tangent
 * are odd, sine and cosine repeat every 2π and tangent every π. Each
 * explanation names a point and its coordinates.
 */

const circleIntro =
  "On the unit circle, the circle of radius 1 around the origin, the angle $\\theta$ ends at a point $P = (a, b)$. Its coordinates are the cosine and the sine: $a = \\cos\\theta$ and $b = \\sin\\theta$. Tangent is their ratio, $\\tan\\theta = \\frac{b}{a}$, wherever $a \\ne 0$.";
const moves =
  "The angle $-\\theta$ runs the same distance clockwise, so its point is the mirror image of $P$ across the $x$-axis, $(a, -b)$. The angle $\\pi - \\theta$ gives the mirror image across the $y$-axis, $(-a, b)$. Adding $\\pi$, half the circumference, gives the opposite point through the origin, $(-a, -b)$. Adding $2\\pi$, a full turn, returns to $P$.";
const evenOdd =
  "A function $f$ is called even when $f(-\\theta) = f(\\theta)$ for every $\\theta$, and odd when $f(-\\theta) = -f(\\theta)$ for every $\\theta$. A period is a number $c$ with $f(\\theta + c) = f(\\theta)$ for every $\\theta$.";

export const trigSymmetryReasoningMethods: Record<string, ProblemMethod> = {
  "unit-circle-symmetry-derivation": {
    goal: "From the point $P = (a, b)$ for $\\theta$, place the point $Q$ for a related angle, give its coordinates, and say what that shows.",
    intuition: `${circleIntro} ${moves} ${evenOdd}`,
    terms: [
      "unit-circle",
      "reflection",
      ["even-function", "Cosine is even."],
      ["odd-function", "Sine and tangent are odd."],
    ],
    noLink: ["point", "fold"],
    method: [
      "Find the motion that carries $P$ to $Q$: across the $x$-axis for $-\\theta$, across the $y$-axis for $\\pi - \\theta$, a half turn for $\\pi + \\theta$.",
      "Apply it to the coordinates: the $x$-axis flip changes the sign of $y$, the $y$-axis flip the sign of $x$, a half turn both.",
      "Read the conclusion from the coordinates of $Q$: an unchanged coordinate means an equal value, a sign change means the opposite value.",
    ],
    watch:
      "Even and odd compare $\\theta$ with $-\\theta$ only. $\\sin(\\pi - \\theta) = \\sin\\theta$ is a mirror across the $y$-axis; it does not make sine even.",
  },
  "trig-periodicity-explanation": {
    goal: "Choose the unit-circle explanation of a period, find the false step in an argument, or choose a counterexample to a claimed period.",
    intuition: `${circleIntro} ${moves} ${evenOdd} One angle where $f(\\theta + c) \\ne f(\\theta)$ is enough to show $c$ is not a period.`,
    terms: ["unit-circle", "period", "circumference"],
    noLink: ["point", "step"],
    method: [
      "Find where the added arc takes $P$: a whole number of full turns returns to $(a, b)$; a half turn reaches $(-a, -b)$.",
      "Compare coordinates: same point, same sine and cosine; the half-turn point keeps only the ratio $\\frac{b}{a}$.",
      "To refute a period, pick an angle where the two values differ; angles where they happen to agree prove nothing.",
    ],
    watch:
      "Sine, cosine and tangent do not split over a sum: $\\sin(\\theta + 2\\pi)$ is not $\\sin\\theta + \\sin 2\\pi$. The reason a period works is the point on the circle.",
  },
  "unit-circle-claim-check": {
    goal: "Select the claims about even, odd and periodic trigonometric functions that are true and correctly justified by the unit circle.",
    intuition: `${circleIntro} ${moves} ${evenOdd}`,
    terms: [
      "unit-circle",
      "even-function",
      "odd-function",
      "period",
      "reflection",
    ],
    noLink: ["point"],
    method: [
      "For each claim, find the two points it compares on the circle and their coordinates.",
      "Check that the equation matches those coordinates.",
      "Check that the reason fits the conclusion: even and odd need the point for $-\\theta$; a period needs a whole or half turn.",
    ],
    watch:
      "A true equation with the wrong conclusion is a false claim: $\\tan(\\theta + \\pi) = \\tan\\theta$ is true, but it shows a period, not that tangent is even.",
  },
};

export const trigSymmetryReasoningPrinciples: Record<string, string> = {
  "unit-circle-symmetry-derivation":
    "If $P = (\\cos\\theta, \\sin\\theta)$, the point for $-\\theta$ is $(\\cos\\theta, -\\sin\\theta)$, for $\\pi - \\theta$ it is $(-\\cos\\theta, \\sin\\theta)$, and for $\\pi + \\theta$ it is $(-\\cos\\theta, -\\sin\\theta)$. So $\\cos(-\\theta) = \\cos\\theta$, $\\sin(-\\theta) = -\\sin\\theta$ and $\\tan(-\\theta) = -\\tan\\theta$: cosine is even, sine and tangent are odd, and $\\tan(\\pi + \\theta) = \\tan\\theta$.",
  "trig-periodicity-explanation":
    "The unit circle has circumference $2\\pi$, so the point for $\\theta + 2\\pi k$ is the point for $\\theta$ for every integer $k$: $\\sin(\\theta + 2\\pi k) = \\sin\\theta$ and $\\cos(\\theta + 2\\pi k) = \\cos\\theta$. The point for $\\theta + \\pi$ is $(-\\cos\\theta, -\\sin\\theta)$, so $\\tan(\\theta + \\pi) = \\tan\\theta$ while $\\sin(\\theta + \\pi) = -\\sin\\theta$.",
  "unit-circle-claim-check":
    "A claim about $f(-\\theta)$ is decided by the reflection $(a, b) \\to (a, -b)$; a claim about $f(\\theta + c)$ is decided by the rotation by $c$. A conclusion is justified only when it follows from the equation that the matching point gives.",
};

export const trigSymmetryReasoningLessons: Lesson[] = [
  chainLesson({
    id: "trig-symmetry-reasoning",
    title: "Even, odd and periodic from the unit circle",
    summary:
      "On the unit circle, each angle $\\theta$ ends at a point whose coordinates are $\\cos\\theta$ and $\\sin\\theta$. Turning the other way, adding half a turn or adding a full turn moves that point in simple ways. Those moves explain why cosine is even, sine and tangent are odd, and the functions repeat.",
    noLink: ["point", "step", "fold"],
    templateIds: [
      "unit-circle-symmetry-derivation",
      "trig-periodicity-explanation",
      "unit-circle-claim-check",
    ],
    objectives: [
      "Use the reflection of the point $(a, b)$ across the $x$-axis to explain why cosine is even and sine and tangent are odd.",
      "Use full turns and half turns of the point to explain why sine and cosine repeat every $2\\pi$ and tangent every $\\pi$, and refute a false period with one counterexample.",
      "Tell apart the symmetry $\\sin(\\pi - \\theta) = \\sin\\theta$ from evenness, and judge whether a claim's reason fits its conclusion.",
    ],
    openingTitle: "Moving the point",
    opening: [
      circleIntro,
      moves,
      evenOdd,
      "With numbers: if $P = (0.6, 0.8)$, the point for $-\\theta$ is $(0.6, -0.8)$. The cosine stays 0.6 and the sine changes from 0.8 to $-0.8$. That is cosine even and sine odd, seen on one point. The same reflection works for every $\\theta$, so the rule holds everywhere.",
    ],
    example: {
      prompt:
        "Use the unit circle to explain why $\\tan(\\theta + \\pi) = \\tan\\theta$ but $\\sin(\\theta + \\pi) \\ne \\sin\\theta$ when $\\sin\\theta \\ne 0$.",
      steps: [
        "Let $P = (a, b)$ be the point for $\\theta$, so $a = \\cos\\theta$, $b = \\sin\\theta$ and $\\tan\\theta = \\frac{b}{a}$.",
        "An arc of $\\pi$ is half the circumference $2\\pi$, so the point for $\\theta + \\pi$ is directly opposite: $(-a, -b)$.",
        "Its sine is $-b$, the opposite of $b$. So $\\sin(\\theta + \\pi) = -\\sin\\theta$, which differs from $\\sin\\theta$ when $b \\ne 0$.",
        "Its tangent is $\\frac{-b}{-a} = \\frac{b}{a}$. Both signs change, so the ratio keeps its value: $\\tan(\\theta + \\pi) = \\tan\\theta$.",
      ],
      answer:
        "The half-turn point is $(-a, -b)$: sine changes sign, but the ratio $\\frac{-b}{-a} = \\frac{b}{a}$ is unchanged.",
    },
    methodTitle: "Explain with a point",
    method: [
      "Name the point for each angle in the claim and write its coordinates from $(a, b)$.",
      "Compare the coordinates the claim compares. A whole turn returns to $(a, b)$; a half turn gives $(-a, -b)$; $-\\theta$ gives $(a, -b)$; $\\pi - \\theta$ gives $(-a, b)$.",
      "To show a claimed period is false, one angle where the values differ is enough. Angles where they happen to agree prove nothing.",
    ],
    formalTitle: "The identities",
    formal: [
      "For every real $\\theta$: $\\cos(-\\theta) = \\cos\\theta$, $\\sin(-\\theta) = -\\sin\\theta$, $\\sin(\\pi - \\theta) = \\sin\\theta$, $\\cos(\\pi - \\theta) = -\\cos\\theta$, $\\sin(\\theta + \\pi) = -\\sin\\theta$ and $\\cos(\\theta + \\pi) = -\\cos\\theta$. For every integer $k$, $\\sin(\\theta + 2\\pi k) = \\sin\\theta$ and $\\cos(\\theta + 2\\pi k) = \\cos\\theta$.",
      "Where $\\cos\\theta \\ne 0$: $\\tan(-\\theta) = -\\tan\\theta$ and $\\tan(\\theta + \\pi) = \\tan\\theta$. So cosine is even, sine and tangent are odd, the smallest period of sine and cosine is $2\\pi$, and that of tangent is $\\pi$.",
    ],
    pitfalls: [
      "$\\sin(\\pi - \\theta) = \\sin\\theta$ is a mirror across the $y$-axis, not evenness.",
      "A half turn is not a period of sine or cosine: it changes the sign of both coordinates.",
      "Trigonometric functions do not split over sums.",
      "A claimed period that holds at a few angles is not proved; one failure disproves it.",
    ],
    parentGuide:
      "Draw a circle and mark a point in the first quadrant. Ask your learner where the points for $-\\theta$, $\\pi - \\theta$ and $\\pi + \\theta$ go, and which coordinates change sign.",
  }),
];

export const trigSymmetryReasoningFacetMappings: FacetMapping[] = [
  {
    templateId: "unit-circle-symmetry-derivation",
    facetId: "trigonometric-symmetry.HSF.TF.A.4",
    extent: "partial",
    rationale:
      "Build the unit-circle explanation of symmetry: name the reflection or half turn that carries P = (a, b) to the point for −θ, π − θ or π + θ, give its coordinates in symbols or numbers, and conclude that cosine is even, sine and tangent are odd, tangent keeps its value under a half turn, or that sin(π − θ) = sin θ does not make sine even. Does not assess an explanation written freely.",
  },
  {
    templateId: "trig-periodicity-explanation",
    facetId: "trigonometric-symmetry.HSF.TF.A.4",
    extent: "partial",
    rationale:
      "Choose the unit-circle explanation of why sine and cosine repeat after whole turns and tangent after half a turn, find the false step in four kinds of faulty periodicity arguments, and choose a counterexample to a claimed period of π or π/2 among angles where the values coincide. Does not assess an explanation written freely.",
  },
  {
    templateId: "unit-circle-claim-check",
    facetId: "trigonometric-symmetry.HSF.TF.A.4",
    extent: "partial",
    rationale:
      "Select the claims about evenness, oddness and periods that are true and correctly justified by the points for θ, −θ, π − θ and π + θ, rejecting true equations with wrong conclusions and false equations. Does not assess an explanation written freely.",
  },
  {
    templateId: "unit-circle-claim-check",
    facetId: "trigonometric-symmetry.core",
    extent: "partial",
    rationale:
      "Explain odd, even and periodic relationships with reflections and turns of a point on the unit circle. Does not assess computing values.",
  },
];
