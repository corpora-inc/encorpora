import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "solve-justify-linear",
    title: "Solve a linear equation and justify each step",
    summary:
      "To solve an equation, find the value of $x$ that makes it true. Work one line at a time, and write the rule that allows each line.",
    objectives: [
      "Solve an equation with parentheses, a fraction or $x$ on both sides, one line at a time.",
      "Name the rule that turns each line into the next: a property of equality, distributing or combining like terms.",
    ],
    intuition:
      "An equation is a statement that two amounts are equal, such as $3 \\times 2 + 4 = 10$. With a letter, as in $3(x + 2) + 4 = 22$, it says the amounts are equal for some unknown number. The letter $x$ is a variable, a letter that stands for an unknown number. A number written right before parentheses (the curved brackets) multiplies everything inside them. The two amounts are called the sides of the equation. Each side is an expression, a math phrase made of numbers, letters and operations (adding, subtracting, multiplying, dividing). A solution is a value of $x$ that makes the two sides equal. To solve an equation means to find its solution, and to justify a step means to write the reason it is allowed. Two kinds of moves keep the solution the same. The first kind rewrites one side in an equal form. For example, $3(4 + 2) = 3 \\times 6 = 18$, and $3 \\times 4 + 3 \\times 2 = 12 + 6 = 18$ too. Multiplying the number outside parentheses by each part inside, as in $3(x + 2) = 3x + 6$, is called distributing. The rule behind it is the distributive property. Terms are the parts of a side joined by + or −, each with the sign in front of it. Like terms are terms with the same letter part, such as $3x$ and $-2x$, or two plain numbers, such as 6 and 4. Adding them, as in $6 + 4 = 10$, is called combining like terms. The second kind of move does the same operation to both sides. You may add or subtract any amount on both sides, or multiply or divide both sides by any number other than 0. Each of these rules is called a property of equality. Subtracting the same amount from both sides is called the subtraction property of equality, and adding it is called the addition property of equality. Multiplying both sides by the same number is called the multiplication property of equality. Dividing both sides by the same number is called the division property of equality. Each line of a solution is one move, and its reason names that move.",
    terms: [
      [
        "property-of-equality",
        "To keep exactly the same solutions, do not multiply both sides by 0 either.",
      ],
      "like-terms",
    ],
    method: [
      "Simplify each side, which means rewriting it in a shorter, equal form. Distribute a number over parentheses (distributive property) and combine like terms.",
      "Get the $x$ terms on one side. To remove $3x$ from a side, subtract $3x$ from both sides (subtraction property of equality). To remove $-3x$, add $3x$ to both sides (addition property).",
      "Get the plain numbers on the other side the same way.",
      "Divide both sides by the coefficient, the number multiplying $x$, if it is not 0 (division property of equality). If $x$ is divided by a number, as in $\\frac{x}{3}$ ($x$ divided by 3), multiply both sides by that number instead (multiplication property). Write the reason beside every line.",
    ],
    watch:
      "Distributing and combining like terms rewrite one side without changing its value, so they may happen on one side alone. A property of equality, such as subtracting 6, must be done to both whole sides. Subtracting 6 from only the left side breaks the equality.",
    principle:
      "Let $a$ and $b$ stand for the two sides, and $c$ for any number. If $a = b$, then $a + c = b + c$ and $a - c = b - c$. If $c$ is not 0, then also $ac = bc$ ($a$ times $c$ equals $b$ times $c$) and $\\frac{a}{c} = \\frac{b}{c}$. Replacing a side by an equal expression (distributing, combining like terms, reordering terms) also keeps an equation's solutions. So each line has exactly the solutions of the line before it.",
    example: {
      prompt: "Solve $3(x+2)+4=22$ and justify each step.",
      steps: [
        "$3x+6+4=22$ — Distributive property. Multiply 3 by each part inside the parentheses: $3 \\times x = 3x$ and $3 \\times 2 = 6$. The left side keeps its value.",
        "$3x+10=22$ — Combine like terms. The plain numbers 6 and 4 add to 10.",
        "$3x=12$ — Subtraction property of equality. Subtract 10 from both sides to undo the + 10: $3x + 10 - 10 = 22 - 10$.",
        "$x=4$ — Division property of equality. Divide both sides by 3, which is not 0, to undo the multiplication: $3x \\div 3 = x$ and $12 \\div 3 = 4$.",
        "Check: put 4 in place of $x$ in the original equation. $3(4 + 2) + 4 = 3 \\times 6 + 4 = 18 + 4 = 22$. Both sides are 22.",
      ],
      answer: "$x=4$",
    },
    methodTitle: "Other orders are correct too",
    methodText: [
      "From $3(x + 2) + 4 = 22$ you may subtract 4 from both sides first, to undo the + 4: $3(x + 2) = 18$. Then divide both sides by 3 to undo the multiplication by 3: $x + 2 = 6$. Then subtract 2 from both sides to undo the + 2: $x = 4$. Every line still follows from the line before it by its reason.",
      "A reason names the move that made the line. Going from $3x = 12$ to $x = 4$ divides both sides by 3, so the reason is the division property of equality.",
      "Swapping the order of terms, as in $4 + 3x = 3x + 4$, also keeps a side's value. That move is called the commutative property.",
    ],
    formal:
      "Each property of equality uses an operation that can be undone: subtract after adding, or divide after multiplying by a number other than 0. So a value makes the new line true exactly when it makes the old line true. Multiplying both sides by 0 is never a solving step, because it turns any equation into $0 = 0$. A chain of such lines that ends in $x = 4$ shows that 4 is the only solution.",
    pitfalls: [
      "Distribute to every term in the parentheses: $3(x + 2) = 3x + 6$, not $3x + 2$.",
      "To remove a negative term from both sides, add. To remove the $-5$ in $x - 5 = 2$, add 5 to both sides, because $-5 + 5 = 0$. To remove a positive term, subtract.",
      "The reason belongs to the move that made the line, not to the next move.",
    ],
    parentGuide:
      "Cover one line of your learner's solution. Ask what was done to get it, to both sides or to one side. Then ask which named rule, such as the subtraction property of equality, allows that move.",
    senses: { side: "side-of-equation", term: "term-expression" },
    noLink: [
      "whole",
      "balance",
      "part",
      "parts",
      "rule",
      "rules",
      "change",
      "changes",
    ],
  },
  {
    id: "solve-justify-inequality",
    title: "Solve a linear inequality and justify each step",
    summary:
      "An inequality is a less-than or greater-than statement. Solve it like an equation, but multiplying or dividing by a negative flips the sign.",
    objectives: [
      "Solve an inequality with parentheses, writing each line and the property behind it.",
      "Reverse the inequality sign exactly when multiplying or dividing both sides by a negative number.",
    ],
    intuition:
      "An inequality is a statement that compares two amounts. The sign $<$ means “is less than”, and $>$ means “is greater than”. The sign $\\le$ means “is less than or equal to”, and $\\ge$ means “is greater than or equal to”. The two amounts are called the sides of the inequality. A solution is a value of $x$ that makes the inequality true. To solve an inequality means to find all its solutions, called the solution set, such as every number greater than or equal to $-4$. Adding or subtracting the same amount on both sides keeps the order: $2 < 3$, and $2 + 5 < 3 + 5$. Multiplying or dividing both sides by a positive number (one greater than 0) keeps it too: $2 \\times 4 < 3 \\times 4$. But multiplying by a negative number (a number less than 0) flips the order. We have $2 < 3$, yet $2 \\times (-1) = -2$ is greater than $3 \\times (-1) = -3$. So when you multiply or divide both sides by a negative number, reverse the inequality sign: $<$ becomes $>$, and $\\le$ becomes $\\ge$. Each of these moves has a name. Subtracting the same amount from both sides is called the subtraction property of inequality. Dividing both sides by the same number, other than 0, is called the division property of inequality. If that number is negative, the sign reverses. Before those moves, you may need a step called distributing: multiplying a number by each part inside parentheses (the curved brackets). With numbers, $-2(4 - 3) = -2 \\times 1 = -2$, and $-2 \\times 4 + (-2) \\times (-3) = -8 + 6 = -2$ too. In the same way, $-2(x - 3)$ means $-2$ times the whole of $x - 3$. Distributing gives $-2x + 6$. The rule behind it is called the distributive property. Terms are the parts of a side joined by + or −, each with the sign in front of it. Like terms are terms with the same letter part, such as $3x$ and $-2x$, or two plain numbers. Combine them by adding the numbers in front of the letter and keeping the letter: $3x + (-2x) = 1x$, which is just $x$.",
    terms: ["reverse-inequality-sign", "solution-set"],
    method: [
      "Distribute, then combine like terms on each side by adding their numbers, as in $3x - 2x = x$.",
      "Add or subtract the same term on both sides, so the $x$ terms are on one side and the plain numbers on the other. The sign stays the same.",
      "Divide both sides by the number multiplying $x$. If that number is negative, reverse the sign.",
      "Name the reason for each line: the distributive property, or the property of inequality for adding, subtracting, multiplying or dividing.",
    ],
    watch:
      "Among the solving moves, only multiplying or dividing both sides by a negative number reverses the sign. Subtracting a number does not, and neither does getting a negative answer.",
    principle:
      "Let $a$, $b$ and $c$ stand for any numbers, and suppose $a < b$. Then $a + c < b + c$. If $c$ is positive, then $ac < bc$, where $ac$ means $a$ times $c$. If $c$ is negative, then $ac > bc$. The same holds for $\\le$, $>$ and $\\ge$. These moves can be undone, so each line has the same solution set as the line before it.",
    example: {
      prompt: "Solve $-2(x-3)\\le14$ and justify each step.",
      steps: [
        "$-2x+6\\le14$ — Distributive property. Multiply $-2$ by each part inside the parentheses: $-2 \\times x = -2x$ and $-2 \\times (-3) = 6$. The left side keeps its value.",
        "$-2x\\le8$ — Subtraction property of inequality. Subtract 6 from both sides to leave the $x$ term alone: $-2x + 6 - 6 \\le 14 - 6$. Subtracting keeps the sign the same.",
        "$x\\ge-4$ — Division property of inequality. Divide both sides by $-2$, the number multiplying $x$: $-2x \\div (-2) = x$ and $8 \\div (-2) = -4$. Dividing by a negative number reverses the sign, so $\\le$ becomes $\\ge$.",
        "Check a value in the solution set: $x = 0$ gives $-2(0 - 3) = 6$, and $6 \\le 14$ is true. Check one outside it: $x = -5$ gives $-2(-5 - 3) = 16$, and $16 \\le 14$ is false.",
      ],
      answer: "$x\\ge-4$",
    },
    methodTitle: "Check with one value",
    methodText: [
      "Pick a number in your solution set and one outside it. The first must make the original inequality true. The second must make it false. These checks catch most mistakes, though they cannot test every number.",
      "Writing $x$ on the right is allowed: $-4 \\le x$ means the same as $x \\ge -4$.",
    ],
    formal:
      "Why does a negative number flip the sign? Suppose $a < b$, where $a$ and $b$ are any numbers. Then $b - a$ is positive, because the larger number minus the smaller one is more than 0. Take a negative number $c$. Two letters written next to each other are multiplied, so $bc$ means $b$ times $c$. By distributing, $c(b - a) = bc - ac$. Here $c(b - a)$ is a negative number times a positive number, so it is negative. When one number minus another is negative, the first number is the smaller one. So $bc < ac$, which says the same as $ac > bc$. Dividing by a negative number is the same as multiplying by its reciprocal, the number 1 divided by it, which is also negative. So dividing reverses the sign too.",
    pitfalls: [
      "Reverse the sign when you multiply or divide both sides by a negative number. Do not reverse it just because some number in the problem is negative.",
      "Distribute a negative number to every term: $-2(x - 3) = -2x + 6$.",
    ],
    parentGuide:
      "Ask your learner to test one number from their answer in the original inequality. Then ask why the sign flipped, or why it did not.",
    senses: { side: "side-of-equation", term: "term-expression" },
    noLink: ["factor", "part", "parts", "rule", "rules", "whole", "more than"],
  },
  {
    id: "solve-justify-formula",
    title: "Solve a formula for one of its variables",
    summary:
      "A formula is an equation with letters, like $A = bh$ ($b$ times $h$). To solve for one letter, get it alone, treating others as numbers.",
    objectives: [
      "Rearrange a formula to get a named letter alone on one side.",
      "Justify each step, including dividing by a letter that stands for a positive measurement.",
    ],
    intuition:
      "A formula is an equation that links quantities with letters. The two amounts it sets equal are called the sides of the equation. Each letter is a variable, a letter that stands for a number. Two letters written next to each other are multiplied, so $bh$ means $b$ times $h$. In $A = bh$, $A$ is the area of a rectangle (the space it covers). Its base $b$ is its length along the bottom, and $h$ is its height. To solve the formula for $h$ means to get $h$ alone on one side. Think of numbers first. In $20 = 5h$, $h$ is multiplied by 5. Dividing by 5 undoes that, because $5h \\div 5 = h$. Do it to both sides so they stay equal: $20 \\div 5 = 4$, so $h = 4$. With letters, do the same: divide both sides by $b$ to get $\\frac{A}{b} = h$. The other letters stay in the answer. Dividing by a letter is allowed only when it cannot be 0, like the length of a real shape. Each step uses a property of equality, a rule that lets you do the same operation (adding, subtracting, multiplying or dividing) to both sides. You may add or subtract any amount, or multiply or divide by any amount other than 0. Adding the same amount to both sides is called the addition property of equality, and subtracting it is called the subtraction property of equality. Multiplying both sides by the same amount is called the multiplication property of equality. Dividing both sides by the same amount is called the division property of equality. Swapping the two sides, from $\\frac{A}{b} = h$ to $h = \\frac{A}{b}$, is called the symmetric property of equality.",
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
      "List the operations done to the target letter, in order.",
      "Undo them in reverse order, the last one first. Do the same thing to both sides each time.",
      "Divide by a letter only when it cannot be 0. The problem says which letters stand for positive amounts, such as lengths.",
      "Name the property for each line. Swapping the two sides is the symmetric property of equality.",
    ],
    watch:
      "Divide the whole side, not one term (one part joined by + or −). From $P - 2L = 2W$, the next line is $\\frac{P - 2L}{2} = W$, not $P - L = W$.",
    principle:
      "The properties of equality work for expressions, the math phrases made of numbers, letters and operations, as well as for numbers. If $a = b$, then $\\frac{a}{c} = \\frac{b}{c}$ for any expression $c$ that is not 0. A formula solved for one letter gives that letter's value for any allowed values of the others.",
    example: {
      prompt:
        "The area of a triangle is $A=\\frac{1}{2}bh$. Solve for $h$ and justify each step.",
      steps: [
        "Read the formula: $b$ is the triangle's base (its length along the bottom), $h$ is its height (the straight-up distance from the base to the top corner), and $\\frac{1}{2}bh$ means one half of $b$ times $h$. So $h$ was multiplied by $b$ and by $\\frac{1}{2}$.",
        "$2A=bh$ — Multiplication property of equality. Multiply both sides by 2 to undo the $\\frac{1}{2}$, because $2 \\times \\frac{1}{2} = 1$.",
        "$\\frac{2A}{b}=h$ — Division property of equality. Divide both sides by $b$ to undo the multiplication by $b$. This is allowed because $b$ is the length of a real triangle's base, so it is not 0.",
        "$h=\\frac{2A}{b}$ — Symmetric property of equality. Swap the two sides so $h$ is written first.",
        "Check with numbers: a triangle with $b = 4$ and $h = 5$ has $A = \\frac{1}{2} \\times 4 \\times 5 = 10$. The new formula gives $h = \\frac{2 \\times 10}{4} = 5$, the height we started with.",
      ],
      answer: "$h=\\frac{2A}{b}$",
    },
    methodTitle: "Test with numbers",
    methodText: [
      "Choose values for the letters that fit the original formula. Put them into your rearranged formula. The target letter must come out right.",
      "Undo the last operation first. In $P = 2L + 2W$, $W$ was multiplied by 2, and then $2L$ was added. So subtract $2L$ from both sides to undo the adding of $2L$: $P - 2L = 2W$. Then divide both sides by 2 to undo the multiplication in $2W$: $\\frac{P - 2L}{2} = W$. Finally swap the sides to write $W$ first: $W = \\frac{P - 2L}{2}$.",
    ],
    formal:
      "Every step can be undone, as long as no divisor (the number or letter you divide by) is 0. So for any allowed values of the other letters, the rearranged formula gives exactly the value of the target letter that makes the original formula true.",
    pitfalls: [
      "Do the same operation to both whole sides.",
      "To get rid of a fraction such as $\\frac{1}{2}$ (one half) in front of a letter, multiply both sides by its reciprocal (the number that multiplies it to make 1). For $\\frac{1}{2}$ that is 2, because $2 \\times \\frac{1}{2} = 1$.",
      "Do not divide by a letter that could be 0.",
    ],
    parentGuide:
      "Ask your learner to pick numbers for the other letters and check that their rearranged formula gives the right value.",
    senses: {
      side: "side-of-equation",
      term: "term-expression",
      product: "product-multiply",
    },
    noLink: ["base", "symmetric", "whole", "rule", "part"],
  },
  {
    id: "solve-justify-quadratic",
    title: "Solve a quadratic equation by factoring",
    summary:
      "If two numbers multiply to 0, one or both must be 0. So rewrite the equation as two parts multiplied to make 0, then set each part to 0.",
    objectives: [
      "Write a quadratic equation with 0 on one side and factor the other side.",
      "Use the rule that a product of 0 needs a factor of 0 to split it into two simpler equations, and solve each, naming every step.",
    ],
    intuition:
      "Start with numbers. If two numbers multiply to 0, one or both of them must be 0: $5 \\times 0 = 0$, but $5 \\times 2 = 10$. In math, we write “at least one” for one or more. This rule is called the zero-product property. Now use letters. An expression is a math phrase made of numbers, letters and operations (adding, subtracting, multiplying, dividing). Here $x$ squared means $x$ times $x$, and we write it $x^2$. Terms are the parts of an expression joined by + or −. In $x^2 + 3x - 10$, the terms are $x^2$, $3x$ and $-10$. An equation that can be written as an $x^2$ term, an $x$ term and a plain number, all equal to 0, is called a quadratic equation. An example is $x^2 + 3x = 10$, which is the same as $x^2 + 3x - 10 = 0$. The two amounts it sets equal are called the sides of the equation. A solution is a value of $x$ that makes it true, and to solve it means to find every solution. To use the zero-product property, first get 0 on one side. Adding or subtracting the same amount on both sides keeps them equal and keeps the same solutions. So subtracting 10 from both sides gives $x^2 + 3x - 10 = 0$. A rule like this, which allows the same operation on both sides, is called a property of equality. Next, factor the other side, which means writing it as a product, the result of multiplying. Parentheses (the curved brackets) group an expression, and two groups written next to each other are multiplied. So $(x + 5)(x - 2)$ means $x + 5$ times $x - 2$. The expressions being multiplied, $x + 5$ and $x - 2$, are called factors. Now $(x + 5)(x - 2) = 0$ means $x + 5 = 0$ or $x - 2 = 0$. The rule needs 0 on one side. From $(x - 2)(x + 5) = 6$, you cannot tell what either factor equals.",
    terms: [
      "zero-product-property",
      [
        "standard-form-polynomial",
        "For a quadratic equation, $ax^2 + bx + c = 0$ with $a \\ne 0$ (read “$a$ is not equal to 0”): every term on one side and 0 on the other.",
      ],
    ],
    method: [
      "Add or subtract terms on both sides so one side is 0. If the number in front of $x^2$ divides every term evenly, divide both sides by it. This leaves $x^2$ with no number in front.",
      "With $x^2$ alone in front, factor. Find two numbers that multiply to the constant term, the plain number with no $x$, and add to the number multiplying $x$. Each factor is $x$ plus one of the numbers, such as $x + 5$ and $x + (-2)$, which is $x - 2$.",
      "Use the zero-product property: set each factor equal to 0, joined by “or”.",
      "Solve each small equation. Check every value in the original equation.",
    ],
    watch:
      "Set the factors equal to 0 only when the other side is 0. Keep every solution. Dividing both sides by $x$, or by a factor such as $x - 2$, can lose the solution that makes it 0, because dividing by 0 is not allowed.",
    principle:
      "For real numbers (all numbers on the number line), if $u$ times $v$ is 0, then $u = 0$ or $v = 0$. It also works the other way: if either is 0, the result is 0. So when $x^2 + 3x - 10$ is written as $(x + 5)(x - 2)$, the equation $x^2 + 3x - 10 = 0$ is true exactly when $x = -5$ or $x = 2$. In general, if the factors are $x + p$ and $x + q$, the solutions are $x = -p$ and $x = -q$, the numbers $p$ and $q$ with their signs switched. For $x - 2$, which is $x + (-2)$, the solution is 2. If $p$ and $q$ are equal, there is just one solution. An expression like $x^2 + 3x - 10$, made of terms that are plain numbers or numbers times $x$, $x^2$ and so on, is called a polynomial.",
    example: {
      prompt: "Solve $x^2+3x=10$ by factoring and justify each step.",
      steps: [
        "$x^2+3x-10=0$ — Subtraction property of equality. Subtract 10 from both sides so the right side is 0.",
        "$(x+5)(x-2)=0$ — Factoring. Look for two numbers that multiply to $-10$ and add to 3, the number multiplying $x$. Try pairs that multiply to $-10$: 1 and $-10$, $-1$ and 10, 2 and $-5$, and $-2$ and 5. Only $-2$ and 5 add to 3, so the factors are $x - 2$ and $x + 5$. The section below shows why this search works.",
        "$x+5=0$ or $x-2=0$ — Zero-product property. The two factors multiply to 0, so one or both of them is 0.",
        "$x=-5$ or $x=2$ — Subtract 5 from both sides of $x + 5 = 0$ to get $x$ alone (subtraction property of equality). Add 2 to both sides of $x - 2 = 0$ to get $x$ alone (addition property of equality).",
        "Check both in the original equation: $(-5)^2 + 3 \\times (-5) = 25 - 15 = 10$ and $2^2 + 3 \\times 2 = 4 + 6 = 10$.",
      ],
      answer: "$x=-5$ or $x=2$",
    },
    methodTitle: "Multiply back to check the factoring",
    methodText: [
      "Multiply out $(x + 5)(x - 2)$: multiply each part of the first factor by each part of the second. That gives $x \\times x = x^2$, $x \\times (-2) = -2x$, $5 \\times x = 5x$ and $5 \\times (-2) = -10$. The middle parts combine: $-2x + 5x = 3x$, because $-2 + 5 = 3$. Together they make $x^2 + 3x - 10$, the expression you factored. If it does not match, try another pair of numbers.",
      "This is why the two numbers must multiply to the plain number and add to the number multiplying $x$. The search works when $x^2$ has no number in front and such a pair of numbers can be found. Other quadratics need other methods. If the number in front of $x^2$ divides every term evenly, divide both sides by it first: $2x^2 + 6x - 20 = 0$ becomes $x^2 + 3x - 10 = 0$ after dividing both sides by 2.",
      "That number can also stay in front: $2(x + 5)(x - 2) = 0$ also gives $x = -5$ or $x = 2$, because the factor 2 is never 0.",
    ],
    formal:
      "Multiplying out $(x + p)(x + q)$ gives $x^2 + px + qx + pq$, where $pq$ means $p$ times $q$. The middle terms combine to $(p + q)x$. So $p$ and $q$ add to the number multiplying $x$, and they multiply to the plain number. Every step before the zero-product property rewrites the equation without changing its solutions. The property then splits it into two equations whose solutions together are exactly the solutions of the original.",
    pitfalls: [
      "Get 0 on one side before setting the factors equal to 0.",
      "Solve $x + 5 = 0$ to get $x = -5$. For a factor written as $x$ plus a number, the solution is that number with the other sign.",
    ],
    parentGuide:
      "Ask your learner to multiply the two brackets back together, such as $(x + 5)(x - 2)$, and check that they get the expression they started with. Then ask why one side must be 0 before splitting the brackets.",
    senses: {
      side: "side-of-equation",
      term: "term-expression",
      product: "product-multiply",
      squared: "square-number",
    },
    noLink: [
      "factor",
      "factors",
      "opposite",
      "part",
      "parts",
      "rule",
      "leaves",
    ],
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
