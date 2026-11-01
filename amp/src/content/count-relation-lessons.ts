import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const countRelationMethods: Record<string, ProblemMethod> = {
  "count-relation-chain": {
    goal: "Substitute a known count into a value equation to find the other count, or solve a 'times as many' and 'more than' pair.",
    intuition:
      "An equation with two counts, such as $3p+5q=87$, ties them together: once one count is known, the equation has one unknown left. A story that says 'k times as many' and 'd more than' gives two facts about the same two counts, and together they leave one unknown.",
    terms: [
      [
        "equation",
        "A value equation adds each count times its price to give the total value.",
      ],
      "times-as-many",
    ],
    method: [
      "Name the counts with variables, and write the relationship the story gives as an equation or two.",
      "Substitute the known count, or write the larger count as $kx$ and the difference as $kx-x=d$.",
      "Solve for the remaining count, then compute what the question asks: the other count, the larger count, or a total.",
    ],
    watch:
      "'k times as many' means $kx$, not $x+k$. Substitute into the equation first, then subtract the known term before dividing.",
  },
};

export const countRelationPrinciples: Record<string, string> = {
  "count-relation-chain":
    "In $ap+bq=V$, substituting a known $p$ gives $bq=V-ap$, so $q=(V-ap)/b$. If one count is $k$ times another $x$ and exceeds it by $d$, then $kx-x=d$ and $x=d/(k-1)$ for $k\\ne1$.",
};

export const countRelationLessons = [
  chainLesson({
    id: "count-relation-chain",
    title: "One count tells you the other",
    summary:
      "Use a known count in a value equation, or a 'times as many' and 'more than' statement, to find a count and then what is asked.",
    templateIds: ["count-relation-chain"],
    objectives: [
      "Substitute a known count into a two-variable value equation and solve for the other count.",
      "Write 'k times as many' and 'd more than' as one equation and solve for the smaller count.",
    ],
    openingTitle: "Two counts, one relationship",
    opening: [
      "A store sells pens for 3 dollars and notebooks for 5 dollars. If $p$ is the number of pens and $q$ the number of notebooks, the total value is $3p+5q$. The equation $3p+5q=87$ connects the two counts: if you know one, the other follows.",
      "A different kind of story compares two counts: one person has 4 times as many as another and 36 more. If the smaller count is $x$, the larger is $4x$, and the difference $4x-x$ is 36.",
    ],
    example: {
      prompt:
        "Dev has 4 times as many stamps as Lia, and 36 more than Lia. How many stamps do they have together?",
      steps: [
        "Let $x$ be Lia's stamps. Dev has $4x$.",
        "The difference is 36, so $4x-x=36$, which is $3x=36$.",
        "Then $x=12$, so Lia has 12 and Dev has $4\\times12=48$.",
        "Together they have $12+48=60$ stamps.",
      ],
      answer: "60 stamps",
    },
    methodTitle: "Substitute, solve, then answer the question asked",
    method: [
      "For a value equation, replace the known count by its number, subtract that term from the total value, and divide by the other price.",
      "For a comparison, write the larger count as $kx$ and the difference as $kx-x=d$, so $x=d\\div(k-1)$. Then find what is asked: the smaller count, the larger count, or their sum.",
    ],
    formalTitle: "Why one equation is enough",
    formal: [
      "Substituting a known value for one variable in $ap+bq=V$ leaves $bq=V-ap$, a one-variable equation with the single solution $q=(V-ap)/b$ when $b\\ne0$.",
      "Two relations about two counts, $y=kx$ and $y-x=d$, give $(k-1)x=d$. The solution is unique when $k\\ne1$.",
    ],
    pitfalls: [
      "Subtract the known term from the total before dividing.",
      "Write 'k times as many' as $kx$, not $x+k$.",
      "Answer the question asked: the second count, the larger count or the total.",
    ],
    parentGuide:
      "Ask your learner to say what each variable stands for and to check the answer in both facts of the story.",
  }),
];

export const countRelationFacetMappings: FacetMapping[] = [
  {
    templateId: "count-relation-chain",
    facetId: "systems-modeling.two-unknowns",
    extent: "partial",
    rationale:
      "Numeric entry for substituting a known count into a given two-variable value equation in context, asking for the other count or the total number of items, and for a 'times as many' and 'more than' pair asking for the smaller count, the larger count or their total. Does not assess writing the value equation unaided, solving by elimination, or more than two unknowns.",
  },
];
