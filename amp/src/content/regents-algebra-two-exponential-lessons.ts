import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsAlgebraTwoExponentialMethods: Record<
  string,
  ProblemMethod
> = {
  "geometric-series-total": {
    goal: "Add the first $n$ terms of a geometric sequence with a fractional ratio, or a run of payments that each grow by a percent.",
    intuition:
      "In a geometric sequence each term is the previous one times a fixed ratio. Adding $n$ terms one by one is slow, so a formula does it at once. A payment that grows by 8% each year is a term whose ratio is 1.08.",
    terms: ["common-ratio", "geometric-series"],
    method: [
      "Find $a_1$ and $r$. A percent increase of $p\\%$ gives $r=1+\\frac{p}{100}$.",
      "Use $S_n=\\dfrac{a_1(1-r^n)}{1-r}$, which works for any $r\\ne1$.",
      "Count terms carefully, then round only at the end.",
    ],
    watch:
      "The exponent is the number of terms, $n$. Keep the denominator $1-r$, and round only the final answer.",
  },
  "common-base-exponential": {
    goal: "Write both sides of an exponential equation as powers of one base, set the exponents equal and solve.",
    intuition:
      "Different numbers such as 27 and 9 can be powers of the same base: $27=3^3$ and $9=3^2$. When both sides are powers of 3, they are equal exactly when their exponents are equal.",
    terms: ["base-exponent", "exponent"],
    method: [
      "Rewrite each side with the same base.",
      "Use a power of a power: $(b^m)^k=b^{mk}$, so multiply the exponent of the base by the whole exponent expression.",
      "Set the exponents equal and solve the linear equation. Check by substituting.",
    ],
    watch:
      "Setting the exponents equal before the bases match gives a wrong equation. Multiply by the power of the base first.",
  },
  "exponential-parameter-log": {
    goal: "Isolate the exponential, take a base-10 logarithm and read $x$, with letters or numbers as parameters.",
    intuition:
      "A logarithm undoes a power: $\\log 10^k=k$. First get $10^{(\\text{exponent})}$ alone by dividing out any multiplier, then take the log.",
    terms: ["logarithm", "parameter"],
    method: [
      "Divide both sides by any factor that multiplies $10^{(\\cdot)}$.",
      "Take $\\log$ of both sides so the exponent comes down.",
      "Divide by any coefficient of $x$ in the exponent.",
    ],
    watch:
      "A factor outside the power is divided out before the log; a factor inside the exponent is divided out after it.",
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
      "Add the first terms of a geometric sequence with a fractional ratio or yearly percent growth.",
    templateIds: ["geometric-series-total"],
    objectives: [
      "Identify $a_1$, $r$ and $n$ from a sequence or from percent growth.",
      "Apply $S_n=\\frac{a_1(1-r^n)}{1-r}$ and round the total only at the end.",
    ],
    openingTitle: "A fixed ratio makes the sum short",
    opening: [
      "In a geometric sequence every term is the previous term times a fixed ratio $r$. The sum of the first $n$ terms is a geometric series.",
      "Payments that each rise by 8% over the last are such a sequence with $r=1.08$. A ratio below 1 such as $\\frac34$ makes the terms shrink.",
    ],
    example: {
      prompt:
        "A geometric sequence has $a_1=4$ and $r=\\frac12$. What is the sum of the first 3 terms?",
      steps: [
        "The terms are $4,2,1$.",
        "Formula: $\\frac{4(1-(1/2)^3)}{1-1/2}=\\frac{4\\cdot\\frac78}{\\frac12}=7$.",
        "Both ways give $7$.",
      ],
      answer: "$7$",
    },
    methodTitle: "Identify, substitute, round last",
    method: [
      "Name $a_1$, $r$ and $n$. For a percent increase of $p\\%$, $r=1+p/100$.",
      "Substitute into $S_n$, compute $r^n$ exactly or with a calculator, and round last.",
    ],
    formalTitle: "Why the formula works",
    formal: [
      "Let $S=a_1+a_1r+\\cdots+a_1r^{n-1}$. Then $rS-S=a_1r^n-a_1$, so $S(r-1)=a_1(r^n-1)$.",
      "Dividing by $r-1$ gives $S_n=\\frac{a_1(1-r^n)}{1-r}$ when $r\\ne1$.",
    ],
    pitfalls: [
      "Use $n$ terms: the exponent is $n$, not $n-1$.",
      "The infinite-sum formula $\\frac{a_1}{1-r}$ does not apply to a fixed number of terms.",
      "Rounding $r^n$ early can change the final dollar.",
    ],
    parentGuide:
      "Ask your learner to list the first three terms before using the formula, to see what the ratio does.",
  }),
  chainLesson({
    id: "regents-common-base-exponential",
    title: "Exponential equations with a common base",
    summary:
      "Rewrite 9, 27, 4 or 8 as powers of one base to equate the exponents.",
    templateIds: ["common-base-exponential"],
    objectives: [
      "Write both sides of an equation as powers of the same base.",
      "Equate the exponents after distributing the power, and solve the linear equation.",
    ],
    openingTitle: "Same base, same exponent",
    opening: [
      "A power such as $27^{x}$ can be written $(3^3)^x=3^{3x}$. When both sides are written with base 3, the equation holds exactly when the exponents are equal.",
      "Writing powers in one base turns an exponential equation into a linear one.",
    ],
    example: {
      prompt: "Solve $27^{x}=9^{x+3}$.",
      steps: [
        "$27=3^3$ and $9=3^2$, so $3^{3x}=3^{2(x+3)}$.",
        "Equal bases: $3x=2x+6$.",
        "$x=6$. Check: $3\\cdot6=18$ and $2\\cdot9=18$.",
      ],
      answer: "$x=6$",
    },
    methodTitle: "Base, distribute, solve",
    method: [
      "Find the base that makes both numbers powers of it.",
      "Multiply each exponent expression by the power of the base.",
      "Set the exponents equal and solve.",
    ],
    formalTitle: "The rule",
    formal: [
      "For $b>0$, $b\\ne1$: $b^u=b^v\\iff u=v$, because $b^x$ is one-to-one.",
      "The rule needs a single common base on both sides.",
    ],
    pitfalls: [
      "Do not equate exponents while the bases differ.",
      "Multiply the whole exponent by the power: $2(x+3)$, not $2x+3$.",
    ],
    parentGuide:
      "Have your learner substitute the answer back and write both exponents to see that they match.",
  }),
  chainLesson({
    id: "regents-exponential-parameter-log",
    title: "Base-10 equations with parameters",
    summary: "Solve $a\\cdot10^x=b$ and $10^{ax}=b$ with logarithms.",
    templateIds: ["exponential-parameter-log"],
    objectives: [
      "Isolate the power of 10 before taking a logarithm.",
      "Tell a multiplier of the power apart from a multiplier of the exponent.",
    ],
    openingTitle: "Log undoes the power of ten",
    opening: [
      "The base-10 logarithm of $10^k$ is $k$. To solve for an exponent, get the power alone and take the log of both sides.",
      "A factor outside the power, as in $a\\cdot10^x$, is divided out first. A factor inside the exponent, as in $10^{ax}$, is divided out after the log.",
    ],
    example: {
      prompt: "Solve $3\\cdot10^{x}=45$ for $x$.",
      steps: ["Divide by 3: $10^x=15$.", "Take the log: $x=\\log 15$."],
      answer: "$x=\\log 15$",
    },
    methodTitle: "Isolate, log, divide",
    method: [
      "Divide both sides by the multiplier of the power.",
      "Take $\\log$.",
      "Divide by any coefficient on $x$ in the exponent.",
    ],
    formalTitle: "Conditions",
    formal: [
      "$\\log$ is defined for positive numbers, so the right side after dividing must be positive.",
      "$\\log(10^u)=u$ for every real $u$.",
    ],
    pitfalls: [
      "$\\log\\frac{d}{c}$ is not $\\log d-c$.",
      "A coefficient in the exponent divides the whole log, not just one part.",
    ],
    parentGuide:
      "Ask which numbers sit outside the power and which sit in the exponent.",
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
