import type { Lesson } from "./lessons.js";

export const measurementLessons: Lesson[] = [
  {
    id: "length-between-two-positions",
    title: "Measure the spaces between the ends",
    summary:
      "A ruler shows where an object's ends are; the spaces between them give its length.",
    templateIds: ["shifted-ruler-length", "fractional-ruler-length"],
    objectives: [
      "Distinguish a position from a length.",
      "Use the size of each small ruler interval.",
      "Subtract endpoints measured in the same unit.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count the spaces, not the labels",
        paragraphs: [
          "A strip laid from the 3-centimeter mark to the 9-centimeter mark is not nine centimeters long. It covers the six one-centimeter spaces between those marks. A ruler shows positions; their difference gives length.",
        ],
      },
      {
        title: "Marks name positions",
        paragraphs: [
          "A strip starting at 3 cm and ending at 9 cm is six centimeters long. The labels tell where its ends lie. The spaces from three to nine measure how far apart those ends are.",
          "Slide the strip so its first end is at zero. Its other end will reach six. Moving the strip changes its position, but not its length. This is why ending position minus starting position works.",
        ],
      },
      {
        title: "Name the size of each space",
        paragraphs: [
          "If a centimeter is divided into four equal spaces, each space is 1/4 cm. Seven of those spaces measure 7/4 cm, or 1 3/4 cm. Count the spaces and name their size together.",
          "Between two adjacent marks there is one space, although there are two marks. The marks at the ends do not add extra length. Counting marks instead of intervals gives one too many.",
        ],
      },
      {
        title: "Estimate and check",
        paragraphs: [
          "A strip a little longer than two centimeters cannot be nine centimeters long just because it crosses nine quarter-centimeter spaces. Estimate first, then use the unit and subdivisions printed on the ruler.",
          "Check an endpoint subtraction by adding the measured length to the starting position. You should reach the ending position.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Distance between marks",
        paragraphs: [
          "A ruler mark names a position, not a length by itself. When both ends are on the same scale, length equals ending position minus starting position, even if the object begins away from zero.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A strip starts at 1 1/4 cm and ends at 3 1/2 cm. How long is it?",
      steps: [
        "Rename in quarters: 1 1/4 = 5/4 and 3 1/2 = 14/4.",
        "Subtract: 14/4 − 5/4 = 9/4 cm.",
        "Nine quarter-centimeter spaces make 2 1/4 cm.",
        "Check: 1 1/4 + 2 1/4 = 3 1/2, the ending position.",
      ],
      answer: "9/4 cm, or 2 1/4 cm",
    },
    pitfalls: [
      "The ending label is the length only when the starting position is zero.",
      "Count intervals, not boundary marks.",
      "Inspect the subdivision before naming the length of a small interval.",
    ],
    parentGuide:
      "Place a paper strip at two different ruler positions. Ask what changed and what stayed the same. Have the learner point to equal intervals while saying their unit size, then connect that count to endpoint subtraction.",
  },
  {
    id: "border-and-cover-are-different",
    title: "Walk the border, cover the inside",
    summary:
      "Perimeter is the distance around a shape; area is the space inside. Add a rectangle's four sides for perimeter and multiply adjacent sides for area.",
    templateIds: [
      "rectangle-border-length",
      "rectangle-missing-border-side",
      "rectangle-missing-area-side",
      "border-or-cover-unit",
      "same-area-border-choice",
      "same-border-area-choice",
    ],
    objectives: [
      "Account for all four rectangle sides.",
      "Distinguish length from square units.",
      "Recover a missing side from perimeter or area.",
      "Compare rectangles using the quantity asked for.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Walk around or cover inside",
        paragraphs: [
          "String around a picture frame measures its border length, called perimeter. Paper covering the picture measures its inside, called area. For a rectangle, add all four side lengths for perimeter and multiply adjacent side lengths for area.",
        ],
      },
      {
        title: "Two different jobs",
        paragraphs: [
          "Ribbon follows a boundary. Measure its length in centimeters or meters. Paper covers a flat region. Measure area with square units: a square centimeter is the area of a square whose sides are each one centimeter.",
          "A rectangle 6 cm by 4 cm has four sides: 6, 4, 6 and 4 cm. Its perimeter is 20 cm. Four rows of six unit squares cover its inside, so its area is 24 square cm. These numbers answer different questions.",
        ],
      },
      {
        title: "Use the given relationship",
        paragraphs: [
          "Half a rectangle's perimeter is the sum of one length and one width. With perimeter 30 cm and one side 7 cm, the adjacent missing side is 15 − 7 = 8 cm. Check by adding all four sides.",
          "For a missing area dimension, think about rows: 24 unit squares arranged six to a row make four rows. The missing side is 24 ÷ 6 = 4 cm, not four square centimeters.",
        ],
      },
      {
        title: "Equal in one way, different in another",
        paragraphs: [
          "Rectangles 2 cm by 12 cm and 4 cm by 6 cm both cover 24 square cm. Their perimeters are 28 cm and 20 cm. Equal coverage does not guarantee equal ribbon length.",
          "Rectangles 2 cm by 8 cm and 4 cm by 6 cm both have perimeter 20 cm. Their areas are 16 and 24 square cm. Calculate the requested quantity rather than relying on a drawing's apparent size.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Perimeter and area",
        paragraphs: [
          "Perimeter counts length around a boundary and uses linear units. Area counts equal square units covering a region. For a rectangle with positive side lengths $l$ and $w$, perimeter is $2l+2w$ and area is $lw$; neither quantity determines the other alone.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle has perimeter 26 cm. One side is 5 cm. Find the adjacent side and its area.",
      steps: [
        "Half the perimeter is 13 cm: one length plus one width.",
        "The adjacent side is 13 − 5 = 8 cm.",
        "Check: 5 + 8 + 5 + 8 = 26 cm.",
        "The inside covers 5 × 8 = 40 square cm.",
      ],
      answer: "Adjacent side: 8 cm. Area: 40 square cm.",
    },
    pitfalls: [
      "Adding only two adjacent sides gives half the perimeter.",
      "Multiplying side lengths gives area, not boundary length.",
      "A missing side is a length, even when the given total is an area.",
      "Equal perimeter and equal area are different constraints.",
    ],
    parentGuide:
      "Build two rectangles with the same tile count. Trace each border and compare lengths. Ask what the tiles preserve and what the border counts; accept a drawing or oral explanation before a formula.",
  },
  {
    id: "same-length-different-unit",
    title: "Rename the length before combining it",
    summary:
      "A length stays fixed when you rename its units: 1 meter is 100 centimeters. For a rectangle's perimeter, add the lengths of all four sides in one unit.",
    templateIds: [
      "metric-length-rename",
      "metric-length-reverse",
      "mixed-length-total",
      "mixed-unit-border",
    ],
    objectives: [
      "Use 10 mm = 1 cm, 100 cm = 1 m and 1000 m = 1 km.",
      "Convert in either direction while preserving length.",
      "Keep exact fractional values when the new measure is not whole.",
      "Convert side lengths before calculating a mixed-unit perimeter.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The object does not change",
        paragraphs: [
          "A meter stick is one meter long and also one hundred centimeters long. The smaller centimeter unit fits more times along the same stick. A conversion changes the count and unit, not the stick. A rectangle's perimeter is the distance around all four sides.",
        ],
      },
      {
        title: "The length stays fixed",
        paragraphs: [
          "One meter and one hundred centimeters name the same length. Centimeters are smaller units, so more of them fit along that length. Three meters equals three groups of one hundred centimeters: 300 cm.",
          "Larger units produce a smaller numerical measure. For example, 75 cm is 75/100 m, or 3/4 m. A fractional answer is expected when the length is less than one whole new unit.",
        ],
      },
      {
        title: "Choose the particular scale factor",
        paragraphs: [
          "There are ten millimeters in a centimeter, one hundred centimeters in a meter, and one thousand meters in a kilometer. These factors differ. Write the relationship for the particular units before multiplying or dividing.",
          "To rename 1250 m in kilometers, divide by 1000: 1250/1000 = 5/4 km. Check by converting back: 5/4 of 1000 meters is 1250 meters. Keep the exact fraction or its equivalent terminating decimal.",
        ],
      },
      {
        title: "Combine like-sized units",
        paragraphs: [
          "A 2 m strip and a 35 cm strip total 200 cm + 35 cm = 235 cm. Adding the bare numbers two and thirty-five would treat unequal units as equal.",
          "For a rectangle, express both adjacent sides in the requested unit, then include each side twice. Converting units does not change the rectangle or eliminate any part of its boundary.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Converting a fixed length",
        paragraphs: [
          "A conversion changes the numerical count and unit while preserving the same measured length. If a large unit contains $k$ smaller units, multiply its count by $k$ to express the length in small units and divide by $k$ to go back.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle is 2 m long and 35 cm wide. What is its perimeter in centimeters?",
      steps: [
        "Rename the length: 2 m = 200 cm.",
        "One length plus one width is 200 + 35 = 235 cm.",
        "Double that sum: 2 × 235 = 470 cm.",
        "Check all four sides: 200 + 35 + 200 + 35 = 470 cm.",
      ],
      answer: "470 cm",
    },
    pitfalls: [
      "A conversion renames a quantity; it does not stretch the object.",
      "The factor depends on the specific units.",
      "A whole-number starting measure can become fractional in larger units.",
      "Do not add bare measurements using different unit sizes.",
    ],
    parentGuide:
      "Ask whether the numerical measure should grow or shrink before calculating. Have the learner show one conversion in both directions, then use the renamed measurement in an addition or perimeter problem.",
  },
  {
    id: "rectangles-with-two-conditions",
    title: "Find every candidate, then test the conditions",
    summary:
      "A rectangle's area is adjacent sides multiplied; its perimeter is all four sides added. Check every whole-number side pair against both conditions.",
    templateIds: [
      "rectangle-two-constraints-choice",
      "rectangle-existence-choice",
    ],
    objectives: [
      "Enumerate rectangles with fixed area and positive whole-number sides.",
      "Test an exact perimeter or an upper bound separately from area.",
      "Use a complete candidate list to justify that no rectangle works.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Try every side pair",
        paragraphs: [
          "A rectangle's area is one side length times its adjacent side length. For area 24 square units, possible whole-number side pairs include 4 and 6 or 3 and 8. List such factor pairs, then check the perimeter, the sum of all four sides.",
        ],
      },
      {
        title: "Area organizes the search",
        paragraphs: [
          "For area 24 square cm and positive whole-number sides, list 1 × 24, 2 × 12, 3 × 8 and 4 × 6. A rotated rectangle reverses its dimensions but is not a new size for this question.",
          "Test possible shorter sides in order. Once the shorter side would exceed the longer one, later pairs only repeat rotations. Every candidate must multiply to the required area.",
        ],
      },
      {
        title: "Test the second condition",
        paragraphs: [
          "Those four area-24 rectangles have perimeters 50, 28, 22 and 20 cm. If the perimeter is at most 22 cm, both 3 × 8 and 4 × 6 work. A design question can have more than one answer.",
          "At most includes equality. Perimeter exactly 22 cm selects only 3 × 8 from this list. State which comparison you are testing.",
        ],
      },
      {
        title: "Not listed does not mean impossible",
        paragraphs: [
          "To claim no rectangle exists, check every permitted factor pair, not just the displayed choices. Area 24 square cm and perimeter exactly 24 cm have no solution with positive whole-number sides: none of the four possible perimeters is 24.",
          "The whole-number restriction matters. This argument does not rule out rectangles with fractional or other real side lengths. Keep impossibility claims inside the stated domain.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Area and whole-number sides",
        paragraphs: [
          "For a rectangle with positive whole-number side lengths, area equals the product of the two lengths. Listing every factor pair of a specified area gives every possible such rectangle up to rotation; test any second condition against that complete list.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Find all rectangles with area 36 square cm, positive whole-number sides and perimeter at most 26 cm.",
      steps: [
        "List factor pairs once: 1 × 36, 2 × 18, 3 × 12, 4 × 9 and 6 × 6.",
        "Their perimeters are 74, 40, 30, 26 and 24 cm.",
        "At most 26 includes both 26 and 24.",
        "The valid dimensions are 4 cm by 9 cm and 6 cm by 6 cm; each covers 36 square cm.",
      ],
      answer: "4 cm by 9 cm and 6 cm by 6 cm, including their rotations",
    },
    pitfalls: [
      "Meeting the area condition does not guarantee meeting the perimeter condition.",
      "Do not omit a square factor pair.",
      "At most allows equality; exactly permits only the stated perimeter.",
      "Missing from the choices does not prove impossibility.",
    ],
    parentGuide:
      "Ask how the learner knows the factor list is complete. Give one condition admitting two answers and another admitting none. Ask for the evidence and the positive whole-number restriction in both explanations.",
  },
  {
    id: "buy-enough-compare-the-bills",
    title: "Compare the bill for enough material",
    summary:
      "When material comes only in whole packs, buy enough packs and count the cost of all of them.",
    templateIds: ["whole-pack-ribbon-choice"],
    objectives: [
      "Find the smallest whole pack count supplying enough length.",
      "Compare whole-pack and per-unit bills under explicit purchase rules.",
      "Check unused length and recognize ties.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Buy what the store sells",
        paragraphs: [
          "If ribbon comes in whole six-meter packs and you need seven meters, one pack is short and two packs cover the job. Pay for both full packs even though some ribbon is left over.",
        ],
      },
      {
        title: "What can actually be bought?",
        paragraphs: [
          "A shop selling only whole six-meter packs cannot sell 7/6 of a pack when you need seven meters. One pack is short, so buy two and pay for both. You receive twelve meters although you need only seven.",
          "Another shop may sell any length at a stated price per meter. Under that rule, you can buy exactly seven meters. Compare bills for purchases that actually meet the need.",
        ],
      },
      {
        title: "Unused material is paid for too",
        paragraphs: [
          "If two six-meter packs cost six dollars each, twelve meters cost twelve dollars. Five unused meters do not reduce that bill unless a refund rule is explicitly stated.",
          "A lower advertised price per meter can lead to a higher total bill when whole packs force extra material. Work out enough material first, then multiply by the applicable price.",
        ],
      },
      {
        title: "Read the joining and charge rules",
        paragraphs: [
          "When pieces join without loss, their lengths add directly. Requiring one continuous unjoined piece would be a different problem. Do not invent cutting waste, tax, discounts or joining loss.",
          "An exact pack multiple needs no extra pack. If both bills agree, neither supplier costs less under the stated rules.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Whole packs and total cost",
        paragraphs: [
          "When a pack cannot be split, the number purchased is the least whole number of packs whose combined quantity meets or exceeds the need. Total cost is pack count times price per pack; unused material does not reduce the bill.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Need 10 m of ribbon; pieces join without loss. Offer A sells whole 6 m packs for 5 dollars each. Offer B sells any length for 1 dollar per meter. No other charges. Which costs less?",
      steps: [
        "One offer A pack supplies only 6 m, so buy two: 12 m for 2 × 5 = 10 dollars.",
        "A leaves 2 m unused, but both packs must be paid for.",
        "Offer B supplies exactly 10 m for 10 × 1 = 10 dollars.",
        "The bills tie; the leftover ribbon does not change the price.",
      ],
      answer: "Same cost: 10 dollars each",
    },
    pitfalls: [
      "Rounding the pack count down can leave too little material.",
      "An exact pack multiple needs no extra pack.",
      "Compare actual bills, not only advertised unit prices.",
      "Do not invent refunds for leftovers or unstated charges.",
    ],
    parentGuide:
      "Use paper strips as packs. Ask for the smallest purchase that meets the need. Separate used length, purchased length and cost, then compare a near-multiple example with an exact-multiple example.",
  },
];
