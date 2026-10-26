import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const entry =
  "Type a whole number, a negative number, a fraction such as 7/2, or a decimal such as 3.5; equivalent exact forms are accepted. The SAT field holds 5 characters, or 6 for a negative answer. A fraction such as 2/3 is correct as typed. If you use a decimal for an answer that does not end, fill the space by truncating or rounding: 2/3 is .6666, .6667, 0.666 or 0.667, but not .67 or 0.66. Never type a mixed number such as 3 1/2; type 7/2 or 3.5.";

type Entry = {
  id: string;
  title: string;
  summary: string;
  objectives: [string, string];
  intuition: string;
  terms: [string, string][];
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
    title: "Enter a variable from a 2×2 system",
    summary:
      "Cancel one variable by making its coefficients opposite, solve what remains, and type the value, even a fraction.",
    objectives: [
      "Eliminate one variable from two linear equations by multiplying and adding.",
      "Enter the exact value of $x$ or $y$, including a negative or fractional value.",
    ],
    intuition:
      "A system of equations is two equations that must both be true for the same $x$ and $y$. If the $y$ terms are opposites, adding the equations removes $y$ and leaves one equation in $x$. A coefficient is the number multiplying a variable.",
    terms: [
      ["system", "Two or more equations that the same values must satisfy."],
      [
        "elimination",
        "Adding or subtracting equations so that one variable cancels.",
      ],
    ],
    method: [
      "Choose the variable that is not requested. Multiply one or both equations by nonzero numbers so that variable has opposite coefficients.",
      "Add the equations. Solve the single equation that remains for the requested variable.",
      "Check by substituting into the other equation, then enter the value.",
    ],
    watch:
      "Multiply every term of an equation, including the constant on the right. A fraction is a valid answer; do not round it.",
    principle:
      "Adding equal quantities to both sides of an equation keeps it true, so the sum of two true equations is true. Multiplying both sides of an equation by a nonzero number gives an equivalent equation. For $ax+by=c$ and $dx+ey=f$ with $ae-bd\\ne0$, the pair has exactly one solution.",
    example: {
      prompt: "In the system $2x+3y=7$ and $4x-y=1$, what is the value of $x$?",
      steps: [
        "To remove $y$, multiply the second equation by 3: $12x-3y=3$.",
        "Add it to the first equation: $2x+3y+12x-3y=7+3$, so $14x=10$.",
        "Divide by 14: $x=\\frac{10}{14}=\\frac57$.",
        "Check: from $4x-y=1$, $y=\\frac{13}{7}$, and $2\\cdot\\frac57+3\\cdot\\frac{13}{7}=\\frac{49}{7}=7$.",
      ],
      answer: "$\\frac57$",
    },
    methodTitle: "Make one variable cancel",
    methodText: [
      "Look at the coefficients of the variable you want to remove. If they are $3$ and $-1$, multiplying the second equation by 3 makes them $3$ and $-3$, which cancel when added.",
      "After the sum, one equation in one variable remains. When the coefficient does not divide the right side evenly, the answer is a fraction. " +
        entry,
    ],
    formal:
      "If $ae-bd\\ne0$, multiplying $ax+by=c$ by $e$ and $dx+ey=f$ by $b$ and subtracting gives $(ae-bd)x=ce-bf$, so $x=\\frac{ce-bf}{ae-bd}$. In the same way $y=\\frac{af-cd}{ae-bd}$. A fractional value occurs when $ae-bd$ does not divide the numerator.",
    pitfalls: [
      "Multiply the right-hand constant by the same number as the rest of the equation.",
      "Watch signs when subtracting: subtracting $-3y$ adds $3y$.",
    ],
    parentGuide:
      "Ask your learner which variable they are removing first and why the two coefficients must be opposites.",
  },
  {
    id: "sat-entry-system-expression",
    title: "Enter the value of an expression from a system",
    summary:
      "The question may ask for $4x+6y$, not $x$ and $y$. Add, subtract or scale the equations so the left side becomes that expression.",
    objectives: [
      "Find a combination of two equations whose left side is a requested expression.",
      "Apply the same combination to the right sides, including a half or negative multiple.",
    ],
    intuition:
      "An equation stays true when you add the same quantity to both sides, and a pair of true equations can be added side by side. If the sum of the left sides is exactly the expression asked for, the sum of the right sides is its value, and you never need $x$ or $y$ separately.",
    terms: [
      ["expression", "A combination of numbers and variables such as $4x+6y$."],
      [
        "linear combination",
        "A multiple of one equation added to a multiple of another.",
      ],
    ],
    method: [
      "Compare the coefficients of $x$ and $y$ in the requested expression with those in the equations.",
      "Find multipliers (often 1, $-1$, or $\\frac12$) so the left sides combine into the expression.",
      "Apply the same multipliers to the right sides and add. " + entry,
    ],
    watch:
      "If the sum of the left sides is twice the expression, halve the right side too; the answer may be a fraction.",
    principle:
      "If $L_1=R_1$ and $L_2=R_2$, then $\\lambda L_1+\\mu L_2=\\lambda R_1+\\mu R_2$ for any numbers $\\lambda$ and $\\mu$. When the left side equals the target expression, the right side is its value.",
    example: {
      prompt: "If $3x+y=7$ and $x+5y=9$, what is the value of $4x+6y$?",
      steps: [
        "The coefficients $3+1=4$ of $x$ and $1+5=6$ of $y$ match $4x+6y$, so add the equations.",
        "Left sides: $(3x+y)+(x+5y)=4x+6y$.",
        "Right sides: $7+9=16$, so $4x+6y=16$.",
      ],
      answer: "$16$",
    },
    methodTitle: "Combine the equations directly",
    methodText: [
      "Write the coefficients of $x$ and $y$ of the target, then ask which multiples of the equations produce them. Adding gives the sum of the coefficients; subtracting gives their difference.",
      "If the combined left side is twice the target, divide the right side by 2. " +
        entry,
    ],
    formal:
      "Suppose the target is $px+qy$. Look for $\\lambda,\\mu$ with $\\lambda a+\\mu d=p$ and $\\lambda b+\\mu e=q$. Then the target equals $\\lambda c+\\mu f$. A solution exists whenever the system has a unique solution, but this method avoids computing it.",
    pitfalls: [
      "Apply the multiplier to both sides of an equation before combining.",
      "When subtracting, subtract the right sides in the same order as the left sides.",
    ],
    parentGuide:
      "Ask your learner why $4x+6y$ can be found without solving for $x$ and $y$.",
  },
  {
    id: "sat-entry-quadratic-solution",
    title: "Enter a quadratic solution",
    summary:
      "Factor the quadratic, set each factor to 0, then choose the solution described: the greater, the positive or the only one.",
    objectives: [
      "Solve a quadratic by factoring, including a leading coefficient other than 1 and a perfect square.",
      "Select and enter the requested solution as an integer or fraction.",
    ],
    intuition:
      "A quadratic equation has $x^2$ as its highest power. If two numbers multiply to 0, one of them is 0. So once the equation is $0=(\\text{factor})(\\text{factor})$, each factor can be set to 0 to find a solution.",
    terms: [
      ["solution", "A value of $x$ that makes the equation true."],
      [
        "perfect square",
        "An expression of the form $(mx+n)^2$; it equals 0 only when its base is 0.",
      ],
    ],
    method: [
      "Move every term to one side so the equation equals 0.",
      "Factor the quadratic into two binomials.",
      "Set each factor equal to 0, solve, and pick the solution the question asks for. " +
        entry,
    ],
    watch:
      "A repeated factor gives one solution, not two. Read the question: the greater solution of a negative pair is the one closer to 0.",
    principle:
      "Zero-product property: if $uv=0$ then $u=0$ or $v=0$. For $mx+n$ times $m'x+n'$ the solutions are $-\\frac nm$ and $-\\frac{n'}{m'}$.",
    example: {
      prompt: "What is the positive solution of $2x^2+5x-3=0$?",
      steps: [
        "Factor: $2x^2+5x-3=(2x-1)(x+3)$, because $2x\\cdot x=2x^2$, $(-1)(3)=-3$, and $2x\\cdot3+(-1)x=5x$.",
        "Set each factor to 0: $2x-1=0$ gives $x=\\frac12$; $x+3=0$ gives $x=-3$.",
        "The positive solution is $\\frac12$.",
      ],
      answer: "$\\frac12$",
    },
    methodTitle: "Factor, then read off the solution",
    methodText: [
      "For $x^2+bx+c$ look for two numbers with product $c$ and sum $b$. For a leading coefficient above 1, try pairs of binomials until the middle term matches.",
      "Then compare the two solutions with the wording: greater, positive, or only. " +
        entry,
    ],
    formal:
      "A quadratic $ax^2+bx+c$ with real solutions $r_1,r_2$ equals $a(x-r_1)(x-r_2)$. It has exactly one real solution when $b^2-4ac=0$, in which case it is $a(x-r)^2$ and $r=-\\frac{b}{2a}$.",
    pitfalls: [
      "Set the equation equal to 0 before factoring.",
      "Check the sign of each factor's solution: $x+3=0$ gives $-3$.",
    ],
    parentGuide:
      "Ask your learner to multiply the factors back together to check the middle term.",
  },
  {
    id: "sat-entry-root-relations",
    title: "Enter a sum or product of quadratic solutions",
    summary:
      "The sum and product of a quadratic's solutions come straight from its coefficients, so you can answer without solving.",
    objectives: [
      "Use $p+q=-\\frac ba$ and $pq=\\frac ca$ for the solutions of $ax^2+bx+c=0$.",
      "Rewrite $\\frac1p+\\frac1q$ or $p^2+q^2$ in terms of $p+q$ and $pq$.",
    ],
    intuition:
      "If $p$ and $q$ solve a quadratic with leading coefficient $a$, the quadratic equals $a(x-p)(x-q)$. Multiplying out shows that the coefficient of $x$ holds the sum $p+q$ and the constant holds the product $pq$, so you can read them without finding $p$ and $q$.",
    terms: [
      ["coefficient", "The number multiplying a power of $x$ in $ax^2+bx+c$."],
    ],
    method: [
      "Identify $a$, $b$ and $c$ in $ax^2+bx+c=0$.",
      "Compute $p+q=-\\frac ba$ and $pq=\\frac ca$.",
      "Rewrite the requested quantity using them: $\\frac1p+\\frac1q=\\frac{p+q}{pq}$ and $p^2+q^2=(p+q)^2-2pq$. " +
        entry,
    ],
    watch:
      "The sum is $-\\frac ba$ with a minus sign, and both formulas divide by $a$ when $a\\ne1$.",
    principle:
      "If $ax^2+bx+c=a(x-p)(x-q)$ then $b=-a(p+q)$ and $c=a(pq)$. These hold for any quadratic with solutions $p$ and $q$ (Vieta's formulas).",
    example: {
      prompt:
        "The equation $3x^2-8x+2=0$ has two distinct real solutions, $p$ and $q$. What is the value of $\\frac1p+\\frac1q$?",
      steps: [
        "Here $a=3$, $b=-8$ and $c=2$, so $p+q=\\frac83$ and $pq=\\frac23$.",
        "Combine: $\\frac1p+\\frac1q=\\frac{p+q}{pq}=\\frac{8/3}{2/3}=4$.",
      ],
      answer: "$4$",
    },
    methodTitle: "Read the sum and product from the coefficients",
    methodText: [
      "Expand $a(x-p)(x-q)=ax^2-a(p+q)x+a(pq)$ and match each coefficient with $ax^2+bx+c$.",
      "Then express the question in terms of $p+q$ and $pq$ before substituting. " +
        entry,
    ],
    formal:
      "For real $p\\ne q$ with $ax^2+bx+c=a(x-p)(x-q)$, equating coefficients gives $p+q=-\\frac ba$ and $pq=\\frac ca$. Quantities symmetric in $p$ and $q$ can be written using these two numbers.",
    pitfalls: [
      "Do not forget the minus sign in $-\\frac ba$.",
      "Divide by $a$, not only by the constant.",
    ],
    parentGuide:
      "Ask your learner to expand $(x-2)(x-5)$ and see where 7 and 10 appear.",
  },
  {
    id: "sat-entry-absolute-equation",
    title: "Enter an absolute-value solution",
    summary:
      "Split an absolute-value equation into two cases, solve each, and reject any value that makes the right side negative.",
    objectives: [
      "Split $|u|=v$ into $u=v$ and $u=-v$ and solve both.",
      "Reject an extraneous candidate and enter the remaining solution or a sum.",
    ],
    intuition:
      "The absolute value $|u|$ is the distance of $u$ from 0, so it is never negative. If $|u|=v$, then $u$ is either $v$ or $-v$. When $v$ itself contains $x$, a candidate may make $v$ negative; that candidate cannot be a solution.",
    terms: [
      ["absolute value", "The distance of a number from 0; $|-3|=3$."],
      [
        "extraneous solution",
        "A value that appears when solving but fails in the original equation.",
      ],
    ],
    method: [
      "Write the two cases: the inside equals $v$, and the inside equals $-v$.",
      "Solve each case.",
      "Substitute each candidate into the original equation; keep only those that work. " +
        entry,
    ],
    watch:
      "If the right side contains $x$, test it: a negative right side cannot equal an absolute value.",
    principle:
      "For a real number $v$, $|u|=v$ requires $v\\ge0$ and is equivalent to $u=v$ or $u=-v$. If $v<0$ there is no solution.",
    example: {
      prompt: "What is the solution of $|x-4|=2x+2$?",
      steps: [
        "Case 1: $x-4=2x+2$ gives $x=-6$. Case 2: $-(x-4)=2x+2$ gives $4-x=2x+2$, so $x=\\frac23$.",
        "Test $x=-6$: the right side is $2(-6)+2=-10$, which is negative, so reject it.",
        "Test $x=\\frac23$: $|\\frac23-4|=\\frac{10}{3}$ and $2\\cdot\\frac23+2=\\frac{10}{3}$. It works.",
      ],
      answer: "$\\frac23$",
    },
    methodTitle: "Two cases, then check",
    methodText: [
      "Squaring is not needed. The two cases cover both signs of the inside expression.",
      "Always finish by substituting. A sum of solutions counts only the values that pass. " +
        entry,
    ],
    formal:
      "For real $a\\ne0$, $|ax+b|=k$ with $k>0$ has the two solutions $\\frac{k-b}{a}$ and $\\frac{-k-b}{a}$, whose sum is $-\\frac{2b}{a}$. For $|u|=|w|$ the cases are $u=w$ and $u=-w$.",
    pitfalls: [
      "Negate the whole inside expression in the second case.",
      "Do not skip the substitution check when $x$ appears on the right.",
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
    terms: [
      [
        "extraneous solution",
        "A value created by squaring that does not satisfy the original equation.",
      ],
    ],
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
    terms: [
      ["excluded value", "A value of $x$ that makes a denominator equal 0."],
    ],
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
      ["zero", "A value of $x$ for which $f(x)=0$."],
      [
        "distinct zeros",
        "The different zeros, with a repeated factor counted once.",
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
    terms: [
      ["axis of symmetry", "The vertical line through the highest point."],
      ["vertex", "The highest or lowest point of the parabola."],
    ],
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
    title: "Enter a combined-rate or mixture value",
    summary:
      "Add rates (job per hour) rather than times, subtract a draining rate, or balance the amount of acid before and after mixing.",
    objectives: [
      "Combine, subtract or sequence constant rates exactly.",
      "Write a mixture balance and solve it for the unknown amount.",
    ],
    intuition:
      "A rate says how much happens in one unit of time. If one machine does $\\frac14$ of a job per hour and another does $\\frac16$, together they do $\\frac14+\\frac16$ of the job per hour. The time is 1 job divided by that rate.",
    terms: [
      ["rate", "Amount of work done per unit of time."],
      [
        "mixture",
        "A combination in which the amount of the dissolved substance is the amount of solution times its concentration.",
      ],
    ],
    method: [
      "Write each rate as a fraction of the job per time unit.",
      "Add rates that work together and subtract a rate that works against; for a mixture, set the substance before mixing equal to the substance after.",
      "Divide the total job by the rate, or solve the balance equation. " +
        entry,
    ],
    watch: "Add rates, not times. A drain subtracts its rate.",
    principle:
      "If work $W$ is done at rate $r$, time is $\\frac Wr$. Constant rates working together add. In a mixture, amount of substance = volume $\\times$ concentration, and it is conserved.",
    example: {
      prompt:
        "Working alone, one machine finishes a job in 4 hours and a second machine finishes the same job in 6 hours. Working together at these constant rates, how many hours do they need to finish the job?",
      steps: [
        "The rates are $\\frac14$ and $\\frac16$ of the job per hour.",
        "Combined rate: $\\frac14+\\frac16=\\frac{5}{12}$ of the job per hour.",
        "Time: $1\\div\\frac5{12}=\\frac{12}{5}=2.4$ hours.",
      ],
      answer: "$\\frac{12}{5}$",
    },
    methodTitle: "Work in rates",
    methodText: [
      "Convert each time to a rate before combining anything. The combined time is shorter than either machine alone.",
      "For a mixture, write one equation for the substance: old amount plus added amount equals the new total amount. " +
        entry,
    ],
    formal:
      "If two agents complete a job in $a$ and $b$ time units, together they need $\\frac{ab}{a+b}$. With a drain, the net time is $\\frac{ab}{b-a}$ when $b>a$.",
    pitfalls: [
      "Do not average the times.",
      "Convert percentages to decimals in a mixture equation.",
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
    terms: [["radian", "An angle unit where a half turn is $\\pi$ radians."]],
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
    title: "Enter an integer satisfying an inequality",
    summary:
      "Solve the inequality for $x$, then decide which integers are inside it, paying attention to strict signs and negative coefficients.",
    objectives: [
      "Solve a linear inequality and reverse its direction when dividing by a negative.",
      "Find the greatest or least integer solution, or count the positive integer solutions.",
    ],
    intuition:
      "An inequality such as $x<4$ describes a whole range of numbers. The integers are the whole numbers in that range. If the sign is strict (<), the boundary is not included.",
    terms: [
      [
        "strict inequality",
        "An inequality using < or >; the boundary is excluded.",
      ],
      ["integer", "A whole number, positive, negative or zero."],
    ],
    method: [
      "Solve the inequality for $x$; reverse the sign when dividing by a negative number.",
      "Mark the boundary: included for $\\le$ and $\\ge$, excluded for $<$ and $>$.",
      "Pick the greatest or least integer in the range, or count them. " +
        entry,
    ],
    watch:
      "If the boundary is an integer and the sign is strict, step one integer inside.",
    principle:
      "Adding a number to both sides keeps an inequality's direction; multiplying or dividing both sides by a negative number reverses it.",
    example: {
      prompt: "What is the greatest integer $x$ that satisfies $4x-5<11$?",
      steps: [
        "Add 5: $4x<16$. Divide by 4: $x<4$.",
        "The boundary 4 is not allowed because the inequality is strict.",
        "The greatest integer less than 4 is 3.",
      ],
      answer: "$3$",
    },
    methodTitle: "Boundary, then integers",
    methodText: [
      "After solving, picture the boundary on a number line and shade the side of the solutions.",
      "A count of positive integers starts at 1; if the boundary is below 1, the count is 0. " +
        entry,
    ],
    formal:
      "For real boundary $b$: the greatest integer with $x\\le b$ is $\\lfloor b\\rfloor$; with $x<b$ it is $\\lceil b\\rceil-1$. The least integer with $x>b$ is $\\lfloor b\\rfloor+1$.",
    pitfalls: [
      "Reverse the inequality when dividing by a negative number.",
      "Round toward the inside of the solution range, not to the nearest integer.",
    ],
    parentGuide:
      "Ask your learner whether 4 itself satisfies $x<4$ and why not.",
  },
];

const stripFormat = (e: Entry): ProblemMethod => ({
  goal: e.summary,
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
