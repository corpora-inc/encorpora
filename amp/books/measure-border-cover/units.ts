import { Author, text, note, table, worked, diagram } from "./authoring.js";
export function units(a: Author) {
  a.section = "units";
  a.page("same-length-new-unit", "Rename, do not stretch", [
    text(
      "One meter and one hundred centimeters name the same length. Imagine a meter strip divided into 100 equal centimeter pieces. The strip does not become longer when you count its smaller pieces.",
    ),
    diagram({
      kind: "double-line",
      id: "meter-centimeter",
      topLabel: "meters",
      bottomLabel: "centimeters",
      pairs: [
        { top: [0, 1], bottom: [0, 1] },
        { top: [1, 1], bottom: [100, 1] },
        { top: [2, 1], bottom: [200, 1] },
        { top: [3, 1], bottom: [300, 1] },
      ],
      caption: "Aligned marks name the same length in different units.",
      alt: "Two aligned scales: 0, 1, 2 and 3 meters correspond to 0, 100, 200 and 300 centimeters. The physical length stays the same.",
    }),
    a.task(
      "meters-to-centimeters",
      "Rename 4 m in centimeters. Explain why the number grows while the length stays the same.",
      "400 cm.",
      "Four groups of 100 centimeters make 400 centimeters. Smaller units require a larger count to describe the same distance.",
    ),
  ]);
  a.page("conversion-table", "A whole input can give a fractional output", [
    table(
      "centimeter-meter",
      "centimeters",
      "meters",
      [
        { input: [100, 1], output: [1, 1] },
        { input: [250, 1], output: null },
        { input: [75, 1], output: null },
      ],
      "Divide the centimeter count by 100 to count meters.",
    ),
    a.task(
      "fractional-conversion",
      "Fill the two missing outputs. Give each in fraction or decimal form, and check by converting back.",
      "250 cm = 2 1/2 m = 2.5 m; 75 cm = 3/4 m = 0.75 m.",
      "250 ÷ 100 = 250/100 = 5/2. Also 75/100 = 3/4. Multiplying each meter measure by 100 recovers the original centimeter measure.",
      undefined,
      "large",
    ),
    note(
      "Do not round a missing whole meter",
      "A length need not contain a whole number of meters. A fractional meter is a valid exact measure.",
      "misconception",
    ),
  ]);
  a.page("unit-relationships", "Choose the relationship you need", [
    text(
      "For these length conversions: 1 km = 1,000 m; 1 m = 100 cm; 1 cm = 10 mm. State the relationship before calculating. There is no rule that every conversion moves a decimal point by the same amount.",
    ),
    worked(
      "Small units to larger units",
      "Rename 35 mm in centimeters.",
      ["Each centimeter contains 10 millimeters.", "35 ÷ 10 = 3.5."],
      "35 mm is exactly 3.5 cm.",
    ),
    a.task(
      "metric-pair",
      "Rename 2 km in meters and 450 cm in meters. Explain why the first number increases and the second decreases.",
      "2,000 m and 4.5 m.",
      "Kilometers to meters uses smaller units, so multiply by 1,000. Centimeters to meters uses larger units, so divide by 100.",
      "2,000 ÷ 1,000 = 2 and 4.5 × 100 = 450.",
    ),
  ]);
  a.page("one-unit-before-calculating", "Make the units agree first", [
    worked(
      "One rectangle, two unit names",
      "A garden is 3 m long and 250 cm wide. Find its perimeter in meters.",
      [
        "250 cm = 2.5 m.",
        "Add sides measured in the same unit: 3 + 2.5 + 3 + 2.5 = 11.",
      ],
      "The perimeter is 11 m. Adding the bare numbers 3 and 250 would mix unlike units.",
    ),
    a.task(
      "mixed-perimeter",
      "A frame is 80 cm by 1.2 m. Find its perimeter in centimeters. Check your answer in meters.",
      "400 cm, or 4 m.",
      "1.2 m = 120 cm. Then 80 + 120 + 80 + 120 = 400 cm. In meters, 0.8 + 1.2 + 0.8 + 1.2 = 4.",
      undefined,
      "large",
      "blank",
    ),
  ]);
  a.page("length-is-not-area", "One hundred is not enough for area", [
    text(
      "A square 1 m on each side is 100 cm long in each direction. Imagine 100 rows of 100 square-centimeter tiles inside it. That is 10,000 square centimeters, not 100.",
    ),
    note(
      "Keep this as a unit check",
      "This book practices selected length conversions. Square-unit conversions need both length directions. Do not apply a length conversion factor to an area without thinking about the squares.",
      "misconception",
    ),
    a.task(
      "unit-claim-repair",
      "Repair this claim: ‘A 2 m by 1 m rug covers 200 square centimeters because 2 m is 200 cm.’ Explain both directions.",
      "It covers 20,000 square centimeters.",
      "The rug is 200 cm by 100 cm. Its area is 200 × 100 = 20,000 square centimeters. Converting only the length leaves the width unconverted.",
      undefined,
      "large",
      "blank",
    ),
  ]);
  a.page(
    "compare-the-plans",
    "Same job, different offers",
    [
      text(
        "A 3 m by 2 m rectangular display needs trim along its entire outside. Shop A sells any requested length for $2 per meter, with no minimum or waste. Shop B sells only whole 3 m packs for $5 per pack. Pieces can be joined without losing length; ignore tax.",
      ),
      a.task(
        "trim-cost",
        "Find the perimeter. Compare the total purchase costs and unused trim. Which offer costs less under these rules?",
        "Perimeter 10 m. A costs $20 with no unused trim. B needs four packs, costing $20, with 2 m unused. Costs tie.",
        "Three packs provide only 9 m, so B requires four. Four packs provide 12 m and cost 4 × $5. A sells exactly 10 m at $2 per meter.",
        "A lower price per meter does not automatically mean a lower total purchase cost when only whole packs are sold.",
        "extended",
      ),
      note(
        "Keep the assumptions visible",
        "If joins waste material, lengths must be unbroken, or tax differs, this model is incomplete. Do not silently add those conditions or ignore stated ones.",
      ),
    ],
    "workshop",
  );
}
