import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const rates: Lesson["sections"][number] = {
  stage: "intuition",
  title: "Shrink a group to one unit",
  paragraphs: [
    "A printer makes 132 pages in 6 minutes. It works at a steady speed, so it prints the same number of pages every minute. To find that number, split both amounts into 6 equal groups, one group for each minute. Each group is 1 minute and 132 ÷ 6 = 22 pages.",
    "A rate compares two amounts measured in different units, such as pages and minutes. A unit is the thing being counted or measured: a page, a minute, a mile. The amount that goes with exactly 1 unit is called a unit rate. The word per means for each one, so the unit rate here is 22 pages per minute: 22 pages for each 1 minute.",
    "The other unit can be the one instead. Minutes per page asks how much time goes with 1 page. Now split both amounts into 132 equal groups, one for each page. Each group is 1 page and 6 ÷ 132 = $\\tfrac{1}{22}$ of a minute.",
  ],
};
const ratios: Lesson["sections"][number] = {
  title: "Ratios and equivalent ratios",
  paragraphs: [
    "A ratio compares two amounts, such as 2 cups of flour for every 3 cups of sugar. It is written 2 : 3 and read “2 to 3”. The order matches the order of the words, so flour comes first.",
    "Equivalent ratios describe the same relationship at a different size. Multiply both amounts by the same number (not 0) and the relationship stays the same. A double batch uses 2 × 2 = 4 cups of flour and 2 × 3 = 6 cups of sugar. So 4 : 6 is equivalent to 2 : 3.",
    "Every equivalent ratio has the same unit rate, the amount for exactly 1 unit. Here it is $\\tfrac{3}{2}$ cups of sugar for each cup of flour, because 3 ÷ 2 = 6 ÷ 4 = 1.5.",
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
      "A unit is the thing you count or measure, such as a page, a minute or a mile. A unit rate is the amount that goes with exactly 1 unit, such as 22 pages for each 1 minute. To find it, share the amounts into equal groups until there is just 1 of the unit you care about. Dividing does that sharing in one step.",
    templateIds: ["unit-rate"],
    senses: { unit: "unit", fourths: "fourth" },
    noLink: ["side"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain why dividing one amount by the other gives the amount for 1 unit.",
      "Find unit rates that are whole numbers, decimals or fractions, putting at 1 the unit the question asks about.",
    ],
    sections: [
      rates,
      {
        stage: "method",
        title: "Divide in the direction the question asks",
        paragraphs: [
          "First decide which unit the question puts at 1. It is the unit named after the word per. Then divide the other amount by the amount of that unit.",
          "For pages per minute, the minutes become 1. So divide pages by minutes: 132 ÷ 6 = 22 pages per minute. For minutes per page, the pages become 1. So divide minutes by pages: 6 ÷ 132 = $\\tfrac{1}{22}$ minute per page.",
          "A number line is a line with evenly spaced marks for numbers. A double number line is two of them side by side: the top one counts minutes and the bottom one counts pages. Marks that line up go together. Split 6 minutes and 132 pages into 6 equal parts, and 1 minute lines up with 22 pages. The unit rate then predicts other amounts: 4 minutes lines up with 4 × 22 = 88 pages.",
          "A unit rate does not have to be a whole number (0, 1, 2, 3 and so on). It can be a decimal, a number with a decimal point such as 8.5. It can also be a fraction, a number of equal parts of 1, such as $\\tfrac{9}{4}$ (nine fourths).",
        ],
        illustration: "rate-double-line",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Rate and unit rate",
        paragraphs: [
          "A rate compares two quantities (amounts that can be measured or counted) with different units. Suppose $a$ units of one quantity go with $b$ units of another, at a constant (steady) rate. If $b$ is not 0, the first quantity per 1 unit of the second is $a \\div b$, also written $\\tfrac{a}{b}$. Going the other way gives $b \\div a$, when $a$ is not 0.",
          "Keep the units in the answer. For 132 pages in 6 minutes, $132 \\div 6 = 22$ pages per minute, and $6 \\div 132 = \\tfrac{1}{22}$ minute per page. These answer two different questions about the same printer.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A runner runs 4 miles in 34 minutes at a steady pace. How many minutes does it take the runner to run 1 mile?",
      steps: [
        "The question asks for the minutes that go with 1 mile. So split the 34 minutes into 4 equal groups, one for each mile. That is division: 34 ÷ 4.",
        "34 ÷ 4 = 8.5. Check by multiplying back: 4 × 8.5 = 34, so 4 miles at 8.5 minutes each takes 34 minutes.",
        "The runner takes 8.5 minutes for each mile. That is written 8.5 minutes per mile.",
      ],
      answer: "8.5",
      answerUnit: "minutes per mile",
    },
    pitfalls: [
      "Read the units before you divide. Minutes per mile means minutes ÷ miles, not miles ÷ minutes.",
      "Keep the units with the number. Write 22 pages per minute, not just 22.",
      "A unit rate can be a fraction. 9 cups of flour for 4 loaves is 9 ÷ 4 = $\\tfrac{9}{4}$ cups per loaf, which is 2.25 cups.",
    ],
    parentGuide:
      "Count how many jumping jacks the learner does in 3 minutes. Divide by 3 to find jumping jacks per minute. Then use that unit rate to predict the count for 5 minutes, and test the prediction.",
  },
  {
    id: "better-buy",
    senses: {
      part: "part",
      parts: "part",
      product: "product-multiply",
      unit: "unit",
      units: "unit",
    },
    noLink: ["scale"],
    title: "Find the better buy",
    summary:
      "The better buy is the package that gives you more for your money. A bigger box can cost more in all and still be cheaper for each item. So find what 1 item costs in each package. That cost is called the unit price. The package with the lower unit price is the better buy.",
    templateIds: ["better-buy"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find a unit price, the cost of 1 item, by dividing the total price by the number of items.",
      "Choose the package with the lower unit price, or say that both are equally good when the unit prices are equal.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare the price of one item",
        paragraphs: [
          "A box of 6 granola bars costs 4.50 dollars. A box of 8 granola bars costs 5.60 dollars. The 8-pack costs more in all, but it also holds more bars. Comparing the two totals is unfair, because the boxes hold different amounts.",
          "To compare fairly, find what 1 bar costs in each box. Share the price equally among the bars. That is division: 4.50 ÷ 6 = 0.75 dollars for each bar in the 6-pack, and 5.60 ÷ 8 = 0.70 dollars for each bar in the 8-pack. Each bar in the 8-pack costs less.",
        ],
      },
      {
        title: "Unit price",
        paragraphs: [
          "This lesson uses division with dollars and cents. A unit price is the cost of 1 item, or of 1 unit of measure such as 1 ounce. An ounce is a small unit of weight. To find a unit price, divide the total price by the number of items or units.",
          "A unit price is a kind of unit rate: an amount for exactly 1 unit, here dollars for 1 item. The word per means for each one, so 0.70 dollars per bar means 0.70 dollars for each bar.",
          "A smaller pack usually costs less in all, because it holds less. So the lower total price does not tell you which pack is cheaper. Unit prices put both packs at exactly 1 item. Then the lower unit price is the better buy.",
        ],
      },
      {
        title: "Seeing the comparison",
        paragraphs: [
          "In the figure, each bar is the total price of one box, drawn to scale. Drawn to scale means a longer bar stands for more money. Each bar is split into equal parts, one part for each granola bar in the box.",
          "The 6-pack costs 4.50 dollars, so each of its 6 parts is 4.50 ÷ 6 = 0.75 dollars. The 8-pack costs 5.60 dollars, so each of its 8 parts is 5.60 ÷ 8 = 0.70 dollars. The 8-pack's bar is longer, but its parts are shorter. So each granola bar in the 8-pack costs less.",
          "Sometimes the unit prices are equal. Then neither pack is a better buy for each item. The larger pack costs more in all only because it holds more.",
        ],
        illustration: "unit-price-tapes",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Compare equal quantities",
        paragraphs: [
          "For a number of items greater than 0, the unit price is the total price divided by the number of items. Suppose two packages hold the same kind and quality of item. Then the package with the lower unit price costs less for any equal number of items.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Store A sells a 12-ounce box of cereal for 3.00 dollars. Store B sells a 20-ounce box of cereal for 4.40 dollars. Which is the better buy, with the lower price per ounce?",
      steps: [
        "Store A: the question asks for the price of 1 ounce, so share 3.00 dollars among 12 ounces. 3.00 ÷ 12 = 0.25 dollars per ounce.",
        "Store B: share 4.40 dollars among 20 ounces the same way. 4.40 ÷ 20 = 0.22 dollars per ounce.",
        "Compare the unit prices: 0.22 dollars is less than 0.25 dollars. So Store B is the better buy, even though its box costs more in all.",
      ],
      answer: "Store B",
    },
    pitfalls: [
      "Do not choose the lower total price. The cheaper pack may hold much less.",
      "A bigger package is not always cheaper for each item. Check the unit prices.",
      "Divide the price by the number of items, not the number of items by the price. Price ÷ items gives dollars per item.",
    ],
    parentGuide:
      "At a store, pick two sizes of the same product. Use the price tags to find the price per ounce or per item for each size. Decide which is the better buy before reading the unit price printed on the shelf tag.",
  },
  {
    id: "ratio-table-missing",
    senses: { parts: "part", third: "third", unit: "unit" },
    noLink: ["changes", "factor"],
    title: "Complete a ratio table",
    summary:
      "A ratio compares two amounts, such as 2 cups of flour for every 3 cups of sugar. A ratio table lists matching amounts for bigger or smaller batches. To keep the recipe the same, multiply both amounts by the same number. That number is called the multiplier. So to fill a gap, find the multiplier and use it on the other amount.",
    templateIds: ["ratio-table-missing"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the simplest ratio, the version with the smallest whole numbers, from one column of a ratio table.",
      "Find a missing value by multiplying both parts of the simplest ratio by the same number.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Keep both amounts moving together",
        paragraphs: [
          "A recipe uses 2 cups of flour for every 3 cups of sugar. A double batch uses twice as much of each: 2 × 2 = 4 cups of flour and 2 × 3 = 6 cups of sugar. A triple batch uses 3 × 2 = 6 cups of flour and 3 × 3 = 9 cups of sugar. The mixture tastes the same each time, because both amounts grew by the same multiplier.",
          "A ratio table keeps these matching amounts together. Each column is one batch size. The top row is one amount, such as flour. The bottom row is the other amount, such as sugar.",
        ],
      },
      ratios,
      {
        title: "Every column is a multiple of the simplest ratio",
        paragraphs: [
          "The simplest ratio uses the smallest whole numbers (the numbers 0, 1, 2, 3 and so on) that keep the same relationship. To find it, divide both numbers in a column by the largest number that divides both of them evenly. That number is called their greatest common factor. 4 and 6 can both be divided evenly by 2: 4 ÷ 2 = 2 and 6 ÷ 2 = 3. So the simplest ratio is 2 : 3.",
          "Every column is the simplest ratio times its own multiplier. The figure shows 2 : 3 multiplied by 2, by 5 and by 7. That gives the columns 4 : 6, 10 : 15 and 14 : 21.",
          "To fill a missing cell, find the multiplier from the number you know in that column. Then use the same multiplier on the other row. If flour is 14, then 14 = 7 × 2, so the multiplier is 7. Sugar is 7 × 3 = 21.",
          "Adding the same number to both rows usually changes the ratio. Adding 12 gives 2 + 12 = 14 and 3 + 12 = 15. The ratio 14 : 15 is a different mixture, with almost as much flour as sugar.",
        ],
        illustration: "ratio-table-scaling",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Equivalent ratio columns",
        paragraphs: [
          "Take a pair of amounts greater than 0 in a ratio table. Multiply or divide both by the same number, not 0. The result is an equivalent pair, with the same relationship. That number is called the scale factor. In every column, the bottom amount divided by the top amount gives the same quotient: the answer when you divide.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A table of equivalent ratios of flour to sugar, in cups, has the columns 4 and 6, 10 and 15, and 14 and a missing amount of sugar. How many cups of sugar go with 14 cups of flour?",
      steps: [
        "Find the simplest ratio from a full column. 4 and 6 can both be divided by 2: 4 ÷ 2 = 2 and 6 ÷ 2 = 3. So the simplest ratio is 2 : 3.",
        "Find the multiplier for the third column from the amount you know. Flour is 14, and 14 = 7 × 2. So that column is the simplest ratio times 7.",
        "Use the same multiplier on sugar, so the mixture stays the same: 7 × 3 = 21.",
      ],
      answer: "21",
    },
    pitfalls: [
      "Multiply both rows by the same number. Adding the same number to both rows usually changes the ratio.",
      "Find the multiplier from the row you know in the column with the missing number.",
      "Keep the rows in their order. The top row stays flour and the bottom row stays sugar.",
    ],
    parentGuide:
      "Make a drink with 2 scoops of mix for every 3 cups of water. Write the amounts for 2, 4 and 5 batches in a table. Ask what changes from column to column and what stays the same.",
  },
  {
    id: "double-number-line-missing",
    senses: { third: "third", unit: "unit" },
    noLink: ["change", "changes", "scale"],
    title: "Read a double number line",
    summary:
      "A number line is a line with evenly spaced marks for numbers. A double number line is two number lines, one above the other, for two amounts that grow together, such as miles and hours. Marks that line up go together. Divide both amounts to find the amount for 1 unit. Then multiply to find any other matching pair.",
    templateIds: ["double-number-line-missing"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Read marks that line up on a double number line as matching pairs of amounts.",
      "Find a missing value by first finding the amount for 1 unit.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two scales tell one story",
        paragraphs: [
          "A train travels at a steady speed. It goes 45 miles in 3 hours. Draw one line for miles on top and one line for hours below it. The mark for 45 miles sits right above the mark for 3 hours, because they happen together.",
          "At a steady speed, twice the time gives twice the miles. A third of the time gives a third of the miles. A multiplier is a number you multiply by. So both lines always change by the same multiplier.",
        ],
      },
      {
        title: "Two lines, one scale",
        paragraphs: [
          "A double number line is two number lines drawn one above the other. Both start at 0, and each line is for one amount. A mark on the top line and the mark directly below it go together. Such a matching pair is called an equivalent pair, such as 45 miles and 3 hours. All the pairs have the same ratio, the same comparison of the two amounts.",
          "Each line is drawn to scale. That means a mark twice as far from 0 shows twice as much, on both lines. So the marks stay lined up when both values are multiplied or divided by the same number.",
        ],
      },
      {
        title: "Go through 1",
        paragraphs: [
          "In the figure, 45 miles lines up with 3 hours. Divide both values by 3, and the pair becomes 15 miles and 1 hour. The amount for exactly 1 unit is called the unit rate, here 15 miles per hour. Per means for each one.",
          "From the unit rate, multiply to reach other pairs. Multiply both values by 5, and the pair becomes 75 miles and 5 hours.",
          "Sometimes the number of hours is the missing value. Then divide the miles by the unit rate. 105 miles at 15 miles per hour takes 105 ÷ 15 = 7 hours. Check by multiplying back: 7 × 15 = 105.",
        ],
        illustration: "rate-through-one",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Matching pairs scale together",
        paragraphs: [
          "Suppose two amounts keep a constant (unchanging) ratio. Then each pair of lined-up marks on a double number line shows matching amounts. Multiply or divide both values by the same number greater than 0, and you get another lined-up pair. In every pair except 0 and 0, the top value divided by the bottom value is the same unit rate.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A train travels at a constant speed. It goes 45 miles in 3 hours. How many miles does it travel in 5 hours?",
      steps: [
        "Find the miles in 1 hour. Divide both values by 3 so the hours become 1: 45 ÷ 3 = 15 miles in 1 hour.",
        "Now go from 1 hour to 5 hours. Multiply both values by 5: 15 × 5 = 75 miles.",
        "Both lines changed by the same steps, ÷ 3 and then × 5. So 75 miles lines up with 5 hours.",
      ],
      answer: "75",
    },
    pitfalls: [
      "Change both lines by the same multiplier. Adding the same amount to both lines usually changes how the amounts compare.",
      "Read each pair straight up and down. A value goes with the mark directly above or below it.",
      "When the bottom value is missing, divide the top value by the unit rate.",
    ],
    parentGuide:
      "Draw two lines on paper, one for cups of rice and one for cups of water. Mark 1 cup of rice above 2 cups of water. Then mark 2, 3 and 4 cups of rice, and fill in the water that lines up with each.",
  },
  {
    id: "fraction-unit-rate",
    senses: {
      fourths: "fourth",
      "more than": "more-than",
      part: "part",
      parts: "part",
      thirds: "third",
      unit: "unit",
      units: "unit",
      whole: "whole",
    },
    title: "Unit rates with fractions",
    summary:
      "A unit rate is the amount that goes with exactly 1 unit, such as miles in 1 hour. Sometimes you know the amount for only part of a unit, such as $\\tfrac{1}{4}$ hour. Then count how many of those parts make 1 whole unit. To find the unit rate, divide the amount by the number of units, even when both are fractions.",
    templateIds: ["fraction-unit-rate"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find a unit rate when the given amounts are fractions.",
      "Explain dividing by a fraction as counting how many copies of a part make 1 whole unit.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A part of a unit can reveal a full unit",
        paragraphs: [
          "A fraction is a number of equal parts of 1 whole. In $\\tfrac{3}{4}$, the bottom number 4 says the whole is split into 4 equal parts. The top number 3 says how many of those parts you have.",
          "Suppose $\\tfrac{3}{4}$ of a batch needs 6 cups of flour. That is 3 equal parts. So $\\tfrac{1}{4}$ of the batch, 1 part, needs 6 ÷ 3 = 2 cups. A whole batch is 4 parts, so it needs 4 × 2 = 8 cups.",
          "Those two steps divide 6 by $\\tfrac{3}{4}$. A shortcut does the same work: to divide by a fraction (not 0), multiply by its reciprocal, the fraction turned upside down. The reciprocal of $\\tfrac{3}{4}$ is $\\tfrac{4}{3}$, and $6 \\times \\tfrac{4}{3} = 8$ cups.",
        ],
      },
      {
        title: "A unit rate from fractions",
        paragraphs: [
          "This lesson uses fraction multiplication. A rate is a comparison of two amounts with different units, such as miles and hours. A unit rate is the amount for exactly 1 unit, even when the given amounts are fractions.",
          "For example, a walker goes $\\tfrac{1}{2}$ mile in $\\tfrac{1}{4}$ hour. The unit rate is the distance walked in 1 hour. As with whole numbers, divide the amount by the number of units: $\\tfrac{1}{2} \\div \\tfrac{1}{4}$.",
          "The top number of a fraction is called the numerator, and the bottom number is called the denominator. The reciprocal swaps them. So the reciprocal of $\\tfrac{1}{4}$ is $\\tfrac{4}{1}$, which is 4. The next section shows why dividing by $\\tfrac{1}{4}$ gives the same result as multiplying by 4.",
        ],
      },
      {
        title: "Count copies to reach 1",
        paragraphs: [
          "In the figure, the hours line is split into quarters (fourths) of an hour. In each quarter hour the walker covers $\\tfrac{1}{2}$ mile. One hour holds 4 quarters. So the distance in 1 hour is 4 copies of $\\tfrac{1}{2}$ mile: $4 \\times \\tfrac{1}{2} = 2$ miles. That is $\\tfrac{1}{2} \\div \\tfrac{1}{4} = \\tfrac{1}{2} \\times 4 = 2$ miles per hour.",
          "Sometimes the time is more than one part, such as $\\tfrac{2}{3}$ hour, which is 2 thirds. Say the walker goes $\\tfrac{3}{4}$ mile in $\\tfrac{2}{3}$ hour. First find the distance for $\\tfrac{1}{3}$ hour: divide by 2. Then fill the hour with 3 thirds: multiply by 3.",
          "Dividing by 2 and then multiplying by 3 is the same as multiplying by $\\tfrac{3}{2}$. That is the reciprocal of $\\tfrac{2}{3}$. So the unit rate is $\\tfrac{3}{4} \\times \\tfrac{3}{2} = \\tfrac{9}{8}$ miles per hour.",
        ],
        illustration: "fraction-rate-copies",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "A rate for one whole unit",
        paragraphs: [
          "Suppose an amount $a$ goes with $b$ units, where $b$ is a fraction other than 0. Then the amount per 1 unit is $a \\div b$. Dividing by $\\tfrac{c}{d}$, where $c$ and $d$ are not 0, gives the same result as multiplying by its reciprocal $\\tfrac{d}{c}$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A recipe uses 3/4 cup of sugar for every 2/3 cup of flour. How many cups of sugar does it use for 1 cup of flour?",
      steps: [
        "The question puts 1 cup of flour at 1 unit. So divide the sugar by the flour: $\\tfrac{3}{4} \\div \\tfrac{2}{3}$.",
        "To divide by $\\tfrac{2}{3}$, multiply by its reciprocal $\\tfrac{3}{2}$, made by swapping top and bottom: $\\tfrac{3}{4} \\times \\tfrac{3}{2} = \\tfrac{3 \\times 3}{4 \\times 2} = \\tfrac{9}{8}$.",
        "Check by multiplying back. $\\tfrac{2}{3}$ cup of flour times $\\tfrac{9}{8}$ cups per cup is $\\tfrac{18}{24} = \\tfrac{3}{4}$, the sugar given.",
      ],
      answer: "9/8",
    },
    pitfalls: [
      "Divide the amount by the number of units, not the units by the amount.",
      "Take the reciprocal of the number you divide by only: $\\tfrac{3}{4} \\div \\tfrac{2}{3} = \\tfrac{3}{4} \\times \\tfrac{3}{2}$.",
      "The unit rate can be bigger than the given amount. That happens when less than 1 unit is given.",
    ],
    parentGuide:
      "Pour $\\tfrac{1}{4}$ cup of water into a measuring cup four times to make 1 cup. Then ask: if $\\tfrac{1}{4}$ cup of rice needs $\\tfrac{1}{2}$ cup of water, how much water does 1 cup of rice need?",
  },
  {
    id: "story-operation-choice",
    title: "Multiply or divide?",
    summary:
      "Use multiplication for an unknown total and division for an unknown group count or size.",
    templateIds: ["story-operation-choice"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Identify the number of groups, the group size and the total in a story.",
      "Choose multiplication or division to model the story.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Find which equal-group amount is missing",
        paragraphs: [
          "Every equal-groups story has a group count, a size for each group, and a total. If you know both group count and size, multiply to find the total. If you know the total and one of those two, divide to find the other. An equation writes that relationship with numbers and a symbol for the unknown.",
        ],
      },
      equalGroups,
      tapes,
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Three equal-group quantities",
        paragraphs: [
          "For equal groups, total equals number of groups times size of each group. Multiplication finds an unknown total; division by a known nonzero factor finds the other factor.",
        ],
      },
    ],
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
      "Name the number of groups, the size of each, and the total before calculating.",
    templateIds: ["multiplication-division-story"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Decide whether an equal-groups, array or measurement story calls for multiplication or division.",
      "Solve the story and check the answer with the opposite operation.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Name the groups before choosing",
        paragraphs: [
          "A story about six bags with eight apples each gives a number of bags and a number in each bag. It asks for the total. A story with 48 apples and six bags asks how many go in each bag. The same three amounts make both stories.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Check the group relationship",
        paragraphs: [
          "The same equation connects all equal-group stories: total equals group count times group size. A quotient is correct when multiplying it by the known factor reconstructs the total.",
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
    goal: "Find how much of one quantity goes with exactly 1 unit of the other.",
    senses: { unit: "unit" },
    intuition:
      "A unit is the thing being counted or measured, such as a page or a minute. A unit rate is the amount that goes with exactly 1 unit, such as 22 pages for each 1 minute. The word per means for each one. To find it, split both amounts into equal groups until the unit named after per is 1.",
    terms: ["rate", "unit-rate"],
    method: [
      "Find the unit the question puts at 1. It is the one named after the word per.",
      "Divide the other amount by the amount of that unit. For pages per minute, divide pages by minutes.",
      "Write the answer with both units, such as 22 pages per minute.",
    ],
    watch:
      "Divide in the order the question asks. Minutes per mile means minutes ÷ miles.",
  },
  "better-buy": {
    goal: "Decide which of two packages costs less for each item.",
    intuition:
      "A bigger package can cost more in all and still be cheaper for each item. The unit price is the cost of exactly 1 item: the total price divided by the number of items. The package with the lower unit price is the better buy.",
    terms: ["unit-price"],
    method: [
      "Find each unit price. Divide each total price by its number of items.",
      "Compare the two unit prices.",
      "The lower unit price is the better buy. If the unit prices are equal, both are equally good.",
    ],
    watch:
      "Compare unit prices, not total prices. The cheaper box may just hold less.",
  },
  "ratio-table-missing": {
    senses: { part: "part" },
    noLink: ["changes", "factor"],
    goal: "Find the missing number in a table of equivalent ratios.",
    intuition:
      "A ratio compares two amounts, such as 2 cups of flour for every 3 cups of sugar. Equivalent ratios keep that comparison at a bigger or smaller size. Each column of the table is the simplest ratio times its own multiplier. The simplest ratio uses the smallest whole numbers (the numbers 0, 1, 2, 3 and so on) that keep the same comparison.",
    terms: ["equivalent-ratios", "simplest-ratio"],
    method: [
      "Find the simplest ratio. Divide both numbers in a full column by the largest number that divides both evenly.",
      "In the column with the question mark, find the multiplier: known number ÷ its part of the simplest ratio.",
      "Multiply the other part of the simplest ratio by that multiplier.",
    ],
    watch:
      "Multiply both rows by the same number. Adding the same number usually changes the ratio.",
  },
  "double-number-line-missing": {
    senses: { unit: "unit" },
    noLink: ["change", "changes", "scale"],
    goal: "Find a missing value on a double number line.",
    intuition:
      "A double number line is two number lines, one above the other, for two amounts that grow together. Marks that line up go together. The unit rate is the amount that goes with exactly 1 unit of the other amount.",
    terms: ["double-number-line"],
    method: [
      "Read a complete pair: a mark and the mark directly across from it.",
      "Divide both values by the bottom value (use a pair other than 0 and 0). That gives the top amount for 1 bottom unit, the unit rate.",
      "To find a missing top value, multiply the unit rate by the bottom value. To find a missing bottom value, divide the top value by the unit rate.",
    ],
    watch:
      "Change both lines by the same multiplier, the number you multiply by. Adding the same amount to both usually changes how the amounts compare.",
  },
  "fraction-unit-rate": {
    senses: { part: "part", unit: "unit", units: "unit" },
    goal: "Find a unit rate when the amounts are fractions.",
    intuition:
      "A unit rate is the amount that goes with exactly 1 unit. Divide the amount by the number of units, even when both are fractions. To divide by a fraction (not 0), multiply by its reciprocal: the fraction with its top and bottom numbers swapped.",
    terms: ["unit-rate", "reciprocal"],
    method: [
      "Divide the amount by the number of units.",
      "Multiply by the reciprocal of the number you divide by, then simplify.",
      "Check: the unit rate times the given number of units equals the given amount.",
    ],
    watch: "Flip only the number you divide by, not the first fraction.",
  },
  "story-operation-choice": {
    goal: "Choose the equation that models an equal-groups story.",
    terms: ["equal-groups"],
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
    terms: ["equal-groups"],
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
    "A unit rate is the amount for 1 unit. If an amount $a$ goes with $b$ units, and $b$ is not 0, then $a \\div b$ goes with 1 unit.",
  "better-buy":
    "Packages compare fairly only at the same size. The unit price, total price ÷ number of items, puts every package at 1 item.",
  "ratio-table-missing":
    "Multiplying both amounts of a ratio by the same number, not 0, gives an equivalent ratio. So every column is the simplest ratio times its own number.",
  "double-number-line-missing":
    "Matching pairs grow together. Multiplying or dividing both values by the same number, not 0, keeps them lined up. So from any pair other than 0 and 0 you can reach the unit rate, the amount for 1.",
  "fraction-unit-rate":
    "Dividing by a fraction $\\tfrac{c}{d}$, with $c$ and $d$ not 0, is the same as multiplying by its reciprocal $\\tfrac{d}{c}$. The reciprocal $\\tfrac{d}{c}$ is how many copies of $\\tfrac{c}{d}$ make 1.",
  "story-operation-choice":
    "In equal groups, total = number of groups × size of each group; an unknown total is found by multiplying, and an unknown factor by dividing the total by the known factor.",
  "multiplication-division-story":
    "In equal groups, total = number of groups × size of each group; an unknown total is found by multiplying, and an unknown factor by dividing the total by the known factor.",
};
