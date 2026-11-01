import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsAlgebraOneDataMethods: Record<string, ProblemMethod> = {
  "exponential-initial-value": {
    goal: "Read the starting value of an exponential model, including when the exponent is shifted.",
    intuition:
      "In $a\\cdot b^t$, the number $a$ is the value when $t=0$, because $b^0=1$. The factor $b$ says what happens at each step. If the exponent is $t+2$, the model has already run two steps at $t=0$.",
    terms: ["initial-value", "growth-factor"],
    method: [
      "Substitute $t=0$ into the exponent.",
      "Evaluate the factor raised to that power; it is 1 when the exponent is 0.",
      "Multiply by the number in front. A percent rate $r$ gives the factor $1+r$ for growth and $1-r$ for decay.",
    ],
    watch:
      "The factor and the rate are not the initial value. When the exponent is not exactly $t$, the number in front is not the starting value.",
  },
  "exponential-decay-table": {
    goal: "Tell exponential decay from growth, linear change and other patterns in a list of values at equal steps.",
    intuition:
      "Exponential change multiplies by the same number at each step. For decay that number is between 0 and 1, so the values shrink by a larger amount at first and by smaller amounts later. A linear pattern subtracts the same amount instead.",
    terms: [
      [
        "common-ratio",
        "In a table, it is the same quotient of each value and the one before it.",
      ],
      "exponential-decay",
    ],
    method: [
      "Divide each value by the one before it.",
      "If the quotients are all equal and less than 1, it is exponential decay.",
      "If the differences are all equal, it is linear; if neither is constant, it is neither.",
    ],
    watch:
      "A decreasing list is not automatically decay. Check the ratios, not only the direction.",
  },
  "exponential-passes-linear": {
    goal: "Find the first whole input at which an exponential function exceeds a linear function.",
    intuition:
      "A linear function adds the same amount each step; an exponential multiplies by the same factor. Even if the line is ahead at first, the exponential eventually overtakes it. Evaluating both at successive inputs shows where.",
    terms: ["exponential-function", "linear-function"],
    method: [
      "Make a table of $f(x)$ and $g(x)$ for increasing whole $x$.",
      "Find the first row where $f(x)>g(x)$.",
      "Check the row before it to confirm $f(x)\\le g(x)$ there.",
    ],
    watch:
      "Compare with strict inequality: the first input where the exponential is greater, not equal. Keep all decimal places when comparing.",
  },
  "two-way-share": {
    goal: "Choose the right total to divide by in a two-way table and round the percent.",
    intuition:
      "A percent is a part out of a whole, so the first step is naming the whole. 'Percent of everyone' uses the table total. 'Percent of the juniors' uses the junior row total. 'Of those who have a job' uses that column total.",
    terms: ["joint-relative-frequency", "conditional-relative-frequency"],
    method: [
      "Find the count of the group in the question.",
      "Name the whole: the table total, a row total or a column total.",
      "Divide, multiply by 100 and round to the nearest percent.",
    ],
    watch:
      "The same cell gives different percents with different totals, so name the whole before dividing.",
  },
  "quartile-list": {
    goal: "Find the upper or lower quartile of a list by ordering the data and taking the median of a half.",
    intuition:
      "The median splits ordered data into two halves. The lower quartile is the middle of the lower half and the upper quartile is the middle of the upper half. Each quartile marks a quarter of the data.",
    terms: ["quartile", "median"],
    method: [
      "Order the data from least to greatest, keeping repeated values.",
      "Split the ordered list into two equal halves.",
      "Take the median of the upper half for $Q_3$ or of the lower half for $Q_1$.",
    ],
    watch:
      "Order the data first, and keep repeats. With an even number of values in a half, average the two middle ones.",
  },
  "average-rate-table-rounded": {
    goal: "Compute an average rate of change from two rows of a table and round as asked.",
    intuition:
      "An average rate of change is how much the quantity changes per unit of the input, over an interval. It is the slope of the line through the two points, even when the table rows are not evenly spaced.",
    terms: ["average-rate-of-change", "interval"],
    method: [
      "Pick the two rows at the ends of the interval.",
      "Subtract the outputs and subtract the inputs in the same order.",
      "Divide and round to the stated place, keeping the sign.",
    ],
    watch:
      "Divide by the difference of the years, not the number of rows. A decreasing quantity has a negative rate.",
  },
  "correlation-causation-choice": {
    goal: "Decide the direction of a correlation and whether it shows that one quantity causes the other.",
    intuition:
      "Two quantities have a positive correlation when they rise together and a negative correlation when one rises as the other falls. Causation means one change produces the other. A third factor can make two quantities move together without either causing the other.",
    terms: ["correlation", "causation"],
    method: [
      "Decide whether the quantities rise together or move in opposite directions.",
      "Ask whether one could directly produce the other, or whether a third factor drives both.",
      "Choose the statement that matches both answers.",
    ],
    watch:
      "A strong correlation does not by itself prove cause. Ask what else could make both quantities change.",
  },
  "budget-whole-items": {
    goal: "Find the greatest whole number of items affordable after a fixed cost.",
    intuition:
      "A fixed cost comes off the budget first. What is left buys items one at a time, and you cannot buy part of an item, so the answer is the whole number of times the price fits into what is left.",
    terms: [
      "fixed-cost",
      [
        "whole-number",
        "Here, the largest whole number that does not go over the limit.",
      ],
    ],
    method: [
      "Subtract the fixed cost from the budget.",
      "Divide what is left by the price of one item.",
      "Round down to a whole number; rounding up would go over budget.",
    ],
    watch:
      "Round down, not to the nearest whole number. If the amount left is exactly a multiple of the price, that many items fit.",
  },
  "abs-equals-linear-unique": {
    goal: "Solve an equation that sets an absolute-value expression equal to a linear expression, checking each case.",
    intuition:
      "The absolute value of an expression equals the expression when it is positive, and its opposite when it is negative. So an equation with an absolute value splits into two cases, and any solution must be checked against the case's condition.",
    terms: ["absolute-value", "extraneous-solution"],
    method: [
      "Isolate the absolute value expression on one side.",
      "Write the two equations: expression equals the other side, and its opposite equals the other side.",
      "Solve both and substitute each answer into the original equation.",
    ],
    watch:
      "One case may give a number that fails the check. Substitute into the original, not into a derived equation.",
  },
};

export const regentsAlgebraOneDataPrinciples: Record<string, string> = {
  "exponential-initial-value":
    "For $f(t)=a\\,b^{t+k}$ the initial value is $f(0)=a\\,b^{k}$, which equals $a$ exactly when $k=0$. A growth of rate $r$ per step multiplies by $1+r$ and a decay of rate $r$ multiplies by $1-r$.",
  "exponential-decay-table":
    "Values $y_0,y_1,y_2,\\dots$ at equally spaced inputs are exponential when $y_{i+1}/y_i$ is the same $b$ for every $i$, decaying when $0<b<1$. They are linear when $y_{i+1}-y_i$ is constant.",
  "exponential-passes-linear":
    "If $b>1$ and $a>0$, then $a\\,b^x$ eventually exceeds any linear function $cx+d$. Once $f-g$ is positive and increasing it stays positive; for a convex $f$ and linear $g$ the difference changes sign from negative to positive at most once for $x\\ge x_0$ where it is increasing.",
  "two-way-share":
    "The percent of a group is $100\\times\\frac{\\text{count in the group and category}}{\\text{count in the group}}$. The group is the whole table for a joint percent, a row for a conditional percent given the row, and a column for a conditional percent given the column.",
  "quartile-list":
    "For an ordered data set of even size, the lower half is the lower $n/2$ values and the upper half the upper $n/2$ values. $Q_1$ is the median of the lower half and $Q_3$ the median of the upper half; the median of an even-sized list is the mean of its two middle values.",
  "average-rate-table-rounded":
    "The average rate of change of $f$ on $[a,b]$ is $\\frac{f(b)-f(a)}{b-a}$. It equals the slope of the line through $(a,f(a))$ and $(b,f(b))$.",
  "correlation-causation-choice":
    "A correlation is positive when larger values of one variable tend to go with larger values of the other, and negative when they go with smaller values. A correlation alone does not establish causation: a confounding variable may influence both.",
  "budget-whole-items":
    "If $B$ is the budget, $F$ the fixed cost and $p$ the price per item, the number $n$ of items bought satisfies $F+pn\\le B$, so $n\\le\\frac{B-F}{p}$. The greatest whole number is $\\left\\lfloor\\frac{B-F}{p}\\right\\rfloor$.",
  "abs-equals-linear-unique":
    "$|u|=v$ requires $v\\ge0$ and $u=v$ or $u=-v$. For $k|x-a|+b=cx+d$ with $|c|>k$, the function $cx+d-(k|x-a|+b)$ is strictly monotone, so there is exactly one solution.",
};

export const regentsAlgebraOneDataLessons = [
  chainLesson({
    id: "regents-exponential-models",
    title: "Exponential models: starting value, decay tables and overtaking",
    summary:
      "Read an initial value, recognize decay in a table, and find when an exponential first passes a line.",
    templateIds: [
      "exponential-initial-value",
      "exponential-decay-table",
      "exponential-passes-linear",
    ],
    objectives: [
      "Find the initial value of an exponential model, including with a shifted exponent.",
      "Recognize exponential decay by a constant ratio less than 1, and compare exponential and linear growth.",
    ],
    openingTitle: "Multiplying again and again",
    opening: [
      "In $a\\cdot b^t$, the number $a$ is the value at $t=0$, because any power of $b$ with exponent 0 is 1. The factor $b$ multiplies the value at each step: if $b$ is greater than 1 the quantity grows, and if $b$ is between 0 and 1 it decays.",
      "A list of values at equally spaced inputs is exponential when each value is the same multiple of the one before it. A line adds the same amount instead, so it is eventually passed by a growing exponential.",
    ],
    example: {
      prompt:
        "Find the initial value of $P(t)=40(1.5)^{t+2}$. Decide whether the values $81, 54, 36, 24$ show exponential decay. For $f(x)=2(1.5)^x$ and $g(x)=12x+10$, find the least whole number $x$ with $f(x)>g(x)$.",
      steps: [
        "Initial value: $P(0)=40(1.5)^2=40\\cdot2.25=90$.",
        "Decay: $54\\div81=\\frac{2}{3}$, $36\\div54=\\frac{2}{3}$ and $24\\div36=\\frac{2}{3}$: a constant ratio less than 1, so yes.",
        "Crossing: at $x=10$, $f\\approx115.33$ and $g=130$, so $f<g$. At $x=11$, $f\\approx173.00$ and $g=142$, so $f>g$. The least whole number is 11.",
      ],
      answer: "Initial value 90; yes, decay; least whole number 11",
    },
    methodTitle: "Substitute zero, divide neighbours, build a table",
    method: [
      "Initial value: substitute $t=0$ and evaluate the factor to that power.",
      "Decay: divide each value by the one before; equal quotients below 1 mean decay, equal differences mean linear.",
      "Overtaking: tabulate both functions and find the first row where the exponential is greater.",
    ],
    formalTitle: "Why exponentials eventually win",
    formal: [
      "An exponential with $b>1$ multiplies by $b$ at each step, so its increase per step grows. A line's increase per step is constant, so after enough steps the exponential increase is larger and the exponential passes the line.",
      "For $f(t)=ab^{t+k}$, $f(0)=ab^k$.",
    ],
    pitfalls: [
      "The factor $b$ is not the initial value.",
      "A decreasing list needs a constant ratio to be exponential decay.",
      "Keep decimals when comparing values; round only at the end.",
    ],
    parentGuide:
      "Ask your learner to say what happens to the number at $t=0$, and to compute two ratios of neighbouring values.",
  }),
  chainLesson({
    id: "regents-two-way-share",
    title: "Percents in a two-way table",
    summary:
      "Name the whole first: the table total, a row total or a column total. Then divide and round.",
    templateIds: ["two-way-share"],
    objectives: [
      "Decide whether a question is about the whole table, a row or a column.",
      "Compute and round the percent from the correct total.",
    ],
    openingTitle: "A percent needs a whole",
    opening: [
      "A two-way table sorts one group of people two ways, such as grade and whether they have a job. Each cell counts the people in both categories.",
      "'What percent of all people...' uses the table total. 'What percent of the juniors...' uses the junior row total. 'Of those who have a job, what percent...' uses the column total. The same cell gives different percents with different wholes.",
    ],
    example: {
      prompt:
        "Of 120 students, 28 juniors have a job and there are 50 juniors in all. What percent of the juniors have a job? What percent of all students are juniors with a job?",
      steps: [
        "Of the juniors: $28\\div50=0.56$, which is 56%.",
        "Of all students: $28\\div120\\approx0.2333$, which is about 23%.",
      ],
      answer: "56% and about 23%",
    },
    methodTitle: "Count, whole, divide, round",
    method: [
      "Find the cell count for the group named.",
      "Name the whole: table total, row total or column total.",
      "Divide, multiply by 100 and round to the nearest percent.",
    ],
    formalTitle: "Joint and conditional percents",
    formal: [
      "A joint relative frequency is a cell count divided by the grand total. A conditional relative frequency divides a cell count by the total of its row or its column.",
      "The conditional percents of one row add to 100%, but the joint percents of one row do not.",
    ],
    pitfalls: [
      "Divide by the total of the group the question names, not always the grand total.",
      "Round only after dividing.",
      "A row total counts both columns.",
    ],
    parentGuide:
      "Ask your learner to underline the words that name the group, and say which total of the table matches those words.",
  }),
  chainLesson({
    id: "regents-quartile-list",
    title: "Quartiles of a listed data set",
    summary:
      "Order the data, split at the median, and take the median of the lower or upper half.",
    templateIds: ["quartile-list"],
    objectives: [
      "Order a data set with repeated values.",
      "Find the lower and upper quartiles for an even number of values.",
    ],
    openingTitle: "Quarters of the ordered data",
    opening: [
      "Order the data from least to greatest, and the median splits it into two equal halves. The lower quartile is the middle of the lower half and the upper quartile is the middle of the upper half. A quarter of the data lies below the lower quartile and a quarter above the upper quartile.",
    ],
    example: {
      prompt: "Find the upper quartile of $9, 4, 12, 4, 15, 7, 12, 20, 6, 10$.",
      steps: [
        "Ordered: $4, 4, 6, 7, 9, 10, 12, 12, 15, 20$.",
        "The median splits the data: lower half $4,4,6,7,9$ and upper half $10,12,12,15,20$.",
        "The median of the upper half is its middle value, 12.",
      ],
      answer: "$12$",
    },
    methodTitle: "Order, split, middle of a half",
    method: [
      "Order the values and keep every repeat.",
      "Split into equal halves.",
      "Take the median of the chosen half; with an even count, average the two middle values.",
    ],
    formalTitle: "Quartiles and the interquartile range",
    formal: [
      "The interquartile range is $Q_3-Q_1$. The method of splitting at the median and taking the median of each half is one common convention; this practice uses it with an even number of values, where the median is not itself a data value that must be assigned to a half.",
    ],
    pitfalls: [
      "Order the data before splitting.",
      "Count repeated values each time they appear.",
      "In a half with an even count, average the two middle values.",
    ],
    parentGuide:
      "Ask your learner to cross out values from both ends of the ordered list in pairs and see where the middle is.",
  }),
  chainLesson({
    id: "regents-average-rate-table",
    title: "Average rate of change from a table",
    summary:
      "Divide the change in the output by the change in the input between two rows, including unevenly spaced rows.",
    templateIds: ["average-rate-table-rounded"],
    objectives: [
      "Compute an average rate of change over a stated interval.",
      "Round to a whole number or a tenth and keep the sign.",
    ],
    openingTitle: "Change in output per unit change in input",
    opening: [
      "The average rate of change over an interval tells how much the quantity changes, on average, for each unit of the input. It is the slope of the line through the two points.",
      "The rows of a table need not be evenly spaced. Use the actual input values, not the number of rows.",
    ],
    example: {
      prompt:
        "A city had 1,500,000 people in 1980 and 1,860,000 in 2020. What is the average rate of change per year?",
      steps: [
        "The change in population is $1{,}860{,}000-1{,}500{,}000=360{,}000$.",
        "The change in time is $2020-1980=40$ years.",
        "$360{,}000\\div40=9000$ people per year.",
      ],
      answer: "$9000$ people per year",
    },
    methodTitle: "Subtract, subtract, divide",
    method: [
      "Pick the rows at the two ends of the interval.",
      "Find the change in the output and the change in the input in the same order.",
      "Divide, round as asked, and keep the sign: a decreasing quantity has a negative rate.",
    ],
    formalTitle: "Average rate of change",
    formal: [
      "For a function $f$ on an interval $[a,b]$ the average rate of change is $\\frac{f(b)-f(a)}{b-a}$. Subtracting in the opposite order in both numerator and denominator gives the same value.",
    ],
    pitfalls: [
      "Divide by the difference of the inputs, not the number of rows.",
      "Subtract both the outputs and the inputs in the same order.",
      "Round at the end.",
    ],
    parentGuide:
      "Ask your learner whether the answer's sign matches what the table does: up, positive; down, negative.",
  }),
  chainLesson({
    id: "regents-correlation-causation",
    title: "Correlation and causation",
    summary:
      "Decide whether two quantities rise together or oppositely, and whether one can be said to cause the other.",
    templateIds: ["correlation-causation-choice"],
    objectives: [
      "State the direction of a correlation from a description.",
      "Explain why a correlation may not show cause.",
    ],
    openingTitle: "Two separate questions",
    opening: [
      "First question: when one quantity gets larger, does the other get larger (positive correlation) or smaller (negative correlation)?",
      "Second question: does one quantity directly produce the other? Ice cream sales and sunburns rise together, but ice cream does not cause sunburn: hot sunny weather drives both.",
    ],
    example: {
      prompt:
        "Daily ice cream sales and daily sunburns at a beach are measured. Describe the relationship.",
      steps: [
        "On sunny days both are higher, so the correlation is positive.",
        "Weather explains both, so neither causes the other.",
      ],
      answer: "positive correlation; neither causes the other",
    },
    methodTitle: "Direction, then cause",
    method: [
      "Imagine the scatter plot and decide whether it rises or falls.",
      "Ask whether one quantity physically produces the other.",
      "If another factor could drive both, correlation does not show cause.",
    ],
    formalTitle: "Confounding",
    formal: [
      "A confounding variable is related to both quantities and can produce a correlation between them. Establishing causation requires evidence beyond correlation, such as a randomized experiment.",
    ],
    pitfalls: [
      "A negative correlation is not the same as no relationship.",
      "A strong correlation can still have no causal link.",
      "A causal link can exist with either sign of correlation.",
    ],
    parentGuide:
      "Ask your learner for a third factor that could explain a pattern between two quantities.",
  }),
  chainLesson({
    id: "regents-budget-whole-items",
    title: "How many items fit a budget",
    summary:
      "Subtract the fixed cost, divide by the price, and round down to a whole number of items.",
    templateIds: ["budget-whole-items"],
    objectives: [
      "Write and solve the inequality for items bought with money left after a fixed cost.",
      "Round down to a whole number of items.",
    ],
    openingTitle: "Whole items only",
    opening: [
      "A fixed cost is paid once. What is left after it is the money available for items. Dividing that by the price shows how many items it would buy, but only whole items can be bought, so partial items are dropped.",
    ],
    example: {
      prompt:
        "A group has $85$ dollars. After a $20$ dollar entry fee, tickets cost $3.50$ dollars each. How many tickets can it buy?",
      steps: [
        "Money left: $85-20=65$ dollars.",
        "$3.50n\\le65$, so $n\\le18.57\\ldots$",
        "Only whole tickets: 18.",
      ],
      answer: "18 tickets",
    },
    methodTitle: "Subtract, divide, round down",
    method: [
      "Subtract the fixed cost from the budget.",
      "Divide by the price per item.",
      "Round down to the nearest whole number.",
    ],
    formalTitle: "The inequality",
    formal: [
      "The total cost is $F+pn$, which must not exceed the budget $B$: $F+pn\\le B$. Solving gives $n\\le\\frac{B-F}{p}$. The greatest whole number satisfying this is the floor of the quotient.",
    ],
    pitfalls: [
      "Round down; rounding up goes over the budget.",
      "Subtract the fixed cost before dividing.",
      "If the quotient is exactly a whole number, that number of items fits.",
    ],
    parentGuide:
      "Ask your learner to check the answer by computing the total cost for the answer and for one more item.",
  }),
  chainLesson({
    id: "regents-abs-equals-linear",
    title: "An absolute value equal to a linear expression",
    summary:
      "Split into two cases, solve each, and check which solution satisfies the original equation.",
    templateIds: ["abs-equals-linear-unique"],
    objectives: [
      "Write the two cases of an absolute-value equation.",
      "Check each case's solution in the original equation.",
    ],
    openingTitle: "Two cases, then check",
    opening: [
      "The absolute value $|u|$ equals $u$ when $u$ is zero or positive, and $-u$ when $u$ is negative. An equation with an absolute value therefore splits into two equations, one for each case.",
      "Solving a case can give a number that does not belong to that case. So check every candidate in the original equation.",
    ],
    example: {
      prompt: "Solve $|x-2|+1=2x-7$.",
      steps: [
        "Isolate: $|x-2|=2x-8$.",
        "Case 1: $x-2=2x-8$ gives $x=6$. Case 2: $x-2=-(2x-8)$ gives $3x=10$, $x=\\frac{10}{3}$.",
        "Check $x=6$: left $|4|+1=5$, right $12-7=5$. Check $x=\\frac{10}{3}$: left $\\frac{4}{3}+1=\\frac{7}{3}$, right $\\frac{20}{3}-7=-\\frac{1}{3}$. Only 6 works.",
      ],
      answer: "$x=6$",
    },
    methodTitle: "Isolate, split, check",
    method: [
      "Isolate the absolute value on one side.",
      "Solve $u=v$ and $u=-v$.",
      "Substitute each solution into the original equation.",
    ],
    formalTitle: "Why only one solution",
    formal: [
      "$|u|=v$ requires $v\\ge0$. When the line is steeper than both sides of the absolute-value graph, the difference of the two sides is strictly increasing or decreasing, so the graphs cross once.",
    ],
    pitfalls: [
      "Do not skip the check; a case can produce a false solution.",
      "Isolate the absolute value before splitting.",
      "Change the sign of the whole expression for the negative case, not just one term.",
    ],
    parentGuide:
      "Ask your learner to sketch the absolute-value graph and the line and see where they cross.",
  }),
];

const fm = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({
  templateId,
  facetId,
  extent: "partial",
  rationale,
});
export const regentsAlgebraOneDataFacetMappings: FacetMapping[] = [
  fm(
    "exponential-initial-value",
    "exponential-models.core",
    "Single choice for the initial value of an exponential model written with a factor, a percent rate or a shifted exponent. Does not assess building a model from a context or graph, or interpreting the factor.",
  ),
  fm(
    "exponential-decay-table",
    "growth-comparison.core",
    "Single choice for which list of values at equal steps shows exponential decay, against growth, linear and accelerating patterns. Does not assess writing the function, graphing, or justifying in words.",
  ),
  fm(
    "exponential-passes-linear",
    "growth-comparison.core",
    "Numeric entry for the least whole input at which an exponential with a decimal base exceeds a stated linear function, from two stated rules. Does not assess graphs, tables given instead of rules, or explanations.",
  ),
  fm(
    "two-way-share",
    "categorical-association.core",
    "Single choice for a joint or conditional percent from a two-way table of counts, rounded to the nearest percent. Does not assess relative frequency tables, association judgments, or marginal percents.",
  ),
  fm(
    "quartile-list",
    "signed-data-summaries.core",
    "Numeric entry for the upper or lower quartile of 8, 10 or 12 listed whole numbers with repeats. Does not assess odd-sized lists, box plots, or the interquartile range.",
  ),
  fm(
    "average-rate-table-rounded",
    "average-rate-change.core",
    "Numeric entry for the average rate of change over an interval of a table with unevenly spaced inputs, rounded to a whole number or a tenth. Does not assess interpreting the rate in a sentence or finding rates from graphs or rules.",
  ),
  fm(
    "correlation-causation-choice",
    "causal-claims.core",
    "Single choice combining the sign of a correlation and the causal status of a described relationship. Does not assess reading scatter plots, correlation coefficients, or writing an explanation.",
  ),
  fm(
    "budget-whole-items",
    "linear-inequalities.core",
    "Numeric entry for the greatest whole number of items after a fixed cost, with prices in dollars and cents. Does not assess writing the inequality, graphing it, or inequalities with variables on both sides.",
  ),
  fm(
    "abs-equals-linear-unique",
    "absolute-value-equations.core",
    "Numeric entry for the single solution of an absolute-value expression equal to a steeper linear expression, with two cases and a check. Does not assess equations with two solutions, graphing, or inequalities.",
  ),
];
