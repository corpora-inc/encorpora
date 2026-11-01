import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const places: Lesson["sections"][number] = {
  title: "Each place is one tenth of the place to its left",
  paragraphs: [
    "Cut one whole into 10 equal parts, and each part is a tenth, written 0.1. Cut one tenth into 10 equal parts, and each part is a hundredth, written 0.01. Cut one hundredth into 10 equal parts, and each part is a thousandth, written 0.001.",
    "The decimal point is the dot in a decimal. The places after it count tenths, hundredths and thousandths, in that order. In 2.47, the 2 counts ones, the 4 counts tenths and the 7 counts hundredths.",
  ],
};
const decimalSenses = {
  whole: "whole",
  part: "part",
  square: "square-shape",
  rename: "rename",
  interval: "interval",
  "more than": "more-than",
};
const decimalNoLink = ["change", "changes", "mean", "means", "rule"];

export const decimalLessons: Lesson[] = [
  {
    id: "tenths-and-hundredths",
    title: "Tenths and hundredths",
    summary:
      "A decimal is a number written with a decimal point, such as 0.4. The digits after the point count small equal parts of one whole. A tenth is one of 10 equal parts, written 0.1. A hundredth is one of 100 equal parts, written 0.01. Ten hundredths make one tenth.",
    templateIds: [
      "decimal-grid-read",
      "tenths-as-hundredths",
      "decimal-line-point",
    ],
    senses: decimalSenses,
    noLink: decimalNoLink,
    includeGeneratedRepresentation: false,
    objectives: [
      "Name shaded tenths and hundredths of one whole as a fraction and as a decimal.",
      "Rename tenths as hundredths, and add tenths to hundredths.",
      "Read a decimal on a number line cut into tenths or hundredths.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Cut the same whole into smaller pieces",
        paragraphs: [
          "Look at one square. It is one whole. Cut it into 10 equal strips. Each strip is one tenth of the square.",
          "Now cut every strip into 10 smaller equal pieces. The whole square now has 100 pieces, and each piece is one hundredth. One strip holds 10 of those pieces. So one tenth is the same amount as 10 hundredths.",
          "Writing an amount another way, without changing how much it is, is called renaming. You can rename 1 tenth as 10 hundredths.",
        ],
      },
      places,
      {
        title: "Columns are tenths, small squares are hundredths",
        paragraphs: [
          "Look at the picture. The big square is one whole, cut into 100 equal small squares. Each small square is one hundredth. Each column, a stack of 10 small squares from top to bottom, is one tenth.",
          "4 full columns are shaded, or colored in. That is 4 tenths. 7 more small squares are shaded. That is 7 hundredths. Together they make 4 tenths and 7 hundredths, or 47 hundredths in all. Both name the same amount, and both are written 0.47.",
        ],
        illustration: "decimal-tenths-hundredths",
      },
      {
        title: "One tenth is ten hundredths",
        paragraphs: [
          "Each tenth is 10 hundredths. So 3 tenths are 30 hundredths: 3/10 = 30/100.",
          "To add 3/10 + 5/100, first rename the tenths as hundredths. Then add hundredths to hundredths: 30/100 + 5/100 = 35/100 = 0.35.",
          "On a number line, the tick marks cut the line into equal spaces. Each space between two marks next to each other is called an interval. Count the intervals, not the marks. If 10 intervals make one whole, each interval is 0.1. If 10 intervals make one tenth, each interval is 0.01.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Decimal parts of one whole",
        paragraphs: [
          "A tenth is one of 10 equal parts of a whole. A hundredth is one of 100 equal parts. Ten hundredths equal one tenth. So tenths can be renamed as hundredths without changing the amount: 0.6 = 0.60.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 6/10 + 4/100 written as a decimal?",
      steps: [
        "One tenth is 10 hundredths, so 6 tenths are 60 hundredths: 6/10 = 60/100. Now both parts are hundredths.",
        "Add the hundredths: 60/100 + 4/100 = 64/100.",
        "64 hundredths is 6 tenths and 4 hundredths. Write 6 in the tenths place and 4 in the hundredths place: 0.64.",
      ],
      answer: "0.64",
    },
    pitfalls: [
      "0.4 is 4 tenths, not 4 hundredths. 4 hundredths is written 0.04.",
      "On a number line, count the spaces between tick marks, not the tick marks themselves.",
    ],
    parentGuide:
      "Draw a square 10 small squares wide and 10 small squares tall. Shade a few columns and a few single squares. Ask your child for the amount in hundredths, then in tenths and hundredths, then as a decimal.",
  },
  {
    id: "compare-decimals",
    title: "Compare decimals",
    summary:
      "A decimal is a number written with a decimal point, such as 0.45. To compare two decimals, line up their decimal points. Then compare the digits in each place, starting from the left. The first place where the digits are different tells which decimal is greater.",
    templateIds: ["compare-decimals-hundredths"],
    senses: decimalSenses,
    noLink: decimalNoLink,
    includeGeneratedRepresentation: false,
    objectives: [
      "Line up two decimals by place value.",
      "Explain why a zero at the right end does not change a decimal's value.",
      "Choose the greater or lesser of two decimals, even when the shorter one is greater.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare parts of the same size",
        paragraphs: [
          "A number with more digits is not always greater. Compare 0.9 and 0.12. A tenth is one of 10 equal parts of a whole, so 0.9 is 9 of those parts. A hundredth is one of 100 equal parts, so 0.12 is 12 of those much smaller parts.",
          "Nine tenths cover more of the whole than twelve hundredths. We write 0.9 > 0.12, where the sign > means is greater than. The sign < means is less than.",
          "To compare fairly, compare digits that count the same size of part. Lining up the decimal points does that.",
        ],
      },
      places,
      {
        title: "Line up the points, then compare from the left",
        paragraphs: [
          "Look at the picture. It is a place-value chart: a table with one column for each place, ones, tenths and hundredths. Both decimals are written with their decimal points lined up.",
          "0.5 has nothing in the hundredths place, so fill it with 0: 0.5 = 0.50. That is fine, because 5 tenths is the same amount as 50 hundredths.",
          "Then compare from the left. The first place where the digits are different decides. One of that place is worth more than all the smaller places to its right put together. In 0.50 and 0.45, the tenths are different: 5 > 4. So 0.5 > 0.45.",
        ],
        illustration: "decimal-compare-chart",
      },
      {
        title: "More digits is not more",
        paragraphs: [
          "0.45 has more digits than 0.5, but it is less. The digits after the point are not one big number to compare. Each digit counts a smaller part than the digit before it.",
          "The whole-number part is the part left of the decimal point. When the whole-number parts are different, they decide first. 1.2 > 0.95, because 1 whole is more than any number of tenths and hundredths that adds up to less than 1.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Compare equal place values",
        paragraphs: [
          "For decimals that are 0 or greater, zeros written at the right end, after the decimal point, do not change the value. Line up the decimal points. Then compare the digits in each place, from the biggest place to the smallest. The first place where the digits differ decides which decimal is greater.",
        ],
      },
    ],
    workedExample: {
      prompt: "Which is greater: 0.7 or 0.68?",
      steps: [
        "Line up the decimal points. 0.7 has no hundredths digit, so fill that place with 0: 0.7 = 0.70. Now both decimals have the same places.",
        "Compare from the left. The ones digits are both 0. In the tenths place, 7 > 6, so the tenths decide.",
        "So 0.7 > 0.68. The greater decimal is 0.7.",
      ],
      answer: "0.7",
    },
    pitfalls: [
      "A decimal with more digits is not always greater: 0.5 > 0.45.",
      "Compare digits in the same place. Never compare the first digit of one decimal with the last digit of the other.",
    ],
    parentGuide:
      "Write 0.5 and 0.45 as money: 50 cents and 45 cents. Ask your child which is more. Then ask why 0.5 and 0.50 are the same amount.",
  },
  {
    id: "decimal-place-value",
    title: "Decimals to thousandths",
    summary:
      "A decimal is a number written with a decimal point, such as 3.608. Each digit sits in a place, and the place tells what the digit is worth. A tenth is one of 10 equal parts of a whole. A hundredth is one of 100 equal parts. A thousandth is one of 1,000 equal parts.",
    templateIds: [
      "decimal-digit-value",
      "expanded-decimal",
      "compare-decimals-thousandths",
      "round-decimal",
    ],
    senses: decimalSenses,
    noLink: decimalNoLink,
    includeGeneratedRepresentation: false,
    objectives: [
      "Name the value of a digit in the tenths, hundredths or thousandths place.",
      "Write a decimal from expanded form, with a 0 in any empty place.",
      "Compare decimals to thousandths, and round to the nearest whole number, tenth or hundredth.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The point separates ones from smaller parts",
        paragraphs: [
          "The decimal point is the dot in a decimal. To its left are the places for whole numbers, the numbers 0, 1, 2, 3 and so on: ones, tens, hundreds. To its right are tenths, hundredths and thousandths.",
          "Each step to the right makes the place 10 times smaller. So each digit counts a different size of part.",
          "Rounding means replacing a number with the nearer of two simpler numbers. For example, 2.37 rounded to one digit after the point is 2.4. The halfway point is the number exactly in the middle of the two choices.",
        ],
      },
      places,
      {
        title: "Value and expanded form",
        paragraphs: [
          "A digit's value is what it is worth: the digit times its place. In 3.608, the 6 is in the tenths place, so it is worth 6 × 1/10 = 0.6. The 8 is in the thousandths place, so it is worth 8 × 1/1000 = 0.008.",
          "Expanded form writes a number as the sum of what its digits are worth: 3.608 = 3 × 1 + 6 × 1/10 + 8 × 1/1000. There are no hundredths, so the hundredths place holds a 0. Without that 0, you would write 3.68, which is a different number.",
        ],
      },
      {
        title: "Round to the nearer neighbor",
        paragraphs: [
          "To round 2.37 to the nearest tenth, find the tenths just below and just above it: 2.3 and 2.4. The halfway point between them is 2.35.",
          "Look at the picture. 2.37 is past the halfway point, so it is nearer 2.4. So 2.37 rounds to 2.4.",
          "A number exactly at the halfway point is just as near to both. In this lesson it rounds up, which is the usual rule.",
        ],
        illustration: "decimal-rounding-line",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Each place is ten times the next",
        paragraphs: [
          "Each place is 10 times the value of the place just to its right. Each place is one tenth of the value of the place just to its left. A decimal's value is the sum of what all its digits are worth.",
        ],
      },
    ],
    workedExample: {
      prompt: "Round 4.862 to the nearest hundredth.",
      steps: [
        "Find the hundredths just below and just above 4.862. They are 4.86 and 4.87, the numbers with two digits after the point just below and just above it.",
        "Find the halfway point between them: 4.865. 4.862 is less than 4.865, so it has not reached halfway.",
        "So 4.862 is nearer 4.86, and it rounds down to 4.86.",
      ],
      answer: "4.86",
    },
    pitfalls: [
      "An empty place between other digits still needs its 0. 3 + 6/10 + 8/1000 is 3.608, not 3.68.",
      "Rounding to the nearest tenth keeps one digit after the point. 2.37 rounds to 2.4. Rounding it to 2 would be rounding to the nearest whole number instead.",
    ],
    parentGuide:
      "Read a number such as 3.608 aloud by places: 3 ones, 6 tenths, 0 hundredths, 8 thousandths. Ask your child what changes if the 0 is left out.",
  },
  {
    id: "inverse-decimal-rounding",
    title: "Which decimal rounds to this value?",
    summary:
      "A decimal is a number written with a decimal point, such as 4.68. Rounding means replacing a number with the nearer of two simpler numbers. Many decimals round to the same answer: 4.676 and 4.684 both round to 4.68 at the nearest hundredth. A halfway point is the number exactly between two rounded values. The halfway points on each side of 4.68 show which decimals round to it.",
    templateIds: ["inverse-round-decimal"],
    senses: decimalSenses,
    noLink: [...decimalNoLink, "side"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Choose one decimal greater than 0 that rounds to a given tenth or hundredth.",
      "Use the rule that a halfway value rounds up to decide which halfway point is included.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A rounded value covers nearby numbers",
        paragraphs: [
          "A hundredth is one of 100 equal parts of a whole, written 0.01. A tenth is one of 10 equal parts, written 0.1.",
          "Suppose a number was rounded to the nearest hundredth, and the answer was 4.68. The number may have been a little below 4.68, or a little above it. The hundredths next to 4.68 are 4.67 and 4.69.",
          "The halfway point between 4.67 and 4.68 is 4.675. The halfway point between 4.68 and 4.69 is 4.685. These two points mark where rounding switches to a different hundredth.",
        ],
      },
      {
        title: "Work backward from the rounded value",
        paragraphs: [
          "Rounding to the nearest hundredth keeps two digits after the decimal point. Rounding to the nearest tenth keeps one digit after the point. A number exactly at a halfway point is just as near to both rounded values. The usual rule is that it rounds up.",
          "So 4.675 rounds up to 4.68, and it counts. But 4.685 rounds up to 4.69, so it does not count. The words at least mean equal to or greater than. A decimal rounds to 4.68 when it is at least 4.675 and less than 4.685.",
          "Check every choice against both halfway points. Matching the first two digits after the point is not enough: 4.686 starts like 4.68 but rounds to 4.69.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Which decimal rounds to 4.68 to the nearest hundredth: 4.674, 4.675, 4.685, or 4.686? Round halfway values up.",
      steps: [
        "Find the hundredths next to 4.68. They are 4.67, just below it, and 4.69, just above it.",
        "Find the halfway points. Between 4.67 and 4.68 it is 4.675, which rounds up to 4.68. Between 4.68 and 4.69 it is 4.685, which rounds up to 4.69.",
        "Check each choice. 4.674 is below 4.675, so it rounds to 4.67. 4.685 and 4.686 are at 4.685 or above, so they round to 4.69. Only 4.675 rounds to 4.68.",
      ],
      answer: "4.675",
    },
    closingSections: [
      {
        stage: "method",
        title: "See which decimals round to 4.68",
        keepTogetherInPrint: true,
        paragraphs: [
          "Look at the picture. The shaded part of the number line starts at 4.675. The dot there is a filled dot, one that is colored in. A filled dot means that number is included. The shaded part stops at 4.685. The dot there is an open dot, one that is empty inside. An open dot means that number is left out. Every decimal in the shaded part rounds to 4.68.",
        ],
        illustration: "inverse-decimal-rounding-line",
      },
      {
        stage: "formal",
        title: "The exact rule",
        paragraphs: [
          "Take decimals greater than 0, and a target rounded to the nearest tenth or hundredth. Find the rounded values just below and just above the target. Then find the halfway point on each side of the target. When halfway values round up, the lower halfway point is included and the upper one is left out. A decimal rounds to the target exactly when it is at least the lower halfway point and less than the upper one.",
        ],
      },
    ],
    pitfalls: [
      "Check both halfway points. A decimal can start with the same digits as the target and still round up to the next hundredth, like 4.686.",
      "Include the lower halfway point and leave out the upper one, because halfway values round up.",
    ],
    parentGuide:
      "Write a rounded hundredth, such as 4.68, and the two hundredths beside it. Ask your child to find the halfway points and check each choice against them.",
  },
  {
    id: "multidigit-decimal-operations",
    title: "Multidigit decimal operations",
    summary:
      "Decimal calculations work by keeping track of place-value units, including parts smaller than one.",
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
        stage: "intuition",
        title: "Keep track of the size of each piece",
        paragraphs: [
          "You can combine tenths with tenths or hundredths with hundredths. If an operation changes the size of the pieces, name the new size before writing the decimal point. This is why place value matters in every decimal calculation.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Operations preserve place units",
        paragraphs: [
          "For addition and subtraction, combine like decimal place units after aligning decimal points. For multiplication, multiply the whole-number counts of smallest place units, then name the product's unit. For division, scaling dividend and divisor by the same nonzero power of ten preserves their quotient.",
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

const placeTerms: MethodTerm[] = ["tenth", "hundredth"];
const compareMethod = [
  "Line up the decimal points. Fill any empty place at the right end with 0, which does not change the value.",
  "Compare digits in the same place, starting from the left. The first place where the digits are different decides.",
  "Answer with the decimal the question asks for: the greater or the lesser.",
];
const roundIntuition =
  "A decimal is a number written with a decimal point, such as 2.37. A tenth is one of 10 equal parts of a whole, written 0.1. A hundredth is one of 100 equal parts, written 0.01. Rounding means replacing a number with the nearer of two simpler numbers. The halfway point is the number exactly in the middle of those two.";
export const decimalMethods: Record<string, ProblemMethod> = {
  "decimal-grid-read": {
    goal: "Name the shaded part of a tenths strip or hundredths grid as a decimal.",
    senses: decimalSenses,
    terms: placeTerms,
    method: [
      "Count the full columns or strips. Each one is one tenth.",
      "Count the single small squares left over. Each one is one hundredth.",
      "Write the tenths in the first place after the point, and the hundredths in the second place.",
    ],
    watch: "4 shaded hundredths is 0.04, not 0.4.",
  },
  "tenths-as-hundredths": {
    goal: "Rename tenths as hundredths and add tenths to hundredths.",
    senses: decimalSenses,
    terms: placeTerms,
    method: [
      "Renaming means writing an amount another way without changing it. Rename each tenth as 10 hundredths: 3/10 = 30/100.",
      "Add hundredths to hundredths.",
      "As a decimal, the tenths go in the first place after the point and the hundredths in the second.",
    ],
    watch: "3/10 + 5/100 is 35/100, not 8/100.",
  },
  "decimal-line-point": {
    goal: "Read a point on a number line cut into tenths or hundredths.",
    senses: decimalSenses,
    terms: [
      ["interval", "Here, the space between two neighboring tick marks."],
      ...placeTerms,
    ],
    method: [
      "Find how far apart the two labeled numbers are.",
      "The space between two tick marks next to each other is called an interval. Divide the distance by the number of intervals to find the size of one interval.",
      "Count the intervals from the left label to the point. Multiply that count by the size of one interval, and add the result to the left label.",
    ],
    watch: "Count the spaces between tick marks, not the tick marks.",
  },
  "compare-decimals-hundredths": {
    goal: "Choose the greater or lesser of two decimals to hundredths.",
    senses: decimalSenses,
    noLink: ["mean", "change", "changes"],
    terms: placeTerms,
    method: compareMethod,
    watch: "More digits does not mean greater: 0.5 > 0.45.",
  },
  "decimal-digit-value": {
    goal: "Name the value of one digit of a decimal.",
    senses: decimalSenses,
    noLink: ["third"],
    terms: [...placeTerms, "thousandth"],
    method: [
      "Name the digit's place: tenths, hundredths or thousandths.",
      "Multiply the digit by the value of that place: 7 × 0.01 = 0.07.",
    ],
    watch: "The value uses the place, not only the digit.",
  },
  "expanded-decimal": {
    goal: "Write a decimal from ones, tenths, hundredths and thousandths.",
    senses: decimalSenses,
    terms: [...placeTerms, "thousandth"],
    method: [
      "List the count for each place: ones, tenths, hundredths, thousandths.",
      "Write 0 for a place with nothing in it.",
      "Write the ones, then the decimal point, then the other digits in order.",
    ],
    watch: "Leaving out a 0 moves every later digit into the wrong place.",
  },
  "compare-decimals-thousandths": {
    goal: "Choose the greater or lesser of two decimals to thousandths.",
    senses: decimalSenses,
    noLink: ["mean"],
    terms: [...placeTerms, "thousandth"],
    method: compareMethod,
    watch: "More digits does not mean greater: 0.3 > 0.299.",
  },
  "round-decimal": {
    goal: "Round a decimal to the nearest whole number, tenth or hundredth.",
    senses: decimalSenses,
    intuition: roundIntuition,
    terms: ["round", "halfway-point"],
    method: [
      "Find the two nearby numbers with the number of places the question asks for, one below and one above. If the number already equals one of them, like 5.20 = 5.2 for tenths, it rounds to itself.",
      "Find the halfway point between them.",
      "Below halfway, round down to the lower one. At halfway or above, round up to the upper one.",
    ],
    watch: "Keep only the places asked for. To the nearest tenth, 2.37 is 2.4.",
  },
  "inverse-round-decimal": {
    goal: "Choose one original decimal that rounds to a given tenth or hundredth.",
    senses: decimalSenses,
    noLink: ["side"],
    terms: ["halfway-point", "round"],
    method: [
      "Find the rounded values just below and just above the target.",
      "Find the halfway point on each side of the target.",
      "At least means equal to or greater. Choose the decimal that is at least the lower halfway point and less than the upper halfway point.",
    ],
    watch:
      "Include the lower halfway point, but leave out the upper one, because halfway rounds up.",
  },
  "multidigit-decimal-sum": {
    goal: "Add or subtract decimals with different numbers of places.",
    terms: ["regroup"],
    method: [
      "Line up the decimal points; fill empty places with 0.",
      "Add or subtract place by place from the right, regrouping as needed.",
      "Check with the inverse operation.",
    ],
    watch: "Line up the points, not the last digits.",
  },
  "multidigit-decimal-product": {
    goal: "Multiply two decimals.",
    terms: ["decimal-places"],
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
    terms: ["divisor"],
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
    "One tenth is 10 hundredths. So a decimal with digits only in the tenths and hundredths places can be read as tenths and hundredths, or as hundredths alone.",
  "tenths-as-hundredths":
    "Cutting each tenth into 10 equal parts renames tenths as hundredths without changing the amount.",
  "decimal-line-point":
    "Equal intervals between two labeled points are all the same size: the distance divided by the number of intervals.",
  "compare-decimals-hundredths":
    "One of a place is worth more than everything to its right. So the first place where the digits differ decides.",
  "decimal-digit-value":
    "A digit's value is the digit times the value of its place. Each place is one tenth of the place to its left.",
  "expanded-decimal":
    "A decimal is the sum of what its digits are worth. A 0 holds an empty place, so later digits keep their places.",
  "compare-decimals-thousandths":
    "Zeros at the right end after the point change nothing. Line up the places, and the first place where the digits differ decides.",
  "round-decimal":
    "Rounding picks the nearer of the two nearby numbers with the places asked for. A number exactly halfway rounds up.",
  "inverse-round-decimal":
    "When halfway values round up, a decimal rounds to the target exactly when it is at least the lower halfway point and less than the upper halfway point.",
  "multidigit-decimal-sum":
    "Only like places combine, so lining up the decimal points lines up tenths with tenths and hundredths with hundredths.",
  "multidigit-decimal-product":
    "Tenths times hundredths are thousandths: the product's decimal places are the factors' places together.",
  "multidigit-decimal-quotient":
    "Multiplying the dividend and divisor by the same number leaves the quotient unchanged.",
};
