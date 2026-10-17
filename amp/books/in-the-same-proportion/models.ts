import { Author, text, note, table, diagram, worked } from "./authoring.js";
export function models(a: Author) {
  a.section = "models";
  a.page("check-the-pairs", "Different steps can preserve one ratio", [
    table(
      "unequal-ratio-steps",
      "concentrate (liters)",
      "water (liters)",
      [
        { input: [1, 1], output: [3, 2] },
        { input: [3, 1], output: [9, 2] },
        { input: [6, 1], output: [9, 1] },
      ],
      "Each observed pair has water/concentrate = 3/2. Input steps differ, so raw output changes differ too.",
    ),
    text(
      "From one to three liters of concentrate, the input grows by two and water grows by three. From three to six, the input grows by three and water grows by 4 1/2. Unequal changes do not by themselves break proportionality: compare the amount per input unit.",
    ),
    a.task(
      "table-ratio-check",
      "Check all three water/concentrate quotients. Assuming the recipe remains proportional, predict water for 4 liters of concentrate.",
      "Each quotient is 3/2. Four liters require 6 liters of water.",
      "(3/2)/1 = 3/2; (9/2)/3 = 3/2; 9/6 = 3/2. Under the stated proportional recipe, multiply the new input 4 by 3/2.",
      "Four concentrate liters and six water liters simplify to 2:3.",
      "medium",
    ),
  ]);
  a.page(
    "evidence-and-assumption",
    "Three rows do not determine every future row",
    [
      table(
        "finite-evidence",
        "input",
        "output",
        [
          { input: [0, 1], output: [0, 1] },
          { input: [1, 1], output: [2, 1] },
          { input: [2, 1], output: [4, 1] },
        ],
        "These recorded pairs are consistent with a proportional rule. The table alone does not state how every other input behaves.",
      ),
      text(
        "The rule y = 2 x fits all three rows. But a relation that agrees on these inputs and gives output 7 at input 3 also fits the recorded evidence. Finite examples do not establish every unobserved value.",
      ),
      a.task(
        "finite-table-claim",
        "Repair this claim: ‘The table proves the output at 3 must be 6.’ State an extra assumption that makes 6 a justified prediction.",
        "Assuming the relationship is proportional for the input range, the output at 3 is 6.",
        "The nonzero rows identify multiplier 2 if the proportional model is assumed. Without a rule or further evidence, the unrecorded input need not follow that multiplier.",
        "A possible extension with output 7 at 3 shows why the original claim was too strong.",
        "medium",
      ),
      note(
        "A useful model is explicit",
        "In a recipe, a fixed mixing rule can justify scaling. In measured data, look for evidence about how the process works as well as numerical agreement.",
        "connect",
      ),
    ],
  );
  a.page("proportional-graph", "A point tells two quantities at once", [
    diagram({
      kind: "coordinate-plot",
      id: "mixture-graph",
      xMin: 0,
      xMax: 6,
      yMin: 0,
      yMax: 9,
      xStep: 1,
      yStep: 3,
      xLabel: "concentrate (liters)",
      yLabel: "water (liters)",
      points: [
        { x: [0, 1], y: [0, 1], label: "O", labelPosition: "ne" },
        { x: [2, 1], y: [3, 1], label: "A", labelPosition: "nw" },
        { x: [4, 1], y: [6, 1], label: "B", labelPosition: "nw" },
      ],
      lines: [
        {
          slope: [3, 2],
          intercept: [0, 1],
          label: "R",
          domain: [
            [0, 1],
            [6, 1],
          ],
        },
      ],
      caption:
        "Liquid inputs from 0 through 6 liters are allowed. Water y = (3/2)x; fractional inputs lie on the segment.",
      alt: "Concentrate on the horizontal axis from 0 to 6 liters; water on the vertical from 0 to 9 liters. A straight recipe segment joins(0, 0)to(6, 9), with A(2, 3)and B(4, 6).",
    }),
    text(
      "Point A means 2 liters of concentrate go with 3 liters of water. The multiplier 3/2 has units liters of water per liter of concentrate. Reversing the axes would reverse that numerical rate.",
    ),
    a.task(
      "graph-fraction-input",
      "Under this recipe, what point represents 1 liter of concentrate? Explain why it lies between 0 and 3 on the water axis.",
      "(1, 3/2), or(1, 1.5).",
      "The input is one concentrate liter. Multiplying by 3/2 gives 1.5 water liters, a feasible liquid amount between one and two.",
      "Doubling both coordinates gives A(2, 3).",
      "medium",
    ),
  ]);
  a.page("whole-object-domain", "Dots can be more honest than a line", [
    diagram({
      kind: "coordinate-plot",
      id: "bead-domain",
      xMin: 0,
      xMax: 6,
      yMin: 0,
      yMax: 9,
      xStep: 1,
      yStep: 3,
      xLabel: "orange beads",
      yLabel: "teal beads",
      points: [
        { x: [0, 1], y: [0, 1], label: "O", labelPosition: "ne" },
        { x: [2, 1], y: [3, 1], label: "A", labelPosition: "nw" },
        { x: [4, 1], y: [6, 1], label: "B", labelPosition: "nw" },
        { x: [6, 1], y: [9, 1], label: "C", labelPosition: "sw" },
      ],
      caption:
        "O, A, B and C show 0, 1, 2 and 3 kits. Each kit has 2 orange and 3 teal beads; fractional kits are not offered.",
      alt: "Four feasible pairs are plotted without a line: (0, 0), (2, 3), (4, 6), (6, 9), labeled zero through three kits.",
    }),
    a.task(
      "domain-one-bead",
      "The numerical rate is 3/2 teal beads per orange bead. Why is the point(1, 3/2)not an offered kit here? Is the rate itself incorrect?",
      "That point requires a fractional teal bead and half a kit. The numerical rate is correct, but the offered whole-kit domain excludes it.",
      "A rate describes the relationship between allowed quantities. It need not make a one-unit purchase or every point on a continuous line physically available.",
      "All offered nonzero pairs have teal/orange = 3/2.",
      "medium",
    ),
    note(
      "Zero is a model value, not a quotient",
      "Zero kits require zero of both colors. That gives the point(0, 0). Do not calculate its rate as 0/0; division by zero is undefined. Use a nonzero pair or the stated kit rule.",
      "misconception",
    ),
  ]);
  a.page("starting-fee", "A straight line can fail the proportional test", [
    table(
      "fee-versus-rate",
      "hours",
      "cost in dollars",
      [
        { input: [0, 1], output: [4, 1] },
        { input: [1, 1], output: [7, 1] },
        { input: [2, 1], output: [10, 1] },
        { input: [4, 1], output: [16, 1] },
      ],
      "A rental plan charges a fixed $4 starting fee plus $3 per hour. The hour inputs shown are permitted durations.",
    ),
    text(
      "The cost increases by $3 for every additional hour, but cost/hour is not constant: at one hour it is 7, at two hours it is 5, and at four hours it is 4. A constant added rate does not erase the starting fee.",
    ),
    worked(
      "Compare two rules",
      "A costs 3 x dollars; B costs 3 x + 4 dollars.",
      [
        "A gives zero cost at zero hours and the same quotient 3 for every nonzero input.",
        "B gives four dollars at zero hours and different total-cost/hour quotients.",
      ],
      "A is proportional on the stated duration domain. B is affine with a fixed fee; it is not proportional.",
    ),
    a.task(
      "fee-repair",
      "A learner calls B proportional because its graph is straight. Give two different checks that correct the claim.",
      "B does not pass through the origin; and its cost/hour quotient changes between nonzero inputs.",
      "Either check disproves proportionality for this rule. A straight graph only establishes an affine form, not the special zero-intercept form y = kx.",
      undefined,
      "medium",
    ),
  ]);
  a.page(
    "model-repair",
    "Repair the relationship, not just one answer",
    [
      a.task(
        "repair-pairs",
        "A poster claims water = (3/2) × concentrate. Its table lists(2, 3), (4, 6), (6, 8). Identify the conflict. Give two different repairs, clearly stating which information each repair preserves.",
        "Preserve the rule by changing(6, 8)to(6, 9). Or preserve the recorded pairs and remove the claim that they all follow the stated proportional rule.",
        "The first two rows match multiplier 3/2; the third has 8/6 = 4/3. A valid repair must say whether the rule or the observations are being treated as authoritative.",
        "Changing the rule to fit only the last pair would conflict with the first two.",
        "large",
      ),
      a.task(
        "origin-explanation",
        "Explain why y = (3/2)x gives y = 0 at x = 0 but does not make 0/0 equal 3/2.",
        "Substitution gives(3/2) × 0 = 0. Division 0/0 is undefined; it cannot determine a unique rate.",
        "Every multiplier times zero gives zero, so the origin alone does not select one multiplier. A nonzero pair or the specified rule supplies the rate.",
        undefined,
        "medium",
      ),
    ],
    "reflection",
  );
}
