import type { MethodTerm } from "../glossary/types";
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
      "Decimals count equal parts of one whole. A tenth is larger than a hundredth because ten hundredths make one tenth.",
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
      {
        stage: "intuition",
        title: "Cut the same whole into smaller pieces",
        paragraphs: [
          "Imagine one square as a whole. Cut it into 10 equal strips: each strip is one tenth. Cut every strip into 10 smaller equal pieces: the whole has 100 hundredths, and one tenth is 10 hundredths.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Decimal parts of one whole",
        paragraphs: [
          "A tenth is one of 10 equal parts of a whole; a hundredth is one of 100 equal parts. Ten hundredths equal one tenth, so a decimal can be renamed using equivalent place-value parts without changing its value.",
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
      "Look at the largest place where two decimals differ, just as you do with whole numbers.",
    templateIds: ["compare-decimals-hundredths"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Line up two decimals by place value.",
      "Explain why a zero on the right does not change a decimal's value.",
      "Choose the greater or lesser of two decimals, including when the shorter one is greater.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare pieces of the same size",
        paragraphs: [
          "A number with more written digits is not always larger: 0.9 is greater than 0.12. Nine tenths cover more of a whole than twelve hundredths. Rename or line up the parts so the same places can be compared.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Compare equal place values",
        paragraphs: [
          "For nonnegative decimals, zeros may be appended after the last fractional digit without changing value. Once decimal points are aligned, compare corresponding places from greatest to least; the first unequal place determines the order. For negative decimals, compare absolute values and reverse the order.",
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
      "Read a decimal by the size of each place: ones, tenths, hundredths, and beyond.",
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
      {
        stage: "intuition",
        title: "The point separates ones from smaller parts",
        paragraphs: [
          "To the left of the decimal point are whole-number places. To the right are tenths, hundredths, and still smaller equal parts. Every step right makes a place ten times smaller, so each digit counts a different-sized piece.",
        ],
      },
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
    closingSections: [
      {
        stage: "formal",
        title: "Powers of ten on both sides",
        paragraphs: [
          "Each place immediately to the left is ten times the value of the place to its right. Each place immediately to the right is one tenth as large. The value of a decimal is the sum of each digit's count of its place unit.",
        ],
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
    id: "inverse-decimal-rounding",
    title: "Which decimal rounds to this value?",
    summary:
      "Many nearby decimals can round to the same value. Find the two halfway boundaries to see which ones do.",
    templateIds: ["inverse-round-decimal"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Choose one positive decimal that rounds to a given tenth or hundredth.",
      "Use the rule that a halfway value rounds up to decide which boundary is included.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A rounded value covers nearby numbers",
        paragraphs: [
          "A value written as 4.68 to the nearest hundredth may have come from a number a little below or above 4.68. The two halfway points around 4.68 mark where rounding changes to the neighboring hundredths. Find those boundaries before checking a choice.",
        ],
      },
      {
        title: "Work backward from the rounded value",
        paragraphs: [
          "Rounding to the nearest hundredth replaces a decimal with the nearer number having two digits after the decimal point. A hundredth is 0.01; the decimals beside 4.68 are 4.67 and 4.69. A tenth is 0.1, so rounding to the nearest tenth keeps one digit after the point. A halfway value is equally far from two neighboring rounded values. Here, halfway values round up.",
          "To find an original decimal that rounds to 4.68, find the halfway points between 4.67 and 4.68, and between 4.68 and 4.69. Check the choices against both points; matching the first two decimal digits alone is insufficient.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Which decimal rounds to 4.68 to the nearest hundredth: 4.674, 4.675, 4.685, or 4.686? Round halfway values up.",
      steps: [
        "The hundredths beside 4.68 are 4.67 and 4.69.",
        "The halfway points are 4.675 and 4.685. The first rounds up to 4.68; the second rounds up to 4.69.",
        "4.674 is below the lower point. 4.685 and 4.686 are at or above the upper point. Only 4.675 lies in the range that rounds to 4.68.",
      ],
      answer: "4.675",
    },
    closingSections: [
      {
        stage: "method",
        title: "See the rounding region",
        keepTogetherInPrint: true,
        paragraphs: [
          "The shaded part of the number line starts at 4.675 with a filled point and stops before 4.685 with an open point. Every decimal in that part rounds to 4.68.",
        ],
        illustration: "inverse-decimal-rounding-line",
      },
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For positive decimals written with a last digit and rounded to the nearest tenth or hundredth, find the two adjacent rounded values and the halfway point on each side of the target. With halfway rounding up, the lower halfway point is included and the upper halfway point is excluded. A choice is correct exactly when it is at least the lower point and less than the upper point.",
        ],
      },
    ],
    pitfalls: [
      "Check both halfway points; a decimal can match the target through the hundredths place and still round up to the next hundredth.",
      "Include the lower halfway point and exclude the upper one when halfway values round up.",
    ],
    parentGuide:
      "Write a rounded hundredth and the two hundredths beside it. Ask your learner to place the halfway points and check each choice.",
  },
  {
    id: "multidigit-decimal-operations",
    title: "Multidigit decimal operations",
    summary:
      "In a decimal such as 12.75, each place after the point is a smaller piece: 7 tenths and 5 hundredths. Every decimal calculation keeps track of those piece sizes. To add, line up the decimal points so tenths meet tenths. To multiply, multiply as whole numbers, then count decimal places to place the point. To divide by a decimal, multiply both numbers by 10, 100 or 1000 until the number you divide by is whole.",
    templateIds: [
      "multidigit-decimal-sum",
      "multidigit-decimal-product",
      "multidigit-decimal-quotient",
    ],
    includeGeneratedRepresentation: false,
    senses: {
      place: "place-value",
      places: "place-value",
      factor: "factor-number",
      product: "product-multiply",
      quotient: "quotient",
    },
    noLink: ["like", "whole", "change", "changes"],
    objectives: [
      "Add and subtract decimals by lining up the decimal points.",
      "Place the decimal point in a product by counting decimal places.",
      "Divide by a decimal by multiplying both numbers by 10, 100 or 1000 so the divisor is a whole number.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Keep track of the size of each piece",
        paragraphs: [
          "Place value means a digit's worth depends on its place. After the decimal point, the first place counts tenths. The next counts hundredths, which are tenths cut into 10 equal parts. Then come thousandths, which are hundredths cut into 10 equal parts. Each piece is one tenth the size of the piece to its left.",
          "You can add tenths to tenths, or hundredths to hundredths, just as you add apples to apples. Multiplying can change the size of the pieces: a tenth of a hundredth is a thousandth. So name the new piece size before writing the decimal point.",
        ],
      },
      {
        title: "Add and subtract: same places",
        paragraphs: [
          "Only matching places add: tenths to tenths, hundredths to hundredths. Lining up the decimal points lines up the places. A zero fills any empty place on the right without changing the value, since 12.5 = 12.50.",
          "Then add or subtract as with whole numbers. Regroup when a place passes 9: 10 hundredths make 1 tenth, and 10 tenths make 1 one.",
        ],
        illustration: "decimal-aligned-sum",
      },
      {
        title: "Multiply and divide: count the scale",
        paragraphs: [
          "The numbers being multiplied are called factors, and the answer is the product. In 1.2 × 0.35, 1.2 is 12 tenths and 0.35 is 35 hundredths. Tenths times hundredths make thousandths: $\\frac{12}{10} \\times \\frac{35}{100} = \\frac{420}{1000}$.",
          "So multiply the digits as whole numbers, 12 × 35 = 420. Then count the decimal places in both factors together: 1 + 2 = 3. Give the product 3 decimal places: 0.420, which is 0.42.",
          "In a division, the divisor is the number you divide by, and the answer is the quotient. Multiplying both numbers by the same power of ten (10, 100, 1000, …) keeps the quotient the same: 0.84 ÷ 0.02 = 84 ÷ 2 = 42. So make the divisor a whole number first, then divide.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Operations preserve place units",
        paragraphs: [
          "To add or subtract decimals, line up the decimal points and combine matching places. To multiply, multiply the whole-number counts of the smallest pieces, then name the product's piece size; its decimal places are the factors' places added. To divide, multiply the dividend (the number being divided) and the divisor by the same power of ten; the quotient stays the same.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is 12.5 + 3.75?",
      steps: [
        "Line up the decimal points so tenths sit under tenths. 12.5 has no hundredths digit, so write a 0 there: 12.50 + 3.75. The value does not change.",
        "Add from the right. Hundredths: 0 + 5 = 5. Tenths: 5 + 7 = 12 tenths, which is 1 one and 2 tenths, so write 2 and carry 1.",
        "Ones: 2 + 3 + 1 carried = 6. Tens: 1. The sum is 16.25.",
        "Check by subtracting, which undoes adding: 16.25 − 3.75 = 12.5.",
      ],
      answer: "16.25",
    },
    pitfalls: [
      "Line up the decimal points, not the last digits.",
      "Multiplying two positive decimals that are each less than 1 gives a product smaller than either factor: 0.5 × 0.4 = 0.2.",
      "When dividing, multiply both numbers by the same power of ten, or the quotient can change.",
    ],
    parentGuide:
      "Add two prices with different numbers of decimal places, such as 12.5 and 3.75, writing one above the other with the points lined up.",
  },
];

const placeTerms: MethodTerm[] = ["tenth", "hundredth"];
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
      ["interval", "Here, the space between two neighboring tick marks."],
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
    terms: [...placeTerms, "thousandth"],
    method: [
      "Name the digit's place: tenths, hundredths or thousandths.",
      "Multiply the digit by that place: 7 × 0.01 = 0.07.",
    ],
    watch: "The value includes the place, not only the digit.",
  },
  "expanded-decimal": {
    goal: "Write a decimal from ones, tenths, hundredths and thousandths.",
    terms: [...placeTerms, "thousandth"],
    method: [
      "List the count for each place: ones, tenths, hundredths, thousandths.",
      "Write 0 for a place with nothing in it.",
      "Write the digits in order after the ones and the point.",
    ],
    watch: "Leaving out a 0 moves every later digit to the wrong place.",
  },
  "compare-decimals-thousandths": {
    goal: "Choose the greater or lesser of two decimals to thousandths.",
    terms: [...placeTerms, "thousandth"],
    method: compareMethod,
    watch: "More digits does not mean greater: 0.3 > 0.299.",
  },
  "round-decimal": {
    goal: "Round a decimal to the nearest whole number, tenth or hundredth.",
    terms: ["round", "halfway-point"],
    method: [
      "Find the two neighbors with the target number of places.",
      "Find the halfway point between them.",
      "Below halfway, round down; at or above halfway, round up.",
    ],
    watch: "Keep only the target places: to the nearest tenth, 2.37 is 2.4.",
  },
  "inverse-round-decimal": {
    goal: "Choose one original decimal that rounds to a given tenth or hundredth.",
    terms: ["halfway-point", "round"],
    method: [
      "Find the rounded values immediately below and above the target.",
      "Find the halfway point on each side of the target.",
      "Choose the original decimal at or above the lower halfway point and below the upper halfway point.",
    ],
    watch:
      "Include the lower halfway point, but exclude the upper halfway point: halfway rounds up.",
  },
  "multidigit-decimal-sum": {
    noLink: ["changes", "opposite"],
    goal: "Add or subtract decimals that have different numbers of decimal places.",
    terms: ["regroup"],
    senses: {
      difference: "difference-subtract",
      place: "place-value",
      places: "place-value",
    },
    intuition:
      "After the decimal point, the first place counts tenths. The next counts hundredths, which are tenths cut into 10 equal parts, and then thousandths, which are hundredths cut into 10. Only matching places add: tenths to tenths. Lining up the decimal points lines up the places, and a 0 can fill an empty place: 12.5 = 12.50.",
    method: [
      "Line up the decimal points. Fill empty places on the right with 0.",
      "Add or subtract place by place from the right. Regroup when needed: 10 hundredths make 1 tenth.",
      "Check with the opposite operation: subtract to check a sum, add to check a difference.",
    ],
    watch: "Line up the points, not the last digits.",
  },
  "multidigit-decimal-product": {
    goal: "Multiply two decimals and place the decimal point in the answer correctly.",
    terms: ["decimal-places"],
    senses: {
      factor: "factor-number",
      product: "product-multiply",
      places: "place-value",
    },
    intuition:
      "The numbers being multiplied are called factors, and the answer is called the product. Decimal places are the digits after the point: 1.2 has one and 0.35 has two. Hundredths, which are 1 out of 100, are smaller than tenths. Thousandths, which are 1 out of 1000, are smaller still. Tenths times hundredths make thousandths, so 1.2 × 0.35 has 1 + 2 = 3 decimal places: 0.420.",
    method: [
      "Multiply the digits as whole numbers.",
      "Count the decimal places in both factors together.",
      "Give the product that many decimal places.",
    ],
    watch:
      "Count places in the factors first. Drop zeros at the end only after placing the point: 0.420 = 0.42.",
  },
  "multidigit-decimal-quotient": {
    noLink: ["whole", "changes", "leaves"],
    goal: "Divide a decimal by a decimal, by first making the divisor a whole number.",
    terms: ["divisor"],
    senses: { quotient: "quotient" },
    intuition:
      "In 0.84 ÷ 0.02, the divisor 0.02 is the number you divide by, and the answer is the quotient. Multiplying both numbers by the same power of ten (10, 100, 1000, …) keeps the quotient the same. So 0.84 ÷ 0.02 = 84 ÷ 2 = 42.",
    method: [
      "Multiply both numbers by the power of ten that makes the divisor whole.",
      "Divide by the whole-number divisor.",
      "Check: quotient × divisor = dividend.",
    ],
    watch:
      "Multiply both numbers by the same power of ten, or the quotient can change.",
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
  "inverse-round-decimal":
    "With halfway values rounding up, a decimal rounds to the target exactly when it is at least the lower halfway point and less than the upper halfway point.",
  "multidigit-decimal-sum":
    "Only like places combine, so lining up the decimal points lines up tenths with tenths and hundredths with hundredths.",
  "multidigit-decimal-product":
    "Tenths times hundredths are thousandths, so the product's decimal places are the factors' decimal places added together.",
  "multidigit-decimal-quotient":
    "Multiplying the dividend and divisor by the same number, other than 0, leaves the quotient unchanged.",
};
