import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const probabilityRulesLessons: Lesson[] = [
  {
    id: "events-and-addition-rule",
    title: "Events as sets and the addition rule",
    summary:
      "An outcome is one possible result, such as one student picked from a class. An event is a group of outcomes you ask about, such as the students who take art. The probability of an event is a number from 0 to 1 that tells how likely it is. To find the probability of “art or music”, add the two probabilities. Then subtract the probability of both once, because the students who take both were counted twice.",
    templateIds: ["event-set-count", "addition-rule-probability"],
    includeGeneratedRepresentation: false,
    senses: {
      event: "event",
      events: "event",
      complement: "complement-probability",
      complements: "complement-probability",
      intersection: "intersection",
      intersections: "intersection",
      sample: "sample-space",
      "more than": "more-than",
    },
    noLink: ["rule", "face", "part", "prime"],
    objectives: [
      "Read “or”, “and” and “not” about events, in words or symbols, as regions of a Venn diagram.",
      "Find the probability of “$A$ or $B$” with the addition rule, and solve the rule for the overlap.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Events are sets of outcomes",
        paragraphs: [
          "An outcome is one possible result, such as one student chosen from a class of 40. The sample space is the list of every possible outcome: here, all 40 students. An event is a group of outcomes you ask about, such as the students who take art. A group like this is also called a set.",
          "Equally likely means every outcome has the same chance. Then an event's probability is its count divided by the count of the sample space. If 18 of the 40 students take art, the probability of art is $\\frac{18}{40}$.",
          "A Venn diagram draws two events as overlapping circles inside a rectangle. The rectangle is the sample space. Its four regions hold every outcome exactly once: in $A$ only, in both, in $B$ only, or in neither.",
          "Here event $A$ is art and event $B$ is music. The four counts are 12 (art only), 6 (both), 9 (music only) and 13 (neither). They add to $12 + 6 + 9 + 13 = 40$ students.",
        ],
        illustration: "probability-venn-regions",
      },
      {
        title: "Or, and, not",
        paragraphs: [
          "“$A$ or $B$” holds every outcome in $A$, in $B$, or in both. It is written $A \\cup B$ and read “$A$ union $B$”. Here that is $12 + 6 + 9 = 27$ students.",
          "“$A$ and $B$” holds only the outcomes in both, the overlap. This overlap is called the intersection. It is written $A \\cap B$ and read “$A$ intersect $B$”. Here that is 6 students.",
          "“Not $A$” holds every outcome outside $A$. It is called the complement of $A$, written $A'$ and read “$A$ prime”. Here it is the music-only region and the outside: $9 + 13 = 22$ students, which is $40 - 18$.",
          "“Neither” means in no circle at all. It is the complement of “$A$ or $B$”, written $(A \\cup B)'$. It is the same set as “not $A$ and not $B$”, written $A' \\cap B'$.",
        ],
        illustration: "probability-venn-complement",
      },
      {
        title: "The addition rule",
        paragraphs: [
          "18 students take art and 15 take music. But $18 + 15 = 33$ is more than the 27 who take art or music. The 6 who take both are inside both totals, so they were counted twice. Subtract them once: $18 + 15 - 6 = 27$.",
          "$P(A)$ means the probability of event $A$. Divide every count by 40, and the same step becomes the addition rule: $P(A \\text{ or } B) = P(A) + P(B) - P(A \\text{ and } B)$.",
          "Some events cannot happen together. They are called mutually exclusive. For them, $P(A \\text{ and } B) = 0$, and the probabilities simply add.",
          "To find the overlap instead, rearrange the rule: $P(A \\text{ and } B) = P(A) + P(B) - P(A \\text{ or } B)$.",
        ],
        illustration: "probability-venn-union",
      },
    ],
    workedExample: {
      prompt:
        "One card is drawn with every card equally likely from a deck of 52: four suits of 13 cards each. Hearts are one suit; each suit has one jack, one queen, and one king. These jacks, queens, and kings are the face cards. What is the probability of a heart or a face card?",
      steps: [
        "Count each event. There are 13 hearts. There are 3 face cards in each of 4 suits, so $3 \\times 4 = 12$ face cards.",
        "The jack, queen and king of hearts are in both groups. So $13 + 12$ counts them twice. Subtract them once: $13 + 12 - 3 = 22$ cards.",
        "All 52 cards are equally likely, so divide by 52: $P(\\text{heart or face card}) = \\frac{22}{52} = \\frac{11}{26}$.",
      ],
      answer: "11/26",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "An event is a set of outcomes. The union $A \\cup B$ holds the outcomes in either event. The intersection $A \\cap B$ holds the outcomes in both. The complement $A'$ holds the outcomes not in $A$.",
          "$P(A \\text{ or } B) = P(A) + P(B) - P(A \\text{ and } B)$. The last part is subtracted because outcomes in both events are counted once in $P(A)$ and again in $P(B)$.",
        ],
      },
    ],
    pitfalls: [
      "“Or” includes the outcomes in both events. Do not leave the overlap out.",
      "Adding $P(A)$ and $P(B)$ counts the overlap twice. Subtract $P(A \\text{ and } B)$ once.",
      "$A'$ is everything outside $A$, including the outcomes outside both circles.",
    ],
    parentGuide:
      "Ask everyone at dinner two yes-or-no questions, such as “Do you like soup?” and “Do you like salad?”. Draw a Venn diagram of the answers. Count “soup or salad” two ways: region by region, and as soup + salad − both.",
  },
  {
    id: "conditional-and-multiplication-rule",
    title: "Conditional probability and the multiplication rule",
    summary:
      "An event is a group of possible outcomes, and its probability says how likely it is, from 0 to 1. Knowing that one event happened leaves fewer possible outcomes. So find the next chance inside that smaller group. For two events in a row, multiply the first chance by the second chance found that way. Multiplying this way is called the multiplication rule.",
    templateIds: [
      "conditional-probability-value",
      "multiplication-rule-probability",
    ],
    includeGeneratedRepresentation: false,
    senses: {
      event: "event",
      events: "event",
      product: "product-multiply",
      products: "product-multiply",
      changes: "change",
      whole: "whole",
      trials: "trial",
    },
    noLink: ["rule", "leaves"],
    objectives: [
      "Find $P(A \\mid B)$, the probability of $A$ given $B$, from a table, a Venn diagram, a list of outcomes or $P(A \\text{ and } B) \\div P(B)$.",
      "Find the probability of events in a row with the multiplication rule, and add the paths of a tree.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "“Given” shrinks the sample space",
        paragraphs: [
          "An event is a group of possible outcomes. The sample space is the list of every possible outcome. $P(A)$ means the probability of event $A$.",
          "$P(A \\mid B)$ is read “the probability of $A$ given $B$”. The bar means “given”. It is the probability of $A$ when we already know $B$ happened. Only the outcomes in $B$ are still possible, so $B$ becomes the new sample space. This needs $P(B)$ to be greater than 0.",
          "In the table, 70 students are sorted by grade and by the kind of class they prefer. Given that a student is in grade 10, only that row of 40 students is left. 14 of them prefer online classes. So $P(\\text{online} \\mid \\text{grade 10}) = \\frac{14}{40} = \\frac{7}{20}$.",
          "The same answer comes from probabilities of the whole group: $P(A \\mid B) = P(A \\text{ and } B) \\div P(B) = \\frac{14}{70} \\div \\frac{40}{70} = \\frac{14}{40}$.",
        ],
        illustration: "probability-table-given",
      },
      {
        title: "Reversing the condition changes the probability",
        paragraphs: [
          "Swap the condition and the sample space changes. Given that a student prefers online classes, only that column of 32 students is left. 14 of them are in grade 10. So $P(\\text{grade 10} \\mid \\text{online}) = \\frac{14}{32} = \\frac{7}{16}$.",
          "Both answers have 14 on top, the students in both groups. The bottom number is always the size of the given event. So read which event comes after the bar.",
        ],
        illustration: "probability-table-reverse",
      },
      {
        title: "The multiplication rule and trees",
        paragraphs: [
          "For both $A$ and $B$ to happen, $A$ must happen, and then $B$ must happen given $A$. So $P(A \\text{ and } B) = P(A) \\times P(B \\mid A)$. This is the multiplication rule.",
          "Drawing without replacement means a drawn item is not put back. A bag has 3 red and 2 blue marbles. The first draw is red with probability $\\frac{3}{5}$. Then 2 red marbles are left among 4. So both are red with probability $\\frac{3}{5} \\times \\frac{2}{4} = \\frac{6}{20}$.",
          "A tree diagram shows every path of choices as branches. Each branch is labeled with its probability, given the branches before it. A path's probability is the product (the result of multiplying) of the branches along it.",
          "An event made of several paths adds those paths. “One of each color” is red then blue or blue then red: $\\frac{6}{20} + \\frac{6}{20} = \\frac{12}{20} = \\frac{3}{5}$. All four path probabilities add to 1.",
        ],
        illustration: "probability-tree-draws",
      },
    ],
    workedExample: {
      prompt:
        "On a school morning, the probability of rain is 0.3. When it rains, the bus is late with probability 0.4; when it does not rain, with probability 0.1. What is the probability that the bus is late?",
      steps: [
        "The bus can be late in two ways: rain then late, or no rain then late. Rain and no rain cover every morning, so $P(\\text{no rain}) = 1 - 0.3 = 0.7$.",
        "Use the multiplication rule along each path: $0.3 \\times 0.4 = 0.12$ and $0.7 \\times 0.1 = 0.07$.",
        "The two paths cannot both happen on one morning, so add them: $0.12 + 0.07 = 0.19$.",
      ],
      answer: "0.19",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "When $P(B) > 0$, $P(A \\mid B) = P(A \\text{ and } B) \\div P(B)$. Knowing $B$ happened makes $B$ the sample space.",
          "When $P(A) > 0$, $P(A \\text{ and } B) = P(A) \\times P(B \\mid A)$. Multiply the probabilities along each path. Then add the paths that make up the event, since no two of them can happen together.",
        ],
      },
    ],
    pitfalls: [
      "The bottom of $P(A \\mid B)$ is the count or probability of $B$, not of the whole sample space.",
      "Without replacement, the second draw has one fewer item, and the first draw changes what is left.",
      "Multiply along a path. Add different paths that make up the same event.",
    ],
    parentGuide:
      "Put 3 red and 2 blue socks in a bag. Draw two without looking, 20 times, and tally “both red”. Compare the share of tries with $\\frac{3}{5} \\times \\frac{2}{4} = \\frac{3}{10}$. Talk about why the second draw has only 4 socks to choose from.",
  },
];

const terms = {
  sets: [
    "union",
    "intersection",
    [
      "complement-probability",
      "Written $A'$: the outcomes of the sample space that are not in $A$.",
    ],
  ],
  addition: [
    [
      "union",
      "$P(A \\text{ or } B) = P(A) + P(B) - P(A \\text{ and } B)$, so outcomes in both count once.",
    ],
    "mutually-exclusive",
  ],
  conditional: [
    [
      "conditional-probability",
      '$P(A \\mid B)$ is read "the probability of $A$ given $B$."',
    ],
    [
      "sample-space",
      "Once a condition is known, the sample space shrinks to the outcomes still possible.",
    ],
  ],
  multiplication: ["conditional-probability", "without-replacement"],
} satisfies Record<string, MethodTerm[]>;
export const probabilityRulesMethods: Record<string, ProblemMethod> = {
  "event-set-count": {
    goal: "Count, or find the probability of, the outcomes in a union, intersection or complement.",
    senses: {
      event: "event",
      events: "event",
      whole: "whole",
      intersection: "intersection",
      complement: "complement-probability",
      sort: "sort",
    },
    noLink: ["prime"],
    intuition:
      "An event is a group of outcomes, such as the customers who bought coffee. A Venn diagram draws two events as overlapping circles. The union $A \\cup B$ means “$A$ or $B$”: everything in either circle. The intersection $A \\cap B$ means “$A$ and $B$”: only the overlap. The complement is all of the outcomes outside circle $A$, written $A'$ and read “$A$ prime”. It means “not $A$”. A probability is a count divided by the total.",
    terms: terms.sets,
    method: [
      "Translate the symbols into words: $\\cup$ is or, $\\cap$ is and, and $'$ is not.",
      "Find the regions the event covers: $A$ only, both, $B$ only or neither. For a list, sort each outcome into its region.",
      "Add the counts of those regions. For a probability, divide by the total number of outcomes.",
    ],
    watch:
      "$A'$ includes the outcomes outside both circles, not only those in $B$.",
  },
  "addition-rule-probability": {
    goal: "Find $P(A \\text{ or } B)$, or the overlap $P(A \\text{ and } B)$, with the addition rule.",
    senses: {
      events: "event",
      difference: "difference-subtract",
      "more than": "more-than",
    },
    noLink: ["rule", "face"],
    intuition:
      "An event is a group of outcomes you ask about. $P(A)$ means the probability of event $A$, a number from 0 to 1. “$A$ or $B$” includes the outcomes in $A$, in $B$, or in both. Adding $P(A)$ and $P(B)$ counts the overlap, “$A$ and $B$”, twice. So subtract it once: $P(A \\text{ or } B) = P(A) + P(B) - P(A \\text{ and } B)$. This is called the addition rule.",
    terms: terms.addition,
    method: [
      "Write the addition rule: $P(A \\text{ or } B) = P(A) + P(B) - P(A \\text{ and } B)$.",
      "Find the overlap: count the outcomes in both, or read it from the givens.",
      "Substitute and subtract the overlap once. If the overlap is the unknown, rearrange the rule to find it.",
    ],
    watch:
      "Adding $P(A)$ and $P(B)$ counts the overlap twice. Subtract it once, unless the events cannot happen together.",
  },
  "conditional-probability-value": {
    goal: "Find $P(A \\mid B)$ by keeping only the outcomes in $B$.",
    senses: {
      event: "event",
      whole: "whole",
      part: "part",
      multiple: "multiple",
    },
    noLink: ["leaves"],
    intuition:
      "$P(A \\mid B)$ is read “the probability of $A$ given $B$”. The bar means “given”. It is the chance of $A$ when we already know $B$ happened. Knowing $B$ leaves only the outcomes in $B$. So count the outcomes in $B$, then count how many of those are also in $A$, and divide.",
    terms: terms.conditional,
    method: [
      "The given event is the group of outcomes you know happened, here $B$. Find it: a row, a column, a circle or a list of outcomes.",
      "Count the outcomes in $B$. Then count the outcomes in $B$ that are also in $A$.",
      "Divide the second count by the first. With probabilities, $P(A \\mid B) = P(A \\text{ and } B) \\div P(B)$.",
    ],
    watch: "Divide by the count of the given event, not by the whole group.",
  },
  "multiplication-rule-probability": {
    goal: "Find the probability that events happen in a row, with the multiplication rule.",
    senses: {
      event: "event",
      events: "event",
      products: "product-multiply",
      part: "part",
      face: "face-solid",
    },
    noLink: ["rule"],
    intuition:
      "An event is a result you ask about. For two events in a row to both happen, the first must happen, and then the second must happen given the first. So multiply: the first event's probability times the second's probability once the first has happened. A tree diagram shows each path as branches, and a path's probability is the product of its branches. When an event can happen along several paths, add those paths.",
    terms: terms.multiplication,
    method: [
      "Find the probability of the first event.",
      "Find the probability of the second event given the first. After a draw, update the counts, or read the branch of the tree.",
      "Multiply along the path. For an event made of several paths, add the path results.",
    ],
    watch:
      "After a draw without replacement, the total goes down by one. A color's count goes down only if that color was drawn.",
  },
};
export const probabilityRulesPrinciples: Record<string, string> = {
  "event-set-count":
    "An event is a set of outcomes. A union holds the outcomes in either event, an intersection holds those in both, and a complement holds those not in the event.",
  "addition-rule-probability":
    "$P(A \\text{ or } B) = P(A) + P(B) - P(A \\text{ and } B)$, because outcomes in both events are counted once in $P(A)$ and again in $P(B)$.",
  "conditional-probability-value":
    "When $P(B) > 0$, $P(A \\mid B) = P(A \\text{ and } B) \\div P(B)$. Knowing $B$ happened makes $B$ the sample space.",
  "multiplication-rule-probability":
    "When $P(A) > 0$, $P(A \\text{ and } B) = P(A) \\times P(B \\mid A)$. Multiply along each path, and add paths that cannot happen together.",
};
