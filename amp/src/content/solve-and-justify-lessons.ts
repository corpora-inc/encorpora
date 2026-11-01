import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "solve-justify-linear",
    title: "Solve a linear equation and justify each step",
    summary:
      "Each line of a solution follows from the one before by one property: distribute, combine, or do the same to both sides.",
    objectives: [
      "Solve a linear equation with grouping, a fraction or variables on both sides, one line at a time.",
      "Name the property of equality, or the distributive property, that turns each line into the next.",
    ],
    intuition:
      "An equation is a balance: both sides have the same value. Rewriting one side in an equal form (distributing, combining like terms) keeps it balanced, and so does doing the same operation to both sides. Each line of a solution is one such move, and its reason names which move it was.",
    terms: ["property-of-equality", "like-terms"],
    method: [
      "Simplify each side: distribute a number over parentheses (distributive property) and combine like terms.",
      "Gather the variable terms on one side by adding or subtracting a term on both sides (addition or subtraction property of equality).",
      "Move the constants to the other side the same way.",
      "Divide (or multiply) both sides by the coefficient of the variable. Write the reason beside every line.",
    ],
    watch:
      "A move must happen to both whole sides. Subtracting 6 from only the left side, or dividing only the first term by 3, breaks the balance.",
    principle:
      "If $a=b$, then $a+c=b+c$, $a-c=b-c$, $ac=bc$, and $\\frac{a}{c}=\\frac{b}{c}$ for $c\\neq0$. Replacing an expression by an equal expression (distributive property, combining like terms, reordering terms) also keeps an equation's solutions. Each line therefore has exactly the solutions of the line before it.",
    example: {
      prompt: "Solve $3(x+2)+4=22$ and justify each step.",
      steps: [
        "$3x+6+4=22$ — Distributive property.",
        "$3x+10=22$ — Combine like terms.",
        "$3x=12$ — Subtraction property of equality (subtract 10 from both sides).",
        "$x=4$ — Division property of equality (divide both sides by 3).",
        "Check: $3(4+2)+4=18+4=22$.",
      ],
      answer: "$x=4$",
    },
    methodTitle: "Other orders are correct too",
    methodText: [
      "From $3(x+2)+4=22$ you may subtract 4 first: $3(x+2)=18$, then divide by 3: $x+2=6$, then subtract 2: $x=4$. Every line still follows from the one before it by its reason.",
      "A reason names the move, not the result. Going from $3x=12$ to $x=4$ divides both sides by 3, so the reason is the division property of equality.",
    ],
    formal:
      "Each property of equality applies an operation that can be undone (subtract after adding, divide by a nonzero number after multiplying), so a value makes the new line true exactly when it makes the old line true. A chain of such lines ending in $x=c$ shows that $c$ is the only solution.",
    pitfalls: [
      "Distribute to every term in the parentheses: $3(x+2)=3x+6$, not $3x+2$.",
      "Keep the sign with its term when you move it: subtracting $-5$ adds 5.",
      "The reason belongs to the move that made the line, not the next one.",
    ],
    parentGuide:
      "Cover one line of your learner's solution and ask what was done to both sides to get it, and which property says that is allowed.",
  },
  {
    id: "solve-justify-inequality",
    title: "Solve a linear inequality and justify each step",
    summary:
      "Solve an inequality with the moves for an equation, but reverse the sign when multiplying or dividing by a negative number.",
    objectives: [
      "Solve a linear inequality with grouped terms, writing each line and its property.",
      "Reverse the inequality sign exactly when multiplying or dividing by a negative number.",
    ],
    intuition:
      "Adding the same amount to two numbers keeps their order: if $a<b$ then $a+5<b+5$. Multiplying by a positive number keeps it too. Multiplying by a negative number flips the number line, so the larger number becomes the smaller: $2<3$ but $-2>-3$.",
    terms: ["reverse-inequality-sign", "solution-set"],
    method: [
      "Distribute and combine like terms on each side.",
      "Add or subtract terms on both sides to get the variable terms on one side and the constants on the other. The sign stays the same.",
      "Divide both sides by the coefficient of the variable. If it is negative, reverse the sign.",
      "Name the property of inequality for each line.",
    ],
    watch:
      "Only multiplying or dividing by a negative number reverses the sign. Subtracting a number, or having a negative answer, does not.",
    principle:
      "If $a<b$, then $a+c<b+c$ for every $c$; $ac<bc$ when $c>0$; and $ac>bc$ when $c<0$. The same holds for $\\le$, $>$ and $\\ge$. These moves can be undone, so each line has the same solution set as the line before it.",
    example: {
      prompt: "Solve $-2(x-3)\\le14$ and justify each step.",
      steps: [
        "$-2x+6\\le14$ — Distributive property.",
        "$-2x\\le8$ — Subtraction property of inequality.",
        "$x\\ge-4$ — Division property of inequality; dividing by $-2$ reverses the sign.",
        "Check a value: $x=0$ gives $-2(0-3)=6\\le14$, true, and $0\\ge-4$.",
      ],
      answer: "$x\\ge-4$",
    },
    methodTitle: "Check with one value",
    methodText: [
      "Pick a number in your solution set and one outside it. The first must make the original inequality true and the second false.",
      "Writing the variable on the right is allowed: $-4\\le x$ means the same as $x\\ge-4$.",
    ],
    formal:
      "Multiplying both sides of $a<b$ by $c<0$ gives $ac>bc$ because $bc-ac=c(b-a)$ is a negative number times a positive one. That is why dividing by a negative coefficient, which multiplies by its reciprocal, reverses the sign.",
    pitfalls: [
      "Reverse the sign when dividing by a negative coefficient, not when the constant is negative.",
      "Distribute a negative factor to every term: $-2(x-3)=-2x+6$.",
    ],
    parentGuide:
      "Ask your learner to test one number from their answer in the original inequality and explain why the sign flipped or did not.",
  },
  {
    id: "solve-justify-formula",
    title: "Solve a formula for one of its variables",
    summary:
      "Solve a formula for one letter with the properties of equality, treating the other letters as numbers.",
    objectives: [
      "Rearrange a formula to get a named variable alone on one side.",
      "Justify each step, including dividing by a letter that stands for a positive measurement.",
    ],
    intuition:
      "In $A=bh$, the height $h$ is multiplied by the base $b$. To get $h$ alone, undo that multiplication by dividing both sides by $b$, just as you would divide by 5 in $20=5h$. The other letters stay in the answer.",
    terms: [
      [
        "isolate",
        "To solve for $h$, isolate $h$ so it appears on one side only.",
      ],
      [
        "inverse-operation",
        "To undo several steps, apply inverse operations in reverse order: undo the last operation first.",
      ],
    ],
    method: [
      "Find the operations done to the target letter and their order.",
      "Undo them in reverse order, doing the same thing to both sides each time.",
      "Divide by a letter only when it cannot be 0; lengths, areas and rates of real objects are positive.",
      "Name the property for each line. Swapping the two sides is the symmetric property.",
    ],
    watch:
      "Divide the whole side, not one term: from $P-2L=2W$, the next line is $\\frac{P-2L}{2}=W$, not $P-L=W$.",
    principle:
      "The properties of equality hold for expressions as well as numbers: if $a=b$ then $\\frac{a}{c}=\\frac{b}{c}$ for any expression $c$ that is not 0. A formula solved for a variable gives that variable's value for any allowed values of the others.",
    example: {
      prompt:
        "The area of a triangle is $A=\\frac{1}{2}bh$. Solve for $h$ and justify each step.",
      steps: [
        "$2A=bh$ — Multiplication property of equality (multiply both sides by 2).",
        "$\\frac{2A}{b}=h$ — Division property of equality (divide both sides by $b$, a positive length).",
        "$h=\\frac{2A}{b}$ — Symmetric property of equality.",
        "Check: a triangle with $b=4$ and $h=5$ has $A=10$, and $\\frac{2\\cdot10}{4}=5$.",
      ],
      answer: "$h=\\frac{2A}{b}$",
    },
    methodTitle: "Test with numbers",
    methodText: [
      "Choose values for the letters that fit the original formula, then put them into your rearranged one. The target letter must come out right.",
      "If the target letter is added to something, subtract that first; if it is then multiplied, divide after.",
    ],
    formal:
      "Rearranging uses only reversible steps, so for every set of values of the other letters (with every divisor nonzero) the rearranged formula gives exactly the value of the target letter that makes the original formula true.",
    pitfalls: [
      "Do the same operation to both whole sides.",
      "Clear a fraction coefficient such as $\\frac{1}{2}$ by multiplying by its reciprocal, 2.",
    ],
    parentGuide:
      "Ask your learner to pick numbers for the other letters and check that their rearranged formula gives the right value.",
  },
  {
    id: "solve-justify-quadratic",
    title: "Solve a quadratic equation by factoring",
    summary:
      "Move every term to one side, factor, and use the zero-product property: a product is 0 only when one of its factors is 0.",
    objectives: [
      "Write a quadratic equation with 0 on one side and factor the other side.",
      "Use the zero-product property to split it into two linear equations and solve each, naming every step.",
    ],
    intuition:
      "If two numbers multiply to 0, one of them must be 0. So once $(x-2)(x+5)=0$, either $x-2=0$ or $x+5=0$. That works only with 0 on one side: $(x-2)(x+5)=6$ says nothing about either factor alone.",
    terms: [
      "zero-product-property",
      [
        "standard-form-polynomial",
        "For a quadratic equation, $ax^2 + bx + c = 0$, with every term on one side and 0 on the other.",
      ],
    ],
    method: [
      "Add or subtract terms so one side is 0. Divide by a common factor of every coefficient if there is one.",
      "Factor: find two numbers whose product is the constant term and whose sum is the coefficient of $x$.",
      "Use the zero-product property: write each factor equal to 0, joined by “or”.",
      "Solve each linear equation. Check both values in the original equation.",
    ],
    watch:
      "Factor only after one side is 0, and keep both solutions: dividing both sides by $x$ or a factor loses a solution.",
    principle:
      "For real numbers, $ab=0$ exactly when $a=0$ or $b=0$. So when $x^2+bx+c=(x-r)(x-s)$, the equation $x^2+bx+c=0$ holds exactly when $x=r$ or $x=s$.",
    example: {
      prompt: "Solve $x^2+3x=10$ by factoring and justify each step.",
      steps: [
        "$x^2+3x-10=0$ — Subtraction property of equality.",
        "$(x+5)(x-2)=0$ — Factoring: $5\\cdot(-2)=-10$ and $5+(-2)=3$.",
        "$x+5=0$ or $x-2=0$ — Zero-product property.",
        "$x=-5$ or $x=2$ — Subtraction and addition properties of equality.",
        "Check: $(-5)^2+3(-5)=10$ and $2^2+3(2)=10$.",
      ],
      answer: "$x=-5$ or $x=2$",
    },
    methodTitle: "Multiply back to check the factoring",
    methodText: [
      "Expanding $(x+5)(x-2)$ gives $x^2-2x+5x-10=x^2+3x-10$, the expression you factored. If it does not match, try another pair of numbers.",
      "A common factor can stay in front: $2(x+5)(x-2)=0$ also gives $x=-5$ or $x=2$, because the factor 2 is never 0.",
    ],
    formal:
      "Multiplying out $(x-r)(x-s)$ gives $x^2-(r+s)x+rs$, so the numbers in the factors have sum $-b$ and product $c$. Every step before the zero-product property rewrites the equation equivalently, and the property itself splits it into equations with the same solutions.",
    pitfalls: [
      "Get 0 on one side before using the zero-product property.",
      "Solve $x+5=0$ to $x=-5$: the solution has the opposite sign of the number in the factor.",
    ],
    parentGuide:
      "Ask your learner to multiply their factors back out and to explain why one side must be 0 before splitting the factors.",
  },
];

export const solveJustifyContent = workContent(entries);

export const solveJustifyFacetMappings: FacetMapping[] = [
  {
    templateId: "solve-justify-linear",
    facetId: "equation-reasoning.justify-steps",
    extent: "partial",
    rationale:
      "Typed lines of a linear equation's solution (grouping, a fraction, variables on both sides; integer solutions) each graded as a valid move from the line before by the reason chosen from a bank of equality properties, distributing, combining and reordering; any valid path is accepted. Fill-in and ordering forms ask for the reasons of given lines or their order. Does not assess written paragraphs or equations without a solution or with every number a solution.",
  },
  {
    templateId: "solve-justify-linear",
    facetId: "equation-reasoning.HSA.REI.A.1",
    extent: "partial",
    rationale:
      "Each step of solving a linear equation is explained by naming the property of equality, the distributive property or combining like terms, and the server checks that the step follows from the previous line by that property. Viable arguments for nonlinear equations are not assessed.",
  },
  {
    templateId: "solve-justify-inequality",
    facetId: "linear-inequalities.grouped-solution-set",
    extent: "partial",
    rationale:
      "Typed lines solving a linear inequality with grouped terms, on one or both sides, each checked as a valid move by its named property of inequality, including reversing the sign when dividing by a negative coefficient; the last line must state the exact solution set. Does not assess graphing the solution or compound inequalities.",
  },
  {
    templateId: "solve-justify-formula",
    facetId: "formula-rearrangement.isolate-variable",
    extent: "partial",
    rationale:
      "Typed lines rearranging area, perimeter, volume, distance, simple-interest and temperature formulas for a named variable, each checked as a valid move by its named property; division by a letter is accepted only for letters that measure positive quantities. The final formula is checked by exact symbolic equivalence. Does not assess substituting values afterward.",
  },
  {
    templateId: "solve-justify-quadratic",
    facetId: "quadratic-equations.HSA.REI.B.4",
    extent: "partial",
    rationale:
      "Typed lines solving a monic quadratic (or one with a common factor) with two integer roots by moving terms, factoring and the zero-product property, each checked by its named reason; the last line must give both roots. Does not assess square roots, completing the square, the quadratic formula or complex solutions.",
  },
];
