import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "show-work-box-cost",
    title: "Write costs as expressions, with a one-time coupon",
    summary:
      "A cost at one price per item is the price times the number of items; a coupon used once comes off the whole cost once.",
    objectives: [
      "Find the cost of a number of items and write expressions for the cost of $c$ items, with and without a one-time discount.",
      "Work back from a budget to the number of items by undoing the discount and then the price.",
    ],
    intuition:
      "If each box costs 5 dollars, then 2 boxes cost $5\\times2$, 3 boxes cost $5\\times3$, and $c$ boxes cost $5c$ dollars. A coupon worth 2.50 dollars is taken off the total once, so the cost becomes $5c-2.50$, not $(5-2.50)c$.",
    terms: [
      "expression",
      [
        "inverse-operation",
        "Working backward undoes the last operation first: add back the coupon, then divide by the price.",
      ],
    ],
    method: [
      "Multiply the price by the number of items for a total cost.",
      "Replace the number of items by the letter: price times $c$.",
      "Subtract a one-time coupon from the whole expression.",
      "To find how many items a budget buys, add the coupon back to the budget, then divide by the price. Check by working forward.",
    ],
    watch:
      "A coupon used once comes off the total once. Subtracting it from the price would take it off every item.",
    principle:
      "A total that is a fixed amount per item is a product, $\\text{price}\\times c$. A one-time discount $d$ makes the total $\\text{price}\\times c-d$. Solving $\\text{price}\\times c-d=B$ undoes the subtraction and then the multiplication: $c=\\frac{B+d}{\\text{price}}$.",
    example: {
      prompt:
        "Boxes cost 5 dollars each. A coupon takes 2.50 dollars off one purchase. A teacher spends 47.50 dollars and uses the coupon. Show the work.",
      steps: [
        "Cost of 8 boxes: $8\\times5=40$ dollars.",
        "Cost of $c$ boxes: $5c$ dollars.",
        "With the coupon: $5c-2.50$ dollars.",
        "Before the coupon: $47.50+2.50=50$ dollars.",
        "Boxes: $50\\div5=10$. Check: $5\\times10-2.50=47.50$.",
      ],
      answer: "10 boxes",
    },
    methodTitle: "Check forward",
    methodText: [
      "Put your number of items into the coupon expression. It must give exactly the amount spent.",
      "The expressions $5c$ and $c\\cdot5$ are the same; order of the factors does not matter.",
    ],
    formal:
      "The cost function $C(c)=pc-d$ is linear. Setting it equal to a budget and undoing each operation in reverse order gives the one value of $c$ with that cost.",
    pitfalls: [
      "Subtract a one-time coupon once, from the total.",
      "Undo the coupon before dividing by the price.",
    ],
    parentGuide:
      "Ask your learner to check the number of items by working forward from it to the amount spent.",
  },
  {
    id: "show-work-percent-count",
    title: "Percents of a total, forward and backward",
    summary:
      "A percent is a number out of 100. It can be written as a fraction, used to find a part of a total, and found from a part and the total.",
    objectives: [
      "Write a percent as a fraction and find that percent of a total.",
      "Find the percent a count is of a total, and how many more reach a target percent.",
    ],
    intuition:
      "30% means 30 out of every 100, the fraction $\\frac{30}{100}=\\frac{3}{10}$. Of 50 states, $\\frac{3}{10}$ is 15. Going the other way, 20 of 50 is $\\frac{20}{50}=\\frac{40}{100}$, which is 40%.",
    terms: [
      "percent",
      [
        "part",
        "The part is the count you have; the whole is the total the percent is taken of.",
      ],
      "whole",
    ],
    method: [
      "Write $p\\%$ as $\\frac{p}{100}$ and simplify.",
      "A percent of a total: multiply the total by the fraction.",
      "The percent a part is of a total: divide the part by the total and multiply by 100.",
      "How many more to reach a target: find the target count first, then subtract the count you have.",
    ],
    watch:
      "Find the target count before subtracting. The difference of two percents is not the number of items unless the total is 100.",
    principle:
      "$p\\%$ of $T$ is $\\frac{p}{100}\\times T$, and a part $P$ of $T$ is $\\frac{P}{T}\\times100\\%$. Both use the same proportion $\\frac{P}{T}=\\frac{p}{100}$.",
    example: {
      prompt:
        "Aaron has visited 30% of the 50 states. He will visit 5 more this year. How many more after that would make exactly 76%?",
      steps: [
        "$30\\%=\\frac{30}{100}=\\frac{3}{10}$.",
        "$\\frac{3}{10}\\times50=15$ states.",
        "$15+5=20$ states.",
        "$\\frac{20}{50}=0.40=40\\%$.",
        "$76\\%$ of 50 is $0.76\\times50=38$.",
        "$38-20=18$ more states.",
      ],
      answer: "18 more states",
    },
    methodTitle: "Each step is a labeled number",
    methodText: [
      "Write what each number counts before you use it: states visited, states after this year, states needed. The labels keep the whole and the part straight.",
      "With a total of 50, each state is 2%. With 25, each is 4%.",
    ],
    formal:
      "The proportion $\\frac{P}{T}=\\frac{p}{100}$ connects a part, a total and a percent; any two determine the third. A change in the part by $k$ changes the percent by $\\frac{100k}{T}$.",
    pitfalls: [
      "Divide the part by the total, not the total by the part.",
      "Find the target count, then subtract what is already counted.",
    ],
    parentGuide:
      "Ask your learner what each number in their work counts, and how much one item is worth as a percent of the total.",
  },
  {
    id: "show-work-rental-plans",
    title: "Compare two plans with an inequality",
    summary:
      "Each plan's cost is a fixed fee plus a rate times the amount used. An inequality between the two costs says when one plan costs less.",
    objectives: [
      "Write the cost of each plan as an expression in the amount used.",
      "Write the inequality that compares the plans and find the amount where they cost the same.",
    ],
    intuition:
      "Plan A charges 25 dollars plus 0.40 dollars per mile, so $m$ miles cost $25+0.40m$. Plan B charges 40 dollars plus 0.20 dollars per mile: $40+0.20m$. Plan A costs less when its cost is smaller: $25+0.40m<40+0.20m$.",
    terms: ["fixed-cost", "rate"],
    method: [
      "Write each plan's cost: fee plus rate times the variable.",
      "Write the comparison asked for: less than is $<$, more than is $>$, with plan A's cost on the side of the plan named first.",
      "Set the costs equal and solve to find where they cost the same.",
      "Check one amount on each side of that point.",
    ],
    watch:
      "Keep each plan's fee with its own rate; swapping them describes different plans.",
    principle:
      "Two linear costs $a+rm$ and $b+sm$ with $r\\neq s$ are equal at exactly one value, $m=\\frac{b-a}{r-s}$. On one side of that value one plan is cheaper; on the other side the other plan is.",
    example: {
      prompt:
        "Plan A costs 25 dollars plus 0.40 dollars per mile. Plan B costs 40 dollars plus 0.20 dollars per mile. When does plan A cost less?",
      steps: [
        "Plan A: $25+0.40m$ dollars.",
        "Plan B: $40+0.20m$ dollars.",
        "Plan A costs less when $25+0.40m<40+0.20m$.",
        "Equal costs: $0.20m=15$, so $m=75$ miles. Below 75 miles plan A is cheaper.",
      ],
      answer: "$25+0.40m<40+0.20m$; the plans cost the same at 75 miles",
    },
    methodTitle: "Read the inequality both ways",
    methodText: [
      "$25+0.40m<40+0.20m$ and $40+0.20m>25+0.40m$ say the same thing: the sign points to the smaller side.",
      "Test a value: at $m=10$, plan A costs 29 dollars and plan B 42 dollars, so the inequality is true.",
    ],
    formal:
      "Subtracting $0.20m$ and 25 from both sides of $25+0.40m<40+0.20m$ gives $0.20m<15$, and dividing by the positive 0.20 gives $m<75$: plan A is cheaper for fewer than 75 miles.",
    pitfalls: [
      "Pair each fee with its own rate.",
      "Use $<$ for “costs less than” and $>$ for “costs more than”.",
    ],
    parentGuide:
      "Ask your learner to test one number of miles in their inequality and say which plan is cheaper there.",
  },
];

export const showWorkContent = workContent(entries);

export const showWorkFacetMappings: FacetMapping[] = [
  {
    templateId: "show-work-box-cost",
    facetId: "variable-expressions.core",
    extent: "partial",
    rationale:
      "Labeled steps: a total cost by entry, typed expressions for the cost of c items with and without a one-time coupon (graded by exact symbolic equivalence), the amount before the coupon and the number of items a budget buys. Whole and decimal prices. Does not assess evaluating given expressions or multi-variable expressions.",
  },
  {
    templateId: "show-work-percent-count",
    facetId: "percentages.core",
    extent: "partial",
    rationale:
      "Labeled steps: a percent as a fraction (any equivalent fraction), that percent of a total of 20, 25, 40 or 50, the count after more are added, the new percent, the count for a target percent and how many more reach it. Does not assess percents above 100, tax or discount contexts.",
  },
  {
    templateId: "show-work-rental-plans",
    facetId: "linear-inequalities.core",
    extent: "partial",
    rationale:
      "Labeled steps: typed costs of two plans with a fixed fee and a rate per mile or hour, the typed inequality saying one plan costs less or more than the other (graded side by side, either way round) and the amount where the costs are equal. Does not assess solving the inequality or graphing its solutions.",
  },
];
