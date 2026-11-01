import type { GlossarySenses, MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const entry =
  "To enter the answer, type a whole number (one of 0, 1, 2, 3 and so on), a negative number (a number below 0), a fraction such as 7/2, or a decimal such as 3.5. Any way of writing the exact same value is accepted. The SAT answer box holds 5 characters, or 6 for a negative answer. A fraction such as 2/3 is correct as typed. A decimal that never ends must fill the box: cut it off or round it. So 2/3 can be .6666, .6667, 0.666 or 0.667, but not .67 or 0.66. Never type a mixed number (a whole number with a fraction) such as 3 1/2. Type 7/2 or 3.5.";

type Entry = {
  id: string;
  title: string;
  /** The practice-screen task, at most 140 characters; defaults to the summary. */
  goal?: string;
  summary: string;
  senses?: GlossarySenses;
  noLink?: string[];
  objectives: [string, string];
  intuition: string;
  terms: MethodTerm[];
  method: string[];
  watch: string;
  principle: string;
  example: { prompt: string; steps: string[]; answer: string };
  methodTitle: string;
  methodText: string[];
  formal: string;
  pitfalls: string[];
  parentGuide: string;
};

const entries: Entry[] = [
  {
    id: "sat-entry-system-solve",
    senses: {
      opposite: "opposite-number",
      opposites: "opposite-number",
      parts: "part",
      "right side": "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
    },
    noLink: ["leaves"],
    title: "Enter a variable from a 2×2 system",
    goal: "Make one letter cancel by giving it opposite numbers in front, solve what is left, and type the value, even a fraction.",
    summary:
      "A system of equations is two equations that must both be true for the same $x$ and $y$. To find $x$, make the $y$ parts cancel out. Multiply one equation so the numbers in front of $y$ are opposites (a pair like $3$ and $-3$ that adds to 0). Then add the equations. These systems have exactly one answer pair, so only $y$ cancels and $x$ is left. Solve for it. The answer may be a fraction.",
    objectives: [
      "Remove one variable (letter) from two equations by multiplying and adding them.",
      "Enter the exact value of $x$ or $y$, including a negative or fractional value.",
    ],
    intuition:
      "A system of equations is two equations that must both be true for the same $x$ and $y$. A coefficient is the number multiplying a variable: in $3y$, the coefficient is 3. Opposites are numbers like 3 and $-3$ that add to 0. If the $y$ coefficients are opposites, adding the two equations removes $y$. These systems have exactly one answer pair, so one equation with only $x$ is left.",
    terms: ["system-of-equations", "elimination"],
    method: [
      "Pick the letter the question does not ask for. Multiply one or both equations by a number (not 0) so that letter has opposite coefficients.",
      "Add the equations, so that letter cancels. Solve the equation that is left.",
      "Check by putting the value into the other equation, then enter it.",
    ],
    watch:
      "Multiply every term (each part joined by + or −) of an equation, including the number on the right side (the side after the equal sign). A fraction is a correct answer, so do not round it.",
    principle:
      "Adding equal amounts to both sides of an equation keeps it true, so the sum of two true equations is true. Multiplying both sides of an equation by a number other than 0 gives an equation with the same solutions. For $ax+by=c$ and $dx+ey=f$ with $ae-bd\\ne0$ (not equal to 0), the pair has exactly one solution.",
    example: {
      prompt: "In the system $2x+3y=7$ and $4x-y=1$, what is the value of $x$?",
      steps: [
        "The question asks for $x$, so remove $y$. Its coefficients are $3$ and $-1$. Multiply every term (each part joined by + or −) of the second equation by 3 to make them opposites: $12x-3y=3$.",
        "Add this to the first equation. The $y$ parts cancel: $2x+3y+12x-3y=7+3$, so $14x=10$.",
        "Divide both sides (the parts on each side of the equal sign) by 14 to get $x$ alone: $x=\\frac{10}{14}=\\frac57$.",
        "Check: from $4x-y=1$, $y=4\\cdot\\frac57-1=\\frac{13}{7}$. Then $2\\cdot\\frac57+3\\cdot\\frac{13}{7}=\\frac{10}{7}+\\frac{39}{7}=\\frac{49}{7}=7$, as the first equation says. (The dot $\\cdot$ means times.)",
      ],
      answer: "$\\frac57$",
    },
    methodTitle: "Make one variable cancel",
    methodText: [
      "Look at the coefficients of the letter you want to remove. If they are $3$ and $-1$, multiply the second equation by 3. That makes them $3$ and $-3$, which add to 0.",
      "After adding, one equation with one letter is left. If the coefficient does not divide the right side evenly, the answer is a fraction. " +
        entry,
    ],
    formal:
      "Suppose $ae-bd\\ne0$. Multiply $ax+by=c$ by $e$ and $dx+ey=f$ by $b$, then subtract. That gives $(ae-bd)x=ce-bf$, so $x=\\frac{ce-bf}{ae-bd}$. In the same way, $y=\\frac{af-cd}{ae-bd}$. The answer is a fraction when $ae-bd$ does not divide the top number evenly.",
    pitfalls: [
      "Multiply the number on the right side by the same number as the rest of the equation.",
      "Watch signs when subtracting: subtracting $-3y$ adds $3y$.",
    ],
    parentGuide:
      "Ask your learner which letter they are removing first, and why its two coefficients must be opposites.",
  },
  {
    id: "sat-entry-system-expression",
    senses: {
      part: "part",
      difference: "difference-subtract",
      differences: "difference-subtract",
      "left side": "side-of-equation",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["multiple", "multiples"],
    title: "Enter the value of an expression from a system",
    goal: "Find the value of an expression such as $4x+6y$ by adding, subtracting or multiplying two equations, without finding $x$ and $y$.",
    summary:
      "Sometimes a question gives two equations and asks for an expression, such as $4x+6y$, not for $x$ or $y$. An expression is numbers and letters joined by operations. You can add two true equations together. Add the left sides (the parts before the equal signs), and add the right sides (the parts after them). If the new left side is exactly the expression, the new right side is its value.",
    objectives: [
      "Find a way to combine two equations so the left side becomes the expression asked for.",
      "Do the same thing to the right sides, including taking half or a negative multiple.",
    ],
    intuition:
      "An equation says two amounts are equal. If $A=B$ and $C=D$, then $A+C=B+D$: you can add two true equations, left side (the part before the equal sign) to left side and right side to right side. A coefficient is the number multiplying a letter, such as 3 in $3x$. If the left sides add up to exactly the expression asked for, the right sides add up to its value. You never need $x$ or $y$ alone.",
    terms: ["expression", "linear-combination"],
    method: [
      "Compare the coefficients of $x$ and $y$ in the expression asked for with those in the equations.",
      "Choose what to multiply each equation by (often 1, $-1$, or $\\frac12$) so the left sides combine into that expression.",
      "Do the same to the right sides and add. " + entry,
    ],
    watch:
      "If the left sides add to twice the expression, halve the right side too. The answer may be a fraction.",
    principle:
      "If $L_1=R_1$ and $L_2=R_2$, then $mL_1+nL_2=mR_1+nR_2$ for any numbers $m$ and $n$. Here $L_1$ and $R_1$ (read “$L$ one” and “$R$ one”) are the two sides of the first equation. When the left side equals the expression asked for, the right side is its value.",
    example: {
      prompt: "If $3x+y=7$ and $x+5y=9$, what is the value of $4x+6y$?",
      steps: [
        "Look at the coefficients. For $x$: $3+1=4$. For $y$: $1+5=6$. They match $4x+6y$, so simply add the two equations.",
        "Add the left sides: $(3x+y)+(x+5y)=4x+6y$.",
        "Add the right sides the same way: $7+9=16$. So $4x+6y=16$.",
      ],
      answer: "$16$",
    },
    methodTitle: "Combine the equations directly",
    methodText: [
      "Write down the coefficients of $x$ and $y$ in the expression asked for. Then ask what multiples of the two equations give those numbers. Adding equations adds their coefficients. Subtracting gives the differences.",
      "If the combined left side is twice the expression, divide the right side by 2. " +
        entry,
    ],
    formal:
      "Say the equations are $ax+by=c$ and $dx+ey=f$, and the expression is $px+qy$. Look for numbers $m$ and $n$ with $ma+nd=p$ and $mb+ne=q$. Then the expression equals $mc+nf$. Such numbers exist whenever the system has exactly one solution, but this way you never have to find it.",
    pitfalls: [
      "Multiply both sides of an equation by the same number before combining.",
      "When subtracting, subtract the right sides in the same order as the left sides.",
    ],
    parentGuide:
      "Ask your learner why $4x+6y$ can be found without solving for $x$ and $y$.",
  },
  {
    id: "sat-entry-quadratic-solution",
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      "left side": "side-of-equation",
      "more than": "more-than",
      opposite: "opposite-number",
      part: "part",
      parts: "part",
      product: "product-multiply",
      side: "side-of-equation",
      sides: "side-of-equation",
      square: "square-number",
      squared: "square-number",
      term: "term-expression",
      terms: "term-expression",
    },
    title: "Enter a quadratic solution",
    goal: "Factor the quadratic, set each factor to 0, then choose the solution described: the greater, the positive or the only one.",
    summary:
      "Squared means times itself: in $2x^2+5x-3=0$, $x^2$ is $x$ times $x$. An equation with an $x^2$ part and no higher power is called a quadratic. If two numbers multiply to make 0, one or both of them must be 0. So write the quadratic as two parts multiplied together, set each part equal to 0, and solve. Then pick the solution the question asks for.",
    objectives: [
      "Solve a quadratic by factoring (writing it as a product), including one with a number other than 1 in front of $x^2$, and a perfect square.",
      "Choose the solution the question asks for and enter it as a whole number or a fraction.",
    ],
    intuition:
      "Squared means times itself: $x^2$ is $x$ times $x$. A quadratic equation has an $x^2$ part and no higher power. Factors are the parts being multiplied: in $(2x-1)(x+3)$, the factors are $2x-1$ and $x+3$. If two numbers multiply to 0, one of them is 0. So once the equation reads (factor)(factor) $=0$, set each factor to 0 to find the solutions.",
    terms: [
      "solution",
      [
        "perfect-square-trinomial",
        "$(mx + n)^2$ equals 0 only when $mx + n = 0$.",
      ],
    ],
    method: [
      "Move every term (each part joined by + or −) to one side (one side of the equal sign), so the equation equals 0.",
      "Factor the quadratic into two parts multiplied together, such as $(2x-1)(x+3)$.",
      "Set each factor equal to 0, solve, and pick the solution the question asks for. " +
        entry,
    ],
    watch:
      "A factor that repeats gives one solution, not two. Read the question: of two negative solutions, the greater one is closer to 0.",
    principle:
      "If two numbers multiply to 0, one or both of them is 0: if $uv=0$ then $u=0$ or $v=0$. This is called the zero-product property. For $(mx+n)(kx+j)=0$, with $m$ and $k$ not 0, the solutions are $-\\frac nm$ and $-\\frac jk$.",
    example: {
      prompt: "What is the positive solution of $2x^2+5x-3=0$?",
      steps: [
        "Factor: $2x^2+5x-3=(2x-1)(x+3)$. Check by multiplying back: $2x\\cdot x=2x^2$, $(-1)(3)=-3$, and $2x\\cdot3+(-1)x=5x$. (The dot $\\cdot$ means times.)",
        "The product (the answer when you multiply) is 0, so one factor is 0. $2x-1=0$ gives $x=\\frac12$. $x+3=0$ gives $x=-3$.",
        "The question asks for the positive solution, which is $\\frac12$.",
      ],
      answer: "$\\frac12$",
    },
    methodTitle: "Factor, then read off the solution",
    methodText: [
      "For $x^2+bx+c$, look for two numbers that multiply to $c$ and add to $b$. When the number in front of $x^2$ is more than 1, try pairs of factors until the middle term (the $x$ part) matches.",
      "Then compare the two solutions with the wording: greater, positive, or only. " +
        entry,
    ],
    formal:
      "A quadratic $ax^2+bx+c$, with $a\\ne0$, whose real-number solutions are $r_1$ and $r_2$ can be written $a(x-r_1)(x-r_2)$. It has exactly one real solution when $b^2-4ac=0$. Then it is $a(x-r)^2$, with $r=-\\frac{b}{2a}$.",
    pitfalls: [
      "Make the equation equal 0 before factoring.",
      "Check the sign of each solution: $x+3=0$ gives $-3$.",
    ],
    parentGuide:
      "Ask your learner to multiply the factors back together to check the middle term.",
  },
  {
    id: "sat-entry-root-relations",
    senses: {
      "left side": "side-of-equation",
      part: "part",
      parts: "part",
      product: "product-multiply",
      sides: "side-of-equation",
      terms: "term-expression",
    },
    title: "Enter a sum or product of quadratic solutions",
    goal: "Find the sum or product of a quadratic's two solutions straight from its numbers, without solving it.",
    summary:
      "A quadratic equation has an $x^2$ part ($x$ times $x$) and no higher power, like $3x^2-8x+2=0$. Call its two solutions $p$ and $q$. Their sum $p+q$ and their product (the result of multiplying), $pq$, can be read straight from the numbers in the equation. So some questions can be answered without finding $p$ and $q$ at all.",
    objectives: [
      "Use $p+q=-\\frac ba$ and $pq=\\frac ca$ for the solutions of $ax^2+bx+c=0$.",
      "Rewrite $\\frac1p+\\frac1q$ or $p^2+q^2$ using only $p+q$ and $pq$.",
    ],
    intuition:
      "In $ax^2+bx+c=0$, the coefficients $a$, $b$ and $c$ are the numbers in the equation: $a$ multiplies $x^2$, $b$ multiplies $x$, and $c$ stands alone. Each term, a part joined to the rest by + or −, has a coefficient. If $p$ and $q$ are the solutions, the left side (the part before the equal sign) equals $a(x-p)(x-q)$. Multiplying that out gives $ax^2-a(p+q)x+apq$. So $b=-a(p+q)$ and $c=apq$. Divide by $a$ and fix the sign: the sum is $p+q=-\\frac ba$, and the product (the result of multiplying) is $pq=\\frac ca$.",
    terms: ["coefficient"],
    method: [
      "Find $a$, $b$ and $c$ in $ax^2+bx+c=0$.",
      "Work out $p+q=-\\frac ba$ and $pq=\\frac ca$.",
      "Rewrite the quantity asked for using them: $\\frac1p+\\frac1q=\\frac{p+q}{pq}$ and $p^2+q^2=(p+q)^2-2pq$. " +
        entry,
    ],
    watch:
      "The sum is $-\\frac ba$, with a minus sign. When $a$ is not 1, both formulas divide by $a$.",
    principle:
      "If $ax^2+bx+c=a(x-p)(x-q)$, with $a\\ne0$, then $b=-a(p+q)$ and $c=apq$. So $p+q=-\\frac ba$ and $pq=\\frac ca$. These are called Vieta's formulas, and they hold for any quadratic with solutions $p$ and $q$.",
    example: {
      prompt:
        "The equation $3x^2-8x+2=0$ has two distinct real solutions, $p$ and $q$. What is the value of $\\frac1p+\\frac1q$?",
      steps: [
        "Read the coefficients: $a=3$, $b=-8$ and $c=2$. So $p+q=-\\frac{-8}{3}=\\frac83$ and $pq=\\frac23$.",
        "Add the fractions over a common bottom: $\\frac1p+\\frac1q=\\frac{q+p}{pq}$. Put in the values: $\\frac{8/3}{2/3}=\\frac83\\times\\frac32=4$.",
      ],
      answer: "$4$",
    },
    methodTitle: "Read the sum and product from the coefficients",
    methodText: [
      "Multiply out $a(x-p)(x-q)=ax^2-a(p+q)x+apq$. Match each part with $ax^2+bx+c$: the $x$ parts give $b=-a(p+q)$, and the plain numbers give $c=apq$.",
      "Then write the question using only $p+q$ and $pq$ before putting in numbers. " +
        entry,
    ],
    formal:
      "Let $p$ and $q$ be different real numbers (the numbers on the number line) with $ax^2+bx+c=a(x-p)(x-q)$ and $a\\ne0$. Matching coefficients gives $p+q=-\\frac ba$ and $pq=\\frac ca$. An expression is a mix of numbers, letters and operations. Any expression that stays the same when $p$ and $q$ swap places can be written using these two numbers.",
    pitfalls: [
      "Do not forget the minus sign in $-\\frac ba$.",
      "Divide by $a$, not only by the plain number $c$.",
    ],
    parentGuide:
      "Ask your learner to multiply out $(x-2)(x-5)$ and see where 7 and 10 appear.",
  },
  {
    id: "sat-entry-absolute-equation",
    senses: {
      part: "part",
      "left side": "side-of-equation",
      opposite: "opposite-number",
      "right side": "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["mean", "square", "squaring", "whole"],
    title: "Enter an absolute-value solution",
    goal: "Split an absolute-value equation into two cases, solve each, and reject any value that makes the right side negative.",
    summary:
      "The absolute value of a number, written with bars like $|-5|$, is its distance from 0, so $|-5|=5$ and $|5|=5$. An absolute value is never negative. If $|u|=3$, then $u$ is $3$ or $-3$. So split the equation into two cases, solve each, and check each answer in the original equation.",
    objectives: [
      "Split $|u|=v$ into $u=v$ and $u=-v$, and solve both.",
      "Throw out a candidate that does not really work, and enter the remaining solution or a sum.",
    ],
    intuition:
      "The absolute value $|u|$ is the distance of $u$ from 0 on the number line, so it is never negative. If $|u|=v$, then $u$ is either $v$ or $-v$. When $v$ itself contains $x$, a candidate (a possible answer) may make $v$ negative. That candidate cannot be a solution. A candidate that fails this check is called extraneous.",
    terms: ["absolute-value", "extraneous-solution"],
    method: [
      "Write the two cases: the inside equals $v$, and the inside equals $-v$.",
      "Solve each case.",
      "Put each candidate into the original equation. Keep only those that make it true. " +
        entry,
    ],
    watch:
      "If the right side (the part after the equal sign) contains $x$, test it. A negative right side can never equal an absolute value.",
    principle:
      "For a real number $v$, $|u|=v$ needs $v\\ge0$ ($v$ is 0 or more). Then it means $u=v$ or $u=-v$. If $v<0$, there is no solution.",
    example: {
      prompt: "What is the solution of $|x-4|=2x+2$?",
      steps: [
        "Case 1, the inside equals the right side: $x-4=2x+2$. Subtract $x$ and 2 from both sides: $x=-6$.",
        "Case 2, the inside equals the opposite (the same number with the other sign) of the right side: $-(x-4)=2x+2$, which is $4-x=2x+2$. Add $x$ and subtract 2: $2=3x$, so $x=\\frac23$.",
        "Test $x=-6$: the right side is $2(-6)+2=-10$. That is negative, and an absolute value cannot be negative, so reject it.",
        "Test $x=\\frac23$: the left side is $|\\frac23-4|=|-\\frac{10}{3}|=\\frac{10}{3}$, and the right side is $2\\cdot\\frac23+2=\\frac{10}{3}$ (the dot means times). They match, so it works.",
      ],
      answer: "$\\frac23$",
    },
    methodTitle: "Two cases, then check",
    methodText: [
      "The two cases cover both signs of the inside: positive or zero, and negative. You do not need to multiply anything by itself.",
      "Always finish by putting each answer back in. A sum of solutions counts only the values that pass. " +
        entry,
    ],
    formal:
      "For real numbers (the numbers on the number line) with $a\\ne0$ and $k>0$, $|ax+b|=k$ has two solutions, $\\frac{k-b}{a}$ and $\\frac{-k-b}{a}$. Their sum is $-\\frac{2b}{a}$. For $|u|=|w|$, the two cases are $u=w$ and $u=-w$.",
    pitfalls: [
      "In the second case, take the opposite of the whole inside expression.",
      "Do not skip the check when $x$ appears on the right side.",
    ],
    parentGuide:
      "Ask your learner to describe $|x-4|=3$ as a distance on a number line.",
  },
  {
    id: "sat-entry-radical-equation",
    title: "Enter a radical-equation solution",
    summary:
      "Square both sides, solve the resulting quadratic, then test each candidate because squaring can add values that do not work.",
    objectives: [
      "Square a radical equation and solve the resulting quadratic.",
      "Reject a candidate that makes the right side negative and enter the valid solution or sum.",
    ],
    intuition:
      "The square root symbol means the non-negative root, so $\\sqrt{u}$ is never negative. Squaring both sides removes the root but also accepts the case where the right side is negative. Candidates must be checked in the original equation.",
    terms: ["extraneous-solution"],
    method: [
      "Isolate the square root, then square both sides.",
      "Move everything to one side and solve the quadratic.",
      "Substitute each candidate into the original equation and keep the valid ones. " +
        entry,
    ],
    watch:
      "Check the right side before squaring: if it is negative, the candidate fails even though the squared equation holds.",
    principle:
      "If $\\sqrt{u}=w$, then $w\\ge0$ and $u=w^2$. Conversely, $u=w^2$ gives $\\sqrt{u}=|w|$, which equals $w$ only when $w\\ge0$.",
    example: {
      prompt: "What is the solution of $\\sqrt{x+6}=x$?",
      steps: [
        "Square both sides: $x+6=x^2$, so $x^2-x-6=0$ and $(x-3)(x+2)=0$.",
        "Candidates: $x=3$ and $x=-2$.",
        "Test $x=-2$: $\\sqrt{4}=2$ but the right side is $-2$, so reject it.",
        "Test $x=3$: $\\sqrt9=3$. It works.",
      ],
      answer: "$3$",
    },
    methodTitle: "Square, solve, test",
    methodText: [
      "Squaring turns the radical equation into a quadratic that may have two solutions. The test decides which are real solutions.",
      "A sum of solutions adds only values that pass the test. " + entry,
    ],
    formal:
      "For real $u,w$: $\\sqrt{u}=w$ is equivalent to $u=w^2$ together with $w\\ge0$. If both roots of the squared equation satisfy $w\\ge0$, both are solutions.",
    pitfalls: [
      "Check candidates in the original equation, not the squared one.",
      "A candidate can make the radicand positive and still fail.",
    ],
    parentGuide: "Ask your learner why $\\sqrt{4}$ equals 2 and not $-2$.",
  },
  {
    id: "sat-entry-rational-equation",
    title: "Enter a rational-equation solution",
    summary:
      "A fraction equals 0 only when its numerator is 0 and its denominator is not; exclude any value that makes a denominator 0.",
    objectives: [
      "Find the values that make a denominator 0 before solving.",
      "Cross-multiply or factor and enter the valid solution or sum.",
    ],
    intuition:
      "A rational expression is a fraction with $x$ in the denominator. Division by 0 is undefined, so the value that makes the denominator 0 can never be a solution, even if it solves the simplified equation.",
    terms: ["excluded-value"],
    method: [
      "List the excluded values from the denominators.",
      "Solve: set the numerator to 0, or cross-multiply when two fractions are equal.",
      "Discard any excluded value and enter what remains. " + entry,
    ],
    watch:
      "A root of the numerator that equals an excluded value is not a solution.",
    principle:
      "For $D(x)\\ne0$, $\\frac{N(x)}{D(x)}=0$ if and only if $N(x)=0$. For nonzero denominators, $\\frac ab=\\frac cd$ is equivalent to $ad=bc$.",
    example: {
      prompt: "What is the solution of $\\frac{x^2-x-6}{x-3}=0$?",
      steps: [
        "The denominator is 0 at $x=3$, so $x\\ne3$.",
        "Factor the numerator: $x^2-x-6=(x-3)(x+2)$, which is 0 at $x=3$ and $x=-2$.",
        "Reject 3. The solution is $-2$.",
      ],
      answer: "$-2$",
    },
    methodTitle: "Exclude first, then solve",
    methodText: [
      "Write the excluded values before any algebra so they cannot be forgotten.",
      "When cross-multiplying, the $x^2$ terms may cancel and leave a linear equation. " +
        entry,
    ],
    formal:
      "The domain of $\\frac{N}{D}$ is all real $x$ with $D(x)\\ne0$. A solution must lie in the domain of every fraction in the equation.",
    pitfalls: [
      "Do not cancel a factor without noting that it excludes a value.",
      "Cross-multiplying correctly: multiply numerator by the other denominator.",
    ],
    parentGuide:
      "Ask your learner what happens to $\\frac{5}{x-3}$ when $x=3$.",
  },
  {
    id: "sat-entry-polynomial-zeros",
    title: "Enter a zero of a factored polynomial",
    summary:
      "Each factor equal to 0 gives a zero. List each once, ignore constant multipliers; a factor like $x^2+4$ has no real zero.",
    objectives: [
      "Read zeros from a polynomial written as a product of factors.",
      "Enter the least, positive or distinct-sum value, including a fractional zero.",
    ],
    intuition:
      "A zero of a polynomial is an input that makes its value 0. A product is 0 only when one of its factors is 0, so you can read zeros by setting each factor equal to 0.",
    terms: [
      "zero-of-a-function",
      [
        "zero-of-a-function",
        "Distinct zeros are the different zeros; a repeated factor counts once.",
      ],
    ],
    method: [
      "Set each factor equal to 0 and solve. A constant factor gives no zero.",
      "Count a repeated factor once. A factor such as $x^2+4$ has no real zero.",
      "Choose the zero the question asks for or add the distinct ones. " +
        entry,
    ],
    watch:
      "A factor $(3x-2)$ gives $\\frac23$, not $2$. A squared factor still gives a single zero.",
    principle:
      "If $f(x)=a(x-r_1)^{m_1}\\cdots(x-r_k)^{m_k}g(x)$ and $g$ has no real zero, the real zeros of $f$ are exactly $r_1,\\dots,r_k$. Multiplicity does not change the set of zeros.",
    example: {
      prompt:
        "What is the sum of the distinct real zeros of $f(x)=2(x-4)^2(x+1)(2x-3)$?",
      steps: [
        "Set each factor to 0: $x-4=0$ gives 4, $x+1=0$ gives $-1$, and $2x-3=0$ gives $\\frac32$.",
        "The squared factor gives the single zero 4, and the constant 2 gives none.",
        "Add the distinct zeros: $4+(-1)+\\frac32=\\frac92$.",
      ],
      answer: "$\\frac92$",
    },
    methodTitle: "One zero per factor",
    methodText: [
      "Write each factor's zero beside it, then cross out repeats and constants.",
      "To test a quadratic factor, ask whether $x^2=-k$ for a positive $k$ is possible. It is not. " +
        entry,
    ],
    formal:
      "A real polynomial factor $x^2+k$ with $k>0$ is positive for every real $x$, so it contributes no real zero. A factor $(mx-n)$ has the zero $\\frac nm$.",
    pitfalls: [
      "Solve $mx-n=0$ fully; do not stop at $n$.",
      "Do not add a repeated zero twice.",
    ],
    parentGuide:
      "Ask your learner why $(x-4)^2$ and $(x-4)$ have the same zero.",
  },
  {
    id: "sat-entry-quadratic-context",
    title: "Enter a quadratic-model value",
    summary:
      "For $h(t)=-at^2+bt+c$, the peak is at $t=\\frac{b}{2a}$. Substitute for the greatest height, or factor to find when it is 0.",
    objectives: [
      "Find the time and value of the greatest height from an expanded quadratic.",
      "Find the landing time from a zero of the height function.",
    ],
    intuition:
      "A parabola that opens downward has a highest point on its axis of symmetry, halfway between the two points where the height is 0. The height there is the greatest height. The height is 0 when the object is at ground level.",
    terms: ["axis-of-symmetry", "vertex-parabola"],
    method: [
      "Find the time of greatest height with $t=\\frac{-b}{2a}$ (for $a<0$).",
      "Substitute that time into $h$ for the greatest height, or set $h=0$ and factor for the landing time.",
      "Use only meaningful values (positive times). " + entry,
    ],
    watch: "Use the signed coefficients: for $-4t^2+12t+7$, $a=-4$ and $b=12$.",
    principle:
      "For $h(t)=at^2+bt+c$, the vertex is at $t=-\\frac{b}{2a}$ and has height $c-\\frac{b^2}{4a}$. The two zeros, when real, are symmetric about this time.",
    example: {
      prompt:
        "A ball is hit upward. Its height, in meters, $t$ seconds after it is hit is $h(t)=-4t^2+12t+7$ for $t\\ge0$ until it lands. What is the greatest height, in meters, that the ball reaches?",
      steps: [
        "With $a=-4$ and $b=12$ the axis is $t=\\frac{-12}{2(-4)}=\\frac32$.",
        "Substitute: $h(\\frac32)=-4\\cdot\\frac94+12\\cdot\\frac32+7=-9+18+7=16$.",
        "The greatest height is 16 meters.",
      ],
      answer: "$16$",
    },
    methodTitle: "Vertex first",
    methodText: [
      "The vertex time is the average of the two zeros, so it is also the midpoint of the flight. Substituting it gives the maximum.",
      "A landing time is the positive solution of $h(t)=0$. " + entry,
    ],
    formal:
      "Completing the square gives $at^2+bt+c=a\\left(t+\\frac{b}{2a}\\right)^2+c-\\frac{b^2}{4a}$. For $a<0$ the maximum value is $c-\\frac{b^2}{4a}$, reached at $t=-\\frac{b}{2a}$.",
    pitfalls: [
      "Keep the sign of $a$ when applying the formula.",
      "Reject a negative zero time when asked when the object lands.",
    ],
    parentGuide:
      "Ask your learner to explain why the ball is highest halfway between launch and landing when it starts at ground level.",
  },
  {
    id: "sat-entry-rate-numeric",
    senses: {
      change: "change",
      difference: "difference-subtract",
      part: "part",
      unit: "unit",
    },
    noLink: ["average", "balance", "net", "whole"],
    title: "Enter a combined-rate or mixture value",
    goal: "Add rates (jobs per hour), not times, subtract a draining rate, or balance the amount of a substance before and after mixing.",
    summary:
      "A rate tells how much gets done in one unit of time, such as $\\frac14$ of a job per hour. When two machines work together, add their rates, not their times. A drain works against a fill, so subtract its rate. In a mixture, the amount of a substance, such as acid, is the same before and after mixing.",
    objectives: [
      "Combine, subtract or take turns with steady rates, exactly.",
      "Write a mixture balance and solve it for the unknown amount.",
    ],
    intuition:
      "A rate says how much happens in one unit of time. A machine that finishes a job in 4 hours does $\\frac14$ of the job each hour. If a second machine does $\\frac16$ of the job each hour, together they do $\\frac14+\\frac16$ of the job each hour. The time for 1 whole job is 1 divided by that rate. Concentration is the part of a mixture that is one substance, such as 20% acid.",
    terms: ["rate", "concentration"],
    method: [
      "Write each rate as a fraction of the job per unit of time. A job done in 4 hours is $\\frac14$ of the job per hour.",
      "Add rates that work together, and subtract a rate that works against them. For a mixture, set the substance before mixing equal to the substance after.",
      "Divide the whole job by the combined rate, or solve the balance equation. " +
        entry,
    ],
    watch:
      "When machines work at the same time, add their rates, not their times. A drain subtracts its rate. When they work one after another, add the time for each part.",
    principle:
      "If an amount of work $W$ is done at a rate $r$, the time is $\\frac Wr$. Steady rates working together add. In a mixture, amount of substance = volume $\\times$ concentration (a percent by volume), and the total amount of substance stays the same when mixtures are combined.",
    example: {
      prompt:
        "Working alone, one machine finishes a job in 4 hours and a second machine finishes the same job in 6 hours. Working together at these constant rates, how many hours do they need to finish the job?",
      steps: [
        "Turn each time into a rate. The first machine does $\\frac14$ of the job per hour, and the second does $\\frac16$ of the job per hour.",
        "Working together, their rates add. Use 12 as a common bottom: $\\frac14+\\frac16=\\frac3{12}+\\frac2{12}=\\frac{5}{12}$ of the job per hour.",
        "Time = whole job ÷ rate: $1\\div\\frac5{12}=1\\times\\frac{12}{5}=\\frac{12}{5}=2.4$ hours. That is less than 4 hours, as it should be.",
      ],
      answer: "$\\frac{12}{5}$",
    },
    methodTitle: "Work in rates",
    methodText: [
      "Change each time into a rate before combining anything. The time together is shorter than either machine's time alone.",
      "For a mixture, write one equation for the substance: old amount plus added amount equals the new total amount. Each amount is the volume (how much liquid there is) times the concentration, with the percent written as a decimal (20% is 0.2). " +
        entry,
    ],
    formal:
      "Suppose two workers finish a job alone in $a$ and $b$ hours. Their rates are $\\frac1a$ and $\\frac1b$, so together they need $1\\div(\\frac1a+\\frac1b)=\\frac{ab}{a+b}$ hours. If one fills in $a$ hours while a drain empties in $b$ hours, with $b>a$, the net time is $\\frac{ab}{b-a}$ hours.",
    pitfalls: [
      "Do not average the times.",
      "In a mixture equation, write percents as decimals.",
    ],
    parentGuide:
      "Ask your learner whether two workers together should take longer or shorter than the faster worker alone.",
  },
  {
    id: "sat-entry-radian-conversion",
    title: "Enter a degree-radian conversion",
    summary:
      "A half turn is 180 degrees and $\\pi$ radians. Multiply by $\\frac{\\pi}{180}$ or $\\frac{180}{\\pi}$, then enter the number.",
    objectives: [
      "Write a degree measure as $k\\pi$ radians and enter $k$.",
      "Convert a radian measure to degrees, including negative angles and angles beyond a full turn.",
    ],
    intuition:
      "Degrees and radians measure the same turning with different units. A half turn is 180 degrees, and it is also $\\pi$ radians, so one degree is $\\frac{\\pi}{180}$ radians.",
    terms: ["radian"],
    method: [
      "To get radians, multiply degrees by $\\frac{\\pi}{180}$ and simplify the fraction; the coefficient of $\\pi$ is $k$.",
      "To get degrees, replace $\\pi$ by 180 and simplify.",
      "Keep a negative sign for a clockwise angle. " + entry,
    ],
    watch:
      "Enter only the coefficient $k$ when the question writes the measure as $k\\pi$.",
    principle:
      "$180^\\circ=\\pi$ radians. Hence $d^\\circ=\\frac{d}{180}\\pi$ radians and $\\theta$ radians $=\\frac{180\\theta}{\\pi}$ degrees.",
    example: {
      prompt:
        "An angle measures $150^\\circ$. In radians its measure is $k\\pi$. What is the value of $k$?",
      steps: [
        "Multiply by $\\frac{\\pi}{180}$: $150\\cdot\\frac{\\pi}{180}=\\frac{150}{180}\\pi$.",
        "Simplify: $\\frac{150}{180}=\\frac56$, so the measure is $\\frac56\\pi$ and $k=\\frac56$.",
      ],
      answer: "$\\frac56$",
    },
    methodTitle: "Fraction of a half turn",
    methodText: [
      "The coefficient is the fraction of a half turn: $150^\\circ$ is $\\frac{150}{180}$ of 180 degrees.",
      "Angles beyond $360^\\circ$ give $k>2$. " + entry,
    ],
    formal:
      "The conversion is linear: $\\theta_{\\text{rad}}=\\frac{\\pi}{180}\\theta_{\\text{deg}}$. Negative angles keep their sign; angles beyond a full turn keep their full value.",
    pitfalls: [
      "Do not multiply by $\\pi$ alone; also divide by 180.",
      "Simplify the fraction completely.",
    ],
    parentGuide:
      "Ask your learner how many degrees are in $\\frac\\pi2$ radians and why.",
  },
  {
    id: "sat-entry-inequality-integer",
    senses: {
      part: "part",
      boundary: "boundary",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    noLink: ["leaves", "range", "whole"],
    title: "Enter an integer satisfying an inequality",
    goal: "Solve the inequality for $x$, then decide which integers are inside it, watching strict signs and negative numbers in front of $x$.",
    summary:
      "An inequality compares two amounts that may not be equal. The sign $<$ means is less than, so $x<4$ is true for every number below 4. An integer is a whole number or its negative, such as $-2$, 0 or 3. To answer, solve the inequality the way you solve an equation. Then find the integers it allows.",
    objectives: [
      "Solve an inequality, and flip its sign when multiplying or dividing by a negative number.",
      "Find the greatest or least integer solution, or count the positive integer solutions.",
    ],
    intuition:
      "An inequality such as $x<4$ is true for a whole range of numbers. The sign $<$ means is less than, and $\\le$ means is less than or equal to. An integer is a whole number or its negative. The boundary is the number where the solutions stop, such as 4 in $x<4$. A strict sign ($<$ or $>$) leaves out the boundary itself, so 4 does not count for $x<4$. Dividing both sides (the parts on each side of the sign) by a negative number (a number below 0) flips the sign.",
    terms: ["strict-inequality", "integer"],
    method: [
      "Solve for $x$ as you would an equation. Flip the sign when you multiply or divide both sides by a negative number.",
      "Look at the boundary number: it counts for $\\le$ and $\\ge$, but not for $<$ and $>$.",
      "Pick the greatest or least integer in the range, or count them. Type the integer, with a minus sign if it is negative.",
    ],
    watch:
      "If the boundary is an integer and the sign is strict, step one integer inside. For $x<4$, the greatest integer is 3.",
    principle:
      "Adding or subtracting the same number on both sides keeps an inequality's direction. So does multiplying or dividing both sides by a positive number. Multiplying or dividing both sides by a negative number reverses it.",
    example: {
      prompt: "What is the greatest integer $x$ that satisfies $4x-5<11$?",
      steps: [
        "Add 5 to both sides to undo the $-5$: $4x<16$. Divide both sides by 4, a positive number, so the sign stays: $x<4$.",
        "The sign is strict, so the boundary 4 is not allowed.",
        "The greatest integer less than 4 is 3. Check: $4\\times3-5=7$, and 7 is less than 11.",
      ],
      answer: "$3$",
    },
    methodTitle: "Boundary, then integers",
    methodText: [
      "After solving, picture the boundary on a number line, a line with evenly spaced marks for numbers. Shade the side where the solutions are.",
      "To count the positive integers below a boundary, start at 1. If the boundary is 1 or less, there are none, so the count is 0.",
      "Type the integer or the count. Type a negative integer with its minus sign.",
    ],
    formal:
      "Let $b$ be a real-number boundary. The symbol $\\lfloor b\\rfloor$ means the greatest integer that is $b$ or less, and $\\lceil b\\rceil$ means the least integer that is $b$ or more. The greatest integer with $x\\le b$ is $\\lfloor b\\rfloor$. With $x<b$, it is $\\lceil b\\rceil-1$. The least integer with $x>b$ is $\\lfloor b\\rfloor+1$.",
    pitfalls: [
      "Reverse the inequality when dividing by a negative number.",
      "Round toward the inside of the solution range, not to the nearest integer.",
    ],
    parentGuide:
      "Ask your learner whether 4 itself satisfies $x<4$ and why not.",
  },
];

const stripFormat = (e: Entry): ProblemMethod => ({
  goal: e.goal ?? e.summary,
  ...(e.senses ? { senses: e.senses } : {}),
  ...(e.noLink ? { noLink: e.noLink } : {}),
  intuition: e.intuition,
  terms: e.terms,
  method: e.method,
  watch: e.watch,
});

export const satNumericEntryMethods: Record<string, ProblemMethod> =
  Object.fromEntries(entries.map((e) => [e.id, stripFormat(e)]));

export const satNumericEntryPrinciples: Record<string, string> =
  Object.fromEntries(entries.map((e) => [e.id, e.principle]));

export const satNumericEntryLessons: Lesson[] = entries.map((e) => ({
  id: e.id,
  title: e.title,
  summary: e.summary,
  templateIds: [e.id],
  ...(e.senses ? { senses: e.senses } : {}),
  ...(e.noLink ? { noLink: e.noLink } : {}),
  objectives: [...e.objectives],
  sections: [
    {
      stage: "intuition",
      title: "What the question asks",
      paragraphs: [e.intuition],
    },
  ],
  workedExample: e.example,
  closingSections: [
    { stage: "method", title: e.methodTitle, paragraphs: e.methodText },
    { stage: "formal", title: "Why the method works", paragraphs: [e.formal] },
  ],
  pitfalls: e.pitfalls,
  parentGuide: e.parentGuide,
}));
