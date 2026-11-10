import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

/**
 * Why a fraction exponent is a root (HSN.RN.A.1). The lessons teach the
 * argument itself: keeping the power of a power law forces
 * $(b^{1/n})^n=b$, so $b^{1/n}$ must be $\sqrt[n]{b}$.
 */

const senses = { root: "root-radical", roots: "root-radical" };
const noLink = [
  "power",
  "law",
  "laws",
  "index",
  "line",
  "lines",
  "square",
  "cube",
];

const lawBackground = {
  title: "The law that decides",
  paragraphs: [
    "For whole-number exponents, $(x^p)^q$ means $q$ copies of $x^p$ multiplied together. Each copy has $p$ factors of $x$, so there are $pq$ factors in all: $(x^p)^q=x^{pq}$. This is the power of a power law.",
    "A fraction exponent such as $\\frac{1}{3}$ cannot count factors. Mathematicians chose its meaning so that the law keeps working. The base $b$ is always positive here.",
  ],
};

const entries: WorkEntry[] = [
  {
    id: "rational-exponent-derivation",
    title: "Why a unit fraction exponent is a root",
    goal: "Complete the four-line argument that $b^{1/n}=\\sqrt[n]{b}$: give a line's reason, supply a missing line, or put the lines in order.",
    summary:
      "If the law $(x^p)^q=x^{pq}$ keeps working for the exponent $\\frac{1}{n}$, then $(b^{1/n})^n=b^{\\frac{1}{n}\\cdot n}=b$. So $b^{1/n}$ is the positive number whose $n$th power is $b$, which is $\\sqrt[n]{b}$.",
    senses,
    noLink,
    objectives: [
      "Name the law each line of the argument uses, and tell it apart from the product of powers law and from assuming the conclusion.",
      "Order the four lines, so that each line uses only facts stated above it.",
    ],
    background: [lawBackground],
    intuition:
      "An argument is a chain: each line must follow from lines above it. Here the chain has four lines. First, we want the laws of exponents to keep working. Next, the power of a power law gives $(b^{1/n})^n=b^{\\frac{1}{n}\\cdot n}$. Then $\\frac{1}{n}\\cdot n=1$, so $(b^{1/n})^n=b$. Last, the positive number whose $n$th power is $b$ is the $n$th root, $\\sqrt[n]{b}$.",
    terms: ["rational-exponent", "nth-root", "exponent"],
    method: [
      "Start from the wish: the laws for integer exponents should keep working for the exponent $\\frac{1}{n}$.",
      "Apply the power of a power law to $(b^{1/n})^n$: multiply the exponents to get $b^{\\frac{1}{n}\\cdot n}$.",
      "Simplify $\\frac{1}{n}\\cdot n=1$, so $(b^{1/n})^n=b$.",
      "Read off the meaning by the definition of the root: the positive number whose $n$th power is $b$ is $\\sqrt[n]{b}$.",
    ],
    watch:
      "A power of a power multiplies exponents; adding them is the law for a product such as $x^p\\cdot x^q$. Do not use $\\sqrt[n]{b}$ before the last line: that assumes the conclusion.",
    principle:
      "If $(x^p)^q=x^{pq}$ holds for $p=\\frac{1}{n}$ and $q=n$, then $(b^{1/n})^n=b$ for every positive $b$, so $b^{1/n}=\\sqrt[n]{b}$.",
    example: {
      prompt:
        "Here is an argument for what $6^{1/4}$ must mean. Line 1: We want the laws for integer exponents to keep working for the exponent $\\frac{1}{4}$. Line 2: $\\square$ Line 3: $\\frac{1}{4}\\cdot4=1$, so $(6^{1/4})^4=6$. Line 4: The positive number whose fourth power is $6$ is $\\sqrt[4]{6}$, so $6^{1/4}=\\sqrt[4]{6}$. Which statement fills the $\\square$ in line 2?",
      choices: [
        "$(6^{1/4})^4=6^{\\frac{1}{4}\\cdot4}$",
        "$(6^{1/4})^4=6^{\\frac{1}{4}+4}$",
        "$(6^{1/4})^4=\\frac{6^4}{4}$",
        "$(6^{1/4})^4=\\frac{1}{6^{4\\cdot4}}$",
      ],
      steps: [
        "Line 2 must follow from line 1 and lead to line 3.",
        "The power of a power law applies to $(6^{1/4})^4$: multiply the exponents, giving $6^{\\frac{1}{4}\\cdot4}$.",
        "Line 3 then simplifies that exponent: $\\frac{1}{4}\\cdot4=1$.",
        "Adding the exponents is the product of powers law, dividing by $4$ treats the exponent as a divisor, and a reciprocal comes from a negative exponent.",
      ],
      answer: "$(6^{1/4})^4=6^{\\frac{1}{4}\\cdot4}$",
    },
    methodTitle: "Check a line by what it uses",
    methodText: [
      "For each line, ask which earlier line or law it uses. A line that uses nothing stated above it is either the starting wish or out of place.",
      "Test a candidate line with numbers when you can: $(8^{1/3})^3$ must be $8$, so any line that makes it something else is wrong.",
    ],
    formal:
      "For integers, $(x^p)^q=x^{pq}$ counts factors. Extending it to $p=\\frac{1}{n}$ forces $(b^{1/n})^n=b$. For a positive base, the only positive number with that $n$th power is $\\sqrt[n]{b}$, so the definition $b^{1/n}=\\sqrt[n]{b}$ is the one choice that keeps the law.",
    pitfalls: [
      "Adding exponents in line 2, as if $(b^{1/n})^n$ were a product $b^{1/n}\\cdot b^n$.",
      "Reading $\\frac{1}{n}$ as divide by $n$: $\\frac{b}{n}$ raised to the power $n$ is not $b$.",
    ],
    parentGuide:
      "Ask your learner which law line 2 uses, and why the root may only appear in the last line.",
  },
  {
    id: "rational-exponent-definition-test",
    title: "Test a meaning of a fraction exponent against the law",
    goal: "Find the one meaning of $b^{1/n}$ that makes $(b^{1/n})^n=b$ true, or find the first false line in a student's argument.",
    summary:
      "The power of a power law demands $(b^{1/n})^n=b$. A proposed meaning passes only if raising it to the power $n$ gives back $b$; only $\\sqrt[n]{b}$ does. In a written argument, the first false line is the first one no law or computation justifies.",
    senses,
    noLink,
    objectives: [
      "Raise each proposed meaning of $b^{1/n}$ to the power $n$ and keep only the one that gives $b$.",
      "Check each line of an argument with a law or a computation, and name the first false line, or say that none is false.",
    ],
    background: [lawBackground],
    intuition:
      "A definition of $b^{1/n}$ must agree with the law, so the law is a test. Raise a proposal to the power $n$: if the result is not $b$, the proposal breaks the law. Dividing by $n$ fails, a reciprocal fails, and a coefficient fails. Only the $n$th root passes.",
    terms: ["rational-exponent", "nth-root", "exponent"],
    method: [
      "Write what the law demands: $(b^{1/n})^n=b^{\\frac{1}{n}\\cdot n}=b$.",
      "For a proposed meaning, raise it to the power $n$ and compare with $b$. For an argument, check each line in order by a law or by computing.",
      "Keep the proposal that gives $b$, or stop at the first line you cannot justify.",
    ],
    watch:
      "Check every line, not only the last one. A line that follows correctly from a false line is not the first false line; the first false line is the earliest one you cannot justify.",
    principle:
      "The law $(x^p)^q=x^{pq}$ forces $(b^{1/n})^n=b$. Of all positive numbers, only $\\sqrt[n]{b}$ satisfies it, so $b^{1/n}=\\sqrt[n]{b}$ and $b^{m/n}=(\\sqrt[n]{b})^m$.",
    example: {
      prompt:
        "A student writes this argument about $27^{2/3}$. Line 1: $27^{2/3}=(27^{1/3})^2$. Line 2: $27^{1/3}=\\frac{27}{3}$. Line 3: so $27^{2/3}=\\left(\\frac{27}{3}\\right)^2$. Which is the first line that is false?",
      choices: ["Line 1", "Line 2", "Line 3", "No line is false"],
      steps: [
        "Line 1 is true: $\\frac{2}{3}=\\frac{1}{3}\\cdot2$, and a power of a power multiplies the exponents.",
        "Line 2 is false: $27^{1/3}$ is the number whose cube is $27$, which is $3$. Dividing by $3$ gives $9$, and $9^3=729$, not $27$.",
        "Line 3 builds on the false line 2. In fact $27^{2/3}=3^2=9$.",
      ],
      answer: "Line 2",
    },
    methodTitle: "Use the law as a test",
    methodText: [
      "To test a meaning, raise it to the power $n$. With a perfect power such as $8$, compute: $(\\sqrt[3]{8})^3=2^3=8$.",
      "With a base such as $5$, argue instead: $\\left(\\frac{5}{3}\\right)^3=\\frac{125}{27}$, which is not $5$.",
    ],
    formal:
      "For positive $b$ and whole $n\\ge2$, the equation $y^n=b$ has exactly one positive solution, $\\sqrt[n]{b}$. Any definition of $b^{1/n}$ that keeps $(x^p)^q=x^{pq}$ must give a positive solution of $y^n=b$, so it must be $\\sqrt[n]{b}$.",
    pitfalls: [
      "Assuming a numeric line is right because the next line follows from it.",
      "Taking a square root for every fraction exponent: the denominator names which root.",
    ],
    parentGuide:
      "Ask your learner to raise one proposed meaning to the power $n$ out loud, and say whether it gives back the base.",
  },
  {
    id: "radical-exponent-notation-reason",
    title: "Why a root can be written as a fraction exponent",
    goal: "Choose the complete reason that $\\sqrt[n]{b}=b^{1/n}$ or $b^{m/n}=(\\sqrt[n]{b})^m$, or the equation that sets $b^{m/n}$ and its value.",
    summary:
      "$\\sqrt[n]{b}$ can be written $b^{1/n}$ because the power of a power law forces $(b^{1/n})^n=b$. Writing $\\frac{m}{n}=\\frac{1}{n}\\cdot m$, the same law gives $b^{m/n}=(b^{1/n})^m=(\\sqrt[n]{b})^m$.",
    senses,
    noLink,
    objectives: [
      "Tell a complete reason, built on the power of a power law, from a rule that is only restated or a reason with a false step.",
      "Find $b^{m/n}$ from $(b^{m/n})^n=b^m$, and check it as $(\\sqrt[n]{b})^m$.",
    ],
    background: [lawBackground],
    intuition:
      "A complete reason starts from the law and ends at the root. Saying the index goes in the denominator only restates the rule. For $b^{m/n}$, split the exponent: $\\frac{m}{n}=\\frac{1}{n}\\cdot m$. Then $b^{m/n}=(b^{1/n})^m$, the $n$th root of $b$ raised to the power $m$.",
    terms: ["rational-exponent", "nth-root", "exponent"],
    method: [
      "Find the law the reason must use: $(x^p)^q=x^{pq}$.",
      "For $b^{1/n}$, the law gives $(b^{1/n})^n=b$; for $b^{m/n}$, write $\\frac{m}{n}=\\frac{1}{n}\\cdot m$ to get $(b^{1/n})^m$, or raise to the power $n$ to get $(b^{m/n})^n=b^m$.",
      "Reject reasons that restate the rule, use the product law, divide by the index, or swap the roles of $m$ and $n$.",
    ],
    watch:
      "The denominator of the exponent names the root and the numerator names the power. Check a choice with numbers: $8^{2/3}=(\\sqrt[3]{8})^2=4$.",
    principle:
      "For positive $b$, $b^{1/n}=\\sqrt[n]{b}$ and $b^{m/n}=(b^{1/n})^m=(\\sqrt[n]{b})^m$, because $(x^p)^q=x^{pq}$.",
    example: {
      prompt:
        "To define $16^{3/4}$ so that the laws of exponents keep working, which equation must hold, and what value does it give?",
      choices: [
        "$(16^{3/4})^4=16^3$, so $16^{3/4}=8$",
        "$(16^{3/4})^4=16$, so $16^{3/4}=2$",
        "$16^{3/4}=16\\cdot\\frac{3}{4}$, so $16^{3/4}=12$",
        "$(16^{3/4})^4=16^{3\\cdot4}$, so $16^{3/4}=16^3$",
      ],
      steps: [
        "The power of a power law requires $(16^{3/4})^4=16^{\\frac{3}{4}\\cdot4}=16^3$.",
        "Since $16=2^4$, $16^3=(2^3)^4$, so $16^{3/4}=2^3=8$.",
        "Check: $(\\sqrt[4]{16})^3=2^3=8$.",
      ],
      answer: "8",
    },
    methodTitle: "Split the exponent",
    methodText: [
      "Write $\\frac{m}{n}$ as $\\frac{1}{n}\\cdot m$. The law turns $b^{\\frac{1}{n}\\cdot m}$ into $(b^{1/n})^m$: take the root, then the power.",
      "With a perfect power, compute the root first: $27^{2/3}=(\\sqrt[3]{27})^2=3^2=9$.",
    ],
    formal:
      "For positive $b$, $(b^{1/n})^m$ and $(b^m)^{1/n}$ are both positive numbers whose $n$th power is $b^m$, so they are equal: $b^{m/n}=(\\sqrt[n]{b})^m=\\sqrt[n]{b^m}$.",
    pitfalls: [
      "Reading $b^{m/n}$ as $\\frac{b^m}{b^n}$, a quotient of powers.",
      "Reading the numerator as a coefficient: $8^{2/3}$ is not $2\\sqrt[3]{8}$ in general.",
    ],
    parentGuide:
      "Ask your learner to split the exponent into a root and a power, and to check the value with a perfect power such as $8$.",
  },
];

const content = workContent(entries);
export const rationalExponentMeaningLessons = content.lessons;
export const rationalExponentMeaningMethods = content.methods;
export const rationalExponentMeaningPrinciples = content.principles;

export const rationalExponentMeaningFacetMappings: FacetMapping[] = [
  {
    templateId: "rational-exponent-derivation",
    facetId: "rational-exponents.HSN.RN.A.1",
    extent: "partial",
    rationale:
      "Choose the reason for a line, a missing line, or the order of the four-line argument that keeping the power of a power law forces b^(1/n) to be the nth root of b, for n from 2 to 5 with perfect and non-perfect bases. Does not assess writing the explanation in the learner's own words.",
  },
  {
    templateId: "rational-exponent-definition-test",
    facetId: "rational-exponents.HSN.RN.A.1",
    extent: "partial",
    rationale:
      "Test proposed meanings of b^(1/n) against (b^(1/n))^n = b, and find the first false line of a student's argument about b^(1/n) or b^(m/n), including arguments with no false line. Does not assess writing the explanation freely.",
  },
  {
    templateId: "radical-exponent-notation-reason",
    facetId: "rational-exponents.HSN.RN.A.1",
    extent: "partial",
    rationale:
      "Choose the correct and complete explanation of why the nth root of b equals b^(1/n) and why b^(m/n) equals (nth root of b)^m, and the equation that defines b^(m/n) with its value. Does not assess writing the explanation freely.",
  },
  {
    templateId: "radical-exponent-notation-reason",
    facetId: "rational-exponents.core",
    extent: "partial",
    rationale:
      "Use (b^(m/n))^n = b^m to find the value of a fraction power of a perfect power and check it as a root raised to a power. Does not assess rewriting expressions with variables or evaluating non-perfect powers.",
  },
];
