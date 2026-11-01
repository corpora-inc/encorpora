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
  multiple: "multiple",
  "one third": "third",
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
  "prime",
  "opposite side",
  "thirds",
  "certain",
  "quarter",
  "one quarter",
  "root",
];

export const regentsGeometryFiguresMethods: Record<string, ProblemMethod> = {
  "geo-altitude-hypotenuse": {
    goal: "Use the two similar triangles an altitude to the hypotenuse creates to find a leg or the altitude.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "In a right triangle, the longest side, across from the square corner, is the hypotenuse, and the other two sides are the legs. The altitude from the right angle is the segment that meets the hypotenuse at a right angle. It splits the triangle into two smaller right triangles. Each is similar to the whole triangle and to the other: the same shape, with proportional sides. That links the two parts of the hypotenuse to the legs and the altitude. The geometric mean is the number whose square is the product of two numbers: 6 for 4 and 9, because $6\\times6=4\\times9$. A square root is a number that times itself gives a given number, and lengths use the positive one.",
    terms: [
      [
        "altitude",
        "Here the altitude runs from the right angle, perpendicular to the hypotenuse.",
      ],
      "hypotenuse",
      "geometric-mean",
    ],
    method: [
      "Add the two parts to get the whole hypotenuse.",
      "Each leg is the geometric mean of the whole hypotenuse and the part touching that leg: $\\text{leg}^2=\\text{part}\\times\\text{whole}$.",
      "The altitude is the geometric mean of the two parts: $\\text{altitude}^2=\\text{part}\\times\\text{other part}$. Then simplify the square root.",
    ],
    watch:
      "A leg uses the whole hypotenuse, and the altitude uses only the two parts. Pair each leg with the part of the hypotenuse that touches it.",
  },
  "geo-centroid-median": {
    goal: "Use that the centroid divides each median into parts in the ratio 2 to 1, longer part next to the vertex.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A midpoint is the point halfway along a side. A median joins a corner (vertex) to the midpoint of the side across from it. The three medians meet at one point, called the centroid, the triangle's balance point. The centroid is two thirds of the way from the vertex along each median. So the part next to the vertex is twice the part next to the midpoint.",
    terms: ["median-triangle", "centroid"],
    method: [
      "Name the vertex part and the midpoint part of the median.",
      "The vertex part is twice the midpoint part, so the median is three equal sections.",
      "Divide the median's length by 3 to get one section. Take 2 sections for the vertex part, or 1 for the midpoint part.",
    ],
    watch:
      "The centroid is not the midpoint of a median. The longer part is next to the vertex.",
  },
  "geo-parallel-segment-length": {
    goal: "Use the equal ratios of the parts that a segment parallel to one side cuts on the other two sides.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "Parallel lines run the same way and never meet. A segment parallel to one side of a triangle cuts off a smaller triangle with the same shape. So it divides the two sides it crosses in the same ratio: top piece to bottom piece is the same on both sides. The reverse is also true: if the two ratios match, the segment is parallel.",
    terms: [
      "parallel",
      ["ratio", "Here it compares the two pieces of a side that a line cuts."],
    ],
    method: [
      "Write the ratio of the pieces of one side, such as $AD:DB$, and of the other side, $AE:EC$.",
      "Set the two ratios equal, and solve for the unknown piece.",
      "Add the pieces when the whole side is asked: $AC=AE+EC$.",
    ],
    watch:
      "Compare piece to piece on both sides, top over bottom each time. Do not mix piece to whole on one side with piece to piece on the other.",
  },
  "geo-isosceles-exterior-angle": {
    goal: "Set the base angles of an isosceles triangle equal to find the variable, then find an exterior angle.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "An isosceles triangle has two equal sides, and the angles across from them, the base angles, are equal. If both are written with the same variable, setting them equal gives an equation. An exterior angle is the angle outside a corner, made by extending one side. It equals the sum of the two inside angles that are not next to it. The corner where the equal sides meet is called the apex.",
    terms: ["base-angle", "exterior-angle"],
    method: [
      "Set the two base angle expressions equal and solve for $x$.",
      "Substitute $x$ to get the measure of one base angle.",
      "At the top corner (the apex), the exterior angle is the sum of the two base angles. At a base corner, it is $180^\\circ$ minus the base angle.",
    ],
    watch:
      "Check the solution by computing both base angles. The exterior angle is outside the triangle, not one of its inside angles.",
  },
  "geo-complementary-trig-choice": {
    goal: "Use that the sine of an acute angle equals the cosine of its complement to set up and solve an equation.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "Acute means under $90^\\circ$. In a right triangle, the other two angles are acute, and they add to $90^\\circ$. Angles that add to $90^\\circ$ are called complementary. The hypotenuse is the longest side, across from the square corner. The sine of an angle is the leg across from it divided by the hypotenuse, and the cosine is the leg next to it divided by the hypotenuse. The leg across from one acute angle is the leg next to the other. So the sine of one equals the cosine of the other, and $\\sin A=\\cos B$ means $A+B=90^\\circ$.",
    terms: ["complementary-angles", "cofunction-identity"],
    method: [
      "Write the angles from the two expressions, and set their sum equal to 90.",
      "Solve for $x$, and substitute to get each angle.",
      "Answer what is asked: the equation, or the smallest angle of the triangle.",
    ],
    watch:
      "The angles add to $90^\\circ$. They are not equal, and they do not add to $180^\\circ$. Substitute $x$ back, because $x$ is not an angle.",
  },
  "geo-polygon-rotation": {
    goal: "Work backward from rotation angles to the regular polygon that maps onto itself.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A regular polygon has equal sides and equal angles. One with $n$ sides looks the same after a turn of $360^\\circ\\div n$ about its center, because each corner moves onto the next. It also looks the same after any whole number of those turns. Multiples are the results of multiplying by 1, 2, 3 and so on. So the angles that work are exactly the multiples of $360^\\circ\\div n$.",
    terms: ["rotational-symmetry", "regular-polygon"],
    method: [
      "For each candidate polygon, compute $360^\\circ\\div n$.",
      "Check whether each given angle is a whole-number multiple of it.",
      "The answer is the polygon for which every given angle passes.",
    ],
    watch:
      "Every listed angle must work. A polygon that works for one angle can fail another.",
  },
  "geo-area-changing-transformation": {
    goal: "Tell which coordinate transformation changes area, or keeps it without keeping congruence.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A rigid motion, a slide, flip or turn, keeps every length and angle. So the image, the moved figure, is congruent (same size and shape) and has the same area. A stretch is different: $(x,y)\\to(2x,y)$ doubles every width and keeps every height. Area then grows by the width factor times the height factor. Two stretches can cancel, such as doubling widths and halving heights, which keeps area but changes the shape.",
    terms: [
      "rigid-motion",
      [
        "transformation",
        "A stretch multiplies one coordinate by a number, such as $(x, y) \\to (2x, y)$.",
      ],
    ],
    method: [
      "Name what each rule does: slide, flip, turn, stretch or resize.",
      "For a stretch, find the factor on width and the factor on height, and multiply them to get the area factor.",
      "An area factor of 1 with a changed side length keeps area but not congruence.",
    ],
    watch:
      "Keeping area does not mean congruent. Two stretches with factors $k$ and $\\frac1k$ keep area but change the shape.",
  },
  "geo-section-impossible": {
    goal: "Decide which shapes a plane can cut from a prism, a cylinder or a cone, and which it cannot.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A plane is a flat surface that goes on forever. A cross section is the flat shape where a plane cuts through a solid. A face is a flat surface of a solid, like one side of a box. Each face can add at most one straight side to the cut, and a curved surface can add a curve. So the faces of the solid limit which shapes are possible.",
    terms: ["cross-section", "face-solid"],
    method: [
      "List the flat faces and curved surfaces of the solid.",
      "Count the most sides a cut could have: at most one side per flat face.",
      "Reject a shape with a curve for a solid with only flat faces, or with straight sides the surfaces cannot give.",
    ],
    watch:
      "A box-shaped (rectangular) prism has only six faces, so a cut has at most six sides. A curved outline needs a curved surface.",
  },
  "geo-parallelogram-sufficient": {
    goal: "Choose the added condition that is enough to make a parallelogram a rhombus or a rectangle.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A parallelogram is a four-sided shape with two pairs of parallel sides. Every parallelogram has equal opposite sides, equal opposite angles, and diagonals, the lines joining opposite corners, that cut each other in half. A rhombus is a parallelogram with four equal sides. A rectangle is a parallelogram with a right angle. A useful new condition must give one of those extras, not something every parallelogram has.",
    terms: ["rhombus", "rectangle"],
    method: [
      "Cross out every condition that all parallelograms already have.",
      "Keep the conditions that force four equal sides (a rhombus) or a right angle (a rectangle).",
      "Remember: perpendicular diagonals, meeting at a right angle, give a rhombus. Diagonals of equal length give a rectangle.",
    ],
    watch:
      "Perpendicular diagonals do not make a rectangle, and equal diagonals do not make a rhombus.",
  },
};

export const regentsGeometryFiguresPrinciples: Record<string, string> = {
  "geo-altitude-hypotenuse":
    "In a right triangle, let the altitude to the hypotenuse divide it into parts $p$ and $q$. The altitude is $\\sqrt{pq}$. Each leg is $\\sqrt{p(p+q)}$ or $\\sqrt{q(p+q)}$: the geometric mean of the whole hypotenuse and the part next to that leg.",
  "geo-centroid-median":
    "The medians of a triangle meet at one point, the centroid $G$. For each median from vertex $V$ to midpoint $M$, $VG=\\frac23VM$ and $GM=\\frac13VM$.",
  "geo-parallel-segment-length":
    "A segment joining a point $D$ on $\\overline{AB}$ and a point $E$ on $\\overline{AC}$ is parallel to $\\overline{BC}$ exactly when $\\frac{AD}{DB}=\\frac{AE}{EC}$. This is the side-splitter theorem and its converse.",
  "geo-isosceles-exterior-angle":
    "In an isosceles triangle the base angles are equal. An exterior angle of a triangle equals the sum of the two inside angles that are not next to it. It also adds to $180^\\circ$ with the inside angle next to it.",
  "geo-complementary-trig-choice":
    "For an acute angle $\\theta$, $\\sin\\theta=\\cos(90^\\circ-\\theta)$. So for acute angles $A$ and $B$, $\\sin A=\\cos B$ exactly when $A+B=90^\\circ$.",
  "geo-polygon-rotation":
    "A regular polygon with $n$ sides maps onto itself under a turn about its center through $\\theta$ degrees exactly when $\\theta$ is a multiple of $\\frac{360}{n}$.",
  "geo-area-changing-transformation":
    "A rigid motion keeps area and gives a congruent figure. The rule $(x,y)\\to(ax,by)$ multiplies area by $|ab|$, the size of $ab$ ignoring its sign. So it keeps area exactly when $|ab|=1$, and keeps congruence only when $|a|=|b|=1$.",
  "geo-section-impossible":
    "A plane meets each flat face of a solid in at most one segment. So a cut through a solid with $F$ flat faces and no curved surface has at most $F$ sides. Curved outlines come only from curved surfaces.",
  "geo-parallelogram-sufficient":
    "A parallelogram is a rhombus exactly when its diagonals are perpendicular, or when two neighboring sides are equal. It is a rectangle exactly when it has a right angle, or when its diagonals are equal.",
};

export const regentsGeometryFiguresLessons = [
  {
    ...chainLesson({
      id: "regents-geometry-triangle-segments",
      title: "Segments inside a triangle",
      summary:
        "Some segments drawn inside a triangle cut off smaller triangles of the same shape. Triangles of the same shape are called similar. Their sides are in proportion: each side is the same multiple of its partner. That turns a length question into a proportion: an equation of two equal fractions. A third kind of segment, from a corner to the middle of the side across, meets the others at a point two thirds of the way along.",
      templateIds: [
        "geo-altitude-hypotenuse",
        "geo-parallel-segment-length",
        "geo-centroid-median",
      ],
      objectives: [
        "Use similar triangles to relate the parts of a hypotenuse, the altitude and a leg.",
        "Use equal ratios to find a side cut by a segment parallel to the opposite side.",
        "Use the 2 to 1 split of a median at the centroid.",
      ],
      openingTitle: "Segments inside a triangle make similar pieces",
      opening: [
        "Two triangles are similar when they have the same shape: equal angles, with every side the same multiple of its partner. A proportion is an equation of two equal fractions, such as $\\frac{2}{4}=\\frac{3}{6}$.",
        "In a right triangle, the hypotenuse is the longest side, across from the square corner. The other two sides are the legs. The altitude from the right angle is the segment that meets the hypotenuse at a right angle. It cuts the triangle into two smaller right triangles, each similar to the whole.",
        "A segment parallel to one side of a triangle, running the same way and never meeting it, also cuts off a similar triangle. A midpoint is the halfway point of a side. A median joins a corner to the midpoint of the side across from it. The three medians meet at the centroid.",
      ],
      example: {
        prompt:
          "In right triangle $ABC$ the right angle is at $C$. The altitude from $C$ meets $\\overline{AB}$ at $D$, with $AD=4$ and $DB=9$. Find $AC$.",
        steps: [
          "The whole hypotenuse is both parts together: $AB=4+9=13$.",
          "Triangle $ACD$ is similar to triangle $ABC$: they share the angle at $A$, and each has a right angle. Leg $AC$ of the big triangle matches $AD$ in the small one, and hypotenuse $AB$ matches $AC$. So $\\frac{AC}{13}=\\frac{4}{AC}$.",
          "Cross-multiply: $AC^2=4\\cdot13=52$. So $AC=\\sqrt{52}=\\sqrt{4\\cdot13}=2\\sqrt{13}$, because $\\sqrt{4}=2$.",
        ],
        answer: "$2\\sqrt{13}$",
      },
      methodTitle: "Match the similar triangles, then write the proportion",
      method: [
        "Altitude to the hypotenuse: $\\text{leg}^2=\\text{part next to it}\\times\\text{whole hypotenuse}$, and $\\text{altitude}^2=\\text{part}\\times\\text{other part}$.",
        "Parallel segment: $AD:DB=AE:EC$. To prove a segment parallel, check that the ratios match.",
        "Centroid: the vertex part of a median is twice the midpoint part, so it is $\\frac23$ of the median.",
      ],
      formalTitle: "The theorems",
      formal: [
        "The altitude to the hypotenuse makes two triangles, each similar to the original. So the square of a leg equals the whole hypotenuse times the part next to that leg. That makes the leg a geometric mean: the number whose square is the product of two others.",
        "A theorem is a proved rule. The side-splitter theorem says $DE\\parallel BC$ exactly when $\\frac{AD}{DB}=\\frac{AE}{EC}$. The medians meet at the centroid, which divides each median in the ratio $2:1$.",
      ],
      pitfalls: [
        "A leg uses the whole hypotenuse. The altitude uses only the two parts.",
        "Compare piece to piece on both sides, not piece to whole on one side.",
        "The longer part of a median is next to the vertex.",
      ],
      parentGuide:
        "Ask your learner to name the two triangles they are comparing, and which sides match, before writing any proportion.",
    }),
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
  },
  {
    ...chainLesson({
      id: "regents-geometry-angle-expressions",
      title: "Angles written with a variable",
      summary:
        "Sometimes angles are written with a letter, such as $(3x+5)^\\circ$. A geometry fact then gives an equation. Two equal angles give one expression equal to the other. Angles that add to $90^\\circ$ give a sum of 90. Solve for the letter, then put it back in to find each angle.",
      templateIds: [
        "geo-isosceles-exterior-angle",
        "geo-complementary-trig-choice",
      ],
      objectives: [
        "Set the equal base angles of an isosceles triangle equal, and solve for the variable.",
        "Use the fact that $\\sin A=\\cos B$ means $A$ and $B$ add to $90^\\circ$, and find an angle of the triangle.",
      ],
      openingTitle: "A relationship gives an equation",
      opening: [
        "A variable is a letter that stands for a number. When angle measures are written with a variable, a geometry fact tells how they are related.",
        "An isosceles triangle has two equal sides, and the angles across from them, the base angles, are equal. That gives an equation of two equal expressions. An exterior angle is the angle outside a corner, made by extending one side. It equals the sum of the two inside angles that are not next to it.",
        "A right angle is a square corner, and a right triangle has one. The hypotenuse is the longest side, across from that corner. The sine of an angle is the leg across from it divided by the hypotenuse. The cosine is the leg next to it divided by the hypotenuse. A sine equal to a cosine gives two angles that add to $90^\\circ$. Solve the equation for the variable, then substitute to find the actual angles.",
      ],
      example: {
        prompt:
          "In isosceles triangle $ABC$ with $AB=AC$, $m\\angle B=(3x+5)^\\circ$ and $m\\angle C=(5x-15)^\\circ$. Find the exterior angle at $A$.",
        steps: [
          "$AB=AC$, so the angles across from those sides, at $C$ and at $B$, are equal: $3x+5=5x-15$. Subtract $3x$ from both sides and add 15: $20=2x$, so $x=10$.",
          "Each base angle is $3(10)+5=35^\\circ$. Check: $5(10)-15=35$ too.",
          "The exterior angle at $A$ equals the sum of the two inside angles not next to it: $35^\\circ+35^\\circ=70^\\circ$.",
        ],
        answer: "$70^\\circ$",
      },
      methodTitle: "Relationship, equation, substitute",
      method: [
        "Write the equation the geometry gives: equal angles, or a sum of $90^\\circ$ for complementary angles.",
        "Solve for $x$, and substitute it into each expression.",
        "Use the exterior angle fact or the $180^\\circ$ angle sum to answer the question asked.",
      ],
      formalTitle: "The facts used",
      formal: [
        "The base angles of an isosceles triangle are congruent, meaning equal. An exterior angle equals the sum of the two inside angles that are not next to it.",
        "For acute angles, under $90^\\circ$, $\\sin A=\\cos B$ exactly when $A+B=90^\\circ$. This is because $\\cos B=\\sin(90^\\circ-B)$, and sine grows steadily as an acute angle grows.",
      ],
      pitfalls: [
        "Check by putting your $x$ into both expressions. They must match.",
        "An exterior angle at the apex is the sum of the base angles, not $180^\\circ$ minus their sum.",
        "Complementary angles add to $90^\\circ$, not $180^\\circ$.",
      ],
      parentGuide:
        "Ask your learner to put their value of $x$ into both angle expressions, to check that the angles make sense.",
    }),
    senses: { ...GEO_SENSES, sine: "sine" },
    noLink: GEO_NOLINK,
  },
  {
    ...chainLesson({
      id: "regents-geometry-symmetry-transformations-sections",
      title: "Symmetry, transformations and sections",
      summary:
        "A change to a shape can keep some things the same. A regular polygon has equal sides and equal angles. A turn keeps it looking the same only for certain angles. A slide, flip or turn keeps every length, while a stretch changes lengths and often area. A flat cut through a solid can make only shapes its faces allow.",
      templateIds: [
        "geo-polygon-rotation",
        "geo-area-changing-transformation",
        "geo-section-impossible",
      ],
      objectives: [
        "Use $360^\\circ\\div n$ to test the turns that carry a regular polygon onto itself.",
        "Decide whether a coordinate rule keeps lengths, area, both or neither.",
        "Use the faces of a solid to rule out impossible cross sections.",
      ],
      openingTitle: "Which properties does a change keep?",
      opening: [
        "A transformation is a rule that moves every point of a figure. Some keep every length and angle, some keep only area, and some keep neither. Asking what a change keeps answers questions about symmetry and area.",
        "A regular polygon has equal sides and equal angles. One with $n$ sides lands on itself after a turn of $360^\\circ\\div n$ about its center, the point in its middle. It also does after two, three or more of those turns. A rotation is a turn about a point. A degree is a small unit of turn, and a full turn is 360 degrees.",
        "A cross section is the flat shape made when a plane, a flat surface, cuts a solid. The solid's faces, its flat surfaces, decide which shapes a cut can make.",
      ],
      example: {
        prompt:
          "Which regular polygon maps onto itself under rotations of $120^\\circ$ and $180^\\circ$ about its center?",
        steps: [
          "A regular polygon with $n$ sides turns onto itself by multiples of $360^\\circ\\div n$.",
          "For a hexagon, with 6 sides, $360\\div6=60$. Both angles are multiples of 60: $120=2\\cdot60$ and $180=3\\cdot60$.",
          "A triangle (multiples of $120^\\circ$) fails at $180^\\circ$, and a square (multiples of $90^\\circ$) fails at $120^\\circ$. So the answer is the regular hexagon.",
        ],
        answer: "regular hexagon",
      },
      methodTitle: "Test each candidate against the property",
      method: [
        "Turns: compute $360\\div n$ for each polygon and test every angle.",
        "Area: find the factor each coordinate rule applies to width and to height, and multiply them.",
        "Cuts: count the flat faces, and check for curved surfaces.",
      ],
      formalTitle: "Why these tests work",
      formal: [
        "A turn maps a regular polygon with $n$ sides onto itself exactly when it carries corners to corners. The corners are $\\frac{360^\\circ}{n}$ apart around the center.",
        "The rule $(x,y)\\to(ax,by)$ multiplies area by $|ab|$, the size of $ab$ ignoring its sign. A plane meets each flat face in at most one segment, so a cut through a prism has at most as many sides as the prism has faces.",
      ],
      pitfalls: [
        "A polygon must work for every listed turn, not just one.",
        "Equal area does not mean congruent figures.",
        "A prism cannot have a curved cross section, and a cone cannot have a rectangular one.",
      ],
      parentGuide:
        "Ask your learner to say what the transformation keeps: lengths, angles, area, or none of them.",
    }),
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
  },
  {
    ...chainLesson({
      id: "regents-geometry-parallelogram-conditions",
      title: "What makes a parallelogram special",
      summary:
        "A parallelogram is a four-sided shape whose opposite sides are parallel. Some parallelograms are special. A rhombus has four equal sides, and a rectangle has four right angles. To show a parallelogram is special, you need one extra fact that not every parallelogram has.",
      templateIds: ["geo-parallelogram-sufficient"],
      objectives: [
        "Separate properties every parallelogram has from conditions that make it a rhombus or a rectangle.",
        "Choose a condition that is enough, and explain why it works.",
      ],
      openingTitle: "A special parallelogram has one extra property",
      opening: [
        "Parallel sides run the same way and never meet. A diagonal is a segment joining opposite corners. Every parallelogram has parallel opposite sides, equal opposite sides and angles, and diagonals that bisect each other, meaning they cut each other in half.",
        "A rhombus is a parallelogram with four equal sides. A rectangle is a parallelogram with a right angle, a square corner, and then all four angles are right angles.",
        "A condition helps only if it is not already true of every parallelogram.",
      ],
      example: {
        prompt:
          "Parallelogram $ABCD$ has perpendicular diagonals. What kind of parallelogram is it?",
        steps: [
          "The diagonals of any parallelogram cut each other in half, at a point $E$. Here they also meet at right angles, which is what perpendicular means.",
          "Triangles $AEB$ and $CEB$ share side $EB$, have $AE=CE$, and have right angles at $E$. So they are congruent by SAS, two sides and the angle between them, and $AB=CB$.",
          "Opposite sides of a parallelogram are equal, so all four sides are equal. It is a rhombus.",
        ],
        answer: "a rhombus",
      },
      methodTitle: "Cross out what every parallelogram has",
      method: [
        "Remove the conditions that all parallelograms have.",
        "Look for equal neighboring sides or perpendicular diagonals for a rhombus.",
        "Look for a right angle or equal diagonals for a rectangle.",
      ],
      formalTitle: "Characterizations",
      formal: [
        "A parallelogram is a rhombus exactly when its diagonals are perpendicular. It is a rectangle exactly when its diagonals are congruent, meaning equal in length.",
        "Each fact is proved with congruent triangles formed by the diagonals.",
      ],
      pitfalls: [
        "Perpendicular diagonals make a rhombus, not necessarily a rectangle.",
        "Equal diagonals make a rectangle, not necessarily a rhombus.",
        "Equal opposite sides are true of every parallelogram.",
      ],
      parentGuide:
        "Ask your learner which option would be true of a plain parallelogram, and cross it out.",
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
export const regentsGeometryFiguresFacetMappings: FacetMapping[] = [
  m(
    "geo-altitude-hypotenuse",
    "similarity-theorems.core",
    "Single choice of a leg or the altitude as an integer or simplified radical from the two parts of the hypotenuse, stated in words. Does not assess the proportions with a drawn figure, finding parts from a leg, or proofs of the geometric mean theorems.",
  ),
  m(
    "geo-centroid-median",
    "triangle-circles.core",
    "Single choice of a true statement about the two parts of a median cut by the centroid, or the length of one part from the whole median. Does not assess coordinates of the centroid, other triangle centers, or proofs of concurrency.",
  ),
  m(
    "geo-parallel-segment-length",
    "similarity-theorems.core",
    "Numeric entry of a whole side of a triangle cut by a parallel segment, or of the length that makes a segment parallel, with integer lengths stated in words. Does not assess a drawn figure, algebraic lengths or proofs of the side-splitter theorem.",
  ),
  m(
    "geo-isosceles-exterior-angle",
    "triangle-angle-theorems.core",
    "Numeric entry of an exterior angle of an isosceles triangle with base angles given by linear expressions. Does not assess other triangle types, a drawn figure or written justification.",
  ),
  m(
    "geo-complementary-trig-choice",
    "complementary-trigonometry.core",
    "Single choice of the equation implied by a sine equal to a cosine of acute angles, or of the smallest angle of the triangle. Does not assess non-acute angles, solving trigonometric equations in general, or proofs of the cofunction identity.",
  ),
  m(
    "geo-polygon-rotation",
    "polygon-symmetries.core",
    "Single choice of the regular polygon (3 to 12 sides) that maps onto itself under one or two stated rotations. Does not assess lines of symmetry, drawn polygons, or irregular figures.",
  ),
  m(
    "geo-area-changing-transformation",
    "transformation-invariants.core",
    "Single choice of the coordinate rule that changes a rectangle's area, or that keeps area without keeping congruence. Does not assess the area factor of general linear maps, proofs, or transformations of other figures.",
  ),
  m(
    "geo-section-impossible",
    "solid-cross-sections.core",
    "Single choice of the shape that cannot be a plane cross section of a rectangular prism, cylinder or cone. Does not assess naming the section from a described slice, drawing sections, or sections of spheres and pyramids.",
  ),
  m(
    "geo-parallelogram-sufficient",
    "parallelogram-proofs.core",
    "Single choice of a sufficient extra condition for a rhombus or a rectangle. Does not assess writing the proof or conditions for squares and kites.",
  ),
];
