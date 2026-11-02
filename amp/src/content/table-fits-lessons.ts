import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const tableFitsMethods: Record<string, ProblemMethod> = {
  "table-fits-description": {
    goal: "Check each table against the totals and the number of choices a survey fixes, and choose the one that fits.",
    intuition:
      "A survey asks people a question and records their answers. A table shows how many people gave each answer. Here each person gives exactly one answer. The story tells you some facts: how many people answered, and how many choices there were. The right table must match every fact. Check them one at a time.",
    terms: ["survey", "two-way-table"],
    method: [
      "Write down what the story tells you: the number of people, the number of choices, or the total for each row and column. A row goes across a table, and a column goes up and down.",
      "Add the counts in each table. A two-way table sorts people two ways at once, so add each row and each column.",
      "Keep the table that matches every fact. Each other table breaks at least one fact.",
    ],
    watch:
      "A table can have the right total and still have the wrong number of choices. Check every fact.",
  },
};

export const tableFitsPrinciples: Record<string, string> = {
  "table-fits-description":
    "When each person in a survey gives exactly one answer, each person is counted once. So the counts in a table add up to the number of people. In a two-way table, the row totals add up to the number of people, and so do the column totals.",
};

export const tableFitsLessons = [
  chainLesson({
    id: "table-fits-lesson",
    title: "Which table fits the survey?",
    summary:
      "A survey asks people a question and counts their answers. A table shows the counts. To pick the right table, check two things. When each person gives exactly one answer, the counts must add up to the number of people. The table must have the right number of choices.",
    templateIds: ["table-fits-description"],
    objectives: [
      "Use the number of people and the number of choices to check a table.",
      "Check the row totals and the column totals of a two-way table.",
    ],
    openingTitle: "Check the facts the survey gives",
    opening: [
      "A survey asks people a question. Say 14 students each pick one of 4 lunches.",
      "Each student picks exactly one lunch, so every student is counted once. The counts must add up to 14. The table must also show 4 lunches. A table that adds up to 13 is wrong. A table with 5 lunches is wrong too.",
      "A two-way table sorts the same students two ways at once, like by grade and by lunch. A row goes across, and a column goes up and down. Each grade has a row, and each lunch has a column. A total is how many altogether. The counts across a row add up to that row's total. The counts down a column add up to that column's total.",
    ],
    example: {
      prompt:
        "20 students each chose one of 3 pets. Which table fits: Dogs 9, Cats 7, Fish 3, or Dogs 9, Cats 7, Fish 4?",
      steps: [
        "Each student is counted once, so the counts must add up to 20. There must also be 3 pets.",
        "Add the first table: $9+7+3=19$. That is not 20, so it does not fit.",
        "Add the second table: $9+7+4=20$. It also shows 3 pets, so it fits.",
      ],
      answer: "Dogs 9, Cats 7, Fish 4",
    },
    methodTitle: "Total, choices, then rows and columns",
    method: [
      "Add the counts in each table and compare with the number of people.",
      "Count the choices. For a two-way table, add each row and each column too. Each sum must match the total the story gives for that group.",
    ],
    formalTitle: "Totals in tables",
    formal: [
      "When each person is in exactly one group, the counts add up to the number of people.",
      "In a two-way table, the row totals add up to the number of people, and so do the column totals. Each total is the counts in its row or column added together.",
    ],
    pitfalls: [
      "Do not check only the total. Check the number of choices too.",
      "In a two-way table, do not check only the rows. Check the columns too.",
      "Do not pick a table just because its biggest count looks right.",
    ],
    parentGuide:
      "Ask your learner which totals the survey gives first. Then have them add the counts in each table and compare with those totals.",
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
