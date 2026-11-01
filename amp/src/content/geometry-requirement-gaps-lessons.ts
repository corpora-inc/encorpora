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
      "multiple",
    ],
    intuition:
      "A circle's radius is the distance from its center to the circle. A central angle has its corner at the center. The piece of the circle between its two sides is called an arc. Every circle is an enlarged or shrunken copy of every other circle. Enlarge a circle by a factor $k$, so every length is multiplied by $k$. Then the radius and the arc of a fixed angle are both multiplied by $k$. So for one angle, arc length divided by radius is the same in every circle. That number measures the angle in radians. A sector is the pie-slice region between the two radii and the arc.",
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
      "Arc length grows with the radius, but area grows with the radius squared ($r$ times $r$). Use a fraction of $2\\pi$ when the angle is in radians and a fraction of 360 when it is in degrees. Do not mix them.",
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
      "A probability is a chance, a number from 0 to 1, and $P(A)$ means the probability that event $A$ happens. A conditional probability is the chance of $A$ when you look only at the cases where $B$ happened. It is written $P(A\\mid B)$ and read “the probability of $A$ given $B$”. The group you look inside goes after the bar. If 20 of 50 bus riders play in the band, then $P(\\text{band}\\mid\\text{bus})=\\frac{20}{50}$. Two events are independent when learning that $B$ happened does not change the chance of $A$.",
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
    goal: "Choose or predict the rigid motions that carry one triangle onto another, and decide congruence by whether such a sequence exists.",
    intuition:
      "A rigid motion moves a figure without stretching it: a translation slides, a rotation turns, a reflection flips. Lengths and angles stay the same. Two figures are congruent when some sequence of rigid motions carries one exactly onto the other.",
    terms: [
      "rigid-motion",
      [
        "corresponding",
        "If $A \\to D$, $B \\to E$ and $C \\to F$, then $AB$ corresponds to $DE$ and $\\angle C$ to $\\angle F$.",
      ],
      "orientation",
    ],
    method: [
      "Compare sides: if matching lengths differ, no rigid motion exists and the triangles are not congruent.",
      "Compare orientation. If it is reversed, the sequence includes a reflection.",
      "Track one vertex through the motions in the stated order and check a second vertex.",
      "State the conclusion: the sequence exists, so the triangles are congruent, and corresponding parts are equal.",
    ],
    watch:
      "Position does not decide congruence, and neither does a mirror image: translations, rotations and reflections are all allowed. Equal angles alone do not make congruent triangles; the sizes must match too.",
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
      "A data set is a list of numbers. A dot plot puts one dot above a number line for each value, so you can read every value back. A histogram groups the values into equal intervals, stretches of the number line such as 20 to 30. Its bar heights show only how many values fall in each interval. A box plot shows five numbers: the least value, the lower quartile, the median, the upper quartile and the greatest value. The median is the middle value of the ordered list. The quartiles are the middle values of its lower half and its upper half.",
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
      "multiple",
      "scale",
    ],
    intuition:
      "A dilation resizes a figure. It multiplies every distance from a fixed center point by the same positive number, the scale factor $k$. It keeps the shape and every angle. A rigid motion moves a figure without changing its size: a slide (translation), a turn (rotation) or a flip (reflection). Two figures are similar, meaning the same shape, when a dilation followed by rigid motions carries one exactly onto the other. The scale factor is then the ratio of matching side lengths: a side of the new figure divided by the matching side of the original.",
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
    goal: "Decide whether two triangles are similar by AA from stated angles, name the correspondence, and write the matching proportion of sides.",
    intuition:
      "The angles of every triangle add to $180^\\circ$, so two angles fix the third. If two angles of one triangle equal two angles of another, all three match and the triangles have the same shape. They are similar, and the vertices with equal angles correspond.",
    terms: [
      "aa-similarity",
      [
        "corresponding",
        "In $\\triangle ABC \\sim \\triangle EFD$, $A$ matches $E$, $B$ matches $F$ and $C$ matches $D$.",
      ],
    ],
    method: [
      "Find the third angle of each triangle: $180^\\circ$ minus the two stated angles.",
      "Pair the vertices that have equal angles. If at least two pairs match, the triangles are similar by AA; one equal pair is not enough.",
      "Write the similarity statement with matching vertices in the same position.",
      "Write corresponding sides as a proportion by following the vertex matches.",
    ],
    watch:
      "Name the correspondence by equal angles, not by alphabetical order. One shared angle does not make triangles similar, and two stated angles are enough to find the third.",
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
    "Translations, rotations and reflections preserve distance and angle measure. Figures are congruent exactly when a sequence of rigid motions maps one onto the other, so corresponding sides and angles are equal. A reflection reverses orientation; a translation or rotation preserves it.",
  "conic-foci":
    "For an ellipse with foci $(\\pm c,0)$ and $d_1+d_2=2a$, the equation is $\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1$ with $b^2=a^2-c^2$. For a hyperbola with foci $(\\pm c,0)$ and $|d_1-d_2|=2a$, it is $\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=1$ with $b^2=c^2-a^2$. With foci $(0,\\pm c)$, the roles of $x$ and $y$ swap.",
  "choose-the-plot":
    "A dot plot shows every value. A histogram shows the count in each interval; a value equal to an interval's left end belongs to that interval. A box plot shows the minimum (least value), the first quartile, the median, the third quartile and the maximum (greatest value). The quartiles are the medians of the lower and upper halves of the ordered data. When the count is odd, the overall median is left out of both halves.",
  "similarity-by-transformation":
    "A dilation about the origin with positive scale factor $k$ sends the point $(x,y)$ to $(kx,ky)$. It multiplies distances by $k$ and keeps angles. Figures are similar exactly when a dilation followed by rigid motions maps one onto the other. Corresponding sides are then all in the same ratio $k$.",
  "aa-similarity":
    "If $\\angle A=\\angle D$ and $\\angle B=\\angle E$ in triangles $ABC$ and $DEF$, then $\\angle C=\\angle F$ and $\\triangle ABC\\sim\\triangle DEF$, so $\\frac{AB}{DE}=\\frac{BC}{EF}=\\frac{CA}{FD}$. Dilate $ABC$ by $DE/AB$ to make $AB=DE$; the image has the same two angles on $DE$, so it is congruent to $DEF$ by ASA, and a rigid motion finishes the map.",
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
      "An arc is a piece of a circle. Draw the same angle at the center of a small circle and of a big circle. The big circle is an enlarged copy, so its arc is longer by the same factor as its radius. So arc length divided by radius depends only on the angle. That number is the angle's measure in radians, and it leads to a formula for the area of a pie-slice region.",
    templateIds: ["arc-sector-derivation"],
    senses: {
      similar: "similar-figures",
      vertex: "vertex",
      degrees: "degree-angle",
      side: "side",
      radius: "radius",
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
      "multiple",
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
          "The disk is the whole flat region inside the circle. Its area is $\\pi r^2$. Here $\\pi$ (pi), about 3.14, is how many times the diameter fits around the circle, and $r^2$ means $r$ times $r$.",
          "Draw the same angle in a circle of radius 1 cm and in a circle of radius 3 cm. The big circle is the small one enlarged 3 times, so every length in it is 3 times as long. Its radius is 3 times as long, and so is its arc. If the small arc is 2 cm, the big arc is 6 cm.",
          "So arc length divided by radius is the same for that angle in every circle: $2 \\div 1 = 6 \\div 3 = 2$. This ratio measures the angle, in units called radians. One radian is the angle whose arc is exactly one radius long. We write $\\theta$ (the Greek letter theta) for the angle, $s$ for the arc length and $r$ for the radius.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A central angle cuts off an arc 4 cm long in a circle of radius 3 cm. (1) How long an arc does the same angle cut off in a circle of radius 9 cm? (2) What is the angle in radians? (3) What is the area of the sector in the circle of radius 3 cm?",
      steps: [
        "(1) The new radius is $9 \\div 3 = 3$ times as long, so the arc is 3 times as long too: $4\\times3=12$ cm. Check that arc divided by radius matches: $4/3=12/9$.",
        "(2) Radian measure is arc length divided by radius: $\\theta=4/3$ radians.",
        "(3) A full turn is $2\\pi$ radians, so the sector is the fraction $\\frac{4/3}{2\\pi}$ of the disk. The disk's area is $\\pi\\cdot3^2=9\\pi$ square centimeters. Multiply: $\\frac{4/3}{2\\pi}\\cdot9\\pi=\\frac{4}{6}\\cdot9=6$.",
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
          "A dilation by a factor $k$ about the center multiplies every distance from the center by $k$. It maps a circle of radius $r$ to a circle of radius $kr$. It maps an arc of length $s$ to an arc of length $ks$ with the same central angle, because a dilation keeps angles. So $s/r = ks/kr$ depends only on the angle. Radian measure is defined to be this ratio.",
        ],
      },
    ],
    pitfalls: [
      "Arc length grows with the radius. Area grows with the radius squared.",
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
      "A rate like “40% of bus riders play in the band” looks only at one group, the bus riders. The chance of an event inside a group is called a conditional probability. To find it, divide by the size of that group, not of everyone. Then compare it with the rate for everyone. If the two match, the events are called independent: knowing one tells you nothing about the other.",
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
          "A probability is a chance, written as a number from 0 (impossible) to 1 (sure to happen). An event is something that may or may not happen, such as a student playing in the band. $P(\\text{band})$ means the probability that a student chosen at random plays in the band.",
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
      "Translations, rotations and reflections keep lengths and angles. Triangles are congruent exactly when some sequence of them maps one onto the other.",
    templateIds: ["congruence-by-rigid-motion"],
    objectives: [
      "Choose a sequence of rigid motions that maps one triangle onto another.",
      "Predict the image of a point under a sequence in order.",
      "Decide congruence and match corresponding parts.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Moving without stretching",
        paragraphs: [
          "A rigid motion moves a figure the way you move a cut-out: slide it (translation), turn it (rotation) or flip it over (reflection). Nothing is stretched, so every length and angle stays the same.",
          "Two figures are congruent when you can move one exactly onto the other. When $A$ goes to $D$, $B$ to $E$ and $C$ to $F$, side $AB$ lands on $DE$ and $\\angle C$ lands on $\\angle F$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Triangle $ABC$ has $A(1,1)$, $B(4,2)$, $C(2,5)$. Triangle $DEF$ has $D(6,-4)$, $E(3,-3)$, $F(5,0)$. Is there a sequence of rigid motions mapping $A\\to D$, $B\\to E$, $C\\to F$? Name one.",
      figure: triangleFigure,
      steps: [
        "Going $A\\to B\\to C$ turns counterclockwise, while $D\\to E\\to F$ turns clockwise. The order is reversed, so the sequence must include a reflection.",
        "Reflect over the $y$-axis: $(x,y)\\to(-x,y)$. Then $A(1,1)\\to(-1,1)$. To reach $D(6,-4)$, translate by $(x,y)\\to(x+7,y-5)$.",
        "Check the other vertices: $B(4,2)\\to(-4,2)\\to(3,-3)=E$ and $C(2,5)\\to(-2,5)\\to(5,0)=F$.",
        "A sequence of rigid motions maps $ABC$ onto $DEF$, so the triangles are congruent.",
      ],
      answer:
        "Yes: reflect over the $y$-axis, then translate $(x,y)\\to(x+7,y-5)$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Order and the first test",
        paragraphs: [
          "Apply the motions in the order stated: reflecting and then translating is usually not the same as translating and then reflecting. To test congruence, first compare matching side lengths. If they differ, no rigid motion exists. If they agree, find a sequence and confirm it with every vertex.",
        ],
      },
      {
        stage: "formal",
        title: "The definition",
        paragraphs: [
          "Two figures are congruent if and only if a sequence of rigid motions maps one onto the other. Because rigid motions preserve distance and angle measure, corresponding sides and angles of congruent triangles are equal. The criteria SSS, SAS and ASA guarantee that such a sequence exists.",
        ],
      },
    ],
    pitfalls: [
      "A mirror image is still congruent; a reflection is a rigid motion.",
      "Different positions do not matter; different sizes do.",
      "Match parts by the vertex arrows, not by alphabetical order.",
    ],
    parentGuide:
      "Ask the learner to trace a triangle on paper, cut it out, and slide, turn or flip it onto a second copy.",
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
          "A box plot shows only five numbers. First put the list in order. The median is the middle value. The lower quartile is the middle of the lower half, and the upper quartile is the middle of the upper half. Together with the least and greatest values, these make five numbers. The box runs from one quartile to the other, with a line at the median. Lines called whiskers reach out to the least and greatest values.",
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
          "A dot plot pins down the data exactly. A histogram keeps only the count in each interval. A box plot keeps only the five-number summary: the minimum, lower quartile, median, upper quartile and maximum. So different lists can give the same histogram or the same box plot. That is why you check a list against the numbers the plot actually shows.",
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
      "Two triangles are similar when they have the same shape, maybe at different sizes. You can show this with moves. First resize one triangle, multiplying every length by the same number. Then slide, turn or flip it exactly onto the other. That number is called the scale factor: a side of the new triangle divided by the matching side of the old one.",
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
      "multiple",
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
          "A dilation resizes a figure from a center point. It multiplies every distance from the center by the same number, called the scale factor $k$. If $k$ is bigger than 1, the figure grows. If $k$ is between 0 and 1, it shrinks. Every angle stays the same, so the shape stays the same. A dilation about the origin multiplies both coordinates by $k$: with $k = 2$, the point $(1, 2)$ goes to $(2, 4)$.",
          "A rigid motion moves a figure without changing its size: a translation slides it, a rotation turns it, and a reflection flips it. Two figures are similar when a dilation followed by rigid motions turns one into the other. Then all matching sides are in the same ratio $k$. If two pairs of matching sides grow by different factors, no dilation can fix that, and the figures are not similar.",
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
          "A dilation about the origin multiplies the coordinates, so the simplest order is to dilate first and slide afterward. If you slide first, the dilation also doubles that slide. The same slide then lands the triangle somewhere else, so you would need a different slide. If the image (the moved copy) is flipped or turned, put that motion between the dilation and the slide. Then check every vertex.",
        ],
      },
      {
        stage: "formal",
        title: "The definition",
        paragraphs: [
          "Two figures are similar exactly when some sequence of dilations and rigid motions maps one onto the other. A dilation with a positive scale factor $k$ multiplies all lengths by $k$ and keeps angles. Rigid motions keep both lengths and angles. So similar figures have equal matching angles, and their matching sides are all in the ratio $k$.",
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
      "Two equal pairs of angles fix the third pair, so the triangles are similar. Match vertices by equal angles and write sides in the same order.",
    templateIds: ["aa-similarity"],
    objectives: [
      "Decide whether two triangles are similar by AA from stated angles.",
      "Name the vertex correspondence and the matching proportion of sides.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two angles are enough",
        paragraphs: [
          "The angles of a triangle add to $180^\\circ$. If you know two of them, the third is what remains. So if two angles of one triangle equal two angles of another, the third angles are equal too, and the triangles have the same shape: they are similar.",
          "In a similarity statement such as $\\triangle ABC\\sim\\triangle EFD$, the vertices are matched in order: $A$ with $E$, $B$ with $F$, $C$ with $D$. Matching vertices have equal angles, and the sides between matching vertices correspond.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Triangle $ABC$ has $\\angle A=50^\\circ$ and $\\angle B=60^\\circ$. Triangle $DEF$ has $\\angle D=70^\\circ$ and $\\angle E=50^\\circ$. Are they similar by AA? If so, name the correspondence and write a proportion of sides.",
      steps: [
        "Find the third angles: $\\angle C=180^\\circ-50^\\circ-60^\\circ=70^\\circ$ and $\\angle F=180^\\circ-70^\\circ-50^\\circ=60^\\circ$.",
        "The angles of $ABC$ are $50^\\circ,60^\\circ,70^\\circ$ and those of $DEF$ are $70^\\circ,50^\\circ,60^\\circ$, the same three values, so at least two pairs match: the triangles are similar by AA.",
        "Match equal angles: $A$ ($50^\\circ$) with $E$, $B$ ($60^\\circ$) with $F$, $C$ ($70^\\circ$) with $D$. So $\\triangle ABC\\sim\\triangle EFD$.",
        "Side $AB$ joins $A,B$, whose matches are $E,F$, so it corresponds to $EF$. Likewise $BC$ corresponds to $FD$. Then $\\frac{AB}{EF}=\\frac{BC}{FD}=\\frac{CA}{DE}$.",
      ],
      answer:
        "Similar; $\\triangle ABC\\sim\\triangle EFD$; $\\frac{AB}{EF}=\\frac{BC}{FD}$",
    },
    closingSections: [
      {
        stage: "method",
        title: "When AA fails",
        paragraphs: [
          "If the two triangles share only one angle, AA does not apply. For example, angles $50^\\circ,60^\\circ,70^\\circ$ against $50^\\circ,65^\\circ,65^\\circ$ share only the $50^\\circ$, and the triangles are not similar. Compute all three angles of both triangles before deciding.",
        ],
      },
      {
        stage: "formal",
        title: "Why AA works",
        paragraphs: [
          "Suppose $\\angle A=\\angle D$ and $\\angle B=\\angle E$. Dilate $ABC$ by the factor $DE/AB$ so that its image has a side equal to $DE$. The image keeps both angles, so it has the same two angles on a side of length $DE$ as $DEF$. By ASA the image is congruent to $DEF$, so a rigid motion maps it onto $DEF$. A dilation followed by a rigid motion maps $ABC$ onto $DEF$, which is the definition of similarity.",
        ],
      },
    ],
    pitfalls: [
      "Name the correspondence by equal angles, not by the order of the letters.",
      "One pair of equal angles is not enough.",
      "Two stated angles are enough to find the third, so nothing is missing.",
    ],
    parentGuide:
      "Ask the learner to draw two triangles with angles $40^\\circ$ and $60^\\circ$ at different sizes and compare their shapes.",
  },
];
