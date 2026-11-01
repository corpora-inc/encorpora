import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const patternRuleMethods: Record<string, ProblemMethod> = {
  "pattern-rule-choice": {
    goal: "Find the rule of a number pattern from its terms, or find the pattern that follows the same rule.",
    intuition:
      "A number pattern follows a rule that turns each term into the next. The rule can add the same number each time, multiply by the same number each time, or add an amount that grows by one each time. To find it, look at how each term changes into the next.",
    terms: ["term-sequence", "rule"],
    method: [
      "Subtract each term from the next to find the changes. If the changes are all equal, the rule is to add that number.",
      "If the changes are not equal, check whether each term is the same multiple of the one before (divide), or whether the changes grow by one each time.",
      "Check the rule on every term. To find a pattern with the same rule, apply the rule to each choice's start.",
    ],
    watch:
      "Check the rule on all the terms, not just the first two. Two terms can fit more than one rule.",
  },
  "pattern-term-unknown-rule": {
    goal: "Find a later term of a pattern from its first terms when the rule is not stated, including patterns whose changes grow or shrink by one.",
    intuition:
      "When no rule is given, you find it from the terms. Subtract neighboring terms to see the changes. If the changes are all the same, add that change again and again. If the changes themselves grow or shrink by one each time, keep following that second pattern too.",
    terms: [
      [
        "difference-subtract",
        "Here, the change from one term of the pattern to the next.",
      ],
      [
        "pattern",
        "In a decreasing pattern, each term is smaller than the one before.",
      ],
    ],
    method: [
      "Write the changes between neighbors: second term minus first term, and so on.",
      "Decide whether the changes stay the same or change by the same amount each time.",
      "Continue the changes and add each one to the last term until you reach the term you need.",
    ],
    watch:
      "When the changes are not equal, do not keep adding the last change again. Follow how the changes themselves change.",
  },
};

export const patternRulePrinciples: Record<string, string> = {
  "pattern-rule-choice":
    "A rule that adds $d$ each time gives $a, a+d, a+2d, \\ldots$; a rule that multiplies by $m$ gives $a, am, am^2, \\ldots$; a rule that adds $d, d+1, d+2, \\ldots$ gives changes that themselves increase by 1. Two patterns follow the same rule when they change in the same way, whatever their first terms.",
  "pattern-term-unknown-rule":
    "If the changes between neighbors are all equal, the pattern adds a constant. If the changes change by the same amount each time, the changes form a pattern of their own and each term is the previous term plus the next change.",
};

export const patternRuleLessons = [
  chainLesson({
    id: "pattern-rule-choice-lesson",
    title: "Finding the rule of a number pattern",
    summary:
      "Use the changes between terms to find the rule of a pattern and to find patterns with the same rule.",
    templateIds: ["pattern-rule-choice"],
    objectives: [
      "Find the changes between neighboring terms of a number pattern.",
      "Tell an add rule, a multiply rule and a rule whose changes grow by one.",
    ],
    openingTitle: "Look at how each term becomes the next",
    opening: [
      "The pattern 5, 14, 23, 32, 41 changes by 9 each time, so its rule is add 9. The pattern 2, 6, 18, 54 does not change by the same amount, but each term is 3 times the one before, so its rule is multiply by 3.",
      "In the pattern 1, 2, 4, 7, 11 the changes are 1, 2, 3, 4: they grow by 1 each time. A pattern with the same rule as 5, 14, 23, 32 adds 9 each time, even when it starts at a different number.",
    ],
    example: {
      prompt: "Which rule makes the pattern 3, 5, 9, 15, 23?",
      steps: [
        "The changes are $5-3=2$, $9-5=4$, $15-9=6$, $23-15=8$.",
        "The changes are not equal, but they grow by 2 each time.",
        "The rule is to add 2, then add 4, then add 6, and so on.",
      ],
      answer: "The amount added grows by 2 each time",
    },
    methodTitle: "Changes first, then check",
    method: [
      "Find the changes. Equal changes mean an add rule. Changes that grow or shrink by the same amount mean a growing rule.",
      "If the terms grow too fast to add, divide each term by the one before to look for a multiplier.",
      "Check the rule on every term.",
    ],
    formalTitle: "Rules of patterns",
    formal: [
      "A constant change $d$ gives terms $a_{n+1}=a_n+d$. A constant factor $m$ gives $a_{n+1}=m\\,a_n$.",
      "If the changes $d_n$ satisfy $d_{n+1}=d_n+c$ for a constant $c$, the changes form a pattern with rule add $c$.",
    ],
    pitfalls: [
      "Checking only the first two terms.",
      "Saying a pattern multiplies when the changes are growing by one each time.",
      "Choosing a pattern with the same first term rather than the same rule.",
    ],
    parentGuide:
      "Ask your learner to write the changes between terms under each pair of neighbors before choosing a rule.",
  }),
  chainLesson({
    id: "pattern-term-unknown-rule-lesson",
    title: "Continuing a pattern from its terms",
    summary:
      "Find a later term of a pattern, including decreasing patterns and patterns whose changes grow or shrink by one.",
    templateIds: ["pattern-term-unknown-rule"],
    objectives: [
      "Find the changes between terms and say how they change.",
      "Continue a pattern whose changes are constant, growing by one or shrinking by one.",
    ],
    openingTitle: "Follow the changes",
    opening: [
      "The pattern 40, 33, 27, 22 goes down by 7, then 6, then 5. The amount taken away shrinks by 1 each time, so the next change is 4 and the next term is $22-4=18$.",
      "When the changes are the same each time, you add or take away that amount again. When the changes themselves change by the same amount, continue that second pattern, then use it to continue the first.",
    ],
    example: {
      prompt:
        "A pattern starts 50, 43, 37, 32, 28. What is the seventh number?",
      steps: [
        "The changes are $-7$, $-6$, $-5$, $-4$: each is 1 more than the one before.",
        "The next changes are $-3$ and $-2$.",
        "$28-3=25$ is the sixth number, and $25-2=23$ is the seventh.",
      ],
      answer: "23",
    },
    methodTitle: "Write the changes, then continue them",
    method: [
      "Subtract each term from the next to write the changes.",
      "See how the changes change (the same, up by 1, or down by 1).",
      "Write the next changes and add them one at a time.",
    ],
    formalTitle: "Patterns of changes",
    formal: [
      "If $a_{n+1}=a_n+d_n$ and $d_{n+1}=d_n+c$, the terms follow a pattern whose changes follow a constant rule.",
      "When $c=0$ the changes are constant and the terms add the same amount each time.",
    ],
    pitfalls: [
      "Adding the last change again when the changes are different.",
      "Moving the wrong direction in a decreasing pattern: the changes are negative.",
      "Skipping a term: the seventh number needs the sixth first.",
    ],
    parentGuide:
      "Ask your learner to write the changes between terms under the pattern and to say what happens to them.",
  }),
];

export const patternRuleFacetMappings: FacetMapping[] = [
  {
    templateId: "pattern-rule-choice",
    facetId: "rule-patterns.rule-features",
    extent: "partial",
    rationale:
      "Single choice of the rule (add, multiply by 2 to 4, or an added amount that grows by one) of a five-term pattern, or of the listed pattern that follows the same rule. Does not assess tables of inputs and outputs, rules written with a letter, or pattern graphs.",
  },
  {
    templateId: "pattern-term-unknown-rule",
    facetId: "rule-patterns.number-rule-terms",
    extent: "partial",
    rationale:
      "Numeric entry for the next or seventh term of an increasing or decreasing pattern from four or five terms, where the change is constant or grows or shrinks by one each time. Does not assess multiplicative patterns, tables completed by dragging, or explaining the rule in words.",
  },
];
