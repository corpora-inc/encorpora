import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "recursion-term-steps",
    title: "Find terms of a recursive sequence one at a time",
    summary:
      "A recursive rule makes each number in a list from the number before it. To reach a later number, find every number in between.",
    objectives: [
      "Use a rule that makes each term (each number in the list) from the term before it, such as “square it, then add 1”.",
      "Find a later term by working out every term in order, without skipping ahead.",
    ],
    intuition:
      "A sequence is a list of numbers in order. Each number in the list is called a term. A recursive rule is a recipe that makes the next term from the term just before it. The terms get names with a small number written low after the letter, called a subscript. So $a_1$ (read “$a$ sub 1”) is the first term, $a_2$ is the second, and $a_n$ is the term in position $n$. The term just before $a_n$ is written $a_{n-1}$. Squaring a number means multiplying it by itself: $3^2 = 3 \\times 3 = 9$. Suppose $a_1 = 3$ and the rule is $a_n = (a_{n-1})^2 + 1$. In words: square the term before, then add 1. The second term is $3^2 + 1 = 9 + 1 = 10$. For the third term, use 10, the term just before it, not 3: $10^2 + 1 = 100 + 1 = 101$. Each new term is the input for the next one, so you cannot skip ahead.",
    terms: [
      "recursive-rule",
      [
        "term-sequence",
        "$a_n$ is the term in position $n$, and $a_{n-1}$ is the term just before it.",
      ],
    ],
    method: [
      "Write the first term, $a_1$, and say the rule in words, such as “square the term before, then add 1”.",
      "Put the first term into the rule to get the second term. Square first, then multiply, then add or subtract, following the order of operations.",
      "Put the second term into the rule to get the third. Keep going, one term at a time, until you reach the term asked for.",
      "Check that each term came from the term just before it, not from the first term.",
    ],
    watch:
      "Square the whole term before, then add. In $(a_{n-1})^2+4$ with $a_{n-1}=5$, square first to get 25, then add 4 to get 29.",
    principle:
      "A recursive sequence is set by its first term and a rule $a_n=f(a_{n-1})$, where $f$ stands for what the rule does to the term before. So $a_2=f(a_1)$, $a_3=f(a_2)$, and so on. To reach the $k$th term, apply the rule $k-1$ times.",
    example: {
      prompt:
        "A sequence has $a_1=4$ and $a_n=2(a_{n-1})^2-5$ for $n\\ge2$. Find $a_3$.",
      steps: [
        "Read the rule in words: square the term before, multiply by 2, then subtract 5. The note $n\\ge2$ ($n$ is 2 or more) means the rule makes every term from the second on. The first term is given.",
        "Use $a_1 = 4$ to get the second term. Square first, because powers come before multiplying: $a_2=2 \\times 4^2-5=2 \\times 16-5=32-5=27$.",
        "Use $a_2 = 27$, the term just before $a_3$, not $a_1$: $a_3=2 \\times 27^2-5=2 \\times 729-5=1458-5=1453$.",
      ],
      answer: "$a_3=1453$",
    },
    methodTitle: "Keep the terms in a list",
    methodText: [
      "Write $a_1$, $a_2$, $a_3$ one under another. Each line uses only the line just above it.",
      "Squares grow fast. By the third term the number can have three or four digits, so check each square with care: $27^2 = 27 \\times 27 = 729$.",
    ],
    formal:
      "A rule like $a_n = (a_{n-1})^2 + k$ squares the term before. So the terms do not go up by the same amount each time (an arithmetic sequence), or by the same factor each time (a geometric sequence). No simple formula jumps straight to a far term. The terms are found by applying the rule in order.",
    pitfalls: [
      "Use the term just before in every step, not the first term.",
      "Square before you multiply, and multiply before you add or subtract. This is the order of operations.",
    ],
    parentGuide:
      "Ask your learner to write each term on its own line and to say which term it came from.",
    senses: { term: "term-sequence", rule: "rule", square: "square-number" },
    noLink: ["third", "whole", "factor", "jumps"],
  },
  {
    id: "remainder-steps",
    title: "Find a remainder by evaluating at the zero of the divisor",
    summary:
      "The remainder of $f(x)$ divided by $x-r$ is the value $f(r)$, found term by term.",
    objectives: [
      "Name the value of $x$ that makes a linear divisor equal to zero.",
      "Evaluate a cubic at that value, term by term, to find the remainder.",
    ],
    intuition:
      "Divide $f(x)$ by $x-2$ and write $f(x)=(x-2)q(x)+R$, where $R$ is a number. At $x=2$ the first part is $0\\cdot q(2)=0$, so $f(2)=R$. The remainder is what is left of $f$ at the one point where the divisor vanishes. Evaluating is much shorter than long division.",
    terms: [
      [
        "remainder",
        "When a polynomial is divided by $x - r$, the remainder is a number.",
      ],
      [
        "zero-of-a-function",
        "For the divisor $x-r$ it is $x=r$; for $x+r$ it is $x=-r$.",
      ],
    ],
    method: [
      "Set the divisor equal to 0 and solve for $x$.",
      "Substitute that value for every $x$ in $f(x)$, keeping each term's sign and putting a negative value in parentheses.",
      "Evaluate the powers, then the products, then add.",
      "The result is the remainder.",
    ],
    watch:
      "For $x+2$ the value is $-2$, not 2. A negative value cubed stays negative: $(-2)^3=-8$.",
    principle:
      "Remainder theorem: when a polynomial $f(x)$ is divided by $x-r$, the remainder is $f(r)$. In particular, $x-r$ divides $f(x)$ exactly if and only if $f(r)=0$.",
    example: {
      prompt:
        "Find the remainder when $f(x)=2x^3-x^2+4x-1$ is divided by $x+1$.",
      steps: [
        "$x+1=0$ when $x=-1$.",
        "$2x^3-x^2$ at $x=-1$: $2(-1)^3-(-1)^2=-2-1=-3$.",
        "$4x-1$ at $x=-1$: $4(-1)-1=-5$.",
        "$f(-1)=-3-5=-8$.",
      ],
      answer: "The remainder is $-8$",
    },
    methodTitle: "Evaluate in two parts",
    methodText: [
      "Split the polynomial into its high-power terms and its low-power terms, evaluate each, and add.",
      "Keep a negative value in parentheses until you have applied the power.",
    ],
    formal:
      "Dividing $f(x)$ by $x-r$ gives $f(x)=(x-r)q(x)+R$ with a constant $R$. Substituting $x=r$ gives $f(r)=R$.",
    pitfalls: [
      "Find the value that makes the divisor zero; the sign changes from the divisor.",
      "Apply the exponent to the negative value before multiplying by the coefficient.",
    ],
    parentGuide:
      "Ask your learner which value of $x$ makes the divisor zero and to check it by substituting into the divisor.",
  },
  {
    id: "addition-rule-steps",
    title: "Percent in either of two overlapping groups",
    summary:
      "Some people are in both of two groups, so adding the two percents counts them twice. Subtract the percent in both groups once.",
    objectives: [
      "Find the percent of people in one group or the other (in at least one of the two) from the percent in each group and the percent in both.",
      "Find the percent in neither group by subtracting from 100%, the whole group.",
    ],
    intuition:
      "A percent is a number out of 100: 58% means 58 out of every 100 people. Suppose 58% of a school speak English and 24% speak Mandarin. Some people speak both. Each of them is counted in the 58% and again in the 24%. So the sum, 58 + 24 = 82, counts those people twice. The people in both groups are called the overlap. If 16% speak both, take 16 away once, and everyone is counted exactly once: 82 − 16 = 66. So 66% speak English or Mandarin. Here “or” means at least one of the two: English, Mandarin, or both. Everyone else, 100 − 66 = 34, makes 34% who speak neither.",
    terms: [
      ["union", "A person in both groups counts once."],
      [
        "intersection",
        "Here, the people in both groups; each group's percent counts them, so subtract them once.",
      ],
    ],
    method: [
      "Add the percent in the first group to the percent in the second group.",
      "Subtract the percent in both groups once, because the sum counted those people twice.",
      "The result is the percent in at least one group, read “in one group or the other”.",
      "For the percent in neither group, subtract that result from 100%.",
    ],
    watch:
      "Subtract the overlap, the people in both groups, once. Subtracting it twice leaves those people out entirely.",
    principle:
      "For two events $A$ and $B$ (things that may happen), $P(A\\text{ or }B)=P(A)+P(B)-P(A\\text{ and }B)$. Here $P$ means the probability, the share of the whole group. The probability of neither is $1-P(A\\text{ or }B)$, where 1 stands for the whole group, 100%.",
    example: {
      prompt:
        "At a club, 40% play chess, 35% play checkers and 15% play both. What percent play chess or checkers? What percent play neither?",
      steps: [
        "Add the two percents: $40+35=75$. The 15% who play both are counted in each, so 75 counts them twice.",
        "Subtract the overlap once: $75-15=60$. So 60% play chess or checkers, at least one of the two.",
        "The whole club is 100%. Everyone else plays neither game: $100-60=40$, so 40% play neither.",
      ],
      answer: "60% play chess or checkers; 40% play neither",
    },
    methodTitle: "Check with the parts",
    methodText: [
      "Split the club into three groups that do not overlap. Only chess: $40-15=25$. Only checkers: $35-15=20$. Both: 15. Together $25+20+15=60$, the same answer.",
      "The percent in either group can never be less than the larger single percent. It can never be more than 100%.",
    ],
    formal:
      "Call the two groups $A$ and $B$. The people in both are written $A\\cap B$ (read “$A$ and $B$”). The people in at least one are written $A\\cup B$ (read “$A$ or $B$”). Bars around a group, as in $|A|$, mean the number of people in it. Then $|A\\cup B|=|A|+|B|-|A\\cap B|$. Dividing every count by the size of the whole group gives the same rule for percents.",
    pitfalls: [
      "Subtract the overlap. Do not add it.",
      "Subtract the overlap only once, from the sum, not from each group.",
    ],
    parentGuide:
      "Ask your learner to draw two overlapping circles. Put the percent in both groups in the middle first, then fill in the rest.",
    senses: { event: "event" },
    noLink: ["leaves", "whole", "more than", "mean", "rule"],
  },
  {
    id: "average-rate-steps",
    title: "Average rate of change from a table",
    summary:
      "The average rate of change is how much a quantity changed per year on average: divide the total change by the number of years.",
    objectives: [
      "Pick the two rows of a table for the years named, and find the change in the quantity and the change in years.",
      "Divide the change in the quantity by the change in years to get the average rate of change per year, and round as asked.",
    ],
    intuition:
      "A rate of change tells how fast a quantity changes, such as people per year. “Per year” means for each year. Suppose a town grew from 1,000 people to 1,600 people over 20 years. It gained $1{,}600 - 1{,}000 = 600$ people in all. Spread evenly over 20 years, that is $600 \\div 20 = 30$ people each year. The real growth may have been uneven, faster in some years and slower in others. The average rate of change is the steady speed that gives the same total change: 30 people per year. In a table, use only the two rows for the years the question names.",
    terms: ["average-rate-of-change"],
    method: [
      "Find the two years the question names in the table. Ignore the other rows.",
      "Subtract the earlier value from the later value. This is the change in the quantity.",
      "Subtract the earlier year from the later year. This is the change in years.",
      "Divide the change in the quantity by the change in years. Round only at the end.",
    ],
    watch:
      "Use the two years the question names, which may not be the first and last rows. Subtract later minus earlier on top and on the bottom.",
    principle:
      "The average rate of change of $f$ from $a$ to $b$ is $\\frac{f(b)-f(a)}{b-a}$. Here $f(a)$, read “$f$ of $a$”, is the value of the quantity at input $a$. This is the slope, or steepness, of the straight segment joining the two points on the graph. It is negative when the quantity goes down.",
    example: {
      prompt:
        "A population was 52,000 in 1990, 55,500 in 2000 and 61,000 in 2010. Find the average rate of change between 1990 and 2010.",
      steps: [
        "The question names 1990 and 2010, so use those two values. Change in population, the number of people, later minus earlier: $61{,}000-52{,}000=9{,}000$.",
        "Change in years, in the same order, later minus earlier: $2010-1990=20$.",
        "Divide the change in population by the change in years: $\\frac{9{,}000}{20}=450$ people per year. The 2000 value is not needed.",
      ],
      answer: "450 people per year",
    },
    methodTitle: "Check the sign and the size",
    methodText: [
      "From 1990 to 2000 the town gained 3,500 people, or 350 a year. From 2000 to 2010 it gained 5,500, or 550 a year. The average over both, 450, lies between them, as it should.",
      "Round after dividing. Rounding the values first can change the answer.",
    ],
    formal:
      "The average rate of change is the slope of the secant line, the straight line through two points of the graph, $(a,f(a))$ and $(b,f(b))$. For a linear function, whose graph is a straight line, it is the same for every pair of inputs.",
    pitfalls: [
      "Subtract in the same order on top and on the bottom: later minus earlier both times.",
      "Divide by the number of years between the two rows, not by the number of rows.",
    ],
    parentGuide:
      "Ask your learner which two rows they used and how many years apart they are.",
    senses: { change: "change" },
    noLink: ["population", "average"],
  },
  {
    id: "budget-items-steps",
    title: "How many items fit a budget or reach a goal",
    summary:
      "A fixed cost plus a price for each item must stay within a budget or reach a goal. Find the most or fewest whole items that work.",
    objectives: [
      "Write an inequality, a statement that one amount is at most or at least another, for a fixed amount plus a price per item against a budget or a goal.",
      "Find the greatest or least whole number of items that makes the inequality true.",
    ],
    intuition:
      "A budget is the most money you can spend. A goal is an amount you want to reach or pass. Abby has 20 dollars and first spends 8.50 dollars on lunch. That leaves $20 - 8.50 = 11.50$ dollars for tickets at 2.25 dollars each. Five tickets cost $5 \\times 2.25 = 11.25$ dollars, which fits. Six tickets cost $6 \\times 2.25 = 13.50$ dollars, which is too much. Dividing gives $11.50 \\div 2.25 \\approx 5.11$, where $\\approx$ means “is about”. You cannot buy part of a ticket, so the answer is a whole number (0, 1, 2, 3 and so on): 5 tickets. With $n$ for the number of tickets, the cost is $8.50 + 2.25n$, where $2.25n$ means 2.25 times $n$. The statement $8.50 + 2.25n \\le 20$ is called an inequality. The sign $\\le$ means “is less than or equal to”, or “at most”. The sign $\\ge$ means “at least”.",
    terms: ["inequality", "whole-number"],
    method: [
      "Write the total: the fixed amount plus the price times $n$, the number of items.",
      "Compare it with the limit. Use $\\le$ (at most) for a budget and $\\ge$ (at least) for a goal.",
      "Subtract the fixed amount from both sides. Then divide both sides by the price, a positive number, so the sign stays the same.",
      "Round down for a budget and up for a goal, so the condition still holds. Check that whole number in the inequality.",
    ],
    watch:
      "Round the way the condition needs. About 5.1 tickets means 5 under a budget, but 6 to reach a goal.",
    principle:
      "When the price $p$ is greater than 0, $f+pn\\le B$ is true exactly when $n\\le\\frac{B-f}{p}$. Here $f$ is the fixed amount and $B$ is the budget. So the greatest whole number of items is $\\frac{B-f}{p}$ rounded down. For a goal $G$, $f+pn\\ge G$ needs $n\\ge\\frac{G-f}{p}$, so the least whole number is $\\frac{G-f}{p}$ rounded up.",
    example: {
      prompt:
        "A club has 50 dollars to spend. A banner costs 12 dollars, and each poster costs 3.50 dollars. What is the greatest number of posters it can buy?",
      steps: [
        "Let $n$ be the number of posters. The total cost is the banner plus 3.50 dollars per poster, $12+3.5n$. It must be at most 50 dollars, so $12+3.5n\\le50$.",
        "Subtract 12, the banner's cost, from both sides: $3.5n\\le38$. That is the money left for posters.",
        "Divide both sides by 3.5, a positive number, so the $\\le$ sign stays the same: $n\\le\\frac{38}{3.5}\\approx10.86$.",
        "You cannot buy part of a poster, and 11 posters would cost too much, so round down. The greatest whole number is 10.",
      ],
      answer: "10 posters",
    },
    methodTitle: "Test the answer and the next whole number",
    methodText: [
      "Ten posters cost $12+35=47$ dollars, which is within 50. Eleven cost $12+38.5=50.5$ dollars, which is over.",
      "For a goal, test the answer and the whole number just below it. The answer should reach the goal, and the number below it should not.",
    ],
    formal:
      "When $p>0$, the solutions of $f+pn\\le B$ are all $n\\le\\frac{B-f}{p}$. The whole-number solutions are 0, 1, 2 and so on, up to $\\frac{B-f}{p}$ rounded down. Rounding down is written $\\lfloor x\\rfloor$, the floor of $x$. So the greatest number of items is $\\lfloor\\frac{B-f}{p}\\rfloor$.",
    pitfalls: [
      "Subtract the fixed amount before dividing by the price.",
      "Round down for a budget and up for a goal. Do not round to the nearest whole number.",
    ],
    parentGuide:
      "Ask your learner to try the answer and the next whole number in the original problem.",
    senses: { "more than": "more-than", side: "side-of-equation" },
    noLink: ["leaves", "whole", "part"],
  },
];

export const regentsWrittenWorkContent = workContent(entries);

export const regentsWrittenWorkFacetMappings: FacetMapping[] = [
  {
    templateId: "recursion-term-steps",
    facetId: "arithmetic-sequences.core",
    extent: "partial",
    rationale:
      "Written work: each term from a_2 to a_3 or a_4 found by applying a nonlinear recursive rule (squaring plus a constant, doubling the square minus a constant, or doubling plus a constant) to the term before, each an exact step. First terms 2 to 9. Does not assess explicit rules, other recursive rules, or finding a term far down the sequence.",
  },
  {
    templateId: "remainder-steps",
    facetId: "polynomial-division.core",
    extent: "partial",
    rationale:
      "Written work: the zero of a divisor x - r or x + r with r up to 3, the value of the higher-power terms and of the lower-power terms of a cubic at that value, and the remainder, each an exact step. Does not assess long or synthetic division, a quotient, a divisor that is not monic, or the factor theorem as a conclusion.",
  },
  {
    templateId: "addition-rule-steps",
    facetId: "probability-addition.core",
    extent: "partial",
    rationale:
      "Written work for percents of a group: the sum of two percents, the percent in either group after subtracting the overlap and, when asked, the percent in neither, each an exact step. Does not assess probabilities written as fractions, mutually exclusive events, or conditional probability.",
  },
  {
    templateId: "average-rate-steps",
    facetId: "average-rate-change.core",
    extent: "partial",
    rationale:
      "Written work: from a table of five values at equal year steps of 5 or 10, the change in the quantity, the change in years and the average rate rounded to an integer, for the whole table or an inner pair of years. Does not assess a graph, a function rule, interpreting the rate in words or comparing rates on two intervals.",
  },
  {
    templateId: "budget-items-steps",
    facetId: "linear-inequalities.core",
    extent: "partial",
    rationale:
      "Written work: the typed inequality for a fixed amount plus a price per item against a budget (at most) or a goal (at least), graded as the same relation with the fixed amount first, the money left or still needed and the greatest or least whole number of items. Does not assess equivalent forms of the inequality, graphing the solutions or several constraints.",
  },
];
