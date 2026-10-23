import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const foundations: Lesson["sections"] = [
  {
    title: "Read a signed fraction",
    paragraphs: [
      "A fraction $\\frac{a}{b}$ names the quotient $a \\div b$. The denominator $b$, below the bar, is the number of equal parts that make one whole. The numerator $a$, above the bar, counts those parts. Thus $\\frac{3}{4}$ counts three of the four equal parts of one whole. A denominator is never 0, because no number of parts can make a whole of zero parts.",
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
      "Rename signed fractions as the same-sized parts before combining their counts.",
    templateIds: ["signed-fraction-sum"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Rewrite a subtraction of a signed fraction as addition of its opposite.",
      "Add signed fractions with different denominators and reduce the result.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count parts in opposite directions",
        paragraphs: [
          "One half to the right and one fourth to the left do not use equally sized steps. Rename the half as two fourths. The bottom number of a fraction, its denominator, names the step size; use a common denominator before adding the signed steps.",
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
          "The least common denominator is the smallest positive number that both denominators divide. Rename each fraction with it, add the signed numerators over that denominator, then reduce. Never add the denominators: $\\frac{1}{2} + \\frac{1}{2} = 1$, not $\\frac{2}{4}$. Check a sum by subtracting one addend from it to recover the other.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Combine equal-sized signed parts",
        paragraphs: [
          "For fractions with positive denominators, rename them with a common positive denominator and add their signed numerators. The denominator keeps the shared part size, while positive and negative numerators record opposite directions.",
        ],
      },
    ],
    workedExample: {
      prompt: "Calculate $-\\frac{5}{6} - \\left(-\\frac{3}{8}\\right)$.",
      steps: [
        "Add the opposite of the subtracted number: $-\\frac{5}{6} - \\left(-\\frac{3}{8}\\right) = -\\frac{5}{6} + \\frac{3}{8}$.",
        "The least common denominator of 6 and 8 is 24: $-\\frac{5}{6} = -\\frac{20}{24}$ and $\\frac{3}{8} = \\frac{9}{24}$.",
        "Add the signed numerators: $-\\frac{20}{24} + \\frac{9}{24} = \\frac{-20 + 9}{24} = -\\frac{11}{24}$. Since 11 and 24 share no factor greater than 1, this is in lowest terms.",
        "Check: $-\\frac{11}{24} - \\frac{3}{8} = -\\frac{11}{24} - \\frac{9}{24} = -\\frac{20}{24} = -\\frac{5}{6}$.",
      ],
      answer: "$-\\frac{11}{24}$",
    },
    pitfalls: [
      "Change subtraction of a negative into addition of a positive.",
      "Add numerators over one common denominator; never add denominators.",
      "Keep each sign with its fraction when renaming.",
    ],
    parentGuide:
      "Ask which way each term moves on the number line and whether the result should land left or right of 0 before calculating.",
  },
  {
    id: "signed-fraction-product",
    title: "Multiply and divide signed fractions",
    summary:
      "Multiply fraction sizes and use the signs to decide the direction of the result.",
    templateIds: ["signed-fraction-product"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Determine the sign of a product or quotient of signed fractions.",
      "Divide by a fraction by multiplying by its reciprocal, and reduce the result.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Separate amount from direction",
        paragraphs: [
          "Multiplying one half by three fourths finds half of that amount. Dividing by a nonzero fraction means multiplying by its reciprocal, made by swapping its top and bottom numbers. Work out the size, then use the signs: two negative factors give a positive result.",
        ],
      },
      ...foundations,
      multiplication,
      {
        title: "Find the sign first",
        paragraphs: [
          "Multiplying by $-1$ reflects a number across 0 to its opposite. A product with one negative factor is reflected once and is negative. A product with two negative factors is reflected twice, back to the positive side. So same signs give a positive product and opposite signs give a negative product.",
          "Division follows the same sign rule, because dividing is multiplying by a reciprocal and a reciprocal has the same sign as its number. Settle the sign, then work with the sizes. Before multiplying, a factor of a numerator may cancel with the same factor of a denominator: this divides the product's numerator and denominator by the same number. Reduce the result to lowest terms.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Products and quotients of fractions",
        paragraphs: [
          "Multiply numerators and denominators to multiply fractions with nonzero denominators. To divide by a nonzero fraction, multiply by its reciprocal. For nonzero factors, an odd number of negative factors makes a negative product and an even number makes a positive one. A zero factor makes the product zero.",
        ],
      },
    ],
    workedExample: {
      prompt: "Calculate $-\\frac{4}{9} \\div \\left(-\\frac{8}{15}\\right)$.",
      steps: [
        "Multiply by the reciprocal of the divisor: $-\\frac{4}{9} \\div \\left(-\\frac{8}{15}\\right) = -\\frac{4}{9} \\times \\left(-\\frac{15}{8}\\right)$.",
        "Both factors are negative, so the result is positive.",
        "Multiply and reduce: $\\frac{4 \\times 15}{9 \\times 8} = \\frac{60}{72} = \\frac{5}{6}$.",
        "Check by multiplying the quotient by the divisor: $\\frac{5}{6} \\times \\left(-\\frac{8}{15}\\right) = -\\frac{40}{90} = -\\frac{4}{9}$.",
      ],
      answer: "$\\frac{5}{6}$",
    },
    pitfalls: [
      "Take the reciprocal of the divisor only, not the dividend.",
      "Two negative factors give a positive result.",
      "Reduce the final fraction to lowest terms.",
    ],
    parentGuide:
      "Ask for the sign of the answer before any multiplying, and ask the learner to check a quotient by multiplying it by the divisor.",
  },
  {
    id: "complex-fraction",
    title: "Simplify a complex fraction",
    summary:
      "The main fraction bar divides the entire numerator by the entire denominator.",
    templateIds: ["complex-fraction"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Read the main fraction bar of a complex fraction as division of grouped parts.",
      "Simplify the numerator and denominator, then divide using a reciprocal.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Read the large fraction bar as a question",
        paragraphs: [
          "A fraction with smaller fractions on top or bottom is asking one amount divided by another. The entire top is its numerator; the entire bottom is its denominator. Find each first, then divide. Dividing by a nonzero fraction means multiplying by its reciprocal, made by swapping its top and bottom.",
        ],
      },
      ...foundations,
      multiplication,
      {
        title: "Read the main fraction bar",
        paragraphs: [
          "A complex fraction is a fraction whose numerator, denominator or both contain fractions. Its longest bar is the main fraction bar. It divides the entire numerator by the entire denominator, so each part acts as if it were in parentheses: $\\dfrac{\\frac{1}{2} + \\frac{1}{3}}{\\frac{5}{6}} = \\left(\\frac{1}{2} + \\frac{1}{3}\\right) \\div \\frac{5}{6}$.",
          "Simplify the numerator to one fraction, then the denominator. To add or subtract, rename the terms with a common denominator; a whole number such as 2 equals $\\frac{2}{1}$. Then multiply the numerator by the reciprocal of the denominator. The denominator must not equal 0.",
        ],
      },
      {
        title: "See why the reciprocal works",
        paragraphs: [
          "A complex fraction is an ordinary quotient, so multiplying its numerator and its denominator by the same nonzero number keeps its value. Choose the reciprocal of the denominator. For $\\dfrac{\\frac{5}{12}}{\\frac{4}{3}}$, multiply both parts by $\\frac{3}{4}$: the denominator becomes $\\frac{4}{3} \\times \\frac{3}{4} = 1$ and the numerator becomes $\\frac{5}{12} \\times \\frac{3}{4} = \\frac{5}{16}$.",
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
          "A fraction whose numerator or denominator is itself a fraction means the entire numerator divided by the entire denominator. The denominator of the main fraction must be nonzero; simplifying inner parts must preserve their values.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Simplify $\\dfrac{\\frac{3}{4} - 2}{\\frac{1}{6} + \\frac{2}{3}}$.",
      steps: [
        "Simplify the numerator: $\\frac{3}{4} - 2 = \\frac{3}{4} - \\frac{8}{4} = -\\frac{5}{4}$.",
        "Simplify the denominator: $\\frac{1}{6} + \\frac{2}{3} = \\frac{1}{6} + \\frac{4}{6} = \\frac{5}{6}$.",
        "Divide by multiplying by the reciprocal: $-\\frac{5}{4} \\div \\frac{5}{6} = -\\frac{5}{4} \\times \\frac{6}{5} = -\\frac{30}{20} = -\\frac{3}{2}$.",
        "Check: $-\\frac{3}{2} \\times \\frac{5}{6} = -\\frac{15}{12} = -\\frac{5}{4}$.",
      ],
      answer: "$-\\frac{3}{2}$",
    },
    pitfalls: [
      "Finish the whole numerator and the whole denominator before dividing.",
      "Use the reciprocal of the denominator, not of the numerator.",
      "Rewrite a whole number with the common denominator before adding it.",
    ],
    parentGuide:
      "Cover the denominator and ask what single number the numerator equals; then do the same for the denominator before dividing.",
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

const fractionTerms: [string, string][] = [
  ["Numerator", "The number above a fraction bar; it counts equal parts."],
  [
    "Denominator",
    "The nonzero number below a fraction bar; it names the size of the parts.",
  ],
  ["Lowest terms", "No common factor greater than 1 remains."],
];
export const rationalMethods: Record<string, ProblemMethod> = {
  "signed-fraction-sum": {
    goal: "Find the exact sum or difference of two signed fractions.",
    terms: [
      ...fractionTerms,
      ["Opposite", "The number the same distance from 0 on the other side."],
    ],
    method: [
      "Rewrite subtraction as adding the opposite.",
      "Rename both fractions with the least common denominator.",
      "Add the signed numerators over that denominator.",
      "Reduce to lowest terms.",
    ],
    watch: "Add numerators only; the denominator names the part size.",
  },
  "signed-fraction-product": {
    goal: "Find the exact product or quotient of two signed fractions.",
    intuition:
      "First multiply or divide the fraction sizes, then use their signs. For division, multiply by the nonzero divisor's reciprocal: swap its top and bottom numbers. Two negative factors make a positive result.",
    terms: [
      ...fractionTerms,
      ["Reciprocal", "The fraction flipped over; a number times it equals 1."],
    ],
    method: [
      "To divide, multiply by the reciprocal of the divisor.",
      "Same signs give a positive result; opposite signs give a negative one.",
      "Multiply numerators and denominators.",
      "Reduce to lowest terms.",
    ],
    watch: "Flip only the divisor.",
  },
  "complex-fraction": {
    goal: "Write the complex fraction as one exact fraction or integer.",
    intuition:
      "The long bar means divide the entire amount above it by the entire amount below it. Find each amount first. Then divide by multiplying by the bottom fraction's reciprocal, made by swapping its top and bottom numbers.",
    terms: [
      ...fractionTerms,
      [
        "Main fraction bar",
        "The longest bar; it divides everything above by everything below.",
      ],
    ],
    method: [
      "Simplify the numerator to a single fraction.",
      "Simplify the denominator to a single fraction.",
      "Multiply the numerator by the reciprocal of the denominator.",
      "Reduce to lowest terms.",
    ],
    watch: "Finish each part before dividing.",
  },
  "rational-power": {
    goal: "Find the exact value of a positive fraction raised to a fractional exponent.",
    intuition:
      "A root undoes a power: the fourth root of 16 is 2 because 2 to the fourth power is 16. In a fractional exponent, the bottom number names the root and the top number names the power. A negative exponent takes the reciprocal, swapping the top and bottom of the result.",
    terms: [
      ...fractionTerms,
      ["nth root", "The positive number whose nth power is the given number."],
    ],
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
    "Fractions add by counting equal parts of one size; subtracting a number adds its opposite.",
  "signed-fraction-product":
    "Dividing by a nonzero number is multiplying by its reciprocal; same signs give a positive product.",
  "complex-fraction":
    "Multiplying a fraction's numerator and denominator by the same nonzero number keeps its value.",
  "rational-power":
    "Since (x^(1/n))^n = x, the exponent 1/n means the nth root, and x^(m/n) is that root to the power $m$.",
};
