import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/** Glossary readings for the Regents linear lessons and methods. */
const senses = {
  side: "side-of-equation",
  sides: "side-of-equation",
  term: "term-expression",
  terms: "term-expression",
  difference: "difference-subtract",
  factor: "factor-number",
  base: "base-shape",
  unit: "unit",
  units: "unit",
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
  "kind",
  "kinds",
  "certain",
];

/** What an equation and its two sides are, said on every screen. */
const equationWords =
  "An equation says two amounts are equal, with a left side and a right side of the equals sign. A variable is a letter, such as $x$, that stands for an unknown number. Doing the same thing to both sides keeps them equal: adding, subtracting, or multiplying or dividing by a number that is not 0.";

export const regentsAlgebraOneLinearMethods: Record<string, ProblemMethod> = {
  "decimal-both-sides-equation": {
    goal: "Solve an equation with decimals and with $x$ on both sides, such as $0.4x + 1.2 = 0.1x + 3$.",
    senses,
    noLink,
    intuition: `${equationWords} A decimal such as 0.4 is four tenths, and it follows the same rules. A term is one part joined by + or −, such as $0.4x$. Gather the $x$ terms on one side, the plain numbers on the other, then divide.`,
    terms: [
      [
        "term-expression",
        "A variable term contains the unknown, such as $0.4x$.",
      ],
      "property-of-equality",
    ],
    method: [
      "Subtract the smaller $x$ term from both sides, so $x$ appears on one side only.",
      "Subtract the plain number that sits with the $x$ term from both sides.",
      "Divide both sides by the decimal that multiplies $x$. Check by putting the answer into both sides of the original.",
    ],
    watch:
      "Subtract a term to remove it; adding it doubles it. Keep every decimal point when you combine terms.",
  },
  "grouped-both-sides-solve": {
    goal: "Multiply out parentheses, gather the $x$ terms from both sides, and solve, as in $3(x - 4) + 2x = x + 8$.",
    senses,
    noLink,
    intuition: `${equationWords} A number right before parentheses multiplies everything inside: $3(x - 4)$ means 3 groups of $x - 4$, which is $3x - 12$. This is called distributing. After that, it is an ordinary equation with $x$ on both sides.`,
    terms: ["distribute", "like-terms"],
    method: [
      "Distribute: multiply the number outside by every term inside the parentheses.",
      "Combine like terms (terms with the same letter part, such as $3x$ and $2x$) on each side.",
      "Move the $x$ terms to one side and the plain numbers to the other. Then divide both sides by the number multiplying $x$.",
    ],
    watch:
      "The outside number multiplies the plain number inside too, not only $x$. A negative outside number changes both signs. Check the answer in the original equation.",
  },
  "point-slope-two-points": {
    goal: "Find the slope from two points, then write the line as $y - y_1 = m(x - x_1)$ using one of the points.",
    senses,
    noLink,
    intuition:
      "A point is written $(x, y)$: across, then up. The slope $m$ of a line is its steepness: the change in $y$ divided by the change in $x$ between two points. The form $y - y_1 = m(x - x_1)$ is called point-slope form. Here $(x_1, y_1)$ is one known point; the small 1 just marks it.",
    terms: ["slope", "point-slope-form"],
    method: [
      "Subtract the $y$ values, then the $x$ values in the same order, and divide: that is $m$.",
      "Choose one point $(x_1, y_1)$ and write $y - y_1 = m(x - x_1)$ with its numbers.",
      "Tidy the signs: subtracting a negative number is adding, so $y - (-2)$ is $y + 2$.",
    ],
    watch:
      "Use the $x$ and $y$ of the same point. The slope is the change in $y$ over the change in $x$, not the other way up.",
  },
  "total-and-cost-equation": {
    goal: "Write one equation with one letter for two kinds of item, from their prices, how many in all, and the total cost.",
    senses,
    noLink,
    intuition:
      "Say 30 sandwiches are large or small. If $n$ of them are large, the rest, $30 - n$, are small. Each kind's money is its price times how many were sold. The two money amounts add up to the total money. So one letter, $n$, is enough.",
    terms: ["unknown", "sum"],
    method: [
      "Let $n$ be how many of one kind there are. The other kind is the total count minus $n$.",
      "Write price times count for each kind.",
      "Set the sum of the two money amounts equal to the total money.",
    ],
    watch:
      "Pair each price with its own count. The right side of the equation is the money, not the number of items.",
  },
  "isolate-two-term-formula": {
    goal: "Rearrange a formula for one letter when that letter is in only one of its terms.",
    senses,
    noLink,
    intuition:
      "A formula is an equation that links amounts with letters, such as $P = 2l + 2w$. Its terms are the parts joined by + or −. To get one letter alone, use the same steps as for any equation, treating the other letters as known numbers. Remove the terms added to your letter's term first. Then divide by everything that multiplies your letter.",
    terms: [
      "isolate",
      [
        "coefficient",
        "Here it may contain other letters: in $(a + b)h$, the coefficient of $h$ is $a + b$.",
      ],
    ],
    method: [
      "Subtract (or add) the terms that do not contain your letter, on both sides.",
      "Divide the whole other side by everything that multiplies your letter.",
      "Check that your letter now appears on one side only.",
    ],
    watch:
      "Subtract before you divide, and divide the whole difference. Writing $\\frac{S}{2\\pi r}-2\\pi r^2$ divides only part of the right side.",
  },
  "substitute-into-equation": {
    goal: "Solve one equation for $y$, then put that expression in place of $y$ in the other equation, keeping signs right.",
    senses,
    noLink,
    intuition:
      "A system is two equations about the same unknowns $x$ and $y$. If $y$ equals an expression, such as $y = 4x - 5$, you may write that expression wherever $y$ appears. This is called substituting. It turns two equations with two letters into one equation with one letter.",
    terms: ["substitute", "system-of-equations"],
    method: [
      "Get $y$ alone in one equation. In $4x - y = 5$, add $y$ to both sides and subtract 5 from both sides: $y = 4x - 5$.",
      "In the other equation, replace $y$ with the whole expression, in parentheses.",
      "Multiply any number outside the parentheses by every term inside before solving.",
    ],
    watch:
      "Put the expression in parentheses so a multiplier reaches every term. Replace the letter you solved for, not the other one.",
  },
};

export const regentsAlgebraOneLinearPrinciples: Record<string, string> = {
  "decimal-both-sides-equation":
    "Adding or subtracting the same number on both sides of an equation, or multiplying or dividing both sides by the same number other than 0, keeps its solutions. For $ax + b = cx + d$ with $a \\ne c$, the one solution is $x = \\frac{d - b}{a - c}$.",
  "grouped-both-sides-solve":
    "Distributing gives $p(x + q) = px + pq$. After combining like terms, an equation $Ax + B = Cx + D$ with $A \\ne C$ has exactly one solution, $x = \\frac{D - B}{A - C}$.",
  "point-slope-two-points":
    "A line that is not vertical, through $(x_1, y_1)$ and $(x_2, y_2)$, has slope $m = \\frac{y_2 - y_1}{x_2 - x_1}$ and equation $y - y_1 = m(x - x_1)$. Using the other point gives an equation of the same line.",
  "total-and-cost-equation":
    "If two groups have $N$ items in all and $n$ are of the first kind, then $N - n$ are of the second kind. With prices $p$ and $q$, the total cost is $pn + q(N - n)$. So the cost fact is the single equation $pn + q(N - n) = C$.",
  "isolate-two-term-formula":
    "Doing the same step to both sides keeps an equation's solutions. To solve a formula for one letter, undo the steps that built it in reverse order. First undo adding or subtracting the other terms, then undo multiplying by the letter's coefficient, which must not be 0.",
  "substitute-into-equation":
    "If $y = g(x)$, then $y$ and $g(x)$ may replace each other in any equation. A pair $(x, y)$ makes both equations of a system true exactly when $y = g(x)$ and $x$ makes the equation formed by substituting $g(x)$ for $y$ true.",
};

export const regentsAlgebraOneLinearLessons = [
  {
    senses,
    noLink,
    ...chainLesson({
      id: "regents-both-sides-equations",
      title: "Equations with the variable on both sides",
      summary:
        "An equation says two amounts are equal, like $3(x - 4) + 2x = x + 8$. Here the unknown $x$ appears on both sides of the equals sign. Do the same step to both sides, so they stay equal. Gather all the $x$ terms on one side and the plain numbers on the other. Then divide to find $x$.",
      templateIds: ["decimal-both-sides-equation", "grouped-both-sides-solve"],
      objectives: [
        "Move the $x$ terms to one side and the plain numbers to the other, doing the same step to both sides.",
        "Multiply out parentheses and work with decimals, then check the solution.",
      ],
      openingTitle: "Keep the equation balanced",
      opening: [
        "An equation says two amounts have the same value: the left side equals the right side. A variable, such as $x$, is a letter that stands for an unknown number. A solution is a value of $x$ that makes the two sides equal.",
        "If you add or subtract the same number on both sides, they stay equal. The same is true for multiplying or dividing both sides by a number that is not 0.",
        "A term is a part joined to the rest by + or −, such as $5x$ or $-12$. With $x$ on both sides, first remove the $x$ term from one side. Then remove the plain number from the other side. Finally, divide by the number that multiplies $x$.",
        "A number right before parentheses multiplies everything inside: $3(x - 4) = 3x - 12$. Doing this is called distributing.",
      ],
      example: {
        prompt: "Solve $3(x-4)+2x=x+8$.",
        steps: [
          "Distribute the 3 to both terms in the parentheses: $3x-12+2x=x+8$. Combine the $x$ terms on the left, $3x+2x=5x$: $5x-12=x+8$.",
          "Subtract $x$ from both sides, so $x$ is only on the left: $4x-12=8$.",
          "Add 12 to both sides to undo the $-12$: $4x=20$. Divide both sides by 4: $x=5$.",
          "Check in the original: $3(5-4)+10=3+10=13$ and $5+8=13$. Both sides match.",
        ],
        answer: "$x=5$",
      },
      methodTitle: "Distribute, combine, collect, divide",
      method: [
        "Distribute any number outside parentheses, then combine like terms (terms with the same letter part) on each side.",
        "Subtract the smaller $x$ term from both sides. Then move the plain number to the other side.",
        "Decimals follow the same steps. In $0.4x$, 0.4 is the number multiplying $x$, and the last step divides by that decimal.",
      ],
      formalTitle: "Why the steps keep the solution",
      formal: [
        "Each step turns an equation into an equivalent one: an equation with exactly the same solutions. This holds for adding or subtracting the same amount, and for multiplying or dividing by the same number other than 0.",
        "If the numbers multiplying $x$ differ on the two sides, $Ax + B = Cx + D$ has exactly one solution, $x = \\frac{D - B}{A - C}$. If they are equal, there is either no solution or every number is a solution.",
      ],
      pitfalls: [
        "Subtract a term to remove it from a side; adding it makes it larger.",
        "The number outside parentheses multiplies every term inside, including the plain number.",
        "Check the answer in the original equation, not in a step you may have copied wrong.",
      ],
      parentGuide:
        "Ask your learner to say which step removes each unwanted term, and to put the answer back into the original equation.",
    }),
  },
  {
    senses,
    noLink,
    ...chainLesson({
      id: "regents-point-slope-two-points",
      title: "Point-slope equation from two points",
      summary:
        "The slope of a line says how steep it is: how much $y$ changes when $x$ goes up by 1. Two points on a line give its slope. Then one of the points and the slope give the line's equation, $y - y_1 = m(x - x_1)$. Here $m$ is the slope and $(x_1, y_1)$ is the point you chose.",
      templateIds: ["point-slope-two-points"],
      objectives: [
        "Find the slope of the line through two points, including a fraction or negative slope.",
        "Write the point-slope equation, handling signs when a coordinate is negative.",
      ],
      openingTitle: "One point and a slope fix a line",
      opening: [
        "A point is written $(x, y)$: across $x$, then up $y$. The two numbers are called its coordinates.",
        "The slope of a line says how many units $y$ changes for each unit $x$ changes. Between two points, it is the change in $y$ divided by the change in $x$.",
        "Point-slope form writes the line through the point $(x_1, y_1)$ with slope $m$ as $y - y_1 = m(x - x_1)$. The small 1 only marks the known point. It works because every other point $(x, y)$ on the line has that same slope to $(x_1, y_1)$.",
      ],
      example: {
        prompt: "Write an equation of the line through $(2,-1)$ and $(5,5)$.",
        steps: [
          "Find the slope: the change in $y$ over the change in $x$, in the same order. $m=\\frac{5-(-1)}{5-2}=\\frac{6}{3}=2$.",
          "Choose the point $(2,-1)$, so $x_1=2$ and $y_1=-1$. Put them in: $y-(-1)=2(x-2)$.",
          "Subtracting a negative is adding, so tidy the sign: $y+1=2(x-2)$.",
          "Check with the other point, $(5, 5)$: $5+1=6$ and $2(5-2)=6$. Both sides match.",
        ],
        answer: "$y+1=2(x-2)$",
      },
      methodTitle: "Slope first, then one point",
      method: [
        "Subtract the $y$ values, then the $x$ values in the same order, and divide.",
        "Write $y - y_1 = m(x - x_1)$ with both numbers taken from one point.",
        "Replace subtracting a negative with adding: $y - (-1)$ is $y + 1$.",
      ],
      formalTitle: "The point-slope form",
      formal: [
        "For a line that is not vertical, the slope between any two different points of it is the same number $m$. A point $(x, y)$ other than $(x_1, y_1)$ is on the line exactly when $\\frac{y - y_1}{x - x_1} = m$. Multiplying both sides by $x - x_1$ gives $y - y_1 = m(x - x_1)$, which $(x_1, y_1)$ also makes true.",
        "Using the other given point instead gives an equation that simplifies to the same line.",
      ],
      pitfalls: [
        "The slope is the change in $y$ over the change in $x$, not the other way up.",
        "Take $x_1$ and $y_1$ from the same point.",
        "A negative coordinate changes the sign inside the equation: $y - (-1)$ becomes $y + 1$.",
      ],
      parentGuide:
        "Have your learner check an answer by putting both given points into the chosen equation.",
    }),
  },
  {
    senses,
    noLink,
    ...chainLesson({
      id: "regents-total-and-cost-equation",
      title: "One equation for a count and a total cost",
      summary:
        "Say a stand sells 30 sandwiches, some large and some small. If $n$ are large, the other $30 - n$ are small. So one letter describes both kinds. Each kind's money is its price times how many were sold. Add the two money amounts and set the sum equal to the total money.",
      templateIds: ["total-and-cost-equation"],
      objectives: [
        "Write the second amount as the total minus the first.",
        "Write the equation: price times count for each kind, added up, equals the total money.",
      ],
      openingTitle: "Two kinds, one total",
      opening: [
        "A variable is a letter, such as $n$, that stands for an unknown number. When two kinds of item make up a known number, choosing a letter for one kind decides the other. If there are 40 items and $n$ are the first kind, the rest are $40 - n$.",
        "Each kind brings in its price times how many there are. The two amounts add up to the total money. Writing that as an equation (a statement that two amounts are equal) gives one equation with one letter.",
      ],
      example: {
        prompt:
          "A stand sells 30 sandwiches. Large ones cost $9$ dollars and small ones cost $6$ dollars. It takes in $222$ dollars. Write an equation for the number $n$ of large sandwiches.",
        steps: [
          "Name the counts with one letter. Large sandwiches: $n$. The rest are small: $30-n$.",
          "Each kind's money is price times count. Money from large: $9n$. Money from small: $6(30-n)$, which means 6 times $(30-n)$.",
          "The two amounts add up to the total money: $9n+6(30-n)=222$.",
          "Solving gives $n=14$. Check: $9(14)+6(16)=126+96=222$.",
        ],
        answer: "$9n+6(30-n)=222$",
      },
      methodTitle: "Count, money, total",
      method: [
        "Let $n$ be one kind. The other kind is the total count minus $n$.",
        "Price times count gives each kind's money.",
        "Set the sum of the money equal to the total money. The number of items appears only inside the counts.",
      ],
      formalTitle: "Why one variable is enough",
      formal: [
        "Two unknowns $a$ and $b$ with $a + b = N$ have $b = N - a$, so anything written with $b$ can be written with $a$. Substituting turns two equations into one: $pa + q(N - a) = C$.",
        "The equation has a whole-number solution only for certain totals. A real situation may also require $0 \\le a \\le N$: $a$ is between 0 and $N$.",
      ],
      pitfalls: [
        "Use the total minus $n$ for the other kind, not the whole total.",
        "Pair each price with its own count.",
        "The right side is the money, not the number of items.",
      ],
      parentGuide:
        "Ask your learner to name what each part of the equation counts: items, dollars per item, or dollars.",
    }),
  },
  {
    senses,
    noLink,
    ...chainLesson({
      id: "regents-isolate-two-term-formula",
      title: "Solving a formula that has a sum of terms",
      summary:
        "A formula is an equation that links amounts with letters, like $P = 2\\ell + 2w$ for a rectangle's perimeter (the distance around it). To solve it for one letter, get that letter alone on one side. First take away the parts that do not contain it. Then divide by whatever multiplies it.",
      templateIds: ["isolate-two-term-formula"],
      objectives: [
        "Remove the terms that do not contain the chosen letter before dividing.",
        "Divide the whole other side by everything that multiplies the chosen letter.",
      ],
      openingTitle: "Undo in reverse order",
      opening: [
        "A formula is an equation with letters. Its terms are the parts joined by + or −. To solve it for one letter, undo what was done to that letter, last step first. Do each step to both sides.",
        "A cylinder is a can shape with radius $r$ (half the width of its circle) and height $h$. Its surface area is $S = 2\\pi r^2 + 2\\pi rh$, where $r^2$ means $r$ times $r$ and $\\pi$ is about 3.14. Here $h$ is multiplied by $2\\pi r$, and then the term $2\\pi r^2$ is added. So undo the adding first, then the multiplying.",
      ],
      example: {
        prompt: "Solve $P=2\\ell+2w$ for $w$, then solve $S=2b^2+4bh$ for $h$.",
        steps: [
          "For $P$: the term $2\\ell$ has no $w$, so subtract it from both sides: $P-2\\ell=2w$.",
          "$w$ is multiplied by 2, so divide both sides by 2: $w=\\frac{P-2\\ell}{2}$.",
          "For $S$: the term $2b^2$ has no $h$, so subtract it from both sides: $S-2b^2=4bh$.",
          "$h$ is multiplied by $4b$ (which is not 0), so divide both sides by $4b$: $h=\\frac{S-2b^2}{4b}$.",
        ],
        answer: "$w=\\frac{P-2\\ell}{2}$ and $h=\\frac{S-2b^2}{4b}$",
      },
      methodTitle: "Subtract, then divide the whole side",
      method: [
        "Move every term without your letter to the other side, by adding or subtracting on both sides.",
        "Divide the whole other side by everything that multiplies your letter, which may include letters such as $4b$.",
        "If the letter is multiplied by a fraction such as $\\frac12$, multiply both sides by 2 first.",
      ],
      formalTitle: "Equivalent equations",
      formal: [
        "Adding the same expression to both sides, or multiplying both sides by the same expression that is not 0, keeps the solutions. Dividing by an expression needs it to be not 0, such as $4b\\neq0$.",
        "The answer is a fraction whose top is the whole difference. $\\frac{S-2b^2}{4b}$ is not $\\frac{S}{4b}-2b^2$.",
      ],
      pitfalls: [
        "Subtract before you divide.",
        "Divide the entire other side, not just one term of it.",
        "Subtract a term from both sides to remove it; adding it moves it the wrong way.",
      ],
      parentGuide:
        "Ask your learner to put small numbers in for the other letters, and check that the new formula gives back the original value.",
    }),
  },
  {
    senses,
    noLink,
    ...chainLesson({
      id: "regents-substitute-into-equation",
      title: "Substitution when a variable has coefficient negative one",
      summary:
        "A system is two equations about the same unknowns $x$ and $y$. If one equation tells you what $y$ equals, you can put that in place of $y$ in the other equation. This is called substituting. Getting $y$ alone needs care with signs when the equation has $-y$, as in $4x - y = 5$.",
      templateIds: ["substitute-into-equation"],
      objectives: [
        "Solve an equation such as $3x - y = 5$ for $y$ with every sign right.",
        "Put the whole expression, in parentheses, in place of $y$ in the other equation.",
      ],
      openingTitle: "Replace a variable by what equals it",
      opening: [
        "If $y = 3x - 5$, then $y$ and the expression $3x - 5$ are the same number. So either one may stand in for the other. Putting $3x - 5$ in place of $y$ in the other equation leaves an equation with $x$ alone.",
        "The number multiplying a letter is called its coefficient. In $3x - y = 5$, the coefficient of $y$ is $-1$, because $-y$ means $-1$ times $y$. To get $y$ alone, add $y$ to both sides and subtract 5 from both sides: $y = 3x - 5$.",
      ],
      example: {
        prompt:
          "A system has the equations $2x+3y=19$ and $4x-y=5$. Write the equation that results from solving the second equation for $y$ and substituting.",
        steps: [
          "Get $y$ alone in $4x-y=5$. Add $y$ to both sides: $4x=5+y$. Subtract 5 from both sides: $y=4x-5$.",
          "In the first equation, replace $y$ with the whole expression, in parentheses, so the 3 multiplies all of it: $2x+3(4x-5)=19$.",
          "This is one equation with $x$ alone. Distributing gives $2x+12x-15=19$, so $14x=34$.",
        ],
        answer: "$2x+3(4x-5)=19$",
      },
      methodTitle: "Isolate, parenthesize, replace",
      method: [
        "Get $y$ alone by doing the same step to both sides. A term that moves to the other side changes sign.",
        "Put the expression in parentheses where $y$ was in the other equation.",
        "Multiply any number outside the parentheses by every term inside.",
      ],
      formalTitle: "Why substitution works",
      formal: [
        "A pair $(x, y)$ solves both equations when $y = g(x)$ and the other equation is true for that $y$. Replacing $y$ with $g(x)$ in the other equation gives an equation in $x$ alone, with the same solutions.",
        "Replace the letter you got alone: the expression equals $y$, not $x$.",
      ],
      pitfalls: [
        "A term moved to the other side changes its sign.",
        "Keep the expression in parentheses so the multiplier reaches each term.",
        "Substitute into the other equation, never back into the one you solved.",
      ],
      parentGuide:
        "Ask your learner to say what is equal to what before replacing: $y$ equals which expression?",
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
