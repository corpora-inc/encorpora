import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsGeometryCoordinateMethods: Record<string, ProblemMethod> = {
  "geo-segment-partition-point": {
    goal: "Find the point that divides a segment in a ratio by taking a fraction of the way from one endpoint to the other.",
    intuition:
      "A ratio $a:b$ cuts a segment into $a+b$ equal parts. The dividing point is $a$ of those parts from the first endpoint, so it is $\\frac{a}{a+b}$ of the way along the segment, in both the horizontal and the vertical direction.",
    terms: [
      [
        "directed-segment",
        "Ratio $a : b$ means $a$ parts on one side of the point for every $b$ parts on the other.",
      ],
      "ratio",
      "directed-segment",
    ],
    method: [
      "Find the change in $x$ and the change in $y$ from the first endpoint to the second.",
      "Add the total number of parts, $a+b$, and take the fraction $\\frac{a}{a+b}$ of each change.",
      "Add these amounts to the first endpoint's coordinates.",
    ],
    watch:
      "Divide by $a+b$, not by $b$. Check that the first number of the ratio belongs to the part next to the first letter.",
  },
  "geo-circle-general-form": {
    goal: "Complete the square in $x$ and in $y$ to read a circle's center and radius from an expanded equation.",
    intuition:
      "The expanded equation hides the center and radius. Completing the square rewrites $x^2-2hx$ as $(x-h)^2-h^2$, which shows the center's coordinates and moves the extra squares to the other side of the equation.",
    terms: ["general-form", "completing-the-square"],
    method: [
      "If the squared terms have a common coefficient, divide every term by it.",
      "Move the constant, group the $x$ terms and the $y$ terms, and add $(D/2)^2$ and $(E/2)^2$ to both sides.",
      "Write $(x-h)^2+(y-k)^2=r^2$, so the center is $(h,k)$ and the radius is the square root of the right side.",
    ],
    watch:
      "The center has the opposite sign from the number inside each parenthesis. The right side is $r^2$, not $r$.",
  },
  "geo-line-point-slope-choice": {
    goal: "Write a line's point-slope equation using the slope of a parallel or perpendicular line and a given point.",
    intuition:
      "A line is fixed by its slope and one point. Parallel lines have the same slope, and perpendicular lines have slopes that are opposite reciprocals. Point-slope form $y-y_1=m(x-x_1)$ puts these two facts together.",
    terms: ["point-slope-form", "negative-reciprocal"],
    method: [
      "Find the slope of the given line as change in $y$ over change in $x$.",
      "Use the same slope for a parallel line, or the opposite reciprocal for a perpendicular line.",
      "Substitute the new point as $(x_1,y_1)$, remembering that coordinates are subtracted.",
    ],
    watch:
      "A negative coordinate becomes a plus sign: through $(-4,3)$ gives $y-3$ and $x+4$. Do not use a point from the given line.",
  },
  "geo-line-pair-relationship": {
    goal: "Compare the slopes of two lines, one written in standard form, to decide whether they are parallel, perpendicular, the same or neither.",
    intuition:
      "Two lines in a plane either cross or never meet. Their slopes tell which: equal slopes mean parallel or the same line, and slopes that multiply to $-1$ mean the lines meet at a right angle.",
    terms: [
      ["standard-form-line", "Its slope is $-\\frac{A}{B}$."],
      [
        "line",
        "Two equations give the same line when they have exactly the same solutions.",
      ],
    ],
    method: [
      "Read or compute the slope of each line; solve the standard form for $y$ if needed.",
      "Equal slopes: compare the $y$-intercepts to separate parallel from the same line.",
      "Slopes whose product is $-1$ are perpendicular; otherwise the lines are neither.",
    ],
    watch:
      "Slopes of opposite sign, such as $2$ and $-2$, are not perpendicular. Equal slopes with equal intercepts are the same line, not parallel.",
  },
  "geo-dilation-line-image": {
    goal: "Find the image of a line under a dilation centered at the origin by scaling its intercept and keeping its slope.",
    intuition:
      "A dilation about the origin multiplies every point's distance from the origin by the scale factor. A line that misses the center is sent to a parallel line, and its $y$-intercept point is carried to the new intercept.",
    terms: ["scale-factor", "image-transformation"],
    method: [
      "Find a point on the line that is easy to scale, such as the $y$-intercept $(0,b)$.",
      "Multiply its coordinates by the scale factor to get the image's $y$-intercept $kb$.",
      "Keep the slope, because the image is parallel to the original.",
    ],
    watch:
      "Multiply the intercept by $k$ once, not by $k^2$. The slope does not change.",
  },
};

export const regentsGeometryCoordinatePrinciples: Record<string, string> = {
  "geo-segment-partition-point":
    "The point $P$ on $\\overline{AB}$ with $AP:PB=a:b$ has coordinates $A+\\frac{a}{a+b}(B-A)$ in each coordinate.",
  "geo-circle-general-form":
    "Completing the square in $x^2+y^2+Dx+Ey+F=0$ gives $(x+\\frac D2)^2+(y+\\frac E2)^2=\\frac{D^2+E^2}{4}-F$, a circle with center $(-\\frac D2,-\\frac E2)$ when the right side is positive.",
  "geo-line-point-slope-choice":
    "Non-vertical lines are parallel exactly when their slopes are equal, and perpendicular exactly when the product of their slopes is $-1$. The line through $(x_1,y_1)$ with slope $m$ is $y-y_1=m(x-x_1)$.",
  "geo-line-pair-relationship":
    "Two non-vertical lines with slopes $m_1,m_2$ are parallel or identical when $m_1=m_2$, and perpendicular when $m_1m_2=-1$. Identical lines also share an intercept.",
  "geo-dilation-line-image":
    "A dilation with center $O$ and scale factor $k$ maps a line not through $O$ to a parallel line, and maps $y=mx+b$ with center the origin to $y=mx+kb$.",
};

export const regentsGeometryCoordinateLessons = [
  chainLesson({
    id: "regents-geometry-segment-ratio",
    title: "Dividing a segment in a ratio",
    summary:
      "Find the coordinates of the point that splits a segment in a ratio such as 1:4 or 5:4.",
    templateIds: ["geo-segment-partition-point"],
    objectives: [
      "Turn a ratio $a:b$ into the fraction $\\frac{a}{a+b}$ of the way along the segment.",
      "Apply the fraction to the horizontal and vertical changes to get the point.",
    ],
    openingTitle: "A ratio is a number of equal parts",
    opening: [
      "A ratio such as 1:4 cuts a segment into 5 equal parts: one part on one side of the dividing point and four on the other. The point is one fifth of the way from the first endpoint.",
      "Moving along a segment changes $x$ and $y$ by the same fraction of their total changes.",
    ],
    example: {
      prompt:
        "Point $P$ lies on $\\overline{AB}$ with $A(-3,\\ 2)$, $B(7,\\ -8)$ and $AP:PB=1:4$. Find $P$.",
      steps: [
        "From $A$ to $B$, $x$ changes by $7-(-3)=10$ and $y$ changes by $-8-2=-10$.",
        "$1+4=5$ equal parts, and $P$ is $\\frac15$ of the way.",
        "$x=-3+\\frac15(10)=-1$ and $y=2+\\frac15(-10)=0$, so $P=(-1,\\ 0)$.",
      ],
      answer: "$(-1,\\ 0)$",
    },
    methodTitle: "Changes, fraction, add",
    method: [
      "Compute the change in each coordinate from the first endpoint to the second.",
      "Multiply each change by $\\frac{a}{a+b}$ and add it to the first endpoint.",
    ],
    formalTitle: "The section formula",
    formal: [
      "If $AP:PB=a:b$, then $P=\\left(x_1+\\frac{a}{a+b}(x_2-x_1),\\ y_1+\\frac{a}{a+b}(y_2-y_1)\\right)$.",
      "Equal parts along a segment project to equal parts on each axis, because the coordinate changes are proportional to the distance.",
    ],
    pitfalls: [
      "Divide by $a+b$, the number of parts, not by $b$.",
      "Measure the first number of the ratio from the first named endpoint.",
      "Use the same fraction for both coordinates.",
    ],
    parentGuide:
      "Ask your learner to check that the point is between the endpoints and closer to the end with fewer parts.",
  }),
  chainLesson({
    id: "regents-geometry-circle-general-form",
    title: "Center and radius from an expanded circle equation",
    summary:
      "Complete the square in $x$ and $y$ to read the center and radius, even when the equation has a common factor.",
    templateIds: ["geo-circle-general-form"],
    objectives: [
      "Complete the square in both variables to rewrite a circle's equation.",
      "Read the center and radius, and divide out a common factor first when there is one.",
    ],
    openingTitle: "The equation hides its center",
    opening: [
      "A circle with center $(h,k)$ and radius $r$ has the equation $(x-h)^2+(y-k)^2=r^2$. Expanding the squares scatters the information among the terms.",
      "Completing the square undoes the expansion: it turns each pair of $x^2$ and $x$ terms back into a squared binomial.",
    ],
    example: {
      prompt:
        "A circle has the equation $x^2+y^2-6x+4y-12=0$. What are its center and radius?",
      steps: [
        "Group: $(x^2-6x)+(y^2+4y)=12$.",
        "Add $9$ and $4$ to both sides: $(x-3)^2+(y+2)^2=25$.",
        "The center is $(3,-2)$ and the radius is $\\sqrt{25}=5$.",
      ],
      answer: "center $(3,\\ -2)$, radius $5$",
    },
    methodTitle: "Divide, group, complete, read",
    method: [
      "Divide every term by the shared coefficient of $x^2$ and $y^2$ if it is not 1.",
      "Add the square of half the linear coefficient to both sides, for $x$ and for $y$.",
      "Read $h$ and $k$ with the opposite sign from the parentheses, and take the square root of the right side.",
    ],
    formalTitle: "Why the signs flip",
    formal: [
      "$(x-h)^2=x^2-2hx+h^2$, so a linear coefficient of $-2h$ comes from a center at $x=h$.",
      "The right side after completing both squares is $r^2=h^2+k^2-F$ and must be positive for a circle to exist.",
    ],
    pitfalls: [
      "The center's signs are opposite to those inside the parentheses.",
      "The number on the right is $r^2$; take its square root.",
      "Add completed squares to both sides, not to one side only.",
    ],
    parentGuide:
      "Ask your learner to check a point: the center plus the radius in the $x$ direction must satisfy the original equation.",
  }),
  chainLesson({
    id: "regents-geometry-lines-and-dilations",
    title: "Parallel, perpendicular and dilated lines",
    summary:
      "Use slopes to write the parallel or perpendicular line through a point, classify a pair of lines, and dilate a line.",
    templateIds: [
      "geo-line-point-slope-choice",
      "geo-line-pair-relationship",
      "geo-dilation-line-image",
    ],
    objectives: [
      "Use equal slopes for parallel lines and opposite reciprocal slopes for perpendicular lines.",
      "Write point-slope equations and classify two lines from their equations.",
      "Find the image of a line under a dilation centered at the origin.",
    ],
    openingTitle: "Slope describes direction",
    opening: [
      "The slope of a line says how steep it is and which way it leans. Lines with the same slope point the same way, so they are parallel or identical. Lines whose slopes multiply to $-1$ meet at a right angle.",
      "A dilation about the origin stretches or shrinks the plane. It keeps directions, so a line goes to a parallel line, but it scales distances from the origin.",
    ],
    example: {
      prompt:
        "Find a point-slope equation of the line through $(2,\\ -1)$ that is perpendicular to the line through $(0,\\ 3)$ and $(4,\\ 9)$.",
      steps: [
        "The given slope is $\\frac{9-3}{4-0}=\\frac32$.",
        "The perpendicular slope is the opposite reciprocal, $-\\frac23$.",
        "Through $(2,-1)$: $y+1=-\\frac23(x-2)$.",
      ],
      answer: "$y+1=-\\frac{2}{3}(x-2)$",
    },
    methodTitle: "Find the slope, relate it, use the point",
    method: [
      "Find the slope from two points, or solve a standard form for $y$.",
      "Same slope for parallel, opposite reciprocal for perpendicular.",
      "For a dilation about the origin, scale the intercept and keep the slope.",
    ],
    formalTitle: "Slope conditions",
    formal: [
      "Non-vertical lines are parallel if and only if they have the same slope, and perpendicular if and only if the product of their slopes is $-1$.",
      "A dilation with scale factor $k$ about the origin maps $(x,y)$ to $(kx,ky)$, so $y=mx+b$ becomes $y=mx+kb$.",
    ],
    pitfalls: [
      "Do not stop at the reciprocal; change the sign too.",
      "Equal slopes and equal intercepts mean the same line, not parallel lines.",
      "A dilation about the origin does not leave the intercept unchanged.",
    ],
    parentGuide:
      "Have your learner test a perpendicular slope by checking that the product of the two slopes is $-1$.",
  }),
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
