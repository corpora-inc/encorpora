import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const senses = { center: "center", image: "image-transformation" };
const noLink = ["steps", "step", "line", "lines", "point", "points"];

const intuition =
  "A tangent is a line that touches a circle at exactly one point, the point of tangency. It is perpendicular to the radius drawn to that point. So from a point $P$ outside circle $O$, the points of tangency are the points $T$ of the circle where $m\\angle OTP=90^\\circ$. Every angle inscribed in a semicircle is a right angle, so those points lie on the circle with diameter $\\overline{OP}$.";

export const tangentConstructionReasoningMethods: Record<
  string,
  ProblemMethod
> = {
  "tangent-construct-steps": {
    goal: "Choose the next step, the order of the steps, or the drawn tangent in the construction of a tangent from a point outside a circle.",
    senses,
    noLink,
    intuition: `${intuition} A construction uses only a compass (for circles) and a straightedge (for lines); every point it uses is given or is where two drawn figures cross.`,
    terms: [
      "tangent-line",
      "perpendicular-bisector",
      "compass",
      "straightedge",
    ],
    method: [
      "Construct the perpendicular bisector of $\\overline{OP}$ to find its midpoint $M$.",
      "Draw the circle with center $M$ through $O$; it also passes through $P$, so $\\overline{OP}$ is a diameter.",
      "Mark $T$ and $T'$ where it meets circle $O$, then draw lines $PT$ and $PT'$.",
    ],
    watch:
      "The helper circle is centered at the midpoint $M$, not at $O$ or $P$, and the tangent goes through $P$ and $T$, not through the center $O$.",
  },
  "tangent-construct-justify": {
    goal: "Explain why the circle with diameter $\\overline{OP}$ finds the points of tangency, why $PT$ is tangent, and what faulty constructions miss.",
    senses,
    noLink,
    intuition: `${intuition} A justification needs two facts in order: why the angle at $T$ is right, and why a right angle there makes $PT$ a tangent.`,
    terms: ["tangent-line", "inscribed-angle", "radius", "perpendicular"],
    method: [
      "Show the right angle: $T$ is on the circle with diameter $\\overline{OP}$, so $\\angle OTP$ is inscribed in a semicircle and $m\\angle OTP=90^\\circ$.",
      "Use the tangent rule: $\\overline{OT}$ is a radius of circle $O$, and a line perpendicular to a radius at its endpoint on the circle is tangent.",
      "Reject facts that are true but prove nothing about tangency, facts about the wrong circle, and facts that hold only once $PT$ is known to be tangent.",
    ],
    watch:
      "The right angle must be between $PT$ and the radius $\\overline{OT}$ at the point of contact. A line perpendicular to $\\overline{OP}$ misses the circle.",
  },
};

export const tangentConstructionReasoningPrinciples: Record<string, string> = {
  "tangent-construct-steps":
    "The points of tangency from $P$ are the points $T$ of circle $O$ with $m\\angle OTP=90^\\circ$, which are exactly where circle $O$ meets the circle with diameter $\\overline{OP}$. The perpendicular bisector of $\\overline{OP}$ gives that circle's center $M$.",
  "tangent-construct-justify":
    "An angle inscribed in a semicircle is a right angle, so $\\overline{OT}\\perp\\overline{PT}$. A line perpendicular to a radius at its endpoint on the circle is tangent to the circle.",
};

export const tangentConstructionReasoningLessons: Lesson[] = [
  {
    ...chainLesson({
      id: "tangent-from-outside-point",
      title: "Construct a tangent from a point outside a circle",
      summary:
        "From a point $P$ outside circle $O$, the tangents touch the circle where $\\overline{OP}$ makes a right angle. The circle with diameter $\\overline{OP}$ finds those points, and lines from $P$ through them are the tangents.",
      templateIds: ["tangent-construct-steps", "tangent-construct-justify"],
      objectives: [
        "Carry out, in order, the construction of the two tangents from a point outside a circle.",
        "Justify the construction with the angle in a semicircle and the radius perpendicular to a tangent.",
      ],
      openingTitle: "Where the right angle lives",
      opening: [
        "A tangent touches a circle at one point and is perpendicular to the radius there. So from point $P$ outside circle $O$, we need the points $T$ of the circle where $m\\angle OTP=90^\\circ$.",
        "An angle whose vertex is on a circle and whose sides pass through the ends of a diameter is a right angle: it is inscribed in a semicircle. So every point of the circle with diameter $\\overline{OP}$ makes a right angle with $O$ and $P$.",
        "That circle crosses circle $O$ at two points, $T$ and $T'$. They are the points of tangency, so there are two tangents from $P$.",
      ],
      example: {
        prompt:
          "Circle $O$ has radius $5$, and point $P$ is $13$ units from $O$. Construct a tangent from $P$ and check its length.",
        steps: [
          "Construct the perpendicular bisector of $\\overline{OP}$. It crosses $\\overline{OP}$ at its midpoint $M$, $6.5$ units from $O$.",
          "Draw the circle with center $M$ through $O$. It passes through $P$ too, so $\\overline{OP}$ is its diameter.",
          "Mark $T$ where it meets circle $O$. Then $\\angle OTP$ is inscribed in a semicircle, so $m\\angle OTP=90^\\circ$.",
          "Draw line $PT$. It is perpendicular to the radius $\\overline{OT}$ at $T$, so it is tangent. Check: $PT=\\sqrt{13^2-5^2}=\\sqrt{144}=12$.",
        ],
        answer: "Line $PT$, with $PT=12$",
      },
      methodTitle: "Bisect, circle, mark, draw",
      method: [
        "Bisect $\\overline{OP}$ to find $M$. Draw the circle with center $M$ through $O$. Mark where it meets circle $O$. Draw the lines from $P$ through those points.",
      ],
      formalTitle: "Why the construction works",
      formal: [
        "$MO=MP=MT$, so $T$ is on the circle with diameter $\\overline{OP}$, and an angle inscribed in a semicircle is right: $\\overline{OT}\\perp\\overline{PT}$.",
        "$\\overline{OT}$ is a radius of circle $O$, and a line perpendicular to a radius at its endpoint on the circle is tangent. So line $PT$ is tangent, and so is line $PT'$.",
      ],
      pitfalls: [
        "Centering the helper circle at $P$ or at $O$. Only the circle with diameter $\\overline{OP}$ makes the right angle.",
        "Drawing the line through $O$ and $T$. That line contains a radius; the tangent passes through $P$.",
        "Drawing the line through $P$ perpendicular to $\\overline{OP}$. It misses the circle, because the right angle belongs at the point of contact.",
      ],
      parentGuide:
        "Ask your learner to point to the right angle in the finished figure and to name the circle that guarantees it.",
    }),
    senses,
    noLink,
  },
];

export const tangentConstructionReasoningFacetMappings: FacetMapping[] = [
  {
    templateId: "tangent-construct-steps",
    facetId: "tangent-construction.HSG.C.A.4",
    extent: "partial",
    rationale:
      "Choose the next step of the tangent construction after zero to three steps, the order of its steps when one listed step does not belong, or the drawn line that is the tangent it produces. Does not assess performing the compass-and-straightedge construction.",
  },
  {
    templateId: "tangent-construct-justify",
    facetId: "tangent-construction.HSG.C.A.4",
    extent: "partial",
    rationale:
      "Justify the tangent construction: why the circle with diameter OP finds the points of tangency, why line PT is tangent, what three faulty constructions get wrong, and which second fact completes the justification. Does not assess performing the construction.",
  },
  {
    templateId: "tangent-construct-steps",
    facetId: "tangent-construction.core",
    extent: "partial",
    rationale:
      "Sequence and continue the construction of tangents from an exterior point. Physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "tangent-construct-justify",
    facetId: "tangent-construction.core",
    extent: "partial",
    rationale:
      "Justify why the radius is perpendicular to the tangent in the construction from an exterior point. Physical or drawn constructions remain unassessed.",
  },
];
