import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import {
  satGeometryDataTemplates,
  generateSatGeometryDataProblem,
} from "../math/sat-geometry-data-practice";

type Instruction = ProblemMethod & { intuition: string; principle: string };
const instruction: Record<string, Instruction> = {
  "trig-context-triangle": {
    goal: "Turn a described situation into a right triangle, then find a side or an angle with a trigonometric ratio.",
    intuition:
      "A ladder against a wall, a ramp, a shadow and a line of sight all make a right triangle with the ground or a level line. In a right triangle, the sides have fixed ratios once an acute angle is known. The side across from the angle is opposite it, the other side touching the angle is adjacent to it, and the longest side, across from the right angle, is the hypotenuse. An angle of elevation is measured upward from a level line. An angle of depression is measured downward from a level line.",
    terms: [
      "opposite-side-angle",
      "adjacent-leg",
      [
        "angle-of-depression",
        "It equals the angle of elevation from the object back up, because the two level lines are parallel.",
      ],
      "inverse-trig-function",
    ],
    method: [
      "Sketch the right triangle and mark the right angle, the given angle and the given side. For a depression angle, draw the level line through the observer and copy that angle to the object, where it is inside the triangle.",
      "Label the sides opposite, adjacent and hypotenuse relative to the angle used. Choose the ratio that contains the given side and the unknown side: sine for opposite and hypotenuse, cosine for adjacent and hypotenuse, tangent for opposite and adjacent.",
      "Solve for the unknown side, multiplying when the unknown is in the numerator and dividing when it is in the denominator. To find an angle, take the inverse of the ratio. Round only at the end, as the problem states. Add any extra height, such as the height of the observer's eyes.",
    ],
    watch:
      "Name the sides from the angle you use. The same side is opposite one acute angle and adjacent to the other. Do not measure a depression angle from the vertical.",
    principle:
      "In a right triangle with acute angle $\\theta$: $\\sin\\theta=\\frac{\\text{opposite}}{\\text{hypotenuse}}$, $\\cos\\theta=\\frac{\\text{adjacent}}{\\text{hypotenuse}}$ and $\\tan\\theta=\\frac{\\text{opposite}}{\\text{adjacent}}$. The two acute angles total $90^\\circ$, and the calculator must be in degree mode for angles in degrees.",
  },
  "midpoint-endpoint": {
    goal: "Use averaging to find a midpoint, a missing endpoint, or the center and equation of a circle from a diameter.",
    intuition:
      "The midpoint of a segment is the point halfway between its endpoints. Halfway in each direction means halfway in $x$ and halfway in $y$, so each midpoint coordinate is the average of the two endpoint coordinates. A circle's center is the midpoint of any of its diameters, and its radius is half the diameter's length.",
    terms: ["midpoint", "diameter"],
    method: [
      "For a midpoint, average the $x$-coordinates and average the $y$-coordinates of the endpoints.",
      "For a missing endpoint, set each coordinate average equal to the midpoint coordinate and solve, or double the midpoint and subtract the known endpoint.",
      "For a circle from a diameter, find the center as the midpoint. Find $r^2$ by adding the squares of the $x$- and $y$-changes from the center to an endpoint, then write $(x-h)^2+(y-k)^2=r^2$.",
    ],
    watch:
      "In $(x-h)^2$ the center's coordinate is subtracted, so a center with $x=-3$ gives $x+3$. The right side is $r^2$, not $r$.",
    principle:
      "The midpoint of $(x_1,y_1)$ and $(x_2,y_2)$ is $\\left(\\frac{x_1+x_2}{2},\\frac{y_1+y_2}{2}\\right)$. If $M$ is the midpoint of $\\overline{AB}$, then $B=2M-A$. A circle with center $(h,k)$ and radius $r$ has equation $(x-h)^2+(y-k)^2=r^2$.",
  },
  "space-diagonal": {
    goal: "Find the corner-to-corner length of a box, or a missing edge, with the Pythagorean theorem used twice.",
    intuition:
      "A rectangular box has a floor, and the floor has a diagonal. That floor diagonal and the vertical edge stand at a right angle, so they are the legs of a second right triangle. Its hypotenuse is the segment from one corner of the box to the opposite corner, the longest straight segment inside the box.",
    terms: [
      [
        "diagonal",
        "A space diagonal joins two corners of a solid that do not share a face.",
      ],
      "pythagorean-theorem",
    ],
    method: [
      "Find the diagonal of the base: its square is $\\ell^2+w^2$.",
      "Use that diagonal and the height as the legs of a right triangle: $d^2=\\ell^2+w^2+h^2$.",
      "Take the square root, simplifying a radical if the sum is not a perfect square. To find a missing edge, subtract the known squares from $d^2$ and then take the root.",
    ],
    watch:
      "Add the squares of the three edges, not the edges themselves, and take one square root at the end.",
    principle:
      "A rectangular box with edges $\\ell$, $w$ and $h$ has space diagonal $d=\\sqrt{\\ell^2+w^2+h^2}$. A cube of edge $a$ has $d=a\\sqrt{3}$.",
  },
  "circle-segment-lengths": {
    goal: "Use products of segments of chords, secants and tangents, and the perpendicular radius, to find lengths and slopes.",
    intuition:
      "A chord is a segment with both endpoints on a circle. A secant is a line that crosses a circle at two points. A tangent touches it at one point. When two such lines meet, the pieces they cut off are linked by products. The product of the two pieces of one chord equals the product of the two pieces of the other. For lines from an outside point, the outside piece times the whole secant is the same for each line, and a tangent counts as both pieces at once, so its length squared is that product. A tangent is also perpendicular to the radius drawn to its point of tangency.",
    terms: ["chord", "secant", "tangent-line"],
    method: [
      "Identify the pieces. For intersecting chords, use the two parts of each chord. For lines from an outside point, use the outside part and the whole secant, measured from the outside point to the far intersection.",
      "Set the products equal and solve: $ab=cd$ for chords, $PA\\cdot PB=PC\\cdot PD$ for two secants, and $PT^2=PA\\cdot PB$ for a tangent and a secant. Subtract the outside part if the problem asks for the chord inside the circle.",
      "For a tangent slope, find the slope of the radius to the point of tangency. The tangent's slope is its negative reciprocal. A horizontal radius gives a vertical tangent with undefined slope, and a vertical radius gives a horizontal tangent with slope 0.",
    ],
    watch:
      "Use the whole secant, from the outside point to the far intersection, not only the part inside the circle. Do not use the radius slope itself for the tangent.",
    principle:
      "If chords $AB$ and $CD$ meet at $E$, then $AE\\cdot EB=CE\\cdot ED$. If secants from $P$ meet the circle at $A,B$ and $C,D$ (nearer points $A,C$), then $PA\\cdot PB=PC\\cdot PD$. If $PT$ is tangent and a secant meets the circle at $A$ then $B$, then $PT^2=PA\\cdot PB$. Perpendicular lines with slopes $m_1,m_2$ satisfy $m_1m_2=-1$.",
  },
  "frequency-table-center": {
    goal: "Find or compare a mean or median when the data are given by frequencies, weights, or a changed data set.",
    intuition:
      "A frequency table lists each value and how many times it occurs, instead of writing every data value. The mean is the total of all the data divided by how many data values there are. The median is the middle value when all data values are put in order. A weighted mean counts some values more than others. Adding or removing a value changes the total and the count, and it can move the mean and the median differently.",
    terms: ["frequency", "weighted-mean", "median"],
    method: [
      "For a mean from a table, multiply each value by its frequency and add; add the frequencies for the number of data values; divide the first sum by the second.",
      "For a median, add the frequencies from the least value until you reach the middle position or the two middle positions of the ordered data.",
      "For a weighted mean or a combined mean, multiply each mean by its weight or group size, add, and divide by the total weight or total count. When a value is added or removed, update the total and the count, then recompute.",
    ],
    watch:
      "Do not average the listed values without their frequencies, and do not average two group means as if the groups were the same size.",
    principle:
      "For values $x_i$ with frequencies $f_i$, the mean is $\\frac{\\sum x_if_i}{\\sum f_i}$. A value above the mean raises the mean when it is added, a value below lowers it, and a value equal to the mean leaves it unchanged. The mean of $n$ values is $\\text{total}/n$, so the total is $n$ times the mean.",
  },
  "independence-test": {
    goal: "Decide whether events are independent from a two-way table, and read conditional-probability language correctly.",
    intuition:
      "Two events are independent when knowing that one happened does not change the chance of the other. In a two-way table, a probability given an event is found inside the row or column for that event. If the share inside that row or column equals the share in the whole table, the event gives no information. A conditional probability such as $P(A\\mid B)$ is read as the probability of $A$ given $B$: restrict attention to outcomes in $B$, then find the share of them in $A$.",
    terms: [
      [
        "independent-events",
        "To test it, check whether $P(A \\mid B) = P(A)$.",
      ],
      "conditional-probability",
      [
        "mutually-exclusive",
        "This is a different idea from independent events.",
      ],
    ],
    method: [
      "Find the overall proportion for one event from the totals, then the proportion of that event inside each group (a row or column).",
      "Compare. Equal proportions mean independence. Unequal proportions mean the events are not independent, and the larger one shows which group makes the event more likely.",
      "For an expected joint count under independence, multiply the two overall probabilities and then the total number of people. To interpret $P(A\\mid B)=p$, say: among those in $B$, a share $p$ are in $A$.",
    ],
    watch:
      "The group named after the bar is the one you divide by. $P(A\\mid B)$ and $P(B\\mid A)$ are usually different, and events that overlap can still be dependent.",
    principle:
      "Events $A$ and $B$ with $P(B)>0$ are independent exactly when $P(A\\mid B)=P(A)$, which is equivalent to $P(A\\text{ and }B)=P(A)P(B)$. Mutually exclusive events with positive probabilities are never independent.",
  },
};
const furtherPitfalls: Record<string, string> = {
  "trig-context-triangle":
    "Check that the answer is reasonable: a leg is always shorter than the hypotenuse, and a larger angle of elevation means a steeper line.",
  "midpoint-endpoint":
    "A midpoint can have a half-integer coordinate. Do not round it.",
  "space-diagonal":
    "The segment along the edges of the box is longer than the space diagonal, which is the straight-line shortcut.",
  "circle-segment-lengths":
    "Check which pieces the problem names. A secant has an outside piece, an inside chord and a whole length, and these are three different numbers.",
  "frequency-table-center":
    "A mean can be a value that does not appear in the table. A median of an even count is the mean of the two middle values.",
  "independence-test":
    "Proportions that are close but not equal are not independent. Compare exact fractions, not rounded impressions.",
};
export const satGeometryDataMethods: Record<string, ProblemMethod> =
  instruction;
export const satGeometryDataPrinciples = Object.fromEntries(
  Object.entries(instruction).map(([id, value]) => [id, value.principle]),
);
export const satGeometryDataLessons: Lesson[] = satGeometryDataTemplates.map(
  (meta) => {
    const text = instruction[meta.id]!;
    const example = generateSatGeometryDataProblem(meta.id, "sat-reference");
    const response = example.public.response;
    const answer =
      response.kind === "choice"
        ? response.options.find((o) => o.id === example.answer)!.label
        : example.answer;
    return {
      id: meta.id,
      title: meta.title,
      summary: text.intuition,
      templateIds: [meta.id],
      includeGeneratedRepresentation: false,
      objectives: [text.goal, text.method[0]!],
      sections: [],
      closingSections: [
        { stage: "method", title: meta.title, paragraphs: text.method },
        {
          stage: "formal",
          title: "Rule and conditions",
          paragraphs: [text.principle],
        },
      ],
      workedExample: {
        prompt: example.public.prompt,
        steps: example.explanation,
        answer,
        ...(response.kind === "choice"
          ? { choices: response.options.map((o) => o.label) }
          : {}),
        ...(example.public.figure ? { figure: example.public.figure } : {}),
      },
      pitfalls: [text.watch!, furtherPitfalls[meta.id]!],
      parentGuide:
        "Ask the learner to identify the givens, the requested quantity, and the reason each step preserves the relationship.",
    };
  },
);
