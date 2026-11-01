import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const satSenses = {
  factor: "factor-number",
  factors: "factor-number",
  product: "product-multiply",
  products: "product-multiply",
  root: "root-equation",
  roots: "root-equation",
  side: "side-of-equation",
  sides: "side-of-equation",
  square: "square-number",
  squares: "square-number",
  squared: "square-number",
  term: "term-expression",
  terms: "term-expression",
  difference: "difference-subtract",
  differences: "difference-subtract",
  vertex: "vertex-parabola",
  interval: "interval",
  multiple: "multiple",
  multiples: "multiple",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
  "one third": "third",
};
const satNoLink = [
  "part",
  "parts",
  "whole",
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

export const satAlgebraStructureMethods: Record<string, ProblemMethod> = {
  "quadratic-root-relations": {
    goal: "Find the sum or product of a quadratic's solutions, or a coefficient or second solution, without solving it.",
    intuition:
      "A quadratic equation $ax^2 + bx + c = 0$ has an $x^2$ part ($x$ times $x$), with $a \\ne 0$ ($\\ne$ means is not equal to). The numbers $a$, $b$ and $c$ are its coefficients, the numbers in front of each term (each part joined by $+$ or $-$). A solution is a value of $x$ that makes it true. If the solutions are $p$ and $q$, the equation can be written $a(x - p)(x - q) = 0$, because each bracket is 0 at one solution. Multiplying out gives $ax^2 - a(p + q)x + apq = 0$. Matching the numbers shows $p + q = -\\frac{b}{a}$ and $pq = \\frac{c}{a}$, where $pq$ means $p$ times $q$.",
    terms: ["solution", "coefficient"],
    senses: satSenses,
    noLink: satNoLink,
    method: [
      "An equation has two sides: the parts left and right of the equals sign. Make one side 0, so the equation reads $ax^2 + bx + c = 0$. Read $a$, $b$ and $c$ with their signs.",
      "The solutions $p$ and $q$ have sum $p + q = -\\frac{b}{a}$. Their product, the result of multiplying them, is $pq = \\frac{c}{a}$.",
      "Rewrite what is asked using only $p + q$ and $pq$. For example, $p^2 + q^2 = (p + q)^2 - 2pq$, and $\\frac{1}{p} + \\frac{1}{q} = \\frac{p + q}{pq}$ when neither solution is 0.",
      "If one solution is given, subtract it from the sum to get the other. Or put it into the equation to find a missing coefficient.",
    ],
    watch:
      "The sum is $-\\frac{b}{a}$, not $\\frac{b}{a}$, and both rules divide by $a$. When $a \\ne 1$, the sum is not $-b$ and the product is not $c$.",
  },
  "system-expression-value": {
    goal: "Find the value of an expression in $x$ and $y$ by combining the given equations, without finding $x$ and $y$.",
    intuition:
      "An equation like $3x + 2y = 7$ says two sides are equal. Multiplying both sides by the same number keeps them equal. Adding two true equations, left side to left side and right side to right side, gives another true equation. So you can multiply each equation by a number, called a multiplier, and add. When the new left side is the expression you want, the new right side is its value. You never need $x$ or $y$ on their own.",
    terms: [
      "linear-combination",
      ["multiplier", "Here it multiplies both sides of a whole equation."],
    ],
    senses: satSenses,
    noLink: satNoLink,
    method: [
      "Compare the number in front of $x$ in the expression you want with those in the equations. Find multipliers $u$ and $v$ that build it.",
      "Check that the same multipliers also build the number in front of $y$.",
      "Multiply each right side by its multiplier and add. That total is the expression's value.",
      "If the equations describe one line, the expression may be the left side times a number. Then multiply the right side by the same number, even though $x$ and $y$ are not fixed.",
    ],
    watch:
      "Multiply the right side by the same number as the left side, and use each multiplier on its own equation only. Multiply each right side by its own multiplier before adding.",
  },
  "variation-constant": {
    goal: "For direct or inverse variation, find the constant, predict a value, pick the matching equation or table, or find a change.",
    intuition:
      "Two quantities vary directly when one is always the same number times the other, like pay and hours at a fixed hourly wage. Doubling one doubles the other. The rule is $y = kx$, and $k = \\frac{y}{x}$. Two quantities vary inversely when their product (the result of multiplying them) stays the same, like how fast you go and how long it takes on a fixed trip. Doubling one halves the other. The rule is $y = \\frac{k}{x}$, and $k = xy$. In both cases the number $k$ is called the constant of variation.",
    terms: [
      "proportional-relationship",
      "inverse-variation",
      [
        "constant-of-proportionality",
        "For $y = \\frac{k}{x}$ (inverse variation), $k$ is the product $xy$ instead.",
      ],
    ],
    senses: satSenses,
    noLink: satNoLink,
    method: [
      "Decide which kind it is from the words, or from a table. The same $\\frac{y}{x}$ in every row means direct. The same $xy$ in every row means inverse.",
      "Use one known pair to find $k$: $k = \\frac{y}{x}$ for direct, $k = xy$ for inverse.",
      "Put the new input, the starting value, into $y = kx$ or $y = \\frac{k}{x}$. Or find the number the input was multiplied by.",
      "Check the direction. When $k$ and the values are positive, direct variation moves both quantities the same way, and inverse variation moves them opposite ways.",
    ],
    watch:
      "Variation is about multiplying, not adding the same amount to both. A rule like $y = 3x + 2$ is neither kind, because both $\\frac{y}{x}$ and $xy$ change.",
  },
  "rate-combination-model": {
    goal: "Combine steady rates: shared work, filling while draining, mixing solutions, average speed over equal distances, or a rate that changes.",
    intuition:
      "A rate is an amount per unit of time. A painter who finishes a fence in 4 hours paints $\\frac{1}{4}$ of it each hour. Rates working together add, and a rate working against another subtracts. Times for sharing one job do not combine like that, so change them into rates or totals first. The concentration of a mixture is the amount of pure substance divided by the total amount.",
    terms: ["rate", "concentration", "average-speed"],
    senses: satSenses,
    noLink: satNoLink,
    method: [
      "Name what is measured. Write each given as an amount per unit of time, or as an amount of the pure substance.",
      "Combine. Add rates working together and subtract a rate working against. For a mixture, add the amounts of pure substance. For a trip, add the distances and add the times.",
      "Solve for the unknown: time = amount ÷ rate, concentration = pure amount ÷ total amount, average speed = total distance ÷ total time.",
      "Check that it makes sense. A shared job takes less time than either worker alone. An average speed lies between the two speeds.",
    ],
    watch:
      "Do not simply average concentrations or speeds unless the amounts or times are equal. Weight a mixture by its volumes, and find speed as total distance ÷ total time.",
  },
  "absolute-compound-inequality": {
    goal: "Choose the solution set of an absolute-value or compound inequality, or the inequality that describes a set on a number line.",
    intuition:
      "The absolute value $|E|$ is how far $E$ is from 0, so it is never negative: $|-3| = 3$. The sign $<$ means less than and $>$ means greater than. So $|E| < 7$ means $E$ is less than 7 away from 0, between $-7$ and $7$. And $|E| > 7$ means $E$ is more than 7 away: below $-7$ or above $7$. A compound inequality joins two conditions. “And” means both are true. “Or” means at least one is true.",
    terms: ["absolute-value", "compound-inequality"],
    senses: satSenses,
    noLink: satNoLink,
    method: [
      "For $|E| < c$ with $c > 0$, write $-c < E < c$. For $|E| > c$, write $E < -c$ or $E > c$.",
      "Solve every part the same way. Flip the inequality sign, which means turn $<$ into $>$ or $>$ into $<$, whenever you multiply or divide by a negative number.",
      "“And” keeps only the overlap. “Or” keeps both pieces. An endpoint is left out for $<$ or $>$ and included for $\\le$ or $\\ge$ (less than or equal, greater than or equal).",
      "To go from a number line to $|x - m|$, use the middle point as $m$ and its distance to either endpoint as the radius.",
    ],
    watch:
      "Check the sign of $c$ first. If $c < 0$, $|E| < c$ has no solutions and $|E| > c$ is true for every number. For $|E| > c$ with $c > 0$, “or” joins the two outer pieces. It does not mean the numbers between them.",
  },
  "quadratic-from-data": {
    goal: "Choose the quadratic equation fixed by two zeros and a point, a vertex and a point, an evenly spaced table, or three points.",
    intuition:
      "A rule like $y = ax^2 + bx + c$, with $a \\ne 0$, is called a quadratic. It has three unknown numbers, so it usually takes three facts that fit together to fix it. Its graph is a U-shaped curve called a parabola. A zero is an $x$-value where $y = 0$. Two zeros $p$ and $q$ give the form $y = a(x - p)(x - q)$. The vertex is the turning point; a vertex $(h, k)$ gives $y = a(x - h)^2 + k$. One more point, other than the zeros or the vertex, then fixes $a$, which sets how steep and which way up the curve is.",
    terms: ["zero-of-a-function", "vertex-parabola", "second-difference"],
    senses: satSenses,
    noLink: satNoLink,
    method: [
      "Choose the form that fits the facts: $y = a(x - p)(x - q)$ for zeros $p$ and $q$, $y = a(x - h)^2 + k$ for vertex $(h, k)$, or $y = ax^2 + bx + c$ for a table or points.",
      "For factored form (the form $a(x - p)(x - q)$) or vertex form (the form $a(x - h)^2 + k$), put the extra point into it and solve for $a$. For a table with equal steps $h$, use $a = \\frac{\\text{second difference}}{2h^2}$.",
      "For $y = ax^2 + bx + c$ with three points, write three equations. Subtract pairs to remove $c$, solve for $a$ and $b$, then find $c$.",
      "Check every given point in the finished equation, including the sign in each bracket.",
    ],
    watch:
      "A zero at $x = r$ comes from the bracket $(x - r)$, so the sign inside is opposite to the number. The zeros or vertex alone never fix $a$.",
  },
};

export const satAlgebraStructurePrinciples: Record<string, string> = {
  "quadratic-root-relations":
    "Let $a \\ne 0$, and let $ax^2 + bx + c = 0$ have real solutions $p$ and $q$ (a repeated solution counted twice). Then $ax^2 + bx + c = a(x - p)(x - q) = ax^2 - a(p + q)x + apq$, so $p + q = -\\frac{b}{a}$ and $pq = \\frac{c}{a}$. Real solutions exist exactly when $b^2 - 4ac \\ge 0$. For example, $p^2 + q^2 = (p + q)^2 - 2pq$.",
  "system-expression-value":
    "If $a_1x + b_1y = c_1$ and $a_2x + b_2y = c_2$ are true, then $u(a_1x + b_1y) + v(a_2x + b_2y) = uc_1 + vc_2$ for any numbers $u$ and $v$. So if the target $Ax + By$ has $A = ua_1 + va_2$ and $B = ub_1 + vb_2$, its value is $uc_1 + vc_2$, even when $x$ and $y$ are not fixed.",
  "variation-constant":
    "$y$ varies directly with $x$ when $y = kx$ for a constant $k \\ne 0$. Then $\\frac{y}{x} = k$ for $x \\ne 0$, and multiplying $x$ by a number multiplies $y$ by the same number. $y$ varies inversely with $x$ when $y = \\frac{k}{x}$ with $k \\ne 0$ and $x \\ne 0$. Then $xy = k$, and multiplying $x$ by a number $f \\ne 0$ multiplies $y$ by $\\frac{1}{f}$.",
  "rate-combination-model":
    "For steady rates, amount = rate × time. Rates $r_1$ and $r_2$ on one task give $r_1 + r_2$ together and $r_1 - r_2$ against each other. Mixing volumes $V_1$ and $V_2$ of concentrations $c_1$ and $c_2$ gives concentration $\\frac{c_1V_1 + c_2V_2}{V_1 + V_2}$. Average speed is total distance ÷ total time, which is $\\frac{2uv}{u + v}$ for equal distances at speeds $u$ and $v$.",
  "absolute-compound-inequality":
    "For a real number $E$ and $c > 0$: $|E| < c$ means $-c < E < c$, and $|E| > c$ means $E < -c$ or $E > c$. The same holds with $\\le$ and $\\ge$. For $c < 0$, $|E| < c$ has no solution and $|E| > c$ is always true. Multiplying or dividing an inequality by a negative number reverses it.",
  "quadratic-from-data":
    "A quadratic function, a rule that turns each $x$ into one $y$, is $y = ax^2 + bx + c$ with $a \\ne 0$. With zeros $p$ and $q$ it equals $a(x - p)(x - q)$. With vertex $(h, k)$ it equals $a(x - h)^2 + k$. Three points with different $x$-values that are not on one line fix exactly one quadratic. For $x$-values with equal step $h$, the second difference of the $y$-values is $2ah^2$.",
};

export const satAlgebraStructureLessons: Lesson[] = [
  {
    id: "quadratic-root-relations",
    title: "Solutions of a quadratic from its coefficients",
    summary:
      "The values of $x$ that make an equation true are called its solutions. The equation $x^2 - 5x + 6 = 0$ has solutions 2 and 3. Their sum is 5 and their product (the result of multiplying) is 6. The sum is the opposite of the $-5$ in front of $x$, and the product is the 6 at the end. When the number in front of $x^2$ is 1 and the solutions are on the number line, that always happens (a repeated solution counts twice). With other numbers you divide by it first, so you can still find the sum and product without solving.",
    templateIds: ["quadratic-root-relations"],
    senses: satSenses,
    noLink: satNoLink,
    objectives: [
      "Find the sum and product of the solutions from the coefficients $a$, $b$ and $c$.",
      "Rewrite an expression in the solutions, such as $p^2 + q^2$, using only their sum and product.",
      "Find a missing coefficient, or the second solution, from one known solution.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Solutions are built from the coefficients",
        paragraphs: [
          "A quadratic equation has an $x^2$ part ($x$ times $x$) and no higher power. We write it as $ax^2 + bx + c = 0$, with $a \\ne 0$ ($\\ne$ means is not equal to). The numbers $a$, $b$ and $c$ are its coefficients. A solution is a value of $x$ that makes the equation true.",
          "Start with numbers. $(x - 2)(x - 3) = 0$ has solutions 2 and 3, because each makes one bracket 0. Multiplying out gives $x^2 - 3x - 2x + 6 = x^2 - 5x + 6$. The middle number, $-5$, is minus the sum $2 + 3$. The last number, 6, is the product $2 \\times 3$.",
          "Now use letters. If the solutions are $p$ and $q$, the equation can be written $a(x - p)(x - q) = 0$. Multiplying out gives $ax^2 - a(p + q)x + apq = 0$, where $pq$ means $p$ times $q$.",
          "Match this with $ax^2 + bx + c = 0$. The $x$ terms, the parts with $x$, match, so $-a(p + q) = b$, which gives $p + q = -\\frac{b}{a}$. The last numbers match, so $apq = c$, which gives $pq = \\frac{c}{a}$. So the sum and product are known from the coefficients, even when the solutions are messy.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The solutions of $2x^2-12x+9=0$ are $p$ and $q$. Find $p^2+q^2$ without solving for $p$ and $q$.",
      steps: [
        "Read the coefficients: $a = 2$, $b = -12$, $c = 9$. Check there are two real solutions: the discriminant $b^2 - 4ac = 144 - 72 = 72$ is positive.",
        "Find the sum and product: $p + q = -\\frac{b}{a} = -\\frac{-12}{2} = 6$, and $pq = \\frac{c}{a} = \\frac{9}{2}$.",
        "Write $p^2 + q^2$ using them. Multiplying out $(p + q)^2$ gives $p^2 + 2pq + q^2$. So $p^2 + q^2 = (p + q)^2 - 2pq = 36 - 2 \\times \\frac{9}{2} = 36 - 9 = 27$.",
        "Check with the actual solutions, $3 \\pm \\frac{3\\sqrt{2}}{2}$, where $\\pm$ stands for “plus or minus”. Their squares are $9 \\pm 9\\sqrt{2} + \\frac{9}{2}$. Adding the two, the $\\sqrt{2}$ parts cancel: $2\\left(9 + \\frac{9}{2}\\right) = 27$.",
      ],
      answer: "$27$",
    },
    closingSections: [
      {
        stage: "method",
        title: "One method for every question",
        keepTogetherInPrint: true,
        paragraphs: [
          "Always start from $p + q = -\\frac{b}{a}$ and $pq = \\frac{c}{a}$. A question about the sum or product reads them directly.",
          "A question about $p^2 + q^2$ or $\\frac{1}{p} + \\frac{1}{q}$ is rewritten first: $p^2 + q^2 = (p + q)^2 - 2pq$, and, when neither is 0, $\\frac{1}{p} + \\frac{1}{q} = \\frac{p + q}{pq}$ (adding fractions over the common bottom $pq$).",
          "If one solution is known, the other is the sum minus it. If a coefficient is missing, put the known solution into the equation and solve for the missing number.",
        ],
      },
      {
        stage: "formal",
        title: "Why the relations hold",
        paragraphs: [
          "For $a \\ne 0$ and real solutions $p$ and $q$ (a repeated solution counted twice), $ax^2 + bx + c = a(x - p)(x - q)$. Multiplying out and matching coefficients gives $p + q = -\\frac{b}{a}$ and $pq = \\frac{c}{a}$. Real solutions exist exactly when $b^2 - 4ac \\ge 0$ ($\\ge$ means greater than or equal to).",
          "Any expression that stays the same when $p$ and $q$ swap places can be written using $p + q$ and $pq$. That is why these questions can be answered from the coefficients alone.",
        ],
      },
    ],
    pitfalls: [
      "The sum is $-\\frac{b}{a}$. Keep the minus sign, and divide by $a$ when $a \\ne 1$.",
      "$p^2 + q^2$ is not $(p + q)^2$. Subtract $2pq$.",
      "Check the discriminant when the question needs real solutions.",
    ],
    parentGuide:
      "Ask the learner why $x^2 - 5x + 6 = 0$, with solutions 2 and 3, has sum 5 and product 6, and how those match the coefficients $-5$ and 6.",
  },
  {
    id: "system-expression-value",
    title: "The value of an expression from linear equations",
    summary:
      "Suppose $3x + 2y = 7$ and $x + 4y = 9$, and you want $4x + 6y$. Add the two equations, left to left and right to right: $4x + 6y = 16$. You never had to find $x$ or $y$. In general, multiply each equation by a number and add, until the left side is the expression you want. The right side is then its value.",
    templateIds: ["system-expression-value"],
    senses: satSenses,
    noLink: satNoLink,
    objectives: [
      "Find the numbers to multiply two equations by so that they build the expression you want.",
      "Multiply the right sides by the same numbers, and add.",
      "Recognize when $x$ and $y$ cannot be found but the expression's value is still fixed.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A combination of true equations is true",
        paragraphs: [
          "An equation like $3x + 2y = 7$ says the two sides are equal. Writing $3x$ means 3 times $x$. The number in front of a letter is called its coefficient.",
          "If you multiply both sides of a true equation by the same number, they stay equal. If you add two true equations, left side to left side and right side to right side, the result is true again.",
          "So you can build the expression you want on the left. The number you get on the right is its value. You never need to find $x$ or $y$ by themselves.",
          "A number you multiply a whole equation by is called a multiplier. Multiplying equations by numbers and adding them like this is called a linear combination.",
        ],
      },
    ],
    workedExample: {
      prompt: "If $3x+2y=7$ and $x+4y=9$, what is the value of $5x+10y$?",
      steps: [
        "Look for multipliers $u$ and $v$ so that $u$ times the first left side plus $v$ times the second gives $5x + 10y$: $u(3x + 2y) + v(x + 4y) = 5x + 10y$.",
        "Match the numbers in front of $x$: $3u + v = 5$. Match the numbers in front of $y$: $2u + 4v = 10$. Trying $u = 1$ and $v = 2$ works for both: $3 + 2 = 5$ and $2 + 8 = 10$.",
        "Use the same multipliers on the right sides and add: $1 \\times 7 + 2 \\times 9 = 7 + 18 = 25$.",
        "Check by solving: $x = 1$ and $y = 2$ make both equations true, and $5 \\times 1 + 10 \\times 2 = 25$.",
      ],
      answer: "$25$",
    },
    closingSections: [
      {
        stage: "method",
        title: "When the variables cannot be found separately",
        keepTogetherInPrint: true,
        paragraphs: [
          "Suppose only $6x + 9y = 12$ is given, and you want $2x + 3y$. Each coefficient of the target is one third of the equation's, so its value is one third of 12, which is 4. Many pairs $(x, y)$ make the equation true, but every one gives $2x + 3y = 4$.",
          "Two equations can also describe the same line, such as $4x + 6y = 10$ and $6x + 9y = 15$. Then $x$ and $y$ are not fixed, but any expression that is a multiple of $2x + 3y$ is fixed. If the $x$ and $y$ parts of the expression you want are not a multiple of the left side, its value is not fixed.",
        ],
      },
      {
        stage: "formal",
        title: "Why the method is exact",
        paragraphs: [
          "If $a_1x + b_1y = c_1$ and $a_2x + b_2y = c_2$ are true, then $u(a_1x + b_1y) + v(a_2x + b_2y) = uc_1 + vc_2$ for any numbers $u$ and $v$. The small numbers written low are labels for the two equations.",
          "When the target is $Ax + By$ with $A = ua_1 + va_2$ and $B = ub_1 + vb_2$, its value is $uc_1 + vc_2$. When $a_1b_2 - a_2b_1 \\ne 0$, such multipliers exist for every target. When the left sides are multiples of each other, they exist only for targets that are multiples too.",
        ],
      },
    ],
    pitfalls: [
      "Multiply the right side by the same number as the left side.",
      "Use each multiplier on its own equation. Add the right sides only after multiplying each by its own multiplier.",
      "Do not decide the value is unknown just because there is one equation. Check whether the target is a multiple of it.",
    ],
    parentGuide:
      "Ask the learner to explain why $3x + 2y = 7$ and $x + 4y = 9$ give $4x + 6y = 16$ by adding, before trying $5x + 10y$.",
  },
  {
    id: "variation-constant",
    title: "Direct and inverse variation",
    summary:
      "If you earn 15 dollars an hour, 2 hours pays 30 and 4 hours pays 60. Pay divided by hours is always 15. That is called direct variation. On a 60-mile trip, going 30 miles per hour takes 2 hours and going 60 takes 1. Speed times time is always 60. That is called inverse variation. In both, one fixed number describes the whole relationship.",
    templateIds: ["variation-constant"],
    senses: satSenses,
    noLink: satNoLink,
    objectives: [
      "Find the constant of variation, the fixed number, from one pair of values.",
      "Predict a value, choose an equation, or find how much one quantity is multiplied by.",
      "Tell direct, inverse and neither apart from a table.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One number describes the whole relationship",
        paragraphs: [
          "Two quantities vary directly when one is always the same number times the other. Pay at a fixed hourly wage does: twice the hours earns twice the pay. That fixed number is called the constant of variation, $k$. The rule is $y = kx$, where $kx$ means $k$ times $x$, and $k = \\frac{y}{x}$.",
          "Two quantities vary inversely when their product, the result of multiplying them, never changes. A trip of fixed length does: doubling the speed halves the time. The rule is $y = \\frac{k}{x}$, and $k$ is the product $xy$.",
          "One known pair of values is enough to find $k$. Then the rule gives every other pair.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "The mass $m$, in grams, of a block cut from one metal varies directly with its volume $V$, in cubic centimeters. When $V=8$, $m=20$. What is $m$ when $V=12$?",
      steps: [
        "Direct variation means $m = kV$. Put in the known pair: $20 = k \\times 8$. An equation has two sides: the parts left and right of the equals sign. Divide both sides by 8: $k = \\frac{20}{8} = \\frac{5}{2}$.",
        "Use the new volume: $m = \\frac{5}{2} \\times 12 = 30$ grams.",
        "Check that the ratio is unchanged: $\\frac{30}{12} = \\frac{5}{2}$ and $\\frac{20}{8} = \\frac{5}{2}$.",
      ],
      answer: "$30$",
      answerUnit: "grams",
    },
    closingSections: [
      {
        stage: "method",
        title: "Which kind is it?",
        keepTogetherInPrint: true,
        paragraphs: [
          "From a table, work out $y \\div x$ and $x \\times y$ for every row. If the quotient, the result of dividing, is always the same, the relationship is direct and $y = kx$. If the product is always the same, it is inverse and $y = \\frac{k}{x}$.",
          "If neither stays the same, it is neither. A rule like $y = 3x + 2$ falls here, because it adds a fixed number.",
          "To find how $y$ changes when $x$ changes from $a$ to $b$, find the number it is multiplied by. In direct variation, $y$ is multiplied by $\\frac{b}{a}$. In inverse variation, it is multiplied by $\\frac{a}{b}$.",
        ],
      },
      {
        stage: "formal",
        title: "Definitions",
        paragraphs: [
          "$y$ varies directly with $x$ when $y = kx$ for a constant $k \\ne 0$ ($\\ne$ means is not equal to). Then $\\frac{y}{x} = k$ for every $x \\ne 0$. $y$ varies inversely with $x$ when $y = \\frac{k}{x}$ for a constant $k \\ne 0$ and $x \\ne 0$. Then $xy = k$.",
          "If $x$ is multiplied by a number $f$ other than 0, direct variation multiplies $y$ by $f$, and inverse variation multiplies $y$ by $\\frac{1}{f}$.",
        ],
      },
    ],
    pitfalls: [
      "Do not add the same amount to both quantities. Variation is about multiplying.",
      "For inverse variation, divide $k$ by the new input. Do not multiply.",
      "The constant of direct variation is $\\frac{y}{x}$, not $\\frac{x}{y}$.",
    ],
    parentGuide:
      "Ask whether the pay for 3 hours and for 6 hours has the same ratio to the hours. Then ask whether a trip at 30 and at 60 miles per hour has the same product of speed and time.",
  },
  {
    id: "rate-combination-model",
    title: "Combining rates",
    summary:
      "If Ana paints a fence in 4 hours, she paints a quarter of it each hour. An amount per hour like that is called a rate. When two people work together, their rates add. When one thing works against another, like a drain against a tap, its rate subtracts. Times cannot simply be averaged, so change them into rates or totals first.",
    templateIds: ["rate-combination-model"],
    senses: satSenses,
    noLink: satNoLink,
    objectives: [
      "Add and subtract rates to find a shared time or an overall time.",
      "Find the concentration of a mixture by weighting each part by its volume, and find an unknown amount.",
      "Find an average speed as total distance divided by total time.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Work with rates, not times",
        paragraphs: [
          "A rate is an amount per unit of time. A worker who finishes a job in 4 hours does $\\frac{1}{4}$ of the job each hour. A second worker who takes 6 hours does $\\frac{1}{6}$ of it each hour.",
          "Working together, they each do their share in the same hour, so their rates add. The time for the whole job is then 1 divided by the combined rate.",
          "For two workers sharing one job, their times do not simply add or average. Together the workers must be faster than either one alone, so the answer is less than 4 hours, not 5 or 10.",
          "The same idea works for mixtures. The concentration of a salt solution is the amount of salt divided by the total amount. To mix two solutions, add their amounts of salt. Never add the two concentrations, and average them only when the amounts are equal.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Ana can paint a fence in 4 hours and Ben can paint it in 6 hours. Working together at these constant rates, how long do they need, in hours?",
      steps: [
        "Write each rate. Ana paints $\\frac{1}{4}$ of the fence per hour, and Ben paints $\\frac{1}{6}$.",
        "Add the rates, using a common bottom number: $\\frac{1}{4} + \\frac{1}{6} = \\frac{3}{12} + \\frac{2}{12} = \\frac{5}{12}$ of the fence per hour.",
        "One whole fence takes $1 \\div \\frac{5}{12} = \\frac{12}{5}$ hours, which is 2.4 hours.",
        "Check: in $\\frac{12}{5}$ hours Ana paints $\\frac{1}{4} \\times \\frac{12}{5} = \\frac{3}{5}$ and Ben paints $\\frac{1}{6} \\times \\frac{12}{5} = \\frac{2}{5}$. Together, $\\frac{3}{5} + \\frac{2}{5} = 1$ fence.",
      ],
      answer: "$\\frac{12}{5}$",
      answerUnit: "hours",
    },
    closingSections: [
      {
        stage: "method",
        title: "Other rate situations",
        keepTogetherInPrint: true,
        paragraphs: [
          "A drain works against a tap, so subtract its rate from the tap's rate.",
          "For mixtures, add the amounts of the pure substance. For example, 9 liters of a 27% salt solution hold $0.27 \\times 9$ liters of salt. The mixture's concentration is the total salt divided by the total volume.",
          "Speed is the distance travelled divided by the time. For a trip with equal distances $d$ at speeds $u$ and $v$, the total distance is $2d$. The total time is $\\frac{d}{u} + \\frac{d}{v}$. So the average speed is $\\frac{2uv}{u + v}$. When $u \\ne v$, it is below the halfway speed $\\frac{u + v}{2}$, because more time is spent at the slower speed.",
          "When a rate changes partway through, find the amount done in the first part. Then divide what is left by the second rate.",
        ],
      },
      {
        stage: "formal",
        title: "Relations used",
        paragraphs: [
          "For steady rates, amount = rate × time. Rates $r_1$ and $r_2$ on the same task combine to $r_1 + r_2$ working together, and $r_1 - r_2$ working against each other. The small numbers written low are labels. Two times $t_1$ and $t_2$ for one job give $\\frac{t_1t_2}{t_1 + t_2}$ together.",
          "Mixing volumes $V_1$ and $V_2$ with concentrations $c_1$ and $c_2$ gives concentration $\\frac{c_1V_1 + c_2V_2}{V_1 + V_2}$. Average speed is total distance divided by total time.",
        ],
      },
    ],
    pitfalls: [
      "Do not simply average two concentrations or two speeds unless the amounts or times are equal. Weight each one by how much of it there is.",
      "A time for working together must be less than the shorter time alone.",
      "Keep exact fractions until the end, and give the unit the question asks for.",
    ],
    parentGuide:
      "Ask the learner why two workers who take 4 and 6 hours cannot take 5 hours together. Then ask how much of the job each one does in one hour.",
  },
  {
    id: "absolute-compound-inequality",
    title: "Absolute-value and compound inequalities",
    summary:
      "The distance of a number from 0 is called its absolute value. Both $-7$ and 7 have absolute value 7. We write it with bars: $|-7| = 7$. Saying a number's distance from 0 is less than 7 means it lies between $-7$ and 7. Saying it is more than 7 means it lies below $-7$ or above 7. Joining two conditions with “and” or “or” makes a compound inequality.",
    templateIds: ["absolute-compound-inequality"],
    senses: satSenses,
    noLink: satNoLink,
    objectives: [
      "Solve $|ax + b| < c$ and $|ax + b| > c$.",
      "Solve chains of inequalities, and “or” pairs, with straight-line expressions.",
      "Match a set drawn on a number line to an absolute-value inequality.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Distance from zero",
        paragraphs: [
          "The absolute value $|E|$ is how far $E$ is from 0 on the number line, so it is never negative. The sign $<$ means less than, and $>$ means greater than. A statement that uses one of these signs is called an inequality.",
          "So $|E| < 7$ says $E$ is less than 7 away from 0: $E$ is between $-7$ and $7$. We write that as the chain $-7 < E < 7$. And $|E| > 7$ says $E$ is more than 7 away: $E$ is below $-7$ or above $7$.",
          "A compound inequality joins two conditions. A chain such as $2 < 3x + 1 < 10$ means both conditions are true at once, so it describes the overlap. “$x < -1$ or $x > 4$” means at least one is true, so it describes both outer pieces.",
          "To solve an inequality means to find every number that makes it true. As with an equation, you may add or subtract the same number on every part, or multiply or divide every part by the same number other than 0. There is one extra rule: multiplying or dividing by a negative number flips the inequality sign. For example, $2 < 3$ but $-2 > -3$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve $|2x-3|<7$.",
      steps: [
        "Since 7 is positive, $|2x - 3| < 7$ means $2x - 3$ is between $-7$ and 7: $-7 < 2x - 3 < 7$.",
        "Add 3 to all three parts to undo the $- 3$: $-4 < 2x < 10$.",
        "Divide all three parts by 2, a positive number, so the signs stay the same: $-2 < x < 5$.",
        "Check: $x = 0$ gives $|-3| = 3$, which is less than 7. $x = 5$ gives $|7| = 7$, which is not less than 7, so 5 is left out.",
      ],
      answer: "$-2<x<5$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Cases and the number line",
        keepTogetherInPrint: true,
        paragraphs: [
          "For $|E| > c$ with $c > 0$, solve the two cases $E < -c$ and $E > c$ separately, and join them with “or”. When you divide by a negative number, flip the sign. In a chain, that also swaps which end each bound is on.",
          "To write a number-line segment from $L$ to $R$ as an absolute value, use the middle point $m = \\frac{L + R}{2}$ and the radius $r = \\frac{R - L}{2}$, its distance to either end. The segment is $|x - m| \\le r$, or $< r$ if the ends are left out. The two outer pieces are $|x - m| \\ge r$, or $> r$. Here $\\le$ means less than or equal to, and $\\ge$ means greater than or equal to.",
          "If the right side (the number after the inequality sign) is negative, no distance can be less than it, so $|E| < c$ has no solutions. And every distance is greater than it, so $|E| > c$ is always true.",
        ],
      },
      {
        stage: "formal",
        title: "Rules",
        paragraphs: [
          "A real number is any number on the number line. For a real number $E$ and $c > 0$: $|E| < c$ means $-c < E < c$, and $|E| > c$ means $E < -c$ or $E > c$. The same holds with $\\le$ and $\\ge$. For $c < 0$, $|E| < c$ has no real solution and $|E| > c$ holds for all $x$. Also, $|E| \\le 0$ holds exactly when $E = 0$.",
          "Multiplying or dividing an inequality by a negative number reverses its direction.",
        ],
      },
    ],
    pitfalls: [
      "For $|E| > c$ with $c > 0$, the answer is the two outer pieces joined by “or”, not the numbers between them. For $|E| < c$, it is the numbers between.",
      "Flip the sign when you multiply or divide by a negative number.",
      "Check the sign of the right side before solving.",
    ],
    parentGuide:
      "Ask the learner whether 0 and 5 make $|2x - 3| < 7$ true, and what the answer says about the numbers between $-2$ and 5.",
  },
  {
    id: "quadratic-from-data",
    title: "Write a quadratic from given facts",
    summary:
      "The graph of a rule with an $x^2$ part is a U-shaped curve called a parabola. Its equation has three unknown numbers, so it usually takes three facts that fit together to fix it. For example, knowing where it crosses the $x$-axis gives the equation's shape. One more point, not on the $x$-axis, then fixes how steep the curve is and which way up it opens.",
    templateIds: ["quadratic-from-data"],
    senses: satSenses,
    noLink: satNoLink,
    objectives: [
      "Choose factored, vertex or standard form to match the facts you are given.",
      "Use one extra point to find the number $a$ in front of $x^2$.",
      "Use second differences for a table with evenly spaced inputs.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Pick the form that uses the facts",
        paragraphs: [
          "A quadratic rule is $y = ax^2 + bx + c$, where $a$, $b$ and $c$ are fixed numbers and $a \\ne 0$ ($\\ne$ means is not equal to). This is called standard form. Its graph is a parabola, and it has three unknown numbers, so three facts fix it.",
          "A zero is an $x$-value where $y = 0$, where the curve meets the $x$-axis. A product, the result of multiplying, is 0 when one of its factors (the parts being multiplied) is 0. So if the zeros are $p$ and $q$, the rule is $y = a(x - p)(x - q)$: the bracket $x - p$ is 0 at $x = p$. This is called factored form, and only $a$ is left to find.",
          "The vertex is the turning point of the curve. If it is at $(h, k)$, the rule is $y = a(x - h)^2 + k$, called vertex form. Again only $a$ is left.",
          "Put one more point into the form, and solve for $a$. The number $a$ sets how steep the curve is. If $a$ is negative, the curve opens downward.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A parabola crosses the $x$-axis at $x=-2$ and $x=3$ and passes through $(1,-12)$. Write its equation.",
      steps: [
        "Use the zeros. A zero at $x = -2$ gives the bracket $x - (-2) = x + 2$, and a zero at $x = 3$ gives $x - 3$. So $y = a(x + 2)(x - 3)$.",
        "Put in the point $(1, -12)$, meaning $x = 1$ and $y = -12$: $-12 = a(1 + 2)(1 - 3) = a \\times 3 \\times (-2) = -6a$. An equation has two sides: the parts left and right of the equals sign. Divide both sides by $-6$: $a = 2$.",
        "Write the equation: $y = 2(x + 2)(x - 3)$.",
        "Check the point: $2 \\times 3 \\times (-2) = -12$. Check the zeros: $x = -2$ and $x = 3$ each make a bracket 0.",
      ],
      answer: "$y=2(x+2)(x-3)$",
    },
    closingSections: [
      {
        stage: "method",
        title: "Tables and three points",
        keepTogetherInPrint: true,
        paragraphs: [
          "For three $x$-values with equal step $h$, subtract neighbouring $y$-values to get two first differences. Subtract those to get the second difference. It equals $2ah^2$, so $a = \\frac{\\text{second difference}}{2h^2}$. Then subtract two rows to find $b$, and use one row to find $c$.",
          "For three points with uneven steps, find the slope (change in $y$ divided by change in $x$) between the first two points and between the last two. These slopes are $a(x_1 + x_2) + b$ and $a(x_2 + x_3) + b$, so their difference is $a(x_3 - x_1)$. That gives $a$, then $b$ and $c$.",
        ],
      },
      {
        stage: "formal",
        title: "Forms",
        paragraphs: [
          "A quadratic function has the form $y = ax^2 + bx + c$ with $a \\ne 0$. With zeros $p$ and $q$, it equals $a(x - p)(x - q)$. With vertex $(h, k)$, it equals $a(x - h)^2 + k$.",
          "Three points with different $x$-values that are not on one straight line lie on exactly one quadratic. For $x$-values with equal step $h$, the second difference of the $y$-values is $2ah^2$.",
        ],
      },
    ],
    pitfalls: [
      "A zero at $x = r$ gives the bracket $(x - r)$. The sign inside is opposite to the number.",
      "The zeros or the vertex alone do not fix $a$. Use the extra point.",
      "The second difference is $2ah^2$, not $a$.",
    ],
    parentGuide:
      "Ask the learner to check that $y = 2(x + 2)(x - 3)$ passes through $(1, -12)$ and crosses the $x$-axis at both zeros.",
  },
];
