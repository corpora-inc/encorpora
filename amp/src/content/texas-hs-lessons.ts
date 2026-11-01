import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Methods, principles and lessons for the Texas high-school requirement-gap templates. */
export const texasHsMethods: Record<string, ProblemMethod> = {
  "line-equation-forms": {
    goal: "Write a line's equation in point-slope, slope-intercept or standard form from a point and slope, two points, or another form.",
    intuition:
      "The slope $m$ is how much $y$ changes when $x$ goes up by 1. One point and the slope fix a line. Point-slope form $y - y_1 = m(x - x_1)$ shows a known point $(x_1, y_1)$ and the slope. Slope-intercept form $y = mx + b$ shows the slope and $b$, the value of $y$ at $x = 0$. The form $Ax+By=C$ is called standard form, with integers $A$, $B$, $C$ ($A$ and $B$ not both 0).",
    senses: {
      "standard form": "standard-form-line",
      side: "side-of-equation",
      term: "term-expression",
    },
    noLink: ["change", "changes", "factor"],
    terms: ["slope", "point-slope-form", "standard-form-line"],
    method: [
      "If two points are given, find the slope: the change in $y$ divided by the change in $x$.",
      "Put the slope and one point into $y-y_1=m(x-x_1)$, subtracting each coordinate from its own letter.",
      "To change form, multiply out and solve for $y$ for slope-intercept form. For standard form, clear fractions and gather $x$ and $y$ on the left.",
      "Check by putting in the given point or points.",
    ],
    watch:
      "Subtract the point's coordinates: a point with $x_1=-2$ gives $x+2$. When clearing fractions, multiply every term (each piece joined by + or −), including the plain number.",
  },
  "line-relationship-equations": {
    goal: "Write the line through a point parallel or perpendicular to a given line or an axis, and name slopes of flat and upright lines.",
    intuition:
      "Two different non-vertical lines are parallel, pointing the same way and never meeting, exactly when they have the same slope. Perpendicular lines cross at a right angle. If neither is vertical, their slopes are negative reciprocals: flip the fraction and change the sign, so 2 pairs with $-\\frac{1}{2}$. Their product, the result of multiplying them, is $-1$. A horizontal (flat) line has slope 0. A vertical (upright) line has undefined slope, because its change in $x$ is 0.",
    senses: {
      "standard form": "standard-form-line",
      side: "side-of-equation",
      product: "product-multiply",
    },
    noLink: ["change", "changes"],
    terms: ["negative-reciprocal", "horizontal-line", "vertical-line"],
    method: [
      "Read the slope of the given line. For $Ax+By=C$ with $B$ not 0, solve for $y$: $By = -Ax + C$, so $y = -\\frac{A}{B}x + \\frac{C}{B}$ and the slope is $-\\frac{A}{B}$.",
      "Use the same slope for a parallel line, or the negative reciprocal for a perpendicular line. If the given line is horizontal or vertical, use the last step instead.",
      "Put the given point into $y=mx+b$ and solve for $b$, the value of $y$ at $x = 0$.",
      "A horizontal line is a flat line; a vertical line is an upright one. For a line parallel or perpendicular to one of these, decide which kind the new line is. Then keep the matching coordinate of the point.",
    ],
    watch:
      "A perpendicular slope needs both moves: flip the fraction and change the sign. The point's $y$-coordinate is not $b$ unless the point is on the $y$-axis.",
  },
  "system-equation-choice": {
    goal: "Choose the pair of linear equations (a system) that matches a situation, a pair of tables or a graph.",
    intuition:
      "An amount that starts at some value and grows by the same rate each step is written $y = mx + b$. The rate $m$ multiplies $x$, and the starting value $b$ is added on. For 10 dollars to join plus 4 dollars a month, $y = 4x + 10$. A system is a pair of such equations, one for each amount.",
    senses: { model: "model" },
    noLink: ["change", "changes", "mean", "balances"],
    terms: [
      "system-of-equations",
      [
        "rate",
        "Here it is how much $y$ changes when $x$ increases by 1: the coefficient of $x$.",
      ],
      "initial-value",
    ],
    method: [
      "For a table, find how much $y$ changes when $x$ goes up by 1. Then find the value at $x=0$.",
      "For a graph, read where each line crosses the vertical axis, and count rise over run for its slope.",
      "For a story with two unknown counts, write one equation for the total number and one for the total value, multiplying each count by its price.",
      "Pair each rate with its own starting value.",
    ],
    watch:
      "Keep each rate and starting value together in one equation. The starting value is the value at $x = 0$, even when a table begins at $x = 1$.",
  },
  "graph-estimate-system-solution": {
    goal: "Read two plotted lines, estimate the point where they meet, and say what it means in the situation.",
    intuition:
      "Each line shows one amount as it changes. A point on a graph is written $(x, y)$: the across value, then the up value. Where the two lines cross, both amounts have the same $x$ and the same $y$. So that point answers questions such as “when do the two plans cost the same?”",
    senses: { model: "model" },
    noLink: ["change", "changes", "mean", "balances"],
    terms: [
      "intersection-graphs",
      [
        "estimate",
        "Here it is a value read from a graph, which may fall between grid lines.",
      ],
    ],
    method: [
      "Find where the lines cross.",
      "Read the $x$-coordinate on the horizontal axis and the $y$-coordinate on the vertical axis, including positions between grid lines.",
      "Write the pair as $(x, y)$ and say what each number means.",
    ],
    watch:
      "Do not round the crossing to the nearest grid corner, and keep the order $(x, y)$.",
  },
  "exponential-domain-range": {
    goal: "Write the domain (allowed inputs) and range (possible outputs) of an exponential function or model as inequalities.",
    intuition:
      "In $2^x$, the base, the number being multiplied, is 2. The exponent is the small raised $x$. When it is a counting number, it says how many times: $2^3 = 2 \\times 2 \\times 2$. A positive base can be raised to any real power, so every input is allowed unless a situation limits it. Take the base positive and not 1 (a base of 1 always gives 1). The outputs creep toward a boundary line, called the horizontal asymptote, but never reach it. For $a \\cdot b^x + k$, the boundary is $y = k$.",
    senses: {
      term: "term-expression",
      boundary: "boundary",
      base: "base-exponent",
      range: "range-function",
      model: "model",
    },
    noLink: ["side"],
    terms: ["domain", "range-function", "horizontal-asymptote"],
    method: [
      "State the domain: all real numbers, unless a situation limits the input, such as time $t\\ge0$.",
      "Find the boundary of the range: the number $k$ added to $a\\cdot b^x$.",
      "If $a>0$ the outputs lie above the boundary; if $a<0$ they lie below it. The boundary is never reached, so use $<$ or $>$.",
      "For a model, an equation that stands for a real situation, include the starting value when the domain starts at 0.",
    ],
    watch:
      "Exponential functions allow every real $x$, including negatives. The boundary itself is never an output.",
  },
  "absolute-value-equation-formulate": {
    goal: "Write an absolute value equation from a distance, from two given solutions, or from a measurement that may miss a target by a fixed amount.",
    intuition:
      "The absolute value $|x - c|$ is the distance between $x$ and $c$ on the number line. So $|x - c| = d$ asks for every number exactly $d$ away from $c$. When $d$ is greater than 0, there are two answers, one $d$ above $c$ and one $d$ below. The middle number $c$ is called the center.",
    senses: { unit: "unit", difference: "difference-subtract" },
    noLink: ["center", "side"],
    terms: [
      ["absolute-value", "$|x - c|$ is the distance from $x$ to $c$."],
      [
        "center",
        "Here the center is the number $c$ that distances are measured from.",
      ],
    ],
    method: [
      "Find the center, the number the distance is measured from.",
      "Find the distance.",
      "Write $|x-c|=d$. For two given solutions, the center is halfway between them and $d$ is the distance from it to either one.",
    ],
    watch:
      "A center of $-3$ gives $|x+3|$. The number after the equals sign is the distance, not the center.",
  },
  "rational-equation-formulate": {
    goal: "Write the equation with fractions that models a work-together, river-current or two-speed travel story.",
    intuition:
      "A rate is how much happens in one unit of time. A worker who keeps a steady pace and finishes a job in $h$ hours does $\\frac{1}{h}$ of it per hour. For travel, time equals distance divided by speed. When the unknown ends up in the bottom of a fraction, the equation is called a rational equation.",
    senses: { model: "model", unit: "unit" },
    noLink: ["part", "parts", "whole", "change"],
    terms: ["rate", "rational-equation"],
    method: [
      "Name the unknown, and decide what each fraction measures: a rate or a time.",
      "For work, add the rates of workers who work together. Set the sum equal to the team's rate, $\\frac{1}{x}$.",
      "For travel, write each time as distance over speed. Add a current to the speed going with it, and subtract it going against.",
      "Say what the equation compares: equal times, or times that add to a total.",
    ],
    watch:
      "Rates add for workers at the same time; times of separate parts add for a trip. Distance divided by speed gives time, not speed divided by distance.",
  },
  "rational-exponent-equation": {
    goal: "Solve $x^{p/q}=k$ by raising both sides to the reciprocal power, with its sign and domain cases.",
    intuition:
      "A power $p/q$ means a $q$th root and then a $p$th power. To undo it, raise both sides to the reciprocal power $q/p$. An even power of $x$ cannot tell $x$ from $-x$, and an even root needs $x\\ge0$.",
    terms: ["rational-exponent", "reciprocal"],
    method: [
      "Raise both sides to the power $\\frac{q}{p}$. The left side becomes $x$.",
      "Evaluate the right side, using a root and a power.",
      "If the numerator $p$ is even, include both the positive and negative value. If the denominator $q$ is even, keep only $x\\ge0$.",
      "Substitute to check.",
    ],
    watch:
      "Undo a power by raising to the reciprocal, not by multiplying by it. Check the sign cases before listing solutions.",
  },
  "transformation-composition-image": {
    goal: "Find where a point lands after a rigid motion (slide, flip or turn) and then a dilation about a center other than $(0, 0)$.",
    intuition:
      "A rigid motion slides, flips or turns a figure without changing its size. A dilation resizes it: every distance from a fixed center point is multiplied by the scale factor. The point you end with is the image. Each step acts on the result of the step before, so the order can change the answer.",
    senses: { image: "image-transformation", unit: "unit" },
    noLink: ["center", "scale", "scales", "change"],
    terms: ["rigid-motion", "dilation", "center-of-dilation"],
    method: [
      "Do the steps in the order stated.",
      "Apply a rigid motion to the coordinates directly.",
      "For a dilation, subtract the center from the point, multiply by the scale factor, and add the center back.",
    ],
    watch:
      "A center that is not $(0, 0)$ must be subtracted first and added back after. Multiplying the coordinates directly scales from $(0, 0)$ instead.",
  },
  "counterexample-choice": {
    goal: "Choose the case that makes a conjecture's “if” part true but its “then” part false.",
    intuition:
      "A conjecture is a claim that something is always true, often “if $p$, then $q$.” The “if” part is the hypothesis and the “then” part is the conclusion. One case where the hypothesis is true and the conclusion is false shows the claim is wrong. That case is a counterexample. Cases that agree with the claim do not prove it in general.",
    senses: {
      square: "square-shape",
      side: "side",
      product: "product-multiply",
    },
    noLink: ["legs", "part", "parts", "third"],
    terms: ["conjecture", "counterexample"],
    method: [
      "Split the conjecture into its hypothesis (the “if” part) and its conclusion (the “then” part).",
      "For each choice, test whether the hypothesis is true.",
      "Among those, keep the one where the conclusion is false.",
    ],
    watch:
      "A case that fails the “if” part does not test the conjecture, and a case where both parts are true agrees with it. Only “if” true and “then” false disproves it.",
  },
  "spherical-geometry-compare": {
    goal: "Say how parallel lines, triangle angle sums, right angles and shortest paths on a sphere differ from those on a flat plane.",
    intuition:
      "A sphere is the surface of a ball. Its straightest paths are great circles: circles whose center is the center of the sphere, such as the equator. They act as the sphere's lines. Any two great circles cross, so many flat-plane facts change.",
    senses: {
      plane: "plane",
      vertex: "vertex",
      side: "side",
      center: "center",
      "more than": "more-than",
    },
    noLink: ["opposite", "quarter", "change", "changes"],
    terms: [
      [
        "sphere",
        "A great circle is a circle on the sphere centered at the sphere's center, such as the equator.",
      ],
      [
        "sphere",
        "In geometry on a sphere, the lines are great circles: circles centered at the sphere's center.",
      ],
    ],
    method: [
      "Use great circles as the lines of the sphere.",
      "Any two great circles cross at two points directly across the sphere, so there are no parallel lines.",
      "A triangle on a sphere has angles adding to more than $180^\\circ$, and it can have three right angles ($90^\\circ$ each).",
      "The shortest route between two points follows the shorter arc of a great circle. For two points directly opposite each other, any half great circle between them is equally short.",
    ],
    watch:
      "Do not carry the plane's facts to the sphere. Facts for a saddle-shaped surface, such as angle sums below $180^\\circ$, differ from the sphere's too.",
  },
  "regular-polygon-area": {
    goal: "Find the area of a regular polygon from its apothem and perimeter or a hexagon's side, or find a missing apothem or side.",
    intuition:
      "A regular polygon is a flat shape with equal straight sides and equal angles. Lines from its center to each corner cut it into identical triangles. Each triangle has one side of the polygon as its bottom and the apothem, the distance from the center to the middle of a side, as its height. So the area is half the apothem times the perimeter.",
    senses: { side: "side", vertex: "vertex" },
    noLink: ["center", "square", "squared", "base", "part", "whole", "factor"],
    terms: ["regular-polygon", "apothem"],
    method: [
      "Find the perimeter: the number of sides times the side length.",
      "Find or read the apothem. For a regular hexagon with side $s$, it is $\\frac{s\\sqrt3}{2}$. Here $\\sqrt3$ is the square root of 3: the positive number that times itself gives 3, about 1.73.",
      "Use $A=\\frac12ap$, with apothem $a$ and perimeter $p$. To find a missing part, solve this equation for it.",
    ],
    watch: "Use the whole perimeter, not one side, and keep the $\\frac12$.",
  },
  "curved-solid-surface-area": {
    goal: "Find the outside surface area of a cone, or of a cylinder joined to a dome (hemisphere) or a cone.",
    intuition:
      "Surface area is the total area of the outside of a solid, the parts you could paint. When two solids are joined, the surfaces that touch are hidden and not counted. With radius $r$ and $\\pi$ about 3.14, a flat circle has area $\\pi r^2$ ($r^2$ means $r$ times $r$). A cone's wall uses its slant height $\\ell$, the distance from the tip down the wall to the base edge.",
    senses: {
      base: "base-shape",
      edge: "edge",
      face: "face-solid",
      solid: "solid-shape",
      center: "center",
    },
    noLink: ["side", "sides", "square", "part", "bases", "parts"],
    terms: [
      "slant-height",
      [
        "surface-area",
        "Count only the exposed surfaces, the ones on the outside of the solid.",
      ],
    ],
    method: [
      "List the outside surfaces: flat circles, curved walls and any dome. Leave out any part of a surface that is covered where two solids touch.",
      "Use $\\pi r^2$ for a circle, $2\\pi rh$ for a cylinder's wall, $\\pi r\\ell$ for a cone's wall and $2\\pi r^2$ for a hemisphere's dome.",
      "For a right circular cone, use the slant height. If you know the radius $r$ and height $h$ but not $\\ell$, find it from $\\ell=\\sqrt{r^2+h^2}$. The sign $\\sqrt{\\ }$ means square root: the number, 0 or greater, that times itself gives the number under the sign.",
      "Add the areas.",
    ],
    watch:
      "Do not count joined surfaces, and do not use the straight-up height where the formula needs the slant height.",
  },
  "area-probability": {
    goal: "Find the probability that a random point lands in part of a region, as the part's area divided by the whole area.",
    intuition:
      "Probability is a number from 0 to 1 that tells how likely something is. When every spot in a region is equally likely, the chance of landing in a part is the fraction of the total area that part covers. A part covering a quarter of the area has probability $\\frac{1}{4}$.",
    senses: {
      part: "part",
      whole: "whole",
      square: "square-shape",
      side: "side",
      center: "center",
    },
    noLink: ["base", "squared", "quarter"],
    terms: ["geometric-probability"],
    method: [
      "Find the area of the target part.",
      "Find the area of the whole region.",
      "Divide the part by the whole and simplify. For landing outside the part, subtract the part's probability from 1.",
    ],
    watch:
      "Compare areas, not lengths or perimeters. The target part must be inside the whole region.",
  },
  "composition-order-choice": {
    goal: "Compare $f(g(x))$ with $g(f(x))$ for given functions and decide whether they are equal.",
    intuition:
      "In $f(g(x))$ the function $g$ acts first and $f$ acts on the result. Switching the order usually changes the result, but some pairs, such as two scalings or two shifts, give the same result both ways.",
    terms: ["composition", "commute"],
    method: [
      "For $f(g(x))$, replace each $x$ in $f$ with the whole expression for $g(x)$ and simplify.",
      "For $g(f(x))$, replace each $x$ in $g$ with the whole expression for $f(x)$ and simplify.",
      "Compare the simplified expressions.",
    ],
    watch:
      "Composition substitutes; it does not multiply or add. One pair that commutes does not show that every pair does.",
  },
  "one-sided-behavior-choice": {
    goal: "Describe what $f(x)$ approaches from the left and the right of a vertical asymptote, a hole or a jump.",
    intuition:
      "Near a break in the graph, the two sides can behave differently. Left-sided behavior, written $x\\to c^-$, uses $x$ values just below $c$, and right-sided behavior, $x\\to c^+$, uses values just above $c$.",
    terms: ["vertical-asymptote", "hole", "jump-discontinuity"],
    method: [
      "For a rational function, cancel common factors first. A canceled factor gives a hole whose height comes from the simplified expression.",
      "For an asymptote, test the sign of $f$ just left and just right of the zero of the denominator.",
      "A factor that is squared does not change sign, so both sides head the same way.",
      "For a piecewise function, use the rule for each side and evaluate it at the break.",
    ],
    watch:
      "Test each side separately. A hole is not an asymptote, and a squared factor keeps the same sign on both sides.",
  },
  "parametric-rectangular-convert": {
    goal: "Eliminate the parameter from linear, parabolic and circular parametric equations, or write a line parametrically.",
    intuition:
      "Parametric equations give $x$ and $y$ separately as functions of a parameter $t$. Removing $t$ leaves one equation linking $x$ and $y$ whose graph is the same path.",
    terms: [
      [
        "parametric-equations",
        "Here the parameter is $t$; both $x$ and $y$ depend on it.",
      ],
      [
        "parametric-equations",
        "A rectangular equation uses only $x$ and $y$; remove the parameter to get it.",
      ],
    ],
    method: [
      "Solve one equation for $t$, or for $\\cos t$ and $\\sin t$.",
      "Substitute into the other equation, or use $\\cos^2t+\\sin^2t=1$.",
      "Simplify. To go the other way, substitute the given $x$ expression into the rectangular equation.",
    ],
    watch:
      "Keep every constant when solving for $t$, and square the denominator when using $\\cos^2t+\\sin^2t=1$.",
  },
  "angular-velocity-problem": {
    goal: "Find angular speed, linear speed or distance traveled for a point on a rotating wheel.",
    intuition:
      "One revolution is an angle of $2\\pi$ radians. A point at distance $r$ from the center travels $r$ units for each radian, so its speed is $r$ times the angular speed.",
    terms: [
      "angular-speed",
      [
        "speed",
        "Linear speed is how far a point on a turning object travels per unit of time.",
      ],
    ],
    method: [
      "Convert revolutions to radians with $2\\pi$ radians per revolution, and change time units if needed.",
      "Use $v=r\\omega$ for linear speed from angular speed $\\omega$.",
      "Use $s=r\\theta$ for distance along the rim when the angle $\\theta$ is in radians.",
    ],
    watch:
      "Check units: revolutions, radians and distance are different. $s=r\\theta$ needs radians.",
  },
  "reference-angle-standard-position": {
    goal: "Find the reference angle, quadrant or coterminal angle of an angle in standard position, including negative and multi-turn angles.",
    intuition:
      "An angle in standard position starts on the positive $x$-axis and turns counterclockwise if positive, clockwise if negative. Full turns do not change where it ends, and the reference angle is the acute angle from the terminal side to the $x$-axis.",
    terms: ["standard-position", "coterminal-angles", "reference-angle"],
    method: [
      "Add or subtract full turns until the angle is between 0 and one turn.",
      "Name the quadrant.",
      "Reference angle: the angle in quadrant I, one half turn minus it in II, it minus one half turn in III, one turn minus it in IV.",
    ],
    watch:
      "A reference angle is always acute and is measured to the $x$-axis. A negative angle turns clockwise.",
  },
  "bearing-trig-problem": {
    goal: "Split a trip on a compass bearing into its north-south and east-west parts, or find the bearing from the two parts.",
    intuition:
      "A bearing is a direction given as an angle turned clockwise from north: east is $090^\\circ$. Unless the trip goes straight north, south, east or west, it is the hypotenuse (longest side) of a right triangle whose legs point north-south and east-west. For one of the two smaller angles in that triangle, the leg touching it is adjacent and the leg across from it is opposite. Opposite = hypotenuse × sine, adjacent = hypotenuse × cosine.",
    senses: { side: "side" },
    noLink: ["tangent", "opposite", "plane", "parts", "part"],
    terms: [
      "bearing",
      [
        "component",
        "Here they are the north-south and east-west parts of a trip.",
      ],
    ],
    method: [
      "Sketch north, the direction of travel, and the right triangle.",
      "Find the angle between the path and the north-south line.",
      "The north-south leg touches that angle, so use cosine. The east-west leg is across from it, so use sine.",
      "Name each direction, north or south and east or west, from where the path points.",
    ],
    watch:
      "Measure from north, not from east. Decide adjacent or opposite from the angle in your sketch.",
  },
  "sigma-notation-represent": {
    goal: "Choose the sigma notation that represents an arithmetic or geometric series listed by its first and last terms.",
    intuition:
      "Sigma notation $\\sum_{k=a}^{b}t(k)$ adds the terms $t(a), t(a+1), \\ldots, t(b)$. The rule $t(k)$ gives the term in each position, and the bounds say how many terms.",
    terms: ["sigma-notation", "index-summation"],
    method: [
      "Find the common difference $d$ or the common ratio $r$.",
      "Write the rule: first term plus $d(k-1)$, or first term times $r^{k-1}$, for an index starting at 1.",
      "Choose bounds that give the right number of terms.",
      "Check the first and last terms.",
    ],
    watch:
      "Count the terms. An index from 0 to $n$ has $n+1$ terms, and a rule with $k$ instead of $k-1$ shifts the first term.",
  },
  "infinite-geometric-sum": {
    goal: "Find the sum of an infinite geometric series when it exists, and recognize when the ratio is too large.",
    intuition:
      "If each term is a fraction of the one before, the terms shrink and the running total settles on one number. If the ratio is 1 or larger in size, the terms do not shrink and the total never settles.",
    terms: [
      [
        "geometric-series",
        "An infinite geometric series $a+ar+ar^2+\\cdots$ has no last term; it has a total only when $|r|<1$.",
      ],
      "common-ratio",
    ],
    method: [
      "Find the first term $a$ the series starts with, and the ratio $r$.",
      "Check $|r|<1$. If not, the series has no finite sum.",
      "Compute $\\frac{a}{1-r}$.",
    ],
    watch:
      "Use the first term that is actually in the sum, and check $|r|<1$ before using the formula.",
  },
  "polynomial-inequality-solve": {
    goal: "Choose the interval-notation solution of a polynomial inequality, including repeated roots and non-strict inequalities.",
    intuition:
      "A polynomial can change sign only at its zeros. Between consecutive zeros it stays positive or stays negative, so testing one number in each interval shows where the inequality holds.",
    terms: ["interval-notation", "multiplicity"],
    method: [
      "Factor completely and find the zeros.",
      "Test one number in each interval between zeros, and keep the intervals where the sign matches the inequality.",
      "Include a zero only if the inequality allows equality.",
      "Write the union of the intervals. A zero where equality holds but nearby values fail is a single point.",
    ],
    watch:
      "A squared factor does not change sign at its zero. A negative sign in front flips every interval.",
  },
  "rational-inequality-solve": {
    goal: "Choose the interval-notation solution of a rational inequality, excluding values that make the denominator zero.",
    intuition:
      "A fraction can change sign only where its numerator is 0 or its denominator is 0. Between these values it keeps one sign, so one test number in each interval is enough.",
    terms: ["excluded-value", "interval-notation"],
    method: [
      "Find the zeros of the numerator and of the denominator.",
      "Test one number in each interval and keep the intervals with the right sign.",
      "Include a numerator zero only if the inequality allows equality; never include a denominator zero.",
      "Write the union in interval notation.",
    ],
    watch:
      "A denominator zero always gets a parenthesis. Do not multiply both sides by an expression whose sign is unknown.",
  },
};

export const texasHsPrinciples: Record<string, string> = {
  "line-equation-forms":
    "The line through the point $(x_1, y_1)$ with slope $m$ is $y-y_1=m(x-x_1)$. Through two points, $m=\\frac{y_2-y_1}{x_2-x_1}$ when $x_1\\ne x_2$ (the $x$-values differ). The standard form $Ax+By=C$ has slope $-\\frac{A}{B}$ when $B\\ne0$.",
  "line-relationship-equations":
    "Two different lines that are not vertical (upright) are parallel when their slopes are equal. They are perpendicular when their slopes multiply to $-1$. A horizontal line is a flat line $y=c$. It has slope 0 and is perpendicular to every vertical line $x=k$. A vertical line has undefined slope.",
  "system-equation-choice":
    "An amount that changes at a steady rate $m$ from a starting value $b$ is modeled by $y=mx+b$. A pair $(x, y)$ that makes both equations true is called a solution of the system. When both equations give $y$ from $x$, it is where the two amounts are equal at the same $x$. Two lines with the same rate and different starting values never meet, so that system has no solution. Two counts $x$ and $y$ with total $T$, priced $p$ and $c$ each, with total value $V$, give $x+y=T$ and $px+cy=V$.",
  "graph-estimate-system-solution":
    "A solution of a system is an ordered pair $(x, y)$ that makes both equations true. For two lines that are not parallel, it is the single point where their graphs meet, and its coordinates can be read approximately from a graph.",
  "exponential-domain-range":
    "For $f(x)=a\\cdot b^x+k$ with $b>0$, $b\\ne1$ and $a\\ne0$, the domain is all real numbers. The range is $y>k$ if $a>0$, or $y<k$ if $a<0$; the line $y=k$ is the horizontal asymptote. A model restricted to $t\\ge0$ has range starting at $f(0)$, included: between $f(0)$ and the asymptote value if the outputs approach it, or from $f(0)$ outward if they grow away from it.",
  "absolute-value-equation-formulate":
    "For $d>0$, $|x-c|=d$ means $x=c+d$ or $x=c-d$: the two numbers at distance $d$ from $c$. Two solutions $x_1$ and $x_2$ have center $\\frac{x_1+x_2}{2}$ (halfway between them) and distance $\\frac{|x_1-x_2|}{2}$ from that center.",
  "rational-equation-formulate":
    "Distance equals speed times time, so time equals distance divided by speed. If two workers finish a job alone in $a$ and $b$ hours, then working together they finish in $x$ hours, where $\\frac{1}{a}+\\frac{1}{b}=\\frac{1}{x}$.",
  "rational-exponent-equation":
    "For $x^{p/q}=k$ in lowest terms with $q>0$, raising both sides to $\\frac{q}{p}$ gives $x=k^{q/p}$ when $p$ is odd. When $p$ is even, $x^{p/q}=k>0$ has solutions $x=\\pm k^{q/p}$, and when $q$ is even, $x^{p/q}$ is defined only for $x\\ge0$.",
  "transformation-composition-image":
    "The dilation with center $C$ and scale factor $k$ sends a point $P$ to $C+k(P-C)$. When transformations are done one after another, each acts on the previous result, and in general the order of a rigid motion and a dilation matters.",
  "counterexample-choice":
    "The statement “if $p$, then $q$” is false when some case has $p$ true and $q$ false. One such case, called a counterexample, is enough to refute (disprove) it. Cases where the statement holds do not prove it, unless every possible case is checked.",
  "spherical-geometry-compare":
    "On a sphere, lines are great circles. Any two meet, so there are no parallel lines. For a triangle smaller than half the sphere, the angle sum is greater than $180^\\circ$ and less than $540^\\circ$. The shortest path between two points is an arc of a great circle.",
  "regular-polygon-area":
    "A regular polygon with perimeter $p$ and apothem $a$ has area $A=\\frac12ap$. A regular hexagon with side $s$ has apothem $\\frac{s\\sqrt3}{2}$ and area $\\frac{3\\sqrt3}{2}s^2$, where $s^2$ means $s$ times $s$.",
  "curved-solid-surface-area":
    "A right circular cone (tip straight above the middle of its base) with radius $r$, height $h$ and slant height $\\ell=\\sqrt{r^2+h^2}$ has side area $\\pi r\\ell$ and base area $\\pi r^2$. A cylinder has side area $2\\pi rh$, and a hemisphere's curved surface is $2\\pi r^2$. The surface area of a joined (composite) solid counts only the outside surfaces.",
  "area-probability":
    "If a point is chosen at random, every spot equally likely, in a region of positive area $A$, the probability that it lies in a part of area $B$ is $\\frac{B}{A}$. The probability that it lies outside the part is $1-\\frac{B}{A}$.",
  "composition-order-choice":
    "$(f\\circ g)(x)=f(g(x))$ applies $g$ first. In general $f(g(x))\\ne g(f(x))$; for example, if $f(x)=2x$ and $g(x)=x+1$, then $f(g(x))=2x+2$ but $g(f(x))=2x+1$.",
  "one-sided-behavior-choice":
    "The notation $x\\to c^-$ means $x$ approaches $c$ through values less than $c$, and $x\\to c^+$ through values greater than $c$. At a vertical asymptote the two sides can approach $\\infty$ or $-\\infty$ independently; at a removable discontinuity both sides approach the same finite value; at a jump they approach different finite values.",
  "parametric-rectangular-convert":
    "A point $(x(t), y(t))$ traces a curve. Eliminating $t$ gives a rectangular equation; for $x=h+r\\cos t$ and $y=k+r\\sin t$, the identity $\\cos^2t+\\sin^2t=1$ gives $(x-h)^2+(y-k)^2=r^2$.",
  "angular-velocity-problem":
    "An angle of $\\theta$ radians on a circle of radius $r$ subtends arc length $s=r\\theta$. If a point turns at angular speed $\\omega$, its linear speed is $v=r\\omega$. One revolution is $2\\pi$ radians.",
  "reference-angle-standard-position":
    "An angle in standard position has its vertex at the origin and initial side on the positive $x$-axis. Angles differing by a multiple of $360^\\circ$ (or $2\\pi$) are coterminal. The reference angle of an angle not on an axis is the acute angle between its terminal side and the $x$-axis.",
  "bearing-trig-problem":
    "A trip of length $d$ on a bearing $B$, measured clockwise from north, has east component $d\\sin B$ and north component $d\\cos B$. A negative east component means west, and a negative north component means south.",
  "sigma-notation-represent":
    "$\\sum_{k=a}^{b}t(k)=t(a)+t(a+1)+\\cdots+t(b)$ has $b-a+1$ terms. An arithmetic series with first term $a_1$ and difference $d$ has terms $a_1+d(k-1)$, and a geometric series with ratio $r$ has terms $a_1r^{k-1}$.",
  "infinite-geometric-sum":
    "For $|r|<1$, $\\sum_{k=0}^{\\infty}ar^k=\\frac{a}{1-r}$, where $a$ is the first term. If $|r|\\ge1$ and $a\\ne0$, the partial sums do not approach a number, so the series has no finite sum.",
  "polynomial-inequality-solve":
    "A polynomial is continuous, so it can change sign only at a zero. Its sign changes at a zero of odd multiplicity and does not change at a zero of even multiplicity.",
  "rational-inequality-solve":
    "A rational expression is continuous where it is defined, so it can change sign only at a zero of the numerator or a zero of the denominator. Values that make the denominator 0 are never in the solution set.",
};

type LessonInput = {
  id: string;
  title: string;
  summary: string;
  templateIds: string[];
  objectives: string[];
  intuition: string[];
  example: { prompt: string; steps: string[]; answer: string };
  method: { title: string; paragraphs: string[] };
  formal: { title: string; paragraphs: string[] };
  pitfalls: string[];
  parentGuide: string;
  senses?: Lesson["senses"];
  noLink?: string[];
};
const lesson = (x: LessonInput): Lesson => ({
  id: x.id,
  title: x.title,
  summary: x.summary,
  templateIds: x.templateIds,
  objectives: x.objectives,
  sections: [
    { stage: "intuition", title: "The idea", paragraphs: x.intuition },
  ],
  workedExample: x.example,
  closingSections: [
    { stage: "method", title: x.method.title, paragraphs: x.method.paragraphs },
    { stage: "formal", title: x.formal.title, paragraphs: x.formal.paragraphs },
  ],
  pitfalls: x.pitfalls,
  parentGuide: x.parentGuide,
  ...(x.senses ? { senses: x.senses } : {}),
  ...(x.noLink ? { noLink: x.noLink } : {}),
});

export const texasHsLessons: Lesson[] = [
  lesson({
    id: "line-equations-from-conditions",
    title: "Write the equation of a line",
    summary:
      "On a grid, $x$ counts how far across and $y$ counts how far up. The slope of a line tells how steep it is: how much $y$ goes up when $x$ goes up by 1. One point on the line and the slope are enough to pin down the line. A line that is not vertical (straight up and down) can be written in three common ways, and each shows the same line. Two different non-vertical lines never meet, and are called parallel, exactly when their slopes are equal. Two lines that cross at a square corner are called perpendicular. When neither is vertical, their slopes are like $2$ and $-\\frac{1}{2}$: flip the fraction and change the sign.",
    senses: {
      "standard form": "standard-form-line",
      side: "side-of-equation",
      term: "term-expression",
      product: "product-multiply",
    },
    noLink: ["change", "changes", "factor", "square", "part"],
    templateIds: ["line-equation-forms", "line-relationship-equations"],
    objectives: [
      "Write a line's equation in point-slope, slope-intercept or standard form from a point and a slope, or from two points.",
      "Write the line through a point that is parallel or perpendicular to a given line, or parallel to an axis.",
    ],
    intuition: [
      "A point $(x, y)$ names a place on a grid: first how far across, then how far up. The slope of a line is the change in $y$ divided by the change in $x$ between two of its points. From $(1, 2)$ to $(3, 6)$, $y$ changes by 4 and $x$ changes by 2, so the slope is $4 \\div 2 = 2$. We call the slope $m$.",
      "A line is fixed by one point on it and its slope. Its equation can be written three ways. Slope-intercept form is $y = mx + b$, where $mx$ means $m$ times $x$ and $b$ is the $y$-intercept, the value of $y$ when $x = 0$. The form $y - y_1 = m(x - x_1)$ is called point-slope form, where $(x_1, y_1)$ (read “$x$ one, $y$ one”) is a known point. The form $Ax + By = C$ is called standard form. Here $A$, $B$ and $C$ are numbers, with $A$ and $B$ not both 0. They are usually integers (the numbers 0, 1, 2, 3, … and their negatives).",
      "Parallel lines point the same way and never meet. Two different lines that are not vertical are parallel exactly when they have the same slope. Perpendicular lines cross at a right angle, a square corner. If neither is vertical, their slopes are negative reciprocals: flip the fraction and change its sign. The negative reciprocal of 2 (which is $\\frac{2}{1}$) is $-\\frac{1}{2}$.",
      "A horizontal line is a line that runs flat, like the floor. It has slope 0 because $y$ never changes. A vertical line is a line that runs straight up and down. It has no slope (we say it is undefined), because $x$ does not change and we cannot divide by 0.",
    ],
    example: {
      prompt:
        "Write, in point-slope form, the line through $(1, 5)$ perpendicular to $y=2x-3$.",
      steps: [
        "Read the slope of the given line. In $y = 2x - 3$, the number multiplying $x$ is 2, so its slope is 2.",
        "A perpendicular line has the negative reciprocal slope. Flip 2 to get $\\frac{1}{2}$, then change the sign: $m = -\\frac12$.",
        "Put the point and slope into point-slope form, $y - y_1 = m(x - x_1)$, with $x_1 = 1$ and $y_1 = 5$. The equation is $y-5=-\\frac12(x-1)$.",
        "Check that the point is on the line. At $x = 1$, the right side, the part after the equals sign, is $-\\frac12 \\times 0 = 0$. So $y - 5 = 0$ and $y = 5$. The point $(1, 5)$ fits.",
      ],
      answer: "$y-5=-\\frac12(x-1)$",
    },
    method: {
      title: "Choose the form that fits the givens",
      paragraphs: [
        "With two points, find the slope first: change in $y$ divided by change in $x$, subtracting in the same order.",
        "With a point and a slope, point-slope form needs no solving. To get slope-intercept form, multiply out the parentheses, the curved brackets ( ). Then add $y_1$ to both sides. A term is one piece joined by + or −. To get standard form, multiply every term by a common denominator to clear fractions, then gather $x$ and $y$ on the left.",
        "For a parallel or perpendicular line, take the slope from the given line. If it is written $Ax + By = C$ with $B$ not 0, solve for $y$. Subtract $Ax$ from both sides and divide by $B$: $y = -\\frac{A}{B}x + \\frac{C}{B}$. So the slope is $-\\frac{A}{B}$.",
        "For a line parallel to an axis: parallel to the $x$-axis means horizontal, $y =$ the point's $y$-value. Parallel to the $y$-axis means vertical, $x =$ the point's $x$-value.",
      ],
    },
    formal: {
      title: "Slope conditions",
      paragraphs: [
        "Let two lines that are not vertical have slopes $m_1$ and $m_2$. Two different such lines are parallel exactly when $m_1 = m_2$. They are perpendicular exactly when $m_1 m_2 = -1$, which means the two slopes multiply to $-1$.",
        "The line $y = c$, for a number $c$, is horizontal. The line $x = k$ is vertical. Every horizontal line is perpendicular to every vertical line.",
      ],
    },
    pitfalls: [
      "Point-slope form subtracts the point's coordinates. The point $(-2, 3)$ gives $x - (-2) = x + 2$ and $y - 3$.",
      "A perpendicular slope needs both moves: flip the fraction and change the sign.",
      "Slope 0 is a horizontal line. An undefined slope is a vertical line.",
    ],
    parentGuide:
      "Ask the learner for the slope of the line $x=4$ and of the line $y=4$, and which one is horizontal.",
  }),
  lesson({
    id: "systems-from-representations",
    title: "Write and read a system of two lines",
    summary:
      "Many situations have an amount that starts somewhere and grows by the same amount each step. A gym plan costs 10 dollars to join plus 4 dollars a month. After $x$ months, its total cost $y$ is $y = 4x + 10$ dollars. Two such plans give two equations. Together they are called a system. On a graph, each plan is a line, and where the lines cross, the two costs are equal.",
    senses: { model: "model", side: "side-of-equation" },
    noLink: ["change", "changes", "mean", "balances"],
    templateIds: ["system-equation-choice", "graph-estimate-system-solution"],
    objectives: [
      "Write the system of two equations for two amounts that change at steady rates, from a story, tables or a graph.",
      "Estimate where two graphed lines meet, and say what that point means.",
    ],
    intuition: [
      "A variable is a letter that stands for a number. In $y = 4x + 10$, $x$ is the number of months and $y$ is the total cost. Writing $4x$ means 4 times $x$.",
      "The rate is how much the amount grows for each step, here 4 dollars a month. It multiplies $x$. The starting value is the amount when $x = 0$, here the 10-dollar joining fee. It is the number added on. So a steady amount is $y = mx + b$: rate $m$ times $x$, plus starting value $b$.",
      "A system of equations is two or more equations about the same variables at once. A solution of the system is a pair of values, written $(x, y)$, that makes every equation true.",
      "Each equation's graph is a straight line. Where the two lines cross, both equations have the same $x$ and the same $y$. In the gym story, that is the month when both plans cost the same.",
    ],
    example: {
      prompt:
        "Plan A costs 10 dollars to join plus 4 dollars a month. Plan B costs 4 dollars to join plus 6 dollars a month. Write the system and estimate when the costs are equal.",
      steps: [
        "Write each plan as rate times months plus starting fee. Plan A: $y=4x+10$. Plan B: $y=6x+4$.",
        "The costs are equal when the two right sides are equal: $4x+10=6x+4$. Subtract $4x$ and 4 from both sides: $2x=6$. Divide both sides by 2: $x=3$.",
        "Find the cost at 3 months, using either plan: $4 \\times 3 + 10 = 22$ dollars. Check with Plan B: $6 \\times 3 + 4 = 22$.",
        "On a graph, the two lines would cross at the point $(3, 22)$: 3 months, 22 dollars.",
      ],
      answer: "$y=4x+10$ and $y=6x+4$; equal at $(3, 22)$",
    },
    method: {
      title: "Read rates and starting values",
      paragraphs: [
        "From a table: the change from one row to the next, when $x$ goes up by 1, is the rate. The value at $x = 0$ is the starting value.",
        "From a graph: where the line crosses the vertical axis is the starting value. Rise over run, how far up for each step across, is the rate.",
        "From a story about two kinds of item: write one equation for the total count and one for the total value, multiplying each count by its price. Keep each fee with its own rate.",
        "To estimate a crossing on a graph, find where the lines meet. Read $x$ on the horizontal axis and $y$ on the vertical axis. The point may fall between grid lines.",
      ],
    },
    formal: {
      title: "Solutions of a system",
      paragraphs: [
        "A solution of a system is an ordered pair $(x, y)$ that makes every equation true.",
        "Two lines with different slopes (different rates) meet at exactly one point. That point is the solution of the system.",
      ],
    },
    pitfalls: [
      "Keep the rate and the starting value of the same plan together in one equation.",
      "The starting value is the value at $x = 0$. A table may begin at $x = 1$, so do not read its first row as the starting value.",
      "Report the point as $(x, y)$, with the input, the number you choose, first.",
    ],
    parentGuide:
      "Ask the learner what the starting value and the rate mean in a story with a sign-up fee and a monthly charge.",
  }),
  lesson({
    id: "exponential-domain-and-range",
    title: "Domain and range of exponential functions",
    summary:
      "In $2^3$, the small raised 3 says how many 2s to multiply: $2 \\times 2 \\times 2 = 8$. A function is a rule that turns each input into one output. In $2^x$, the input $x$ is the raised number, called the exponent. That makes $2^x$ an exponential function. The domain is the set of inputs you may use, and the range is the set of outputs you can get. For $2^x$, any input works, but the outputs are always above 0 and never reach it.",
    senses: {
      term: "term-expression",
      boundary: "boundary",
      base: "base-exponent",
      range: "range-function",
      model: "model",
    },
    noLink: ["side", "rule", "mean"],
    templateIds: ["exponential-domain-range"],
    objectives: [
      "Write the domain (allowed inputs) and range (possible outputs) of an exponential function as inequalities.",
      "Restrict the domain for a real-world model that starts at time $t=0$.",
    ],
    intuition: [
      "In $2^x$, the 2 is the base and $x$ is the exponent. When $x$ is a counting number, the exponent says how many 2s to multiply. So $2^3 = 8$ and $2^1 = 2$. By agreement $2^0 = 1$, and a negative exponent means divide: $2^{-1} = \\frac{1}{2}$. A positive base can also be raised to a fraction, so $2^x$ has a value for every real number $x$. A real number is any number on the number line.",
      "We often name a function $f$ and write $f(x)$, read “$f$ of $x$,” for its output at input $x$.",
      "Look at the outputs of $2^x$: … $\\frac{1}{4}$, $\\frac{1}{2}$, 1, 2, 4, 8, …. They are always positive. As $x$ goes far to the left, they get closer and closer to 0 but never reach it. The line $y = 0$ that the graph creeps toward is called a horizontal asymptote. This line is also called the boundary.",
      "Changing the function can flip the graph or move the boundary. Multiplying by a negative number, as in $-3(2)^x$, flips the outputs below 0. Adding a number $k$ moves the boundary to $y = k$. So the range is everything on one side of $k$, never $k$ itself.",
      "We write these sets with inequalities. $y < 4$ means “$y$ is less than 4.” The symbols $-\\infty < x < \\infty$ mean $x$ can be any real number; $\\infty$ (infinity) means “without end.”",
    ],
    example: {
      prompt: "Find the domain and range of $f(x)=-3(2)^x+4$ as inequalities.",
      steps: [
        "Domain: $2^x$ has a value for every real $x$, and multiplying and adding never fail. So every input is allowed: $-\\infty<x<\\infty$.",
        "Start from $2^x$, which is always greater than 0: $2^x > 0$. Multiplying by $-3$ makes it always less than 0: $-3(2)^x<0$.",
        "Adding 4 moves everything up by 4, so $f(x)<4$. The output gets close to 4 but never equals it, so the range is $y < 4$.",
      ],
      answer: "Domain $-\\infty<x<\\infty$; range $y<4$",
    },
    method: {
      title: "Boundary, side and strictness",
      paragraphs: [
        "The domain is all real numbers, unless the situation limits the input.",
        "The boundary of the range is the number added at the end, $k$. The sign of the number in front of the power picks the side: positive means above $k$, negative means below.",
        "The boundary is never reached, so use $<$ or $>$, not $\\le$ or $\\ge$.",
        "A model is an equation that stands for a real situation. In a model of time that starts at $t = 0$, the domain is usually $t \\ge 0$, read “$t$ is greater than or equal to 0.” If the situation ends at some time, that also limits $t$ from above. The starting value $f(0)$ is then a real output, so the range starts at $f(0)$ and includes it. If the outputs shrink toward the boundary, the range lies between $f(0)$ and the boundary. If they grow away from it, the range goes from $f(0)$ outward, without end if time has no end.",
      ],
    },
    formal: {
      title: "The exponential function",
      paragraphs: [
        "Let $b$ be a positive number other than 1. The function $b^x$ has domain all real numbers and range $y > 0$.",
        "For a number $a \\ne 0$ and any number $k$, the function $a \\cdot b^x + k$ has range $y > k$ if $a > 0$, and $y < k$ if $a < 0$.",
      ],
    },
    pitfalls: [
      "Do not limit $x$ to positive numbers. Every real input works for an exponential function.",
      "Use a strict sign, $<$ or $>$, at the boundary, because it is never an output.",
      "A negative number in front flips the range to below the boundary.",
    ],
    parentGuide:
      "Ask the learner to list $2^x$ for $x = 3, 2, 1, 0, -1, -2$, and say why it never reaches 0 or goes negative.",
  }),
  lesson({
    id: "equations-from-situations",
    title: "Write equations from situations",
    summary:
      "Some stories turn into special equations. A number line is a line with numbers marked in order, evenly spaced. The absolute value of a number is its distance from 0 on the number line, so the absolute value of $-3$ is 3. We write $|x - c|$, read “the absolute value of $x$ minus $c$,” for the distance between $x$ and $c$. So $|x - 5| = 3$ means “3 away from 5,” which is 2 or 8. Work and travel stories turn into equations with the unknown in the bottom of a fraction, such as $\\frac{1}{3} + \\frac{1}{6} = \\frac{1}{x}$.",
    senses: {
      unit: "unit",
      difference: "difference-subtract",
      model: "model",
    },
    noLink: ["center", "part", "parts", "whole", "change", "side"],
    templateIds: [
      "absolute-value-equation-formulate",
      "rational-equation-formulate",
    ],
    objectives: [
      "Write $|x-c|=d$ for the numbers a given distance $d$ from a middle number $c$.",
      "Write equations with fractions for work-together and travel stories.",
    ],
    intuition: [
      "The absolute value of a number is its distance from 0, so $|-4| = 4$ and $|4| = 4$. In the same way, $|x - c|$ is the distance between $x$ and $c$ on the number line.",
      "So $|x - c| = d$ asks for every number exactly $d$ away from $c$. When $d$ is greater than 0, there are two: one $d$ above $c$ and one $d$ below. (If $d$ is 0, the only answer is $c$.) The number $c$ is called the center, because it sits halfway between them. For $|x - 5| = 3$, the answers are $5 + 3 = 8$ and $5 - 3 = 2$.",
      "A rate is an amount per unit of time, such as $\\frac{1}{3}$ of a pool per hour. A pipe that fills a pool in 3 hours, at a steady rate, fills $\\frac{1}{3}$ of it each hour. In general, a worker who works at a steady pace and finishes a job in $h$ hours does $\\frac{1}{h}$ of the job per hour.",
      "For travel, distance equals speed times time. So time equals distance divided by speed: 12 miles at 4 miles per hour takes $12 \\div 4 = 3$ hours. When the unknown is in the bottom of a fraction, the equation is called a rational equation.",
    ],
    example: {
      prompt:
        "Two pipes fill a pool in 3 hours and 6 hours alone. Write an equation for the hours $x$ they take together.",
      steps: [
        "Write each pipe's rate. The first fills the pool in 3 hours, so it fills $\\frac13$ of the pool per hour. The second fills $\\frac16$ per hour.",
        "Together they fill the pool in $x$ hours, so together they fill $\\frac{1}{x}$ of it per hour.",
        "When both run at once, their work in one hour adds up. So the rates add: $\\frac13+\\frac16=\\frac1x$.",
        "Check by solving: $\\frac13 + \\frac16 = \\frac26 + \\frac16 = \\frac36 = \\frac12$, so $x = 2$ hours. That is faster than either pipe alone, which makes sense.",
      ],
      answer: "$\\frac13+\\frac16=\\frac1x$",
    },
    method: {
      title: "Name what each piece measures",
      paragraphs: [
        "For absolute value, find the center $c$ and the distance $d$, then write $|x - c| = d$. If you are given the two answers, the center is halfway between them, and $d$ is the distance from the center to either one.",
        "A center of $-3$ gives $|x - (-3)| = |x + 3|$.",
        "For a rational equation, decide whether each fraction is a rate or a time. Rates add for workers who work at the same time. Times add for separate parts of one trip.",
        "For a boat on a river, the current adds to the speed going with it and subtracts going against it. A boat at speed $s$ in a current of 2 takes $\\frac{12}{s + 2}$ hours to go 12 miles downstream.",
      ],
    },
    formal: {
      title: "Distance and rate",
      paragraphs: [
        "For $d > 0$, $|x - c| = d$ exactly when $x = c + d$ or $x = c - d$. This is often written $x = c \\pm d$. The sign $\\pm$ stands for “plus or minus”: add, and also subtract.",
        "For a constant speed $r$, distance $= r \\times$ time, so time $= \\frac{\\text{distance}}{r}$.",
        "If two workers finish alone in $a$ and $b$ hours, together they finish in $x$ hours where $\\frac{1}{a} + \\frac{1}{b} = \\frac{1}{x}$.",
      ],
    },
    pitfalls: [
      "A center of $-4$ gives $|x+4|$, because $x - (-4) = x + 4$.",
      "The number on the right of $|x - c| = d$ is the distance, not the center.",
      "Do not add the hours of two workers; add their rates.",
    ],
    parentGuide:
      "Ask the learner how far apart 2 and 8 are, and which number is halfway between them.",
  }),
  lesson({
    id: "rational-exponent-equations",
    title: "Solve equations with rational exponents",
    summary:
      "Raise both sides to the reciprocal power, and check which signs are possible.",
    templateIds: ["rational-exponent-equation"],
    objectives: [
      "Solve $x^{p/q}=k$ and decide whether $x$ can be negative.",
      "Check each candidate in the original equation.",
    ],
    intuition: [
      "The exponent $\\frac{3}{2}$ means: take the square root, then cube. To undo it, take the cube root and then square, which is raising to the power $\\frac23$.",
      "An even power cannot tell $x$ from $-x$, so it can give two solutions. An even root is defined only for $x\\ge0$.",
    ],
    example: {
      prompt: "Solve $x^{3/2}=27$.",
      steps: [
        "Raise both sides to $\\frac23$: $x=27^{2/3}$.",
        "$27^{1/3}=3$ and $3^2=9$, so $x=9$.",
        "Check: $9^{3/2}=(\\sqrt9)^3=27$. The exponent has an even root, so $x\\ge0$ and $-9$ is not allowed.",
      ],
      answer: "$x=9$",
    },
    method: {
      title: "Reciprocal power, then sign cases",
      paragraphs: [
        "Raise both sides to $\\frac{q}{p}$. If the numerator $p$ is even and the right side is positive, give both $\\pm$ values; for example $x^{2/3}=4$ gives $x=\\pm8$. If the denominator is even, keep only nonnegative $x$.",
      ],
    },
    formal: {
      title: "Why the reciprocal works",
      paragraphs: [
        "For $x\\ge0$, $\\left(x^{p/q}\\right)^{q/p}=x^{1}=x$ because exponents multiply. For negative $x$ with odd $q$, $x^{p/q}=(\\sqrt[q]{x})^p$, which is negative when $p$ is odd and positive when $p$ is even.",
      ],
    },
    pitfalls: [
      "Raise to the reciprocal; do not multiply by it.",
      "Test each candidate in the original equation.",
    ],
    parentGuide: "Ask the learner to compute $8^{2/3}$ in two steps.",
  }),
  lesson({
    id: "compose-transformations",
    title: "Rigid motions followed by dilations",
    summary:
      "A transformation is a change that moves or resizes a shape on a grid. A rigid motion slides, flips or turns it without changing its size. A dilation resizes it from a fixed center point: every distance from the center is multiplied by the same number. When two transformations are done one after another, do them in the order given. The second step starts from where the first one left the point.",
    senses: { image: "image-transformation", unit: "unit" },
    noLink: ["center", "scale", "scales", "change", "changes"],
    templateIds: ["transformation-composition-image"],
    objectives: [
      "Find where a point lands after a rigid motion and then a dilation, even when the dilation's center is not $(0, 0)$.",
      "Apply the two steps in the stated order.",
    ],
    intuition: [
      "A point on a grid is written $(x, y)$: how far across, then how far up. The point $(0, 0)$, where the axes cross, is called the origin.",
      "A rigid motion moves a figure without stretching it. A slide is called a translation, a flip is a reflection and a turn is a rotation. Reflecting across the $y$-axis (the up-down axis) changes the sign of $x$: $(2, 3)$ goes to $(-2, 3)$.",
      "A dilation resizes a figure from a fixed point called the center of dilation. The scale factor says how much: 2 doubles every distance from the center, and $\\frac{1}{2}$ halves it. The center stays put. Every other point moves along a straight line away from or toward the center, unless the scale factor is 1.",
      "The point a transformation produces is called the image. We often add a small mark, so the image of $P$ is written $P'$. The mark is called “prime,” so $P'$ is read “$P$ prime.”",
      "The coordinates are the two numbers $x$ and $y$ that name a point. If the center is the origin, multiply both coordinates by the scale factor. If the center is somewhere else, measure from the center instead. Find how far the point is from the center, multiply that, then add the center back.",
    ],
    example: {
      prompt:
        "Reflect $A=(2, 3)$ across the $y$-axis, then dilate with center $(1, 1)$ and scale factor 2.",
      steps: [
        "Do the reflection first, as stated. Reflecting across the $y$-axis changes the sign of $x$: $(2, 3)$ becomes $(-2, 3)$.",
        "Measure from the center $(1, 1)$. Subtract it: $(-2 - 1, 3 - 1) = (-3, 2)$. So the point is 3 left of and 2 above the center.",
        "Multiply that distance by the scale factor 2: $(-6, 4)$. Now it is twice as far from the center, in the same direction.",
        "Add the center back to return to grid positions: $(-6 + 1, 4 + 1) = (-5, 5)$.",
      ],
      answer: "$(-5, 5)$",
    },
    method: {
      title: "Scale from the center",
      paragraphs: [
        "Do the steps in the order given. The same two steps in the other order can give a different point.",
        "Apply a rigid motion straight to the coordinates.",
        "For a dilation with center $C$ and scale factor $k$, use $P' = C + k(P - C)$. In words: subtract the center, multiply by $k$, add the center back.",
      ],
    },
    formal: {
      title: "Dilation formula",
      paragraphs: [
        "A dilation with center $C$ and scale factor $k > 0$ keeps $C$ fixed and sends each other point $P$ to the point $P'$ on ray $CP$ (the half-line from $C$ through $P$). Its distance from the center is $CP' = k \\times CP$. In coordinates, $P' = C + k(P - C)$.",
        "A dilation keeps every angle the same and multiplies every length by $k$. A rigid motion keeps both angles and lengths the same.",
      ],
    },
    pitfalls: [
      "Subtract the center before scaling, and add it back after. Multiplying the coordinates directly only works when the center is $(0, 0)$.",
      "Do the steps in the order stated. Use the result of the first step as the start of the second.",
    ],
    parentGuide:
      "Ask the learner what a dilation with scale factor 1 does, and what scale factor 2 does to a point 3 units from the center.",
  }),
  lesson({
    id: "counterexamples",
    title: "Refute a conjecture with a counterexample",
    summary:
      "A conjecture is a guess that something is always true. Here is one: if a shape has four equal sides, then it is a square. (A square has four equal sides and four square corners.) To show a conjecture is false, you need only one case where the “if” part is true and the “then” part is false. That case is called a counterexample. A rhombus is a shape with four equal sides, like a tilted diamond. One with no square corners is a counterexample here.",
    senses: {
      square: "square-shape",
      side: "side",
      product: "product-multiply",
      degree: "degree-angle",
      unit: "unit",
    },
    noLink: ["legs", "part", "parts", "third"],
    templateIds: ["counterexample-choice"],
    objectives: [
      "Pick the case that disproves a geometry conjecture (a claim that something is always true).",
      "Explain why a case where the “if” part is false does not disprove the conjecture.",
    ],
    intuition: [
      "Many conjectures have the form “if $p$, then $q$,” where $p$ and $q$ are statements. The part after “if” is the hypothesis. The part after “then” is the conclusion. The conjecture claims: every time $p$ is true, $q$ is true too.",
      "To show the claim is false, you need just one case where $p$ is true but $q$ is false. That case is a counterexample. One is enough, because the claim said “every time.”",
      "Other cases do not help. A case where $p$ is false does not test the claim at all, because the claim only talks about cases where $p$ holds. A case where both are true agrees with the claim, but agreeing examples do not prove it for every case, unless they check every possible case.",
    ],
    example: {
      prompt:
        "Conjecture: if a quadrilateral has four equal sides, then it is a square. Find a counterexample.",
      steps: [
        "A quadrilateral is a shape with four straight sides. Split the conjecture into parts. The hypothesis is “it has four equal sides.” The conclusion is “it is a square,” which means four equal sides and four right angles (square corners).",
        "Find a shape where the hypothesis is true. A rhombus is a quadrilateral with four equal sides. One with angles of $60^\\circ$ and $120^\\circ$ works. Here $^\\circ$ means degrees, the unit for angles, and a right angle is $90^\\circ$.",
        "Check that the conclusion is false. Its angles are $60^\\circ$ and $120^\\circ$, not $90^\\circ$, so it is not a square. The hypothesis is true and the conclusion is false, so it is a counterexample.",
      ],
      answer: "A rhombus with angles $60^\\circ$ and $120^\\circ$",
    },
    method: {
      title: "Test both parts",
      paragraphs: [
        "Split the conjecture into its hypothesis (the “if” part) and its conclusion (the “then” part).",
        "For each choice, first ask whether the hypothesis is true. Throw out the choices where it is false.",
        "Among the rest, pick the one where the conclusion is false. That is the counterexample.",
      ],
    },
    formal: {
      title: "Logic of refutation",
      paragraphs: [
        "To refute a statement means to show it is false. The statement “if $p$, then $q$” is false exactly when some case has $p$ true and $q$ false.",
        "Examples where the statement holds, however many, do not prove it for all cases, unless they cover every possible case.",
      ],
    },
    pitfalls: [
      "Do not choose a case where the “if” part is false. It does not test the conjecture.",
      "Do not choose a case where both parts are true. It agrees with the conjecture.",
    ],
    parentGuide:
      "Ask the learner for a counterexample to “if an animal has four legs, then it is a dog.”",
  }),
  lesson({
    id: "spherical-geometry",
    title: "Geometry on a sphere",
    summary:
      "Flat geometry happens on a plane, a flat surface that goes on forever. A sphere is the surface of a ball, like the Earth. On a sphere, the straightest paths are great circles: the biggest circles you can draw, like the equator, the circle around the middle of the Earth. Treat great circles as the “lines” of the sphere. Then some flat facts change. There are no parallel lines, lines that never meet. A degree is one 360th of a full turn, written $1^\\circ$. A triangle's three corner angles add to more than $180^\\circ$, not exactly $180^\\circ$.",
    senses: {
      plane: "plane",
      vertex: "vertex",
      side: "side",
      center: "center",
      "more than": "more-than",
      degree: "degree-angle",
      unit: "unit",
    },
    noLink: ["opposite", "quarter", "change", "changes", "square", "third"],
    templateIds: ["spherical-geometry-compare"],
    objectives: [
      "Compare parallel lines, triangle angle sums, right angles and shortest paths on a flat plane and on a sphere.",
      "Say which flat-geometry facts about parallel lines and angle sums change on a sphere.",
    ],
    intuition: [
      "A sphere is the surface of a ball. Every point on it is the same distance from one middle point, called the center. The unit for measuring angles is the degree, written $^\\circ$. A right angle, a square corner, is $90^\\circ$.",
      "A great circle is a circle on the sphere whose center is the center of the sphere. The equator is one. So is a full circle through both poles, made of a line of longitude and its matching line around the back of the globe. Great circles are the straightest paths on a sphere, so they play the role of lines.",
      "On a flat plane, parallel lines never meet. On a sphere, any two great circles cross. They meet at two points, directly across the sphere from each other. So a sphere has no parallel lines.",
      "On a flat plane, a triangle's three angles always add to $180^\\circ$. On a sphere, they add to more than $180^\\circ$. A sphere triangle can even have three right angles.",
      "The shortest path between two points on a sphere runs along a great circle, taking the shorter of its two arcs. (For two points directly opposite each other, both halves are equally short.) That is why long airplane routes look curved on a flat map.",
    ],
    example: {
      prompt:
        "A triangle has its vertex at the north pole and two vertices on the equator a quarter of the way around from each other. What are its angles?",
      steps: [
        "A vertex is a corner of the triangle. Two sides run from the north pole down lines of longitude to the equator. The third side runs along the equator.",
        "Lines of longitude cross the equator at right angles. So the two angles on the equator are each $90^\\circ$.",
        "At the pole, the two longitudes are a quarter of a full turn apart. A full turn is $360^\\circ$, and a quarter of it is $360^\\circ \\div 4 = 90^\\circ$. So the angle at the pole is $90^\\circ$.",
        "The angles add to $90^\\circ + 90^\\circ + 90^\\circ = 270^\\circ$, which is more than the plane's $180^\\circ$.",
      ],
      answer: "$90^\\circ$, $90^\\circ$, $90^\\circ$",
    },
    method: {
      title: "Use great circles",
      paragraphs: [
        "Replace “line” with “great circle.” Then ask how the plane fact changes.",
        "Parallel lines: none, because every two great circles meet. Triangle angle sums: more than $180^\\circ$, and less than $540^\\circ$ for a triangle smaller than half the sphere. Shortest paths: along the shorter arc of a great circle.",
      ],
    },
    formal: {
      title: "Spherical and Euclidean geometry",
      paragraphs: [
        "Euclidean geometry is the geometry of the flat plane. There, through a point not on a line, exactly one line is parallel to it, and a triangle's angles add to $180^\\circ$.",
        "Spherical geometry is the geometry of the sphere, with great circles as lines. It has no parallel lines, and triangle angle sums are more than $180^\\circ$. The larger the triangle, the larger the extra amount above $180^\\circ$; its area is proportional to that extra amount.",
      ],
    },
    pitfalls: [
      "A circle of latitude other than the equator is not a great circle, so it is not a line of the sphere.",
      "Angle sums below $180^\\circ$ never happen on a sphere. They belong to saddle-shaped surfaces.",
      "Do not carry flat-plane facts over to the sphere without checking them.",
    ],
    parentGuide:
      "Look at a globe together. Ask why airplane routes between distant cities look curved on a flat map.",
  }),
  lesson({
    id: "regular-polygon-area",
    title: "Area of a regular polygon",
    summary:
      "A polygon is a flat shape with straight sides. It is regular when all its sides are equal and all its corner angles are equal, like a stop sign. Lines from its middle point to each corner cut it into matching triangles, three-sided shapes. Each triangle's height is the apothem, the distance from the middle straight to the middle of a side. Area is the flat space inside, and the perimeter is the distance around. Adding the triangles gives area = half × apothem × perimeter.",
    senses: { side: "side", vertex: "vertex" },
    noLink: ["center", "square", "squared", "base", "part", "whole", "factor"],
    templateIds: ["regular-polygon-area"],
    objectives: [
      "Use $A = \\frac12 ap$ (half the apothem times the perimeter) to find an area, or a missing apothem or side.",
      "Find the apothem of a regular hexagon from its side length.",
    ],
    intuition: [
      "A regular polygon has equal sides and equal angles. A regular hexagon has 6 equal sides. Its perimeter is the distance all the way around: the number of sides times the side length.",
      "The center is the point in the middle, the same distance from every corner. A corner is called a vertex (plural vertices). Draw a line from the center to each vertex. That cuts the polygon into identical triangles, one for each side.",
      "The apothem is the distance from the center straight to the midpoint (middle) of a side. It meets the side at a right angle, a square corner of $90^\\circ$. So it is the height of each triangle, with the side as the triangle's bottom.",
      "A triangle's area is $\\frac{1}{2}$ × bottom × height. Each triangle is $\\frac12 \\times$ side $\\times$ apothem. Add all of them: $\\frac12 \\times$ apothem $\\times$ (all the sides together), which is $\\frac12 \\times$ apothem $\\times$ perimeter.",
      "For a number 0 or greater, its square root is the number, 0 or greater, that times itself gives it. The symbol $\\sqrt{3}$ means the square root of 3. So $\\sqrt{3}$ times $\\sqrt{3}$ is 3, and $\\sqrt{3}$ is about 1.73.",
    ],
    example: {
      prompt: "Find the area of a regular hexagon with side 4 cm.",
      steps: [
        "Cut the hexagon into 6 triangles from the center. In a regular hexagon, each one has all three sides equal to 4 cm, an equilateral triangle.",
        "The apothem is the height of one triangle. It splits the triangle into two halves with angles $30^\\circ$, $60^\\circ$ and $90^\\circ$. In such a half, the short side is 2 and the longest side is 4, so the height is $2\\sqrt3$ cm. Check: $2^2 + (2\\sqrt3)^2 = 4 + 12 = 16 = 4^2$.",
        "The perimeter is 6 sides times 4 cm: $6\\times4=24$ cm.",
        "Use area = half × apothem × perimeter: $A=\\frac12 \\times 2\\sqrt3 \\times 24 = 24\\sqrt3$ square centimeters.",
      ],
      answer: "$24\\sqrt3$ square centimeters",
    },
    method: {
      title: "Perimeter, apothem, one half",
      paragraphs: [
        "Find the perimeter: number of sides times side length.",
        "Find or read the apothem. For a regular hexagon with side $s$, the apothem is $\\frac{s\\sqrt3}{2}$.",
        "Use $A = \\frac12 ap$, where $a$ is the apothem and $p$ is the perimeter. To find a missing apothem or side, put in what you know and solve for the unknown.",
      ],
    },
    formal: {
      title: "The area formula",
      paragraphs: [
        "A regular polygon with $n$ sides of length $s$ and apothem $a$ splits into $n$ triangles, each of area $\\frac12 sa$. So its area is $A = n \\times \\frac12 sa = \\frac12 a(ns) = \\frac12 ap$, because the perimeter is $p = ns$.",
        "A regular hexagon with side $s$ has apothem $\\frac{s\\sqrt3}{2}$ and area $\\frac{3\\sqrt3}{2}s^2$, where $s^2$ means $s$ times $s$.",
      ],
    },
    pitfalls: [
      "Use the whole perimeter in the formula, not one side.",
      "Keep the $\\frac12$.",
      "The apothem is not the side length, and it is not the distance to a corner.",
    ],
    parentGuide:
      "Ask the learner to cut a paper regular hexagon into six triangles and describe one of them.",
  }),
  lesson({
    id: "composite-surface-area",
    title: "Surface area of cones and composite solids",
    summary:
      "Area is the amount of flat space a surface covers. A solid is a shape that takes up space, like a can. Surface area is the total area of the outside of a solid, the parts you could paint. A solid made by joining simple solids, like a cylinder (a can shape) with a dome on top, is called a composite solid. Where two solids are joined, the touching surfaces are hidden inside, so they are not counted. Add the outside surfaces only.",
    senses: {
      base: "base-shape",
      edge: "edge",
      face: "face-solid",
      solid: "solid-shape",
    },
    noLink: ["side", "square", "part", "parts", "center", "squared", "whole"],
    templateIds: ["curved-solid-surface-area"],
    objectives: [
      "Find the surface area of a cone and of solids joined to a cylinder.",
      "Leave out the surfaces where two solids are joined.",
    ],
    intuition: [
      "A cylinder is a can shape: two circles joined by a curved wall. A cone is a party-hat shape: a circle base with a curved wall rising to a point. A hemisphere is half of a ball, a dome.",
      "Each piece has an area formula. Here $r$ is the radius, the distance from the center of the circle to its edge, and $\\pi$ (pi) is about 3.14. A circle has area $\\pi r^2$, where $r^2$ ($r$ squared) means $r$ times $r$. A cylinder's curved wall, $h$ tall, has area $2\\pi rh$. A hemisphere's curved surface has area $2\\pi r^2$, half of a ball's $4\\pi r^2$.",
      "The slant height is the distance from a cone's tip down its wall to the edge of the base. Call it $\\ell$. For a right circular cone, one whose tip is straight above the center of its circle base, the curved wall has area $\\pi r\\ell$. If you only know the straight-up height $h$, the radius, height and slant height form a triangle with a square corner. A triangle with a $90^\\circ$ corner is called a right triangle. So $\\ell = \\sqrt{r^2 + h^2}$. The sign $\\sqrt{\\ }$ means square root: the number, 0 or greater, that times itself gives the number under the sign.",
      "When solids are joined, the surfaces that touch are covered. When a dome's flat circle exactly matches a cylinder's top, the dome covers that top, and the dome's own flat bottom is hidden too.",
    ],
    example: {
      prompt:
        "A cylinder of radius 3 cm and height 5 cm has a hemisphere of radius 3 cm on top. Find the outside surface area.",
      steps: [
        "List the outside surfaces: the bottom circle, the cylinder's curved wall and the dome's curved surface. The cylinder's top is covered by the dome, so it is left out.",
        "Bottom circle: $\\pi \\times 3^2 = 9\\pi$.",
        "Cylinder wall: $2\\pi \\times 3 \\times 5 = 30\\pi$.",
        "Dome, half of a ball: $2\\pi \\times 3^2 = 18\\pi$.",
        "Add the outside surfaces: $9\\pi+30\\pi+18\\pi=57\\pi$ square centimeters.",
      ],
      answer: "$57\\pi$ square centimeters",
    },
    method: {
      title: "List, then add",
      paragraphs: [
        "List every outside surface first. Leave out any part of a surface that is covered where two solids touch.",
        "Use $\\pi r^2$ for a flat circle, $2\\pi rh$ for a cylinder's wall, $\\pi r\\ell$ for a cone's wall and $2\\pi r^2$ for a dome.",
        "For a right circular cone, use the slant height $\\ell$. If you know the radius $r$ and height $h$ but not $\\ell$, find $\\ell = \\sqrt{r^2 + h^2}$ first.",
      ],
    },
    formal: {
      title: "Surface area formulas",
      paragraphs: [
        "Right circular cone (tip straight above the center of the base) with radius $r$, height $h$ and slant height $\\ell = \\sqrt{r^2 + h^2}$: side area $\\pi r\\ell$. The base area, the area of its flat circle, is $\\pi r^2$.",
        "Cylinder: side area $2\\pi rh$. Sphere: $4\\pi r^2$, so a hemisphere's curved surface is $2\\pi r^2$.",
        "The surface area of a composite solid counts only the surfaces on the outside.",
      ],
    },
    pitfalls: [
      "Do not count surfaces where two solids are joined.",
      "Use the slant height, not the straight-up height, for a cone's curved wall.",
      "A dome's curved surface is $2\\pi r^2$, half of a whole ball, not $4\\pi r^2$.",
    ],
    parentGuide:
      "Ask the learner which surfaces of a toy rocket, a cylinder with a cone on top, are on the outside.",
  }),
  lesson({
    id: "area-probability",
    title: "Probability from area",
    summary:
      "Probability is a number from 0 to 1 that tells how likely something is. Area is the amount of flat space a shape covers. Throw a dart that is equally likely to land anywhere on a board. The chance it lands in one part is that part's area divided by the board's whole area. If a circle covers $\\frac{1}{4}$ of the board's area, the chance of hitting it is $\\frac{1}{4}$.",
    senses: {
      part: "part",
      whole: "whole",
      square: "square-shape",
      side: "side",
      center: "center",
      "more than": "more-than",
      unit: "unit",
    },
    noLink: ["base", "squared", "edge"],
    templateIds: ["area-probability"],
    objectives: [
      "Find a probability by dividing the area of a part by the area of the whole region.",
      "Find the chance of landing outside a part by subtracting from 1.",
    ],
    intuition: [
      "Area is the amount of flat space a shape covers. It is counted in square units: a square unit is a square 1 unit on each side, such as a square centimeter.",
      "Picture a dart that lands at a random spot, with every spot equally likely. A part that covers more area gets hit more often. So the chance of landing in a part is the fraction of the total area it covers: part area divided by whole area.",
      "A square 10 cm on each side has area $10 \\times 10 = 100$ square centimeters. A circle's middle point is called the center. A circle with radius $r$ (the distance from its center to its edge) has area $\\pi r^2$. Here $\\pi$ (pi) is about 3.14 and $r^2$ means $r$ times $r$.",
      "The chance of missing the part is 1 minus the chance of hitting it, because the dart must land either inside or outside.",
    ],
    example: {
      prompt:
        "A dart lands at random on a 10 cm by 10 cm square. A circle of radius 2 cm is inside it. What is the probability it lands in the circle?",
      steps: [
        "Find the whole region's area. The square is 10 by 10, so its area is $100$ square centimeters.",
        "Find the target's area. The circle has radius 2, so its area is $\\pi \\times 2^2 = 4\\pi$ square centimeters.",
        "Divide part by whole: $P=\\frac{4\\pi}{100}$. Divide top and bottom by 4: $\\frac{\\pi}{25}$. That is about 0.13, a little more than 1 in 8.",
      ],
      answer: "$\\frac{\\pi}{25}$",
    },
    method: {
      title: "Part over whole",
      paragraphs: [
        "Find the area of the target part. Find the area of the whole region. Divide the part by the whole and simplify.",
        "For the probability of missing the target, subtract the probability of hitting it from 1.",
      ],
    },
    formal: {
      title: "Geometric probability",
      paragraphs: [
        "Choose a point uniformly at random in a region of area $A$, where $A$ is greater than 0. Uniformly means every spot is equally likely.",
        "The probability that the point lies in a part of area $B$ inside the region is $\\frac{B}{A}$, where $0 \\le B \\le A$. The probability it lies outside is $1 - \\frac{B}{A}$.",
      ],
    },
    pitfalls: [
      "Compare areas, not lengths or perimeters.",
      "For a circle, square the radius: area is $\\pi r^2$, not $2\\pi r$.",
      "The target must sit inside the whole region.",
    ],
    parentGuide:
      "Ask the learner what fraction of a square is covered by a rectangle half as wide and half as tall.",
  }),
  lesson({
    id: "composition-and-one-sided-behavior",
    title: "Composition order and one-sided behavior",
    summary:
      "Compare $f(g(x))$ with $g(f(x))$, and describe what a function approaches on each side of a break.",
    templateIds: ["composition-order-choice", "one-sided-behavior-choice"],
    objectives: [
      "Decide whether two functions give the same result in both orders.",
      "Describe left- and right-sided behavior at an asymptote, hole or jump.",
    ],
    intuition: [
      "In $f(g(x))$, the function $g$ goes first. Putting on socks and then shoes is different from shoes and then socks, and functions can behave the same way.",
      "Near a break in a graph, the left side and the right side can behave differently. We write $x\\to c^-$ for values just below $c$ and $x\\to c^+$ for values just above.",
    ],
    example: {
      prompt: "Let $f(x)=2x$ and $g(x)=x+1$. Compare $f(g(x))$ and $g(f(x))$.",
      steps: [
        "$f(g(x))=2(x+1)=2x+2$.",
        "$g(f(x))=2x+1$.",
        "The results differ, so the order matters.",
      ],
      answer: "$f(g(x))=2x+2$ and $g(f(x))=2x+1$",
    },
    method: {
      title: "Substitute, then test each side",
      paragraphs: [
        "For composition, substitute one expression into the other and simplify both ways. For behavior near $x=c$, cancel common factors, then check the sign of $f$ just left and just right of $c$. A squared factor gives the same sign on both sides.",
      ],
    },
    formal: {
      title: "Notation",
      paragraphs: [
        "$(f\\circ g)(x)=f(g(x))$. A vertical asymptote at $c$ means $|f(x)|$ grows without bound as $x\\to c$. A hole is a removable discontinuity, where both sides approach the same finite value but the function is undefined. A jump has different finite one-sided limits.",
      ],
    },
    pitfalls: [
      "Composition substitutes one function into the other; it is not a product.",
      "A hole is not an asymptote.",
    ],
    parentGuide:
      "Ask the learner what $f(g(x))$ means for $f(x)=x+3$ and $g(x)=2x$.",
  }),
  lesson({
    id: "parametric-to-rectangular",
    title: "Parametric equations and rectangular equations",
    summary:
      "Eliminate the parameter to see the path as an equation in $x$ and $y$.",
    templateIds: ["parametric-rectangular-convert"],
    objectives: [
      "Eliminate $t$ from linear, parabolic and circular parametric equations.",
      "Write a line in parametric form for a chosen $x(t)$.",
    ],
    intuition: [
      "When $x$ and $y$ both depend on a time-like variable $t$, a point traces a path. Removing $t$ leaves an equation connecting $x$ and $y$ for the same path.",
    ],
    example: {
      prompt: "Eliminate $t$ from $x=2t-1$ and $y=6t+2$.",
      steps: [
        "Solve for $t$: $t=\\frac{x+1}{2}$.",
        "Substitute: $y=6\\cdot\\frac{x+1}{2}+2=3x+5$.",
      ],
      answer: "$y=3x+5$",
    },
    method: {
      title: "Solve, substitute, simplify",
      paragraphs: [
        "For a circle $x=h+r\\cos t$, $y=k+r\\sin t$, solve for $\\cos t$ and $\\sin t$, square, add, and use $\\cos^2t+\\sin^2t=1$ to get $(x-h)^2+(y-k)^2=r^2$.",
      ],
    },
    formal: {
      title: "Parametrizations",
      paragraphs: [
        "A line $y=mx+b$ can be parametrized by choosing $x=at+h$ and substituting: $y=m(at+h)+b$. Different parametrizations can trace the same path at different speeds.",
      ],
    },
    pitfalls: [
      "Keep every constant when solving for $t$.",
      "After squaring cosine and sine, the right side is $r^2$.",
    ],
    parentGuide:
      "Ask the learner to give the position at $t=0$ and $t=1$ for a pair of equations.",
  }),
  lesson({
    id: "rotation-angles-and-speed",
    title: "Angles in standard position and rotation speed",
    summary:
      "Use reference angles for any angle, and radians for angular and linear speed.",
    templateIds: [
      "reference-angle-standard-position",
      "angular-velocity-problem",
    ],
    objectives: [
      "Find reference angles, quadrants and coterminal angles.",
      "Relate angular speed, linear speed and distance on a rotating wheel.",
    ],
    intuition: [
      "An angle in standard position starts on the positive $x$-axis. Positive angles turn counterclockwise and negative angles clockwise. A full turn brings you back to the same direction.",
      "A point on a wheel that turns through $\\theta$ radians travels $r\\theta$ along the rim, because a radian is the angle that cuts off an arc as long as the radius.",
    ],
    example: {
      prompt:
        "Find the reference angle of $-130^\\circ$, and the linear speed of a rim point on a wheel of radius 20 cm turning at 10 rev/min.",
      steps: [
        "$-130^\\circ+360^\\circ=230^\\circ$, which is in quadrant III.",
        "The reference angle is $230^\\circ-180^\\circ=50^\\circ$.",
        "One revolution carries a rim point $2\\pi(20)=40\\pi$ cm.",
        "At 10 revolutions per minute the speed is $400\\pi$ cm/min.",
      ],
      answer: "$50^\\circ$; $400\\pi$ cm/min",
    },
    method: {
      title: "Reduce first; use radians for rim distance",
      paragraphs: [
        "Remove full turns, find the quadrant, then measure to the $x$-axis. For rotation, change revolutions to radians with $2\\pi$ per revolution, then use $v=r\\omega$ and $s=r\\theta$.",
      ],
    },
    formal: {
      title: "Relations",
      paragraphs: [
        "Angles $\\theta$ and $\\theta+2\\pi k$ are coterminal for integer $k$. Arc length is $s=r\\theta$ for $\\theta$ in radians, so a point at radius $r$ moving with angular speed $\\omega$ has speed $v=r\\omega$.",
      ],
    },
    pitfalls: [
      "A reference angle is acute and is measured to the $x$-axis.",
      "Use radians in $s=r\\theta$.",
    ],
    parentGuide:
      "Ask the learner how far a point on a bicycle tire moves in one full turn of the wheel.",
  }),
  lesson({
    id: "bearings",
    title: "Directional bearings",
    summary:
      "A bearing gives a direction as an angle, an amount of turn. One degree is one 360th of a full turn, written $1^\\circ$. Start facing north and turn clockwise, the way clock hands move. East is a quarter turn, written $090^\\circ$ with three digits, and south is $180^\\circ$. A trip along a bearing can be split into how far it goes north or south and how far east or west. Unless the trip goes straight north, south, east or west, those two parts and the trip form a triangle with a square corner. A ratio is a comparison of two numbers by dividing. Two triangle ratios, sine and cosine, then find the parts.",
    senses: {
      side: "side",
      degree: "degree-angle",
      "opposite leg": "opposite-side-angle",
      unit: "unit",
    },
    noLink: [
      "tangent",
      "opposite",
      "plane",
      "parts",
      "part",
      "quarter",
      "change",
      "square",
    ],
    templateIds: ["bearing-trig-problem"],
    objectives: [
      "Split a bearing trip into its north-south and east-west parts, and find a bearing from those parts.",
      "Change between three-digit bearings and compass bearings such as $\\mathrm{N}\\,60^\\circ\\,\\mathrm{W}$.",
    ],
    intuition: [
      "The unit for measuring angles is the degree, written $^\\circ$. A full turn is $360^\\circ$, and a right angle, a square corner, is $90^\\circ$. Clockwise means turning the way clock hands move.",
      "A bearing is a direction measured clockwise from north, written with three digits. North is $000^\\circ$, east is $090^\\circ$, south is $180^\\circ$ and west is $270^\\circ$.",
      "Another style names a starting direction, an angle, and which way to turn. $\\mathrm{N}\\,60^\\circ\\,\\mathrm{W}$ means start facing north and turn $60^\\circ$ toward west. That is the three-digit bearing $360^\\circ - 60^\\circ = 300^\\circ$. Likewise $\\mathrm{N}\\,60^\\circ\\,\\mathrm{E}$ is $060^\\circ$, $\\mathrm{S}\\,60^\\circ\\,\\mathrm{E}$ is $120^\\circ$ and $\\mathrm{S}\\,60^\\circ\\,\\mathrm{W}$ is $240^\\circ$.",
      "Unless the trip goes straight north, south, east or west, the trip, its north-south part and its east-west part form a right triangle, a triangle with a square corner. The trip is the hypotenuse, the longest side, across from the $90^\\circ$ corner. The other two sides are the legs.",
      "In a right triangle, pick one of the other angles. The leg touching that angle is the adjacent leg, and the leg across from it is the opposite leg. A ratio is a comparison of two numbers by dividing. Sine and cosine are fixed ratios for each angle: opposite leg = hypotenuse × sine of the angle, and adjacent leg = hypotenuse × cosine of the angle. We write them $\\sin$ and $\\cos$.",
    ],
    example: {
      prompt:
        "A ship sails 40 km on a bearing of $060^\\circ$. How far east has it gone?",
      steps: [
        "Sketch it. The ship turns $60^\\circ$ clockwise from north, so its path makes a $60^\\circ$ angle with the north-south line.",
        "The east leg is across from that $60^\\circ$ angle, so it is the opposite leg. Opposite = hypotenuse × sine: $40\\sin60^\\circ = 40 \\times \\frac{\\sqrt3}{2} = 20\\sqrt3$ km, about 34.6 km. Here $\\sqrt3$ is the square root of 3, the positive number that times itself gives 3. It is about 1.73.",
        "For comparison, the north leg touches the angle, so it uses cosine: $40\\cos60^\\circ = 40 \\times \\frac12 = 20$ km.",
      ],
      answer: "$20\\sqrt3$ km east",
    },
    method: {
      title: "Sketch, then pick sine or cosine",
      paragraphs: [
        "Mark north, draw the path, and drop a line from the end of the path to the north-south line. That makes the right triangle.",
        "Find the angle between the path and the north-south line. The leg along the north-south line touches that angle, so it uses cosine. The east-west leg is across from it, so it uses sine.",
        "Name each direction from where the path points: north or south, and east or west.",
      ],
    },
    formal: {
      title: "Components",
      paragraphs: [
        "The two parts of a trip are called its components. For a distance $d$ on a bearing $B$, the east component is $d\\sin B$ and the north component is $d\\cos B$.",
        "A negative east value means west, and a negative north value means south.",
      ],
    },
    pitfalls: [
      "Measure from north, turning clockwise, not from east.",
      "Decide adjacent or opposite from the angle in your sketch.",
      "Check the direction of each leg from where the path points.",
    ],
    parentGuide:
      "Ask the learner which direction a bearing of $180^\\circ$ points, and which one $270^\\circ$ points.",
  }),
  lesson({
    id: "series-notation-and-infinite-sums",
    title: "Sigma notation and infinite geometric sums",
    summary:
      "Write finite series with sigma notation, and add an infinite geometric series when its ratio is small enough.",
    templateIds: ["sigma-notation-represent", "infinite-geometric-sum"],
    objectives: [
      "Write an arithmetic or geometric series in sigma notation.",
      "Find the sum of an infinite geometric series with $|r|<1$.",
    ],
    intuition: [
      "Sigma notation writes a sum compactly: $\\sum_{k=1}^{4}3k$ means $3+6+9+12$. The rule after the sigma gives each term, and the bounds say where to start and stop.",
      "If each term of an infinite series is a fraction of the one before, the terms shrink fast enough that the total approaches a fixed number.",
    ],
    example: {
      prompt:
        "Write $3+6+12+24+48$ in sigma notation, and find $8+4+2+1+\\cdots$.",
      steps: [
        "The first sum is geometric with first term 3 and ratio 2, with 5 terms: $\\sum_{k=1}^{5}3\\cdot2^{k-1}$.",
        "The second series has $a=8$ and $r=\\frac12$, and $|r|<1$.",
        "Its sum is $\\frac{8}{1-\\frac12}=16$.",
      ],
      answer: "$\\sum_{k=1}^{5}3\\cdot2^{k-1}$; 16",
    },
    method: {
      title: "Rule, bounds, then the check",
      paragraphs: [
        "Find $d$ or $r$, write the term rule for position $k$, and count terms. Check the first and last terms. For an infinite series, confirm $|r|<1$ and use $\\frac{a}{1-r}$ with $a$ the first term in the sum.",
      ],
    },
    formal: {
      title: "Why the infinite sum formula works",
      paragraphs: [
        "The partial sum of $n$ terms is $a\\frac{1-r^n}{1-r}$. When $|r|<1$, $r^n\\to0$, so the sums approach $\\frac{a}{1-r}$. When $|r|\\ge1$ they do not approach a number.",
      ],
    },
    pitfalls: [
      "An index from 0 to $n$ counts $n+1$ terms.",
      "Check $|r|<1$ before using the formula.",
    ],
    parentGuide:
      "Ask the learner to add $\\frac12+\\frac14+\\frac18$ and say what number the total approaches.",
  }),
  lesson({
    id: "polynomial-and-rational-inequalities",
    title: "Polynomial and rational inequalities",
    summary:
      "Find the zeros, test each interval and write the solution in interval notation.",
    templateIds: ["polynomial-inequality-solve", "rational-inequality-solve"],
    objectives: [
      "Solve polynomial and rational inequalities and write interval notation.",
      "Exclude values where a rational expression is undefined.",
    ],
    intuition: [
      "An expression can change sign only at a zero, or at a value where it is undefined. Between two such values, its sign stays the same.",
      "So list those values, test one number in each gap, and keep the gaps that make the inequality true.",
    ],
    example: {
      prompt: "Solve $\\dfrac{x-1}{x+2}\\ge0$.",
      steps: [
        "The numerator is 0 at 1 and the denominator is 0 at $-2$.",
        "Test $-3$, 0 and 2: the fraction is positive, negative, positive.",
        "Include 1, which makes the fraction 0, but exclude $-2$.",
      ],
      answer: "$(-\\infty,-2)\\cup[1,\\infty)$",
    },
    method: {
      title: "Sign chart",
      paragraphs: [
        "Mark the numerator and denominator zeros. Test each interval. A squared factor does not flip the sign. Use brackets only at zeros of the numerator when the inequality allows equality.",
      ],
    },
    formal: {
      title: "Why testing works",
      paragraphs: [
        "A polynomial is continuous, and a rational expression is continuous where defined, so by the intermediate value theorem it cannot change sign between consecutive zeros or undefined values.",
      ],
    },
    pitfalls: [
      "A denominator zero always gets a parenthesis.",
      "A negative sign in front flips every interval's sign.",
    ],
    parentGuide: "Ask the learner whether $(x-3)^2$ can ever be negative.",
  }),
];
