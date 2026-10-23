import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const probabilityRulesLessons: Lesson[] = [
  {
    id: "events-and-addition-rule",
    title: "Events as sets and the addition rule",
    summary:
      "An event is a set of possible outcomes. For “$A$ or $B$,” add each event's chance, then subtract the chance of both because their overlap was counted twice.",
    templateIds: ["event-set-count", "addition-rule-probability"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Read unions, intersections and complements, in words or symbols, as regions of a sample space.",
      "Find $P(A \\text{ or } B)$ with the addition rule, and solve it for the overlap.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Events are sets of outcomes",
        paragraphs: [
          "The sample space is the set of all outcomes. An event is a set of some of them: the students who take art, the numbers from 1 to 20 that are even. With equally likely outcomes, an event's probability is its count divided by the sample space's count.",
          "A Venn diagram draws two events as overlapping circles inside a rectangle, the sample space. Its four regions hold every outcome exactly once: in $A$ only, in both, in $B$ only, or in neither. Here the four counts add to 12 + 6 + 9 + 13 = 40 students.",
        ],
        illustration: "probability-venn-regions",
      },
      {
        title: "Or, and, not",
        paragraphs: [
          "$A \\cup  B$, read “A union $B$” or “$A$ or $B$”, holds every outcome in $A$, in $B$ or in both: 12 + 6 + 9 = 27 students. $A \\cap  B$, read “A intersect $B$” or “$A$ and $B$”, holds only the overlap: 6 students.",
          "$A'$, the complement of $A$, holds every outcome not in $A$: here the Music-only region and the outside, 9 + 13 = 22 students, which is 40 − 18. “Neither” is ($A \\cup  B$)′, the outside region alone; it is the same set as $A' \\cap  B'$.",
        ],
        illustration: "probability-venn-complement",
      },
      {
        title: "The addition rule",
        paragraphs: [
          "18 students take art and 15 take music, but 18 + 15 = 33 is more than the 27 who take art or music. The 6 who take both are inside both totals, so they were counted twice. Subtract them once: 18 + 15 − 6 = 27.",
          "Divide by 40 and the same step becomes the addition rule: $P(A \\text{ or } B) = P(A) + P(B) - P(A \\text{ and } B)$. When $A$ and $B$ cannot happen together, they are mutually exclusive, $P(A \\text{ and } B) = 0$, and the probabilities simply add. Solved for the overlap, the rule reads $P(A \\text{ and } B) = P(A) + P(B) - P(A \\text{ or } B)$.",
        ],
        illustration: "probability-venn-union",
      },
    ],
    workedExample: {
      prompt:
        "One card is drawn with every card equally likely from a deck of 52: four suits of 13 cards each. Hearts are one suit; each suit has one jack, one queen, and one king. These jacks, queens, and kings are the face cards. What is the probability of a heart or a face card?",
      steps: [
        "There are 13 hearts and 12 face cards.",
        "The jack, queen and king of hearts are in both groups, so 13 + 12 counts them twice: 13 + 12 − 3 = 22 cards.",
        "$P(\\text{heart or face card}) = \\frac{22}{52} = \\frac{11}{26}$.",
      ],
      answer: "11/26",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "An event is a set of outcomes: a union holds the outcomes in either event, an intersection those in both, and a complement those not in the event.",
          "$P(A \\text{ or } B) = P(A) + P(B) - P(A \\text{ and } B)$, because outcomes in both events are counted in $P(A)$ and in $P(B)$.",
        ],
      },
    ],
    pitfalls: [
      "“Or” includes the outcomes in both events; do not leave the overlap out.",
      "Adding $P(A)$ and $P(B)$ counts the overlap twice; subtract $P(A \\text{ and } B)$ once.",
      "$A'$ is everything outside $A$, including outcomes outside both circles.",
    ],
    parentGuide:
      "Ask everyone at dinner two yes-or-no questions, such as “Do you like soup?” and “Do you like salad?”. Draw a Venn diagram of the answers and count “soup or salad” two ways: region by region, and as soup + salad − both.",
  },
  {
    id: "conditional-and-multiplication-rule",
    title: "Conditional probability and the multiplication rule",
    summary:
      "Knowing that one event happened shrinks the possible outcomes. Find the second event’s chance within that smaller group, then combine the chances.",
    templateIds: [
      "conditional-probability-value",
      "multiplication-rule-probability",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find $P(A \\mid B)$ from a table, a Venn diagram, a list of outcomes or $P(A \\text{ and } B) \\div P(B)$.",
      "Find the probability of a sequence of events with the multiplication rule, and add the paths of a tree.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "“Given” shrinks the sample space",
        paragraphs: [
          "An event is a group of possible outcomes. $P(A\\mid B)$, read “the probability of $A$ given $B$”, is the probability of $A$ when event $B$ is known to have happened. Only outcomes in $B$ remain possible, so $B$ becomes the sample space. This requires $P(B)>0$.",
          "In the table, given that a student is in grade 10, only that row of 40 students remains. 14 of them prefer online classes, so $P(\\text{online | grade 10}) = \\frac{14}{40} = \\frac{7}{20}$. As probabilities: $P(A \\mid B) = P(A \\text{ and } B) \\div P(B) = (\\frac{14}{70}) \\div (\\frac{40}{70}) = \\frac{14}{40}$.",
        ],
        illustration: "probability-table-given",
      },
      {
        title: "Reversing the condition changes the probability",
        paragraphs: [
          "Reverse the condition and the sample space changes. Given that a student prefers online classes, only that column of 32 students remains, and 14 of them are in grade 10: $P(\\text{grade 10 | online}) = \\frac{14}{32} = \\frac{7}{16}$.",
          "Both answers share the numerator 14, the students who are in both groups. The denominator is always the size of the given event, so read which event comes after the bar.",
        ],
        illustration: "probability-table-reverse",
      },
      {
        title: "The multiplication rule and trees",
        paragraphs: [
          "For both $A$ and $B$ to happen, $A$ must happen, and then $B$ must happen given $A$: $P(A \\text{ and } B) = P(A) \\times P(B \\mid A)$. Drawing without replacement is the typical case. From 3 red and 2 blue marbles, the first is red with probability 3/5; then 2 red remain among 4 marbles, so both are red with probability 3/5 × 2/4 = 6/20.",
          "A tree shows every path. Each branch is labeled with its probability given the branches before it, and a path's probability is the product along it. An event made of several paths, such as “one of each color”, adds those paths: 6/20 + 6/20 = 12/20 = 3/5. The four path products add to 1.",
        ],
        illustration: "probability-tree-draws",
      },
    ],
    workedExample: {
      prompt:
        "On a school morning, the probability of rain is 0.3. When it rains, the bus is late with probability 0.4; when it does not rain, with probability 0.1. What is the probability that the bus is late?",
      steps: [
        "The bus is late on two paths: rain then late, and no rain then late. $P(\\text{no rain}) = 1 - 0.3 = 0.7$.",
        "Multiply along each path: 0.3 × 0.4 = 0.12 and 0.7 × 0.1 = 0.07.",
        "The paths cannot both happen, so add them: 0.12 + 0.07 = 0.19.",
      ],
      answer: "0.19",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "When $P(B)>0$, $P(A\\mid B)=P(A\\text{ and }B)/P(B)$: knowing $B$ occurred makes $B$ the sample space.",
          "When $P(A)>0$, $P(A\\text{ and }B)=P(A)P(B\\mid A)$. Multiply conditional probabilities along each possible path and add disjoint paths that make up the event.",
        ],
      },
    ],
    pitfalls: [
      "The denominator of $P(A \\mid B)$ is the count or probability of $B$, not of the whole sample space.",
      "Without replacement, the second draw comes from one fewer item, and the first draw changes what remains.",
      "Multiply along a path; add different paths that make up the same event.",
    ],
    parentGuide:
      "Put 3 red and 2 blue socks in a bag. Draw two without looking, 20 times, and tally “both red”. Compare the share of trials with 3/5 × 2/4 = 3/10, and talk about why the second draw has only 4 socks to choose from.",
  },
];

const terms = {
  sets: [
    ["$A \\cup B$", "$A$ or $B$: outcomes in $A$, in $B$ or in both."],
    ["$A \\cap B$", "$A$ and $B$: outcomes in both."],
    ["$A'$", "The complement: outcomes not in $A$."],
  ],
  addition: [
    ["$P(A \\text{ or } B)$", "The probability that $A$, $B$ or both happen."],
    ["mutually exclusive", "Events that cannot happen together."],
  ],
  conditional: [
    ["$P(A \\mid  B)$", "The probability of $A$ given that $B$ happened."],
    ["sample space", "The set of outcomes still possible."],
  ],
  multiplication: [
    ["$P(B \\mid  A)$", "The probability of $B$ once $A$ has happened."],
    ["without replacement", "A drawn item is not put back."],
  ],
} satisfies Record<string, [string, string][]>;
export const probabilityRulesMethods: Record<string, ProblemMethod> = {
  "event-set-count": {
    goal: "Count, or find the probability of, the outcomes in a union, intersection or complement.",
    terms: terms.sets,
    method: [
      "Translate the event: or is ∪, and is ∩, not is ′.",
      "Find the regions it covers: A only, both, $B$ only or neither; for a list, sort each outcome into its region.",
      "Add the counts of those regions; for a probability, divide by the size of the sample space.",
    ],
    watch:
      "$A'$ includes the outcomes outside both events, not only those in $B$.",
  },
  "addition-rule-probability": {
    goal: "Find $P(A \\text{ or } B)$, or the overlap $P(A \\text{ and } B)$, with the addition rule.",
    terms: terms.addition,
    method: [
      "Write $P(A \\text{ or } B) = P(A) + P(B) - P(A \\text{ and } B)$.",
      "Find the overlap: count the outcomes in both, or read it from the givens.",
      "Substitute and subtract the overlap once; for an unknown overlap, solve the rule for it.",
    ],
    watch:
      "Adding $P(A)$ and $P(B)$ counts the overlap twice; subtract it once, unless the events cannot happen together.",
  },
  "conditional-probability-value": {
    goal: "Find $P(A \\mid B)$ by restricting the sample space to $B$.",
    terms: terms.conditional,
    method: [
      "Find the given event $B$: a row, a column, a circle or a list of outcomes.",
      "Count $B$, then count the outcomes in $B$ that are also in $A$.",
      "Divide: $P(A \\mid B) = n(A \\text{ and } B) \\div n(B)$, or $P(A \\text{ and } B) \\div P(B)$.",
    ],
    watch:
      "Divide by the given event, not by the whole group; $P(A \\mid B)$ and $P(B \\mid A)$ have different denominators.",
  },
  "multiplication-rule-probability": {
    goal: "Find the probability that events happen in sequence, with the multiplication rule.",
    terms: terms.multiplication,
    method: [
      "Find the probability of the first event.",
      "Find the probability of the second event given the first: update the counts after a draw, or read the branch.",
      "Multiply along the path; for an event made of several paths, add the path products.",
    ],
    watch:
      "After a draw without replacement, the total goes down by one; the count of a color goes down only if that color was drawn.",
  },
};
export const probabilityRulesPrinciples: Record<string, string> = {
  "event-set-count":
    "An event is a set of outcomes: a union holds the outcomes in either event, an intersection those in both, and a complement those not in the event.",
  "addition-rule-probability":
    "$P(A \\text{ or } B) = P(A) + P(B) - P(A \\text{ and } B)$, because outcomes in both events are counted in $P(A)$ and in $P(B)$.",
  "conditional-probability-value":
    "When $P(B)>0$, $P(A\\mid B)=P(A\\text{ and }B)/P(B)$: knowing $B$ occurred makes $B$ the sample space.",
  "multiplication-rule-probability":
    "When $P(A)>0$, $P(A\\text{ and }B)=P(A)P(B\\mid A)$; multiply along each path and add disjoint paths.",
};
