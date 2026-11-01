import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const dataDisplayStateMethods: Record<string, ProblemMethod> = {
  "stem-leaf-construct": {
    goal: "Turn a raw list of data into an ordered stem-and-leaf plot, or choose the key that fits a plot.",
    intuition:
      "A stem-and-leaf plot sorts data by writing each value in two pieces. The stem is the leading digit or digits, and the leaf is the last digit. Every stem from the least to the greatest gets a row, and the leaves in each row go in order from least to greatest. The plot keeps every value, so you can still read the data back out.",
    terms: [
      "stem",
      "leaf",
      [
        "key",
        "In a stem-and-leaf plot, the key shows how to read a row: $2 \\mid 4$ means 24 or 2.4.",
      ],
    ],
    method: [
      "Find the least and greatest values. List every stem between them, including a stem that no value uses.",
      "Go through the list once. For each value, write its last digit as a leaf in the row of its stem. Write a repeated value once for each time it occurs.",
      "Reorder each row from least leaf to greatest leaf.",
      "Count the leaves. The count must equal the number of values. Write a key.",
    ],
    watch:
      "An empty stem still gets a row, and a repeated value needs a repeated leaf. A plot with unordered leaves, a missing stem, or fewer leaves than values does not show the data.",
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
    intuition:
      "A circle graph shows how one whole splits into parts. Each part is a sector, a slice of the circle, and its size is its share of the whole. The whole circle is 100% of the data and 360 degrees. So a sector with 25% takes a quarter of the circle, which is 90 degrees.",
    terms: [
      ["sector", "In a circle graph, each sector stands for one category."],
      "central-angle",
      "percent",
    ],
    method: [
      "Name the whole: all of the data is 100%, 360 degrees, and the total count.",
      "To go from percent to angle, multiply the percent by 3.6, since $360\\div100=3.6$. To go from angle to percent, divide by 3.6, or divide the angle by 360.",
      "To find a count, find the sector's share of the total: percent ÷ 100 × total, or angle ÷ 360 × total.",
      "To compare sectors, compare their percents or angles. To find how many more, subtract the counts.",
    ],
    watch:
      "A percent is not a number of degrees, and an angle is not a count. Convert each through the whole: 100%, 360 degrees, or the total count.",
  },
  "best-display-choice": {
    goal: "Choose the display that fits the kind of data and the question: circle, bar, line, histogram, scatter or dot plot.",
    intuition:
      "Each data display is built for one job. Pick the display by asking what the data are and what you want to see: parts of a whole, a count for each category, a change over time, the spread of a large set of numbers, a link between two measures, or every value in a small set.",
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
      "Match the goal: shares of a whole, a comparison of categories, change over time, shape of a large set, a relationship between two measures, or every value of a small set.",
      "Check the fit: a display for categories does not show a relationship, and a display of a whole does not show change over time.",
    ],
    watch:
      "Look at the goal, not at how many numbers appear. A set of numbers can suit a circle graph, a bar graph or a line graph, depending on what you want to show.",
  },
  "return-claim-check": {
    goal: "Compute a simple yearly rate of return from amounts and time, compare investments, and check a stated return.",
    intuition:
      "The rate of return tells how much an investment grew compared with the amount put in. A gain of 60 dollars is large on 100 dollars and small on 10,000 dollars, so compare rates, not dollars. A yearly rate also needs the time: the same gain in half the time is twice the yearly rate.",
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
      "Subtract to find the gain. Divide the gain by the starting amount and write it as a percent. This is the total return.",
      "Divide by the number of years to get the yearly rate. If the time is in months, multiply by 12 and divide by the number of months.",
      "Compare the computed rate with the stated rate. They match, or the stated rate is higher or lower.",
    ],
    watch:
      "A total return over several years is not a yearly rate. Divide by the years before comparing. Rates in months and in years need a common time first.",
  },
};

export const dataDisplayStatePrinciples: Record<string, string> = {
  "stem-leaf-construct":
    "For whole numbers, write each value $10s+\\ell$ with digit $\\ell$ as the leaf of stem $s$; with one decimal place, the stem is the whole-number part and the leaf the tenths digit. A correct plot has a row for every stem from the least value's stem to the greatest value's stem, each row ordered, and exactly one leaf per data value.",
  "frequency-table-build":
    "The frequency $f_i$ of a value or interval is the number of data values it holds. For $n$ values and $k$ rows, $f_1+f_2+\\dots+f_k=n$. An interval of whole numbers from $a$ to $b$ includes both $a$ and $b$, and equal-width intervals do not overlap.",
  "circle-graph-read":
    "A sector with fraction $p$ of the data has percent $100p$ and central angle $360^\\circ p$. For a total of $N$ values, the sector holds $pN$ values. The sector percents add to $100\\%$ and the central angles add to $360^\\circ$.",
  "best-display-choice":
    "A display is chosen by the type of data and the question: shares of a whole (circle graph), counts of categories (bar graph), one quantity over time (line graph), the distribution of many numbers (histogram), two numerical variables per individual (scatterplot), every value of a small set (dot plot, stem-and-leaf plot).",
  "return-claim-check":
    "For a starting amount $P$ and an ending amount $F$ after $t$ years, the total return is $\\frac{F-P}{P}$ and the simple yearly rate is $\\frac{F-P}{Pt}$. After $m$ months, the yearly rate is $\\frac{F-P}{P}\\cdot\\frac{12}{m}$. A stated rate $c$ matches when it equals this value and is too high or too low when it is greater or less.",
};

export const dataDisplayStateLessons: Lesson[] = [
  {
    id: "stem-leaf-construct",
    title: "Build a stem-and-leaf plot",
    summary:
      "Sort raw data into stems and ordered leaves, keep empty stems and repeated values, and write the key.",
    templateIds: ["stem-leaf-construct"],
    objectives: [
      "Write every stem from least to greatest, including an empty stem.",
      "Order the leaves and repeat a leaf for a repeated value.",
      "Choose the key that matches a plot.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Sort the data by its leading digits",
        paragraphs: [
          "A stem-and-leaf plot writes each value as a stem and a leaf. The stem is the leading digit or digits and the leaf is the last digit. For a list that includes 23, 27 and 31, the values 23 and 27 share the stem 2, with leaves 3 and 7, and 31 has stem 3 and leaf 1.",
          "The key tells how to read a stem and a leaf together. The key $2\\mid 3$ means $23$ when the data are whole numbers, and $2.3$ when the leaf is the tenths digit.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "These are the minutes 9 students read: 23, 17, 35, 23, 12, 31, 14, 36, 25. Make a stem-and-leaf plot. Use the tens digit as the stem and the ones digit as the leaf.",
      steps: [
        "The least value is 12 and the greatest is 36, so the stems are 1, 2 and 3.",
        "Stem 1: the values 17, 12 and 14 give leaves 7, 2 and 4. In order: 2 4 7.",
        "Stem 2: the values 23, 23 and 25 give leaves 3, 3 and 5. The repeated 23 gets two leaves: 3 3 5.",
        "Stem 3: the values 35, 31 and 36 give leaves 5, 1 and 6. In order: 1 5 6.",
        "Check: the plot has 3 + 3 + 3 = 9 leaves, one for each value. The key is $2\\mid 3$ means $23$ minutes.",
      ],
      answer: "1 | 2 4 7; 2 | 3 3 5; 3 | 1 5 6",
    },
    closingSections: [
      {
        stage: "method",
        title: "Empty stems and repeated values",
        paragraphs: [
          "If no value starts with a stem that lies between the least and greatest values, keep the stem and leave its row empty. The empty row shows that no data fall there. Leaving it out would make the data look closer together.",
          "A value that occurs twice has two leaves. Count the leaves at the end: the count must equal the number of values in the list.",
        ],
      },
      {
        stage: "formal",
        title: "Reading the key",
        paragraphs: [
          "For whole numbers, the stem $s$ and the leaf $\\ell$ stand for $10s+\\ell$. With one decimal place, they stand for $s+\\frac{\\ell}{10}$. For values in the hundreds, the stem is every digit but the last, so the key $12\\mid 4$ means $124$.",
        ],
      },
    ],
    pitfalls: [
      "Put the leaves of every row in order from least to greatest.",
      "Write a repeated value once for every time it occurs.",
      "Keep every stem between the least and greatest, even an empty one.",
    ],
    parentGuide:
      "Ask the learner to read a finished plot back as a list of values and check that the list has as many values as the original.",
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
      "Connect a sector's percent, central angle and count, and compare sectors. Each graph appears as a table of its sectors.",
    templateIds: ["circle-graph-read"],
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
          "A circle graph shows how a whole splits into parts. Each part is a sector, a slice of the circle. The whole circle stands for all of the data: 100%, 360 degrees, and the total count.",
          "A sector with a quarter of the data takes a quarter of the circle: 25% and 90 degrees. Problems here list each sector in a table so that you can work from its percent, angle or count.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A circle graph shows how 80 students travel to school. The sector for bus is 35%. What is its central angle, and how many students ride the bus?",
      steps: [
        "The whole circle is 360 degrees and 100%. Each percent is $360\\div100=3.6$ degrees.",
        "The angle is $35\\times3.6=126$ degrees.",
        "The count is 35% of 80: $35\\div100\\times80=28$ students.",
        "Check: $126\\div360=0.35$, which is 35%, and $28\\div80=0.35$.",
      ],
      answer: "126 degrees and 28 students",
    },
    closingSections: [
      {
        stage: "method",
        title: "Which conversion to use",
        paragraphs: [
          "Percent to angle: multiply by 3.6. Angle to percent: divide by 3.6. Percent to count: percent ÷ 100 × total. Count to percent: count ÷ total × 100. Angle to count: angle ÷ 360 × total.",
          "If one sector is missing, the other percents add to the rest of 100%, and the other angles add to the rest of 360 degrees.",
        ],
      },
      {
        stage: "formal",
        title: "Sector relationships",
        paragraphs: [
          "If a sector holds the fraction $p$ of the data, its percent is $100p$, its central angle is $360p$ degrees, and for a total of $N$ values it holds $pN$ values. All sector percents add to $100\\%$ and all central angles add to $360^\\circ$.",
        ],
      },
    ],
    pitfalls: [
      "A percent is not a number of degrees. Multiply it by 3.6.",
      "Divide by 100 when you find a percent of a total.",
      "Divide an angle by 360, not by 100, to find its share of the whole.",
    ],
    parentGuide:
      "Ask the learner what fraction of a circle 90 degrees is, then what percent that is, then how many of 40 people it holds.",
  },
  {
    id: "best-display-choice",
    title: "Choose the best display",
    summary:
      "Match the kind of data and the question to circle, bar and line graphs, histograms, scatterplots, and dot or stem-and-leaf plots.",
    templateIds: ["best-display-choice"],
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
          "A data display is a tool, and each tool does one job well. First ask what the data are. They may be categories, such as kinds of pets, or numbers, such as heights. Then ask what you want to show.",
          "A circle graph shows parts of one whole. A bar graph compares categories. A line graph shows change over time. A histogram shows the spread of a large set of numbers. A scatterplot shows whether two measures go together. A dot plot or stem-and-leaf plot shows every value in a small set.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A store records its sales every month for one year. You want to show whether sales rose or fell through the year. Which display fits best?",
      steps: [
        "The data are one quantity, sales, measured at equally spaced times, the months.",
        "The goal is a change as time passes.",
        "A line graph shows change over time. A circle graph shows parts of a whole, and a scatterplot relates two measures of the same item, so neither answers the question.",
      ],
      answer: "A line graph",
    },
    closingSections: [
      {
        stage: "method",
        title: "Choosing by the question",
        paragraphs: [
          "Parts that add up to one whole, such as shares of a budget: circle graph. Separate categories compared by count or amount, such as pets by kind: bar graph. One quantity over time: line graph.",
          "Many numbers grouped into intervals, such as ages of 300 visitors: histogram. Two numbers for each person or thing, such as hours studied and a score: scatterplot. A small set of numbers where every value matters: dot plot or stem-and-leaf plot.",
        ],
      },
      {
        stage: "formal",
        title: "Data type and goal",
        paragraphs: [
          "Categorical data name groups, and numerical data are measured or counted values. A display fits when it shows the goal without hiding it: shares of one whole need parts that add to 100%, a change over time needs one quantity measured at ordered times, and a relationship needs two numerical values for each individual. A histogram groups numerical data into equal-width intervals, and a dot plot or stem-and-leaf plot keeps each value.",
        ],
      },
    ],
    pitfalls: [
      "Pick the display from the question you want to answer, not from the topic.",
      "A bar graph compares categories; a histogram groups numbers into intervals.",
      "A line graph needs time on one axis; a scatterplot does not.",
    ],
    parentGuide:
      "Name a situation, such as how tall a plant grows each week, and ask the learner which display they would draw and why.",
  },
  {
    id: "return-claim-check",
    title: "Check an investment claim",
    summary:
      "Find the gain, the rate of return and the yearly rate, then compare investments or check the rate an ad claims.",
    templateIds: ["return-claim-check"],
    objectives: [
      "Compute a rate of return from a starting and an ending amount.",
      "Compare investments by yearly rate, not by dollars gained.",
      "Check a stated return against the computed one.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare the gain with the amount invested",
        paragraphs: [
          "The gain is the ending amount minus the starting amount. The rate of return is the gain as a percent of the starting amount. A gain of 50 dollars on 100 dollars is a 50% return. The same 50 dollars on 1000 dollars is a 5% return.",
          "A yearly rate also uses the time. This lesson uses simple rates, with no compounding: divide the total return by the number of years. A stated return is a claim, and you can check it by computing the rate yourself.",
        ],
      },
    ],
    workedExample: {
      prompt:
        'An ad says: "Our fund returns 12% per year." A fund started with 1000 dollars and had 1300 dollars after 3 years. Is the claim accurate?',
      steps: [
        "The gain is 1300 dollars − 1000 dollars = 300 dollars.",
        "The total return is 300 dollars ÷ 1000 dollars = 0.30, which is 30%.",
        "The time is 3 years, so the yearly rate is 30% ÷ 3 = 10% per year.",
        "The ad says 12%, and the computed rate is 10%, so the claim is too high.",
      ],
      answer: "10% per year, so the claim is too high",
    },
    closingSections: [
      {
        stage: "method",
        title: "Different times and different units",
        paragraphs: [
          "To compare two investments, find each yearly rate. The one with more dollars of gain may have the lower rate, and the one with the larger total return may have taken more years.",
          "For a time in months, find the rate for those months, then scale it to 12 months. A return of 2% in 3 months is 8% in 12 months. A rate of 2% a month is 24% a year, since a year has 12 months.",
        ],
      },
      {
        stage: "formal",
        title: "The formulas",
        paragraphs: [
          "With starting amount $P$, ending amount $F$ and $t$ years, the simple yearly rate is $\\frac{F-P}{Pt}$. For $m$ months it is $\\frac{F-P}{P}\\cdot\\frac{12}{m}$. A stated rate matches when it equals the computed rate.",
        ],
      },
    ],
    pitfalls: [
      "Compare rates, not dollars gained.",
      "Divide a total return by the years to get a yearly rate.",
      "Do not accept the stated rate. Compute it from the amounts.",
    ],
    parentGuide:
      "Ask the learner to find the yearly rate if 200 dollars grows to 250 dollars in 5 years, and then to say whether a claim of 10% per year is accurate.",
  },
];
