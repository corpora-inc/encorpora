import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const expandedFormMethods: Record<string, ProblemMethod> = {
  "expanded-sum-to-standard": {
    goal: "Write a number in standard form from a sum of products of digits and place values, with a zero in each place that has no product.",
    intuition:
      "Standard form writes a number with digits. Each digit has a place, and the place decides what the digit is worth. A sum such as $7\\times 1{,}000+4\\times 100$ names the digits and their places one by one. A place with no product holds a 0.",
    terms: ["place-value", "expanded-form"],
    method: [
      "For each product, name the place of its place value and write its digit there.",
      "List the places from the greatest to the least. Where a place has no product, write a 0.",
      "Put the decimal point between the ones place and the tenths place, and read the number.",
    ],
    watch:
      "Do not skip a place that has no product. A missing place is a zero, and leaving it out changes the value of every digit to its right.",
  },
  "standard-to-expanded-choice": {
    goal: "Choose the sum of digit-times-place-value products that equals a number written in digits or in words.",
    intuition:
      "To write a number in expanded form, name the place of each digit and multiply the digit by the value of its place. A digit that is 0 contributes nothing, so its place has no product, but it still holds the later digits in their places.",
    terms: ["standard-form-number", "expanded-form"],
    method: [
      "If the number is in words, write it in standard form first: read the whole part, then the decimal part with its last place name.",
      "Name the place of each digit and the value of that place.",
      "Choose the sum whose products match every nonzero digit and its place, and none else.",
    ],
    watch:
      "A sum can have the right digits in the wrong places. Check each product's place value against the place of its digit.",
  },
};

export const expandedFormPrinciples: Record<string, string> = {
  "expanded-sum-to-standard":
    "A digit $d$ in a place of value $p$ contributes $d\\times p$, and a number is the sum of these contributions. The standard form places each digit in its place and uses 0 where there is no contribution.",
  "standard-to-expanded-choice":
    "Each place is 10 times the place to its right: $\\ldots,1{,}000,100,10,1,0.1,0.01,0.001,\\ldots$. The expanded form of a number is the sum of $d\\times p$ over its nonzero digits.",
};

export const expandedFormLessons = [
  chainLesson({
    id: "expanded-sum-to-standard-lesson",
    title: "From expanded form to standard form",
    summary:
      "Write the digits of a number from a sum of digit-times-place-value products, using 0 for missing places.",
    templateIds: ["expanded-sum-to-standard"],
    objectives: [
      "Say what each product in an expanded form tells about a digit and its place.",
      "Write the standard form, including zeros for places that have no product.",
    ],
    openingTitle: "Each product names a digit and its place",
    opening: [
      "In $6\\times 1{,}000+2\\times 100+5\\times 1$, the product $6\\times 1{,}000$ puts a 6 in the thousands place, $2\\times 100$ puts a 2 in the hundreds place, and $5\\times 1$ puts a 5 in the ones place.",
      "There is no product for the tens place, so it holds a 0. The number is 6,205. After the decimal point the places are tenths, hundredths and thousandths.",
    ],
    example: {
      prompt:
        "Write $3\\times 1{,}000+8\\times 10+4\\times 0.1+9\\times 0.001$ in standard form.",
      steps: [
        "3 in the thousands, 8 in the tens, 4 in the tenths and 9 in the thousandths.",
        "The hundreds, ones and hundredths places have no product, so they hold 0.",
        "Reading the places from thousands to thousandths: 3,080.409.",
      ],
      answer: "3,080.409",
    },
    methodTitle: "List the places, fill the zeros",
    method: [
      "Write the places from the greatest to the least and fill each from its product.",
      "Write a 0 in every place with no product, and put the decimal point after the ones place.",
    ],
    formalTitle: "Place value",
    formal: [
      "A number is the sum over its places of digit times place value. Each place is 10 times the place on its right.",
      "A 0 digit holds a place without adding to the sum.",
    ],
    pitfalls: [
      "Leaving out a place that has no product.",
      "Putting a digit in the next place over, so its value is 10 times too large or too small.",
      "Moving the decimal point. The ones place is just before it.",
    ],
    parentGuide:
      "Ask your learner to draw a place-value chart and put each product's digit in its column.",
  }),
  chainLesson({
    id: "standard-to-expanded-choice-lesson",
    title: "From standard form to expanded form",
    summary:
      "Choose the expanded form of a number written in digits or in words.",
    templateIds: ["standard-to-expanded-choice"],
    objectives: [
      "Name the place of each digit in a number, including digits after the decimal point.",
      "Choose the sum of products that matches every nonzero digit and its place.",
    ],
    openingTitle: "Place by place",
    opening: [
      "In 4,205.36 the 4 is in the thousands place, 2 in the hundreds, 0 in the tens, 5 in the ones, 3 in the tenths and 6 in the hundredths. The expanded form is $4\\times 1{,}000+2\\times 100+5\\times 1+3\\times 0.1+6\\times 0.01$.",
      "A number in words such as four thousand two hundred five and thirty-six hundredths names the same digits: the last word, hundredths, tells that the 6 is in the hundredths place.",
    ],
    example: {
      prompt: "Write 3,070.5 in expanded form.",
      steps: [
        "3 is in the thousands place, 0 in the hundreds, 7 in the tens, 0 in the ones, 5 in the tenths.",
        "Zeros need no product.",
        "$3\\times 1{,}000+7\\times 10+5\\times 0.1$.",
      ],
      answer: "$3\\times 1{,}000+7\\times 10+5\\times 0.1$",
    },
    methodTitle: "Digits, places, products",
    method: [
      "Write the number in digits if it is in words.",
      "Name each digit's place and write digit times place value, skipping zeros.",
    ],
    formalTitle: "Expanded form",
    formal: [
      "If a number has digit $d_i$ in a place of value $p_i$, its expanded form is $\\sum d_i p_i$ over the nonzero digits.",
      "The place values are powers of ten, including $10^{-1}=0.1$, $10^{-2}=0.01$ and $10^{-3}=0.001$.",
    ],
    pitfalls: [
      "Putting a digit in the next place over.",
      "Dropping a 0 so that later digits move up a place.",
      "Reading the decimal part as a whole number: thirty-six hundredths is 0.36, not 36.",
    ],
    parentGuide:
      "Ask your learner to say the place name of each digit aloud before looking at the choices.",
  }),
];

export const expandedFormFacetMappings: FacetMapping[] = [
  {
    templateId: "expanded-sum-to-standard",
    facetId: "decimal-place-value.core",
    extent: "partial",
    rationale:
      "Numeric entry of the standard form of a whole number up to ten thousands, or a decimal with thousands to thousandths, from a sum of digit-times-place-value products with at least one zero place. Does not assess building the sum by dragging place values, fractions as place values, or rounding.",
  },
  {
    templateId: "standard-to-expanded-choice",
    facetId: "decimal-place-value.core",
    extent: "partial",
    rationale:
      "Single choice of the expanded form of a decimal given in digits or words, with thousands and tenths to thousandths, against a digit in the wrong place, swapped digits and a missing zero place. Does not assess multi-select of expressions, drag-and-drop building, or numbers over 9,999.",
  },
];
