import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const countRelationMethods: Record<string, ProblemMethod> = {
  "count-relation-chain": {
    senses: {
      difference: "difference-subtract",
      "more than": "more-than",
      part: "part",
      term: "term-expression",
    },
    noLink: ["leaves"],
    goal: "Put a known count into a value equation to find the other count, or solve a “times as many” and “more than” pair.",
    intuition:
      "A variable is a letter that stands for an unknown number. An equation says two amounts are equal. In $3p+5q=87$, $3p$ means 3 times $p$. Once one count is known, only one unknown is left. “4 times as many” means four copies of the other count. A story saying “4 times as many” and “36 more” gives two facts about the same two counts.",
    terms: [
      [
        "equation",
        "A value equation adds each count times its price to give the total value.",
      ],
      "times-as-many",
    ],
    method: [
      "Give each count a letter, and write what the story says as an equation or two.",
      "Put the known count in place of its letter. Or, for a comparison, write the larger count as $kx$ ($k$ times $x$) and the difference as $kx-x=d$.",
      "Solve for the count that is left. Then work out what the question asks: the other count, the larger count, or a total.",
    ],
    watch:
      "“4 times as many” means $4x$, not $x+4$. Put the known number in first, then subtract the known part before dividing.",
  },
};

export const countRelationPrinciples: Record<string, string> = {
  "count-relation-chain":
    "In $ap+bq=V$, putting in a known $p$ gives $bq=V-ap$, so $q=(V-ap)/b$ when $b$ is not 0. If one count is $k$ times another count $x$ and is $d$ more than it, then $kx-x=d$, so $x=d/(k-1)$ for $k\\ne1$ ($k$ not equal to 1).",
};

export const countRelationLessons = [
  {
    ...chainLesson({
      id: "count-relation-chain",
      title: "One count tells you the other",
      summary:
        "Sometimes two counts are tied together, so knowing one tells you the other. Pens cost 3 dollars and notebooks 5 dollars, and the total is 87 dollars. If you know the number of pens, you can work out the notebooks. A story like “4 times as many, and 36 more” also ties two counts together.",
      templateIds: ["count-relation-chain"],
      objectives: [
        "Put a known count into an equation with two letters, and solve for the other count.",
        "Write “$k$ times as many” and “$d$ more than” as one equation, and solve for the smaller count.",
      ],
      openingTitle: "Two counts, one relationship",
      opening: [
        "A store sells pens for 3 dollars and notebooks for 5 dollars. A variable is a letter that stands for an unknown number. Let $p$ be the number of pens and $q$ the number of notebooks. A letter written right after a number means multiply, so $3p$ means 3 times $p$.",
        "The pens are worth $3p$ dollars and the notebooks $5q$ dollars. If the total is 87 dollars, the equation $3p+5q=87$ says the two parts add to 87. Suppose there are 4 pens. Then $3\\times4=12$, so $12+5q=87$. Subtract 12: $5q=75$. Divide by 5: $q=15$ notebooks.",
        "A different kind of story compares two counts. One person has 4 times as many stamps as another, and 36 more. If the smaller count is $x$, the larger is $4x$. The difference is $4x-x$, which is $3x$, and it equals 36.",
      ],
      example: {
        prompt:
          "Dev has 4 times as many stamps as Lia, and 36 more than Lia. How many stamps do they have together?",
        steps: [
          "Let $x$ stand for Lia's stamps. Dev has 4 times as many, so Dev has $4x$.",
          "Dev has 36 more than Lia, so the difference is 36: $4x-x=36$. Four $x$'s take away one $x$ leaves three, so $3x=36$.",
          "Divide both sides (the parts on each side of the equal sign) by 3: $x=12$. So Lia has 12, and Dev has $4\\times12=48$.",
          "The question asks for both together: $12+48=60$ stamps. Check: 48 is 4 times 12, and $48-12=36$.",
        ],
        answer: "60 stamps",
      },
      methodTitle: "Substitute, solve, then answer the question asked",
      method: [
        "Substitute means put a number in place of a letter. For a value equation, put in the known count. Subtract that part from the total value, then divide by the other price.",
        "For a comparison, write the larger count as $kx$ and the difference as $kx-x=d$. That is $(k-1)x=d$, so $x=d\\div(k-1)$. Then find what is asked: the smaller count, the larger count, or their sum.",
      ],
      formalTitle: "Why one equation is enough",
      formal: [
        "Put a known value for $p$ into $ap+bq=V$. That leaves $bq=V-ap$, an equation with only one unknown. When $b$ is not 0, it has exactly one solution: $q=(V-ap)/b$.",
        "Two facts about two counts, $y=kx$ and $y-x=d$, give $(k-1)x=d$. There is exactly one solution when $k\\ne1$, meaning $k$ is not equal to 1.",
      ],
      pitfalls: [
        "Subtract the known part from the total before dividing.",
        "Write “4 times as many” as $4x$, not $x+4$.",
        "Answer the question asked: the second count, the larger count or the total.",
      ],
      parentGuide:
        "Ask your learner to say what each letter stands for. Then ask them to check the answer against both facts in the story.",
    }),
    senses: {
      "more than": "more-than",
      part: "part",
      difference: "difference-subtract",
      sides: "side-of-equation",
    },
    noLink: ["leaves"],
  },
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
