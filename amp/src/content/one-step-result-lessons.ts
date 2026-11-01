import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const oneStepResultMethods: Record<string, ProblemMethod> = {
  "equation-after-one-step": {
    goal: "Choose the equation that results from one inverse step done to both sides of a two-step equation.",
    intuition:
      "An equation is a balance. To keep it balanced, whatever is done to one side is done to the other, and to every term on that side. One step removes one operation: a constant, a factor outside parentheses, or a division.",
    terms: ["inverse-operation", "equivalent-equations"],
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
      "An expression is a mix of numbers joined by operations such as +, −, × and ÷, with no equal sign. The order of operations is the agreed order for working one out. Work inside parentheses, the curved marks $(\\;)$, first. Then multiply and divide, from left to right. Then add and subtract, from left to right. Doing only the first step works out one operation and copies the rest unchanged.",
    senses: {
      product: "product-multiply",
      difference: "difference-subtract",
    },
    noLink: ["leaves", "whole"],
    terms: [
      "order-of-operations",
      [
        "order-of-operations",
        "The first step is the one operation done first; everything else is copied unchanged.",
      ],
    ],
    method: [
      "Find the parentheses. Inside them, find the operation that comes first: multiplying or dividing before adding or subtracting.",
      "Work out that one operation. Copy everything else exactly as it was.",
      "To check someone's work, redo the first step yourself. Then compare each line with the line before it.",
    ],
    watch:
      "Inside parentheses, multiply before you add or subtract. When the question asks for one step, do not work out everything inside the parentheses.",
  },
  "factor-out-choice": {
    goal: "Factor a given number, positive or negative, out of something like $6x - 12$, and choose the result.",
    intuition:
      "An expression is a mix of numbers and letters joined by operations such as + and −, with no equal sign. A term is one part of an expression joined to the rest by + or −, with its sign. In $6x - 12$, the terms are $6x$ and $-12$. The letter $x$ is a variable, a letter that stands for a number, and $6x$ means 6 times $x$. Parentheses are the curved marks $(\\;)$ that group part of an expression. A number written just before parentheses multiplies everything inside: $6(x - 2) = 6x - 12$. There 6 is a factor, a number being multiplied. Factoring out 6 means going the other way. Divide each term by 6 and write the answers inside the parentheses.",
    senses: {
      term: "term-expression",
      terms: "term-expression",
      factor: "factor-number",
      multiple: "multiple",
      product: "product-multiply",
    },
    noLink: ["changes"],
    terms: ["factor-out", "common-factor"],
    method: [
      "Divide every term by the given number, keeping each sign. $6x \\div 6 = x$ and $-12 \\div 6 = -2$.",
      "Write the given number, then the answers inside parentheses: $6(x - 2)$.",
      "Check by multiplying back: the number times each answer must give the original term.",
    ],
    watch:
      "Divide every term, including the number with no letter, and keep the signs. A negative number is a number less than 0. Factoring out a negative number flips the sign of each answer: $-6x + 12 = -6(x - 2)$.",
  },
  "step-reason-table": {
    goal: "Choose the list of properties that justifies each line of a shown linear equation solution.",
    intuition:
      "Each line of a solution follows from the line before it by one property. Naming the property says why the step keeps the same solution: equal operations on both sides keep an equation balanced, and the distributive property rewrites a product without changing its value.",
    terms: ["property-of-equality", "distributive-property"],
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
    "Work out parentheses first, then multiply and divide from left to right, then add and subtract from left to right. Each step replaces one operation with its value. The value of the expression stays the same.",
  "factor-out-choice":
    "A number before parentheses multiplies each term inside: $g(p + q) = gp + gq$, where $gp$ means $g$ times $p$. This is called the distributive property. Read backwards, $gp + gq = g(p + q)$ for any $g$ that is not 0. Factoring divides each term by $g$. A negative $g$ flips the sign of each answer.",
  "step-reason-table":
    "The addition, subtraction, multiplication and division properties of equality state that equal operations on both sides preserve equality, with division and multiplication by a nonzero number. The distributive property $a(b+c)=ab+ac$ rewrites a product. A justified solution names one such property for each step.",
};

export const oneStepResultLessons: Lesson[] = [
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
  {
    ...chainLesson({
      id: "one-step-expression-results",
      title: "What one step does to an expression",
      summary:
        "An expression is a mix of numbers joined by operations such as +, −, × and ÷, with no equal sign. When it has several operations, an agreed order says which comes first. That order is called the order of operations. Doing only the first step works out one operation and copies the rest. Factoring out a number is a single step that writes an expression as that number times a group, without changing its value.",
      templateIds: ["expression-after-first-step", "factor-out-choice"],
      objectives: [
        "Rewrite an expression after only the first step of the order of operations, including decimals and a product inside parentheses.",
        "Factor a number out of an expression by dividing every term, including a number below 0.",
      ],
      openingTitle: "One move, everything else the same",
      opening: [
        "The order of operations works like this. First work inside parentheses, the curved marks $(\\;)$ around part of an expression. Then multiply and divide, from left to right. Then add and subtract, from left to right.",
        "Inside parentheses the same order applies. In $1.2 + 0.4 \\times 6$, multiplying $0.4 \\times 6$ comes before adding. The answer to a multiplication is called a product.",
        "Doing only the first step means working out that one operation. Copy everything else exactly as it was. The value of the whole expression does not change.",
        "Factoring out a number is another single step. A term is one part of an expression joined to the rest by + or −, with its sign. In $6x + 12$, the terms are $6x$ and 12. The letter $x$ stands for a number, and $6x$ means 6 times $x$.",
        "A number written just before parentheses multiplies everything inside: $6(x + 2) = 6x + 12$. Factoring goes the other way. Both terms of $6x + 12$ are 6 times something, so write 6 once in front. Then divide each term by 6: $6x + 12 = 6(x + 2)$.",
        "A negative number is a number less than 0, such as $-4$. Factoring out a negative number flips the sign, + or −, of each term inside. So $-4x + 12 = -4(x - 3)$. Check by multiplying back: $-4 \\times x = -4x$ and $-4 \\times (-3) = 12$.",
      ],
      example: {
        prompt: "Do only the first step on $9.5-(1.2+0.4\\times 6)$.",
        steps: [
          "Parentheses come first, so look inside them: $1.2 + 0.4 \\times 6$.",
          "Inside, multiplication comes before addition. So the first step is $0.4 \\times 6 = 2.4$.",
          "Write 2.4 in place of $0.4 \\times 6$, and copy everything else exactly: $9.5 - (1.2 + 2.4)$.",
        ],
        answer: "$9.5-(1.2+2.4)$",
      },
      methodTitle: "Find the first operation, change only it",
      method: [
        "Look inside the parentheses for the operation that comes first. Replace it with its value and copy everything else.",
        "To factor out a number, divide each term by it. Write the number, then the answers inside parentheses. Check by multiplying the number back into each answer.",
      ],
      formalTitle: "The order of operations and factoring",
      formal: [
        "Work out parentheses first, then multiply and divide, then add and subtract. Each step keeps the value of the whole expression the same.",
        "A number before parentheses multiplies each term inside: $g(p + q) = gp + gq$. Here the letters stand for numbers, and $gp$ means $g$ times $p$. This rule is called the distributive property.",
        "Read backwards, $gp + gq = g(p + q)$, which is factoring out $g$. A negative $g$ gives the terms inside the opposite signs, as in $-4x + 12 = -4(x - 3)$.",
      ],
      pitfalls: [
        "When the question asks for one step, do only that step. Do not work out everything inside the parentheses.",
        "Inside parentheses, multiply before you add.",
        "When factoring, divide every term, including the number with no letter, and keep the signs.",
      ],
      parentGuide:
        "Ask your learner which operation comes first and why. After factoring, ask them to multiply the number back in to check that they get the expression they started with.",
    }),
    senses: {
      product: "product-multiply",
      term: "term-expression",
      terms: "term-expression",
      factor: "factor-number",
    },
    noLink: ["change", "opposite", "part", "rule", "whole"],
  },
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
