import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const GEO_SENSES = {
  side: "side",
  vertex: "vertex",
  degrees: "degree-angle",
  "corresponding angles": "corresponding-angles",
  similar: "similar-figures",
  image: "image-transformation",
  center: "center",
  radius: "radius",
  plane: "plane",
  base: "base-shape",
  face: "face-solid",
  edge: "edge",
  solid: "solid-shape",
  unit: "unit",
  tangent: "tangent-line",
} as const;
const GEO_NOLINK = [
  "opposite",
  "part",
  "parts",
  "rule",
  "rules",
  "third",
  "whole",
  "change",
  "changes",
  "square",
  "squares",
  "factor",
  "factors",
  "more than",
  "leaves",
  "mean",
  "product",
  "term",
  "terms",
  "scale",
  "multiple",
  "one third",
  "prime",
  "opposite side",
];

export const regentsGeometryCoordinateMethods: Record<string, ProblemMethod> = {
  "geo-segment-partition-point": {
    goal: "Find the point that divides a segment in a ratio by taking a fraction of the way from one endpoint to the other.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A segment is the straight piece of a line between two endpoints. A ratio $a:b$, read “$a$ to $b$”, cuts the segment into $a+b$ equal parts. The dividing point is $a$ parts from the first endpoint and $b$ parts from the second. So it is $\\frac{a}{a+b}$ of the way along, both across ($x$) and up ($y$). For $1:4$ there are 5 parts, and the point is $\\frac15$ of the way.",
    terms: [
      [
        "directed-segment",
        "Ratio $a : b$ means $a$ parts on one side of the point for every $b$ parts on the other.",
      ],
      "ratio",
      "directed-segment",
    ],
    method: [
      "Find the change in $x$ and the change in $y$ from the first endpoint to the second: second minus first.",
      "Add the parts, $a+b$, and take the fraction $\\frac{a}{a+b}$ of each change.",
      "Add these amounts to the first endpoint's coordinates.",
    ],
    watch:
      "Divide by $a+b$, not by $b$. Check that the first number of the ratio belongs to the part next to the first letter.",
  },
  "geo-circle-general-form": {
    goal: "Complete the square in $x$ and in $y$ to read a circle's center and radius from an expanded equation.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A circle with center $(h,k)$ and radius $r$ has the equation $(x-h)^2+(y-k)^2=r^2$. The radius is the distance from the center to the circle, and $(x-h)^2$ means $(x-h)$ times itself. Multiplying out the squares hides the center and radius. Completing the square undoes that. It rewrites $x^2-6x$ as $(x-3)^2-9$ by adding, and taking away, the square of half the middle number.",
    terms: ["general-form", "completing-the-square"],
    method: [
      "If $x^2$ and $y^2$ share a number in front (a coefficient) other than 1, divide every term by it.",
      "Move the lone number to the right side, and group the $x$ terms and the $y$ terms. Take half of each middle number, square it, and add it to both sides.",
      "Write $(x-h)^2+(y-k)^2=r^2$. The center is $(h,k)$, and the radius is the square root of the right side.",
    ],
    watch:
      "The center has the opposite sign from the number inside each parenthesis: $(x-3)^2$ means $h=3$. The right side is $r^2$, not $r$.",
  },
  "geo-line-point-slope-choice": {
    goal: "Write a line's point-slope equation using the slope of a parallel or perpendicular line and a given point.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A line is fixed by its slope and one point. Slope is steepness: the change in $y$ divided by the change in $x$ between two points. Parallel lines are lines that never meet, and they have the same slope. Perpendicular lines are lines that meet at a right angle, a square corner. When neither is vertical or horizontal, their slopes are opposite reciprocals: flip the fraction and change the sign, so $\\frac32$ pairs with $-\\frac23$. Point-slope form, $y-y_1=m(x-x_1)$, uses a slope $m$ and a point $(x_1,y_1)$.",
    terms: ["point-slope-form", "negative-reciprocal"],
    method: [
      "Find the slope of the given line: change in $y$ divided by change in $x$.",
      "Use the same slope for a parallel line, or the opposite reciprocal for a perpendicular line.",
      "Put the new point in as $(x_1,y_1)$. Its coordinates are subtracted.",
    ],
    watch:
      "A negative coordinate becomes a plus sign: through $(-4,3)$ gives $y-3$ and $x+4$. Do not use a point from the given line.",
  },
  "geo-line-pair-relationship": {
    goal: "Compare the slopes of two lines, one in standard form, to decide whether they are parallel, perpendicular, the same line or neither.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "Two lines in a flat plane either cross, never meet, or are the same line. Slope, the steepness, tells which. Equal slopes mean parallel lines or the same line. Slopes that multiply to $-1$ mean the lines meet at a right angle: they are perpendicular. Standard form is $Ax+By=C$. When $B\\ne0$, solving for $y$ shows that the slope is $-\\frac{A}{B}$. The $y$-intercept is where a line crosses the $y$-axis.",
    terms: [
      ["standard-form-line", "Its slope is $-\\frac{A}{B}$."],
      [
        "line",
        "Two equations give the same line when they have exactly the same solutions.",
      ],
    ],
    method: [
      "Find the slope of each line. Solve a standard-form equation for $y$ if needed.",
      "If the slopes are equal, compare the $y$-intercepts. Different intercepts mean parallel lines, and equal ones mean the same line.",
      "If the slopes multiply to $-1$, the lines are perpendicular. Otherwise they are neither.",
    ],
    watch:
      "Slopes such as 2 and $-2$ have opposite signs but multiply to $-4$, so they are not perpendicular. Equal slopes with equal intercepts are the same line, not parallel lines.",
  },
  "geo-dilation-line-image": {
    goal: "Find the image of a line under a dilation centered at the origin by scaling its intercept and keeping its slope.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A dilation about the origin, the point $(0,0)$, multiplies every point's coordinates by the scale factor $k$. A line that misses the origin is sent to a parallel line, with the same slope. Its $y$-intercept point $(0,b)$, where it crosses the $y$-axis, goes to $(0,kb)$. A line through the origin stays where it is.",
    terms: ["scale-factor", "image-transformation"],
    method: [
      "Pick a point on the line that is easy to scale, such as the $y$-intercept $(0,b)$.",
      "Multiply its coordinates by the scale factor, giving the image's $y$-intercept $kb$.",
      "Keep the slope, because the image is parallel to the original or is the same line.",
    ],
    watch:
      "Multiply the intercept by $k$ once, not by $k^2$. The slope does not change.",
  },
};

export const regentsGeometryCoordinatePrinciples: Record<string, string> = {
  "geo-segment-partition-point":
    "The point $P$ on $\\overline{AB}$ with $AP:PB=a:b$ is $\\frac{a}{a+b}$ of the way from $A$ to $B$. Each coordinate of $P$ is the coordinate of $A$ plus $\\frac{a}{a+b}$ times the change from $A$ to $B$.",
  "geo-circle-general-form":
    "Completing the square in $x^2+y^2+Dx+Ey+F=0$ gives $(x+\\frac D2)^2+(y+\\frac E2)^2=\\frac{D^2+E^2}{4}-F$. When the right side is positive, this is a circle with center $(-\\frac D2,-\\frac E2)$, and its radius is the square root of the right side.",
  "geo-line-point-slope-choice":
    "Two different lines that are not vertical are parallel exactly when their slopes are equal. They are perpendicular exactly when their slopes multiply to $-1$. The line through $(x_1,y_1)$ with slope $m$ is $y-y_1=m(x-x_1)$.",
  "geo-line-pair-relationship":
    "Two lines that are not vertical, with slopes $m_1$ and $m_2$, are parallel or the same line when $m_1=m_2$, and perpendicular when $m_1m_2=-1$. The same line also has the same $y$-intercept.",
  "geo-dilation-line-image":
    "A dilation with center $O$ and scale factor $k$ maps a line not through $O$ to a parallel line. With its center at the origin, it maps $y=mx+b$ to $y=mx+kb$.",
};

export const regentsGeometryCoordinateLessons = [
  {
    ...chainLesson({
      id: "regents-geometry-segment-ratio",
      title: "Dividing a segment in a ratio",
      summary:
        "A ratio such as 1:4 splits a segment into equal parts: 1 part on one side of the point and 4 on the other, so 5 parts in all. The point is one fifth of the way from the first endpoint. Going that fraction of the way changes each coordinate by that fraction of its total change.",
      templateIds: ["geo-segment-partition-point"],
      objectives: [
        "Turn a ratio $a:b$ into the fraction $\\frac{a}{a+b}$ of the way along the segment.",
        "Apply that fraction to the change across and the change up to find the point.",
      ],
      openingTitle: "A ratio is a number of equal parts",
      opening: [
        "A segment is the straight piece of a line between two endpoints. A ratio compares sizes: 1:4, read “1 to 4”, means 1 part for every 4 parts. So a 1:4 ratio cuts a segment into $1+4=5$ equal parts. The dividing point has one part on one side and four on the other, so it is one fifth of the way from the first endpoint.",
        "Points are named by coordinates: $(x, y)$ is $x$ units across and $y$ units up. Going one fifth of the way along a segment changes $x$ by one fifth of its total change, and $y$ by one fifth of its total change.",
      ],
      example: {
        prompt:
          "Point $P$ lies on $\\overline{AB}$ with $A(-3,\\ 2)$, $B(7,\\ -8)$ and $AP:PB=1:4$. Find $P$.",
        steps: [
          "Find the changes from $A$ to $B$, second minus first. $x$ changes by $7-(-3)=10$, and $y$ changes by $-8-2=-10$.",
          "The ratio $1:4$ makes $1+4=5$ equal parts, and $P$ is 1 part from $A$. So $P$ is $\\frac15$ of the way.",
          "Add $\\frac15$ of each change to $A$: $x=-3+\\frac15(10)=-1$ and $y=2+\\frac15(-10)=0$. So $P=(-1,\\ 0)$.",
        ],
        answer: "$(-1,\\ 0)$",
      },
      methodTitle: "Changes, fraction, add",
      method: [
        "Find the change in each coordinate from the first endpoint to the second.",
        "Multiply each change by $\\frac{a}{a+b}$ and add it to the first endpoint.",
      ],
      formalTitle: "The section formula",
      formal: [
        "If $AP:PB=a:b$ with $A(x_1,y_1)$ and $B(x_2,y_2)$, then $P=\\left(x_1+\\frac{a}{a+b}(x_2-x_1),\\ y_1+\\frac{a}{a+b}(y_2-y_1)\\right)$. The small 1 and 2 (subscripts) name the two endpoints.",
        "Equal steps along a segment make equal steps in $x$ and equal steps in $y$, because a segment runs in one steady direction.",
      ],
      pitfalls: [
        "Divide by $a+b$, the number of parts, not by $b$.",
        "Measure the first number of the ratio from the first named endpoint.",
        "Use the same fraction for both coordinates.",
      ],
      parentGuide:
        "Ask your learner to check that the point lies between the endpoints, closer to the end with fewer parts.",
    }),
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
  },
  {
    ...chainLesson({
      id: "regents-geometry-circle-general-form",
      title: "Center and radius from an expanded circle equation",
      summary:
        "A circle's center is the point in its middle, and its radius is the distance from the center to the circle. A circle's equation can be written to show both: $(x-3)^2+(y+2)^2=25$ has center $(3,-2)$ and radius 5. Multiplied out, the same equation hides them: $x^2+y^2-6x+4y-12=0$. Completing the square means adding the right number to make a perfect square, such as $(x-3)^2$. It gets the center and radius back.",
      templateIds: ["geo-circle-general-form"],
      objectives: [
        "Complete the square in both $x$ and $y$ to rewrite a circle's equation.",
        "Read the center and radius, dividing out a shared number in front of $x^2$ and $y^2$ first when there is one.",
      ],
      openingTitle: "The equation hides its center",
      opening: [
        "A circle is all the points at one distance from a center point. That distance is the radius. A circle with center $(h,k)$ and radius $r$ has the equation $(x-h)^2+(y-k)^2=r^2$. Here $(x-h)^2$ means $(x-h)$ times $(x-h)$.",
        "Multiplying out the squares scatters the information among the terms, the parts joined by plus and minus signs. For example, $(x-3)^2=x^2-6x+9$.",
        "Completing the square undoes this. Take half of the number in front of $x$, here $-6\\div2=-3$, and square it to get 9. Then $x^2-6x+9=(x-3)^2$, a perfect square. Whatever you add to one side, add to the other side too, so the equation stays true.",
      ],
      example: {
        prompt:
          "A circle has the equation $x^2+y^2-6x+4y-12=0$. What are its center and radius?",
        steps: [
          "Move the lone number to the right, and group the $x$ terms and the $y$ terms: $(x^2-6x)+(y^2+4y)=12$.",
          "Complete each square. Half of $-6$ is $-3$, and $(-3)^2=9$. Half of 4 is 2, and $2^2=4$. Add 9 and 4 to both sides: $(x-3)^2+(y+2)^2=12+9+4=25$.",
          "Read the center with the opposite signs: $(3,-2)$. The number on the right is $r^2=25$, so the radius is $\\sqrt{25}=5$, the square root of 25.",
        ],
        answer: "center $(3,\\ -2)$, radius $5$",
      },
      methodTitle: "Divide, group, complete, read",
      method: [
        "Divide every term by the shared number in front of $x^2$ and $y^2$ if it is not 1.",
        "Add the square of half the middle number to both sides, for $x$ and for $y$.",
        "Read $h$ and $k$ with the opposite signs from the parentheses, and take the square root of the right side.",
      ],
      formalTitle: "Why the signs flip",
      formal: [
        "$(x-h)^2=x^2-2hx+h^2$, so a middle term of $-2hx$ comes from a center at $x=h$. That is why the signs flip.",
        "For $x^2+y^2+Dx+Ey+F=0$, completing both squares leaves $r^2=h^2+k^2-F$ on the right, where $h=-\\frac D2$ and $k=-\\frac E2$. It must be positive for a circle to exist.",
      ],
      pitfalls: [
        "The center's signs are opposite to those inside the parentheses.",
        "The number on the right is $r^2$, so take its square root.",
        "Add each completed square to both sides, not to one side only.",
      ],
      parentGuide:
        "Ask your learner to check a point. The center moved right by the radius, $(8,-2)$ here, must make the original equation true.",
    }),
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
  },
  {
    ...chainLesson({
      id: "regents-geometry-lines-and-dilations",
      title: "Parallel, perpendicular and dilated lines",
      summary:
        "Slope measures how steep a line is. Parallel lines, which never meet, have the same slope. Perpendicular lines, which meet at a square corner, have slopes that multiply to $-1$, as long as neither line is vertical. A dilation about the origin keeps a line's slope and multiplies its $y$-intercept by the scale factor.",
      templateIds: [
        "geo-line-point-slope-choice",
        "geo-line-pair-relationship",
        "geo-dilation-line-image",
      ],
      objectives: [
        "Use equal slopes for parallel lines, and opposite reciprocal slopes for perpendicular lines.",
        "Write point-slope equations, and classify two lines from their equations.",
        "Find the image of a line under a dilation centered at the origin.",
      ],
      openingTitle: "Slope describes direction",
      opening: [
        "The slope of a line says how steep it is and which way it leans. It is the change in $y$ divided by the change in $x$ between two points. Lines with the same slope point the same way, so they are parallel or are the same line.",
        "Perpendicular lines meet at a right angle, a square corner. If neither is vertical (straight up and down) or horizontal, their slopes multiply to $-1$. So each slope is the opposite reciprocal of the other: flip the fraction and change its sign. For example, $\\frac32\\times(-\\frac23)=-1$.",
        "A line's $y$-intercept is where it crosses the $y$-axis. A dilation about the origin, the point $(0,0)$, multiplies both numbers of every point, $x$ and $y$, by the scale factor $k$. It keeps directions, so a line that misses the origin goes to a parallel line, and its $y$-intercept $b$ goes to $kb$. A line through the origin stays put.",
      ],
      example: {
        prompt:
          "Find a point-slope equation of the line through $(2,\\ -1)$ that is perpendicular to the line through $(0,\\ 3)$ and $(4,\\ 9)$.",
        steps: [
          "Find the given line's slope from its two points, change in $y$ over change in $x$: $\\frac{9-3}{4-0}=\\frac32$.",
          "A perpendicular line has the opposite reciprocal slope. Flip $\\frac32$ to $\\frac23$ and change the sign, giving $-\\frac23$. Check: $\\frac32\\times(-\\frac23)=-1$.",
          "Point-slope form is the equation $y-y_1=m(x-x_1)$, for slope $m$ through the point $(x_1,y_1)$. Put in $m=-\\frac23$ and the point $(2,-1)$: $y-(-1)=-\\frac23(x-2)$, which is $y+1=-\\frac23(x-2)$.",
        ],
        answer: "$y+1=-\\frac{2}{3}(x-2)$",
      },
      methodTitle: "Find the slope, relate it, use the point",
      method: [
        "Find the slope from two points, or solve a standard-form equation for $y$.",
        "Use the same slope for a parallel line, and the opposite reciprocal for a perpendicular line. A horizontal line is a flat one, with slope 0. It is perpendicular to a vertical line, which has no slope.",
        "For a dilation about the origin, multiply the $y$-intercept by the scale factor and keep the slope.",
      ],
      formalTitle: "Slope conditions",
      formal: [
        "Two different lines that are not vertical are parallel exactly when they have the same slope. They are perpendicular exactly when their slopes multiply to $-1$.",
        "A dilation with scale factor $k$ about the origin maps $(x,y)$ to $(kx,ky)$, so $y=mx+b$ becomes $y=mx+kb$.",
      ],
      pitfalls: [
        "Do not stop at the reciprocal. Change the sign too.",
        "Equal slopes and equal intercepts mean the same line, not two parallel lines.",
        "A dilation about the origin multiplies the intercept by the scale factor, unless the intercept is 0.",
      ],
      parentGuide:
        "Have your learner test a perpendicular slope by checking that the two slopes multiply to $-1$.",
    }),
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
  },
];

const m = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({
  templateId,
  facetId,
  extent: "partial",
  rationale,
});
export const regentsGeometryCoordinateFacetMappings: FacetMapping[] = [
  m(
    "geo-segment-partition-point",
    "segment-division.core",
    "Single choice of the coordinate pair for a point dividing a segment in a ratio of positive integers, stated from either endpoint, with integer coordinates. Does not assess external division, finding an endpoint or a missing ratio, or one coordinate by entry.",
  ),
  m(
    "geo-circle-general-form",
    "circle-equations.core",
    "Single choice of the center and radius from a circle's expanded equation, monic or with a common factor. Does not assess writing an equation from a center and radius, graphing, or circles with irrational radii.",
  ),
  m(
    "geo-line-point-slope-choice",
    "slope-proofs.core",
    "Single choice of a point-slope equation of the parallel or perpendicular line through a point, from the line through two points. Does not assess slope-intercept or standard form answers, or proofs using slope.",
  ),
  m(
    "geo-line-pair-relationship",
    "slope-proofs.core",
    "Single choice classifying a slope-intercept line and a standard-form line as parallel, perpendicular, identical or neither. Does not assess vertical or horizontal lines or proofs using slope.",
  ),
  m(
    "geo-dilation-line-image",
    "dilation-properties.core",
    "Single choice of the equation of the image of a line that misses the center of a dilation at the origin, with an enlarging or reducing scale factor. Does not assess other centers, lines through the center, or the proof that a dilation maps a line to a parallel line.",
  ),
];
