import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const expandedSenses = {
  product: "product-multiply",
  "standard form": "standard-form-number",
  whole: "whole",
  part: "part",
};

export const expandedFormMethods: Record<string, ProblemMethod> = {
  "expanded-sum-to-standard": {
    goal: "Write a number in standard form from a sum of products of digits and place values, with a zero in each place that has no product.",
    senses: expandedSenses,
    noLink: ["change", "changes"],
    intuition:
      "A digit is one of the symbols 0 to 9. Each digit sits in a place, such as ones, tens or hundreds, and the place decides what it is worth. A tenth is one of 10 equal parts of one, written 0.1. A hundredth is one of 100 equal parts, written 0.01, and a thousandth is one of 1,000, written 0.001. Expanded form writes a number as a sum, such as $7\\times 1{,}000+4\\times 100$. Each product, the answer when you multiply, is a digit times the value of its place. Standard form is the usual way to write a number, with just digits: 7,400. A place with no product holds a 0.",
    terms: ["place-value", "expanded-form"],
    method: [
      "For each product, find the place its place value names, and write its digit there. $4\\times 100$ puts a 4 in the hundreds place.",
      "List the places from the biggest to the smallest. Where a place has no product, write a 0.",
      "Put the decimal point between the ones place and the tenths place, and read the number.",
    ],
    watch:
      "Do not skip a place that has no product. It holds a 0. Leaving the 0 out slides other digits into the wrong places: 3,080 would become 380.",
  },
  "standard-to-expanded-choice": {
    goal: "Choose the sum of digit-times-place-value products that equals a number written in digits or in words.",
    senses: expandedSenses,
    intuition:
      "A digit is one of the symbols 0 to 9. Each digit sits in a place, such as ones, tens or hundreds, and the place decides what it is worth. A tenth is one of 10 equal parts of one, written 0.1. A hundredth is one of 100 equal parts, written 0.01. Standard form is the usual way to write a number, with digits, such as 4,205.36. Expanded form writes it as a sum of products, the answers to multiplications: each digit times the value of its place. A 0 digit adds nothing, so it needs no product, but it still holds the other digits in their places.",
    terms: ["standard-form-number", "expanded-form"],
    method: [
      "If the number is in words, write it in digits first. Read the whole-number part, then the part after the decimal point, which ends with its last place name, such as hundredths.",
      "Name the place of each digit and the value of that place.",
      "Choose the sum whose products match every digit that is not 0, each in its own place.",
    ],
    watch:
      "A sum can have the right digits in the wrong places. Check each product's place value against the place of its digit.",
  },
};

export const expandedFormPrinciples: Record<string, string> = {
  "expanded-sum-to-standard":
    "A digit $d$ in a place with value $p$ is worth $d\\times p$. A number is the sum of what all its digits are worth. Standard form puts each digit in its place and writes 0 where no digit is named.",
  "standard-to-expanded-choice":
    "Each place is 10 times the place to its right. From left to right the places are worth 1,000, 100, 10, 1, 0.1, 0.01 and 0.001. The expanded form of a number is the sum of digit times place value, for each digit that is not 0.",
};

export const expandedFormLessons: Lesson[] = [
  {
    ...chainLesson({
      id: "expanded-sum-to-standard-lesson",
      title: "From expanded form to standard form",
      summary:
        "Expanded form writes a number as a sum of products, the answers to multiplications, such as $6\\times 1{,}000+2\\times 100+5\\times 1$. Each product is a digit times the value of its place. Standard form is the usual way to write the number, with digits: 6,205. To go from one to the other, put each digit in its place, and write 0 in any place with no product.",
      templateIds: ["expanded-sum-to-standard"],
      objectives: [
        "Say what each product in an expanded form tells about a digit and its place.",
        "Write the standard form, with zeros for places that have no product.",
      ],
      openingTitle: "Each product names a digit and its place",
      opening: [
        "A digit is one of the symbols 0 to 9. The place of a digit decides what it is worth. To the left of the decimal point are ones, tens, hundreds and thousands. A tenth is one of 10 equal parts of one. A hundredth is one of 100 equal parts. A thousandth is one of 1,000 equal parts. To the right of the point are tenths, hundredths and thousandths, in that order.",
        "In $6\\times 1{,}000+2\\times 100+5\\times 1$, the product $6\\times 1{,}000$ puts a 6 in the thousands place. $2\\times 100$ puts a 2 in the hundreds place. $5\\times 1$ puts a 5 in the ones place.",
        "There is no product for the tens place, so the tens place holds a 0. The number is 6,205. Without that 0, you would write 625, a much smaller number.",
      ],
      example: {
        prompt:
          "Write $3\\times 1{,}000+8\\times 10+4\\times 0.1+9\\times 0.001$ in standard form.",
        steps: [
          "Read each product. $3\\times 1{,}000$ puts 3 in the thousands place. $8\\times 10$ puts 8 in the tens. $4\\times 0.1$ puts 4 in the tenths. $9\\times 0.001$ puts 9 in the thousandths.",
          "The hundreds, ones and hundredths places have no product, so each of them holds a 0.",
          "Read the places from thousands down to thousandths, with the decimal point after the ones: 3,080.409.",
        ],
        answer: "3,080.409",
      },
      methodTitle: "List the places, fill the zeros",
      method: [
        "Write the places from the biggest to the smallest, and fill each one from its product.",
        "Write a 0 in every place with no product. Put the decimal point just after the ones place.",
      ],
      formalTitle: "Place value",
      formal: [
        "A number is the sum of what all its digits are worth: each digit times the value of its place. Each place is worth 10 times the place to its right.",
        "A 0 digit holds a place without adding anything to the sum.",
      ],
      pitfalls: [
        "Leaving out a place that has no product. Write a 0 there.",
        "Putting a digit in the next place over. Then it is worth 10 times too much or too little.",
        "Moving the decimal point. The ones place is just before it.",
      ],
      parentGuide:
        "Ask your child to draw a place-value chart, a row of boxes labeled with the places. Then ask them to put each product's digit in its box.",
    }),
    senses: expandedSenses,
  },
  {
    ...chainLesson({
      id: "standard-to-expanded-choice-lesson",
      title: "From standard form to expanded form",
      summary:
        "Standard form is the usual way to write a number with digits, such as 4,205.36. Expanded form writes it as a sum: each digit times the value of its place. To choose the expanded form, name the place of every digit and check each product, the digit times its place value.",
      templateIds: ["standard-to-expanded-choice"],
      objectives: [
        "Name the place of each digit in a number, including digits after the decimal point.",
        "Choose the sum of products that matches every digit that is not 0 and its place.",
      ],
      openingTitle: "Place by place",
      opening: [
        "A digit is one of the symbols 0 to 9. A tenth is one of 10 equal parts of one, written 0.1. A hundredth is one of 100 equal parts, written 0.01.",
        "In 4,205.36, the 4 is in the thousands place and the 2 is in the hundreds. The 0 is in the tens, and the 5 is in the ones. After the decimal point, the 3 is in the tenths and the 6 is in the hundredths.",
        "Each digit times the value of its place gives one product. The expanded form is $4\\times 1{,}000+2\\times 100+5\\times 1+3\\times 0.1+6\\times 0.01$. The 0 in the tens adds nothing, so it needs no product.",
        "A number in words, such as four thousand two hundred five and thirty-six hundredths, names the same digits. The word and marks the decimal point. The last word, hundredths, tells you the 6 is in the hundredths place.",
      ],
      example: {
        prompt: "Write 3,070.5 in expanded form.",
        steps: [
          "Name each place. 3 is in the thousands, 0 in the hundreds, 7 in the tens, 0 in the ones and 5 in the tenths.",
          "The zeros add nothing, so they need no product.",
          "Write each other digit times its place value: $3\\times 1{,}000+7\\times 10+5\\times 0.1$.",
        ],
        answer: "$3\\times 1{,}000+7\\times 10+5\\times 0.1$",
      },
      methodTitle: "Digits, places, products",
      method: [
        "If the number is in words, write it in digits first.",
        "Name each digit's place. Write the digit times its place value, and skip the zeros.",
      ],
      formalTitle: "Expanded form",
      formal: [
        "Suppose a number has a digit $d$ in a place with value $p$. That digit is worth $d\\times p$. The expanded form adds up $d\\times p$ for every digit that is not 0.",
        "The place values are called powers of ten: 1,000, 100, 10 and 1, then 0.1, 0.01 and 0.001. Each one is 10 times the next one in this list.",
      ],
      pitfalls: [
        "Putting a digit in the next place over.",
        "Dropping a 0, so that other digits slide into the wrong places.",
        "Reading the part after the decimal point as a whole number: thirty-six hundredths is 0.36, not 36.",
      ],
      parentGuide:
        "Before your child looks at the choices, ask them to say the place name of each digit aloud.",
    }),
    senses: expandedSenses,
  },
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
