import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const tableFitsMethods: Record<string, ProblemMethod> = {
  "table-fits-description": {
    goal: "Check each table against the totals and the number of choices a survey fixes, and choose the one that fits.",
    intuition:
      "A survey fixes some facts before any results are in: how many people answered and how many choices there were. A table that could show the results must obey those facts. Check them one at a time and rule out a table as soon as one fails.",
    terms: ["survey", "two-way-table"],
    method: [
      "Write down what the story fixes: the total number of people, the number of choices, or the total of each row and column.",
      "Add the counts in each table, and for a two-way table add each row and the matching column.",
      "Keep the table that matches every fact, and say which fact each other table breaks.",
    ],
    watch:
      "A table can have the right total and still have the wrong number of choices, or right row totals and wrong column totals. Check every fact.",
  },
};

export const tableFitsPrinciples: Record<string, string> = {
  "table-fits-description":
    "Each person in a survey is counted once, so the counts in a one-way table add to the number of people. In a two-way table, the row totals add to the number of people, the column totals add to the same number, and each total is the sum of its cells.",
};

export const tableFitsLessons = [
  chainLesson({
    id: "table-fits-lesson",
    title: "Which table fits the survey?",
    summary:
      "Use totals and the number of choices to tell which table could show a survey.",
    templateIds: ["table-fits-description"],
    objectives: [
      "Use the total and the number of choices of a survey to check a table of counts.",
      "Check the row totals and a column total of a two-way table.",
    ],
    openingTitle: "Check the facts the survey fixes",
    opening: [
      "Suppose 14 students each pick one of 4 lunches. Every student is counted once, so the counts must add to 14, and the table must have 4 lunches. A table that adds to 13 or has 5 lunches cannot be right.",
      "A two-way table sorts the same students two ways, such as grade and boy or girl. The cells in each row add to that grade's total, and the cells in a column add to the number of boys or of girls.",
    ],
    example: {
      prompt:
        "20 students each chose one of 3 pets. Which table fits: Dogs 9, Cats 7, Fish 3, or Dogs 9, Cats 7, Fish 4?",
      steps: [
        "The counts must add to 20, and the table must have 3 pets.",
        "First table: $9+7+3=19$, which is not 20.",
        "Second table: $9+7+4=20$, and it lists 3 pets, so it fits.",
      ],
      answer: "Dogs 9, Cats 7, Fish 4",
    },
    methodTitle: "Total, choices, then rows and columns",
    method: [
      "Add the counts of each table and compare with the total.",
      "Count the choices. For a two-way table, add each row and then the column that should match.",
    ],
    formalTitle: "Totals in tables",
    formal: [
      "In a one-way table of $n$ people, each in exactly one category, the counts add to $n$.",
      "In a two-way table, the row totals add to $n$ and so do the column totals; every total equals the sum of its cells.",
    ],
    pitfalls: [
      "Checking only the total and ignoring the number of choices.",
      "Checking only the row totals of a two-way table and not the column total.",
      "Choosing a table because the biggest count looks right.",
    ],
    parentGuide:
      "Ask your learner which number the survey tells you first, and to add it up in each table.",
  }),
];

export const tableFitsFacetMappings: FacetMapping[] = [
  {
    templateId: "table-fits-description",
    facetId: "categorical-data.core",
    extent: "partial",
    rationale:
      "Single choice among text tables of counts for a one-way survey total and number of choices, or for a two-way table of boys and girls in two grades with two row totals and a column total. The tables are lists in the answer choices, not drawn charts. Does not assess building a table from raw data, reading values from a graph, or percent columns.",
  },
];
