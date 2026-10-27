import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const oneStepResultMethods: Record<string, ProblemMethod> = {
  "equation-after-one-step": {
    goal: "Choose the equation that results from one inverse step done to both sides of a two-step equation.",
    intuition:
      "An equation is a balance. To keep it balanced, whatever is done to one side is done to the other, and to every term on that side. One step removes one operation: a constant, a factor outside parentheses, or a division.",
    terms: [
      [
        "inverse operation",
        "The operation that undoes another: subtraction undoes addition, and division undoes multiplication.",
      ],
      [
        "equivalent equations",
        "Equations that have the same solution, such as $2x+3=11$ and $2x=8$.",
      ],
    ],
    method: [
      "Find the operation to undo: the constant added to the variable term, the factor outside the parentheses, or the number dividing $x$.",
      "Do the opposite operation to both entire sides, to every term on a side that has several terms.",
      "Rewrite the equation after that one step only, and compare it with each option before choosing.",
    ],
    watch:
      "Change both sides, and every term. Doing the step to one side only, or to only one term, gives an equation with a different solution.",
  },
  "expression-after-first-step": {
    goal: "Choose the expression that results from only the first step of the order of operations, or find the first line that skips a bracket.",
    intuition:
      "The order of operations says which operation is done first: parentheses, then multiplication and division, then addition and subtraction. Doing only the first step rewrites one part of the expression and leaves the rest as it was.",
    terms: [
      [
        "order of operations",
        "The agreed order for evaluating: parentheses, then multiplication and division, then addition and subtraction.",
      ],
      [
        "first step",
        "The single operation done before any other, with everything else copied unchanged.",
      ],
    ],
    method: [
      "Find the parentheses and look inside them for the operation that comes first.",
      "Do that one operation and copy everything else exactly as it was.",
      "To check student work, redo the first step yourself and compare each line with the line before it.",
    ],
    watch:
      "Inside parentheses the same order applies: a product is done before a sum or difference. Do not finish the whole bracket when the question asks for one step.",
  },
  "factor-out-choice": {
    goal: "Choose the equivalent expression after a stated number, positive or negative, is factored out of a linear expression.",
    intuition:
      "Factoring out a number reverses distributing. If every term of an expression is a multiple of the same number, the number can be written once in front, and each term is divided by it inside parentheses.",
    terms: [
      [
        "factor out",
        "Write a common factor in front of parentheses and divide every term by it inside.",
      ],
      [
        "common factor",
        "A number that divides every term of an expression exactly.",
      ],
    ],
    method: [
      "Divide every term of the expression by the stated factor, keeping each sign.",
      "Write the factor, then the quotients inside parentheses.",
      "Check by distributing the factor: each product must give back the original term.",
    ],
    watch:
      "Divide every term, including the constant, and keep signs. Factoring out a negative number changes the sign of each quotient.",
  },
  "step-reason-table": {
    goal: "Choose the list of properties that justifies each line of a shown linear equation solution.",
    intuition:
      "Each line of a solution follows from the line before it by one property. Naming the property says why the step keeps the same solution: equal operations on both sides keep an equation balanced, and the distributive property rewrites a product without changing its value.",
    terms: [
      [
        "property of equality",
        "A rule saying that adding, subtracting, multiplying or dividing both sides of an equation by the same number gives an equivalent equation.",
      ],
      [
        "distributive property",
        "$a(b+c)=ab+ac$: multiplying a group is the same as multiplying each term.",
      ],
    ],
    method: [
      "Compare two neighbouring lines and decide what changed: a group was multiplied out, or the same number was added, subtracted, multiplied or divided on both sides.",
      "Name that property, using the opposite operation of the one that was undone.",
      "Repeat for each pair of lines, then match the whole list with an option.",
    ],
    watch:
      "Undoing addition is the subtraction property, and undoing division is the multiplication property. Check the order of the steps too.",
  },
};

export const oneStepResultPrinciples: Record<string, string> = {
  "equation-after-one-step":
    "If $A=B$, then $A+k=B+k$, $A-k=B-k$, $kA=kB$ and, for $k\\ne 0$, $A/k=B/k$. The new equation has the same solution as the old one, provided the same operation is applied to every term of both sides.",
  "expression-after-first-step":
    "Evaluation follows a fixed precedence: grouping, then multiplication and division from left to right, then addition and subtraction from left to right. Each step replaces one operation by its value and leaves the value of the whole expression unchanged.",
  "factor-out-choice":
    "By the distributive property $g(p+q)=gp+gq$, so $gp+gq$ can be written $g(p+q)$ for any nonzero $g$. Factoring is dividing each term by $g$: $\\frac{gp}{g}=p$. A negative $g$ reverses the sign of each quotient.",
  "step-reason-table":
    "The addition, subtraction, multiplication and division properties of equality state that equal operations on both sides preserve equality, with division and multiplication by a nonzero number. The distributive property $a(b+c)=ab+ac$ rewrites a product. A justified solution names one such property for each step.",
};

export const oneStepResultLessons = [
  chainLesson({
    id: "one-step-equation-results",
    title: "What one step does to an equation",
    summary:
      "Choose the equation after one step, and name the property behind each step of a solution.",
    templateIds: ["equation-after-one-step", "step-reason-table"],
    objectives: [
      "Choose the equation that results from one inverse step done to both sides, including grouped and fraction forms.",
      "Name the property that takes each line of a linear equation solution to the next.",
    ],
    openingTitle: "Keep the balance, change one thing",
    opening: [
      "An equation says two sides have the same value. A step that does the same thing to both sides keeps them equal. The new equation has the same solution as the old one, and it is closer to $x=\\text{number}$.",
      "One step undoes one operation. If a constant is added to $3x$, subtract it from both sides. If a group is multiplied by $4$, divide both sides by $4$. If $x$ is divided by $5$, multiply both sides by $5$, every term included.",
    ],
    example: {
      prompt: "Solve $3x+7=25$ and name the property for each step.",
      steps: [
        "Subtract $7$ from both sides: $3x+7-7=25-7$, so $3x=18$. This is the subtraction property of equality.",
        "Divide both sides by $3$: $x=6$. This is the division property of equality.",
        "Check: $3\\cdot 6+7=25$.",
      ],
      answer: "$x=6$, using the subtraction and then the division property",
    },
    methodTitle: "Find the operation, undo it everywhere",
    method: [
      "Find the operation that is done to $x$ last in building the equation, and undo it with its opposite on both whole sides. A sum or difference on a side means every term of that side is changed.",
      "To name a step, compare two neighbouring lines. Multiplying out a group is the distributive property. Undoing an addition is the subtraction property, and undoing a division is the multiplication property.",
    ],
    formalTitle: "Why the solution does not change",
    formal: [
      "If $A=B$ then $A+k=B+k$ and $kA=kB$, and the steps can be reversed by subtracting $k$ or, for $k\\ne 0$, dividing by $k$. So the old and new equations are true for exactly the same values of $x$.",
      "A mistake such as changing one side only or one term only produces an equation with a different solution.",
    ],
    pitfalls: [
      "Change both sides. Removing a constant from the left only breaks the balance.",
      "Change every term. Multiplying $\\frac{x}{4}+3=5$ by $4$ gives $x+12=20$, not $x+3=20$.",
      "Do only one step when the question asks for one step.",
    ],
    parentGuide:
      "Ask your learner which operation is being undone and whether it was done to the whole of both sides.",
  }),
  chainLesson({
    id: "one-step-expression-results",
    title: "What one step does to an expression",
    summary:
      "Choose the expression after the first step of the order of operations, or after factoring out a number.",
    templateIds: ["expression-after-first-step", "factor-out-choice"],
    objectives: [
      "Rewrite an expression after only the first step of the order of operations, including decimals and a bracketed product.",
      "Factor a positive or negative number out of a linear expression by dividing every term.",
    ],
    openingTitle: "One move, everything else the same",
    opening: [
      "When an expression has several operations, a rule tells which comes first: parentheses, then multiplication and division, then addition and subtraction. Inside parentheses the same rule applies, so a product is found before a sum there.",
      "Doing only the first step means changing one part and copying the rest. Factoring is another single move: if every term is a multiple of a number, write that number once outside parentheses and divide each term by it.",
    ],
    example: {
      prompt: "Do only the first step on $9.5-(1.2+0.4\\times 6)$.",
      steps: [
        "Parentheses come first. Inside, multiplication comes before addition, so the first step is $0.4\\times 6=2.4$.",
        "Rewrite with that product and copy the rest: $9.5-(1.2+2.4)$.",
      ],
      answer: "$9.5-(1.2+2.4)$",
    },
    methodTitle: "Find the first operation, change only it",
    method: [
      "Look inside the parentheses for the operation that comes first. Replace it by its value and copy everything else.",
      "To factor $g$ out, divide each term by $g$, put the quotients in parentheses after $g$, and check by distributing.",
    ],
    formalTitle: "Precedence and the distributive property",
    formal: [
      "Evaluation applies grouping, then multiplication and division, then addition and subtraction. Each step keeps the value of the whole expression the same.",
      "Since $g(p+q)=gp+gq$, an expression $gp+gq$ equals $g(p+q)$. A negative $g$ gives quotients of the opposite signs, for example $-4x+12=-4(x-3)$.",
    ],
    pitfalls: [
      "Do not finish the whole bracket when only the first step is asked for.",
      "Do not add before multiplying inside parentheses.",
      "Divide every term when factoring, including the constant, and keep the signs.",
    ],
    parentGuide:
      "Ask your learner to say which operation comes first and why, and to check a factored form by multiplying it out.",
  }),
];

export const oneStepResultFacetMappings: FacetMapping[] = [
  {
    templateId: "equation-after-one-step",
    facetId: "two-step-equations.core",
    extent: "partial",
    rationale:
      "Choice of the equation after one inverse step on a constant, a grouped factor or a fraction coefficient, with each wrong option a real slip. Does not assess solving to a value, constructing an equation or a typed intermediate equation.",
  },
  {
    templateId: "expression-after-first-step",
    facetId: "numerical-expressions.core",
    extent: "partial",
    rationale:
      "Choice of the expression after the first step of the order of operations for a decimal expression with a bracketed product, and of the first line with a mistake in a shown four-line simplification. Does not assess evaluating to a final value, exponents or a typed expression.",
  },
  {
    templateId: "factor-out-choice",
    facetId: "expression-properties.core",
    extent: "partial",
    rationale:
      "Choice of the equivalent expression after a stated positive or negative integer is factored out of a two-term or three-term linear expression with integer coefficients. Does not assess finding the greatest common factor, fractional factors or typed factoring.",
  },
  {
    templateId: "step-reason-table",
    facetId: "equation-reasoning.justify-steps",
    extent: "partial",
    rationale:
      "Choice of the list of properties justifying each line of a shown linear equation solution (two-step, fraction coefficient, distribute first). Does not assess writing the justification, variables on both sides or any written explanation.",
  },
];
