import type { GlossaryEntry } from "../types";

/** Expressions, equations, inequalities, linear and quadratic algebra, and money-model vocabulary. */
export const expressionsEquationsEntries: GlossaryEntry[] = [
  {
    id: "absolute-value",
    term: "absolute value",
    forms: ["absolute value", "absolute values"],
    plain:
      "How far a number is from 0 on the number line. It is never negative. Bars show it: $|x|$.",
    example: "$|-7| = 7$ and $|7| = 7$: both numbers are 7 steps from 0.",
    uses: ["number-line", "negative-number"],
    band: "6",
  },
  {
    id: "additive-rule",
    term: "additive rule",
    forms: ["additive rule", "additive rules"],
    plain:
      "A rule that adds the same number to every input, or subtracts the same number from every input.",
    example: "The rule add 4 turns inputs 1, 2 and 3 into 5, 6 and 7.",
    uses: ["rule", "input"],
    band: "5",
  },
  {
    id: "asset",
    term: "asset",
    forms: ["asset", "assets"],
    plain:
      "Something you own that is worth money, such as savings, a car or a bicycle.",
    example:
      "Savings of 900 dollars and a bike worth 150 dollars are assets worth 1,050 dollars in all.",
    uses: [],
    band: "7",
  },
  {
    id: "at-least",
    term: "at least",
    forms: ["at least"],
    plain:
      "The amount can be equal to the number or greater than it. Use $\\ge$.",
    example: "At least 18 means $n \\ge 18$, so 18, 19 and 20 all work.",
    uses: ["equal", "greater-than"],
    band: "6",
  },
  {
    id: "at-most",
    term: "at most",
    forms: ["at most"],
    plain: "The amount can be equal to the number or less than it. Use $\\le$.",
    example:
      "Spend at most 20 dollars: $c \\le 20$, so spending exactly 20 dollars is allowed.",
    uses: ["equal", "less-than"],
    band: "6",
  },
  {
    id: "average-speed",
    term: "average speed",
    forms: ["average speed", "average speeds"],
    plain:
      "Total distance divided by total time for a whole trip, even when the speed changed along the way.",
    example: "120 miles in 3 hours: 120 ÷ 3 = 40 miles per hour.",
    uses: ["distance", "speed"],
    band: "algebra-1",
    noLink: ["whole"],
  },
  {
    id: "back-substitution",
    term: "back-substitution",
    forms: ["back-substitution", "back substitution"],
    plain:
      "Solving a stack of equations from the bottom up: solve the last one, put its answer into the one above, and repeat.",
    example:
      "From $z = 2$ and $y + z = 5$, get $y = 3$; then put both into the top equation.",
    uses: ["equation"],
    band: "8",
  },
  {
    id: "balance-account",
    term: "balance",
    forms: ["balance", "balances"],
    plain:
      "The amount of money in an account right now, or the amount still owed.",
    example:
      "Start with 50 dollars, add 20 dollars, spend 15 dollars: the balance is 55 dollars.",
    uses: [],
    band: "6",
    autoLink: false,
  },
  {
    id: "balance-scale",
    term: "balance",
    forms: [
      "balance",
      "balances",
      "balance scale",
      "balance scales",
      "level balance",
    ],
    plain:
      "A beam with a pan on each side. The heavier side drops. When both sides weigh the same, the beam stays level.",
    example:
      "3 blocks on one pan and 3 blocks on the other: the beam stays level.",
    uses: [],
    band: "K",
    autoLink: false,
    noLink: ["side", "sides"],
  },
  {
    id: "base-exponent",
    term: "base",
    forms: ["base", "bases"],
    plain:
      "The number being multiplied by itself in a power. The exponent says how many times it is used as a factor.",
    example:
      "In $5^3 = 5 \\times 5 \\times 5$, the base is 5 and the exponent is 3.",
    uses: ["exponent", "factor-number"],
    band: "6",
    autoLink: false,
  },
  {
    id: "base-shape",
    term: "base",
    forms: ["base", "bases"],
    plain:
      "The face a solid shape is named for or stands on. Some solids have two matching bases at opposite ends; others have just one.",
    example:
      "A soup can has two circle bases. A tent shape with triangle ends has two triangle bases.",
    uses: ["solid-shape", "face-solid", "circle", "triangle"],
    band: "2",
    autoLink: false,
    noLink: ["opposite"],
  },
  {
    id: "boundary",
    term: "boundary",
    forms: ["boundary", "boundaries", "boundary point"],
    plain:
      "The number where the solutions of an inequality start or stop. It is the solution of the matching equation.",
    example:
      "For $x + 2 > 5$, the boundary is 3, because $x + 2 = 5$ when $x = 3$.",
    uses: ["solution", "inequality", "equation"],
    band: "6",
    autoLink: false,
  },
  {
    id: "closed-circle",
    term: "closed circle",
    forms: [
      "closed circle",
      "closed circles",
      "filled circle",
      "filled circles",
      "closed dot",
      "filled dot",
    ],
    plain:
      "A filled-in dot on a number line graph. It shows the boundary number is a solution, as with $\\le$ or $\\ge$.",
    example: "$x \\ge 2$ has a closed circle at 2 and an arrow pointing right.",
    uses: ["number-line", "boundary", "solution"],
    band: "6",
  },
  {
    id: "coefficient",
    term: "coefficient",
    forms: ["coefficient", "coefficients"],
    plain:
      "The number multiplying a variable in a term, with its sign. When no number is written, the coefficient is 1.",
    example:
      "In $-3x + y$, the coefficient of $x$ is −3 and the coefficient of $y$ is 1.",
    uses: ["variable", "term-expression"],
    band: "6",
  },
  {
    id: "common-factor",
    term: "common factor",
    forms: ["common factor", "common factors"],
    plain:
      "A number or variable that divides every term exactly. Factoring it out leaves the rest in parentheses.",
    example: "$6x + 9 = 3(2x + 3)$: 3 is a common factor of $6x$ and 9.",
    uses: ["variable", "term-expression", "parentheses"],
    band: "6",
    noLink: ["leaves"],
  },
  {
    id: "completing-the-square",
    term: "completing the square",
    forms: ["completing the square", "complete the square"],
    plain:
      "Adding the square of half the $x$ coefficient to $x^2 + bx$, so that it becomes a squared binomial.",
    example:
      "$x^2 + 6x$: half of 6 is 3 and $3^2 = 9$, so $x^2 + 6x + 9 = (x + 3)^2$.",
    uses: ["coefficient", "half", "square-number", "perfect-square-trinomial"],
    band: "algebra-1",
  },
  {
    id: "compound-inequality",
    term: "compound inequality",
    forms: ["compound inequality", "compound inequalities"],
    plain:
      "Two inequalities joined by “and” or “or”. With “and”, both must be true; with “or”, one or both must be true.",
    example: "$2 < x < 10$ means $x > 2$ and $x < 10$.",
    uses: ["inequality"],
    band: "7",
  },
  {
    id: "concentration",
    term: "concentration",
    forms: ["concentration", "concentrations"],
    plain:
      "The fraction or percent of a mixture that is one ingredient. Amount of ingredient = amount of mixture × concentration.",
    example: "4 liters of 20% salt water hold 4 × 0.20 = 0.8 liters of salt.",
    uses: ["fraction", "percent", "liter"],
    band: "algebra-1",
  },
  {
    id: "constant",
    term: "constant",
    forms: ["constant", "constants"],
    plain:
      "A number or quantity that stays the same. In $y = 3x + 5$, 5 is a constant: it does not change when $x$ changes.",
    example:
      "A taxi's 3-dollar starting charge is a constant; the distance driven is not.",
    uses: [],
    band: "6",
    noLink: ["change", "changes", "distance"],
  },
  {
    id: "constant-term",
    term: "constant term",
    forms: ["constant term", "constant terms"],
    plain: "A term with no variable, just a number. Its value never changes.",
    example: "In $4x^2 - x + 7$, the constant term is 7.",
    uses: ["term-expression", "variable"],
    band: "6",
    noLink: ["changes"],
  },
  {
    id: "contradiction",
    term: "contradiction",
    forms: ["contradiction", "contradictions"],
    plain:
      "A statement that can never be true, such as 0 = 2. If solving reaches one, the equation or system has no solution.",
    example: "$x + 1 = x + 3$ leads to 1 = 3, so there is no solution.",
    uses: ["equation", "system-of-equations", "solution"],
    band: "8",
  },
  {
    id: "conversion-factor",
    term: "conversion factor",
    forms: [
      "conversion factor",
      "conversion factors",
      "conversion ratio",
      "conversion ratios",
    ],
    plain:
      "A fraction worth 1 that changes units. Its top and bottom are the same amount written in different units.",
    example:
      "Since 12 inches = 1 foot, the conversion factor $\\frac{12 \\text{ in}}{1 \\text{ ft}}$ turns 3 feet into 36 inches.",
    uses: ["fraction", "unit"],
    band: "5",
    noLink: ["changes"],
  },
  {
    id: "corresponding-terms",
    term: "corresponding terms",
    forms: ["corresponding terms", "matching terms"],
    plain:
      "Terms in the same position in two patterns, such as the 3rd term of each.",
    example:
      "In 3, 6, 9 and 6, 12, 18, each term of the second pattern is twice the term in the same place in the first.",
    uses: ["term-sequence", "pattern"],
    band: "5",
  },
  {
    id: "coupon",
    term: "coupon",
    forms: ["coupon", "coupons"],
    plain: "A ticket or code that takes some dollars off the price.",
    example: "A 5-dollar coupon makes a 20-dollar shirt cost 15 dollars.",
    uses: [],
    band: "2",
  },
  {
    id: "dependent-variable",
    term: "dependent variable",
    forms: [
      "dependent variable",
      "dependent variables",
      "dependent quantity",
      "dependent quantities",
    ],
    plain:
      "The quantity whose value depends on another one. It is the output, graphed on the vertical axis.",
    example:
      "Total cost depends on how many tickets you buy, so cost is the dependent variable.",
    uses: ["output", "y-axis"],
    band: "6",
  },
  {
    id: "deposit",
    term: "deposit",
    forms: ["deposit", "deposits"],
    plain:
      "Money put into an account. It adds to the balance, so it is recorded as a positive amount.",
    example: "A 40-dollar deposit raises a 100-dollar balance to 140 dollars.",
    uses: ["balance-account"],
    band: "6",
  },
  {
    id: "derived-unit",
    term: "derived unit",
    forms: ["derived unit", "derived units"],
    plain:
      "A unit made by multiplying or dividing other units, such as square centimeters or meters per second.",
    example:
      "Speed in meters per second comes from dividing meters by seconds.",
    uses: ["unit", "speed"],
    band: "algebra-1",
    noLink: ["square"],
  },
  {
    id: "difference-of-squares",
    term: "difference of squares",
    forms: ["difference of squares", "difference of two squares"],
    plain:
      "One squared quantity minus another. It factors as $a^2 - b^2 = (a + b)(a - b)$.",
    example: "$4x^2 - 25 = (2x)^2 - 5^2 = (2x + 5)(2x - 5)$.",
    uses: ["square-number"],
    band: "algebra-1",
    noLink: ["factors"],
  },
  {
    id: "difference-subtract",
    term: "difference",
    forms: ["difference", "differences"],
    plain: "The answer when you take one number away from another.",
    example: "The difference of 9 and 4 is 5, because 9 − 4 = 5.",
    uses: [],
    band: "1",
    autoLink: false,
  },
  {
    id: "dimensional-analysis",
    term: "dimensional analysis",
    forms: ["dimensional analysis"],
    plain:
      "Tracking units through each step and multiplying by conversion factors, so unwanted units cancel and the wanted ones remain.",
    example:
      "$\\frac{60 \\text{ mi}}{1 \\text{ h}} \\times \\frac{1 \\text{ h}}{60 \\text{ min}} = \\frac{1 \\text{ mi}}{1 \\text{ min}}$: the hours cancel.",
    uses: ["unit", "conversion-factor"],
    band: "algebra-1",
  },
  {
    id: "discriminant",
    term: "discriminant",
    forms: ["discriminant", "discriminants"],
    plain:
      "For $ax^2 + bx + c = 0$, the number $b^2 - 4ac$ under the square root in the quadratic formula. Positive: two real solutions; zero: one; negative: none.",
    example:
      "$x^2 - 6x + 9 = 0$: $(-6)^2 - 4 \\cdot 1 \\cdot 9 = 0$, so there is one solution, $x = 3$.",
    uses: ["square-root", "quadratic", "solution"],
    band: "algebra-1",
    noLink: ["root"],
  },
  {
    id: "distribute",
    term: "distribute",
    forms: ["distribute", "distributes", "distributing", "distributed"],
    plain:
      "Multiply every term inside parentheses by the factor outside, keeping each sign.",
    example: "$-2(x - 3) = -2x + 6$.",
    uses: ["term-expression", "parentheses", "factor-number"],
    band: "7",
  },
  {
    id: "elimination",
    term: "elimination",
    forms: ["elimination", "elimination method"],
    plain:
      "Solving a system by adding or subtracting its equations, after multiplying if needed, so one variable cancels out.",
    example: "Add $x + y = 7$ and $x - y = 1$ to get $2x = 8$, so $x = 4$.",
    uses: ["system-of-equations", "equation", "variable"],
    band: "8",
  },
  {
    id: "equal-sign",
    term: "equal sign",
    forms: ["equal sign", "equal signs", "equals sign", "equals signs"],
    plain:
      "The sign $=$ says both sides are worth the same amount. It does not mean “write the answer next.”",
    example: "8 = 5 + 3 is true: both sides are worth 8.",
    uses: [],
    band: "1",
    noLink: ["mean", "sides"],
  },
  {
    id: "equation",
    term: "equation",
    forms: ["equation", "equations"],
    plain:
      "Two amounts joined by an equal sign, saying they are worth the same.",
    example: "9 − 1 = 7 + 1 and $346 + 128 = n$ are equations.",
    uses: ["equal-sign"],
    band: "1",
  },
  {
    id: "equivalent-equations",
    term: "equivalent equations",
    forms: ["equivalent equation", "equivalent equations"],
    plain:
      "Equations with exactly the same solutions. Doing the same operation to both sides gives an equivalent equation.",
    example: "$2x + 3 = 11$ and $2x = 8$ both have the solution $x = 4$.",
    uses: ["equation", "side-of-equation", "solution"],
    band: "7",
  },
  {
    id: "equivalent-expressions",
    term: "equivalent expressions",
    forms: ["equivalent expression", "equivalent expressions"],
    plain:
      "Expressions that have the same value for every value of the variable.",
    example:
      "$2(x + 3)$ and $2x + 6$ are equivalent: at $x = 5$, both equal 16.",
    uses: ["expression", "variable", "equivalent"],
    band: "6",
  },
  {
    id: "error-limit",
    term: "error limit",
    forms: ["error limit", "error limits"],
    plain:
      "The largest amount a measurement is allowed to be off from the true amount.",
    example:
      "A reading of 50 grams with an error limit of 2 grams means the true amount is from 48 to 52 grams.",
    uses: ["gram"],
    band: "algebra-1",
  },
  {
    id: "even-function",
    term: "even function",
    forms: ["even function", "even functions"],
    plain:
      "A function with $f(-x) = f(x)$ for every $x$. Its graph matches itself when flipped across the $y$-axis.",
    example: "$f(x) = x^2$ is even: $f(-3) = 9 = f(3)$.",
    uses: ["function", "y-axis"],
    band: "algebra-2",
  },
  {
    id: "even-number",
    term: "even number",
    forms: ["even number", "even numbers"],
    plain:
      "A number that splits into pairs with none left over. Even numbers end in 0, 2, 4, 6 or 8.",
    example: "8 is even: it makes 4 pairs.",
    uses: [],
    band: "2",
  },
  {
    id: "expression",
    term: "expression",
    forms: ["expression", "expressions"],
    plain:
      "Numbers, letters or both joined by operations such as + and ×, with no equal sign. It names an amount; it does not say two things are equal.",
    example: "$5c - 2.50$ and 300 − 90 − 60 are expressions.",
    uses: ["equal-sign"],
    band: "3",
  },
  {
    id: "fact-family",
    term: "fact family",
    forms: ["fact family", "fact families"],
    plain: "The related facts made from the same three numbers.",
    example:
      "3 × 4 = 12, 4 × 3 = 12, 12 ÷ 3 = 4 and 12 ÷ 4 = 3 form a fact family.",
    uses: [],
    band: "3",
  },
  {
    id: "factored-form",
    term: "factored form",
    forms: ["factored form"],
    plain: "An expression written as a product of factors.",
    example: "$(x + 2)(x + 3)$ is the factored form of $x^2 + 5x + 6$.",
    uses: ["expression", "product-multiply", "factor-number"],
    band: "algebra-1",
  },
  {
    id: "factoring-by-grouping",
    term: "factoring by grouping",
    forms: ["factoring by grouping", "factor by grouping"],
    plain:
      "Splitting four terms into two pairs, factoring each pair, then factoring out the binomial both pairs share.",
    example:
      "$x^3 + 2x^2 + 3x + 6 = x^2(x + 2) + 3(x + 2) = (x^2 + 3)(x + 2)$.",
    uses: ["term-expression", "factor-out", "binomial"],
    band: "algebra-1",
  },
  {
    id: "feasible-region",
    term: "feasible region",
    forms: ["feasible region", "feasible regions"],
    plain:
      "The part of a graph where every inequality in a problem is true at once. Each point there is an allowed choice.",
    example:
      "For $x \\ge 0$, $y \\ge 0$ and $x + y \\le 10$, the feasible region is a triangle.",
    uses: ["inequality", "point", "triangle"],
    band: "algebra-1",
    noLink: ["part"],
  },
  {
    id: "finance-charge",
    term: "finance charge",
    forms: ["finance charge", "finance charges"],
    plain:
      "The extra money paid for borrowing: the total paid back minus the amount borrowed.",
    example:
      "Borrow 1,000 dollars and repay 1,150 dollars: the finance charge is 150 dollars.",
    uses: [],
    band: "7",
  },
  {
    id: "greatest-common-factor",
    term: "greatest common factor",
    forms: ["greatest common factor", "greatest common factors", "gcf"],
    plain:
      "The largest number that divides two or more numbers, or every term of an expression, with nothing left over.",
    example: "The greatest common factor of 12 and 18 is 6.",
    uses: ["term-expression", "expression"],
    band: "6",
  },
  {
    id: "horizontal-line",
    term: "horizontal line",
    forms: ["horizontal line", "horizontal lines"],
    plain:
      "A line going straight across. Its equation is $y = c$: every point has the same $y$-coordinate, and the slope is 0.",
    example: "$y = 3$ passes through $(0, 3)$ and $(5, 3)$.",
    uses: ["line", "equation", "point", "coordinate", "slope"],
    band: "algebra-1",
  },
  {
    id: "independent-variable",
    term: "independent variable",
    forms: [
      "independent variable",
      "independent variables",
      "independent quantity",
      "independent quantities",
    ],
    plain:
      "The quantity you choose or change. It is the input, graphed on the horizontal axis.",
    example:
      "Cost depends on the number of tickets, so the number of tickets is the independent variable.",
    uses: ["input", "x-axis"],
    band: "6",
    noLink: ["change"],
  },
  {
    id: "inequality",
    term: "inequality",
    forms: ["inequality", "inequalities"],
    plain:
      "A statement that one amount is less than, greater than, at most or at least another, using $<$, $>$, $\\le$ or $\\ge$.",
    example: "$8.5 + 2.25n \\le 20$ is an inequality.",
    uses: ["less-than", "greater-than", "at-most", "at-least"],
    band: "6",
  },
  {
    id: "intercept",
    term: "intercept",
    forms: ["intercept", "intercepts"],
    plain: "A point where a graph crosses an axis.",
    example:
      "The line $y = 2x + 4$ crosses the $y$-axis at $(0, 4)$ and the $x$-axis at $(-2, 0)$.",
    uses: ["point", "line"],
    band: "8",
  },
  {
    id: "inverse-operation",
    term: "inverse operation",
    forms: ["inverse operation", "inverse operations"],
    plain:
      "The operation that undoes another. Subtraction undoes addition, and division undoes multiplication.",
    example: "7 + 5 = 12, so 12 − 5 = 7.",
    uses: ["addition", "subtraction", "multiplication", "division"],
    band: "3",
  },
  {
    id: "isolate",
    term: "isolate",
    forms: ["isolate", "isolates", "isolated", "isolating"],
    plain:
      "Get the variable by itself on one side of the equation, with everything else on the other side.",
    example: "$3x + 2 = 11$ becomes $3x = 9$, then $x = 3$.",
    uses: ["variable", "side-of-equation", "equation"],
    band: "algebra-1",
  },
  {
    id: "leading-coefficient",
    term: "leading coefficient",
    forms: ["leading coefficient", "leading coefficients"],
    plain:
      "The coefficient of the term with the highest power of the variable.",
    example: "In $-2x^3 + 5x - 1$, the leading coefficient is −2.",
    uses: ["coefficient", "term-expression", "variable"],
    band: "algebra-1",
  },
  {
    id: "liability",
    term: "liability",
    forms: ["liability", "liabilities"],
    plain: "Money you owe, such as a loan or a credit card debt.",
    example: "A 300-dollar credit card bill is a liability.",
    uses: ["loan", "credit-card"],
    band: "7",
  },
  {
    id: "like-terms",
    term: "like terms",
    forms: ["like terms", "like term"],
    plain:
      "Terms with the same variables raised to the same powers, or two plain numbers. Combine them by adding their coefficients.",
    example: "$5x - 2x = 3x$, but $5x$ and $5x^2$ are not like terms.",
    uses: ["term-expression", "variable", "coefficient"],
    band: "6",
  },
  {
    id: "linear-combination",
    term: "linear combination",
    forms: [
      "linear combination",
      "linear combinations",
      "combination of equations",
    ],
    plain:
      "Multiplying each equation by a number, then adding the left sides together and the right sides together.",
    example: "2 times $x + y = 5$, plus $x - 2y = 1$, gives $3x = 11$.",
    uses: ["equation", "side-of-equation"],
    band: "8",
  },
  {
    id: "linear-factor",
    term: "linear factor",
    forms: ["linear factor", "linear factors"],
    plain:
      "A factor of the form $ax + b$, where the variable's highest power is 1.",
    example:
      "$x^2 + 5x + 6 = (x + 2)(x + 3)$ has linear factors $x + 2$ and $x + 3$.",
    uses: ["factor-number", "variable"],
    band: "algebra-1",
  },
  {
    id: "monic",
    term: "monic",
    forms: ["monic"],
    plain: "A polynomial is monic when its leading coefficient is 1.",
    example: "$x^2 - 3x + 2$ is monic; $2x^2 + 1$ is not.",
    uses: ["polynomial", "leading-coefficient"],
    band: "algebra-1",
  },
  {
    id: "monomial",
    term: "monomial",
    forms: ["monomial", "monomials"],
    plain:
      "One term: a number, a variable, or a number times variables with whole-number exponents.",
    example: "$-2x^3$, 5 and $xy$ are monomials.",
    uses: ["term-expression", "variable", "whole-number", "exponent"],
    band: "8",
  },
  {
    id: "multiplicative-rule",
    term: "multiplicative rule",
    forms: ["multiplicative rule", "multiplicative rules"],
    plain:
      "A rule that multiplies every input by the same number, or divides every input by the same number.",
    example: "The rule times 3 turns inputs 1, 2 and 3 into 3, 6 and 9.",
    uses: ["rule", "input"],
    band: "5",
  },
  {
    id: "multiplier",
    term: "multiplier",
    forms: ["multiplier", "multipliers"],
    plain:
      "The number you multiply by. A multiplier above 1 makes an amount bigger; one between 0 and 1 makes it smaller.",
    example: "Multiplier 3 turns 8 into 24; multiplier 0.5 turns 8 into 4.",
    uses: [],
    band: "5",
  },
  {
    id: "negative-exponent",
    term: "negative exponent",
    forms: ["negative exponent", "negative exponents"],
    plain:
      "An exponent below 0. It means 1 over the matching positive power: $x^{-n} = \\frac{1}{x^n}$ for nonzero $x$.",
    example: "$2^{-3} = \\frac{1}{2^3} = \\frac{1}{8}$.",
    uses: ["exponent"],
    band: "8",
  },
  {
    id: "negative-reciprocal",
    term: "negative reciprocal",
    forms: ["negative reciprocal", "negative reciprocals"],
    plain:
      "The reciprocal with the opposite sign. Perpendicular lines have slopes that are negative reciprocals.",
    example:
      "The negative reciprocal of $\\frac{2}{3}$ is $-\\frac{3}{2}$; their product is −1.",
    uses: [
      "reciprocal",
      "opposite-number",
      "perpendicular",
      "slope",
      "product-multiply",
    ],
    band: "algebra-1",
  },
  {
    id: "net-worth",
    term: "net worth",
    forms: ["net worth"],
    plain:
      "What you own minus what you owe: total assets minus total liabilities.",
    example:
      "Assets of 5,000 dollars and liabilities of 1,200 dollars give a net worth of 3,800 dollars.",
    uses: ["asset", "liability"],
    band: "7",
  },
  {
    id: "odd-function",
    term: "odd function",
    forms: ["odd function", "odd functions"],
    plain:
      "A function with $f(-x) = -f(x)$ for every $x$. Turning its graph halfway around the origin gives the same graph.",
    example: "$f(x) = x^3$ is odd: $f(-2) = -8 = -f(2)$.",
    uses: ["function", "origin"],
    band: "algebra-2",
  },
  {
    id: "odd-number",
    term: "odd number",
    forms: ["odd number", "odd numbers"],
    plain:
      "A number that splits into pairs with one left over. Odd numbers end in 1, 3, 5, 7 or 9.",
    example: "7 is odd: it makes 3 pairs with 1 left over.",
    uses: [],
    band: "2",
  },
  {
    id: "open-circle",
    term: "open circle",
    forms: ["open circle", "open circles", "open dot"],
    plain:
      "An empty dot on a number line graph. It shows the boundary number is not a solution, as with $<$ or $>$.",
    example: "$x < 4$ has an open circle at 4 and an arrow pointing left.",
    uses: ["number-line", "boundary", "solution"],
    band: "6",
  },
  {
    id: "order-of-operations",
    term: "order of operations",
    forms: ["order of operations"],
    plain:
      "The agreed order for working out an expression: parentheses first, then multiply and divide from left to right, then add and subtract from left to right.",
    example: "$2 + 3 \\times 4 = 2 + 12 = 14$, not 20.",
    uses: ["expression", "parentheses"],
    band: "3",
  },
  {
    id: "output",
    term: "output",
    forms: ["output", "outputs"],
    plain: "The number a rule gives back after it acts on an input.",
    example: "The rule add 5 turns input 3 into output 8.",
    uses: ["rule", "input"],
    band: "4",
  },
  {
    id: "parentheses",
    term: "parentheses",
    forms: [
      "parentheses",
      "parenthesis",
      "grouping symbol",
      "grouping symbols",
    ],
    plain:
      "The curved marks $(\\;)$ around part of an expression. Work out what is inside them first. Brackets $[\\;]$ do the same job.",
    example: "(2 + 3) × 4 = 5 × 4 = 20.",
    uses: ["expression"],
    band: "3",
    noLink: ["part"],
  },
  {
    id: "pattern",
    term: "pattern",
    forms: ["pattern", "patterns"],
    plain:
      "Shapes or numbers that follow a rule, so you can tell what comes next.",
    example: "2, 5, 8, 11 adds 3 each time, so 14 comes next.",
    uses: ["rule"],
    band: "3",
  },
  {
    id: "perfect-square",
    term: "perfect square",
    forms: [
      "perfect square",
      "perfect squares",
      "square number",
      "square numbers",
    ],
    plain: "A number you get by multiplying one of 0, 1, 2, 3, 4, … by itself.",
    example:
      "49 = 7 × 7, so 49 is a perfect square. So are 1, 4, 9, 16 and 25.",
    uses: [],
    band: "3",
  },
  {
    id: "perfect-square-trinomial",
    term: "perfect square trinomial",
    forms: [
      "perfect square trinomial",
      "perfect square trinomials",
      "squared binomial",
      "squared binomials",
    ],
    plain:
      "A trinomial that equals a binomial times itself. The squared binomial $(x + 3)^2$ multiplies out to $x^2 + 6x + 9$.",
    example: "$x^2 - 10x + 25 = (x - 5)^2$.",
    uses: ["trinomial", "binomial"],
    band: "algebra-1",
  },
  {
    id: "plus-or-minus",
    term: "plus or minus",
    forms: ["plus or minus"],
    plain:
      "The sign $\\pm$ stands for two cases, one with $+$ and one with $-$, so it gives two answers at once.",
    example: "$x = 3 \\pm 2$ means $x = 5$ or $x = 1$.",
    uses: [],
    band: "algebra-1",
  },
  {
    id: "point-slope-form",
    term: "point-slope form",
    forms: ["point-slope form"],
    plain:
      "The equation $y - y_1 = m(x - x_1)$ of the line through the point $(x_1, y_1)$ with slope $m$.",
    example: "Through $(2, 5)$ with slope 3: $y - 5 = 3(x - 2)$.",
    uses: ["equation", "line", "point", "slope"],
    band: "algebra-1",
  },
  {
    id: "polynomial",
    term: "polynomial",
    forms: ["polynomial", "polynomials"],
    plain:
      "A sum of terms, each a number times a variable raised to a whole-number power. Plain numbers count as terms too.",
    example:
      "$x^2 - 5x + 6$ is a polynomial; $\\frac{1}{x}$ and $\\sqrt{x}$ are not.",
    uses: ["sum", "term-expression", "variable", "whole-number"],
    band: "algebra-1",
  },
  {
    id: "principal-square-root",
    term: "principal square root",
    forms: [
      "principal square root",
      "principal square roots",
      "principal root",
    ],
    plain:
      "The square root that is not negative. For a number $a$ that is not negative, $\\sqrt{a}$ always means this root.",
    example: "$\\sqrt{25} = 5$, not −5, even though $(-5)^2 = 25$ too.",
    uses: ["square-root", "root-radical", "negative-number"],
    band: "algebra-1",
  },
  {
    id: "quadratic",
    term: "quadratic",
    forms: ["quadratic", "quadratics"],
    plain:
      "An expression, equation or function whose highest power of the variable is 2, as in $ax^2 + bx + c$ with $a \\ne 0$.",
    example: "$x^2 - 4x + 3$ and $2x^2 = 18$ are quadratic.",
    uses: ["expression", "equation", "function", "variable"],
    band: "algebra-1",
  },
  {
    id: "rate",
    term: "rate",
    forms: ["rate", "rates"],
    plain:
      "A comparison of two quantities with different units, often given as an amount for one unit, such as 60 miles per hour.",
    example: "Reading 30 pages in 10 minutes is a rate of 3 pages per minute.",
    uses: ["unit"],
    band: "6",
  },
  {
    id: "rate-of-change",
    term: "rate of change",
    forms: ["rate of change", "rates of change"],
    plain:
      "How much one quantity changes for each 1 unit of another: the change in output divided by the change in input.",
    example:
      "Pay goes from 20 dollars to 50 dollars as hours go from 2 to 5: (50 − 20) ÷ (5 − 2) = 10 dollars per hour.",
    uses: ["unit", "output", "input"],
    band: "8",
    noLink: ["change", "changes"],
  },
  {
    id: "rational-expression",
    term: "rational expression",
    forms: ["rational expression", "rational expressions"],
    plain:
      "A fraction with a polynomial on the top and on the bottom. It is undefined where the bottom equals 0.",
    example: "$\\frac{x + 1}{x - 3}$ is undefined at $x = 3$.",
    uses: ["fraction", "polynomial"],
    band: "algebra-1",
  },
  {
    id: "rebate",
    term: "rebate",
    forms: ["rebate", "rebates"],
    plain: "Money paid back to you after you buy something.",
    example:
      "Pay 80 dollars and get a 15-dollar rebate: the item costs 65 dollars in the end.",
    uses: [],
    band: "7",
  },
  {
    id: "repeated-root",
    term: "repeated root",
    forms: ["repeated root", "repeated roots", "double root", "double roots"],
    plain:
      "A root that comes from two or more equal factors. It counts as only one different solution.",
    example: "$(x - 3)^2 = 0$ has the repeated root 3.",
    uses: ["root-equation", "factor-number", "solution"],
    band: "algebra-1",
  },
  {
    id: "reverse-inequality-sign",
    term: "reverse the inequality sign",
    forms: [
      "reverse the sign",
      "reverse the inequality sign",
      "flip the inequality sign",
    ],
    plain:
      "Turn the inequality sign around: $<$ becomes $>$, and $\\le$ becomes $\\ge$. Do this when you multiply or divide both sides by a negative number.",
    example: "$-2x < 6$: dividing by −2 gives $x > -3$.",
    uses: ["inequality", "side-of-equation", "negative-number"],
    band: "7",
  },
  {
    id: "right-triangle",
    term: "right triangle",
    forms: ["right triangle", "right triangles"],
    plain: "A triangle with one right angle: a square corner of 90 degrees.",
    example: "A triangle with sides 3 cm, 4 cm and 5 cm is a right triangle.",
    uses: ["triangle", "right-angle", "corner", "degree-angle", "side"],
    band: "4",
    noLink: ["square"],
  },
  {
    id: "root-equation",
    term: "root",
    forms: ["root", "roots"],
    plain:
      "A value of the variable that makes an equation true. For a polynomial, a root is an input that makes it equal 0.",
    example: "$x^2 - 5x + 6 = 0$ has roots 2 and 3.",
    uses: ["variable", "equation", "polynomial", "input"],
    band: "algebra-1",
    autoLink: false,
  },
  {
    id: "root-radical",
    term: "root",
    forms: ["root", "roots"],
    plain:
      "A number that, used as a factor a given number of times, makes another number. A square root uses 2 factors; a cube root uses 3.",
    example: "3 is the cube root of 27, because 3 × 3 × 3 = 27.",
    uses: ["factor-number", "square-root", "cube-root"],
    band: "8",
    autoLink: false,
  },
  {
    id: "row-operation",
    term: "row operation",
    forms: ["row operation", "row operations"],
    plain:
      "A step on a system of equations, such as replacing one equation with itself plus a multiple of another. It keeps the solutions the same.",
    example:
      "$R_2 \\to R_2 - 3R_1$ replaces equation 2 with equation 2 minus 3 times equation 1.",
    uses: ["system-of-equations", "equation", "multiple", "solution"],
    band: "8",
  },
  {
    id: "rule",
    term: "rule",
    forms: ["rule", "rules"],
    plain:
      "What you do to one number to get the next, or to the first number of a pair to get the second.",
    example: "Start at 2 and add 3: 2, 5, 8, 11.",
    uses: [],
    band: "3",
    autoLink: false,
  },
  {
    id: "slope",
    term: "slope",
    forms: ["slope", "slopes"],
    plain:
      "How steep a line is: the change in $y$ divided by the change in $x$ between any two of its points. Positive slopes rise left to right.",
    example: "From $(1, 2)$ to $(3, 8)$: slope $= \\frac{8 - 2}{3 - 1} = 3$.",
    figure: "slope-rise-run",
    uses: ["line", "point"],
    band: "8",
    noLink: ["change"],
  },
  {
    id: "slope-intercept-form",
    term: "slope-intercept form",
    forms: ["slope-intercept form"],
    plain:
      "The equation $y = mx + b$ of a line, where $m$ is the slope and $b$ is the $y$-intercept.",
    example: "$y = 2x - 3$ has slope 2 and $y$-intercept −3.",
    uses: ["equation", "line", "slope", "y-intercept", "intercept"],
    band: "8",
  },
  {
    id: "solution",
    term: "solution",
    forms: ["solution", "solutions"],
    plain: "A value of the variable that makes an equation or inequality true.",
    example: "$x = 4$ is a solution of $2x + 1 = 9$, because 2 × 4 + 1 = 9.",
    uses: ["variable", "equation", "inequality"],
    band: "6",
  },
  {
    id: "solution-of-a-system",
    term: "solution of a system",
    forms: [
      "solution of a system",
      "solutions of a system",
      "solution of the system",
    ],
    plain:
      "A pair of values $(x, y)$ that makes every equation in a system true at once. On a graph, it is where the lines cross.",
    example: "$(3, 1)$ solves both $x + y = 4$ and $x - y = 2$.",
    uses: ["system-of-equations", "equation", "line"],
    band: "8",
  },
  {
    id: "solution-set",
    term: "solution set",
    forms: ["solution set", "solution sets"],
    plain:
      "All the values that make an equation or inequality true, and no others.",
    example: "The solution set of $x + 1 > 5$ is every number greater than 4.",
    uses: ["equation", "inequality", "greater-than"],
    band: "7",
  },
  {
    id: "standard-form-line",
    term: "standard form",
    forms: ["standard form"],
    plain:
      "A line's equation written as $Ax + By = C$, with integers $A$, $B$ and $C$ sharing no common factor, usually with $A$ positive.",
    example: "$y = \\frac{2}{3}x + 1$ in standard form is $2x - 3y = -3$.",
    uses: ["line", "equation", "integer", "common-factor"],
    band: "algebra-1",
    autoLink: false,
  },
  {
    id: "standard-form-number",
    term: "standard form",
    forms: ["standard form"],
    plain: "A number written the usual way, with digits.",
    example: "4,000 + 200 + 5 in standard form is 4,205.",
    uses: ["digit"],
    band: "2",
    autoLink: false,
  },
  {
    id: "standard-form-polynomial",
    term: "standard form",
    forms: ["standard form"],
    plain:
      "A polynomial written with its highest power first and its constant term last. A quadratic in standard form is $ax^2 + bx + c$.",
    example: "$5x + x^2 + 6$ in standard form is $x^2 + 5x + 6$.",
    uses: ["polynomial", "constant-term", "quadratic"],
    band: "algebra-1",
    autoLink: false,
  },
  {
    id: "strict-inequality",
    term: "strict inequality",
    forms: ["strict inequality", "strict inequalities"],
    plain:
      "An inequality using $<$ or $>$. The boundary number itself is not a solution.",
    example: "For $x < 5$, 4.9 works but 5 does not.",
    uses: ["inequality", "boundary", "solution"],
    band: "7",
  },
  {
    id: "substitute",
    term: "substitute",
    forms: [
      "substitute",
      "substitutes",
      "substituting",
      "substituted",
      "substitution",
    ],
    plain:
      "Replace a variable with a number or expression that has the same value.",
    example: "Substituting $x = 3$ into $2x + 1$ gives 2 × 3 + 1 = 7.",
    uses: ["variable", "expression"],
    band: "6",
  },
  {
    id: "sum",
    term: "sum",
    forms: ["sum", "sums"],
    plain: "The answer when you add numbers together.",
    example: "The sum of 6 and 3 is 9, because 6 + 3 = 9.",
    uses: [],
    band: "1",
  },
  {
    id: "sum-or-difference-of-cubes",
    term: "sum or difference of cubes",
    forms: [
      "sum of cubes",
      "difference of cubes",
      "sum or difference of cubes",
      "sums of cubes",
      "differences of cubes",
      "sum of two cubes",
      "difference of two cubes",
    ],
    plain:
      "Two cubed quantities added or subtracted. A sum of cubes factors as $u^3 + v^3 = (u + v)(u^2 - uv + v^2)$.",
    example:
      "A difference of cubes factors as $u^3 - v^3 = (u - v)(u^2 + uv + v^2)$, so $x^3 - 8 = (x - 2)(x^2 + 2x + 4)$.",
    uses: [],
    band: "algebra-1",
    noLink: ["factors"],
  },
  {
    id: "system-of-equations",
    term: "system of equations",
    forms: [
      "system of equations",
      "systems of equations",
      "linear system",
      "linear systems",
    ],
    plain:
      "Two or more equations that must all be true for the same values of the variables.",
    example:
      "$x + y = 10$ and $x - y = 2$ form a system; $x = 6$, $y = 4$ makes both true.",
    uses: ["equation", "variable"],
    band: "8",
  },
  {
    id: "tax-bracket",
    term: "tax bracket",
    forms: ["tax bracket", "tax brackets"],
    plain:
      "A slice of income taxed at one rate. Income in a higher slice is taxed at that slice's higher rate.",
    example:
      "With 10% on the first 10,000 dollars and 12% above that, 15,000 dollars owes 1,000 + 600 = 1,600 dollars.",
    uses: ["income", "rate", "percent"],
    band: "7",
  },
  {
    id: "taxable-income",
    term: "taxable income",
    forms: ["taxable income"],
    plain:
      "The part of income that is taxed: income minus allowed subtractions such as the standard deduction.",
    example:
      "Income of 40,000 dollars minus a 14,000-dollar deduction leaves 26,000 dollars of taxable income.",
    uses: ["income", "deduction"],
    band: "7",
    noLink: ["part", "leaves"],
  },
  {
    id: "term-expression",
    term: "term",
    forms: ["term", "terms"],
    plain:
      "One part of an expression joined to the rest by $+$ or $-$: a number, a variable, or numbers and variables multiplied together.",
    example: "In $4x + 9y - 2$, the terms are $4x$, $9y$ and −2.",
    uses: ["expression", "variable"],
    band: "6",
    autoLink: false,
    noLink: ["part"],
  },
  {
    id: "term-sequence",
    term: "term",
    forms: ["term", "terms"],
    plain:
      "One number in a number pattern. The first number is the 1st term, the next is the 2nd term, and so on.",
    example: "In 3, 7, 11, 15, the 3rd term is 11.",
    uses: ["pattern"],
    band: "4",
    autoLink: false,
  },
  {
    id: "trinomial",
    term: "trinomial",
    forms: ["trinomial", "trinomials"],
    plain: "A polynomial with exactly three terms.",
    example: "$x^2 + 5x + 6$ is a trinomial.",
    uses: ["polynomial", "term-expression"],
    band: "algebra-1",
  },
  {
    id: "true-equation",
    term: "true equation",
    forms: [
      "true equation",
      "true equations",
      "false equation",
      "false equations",
    ],
    plain:
      "An equation is true when both sides are worth the same amount, and false when they are not.",
    example: "9 − 1 = 7 + 1 is true; 9 − 1 = 7 is false.",
    uses: ["equation"],
    band: "1",
    noLink: ["sides"],
  },
  {
    id: "variable",
    term: "variable",
    forms: ["variable", "variables"],
    plain:
      "A letter that stands for a number you do not know yet, or for a quantity that can change.",
    example: "In $n + 4 = 10$, the variable $n$ stands for 6.",
    uses: [],
    band: "3",
    noLink: ["change"],
  },
  {
    id: "vertical-line",
    term: "vertical line",
    forms: ["vertical line", "vertical lines"],
    plain:
      "A line going straight up and down. Its equation is $x = c$: every point has the same $x$-coordinate, and the slope is undefined.",
    example: "$x = -2$ passes through $(-2, 0)$ and $(-2, 5)$.",
    uses: ["line", "equation", "point", "coordinate", "slope"],
    band: "algebra-1",
  },
  {
    id: "withdrawal",
    term: "withdrawal",
    forms: ["withdrawal", "withdrawals"],
    plain:
      "Money taken out of an account. It lowers the balance, so it is recorded as a negative amount.",
    example:
      "A 30-dollar withdrawal lowers a 100-dollar balance to 70 dollars.",
    uses: ["balance-account", "negative-number"],
    band: "6",
  },
  {
    id: "y-intercept",
    term: "$y$-intercept",
    forms: ["y-intercept", "y-intercepts"],
    plain:
      "Where a graph crosses the $y$-axis. There $x = 0$, so the point is $(0, b)$, and $b$ is the $y$-intercept.",
    example:
      "$y = 2x + 3$ crosses the $y$-axis at $(0, 3)$, so its $y$-intercept is 3.",
    uses: ["y-axis", "point", "intercept"],
    band: "8",
  },
  {
    id: "zero-of-a-function",
    term: "zero of a function",
    forms: [
      "zero of a function",
      "zeros of a function",
      "zero of an expression",
      "zeros of an expression",
      "zero of a polynomial",
      "zeros of a polynomial",
    ],
    plain:
      "An input that makes a function, polynomial or expression equal 0. On a graph, it is where the curve meets the $x$-axis.",
    example:
      "$f(x) = x^2 - 4$ has zeros −2 and 2, because $f(-2) = 0$ and $f(2) = 0$.",
    uses: ["input", "function", "polynomial", "expression", "x-axis"],
    band: "algebra-1",
  },
];
