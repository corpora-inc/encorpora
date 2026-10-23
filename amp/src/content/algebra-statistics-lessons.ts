import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Algebra 1 statistics (S-ID): summaries, two-way tables, least-squares
 * lines, residuals and correlation, and association versus causation. */
export const algebraStatisticsLessons: Lesson[] = [
  {
    id: "statistical-summary-comparison",
    title: "Center, spread and outliers",
    summary:
      "One unusually large value can pull an average away from most of the data. Compare the middle and the spread as well as the average when describing two groups.",
    templateIds: ["outlier-center-shift", "skewed-box-compare"],
    objectives: [
      "Predict how an outlier moves the mean and the median.",
      "Describe a distribution's shape and choose measures of center and spread that suit it.",
      "Tell the range, which depends on the two extreme values, from the IQR.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "How one unusual value changes the center",
        paragraphs: [
          "The mean is the total divided by the count: every value contributes to it. The median is the middle value when the data are in order, or the average of the two middle values. An outlier is a value unusually far from most of the data. Changing one outlier changes the mean; the median may change less, stay fixed, or change more depending on where the ordered middle falls.",
          "Eight students read 2, 3, 4, 4, 5, 5, 5 and 20 books. The total is 48, so the mean is $48 \\div 8 = 6$; the median is halfway between 4 and 5, 4.5. Remove the outlier, 20: the mean drops to $28 \\div 7 = 4$, but the median only to 4.",
        ],
        illustration: "scene-outlier-mean-median",
      },
      {
        title: "Shape decides the measures",
        paragraphs: [
          "In a box plot the box holds the middle half of the data, from the lower quartile Q1 to the upper quartile Q3, with the median inside. The whiskers reach the minimum and maximum.",
          "A distribution is skewed right when the right whisker and the right part of the box are much longer: a tail toward higher values. It is skewed left when the long side is on the left, and roughly symmetric when the two sides match.",
          "A long tail often pulls the mean toward it. Standard deviation measures spread around the mean and can also be affected by extreme values. The interquartile range, $\\text{IQR}=Q_3-Q_1$, measures the width of the middle half. For skewed data or data with outliers, compare medians and IQRs; for roughly symmetric data without outliers, means and standard deviations also describe center and spread.",
          "The range, maximum − minimum, uses only the two most extreme values. One long tail can give a group the larger range even when its middle half is narrower.",
        ],
        illustration: "scene-skewed-box-plots",
      },
    ],
    workedExample: {
      prompt:
        "Nine students waited 3, 4, 4, 5, 5, 6, 6, 7 and 23 minutes for a bus. The 23 was a recording error; the correct value is 5. How do the mean and the median change when it is corrected?",
      steps: [
        "Mean before: $63 \\div 9 = 7$. Mean after: $45 \\div 9 = 5$. The mean decreases by 2.",
        "Median before: the 5th of the 9 ordered values, 5. After: the values are 3, 4, 4, 5, 5, 5, 6, 6, 7, and the 5th is still 5.",
        "The median depends only on the order, and 5 stays in the middle.",
      ],
      answer: "The mean decreases by 2, and the median does not change.",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For $n>0$ values, the mean is their sum divided by $n$. The median is the middle ordered value when $n$ is odd, or the average of the two middle values when $n$ is even. Replacing one value changes the mean by the replacement difference divided by $n$; its effect on the median depends on the new ordering.",
          "The range is maximum minus minimum. The IQR is $Q_3-Q_1$, the width of the middle half between the lower and upper quartiles. Extreme values can change the range and standard deviation substantially; these effects depend on the data.",
        ],
      },
    ],
    pitfalls: [
      "Recompute the middle positions before claiming how a changed outlier affects the median.",
      "The range depends on the two most extreme values; the IQR describes the middle half.",
      "For skewed data, use median and IQR to describe a typical center and middle spread; give mean and standard deviation only with attention to the tail.",
    ],
    parentGuide:
      "Time how long each family member takes to get ready in the morning for a week. Find the mean and the median, then add one very slow day and see which one moves.",
  },
  {
    id: "categorical-association",
    title: "Joint, marginal and conditional percents",
    summary:
      "A percentage changes when the group counted as the whole changes. Compare percentages within the same kind of group to see whether two categories are related.",
    templateIds: ["relative-frequency-percent", "conditional-frequency-choice"],
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
          "A categorical variable sorts observations into named groups. A two-way table counts two such variables at once: here, a student's grade and how the student gets to school. Each row and column adds to its total, and the corner holds everyone surveyed, 100.",
          "A joint percent divides one cell by everyone: 30 of 100 are ninth graders who ride the bus, 30%. A marginal percent divides a total in the margin by everyone: 40 of 100 ride the bus, 40%.",
          "A conditional percent divides by one row or one column only. Of the 50 ninth graders, 30 ride the bus: 60%. Of the 40 bus riders, 30 are ninth graders: 75%. The words after “of” name the whole.",
        ],
        illustration: "scene-relative-frequencies",
      },
      {
        title: "Association: compare within rows",
        paragraphs: [
          "Twelfth graders ride the bus more often by count, 21 against 18, but there are 70 twelfth graders and only 30 ninth graders. Counts and joint percents mostly reflect how big each group is.",
          "Stretch each row to 100%: 60% of ninth graders ride the bus, but only 30% of twelfth graders. When the conditional percents differ a lot, the variables are associated; when they are about equal, they are not.",
        ],
        illustration: "scene-conditional-renormalize",
      },
    ],
    workedExample: {
      prompt:
        "Of 50 ninth graders, 30 ride the bus; of 50 twelfth graders, 10 do. Of the 40 bus riders, what percent are ninth graders?",
      steps: [
        "The whole is the bus riders, the “Bus” column: 40 students.",
        "Ninth graders in that column: 30.",
        "$30 \\div 40 = 0.75 = 75\\%$.",
      ],
      answer: "75%",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A percent from a two-way table is a part divided by a nonzero whole; the question's “of” names that whole. A conditional percent uses one row or column as its whole.",
          "Compare the same outcome's conditional percents across groups with nonzero totals. Different percents show an association in the observed data; their size and sampling uncertainty matter before claiming a population difference.",
        ],
      },
    ],
    pitfalls: [
      "“Percent of ninth graders who ride the bus” and “percent of bus riders who are ninth graders” have different wholes.",
      "Judge association by conditional percents, not counts or joint percents.",
    ],
    parentGuide:
      "Ask friends and family two yes-or-no questions, such as whether they drink coffee and whether they wake before 7. Make a two-way table and compare the percent of each group who say yes.",
  },
  {
    id: "regression-interpretation",
    title: "Slope and intercept of a fitted line",
    summary:
      "A fitted line predicts one quantity from another. Its slope tells how much the prediction changes for one more unit of input.",
    templateIds: ["regression-coefficient-meaning", "regression-line-predict"],
    objectives: [
      "Interpret the slope of a fitted line as a rate, with units.",
      "Decide whether the $y$-intercept has a meaning in context.",
      "Use the line to predict, and to find the input for a prediction.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The slope is a rate",
        paragraphs: [
          "The least-squares line is the line that makes the sum of the squared vertical gaps from the points smallest. Software reports it as $\\hat{y} = mx + b$; the hat on $\\hat{y}$ says it is a predicted value, not an observed one.",
          "For hours of practice $x$ and test score $y$, the line $\\hat{y} = 4x + 42$ has slope 4: each additional hour of practice goes with a predicted score 4 points higher. Its units are points per hour, the units of $y$ over the units of $x$.",
          "The slope describes a trend across students, not a promise for one student: real scores scatter around the line.",
        ],
        illustration: "scene-least-squares-line",
      },
      {
        title: "Predicting, and the intercept",
        paragraphs: [
          "To predict, substitute: a student who practices 7 hours has a predicted score of $\\hat{y} = 4(7) + 42 = 70$. To find the input for a prediction, solve: a predicted score of 62 needs $4x + 42 = 62$, so $x = 5$.",
          "The intercept, 42, is the prediction at $x = 0$: a student who practices 0 hours has a predicted score of 42. That has a meaning here because the data include 0 hours.",
          "When $x = 0$ is far outside the data, the intercept is an extrapolation with no meaning. A line for adults' height and mass might be $\\hat{y} = 0.9x - 85$: no adult is 0 cm tall, and a mass of −85 kg is impossible.",
        ],
        illustration: "scene-predict-on-line",
      },
    ],
    workedExample: {
      prompt:
        "The least-squares line for the age $x$ of used cars, in years, and their value, in thousands of dollars, is $\\hat{y} = -2.5x + 30$. Two cars are 3 and 7 years old. By how many thousand dollars do their predicted values differ?",
      steps: [
        "The slope, −2.5, is the predicted change in value for each additional year.",
        "From 3 to 7 years is 4 more years.",
        "$2.5 \\times 4 = 10$, so the predictions differ by 10 thousand dollars.",
      ],
      answer: "10",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A fitted slope is a predicted rate of change in context, and the intercept is the prediction at $x = 0$.",
          "A least-squares line predicts $y$ by substituting $x$; predictions change by the slope for each 1 more of $x$.",
        ],
      },
    ],
    pitfalls: [
      "The slope is a rate; the intercept is a single prediction at $x = 0$.",
      "Do not swap the variables: the slope is change in $y$ for each 1 more of $x$.",
      "An intercept far outside the data has no meaning in context.",
    ],
    parentGuide:
      "Look at a phone plan or taxi fare with a fixed fee plus a cost per minute or mile. Name the slope and the intercept, with their units, and use them to predict a bill.",
  },
  {
    id: "residuals-correlation",
    title: "Residuals and correlation",
    summary:
      "A residual is the gap between a measured value and a line’s prediction. A plot of those gaps shows where the line misses.",
    templateIds: ["residual-value", "correlation-choice"],
    objectives: [
      "Find a residual, and an observed value from its residual.",
      "Read a residual plot to judge whether a line fits.",
      "Estimate and compare correlation coefficients, and recognize what $r$ cannot see.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Residuals: observed − predicted",
        paragraphs: [
          "Each point has a residual: its observed $y$ minus the line's predicted $\\hat{y}$. On the graph it is the vertical stick from the point to the line, positive above the line and negative below.",
          "A student who practiced 8 hours scored 78. The line $\\hat{y} = 4x + 42$ predicts $4(8) + 42 = 74$, so the residual is $78 - 74 = 4$. Back the other way, observed = predicted + residual.",
        ],
        illustration: "scene-residual-sticks",
      },
      {
        title: "Residual plots show what a line missed",
        paragraphs: [
          "A residual plot puts each residual above its $x$. If the residuals scatter above and below 0 with no pattern, the line has captured the trend.",
          "Stopping distance grows faster than speed. A line fit to it leaves residuals that are positive, then negative, then positive: a curve. That pattern says a curved model would fit better.",
        ],
        illustration: "scene-residual-plot-curve",
      },
      {
        title: "Correlation measures linear strength",
        paragraphs: [
          "The correlation coefficient $r$ is between −1 and 1. Its sign gives the direction of a linear trend; its distance from 0 gives the strength. Points close to a rising line have $r$ near 1; a loose cloud has $r$ nearer 0. So $r = -0.9$ is stronger than $r = 0.7$.",
          "Pull every point halfway to the line and the cloud tightens: $r$ moves toward 1.",
        ],
        illustration: "scene-correlation-tighten",
      },
      {
        title: "Correlation sees only lines",
        paragraphs: [
          "Temperatures that rise through the morning and fall in the evening follow a clear curve, yet $r$ is near 0, because no single straight line fits a rise and a fall.",
          "A value of $r$ near 0 means no linear association, not no association.",
        ],
        illustration: "scene-curve-near-zero-r",
      },
    ],
    workedExample: {
      prompt:
        "The least-squares line is $\\hat{y} = 4x + 42$. A student not in the data practiced 3 hours, and the residual for this student is −5. What did the student score?",
      steps: [
        "Predicted: $4(3) + 42 = 54$.",
        "Observed = predicted + residual: $54 + (-5) = 49$.",
      ],
      answer: "49",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A signed residual is observed $y$ minus predicted $\\hat y$; positive values lie above the fitted line and negative values below it.",
          "For paired numerical data with variation in both variables, Pearson's correlation $r$ lies from $-1$ to $1$. Its sign gives the direction of a linear trend, and $|r|$ measures linear strength. A curved residual pattern can reveal structure that $r$ misses; $r$ near zero does not rule out a nonlinear relationship.",
        ],
      },
    ],
    pitfalls: [
      "Residual = observed − predicted, not the other way around.",
      "Strength is the distance of $r$ from 0; the sign is only the direction.",
      "A residual plot with a curve means a line is the wrong model, even when $r$ is large.",
    ],
    parentGuide:
      "Measure the height and the arm span of several people and plot the pairs. Estimate $r$ from the picture, draw a line by eye, and find who is farthest from it.",
  },
  {
    id: "causal-claims",
    title: "Association is not causation",
    summary:
      "A pattern between two quantities does not by itself show that one causes the other. Random assignment can support a causal comparison when the study is well run.",
    templateIds: ["causal-claim-choice", "study-design-choice"],
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
          "In a beach town, days with more ice cream sold also have more sunburns. Ice cream does not cause sunburn: hot, sunny days bring people to the beach, where they both buy ice cream and get sunburned. The weather is a lurking variable, a third variable that affects both.",
          "Sometimes cause and effect run the other way. Cities with more police officers have more crime, but more crime is a reason to hire more officers. That is reverse causation.",
          "In an observational study, researchers only record what already happens, so either explanation could produce the association.",
        ],
        illustration: "scene-lurking-weather",
      },
      {
        title: "Experiments: assign the treatment at random",
        paragraphs: [
          "In an experiment, the researcher decides who gets the treatment. Random assignment, by a coin flip or a random list, makes the groups alike on average in everything else: age, effort, health and anything no one thought to measure.",
          "A difference in outcomes can then support a causal conclusion, after considering chance variation and whether the groups were treated comparably apart from the assigned treatment. Compare percents when group sizes differ: 90% of the app group passed, against 20% of the others.",
          "Without random assignment, people who chose the treatment may differ in other ways, so the same difference shows association only.",
        ],
        illustration: "scene-experiment-bars",
      },
    ],
    workedExample: {
      prompt:
        "A researcher wants to know whether a vocabulary app raises quiz scores. Which design can show this?",
      steps: [
        "Comparing students who already use the app with those who do not is observational: the users may study more in general.",
        "Giving everyone the app and comparing before and after has no comparison group.",
        "Randomly assign students to use the app or study as usual, then compare their scores. Randomization helps balance other influences on average, though chance differences can remain.",
      ],
      answer:
        "Randomly assign students to use the app or to study as usual, then compare their quiz scores.",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "An association in observed data can come from a lurking variable or reverse causation, so it does not show a cause.",
          "A well-conducted experiment with random treatment assignment and a comparison group can support a causal inference about its participants. Random assignment balances other influences on average, but chance differences remain possible; a difference alone does not establish a cause without considering uncertainty and study conduct.",
        ],
      },
    ],
    pitfalls: [
      "An association in observed data does not show which variable causes which, or whether either does.",
      "“Correlation is not causation” does not mean the variables are unrelated.",
      "Look for random assignment, a comparison group, and an assessment of chance variation before making a causal claim from an experiment.",
    ],
    parentGuide:
      "Find a headline that claims one thing causes another. Ask whether the study assigned the cause at random, and think of a lurking variable that could explain the result instead.",
  },
];

export const algebraStatisticsMethods: Record<string, ProblemMethod> = {
  "outlier-center-shift": {
    goal: "Decide how an outlier changes the mean and the median.",
    terms: [
      ["mean", "The total of the values divided by how many there are."],
      [
        "median",
        "The middle value of the ordered data, or the average of the two middle values.",
      ],
      [
        "outlier",
        "A value far from the rest: beyond 1.5 IQRs past a quartile.",
      ],
    ],
    method: [
      "Find the mean before and after: total ÷ count, changing the total and, if a value joins or leaves, the count.",
      "Order the values and find the middle before and after.",
      "Compare the two changes.",
    ],
    watch:
      "The mean moves with every value; the median moves only when the middle of the order moves.",
  },
  "skewed-box-compare": {
    goal: "Compare two box plots by shape, center and spread.",
    terms: [
      ["IQR", "Interquartile range: $Q_3 - Q_1$, the width of the box."],
      [
        "skewed right",
        "A long tail toward higher values: a long right whisker and right part of the box.",
      ],
    ],
    method: [
      "For each plot, compare the two whiskers and the two parts of the box on either side of the median.",
      "The longer side is the tail: skewed right, skewed left, or roughly symmetric if they match.",
      "For skewed data compare medians and IQRs; read the range from the whisker ends and the IQR from the box.",
    ],
    watch:
      "A long whisker makes a large range, not a large IQR: the IQR is only the box.",
  },
  "relative-frequency-percent": {
    goal: "Find a joint, marginal or conditional percent from a two-way table.",
    terms: [
      ["joint", "One cell out of everyone surveyed."],
      ["marginal", "A row or column total out of everyone surveyed."],
      ["conditional", "One cell out of its own row or column total."],
    ],
    method: [
      "Name the whole: everyone surveyed, or only the group after “of”.",
      "Find the count of the part inside that whole.",
      "Divide the part by the whole and write it as a percent.",
    ],
    watch:
      "“Of the athletes” means divide by the athletes' row total, not by everyone.",
  },
  "conditional-frequency-choice": {
    goal: "Read conditional percents and use them to judge association.",
    method: [
      "For a percent, find the group after “of”: its row or column total is the divisor.",
      "For association, find the percent within each row who give the same answer.",
      "Large differences between rows mean association; nearly equal percents mean none.",
    ],
    watch:
      "Joint percents and counts reflect group sizes; compare percents within each row.",
  },
  "regression-coefficient-meaning": {
    goal: "Interpret the slope and intercept of a least-squares line in context.",
    terms: [
      [
        "slope",
        "The predicted change in $y$ for each 1 more of $x$, in units of $y$ per unit of $x$.",
      ],
      ["$y$-intercept", "The predicted $y$ when $x = 0$."],
    ],
    method: [
      "The slope is the coefficient of $x$: say it as “each additional unit of $x$ goes with a predicted $y$ that much higher or lower”.",
      "The intercept is the prediction at $x = 0$; it has a meaning only when $x = 0$ is a sensible value inside the data.",
    ],
    watch:
      "Do not swap the variables, and do not read the slope as the value at $x = 0$.",
  },
  "regression-line-predict": {
    goal: "Use a least-squares line to predict.",
    method: [
      "To predict, substitute the input for $x$ and evaluate.",
      "For the difference between two predictions, multiply the slope by the difference in inputs.",
      "For the input that gives a prediction, set the equation equal to it and solve for $x$.",
    ],
    watch:
      "Multiply before adding the intercept, and keep the sign of a negative slope.",
  },
  "residual-value": {
    goal: "Find a residual, or an observed value from its residual.",
    terms: [["residual", "Observed $y$ minus predicted $\\hat{y}$."]],
    method: [
      "Find the predicted value by substituting $x$ into the line.",
      "Residual = observed − predicted; observed = predicted + residual.",
    ],
    watch:
      "Subtract in the order observed − predicted: a point below the line has a negative residual.",
  },
  "correlation-choice": {
    goal: "Interpret correlation and residual plots.",
    terms: [
      [
        "correlation coefficient",
        "$r$, from −1 to 1: the direction and strength of a linear association.",
      ],
    ],
    method: [
      "Direction: points rising left to right give a positive $r$, falling give a negative $r$.",
      "Strength: the closer the points hug a line, the closer $r$ is to −1 or 1.",
      "In a residual plot, a curve means a line is the wrong model; no pattern means it fits.",
    ],
    watch:
      "Strength is the distance of $r$ from 0, and $r$ near 0 rules out only a linear association.",
  },
  "causal-claim-choice": {
    goal: "Judge what an observed association can and cannot show.",
    terms: [
      [
        "lurking variable",
        "A third variable that affects both variables in an association.",
      ],
      ["reverse causation", "The second variable causing the first."],
    ],
    method: [
      "Ask how the data were collected: observed, or assigned at random?",
      "For observed data, look for a lurking variable or for cause and effect running backward.",
      "Conclude association, not causation.",
    ],
    watch: "Not showing a cause is not the same as showing no relationship.",
  },
  "study-design-choice": {
    goal: "Choose and read study designs.",
    terms: [
      ["experiment", "A study in which the researcher assigns the treatment."],
      [
        "observational study",
        "A study that only records what subjects already do.",
      ],
    ],
    method: [
      "Find who decided which subjects got the treatment: the researcher at random, or the subjects themselves.",
      "Random assignment with a comparison group can show cause and effect; observation shows association.",
      "Compare outcomes as percents of each group.",
    ],
    watch:
      "A comparison of volunteers, or a before-and-after test with no comparison group, cannot show a cause.",
  },
};

export const algebraStatisticsPrinciples: Record<string, string> = {
  "outlier-center-shift":
    "Replacing one of $n$ values changes the mean by the replacement difference divided by $n$; the median's change depends on the new ordering.",
  "skewed-box-compare":
    "For skewed data, the median describes the ordered center and the IQR the middle half; extreme values can affect the mean, standard deviation, and range.",
  "relative-frequency-percent":
    "A percent from a two-way table is a part over a whole, and the question's “of” names the whole.",
  "conditional-frequency-choice":
    "Compare the same outcome's conditional proportions across groups with nonzero totals; different proportions show association in the observed data.",
  "regression-coefficient-meaning":
    "A fitted slope is a predicted rate of change in context, and the intercept is the prediction at $x = 0$.",
  "regression-line-predict":
    "A least-squares line predicts $y$ by substituting $x$; predictions change by the slope for each 1 more of $x$.",
  "residual-value":
    "A signed residual is observed $y$ minus predicted $\\hat y$, positive above the fitted line and negative below it.",
  "correlation-choice":
    "For paired numerical data varying in both coordinates, correlation $r$ lies in $[-1,1]$ and measures linear direction and strength; a residual plot can reveal a missed curve.",
  "causal-claim-choice":
    "An association in observed data can come from a lurking variable or reverse causation, so it does not show a cause.",
  "study-design-choice":
    "A well-conducted randomized comparison can support a causal inference about its participants; chance differences and study conduct still matter.",
};
