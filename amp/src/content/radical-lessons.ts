import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const foundations: Lesson["sections"] = [
  {
    stage: "intuition",
    title: "Read a square root",
    paragraphs: [
      "Squaring a number means multiplying it by itself. The square root of a nonnegative number is the nonnegative number whose square equals it. Nonnegative means positive or zero. The radical sign is $\\sqrt{\\phantom{9}}$; the number under it is the radicand. Thus $\\sqrt{9} = 3$ because $3 \\times 3 = 9$, and $\\sqrt{0} = 0$.",
      "The square-root symbol selects one value: the principal, nonnegative root. Although $(-3)(-3) = 9$, the expression $\\sqrt{9}$ means 3. A minus sign outside the radical changes that value: $-\\sqrt{9} = -3$. Here every radicand is nonnegative, so every square root is a real number.",
      "A perfect square is the square of a whole number: 0, 1, 4, 9, 16 and 25 are examples. Integers are zero, positive whole numbers and their negatives. The square root of a nonnegative integer that is not a perfect square is irrational: it cannot be written as a fraction of two integers. An expression such as $\\sqrt{2}$ names its exact value. A shortened decimal gives only an approximation.",
    ],
  },
  {
    title: "Extract a square factor",
    paragraphs: [
      "A factor is a number that multiplies another to make a given number. In $18 = 9 \\times 2$, both 9 and 2 are factors of 18. The factor 9 is a perfect square, so $\\sqrt{18} = \\sqrt{9}\\sqrt{2} = 3\\sqrt{2}$. The coefficient 3 multiplies the root; it counts three copies of $\\sqrt{2}$.",
      "For any nonnegative numbers $a$ and $b$, $\\sqrt{ab} = \\sqrt{a}\\sqrt{b}$. The product on the right is nonnegative and its square is ab, so it is the principal square root of ab. This product rule justifies taking a square factor outside a radical. It does not give a rule for adding radicands.",
      "In simplest radical form, no square factor greater than 1 remains inside a square root. Such a radicand is called square-free. For example, 6 is square-free, but 12 contains the square factor 4. Look for square factors 4, 9, 16, 25 and so on. Using the largest one finishes the extraction in a single step.",
      "You need multiplication, factor pairs and signed-number arithmetic. Multiplying two numbers with the same sign gives a positive product; different signs give a negative product. Keep a signed coefficient outside the root while simplifying the nonnegative radicand.",
    ],
  },
];
const fractions: Lesson["sections"] = [
  {
    title: "Keep a fraction's value unchanged",
    paragraphs: [
      "A fraction is a quotient. Its numerator is the number above the bar, and its denominator is the nonzero number below it. For a positive whole-number denominator, the denominator also names how many equal parts make a whole, and the numerator counts those parts. Thus 3/4 counts three quarters and means 3 divided by 4.",
      "Multiplying a fraction's numerator and denominator by the same nonzero number preserves the quotient: the multiplying fraction equals 1. For example, $\\frac{2}{3} = \\frac{2 \\times 5}{3 \\times 5} = \\frac{10}{15}$. Dividing numerator and denominator by a shared nonzero factor reverses this process and reduces a fraction.",
      "A rational number can be written as a quotient of integers with a nonzero denominator. Rationalizing a denominator means replacing a fraction by an equal expression whose denominator is rational. The number itself need not become rational: $\\frac{\\sqrt{3}}{3}$ still contains an irrational square root.",
    ],
  },
];

export const radicalLessons: Lesson[] = [
  {
    id: "simplify-square-root",
    title: "Simplify a square root exactly",
    summary:
      "The number inside a square root is its radicand. A square factor contributes its square root as an outside multiplier, or coefficient: $\\sqrt{72}=6\\sqrt2$.",
    templateIds: ["simplify-square-root"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain the principal square root and square-free radical form.",
      "Extract square factors without changing the exact value.",
    ],
    sections: [
      ...foundations,
      {
        title: "See the side length in the area",
        paragraphs: [
          "A square has four equal sides and four right angles; a right angle is a quarter-turn. Its area is its side length multiplied by itself. Area counts square units, while a side length counts linear units. A square with area 2 square units therefore has side length $\\sqrt{2}$ units.",
          "Arrange nine such squares in three rows and three columns. The large square has area 18 square units. Each side contains three small side lengths, so it measures $3\\sqrt{2}$ units. This is the same side length named by $\\sqrt{18}$. The extraction of a factor of 9 matches the three-by-three arrangement.",
        ],
        illustration: "radical-square-grid",
      },
      {
        title: "Finish the extraction",
        paragraphs: [
          "An expression can be exact without being fully simplified. For example, $\\sqrt{72} = 2\\sqrt{18}$ is true, but 18 still contains a square factor. Continue: $2\\sqrt{18} = 6\\sqrt{2}$. Alternatively use $72 = 36 \\times 2$ at the start.",
          "For a perfect square, the root becomes a whole number: $\\sqrt{36} = 6$. A square-free radicand greater than 1 stays under the root: $\\sqrt{6}$ is already simplified. Check an extracted root by squaring the result and confirming that it is nonnegative.",
        ],
      },
    ],
    workedExample: {
      prompt: "Simplify $\\sqrt{72}$.",
      steps: [
        "The largest square factor of 72 is 36: $72 = 36 \\times 2$.",
        "Split the root of the product: $\\sqrt{72} = \\sqrt{36}\\sqrt{2}$.",
        "Take the square root of 36: $\\sqrt{36}\\sqrt{2} = 6\\sqrt{2}$. The radicand 2 has no square factor greater than 1.",
        "Check: $(6\\sqrt{2})(6\\sqrt{2}) = 36 \\times 2 = 72$. The result is nonnegative.",
      ],
      answer: "$6\\sqrt{2}$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For $s,t \\ge 0$, $\\sqrt{s^2t}=s\\sqrt{t}$. The outside factor is nonnegative because $\\sqrt{s^2}=s$ only when $s \\ge 0$.",
        ],
      },
    ],
    pitfalls: [
      "Extract square factors until the remaining radicand is square-free.",
      "Keep the principal square root nonnegative.",
      "Keep an irrational root exact rather than replacing it with a rounded decimal.",
    ],
    parentGuide:
      "Ask why extracting a factor of 36 from the radicand gives a coefficient of 6 rather than 36. Connect the square's area to its side length.",
  },
  {
    id: "combine-square-roots",
    title: "Add and subtract square-root terms",
    summary:
      "A coefficient is the multiplier outside a square root; its radicand is the number inside. Simplify roots, then add coefficients only when their radicands match: $2\\sqrt3+4\\sqrt3=6\\sqrt3$.",
    templateIds: ["combine-square-roots"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Simplify square-root terms before deciding whether they are like terms.",
      "Combine signed coefficients, recognize cancellation and retain unlike radical parts.",
    ],
    sections: [
      ...foundations,
      {
        title: "Count copies of the same quantity",
        paragraphs: [
          "A term is one quantity in a sum or difference. Like radical terms have the same square-root part after simplification. In $3\\sqrt{2} + 2\\sqrt{2}$, both terms count copies of $\\sqrt{2}$. Together they give $5\\sqrt{2}$. This is the distributive property: adding three copies and two copies makes five copies of the same quantity.",
          "The shared root stays unchanged when coefficients are added or subtracted: $7\\sqrt{3} - 2\\sqrt{3} = 5\\sqrt{3}$. Equal coefficients with opposite signs cancel: $4\\sqrt{5} - 4\\sqrt{5} = 0$. A missing coefficient means 1, so $\\sqrt{2}$ counts one copy of $\\sqrt{2}$.",
        ],
        illustration: "radical-like-lengths",
      },
      {
        title: "Simplify before comparing radical parts",
        paragraphs: [
          "Different original radicands can produce like terms. Since $\\sqrt{18} = 3\\sqrt{2}$ and $\\sqrt{8} = 2\\sqrt{2}$, their sum is $\\sqrt{18} + \\sqrt{8} = 5\\sqrt{2}$. Compare the remaining roots after extracting square factors.",
          "Unlike radical parts remain separate. For example, $\\sqrt{12} + \\sqrt{5} = 2\\sqrt{3} + \\sqrt{5}$. There is no shared square-root quantity whose coefficients can be combined. Adding the original radicands would change the value: $\\sqrt{9} + \\sqrt{16} = 7$, whereas $\\sqrt{25} = 5$.",
          "A perfect-square root becomes an ordinary whole-number term. Thus $\\sqrt{9} + \\sqrt{8} = 3 + 2\\sqrt{2}$. Write the rational term first, followed by square-root terms in increasing order of their radicands. This order changes the presentation, not the value.",
        ],
      },
    ],
    workedExample: {
      prompt: "Simplify $3\\sqrt{12} - \\sqrt{27}$.",
      steps: [
        "Extract square factors: $\\sqrt{12} = \\sqrt{4}\\sqrt{3} = 2\\sqrt{3}$ and $\\sqrt{27} = \\sqrt{9}\\sqrt{3} = 3\\sqrt{3}$.",
        "Include the coefficient on the first term: $3\\sqrt{12} = 6\\sqrt{3}$.",
        "Both terms count copies of the same root: $6\\sqrt{3} - 3\\sqrt{3} = 3\\sqrt{3}$.",
        "Check by adding back the subtracted term: $3\\sqrt{3} + 3\\sqrt{3} = 6\\sqrt{3}$.",
      ],
      answer: "$3\\sqrt{3}$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For real coefficients $a,b$ and $r \\ge 0$, $a\\sqrt{r}+b\\sqrt{r}=(a+b)\\sqrt{r}$. Simplify each radical before deciding whether the radical parts match.",
        ],
      },
    ],
    pitfalls: [
      "Simplify both roots before deciding whether their radical parts match.",
      "Add or subtract coefficients, not radicands.",
      "Keep unlike square-root terms separate; include any minus sign in the coefficient.",
    ],
    parentGuide:
      "Ask why three copies of one length and two copies of the same length make five copies. Then compare a sum containing two different square-root lengths.",
  },
  {
    id: "multiply-square-roots",
    title: "Multiply square-root expressions",
    summary:
      "A coefficient multiplies a square root from outside; the radicand is its nonnegative inside number. Multiply coefficients and radicands separately, then take the root of any square factor outside.",
    templateIds: ["multiply-square-roots"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Use the square-root product rule only for nonnegative radicands.",
      "Multiply signed radical terms and reduce the result to exact simplest form.",
    ],
    sections: [
      ...foundations,
      {
        title: "Multiply the two parts of each term",
        paragraphs: [
          "A radical term consists of a coefficient multiplying a square root. Multiplication can regroup these factors: $(3\\sqrt{2})(2\\sqrt{8}) = (3 \\times 2)(\\sqrt{2}\\sqrt{8})$. The coefficients multiply to 6; the roots multiply to $\\sqrt{16} = 4$. The product is 24.",
          "The rectangle shows the same product after simplifying $2\\sqrt{8} = 4\\sqrt{2}$. Its sides contain three and four lengths of $\\sqrt{2}$. The twelve small squares each have area 2 square units, so the rectangle has area 24 square units. Multiplication can turn two irrational lengths into a rational area.",
        ],
        illustration: "radical-product-grid",
      },
      {
        title: "Carry signs and finish simplifying",
        paragraphs: [
          "A negative coefficient multiplies the whole radical term. For example, $(-2\\sqrt{3})(3\\sqrt{6}) = -6\\sqrt{18} = -18\\sqrt{2}$. The coefficient product is negative because its factors have different signs. The square root itself is nonnegative.",
          "The product of two square-free radicands need not be square-free. Although 6 and 10 contain no square factors, $\\sqrt{6}\\sqrt{10} = \\sqrt{60} = 2\\sqrt{15}$. Inspect the product for square factors rather than stopping after multiplying the radicands.",
        ],
      },
    ],
    workedExample: {
      prompt: "Simplify $(-2\\sqrt{3})(3\\sqrt{6})$.",
      steps: [
        "Multiply the signed coefficients: $(-2)(3) = -6$.",
        "Multiply the roots: $\\sqrt{3}\\sqrt{6} = \\sqrt{18}$.",
        "Extract the square factor: $18 = 9 \\times 2$, so $-6\\sqrt{18} = -18\\sqrt{2}$.",
        "Check by factoring the second root first: $(-2\\sqrt{3})(3\\sqrt{3}\\sqrt{2}) = -6(\\sqrt{3}\\sqrt{3})\\sqrt{2} = -18\\sqrt{2}$.",
      ],
      answer: "$-18\\sqrt{2}$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For $a,b \\ge 0$, $\\sqrt{a}\\sqrt{b}=\\sqrt{ab}$. Any coefficients outside the roots multiply separately, including their signs.",
        ],
      },
    ],
    pitfalls: [
      "Multiply signed coefficients as well as radicands.",
      "Extract square factors from the new radicand even when both original roots were simplified.",
      "Use the product rule for nonnegative real radicands.",
    ],
    parentGuide:
      "Ask why the product of two irrational numbers can be rational. Use a square root multiplied by itself, then connect that product to the rectangle's area.",
  },
  {
    id: "rationalize-radical-denominator",
    title: "Remove a square root from a denominator",
    summary:
      "The numerator is a fraction's top and the denominator its nonzero bottom. If the bottom contains a square root, multiply both parts by that root to remove it without changing the value.",
    templateIds: ["rationalize-radical-denominator"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain why multiplying numerator and denominator by the same nonzero root preserves value.",
      "Rationalize a single-radical denominator and reduce the resulting coefficient.",
    ],
    sections: [
      ...foundations,
      {
        stage: "intuition",
        title: "The two parts of a fraction",
        paragraphs: [
          "The numerator is the expression above a fraction bar; the denominator is below it and cannot be zero. Multiplying both by the same nonzero value multiplies the fraction by 1, so its value stays the same. Rationalizing a denominator means removing a square root from the bottom of a fraction; the number itself can remain irrational.",
        ],
      },
      ...fractions,
      {
        title: "Choose a factor that removes the denominator's root",
        paragraphs: [
          "A square root multiplied by itself equals its radicand: $\\sqrt{3}\\sqrt{3} = 3$. To remove $\\sqrt{3}$ from a denominator, multiply numerator and denominator by $\\sqrt{3}$. For example, $\\frac{2}{\\sqrt{3}} = \\frac{2\\sqrt{3}}{3} = \\frac{2}{3}\\sqrt{3}$. The last two forms write the same coefficient in different positions.",
          "Both numerator and denominator must receive the factor. Multiplying only the denominator would change the fraction. The root used here is positive, so the multiplying fraction $\\frac{\\sqrt{3}}{\\sqrt{3}}$ is defined and equals 1. The operation table tracks both parts.",
        ],
        illustration: "radical-rationalize",
      },
      {
        title: "Simplify first and reduce at the end",
        paragraphs: [
          "If a denominator's root contains a square factor, extract it first. For $\\frac{6}{2\\sqrt{12}}$, use $\\sqrt{12} = 2\\sqrt{3}$ to obtain $\\frac{6}{4\\sqrt{3}}$. Multiplying both parts by $\\sqrt{3}$ gives $\\frac{6\\sqrt{3}}{12} = \\frac{1}{2}\\sqrt{3}$.",
          "The final denominator is a positive integer, the rational coefficient is reduced, and the radicand is square-free. A negative numerator keeps its negative sign. Check by multiplying the answer by the original denominator: the result must be the original numerator.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Rationalize the denominator and simplify $\\frac{6}{2\\sqrt{12}}$.",
      steps: [
        "Simplify the denominator's root: $\\sqrt{12} = 2\\sqrt{3}$. Thus $2\\sqrt{12} = 4\\sqrt{3}$.",
        "Multiply numerator and denominator by the same positive root: $\\frac{6}{4\\sqrt{3}} = \\frac{6\\sqrt{3}}{12}$.",
        "Reduce the coefficient by dividing numerator and denominator by 6: $\\frac{6\\sqrt{3}}{12} = \\frac{1}{2}\\sqrt{3}$.",
        "Check: $(\\frac{1}{2}\\sqrt{3})(2\\sqrt{12}) = (\\frac{1}{2}\\sqrt{3})(4\\sqrt{3}) = 6$.",
      ],
      answer: "$\\frac{1}{2}\\sqrt{3}$",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For real $a$ and $r>0$, $\\frac{a}{\\sqrt{r}}=\\frac{a\\sqrt{r}}{r}$ because $\\sqrt{r}/\\sqrt{r}=1$. The positive-radicand condition keeps the original denominator nonzero.",
        ],
      },
    ],
    pitfalls: [
      "Multiply numerator and denominator by the same nonzero root.",
      "Simplify the denominator's root before choosing the multiplying factor.",
      "Reduce the coefficient and retain a square-free radicand.",
    ],
    parentGuide:
      "Ask why multiplying both parts of a fraction by the same nonzero number preserves its value. Then explain why a square root is the useful multiplying factor here.",
  },
];

const terms: MethodTerm[] = [
  "square-root",
  "radicand",
  "coefficient",
  [
    "simplest-radical-form",
    "Square-free means having no whole-number square factor greater than 1.",
  ],
];
export const radicalMethods: Record<string, ProblemMethod> = {
  "simplify-square-root": {
    goal: "Rewrite the given square root in exact simplest radical form.",
    terms,
    method: [
      "Find the largest square factor of the radicand.",
      "Split the root into a product and take the square factor's root outside.",
      "Keep the remaining square-free root; a perfect-square radicand becomes a whole number.",
    ],
    watch: "The principal square root is nonnegative.",
  },
  "combine-square-roots": {
    goal: "Simplify each given square-root term, then add or subtract like terms.",
    terms,
    method: [
      "Extract square factors from each root and include its signed coefficient.",
      "Group terms with the same remaining square root.",
      "Add or subtract their coefficients; keep unlike radical parts separate.",
    ],
    watch: "Add coefficients, not radicands.",
  },
  "multiply-square-roots": {
    goal: "Find the exact simplified product of the two radical terms.",
    terms,
    method: [
      "Multiply the signed coefficients.",
      "Multiply the nonnegative radicands under one square-root sign.",
      "Extract all square factors and combine the outside coefficients.",
    ],
    watch: "A new square factor may appear when radicands multiply.",
  },
  "rationalize-radical-denominator": {
    goal: "Write an equivalent simplified fraction with a rational denominator.",
    terms: [...terms, "denominator", "rational-number"],
    method: [
      "Simplify the root in the denominator.",
      "Multiply numerator and denominator by the remaining square root.",
      "Replace that root multiplied by itself with its radicand.",
      "Reduce the rational coefficient and keep the radicand square-free.",
    ],
    watch:
      "The numerator must receive the same multiplying factor as the denominator.",
  },
};
export const radicalPrinciples: Record<string, string> = {
  "simplify-square-root":
    "The principal square root is nonnegative; a square factor contributes its nonnegative root as an outside coefficient.",
  "combine-square-roots":
    "The distributive property combines coefficients of the same radical quantity.",
  "multiply-square-roots":
    "For nonnegative radicands, the product of their square roots is the square root of their product.",
  "rationalize-radical-denominator":
    "Multiplying a fraction by 1 preserves its value; a nonzero square root divided by itself equals 1.",
};
