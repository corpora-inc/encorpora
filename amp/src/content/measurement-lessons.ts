import type { Lesson } from "./lessons.js";

export const measurementLessons: Lesson[] = [
  {
    id: "length-between-two-positions",
    title: "Measure the spaces between the ends",
    summary:
      "Length is how long something is, from one end to the other. A centimeter, cm, is a short length, about as wide as a finger. A ruler has marks with numbers. A mark shows a place on the ruler. To find a length, count the spaces between the two ends. Or subtract: the end mark minus the start mark. Some rulers split each centimeter into equal small spaces. If there are 2, each is 1/2 cm, one half. Then 3/2 cm means 3 of those halves.",
    templateIds: ["shifted-ruler-length", "fractional-ruler-length"],
    senses: { unit: "unit", difference: "difference-subtract" },
    noLink: [
      "interval",
      "intervals",
      "change",
      "changes",
      "scale",
      "quarters",
      "boundary",
    ],
    objectives: [
      "Tell a place on a ruler from a length.",
      "Use the size of each small space on a ruler.",
      "Subtract the start mark from the end mark when both use the same unit.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count the spaces, not the labels",
        paragraphs: [
          "A centimeter is a short length, about as wide as your finger. We write it cm. On a centimeter ruler, the space from one numbered mark to the next is 1 centimeter.",
          "Lay a paper strip on the ruler. It starts at the 3 mark. It ends at the 9 mark. Is it 9 centimeters long? No.",
          "Count the spaces from 3 to 9. There are 6 spaces, each 1 centimeter. So the strip is 6 centimeters long. That is 9 − 3 = 6.",
        ],
      },
      {
        title: "Marks name places",
        paragraphs: [
          "The numbers on a ruler tell where the strip's ends are. The spaces between the ends tell how long it is.",
          "Now slide the 3-to-9 strip so its first end is at 0. Its other end reaches 6. Moving the strip did not make it longer or shorter. So end mark minus start mark gives its length.",
        ],
      },
      {
        title: "Name the size of each space",
        paragraphs: [
          "Some rulers split each centimeter into equal small spaces. If a centimeter is split into 4 equal spaces, each space is 1/4 cm. We read that as one fourth of a centimeter.",
          "Seven of those small spaces make 7/4 cm, read seven fourths. Four fourths make 1 whole centimeter. So 7/4 cm is 1 whole centimeter and 3/4 cm more. We write that as 1 3/4 cm, read one and three fourths. Count the spaces, and say their size too.",
          "Between two marks next to each other there is one space, but two marks. So count the spaces, not the marks. Counting marks gives one too many.",
        ],
      },
      {
        title: "Estimate and check",
        paragraphs: [
          "Estimate first: make a quick guess about how long the strip is. A strip a little longer than 2 centimeters is not 9 centimeters long. That is true even if it covers nine 1/4 cm spaces. Check the size of the spaces printed on the ruler.",
          "To check a subtraction, add the length to the start mark. You should land on the end mark.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Distance between marks",
        paragraphs: [
          "A ruler mark shows a place, not a length. The length is the end mark minus the start mark. That works even when the object does not start at 0.",
          "A unit is the amount you measure with, like 1 centimeter. Both marks must use the same unit. When the spaces are halves or fourths of a unit, count the spaces and say their size: 3 spaces of 1/2 cm is 3/2 cm.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A strip starts at 1 1/4 cm and ends at 3 1/2 cm. How long is it?",
      steps: [
        "Write both marks in fourths, so they use the same size of space. 1 1/4 is 4 fourths and 1 more fourth: 5/4. 3 1/2 is 12 fourths and 2 more fourths: 14/4.",
        "Length is end mark minus start mark: 14/4 − 5/4 = 9/4 cm.",
        "Nine fourths make 2 whole centimeters and 1/4 more: 2 1/4 cm.",
        "Check by adding the length to the start: 1 1/4 + 2 1/4 = 3 1/2. That is the end mark.",
      ],
      answer: "9/4 cm, or 2 1/4 cm",
    },
    pitfalls: [
      "The end mark is the length only when the strip starts at 0.",
      "Count the spaces between marks, not the marks themselves.",
      "Check the size of a small space before you name the length.",
    ],
    parentGuide:
      "Place a paper strip at two different ruler positions. Ask what changed and what stayed the same. Have the learner point to equal spaces while saying their size, then connect that count to subtracting the start mark from the end mark.",
  },
  {
    id: "border-and-cover-are-different",
    title: "Walk the border, cover the inside",
    summary:
      "Perimeter is the distance all the way around a flat shape. It is a length. A unit is the amount you measure with, like a centimeter, cm, about as wide as a finger. Area is how much flat space a shape covers. It is counted in square cm: squares with sides 1 cm long. A rectangle is a flat shape with four straight sides and four square corners, like the corners of a page. A 5 by 3 rectangle has sides 5 and 3 long. Its opposite sides, across from each other, are equal. Add all four sides to get the perimeter. Multiply two sides that meet to get the area. Volume is a third kind of measure: how much space fills a box. It is counted in cubic cm, cubes with sides 1 cm long.",
    templateIds: [
      "rectangle-border-length",
      "rectangle-missing-border-side",
      "rectangle-missing-area-side",
      "border-or-cover-unit",
      "same-area-border-choice",
      "same-border-area-choice",
    ],
    senses: { side: "side", square: "square-shape", unit: "unit" },
    noLink: ["boundary", "edge"],
    objectives: [
      "Add all four sides of a rectangle to find its perimeter.",
      "Tell a length unit, like cm, from an area unit, like square cm.",
      "Find a missing side from the perimeter or from the area.",
      "Compare rectangles using the measure the question asks for.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Walk around or cover inside",
        paragraphs: [
          "Wrap string once around a picture frame. The length of the string is the frame's perimeter, the distance all the way around.",
          "Now cover the picture with paper squares. The amount of paper is its area, the flat space inside.",
          "A rectangle is a flat shape with 4 straight sides and 4 square corners. Its opposite sides, the sides across from each other, are equal. For a rectangle, add all four sides to find the perimeter. Multiply two sides that meet at a corner to find the area.",
        ],
      },
      {
        title: "Two different jobs",
        paragraphs: [
          "A ribbon around the edge measures a length. Measure it in centimeters, cm. A centimeter is about as wide as a finger.",
          "Paper on top covers a flat space, so it measures area. A square centimeter is a square with sides 1 cm long. Area is the number of square centimeters that cover the shape. We write it in square cm.",
          "Take a rectangle 6 cm long and 4 cm wide. Its four sides are 6, 4, 6 and 4 cm. Its perimeter is 6 + 4 + 6 + 4 = 20 cm.",
          "Four rows of 6 square centimeters cover it. So its area is 4 × 6 = 24 square cm. The two numbers answer different questions.",
        ],
      },
      {
        title: "Find a missing side",
        paragraphs: [
          "Going halfway around a rectangle passes one long side and one short side. So half the perimeter is one length plus one width.",
          "Say the perimeter is 30 cm and one side is 7 cm. Half the perimeter is 15 cm. So the side next to it is 15 − 7 = 8 cm. Check by adding all four sides: 7 + 8 + 7 + 8 = 30.",
          "For a missing side from the area, think about rows of squares 1 cm on a side. Say the area is 24 square cm and one side is 6 cm, so 6 squares fit in each row. 24 squares, 6 in each row, make 4 rows. So the missing side is 24 ÷ 6 = 4 cm. A side is a length, so it is 4 cm, not 4 square cm.",
        ],
      },
      {
        title: "Equal in one way, different in another",
        paragraphs: [
          "A 2 cm by 12 cm rectangle and a 4 cm by 6 cm rectangle both cover 24 square cm. But their perimeters are 28 cm and 20 cm. The same area does not mean the same perimeter.",
          "A 2 cm by 8 cm rectangle and a 4 cm by 6 cm rectangle both have a perimeter of 20 cm. But their areas are 16 square cm and 24 square cm. So work out the measure the question asks for. Do not judge by how big a drawing looks.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Perimeter and area",
        paragraphs: [
          "Perimeter is a length around the outside, so it uses length units like cm. Area counts the equal squares that cover a flat shape, so it uses square units like square cm.",
          "Call a rectangle's two side lengths $l$ for length and $w$ for width. Its perimeter is $2 \\times l + 2 \\times w$: two lengths and two widths. Its area is $l \\times w$. Knowing one of these does not tell you the other.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle has perimeter 26 cm. One side is 5 cm. Find the adjacent side and its area.",
      steps: [
        "Adjacent means next to it, meeting at a corner. Halfway around the rectangle is one side of each length, so half the perimeter is 26 ÷ 2 = 13 cm.",
        "One of those two sides is 5 cm, so the adjacent side is 13 − 5 = 8 cm.",
        "Check by adding all four sides: 5 + 8 + 5 + 8 = 26 cm. That matches the perimeter.",
        "The area is one side times the side next to it. Squares 1 cm on a side fit 5 rows of 8, so they cover 5 × 8 = 40 square cm.",
      ],
      answer: "Adjacent side: 8 cm. Area: 40 square cm.",
    },
    pitfalls: [
      "Adding only two sides that meet gives half the perimeter. Add all four.",
      "Multiplying two sides that meet gives the area, not the length around.",
      "A missing side is a length in cm, even when you start from an area.",
      "Two rectangles with the same perimeter can have different areas, and the other way round.",
    ],
    parentGuide:
      "Build two rectangles from the same number of square tiles. Trace each border and compare the lengths. Ask what stayed the same (the tiles, so the area) and what changed (the border, so the perimeter). Accept a drawing or a spoken explanation before a formula.",
  },
  {
    id: "same-length-different-unit",
    title: "Rename the length before combining it",
    summary:
      "A unit is the amount you measure with. A meter is about one big step. A centimeter is about as wide as a finger. One meter is the same length as 100 centimeters. Writing a length in a different unit changes the number and the unit, but not how long it is. Lengths must use the same unit before you add them. Grams and kilograms work the same way: 1 kilogram is 1000 grams.",
    templateIds: [
      "metric-length-rename",
      "metric-length-reverse",
      "mixed-length-total",
      "mixed-unit-border",
    ],
    senses: {
      unit: "unit",
      rename: "rename",
      side: "side",
      part: "part",
    },
    noLink: ["whole", "change", "changes", "boundary", "factor", "factors"],
    objectives: [
      "Use 10 mm = 1 cm, 100 cm = 1 m and 1000 m = 1 km.",
      "Change a length to a bigger or a smaller unit without changing the length.",
      "Keep an exact fraction or decimal when the new number is not whole.",
      "Write every side in one unit before finding a perimeter.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The object does not change",
        paragraphs: [
          "A meter is about the length of a big step. 3 m means 3 meters. A centimeter is about as wide as a finger. 3 cm means 3 centimeters.",
          "A meter stick is 1 meter long. It is also 100 centimeters long. The centimeter is the smaller unit, so more of them fit along the same stick.",
          "Writing a length in a new unit is called converting it, or renaming it. It changes the number and the unit. It does not change the stick.",
        ],
      },
      {
        title: "Small unit, bigger number",
        paragraphs: [
          "1 meter and 100 centimeters are the same length. So 3 meters is 3 groups of 100 centimeters: 3 × 100 = 300 cm.",
          "Going the other way, a bigger unit gives a smaller number. 25 cm is one fourth of a meter, because 4 × 25 = 100. So 75 cm is three of those fourths: 3/4 m. When a length is less than one of the new units, the answer is a fraction, a part of one unit.",
        ],
      },
      {
        title: "Use the right number for each pair of units",
        paragraphs: [
          "A millimeter, mm, is the smallest of these units. 10 millimeters make 1 centimeter. 100 centimeters make 1 meter. 1000 meters make 1 kilometer, km.",
          "These numbers are different, so write the one for your two units first. Then multiply or divide. To go to a smaller unit, multiply: there will be more of them. To go to a bigger unit, divide: there will be fewer.",
          "To write 1250 m in kilometers, divide by 1000. 1250 m is 1000 m and 250 m more. 250 m is one fourth of a kilometer, written 0.25 km. So 1250 m is 1.25 km. Check by going back: 1 km is 1000 m and 0.25 km is 250 m, which makes 1250 m.",
          "Mass works the same way. Mass is how heavy something is. 1 kilogram is 1000 grams, written 1 kg = 1000 g. So 7 kg is 7 × 1000 = 7000 g.",
        ],
      },
      {
        title: "Use one unit before you add",
        paragraphs: [
          "A 2 m strip and a 35 cm strip are 200 cm + 35 cm = 235 cm long in all. Adding 2 + 35 would treat a meter and a centimeter as the same size. They are not.",
          "Perimeter is the distance all the way around a shape. For a rectangle, first write both side lengths in the unit the question asks for. Then count each side twice, because a rectangle has two of each.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Converting a fixed length",
        paragraphs: [
          "Converting changes the number and the unit. The length stays the same.",
          "Say one big unit is the same as some number of small units, as 1 m is 100 cm. Call that number $k$. To write a length in the small units, multiply its number by $k$. To go back to the big units, divide by $k$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangle is 2 m long and 35 cm wide. What is its perimeter in centimeters?",
      steps: [
        "The answer must be in centimeters, so write the length in centimeters first. 1 m is 100 cm, so 2 m is 2 × 100 = 200 cm.",
        "Halfway around the rectangle is one length and one width: 200 + 35 = 235 cm.",
        "A rectangle has two lengths and two widths, so all the way around is twice that: 2 × 235 = 470 cm.",
        "Check by adding all four sides: 200 + 35 + 200 + 35 = 470 cm.",
      ],
      answer: "470 cm",
    },
    pitfalls: [
      "Converting renames a length. It does not stretch or shrink the object.",
      "The number you multiply or divide by depends on the two units. In these lessons it is 10, 100 or 1000.",
      "A whole number, like 75, in a small unit can become a fraction, a part of one unit, in a bigger unit.",
      "Do not add numbers that are in different units. Convert first.",
    ],
    parentGuide:
      "Before calculating, ask whether the number should get bigger or smaller. Have the learner convert one length both ways, then use the converted length in an addition or perimeter problem.",
  },
  {
    id: "rectangles-with-two-conditions",
    title: "Find every candidate, then test the conditions",
    summary:
      "A rectangle is a flat shape with four straight sides and four square corners. Its area is one side times the side next to it. Its perimeter is all four sides added. A whole number is a counting number like 1, 2 or 3, with no part like a half. To find a rectangle that fits two rules, list every pair of whole-number sides that multiply to the area. Then check each pair's perimeter.",
    templateIds: [
      "rectangle-two-constraints-choice",
      "rectangle-existence-choice",
    ],
    senses: {
      side: "side",
      square: "square-shape",
      product: "product-multiply",
      "more than": "more-than",
    },
    noLink: ["rule", "rules", "argument", "factor"],
    objectives: [
      "List every rectangle with a given area and whole-number sides.",
      "Check each one against an exact perimeter or a largest allowed perimeter.",
      "Use the full list to show that no rectangle works.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Try every side pair",
        paragraphs: [
          "A rectangle's area is one side length times the side length next to it. A square centimeter, or square cm, is a square with sides 1 centimeter long. A centimeter is about as wide as a finger. Area counts how many square units cover the shape.",
          "For an area of 24 square units, the sides could be 4 and 6, because 4 × 6 = 24. They could also be 3 and 8. Two whole numbers that multiply to make a number are called a factor pair of it.",
          "So list the factor pairs of the area. Then check each pair's perimeter, the total of all four sides.",
        ],
      },
      {
        title: "Area makes the list",
        paragraphs: [
          "Take an area of 24 square cm, with sides that are whole numbers bigger than 0. The pairs are 1 × 24, 2 × 12, 3 × 8 and 4 × 6.",
          "A 4 by 6 rectangle turned on its side is a 6 by 4 rectangle. It is the same size, so it is not a new answer here.",
          "Try the shorter side 1, then 2, then 3, and so on. For each one, ask: what times it makes 24? If no whole number works, as with 5, skip it. Stop when the shorter side would be bigger than the longer side. After that, the pairs only repeat turned-around ones.",
        ],
      },
      {
        title: "Check the second rule",
        paragraphs: [
          "The perimeter of a rectangle is 2 × (one side + the other side), since it has two sides of each length. The four rectangles with area 24 have perimeters of 50, 28, 22 and 20 cm.",
          "At most 22 cm means 22 cm or less. Both 3 × 8, with perimeter 22, and 4 × 6, with perimeter 20, fit. A question like this can have more than one answer.",
          "Exactly 22 cm allows only 22. From this list, only 3 × 8 fits. Read which rule the question gives.",
        ],
      },
      {
        title: "Not listed does not mean impossible",
        paragraphs: [
          "To say that no rectangle works, check every factor pair, not just the answer choices.",
          "Try area 24 square cm with perimeter exactly 24 cm. The four perimeters are 50, 28, 22 and 20 cm. None is 24, so no rectangle with whole-number sides fits.",
          "This only covers whole-number sides. A rectangle with sides that are not whole numbers might still work. So say no rectangle with whole-number sides fits.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Area and whole-number sides",
        paragraphs: [
          "For a rectangle with whole-number sides, the area is the two side lengths multiplied. So the factor pairs of the area give every possible rectangle with that area. A turned-around rectangle counts as the same one.",
          "Test the second rule, about the perimeter, against that complete list. If no pair passes, no rectangle with whole-number sides fits both rules.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Find all rectangles with area 36 square cm, positive whole-number sides and perimeter at most 26 cm.",
      steps: [
        "Positive means bigger than 0. At most 26 means 26 or less. List each factor pair of 36 once, shorter side first: 1 × 36, 2 × 18, 3 × 12, 4 × 9 and 6 × 6.",
        "A rectangle has two sides of each length. So add one side and the other, then double the sum. That gives the perimeters 74, 40, 30, 26 and 24 cm.",
        "Only 26 and 24 are 26 or less, so those two pass.",
        "So the rectangles are 4 cm by 9 cm and 6 cm by 6 cm. Each covers 36 square cm. A rotation, the same rectangle turned on its side, is not a new answer.",
      ],
      answer: "4 cm by 9 cm and 6 cm by 6 cm, including their rotations",
    },
    pitfalls: [
      "The right area does not guarantee the right perimeter. Check both rules.",
      "Do not skip a pair with two equal sides, like 6 × 6.",
      "At most allows the number itself. Exactly allows only that number.",
      "A pair missing from the choices does not prove that no rectangle works.",
    ],
    parentGuide:
      "Ask how the learner knows the list of side pairs that multiply to the area (the factor pairs) is complete. Give one pair of conditions with two answers and another with none. In both, ask for the evidence and for the condition that the sides are positive whole numbers.",
  },
  {
    id: "buy-enough-compare-the-bills",
    title: "Compare the bill for enough material",
    summary:
      "A meter is about one big step, and 6 m means 6 meters. Some stores sell ribbon only in whole packs, like packs 6 meters long. You cannot buy part of a pack, so buy at least enough packs: that much ribbon or more. Pieces can be joined end to end, with no ribbon lost. You pay for every pack, even ribbon you do not use. Another store may sell any length at a price per meter, the cost of 1 meter. Compare the two total costs.",
    templateIds: ["whole-pack-ribbon-choice"],
    senses: { part: "part" },
    noLink: ["whole", "rule", "rules", "leaves", "change"],
    objectives: [
      "Find the smallest number of whole packs that gives enough length.",
      "Compare the total cost of whole packs with buying by the meter.",
      "Notice leftover ribbon, and notice when two bills are the same.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Buy what the store sells",
        paragraphs: [
          "Say ribbon comes only in packs of 6 meters. You need 7 meters. One pack is 1 meter short. So you buy two packs.",
          "You pay for both packs, even though some ribbon is left over.",
        ],
      },
      {
        title: "What can you actually buy?",
        paragraphs: [
          "A shop that sells only whole 6-meter packs will not sell you a piece of a pack. You need 7 meters. One pack is too short, so you buy two and pay for both. You get 12 meters, but you need only 7.",
          "Another shop may sell any length for a price per meter. The price per meter is the cost of 1 meter. There you can buy exactly 7 meters. Compare the bills for purchases that really give you enough.",
        ],
      },
      {
        title: "You pay for leftovers too",
        paragraphs: [
          "Say two 6-meter packs cost 6 dollars each. Then 12 meters cost 2 × 6 = 12 dollars. You use 7 meters, so 5 meters are left over. The leftovers do not make the bill smaller.",
          "So a lower price per meter can still give a bigger bill, when whole packs make you buy extra. First find how much you must buy. Then multiply by the price.",
        ],
      },
      {
        title: "Read the store's rules",
        paragraphs: [
          "If the story says pieces join without loss, the lengths simply add. Two 6-meter pieces joined make 12 meters. Do not add anything the story does not say, like waste, tax or discounts.",
          "If what you need is exactly a number of whole packs, buy just that many. You need no extra pack. If both bills come out the same, neither store is cheaper.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Whole packs and total cost",
        paragraphs: [
          "At least means that much or more. When a pack cannot be split, buy the smallest number of whole packs that gives at least the length you need.",
          "The total cost is the number of packs times the price of one pack. Ribbon left over does not lower the bill.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Need 10 m of ribbon; pieces join without loss. Offer A sells whole 6 m packs for 5 dollars each. Offer B sells any length for 1 dollar per meter. No other charges. Which costs less?",
      steps: [
        "Offer A: one 6 m pack is too short for 10 m. Two packs give 12 m, which is enough. They cost 2 × 5 = 10 dollars.",
        "With A, 12 − 10 = 2 m is left over. You still pay for both whole packs.",
        "Offer B sells exactly 10 m. At 1 dollar per meter, that costs 10 × 1 = 10 dollars.",
        "Both bills are 10 dollars, so they cost the same. The leftover ribbon does not change the price.",
      ],
      answer: "Same cost: 10 dollars each",
    },
    pitfalls: [
      "Do not buy too few packs. You would have too little ribbon.",
      "When the length you need is exactly some whole packs, buy no extra pack.",
      "Compare the whole bills, not just the price of 1 meter.",
      "Do not make up refunds for leftovers or charges the story does not give.",
    ],
    parentGuide:
      "Use paper strips as packs. Ask for the smallest purchase that covers the need. Keep three amounts apart: the length used, the length bought and the cost. Then compare a case that needs an extra pack with a case that fits a whole number of packs exactly.",
  },
];
