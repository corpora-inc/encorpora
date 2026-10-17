import {
  Author,
  text,
  note,
  rectangle,
  region,
  elbow,
  cells,
  worked,
} from "./authoring.js";
export function border(a: Author) {
  a.section = "border";
  a.page("walk-the-border", "Take one trip around", [
    rectangle(
      "border-rectangle",
      6,
      3,
      "Trace the dark outside edge once. Do not travel along the interior grid.",
    ),
    worked(
      "A ribbon for every side",
      "How much ribbon surrounds this rectangle?",
      [
        "Start at a corner and follow sides of length 6, 3, 6 and 3 cm.",
        "Add the four lengths: 6 + 3 + 6 + 3 = 18.",
      ],
      "The perimeter is 18 cm. Perimeter measures the length of a closed outside boundary.",
    ),
    a.task(
      "border-path",
      "Why does turning a corner not add another centimeter? Explain with a finger walk.",
      "A turn changes direction but does not add a new length interval.",
      "Only the distance traveled along an edge contributes. A corner is a position, not an extra piece of ribbon.",
    ),
  ]);
  a.page("opposite-sides", "Pair the equal sides", [
    region(
      "border-pairs",
      {
        unit: "cm",
        cells: cells(7, 4),
        showGrid: false,
        edgeLabels: [
          {
            from: { column: 0, row: 0 },
            to: { column: 7, row: 0 },
            side: "above",
          },
          {
            from: { column: 0, row: 4 },
            to: { column: 7, row: 4 },
            side: "below",
          },
          {
            from: { column: 0, row: 0 },
            to: { column: 0, row: 4 },
            side: "left",
          },
          {
            from: { column: 7, row: 0 },
            to: { column: 7, row: 4 },
            side: "right",
          },
        ],
      },
      "Both 7 cm sides and both 4 cm sides belong to the outside trip.",
    ),
    text(
      "You can add 7 + 4 + 7 + 4, double 7 + 4, or add 2 × 7 and 2 × 4. The expressions group the same four sides. A formula is a short description of the trip.",
    ),
    a.task(
      "formula-repair",
      "Jae uses 7 + 4 = 11 cm for this perimeter. What part of the trip has Jae counted? Complete the calculation.",
      "Two neighboring sides; the full perimeter is 22 cm.",
      "The return trip contains another 7 cm side and another 4 cm side. Double 11 or add all four lengths.",
      "Each pair contributes twice its shared side length.",
    ),
    a.task(
      "new-border",
      "Find the perimeter of a rectangle 9 m long and 2 m wide. Use two equivalent expressions.",
      "22 m; for example 9 + 2 + 9 + 2 and 2 × (9 + 2).",
      "Both expressions count two 9 m sides and two 2 m sides. A different valid regrouping is acceptable.",
    ),
  ]);
  a.page("missing-side", "Work backward from the trip", [
    worked(
      "One missing width",
      "A rectangle has perimeter 30 cm and length 9 cm. Find its width.",
      [
        "The two long sides use 18 cm of boundary.",
        "30 − 18 = 12 cm remains for two equal widths.",
        "12 ÷ 2 = 6 cm for each width.",
      ],
      "The width is 6 cm; 9 + 6 + 9 + 6 checks the 30 cm total.",
    ),
    a.task(
      "missing-width",
      "A rectangle has perimeter 26 m and one side 8 m. Find the other side. Draw your own labeled rectangle; it need not be to scale.",
      "5 m.",
      "Two 8 m sides use 16 m. The remaining 10 m belongs to two equal sides, so each is 5 m.",
      "8 + 5 + 8 + 5 = 26.",
      "extended",
      "blank",
    ),
  ]);
  a.page("every-outside-edge", "A corner cut changes the route", [
    region(
      "border-elbow",
      { unit: "cm", cells: elbow(), showGrid: true },
      "The missing upper-right corner is open to the outside. Follow the indentation as part of the boundary.",
    ),
    a.task(
      "elbow-border",
      "Start at the upper-left corner and walk clockwise. List the six straight side lengths. Find the perimeter.",
      "4, 3, 2, 2, 6 and 5 cm, in that order; perimeter 22 cm.",
      "The top is 4 cm, then the inward vertical edge is 3 cm, the step is 2 cm, the right edge is 2 cm, the bottom is 6 cm and the left side is 5 cm. All are outside edges, including the indentation.",
      "Rotated starting points or reverse-order lists are valid if all six sides appear once.",
      "large",
    ),
  ]);
  a.page("inside-is-not-outside", "A joining line is not a fence", [
    region(
      "border-interior-guide",
      {
        unit: "cm",
        cells: elbow(),
        showGrid: true,
        partitions: [
          { from: { column: 4, row: 3 }, to: { column: 4, row: 5 } },
        ],
      },
      "The dashed line splits the region into two rectangles. It does not create an outside edge.",
    ),
    text(
      "The left rectangle is 4 by 5; the lower-right rectangle is 2 by 2. Their individual perimeters are 18 cm and 8 cm. Adding 18 + 8 counts the shared 2 cm seam twice.",
    ),
    a.task(
      "seam-repair",
      "Repair the total 26 cm to find the outside perimeter. Explain why you subtract the seam twice, not once.",
      "26 − 2 − 2 = 22 cm.",
      "Each rectangle's trip includes the shared seam once. Once joined, neither copy is exposed to the outside. Remove both copies.",
      "The seam remains inside the covered region; it has not removed any area.",
    ),
  ]);
  a.page(
    "border-decisions",
    "Read the job before calculating",
    [
      a.task(
        "gate-opening",
        "A rectangular garden is 8 m by 5 m. A 2 m gateway is left unfenced along one side. Find the garden perimeter and the length of fence actually installed.",
        "Perimeter 26 m; installed fence 24 m.",
        "The garden's boundary is 8 + 5 + 8 + 5 = 26 m. The gateway is part of that boundary but receives no fence, so subtract 2 m for the material order.",
        undefined,
        "large",
      ),
      a.task(
        "double-border-claim",
        "Someone says, ‘Doubling a rectangle's length always doubles its perimeter.’ Test the claim using width 3 cm and lengths 4 cm and 8 cm.",
        "False: the perimeters are 14 cm and 22 cm, not 14 cm and 28 cm.",
        "Only the two length sides double. The two 3 cm width sides stay unchanged. One counterexample disproves the word always.",
        undefined,
        "large",
      ),
    ],
    "workshop",
  );
}
