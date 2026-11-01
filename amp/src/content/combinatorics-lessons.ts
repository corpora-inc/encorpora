import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const stages: Lesson["sections"][number] = {
  stage: "intuition",
  title: "Stages, options and outcomes",
  paragraphs: [
    "This lesson uses multiplying whole numbers. Picture getting dressed. First you choose a shirt, then you choose pants. Each of these choices is called a stage. The things you can pick from at a stage are its options.",
    "An outcome is one complete result: one choice at every stage. Shirt $A$ with pants 1 is one outfit. Shirt $A$ with pants 2 is a different outfit. Two outcomes are different when at least one stage has a different choice.",
    "Counting outcomes means counting complete outfits, not counting the shirts and pants on the lists.",
  ],
};
const probability: Lesson["sections"][number] = {
  stage: "intuition",
  title: "Probability from equally likely outcomes",
  paragraphs: [
    "An experiment is a process with an uncertain result, such as rolling a number cube. Its outcomes are the possible results. Outcomes are equally likely when none is favored: each face of a fair cube has the same chance. An event is a set of outcomes, such as “an even number”, which contains 2, 4 and 6.",
    "When the outcomes are equally likely, the probability of an event is the number of outcomes in the event divided by the number of all outcomes. For an even number on a cube, that is 3/6 = 1/2. A probability is between 0 and 1: 0 means the event cannot happen and 1 means it must. Reduce the fraction by dividing its numerator and denominator by a common factor; the value does not change.",
    "The complement of an event is the set of outcomes not in it. Every outcome is in exactly one of the two, so their probabilities add to 1. The probability that an event does not happen is 1 minus its probability: for “not even” on a cube, 1 − 1/2 = 1/2.",
  ],
};
const probabilityBasics: Lesson["sections"][number] = {
  stage: "intuition",
  title: "Probability from equally likely outcomes",
  paragraphs: [
    "An experiment is something with a result you cannot know ahead of time, such as rolling a number cube. A number cube is a die with 6 faces numbered 1 to 6. Each possible result is called an outcome.",
    "Outcomes are equally likely when each has the same chance. Each face of a fair cube is equally likely. An event is a group of outcomes you ask about, such as “an even number”: 2, 4 or 6.",
    "When the outcomes are equally likely, the probability of an event is the number of outcomes in it divided by the number of all outcomes. For an even number on a cube, that is $\\frac{3}{6} = \\frac{1}{2}$. A probability is between 0 and 1. A probability of 0 means the event cannot happen, and 1 means it must.",
    "The complement of an event is every outcome not in it. For “even”, the complement is “odd”: 1, 3 or 5. Every outcome is in exactly one of the two, so their probabilities add to 1. So the probability that an event does not happen is 1 minus its probability: $1 - \\frac{1}{2} = \\frac{1}{2}$.",
  ],
};
const groups: Lesson["sections"][number] = {
  title: "Count groups by removing orders",
  paragraphs: [
    "A combination is a group chosen from a collection when order does not matter. Choosing Ana and then Ben gives the same pair as choosing Ben and then Ana. An ordered selection, or arrangement, records positions, so those two choices are different arrangements.",
    "Count arrangements first: fill the positions one at a time, with one fewer option each time because nothing is chosen twice. Choosing 2 of 4 people in order gives 4 × 3 = 12 arrangements. Each pair of people appears in 2 × 1 = 2 orders, so 12 ÷ 2 = 6 pairs. In general, divide the number of arrangements by the number of orders of one group. A group of 3 has 3 × 2 × 1 = 6 orders.",
  ],
};

export const combinatoricsLessons: Lesson[] = [
  {
    id: "counting-principle",
    title: "Count choices by multiplying",
    summary:
      "Picture choosing an outfit: one shirt from 3, then one pair of pants from 2. Each choice is a stage, and the things you can pick are its options. Every shirt can go with every pair of pants, so there are 3 groups of 2 outfits: $3 \\times 2 = 6$. When every option at one stage goes with every option at the others, multiply the numbers of options.",
    templateIds: ["counting-principle"],
    includeGeneratedRepresentation: false,
    senses: {
      product: "product-multiply",
      factor: "factor-number",
      factors: "factor-number",
      whole: "whole",
    },
    noLink: ["third"],
    objectives: [
      "Explain why the numbers of options at separate stages multiply.",
      "Count the outcomes of two to four stages, including codes where symbols may repeat.",
    ],
    sections: [
      stages,
      {
        title: "Why the counts multiply",
        paragraphs: [
          "A tree diagram draws one branch for each option at each stage. In the figure, 3 branches lead to shirts $A$, $B$ and $C$. From each shirt, 2 branches lead to pants 1 and 2. Each path from the start to the right end is one outfit, and each outfit has exactly one path.",
          "Each shirt has the same 2 pants branches. So the paths form 3 equal groups of 2, and equal groups are counted by multiplying: $3 \\times 2 = 6$ outfits.",
          "Add a third stage, such as 4 hats. Each of the 6 paths gets 4 new branches: $6 \\times 4 = 24$ outfits.",
          "This is called the multiplication principle. Suppose a process has stages, and the number of options at each stage does not depend on earlier choices. Then the number of outcomes is the product of the numbers of options. The product is the answer when you multiply. The order you multiply in does not matter: $3 \\times 2 \\times 4 = 2 \\times 4 \\times 3$.",
        ],
        illustration: "counting-tree",
      },
      {
        title: "Repeated symbols and when not to multiply",
        paragraphs: [
          "A code is a row of positions, each filled with a symbol such as a digit. When symbols may repeat, every position has all the options. A 3-digit code using the digits 0 to 9 has $10 \\times 10 \\times 10 = 1000$ possible codes, from 000 to 999. Each number you multiply, here each 10, is called a factor. Use one factor for each position.",
          "Multiply only when one choice is made at every stage. Sometimes you choose just one item from one combined list, such as one sandwich or one soup from 4 sandwiches and 3 soups. That is a single stage, so add: $4 + 3 = 7$ options.",
          "If an earlier choice removes options from a later stage, multiply the numbers that are actually left. That kind of count is called an arrangement without repetition.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A café's lunch special has one sandwich, one soup and one drink. There are 4 sandwiches, 3 soups and 2 drinks to choose from. How many different lunch specials are possible?",
      steps: [
        "Name the stages. There are three: choose a sandwich, choose a soup and choose a drink. Each special makes one choice at every stage.",
        "Each of the 4 sandwiches can go with any of the 3 soups. That makes 4 equal groups of 3: $4 \\times 3 = 12$ sandwich-and-soup pairs.",
        "Each of those 12 pairs can go with either of the 2 drinks: $12 \\times 2 = 24$.",
        "Changing any one choice gives a different special, and no special is counted twice. So there are $4 \\times 3 \\times 2 = 24$ specials.",
      ],
      answer: "24",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Multiplication principle: suppose one choice is made at each stage, and the number of options at a stage does not depend on earlier choices. Then the number of outcomes is the product of the numbers of options.",
        ],
      },
    ],
    pitfalls: [
      "Do not add the numbers of options when one choice is made at every stage. $4 + 3 + 2$ counts menu items, not complete specials.",
      "Use one factor for every stage, even a stage with only 2 options.",
      "For a code, use one factor per position. 3 positions with 10 digits give $10 \\times 10 \\times 10$, not $3 \\times 10$.",
    ],
    parentGuide:
      "Lay out 3 shirts and 2 pairs of pants, or cards naming them. Build every outfit one at a time and count. Then add 2 hats and predict the new total before building it.",
  },
  {
    id: "permutation-count",
    title: "Count ordered arrangements",
    summary:
      "Fill positions one at a time; each position has one fewer option because nothing is used twice.",
    templateIds: ["permutation-count"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Recognize when the order or position of chosen items matters.",
      "Count arrangements without repetition as a product of decreasing factors, including factorials.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "When order matters",
        paragraphs: [
          "This lesson uses whole-number multiplication. An arrangement is a selection in which each chosen item fills a different position, such as first, second and third place, or the offices of president and secretary. Order matters: if Ana is president and Ben is secretary, swapping them gives a different arrangement.",
          "Without repetition means that an item cannot fill two positions. A runner cannot finish both first and second; a book on a shelf occupies one place. Each position therefore has fewer options than the one before it.",
        ],
      },
      {
        title: "Fill the positions one at a time",
        paragraphs: [
          "Treat each position as a stage. With 5 runners, first place can go to any of 5. Whoever wins first, 4 runners remain for second. Whoever takes second, 3 remain for third. The number of options at each stage does not depend on which runners were chosen, only on how many have been used.",
          "Every choice for first place combines with every remaining choice for second, and so on, so the counts multiply: 5 × 4 × 3 = 60. This is the multiplication principle with options that decrease by one. Each of the 60 results names a different runner for at least one place.",
        ],
        illustration: "permutation-slots",
      },
      {
        title: "Factorials and partial arrangements",
        paragraphs: [
          "Arranging all of $n$ different items uses every whole number from $n$ down to 1. This product is written $n$! and read “$n$ factorial”. Five books can stand on a shelf in 5! = 5 × 4 × 3 × 2 × 1 = 120 orders.",
          "Arranging only $r$ of $n$ items uses $r$ decreasing factors starting at $n$. Filling 3 places from 5 runners uses 5 × 4 × 3. The same count is 5! ÷ 2! = 120 ÷ 2 = 60: the factorial of the 2 unused runners divides out the factors you do not need. The number of factors always equals the number of positions filled.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A club with 9 members will choose a president, a vice president and a secretary. No member can hold more than one office. In how many different ways can the offices be filled?",
      steps: [
        "Order matters: the same three members in different offices give a different result.",
        "The president can be any of the 9 members. After that, 8 members remain for vice president, then 7 for secretary.",
        "Multiply the numbers of options: 9 × 8 × 7 = 504.",
        "There are 3 offices, so there are 3 factors, starting at 9 and decreasing by one.",
      ],
      answer: "504",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Arranging $r$ of $n$ different items without repetition gives $n \\times (n - 1) \\times \\cdots \\times (n - r + 1) = n! \\div (n - r)!$ arrangements.",
        ],
      },
    ],
    pitfalls: [
      "Do not use 9 × 9 × 9: a member already chosen cannot hold a second office.",
      "Do not divide by the orders of the group when positions differ; dividing counts unordered groups instead.",
      "The number of factors is the number of positions filled, not the number of people available.",
    ],
    parentGuide:
      "Write 5 names on cards and award first, second and third place, then shuffle and award again. Count how many choices remain at each step before multiplying.",
  },
  {
    id: "combination-count",
    title: "Count groups when order does not matter",
    summary:
      "Count ordered selections, then divide by the number of orders of each group.",
    templateIds: ["combination-count"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Distinguish combinations, where order does not matter, from arrangements.",
      "Count groups by dividing the number of arrangements by the number of orders of one group.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Groups and arrangements",
        paragraphs: [
          "This lesson uses multiplication and division of whole numbers. A combination is a group chosen from a collection when the chosen items have the same role. A committee of 2 whose members have equal roles is the same committee whichever member is named first.",
          "An arrangement records positions, so it counts the same people in different orders separately. To count groups, count arrangements first and then correct for the repeated orders. Arrangements without repetition multiply decreasing factors: choosing 2 of 4 people in order gives 4 × 3 = 12.",
        ],
      },
      {
        title: "Each group appears once for every order",
        paragraphs: [
          "The figure lists all 12 ordered pairs from $A$, $B$, $C$ and $D$. Each column holds the same two people in both orders, such as AB and BA. Those two arrangements form one committee, so the 12 arrangements make 12 ÷ 2 = 6 committees.",
          "Every group is repeated the same number of times: once for each way to order its own members. A group of 3 can be ordered in 3 × 2 × 1 = 6 ways; a group of 4 in 4 × 3 × 2 × 1 = 24 ways. Dividing the arrangements by that number counts each group exactly once.",
        ],
        illustration: "combination-orders",
      },
      {
        title: "Notation and checks",
        paragraphs: [
          "The number of groups of $k$ items chosen from $n$ is written $\\binom{n}{k}$ and read “$n$ choose $k$”. For a committee of 4 from 10 students: arrangements 10 × 9 × 8 × 7 = 5040, orders of one committee 4 × 3 × 2 × 1 = 24, and 5040 ÷ 24 = 210 committees.",
          "Handshakes are pairs: if each of 9 people shakes hands once with every other person, there are 9 × 8 ÷ 2 = 36 handshakes. Choosing who serves also chooses who does not, so choosing 4 of 10 gives the same count as choosing 6 of 10 to leave out. A group count is always a whole number; a fraction signals a missing factor.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A teacher will choose 4 students from a group of 10 to form a committee. Every committee member has the same role. How many different committees are possible?",
      steps: [
        "Order does not matter: the same 4 students chosen in another order form the same committee.",
        "Count ordered selections: 10 × 9 × 8 × 7 = 5040.",
        "Each committee appears once for every order of its 4 members: 4 × 3 × 2 × 1 = 24 times.",
        "Divide to count each committee once: 5040 ÷ 24 = 210.",
      ],
      answer: "210",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Each group of $k$ items appears in $k$! arrangements, so the number of groups is the number of arrangements divided by $k$!.",
        ],
      },
    ],
    pitfalls: [
      "If members have equal roles, do not stop at 10 × 9 × 8 × 7; that counts each committee 24 times.",
      "Divide by the orders of one group, $k \\times (k - 1) \\times \\cdots \\times 1$, not by the number of people available.",
      "Use combinations only when order does not matter; for different offices, count arrangements.",
    ],
    parentGuide:
      "Write 4 names on cards. List every ordered pair, then circle the pairs that contain the same two people. Count the circles and compare with 4 × 3 ÷ 2.",
  },
  {
    id: "combination-probability",
    title: "Probability by counting groups",
    summary:
      "Divide the number of favorable groups by the number of all equally likely groups.",
    templateIds: ["combination-probability"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Count all equally likely groups and the favorable groups for a random selection.",
      "Find exact probabilities for all, none or exactly some items of one kind, in lowest terms.",
    ],
    sections: [
      probability,
      groups,
      {
        title: "Count the favorable groups",
        paragraphs: [
          "When several items are drawn at random at the same time, every group of that size is equally likely. The outcomes are the groups, so the denominator of the probability is the number of all groups.",
          "A favorable group with exactly 2 red marbles and 1 blue marble is made in two stages: choose the 2 red marbles, then choose the 1 blue marble. Every red pair combines with every blue choice, so multiply the two counts. For 5 red and 4 blue marbles: red pairs (5 × 4) ÷ (2 × 1) = 10, blue choices 4, favorable groups 10 × 4 = 40.",
          "For “none is red”, every chosen marble is blue, so count groups chosen from the blue marbles alone. For “all are red”, count groups chosen from the red marbles alone. The probability that at least one is red is 1 minus the probability that none is red.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A bag holds 5 red marbles and 4 blue marbles. Three marbles are drawn at random at the same time, so every set of 3 marbles is equally likely. What is the probability that exactly 2 are red?",
      steps: [
        "Count all sets of 3 from the 9 marbles: (9 × 8 × 7) ÷ (3 × 2 × 1) = 504 ÷ 6 = 84.",
        "Choose 2 of the 5 red marbles: (5 × 4) ÷ (2 × 1) = 20 ÷ 2 = 10 ways. Choose 1 of the 4 blue marbles: 4 ways.",
        "Every red pair combines with every blue marble: 10 × 4 = 40 favorable sets.",
        "Divide and reduce by the common factor 4: 40/84 = 10/21.",
      ],
      answer: "10/21",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "When every group is equally likely, the probability of an event is the number of favorable groups divided by the number of all groups.",
        ],
      },
    ],
    pitfalls: [
      "Count groups in both the numerator and the denominator; do not count arrangements in one and groups in the other.",
      "“Exactly 2 red” needs the other marble to be blue, so multiply by the number of ways to choose it.",
      "Reduce the final fraction, and check that it lies between 0 and 1.",
    ],
    parentGuide:
      "Put 3 red and 2 blue objects in a bag. List all 10 pairs that could be drawn together, mark those with one of each color, and compare the fraction with the calculation.",
  },
  {
    id: "independent-events-probability",
    title: "Independent events: both, neither and at least one",
    summary:
      "An event is a result you ask about, and its probability is how likely it is, from 0 to 1. Two events are independent when one result does not change the chance of the other, like rolling a die and tossing a coin. To find the chance that both happen, multiply their chances. To find the chance that at least one happens, find the chance that neither happens and subtract it from 1.",
    templateIds: ["independent-events-probability"],
    includeGeneratedRepresentation: false,
    senses: {
      event: "event",
      events: "event",
      cube: "cube",
      face: "face-solid",
      faces: "face-solid",
      complement: "complement-probability",
      complements: "complement-probability",
      product: "product-multiply",
      change: "change",
      changes: "change",
    },
    noLink: ["mean"],
    objectives: [
      "Find the probability that two independent events both happen, or that neither happens.",
      "Find the probability of at least one event as 1 minus the probability of neither.",
    ],
    sections: [
      probabilityBasics,
      {
        title: "Independent results multiply",
        paragraphs: [
          "Two events are independent when knowing whether one happened does not change the probability of the other. A cube roll and a separate spin are independent, because the cube cannot affect the spinner.",
          "Drawing two marbles without putting the first one back is not independent. The first draw changes what is left for the second.",
          "Pair every cube result with every spinner result. A cube has 6 results and a spinner with 5 equal sections has 5. So there are $6 \\times 5 = 30$ equally likely pairs.",
          "In the grid, “even cube result and spinner greater than 3” fills 3 columns of 2 cells: $3 \\times 2 = 6$ pairs. The probability is $\\frac{6}{30}$, which equals $\\frac{3}{6} \\times \\frac{2}{5}$.",
          "That is why, for independent events $A$ and $B$, the probability that both happen is the product of their probabilities. The product is the answer when you multiply.",
          "Independent is not the same as mutually exclusive. Mutually exclusive events cannot happen together, like an even and an odd result on one roll. Independent events can happen together, as the shaded cells show.",
        ],
        illustration: "independent-grid",
      },
      {
        title: "Neither and at least one",
        paragraphs: [
          "If $A$ and $B$ are independent, then “not $A$” and “not $B$” are independent too. So the chance that neither happens is the chance $A$ fails times the chance $B$ fails.",
          "An even cube result has probability $\\frac{1}{2}$, and a spin above 3 has probability $\\frac{2}{5}$. They fail with probabilities $1 - \\frac{1}{2} = \\frac{1}{2}$ and $1 - \\frac{2}{5} = \\frac{3}{5}$. So neither happens with probability $\\frac{1}{2} \\times \\frac{3}{5} = \\frac{3}{10}$.",
          "“At least one happens” is the complement of “neither happens”: every pair is in exactly one of the two. So its probability is $1 - \\frac{3}{10} = \\frac{7}{10}$.",
          "Simply adding does not work: $\\frac{1}{2} + \\frac{2}{5} = \\frac{9}{10}$ counts the 6 pairs where both happen twice. Subtracting that overlap once, $\\frac{6}{30} = \\frac{1}{5}$, gives $\\frac{9}{10} - \\frac{1}{5} = \\frac{7}{10}$, the same answer.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A fair number cube with faces numbered 1 through 6 is rolled, and a spinner with 5 equal sections numbered 1 through 5 is spun. The two results are independent. What is the probability that at least one of these happens: the cube shows an even number; the spinner lands on a number greater than 3?",
      steps: [
        "Find each event's probability. An even number is 2, 4 or 6, so its probability is $\\frac{3}{6} = \\frac{1}{2}$. A spin greater than 3 is 4 or 5, so its probability is $\\frac{2}{5}$.",
        "Find the chance each event fails, by subtracting from 1: $1 - \\frac{1}{2} = \\frac{1}{2}$ and $1 - \\frac{2}{5} = \\frac{3}{5}$.",
        "The results are independent, so multiply the failures to get the chance that neither happens: $\\frac{1}{2} \\times \\frac{3}{5} = \\frac{3}{10}$.",
        "At least one happens exactly when it is not true that neither happens. So subtract from 1: $1 - \\frac{3}{10} = \\frac{7}{10}$.",
      ],
      answer: "7/10",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "$P(A)$ means the probability of event $A$. For independent events, $P(A \\text{ and } B) = P(A) \\times P(B)$. Their complements are independent too, and $P(\\text{at least one}) = 1 - P(\\text{neither})$.",
        ],
      },
    ],
    pitfalls: [
      "Do not just add the probabilities for “at least one”. The pairs where both happen would be counted twice.",
      "Multiply only for independent results. A draw without replacement changes the second probability.",
      "Independent does not mean mutually exclusive. Independent events can happen together.",
    ],
    parentGuide:
      "Roll a cube and toss a coin together 20 times, and tally even-and-heads. Then list the 12 equally likely pairs and compare the tally with $\\frac{3}{12}$.",
  },
  {
    id: "expected-value",
    title: "Expected value",
    summary:
      "A game may pay different amounts. Its expected payoff is the average per play over many repetitions: multiply each possible payoff by its chance and add. Subtract the cost of playing to find the expected gain or loss.",
    templateIds: ["expected-value"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Calculate an expected payoff as the sum of each payoff times its probability.",
      "Find an expected net gain by subtracting a fixed cost, and interpret its sign.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A weighted average of payoffs",
        paragraphs: [
          "This lesson uses fraction multiplication and addition. A payoff is the number of points or tokens a result is worth. When the results are equally likely, a payoff's probability is the number of results that give it divided by the number of all results.",
          "The expected value is the sum of each payoff multiplied by its probability. It is a weighted average: likely payoffs count for more. It describes the long run: over many repetitions, the average payoff per repetition approaches the expected value. It need not be a payoff that can actually occur on one play.",
        ],
      },
      {
        title: "A spinner example",
        paragraphs: [
          "The spinner has 8 equal sections, so each section has probability 1/8. One section pays 12 points, three pay 4 points and four pay 0 points. The probabilities of 12, 4 and 0 points are 1/8, 3/8 and 4/8.",
          "Weight and add: 12 × 1/8 + 4 × 3/8 + 0 × 4/8 = 12/8 + 12/8 + 0/8 = 24/8 = 3. Check with 8 ideal spins, one landing on each section: 12 + 4 + 4 + 4 = 24 points in 8 spins, which is 3 points per spin.",
        ],
        illustration: "expected-spinner",
      },
      {
        title: "Cost and net gain",
        paragraphs: [
          "If a game costs a fixed amount to play, the net gain of a result is its payoff minus the cost. Because the same cost is paid on every play, the expected net gain is the expected payoff minus the cost. With the spinner above and a cost of 4 points: 3 − 4 = −1.",
          "A negative expected net gain means the player loses that much per play on average over many plays. A positive value means an average gain. An expected net gain of 0 describes a fair game: gains and losses balance in the long run.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A game costs 5 tokens to play. The player spins a spinner that has 4 equal sections: 1 section awards 10 tokens and the other 3 sections award 0 tokens. What is the expected net gain, in tokens, from one play? Give a loss as a negative number.",
      steps: [
        "Each of the 4 equal sections has probability 1/4, so 10 tokens has probability 1/4 and 0 tokens has probability 3/4.",
        "Expected payout: 10 × 1/4 + 0 × 3/4 = 10/4 + 0/4 = 10/4 = 5/2.",
        "Subtract the cost paid on every play: 5/2 − 5 = −5/2.",
        "The expected net gain is negative: over many plays, a player loses 5/2 tokens per play on average.",
      ],
      answer: "−5/2",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "The expected value is the probability-weighted sum of the payoffs; subtracting a fixed cost subtracts it from the expected value.",
        ],
      },
    ],
    pitfalls: [
      "Do not average the distinct payoffs; weight each payoff by how many sections show it.",
      "Subtract the cost once from the expected payout, not once for every section.",
      "An expected value need not be a payoff that can occur on one play.",
    ],
    parentGuide:
      "Make a paper spinner with 4 equal sections, one marked 10 and three marked 0. Spin 20 times, find the average payoff, and compare it with the expected value of 5/2.",
  },
];

export const combinatoricsMethods: Record<string, ProblemMethod> = {
  "counting-principle": {
    goal: "Count complete outcomes of a process with one choice at each stage.",
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
    },
    intuition:
      "A stage is one choice in a process, such as choosing a sandwich. Its options are the things you can pick. An outcome is one complete result, with one choice at every stage. When every option at one stage can go with every option at the others, the outcomes form equal groups. So multiply: 8 sandwiches and 5 soups make $8 \\times 5 = 40$ lunches.",
    terms: [
      [
        "outcome",
        "A stage is one decision in the process; one outcome makes a choice at every stage.",
      ],
      "outcome",
    ],
    method: [
      "List the stages and the number of options at each.",
      "Check that every option at one stage can go with every option at the others.",
      "Multiply the numbers of options. For a code, use one number per position.",
    ],
    watch: "Add only when you choose one item from a single combined list.",
  },
  "permutation-count": {
    goal: "Count ways to fill distinct positions without using an item twice.",
    terms: ["permutation", "factorial"],
    method: [
      "Confirm that order or position matters.",
      "Give the first position all $n$ options and each later position one fewer.",
      "Multiply one factor for each position filled.",
    ],
    watch:
      "Do not repeat a factor: a chosen item cannot fill a second position.",
  },
  "combination-count": {
    goal: "Count groups chosen from a collection when order does not matter.",
    terms: [
      "combination",
      ["factorial", "A group of $k$ items can be put in order in $k!$ ways."],
    ],
    method: [
      "Count ordered selections as a product of decreasing factors.",
      "Count the orders of one group.",
      "Divide the ordered selections by the orders of one group.",
    ],
    watch:
      "Divide by the orders of the group, not by the size of the collection.",
  },
  "combination-probability": {
    goal: "Find the probability of a random selection by counting equally likely groups.",
    terms: ["probability", "combination"],
    method: [
      "Count all groups of the drawn size.",
      "Count favorable groups, multiplying the choices from each kind.",
      "Divide favorable by all groups and reduce.",
    ],
    watch: "Count groups, not arrangements, in both numerator and denominator.",
  },
  "independent-events-probability": {
    goal: "Find both, neither or at-least-one probabilities for two independent results.",
    senses: {
      event: "event",
      complements: "complement-probability",
      cube: "cube",
      change: "change",
    },
    noLink: ["tails", "multiple"],
    intuition:
      "An event is a result you ask about, such as the coin landing heads up. Its probability is the number of outcomes in it divided by all the equally likely outcomes. Two events are independent when one result does not change the chance of the other. The chance that an event fails is 1 minus its chance. For both, multiply the chances. For neither, multiply the chances of failing. At least one is everything except neither.",
    terms: ["independent-events", "complement-probability"],
    method: [
      "Find each event's probability from its equally likely outcomes.",
      "For both, multiply the two probabilities.",
      "For neither, multiply the chances of failing. For at least one, subtract the chance of neither from 1.",
    ],
    watch:
      "Do not add the probabilities for at least one. That counts both twice.",
  },
  "expected-value": {
    goal: "Find the long-run average payoff of one play, after any cost.",
    terms: ["expected-value", "net-gain"],
    method: [
      "Find each payoff's probability: its sections divided by all sections.",
      "Multiply each payoff by its probability and add.",
      "For a net gain, subtract the cost of one play.",
    ],
    watch:
      "Weight each payoff by its probability; do not average the distinct payoffs.",
  },
};

export const combinatoricsPrinciples: Record<string, string> = {
  "counting-principle":
    "Multiplication principle: suppose one choice is made at each stage, and the number of options at a stage does not depend on earlier choices. Then the number of outcomes is the product of the numbers of options.",
  "permutation-count":
    "Arranging $r$ of $n$ different items without repetition gives $n \\times (n - 1) \\times \\cdots \\times (n - r + 1) = n! \\div (n - r)!$ arrangements.",
  "combination-count":
    "Each group of $k$ items appears in $k$! arrangements, so the number of groups is the number of arrangements divided by $k$!.",
  "combination-probability":
    "When every group is equally likely, the probability of an event is the number of favorable groups divided by the number of all groups.",
  "independent-events-probability":
    "For independent events, $P(A \\text{ and } B) = P(A) \\times P(B)$. The complements are independent too, and $P(\\text{at least one}) = 1 - P(\\text{neither})$.",
  "expected-value":
    "The expected value is the probability-weighted sum of the payoffs; subtracting a fixed cost subtracts it from the expected value.",
};
