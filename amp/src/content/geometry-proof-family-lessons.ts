import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Lessons for the geometric proof, definition and construction families. */
const t = String.raw;

type Spec = {
  id: string;
  templateId: string;
  title: string;
  summary: string;
  objectives: string[];
  goal: string;
  intuition: string[];
  terms: [string, string][];
  method: string[];
  watch: string;
  principle: string;
  example: { prompt: string; steps: string[]; answer: string };
  methodTitle: string;
  methodText: string[];
  formalTitle: string;
  formal: string[];
  pitfalls: string[];
  parentGuide: string;
};

const specs: Spec[] = [
  {
    id: "line-angle-proof-reasons",
    templateId: "line-angle-proof-reasons",
    title: "Justify line and angle proof steps",
    summary:
      "Match a step about vertical angles, alternate interior angles or a perpendicular bisector to the theorem whose conditions hold.",
    objectives: [
      "Choose between a theorem and its converse by what is given and what is concluded.",
      "Write the equation that the vertical angles theorem gives and solve it.",
    ],
    goal: "Given a line-and-angle configuration, choose the reason or equation that justifies one proof step.",
    intuition: [
      t`Two lines that cross make four angles. Angles that face each other across the crossing point are called vertical angles. A transversal is a line that crosses two other lines. When the other two lines are parallel, angles between them on opposite sides of the transversal are alternate interior angles. A perpendicular bisector of a segment is a line that crosses the segment at its midpoint at a right angle. A point is equidistant from two points when it is the same distance from each.`,
      t`A proof step has a claim and a reason. A reason is a theorem whose conditions are all given and whose conclusion is the claim. Many theorems have a converse that swaps the given fact and the conclusion, and the converse is a separate theorem. So read which direction the step goes.`,
    ],
    terms: [
      [
        "vertical angles",
        "Two angles formed by two crossing lines that face each other and share only the crossing point.",
      ],
      [
        "alternate interior angles",
        "Angles between two lines, on opposite sides of a transversal that crosses both.",
      ],
      [
        "perpendicular bisector",
        "A line through the midpoint of a segment that is perpendicular to it.",
      ],
      ["converse", "A theorem with its given fact and conclusion exchanged."],
    ],
    method: [
      "Underline what the problem gives and what the step claims.",
      "Pick the theorem whose given fact matches the problem's given and whose conclusion matches the claim. If they match in reverse order, you need the converse.",
      "For an equation, write the claimed relationship between the two angle expressions, then solve for the unknown and check the angle measures.",
    ],
    watch:
      "A true theorem justifies a step only when its conditions are given and it concludes the claim, not the reverse.",
    principle: t`Vertical angles are congruent. If parallel lines are cut by a transversal, alternate interior angles are congruent. A point is on the perpendicular bisector of a segment if and only if it is equidistant from the segment's endpoints.`,
    example: {
      prompt: t`Line $\ell$ is the perpendicular bisector of $\overline{AB}$ and $P$ is on $\ell$. A proof states $PA=PB$. What justifies this?`,
      steps: [
        t`The given fact is that $P$ lies on the perpendicular bisector. The claim is that $P$ is equally far from $A$ and $B$.`,
        t`The theorem "every point on the perpendicular bisector of a segment is equidistant from its endpoints" starts with the given fact and ends with the claim, so it justifies the step. The converse starts from equal distances and would not.`,
      ],
      answer:
        "Every point on the perpendicular bisector of a segment is equidistant from the segment's endpoints.",
    },
    methodTitle: "From a reason to an equation",
    methodText: [
      t`Lines $AC$ and $BD$ cross at $O$. Angle $AOB$ measures $(3x+10)^\circ$ and angle $COD$ measures $(5x-20)^\circ$. They face each other, so they are vertical angles and $3x+10=5x-20$. Then $30=2x$, so $x=15$ and each angle measures $55^\circ$.`,
      t`A check with the neighbors confirms it: an adjacent angle would be $180^\circ-55^\circ=125^\circ$, and the four angles total $55+125+55+125=360$.`,
    ],
    formalTitle: "Why these theorems hold",
    formal: [
      t`Vertical angles: each is supplementary to the same adjacent angle, so each equals $180^\circ$ minus that angle. Alternate interior angles: for parallel lines, they are equal because corresponding angles are equal and a vertical pair links them.`,
      t`Perpendicular bisector: let $M$ be the midpoint of $\overline{AB}$ and $P$ be on the bisector. Triangles $PMA$ and $PMB$ have $AM=BM$, right angles at $M$ and the shared side $PM$, so they are congruent by SAS and $PA=PB$. The converse follows from SSS: if $PA=PB$, triangles $PMA$ and $PMB$ are congruent, so the equal angles at $M$ are right angles.`,
    ],
    pitfalls: [
      "Use a theorem only in the direction its given facts allow.",
      "Identify vertical angles by facing each other across the crossing, not by sharing a side.",
      "Check the solved value in both angle expressions.",
    ],
    parentGuide:
      "Ask the learner what is given, what the step claims and whether the theorem used goes from the first to the second.",
  },
  {
    id: "triangle-theorem-consequences",
    templateId: "triangle-theorem-consequences",
    title: "Use triangle theorems in a proof",
    summary:
      "Use base angles, the midsegment, medians and the angle sum to find a measure or justify a step.",
    objectives: [
      "Apply the isosceles base angle theorem and the angle sum.",
      "Use the midsegment and median theorems with an unknown in a length.",
    ],
    goal: "Given a triangle with a stated property, find the measure or choose the reason a proof step needs.",
    intuition: [
      t`An isosceles triangle has two equal sides. The angles opposite those sides are the base angles, and they are equal. A midpoint splits a segment into two equal parts. A midsegment joins the midpoints of two sides of a triangle. A median joins a vertex to the midpoint of the opposite side, and the three medians meet at one point called the centroid.`,
      t`These facts let you turn one measurement into others: a midsegment is half as long as the side it is parallel to, and the centroid is two thirds of the way along each median from its vertex.`,
    ],
    terms: [
      [
        "base angles",
        "The two angles opposite the equal sides of an isosceles triangle.",
      ],
      [
        "midsegment",
        "A segment joining the midpoints of two sides of a triangle.",
      ],
      [
        "median",
        "A segment from a vertex to the midpoint of the opposite side.",
      ],
      ["centroid", "The point where the three medians meet."],
    ],
    method: [
      "Name which theorem fits: equal sides give equal base angles, a segment between midpoints gives a half-length parallel side, and medians give a $2:1$ split.",
      "Write the relationship as an equation using the given expressions or measures.",
      "Solve, then substitute to find the requested measure.",
    ],
    watch:
      "Which angles are equal depends on which sides are equal: the base angles are opposite the equal sides, not at their shared vertex.",
    principle: t`Angles of a triangle sum to $180^\circ$. Base angles of an isosceles triangle are congruent. A midsegment is parallel to the third side and half as long. The medians meet at a point that divides each in the ratio $2:1$ from the vertex.`,
    example: {
      prompt: t`In triangle $ABC$, $D$ and $E$ are the midpoints of $\overline{AB}$ and $\overline{AC}$. $DE=2x+3$ and $BC=5x-3$. What is $BC$?`,
      steps: [
        t`$\overline{DE}$ joins midpoints, so it is a midsegment and $BC=2\cdot DE$.`,
        t`$5x-3=2(2x+3)=4x+6$, so $x=9$.`,
        t`$DE=2(9)+3=21$, so $BC=42$. Check: $5(9)-3=42$.`,
      ],
      answer: "42",
    },
    methodTitle: "Base angles and medians",
    methodText: [
      t`If $AB=AC$ and $m\angle A=40^\circ$, the base angles $\angle B$ and $\angle C$ are equal and sum to $180-40=140$, so each is $70^\circ$.`,
      t`If medians meet at $G$ and the median $AM$ has length $12$, then $AG$ is two thirds of it, $8$, and $GM$ is one third, $4$.`,
    ],
    formalTitle: "Why these theorems hold",
    formal: [
      t`Angle sum: draw a line through $C$ parallel to $\overline{AB}$. The angles it makes with $\overline{CA}$ and $\overline{CB}$ equal $\angle A$ and $\angle B$ (alternate interior angles), and with $\angle C$ they fill a straight angle of $180^\circ$.`,
      t`Base angles: in isosceles triangle $ABC$ with $AB=AC$, let $M$ be the midpoint of $\overline{BC}$. Triangles $ABM$ and $ACM$ are congruent by SSS, so $\angle B=\angle C$.`,
      t`Midsegment and medians: in triangle $ABC$ with midpoints $M$ of $\overline{AB}$ and $N$ of $\overline{AC}$, $\triangle AMN\sim\triangle ABC$ with ratio $1:2$, so $MN\parallel BC$ and $MN=\tfrac12BC$. If medians $BN$ and $CM$ meet at $G$, then $\triangle GMN\sim\triangle GCB$ with ratio $1:2$, so $GN:GB=1:2$.`,
    ],
    pitfalls: [
      "A midsegment is half the third side, so the third side is double the midsegment.",
      "The longer part of a median is next to the vertex.",
      "Base angles are opposite the equal sides.",
    ],
    parentGuide:
      "Ask which sides are equal or which points are midpoints, and what that makes true about angles or lengths.",
  },
  {
    id: "parallelogram-property-consequences",
    templateId: "parallelogram-property-consequences",
    title: "Use parallelogram and rectangle theorems",
    summary:
      "Use opposite sides and angles, bisecting diagonals and congruent rectangle diagonals to justify a step or find a measure.",
    objectives: [
      "Choose the parallelogram theorem that supports a stated step.",
      "Set up and solve equations from bisecting or congruent diagonals.",
    ],
    goal: "Given a parallelogram or rectangle, choose the reason for a step or find a length or angle.",
    intuition: [
      t`A parallelogram is a quadrilateral whose opposite sides are parallel. A diagonal joins opposite corners. To bisect a segment is to cut it into two equal parts. A rectangle is a parallelogram with four right angles. Consecutive angles are angles next to each other along a side.`,
      t`Parallel sides force many equal measures: opposite sides are equal, opposite angles are equal, consecutive angles total $180^\circ$ and the diagonals bisect each other. Only a rectangle also has equal diagonals.`,
    ],
    terms: [
      ["diagonal", "A segment joining two opposite corners of a polygon."],
      ["bisect", "Cut into two equal parts."],
      ["consecutive angles", "Two angles of a polygon that share a side."],
    ],
    method: [
      "Read which parts the claim compares: opposite sides, opposite angles, consecutive angles, or diagonals.",
      "For diagonals, write $AE=EC$ for a parallelogram, or $AC=BD$ if the figure is given as a rectangle.",
      "Solve for the unknown, substitute, and finish the requested measure.",
    ],
    watch:
      "Equal diagonals need a rectangle; the diagonals of a general parallelogram only bisect each other.",
    principle: t`In a parallelogram, opposite sides are congruent, opposite angles are congruent, consecutive angles are supplementary and the diagonals bisect each other. The diagonals of a rectangle are congruent.`,
    example: {
      prompt: t`Diagonals $\overline{AC}$ and $\overline{BD}$ of parallelogram $ABCD$ meet at $E$. $AE=3x+4$ and $EC=5x-6$. What is $AC$?`,
      steps: [
        t`The diagonals of a parallelogram bisect each other, so $AE=EC$: $3x+4=5x-6$.`,
        t`This gives $10=2x$, so $x=5$ and $AE=EC=19$.`,
        t`$AC=AE+EC=38$.`,
      ],
      answer: "38",
    },
    methodTitle: "Angles and rectangles",
    methodText: [
      t`If $m\angle A=70^\circ$ in parallelogram $ABCD$, then $\angle C=70^\circ$ (opposite) and $\angle B=180-70=110^\circ$ (consecutive).`,
      t`In rectangle $ABCD$ with $AC=5x-3$ and $BD=3x+9$, the diagonals are equal: $5x-3=3x+9$, so $x=6$ and $AC=27$.`,
    ],
    formalTitle: "Why these theorems hold",
    formal: [
      t`Diagonal $\overline{AC}$ of parallelogram $ABCD$ makes triangles $ABC$ and $CDA$ congruent by ASA, since alternate interior angles are equal at $A$ and $C$ and $AC$ is shared. Hence opposite sides and opposite angles are equal.`,
      t`The diagonals cross at $E$. Triangles $AEB$ and $CED$ have equal opposite sides $AB=CD$ and equal alternate interior angles, so they are congruent by ASA and $AE=CE$, $BE=DE$.`,
      t`In rectangle $ABCD$, triangles $ABC$ and $DCB$ have $AB=DC$, the shared side $BC$ and right angles at $B$ and $C$, so they are congruent by SAS and $AC=DB$.`,
    ],
    pitfalls: [
      "Consecutive angles are supplementary; opposite angles are equal.",
      "Only rectangles have equal diagonals.",
      "Add both halves of the diagonal to get its whole length.",
    ],
    parentGuide:
      "Ask the learner whether the claim compares opposite parts or neighboring parts of the figure.",
  },
  {
    id: "precise-geometric-definitions",
    templateId: "precise-geometric-definitions",
    title: "Choose the precise geometric definition",
    summary:
      "A definition must include exactly the objects it names. Check each condition, including the plane, the distance and the endpoints.",
    objectives: [
      "Choose the definition of an angle, circle, parallel lines, ray or segment.",
      "Find the missing condition in a flawed definition.",
    ],
    goal: "Choose the precise definition of a geometric object, or identify the flawed statement.",
    intuition: [
      t`A definition says exactly which objects have a name. It is precise when every object it describes has the name and no other object does. A point is a location with no size. A line is a straight path in both directions without end. A plane is a flat surface that extends without end.`,
      t`A short definition can fail by leaving out a condition. Lines that do not meet in space need not be parallel, so "do not intersect" alone is not enough; a circle is flat, so "points a fixed distance from a point" alone would describe a sphere in space.`,
    ],
    terms: [
      [
        "ray",
        "A part of a line that starts at one point and extends without end in one direction.",
      ],
      [
        "segment",
        "A part of a line consisting of two endpoints and all points between them.",
      ],
      ["skew lines", "Lines in space that do not meet and are not parallel."],
      ["equidistant", "Equally far from given points."],
    ],
    method: [
      "For each choice, ask what other objects it would also describe. If it fits a second kind of object, a condition is missing.",
      "Check where the objects lie (in a plane or in space), how far, and whether endpoints are included.",
      "Choose the statement with every condition and no extras.",
    ],
    watch:
      "A familiar picture is not a definition. If a statement fits a shape you did not intend, it is missing a condition.",
    principle: t`A circle is the set of all points in a plane that are a given distance from a given point. Parallel lines are lines in a plane that do not intersect. Perpendicular lines intersect to form a right angle. An angle is formed by two rays with a common endpoint. A ray and a segment are parts of a line as described above.`,
    example: {
      prompt: "Which is the precise definition of parallel lines?",
      steps: [
        t`Test "Two lines that do not intersect." In space, skew lines never meet but are not parallel, so this definition is missing a condition.`,
        t`Adding "in a plane" fixes this: two lines in the same plane that never meet are parallel.`,
      ],
      answer: "Two lines in a plane are parallel when they do not intersect.",
    },
    methodTitle: "Check a circle definition",
    methodText: [
      t`"All points a given distance from a point" gives a sphere in space, so it needs "in a plane". "At most a given distance" includes the inside, giving a disk, so it must say exactly that distance. Only "all points in a plane that are a given distance from a given point" describes a circle and nothing else.`,
    ],
    formalTitle: "The set of precise statements",
    formal: [
      t`These definitions use only the undefined terms point, line and plane. An angle has a vertex, the common endpoint, and two sides, which are rays. Its measure is a number of degrees; the angle itself is the figure.`,
      t`A statement is a definition of a name when the objects satisfying it are exactly the objects with that name. A statement that fits extra objects, or misses some, is flawed.`,
    ],
    pitfalls: [
      "Check where the objects lie: in a plane or in space.",
      "Check whether the statement describes the boundary or the inside too.",
      "Distinguish a ray (one endpoint) from a segment (two endpoints).",
    ],
    parentGuide:
      "Ask the learner for one object that fits the flawed statement but should not.",
  },
  {
    id: "transformation-invariant-claims",
    templateId: "transformation-invariant-claims",
    title: "Compare what transformations preserve",
    summary:
      "Rigid motions keep every distance and angle. Dilations keep angles and scale distances. Stretches and shears change both.",
    objectives: [
      "Decide which transformations preserve distance and angle.",
      "Test coordinate images for rigid motion using squared side lengths.",
    ],
    goal: "Decide what a transformation preserves, or whether a coordinate image is a rigid motion.",
    intuition: [
      t`A transformation moves every point of the plane. A translation slides every point the same distance in the same direction. A reflection flips the plane across a line. A rotation turns the plane about a center by a fixed angle. These three are rigid motions: they carry a figure to a congruent figure. A dilation scales distances from a center by a scale factor, and keeps shape but not size.`,
      t`Not every transformation preserves shape. A stretch in one direction or a shear slides rows by different amounts and changes both distances and angles.`,
    ],
    terms: [
      [
        "rigid motion",
        "A transformation that preserves every distance and every angle measure.",
      ],
      [
        "scale factor",
        "The number by which a dilation multiplies distances from its center.",
      ],
      ["image", "The figure obtained by applying a transformation."],
    ],
    method: [
      "For coordinates, find the squared length of each side before and after: $(x_2-x_1)^2+(y_2-y_1)^2$.",
      "If every squared length is unchanged, it is rigid. If every one is multiplied by $k^2$, it is a dilation with factor $k$. Otherwise it is neither.",
      "For a definition question, recall which quantity each transformation keeps.",
    ],
    watch:
      "Compare all three sides. One unchanged side does not show that a transformation is rigid.",
    principle: t`Translations, rotations and reflections preserve distance and angle measure. A dilation with scale factor $k$ multiplies distances by $k$ and preserves angle measure. A rotation about $C$ by $\theta$ sends $X$ to $X'$ with $CX'=CX$ and $m\angle XCX'=\theta$.`,
    example: {
      prompt: t`Triangle $PQR$ has $P(0,0)$, $Q(3,0)$ and $R(0,4)$. It is sent to $P'(0,0)$, $Q'(6,0)$ and $R'(0,8)$. Is the transformation a rigid motion?`,
      steps: [
        t`Squared sides before: $PQ^2=9$, $QR^2=25$, $RP^2=16$.`,
        t`Squared sides after: $P'Q'^2=36$, $Q'R'^2=100$, $R'P'^2=64$, each $4$ times the original.`,
        t`Lengths are multiplied by $2$, so this is a dilation, not a rigid motion.`,
      ],
      answer:
        "No. Every side length is multiplied by 2, so it is a dilation, not a rigid motion.",
    },
    methodTitle: "Why a stretch is not rigid",
    methodText: [
      t`The stretch $(x,y)\to(2x,y)$ sends $(0,0),(3,0),(0,4)$ to $(0,0),(6,0),(0,4)$. Side $PQ$ doubles from $3$ to $6$, side $PR$ stays $4$, and side $QR$ changes from $5$ to $\sqrt{52}$. The sides change by different factors, so the stretch is neither rigid nor a dilation.`,
    ],
    formalTitle: "Definitions",
    formal: [
      t`A rotation about a center $C$ by an angle $\theta$ sends each point $X$ to the point $X'$ with $CX'=CX$ and the angle from ray $CX$ to ray $CX'$ equal to $\theta$. A reflection across a line $\ell$ sends $X$ to the point $X'$ such that $\ell$ is the perpendicular bisector of $\overline{XX'}$ (and fixes points of $\ell$). A translation moves every point by the same vector.`,
      t`A dilation with center $O$ and factor $k>0$ sends $X$ to the point $X'$ on ray $OX$ with $OX'=k\cdot OX$.`,
    ],
    pitfalls: [
      "A dilation preserves angles but not distances unless the factor is $1$.",
      "Check every side, not just one.",
      "A rotation fixes distance to its center, not only the angle.",
    ],
    parentGuide:
      "Ask the learner what happens to a square's side length and corner angle under the transformation.",
  },
  {
    id: "polygon-symmetry-counts",
    templateId: "polygon-symmetry-counts",
    title: "Count and describe polygon symmetries",
    summary:
      "A regular polygon with n sides has n rotations and n lines of reflection. Other shapes have fewer.",
    objectives: [
      "Find the smallest rotation and the number of rotations for a regular polygon.",
      "Count lines of symmetry and list rotations for rectangles, parallelograms and trapezoids.",
    ],
    goal: "Find the rotations or reflections that carry a polygon onto itself.",
    intuition: [
      t`A symmetry of a figure is a rotation or reflection that carries the figure exactly onto itself. A rotation about the center turns the figure by an angle. A line of symmetry is a line across which a reflection carries the figure onto itself. A regular polygon has equal sides and equal angles.`,
      t`A regular polygon with $n$ sides has $n$ equally spaced vertices around its center, so the smallest turn is $360^\circ\div n$. Folding it along a line through the center works in $n$ different ways.`,
    ],
    terms: [
      ["symmetry", "A rotation or reflection that maps a figure onto itself."],
      [
        "line of symmetry",
        "A line such that reflecting the figure across it gives the same figure.",
      ],
      [
        "regular polygon",
        "A polygon with all sides equal and all angles equal.",
      ],
    ],
    method: [
      "For a regular polygon, divide $360^\\circ$ by the number of sides for the smallest rotation. Its multiples up to a full turn are all the rotations.",
      "For other shapes, check each candidate: does every vertex land on a vertex and each side on a side of equal length?",
      "Count each line of symmetry once; a line through opposite sides' midpoints and one through opposite vertices both count.",
    ],
    watch:
      "A slanted parallelogram has rotation by $180^\\circ$ but no line of symmetry. An isosceles trapezoid has a line of symmetry but no rotation.",
    principle: t`A regular polygon with $n$ sides has exactly $n$ rotations carrying it onto itself, the multiples of $360^\circ/n$ from $0^\circ$, and exactly $n$ lines of reflection. A non-square rectangle has $2$ lines of symmetry and rotations of $180^\circ$; a parallelogram that is not a rectangle or rhombus has $180^\circ$ rotation and no lines; an isosceles trapezoid that is not a parallelogram has one line and no nontrivial rotation.`,
    example: {
      prompt:
        "What is the smallest positive angle of rotation about its center that carries a regular octagon onto itself?",
      steps: [
        t`The octagon has $8$ equally spaced vertices around its center.`,
        t`Consecutive vertices are separated by $360^\circ\div 8=45^\circ$. Rotating by $45^\circ$ moves each vertex to the next.`,
      ],
      answer: "45 degrees",
    },
    methodTitle: "Other quadrilaterals",
    methodText: [
      t`A rectangle that is not a square has a vertical and a horizontal line of symmetry, so $2$ lines, and a $180^\circ$ rotation. A turn of $90^\circ$ would swap its long and short sides, so it fails. A square has $4$ lines and rotations of $90^\circ$, $180^\circ$ and $270^\circ$.`,
    ],
    formalTitle: "Why n rotations",
    formal: [
      t`A rotation of a regular $n$-gon about its center is decided by where it sends one chosen vertex. The vertex may land on any of $n$ vertices, and each choice gives one rotation, so there are $n$ rotations. Each is a multiple of $360^\circ/n$. Rotation by $0^\circ$ is the identity and is counted.`,
    ],
    pitfalls: [
      "The interior angle of the polygon is not the angle of rotation.",
      "Count the identity rotation if the problem says to.",
      "A parallelogram's diagonals are not lines of symmetry unless it is a rhombus.",
    ],
    parentGuide:
      "Ask the learner to trace the shape and fold or turn it to test one claimed symmetry.",
  },
  {
    id: "transformation-sequence-mapping",
    templateId: "transformation-sequence-mapping",
    title: "Choose the transformations that map one figure to another",
    summary:
      "Compare a side before and after to decide size change, turn or flip, then track one vertex through the sequence in order.",
    objectives: [
      "Choose a single transformation or a composition from image coordinates.",
      "Track the order of transformations through a vertex.",
    ],
    goal: "Given a figure and its image, choose the sequence of transformations that maps one to the other.",
    intuition: [
      t`A composition of transformations applies one transformation, then another to the result. Order matters: reflecting and then translating usually gives a different image from translating and then reflecting. A vector $\langle a,b\rangle$ describes a translation by $a$ horizontally and $b$ vertically.`,
      t`To decide which transformations are needed, compare one side before and after. If its length changes, a dilation is involved. If its direction turns or flips, a rotation or reflection is involved. Then the leftover shift is a translation.`,
    ],
    terms: [
      ["composition", "Applying one transformation after another."],
      [
        "vector",
        "A pair $\\langle a,b\\rangle$ giving a horizontal and a vertical change.",
      ],
      ["image", "The figure or point after a transformation."],
    ],
    method: [
      "Find $\\overrightarrow{PQ}$ and $\\overrightarrow{P'Q'}$. Same length and direction means translation only; same length with changed direction means a reflection or rotation; a different length means a dilation.",
      "Apply the candidate sequence to $P$, one transformation at a time and in the stated order, and compare with $P'$.",
      "Confirm with a second vertex.",
    ],
    watch:
      "Reversing the order of a reflection or rotation and a translation usually gives a different image. Always apply in the order stated.",
    principle: t`A composition applies transformations in order. A rigid motion followed by another is a rigid motion. A dilation followed by a rigid motion maps a figure onto a similar figure. Reflection across the $x$-axis sends $(x,y)$ to $(x,-y)$; rotation $90^\circ$ counterclockwise about the origin sends $(x,y)$ to $(-y,x)$.`,
    example: {
      prompt: t`Triangle $PQR$ has $P(1,1)$, $Q(4,1)$ and $R(1,3)$. Its image has $P'(3,4)$, $Q'(6,4)$ and $R'(3,2)$. Which sequence maps $PQR$ onto $P'Q'R'$?`,
      steps: [
        t`$\overrightarrow{PQ}=\langle3,0\rangle$ and $\overrightarrow{P'Q'}=\langle3,0\rangle$ have the same length and direction, but $R$ is above $PQ$ and $R'$ is below $P'Q'$, so the figure was flipped across a horizontal line.`,
        t`Reflect across the $x$-axis: $P(1,1)\to(1,-1)$. To reach $P'(3,4)$ translate by $\langle2,5\rangle$.`,
        t`Check $R$: $(1,3)\to(1,-3)\to(3,2)=R'$.`,
      ],
      answer: "Reflect across the x-axis, then translate by <2, 5>.",
    },
    methodTitle: "Order matters",
    methodText: [
      t`With the same two steps reversed, translate by $\langle2,5\rangle$ first: $P(1,1)\to(3,6)$, then reflect across the $x$-axis to $(3,-6)$. That is not $P'(3,4)$, so the reversed order is a different transformation.`,
    ],
    formalTitle: "Congruent and similar figures",
    formal: [
      t`Two figures are congruent when a sequence of rigid motions carries one onto the other. Two figures are similar when a sequence of rigid motions and dilations does. If a sequence includes a dilation with factor $k$, all lengths in the image are $k$ times the original.`,
    ],
    pitfalls: [
      "Apply the steps in the stated order.",
      "Test a second vertex; one vertex can match by coincidence.",
      "A dilation changes the length of $\\overline{PQ}$; check the length first.",
    ],
    parentGuide:
      "Ask the learner to follow one vertex through each step and say where it lands.",
  },
  {
    id: "compass-straightedge-reasoning",
    templateId: "compass-straightedge-reasoning",
    title: "Reason about a compass-and-straightedge construction",
    summary:
      "Each construction step creates points that are equal distances apart. Those equal distances are the proof.",
    objectives: [
      "Choose the next step or the order of a bisector or perpendicular construction.",
      "State the geometric fact that justifies a construction.",
    ],
    goal: "Choose the next step, the order or the justification for a compass-and-straightedge construction.",
    intuition: [
      t`A compass draws arcs of a fixed radius, and a straightedge draws straight lines but has no markings. A construction uses only these. The key move is to copy equal lengths with the compass. Points that are the same distance from two points lie on the perpendicular bisector of the segment between them.`,
      t`A bisector cuts a segment or angle into two equal parts. A perpendicular line makes right angles with another. Each construction works because the arcs create points with known equal distances.`,
    ],
    terms: [
      ["compass", "A tool that draws a circle or arc with a fixed radius."],
      [
        "straightedge",
        "A ruler with no markings, used only to draw straight lines.",
      ],
      ["arc", "A part of a circle."],
    ],
    method: [
      "State what the finished object needs: for a perpendicular bisector, points equally far from both endpoints.",
      "Choose arcs that create such points: equal radii centered at the two endpoints, with the radius more than half the segment.",
      "Connect the crossing points with the straightedge and name the fact that makes the line correct.",
    ],
    watch:
      "A construction may not measure with a ruler or protractor. Each step must use only the compass and an unmarked straightedge.",
    principle: t`The set of points equidistant from $A$ and $B$ is the perpendicular bisector of $\overline{AB}$. The set of points equidistant from the sides of an angle is its bisector. If corresponding angles formed by a transversal are congruent, the lines are parallel.`,
    example: {
      prompt: t`In the perpendicular bisector construction for $\overline{AB}$, arcs centered at $A$ and $B$ with the same radius cross at $X$ and $Y$. Why is line $XY$ the perpendicular bisector?`,
      steps: [
        t`$XA=XB$ and $YA=YB$, since each pair is a radius of arcs with the same opening.`,
        t`A point equally far from $A$ and $B$ is on the perpendicular bisector of $\overline{AB}$, so $X$ and $Y$ both are. Two points determine one line, so $XY$ is the bisector.`,
      ],
      answer:
        "X and Y are each equidistant from A and B, so both lie on the perpendicular bisector.",
    },
    methodTitle: "Angle bisector and parallel line",
    methodText: [
      t`To bisect $\angle ABC$, an arc centered at $B$ marks $P$ on ray $BA$ and $Q$ on ray $BC$ with $BP=BQ$. Equal arcs centered at $P$ and $Q$ cross at $X$ with $XP=XQ$. Triangles $BPX$ and $BQX$ are congruent by SSS, so ray $BX$ bisects the angle.`,
      t`To construct a parallel through $P$ to line $\ell$, copy the angle a transversal makes with $\ell$ onto the transversal at $P$ in the matching position. Congruent corresponding angles imply the lines are parallel.`,
    ],
    formalTitle: "Why each fact holds",
    formal: [
      t`If $XA=XB$, let $M$ be the midpoint of $\overline{AB}$. Triangles $XMA$ and $XMB$ are congruent by SSS, so the angles at $M$ are equal and, as they form a straight angle, each is right. Hence $XM$ is the perpendicular bisector. The converse is the SAS argument for points on the bisector.`,
    ],
    pitfalls: [
      "The arc radius must be more than half the segment, or the arcs will not cross.",
      "Use the same opening for both arcs.",
      "Name the equal distances that make the line correct, not just the picture.",
    ],
    parentGuide:
      "Ask the learner which two lengths are equal at each crossing point and why.",
  },
  {
    id: "inscribed-polygon-reasoning",
    templateId: "inscribed-polygon-reasoning",
    title: "Reason about polygons inscribed in a circle",
    summary:
      "Stepping the radius around a circle gives a regular hexagon, because each central angle is 60 degrees.",
    objectives: [
      "Explain why a hexagon side equals the radius.",
      "Choose the construction for an inscribed triangle, square or hexagon.",
    ],
    goal: "Choose the reason, measure or method for a regular polygon inscribed in a circle.",
    intuition: [
      t`A polygon is inscribed in a circle when all its vertices lie on the circle. A central angle has its vertex at the center of the circle. A regular polygon's equal sides cut the full turn at the center into equal central angles. A chord is a segment joining two points on the circle.`,
      t`If the central angle is $60^\circ$ and the two radii are equal, the triangle formed with the chord has equal base angles that total $120^\circ$, so all three angles are $60^\circ$. The triangle is equilateral and the chord equals the radius. This is why stepping the radius around a circle returns to the start after six steps.`,
    ],
    terms: [
      ["inscribed polygon", "A polygon whose vertices all lie on one circle."],
      ["central angle", "An angle with its vertex at the center of a circle."],
      ["chord", "A segment joining two points of a circle."],
    ],
    method: [
      "A regular $n$-gon has central angles of $360^\\circ\\div n$.",
      "For $n=6$, the central angle is $60^\\circ$ and the side equals the radius, so the perimeter is $6r$.",
      "An equilateral triangle comes from every second hexagon vertex; a square from two perpendicular diameters.",
    ],
    watch:
      "The side is a chord, not an arc. The hexagon's perimeter $6r$ is less than the circumference $2\\pi r$.",
    principle: t`The central angle of a regular inscribed $n$-gon measures $360^\circ/n$. When the central angle is $60^\circ$ the triangle with the two radii is equilateral, so the chord equals the radius.`,
    example: {
      prompt:
        "A regular hexagon is inscribed in a circle of radius 5 cm by stepping a compass opened to 5 cm around the circle. What is its perimeter?",
      steps: [
        t`Six equal central angles share $360^\circ$, so each is $60^\circ$.`,
        t`Each side with two radii forms an equilateral triangle, so each side is $5$ cm.`,
        t`The perimeter is $6\times 5=30$ cm.`,
      ],
      answer: "30 cm",
    },
    methodTitle: "Triangle and square",
    methodText: [
      t`Taking every second vertex of the hexagon gives three points $120^\circ$ apart, which are the vertices of an equilateral triangle. Constructing a diameter and its perpendicular diameter gives four points $90^\circ$ apart, which are the vertices of a square.`,
    ],
    formalTitle: "Why the central angles are equal",
    formal: [
      t`In a regular polygon inscribed in a circle, equal chords subtend equal central angles because the triangles formed with the center are congruent by SSS. The $n$ central angles fill the full turn at the center, so each is $360^\circ/n$.`,
    ],
    pitfalls: [
      "A hexagon's side equals the radius, not the diameter.",
      "Central angles are measured at the center, not at a vertex of the polygon.",
      "Taking every second vertex is what makes the triangle.",
    ],
    parentGuide:
      "Ask the learner to say how many steps of the compass close the circle and why.",
  },
  {
    id: "triangle-circle-centers",
    templateId: "triangle-circle-centers",
    title: "Find circles tied to a triangle or quadrilateral",
    summary:
      "Perpendicular bisectors meet at the center of the circle through the vertices. Angle bisectors meet at the center of the circle tangent to the sides.",
    objectives: [
      "Choose the construction for a circumcenter or incenter.",
      "Use supplementary opposite angles of an inscribed quadrilateral.",
    ],
    goal: "Choose the right center construction, or find an angle or radius using circle properties.",
    intuition: [
      t`The circumscribed circle of a triangle passes through all three vertices. Its center, the circumcenter, is the same distance from the three vertices. The inscribed circle touches all three sides from inside. Its center, the incenter, is the same distance from the three sides.`,
      t`Points equally far from two vertices lie on the perpendicular bisector of the segment between them, so the circumcenter is where perpendicular bisectors meet. Points equally far from two sides lie on the bisector of the angle between them, so the incenter is where angle bisectors meet.`,
    ],
    terms: [
      [
        "circumcenter",
        "The center of the circle through the three vertices of a triangle.",
      ],
      [
        "incenter",
        "The center of the circle inside a triangle that is tangent to all three sides.",
      ],
      [
        "inscribed quadrilateral",
        "A quadrilateral whose four vertices lie on one circle.",
      ],
    ],
    method: [
      "For the circle through the vertices, use perpendicular bisectors of sides. For the circle tangent to the sides, use angle bisectors.",
      "For an inscribed quadrilateral, write opposite angles as supplementary: their measures total $180^\\circ$.",
      "In a right triangle, the circumcenter is the midpoint of the hypotenuse, so the circumradius is half the hypotenuse.",
    ],
    watch:
      "Medians and altitudes also meet at points, but those points are not centers of the circle through the vertices or the circle tangent to the sides.",
    principle: t`The circumcenter is the intersection of the perpendicular bisectors of the sides. The incenter is the intersection of the angle bisectors. Opposite angles of a quadrilateral inscribed in a circle are supplementary. The hypotenuse of a right triangle is a diameter of its circumscribed circle.`,
    example: {
      prompt: t`Quadrilateral $ABCD$ is inscribed in a circle. $m\angle A=(2x+10)^\circ$ and $m\angle C=(4x+20)^\circ$. What is $m\angle A$?`,
      steps: [
        t`Opposite angles of an inscribed quadrilateral are supplementary: $(2x+10)+(4x+20)=180$.`,
        t`$6x+30=180$, so $x=25$.`,
        t`$m\angle A=2(25)+10=60^\circ$. Check: $m\angle C=120^\circ$ and $60+120=180$.`,
      ],
      answer: "60 degrees",
    },
    methodTitle: "Right-triangle circumradius",
    methodText: [
      t`A right triangle with legs $6$ and $8$ has hypotenuse $10$. The hypotenuse is a diameter of the circle through its vertices, so the radius is $5$. The circle inside the triangle is different; its radius is $\frac{6+8-10}{2}=2$.`,
    ],
    formalTitle: "Why the facts hold",
    formal: [
      t`A point on the perpendicular bisector of a segment is equally far from its endpoints, so the intersection of two bisectors of sides is equally far from all three vertices. A point on an angle bisector is equally far from the angle's sides, so the intersection of angle bisectors is equally far from all three sides.`,
      t`Opposite angles of an inscribed quadrilateral intercept arcs that together make the whole circle, $360^\circ$, and each inscribed angle is half its arc, so they total $180^\circ$.`,
    ],
    pitfalls: [
      "Do not mix up the circle through the vertices with the circle inside the triangle.",
      "Opposite angles total $180^\\circ$; they are not equal in general.",
      "Substitute $x$ back into the expression the question asks for.",
    ],
    parentGuide:
      "Ask the learner whether the center must be equally far from the corners or from the sides.",
  },
  {
    id: "tangent-circle-computation",
    templateId: "tangent-circle-computation",
    title: "Compute with tangents to a circle",
    summary:
      "A tangent is perpendicular to the radius at its touching point, and two tangents from one outside point are equal.",
    objectives: [
      "Use the Pythagorean theorem in the right triangle formed by a tangent and a radius.",
      "Use equal tangent segments from an external point.",
    ],
    goal: "Find a tangent length, radius, angle or unknown from the tangent-radius right angle and equal tangent segments.",
    intuition: [
      t`A tangent to a circle is a line that touches the circle at exactly one point, the point of tangency. A radius is a segment from the center to the circle. The tangent is perpendicular to the radius drawn to the point of tangency. So a tangent segment, the radius and the segment from the center to the outside point form a right triangle.`,
      t`From one point outside a circle you can draw two tangents. The two tangent segments from that point to the circle have the same length.`,
    ],
    terms: [
      ["tangent", "A line that touches a circle at exactly one point."],
      ["point of tangency", "The point where a tangent touches the circle."],
      [
        "hypotenuse",
        "The longest side of a right triangle, opposite the right angle.",
      ],
    ],
    method: [
      "Draw the radius to the point of tangency. It makes a right angle with the tangent.",
      "The segment from the center to the outside point is the hypotenuse. Use $a^2+b^2=c^2$ with the radius and tangent segment as legs.",
      "For two tangent segments from one point, set their expressions equal and solve.",
    ],
    watch:
      "The hypotenuse is the segment from the center to the external point, not the tangent segment.",
    principle: t`A tangent is perpendicular to the radius at the point of tangency. If $T$ is the point of tangency and $P$ is outside the circle with center $O$, then $OT^2+PT^2=OP^2$. Two tangent segments to a circle from the same external point are congruent.`,
    example: {
      prompt:
        "Point P is outside a circle with center O and radius 5. OP = 13 and PT is tangent to the circle at T. What is PT?",
      steps: [
        t`The radius $OT$ is perpendicular to the tangent, so triangle $OTP$ is right-angled at $T$, with hypotenuse $OP=13$.`,
        t`$PT^2=13^2-5^2=169-25=144$.`,
        t`$PT=12$.`,
      ],
      answer: "12",
    },
    methodTitle: "Equal tangents",
    methodText: [
      t`If $PA=3x+2$ and $PB=5x-6$ are tangent segments from $P$, then $3x+2=5x-6$, so $x=4$ and $PA=14$. If $m\angle TOP=40^\circ$ in right triangle $OTP$, then $m\angle OPT=90-40=50^\circ$.`,
    ],
    formalTitle: "Why these hold",
    formal: [
      t`If a line through $T$ were not perpendicular to $OT$, the foot of the perpendicular from $O$ would be another point of the line closer to $O$ than $T$, so inside the circle; the line would meet the circle twice. So a tangent must be perpendicular to $OT$.`,
      t`Tangent segments $PA$ and $PB$: right triangles $OAP$ and $OBP$ have $OA=OB$ and the shared hypotenuse $OP$, so they are congruent (HL), and $PA=PB$.`,
    ],
    pitfalls: [
      "The hypotenuse is the segment from the center to the outside point.",
      "Subtract squares to find a leg: $c^2-a^2$.",
      "Solve for $x$ first, then substitute into the segment asked for.",
    ],
    parentGuide:
      "Ask the learner to sketch the radius to the tangent point and mark the right angle.",
  },
  {
    id: "circle-dilation-scaling",
    templateId: "circle-dilation-scaling",
    title: "Map one circle onto another by a dilation",
    summary:
      "Any circle maps onto any other by a translation and a dilation, so all circles are similar and lengths scale by one factor.",
    objectives: [
      "Find the scale factor from two radii and how circumference and area scale.",
      "Choose the translation and dilation that map one circle to another.",
    ],
    goal: "Find the scale factor, area or circumference ratio, or the transformation sequence that maps one circle onto another.",
    intuition: [
      t`A dilation with scale factor $k$ multiplies every length by $k$. Circles are determined by a center and a radius, so a translation moves the center and a dilation changes the radius. That means any circle can be mapped onto any other, which is why all circles are similar.`,
      t`Lengths like radius, diameter and circumference are multiplied by $k$. Areas are multiplied by $k^2$ because area has two dimensions.`,
    ],
    terms: [
      ["scale factor", "The number by which a dilation multiplies lengths."],
      [
        "similar",
        "Having the same shape: one can be mapped onto the other by a dilation and rigid motions.",
      ],
      [
        "dilation center",
        "The fixed point from which a dilation scales distances.",
      ],
    ],
    method: [
      "Find the scale factor $k$ as image radius divided by original radius.",
      "Circumference scales by $k$; area scales by $k^2$.",
      "To map circle $A$ onto circle $B$, translate by the vector from center $A$ to center $B$, then dilate about center $B$ by $k$.",
    ],
    watch:
      "Divide image by original for the scale factor. Square the factor for area.",
    principle: t`A dilation with scale factor $k$ maps a circle of radius $r$ onto a circle of radius $kr$. Hence circumference $2\pi r$ is multiplied by $k$ and area $\pi r^2$ by $k^2$. A translation followed by a dilation about the new center maps any circle onto any other, so all circles are similar.`,
    example: {
      prompt:
        "A dilation maps a circle of radius 3 onto a circle of radius 12. What is the scale factor, and by what factor is the area multiplied?",
      steps: [
        t`Scale factor: $12\div 3=4$.`,
        t`Area is multiplied by $4^2=16$; circumference by $4$.`,
        t`Check: area $\pi\cdot 3^2=9\pi$ becomes $\pi\cdot 12^2=144\pi$, and $9\pi\times16=144\pi$.`,
      ],
      answer: "Scale factor 4; area multiplied by 16",
    },
    methodTitle: "Sequence for two circles",
    methodText: [
      t`Circle $A$ has center $(2,1)$ and radius $2$; circle $B$ has center $(8,-3)$ and radius $6$. The scale factor is $3$. Translate by $\langle6,-4\rangle$ to move the center to $(8,-3)$, then dilate by $3$ about $(8,-3)$. The center stays and the radius becomes $6$.`,
    ],
    formalTitle: "All circles are similar",
    formal: [
      t`A circle with center $C$ and radius $r$ is the set of points at distance $r$ from $C$. A translation by the vector from $C_1$ to $C_2$ carries the first circle to one centered at $C_2$ with the same radius. A dilation about $C_2$ with factor $k=r_2/r_1$ keeps the center and changes the radius to $r_2$. Their composition maps the first circle onto the second.`,
    ],
    pitfalls: [
      "A dilation about the wrong point moves the center.",
      "Area scales by the square of the factor, circumference by the factor.",
      "The scale factor is image over original.",
    ],
    parentGuide:
      "Ask the learner what happens to the center and what happens to the radius in each step.",
  },
  {
    id: "coordinate-quadrilateral-claims",
    templateId: "coordinate-quadrilateral-claims",
    title: "Decide what coordinates prove about a quadrilateral",
    summary:
      "Vectors for the sides show parallel sides, a dot product shows a right angle, and squared lengths show equal sides.",
    objectives: [
      "Test parallel sides, right angles and equal sides from vertex coordinates.",
      "Choose the most specific quadrilateral the tests prove.",
    ],
    goal: "From vertex coordinates, choose the most specific classification of a quadrilateral that the coordinates prove.",
    intuition: [
      t`A side from $A(x_1,y_1)$ to $B(x_2,y_2)$ has vector $\overrightarrow{AB}=\langle x_2-x_1,y_2-y_1\rangle$. Two sides are parallel when their vectors point in the same or opposite direction, which means one is a multiple of the other. Two sides are perpendicular when the dot product of their vectors is $0$, where $\langle a,b\rangle\cdot\langle c,d\rangle=ac+bd$. Squared length is $a^2+b^2$.`,
      t`Parallelogram, rectangle, rhombus and square are nested: each tests one more condition. A parallelogram has two pairs of parallel sides. A rectangle adds a right angle. A rhombus adds equal adjacent sides. A square has both.`,
    ],
    terms: [
      [
        "vector",
        "A pair $\\langle a,b\\rangle$ giving the horizontal and vertical change from one point to another.",
      ],
      [
        "dot product",
        "$\\langle a,b\\rangle\\cdot\\langle c,d\\rangle=ac+bd$; zero exactly when the vectors are perpendicular.",
      ],
      ["adjacent sides", "Two sides that share a vertex."],
    ],
    method: [
      "Compute $\\overrightarrow{AB}$, $\\overrightarrow{DC}$, $\\overrightarrow{BC}$ and $\\overrightarrow{AD}$. Equal vectors for opposite sides show a parallelogram.",
      "Compute $\\overrightarrow{AB}\\cdot\\overrightarrow{AD}$. If it is $0$, the figure has a right angle.",
      "Compare $AB^2$ and $AD^2$. Choose the most specific type that all results support.",
    ],
    watch:
      "Only two parallel sides with the other pair not parallel makes a trapezoid; check both pairs before naming a parallelogram.",
    principle: t`A quadrilateral is a parallelogram when opposite sides are parallel. A parallelogram is a rectangle when $\overrightarrow{AB}\cdot\overrightarrow{AD}=0$, a rhombus when $AB=AD$, and a square when both hold.`,
    example: {
      prompt: t`Quadrilateral $ABCD$ has $A(0,0)$, $B(4,3)$, $C(7,-1)$ and $D(3,-4)$. What is the most specific statement the coordinates prove?`,
      steps: [
        t`$\overrightarrow{AB}=\langle4,3\rangle=\overrightarrow{DC}$ and $\overrightarrow{BC}=\langle3,-4\rangle=\overrightarrow{AD}$, so opposite sides are parallel: a parallelogram.`,
        t`$\overrightarrow{AB}\cdot\overrightarrow{AD}=4\cdot3+3\cdot(-4)=0$, so there is a right angle at $A$.`,
        t`$AB^2=16+9=25$ and $AD^2=9+16=25$, so adjacent sides are equal. All tests hold: a square.`,
      ],
      answer: "A square",
    },
    methodTitle: "Trapezoids",
    methodText: [
      t`If $\overrightarrow{AB}$ and $\overrightarrow{DC}$ are parallel but $\overrightarrow{BC}$ and $\overrightarrow{AD}$ are not, the quadrilateral has exactly one pair of parallel sides and is a trapezoid; no further claim about angles or sides follows.`,
    ],
    formalTitle: "Why the tests work",
    formal: [
      t`Two nonzero vectors are parallel exactly when $a d-b c=0$. They are perpendicular exactly when their dot product is zero, because $|u||v|\cos\theta=u\cdot v$. Squared length is $u\cdot u$. These facts turn each geometric property into an arithmetic test, which is the basis of a coordinate proof.`,
    ],
    pitfalls: [
      "Equal opposite vectors prove a parallelogram, but one pair of equal sides alone does not.",
      "A right angle at $A$ with a parallelogram makes a rectangle.",
      "Name the most specific type the evidence supports.",
    ],
    parentGuide:
      "Ask the learner to list the four side vectors and say which pairs are equal.",
  },
  {
    id: "measurement-formula-justifications",
    templateId: "measurement-formula-justifications",
    title: "Justify circle and solid measurement formulas",
    summary:
      "Cut, rearrange and compare: a circle's area follows from rearranged sectors and a pyramid is one third of a prism.",
    objectives: [
      "Use a dissection to find the area or volume it justifies.",
      "Choose the argument that proves a circle or solid formula.",
    ],
    goal: "Find a quantity from a dissection argument, or choose the step that justifies a circle or solid formula.",
    intuition: [
      t`To explain a formula, find a shape whose measure you already know and show that your shape has the same measure. Cutting a figure into pieces and rearranging them keeps its area. Circumference is the distance around a circle, and the number $\pi$ is the ratio of circumference to diameter, the same for every circle.`,
      t`A pyramid has a polygon base and triangular faces meeting at a point, the apex. Three congruent pyramids fill a cube when their apexes meet at one vertex. That gives the volume of a pyramid in terms of the volume of a prism.`,
    ],
    terms: [
      [
        "dissection",
        "Cutting a figure into pieces that can be rearranged into another figure.",
      ],
      [
        "sector",
        "A pie-slice region of a circle, bounded by two radii and an arc.",
      ],
      [
        "apex",
        "The point where the triangular faces of a pyramid or cone meet.",
      ],
    ],
    method: [
      "Identify the known shape the figure is compared to, and the measures that carry over.",
      "For the circle: half the circumference and the radius are the sides of the rearranged near-rectangle, so area $\\approx\\pi r\\cdot r$.",
      "For pyramids and cones: they are one third of the prism or cylinder with the same base and height.",
    ],
    watch:
      "A few measurements do not prove a formula. A justification must hold for every case.",
    principle: t`$C=\pi d=2\pi r$ because $\pi$ is the same for all circles. As a circle is cut into more sectors, the rearranged shape approaches a rectangle with sides $\pi r$ and $r$, so the area is $\pi r^2$. A pyramid has volume $\frac13Bh$, and a cone $\frac13\pi r^2h$, one third of the matching prism or cylinder.`,
    example: {
      prompt:
        "A cube with edge 6 is cut into three congruent square pyramids whose apexes all meet at one vertex of the cube. Each pyramid has one face of the cube as its base and height 6. What is the volume of one pyramid?",
      steps: [
        t`The cube's volume is $6^3=216$.`,
        t`Three congruent pyramids fill it, so each is $216\div3=72$.`,
        t`With base area $B=36$ and height $h=6$, $\frac13Bh=\frac13\cdot36\cdot6=72$.`,
      ],
      answer: "72",
    },
    methodTitle: "Circle area by sectors",
    methodText: [
      t`Cut a circle of radius $r$ into many equal thin sectors and lay them side by side, alternately pointing up and down. Half the arcs are on the top and half on the bottom, so the long side is about half the circumference, $\pi r$. The short side is about $r$. As the sectors get thinner, each arc becomes nearly straight and the shape approaches a rectangle of area $\pi r\cdot r=\pi r^2$.`,
    ],
    formalTitle: "What is and is not a proof",
    formal: [
      t`All circles are similar, so the ratio $C/d$ is the same for every circle. This common value is defined as $\pi$, and $C=\pi d$ follows. The sector argument is a limit argument: the area of the rearranged shape stays equal to the circle's area, and its boundary approaches a rectangle's, so the area is the limit of the rectangle areas. Measuring examples can suggest a formula but cannot prove it.`,
    ],
    pitfalls: [
      "Half the circumference, not the whole, is the long side of the near-rectangle.",
      "A pyramid is one third of the prism with the same base and height, not one half.",
      "Measuring examples is evidence, not a proof.",
    ],
    parentGuide:
      "Ask the learner why a rearrangement keeps the area unchanged.",
  },
];

export const geometryProofFamilyMethods: Record<string, ProblemMethod> =
  Object.fromEntries(
    specs.map((s) => [
      s.templateId,
      {
        goal: s.goal,
        intuition: s.intuition.join(" "),
        terms: s.terms,
        method: s.method,
        watch: s.watch,
      },
    ]),
  );

export const geometryProofFamilyPrinciples: Record<string, string> =
  Object.fromEntries(specs.map((s) => [s.templateId, s.principle]));

export const geometryProofFamilyLessons: Lesson[] = specs.map((s) => ({
  id: s.id,
  title: s.title,
  summary: s.summary,
  templateIds: [s.templateId],
  includeGeneratedRepresentation: false,
  objectives: s.objectives,
  sections: [
    {
      stage: "intuition" as const,
      title: "The idea",
      paragraphs: s.intuition,
    },
  ],
  workedExample: s.example,
  closingSections: [
    {
      stage: "method" as const,
      title: s.methodTitle,
      paragraphs: s.methodText,
    },
    {
      stage: "formal" as const,
      title: s.formalTitle,
      paragraphs: s.formal,
    },
  ],
  pitfalls: s.pitfalls,
  parentGuide: s.parentGuide,
}));
