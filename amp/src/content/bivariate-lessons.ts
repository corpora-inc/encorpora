import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const bivariateLessons: Lesson[] = [
  {
    id: "scatterplots",
    title: "Scatter plots and trend lines",
    summary:
      "A scatter plot shows two measurements for each person or thing, such as hours studied and test score. Each one gets a dot: across for the first measurement, up for the second. The pattern of dots shows whether the two go together. A trend line is a straight line that follows the dots. Its slope, how much it rises or falls for each 1 step across, is a rate you can use to predict.",
    templateIds: [
      "scatter-association-choice",
      "trend-line-predict",
      "trend-slope-meaning",
    ],
    senses: { change: "change", unit: "unit", units: "unit" },
    objectives: [
      "Describe an association as positive or negative, linear or nonlinear, or absent.",
      "Use a trend line to predict, and explain what its slope means in the situation.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Read the pattern",
        paragraphs: [
          "Each dot is one student. How far across it sits shows hours studied. How far up it sits shows test score. A dot at $(2, 70)$ means 2 hours studied and a score of 70. The first number is always across, called $x$, and the second is up, called $y$.",
          "Read the dots from left to right. As hours go up, scores tend to go up. A pattern like this, where one measurement tends to change with the other, is called an association.",
          "Here the dots also lie close to a straight line. Rising and straight together is called a positive linear association. Linear means following a line.",
          "If the dots fall from left to right along a line, the association is negative linear. For example, older cars tend to be worth less.",
        ],
        illustration: "scene-scatter-study",
      },
      {
        title: "Curves are patterns too",
        paragraphs: [
          "Temperatures rise through the morning, peak at 2 p.m. and then fall. The pattern is clear, but no straight line follows it. This is a nonlinear association: a pattern that follows a curve.",
          "Sometimes the dots form a cloud with no direction, such as shoe size against quiz score. That shows no association. Knowing one measurement does not help predict the other.",
        ],
        illustration: "scene-scatter-curve",
      },
      {
        title: "Use the trend line",
        paragraphs: [
          "A trend line is a straight line drawn to follow the dots. Its slope is how much $y$ changes for each 1 step in $x$. Find it from two points on the line: the change in $y$ divided by the change in $x$.",
          "This trend line passes through $(2, 22)$ and $(8, 10)$, for car age in years and value in thousands of dollars. The slope is $(10 - 22) \\div (8 - 2) = -12 \\div 6 = -2$. So each extra year of age goes with a value about 2 thousand dollars lower.",
          "To predict a 6-year-old car, start at $(2, 22)$ and move 4 years: $22 - 2 \\times 4 = 14$ thousand dollars. The line gives a typical value. Real cars scatter above and below it.",
        ],
        illustration: "scene-scatter-trend",
      },
    ],
    workedExample: {
      prompt:
        "A trend line through (1, 50) and (9, 90) relates hours studied to test score. Predict the score for 6 hours.",
      steps: [
        "Find the slope, the change in score for each 1 more hour. Divide the change in score by the change in hours: $(90 - 50) \\div (9 - 1) = 40 \\div 8 = 5$ points per hour.",
        "Start from the point $(1, 50)$. From 1 hour to 6 hours is 5 more hours, so the score goes up $5 \\times 5 = 25$ points.",
        "Add that to the starting score: $50 + 25 = 75$.",
      ],
      answer: "75",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A scatter plot shows pairs of measurements. An association is a visible pattern in the pairs, such as an upward or downward trend. It may follow a line or a curve. A cloud with no clear pattern shows no association.",
          "A trend line predicts $y$ this way: start at a point on the line, then add slope × the change in $x$.",
          "A trend line's slope is the change in $y$ for each 1 more of $x$. It is a rate, in the units of the situation.",
        ],
      },
    ],
    pitfalls: [
      "The slope is a rate: the change in $y$ for each 1 more of $x$. The value where $x = 0$ is a single starting value, not the slope.",
      "An association does not show that one measurement causes the other.",
    ],
    parentGuide:
      "Measure the height and the arm span of family members and friends. Plot the pairs and draw the line that best follows them. Use it to predict a new person's arm span.",
  },
  {
    id: "two-way-tables",
    title: "Two-way tables",
    summary:
      "A two-way table counts the same people by two questions at once, such as whether they own a dog and whether they walk daily. Each row is one group, and each row and column adds to its total. A percent means out of 100. To find a group's percent, divide its count by the group's total and multiply by 100: 12 out of 20 is $12 \\div 20 = 0.6$, and $0.6 \\times 100 = 60$, so 60%.",
    templateIds: [
      "two-way-missing",
      "two-way-row-percent",
      "two-way-association-choice",
    ],
    senses: {
      sorts: "sort",
      sample: "sample",
      population: "population",
      difference: "difference-subtract",
      part: "part",
      whole: "whole",
    },
    noLink: ["eighth", "combination"],
    objectives: [
      "Complete a two-way table from its row and column totals.",
      "Find a percent within a row, and use row percents to judge association.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "What each row means",
        paragraphs: [
          "Each row of a two-way table is one group, such as dog owners. The row total counts everyone in that group. A box inside the table, called a cell, counts the people in the group who gave one answer, such as walking daily.",
          "A percent tells how many out of 100. Divide the cell count by the row total, then multiply by 100. If 12 of 20 dog owners walk daily, $12 \\div 20 = 0.6$ and $0.6 \\times 100 = 60$. So 60% of dog owners walk daily.",
          "Compare this with the same percent among people without dogs. If the percents differ, the answer is more common in one group. Then we say the two questions are associated in this table.",
        ],
      },
      {
        stage: "method",
        title: "Totals fill the blanks",
        paragraphs: [
          "A two-way table sorts the same people by two questions. Each cell counts one pairing of answers, such as grade 8 and has a curfew. Every row adds across to its total, and every column adds down to its total.",
          "The Grade 8 row has two blanks, so its total alone cannot fill either one. The “Yes” column can. 42 students have a curfew, and 18 of them are seventh graders. So $42 - 18 = 24$ eighth graders have one. Then $60 - 24 = 36$ eighth graders do not.",
        ],
        illustration: "scene-two-way-blank",
      },
      {
        title: "Compare percents, not counts",
        paragraphs: [
          "More eighth graders than seventh graders have a curfew: 24 against 18. But the groups differ in size. There are 20 seventh graders and 60 eighth graders.",
          "Find the percent within each row. Seventh graders: $18 \\div 20 = 0.9$, so 90%. Eighth graders: $24 \\div 60 = 0.4$, so 40%.",
          "The percents differ a lot. So grade and having a curfew are associated in this table: a curfew is more common among seventh graders.",
        ],
        illustration: "scene-two-way-bars",
      },
    ],
    workedExample: {
      prompt:
        "A table shows that 12 of 20 dog owners and 12 of 40 people without dogs walk daily. In these recorded groups, are dog ownership and walking daily associated?",
      steps: [
        "Find the percent among dog owners by dividing by their total: $12 \\div 20 = 0.6$, which is 60%.",
        "Find the percent among people without dogs by dividing by their total: $12 \\div 40 = 0.3$, which is 30%.",
        "Both groups have 12 daily walkers, but the groups differ in size, so compare percents. Walking daily is more common among dog owners, 60% against 30%. So the two answers are associated in this table.",
      ],
      answer: "Yes, an observed association in this table",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Every row and column of a two-way table adds to its total. So a row or column with only one blank tells you that blank.",
          "A percent within a row compares a count with the row total. It describes that group alone.",
          "For rows whose totals are not 0, compare the share giving the same answer in each row. Different shares show an association in this table. Equal shares show none.",
          "A sample is the part of a larger group that was actually asked. A difference in a sample does not settle that the whole group differs the same way, because samples vary.",
        ],
      },
    ],
    pitfalls: [
      "For a percent within a row, divide by the row total, not by the table total.",
      "When groups differ in size, raw counts mislead. Compare percents.",
    ],
    parentGuide:
      "Ask family and friends two yes-or-no questions, such as whether they drink coffee and whether they wake before 7. Tally a two-way table and compare the percents in each row.",
  },
];

export const bivariateMethods: Record<string, ProblemMethod> = {
  "scatter-association-choice": {
    goal: "Describe the association in a scatter plot.",
    senses: { change: "change", changes: "change" },
    intuition:
      "A scatter plot gives one dot to each person or thing: across for one measurement ($x$), up for the other ($y$). An association is a pattern where $y$ tends to change as $x$ changes. Positive means the dots tend to rise from left to right. Negative means they tend to fall. Linear means they lie near a straight line. Nonlinear means they follow a curve.",
    terms: ["association"],
    method: [
      "Read the dots from left to right, as $x$ increases.",
      "Ask whether $y$ tends to rise, fall, follow a curve, or show no trend.",
      "If the dots follow a straight line, name its direction: positive or negative.",
    ],
    watch: "A curved pattern is an association too, but it is not linear.",
  },
  "trend-line-predict": {
    goal: "Predict a value with a trend line.",
    senses: {
      change: "change",
      changes: "change",
      opposite: "opposite-number",
    },
    intuition:
      "A trend line is a straight line that follows the dots of a scatter plot. A point such as $(1, 50)$ gives $x$, the amount across, then $y$, the amount up. The slope is how much $y$ changes for each 1 step in $x$. Start at a marked point and add the slope once for each step in $x$.",
    terms: ["slope"],
    method: [
      "Find the slope from the two marked points: change in $y$ ÷ change in $x$.",
      "Count the steps in $x$ from a marked point to the new $x$.",
      "Add slope × steps to that point's $y$-value.",
    ],
    watch: "Moving left counts as negative steps: −1, −2 and so on.",
  },
  "trend-slope-meaning": {
    goal: "Explain what a trend line's slope means in the situation.",
    senses: {
      change: "change",
      changes: "change",
      units: "unit",
      degree: "degree-temperature",
    },
    intuition:
      "A trend line is a straight line that follows the dots of a scatter plot. Its slope is how much $y$ (the amount up) changes for each 1 more of $x$ (the amount across). Find it as the change in $y$ divided by the change in $x$ between two points on the line. In words, the slope is a rate, such as 4 more points for each extra hour of study.",
    terms: ["slope"],
    method: [
      "Find the slope from the two marked points: change in $y$ ÷ change in $x$.",
      "Say it as a rate: for each 1 more of $x$, $y$ changes by the slope.",
      "Use “more” for a positive slope, and “fewer” or “lower” for a negative one.",
    ],
    watch:
      "The value where $x = 0$ is a starting value, not the slope. Keep $x$ and $y$ in the right order.",
  },
  "two-way-missing": {
    goal: "Find a missing count in a two-way table.",
    senses: { sorts: "sort" },
    noLink: ["eighth", "combination"],
    intuition:
      "A two-way table sorts the same people by two questions. Each box inside, called a cell, counts one pairing of answers. The cells across a row add to that row's total. The cells down a column add to that column's total. If a count is missing, use a row or column where it is the only unknown.",
    terms: ["two-way-table"],
    method: [
      "Find a row or column with only one unknown.",
      "Subtract the known counts from that row's or column's total.",
      "Check that the row and the column both still add to their totals.",
    ],
    watch: "A row with two blanks cannot be solved alone. Use a column.",
  },
  "two-way-row-percent": {
    goal: "Find a percent within one row of a two-way table.",
    noLink: ["eighth"],
    intuition:
      "In a two-way table, each row is one group. The row total counts everyone in that group. A box inside, called a cell, counts the people in the group who gave one answer. A percent means out of 100. Divide the cell count by the row total, then multiply by 100 to get the group's percent.",
    terms: ["two-way-table", "percent"],
    method: [
      "Find the row for the group the question names.",
      "Divide that row's count by the row total.",
      "Multiply the result by 100 and write the percent sign.",
    ],
    watch: "Divide by the row total, not the table total.",
  },
  "two-way-association-choice": {
    goal: "Decide whether two categorical variables are associated.",
    senses: {
      difference: "difference-subtract",
      population: "population",
      samples: "sample",
    },
    intuition:
      "A categorical variable is a question whose answers are groups, such as dog owner or not. An association means one answer is more common in one group than in another. Compare the same answer within each group as a percent: divide the count by the group's total and multiply by 100. If 60% of people without dogs and 24% of dog owners walk daily, the two are associated in this table. That does not show what caused it.",
    terms: ["two-way-table", "percent"],
    method: [
      "Find the “Yes” percent within each row.",
      "Compare the percents. A large gap shows association. Nearly equal percents show none.",
    ],
    watch:
      "Compare percents, not raw counts, when the rows have different totals.",
  },
};
export const bivariatePrinciples: Record<string, string> = {
  "scatter-association-choice":
    "A scatter plot shows pairs of measurements. An association is a visible pattern in the pairs, such as an upward or downward trend, along a line or a curve. A cloud with no clear pattern shows no association.",
  "trend-line-predict":
    "A trend line predicts $y$ by starting at a point on it and adding slope × the change in $x$.",
  "trend-slope-meaning":
    "A trend line's slope is the change in $y$ for each 1 more of $x$. It is a rate, in the units of the situation.",
  "two-way-missing":
    "Every row and column of a two-way table adds to its total, so a row or column with one blank tells you that blank.",
  "two-way-row-percent":
    "A percent within a row compares a count with the row total, so it describes that group alone.",
  "two-way-association-choice":
    "For rows whose totals are not 0, different shares giving the same answer in each row show an association in the table, and equal shares show none. A claim about a larger group must allow for chance.",
};
