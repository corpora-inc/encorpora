import { Author, text, note, tape, worked } from "./authoring.js";
export function scaling(a: Author) {
  a.section = "scale";
  a.page("scale-both-quantities", "Carry the multiplier to both rows", [
    tape(
      "one-batch",
      "cups",
      [
        { label: "Concentrate", parts: 2, total: [2, 1] },
        { label: "Water", parts: 3, total: [3, 1] },
      ],
      "One batch: two cups and three cups.",
      6,
      [1, 1],
    ),
    tape(
      "double-batch",
      "cups",
      [
        { label: "Concentrate", parts: 4, total: [4, 1] },
        { label: "Water", parts: 6, total: [6, 1] },
      ],
      "Two batches: four cups and six cups. One drawn part represents the same cup in both pictures.",
      6,
      [1, 1],
    ),
    text(
      "Multiplying both quantities by two makes two copies of the same recipe. The concentrate-to-water comparison is unchanged: 2/3 = 4/6. The total doubles from five cups to ten cups, but the concentrate fraction of the whole stays 2/5.",
    ),
    a.task(
      "scale-three-batches",
      "Make three batches of the same recipe. Give both quantities and the total, then name the common multiplier.",
      "6 cups concentrate, 9 cups water, 15 cups total; multiplier 3.",
      "Three copies of 2 cups give 6; three copies of 3 cups give 9. Both quantities and their sum are multiplied by three.",
      "6/9 simplifies to 2/3; 6/15 simplifies to 2/5.",
      "short",
    ),
  ]);
  a.page("additive-near-miss", "Adding the same amount is a different move", [
    tape(
      "near-miss-original",
      "cups",
      [
        { label: "Concentrate", parts: 2, total: [2, 1] },
        { label: "Water", parts: 3, total: [3, 1] },
      ],
      "Original recipe: two parts concentrate to three parts water.",
      4,
      [1, 1],
    ),
    tape(
      "near-miss-changed",
      "cups",
      [
        { label: "Concentrate", parts: 3, total: [3, 1] },
        { label: "Water", parts: 4, total: [4, 1] },
      ],
      "Adding one cup to both quantities makes 3:4, not another 2:3 batch.",
      4,
      [1, 1],
    ),
    a.task(
      "repair-additive",
      "A learner says, ‘Both amounts grew by one, so the mixture stayed the same.’ Explain the mistake. Keep 3 cups of concentrate and find the water amount that would preserve 2:3.",
      "The required water is 9/2 cups, or 4 1/2 cups.",
      "Concentrate grew from 2 to 3 by a factor of 3/2. Water must use that same factor: 3 × 3/2 = 9/2. Adding one to each quantity preserves their difference, not their ratio.",
      "3/(9/2) = 2/3; 3/4 is different.",
      "medium",
    ),
  ]);
  a.page("half-a-batch", "A calculation must fit its materials", [
    worked(
      "Half the mixture",
      "The recipe uses 2 cups of concentrate and 3 cups of water. Make half a batch.",
      [
        "Half of 2 cups is 1 cup.",
        "Half of 3 cups is 3/2 cups.",
        "Total: 1 + 3/2 = 5/2 cups.",
      ],
      "Liquid amounts can be fractional under this recipe's measuring assumptions.",
    ),
    note(
      "Whole beads are different",
      "A kit with 2 orange beads and 3 teal beads cannot be halved into 1 orange bead and 1 1/2 whole teal beads. You can calculate the scaled amounts, but that physical kit is not allowed.",
      "misconception",
    ),
    a.task(
      "discrete-batch",
      "For whole-bead kits in ratio 2:3, are totals 10, 12 and 15 possible? Give the counts for each possible total.",
      "10:4 orange and 6 teal. 12:not possible. 15:6 orange and 9 teal.",
      "There are five equal ratio parts. Whole counts in reduced ratio 2:3 require totals that are positive multiples of five. Twelve would give parts of 12/5 beads and nonwhole color counts.",
      "Check each accepted pair sums to the requested total and reduces to 2:3.",
      "medium",
    ),
  ]);
  a.page("share-a-total", "Find the equal part before either quantity", [
    tape(
      "thirty-bead-parts",
      "beads",
      [
        { label: "Orange beads", parts: 2 },
        { label: "Teal beads", parts: 3 },
      ],
      "The two rows together contain 30 beads. Each part must represent the same count.",
      5,
    ),
    worked(
      "Use the whole",
      "A 30-bead kit has orange: teal = 2:3. How many of each color?",
      [
        "The ratio has 2 + 3 = 5 equal parts altogether.",
        "One part contains 30 ÷ 5 = 6 beads.",
        "Orange uses 2 parts: 2 × 6 = 12. Teal uses 3 parts: 3 × 6 = 18.",
      ],
      "The two quantities sum to 30 and simplify to ratio 2:3.",
    ),
    a.task(
      "total-forty-two",
      "A 42-bead kit has orange: teal = 3:4. Find both counts and explain why dividing 42 by 3 alone would not solve the problem.",
      "18 orange and 24 teal.",
      "The whole contains 3 + 4 = 7 equal parts, so each part is 6 beads. The orange row has 3 parts and teal has 4. Dividing the entire whole by 3 mistakes the orange part count for the whole part count.",
      "18 + 24 = 42 and 18:24 = 3:4.",
      "medium",
    ),
  ]);
  a.page("compare-at-a-common-amount", "Make one quantity match", [
    text(
      "Recipe A uses 2 cups of concentrate for 3 cups of water. Recipe B uses 3 cups of concentrate for 5 cups of water. Which has more concentrate relative to water? Compare quantities in a common unit before deciding.",
    ),
    worked(
      "Match the concentrate",
      "Scale both recipes to 6 cups of concentrate.",
      [
        "A uses 3 copies of 2:3, giving 6 cups concentrate and 9 cups water.",
        "B uses 2 copies of 3:5, giving 6 cups concentrate and 10 cups water.",
        "With equal concentrate, A has less water.",
      ],
      "A is more concentrated under this two-ingredient comparison. A's concentrate fraction is 2/5; B's is 3/8.",
    ),
    a.task(
      "common-water",
      "Compare the same recipes by matching 15 cups of water instead. Show that your conclusion agrees.",
      "A has 10 cups concentrate for 15 cups water; B has 9 cups concentrate for 15 cups water. A has more concentrate for the same water.",
      "Multiply A's two quantities by five and B's by three. The first-number comparison is meaningful only after the reference quantities match.",
      "10/15 = 2/3; 9/15 = 3/5.",
      "medium",
    ),
  ]);
  a.page(
    "scale-studio",
    "Create a convincing near-miss",
    [
      a.task(
        "invent-near-miss",
        "Start with ratio 3:5. Invent two different whole-number pairs that preserve it and one pair that looks plausible but does not. Draw or label all three. Give a test that catches your near-miss.",
        "Example valid pairs 6:10 and 9:15; near-miss 4:6. Other examples are valid with a correct checking argument.",
        "Both entries of a valid pair use the same multiplier. The example near-miss adds one to each original entry, but 4/6 = 2/3 is not 3/5. A test may match a reference amount, simplify fractions, or show unequal multipliers.",
        "A useful key explains why the near-miss fails, rather than merely marking it wrong.",
        "extended",
        "blank",
      ),
      note(
        "Return to the whole",
        "In every valid 3:5 pair, the first quantity is 3/8 of the combined total. This is a second way to check the relationship.",
        "connect",
      ),
    ],
    "workshop",
  );
}
