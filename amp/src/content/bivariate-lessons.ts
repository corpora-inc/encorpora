import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const bivariateLessons: Lesson[] = [
  {
    id: "scatterplots",
    title: "Scatter plots and trend lines",
    summary:
      "A scatter plot shows how two quantities vary together; a trend line models a linear pattern, and its slope is the rate.",
    templateIds: [
      "scatter-association-choice",
      "trend-line-predict",
      "trend-slope-meaning",
    ],
    objectives: [
      "Describe an association as positive or negative, linear or nonlinear, or absent.",
      "Use a trend line to predict, and interpret its slope as a rate in context.",
    ],
    sections: [
      {
        title: "Read the pattern",
        paragraphs: [
          "Each point is one student: across for hours studied, up for test score. Read left to right: as hours increase, scores tend to increase, and the points hug a straight line. That is a positive linear association.",
          "If the points fall from left to right along a line, the association is negative linear: older cars, for example, tend to be worth less.",
        ],
        illustration: "scene-scatter-study",
      },
      {
        title: "Curves are patterns too",
        paragraphs: [
          "Temperatures rise through the morning, peak at 2 p.m. and fall. The pattern is clear, but no straight line follows it: a nonlinear association.",
          "A cloud with no direction, such as shoe size against quiz score, shows no association: one quantity does not help predict the other.",
        ],
        illustration: "scene-scatter-curve",
      },
      {
        title: "Use the trend line",
        paragraphs: [
          "The trend line passes through (2, 22) and (8, 10). Its slope is (10 − 22) ÷ (8 − 2) = −12 ÷ 6 = −2: each additional year of age goes with a value about 2 thousand dollars lower.",
          "To predict a 6-year-old car, move 4 years from (2, 22): 22 − 2 × 4 = 14 thousand dollars. The line gives a typical value; real cars scatter around it.",
        ],
        illustration: "scene-scatter-trend",
      },
    ],
    workedExample: {
      prompt:
        "A trend line through (1, 50) and (9, 90) relates hours studied to test score. Predict the score for 6 hours.",
      steps: [
        "Slope: (90 − 50) ÷ (9 − 1) = 40 ÷ 8 = 5 points per hour.",
        "From 1 hour to 6 hours is 5 hours: 5 × 5 = 25 points more.",
        "50 + 25 = 75.",
      ],
      answer: "75",
    },
    pitfalls: [
      "The slope is a rate, change in y for each 1 more of x; the intercept is a single value at x = 0.",
      "An association does not show that one quantity causes the other.",
    ],
    parentGuide:
      "Measure the height and the arm span of family members and friends, plot the pairs, and draw the line that best follows them. Use it to predict a new person’s arm span.",
  },
  {
    id: "two-way-tables",
    title: "Two-way tables",
    summary:
      "A two-way table counts two yes-or-no questions at once; comparing percents within rows reveals association.",
    templateIds: [
      "two-way-missing",
      "two-way-row-percent",
      "two-way-association-choice",
    ],
    objectives: [
      "Complete a two-way table from its row and column totals.",
      "Find a percent within a row and use row percents to judge association.",
    ],
    sections: [
      {
        title: "Totals fill the blanks",
        paragraphs: [
          "Every row adds across to its total, and every column adds down to its total. The Grade 8 row has two blanks, so its total alone cannot help.",
          "The “Yes” column can: 42 students have a curfew, and 18 are seventh graders, so 42 − 18 = 24 eighth graders do. Then 60 − 24 = 36 do not.",
        ],
        illustration: "scene-two-way-blank",
      },
      {
        title: "Compare percents, not counts",
        paragraphs: [
          "More eighth graders than seventh graders have a curfew, 24 against 18. But the groups differ in size: 20 seventh graders and 60 eighth graders.",
          "Within each row: 18 ÷ 20 = 90% of seventh graders, but 24 ÷ 60 = 40% of eighth graders. The percents differ a lot, so grade and having a curfew are associated: in this table, seventh graders are far more likely to have one.",
        ],
        illustration: "scene-two-way-bars",
      },
    ],
    workedExample: {
      prompt:
        "In a table, 45 of 60 athletes and 30 of 40 non-athletes eat breakfast daily. Is there an association?",
      steps: [
        "Athletes: 45 ÷ 60 = 75%.",
        "Non-athletes: 30 ÷ 40 = 75%.",
        "The row percents are equal, so there is no association, even though the counts differ.",
      ],
      answer: "No association",
    },
    pitfalls: [
      "Divide by the row total for a percent within a row, not by the table total.",
      "Groups of different sizes make raw counts misleading.",
    ],
    parentGuide:
      "Ask family and friends two yes-or-no questions, such as whether they drink coffee and whether they wake before 7. Tally a two-way table and compare the percents in each row.",
  },
];

export const bivariateMethods: Record<string, ProblemMethod> = {
  "scatter-association-choice": {
    goal: "Describe the association in a scatter plot.",
    terms: [
      [
        "association",
        "A pattern in how two quantities vary together, so one helps predict the other.",
      ],
    ],
    method: [
      "Read the points left to right as x increases.",
      "Ask whether y tends to rise, fall, follow a curve, or show no trend.",
      "If the points follow a line, name the direction: positive or negative.",
    ],
    watch: "A curved pattern is an association too, but it is not linear.",
  },
  "trend-line-predict": {
    goal: "Predict a value with a trend line.",
    method: [
      "Find the slope from the two marked points: change in y ÷ change in x.",
      "Count the steps in x from a marked point to the new x.",
      "Add slope × steps to that point’s y-value.",
    ],
    watch:
      "Moving left means negative steps: the change has the opposite sign.",
  },
  "trend-slope-meaning": {
    goal: "Interpret a trend line’s slope in context.",
    method: [
      "Find the slope from the two marked points.",
      "Say it as a rate: for each 1 more of x, y changes by the slope.",
      "Use “more” for a positive slope and “fewer” or “lower” for a negative one.",
    ],
    watch:
      "The value at x = 0 is the intercept, not the slope; and do not swap x and y.",
  },
  "two-way-missing": {
    goal: "Find a missing count in a two-way table.",
    method: [
      "Find a row or column with only one unknown.",
      "Subtract the known counts from that row’s or column’s total.",
      "Check that the row and column still add to their totals.",
    ],
    watch: "A row with two blanks cannot be solved alone: use a column.",
  },
  "two-way-row-percent": {
    goal: "Find a percent within one row of a two-way table.",
    method: [
      "Find the row for the group the question names.",
      "Divide that row’s count by the row total.",
      "Write the fraction as a percent.",
    ],
    watch: "Divide by the row total, not the table total.",
  },
  "two-way-association-choice": {
    goal: "Decide whether two categorical variables are associated.",
    method: [
      "Find the “Yes” percent within each row.",
      "Compare the percents: a large gap shows association; nearly equal percents show none.",
    ],
    watch: "Comparing raw counts misleads when the rows have different totals.",
  },
};
export const bivariatePrinciples: Record<string, string> = {
  "scatter-association-choice":
    "An association is a trend in how two quantities vary together: up or down, along a line or a curve, or no trend at all.",
  "trend-line-predict":
    "A trend line predicts y by starting from a point on it and adding slope × the change in x.",
  "trend-slope-meaning":
    "A trend line’s slope is the change in y for each 1 more of x, a rate in the units of the context.",
  "two-way-missing":
    "Every row and column of a two-way table adds to its total, so a line with one blank determines it.",
  "two-way-row-percent":
    "A percent within a row compares a count to the row total, describing that group alone.",
  "two-way-association-choice":
    "Two categorical variables are associated when the percents within the rows differ substantially.",
};
