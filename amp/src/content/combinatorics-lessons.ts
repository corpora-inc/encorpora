import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const stages: Lesson["sections"][number] = {
  title: "Stages, options and outcomes",
  paragraphs: [
    "This lesson uses whole-number multiplication. A counting problem describes a process made of stages. At each stage you make one choice from a list of options. An outcome is one complete result of the whole process: one choice at every stage. Two outcomes are different when at least one stage has a different choice.",
    "For an outfit made of one shirt and one pair of pants, the stages are “choose a shirt” and “choose pants”. Shirt A with pants 1 is one outcome; shirt A with pants 2 is another. Counting outcomes means counting complete results, not counting the items on the lists.",
  ],
};
const probability: Lesson["sections"][number] = {
  title: "Probability from equally likely outcomes",
  paragraphs: [
    "An experiment is a process with an uncertain result, such as rolling a number cube. Its outcomes are the possible results. Outcomes are equally likely when none is favored: each face of a fair cube has the same chance. An event is a set of outcomes, such as “an even number”, which contains 2, 4 and 6.",
    "When the outcomes are equally likely, the probability of an event is the number of outcomes in the event divided by the number of all outcomes. For an even number on a cube, that is 3/6 = 1/2. A probability is between 0 and 1: 0 means the event cannot happen and 1 means it must. Reduce the fraction by dividing its numerator and denominator by a common factor; the value does not change.",
    "The complement of an event is the set of outcomes not in it. Every outcome is in exactly one of the two, so their probabilities add to 1. The probability that an event does not happen is 1 minus its probability: for “not even” on a cube, 1 − 1/2 = 1/2.",
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
      "When every option at one stage combines with every option at the others, multiply the numbers of options.",
    templateIds: ["counting-principle"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain why the numbers of options at separate stages multiply.",
      "Count the outcomes of two to four stages, including codes in which symbols may repeat.",
    ],
    sections: [
      stages,
      {
        title: "Why the counts multiply",
        paragraphs: [
          "A tree diagram draws one branch for each option at each stage. In the figure, 3 branches lead to shirts A, B and C. From each shirt, 2 branches lead to pants 1 and 2. Every path from the start to the right end is one outfit, and every outfit has exactly one path.",
          "Each shirt carries the same 2 pants branches, so the paths form 3 equal groups of 2. Equal groups are counted by multiplication: 3 × 2 = 6 outfits. Adding a third stage, such as 4 hats, gives each of the 6 paths 4 new branches: 6 × 4 = 24.",
          "This is the multiplication principle. If a process has stages, and the number of options at each stage does not depend on what was chosen earlier, the number of outcomes is the product of the numbers of options. The order in which you multiply does not matter: 3 × 2 × 4 = 2 × 4 × 3.",
        ],
        illustration: "counting-tree",
      },
      {
        title: "Repeated symbols and when not to multiply",
        paragraphs: [
          "A code is a sequence of positions, each filled with a symbol. When symbols may repeat, every position has the full set of options. A 3-position code using the digits 0 through 9 has 10 × 10 × 10 = 1000 possibilities, from 000 to 999. Use one factor for each position.",
          "Multiply only when one choice is made at every stage. If you choose one item from a single combined list, such as one sandwich or one soup from 4 sandwiches and 3 soups, there is one stage: add the lists, giving 4 + 3 = 7 options. If an earlier choice removes options from a later stage, multiply the numbers actually available; that case is called an arrangement without repetition.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A café's lunch special has one sandwich, one soup and one drink. There are 4 sandwiches, 3 soups and 2 drinks to choose from. How many different lunch specials are possible?",
      steps: [
        "There are three stages: choose a sandwich, choose a soup and choose a drink. Each special makes one choice at every stage.",
        "Each of the 4 sandwiches can go with any of the 3 soups: 4 × 3 = 12 sandwich-and-soup pairs.",
        "Each of those 12 pairs can go with any of the 2 drinks: 12 × 2 = 24.",
        "Changing any one choice gives a different special, and none is counted twice, so there are 4 × 3 × 2 = 24 specials.",
      ],
      answer: "24",
    },
    pitfalls: [
      "Do not add the numbers of options when one choice is made at every stage: 4 + 3 + 2 counts menu items, not complete specials.",
      "Use one factor for every stage, including a stage with only 2 options.",
      "For a code, multiply one factor per position: 3 positions with 10 digits give 10 × 10 × 10, not 3 × 10.",
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
          "Arranging all of n different items uses every whole number from n down to 1. This product is written n! and read “n factorial”. Five books can stand on a shelf in 5! = 5 × 4 × 3 × 2 × 1 = 120 orders.",
          "Arranging only r of n items uses r decreasing factors starting at n. Filling 3 places from 5 runners uses 5 × 4 × 3. The same count is 5! ÷ 2! = 120 ÷ 2 = 60: the factorial of the 2 unused runners divides out the factors you do not need. The number of factors always equals the number of positions filled.",
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
        title: "Groups and arrangements",
        paragraphs: [
          "This lesson uses multiplication and division of whole numbers. A combination is a group chosen from a collection when the chosen items have the same role. A committee of 2 whose members have equal roles is the same committee whichever member is named first.",
          "An arrangement records positions, so it counts the same people in different orders separately. To count groups, count arrangements first and then correct for the repeated orders. Arrangements without repetition multiply decreasing factors: choosing 2 of 4 people in order gives 4 × 3 = 12.",
        ],
      },
      {
        title: "Each group appears once for every order",
        paragraphs: [
          "The figure lists all 12 ordered pairs from A, B, C and D. Each column holds the same two people in both orders, such as AB and BA. Those two arrangements form one committee, so the 12 arrangements make 12 ÷ 2 = 6 committees.",
          "Every group is repeated the same number of times: once for each way to order its own members. A group of 3 can be ordered in 3 × 2 × 1 = 6 ways; a group of 4 in 4 × 3 × 2 × 1 = 24 ways. Dividing the arrangements by that number counts each group exactly once.",
        ],
        illustration: "combination-orders",
      },
      {
        title: "Notation and checks",
        paragraphs: [
          "The number of groups of k items chosen from n is written $\\binom{n}{k}$ and read “n choose k”. For a committee of 4 from 10 students: arrangements 10 × 9 × 8 × 7 = 5040, orders of one committee 4 × 3 × 2 × 1 = 24, and 5040 ÷ 24 = 210 committees.",
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
    pitfalls: [
      "If members have equal roles, do not stop at 10 × 9 × 8 × 7; that counts each committee 24 times.",
      "Divide by the orders of one group, k × (k − 1) × … × 1, not by the number of people available.",
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
      "Multiply probabilities of independent events, and use complements for neither and at least one.",
    templateIds: ["independent-events-probability"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the probability that two independent events both happen, or that neither happens.",
      "Find the probability of at least one event as 1 minus the probability of neither.",
    ],
    sections: [
      probability,
      {
        title: "Independent results multiply",
        paragraphs: [
          "Two events are independent when knowing whether one happened does not change the probability of the other. A cube roll and a separate spin are independent: the cube cannot affect the spinner. Drawing two marbles without putting the first back is not independent, because the first draw changes what remains.",
          "Pair every cube result with every spinner result. A cube has 6 results and a 5-section spinner has 5, so there are 6 × 5 = 30 equally likely pairs. In the grid, “even cube result and spinner greater than 3” fills 3 columns of 2 cells: 3 × 2 = 6 pairs. The probability is 6/30, which equals 3/6 × 2/5.",
          "That is why, for independent events A and B, the probability that both happen is the product of their probabilities. Independent is different from mutually exclusive. Mutually exclusive events cannot happen together, like an even and an odd result on one roll. Independent events with positive probabilities can happen together, as the hatched cells show.",
        ],
        illustration: "independent-grid",
      },
      {
        title: "Neither and at least one",
        paragraphs: [
          "If A and B are independent, so are their complements. The probability that neither happens is the probability that A fails times the probability that B fails. With 1/2 for an even cube result and 2/5 for a spin above 3, the failures have probabilities 1 − 1/2 = 1/2 and 1 − 2/5 = 3/5, so neither happens with probability 1/2 × 3/5 = 3/10.",
          "“At least one happens” is the complement of “neither happens”: every pair is in exactly one of the two. So its probability is 1 − 3/10 = 7/10.",
          "Adding the two probabilities does not work: 1/2 + 2/5 = 9/10 counts the 6 pairs where both happen twice. Subtracting that overlap once gives 9/10 − 1/5 = 7/10, the same answer.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A fair number cube with faces numbered 1 through 6 is rolled, and a spinner with 5 equal sections numbered 1 through 5 is spun. The two results are independent. What is the probability that at least one of these happens: the cube shows an even number; the spinner lands on a number greater than 3?",
      steps: [
        "An even number is 2, 4 or 6, so its probability is 3/6 = 1/2. A spin greater than 3 is 4 or 5, so its probability is 2/5.",
        "Each event fails with probability 1 − 1/2 = 1/2 and 1 − 2/5 = 3/5.",
        "The results are independent, so neither happens with probability 1/2 × 3/5 = 3/10.",
        "At least one happens exactly when it is not true that neither happens: 1 − 3/10 = 7/10.",
      ],
      answer: "7/10",
    },
    pitfalls: [
      "Do not add the probabilities for “at least one”; the pairs where both happen would be counted twice.",
      "Multiply only for independent results; a draw without replacement changes the second probability.",
      "Independent does not mean mutually exclusive: independent events can happen together.",
    ],
    parentGuide:
      "Roll a cube and toss a coin together 20 times, tallying even-and-heads. Then draw the 12 equally likely pairs and compare the tally with 3/12.",
  },
  {
    id: "expected-value",
    title: "Expected value",
    summary:
      "Weight each payoff by its probability and add; subtract a fixed cost for an expected net gain.",
    templateIds: ["expected-value"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Calculate an expected payoff as the sum of each payoff times its probability.",
      "Find an expected net gain by subtracting a fixed cost, and interpret its sign.",
    ],
    sections: [
      {
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
    terms: [
      ["stage", "One decision in the process."],
      ["outcome", "One complete result: a choice at every stage."],
    ],
    method: [
      "List the stages and the number of options at each.",
      "Check that every option at one stage can go with every option at the others.",
      "Multiply the numbers of options; for a code, use one factor per position.",
    ],
    watch: "Add only when one choice is made from a single combined list.",
  },
  "permutation-count": {
    goal: "Count ways to fill distinct positions without using an item twice.",
    terms: [
      [
        "arrangement",
        "A selection in which each item fills a different position.",
      ],
      ["n!", "The product of every whole number from n down to 1."],
    ],
    method: [
      "Confirm that order or position matters.",
      "Give the first position all n options and each later position one fewer.",
      "Multiply one factor for each position filled.",
    ],
    watch:
      "Do not repeat a factor: a chosen item cannot fill a second position.",
  },
  "combination-count": {
    goal: "Count groups chosen from a collection when order does not matter.",
    terms: [
      ["combination", "A group whose members have the same role."],
      ["orders of a group", "For k items, k × (k − 1) × … × 1."],
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
    terms: [
      [
        "probability",
        "Favorable equally likely outcomes divided by all outcomes.",
      ],
      ["combination", "A group chosen when order does not matter."],
    ],
    method: [
      "Count all groups of the drawn size.",
      "Count favorable groups, multiplying the choices from each kind.",
      "Divide favorable by all groups and reduce.",
    ],
    watch: "Count groups, not arrangements, in both numerator and denominator.",
  },
  "independent-events-probability": {
    goal: "Find both, neither or at-least-one probabilities for two independent results.",
    terms: [
      [
        "independent",
        "One result does not change the probabilities of the other.",
      ],
      [
        "complement",
        "The event does not happen; its probability is 1 minus the event's.",
      ],
    ],
    method: [
      "Find each event's probability from its equally likely outcomes.",
      "For both, multiply the probabilities.",
      "For neither, multiply the complements; for at least one, subtract neither from 1.",
    ],
    watch: "Do not add probabilities for at least one: that counts both twice.",
  },
  "expected-value": {
    goal: "Find the long-run average payoff of one play, after any cost.",
    terms: [
      ["expected value", "The sum of each payoff times its probability."],
      ["net gain", "Payoff minus the cost of playing."],
    ],
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
    "Multiplication principle: if one choice is made at each stage and the number of options at a stage does not depend on earlier choices, the number of outcomes is the product of the numbers of options.",
  "permutation-count":
    "Arranging r of n different items without repetition gives n × (n − 1) × … × (n − r + 1) = n! ÷ (n − r)! arrangements.",
  "combination-count":
    "Each group of k items appears in k! arrangements, so the number of groups is the number of arrangements divided by k!.",
  "combination-probability":
    "When every group is equally likely, the probability of an event is the number of favorable groups divided by the number of all groups.",
  "independent-events-probability":
    "For independent events, P(A and B) = P(A) × P(B). The complements are independent too, and P(at least one) = 1 − P(neither).",
  "expected-value":
    "The expected value is the probability-weighted sum of the payoffs; subtracting a fixed cost subtracts it from the expected value.",
};
