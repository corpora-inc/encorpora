import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "polynomial-product-steps",
    title: "Multiply polynomials term by term",
    summary:
      "Multiply every term (a part) of one factor (a bracket) by every term of the other. Add like terms, highest power first.",
    objectives: [
      "Multiply two binomials (two-term expressions), square a binomial, or multiply a binomial by a trinomial (three terms), forming every product of one term from each.",
      "Add like terms (terms with the same power of $x$) and write the answer with the highest power first.",
    ],
    intuition:
      "In $x + 2$, the parts joined by $+$ or $-$ are called terms, and each term keeps its sign. Two brackets written next to each other are multiplied, and each bracket is called a factor. Area is the space a shape covers. Think of $(x + 2)(x + 3)$ as the area of a rectangle $x + 2$ wide and $x + 3$ tall. Cut each length into its two terms, and the rectangle splits into four pieces: $x \\times x$, $x \\times 3$, $2 \\times x$ and $2 \\times 3$. Each term of the first factor meets each term of the second. Each result of multiplying is called a product. So two terms times two terms gives 4 products, and two terms times three terms gives 6. Like terms have the same power of $x$, so they can be added: $3x + 2x = 5x$. Writing the terms from the highest power of $x$ down is called standard form.",
    terms: ["term-expression", "like-terms", "standard-form-polynomial"],
    method: [
      "Count the terms in each factor. The number of products is those two counts multiplied.",
      "Multiply each term of the first factor by each term of the second. Keep the sign in front of every term.",
      "Group the products by their power of $x$ and add the like terms.",
      "Write the sum from the highest power down. Check by putting $x = 1$ into both the factors and your answer.",
    ],
    watch:
      "A sign belongs to the term after it: in $x - 5$ the second term is $-5$. Squaring, which means multiplying by itself, works on the whole bracket, not on each term: $(x + 3)^2 = x^2 + 6x + 9$, not $x^2 + 9$.",
    principle:
      "Using the distributive property twice gives $(a + b)(c + d) = ac + ad + bc + bd$. In general, each of the $m$ terms of one factor multiplies each of the $n$ terms of the other, giving $m \\times n$ products. Then the like terms are added.",
    example: {
      prompt:
        "Multiply $(x+4)(x^2-2x+3)$ and write the product in standard form.",
      steps: [
        "Multiply the first term, $x$, by every term of the trinomial (the three-term factor): $x \\times (x^2 - 2x + 3) = x^3 - 2x^2 + 3x$. Multiplying $x$ by $x^2$ gives $x^3$.",
        "Multiply the second term, 4, by every term: $4 \\times (x^2 - 2x + 3) = 4x^2 - 8x + 12$.",
        "Add the like terms. The $x^2$ terms: $-2x^2 + 4x^2 = 2x^2$. The $x$ terms: $3x - 8x = -5x$.",
        "Write the answer from the highest power down: $x^3 + 2x^2 - 5x + 12$.",
      ],
      answer: "$x^3+2x^2-5x+12$",
    },
    methodTitle: "Check with a number",
    methodText: [
      "Put $x = 1$ into the factors: $(1 + 4)(1 - 2 + 3) = 5 \\times 2 = 10$. Put $x = 1$ into the answer: $1 + 2 - 5 + 12 = 10$. The two match.",
      "Matching values do not prove the answer is right, but different values prove there is a mistake.",
      "Write each row of products on its own line. Then a dropped sign stays in one line and is easy to find.",
    ],
    formal:
      "The distributive property is the rule $a(b + c) = ab + ac$, and multiplying polynomials uses it term by term. The degree is the highest power of $x$ in a polynomial. The degree of a product is the sum of the degrees of the factors, so a binomial of degree 1, like $x + 4$, times a trinomial of degree 2, like $x^2 - 2x + 3$, has degree 3. Its leading coefficient, the number in front of the highest power, is the product of the factors' leading coefficients.",
    pitfalls: [
      "Multiply every term by every term. Leaving out one product leaves out part of the answer.",
      "Keep each term's sign when multiplying: a negative times a negative is positive.",
      "Add only like terms: $x^2$ and $x$ do not combine.",
    ],
    parentGuide:
      "Ask your learner to count the products before multiplying (2 terms times 3 terms is 6), and then to check the final answer by putting in $x = 1$.",
  },
];

const built = workContent(entries);
const senses = {
  term: "term-expression",
  terms: "term-expression",
  factor: "factor-number",
  factors: "factor-number",
  product: "product-multiply",
  products: "product-multiply",
  square: "square-number",
  squared: "square-number",
  squaring: "square-number",
  degree: "degree-polynomial",
  degrees: "degree-polynomial",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};
const noLink = [
  "part",
  "parts",
  "whole",
  "change",
  "changes",
  "leaves",
  "key",
  "jumps",
  "jump",
  "third",
  "mean",
  "means",
  "sort",
  "image",
  "images",
  "solid",
  "scales",
  "net",
  "inverse",
  "population",
  "more than",
  "period",
  "periods",
  "quarter",
  "quarters",
  "one quarter",
  "mirror image",
  "rule",
  "rules",
  "opposite",
  "opposites",
  "unit",
  "units",
  "average",
  "decreasing",
  "increasing",
  "model",
  "models",
  "pattern",
  "patterns",
];
for (const lesson of built.lessons) Object.assign(lesson, { senses, noLink });
for (const method of Object.values(built.methods))
  Object.assign(method, { senses, noLink });

export const polynomialProductContent = built;

export const polynomialProductFacetMappings: FacetMapping[] = [
  {
    templateId: "polynomial-product-steps",
    facetId: "polynomial-arithmetic.core",
    extent: "partial",
    rationale:
      "Written work: the first, outer, inner and last products, or a binomial times each term of a trinomial, typed as expressions graded by exact symbolic equivalence, then the coefficients of the product from the highest power down, which makes standard form exact and rejects an unexpanded product. Binomials with leading coefficients up to 3, a squared binomial and a binomial times a trinomial. Does not assess factors of degree above 2, several variables, or typing the whole product as one line",
  },
];
