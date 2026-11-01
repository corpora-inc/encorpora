import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const terms: ProblemMethod["terms"] = [
  "polynomial",
  "coefficient",
  "like-terms",
];
const senses: Lesson["senses"] = {
  term: "term-expression",
  terms: "term-expression",
  factor: "factor-number",
  factors: "factor-number",
  product: "product-multiply",
  products: "product-multiply",
  square: "square-number",
  squared: "square-number",
  degree: "degree-polynomial",
  difference: "difference-subtract",
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
const intuitionBase =
  "A variable is a letter, like $x$, that stands for a number. Squaring means multiplying a number by itself. In $3x^2 - 2x + 5$, $x^2$ is $x$ squared, $x$ times $x$, and $2x$ means 2 times $x$. The parts joined by $+$ or $-$ are called terms, and each term keeps the sign in front of it. The number multiplying a term's power of $x$ is its coefficient: here 3, $-2$ and 5. A sum of terms like this is called a polynomial. Like terms have the same power of $x$, such as $3x^2$ and $4x^2$.";
export const polynomialMethods: Record<string, ProblemMethod> = {
  "polynomial-addition": {
    goal: "Add the polynomials by combining like terms, the terms with the same power of $x$.",
    intuition: `${intuitionBase} Like terms count the same kind of thing, so add their coefficients: $3x^2 + 4x^2 = 7x^2$, just as 3 apples plus 4 apples is 7 apples. Terms with different powers stay separate.`,
    terms,
    senses,
    noLink,
    method: [
      "Group the terms with the same power of $x$. A missing power has coefficient 0.",
      "Add the coefficients in each group, with their signs. Keep the power of $x$ the same.",
      "Write the terms from the highest power down, and leave out any term that became 0. If every term cancels, the answer is 0.",
    ],
    watch:
      "Adding $x^2$ terms never makes $x^4$: $2x^2 + 3x^2 = 5x^2$. Only the coefficients are added.",
  },
  "polynomial-subtraction": {
    goal: "Subtract the polynomials: change the sign of every term being subtracted, then combine like terms.",
    intuition: `${intuitionBase} A minus sign in front of a bracket subtracts everything inside it. So it changes the sign of every term inside: $-(x^2 - 3x + 2) = -x^2 + 3x - 2$. The opposite of a number is the same size with the other sign.`,
    terms,
    senses,
    noLink,
    method: [
      "Rewrite the subtraction as adding the opposite of the second polynomial.",
      "Change the sign of every term in the second polynomial, including its constant (the number with no $x$).",
      "Group terms with the same power of $x$ and add their coefficients, with their signs.",
      "Write the terms from the highest power down. Leave out zero terms, or write 0 if everything cancels.",
    ],
    watch:
      "The minus sign in front of a bracket changes every term inside, not only the first: $-(x^2 - 3x + 2) = -x^2 + 3x - 2$.",
  },
  "polynomial-multiplication": {
    goal: "Multiply the polynomials out and combine like terms, the terms with the same power of $x$.",
    intuition: `${intuitionBase} Two brackets written next to each other are multiplied. To multiply them, multiply every term of the first by every term of the second. When you multiply powers of $x$, add the small raised numbers (the exponents): $x \\times x^2 = x^3$, because that is three $x$'s multiplied.`,
    terms: [...terms, "distribute"],
    senses,
    noLink,
    method: [
      "Multiply each term of the first bracket by every term of the second.",
      "For each pair, multiply the coefficients and add the exponents of $x$: $x^m \\times x^n = x^{m+n}$. Keep track of signs.",
      "Each result of multiplying is a product. Add all the products, combining only terms with the same power of $x$.",
      "Write the result from the highest power down, leaving out zero terms.",
    ],
    watch:
      "Squaring a bracket gives middle terms too: $(x + 3)^2 = x^2 + 6x + 9$, not $x^2 + 9$.",
  },
};
export const polynomialPrinciples: Record<string, string> = {
  "polynomial-addition":
    "The distributive property gives $ax^n + bx^n = (a + b)x^n$: like terms add their coefficients and keep their power of $x$. Terms with different powers cannot be combined.",
  "polynomial-subtraction":
    "Subtracting a sum means adding the opposite of each of its terms: $P - (A + B) = P + (-A) + (-B)$. Then combine like terms.",
  "polynomial-multiplication":
    "The distributive property multiplies every term of one factor (a part being multiplied) by every term of the other. For whole-number exponents $m$ and $n$, $x^m \\times x^n = x^{m+n}$.",
};

export const polynomialLessons: Lesson[] = [
  {
    id: "polynomial-addition",
    title: "Add polynomials",
    summary:
      "Three apples plus four apples is seven apples. In the same way, $3x^2 + 4x^2 = 7x^2$: both parts count $x^2$, so you add the 3 and the 4. Parts with the same power of $x$ are called like terms. Parts with different powers, like $3x^2$ and $4x$, count different things, so they stay separate.",
    templateIds: ["polynomial-addition"],
    senses,
    noLink,
    objectives: [
      "Find like terms (terms with the same power of $x$), including missing powers and constants.",
      "Add their coefficients with signs, and notice when terms cancel to 0.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Which terms combine",
        paragraphs: [
          "A variable is a letter, like $x$, that stands for a number. In $3x^2 - 2x + 5$, $x^2$ means $x$ times $x$, and $2x$ means 2 times $x$. The parts joined by $+$ or $-$ signs are called terms. Each term keeps the sign in front of it, so the terms are $3x^2$, $-2x$ and 5.",
          "The number multiplying a term's power of $x$ is called its coefficient. The coefficients here are 3, $-2$ and 5. In $-x^2$ the coefficient is $-1$, even though the 1 is not written. A term with no $x$, like 5, is called a constant. A sum of terms like this is called a polynomial.",
          "Like terms have the same power of $x$. They count the same kind of thing, so they can be added: $3x^2 + 4x^2 = (3 + 4)x^2 = 7x^2$. This uses the distributive property, the rule that $ab + ac = a(b + c)$.",
          "Terms with different powers are unlike. $3x^2$ and $4x$ cannot be joined into one term, so $3x^2 + 4x$ stays as it is.",
        ],
      },
      {
        title: "Missing terms and cancellation",
        paragraphs: [
          "Match terms by their power of $x$, not by where they sit in the expression. In $x^3 + 2x$, there is no $x^2$ term and no constant. Their coefficients are 0, so they add nothing.",
          "Terms with opposite coefficients cancel, which means they add to 0: $5x + (-5x) = 0$. For example, $(x^2 + 3) + (-x^2 + 2x - 3) = 2x$, because the $x^2$ terms cancel and the constants cancel. If every term cancels, the answer is 0.",
          "Write the answer from the highest power of $x$ down. This order is called descending powers.",
        ],
      },
    ],
    workedExample: {
      prompt: "Simplify (3x³ − 2x + 5) + (−x³ + 4x² + 2x − 8).",
      steps: [
        "Group the terms by power of $x$. The first polynomial has no $x^2$ term, so its coefficient there is 0: $(3 - 1)x^3 + (0 + 4)x^2 + (-2 + 2)x + (5 - 8)$.",
        "Add the coefficients in each group: $2x^3 + 4x^2 + 0x - 3$.",
        "A term with coefficient 0 is 0, so leave out $0x$. Keep the powers in descending order: $2x^3 + 4x^2 - 3$.",
      ],
      answer: "2x³ + 4x² − 3",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For any numbers $a$ and $b$ and any whole-number power $n$, the distributive property gives $ax^n + bx^n = (a + b)x^n$. Only like terms, with the same power of $x$, combine this way.",
        ],
      },
    ],
    pitfalls: [
      "Do not add the exponents when adding terms. $2x^2 + 3x^2 = 5x^2$, not $5x^4$.",
      "A missing power has coefficient 0. Match terms by power, not by their position in the line.",
    ],
    parentGuide:
      "Ask the learner to name the power of $x$ in each group, and to explain why it stays the same when the terms are added. Include an example where terms cancel to 0.",
  },
  {
    id: "polynomial-subtraction",
    title: "Subtract polynomials",
    summary:
      "Taking away a debt of 3 is like gaining 3, because $5 - (-3) = 5 + 3$. In the same way, subtracting a whole bracket flips the sign of every term (a part) inside it: $-(2x^2 - 3x + 4) = -2x^2 + 3x - 4$. Flip every sign first. Then add the terms that have the same power of $x$.",
    templateIds: ["polynomial-subtraction"],
    senses,
    noLink,
    objectives: [
      "Change the sign of every term in the polynomial being subtracted.",
      "Combine coefficients with their signs, and notice when the answer is 0 or a single number.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Subtract the whole expression",
        paragraphs: [
          "In $2x^2 - 3x + 4$, the parts joined by $+$ or $-$ are called terms, and each keeps its sign: $2x^2$, $-3x$ and 4. The number multiplying a power of $x$ is its coefficient. A sum of terms like this is called a polynomial.",
          "The opposite of a number is the same size with the other sign: the opposite of 3 is $-3$, and the opposite of $-3$ is 3. Subtracting a number is the same as adding its opposite, so $5 - 3 = 5 + (-3)$.",
          "Subtracting a whole polynomial means adding the opposite of every one of its terms. It is like multiplying each term by $-1$, which flips its sign. So $-(2x^2 - 3x + 4) = -2x^2 + 3x - 4$. The $-3x$ becomes $+3x$, because $(-1) \\times (-3) = 3$.",
          "The bracket shows which terms the minus sign reaches. It reaches every term inside, including the constant at the end.",
        ],
      },
      {
        title: "Combine after changing signs",
        paragraphs: [
          "After flipping the signs, add like terms. Like terms have the same power of $x$, and you add their coefficients. A missing power has coefficient 0.",
          "The degree is the highest power of $x$ in a polynomial with a coefficient other than 0. A difference can have a lower degree than either polynomial you started with: $(x^2 + 5) - (x^2 + 2) = 3$. A polynomial minus itself is 0.",
        ],
      },
    ],
    workedExample: {
      prompt: "Simplify (4x² − x + 3) − (−2x² + 5x − 7).",
      steps: [
        "Flip the sign of every term in the second bracket, because the minus sign reaches all of them: $-(-2x^2 + 5x - 7) = 2x^2 - 5x + 7$.",
        "Rewrite the problem as a sum: $(4x^2 - x + 3) + (2x^2 - 5x + 7)$.",
        "Add the coefficients of like terms, the terms with the same power of $x$. The term $-x$ has coefficient $-1$: $(4 + 2)x^2 + (-1 - 5)x + (3 + 7) = 6x^2 - 6x + 10$.",
      ],
      answer: "6x² − 6x + 10",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Subtracting a sum means adding the opposite of each term: $P - (A + B) = P + (-A) + (-B)$, where $P$, $A$ and $B$ stand for any terms or polynomials. Then combine like terms.",
        ],
      },
    ],
    pitfalls: [
      "Flip the sign of every term in the subtracted bracket, not only the first one.",
      "Subtracting a negative adds its opposite: $3 - (-4) = 3 + 4 = 7$.",
    ],
    parentGuide:
      "Have the learner rewrite the subtraction as an addition before combining terms. Ask which signs change and why: every term in the second polynomial is multiplied by $-1$.",
  },
  {
    id: "polynomial-multiplication",
    title: "Multiply polynomials",
    summary:
      "Area is the space a shape covers, and a rectangle\'s area is its length times its width. Think of $(x + 2)(x + 3)$ as the area of a rectangle $x + 2$ wide and $x + 3$ tall. Two brackets written next to each other are multiplied. Cutting each length into its parts splits the rectangle into four pieces: $x \\times x$, $x \\times 3$, $2 \\times x$ and $2 \\times 3$. So multiply every part of the first bracket by every part of the second. Then add the pieces that have the same power of $x$.",
    templateIds: ["polynomial-multiplication"],
    senses,
    noLink,
    objectives: [
      "Multiply every term (part) of one polynomial by every term of the other.",
      "Tell apart adding exponents when multiplying from adding coefficients when combining like terms.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Every term multiplies every term",
        paragraphs: [
          "In $x^2 + 4x - 1$, the parts joined by $+$ or $-$ are called terms, and each keeps its sign. The number multiplying a power of $x$ is its coefficient. A sum of terms like this is called a polynomial.",
          "Multiplying a sum by something means multiplying each of its terms: $(A + B)C = AC + BC$. This is called distributing. So to multiply two polynomials, multiply each term of the first by every term of the second.",
          "To multiply two terms, multiply their coefficients and add the exponents (the small raised numbers) on $x$. For example, $2x \\times 3x^2 = 6x^3$. The 6 is $2 \\times 3$. The $x^3$ is because $x \\times x^2$ is $x \\times x \\times x$, three $x$'s multiplied.",
          "Keep each sign with its term: $(-2x) \\times (-3) = 6x$, because a negative times a negative is positive. A constant (a term with no $x$) multiplies every term too.",
        ],
      },
      {
        title: "Add the partial products",
        paragraphs: [
          "A product is the result of multiplying. Each term of the first polynomial gives one row of these, called a partial product. After finding them all, add like terms, which have the same power of $x$. Adding changes their coefficients, never their exponents.",
          "Squares, which are things multiplied by themselves, follow the same rule. $(x + 3)^2$ means $(x + 3)(x + 3) = x^2 + 3x + 3x + 9 = x^2 + 6x + 9$. In $(x + 3)(x - 3)$, the middle terms cancel: $x^2 - 3x + 3x - 9 = x^2 - 9$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Expand and simplify (2x − 3)(x² + 4x − 1).",
      steps: [
        "Multiply the first term, $2x$, by every term of the second bracket: $2x \\times (x^2 + 4x - 1) = 2x^3 + 8x^2 - 2x$.",
        "Multiply the second term, $-3$, by every term, keeping its minus sign: $-3 \\times (x^2 + 4x - 1) = -3x^2 - 12x + 3$.",
        "Add the two rows and group like terms: $2x^3 + (8 - 3)x^2 + (-2 - 12)x + 3$.",
        "Add the coefficients: $2x^3 + 5x^2 - 14x + 3$. That is $2 \\times 3 = 6$ multiplications in all, combined into four terms.",
      ],
      answer: "2x³ + 5x² − 14x + 3",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "The distributive property multiplies every term of one factor (a part being multiplied) by every term of the other. For whole-number exponents $m$ and $n$, $x^m \\times x^n = x^{m+n}$.",
        ],
      },
    ],
    pitfalls: [
      "Multiplying only the first terms and the last terms leaves out the middle products.",
      "Multiplying $x \\times x^2$ gives $x^3$ (add the exponents), but adding $2x^2 + 3x^2$ gives $5x^2$ (add the coefficients). These are different rules.",
    ],
    parentGuide:
      "Ask the learner to point to every pair of terms that was multiplied. A two-term polynomial times a three-term polynomial makes six products before like terms are combined.",
  },
];
