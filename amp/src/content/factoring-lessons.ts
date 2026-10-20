import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const foundations: Lesson["sections"] = [
  {
    title: "Read terms and products",
    paragraphs: [
      "This lesson uses addition and multiplication of signed integers. Integers are whole numbers, zero, and their negative opposites. A number’s magnitude is its distance from zero, also called its absolute value. A variable, such as $x$, represents a number. An expression combines numbers and variables using operations. An exponent counts repeated factors: x² means x × x, and x³ means x × x × x. Multiplying powers combines their repeated factors: x² × x = x³.",
      "A term is one part of a sum, including its sign. In 6x² − 5x + 3, the terms are 6x², −5x, and 3. The coefficient is the numerical multiplier of a variable term; the coefficients here are 6 and −5. A constant term has no variable. When finding a coefficient GCF, include the constant itself among the coefficients. Writing $x$ means 1x, and writing −x means −1x.",
      "A monomial is one term with a whole-number variable exponent, such as 3x² or 7. A polynomial is a sum of these terms. A binomial is a polynomial with exactly two nonzero terms. Its degree is the greatest exponent with a nonzero coefficient. A quadratic has degree 2. The leading coefficient belongs to the term with the greatest exponent. Like terms have the same variable power: 3x + 2x = 5x, but x² and $x$ are not like terms.",
      "Factors are quantities multiplied together. To factor an expression is to rewrite it as an equal product. The distributive property connects products and sums: a(b + c) = ab + ac. Expanding uses this property to form a sum; factoring uses it to identify the factors of a sum. An identity is an equality true for every permitted value of the variable. Check a proposed factorization by expanding and comparing every coefficient.",
      "For signed multiplication, equal signs give a positive product and opposite signs give a negative product. Thus (−2)(−3) = 6 and (−2)(3) = −6. In addition, two negatives add their distances from zero and keep the negative sign: −2 + (−3) = −5. With opposite signs, subtract the smaller distance from the larger and keep the sign of the number farther from zero: −3 + 2 = −1.",
    ],
  },
];
const gcf: Lesson["sections"][number] = {
  title: "Find the common numerical and variable factors",
  paragraphs: [
    "A positive factor of an integer divides it without a remainder. A common factor divides every coefficient. The greatest common factor, abbreviated GCF, is the largest positive one. For 6 and 9, the positive factors are 1, 2, 3, 6 and 1, 3, 9. Their common factors are 1 and 3, so their GCF is 3. Use coefficient magnitudes when signs differ: −6 and 9 also have positive GCF 3.",
    "For a common variable factor, use the smallest exponent present in the nonzero terms. Both x³ and x² contain x², but x² does not contain x³ as a polynomial factor. A nonzero constant has no factor $x$, so a polynomial with a nonzero constant term has no common variable factor. Combine the numerical GCF with this variable power.",
    "For 6x² + 9x, the coefficient GCF is 3 and the smallest variable exponent is 1, giving common factor 3x. Find the remaining terms by multiplication: 3x × 2x = 6x² and 3x × 3 = 9x. Therefore 6x² + 9x = 3x(2x + 3). This identity includes x = 0: both expressions then equal zero. Identifying factors does not require dividing a numerical value by $x$.",
    "The word greatest refers to divisibility: choose the greatest positive coefficient factor and the highest variable power that divides every term. It does not compare the numerical sizes of monomials at different values of $x$. After extraction, the remaining coefficients have GCF 1 and at least one remaining term has no $x$ factor.",
  ],
};
const signs: Lesson["sections"][number] = {
  title: "Use the product and sum together",
  paragraphs: [
    "In x² + bx + c, $b$ is the coefficient of $x$ and $c$ is the constant. A quadratic is monic when its leading coefficient is 1. Expanding (x + p)(x + q) gives x² + qx + px + pq = x² + (p + q)x + pq. Thus the two integers $p$ and $q$ must have product $c$ and sum $b$. Both conditions are necessary.",
    "List positive factor pairs of the magnitude of $c$, then choose signs and check the sum. For x² + 5x + 6, the positive pairs for 6 are 1 and 6, or 2 and 3. Their sums are 7 and 5, so use 2 and 3: x² + 5x + 6 = (x + 2)(x + 3).",
    "If $c$ is positive, the two numbers have the same sign. A positive $b$ requires two positive numbers; a negative $b$ requires two negative numbers. For x² − 5x + 6, use −2 and −3: their product is 6 and their sum is −5. The result is (x − 2)(x − 3).",
    "If $c$ is negative, the signs differ. The number with greater magnitude determines the sign of their sum. For x² − x − 6, use −3 and 2: (−3)(2) = −6 and −3 + 2 = −1. Therefore x² − x − 6 = (x − 3)(x + 2). Remember that the unwritten coefficient of −x is −1.",
  ],
};
const squares: Lesson["sections"][number] = {
  title: "Recognize equal and opposite factors",
  paragraphs: [
    "A perfect-square expression is a product of two equal expressions. For x² + 6x + 9, the required numbers are 3 and 3, giving (x + 3)(x + 3) = (x + 3)². The square applies to the entire parenthesized expression. Expanding gives x² + 3x + 3x + 9; the middle term is 6x, not zero.",
    "Conjugate binomials have the same two terms with opposite signs between them. For example, x + 3 and x − 3 are conjugates. Their product is x² − 3x + 3x − 9 = x² − 9. The middle terms cancel. This difference-of-squares identity is A² − B² = (A − B)(A + B), where $A$ and $B$ can themselves be expressions.",
    "A missing $x$ term means its coefficient is zero. For x² − 9, the numbers −3 and 3 have product −9 and sum zero. A difference of squares is not a square of a difference: (x − 3)² = x² − 6x + 9.",
  ],
};

export const factoringLessons: Lesson[] = [
  {
    id: "greatest-monomial-factor",
    title: "Extract a common monomial factor",
    summary:
      "Find the factor shared by every term and reconstruct the polynomial as a product.",
    templateIds: ["greatest-monomial-factor"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the positive coefficient GCF and the common variable power.",
      "Verify the remaining polynomial by multiplication, including signed and missing terms.",
    ],
    sections: [
      ...foundations,
      gcf,
      {
        title: "Read the product table",
        illustration: "factoring-gcf",
        paragraphs: [
          "Each row runs across the table; each column runs down it. Multiply the row label by the column label to obtain their cell.",
          "The row 3x produces 6x² from column 2x and 9x from column 3. Adding the cells gives the original polynomial. Reading the labels gives its factorization, 3x(2x + 3).",
        ],
      },
      {
        title: "Keep signs and missing powers",
        paragraphs: [
          "For −12x³ + 18x², the coefficient magnitudes 12 and 18 have common positive factors 1, 2, 3, 6. The smallest variable exponent is 2. Extract 6x²: −12x³ + 18x² = 6x²(−2x + 3). Check the two products: 6x² × (−2x) = −12x³ and 6x² × 3 = 18x². The outside coefficient is positive; the negative sign stays in the remaining polynomial.",
          "A common factor may contain only a number or only a variable power. For 6x² + 9, the constant prevents an $x$ factor, so extract 3: 6x² + 9 = 3(2x² + 3). For x³ + 2x², the coefficient GCF is 1 but x² is common: x³ + 2x² = x²(x + 2). A missing intermediate power does not remove a factor shared by all the terms actually present.",
          "Extracting the greatest common monomial factor and factoring completely are different requests. After a common monomial is removed, the remaining polynomial might have other factors. For example, 2x² − 2 = 2(x² − 1) extracts the GCF; complete factorization would continue to 2(x − 1)(x + 1).",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Factor out the greatest common monomial factor with positive coefficient: 6x² + 9x.",
      steps: [
        "The positive common factors of 6 and 9 are 1 and 3; the greatest is 3.",
        "The powers x² and $x$ share $x$. Combine the factors to get 3x.",
        "Find the remaining terms: 3x × 2x = 6x² and 3x × 3 = 9x.",
        "Use distribution in reverse: 6x² + 9x = 3x(2x + 3).",
        "Expanding 3x(2x + 3) reproduces both original terms, including their signs.",
      ],
      answer: "3x(2x + 3)",
    },
    pitfalls: [
      "Use every nonzero term when finding the common factor.",
      "A nonzero constant prevents extracting $x$.",
      "Choose the positive coefficient GCF even when the leading term is negative.",
    ],
    parentGuide:
      "Cover the table's column labels and recover them from the row label and cell products. Check by multiplying each recovered label by the row label.",
  },
  {
    id: "monic-quadratic-factorization",
    title: "Factor a monic quadratic",
    summary:
      "Use the constant product and middle-coefficient sum to identify two integer factors.",
    templateIds: ["monic-quadratic-factorization"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Factor a quadratic with leading coefficient 1 using signed integer pairs.",
      "Recognize perfect squares and differences of squares and verify by expansion.",
    ],
    sections: [
      ...foundations,
      signs,
      {
        title: "See where the middle coefficient comes from",
        illustration: "factoring-monic",
        paragraphs: [
          "The row labels $x$ and 2 are the terms of one factor; the column labels $x$ and 3 are the terms of the other. Each cell is its row term multiplied by its column term. The four products are x², 3x, 2x, and 6. The two $x$ terms combine to 5x, giving x² + 5x + 6.",
          "The constant 6 alone cannot determine the factors: (x + 1)(x + 6) also has constant 6, but its middle coefficient is 7. Verify the cross-term sum as well as the constant product.",
        ],
      },
      squares,
      {
        title: "What complete factorization means",
        paragraphs: [
          "Factoring over the integers uses factors with integer coefficients. Each factor x + p is linear, meaning degree 1. Its coefficients have no common positive factor greater than 1. It cannot be split into two nonconstant polynomial factors with integer coefficients. Thus the product of these two linear factors is a complete factorization.",
          "Writing factors in the opposite order does not change their product. Verify an answer by expansion, not by the order of its factors. A factorization is an equivalent expression; no value of $x$ needs to be found.",
        ],
      },
    ],
    workedExample: {
      prompt: "Factor completely over the integers: x² − x − 6.",
      steps: [
        "The constant is −6 and the coefficient of $x$ is −1.",
        "The factor magnitudes for 6 are 1 and 6, or 2 and 3. The product must be negative, so the signs differ.",
        "Choose −3 and 2: (−3) × 2 = −6 and −3 + 2 = −1.",
        "The factors are x − 3 and x + 2.",
        "Check: (x − 3)(x + 2) = x² + 2x − 3x − 6 = x² − x − 6.",
      ],
      answer: "(x − 3)(x + 2)",
    },
    pitfalls: [
      "A pair must give both the required product and the required sum.",
      "The coefficient of −x is −1; a missing $x$ term has coefficient 0.",
      "Squaring a binomial includes two cross-term products.",
    ],
    parentGuide:
      "List the signed factor pairs for 12. For each pair, calculate the sum and write the corresponding monic quadratic. Expand one proposed factorization to check every coefficient.",
  },
  {
    id: "nonmonic-quadratic-factorization",
    title: "Factor a nonmonic quadratic",
    summary:
      "Extract numerical content, split the middle term, and factor the resulting groups.",
    templateIds: ["nonmonic-quadratic-factorization"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Retain a signed numerical common factor when factoring completely.",
      "Use the leading-coefficient–constant product to split and group the middle term.",
    ],
    sections: [
      ...foundations,
      gcf,
      {
        title: "Extract numerical content first",
        paragraphs: [
          "A quadratic is nonmonic when its leading coefficient is not 1. Before factoring it into linear expressions, extract the positive GCF of all three coefficients. If its leading coefficient is negative, also take out −1 so the quadratic inside the parentheses has a positive leading coefficient. Keep this outside numerical factor in the final answer.",
          "For 2x² + 10x + 12, the coefficient GCF is 2. Write 2(x² + 5x + 6), then factor the inside quadratic to obtain 2(x + 2)(x + 3). For −12x² − 22x − 6, extract −2 to obtain −2(6x² + 11x + 3). The negative sign multiplies every inside term.",
          "A polynomial whose coefficients have GCF 1 is called primitive. After extracting numerical content, factor this primitive quadratic. A negative outside factor does not make the inside factors incomplete; it records the sign of the original polynomial.",
        ],
      },
      {
        title: "Why splitting the middle term works",
        paragraphs: [
          "Write the inside quadratic as Ax² + Bx + C, where $A$, $B$, and $C$ name its coefficients and $A$ is positive. If its factors are (rx + s)(tx + u), expansion gives rt x² + ru $x$ + st $x$ + su. Thus A = rt, C = su, and the middle coefficient is the sum ru + st.",
          "The two middle coefficients ru and st have product (ru)(st) = (rt)(su) = AC. Find integers $m$ and $n$ whose product is AC and whose sum is $B$. Replacing Bx by mx + nx preserves the expression because these are like terms with the same total coefficient.",
          "For 6x² + 11x + 3, calculate AC = 6 × 3 = 18. The positive factor pairs of 18 are 1 and 18, 2 and 9, and 3 and 6. Their sums are 19, 11, and 9. Choose 9 and 2, giving 6x² + 9x + 2x + 3.",
          "Grouping means collecting terms without changing their sum. Factor each pair: 6x² + 9x = 3x(2x + 3), and 2x + 3 = 1(2x + 3). The whole expression is 3x(2x + 3) + 1(2x + 3). Both groups share 2x + 3, so reverse distribution gives (3x + 1)(2x + 3).",
        ],
      },
      {
        title: "Check all four products",
        illustration: "factoring-nonmonic",
        paragraphs: [
          "The row terms 3x and 1 multiply the column terms 2x and 3. Their products are 6x², 9x, 2x, and 3.",
          "Adding the two middle products gives 11x. Comparing just the leading and constant terms would miss an incorrect middle coefficient.",
        ],
      },
      {
        title: "Keep signs and repeated factors",
        paragraphs: [
          "When AC is negative, $m$ and $n$ have opposite signs. For 3x² − 8x − 3, AC = −9. Use −9 and 1 because their sum is −8: 3x² − 9x + x − 3 = 3x(x − 3) + 1(x − 3) = (3x + 1)(x − 3).",
          "Equal factors form a perfect square: 4x² + 12x + 9 = (2x + 3)². Check the middle term: (2x)(3) + (3)(2x) = 6x + 6x = 12x. Opposite cross terms give a difference of squares: 4x² − 9 = (2x − 3)(2x + 3). Here −6x and 6x cancel.",
          "A negative outside factor stays outside a square: −x² + 4x − 4 = −(x² − 4x + 4) = −(x − 2)². The unary minus means multiply the entire square by −1. It is not part of the repeated factor.",
          "Complete factorization retains the outside integer and leaves primitive linear factors. A linear factor has degree 1, so it cannot split into two nonconstant polynomial factors. Multiply every factor back together to check the original signs and all coefficients.",
        ],
      },
    ],
    workedExample: {
      prompt: "Factor completely over the integers: −12x² − 22x − 6.",
      steps: [
        "The coefficient magnitudes 12, 22, and 6 have GCF 2. Extract −2 to leave a positive leading coefficient: −2(6x² + 11x + 3).",
        "For the inside quadratic, multiply leading and constant coefficients: 6 × 3 = 18.",
        "Find 9 and 2: 9 × 2 = 18 and 9 + 2 = 11.",
        "Split and group: 6x² + 11x + 3 = 6x² + 9x + 2x + 3 = 3x(2x + 3) + 1(2x + 3).",
        "Factor the shared binomial and retain −2: −2(3x + 1)(2x + 3).",
        "Check: (3x + 1)(2x + 3) = 6x² + 9x + 2x + 3 = 6x² + 11x + 3. Multiplying by −2 gives −12x² − 22x − 6.",
      ],
      answer: "−2(3x + 1)(2x + 3)",
    },
    pitfalls: [
      "Retain the outside numerical factor, including its sign.",
      "For Ax² + Bx + C, use product AC and sum $B$ when splitting the middle term.",
      "Both groups must contain the same binomial before it can be factored out.",
    ],
    parentGuide:
      "Fill a blank two-by-two product table from proposed linear factors. Combine the cross terms and compare all three coefficients with the original quadratic.",
  },
];

export const factoringMethods: Record<string, ProblemMethod> = {
  "greatest-monomial-factor": {
    goal: "Rewrite the polynomial with its positive greatest common monomial factor outside parentheses.",
    terms: [
      [
        "Coefficient GCF",
        "The largest positive integer dividing every coefficient.",
      ],
      [
        "Common monomial factor",
        "The coefficient GCF multiplied by the variable power contained in every term.",
      ],
    ],
    method: [
      "Find the greatest common factor of all coefficient magnitudes.",
      "Use the smallest exponent present; a constant term prevents an $x$ factor.",
      "Find each remaining term by multiplication with the common factor.",
      "Expand the proposed product to check every original term.",
    ],
    watch:
      "A term equal to the common factor leaves 1 inside the parentheses, not 0; the inside must keep as many terms as the original.",
  },
  "monic-quadratic-factorization": {
    goal: "Rewrite the monic quadratic as a product of integer linear factors.",
    terms: [
      ["Monic", "Having leading coefficient 1."],
      ["Linear factor", "A polynomial factor of degree 1, such as x + 3."],
    ],
    method: [
      "Read the constant $c$ and the coefficient $b$ of $x$, including their signs.",
      "Find integers $p$ and $q$ with product $c$ and sum $b$.",
      "Write (x + p)(x + q); equal factors may be written as a square.",
      "Expand both factors and compare all coefficients.",
    ],
    watch:
      "Match signs before sizes: a positive constant needs two numbers of the same sign as $b$; a negative constant needs opposite signs.",
  },
  "nonmonic-quadratic-factorization": {
    goal: "Factor the quadratic completely while retaining any outside signed integer.",
    terms: [
      [
        "Numerical content",
        "The greatest common factor of the coefficient magnitudes.",
      ],
      [
        "Grouping",
        "Collecting terms and factoring a common expression from each group.",
      ],
    ],
    method: [
      "Extract numerical content and, if needed, a negative sign to leave a positive leading coefficient.",
      "For the inside Ax² + Bx + C, find integers whose product is AC and whose sum is $B$.",
      "Split the middle term and factor the two groups, then factor their shared binomial.",
      "Retain the outside integer and check the complete product by expansion.",
    ],
    watch:
      "Take out the common factor before splitting the middle term, and keep it in the answer: 2(x − 3)(x − 2), not (x − 3)(x − 2).",
  },
};
export const factoringPrinciples: Record<string, string> = {
  "greatest-monomial-factor":
    "The distributive property reverses a sum into a product. The positive common monomial uses the coefficient GCF and the smallest variable exponent present.",
  "monic-quadratic-factorization":
    "Expanding (x + p)(x + q) gives x² + (p + q)x + pq. The integer factors must satisfy both the middle-coefficient sum and constant product.",
  "nonmonic-quadratic-factorization":
    "In (rx + s)(tx + u), the cross-term coefficients ru and st sum to the middle coefficient and multiply to the leading-coefficient–constant product. Distribution in reverse factors the grouped terms.",
};
