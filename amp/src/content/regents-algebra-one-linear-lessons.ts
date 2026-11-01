import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsAlgebraOneLinearMethods: Record<string, ProblemMethod> = {
  "decimal-both-sides-equation": {
    goal: "Solve a linear equation whose coefficients and constants are decimals and whose variable is on both sides.",
    intuition:
      "A decimal such as $0.4$ is four tenths, and the same balance rules apply: whatever you do to one side you do to the other. Collect the variable terms on one side, the constants on the other, then divide.",
    terms: [
      [
        "term-expression",
        "A variable term contains the unknown, such as $0.4x$.",
      ],
      "property-of-equality",
    ],
    method: [
      "Subtract the smaller variable term from both sides so the $x$ terms are on one side.",
      "Subtract the constant that sits with the $x$ terms from both sides.",
      "Divide by the decimal coefficient and check by substituting.",
    ],
    watch:
      "Subtract a term to remove it; adding it doubles it. Keep every decimal point when you combine terms, and check the answer in both sides.",
  },
  "grouped-both-sides-solve": {
    goal: "Distribute a factor over a group, combine the variable terms of both sides, and solve.",
    intuition:
      "A group such as $3(x-4)$ means three copies of $x-4$, so it equals $3x-12$. After distributing, the equation is an ordinary equation with $x$ on both sides.",
    terms: ["distribute", "like-terms"],
    method: [
      "Distribute the factor to every term in the group.",
      "Combine like terms on each side.",
      "Move the $x$ terms to one side and the constants to the other, then divide by the $x$ coefficient.",
    ],
    watch:
      "The factor multiplies the constant inside the group as well as $x$. A negative factor changes both signs. Check the answer by substituting into the original equation.",
  },
  "point-slope-two-points": {
    goal: "Find the slope from two points and write the point-slope equation using one of the points.",
    intuition:
      "A line is fixed by one point and its steepness. Two points give both: the slope is rise over run between them, and either point can anchor the equation.",
    terms: ["slope", "point-slope-form"],
    method: [
      "Subtract the $y$ values and the $x$ values in the same order to get $m$.",
      "Choose one point $(x_1,y_1)$ and write $y-y_1=m(x-x_1)$.",
      "Simplify the signs: subtracting a negative number gives a plus.",
    ],
    watch:
      "Use the $x$ and $y$ of the same point, and subtract the coordinates, so $y-(-2)$ becomes $y+2$. The slope is rise over run, not run over rise.",
  },
  "total-and-cost-equation": {
    goal: "Write one equation in one variable for two kinds of item from their prices, their count and their total cost.",
    intuition:
      "When two quantities add to a known total, call one of them $n$ and the other is the total minus $n$. Each group's money is its price times its count, and the two amounts add to the total money.",
    terms: ["unknown", "sum"],
    method: [
      "Let $n$ be the count of one kind; the other kind is the total count minus $n$.",
      "Write price times count for each kind.",
      "Set the sum of the two money amounts equal to the total money.",
    ],
    watch:
      "Pair each price with its own count. The right side of the equation is the money, not the number of items.",
  },
  "isolate-two-term-formula": {
    goal: "Solve a formula for one variable when the variable is in only one of several terms.",
    intuition:
      "Solving a formula uses the same steps as solving an equation, with letters as the numbers. Remove the terms added to the variable's term first, then divide by everything that multiplies the variable.",
    terms: [
      "isolate",
      [
        "coefficient",
        "Here it may contain other letters: in $(a + b)h$, the coefficient of $h$ is $a + b$.",
      ],
    ],
    method: [
      "Subtract or add the terms that do not contain the variable.",
      "Divide the entire other side by the coefficient of the variable.",
      "Check that the variable appears on one side only.",
    ],
    watch:
      "The subtraction comes before the division, and the division applies to the whole difference. Writing $\\frac{S}{2\\pi r}-2\\pi r^2$ divides only part of the right side.",
  },
  "substitute-into-equation": {
    goal: "Solve one equation of a system for $y$ and substitute into the other equation, keeping signs correct.",
    intuition:
      "If $y$ equals an expression, wherever $y$ appears you may write the expression instead. Substitution turns two equations in two variables into one equation in one variable.",
    terms: ["substitute", "system-of-equations"],
    method: [
      "Get $y$ alone from one equation; when its coefficient is $-1$ every sign changes as you move it.",
      "Replace $y$ in the other equation with the whole expression in parentheses.",
      "Distribute any factor across the parentheses before solving.",
    ],
    watch:
      "Put the substituted expression in parentheses so a multiplier reaches every term. Substitute for the variable you solved for.",
  },
};

export const regentsAlgebraOneLinearPrinciples: Record<string, string> = {
  "decimal-both-sides-equation":
    "Adding or subtracting the same number, or multiplying or dividing by the same nonzero number, on both sides of an equation gives an equivalent equation. For $ax+b=cx+d$ with $a\\ne c$ the unique solution is $x=\\frac{d-b}{a-c}$.",
  "grouped-both-sides-solve":
    "The distributive property gives $p(x+q)=px+pq$. After combining like terms an equation $Ax+B=Cx+D$ with $A\\ne C$ has the unique solution $x=\\frac{D-B}{A-C}$.",
  "point-slope-two-points":
    "A non-vertical line through $(x_1,y_1)$ and $(x_2,y_2)$ has slope $m=\\frac{y_2-y_1}{x_2-x_1}$ and equation $y-y_1=m(x-x_1)$. Using the other point gives an equivalent equation of the same line.",
  "total-and-cost-equation":
    "If two groups have $N$ items in all and $n$ are of the first kind, the second kind number $N-n$. With prices $p$ and $q$ the total cost is $pn+q(N-n)$, so the cost condition is the single equation $pn+q(N-n)=C$.",
  "isolate-two-term-formula":
    "Equivalent equations keep the same solutions. To solve a formula for a variable, apply inverse operations in the reverse of the order that built the expression: undo addition or subtraction of other terms, then division or multiplication by the coefficient of the variable.",
  "substitute-into-equation":
    "If $y=g(x)$ then $y$ and $g(x)$ may replace each other in any equation. A point $(x,y)$ satisfies both equations of a system exactly when $x$ satisfies the equation formed by substituting $g(x)$ for $y$ and $y=g(x)$.",
};

export const regentsAlgebraOneLinearLessons = [
  chainLesson({
    id: "regents-both-sides-equations",
    title: "Equations with the variable on both sides",
    summary:
      "Solve equations that mix decimals, groups in parentheses and an $x$ term on each side.",
    templateIds: ["decimal-both-sides-equation", "grouped-both-sides-solve"],
    objectives: [
      "Move the variable terms to one side and the constants to the other with the balance rule.",
      "Distribute over a group and work with decimal coefficients, then check the solution.",
    ],
    openingTitle: "Keep the equation balanced",
    opening: [
      "An equation says two expressions have the same value. If you add, subtract, multiply or divide both sides by the same number (not zero for multiplying and dividing), they still have the same value.",
      "With $x$ on both sides, first remove the variable term from one side, then remove the constant from the other, and finally divide by what multiplies $x$.",
    ],
    example: {
      prompt: "Solve $3(x-4)+2x=x+8$.",
      steps: [
        "Distribute: $3x-12+2x=x+8$, and combine $5x-12=x+8$.",
        "Subtract $x$ from both sides: $4x-12=8$.",
        "Add 12 to both sides: $4x=20$, so $x=5$.",
        "Check: $3(5-4)+10=13$ and $5+8=13$.",
      ],
      answer: "$x=5$",
    },
    methodTitle: "Distribute, combine, collect, divide",
    method: [
      "Distribute any factor over a group, then combine like terms on each side.",
      "Subtract the smaller variable term from both sides, then move the constant.",
      "Decimals follow the same steps: $0.4x$ is a coefficient like any other, and the final division is by a decimal.",
    ],
    formalTitle: "Why the steps keep the solution",
    formal: [
      "Each step turns an equation into an equivalent one, an equation with the same solutions. This holds for adding or subtracting the same quantity and for multiplying or dividing by the same nonzero number.",
      "If the variable coefficients differ, $Ax+B=Cx+D$ has exactly one solution, $x=\\frac{D-B}{A-C}$. If they are equal there is either no solution or every number is a solution.",
    ],
    pitfalls: [
      "Subtract a term to remove it from a side; adding it makes it larger.",
      "The factor outside a group multiplies every term inside, including the constant.",
      "Check the answer in the original equation, not in a step you may have mis-copied.",
    ],
    parentGuide:
      "Ask your learner to say which operation removes each unwanted term, and to substitute the answer back into the original equation.",
  }),
  chainLesson({
    id: "regents-point-slope-two-points",
    title: "Point-slope equation from two points",
    summary:
      "Find the slope between two points and write $y-y_1=m(x-x_1)$ using one of them.",
    templateIds: ["point-slope-two-points"],
    objectives: [
      "Compute the slope of the line through two points, including a fractional or negative slope.",
      "Write the point-slope equation, handling signs when a coordinate is negative.",
    ],
    openingTitle: "One point and a slope fix a line",
    opening: [
      "The slope of a line says how many units $y$ changes for each unit $x$ changes. Between two points it is the change in $y$ divided by the change in $x$.",
      "Point-slope form writes the line through $(x_1,y_1)$ with slope $m$ as $y-y_1=m(x-x_1)$: any point $(x,y)$ on the line has the same slope to $(x_1,y_1)$.",
    ],
    example: {
      prompt: "Write an equation of the line through $(2,-1)$ and $(5,5)$.",
      steps: [
        "Slope: $m=\\frac{5-(-1)}{5-2}=\\frac{6}{3}=2$.",
        "Use the point $(2,-1)$: $y-(-1)=2(x-2)$.",
        "Simplify the sign: $y+1=2(x-2)$.",
        "Check with the other point: $5+1=2(5-2)$, and $6=6$.",
      ],
      answer: "$y+1=2(x-2)$",
    },
    methodTitle: "Slope first, then one point",
    method: [
      "Subtract the $y$ values and the $x$ values in the same order.",
      "Write $y-y_1=m(x-x_1)$ with both coordinates from one point.",
      "Replace subtracting a negative with adding: $y-(-1)$ is $y+1$.",
    ],
    formalTitle: "The point-slope form",
    formal: [
      "For a non-vertical line, the slope between any two of its points is the same number $m$. A point $(x,y)$ is on the line through $(x_1,y_1)$ exactly when $\\frac{y-y_1}{x-x_1}=m$, which gives $y-y_1=m(x-x_1)$.",
      "Using the other given point instead gives an equation that simplifies to the same line.",
    ],
    pitfalls: [
      "The slope is rise over run, not run over rise.",
      "Take $x$ and $y$ from the same point.",
      "A negative coordinate changes the sign inside the equation: $y-(-1)$ becomes $y+1$.",
    ],
    parentGuide:
      "Have your learner check an answer by substituting both given points into the chosen equation.",
  }),
  chainLesson({
    id: "regents-total-and-cost-equation",
    title: "One equation for a count and a total cost",
    summary:
      "Express two kinds of item with one variable using the total count, then equate the money.",
    templateIds: ["total-and-cost-equation"],
    objectives: [
      "Write the second quantity as the total minus the first.",
      "Form the equation price times count for each kind, summed to the total money.",
    ],
    openingTitle: "Two kinds, one total",
    opening: [
      "When two kinds of item make up a known number, choosing a variable for one kind decides the other: if there are 40 items and $n$ are the first kind, the rest are $40-n$.",
      "Each kind earns its price times its count, and the two amounts add to the total money.",
    ],
    example: {
      prompt:
        "A stand sells 30 sandwiches. Large ones cost $9$ dollars and small ones cost $6$ dollars. It takes in $222$ dollars. Write an equation for the number $n$ of large sandwiches.",
      steps: [
        "Large sandwiches: $n$. Small sandwiches: $30-n$.",
        "Money from large: $9n$. Money from small: $6(30-n)$.",
        "Their sum is the total: $9n+6(30-n)=222$.",
        "Solving gives $n=14$, and $9(14)+6(16)=222$.",
      ],
      answer: "$9n+6(30-n)=222$",
    },
    methodTitle: "Count, money, total",
    method: [
      "Let $n$ be one kind; the other is the total count minus $n$.",
      "Price times count gives each kind's money.",
      "Set the sum of the money equal to the total money; the number of items appears only inside the counts.",
    ],
    formalTitle: "Why one variable is enough",
    formal: [
      "Two unknowns $a$ and $b$ with $a+b=N$ satisfy $b=N-a$, so every expression in $b$ can be written in $a$. Substituting turns a system into one equation: $pa+q(N-a)=C$.",
      "The equation has a solution in whole numbers only for certain totals; a context may restrict $a$ to $0\\le a\\le N$.",
    ],
    pitfalls: [
      "Use the total minus $n$ for the other kind, not the whole total.",
      "Pair each price with its own count.",
      "The right side is the money, not the number of items.",
    ],
    parentGuide:
      "Ask your learner to name what each part of the equation counts: items, dollars per item, or dollars.",
  }),
  chainLesson({
    id: "regents-isolate-two-term-formula",
    title: "Solving a formula that has a sum of terms",
    summary:
      "Isolate a variable that appears in only one term of a formula, such as the height in a surface area.",
    templateIds: ["isolate-two-term-formula"],
    objectives: [
      "Remove the terms that do not contain the variable before dividing.",
      "Divide the whole remaining side by the full coefficient of the variable.",
    ],
    openingTitle: "Undo in reverse order",
    opening: [
      "A formula is an equation with letters. To solve it for one letter, undo what was done to that letter, last step first.",
      "In $S=2\\pi r^2+2\\pi rh$ the height is multiplied by $2\\pi r$ and then the term $2\\pi r^2$ is added. Undo the addition first, then the multiplication.",
    ],
    example: {
      prompt: "Solve $P=2\\ell+2w$ for $w$, then solve $S=2b^2+4bh$ for $h$.",
      steps: [
        "For $P$: subtract $2\\ell$ from both sides, $P-2\\ell=2w$.",
        "Divide by 2: $w=\\frac{P-2\\ell}{2}$.",
        "For $S$: subtract $2b^2$, $S-2b^2=4bh$.",
        "Divide by $4b$: $h=\\frac{S-2b^2}{4b}$.",
      ],
      answer: "$w=\\frac{P-2\\ell}{2}$ and $h=\\frac{S-2b^2}{4b}$",
    },
    methodTitle: "Subtract, then divide the whole side",
    method: [
      "Move every term without the variable to the other side by adding or subtracting.",
      "Divide the whole other side by the coefficient of the variable, which may include letters such as $4b$.",
      "For a factor such as $\\frac12$, multiply both sides by 2 first.",
    ],
    formalTitle: "Equivalent equations",
    formal: [
      "Adding the same expression to both sides, or multiplying both sides by the same nonzero expression, gives an equivalent equation. Division by an expression requires it to be nonzero, such as $4b\\neq0$.",
      "The result is a fraction whose numerator is the whole difference. $\\frac{S-2b^2}{4b}$ is not $\\frac{S}{4b}-2b^2$.",
    ],
    pitfalls: [
      "Subtract before you divide.",
      "Divide the entire other side, not just one term of it.",
      "Subtract a term from both sides; adding it moves it the wrong way.",
    ],
    parentGuide:
      "Ask your learner to substitute small numbers for the other letters and check that the new formula gives back the original value.",
  }),
  chainLesson({
    id: "regents-substitute-into-equation",
    title: "Substitution when a variable has coefficient negative one",
    summary:
      "Solve one equation for $y$ with correct signs and substitute into the other equation.",
    templateIds: ["substitute-into-equation"],
    objectives: [
      "Solve an equation such as $3x-y=5$ for $y$ with all signs correct.",
      "Substitute the whole expression, in parentheses, into the other equation.",
    ],
    openingTitle: "Replace a variable by what equals it",
    opening: [
      "If $y=3x-5$, the number $y$ and the expression $3x-5$ are the same, so either may stand in for the other. Putting the expression in place of $y$ in the other equation leaves an equation in $x$ alone.",
      "The only care needed is the sign: from $3x-y=5$, add $y$ and subtract 5 to get $y=3x-5$.",
    ],
    example: {
      prompt:
        "A system has the equations $2x+3y=19$ and $4x-y=5$. Write the equation that results from solving the second equation for $y$ and substituting.",
      steps: [
        "Add $y$ and subtract 5: $y=4x-5$.",
        "Replace $y$ in the first equation, in parentheses: $2x+3(4x-5)=19$.",
        "Solving gives $14x=34$, a single equation in $x$.",
      ],
      answer: "$2x+3(4x-5)=19$",
    },
    methodTitle: "Isolate, parenthesize, replace",
    method: [
      "Isolate $y$: move terms across with the opposite sign.",
      "Put the expression in parentheses where $y$ was in the other equation.",
      "Distribute the multiplier to every term in the parentheses.",
    ],
    formalTitle: "Why substitution works",
    formal: [
      "A pair $(x,y)$ solves both equations when $y=g(x)$ and the other equation holds for that $y$. Replacing $y$ by $g(x)$ in the other equation gives an equation in $x$ alone with the same solutions.",
      "Substitute for the variable that was isolated: the isolated expression equals $y$, not $x$.",
    ],
    pitfalls: [
      "Moving a term to the other side changes its sign.",
      "Keep the substituted expression in parentheses so the multiplier reaches each term.",
      "Substitute into the other equation, never back into the one you solved.",
    ],
    parentGuide:
      "Ask your learner to say what is equal to what before replacing: $y$ is equal to which expression?",
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
export const regentsAlgebraOneLinearFacetMappings: FacetMapping[] = [
  fm(
    "decimal-both-sides-equation",
    "linear-equations.core",
    "Single choice for equations with one-place decimal coefficients and constants and the variable on both sides, with integer solutions. Does not assess equations with no or infinitely many solutions, fractional solutions, or explaining each step.",
  ),
  fm(
    "grouped-both-sides-solve",
    "linear-equations.core",
    "Numeric entry for an integer solution of an equation with one distributed group and variable terms on both sides. Does not assess groups on both sides, rational solutions, equations with no or infinitely many solutions, or explaining the steps.",
  ),
  fm(
    "point-slope-two-points",
    "linear-equation-modeling.core",
    "Single choice for the point-slope equation of the line through two integer points, with whole or fractional slope. Does not assess slope-intercept or standard form, vertical lines, graphing, or writing equations from a context.",
  ),
  fm(
    "total-and-cost-equation",
    "systems-modeling.core",
    "Single choice for the one-variable equation of two priced kinds with a known count and total cost. Does not assess solving the equation, interpreting the solution, or writing the pair of equations.",
  ),
  fm(
    "isolate-two-term-formula",
    "formula-rearrangement.core",
    "Single choice for a cylinder, square-prism or trapezoid formula solved for a variable that sits in one term of a sum. Does not assess formulas that need factoring, square roots, or entering the rearranged formula.",
  ),
  fm(
    "substitute-into-equation",
    "linear-systems.core",
    "Single choice for the equation formed by solving for $y$ when its coefficient is $-1$ and substituting into the other equation. Does not assess finishing the solution, substitution for $x$, or elimination.",
  ),
];
