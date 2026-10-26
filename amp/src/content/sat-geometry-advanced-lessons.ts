import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const satGeometryAdvancedMethods: Record<string, ProblemMethod> = {
  "corresponding-angle-transfer": {
    goal: "Given a similarity or congruence statement and some angles, choose the measure of a named angle in the second triangle.",
    intuition:
      "In a statement such as $\\triangle ABC\\sim\\triangle EFD$, the letters match in order: $A$ with $E$, $B$ with $F$, $C$ with $D$. Similar or congruent triangles have equal corresponding angles. A scale factor changes side lengths only.",
    terms: [
      [
        "corresponding angles",
        "Angles at matching vertices of two triangles. Similar triangles have equal corresponding angles.",
      ],
      [
        "similar triangles",
        "Triangles with equal corresponding angles and corresponding sides in one common ratio.",
      ],
      [
        "congruent triangles",
        "Triangles with all corresponding angles and sides equal; they are similar with ratio 1.",
      ],
    ],
    method: [
      "Write the vertex pairs from the order of the letters in the statement.",
      "Find the first-triangle angle at the matching vertex. If it is not given, use the angle sum 180°, or 90° for the two acute angles of a right triangle.",
      "State the corresponding angle with the same measure. Do not multiply it by a scale factor.",
    ],
    watch:
      "Match by position in the statement, not by alphabet or by the position in the picture. A side scale factor never changes an angle.",
  },
  "crossing-segment-similarity": {
    goal: "Two segments cross; use the similar triangles they form to find a missing length.",
    intuition:
      "Where two segments cross at $E$, the angles on opposite sides of $E$ are vertical angles and are equal. One more equal pair, from a parallel segment or a stated equal angle, makes the two triangles similar.",
    terms: [
      [
        "vertical angles",
        "Opposite angles formed by two crossing lines; they are equal.",
      ],
      [
        "alternate interior angles",
        "Angles on opposite sides of a transversal and between two parallel lines; they are equal.",
      ],
    ],
    method: [
      "Name the two triangles and pair their vertices: the crossing point matches itself, and the other vertices match through the equal angles.",
      "Write an equation that sets two ratios of corresponding sides equal, with the unknown in one of them.",
      "Cross-multiply and solve. Check that the unknown is the side matched with the side you used in its ratio.",
    ],
    watch:
      "Pair sides across the crossing point, not along one segment. $AE$ pairs with $BE$, and $CE$ with $DE$, when $A$ corresponds to $B$ and $C$ to $D$.",
  },
  "angle-chase-chain": {
    goal: "Combine vertical angles, a triangle angle sum and angles made by parallel lines to find one angle.",
    intuition:
      "Each fact gives one angle from another: vertical angles are equal, angles on a straight line add to 180°, and a line cutting parallel lines makes equal corresponding angles and supplementary same-side interior angles. A chain uses several of these in a row.",
    terms: [
      [
        "same-side interior angles",
        "Two angles between parallel lines on the same side of a transversal; they add to 180°.",
      ],
      [
        "corresponding angles",
        "Angles in the same position at the two crossings of a transversal with parallel lines; they are equal.",
      ],
    ],
    method: [
      "List what each given fact lets you find: an equation for a variable, or a third angle of a triangle.",
      "Solve for the variable or the third angle first.",
      "Carry that angle across the parallel lines or along the straight line, one fact per step, and stop at the requested angle.",
    ],
    watch:
      "Equal angles come from vertical and corresponding pairs. Supplementary angles come from straight lines and same-side interior pairs. Decide which before writing the equation.",
  },
  "angle-claim-reasoning": {
    goal: "Decide which angle measure is possible, how two angles compare, or which expression cannot be an angle sum.",
    intuition:
      "Some angle questions have a set of allowed values rather than one answer. Every triangle angle is positive, so each angle is less than 180° minus any other angle. Crossing lines make only two kinds of angle: a given angle and its supplement.",
    terms: [
      [
        "supplementary angles",
        "Two angles that add to 180°, such as the adjacent angles formed by crossing lines.",
      ],
    ],
    method: [
      "For a triangle, subtract the known angle from 180°. The other two angles are positive and add to that amount, so each is smaller than it.",
      "For two crossing lines, the four angles are two equal to the given angle and two equal to its supplement.",
      "Add every possible pair of angles or compare the two angles named, then pick the choice that the list allows or rules out.",
    ],
    watch:
      "An angle equal to the whole remaining sum would leave 0° for the third angle, so it is not possible. A single angle is not a sum of two.",
  },
  "circle-radii-triangle": {
    goal: "Use equal radii to find an angle or length in the triangle formed by two radii and a chord.",
    intuition:
      "Every radius of a circle has the same length. Two radii and a chord form a triangle with two equal sides, so it is isosceles and the angles opposite the equal sides are equal.",
    terms: [
      ["chord", "A segment with both endpoints on the circle."],
      [
        "central angle",
        "An angle whose vertex is the center of the circle; it has the same measure as the arc it cuts off.",
      ],
    ],
    method: [
      "Mark both radii equal in the triangle formed by the center and the chord.",
      "For angles, the base angles at the chord are equal and add to 180° minus the central angle.",
      "For lengths, the perimeter is two radii plus the chord. Solve for the missing length.",
    ],
    watch:
      "The equal angles are at the chord's endpoints, not at the center. The perimeter counts the radius twice.",
  },
  "shifted-polynomial-features": {
    goal: "Find an extreme point, the $x$-intercepts or a value of a polynomial whose graph is shifted.",
    intuition:
      "In $g(x)=f(x+c)$ the input is changed first, so the graph moves the opposite way from the sign: $f(x+3)$ moves 3 units left. In $g(x)=f(x)+k$ the output is changed, so the graph moves $k$ units up.",
    terms: [
      [
        "$x$-intercept",
        "A point where the graph meets the $x$-axis; its $x$-value makes the function equal 0.",
      ],
      [
        "vertex",
        "The turning point of a parabola. For $ax^2+bx+c$ it is at $x=-\\frac{b}{2a}$.",
      ],
    ],
    method: [
      "Find the feature of the original function $f$: its vertex $x$-value, its intercepts, or $f$ at a given input.",
      "For $f(x+c)$ subtract $c$ from every $x$-value of the feature. For $f(x-c)$ add $c$. For $f(x)+k$ add $k$ to every output.",
      "Sum, evaluate or report as asked.",
    ],
    watch:
      "A horizontal shift moves every intercept, so the sum of three intercepts moves by three times the shift.",
  },
  "radical-side-entry": {
    goal: "Find a hypotenuse in simplest radical form and report its radicand or coefficient, or find a leg of a decimal right triangle.",
    intuition:
      "The Pythagorean theorem $a^2+b^2=c^2$ often gives a hypotenuse that is not a whole number. A simplified radical $m\\sqrt{n}$ takes the largest perfect square out of the root.",
    terms: [
      [
        "radicand",
        "The number under the root sign. In $m\\sqrt{n}$ it is $n$.",
      ],
      [
        "simplest radical form",
        "A form $m\\sqrt{n}$ in which $n$ has no perfect-square factor except 1.",
      ],
    ],
    method: [
      "Compute $c^2=a^2+b^2$, or $b^2=c^2-a^2$ for a missing leg.",
      "For a radical, factor $c^2$ as a perfect square times a smaller whole number and take the square root of the perfect square out front.",
      "Read off the requested number. For decimals, work with the decimal squares and take the square root last.",
    ],
    watch:
      "Take out the largest perfect square. $\\sqrt{72}=6\\sqrt{2}$, not $3\\sqrt{8}$. Subtract squares to find a leg, never the lengths.",
  },
  "special-triangle-in-figure": {
    goal: "Recognize a 45-45-90 or 30-60-90 triangle in a figure and use its side ratios.",
    intuition:
      "Two kinds of right triangle have fixed side ratios. A 45-45-90 triangle has equal legs and a hypotenuse $\\sqrt{2}$ times a leg. A 30-60-90 triangle has legs in the ratio $1:\\sqrt{3}$ and a hypotenuse twice the shorter leg. Squares and equilateral triangles split into these.",
    terms: [
      [
        "altitude",
        "The perpendicular segment from a vertex to the opposite side; in an equilateral triangle it also bisects that side.",
      ],
      [
        "circumradius",
        "The radius of the circle through all three vertices of a polygon.",
      ],
    ],
    method: [
      "Find the side the figure gives: a side from a perimeter, or a diagonal as a diameter.",
      "Draw the altitude of an equilateral triangle, or a diagonal of a square. Name the special right triangle that results.",
      "Apply its ratio, then read off the requested number.",
    ],
    watch:
      "The shorter leg is opposite the smaller angle. In an equilateral triangle the altitude is the longer leg, not the hypotenuse.",
  },
};

export const satGeometryAdvancedPrinciples: Record<string, string> = {
  "corresponding-angle-transfer":
    "If $\\triangle ABC\\sim\\triangle DEF$, then $\\angle A=\\angle D$, $\\angle B=\\angle E$ and $\\angle C=\\angle F$, and the corresponding sides satisfy $\\frac{DE}{AB}=\\frac{EF}{BC}=\\frac{FD}{CA}$. Congruent triangles are the case where this ratio is 1.",
  "crossing-segment-similarity":
    "Two triangles with two pairs of equal angles are similar (AA), and corresponding sides of similar triangles are proportional. Vertical angles are equal.",
  "angle-chase-chain":
    "Vertical angles are equal. Angles on a straight line add to 180°. When a transversal crosses parallel lines, corresponding angles are equal and same-side interior angles add to 180°. The angles of a triangle add to 180°.",
  "angle-claim-reasoning":
    "In a triangle each angle is positive and the three add to 180°, so each is less than 180° minus either of the others. Two crossing lines form angles of measure $\\theta$ and $180°-\\theta$ only.",
  "circle-radii-triangle":
    "All radii of a circle are equal, so a triangle formed by two radii and a chord is isosceles, and angles opposite equal sides are equal. A central angle has the same measure as its minor arc.",
  "shifted-polynomial-features":
    "The graph of $y=f(x-c)$ is the graph of $y=f(x)$ moved $c$ units to the right, and the graph of $y=f(x)+k$ is moved $k$ units up. A point $(u,v)$ of $f$ becomes $(u+c,v)$ and $(u,v+k)$ respectively.",
  "radical-side-entry":
    "In a right triangle with legs $a$ and $b$ and hypotenuse $c$, $a^2+b^2=c^2$. If $c^2=m^2n$ with $m$ and $n$ positive integers, then $c=m\\sqrt{n}$.",
  "special-triangle-in-figure":
    "A 45-45-90 triangle has sides in the ratio $1:1:\\sqrt{2}$, and a 30-60-90 triangle has sides in the ratio $1:\\sqrt{3}:2$. The shorter leg is opposite the smaller angle.",
};

export const satGeometryAdvancedLessons: Lesson[] = [
  {
    id: "sat-similarity-correspondence",
    title: "Corresponding parts of similar and congruent triangles",
    summary:
      "Letters in a similarity or congruence statement pair the vertices. Equal corresponding angles then carry measures, and equal angles make triangles in crossing segments similar.",
    templateIds: [
      "corresponding-angle-transfer",
      "crossing-segment-similarity",
    ],
    objectives: [
      "Read the vertex pairing from a similarity or congruence statement and transfer an angle across it.",
      "Use vertical angles and a parallel or equal-angle premise to find a missing length in crossing segments.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The statement is a matching list",
        paragraphs: [
          "Two triangles are similar when their corresponding angles are equal and their corresponding sides have one common ratio. In $\\triangle ABC\\sim\\triangle EFD$ the first letters match, the second letters match and the third letters match: $A$ with $E$, $B$ with $F$, $C$ with $D$. The order of letters carries the whole pairing, not the position in a picture.",
          "A scale factor describes lengths only. If $\\triangle EFD$ has sides twice as long, its angles are still equal to the corresponding angles of $\\triangle ABC$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "$\\triangle ABC\\sim\\triangle EFD$. In $\\triangle ABC$, $\\angle A=48°$ and $\\angle B=67°$. What is $\\angle D$?",
      steps: [
        "The letters pair in order: $A$ with $E$, $B$ with $F$, $C$ with $D$. So $\\angle D$ corresponds to $\\angle C$.",
        "The angles of $\\triangle ABC$ add to 180°, so $\\angle C=180-48-67=65$ degrees.",
        "Corresponding angles are equal, so $\\angle D=65°$.",
      ],
      answer: "$65°$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Crossing segments",
        paragraphs: [
          "When segments $AB$ and $CD$ cross at $E$, the angles $\\angle AEC$ and $\\angle BED$ are vertical angles, so they are equal. If $AC\\parallel BD$, the alternate interior angles at $A$ and $B$ are equal too. Two equal angle pairs make $\\triangle AEC\\sim\\triangle BED$ with $A\\leftrightarrow B$, $E\\leftrightarrow E$ and $C\\leftrightarrow D$.",
          "Then $\\frac{AE}{BE}=\\frac{CE}{DE}=\\frac{AC}{BD}$. Put the unknown in one ratio, cross-multiply and solve. For $AE=6$, $BE=9$ and $CE=10$ the equation $\\frac{6}{9}=\\frac{10}{DE}$ gives $DE=15$.",
        ],
      },
      {
        stage: "formal",
        title: "Why two angles are enough",
        paragraphs: [
          "The three angles of a triangle add to 180°, so two equal angle pairs force the third pair to be equal. All three angles equal makes the triangles similar (AA similarity). Congruent triangles are similar with ratio 1, so they share the same correspondence rule.",
        ],
      },
    ],
    pitfalls: [
      "Pair vertices by the order of the letters in the statement.",
      "Do not multiply an angle by a side scale factor.",
      "Set up ratios across the crossing point: $AE$ goes with $BE$ when $A$ corresponds to $B$.",
    ],
    parentGuide:
      "Ask the learner to write the three vertex pairs in $\\triangle ABC\\sim\\triangle EFD$ before looking for any angle.",
  },
  {
    id: "sat-angle-chains-and-bounds",
    title: "Angle chains and what angles must or cannot be",
    summary:
      "Chain vertical, straight-line, parallel-line and triangle facts, and use positive angle sums to rule values in or out.",
    templateIds: ["angle-chase-chain", "angle-claim-reasoning"],
    objectives: [
      "Chain two or three angle facts to reach a requested angle.",
      "Use the triangle angle sum as a bound and list the sums two crossing lines allow.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One fact at a time",
        paragraphs: [
          "Vertical angles are equal. Angles on a straight line add to 180°. A transversal across parallel lines makes equal corresponding angles and same-side interior angles that add to 180°. The angles of a triangle add to 180°. An angle chain uses a few of these in order; each step gives the next angle.",
          "Some questions ask what an angle can be rather than what it is. A triangle with a 120° angle leaves 60° to share between the other two angles, so each of those must be less than 60°.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "In triangle $ABC$, $\\angle A=50°$ and $\\angle B=60°$. $D$ is on $AB$, $E$ is on $BC$, and $DE\\parallel AC$. Find the obtuse angle $\\angle DEC$.",
      steps: [
        "The angles of the triangle add to 180°, so $\\angle C=180-50-60=70$ degrees.",
        "$DE\\parallel AC$, so corresponding angles are equal: $\\angle DEB=\\angle C=70°$.",
        "$\\angle DEB$ and $\\angle DEC$ lie on the straight line $BC$, so $\\angle DEC=180-70=110$ degrees.",
      ],
      answer: "$110°$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Bounds and lists",
        paragraphs: [
          "Two crossing lines form four angles: two equal to a given angle $\\theta$ and two equal to $180°-\\theta$. Choosing two of them gives only three sums: $2\\theta$, 180° and $360°-2\\theta$. Any other expression, such as $\\theta+90°$, cannot be the sum.",
          "For a triangle, subtract the known angle from 180°. If a triangle has a 100° angle, the other two angles add to 80°, so one of them could be 30° but could not be 80°, since that would leave 0°.",
        ],
      },
      {
        stage: "formal",
        title: "Why the list is complete",
        paragraphs: [
          "Two lines meeting at a point make four angles in two vertical pairs. Vertical angles are equal and adjacent angles form a straight line, so the measures are $\\theta,180°-\\theta,\\theta,180°-\\theta$. Every sum of two of these is $2\\theta$, 180° or $360°-2\\theta$.",
        ],
      },
    ],
    pitfalls: [
      "Decide whether a pair is equal (vertical, corresponding) or supplementary (straight line, same-side interior) before writing the equation.",
      "An angle that uses up the whole remaining sum leaves 0° for the third angle.",
    ],
    parentGuide:
      "Ask the learner to name the angle fact they use at each step of a chain, in order.",
  },
  {
    id: "sat-radii-and-special-triangles",
    title: "Radii, right triangles and special triangles in figures",
    summary:
      "Equal radii form isosceles triangles, radical hypotenuses come from the Pythagorean theorem, and squares and equilateral triangles hide special right triangles.",
    templateIds: [
      "circle-radii-triangle",
      "radical-side-entry",
      "special-triangle-in-figure",
    ],
    objectives: [
      "Use equal radii to find an angle or a length in the triangle formed by two radii and a chord.",
      "Write a hypotenuse in simplest radical form and find a leg with decimal sides.",
      "Use 45-45-90 and 30-60-90 ratios in a square inscribed in a circle and in an equilateral triangle.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Look for the right or isosceles triangle",
        paragraphs: [
          "Every radius of a circle has the same length, so two radii and a chord form an isosceles triangle with equal base angles at the chord. A central angle equals its minor arc, so the base angles are half of 180° minus the arc.",
          "A hypotenuse $c$ of legs $a$ and $b$ satisfies $c^2=a^2+b^2$. When $c^2$ has a perfect-square factor, the root simplifies to $m\\sqrt{n}$. A square cut along a diagonal or an equilateral triangle cut along an altitude produces right triangles with fixed side ratios.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A square is inscribed in a circle of radius $5\\sqrt{2}$. What is the side length of the square?",
      steps: [
        "A diagonal of the square passes through the center, so it is a diameter: $2\\cdot5\\sqrt{2}=10\\sqrt{2}$.",
        "A diagonal cuts the square into two 45-45-90 triangles whose legs are sides. The diagonal is the side times $\\sqrt{2}$.",
        "Side $=\\frac{10\\sqrt{2}}{\\sqrt{2}}=10$.",
      ],
      answer: "$10$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Radicals, and the two ratios",
        paragraphs: [
          "For legs 6 and 8 the hypotenuse is 10. For legs 3 and 9, $c^2=90=9\\cdot10$, so $c=3\\sqrt{10}$: here $m=3$ and $n=10$. For decimals, square each length as a decimal, subtract the squares and take the root. A triangle with hypotenuse 1.3 and leg 0.5 has other leg $\\sqrt{1.69-0.25}=1.2$.",
          "A 45-45-90 triangle has sides in the ratio $1:1:\\sqrt{2}$. A 30-60-90 triangle has sides in the ratio $1:\\sqrt{3}:2$, with the shorter leg opposite 30°. An altitude of an equilateral triangle with side $s$ is the longer leg of such a triangle, so it measures $\\frac{s\\sqrt{3}}{2}$.",
        ],
      },
      {
        stage: "formal",
        title: "Where the ratios come from",
        paragraphs: [
          "Half of an equilateral triangle of side $s$ is a right triangle with hypotenuse $s$ and a leg $\\frac{s}{2}$, so the other leg is $\\sqrt{s^2-\\frac{s^2}{4}}=\\frac{s\\sqrt{3}}{2}$. A square of side $s$ has diagonal $\\sqrt{s^2+s^2}=s\\sqrt{2}$.",
        ],
      },
    ],
    pitfalls: [
      "The perimeter of the triangle formed by a chord and two radii counts the radius twice.",
      "Take out the largest perfect square from the root.",
      "A diagonal of an inscribed square is a diameter, not a radius.",
    ],
    parentGuide:
      "Ask the learner to draw a square in a circle and mark which segment is the diameter.",
  },
  {
    id: "sat-shifted-polynomials",
    title: "Features of shifted polynomials",
    summary:
      "A horizontal shift moves every feature along the $x$-axis; a vertical shift adds the same amount to every output.",
    templateIds: ["shifted-polynomial-features"],
    objectives: [
      "Find the extreme point of a shifted quadratic from the original's vertex.",
      "Find the sum of $x$-intercepts of a shifted factored cubic and a value after a vertical shift.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Change the input or change the output",
        paragraphs: [
          "In $g(x)=f(x-2)$ the function $g$ takes the value of $f$ two units earlier, so every point of the graph of $f$ moves 2 units right. In $g(x)=f(x)+2$ every output is 2 greater, so the graph moves up 2. The sign inside the parentheses works backward.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "$f(x)=(x-1)(x+2)(x-4)$ and $g(x)=f(x-3)$. What is the sum of the $x$-intercepts of $g$?",
      steps: [
        "The $x$-intercepts of $f$ are 1, $-2$ and 4, because each makes one factor zero.",
        "$g(x)=0$ when $x-3$ is one of those, so each intercept of $g$ is 3 greater: 4, 1 and 7.",
        "The sum is $4+1+7=12$. Check: the sum for $f$ is 3, plus 3 intercepts times 3 gives 12.",
      ],
      answer: "$12$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Vertex of a shifted quadratic",
        paragraphs: [
          "For $f(x)=x^2-8x+19$ the vertex is at $x=-\\frac{-8}{2}=4$. For $g(x)=f(x+3)$ the graph moves 3 units left, so the minimum is at $x=4-3=1$.",
          "For a vertical shift evaluate first: if $f(0)=-6$ and $g(x)=f(x)+4$, then $g(0)=-2$.",
        ],
      },
      {
        stage: "formal",
        title: "Why the sign works backward",
        paragraphs: [
          "$g(x)=f(x-c)$ equals $f(u)$ at $x=u+c$. So the point $(u,f(u))$ of the graph of $f$ appears on the graph of $g$ at $(u+c,f(u))$, which is $c$ units to the right.",
        ],
      },
    ],
    pitfalls: [
      "The graph of $f(x+3)$ moves left, not right.",
      "Shifting a cubic by $c$ moves all three intercepts, so their sum moves by $3c$.",
    ],
    parentGuide:
      "Ask the learner to say in words whether $f(x+2)$ moves a graph left or right and why.",
  },
];
