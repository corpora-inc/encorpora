import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Methods, principles and the lesson for deriving area = ½ab sin C
 * (HSG.SRT.D.9): the height from a vertex perpendicular to the line of the
 * opposite side, its foot inside the base or on its extension, the sine
 * ratio in the right triangle it makes, and the supplement rule for an
 * obtuse angle.
 */

const senses = {
  base: "base-shape",
  side: "side",
  sides: "side",
  vertex: "vertex",
  height: "height",
  degrees: "degree-angle",
};
const noLink = ["opposite", "product", "half", "line"];

export const trigAreaDerivationMethods: Record<string, ProblemMethod> = {
  "trig-area-auxiliary-line": {
    goal: "Plot the foot of the height that turns two known sides and the angle between them into area $=\\frac12ab\\sin C$.",
    intuition:
      "A height of a triangle is a segment from a vertex to the line through the opposite side, meeting that line at a right angle. Its foot is the point where it lands. For the area formula, the height starts at the far end of one known side and lands on the line of the other. When the angle between them is obtuse, the foot lands on that side's extension, outside the triangle.",
    senses,
    noLink,
    terms: ["altitude", "perpendicular", "included-angle"],
    method: [
      "Find the line through the base side. On this grid it is horizontal or vertical.",
      "From the named vertex, go straight across to that line at a right angle: keep one coordinate of the vertex and take the other from the line.",
      "Plot that point, even when it lies beyond the end of the side. Then the height is $b\\sin C$ and the area is $\\frac12ab\\sin C$.",
    ],
    watch:
      "Stop at the line, not at the nearest vertex. When the angle at the end of the base is obtuse, the foot lies on the extension, beyond that vertex.",
  },
  "trig-area-derivation-fill": {
    goal: "Fill each line of the derivation of area $=\\frac12ab\\sin C$, for an acute or an obtuse angle $C$.",
    intuition:
      "The height from $A$ to line $BC$ makes a right triangle with angle $C$ at one end. Its hypotenuse is side $b$, and the height is the side opposite $C$. So $\\sin C=\\frac{h}{b}$ and $h=b\\sin C$. The area is half the base $a$ times this height. When $C$ is obtuse, the right triangle holds the supplement of $C$ instead: the angle that adds to $C$ to make $180^\\circ$. That angle has the same sine.",
    senses,
    noLink,
    terms: ["altitude", "hypotenuse", "sine", "supplementary"],
    method: [
      "Name the base: the side the height lands on. The other given side is the hypotenuse of the right triangle.",
      "In the right triangle, write $\\sin=\\frac{\\text{opposite}}{\\text{hypotenuse}}$ for the angle at $C$, then solve for $h$.",
      "If $C$ is obtuse, the angle at $C$ in the right triangle is $180^\\circ-C$, and $\\sin(180^\\circ-C)=\\sin C$.",
      "Area $=\\frac12\\cdot\\text{base}\\cdot h=\\frac12ab\\sin C$.",
    ],
    watch:
      "The hypotenuse is the side the height starts from, not the side it lands on. Use sine, not cosine, because the height is opposite the angle.",
  },
  "trig-area-derivation-reasoning": {
    goal: "Choose the right auxiliary line, find the first wrong line of a derivation, and justify or judge its steps.",
    intuition:
      "A derivation is a chain of statements, each true and following from the ones before. For area $=\\frac12ab\\sin C$ the chain is: draw the height from $A$ to line $BC$, read $h=b\\sin C$ in the right triangle it makes, and take half the base times the height. A line is wrong when it is false or does not follow, even if the final answer looks right.",
    senses,
    noLink,
    terms: ["altitude", "sine", "supplementary", "median-triangle"],
    method: [
      "Find the right triangle that contains angle $C$, or its supplement when $C$ is obtuse. Name its hypotenuse and the side opposite the angle.",
      "Check each line in order against that triangle: the foot, the angle, the ratio, the base, and the $\\frac12$.",
      "Pick the first line that is false or does not follow. A right result reached by a wrong step is still a wrong step.",
    ],
    watch:
      "The height from the vertex of the given angle splits that angle, so it gives a height in terms of another angle. Draw the height from the far end of a given side.",
  },
};

export const trigAreaDerivationPrinciples: Record<string, string> = {
  "trig-area-auxiliary-line":
    "The height from $A$ meets the line through $B$ and $C$ at a right angle. Its foot lies between $B$ and $C$ when angles $B$ and $C$ are acute, and on the extension beyond $C$ when angle $C$ is obtuse. In either case the height is $b\\sin C$.",
  "trig-area-derivation-fill":
    "In right triangle $ADC$, with the right angle at the foot $D$, $\\sin C=\\frac{h}{b}$, so $h=b\\sin C$ and the area is $\\frac12ah=\\frac12ab\\sin C$. If $C$ is obtuse, $m\\angle ACD=180^\\circ-C$ and $\\sin(180^\\circ-C)=\\sin C$, so the formula is the same.",
  "trig-area-derivation-reasoning":
    "A derivation is valid when every line is true and follows from the lines above it. The height that derives $\\frac12ab\\sin C$ starts at the far end of a given side and is perpendicular to the line of the other given side.",
};

export const trigAreaDerivationLessons: Lesson[] = [
  chainLesson({
    id: "trig-area-derivation-lesson",
    title: "Deriving the triangle area formula from a height",
    summary:
      "Draw the height from the far end of one known side to the line of the other. It makes a right triangle with angle $C$ at one end, so the height is $b\\sin C$ and the area is $\\frac12ab\\sin C$. When $C$ is obtuse, the height lands outside the triangle, and the supplement of $C$ has the same sine.",
    senses,
    noLink,
    templateIds: [
      "trig-area-auxiliary-line",
      "trig-area-derivation-fill",
      "trig-area-derivation-reasoning",
    ],
    objectives: [
      "Draw or place the height from a vertex perpendicular to the line of the opposite side, inside or outside the triangle.",
      "Derive area $=\\frac12ab\\sin C$ line by line, including the obtuse case, and find the first wrong line of a flawed derivation.",
    ],
    openingTitle: "The height makes a right triangle",
    opening: [
      "A triangle's area is half its base times its height. The height is a segment from a vertex to the line of the opposite side, meeting it at a right angle. Its foot is where it lands.",
      "Suppose you know sides $a=BC$ and $b=CA$ and the angle $C$ between them. Draw the height $h$ from $A$ to line $BC$. It makes a right triangle $ADC$ with angle $C$ at one end and hypotenuse $b$.",
      "In that right triangle, $h$ is the side opposite angle $C$, so $\\sin C=\\frac{h}{b}$ and $h=b\\sin C$. Half the base $a$ times this height gives $\\frac12ab\\sin C$.",
      "If $C$ is obtuse, the height from $A$ lands beyond $C$, on the extension of $\\overline{BC}$. The angle at $C$ inside the right triangle is then $180^\\circ-C$. Since $\\sin(180^\\circ-C)=\\sin C$, the height is still $b\\sin C$.",
    ],
    example: {
      prompt:
        "In triangle $ABC$, $a=BC=9$, $b=CA=7$ and $m\\angle C=120^\\circ$. The height from $A$ meets line $BC$ at $D$. Derive the area.",
      steps: [
        "Angle $C$ is obtuse, so $D$ lies on the extension of $\\overline{BC}$ beyond $C$, outside the triangle.",
        "In right triangle $ADC$, $m\\angle ACD=180^\\circ-120^\\circ=60^\\circ$, and the hypotenuse is $\\overline{AC}=7$.",
        "So $h=7\\sin 60^\\circ$. Since $\\sin 60^\\circ=\\sin 120^\\circ$, this is $h=7\\sin 120^\\circ$.",
        "The area is $\\frac12\\cdot 9\\cdot 7\\sin 120^\\circ=\\frac12(9)(7)\\sin 120^\\circ\\approx 27.28$.",
      ],
      answer: "$\\frac12(9)(7)\\sin 120^\\circ\\approx 27.28$",
    },
    methodTitle: "Derive it in four lines",
    method: [
      "Draw the height from $A$ perpendicular to line $BC$; mark its foot $D$, inside $\\overline{BC}$ or on its extension.",
      "In right triangle $ADC$, the angle at $C$ is $C$ or $180^\\circ-C$, and its sine is $\\sin C$ either way, so $h=b\\sin C$.",
      "Area $=\\frac12\\cdot a\\cdot h=\\frac12ab\\sin C$.",
    ],
    formalTitle: "The formula and its proof",
    formal: [
      "For any triangle with sides $a$ and $b$ and included angle $C$, the area is $\\frac12ab\\sin C$.",
      "Proof: let $D$ be the foot of the perpendicular from $A$ to line $BC$. If $C$ is acute, $\\sin C=\\frac{AD}{AC}$ in right triangle $ADC$. If $C$ is obtuse, $\\sin(180^\\circ-C)=\\frac{AD}{AC}$ and $\\sin(180^\\circ-C)=\\sin C$. If $C$ is a right angle, $AD=AC$ and $\\sin C=1$. In every case $AD=b\\sin C$, so the area is $\\frac12\\cdot BC\\cdot AD=\\frac12ab\\sin C$.",
    ],
    pitfalls: [
      "Using the side the height lands on as the hypotenuse. The hypotenuse is the side the height starts from.",
      "Writing $\\cos C$ for $\\frac{h}{b}$. The height is opposite angle $C$, so the ratio is the sine.",
      "Drawing the height from $C$ itself. It splits angle $C$, so its height is written with angle $A$ or $B$.",
      "Thinking the formula fails for an obtuse angle, or that the sine of an obtuse angle is negative.",
    ],
    parentGuide:
      "Ask your learner to point to the right triangle the height makes and to say which of its sides is the hypotenuse. If the angle is obtuse, ask where the height lands.",
  }),
];

const area = "trigonometric-area.HSG.SRT.D.9";
export const trigAreaDerivationFacetMappings: FacetMapping[] = [
  {
    templateId: "trig-area-auxiliary-line",
    facetId: area,
    extent: "partial",
    rationale:
      "Places the foot of the perpendicular from a vertex to the line of the opposite side on a lattice grid, inside the base for an acute given angle and on its extension for an obtuse one, and connects that height to b sin C. The base line is horizontal or vertical; the learner does not draw the segment freehand or choose the vertex.",
  },
  {
    templateId: "trig-area-derivation-fill",
    facetId: area,
    extent: "partial",
    rationale:
      "Completes every line of the derivation of A = ½ab sin C from a drawn height: the base, the sine ratio in the right triangle, the height and the area, and for an obtuse angle where the foot lies, the supplement and why its sine is sin C. Symbolic and numeric givens, varied letters and vertex. Lines are chosen from options, not written from a blank page.",
  },
  {
    templateId: "trig-area-derivation-reasoning",
    facetId: area,
    extent: "partial",
    rationale:
      "Chooses the auxiliary line that makes the derivation work (acute and obtuse), finds the first wrong line among eight flawed derivations, chooses the justification of h = b sin C, judges which obtuse-case argument is complete, and explains why the height from the given angle's vertex does not use that angle. Recognition and judgment, not free writing.",
  },
];
