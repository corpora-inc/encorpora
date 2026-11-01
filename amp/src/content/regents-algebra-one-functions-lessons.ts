import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/** Glossary readings for the Regents function lessons and methods. */
const senses = {
  side: "side-of-equation",
  sides: "side-of-equation",
  term: "term-expression",
  terms: "term-expression",
  difference: "difference-subtract",
  product: "product-multiply",
  products: "product-multiply",
  factor: "factor-number",
  factors: "factor-number",
  root: "root-radical",
  roots: "root-radical",
  vertex: "vertex-parabola",
  squares: "square-number",
  square: "square-number",
  squared: "square-number",
} as const;
const noLink = [
  "whole",
  "part",
  "parts",
  "change",
  "changes",
  "opposite",
  "mean",
  "means",
  "rule",
  "rules",
  "leaves",
  "image",
  "more than",
];

export const regentsAlgebraOneFunctionMethods: Record<string, ProblemMethod> = {
  "function-missing-input": {
    goal: "Choose an unknown input in a list of pairs, using the rule that a function gives each input exactly one output.",
    senses,
    noLink,
    intuition:
      "An ordered pair is a pair of numbers in order, written $(x, y)$: it matches an input $x$ (the first number) with an output $y$ (the second number). A set of pairs is called a relation. It is a function when no input is paired with two different outputs. An input may appear twice only if both pairs have the same output.",
    terms: [
      [
        "input",
        "In a list of ordered pairs, it is the first number of each pair.",
      ],
      "function",
    ],
    method: [
      "List the inputs already used, and the output each one has.",
      "Compare the unknown input with that list. A repeated input must have the same output.",
      "Choose the value the question asks for. A new input keeps a function, and so does a used input with the same output. A used input with a different output breaks it.",
    ],
    watch:
      "Repeated outputs are allowed. Only a repeated input with different outputs breaks the rule.",
  },
  "shift-function-notation": {
    goal: "Write a shifted function in function notation, keeping the horizontal and vertical directions straight.",
    intuition:
      "Adding to the output moves the graph up by that amount. Changing the input moves the graph the opposite way you might expect: $f(x-3)$ needs a larger $x$ to give the same output, so the graph moves right by 3.",
    terms: ["translation", "vertex-form"],
    method: [
      "Horizontal shift: replace $x$ by $x-h$ to move right $h$ units, or by $x+h$ to move left.",
      "Vertical shift: add $k$ to the output to move up $k$ units, or subtract to move down.",
      "For a rule that is already in vertex form, change the number inside the parentheses and the constant by the matching amounts.",
    ],
    watch:
      "Inside the function the sign is opposite the direction; outside it matches the direction. Do not swap the horizontal and vertical amounts.",
  },
  "radical-function-value": {
    goal: "Find the value of a function with a square root in it, working out the inside of the root first.",
    senses,
    noLink,
    intuition:
      "The square root of a number is the number that, times itself, gives it: $\\sqrt{25} = 5$ because $5 \\times 5 = 25$. The root sign $\\sqrt{\\phantom{x}}$ always means the root that is 0 or positive. The number under the root sign is called the radicand. $f(x)$, read “$f$ of $x$”, is the output when the input is $x$. To find it, put the input in place of $x$.",
    terms: ["radicand", "perfect-square"],
    method: [
      "Put the input in place of $x$, and work out the radicand (everything under the root sign).",
      "Take the square root of the radicand.",
      "Then multiply by any number in front of the root, and add or subtract any number outside it.",
    ],
    watch:
      "Work out everything under the root before taking the root. A radicand of 0 gives a root of 0, so the value is just the number added outside.",
  },
  "zeros-of-factored-product": {
    goal: "Find every zero of a function written as a product, by setting each factor equal to 0.",
    senses,
    noLink,
    intuition:
      "A zero of a function is an input that makes the output, the number the function gives back, equal 0. Factors are the parts being multiplied. Two numbers multiply to 0 only when at least one of them is 0. An expression like $x^2 - 36$, where $x^2$ means $x$ times $x$, is called a difference of squares. It factors as $(x - 6)(x + 6)$, so it gives two zeros, 6 and $-6$. Squaring means multiplying a number by itself.",
    terms: ["zero-of-a-function", "difference-of-squares"],
    method: [
      "Factor completely, including any difference of squares: $x^2 - k^2 = (x - k)(x + k)$.",
      "Set each factor equal to 0 and solve.",
      "List every zero, including the zero 0 from a factor that is just $x$.",
    ],
    watch:
      "$x^2 = 36$ has two solutions, 6 and $-6$, not 36. A factor $x + 5$ gives the zero $-5$.",
  },
  "quadratic-negative-output": {
    goal: "Find the inputs that make a quadratic function equal a given negative number, by making one side 0 and factoring.",
    senses,
    noLink,
    intuition:
      "A quadratic function has an $x^2$ term ($x$ times $x$) and no higher power, like $f(x) = x^2 - 8x + 7$. $f(x)$, read “$f$ of $x$”, is the output for input $x$. Asking for $f(x) = -8$ asks which inputs give the output $-8$. Add 8 to both sides so one side is 0. Then factor: two factors multiply to 0 only when one of them is 0.",
    terms: [
      "output",
      [
        "zero-of-a-function",
        "Here, a value of $x$ that makes $f(x) - c$, the rearranged side, equal 0.",
      ],
    ],
    method: [
      "Write $f(x)$ equal to the given output.",
      "Add or subtract on both sides so the right side is 0, and combine the plain numbers.",
      "Factor, and set each factor equal to 0.",
    ],
    watch:
      "The given number is an output, not an input. The zeros of $f$ solve $f(x) = 0$, which is a different equation.",
  },
  "parabola-axis-rule": {
    goal: "Choose the quadratic rule whose line of symmetry is a given line, using $x = -\\frac{b}{2a}$.",
    senses,
    noLink,
    intuition:
      "The graph of $y = ax^2 + bx + c$ (with $a \\ne 0$; $x^2$ means $x$ times $x$) is a U-shaped curve called a parabola. It is a mirror image of itself across an up-and-down line through its turning point (the lowest or highest point). That line is called the axis of symmetry, and it is $x = -\\frac{b}{2a}$. The plain number $c$ only moves the graph up or down.",
    terms: ["axis-of-symmetry", "standard-form-polynomial"],
    method: [
      "For each rule, read $a$ (the number with $x^2$) and $b$ (the number with $x$), with their signs. Work out $-\\frac{b}{2a}$.",
      "Compare it with the required line, keeping the sign.",
      "Choose the rule whose axis matches.",
    ],
    watch:
      "Divide by $2a$, not $a$. When $a$ is positive and $b$ is not 0, the axis's $x$ value has the opposite sign to $b$.",
  },
  "quadratic-formula-positive": {
    goal: "Use the quadratic formula on an equation like $3x^2 + 4x - 2 = 0$, whose solutions are not whole numbers or fractions.",
    senses,
    noLink,
    intuition:
      "An equation $ax^2 + bx + c = 0$ with $a \\ne 0$ is called quadratic; $x^2$ means $x$ times $x$. When it does not factor, the quadratic formula still finds its solutions: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$. The sign $\\pm$ stands for “plus or minus”, so it can give two answers. The number $b^2 - 4ac$ under the root is called the discriminant.",
    terms: [
      "discriminant",
      [
        "irrational-number",
        "A solution such as $\\frac{3 + \\sqrt{5}}{2}$ is irrational.",
      ],
    ],
    method: [
      "Move every term to one side, so the equation is $ax^2 + bx + c = 0$.",
      "Read $a$, $b$ and $c$, each with its sign.",
      "Put them into $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$ and simplify.",
    ],
    watch:
      "Start with the opposite of $b$. Put the whole product $4ac$, with its sign, under the root. Divide the whole top by $2a$.",
  },
  "factor-large-trinomial": {
    goal: "Factor $x^2 + bx + c$ when $c$ is large, by finding two numbers that multiply to $c$ and add to $b$.",
    senses,
    noLink,
    intuition:
      "Multiplying $(x + p)(x + q)$ gives $x^2 + (p + q)x + pq$. So to factor $x^2 + bx + c$, find two numbers $p$ and $q$ that multiply to $c$ and add to $b$. A pair of numbers that multiply to $c$ is called a factor pair. An expression is a math phrase made of numbers, letters and signs. An expression of this kind, with three terms and 1 in front of $x^2$, is called a monic trinomial.",
    terms: ["monic", "factor-pair"],
    method: [
      "List the factor pairs of the size of $c$, ignoring its sign.",
      "Choose the signs from the sign of $c$. A negative $c$ needs one positive and one negative number.",
      "Pick the pair that adds to $b$. Check by multiplying the two factors back out.",
    ],
    watch:
      "Several pairs multiply to the same number, so check the sum. When $c$ is negative and $b$ is not 0, the number with the larger size takes the sign of $b$.",
  },
};

export const regentsAlgebraOneFunctionPrinciples: Record<string, string> = {
  "function-missing-input":
    "A relation is a function exactly when no two of its ordered pairs have the same input and different outputs. Adding a pair $(k, y)$ keeps a function if $k$ is a new input, or if $y$ equals the output already paired with $k$.",
  "shift-function-notation":
    "The graph of $g(x)=f(x-h)+k$ is the graph of $f$ moved $h$ units to the right and $k$ units up; negative $h$ or $k$ move it left or down. A parabola $y=(x-h)^2+k$ has its vertex at $(h,k)$.",
  "radical-function-value":
    "For $f(x) = a\\sqrt{x + b} + c$, the value at an input $x_0$ is $a\\sqrt{x_0 + b} + c$, using the square root that is 0 or positive. The input must make the radicand (the number under the root) at least 0.",
  "zeros-of-factored-product":
    "Two numbers multiply to 0 exactly when at least one of them is 0: $AB = 0$ exactly when $A = 0$ or $B = 0$. This is called the zero product property. Since $x^2 - k^2 = (x - k)(x + k)$, the function $x(x^2 - k^2)$ has the zeros 0, $k$ and $-k$, which are three different zeros when $k \\ne 0$.",
  "quadratic-negative-output":
    "The inputs with $f(x) = c$ are the solutions of $f(x) - c = 0$. When those solutions have no fraction part, factoring and setting each factor equal to 0 finds them.",
  "parabola-axis-rule":
    "The graph of $y = ax^2 + bx + c$ with $a \\ne 0$ is symmetric about the up-and-down line $x = -\\frac{b}{2a}$, which passes through the vertex (the turning point). Changing $c$ moves the graph up or down and does not change the axis.",
  "quadratic-formula-positive":
    "If $a \\ne 0$, the solutions of $ax^2 + bx + c = 0$ are $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$. They are real numbers, the numbers on the number line, when $b^2 - 4ac \\ge 0$. When $a$, $b$ and $c$ are integers (the numbers like $-2$, 0 and 5 with no fraction part), they are irrational (not a fraction of integers) if $b^2 - 4ac$ is positive and not a perfect square.",
  "factor-large-trinomial":
    "For integers $p$ and $q$, $(x + p)(x + q) = x^2 + (p + q)x + pq$. So $x^2 + bx + c$ factors this way, with integers, exactly when there are integers $p$ and $q$ with $p + q = b$ and $pq = c$.",
};

export const regentsAlgebraOneFunctionLessons = [
  {
    senses,
    noLink,
    ...chainLesson({
      id: "regents-function-missing-input",
      title: "Completing a relation so it is a function",
      summary:
        "A function is a rule that turns each input (what you put in) into exactly one output (what comes out). A list of pairs like $(4, -1)$ shows inputs (first numbers) and outputs (second numbers). If one input showed up with two different outputs, it would not be a function. So to keep a function, an unknown input must be new, or must have the same output as before.",
      templateIds: ["function-missing-input"],
      objectives: [
        "State the rule that makes a set of ordered pairs a function.",
        "Choose an unknown input that keeps, or breaks, that rule.",
      ],
      openingTitle: "One input, one output",
      opening: [
        "An ordered pair $(x, y)$ matches an input $x$ with an output $y$. A set of ordered pairs is called a relation. It is a function if no input has two different outputs.",
        "Two different inputs may share an output; that is allowed. For example, $(1, 5)$ and $(3, 5)$ can both be in a function.",
        "If a new pair uses an input that is already in the set, its output must match the old pair's output. If it uses a new input, nothing can conflict.",
      ],
      example: {
        prompt:
          "The relation $\\{(-2,3),(0,5),(4,-1),(k,7)\\}$ is a function. Which of $k=-2$, $0$, $4$, $1$ is possible?",
        steps: [
          "List the inputs used so far: $-2$, 0 and 4, with outputs 3, 5 and $-1$.",
          "$k=-2$ would give the input $-2$ two outputs, 3 and 7, which is not allowed. The same problem happens for $k=0$ and $k=4$.",
          "$k=1$ is a new input with just one output, 7. So the relation stays a function.",
        ],
        answer: "$k=1$",
      },
      methodTitle: "List inputs, then compare",
      method: [
        "Write each input with its output.",
        "A repeated input needs a repeated output. Otherwise the relation is not a function.",
        "Use this to rule out values, or to find the value that causes the conflict.",
      ],
      formalTitle: "Definition of a function",
      formal: [
        "A relation is a set of ordered pairs. It is a function when, for every input $x$, there is exactly one output $y$ with $(x, y)$ in the set.",
        "Another way to say it: whenever $(x, y_1)$ and $(x, y_2)$ are both in the set, $y_1 = y_2$. The small 1 and 2 just mark two outputs.",
      ],
      pitfalls: [
        "Two different inputs with the same output do not break the rule.",
        "Compare inputs. The output of the new pair matters only when its input repeats.",
      ],
      parentGuide:
        "Ask your learner to say which input would have two different partners, and what those partners would be.",
    }),
  },
  chainLesson({
    id: "regents-shift-function-notation",
    title: "Shifting a function in function notation",
    summary:
      "Write $g(x)=f(x-h)+k$ for a graph moved right $h$ and up $k$, and apply the same shifts to a parabola in vertex form.",
    templateIds: ["shift-function-notation"],
    objectives: [
      "Write a horizontal and a vertical shift using function notation.",
      "Change the vertex form of a parabola to match a stated shift.",
    ],
    openingTitle: "Inside moves left and right, outside moves up and down",
    opening: [
      "Adding to the output lifts every point of the graph by that amount, so $f(x)+5$ is $f$ moved up 5.",
      "Changing the input works the other way around from what many expect. $f(x-3)$ gives at $x=5$ the value that $f$ gave at $x=2$, so each point has moved 3 to the right.",
    ],
    example: {
      prompt:
        "The graph of $f(x)=(x+2)^2-1$ is shifted 3 units to the right and 4 units up. Write the new equation.",
      steps: [
        "Move right 3: replace $x$ by $x-3$. Then $x+2$ becomes $x-3+2=x-1$.",
        "Move up 4: add 4 to the constant, $-1+4=3$.",
        "The new equation is $g(x)=(x-1)^2+3$.",
      ],
      answer: "$g(x)=(x-1)^2+3$",
    },
    methodTitle: "Handle each direction separately",
    method: [
      "Horizontal: right by $h$ means $x\\to x-h$; left by $h$ means $x\\to x+h$.",
      "Vertical: up by $k$ means $+k$; down by $k$ means $-k$.",
      "Check by tracking the vertex: it moves right $h$ and up $k$.",
    ],
    formalTitle: "Translations of graphs",
    formal: [
      "The point $(a,b)$ is on the graph of $f$ exactly when $(a+h,b+k)$ is on the graph of $g(x)=f(x-h)+k$. So the translation vector is $(h,k)$.",
      "For $y=(x-p)^2+q$ the vertex is $(p,q)$; the shifted graph has vertex $(p+h,q+k)$.",
    ],
    pitfalls: [
      "A shift to the right puts a minus sign inside the function, not a plus.",
      "The horizontal amount goes inside with $x$ and the vertical amount outside; do not swap them.",
      "Shifting left by 3 changes $(x+2)^2$ to $(x+5)^2$, not $(x-1)^2$.",
    ],
    parentGuide:
      "Have your learner track where the vertex goes after the shift and check it against the new rule.",
  }),
  {
    senses,
    noLink,
    ...chainLesson({
      id: "regents-radical-function-value",
      title: "Evaluating a square-root function",
      summary:
        "The square root of a number is the number, 0 or positive, that times itself gives it: $\\sqrt{25} = 5$. $f(x)$, read “$f$ of $x$”, is the output of a function $f$ for the input (the number put in) $x$. A rule like $f(x) = 2\\sqrt{x - 4} + 1$ is a recipe: subtract 4, take the square root, double it, then add 1. To find $f(29)$, follow the recipe with 29, working from the inside out.",
      templateIds: ["radical-function-value"],
      objectives: [
        "Put an input into a rule that has a square root in it.",
        "Work in order: the inside of the square root, the square root, the number in front, then the number added.",
      ],
      openingTitle: "Work from the inside out",
      opening: [
        "The square root of a number is the number that, times itself, gives it. $\\sqrt{25} = 5$, because $5 \\times 5 = 25$. The sign $\\sqrt{\\phantom{x}}$ always means the square root that is 0 or positive.",
        "A function is a rule that gives one output (the number you get back) for each input (the number you put in). $f(x)$, read “$f$ of $x$”, is the output of the function $f$ for input $x$. A rule like $f(x) = 2\\sqrt{x - 4} + 1$ is a recipe: subtract 4, take the square root, double it, add 1. Finding $f$ at a number means following the recipe with that number.",
        "Whatever is under the $\\sqrt{\\phantom{x}}$ sign is called the radicand. Work it out first.",
      ],
      example: {
        prompt: "If $f(x)=2\\sqrt{x-4}+1$, what is $f(29)$?",
        steps: [
          "Put 29 in place of $x$, and work out the radicand first: $29-4=25$.",
          "Take the square root of the radicand: $\\sqrt{25}=5$, because $5 \\times 5 = 25$.",
          "Now apply the rest of the rule. Multiply by the 2 in front: $2\\cdot5=10$. Then add 1: $10+1=11$.",
        ],
        answer: "$11$",
      },
      methodTitle: "Radicand, root, outside",
      method: [
        "Replace $x$ with the input. Use parentheses for a negative input.",
        "Work out the radicand and take its square root.",
        "Then multiply and add outside the square root.",
      ],
      formalTitle: "Principal square root",
      formal: [
        "For $y \\ge 0$, $\\sqrt{y}$ means the number that is 0 or positive and whose square, the number times itself, is $y$. This is called the principal square root. The function $\\sqrt{x + b}$ is defined only for $x \\ge -b$, so that the radicand is not negative.",
        "A radicand of 0 gives $\\sqrt{0} = 0$. Then $f(x)$ equals the number added outside the square root.",
      ],
      pitfalls: [
        "Work out the radicand before taking the square root. $\\sqrt{x + b}$ is not $\\sqrt{x} + b$.",
        "Multiply by the number in front only after finding the square root.",
        "A negative input needs parentheses when you put it in.",
      ],
      parentGuide:
        "Ask your learner to say the recipe in words before putting the number in.",
    }),
  },
  {
    senses,
    noLink,
    ...chainLesson({
      id: "regents-factor-then-zeros",
      title: "Factoring to find zeros",
      summary:
        "A function is a rule that turns each input (the number you put in) into one output (the number you get back). A zero of a function is an input that makes the output, the number the function gives back, equal 0. If two numbers multiply to make 0, then one of them (or both) is 0. So write the function as factors, the parts being multiplied, like $x(x - 6)(x + 6)$. Here parentheses, the curved brackets, side by side mean multiply. Then set each factor equal to 0. Here that gives the zeros 0, 6 and $-6$.",
      templateIds: ["zeros-of-factored-product", "factor-large-trinomial"],
      objectives: [
        "Factor $x^2 + bx + c$ by finding two numbers that multiply to $c$ and add to $b$.",
        "Find every zero of a product, including the two zeros of an expression like $x^2 - 36$.",
      ],
      openingTitle: "A product is zero only when a factor is zero",
      opening: [
        "A zero of a function is an input that makes its output 0. Factors are numbers, or groups of letters and numbers, that are multiplied together, and the result is called the product.",
        "Two numbers multiply to 0 only when one of them is 0. So if a function is written as a product of factors, its zeros come from setting each factor equal to 0.",
        "In $x^2 - 36$, $x^2$ means $x$ times $x$. Here $x^2$ and 36 are squares, the results of multiplying a number by itself: $36 = 6 \\times 6$. It is one square minus another, called a difference of squares, and it hides two factors: $(x - 6)(x + 6)$.",
        "An expression is a math phrase with numbers, letters and signs. One like $x^2 - 14x - 120$ has three terms and is called a trinomial. It factors once you find two numbers that multiply to $-120$ and add to $-14$.",
      ],
      example: {
        prompt:
          "Find all zeros of $f(x)=x(x^2-36)$, then factor $x^2-14x-120$.",
        steps: [
          "Factor the difference of squares: $x^2-36=(x-6)(x+6)$. So $f(x)=x(x-6)(x+6)$. Setting each factor to 0 gives the zeros 0, 6 and $-6$.",
          "For $x^2-14x-120$, look for two numbers that multiply to $-120$ and add to $-14$. The pairs that multiply to 120 include $20\\cdot6$, and $-20+6=-14$.",
          "So $x^2-14x-120=(x-20)(x+6)$. Check: $-20 \\cdot 6 = -120$ and $-20 + 6 = -14$.",
        ],
        answer: "Zeros $\\{-6,0,6\\}$; $(x-20)(x+6)$",
      },
      methodTitle: "Factor, then set each factor to zero",
      method: [
        "For a trinomial $x^2 + bx + c$, list the pairs of numbers that multiply to the plain number, and check each pair's sum. A negative plain number needs one positive and one negative number.",
        "For a difference of squares, use $x^2 - k^2 = (x - k)(x + k)$.",
        "Set every factor, including a lone $x$, equal to 0.",
      ],
      formalTitle: "Zero product property",
      formal: [
        "If $AB = 0$, then $A = 0$ or $B = 0$. This is called the zero product property. It works only when the product is 0, not any other number.",
        "$(x + p)(x + q) = x^2 + (p + q)x + pq$. So factoring $x^2 + bx + c$ means finding $p$ and $q$ with sum $b$ and product $c$.",
      ],
      pitfalls: [
        "$x^2 = 36$ has two solutions (the values that make it true), 6 and $-6$, not 36.",
        "Do not forget the zero 0 from a factor that is just $x$.",
        "Several pairs share a product. Check the sum before choosing.",
      ],
      parentGuide:
        "Ask your learner to multiply a factored answer back out, to check the middle term and the plain number.",
    }),
  },
  {
    senses,
    noLink,
    ...chainLesson({
      id: "regents-solve-quadratic-equations",
      title: "Solving quadratic equations by factoring and by formula",
      summary:
        "A quadratic equation has an $x^2$ part ($x$ times $x$) and no higher power, like $x^2 - 8x + 15 = 0$. Its solutions are the values of $x$ that make it true. To find them, first get 0 on one side. Then write the other side as factors, the parts being multiplied, because factors multiply to 0 only when one of them is 0. When it will not factor neatly, a formula called the quadratic formula always finds the solutions.",
      templateIds: ["quadratic-negative-output", "quadratic-formula-positive"],
      objectives: [
        "Rewrite $f(x) = c$ as an equation equal to 0, and factor it.",
        "Use the quadratic formula, with every sign right, when the number in front of $x^2$ is more than 1.",
      ],
      openingTitle: "Make one side zero first",
      opening: [
        "A function is a rule that gives one output (the number you get back) for each input (the number you put in). $f(x)$, read “$f$ of $x$”, is the output of the function $f$ for input $x$. To find where $f(x)$ equals a number such as $-8$, write $f(x) = -8$. Then add 8 to both sides, so the right side is 0.",
        "Now factor. Two factors (parts being multiplied) multiply to 0 only when one of them is 0. So set each factor equal to 0 and solve.",
        "Not every quadratic factors neatly. For $ax^2 + bx + c = 0$ with $a \\ne 0$, the quadratic formula always works: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$. The sign $\\pm$ stands for “plus or minus”, so it can give two answers. A square root is written $\\sqrt{\\phantom{x}}$.",
      ],
      example: {
        prompt:
          "If $f(x)=x^2-8x+7$, find $x$ when $f(x)=-8$. Then write the solutions of $3x^2+4x-2=0$.",
        steps: [
          "Set $x^2-8x+7=-8$. Add 8 to both sides to get 0 on the right: $x^2-8x+15=0$. It factors as $(x-3)(x-5)=0$, so $x=3$ or $x=5$.",
          "$3x^2+4x-2=0$ does not factor neatly, so use the formula. Read the numbers with their signs: $a=3$, $b=4$, $c=-2$.",
          "Work out the part under the square root sign, called the discriminant: $16-4(3)(-2)=16+24=40$. So $x=\\frac{-4\\pm\\sqrt{40}}{6}$.",
        ],
        answer: "$x=3,5$ and $x=\\frac{-4\\pm\\sqrt{40}}{6}$",
      },
      methodTitle: "Zero form, then factor or formula",
      method: [
        "Move all terms to one side so the equation equals 0, combining the plain numbers.",
        "If it factors, set each factor equal to 0. Otherwise read $a$, $b$ and $c$, and use the formula.",
        "In the formula, start with $-b$, then add or subtract the square root of $b^2 - 4ac$, and divide the whole top by $2a$.",
      ],
      formalTitle: "The quadratic formula",
      formal: [
        "For $a \\ne 0$, completing the square on $ax^2 + bx + c = 0$ gives $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$. The number $b^2 - 4ac$ is called the discriminant.",
        "When $a$, $b$ and $c$ are integers: if the discriminant is a perfect square (like 16 or 25), the solutions are fractions of integers, called rational. If it is positive and not a perfect square, they are irrational.",
      ],
      pitfalls: [
        "The number in $f(x) = -8$ is an output. Solving $f(x) = 0$ answers a different question.",
        "The formula starts with $-b$, the opposite of the number multiplying $x$.",
        "Divide the whole top by $2a$, not just one part of it.",
      ],
      parentGuide:
        "Ask your learner to put each solution back into the original equation or function.",
    }),
  },
  {
    senses,
    noLink,
    ...chainLesson({
      id: "regents-parabola-axis-rule",
      title: "Choosing a parabola by its axis of symmetry",
      summary:
        "In $y = 2x^2 + 16x - 5$, $x^2$ means $x$ times $x$; here $a = 2$ multiplies $x^2$ and $b = 16$ multiplies $x$. Its graph, the picture of all its points, is a U-shaped curve called a parabola. It is a mirror image of itself across an up-and-down line through its turning point (the lowest or highest point), called the axis of symmetry. For $y = ax^2 + bx + c$ with $a \\ne 0$, that line is $x = -\\frac{b}{2a}$: every point on it has that $x$ value. Here it is $x = -4$.",
      templateIds: ["parabola-axis-rule"],
      objectives: [
        "Work out the axis of symmetry from $y = ax^2 + bx + c$.",
        "Match a required axis to a rule, keeping track of the sign.",
      ],
      openingTitle: "The axis depends on the first two coefficients",
      opening: [
        "In $y = ax^2 + bx + c$, $x^2$ means $x$ times $x$, and $a$ is not 0. The numbers $a$, $b$ and $c$ are called coefficients. The graph is a parabola, a U-shaped curve.",
        "A parabola is a mirror image of itself across an up-and-down line, called its axis of symmetry. The line passes through the turning point, called the vertex. Where the parabola crosses the $x$-axis, the two crossing points sit the same distance from that line.",
        "For $y = ax^2 + bx + c$, the axis is $x = -\\frac{b}{2a}$. The plain number $c$ moves the whole graph up or down, but not left or right.",
      ],
      example: {
        prompt: "Find the axis of symmetry of $y=2x^2+16x-5$.",
        steps: [
          "Read the numbers: $a=2$ (with $x^2$) and $b=16$ (with $x$). The $-5$ does not affect the axis.",
          "Put them into $x=-\\frac{b}{2a}$: $x=-\\frac{16}{2\\cdot2}=-\\frac{16}{4}$.",
          "Simplify: $-\\frac{16}{4}=-4$. The axis is the line $x=-4$.",
        ],
        answer: "$x=-4$",
      },
      methodTitle: "Compute for each rule",
      method: [
        "For each rule, read $a$ and $b$ with their signs.",
        "Work out $-\\frac{b}{2a}$ and compare it with the required line.",
        "Choose the rule that matches. Or work backward: the axis $x = h$ needs $b = -2ah$.",
      ],
      formalTitle: "Axis of symmetry",
      formal: [
        "Completing the square gives $y = a\\left(x + \\frac{b}{2a}\\right)^2 + c - \\frac{b^2}{4a}$. The graph is symmetric about $x = -\\frac{b}{2a}$.",
        "The vertex has this $x$-coordinate, so the axis passes through it.",
      ],
      pitfalls: [
        "Divide by $2a$, not $a$.",
        "The axis's $x$ value is the opposite of $\\frac{b}{2a}$.",
        "The plain number $c$ does not change the axis.",
      ],
      parentGuide:
        "Ask your learner to check the answer by finding the point halfway between the two places the graph crosses the $x$-axis, when it crosses.",
    }),
  },
];

const fm = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({
  templateId,
  facetId,
  extent: "partial",
  rationale,
});
export const regentsAlgebraOneFunctionFacetMappings: FacetMapping[] = [
  fm(
    "function-missing-input",
    "function-notation.core",
    "Single choice for one unknown input in a set of three or four ordered pairs, asked as keeping or breaking a function. Does not assess tables, graphs, mappings, or writing the justification.",
  ),
  fm(
    "shift-function-notation",
    "function-transformations.core",
    "Single choice for a horizontal plus vertical shift in function notation and for shifting a parabola already in vertex form. Does not assess reflections, stretches, graphing, or identifying a shift from a graph.",
  ),
  fm(
    "radical-function-value",
    "function-evaluation.core",
    "Numeric entry for a square-root function with an optional coefficient and constant at an input making the radicand a perfect square. Does not assess domain restrictions, non-perfect-square radicands, graphing, or function composition.",
  ),
  fm(
    "zeros-of-factored-product",
    "polynomial-zeros.core",
    "Single choice for the zeros of a product of $x$ or a binomial and a difference of squares. Does not assess multiplicity, higher-degree factoring, graphing, or non-integer zeros.",
  ),
  fm(
    "quadratic-negative-output",
    "quadratic-equations.core",
    "Single choice for the inputs giving a stated negative output of a monic quadratic with integer solutions. Does not assess non-monic quadratics, irrational solutions, graphing the intersection, or explaining the result.",
  ),
  fm(
    "parabola-axis-rule",
    "quadratic-graphs.core",
    "Single choice for the rule with a stated axis among four standard-form quadratics. Does not assess identifying the axis from a graph, the vertex's $y$-coordinate, or graphing.",
  ),
  fm(
    "quadratic-formula-positive",
    "quadratic-formula.core",
    "Single choice for the quadratic formula expression of a nonmonic equation with irrational solutions, in zero form or with the constant moved first. Does not assess simplifying the radical, complex solutions, or computing decimal approximations.",
  ),
  fm(
    "factor-large-trinomial",
    "factor-quadratics.core",
    "Single choice for the factorization of a monic trinomial whose constant has absolute value between 60 and 200. Does not assess nonmonic trinomials, factoring completely with a common factor, or solving the equation.",
  ),
];
