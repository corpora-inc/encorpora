import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsAlgebraTwoExponentialMethods: Record<
  string,
  ProblemMethod
> = {
  "geometric-series-total": {
    goal: "Add the first $n$ terms of a geometric sequence with a fractional ratio, or a run of payments that each grow by a percent.",
    senses: { term: "term-sequence" },
    noLink: ["period"],
    intuition:
      "A geometric sequence is a list where each term is the one before it times a fixed number, the common ratio $r$. The sum of its first $n$ terms is called a geometric series. $a_1$, read “$a$ sub 1”, is the first term. A payment that grows by 8% each year is 1.08 times the one before, so its ratio is 1.08.",
    terms: ["common-ratio", "geometric-series"],
    method: [
      "Find $a_1$ and $r$. Get $r$ by dividing a term by the one before it, or turn an increase of $p\\%$ into $r = 1 + \\tfrac{p}{100}$.",
      "If $r$ is not 1, use $S_n = \\tfrac{a_1(1 - r^n)}{1 - r}$, where $n$ is the number of terms.",
      "Count the terms carefully, and round only the final answer.",
    ],
    watch:
      "The exponent is the number of terms, $n$. Keep the bottom as $1 - r$, and round only the final answer.",
  },
  "common-base-exponential": {
    goal: "Write both sides of an exponential equation as powers of one base, set the exponents equal and solve.",
    senses: {
      side: "side-of-equation",
      base: "base-exponent",
      term: "term-expression",
    },
    noLink: ["whole"],
    intuition:
      "An exponent is the small raised number in a power: $3^2 = 3 \\times 3 = 9$. Different numbers such as 27 and 9 can be powers of the same base: $27 = 3^3$ and $9 = 3^2$. Two powers of the same positive base, other than 1, are equal exactly when their exponents are equal. A negative exponent means one divided by the power: $3^{-2} = \\tfrac{1}{9}$.",
    terms: ["base-exponent", "exponent"],
    method: [
      "Rewrite each side as a power of the same base.",
      "Use a power of a power, $(b^m)^k = b^{mk}$: multiply the base's exponent by the whole exponent expression.",
      "Set the exponents equal and solve. Check by putting the answer back in.",
    ],
    watch:
      "Setting the exponents equal before the bases match gives a wrong equation. Rewrite the bases first, and multiply by the base's exponent.",
  },
  "exponential-parameter-log": {
    goal: "Get the power of 10 alone, take a base-10 logarithm and find $x$. Letters may stand for fixed numbers.",
    senses: {
      factor: "factor-number",
      side: "side-of-equation",
      base: "base-exponent",
      parameter: "parameter",
    },
    intuition:
      "The base-10 logarithm undoes a power of 10: $\\log 10^k = k$. In $3 \\cdot 10^x = 45$, where the dot means times, first get $10^x$ alone by dividing by 3. Then take the logarithm. A letter that stands for a fixed number, like $a$ in $a \\cdot 10^x = b$, is called a parameter.",
    terms: [
      [
        "logarithm",
        "The base is positive and not 1, and the number inside is positive. $\\log$ with no base means base 10.",
      ],
      "parameter",
    ],
    method: [
      "Divide both sides by the number or parameter that multiplies the power of 10. In these problems it is positive, never 0.",
      "Take $\\log$ of both sides, so the exponent comes down.",
      "If a number multiplies $x$ inside the exponent, divide both sides by it last. It is never 0 here.",
    ],
    watch:
      "A number outside the power is divided away before the logarithm. A number inside the exponent is divided away after it.",
  },
  "exponential-target-time": {
    goal: "Solve an exponential model for the time it reaches a target and round as the question asks.",
    intuition:
      "An exponential model gives the amount at time $t$. To find when it reaches a target, set the model equal to the target, isolate the exponential part and use a logarithm to bring $t$ down.",
    terms: ["growth-factor", "natural-logarithm"],
    method: [
      "Set the rule equal to the target and divide by the starting amount.",
      "Take $\\ln$ (or $\\log$) of both sides.",
      "Solve for $t$ with a calculator and round only at the end.",
    ],
    watch:
      "Divide by the starting amount before you take the logarithm. Do not round the logarithms before dividing.",
  },
  "growth-model-rewrite": {
    goal: "Rewrite an annual factor as a monthly factor, or build a decay model from a half-life.",
    intuition:
      "If a value is multiplied by 1.06 each year, twelve equal monthly steps must multiply to 1.06 together, so each month multiplies by the 12th root. A half-life is the time to lose half, so the exponent counts half-lives.",
    terms: [
      "half-life",
      ["growth-factor", "Here the time period is one month."],
    ],
    method: [
      "For monthly forms, take the 12th root of the annual factor and use $12t$ months.",
      "For half-life $h$, the number of half-lives after time $t$ is $\\frac{t}{h}$; the model is $A_0\\left(\\frac12\\right)^{t/h}$.",
      "Test a choice by substituting one full year (or one half-life) and comparing.",
    ],
    watch:
      "Dividing a rate by 12 is not the same as taking a 12th root of a factor.",
  },
  "depreciation-recursion": {
    goal: "Turn a percent lost each year into a ratio and write the recursive rule with its starting value.",
    intuition:
      "Losing 15% of a value leaves 85% of it. Each year's value is 0.85 times the year before, so the values form a geometric sequence.",
    terms: ["recursive-rule", "common-ratio"],
    method: [
      "Subtract the percent lost from 100% and write the result as a decimal.",
      "Write the first value, then multiply the previous term by that ratio.",
    ],
    watch:
      "Multiplying by the percent lost keeps only that small part. Subtracting a fixed amount describes a linear change.",
  },
  "nonlinear-recursion-term": {
    goal: "Apply a recursive rule that squares the previous term, one step at a time.",
    intuition:
      "A recursive rule tells you how to get the next term from the one before. You cannot skip ahead: each term needs the one before it.",
    terms: [
      "recursive-rule",
      ["term-sequence", "Here, $a_n$ names the term in position $n$."],
    ],
    method: [
      "Write the rule with the known previous term in place of $a_{n-1}$.",
      "Square first, then multiply, add or subtract, and keep negatives in parentheses.",
      "Repeat until you reach the requested position.",
    ],
    watch: "Square the whole previous term including its sign: $(-3)^2=9$.",
  },
};

export const regentsAlgebraTwoExponentialPrinciples: Record<string, string> = {
  "geometric-series-total":
    "For a geometric sequence with first term $a_1$ and ratio $r\\ne1$, the sum of the first $n$ terms is $S_n=\\dfrac{a_1(1-r^n)}{1-r}$. A $p\\%$ increase each period gives $r=1+\\frac{p}{100}$.",
  "common-base-exponential":
    "For $b>0$ and $b\\ne1$, $b^u=b^v$ exactly when $u=v$. Also $(b^m)^k=b^{mk}$, which lets a power of a power be written in the base $b$.",
  "exponential-parameter-log":
    "For $y>0$, $10^u=y$ exactly when $u=\\log y$. If $c\\cdot10^{u}=d$ with $c,d>0$, then $u=\\log\\frac{d}{c}$.",
  "exponential-target-time":
    "If $A\\,b^t=T$ with $A,T>0$, $b>0$ and $b\\ne1$, then $t=\\dfrac{\\ln(T/A)}{\\ln b}$. For $A\\,e^{rt}=T$, $t=\\dfrac{\\ln(T/A)}{r}$.",
  "growth-model-rewrite":
    "$V_0b^{t}=V_0\\left(b^{1/12}\\right)^{12t}$ for $b>0$. A quantity with half-life $h$ is $A_0\\left(\\frac12\\right)^{t/h}$.",
  "depreciation-recursion":
    "A loss of $p\\%$ per period multiplies by $r=1-\\frac{p}{100}$, so $a_n=r\\,a_{n-1}$ with $a_1$ the starting value; the explicit form is $a_n=a_1r^{n-1}$.",
  "nonlinear-recursion-term":
    "A recursively defined sequence is determined by its first term and a rule for $a_n$ in terms of $a_{n-1}$; each term is computed in order.",
};

export const regentsAlgebraTwoExponentialLessons = [
  chainLesson({
    id: "regents-geometric-series-total",
    title: "Totals of geometric series",
    summary:
      "A geometric sequence is a list where each term, each number in the list, is the one before it times the same number, called the common ratio. For 4, 2, 1, the ratio is $\\tfrac{1}{2}$: each term is half the one before. Adding the first few terms gives a geometric series. A formula adds them all at once, and it also handles payments that grow by the same percent each year.",
    senses: {
      term: "term-sequence",
      side: "side-of-equation",
      change: "change",
    },
    noLink: ["whole", "period", "mean"],
    templateIds: ["geometric-series-total"],
    objectives: [
      "Find the first term $a_1$ (read “$a$ sub 1”), the ratio $r$ and the number of terms $n$, from a list or from a yearly percent increase.",
      "Use the sum formula, and round the total only at the very end.",
    ],
    openingTitle: "A fixed ratio makes the sum short",
    opening: [
      "In a geometric sequence, every term is the term before it times a fixed number $r$, the common ratio. The first term is written $a_1$: the small 1 is a label for position 1. The sum of the first $n$ terms is called a geometric series, written $S_n$.",
      "A ratio below 1, like $\\tfrac{3}{4}$, makes the terms shrink. A ratio above 1 makes them grow. Percent (%) means out of 100. A payment that rises 8% each year keeps the whole amount and adds 0.08 of it, so each payment is 1.08 times the last: $r = 1.08$.",
      "The sum formula is $S_n = \\tfrac{a_1(1 - r^n)}{1 - r}$, for any ratio $r$ that is not 1. Here $r^n$ means $r$ multiplied by itself $n$ times. That exponent, the small raised $n$, is the number of terms.",
    ],
    example: {
      prompt:
        "A geometric sequence has $a_1=4$ and $r=\\frac12$. What is the sum of the first 3 terms?",
      steps: [
        "List the terms to see the pattern. Start at 4 and halve each time: 4, 2, 1. Adding them gives $4 + 2 + 1 = 7$.",
        "Now use the formula with $a_1 = 4$, $r = \\tfrac{1}{2}$ and $n = 3$. First, $r^3 = \\tfrac{1}{2} \\times \\tfrac{1}{2} \\times \\tfrac{1}{2} = \\tfrac{1}{8}$, so $1 - r^3 = \\tfrac{7}{8}$. Also $1 - r = \\tfrac{1}{2}$.",
        "So $S_3 = \\tfrac{4 \\times \\tfrac{7}{8}}{\\tfrac{1}{2}} = \\tfrac{7}{2} \\div \\tfrac{1}{2} = 7$. Dividing by $\\tfrac{1}{2}$ is the same as multiplying by 2.",
        "Both ways give 7. For three terms, listing is quick. For 20 terms, the formula saves the work.",
      ],
      answer: "$7$",
    },
    methodTitle: "Identify, substitute, round last",
    method: [
      "Name $a_1$, $r$ and $n$. For an increase of $p\\%$ each period, $r = 1 + \\tfrac{p}{100}$, so 8% gives $r = 1.08$.",
      "Put them into $S_n = \\tfrac{a_1(1 - r^n)}{1 - r}$. Work out $r^n$ exactly, or with a calculator. Round only the final total, because rounding early can change the last digit.",
    ],
    formalTitle: "Why the formula works",
    formal: [
      "Let $S = a_1 + a_1 r + \\cdots + a_1 r^{n-1}$, where the dots mean the pattern continues. Multiply every term by $r$: $rS = a_1 r + a_1 r^2 + \\cdots + a_1 r^n$. Subtract $S$ from $rS$. Every shared term cancels, so $rS - S = a_1 r^n - a_1$.",
      "Take out the common factors: $S(r - 1) = a_1(r^n - 1)$. When $r \\neq 1$ ($\\neq$ means is not equal to), divide both sides by $r - 1$. That gives $S_n = \\tfrac{a_1(r^n - 1)}{r - 1}$, which equals $\\tfrac{a_1(1 - r^n)}{1 - r}$.",
    ],
    pitfalls: [
      "Use $n$, the number of terms, as the exponent in the formula, not $n - 1$.",
      "The formula $\\tfrac{a_1}{1 - r}$ is for an endless list whose ratio is between $-1$ and 1. It does not give the sum of a fixed number of terms.",
      "Rounding $r^n$ early can change the final dollar amount.",
    ],
    parentGuide:
      "Ask your learner to list the first three terms before using the formula, and to say what the ratio does to each term. Then check that the formula gives the same total.",
  }),
  chainLesson({
    id: "regents-common-base-exponential",
    title: "Exponential equations with a common base",
    summary:
      "In $27^x$, the 27 is the base and $x$ is the exponent: the small raised number that says how many 27s are multiplied together. Different numbers can be powers of the same base: $27 = 3^3$ and $9 = 3^2$. When both sides of an equation are powers of 3, they are equal exactly when their exponents are equal. That turns the equation into a simpler one with no exponents.",
    senses: { base: "base-exponent", side: "side-of-equation", rule: "rule" },
    noLink: ["whole"],
    templateIds: ["common-base-exponential"],
    objectives: [
      "Write both sides of an equation as powers of the same base.",
      "Multiply out the exponents, set them equal, and solve the equation that results.",
    ],
    openingTitle: "Same base, same exponent",
    opening: [
      "A power is a base with an exponent, like $3^3 = 3 \\times 3 \\times 3 = 27$. A power of a power multiplies the exponents: $(3^3)^x = 3^{3x}$, because $x$ copies of three 3s make $3x$ threes. So $27^x = 3^{3x}$.",
      "Two powers of the same base are equal exactly when their exponents are equal, as long as the base is positive and not 1. So if $3^{3x} = 3^{2(x + 3)}$, then $3x = 2(x + 3)$. The exponential equation has become a linear one, with no exponents.",
      "Some powers have negative exponents. A negative exponent means one divided by the power: $3^{-2} = \\tfrac{1}{3^2} = \\tfrac{1}{9}$.",
    ],
    example: {
      prompt: "Solve $27^{x}=9^{x+3}$.",
      steps: [
        "Write both bases as powers of 3: $27 = 3^3$ and $9 = 3^2$. Then $27^x = (3^3)^x = 3^{3x}$, and $9^{x+3} = (3^2)^{x+3} = 3^{2(x+3)}$.",
        "The bases now match, so the exponents must be equal: $3x = 2(x + 3)$.",
        "Multiply out the bracket: $3x = 2x + 6$. Subtract $2x$ from both sides: $x = 6$.",
        "Check the exponents in base 3: $3 \\times 6 = 18$, and $2 \\times (6 + 3) = 18$. They match, so both sides equal $3^{18}$.",
      ],
      answer: "$x=6$",
    },
    methodTitle: "Base, multiply exponents, solve",
    method: [
      "Find a base that makes both numbers powers of it, such as 3 for 9 and 27, or 2 for 4 and 8.",
      "Multiply the whole exponent by the power of the base: $9^{x+3} = 3^{2(x+3)}$.",
      "Set the exponents equal and solve. Check by putting the answer back into both exponents.",
    ],
    formalTitle: "The rule",
    formal: [
      "For a base $b > 0$ with $b \\neq 1$ ($\\neq$ means is not equal to): $b^u = b^v$ exactly when $u = v$. This works because each output of $b^x$ comes from only one input.",
      "The rule needs a single common base on both sides. A power of a power follows $(b^m)^k = b^{mk}$.",
    ],
    pitfalls: [
      "Do not set the exponents equal while the bases are different.",
      "Multiply the whole exponent by the power: $2(x + 3)$, not $2x + 3$.",
    ],
    parentGuide:
      "After both sides are rewritten in base 3, have your learner put the answer into both new exponents and see that they match.",
  }),
  chainLesson({
    id: "regents-exponential-parameter-log",
    title: "Base-10 equations with parameters",
    summary:
      "In $10^x = 15$, the unknown $x$ is an exponent: the power of 10 that gives 15. The base-10 logarithm, written $\\log$, names that exponent, so $x = \\log 15$. To solve, get the power of 10 alone, then take the logarithm. Sometimes letters such as $a$ and $b$ stand for fixed numbers. Letters like these are called parameters.",
    senses: { parameter: "parameter", side: "side-of-equation" },
    noLink: ["whole", "part"],
    templateIds: ["exponential-parameter-log"],
    objectives: [
      "Get the power of 10 alone before taking a logarithm.",
      "Tell a number that multiplies the whole power, as in $a \\cdot 10^x$, apart from a number that multiplies $x$ inside the exponent, as in $10^{ax}$.",
    ],
    openingTitle: "A logarithm undoes a power of ten",
    opening: [
      "The base-10 logarithm of $10^k$ is $k$: $\\log 10^3 = 3$, because $10^3 = 1000$. So taking $\\log$ of both sides brings an exponent down to an ordinary number.",
      "In $3 \\cdot 10^x = 45$, the dot means times, and 3 multiplies the whole power. Divide both sides by 3 first, to get $10^x = 15$. Then take the logarithm: $x = \\log 15$.",
      "In $10^{2x} = 15$, the 2 multiplies $x$ inside the exponent. Take the logarithm first: $2x = \\log 15$. Then divide both sides by 2: $x = \\tfrac{\\log 15}{2}$.",
      "A parameter is a letter that stands for a fixed number, like $a$ in $a \\cdot 10^x = b$. In these problems the parameters are positive, so dividing by them is allowed and the logarithm exists.",
    ],
    example: {
      prompt: "Solve $3\\cdot10^{x}=45$ for $x$.",
      steps: [
        "The 3 multiplies the whole power, so divide both sides by 3 first: $10^x = \\tfrac{45}{3} = 15$. Dividing both sides by the same number, other than 0, keeps them equal.",
        "Take the base-10 logarithm of both sides. Since $\\log 10^x = x$, this gives $x = \\log 15$, which is about 1.18.",
      ],
      answer: "$x=\\log 15$",
    },
    methodTitle: "Isolate, log, divide",
    method: [
      "Divide both sides by the number or parameter that multiplies the power of 10. In these problems it is never 0.",
      "Take $\\log$ of both sides, so the exponent comes down: $\\log 10^u = u$.",
      "If a number multiplies $x$ inside the exponent, divide both sides by it last. It is never 0 here either.",
    ],
    formalTitle: "Conditions",
    formal: [
      "$\\log$ is defined only for positive numbers, so the right side after dividing must be positive.",
      "$\\log(10^u) = u$ for every real number $u$. For $y > 0$, $10^u = y$ exactly when $u = \\log y$.",
    ],
    pitfalls: [
      "$\\log \\tfrac{d}{c}$ is not $\\log d - c$. It equals $\\log d - \\log c$.",
      "A number that multiplies $x$ in the exponent divides the whole logarithm, not just one part.",
    ],
    parentGuide:
      "Ask which numbers sit outside the power of 10 and which sit inside the exponent. Then ask which one is divided away before taking the logarithm, and which one after.",
  }),
  chainLesson({
    id: "regents-exponential-target-time",
    title: "When does an exponential model reach a target?",
    summary: "Solve $A\\,b^t=T$ or $A\\,e^{rt}=T$ for $t$ with logarithms.",
    templateIds: ["exponential-target-time"],
    objectives: [
      "Isolate the exponential factor by dividing by the starting amount.",
      "Use logarithms and a calculator to find $t$ to the requested place.",
    ],
    openingTitle: "Solve for the exponent",
    opening: [
      "A model like $N(t)=200\\cdot1.5^t$ gives the amount at time $t$. Asking when it reaches a target means solving for the exponent.",
      "A logarithm gives the exponent: if $1.5^t=4$, then $t=\\frac{\\ln4}{\\ln1.5}$.",
    ],
    example: {
      prompt:
        "When does $N(t)=200\\cdot1.5^t$ reach 800? Round to the nearest hundredth.",
      steps: [
        "$200\\cdot1.5^t=800$, so $1.5^t=4$.",
        "$t=\\frac{\\ln4}{\\ln1.5}\\approx3.42$.",
      ],
      answer: "$3.42$",
    },
    methodTitle: "Isolate, log, round last",
    method: [
      "Divide by the starting amount.",
      "Take $\\ln$ of both sides and divide.",
      "Round the final value only.",
    ],
    formalTitle: "The solution",
    formal: [
      "For $A,T>0$ and $b>0,\\ b\\ne1$, $Ab^t=T$ gives $t=\\frac{\\ln(T/A)}{\\ln b}$.",
      "With $e^{rt}$, $\\ln e^{rt}=rt$, so $t=\\frac{\\ln(T/A)}{r}$ for $r\\ne0$.",
    ],
    pitfalls: [
      "Divide by $A$ first. Taking $\\ln$ of the product is harder and error-prone.",
      "Do not round $\\ln$ values before dividing.",
    ],
    parentGuide:
      "Ask your learner to check by putting the answer back into the model.",
  }),
  chainLesson({
    id: "regents-growth-model-rewrite",
    title: "Monthly growth forms and half-lives",
    summary:
      "Rewrite an annual factor as a monthly factor and model decay from a half-life.",
    templateIds: ["growth-model-rewrite"],
    objectives: [
      "Write an annual growth or decay factor as a monthly factor with exponent $12t$.",
      "Model a half-life with the exponent $\\frac{t}{h}$.",
    ],
    openingTitle: "Match the time unit to the exponent",
    opening: [
      "A value multiplied by 1.06 every year can also be described month by month. Twelve equal monthly factors must multiply to 1.06, so the monthly factor is the 12th root, $1.06^{1/12}$.",
      "For a half-life of $h$ hours, the amount halves every $h$ hours, so after $t$ hours it has halved $\\frac th$ times.",
    ],
    example: {
      prompt: "Write $V(t)=50(1.06)^t$ with a monthly factor, $t$ in years.",
      steps: [
        "The monthly factor is $1.06^{1/12}$.",
        "In $t$ years there are $12t$ months.",
        "$V(t)=50\\left(1.06^{1/12}\\right)^{12t}$.",
      ],
      answer: "$50\\left(1.06^{1/12}\\right)^{12t}$",
    },
    methodTitle: "Factor, then count the periods",
    method: [
      "Take the right root of the factor for the smaller period.",
      "Count the smaller periods in the time given.",
      "Check by simplifying: the exponents multiply back to $t$.",
    ],
    formalTitle: "Equivalent forms",
    formal: [
      "$(b^{1/12})^{12t}=b^{t}$ for $b>0$, using the power of a power rule.",
      "Dividing a rate by 12 gives a different model (monthly compounding) unless stated.",
    ],
    pitfalls: [
      "Do not divide the factor by 12 or raise it to the 12th power.",
      "Count the number of half-lives, $t/h$, not $ht$.",
    ],
    parentGuide:
      "Ask your learner to test a choice with $t=1$ year: it should equal the annual factor.",
  }),
  chainLesson({
    id: "regents-depreciation-recursion",
    title: "Recursive rules for percent loss",
    summary:
      "Turn a yearly percent loss into a ratio and write the rule with its first value.",
    templateIds: ["depreciation-recursion"],
    objectives: [
      "Convert a percent lost or a percent remaining to a common ratio.",
      "Write a recursive rule that includes the starting value.",
    ],
    openingTitle: "Each year keeps a share of the last",
    opening: [
      "If a value loses 20% each year, it keeps 80%, so each year's value is 0.8 times the year before.",
      "A recursive rule states the first value and how to get each next value from the previous one.",
    ],
    example: {
      prompt:
        "A bike worth 500 dollars loses 20% of its value each year. Write the recursive rule.",
      steps: [
        "It keeps $100\\%-20\\%=80\\%$, a ratio of $0.8$.",
        "$a_1=500$ and $a_n=0.8\\,a_{n-1}$.",
      ],
      answer: "$a_1=500,\\ a_n=0.8\\,a_{n-1}$",
    },
    methodTitle: "Ratio, then rule",
    method: [
      "Find the ratio: 1 minus the rate lost.",
      "Write $a_1$ and the multiplication by the ratio.",
    ],
    formalTitle: "Geometric form",
    formal: [
      "A rule $a_n=r\\,a_{n-1}$ with $a_1$ given defines a geometric sequence, $a_n=a_1r^{n-1}$.",
      "A loss of $p\\%$ per period needs $0<r<1$.",
    ],
    pitfalls: [
      "Do not use the rate lost as the ratio.",
      "A fixed subtraction models a linear change, not a percent change.",
    ],
    parentGuide:
      "Ask your learner what fraction of the value is left after one year.",
  }),
  chainLesson({
    id: "regents-nonlinear-recursion-term",
    title: "Terms from a nonlinear recursive rule",
    summary:
      "Compute successive terms when the rule squares the previous term.",
    templateIds: ["nonlinear-recursion-term"],
    objectives: [
      "Substitute a previous term, including a negative one, into a rule that squares it.",
      "Carry the computation forward to a requested term.",
    ],
    openingTitle: "Each term needs the one before it",
    opening: [
      "A recursive rule gives each term from the previous one. When the rule squares the previous term, the terms can grow quickly.",
      "Work one term at a time and keep the sign of negative terms inside parentheses.",
    ],
    example: {
      prompt: "$a_1=-2$ and $a_n=a_{n-1}^2+1$. Find $a_3$.",
      steps: ["$a_2=(-2)^2+1=5$.", "$a_3=5^2+1=26$."],
      answer: "$26$",
    },
    methodTitle: "Substitute and repeat",
    method: [
      "Replace $a_{n-1}$ by the known term.",
      "Square before you add or subtract.",
      "Repeat.",
    ],
    formalTitle: "Definition",
    formal: [
      "A recursive sequence is defined by $a_1$ and a rule for $a_n$ from earlier terms.",
      "Terms are found in order; no shortcut is assumed.",
    ],
    pitfalls: [
      "$(-2)^2=4$, not $-4$.",
      "Square the previous term, not the position number.",
    ],
    parentGuide: "Ask your learner to write each term on its own line.",
  }),
];

const m = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({
  templateId,
  facetId,
  extent: "partial",
  rationale,
});
export const regentsAlgebraTwoExponentialFacetMappings: FacetMapping[] = [
  m(
    "geometric-series-total",
    "sequence-sums.finite-geometric",
    "Single choice for the sum of 4 to 6 terms with a fractional ratio, or the rounded total of 5 to 8 yearly payments growing by a percent. Does not assess sigma notation, solving for the number of terms, or infinite series.",
  ),
  m(
    "common-base-exponential",
    "exponential-equations.common-base",
    "Single choice for equations whose sides are different powers of 2, 3 or 5 with linear exponents and integer solutions. Does not assess non-integer solutions, logarithm solutions, or explaining the rewrite.",
  ),
  m(
    "exponential-parameter-log",
    "exponential-equations.log-solution",
    "Single choice for $a\\cdot10^x=b$ and $10^{ax}=b$ with symbolic or whole-number parameters. Does not assess other bases, natural logarithms, or numeric evaluation of the logarithm.",
  ),
  m(
    "exponential-target-time",
    "exponential-models.construct",
    "Numeric entry for the time to reach a target in $Ab^t$ or $Ae^{rt}$ models, rounded to the hundredth. Does not assess building the model, interpreting the result, or graphing.",
  ),
  m(
    "growth-model-rewrite",
    "exponential-models.HSF.IF.C.8",
    "Single choice for a monthly-factor rewrite of an annual growth or decay factor, and for a half-life decay model. Does not assess continuous compounding, effective rates, or solving for time.",
  ),
  m(
    "depreciation-recursion",
    "geometric-sequences.core",
    "Single choice for the recursive rule of a yearly percent loss, in loses and keeps wording. Does not assess explicit rules, growth rates above 100%, or writing a rule from a table.",
  ),
  m(
    "nonlinear-recursion-term",
    "arithmetic-sequences.core",
    "Numeric entry for the third or fourth term of a recursion that squares the previous term with a constant, the previous term or a doubled square. Does not assess recognizing sequence types, closed forms, or the rating-guide work.",
  ),
];
