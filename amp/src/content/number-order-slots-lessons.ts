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
    summary:
      "Compare whole numbers from the left, place by place, then name which item is smallest, middle and greatest.",
    objectives: [
      "Find the first place, reading from the left, where the digits of two whole numbers differ.",
      "Use that place to order three numbers and match each number to its item.",
    ],
    intuition:
      "A whole number with the same number of digits as another is greater when its leftmost different digit is greater, because a digit in a higher place stands for a much larger amount. The digits to the right of that place do not matter. To order three numbers, compare them from the left until the digits tell them apart, then name the item with the smallest number first, the middle one next and the greatest last, or the reverse.",
    terms: [
      "place-value",
      [
        "place",
        "The ten thousands place is fifth from the right; a 4 there means 40,000.",
      ],
    ],
    method: [
      "Write the numbers one above the other so that equal places line up.",
      "Move from the left and find the first place where the digits are not all the same. The digits there tell the order.",
      "Rank the digits in that place, then match each rank to its item and fill the positions in the order the question asks.",
    ],
    watch:
      "Stop at the first place that differs. Later digits can be larger in the smaller number and must not change the order.",
    principle:
      "Two whole numbers with the same number of digits compare by the leftmost place in which their digits differ: the number with the greater digit there is greater. Comparing is transitive, so three numbers are ordered by comparing them at that place.",
    example: {
      prompt:
        "Harbor Field holds 42,310 people, Summit Park holds 45,120 and Ridge Stadium holds 41,987. Order the stadiums from smallest to greatest capacity.",
      steps: [
        "All three numbers begin with 4, so look at the thousands place: the digits are 2, 5 and 1.",
        "The order of these digits is 1, 2, 5, so the numbers are in the order 41,987, 42,310, 45,120.",
        "Match each number to its stadium: Ridge Stadium, Harbor Field, Summit Park.",
      ],
      answer: "Ridge Stadium, Harbor Field, Summit Park.",
    },
    methodTitle: "Compare at the first different place",
    methodText: [
      "Check that the numbers have the same number of digits; a number with more digits is greater.",
      "Mark the first place that differs, rank the digits in that place, and use the ranking for every position.",
    ],
    formal:
      "For whole numbers $a$ and $b$ with the same number of digits, if their digits agree above a place and differ at that place, then $a<b$ exactly when the digit of $a$ there is less than the digit of $b$. Each digit $d$ in place $10^k$ contributes $d\\cdot 10^k$, and the digits to the right contribute less than $10^k$ in total, so they cannot reverse the order.",
    pitfalls: [
      "Do not compare the ones digits first: 45,120 is greater than 41,987 even though 0 is less than 7.",
      "Do not skip a position: each position holds one item, and no item is used twice.",
    ],
    parentGuide:
      "Ask your learner to put a finger on the first column where the numbers are not the same and to say which digit is bigger.",
  },
  {
    id: "order-fractions-slots",
    title: "Put three fractions in order",
    summary:
      "Order fractions with the same denominator, the same numerator, or by comparing each with one half.",
    objectives: [
      "Compare fractions that share a denominator or a numerator by reasoning about the size of the parts.",
      "Use one half as a benchmark to order fractions with different denominators.",
    ],
    intuition:
      "A fraction names equal parts of one whole. With the same denominator the parts are the same size, so the fraction with more parts is greater. With the same numerator the number of parts is the same, but a larger denominator cuts the whole into smaller parts, so the fraction is smaller. When denominators and numerators both differ, compare each fraction with one half: a fraction is less than one half when its numerator is less than half its denominator.",
    terms: ["numerator", "denominator", "benchmark-fraction"],
    method: [
      "Look at the denominators and numerators. If one of them matches, compare the other one with the rule for parts.",
      "If neither matches, compare each fraction with $\\frac{1}{2}$: double its numerator and compare it with its denominator.",
      "Write the fractions in order and fill the positions in the direction the question asks.",
    ],
    watch:
      "With the same numerator, the larger denominator makes the smaller fraction. Do not order by the size of the denominators.",
    principle:
      "For positive integers, $\\frac{a}{n}<\\frac{b}{n}$ exactly when $a<b$, and $\\frac{a}{m}<\\frac{a}{n}$ exactly when $m>n$. A fraction $\\frac{a}{b}$ is less than, equal to or greater than $\\frac{1}{2}$ according to whether $2a$ is less than, equal to or greater than $b$.",
    example: {
      prompt:
        "Put $\\frac{3}{8}$, $\\frac{5}{12}$ and $\\frac{4}{8}$ in order from least to greatest.",
      steps: [
        "Compare each with $\\frac{1}{2}$: $2 \\cdot 3 = 6$ is less than 8, so $\\frac{3}{8}$ is less than one half.",
        "$\\frac{4}{8}$ is exactly one half, and $2 \\cdot 5 = 10$ is less than 12, so $\\frac{5}{12}$ is less than one half.",
        "Both $\\frac{3}{8}$ and $\\frac{5}{12}$ are below $\\frac{4}{8}$. Compare them with twelfths and eighths over 24: $\\frac{9}{24}$ and $\\frac{10}{24}$, so $\\frac{3}{8}<\\frac{5}{12}$.",
      ],
      answer: "$\\frac{3}{8}$, $\\frac{5}{12}$, $\\frac{4}{8}$.",
    },
    methodTitle: "Choose the quickest comparison",
    methodText: [
      "Same denominator: order the numerators. Same numerator: reverse the order of the denominators.",
      "Different denominators and numerators: sort the fractions into less than, equal to and greater than one half before comparing the ones in the same group.",
    ],
    formal:
      "Positive fractions compare by the sign of $\\frac{a}{b}-\\frac{c}{d}=\\frac{ad-bc}{bd}$, so $\\frac{a}{b}<\\frac{c}{d}$ exactly when $ad<bc$. The rules for a common denominator, a common numerator and one half are the cases $b=d$, $a=c$ and $c/d=1/2$.",
    pitfalls: [
      "Do not read a bigger denominator as a bigger fraction when the numerators are equal.",
      "Do not compare numerators alone when the denominators differ.",
    ],
    parentGuide:
      "Draw each fraction as a strip cut into equal parts and shade the parts; the longer shaded strip is the greater fraction.",
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
