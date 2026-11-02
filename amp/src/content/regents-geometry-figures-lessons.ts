import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsGeometryFiguresMethods: Record<string, ProblemMethod> = {
  "geo-altitude-hypotenuse": {
    goal: "Use the two similar triangles an altitude to the hypotenuse creates to find a leg or the altitude.",
    intuition:
      "Drawing the altitude from the right angle splits a right triangle into two smaller right triangles. Each is similar to the whole triangle and to the other. Similar triangles have proportional sides, which links the parts of the hypotenuse to the legs and the altitude.",
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
      "Each leg is the geometric mean of the whole hypotenuse and the part beside it: $\\text{leg}^2=\\text{part}\\times\\text{whole}$.",
      "The altitude is the geometric mean of the two parts: $\\text{altitude}^2=\\text{part}\\times\\text{other part}$. Simplify the radical.",
    ],
    watch:
      "A leg uses the whole hypotenuse; the altitude uses only the two parts. Pair each leg with the part of the hypotenuse that touches it.",
  },
  "geo-centroid-median": {
    goal: "Use that the centroid divides each median into parts in the ratio 2 to 1, longer part next to the vertex.",
    intuition:
      "A median joins a vertex to the midpoint of the opposite side. The three medians meet at one point, the centroid, which is the balance point of the triangle. It sits closer to the midpoint than to the vertex, two thirds of the way from the vertex.",
    terms: ["median-triangle", "centroid"],
    method: [
      "Name the vertex part and the midpoint part of the median.",
      "The vertex part is twice the midpoint part, so the median is three equal sections.",
      "Divide the median's length by 3 to get a section, then take 2 sections for the vertex part or 1 for the midpoint part.",
    ],
    watch:
      "The centroid is not the midpoint of a median. The longer part is next to the vertex.",
  },
  "geo-parallel-segment-length": {
    goal: "Use the equal ratios of the parts that a segment parallel to one side cuts on the other two sides.",
    intuition:
      "A segment parallel to one side of a triangle cuts off a smaller triangle with the same shape. Its sides are in proportion to the big triangle, so the two sides it cuts are divided in the same ratio. The converse also holds: if the ratios match, the segment is parallel.",
    terms: [
      "parallel",
      ["ratio", "Here it compares the two pieces of a side that a line cuts."],
    ],
    method: [
      "Write the ratio of the parts of one side, such as $AD:DB$, and of the other side, $AE:EC$.",
      "Set the two ratios equal and solve for the unknown part.",
      "Add parts when the whole side is asked: $AC=AE+EC$.",
    ],
    watch:
      "Compare part to part (top to bottom on both sides), not part to whole on one side and part to part on the other.",
  },
  "geo-isosceles-exterior-angle": {
    goal: "Set the base angles of an isosceles triangle equal to find the variable, then find an exterior angle.",
    intuition:
      "The angles opposite the equal sides of an isosceles triangle are equal. If they are written with the same variable, equating them gives an equation. An exterior angle is formed by extending a side, and it equals the sum of the two interior angles that are not next to it.",
    terms: ["base-angle", "exterior-angle"],
    method: [
      "Set the two base angle expressions equal and solve for $x$.",
      "Substitute to get the measure of one base angle.",
      "At the apex, the exterior angle is the sum of the two base angles. At a base vertex, it is $180^\\circ$ minus the base angle.",
    ],
    watch:
      "Check the solution by computing both base angles. The exterior angle is not an interior angle of the triangle.",
  },
  "geo-complementary-trig-choice": {
    goal: "Use that the sine of an acute angle equals the cosine of its complement to set up and solve an equation.",
    intuition:
      "In a right triangle, the leg opposite one acute angle is the leg next to the other acute angle. The sine of one angle and the cosine of the other are the same ratio. So when $\\sin A=\\cos B$ for acute angles, the angles add to $90^\\circ$.",
    terms: ["complementary-angles", "cofunction-identity"],
    method: [
      "Write the angles of the two expressions and set their sum equal to $90$.",
      "Solve for $x$ and substitute to get each angle.",
      "Answer what is asked: the equation, or the smallest angle of the triangle.",
    ],
    watch:
      "The angles are complementary, not equal and not supplementary. Substitute $x$ back; $x$ is not an angle.",
  },
  "geo-polygon-rotation": {
    goal: "Work backward from rotation angles to the regular polygon that maps onto itself.",
    intuition:
      "A regular polygon with $n$ sides looks the same after turning by one $n$th of a full turn about its center. It also looks the same after any whole number of those turns. So its rotation angles are the multiples of $360^\\circ\\div n$.",
    terms: ["rotational-symmetry", "regular-polygon"],
    method: [
      "For each candidate polygon compute $360^\\circ\\div n$.",
      "Check whether each given rotation angle is a whole-number multiple of it.",
      "The polygon is the one for which every given angle passes.",
    ],
    watch:
      "Every rotation listed must work. A polygon that works for one angle can fail the other.",
  },
  "geo-area-changing-transformation": {
    goal: "Tell which coordinate transformation changes area, or keeps it without keeping congruence.",
    intuition:
      "A rigid motion (translation, reflection, rotation) keeps every length and angle, so the image is congruent and has the same area. Other rules change lengths. A stretch multiplies a length, so the area changes by that factor, unless another stretch cancels it.",
    terms: [
      "rigid-motion",
      [
        "transformation",
        "A stretch multiplies one coordinate by a number, such as $(x, y) \\to (2x, y)$.",
      ],
    ],
    method: [
      "Name what each rule does: translate, reflect, rotate, stretch or dilate.",
      "For a stretch, find the factor on width and on height and multiply them to get the area factor.",
      "An area factor of 1 with a changed side length keeps area but not congruence.",
    ],
    watch:
      "Keeping area does not mean congruent. Two stretches with factors $k$ and $\\frac1k$ keep area but change the shape.",
  },
  "geo-section-impossible": {
    goal: "Decide which shapes a plane can cut from a prism, a cylinder or a cone, and which it cannot.",
    intuition:
      "A cross section is the shape where a plane cuts through a solid. Each flat face contributes at most one straight side, and a curved surface contributes a curved edge. So the faces of the solid limit which shapes are possible.",
    terms: ["cross-section", "face-solid"],
    method: [
      "List the faces and curved surfaces of the solid.",
      "Count the most sides a section could have; a flat solid has at most one side per face.",
      "Reject any shape with a curved edge for a polyhedron, or with straight sides the surface cannot provide.",
    ],
    watch:
      "A rectangular prism has only six faces, so a section has at most six sides. Curved edges need a curved surface.",
  },
  "geo-parallelogram-sufficient": {
    goal: "Choose the added condition that is enough to make a parallelogram a rhombus or a rectangle.",
    intuition:
      "A parallelogram already has two pairs of parallel sides, equal opposite sides and angles, and diagonals that bisect each other. A rhombus adds equal adjacent sides, and a rectangle adds a right angle. A useful new condition must give one of those extras.",
    terms: ["rhombus", "rectangle"],
    method: [
      "Cross out every condition that all parallelograms already satisfy.",
      "Keep the conditions that force four equal sides (rhombus) or a right angle (rectangle).",
      "Remember: perpendicular diagonals give a rhombus, congruent diagonals give a rectangle.",
    ],
    watch:
      "Perpendicular diagonals do not make a rectangle, and congruent diagonals do not make a rhombus.",
  },
};

export const regentsGeometryFiguresPrinciples: Record<string, string> = {
  "geo-altitude-hypotenuse":
    "In a right triangle with the altitude to the hypotenuse dividing it into parts $p$ and $q$, the altitude is $\\sqrt{pq}$, and each leg is $\\sqrt{p(p+q)}$ or $\\sqrt{q(p+q)}$, the geometric mean of the whole hypotenuse and the adjacent part.",
  "geo-centroid-median":
    "The medians of a triangle are concurrent at the centroid $G$, and for each median from vertex $V$ to midpoint $M$, $VG=\\frac23VM$ and $GM=\\frac13VM$.",
  "geo-parallel-segment-length":
    "A segment joining points $D$ on $\\overline{AB}$ and $E$ on $\\overline{AC}$ is parallel to $\\overline{BC}$ if and only if $\\frac{AD}{DB}=\\frac{AE}{EC}$ (the side-splitter theorem and its converse).",
  "geo-isosceles-exterior-angle":
    "In an isosceles triangle the base angles are equal. An exterior angle of a triangle equals the sum of the two remote interior angles and is supplementary to its adjacent interior angle.",
  "geo-complementary-trig-choice":
    "For an acute angle $\\theta$, $\\sin\\theta=\\cos(90^\\circ-\\theta)$. So for acute angles $A$ and $B$, $\\sin A=\\cos B$ if and only if $A+B=90^\\circ$.",
  "geo-polygon-rotation":
    "A regular $n$-gon maps onto itself under a rotation about its center through $\\theta$ degrees exactly when $\\theta$ is a multiple of $\\frac{360}{n}$.",
  "geo-area-changing-transformation":
    "A rigid motion preserves area and produces a congruent figure. The map $(x,y)\\to(ax,by)$ multiplies area by $|ab|$, so it keeps area exactly when $|ab|=1$ and keeps congruence only when $|a|=|b|=1$.",
  "geo-section-impossible":
    "A plane meets each flat face of a solid in at most one segment, so a section of a polyhedron with $F$ faces has at most $F$ sides. Curved edges arise only from curved surfaces.",
  "geo-parallelogram-sufficient":
    "A parallelogram is a rhombus if and only if its diagonals are perpendicular, or equivalently two adjacent sides are congruent. It is a rectangle if and only if it has a right angle, or equivalently its diagonals are congruent.",
};

export const regentsGeometryFiguresLessons = [
  chainLesson({
    id: "regents-geometry-triangle-segments",
    title: "Segments inside a triangle",
    summary:
      "Use the altitude to a hypotenuse, a parallel segment and the centroid to find lengths and true statements.",
    templateIds: [
      "geo-altitude-hypotenuse",
      "geo-parallel-segment-length",
      "geo-centroid-median",
    ],
    objectives: [
      "Use similar triangles to relate the parts of a hypotenuse, the altitude and a leg.",
      "Use equal ratios to find a side cut by a segment parallel to the opposite side.",
      "Use the 2 to 1 division of a median by the centroid.",
    ],
    openingTitle: "Segments inside a triangle make similar pieces",
    opening: [
      "Cutting a triangle with a well-chosen segment often produces smaller triangles with the same shape. The altitude to the hypotenuse of a right triangle and a segment parallel to a side both do this.",
      "Triangles of the same shape have sides in proportion, which turns a geometry question into a proportion to solve.",
    ],
    example: {
      prompt:
        "In right triangle $ABC$ the right angle is at $C$. The altitude from $C$ meets $\\overline{AB}$ at $D$, with $AD=4$ and $DB=9$. Find $AC$.",
      steps: [
        "The hypotenuse is $AB=4+9=13$.",
        "Triangle $ACD$ is similar to triangle $ABC$, so $\\frac{AC}{13}=\\frac{4}{AC}$.",
        "$AC^2=4\\cdot13=52$, so $AC=\\sqrt{52}=2\\sqrt{13}$.",
      ],
      answer: "$2\\sqrt{13}$",
    },
    methodTitle: "Match the similar triangles, then write the proportion",
    method: [
      "Altitude to the hypotenuse: $\\text{leg}^2=\\text{adjacent part}\\times\\text{whole hypotenuse}$, and $\\text{altitude}^2=\\text{part}\\times\\text{other part}$.",
      "Parallel segment: $AD:DB=AE:EC$. To prove parallel, check that the ratios match.",
      "Centroid: the vertex part of a median is twice the midpoint part, so it is $\\frac23$ of the median.",
    ],
    formalTitle: "The theorems",
    formal: [
      "The altitude to the hypotenuse makes two triangles each similar to the original, so the square of a leg equals the product of the whole hypotenuse and the adjacent part (a geometric mean).",
      "The side-splitter theorem: $DE\\parallel BC$ if and only if $\\frac{AD}{DB}=\\frac{AE}{EC}$. The medians meet at the centroid, which divides each in the ratio $2:1$.",
    ],
    pitfalls: [
      "A leg uses the whole hypotenuse; the altitude uses only the two parts.",
      "Compare part to part on both sides, not part to whole on one side.",
      "The longer part of a median is next to the vertex.",
    ],
    parentGuide:
      "Ask your learner to name the two triangles they are comparing and which sides correspond before writing any proportion.",
  }),
  chainLesson({
    id: "regents-geometry-angle-expressions",
    title: "Angles written with a variable",
    summary:
      "Solve for the variable in isosceles base angles and complementary sine and cosine angles, then find the asked angle.",
    templateIds: [
      "geo-isosceles-exterior-angle",
      "geo-complementary-trig-choice",
    ],
    objectives: [
      "Set equal base angles of an isosceles triangle equal and solve for the variable.",
      "Use complementary angles for $\\sin A=\\cos B$ and find an angle of the triangle.",
    ],
    openingTitle: "A relationship gives an equation",
    opening: [
      "When angle measures are written with a variable, a geometric fact tells how they are related. Equal base angles give an equation of equals. A sine equal to a cosine gives an equation of angles that add to $90^\\circ$.",
      "Solve the equation for the variable, then substitute to find the actual angles.",
    ],
    example: {
      prompt:
        "In isosceles triangle $ABC$ with $AB=AC$, $m\\angle B=(3x+5)^\\circ$ and $m\\angle C=(5x-15)^\\circ$. Find the exterior angle at $A$.",
      steps: [
        "Base angles are equal: $3x+5=5x-15$, so $x=10$.",
        "Each base angle is $3(10)+5=35^\\circ$.",
        "The exterior angle at $A$ is the sum of the remote angles, $35+35=70^\\circ$.",
      ],
      answer: "$70^\\circ$",
    },
    methodTitle: "Relationship, equation, substitute",
    method: [
      "Write the equation the geometry gives: equal angles, or a sum of $90^\\circ$ for complementary angles.",
      "Solve for $x$ and substitute into each expression.",
      "Use the exterior angle theorem or the triangle's angle sum to answer the question asked.",
    ],
    formalTitle: "The facts used",
    formal: [
      "Base angles of an isosceles triangle are congruent. An exterior angle equals the sum of the two remote interior angles.",
      "For acute angles, $\\sin A=\\cos B$ if and only if $A+B=90^\\circ$, because $\\cos B=\\sin(90^\\circ-B)$ and sine is increasing on acute angles.",
    ],
    pitfalls: [
      "Check by evaluating both expressions at your $x$; they must match.",
      "An exterior angle at the apex is the sum of the base angles, not their difference from $180^\\circ$.",
      "Complementary angles add to $90^\\circ$, not $180^\\circ$.",
    ],
    parentGuide:
      "Ask your learner to substitute their value of $x$ into both angle expressions to check that they make sense.",
  }),
  chainLesson({
    id: "regents-geometry-symmetry-transformations-sections",
    title: "Symmetry, transformations and sections",
    summary:
      "Decide which regular polygon has given rotations, which transformation changes area, and which plane section is impossible.",
    templateIds: [
      "geo-polygon-rotation",
      "geo-area-changing-transformation",
      "geo-section-impossible",
    ],
    objectives: [
      "Use $360^\\circ\\div n$ to test rotations of a regular polygon.",
      "Decide whether a coordinate rule preserves lengths, area or both.",
      "Use the faces of a solid to rule out impossible cross sections.",
    ],
    openingTitle: "Which properties does a change keep?",
    opening: [
      "A transformation moves a figure. Some keep every length and angle, some keep only area, and some keep neither. Asking what a change preserves is the way to decide questions about symmetry and area.",
      "A cross section asks a similar question about a cut: which shapes can a plane make from a solid, given its faces.",
    ],
    example: {
      prompt:
        "Which regular polygon maps onto itself under rotations of $120^\\circ$ and $180^\\circ$ about its center?",
      steps: [
        "A regular $n$-gon rotates onto itself by multiples of $360^\\circ\\div n$.",
        "For a hexagon, $360\\div6=60$, and $120=2\\cdot60$ and $180=3\\cdot60$.",
        "A triangle (multiples of $120^\\circ$) fails at $180^\\circ$, and a square (multiples of $90^\\circ$) fails at $120^\\circ$. The regular hexagon is the answer.",
      ],
      answer: "regular hexagon",
    },
    methodTitle: "Test each candidate against the property",
    method: [
      "Rotations: compute $360\\div n$ for each polygon and test every angle.",
      "Area: find the factor each coordinate rule applies to width and height and multiply.",
      "Sections: count faces and check for curved surfaces.",
    ],
    formalTitle: "Why these tests work",
    formal: [
      "A rotation maps a regular $n$-gon onto itself exactly when it carries vertices to vertices, which are $\\frac{360^\\circ}{n}$ apart around the center.",
      "The map $(x,y)\\to(ax,by)$ scales area by $|ab|$. A plane meets each flat face in at most one segment, so a prism's section has at most as many sides as the prism has faces.",
    ],
    pitfalls: [
      "A polygon must work for every listed rotation, not just one.",
      "Equal area does not mean congruent figures.",
      "A prism cannot have a curved cross section, and a cone cannot have a rectangular one.",
    ],
    parentGuide:
      "Ask your learner to say what the transformation keeps: lengths, angles, area, or none of them.",
  }),
  chainLesson({
    id: "regents-geometry-parallelogram-conditions",
    title: "What makes a parallelogram special",
    summary:
      "Pick the extra condition that makes a parallelogram a rhombus or a rectangle.",
    templateIds: ["geo-parallelogram-sufficient"],
    objectives: [
      "Separate properties every parallelogram has from conditions that make it a rhombus or a rectangle.",
      "Choose a sufficient condition and explain why it works.",
    ],
    openingTitle: "A special parallelogram has one extra property",
    opening: [
      "Every parallelogram has parallel opposite sides, equal opposite sides and angles, and diagonals that bisect each other. A rhombus adds four equal sides. A rectangle adds a right angle, and then all four angles are right angles.",
      "A condition helps only if it is not already true of every parallelogram.",
    ],
    example: {
      prompt:
        "Parallelogram $ABCD$ has perpendicular diagonals. What kind of parallelogram is it?",
      steps: [
        "The diagonals bisect each other at a point $E$, and they are perpendicular.",
        "Triangles $AEB$ and $BEC$ are congruent right triangles (two legs equal), so $AB=BC$.",
        "Opposite sides are equal, so all four sides are equal: it is a rhombus.",
      ],
      answer: "a rhombus",
    },
    methodTitle: "Cross out what every parallelogram has",
    method: [
      "Remove conditions that all parallelograms satisfy.",
      "Look for equal adjacent sides or perpendicular diagonals for a rhombus.",
      "Look for a right angle or congruent diagonals for a rectangle.",
    ],
    formalTitle: "Characterizations",
    formal: [
      "A parallelogram is a rhombus if and only if its diagonals are perpendicular, and a rectangle if and only if its diagonals are congruent.",
      "Each is proved with congruent triangles formed by the diagonals.",
    ],
    pitfalls: [
      "Perpendicular diagonals make a rhombus, not necessarily a rectangle.",
      "Congruent diagonals make a rectangle, not necessarily a rhombus.",
      "Congruent opposite sides is true of every parallelogram.",
    ],
    parentGuide:
      "Ask your learner which sentence in the options would be true of a plain parallelogram, and cross it out.",
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
