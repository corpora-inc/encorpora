import type { FacetMapping } from "./coverage";
import { formatLessons, type FormatLessonEntry } from "./format-lesson-entry";

type Entry = FormatLessonEntry & {
  /** The practice-screen task, at most 140 characters; defaults to the summary. */
  goal?: string;
};

const entries: Entry[] = [
  {
    id: "order-whole-numbers-slots",
    title: "Put large numbers in order",
    senses: { "more than": "more-than" },
    noLink: ["change", "third"],
    goal: "Compare three whole numbers from the left, place by place, then name which item is smallest, middle and greatest.",
    summary:
      "To put numbers in order means to list them from smallest to greatest, or from greatest to smallest. Line up the places and read from the left. The first place where the digits differ tells the order.",
    objectives: [
      "Find the first place, reading from the left, where the digits of two whole numbers differ.",
      "Use that place to order three numbers and match each number to its item.",
    ],
    intuition:
      "A whole number is one of the numbers 0, 1, 2, 3 and so on. A digit is one of the symbols 0 to 9. Its place tells what it is worth. In 45,120 the 4 is in the ten thousands place, so it is worth 40,000. The 5 is in the thousands place, so it is worth 5,000. When numbers have the same number of digits, compare them from the left, the biggest place. Skip the places where the digits match. The first place where they differ decides. The digits to its right cannot change the order, because together they are worth less than one more of that place. So 41,987 is less than 42,310, even though 987 is more than 310. To order three numbers, find the smallest, the middle one and the greatest. Then fill the spots in the order the question asks.",
    terms: [
      "place-value",
      [
        "place",
        "The ten thousands place is fifth from the right; a 4 there means 40,000.",
      ],
    ],
    method: [
      "Write the numbers one above the other so that matching places line up.",
      "Move from the left and find the first place where the digits are not all the same. Rank the digits there.",
      "If two numbers share the same digit in that place, keep comparing those two to the right until their digits differ.",
      "Match each number to its item, and fill the spots in the order the question asks.",
    ],
    watch:
      "For each pair of numbers, stop at the first place where they differ. Later digits can be bigger in the smaller number, and they must not change the order.",
    principle:
      "For whole numbers with the same number of digits, the first place from the left where the digits differ decides which is greater. If one number is less than a second, and the second is less than a third, then the first is less than the third. So comparing at that place puts all three in order.",
    example: {
      prompt:
        "Harbor Field holds 42,310 people, Summit Park holds 45,120 and Ridge Stadium holds 41,987. Order the stadiums from the one that holds the fewest people to the one that holds the most.",
      steps: [
        "All three numbers have 5 digits, and all start with 4 in the ten thousands place. So look at the next place, the thousands: the digits are 2, 5 and 1.",
        "From smallest to greatest those digits are 1, 2, 5. So the numbers in order are 41,987, 42,310, 45,120.",
        "Match each number to its stadium: Ridge Stadium, Harbor Field, Summit Park.",
      ],
      answer: "Ridge Stadium, Harbor Field, Summit Park.",
    },
    methodTitle: "Compare at the first different place",
    methodText: [
      "First check the number of digits. A number with more digits is greater.",
      "Mark the first place that differs and rank the digits there. If two numbers tie in that place, compare those two at the next place to the right.",
    ],
    formal:
      "In 41,987 and 42,310 the first place that differs is the thousands: 1 thousand and 2 thousands. The places to the right, 987 and 310, are each less than 1,000. So they can never make up a whole thousand. The bigger digit in the first different place always belongs to the greater number.",
    pitfalls: [
      "Do not compare the ones digits first. 45,120 is greater than 41,987, even though 0 is less than 7.",
      "Do not skip a spot. Each spot holds one item, and no item is used twice.",
    ],
    parentGuide:
      "Ask your learner to put a finger on the first column where the numbers are not the same and to say which digit is bigger.",
  },
  {
    id: "order-fractions-slots",
    title: "Put three fractions in order",
    goal: "Order three fractions with the same denominator, the same numerator, or by comparing each with one half.",
    summary:
      "A fraction names equal parts of one whole. In $\\frac{3}{8}$, read “three eighths,” the bottom number, 8, is the denominator: the whole is cut into 8 equal parts. The top number, 3, is the numerator: it counts 3 of those parts. To order fractions, compare the parts.",
    senses: { "more than": "more-than", whole: "whole", part: "part" },
    noLink: ["mean"],
    objectives: [
      "Compare fractions that share a denominator or a numerator by thinking about the size of the parts.",
      "Use one half to order fractions with different denominators.",
    ],
    intuition:
      "A fraction names equal parts of one whole. The denominator, the bottom number, tells how many equal parts the whole is cut into. The numerator, the top number, counts the parts. Same denominator: the parts are the same size, so more parts is more. $\\frac{5}{8}$ is greater than $\\frac{3}{8}$. Same numerator: there are the same number of parts. In these questions that number is always more than 0. A bigger denominator cuts the whole into more parts, so each part is smaller. $\\frac{2}{5}$ is less than $\\frac{2}{3}$. When both numbers differ, compare each fraction with one half, $\\frac{1}{2}$. One half is called a benchmark: a number you know well and compare with. Double the numerator. Doubling shows what two copies of the fraction make. For $\\frac{3}{8}$, two copies are $\\frac{6}{8}$, less than a whole, so $\\frac{3}{8}$ is less than one half. So if the doubled numerator is less than the denominator, the fraction is less than one half. If it equals the denominator, the fraction is exactly one half. If it is more, the fraction is more than one half. The sign < means is less than.",
    terms: ["numerator", "denominator", "benchmark-fraction"],
    method: [
      "Look at the denominators and the numerators. Same denominator: more parts is greater. Same numerator, more than 0: the fraction with the bigger denominator is smaller.",
      "If neither matches, compare each fraction with $\\frac{1}{2}$: double its numerator and compare it with its denominator.",
      "Write the fractions in order. Fill the spots in the direction the question asks.",
    ],
    watch:
      "A bigger denominator does not mean a bigger fraction. When the numerators match and are more than 0, the bigger denominator makes the smaller fraction.",
    principle:
      "With the same denominator, the fraction with the bigger numerator is greater. With the same numerator, more than 0, the fraction with the bigger denominator is smaller. A fraction is less than, equal to or more than $\\frac{1}{2}$ when twice its numerator is less than, equal to or more than its denominator.",
    example: {
      prompt:
        "Put $\\frac{3}{8}$, $\\frac{5}{12}$ and $\\frac{4}{8}$ in order from least to greatest.",
      steps: [
        "Compare each with $\\frac{1}{2}$. For $\\frac{3}{8}$, double 3 to get 6. That is less than 8, so $\\frac{3}{8}$ is less than one half.",
        "For $\\frac{5}{12}$, double 5 to get 10. That is less than 12, so it is less than one half too. For $\\frac{4}{8}$, double 4 to get 8, the same as the denominator. So $\\frac{4}{8}$ is exactly one half, and it is the greatest.",
        "Now compare $\\frac{3}{8}$ and $\\frac{5}{12}$. One half is $\\frac{4}{8}$, so $\\frac{3}{8}$ is $\\frac{1}{8}$ less than one half. One half is also $\\frac{6}{12}$, so $\\frac{5}{12}$ is $\\frac{1}{12}$ less. Twelfths are smaller parts than eighths, so $\\frac{5}{12}$ is missing less. Both are below one half, so the one missing less is greater: $\\frac{3}{8}<\\frac{5}{12}$.",
      ],
      answer: "$\\frac{3}{8}$, $\\frac{5}{12}$, $\\frac{4}{8}$.",
    },
    methodTitle: "Choose the quickest comparison",
    methodText: [
      "Same denominator: order by the numerators. Same numerator, more than 0: the bigger the denominator, the smaller the fraction.",
      "Different numerators and denominators: sort the fractions into less than one half, exactly one half and more than one half. Then compare inside a group if you need to.",
    ],
    formal:
      "Think of a paper strip as one whole. Cutting it into more equal parts makes each part smaller. So with the same number of parts, more than 0, the fraction with the bigger denominator is smaller. With parts of the same size, more parts cover more of the strip. A fraction is exactly one half when its numerator is half its denominator, so doubling the numerator checks it.",
    pitfalls: [
      "Do not read a bigger denominator as a bigger fraction when the numerators are equal.",
      "Do not compare numerators alone when the denominators differ.",
    ],
    parentGuide:
      "Draw each fraction on a strip of the same length, cut into equal parts, and shade the parts. The longer shaded part shows the greater fraction.",
  },
  {
    id: "order-rationals-slots",
    title: "Order signed decimals and fractions",
    goal: "Put signed decimals and fractions in order by writing them as decimals and placing them on a number line.",
    summary:
      "A number line is a line with numbers marked in order, smaller to the left. A negative number is a number less than 0, so it sits left of 0. To order numbers, write each one as a decimal, a number written with a decimal point. Then place it on the number line and read from left to right.",
    noLink: ["sort", "change", "more than", "mean"],
    objectives: [
      "Rewrite fractions as decimals so every number in a list can be compared.",
      "Order negative and positive numbers, remembering that the negative number farther from zero is lesser.",
    ],
    intuition:
      "A number line is a line with numbers marked in order, smaller to the left. A negative number is a number less than 0. Every negative number is less than every positive number. A number's absolute value is its distance from 0: $|-1.5|=1.5$. Between two negative numbers, the one with the larger absolute value is farther left, so it is less: $-1.5$ is to the left of $-0.6$. A decimal is a number written with a decimal point, such as 0.75. In a fraction, the top number is called the numerator and the bottom number is called the denominator. To change a fraction to a decimal, divide the numerator by the denominator: $\\frac{3}{4}=3\\div4=0.75$.",
    terms: ["absolute-value", "number-line"],
    method: [
      "Write each number as a decimal; for example $\\frac{3}{4}=0.75$.",
      "Sort by sign: the negatives are less than the positives. Put the negatives in order by absolute value, largest absolute value first.",
      "Read the numbers from left to right for least to greatest, and fill the positions in the direction the question asks.",
    ],
    watch:
      "Do not order negative numbers by their digits: $-1.5$ is less than $-0.6$ even though 1.5 is more than 0.6.",
    principle:
      "Real numbers are all the numbers on the number line. For real numbers $a$ and $b$, $a<b$ exactly when $a$ lies to the left of $b$ on the number line. If $a<0<b$, then $a<b$. If $a$ and $b$ are both negative, then $a<b$ exactly when $|a|>|b|$.",
    example: {
      prompt:
        "Put $-\\frac{3}{4}$, $0.5$, $-1.2$ and $\\frac{1}{4}$ in order from least to greatest.",
      steps: [
        "Divide to write each fraction as a decimal: the numbers are $-0.75$, $0.5$, $-1.2$ and $0.25$.",
        "The negatives are $-1.2$ and $-0.75$. Since 1.2 is farther from zero than 0.75, $-1.2<-0.75$.",
        "The positives in order are $0.25<0.5$. The negatives come first, then the positives.",
      ],
      answer: "$-1.2$, $-\\frac{3}{4}$, $\\frac{1}{4}$, $0.5$.",
    },
    methodTitle: "Same form, then sign",
    methodText: [
      "Convert first so that every comparison is between decimals.",
      "A quick check: when the list has negative numbers, the first number from least to greatest is the negative with the largest absolute value. When it has positive numbers, the last is the largest positive number.",
    ],
    formal:
      "Define $a<b$ to mean that $b-a$ is positive. For negative numbers $a$ and $b$ this gives $a<b$ exactly when $-a>-b$, that is, when $|a|>|b|$. Any negative number is less than any positive number.",
    pitfalls: [
      "Do not order by absolute value alone: that reverses the negative numbers.",
      "Compare $0.25$ and $0.5$ as 25 hundredths and 50 hundredths, not by the number of digits.",
    ],
    parentGuide:
      "Draw a number line from −3 to 3 with your learner and mark each number; reading the marks from left to right gives the order.",
  },
];

const built = formatLessons(entries);
export const numberOrderSlotsLessons = built.lessons;
export const numberOrderSlotsMethods = Object.fromEntries(
  entries.map((e) => [
    e.id,
    { ...built.methods[e.id]!, ...(e.goal ? { goal: e.goal } : {}) },
  ]),
);
export const numberOrderSlotsPrinciples = built.principles;

export const numberOrderSlotsFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "order-whole-numbers-slots",
    facetId: "large-place-value.digit-value-and-comparison",
    extent: "partial",
    rationale:
      "Order three five-digit whole numbers whose first difference is in the ten thousands, thousands or hundreds place, least first or greatest first, by choosing the item for each position, with smaller trailing digits in the greater number. Does not assess numbers of other lengths, comparing a number with its expanded form, or ordering by dragging.",
  },
  {
    templateId: "order-fractions-slots",
    facetId: "fraction-comparison.core",
    extent: "partial",
    rationale:
      "Order three proper fractions with a common denominator, a common numerator, or one half as the benchmark, in either direction, by choosing the fraction for each position. Does not assess mixed numbers, improper fractions, fractions with no benchmark relation, or ordering by dragging.",
  },
  {
    templateId: "order-rationals-slots",
    facetId: "absolute-value.core",
    extent: "partial",
    rationale:
      "Order four or five signed decimals and fractions of magnitude up to 2.5 with tenths, hundredths, halves, quarters and fifths, in either direction, by choosing the number for each position. Does not assess mixed numbers, irrational values, numbers on a drawn number line, or ordering by dragging.",
  },
];
