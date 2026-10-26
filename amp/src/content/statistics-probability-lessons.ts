import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const statisticsProbabilityMethods: Record<string, ProblemMethod> = {
  "normal-model-rule": {
    goal: "Given a normal model, find a percent for a region or an interval for a percent, compare by $z$-score, or decide if the model fits.",
    intuition:
      "The standard deviation (SD) is a typical distance from the mean. For data that are symmetric with one peak, fixed shares lie within 1, 2 and 3 standard deviations of the mean: about 68%, 95% and 99.7%. This is the 68–95–99.7 rule.",
    terms: [
      [
        "normal model",
        "A symmetric, single-peaked, bell-shaped distribution described by its mean and standard deviation.",
      ],
      [
        "$z$-score",
        "The number of standard deviations a value is above (positive) or below (negative) the mean: $z=(x-\\text{mean})\\div\\text{SD}$.",
      ],
      [
        "tail",
        "The part of the distribution beyond a boundary, far from the mean.",
      ],
    ],
    method: [
      "Convert each boundary to a number of standard deviations from the mean: subtract the mean and divide by the SD.",
      "Sketch the bell curve and shade the region. The curve is symmetric, so the shares on the two sides of the mean match.",
      "Use 34%, 13.5% and 2.35% for the strips between 0–1, 1–2 and 2–3 SDs on one side, or use the symmetric 68%, 95% and 99.7% and split the outside share between two tails.",
      "To compare values from different data sets, compare their $z$-scores: the larger $z$-score is farther above its own mean.",
    ],
    watch:
      "Percent outside the interval is split between two tails, so one tail holds half of it. Also check the shape first: skewed data or data with two peaks should not be given a normal model.",
  },
  "random-variable-distribution": {
    goal: "Define a numerical random variable, find probabilities of its values, read its distribution from a chart and complete a distribution.",
    intuition:
      "A random variable gives each outcome of a chance experiment a number, such as the number of heads in three tosses. Its probability distribution lists every possible value with the probability of that value. The probabilities add to 1.",
    terms: [
      [
        "random variable",
        "A rule that assigns one number to each outcome of a chance experiment.",
      ],
      [
        "probability distribution",
        "A list or graph of every value of the random variable and its probability.",
      ],
      [
        "$P(X=k)$",
        "The probability that the random variable $X$ takes the value $k$.",
      ],
    ],
    method: [
      "List the equally likely outcomes, or read the counts from the chart, and find the value of $X$ for each outcome.",
      "For $P(X=k)$, count the outcomes whose value is $k$ and divide by the total number of equally likely outcomes.",
      "For an event such as $X\\ge k$, add the probabilities of every value that satisfies it.",
      "Check that all the probabilities add to 1; a missing probability is 1 minus the sum of the others.",
    ],
    watch:
      "The values of $X$ are usually not equally likely, even when the underlying outcomes are. Count the outcomes behind each value.",
  },
  "theoretical-distribution-expectation": {
    goal: "Build a random variable's distribution from equally likely outcomes or independent trials, and find probabilities and the expected value.",
    intuition:
      "A theoretical distribution comes from counting equally likely outcomes or multiplying probabilities of independent trials. The expected value is the long-run average: each value times its probability, added together.",
    terms: [
      [
        "expected value",
        "$E(X)=x_1P(x_1)+x_2P(x_2)+\\cdots$, the average of $X$ over many repetitions.",
      ],
      [
        "independent trials",
        "Trials in which the result of one does not change the probabilities of another.",
      ],
      [
        "binomial count",
        "The number of successes in a fixed number of independent trials with the same success probability.",
      ],
    ],
    method: [
      "Name the random variable and list its possible values.",
      "Find each probability by counting equally likely outcomes, or by $\\binom{n}{k}p^k(1-p)^{n-k}$ for $k$ successes in $n$ independent trials.",
      "For the expected value, multiply each value by its probability and add; keep losses as negative values.",
      "Reduce fractions and state units, such as dollars per game.",
    ],
    watch:
      "Do not average the values without weights. Also count ordered outcomes: the sum 7 of two dice happens 6 ways but the sum 2 only 1 way.",
  },
  "empirical-distribution-expectation": {
    goal: "From observed frequencies, find relative frequencies, the expected value per trial and the expected total for a larger group.",
    intuition:
      "An empirical distribution comes from data instead of a theory. Divide each observed count by the total number of observations to estimate its probability. The expected value uses those estimates as weights.",
    terms: [
      [
        "relative frequency",
        "A count divided by the total number of observations.",
      ],
      [
        "empirical distribution",
        "A distribution built from observed data rather than from a theoretical model.",
      ],
    ],
    method: [
      "Read each count and the total number of observations.",
      "Divide each count by the total to get relative frequencies, which estimate probabilities.",
      "The expected value per trial is the sum of value × relative frequency, which equals the sum of value × count divided by the total.",
      "To scale up, multiply the expected value per trial by the size of the larger group.",
    ],
    watch:
      "A relative frequency uses the total of all observations in the denominator, not the number of categories. Estimates from few trials can differ from the true probabilities.",
  },
  "strategy-expected-value": {
    goal: "Compare the expected payoffs of games, a warranty or a sure amount against a gamble, and select the statement the expected values justify.",
    intuition:
      "When outcomes are uncertain, a fair way to compare options is the average result over many repetitions: the expected value. Count the cost, the payoff of every outcome and each outcome's probability.",
    terms: [
      ["expected net gain", "Expected payoff minus the cost to play."],
      ["strategy", "A choice made before the chance outcome is known."],
    ],
    method: [
      "For each option, multiply every payoff by its probability and add; include costs as negative amounts.",
      "Compare the expected values using the same units and the same time period.",
      "Choose the higher expected gain, or the lower expected cost, and say that this is the better average result.",
    ],
    watch:
      "A large prize or a low chance does not decide by itself; the expected value combines both. Expected value describes the long-run average, and a person may also weigh risk.",
  },
  "fair-selection-procedure": {
    goal: "Choose a random procedure that gives each person the same chance, and compute the chance each person has under a given procedure.",
    intuition:
      "A selection is fair when every person has exactly the same probability of being chosen. With equally likely outcomes, that means every person matches the same number of outcomes.",
    terms: [
      [
        "fair procedure",
        "A random procedure in which each person has the same chance of being chosen.",
      ],
      [
        "equally likely outcomes",
        "Outcomes that each have the same probability.",
      ],
    ],
    method: [
      "List the equally likely outcomes of the procedure, such as the 36 ordered pairs of two dice or the 12 faces of a die.",
      "Count how many outcomes select each person.",
      "The procedure is fair only if those counts are all equal. The chance for a person is their count divided by the total.",
      "To repair an unfair split, discard (re-roll) the outcomes that do not fit evenly.",
    ],
    watch:
      "Adding two dice or counting heads gives values that are not equally likely. Dividing by a number that does not divide the outcomes evenly gives some people more outcomes.",
  },
  "simulation-consistency-check": {
    goal: "Use a chart of simulated results to find the fraction at least as extreme as an observed result and decide if the model is consistent.",
    intuition:
      "If a model is true, simulating it many times shows how much results vary by chance alone. An observed result that falls in the far tail of those simulated results would rarely happen under the model, which is evidence against the model.",
    terms: [
      [
        "simulation",
        "Repeating a chance process many times, with a computer or by hand, to see what outcomes the model produces.",
      ],
      [
        "at least as extreme",
        "As far from the model's expected result as the observed result, or farther, in the directions that matter.",
      ],
      [
        "cutoff",
        "A stated proportion; a result rarer than this is treated as inconsistent with the model.",
      ],
    ],
    method: [
      "Find the observed result and the center of the simulated results.",
      "Add the simulated counts that are at least as extreme as the observed result, including the observed value; count both directions unless the claim is one-sided.",
      "Divide by the number of simulations to get the proportion.",
      "If the proportion is less than the cutoff, the result is not consistent with the model. Otherwise it is consistent.",
    ],
    watch:
      "Count the observed value and every value beyond it, not just the observed bar. A consistent result does not prove the model; it only fails to contradict it.",
  },
  "randomization-test-decision": {
    goal: "Find the proportion of re-randomized differences as or more extreme than the observed one and decide significance at a stated cutoff.",
    intuition:
      "In an experiment, people are assigned to groups at random. If the treatment did nothing, the group labels would not matter. Reshuffling the labels many times shows how big a difference random assignment alone can create.",
    terms: [
      [
        "re-randomization",
        "Reshuffling the group labels among the same results and recomputing the difference.",
      ],
      [
        "significant",
        "Rare enough under chance alone, by a stated cutoff, that chance is an unlikely explanation.",
      ],
    ],
    method: [
      "Find the observed difference between the group means, with the order stated in the problem.",
      "Add the re-randomization counts that are as large or larger; for a two-sided question, add both directions.",
      "Divide by the total number of re-randomizations to get a proportion.",
      "If it is less than the cutoff, the difference is significant. Because assignment was random, a significant difference supports a treatment effect.",
    ],
    watch:
      "Include both directions when the question asks whether the groups differ, and only the stated direction when it asks about one group being higher. Not significant does not prove there is no effect.",
  },
  "report-flaw-critique": {
    goal: "Find the flaws that weaken a report's headline: voluntary response, convenience or small sample, no margin of error or truncated axis.",
    intuition:
      "A statistic is only as good as how the data were gathered and shown. Ask who was counted and how, how many, how precise the result is, and how the graph is drawn.",
    terms: [
      [
        "voluntary response",
        "A sample made of people who chose to respond; they tend to feel strongly.",
      ],
      [
        "convenience sample",
        "People chosen because they are easy to reach, who may differ from the whole group.",
      ],
      [
        "margin of error",
        "A range of plausible sampling error around a reported percent.",
      ],
      [
        "truncated axis",
        "A graph scale that starts above zero, making a small difference look large.",
      ],
    ],
    method: [
      "Who was counted: a random sample from the whole group, or people who volunteered or were convenient?",
      "How many: is the sample large enough for a stable estimate?",
      "How precise: is a margin of error given, and is the reported difference larger than it?",
      "How shown: does a bar chart's axis start at zero? Name each check that fails; a report can fail more than one.",
    ],
    watch:
      "Name only flaws the report actually has. A large random sample is not fixed by anything else, and a stated margin of error does not repair a biased sample.",
  },
  "model-residual-conclusion": {
    goal: "Read residuals to choose the justified conclusion: a curved pattern, no pattern, an extrapolation or which of two models fits better.",
    intuition:
      "A residual is observed minus predicted. A model that suits the data leaves small residuals with no pattern. A shape in the residuals shows the model has the wrong form, and a prediction far outside the data is not supported by the fit.",
    terms: [
      ["residual", "Observed value minus predicted value."],
      ["extrapolation", "Predicting for inputs outside the range of the data."],
      [
        "sum of squared residuals",
        "The sum of each residual squared; smaller means the model stays closer to the data.",
      ],
    ],
    method: [
      "Compute or read each residual, keeping its sign.",
      "Look at the order of the signs: random switching is fine, but a run such as positive, negative, positive suggests curvature.",
      "To compare models, square the residuals before adding, so that positive and negative residuals cannot cancel.",
      "Compare the input being predicted with the range of the data. Outside that range, the fit gives no evidence.",
    ],
    watch:
      "Residuals that add to zero can still show a clear pattern. Both signs are expected; judge the pattern and size, not the sign.",
  },
};

export const statisticsProbabilityPrinciples: Record<string, string> = {
  "normal-model-rule":
    "For a normal distribution with mean $\\mu$ and standard deviation $\\sigma$, about 68%, 95% and 99.7% of values lie within $1\\sigma$, $2\\sigma$ and $3\\sigma$ of $\\mu$. The $z$-score $z=(x-\\mu)/\\sigma$ measures distance from the mean in standard deviations. The rule describes only symmetric, single-peaked distributions.",
  "random-variable-distribution":
    "A random variable $X$ assigns a number to each outcome. Its distribution gives $P(X=x)$ for every value $x$, with $0\\le P(X=x)\\le1$ and $\\sum P(X=x)=1$. For equally likely outcomes, $P(X=x)$ is the number of outcomes with value $x$ divided by the total number of outcomes.",
  "theoretical-distribution-expectation":
    "The expected value of a discrete random variable is $E(X)=\\sum xP(X=x)$. For $k$ successes in $n$ independent trials with success probability $p$, $P(X=k)=\\binom{n}{k}p^k(1-p)^{n-k}$ and $E(X)=np$.",
  "empirical-distribution-expectation":
    "From $N$ observations, the relative frequency $f_x/N$ estimates $P(X=x)$, and $\\sum x\\,(f_x/N)=(\\sum xf_x)/N$ estimates $E(X)$. For $M$ future trials the expected total is $M$ times this estimate. Estimates improve as $N$ grows.",
  "strategy-expected-value":
    "For payoffs $x_i$ with probabilities $p_i$ and cost $c$, the expected net gain is $\\sum x_ip_i-c$. Comparing expected values tells which option has the better long-run average; it does not account for risk or for probabilities that are only estimated.",
  "fair-selection-procedure":
    "A procedure on $N$ equally likely outcomes selects person $j$ with probability (outcomes assigned to $j$) ÷ $N$. It is fair for $m$ people exactly when each person is assigned $N/m$ outcomes. Discarding outcomes (re-rolling) changes $N$ to the number retained.",
  "simulation-consistency-check":
    "Under a model, the proportion of simulated results at least as extreme as an observed result estimates the probability of a result that extreme. A proportion below a stated cutoff is evidence against the model; a larger one means the data do not contradict it. This does not prove the model true.",
  "randomization-test-decision":
    "When groups are formed by random assignment and the treatment has no effect, every reshuffling of labels is equally likely. The proportion of reshuffled differences as or more extreme than the observed one measures how often chance alone produces such a difference. A small proportion supports a treatment effect.",
  "report-flaw-critique":
    "Conclusions about a population need a random sample that is large enough, a stated margin of error, and graphs whose scales do not exaggerate. Voluntary-response and convenience samples are biased by who is included, and more data collected the same way does not fix that bias.",
  "model-residual-conclusion":
    "A residual is observed minus predicted. A suitable model leaves residuals without pattern; a systematic pattern shows the model's form is wrong. Smaller $\\sum e_i^2$ means a closer fit. A fit supports predictions only within the range of the data.",
};

const lesson = (
  l: Omit<Lesson, "sections" | "closingSections"> & {
    intuition: string[];
    method: {
      title: string;
      paragraphs: string[];
      keepTogetherInPrint?: boolean;
    };
    formal: { title: string; paragraphs: string[] };
  },
): Lesson => {
  const { intuition, method, formal, ...rest } = l;
  return {
    ...rest,
    sections: [
      { stage: "intuition", title: "The idea", paragraphs: intuition },
    ],
    closingSections: [
      { stage: "method", ...method },
      { stage: "formal", ...formal },
    ],
  };
};

export const statisticsProbabilityLessons: Lesson[] = [
  lesson({
    id: "normal-distributions",
    title: "Normal models and the 68–95–99.7 rule",
    summary:
      "For symmetric, single-peaked data, about 68%, 95% and 99.7% of values lie within 1, 2 and 3 standard deviations of the mean. A $z$-score counts those standard deviations.",
    templateIds: ["normal-model-rule"],
    objectives: [
      "Find the percent of a normal model between, above or below boundaries stated as mean ± a number of standard deviations.",
      "Compare values from different data sets with $z$-scores, and recognize when a normal model is not appropriate.",
    ],
    intuition: [
      "The standard deviation (SD) is a typical distance of values from the mean. Many measurements, such as heights or the fill weights of boxes from one machine, pile up symmetrically around the mean with one peak. Such data are described by a normal model, a bell-shaped curve.",
      "A normal model has a fixed pattern: about 68% of values lie within 1 SD of the mean, 95% within 2 SDs and 99.7% within 3 SDs. A $z$-score tells how many SDs a value is from its mean, so values from different scales can be compared.",
    ],
    workedExample: {
      prompt:
        "Adult heights in a city are approximately normal with mean 160 cm and standard deviation 6 cm. About what percent of adults are taller than 172 cm?",
      steps: [
        "Convert the boundary to SDs: $172-160=12$ cm and $12\\div6=2$, so 172 cm is 2 SDs above the mean ($z=2$).",
        "The rule says 95% of heights lie within 2 SDs of the mean, so $100\\%-95\\%=5\\%$ lie farther away.",
        "That 5% is split equally between the two tails by symmetry: 2.5% are more than 2 SDs below the mean and 2.5% are more than 2 SDs above.",
        "Check: the share above the boundary cannot exceed 50%, and 2.5% is a small tail for a boundary 2 SDs out.",
      ],
      answer: "About 2.5%",
    },
    method: {
      title: "From a boundary to a percent",
      keepTogetherInPrint: true,
      paragraphs: [
        "Compute the $z$-score of each boundary: subtract the mean and divide by the SD. A boundary at $z=1$, $2$ or $3$ is covered by the rule.",
        "Sketch the curve and shade the region. Within $\\pm1$ SD holds 68%, so each strip between the mean and 1 SD holds 34%. The strip from 1 to 2 SDs holds 13.5% on each side, and from 2 to 3 SDs holds 2.35%.",
        "Add the shaded strips, or subtract from 100%. To compare two values from different data sets, the larger $z$-score is farther above its own mean, whatever the raw scores are.",
      ],
    },
    formal: {
      title: "Conditions and notation",
      paragraphs: [
        "For a normal distribution with mean $\\mu$ and standard deviation $\\sigma$, the $z$-score of $x$ is $z=(x-\\mu)/\\sigma$. About 68%, 95% and 99.7% of values have $|z|\\le1$, $|z|\\le2$ and $|z|\\le3$.",
        "A normal model is appropriate only for data that are roughly symmetric with a single peak and a mean near the median. Skewed data, with a long tail on one side, and data with two peaks are not described by these percents.",
      ],
    },
    pitfalls: [
      "Split the percent outside an interval between two tails; one tail is half of it.",
      "Do not compare raw scores from different tests; compare $z$-scores.",
      "Check the shape before applying the rule: a long tail or two peaks means the data are not normal.",
    ],
    parentGuide:
      "Ask the learner why 160 ± 12 cm covers about 95% of heights when the SD is 6 cm.",
  }),
  lesson({
    id: "random-variables",
    title: "Random variables and their distributions",
    summary:
      "A random variable gives each outcome a number. Its distribution lists each value with its probability, and the probabilities add to 1.",
    templateIds: ["random-variable-distribution"],
    objectives: [
      "Define a numerical random variable for an experiment and find the probability of one of its values.",
      "Read a probability distribution from a bar chart and complete a distribution whose probabilities add to 1.",
    ],
    intuition: [
      "Toss a fair coin three times. The outcomes are sequences such as HTH. A random variable turns each outcome into a number; for example, $X$ = the number of heads. A name such as 'more heads than tails' is not yet a number.",
      "The values of $X$ are 0, 1, 2 and 3, but they are not equally likely, because some values can happen in more ways. The probability distribution lists every value of $X$ with its probability; a bar chart draws the distribution with bar heights as probabilities or as counts of equally likely outcomes.",
    ],
    workedExample: {
      prompt:
        "A fair coin is tossed 3 times. Let $X$ be the number of heads. Find $P(X\\ge2)$.",
      steps: [
        "There are $2^3=8$ equally likely sequences: HHH, HHT, HTH, THH, HTT, THT, TTH, TTT.",
        "Count heads in each: $X=3$ once, $X=2$ three times, $X=1$ three times, $X=0$ once. The counts 1, 3, 3, 1 add to 8.",
        "$X\\ge2$ means $X=2$ or $X=3$: $3+1=4$ sequences, so $P(X\\ge2)=\\frac{4}{8}=\\frac{1}{2}$.",
        "Check: the probabilities $\\frac18,\\frac38,\\frac38,\\frac18$ add to 1.",
      ],
      answer: "$\\frac{1}{2}$",
    },
    method: {
      title: "Reading a distribution",
      keepTogetherInPrint: true,
      paragraphs: [
        "List the values of $X$ and count the equally likely outcomes behind each. For a bar chart of counts, the bar heights are those counts and their sum is the total.",
        "For one value, divide its count by the total. For an event such as $X\\ge k$, add the counts of all values in the event first. If one probability is missing, subtract the others from 1.",
      ],
    },
    formal: {
      title: "Definition",
      paragraphs: [
        "A random variable $X$ is a function from the outcomes of an experiment to the real numbers. Its distribution gives $P(X=x)$ for every possible value $x$, and $\\sum P(X=x)=1$.",
        "For an event such as $X\\ge k$, $P(X\\ge k)=\\sum_{x\\ge k}P(X=x)$ because the values are mutually exclusive.",
      ],
    },
    pitfalls: [
      "Do not give every value of $X$ the same probability just because there are several values.",
      "Divide by the total of all outcomes, not by the number of values.",
      "A definition such as a pair of numbers, a color or a yes/no answer is not yet a numerical random variable.",
    ],
    parentGuide:
      "Ask the learner to list the eight outcomes of three coin tosses and sort them by the number of heads.",
  }),
  lesson({
    id: "theoretical-distributions",
    title: "Theoretical distributions and expected value",
    summary:
      "Count equally likely outcomes, or multiply probabilities of independent trials, to build a distribution. The expected value is each value times its probability, added.",
    templateIds: ["theoretical-distribution-expectation"],
    objectives: [
      "Build the distribution of a sum of two dice and of a count of successes in three independent trials.",
      "Compute an expected value exactly as a weighted sum.",
    ],
    intuition: [
      "A theoretical distribution comes from reasoning about the experiment before any data. For two fair dice, 36 ordered pairs are equally likely, and the sum 7 can happen in 6 pairs while the sum 2 happens in only one.",
      "The expected value is the long-run average of the random variable. Weight each value by its probability and add; a loss counts as a negative value.",
    ],
    workedExample: {
      prompt:
        "You roll one fair die. If it shows a six you win 4 dollars; otherwise you lose 1 dollar. Let $X$ be your net gain. Find $E(X)$.",
      steps: [
        "$P(X=4)=\\frac16$ and $P(X=-1)=\\frac56$.",
        "$E(X)=4\\cdot\\frac16+(-1)\\cdot\\frac56=\\frac46-\\frac56=-\\frac16$.",
        "So the expected net gain is $-\\frac16$ dollar per game: over many games you lose about 17 cents per game on average.",
        "Check: the probabilities add to $\\frac16+\\frac56=1$, and the average is between the two payoffs $-1$ and $4$.",
      ],
      answer: "$-\\frac16$ dollar per game",
    },
    method: {
      title: "Building and averaging",
      keepTogetherInPrint: true,
      paragraphs: [
        "For equally likely outcomes, count the outcomes for each value and divide by the total. For three independent trials with success probability $p$, the probability of $k$ successes is the number of orders, $\\binom{3}{k}$, times $p^k(1-p)^{3-k}$.",
        "To get $E(X)$, multiply each value by its probability, add, and simplify. Expected value need not be a possible value of $X$.",
      ],
    },
    formal: {
      title: "Definition",
      paragraphs: [
        "For a discrete random variable, $E(X)=\\sum xP(X=x)$. For $n$ independent trials with success probability $p$, the number of successes has $P(X=k)=\\binom nk p^k(1-p)^{n-k}$ and $E(X)=np$.",
        "The probabilities must be correct for the stated assumptions: equally likely outcomes, and independence between trials.",
      ],
    },
    pitfalls: [
      "Do not average the possible values without weights.",
      "Count ordered outcomes; (1, 6) and (6, 1) are different pairs.",
      "In a binomial probability, include the orders, the successes and the failures.",
    ],
    parentGuide:
      "Ask the learner to list every pair of dice that sum to 7 and explain why 7 is the most likely sum.",
  }),
  lesson({
    id: "empirical-distributions",
    title: "Empirical distributions and expected value",
    summary:
      "Divide each observed count by the total to estimate probabilities, then use those weights to find the expected value per trial and for a larger group.",
    templateIds: ["empirical-distribution-expectation"],
    objectives: [
      "Find relative frequencies from observed counts.",
      "Compute the expected value per trial and scale it to a larger group.",
    ],
    intuition: [
      "Sometimes there is no theory to count outcomes, so we observe. If a bar chart shows how many of 40 households have each number of cars, then count ÷ 40 is the relative frequency of each number. These relative frequencies estimate probabilities.",
      "The expected value per household weights each number of cars by its relative frequency. It is the average number of cars per household in the sample.",
    ],
    workedExample: {
      prompt:
        "In 20 days, a shop had 0, 1, 2 delayed orders on 8, 7 and 5 days. Estimate the expected number of delayed orders per day, and the total expected over 200 days.",
      steps: [
        "Relative frequencies: $\\frac{8}{20}=0.4$, $\\frac{7}{20}=0.35$, $\\frac{5}{20}=0.25$; they add to 1.",
        "$E(X)=0(0.4)+1(0.35)+2(0.25)=0.85$ delayed orders per day.",
        "Equivalent: $(0\\cdot8+1\\cdot7+2\\cdot5)\\div20=17\\div20=0.85$.",
        "For 200 days, expect $0.85\\times200=170$ delayed orders.",
      ],
      answer: "0.85 per day; about 170 in 200 days",
    },
    method: {
      title: "From counts to expectation",
      keepTogetherInPrint: true,
      paragraphs: [
        "Total the counts to get the number of observations. Divide each count by that total. To find the expected value, either weight values by relative frequencies, or multiply each value by its count, add, and divide by the total.",
        "To scale up, multiply by the size of the larger group. The result is an estimate, and it is more trustworthy when it comes from more observations.",
      ],
    },
    formal: {
      title: "Estimates and models",
      paragraphs: [
        "An empirical distribution assigns each value its relative frequency $f_x/N$. Its mean $\\sum x f_x/N$ is the sample mean, and it estimates $E(X)$ under the assumption that future trials resemble the observed ones.",
        "A theoretical model and an empirical distribution can differ from chance variation; the differences usually shrink as the number of trials grows.",
      ],
    },
    pitfalls: [
      "Divide by the total number of observations, not the number of categories.",
      "Weight each value by its count; the plain average of the values is wrong when counts differ.",
      "Scale by the ratio of group sizes, not by the sample size.",
    ],
    parentGuide:
      "Ask the learner to explain why the expected value (0.85) is not one of the observed values.",
  }),
  lesson({
    id: "decision-strategies",
    title: "Choose a strategy by expected value",
    summary:
      "Multiply each payoff by its probability, subtract costs and compare the totals. The option with the better average result is the one the numbers support.",
    templateIds: ["strategy-expected-value"],
    objectives: [
      "Compare games, a warranty, or a sure amount versus a gamble by expected value.",
      "State the decision that the expected values justify, and the assumption behind it.",
    ],
    intuition: [
      "A game with a large prize may win rarely; a small prize may win often. Expected value combines the prize and its chance into one average per play, so choices can be compared fairly.",
      "For a warranty, the expected cost without it is the repair bill times the probability that you need it. Compare that with the warranty's price.",
    ],
    workedExample: {
      prompt:
        "A warranty costs 60 dollars. Without it, there is a probability of $\\frac15$ that you pay a 400-dollar repair bill and otherwise pay nothing. Which choice has the lower expected cost?",
      steps: [
        "Expected cost without the warranty: $400\\cdot\\frac15+0\\cdot\\frac45=80$ dollars.",
        "The warranty costs 60 dollars for certain.",
        "Because $60<80$, buying the warranty has the lower expected cost, by 20 dollars on average.",
        "Check: the 80-dollar average lies between the possible costs of 0 and 400 dollars.",
      ],
      answer: "Buy the warranty",
    },
    method: {
      title: "Compare averages",
      keepTogetherInPrint: true,
      paragraphs: [
        "For each option, add payoff × probability over every outcome, and subtract any cost to play. Use the same units for every option.",
        "Choose the higher expected gain, or the lower expected cost. The conclusion holds on average over many repetitions; for a single decision, a person may also care about the risk of a bad outcome.",
      ],
    },
    formal: {
      title: "Assumptions",
      paragraphs: [
        "With payoffs $x_i$, probabilities $p_i$ and cost $c$, the expected net gain is $\\sum x_ip_i-c$.",
        "The conclusion is only as good as the probabilities and payoffs in the model. When the probabilities are estimated from data, the decision could change if the estimates change.",
      ],
    },
    pitfalls: [
      "Do not choose by the biggest prize or the highest chance alone.",
      "Include the cost to play as a negative amount.",
      "Use the probability of the event itself, not its complement, for its payoff.",
    ],
    parentGuide:
      "Ask the learner what the 80 dollars means when a repair bill is either 0 or 400 dollars.",
  }),
  lesson({
    id: "fair-random-decisions",
    title: "Fair random selection",
    summary:
      "A selection is fair when every person has the same chance. Count the equally likely outcomes and check that each person gets the same number.",
    templateIds: ["fair-selection-procedure"],
    objectives: [
      "Choose a random procedure that gives each person the same chance.",
      "Compute the chance of each person under a given procedure.",
    ],
    intuition: [
      "To choose one of 7 students fairly, each student must have exactly the same probability, $\\frac17$. Drawing one of 7 identical slips does that.",
      "Many natural-looking methods are unfair. Adding two dice gives sums that are not equally likely, so students matched to middle sums would be chosen far more often.",
    ],
    workedExample: {
      prompt:
        "To choose one of 8 students numbered 1 to 8, a teacher rolls a fair 12-sided die and uses the remainder after dividing by 8 (remainder 0 means student 8). What is the probability that student 2 is chosen?",
      steps: [
        "List the 12 equally likely results and the students they choose: results 1 to 8 choose students 1 to 8; results 9, 10, 11, 12 choose students 1, 2, 3, 4.",
        "Student 2 is chosen by results 2 and 10: 2 of 12 results.",
        "The probability is $\\frac{2}{12}=\\frac16$, but student 6 has only $\\frac1{12}$ because only result 6 selects them.",
        "The procedure is not fair. Re-rolling any result above 8 would give each student exactly $\\frac18$.",
      ],
      answer: "$\\frac16$ (not fair)",
    },
    method: {
      title: "Test a procedure",
      keepTogetherInPrint: true,
      paragraphs: [
        "List the equally likely outcomes, such as the 36 ordered pairs of two dice, and mark which person each outcome selects. A procedure is fair only if every person has the same number of marked outcomes.",
        "If the outcomes do not divide evenly, discard the extras and repeat the experiment. Then the probability of each person is 1 divided by the number of people.",
      ],
    },
    formal: {
      title: "Definition",
      paragraphs: [
        "A selection among $m$ people is fair if $P(\\text{person } j)=\\frac1m$ for every $j$. For $N$ equally likely outcomes, that requires $N/m$ outcomes for each person.",
        "When outcomes outside a chosen set are discarded and the experiment repeated, each retained outcome is equally likely to be the one that finally occurs.",
      ],
    },
    pitfalls: [
      "A sum of dice or a count of heads has unequally likely values.",
      "Divide by the total number of equally likely outcomes, not by the number of people.",
      "A remainder rule is fair only when the number of outcomes is a multiple of the number of people.",
    ],
    parentGuide:
      "Ask the learner to explain why a sum of two dice should not be used to choose between 11 people.",
  }),
  lesson({
    id: "simulation-model-checks",
    title: "Is the result consistent with the model?",
    summary:
      "Simulate the model many times. If the proportion of simulated results as extreme as the observed one is smaller than a stated cutoff, the model is not consistent with the data.",
    templateIds: ["simulation-consistency-check"],
    objectives: [
      "Find the proportion of simulated results at least as extreme as an observed result.",
      "Decide whether the observed result is consistent with the model at a stated cutoff.",
    ],
    intuition: [
      "A company says a spinner lands on blue half the time. In 20 spins you see blue 15 times. Is that just luck? Simulate the model: repeat 'spin 20 times with probability one half' 100 times and record how many blues each set has.",
      "The simulated counts show how much chance alone moves the result. If few simulated sets are as extreme as 15, the observed result would be rare if the model were true, which is evidence against the model.",
    ],
    workedExample: {
      prompt:
        "A spinner is said to land on blue with probability $\\frac12$. In 100 simulated sets of 20 spins under that model, a count of blue of 15, 16, 17 and 18 or more occurred in 3, 1, 1 and 0 sets. You observed 15 blue in 20 spins and claim blue is more likely than half. Treat the result as not consistent if fewer than 5% of simulated sets are as extreme. Is it consistent?",
      steps: [
        "The question is about getting 15 or more blue, so add the simulated sets with 15 or more: $3+1+1+0=5$.",
        "That is 5 of 100 sets, or 5%.",
        "The result is called not consistent only if the proportion is less than 5%. Since 5% is not less than 5%, the result is consistent with the model.",
        "Check: the observed count itself is included in the 5, as the problem requires.",
      ],
      answer: "Consistent at the 5% cutoff",
    },
    method: {
      title: "Count the tail",
      keepTogetherInPrint: true,
      paragraphs: [
        "Find the center of the simulated results, usually the model's expected count. Add the heights of the bars at the observed value and beyond. For a claim that the result is 'different', count both directions at the same distance from the center.",
        "Divide by the number of simulations and compare with the cutoff. A small proportion is evidence against the model; a larger one means the data do not contradict it.",
      ],
    },
    formal: {
      title: "What the decision means",
      paragraphs: [
        "The proportion of simulated results at least as extreme as the observed result estimates the probability, if the model is true, of getting a result that extreme.",
        "A result consistent with the model does not prove the model; other models may also be consistent. A cutoff of 5% is a convention, and the cutoff should be stated before looking at the data.",
      ],
    },
    pitfalls: [
      "Include the observed value and every value beyond it.",
      "Count both tails unless the claim is one-sided.",
      "A small proportion means the result is rare under the model, which is evidence against the model.",
    ],
    parentGuide:
      "Ask the learner why 14 blue out of 20 spins might not be strong evidence against a fair spinner.",
  }),
  lesson({
    id: "randomization-tests",
    title: "Is the treatment difference significant?",
    summary:
      "Reshuffle the group labels many times. If differences as large as the observed one rarely arise, random assignment alone is an unlikely explanation.",
    templateIds: ["randomization-test-decision"],
    objectives: [
      "Find the proportion of re-randomized differences as or more extreme than the observed difference.",
      "Decide significance at a stated cutoff and say what it supports.",
    ],
    intuition: [
      "In an experiment, volunteers are randomly assigned to two groups, and the group means differ by 3 points. Is the treatment responsible, or can random assignment alone create a difference that large?",
      "If the treatment did nothing, the results would be the same under any assignment. So reshuffle the labels many times among the same results and record the difference each time. That shows what chance alone produces.",
    ],
    workedExample: {
      prompt:
        "Volunteers were randomly assigned to study guide $A$ or $B$. The mean score for $A$ minus $B$ was 4 points. In 200 reshuffles, differences of 4 or more, or −4 or less, occurred 6 times. Is the difference significant at a 5% cutoff for a difference in either direction?",
      steps: [
        "Count the reshuffles with a difference of 4 or more, or −4 or less: 6.",
        "The proportion is $\\frac{6}{200}=0.03=3\\%$.",
        "Since $3\\%<5\\%$, the difference is significant: reshuffling rarely gives a difference this large.",
        "Because people were randomly assigned, this supports a real effect of the study guide rather than chance.",
      ],
      answer: "Significant (3%)",
    },
    method: {
      title: "Read the reshuffled differences",
      keepTogetherInPrint: true,
      paragraphs: [
        "Find the observed difference, with the order stated in the problem. In the chart of reshuffled differences, add the counts as large as the observed difference, in both directions for 'different', or in the stated direction for 'higher'.",
        "Divide by the number of reshuffles. If the proportion is less than the cutoff, call the difference significant; otherwise chance alone could plausibly explain it.",
      ],
    },
    formal: {
      title: "Interpretation",
      paragraphs: [
        "If treatment had no effect, each reshuffling of group labels would be as likely as the actual assignment. The proportion of reshuffled differences as or more extreme than the observed one is the estimated probability of such a difference arising by chance.",
        "Significance supports a treatment effect only because assignment was random. A difference that is not significant does not show there is no effect; the experiment may simply be too small to detect it.",
      ],
    },
    pitfalls: [
      "For 'different', include both directions.",
      "Include the observed difference in the count.",
      "Not significant does not prove the treatment does nothing.",
    ],
    parentGuide:
      "Ask the learner what the reshuffling represents and why it is allowed only if the treatment did nothing.",
  }),
  lesson({
    id: "statistical-report-critique",
    title: "Find the flaw in a report",
    summary:
      "Ask who was counted and how, how many, how precise the result is, and how the graph is drawn. Name the checks that fail.",
    templateIds: ["report-flaw-critique"],
    objectives: [
      "Identify voluntary response, a convenience sample, a too-small sample, a missing margin of error and a truncated axis.",
      "Pick the two flaws in a report that has two.",
    ],
    intuition: [
      "A headline such as 'Most customers prefer the Garden Melt' sounds certain. But the number depends on whom the company asked, how many it asked, how precise the number is, and how the result is drawn.",
      "Each question points to a different possible flaw. A report can have any of them, and fixing one does not fix the others.",
    ],
    workedExample: {
      prompt:
        "A website asks visitors to vote for their favorite sandwich. 2,000 visitors vote; 51% choose the Garden Melt and 49% choose the other. The headline says 'Most customers prefer the Garden Melt.' The report gives no margin of error. Which flaws weaken the headline?",
      steps: [
        "Who was counted: visitors chose to vote, so this is voluntary response; they may not represent all customers.",
        "How many: 2,000 is large, so the sample size is not the problem.",
        "How precise: no margin of error is given, and each percent is uncertain by about 2 points with 2,000 votes, so a 2-point lead could be an accident of sampling.",
        "The flaws are voluntary response and no margin of error. A larger sample of the same kind would not repair the bias.",
      ],
      answer: "Voluntary response and no margin of error",
    },
    method: {
      title: "A four-part check",
      keepTogetherInPrint: true,
      paragraphs: [
        "Who: random sample from the whole group (good), or volunteers or convenient people (bad). How many: a very small sample gives an unstable estimate. How precise: a margin of error should accompany a percent, and the lead of one choice over the other should be larger than about twice it. How shown: a bar chart's axis should start at zero.",
        "Name only the checks that fail, with the evidence from the report.",
      ],
    },
    formal: {
      title: "Why each flaw matters",
      paragraphs: [
        "Voluntary-response and convenience samples are biased: the people included differ systematically from the whole population, and a larger sample collected the same way keeps the bias.",
        "A margin of error describes sampling variability only for a random sample. A truncated axis does not change the numbers, but it makes bar heights misleading, because the heights are no longer in proportion to the values.",
      ],
    },
    pitfalls: [
      "A large sample does not repair a biased sample.",
      "A stated margin of error does not repair a biased sample.",
      "Do not name a flaw the report does not have.",
    ],
    parentGuide:
      "Ask the learner to find a headline in a news story and apply the four questions to it.",
  }),
  lesson({
    id: "model-validation",
    title: "Check a model against data",
    summary:
      "A residual is observed minus predicted. Patternless, small residuals support a model; patterns and predictions outside the data do not.",
    templateIds: ["model-residual-conclusion"],
    objectives: [
      "Read a residual table and decide whether a pattern shows the model has the wrong form.",
      "Compare two models with the sum of squared residuals, and recognize extrapolation.",
    ],
    intuition: [
      "A model predicts a value, and the data give the observed value. The residual is observed minus predicted. A residual of 0 is a perfect prediction; positive means the model predicted too low.",
      "If a model is a good form for the data, its residuals look like random scatter. If the residuals are positive, then negative, then positive again, the data curve while the model goes straight.",
    ],
    workedExample: {
      prompt:
        "A line predicts seedling height at weeks 1 to 7. The residuals are 6, 1, −3, −4, −3, 1, 2. Is a line a good model?",
      steps: [
        "The residuals add to $6+1-3-4-3+1+2=0$, but a zero sum does not show a good fit.",
        "Their signs run positive, negative, positive: a pattern, not random scatter.",
        "The data curve away from the line, so the straight line has the wrong form.",
        "A curved model should be tried.",
      ],
      answer: "No: the pattern shows a curved model is needed",
    },
    method: {
      title: "Read the residuals",
      keepTogetherInPrint: true,
      paragraphs: [
        "Compute residuals with their signs. Check the order of the signs and the size compared with the data. Random switching and small size are good; runs and curves are not.",
        "To compare two models on the same data, square each residual before adding. Positive and negative residuals then cannot cancel. The smaller sum of squares stays closer to the data.",
        "Check the $x$-value you predict at. If it is outside the range of the data, the fit says nothing about it.",
      ],
    },
    formal: {
      title: "Definitions",
      paragraphs: [
        "For observed $y_i$ and predicted $\\hat y_i$, the residual is $e_i=y_i-\\hat y_i$. Least-squares lines make the residuals add to zero, so the sum alone cannot detect a poor model.",
        "Predicting for $x$ outside the range of observed $x$-values is extrapolation. The pattern of residuals inside the range gives no evidence that the same form continues beyond it.",
      ],
    },
    pitfalls: [
      "Residuals that add to zero can still follow a pattern.",
      "Do not compare models by adding signed residuals; square them first.",
      "Do not trust a prediction far outside the data because the fit inside is good.",
    ],
    parentGuide:
      "Ask the learner why a line fitted to a plant's early growth might fail at week 40.",
  }),
];
