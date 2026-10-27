import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "recursion-term-steps",
    title: "Find terms of a recursive sequence one at a time",
    summary:
      "A recursive rule gives each term from the one before it, so a later term needs every term between it and the first.",
    objectives: [
      "Use a rule that squares or doubles the previous term to find the next term from the first.",
      "Find a later term by writing each term in order, without skipping to the answer.",
    ],
    intuition:
      "A recursive rule is a recipe applied again and again. With $a_1=3$ and $a_n=(a_{n-1})^2+1$, the second term is $3^2+1=10$. To get the third term, use 10, not 3: $10^2+1=101$. Each term is the input for the next.",
    terms: [
      [
        "recursive rule",
        "A rule that gives each term from the term before it, such as $a_n=2a_{n-1}+3$, together with the first term.",
      ],
      [
        "term $a_n$",
        "The number in position $n$ of the sequence; $a_{n-1}$ is the term just before it.",
      ],
    ],
    method: [
      "Write the first term and the rule.",
      "Put the first term into the rule for the second term, following the order of operations.",
      "Put the second term into the rule for the third, and continue to the term you want.",
      "Check that each term follows from the one before it by the rule.",
    ],
    watch:
      "Square the whole previous term before adding: in $(a_{n-1})^2+4$ with $a_{n-1}=5$, the square is 25, then 29. Using $a_1$ again in every step gives the wrong terms.",
    principle:
      "A recursive sequence is determined by its first term and a rule $a_n=f(a_{n-1})$. Then $a_2=f(a_1)$, $a_3=f(a_2)=f(f(a_1))$, and so on: the $k$th term applies the rule $k-1$ times.",
    example: {
      prompt:
        "A sequence has $a_1=4$ and $a_n=2(a_{n-1})^2-5$ for $n\\ge2$. Find $a_3$.",
      steps: [
        "$a_2=2\\cdot4^2-5=2\\cdot16-5=27$.",
        "$a_3=2\\cdot27^2-5=2\\cdot729-5=1453$.",
      ],
      answer: "$a_3=1453$",
    },
    methodTitle: "Keep the terms in a list",
    methodText: [
      "Write $a_1$, $a_2$, $a_3$ one under another. Each line uses only the line above it.",
      "Squares grow fast. A third term can already have three or four digits, so check each square with care.",
    ],
    formal:
      "A rule with $f(a)=a^2+k$ is not linear, so the sequence is neither arithmetic nor geometric and has no simple closed form. Its terms can only be found by applying the rule in order.",
    pitfalls: [
      "Use the previous term in every step, not the first term.",
      "Square before adding or subtracting, following the order of operations.",
    ],
    parentGuide:
      "Ask your learner to write each term on its own line and to say which earlier term it came from.",
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
        "The number left over when a polynomial is divided by $x-r$; it has degree 0.",
      ],
      [
        "zero of the divisor",
        "The value of $x$ that makes the divisor 0: $x=r$ for $x-r$, and $x=-r$ for $x+r$.",
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
      "People in both groups are counted in each percent, so add the percents and subtract the overlap once.",
    objectives: [
      "Find the percent in one group or the other from the percent in each and the percent in both.",
      "Find the percent in neither group as what remains of 100%.",
    ],
    intuition:
      "If 58% speak English and 24% speak Mandarin, the sum 82% counts every person who speaks both twice, once in each percent. If 16% speak both, taking 16% away once leaves each person counted once: 66% speak English or Mandarin.",
    terms: [
      [
        "or (in probability)",
        "In either group or in both. A person in both groups is in the group.",
      ],
      [
        "overlap",
        "The people in both groups, counted once in each group's percent.",
      ],
    ],
    method: [
      "Add the percent in the first group and the percent in the second group.",
      "Subtract the percent in both groups, because the sum counted it twice.",
      "The result is the percent in at least one group.",
      "For neither group, subtract that result from 100%.",
    ],
    watch:
      "Subtract the overlap once. Subtracting it twice removes the people in both groups entirely.",
    principle:
      "For two events, $P(A\\text{ or }B)=P(A)+P(B)-P(A\\text{ and }B)$. The probability of neither is $1-P(A\\text{ or }B)$.",
    example: {
      prompt:
        "At a club, 40% play chess, 35% play checkers and 15% play both. What percent play chess or checkers? What percent play neither?",
      steps: [
        "Add: $40+35=75$.",
        "Subtract the overlap: $75-15=60$, so 60% play chess or checkers.",
        "Neither: $100-60=40$, so 40% play neither.",
      ],
      answer: "60% play chess or checkers; 40% play neither",
    },
    methodTitle: "Check with the parts",
    methodText: [
      "Only chess: $40-15=25$. Only checkers: $35-15=20$. Both: 15. Together $25+20+15=60$.",
      "The percent in either group can never be less than the larger single percent or more than 100%.",
    ],
    formal:
      "The sets $A$ and $B$ overlap in $A\\cap B$, so $|A\\cup B|=|A|+|B|-|A\\cap B|$. Dividing by the size of the whole group gives the percent form.",
    pitfalls: [
      "Subtract the overlap; do not add it.",
      "Do not subtract the overlap from only one of the groups.",
    ],
    parentGuide:
      "Ask your learner to draw two overlapping circles and put each percent in its own region.",
  },
  {
    id: "average-rate-steps",
    title: "Average rate of change from a table",
    summary:
      "The average rate of change between two inputs is the change in the quantity divided by the change in the inputs.",
    objectives: [
      "Choose two rows of a table and find the change in the quantity and the change in years.",
      "Divide to find the average rate of change per year and round as asked.",
    ],
    intuition:
      "If a town grew from 1,000 people to 1,600 people over 20 years, it gained 600 people in all, or on average $\\frac{600}{20}=30$ people each year. The actual growth may have been uneven; the average rate says how fast the town would have grown at a steady pace.",
    terms: [
      [
        "average rate of change",
        "The change in the output divided by the change in the input between two inputs: $\\frac{f(b)-f(a)}{b-a}$.",
      ],
    ],
    method: [
      "Find the two years named in the question in the table; ignore the other rows.",
      "Subtract the earlier value from the later value for the change in the quantity.",
      "Subtract the earlier year from the later year for the change in years.",
      "Divide the first change by the second and round only at the end.",
    ],
    watch:
      "Use the years the question names, not the first and last rows of the table. Subtract in the same order in the numerator and the denominator.",
    principle:
      "The average rate of change of $f$ from $a$ to $b$ is $\\frac{f(b)-f(a)}{b-a}$, the slope of the segment joining the two points of the graph. It is negative when the quantity decreases.",
    example: {
      prompt:
        "A population was 52,000 in 1990, 55,500 in 2000 and 61,000 in 2010. Find the average rate of change between 1990 and 2010.",
      steps: [
        "Change in population: $61{,}000-52{,}000=9{,}000$.",
        "Change in years: $2010-1990=20$.",
        "Rate: $\\frac{9{,}000}{20}=450$ people per year.",
      ],
      answer: "450 people per year",
    },
    methodTitle: "Check the sign and the size",
    methodText: [
      "A rate between two years must be between the slowest and fastest yearly changes you can see in the table.",
      "Round after dividing; rounding the values first changes the answer.",
    ],
    formal:
      "The average rate of change is the slope of the secant line through $(a,f(a))$ and $(b,f(b))$. For a linear function it is the same for every pair of inputs.",
    pitfalls: [
      "Subtract in the same order for the numerator and the denominator.",
      "Divide by the number of years between the two rows, not the number of rows.",
    ],
    parentGuide:
      "Ask your learner which two rows they used and how many years apart they are.",
  },
  {
    id: "budget-items-steps",
    title: "How many items fit a budget or reach a goal",
    summary:
      "A fixed amount plus a price for each item, compared with a budget or goal, makes an inequality; the answer is a whole number.",
    objectives: [
      "Write the inequality for a fixed amount plus a price per item against a budget or a goal.",
      "Find the greatest or least whole number of items that satisfies it.",
    ],
    intuition:
      "Abby has 20 dollars and spends 8.50 first. That leaves 11.50 for tickets at 2.25 each. Five tickets cost 11.25, which fits; six cost 13.50, which does not. The answer is a count of tickets, so it is a whole number, and 5.11 tickets means 5.",
    terms: [
      [
        "inequality",
        "A statement that one amount is less than, greater than, at most or at least another, such as $8.5+2.25n\\le20$.",
      ],
      [
        "whole number",
        "A count of items with no fractional part: 0, 1, 2, 3, and so on.",
      ],
    ],
    method: [
      "Write the total as the fixed amount plus the price times $n$.",
      "Compare it with the budget (at most) or the goal (at least).",
      "Subtract the fixed amount, then divide by the price.",
      "Round down when the limit is a budget and up when it is a goal, so the condition still holds.",
    ],
    watch:
      "Round the way the condition needs: five and a bit tickets means 5 under a budget, but 6 for a goal. Check the whole number in the inequality.",
    principle:
      "For a price $p>0$, $f+pn\\le B$ is true exactly when $n\\le\\frac{B-f}{p}$, so the greatest whole number is $\\lfloor\\frac{B-f}{p}\\rfloor$. For $f+pn\\ge G$ the least whole number is $\\lceil\\frac{G-f}{p}\\rceil$.",
    example: {
      prompt:
        "A club has 50 dollars to spend. A banner costs 12 dollars, and each poster costs 3.50 dollars. What is the greatest number of posters it can buy?",
      steps: [
        "The total cost is $12+3.5n$, so $12+3.5n\\le50$.",
        "Money left for posters: $50-12=38$ dollars, so $3.5n\\le38$.",
        "$n\\le\\frac{38}{3.5}\\approx10.86$, so the greatest whole number is 10.",
      ],
      answer: "10 posters",
    },
    methodTitle: "Test the answer and the next whole number",
    methodText: [
      "Ten posters cost $12+35=47$, which is within 50. Eleven cost $12+38.5=50.5$, which is over.",
      "For a goal, test the answer and the whole number below it to see that one reaches the goal and the other does not.",
    ],
    formal:
      "The solution set of $f+pn\\le B$ with $p>0$ is $n\\le\\frac{B-f}{p}$. The whole-number solutions are $0,1,\\ldots,\\lfloor\\frac{B-f}{p}\\rfloor$, so the greatest is the floor.",
    pitfalls: [
      "Subtract the fixed amount before dividing by the price.",
      "Round down for a budget and up for a goal; do not round to the nearest whole number.",
    ],
    parentGuide:
      "Ask your learner to try the answer and the next whole number in the original problem.",
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
