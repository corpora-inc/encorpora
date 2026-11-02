import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "show-work-box-cost",
    title: "Write costs as expressions, with a one-time coupon",
    summary:
      "If each item costs the same, the total cost is the price times the number of items. A coupon used once comes off the total just once.",
    objectives: [
      "Find the cost of a number of items and write expressions for the cost of $c$ items, with and without a one-time discount.",
      "Work back from an amount spent to the number of items by undoing the discount and then the price.",
    ],
    intuition:
      "If each box costs 5 dollars, then 2 boxes cost $5 \\times 2 = 10$ dollars and 3 boxes cost $5 \\times 3 = 15$ dollars. Each of these is a multiplication: the same 5 dollars counted once for each box. A variable is a letter that stands for a number that can change or is not known yet. Let $c$ be the number of boxes. Then $c$ boxes cost $5c$ dollars, where $5c$ means 5 times $c$. A math phrase like $5c$, made of numbers, letters and operations (adding, subtracting, multiplying, dividing), is called an expression. A coupon worth 2.50 dollars gives a discount, an amount taken off the price. It is used once, so it comes off the total once: the cost is $5c - 2.50$ dollars. It is not $(5 - 2.50)c$, which means 2.50 dollars off the price of each box, times $c$ boxes. To work backward from an amount spent, undo the steps in reverse order. Adding the coupon back gives the cost before the coupon. Dividing that by the price counts how many boxes it paid for. That last step is a division: splitting the amount into groups of one price each.",
    terms: [
      "expression",
      [
        "inverse-operation",
        "Working backward undoes the last operation first: add back the coupon, then divide by the price.",
      ],
    ],
    method: [
      "Multiply the price by the number of items to get the total cost.",
      "Replace the number of items with the letter: the price times $c$.",
      "Subtract a one-time coupon once, from the whole expression.",
      "To find how many items an amount spent buys, add the coupon back to it, then divide by the price. Check by working forward.",
    ],
    watch:
      "A coupon used once comes off the total once. Subtracting it from the price would take it off every item.",
    principle:
      "When every item has the same price $p$, the cost of $c$ items is $pc$, the price times the number of items. A coupon worth $d$ dollars, used once, makes the cost $pc - d$. To find $c$ from an amount spent $B$, undo the steps in reverse order: $c = \\frac{B + d}{p}$, which means $B + d$ divided by $p$.",
    example: {
      prompt:
        "Boxes cost 5 dollars each. A coupon takes 2.50 dollars off one purchase. A teacher spends 47.50 dollars and uses the coupon. Show the work.",
      steps: [
        "Cost of 8 boxes: each box costs 5 dollars, so $8 \\times 5 = 40$ dollars.",
        "Cost of $c$ boxes: the price times the number of boxes, $5c$ dollars.",
        "With the coupon: take 2.50 dollars off the whole cost once, $5c - 2.50$ dollars.",
        "Work backward from the 47.50 dollars spent. The coupon came off last, so add it back first: $47.50 + 2.50 = 50$ dollars before the coupon.",
        "Boxes: undo multiplying by 5, so $50 \\div 5 = 10$. Check by working forward: $5 \\times 10 - 2.50 = 50 - 2.50 = 47.50$ dollars.",
      ],
      answer: "10 boxes",
    },
    methodTitle: "Check forward",
    methodText: [
      "Put your number of items into the coupon expression. It must give exactly the amount spent.",
      "The expressions $5c$ and $c \\cdot 5$ ($c$ times 5) are the same. Changing the order of two numbers being multiplied does not change the result.",
    ],
    formal:
      "With a price $p$ for each item and a coupon worth $d$, the cost rule $C = pc - d$ gives one cost $C$ for each number of items $c$. Set it equal to an amount spent and undo each operation in reverse order. That gives the one value of $c$ with that cost.",
    pitfalls: [
      "Subtract a one-time coupon once, from the total, not from each item's price.",
      "Undo the coupon before dividing by the price, because the coupon came off last.",
    ],
    parentGuide:
      "Ask your learner to check the number of items by working forward from it to the amount spent.",
    noLink: ["whole", "product", "rule", "change"],
  },
  {
    id: "show-work-percent-count",
    title: "Percents of a total, forward and backward",
    summary:
      "A percent is a number out of 100. You can write it as a fraction, use it to find part of a total, or find it from a part and the total.",
    objectives: [
      "Write a percent as a fraction and find that percent of a total.",
      "Find the percent a count is of a total, and how many more reach a target percent.",
    ],
    intuition:
      "A percent is a number out of 100, and the sign % means percent. So 30% means 30 out of every 100, the fraction $\\frac{30}{100}$ (30 parts out of 100 equal parts). Dividing the top and bottom by the same number keeps a fraction's value, so divide both by 10: $\\frac{30}{100} = \\frac{3}{10}$. To find $\\frac{3}{10}$ of the 50 states, split 50 into 10 same-size groups of 5 and take 3 of them: $3 \\times 5 = 15$ states. That is the same as $\\frac{3}{10} \\times 50 = 15$. The total, here 50 states, is called the whole. The count you have, here 15 states, is called the part. To go the other way, ask what share of the whole the part is. Dividing the part by the whole gives that share: 20 of 50 is $\\frac{20}{50}$. To write it out of 100, multiply the top and bottom by 2, because $50 \\times 2 = 100$. Multiplying both by the same number keeps the value, so $\\frac{20}{50} = \\frac{40}{100}$, which is 40%.",
    terms: [
      "percent",
      [
        "part",
        "The part is the count you have; the whole is the total the percent is taken of.",
      ],
      "whole",
    ],
    method: [
      "Write the percent as a fraction over 100, such as $14\\% = \\frac{14}{100}$, and simplify.",
      "To find a percent of a total, multiply the total by that fraction.",
      "To find what percent a part is of the whole, divide the part by the whole and multiply by 100.",
      "To find how many more reach a target percent, find the target count first. Then subtract the count you have.",
    ],
    watch:
      "Find the target count before you subtract. Subtracting the two percents does not give the number of items unless the total is 100.",
    principle:
      "Let $p$ be the percent, $T$ the total and $P$ the part. Then $p\\%$ of $T$ is $\\frac{p}{100} \\times T$. The part $P$ is $\\frac{P}{T} \\times 100$ percent of $T$. Both come from one proportion, an equation saying two fractions are equal: $\\frac{P}{T} = \\frac{p}{100}$.",
    example: {
      prompt:
        "Aaron has visited 30% of the 50 states. He will visit 5 more this year. How many more after that would make exactly 76%?",
      steps: [
        "Write 30% as a fraction: $30\\% = \\frac{30}{100} = \\frac{3}{10}$, dividing the top and bottom by 10.",
        "Find 30% of the 50 states, the states visited so far: $\\frac{3}{10} \\times 50 = 15$ states.",
        "Add the 5 states he will visit this year: $15 + 5 = 20$ states.",
        "Find that as a percent: $\\frac{20}{50} = \\frac{40}{100}$, which is 40% of the states.",
        "Find the target count. 76% is 0.76, because 76 out of 100 is 0.76. So 76% of 50 is $0.76 \\times 50 = 38$ states.",
        "Subtract the states he will already have: $38 - 20 = 18$ more states.",
      ],
      answer: "18 more states",
    },
    methodTitle: "Each step is a labeled number",
    methodText: [
      "Write what each number counts before you use it: states visited, states after this year, states needed. The labels keep the whole and the part straight.",
      "With a total of 50, each state is 2%, because $100 \\div 50 = 2$. With a total of 25, each one is 4%.",
    ],
    formal:
      "A proportion is an equation saying two fractions are equal. The proportion $\\frac{P}{T} = \\frac{p}{100}$ connects a part $P$, a total $T$ and a percent $p$. If you know the total and one of the others, you can find the third. With the total fixed at 50, each state is worth $100 \\div 50 = 2$ percentage points, where a percentage point is a step of 1 in the percent itself, such as from 30% to 31%. So 5 more states add 10 percentage points, from 30% to 40%.",
    pitfalls: [
      "Divide the part by the total, not the total by the part.",
      "Find the target count, then subtract what is already counted.",
    ],
    parentGuide:
      "Ask your learner what each number in their work counts, and how much one item is worth as a percent of the total.",
    senses: {
      part: "part",
      whole: "whole",
      difference: "difference-subtract",
    },
    noLink: ["third", "change", "changes"],
  },
  {
    id: "show-work-rental-plans",
    title: "Compare two plans with an inequality",
    summary:
      "Each plan costs a one-time fee plus a price per mile. A statement that one plan's cost is less than the other's says when it is cheaper.",
    objectives: [
      "Write the cost of each plan as an expression in the amount used.",
      "Write the inequality that compares the plans and find the amount where they cost the same.",
    ],
    intuition:
      "A rental plan charges a fixed fee, paid once, plus a rate, an amount for each mile. Plan A charges 25 dollars plus 0.40 dollars per mile. For 10 miles it costs $25 + 0.40 \\times 10 = 29$ dollars. For $m$ miles it costs $25 + 0.40m$ dollars, where $0.40m$ means 0.40 times $m$. Plan B charges 40 dollars plus 0.20 dollars per mile: $40 + 0.20m$ dollars. An inequality is a statement that one amount is less than or greater than another. The sign $<$ means “is less than” and $>$ means “is greater than”. The two amounts it compares are called the sides of the inequality. Plan A costs less when its cost is smaller: $25 + 0.40m < 40 + 0.20m$.",
    terms: ["fixed-cost", "rate"],
    method: [
      "Write each plan's cost: the fee plus the rate times the amount used.",
      "Write the comparison asked for. “Costs less than” is $<$ and “costs more than” is $>$. Put the cost of the plan named first on the left.",
      "Set the two costs equal and solve, which means find the amount that makes them equal. The cheaper plan can switch only there.",
      "Check one amount below that point and one above it. Both costs grow steadily, so the cheaper plan stays the same all along each side.",
    ],
    watch:
      "Keep each plan's fee with its own rate. Swapping them describes different plans.",
    principle:
      "Call the fees $a$ and $b$, the rates $r$ and $s$, and the amount used $m$. Then one plan costs $a + rm$, where $rm$ means $r$ times $m$, and the other costs $b + sm$. If $r$ and $s$ are different, solving $a + rm = b + sm$ gives exactly one amount where the costs are equal. Subtract $a$ and $sm$ from both sides: $rm - sm = b - a$, so $m = \\frac{b - a}{r - s}$. If that amount is positive (greater than 0), one plan is cheaper below it and the other is cheaper above it. If it is negative, the same plan is cheaper for every amount used.",
    example: {
      prompt:
        "Plan A costs 25 dollars plus 0.40 dollars per mile. Plan B costs 40 dollars plus 0.20 dollars per mile. When does plan A cost less?",
      steps: [
        "Plan A: the fee plus 0.40 dollars for each of $m$ miles, $25 + 0.40m$ dollars.",
        "Plan B: the fee plus 0.20 dollars for each mile, $40 + 0.20m$ dollars.",
        "Plan A costs less when its cost is smaller than plan B's: $25 + 0.40m < 40 + 0.20m$.",
        "The cheaper plan can switch only where the costs are equal, so find that point: $25 + 0.40m = 40 + 0.20m$. Subtract $0.20m$ from both sides, so $m$ is on one side only: $25 + 0.20m = 40$. Subtract 25 from both sides: $0.20m = 15$. Divide both sides by 0.20 to get $m$ alone: $m = 75$ miles. Doing the same to both sides keeps the costs equal.",
        "Test one amount on each side of 75. At 10 miles, A costs 29 dollars and B costs 42 dollars, so A is cheaper. At 100 miles, A costs 65 dollars and B costs 60 dollars, so B is cheaper. Each extra mile adds 0.20 dollars more to A than to B, so A's lead shrinks steadily and is gone at 75. Plan A costs less for fewer than 75 miles.",
      ],
      answer: "$25+0.40m<40+0.20m$; the plans cost the same at 75 miles",
    },
    methodTitle: "Read the inequality both ways",
    methodText: [
      "$25 + 0.40m < 40 + 0.20m$ and $40 + 0.20m > 25 + 0.40m$ say the same thing. The narrow end of the sign always points to the smaller amount.",
      "Test a value. At $m = 10$, plan A costs 29 dollars and plan B costs 42 dollars, so the inequality is true there.",
    ],
    formal:
      "Subtracting the same amount from both sides keeps an inequality true, just as it keeps an equation true. So subtract $0.20m$ and 25 from both sides of $25 + 0.40m < 40 + 0.20m$. That gives $0.20m < 15$. Dividing both sides by 0.20, a positive number (greater than 0), keeps the sign: $m < 75$. So plan A is cheaper for fewer than 75 miles.",
    pitfalls: [
      "Pair each fee with its own rate, the amount charged for each mile.",
      "Use $<$ for “costs less than” and $>$ for “costs more than”.",
    ],
    parentGuide:
      "Ask your learner to test one number of miles in their inequality and say which plan is cheaper there.",
    senses: { side: "side-of-equation" },
    noLink: ["more than"],
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
