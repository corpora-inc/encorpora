import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const foundations: Lesson["sections"] = [
  {
    stage: "intuition",
    title: "Read terms and products",
    paragraphs: [
      "A variable is a letter, like $x$, that stands for a number. In $6x^2 + 9x$, the small raised 2 means $x$ times $x$, and $9x$ means 9 times $x$. The parts joined by $+$ or $-$ signs are called terms. Each term keeps the sign in front of it.",
      "The number that multiplies a term's variable is called its coefficient. In $6x^2 + 9x$, the coefficients are 6 and 9. A single term made of a number times whole-number powers of $x$, like $3x$ or $7$, is called a monomial. A sum of monomials is called a polynomial.",
      "A product is the result of multiplying. The parts being multiplied are called factors. In $3x(2x + 3)$, the factors are $3x$ and $2x + 3$. A number written right before a bracket multiplies everything inside it.",
      "Factoring means rewriting a sum as a product with the same value. For example, $6x^2 + 9x = 3x(2x + 3)$. To check, multiply back out: $3x \\times 2x = 6x^2$ and $3x \\times 3 = 9x$. You must get every original term back.",
    ],
  },
  {
    title: "Vocabulary and checks",
    paragraphs: [
      "A binomial is a polynomial with exactly two terms, like $x + 3$. The degree is the highest power of $x$ in a polynomial. A quadratic has degree 2: it has an $x^2$ term and no higher power. The coefficient of the highest power is called the leading coefficient.",
      "Like terms have the same power of $x$, so they can be added: $3x + 2x = 5x$. But $x^2$ and $x$ are not like terms, so $x^2 + x$ stays as it is.",
      "Multiplying a number across a bracket is called the distributive property: $a(b + c) = ab + ac$. Expanding (multiplying out) uses it to turn a product into a sum. Factoring uses it backwards to turn a sum into a product. A product written this way is called a factored form. It is right only if expanding it gives back every coefficient.",
      "Signs when multiplying: two numbers with the same sign give a positive product, so $(-2) \\times (-3) = 6$. Different signs give a negative product, so $(-2) \\times 3 = -6$.",
      "Signs when adding: two negatives add their sizes and stay negative, so $-2 + (-3) = -5$. With different signs, subtract the smaller size from the larger and keep the sign of the larger, so $-3 + 2 = -1$. If the sizes are equal, the sum is 0.",
    ],
  },
];
const gcf: Lesson["sections"][number] = {
  title: "Find the common numerical and variable factors",
  paragraphs: [
    "Whole numbers are 0, 1, 2, 3 and so on. A factor of a whole number divides it with no remainder. A common factor divides every coefficient. The greatest common factor, or GCF, is the largest such number.",
    "For 6 and 9: the factors of 6 are 1, 2, 3 and 6, and the factors of 9 are 1, 3 and 9. The common factors are 1 and 3, so the GCF is 3. Ignore signs when finding it: $-6$ and 9 also have GCF 3.",
    "For the variable, use the smallest power that appears in every term. Both $x^3$ and $x^2$ contain $x^2$, because $x^3 = x \\times x^2$. If one term is a number with no $x$, such as 5, then $x$ is not shared by every term.",
    "Put the two together. In $6x^2 + 9x$, the number GCF is 3 and the smallest power of $x$ is $x$ itself. So the shared factor is $3x$. Find what is left by asking what times $3x$ gives each term: $3x \\times 2x = 6x^2$ and $3x \\times 3 = 9x$. So $6x^2 + 9x = 3x(2x + 3)$.",
    "This is true for every value of $x$, including $x = 0$, where both sides are 0. After you take out the greatest common factor, the numbers left inside share nothing but 1, and at least one term inside has no $x$.",
  ],
};
const signs: Lesson["sections"][number] = {
  title: "Use the product and sum together",
  paragraphs: [
    "In $x^2 + bx + c$, the number $b$ multiplies $x$ and $c$ is the constant, the number with no $x$. A quadratic whose leading coefficient is 1 is called monic.",
    "Multiply out $(x + p)(x + q)$, where $p$ and $q$ stand for numbers: $x^2 + qx + px + pq = x^2 + (p + q)x + pq$. So the two numbers must multiply to $c$ and add to $b$. Both must be true.",
    "Start by listing pairs of whole numbers that multiply to the size of $c$. For $x^2 + 5x + 6$, the pairs for 6 are 1 and 6, and 2 and 3. Their sums are 7 and 5. We need 5, so use 2 and 3: $x^2 + 5x + 6 = (x + 2)(x + 3)$.",
    "If $c$ is positive, the two numbers have the same sign. They are both positive when $b$ is positive and both negative when $b$ is negative. For $x^2 - 5x + 6$, use $-2$ and $-3$: they multiply to 6 and add to $-5$. So $x^2 - 5x + 6 = (x - 2)(x - 3)$.",
    "If $c$ is negative, the two numbers have different signs. The larger one in size gives the sum its sign. For $x^2 - x - 6$, use $-3$ and 2: $(-3) \\times 2 = -6$ and $-3 + 2 = -1$. So $x^2 - x - 6 = (x - 3)(x + 2)$. The term $-x$ has coefficient $-1$, even though the 1 is not written.",
  ],
};
const squares: Lesson["sections"][number] = {
  title: "Recognize equal and opposite factors",
  paragraphs: [
    "Sometimes the two numbers are equal. For $x^2 + 6x + 9$, the numbers are 3 and 3, giving $(x + 3)(x + 3)$. Something times itself is called a perfect square. Squared means times itself, so we write $(x + 3)^2$, read “$x + 3$ squared”. Multiplying out gives $x^2 + 3x + 3x + 9$, so the middle term is $6x$, not 0.",
    "Sometimes there is no $x$ term, which means its coefficient is 0. For $x^2 - 9$, the numbers must multiply to $-9$ and add to 0. They are $-3$ and 3, so $x^2 - 9 = (x - 3)(x + 3)$. Multiplying out, the middle terms $-3x$ and $3x$ cancel.",
    "This pattern is called a difference of squares: $A^2 - B^2 = (A - B)(A + B)$, where $A$ and $B$ can be numbers or expressions. A difference of squares is not the square of a difference: $(x - 3)^2 = x^2 - 6x + 9$.",
  ],
};
const senses: Lesson["senses"] = {
  factor: "factor-number",
  factors: "factor-number",
  product: "product-multiply",
  products: "product-multiply",
  term: "term-expression",
  terms: "term-expression",
  square: "square-number",
  squares: "square-number",
  squared: "square-number",
  degree: "degree-polynomial",
  difference: "difference-subtract",
  multiple: "multiple",
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
  "opposite",
  "more than",
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
  "period",
  "periods",
  "quarter",
  "quarters",
  "one quarter",
  "mirror image",
  "rule",
  "rules",
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

export const factoringLessons: Lesson[] = [
  {
    id: "greatest-monomial-factor",
    title: "Extract a common monomial factor",
    summary:
      "In $6x^2 + 9x$, both terms (the parts being added) have 3 and $x$ multiplied in them. So both contain $3x$. Pull that shared piece out in front of a bracket: $6x^2 + 9x = 3x(2x + 3)$. Writing $3x$ before the bracket means $3x$ times everything inside. Multiply back out to check that you get the original sum.",
    templateIds: ["greatest-monomial-factor"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Find the largest whole number that divides every coefficient, and the power of $x$ shared by every term.",
      "Check what is left inside the bracket by multiplying back out, including negative and missing terms.",
    ],
    sections: [
      ...foundations,
      gcf,
      {
        title: "Read the product table",
        illustration: "factoring-gcf",
        paragraphs: [
          "The table shows the multiplication. Rows run across and columns run down. Each cell is its row label times its column label.",
          "The row $3x$ times the column $2x$ gives the cell $6x^2$. The row $3x$ times the column 3 gives the cell $9x$. Adding the cells gives the original polynomial. Reading the labels gives its factored form, $3x(2x + 3)$.",
        ],
      },
      {
        title: "Keep signs and missing powers",
        paragraphs: [
          "Negative terms work the same way. For $-12x^3 + 18x^2$, the sizes 12 and 18 have GCF 6, and the smallest power of $x$ is $x^2$. Take out $6x^2$: $-12x^3 + 18x^2 = 6x^2(-2x + 3)$. Check: $6x^2 \\times (-2x) = -12x^3$ and $6x^2 \\times 3 = 18x^2$. The number in the factor outside is positive, and the minus sign stays inside.",
          "The shared factor can be just a number or just a power of $x$. In $6x^2 + 9$, the 9 has no $x$, so take out only 3: $6x^2 + 9 = 3(2x^2 + 3)$. In $x^3 + 2x^2$, the numbers share only 1, but both terms contain $x^2$: $x^3 + 2x^2 = x^2(x + 2)$.",
          "Taking out the greatest common factor is one step. Sometimes the bracket can be factored further. For example, $2x^2 - 2 = 2(x^2 - 1)$ takes out the GCF, and factoring completely would continue to $2(x - 1)(x + 1)$.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Factor out the greatest common monomial factor with positive coefficient: 6x² + 9x.",
      steps: [
        "Find the largest number that divides both coefficients. The factors that 6 and 9 share are 1 and 3, so the GCF is 3.",
        "Find the power of $x$ in both terms. $x^2$ is $x \\times x$, and the other term has one $x$, so both share $x$. The shared factor is $3x$.",
        "Ask what times $3x$ gives each term: $3x \\times 2x = 6x^2$ and $3x \\times 3 = 9x$. So the bracket holds $2x + 3$.",
        "Write the product: $6x^2 + 9x = 3x(2x + 3)$. This is the distributive property used backwards.",
        "Check by multiplying out: $3x(2x + 3) = 6x^2 + 9x$. Both original terms come back with their signs.",
      ],
      answer: "3x(2x + 3)",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "The distributive property, $a(b + c) = ab + ac$, turns a sum back into a product, the result of multiplying. The greatest common monomial factor with a positive coefficient is the GCF of the coefficients times the smallest power of $x$ that appears in every term.",
        ],
      },
    ],
    pitfalls: [
      "Use every term when finding the common factor, not just the first two.",
      "If one term is a number with no $x$, you cannot take out $x$.",
      "Take out the positive GCF even when the first term is negative. The minus sign stays inside the bracket.",
    ],
    parentGuide:
      "Cover the column labels of the table. Ask the learner to work them out from the row label and the cells, then to check by multiplying each label by the row label.",
  },
  {
    id: "monic-quadratic-factorization",
    title: "Factor a monic quadratic",
    summary:
      "Multiplying $(x + 2)(x + 3)$ gives $x^2 + 5x + 6$. The 5 is $2 + 3$, and the 6 is $2 \\times 3$. Factoring means writing an expression as parts multiplied together, called factors. So to factor $x^2 + bx + c$, find two numbers that add to $b$ and multiply to $c$. Then write $(x + p)(x + q)$ with those two numbers.",
    templateIds: ["monic-quadratic-factorization"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Factor a quadratic whose $x^2$ term has coefficient 1, using whole numbers with the right signs.",
      "Recognize perfect squares and differences of squares, and check every answer by multiplying out.",
    ],
    sections: [
      ...foundations,
      signs,
      {
        title: "See where the middle coefficient comes from",
        illustration: "factoring-monic",
        paragraphs: [
          "In the table, the row labels $x$ and 2 are the terms of one factor. The column labels $x$ and 3 are the terms of the other. Each cell is its row term times its column term.",
          "The four cells are $x^2$, $3x$, $2x$ and 6. The two $x$ terms add to $5x$, giving $x^2 + 5x + 6$.",
          "The constant alone is not enough. $(x + 1)(x + 6)$ also has constant 6, but its middle coefficient is 7. Check the sum as well as the product.",
        ],
      },
      squares,
      {
        title: "What complete factorization means",
        paragraphs: [
          "Factoring over the integers means the factors use only whole numbers and their negatives. Each factor $x + p$ has degree 1 (no $x^2$), so it is called linear. A factor like this is called a linear factor, and it cannot be split any further. So two linear factors are a complete factorization.",
          "The order of the factors does not matter: $(x + 2)(x + 3)$ and $(x + 3)(x + 2)$ are the same product. Factoring rewrites the expression. It does not ask you to find a value of $x$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Factor completely over the integers: x² − x − 6.",
      steps: [
        "Read the numbers with their signs. The constant is $c = -6$. The term $-x$ means $-1$ times $x$, so $b = -1$.",
        "List pairs of whole numbers (the numbers 0, 1, 2, 3 and so on) that multiply to 6: 1 and 6, or 2 and 3. The product $-6$ is negative, so the two numbers must have different signs.",
        "Try signs until the sum is $-1$: $-3$ and 2 work, because $(-3) \\times 2 = -6$ and $-3 + 2 = -1$.",
        "Use each number in a factor: $x - 3$ and $x + 2$.",
        "Check by multiplying out: $(x - 3)(x + 2) = x^2 + 2x - 3x - 6 = x^2 - x - 6$. Every term matches.",
      ],
      answer: "(x − 3)(x + 2)",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Multiplying out gives $(x + p)(x + q) = x^2 + (p + q)x + pq$. So $x^2 + bx + c$ factors this way exactly when there are integers $p$ and $q$ with $p + q = b$ and $pq = c$. Here $pq$ means $p$ times $q$.",
        ],
      },
    ],
    pitfalls: [
      "The pair must give both the right product and the right sum.",
      "The coefficient of $-x$ is $-1$, and a missing $x$ term has coefficient 0.",
      "Squaring a binomial gives two middle products: $(x + 3)^2 = x^2 + 6x + 9$, not $x^2 + 9$.",
    ],
    parentGuide:
      "List the pairs of whole numbers, with signs, that multiply to 12. For each pair, find the sum and write the quadratic it makes. Then multiply one answer back out to check every term.",
  },
  {
    id: "nonmonic-quadratic-factorization",
    title: "Factor a nonmonic quadratic",
    summary:
      "Factoring writes a sum as parts multiplied together. When the number in front of $x^2$ is not 1, as in $6x^2 + 11x + 3$, first take out any number that every term, each part joined by $+$ or $-$, shares. Then split the middle term into two pieces so that each half shares a bracket: $6x^2 + 9x + 2x + 3 = 3x(2x + 3) + 1(2x + 3)$. Pulling out the shared bracket gives $(3x + 1)(2x + 3)$.",
    templateIds: ["nonmonic-quadratic-factorization"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Take out a number that every coefficient shares, with its sign, and keep it in the answer.",
      "Split the middle term using the product of the first and last coefficients, then group in pairs.",
    ],
    sections: [
      ...foundations,
      gcf,
      {
        title: "Extract numerical content first",
        paragraphs: [
          "A quadratic is nonmonic when its leading coefficient (the number in front of $x^2$) is not 1. First take out the GCF of all three coefficients. If the leading coefficient is negative, take out a negative number (a number less than 0) instead, so the $x^2$ term inside the bracket is positive. Keep this outside number in your final answer.",
          "For $2x^2 + 10x + 12$, the GCF is 2. Write $2(x^2 + 5x + 6)$, then factor the inside: $2(x + 2)(x + 3)$.",
          "For $-12x^2 - 22x - 6$, take out $-2$: $-2(6x^2 + 11x + 3)$. The $-2$ multiplies every term inside, so each sign flips. The numbers left inside now share only 1.",
        ],
      },
      {
        title: "Why splitting the middle term works",
        paragraphs: [
          "Start with numbers. Multiply out $(3x + 1)(2x + 3)$: the four products are $6x^2$, $9x$, $2x$ and 3. The two middle products, $9x$ and $2x$, add to the middle term $11x$. Their coefficients 9 and 2 multiply to 18, which is $6 \\times 3$, the first coefficient times the last.",
          "That always happens. Write the inside quadratic as $Ax^2 + Bx + C$, where $A$, $B$ and $C$ are its coefficients and $A$ is positive. Find two integers $m$ and $n$ that multiply to $A \\times C$ and add to $B$. Then write $Bx$ as $mx + nx$. This keeps the value, because $mx + nx = (m + n)x = Bx$.",
          "For $6x^2 + 11x + 3$: $A \\times C = 6 \\times 3 = 18$. The pairs that multiply to 18 are 1 and 18, 2 and 9, and 3 and 6. Their sums are 19, 11 and 9. We need 11, so use 9 and 2: $6x^2 + 9x + 2x + 3$.",
          "Grouping means taking the four terms in two pairs. The first pair shares $3x$: $6x^2 + 9x = 3x(2x + 3)$. The second pair shares only 1: $2x + 3 = 1(2x + 3)$. Both pairs contain the bracket $2x + 3$, so take it out: $(3x + 1)(2x + 3)$.",
        ],
      },
      {
        title: "Check all four products",
        illustration: "factoring-nonmonic",
        paragraphs: [
          "In the table, the row terms $3x$ and 1 multiply the column terms $2x$ and 3. The four products are $6x^2$, $9x$, $2x$ and 3.",
          "The two middle products add to $11x$. Checking only the first and last terms would miss a wrong middle term.",
        ],
      },
      {
        title: "Keep signs and repeated factors",
        paragraphs: [
          "When $A \\times C$ is negative, the two numbers have different signs. For $3x^2 - 8x - 3$, $A \\times C = -9$. Use $-9$ and 1, which add to $-8$: $3x^2 - 9x + x - 3 = 3x(x - 3) + 1(x - 3) = (3x + 1)(x - 3)$.",
          "Equal factors make a perfect square: $4x^2 + 12x + 9 = (2x + 3)^2$. Check the middle: $2x \\times 3 + 3 \\times 2x = 6x + 6x = 12x$.",
          "Factors that differ only in the sign between their terms make a difference of squares: $4x^2 - 9 = (2x - 3)(2x + 3)$. The middle products $-6x$ and $6x$ cancel.",
          "A negative outside number stays outside the square: $-x^2 + 4x - 4 = -(x^2 - 4x + 4) = -(x - 2)^2$. The minus sign multiplies the whole square by $-1$.",
          "When a quadratic can be split this way, factoring is complete when the outside number is kept and each bracket is linear (like $3x + 1$, with no power of $x$ above 1) with numbers that share only 1. Multiply everything back together to check every sign and coefficient.",
        ],
      },
    ],
    workedExample: {
      prompt: "Factor completely over the integers: −12x² − 22x − 6.",
      steps: [
        "The sizes 12, 22 and 6 have GCF 2. The first term is negative, so take out $-2$. That flips every sign inside: $-2(6x^2 + 11x + 3)$.",
        "Inside the bracket, multiply the first and last coefficients: $6 \\times 3 = 18$.",
        "Find two numbers that multiply to 18 and add to the middle coefficient 11: $9 \\times 2 = 18$ and $9 + 2 = 11$.",
        "Split $11x$ into $9x + 2x$ and group in pairs: $6x^2 + 9x + 2x + 3 = 3x(2x + 3) + 1(2x + 3)$.",
        "Both pairs share $2x + 3$, so take it out. Keep the $-2$ in front: $-2(3x + 1)(2x + 3)$.",
        "Check: $(3x + 1)(2x + 3) = 6x^2 + 9x + 2x + 3 = 6x^2 + 11x + 3$. Multiplying by $-2$ gives $-12x^2 - 22x - 6$, the original.",
      ],
      answer: "−2(3x + 1)(2x + 3)",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Multiplying out $(rx + s)(tx + u)$ gives $rt\\,x^2 + (ru + st)x + su$. The two middle coefficients $ru$ and $st$ add to the middle coefficient. They multiply to $ru \\times st = rt \\times su$, the first coefficient times the last. Grouping then uses the distributive property backwards.",
        ],
      },
    ],
    pitfalls: [
      "Keep the outside number, including its sign, in the final answer.",
      "For $Ax^2 + Bx + C$, split the middle term with two numbers that multiply to $A \\times C$ and add to $B$.",
      "Both pairs must contain the same bracket before you can take it out.",
    ],
    parentGuide:
      "Give the learner two brackets and a blank two-by-two table. Ask them to fill in the four products, add the two middle ones, and compare all three terms with the original quadratic.",
  },
];

const methodSenses: ProblemMethod["senses"] = {
  factor: "factor-number",
  factors: "factor-number",
  product: "product-multiply",
  term: "term-expression",
  terms: "term-expression",
  square: "square-number",
  squares: "square-number",
  squared: "square-number",
  difference: "difference-subtract",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};

export const factoringMethods: Record<string, ProblemMethod> = {
  "greatest-monomial-factor": {
    goal: "Rewrite the polynomial as its biggest shared factor, with a positive number, times a bracket.",
    intuition:
      "In $6x^2 + 9x$, the parts joined by $+$ or $-$ are called terms, and the number in front of each $x$ is its coefficient. A factor is a part being multiplied. Both terms here contain 3 and $x$ as factors, so both contain $3x$. Taking the biggest shared piece out in front of a bracket gives $3x(2x + 3)$. A number or term written before a bracket multiplies everything inside it.",
    terms: [
      [
        "greatest-common-factor",
        "Here, of the coefficients only: for $6x^2 + 9x$, it is 3.",
      ],
      [
        "common-factor",
        "The greatest one is the coefficients' greatest common factor times the variable power in every term: $3x$ for $6x^2 + 9x$.",
      ],
    ],
    senses: methodSenses,
    noLink,
    method: [
      "Whole numbers are 0, 1, 2, 3 and so on. Find the largest whole number that divides every coefficient, ignoring signs.",
      "Find the smallest power of $x$ in every term. If a term has no $x$, there is no shared $x$.",
      "Ask what times the shared factor gives each term. Those answers go inside the bracket.",
      "Multiply back out to check that every original term returns.",
    ],
    watch:
      "A term equal to the shared factor leaves 1 inside the bracket, not 0. The bracket keeps as many terms as the original.",
  },
  "monic-quadratic-factorization": {
    goal: "Rewrite $x^2 + bx + c$ as two brackets multiplied together, using whole numbers.",
    intuition:
      "In $x^2 + bx + c$, $x^2$ means $x$ times $x$, $b$ multiplies $x$, and $c$ is the number with no $x$. Factoring means writing it as factors, the parts multiplied together. Multiplying out $(x + 2)(x + 3)$ gives $x^2 + 5x + 6$: the 5 is $2 + 3$ and the 6 is $2 \\times 3$. So look for two numbers that add to $b$ and multiply to $c$.",
    terms: ["monic", "linear-factor"],
    senses: methodSenses,
    noLink,
    method: [
      "Read $c$ and $b$ with their signs. The part $-x$ means $b = -1$.",
      "Find two integers $p$ and $q$ that multiply to $c$ and add to $b$. Integers are the numbers 0, 1, 2, 3, … and their negatives.",
      "Write $(x + p)(x + q)$. Two equal brackets can be written as a square, which is something times itself.",
      "Multiply the brackets back out and compare every part.",
    ],
    watch:
      "Choose signs first. A positive $c$ needs two numbers with the same sign as $b$. A negative $c$ needs two numbers with different signs.",
  },
  "nonmonic-quadratic-factorization": {
    goal: "Factor the quadratic completely, keeping any number taken out in front, with its sign.",
    intuition:
      "In $Ax^2 + Bx + C$, the letters $A$, $B$ and $C$ are the coefficients, the numbers multiplying $x^2$ and $x$ and the number alone. Factoring writes the sum as parts multiplied together. First take out any number all three coefficients share. Then find two numbers that multiply to $A \\times C$ and add to $B$. Use them to split $Bx$ into two terms (the separate parts), and group the four terms in pairs that share a bracket.",
    terms: [
      [
        "greatest-common-factor",
        "Here, of the coefficients, ignoring their signs.",
      ],
      "factoring-by-grouping",
    ],
    senses: methodSenses,
    noLink,
    method: [
      "Take out the largest number all coefficients share. If the $x^2$ term is negative, take out a negative number (one less than 0) so the inside starts positive.",
      "For the inside $Ax^2 + Bx + C$, find two integers (the numbers 0, 1, 2, 3, … and their negatives) that multiply to $A \\times C$ and add to $B$.",
      "Split the middle term with them, take out what each pair shares, then take out the shared bracket.",
      "Keep the outside number, and multiply everything back out to check.",
    ],
    watch:
      "Take out the shared number before splitting, and keep it in the answer: $2(x - 3)(x - 2)$, not $(x - 3)(x - 2)$.",
  },
};
export const factoringPrinciples: Record<string, string> = {
  "greatest-monomial-factor":
    "The distributive property, $a(b + c) = ab + ac$, turns a sum back into a product, the result of multiplying. The greatest common monomial factor is the GCF of the coefficients times the smallest power of $x$ in every term.",
  "monic-quadratic-factorization":
    "Multiplying out gives $(x + p)(x + q) = x^2 + (p + q)x + pq$. So the two integers must add to the middle coefficient and multiply to the constant.",
  "nonmonic-quadratic-factorization":
    "In $(rx + s)(tx + u)$, the middle coefficients $ru$ and $st$ add to the middle coefficient and multiply to the first coefficient times the last. The rule $a(b + c) = ab + ac$ is called the distributive property, and grouping uses it backwards.",
};
