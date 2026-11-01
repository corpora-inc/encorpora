import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Methods, principles and lessons for the Texas high-school requirement-gap templates. */
export const texasHsMethods: Record<string, ProblemMethod> = {
  "line-equation-forms": {
    goal: "Write a line's equation in point-slope, slope-intercept or standard form from a point and slope, two points, or another form.",
    intuition:
      "A line is fixed by one point and a slope. Each form of its equation shows that information differently: point-slope form shows a point and the slope, slope-intercept form shows the slope and the $y$-intercept, and standard form $Ax+By=C$ keeps whole-number coefficients.",
    terms: ["slope", "point-slope-form", "standard-form-line"],
    method: [
      "If two points are given, find the slope as the change in $y$ over the change in $x$.",
      "Put the slope and one point into $y-y_1=m(x-x_1)$, subtracting each coordinate from its own variable.",
      "To change form, distribute and solve for $y$ for slope-intercept form, or multiply by a common denominator and collect $x$ and $y$ on the left for standard form.",
      "Check by substituting the given point or points.",
    ],
    watch:
      "Subtract the point's coordinates: a point with $x_1=-2$ gives the factor $x+2$. Multiply every term, including the constant, when clearing fractions.",
  },
  "line-relationship-equations": {
    goal: "Write the line through a point parallel or perpendicular to a given line or an axis, and name slopes of horizontal and vertical lines.",
    intuition:
      "Parallel lines point the same way, so they have the same slope. Perpendicular lines meet at a right angle, so their slopes are negative reciprocals. Horizontal lines have slope 0 and vertical lines have an undefined slope, because their run is 0.",
    terms: ["negative-reciprocal", "horizontal-line", "vertical-line"],
    method: [
      "Read the slope of the given line. For $Ax+By=C$, solve for $y$: the slope is $-\\frac{A}{B}$.",
      "Use the same slope for a parallel line, or the negative reciprocal for a perpendicular line.",
      "Substitute the given point into $y=mx+b$ to find $b$.",
      "For a line parallel or perpendicular to a horizontal or vertical line, decide whether the new line is horizontal or vertical, then keep the matching coordinate of the point.",
    ],
    watch:
      "A perpendicular slope needs both steps: flip the fraction and change the sign. The point's $y$-coordinate is not the intercept unless the point is on the $y$-axis.",
  },
  "system-equation-choice": {
    goal: "Choose the system of two linear equations that matches a situation, a pair of tables or a graph.",
    intuition:
      "Each quantity that changes at a steady rate from a starting value gives one equation $y=mx+b$. The rate multiplies $x$, and the starting value is the constant. A system is the pair of equations, one for each quantity.",
    terms: [
      "system-of-equations",
      [
        "rate",
        "Here it is how much $y$ changes when $x$ increases by 1: the coefficient of $x$.",
      ],
      "initial-value",
    ],
    method: [
      "For a table, find how much each row changes when $x$ increases by 1, then find the value at $x=0$.",
      "For a graph, read each line's $y$-intercept and count rise over run for its slope.",
      "For a story with two unknown counts, write one equation for the total number and one for the total value, multiplying each count by its price.",
      "Pair each rate with its own starting value.",
    ],
    watch:
      "Keep each rate and starting value together in one equation. The value at $x=1$ is not the starting value unless the table starts there.",
  },
  "graph-estimate-system-solution": {
    goal: "Read two plotted lines and estimate the point where they meet, then say what it means in the situation.",
    intuition:
      "Each line shows one quantity as it changes. Where the lines cross, the two quantities are equal at the same input, so that point answers questions such as when two costs are the same.",
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
    goal: "Write the domain and range of an exponential function or model as inequalities.",
    intuition:
      "You can raise a positive base to any real power, so an exponential function accepts every input unless a situation restricts it. Its outputs get close to a boundary line, the horizontal asymptote, without reaching it.",
    terms: ["domain", "range-function", "horizontal-asymptote"],
    method: [
      "State the domain: all real numbers, unless a situation limits the input, such as $t\\ge0$.",
      "Find the boundary of the range, the number added to $a\\cdot b^x$.",
      "If $a>0$ the outputs lie above the boundary, and if $a<0$ they lie below it. A boundary that is not reached uses $<$ or $>$.",
      "For a model, include the starting value when the domain starts at 0.",
    ],
    watch:
      "Exponential functions have no restriction on $x$; $x>0$ belongs to logarithms. The asymptote itself is not an output.",
  },
  "absolute-value-equation-formulate": {
    goal: "Write an absolute value equation from a distance, two given solutions or a measurement that differs from a target by a fixed amount.",
    intuition:
      "The absolute value $|x-c|$ is the distance between $x$ and $c$ on the number line. An equation $|x-c|=d$ asks for every number exactly $d$ units from $c$, which gives one solution on each side of $c$.",
    terms: [
      ["absolute-value", "$|x - c|$ is the distance from $x$ to $c$."],
      [
        "center",
        "Here the center is the number $c$ that distances are measured from.",
      ],
    ],
    method: [
      "Identify the center, the point the distance is measured from.",
      "Identify the distance.",
      "Write $|x-c|=d$. For two given solutions, the center is their midpoint and $d$ is the distance from it to either solution.",
    ],
    watch:
      "A center of $-3$ gives $|x+3|$. The right side is the distance, not the center.",
  },
  "rational-equation-formulate": {
    goal: "Write the rational equation that models a work-together, current-speed or two-speed travel situation.",
    intuition:
      "Rates tell how much happens in one unit of time. Time equals distance divided by speed, and a worker who finishes a job in $h$ hours does $\\frac{1}{h}$ of it per hour. Putting the unknown in a denominator gives a rational equation.",
    terms: ["rate", "rational-equation"],
    method: [
      "Name the unknown and decide what each fraction measures: a rate or a time.",
      "For work, add the rates of workers who work together and set the sum equal to the team's rate, $\\frac{1}{x}$.",
      "For travel, write each time as distance over speed, adding or subtracting the current or speed change inside the denominator.",
      "State what the equation compares: equal times, or times that add to a total.",
    ],
    watch:
      "Rates add for workers at the same time; times of separate parts add for a trip. Distance over speed gives time, not speed over distance.",
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
    goal: "Find the image of a point after a rigid motion and a dilation about a center other than the origin.",
    intuition:
      "A rigid motion moves a figure without changing its size, and a dilation scales distances from a center. Each step acts on the result of the step before, so the order can change the answer.",
    terms: ["rigid-motion", "dilation", "center-of-dilation"],
    method: [
      "Do the steps in the order stated.",
      "Apply a rigid motion to the coordinates directly.",
      "For a dilation, subtract the center from the point, multiply by the scale factor, and add the center back.",
    ],
    watch:
      "A center that is not the origin must be subtracted first and added back after. Scaling the coordinates directly moves the center as well.",
  },
  "counterexample-choice": {
    goal: "Choose the case that satisfies a conjecture's hypothesis but fails its conclusion.",
    intuition:
      "A conjecture says that whenever one condition holds, another does too. One example where the first holds and the second fails shows the conjecture is false. Examples that agree with it prove nothing.",
    terms: ["conjecture", "counterexample"],
    method: [
      "Split the conjecture into its hypothesis (the if part) and its conclusion (the then part).",
      "For each choice, test whether the hypothesis is true.",
      "Among those, keep the one where the conclusion is false.",
    ],
    watch:
      "A case that fails the hypothesis does not test the conjecture, and a case that satisfies both parts supports it. Only a hypothesis-true, conclusion-false case refutes it.",
  },
  "spherical-geometry-compare": {
    goal: "State how parallel lines, triangle angle sums, right angles and shortest paths differ on a sphere from the plane.",
    intuition:
      "On a sphere the straightest paths are great circles, circles centered at the center of the sphere. Many facts of plane geometry change because every two great circles meet.",
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
      "Any two great circles cross in two opposite points, so there are no parallel lines.",
      "A triangle on a sphere has an angle sum greater than $180^\\circ$, and it can have three right angles.",
      "The shortest route between two points follows the shorter arc of a great circle.",
    ],
    watch:
      "Do not apply the plane's facts to the sphere. Facts for a saddle-shaped surface, such as sums below $180^\\circ$, are also different from the sphere's.",
  },
  "regular-polygon-area": {
    goal: "Find the area of a regular polygon from its apothem and perimeter, from a hexagon's side, or find a missing apothem or side.",
    intuition:
      "A regular polygon splits into identical triangles from its center. Each has base equal to a side and height equal to the apothem, so the total area is half the apothem times the perimeter.",
    terms: ["regular-polygon", "apothem"],
    method: [
      "Find the perimeter: the number of sides times the side length.",
      "Find or read the apothem. For a regular hexagon with side $s$, it is $\\frac{s\\sqrt3}{2}$.",
      "Use $A=\\frac12ap$. To find a missing part, solve this equation for it.",
    ],
    watch:
      "Use the whole perimeter, not one side, and keep the factor $\\frac12$.",
  },
  "curved-solid-surface-area": {
    goal: "Find the exposed surface area of a cone or a cylinder joined to a hemisphere or a cone.",
    intuition:
      "Surface area adds the areas of the surfaces you could touch from the outside. When two solids are joined, the faces where they meet are hidden and are not counted.",
    terms: [
      "slant-height",
      [
        "surface-area",
        "Count only the exposed surfaces, the ones on the outside of the solid.",
      ],
    ],
    method: [
      "List the outside surfaces: bases, curved sides and the hemisphere's curved surface.",
      "Use $\\pi r^2$ for a circular base, $2\\pi rh$ for a cylinder's side, $\\pi r\\ell$ for a cone's side and $2\\pi r^2$ for a hemisphere.",
      "For a cone, use the slant height; if only the height is given, find it from $\\ell=\\sqrt{r^2+h^2}$.",
      "Add the areas and leave out the faces that are joined.",
    ],
    watch:
      "Do not count joined faces, and do not use the vertical height where the formula needs the slant height.",
  },
  "area-probability": {
    goal: "Find the probability that a randomly chosen point lies in part of a region as a ratio of areas.",
    intuition:
      "When every point of a region is equally likely, the chance of landing in a part is the fraction of the total area that part covers.",
    terms: ["geometric-probability"],
    method: [
      "Find the area of the target part.",
      "Find the area of the whole region.",
      "Divide the part by the whole and simplify. For the outside of the part, subtract the part's probability from 1.",
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
    goal: "Resolve a travel distance on a compass bearing into north-south and east-west parts, or find the bearing from the two parts.",
    intuition:
      "A bearing gives a direction as an angle from north. A trip along it is the hypotenuse of a right triangle whose legs point north-south and east-west.",
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
      "The leg along the north-south line is adjacent to that angle (cosine); the east-west leg is opposite (sine).",
      "Name each direction from the quadrant of the bearing.",
    ],
    watch:
      "Measure from north, not from the east axis. Decide adjacent or opposite from the angle in your sketch.",
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
    "The line through $(x_1, y_1)$ with slope $m$ is $y-y_1=m(x-x_1)$. Through two points, $m=\\frac{y_2-y_1}{x_2-x_1}$ when $x_1\\ne x_2$. The standard form $Ax+By=C$ has slope $-\\frac{A}{B}$ when $B\\ne0$.",
  "line-relationship-equations":
    "Two nonvertical lines are parallel when their slopes are equal and perpendicular when the product of their slopes is $-1$. A horizontal line $y=c$ has slope 0 and is perpendicular to every vertical line $x=k$; a vertical line has undefined slope.",
  "system-equation-choice":
    "A quantity with a constant rate of change $m$ from starting value $b$ is modeled by $y=mx+b$. A system of two such equations has a solution where both quantities are equal at the same $x$. A total-and-value pair $x+y=T$, $px+cy=V$ models two counts with prices $p$ and $c$.",
  "graph-estimate-system-solution":
    "The solution of a system is every ordered pair that satisfies both equations. For two lines that are not parallel, it is the single point where their graphs meet, and its coordinates can be read approximately from a graph.",
  "exponential-domain-range":
    "For $f(x)=a\\cdot b^x+k$ with $b>0$, $b\\ne1$, $a\\ne0$, the domain is all real numbers and the range is $y>k$ if $a>0$, or $y<k$ if $a<0$. A model restricted to $t\\ge0$ has range between $f(0)$ and the asymptote.",
  "absolute-value-equation-formulate":
    "For $d>0$, $|x-c|=d$ means $x=c+d$ or $x=c-d$, the two numbers at distance $d$ from $c$. Two solutions $x_1$ and $x_2$ have center $\\frac{x_1+x_2}{2}$ and distance $\\frac{|x_1-x_2|}{2}$.",
  "rational-equation-formulate":
    "Distance equals rate times time, so time equals distance divided by rate. If two workers finish a job alone in $a$ and $b$ hours, working together they finish in $x$ hours when $\\frac{1}{a}+\\frac{1}{b}=\\frac{1}{x}$.",
  "rational-exponent-equation":
    "For $x^{p/q}=k$ in lowest terms with $q>0$, raising both sides to $\\frac{q}{p}$ gives $x=k^{q/p}$ when $p$ is odd. When $p$ is even, $x^{p/q}=k>0$ has solutions $x=\\pm k^{q/p}$, and when $q$ is even, $x^{p/q}$ is defined only for $x\\ge0$.",
  "transformation-composition-image":
    "The dilation with center $C$ and scale factor $k$ sends $P$ to $C+k(P-C)$. Compositions are applied right to left in function notation, and in general the order of a rigid motion and a dilation matters.",
  "counterexample-choice":
    'A conditional statement "if $p$ then $q$" is false when some case has $p$ true and $q$ false. One such case, a counterexample, is enough to refute it; any number of cases where it holds does not prove it.',
  "spherical-geometry-compare":
    "On a sphere, lines are great circles. Any two meet, so there are no parallel lines; a triangle's angle sum is greater than $180^\\circ$ and less than $540^\\circ$; and the shortest path between two points is an arc of a great circle.",
  "regular-polygon-area":
    "A regular polygon with perimeter $p$ and apothem $a$ has area $A=\\frac12ap$. A regular hexagon with side $s$ has apothem $\\frac{s\\sqrt3}{2}$ and area $\\frac{3\\sqrt3}{2}s^2$.",
  "curved-solid-surface-area":
    "A cone with radius $r$ and slant height $\\ell$ has lateral area $\\pi r\\ell$ and base area $\\pi r^2$, with $\\ell=\\sqrt{r^2+h^2}$. A cylinder has lateral area $2\\pi rh$, and a hemisphere's curved surface is $2\\pi r^2$. The surface area of a composite counts only exposed faces.",
  "area-probability":
    "If a point is chosen at random in a region of area $A$, the probability that it lies in a part of area $B$ is $\\frac{B}{A}$, and the probability that it lies outside the part is $1-\\frac{B}{A}$.",
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
    "A displacement of length $d$ on a bearing $B$ measured clockwise from north has east component $d\\sin B$ and north component $d\\cos B$, with signs negative for west and south.",
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
  ...(x.noLink ? { noLink: x.noLink } : {}),
});

export const texasHsLessons: Lesson[] = [
  lesson({
    id: "line-equations-from-conditions",
    title: "Write the equation of a line",
    summary:
      "A point and a slope fix a line. Use point-slope, slope-intercept or standard form, and use slopes to build parallel and perpendicular lines.",
    templateIds: ["line-equation-forms", "line-relationship-equations"],
    objectives: [
      "Write a line in point-slope, slope-intercept or standard form from a point and slope or two points.",
      "Write the line through a point parallel or perpendicular to a given line, or parallel to an axis.",
    ],
    intuition: [
      "The slope of a line is the change in $y$ divided by the change in $x$ between two of its points. A line is determined by one point and its slope, and every form of its equation shows that same information.",
      "Parallel lines have the same slope. Perpendicular lines have slopes that are negative reciprocals, such as $2$ and $-\\frac12$. A horizontal line has slope 0, and a vertical line has an undefined slope because its run is 0.",
    ],
    example: {
      prompt:
        "Write, in point-slope form, the line through $(1, 5)$ perpendicular to $y=2x-3$.",
      steps: [
        "The given line has slope 2, so a perpendicular line has slope $-\\frac12$.",
        "Use $(x_1, y_1)=(1, 5)$ in $y-y_1=m(x-x_1)$.",
        "The equation is $y-5=-\\frac12(x-1)$.",
        "Check: at $x=1$ the right side is 0, so $y=5$, and the point is on the line.",
      ],
      answer: "$y-5=-\\frac12(x-1)$",
    },
    method: {
      title: "Choose the form that fits the givens",
      paragraphs: [
        "With a point and a slope, point-slope form needs no solving. To reach slope-intercept form, distribute and add $y_1$. To reach standard form, multiply by a common denominator and collect $x$ and $y$ on the left.",
        "With two points, find the slope first. For a parallel or perpendicular line, take the slope from the given line, using $-\\frac{A}{B}$ for $Ax+By=C$.",
      ],
    },
    formal: {
      title: "Slope conditions",
      paragraphs: [
        "Two nonvertical lines with slopes $m_1$ and $m_2$ are parallel exactly when $m_1=m_2$, and perpendicular exactly when $m_1m_2=-1$. The line $y=c$ is horizontal, $x=k$ is vertical, and each is perpendicular to the other kind.",
      ],
    },
    pitfalls: [
      "Subtract the coordinates in point-slope form: the point $(-2, 3)$ gives $x+2$ and $y-3$.",
      "A perpendicular slope is the negative reciprocal: flip the fraction and change the sign.",
      "Slope 0 is a horizontal line; an undefined slope is a vertical line.",
    ],
    parentGuide:
      "Ask the learner to name the slope of the line $x=4$ and of the line $y=4$, and to say which is horizontal.",
  }),
  lesson({
    id: "systems-from-representations",
    title: "Write and read a system of two lines",
    summary:
      "Match a system to a story, tables or a graph, and estimate where two plotted lines cross.",
    templateIds: ["system-equation-choice", "graph-estimate-system-solution"],
    objectives: [
      "Write the system for two quantities that change at steady rates.",
      "Estimate where two graphed lines meet and say what it means.",
    ],
    intuition: [
      "Each quantity that starts at a value and changes by the same amount each step is a line $y=mx+b$: the rate $m$ multiplies $x$ and the starting value $b$ is the constant. Two such quantities form a system.",
      "On a graph, the point where the lines cross is the one input where both quantities are equal.",
    ],
    example: {
      prompt:
        "Plan A costs 10 dollars to join plus 4 dollars a month. Plan B costs 4 dollars to join plus 6 dollars a month. Write the system and estimate when the costs are equal.",
      steps: [
        "Plan A: $y=4x+10$. Plan B: $y=6x+4$.",
        "Set the costs equal: $4x+10=6x+4$, so $2x=6$ and $x=3$.",
        "At 3 months both cost $4(3)+10=22$ dollars.",
        "On a graph the lines would cross at $(3, 22)$.",
      ],
      answer: "$y=4x+10$ and $y=6x+4$; equal at $(3, 22)$",
    },
    method: {
      title: "Read rates and starting values",
      paragraphs: [
        "From a table, the change per row is the rate and the value at $x=0$ is the start. From a graph, the $y$-intercept is the start and rise over run is the rate. From a story, pair each fee with its own rate.",
        "To estimate a crossing, find it on the grid, read $x$ on the horizontal axis and $y$ on the vertical axis, and allow positions between grid lines.",
      ],
    },
    formal: {
      title: "Solutions of a system",
      paragraphs: [
        "A solution of a system is an ordered pair that satisfies every equation. Two lines with different slopes meet at exactly one point, which is the solution.",
      ],
    },
    pitfalls: [
      "Keep the rate and the starting value of the same plan together.",
      "Report the point as $(x, y)$, with the input first.",
    ],
    parentGuide:
      "Ask the learner what the starting value and the rate mean in a story with a sign-up fee.",
  }),
  lesson({
    id: "exponential-domain-and-range",
    title: "Domain and range of exponential functions",
    summary:
      "An exponential function accepts every real input unless a situation restricts it, and its outputs stay on one side of a boundary.",
    templateIds: ["exponential-domain-range"],
    objectives: [
      "Write the domain and range of an exponential function as inequalities.",
      "Restrict the domain for a model that starts at $t=0$.",
    ],
    intuition: [
      "A positive base can be raised to any real power, so $2^x$ is defined for every $x$. The outputs are always positive and get as close to 0 as you like without reaching it.",
      "Multiplying by a negative number turns the outputs negative, and adding a number $k$ moves the boundary to $y=k$.",
    ],
    example: {
      prompt: "Find the domain and range of $f(x)=-3(2)^x+4$ as inequalities.",
      steps: [
        "Every real $x$ is allowed: $-\\infty<x<\\infty$.",
        "$2^x>0$, so $-3(2)^x<0$.",
        "Adding 4 gives $f(x)<4$, and 4 is never reached.",
      ],
      answer: "Domain $-\\infty<x<\\infty$; range $y<4$",
    },
    method: {
      title: "Boundary, side and strictness",
      paragraphs: [
        "The boundary is the added constant. The coefficient's sign picks the side. The boundary is not an output, so use $<$ or $>$. In a model with $t\\ge0$, the starting value is an output and the domain is $t\\ge0$.",
      ],
    },
    formal: {
      title: "The exponential function",
      paragraphs: [
        "For $b>0$, $b\\ne1$, the function $b^x$ has domain all real numbers and range $y>0$. The function $a\\cdot b^x+k$ has range $y>k$ if $a>0$ and $y<k$ if $a<0$.",
      ],
    },
    pitfalls: [
      "Do not restrict $x$ to positive numbers; that is the domain of a logarithm.",
      "Use a strict inequality at the boundary.",
    ],
    parentGuide:
      "Ask the learner why $2^x$ never equals 0 or a negative number.",
  }),
  lesson({
    id: "equations-from-situations",
    title: "Write equations from situations",
    summary:
      "Turn distances, rates and travel stories into absolute value and rational equations.",
    templateIds: [
      "absolute-value-equation-formulate",
      "rational-equation-formulate",
    ],
    objectives: [
      "Write $|x-c|=d$ for numbers a given distance from a center.",
      "Write rational equations for work and travel situations.",
    ],
    intuition: [
      "The absolute value $|x-c|$ is the distance between $x$ and $c$ on the number line. Setting it equal to $d$ describes the two numbers exactly $d$ away from $c$.",
      "A rate is an amount per unit of time. A worker who finishes in $h$ hours does $\\frac{1}{h}$ of the job per hour, and the time to travel a distance is the distance divided by the speed.",
    ],
    example: {
      prompt:
        "Two pipes fill a pool in 3 hours and 6 hours alone. Write an equation for the hours $x$ they take together.",
      steps: [
        "The pipes fill $\\frac13$ and $\\frac16$ of the pool per hour.",
        "Together they fill $\\frac{1}{x}$ of the pool per hour.",
        "Rates add: $\\frac13+\\frac16=\\frac1x$.",
        "Solving gives $x=2$ hours.",
      ],
      answer: "$\\frac13+\\frac16=\\frac1x$",
    },
    method: {
      title: "Name what each piece measures",
      paragraphs: [
        "For absolute value, find the center and the distance and write $|x-c|=d$. Two solutions have a center at their midpoint.",
        "For a rational equation, decide whether each fraction is a rate or a time. Rates of workers who work together add. Times of separate parts of a trip add, with speeds in the denominators.",
      ],
    },
    formal: {
      title: "Distance and rate",
      paragraphs: [
        "For $d>0$, $|x-c|=d$ exactly when $x=c\\pm d$. For constant rate $r$, distance $=r\\cdot$ time, so time $=\\frac{\\text{distance}}{r}$.",
      ],
    },
    pitfalls: [
      "A center of $-4$ gives $|x+4|$.",
      "Do not add the hours of two workers; add their rates.",
    ],
    parentGuide:
      "Ask the learner how far apart 2 and 8 are, and where the midpoint is.",
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
      "Apply each step in order, scaling distances from the center of the dilation.",
    templateIds: ["transformation-composition-image"],
    objectives: [
      "Find the image of a point under a rigid motion and a dilation with any center.",
      "Apply the two motions in the stated order.",
    ],
    intuition: [
      "A rigid motion slides, flips or turns a figure and keeps its size. A dilation enlarges or shrinks it about a fixed center point.",
      "Each point moves along the ray from the center, and its distance from the center is multiplied by the scale factor.",
    ],
    example: {
      prompt:
        "Reflect $A=(2, 3)$ across the $y$-axis, then dilate with center $(1, 1)$ and scale factor 2.",
      steps: [
        "Reflecting across the $y$-axis gives $(-2, 3)$.",
        "Subtract the center: $(-3, 2)$.",
        "Multiply by 2: $(-6, 4)$.",
        "Add the center back: $(-5, 5)$.",
      ],
      answer: "$(-5, 5)$",
    },
    method: {
      title: "Scale from the center",
      paragraphs: [
        "Use $P'=C+k(P-C)$. Do the steps in the order given. The same two steps in the other order can give a different point.",
      ],
    },
    formal: {
      title: "Dilation formula",
      paragraphs: [
        "A dilation with center $C$ and scale factor $k>0$ sends $P$ to the point $P'$ on ray $CP$ with $CP'=k\\cdot CP$, so $P'=C+k(P-C)$. Dilation preserves angles and multiplies lengths by $k$.",
      ],
    },
    pitfalls: [
      "Subtract the center before scaling and add it back after.",
      "Reflect or turn the original point, not the dilated one, when the motion comes first.",
    ],
    parentGuide: "Ask the learner what a dilation with scale factor 1 does.",
  }),
  lesson({
    id: "counterexamples",
    title: "Refute a conjecture with a counterexample",
    summary:
      "A counterexample makes the hypothesis true and the conclusion false.",
    templateIds: ["counterexample-choice"],
    objectives: [
      "Pick the case that disproves a geometric conjecture.",
      "Explain why a case that fails the hypothesis does not refute the conjecture.",
    ],
    intuition: [
      'A conjecture of the form "if $p$, then $q$" claims $q$ whenever $p$ is true. To show it is false, find one case where $p$ is true and $q$ is false.',
      "Cases where $p$ is false say nothing about the conjecture, and cases where both are true only agree with it.",
    ],
    example: {
      prompt:
        "Conjecture: if a quadrilateral has four equal sides, then it is a square. Find a counterexample.",
      steps: [
        "The hypothesis is four equal sides; the conclusion is being a square.",
        "A rhombus with angles $60^\\circ$ and $120^\\circ$ has four equal sides.",
        "Its angles are not right angles, so it is not a square.",
      ],
      answer: "A rhombus with angles $60^\\circ$ and $120^\\circ$",
    },
    method: {
      title: "Test both parts",
      paragraphs: [
        "For each option, first ask whether the hypothesis holds. Keep only those, then ask whether the conclusion fails.",
      ],
    },
    formal: {
      title: "Logic of refutation",
      paragraphs: [
        'The statement "if $p$ then $q$" is false exactly when some case has $p$ true and $q$ false. Examples that satisfy the statement do not prove it for all cases.',
      ],
    },
    pitfalls: [
      "Do not choose a case that fails the hypothesis.",
      "Do not choose a case that satisfies both parts.",
    ],
    parentGuide:
      'Ask the learner for a counterexample to "all animals with four legs are dogs."',
    noLink: ["legs"],
  }),
  lesson({
    id: "spherical-geometry",
    title: "Geometry on a sphere",
    summary:
      "On a sphere, lines are great circles, and several facts of plane geometry change.",
    templateIds: ["spherical-geometry-compare"],
    objectives: [
      "Compare parallels, triangle angle sums, right angles and shortest paths in the plane and on a sphere.",
      "State which plane facts about parallels and angle sums change on a sphere.",
    ],
    intuition: [
      "A great circle is a circle on a sphere whose center is the center of the sphere, like the equator or a line of longitude. These are the straightest paths on a sphere, so they play the role of lines.",
      "Any two great circles cross in two opposite points, so no two lines are parallel.",
    ],
    example: {
      prompt:
        "A triangle has its vertex at the north pole and two vertices on the equator a quarter of the way around from each other. What are its angles?",
      steps: [
        "Lines of longitude meet the equator at right angles, so two angles are $90^\\circ$.",
        "The two longitudes are a quarter turn apart, so they meet at the pole at $90^\\circ$.",
        "The angles total $270^\\circ$, more than the plane's $180^\\circ$.",
      ],
      answer: "$90^\\circ$, $90^\\circ$, $90^\\circ$",
    },
    method: {
      title: "Use great circles",
      paragraphs: [
        'Replace "line" by "great circle". Shortest paths follow the shorter arc of a great circle. Triangles have angle sums between $180^\\circ$ and $540^\\circ$.',
      ],
    },
    formal: {
      title: "Spherical and Euclidean geometry",
      paragraphs: [
        "Euclidean geometry has exactly one parallel to a line through an outside point, and angle sum $180^\\circ$. Spherical geometry has no parallels, angle sums above $180^\\circ$, and area proportional to the excess over $180^\\circ$.",
      ],
    },
    pitfalls: [
      "A circle of latitude other than the equator is not a line of the sphere.",
      "Angle sums below $180^\\circ$ do not occur on a sphere.",
    ],
    parentGuide:
      "Ask the learner why airplane routes between distant cities look curved on a flat map.",
  }),
  lesson({
    id: "regular-polygon-area",
    title: "Area of a regular polygon",
    summary:
      "Split a regular polygon into triangles from its center: area is half the apothem times the perimeter.",
    templateIds: ["regular-polygon-area"],
    objectives: [
      "Use $A=\\frac12ap$ and find a missing apothem or side.",
      "Find the apothem of a regular polygon from its side length.",
    ],
    intuition: [
      "A regular polygon has equal sides and equal angles. Joining its center to each vertex cuts it into identical triangles.",
      "Each triangle has a side of the polygon as its base and the apothem, the distance from the center to the midpoint of a side, as its height.",
    ],
    example: {
      prompt: "Find the area of a regular hexagon with side 4 cm.",
      steps: [
        "The center and two neighboring vertices form an equilateral triangle with side 4.",
        "Its height, the apothem, is $2\\sqrt3$ cm from a $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle.",
        "The perimeter is $6\\times4=24$ cm.",
        "$A=\\frac12(2\\sqrt3)(24)=24\\sqrt3\\text{ cm}^2$.",
      ],
      answer: "$24\\sqrt3$ square centimeters",
    },
    method: {
      title: "Perimeter, apothem, one half",
      paragraphs: [
        "Add the areas of the $n$ triangles: $n\\cdot\\frac12 s a=\\frac12 a(ns)$. To find a missing apothem or side, solve $A=\\frac12ap$ for it.",
      ],
    },
    formal: {
      title: "The area formula",
      paragraphs: [
        "A regular polygon with $n$ sides of length $s$ and apothem $a$ has area $A=\\frac12a\\cdot ns=\\frac12ap$. For a hexagon, $a=\\frac{s\\sqrt3}{2}$.",
      ],
    },
    pitfalls: [
      "Use the whole perimeter in the formula.",
      "The apothem is not the side length.",
    ],
    parentGuide:
      "Ask the learner to cut a regular hexagon into six triangles and describe one of them.",
  }),
  lesson({
    id: "composite-surface-area",
    title: "Surface area of cones and composite solids",
    summary:
      "Add the outside surfaces and leave out the faces where solids are joined.",
    templateIds: ["curved-solid-surface-area"],
    objectives: [
      "Find the surface area of a cone and of solids joined to a cylinder.",
      "Leave out the faces that are joined together.",
    ],
    intuition: [
      "Surface area is the total area of the faces you could touch from outside. Where two solids are joined, the faces that meet are hidden inside and do not count.",
      "A cone has a circular base and a curved side. The side opens flat into part of a circle whose radius is the slant height.",
    ],
    example: {
      prompt:
        "A cylinder of radius 3 cm and height 5 cm has a hemisphere of radius 3 cm on top. Find the outside surface area.",
      steps: [
        "Bottom circle: $\\pi(3)^2=9\\pi$.",
        "Cylinder side: $2\\pi(3)(5)=30\\pi$.",
        "Hemisphere: $2\\pi(3)^2=18\\pi$. The cylinder's top is covered.",
        "Total: $9\\pi+30\\pi+18\\pi=57\\pi\\text{ cm}^2$.",
      ],
      answer: "$57\\pi$ square centimeters",
    },
    method: {
      title: "List, then add",
      paragraphs: [
        "List every outside surface. Use $\\pi r\\ell$ for a cone's side with slant height $\\ell$, found from $\\sqrt{r^2+h^2}$ when only $h$ is given.",
      ],
    },
    formal: {
      title: "Surface area formulas",
      paragraphs: [
        "Cone: $\\pi r\\ell$ for the side plus $\\pi r^2$ for the base. Cylinder side: $2\\pi rh$. Sphere: $4\\pi r^2$, so a hemisphere's curved surface is $2\\pi r^2$.",
      ],
    },
    pitfalls: [
      "Do not count faces that are joined.",
      "Use the slant height, not the vertical height, for a cone's side.",
    ],
    parentGuide:
      "Ask the learner which faces of a toy rocket, a cylinder with a cone on top, are outside.",
  }),
  lesson({
    id: "area-probability",
    title: "Probability from area",
    summary:
      "For a random point in a region, probability is the fraction of the area that is the target.",
    templateIds: ["area-probability"],
    objectives: [
      "Find geometric probabilities as ratios of areas.",
      "Subtract an area for the outside of a region.",
    ],
    intuition: [
      "If a dart is equally likely to land anywhere on a target, the chance of landing in a part is how much of the target's area that part covers.",
    ],
    example: {
      prompt:
        "A dart lands at random on a 10 cm by 10 cm square. A circle of radius 2 cm is inside it. What is the probability it lands in the circle?",
      steps: [
        "The square's area is $100\\text{ cm}^2$.",
        "The circle's area is $\\pi(2)^2=4\\pi\\text{ cm}^2$.",
        "$P=\\frac{4\\pi}{100}=\\frac{\\pi}{25}$.",
      ],
      answer: "$\\frac{\\pi}{25}$",
    },
    method: {
      title: "Part over whole",
      paragraphs: [
        "Find the area of the target and of the whole region, divide, and simplify. For the probability of missing the target, subtract from 1.",
      ],
    },
    formal: {
      title: "Geometric probability",
      paragraphs: [
        "If a point is chosen uniformly in a region of area $A$, the probability that it lies in a subregion of area $B$ is $\\frac{B}{A}$, where $0\\le B\\le A$.",
      ],
    },
    pitfalls: [
      "Compare areas, not perimeters.",
      "Use the radius squared for a circle.",
    ],
    parentGuide:
      "Ask the learner what fraction of a square a rectangle covers if it takes up half of its width and half of its height.",
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
      "Split a trip on a bearing into north-south and east-west legs of a right triangle.",
    templateIds: ["bearing-trig-problem"],
    objectives: [
      "Resolve a bearing trip into components and find a bearing from components.",
      "Convert between three-digit bearings and compass-quadrant bearings.",
    ],
    intuition: [
      "A bearing is a direction given as an angle clockwise from north, written with three digits: east is $090^\\circ$ and west is $270^\\circ$.",
      "A trip along a bearing together with its north-south and east-west parts forms a right triangle.",
      "A compass bearing such as $\\mathrm{N}\\,60^\\circ\\,\\mathrm{W}$ means $60^\\circ$ from north toward west, which is the three-digit bearing $300^\\circ$. $\\mathrm{N}\\,60^\\circ\\,\\mathrm{E}$ is $060^\\circ$, $\\mathrm{S}\\,60^\\circ\\,\\mathrm{E}$ is $120^\\circ$ and $\\mathrm{S}\\,60^\\circ\\,\\mathrm{W}$ is $240^\\circ$.",
    ],
    example: {
      prompt:
        "A ship sails 40 km on a bearing of $060^\\circ$. How far east has it gone?",
      steps: [
        "The path makes a $60^\\circ$ angle with the north-south line.",
        "The east leg is opposite that angle, so it is $40\\sin60^\\circ=20\\sqrt3$ km.",
        "The north leg is $40\\cos60^\\circ=20$ km.",
      ],
      answer: "$20\\sqrt3$ km east",
    },
    method: {
      title: "Sketch, then pick sine or cosine",
      paragraphs: [
        "Mark north, draw the path, and drop legs to the north-south line. The leg along the north-south line is adjacent to the angle, so it uses cosine; the east-west leg is opposite, so it uses sine.",
      ],
    },
    formal: {
      title: "Components",
      paragraphs: [
        "For bearing $B$ and distance $d$, east $=d\\sin B$ and north $=d\\cos B$, where a negative east value means west and a negative north value means south.",
      ],
    },
    pitfalls: [
      "Measure from north, clockwise.",
      "Check the direction of each leg from the quadrant.",
    ],
    parentGuide:
      "Ask the learner which direction is on a bearing of $180^\\circ$.",
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
