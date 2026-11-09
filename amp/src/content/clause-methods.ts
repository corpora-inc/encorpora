import type { ProblemMethod } from "./problem-lessons";

/** The added surfaces teach their own operation, rather than inheriting
 * numeric-entry instructions from an older surface of the same type. */
// Goal, intuition, at least two method steps, then the watch line.
const rows: Record<string, [string, string, string, string, string, ...string[]]> = {
  "explain-with-property": [
    "Explain why a table pattern holds for every entry.",
    "Splitting equal groups or changing the order of addends explains a whole row. Checking one cell only checks one case.",
    "Identify what changes and what stays the same as you move through the table.",
    "Split groups or rearrange addends without changing the total. Explain why this works in every column.",
    "A numerical example is not a reason that applies to every case.",
  ],
  "feature-why": [
    "Explain why the rule preserves or changes a pattern feature.",
    "Even numbers consist of pairs. Odd numbers have one leftover. Adding pairs keeps the leftover unchanged; adding an odd amount switches it.",
    "Separate the starting value from the amount added each step.",
    "Use pairs to explain odd and even, or tens and ones to explain the final digit. Apply the rule again.",
    "The step's last digit need not be the term's last digit.",
  ],
  "plot-situation": [
    "Plot the situation's input and output as an ordered pair.",
    "An ordered pair lists the horizontal amount first and the vertical amount second. The axis names identify the quantities.",
    "Read both axis names and form each pair in that order.",
    "Start at the axes' shared zero. Move across for the first number and up for the second.",
    "Count unit gaps, and keep each quantity on its named axis.",
  ],
  "graph-pairs": [
    "Make and plot matching terms from two patterns.",
    "Each point combines one term from each pattern at the same step. Its first coordinate is Pattern A's value.",
    "List four matching terms, including the starting values.",
    "Write each pair with the value from Pattern A first and Pattern B second, then plot across and up.",
    "A term and its position in the list are different quantities.",
  ],
  "why-multiple": [
    "Explain why one pattern is a constant multiple of another.",
    "When both patterns start at zero, each total repeats its step size the same number of times. The multiplier between steps also multiplies their totals.",
    "Compare both starting values and the sizes of one step.",
    "Describe any number of equal steps, then apply the multiplier to the entire sum.",
    "A difference between step sizes does not explain their ratio.",
  ],
  "list-and-graph": [
    "Compute ordered pairs from a rate rule and plot them.",
    "The independent quantity is the input you choose. The dependent quantity is the amount the rule produces.",
    "Substitute each input into the rule and multiply by the rate.",
    "Write (input, output). Plot input horizontally and output vertically.",
    "Multiplying by the rate differs from adding it to the input.",
  ],
  "linear-or-nonlinear": [
    "Distinguish a steady rate from a changing rate.",
    "A linear function changes by the same amount over equal input intervals. Its graph is straight, including horizontal lines.",
    "Compare equal horizontal intervals and their vertical changes.",
    "Equal changes give a linear piece. A curved piece has a changing rate.",
    "Increasing, decreasing and smooth do not mean linear.",
  ],
  "sketch-from-story": [
    "Match each part of a story to a graph.",
    "Time moves across the graph; the amount is its height. A constant amount gives a flat part while time continues.",
    "Add the durations to find the time at each change.",
    "Track the amount: rise for filling, stay flat for staying, and fall for draining.",
    "A duration changes the horizontal coordinate; it does not set the height.",
  ],
  "why-intersection": [
    "Explain why an intersection solves an equality of functions.",
    "At an intersection, the same input produces the same output for both functions.",
    "Read the crossing as (input, output).",
    "State that both functions return that output at that input. The input solves the equality.",
    "The crossing's height is the shared output; its horizontal coordinate is the solution.",
  ],
  "all-families": [
    "Approximate a function intersection to the nearest tenth.",
    "Subtracting the outputs shows which graph is higher. A sign change across a continuous interval brackets an intersection.",
    "Find consecutive tenths where the output difference changes sign.",
    "Test the halfway input. Locate the side with the sign change, then round.",
    "An asymptote can change the sign without a solution; check continuity.",
  ],
  "log-exponential-pairs": [
    "Count intersections of a logarithmic or exponential graph with a line.",
    "A solution is an input where both graphs have the same height. An increasing graph and a decreasing line meet at most once.",
    "Check the function's domain and the directions of the two graphs.",
    "Check that their continuous height difference changes sign. Then they meet once.",
    "A logarithm is defined only where its input is positive.",
  ],
  "build-model": [
    "Combine functions to model a changing quantity.",
    "Some amounts stay fixed while others change. Cooling adds room temperature to a shrinking excess. Profit subtracts costs from revenue.",
    "Name each component and decide whether it is fixed, linear or exponential.",
    "Combine the components as the situation requires. Check the result at input zero.",
    "A percentage decrease acts on the remaining excess, not a fixed number of degrees.",
  ],
  "compose-in-context": [
    "Feed one function's output into the next function.",
    "Composition is a chain: one rule produces the input another needs. Time can give height, which then gives temperature.",
    "Use the units to decide which function acts first.",
    "Substitute that entire expression into the second function. Check one numerical input.",
    "Adding functions does not perform one after the other.",
  ],
  "recursive-to-explicit": [
    "Write a direct rule from a starting term and repeated addition.",
    "A recursive rule reaches the next term. An explicit rule computes a named term directly. Reaching term $n$ from the first term takes $n-1$ steps.",
    "Identify the first term and the amount added each step.",
    "Add $(n-1)$ copies of the step to the first term, because reaching term $n$ takes $n-1$ additions.",
    "Check the first and third terms with both rules. The values must agree.",
    "Using $n$ steps moves once too far.",
  ],
  "from-graph": [
    "Recognize even and odd functions by graph symmetry.",
    "Even graphs mirror across the vertical axis. Odd graphs match after a half turn about the origin.",
    "Compare heights at opposite inputs, such as 1 and −1.",
    "Even heights match. Odd heights are opposites. Test the symmetry throughout the graph.",
    "Passing through the origin alone does not make a function odd.",
  ],
  "verify-by-composition": [
    "Verify inverse functions by composing in both orders.",
    "Inverse functions undo each other. Applying either function and then its inverse returns the original allowed input.",
    "Substitute the entire second function into the first and simplify.",
    "Reverse the order and check again, keeping domain restrictions. Both outputs must equal the input.",
    "The notation $f^{-1}$ means inverse function, not reciprocal.",
  ],
  "interpret-statement": [
    "Read function notation using the situation's units.",
    "In $C(3)=20$, the input is 3 and the output is 20. These might mean 3 hours and 20 dollars.",
    "Identify what the input measures and what the function returns.",
    "Attach those units to the input and output. Check restrictions on allowed inputs.",
    "The parentheses do not mean multiplication.",
  ],
  interpret: [
    "Interpret an average rate of change.",
    "An average rate spreads the total change evenly across an interval. Actual changes inside that interval may be uneven.",
    "Subtract endpoint outputs and divide by the change in input.",
    "State the direction, units and interval, and say on average.",
    "An average does not claim the same change happened each year.",
  ],
  "intercepts-and-vertex": [
    "Plot a quadratic's intercepts and turning point.",
    "An intercept is where a graph meets an axis. The vertex is the parabola's turning point, halfway between two distinct horizontal-axis intercepts.",
    "Set each factor equal to zero. Average the two roots for the vertex input.",
    "Substitute to find the vertex height. Substitute zero for the vertical-axis intercept.",
    "A factor $x-p$ vanishes at $p$, not $-p$.",
  ],
  "cube-root": [
    "Plot a cube-root curve's center and neighboring points.",
    "A cube root reverses cubing. The cube roots of −1, 0 and 1 are −1, 0 and 1.",
    "Set the expression inside the cube root to zero to locate the center.",
    "Use inputs one unit left and right. Apply the outside multiplier and vertical shift.",
    "A cube-root curve continues in both directions; it has no starting endpoint.",
  ],
  "graph-choice": [
    "Match a function rule to its graph.",
    "A graph must show the rule's values, allowed inputs and behavior at boundaries. Matching one point is insufficient.",
    "For piecewise rules, draw each formula only on its interval. Fill endpoints included by the inequality.",
    "For rational rules, find numerator zeros, excluded denominator zeros and the horizontal behavior of the leading terms.",
    "An open endpoint excludes its value. A denominator zero is not an intercept.",
  ],
  "rule-to-graph": [
    "Match polynomial factors to zeros and end behavior.",
    "An even number of copies of a factor preserves the sign across its zero: the graph touches. An odd number changes sign: it crosses.",
    "Find each zero and whether its exponent is even or odd.",
    "Add the exponents for the degree. Use degree and leading sign to check the ends.",
    "The zeros, crossing behavior and ends must all agree.",
  ],
  "equation-to-graph": [
    "Match a sine or cosine rule to its graph.",
    "The midline is the halfway height. Amplitude is the distance from there to a peak. Period is one horizontal cycle.",
    "Read the vertical shift and absolute value of the outside multiplier.",
    "Divide $2\\pi$ by the absolute input multiplier for the period. Check the initial direction.",
    "Peak-to-peak height is twice the amplitude.",
  ],
  "axes-definition": [
    "Name the parts of a coordinate system.",
    "Two perpendicular number lines form the axes. Their shared zero is the origin. An ordered pair gives horizontal then vertical position.",
    "Locate the number lines and their shared zero.",
    "Match each definition to the object it describes.",
    "An axis is a line; a coordinate is a number naming a position.",
  ],
  "wedge-rectangle": [
    "Explain how the circle's rim determines its area.",
    "Alternating thin wedges puts half the rim along the top and half along the bottom. As the wedges thin, their height approaches the radius.",
    "Use radius for height and half the circumference for width.",
    "Multiply: $A=\\tfrac12 Cr=\\pi r^2$. Distinguish radius from diameter.",
    "The whole circumference spans both long edges together.",
  ],
  "circumscribed-angle": [
    "Connect tangent, central and inscribed angles.",
    "A tangent touches a circle at one point and meets its radius at 90°. Two tangents and two radii make a quadrilateral with two right angles.",
    "Subtract the right angles from the quadrilateral's 360°. The outside angle and central angle sum to 180°.",
    "An inscribed angle on the same minor arc is half the central angle. Use the relation matching the question.",
    "The outside tangent angle is not an inscribed angle.",
  ],
  "cyclic-quad-proof": [
    "Prove the opposite-angle rule for an inscribed quadrilateral.",
    "An inscribed angle has its vertex on the circle and measures half its intercepted arc. Opposite angles intercept arcs covering the circle exactly once.",
    "Name each intercepted arc between the ray endpoints, excluding the angle's vertex.",
    "Add the arcs to 360°, then halve the sum. Give the reason for each step.",
    "Do not assume the opposite-angle conclusion to justify the arc sum.",
  ],
  "similarity-derivation": [
    "Derive the constant ratio of arc length to radius.",
    "A dilation scales every length by the same factor and leaves angle measures unchanged. Dividing arc length by radius cancels that factor.",
    "Divide image radius by original radius for the scale factor.",
    "Apply the factor to both arc and radius, then cancel it in their ratio. This ratio is the angle's radian measure.",
    "Dilation scales lengths, not angle measures.",
  ],
  "sector-formula-derivation": [
    "Derive a sector's area as a fraction of a disk.",
    "A sector is the part of a disk between two radii. Its fraction of the area equals its fraction of a full turn.",
    "Divide the angle by one full turn: 360 in degrees or $2\\pi$ in radians.",
    "Multiply by $\\pi r^2$. In radians this simplifies to $\\tfrac12r^2\\theta=\\tfrac12sr$.",
    "Use the same angle unit in the numerator and full-turn denominator.",
  ],
};
const proof: (typeof rows)[string] = [
  "Prove an angle theorem from givens and established facts.",
  "A proof gives a reason for every claim. The theorem being proved cannot supply its own reason. The prompt names the accepted starting postulate.",
  "Read the givens and conclusion. Find a chain of established facts connecting them.",
  "Place supporting statements before the lines that use them. To conclude parallelism from equal angles, use a converse theorem.",
  "A theorem and its converse run in different directions.",
];
for (const key of [
  "triangle-sum-theorem",
  "vertical-angles-theorem",
  "corresponding-angles-theorem",
])
  rows[key] = proof;
const construction: (typeof rows)[string] = [
  "Choose and justify a geometric construction step.",
  "A compass transfers an exact distance. A straightedge draws through known points. A fold is a reflection that preserves distances and angles.",
  "List the constructed points and the distance or angle to preserve. Choose the center, opening, line or fold enforcing that condition.",
  "Repeat the construction on paper with an unmarked straightedge and compass, or with a fold. Explain why its defining property holds.",
  "A step cannot use an unconstructed point. Two equal-radius endpoint circles need radius greater than half the segment for two intersections.",
];
for (const key of [
  "construct-by-figure",
  "fold-constructions",
  "copy-segment",
  "copy-angle",
  "parallel-through-point",
])
  rows[key] = construction;
export const clauseMethods: Record<string, ProblemMethod> = Object.fromEntries(
  Object.entries(rows).map(([key, [goal, intuition, ...stepsAndWatch]]) => [
    key,
    {
      goal,
      intuition,
      method: stepsAndWatch.slice(0, -1),
      watch: stepsAndWatch.at(-1)!,
    },
  ]),
);
