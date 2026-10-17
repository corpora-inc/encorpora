import {
  Author,
  text,
  note,
  rectangle,
  region,
  elbow,
  worked,
} from "./authoring.js";
export function cover(a: Author) {
  a.section = "cover";
  a.page("cover-with-squares", "Give every part one square", [
    rectangle(
      "cover-twelve",
      4,
      3,
      "Each small square has side length 1 cm and area 1 square centimeter.",
    ),
    text(
      "Area measures how much a flat region covers. These equal squares cover the rectangle with no gaps and no overlaps. Count twelve square units, not twelve edge lengths.",
    ),
    a.task(
      "unit-square-explain",
      "Explain why the area is 12 square centimeters, not 12 centimeters. What does one counted unit look like?",
      "Each counted unit is a 1 cm by 1 cm square; twelve cover the region.",
      "A centimeter measures length along an edge. A square centimeter measures coverage in two directions. Naming the unit distinguishes area from perimeter.",
      undefined,
      "large",
      "blank",
    ),
  ]);
  a.page("rows-to-area", "Multiplication counts the cover", [
    rectangle("cover-rows", 6, 4, "Four rows each contain six unit squares."),
    worked(
      "Count efficiently",
      "Find the area without counting every square one at a time.",
      [
        "Each row contains 6 square centimeters.",
        "There are 4 equal rows: 4 × 6 = 24.",
      ],
      "The area is 24 square centimeters. For a rectangle, side lengths in centimeters give the row and column counts of 1 cm squares.",
    ),
    a.task(
      "rotate-cover",
      "Turn the page sideways. Explain a different multiplication for the same area.",
      "6 × 4 = 24 square centimeters.",
      "The rotation swaps which direction is called a row. No squares are added or removed, so the coverage stays 24 square centimeters.",
    ),
  ]);
  a.page("tile-size", "A tile is not always one square unit", [
    rectangle(
      "tile-block",
      2,
      2,
      "One large tile is 2 cm by 2 cm. The grid shows its square-centimeter area.",
    ),
    a.task(
      "large-tiles",
      "Six of these tiles cover a floor sample without gaps or overlaps. What is the sample's area? Why is ‘6 square centimeters’ wrong?",
      "24 square centimeters.",
      "Each tile covers 2 × 2 = 4 square centimeters. Six tiles cover 6 × 4 = 24. Counting tiles gives area only after the area of each tile is known.",
      undefined,
      "large",
    ),
    note(
      "Check the unit square",
      "Changing the size of the tile changes how many tiles are needed. The region's physical coverage does not change merely because you count with different tiles.",
      "connect",
    ),
  ]);
  a.page("split-and-recombine", "One region, two rectangles", [
    region(
      "cover-vertical-split",
      {
        unit: "cm",
        cells: elbow(),
        showGrid: true,
        partitions: [
          { from: { column: 4, row: 3 }, to: { column: 4, row: 5 } },
        ],
      },
      "A 4 by 5 rectangle and a 2 by 2 rectangle meet along the dashed seam.",
    ),
    worked(
      "Add disjoint coverage",
      "Find the area of the L-shaped region.",
      [
        "The left rectangle covers 4 × 5 = 20 square centimeters.",
        "The small right rectangle covers 2 × 2 = 4 square centimeters.",
        "The pieces do not overlap: 20 + 4 = 24.",
      ],
      "The total area is 24 square centimeters.",
    ),
    a.task(
      "partition-why",
      "Why does the dashed seam add no area?",
      "A line marks where two regions meet; it does not cover an extra strip of squares.",
      "The unit squares already belong to exactly one piece. Counting a seam as additional coverage would count material that is not there.",
    ),
  ]);
  a.page("another-decomposition", "Move the imaginary cut", [
    region(
      "cover-horizontal-split",
      {
        unit: "cm",
        cells: elbow(),
        showGrid: true,
        partitions: [
          { from: { column: 0, row: 3 }, to: { column: 4, row: 3 } },
        ],
      },
      "A different dashed seam creates an upper rectangle and a lower rectangle.",
    ),
    a.task(
      "second-split",
      "Find each rectangle's dimensions and area. Show that this cut gives the same total as the previous page.",
      "Upper: 4 × 3 = 12; lower: 6 × 2 = 12; total 24 square centimeters.",
      "Both decompositions partition the identical set of unit squares. Changing the imaginary cut cannot change the coverage.",
      undefined,
      "large",
    ),
    note(
      "Keep the argument",
      "A correct decomposition covers every part once. Pieces may touch at edges, but overlapping pieces need an adjustment before their areas can be added.",
    ),
  ]);
  a.page("surround-and-subtract", "Borrow a rectangle, then give it back", [
    region(
      "cover-missing-corner",
      { unit: "cm", cells: elbow(), showGrid: true },
      "Imagine completing the upper-right corner to make a 6 by 5 rectangle.",
    ),
    a.task(
      "missing-corner-area",
      "Find the area by subtracting a missing rectangle from a full rectangle. Name both dimensions of the missing piece.",
      "6 × 5 − 2 × 3 = 30 − 6 = 24 square centimeters.",
      "The full width is 6 and full height 5. The absent corner is 2 wide and 3 high. Subtract only its six unit squares.",
      "This agrees with both additive decompositions.",
      "large",
    ),
    a.task(
      "subtract-length-error",
      "A learner writes 30 − 2 − 3 = 25 for the area. What did the learner subtract instead of coverage?",
      "Two side lengths instead of the missing area.",
      "The missing rectangle is not five square units. It has two columns of three squares, so its area is 6 square centimeters.",
    ),
  ]);
  a.page(
    "coverage-repair",
    "Check a plan before buying tiles",
    [
      a.task(
        "overlap-floor",
        "Two floor regions have areas 18 and 12 square meters. They overlap in a 4-square-meter patch. What is their combined covered area? Draw a rough diagram to explain.",
        "26 square meters.",
        "18 + 12 counts the shared patch twice. Keep one copy and subtract the extra 4: 30 − 4 = 26. Unlike the perimeter seam, the overlap here has area.",
        undefined,
        "extended",
        "blank",
      ),
      note(
        "Different corrections",
        "A shared boundary is counted twice in two separate perimeter trips. An overlapping patch is counted twice in two separate area totals. Identify what is being counted before subtracting.",
        "connect",
      ),
    ],
    "workshop",
  );
}
