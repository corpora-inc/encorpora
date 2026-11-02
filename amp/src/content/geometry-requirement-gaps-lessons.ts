import { trianglePair } from "../math/geometry-requirement-gaps-practice";
import { graph } from "../math/scene/author";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const complexFigure = graph({ x: [-5, 5], y: [-5, 5], tick: 1 })
  .id("plane")
  .point(3, 1, "z")
  .point(-1, 3, "iz", { color: "warm" })
  .point(3, -1, "conj z", { color: "gold" })
  .segment([0, 0], [3, 1])
  .segment([0, 0], [-1, 3], { color: "warm" })
  .segment([0, 0], [3, -1], { color: "gold" })
  .scene({ title: "z, its quarter turn iz, and its conjugate" });

export const geometryRequirementGapMethods: Record<string, ProblemMethod> = {
  "arc-sector-derivation": {
    goal: "Scale arc lengths between circles, measure an angle in radians (arc length divided by radius), and find a sector's area.",
    senses: {
      similar: "similar-figures",
      vertex: "vertex",
      degrees: "degree-angle",
      side: "side",
      radius: "radius",
      multiple: "multiple",
      center: "center",
      squared: "square-number",
    },
    noLink: [
      "factor",
      "whole",
      "unit",
      "units",
      "square",
      "scale",
      "scales",
      "rule",
      "part",
      "factors",
    ],
    intuition:
      "The middle point of a circle is called the center. A circle's radius is the distance from the center to the circle. A central angle has its corner at the center. The piece of the circle between its two sides is called an arc. Every circle is an enlarged or shrunken copy of every other circle. Enlarge a circle by a factor $k$, so every length is multiplied by $k$. Then the radius and the arc of a fixed angle are both multiplied by $k$. So for one angle, arc length divided by radius is the same in every circle. That number measures the angle in radians. A sector is the pie-slice region between the two radii and the arc.",
    terms: [
      "central-angle",
      [
        "radian",
        "A central angle of $\\theta$ radians cuts off an arc of length $\\theta r$.",
      ],
      "sector",
    ],
    method: [
      "To scale between two circles, divide each arc by its own radius and set the two results equal.",
      "For radian measure, divide arc length by radius: $\\theta=s/r$. Here $\\theta$ (theta) is the angle, $s$ the arc length and $r$ the radius. To find an arc, multiply: $s=\\theta r$.",
      "For a sector, take the fraction $\\theta/2\\pi$ of the disk's area $\\pi r^2$, because a full turn is $2\\pi$ radians. The $\\pi$ cancels, leaving $\\tfrac12\\theta r^2$.",
      "Keep units: arc length in length units and area in square units. Label an angle in radians, so it is not mistaken for degrees.",
    ],
    watch:
      "Arc length grows with the radius, but area grows with the radius squared, meaning $r$ times $r$. Use a fraction of $2\\pi$ when the angle is in radians and a fraction of 360 when it is in degrees. Do not mix them.",
  },
  "complex-plane-operations": {
    goal: "Read sums, differences, conjugates and products of complex numbers as moves of points in the complex plane.",
    intuition:
      "A complex number $a+bi$ is the point with $a$ across (the real part) and $b$ up (the imaginary part). Adding complex numbers adds the arrows from the origin, so the sum is the far corner of a parallelogram. Subtracting gives the arrow between the two points. The conjugate flips the sign of the imaginary part, which reflects the point in the horizontal axis. Multiplying by $i$ turns the point a quarter turn counterclockwise about the origin.",
    terms: [
      "modulus",
      "argument",
      ["complex-conjugate", "It is written $\\overline{z}$."],
    ],
    method: [
      "Read each number as a point: real part across, imaginary part up.",
      "For $z+w$, complete the parallelogram with sides along $z$ and $w$. For $z-w$, use the arrow that starts at $w$ and ends at $z$.",
      "For $\\overline{z}$, reflect in the real axis. For $iz$, turn a quarter turn counterclockwise: $(a,b)\\to(-b,a)$.",
      "For $w=r(\\cos\\theta+i\\sin\\theta)$, multiply the distance from the origin by $r$ and add $\\theta$ to the argument.",
    ],
    watch:
      "Multiplication by $i$ is a rotation, not a reflection, and the conjugate is a reflection, not a rotation. Moduli multiply and arguments add when you multiply; they do not both add.",
  },
  "conditional-everyday-reasoning": {
    goal: "Read “among those who …” rates as conditional probabilities, tell $P(A\\mid B)$ from $P(B\\mid A)$, and test independence.",
    senses: {
      event: "event",
      impossible: "impossible",
      intersection: "intersection",
    },
    noLink: [
      "rate",
      "rates",
      "change",
      "group",
      "groups",
      "whole",
      "certain",
      "product",
      "difference",
    ],
    intuition:
      "An event is a result that may or may not happen, such as a student riding the bus. A probability is a chance, a number from 0 to 1, and $P(A)$ means the probability that event $A$ happens. A conditional probability is the chance of $A$ when you look only at the cases where $B$ happened. It is written $P(A\\mid B)$ and read “the probability of $A$ given $B$”. The group you look inside goes after the bar. If 20 of 50 bus riders play in the band, then $P(\\text{band}\\mid\\text{bus})=\\frac{20}{50}$. Two events are independent when learning that $B$ happened does not change the chance of $A$.",
    terms: ["conditional-probability", "independent-events", "intersection"],
    method: [
      "Find the group the percentage is taken of. A phrase such as “among the bus riders” names the condition, and the condition goes after the bar.",
      "To compute from counts, divide the count with both events by the size of the condition group.",
      "To test independence, compare $P(A\\mid B)$ with $P(A)$. Or compare $P(A\\cap B)$, the chance that both happen, with $P(A)\\times P(B)$.",
      "If $P(A\\mid B)$ is bigger than $P(A)$, then $B$ makes $A$ more likely. If it is smaller, $B$ makes $A$ less likely.",
    ],
    watch:
      "$P(A\\mid B)$ and $P(B\\mid A)$ divide by different group sizes, so they are usually different. Independent events can happen together. The test is whether the rates match, not whether the events overlap.",
  },
  "congruence-by-rigid-motion": {
    goal: "Find the rigid motions (slides, turns and flips) that carry one triangle onto another, and decide whether the triangles are congruent.",
    senses: {
      side: "side",
      vertices: "vertex",
      image: "image-transformation",
      change: "change",
    },
    noLink: ["corresponding angles", "opposite", "scale"],
    intuition:
      "A rigid motion moves a figure without stretching it. A translation slides it in one direction. A rotation turns it around a fixed point. A reflection flips it across a line, like a mirror. Side lengths and angles (the amount of turn at each corner) stay the same. Two figures are congruent when some list of rigid motions carries one exactly onto the other.",
    terms: [
      "rigid-motion",
      [
        "corresponding",
        "If $A \\to D$, $B \\to E$ and $C \\to F$, then $AB$ corresponds to $DE$ and $\\angle C$ to $\\angle F$.",
      ],
      "orientation",
    ],
    method: [
      "Compare matching side lengths. If any pair differs, no rigid motion exists, and the triangles are not congruent.",
      "Compare orientation: whether $A\\to B\\to C$ runs clockwise or counterclockwise. If the other triangle runs the opposite way, the list must include a reflection, because only a flip reverses the direction.",
      "Follow one vertex (corner) through the motions in the order given. Then check that all three vertices land on their partners.",
      "State the conclusion: such a list exists, so the triangles are congruent. Their corresponding sides (the sides that land on each other) have equal lengths, and their corresponding angles have equal measures.",
    ],
    watch:
      "Where a triangle sits does not decide congruence, and a mirror image still counts, because a flip is allowed. Equal angles alone are not enough. The side lengths must match too.",
  },
  "conic-foci": {
    goal: "Find foci from an ellipse or hyperbola equation, and find the equation from the foci and a constant sum or difference.",
    intuition:
      "Two fixed points called foci define these curves. An ellipse is every point whose distances to the two foci add to a constant. A hyperbola is every point whose distances to the two foci differ by a constant. The foci lie on the axis that holds the vertices, at distance $c$ from the center.",
    terms: [
      ["focus", "An ellipse or a hyperbola has two foci."],
      [
        "focus",
        "For a conic centered at the origin, $a$ runs center to vertex, $c$ center to focus, and the other denominator is $b^2$.",
      ],
    ],
    method: [
      "Ellipse: the larger denominator is $a^2$. Compute $c^2=a^2-b^2$. The foci are $c$ from the center along the major axis.",
      "Hyperbola: the denominator of the positive term is $a^2$. Compute $c^2=a^2+b^2$. The foci are $c$ from the center along the axis of the positive term.",
      "From foci and a constant: the sum (ellipse) or difference (hyperbola) equals $2a$. Find $a$, then $b^2=a^2-c^2$ for an ellipse or $b^2=c^2-a^2$ for a hyperbola.",
      "Write $a^2$ under the variable along the axis through the foci.",
    ],
    watch:
      "For an ellipse $c<a$ and $c^2=a^2-b^2$. For a hyperbola $c>a$ and $c^2=a^2+b^2$. The constant sum or difference is $2a$, not $a$.",
  },
  "choose-the-plot": {
    goal: "Match a dot plot, histogram or box plot to the list of data it shows, and find the bar heights or five numbers a list makes.",
    senses: { interval: "interval" },
    noLink: [
      "whole",
      "line",
      "border",
      "range",
      "side",
      "sort",
      "sorting",
      "changes",
      "fourth",
      "boundary",
    ],
    intuition:
      "A data set is a list of numbers. A dot plot puts one dot above a number line for each value, so you can read every value back. A histogram groups the values into equal intervals, stretches of the number line such as 20 to 30. Each bar's height, how tall it is, shows only how many values fall in each interval. A box plot shows five numbers: the least value, the lower quartile, the median, the upper quartile and the greatest value. The median is the middle value of the ordered list. With an even count, the median is halfway between the two middle values. The quartiles are the middle values of its lower half and its upper half.",
    terms: [
      [
        "interval",
        "In a histogram, a value equal to an interval's left end is counted in that interval.",
      ],
      [
        "quartile",
        "With an odd number of values, the overall median is left out of both halves.",
      ],
    ],
    method: [
      "Dot plot: count the dots at each value. Compare with how many times each value appears in each list.",
      "Histogram: sort each list into the intervals. Compare the counts with the bars, one bar at a time.",
      "Box plot: put the list in order. Find the least value, the median, the middle of each half, and the greatest value, then compare these five numbers.",
      "To build a plot from data, work the other way, using the same counts or five numbers.",
    ],
    watch:
      "Put the data in order before finding a median or quartile. A histogram does not show single values, so two lists can share a histogram. A value on the border between two intervals goes in the interval that starts at it.",
  },
  "similarity-by-transformation": {
    goal: "Find the resizing (dilation) and moves that carry one triangle onto another, and decide whether the triangles are similar.",
    senses: {
      similar: "similar-figures",
      side: "side",
      vertex: "vertex",
      image: "image-transformation",
      center: "center",
    },
    noLink: [
      "factor",
      "factors",
      "unit",
      "units",
      "change",
      "mean",
      "square",
      "scale",
    ],
    intuition:
      "A dilation resizes a figure. It multiplies every distance from a fixed center point by the same positive number, the scale factor $k$. It keeps the shape and every angle. A rigid motion moves a figure without changing its size: a slide (translation), a turn (rotation) or a flip (reflection). Two figures are similar, meaning the same shape, when a dilation followed by rigid motions carries one exactly onto the other. The scale factor is then a ratio, the result of dividing two lengths: a side of the new figure divided by the matching side of the original. Matching sides, also called corresponding sides, are sides that land on each other.",
    terms: ["dilation", "similar-figures"],
    method: [
      "Compare one pair of matching sides to find the scale factor $k$. Check that every other pair gives the same $k$.",
      "Dilate about the origin, the point $(0,0)$, by multiplying both coordinates by $k$. Then find the rigid motion that lands one vertex (corner) on its partner.",
      "Check all three vertices. If the sides grow by different factors, no such list of moves exists, and the triangles are not similar.",
    ],
    watch:
      "It is simplest to dilate about the origin first and slide afterward. Sliding first needs a different slide, because the dilation then stretches the slide too. Two right triangles are similar only if both legs grow by the same factor.",
  },
  "aa-similarity": {
    goal: "Use given angles to decide whether two triangles are similar (the same shape), match their corners, and pair up the matching sides.",
    noLink: ["third"],
    senses: {
      side: "side",
      similar: "similar-figures",
      degrees: "degree-angle",
      image: "image-transformation",
      vertex: "vertex",
    },
    intuition:
      "A triangle is a flat shape with three straight sides and three corners. An angle is the amount of turn at a corner, measured in degrees (°); a full turn is 360°. A triangle's three angles always add to $180^\\circ$, so two angles fix the third. Similar triangles have the same shape: every length of one is multiplied by the same number to give the other. If two angles of one triangle equal two angles of another, all three match, and the triangles are similar. This is the AA (angle-angle) test. Corners (vertices) with equal angles correspond, meaning they match up.",
    terms: [
      "aa-similarity",
      [
        "corresponding",
        "In $\\triangle ABC \\sim \\triangle EFD$, $A$ matches $E$, $B$ matches $F$ and $C$ matches $D$.",
      ],
    ],
    method: [
      "Find the third angle of each triangle: $180^\\circ$ minus the two given angles.",
      "Pair the corners that have equal angles. If at least two pairs match, the triangles are similar by AA. One equal pair is not enough.",
      "Write the similarity statement, such as $\\triangle ABC\\sim\\triangle EFD$ ($\\triangle$ means triangle and $\\sim$ means is similar to), with matching corners in the same positions.",
      "Match each side by its two end corners; $AB$ stands for the length of the side from $A$ to $B$. Each side divided by its partner gives the same number, so write them as equal fractions: $\\frac{AB}{EF}=\\frac{BC}{FD}$.",
    ],
    watch:
      "Match corners by equal angles, not by alphabetical order. One shared angle does not make triangles similar. Two given angles are enough to find the third.",
  },
};

export const geometryRequirementGapPrinciples: Record<string, string> = {
  "arc-sector-derivation":
    "In a circle of radius $r$, a central angle of $\\theta$ radians cuts off an arc of length $s=\\theta r$. This holds because, for a fixed angle, arc length is proportional to the radius, and one radian is the angle whose arc equals the radius. The sector has area $\\tfrac{\\theta}{2\\pi}\\cdot\\pi r^2=\\tfrac12\\theta r^2$. For an angle of $d$ degrees, the area is $\\tfrac{d}{360}\\pi r^2$.",
  "complex-plane-operations":
    "Identify $a+bi$ with the point $(a,b)$. Then $z+w$ is vector addition, $z-w$ is the vector from $w$ to $z$, $\\overline{z}$ is the reflection in the real axis, and for $w=r(\\cos\\theta+i\\sin\\theta)$ multiplication by $w$ scales by $r$ and rotates counterclockwise by $\\theta$. In particular $i=\\cos90^\\circ+i\\sin90^\\circ$ rotates by $90^\\circ$.",
  "conditional-everyday-reasoning":
    "When $P(B)>0$, $P(A\\mid B)=P(A\\cap B)/P(B)$, where $A\\cap B$ means that both $A$ and $B$ happen. Events $A$ and $B$ are independent exactly when $P(A\\cap B)=P(A)P(B)$. When $P(B)>0$, this is the same as $P(A\\mid B)=P(A)$. In general $P(A\\mid B)\\ne P(B\\mid A)$, where $\\ne$ means is not equal to. When $P(A)>0$ and $P(B)>0$, they are related by $P(A\\mid B)P(B)=P(B\\mid A)P(A)$.",
  "congruence-by-rigid-motion":
    "Translations (slides), rotations (turns) and reflections (flips) keep every distance and angle measure. Two figures are congruent exactly when a sequence of these rigid motions maps one onto the other. Then corresponding sides (named by their end points, such as $AB$ and $DE$) have equal lengths, and corresponding angles have equal measures. A reflection reverses orientation, turning clockwise into counterclockwise; a translation or rotation keeps it.",
  "conic-foci":
    "For an ellipse with foci $(\\pm c,0)$ and $d_1+d_2=2a$, the equation is $\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1$ with $b^2=a^2-c^2$. For a hyperbola with foci $(\\pm c,0)$ and $|d_1-d_2|=2a$, it is $\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=1$ with $b^2=c^2-a^2$. With foci $(0,\\pm c)$, the roles of $x$ and $y$ swap.",
  "choose-the-plot":
    "A dot plot shows every value. A histogram shows the count in each interval; a value equal to an interval's left end belongs to that interval. A box plot shows the minimum (the least value), the first quartile, the median, the third quartile and the maximum (the greatest value). The quartiles are the medians of the lower and upper halves of the ordered data. When the count is odd, the overall median is left out of both halves.",
  "similarity-by-transformation":
    "A dilation about the origin with positive scale factor $k$ sends the point $(x,y)$ to $(kx,ky)$. It multiplies distances by $k$ and keeps angles. Figures are similar exactly when a dilation followed by rigid motions maps one onto the other. Corresponding sides are then all in the same ratio $k$.",
  "aa-similarity":
    "If $\\angle A=\\angle D$ and $\\angle B=\\angle E$ in triangles $ABC$ and $DEF$, then $\\angle C=\\angle F$ and $\\triangle ABC\\sim\\triangle DEF$. So $\\frac{AB}{DE}=\\frac{BC}{EF}=\\frac{CA}{FD}$. Proof: a dilation multiplies every length by the same number. Multiplying $ABC$ by $\\frac{DE}{AB}$ gives a copy, called the image, whose side matching $AB$ has length $DE$, with the same two angles at its ends. By ASA (two angles and the side between them match), the image is congruent to $DEF$ (same size and shape). So a rigid motion (a slide, turn or flip) carries it onto $DEF$.",
};

const triangleFigure = trianglePair(
  [
    [1, 1],
    [4, 2],
    [2, 5],
  ],
  [
    [6, -4],
    [3, -3],
    [5, 0],
  ],
  "Triangles ABC and DEF on a grid",
);
const similarFigure = trianglePair(
  [
    [1, 2],
    [3, 2],
    [1, 5],
  ],
  [
    [-3, 1],
    [1, 1],
    [-3, 7],
  ],
  "Triangles ABC and DEF on a grid",
);

export const geometryRequirementGapLessons: Lesson[] = [
  {
    id: "arc-sector-derivation",
    title: "Arc length, radians and sector area from proportion",
    summary:
      "An arc is a piece of a circle. Every circle has a middle point, called the center. Draw the same angle at the center of a small circle and of a big circle. The big circle is an enlarged copy, so its arc is longer by the same factor as its radius. So arc length divided by radius depends only on the angle. That number is the angle's measure in radians, and it leads to a formula for a pie-slice region's area, the space it covers.",
    templateIds: ["arc-sector-derivation"],
    senses: {
      similar: "similar-figures",
      vertex: "vertex",
      degrees: "degree-angle",
      side: "side",
      radius: "radius",
      multiple: "multiple",
      center: "center",
      squared: "square-number",
    },
    noLink: [
      "factor",
      "whole",
      "unit",
      "units",
      "square",
      "scale",
      "scales",
      "rule",
      "part",
      "factors",
    ],
    objectives: [
      "Use similar circles, enlarged copies of each other, to scale an arc length to a different radius.",
      "Measure an angle in radians, arc length divided by radius, and use that rule both ways.",
      "Find a sector's area, the area of a pie slice, as a fraction of the whole disk.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One angle, every circle",
        paragraphs: [
          "A circle is all the points at one distance from a center point. That distance is the radius, $r$. A central angle has its corner (vertex) at the center. The part of the circle between its two sides is called the arc it cuts off. A sector is the pie-slice region between the two radii and the arc.",
          "The disk is the whole flat region inside the circle. Its area is $\\pi r^2$. The diameter is the distance across the circle through the center, twice the radius. Here $\\pi$ (pi), about 3.14, is how many times the diameter fits around the circle, and $r^2$ means $r$ times $r$.",
          "Draw the same angle in a circle of radius 1 cm and in a circle of radius 3 cm. The big circle is the small one enlarged 3 times, so every length in it is 3 times as long. Its radius is 3 times as long, and so is its arc. If the small arc is 2 cm, the big arc is 6 cm.",
          "So arc length divided by radius is the same for that angle in every circle: $2 \\div 1 = 6 \\div 3 = 2$. This ratio, the result of dividing one length by the other, measures the angle in units called radians. One radian is the angle whose arc is exactly one radius long. We write $\\theta$ (the Greek letter theta) for the angle, $s$ for the arc length and $r$ for the radius.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A central angle cuts off an arc 4 cm long in a circle of radius 3 cm. (1) How long an arc does the same angle cut off in a circle of radius 9 cm? (2) What is the angle in radians? (3) What is the area of the sector in the circle of radius 3 cm?",
      steps: [
        "(1) The new radius is $9 \\div 3 = 3$ times as long, so the arc is 3 times as long too: $4\\times3=12$ cm. Check that arc divided by radius matches: $4/3=12/9$.",
        "(2) Radian measure is arc length divided by radius: $\\theta=4/3$ radians.",
        "(3) One full turn is $2\\pi$ radians, so the sector is the fraction $\\frac{4/3}{2\\pi}$ of the disk. The disk's area is $\\pi\\cdot3^2=9\\pi$ square centimeters. Multiply: $\\frac{4/3}{2\\pi}\\cdot9\\pi=\\frac{4}{6}\\cdot9=6$.",
        "Check with the shortcut $\\tfrac12\\theta r^2=\\tfrac12\\cdot\\tfrac43\\cdot9=6$ square centimeters.",
      ],
      answer: "(1) 12 cm; (2) $\\tfrac43$ radians; (3) 6 square centimeters",
    },
    closingSections: [
      {
        stage: "method",
        title: "Three formulas from one ratio",
        paragraphs: [
          "Because $\\theta=s/r$, multiplying both sides by $r$ gives the arc: $s=\\theta r$. A full turn's arc is the whole circumference, the distance around the circle, which is $2\\pi r$. So a full turn measures $2\\pi r \\div r = 2\\pi$ radians.",
          "A sector with angle $\\theta$ is the fraction $\\theta/2\\pi$ of a full turn. So its area is that fraction of the disk: $\\frac{\\theta}{2\\pi}\\cdot\\pi r^2=\\tfrac12\\theta r^2$. For an angle of $d$ degrees, the fraction is $d/360$, because a full turn is 360 degrees.",
        ],
      },
      {
        stage: "formal",
        title: "Why arc length is proportional to radius",
        paragraphs: [
          "A dilation is a resizing: about the center, by a factor $k$, it multiplies every distance from the center by $k$. It maps a circle of radius $r$ to a circle of radius $kr$. It maps an arc of length $s$ to an arc of length $ks$ with the same central angle, because a dilation keeps angles. So $s/r = ks/kr$ depends only on the angle. Radian measure is defined to be this ratio.",
        ],
      },
    ],
    pitfalls: [
      "Arc length grows with the radius. Area grows with the radius squared, meaning the radius times itself.",
      "Use $\\theta/2\\pi$ for radians and $d/360$ for degrees.",
      "Radian measure is arc divided by radius, not radius divided by arc.",
    ],
    parentGuide:
      "Ask the learner to draw two circles with the same angle at the center. Ask them to explain why the longer radius gives a longer arc, in the same ratio.",
  },
  {
    id: "complex-plane-operations",
    title: "Complex arithmetic in the plane",
    summary:
      "Sums are parallelograms, differences are arrows between points, the conjugate is a reflection, and multiplying by $i$ is a quarter turn.",
    templateIds: ["complex-plane-operations"],
    objectives: [
      "Locate $z+w$, $z-w$ and $\\overline{z}$ in the plane.",
      "Describe multiplication by $i$ and by $r(\\cos\\theta+i\\sin\\theta)$ as a rotation with a scaling.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Numbers as points and arrows",
        paragraphs: [
          "A complex number $a+bi$ has a real part $a$ and an imaginary part $b$. Plot it at the point with $a$ across and $b$ up. The arrow from the origin to that point has a length, the modulus, and a direction, the argument.",
          "Each operation becomes a move. Adding two numbers adds their arrows. Subtracting finds the arrow from one point to the other. The conjugate changes the sign of $b$. Multiplying by $i$ is the special case of multiplying that turns every arrow a quarter turn.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Let $z=3+i$ and $w=1+2i$. Find $z+w$, $z-w$, $\\overline{z}$ and $iz$, and describe each as a move of the point for $z$.",
      figure: { kind: "scene", scene: complexFigure },
      steps: [
        "$z+w=(3+1)+(1+2)i=4+3i$. It is the corner opposite the origin in the parallelogram with sides along $z$ and $w$.",
        "$z-w=(3-1)+(1-2)i=2-i$. It is the arrow that goes from the point $w$ to the point $z$.",
        "$\\overline{z}=3-i$. The real part stays and the imaginary part changes sign, so the point is reflected in the real axis.",
        "$iz=i(3+i)=3i+i^2=-1+3i$. The point $(3,1)$ moves to $(-1,3)$, a quarter turn counterclockwise about the origin. Both have modulus $\\sqrt{10}$.",
      ],
      answer: "$4+3i$; $2-i$; $3-i$; $-1+3i$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Scaling and turning",
        paragraphs: [
          "Write $w=r(\\cos\\theta+i\\sin\\theta)$, where $r$ is the modulus and $\\theta$ the argument. Multiplying $z$ by $w$ multiplies the modulus of $z$ by $r$ and adds $\\theta$ to its argument. Since $i=\\cos90^\\circ+i\\sin90^\\circ$, multiplying by $i$ adds $90^\\circ$ and keeps the modulus. Then $i^2$ adds $180^\\circ$, $i^3$ adds $270^\\circ$ and $i^4$ returns to the start.",
        ],
      },
      {
        stage: "formal",
        title: "Why arguments add",
        paragraphs: [
          "The angle-sum identities give $(\\cos\\alpha+i\\sin\\alpha)(\\cos\\beta+i\\sin\\beta)=\\cos(\\alpha+\\beta)+i\\sin(\\alpha+\\beta)$. So a product of numbers with moduli $r_1,r_2$ and arguments $\\alpha,\\beta$ has modulus $r_1r_2$ and argument $\\alpha+\\beta$. The conjugate has the same modulus and the opposite argument.",
        ],
      },
    ],
    pitfalls: [
      "Multiplying by $i$ turns counterclockwise; clockwise would be multiplying by $-i$.",
      "The conjugate reflects in the horizontal axis; it does not rotate.",
      "Under multiplication moduli multiply and arguments add.",
    ],
    parentGuide:
      "Ask the learner to plot $2+i$ and then $i(2+i)$ and say what turn took one point to the other.",
  },
  {
    id: "conditional-everyday-reasoning",
    title: "Conditional probability and independence in everyday situations",
    summary:
      "A rate like “40% of bus riders play in the band” looks only at one group, the bus riders. An event is a result that may or may not happen, such as a student riding the bus. The chance of an event inside a group is called a conditional probability. To find it, divide by the size of that group, not of everyone. Then compare it with the rate for everyone. If the two match, the events are called independent: knowing one tells you nothing about the other.",
    templateIds: ["conditional-everyday-reasoning"],
    senses: {
      event: "event",
      impossible: "impossible",
      intersection: "intersection",
    },
    noLink: [
      "rate",
      "rates",
      "change",
      "group",
      "groups",
      "whole",
      "certain",
      "product",
      "difference",
    ],
    objectives: [
      "Tell $P(A\\mid B)$, the chance of $A$ among the cases of $B$, from $P(B\\mid A)$ in a described situation.",
      "Decide whether two events are independent by comparing a rate inside a group with the overall rate.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Which group are you looking at?",
        paragraphs: [
          "A probability is a chance, written as a number from 0 to 1. Impossible means it cannot happen: an impossible event has probability 0, and a sure event has probability 1. An event is something that may or may not happen, such as a student playing in the band. $P(\\text{band})$ means the probability that a student chosen at random plays in the band.",
          "A rate such as “40% of students on the bus play in the band” looks only at the students on the bus. That is a conditional probability: the chance of one event within the group where another event happened. We write it with a vertical bar, read “given”: $P(\\text{band}\\mid\\text{bus})$. The group you look inside goes after the bar.",
          "Two events are independent when knowing about one does not change the chance of the other. Then the rate inside the group equals the rate for everyone.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Of 200 students, 80 play in the band, 50 take the bus, and 20 do both. Find $P(\\text{band}\\mid\\text{bus})$ and $P(\\text{bus}\\mid\\text{band})$, and decide whether the events are independent.",
      steps: [
        "Look inside the 50 bus riders. Of them, 20 play in the band, so $P(\\text{band}\\mid\\text{bus})=\\frac{20}{50}=\\frac25$.",
        "Now look inside the 80 band members. Of them, 20 take the bus, so $P(\\text{bus}\\mid\\text{band})=\\frac{20}{80}=\\frac14$. The two answers differ because the groups have different sizes.",
        "Find the overall rates. $P(\\text{band})=\\frac{80}{200}=\\frac25$, which equals $P(\\text{band}\\mid\\text{bus})$. In the other direction, $P(\\text{bus})=\\frac{50}{200}=\\frac14=P(\\text{bus}\\mid\\text{band})$.",
        "Knowing that a student rides the bus does not change the chance of playing in the band, so the events are independent. Check with a product: $\\frac25\\times\\frac14=\\frac1{10}$, and $P(\\text{both})=\\frac{20}{200}=\\frac1{10}$ too.",
      ],
      answer: "$\\tfrac25$ and $\\tfrac14$; independent",
    },
    closingSections: [
      {
        stage: "method",
        title: "Compare the rates",
        paragraphs: [
          "If the rate inside the group is higher than the overall rate, the condition makes the event more likely. If it is lower, the condition makes the event less likely. If they are equal, the events are independent. This comparison needs only the two rates, not the size of the group.",
        ],
      },
      {
        stage: "formal",
        title: "Definition and relation",
        paragraphs: [
          "The symbol $A\\cap B$ means the event that both $A$ and $B$ happen. When $P(B)>0$, $P(A\\mid B)=P(A\\cap B)/P(B)$. Events $A$ and $B$ are independent exactly when $P(A\\cap B)=P(A)P(B)$. When $P(B)>0$, that is the same as $P(A\\mid B)=P(A)$.",
          "When $P(A)>0$ and $P(B)>0$, both $P(A\\mid B)P(B)$ and $P(B\\mid A)P(A)$ equal $P(A\\cap B)$. So the two conditional probabilities are equal only when $P(A)=P(B)$ or when the events never happen together.",
        ],
      },
    ],
    pitfalls: [
      "$P(A\\mid B)$ divides by the size of group $B$. $P(B\\mid A)$ divides by the size of group $A$.",
      "Independent events can happen together. Two events that cannot happen together, each with a chance above 0, are not independent.",
      "Compare the rate inside the group with the overall rate for the same event.",
    ],
    parentGuide:
      "Ask the learner to read “of the people who carry umbrellas, 80% are wet”. Then ask which group is the condition, and what the 80% is a fraction of.",
  },
  {
    id: "congruence-by-rigid-motion",
    title: "Congruence by rigid motions",
    summary:
      "Two shapes are congruent when they are exactly the same size and shape: one could be laid exactly on top of the other. Sliding, turning or flipping a shape never changes its side lengths or its angles (the amount of turn at each corner). So two triangles are congruent when some list of slides, turns and flips carries one exactly onto the other.",
    templateIds: ["congruence-by-rigid-motion"],
    senses: {
      side: "side",
      vertices: "vertex",
      degrees: "degree-angle",
      image: "image-transformation",
    },
    noLink: [
      "change",
      "changes",
      "corresponding angles",
      "mean",
      "opposite",
      "parts",
      "third",
      "unit",
      "units",
    ],
    objectives: [
      "Choose a list of slides, turns and flips (rigid motions) that carries one triangle onto another.",
      "Follow a point through a list of motions, in order, to find where it lands.",
      "Decide whether two triangles are congruent, and match their corresponding parts (the parts that land on each other).",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Moving without stretching",
        paragraphs: [
          "Cut a triangle out of paper and move it around a table. You can slide it, turn it, or flip it over. In math these moves are called a translation (a slide in one direction), a rotation (a turn around a fixed point) and a reflection (a flip across a line, like a mirror image). Together they are called rigid motions, because the shape stays rigid: nothing stretches or bends.",
          "A triangle has three straight sides, and its corners are called vertices (one corner is a vertex). An angle is the amount of turn between two sides at a vertex, measured in degrees (°). A full turn is 360°, so a quarter-turn, like the corner of a page, is 90°. Because nothing stretches, a rigid motion keeps every side length and every angle exactly the same.",
          "Two figures are congruent when a rigid motion, or a list of them done one after another, moves one exactly onto the other. The parts that land on each other are called corresponding parts. We write $A\\to D$ to mean that point $A$ lands on point $D$, and we say the motions map $A$ to $D$. Suppose $A\\to D$, $B\\to E$ and $C\\to F$. Then side $AB$, the side from $A$ to $B$, lands on side $DE$. The angle at corner $C$, written $\\angle C$, lands on $\\angle F$.",
        ],
      },
      {
        stage: "intuition",
        title: "Which way around",
        paragraphs: [
          "Walk around a triangle from $A$ to $B$ to $C$. You go either clockwise (the way clock hands turn) or counterclockwise (the opposite way). This direction is called the triangle's orientation. Slides and turns keep the orientation. A flip reverses it, the way a right hand looks like a left hand in a mirror.",
          "Suppose the walk from $A$ to $B$ to $C$ runs counterclockwise, but the walk from $D$ to $E$ to $F$ runs clockwise. Then the list of moves must include a reflection. If both walks run the same way and the triangles are congruent, slides and turns are enough.",
          "Points on a grid are named by coordinates. The point $(1, 2)$ is 1 unit right of the origin, the point $(0, 0)$, and 2 units up. Negative numbers mean left or down.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Triangle $ABC$ has $A(1,1)$, $B(4,2)$, $C(2,5)$. Triangle $DEF$ has $D(6,-4)$, $E(3,-3)$, $F(5,0)$. Is there a sequence of rigid motions mapping $A\\to D$, $B\\to E$, $C\\to F$? Name one.",
      figure: triangleFigure,
      steps: [
        "Check orientation first. Walking from $A$ to $B$ to $C$ turns counterclockwise, but walking from $D$ to $E$ to $F$ turns clockwise. Only a reflection reverses the direction, so the list must include one.",
        "Reflect over the $y$-axis, the vertical line where $x = 0$. Like a mirror, it sends each point to the same distance on the other side. So $x$ changes sign and $y$ stays the same: $(x,y)\\to(-x,y)$. Then $A(1,1)\\to(-1,1)$.",
        "Now slide the reflected $A$ onto $D$. From $(-1,1)$ to $(6,-4)$, $x$ goes up by $6-(-1)=7$ and $y$ goes down by $1-(-4)=5$. So translate by $(x,y)\\to(x+7,y-5)$.",
        "Check all three vertices, because motions that work for two corners can still send the third to the wrong place: $A(1,1)\\to(-1,1)\\to(6,-4)=D$, $B(4,2)\\to(-4,2)\\to(3,-3)=E$ and $C(2,5)\\to(-2,5)\\to(5,0)=F$.",
        "The reflection followed by the translation carries $ABC$ exactly onto $DEF$, so the triangles are congruent.",
      ],
      answer:
        "Yes: reflect over the $y$-axis, then translate $(x,y)\\to(x+7,y-5)$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Order and the first test",
        paragraphs: [
          "Do the motions in the order given. Reflecting and then sliding usually lands a shape somewhere different from sliding and then reflecting.",
          "To test whether two triangles are congruent, first compare the lengths of matching sides. If any pair differs, no rigid motion can work, because rigid motions never change lengths. If all three pairs match, find a list of motions and check it on all three vertices. Checking two is not enough, because the third could land on the wrong side.",
        ],
      },
      {
        stage: "formal",
        title: "The definition",
        paragraphs: [
          "Two figures are congruent exactly when some sequence of rigid motions maps one onto the other. To map means to send every point to a matching point. Some points may stay put, such as points on a mirror line. Rigid motions keep every distance and every angle measure. So corresponding sides of congruent triangles have equal lengths, and corresponding angles have equal measures.",
          "There are shortcut tests for triangles. Matching all three side lengths is enough; this is called SSS (side-side-side). For example, any two triangles with sides 3, 4 and 5 cm are congruent. So is matching two sides and the angle between them (SAS), or two angles and the side between them (ASA). Each test guarantees that a sequence of rigid motions exists.",
        ],
      },
    ],
    pitfalls: [
      "A mirror image is still congruent, because a reflection is a rigid motion.",
      "Where the triangles sit does not matter. Different sizes do: a triangle and an enlarged copy of it are not congruent.",
      "Match parts by the arrows, such as $A\\to D$, not by alphabetical order.",
    ],
    parentGuide:
      "Ask the learner to trace a triangle on paper and cut it out. Then have them slide, turn or flip it onto a second drawn copy, saying each move out loud. Ask whether a flip was needed, and how they could tell.",
  },
  {
    id: "conic-foci",
    title: "Foci of ellipses and hyperbolas",
    summary:
      "An ellipse has a constant sum of distances to its foci and a hyperbola a constant difference. These give $c^2=a^2-b^2$ and $c^2=a^2+b^2$.",
    templateIds: ["conic-foci"],
    objectives: [
      "Find the foci of an ellipse or hyperbola from its equation.",
      "Write the equation from the foci and a constant sum or difference of distances.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two special points",
        paragraphs: [
          "Pin the ends of a string at two points, hold the string tight with a pencil and draw: you trace an ellipse. The pins are the foci. The string has fixed length, so the distances from the pencil to the two pins always add to the same number.",
          "A hyperbola uses the same two points, but the distances to them differ by a fixed amount instead. In both curves the foci lie on the axis through the vertices, the same distance $c$ on each side of the center.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "(1) Find the foci of $\\frac{x^2}{25}+\\frac{y^2}{9}=1$. (2) Find the equation of the ellipse with foci $(\\pm4,0)$ whose distances to the foci always add to $10$.",
      steps: [
        "(1) The larger denominator is $a^2=25$ and the smaller is $b^2=9$. For an ellipse $c^2=a^2-b^2=25-9=16$, so $c=4$. The larger denominator is under $x^2$, so the foci are $(\\pm4,0)$.",
        "(2) The constant sum is $2a=10$, so $a=5$ and $a^2=25$. The foci give $c=4$, so $b^2=a^2-c^2=25-16=9$.",
        "The foci are on the $x$-axis, so $a^2$ goes under $x^2$: $\\frac{x^2}{25}+\\frac{y^2}{9}=1$. This is the curve in part (1), a consistency check.",
      ],
      answer: "(1) $(\\pm4,0)$; (2) $\\frac{x^2}{25}+\\frac{y^2}{9}=1$",
    },
    closingSections: [
      {
        stage: "method",
        title: "The hyperbola version",
        paragraphs: [
          "For $\\frac{x^2}{9}-\\frac{y^2}{16}=1$ the positive term has $a^2=9$ and $b^2=16$. For a hyperbola $c^2=a^2+b^2=25$, so $c=5$ and the foci are $(\\pm5,0)$. In the other direction, foci $(\\pm5,0)$ and a constant difference $6=2a$ give $a=3$ and $b^2=c^2-a^2=25-9=16$.",
        ],
      },
      {
        stage: "formal",
        title: "Why the constant is 2a",
        paragraphs: [
          "Take the vertex $(a,0)$ of an ellipse with foci $(\\pm c,0)$. Its distances to the foci are $a-c$ and $a+c$, which add to $2a$, so the constant sum is $2a$. For a point $P(x,y)$, $\\sqrt{(x+c)^2+y^2}+\\sqrt{(x-c)^2+y^2}=2a$. Isolating one root, squaring twice and simplifying gives $(a^2-c^2)x^2+a^2y^2=a^2(a^2-c^2)$. With $b^2=a^2-c^2$ this is $\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1$. For a hyperbola the same steps with a difference give $b^2=c^2-a^2$ and $\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=1$.",
        ],
      },
    ],
    pitfalls: [
      "The foci are on the major axis of an ellipse, the axis with the larger denominator.",
      "The constant sum or difference is $2a$, so halve it to get $a$.",
      "Subtract for an ellipse and add for a hyperbola.",
    ],
    parentGuide:
      "Ask the learner to pin a loop of string to a board with two pins, trace an ellipse, and measure the two distances at several points.",
  },
  {
    id: "choose-the-plot",
    title: "Match raw data to its dot plot, histogram or box plot",
    summary:
      "The same list of numbers can be drawn three ways. A dot plot shows every value. A histogram shows how many values fall in each stretch of the number line. A box plot shows just five numbers that mark the middle and the spread. To match a list to a plot, work out what the plot would show for that list and compare.",
    templateIds: ["choose-the-plot"],
    senses: { interval: "interval" },
    noLink: [
      "whole",
      "line",
      "border",
      "range",
      "side",
      "sort",
      "sorting",
      "changes",
      "fourth",
      "boundary",
    ],
    objectives: [
      "Choose the data list that a dot plot, histogram or box plot shows.",
      "Find the bar heights of a histogram and the five numbers of a box plot from a list.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Three views of the same numbers",
        paragraphs: [
          "A data set is a list of numbers, such as test scores. A dot plot puts one dot above a number line for each value. Repeated values make stacks of dots, so you can read every value back.",
          "A histogram splits the number line into equal intervals, stretches such as 20 to 25 and 25 to 30. Each interval gets a bar, and the bar's height is the count of values in that interval. A value on a border, like 25, goes in the interval that starts there.",
          "A box plot shows only five numbers. First put the list in order. The median is the middle value. With an even count there are two middle values, and the median is halfway between them. The lower quartile is the middle of the lower half, and the upper quartile is the middle of the upper half. Together with the least and greatest values, these make five numbers. The box runs from one quartile to the other, with a line at the median. Lines called whiskers reach out to the least and greatest values.",
          "To match a plot to a list, work out what the plot would show for that list. Then compare it with the picture.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "These scores were recorded in this order: 45, 20, 30, 25, 50, 40, 25. Find the five numbers a box plot of them shows.",
      figure: {
        kind: "box-plot",
        start: 20,
        end: 60,
        step: 5,
        summary: [20, 25, 30, 45, 50],
        unit: "points",
      },
      steps: [
        "Put the values in order, so the middle is easy to find: 20, 25, 25, 30, 40, 45, 50. The least is 20 and the greatest is 50.",
        "There are seven values, so the median is the fourth, with three values on each side: 30.",
        "Leave the median out and split the rest. The lower half is 20, 25, 25, with middle value 25. The upper half is 40, 45, 50, with middle value 45. These are the quartiles.",
        "The five numbers are 20, 25, 30, 45 and 50. The box runs from 25 to 45 with a line at 30, and the whiskers reach 20 and 50.",
      ],
      answer: "20, 25, 30, 45, 50",
    },
    closingSections: [
      {
        stage: "method",
        title: "Check a list against each plot",
        paragraphs: [
          "Dot plot: count the dots at each value. The list must have each value that many times.",
          "Histogram: sort the list into the intervals, putting a border value in the interval that starts there. Compare the counts with the bar heights.",
          "Box plot: put the list in order and find its five numbers. If a list changes any one of them, it does not match.",
        ],
      },
      {
        stage: "formal",
        title: "What each plot keeps",
        paragraphs: [
          "A dot plot pins down the data exactly. A histogram keeps only the count in each interval. A box plot keeps only the five-number summary. Those are the minimum (the least value), the lower quartile, the median, the upper quartile and the maximum (the greatest value). So different lists can give the same histogram or the same box plot. That is why you check a list against the numbers the plot actually shows.",
        ],
      },
    ],
    pitfalls: [
      "Put the data in order before finding a median or quartile.",
      "Count a value on an interval's left end in the interval that starts there.",
      "When the count is odd, leave the median out of both halves before finding the quartiles.",
    ],
    parentGuide:
      "Ask the learner to make a dot plot of ten numbers. Then group them in intervals of 5 to see what the histogram hides.",
  },
  {
    id: "similarity-by-transformation",
    title: "Similarity by dilation and rigid motion",
    summary:
      "Two triangles are called similar when they have the same shape, maybe at different sizes. You can show this with moves. First resize one triangle, multiplying every length by the same number. Then slide, turn or flip it exactly onto the other. That number is called the scale factor: a side of the new triangle divided by the matching side of the old one.",
    templateIds: ["similarity-by-transformation"],
    senses: {
      similar: "similar-figures",
      side: "side",
      vertex: "vertex",
      image: "image-transformation",
      center: "center",
    },
    noLink: [
      "factor",
      "factors",
      "unit",
      "units",
      "change",
      "mean",
      "square",
      "scale",
    ],
    objectives: [
      "Find the scale factor between two triangles on a grid.",
      "Choose a dilation (resizing) and rigid motions (slides, turns and flips) that carry one triangle onto the other.",
      "Decide that triangles are not similar when their sides grow by different factors.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Same shape, different size",
        paragraphs: [
          "Points on a grid are named by coordinates. The point $(1, 2)$ is 1 unit right of the origin, the point $(0, 0)$, and 2 units up. Negative numbers mean left or down.",
          "A dilation resizes a figure from a fixed point, called the center. It multiplies every distance from the center by the same number, called the scale factor $k$. If $k$ is bigger than 1, the figure grows. If $k$ is between 0 and 1, it shrinks. Every angle stays the same, so the shape stays the same. A dilation about the origin multiplies both coordinates by $k$: with $k = 2$, the point $(1, 2)$ goes to $(2, 4)$.",
          "A rigid motion moves a figure without changing its size: a translation slides it, a rotation turns it, and a reflection flips it. Two figures are similar when a dilation followed by rigid motions turns one into the other. Then every side divided by its matching side gives the same number, $k$. Matching sides, also called corresponding sides, are sides that land on each other. If two pairs of matching sides grow by different factors, no dilation can fix that, and the figures are not similar.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Triangle $ABC$ has $A(1,2)$, $B(3,2)$, $C(1,5)$. Triangle $DEF$ has $D(-3,1)$, $E(1,1)$, $F(-3,7)$. Find the dilation about the origin and the translation that map $A\\to D$, $B\\to E$, $C\\to F$.",
      figure: similarFigure,
      steps: [
        "Compare matching sides. $AB$ runs from $x = 1$ to $x = 3$, so $AB = 2$, and $DE$ runs from $x = -3$ to $x = 1$, so $DE = 4$. Likewise $AC = 5 - 2 = 3$ and $DF = 7 - 1 = 6$.",
        "Both pairs grow by 2. Each triangle also has a square corner at $A$ or $D$, where a flat side meets an upright one. So the triangles are similar with scale factor $k = 2$.",
        "Dilate by 2 about the origin, multiplying each coordinate by 2: $A(1,2)\\to(2,4)$, $B(3,2)\\to(6,4)$, $C(1,5)\\to(2,10)$.",
        "Slide the new $A$ onto $D$. From $(2,4)$ to $(-3,1)$, $x$ goes down by 5 and $y$ goes down by 3. So translate by $(x,y)\\to(x-5,y-3)$.",
        "Check the other two vertices: $(6,4)\\to(1,1)=E$ and $(2,10)\\to(-3,7)=F$. All three corners land on their partners.",
      ],
      answer:
        "Dilate by a factor of 2 about the origin, then translate $(x,y)\\to(x-5,y-3)$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Order matters",
        paragraphs: [
          "A dilation about the origin multiplies the coordinates, so the simplest order is to dilate first and slide afterward. If you slide first, the dilation also stretches that slide by the scale factor. The same slide then lands the triangle somewhere else, so you would need a different slide. If the image (the moved copy) is flipped or turned, put that motion between the dilation and the slide. Then check every vertex.",
        ],
      },
      {
        stage: "formal",
        title: "The definition",
        paragraphs: [
          "Two figures are similar exactly when some sequence of dilations and rigid motions maps one onto the other. A dilation with a positive scale factor $k$ multiplies all lengths by $k$ and keeps angles. Rigid motions keep both lengths and angles. So similar figures have equal matching angles, and every side divided by its matching side gives $k$.",
        ],
      },
    ],
    pitfalls: [
      "When the dilation is about the origin, dilate first, then slide. A slide done first gets stretched by the dilation.",
      "Right triangles are similar only if both legs grow by the same factor.",
      "A scale factor between 0 and 1, such as one half, means the figure shrinks.",
    ],
    parentGuide:
      "Ask the learner to compare two prints of the same photo at different sizes. Which number relates matching lengths, and is it the same everywhere on the photo?",
  },
  {
    id: "aa-similarity",
    title: "Angle-angle similarity and correspondence",
    summary:
      "A triangle is a flat shape with three straight sides. Two triangles are similar when they have the same shape, though maybe not the same size: one is an enlarged or shrunken copy of the other. An angle is the amount of turn at a corner, measured in degrees (°). The three angles of any triangle add to 180°. So if two angles of one triangle match two angles of another, the third angles match too, and the triangles are similar.",
    templateIds: ["aa-similarity"],
    senses: {
      degrees: "degree-angle",
      side: "side",
      similar: "similar-figures",
      image: "image-transformation",
      vertices: "vertex",
    },
    noLink: ["third"],
    objectives: [
      "Decide from two given angles whether two triangles are similar.",
      "Match the corners that have equal angles, and write the matching sides as equal fractions.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two angles are enough",
        paragraphs: [
          "A triangle has three straight sides and three corners, called vertices. An angle is the amount of turn between two sides at a corner. It is measured in degrees, written °, and a full turn is 360°. We write $\\angle A$ for the angle at corner $A$.",
          "The three angles of every triangle add to $180^\\circ$. So if you know two of them, subtract them from $180^\\circ$ to find the third. A triangle with angles $50^\\circ$ and $60^\\circ$ has third angle $180^\\circ - 50^\\circ - 60^\\circ = 70^\\circ$.",
          "Two triangles are similar when one is a scaled copy of the other: the same shape, with every length multiplied by the same number. A photo and its enlargement are similar. Similar triangles have equal angles. For triangles the reverse is true too: equal angles force the same shape.",
          "Now suppose two angles of one triangle equal two angles of another. Each third angle is $180^\\circ$ minus the same two numbers, so the third angles are equal too. All three angles match, so the triangles are similar. This test is called AA, short for angle-angle.",
        ],
      },
      {
        stage: "intuition",
        title: "Matching corners and sides",
        paragraphs: [
          "Corners with equal angles correspond, meaning they match up. We write $\\triangle ABC\\sim\\triangle EFD$, read triangle $ABC$ is similar to triangle $EFD$. The symbol $\\triangle$ means triangle, and $\\sim$ means is similar to. The order of the letters shows the matching: $A$ with $E$, $B$ with $F$, and $C$ with $D$. This matching of corners is called the correspondence.",
          "Sides correspond too. Side $AB$ joins $A$ and $B$, which match $E$ and $F$, so $AB$ corresponds to side $EF$. In similar triangles every side is multiplied by the same number, called the scale factor. So each side divided by its partner gives the same answer. Writing $AB$ for the length of side $AB$, $\\frac{AB}{EF}=\\frac{BC}{FD}=\\frac{CA}{DE}$. An equation saying that fractions are equal, like this one, is called a proportion.",
          "For example, suppose $AB = 4$, $BC = 6$ and $EF = 8$. Every length in $EFD$ is twice its partner in $ABC$, because $8 \\div 4 = 2$. So $FD = 6 \\times 2 = 12$. Each fraction is then the same: $\\frac{AB}{EF} = \\frac{4}{8} = \\frac{1}{2}$ and $\\frac{BC}{FD} = \\frac{6}{12} = \\frac{1}{2}$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Triangle $ABC$ has $\\angle A=50^\\circ$ and $\\angle B=60^\\circ$. Triangle $DEF$ has $\\angle D=70^\\circ$ and $\\angle E=50^\\circ$. Are they similar by AA? If so, name the correspondence and write a proportion of sides.",
      steps: [
        "Each triangle has two known angles. Subtract them from $180^\\circ$ to find the third, because a triangle's angles add to $180^\\circ$: $\\angle C=180^\\circ-50^\\circ-60^\\circ=70^\\circ$ and $\\angle F=180^\\circ-70^\\circ-50^\\circ=60^\\circ$.",
        "Triangle $ABC$ has angles $50^\\circ$, $60^\\circ$ and $70^\\circ$. Triangle $DEF$ has $70^\\circ$, $50^\\circ$ and $60^\\circ$. These are the same three angles, so at least two pairs match, and the triangles are similar by AA.",
        "Match the corners with equal angles: $A$ ($50^\\circ$) with $E$, $B$ ($60^\\circ$) with $F$, and $C$ ($70^\\circ$) with $D$. Write the letters in that matching order: $\\triangle ABC\\sim\\triangle EFD$.",
        "Match the sides by their end corners. $AB$ joins $A$ and $B$, which match $E$ and $F$, so $AB$ goes with $EF$. Likewise $BC$ goes with $FD$, and $CA$ goes with $DE$. Each side of $ABC$ divided by its partner in $EFD$ gives the same number: $\\frac{AB}{EF}=\\frac{BC}{FD}=\\frac{CA}{DE}$.",
      ],
      answer:
        "Similar; $\\triangle ABC\\sim\\triangle EFD$; $\\frac{AB}{EF}=\\frac{BC}{FD}$",
    },
    closingSections: [
      {
        stage: "method",
        title: "When AA fails",
        paragraphs: [
          "If two triangles share only one equal angle, they need not be similar. For example, angles $50^\\circ$, $60^\\circ$, $70^\\circ$ and angles $50^\\circ$, $65^\\circ$, $65^\\circ$ share only the $50^\\circ$. Their shapes differ, so the triangles are not similar. Find all three angles of both triangles before you decide.",
        ],
      },
      {
        stage: "formal",
        title: "Why AA works",
        paragraphs: [
          "A dilation is a resizing: it multiplies every length by the same number, the scale factor, and keeps every angle. The resized copy is called the image. Two triangles are congruent when a rigid motion (a slide, turn or flip) moves one exactly onto the other. The ASA test says that two triangles with two equal angles and an equal side between them are congruent.",
          "Suppose $\\angle A=\\angle D$ and $\\angle B=\\angle E$. Resize triangle $ABC$ by the scale factor $\\frac{DE}{AB}$, chosen so that side $AB$ grows or shrinks to exactly the length $DE$: $AB \\times \\frac{DE}{AB} = DE$. The image still has the angles of $A$ and $B$ at the ends of that side. So it has two angles, and the side between them, equal to those of $DEF$. By ASA the image is congruent to $DEF$, and a rigid motion moves it onto $DEF$.",
          "So a dilation followed by a rigid motion maps $ABC$ onto $DEF$: it moves $ABC$ to fit exactly on top of $DEF$. That is exactly what it means for the triangles to be similar.",
        ],
      },
    ],
    pitfalls: [
      "Match corners by equal angles, not by the order of the letters.",
      "One pair of equal angles is not enough.",
      "Two given angles are enough to find the third, so nothing is missing.",
    ],
    parentGuide:
      "Ask the learner to draw two triangles of different sizes, each with angles of $40^\\circ$ and $60^\\circ$. Measure the third angles and compare the shapes. Then ask why the third angles had to match.",
  },
];
