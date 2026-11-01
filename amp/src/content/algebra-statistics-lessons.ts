import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Algebra 1 statistics (S-ID): summaries, two-way tables, least-squares
 * lines, residuals and correlation, and association versus causation. */
export const algebraStatisticsLessons: Lesson[] = [
  {
    id: "statistical-summary-comparison",
    title: "Center, spread and outliers",
    summary:
      "The mean is the total divided by how many values there are. The median is the middle value once the values are in order. An outlier is a value far from the rest. One large outlier can pull the mean far from most of the data, while the median barely moves. So when you compare two groups, compare their middles and their spreads, not just their means.",
    templateIds: ["outlier-center-shift", "skewed-box-compare"],
    senses: {
      mean: "mean-average",
      average: "mean-average",
      range: "range-statistics",
      tail: "tail",
      change: "change",
      changes: "change",
      difference: "difference-subtract",
      part: "part",
    },
    noLink: ["center", "side", "sides"],
    objectives: [
      "Predict how an outlier moves the mean and the median.",
      "Describe the shape of a set of data, and choose measures of center and spread that suit it.",
      "Tell the range, which depends on the two most extreme values, from the IQR.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "How one unusual value changes the center",
        paragraphs: [
          "The mean is the total divided by the number of values, so every value counts toward it. The median is the middle value once the data are in order. With an even number of values, it is halfway between the two middle values.",
          "An outlier is a value unusually far from most of the data. Changing an outlier changes the mean. The median may move less, or not at all, because it depends only on which values are in the middle.",
          "Eight students read 2, 3, 4, 4, 5, 5, 5 and 20 books. The total is 48, so the mean is $48 \\div 8 = 6$. The two middle values are 4 and 5, so the median is 4.5.",
          "Now remove the outlier, 20. The mean drops to $28 \\div 7 = 4$, a drop of 2. The median drops only from 4.5 to 4.",
        ],
        illustration: "scene-outlier-mean-median",
      },
      {
        title: "Shape decides the measures",
        paragraphs: [
          "A box plot draws five numbers. The box holds the middle half of the data. It runs from the lower quartile, $Q_1$, to the upper quartile, $Q_3$: the middles of the lower half and the upper half. The line inside the box is the median. The whiskers, the lines out from the box, reach the least value (minimum) and the greatest value (maximum).",
          "The shape of a set of data is how its values are spread out. A box plot suggests the data are skewed right when the right whisker and the right part of the box are much longer. That long side, stretching toward higher values, is called a tail. It suggests the data are skewed left when the long side is on the left. It looks roughly symmetric when the two sides match.",
          "A long tail tends to pull the mean toward it. The standard deviation is a measure of how far values usually are from the mean. Extreme values can make it larger too.",
          "The interquartile range is $\\text{IQR} = Q_3 - Q_1$, the width of the box. It measures how spread out the middle half is. For skewed data or data with outliers, compare medians and IQRs. For roughly symmetric data without outliers, means and standard deviations work well too.",
          "The range is the maximum minus the minimum, so it uses only the two most extreme values. One long tail can give a group the larger range even when its middle half is narrower.",
        ],
        illustration: "scene-skewed-box-plots",
      },
    ],
    workedExample: {
      prompt:
        "Nine students waited 3, 4, 4, 5, 5, 6, 6, 7 and 23 minutes for a bus. The 23 was a recording error; the correct value is 5. How do the mean and the median change when it is corrected?",
      steps: [
        "Find the mean before: the values add to 63, so the mean is $63 \\div 9 = 7$. After the fix, the total drops by $23 - 5 = 18$ to 45, so the mean is $45 \\div 9 = 5$. The mean decreases by 2.",
        "Find the median before: it is the 5th of the 9 ordered values, which is 5.",
        "Find the median after: the ordered values are 3, 4, 4, 5, 5, 5, 6, 6, 7. The 5th value is still 5.",
        "The median depends only on which value is in the middle, and 5 stays in the middle. So the median does not change.",
      ],
      answer: "The mean decreases by 2, and the median does not change.",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For $n$ values, with $n$ greater than 0, the mean is their sum divided by $n$. The median is the middle ordered value when $n$ is odd, or the mean of the two middle values when $n$ is even.",
          "Replacing one value changes the mean by (new value − old value) ÷ $n$. Its effect on the median depends on the new order.",
          "The range is maximum minus minimum. The IQR is $Q_3 - Q_1$, the width of the middle half. Extreme values can change the range and the standard deviation a lot.",
        ],
      },
    ],
    pitfalls: [
      "Find the middle positions again before saying how a changed value affects the median.",
      "The range depends on the two most extreme values. The IQR describes only the middle half.",
      "For skewed data, use the median and IQR to describe a typical value and the middle spread. Use the mean and standard deviation only with care for the tail.",
    ],
    parentGuide:
      "Time how long each family member takes to get ready in the morning for a week. Find the mean and the median. Then add one very slow day and see which one moves.",
  },
  {
    id: "categorical-association",
    title: "Joint, marginal and conditional percents",
    summary:
      "A percent is a part out of a whole, written out of 100. The same count gives a different percent when the whole changes. In “30 of the 50 ninth graders”, the whole is the 50 ninth graders. To see whether two kinds of answers are related, compare percents that use the same kind of whole.",
    templateIds: ["relative-frequency-percent", "conditional-frequency-choice"],
    senses: {
      whole: "whole",
      wholes: "whole",
      part: "part",
      sorts: "sort",
      changes: "change",
      population: "population",
      difference: "difference-subtract",
      samples: "sample",
    },
    noLink: ["edge"],
    objectives: [
      "Find joint, marginal and conditional relative frequencies as percents.",
      "Tell a conditional percent from its reverse.",
      "Judge association by comparing conditional percents within rows.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Every percent has a whole",
        paragraphs: [
          "A categorical variable sorts people or things into named groups, such as grade 9 or grade 12. A two-way table counts two such variables at once. Here they are a student's grade and how the student gets to school.",
          "Each row and each column adds to its total, written at the edge of the table. That edge is called the margin. The corner holds everyone surveyed, 100 students.",
          "A percent from a table is a part divided by a whole, times 100. A relative frequency is the same thing: a count divided by a total. There are three kinds, depending on the part and the whole you use.",
          "A joint percent divides one inside cell by everyone. 30 of the 100 students are ninth graders who ride the bus, so that is 30%. A marginal percent divides a total in the margin by everyone. 40 of the 100 ride the bus, so that is 40%.",
          "A conditional percent divides by one row or one column only. Of the 50 ninth graders, 30 ride the bus: $30 \\div 50 = 60\\%$. Of the 40 bus riders, 30 are ninth graders: $30 \\div 40 = 75\\%$. The words after “of” name the whole.",
        ],
        illustration: "scene-relative-frequencies",
      },
      {
        title: "Association: compare within rows",
        paragraphs: [
          "Two variables are associated when one answer is clearly more common in one group than in another.",
          "In another survey, more twelfth graders than ninth graders ride the bus: 21 against 18. But there are 70 twelfth graders and only 30 ninth graders. Counts and joint percents also depend on how big each group is.",
          "So find each row's percent, as if each row were its own 100%. $18 \\div 30 = 60\\%$ of ninth graders ride the bus, but only $21 \\div 70 = 30\\%$ of twelfth graders. These conditional percents are far apart, so the variables are associated in this data. A percentage point is a difference of 1 between two percents, so 60% and 30% are 30 points apart. Here, percents 20 or more points apart count as associated. Percents only a few points apart count as about the same.",
        ],
        illustration: "scene-conditional-renormalize",
      },
    ],
    workedExample: {
      prompt:
        "Of 50 ninth graders, 30 ride the bus; of 50 twelfth graders, 10 do. Of the 40 bus riders, what percent are ninth graders?",
      steps: [
        "Name the whole from the words after “of”: the bus riders. There are 40 of them, the total of the “Bus” column.",
        "Find the part inside that whole: 30 of the bus riders are ninth graders.",
        "Divide the part by the whole: $30 \\div 40 = 0.75$, which is 75%.",
      ],
      answer: "75%",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A percent from a two-way table is a part divided by a whole that is not 0. The question's “of” names that whole. A conditional percent uses one row or one column as its whole.",
          "Compare the same answer's conditional percents across groups whose totals are not 0. Different percents show an association in the data collected. Before claiming the same for a larger group, consider how big the difference is and how much results could vary by chance.",
        ],
      },
    ],
    pitfalls: [
      "“Percent of ninth graders who ride the bus” and “percent of bus riders who are ninth graders” have different wholes.",
      "Judge association by conditional percents, not by counts or joint percents.",
    ],
    parentGuide:
      "Ask friends and family two yes-or-no questions, such as whether they drink coffee and whether they wake before 7. Make a two-way table and compare the percent of each group who say yes.",
  },
  {
    id: "regression-interpretation",
    title: "Slope and intercept of a fitted line",
    summary:
      "A scatter plot is a graph with one dot for each person or thing, placed by two measurements. A fitted line is a straight line drawn through it to predict one amount from another, such as test score from hours of practice. Its slope is how much the prediction changes for each 1 more unit of the input. Its intercept is the prediction when the input is 0. It is useful when an input of 0 makes sense in the situation.",
    templateIds: ["regression-coefficient-meaning", "regression-line-predict"],
    senses: {
      change: "change",
      changes: "change",
      unit: "unit",
      units: "unit",
      squared: "square-number",
      impossible: "impossible",
      sides: "side-of-equation",
      difference: "difference-subtract",
    },
    objectives: [
      "Explain the slope of a fitted line as a rate, with units.",
      "Decide whether the $y$-intercept has a meaning in the situation.",
      "Use the line to predict, and to find the input for a prediction.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The slope is a rate",
        paragraphs: [
          "A scatter plot shows one dot per student: $x$ (the amount across) is hours of practice, and $y$ (the amount up) is test score. A fitted line follows the dots. The usual one is the least-squares line. It is the line that makes the dots' vertical gaps from it as small as possible: the total of the gaps, each multiplied by itself, is smallest.",
          "Software writes the line as $\\hat{y} = mx + b$. The hat on $\\hat{y}$ (read “$y$ hat”) means a predicted value, not a measured one. The number $m$ multiplying $x$ is the slope. The number $b$ added at the end is the $y$-intercept.",
          "For practice and score, the line $\\hat{y} = 4x + 42$ has slope 4. Each extra hour of practice goes with a predicted score 4 points higher. Its units are points per hour: units of $y$ for each unit of $x$.",
          "The slope describes a trend across students. It is not a promise for one student. Real scores scatter above and below the line.",
        ],
        illustration: "scene-least-squares-line",
      },
      {
        title: "Predicting, and the intercept",
        paragraphs: [
          "To predict, put the input in place of $x$. A student who practices 7 hours has a predicted score of $\\hat{y} = 4(7) + 42 = 70$. Here $4(7)$ means 4 times 7.",
          "To find the input for a prediction, solve an equation. A predicted score of 62 needs $4x + 42 = 62$. Subtract 42 from both sides: $4x = 20$. Divide both sides by 4: $x = 5$ hours.",
          "The intercept, 42, is the prediction at $x = 0$. A student who practices 0 hours has a predicted score of 42. That makes sense here because the data include students who practiced 0 hours.",
          "When $x = 0$ is far outside the data, the intercept may have no real meaning. Predicting outside the data is called extrapolation. A line for adults' height in cm and mass in kg might be $\\hat{y} = 0.9x - 85$. But no adult is 0 cm tall, and a mass of −85 kg cannot happen.",
        ],
        illustration: "scene-predict-on-line",
      },
    ],
    workedExample: {
      prompt:
        "The least-squares line for the age $x$ of used cars, in years, and their value, in thousands of dollars, is $\\hat{y} = -2.5x + 30$. Two cars are 3 and 7 years old. By how many thousand dollars do their predicted values differ?",
      steps: [
        "The slope is the number multiplying $x$, −2.5. So each extra year of age lowers the predicted value by 2.5 thousand dollars.",
        "Find the gap in age: from 3 to 7 years is $7 - 3 = 4$ more years.",
        "Each of the 4 years lowers the prediction by 2.5: $2.5 \\times 4 = 10$. So the predictions differ by 10 thousand dollars.",
        "Check by predicting both: $-2.5(3) + 30 = 22.5$ and $-2.5(7) + 30 = 12.5$. The gap is $22.5 - 12.5 = 10$.",
      ],
      answer: "10",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For a fitted line $\\hat{y} = mx + b$, the slope $m$ is the predicted change in $y$ for each 1 more of $x$, in the units of the situation. The intercept $b$ is the prediction at $x = 0$.",
          "A least-squares line predicts $y$ when you put a value in for $x$. Two predictions differ by the slope times the difference in their $x$-values.",
        ],
      },
    ],
    pitfalls: [
      "The slope is a rate. The intercept is a single prediction, the one at $x = 0$.",
      "Keep $x$ and $y$ straight: the slope is the change in predicted $y$ for each 1 more of $x$.",
      "An intercept far outside the data may have no sensible meaning, and its prediction is unreliable.",
    ],
    parentGuide:
      "Look at a phone plan or taxi fare with a fixed fee plus a cost per minute or mile. Name the slope and the intercept, with their units. Use them to predict a bill.",
  },
  {
    id: "residuals-correlation",
    title: "Residuals and correlation",
    summary:
      "A fitted line predicts a value for each point. A residual is the measured value minus the predicted value: how far the point is above or below the line. A plot of the residuals shows where the line misses. The correlation coefficient, $r$, is a number from −1 to 1 that tells how closely the points follow a straight line.",
    templateIds: ["residual-value", "correlation-choice"],
    senses: { model: "model" },
    noLink: ["leaves", "rule", "jump", "rules", "mean"],
    objectives: [
      "Find a residual, and find a measured value from its residual.",
      "Read a residual plot to judge whether a line fits.",
      "Estimate and compare correlation coefficients, and recognize what $r$ cannot see.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Residuals: observed − predicted",
        paragraphs: [
          "A fitted line is written $\\hat{y} = mx + b$. The hat on $\\hat{y}$ (read “$y$ hat”) means a predicted value. The observed value $y$ is the one that was actually measured.",
          "Each point has a residual: observed $y$ minus predicted $\\hat{y}$. On the graph it is the up-and-down stick from the point to the line. It is positive when the point is above the line and negative when it is below.",
          "A student who practiced 8 hours scored 78. The line $\\hat{y} = 4x + 42$ predicts $4(8) + 42 = 74$, where $4(8)$ means 4 times 8. So the residual is $78 - 74 = 4$.",
          "Going the other way, observed = predicted + residual.",
        ],
        illustration: "scene-residual-sticks",
      },
      {
        title: "Residual plots show what a line missed",
        paragraphs: [
          "A residual plot puts each residual above its $x$-value. If the residuals scatter above and below 0 with no pattern, the line has caught the trend.",
          "Stopping distance grows faster and faster as speed goes up. A straight line fit to it leaves residuals that are positive, then negative, then positive again. That makes a curve. The pattern says a curved model, a curved graph used to describe the data, would fit better.",
        ],
        illustration: "scene-residual-plot-curve",
      },
      {
        title: "Correlation measures linear strength",
        paragraphs: [
          "The correlation coefficient $r$ is a number from −1 to 1. Its sign gives the direction of a straight-line trend: positive when the points rise from left to right, negative when they fall.",
          "Its distance from 0 gives the strength. Points close to a rising line have $r$ near 1. A loose cloud has $r$ nearer 0. So $r = -0.9$ shows a stronger trend than $r = 0.7$, because −0.9 is farther from 0.",
          "Move every point straight up or down, halfway to the fitted line, and the cloud tightens around it. Then $r$ moves closer to 1 for a rising line, or closer to −1 for a falling line.",
        ],
        illustration: "scene-correlation-tighten",
      },
      {
        title: "Correlation sees only lines",
        paragraphs: [
          "Temperatures rise through the morning and fall in the evening. They follow a clear curve, yet $r$ can be near 0. No single straight line fits a rise and then a fall.",
          "So $r$ near 0 means little or no straight-line pattern. It does not mean no pattern at all.",
        ],
        illustration: "scene-curve-near-zero-r",
      },
    ],
    workedExample: {
      prompt:
        "The least-squares line is $\\hat{y} = 4x + 42$. A student not in the data practiced 3 hours, and the residual for this student is −5. What did the student score?",
      steps: [
        "Find the predicted score by putting 3 in place of $x$: $4(3) + 42 = 12 + 42 = 54$.",
        "A residual is observed minus predicted, so observed = predicted + residual: $54 + (-5) = 49$.",
        "Check: $49 - 54 = -5$, the given residual. The negative residual means the student scored below the line.",
      ],
      answer: "49",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A residual is observed $y$ minus predicted $\\hat{y}$. It is positive for points above the fitted line and negative for points below it.",
          "For pairs of number data where both values vary, the correlation $r$ is between $-1$ and $1$. Its sign gives the direction of a straight-line trend. Its size without the sign, written $|r|$, measures the strength of that trend.",
          "A curved pattern in a residual plot can show what $r$ misses. An $r$ near 0 does not rule out a curved relationship.",
        ],
      },
    ],
    pitfalls: [
      "Residual = observed − predicted, not the other way around.",
      "Strength is how far $r$ is from 0. The sign gives only the direction.",
      "A curve in a residual plot means a line is the wrong model, even when $r$ is large.",
    ],
    parentGuide:
      "Measure the height and the arm span of several people and plot the pairs. Estimate $r$ from the picture, draw a line by eye, and find who is farthest from it.",
  },
  {
    id: "causal-claims",
    title: "Association is not causation",
    summary:
      "Two amounts are associated when they tend to change together, like ice cream sales and sunburns. That alone does not show that one causes the other. Something else may cause both, or the cause may run the other way. To test a cause, a study assigns the treatment at random, like a coin flip, and compares the groups.",
    templateIds: ["causal-claim-choice", "study-design-choice"],
    senses: {
      average: "mean-average",
      difference: "difference-subtract",
      differences: "difference-subtract",
      change: "change",
    },
    noLink: ["third", "balances", "balance", "mean"],
    objectives: [
      "Explain an association by a lurking variable or by reverse causation.",
      "Tell an experiment from an observational study.",
      "Choose a randomized design that can test a cause, and state what a study shows.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Other explanations for an association",
        paragraphs: [
          "In a beach town, days with more ice cream sold also have more sunburns. The two are associated: they tend to rise and fall together. But ice cream does not cause sunburn.",
          "Hot, sunny days bring people to the beach. There they both buy ice cream and get sunburned. The weather is a lurking variable: a hidden third thing that affects both.",
          "Sometimes cause and effect run the other way. Cities with more police officers have more crime. But more crime is a reason to hire more officers. This is called reverse causation.",
          "In an observational study, researchers only record what already happens. They do not decide who gets what. So a lurking variable or reverse causation could explain any association they find.",
        ],
        illustration: "scene-lurking-weather",
      },
      {
        title: "Experiments: assign the treatment at random",
        paragraphs: [
          "In an experiment, the researcher decides who gets the treatment, the thing being tested. Random assignment means deciding by chance, such as a coin flip or a random list.",
          "Random assignment tends to make the groups alike in everything else: age, effort, health, and even things no one thought to measure.",
          "Then a difference in results can support a claim that the treatment caused it. First consider whether chance alone could explain it, and whether the groups were treated alike apart from the treatment.",
          "Compare percents when the groups differ in size. For example, 90% of the app group passed, against 20% of the others.",
          "Without random assignment, people who chose the treatment may differ in other ways. Then the same difference shows only an association.",
        ],
        illustration: "scene-experiment-bars",
      },
    ],
    workedExample: {
      prompt:
        "A researcher wants to know whether a vocabulary app raises quiz scores. Which design can show this?",
      steps: [
        "Comparing students who already use the app with those who do not is an observational study. The app users may study more in general, which is a lurking variable.",
        "Giving everyone the app and comparing before and after has no comparison group. Scores might rise anyway, for example from regular classes.",
        "Randomly assign students either to use the app or to study as usual, then compare their scores. Random assignment balances other influences overall, though chance differences can remain. This design can show whether the app raises scores.",
      ],
      answer:
        "Randomly assign students to use the app or to study as usual, then compare their quiz scores.",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "An association in observed data can come from a lurking variable or from reverse causation. So it does not show a cause.",
          "A well-run experiment, with random assignment of the treatment and a comparison group, can support a claim of cause for the people in it.",
          "Random assignment balances other influences overall, but chance differences are still possible. A difference alone is not enough to claim a cause without considering chance and how the study was run.",
        ],
      },
    ],
    pitfalls: [
      "An association in observed data does not show which variable causes which, or whether either one does.",
      "“Correlation is not causation” does not mean the variables are unrelated.",
      "Before claiming a cause from an experiment, look for random assignment, a comparison group, and a check on chance.",
    ],
    parentGuide:
      "Find a headline that claims one thing causes another. Ask whether the study assigned the cause at random. Think of a lurking variable that could explain the result instead.",
  },
];

export const algebraStatisticsMethods: Record<string, ProblemMethod> = {
  "outlier-center-shift": {
    goal: "Decide how an outlier changes the mean and the median.",
    senses: {
      mean: "mean-average",
      change: "change",
      changes: "change",
      difference: "difference-subtract",
    },
    noLink: ["leaves"],
    intuition:
      "The mean is the total divided by the number of values. The median is the middle value once the values are in order. An outlier is a value far from the rest. Adding or removing a value changes the count and usually the total. Changing a value changes the total. Either way the mean usually moves. The median moves only if the middle of the ordered list moves.",
    terms: ["mean-average", "median", "outlier"],
    method: [
      "Find the mean before and after: total ÷ count. Change the total, and change the count if a value joins or leaves.",
      "Order the values and find the middle before and after.",
      "Compare the two changes.",
    ],
    watch:
      "The mean depends on the size of every value. The median moves only when the middle of the order moves.",
  },
  "skewed-box-compare": {
    goal: "Compare two box plots by shape, center and spread.",
    senses: {
      range: "range-statistics",
      tail: "tail",
      mean: "mean-average",
      part: "part",
      parts: "part",
      change: "change",
    },
    noLink: ["side", "sides", "center"],
    intuition:
      "A box plot's box runs from the lower quartile ($Q_1$) to the upper quartile ($Q_3$), the middles of the lower and upper halves. The line inside is the median, the middle value. The whiskers reach the least and greatest values. If one side is much longer, that long side is a tail. A tail to the right means skewed right, and a tail to the left means skewed left. The IQR, $Q_3 - Q_1$, is the box's width. The range is the greatest value minus the least value. The mean is the total divided by the number of values.",
    terms: [
      "interquartile-range",
      [
        "skewed-right",
        "On a box plot, the right whisker and the right part of the box are longer.",
      ],
    ],
    method: [
      "For each plot, compare the two whiskers and the two parts of the box on either side of the median.",
      "A clearly longer side suggests a tail: skewed right or skewed left. If the sides about match, the data look roughly symmetric.",
      "For skewed data, compare medians and IQRs. Read the range from the whisker ends and the IQR from the box.",
    ],
    watch:
      "A long whisker makes the range large. The IQR depends only on the box. The IQR is the width of the box.",
  },
  "relative-frequency-percent": {
    goal: "Find a joint, marginal or conditional percent from a two-way table.",
    senses: { whole: "whole", part: "part" },
    noLink: ["edges"],
    intuition:
      "A two-way table counts people by two questions at once, with totals at the edges. A percent is a part divided by a whole, times 100. A joint percent is one cell divided by everyone surveyed. A marginal percent is a row or column total divided by everyone surveyed. A conditional percent is a count divided by the total of one row or one column: the group named after “of”.",
    terms: [
      "joint-relative-frequency",
      "marginal-relative-frequency",
      "conditional-relative-frequency",
    ],
    method: [
      "Name the whole: everyone surveyed, or only the group named after “of”.",
      "Find the count of the part inside that whole.",
      "Divide the part by the whole and write it as a percent.",
    ],
    watch:
      "“Of the athletes” means divide by the athletes' total, not by everyone.",
  },
  "conditional-frequency-choice": {
    goal: "Read conditional percents and use them to judge association.",
    senses: {
      whole: "whole",
      part: "part",
      differences: "difference-subtract",
    },
    noLink: ["mean"],
    intuition:
      "A conditional percent is a count divided by the total of one row or one column of a two-way table: the group named after “of”. Two questions are associated when the same answer is clearly more common in one group than in another. So compare the percent giving that answer within each group.",
    terms: ["conditional-relative-frequency"],
    method: [
      "For a percent, find the group named after “of”. Its row or column total is what you divide by.",
      "For association, find the percent within each row who give the same answer.",
      "A percentage point is a difference of 1 between two percents, so 60% and 30% are 30 points apart. Here, percents 20 or more points apart count as associated. Percents only a few points apart count as about the same.",
    ],
    watch:
      "Counts and joint percents depend on group size. Compare percents within each row.",
  },
  "regression-coefficient-meaning": {
    goal: "Explain what the slope and intercept of a least-squares line mean in the situation.",
    senses: {
      change: "change",
      changes: "change",
      unit: "unit",
      units: "unit",
      impossible: "impossible",
      degree: "degree-temperature",
      degrees: "degree-temperature",
    },
    noLink: ["mean"],
    intuition:
      "A scatter plot is a graph with one dot for each person or thing. A least-squares line is the straight line that best follows those dots. It is written $\\hat{y} = mx + b$, and $\\hat{y}$ (read “$y$ hat”) means a predicted value. The slope is the number multiplying $x$, written $m$. It is how much the prediction changes for each 1 more unit of $x$. The $y$-intercept is the number added at the end, written $b$. It is the prediction when $x = 0$. It has a clear meaning when $x = 0$ makes sense in the situation and is near the data.",
    terms: ["slope", "y-intercept"],
    method: [
      "The slope is the number multiplying $x$. Say it as: each extra unit of $x$ goes with a predicted $y$ that much higher, or lower if negative.",
      "The intercept is the prediction at $x = 0$. It has a clear meaning when $x = 0$ makes sense in the situation and is near the data.",
    ],
    watch:
      "Keep $x$ and $y$ straight, and do not read the slope as the value at $x = 0$.",
  },
  "regression-line-predict": {
    goal: "Use a least-squares line to predict.",
    senses: {
      change: "change",
      unit: "unit",
      units: "unit",
      difference: "difference-subtract",
    },
    intuition:
      "A scatter plot is a graph with one dot for each person or thing. A least-squares line is the straight line that best follows those dots. It is written $\\hat{y} = mx + b$, where $\\hat{y}$ (read “$y$ hat”) is the predicted value. The slope is the number multiplying $x$, written $m$. To predict, put the input in place of $x$. Something like $-1.5(9)$ means $-1.5$ times 9. Multiply first, then add $b$.",
    terms: ["slope", "y-intercept"],
    method: [
      "To predict, put the input in place of $x$ and work it out.",
      "For how far apart two predictions are, multiply the slope, ignoring its sign, by how far apart the inputs are.",
      "For the input that gives a prediction, set the line's formula equal to it and solve for $x$.",
    ],
    watch:
      "Multiply before adding the intercept, and keep the minus sign of a negative slope.",
  },
  "residual-value": {
    goal: "Find a residual, or a measured value from its residual.",
    intuition:
      "A least-squares line is written $\\hat{y} = mx + b$, and $\\hat{y}$ (read “$y$ hat”) is the value it predicts. The observed value is the one actually measured. A residual is the observed value minus the predicted value: how far the point is above the line (positive) or below it (negative).",
    terms: [
      [
        "residual",
        "Written $y - \\hat{y}$, where $\\hat{y}$ is the predicted value.",
      ],
    ],
    method: [
      "Find the predicted value by putting $x$ into the line.",
      "Residual = observed − predicted. Going back, observed = predicted + residual.",
    ],
    watch:
      "Subtract in the order observed − predicted. A point below the line has a negative residual.",
  },
  "correlation-choice": {
    goal: "Interpret correlation and residual plots.",
    senses: { model: "model" },
    noLink: ["jump", "rules"],
    intuition:
      "A scatter plot is a graph with one dot for each person or thing. The correlation coefficient $r$ is a number from −1 to 1 that tells how closely those dots follow a straight line. Its sign gives the direction: positive when the dots rise from left to right, negative when they fall. The closer $r$ is to 1 or −1, the tighter the dots hug a line. A residual is a point's measured value minus the line's prediction. A residual plot is a graph of those gaps.",
    terms: ["correlation-coefficient"],
    method: [
      "Direction: dots rising from left to right give a positive $r$. Falling dots give a negative $r$.",
      "Strength: the more closely the dots hug a line, the closer $r$ is to −1 or 1.",
      "In a residual plot, a curve means a line is the wrong model. No pattern means a line is a reasonable model.",
    ],
    watch:
      "Strength is how far $r$ is from 0. An $r$ near 0 means a weak straight-line pattern, but a curve may still be there.",
  },
  "causal-claim-choice": {
    goal: "Judge what an observed association can and cannot show.",
    senses: { changes: "change", population: "population" },
    noLink: ["third"],
    intuition:
      "Two amounts are associated when they tend to change together. That does not show that one causes the other. A lurking variable, a hidden third thing, may cause both. Or the cause may run backward, from the second thing to the first. This is called reverse causation.",
    terms: [
      "lurking-variable",
      [
        "causation",
        "Reverse causation means the second variable is actually causing the first.",
      ],
    ],
    method: [
      "Ask how the data were collected: just observed, or assigned at random?",
      "For observed data, look for a lurking variable, or for cause and effect running backward.",
      "If the data were only observed, conclude association, not causation.",
    ],
    watch: "Not showing a cause is not the same as showing no relationship.",
  },
  "study-design-choice": {
    goal: "Choose and read study designs.",
    senses: {
      average: "mean-average",
      difference: "difference-subtract",
      differences: "difference-subtract",
    },
    noLink: ["balances"],
    intuition:
      "In an experiment, the researcher decides who gets the treatment, the thing being tested. Random assignment decides it by chance, such as a coin flip. That tends to make the groups alike in everything else, so a difference in results can be evidence of a cause. An observational study is one where researchers only record what people already do. There the researchers do not assign the treatment, so a difference shows only association.",
    terms: ["experiment", "observational-study"],
    method: [
      "Find who decided which people got the treatment: the researcher at random, or the people themselves.",
      "Random assignment with a comparison group can show cause and effect. Observation shows association.",
      "Compare results as percents of each group.",
    ],
    watch:
      "People who chose the treatment themselves, or a before-and-after test with no comparison group, do not by themselves show a cause.",
  },
};

export const algebraStatisticsPrinciples: Record<string, string> = {
  "outlier-center-shift":
    "Replacing one of $n$ values changes the mean by (new value − old value) ÷ $n$. The median's change depends on the new order.",
  "skewed-box-compare":
    "For skewed data, the median describes the middle of the ordered data and the IQR the middle half. Extreme values can change the mean, the standard deviation and the range.",
  "relative-frequency-percent":
    "A percent from a two-way table is a part over a whole, and the question's “of” names the whole.",
  "conditional-frequency-choice":
    "Compare the same answer's conditional percents across groups whose totals are not 0. Different percents show association in the data collected.",
  "regression-coefficient-meaning":
    "A fitted slope is the predicted change in $y$ for each 1 more of $x$, in the situation's units. The intercept is the prediction at $x = 0$.",
  "regression-line-predict":
    "A least-squares line predicts $y$ when you put in a value for $x$. Predictions change by the slope for each 1 more of $x$.",
  "residual-value":
    "A residual is observed $y$ minus predicted $\\hat{y}$. It is positive above the fitted line and negative below it.",
  "correlation-choice":
    "For pairs of number data where both values vary, the correlation $r$ is between −1 and 1 and measures the direction and strength of a straight-line trend. A residual plot can show a curve that the line missed.",
  "causal-claim-choice":
    "An association in observed data can come from a lurking variable or from reverse causation, so it does not show a cause.",
  "study-design-choice":
    "A well-run experiment with random assignment can support a claim of cause for the people in it. Chance differences and how the study was run still matter.",
};
