import { Author, text, note, worked, table, plot } from "./authoring.js";
export function relationships(a: Author) {
  a.section = "relationships";
  a.page("paired-quantities", "Two quantities together", [
    text(
      "An equation can describe many input-output pairs. A bicycle workshop charges 2 dollars to begin a session and 3 dollars per hour. If t is the time in hours and C is the cost in dollars, C = 3t + 2.",
    ),
    table(
      "cost-table",
      "Time t (hours)",
      "Cost C (dollars)",
      [
        { input: [0, 1], output: [2, 1] },
        { input: [1, 1], output: [5, 1] },
        { input: [2, 1], output: [8, 1] },
        { input: [3, 1], output: [11, 1] },
      ],
      "The starting charge is paid once. Each additional hour adds 3 dollars.",
    ),
    a.task(
      "paired-forward",
      "Find the cost for 4 hours. Explain which part of your calculation represents the starting charge.",
      "14 dollars.",
      "Four hours contribute 3 × 4 = 12 dollars. The fixed starting charge adds 2 dollars, giving 14. The charge is added once, not once per hour.",
      "C = 3(4) + 2 = 14.",
    ),
    a.task(
      "paired-backward",
      "A session costs 8 dollars. Use the same rule to find its duration.",
      "2 hours.",
      "The variable part of the bill is 8 − 2 = 6 dollars. At 3 dollars per hour, that pays for 6 ÷ 3 = 2 hours. Solving for an unknown input and evaluating a known input use the same relationship.",
      "3(2) + 2 = 8 dollars.",
      "short",
    ),
  ]);
  a.page("coordinates", "Order gives a position", [
    text(
      "An ordered pair (x, y) gives a horizontal coordinate first and a vertical coordinate second. Starting at the origin, negative x moves left and positive y moves up. Reversing the coordinates usually changes the point.",
    ),
    plot(
      "coordinate-order",
      {
        xMin: -4,
        xMax: 4,
        yMin: -4,
        yMax: 4,
        xStep: 1,
        yStep: 1,
        xLabel: "horizontal coordinate",
        yLabel: "vertical coordinate",
        points: [
          { x: [-2, 1], y: [3, 1], label: "A" },
          { x: [3, 1], y: [-2, 1], label: "B", labelPosition: "nw" },
        ],
      },
      "A is (−2, 3). B is (3, −2). The order matters.",
    ),
    a.task(
      "coordinate-describe",
      "Describe how to locate (−3, −1) from the origin. In which half of the plane is it horizontally and vertically?",
      "Move 3 units left and 1 unit down; it lies left of the vertical axis and below the horizontal axis.",
      "The first coordinate determines the horizontal move. The second determines the vertical move. The signs describe direction relative to zero, not the order in which numbers should be made positive.",
      "Returning 3 units right and 1 unit up reaches the origin.",
    ),
  ]);
  a.page(
    "coordinate-studio",
    "Build a readable coordinate map",
    [
      text(
        "A useful graph names its axes and makes the scale visible. A square on the paper is a drawing space; its numerical meaning comes from the labels you choose.",
      ),
      a.task(
        "coordinate-draw",
        "Draw axes from −4 to 4 in both directions, with one unit per grid square. Plot P(−3, 2), Q(2, −3), and R(0, −2). Label the points and origin.",
        "P is 3 left and 2 up; Q is 2 right and 3 down; R is on the vertical axis, 2 down.",
        "The axes must cross at zero and use an even one-unit scale. The x-coordinate of R is zero, so R does not move horizontally. Point names must attach to the intended positions.",
        "Check each point by reading the horizontal coordinate first, then the vertical coordinate.",
        "extended",
        "grid",
      ),
      a.task(
        "coordinate-scale",
        "A graph labels horizontal ticks 0, 2, 4, 6. A point lies on the third tick to the right of zero. What is its x-coordinate? Explain.",
        "6.",
        "Each tick interval represents 2 units. Three intervals therefore represent 3 × 2 = 6 units. Counting grid intervals without reading their scale would incorrectly give 3.",
        "The stated tick labels already identify the third tick as 6.",
      ),
    ],
    "workshop",
  );
  a.page("table-to-graph", "One row becomes one point", [
    text(
      "In the cost rule C = 3t + 2, a table row with time 2 and cost 8 becomes the point (2, 8). Put the input on the horizontal axis and its corresponding output on the vertical axis.",
    ),
    plot(
      "cost-samples",
      {
        xMin: 0,
        xMax: 4,
        yMin: 0,
        yMax: 15,
        xStep: 1,
        yStep: 5,
        xLabel: "time in hours",
        yLabel: "cost in dollars",
        points: [
          { x: [0, 1], y: [2, 1], label: "A" },
          { x: [2, 1], y: [8, 1], label: "B" },
          { x: [4, 1], y: [14, 1], label: "C", labelPosition: "sw" },
        ],
      },
      "Each plotted pair joins one time with its corresponding cost.",
    ),
    a.task(
      "row-to-point",
      "Write the ordered pair for a 3-hour session costing 11 dollars. Explain why (11, 3) would describe different quantities on these axes.",
      "(3, 11).",
      "The horizontal coordinate is time, so it must be 3. The vertical coordinate is cost, so it must be 11. On these axes, (11, 3) would mean 11 hours and a cost of 3 dollars, a different claim.",
      "Substituting t = 3 into C = 3t + 2 gives C = 11.",
    ),
    note(
      "A sample and a rule",
      "The drawn points display three examples. A rule and its domain tell us which other input-output pairs belong to the relationship.",
    ),
  ]);
  a.page("function", "One output for each input", [
    text(
      "A function assigns exactly one output to each input in its domain. Different inputs may share an output. Repeating a recorded pair does not add a conflicting output.",
    ),
    table(
      "function-table",
      "Input",
      "Output",
      [
        { input: [1, 1], output: [4, 1] },
        { input: [1, 1], output: [4, 1] },
        { input: [2, 1], output: [4, 1] },
        { input: [3, 1], output: [7, 1] },
      ],
      "The repeated input 1 keeps the same output 4.",
    ),
    a.task(
      "function-explain",
      "Does this table describe a function on the listed inputs? Explain both the repeated input and the shared output.",
      "Yes, on the listed inputs 1, 2 and 3.",
      "Input 1 is recorded twice but both records give output 4. Inputs 1 and 2 sharing output 4 is allowed because each input still has only one output. Input 3 has output 7.",
      "The function rule restricts outputs per input, not inputs per output.",
    ),
    a.task(
      "function-conflict",
      "Would adding the pair (2, 9) preserve the function property? Explain.",
      "No.",
      "Input 2 already has output 4. Adding output 9 for that same input would give two different outputs. The conflict concerns input 2 specifically, not the fact that 9 is a new number.",
      "Adding (4, 9) instead would not conflict with any listed input.",
      "short",
    ),
  ]);
  a.page(
    "repair-function",
    "Locate the conflicting claim",
    [
      table(
        "nonfunction-table",
        "Input",
        "Output",
        [
          { input: [1, 1], output: [4, 1] },
          { input: [1, 1], output: [5, 1] },
          { input: [2, 1], output: [8, 1] },
        ],
        "Read every record for an input before deciding whether its output is unique.",
      ),
      a.task(
        "function-repair",
        "Repair this table so it represents a function by changing exactly one output. Explain why your repair works.",
        "Change the output 5 to 4, or change the output 4 to 5.",
        "Both records for input 1 must agree. Either listed repair makes input 1 have exactly one output while keeping input 2 mapped to 8. Changing only the output for input 2 would leave the conflict at input 1 unresolved.",
        "There are two valid repairs under the stated one-output-change rule.",
        "large",
      ),
      note(
        "A formula also needs a domain",
        "A formula does not automatically permit every input. For example, a rule involving division by x cannot use x = 0. A context may restrict the inputs further.",
      ),
    ],
    "workshop",
  );
  a.page("domain", "When may you connect points?", [
    text(
      "Tickets cost 4 dollars each. The input n is the number of whole tickets bought. The rule C = 4n applies to the allowed whole-number inputs; a line joining the points would also display quantities such as half a ticket.",
    ),
    plot(
      "ticket-points",
      {
        xMin: 0,
        xMax: 5,
        yMin: 0,
        yMax: 20,
        xStep: 1,
        yStep: 5,
        xLabel: "number of tickets",
        yLabel: "cost in dollars",
        points: Array.from({ length: 6 }, (_, n) => ({
          x: [n, 1] as [number, number],
          y: [4 * n, 1] as [number, number],
        })),
      },
      "These ticket purchases use whole-number inputs.",
    ),
    a.task(
      "domain-contrast",
      "A bicycle session adds a fixed starting fee to a constant hourly charge and allows any duration from 0 through 6 hours. Explain why 1.5 hours may be allowed there even though 1.5 tickets is not allowed in this ticket model.",
      "Time is allowed to vary continuously in the bicycle rule, while tickets are purchased as whole items.",
      "The context determines which inputs belong to each domain. The same arithmetic ability to evaluate a formula at 1.5 does not establish that the resulting purchase is permitted.",
      "For C = 3t + 2, a 1.5-hour session costs 6.5 dollars under the stated constant hourly rate plus starting fee.",
    ),
  ]);
  a.page("unequal-steps", "Compare changes fairly", [
    text(
      "A change in output only becomes a rate when it is compared with the corresponding change in input. Larger input intervals can produce larger output changes even when the rate stays constant.",
    ),
    table(
      "unequal-step-table",
      "Time (hours)",
      "Cost (dollars)",
      [
        { input: [0, 1], output: [2, 1] },
        { input: [1, 1], output: [5, 1] },
        { input: [3, 1], output: [11, 1] },
      ],
      "The input steps are 1 hour and 2 hours, not equal steps.",
    ),
    worked(
      "Divide by the input change",
      "Find the rate on each interval.",
      [
        "From 0 to 1 hour, cost increases by 3 dollars: 3/1 = 3 dollars per hour.",
        "From 1 to 3 hours, cost increases by 6 dollars: 6/2 = 3 dollars per hour.",
      ],
      "The rate agrees on these two intervals.",
    ),
    a.task(
      "unequal-error",
      "A learner says the rate doubled because the output increases were 3 and 6. Explain the missing comparison.",
      "The second input interval is twice as long. Both rates are 3 dollars per hour.",
      "The learner compared output changes alone. Dividing each output change by its own input change puts the intervals on the same per-hour basis.",
      "A table of samples supports the interval comparison; a stated linear rule extends the constant rate throughout its domain.",
    ),
  ]);
  a.page("unit-rate", "Find the common multiplier", [
    text(
      "When a total cost is proportional to the number of identical items, dividing the total by the count gives the cost of one item. That unit price is the constant multiplier in the rule.",
    ),
    table(
      "unit-price-table",
      "Notebooks",
      "Cost (dollars)",
      [
        { input: [3, 1], output: [12, 1] },
        { input: [1, 1], output: [4, 1] },
        { input: [7, 1], output: [28, 1] },
      ],
      "Each notebook contributes the same 4 dollars, with no added starting fee.",
    ),
    worked(
      "Scale through one",
      "Three identical notebooks cost 12 dollars. Find the cost of seven at the same unit price.",
      [
        "One notebook costs 12/3 = 4 dollars.",
        "Seven notebooks cost 7 × 4 = 28 dollars.",
      ],
      "The rule is C = 4n, where n counts notebooks.",
    ),
    a.task(
      "unit-price-transfer",
      "Six identical art cards cost 18 dollars. At the same unit price, what do eight cards cost? Explain the multiplier.",
      "24 dollars.",
      "Dividing 18 by 6 gives 3 dollars per card. Multiplying by 8 gives 24 dollars. The price of one card is the common multiplier, not the original total price of 18.",
      "Both 18/6 and 24/8 equal 3 dollars per card.",
    ),
  ]);
  a.page("proportional", "A line through the origin", [
    text(
      "In a proportional relationship y = kx, the same multiplier k connects every input-output pair. At x = 0, the output is 0. Adding a fixed starting amount changes that relationship.",
    ),
    plot(
      "origin-compare",
      {
        xMin: 0,
        xMax: 4,
        yMin: 0,
        yMax: 15,
        xStep: 1,
        yStep: 5,
        xLabel: "input x",
        yLabel: "output y",
        points: [],
        lines: [
          { slope: [3, 1], intercept: [0, 1], label: "A" },
          { slope: [3, 1], intercept: [2, 1], label: "B" },
        ],
      },
      "A follows y = 3x. B follows y = 3x + 2.",
    ),
    a.task(
      "proportion-classify",
      "Which rule is proportional, y = 3x or y = 3x + 2? Explain using both the origin and the meaning of a constant multiplier.",
      "Only y = 3x is proportional.",
      "Its output is three times every input, including zero. The other rule adds 2 after multiplying, so it gives output 2 at input zero and does not maintain a single output/input multiplier for nonzero inputs.",
      "Both are linear. Being a straight line alone does not establish proportionality.",
    ),
  ]);
}
