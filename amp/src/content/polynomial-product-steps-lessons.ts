import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "polynomial-product-steps",
    title: "Multiply polynomials term by term",
    summary:
      "Multiply every term of one factor by every term of the other, add the like terms, and write the product with the highest power first.",
    objectives: [
      "Multiply two binomials, square a binomial, or multiply a binomial and a trinomial by forming every product of one term from each factor.",
      "Add like terms and write the product in standard form, highest power first.",
    ],
    intuition:
      "A product such as $(x+2)(x+3)$ is the area of a rectangle $x+2$ wide and $x+3$ tall. Cut each side into its two parts and the rectangle splits into four pieces: $x\\cdot x$, $x\\cdot3$, $2\\cdot x$ and $2\\cdot3$. Each term of the first factor meets each term of the second, so a binomial times a binomial gives 4 products, and a binomial times a trinomial gives 6.",
    terms: [
      [
        "term",
        "A number, a letter, or a product of both, joined to the others by $+$ or $-$. In $2x-5$ the terms are $2x$ and $-5$.",
      ],
      [
        "like terms",
        "Terms with the same letter to the same power, such as $5x$ and $-2x$. Only like terms combine into one term.",
      ],
      [
        "standard form",
        "A polynomial written with the highest power first and the constant last, such as $x^2+5x+6$.",
      ],
    ],
    method: [
      "Write the factors and count the terms in each; the number of products is the product of those counts.",
      "Multiply each term of the first factor by each term of the second, keeping the sign in front of every term.",
      "Group the products by power of $x$ and add the like terms.",
      "Write the sum in standard form and check it by putting $x=1$ into both the factors and the product.",
    ],
    watch:
      "A sign belongs to the term after it: in $x-5$ the second term is $-5$. Squaring a binomial is not squaring each term: $(x+3)^2$ is not $x^2+9$, because the outer and inner products add a middle term $6x$.",
    principle:
      "The distributive property applied twice gives $(a+b)(c+d)=ac+ad+bc+bd$. In general each of the $m$ terms of one factor multiplies each of the $n$ terms of the other, giving $mn$ products, and the like terms among them are then added.",
    example: {
      prompt:
        "Multiply $(x+4)(x^2-2x+3)$ and write the product in standard form.",
      steps: [
        "$x\\cdot(x^2-2x+3)=x^3-2x^2+3x$.",
        "$4\\cdot(x^2-2x+3)=4x^2-8x+12$.",
        "Add the $x^2$ terms: $-2x^2+4x^2=2x^2$. Add the $x$ terms: $3x-8x=-5x$.",
        "The product is $x^3+2x^2-5x+12$.",
      ],
      answer: "$x^3+2x^2-5x+12$",
    },
    methodTitle: "Check with a number",
    methodText: [
      "Put $x=1$ into the factors: $(1+4)(1-2+3)=5\\cdot2=10$. Put $x=1$ into the product: $1+2-5+12=10$. Equal values do not prove the product is right, but different values prove a mistake.",
      "Each partial product is its own line. Writing them separately keeps a dropped sign from spreading to the whole answer.",
    ],
    formal:
      "Multiplying polynomials extends the distributive law term by term. The degree of a product is the sum of the degrees of the factors, so a binomial times a trinomial has degree 3, and its leading coefficient is the product of the leading coefficients.",
    pitfalls: [
      "Multiply every term by every term; leaving out one product leaves out part of the answer.",
      "Keep each term's sign when multiplying: a negative times a negative is positive.",
      "Add only like terms: $x^2$ and $x$ do not combine.",
    ],
    parentGuide:
      "Ask your learner to count the products before multiplying (2 terms times 3 terms is 6) and to check the final answer with $x=1$.",
  },
];

export const polynomialProductContent = workContent(entries);

export const polynomialProductFacetMappings: FacetMapping[] = [
  {
    templateId: "polynomial-product-steps",
    facetId: "polynomial-arithmetic.core",
    extent: "partial",
    rationale:
      "Written work: the first, outer, inner and last products, or a binomial times each term of a trinomial, typed as expressions graded by exact symbolic equivalence, then the coefficients of the product from the highest power down, which makes standard form exact and rejects an unexpanded product. Binomials with leading coefficients up to 3, a squared binomial and a binomial times a trinomial. Does not assess factors of degree above 2, several variables, or typing the whole product as one line",
  },
];
