import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const patternRuleMethods: Record<string, ProblemMethod> = {
  "pattern-rule-choice": {
    goal: "Find the rule of a number pattern from its terms, or find the pattern that follows the same rule.",
    intuition:
      "A number pattern is a list of numbers made by a rule. Each number in it is called a term. The rule tells how to turn each term into the next. It can add the same number each time, like 5, 14, 23 (add 9). It can multiply by the same number each time, like 2, 6, 18 (multiply by 3). Or it can add an amount that grows each time, like 1, 2, 4, 7 (add 1, then 2, then 3). The change is how much a term grows to make the next one.",
    terms: ["term-sequence", "rule"],
    senses: { term: "term-sequence", rule: "rule" },
    method: [
      "Subtract each term from the next to find the changes. If the changes are all equal, the rule is to add that number.",
      "If the changes are not equal, divide each term by the one before to look for a multiply rule. Or see whether the changes grow by the same amount each time.",
      "Check the rule on every term. To find a pattern with the same rule, use the rule on each choice's first term.",
    ],
    watch:
      "Check the rule on all the terms, not just the first two. Two terms can fit more than one rule.",
  },
  "pattern-term-unknown-rule": {
    goal: "Find a later term of a pattern from its first terms when the rule is not given, including patterns whose changes grow or shrink.",
    intuition:
      "A number pattern is a list of numbers made by a rule. Each number in it is called a term. When no rule is given, you find it from the terms. Subtract each term from the next to see the change, how much it goes up or down. If the changes are all the same, keep using that change. If the changes grow or shrink by one each time, keep following that second pattern too.",
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
    senses: { term: "term-sequence", rule: "rule" },
    method: [
      "Write the change between each pair of neighbors: the second term minus the first, and so on. For a pattern that goes down, write how much it goes down.",
      "Decide whether the changes stay the same, or grow or shrink by the same amount each time.",
      "Continue the changes. Use each one on the last term until you reach the term you need.",
    ],
    watch:
      "When the changes are not equal, do not use the last change again. Follow how the changes themselves change.",
  },
};

export const patternRulePrinciples: Record<string, string> = {
  "pattern-rule-choice":
    "Adding 9 each time to 5 gives 5, 14, 23, 32. In general, a rule that adds $d$ gives $a$, $a+d$, $a+2d$, and so on. A rule that multiplies by $m$ gives $a$, $a\\times m$, $a\\times m\\times m$, and so on. A rule that adds $d$, then $d+1$, then $d+2$ has changes that grow by 1. Two patterns follow the same rule when they change in the same way, whatever their first terms.",
  "pattern-term-unknown-rule":
    "If the changes between neighbors are all equal, the pattern adds the same amount each time. If the changes grow or shrink by the same amount each time, the changes make a pattern of their own. Then each term is the term before it plus the next change.",
};

export const patternRuleLessons = [
  chainLesson({
    id: "pattern-rule-choice-lesson",
    title: "Finding the rule of a number pattern",
    summary:
      "A number pattern is a list of numbers made by a rule, like “add 9.” Each number in it is called a term. Look at how much each term changes to make the next. That shows the rule. Then you can find other patterns with the same rule.",
    senses: { term: "term-sequence", rule: "rule" },
    templateIds: ["pattern-rule-choice"],
    objectives: [
      "Find the changes between neighboring terms of a number pattern.",
      "Tell apart an adding rule, a multiplying rule and a rule whose changes grow each time.",
    ],
    openingTitle: "Look at how each term becomes the next",
    opening: [
      "The change is how much a term grows to make the next one. Subtract to find it: in 5, 14, 23, the change is 14 − 5 = 9.",
      "The pattern 5, 14, 23, 32, 41 changes by 9 each time. So its rule is “add 9.”",
      "The pattern 2, 6, 18, 54 does not change by the same amount each time. But each term is 3 times the one before. So its rule is “multiply by 3.”",
      "In the pattern 1, 2, 4, 7, 11, the changes are 1, 2, 3, 4. They grow by 1 each time. So the rule adds 1, then 2, then 3, and so on.",
      "Two patterns have the same rule when they change in the same way. A pattern with the same rule as 5, 14, 23, 32 adds 9 each time, even if it starts at a different number, like 2, 11, 20, 29.",
    ],
    example: {
      prompt: "Which rule makes the pattern 3, 5, 9, 15, 23?",
      steps: [
        "Subtract each term from the next to find the changes: $5-3=2$, $9-5=4$, $15-9=6$, $23-15=8$.",
        "The changes are not equal, so it is not an “add the same number” rule. But the changes 2, 4, 6, 8 grow by 2 each time.",
        "So the rule is: add 2, then add 4, then add 6, and so on. Check: $3+2=5$, $5+4=9$, $9+6=15$, $15+8=23$.",
      ],
      answer: "The amount added grows by 2 each time",
    },
    methodTitle: "Changes first, then check",
    method: [
      "Find the changes. Equal changes mean an adding rule. Changes that grow or shrink by the same amount each time mean a growing rule.",
      "If the terms grow very fast, divide each term by the one before. The same answer each time means a multiplying rule.",
      "Check the rule on every term.",
    ],
    formalTitle: "Rules of patterns",
    formal: [
      "With an adding rule, each term is the term before plus the same number $d$. With a multiplying rule, each term is the term before times the same number $m$.",
      "If each change is the change before plus the same number $c$, the changes make a pattern of their own, with the rule “add $c$.”",
    ],
    pitfalls: [
      "Check the rule on every term, not only the first two.",
      "If the changes grow by 1 each time, the rule adds a growing amount. It does not multiply.",
      "Choose the pattern with the same rule, not the one with the same first term.",
    ],
    parentGuide:
      "Ask your learner to write the change between each pair of neighbors under the pattern before choosing a rule.",
  }),
  chainLesson({
    id: "pattern-term-unknown-rule-lesson",
    title: "Continuing a pattern from its terms",
    summary:
      "A number pattern is a list of numbers made by a rule. Each number in it is called a term. When the rule is not given, look at how much each term changes to make the next. Keep the changes going to find a later term.",
    senses: { term: "term-sequence", rule: "rule" },
    templateIds: ["pattern-term-unknown-rule"],
    objectives: [
      "Find the changes between terms, and say how the changes change.",
      "Continue a pattern whose changes stay the same, grow by one or shrink by one, going up or going down.",
    ],
    openingTitle: "Follow the changes",
    opening: [
      "The change is how much a term goes up or down to make the next one.",
      "The pattern 40, 33, 27, 22 goes down by 7, then 6, then 5. The amount taken away shrinks by 1 each time.",
      "So the next change is to take away 4. The next term is $22-4=18$.",
      "When the changes are the same each time, add or take away that amount again. When the changes themselves change by the same amount, continue that second pattern first. Then use it to continue the first pattern.",
    ],
    example: {
      prompt:
        "A pattern starts 50, 43, 37, 32, 28. What is the seventh number?",
      steps: [
        "Find the changes. The pattern goes down by 7, then 6, then 5, then 4. Each amount taken away is 1 less than the one before.",
        "So the next two changes are to take away 3, then take away 2.",
        "The sixth number is $28-3=25$. The seventh needs the sixth first: $25-2=23$.",
      ],
      answer: "23",
    },
    methodTitle: "Write the changes, then continue them",
    method: [
      "Subtract to find how much each term goes up or down to make the next.",
      "See how the changes change: they stay the same, go up by 1, or go down by 1.",
      "Write the next changes and use them one at a time.",
    ],
    formalTitle: "Patterns of changes",
    formal: [
      "Each term is the term before it plus a change. If each change is the change before plus the same number $c$, the changes follow the rule “add $c$.”",
      "When $c$ is 0, the changes are all the same, and the terms add the same amount each time.",
    ],
    pitfalls: [
      "When the changes are different, do not use the last change again.",
      "In a pattern that goes down, take away each change. Do not add it.",
      "Do not skip a term. The seventh number needs the sixth first.",
    ],
    parentGuide:
      "Ask your learner to write the change between each pair of terms under the pattern, and to say what happens to the changes.",
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
