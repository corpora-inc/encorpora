import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * HSF.TF.A.2: how the unit circle turns every real number into an angle and
 * gives sine and cosine a value there. The lesson reads a real number as a
 * distance travelled from (1, 0), then justifies each step of the definition.
 */

const unitCircleIntro =
  "The unit circle is the circle of radius 1 centered at the origin, $(0, 0)$. A real number $t$ names a trip along it: start at $(1, 0)$ and travel a distance of $|t|$, the size of $t$ without its sign. Go counterclockwise when $t$ is positive and clockwise when $t$ is negative. The point where the trip ends is called the terminal point of $t$.";

export const unitCircleExtensionMethods: Record<string, ProblemMethod> = {
  "unit-circle-extension-reason": {
    goal: "Justify a step of how the unit circle defines $\\sin t$ and $\\cos t$ for a real number $t$, or find the flaw in a claim about it.",
    intuition: `${unitCircleIntro} Then $\\cos t$ is defined as the $x$-coordinate of the terminal point and $\\sin t$ as its $y$-coordinate. A right triangle only has acute angles, between 0 and $\\frac{\\pi}{2}$, so the old definition stops there. The trip works for every real number, because the circle has no end.`,
    terms: ["unit-circle", "radian", "sine", "cosine", "arc-length"],
    senses: { quadrant: "quadrant" },
    noLink: ["point", "step"],
    method: [
      "Act out the trip for this $t$: its sign gives the direction, and past $2\\pi$ the trip keeps going around.",
      "Name the fact the step rests on: the circle has no end; radius 1 makes arc length equal the angle; a hypotenuse of 1 makes each ratio a coordinate; $x^2 + y^2 = 1$ keeps each coordinate between $-1$ and $1$.",
      "Reject a reason that assumes $t$ is small, positive, in degrees, or already has a sine or cosine.",
    ],
    watch:
      "A correct reason must work for every real number, including negative ones and ones past $2\\pi$. Test each choice on the $t$ in the problem before accepting it.",
  },
  "unit-circle-extension-cloze": {
    goal: "Complete an explanation of how a real number $t$ gives a point on the unit circle and the values $\\sin t$ and $\\cos t$.",
    intuition: `${unitCircleIntro} An angle in radians is arc length divided by radius, so on the unit circle the arc length and the angle are the same number. The terminal point is $(\\cos t, \\sin t)$: cosine first, because it is the $x$-coordinate.`,
    terms: ["unit-circle", "radian", "sine", "cosine"],
    noLink: ["point"],
    method: [
      "Read the sign of $t$: positive travels counterclockwise, negative clockwise. The distance is $|t|$ units, not degrees.",
      "The radius is 1, so the angle is $t$ radians, and the point reached is $(\\cos t, \\sin t)$.",
      "Every real number works because the circle has no end: a trip of any length, in either direction, ends at one point.",
    ],
    watch:
      "Keep the order $(\\cos t, \\sin t)$: the $x$-coordinate is the cosine. And keep radians: $t$ is a distance, not a number of degrees.",
  },
  "real-number-terminal-point": {
    goal: "Choose the drawing that shows where the trip for a real number $t$ ends on the unit circle.",
    intuition: `${unitCircleIntro} Landmarks help: a quarter turn is $\\frac{\\pi}{2} \\approx 1.57$, half a turn is $\\pi \\approx 3.14$, three quarters is $\\frac{3\\pi}{2} \\approx 4.71$, and a full turn is $2\\pi \\approx 6.28$.`,
    terms: ["unit-circle", "radian", "quadrant", "circumference"],
    noLink: ["point", "start"],
    method: [
      "Read the sign of $t$ for the direction. If $|t|$ is more than $2\\pi \\approx 6.28$, take away full turns first.",
      "Compare what is left with the landmarks 1.57, 3.14 and 4.71 to find the quadrant.",
      "Choose the point in that quadrant, checking how close it sits to each axis.",
    ],
    watch:
      "Start at $(1, 0)$, not at the top of the circle, and treat $t$ as a distance in radians, not degrees. A full turn is $2\\pi$, not $\\pi$.",
  },
  "real-number-same-terminal-point": {
    goal: "Select every real number whose trip on the unit circle ends at the same point as the trip for $t$.",
    intuition: `${unitCircleIntro} A full turn is $2\\pi$, the circumference. Adding or taking away whole turns brings a trip back to the same point, so $t$, $t + 2\\pi$ and $t - 4\\pi$ all end at one point.`,
    terms: ["unit-circle", "coterminal-angles", "circumference"],
    noLink: ["point"],
    method: [
      "Write each choice as $t$ plus or minus something.",
      "Keep the choices that add or take away a whole number of full turns, $2\\pi$ each.",
      "Reject $-t$ and $\\pi - t$, which are mirror images of the point, and $t + \\pi$, the opposite point.",
    ],
    watch:
      "Only multiples of $2\\pi$ return to the same point. Adding $\\pi$ is half a turn, and adding 360 counts degrees, not radians.",
  },
};

export const unitCircleExtensionPrinciples: Record<string, string> = {
  "unit-circle-extension-reason":
    "For every real number $t$, the trip of length $|t|$ from $(1, 0)$ along the unit circle, counterclockwise for $t > 0$ and clockwise for $t < 0$, ends at exactly one point $P$. By definition $\\cos t$ and $\\sin t$ are the coordinates of $P$. For $0 < t < \\frac{\\pi}{2}$ they equal the right-triangle ratios, and $x^2 + y^2 = 1$ gives $-1 \\le \\cos t \\le 1$ and $-1 \\le \\sin t \\le 1$.",
  "unit-circle-extension-cloze":
    "On a circle of radius $r$, an arc of length $s$ makes an angle of $\\frac{s}{r}$ radians. When $r = 1$ the angle is $s$ itself, so the real number $t$ is both the distance travelled and the angle, and its terminal point is $(\\cos t, \\sin t)$.",
  "real-number-terminal-point":
    "The terminal point of $t$ depends only on $t$ minus a whole number of full turns of $2\\pi$. Its quadrant follows from where that remainder falls among $0$, $\\frac{\\pi}{2}$, $\\pi$, $\\frac{3\\pi}{2}$ and $2\\pi$, taken counterclockwise for positive $t$ and clockwise for negative $t$.",
  "real-number-same-terminal-point":
    "Two real numbers have the same terminal point exactly when they differ by a whole multiple of $2\\pi$: $s = t + 2\\pi k$ for an integer $k$. So $\\sin(t + 2\\pi k) = \\sin t$ and $\\cos(t + 2\\pi k) = \\cos t$.",
};

export const unitCircleExtensionLessons: Lesson[] = [
  chainLesson({
    id: "unit-circle-extension",
    title: "Sine and cosine of every real number",
    summary:
      "A right triangle only has acute angles, so its ratios give sine and cosine only between 0 and $\\frac{\\pi}{2}$. The unit circle, the circle of radius 1 around the origin, does more. Read a real number $t$ as a trip along the circle from $(1, 0)$. The point where the trip ends gives $\\cos t$ as its $x$-coordinate and $\\sin t$ as its $y$-coordinate.",
    senses: { quadrant: "quadrant" },
    noLink: ["point", "step", "start"],
    templateIds: [
      "unit-circle-extension-reason",
      "unit-circle-extension-cloze",
      "real-number-terminal-point",
      "real-number-same-terminal-point",
    ],
    objectives: [
      "Explain how reading a real number as a distance along the unit circle, counterclockwise for positive numbers and clockwise for negative ones, gives a point for every real number.",
      "Justify why that point's coordinates define $\\cos t$ and $\\sin t$, why they agree with the right-triangle ratios for acute angles, and why they stay between $-1$ and $1$.",
      "Locate the terminal point of a number such as 4.3, $-2.4$ or 8.5, and recognize the other numbers that share it.",
    ],
    openingTitle: "A trip around the circle",
    opening: [
      unitCircleIntro,
      "Here is the trip for $t = 4.3$. Half a turn is $\\pi \\approx 3.14$, and 4.3 is past that but short of $\\frac{3\\pi}{2} \\approx 4.71$. So the trip ends in quadrant III, low and to the left. For $t = -2.4$, go clockwise: past a quarter turn, 1.57, but short of half a turn, 3.14, which ends in quadrant III too. For $t = 8.5$, go once around, $2\\pi \\approx 6.28$, and then 2.22 more, which ends in quadrant II.",
      "An angle in radians is arc length divided by radius. On the unit circle the radius is 1, so a trip of length 4.3 makes an angle of 4.3 radians. The real number is the distance and the angle at once.",
      "Now define $\\cos t$ as the $x$-coordinate of the terminal point and $\\sin t$ as its $y$-coordinate. The circle has no end, so every real number has exactly one terminal point, and so exactly one sine and one cosine.",
    ],
    example: {
      prompt:
        "Explain why $\\cos 4.3$ has a value, though no right triangle has an angle of 4.3 radians, and say whether it is positive or negative.",
      steps: [
        "A right triangle's acute angles are between 0 and $\\frac{\\pi}{2} \\approx 1.57$, so the triangle definition gives nothing for 4.3. The unit circle is needed.",
        "Start at $(1, 0)$ and travel 4.3 units counterclockwise, because 4.3 is positive. The circle has no end, so the trip ends at exactly one point $P$.",
        "4.3 is between $\\pi \\approx 3.14$ and $\\frac{3\\pi}{2} \\approx 4.71$, so $P$ is in quadrant III, where both coordinates are negative.",
        "$\\cos 4.3$ is defined as the $x$-coordinate of $P$. So it has a value, and that value is negative.",
      ],
      answer:
        "$\\cos 4.3$ is the $x$-coordinate of the terminal point in quadrant III, so it exists and is negative.",
    },
    methodTitle: "Check each reason against the trip",
    method: [
      "For any claim about $\\sin t$ or $\\cos t$, act out the trip for the actual $t$: its direction from the sign, its turns past $2\\pi$, and its quadrant.",
      "A step about all real numbers needs the circle having no end. A step about the angle needs radius 1. A step about agreeing with triangles needs the hypotenuse to be the radius 1. A step about size needs $x^2 + y^2 = 1$.",
      "Reject any reason that assumes $t$ is small, positive, measured in degrees, or already has a sine or cosine.",
    ],
    formalTitle: "The definition",
    formal: [
      "For a real number $t$, let $P(t)$ be the point reached by travelling $|t|$ along the unit circle $x^2 + y^2 = 1$ from $(1, 0)$, counterclockwise if $t > 0$ and clockwise if $t < 0$, with $P(0) = (1, 0)$. Define $\\cos t$ as the $x$-coordinate of $P(t)$ and $\\sin t$ as its $y$-coordinate. Where $\\cos t \\ne 0$, $\\tan t = \\frac{\\sin t}{\\cos t}$.",
      "Because arc length on a circle of radius 1 equals the angle in radians, $t$ is the measure of the turn from the positive $x$-axis to ray $OP$, where $O$ is the origin. For $0 < t < \\frac{\\pi}{2}$, the definition agrees with the right-triangle ratios. Since $P(t + 2\\pi k) = P(t)$ for every integer $k$, sine and cosine repeat every $2\\pi$.",
    ],
    pitfalls: [
      "Travel clockwise for a negative number; do not drop the sign.",
      "A full turn is $2\\pi \\approx 6.28$, not $\\pi$ and not 360.",
      "On a circle of radius $r$ the arc is $r$ times the angle; only on the unit circle are they equal.",
      "The coordinates are $(\\cos t, \\sin t)$, cosine first.",
    ],
    parentGuide:
      "Ask your learner to walk the trip for a number like 4.3 with a finger on a drawn circle: which way, how far, and which quadrant it ends in. Then ask which coordinate is the cosine.",
  }),
];

export const unitCircleExtensionFacetMappings: FacetMapping[] = [
  {
    templateId: "unit-circle-extension-reason",
    facetId: "radians-unit-circle.HSF.TF.A.2",
    extent: "partial",
    rationale:
      "Recognize the reasoning behind extending sine and cosine to every real number: justify each step of the unit-circle definition (no end to the circle, radius 1 making arc length the angle, agreement with right-triangle ratios, bounds from x² + y² = 1), explain why the triangle definition fails, choose a correct and complete explanation, and find the flaw in faulty claims, for positive, negative, multi-turn and π-multiple real numbers. Does not assess an explanation written freely.",
  },
  {
    templateId: "unit-circle-extension-cloze",
    facetId: "radians-unit-circle.HSF.TF.A.2",
    extent: "partial",
    rationale:
      "Complete a four-blank explanation of the unit-circle definition: direction and distance from the sign of t, the angle in radians, the coordinates (cos t, sin t), and why every real number works. Does not assess an explanation written freely.",
  },
  {
    templateId: "real-number-terminal-point",
    facetId: "radians-unit-circle.HSF.TF.A.2",
    extent: "partial",
    rationale:
      "Locate the terminal point of a non-special real number, including negative numbers, numbers past one full turn and multiples of π, among points for the wrong direction, mirror images, a compass start, π taken as a full turn and degrees. Does not assess plotting the point freely.",
  },
  {
    templateId: "real-number-terminal-point",
    facetId: "radians-unit-circle.core",
    extent: "partial",
    rationale:
      "Read a real number as a radian measure travelled around the unit circle and find the quadrant of its terminal point. Does not assess exact coordinates.",
  },
  {
    templateId: "real-number-same-terminal-point",
    facetId: "radians-unit-circle.HSF.TF.A.2",
    extent: "partial",
    rationale:
      "Select the real numbers that differ from t by whole turns of 2π and so share its terminal point, among −t, π − t, t + π and t + 360. Does not assess writing the general form t + 2πk.",
  },
];
