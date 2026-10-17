import { Author, text, note, tape, worked } from "./authoring.js";
export function meaning(a: Author) {
  a.section = "entry";
  a.page(
    "welcome",
    "In the Same Proportion",
    [
      text(
        "A workshop is preparing color mixtures, supply kits and route plans. A batch can become bigger without changing its recipe. A price can look smaller without making a purchase cheaper. Your job is to find the relationship that matters.",
      ),
      tape(
        "opening-mixture",
        "cups",
        [
          { label: "Concentrate", parts: 2, total: [2, 1] },
          { label: "Water", parts: 3, total: [3, 1] },
        ],
        "Two cups of concentrate join three cups of water. Each rectangle represents one cup.",
        6,
        [1, 1],
      ),
      note(
        "What must stay the same?",
        "Imagine making enough of this mixture for twice as many people. Predict what happens to each quantity. Keep your prediction; you will build an argument for it.",
        "predict",
      ),
      text(
        "Look closely. Name the quantities. Build a model. Then decide whether the numbers tell the same story.",
      ),
    ],
    "opening",
    "Ratios, Rates and the Whole That Matters",
  );
  a.page(
    "reading-route",
    "Choose a useful starting place",
    [
      text(
        "Begin with the three invitations on the next page. They reveal different ideas, so an easy calculation does not replace a clear explanation.",
      ),
      note(
        "Meaning → scaling",
        "First name the two quantities and their order. Then change both amounts by the same multiplier, keeping the relationship fixed.",
      ),
      note(
        "Rates → models",
        "Find an amount per one. Connect equal-ratio pairs to tables, double scales and graphs. Decide which inputs make sense in the situation.",
        "connect",
      ),
      note(
        "Percent → transfer",
        "Name the reference whole before using a percentage. Finish with decisions that mix several ideas and require you to explain your assumptions.",
      ),
      text(
        "Use paper, a pencil and counters or small objects. You may explain aloud before writing. A diagram is evidence when its parts and quantities are labeled. Return to a related page when you need a model; then try a fresh task without looking at the worked example.",
      ),
    ],
    "guide",
  );
  a.page(
    "entry-invitations",
    "Three ways to notice",
    [
      a.task(
        "entry-ratio",
        "A kit contains 2 orange beads and 3 teal beads. What fraction of the kit is orange? What does 2/3 describe instead?",
        "2/5 of the kit is orange. 2/3 compares the orange count with the teal count.",
        "The whole kit has five beads. The orange-to-whole comparison is two out of five; the orange-to-teal comparison uses three teal beads as its reference.",
        "Complete both sentences: orange is 2/5 of the whole; orange is 2/3 of the teal amount.",
        "medium",
      ),
      a.task(
        "entry-scaling",
        "Which has the same orange-to-teal ratio as 2:3: a kit with 4 orange and 6 teal, or one with 3 orange and 4 teal? Explain without using color alone.",
        "4 orange and 6 teal.",
        "Both original counts are doubled. Adding one to each count gives 3:4, which does not preserve the multiplier between the two quantities.",
        "Two copies of the original kit contain 4 orange and 6 teal.",
        "medium",
      ),
      a.task(
        "entry-fraction",
        "Find 3/4 of 12. Show equal parts in a quick drawing.",
        "9.",
        "Divide twelve into four equal groups of three. Select three groups: 3 × 3 = 9.",
        "One remaining group of three completes twelve.",
        "medium",
        "blank",
      ),
    ],
    "workshop",
  );
  a.page("name-the-order", "A ratio names a relationship", [
    tape(
      "order-parts",
      "beads",
      [
        { label: "Orange beads", parts: 2 },
        { label: "Teal beads", parts: 3 },
      ],
      "Every part represents the same count. No actual batch size is given.",
      5,
    ),
    text(
      "Orange: teal = 2:3 means two equal orange parts for every three equal teal parts. It need not mean exactly two orange beads and three teal beads. Four orange and six teal also fit, as do ten orange and fifteen teal.",
    ),
    text(
      "Order carries meaning. Teal: orange = 3:2 names the same relationship in reverse order. Saying just ‘the ratio is two-thirds’ leaves the reader guessing which quantities you mean.",
    ),
    a.task(
      "order-sentences",
      "A different kit has 4 squares and 7 circles. Write squares: circles and circles: squares. Then write one complete comparison sentence.",
      "Squares: circles = 4:7; circles: squares = 7:4. For every 4 squares there are 7 circles, or its reverse.",
      "The first ratio number belongs to the first named quantity. Reversing both the names and numbers preserves the relationship.",
      undefined,
      "medium",
    ),
  ]);
  a.page("parts-and-whole", "The reference changes the fraction", [
    tape(
      "part-whole-parts",
      "beads",
      [
        { label: "Orange beads", parts: 2, total: [2, 1] },
        { label: "Teal beads", parts: 3, total: [3, 1] },
      ],
      "The whole contains both rows: five beads altogether.",
      5,
      [1, 1],
    ),
    worked(
      "Three true statements",
      "Describe this one kit in three ways.",
      [
        "Orange compared with teal: 2/3.",
        "Orange compared with the whole: 2/(2 + 3) = 2/5.",
        "Teal compared with the whole: 3/(2 + 3) = 3/5.",
      ],
      "A fraction needs a named reference. The same two orange beads can belong to different comparisons.",
    ),
    a.task(
      "part-whole-repair",
      "Mira says, ‘The ratio of orange to teal is 2:3, so two-thirds of all the beads are orange.’ Repair the sentence and explain the denominator.",
      "Two-fifths of all the beads are orange; the orange count is two-thirds of the teal count.",
      "The whole includes both two-part and three-part quantities, totaling five equal parts. Three alone counts only the teal parts.",
      "The whole fractions 2/5 and 3/5 add to 1.",
      "medium",
    ),
  ]);
  a.page(
    "draw-two-batches",
    "One relationship, many batches",
    [
      text(
        "A ratio is not one fixed total. Build two kits with orange: teal = 2:3. Make their totals different, but keep each color count a whole number.",
      ),
      a.task(
        "two-batches",
        "Draw and label both kits. State the total for each, then explain how your drawings preserve the same relationship.",
        "Examples: 2 orange + 3 teal = 5 total; 6 orange + 9 teal = 15 total. Other positive whole-number multiples are valid.",
        "Each kit consists of complete copies of the 2:3 relationship. Each color count is multiplied by the same positive whole number; the total is five times that number.",
        "For the examples, orange is 2/5 of each complete kit even though the kit sizes differ.",
        "extended",
        "blank",
      ),
      note(
        "Look for a structure",
        "Can you circle equal copies of the original five-bead kit inside your larger drawing? The groups make the shared multiplier visible.",
        "connect",
      ),
    ],
    "workshop",
  );
  a.page(
    "meaning-return",
    "Say what each number measures",
    [
      a.task(
        "meaning-transfer",
        "A mural recipe uses 3 cups of yellow paint for every 2 cups of blue paint. Name yellow: blue, yellow: whole and blue: whole. Explain why the denominators differ.",
        "3:2, 3:5 and 2:5, respectively.",
        "The first comparison uses blue paint as the reference. The whole includes three yellow parts and two blue parts, or five equal parts. Every amount here is measured in cups.",
        undefined,
        "medium",
      ),
      a.task(
        "meaning-invent",
        "Invent a two-color whole-bead kit with orange: teal = 3:4 and more than 7 beads. Write its two counts and total. Give a checking question for a partner.",
        "Any counts 3k and 4k with integer k ≥ 2; total 7 k. Example 6 orange, 8 teal, total 14. A suitable check asks whether both counts use the same multiplier.",
        "Positive whole-bead counts with this reduced ratio come in complete groups of 3 orange and 4 teal beads. A checking question should test the relationship, not just the total.",
        undefined,
        "large",
        "blank",
      ),
    ],
    "reflection",
  );
}
