import type { GlossaryEntry } from "../types";

/** Equal parts, unit fractions, numerators and denominators, equivalent, mixed and improper fractions, and estimating. */
export const fractionsEntries: GlossaryEntry[] = [
  {
    id: "benchmark-fraction",
    term: "benchmark fraction",
    forms: ["benchmark fraction", "benchmark fractions"],
    plain:
      "A familiar fraction used to compare and estimate: 0, $\\frac{1}{4}$, $\\frac{1}{2}$, $\\frac{3}{4}$ or 1.",
    example:
      "$\\frac{5}{8}$ is just above the benchmark fraction $\\frac{1}{2}$, and $\\frac{1}{9}$ is close to 0.",
    uses: ["fraction", "estimate"],
    band: "4",
  },
  {
    id: "common-denominator",
    term: "common denominator",
    forms: ["common denominator", "common denominators"],
    plain:
      "A denominator that two or more fractions can all be rewritten with, so their parts are the same size.",
    example:
      "For $\\frac{1}{3}$ and $\\frac{1}{4}$, 12 is a common denominator: $\\frac{4}{12}$ and $\\frac{3}{12}$.",
    uses: ["denominator", "fraction"],
    band: "4",
    noLink: ["parts"],
  },
  {
    id: "denominator",
    term: "denominator",
    forms: ["denominator", "denominators"],
    plain:
      "The bottom number of a fraction. It tells how many equal parts one whole is cut into, so it is never 0.",
    example:
      "In $\\frac{3}{4}$, the denominator is 4: the whole is cut into 4 equal parts.",
    figure: "fraction-parts",
    uses: ["fraction", "equal-parts", "whole"],
    band: "3",
  },
  {
    id: "eighth",
    term: "eighth",
    forms: ["eighth", "eighths"],
    plain: "One of 8 equal parts of a whole.",
    example:
      "A pizza cut into 8 equal slices: each slice is one eighth, $\\frac{1}{8}$.",
    uses: ["equal-parts", "whole"],
    band: "2",
    autoLink: false,
  },
  {
    id: "equal-parts",
    term: "equal parts",
    forms: ["equal parts", "equal part"],
    plain:
      "Parts that are all the same size. They may have different shapes if each covers the same amount.",
    example: "A sandwich cut straight down the middle makes 2 equal parts.",
    uses: [],
    band: "1",
    noLink: ["parts"],
  },
  {
    id: "equivalent-fractions",
    term: "equivalent fractions",
    forms: ["equivalent fractions", "equivalent fraction"],
    plain:
      "Fractions that name the same amount, even though their numbers differ.",
    example: "$\\frac{1}{2} = \\frac{2}{4} = \\frac{4}{8}$",
    uses: ["fraction"],
    band: "3",
  },
  {
    id: "estimate",
    term: "estimate",
    forms: ["estimate", "estimates", "estimated", "estimating", "estimation"],
    plain:
      "A number close to the exact answer, found quickly with easier numbers.",
    example: "To estimate 48 + 31, think 50 + 30 = 80.",
    uses: [],
    band: "2",
  },
  {
    id: "fourth",
    term: "fourth",
    forms: [
      "fourth",
      "fourths",
      "one fourth",
      "quarter",
      "quarters",
      "one quarter",
    ],
    plain: "One of 4 equal parts of a whole. Fourths are also called quarters.",
    example:
      "A pizza cut into 4 equal slices: each slice is one fourth, $\\frac{1}{4}$.",
    uses: ["equal-parts", "whole"],
    band: "1",
    autoLink: false,
  },
  {
    id: "fraction",
    term: "fraction",
    forms: ["fraction", "fractions"],
    plain:
      "A number that names part of a whole, written like $\\frac{3}{4}$. The bottom number tells how many equal parts make the whole; the top tells how many are counted.",
    example: "$\\frac{3}{4}$ of a pizza means 3 of its 4 equal slices.",
    figure: "fraction-parts",
    uses: ["whole", "equal-parts"],
    band: "2",
    noLink: ["part"],
  },
  {
    id: "fraction-bar",
    term: "fraction bar",
    forms: ["fraction bar", "fraction bars", "main fraction bar"],
    plain:
      "The line between the top and bottom numbers of a fraction. It means divide the top number by the bottom number.",
    example: "$\\frac{6}{3}$ means 6 ÷ 3, which is 2.",
    uses: ["fraction", "line"],
    band: "3",
  },
  {
    id: "half",
    term: "half",
    forms: ["half", "halves", "one half"],
    plain: "One of 2 equal parts of a whole.",
    example:
      "Cut an apple into 2 equal parts: each part is one half, $\\frac{1}{2}$.",
    uses: ["equal-parts", "whole"],
    band: "1",
    noLink: ["part"],
  },
  {
    id: "improper-fraction",
    term: "improper fraction",
    forms: ["improper fraction", "improper fractions"],
    plain:
      "A fraction whose numerator is as big as its denominator or bigger. It is worth 1 or more.",
    example:
      "$\\frac{9}{4}$ is an improper fraction; it equals the mixed number $2\\frac{1}{4}$.",
    uses: ["fraction", "numerator", "denominator", "mixed-number"],
    band: "4",
  },
  {
    id: "mixed-number",
    term: "mixed number",
    forms: ["mixed number", "mixed numbers"],
    plain: "A whole number and a fraction less than 1, written together.",
    example: "$2\\frac{1}{4}$ means $2 + \\frac{1}{4}$.",
    uses: ["whole-number", "fraction", "less-than"],
    band: "4",
  },
  {
    id: "numerator",
    term: "numerator",
    forms: ["numerator", "numerators"],
    plain:
      "The top number of a fraction. It tells how many of the equal parts are counted.",
    example: "In $\\frac{3}{4}$, the numerator is 3: 3 of the 4 equal parts.",
    figure: "fraction-parts",
    uses: ["fraction", "equal-parts"],
    band: "3",
  },
  {
    id: "reciprocal",
    term: "reciprocal",
    forms: ["reciprocal", "reciprocals"],
    plain:
      "The number you multiply a nonzero number by to get 1. For a fraction, swap the numerator and denominator.",
    example:
      "The reciprocal of $\\frac{2}{3}$ is $\\frac{3}{2}$, because $\\frac{2}{3} \\times \\frac{3}{2} = 1$. The reciprocal of 5 is $\\frac{1}{5}$.",
    uses: ["fraction", "numerator", "denominator"],
    band: "6",
  },
  {
    id: "third",
    term: "third",
    forms: ["third", "thirds", "one third"],
    plain: "One of 3 equal parts of a whole.",
    example:
      "A ribbon cut into 3 equal pieces: each piece is one third, $\\frac{1}{3}$.",
    uses: ["equal-parts", "whole"],
    band: "2",
    autoLink: false,
  },
  {
    id: "whole",
    term: "whole",
    forms: ["whole", "wholes"],
    plain: "All of one thing or amount, before it is split into parts.",
    example: "The whole can be one pizza, one bar, or a group of 12 eggs.",
    uses: [],
    band: "1",
    autoLink: false,
    noLink: ["parts"],
  },
];
