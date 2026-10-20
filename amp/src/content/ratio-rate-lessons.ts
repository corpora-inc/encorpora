import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const rates: Lesson["sections"][number] = {
  title: "Rates and unit rates",
  paragraphs: [
    "A rate compares two quantities measured in different units, such as 132 pages printed in 6 minutes. A unit rate gives the amount of one quantity for exactly 1 unit of the other: the pages printed in 1 minute. The word per means for each 1, so pages per minute means pages for each 1 minute.",
    "A rate can be read in two directions. 132 pages in 6 minutes gives 132 ÷ 6 = 22 pages per minute, and also 6 ÷ 132 = 1/22 minute per page. The question decides which quantity is at 1: divide the other quantity by it.",
  ],
};
const ratios: Lesson["sections"][number] = {
  title: "Ratios and equivalent ratios",
  paragraphs: [
    "A ratio compares two quantities, such as 2 cups of flour for every 3 cups of sugar. It is written 2 : 3 and read “2 to 3”; the order matches the order of the words, so flour comes first.",
    "Equivalent ratios describe the same relationship at a different size. Multiplying both quantities by the same number keeps the relationship: a double batch uses 2 × 2 = 4 cups of flour and 2 × 3 = 6 cups of sugar, so 4 : 6 is equivalent to 2 : 3. Every equivalent ratio has the same unit rate: 3/2 cups of sugar for each cup of flour.",
  ],
};
const equalGroups: Lesson["sections"][number] = {
  title: "Three numbers in every equal-groups story",
  paragraphs: [
    "This lesson uses multiplication and division facts within 100. Many stories describe equal groups: bags that each hold the same number of apples, rows that each hold the same number of chairs, or pieces of ribbon that are all the same length. Every such story has three numbers: the number of groups, the size of each group, and the total.",
    "The total is the number of groups times the size of each group: 6 bags of 8 apples hold 6 × 8 = 48 apples. Arrays are equal groups too, with each row as one group. So are measurement stories: each piece of ribbon is a group, and its length in centimeters is the group size.",
  ],
};
const tapes: Lesson["sections"][number] = {
  title: "Which number is missing?",
  paragraphs: [
    "A tape diagram draws the total as one bar split into equal parts. The figure shows the same story three ways: 6 groups of 8 make 48. When the total is unknown, the parts are known, so multiply: 6 × 8 = ?. When the size of each part is unknown, a known total is split into a known number of parts: 48 ÷ 6 = ?. When the number of parts is unknown, a known total is measured out in parts of a known size: 48 ÷ 8 = ?.",
    "So the question is always which of the three numbers the story leaves out. Multiplication finds a total; division finds a part of a known total. Words such as each and in all appear in both kinds of story, so read what is given instead of hunting for a key word.",
  ],
  illustration: "story-tapes",
};

export const ratioRateLessons: Lesson[] = [
  {
    id: "unit-rate",
    title: "Unit rates: the amount for 1",
    summary:
      "Divide one quantity by the other to find the amount for exactly 1 unit.",
    templateIds: ["unit-rate"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain why dividing two quantities gives the amount for 1 unit.",
      "Find unit rates in whole numbers, decimals and fractions, in the direction the question asks.",
    ],
    sections: [
      rates,
      {
        title: "Why dividing gives the amount for 1",
        paragraphs: [
          "This lesson uses division of whole numbers and decimals. On the double number line in the figure, the top line counts pages and the bottom line counts minutes. A mark on one line and the mark directly below it are a matching pair: the pages printed by that time.",
          "The 6 minutes split into 6 equal 1-minute parts, and the 132 pages split into 6 equal parts with them. One part is 132 ÷ 6 = 22 pages: the pages for 1 minute. Once the unit rate is known, any other pair follows by multiplying: in 4 minutes, 4 × 22 = 88 pages.",
        ],
        illustration: "rate-double-line",
      },
    ],
    workedExample: {
      prompt:
        "A runner runs 4 miles in 34 minutes at a steady pace. How many minutes does it take the runner to run 1 mile?",
      steps: [
        "The question puts 1 mile at the unit, so divide the minutes by the miles.",
        "34 ÷ 4 = 8.5, because 4 × 8.5 = 34.",
        "The runner takes 8.5 minutes for each mile.",
      ],
      answer: "8.5",
    },
    pitfalls: [
      "Divide in the order the question asks: minutes per mile is minutes ÷ miles, not miles ÷ minutes.",
      "Keep the units with the number: 22 pages per minute, not just 22.",
      "A unit rate need not be a whole number; 9 cups of flour for 4 loaves is 9/4 cups per loaf.",
    ],
    parentGuide:
      "Time how many sit-ups or jumping jacks are done in 3 minutes. Divide to find the number per minute, then predict the number for 5 minutes and test it.",
  },
  {
    id: "better-buy",
    title: "Find the better buy",
    summary:
      "Compare the price of 1 item, not the total prices of different-sized packs.",
    templateIds: ["better-buy"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find a unit price by dividing a total price by the number of items or units.",
      "Choose the lower unit price, or recognize equal unit prices.",
    ],
    sections: [
      {
        title: "Unit price",
        paragraphs: [
          "This lesson uses division with dollars and cents. A unit price is the cost of 1 item, or of 1 unit of measure such as 1 ounce. It is a unit rate in dollars per item, found by dividing the total price by the number of items.",
          "Comparing total prices does not compare value: a smaller pack usually costs less in all because it holds less. Unit prices put both packs on the same footing, the price of exactly 1 item. The lower unit price is the better buy.",
        ],
      },
      {
        title: "Seeing the comparison",
        paragraphs: [
          "Each bar in the figure is a total price drawn to scale and split into one equal part per granola bar. The 6-pack costs 4.50 dollars, so each of its 6 parts is 4.50 ÷ 6 = 0.75 dollars. The 8-pack costs 5.60 dollars, so each of its 8 parts is 5.60 ÷ 8 = 0.70 dollars.",
          "The 8-pack's bar is longer, but its parts are shorter: each granola bar costs less. When the unit prices are equal, neither pack is a better buy per item; the larger pack costs more in all only because it holds more.",
        ],
        illustration: "unit-price-tapes",
      },
    ],
    workedExample: {
      prompt:
        "Store A sells a 12-ounce box of cereal for 3.00 dollars. Store B sells a 20-ounce box of cereal for 4.40 dollars. Which is the better buy, with the lower price per ounce?",
      steps: [
        "Store A: 3.00 ÷ 12 = 0.25 dollars per ounce.",
        "Store B: 4.40 ÷ 20 = 0.22 dollars per ounce.",
        "0.22 dollars is less than 0.25 dollars, so Store B has the better buy, even though its box costs more in all.",
      ],
      answer: "Store B",
    },
    pitfalls: [
      "Do not choose the lower total price; the cheaper pack may hold much less.",
      "A bigger package is not always cheaper per item; check the unit prices.",
      "Divide the price by the number of items, not the number of items by the price.",
    ],
    parentGuide:
      "At a store, pick two sizes of the same product and use the shelf tags to find the price per ounce or per item. Decide which is the better buy before reading the tag's unit price.",
  },
  {
    id: "ratio-table-missing",
    title: "Complete a ratio table",
    summary:
      "Every column of a ratio table is the simplest ratio multiplied by one number.",
    templateIds: ["ratio-table-missing"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the simplest ratio from a column of a ratio table.",
      "Find a missing value by multiplying both parts of the simplest ratio by the same number.",
    ],
    sections: [
      ratios,
      {
        title: "Every column is a multiple of the simplest ratio",
        paragraphs: [
          "A ratio table lists equivalent ratios in columns: the top row gives one quantity and the bottom row the other. To find the simplest ratio, divide both numbers in a column by their greatest common factor. 4 and 6 share the factor 2: 4 ÷ 2 = 2 and 6 ÷ 2 = 3, so the simplest ratio is 2 : 3. The figure shows each column as 2 : 3 multiplied by 2, 5 or 7.",
          "To fill a missing cell, find the multiplier from the known entry in its column and apply it to the other row. If flour is 14 = 7 × 2, then sugar is 7 × 3 = 21. Adding the same number to both rows does not keep the ratio: 2 + 12 = 14 and 3 + 12 = 15 give 14 : 15, a different mixture.",
        ],
        illustration: "ratio-table-scaling",
      },
    ],
    workedExample: {
      prompt:
        "A table of equivalent ratios of flour to sugar, in cups, has the columns 4 and 6, 10 and 15, and 14 and a missing amount of sugar. How many cups of sugar go with 14 cups of flour?",
      steps: [
        "4 ÷ 2 = 2 and 6 ÷ 2 = 3, so the simplest ratio is 2 : 3.",
        "In the third column, flour is 14 = 7 × 2, so that column is 7 times the simplest ratio.",
        "Sugar is 7 × 3 = 21.",
      ],
      answer: "21",
    },
    pitfalls: [
      "Multiply both rows by the same number; adding the same number changes the ratio.",
      "Find the multiplier from the row that is known in the missing column.",
      "Keep the rows in their order: the top row stays flour and the bottom row stays sugar.",
    ],
    parentGuide:
      "Make a drink with 2 scoops of mix for every 3 cups of water. Write the amounts for 2, 4 and 5 batches in a table, and ask what changes and what stays the same.",
  },
  {
    id: "double-number-line-missing",
    title: "Read a double number line",
    summary:
      "Shrink a known pair to 1 unit, then stretch it to the amount asked for.",
    templateIds: ["double-number-line-missing"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Read aligned marks on a double number line as equivalent pairs.",
      "Find a missing value by going through the amount for 1 unit.",
    ],
    sections: [
      {
        title: "Two lines, one scale",
        paragraphs: [
          "A double number line is two number lines drawn one above the other, both starting at 0, one for each quantity. A mark on the top line and the mark directly below it form an equivalent pair, such as 45 miles and 3 hours. All the pairs share one ratio.",
          "The lines are drawn to scale: a mark twice as far from 0 shows twice as much on both lines. That is why the marks stay aligned when both values are multiplied or divided by the same number.",
        ],
      },
      {
        title: "Go through 1",
        paragraphs: [
          "In the figure, 45 miles is aligned with 3 hours. Dividing both values by 3 moves the pair to 15 miles and 1 hour: the unit rate, 15 miles per hour. Multiplying both values by 5 moves it to 75 miles and 5 hours.",
          "When the number of hours is the unknown, divide by the unit rate instead: 105 miles at 15 miles per hour takes 105 ÷ 15 = 7 hours. Check by multiplying: 7 × 15 = 105.",
        ],
        illustration: "rate-through-one",
      },
    ],
    workedExample: {
      prompt:
        "A train travels at a constant speed. It goes 45 miles in 3 hours. How many miles does it travel in 5 hours?",
      steps: [
        "Find the miles in 1 hour: 45 ÷ 3 = 15.",
        "Multiply by the number of hours: 15 × 5 = 75.",
        "Both lines changed by the same factors, ÷ 3 and then × 5, so 75 miles is aligned with 5 hours.",
      ],
      answer: "75",
    },
    pitfalls: [
      "Change both lines by the same factor; never add the same amount to both.",
      "Read the pair straight down: a value goes with the mark directly below or above it.",
      "When the bottom value is unknown, divide the top value by the unit rate.",
    ],
    parentGuide:
      "Draw two lines on paper for cups of rice and cups of water. Mark 1 cup of rice with 2 cups of water, then mark 2, 3 and 4 cups of rice and fill in the water.",
  },
  {
    id: "fraction-unit-rate",
    title: "Unit rates with fractions",
    summary:
      "Divide the amount by a fractional number of units by multiplying by its reciprocal.",
    templateIds: ["fraction-unit-rate"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find a unit rate when the given quantities are fractions.",
      "Explain dividing by a fraction as counting copies of a part to reach 1 whole unit.",
    ],
    sections: [
      {
        title: "A unit rate from fractions",
        paragraphs: [
          "This lesson uses fraction multiplication. A unit rate is the amount for 1 unit, even when the given amounts are fractions: walking 1/2 mile in 1/4 hour is a rate, and its unit rate is the distance walked in 1 hour.",
          "As with whole numbers, divide the amount by the number of units: 1/2 ÷ 1/4. The reciprocal of a fraction swaps its numerator and denominator; the reciprocal of 1/4 is 4/1 = 4. Dividing by a fraction gives the same result as multiplying by its reciprocal, as the next section shows.",
        ],
      },
      {
        title: "Count copies to reach 1",
        paragraphs: [
          "In the figure, the hours line is split into quarters. In each quarter hour the walker covers 1/2 mile. One hour holds 4 quarters, so the distance in 1 hour is 4 copies of 1/2 mile: 4 × 1/2 = 2 miles. That is 1/2 ÷ 1/4 = 1/2 × 4 = 2 miles per hour.",
          "When the time is not a single part, such as 2/3 hour, first find the amount for 1/3 hour by dividing by 2, then multiply by 3 to fill the hour. Together those steps multiply by 3/2, the reciprocal of 2/3: 3/4 mile in 2/3 hour gives 3/4 × 3/2 = 9/8 miles per hour.",
        ],
        illustration: "fraction-rate-copies",
      },
    ],
    workedExample: {
      prompt:
        "A recipe uses 3/4 cup of sugar for every 2/3 cup of flour. How many cups of sugar does it use for 1 cup of flour?",
      steps: [
        "Divide the sugar by the flour: 3/4 ÷ 2/3.",
        "Multiply by the reciprocal of 2/3: 3/4 × 3/2 = 9/8.",
        "Check: 2/3 × 9/8 = 18/24 = 3/4, the sugar given.",
      ],
      answer: "9/8",
    },
    pitfalls: [
      "Divide the amount by the units, not the units by the amount.",
      "Take the reciprocal of the divisor only: 3/4 ÷ 2/3 = 3/4 × 3/2.",
      "A unit rate can be more than the given amount when less than 1 unit is given.",
    ],
    parentGuide:
      "Pour 1/4 cup of water four times into a measuring cup to make 1 cup. Then ask: if 1/4 cup of rice needs 1/2 cup of water, how much water does 1 cup of rice need?",
  },
  {
    id: "story-operation-choice",
    title: "Multiply or divide?",
    summary:
      "Find which of the three numbers an equal-groups story leaves out: an unknown total means multiply, a known total means divide.",
    templateIds: ["story-operation-choice"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Identify the number of groups, the group size and the total in a story.",
      "Choose multiplication or division to model the story.",
    ],
    sections: [equalGroups, tapes],
    workedExample: {
      prompt:
        "Omar sets up 42 chairs in rows of 7 chairs. Which equation can be used to find the number of rows?",
      steps: [
        "The total, 42 chairs, is known, and so is the size of each row, 7 chairs.",
        "The number of rows is unknown. Measuring a total out in groups of a known size is division: 42 ÷ 7 = 6.",
        "The equation 42 ÷ 7 = ? models the story.",
      ],
      answer: "42 ÷ 7 = ?",
    },
    pitfalls: [
      "Do not multiply the two numbers just because both appear; check whether the total is one of them.",
      "Do not subtract one group at a time; division counts all the groups at once.",
      "In a division equation, the total comes first: 42 ÷ 7, not 7 ÷ 42.",
    ],
    parentGuide:
      "Use 24 coins. Make 4 equal piles and ask how many are in each pile; then make piles of 3 and ask how many piles there are. Name the equation each time.",
  },
  {
    id: "multiplication-division-story",
    title: "Solve equal-groups stories",
    summary:
      "Choose multiplication or division from what the story gives, solve, and check with the opposite operation.",
    templateIds: ["multiplication-division-story"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Decide whether an equal-groups, array or measurement story calls for multiplication or division.",
      "Solve the story and check the answer with the opposite operation.",
    ],
    sections: [
      equalGroups,
      tapes,
      {
        title: "Solve and check",
        paragraphs: [
          "After choosing the operation, compute and check with the opposite operation. If 48 ÷ 6 = 8, then 6 × 8 = 48 confirms that 6 groups of 8 rebuild the total.",
          "Give the answer with its unit, because the unit says which number was found: 8 apples in each bag, 6 bags, or 8 centimeters for each piece.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Lena cuts a 36-centimeter ribbon into 4 pieces of equal length. How long is each piece, in centimeters?",
      steps: [
        "The total length, 36 centimeters, and the number of pieces, 4, are known. The length of each piece is unknown.",
        "Splitting a total into a known number of equal parts is division: 36 ÷ 4 = 9.",
        "Check: 4 × 9 = 36. Each piece is 9 centimeters long.",
      ],
      answer: "9",
    },
    pitfalls: [
      "Multiply only when the total is unknown.",
      "Check a quotient by multiplying it back to the total.",
      "Say what the answer counts: groups, items in each group, or the total.",
    ],
    parentGuide:
      "Cut a 30-centimeter strip of paper into 5 equal pieces and measure one. Then cut pieces 6 centimeters long from another 30-centimeter strip and count them.",
  },
];

export const ratioRateMethods: Record<string, ProblemMethod> = {
  "unit-rate": {
    goal: "Find the amount of one quantity for exactly 1 unit of the other.",
    terms: [
      ["rate", "A comparison of two quantities in different units."],
      ["unit rate", "The amount for exactly 1 unit; per means for each 1."],
    ],
    method: [
      "Find which quantity the question puts at 1.",
      "Divide the other quantity by it.",
      "State the result with both units, such as pages per minute.",
    ],
    watch:
      "Divide in the order the question asks; minutes per mile is minutes ÷ miles.",
  },
  "better-buy": {
    goal: "Decide which of two packages costs less per item.",
    terms: [["unit price", "The price of 1 item or 1 unit of measure."]],
    method: [
      "Divide each total price by its number of items.",
      "Compare the two unit prices.",
      "The lower unit price is the better buy; equal unit prices are equally good.",
    ],
    watch: "Compare unit prices, not total prices.",
  },
  "ratio-table-missing": {
    goal: "Find the missing number in a table of equivalent ratios.",
    terms: [
      [
        "equivalent ratios",
        "Ratios made by multiplying both quantities by the same number.",
      ],
      ["simplest ratio", "A ratio whose two numbers have no common factor."],
    ],
    method: [
      "Divide a complete column by its greatest common factor to get the simplest ratio.",
      "Find the multiplier from the known entry in the column with the question mark.",
      "Multiply the other part of the simplest ratio by that multiplier.",
    ],
    watch: "Multiply both rows by the same number; do not add.",
  },
  "double-number-line-missing": {
    goal: "Find a missing value on a double number line.",
    terms: [
      [
        "double number line",
        "Two number lines with a shared 0; aligned marks are equivalent pairs.",
      ],
    ],
    method: [
      "Read a complete pair straight across the two lines.",
      "Divide both values by the bottom value to find the amount for 1 unit.",
      "Multiply the unit rate by the bottom value asked for, or divide a top value by it.",
    ],
    watch: "Change both lines by the same factor; never add the same amount.",
  },
  "fraction-unit-rate": {
    goal: "Find a unit rate when the quantities are fractions.",
    terms: [
      ["unit rate", "The amount for exactly 1 unit."],
      ["reciprocal", "The fraction with numerator and denominator swapped."],
    ],
    method: [
      "Divide the amount by the number of units.",
      "Multiply by the reciprocal of the divisor and simplify.",
      "Check: the unit rate times the given units equals the given amount.",
    ],
    watch: "Take the reciprocal of the divisor only.",
  },
  "story-operation-choice": {
    goal: "Choose the equation that models an equal-groups story.",
    terms: [
      [
        "equal groups",
        "Groups that each hold the same number, such as rows of chairs.",
      ],
    ],
    method: [
      "Name the number of groups, the size of each group and the total.",
      "Find which of the three the story leaves out.",
      "Unknown total: multiply. Known total: divide it by the other known number.",
    ],
    watch:
      "Look for whether the total is given, not for key words such as each.",
  },
  "multiplication-division-story": {
    goal: "Solve an equal-groups, array or measurement story.",
    terms: [
      [
        "equal groups",
        "Groups that each hold the same number, such as rows of chairs.",
      ],
    ],
    method: [
      "Name the number of groups, the size of each group and the total.",
      "Unknown total: multiply. Known total: divide it by the other known number.",
      "Check by multiplying the number of groups by the group size.",
    ],
    watch: "Multiply only when the total is unknown.",
  },
};

export const ratioRatePrinciples: Record<string, string> = {
  "unit-rate":
    "A unit rate is the amount for 1 unit: if a quantity a goes with $b$ units, a ÷ b goes with 1 unit.",
  "better-buy":
    "Packages compare fairly only at the same size; the unit price, total price ÷ number of items, puts every package at 1 item.",
  "ratio-table-missing":
    "Multiplying both quantities of a ratio by the same number gives an equivalent ratio, so every column is the simplest ratio times one number.",
  "double-number-line-missing":
    "Equivalent pairs scale together: dividing or multiplying both values by the same number keeps them aligned, so every pair passes through the unit rate at 1.",
  "fraction-unit-rate":
    "Dividing by a fraction c/d is multiplying by its reciprocal d/c: it counts how many copies of c/d unit make 1 unit.",
  "story-operation-choice":
    "In equal groups, total = number of groups × size of each group; an unknown total is found by multiplying, and an unknown factor by dividing the total by the known factor.",
  "multiplication-division-story":
    "In equal groups, total = number of groups × size of each group; an unknown total is found by multiplying, and an unknown factor by dividing the total by the known factor.",
};
