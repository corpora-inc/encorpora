import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const fractionChoiceSenses = {
  whole: "whole",
  part: "part",
  third: "third",
  quarter: "fourth",
  eighth: "eighth",
  "more than": "more-than",
};

export const fractionChoiceMethods: Record<string, ProblemMethod> = {
  "fraction-choice-compare": {
    goal: "Choose the fraction or mixed number that is greater or less than a stated number by comparing with a common denominator.",
    senses: fractionChoiceSenses,
    intuition:
      "A fraction names equal parts of a whole, like $\\frac{3}{4}$. Its denominator, the bottom number, says how many equal parts make the whole. Its numerator, the top number, counts the parts. To compare two fractions, give them a common denominator, a bottom number they share. Then their parts are the same size. A whole number is one of the numbers 0, 1, 2, 3 and so on. It can be written as a fraction too: 2 is $\\frac{8}{4}$. A mixed number is a whole number and a fraction written together, such as $2\\frac{1}{4}$.",
    terms: ["common-denominator", "mixed-number"],
    method: [
      "Rewrite the stated number and the choice with a common denominator. For a whole number, write it over the choice's denominator: 2 in fourths is $\\frac{8}{4}$.",
      "Compare the numerators. Over the same denominator, the bigger numerator is the bigger fraction.",
      "Check every choice. For mixed numbers with the same whole number, compare only the fraction parts.",
    ],
    watch:
      "Do not compare numerators or denominators alone. $\\frac{5}{12}$ has a bigger numerator than $\\frac{3}{8}$, but you still need a common denominator: they are $\\frac{10}{24}$ and $\\frac{9}{24}$.",
  },
};

export const fractionChoicePrinciples: Record<string, string> = {
  "fraction-choice-compare":
    "When $b$ and $d$ are greater than 0, $\\frac{a}{b}>\\frac{c}{d}$ exactly when $a \\times d > c \\times b$. Over the common denominator $b \\times d$, the numerators are $a \\times d$ and $c \\times b$. A whole number $w$ is $\\frac{w \\times d}{d}$. Mixed numbers with the same whole number compare by their fraction parts.",
};

export const fractionChoiceLessons = [
  {
    ...chainLesson({
      id: "fraction-choice-compare-lesson",
      title: "Choosing a fraction greater or less than another",
      summary:
        "A fraction names equal parts of a whole. Its denominator, the bottom number, says how many equal parts make the whole. Its numerator, the top number, counts the parts. To compare fractions, rewrite them with a common denominator, a bottom number they share. Then the parts are the same size, and the bigger numerator is the bigger fraction.",
      templateIds: ["fraction-choice-compare"],
      objectives: [
        "Write two fractions, or a whole number and a fraction, with a common denominator.",
        "Choose, from four numbers, the one that is greater or less than a stated number.",
      ],
      openingTitle: "Parts of the same size make fractions easy to compare",
      opening: [
        "Is $\\frac{5}{8}$ greater than $\\frac{2}{3}$? Eighths and thirds are different sizes. So you cannot just compare 5 parts with 2 parts.",
        "Cut both wholes into 24 equal parts. Each eighth becomes 3 of those parts, so $\\frac{5}{8}$ is $\\frac{15}{24}$. Each third becomes 8 of them, so $\\frac{2}{3}$ is $\\frac{16}{24}$. Now the parts match, and 16 parts are more than 15. So $\\frac{2}{3}$ is greater.",
        "A whole number is one of the numbers 0, 1, 2, 3 and so on. It can be written as a fraction too. When the parts are eighths, 1 whole is 8 eighths, so 2 wholes are 16 eighths: 2 is $\\frac{16}{8}$. So $\\frac{17}{8}$ is greater than 2, and $\\frac{15}{8}$ is less than 2.",
        "A mixed number is a whole number and a fraction written together, such as $2\\frac{3}{4}$. It means 2 wholes and $\\frac{3}{4}$ more. Two mixed numbers with the same whole number compare by their fraction parts.",
      ],
      example: {
        prompt:
          "Which is greater than $\\frac{3}{4}$: $\\frac{5}{8}$ or $\\frac{7}{9}$?",
        steps: [
          "Compare $\\frac{3}{4}$ with $\\frac{5}{8}$ first. 8 is a common denominator, because 4 × 2 = 8. Multiply the top and bottom of $\\frac{3}{4}$ by 2: $\\frac{3}{4}=\\frac{6}{8}$. $\\frac{5}{8}$ is less than $\\frac{6}{8}$, so it is not the answer.",
          "Now compare $\\frac{3}{4}$ with $\\frac{7}{9}$. Use 4 × 9 = 36 as a common denominator. Multiply the top and bottom of $\\frac{3}{4}$ by 9 to get $\\frac{27}{36}$. Multiply the top and bottom of $\\frac{7}{9}$ by 4 to get $\\frac{28}{36}$.",
          "28 parts are more than 27 parts of the same size. So $\\frac{7}{9}$ is greater than $\\frac{3}{4}$.",
        ],
        answer: "$\\frac{7}{9}$",
      },
      methodTitle: "Common denominator, then numerators",
      method: [
        "Multiply the two denominators to get a common denominator. Then multiply the top and bottom of each fraction by the same number, so it has that denominator. This cuts each part into smaller equal parts without changing the amount.",
        "Compare the numerators. To compare a whole number with a fraction, first write the whole number over the fraction's denominator. 2 wholes in fourths are 2 × 4 = 8 fourths, or $\\frac{8}{4}$.",
      ],
      formalTitle: "Comparing fractions",
      formal: [
        "When $b$ and $d$ are greater than 0, $\\frac{a}{b}>\\frac{c}{d}$ exactly when $a \\times d > c \\times b$. That is because over the common denominator $b \\times d$, the numerators are $a \\times d$ and $c \\times b$.",
        "Two mixed numbers with the same whole number compare by their fraction parts.",
      ],
      pitfalls: [
        "Do not pick the bigger numerator or the bigger denominator alone. First give both fractions a common denominator.",
        "Do not compare a whole number with a numerator. Write the whole number over the same denominator first.",
        "Check every choice against the stated number, not just the first one.",
      ],
      parentGuide:
        "Ask your child to draw two bars of the same length, cut into different numbers of equal parts, and shade each fraction. Then ask them to cut both bars into parts of the same size and compare again.",
    }),
    senses: fractionChoiceSenses,
  },
];

export const fractionChoiceFacetMappings: FacetMapping[] = [
  {
    templateId: "fraction-choice-compare",
    facetId: "fraction-comparison.core",
    extent: "partial",
    rationale:
      "Single choice among four fractions with denominators 3 to 12 for the one greater or less than a stated proper fraction or a whole number from 1 to 3, and the greatest of four mixed numbers with the same whole part and denominators 3, 4, 6 and 12. Does not assess fractions built from counts of objects, shaded models, ordering by drag, or reasons written in words.",
  },
];
