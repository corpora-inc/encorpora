import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsAlgebraOneFunctionMethods: Record<string, ProblemMethod> = {
  "function-missing-input": {
    goal: "Use the rule that every input has exactly one output to choose an unknown input in a set of ordered pairs.",
    intuition:
      "A relation is a function when no input is paired with two different outputs. An input that appears twice is fine only when both pairs agree, so a new pair with a new output must use an input that has not been used.",
    terms: [
      [
        "input",
        "In a list of ordered pairs, it is the first number of each pair.",
      ],
      "function",
    ],
    method: [
      "List the inputs already used and the output each one has.",
      "Compare the unknown input with that list: a repeated input must carry the same output.",
      "Choose the value that satisfies the question: unused to keep a function, used to break it.",
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
    goal: "Evaluate a function containing a square root by simplifying the radicand first.",
    intuition:
      "To evaluate a function, put the input where $x$ is, then follow the order of operations. Everything under the square root sign is calculated first, then the root is taken, then the rest of the rule is applied.",
    terms: ["radicand", "perfect-square"],
    method: [
      "Substitute the input for $x$ and simplify the radicand.",
      "Take the square root of the radicand.",
      "Multiply by any coefficient and add or subtract any constant outside the root.",
    ],
    watch:
      "Add the shift inside the root before taking the root. A zero radicand gives a root of 0, so the value is just the constant.",
  },
  "zeros-of-factored-product": {
    goal: "Find every zero of a product with a difference of squares by setting each factor to zero.",
    intuition:
      "A product of numbers is zero only when at least one factor is zero. A difference of squares $x^2-k^2$ is itself a product, $(x-k)(x+k)$, so it contributes two zeros.",
    terms: ["zero-of-a-function", "difference-of-squares"],
    method: [
      "Factor completely, including any difference of squares.",
      "Set each factor equal to zero and solve.",
      "List every zero, counting the zero from a lone factor $x$ as well.",
    ],
    watch:
      "The two solutions of $x^2=36$ are 6 and $-6$, not 36. A factor $x+5$ gives the zero $-5$.",
  },
  "quadratic-negative-output": {
    goal: "Find the inputs of a quadratic function that give a stated negative output by moving it to one side and factoring.",
    intuition:
      "Asking for $f(x)=-8$ is asking where the graph is 8 below the $x$-axis. Add 8 to both sides, and the question becomes finding the zeros of a new quadratic.",
    terms: [
      "output",
      [
        "zero-of-a-function",
        "Here, a value of $x$ that makes one side of the equation equal 0.",
      ],
    ],
    method: [
      "Write $f(x)$ equal to the stated output.",
      "Add or subtract so the right side is 0, then combine the constants.",
      "Factor and set each factor to zero.",
    ],
    watch:
      "The stated number is an output, not an input. The zeros of $f$ solve $f(x)=0$, a different equation.",
  },
  "parabola-axis-rule": {
    goal: "Choose the quadratic rule whose axis of symmetry is a given line, using $x=-\\frac{b}{2a}$.",
    intuition:
      "A parabola is symmetric about a vertical line through its vertex. The linear and quadratic terms together decide where that line is, and the constant only moves the graph up or down.",
    terms: ["axis-of-symmetry", "standard-form-polynomial"],
    method: [
      "Compute $-\\frac{b}{2a}$ for each rule.",
      "Compare with the required line, keeping the sign.",
      "Choose the rule whose axis matches.",
    ],
    watch:
      "Use $2a$ in the denominator and keep the leading coefficient. The sign of $b$ is the opposite of the sign of the axis when $a$ is positive.",
  },
  "quadratic-formula-positive": {
    goal: "Apply the quadratic formula to an equation with leading coefficient greater than 1 and irrational solutions.",
    intuition:
      "When a quadratic does not factor over the integers, the quadratic formula still gives its solutions. The discriminant under the root decides how many real solutions exist and whether they are rational.",
    terms: [
      "discriminant",
      [
        "irrational-number",
        "A solution such as $\\frac{3 + \\sqrt{5}}{2}$ is irrational.",
      ],
    ],
    method: [
      "Move every term to one side so the equation is $ax^2+bx+c=0$.",
      "Read $a$, $b$ and $c$ with their signs.",
      "Substitute into $x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$.",
    ],
    watch:
      "Start with the opposite of $b$, put the whole product $4ac$ under the root with its sign, and divide everything by $2a$.",
  },
  "factor-large-trinomial": {
    goal: "Factor a monic trinomial whose constant is large by finding the factor pair with the right sum.",
    intuition:
      "Multiplying $(x+p)(x+q)$ gives $x^2+(p+q)x+pq$. Factoring reverses that: find two numbers whose product is the constant and whose sum is the middle coefficient.",
    terms: ["monic", "factor-pair"],
    method: [
      "List the factor pairs of the constant's size.",
      "Choose the signs from the sign of the constant: a negative constant needs one positive and one negative number.",
      "Pick the pair whose sum is the middle coefficient, then check by expanding.",
    ],
    watch:
      "Several pairs have the same product, so check the sum. The larger number takes the sign of the middle term when the constant is negative.",
  },
};

export const regentsAlgebraOneFunctionPrinciples: Record<string, string> = {
  "function-missing-input":
    "A relation is a function exactly when no two of its ordered pairs have the same input and different outputs. Adding a pair $(k,y)$ keeps a function if $k$ is a new input or if $y$ equals the output already paired with $k$.",
  "shift-function-notation":
    "The graph of $g(x)=f(x-h)+k$ is the graph of $f$ moved $h$ units to the right and $k$ units up; negative $h$ or $k$ move it left or down. A parabola $y=(x-h)^2+k$ has its vertex at $(h,k)$.",
  "radical-function-value":
    "For $f(x)=a\\sqrt{x+b}+c$, the value at an input $x_0$ is $a\\sqrt{x_0+b}+c$, where the principal (nonnegative) square root is taken. The input must make the radicand at least 0.",
  "zeros-of-factored-product":
    "The zero product property says $AB=0$ exactly when $A=0$ or $B=0$. Since $x^2-k^2=(x-k)(x+k)$, the function $x(x^2-k^2)$ has the three zeros $0$, $k$ and $-k$.",
  "quadratic-negative-output":
    "The inputs with $f(x)=c$ are the solutions of $f(x)-c=0$. For a quadratic with integer zeros of $f(x)-c$, factoring the trinomial and applying the zero product property gives them.",
  "parabola-axis-rule":
    "The graph of $y=ax^2+bx+c$ with $a\\ne0$ is symmetric about the vertical line $x=-\\frac{b}{2a}$, which passes through the vertex. Changing $c$ moves the graph vertically and does not change the axis.",
  "quadratic-formula-positive":
    "If $a\\ne0$, the solutions of $ax^2+bx+c=0$ are $x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$. They are real when $b^2-4ac\\ge0$ and irrational when $b^2-4ac$ is positive and not a perfect square.",
  "factor-large-trinomial":
    "For integers $p$ and $q$, $(x+p)(x+q)=x^2+(p+q)x+pq$. A trinomial $x^2+bx+c$ factors over the integers this way exactly when integers $p$ and $q$ exist with $p+q=b$ and $pq=c$.",
};

export const regentsAlgebraOneFunctionLessons = [
  chainLesson({
    id: "regents-function-missing-input",
    title: "Completing a relation so it is a function",
    summary:
      "Use the one-output rule to decide which input keeps or breaks a function.",
    templateIds: ["function-missing-input"],
    objectives: [
      "State the rule that makes a set of ordered pairs a function.",
      "Choose an unknown input that keeps, or breaks, that rule.",
    ],
    openingTitle: "One input, one output",
    opening: [
      "An ordered pair $(x,y)$ pairs an input with an output. A set of ordered pairs is a function if no input has two different outputs. Two inputs may share an output; that is allowed.",
      "If a new pair uses an input that is already in the set, its output must match the old pair's output. If it uses a new input, there is nothing to conflict with.",
    ],
    example: {
      prompt:
        "The relation $\\{(-2,3),(0,5),(4,-1),(k,7)\\}$ is a function. Which of $k=-2$, $0$, $4$, $1$ is possible?",
      steps: [
        "The inputs used so far are $-2$, $0$ and $4$, with outputs 3, 5 and $-1$.",
        "$k=-2$ would give the input $-2$ the outputs 3 and 7. The same happens for $k=0$ and $k=4$.",
        "$k=1$ is a new input with one output, so the relation is a function.",
      ],
      answer: "$k=1$",
    },
    methodTitle: "List inputs, then compare",
    method: [
      "Write each input with its output.",
      "A repeated input needs a repeated output; otherwise the relation is not a function.",
      "Use this to rule out values, or to find the value that causes the conflict.",
    ],
    formalTitle: "Definition of a function",
    formal: [
      "A relation is a set of ordered pairs. It is a function when for every input $x$ there is exactly one output $y$ with $(x,y)$ in the set.",
      "Equivalently, whenever $(x,y_1)$ and $(x,y_2)$ are both in the set, $y_1=y_2$.",
    ],
    pitfalls: [
      "Two different inputs with the same output do not break the rule.",
      "Compare inputs only; the output of the new pair matters only when its input repeats.",
    ],
    parentGuide:
      "Ask your learner to say which input would have two different partners, and what those partners would be.",
  }),
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
  chainLesson({
    id: "regents-radical-function-value",
    title: "Evaluating a square-root function",
    summary:
      "Substitute into a rule with a square root, simplify the radicand, then apply the rest of the rule.",
    templateIds: ["radical-function-value"],
    objectives: [
      "Substitute an input into a rule containing a square root.",
      "Follow the order: radicand, root, coefficient, constant.",
    ],
    openingTitle: "Work from the inside out",
    opening: [
      "A rule like $f(x)=2\\sqrt{x-4}+1$ is a recipe: subtract 4, take the square root, double it, add 1. Evaluating $f$ at a number means following the recipe with that number.",
      "The radicand, the expression under the root sign, is finished first. Its square root is the principal one, which is zero or positive.",
    ],
    example: {
      prompt: "If $f(x)=2\\sqrt{x-4}+1$, what is $f(29)$?",
      steps: [
        "Radicand: $29-4=25$.",
        "Square root: $\\sqrt{25}=5$.",
        "Coefficient: $2\\cdot5=10$, then the constant: $10+1=11$.",
      ],
      answer: "$11$",
    },
    methodTitle: "Radicand, root, outside",
    method: [
      "Replace $x$ with the input, using parentheses for a negative input.",
      "Simplify the radicand and take the root.",
      "Then multiply and add outside the root.",
    ],
    formalTitle: "Principal square root",
    formal: [
      "For $y\\ge0$, $\\sqrt{y}$ denotes the nonnegative number whose square is $y$. The function $\\sqrt{x+b}$ is defined for $x\\ge-b$.",
      "A radicand of 0 gives $\\sqrt{0}=0$, so $f(x)$ equals the constant outside the root.",
    ],
    pitfalls: [
      "Compute the radicand before taking the root; $\\sqrt{x+b}$ is not $\\sqrt{x}+b$.",
      "Apply the coefficient to the root only after finding the root.",
      "A negative input needs parentheses when substituted.",
    ],
    parentGuide:
      "Ask your learner to say the recipe in words before putting the number in.",
  }),
  chainLesson({
    id: "regents-factor-then-zeros",
    title: "Factoring to find zeros",
    summary:
      "Factor a trinomial with a large constant or a difference of squares, then use the zero product property.",
    templateIds: ["zeros-of-factored-product", "factor-large-trinomial"],
    objectives: [
      "Factor a monic trinomial using the factor pair with the right product and sum.",
      "Find every zero of a product, including the zeros of a difference of squares.",
    ],
    openingTitle: "A product is zero only when a factor is zero",
    opening: [
      "Two numbers multiply to zero only when one of them is zero. So if a function is written as a product of factors, its zeros are the solutions of each factor set to zero.",
      "A difference of squares $x^2-36$ hides two factors, $(x-6)(x+6)$. A trinomial such as $x^2-14x-120$ also factors, once you find two numbers with product $-120$ and sum $-14$.",
    ],
    example: {
      prompt: "Find all zeros of $f(x)=x(x^2-36)$, then factor $x^2-14x-120$.",
      steps: [
        "$x^2-36=(x-6)(x+6)$, so $f(x)=x(x-6)(x+6)$ and the zeros are $0$, $6$ and $-6$.",
        "For $x^2-14x-120$: pairs of 120 include $20\\cdot6$, and $-20+6=-14$.",
        "So $x^2-14x-120=(x-20)(x+6)$.",
      ],
      answer: "Zeros $\\{-6,0,6\\}$; $(x-20)(x+6)$",
    },
    methodTitle: "Factor, then set each factor to zero",
    method: [
      "For a trinomial, list factor pairs of the constant and check the sum; a negative constant needs a positive and a negative number.",
      "For a difference of squares, take the square root of each term: $x^2-k^2=(x-k)(x+k)$.",
      "Set every factor, including a lone $x$, equal to zero.",
    ],
    formalTitle: "Zero product property",
    formal: [
      "If $AB=0$ then $A=0$ or $B=0$. This holds for real numbers and fails if the product equals any other number.",
      "$(x+p)(x+q)=x^2+(p+q)x+pq$, so factoring a monic trinomial means finding $p$ and $q$ with the given sum and product.",
    ],
    pitfalls: [
      "$x^2=36$ has two solutions, 6 and $-6$, not 36.",
      "Do not forget the zero from a lone factor $x$.",
      "Several pairs share a product; check the sum before choosing.",
    ],
    parentGuide:
      "Ask your learner to expand a factorization to confirm the middle term and the constant.",
  }),
  chainLesson({
    id: "regents-solve-quadratic-equations",
    title: "Solving quadratic equations by factoring and by formula",
    summary:
      "Find the inputs that give a stated output, and use the quadratic formula when the solutions are irrational.",
    templateIds: ["quadratic-negative-output", "quadratic-formula-positive"],
    objectives: [
      "Rewrite $f(x)=c$ as an equation equal to zero and factor it.",
      "Apply the quadratic formula with correct signs when the leading coefficient is greater than 1.",
    ],
    openingTitle: "Make one side zero first",
    opening: [
      "To find where $f(x)$ equals a number such as $-8$, write $f(x)=-8$ and move the number to the left. Now the right side is 0, and you can factor and use the zero product property.",
      "Not every quadratic factors over the integers. The quadratic formula always works: $x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$.",
    ],
    example: {
      prompt:
        "If $f(x)=x^2-8x+7$, find $x$ when $f(x)=-8$. Then write the solutions of $3x^2+4x-2=0$.",
      steps: [
        "$x^2-8x+7=-8$ becomes $x^2-8x+15=0$, which factors as $(x-3)(x-5)=0$, so $x=3$ or $x=5$.",
        "For $3x^2+4x-2=0$: $a=3$, $b=4$, $c=-2$.",
        "The discriminant is $16-4(3)(-2)=40$, so $x=\\frac{-4\\pm\\sqrt{40}}{6}$.",
      ],
      answer: "$x=3,5$ and $x=\\frac{-4\\pm\\sqrt{40}}{6}$",
    },
    methodTitle: "Zero form, then factor or formula",
    method: [
      "Move all terms to one side so the equation equals 0, combining constants.",
      "If the trinomial factors, use the zero product property. Otherwise read $a$, $b$, $c$ and use the formula.",
      "In the formula, start with $-b$, put all of $4ac$ under the root, and divide by $2a$.",
    ],
    formalTitle: "The quadratic formula",
    formal: [
      "For $a\\ne0$, completing the square on $ax^2+bx+c=0$ gives $x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$. The expression $b^2-4ac$ is the discriminant.",
      "If the discriminant is a perfect square the solutions are rational; if it is positive and not a perfect square they are irrational.",
    ],
    pitfalls: [
      "The number in $f(x)=-8$ is an output. Solving $f(x)=0$ answers a different question.",
      "The formula starts with $-b$, the opposite of the coefficient of $x$.",
      "The denominator is $2a$ for the whole numerator, not just for one term.",
    ],
    parentGuide:
      "Ask your learner to substitute each solution back into the original equation or function.",
  }),
  chainLesson({
    id: "regents-parabola-axis-rule",
    title: "Choosing a parabola by its axis of symmetry",
    summary:
      "Use $x=-\\frac{b}{2a}$ to identify which quadratic rule has a stated axis.",
    templateIds: ["parabola-axis-rule"],
    objectives: [
      "Compute the axis of symmetry from the standard form of a quadratic.",
      "Match a required axis to a rule, keeping track of sign and scale.",
    ],
    openingTitle: "The axis depends on the first two coefficients",
    opening: [
      "A parabola is a mirror image of itself across a vertical line, its axis of symmetry. The two zeros, when they exist, sit the same distance on each side of that line.",
      "For $y=ax^2+bx+c$ the axis is at $x=-\\frac{b}{2a}$. The constant $c$ moves the whole graph up or down, but not left or right.",
    ],
    example: {
      prompt: "Find the axis of symmetry of $y=2x^2+16x-5$.",
      steps: [
        "Here $a=2$ and $b=16$.",
        "$x=-\\frac{16}{2\\cdot2}=-\\frac{16}{4}$.",
        "The axis is $x=-4$.",
      ],
      answer: "$x=-4$",
    },
    methodTitle: "Compute for each rule",
    method: [
      "For each rule, read $a$ and $b$ with their signs.",
      "Compute $-\\frac{b}{2a}$ and compare with the required line.",
      "Choose the rule that matches, or work backward: $b=-2ah$ for the axis $x=h$.",
    ],
    formalTitle: "Axis of symmetry",
    formal: [
      "Completing the square gives $y=a\\left(x+\\frac{b}{2a}\\right)^2+c-\\frac{b^2}{4a}$. The graph is symmetric about $x=-\\frac{b}{2a}$.",
      "The vertex has this $x$-coordinate, so the axis passes through it.",
    ],
    pitfalls: [
      "Use $2a$, not $a$, in the denominator.",
      "The axis has the opposite sign of $\\frac{b}{2a}$.",
      "The constant $c$ does not change the axis.",
    ],
    parentGuide:
      "Ask your learner to check the answer by finding the midpoint of the two zeros, when the rule has them.",
  }),
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
