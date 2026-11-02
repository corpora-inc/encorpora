import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const foundations: Lesson["sections"] = [
  {
    title: "Read a signed fraction",
    paragraphs: [
      "A fraction $\\frac{a}{b}$ names the quotient $a \\div b$. The number below the bar is called the denominator, $b$. When it is a positive whole number, it is the number of equal parts that make one whole. The number above the bar is called the numerator, $a$, and it counts those parts. Thus $\\frac{3}{4}$ counts three of the four equal parts of one whole. A denominator is never 0, because dividing by 0 has no answer.",
      "Integers are the whole numbers 0, 1, 2, 3 and so on, together with their negatives. A rational number is a quotient of two integers with a nonzero denominator; it can be positive, negative or zero. On a number line, $-\\frac{3}{4}$ lies three quarters of a unit to the left of 0. One minus sign may be written before the fraction or in its numerator: $-\\frac{3}{4} = \\frac{-3}{4}$.",
      "Equivalent fractions name the same number. Multiplying the numerator and the denominator by the same nonzero number keeps the value, because the multiplying fraction equals 1: $\\frac{3}{4} = \\frac{3 \\times 3}{4 \\times 3} = \\frac{9}{12}$. Dividing both by a common factor reverses this. A fraction is in lowest terms when its numerator and denominator have no common factor greater than 1.",
    ],
  },
];
const multiplication: Lesson["sections"][number] = {
  title: "Multiply and divide fractions",
  paragraphs: [
    "To multiply fractions, multiply the numerators and multiply the denominators: $\\frac{a}{b} \\times \\frac{c}{d} = \\frac{a \\times c}{b \\times d}$. Taking $\\frac{2}{3}$ of $\\frac{4}{5}$ cuts each fifth of the whole into 3 equal pieces, making 15 pieces per whole, and keeps 2 of every 3 pieces from the 4 fifths: 8 pieces, or $\\frac{8}{15}$.",
    "The reciprocal of a nonzero fraction $\\frac{c}{d}$ is $\\frac{d}{c}$, because $\\frac{c}{d} \\times \\frac{d}{c} = 1$. Dividing by $\\frac{c}{d}$ asks which number times $\\frac{c}{d}$ gives the dividend. Multiplying the dividend by $\\frac{d}{c}$ answers it: $(\\frac{a}{b} \\times \\frac{d}{c}) \\times \\frac{c}{d} = \\frac{a}{b}$. Zero has no reciprocal, so division by 0 is undefined.",
  ],
};

export const rationalLessons: Lesson[] = [
  {
    id: "signed-fraction-sum",
    title: "Add and subtract signed fractions",
    summary:
      "A signed fraction is a positive or negative fraction, such as $-\\frac{3}{4}$, which sits three quarters of the way from 0 to −1. To add fractions, their parts must be the same size. The bottom number, the denominator, tells the part size. Renaming means writing a number another way without changing its value. So first rename both fractions with the same denominator, then add the top numbers, keeping their signs. To subtract a number, add its opposite, the same number with the other sign.",
    templateIds: ["signed-fraction-sum"],
    includeGeneratedRepresentation: false,
    senses: {
      rename: "rename",
      "one fourth": "fourth",
      fourths: "fourth",
      opposite: "opposite-number",
      factor: "factor-number",
      product: "product-multiply",
      whole: "whole",
      unit: "unit",
    },
    noLink: ["side", "change", "parts", "part", "quarters"],
    objectives: [
      "Rewrite subtracting a signed fraction as adding its opposite, the number with the other sign.",
      "Add signed fractions with different denominators and simplify the result.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count parts in opposite directions",
        paragraphs: [
          "Picture a number line, with positive numbers to the right of 0 and negative numbers to the left. Adding a positive fraction steps right, and adding a negative fraction steps left.",
          "One half to the right and one fourth to the left use steps of different sizes. Rename the half as two fourths, so both use fourths. The bottom number of a fraction, called its denominator, names the step size. Give both fractions the same denominator, a common denominator, before adding the signed steps.",
        ],
      },
      ...foundations,
      {
        title: "Move along the number line",
        paragraphs: [
          "Adding a positive number moves right on the number line; adding a negative number moves left. To combine $-\\frac{3}{4}$ and $\\frac{5}{6}$, measure both distances in the same unit. Twelfths work, because 4 and 6 both divide 12: $-\\frac{3}{4} = -\\frac{9}{12}$ and $\\frac{5}{6} = \\frac{10}{12}$.",
          "Start at $-\\frac{9}{12}$ and move 10 twelfths to the right. The move passes 0 after 9 twelfths and ends 1 twelfth beyond it: $-\\frac{3}{4} + \\frac{5}{6} = \\frac{-9 + 10}{12} = \\frac{1}{12}$. The denominator names the size of the parts, so it stays 12; only the signed counts of parts are added.",
        ],
        illustration: "signed-fraction-number-line",
      },
      {
        title: "Subtract by adding the opposite",
        paragraphs: [
          "The opposite of a number is the number the same distance from 0 on the other side: the opposite of $-\\frac{1}{3}$ is $\\frac{1}{3}$. Subtracting a number undoes adding it, so subtracting $b$ is the same as adding its opposite: $a - b = a + (-b)$. Subtracting a negative fraction therefore moves right: $\\frac{1}{2} - (-\\frac{1}{3}) = \\frac{1}{2} + \\frac{1}{3} = \\frac{5}{6}$.",
          "The least common denominator is the smallest positive number that both denominators divide evenly. Rename each fraction with it. Add the signed numerators (top numbers) over that denominator, then simplify to lowest terms. Never add the denominators: $\\frac{1}{2} + \\frac{1}{2} = 1$, not $\\frac{2}{4}$. Check a sum by subtracting one addend from it to recover the other.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Combine equal-sized signed parts",
        paragraphs: [
          "For fractions with positive denominators, rename them with a common positive denominator and add their signed numerators: $\\frac{a}{d} + \\frac{c}{d} = \\frac{a + c}{d}$. The denominator keeps the shared part size. Positive and negative numerators record steps in opposite directions. Subtracting a number adds its opposite: $a - b = a + (-b)$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Calculate $-\\frac{5}{6} - \\left(-\\frac{3}{8}\\right)$.",
      steps: [
        "Subtracting a number is the same as adding its opposite. The opposite of $-\\frac{3}{8}$ is $\\frac{3}{8}$, so $-\\frac{5}{6} - \\left(-\\frac{3}{8}\\right) = -\\frac{5}{6} + \\frac{3}{8}$.",
        "The parts must be the same size before adding. The smallest positive number both 6 and 8 divide evenly is 24, so use twenty-fourths: $-\\frac{5}{6} = -\\frac{5 \\times 4}{6 \\times 4} = -\\frac{20}{24}$ and $\\frac{3}{8} = \\frac{3 \\times 3}{8 \\times 3} = \\frac{9}{24}$.",
        "Add the signed numerators (the top numbers) and keep the denominator, which names the part size: $\\frac{-20 + 9}{24} = -\\frac{11}{24}$.",
        "11 and 24 share no factor (a number that divides both) greater than 1, so $-\\frac{11}{24}$ is in lowest terms.",
        "Check by undoing the step: $-\\frac{11}{24} - \\frac{3}{8} = -\\frac{11}{24} - \\frac{9}{24} = -\\frac{20}{24} = -\\frac{5}{6}$, the number we started with.",
      ],
      answer: "$-\\frac{11}{24}$",
    },
    pitfalls: [
      "Change subtracting a negative into adding a positive: $\\frac{1}{2} - \\left(-\\frac{1}{3}\\right) = \\frac{1}{2} + \\frac{1}{3}$.",
      "Add the numerators over one common denominator. Never add the denominators: $\\frac{1}{2} + \\frac{1}{2} = 1$, not $\\frac{2}{4}$.",
      "Keep each sign with its fraction when renaming.",
    ],
    parentGuide:
      "Before calculating, ask which way each fraction moves on the number line, and whether the result should land left or right of 0.",
  },
  {
    id: "signed-fraction-product",
    title: "Multiply and divide signed fractions",
    summary:
      "A signed fraction is a positive or negative fraction, like $-\\frac{4}{9}$. To multiply fractions, multiply the top numbers and multiply the bottom numbers. To divide by a fraction other than 0, flip it (swap its top and bottom) and multiply instead. The flipped fraction is called the reciprocal. Then use the signs: two numbers with the same sign give a positive answer, and different signs give a negative answer.",
    templateIds: ["signed-fraction-product"],
    includeGeneratedRepresentation: false,
    senses: {
      fourths: "fourth",
      eighths: "eighth",
      opposite: "opposite-number",
      factor: "factor-number",
      product: "product-multiply",
      whole: "whole",
      unit: "unit",
    },
    noLink: ["side", "rule", "parts", "part", "quarters"],
    objectives: [
      "Find the sign of a product or quotient (the answer to a multiplication or a division) of signed fractions.",
      "Divide by a fraction by multiplying by its reciprocal, and simplify the result.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Separate amount from direction",
        paragraphs: [
          "Multiplying three fourths by one half finds half of three fourths, which is three eighths. Multiply tops and bottoms: $\\frac{1}{2} \\times \\frac{3}{4} = \\frac{3}{8}$. The answer when you multiply is called the product.",
          "Dividing by a fraction other than 0 means multiplying by its reciprocal. The reciprocal is made by swapping the fraction's top and bottom numbers: the reciprocal of $\\frac{2}{3}$ is $\\frac{3}{2}$.",
          "Work out the size first, then use the signs. The numbers being multiplied are called factors. Two negative factors give a positive result, and one negative factor gives a negative result.",
        ],
      },
      ...foundations,
      multiplication,
      {
        title: "Find the sign first",
        paragraphs: [
          "Multiplying by $-1$ flips a number across 0 to its opposite, the same distance from 0 on the other side. When no factor is 0, a product with one negative factor is flipped across 0 once, so it is negative. A product with two negative factors is reflected twice, back to the positive side. So same signs give a positive product and opposite signs give a negative product.",
          "Division follows the same sign rule. Dividing is multiplying by a reciprocal, and a reciprocal has the same sign as its number. Settle the sign, then work with the sizes.",
          "Before multiplying, a number that divides a numerator may cancel with the same number in a denominator. This divides the top and bottom of the answer by the same number, so the value stays the same. Simplify the result to lowest terms: no number greater than 1 divides both top and bottom.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Products and quotients of fractions",
        paragraphs: [
          "For denominators other than 0, $\\frac{a}{b} \\times \\frac{c}{d} = \\frac{a \\times c}{b \\times d}$. To divide by a fraction other than 0, multiply by its reciprocal: $\\frac{a}{b} \\div \\frac{c}{d} = \\frac{a}{b} \\times \\frac{d}{c}$. When no factor is 0, an odd number of negative factors (1, 3, 5, …) makes a negative product, and an even number makes a positive one. A factor of 0 makes the product 0.",
        ],
      },
    ],
    workedExample: {
      prompt: "Calculate $-\\frac{4}{9} \\div \\left(-\\frac{8}{15}\\right)$.",
      steps: [
        "The divisor is the number we divide by, $-\\frac{8}{15}$. Dividing by it is the same as multiplying by its reciprocal, $-\\frac{15}{8}$: $-\\frac{4}{9} \\div \\left(-\\frac{8}{15}\\right) = -\\frac{4}{9} \\times \\left(-\\frac{15}{8}\\right)$.",
        "Settle the sign first. Both factors are negative, so the result is positive.",
        "Multiply the tops and the bottoms: $\\frac{4 \\times 15}{9 \\times 8} = \\frac{60}{72}$.",
        "Simplify: 12 divides both 60 and 72, so $\\frac{60}{72} = \\frac{60 \\div 12}{72 \\div 12} = \\frac{5}{6}$.",
        "Check by multiplying the answer by the divisor, which should give back the first number: $\\frac{5}{6} \\times \\left(-\\frac{8}{15}\\right) = -\\frac{40}{90} = -\\frac{4}{9}$.",
      ],
      answer: "$\\frac{5}{6}$",
    },
    pitfalls: [
      "Flip only the divisor, the number you divide by, not the first number.",
      "Two negative factors give a positive result: $\\left(-\\frac{1}{2}\\right) \\times \\left(-\\frac{2}{3}\\right) = \\frac{1}{3}$.",
      "Simplify the final fraction to lowest terms.",
    ],
    parentGuide:
      "Ask for the sign of the answer before any multiplying. Then ask the learner to check a division answer by multiplying it by the divisor.",
  },
  {
    id: "complex-fraction",
    title: "Simplify a complex fraction",
    summary:
      "A fraction bar means divide: $\\frac{6}{3}$ is 6 ÷ 3. A complex fraction is a fraction with smaller fractions inside its top or bottom. Its longest bar, the main fraction bar, divides everything above it by everything below it. So work out the top as one number and the bottom as one number. Then divide: flip the bottom fraction (swap its top and bottom numbers) and multiply.",
    templateIds: ["complex-fraction"],
    includeGeneratedRepresentation: false,
    senses: {
      rename: "rename",
      fourths: "fourth",
      opposite: "opposite-number",
      factor: "factor-number",
      product: "product-multiply",
      whole: "whole",
      unit: "unit",
    },
    noLink: ["rule", "parts", "part", "quarters"],
    objectives: [
      "Read the main fraction bar of a complex fraction as dividing the whole top by the whole bottom.",
      "Simplify the top and the bottom, then divide using a reciprocal, the flipped fraction.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Read the large fraction bar as a question",
        paragraphs: [
          "A fraction bar means divide. A fraction with smaller fractions on top or bottom is still one amount divided by another. The whole top is its numerator, and the whole bottom is its denominator.",
          "Find each of those amounts first, then divide. Dividing by a fraction other than 0 means multiplying by its reciprocal. The reciprocal is made by swapping the fraction's top and bottom numbers: the reciprocal of $\\frac{5}{6}$ is $\\frac{6}{5}$.",
        ],
      },
      ...foundations,
      multiplication,
      {
        title: "Read the main fraction bar",
        paragraphs: [
          "A complex fraction is a fraction whose numerator, denominator or both contain fractions. Its longest bar is the main fraction bar. It divides the entire numerator by the entire denominator, so each part acts as if it were in parentheses: $\\dfrac{\\frac{1}{2} + \\frac{1}{3}}{\\frac{5}{6}} = \\left(\\frac{1}{2} + \\frac{1}{3}\\right) \\div \\frac{5}{6}$.",
          "Simplify the numerator to one fraction, then the denominator. Renaming means writing a number another way without changing its value. To add or subtract fractions, rename them with a common denominator, the same bottom number. A whole number such as 2 equals $\\frac{2}{1}$, so it can be renamed too: $2 = \\frac{8}{4}$. Then multiply the numerator by the reciprocal of the denominator. The denominator must not equal 0.",
        ],
      },
      {
        title: "See why the reciprocal works",
        paragraphs: [
          "A complex fraction is an ordinary division. So multiplying its numerator and its denominator by the same number (not 0) keeps its value. Choose the reciprocal of the denominator. For $\\dfrac{\\frac{5}{12}}{\\frac{4}{3}}$, multiply both parts by $\\frac{3}{4}$: the denominator becomes $\\frac{4}{3} \\times \\frac{3}{4} = 1$ and the numerator becomes $\\frac{5}{12} \\times \\frac{3}{4} = \\frac{5}{16}$.",
          "A fraction with denominator 1 equals its numerator, so $\\dfrac{\\frac{5}{12}}{\\frac{4}{3}} = \\frac{5}{16}$. This is the rule for dividing fractions. Multiplying both parts by the least common denominator of all the small fractions is another valid way to clear them.",
        ],
        illustration: "complex-fraction-scaling",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "The main bar means division",
        paragraphs: [
          "A fraction whose numerator or denominator contains a fraction means the entire numerator divided by the entire denominator. The main denominator must not be 0. Each step that simplifies an inner part must keep its value the same.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Simplify $\\dfrac{\\frac{3}{4} - 2}{\\frac{1}{6} + \\frac{2}{3}}$.",
      steps: [
        "The main bar divides the whole top by the whole bottom, so simplify each first. Top: write 2 as fourths so the parts match, $2 = \\frac{8}{4}$. Then $\\frac{3}{4} - \\frac{8}{4} = -\\frac{5}{4}$.",
        "Bottom: write $\\frac{2}{3}$ as sixths, $\\frac{4}{6}$, so the parts match. Then $\\frac{1}{6} + \\frac{4}{6} = \\frac{5}{6}$.",
        "Now divide the top by the bottom. Dividing by $\\frac{5}{6}$ is multiplying by its reciprocal $\\frac{6}{5}$: $-\\frac{5}{4} \\times \\frac{6}{5} = -\\frac{30}{20}$.",
        "Simplify by dividing top and bottom by 10: $-\\frac{30}{20} = -\\frac{3}{2}$. One of the two numbers is negative, so the answer is negative.",
        "Check by multiplying the answer by the bottom: $-\\frac{3}{2} \\times \\frac{5}{6} = -\\frac{15}{12} = -\\frac{5}{4}$, which is the top.",
      ],
      answer: "$-\\frac{3}{2}$",
    },
    pitfalls: [
      "Finish the whole top and the whole bottom before dividing.",
      "Flip the bottom (the denominator), not the top.",
      "Rewrite a whole number with the common denominator before adding it: $2 = \\frac{8}{4}$.",
    ],
    parentGuide:
      "Cover the bottom and ask what single number the top equals. Then do the same for the bottom before dividing.",
  },
  {
    id: "rational-power",
    title: "Evaluate a fractional power",
    summary:
      "A fractional exponent uses its bottom number for a root and its top number for a power; a negative exponent takes a reciprocal.",
    templateIds: ["rational-power"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Interpret $x^{m/n} = \\left(\\sqrt[n]{x}\\right)^m$ as the nth root of $x$ raised to the power $m$, and a negative exponent as a reciprocal.",
      "Evaluate fractional powers of positive fractions exactly.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A root undoes a power",
        paragraphs: [
          "The cube root of eight is two because two cubed is eight. A fractional exponent combines a root and a power: its bottom number names the root and its top number names the power. A negative exponent also takes a reciprocal, swapping the top and bottom of a fraction.",
        ],
      },
      ...foundations,
      {
        title: "Powers and roots of fractions",
        paragraphs: [
          "In $x^3$, the base $x$ is multiplied by itself 3 times; the exponent 3 counts the factors. A power of a fraction powers its numerator and denominator: $\\left(\\frac{2}{3}\\right)^{3} = \\frac{2 \\times 2 \\times 2}{3 \\times 3 \\times 3} = \\frac{8}{27}$. A negative exponent means the reciprocal of the power, $x^{-p} = \\frac{1}{x^p}$, and $x^0 = 1$ for every nonzero $x$.",
          "The nth root of a positive number $x$ is the positive number whose nth power is $x$. The square root is the second root and the cube root is the third: $\\sqrt[3]{\\frac{8}{27}} = \\frac{2}{3}$ because $\\left(\\frac{2}{3}\\right)^{3} = \\frac{8}{27}$. These lessons use positive bases, so every root here is one positive number.",
        ],
      },
      {
        title: "Read a fractional exponent",
        paragraphs: [
          "Raising a power to a power multiplies the exponents: $\\left(x^a\\right)^b = x^{ab}$. Keeping that rule for fractions forces $x^{1/n} = \\sqrt[n]{x}$, the nth root, because $\\left(x^{1/n}\\right)^n = x^1 = x$. Then $x^{m/n} = \\left(x^{1/n}\\right)^m$: take the nth root, then the mth power. With a positive base, taking the power first gives the same value, but the root first keeps numbers small.",
          "Each step of $\\frac{1}{3}$ in the exponent of $\\frac{8}{27}$ multiplies the value by the cube root, $\\frac{2}{3}$. Going down one step divides by $\\frac{2}{3}$. At exponent 0 the value is 1, and below 0 the values are reciprocals of those above it.",
        ],
        illustration: "rational-power-ladder",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Fractional exponents",
        paragraphs: [
          "For a positive real base $a$ and integers $m$ and positive $n$, $a^{m/n}$ is the positive $n$th root of $a^m$, equivalently the $m$th power of the positive $n$th root of $a$. A negative exponent takes the reciprocal, so the base must also be nonzero.",
        ],
      },
    ],
    workedExample: {
      prompt: "Evaluate $\\left(\\frac{16}{81}\\right)^{-3/4}$.",
      steps: [
        "The denominator 4 names the fourth root, the numerator 3 names the power, and the negative sign means a reciprocal.",
        "Take the fourth root: $\\sqrt[4]{\\frac{16}{81}} = \\frac{2}{3}$, because $\\left(\\frac{2}{3}\\right)^{4} = \\frac{16}{81}$.",
        "Raise it to the power 3: $\\left(\\frac{2}{3}\\right)^{3} = \\frac{8}{27}$.",
        "Take the reciprocal: $\\left(\\frac{16}{81}\\right)^{-3/4} = \\dfrac{1}{\\frac{8}{27}} = \\frac{27}{8}$.",
      ],
      answer: "$\\frac{27}{8}$",
    },
    pitfalls: [
      "The exponent's denominator is the root and its numerator is the power.",
      "A negative exponent gives a reciprocal, not a negative number.",
      "Take the root of the numerator and of the denominator separately.",
    ],
    parentGuide:
      "Ask which part of the exponent names the root, and whether a negative exponent should make the answer negative or turn it upside down.",
  },
];

const fractionTerms: MethodTerm[] = [
  "numerator",
  "denominator",
  "lowest-terms",
];
export const rationalMethods: Record<string, ProblemMethod> = {
  "signed-fraction-sum": {
    goal: "Add or subtract two signed fractions (fractions with plus or minus signs) and give the exact answer.",
    terms: [...fractionTerms, "opposite-number"],
    senses: {
      fourths: "fourth",
      rename: "rename",
      opposite: "opposite-number",
      factor: "factor-number",
    },
    noLink: ["part", "parts"],
    intuition:
      "In a fraction, the bottom number (the denominator) tells the part size: 4 means fourths. The top number (the numerator) counts the parts. Fractions add only when their parts are the same size, so give them a common denominator first. Subtracting a number is the same as adding its opposite, the number with the other sign: $\\frac{1}{2} - \\left(-\\frac{1}{3}\\right) = \\frac{1}{2} + \\frac{1}{3}$. Renaming means writing a number another way without changing its value. A factor is a number that divides another evenly.",
    method: [
      "Rewrite subtraction as adding the opposite.",
      "Rename both fractions with the least common denominator, the smallest number both denominators divide.",
      "Add the signed numerators over that denominator.",
      "Simplify to lowest terms.",
    ],
    watch:
      "Add the numerators only. Keep the denominator, because it names the part size.",
  },
  "signed-fraction-product": {
    goal: "Multiply or divide two signed fractions (fractions with plus or minus signs) and give the exact answer.",
    intuition:
      "To multiply fractions, multiply the tops (numerators) and multiply the bottoms (denominators). A fraction's reciprocal is the fraction flipped, with its top and bottom swapped; 0 has no reciprocal. To divide, multiply by the reciprocal of the divisor, the number you divide by. Numbers being multiplied are called factors, and the answer is called the product. Then use the signs. Same signs give a positive result, and different signs give a negative one.",
    terms: [...fractionTerms, "reciprocal"],
    senses: {
      opposite: "opposite-number",
      factor: "factor-number",
      product: "product-multiply",
    },
    method: [
      "To divide, multiply by the reciprocal of the divisor.",
      "Find the sign: same signs give a positive result, and different signs give a negative one.",
      "Multiply the numerators and multiply the denominators.",
      "Simplify to lowest terms.",
    ],
    watch:
      "Flip only the divisor, the number you divide by, never the first fraction.",
  },
  "complex-fraction": {
    goal: "Write a complex fraction, a fraction with fractions inside it, as one exact fraction or integer.",
    intuition:
      "A fraction bar means divide. In a complex fraction, the long bar divides the entire amount above it by the entire amount below it. Find each amount first. Then divide by multiplying by the bottom fraction's reciprocal, made by swapping its top and bottom numbers.",
    senses: { product: "product-multiply" },
    noLink: ["whole", "part", "parts"],
    terms: [
      ...fractionTerms,
      [
        "fraction-bar",
        "In a fraction with fractions inside it, the main fraction bar is the longest one.",
      ],
    ],
    method: [
      "Simplify the numerator to a single fraction.",
      "Simplify the denominator to a single fraction.",
      "Multiply the numerator by the reciprocal of the denominator.",
      "Reduce to lowest terms.",
    ],
    watch:
      "Finish the whole top and the whole bottom before dividing, and flip the bottom, not the top.",
  },
  "rational-power": {
    goal: "Find the exact value of a positive fraction raised to a fractional exponent.",
    intuition:
      "A root undoes a power: the fourth root of 16 is 2 because 2 to the fourth power is 16. In a fractional exponent, the bottom number names the root and the top number names the power. A negative exponent takes the reciprocal, swapping the top and bottom of the result.",
    terms: [...fractionTerms, "nth-root"],
    method: [
      "Read the exponent m/n: $n$ names the root, $m$ the power.",
      "Take the nth root of the numerator and of the denominator.",
      "Raise the root to the power $m$.",
      "If the exponent is negative, take the reciprocal.",
    ],
    watch: "A negative exponent makes a reciprocal, not a negative.",
  },
};
export const rationalPrinciples: Record<string, string> = {
  "signed-fraction-sum":
    "Fractions add by counting parts of one size: $\\frac{a}{d} + \\frac{c}{d} = \\frac{a + c}{d}$. Subtracting a number adds its opposite.",
  "signed-fraction-product":
    "Dividing by a number other than 0 is multiplying by its reciprocal. Same signs give a positive product, and different signs a negative one.",
  "complex-fraction":
    "A fraction bar means divide. Multiplying a fraction's numerator and denominator by the same number other than 0 keeps its value.",
  "rational-power":
    "Since (x^(1/n))^n = x, the exponent 1/n means the nth root, and x^(m/n) is that root to the power $m$.",
};
