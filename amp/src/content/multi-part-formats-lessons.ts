import type { FacetMapping } from "./coverage";
import type { GlossarySenses } from "../glossary/types";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";

type Entry = FormatLessonEntry & {
  /** The practice-screen task, at most 140 characters; defaults to the summary. */
  goal?: string;
  senses?: GlossarySenses;
  noLink?: string[];
};

const entries: Entry[] = [
  {
    id: "table-rule-sentence",
    title: "Say the rule of a table",
    summary:
      "Compare each $x$ with its $y$ to find the one operation and number that work for every pair, then say it in a sentence.",
    objectives: [
      "Find the operation and the number that take each $x$ of a table to its $y$.",
      "Tell an additive rule (add or subtract the same number) from a multiplicative rule (multiply or divide by the same number).",
    ],
    intuition:
      "A table follows a rule when the same operation with the same number turns every $x$ into the $y$ beside it. Try an operation on the first pair, then test it on the other pairs: one pair can fit several rules by chance, but only the true rule fits all of them. An additive rule changes the outputs by the same amount each time $x$ goes up by the same amount; a multiplicative rule changes them by the same factor.",
    terms: ["additive-rule", "multiplicative-rule"],
    method: [
      "Look at the first pair and ask what was done to $x$ to get $y$. Try adding, subtracting, multiplying and dividing.",
      "Test the operation and number on a second and a last pair. Keep a rule only if it fits every pair.",
      "Choose the words for the operation and the number. 'Increased by' and 'decreased by' are additive; 'multiplied by' and 'divided by' are multiplicative.",
    ],
    watch:
      "The first $y$ and the gap between two $y$-values are not the number of the rule unless the table starts at 0 or 1; test the number on a pair.",
    principle:
      "A table follows the rule $y = x + n$, $y = x - n$, $y = nx$ or $y = \\frac{x}{n}$ when that equation holds for every pair. Several different rules can match one pair, but two different rules of this kind cannot match three pairs with different $x$-values, so a rule that fits all the pairs is the rule.",
    example: {
      prompt:
        "The table has $x$ = 3, 5, 7, 9 and $y$ = 27, 45, 63, 81. Which words complete 'Each $y$ is the $x$ above it ___ ___': 'increased by 24', 'multiplied by 9', 'multiplied by 27' or 'divided by 9'?",
      steps: [
        "From $x = 3$ to $y = 27$: $3 \\cdot 9 = 27$. Adding would need 24, and dividing 3 by 9 does not give 27.",
        "Test $5 \\cdot 9 = 45$ and $9 \\cdot 9 = 81$: the rule fits every pair.",
        "Multiplying by 9 is a multiplicative rule. The number 27 is only the first $y$, not the number of the rule.",
      ],
      answer: "Multiplied by 9.",
    },
    methodTitle: "Check the last pair",
    methodText: [
      "A rule that fits the first two pairs can still fail later, so test the last pair as well.",
      "To tell the kinds apart, compare within each pair: for an additive rule $y - x$ is the same number in every pair, and for a multiplicative rule $y \div x$ is the same.",
    ],
    formal:
      "If $y = nx$ for all pairs, then $\\frac{y}{x} = n$ is constant; if $y = x + n$, then $y - x = n$ is constant. A table with at least two pairs, distinct $x$-values and $n \\ne 1$ cannot satisfy both, so the constant quotient or difference identifies the kind of rule and its number.",
    pitfalls: [
      "Do not take the first $y$ for the number of the rule: in $y = 9x$ with $x = 3$, the first $y$ is 27.",
      "Do not mix kinds: dividing and multiplying are multiplicative, adding and subtracting are additive.",
    ],
    parentGuide:
      "Ask your learner to try 'what did I do to this number to get the one next to it?' on the first row, then on the last row.",
  },
  {
    id: "substitution-match-table",
    title: "Test each equation with a value",
    goal: "Put a stated value in for the variable in each equation, and mark each equation true or not true.",
    summary:
      "A variable is a letter that stands for a number. An equation has two sides: the parts to the left and right of its equals sign. To substitute means to put a number in place of the variable. Substitute the stated value into each equation and work out both sides. If they are equal, the equation is true for that value.",
    senses: {
      "left side": "side-of-equation",
      "right side": "side-of-equation",
      side: "side-of-equation",
      sides: "side-of-equation",
      product: "product-multiply",
    },
    noLink: ["mean", "changes", "parts"],
    objectives: [
      "Substitute a negative or positive value into an equation and evaluate the left side exactly.",
      "Mark the equation true when both sides have the same value and not true when they differ.",
    ],
    intuition:
      "A variable is a letter that stands for a number. An equation is a claim that its two sides, the parts left and right of the equals sign, have the same value. To substitute means to put a number in place of the variable. Substitute the stated value, work out each side, and compare. A value that makes the equation true is called a solution. A negative number is a number less than 0, and it needs care. A negative times a negative is positive, and subtracting a negative adds: $4 - (-5) = 9$.",
    terms: [
      [
        "substitute",
        "Keep parentheses around a negative number: $x = -2$ in $x^2$ gives $(-2)^2$.",
      ],
      "true-equation",
    ],
    method: [
      "Rewrite the left side with the value in place of the variable, putting a negative value in parentheses: for $3m + 4$ and $m = -5$, write $3 \\cdot (-5) + 4$.",
      "Work out the left side and the right side separately.",
      "Mark the equation true if the two numbers are equal, and not true otherwise. Repeat for every row.",
    ],
    watch:
      "Using 5 where the value is −5 can make a false equation look true. Keep the sign in the substitution.",
    principle:
      "For a value $a$, an equation is true at $a$ exactly when its two sides give the same number after substituting $a$. Each row is checked on its own: one true equation says nothing about the others.",
    example: {
      prompt: "Is $3m + 4 = -11$ true when $m = -5$, and is $m + 6 = 1$ true?",
      steps: [
        "For $3m + 4$: $3 \\cdot (-5) + 4 = -15 + 4 = -11$. The right side is −11, so the equation is true.",
        "For $m + 6$: $-5 + 6 = 1$. The right side is 1, so this equation is true too.",
        "With $m = 5$ instead, $3 \\cdot 5 + 4 = 19$ would not equal −11: the sign changes the answer.",
      ],
      answer: "Both equations are true.",
    },
    methodTitle: "Work each row alone",
    methodText: [
      "Write each substitution on its own line. A row that is true does not make its neighbors true or false.",
      "For a fraction of the variable, divide the value: $\\frac{m}{5}$ with $m = -10$ is −2.",
    ],
    formal:
      "Substitution is evaluation. The left side is an expression $L$ and the right side an expression $R$, and the equation holds at $a$ exactly when $L(a)$ and $R(a)$ are the same number. Here $L(a)$ means the value of $L$ when the variable is $a$. A solution of the equation is a value for which this holds.",
    pitfalls: [
      "Keep the sign of a negative value when you substitute it.",
      "Subtracting a negative number adds: $4 - (-5) = 9$.",
    ],
    parentGuide:
      "Ask your learner to say each side as a number before deciding, for example 'the left side is −11 and the right side is −11'.",
  },
];

const built = formatLessons(entries);
const glossaryFields = (e: Entry) => ({
  ...(e.senses ? { senses: e.senses } : {}),
  ...(e.noLink ? { noLink: e.noLink } : {}),
});
export const multiPartFormatsLessons = built.lessons.map((lesson, i) => ({
  ...lesson,
  ...glossaryFields(entries[i]!),
}));
export const multiPartFormatsMethods = Object.fromEntries(
  entries.map((e) => [
    e.id,
    {
      ...built.methods[e.id]!,
      ...(e.goal ? { goal: e.goal } : {}),
      ...glossaryFields(e),
    },
  ]),
);
export const multiPartFormatsPrinciples = built.principles;

export const multiPartFormatsFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "table-rule-sentence",
    facetId: "related-patterns.paired-terms",
    extent: "partial",
    rationale:
      "Complete a sentence about a table of four or five whole-number pairs by choosing the operation (increased, decreased, multiplied or divided by) and its number, or the kind (additive or multiplicative) and the number, among numbers that are the first output, a gap between outputs, the first input or one away. Does not assess writing the rule, tables with fractions or decimals, two-operation rules, or comparing two tables.",
  },
  {
    templateId: "substitution-match-table",
    facetId: "linear-equations.core",
    extent: "partial",
    rationale:
      "Mark four or five one- or two-step equations as true or not true for a stated integer value of the variable, positive or negative, with traps that use the opposite value or a sign slip. Does not assess solving the equations, equations with the variable on both sides, or value tables with many substitutions.",
  },
];
