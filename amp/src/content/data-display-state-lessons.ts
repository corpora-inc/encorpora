import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const dataDisplayStateMethods: Record<string, ProblemMethod> = {
  "stem-leaf-construct": {
    goal: "Turn a list of data into an ordered stem-and-leaf plot, or choose the key that fits a plot.",
    senses: {
      stem: "stem",
      stems: "stem",
      leaf: "leaf",
      leaves: "leaf",
      key: "key",
      sorts: "sort",
      units: "unit",
    },
    noLink: ["part"],
    intuition:
      "A stem-and-leaf plot writes each value in two pieces. The leaf is the last digit. The stem is the digit or digits in front of it. For 27, the stem is 2 and the leaf is 7. Each stem gets one row, from the least stem to the greatest. The leaves in a row go in order from least to greatest. A key is a note that shows how to read a row, such as $2 \\mid 7$ means 27. The plot keeps every value, so you can read the data back out.",
    terms: [
      "stem",
      "leaf",
      [
        "key",
        "In a stem-and-leaf plot, the key shows how to read a row: $2 \\mid 4$ means 24 or 2.4.",
      ],
    ],
    method: [
      "Find the least and greatest values. List every stem between them, even a stem that no value uses.",
      "Go through the list once. Write each value's last digit as a leaf in its stem's row. A repeated value gets one leaf each time it appears.",
      "Put the leaves in each row in order from least to greatest.",
      "Count the leaves. The count must equal the number of values. Then write a key.",
    ],
    watch:
      "Keep an empty stem as an empty row, and give a repeated value a leaf each time it appears.",
  },
  "frequency-table-build": {
    goal: "Count whole-number data into a frequency table, from a list, a dot plot or equal-width intervals.",
    intuition:
      "A frequency table lists each value, or each interval of values, and how many times it occurs. The number of times is the frequency. A table turns a long list into counts you can read at once.",
    terms: [
      "frequency",
      ["interval", "Here each interval includes both of its end values."],
      "dot-plot",
    ],
    method: [
      "Make one row for each value in the range, or one row for each interval. Include a row for a value that never occurs, with frequency 0.",
      "Go through the data once. Mark each value as you count it so none is counted twice or skipped.",
      "Add the frequencies. The sum must equal the number of values.",
    ],
    watch:
      "A frequency is a count, not a value multiplied by its count. With intervals, place a value equal to an end value in the interval that includes it; do not move it to the neighboring interval.",
  },
  "circle-graph-read": {
    goal: "Use percent, central angle and count to read and compare the sectors of a circle graph.",
    senses: {
      whole: "whole",
      part: "part",
      parts: "part",
      degrees: "degree-angle",
      quarter: "fourth",
      change: "change",
      center: "center",
    },
    noLink: ["edges"],
    intuition:
      "A circle graph shows how one whole splits into parts. Each part is a sector, a slice of the circle. A sector's central angle is the angle at the center of the circle between its two straight edges, measured in degrees (°). The whole circle is 100% of the data, 360°, and the total count. A sector with 25% of the data takes a quarter of the circle, which is 90°.",
    terms: [
      ["sector", "In a circle graph, each sector stands for one category."],
      "central-angle",
      "percent",
    ],
    method: [
      "Name the whole: all of the data is 100%, 360° and the total count.",
      "Percent to angle: multiply by 3.6, because $360 \\div 100 = 3.6$. Angle to percent: divide by 3.6.",
      "To find a count, find the sector's share of the whole: percent ÷ 100 × total, or angle ÷ 360 × total.",
      "To compare sectors, compare their percents or angles. To find how many more, subtract their counts.",
    ],
    watch:
      "Convert through the whole: 100%, 360° or the total count. A percent is not a number of degrees.",
  },
  "best-display-choice": {
    goal: "Choose the display that fits the kind of data and the question: circle, bar, line, histogram, scatter or dot plot.",
    senses: {
      whole: "whole",
      parts: "part",
      change: "change",
      changes: "change",
      interval: "interval",
      intervals: "interval",
    },
    intuition:
      "A data display is a picture of data. Each kind is built for one job. Ask two things: are the data categories (groups such as kinds of pets) or numbers (such as heights)? And what do you want to see? It may be parts of a whole, a count for each category, change over time, the spread of many numbers, a link between two measures, or every value in a small set.",
    terms: [
      "circle-graph",
      "bar-graph",
      "line-graph",
      "histogram",
      "scatterplot",
      ["dot-plot", "Both show every value, so they suit small data sets."],
      "stem-and-leaf-plot",
    ],
    method: [
      "Decide whether the data are categories or numbers, and whether time matters.",
      "Match the goal. Shares of a whole: circle graph. Comparing categories: bar graph. Change over time: line graph. Spread of many numbers: histogram. Two measures together: scatterplot. Every value of a small set: dot plot.",
      "Check the fit. A display for categories does not show a link between two measures. A display of a whole does not show change over time.",
    ],
    watch:
      "Choose by the goal, not by how many numbers there are. The same numbers can suit different displays for different questions.",
  },
  "return-claim-check": {
    goal: "Compute a simple yearly rate of return from amounts and time, compare investments, and check a stated return.",
    noLink: ["scale"],
    intuition:
      "An investment is money put somewhere to grow. The gain is the ending amount minus the starting amount. The rate of return is the gain as a percent of the starting amount. A gain of 60 dollars is large on 100 dollars and small on 10,000 dollars, so compare rates, not dollars. A yearly rate also uses the time. Here rates are simple: the same percent is added for each year or month, so 1% a month is $1 \\times 12 = 12$% a year.",
    terms: [
      [
        "amount-of-change",
        "The gain is the ending amount minus the starting amount.",
      ],
      "rate-of-return",
      [
        "rate-of-return",
        "The simple yearly rate is the rate of return divided by the number of years, with no compounding.",
      ],
    ],
    method: [
      "Find the gain: ending amount minus starting amount. Divide the gain by the starting amount and write it as a percent. That is the total return.",
      "Divide by the number of years to get the yearly rate. For a time in months, multiply by 12 and divide by the number of months.",
      "Compare the computed rate with the stated rate: they match, or the stated rate is higher or lower.",
    ],
    watch:
      "Put rates on the same time before comparing. A total over several years is not a yearly rate.",
  },
};

export const dataDisplayStatePrinciples: Record<string, string> = {
  "stem-leaf-construct":
    "For whole numbers, the value $10s + \\ell$, with last digit $\\ell$, has leaf $\\ell$ and stem $s$. With one decimal place, the stem is the whole-number part and the leaf is the tenths digit. A correct plot has a row for every stem from the least value's stem to the greatest value's stem, each row in order, and exactly one leaf per data value.",
  "frequency-table-build":
    "The frequency $f_i$ of a value or interval is the number of data values it holds. For $n$ values and $k$ rows, $f_1+f_2+\\dots+f_k=n$. An interval of whole numbers from $a$ to $b$ includes both $a$ and $b$, and equal-width intervals do not overlap.",
  "circle-graph-read":
    "A sector with fraction $p$ of the data has percent $100p$ and central angle $360^\\circ p$. For a total of $N$ values, the sector holds $pN$ values. The sector percents add to $100\\%$ and the central angles add to $360^\\circ$.",
  "best-display-choice":
    "Choose a display by the type of data and the question. Shares of a whole: circle graph. Counts of categories: bar graph. One amount over time: line graph. The spread of many numbers: histogram. Two number measures for each person or thing: scatterplot. Every value of a small set: dot plot or stem-and-leaf plot.",
  "return-claim-check":
    "For a starting amount $P$ and an ending amount $F$ after $t$ years, the total return is $\\frac{F-P}{P}$ and the simple yearly rate is $\\frac{F-P}{Pt}$. After $m$ months, the yearly rate is $\\frac{F-P}{P}\\cdot\\frac{12}{m}$. A stated rate $c$ matches when it equals this value and is too high or too low when it is greater or less.",
};

export const dataDisplayStateLessons: Lesson[] = [
  {
    id: "stem-leaf-construct",
    title: "Build a stem-and-leaf plot",
    summary:
      "A stem-and-leaf plot is a way to list data in order. Each value is split in two. The leaf is its last digit, and the stem is the digit or digits in front. For 27, the stem is 2 and the leaf is 7. Every stem gets a row, even an empty one, and every value gets its own leaf. A key says how to read a row.",
    templateIds: ["stem-leaf-construct"],
    senses: {
      stem: "stem",
      stems: "stem",
      leaf: "leaf",
      leaves: "leaf",
      key: "key",
      sort: "sort",
    },
    noLink: ["left side"],
    objectives: [
      "Write every stem from least to greatest, including a stem with no leaves.",
      "Put the leaves in order, and repeat a leaf for a repeated value.",
      "Choose the key that matches a plot.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Sort the data by its leading digits",
        paragraphs: [
          "A stem-and-leaf plot writes each value as a stem and a leaf. The leaf is the last digit. The stem is the digit or digits in front of it.",
          "For 23, 27 and 31: the values 23 and 27 share the stem 2, with leaves 3 and 7. The value 31 has stem 3 and leaf 1. So the plot has the rows 2 | 3 7 and 3 | 1.",
          "Each stem is written once, down the left side. Its leaves are written to the right, in order from least to greatest.",
          "A key is a note that tells how to read a stem and a leaf together. The key $2 \\mid 3$ means 23 when the data are whole numbers. It means 2.3 when the leaf is the tenths digit.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "These are the minutes 9 students read: 23, 17, 35, 23, 12, 31, 14, 36, 25. Make a stem-and-leaf plot. Use the tens digit as the stem and the ones digit as the leaf.",
      steps: [
        "Find the stems from the least and greatest values. The least is 12 and the greatest is 36, so the stems are 1, 2 and 3.",
        "Stem 1: the values 17, 12 and 14 give leaves 7, 2 and 4. Put them in order: 2 4 7.",
        "Stem 2: the values 23, 23 and 25 give leaves 3, 3 and 5. The 23 appears twice, so it gets two leaves: 3 3 5.",
        "Stem 3: the values 35, 31 and 36 give leaves 5, 1 and 6. Put them in order: 1 5 6.",
        "Check that no value is lost. The plot has $3 + 3 + 3 = 9$ leaves, one for each of the 9 values. The key is $2 \\mid 3$ means 23 minutes.",
      ],
      answer: "1 | 2 4 7; 2 | 3 3 5; 3 | 1 5 6",
    },
    closingSections: [
      {
        stage: "method",
        title: "Empty stems and repeated values",
        paragraphs: [
          "Sometimes no value uses a stem that lies between the least and greatest stems. Keep that stem and leave its row empty. The empty row shows that no data fall there. Leaving it out would make the data look closer together than they are.",
          "A value that appears twice gets two leaves. At the end, count the leaves. The count must equal the number of values in the list.",
        ],
      },
      {
        stage: "formal",
        title: "Reading the key",
        paragraphs: [
          "For whole numbers, stem $s$ and leaf $\\ell$ stand for $10s + \\ell$, meaning 10 times the stem plus the leaf. With one decimal place, they stand for $s + \\frac{\\ell}{10}$. For values in the hundreds, the stem is every digit but the last, so the key $12 \\mid 4$ means 124.",
        ],
      },
    ],
    pitfalls: [
      "Put the leaves of every row in order from least to greatest.",
      "Write a leaf for a repeated value every time it appears.",
      "Keep every stem between the least and greatest, even one with no leaves.",
    ],
    parentGuide:
      "Ask the learner to read a finished plot back as a list of values. Check that the list has as many values as the original.",
  },
  {
    id: "frequency-table-build",
    title: "Build a frequency table",
    summary:
      "Count how many times each value or interval occurs, including values that never occur, and check the total.",
    templateIds: ["frequency-table-build"],
    objectives: [
      "Count each whole-number value in a list or dot plot.",
      "Keep a row for a value with frequency 0.",
      "Group values into equal intervals that include both end values.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Turn a list into counts",
        paragraphs: [
          "A long list of numbers is hard to read. A frequency table lists each value and how many times it occurs. The number of times is the frequency.",
          "Count each value once. Check at the end that the frequencies add up to the number of values in the list.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A team scored these goals in 10 games: 2, 0, 3, 2, 1, 2, 0, 4, 2, 1. Make a frequency table for 0 to 4 goals.",
      steps: [
        "Make a row for each value from 0 to 4.",
        "Count each value: 0 appears 2 times, 1 appears 2 times, 2 appears 4 times, 3 appears 1 time and 4 appears 1 time.",
        "Check: 2 + 2 + 4 + 1 + 1 = 10, the number of games.",
      ],
      answer: "0: 2, 1: 2, 2: 4, 3: 1, 4: 1",
    },
    closingSections: [
      {
        stage: "method",
        title: "Dot plots and intervals",
        paragraphs: [
          "A dot plot shows the same counts. The frequency of a value is the number of dots above it. A value with no dots has frequency 0, and it still gets a row.",
          "When the values are spread over a wide range, group them into equal intervals such as 0–9, 10–19 and 20–29. Each interval includes both of its end values, so 10 belongs to 10–19. The frequency of an interval is the number of values in that range.",
        ],
      },
      {
        stage: "formal",
        title: "The total",
        paragraphs: [
          "If the data have $n$ values and the table has $k$ rows, the frequencies add to $n$. Each value belongs to exactly one row, so no value is skipped or counted twice.",
        ],
      },
    ],
    pitfalls: [
      "A frequency is a count. Do not multiply it by the value.",
      "Keep a row for a value that never occurs, with frequency 0.",
      "A value equal to an interval's end value belongs in that interval.",
    ],
    parentGuide:
      "Give the learner a list of 10 numbers and ask them to tally each value and check that the frequencies add to 10.",
  },
  {
    id: "circle-graph-read",
    title: "Read a circle graph",
    summary:
      "A circle graph shows how one whole splits into parts. Each part is a slice of the circle, called a sector. The whole circle stands for 100% of the data, for 360 degrees and for the total count. So a sector can be described three ways: by its percent, by its angle in degrees, or by its count. Each one can be found from the others.",
    templateIds: ["circle-graph-read"],
    senses: {
      whole: "whole",
      part: "part",
      parts: "part",
      degrees: "degree-angle",
      quarter: "fourth",
      change: "change",
      center: "center",
    },
    noLink: ["edges"],
    objectives: [
      "Change a percent to a central angle and back.",
      "Find the count in a sector from its percent or angle and the total.",
      "Compare sectors by percent, angle or count.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One whole, cut into sectors",
        paragraphs: [
          "A circle graph shows how a whole splits into parts. Each part is a sector, a slice of the circle. Each sector stands for one category, such as one kind of lunch.",
          "A sector's central angle is the angle at the center of the circle between the sector's two straight edges. Angles are measured in degrees, written °. A full turn around the circle is 360°.",
          "The whole circle stands for all of the data: 100%, 360° and the total count. A sector with a quarter of the data takes a quarter of the circle. That is 25% and 90°.",
          "Problems here list each sector in a table. You can work from its percent, its angle or its count.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A circle graph shows how 80 students travel to school. The sector for bus is 35%. What is its central angle, and how many students ride the bus?",
      steps: [
        "The whole circle is 360° and also 100%. So each 1% of the data is $360 \\div 100 = 3.6$ degrees.",
        "The bus sector is 35%, so its angle is $35 \\times 3.6 = 126$ degrees.",
        "The count is 35% of the 80 students: $35 \\div 100 \\times 80 = 28$ students.",
        "Check both answers against the whole. $126 \\div 360 = 0.35$, which is 35%. And $28 \\div 80 = 0.35$ too.",
      ],
      answer: "126 degrees and 28 students",
    },
    closingSections: [
      {
        stage: "method",
        title: "Which conversion to use",
        paragraphs: [
          "Percent to angle: multiply by 3.6. Angle to percent: divide by 3.6.",
          "Percent to count: percent ÷ 100 × total. Count to percent: count ÷ total × 100. Angle to count: angle ÷ 360 × total.",
          "If one sector is missing, the other percents add to the rest of 100%. The other angles add to the rest of 360°.",
        ],
      },
      {
        stage: "formal",
        title: "Sector relationships",
        paragraphs: [
          "Suppose a sector holds the fraction $p$ of the data. Its percent is $100p$ and its central angle is $360p$ degrees. If there are $N$ values in all, it holds $pN$ of them. All the sector percents add to $100\\%$, and all the central angles add to $360^\\circ$.",
        ],
      },
    ],
    pitfalls: [
      "A percent is not a number of degrees. Multiply the percent by 3.6 to get degrees.",
      "Divide by 100 when you find a percent of a total.",
      "Divide an angle by 360, not by 100, to find its share of the whole.",
    ],
    parentGuide:
      "Ask the learner what fraction of a circle 90° is. Then ask what percent that is, and how many of 40 people it would hold.",
  },
  {
    id: "best-display-choice",
    title: "Choose the best display",
    summary:
      "A data display is a picture of data, such as a bar graph. Each kind is built for one job. To choose one, ask two questions. Are the data categories, like kinds of pets, or numbers, like heights? And what do you want to show? The answers point to one display.",
    templateIds: ["best-display-choice"],
    senses: {
      whole: "whole",
      parts: "part",
      change: "change",
      intervals: "interval",
    },
    noLink: ["rule"],
    objectives: [
      "Name the job of each common data display.",
      "Decide from the data and the question which display fits.",
      "Rule out a display that does not show what is asked.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Each display has one job",
        paragraphs: [
          "A data display is a tool, and each tool does one job well. First ask what the data are. They may be categories, which are groups such as kinds of pets. Or they may be numbers, such as heights. Then ask what you want to show.",
          "A circle graph is a circle cut into slices. It shows parts of one whole. A bar graph uses bars of different lengths to compare categories. A line graph joins points with lines to show change over time.",
          "A histogram is a bar graph for numbers. Each bar counts the values in a stretch of numbers, called an interval. It shows how a large set of numbers is spread out.",
          "A scatterplot puts one dot for each person or thing, using two measures, such as hours studied and test score. It shows whether the two measures go together. A dot plot or a stem-and-leaf plot shows every single value in a small set.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A store records its sales every month for one year. You want to show whether sales rose or fell through the year. Which display fits best?",
      steps: [
        "Name the data. They are one amount, sales, measured once a month.",
        "Name the goal. You want to see how sales change as time passes.",
        "A line graph shows change over time, so it fits. A circle graph shows parts of a whole, and a scatterplot relates two measures of the same thing. Neither one answers this question.",
      ],
      answer: "A line graph",
    },
    closingSections: [
      {
        stage: "method",
        title: "Choosing by the question",
        paragraphs: [
          "Parts that add up to one whole, such as shares of a budget: circle graph. Separate categories compared by count or amount, such as pets by kind: bar graph. One amount over time: line graph.",
          "Many numbers grouped into intervals, such as the ages of 300 visitors: histogram. Two numbers for each person or thing, such as hours studied and a score: scatterplot. A small set of numbers where every value matters: dot plot or stem-and-leaf plot.",
        ],
      },
      {
        stage: "formal",
        title: "Data type and goal",
        paragraphs: [
          "Categorical data name groups. Numerical data are measured or counted values. A display fits when it shows the goal clearly.",
          "Shares of one whole need parts that add to 100%. Change over time needs one amount measured at times in order. A relationship needs two number values for each person or thing.",
          "A histogram groups number data into intervals of equal width. A dot plot or stem-and-leaf plot keeps each value.",
        ],
      },
    ],
    pitfalls: [
      "Pick the display from the question you want to answer, not from the topic.",
      "A bar graph compares categories. A histogram groups numbers into intervals.",
      "A line graph needs time along one axis. A scatterplot does not.",
    ],
    parentGuide:
      "Name a situation, such as how tall a plant grows each week. Ask the learner which display they would draw, and why.",
  },
  {
    id: "return-claim-check",
    title: "Check an investment claim",
    summary:
      "An investment is money put somewhere to grow. The gain is the ending amount minus the starting amount. The rate of return is the gain as a percent of the starting amount. Divide it by the number of years to get a yearly rate. Then you can compare investments, or check the rate an ad claims.",
    templateIds: ["return-claim-check"],
    noLink: ["scale"],
    objectives: [
      "Compute a rate of return from a starting amount and an ending amount.",
      "Compare investments by yearly rate, not by dollars gained.",
      "Check a stated return against the one you compute.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare the gain with the amount invested",
        paragraphs: [
          "The gain is the ending amount minus the starting amount. The rate of return is the gain as a percent of the starting amount.",
          "A gain of 50 dollars on 100 dollars is a 50% return, because 50 is half of 100. The same 50 dollars gained on 1000 dollars is only a 5% return. So compare rates, not dollars.",
          "A yearly rate also uses the time. Here rates are simple: the same percent counts for each year, with no growth on earlier growth. So divide the total return by the number of years.",
          "A stated return is a claim. You can check it by computing the rate yourself.",
        ],
      },
    ],
    workedExample: {
      prompt:
        'An ad says: "Our fund returns 12% per year." A fund started with 1000 dollars and had 1300 dollars after 3 years. Is the claim accurate?',
      steps: [
        "Find the gain: 1300 dollars − 1000 dollars = 300 dollars.",
        "Compare the gain with the starting amount: 300 dollars ÷ 1000 dollars = 0.30, which is 30%. That is the total return for all 3 years.",
        "Share the total return over the 3 years to get the yearly rate: 30% ÷ 3 = 10% per year.",
        "The ad says 12%, but the computed rate is 10%. So the claim is too high.",
      ],
      answer: "10% per year, so the claim is too high",
    },
    closingSections: [
      {
        stage: "method",
        title: "Different times and different units",
        paragraphs: [
          "To compare two investments, find each yearly rate. The one with more dollars gained may have the lower rate. The one with the larger total return may have taken more years.",
          "For a time in months, find the rate for those months, then stretch it to 12 months. A return of 2% in 3 months is 8% in 12 months, since 12 months is 4 times 3 months. A rate of 2% a month is $2 \\times 12 = 24$% a year.",
        ],
      },
      {
        stage: "formal",
        title: "The formulas",
        paragraphs: [
          "Let $P$ be the starting amount, $F$ the ending amount and $t$ the number of years. The simple yearly rate is $\\frac{F-P}{Pt}$: the gain, divided by the starting amount, divided by the years. For $m$ months it is $\\frac{F-P}{P}\\cdot\\frac{12}{m}$. A stated rate matches when it equals the computed rate.",
        ],
      },
    ],
    pitfalls: [
      "Compare rates, not dollars gained.",
      "Divide a total return by the number of years to get a yearly rate.",
      "Do not trust a stated rate. Compute it from the amounts.",
    ],
    parentGuide:
      "Ask the learner to find the yearly rate if 200 dollars grows to 250 dollars in 5 years. Then ask whether a claim of 10% per year is accurate.",
  },
];
