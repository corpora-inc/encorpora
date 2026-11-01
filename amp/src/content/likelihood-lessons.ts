import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const likelihoodMethods: Record<string, ProblemMethod> = {
  "likelihood-in-words": {
    goal: "Name an event as certain, likely, as likely as not, unlikely or impossible by comparing the successes with half of all outcomes.",
    intuition:
      "An outcome is one thing that can happen, like one marble coming out of a bag. A success is an outcome that makes the event happen. How likely the event is depends on how many of the outcomes are successes, out of all the outcomes.",
    terms: ["outcome", "event", "impossible", "certain"],
    method: [
      "Count the outcomes that make the event happen, and count all the outcomes.",
      "If none of them do, the event is impossible. If all of them do, it is certain.",
      "Otherwise compare the successes with half of all outcomes: more than half is likely, exactly half is as likely as not, and fewer than half is unlikely.",
    ],
    watch:
      "Compare with all the outcomes, not with the other colors. Having the most of one color does not make an event certain unless every outcome is a success.",
  },
  "probability-on-number-line": {
    goal: "Place the chance of an event on a number line from 0 to 1 as the fraction of outcomes that are successes.",
    intuition:
      "The chance of an event is a number from 0 to 1. Impossible is 0, certain is 1, and everything between is a fraction: the successes out of all the equally likely outcomes. A number line from 0 to 1 cut into that many equal spaces puts each fraction at its own mark.",
    terms: ["probability", "equally-likely"],
    method: [
      "Count the successes and all the outcomes, and write the chance as successes over all outcomes.",
      "Count the equal spaces on the number line from 0 to 1 and check that it matches the number of outcomes.",
      "Count the number of successes in spaces up from 0 and find that point.",
    ],
    watch:
      "Do not choose the chance of the event not happening, which is the mirror point. Count from 0 for the event itself.",
  },
  "equal-chance-choice": {
    goal: "Choose the bag or spinner whose counts make two colors equally likely, or one color the most or least likely.",
    intuition:
      "When every marble or section is equally likely to be picked, a color's chance depends only on how many there are of it. Equal chances need equal counts. The most likely color has the most; the least likely has the fewest.",
    terms: [
      "equally-likely",
      [
        "probability",
        "The most likely result has the greatest probability; here, the color with the greatest count.",
      ],
    ],
    method: [
      "Write the count of each color for a choice.",
      "Compare the colors the question names: equal counts for equal chances, the greatest count for most likely, the smallest for least likely.",
      "Check every choice, because a choice can match the total or look balanced and still fail the comparison.",
    ],
    watch:
      "Compare only the colors named in the question. Two choices may both have the right total and still give different chances.",
  },
};

export const likelihoodPrinciples: Record<string, string> = {
  "likelihood-in-words":
    "For $n$ equally likely outcomes of which $k$ make an event happen, the event is impossible if $k=0$, certain if $k=n$, unlikely if $0<k<\\frac{n}{2}$, as likely as not if $k=\\frac{n}{2}$ and likely if $\\frac{n}{2}<k<n$.",
  "probability-on-number-line":
    "For $n$ equally likely outcomes with $k$ successes, the chance of the event is $\\frac{k}{n}$, a number from 0 to 1. A number line from 0 to 1 cut into $n$ equal spaces shows it $k$ spaces from 0, and the chance of the event not happening is $\\frac{n-k}{n}$.",
  "equal-chance-choice":
    "When all outcomes are equally likely, the chance of a color is its count divided by the total, so two colors are equally likely exactly when their counts are equal, and the color with the greatest count is the most likely.",
};

export const likelihoodLessons = [
  chainLesson({
    id: "likelihood-words-lesson",
    title: "How likely is it?",
    summary:
      "Describe an event as certain, likely, as likely as not, unlikely or impossible, and build a bag or spinner for a chance.",
    templateIds: ["likelihood-in-words", "equal-chance-choice"],
    objectives: [
      "Count the successes and all outcomes of a bag, spinner or number cube.",
      "Name the likelihood by comparing the successes with none, half and all.",
      "Choose the counts that give equal, greatest or least chance.",
    ],
    openingTitle: "Compare the successes with half and with all",
    opening: [
      "Picking a marble without looking has as many outcomes as there are marbles, and each marble is equally likely to be picked. An outcome that makes your event happen is a success.",
      "If no outcome is a success, the event is impossible. If every outcome is a success, it is certain. In between, compare the number of successes with half of all outcomes to say likely, as likely as not, or unlikely.",
    ],
    example: {
      prompt:
        "A bag holds 5 red marbles and 3 blue marbles. You pick one without looking. How likely is picking a red marble?",
      steps: [
        "There are $5+3=8$ marbles, so 8 outcomes, and 5 of them are red.",
        "Half of 8 is 4, and 5 is more than 4 but not all 8.",
        "More than half but not all: picking red is likely.",
      ],
      answer: "Likely",
    },
    methodTitle: "Count, then compare",
    method: [
      "Likelihood words: 0 successes is impossible; all is certain; more than half is likely; exactly half is as likely as not; fewer than half is unlikely.",
      "To build a bag, make the counts follow the goal: equal counts for equal chances, the largest count for the most likely color, the smallest for the least likely.",
    ],
    formalTitle: "Equally likely outcomes",
    formal: [
      "With $n$ equally likely outcomes and $k$ successes, the chance of the event is $\\frac{k}{n}$. The words compare $\\frac{k}{n}$ with 0, $\\frac{1}{2}$ and 1.",
      "Chances depend on counts only when every outcome is equally likely: equal sections on a spinner, same-size marbles in a bag, the six faces of a fair cube.",
    ],
    pitfalls: [
      "Comparing the successes with the other colors instead of with all the outcomes.",
      "Calling an event certain because it is the most likely color. Certain needs every outcome to be a success.",
      "Choosing equal totals instead of equal counts for the colors the question names.",
    ],
    parentGuide:
      "Use a real bag of coins or buttons and ask your learner to predict, then try 10 picks.",
  }),
  chainLesson({
    id: "probability-line-lesson",
    title: "A chance on a number line",
    summary:
      "Write the chance of an event as a fraction and place it between 0 and 1.",
    templateIds: ["probability-on-number-line"],
    objectives: [
      "Write a chance as successes over all outcomes.",
      "Find that fraction on a number line cut into equal spaces.",
    ],
    openingTitle: "Chance is a fraction between 0 and 1",
    opening: [
      "The chance of an event is the number of successes out of all the equally likely outcomes. It is a fraction from 0, an impossible event, to 1, a certain event.",
      "A number line from 0 to 1 cut into as many equal spaces as there are outcomes puts the chance of 3 successes at the mark 3 spaces from 0.",
    ],
    example: {
      prompt:
        "A spinner has 8 equal sections and 3 are red. The number line from 0 to 1 has 8 equal spaces. Where is the chance of landing on red?",
      steps: [
        "The chance is 3 out of 8, which is $\\frac{3}{8}$.",
        "Count 3 spaces up from 0 on the number line with 8 equal spaces.",
        "The point 3 spaces from 0 is the chance.",
      ],
      answer: "3 spaces from 0, at $\\frac{3}{8}$",
    },
    methodTitle: "Fraction, then count spaces",
    method: [
      "Chance = successes over all outcomes.",
      "Count that many spaces up from 0. The mark that many spaces from the right end is the chance of the event not happening, which is the mirror point.",
    ],
    formalTitle: "Probability as a fraction",
    formal: [
      "For equally likely outcomes, $P(\\text{event})=\\frac{k}{n}$ with $0\\le\\frac{k}{n}\\le1$.",
      "The chance of not having the event is $1-\\frac{k}{n}$, which is the mirror point across $\\frac{1}{2}$.",
    ],
    pitfalls: [
      "Counting spaces from 1 instead of from 0.",
      "Choosing the chance that the event does not happen, which is the mirror image of the right point.",
      "Using the number of failures as the numerator.",
    ],
    parentGuide:
      "Ask your learner whether the point should be nearer to 0 or to 1 before counting spaces.",
  }),
];

export const likelihoodFacetMappings: FacetMapping[] = [
  {
    templateId: "likelihood-in-words",
    facetId: "probability.core",
    extent: "partial",
    rationale:
      "Single choice of the likelihood word for an event from a bag of 4 to 10 marbles, a spinner with equal sections or one roll of a number cube. Does not assess unequal outcomes, probabilities as numbers, experimental frequencies, or compound events.",
  },
  {
    templateId: "probability-on-number-line",
    facetId: "probability.core",
    extent: "partial",
    rationale:
      "Single choice of the lettered point on a zero to one number line showing the chance of an event with 4 to 10 equally likely outcomes. Does not assess placing a point by dragging, chances with unequal outcomes, or probability notation.",
  },
  {
    templateId: "equal-chance-choice",
    facetId: "probability.core",
    extent: "partial",
    rationale:
      "Single choice of the bag or spinner of 6 to 10 equal parts with equal chances for two colors, the greatest chance for one color or the least chance for one color. Does not assess building the set by dragging cards, choosing a spinner by its unequal section sizes, or numeric probabilities.",
  },
];
