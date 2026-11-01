import type { GlossaryEntry } from "../types";

/** Data displays, measures of center and spread, sampling, probability, counting and inference. */
export const statisticsProbabilityEntries: GlossaryEntry[] = [
  {
    id: "association",
    term: "association",
    forms: ["association", "associations"],
    plain:
      "A pattern in how two quantities change together, so knowing one helps you predict the other.",
    example:
      "Taller students tend to have longer feet, so height and foot length show an association.",
    uses: ["length", "height"],
    noLink: ["change", "pattern"],
    band: "8",
  },
  {
    id: "at-least-as-extreme",
    term: "at least as extreme",
    forms: ["at least as extreme"],
    plain:
      "As far from the expected result as the result actually seen, or even farther, in the direction being tested.",
    example:
      "Testing whether a coin favors heads after seeing 62 heads in 100 flips, results of 62 or more heads are at least as extreme.",
    uses: [],
    noLink: ["coin"],
    band: "algebra-2",
  },
  {
    id: "bar-graph",
    term: "bar graph",
    forms: ["bar graph", "bar graphs"],
    plain:
      "A graph that compares amounts in separate groups using bars. A longer bar means a bigger amount.",
    example:
      "A bar graph of favorite fruits might show 8 votes for apples and 5 for pears.",
    uses: [],
    band: "2",
  },
  {
    id: "biased-sample",
    term: "biased sample",
    forms: ["biased sample", "biased samples"],
    plain:
      "A sample chosen in a way that favors some members of the population, so it may not represent the whole population.",
    example:
      "Asking only the basketball team about favorite sports gives a biased sample of the school.",
    uses: ["sample", "population"],
    noLink: ["whole"],
    band: "7",
  },
  {
    id: "binomial-count",
    term: "binomial count",
    forms: ["binomial count", "binomial counts"],
    plain:
      "The number of successes in a fixed number of independent trials, when every trial has the same probability of success.",
    example:
      "The number of heads in 10 flips of a fair coin is a binomial count.",
    uses: ["independent-events", "trial", "probability"],
    noLink: ["coin"],
    band: "precalculus",
  },
  {
    id: "box-plot",
    term: "box plot",
    forms: [
      "box plot",
      "box plots",
      "box-and-whisker plot",
      "box-and-whisker plots",
    ],
    plain:
      "A graph of data: a box from the first quartile to the third quartile, a line inside at the median, and whiskers out to the least and greatest values.",
    example:
      "For least 2, first quartile 5, median 7, third quartile 9 and greatest 14, the box runs from 5 to 9.",
    uses: ["data", "quartile", "median"],
    noLink: ["line"],
    band: "6",
  },
  {
    id: "causal-inference",
    term: "causal inference",
    forms: ["causal inference", "causal inferences"],
    plain:
      "A conclusion that changing one thing causes a change in another. A study supports it only when treatments were handed out by random assignment.",
    example:
      "If volunteers are randomly assigned to sleep 6 or 9 hours, a difference in test scores can be credited to sleep.",
    uses: ["random-assignment", "difference-subtract"],
    noLink: ["change"],
    band: "algebra-2",
  },
  {
    id: "certain",
    term: "certain",
    forms: ["certain"],
    plain: "Sure to happen. A certain event has probability 1.",
    example:
      "Rolling a number less than 7 on a standard number cube is certain.",
    uses: ["event", "probability", "less-than", "cube"],
    autoLink: false,
    band: "7",
  },
  {
    id: "circle-graph",
    term: "circle graph",
    forms: ["circle graph", "circle graphs", "pie chart", "pie charts"],
    plain:
      "A circle cut into slices that show each part's share of one whole. All the slices together make 100%.",
    example:
      "If half the class walks to school, the walking slice is half the circle, or 50%.",
    uses: ["percent", "whole", "half", "circle"],
    noLink: ["part"],
    band: "6",
  },
  {
    id: "combination",
    term: "combination",
    forms: ["combination", "combinations"],
    plain:
      "A group of items chosen from a larger set when order does not matter. Choosing Ann then Bo gives the same combination as Bo then Ann.",
    example: "From 4 people, the number of combinations of 2 is 4 × 3 ÷ 2 = 6.",
    uses: [],
    noLink: ["order"],
    autoLink: false,
    band: "precalculus",
  },
  {
    id: "complement-probability",
    term: "complement",
    forms: ["complement", "complements"],
    plain:
      "All the outcomes where an event does not happen. An event and its complement cover every outcome, so their probabilities add to 1.",
    example:
      "Rolling a 6 has probability $\\tfrac16$, so its complement, not rolling a 6, has probability $\\tfrac56$.",
    uses: ["outcome", "event", "probability"],
    autoLink: false,
    band: "7",
  },
  {
    id: "conditional-probability",
    term: "conditional probability",
    forms: ["conditional probability", "conditional probabilities"],
    plain:
      "The probability of one event when you already know another event happened. Count only the cases where the known event happened.",
    example:
      "Of 20 students who play soccer, 5 also swim, so $P(\\text{swim} \\mid \\text{soccer}) = \\tfrac{5}{20}$.",
    uses: ["probability", "event"],
    band: "geometry",
  },
  {
    id: "conditional-relative-frequency",
    term: "conditional relative frequency",
    forms: [
      "conditional relative frequency",
      "conditional relative frequencies",
      "conditional percent",
      "conditional percents",
    ],
    plain:
      "In a two-way table, one cell's count divided by the total of its own row or column, often written as a percent.",
    example:
      "If 12 of the 30 seventh graders chose soccer, the conditional relative frequency is 12 ÷ 30 = 40%.",
    uses: ["two-way-table", "relative-frequency", "sum", "percent"],
    band: "algebra-1",
  },
  {
    id: "confidence-level",
    term: "confidence level",
    forms: ["confidence level", "confidence levels"],
    plain:
      "How often the method's interval would capture the true population value over many repeated samples. At 95%, about 95 of every 100 such intervals would.",
    example: "A poll reports 52% ± 3% at a 95% confidence level.",
    uses: ["interval", "population", "sample"],
    band: "algebra-2",
  },
  {
    id: "correlation-coefficient",
    term: "correlation coefficient",
    forms: [
      "correlation coefficient",
      "correlation coefficients",
      "correlation",
    ],
    plain:
      "A number $r$ from −1 to 1 that tells how closely points follow a straight line. Its sign gives the direction; near −1 or 1 means a strong association.",
    example:
      "Points that rise steadily from left to right might have $r = 0.9$.",
    uses: ["association", "point", "line"],
    band: "algebra-1",
  },
  {
    id: "data",
    term: "data",
    forms: ["data", "data set", "data sets"],
    plain:
      "Facts or numbers collected by counting, measuring or asking questions.",
    example: "The number of pets each student in a class has is data.",
    uses: [],
    band: "1",
  },
  {
    id: "distribution",
    term: "distribution",
    forms: ["distribution", "distributions"],
    plain:
      "How the values in a data set are spread out: which values occur and how often each one occurs.",
    example:
      "A dot plot shows the distribution of quiz scores: where the dots pile up and where they thin out.",
    uses: ["data", "dot-plot"],
    band: "6",
  },
  {
    id: "dot-plot",
    term: "dot plot",
    forms: ["dot plot", "dot plots", "line plot", "line plots"],
    plain:
      "A graph that puts one dot, or ×, above a labeled line for each data value. Repeated values make taller stacks.",
    example:
      "For the data 2, 3, 3, 5, there is one dot above 2, two above 3 and one above 5.",
    uses: ["data"],
    noLink: ["line"],
    band: "2",
  },
  {
    id: "empirical-distribution",
    term: "empirical distribution",
    forms: ["empirical distribution", "empirical distributions"],
    plain:
      "The values seen in real data with the relative frequency of each, used in place of probabilities from a model.",
    example:
      "If a die lands on 6 in 9 of 50 rolls, the empirical distribution gives 6 the value 9 ÷ 50 = 0.18.",
    uses: ["distribution", "data", "relative-frequency", "probability"],
    noLink: ["model"],
    band: "precalculus",
  },
  {
    id: "equally-likely",
    term: "equally likely",
    forms: ["equally likely", "equally likely outcomes"],
    plain: "Having the same chance of happening.",
    example:
      "When a fair number cube is rolled, each of the 6 faces is equally likely.",
    uses: ["cube", "face-solid"],
    band: "7",
  },
  {
    id: "event",
    term: "event",
    forms: ["event", "events"],
    plain: "An outcome, or a group of outcomes, that you are asking about.",
    example:
      "Rolling a number greater than 4 is an event made of the outcomes 5 and 6.",
    uses: ["outcome", "greater-than"],
    autoLink: false,
    band: "7",
  },
  {
    id: "expected-count",
    term: "expected count",
    forms: ["expected count", "expected counts"],
    plain:
      "How many times you predict an outcome will happen: its probability times the number of trials.",
    example:
      "Flip a coin 50 times: the expected count of heads is $\\tfrac12 \\times 50 = 25$.",
    uses: ["outcome", "probability", "trial"],
    noLink: ["coin"],
    band: "7",
  },
  {
    id: "expected-value",
    term: "expected value",
    forms: ["expected value", "expected values"],
    plain:
      "The long-run average result of a chance process. Multiply each possible result by its probability, then add.",
    example:
      "A game pays 10 dollars with probability 0.2 and nothing otherwise: expected value $10 \\times 0.2 = 2$ dollars.",
    uses: ["mean-average", "probability"],
    band: "algebra-2",
  },
  {
    id: "experimental-probability",
    term: "experimental probability",
    forms: ["experimental probability", "experimental probabilities"],
    plain:
      "The number of trials in which an event happened, divided by the total number of trials.",
    example:
      "A spinner lands on red 12 times in 40 spins, so the experimental probability of red is 12 ÷ 40 = 0.3.",
    uses: ["trial", "event", "sum", "probability"],
    band: "7",
  },
  {
    id: "factorial",
    term: "factorial",
    forms: ["factorial", "factorials"],
    plain:
      "The product of every whole number from a number down to 1, written with an exclamation mark: $n!$.",
    example: "$4! = 4 \\times 3 \\times 2 \\times 1 = 24$.",
    uses: ["product-multiply", "whole-number"],
    band: "precalculus",
  },
  {
    id: "frequency",
    term: "frequency",
    forms: ["frequency", "frequencies"],
    plain:
      "How many times a value, or values in an interval, occur in the data.",
    example: "In 3, 5, 5, 8, 5 the value 5 has frequency 3.",
    uses: ["interval", "data"],
    band: "2",
  },
  {
    id: "frequency-wave",
    term: "frequency",
    forms: ["frequency", "frequencies"],
    plain:
      "How many full cycles a repeating graph completes in one unit, such as one second. It is the reciprocal of the period.",
    example:
      "A wave with period $\\tfrac14$ second has frequency 4 cycles per second.",
    uses: ["reciprocal", "period", "unit"],
    autoLink: false,
    band: "algebra-2",
  },
  {
    id: "geometric-probability",
    term: "geometric probability",
    forms: ["geometric probability", "geometric probabilities"],
    plain:
      "A probability found by comparing lengths or areas: the size of the target part divided by the size of the whole.",
    example:
      "A dart lands at random on a 10 by 10 board with a 2 by 2 red square, so $P(\\text{red}) = \\tfrac{4}{100}$.",
    uses: ["probability", "length", "area", "square-shape"],
    noLink: ["part", "whole"],
    band: "geometry",
  },
  {
    id: "histogram",
    term: "histogram",
    forms: ["histogram", "histograms"],
    plain:
      "A bar graph for number data: each bar covers an interval of the same width, and its height shows how many values fall in that interval.",
    example:
      "Bars over 0–9, 10–19 and 20–29 with heights 4, 7 and 2 show 13 values in all.",
    uses: ["bar-graph", "data", "interval", "height"],
    band: "6",
  },
  {
    id: "impossible",
    term: "impossible",
    forms: ["impossible"],
    plain: "Cannot happen. An impossible event has probability 0.",
    example: "Rolling a 7 on a standard number cube is impossible.",
    uses: ["event", "probability", "cube"],
    autoLink: false,
    band: "7",
  },
  {
    id: "independent-events",
    term: "independent events",
    forms: ["independent events", "independent trials", "independence"],
    plain:
      "Events where one happening does not change the probability of the other. The probability that both happen is the product of their probabilities.",
    example:
      "Flip a coin and roll a number cube: $P(\\text{heads and } 6) = \\tfrac12 \\times \\tfrac16 = \\tfrac{1}{12}$.",
    uses: ["event", "probability", "product-multiply", "cube"],
    noLink: ["change", "coin"],
    band: "geometry",
  },
  {
    id: "interquartile-range",
    term: "interquartile range",
    forms: ["interquartile range", "interquartile ranges", "iqr"],
    plain:
      "The spread of the middle half of the data: the third quartile minus the first quartile. On a box plot it is the length of the box.",
    example:
      "If the first quartile is 5 and the third quartile is 9, the interquartile range is 9 − 5 = 4.",
    uses: ["data", "quartile", "box-plot", "length", "half"],
    band: "6",
  },
  {
    id: "interval",
    term: "interval",
    forms: ["interval", "intervals"],
    plain:
      "A stretch of numbers from one value to another, such as all the numbers from 10 to 19.",
    example: "Ages 10 to 19 form one interval; ages 20 to 29 form the next.",
    uses: [],
    autoLink: false,
    band: "2",
  },
  {
    id: "joint-relative-frequency",
    term: "joint relative frequency",
    forms: [
      "joint relative frequency",
      "joint relative frequencies",
      "joint percent",
      "joint percents",
    ],
    plain:
      "In a two-way table, one cell's count divided by the grand total of the whole table, often written as a percent.",
    example:
      "If 12 of all 80 students surveyed are seventh graders who chose soccer, the joint relative frequency is 12 ÷ 80 = 15%.",
    uses: ["two-way-table", "relative-frequency", "sum", "percent", "survey"],
    noLink: ["whole"],
    band: "algebra-1",
  },
  {
    id: "key",
    term: "key",
    forms: ["key", "keys"],
    plain:
      "A note on a graph or chart that tells what each symbol or entry stands for.",
    example:
      "If the key says each star stands for 2 books, then 3 stars mean 6 books.",
    uses: [],
    autoLink: false,
    noLink: ["mean"],
    band: "3",
  },
  {
    id: "leaf",
    term: "leaf",
    forms: ["leaf", "leaves"],
    plain:
      "In a stem-and-leaf plot, the last digit of a value, written to the right of its stem. Each value gets its own leaf.",
    example: "In the row 4 | 2 7, the leaves 2 and 7 stand for 42 and 47.",
    uses: ["stem-and-leaf-plot", "digit", "stem"],
    autoLink: false,
    band: "6",
  },
  {
    id: "like-fractions",
    term: "like fractions",
    forms: ["like fractions"],
    plain:
      "Fractions with the same denominator, so their pieces are the same size.",
    example: "$\\tfrac38$ and $\\tfrac58$ are like fractions.",
    uses: ["fraction", "denominator"],
    band: "3",
  },
  {
    id: "line-graph",
    term: "line graph",
    forms: ["line graph", "line graphs"],
    plain:
      "A graph of points joined in order by straight pieces, showing how an amount changes over time.",
    example:
      "A line graph of a plant's height each week rises from 2 cm to 9 cm over 5 weeks.",
    uses: ["point", "height"],
    noLink: ["changes"],
    band: "5",
  },
  {
    id: "line-of-best-fit",
    term: "line of best fit",
    forms: [
      "line of best fit",
      "lines of best fit",
      "trend line",
      "trend lines",
      "regression line",
      "regression lines",
    ],
    plain:
      "A straight line drawn through the middle of the points on a scatterplot, following their trend. It is used to predict one value from the other.",
    example:
      "If the line of best fit is $y = 2x + 5$, the prediction at $x = 10$ is 25.",
    uses: ["scatterplot", "point"],
    noLink: ["line"],
    band: "8",
  },
  {
    id: "margin-of-error",
    term: "margin of error",
    forms: ["margin of error", "margins of error"],
    plain:
      "How far a sample's estimate could reasonably be from the true population value. The estimate plus or minus this amount gives the reported interval.",
    example: "52% with a margin of error of 3% gives the interval 49% to 55%.",
    uses: ["sample", "estimate", "population", "interval", "plus-or-minus"],
    band: "algebra-2",
  },
  {
    id: "marginal-relative-frequency",
    term: "marginal relative frequency",
    forms: [
      "marginal relative frequency",
      "marginal relative frequencies",
      "marginal percent",
      "marginal percents",
    ],
    plain:
      "In a two-way table, a whole row's or column's total divided by the grand total, often written as a percent.",
    example:
      "If 30 of all 80 students surveyed are seventh graders, the marginal relative frequency is 30 ÷ 80 = 37.5%.",
    uses: ["two-way-table", "relative-frequency", "sum", "percent", "survey"],
    noLink: ["whole"],
    band: "algebra-1",
  },
  {
    id: "maximum",
    term: "maximum",
    forms: ["maximum", "maximums", "maxima"],
    plain: "The greatest value.",
    example: "In 4, 9, 2, 7 the maximum is 9.",
    uses: [],
    band: "6",
  },
  {
    id: "mean-absolute-deviation",
    term: "mean absolute deviation",
    forms: ["mean absolute deviation", "mean absolute deviations"],
    plain:
      "The mean of how far each value is from the mean of the data. A larger one means the data are more spread out.",
    example:
      "For 2, 4, 6 the mean is 4, the values are 2, 0 and 2 away, so the MAD is $(2 + 0 + 2) \\div 3 \\approx 1.33$.",
    uses: ["mean-average", "data"],
    noLink: ["means"],
    band: "6",
  },
  {
    id: "mean-average",
    term: "mean",
    forms: ["mean", "average", "averages", "arithmetic mean"],
    plain:
      "The sum of the values divided by how many values there are. It is the amount each would get if the total were shared equally.",
    example: "The mean of 4, 6 and 11 is $(4 + 6 + 11) \\div 3 = 7$.",
    uses: ["sum"],
    autoLink: false,
    band: "6",
  },
  {
    id: "median",
    term: "median",
    forms: ["median", "medians"],
    plain:
      "The middle value when the data are listed in order. With an even number of values, it is the mean of the two middle values.",
    example: "For 2, 5, 7, 9 the median is $(5 + 7) \\div 2 = 6$.",
    uses: ["data", "mean-average", "even-number"],
    noLink: ["order"],
    band: "6",
  },
  {
    id: "median-triangle",
    term: "median of a triangle",
    forms: ["median", "medians", "median of a triangle"],
    plain:
      "A segment from a vertex of a triangle to the midpoint of the opposite side. Every triangle has three, and they meet at one point.",
    example:
      "In triangle $ABC$ with $M$ the midpoint of $BC$, segment $AM$ is a median.",
    uses: [
      "segment",
      "vertex",
      "triangle",
      "midpoint",
      "side",
      "point",
      "opposite-side-angle",
    ],
    noLink: ["opposite"],
    autoLink: false,
    band: "geometry",
  },
  {
    id: "minimum",
    term: "minimum",
    forms: ["minimum", "minimums", "minima"],
    plain: "The least value.",
    example: "In 4, 9, 2, 7 the minimum is 2.",
    uses: [],
    band: "6",
  },
  {
    id: "mode-statistics",
    term: "mode",
    forms: ["mode", "modes"],
    plain:
      "The value or category that appears most often in a set of data. A set can have more than one mode, or none.",
    example: "In 3, 5, 5, 8 the mode is 5.",
    uses: ["data"],
    autoLink: false,
    noLink: ["more than"],
    band: "1",
  },
  {
    id: "mutually-exclusive",
    term: "mutually exclusive",
    forms: ["mutually exclusive"],
    plain:
      "Describes events that cannot both happen at the same time. The probability that one or the other happens is the sum of their probabilities.",
    example:
      "On one roll of a number cube, rolling a 2 and rolling a 5 are mutually exclusive.",
    uses: ["event", "probability", "sum", "cube"],
    band: "geometry",
  },
  {
    id: "net-gain",
    term: "net gain",
    forms: ["net gain", "net gains"],
    plain:
      "What you end up with after paying to play: the amount won minus the cost.",
    example:
      "Winning 10 dollars on a 2-dollar ticket is a net gain of 10 − 2 = 8 dollars.",
    uses: [],
    band: "algebra-2",
  },
  {
    id: "normal-distribution",
    term: "normal distribution",
    forms: [
      "normal distribution",
      "normal distributions",
      "normal model",
      "normal models",
      "normal curve",
      "bell curve",
    ],
    plain:
      "A symmetric, bell-shaped distribution with one peak at its mean. Its mean sets where it sits; its standard deviation sets how wide it is.",
    example:
      "Adult heights roughly follow a normal distribution: most near the mean, few very short or very tall.",
    uses: [
      "distribution",
      "mean-average",
      "standard-deviation",
      "symmetry",
      "height",
    ],
    band: "algebra-2",
  },
  {
    id: "outcome",
    term: "outcome",
    forms: ["outcome", "outcomes"],
    plain:
      "One possible result of a chance process, such as which face of a number cube lands up.",
    example: "Flipping a coin has two outcomes: heads and tails.",
    uses: ["face-solid", "cube"],
    noLink: ["coin", "tails"],
    band: "7",
  },
  {
    id: "outlier",
    term: "outlier",
    forms: ["outlier", "outliers"],
    plain:
      "A value far from the rest of the data. A common test: more than 1.5 IQRs below the first quartile or above the third quartile.",
    example: "In 3, 4, 4, 5, 6, 30 the value 30 is an outlier.",
    uses: ["data", "interquartile-range", "quartile"],
    noLink: ["more than"],
    band: "6",
  },
  {
    id: "permutation",
    term: "permutation",
    forms: ["permutation", "permutations"],
    plain:
      "An ordered arrangement of items, where each item fills a different position. Swapping two items gives a different permutation.",
    example:
      "Gold, silver and bronze for 5 runners can be given out in 5 × 4 × 3 = 60 permutations.",
    uses: [],
    band: "precalculus",
  },
  {
    id: "population",
    term: "population",
    forms: ["population", "populations"],
    plain: "The whole group a study wants to learn about.",
    example:
      "To learn how all 800 students at a school get to class, the population is those 800 students.",
    uses: [],
    noLink: ["whole"],
    autoLink: false,
    band: "7",
  },
  {
    id: "probability",
    term: "probability",
    forms: ["probability", "probabilities"],
    plain:
      "A number from 0 to 1 that tells how likely an event is. With equally likely outcomes, it is the outcomes in the event divided by all outcomes.",
    example:
      "A bag holds 3 red and 2 blue marbles, so $P(\\text{red}) = \\tfrac35$.",
    uses: ["event", "equally-likely", "outcome"],
    band: "7",
  },
  {
    id: "probability-distribution",
    term: "probability distribution",
    forms: ["probability distribution", "probability distributions"],
    plain:
      "A list, table or graph of every value a random variable can take, with the probability of each. The probabilities add to 1.",
    example:
      "Heads in 2 coin flips: 0 heads $\\tfrac14$, 1 head $\\tfrac12$, 2 heads $\\tfrac14$.",
    uses: ["distribution", "random-variable", "probability"],
    noLink: ["coin"],
    band: "precalculus",
  },
  {
    id: "quartile",
    term: "quartile",
    forms: [
      "quartile",
      "quartiles",
      "first quartile",
      "third quartile",
      "lower quartile",
      "upper quartile",
    ],
    plain:
      "A value that cuts ordered data into quarters. The first quartile is the median of the lower half; the third quartile is the median of the upper half.",
    example:
      "For 1, 3, 4, 6, 8, 9 the first quartile is 3 and the third quartile is 8.",
    uses: ["data", "median", "half", "fourth"],
    band: "6",
  },
  {
    id: "random-assignment",
    term: "random assignment",
    forms: ["random assignment", "randomly assigned"],
    plain:
      "Using chance, such as a coin flip, to decide which treatment each person already in a study gets.",
    example:
      "Flip a coin for each volunteer: heads tries the new diet, tails keeps the old one.",
    uses: [],
    noLink: ["coin", "tails"],
    band: "algebra-2",
  },
  {
    id: "random-sample",
    term: "random sample",
    forms: ["random sample", "random samples", "random sampling"],
    plain:
      "A sample in which every member of the population has the same chance of being chosen.",
    example:
      "Drawing 50 names from a hat holding every student's name gives a random sample of the school.",
    uses: ["sample", "population"],
    band: "7",
  },
  {
    id: "random-variable",
    term: "random variable",
    forms: ["random variable", "random variables"],
    plain:
      "A rule that gives a number to each outcome of a chance process, such as the number of heads in three coin flips.",
    example: "If $X$ is the number of heads in 2 flips, $X$ can be 0, 1 or 2.",
    uses: ["outcome"],
    noLink: ["coin", "rule"],
    band: "precalculus",
  },
  {
    id: "range-function",
    term: "range of a function",
    forms: ["range", "ranges", "range of a function"],
    plain:
      "All the output values a function produces. On a graph, it is every $y$-value the graph reaches.",
    example: "For $f(x) = x^2$, the range is all numbers 0 or greater.",
    uses: ["output", "function"],
    autoLink: false,
    band: "algebra-1",
  },
  {
    id: "range-statistics",
    term: "range",
    forms: ["range", "ranges"],
    plain: "How spread out data are: the greatest value minus the least value.",
    example: "For 3, 8, 12 and 15 the range is 15 − 3 = 12.",
    uses: ["data", "maximum", "minimum"],
    autoLink: false,
    band: "6",
  },
  {
    id: "re-randomization",
    term: "re-randomization",
    forms: ["re-randomization", "re-randomizations", "rerandomization"],
    plain:
      "Reshuffling the group labels among the same results many times, recomputing the difference each time, to see how big a difference chance alone makes.",
    example:
      "If only 2 of 1,000 reshuffles give a difference at least as big as the real one, the real difference is hard to explain by chance alone.",
    uses: ["difference-subtract", "at-least"],
    band: "algebra-2",
  },
  {
    id: "relative-frequency",
    term: "relative frequency",
    forms: ["relative frequency", "relative frequencies"],
    plain:
      "A count divided by the total count, often written as a percent. It tells what share of the data falls in a group.",
    example:
      "If 12 of 40 students chose blue, the relative frequency of blue is 12 ÷ 40 = 0.3, or 30%.",
    uses: ["sum", "percent", "data"],
    band: "6",
  },
  {
    id: "residual",
    term: "residual",
    forms: ["residual", "residuals"],
    plain:
      "How far a data point is from a prediction: the observed value minus the predicted value.",
    example:
      "If a point has $y = 12$ and the line predicts 10, the residual is 12 − 10 = 2.",
    uses: ["data", "point", "line"],
    band: "algebra-1",
  },
  {
    id: "residual-plot",
    term: "residual plot",
    forms: ["residual plot", "residual plots"],
    plain:
      "A graph of each residual against its input, with a flat line at 0. A clear pattern in the points shows the prediction rule misses something.",
    example:
      "Residuals that curve up, down, then up again mean a straight line is a poor fit.",
    uses: ["residual", "input", "point"],
    noLink: ["line", "mean", "pattern", "rule"],
    band: "algebra-1",
  },
  {
    id: "sample",
    term: "sample",
    forms: ["sample", "samples"],
    plain: "The part of a population that is actually observed or asked.",
    example:
      "To learn about all 800 students, a survey asks 50 of them; those 50 are the sample.",
    uses: ["population", "survey"],
    noLink: ["part"],
    autoLink: false,
    band: "7",
  },
  {
    id: "sample-space",
    term: "sample space",
    forms: ["sample space", "sample spaces"],
    plain: "The list of every possible outcome.",
    example: "The sample space for flipping two coins is HH, HT, TH, TT.",
    uses: ["outcome"],
    noLink: ["coins"],
    band: "7",
  },
  {
    id: "scatterplot",
    term: "scatterplot",
    forms: ["scatterplot", "scatterplots", "scatter plot", "scatter plots"],
    plain:
      "A graph with one point for each person or thing, placed by two of its measurements, to show whether the two measurements are related.",
    example: "Each student is a point: hours studied across, test score up.",
    uses: ["point"],
    band: "8",
  },
  {
    id: "simulation",
    term: "simulation",
    forms: ["simulation", "simulations"],
    plain:
      "Acting out a chance process many times with coins, spinners, random digits or a computer, to see which results happen and how often.",
    example:
      "To estimate the chance of 3 heads in 3 flips, flip 3 coins 100 times and count the all-heads runs.",
    uses: ["digit", "estimate"],
    noLink: ["coins"],
    band: "7",
  },
  {
    id: "skewed-right",
    term: "skewed right",
    forms: ["skewed right", "right-skewed", "skewed to the right"],
    plain:
      "Describes data that bunch up at the low end and trail off in a long stretch toward high values.",
    example:
      "Household incomes are skewed right: most are moderate, a few are very high.",
    uses: ["data"],
    band: "6",
  },
  {
    id: "sort",
    term: "sort",
    forms: ["sort", "sorts", "sorting"],
    plain:
      "To put things into groups so that everything in a group is alike in some way.",
    example: "Sort the shapes into circles and squares, then count each group.",
    uses: ["circle"],
    noLink: ["squares"],
    autoLink: false,
    band: "K",
  },
  {
    id: "standard-deviation",
    term: "standard deviation",
    forms: ["standard deviation", "standard deviations"],
    plain:
      "A measure of spread: roughly how far values typically are from the mean. Square each value's gap from the mean, take the mean of those, then the square root.",
    example:
      "Scores 70, 80, 90 have mean 80 and standard deviation about 8.2; scores 79, 80, 81 have about 0.8.",
    uses: ["mean-average", "square-root", "square-number"],
    noLink: ["root"],
    band: "algebra-1",
  },
  {
    id: "statistical-question",
    term: "statistical question",
    forms: ["statistical question", "statistical questions"],
    plain: "A question you answer by collecting data that you expect to vary.",
    example:
      '"How tall am I?" is not statistical; "How tall are the students in my class?" is.',
    uses: ["data"],
    band: "6",
  },
  {
    id: "statistically-significant",
    term: "statistically significant",
    forms: ["significant", "statistically significant"],
    plain:
      "A result is significant when chance alone would give a result at least this extreme less often than a cutoff chosen in advance, such as 5%.",
    example:
      "If reshuffles give a difference at least this big only 1% of the time, the difference is significant at a 5% cutoff.",
    uses: ["difference-subtract", "at-least"],
    autoLink: false,
    band: "algebra-2",
  },
  {
    id: "stem",
    term: "stem",
    forms: ["stem", "stems"],
    plain:
      "In a stem-and-leaf plot, the leading digit or digits of a value. Each stem is written once, in the left column.",
    example: "The values 42 and 47 share the stem 4.",
    uses: ["stem-and-leaf-plot", "digit"],
    autoLink: false,
    band: "6",
  },
  {
    id: "stem-and-leaf-plot",
    term: "stem-and-leaf plot",
    forms: [
      "stem-and-leaf plot",
      "stem-and-leaf plots",
      "stem and leaf plot",
      "stem and leaf plots",
    ],
    plain:
      "A display that splits each value into its leading digits, written once at the left, and its last digit, written to the right in that row.",
    example: "The values 23, 25 and 31 appear as the rows 2 | 3 5 and 3 | 1.",
    uses: ["digit"],
    band: "6",
  },
  {
    id: "sum-of-squared-residuals",
    term: "sum of squared residuals",
    forms: ["sum of squared residuals", "sums of squared residuals"],
    plain:
      "Square each residual, then add them. A smaller total means the predictions stay closer to the data.",
    example: "Residuals 2, −1 and 1 give $2^2 + (-1)^2 + 1^2 = 6$.",
    uses: ["square-number", "residual", "sum", "data"],
    band: "algebra-1",
  },
  {
    id: "survey",
    term: "survey",
    forms: ["survey", "surveys"],
    plain:
      "Asking a group of people the same question and counting their answers.",
    example:
      "A survey asks 20 classmates their favorite color: 9 say blue, 6 red, 5 green.",
    uses: [],
    band: "1",
  },
  {
    id: "t-chart",
    term: "T-chart",
    forms: ["t-chart", "t-charts"],
    plain:
      "A chart with two columns split by a line down the middle, such as each choice on the left and how many chose it on the right.",
    example: "A T-chart lists apple | 5 and pear | 3.",
    uses: [],
    noLink: ["line"],
    band: "1",
  },
  {
    id: "tail",
    term: "tail",
    forms: ["tail", "tails"],
    plain:
      "The part of a distribution far from the center, beyond some boundary value.",
    example:
      "In a normal distribution, values more than 2 standard deviations above the mean lie in the upper tail.",
    uses: [
      "distribution",
      "normal-distribution",
      "standard-deviation",
      "mean-average",
      "center",
    ],
    noLink: ["part", "more than", "boundary"],
    autoLink: false,
    band: "algebra-2",
  },
  {
    id: "tally-mark",
    term: "tally mark",
    forms: ["tally mark", "tally marks", "tally", "tallies"],
    plain:
      "A short line drawn for each thing counted. Every fifth mark crosses the four before it, making a bundle of 5.",
    example: "One crossed bundle and 2 more lines show 7.",
    uses: ["line"],
    band: "1",
  },
  {
    id: "theoretical-probability",
    term: "theoretical probability",
    forms: ["theoretical probability", "theoretical probabilities"],
    plain:
      "The probability found by reasoning instead of experiment: the outcomes in the event divided by all equally likely outcomes.",
    example:
      "The theoretical probability of rolling a 6 on a number cube is $\\tfrac16$.",
    uses: ["probability", "outcome", "event", "equally-likely", "cube"],
    noLink: ["experiment"],
    band: "7",
  },
  {
    id: "trial",
    term: "trial",
    forms: ["trial", "trials"],
    plain:
      "One run of a chance experiment, such as one flip of a coin or one spin of a spinner.",
    example: "Rolling a number cube 30 times is 30 trials.",
    uses: ["cube"],
    autoLink: false,
    noLink: ["coin", "experiment"],
    band: "7",
  },
  {
    id: "two-way-table",
    term: "two-way table",
    forms: ["two-way table", "two-way tables"],
    plain:
      "A table that sorts the same group two ways at once: one way across the rows, the other down the columns. Each box counts who fits both.",
    example:
      "Rows for grades 1 and 2, columns for walk or bus; the box for grade 1 and walk might say 8.",
    uses: ["sort"],
    band: "1",
  },
  {
    id: "union",
    term: "union",
    forms: ["union"],
    plain:
      'Written $A \\cup B$: all the outcomes in event $A$, in event $B$, or in both. It matches the word "or" in probability.',
    example:
      "Rolling a number cube, even $\\cup$ greater than 4 is 2, 4, 5, 6.",
    uses: [
      "outcome",
      "event",
      "probability",
      "even-number",
      "greater-than",
      "cube",
    ],
    band: "geometry",
  },
  {
    id: "variability",
    term: "variability",
    forms: ["variability"],
    plain:
      "How much the values in a data set differ from one another. The range, interquartile range and mean absolute deviation each measure it.",
    example: "Scores 70, 80, 90 have more variability than 79, 80, 81.",
    uses: [
      "data",
      "range-statistics",
      "interquartile-range",
      "mean-absolute-deviation",
    ],
    band: "6",
  },
  {
    id: "weighted-mean",
    term: "weighted mean",
    forms: [
      "weighted mean",
      "weighted means",
      "weighted average",
      "weighted averages",
    ],
    plain:
      "A mean where some values count more than others: multiply each value by its weight, add, then divide by the total weight.",
    example:
      "Scores 80 with weight 1 and 90 with weight 3: $(80 + 3 \\times 90) \\div 4 = 87.5$.",
    uses: ["mean-average", "sum"],
    noLink: ["more than", "weight"],
    band: "6",
  },
  {
    id: "with-replacement",
    term: "with replacement",
    forms: ["with replacement"],
    plain:
      "Putting each drawn item back before the next draw, so every draw has the same choices and the same probabilities.",
    example:
      "Draw a marble from 3 red and 2 blue, put it back, and $P(\\text{red})$ is $\\tfrac35$ again.",
    uses: ["probability"],
    band: "7",
  },
  {
    id: "without-replacement",
    term: "without replacement",
    forms: ["without replacement"],
    plain:
      "Keeping each drawn item out, so later draws have fewer items to choose from and their probabilities change.",
    example:
      "From 3 red and 2 blue, draw a red and keep it: the next red has probability $\\tfrac24$.",
    uses: ["probability"],
    noLink: ["change"],
    band: "7",
  },
  {
    id: "z-score",
    term: "$z$-score",
    forms: ["z-score", "z-scores"],
    plain:
      "How many standard deviations a value is above the mean (positive) or below it (negative).",
    example:
      "With mean 70 and standard deviation 5, a score of 80 has $z = (80 - 70) \\div 5 = 2$.",
    uses: ["standard-deviation", "mean-average"],
    band: "algebra-2",
  },
];
