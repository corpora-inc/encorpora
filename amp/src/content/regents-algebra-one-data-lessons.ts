import type { Lesson } from "./lessons";
import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsAlgebraOneDataMethods: Record<string, ProblemMethod> = {
  "exponential-initial-value": {
    goal: "Read the starting value of an exponential model, including when the exponent is shifted.",
    senses: {
      factor: "factor-number",
      model: "model",
      product: "product-multiply",
    },
    intuition:
      "An exponent is the small raised number that says how many times to multiply: $0.5^2$ means $0.5 \\times 0.5 = 0.25$. Any nonzero number to the power 0 is 1. An exponential model is a formula that multiplies by the same number again and again. That number is called the factor. For example, $C(t) = 320(0.5)^t$ starts with 320 and multiplies by the factor 0.5 for each 1 that $t$ goes up. The initial value is the value when $t = 0$. If the exponent is $t + 2$, then at $t = 0$ it is 2, not 0.",
    terms: ["initial-value", "growth-factor"],
    method: [
      "Put $t = 0$ into the exponent and work out what the exponent becomes.",
      "Raise the factor to that power. It is 1 when the exponent is 0.",
      "Multiply by the number in front. That product is the initial value.",
    ],
    watch:
      "When a number is added to $t$ in the exponent, as in $t + 2$, work out the power at $t = 0$ before multiplying by the number in front.",
  },
  "exponential-decay-table": {
    goal: "Tell exponential decay from growth, linear change and other patterns in a list of values at equal steps.",
    senses: {
      difference: "difference-subtract",
      differences: "difference-subtract",
      change: "change",
      decreasing: "decreasing",
    },
    noLink: ["third"],
    intuition:
      "Exponential decay means the values are multiplied by the same number at each equal step, and that number is between 0 and 1. For example, 81, 27, 9, 3 is multiplied by $\\frac{1}{3}$ each time. A quotient is the answer when you divide one number by another. A linear pattern instead adds or subtracts the same amount at each step.",
    terms: [
      [
        "common-ratio",
        "In a table, it is the same quotient of each value and the one before it.",
      ],
      "exponential-decay",
    ],
    method: [
      "Divide each value by the one before it.",
      "If the quotients are all equal and between 0 and 1, the list shows exponential decay.",
      "If the differences (later value minus earlier value) are all equal instead, the list is linear.",
    ],
    watch:
      "A list that gets smaller is not always decay. Check that each quotient is the same.",
  },
  "exponential-passes-linear": {
    goal: "Find the first whole input at which an exponential function exceeds a linear function.",
    senses: {
      rules: "rule",
      increasing: "increasing",
      whole: "whole",
      factor: "factor-number",
      difference: "difference-subtract",
      changes: "change",
    },
    intuition:
      "$f(x)$, read “$f$ of $x$”, is the value of function $f$ at input $x$. A linear function such as $g(x) = 6x + 14$ adds the same amount for each step in $x$. An exponential function is a function that multiplies by the same number at each step, such as $f(x) = 2(1.8)^x$. That number is called the factor. With a positive starting value and a factor greater than 1, the exponential gains more and more each step. So it passes the line eventually, even if the line starts ahead. $f(x) > g(x)$ means $f(x)$ is greater than $g(x)$.",
    terms: ["exponential-function", "linear-function"],
    method: [
      "Make a table of $f(x)$ and $g(x)$ for $x = 0, 1, 2, \\dots$",
      "Find the first row where $f(x) > g(x)$.",
      "Check the row before it, where $f(x)$ should be less than or equal to $g(x)$.",
    ],
    watch:
      "Look for the first input where the exponential is greater, not equal. Keep all decimal places when comparing.",
  },
  "two-way-share": {
    goal: "Choose the right total to divide by in a two-way table and round the percent.",
    senses: { whole: "whole", part: "part" },
    intuition:
      "A two-way table counts one group of people two ways at once, such as grade and whether they have a job. A percent is a part out of a whole, so first name the whole. A joint percent is a cell count divided by the table total, times 100, as in “percent of everyone”. “Percent of the juniors” uses the juniors' row total. “Of those who have a job” uses that column's total.",
    terms: ["joint-relative-frequency", "conditional-relative-frequency"],
    method: [
      "Find the count of the people the question asks about.",
      "Name the whole: the table total, a row total or a column total.",
      "Divide, multiply by 100 and round to the nearest percent.",
    ],
    watch:
      "The same cell gives different percents with different totals. Name the whole before dividing.",
  },
  "quartile-list": {
    goal: "Find the upper or lower quartile of a list by ordering the data and taking the median of a half.",
    senses: {
      mean: "mean-average",
      average: "mean-average",
      quarter: "fourth",
      "more than": "more-than",
    },
    intuition:
      "Data are numbers or facts someone collected, such as test scores. The median is the middle value once the data are in order. It splits the ordered data into a lower half and an upper half. The lower quartile is the median of the lower half, written $Q_1$. The upper quartile is the median of the upper half, written $Q_3$. In a half with an even number of values, the median is the mean of the two middle values: add them and divide by 2.",
    terms: ["quartile", "median"],
    method: [
      "Order the data from least to greatest, keeping repeated values.",
      "Split the ordered list into two equal halves.",
      "Take the median of the upper half for $Q_3$, or of the lower half for $Q_1$.",
    ],
    watch:
      "Order the data first, and keep repeats. In a half with an even count, average the two middle values.",
  },
  "average-rate-table-rounded": {
    goal: "Compute an average rate of change from two rows of a table and round as asked.",
    senses: {
      change: "change",
      changes: "change",
      unit: "unit",
      interval: "interval",
      difference: "difference-subtract",
      decreasing: "decreasing",
      average: "mean-average",
    },
    noLink: ["population"],
    intuition:
      "An average rate of change tells how much an amount changes for each 1 unit of the input, such as people per year. On a graph, it is the slope, the steepness, of the line through the two points. Find it from two rows: the change in the amount divided by the change in the input. The rows of a table do not have to be evenly spaced, so use the actual input values.",
    terms: ["average-rate-of-change", "interval"],
    method: [
      "Pick the two rows at the ends of the stretch the question names.",
      "Subtract the amounts, and subtract the inputs in the same order.",
      "Divide, then round to the place asked for. Keep the sign.",
    ],
    watch:
      "Divide by the difference of the inputs, such as years, not by the number of rows. An amount that goes down has a negative rate.",
  },
  "correlation-causation-choice": {
    goal: "Decide the direction of a correlation and whether it shows that one quantity causes the other.",
    senses: { change: "change" },
    noLink: ["third", "factor", "opposite"],
    intuition:
      "A correlation is a pattern of two amounts changing together. It is positive when they rise together. It is negative when one rises as the other falls. Causation means a change in one actually produces the change in the other. A third thing can make two amounts move together without either causing the other.",
    terms: ["correlation", "causation"],
    method: [
      "Decide whether the amounts rise together, or one rises as the other falls.",
      "Ask whether one could cause the other, or whether a third thing drives both.",
      "Choose the statement that matches both answers.",
    ],
    watch:
      "A strong correlation alone does not prove a cause. Ask what else could make both amounts change.",
  },
  "budget-whole-items": {
    goal: "Find the greatest whole number of items affordable after a fixed cost.",
    noLink: ["whole", "part", "multiple"],
    intuition:
      "A fixed cost is paid once, whatever you buy, such as an entry fee. Take it off the budget first. The money left buys items, and you cannot buy part of an item. A whole number is one of 0, 1, 2, 3 and so on. So the answer is the number of whole times the price fits into the money left. $6.16n \\le 97.93$ means $6.16n$ is less than or equal to 97.93.",
    terms: [
      "fixed-cost",
      [
        "whole-number",
        "Here, the largest whole number that does not go over the limit.",
      ],
    ],
    method: [
      "Subtract the fixed cost from the budget.",
      "Divide the money left by the price of one item.",
      "Round down to a whole number. Rounding up would go over the budget.",
    ],
    watch:
      "Round down, not to the nearest whole number. If the price fits exactly, that many items can be bought.",
  },
  "abs-equals-linear-unique": {
    goal: "Solve an equation that sets an absolute-value expression equal to a linear expression, checking each case.",
    senses: {
      opposite: "opposite-number",
      side: "side-of-equation",
      rules: "rule",
    },
    intuition:
      "The absolute value of a number is its distance from 0, written with bars: $|-3| = 3$ and $|3| = 3$. The opposite is the same number with the other sign: the opposite of 3 is −3. An equation has two sides: the expressions left and right of the = sign. So $|x - 6|$ equals $x - 6$ when $x - 6$ is 0 or positive, and its opposite, $-(x - 6)$, when $x - 6$ is negative. An equation with an absolute value splits into these two cases. Each case's answer must be checked, because it may not fit its case.",
    terms: ["absolute-value", "extraneous-solution"],
    method: [
      "Get the absolute value alone on one side of the equation.",
      "Write the two cases: the inside equals the other side, and the inside equals the opposite of the other side.",
      "Solve both, then put each answer into the original equation to check it.",
    ],
    watch:
      "One case may give an answer that fails the check. Check in the original equation.",
  },
};

export const regentsAlgebraOneDataPrinciples: Record<string, string> = {
  "exponential-initial-value":
    "For $f(t) = a \\cdot b^{t+k}$ with $b > 0$, the initial value is $f(0) = a \\cdot b^{k}$. A growth rate $r$ per step, such as $r = 0.05$ for 5%, multiplies by $1 + r$. A decay rate $r$ multiplies by $1 - r$.",
  "exponential-decay-table":
    "Values $y_0, y_1, y_2, \\dots$ at equally spaced inputs are exponential when each quotient $y_{i+1} \\div y_i$ is the same positive number $b$. They show decay when $0 < b < 1$. They are linear when each difference $y_{i+1} - y_i$ is the same.",
  "exponential-passes-linear":
    "If $a > 0$ and $b > 1$, then $a \\cdot b^x$ eventually becomes greater than any linear function $cx + d$ and stays greater from then on.",
  "two-way-share":
    "The percent of a group is $100 \\times$ (count in the group and category) ÷ (count in the group). The group is the whole table for a joint percent, one row or one column for a conditional percent.",
  "quartile-list":
    "For an ordered data set with an even number $n$ of values, the lower half is the lowest $\\frac{n}{2}$ values and the upper half is the highest $\\frac{n}{2}$. $Q_1$ is the median of the lower half and $Q_3$ is the median of the upper half.",
  "average-rate-table-rounded":
    "The average rate of change of $f$ from $x = a$ to $x = b$ is $\\frac{f(b) - f(a)}{b - a}$. It equals the slope of the line through $(a, f(a))$ and $(b, f(b))$.",
  "correlation-causation-choice":
    "A correlation is positive when larger values of one amount tend to go with larger values of the other, and negative when they go with smaller values. A correlation alone does not show a cause: a third variable may affect both.",
  "budget-whole-items":
    "With budget $B$, fixed cost $F$ and price $p$ per item, the number $n$ of items must satisfy $F + pn \\le B$, so $n \\le \\frac{B-F}{p}$. The answer is the greatest whole number less than or equal to $\\frac{B-F}{p}$.",
  "abs-equals-linear-unique":
    "$|u| = v$ needs $v \\ge 0$, and then $u = v$ or $u = -v$. For $k|x-a| + b = cx + d$ with $|c| > k > 0$, the two sides' graphs cross exactly once, so there is exactly one solution.",
};
export const regentsAlgebraOneDataLessons: Lesson[] = [
  {
    ...chainLesson({
      id: "regents-exponential-models",
      title: "Exponential models: starting value, decay tables and overtaking",
      summary:
        "An exponential model is a formula that multiplies by the same number, called the factor, at each step. For example, 90, 135, 202.5 multiplies by 1.5 each time. The starting value is the value at step 0. If the factor is between 0 and 1, the values shrink: this is called decay. If the factor is greater than 1 and the start is positive, the values grow faster and faster, and they eventually pass any straight line.",
      templateIds: [
        "exponential-initial-value",
        "exponential-decay-table",
        "exponential-passes-linear",
      ],
      objectives: [
        "Find the initial value of an exponential model, including one with a shifted exponent.",
        "Recognize exponential decay by a constant quotient between 0 and 1, and compare exponential and linear growth.",
      ],
      openingTitle: "Multiplying again and again",
      opening: [
        "An exponent is a small raised number that says how many times to multiply a number by itself: $1.5^2 = 1.5 \\times 1.5 = 2.25$. Any number other than 0, raised to the power 0, is 1.",
        "An exponential model is written $a \\cdot b^t$, where the dot means times. Here $t$ counts the steps, $a$ is the starting amount and $b$ is the factor, a positive number multiplied in at each step. At $t = 0$ the power $b^0$ is 1, so the value is $a$. This value at $t = 0$ is called the initial value.",
        "If $b$ is greater than 1 and $a$ is positive, the amount grows. If $b$ is between 0 and 1, it shrinks toward 0. Shrinking this way is called exponential decay.",
        "In a list of values at equal steps, divide each value by the one before it. The result is called a quotient. If every quotient is the same positive number, the list is exponential. A linear list instead adds or subtracts the same amount at each step.",
        "A growing exponential gains more each step, while a line gains the same amount each step. So a growing exponential with a positive start eventually passes any line.",
      ],
      example: {
        prompt:
          "Find the initial value of $P(t)=40(1.5)^{t+2}$. Decide whether the values $81, 54, 36, 24$ show exponential decay. For $f(x)=2(1.5)^x$ and $g(x)=12x+10$, find the least whole number $x$ with $f(x)>g(x)$.",
        steps: [
          "Initial value: put $t = 0$ in, so the exponent is $0 + 2 = 2$. Then $P(0) = 40(1.5)^2 = 40 \\times 2.25 = 90$.",
          "Decay: divide each value by the one before. $54 \\div 81 = \\frac{2}{3}$, $36 \\div 54 = \\frac{2}{3}$ and $24 \\div 36 = \\frac{2}{3}$. Every quotient is the same and between 0 and 1, so yes, this is exponential decay.",
          "Crossing: $f(x)$, read “$f$ of $x$”, is the value of $f$ at $x$, and $f(x) > g(x)$ means $f(x)$ is greater. Try whole numbers in order. At $x = 10$, $f \\approx 115.33$ and $g = 130$, so $f$ is still smaller.",
          "At $x = 11$, $f \\approx 173.00$ and $g = 142$, so $f$ is greater. The least whole number is 11.",
        ],
        answer: "Initial value 90; yes, decay; least whole number 11",
      },
      methodTitle: "Substitute zero, divide neighbours, build a table",
      method: [
        "Initial value: put $t = 0$ in, work out the exponent, and raise the factor to that power. Multiply by the number in front.",
        "Decay: divide each value by the one before. Equal quotients between 0 and 1 mean decay. Equal differences, from adding or subtracting the same amount, mean linear.",
        "Overtaking: make a table of both functions at whole numbers, and find the first row where the exponential is greater.",
      ],
      formalTitle: "Why exponentials eventually win",
      formal: [
        "Take $a > 0$ and $b > 1$. Then $a \\cdot b^t$ multiplies by $b$ at each step, so its increase per step keeps growing. A line's increase per step stays the same. After enough steps, the exponential's increase is larger, and it passes the line.",
        "For $f(t) = a \\cdot b^{t+k}$, the initial value is $f(0) = a \\cdot b^k$.",
      ],
      pitfalls: [
        "The factor $b$ and the initial value play different roles. Do not report $b$ as the starting value.",
        "A list that gets smaller is exponential decay only if every quotient is the same.",
        "Keep decimals when comparing values. Round only at the end.",
      ],
      parentGuide:
        "Ask the learner what the model gives at $t = 0$. Then ask them to divide two pairs of neighbouring values and compare.",
    }),
    senses: {
      model: "model",
      factor: "factor-number",
      multiple: "multiple",
      differences: "difference-subtract",
      decreasing: "decreasing",
    },
    noLink: ["mean"],
  },
  {
    ...chainLesson({
      id: "regents-two-way-share",
      title: "Percents in a two-way table",
      summary:
        "A two-way table counts one group of people two ways at once, such as by grade and by whether they have a job. A percent is a part out of a whole, times 100. So first name the whole: the table total, a row total or a column total. Then divide, multiply by 100 and round.",
      templateIds: ["two-way-share"],
      objectives: [
        "Decide whether a question is about the whole table, a row or a column.",
        "Compute the percent from the correct total and round it.",
      ],
      openingTitle: "A percent needs a whole",
      opening: [
        "A two-way table sorts one group of people two ways, such as by grade and by whether they have a job. Each box inside, called a cell, counts the people who fit both its row and its column.",
        "The totals sit at the ends of each row and column. The bottom corner holds the table total, everyone in the table.",
        "“What percent of all students” uses the table total. “What percent of the juniors” uses the juniors' row total. “Of those who have a job, what percent” uses that column's total. The same cell gives different percents with different wholes.",
      ],
      example: {
        prompt:
          "Of 120 students, 28 juniors have a job and there are 50 juniors in all. What percent of the juniors have a job? What percent of all students are juniors with a job?",
        steps: [
          "Of the juniors: the whole is the 50 juniors. $28 \\div 50 = 0.56$, which is 56%.",
          "Of all students: the whole is all 120 students. $28 \\div 120 \\approx 0.2333$, which is about 23%.",
        ],
        answer: "56% and about 23%",
      },
      methodTitle: "Count, whole, divide, round",
      method: [
        "Find the cell count for the people the question names.",
        "Name the whole: the table total, a row total or a column total.",
        "Divide, multiply by 100 and round to the nearest percent.",
      ],
      formalTitle: "Joint and conditional percents",
      formal: [
        "A joint relative frequency is a cell count divided by the table total. A conditional relative frequency is a cell count divided by the total of its row or of its column.",
        "In one row, the counts divided by that row's total add to 100% when kept exact. The joint percents in one row add only to that row's share of the table total.",
      ],
      pitfalls: [
        "Divide by the total of the group the question names, not always the table total.",
        "Round only after dividing.",
        "A row total counts everyone in that row, across all its answer columns.",
      ],
      parentGuide:
        "Ask the learner to underline the words that name the group, and say which total of the table matches those words.",
    }),
    senses: { whole: "whole", wholes: "whole", sorts: "sort", part: "part" },
  },
  {
    ...chainLesson({
      id: "regents-quartile-list",
      title: "Quartiles of a listed data set",
      summary:
        "Data are numbers or facts someone collected, such as test scores. Quartiles are the values that split ordered data into four parts, each holding about a quarter of the values. Put the values in order. The median, the middle value, splits them into a lower half and an upper half. The lower quartile is the median of the lower half, and the upper quartile is the median of the upper half.",
      templateIds: ["quartile-list"],
      objectives: [
        "Order a data set that has repeated values.",
        "Find the lower and upper quartiles for an even number of values.",
      ],
      openingTitle: "Quarters of the ordered data",
      opening: [
        "Order the data from least to greatest. The median is the middle value. With an even number of values, it is halfway between the two middle values. It splits the data into two equal halves.",
        "The lower quartile, written $Q_1$, is the middle of the lower half. The upper quartile, written $Q_3$, is the middle of the upper half.",
        "When few values repeat, about a quarter of the data lies below the lower quartile, and about a quarter lies above the upper quartile.",
      ],
      example: {
        prompt:
          "Find the upper quartile of $9, 4, 12, 4, 15, 7, 12, 20, 6, 10$.",
        steps: [
          "Order the values, keeping both 4s and both 12s: 4, 4, 6, 7, 9, 10, 12, 12, 15, 20.",
          "There are 10 values, so split them into two halves of 5. The lower half is 4, 4, 6, 7, 9 and the upper half is 10, 12, 12, 15, 20.",
          "The upper quartile is the median of the upper half. That half has 5 values, so its median is the third one, 12.",
        ],
        answer: "$12$",
      },
      methodTitle: "Order, split, middle of a half",
      method: [
        "Order the values and keep every repeat.",
        "Split them into two equal halves.",
        "Take the median of the half you need. If that half has an even count, add its two middle values and divide by 2.",
      ],
      formalTitle: "Quartiles and the interquartile range",
      formal: [
        "The interquartile range is $Q_3 - Q_1$, the spread of the middle half of the data.",
        "Splitting at the median and taking the median of each half is one common rule for quartiles. This practice uses it with an even number of values. Then the median falls between two values, so every value goes cleanly into one half.",
      ],
      pitfalls: [
        "Order the data before splitting.",
        "Count a repeated value each time it appears.",
        "In a half with an even count, add the two middle values and divide by 2.",
      ],
      parentGuide:
        "Ask the learner to cross out values in pairs from both ends of the ordered list and see where the middle is.",
    }),
    senses: { quarter: "fourth", average: "mean-average", parts: "part" },
    noLink: ["rule", "third"],
  },
  {
    ...chainLesson({
      id: "regents-average-rate-table",
      title: "Average rate of change from a table",
      summary:
        "An average rate of change tells how much an amount changes for each 1 unit of the input, such as people per year, across a stretch of a table. Pick two rows. Divide the change in the amount by the change in the input. Use the actual input values, even when the rows are not evenly spaced.",
      templateIds: ["average-rate-table-rounded"],
      objectives: [
        "Compute an average rate of change over a stated stretch of the input.",
        "Round to a whole number or a tenth, and keep the sign.",
      ],
      openingTitle: "Change in output per unit change in input",
      opening: [
        "A table pairs an input, such as a year, with an output, such as a population. The average rate of change between two rows tells how much the output changes for each 1 unit of the input, taken across that stretch.",
        "It is the change in the output divided by the change in the input. On a graph, it is the slope (steepness) of the straight line through the two points.",
        "The rows of a table do not have to be evenly spaced. Use the actual input values, not the number of rows.",
      ],
      example: {
        prompt:
          "A city had 1,500,000 people in 1980 and 1,860,000 in 2020. What is the average rate of change per year?",
        steps: [
          "Find the change in the population, later minus earlier: $1{,}860{,}000 - 1{,}500{,}000 = 360{,}000$ people.",
          "Find the change in time, in the same order: $2020 - 1980 = 40$ years.",
          "Divide to get people per year: $360{,}000 \\div 40 = 9000$. The answer is positive because the population went up.",
        ],
        answer: "$9000$ people per year",
      },
      methodTitle: "Subtract, subtract, divide",
      method: [
        "Pick the rows at the two ends of the stretch the question names.",
        "Find the change in the output and the change in the input, subtracting in the same order.",
        "Divide and round as asked. Keep the sign: an amount that goes down has a negative rate.",
      ],
      formalTitle: "Average rate of change",
      formal: [
        "For a function $f$ from $x = a$ to $x = b$, the average rate of change is $\\frac{f(b) - f(a)}{b - a}$. Here $f(a)$, read “$f$ of $a$”, is the output at input $a$. Subtracting in the opposite order on both top and bottom gives the same value.",
      ],
      pitfalls: [
        "Divide by the difference of the inputs, not the number of rows.",
        "Subtract the outputs and the inputs in the same order.",
        "Round at the end.",
      ],
      parentGuide:
        "Ask the learner whether the sign of the answer matches the table: going up gives a positive rate, going down a negative one.",
    }),
    senses: {
      change: "change",
      changes: "change",
      unit: "unit",
      difference: "difference-subtract",
      decreasing: "decreasing",
      average: "mean-average",
    },
    noLink: ["opposite", "interval", "population"],
  },
  {
    ...chainLesson({
      id: "regents-correlation-causation",
      title: "Correlation and causation",
      summary:
        "A correlation is a pattern of two amounts changing together. It is positive when they rise together, and negative when one rises as the other falls. Causation means one actually produces the other. A correlation alone does not show causation, because a third thing may drive both.",
      templateIds: ["correlation-causation-choice"],
      objectives: [
        "State the direction of a correlation from a description.",
        "Explain why a correlation may not show a cause.",
      ],
      openingTitle: "Two separate questions",
      opening: [
        "First question: when one amount gets larger, does the other tend to get larger or smaller? Larger together is a positive correlation. One larger while the other gets smaller is a negative correlation.",
        "Second question: does a change in one amount actually cause a change in the other, directly or through other steps? That is called causation.",
        "Ice cream sales and sunburns rise together. But ice cream does not cause sunburn. Hot, sunny weather drives both.",
      ],
      example: {
        prompt:
          "Daily ice cream sales and daily sunburns at a beach are measured. Describe the relationship.",
        steps: [
          "Direction: on sunny days both are higher, and on cloudy days both are lower. They rise together, so the correlation is positive.",
          "Cause: buying ice cream does not burn skin, and a sunburn does not make people buy ice cream. The weather drives both, so neither causes the other.",
        ],
        answer: "positive correlation; neither causes the other",
      },
      methodTitle: "Direction, then cause",
      method: [
        "Picture the scatter plot, one dot per day, and decide whether the dots rise or fall from left to right.",
        "Ask whether one amount actually produces the other.",
        "If something else could drive both, the correlation does not show a cause.",
      ],
      formalTitle: "Confounding",
      formal: [
        "A confounding variable is a third thing related to both amounts. It can make them correlated even when neither causes the other.",
        "Showing a cause takes more evidence than a correlation, such as an experiment where the treatment is assigned at random.",
      ],
      pitfalls: [
        "A negative correlation is a relationship. It is not the same as no relationship.",
        "A strong correlation, with the dots close to a line, can happen without either amount causing the other.",
        "A real cause can come with either a positive or a negative correlation.",
      ],
      parentGuide:
        "Ask the learner for a third thing that could explain a pattern between two amounts.",
    }),
    senses: { correlated: "correlation" },
    noLink: ["factor", "third"],
  },
  {
    ...chainLesson({
      id: "regents-budget-whole-items",
      title: "How many items fit a budget",
      summary:
        "A budget is the most money you can spend. A fixed cost, such as an entry fee, is paid once, so take it off first. Divide the money left by the price of one item. You can only buy whole items, so round down.",
      templateIds: ["budget-whole-items"],
      objectives: [
        "Write and solve the inequality for the items bought with the money left after a fixed cost.",
        "Round down to a whole number of items.",
      ],
      openingTitle: "Whole items only",
      opening: [
        "A fixed cost is paid once, no matter how many items you buy. The money left after it is what you can spend on items.",
        "Dividing that money by the price tells how many items it would buy. But you can only buy whole items, so drop any part of an item. That means rounding down.",
        "An inequality is a statement that compares two amounts. The sign $\\le$ means “is less than or equal to”. So $3.50n \\le 65$ says the cost of $n$ tickets is 65 dollars or less.",
      ],
      example: {
        prompt:
          "A group has $85$ dollars. After a $20$ dollar entry fee, tickets cost $3.50$ dollars each. How many tickets can it buy?",
        steps: [
          "Pay the fixed cost first. Money left: $85 - 20 = 65$ dollars.",
          "Let $n$ be the number of tickets. They cost $3.50n$ dollars, which must be 65 or less: $3.50n \\le 65$. Divide both sides by 3.50: $n \\le 18.57\\ldots$",
          "Only whole tickets can be bought, so round down to 18. Check: 18 tickets cost $63$ dollars, which fits, but 19 cost $66.50$ dollars, which does not.",
        ],
        answer: "18 tickets",
      },
      methodTitle: "Subtract, divide, round down",
      method: [
        "Subtract the fixed cost from the budget.",
        "Divide the money left by the price per item.",
        "Round down to a whole number.",
      ],
      formalTitle: "The inequality",
      formal: [
        "With budget $B$, fixed cost $F$ and price $p$ per item, buying $n$ items costs $F + pn$. That must not be more than the budget: $F + pn \\le B$.",
        "Solving gives $n \\le \\frac{B-F}{p}$. The answer is the greatest whole number less than or equal to $\\frac{B-F}{p}$.",
      ],
      pitfalls: [
        "Round down. Rounding up goes over the budget.",
        "Subtract the fixed cost before dividing.",
        "If the price fits an exact whole number of times, that many items can be bought.",
      ],
      parentGuide:
        "Ask the learner to check the answer by finding the total cost for that many items and for one more.",
    }),
    senses: { "more than": "more-than" },
    noLink: ["whole", "part", "multiple", "sides"],
  },
  {
    ...chainLesson({
      id: "regents-abs-equals-linear",
      title: "An absolute value equal to a linear expression",
      summary:
        "The absolute value of a number is its distance from 0, written with bars: $|-4| = 4$ and $|4| = 4$. An equation with an absolute value splits into two cases: the inside is 0 or positive, or the inside is negative. Solve each case. Then check each answer in the original equation, because a case can give an answer that does not work.",
      templateIds: ["abs-equals-linear-unique"],
      objectives: [
        "Write the two cases of an absolute-value equation.",
        "Check each case's solution in the original equation.",
      ],
      openingTitle: "Two cases, then check",
      opening: [
        "The absolute value of a number is its distance from 0, so it is never negative. We write it with bars: $|-4| = 4$ and $|4| = 4$.",
        "For an expression $u$, $|u|$ equals $u$ when $u$ is 0 or positive. The opposite is the same number with the other sign: the opposite of 4 is −4. So $|u|$ equals $-u$, the opposite of $u$, when $u$ is negative. So an equation with an absolute value splits into two equations, one for each case.",
        "Solving a case can give a number that does not belong to that case. A solution is a value that makes the equation true. So check every answer in the original equation.",
      ],
      example: {
        prompt: "Solve $|x-2|+1=2x-7$.",
        steps: [
          "Get the absolute value alone. Subtract 1 from both sides: $|x - 2| = 2x - 8$.",
          "Case 1, the inside is 0 or positive: $x - 2 = 2x - 8$. Subtract $x$ from both sides and add 8: $x = 6$.",
          "Case 2, the inside is negative: $x - 2 = -(2x - 8) = -2x + 8$. Add $2x$ and 2 to both sides: $3x = 10$, so $x = \\frac{10}{3}$.",
          "Check $x = 6$: the left side is $|4| + 1 = 5$ and the right side is $12 - 7 = 5$. They match.",
          "Check $x = \\frac{10}{3}$: the left side is $\\frac{4}{3} + 1 = \\frac{7}{3}$ and the right side is $\\frac{20}{3} - 7 = -\\frac{1}{3}$. They do not match. Only 6 works.",
        ],
        answer: "$x=6$",
      },
      methodTitle: "Isolate, split, check",
      method: [
        "Get the absolute value alone on one side.",
        "Write $u$ for the inside and $v$ for the other side. Solve $u = v$ and $u = -v$.",
        "Put each answer into the original equation to check it.",
      ],
      formalTitle: "Why only one solution",
      formal: [
        "$|u| = v$ needs $v \\ge 0$, where $\\ge$ means is greater than or equal to. The graph of an absolute value has two straight arms that meet at a corner point.",
        "When the line is steeper than both arms, the gap between the two sides only goes up, or only goes down. So the graphs cross exactly once, and the equation has one solution.",
      ],
      pitfalls: [
        "Do not skip the check. A case can produce a false solution.",
        "Get the absolute value alone before splitting into cases.",
        "In the negative case, take the opposite of the whole other side, not just one part of it.",
      ],
      parentGuide:
        "Ask the learner to sketch the absolute-value graph, with its two arms, and the line, and see where they cross.",
    }),
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      opposite: "opposite-number",
      difference: "difference-subtract",
      increasing: "increasing",
      decreasing: "decreasing",
      change: "change",
    },
    noLink: ["whole", "term", "part"],
  },
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
