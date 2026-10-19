import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const places: Lesson["sections"][number] = {
  title: "Each place is one tenth of the place to its left",
  paragraphs: [
    "Cut one whole into 10 equal parts and each part is one tenth, written 0.1. Cut one tenth into 10 equal parts and each is one hundredth, 0.01. Cut again and each is one thousandth, 0.001.",
    "So the places after the decimal point count tenths, hundredths and thousandths, in that order. In 2.47 the 2 counts ones, the 4 counts tenths and the 7 counts hundredths.",
  ],
};

export const decimalLessons: Lesson[] = [
  {
    id: "tenths-and-hundredths",
    title: "Tenths and hundredths",
    summary:
      "A decimal names tenths and hundredths of one whole: 0.47 is 4 tenths and 7 hundredths, or 47 hundredths.",
    templateIds: [
      "decimal-grid-read",
      "tenths-as-hundredths",
      "decimal-line-point",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name shaded tenths and hundredths of one whole as a fraction and as a decimal.",
      "Rename tenths as hundredths and add tenths to hundredths.",
      "Read a decimal on a number line cut into tenths or hundredths.",
    ],
    sections: [
      places,
      {
        title: "Columns are tenths, squares are hundredths",
        paragraphs: [
          "A square cut into 100 equal small squares shows both places at once. Each small square is one hundredth. Each column of 10 small squares is one tenth.",
          "Shade 4 full columns and 7 more squares: 4 tenths and 7 hundredths, or 47 hundredths in all. Both say the same amount, and both are written 0.47.",
        ],
        illustration: "decimal-tenths-hundredths",
      },
      {
        title: "One tenth is ten hundredths",
        paragraphs: [
          "Because each tenth is 10 hundredths, 3/10 = 30/100. To add 3/10 + 5/100, rename the tenths first: 30/100 + 5/100 = 35/100 = 0.35.",
          "On a number line, count equal intervals. If 10 intervals make one whole, each is 0.1; if 10 intervals make one tenth, each is 0.01.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 6/10 + 4/100 written as a decimal?",
      steps: [
        "One tenth is 10 hundredths, so 6/10 = 60/100.",
        "60/100 + 4/100 = 64/100.",
        "64 hundredths is 6 tenths and 4 hundredths: 0.64.",
      ],
      answer: "0.64",
    },
    pitfalls: [
      "0.4 is 4 tenths, not 4 hundredths; 4 hundredths is 0.04.",
      "Count intervals between tick marks, not the tick marks themselves.",
    ],
    parentGuide:
      "Draw a 10 by 10 square and shade a few columns and squares. Ask for the amount in hundredths, then in tenths and hundredths, then as a decimal.",
  },
  {
    id: "compare-decimals",
    title: "Compare decimals",
    summary:
      "Line up the decimal points and compare place by place from the left; the number of digits does not decide.",
    templateIds: ["compare-decimals-hundredths"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Line up two decimals by place value.",
      "Explain why a zero on the right does not change a decimal's value.",
      "Choose the greater or lesser of two decimals, including when the shorter one is greater.",
    ],
    sections: [
      places,
      {
        title: "Line up the points, then compare from the left",
        paragraphs: [
          "Write both decimals in a place-value chart with the decimal points lined up. Fill an empty place on the right with 0: 0.5 = 0.50, because 5 tenths is 50 hundredths.",
          "Then compare from the left. The first place where the digits differ decides, because one unit of that place is worth more than everything to its right. In 0.50 and 0.45, the tenths differ: 5 > 4, so 0.5 > 0.45.",
        ],
        illustration: "decimal-compare-chart",
      },
      {
        title: "More digits is not more",
        paragraphs: [
          "0.45 has more digits than 0.5 but is less. The digits after the point are not a whole number to compare; each counts a smaller piece than the one before.",
          "With different whole numbers, the ones decide first: 1.2 > 0.95, because one whole is more than any amount of tenths and hundredths below one.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which is greater: 0.7 or 0.68?",
      steps: [
        "Line up the points and fill the empty place: 0.7 = 0.70.",
        "The ones match. In the tenths, 7 > 6.",
        "So 0.7 > 0.68, and the greater decimal is 0.7.",
      ],
      answer: "0.7",
    },
    pitfalls: [
      "A decimal with more digits is not always greater: 0.5 > 0.45.",
      "Compare digits in the same place, never the first digit of one with the last digit of the other.",
    ],
    parentGuide:
      "Write 0.5 and 0.45 as money: 50 cents and 45 cents. Ask which is more, then why 0.5 and 0.50 are the same amount.",
  },
  {
    id: "decimal-place-value",
    title: "Decimals to thousandths",
    summary:
      "Each digit's value is the digit times its place; that one idea reads, writes, compares and rounds decimals.",
    templateIds: [
      "decimal-digit-value",
      "expanded-decimal",
      "compare-decimals-thousandths",
      "round-decimal",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name the value of a digit in the tenths, hundredths or thousandths place.",
      "Write a decimal from expanded form, with a 0 in any empty place.",
      "Compare decimals to thousandths and round to the nearest whole, tenth or hundredth.",
    ],
    sections: [
      places,
      {
        title: "Value and expanded form",
        paragraphs: [
          "A digit's value is the digit times its place. In 3.608 the 6 is 6 × 1/10 = 0.6 and the 8 is 8 × 1/1000 = 0.008.",
          "Expanded form adds those values: 3.608 = 3 × 1 + 6 × 1/10 + 8 × 1/1000. There are no hundredths, so the hundredths place holds 0. Without it, 3.68 would be a different number.",
        ],
      },
      {
        title: "Round to the nearer neighbor",
        paragraphs: [
          "To round 2.37 to the nearest tenth, find the tenths on either side: 2.3 and 2.4. Halfway between them is 2.35.",
          "2.37 is past halfway, so it is nearer 2.4. A number exactly halfway rounds up by convention.",
        ],
        illustration: "decimal-rounding-line",
      },
    ],
    workedExample: {
      prompt: "Round 4.862 to the nearest hundredth.",
      steps: [
        "The hundredths on either side are 4.86 and 4.87.",
        "Halfway between them is 4.865, and 4.862 is below it.",
        "So 4.862 is nearer 4.86.",
      ],
      answer: "4.86",
    },
    pitfalls: [
      "An empty place still needs its 0: 3 + 6/10 + 8/1000 is 3.608, not 3.68.",
      "Rounding to the nearest tenth keeps one decimal place: 2.37 rounds to 2.4, not 2.40 or 2.",
    ],
    parentGuide:
      "Read a price such as 3.608 aloud by places: 3 ones, 6 tenths, 0 hundredths, 8 thousandths. Ask what changes if the 0 is dropped.",
  },
  {
    id: "multidigit-decimal-operations",
    title: "Multidigit decimal operations",
    summary:
      "Decimal arithmetic is whole-number arithmetic in units of tenths, hundredths or thousandths.",
    templateIds: [
      "multidigit-decimal-sum",
      "multidigit-decimal-product",
      "multidigit-decimal-quotient",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Add and subtract decimals by lining up the decimal points.",
      "Place the decimal point in a product by counting decimal places.",
      "Divide by a decimal by scaling both numbers to make the divisor whole.",
    ],
    sections: [
      {
        title: "Add and subtract: same places",
        paragraphs: [
          "Only like places add: tenths to tenths, hundredths to hundredths. Lining up the decimal points lines up the places, and zeros fill any empty place on the right.",
          "Then add or subtract as with whole numbers, regrouping 10 hundredths as 1 tenth and 10 tenths as 1 one.",
        ],
        illustration: "decimal-aligned-sum",
      },
      {
        title: "Multiply and divide: count the scale",
        paragraphs: [
          "1.2 × 0.35 is 12/10 × 35/100 = 420/1000. So multiply 12 × 35 = 420, then put in as many decimal places as the factors have together, 1 + 2 = 3: 0.420 = 0.42.",
          "Multiplying both numbers in a division by the same power of ten keeps the quotient: 0.84 ÷ 0.02 = 84 ÷ 2 = 42. Make the divisor whole, then divide.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 12.5 + 3.75?",
      steps: [
        "Line up the decimal points and fill the empty place: 12.50 + 3.75.",
        "Add hundredths, tenths, ones and tens: 12.50 + 3.75 = 16.25.",
        "Check: 16.25 − 3.75 = 12.5.",
      ],
      answer: "16.25",
    },
    pitfalls: [
      "Line up the decimal points, not the last digits.",
      "A product of decimals less than 1 is smaller than either factor: 0.5 × 0.4 = 0.2.",
    ],
    parentGuide:
      "Add two prices with different numbers of decimal places, such as 12.5 and 3.75, writing one above the other with the points lined up.",
  },
];

const placeTerms: [string, string][] = [
  ["Tenth", "One of 10 equal parts of one whole: 0.1."],
  ["Hundredth", "One of 100 equal parts of one whole: 0.01."],
];
const compareMethod = [
  "Line up the decimal points; fill empty places on the right with 0.",
  "Compare digits from the left; the first place that differs decides.",
  "Answer with the decimal the question asks for.",
];
export const decimalMethods: Record<string, ProblemMethod> = {
  "decimal-grid-read": {
    goal: "Name the shaded part of a tenths strip or hundredths grid as a decimal.",
    terms: placeTerms,
    method: [
      "Count full columns or strips: each is one tenth.",
      "Count single squares left over: each is one hundredth.",
      "Write tenths in the first place after the point, hundredths in the second.",
    ],
    watch: "4 shaded hundredths is 0.04, not 0.4.",
  },
  "tenths-as-hundredths": {
    goal: "Rename tenths as hundredths and add tenths to hundredths.",
    terms: placeTerms,
    method: [
      "Rename each tenth as 10 hundredths: 3/10 = 30/100.",
      "Add hundredths to hundredths.",
      "As a decimal, tenths take the first place and hundredths the second.",
    ],
    watch: "3/10 + 5/100 is 35/100, not 8/100.",
  },
  "decimal-line-point": {
    goal: "Read a point on a number line cut into tenths or hundredths.",
    terms: [
      ["Interval", "The space between two neighboring tick marks."],
      ...placeTerms,
    ],
    method: [
      "Find the distance between the two labeled numbers.",
      "Divide it by the number of intervals to get one interval.",
      "Count intervals from the left label to the point.",
    ],
    watch: "Count spaces between ticks, not the ticks.",
  },
  "compare-decimals-hundredths": {
    goal: "Choose the greater or lesser of two decimals to hundredths.",
    terms: placeTerms,
    method: compareMethod,
    watch: "More digits does not mean greater: 0.5 > 0.45.",
  },
  "decimal-digit-value": {
    goal: "Name the value of one digit of a decimal.",
    terms: [
      ...placeTerms,
      ["Thousandth", "One of 1000 equal parts of one whole: 0.001."],
    ],
    method: [
      "Name the digit's place: tenths, hundredths or thousandths.",
      "Multiply the digit by that place: 7 × 0.01 = 0.07.",
    ],
    watch: "The value includes the place, not only the digit.",
  },
  "expanded-decimal": {
    goal: "Write a decimal from ones, tenths, hundredths and thousandths.",
    terms: [
      ...placeTerms,
      ["Thousandth", "One of 1000 equal parts of one whole: 0.001."],
    ],
    method: [
      "List the count for each place: ones, tenths, hundredths, thousandths.",
      "Write 0 for a place with nothing in it.",
      "Write the digits in order after the ones and the point.",
    ],
    watch: "Leaving out a 0 moves every later digit to the wrong place.",
  },
  "compare-decimals-thousandths": {
    goal: "Choose the greater or lesser of two decimals to thousandths.",
    terms: [
      ...placeTerms,
      ["Thousandth", "One of 1000 equal parts of one whole: 0.001."],
    ],
    method: compareMethod,
    watch: "More digits does not mean greater: 0.3 > 0.299.",
  },
  "round-decimal": {
    goal: "Round a decimal to the nearest whole number, tenth or hundredth.",
    terms: [
      ["Round", "Replace a number with the nearer of two neighbors."],
      ["Halfway point", "The number exactly between the two neighbors."],
    ],
    method: [
      "Find the two neighbors with the target number of places.",
      "Find the halfway point between them.",
      "Below halfway, round down; at or above halfway, round up.",
    ],
    watch: "Keep only the target places: to the nearest tenth, 2.37 is 2.4.",
  },
  "multidigit-decimal-sum": {
    goal: "Add or subtract decimals with different numbers of places.",
    terms: [["Regroup", "Trade 10 of one place for 1 of the next place left."]],
    method: [
      "Line up the decimal points; fill empty places with 0.",
      "Add or subtract place by place from the right, regrouping as needed.",
      "Check with the inverse operation.",
    ],
    watch: "Line up the points, not the last digits.",
  },
  "multidigit-decimal-product": {
    goal: "Multiply two decimals.",
    terms: [["Decimal places", "Digits after the decimal point."]],
    method: [
      "Multiply the digits as whole numbers.",
      "Count the decimal places in both factors together.",
      "Give the product that many decimal places.",
    ],
    watch:
      "Count places in the factors, then drop final zeros only after placing the point.",
  },
  "multidigit-decimal-quotient": {
    goal: "Divide a decimal by a decimal.",
    terms: [["Divisor", "The number being divided by."]],
    method: [
      "Multiply both numbers by the power of ten that makes the divisor whole.",
      "Divide by the whole-number divisor.",
      "Check: quotient × divisor = dividend.",
    ],
    watch:
      "Scale both numbers by the same power of ten, or the quotient changes.",
  },
};
export const decimalPrinciples: Record<string, string> = {
  "decimal-grid-read":
    "One tenth is 10 hundredths, so a decimal can be read as tenths and hundredths or as hundredths alone.",
  "tenths-as-hundredths":
    "Cutting each tenth into 10 equal parts renames tenths as hundredths without changing the amount.",
  "decimal-line-point":
    "Equal intervals between two labeled points each have the same size: the distance divided by the number of intervals.",
  "compare-decimals-hundredths":
    "One unit of a place is worth more than everything to its right, so the first differing place decides.",
  "decimal-digit-value":
    "A digit's value is the digit times its place, and each place is one tenth of the place to its left.",
  "expanded-decimal":
    "A decimal is the sum of its digits' values; a 0 holds an empty place so later digits keep their places.",
  "compare-decimals-thousandths":
    "Zeros on the right change nothing, so line up the places and let the first differing place decide.",
  "round-decimal":
    "Rounding chooses the nearer of the two neighbors with the target number of places.",
  "multidigit-decimal-sum":
    "Only like places combine, so lining up the decimal points lines up tenths with tenths and hundredths with hundredths.",
  "multidigit-decimal-product":
    "Tenths times hundredths are thousandths: the product's decimal places are the factors' places together.",
  "multidigit-decimal-quotient":
    "Multiplying the dividend and divisor by the same number leaves the quotient unchanged.",
};
