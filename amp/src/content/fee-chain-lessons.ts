import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const feeChainMethods: Record<string, ProblemMethod> = {
  "fee-plan-chain": {
    senses: {
      change: "change",
      changes: "change",
      difference: "difference-subtract",
      unit: "unit",
      units: "unit",
    },
    goal: "Find an hourly rate from one total and price a new booking, compare two plans, or time a slow steady decrease.",
    intuition:
      "A flat fee is one charge that covers the first few hours. Only the hours after those, the extra hours, cost the hourly rate. So one known total tells you the rate: take away the flat fee, then divide by the extra hours. A rate like 1 unit every 8 days means each 1 unit of change takes 8 days.",
    terms: [
      [
        "rate",
        "Extra hours are the hours beyond those the flat fee covers; each is charged at the hourly rate.",
      ],
      "rate",
    ],
    method: [
      "Find what the rate acts on: the extra hours beyond the flat fee, or the total change from start to end.",
      "Find the rate: divide the charge beyond the flat fee by the extra hours. Or find the time: multiply the change by the time 1 unit takes.",
      "Use it to answer the new question: price the new booking, add up each plan's charges, or read off the time.",
    ],
    watch:
      "Subtract the flat fee before dividing, and divide by the extra hours only. For 1 unit every 8 days, multiply the change by 8. Do not divide.",
  },
  "fee-rule-choice": {
    noLink: ["rule"],
    senses: { change: "change", part: "part", terms: "term-expression" },
    goal: "Choose the equation for a flat fee that covers the first hours plus a rate for each extra hour, grouped or multiplied out.",
    intuition:
      "The charge is the flat fee plus the rate times the extra hours. If $h$ is the hours booked, the extra hours are $h$ minus the hours the flat fee covers. Parentheses are the curved brackets ( ). A number written right next to them multiplies what is inside: $9(h - 2)$ means 9 times $(h - 2)$.",
    terms: [
      [
        "expression",
        "$C = F + r(h - h_0)$ shows the flat fee $F$ plus the rate $r$ times the extra hours $h - h_0$.",
      ],
      [
        "slope-intercept-form",
        "Here the expanded form is $C = rh + (F - rh_0)$.",
      ],
    ],
    method: [
      "Write the extra hours as $h$ minus the hours the flat fee covers.",
      "Multiply the extra hours by the rate and add the flat fee. If only one total is given, find the rate first.",
      "To match a multiplied-out choice, multiply the rate by each part inside the parentheses, then combine the plain numbers.",
    ],
    watch:
      "Only the hours after the covered ones cost the rate. Multiplying out $40 + 9(h - 2)$ gives $9h + 22$, so the plain number is 22, not 40.",
  },
  "fee-budget-inequality": {
    senses: { part: "part", sides: "side-of-equation" },
    goal: "Write the inequality for a one-time fee plus a cost per item that must fit a budget, or choose its solution.",
    intuition:
      "A budget is the most money you plan to spend. The cost of $x$ items is the fee plus the cost per item times $x$. The sign $\\le$ means is less than or equal to, for at most. The sign $<$ means is less than, for under. Solving shows which counts fit. The answer is the largest whole number (the numbers 0, 1, 2 and so on) that fits.",
    terms: [
      "at-most",
      [
        "strict-inequality",
        "Under means less than, so the total may not equal the budget: use $<$.",
      ],
    ],
    method: [
      "Write the cost as the fee plus the cost per item times $x$.",
      "Compare the cost with the budget. Use $\\le$ for at most and $<$ for under.",
      "To solve, subtract the fee from both sides (the parts on each side of the sign). Then divide both sides by the cost per item, a positive number.",
    ],
    watch:
      "Subtract the fee from the budget before you divide by the cost per item. Dividing the budget alone ignores the fee.",
  },
};

export const feeChainPrinciples: Record<string, string> = {
  "fee-plan-chain":
    "A charge made of a flat fee $F$ for the first $h_0$ hours and a rate $r$ for each hour after is $F+r(h-h_0)$ for $h\\ge h_0$. One known pair of $H$ hours and total $T$, with $H>h_0$, gives $r=(T-F)/(H-h_0)$. An amount that changes by 1 unit every $k$ days takes $kd$ days, $k$ times $d$, to change by $d$ units.",
  "fee-rule-choice":
    "A flat fee $F$ for the first $h_0$ hours plus rate $r$ for each extra hour gives $C=F+r(h-h_0)=rh+(F-rh_0)$ for $h\\ge h_0$. As a line, its slope (the change in $C$ for each extra hour) is $r$, and its intercept (the plain number) is $F-rh_0$. The rule only applies for $h\\ge h_0$, so the intercept is not itself a booking price.",
  "fee-budget-inequality":
    "For a positive cost per item $r$, the cost $F+rx$ is at most $B$ exactly when $x\\le(B-F)/r$. It is under $B$ exactly when $x<(B-F)/r$. Subtracting $F$ and dividing by a positive $r$ keep the inequality sign pointing the same way.",
};

export const feeChainLessons = [
  {
    ...chainLesson({
      id: "fee-chain",
      title: "Fees, rates and budgets",
      summary:
        "Many charges have two parts. A flat fee is paid once and covers the first few hours. A rate is the charge for each hour after that. If you know one total, take away the flat fee and divide by the extra hours to find the rate. Then you can price any booking, compare plans, or see how much fits in a budget.",
      templateIds: [
        "fee-plan-chain",
        "fee-rule-choice",
        "fee-budget-inequality",
      ],
      objectives: [
        "Find an hourly rate from a flat fee, the hours it covers and one total, then price another booking.",
        "Write a charge as an equation or a budget as an inequality, and find the largest count that fits.",
      ],
      openingTitle: "A flat fee covers some hours, a rate covers the rest",
      opening: [
        "A studio charges 40 dollars for the first 2 hours. Each hour after that costs the same extra amount. A 6-hour booking costs 76 dollars. How much is each extra hour?",
        "The 40 dollars is a flat fee: one charge that covers the first 2 hours. A rate is a charge for each unit, here each hour after the first 2. So only the extra hours cost the rate. A 6-hour booking has 6 − 2 = 4 extra hours.",
        "Take the flat fee away from the total: 76 − 40 = 36 dollars. That is what the 4 extra hours cost, so each costs 36 ÷ 4 = 9 dollars. With the rate, you can price any other booking or see how many hours fit in a budget.",
      ],
      example: {
        prompt:
          "A studio charges 40 dollars for the first 2 hours and a fixed charge for each hour after. A booking of 6 hours costs 76 dollars. Write the charge $C$ for $h$ hours, $h\\ge2$, and find the cost of 9 hours.",
        steps: [
          "The flat fee covers 2 hours, so a 6-hour booking has $6-2=4$ extra hours.",
          "The extra hours cost $76-40=36$ dollars in all. Share that among the 4 extra hours: each costs $36\\div4=9$ dollars.",
          "For $h$ hours, the extra hours are $h-2$. So $C=40+9(h-2)$, meaning 40 plus 9 times $(h-2)$. Multiplying out gives $40+9h-18$, which is $C=9h+22$.",
          "For 9 hours, $C=40+9(9-2)=40+63=103$ dollars.",
        ],
        answer: "103 dollars",
      },
      methodTitle: "Extra hours, rate, then the new question",
      method: [
        "Find the extra hours: the hours booked minus the hours the flat fee covers. Find the rate: the charge beyond the flat fee divided by the extra hours.",
        "A budget is the most money you plan to spend. Call the budget $B$, the fee $F$, and the cost per item $r$. Then $x$ items cost $F+rx$, meaning $F$ plus $r$ times $x$.",
        "The sign $\\le$ means is less than or equal to, so use it for at most. The sign $<$ means is less than, so use it for under. Subtract $F$ from both sides (the parts on each side of the sign), then divide both sides by $r$. That shows which counts fit. For a count of items, the answer is the largest whole number allowed. With $<$, the boundary, the number where the allowed counts stop, is not allowed itself.",
      ],
      formalTitle: "The line behind the charge",
      formal: [
        "Let $h_0$ (read “$h$ sub zero”) be the hours the flat fee covers. For $h\\ge h_0$ the charge is $C(h)=F+r(h-h_0)$. Its graph is part of a line, starting at $h_0$ hours. The slope, the rise in charge for each extra hour, is $r$. The intercept, the plain number when multiplied out, is $F-rh_0$. Two points $(h_0, F)$ and $(H, T)$ on the line give $r=(T-F)/(H-h_0)$.",
        "Since $r>0$, the inequality $F+rx\\le B$ means the same as $x\\le(B-F)/r$. Dividing both sides by a positive number keeps the sign pointing the same way. For a count of items, the answer must be a whole number.",
      ],
      pitfalls: [
        "Subtract the flat fee from the total before dividing by the extra hours.",
        "Do not charge the rate for the hours the flat fee already covers.",
        "When solving for the number of items, subtract the fee from the budget first.",
      ],
      parentGuide:
        "Using the numbers in the problem, ask your learner which hours the flat fee pays for and which hours cost the rate.",
    }),
    senses: {
      parts: "part",
      unit: "unit",
      sides: "side-of-equation",
      boundary: "boundary",
    },
  },
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
