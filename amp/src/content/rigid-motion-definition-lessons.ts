import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const senses = { image: "image-transformation", center: "center" };
const noLink = [
  "condition",
  "conditions",
  "side",
  "way",
  "turn",
  "point",
  "points",
];

const intuition =
  "A transformation sends every point $P$ of the plane to an image point $P'$. A definition of a motion must say exactly where $P'$ is for every $P$: one condition usually allows many points, and two conditions together pin down one.";

export const rigidMotionDefinitionMethods: Record<string, ProblemMethod> = {
  "rigid-motion-definition-select": {
    goal: "Choose the statement that defines a reflection, rotation or translation, add a missing condition, or name the motion defined.",
    senses,
    noLink,
    intuition: `${intuition} A reflection uses a perpendicular bisector, a rotation a circle and an angle, and a translation parallel segments of equal length.`,
    terms: ["reflection", "rotation", "translation", "perpendicular-bisector"],
    method: [
      "For each statement, ask whether two different points could both fit it. If so, it is not yet a definition.",
      "Check that it describes the right motion: the direction of a turn, the way a translation points, which points stay put.",
      "To repair a statement, choose the condition that the true image meets and the counterexample fails.",
    ],
    watch:
      "Keep both conditions: equal distance from the mirror needs the perpendicular, a circle needs the angle and its direction, an equal length needs the parallel direction.",
  },
  "rigid-motion-definition-check": {
    goal: "Test a claimed image against each condition in the definition of a reflection, rotation or translation, then decide if it is the image.",
    senses,
    noLink,
    intuition: `${intuition} On a coordinate plane, each condition can be checked exactly with the coordinates.`,
    terms: ["reflection", "rotation", "translation", "vector"],
    method: [
      "Reflection: $\\overline{PP'}\\perp m$ (the step from $P$ to $P'$ has dot product $0$ with $m$'s direction), and $m$ passes through the midpoint of $\\overline{PP'}$.",
      "Rotation: $CP'^2=CP^2$, and $\\overrightarrow{CP}$ turned by the angle counterclockwise points along $\\overrightarrow{CP'}$. Translation: $\\overrightarrow{PP'}$ is a positive multiple of $\\overrightarrow{AB}$, and $PP'^2=AB^2$.",
      "Answer yes only when both conditions hold; either one alone allows other points.",
    ],
    watch:
      "Check each condition on its own with the numbers. A point at the right distance can still be in the wrong direction, and the reverse.",
  },
  "rigid-motion-definition-slots": {
    goal: "Complete the definition of a reflection, rotation or translation from its parts, reading the marks on the figure.",
    senses,
    noLink,
    intuition: `${intuition} The marks on a figure say which parts the definition uses: a box for perpendicular, equal ticks for equal lengths, an arc for an angle, arrows for direction.`,
    terms: ["reflection", "rotation", "translation", "perpendicular"],
    method: [
      "Read each mark: a box means perpendicular, equal ticks mean equal lengths, an arc at a point means the angle is measured there, arrowheads give the direction.",
      "Fill each blank with the part the mark shows, and check that the whole sentence allows exactly one image $P'$.",
    ],
    watch:
      "Measure a rotation's angle at the center $C$, counterclockwise from ray $CP$, and keep $P'$ on the circle through $P$.",
  },
};

export const rigidMotionDefinitionPrinciples: Record<string, string> = {
  "rigid-motion-definition-select":
    "Reflection across $m$: points of $m$ are fixed, and $m$ is the perpendicular bisector of $\\overline{PP'}$. Rotation about $C$ by $\\theta^\\circ$: $C$ is fixed, $CP'=CP$ and $m\\angle PCP'=\\theta^\\circ$ counterclockwise. Translation along $\\overrightarrow{AB}$: $\\overline{PP'}\\parallel\\overline{AB}$, $PP'=AB$, same direction.",
  "rigid-motion-definition-check":
    "$P'$ is the image exactly when it satisfies both conditions of the definition; each condition alone is satisfied by a whole line or circle of points.",
  "rigid-motion-definition-slots":
    "Each rigid motion is defined with angles, circles, perpendicular lines, parallel lines and segments, so that every point $P$ has exactly one image $P'$.",
};

export const rigidMotionDefinitionLessons: Lesson[] = [
  {
    ...chainLesson({
      id: "defining-rigid-motions",
      title: "Define reflections, rotations and translations",
      summary:
        "A reflection, a rotation and a translation are each defined by where they send every point. Each definition combines two conditions, built from perpendicular bisectors, circles and angles, or parallel segments of equal length.",
      templateIds: [
        "rigid-motion-definition-select",
        "rigid-motion-definition-check",
        "rigid-motion-definition-slots",
      ],
      objectives: [
        "State the definitions of a reflection, a rotation and a translation using perpendicular bisectors, circles, angles and parallel segments.",
        "Test a statement or a claimed image against a definition, and find the point that shows a statement is not yet a definition.",
      ],
      openingTitle: "One point, two conditions",
      opening: [
        "A transformation sends each point $P$ to an image point $P'$. To define one, we must say exactly where $P'$ is.",
        "One condition is rarely enough. Being as far from line $m$ as $P$, on the other side, allows a whole line of points. Being on the perpendicular to $m$ through $P$ allows another whole line.",
        "The two lines cross at one point, and that point is the reflection of $P$. Every rigid motion is defined this way: two conditions that together allow exactly one point.",
      ],
      example: {
        prompt:
          "Line $m$ is $y=2$. Is $P'(4,-1)$ the reflection of $P(1,5)$ across $m$?",
        steps: [
          "First condition, $\\overline{PP'}\\perp m$: line $m$ is horizontal, so $\\overline{PP'}$ must be vertical. It goes from $x=1$ to $x=4$, so it is not vertical. No.",
          "Second condition, $m$ passes through the midpoint of $\\overline{PP'}$: the midpoint is $(2.5,2)$, which is on $y=2$. Yes.",
          "Only one condition holds, so $P'$ is not the image. The image is $(1,-1)$: straight down from $P$, $3$ units on each side of $m$.",
        ],
        answer: "No; the image is $(1,-1)$",
      },
      methodTitle: "Check both conditions",
      method: [
        "Reflection across $m$: $\\overline{PP'}$ is perpendicular to $m$, and $m$ passes through its midpoint. Points of $m$ stay put.",
        "Rotation about $C$ by $\\theta^\\circ$: $CP'=CP$, and $m\\angle PCP'=\\theta^\\circ$ counterclockwise from ray $CP$. $C$ stays put.",
        "Translation along $\\overrightarrow{AB}$: $\\overline{PP'}$ is parallel to line $AB$ and points the same way, and $PP'=AB$.",
      ],
      formalTitle: "The definitions",
      formal: [
        "The reflection across line $m$ sends each point of $m$ to itself and each other point $P$ to the point $P'$ such that $m$ is the perpendicular bisector of $\\overline{PP'}$.",
        "The rotation about $C$ by $\\theta^\\circ$ sends $C$ to itself and each other point $P$ to the point $P'$ on the circle with center $C$ through $P$ with $m\\angle PCP'=\\theta^\\circ$, counterclockwise from ray $CP$. The translation along $\\overrightarrow{AB}$ sends each $P$ to the point $P'$ with $\\overline{PP'}$ parallel to (or on) line $AB$, $PP'=AB$, and $P'$ the same way from $P$ as $B$ is from $A$.",
      ],
      pitfalls: [
        "Defining a reflection by equal distances alone: every point of a line parallel to $m$ qualifies.",
        "Leaving out the direction: a clockwise turn, or a translation the opposite way, is a different motion.",
        "Writing a coordinate rule such as $(x,y)\\to(x,-y)$ as the definition: it works for one mirror line only.",
      ],
      parentGuide:
        "Ask your learner to state one condition of a definition and find two different points that satisfy it. Then ask which second condition rules one of them out.",
    }),
    senses,
    noLink,
  },
];

export const rigidMotionDefinitionFacetMappings: FacetMapping[] = [
  {
    templateId: "rigid-motion-definition-select",
    facetId: "transformation-invariants.HSG.CO.A.4",
    extent: "partial",
    rationale:
      "Choose the definition of a reflection, rotation or translation against incomplete or wrong ones, add the condition a drawn counterexample fails, or name the motion a definition describes. Does not assess writing a definition freely.",
  },
  {
    templateId: "rigid-motion-definition-check",
    facetId: "transformation-invariants.HSG.CO.A.4",
    extent: "partial",
    rationale:
      "Test a claimed image on a coordinate plane against both conditions in the definition of a reflection, a rotation of 90, 180 or 270 degrees, or a translation, and decide whether it is the image. Does not assess writing a definition.",
  },
  {
    templateId: "rigid-motion-definition-slots",
    facetId: "transformation-invariants.HSG.CO.A.4",
    extent: "partial",
    rationale:
      "Complete the definition of a reflection, rotation or translation, choosing each part (fixed points, perpendicular bisector, circle, angle vertex and direction, parallel and equal segments) from the figure's marks. Does not assess writing a definition freely.",
  },
  {
    templateId: "rigid-motion-definition-select",
    facetId: "transformation-invariants.core",
    extent: "partial",
    rationale:
      "Recognize and repair definitions of the three rigid motions. Physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "rigid-motion-definition-check",
    facetId: "transformation-invariants.core",
    extent: "partial",
    rationale:
      "Verify a claimed image against the definition of a rigid motion with coordinates. Physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "rigid-motion-definition-slots",
    facetId: "transformation-invariants.core",
    extent: "partial",
    rationale:
      "Assemble the definitions of the three rigid motions from their parts. Physical or drawn constructions remain unassessed.",
  },
];
