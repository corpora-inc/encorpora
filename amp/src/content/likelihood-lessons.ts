import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const likelihoodMethods: Record<string, ProblemMethod> = {
  "likelihood-in-words": {
    goal: "Say whether an event is certain, likely, as likely as not, unlikely or impossible by comparing its successes with half of all outcomes.",
    senses: {
      event: "event",
      certain: "certain",
      impossible: "impossible",
      face: "face-solid",
      faces: "face-solid",
      cube: "cube",
      "more than": "more-than",
    },
    intuition:
      "An outcome is one thing that can happen, like one marble coming out of a bag. An event is the result you are asking about, such as picking red. A success is an outcome that makes the event happen. Count the successes and all the outcomes. Then compare the successes with none, with half and with all of the outcomes.",
    terms: ["outcome", "event", "impossible", "certain"],
    method: [
      "Count the successes, the outcomes that make the event happen. Then count all the outcomes.",
      "If there are 0 successes, the event is impossible: it cannot happen. If every outcome is a success, it is certain: it must happen.",
      "Otherwise compare the successes with half of all the outcomes. More than half is likely, exactly half is as likely as not, and fewer than half is unlikely.",
    ],
    watch:
      "Compare the successes with all the outcomes, not with one other color. The biggest color is certain only when every outcome is that color.",
  },
  "probability-on-number-line": {
    goal: "Place the chance of an event on a number line from 0 to 1 as the fraction of outcomes that are successes.",
    senses: {
      event: "event",
      certain: "certain",
      impossible: "impossible",
      face: "face-solid",
      faces: "face-solid",
    },
    intuition:
      "An outcome is one thing that can happen, like one spin landing on one section. An event is the result you ask about, such as landing on red. A success is an outcome that makes the event happen. The chance of the event is the successes out of all the outcomes, written as a fraction. This works when every outcome is equally likely, meaning each has the same chance. Impossible means the event cannot happen, and its chance is 0. Certain means it must happen, and its chance is 1. A number line from 0 to 1, cut into one equal space per outcome, has a mark for each possible chance.",
    terms: ["probability", "equally-likely"],
    method: [
      "Count the successes and all the outcomes. The chance is successes over all outcomes, such as $\\frac{3}{8}$.",
      "Check that the number line from 0 to 1 has one equal space for each outcome.",
      "Start at 0 and count one space for each success. That point is the chance.",
    ],
    watch:
      "Count the spaces from 0, not from 1. Counting from 1 gives the chance that the event does not happen.",
  },
  "equal-chance-choice": {
    goal: "Choose the bag or spinner whose counts make two colors equally likely, or one color the most or least likely.",
    senses: { "more than": "more-than" },
    intuition:
      "Equally likely means having the same chance. In a bag of same-size marbles, or a spinner with equal sections, each marble or section is equally likely to be picked. Then a color's chance depends only on how many of that color there are. Two colors with equal counts have equal chances. The color with the most has the greatest chance, and the color with the fewest has the least.",
    terms: [
      "equally-likely",
      [
        "probability",
        "The most likely result has the greatest probability; here, the color with the greatest count.",
      ],
    ],
    method: [
      "For each choice, write how many there are of each color.",
      "Compare only the colors the question names. Equal counts give equal chances. The greatest count is the most likely, and the smallest count is the least likely.",
      "Check every choice. A choice can have the right total and still fail the comparison.",
    ],
    watch:
      "Compare only the colors named in the question. Two choices with the same total can still give those colors different chances.",
  },
};

export const likelihoodPrinciples: Record<string, string> = {
  "likelihood-in-words":
    "Suppose there are $n$ equally likely outcomes and $k$ of them are successes. The event is impossible if $k = 0$ and certain if $k = n$. Otherwise it is unlikely if $k < \\frac{n}{2}$, as likely as not if $k = \\frac{n}{2}$, and likely if $k > \\frac{n}{2}$.",
  "probability-on-number-line":
    "With $n$ equally likely outcomes and $k$ successes, the chance of the event is $\\frac{k}{n}$, a number from 0 to 1. On a number line from 0 to 1 cut into $n$ equal spaces, it is $k$ spaces from 0. The chance that the event does not happen is $\\frac{n-k}{n}$, which is $k$ spaces from 1.",
  "equal-chance-choice":
    "When all outcomes are equally likely, a color's chance is its count divided by the total. So two colors are equally likely exactly when their counts are equal, and the color with the greatest count is the most likely.",
};

export const likelihoodLessons = [
  {
    ...chainLesson({
      id: "likelihood-words-lesson",
      title: "How likely is it?",
      summary:
        "An outcome is one thing that can happen, like one marble coming out of a bag. An event is the result you ask about, such as picking a red marble. A success is an outcome that makes the event happen. Compare the number of successes with none, with half and with all of the outcomes. Impossible means no outcome is a success, so the event cannot happen. Certain means every outcome is a success, so it must happen. In between, the event is unlikely, as likely as not, or likely.",
      templateIds: ["likelihood-in-words", "equal-chance-choice"],
      objectives: [
        "Count the successes and all the outcomes for a bag, a spinner or a number cube.",
        "Name how likely an event is by comparing the successes with none, half and all of the outcomes.",
        "Choose the counts that give two colors equal chances, or give one color the greatest or least chance.",
      ],
      openingTitle: "Compare the successes with half and with all",
      opening: [
        "A bag holds 5 red marbles and 3 blue marbles of the same size. You pick one without looking. Each marble is one outcome, so there are 8 outcomes. Each marble has the same chance of being picked. We say the outcomes are equally likely.",
        "Say the event is picking red. The 5 red marbles are the successes, because each one makes the event happen.",
        "Impossible means the event cannot happen: no outcome is a success. Certain means the event must happen: every outcome is a success.",
        "In between, compare the successes with half of all the outcomes. More than half is likely. Exactly half is as likely as not. Fewer than half is unlikely.",
        "A number cube, also called a die, has 6 flat faces numbered 1 to 6. Rolling it has 6 equally likely outcomes. A spinner with equal sections has one outcome per section.",
      ],
      example: {
        prompt:
          "A bag holds 5 red marbles and 3 blue marbles. You pick one without looking. How likely is picking a red marble?",
        steps: [
          "Count all the outcomes. There are $5 + 3 = 8$ marbles, so there are 8 outcomes.",
          "Count the successes. Picking red is the event, and 5 marbles are red, so there are 5 successes.",
          "Compare with half. Half of 8 is 4. Since 5 is more than 4 but less than all 8, the event is not certain.",
          "More than half but not all of the outcomes are successes, so picking red is likely.",
        ],
        answer: "Likely",
      },
      methodTitle: "Count, then compare",
      method: [
        "Count the successes and all the outcomes. Then use these words. With 0 successes the event is impossible. With every outcome a success it is certain. More than half is likely, exactly half is as likely as not, and fewer than half is unlikely.",
        "To build a bag or spinner, choose the counts to fit the goal. Give two colors equal counts for equal chances. Give a color the largest count to make it the most likely, or the smallest count to make it the least likely.",
      ],
      formalTitle: "Equally likely outcomes",
      formal: [
        "Suppose there are $n$ equally likely outcomes and $k$ of them are successes. The chance of the event is $\\frac{k}{n}$, the fraction of the outcomes that are successes. The words compare $\\frac{k}{n}$ with 0, with $\\frac{1}{2}$ and with 1.",
        "Counting works only when every outcome is equally likely. That is true for equal sections on a spinner, same-size marbles in a bag, and the 6 faces of a fair number cube.",
      ],
      pitfalls: [
        "Compare the successes with all the outcomes, not with the number of one other color.",
        "An event is certain only when every outcome is a success. Being the biggest color is not enough.",
        "For equal chances, look at the counts of the colors the question names. Two bags with equal totals can still give those colors different chances.",
      ],
      parentGuide:
        "Put real coins or buttons in a bag. Ask the learner to say how likely one kind is to come out. Then make 10 picks, putting each one back, and compare.",
    }),
    senses: {
      event: "event",
      certain: "certain",
      impossible: "impossible",
      cube: "cube",
      faces: "face-solid",
      "more than": "more-than",
    },
  },
  {
    ...chainLesson({
      id: "probability-line-lesson",
      title: "A chance on a number line",
      summary:
        "An outcome is one thing that can happen, such as a spinner landing on one section. An event is the result you ask about, such as landing on red. A success is an outcome that makes the event happen. The chance of the event is the number of successes out of all the outcomes, written as a fraction such as $\\frac{3}{8}$. The chance is always between 0 and 1, so it has a place on a number line from 0 to 1.",
      templateIds: ["probability-on-number-line"],
      objectives: [
        "Write a chance as the number of successes over the number of all outcomes.",
        "Find that fraction on a number line from 0 to 1 cut into equal spaces.",
      ],
      openingTitle: "Chance is a fraction between 0 and 1",
      opening: [
        "A spinner has 8 equal sections, and 3 of them are red. Each section is an outcome, so there are 8 outcomes. The sections are the same size, so each outcome has the same chance. We say the outcomes are equally likely.",
        "Landing on red is the event. The 3 red sections are the successes. The chance of red is 3 out of 8, written $\\frac{3}{8}$. The top number counts the successes and the bottom number counts all the outcomes.",
        "Impossible means an event cannot happen: it has 0 successes, so its chance is 0. Certain means an event must happen: every outcome is a success, so its chance is 1. Every other chance is a fraction between 0 and 1.",
        "Cut a number line from 0 to 1 into 8 equal spaces, one for each outcome. Each space is $\\frac{1}{8}$. So $\\frac{3}{8}$ is the mark 3 spaces from 0.",
      ],
      example: {
        prompt:
          "A spinner has 8 equal sections and 3 are red. The number line from 0 to 1 has 8 equal spaces. Where is the chance of landing on red?",
        steps: [
          "Count the successes and all the outcomes. 3 of the 8 equal sections are red, so the chance is 3 out of 8, which is $\\frac{3}{8}$.",
          "The number line has 8 equal spaces, one for each outcome. So each space is $\\frac{1}{8}$.",
          "Start at 0 and count 3 spaces, one for each red section. That mark is $\\frac{3}{8}$, the chance of landing on red.",
        ],
        answer: "3 spaces from 0, at $\\frac{3}{8}$",
      },
      methodTitle: "Fraction, then count spaces",
      method: [
        "Write the chance as successes over all outcomes.",
        "Start at 0 and count one space for each success. Counting the same number of spaces back from 1 lands on the other mark, the chance that the event does not happen.",
      ],
      formalTitle: "Probability as a fraction",
      formal: [
        "The chance of an event is also called its probability, written $P(\\text{event})$. For $n$ equally likely outcomes with $k$ successes, $P(\\text{event}) = \\frac{k}{n}$. It is never less than 0 or more than 1: $0 \\le \\frac{k}{n} \\le 1$, where $\\le$ means is less than or equal to.",
        "The chance that the event does not happen is $1 - \\frac{k}{n}$. On the number line it is the same distance from 1 as the event's chance is from 0.",
      ],
      pitfalls: [
        "Count the spaces from 0, not from 1.",
        "Do not pick the chance that the event does not happen. That point is the same distance from 1 as the right point is from 0.",
        "Put the successes on top of the fraction, not the outcomes that fail.",
      ],
      parentGuide:
        "Before counting spaces, ask the learner whether the point should be nearer to 0 or to 1, and why.",
    }),
    senses: {
      event: "event",
      certain: "certain",
      impossible: "impossible",
      "more than": "more-than",
    },
    noLink: ["image"],
  },
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
