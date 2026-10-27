import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const feeChainMethods: Record<string, ProblemMethod> = {
  "fee-plan-chain": {
    goal: "Recover an extra-hour rate from one total and price a new booking, compare two plans' charges, or time a slow constant decrease.",
    intuition:
      "A flat fee covers some hours; only the hours after that earn the hourly charge. One known total therefore reveals the hourly charge: take away the flat fee and divide by the extra hours. A rate such as 1 unit every 8 days means each unit of change takes 8 days.",
    terms: [
      ["extra hours", "The hours beyond the ones the flat fee covers."],
      [
        "rate",
        "How much changes per unit of time, or how much time one unit of change takes.",
      ],
    ],
    method: [
      "Find the quantity the rate acts on: the extra hours beyond the flat fee, or the total change from start to end.",
      "Find the rate or the amount: divide the charge beyond the flat fee by the extra hours, or multiply the change by the time one unit takes.",
      "Use it for the new question: price the new booking, add each plan's charges, or read off the elapsed time.",
    ],
    watch:
      "Subtract the flat fee before dividing, and divide by the extra hours only. For a rate like 1 unit every 8 days, multiply the change by 8; do not divide.",
  },
  "fee-rule-choice": {
    goal: "Choose the equation for a flat fee covering the first hours plus a rate for extra hours, in grouped or expanded form.",
    intuition:
      "The charge is the flat fee plus the rate times the extra hours. The extra hours are $h$ minus the hours the flat fee covers. Expanding the product gives a line whose slope is the rate and whose intercept is the flat fee minus the rate times the covered hours.",
    terms: [
      [
        "grouped form",
        "$C=F+r(h-h_0)$, which shows the flat fee and the extra hours.",
      ],
      [
        "expanded form",
        "$C=rh+(F-rh_0)$, the slope-intercept form of the same line.",
      ],
    ],
    method: [
      "Write the extra hours as $h$ minus the hours covered by the flat fee.",
      "Multiply by the rate (recover the rate first if only one total is given) and add the flat fee.",
      "To match an expanded choice, multiply out the group and combine the constants.",
    ],
    watch:
      "Only the hours after the covered ones earn the rate. Expanding $F+r(h-h_0)$ makes the intercept $F-rh_0$, not $F$.",
  },
  "fee-budget-inequality": {
    goal: "Write the inequality for a one-time fee plus a per-unit cost that must stay within a budget, or choose its solution set.",
    intuition:
      "The cost of $x$ units is the fee plus the rate times $x$. Staying within the budget means that cost is not more than the budget, or is less than it when the budget must not be reached. Solving the inequality gives the largest number of units that fit.",
    terms: [
      ["at most", "Less than or equal to; the total may equal the budget."],
      ["under", "Strictly less than; the total may not equal the budget."],
    ],
    method: [
      "Write the cost as the fee plus the rate times $x$.",
      "Compare the cost with the budget using $\\le$ for at most and $\\lt$ for under.",
      "To find the solution set, subtract the fee from both sides, then divide by the positive rate.",
    ],
    watch:
      "Subtract the fee from the budget before you divide by the rate. Dividing the budget by the rate alone ignores the fee.",
  },
};

export const feeChainPrinciples: Record<string, string> = {
  "fee-plan-chain":
    "A charge made of a flat fee $F$ for the first $h_0$ hours and a rate $r$ for each hour after is $F+r(h-h_0)$ for $h\\ge h_0$. One known pair $(H, T)$ with $H>h_0$ gives $r=(T-F)/(H-h_0)$. A quantity that changes by 1 unit every $k$ time units takes $kd$ time units to change by $d$.",
  "fee-rule-choice":
    "A flat fee $F$ for the first $h_0$ hours plus rate $r$ for each additional hour gives $C=F+r(h-h_0)=rh+(F-rh_0)$ for $h\\ge h_0$. The slope of the line is $r$ and its intercept is $F-rh_0$.",
  "fee-budget-inequality":
    "Cost $F+rx$ stays at most $B$ exactly when $x\\le(B-F)/r$ for positive $r$, and stays under $B$ exactly when $x<(B-F)/r$. Subtracting $F$ and dividing by a positive $r$ keep the direction of the inequality.",
};

export const feeChainLessons = [
  chainLesson({
    id: "fee-chain",
    title: "Fees, rates and budgets",
    summary:
      "Separate a flat fee from a rate, recover the rate from one total, and use it to price, compare or set a budget.",
    templateIds: ["fee-plan-chain", "fee-rule-choice", "fee-budget-inequality"],
    objectives: [
      "Recover an hourly rate from a flat fee, an allowance and one total, then price another booking.",
      "Write a charge as an equation or a budget as an inequality, and solve for the largest count that fits.",
    ],
    openingTitle: "A flat fee covers some hours, a rate covers the rest",
    opening: [
      "Many charges have two parts. A flat fee is paid once and may cover a number of hours. A rate is paid for each unit after that, such as each extra hour. Only the extra hours earn the rate.",
      "One known total therefore tells you the rate. Take the flat fee away from the total, then divide what is left by the number of extra hours. With the rate you can price any other booking, or ask how many hours fit in a budget.",
    ],
    example: {
      prompt:
        "A studio charges 40 dollars for the first 2 hours and a fixed charge for each hour after. A booking of 6 hours costs 76 dollars. Write the charge $C$ for $h$ hours, $h\\ge2$, and find the cost of 9 hours.",
      steps: [
        "A 6-hour booking has $6-2=4$ extra hours.",
        "The extra hours cost $76-40=36$ dollars, so each costs $36\\div4=9$ dollars.",
        "For $h$ hours, $C=40+9(h-2)$. Expanding gives $C=9h+22$.",
        "For 9 hours, $C=40+9(9-2)=40+63=103$ dollars.",
      ],
      answer: "103 dollars",
    },
    methodTitle: "Extra hours, rate, then the new question",
    method: [
      "Find the extra hours: the hours booked minus the hours the flat fee covers. Find the rate: the charge beyond the flat fee divided by the extra hours.",
      "For a budget $B$ with fee $F$ and rate $r$, the cost is $F+rx$. Use $\\le$ for at most and $\\lt$ for under. Subtract $F$ from both sides and divide by $r$ to get the largest count that fits.",
    ],
    formalTitle: "The line behind the charge",
    formal: [
      "For $h\\ge h_0$ the charge is the linear function $C(h)=F+r(h-h_0)$ with slope $r$ and intercept $F-rh_0$. Two points $(h_0, F)$ and $(H, T)$ on the line give $r=(T-F)/(H-h_0)$.",
      "Since $r>0$, the inequality $F+rx\\le B$ is equivalent to $x\\le(B-F)/r$ and keeps its direction when both sides are divided by $r$. For a count of items the solution set contains only whole numbers.",
    ],
    pitfalls: [
      "Subtract the flat fee from the total before dividing by the extra hours.",
      "Do not charge the rate for the hours the flat fee already covers.",
      "Subtract the fee from the budget first when solving for the number of units.",
    ],
    parentGuide:
      "Ask your learner which hours the flat fee pays for and which hours earn the rate, using the numbers in the problem.",
  }),
];

export const feeChainFacetMappings: FacetMapping[] = [
  {
    templateId: "fee-plan-chain",
    facetId: "linear-equation-modeling.solve-model",
    extent: "partial",
    rationale:
      "Numeric entry for a flat fee covering an allowance of hours with the hourly rate recovered from one booking total, two plans with monthly and per-event charges compared over a number of months, and a constant slow decrease timed from start to end amounts, with whole-dollar or quarter-dollar amounts. Does not assess graphing, piecewise rules with more than one change point, or rates written as unit rates.",
  },
  {
    templateId: "fee-rule-choice",
    facetId: "linear-equation-modeling.choose-model",
    extent: "partial",
    rationale:
      "Single choice of the equation for a flat fee covering the first hours plus an hourly rate, stated or recovered from one total, in grouped or expanded form. Does not assess writing the equation unaided, graphs, or fees with more than one change point.",
  },
  {
    templateId: "fee-budget-inequality",
    facetId: "linear-inequalities.core",
    extent: "partial",
    rationale:
      "Single choice of the inequality for a fee plus a per-unit cost within a budget, at most or under, or of its solution set for whole-number counts. Does not assess graphing the solution on a number line, negative coefficients, or compound inequalities.",
  },
];
