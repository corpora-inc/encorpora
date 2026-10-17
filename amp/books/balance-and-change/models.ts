import { Author, text, note, worked, table, plot } from "./authoring.js";
export function models(a: Author) {
  a.section = "models";
  a.page("slope", "Rate between two points", [
    text(
      "For a line, slope compares vertical change with horizontal change: change in y divided by change in x. Read the numerical scales; an angle on the paper depends on how the axes are drawn.",
    ),
    plot(
      "slope-triangle",
      {
        xMin: 0,
        xMax: 4,
        yMin: 0,
        yMax: 8,
        xStep: 1,
        yStep: 2,
        xLabel: "time in seconds",
        yLabel: "distance in meters",
        points: [
          { x: [0, 1], y: [1, 1], label: "A" },
          { x: [2, 1], y: [5, 1], label: "B", labelPosition: "nw" },
        ],
        lines: [{ slope: [2, 1], intercept: [1, 1], label: "L" }],
        segments: [
          {
            from: { x: [0, 1], y: [1, 1] },
            to: { x: [2, 1], y: [1, 1] },
            label: "run 2",
          },
          {
            from: { x: [2, 1], y: [1, 1] },
            to: { x: [2, 1], y: [5, 1] },
            label: "rise 4",
          },
        ],
      },
      "A is (0, 1) and B is (2, 5). The change is 4 meters in 2 seconds.",
    ),
    a.task(
      "slope-rate",
      "Find the slope from A to B and state its units. Explain why the starting height 1 is not the slope.",
      "2 meters per second.",
      "The vertical change is 5 − 1 = 4 meters and the horizontal change is 2 − 0 = 2 seconds. Their ratio is 4/2 = 2 meters per second. The starting height 1 describes a position at time zero, not a change per second.",
      "At 3 seconds, the same line gives 7 meters, another rise of 2 meters for 1 additional second.",
    ),
  ]);
  a.page("reverse-rate", "Keep subtraction order consistent", [
    text(
      "Either direction between two points gives the same slope if the subtraction order is consistent. Reversing the direction changes both differences, so their quotient stays the same.",
    ),
    worked(
      "Read the points backward",
      "Use A(0, 1) and B(2, 5).",
      [
        "From A to B: (5 − 1)/(2 − 0) = 4/2 = 2.",
        "From B to A: (1 − 5)/(0 − 2) = (−4)/(−2) = 2.",
        "Mixing the two orders gives a wrong sign.",
      ],
      "Choose one point as the starting point in both coordinates.",
    ),
    a.task(
      "slope-fraction",
      "Find the slope through (0, 2) and (4, 4). Give an exact fraction and explain its meaning as a change.",
      "1/2 unit of output per unit of input.",
      "The output increases by 4 − 2 = 2 while the input increases by 4 − 0 = 4. The ratio is 2/4 = 1/2. Reversing both differences gives the same ratio.",
      "A rise of 1 over a run of 2 describes the same rate.",
    ),
    a.task(
      "slope-order-error",
      "A learner uses (5 − 1)/(0 − 2) for A(0, 1), B(2, 5). Explain why the result −2 is incorrect.",
      "The numerator goes from A to B, but the denominator goes from B to A.",
      "Both coordinate changes must describe the same direction of travel between the two points. Using (5 − 1)/(2 − 0) or (1 − 5)/(0 − 2) gives the correct positive slope 2.",
      "The line rises as x increases, so a negative result also conflicts with its direction.",
    ),
  ]);
  a.page("similar-triangles", "Why one line has one rate", [
    text(
      "On a nonhorizontal, nonvertical straight line, choose distinct points and draw nondegenerate right triangles using horizontal and vertical legs. The triangles share the line’s acute angle and each has a right angle, so they are similar. Corresponding leg ratios agree.",
    ),
    plot(
      "similar-slope-triangles",
      {
        xMin: 0,
        xMax: 4,
        yMin: 0,
        yMax: 8,
        xStep: 1,
        yStep: 2,
        xLabel: "input x",
        yLabel: "output y",
        points: [
          { x: [0, 1], y: [1, 1], label: "A" },
          { x: [2, 1], y: [5, 1], label: "B", labelPosition: "nw" },
          { x: [3, 1], y: [7, 1], label: "C", labelPosition: "nw" },
        ],
        lines: [{ slope: [2, 1], intercept: [1, 1], label: "L" }],
        segments: [
          { from: { x: [0, 1], y: [1, 1] }, to: { x: [3, 1], y: [1, 1] } },
          { from: { x: [2, 1], y: [1, 1] }, to: { x: [2, 1], y: [5, 1] } },
          { from: { x: [3, 1], y: [1, 1] }, to: { x: [3, 1], y: [7, 1] } },
        ],
      },
      "A(0, 1), B(2, 5), C(3, 7): the ratios are 4/2 and 6/3.",
    ),
    a.task(
      "similar-ratios",
      "Explain why the larger triangle gives the same slope as the smaller one. What feature would fail if C moved off the line?",
      "Both ratios are 2. The right triangles share the line’s angle, so their corresponding legs are in the same proportion.",
      "The smaller rise and run are 4 and 2; the larger are 6 and 3. If C moved off the line, the triangle from A to C would generally have a different acute angle, so this similarity argument would no longer apply.",
      "A matching example ratio alone is not the whole geometric explanation; include the shared-angle reasoning.",
    ),
  ]);
  a.page("slope-rule", "From a rate to an equation", [
    text(
      "Suppose a nonvertical line crosses the vertical axis at (0, b) and has slope m. Moving from (0, b) to (x, y) changes the output by y − b and the input by x.",
    ),
    worked(
      "Connect the quantities",
      "Write a rule for a line with slope m and vertical intercept b.",
      [
        "For x different from zero, the constant rate gives (y − b)/x = m.",
        "Multiply by x: y − b = mx.",
        "Add b: y = mx + b. At x = 0, the rule gives y = b, the intercept itself.",
      ],
      "The rule combines an initial value with a rate of change.",
    ),
    a.task(
      "slope-rule-example",
      "Write the rule for the line through (0, 1), (2, 5), and (3, 7). Explain what each number in your rule means.",
      "y = 2x + 1.",
      "The slope is 2, so each unit increase in x adds 2 to y. The vertical intercept is 1, meaning the output is 1 at input zero. These roles produce the expression 2x + 1.",
      "At x = 2 the output is 5; at x = 3 it is 7.",
    ),
    note(
      "Keep the domain in view",
      "The algebra describes the mathematical line. A physical application may use only part of it; its allowed inputs belong in the model description.",
    ),
  ]);
  a.page("negative-change", "A quantity can decrease", [
    text(
      "A tank begins with 12 liters of water and drains at 2 liters per hour. While this model applies, V = 12 − 2t. The physical interval is 0 through 6 hours: after that, this tank has no water left to drain.",
    ),
    plot(
      "water-drain",
      {
        xMin: 0,
        xMax: 6,
        yMin: 0,
        yMax: 12,
        xStep: 1,
        yStep: 2,
        xLabel: "time in hours",
        yLabel: "water in liters",
        points: [
          { x: [0, 1], y: [12, 1], label: "A", labelPosition: "se" },
          { x: [6, 1], y: [0, 1], label: "B", labelPosition: "nw" },
        ],
        lines: [
          {
            slope: [-2, 1],
            intercept: [12, 1],
            label: "V",
            domain: [
              [0, 1],
              [6, 1],
            ],
          },
        ],
      },
      "The closed endpoints include the initial 12 liters and the empty tank at 6 hours.",
    ),
    a.task(
      "water-interpret",
      "State the slope with units and find the water left after 3 hours. Explain the negative sign.",
      "Slope: −2 liters per hour. After 3 hours: 6 liters.",
      "Each additional hour reduces the volume by 2 liters, so the rate is negative. Substitution gives V = 12 − 2 × 3 = 6. The sign describes a decrease, not a negative physical volume within the stated domain.",
      "At t = 6 the volume is zero; extending to t = 7 would produce −2, outside this physical model.",
    ),
  ]);
  a.page("zero-undefined", "Zero change and zero run", [
    text(
      "A horizontal line has zero vertical change, so its slope is zero. Two distinct points on a vertical line have zero horizontal change. Division by that zero run is undefined; it is not an ordinary numerical slope.",
    ),
    plot(
      "horizontal-vertical",
      {
        xMin: -2,
        xMax: 4,
        yMin: -2,
        yMax: 4,
        xStep: 1,
        yStep: 1,
        xLabel: "input x",
        yLabel: "output y",
        points: [],
        lines: [{ slope: [0, 1], intercept: [3, 1], label: "H" }],
        segments: [
          {
            from: { x: [2, 1], y: [-2, 1] },
            to: { x: [2, 1], y: [4, 1] },
            label: "V",
          },
        ],
      },
      "H keeps y = 3. The vertical segment V keeps x = 2.",
    ),
    a.task(
      "zero-undefined-explain",
      "Compare the horizontal line H with the vertical segment V. Which has slope zero? Which fails the function rule when x is the input?",
      "H has slope zero. V has undefined slope and fails the function rule.",
      "Along H, the output remains 3 while the input changes, so rise/run is zero. Along V, the input stays 2 while many different outputs occur. Its run is zero, and one input has multiple outputs.",
      "A constant output can define a function; a constant input with multiple outputs cannot.",
    ),
  ]);
  a.page("intercept", "The first row is not always zero", [
    text(
      "The vertical intercept is the output at input zero. A table may begin at a different input, so its first output is not automatically the intercept.",
    ),
    table(
      "intercept-table",
      "Time (hours)",
      "Cost (dollars)",
      [
        { input: [2, 1], output: [8, 1] },
        { input: [4, 1], output: [14, 1] },
      ],
      "Assume this cost follows one linear rule.",
    ),
    worked(
      "Work back to zero",
      "Find the rate and initial value.",
      [
        "The change is 6 dollars over 2 hours, giving 3 dollars per hour.",
        "At 2 hours, the changing part is 3 × 2 = 6 dollars.",
        "Subtract that part from the total 8: the initial value is 2 dollars.",
      ],
      "The rule is C = 3t + 2. This inference uses the stated linear assumption.",
    ),
    a.task(
      "intercept-repair",
      "A learner writes C = 3t + 8 because 8 is the first cost in the table. Test the rule at t = 2 and repair it.",
      "The proposed rule gives 14 at t = 2, not 8. The corrected rule is C = 3t + 2.",
      "The observed 8 already includes the cost accumulated over the first 2 hours. Treating it as the zero-hour value counts that changing part again. Subtracting 6 identifies the actual intercept.",
      "The repaired rule gives 8 at 2 hours and 14 at 4 hours.",
    ),
  ]);
  a.page("build-model", "Two points and a linear assumption", [
    text(
      "Two distinct points with different x-coordinates determine one line. They do not prove that an unknown real-world relationship is linear. State that modeling assumption before extending beyond the observations.",
    ),
    plot(
      "half-rate-line",
      {
        xMin: 0,
        xMax: 6,
        yMin: 0,
        yMax: 6,
        xStep: 1,
        yStep: 1,
        xLabel: "input x",
        yLabel: "output y",
        points: [
          { x: [0, 1], y: [2, 1], label: "A" },
          { x: [4, 1], y: [4, 1], label: "B", labelPosition: "nw" },
        ],
        lines: [{ slope: [1, 2], intercept: [2, 1], label: "L" }],
      },
      "A is (0, 2), B is (4, 4). The displayed model is linear.",
    ),
    a.task(
      "model-build",
      "Find the equation of this line, then decide whether (6, 5) and (6, 6) lie on it.",
      "y = (1/2)x + 2. The point (6, 5) lies on it; (6, 6) does not.",
      "The slope is (4 − 2)/(4 − 0) = 1/2 and the intercept is 2. At x = 6 the rule gives 3 + 2 = 5, so there is only one corresponding output on the line.",
      "Both original points satisfy the rule. The same input 6 cannot have both outputs in this function.",
    ),
  ]);
  a.page("nonlinear", "A pattern need not be a line", [
    text(
      "A square of side length s has area s × s. For sides 1, 2 and 3 units, the areas are 1, 4 and 9 square units. Equal changes in side length produce unequal changes in area.",
    ),
    plot(
      "square-area-samples",
      {
        xMin: 0,
        xMax: 4,
        yMin: 0,
        yMax: 10,
        xStep: 1,
        yStep: 2,
        xLabel: "side length in units",
        yLabel: "area in square units",
        points: [
          { x: [1, 1], y: [1, 1], label: "A" },
          { x: [2, 1], y: [4, 1], label: "B" },
          { x: [3, 1], y: [9, 1], label: "C", labelPosition: "sw" },
        ],
      },
      "These three square-area samples do not lie on one line.",
    ),
    a.task(
      "nonlinear-changes",
      "Use the output changes to explain why no single linear rule can pass through all three samples.",
      "The area increases by 3, then by 5, while side length increases by 1 each time. The two rates differ.",
      "A line would have the same output/input change ratio between any two of its points. Here the ratios are 3/1 and 5/1. The square-area rule is a function, but it is not linear.",
      "Function does not mean linear. Each side length still has exactly one square area.",
    ),
  ]);
  a.page("compare-models", "Faster change or larger value?", [
    text(
      "A larger rate and a larger starting value are different advantages. Compare both before deciding which model gives the larger output at a particular input.",
    ),
    table(
      "compare-table",
      "Input x",
      "Model A output",
      [
        { input: [0, 1], output: [5, 1] },
        { input: [2, 1], output: [9, 1] },
        { input: [4, 1], output: [13, 1] },
      ],
      "Model A is linear. Model B follows y = 3x + 1.",
    ),
    a.task(
      "compare-start-rate",
      "Find the rate and initial value of each model. Which starts larger, and which changes faster as x increases?",
      "A: rate 2, initial value 5. B: rate 3, initial value 1. A starts larger; B changes faster.",
      "A rises by 4 over an input change of 2, giving rate 2, and its zero-input value is 5. B exposes its rate and intercept directly in 3x + 1. The larger rate does not erase A’s starting advantage at every input.",
      "At x = 0, A = 5 and B = 1.",
    ),
    a.task(
      "compare-tie",
      "At what input do these two models agree? Check both outputs.",
      "x = 4; both outputs are 13.",
      "The rule for A is y = 2x + 5. Setting 2x + 5 = 3x + 1 and subtracting 2x and 1 gives x = 4. Substitution gives 13 in both models.",
      "At x = 2, A = 9 and B = 7; at x = 5, A = 15 and B = 16.",
    ),
  ]);
  a.page("intersection", "One point, two rules", [
    text(
      "Two session plans charge A = 3t + 2 and B = 2t + 6 dollars for t hours. Both accept any duration from 0 through 6 hours. Their intersection is a pair that satisfies both cost rules at once.",
    ),
    plot(
      "plan-intersection",
      {
        xMin: 0,
        xMax: 6,
        yMin: 0,
        yMax: 20,
        xStep: 1,
        yStep: 5,
        xLabel: "duration in hours",
        yLabel: "cost in dollars",
        points: [{ x: [4, 1], y: [14, 1], label: "P", labelPosition: "sw" }],
        lines: [
          {
            slope: [3, 1],
            intercept: [2, 1],
            label: "A",
            domain: [
              [0, 1],
              [6, 1],
            ],
          },
          {
            slope: [2, 1],
            intercept: [6, 1],
            label: "B",
            domain: [
              [0, 1],
              [6, 1],
            ],
          },
        ],
      },
      "P is the time-and-cost pair shared by both plans.",
    ),
    a.task(
      "intersection-check",
      "Read the intersection, then check it in both rules. State what each coordinate means.",
      "(4, 14): a 4-hour session costs 14 dollars under either plan.",
      "Plan A gives 3 × 4 + 2 = 14. Plan B gives 2 × 4 + 6 = 14. The horizontal coordinate is duration, while the vertical coordinate is cost. Both must belong to the same shared point.",
      "The output 14 alone does not specify the duration; the pair describes the full intersection.",
    ),
  ]);
  a.page("system", "Solve for the shared pair", [
    text(
      "A system asks for values that satisfy all its equations together. For two linear rules, an intersection in the graph corresponds to a common solution. Algebra can locate that pair exactly.",
    ),
    worked(
      "Equate the two outputs",
      "Solve y = 2x + 1 and y = −x + 7.",
      [
        "At a shared point, 2x + 1 = −x + 7.",
        "Add x and subtract 1: 3x = 6, so x = 2.",
        "Substitute into either rule: y = 2 × 2 + 1 = 5.",
      ],
      "The shared pair is (2, 5). Check the other rule too: −2 + 7 = 5.",
    ),
    a.task(
      "system-pair",
      "Solve y = x + 4 and y = 3x. Give the complete ordered pair and check both rules.",
      "(2, 6).",
      "A shared output requires x + 4 = 3x. Subtracting x gives 4 = 2x, so x = 2. Then y = 6. The first rule gives 2 + 4 = 6 and the second gives 3 × 2 = 6.",
      "An x-only answer identifies part of the solution; the system’s point requires both coordinates.",
    ),
    a.task(
      "system-candidate",
      "Does (3, 7) solve the worked system y = 2x + 1 and y = −x + 7? Explain.",
      "No.",
      "It satisfies the first rule because 2 × 3 + 1 = 7. It fails the second because −3 + 7 = 4, not 7. A system solution must satisfy both equations, not just one.",
      "Testing both original rules is essential.",
      "short",
    ),
  ]);
  a.page("elimination", "Eliminate a shared quantity", [
    text(
      "When both equations mix x and y, make one coefficient agree and subtract the equalities. The shared quantity cancels, leaving an equation in one unknown. Substitute the result into an original equation to recover the other coordinate.",
    ),
    worked(
      "Match the y-coefficients",
      "Solve 2x + 3y = 12 and 3x + 2y = 13.",
      [
        "Multiply the first equality by 2: 4x + 6y = 24.",
        "Multiply the second equality by 3: 9x + 6y = 39.",
        "Subtract the first new equality from the second: 5x = 15, so x = 3.",
        "Substitute into 2x + 3y = 12: 6 + 3y = 12, so y = 2.",
      ],
      "The solution is (3, 2). Both original equations check: 6 + 6 = 12 and 9 + 4 = 13.",
    ),
    a.task(
      "elimination-pair",
      "Solve 3x + 2y = 16 and x + 2y = 8 by eliminating y. Give the ordered pair and check both equations.",
      "(4, 2).",
      "Subtract the second equality from the first: 2x = 8, so x = 4. Substitution into x + 2y = 8 gives 4 + 2y = 8, hence y = 2. The equal y-coefficients make subtraction convenient.",
      "3 × 4 + 2 × 2 = 16 and 4 + 2 × 2 = 8.",
    ),
    note(
      "Keep a recoverable equation",
      "The difference equation alone may describe many pairs. Keep an original equation as well; together they recover the same system solutions.",
    ),
  ]);
  a.page("parallel-identical", "No meeting, or the same line", [
    plot(
      "parallel-lines",
      {
        xMin: 0,
        xMax: 4,
        yMin: 0,
        yMax: 12,
        xStep: 1,
        yStep: 2,
        xLabel: "input x",
        yLabel: "output y",
        points: [],
        lines: [
          { slope: [2, 1], intercept: [1, 1], label: "A" },
          { slope: [2, 1], intercept: [4, 1], label: "B" },
        ],
      },
      "A follows y = 2x + 1. B follows y = 2x + 4.",
    ),
    a.task(
      "parallel-reason",
      "Explain why these two lines never meet, even beyond the window. Use an equation or a constant difference.",
      "They have no common point. Their outputs differ by 3 for every x.",
      "Equating the outputs gives 2x + 1 = 2x + 4, which reduces to 1 = 4. The equal rates keep the separation constant; extending the lines cannot repair the contradiction.",
      "The statement concerns these two complete mathematical lines, not only the visible window.",
    ),
    a.task(
      "identical-reason",
      "Compare y = 2(x + 1) with y = 2x + 2. How many shared points do the complete lines have?",
      "Infinitely many; they are the same line.",
      "Distributivity makes the two rules identical for every real x. Each input gives the same output under both rules, so every point on one line is also on the other.",
      "This is a whole set of ordered pairs. It is not a single point labeled “all real numbers.”",
    ),
  ]);
  a.page("qualitative", "Read the meaning of the height", [
    text(
      "A walker follows a straight path away from home, rests, then returns along that path. The vertical quantity is distance from home, not the total distance already walked.",
    ),
    plot(
      "walk-story",
      {
        xMin: 0,
        xMax: 6,
        yMin: 0,
        yMax: 6,
        xStep: 1,
        yStep: 1,
        xLabel: "time in hours",
        yLabel: "distance from home in km",
        points: [
          { x: [0, 1], y: [0, 1] },
          { x: [2, 1], y: [4, 1] },
          { x: [3, 1], y: [4, 1] },
          { x: [5, 1], y: [0, 1] },
        ],
        segments: [
          { from: { x: [0, 1], y: [0, 1] }, to: { x: [2, 1], y: [4, 1] } },
          { from: { x: [2, 1], y: [4, 1] }, to: { x: [3, 1], y: [4, 1] } },
          { from: { x: [3, 1], y: [4, 1] }, to: { x: [5, 1], y: [0, 1] } },
        ],
      },
      "The graph rises, stays level, then falls as the walker returns home.",
    ),
    a.task(
      "walk-interpret",
      "Explain the level and falling portions. Could a graph of total distance walked have the same falling portion?",
      "The level part represents rest on this straight-path trip. The falling part means the walker gets closer to home. Total distance walked would not decrease.",
      "From hour 2 to 3, distance from home remains 4 km. From hour 3 to 5, that distance shrinks to zero. Total distance walked accumulates movement and cannot undo kilometers already traveled.",
      "A falling distance-from-home graph does not mean the walker has a negative distance or is necessarily slowing down.",
    ),
  ]);
}
