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
    goal: "Use similar circles to relate arc length to radius, define radian measure as arc over radius, and find a sector's area as a fraction of the disk.",
    intuition:
      "Every circle is an enlargement of every other circle. When a circle is enlarged by a factor $k$, every length in it is multiplied by $k$, including the radius and the arc cut off by a fixed central angle. So for one angle, arc length divided by radius is the same number in every circle. That number measures the angle.",
    terms: [
      [
        "central angle",
        "An angle whose vertex is the center of a circle. It cuts off an arc of the circle.",
      ],
      [
        "radian",
        "The measure of a central angle that cuts off an arc exactly as long as the radius. A central angle of $\\theta$ radians cuts off an arc of length $\\theta r$.",
      ],
      [
        "sector",
        "The region between two radii and the arc they cut off. Its area is the same fraction of the disk as its angle is of a full turn.",
      ],
    ],
    method: [
      "For a proportion between two circles, divide each arc by its own radius and set the two ratios equal.",
      "For radian measure, divide the arc length by the radius: $\\theta=s/r$. For an arc, multiply: $s=\\theta r$.",
      "For a sector, take the fraction $\\theta/2\\pi$ of the disk's area $\\pi r^2$. The factor $\\pi$ cancels, leaving $\\tfrac12\\theta r^2$.",
      "Keep units: arc length in length units, area in square units, radians with no unit.",
    ],
    watch:
      "Arc length scales with the radius, not with its square. Area scales with the square. A sector uses a fraction of $2\\pi$ when the angle is in radians, and a fraction of $360$ when it is in degrees; do not mix them.",
  },
  "complex-plane-operations": {
    goal: "Read sums, differences, conjugates and products of complex numbers as moves of points in the complex plane.",
    intuition:
      "A complex number $a+bi$ is the point with $a$ across (the real part) and $b$ up (the imaginary part). Adding complex numbers adds the arrows from the origin, so the sum is the far corner of a parallelogram. Subtracting gives the arrow between the two points. The conjugate flips the sign of the imaginary part, which reflects the point in the horizontal axis. Multiplying by $i$ turns the point a quarter turn counterclockwise about the origin.",
    terms: [
      ["modulus", "The distance of a point from the origin, written $|z|$."],
      [
        "argument",
        "The counterclockwise angle from the positive real axis to the arrow from the origin to the point.",
      ],
      [
        "conjugate",
        "The conjugate of $a+bi$ is $a-bi$, written $\\overline{z}$.",
      ],
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
    goal: "Read statements about rates as conditional probabilities, tell $P(A\\mid B)$ from $P(B\\mid A)$, and decide independence from described rates.",
    intuition:
      "A conditional probability $P(A\\mid B)$ is the chance of $A$ when you look only at the cases where $B$ happened. The group you restrict to goes after the bar. Two events are independent when learning that $B$ happened does not change the chance of $A$.",
    terms: [
      [
        "conditional probability",
        "The probability of one event inside a smaller group: $P(A\\mid B)$ is the share of the cases with $B$ that also have $A$.",
      ],
      [
        "independent events",
        "Events $A$ and $B$ with $P(A\\mid B)=P(A)$, which is the same as $P(A\\cap B)=P(A)\\,P(B)$.",
      ],
      ["intersection", "The event that both happen, written $A\\cap B$."],
    ],
    method: [
      'Find the group the percentage is taken of. "Among those who $B$" names the condition: the probability is $P(\\cdot\\mid B)$.',
      "To compute from counts, divide the count with both events by the size of the condition group.",
      "To test independence, compare $P(A\\mid B)$ with $P(A)$, or $P(A\\cap B)$ with $P(A)P(B)$.",
      "If $P(A\\mid B)>P(A)$, then $B$ makes $A$ more likely; if it is smaller, less likely.",
    ],
    watch:
      "$P(A\\mid B)$ and $P(B\\mid A)$ divide by different group sizes, so they are usually different. Independent events can occur together; the test is a match of rates, not an absence of overlap.",
  },
  "congruence-by-rigid-motion": {
    goal: "Choose or predict the rigid motions that carry one triangle onto another, and decide congruence by whether such a sequence exists.",
    intuition:
      "A rigid motion moves a figure without stretching it: a translation slides, a rotation turns, a reflection flips. Lengths and angles stay the same. Two figures are congruent when some sequence of rigid motions carries one exactly onto the other.",
    terms: [
      [
        "rigid motion",
        "A translation, rotation or reflection, or a sequence of them. It preserves every distance and angle.",
      ],
      [
        "corresponding parts",
        "The sides and angles that land on each other. If $A\\to D$, $B\\to E$ and $C\\to F$, then $AB$ corresponds to $DE$ and $\\angle C$ to $\\angle F$.",
      ],
      [
        "orientation",
        "The direction $A\\to B\\to C$ runs around a triangle, clockwise or counterclockwise. A reflection reverses it.",
      ],
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
    goal: "Find the foci of an ellipse or hyperbola from its equation, and find the equation from the foci and a constant sum or difference of distances.",
    intuition:
      "Two fixed points called foci define these curves. An ellipse is every point whose distances to the two foci add to a constant. A hyperbola is every point whose distances to the two foci differ by a constant. The foci lie on the axis that holds the vertices, at distance $c$ from the center.",
    terms: [
      ["foci", "The two fixed points used to define an ellipse or hyperbola."],
      [
        "a, b and c",
        "In $\\frac{x^2}{a^2}\\pm\\frac{y^2}{b^2}=1$, the number $a$ is the distance from the center to a vertex on the axis, and $c$ is the distance from the center to a focus.",
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
    goal: "Match a dot plot, histogram or box plot to the data it displays, and find the bar heights or five numbers a data set produces.",
    intuition:
      "A dot plot puts one dot for each value, so every data value can be read back. A histogram groups values into equal intervals and shows only how many fall in each. A box plot shows five numbers: the least value, the lower quartile, the median, the upper quartile and the greatest value.",
    terms: [
      [
        "interval",
        "A range of values of equal width. In a histogram a value equal to the left end of an interval is counted in that interval.",
      ],
      [
        "quartiles",
        "The medians of the lower and upper halves of the ordered data. With an odd number of values the overall median is left out of both halves.",
      ],
    ],
    method: [
      "Dot plot: count the dots at each value and compare with the number of copies in each list.",
      "Histogram: sort each list into the intervals and compare the counts bar by bar.",
      "Box plot: order the list, find the minimum, the median, the medians of the two halves, and the maximum, and compare the five numbers.",
      "To build a plot from data, work in the other direction with the same counts or five numbers.",
    ],
    watch:
      "Order the data before taking a median or quartile. A histogram does not show the individual values, so two lists can share a histogram. Boundary values go into the interval that starts at them.",
  },
  "similarity-by-transformation": {
    goal: "Choose the dilation and rigid motions that map one triangle onto another, and decide similarity by whether such a sequence exists.",
    intuition:
      "A dilation enlarges or shrinks a figure by a scale factor about a center without changing its shape. Two figures are similar when some dilation followed by rigid motions maps one onto the other. The scale factor is the ratio of corresponding side lengths.",
    terms: [
      [
        "dilation",
        "A transformation about a center that multiplies every distance from the center by a scale factor $k$. It keeps angles and multiplies lengths by $k$.",
      ],
      [
        "similar figures",
        "Figures that a sequence of dilations and rigid motions maps onto each other.",
      ],
    ],
    method: [
      "Compare one pair of corresponding sides to find the scale factor $k$, and check the other sides give the same $k$.",
      "Dilate about the origin by $k$, then find the rigid motion (reflection, rotation, translation) that lands one vertex on its image.",
      "Check a second vertex. If the sides scale by different factors, no such sequence exists.",
    ],
    watch:
      "A dilation about the origin multiplies the coordinates, so translate after dilating, not before. Two right triangles are similar only if their legs scale by the same factor.",
  },
  "aa-similarity": {
    goal: "Decide whether two triangles are similar by AA from stated angles, name the correspondence, and write the matching proportion of sides.",
    intuition:
      "The angles of every triangle add to $180^\\circ$, so two angles fix the third. If two angles of one triangle equal two angles of another, all three match and the triangles have the same shape. They are similar, and the vertices with equal angles correspond.",
    terms: [
      [
        "AA similarity",
        "If two angles of one triangle equal two angles of another triangle, the triangles are similar.",
      ],
      [
        "correspondence",
        "The matching of vertices. In $\\triangle ABC\\sim\\triangle EFD$, $A$ matches $E$, $B$ matches $F$ and $C$ matches $D$.",
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
    "In a circle of radius $r$, a central angle of $\\theta$ radians cuts off an arc of length $s=\\theta r$, because arc length is proportional to radius for a fixed angle and one radian is the angle whose arc equals the radius. The sector has area $\\tfrac{\\theta}{2\\pi}\\cdot\\pi r^2=\\tfrac12\\theta r^2$. In degrees $d$, the area is $\\tfrac{d}{360}\\pi r^2$.",
  "complex-plane-operations":
    "Identify $a+bi$ with the point $(a,b)$. Then $z+w$ is vector addition, $z-w$ is the vector from $w$ to $z$, $\\overline{z}$ is the reflection in the real axis, and for $w=r(\\cos\\theta+i\\sin\\theta)$ multiplication by $w$ scales by $r$ and rotates counterclockwise by $\\theta$. In particular $i=\\cos90^\\circ+i\\sin90^\\circ$ rotates by $90^\\circ$.",
  "conditional-everyday-reasoning":
    "For $P(B)>0$, $P(A\\mid B)=P(A\\cap B)/P(B)$. Events $A$ and $B$ are independent exactly when $P(A\\cap B)=P(A)P(B)$, equivalently $P(A\\mid B)=P(A)$. In general $P(A\\mid B)\\ne P(B\\mid A)$; they are related by $P(A\\mid B)P(B)=P(B\\mid A)P(A)$.",
  "congruence-by-rigid-motion":
    "Translations, rotations and reflections preserve distance and angle measure. Figures are congruent exactly when a sequence of rigid motions maps one onto the other, so corresponding sides and angles are equal. A reflection reverses orientation; a translation or rotation preserves it.",
  "conic-foci":
    "For an ellipse with foci $(\\pm c,0)$ and $d_1+d_2=2a$, the equation is $\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1$ with $b^2=a^2-c^2$. For a hyperbola with foci $(\\pm c,0)$ and $|d_1-d_2|=2a$, it is $\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=1$ with $b^2=c^2-a^2$. With foci $(0,\\pm c)$, the roles of $x$ and $y$ swap.",
  "choose-the-plot":
    "A dot plot shows every value, a histogram shows the count in each interval (a value equal to an interval's left end belongs to that interval), and a box plot shows the minimum, the first quartile, the median, the third quartile and the maximum. Quartiles are the medians of the lower and upper halves of the ordered data, excluding the overall median when the count is odd.",
  "similarity-by-transformation":
    "A dilation about the origin with scale factor $k$ sends $(x,y)$ to $(kx,ky)$, multiplies distances by $k$ and preserves angles. Figures are similar exactly when a dilation followed by rigid motions maps one onto the other; corresponding sides are then in the common ratio $k$.",
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
      "Circles are enlargements of each other, so a fixed angle cuts arcs proportional to the radius. Radian measure and the sector formula follow.",
    templateIds: ["arc-sector-derivation"],
    objectives: [
      "Use similar circles to scale an arc length to a different radius.",
      "Define radian measure as arc length divided by radius and use it both ways.",
      "Find a sector's area as a fraction of the disk.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One angle, every circle",
        paragraphs: [
          "A central angle has its vertex at the center of a circle and cuts off an arc. Draw the same angle in a small circle and in a large one. The large circle is an enlargement of the small one, so every length in it, including the radius and the arc, is multiplied by the same factor.",
          "That means arc length divided by radius is the same number for the angle in every circle. This ratio is the natural measure of the angle. One radian is the angle whose arc is exactly one radius long.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A central angle cuts off an arc 4 cm long in a circle of radius 3 cm. (a) How long an arc does the same angle cut off in a circle of radius 9 cm? (b) What is the angle in radians? (c) What is the area of the sector in the circle of radius 3 cm?",
      steps: [
        "(a) The radius is multiplied by $9/3=3$, so the arc is too: $4\\times3=12$ cm. Check the ratios: $4/3=12/9$.",
        "(b) Radian measure is arc over radius: $\\theta=4/3$ radians.",
        "(c) A full turn is $2\\pi$ radians, so the sector is the fraction $\\frac{4/3}{2\\pi}$ of the disk. The disk's area is $\\pi\\cdot3^2=9\\pi$. Then $\\frac{4/3}{2\\pi}\\cdot9\\pi=\\frac{4}{6}\\cdot9=6$.",
        "Check with the shortcut $\\tfrac12\\theta r^2=\\tfrac12\\cdot\\tfrac43\\cdot9=6$.",
      ],
      answer: "(a) 12 cm; (b) $\\tfrac43$ radians; (c) 6 cm$^2$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Three formulas from one ratio",
        paragraphs: [
          "Because $\\theta=s/r$, the arc cut off by $\\theta$ radians in a circle of radius $r$ is $s=\\theta r$. A full turn is the whole circumference, $2\\pi r$, so a full turn measures $2\\pi$ radians.",
          "A sector is the fraction $\\theta/2\\pi$ of the disk, so its area is $\\frac{\\theta}{2\\pi}\\cdot\\pi r^2=\\tfrac12\\theta r^2$. For an angle of $d$ degrees the fraction is $d/360$.",
        ],
      },
      {
        stage: "formal",
        title: "Why arc length is proportional to radius",
        paragraphs: [
          "Dilating a circle by a factor $k$ about its center maps it to a circle of radius $kr$ and maps an arc of length $s$ and central angle $\\theta$ to an arc with the same central angle and length $ks$. Since the angle is unchanged, $s/r$ depends only on the angle. Define radian measure to be this ratio.",
        ],
      },
    ],
    pitfalls: [
      "Arc length scales with the radius; area scales with the square of the radius.",
      "Use $\\theta/2\\pi$ for radians and $d/360$ for degrees.",
      "The ratio is arc over radius, not radius over arc.",
    ],
    parentGuide:
      "Ask the learner to draw two circles with the same angle and explain why the longer radius gives the longer arc in the same ratio.",
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
      'Restrict to the group named after "among", divide by that group\'s size, and compare with the overall rate to judge independence.',
    templateIds: ["conditional-everyday-reasoning"],
    objectives: [
      "Tell $P(A\\mid B)$ from $P(B\\mid A)$ in a described situation.",
      "Decide independence by comparing a conditional rate with the overall rate.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Which group are you looking at?",
        paragraphs: [
          'A rate such as "40% of students on the bus play in the band" looks only at the students on the bus. That is a conditional probability: the chance of one event within the group where another happened. The group goes after the vertical bar, so this is $P(\\text{band}\\mid\\text{bus})$.',
          "Two events are independent when knowing about one does not change the chance of the other. Then the rate inside the group equals the rate for everyone.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Of 200 students, 80 play in the band, 50 take the bus, and 20 do both. Find $P(\\text{band}\\mid\\text{bus})$ and $P(\\text{bus}\\mid\\text{band})$, and decide whether the events are independent.",
      steps: [
        "Among the 50 bus riders, 20 play in the band: $P(\\text{band}\\mid\\text{bus})=\\frac{20}{50}=\\frac25$.",
        "Among the 80 band members, 20 take the bus: $P(\\text{bus}\\mid\\text{band})=\\frac{20}{80}=\\frac14$. The two differ because the groups have different sizes.",
        "Overall, $P(\\text{band})=\\frac{80}{200}=\\frac25$, which equals $P(\\text{band}\\mid\\text{bus})$. Check the other direction: $P(\\text{bus})=\\frac{50}{200}=\\frac14=P(\\text{bus}\\mid\\text{band})$.",
        "Knowing a student rides the bus does not change the chance that the student plays in the band, so the events are independent. Check the product: $\\frac25\\cdot\\frac14=\\frac1{10}=\\frac{20}{200}=P(\\text{both})$.",
      ],
      answer: "$\\tfrac25$ and $\\tfrac14$; independent",
    },
    closingSections: [
      {
        stage: "method",
        title: "Compare the rates",
        paragraphs: [
          "If the rate inside the group is higher than the overall rate, the condition makes the event more likely; if lower, less likely; if equal, the events are independent. The comparison needs only these two rates, not the size of the group.",
        ],
      },
      {
        stage: "formal",
        title: "Definition and relation",
        paragraphs: [
          "For $P(B)>0$, $P(A\\mid B)=P(A\\cap B)/P(B)$. Events $A$ and $B$ are independent exactly when $P(A\\cap B)=P(A)P(B)$, which is the same as $P(A\\mid B)=P(A)$. Because $P(A\\cap B)$ equals both $P(A\\mid B)P(B)$ and $P(B\\mid A)P(A)$, the two conditional probabilities are equal only when $P(A)=P(B)$ or when the overlap is empty.",
        ],
      },
    ],
    pitfalls: [
      "$P(A\\mid B)$ divides by the size of $B$; $P(B\\mid A)$ divides by the size of $A$.",
      "Independent events can occur together, and exclusive events with positive chance are not independent.",
      "Compare the conditional rate with the overall rate for the same event.",
    ],
    parentGuide:
      'Ask the learner to read "of the people who carry umbrellas, 80% are wet" and say which group is the condition.',
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
        "(a) Find the foci of $\\frac{x^2}{25}+\\frac{y^2}{9}=1$. (b) Find the equation of the ellipse with foci $(\\pm4,0)$ whose distances to the foci always add to $10$.",
      steps: [
        "(a) The larger denominator is $a^2=25$ and the smaller is $b^2=9$. For an ellipse $c^2=a^2-b^2=25-9=16$, so $c=4$. The larger denominator is under $x^2$, so the foci are $(\\pm4,0)$.",
        "(b) The constant sum is $2a=10$, so $a=5$ and $a^2=25$. The foci give $c=4$, so $b^2=a^2-c^2=25-16=9$.",
        "The foci are on the $x$-axis, so $a^2$ goes under $x^2$: $\\frac{x^2}{25}+\\frac{y^2}{9}=1$. This is the curve in part (a), a consistency check.",
      ],
      answer: "(a) $(\\pm4,0)$; (b) $\\frac{x^2}{25}+\\frac{y^2}{9}=1$",
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
      "A dot plot keeps every value, a histogram keeps the count in each interval, and a box plot keeps five numbers. Check a list against each by counting.",
    templateIds: ["choose-the-plot"],
    objectives: [
      "Choose the data set a dot plot, histogram or box plot displays.",
      "Find bar heights and the five numbers of a box plot from raw data.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Three views of the same numbers",
        paragraphs: [
          "A data set is a list of numbers. A dot plot puts one dot above the number line for each value, so stacks show repeats. A histogram splits the line into equal intervals and draws a bar whose height is the count of values in the interval. A box plot shows only five numbers: the least value, the lower quartile, the median, the upper quartile and the greatest value.",
          "To match a plot to a list, compute what the plot would show for the list and compare it with the picture.",
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
        "Order the values: 20, 25, 25, 30, 40, 45, 50. The least is 20 and the greatest is 50.",
        "The median is the middle of the seven values, the fourth: 30.",
        "The lower half is 20, 25, 25, with median 25. The upper half is 40, 45, 50, with median 45. The overall median is left out of both halves.",
        "The five numbers are 20, 25, 30, 45 and 50. The plot has its box from 25 to 45 with a line at 30, and whiskers to 20 and 50.",
      ],
      answer: "20, 25, 30, 45, 50",
    },
    closingSections: [
      {
        stage: "method",
        title: "Check a list against each plot",
        paragraphs: [
          "Dot plot: count the dots at each value; the list must repeat each value that many times. Histogram: sort the list into the intervals, putting a value equal to an interval's left end in that interval, and compare the counts with the bar heights. Box plot: order the list and compute the five numbers. A different list that changes any one of them does not match.",
        ],
      },
      {
        stage: "formal",
        title: "What each plot keeps",
        paragraphs: [
          "A dot plot determines the data exactly. A histogram determines only the counts in the intervals, and a box plot only the five-number summary, so different lists can give the same histogram or box plot. That is why a list must be checked against the numbers the plot actually shows.",
        ],
      },
    ],
    pitfalls: [
      "Order the data before finding a median or quartile.",
      "Count a value on an interval's left end in the interval that starts there.",
      "When the count is odd, leave the median out of both halves for the quartiles.",
    ],
    parentGuide:
      "Ask the learner to make a dot plot of ten numbers and then group them in intervals of 5 to see what the histogram hides.",
  },
  {
    id: "similarity-by-transformation",
    title: "Similarity by dilation and rigid motion",
    summary:
      "Triangles are similar when a dilation followed by rigid motions maps one onto the other. The scale factor is the ratio of corresponding sides.",
    templateIds: ["similarity-by-transformation"],
    objectives: [
      "Find the scale factor between two triangles on a grid.",
      "Choose the dilation and rigid motions that map one triangle onto the other.",
      "Decide that triangles are not similar when sides scale unequally.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Same shape, different size",
        paragraphs: [
          "A dilation about a center multiplies every distance from the center by a scale factor $k$. It enlarges when $k>1$ and shrinks when $0<k<1$, and it keeps every angle. Two figures are similar when a dilation followed by moves that do not change size (rigid motions) turns one into the other.",
          "That means corresponding sides are all in the same ratio $k$. If two matching pairs of sides scale by different factors, no dilation can fix it.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Triangle $ABC$ has $A(1,2)$, $B(3,2)$, $C(1,5)$. Triangle $DEF$ has $D(-3,1)$, $E(1,1)$, $F(-3,7)$. Find the dilation about the origin and the translation that map $A\\to D$, $B\\to E$, $C\\to F$.",
      figure: similarFigure,
      steps: [
        "Compare $AB$ and $DE$: $AB=2$ and $DE=4$. Compare $AC$ and $DF$: $AC=3$ and $DF=6$. Both pairs scale by $2$, so the triangles are similar with $k=2$.",
        "Dilate by $2$ about the origin: $A(1,2)\\to(2,4)$, $B(3,2)\\to(6,4)$, $C(1,5)\\to(2,10)$.",
        "To move $(2,4)$ to $D(-3,1)$, translate by $(x,y)\\to(x-5,y-3)$.",
        "Check: $(6,4)\\to(1,1)=E$ and $(2,10)\\to(-3,7)=F$.",
      ],
      answer:
        "Dilate by a factor of 2 about the origin, then translate $(x,y)\\to(x-5,y-3)$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Order matters",
        paragraphs: [
          "A dilation about the origin multiplies the coordinates, so do it first and translate afterward. Translating first and then dilating also multiplies the translation by $k$ and lands elsewhere. If the image is reflected or rotated, insert that motion between the dilation and the translation and check every vertex.",
        ],
      },
      {
        stage: "formal",
        title: "The definition",
        paragraphs: [
          "Two figures are similar if and only if a sequence of dilations and rigid motions maps one onto the other. A dilation with scale factor $k$ multiplies all lengths by $k$ and preserves angles, and rigid motions preserve both, so similar figures have equal corresponding angles and corresponding sides in the ratio $k$.",
        ],
      },
    ],
    pitfalls: [
      "Dilate first, then translate, when the dilation is about the origin.",
      "Right triangles are similar only if their legs scale by the same factor.",
      "A scale factor below 1 is a shrink, written as a fraction.",
    ],
    parentGuide:
      "Ask the learner to compare two photos of the same picture in different sizes and say what ratio relates matching lengths.",
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
