import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const oneStepResultMethods: Record<string, ProblemMethod> = {
  "equation-after-one-step": {
    goal: "Choose the equation you get after one undo step is done to both sides of a two-step equation.",
    senses: {
      side: "side-of-equation",
      term: "term-expression",
      balance: "balance-scale",
    },
    noLink: [
      "opposite",
      "whole",
      "factor",
      "inverse",
      "change",
      "changes",
      "part",
    ],
    intuition:
      "An equation is a statement that two amounts are equal, such as $\\frac{x}{5} + 6 = 12$. The two amounts are called the sides of the equation. Here $\\frac{x}{5}$ means $x$ divided by 5. A solution is a value of $x$ that makes the two sides equal. Doing the same thing to both sides keeps them equal, like taking the same weight off both pans of a balance scale. One step undoes one operation (add, subtract, multiply or divide) with its inverse operation, the operation that undoes it. Adding or subtracting changes each side once: $\\frac{x}{5} + 6 - 6 = \\frac{x}{5}$. Parentheses (the curved brackets) group what is inside, so a number multiplying them multiplies the whole group. Multiplying or dividing changes every term (each part joined by + or −) on a side: $5 \\times \\left(\\frac{x}{5} + 6\\right) = x + 30$.",
    terms: ["inverse-operation"],
    method: [
      "Use the step the question names, or find the operation to undo: a number added to or subtracted from the $x$ term, a number multiplying the parentheses, or a number dividing $x$.",
      "Do the inverse operation to both sides. When adding or subtracting, change each side once. When multiplying or dividing, change every term on each side.",
      "Write the equation after that one step only. Compare it with each choice before you pick.",
    ],
    watch:
      "Change both sides. When you multiply or divide, change every term on each side, not just the first. Missing a side or a term usually gives an equation with a different solution.",
  },
  "expression-after-first-step": {
    goal: "Choose the expression that results from only the first step of the order of operations, or find the first line with a mistake.",
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
    goal: "Choose the list of properties that says why each line of a shown equation solution follows from the line before.",
    senses: { side: "side-of-equation" },
    noLink: ["opposite", "whole", "rule", "rules", "part"],
    intuition:
      "An equation is a statement that two amounts are equal, such as $2x + 6 = 18$. The two amounts are called the sides of the equation. A solution is a value of $x$ that makes the sides equal. A worked solution is a list of equations, one per line, that ends with $x$ alone. Each line comes from the line before it by one step. A property is a rule that says why a step is allowed. An operation is adding, subtracting, multiplying or dividing. A rule that lets you do the same operation to both sides is called a property of equality. You may add or subtract any number, or multiply or divide by any number other than 0. Going from $2x + 6 = 18$ to $2x = 12$ subtracts 6 from both sides, so its reason is the subtraction property of equality. Multiplying both sides by the same number is called the multiplication property of equality. Dividing both sides by the same number is called the division property of equality. Parentheses (the curved brackets) group what is inside, and a number written before them multiplies the whole group. For example, $3(4 + 2) = 3 \\times 6 = 18$, and also $3 \\times 4 + 3 \\times 2 = 12 + 6 = 18$. So multiplying the 3 into each part keeps the value the same: $3(x + 2) = 3x + 6$. That rule is called the distributive property.",
    terms: [
      [
        "property-of-equality",
        "To keep exactly the same solutions, multiply only by a number other than 0 as well.",
      ],
      "distributive-property",
    ],
    method: [
      "Compare two neighbouring lines. Decide what changed: a number was multiplied into parentheses, or the same number was added, subtracted, multiplied or divided on both sides.",
      "Name the property for the operation that was done. Removing a + 6 is done by subtracting 6, so it is the subtraction property of equality.",
      "Repeat for each pair of lines, in order. Then match the whole list with a choice.",
    ],
    watch:
      "Name the operation that was done, not the one that was removed. Removing a + 6 is the subtraction property. Undoing $\\frac{x}{4}$ by multiplying by 4 is the multiplication property. Check the order of the steps too.",
  },
};

export const oneStepResultPrinciples: Record<string, string> = {
  "equation-after-one-step":
    "Let $A$ and $B$ stand for the two sides, and $k$ for any number. If $A = B$, then $A + k = B + k$ and $A - k = B - k$. For any $k$ other than 0, also $kA = kB$ and $\\frac{A}{k} = \\frac{B}{k}$. Each of these steps keeps the same solution. Multiplying or dividing a side by $k$ changes every term on it.",
  "expression-after-first-step":
    "Work out parentheses first, then multiply and divide from left to right, then add and subtract from left to right. Each step replaces one operation with its value. The value of the expression stays the same.",
  "factor-out-choice":
    "A number before parentheses multiplies each term inside: $g(p + q) = gp + gq$, where $gp$ means $g$ times $p$. This is called the distributive property. Read backwards, $gp + gq = g(p + q)$. Factoring divides each term by $g$, so $g$ must not be 0. A negative $g$ flips the sign of each answer.",
  "step-reason-table":
    "The addition, subtraction, multiplication and division properties of equality say that doing the same operation to both sides keeps an equation's solutions. Multiplying or dividing must use a number other than 0. The distributive property, as in $3(x + 2) = 3x + 6$, rewrites one part of a line without changing its value. A justified solution names one such property for each step.",
};

export const oneStepResultLessons: Lesson[] = [
  {
    ...chainLesson({
      id: "one-step-equation-results",
      title: "What one step does to an equation",
      summary:
        "An equation says two amounts are equal, like $3x + 7 = 25$. The two amounts are called the sides of the equation. One step undoes one thing that was done to $x$. You do it to both sides, so they stay equal. Each step has a reason: a rule that says why it is allowed.",
      templateIds: ["equation-after-one-step", "step-reason-table"],
      objectives: [
        "Choose the equation you get after one undo step on both sides, including equations with parentheses or fractions.",
        "Name the rule, called a property, that takes each line of a solution to the next line.",
      ],
      openingTitle: "Keep the balance, change one thing",
      opening: [
        "An equation is a statement that two amounts are equal, such as $3x + 7 = 25$. The letter $x$ stands for an unknown number, and $3x$ means 3 times $x$. The two amounts are called the sides of the equation: the left side and the right side. A solution is a value of $x$ that makes the two sides equal. To solve an equation means to find its solution.",
        "Think of a balance scale with equal weights on its two pans. Take the same weight off both pans, and it stays level. In the same way, doing the same thing to both sides keeps them equal. You may add or subtract any number, or multiply or divide by any number other than 0. The new equation then has the same solution as the old one.",
        "One step undoes one operation (add, subtract, multiply or divide). In $3x + 7 = 25$, 7 was added to $3x$, so subtract 7 from both sides: $3x = 18$. In $\\frac{x}{5} = 4$, which means $x$ divided by 5 is 4, multiply both sides by 5 to undo the division: $x = 20$.",
        "Parentheses (the curved brackets) group what is inside, so a number multiplying them multiplies the whole group. Take care when a side has several terms (the parts joined by + or −). Adding or subtracting changes the side once: $3x + 7 - 7 = 3x$. Multiplying a side by 5 means 5 times everything on it, so every term on the side gets multiplied: $5 \\times \\left(\\frac{x}{5} + 3\\right) = x + 15$.",
        "A rule that lets you do the same operation to both sides is called a property of equality. Each one is named for its operation. For example, the subtraction property of equality says you may subtract the same number from both sides.",
      ],
      example: {
        prompt: "Solve $3x+7=25$ and name the property for each step.",
        steps: [
          "In $3x + 7$, $x$ was multiplied by 3, then 7 was added. Adding 7 came last, so undo it first.",
          "Subtract 7 from both sides: $3x + 7 - 7 = 25 - 7$, so $3x = 18$. Subtracting the same number from both sides is the subtraction property of equality.",
          "Divide both sides by 3 to undo the multiplication: $3x \\div 3 = x$ and $18 \\div 3 = 6$, so $x = 6$. Dividing both sides by the same number, other than 0, is the division property of equality.",
          "Check: put 6 in place of $x$ in the original equation. $3 \\times 6 + 7 = 18 + 7 = 25$, the same as the right side, so $x = 6$ is the solution.",
        ],
        answer: "$x=6$, using the subtraction and then the division property",
      },
      methodTitle: "Find the operation, undo it on both sides",
      method: [
        "Find the operation done to $x$ last in building the equation. Undo it on both sides: subtract what was added, add what was subtracted, divide by the number that multiplied, or multiply by the number that divided.",
        "Adding or subtracting changes each side once. Multiplying or dividing changes every term (each part joined by + or −) on each side.",
        "To name a step, compare two neighbouring lines and ask what was done to both sides. Undoing an addition is the subtraction property of equality. Undoing a division is the multiplication property of equality.",
        "With numbers, $4(2 + 1) = 4 \\times 3 = 12$, and $4 \\times 2 + 4 \\times 1 = 8 + 4 = 12$ too. Multiplying the outside number by each part inside parentheses (the curved brackets), as in $4(x + 2) = 4x + 8$, is called the distributive property. It changes how one side looks, not its value.",
      ],
      formalTitle: "Why the solution does not change",
      formal: [
        "Let $A$ and $B$ stand for the two sides, and $k$ for any number. If $A = B$, then $A + k = B + k$ and $A - k = B - k$. If $k$ is not 0, then also $kA = kB$ and $\\frac{A}{k} = \\frac{B}{k}$.",
        "Each of these steps can be undone. Subtract $k$ after adding it, or divide by $k$ after multiplying by a $k$ that is not 0. So the old and new equations are true for exactly the same values of $x$.",
        "Multiplying both sides by 0 is not a solving step. It turns any equation into $0 = 0$, which is true for every $x$.",
        "A slip such as changing one side only, or multiplying only one term of a side, usually gives an equation with a different solution.",
      ],
      pitfalls: [
        "Change both sides. Subtracting 7 from the left side only breaks the balance.",
        "When you multiply or divide, change every term on a side. Multiplying both sides of $\\frac{x}{4} + 3 = 5$ by 4 gives $x + 12 = 20$, not $x + 3 = 20$.",
        "When you add or subtract, change each side only once. Subtracting 7 from both sides of $3x + 7 = 25$ gives $3x = 18$. The $3x$ stays as it is.",
        "Do only one step when the question asks for one step.",
      ],
      parentGuide:
        "Ask your learner which step (adding, subtracting, multiplying or dividing) is being undone. Then ask whether the undo step was done to both sides of the equals sign. When multiplying or dividing, ask whether it reached every part of each side.",
    }),
    senses: {
      side: "side-of-equation",
      term: "term-expression",
      balance: "balance-scale",
    },
    noLink: [
      "opposite",
      "whole",
      "difference",
      "change",
      "changes",
      "inverse",
      "rule",
      "part",
      "parts",
    ],
  },
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
        "A number before parentheses multiplies each term inside: $g(p + q) = gp + gq$. Here the letters stand for numbers, and $gp$ means $g$ times $p$. This is called the distributive property.",
        "Read backwards, $gp + gq = g(p + q)$, which is factoring out $g$. A negative $g$ flips the sign of each term inside, as in $-4x + 12 = -4(x - 3)$.",
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
    noLink: ["change", "part", "whole"],
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
