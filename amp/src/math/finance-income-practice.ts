import { article } from "./agreement";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { table } from "./scene/author";
import {
  assemble,
  random,
  type Draft,
  type Random,
} from "./distribution-practice";
import { checkSeed, options, type Wrong } from "./remaining-gap-practice";

const choice = { requiredResponseCapability: "single-choice-v1" } as const;
const scenes = { requiredFigureCapability: "scenes-v1" } as const;

export const financeIncomeTemplates: readonly TemplateMetadata[] = [
  {
    id: "profit-cost-breakeven",
    version: 1,
    ...choice,
    title: "Profit, cost and break-even",
    skillId: "financial-literacy-elementary",
    gradeBand: "3–5",
    difficultyOffset: 0.3,
    description:
      "Use revenue, fixed and variable costs with whole-dollar amounts: profit or loss for a number sold, the cost to make a number of items, the break-even number, how many more to sell, and which cost is variable.",
  },
  {
    id: "tax-kinds-defined",
    version: 1,
    ...choice,
    title: "Kinds of taxes",
    skillId: "financial-literacy-elementary",
    gradeBand: "3–5",
    difficultyOffset: 0.1,
    description:
      "Match a plain description or a short example to income tax, payroll tax, sales tax or property tax.",
  },
  {
    id: "tax-bracket-owed",
    version: 1,
    ...choice,
    ...scenes,
    title: "Income tax from a bracket table",
    skillId: "financial-literacy-middle",
    gradeBand: "6–8",
    difficultyOffset: 0.55,
    description:
      "Use a three-bracket table in which each rate applies only to the part of income inside its row: tax owed in dollars and cents, the part of income taxed at the middle rate, tax at a bracket boundary, tax after a deduction, and the extra tax on a raise.",
  },
  {
    id: "payroll-property-tax",
    version: 1,
    ...choice,
    title: "Payroll, sales and property tax amounts",
    skillId: "financial-literacy-middle",
    gradeBand: "6–8",
    difficultyOffset: 0.35,
    description:
      "Compute a payroll tax as a percent of gross pay, net pay after two withholdings, a sales-tax total when one item is exempt, and property tax from a rate per 100 dollars of value, with or without an exemption.",
  },
  {
    id: "budget-percent-share",
    version: 1,
    ...choice,
    ...scenes,
    title: "Budget shares as percents",
    skillId: "financial-literacy-middle",
    gradeBand: "6–8",
    difficultyOffset: 0.4,
    description:
      "Read a budget with fixed expenses, variable expenses and savings: the percent each category is of the total, a category amount from its percent, the fixed-expense share, a missing savings percent, and expenses as a percent of income.",
  },
  {
    id: "net-worth-statement",
    version: 1,
    ...choice,
    ...scenes,
    title: "Assets, liabilities and net worth",
    skillId: "financial-literacy-middle",
    gradeBand: "6–8",
    difficultyOffset: 0.45,
    description:
      "Classify items as assets or liabilities, find net worth as assets minus liabilities including negative net worth, find a missing total, and decide how a transaction changes net worth.",
  },
  {
    id: "incentive-compare",
    version: 1,
    ...choice,
    title: "Compare coupons, discounts and rebates",
    skillId: "financial-literacy-middle",
    gradeBand: "6–8",
    difficultyOffset: 0.4,
    description:
      "Find the lowest final cost among a dollar coupon, a percent discount and a mail-in rebate, the cost when a percent discount and a coupon are both used in a stated order, and which of two stores charges less.",
  },
];

const byId = (id: string) => financeIncomeTemplates.find((t) => t.id === id)!;
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
const commas = (n: number) =>
  String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
/** Whole dollars, signed, with a thousands separator. */
const wd = (n: number) =>
  `${n < 0 ? "−" : ""}${commas(n)} ${Math.abs(n) === 1 ? "dollar" : "dollars"}`;
/** Cents as dollars and cents, signed. */
const cents = (c: number) =>
  `${c < 0 ? "−" : ""}${commas(Math.floor(Math.abs(c) / 100))}.${String(Math.abs(c) % 100).padStart(2, "0")}`;
const cd = (c: number) => `${cents(c)} dollars`;
const wrong = (label: string, feedback: string): Wrong => ({ label, feedback });

/* ------------------------------------------------------------------ */
/* Profit, cost and break-even                                         */
/* ------------------------------------------------------------------ */

const businesses = [
  {
    item: "cup of lemonade",
    items: "cups of lemonade",
    seller: "A student",
    make: "lemons, sugar and a cup",
    fixed: ["stand rental", "sign", "pitcher"],
    variable: "Lemons, sugar and cups",
    fixedTitles: ["Stand rental", "Sign", "Pitcher"],
  },
  {
    item: "bracelet",
    items: "bracelets",
    seller: "A club",
    make: "beads and string",
    fixed: ["table fee", "banner", "display stand"],
    variable: "Beads and string",
    fixedTitles: ["Table fee", "Banner", "Display stand"],
  },
  {
    item: "muffin",
    items: "muffins",
    seller: "A baker",
    make: "flour, eggs and a wrapper",
    fixed: ["oven rental", "market permit", "tablecloth"],
    variable: "Flour, eggs and wrappers",
    fixedTitles: ["Oven rental", "Market permit", "Tablecloth"],
  },
] as const;

const profitLabel = (x: number) =>
  x > 0
    ? `Profit of ${wd(x)}`
    : x < 0
      ? `Loss of ${wd(-x)}`
      : "No profit and no loss";

export function profitCase(seed: string) {
  checkSeed(seed);
  const meta = byId("profit-cost-breakeven");
  const r = random(meta.id, seed);
  const variant = r(0, 6);
  const biz = pick(r, businesses);
  const margin = r(2, 5);
  const unitCost = r(1, 4);
  const price = unitCost + margin;
  const star = r(6, 18);
  const fixedTotal = margin * star;
  const f1 = r(Math.ceil(fixedTotal / 4), Math.floor((fixedTotal * 3) / 4));
  const f2 = fixedTotal - f1;
  const count = (x: number) => `${x} ${x === 1 ? biz.item : biz.items}`;
  const setup = `${biz.seller} sells ${biz.items} for ${wd(price)} each. The fixed costs, which stay the same no matter how many are made, are ${wd(f1)} for the ${biz.fixed[0]} and ${wd(f2)} for the ${biz.fixed[1]}. Making each one costs ${wd(unitCost)} in ${biz.make}, a variable cost.`;
  const costOf = (n: number) => fixedTotal + n * unitCost;
  let draft: Draft;
  if (variant === 0 || variant === 1 || variant === 6) {
    const n =
      variant === 0 ? star + r(2, 12) : variant === 1 ? r(2, star - 1) : star;
    const revenue = n * price;
    const profit = revenue - costOf(n);
    const ok = profitLabel(profit);
    draft = {
      prompt: `${setup} If ${count(n)} are made and all are sold, what is the result?`,
      answer: "",
      hint: `Revenue is ${n} × ${wd(price)}. Total cost is the fixed costs (${f1} + ${f2}) plus ${n} × ${wd(unitCost)} for making them. Compare the two.`,
      explanation: [
        `Revenue: ${n} × ${price} = ${wd(revenue)}.`,
        `Total cost: fixed ${f1} + ${f2} = ${fixedTotal}, and variable ${n} × ${unitCost} = ${n * unitCost}, so ${wd(costOf(n))}.`,
        `Profit = revenue − total cost = ${revenue} − ${costOf(n)} = ${profit}. The result: ${ok.toLowerCase()}.`,
      ],
      choices: options(ok, [
        wrong(
          profitLabel(-profit),
          "The sign is reversed. Revenue above total cost is a profit; revenue below total cost is a loss.",
        ),
        wrong(
          profitLabel(n * margin),
          "This leaves out the fixed costs. They must be paid however many are sold.",
        ),
        wrong(
          profitLabel(revenue - fixedTotal),
          "This leaves out the cost of making each one. Every one made adds its variable cost.",
        ),
        wrong(
          profitLabel(revenue),
          "Revenue is the money taken in. Profit subtracts all the costs from it.",
        ),
        wrong(
          profitLabel(n * margin + fixedTotal),
          "The fixed costs are subtracted, not added.",
        ),
        wrong(
          profitLabel(-fixedTotal),
          "This counts only the fixed costs as a loss. The sales bring in money that pays part of them.",
        ),
        wrong(
          profitLabel(n * unitCost),
          "The cost of making the items is subtracted from revenue; it is not the profit.",
        ),
      ]),
    };
  } else if (variant === 2) {
    const n = r(4, 25);
    const total = costOf(n);
    const ok = wd(total);
    draft = {
      prompt: `${setup} What is the total cost of making ${count(n)}?`,
      answer: "",
      hint: `The fixed costs are paid once. The variable cost is ${wd(unitCost)} for each of the ${n} made, so multiply, then add the fixed costs.`,
      explanation: [
        `Fixed costs: ${f1} + ${f2} = ${wd(fixedTotal)}.`,
        `Variable cost: ${n} × ${unitCost} = ${wd(n * unitCost)}.`,
        `Total cost = ${fixedTotal} + ${n * unitCost} = ${ok}.`,
      ],
      choices: options(ok, [
        wrong(wd(n * unitCost), "This leaves out the fixed costs."),
        wrong(
          wd(fixedTotal + unitCost),
          "The variable cost is paid for each one made, not once. Multiply it by the number made.",
        ),
        wrong(
          wd(n * (fixedTotal + unitCost)),
          "The fixed costs are paid once, not for each one made.",
        ),
        wrong(
          wd(fixedTotal + n * price),
          "This uses the selling price. The cost of making each one is its variable cost.",
        ),
        wrong(
          wd(fixedTotal),
          "This is only the fixed costs; add the variable cost of the items made.",
        ),
      ]),
    };
  } else if (variant === 3) {
    const ok = count(star);
    const label = (x: number) => count(x);
    draft = {
      prompt: `${setup} The break-even number is the number sold at which revenue equals total cost. How many must be sold to break even?`,
      answer: "",
      hint: `Each sale brings in ${wd(price)} but costs ${wd(unitCost)} to make. Find how much of each sale is left to pay the ${wd(fixedTotal)} of fixed costs.`,
      explanation: [
        `Each one sold leaves ${price} − ${unitCost} = ${wd(margin)} after its own making cost.`,
        `The fixed costs total ${f1} + ${f2} = ${wd(fixedTotal)}.`,
        `Break-even number = ${fixedTotal} ÷ ${margin} = ${star}. Check: revenue ${star} × ${price} = ${star * price}; cost ${fixedTotal} + ${star} × ${unitCost} = ${costOf(star)}.`,
      ],
      choices: options(ok, [
        wrong(
          label(Math.ceil(fixedTotal / price)),
          "This divides by the selling price. Part of each sale pays for making that item; only the rest pays the fixed costs.",
        ),
        wrong(
          label(Math.ceil(fixedTotal / unitCost)),
          "This divides by the making cost. Each sale pays the fixed costs with what is left after the making cost, the selling price minus the making cost.",
        ),
        wrong(
          label(star + 1),
          "At this number there is already a profit. Break-even is where profit is exactly zero.",
        ),
        wrong(
          label(Math.max(1, star - 1)),
          "At this number there is still a loss. Break-even is where profit is exactly zero.",
        ),
        wrong(
          label(Math.round(fixedTotal / (price + unitCost))),
          "Subtract the making cost from the price; do not add them.",
        ),
      ]),
    };
  } else if (variant === 4) {
    const amounts = biz.fixedTitles.map(() => r(3, 20));
    const list = biz.fixedTitles
      .map((name, i) => `${name.toLowerCase()} (${wd(amounts[i]!)})`)
      .join(", ");
    const ok = biz.variable;
    draft = {
      prompt: `${biz.seller} has these costs for selling ${biz.items}: ${list}, and ${biz.make} (${wd(unitCost)} for each one made). Which cost is a variable cost, one that grows with the number made?`,
      answer: "",
      hint: `Imagine making twice as many ${biz.items}. Would the ${wd(amounts[0]!)} for ${biz.fixedTitles[0]!.toLowerCase()} change? A cost that stays at the same amount is fixed; a cost that doubles is variable. Test each listed cost this way.`,
      explanation: [
        `If twice as many are made, the ${biz.fixed.join(", ")} costs stay the same, so they are fixed costs.`,
        `The cost of ${biz.make} is ${wd(unitCost)} for each one, so it doubles when twice as many are made.`,
        `The variable cost is ${ok.toLowerCase()}.`,
      ],
      choices: options(
        ok,
        biz.fixedTitles.map((name) =>
          wrong(
            name,
            `This stays the same however many ${biz.items} are made, so it is a fixed cost.`,
          ),
        ),
      ),
    };
  } else {
    const drawn = r(1, star - 1);
    const sold = drawn * 2 === star ? drawn + 1 : drawn;
    const ok = count(star - sold);
    draft = {
      prompt: `${setup} So far ${count(sold)} have been sold. How many more must be sold to reach the break-even number?`,
      answer: "",
      hint: `First find how much of each sale is left after its making cost: ${wd(price)} − ${wd(unitCost)}. Use it to find the break-even number, then account for the ${sold} already sold.`,
      explanation: [
        `Each sale leaves ${price} − ${unitCost} = ${wd(margin)}. Fixed costs: ${fixedTotal}.`,
        `Break-even number = ${fixedTotal} ÷ ${margin} = ${star}.`,
        `${star} − ${sold} = ${star - sold} more must be sold.`,
      ],
      choices: options(ok, [
        wrong(
          count(star),
          "This is the full break-even number. The sales already made count toward it.",
        ),
        wrong(
          count(sold),
          "This is the number already sold, not the number still needed.",
        ),
        wrong(
          count(star + sold),
          "Subtract the sales already made from the break-even number; do not add them.",
        ),
        wrong(
          count(star - sold + 1),
          "Check the subtraction: the break-even number minus the number already sold.",
        ),
        wrong(
          count(Math.max(1, Math.ceil(fixedTotal / price) - sold)),
          "This divides the fixed costs by the selling price. Use the amount left after the making cost.",
        ),
      ]),
    };
  }
  return {
    variant,
    model: { price, unitCost, fixedTotal, star },
    problem: assemble(meta, seed, r, draft),
  };
}

/* ------------------------------------------------------------------ */
/* Kinds of taxes                                                      */
/* ------------------------------------------------------------------ */

const taxKinds = [
  {
    kind: "Income tax",
    wrongNote:
      "An income tax is figured on the money a person earns over a year.",
    texts: [
      {
        text: "A percent of the money a person earns in a year, reported on a tax return.",
        clue: "the money a person earns in a year",
      },
      {
        text: "Jo earned 30,000 dollars over the year and pays a share of that income to the government when filing a return.",
        clue: "earned 30,000 dollars over the year",
      },
    ],
  },
  {
    kind: "Payroll tax",
    wrongNote:
      "A payroll tax is taken out of each paycheck to pay for programs such as Social Security and Medicare.",
    texts: [
      {
        text: "An amount taken out of every paycheck to pay for programs such as Social Security and Medicare.",
        clue: "taken out of every paycheck",
      },
      {
        text: "A worker's pay stub shows a line for Social Security and Medicare that is withheld from each paycheck.",
        clue: "withheld from each paycheck",
      },
    ],
  },
  {
    kind: "Sales tax",
    wrongNote:
      "A sales tax is a percent of the price added when something is bought.",
    texts: [
      {
        text: "A percent of the price that is added at the register when a customer buys something.",
        clue: "added at the register",
      },
      {
        text: "A book costs 20.00 dollars, and the receipt shows 21.60 dollars because of an added percent of the price.",
        clue: "20.00 dollars becomes 21.60 dollars because of an added percent of the price",
      },
    ],
  },
  {
    kind: "Property tax",
    wrongNote:
      "A property tax is paid yearly on land and buildings, based on their value.",
    texts: [
      {
        text: "A yearly amount, based on its value, that the owner of land or a building pays.",
        clue: "yearly amount, based on its value",
      },
      {
        text: "A family pays the county a bill each year based on what their house and lot are worth.",
        clue: "bill each year based on what their house and lot are worth",
      },
    ],
  },
] as const;

export function taxKindCase(seed: string) {
  checkSeed(seed);
  const meta = byId("tax-kinds-defined");
  const r = random(meta.id, seed);
  const variant = r(0, 7);
  const k = taxKinds[variant % 4]!;
  const form = k.texts[Math.floor(variant / 4)]!;
  const draft: Draft = {
    prompt: `${form.text} Which kind of tax is this?`,
    answer: "",
    hint: `Notice the clue "${form.clue}". Ask what the tax is based on and when it is paid, then match that to a kind in the choices.`,
    explanation: [
      `The clue "${form.clue}" tells what the tax is based on and when it is paid.`,
      k.wrongNote,
      `So the kind of tax is ${k.kind.toLowerCase()}.`,
    ],
    choices: options(
      k.kind,
      taxKinds
        .filter((o) => o.kind !== k.kind)
        .map((o) =>
          wrong(
            o.kind,
            o.wrongNote + " This description matches a different kind.",
          ),
        ),
    ),
  };
  return { variant, problem: assemble(meta, seed, r, draft) };
}

/* ------------------------------------------------------------------ */
/* Bracket income tax                                                  */
/* ------------------------------------------------------------------ */

export type Brackets = {
  t1: number;
  t2: number;
  rates: [number, number, number];
};
/** Exact tax in cents: whole dollars times a whole-number percent. */
export function bracketTaxCents(income: number, b: Brackets) {
  const s1 = Math.min(income, b.t1);
  const s2 = Math.max(0, Math.min(income, b.t2) - b.t1);
  const s3 = Math.max(0, income - b.t2);
  return b.rates[0] * s1 + b.rates[1] * s2 + b.rates[2] * s3;
}

function bracketFigure(b: Brackets): SemanticFigure {
  return {
    kind: "scene",
    scene: table({
      id: "tax-brackets",
      corner: "Income, dollars",
      columns: ["Rate"],
      rows: [
        { label: `Up to ${commas(b.t1)}`, cells: [`${b.rates[0]}%`] },
        {
          label: `${commas(b.t1)}–${commas(b.t2)}`,
          cells: [`${b.rates[1]}%`],
        },
        { label: `Over ${commas(b.t2)}`, cells: [`${b.rates[2]}%`] },
      ],
    }).scene(),
  };
}

export function bracketCase(seed: string) {
  checkSeed(seed);
  const meta = byId("tax-bracket-owed");
  const r = random(meta.id, seed);
  const variant = r(0, 5);
  const r1 = r(1, 2) * 5;
  const r2 = r1 + r(1, 3) * 5;
  const r3 = r2 + r(1, 3) * 5;
  const t1 = r(8, 20) * 1000;
  let t2 = t1 + r(15, 35) * 1000;
  if (t2 - t1 === t1) t2 += 1000;
  const b: Brackets = { t1, t2, rates: [r1, r2, r3] };
  const rates = b.rates;
  const inSecond = () => t1 + 10 * r(20, (t2 - t1) / 10 - 20);
  const inThird = () => t2 + 10 * r(50, 400);
  const intro =
    "A tax table taxes income in brackets. Each rate applies only to the part of the income that lies inside its row.";
  const slices = (income: number) => {
    const s = [
      Math.min(income, t1),
      Math.max(0, Math.min(income, t2) - t1),
      Math.max(0, income - t2),
    ] as const;
    return s;
  };
  const taxSteps = (income: number) => {
    const s = slices(income);
    const lines: string[] = [];
    s.forEach((amount, i) => {
      if (amount > 0)
        lines.push(
          `Row ${i + 1}: ${commas(amount)} × ${rates[i]}% = ${cd(rates[i]! * amount)}.`,
        );
    });
    const total = bracketTaxCents(income, b);
    lines.push(`Add the rows: tax owed = ${cd(total)}.`);
    return { lines, total };
  };
  const topOf = (income: number) => (income <= t1 ? 0 : income <= t2 ? 1 : 2);
  const taxWrongs = (income: number): Wrong[] => {
    const top = topOf(income);
    const s = slices(income);
    const tax = bracketTaxCents(income, b);
    return [
      wrong(
        cd(rates[top]! * income),
        `This taxes the whole income at the rate of its top row, ${rates[top]}%. Each rate applies only to the part of income inside its own row.`,
      ),
      wrong(
        cd(rates[top]! * s[top]!),
        "This taxes only the part of income in the top row. The parts in the lower rows are taxed too, at their own rates.",
      ),
      wrong(
        cd(tax - rates[0] * s[0]),
        `The first ${commas(t1)} dollars is not tax-free; it is taxed at ${r1}%.`,
      ),
      wrong(
        cd(rates[0] * income),
        `This uses the lowest rate for all of the income. Income in higher rows is taxed at their rates.`,
      ),
      wrong(
        cd(Math.round(tax / 10)),
        "A percent is per hundred. Check the decimal place: 12% of 100 is 12, not 1.2.",
      ),
      wrong(
        cd(rates[Math.min(top + 1, 2)]! * income),
        "This uses the rate of the next row for all of the income. Income in this row and below is not taxed at that rate.",
      ),
    ];
  };
  let draft: Draft;
  if (variant === 0 || variant === 1) {
    const income = variant === 0 ? inSecond() : inThird();
    const { lines, total } = taxSteps(income);
    const s = slices(income);
    const ok = cd(total);
    draft = {
      prompt: `${intro} A person has taxable income of ${wd(income)}. How much tax is owed?`,
      figure: bracketFigure(b),
      answer: "",
      hint: `The first ${commas(t1)} dollars is taxed at ${r1}%. Find how much of ${commas(income)} lies in each later row, and tax each part at its own rate.`,
      explanation: [
        `Split ${commas(income)} dollars by row: ${s
          .filter((x) => x > 0)
          .map((x) => commas(x))
          .join(", ")}.`,
        ...lines,
      ],
      choices: options(ok, taxWrongs(income)),
    };
  } else if (variant === 2) {
    const income = inThird();
    const ok = wd(t2 - t1);
    draft = {
      prompt: `${intro} A person has taxable income of ${wd(income)}. How many dollars of that income are taxed at the middle rate, ${r2}%?`,
      figure: bracketFigure(b),
      answer: "",
      hint: `The middle row starts after ${commas(t1)} dollars and ends at ${commas(t2)} dollars. Because the income is above ${commas(t2)} dollars, the whole row is filled.`,
      explanation: [
        `The income ${commas(income)} is above ${commas(t2)}, so the whole middle row is used.`,
        `Its size is ${commas(t2)} − ${commas(t1)} = ${ok}.`,
      ],
      choices: options(ok, [
        wrong(
          wd(income - t1),
          "This counts everything above the first row, including the income in the top row, which is taxed at a higher rate.",
        ),
        wrong(
          wd(income),
          "This is all of the income. Only the part inside the middle row is taxed at the middle rate.",
        ),
        wrong(
          wd(t2),
          "This is the top of the middle row, not its size. Subtract where the row starts.",
        ),
        wrong(wd(income - t2), "This is the part in the top row."),
        wrong(wd(t1), "This is the size of the first row."),
      ]),
    };
  } else if (variant === 3) {
    const deduction = 500 * r(20, 28);
    const taxable = r(0, 1) ? inSecond() : inThird();
    const gross = taxable + deduction;
    const { lines, total } = taxSteps(taxable);
    const ok = cd(total);
    draft = {
      prompt: `${intro} A person earned ${wd(gross)} and takes a standard deduction of ${wd(deduction)}, which is subtracted before tax. How much tax is owed?`,
      figure: bracketFigure(b),
      answer: "",
      hint: `The table applies to taxable income, which is earned income minus the deduction: ${commas(gross)} − ${commas(deduction)}. Find that first, then tax each part at its row's rate.`,
      explanation: [
        `Taxable income = ${commas(gross)} − ${commas(deduction)} = ${wd(taxable)}.`,
        ...lines,
      ],
      choices: options(ok, [
        wrong(
          cd(bracketTaxCents(gross, b)),
          "This taxes the whole earned income. The deduction is subtracted first, and the table applies to taxable income.",
        ),
        wrong(
          cd(rates[topOf(taxable)]! * taxable),
          "This taxes all the taxable income at its top row's rate. Each rate applies only to the part inside its row.",
        ),
        wrong(
          cd(Math.max(0, bracketTaxCents(gross, b) - deduction * 100)),
          "The deduction lowers income before the tax is found; it is not subtracted from the tax.",
        ),
        ...taxWrongs(taxable).slice(2, 4),
      ]),
    };
  } else if (variant === 4) {
    const income = r(0, 1) ? t1 : t2;
    const { lines, total } = taxSteps(income);
    const ok = cd(total);
    draft = {
      prompt: `${intro} A person has taxable income of exactly ${wd(income)}. How much tax is owed?`,
      figure: bracketFigure(b),
      answer: "",
      hint: `${commas(income)} dollars is exactly the top of its row, so no income lies in the next row. Tax each part that lies in a row at that row's rate.`,
      explanation: [
        `No income lies above ${commas(income)}, so the next row is not used.`,
        ...lines,
      ],
      choices: options(ok, taxWrongs(income)),
    };
  } else {
    const secondRow = r(0, 1) === 0;
    const income = secondRow
      ? t1 + 10 * r(20, (t2 - t1) / 10 - 120)
      : inThird();
    const raise = 100 * r(2, 10);
    const rate = secondRow ? r2 : r3;
    const extra = rate * raise;
    const ok = cd(extra);
    const before = bracketTaxCents(income, b);
    const after = bracketTaxCents(income + raise, b);
    draft = {
      prompt: `${intro} A person with taxable income of ${wd(income)} gets a raise of ${wd(raise)}, and the new income is still in the same row. How much more tax is owed?`,
      figure: bracketFigure(b),
      answer: "",
      hint: `Only the ${commas(raise)} dollars of new income is taxed more. Find which row it lies in and use that row's rate.`,
      explanation: [
        `Both ${commas(income)} and ${commas(income + raise)} are in the same row, whose rate is ${rate}%.`,
        `The raise is taxed at that rate: ${commas(raise)} × ${rate}% = ${ok}.`,
        `Check with totals: ${cd(after)} − ${cd(before)} = ${ok}.`,
      ],
      choices: options(ok, [
        wrong(
          cd(after),
          "This is the whole new tax. Only the added tax from the raise is asked for.",
        ),
        wrong(
          cd((secondRow ? r1 : r2) * raise),
          "This uses the rate of the row below. The raise lies in the higher row and is taxed at that row's rate.",
        ),
        wrong(
          cd(rate * income),
          "This taxes the whole income at one rate. The extra tax comes only from the raise.",
        ),
        wrong(
          cd(Math.round(extra / 10)),
          "Check the decimal place: a percent is per hundred.",
        ),
        wrong(
          cd(raise * 100),
          "This pays the whole raise as tax. Only the rate's percent of it is tax.",
        ),
      ]),
    };
  }
  return { variant, model: { b }, problem: assemble(meta, seed, r, draft) };
}

/* ------------------------------------------------------------------ */
/* Payroll, sales and property tax amounts                             */
/* ------------------------------------------------------------------ */

export function payrollPropertyCase(seed: string) {
  checkSeed(seed);
  const meta = byId("payroll-property-tax");
  const r = random(meta.id, seed);
  const variant = r(0, 4);
  let draft: Draft;
  if (variant === 0) {
    const gross = 10 * r(30, 90);
    const rate = r(4, 9);
    const tax = gross * rate;
    const ok = cd(tax);
    draft = {
      prompt: `In this problem, a payroll tax is ${rate}% of gross pay. A worker's gross pay for the week is ${wd(gross)}. How much payroll tax is withheld?`,
      answer: "",
      hint: `${rate}% means ${rate} per 100. Find ${rate}% of ${commas(gross)} dollars; the answer is the tax, not the pay that remains.`,
      explanation: [
        `${rate}% = ${rate} ÷ 100 = ${rate / 100}.`,
        `Tax = ${gross} × ${rate / 100} = ${ok}.`,
      ],
      choices: options(ok, [
        wrong(
          cd(gross * 100 - tax),
          "This is the pay that remains after the tax. The question asks for the tax itself.",
        ),
        wrong(
          cd(Math.round(tax / 10)),
          "Check the decimal place: 5% is 0.05, not 0.005.",
        ),
        wrong(
          cd(tax * 100),
          "A percent is per hundred. Divide the rate by 100 before multiplying.",
        ),
        wrong(
          cd(Math.round((gross / rate) * 100)),
          "Multiply by the rate; do not divide by it.",
        ),
        wrong(
          cd((gross + rate) * 100),
          "This adds the rate to the pay. Find the percent of the pay.",
        ),
      ]),
    };
  } else if (variant === 1) {
    const gross = 10 * r(30, 90);
    const a = r(4, 9);
    const b = r(8, 15);
    const net = gross * (100 - a - b);
    const ok = cd(net);
    draft = {
      prompt: `A worker's gross pay is ${wd(gross)}. A payroll tax of ${a}% and an income tax of ${b}% of gross pay are withheld. What is the net pay?`,
      answer: "",
      hint: `Find each tax as a percent of ${commas(gross)} dollars, or add the two percents first. Net pay is gross pay minus everything withheld.`,
      explanation: [
        `Payroll tax: ${gross} × ${a / 100} = ${cd(gross * a)}. Income tax: ${gross} × ${b / 100} = ${cd(gross * b)}.`,
        `Total withheld: ${cd(gross * a)} + ${cd(gross * b)} = ${cd(gross * (a + b))}.`,
        `Net pay = ${gross} − ${cents(gross * (a + b))} = ${ok}.`,
      ],
      choices: options(ok, [
        wrong(
          cd(gross * (a + b)),
          "This is the total withheld. Net pay is what remains of gross pay.",
        ),
        wrong(
          cd(gross * (100 - a)),
          `This subtracts only the payroll tax. The ${b}% income tax is withheld too.`,
        ),
        wrong(
          cd(gross * (100 - b)),
          `This subtracts only the income tax. The ${a}% payroll tax is withheld too.`,
        ),
        wrong(
          cd((gross - a - b) * 100),
          "This subtracts the percents as if they were dollars. Find the percent of the pay first.",
        ),
        wrong(
          cd(gross * (100 + a + b)),
          "Taxes are withheld, so net pay is smaller than gross pay.",
        ),
      ]),
    };
  } else if (variant === 2) {
    const rate = r(6, 8);
    const taxable = r(10, 80);
    const exempt = r(10, 60);
    const total = taxable * (100 + rate) + exempt * 100;
    const ok = cd(total);
    draft = {
      prompt: `A sales tax of ${rate}% applies to clothing but not to groceries. A shopper buys a jacket for ${wd(taxable)} and groceries for ${wd(exempt)}. What is the total with tax?`,
      answer: "",
      hint: `Find the tax on the ${wd(taxable)} jacket only, because groceries are not taxed. Then add the tax and both prices.`,
      explanation: [
        `Tax on the jacket: ${taxable} × ${rate / 100} = ${cd(taxable * rate)}. Groceries: no tax.`,
        `Total = ${taxable} + ${exempt} + ${cents(taxable * rate)} = ${ok}.`,
      ],
      choices: options(ok, [
        wrong(
          cd((taxable + exempt) * (100 + rate)),
          "This taxes the groceries too. Only the jacket is taxed.",
        ),
        wrong(
          cd((taxable + exempt) * 100),
          "This leaves out the sales tax on the jacket.",
        ),
        wrong(
          cd(taxable * (100 + rate)),
          "This leaves out the price of the groceries. Groceries are not taxed, but they are still paid for.",
        ),
        wrong(
          cd(taxable * rate),
          "This is only the tax. The total includes the prices and the tax.",
        ),
        wrong(
          cd(taxable * 100 + exempt * (100 + rate)),
          "The tax applies to the jacket, not the groceries.",
        ),
      ]),
    };
  } else {
    const exemption = variant === 4 ? 5000 * r(2, 8) : 0;
    const value = 10000 * r(8, 30);
    const rateCents = pick(r, [95, 110, 125, 140, 175, 210]);
    const taxable = value - exemption;
    const tax = (taxable / 100) * rateCents;
    const ok = cd(tax);
    const intro = `A county charges a property tax of ${cd(rateCents)} for each 100 dollars of taxable value.`;
    const explain =
      exemption > 0
        ? [
            `Taxable value = ${commas(value)} − ${commas(exemption)} = ${wd(taxable)}.`,
            `Number of hundreds = ${commas(taxable)} ÷ 100 = ${commas(taxable / 100)}.`,
            `Tax = ${commas(taxable / 100)} × ${cents(rateCents)} = ${ok}.`,
          ]
        : [
            `Number of hundreds = ${commas(value)} ÷ 100 = ${commas(value / 100)}.`,
            `Tax = ${commas(value / 100)} × ${cents(rateCents)} = ${ok}.`,
          ];
    draft = {
      prompt:
        exemption > 0
          ? `${intro} A home is worth ${wd(value)}, and a homestead exemption of ${wd(exemption)} is subtracted from its value before the tax is found. What is the yearly property tax?`
          : `${intro} A home is assessed at ${wd(value)} for the tax. What is the yearly property tax?`,
      answer: "",
      hint:
        exemption > 0
          ? `Subtract the exemption first: ${commas(value)} − ${commas(exemption)}. Then count how many 100-dollar units are in the taxable value and charge ${cents(rateCents)} dollars for each.`
          : `Count how many 100-dollar units are in ${commas(value)} dollars, then charge ${cents(rateCents)} dollars for each unit.`,
      explanation: explain,
      choices: options(ok, [
        wrong(
          cd((taxable / 1000) * rateCents),
          "This charges the rate per 1,000 dollars. The rate is per 100 dollars.",
        ),
        ...(exemption > 0
          ? [
              wrong(
                cd((value / 100) * rateCents),
                "This taxes the full value. The exemption is subtracted first.",
              ),
              wrong(
                cd(((taxable + exemption) / 100) * rateCents),
                "The exemption lowers the taxable value; it is not added to it.",
              ),
            ]
          : [
              wrong(
                cd((taxable / 10) * rateCents),
                "Check the count of 100-dollar units in the value: divide by 100, not 10.",
              ),
            ]),
        wrong(
          cd(taxable * rateCents),
          "Divide the value by 100 first to count the 100-dollar units; then multiply by the rate.",
        ),
        wrong(
          cd((taxable / 100) * 100),
          "This charges 1 dollar per 100 dollars of value. Use the stated rate.",
        ),
        wrong(
          cd(rateCents * 100 + taxable),
          "The tax is the rate times the number of 100-dollar units, not a sum.",
        ),
      ]),
    };
  }
  return { variant, problem: assemble(meta, seed, r, draft) };
}

/* ------------------------------------------------------------------ */
/* Budget shares                                                       */
/* ------------------------------------------------------------------ */

const fixedNames = ["Rent", "Phone plan", "Car payment", "Insurance"] as const;
const variableNames = ["Food", "Gas", "Fun", "Clothing"] as const;

function shares(r: Random, k: number) {
  const units = new Array<number>(k).fill(1);
  for (let left = 20 - k; left > 0; left--) units[r(0, k - 1)]!++;
  if (units.every((u) => u === units[0])) {
    units[0]!++;
    units[1]!--;
  }
  return units.map((u) => u * 5);
}

export function budgetShareCase(seed: string) {
  checkSeed(seed);
  const meta = byId("budget-percent-share");
  const r = random(meta.id, seed);
  const variant = r(0, 4);
  const total = 20 * r(20, 60);
  const dollarsOf = (share: number) => (share * total) / 100;
  const fixedTwo = fixedNames
    .map((n) => [n, r(0, 1000)] as const)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([n]) => n);
  const varTwo = variableNames
    .map((n) => [n, r(0, 1000)] as const)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([n]) => n);
  const names = [...fixedTwo, ...varTwo, "Savings"] as string[];
  const sh = shares(r, 5);
  const rows = names.map((name, i) => ({
    name,
    share: sh[i]!,
    amount: dollarsOf(sh[i]!),
    type: i < 2 ? "Fixed" : i < 4 ? "Variable" : "Savings",
  }));
  const pc = (x: number) => `${Number.isInteger(x) ? x : x.toFixed(1)}%`;
  let figure: SemanticFigure | undefined;
  let draft: Draft;
  if (variant === 0) {
    const target = rows[r(0, 4)]!;
    const other = rows.find(
      (x) => x.name !== target.name && x.share !== target.share,
    )!;
    figure = {
      kind: "scene",
      scene: table({
        id: "budget-amounts",
        corner: "Category",
        columns: ["Dollars"],
        rows: rows.map((x) => ({
          label: x.name,
          cells: [`${commas(x.amount)}`],
        })),
      }).scene(),
    };
    const ok = pc(target.share);
    draft = {
      prompt: `A monthly budget of ${wd(total)} is planned as shown. What percent of the budget is ${target.name}?`,
      figure,
      answer: "",
      hint: `Compare ${commas(target.amount)} dollars with the whole budget, ${commas(total)} dollars: divide the part by the whole, then write the quotient as a percent.`,
      explanation: [
        `The whole budget is ${commas(total)} dollars.`,
        `${commas(target.amount)} ÷ ${commas(total)} = ${target.share / 100}.`,
        `${target.share / 100} = ${ok}.`,
      ],
      choices: options(ok, [
        wrong(pc(other.share), "This is the percent for a different category."),
        wrong(
          pc(100 - target.share),
          "This is the percent of the budget that is not this category.",
        ),
        wrong(
          pc(Math.round((target.amount / (total - target.amount)) * 100)),
          "This compares the category with the rest of the budget. A percent of the budget compares it with the whole.",
        ),
        wrong(
          pc(target.share / 10),
          "Check the decimal place when you change the quotient into a percent.",
        ),
        wrong(
          pc(target.share + 5),
          "Check the division: the part divided by the whole.",
        ),
      ]),
    };
  } else if (variant === 1) {
    const target = rows[r(0, 4)]!;
    const other = rows.find(
      (x) => x.name !== target.name && x.amount !== target.amount,
    )!;
    figure = {
      kind: "scene",
      scene: table({
        id: "budget-percents",
        corner: "Category",
        columns: ["% of income"],
        rows: rows.map((x) => ({ label: x.name, cells: [pc(x.share)] })),
      }).scene(),
    };
    const ok = wd(target.amount);
    draft = {
      prompt: `A monthly income of ${wd(total)} is split as shown. How many dollars go to ${target.name}?`,
      figure,
      answer: "",
      hint: `${target.name} is ${pc(target.share)} of ${commas(total)} dollars. Write ${pc(target.share)} as a decimal or as ${target.share} per 100, then take that part of the income.`,
      explanation: [
        `${pc(target.share)} = ${target.share} ÷ 100 = ${target.share / 100}.`,
        `${commas(total)} × ${target.share / 100} = ${ok}.`,
      ],
      choices: options(ok, [
        wrong(
          wd(target.share),
          "This treats the percent as a number of dollars. Take that percent of the income.",
        ),
        wrong(
          wd(total - target.amount),
          "This is the rest of the income, not this category.",
        ),
        wrong(
          wd(target.amount * 10),
          "Check the decimal place: divide the percent by 100.",
        ),
        wrong(wd(other.amount), "This is the amount for a different category."),
        wrong(
          wd(Math.round(target.amount / 10)),
          "Check the decimal place: divide the percent by 100, not 1,000.",
        ),
      ]),
    };
  } else if (variant === 2) {
    const fixedShare = rows[0]!.share + rows[1]!.share;
    const varShare = rows[2]!.share + rows[3]!.share;
    figure = {
      kind: "scene",
      scene: table({
        id: "budget-types",
        corner: "Category",
        columns: ["Type", "Dollars"],
        rows: rows.map((x) => ({
          label: x.name,
          cells: [x.type, commas(x.amount)],
        })),
      }).scene(),
    };
    const ok = pc(fixedShare);
    const amount = dollarsOf(fixedShare);
    draft = {
      prompt: `The monthly income of ${wd(total)} is all planned as shown. Fixed expenses stay the same each month; variable expenses can change. What percent of the income goes to fixed expenses?`,
      figure,
      answer: "",
      hint: `Add only the rows marked Fixed: ${rows[0]!.name} and ${rows[1]!.name}. Then divide that total by ${commas(total)} dollars and write the result as a percent.`,
      explanation: [
        `Fixed rows: ${commas(rows[0]!.amount)} + ${commas(rows[1]!.amount)} = ${commas(amount)} dollars.`,
        `${commas(amount)} ÷ ${commas(total)} = ${fixedShare / 100}.`,
        `${fixedShare / 100} = ${ok}.`,
      ],
      choices: options(ok, [
        wrong(
          pc(varShare),
          "This is the share of the variable expenses. Use the rows marked Fixed.",
        ),
        wrong(
          pc(rows[4]!.share),
          "This is the savings share. Savings is not a fixed expense row.",
        ),
        wrong(
          pc(rows[0]!.share),
          "This is only the first fixed row. Add both fixed rows.",
        ),
        wrong(
          pc(fixedShare + rows[4]!.share),
          "Savings is not a fixed expense, so it is not included.",
        ),
        wrong(
          pc(100 - fixedShare),
          "This is the share that is not fixed expenses.",
        ),
        wrong(
          pc(fixedShare + 5),
          "Check the addition of the two fixed amounts.",
        ),
        wrong(
          pc(Math.max(5, fixedShare - 5)),
          "Check the addition of the two fixed amounts.",
        ),
        wrong(
          pc(rows[1]!.share),
          "This is only the second fixed row. Add both fixed rows.",
        ),
        wrong(
          pc(100 - rows[4]!.share),
          "This is the share of all expenses, fixed and variable. Use only the fixed rows.",
        ),
      ]),
    };
  } else if (variant === 3) {
    const given = rows.slice(0, 4);
    const known = given.reduce((s, x) => s + x.share, 0);
    figure = {
      kind: "scene",
      scene: table({
        id: "budget-known",
        corner: "Category",
        columns: ["% of income"],
        rows: [
          ...given.map((x) => ({ label: x.name, cells: [pc(x.share)] })),
          { label: "Savings", cells: ["?"] },
        ],
      }).scene(),
    };
    const ok = pc(100 - known);
    draft = {
      prompt: `All of a monthly income is planned. Four categories use the percents shown, and the rest is saved. What percent is saved?`,
      figure,
      answer: "",
      hint: `The categories together must make 100% of the income. Add the four given percents, then find what is left of 100%.`,
      explanation: [
        `Given percents: ${given.map((x) => x.share).join(" + ")} = ${known}%.`,
        `Savings = 100% − ${known}% = ${ok}.`,
      ],
      choices: options(ok, [
        wrong(
          pc(known),
          "This is the total of the four given categories. Savings is what is left of 100%.",
        ),
        wrong(
          pc(100 - known + 5),
          "Check the addition of the four given percents.",
        ),
        wrong(
          pc(Math.max(5, 100 - known - 5)),
          "Check the addition of the four given percents.",
        ),
        wrong(
          pc(100),
          "The four categories use part of the income, so savings is less than 100%.",
        ),
        wrong(pc(known / 2), "Subtract the given percents from 100%."),
        wrong(
          pc(100 - known + 10),
          "Check the addition of the four given percents.",
        ),
        wrong(
          pc(Math.max(5, 100 - known - 10)),
          "Check the addition of the four given percents.",
        ),
      ]),
    };
  } else {
    const income = 20 * r(10, 40);
    const over = 5 * r(1, 5);
    const expenses = income + (income * over) / 100;
    const ok = pc(100 + over);
    draft = {
      prompt: `A monthly budget has income of ${wd(income)} and planned expenses of ${wd(expenses)}. The expenses are what percent of the income?`,
      answer: "",
      hint: `Divide the expenses, ${commas(expenses)} dollars, by the income, ${commas(income)} dollars, and write the quotient as a percent. The spending is more than the income, so expect more than 100%.`,
      explanation: [
        `${commas(expenses)} ÷ ${commas(income)} = ${(100 + over) / 100}.`,
        `${(100 + over) / 100} = ${ok}, so spending is ${over}% more than income: a deficit of ${wd(expenses - income)}.`,
      ],
      choices: options(ok, [
        wrong(
          pc(over),
          "This is how much the expenses exceed the income, as a percent of the income. The expenses themselves are 100% plus that.",
        ),
        wrong(
          pc(100 - over),
          "Expenses are more than the income, so they are more than 100% of it.",
        ),
        wrong(
          pc((100 + over) / 100),
          "Check the decimal place when you change the quotient into a percent.",
        ),
        wrong(
          pc(Math.round((income / expenses) * 100)),
          "This divides income by expenses. The question compares the expenses with the income.",
        ),
        wrong(
          pc(100 + over * 2),
          "Check the division: expenses divided by income.",
        ),
      ]),
    };
  }
  return {
    variant,
    model: { total, rows },
    problem: assemble(meta, seed, r, draft),
  };
}

/* ------------------------------------------------------------------ */
/* Net worth                                                           */
/* ------------------------------------------------------------------ */

const assetPool = [
  ["Savings account", 200, 2500],
  ["Bicycle", 80, 400],
  ["Laptop", 200, 900],
  ["Phone", 100, 500],
  ["Game console", 100, 300],
  ["Car", 3000, 9000],
] as const;
const liabilityPool = [
  ["Car loan balance", 500, 4000],
  ["Credit card debt", 100, 900],
  ["Debt to a friend", 20, 200],
  ["Unpaid phone bill", 30, 150],
  ["Student loan debt", 400, 3000],
] as const;

function pickN<T>(r: Random, items: readonly T[], n: number) {
  return items
    .map((x) => [x, r(0, 10000)] as const)
    .sort((a, b) => a[1] - b[1])
    .slice(0, n)
    .map(([x]) => x);
}

export function netWorthCase(seed: string) {
  checkSeed(seed);
  const meta = byId("net-worth-statement");
  const r = random(meta.id, seed);
  const variant = r(0, 5);
  const value = (lo: number, hi: number) =>
    10 * r(Math.ceil(lo / 10), Math.floor(hi / 10));
  let draft: Draft;
  let figure: SemanticFigure | undefined;
  if (variant === 0 || variant === 1) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const assets = pickN(r, assetPool.slice(0, 5), 3).map(
        ([n, lo, hi]) => [n, value(lo, hi)] as [string, number],
      );
      const debts = pickN(r, liabilityPool, 2).map(
        ([n, lo, hi]) => [n, value(lo, hi)] as [string, number],
      );
      const A = assets.reduce((s, [, v]) => s + v, 0);
      const L = debts.reduce((s, [, v]) => s + v, 0);
      const want = variant === 0 ? A > L : A < L;
      if (!want) continue;
      const rows = pickN(r, [...assets, ...debts], 5);
      figure = {
        kind: "scene",
        scene: table({
          id: "net-worth-items",
          corner: "Item",
          columns: ["Dollars"],
          rows: rows.map(([n, v]) => ({ label: n, cells: [commas(v)] })),
        }).scene(),
      };
      const net = A - L;
      const ok = wd(net);
      draft = {
        prompt: `Each item is listed with its value or the amount owed, in dollars. An asset is something owned that has value; a liability is money owed. What is the net worth?`,
        figure,
        answer: "",
        hint: `Sort the five items into assets (owned) and liabilities (owed). Add each group separately, then subtract the liabilities from the assets.`,
        explanation: [
          `Assets: ${assets.map(([, v]) => v).join(" + ")} = ${wd(A)}.`,
          `Liabilities: ${debts.map(([, v]) => v).join(" + ")} = ${wd(L)}.`,
          `Net worth = assets − liabilities = ${A} − ${L} = ${ok}.`,
        ],
        choices: options(ok, [
          wrong(
            wd(A + L),
            "Liabilities are subtracted from assets, not added.",
          ),
          wrong(wd(A), "This counts only the assets. Subtract what is owed."),
          wrong(
            wd(L - A),
            "The subtraction is reversed. Net worth is assets minus liabilities.",
          ),
          wrong(wd(L), "This is only the liabilities."),
          wrong(
            wd(A - L + 100),
            "Check the sums of the assets and of the liabilities.",
          ),
        ]),
      };
      break;
    }
    if (!draft!) throw new Error("No net-worth set found");
  } else if (variant === 2) {
    const askLiability = r(0, 1) === 1;
    const assets = pickN(r, assetPool, askLiability ? 3 : 1).map(([n]) => n);
    const debts = pickN(r, liabilityPool, askLiability ? 1 : 3).map(([n]) => n);
    const good = askLiability ? debts[0]! : assets[0]!;
    const bad = askLiability ? assets : debts;
    draft = {
      prompt: askLiability
        ? "A liability is money a person owes. Which item is a liability?"
        : "An asset is something a person owns that has value. Which item is an asset?",
      answer: "",
      hint: askLiability
        ? "For each item ask: does the person own it, or does the person owe it? A liability is on the owing side."
        : "For each item ask: does the person own it, or does the person owe it? An asset is on the owning side.",
      explanation: [
        askLiability
          ? `${bad.join(", ")} are things the person owns, so they are assets.`
          : `${bad.join(", ")} are amounts the person owes, so they are liabilities.`,
        `${good} is ${askLiability ? "money owed, a liability" : "owned and has value, an asset"}.`,
      ],
      choices: options(
        good,
        bad.map((n) =>
          wrong(
            n,
            askLiability
              ? "The person owns this, so it is an asset, not a liability."
              : "The person owes this, so it is a liability, not an asset.",
          ),
        ),
      ),
    };
  } else if (variant === 3) {
    const A = value(1000, 6000);
    const net = (r(0, 1) ? 1 : -1) * value(100, Math.min(900, A - 200));
    const L = A - net;
    const ok = wd(L);
    draft = {
      prompt: `A person's total assets are ${wd(A)} and net worth is ${wd(net)}. What are the person's total liabilities?`,
      answer: "",
      hint: `Net worth, ${wd(net)}, is assets, ${wd(A)}, minus liabilities. Rearrange this for the liabilities: they are the assets minus the net worth.`,
      explanation: [
        `Net worth = assets − liabilities, so liabilities = assets − net worth.`,
        `${A} − (${net}) = ${L}. The liabilities are ${ok}.`,
      ],
      choices: options(ok, [
        wrong(
          wd(A + net),
          "Assets plus net worth is not the liabilities. Liabilities are assets minus net worth.",
        ),
        wrong(
          wd(net - A),
          "The subtraction is reversed: assets minus net worth.",
        ),
        wrong(
          wd(Math.abs(net)),
          "This is the size of the net worth, not the liabilities.",
        ),
        wrong(wd(A), "This is the assets."),
        wrong(
          wd(-L),
          "Liabilities are an amount owed, so the number is positive.",
        ),
      ]),
    };
  } else {
    const x = 50 * r(2, 18);
    const events = [
      {
        text: `pays ${wd(x)} from a savings account toward a loan`,
        delta: 0,
        why: `Assets fall by ${x} (less in savings) and liabilities fall by ${x} (less owed). Net worth = assets − liabilities, so the two changes cancel.`,
      },
      {
        text: `borrows ${wd(x)} and keeps the cash in a savings account`,
        delta: 0,
        why: `Assets rise by ${x} (more cash) and liabilities rise by ${x} (more owed), so the two changes cancel.`,
      },
      {
        text: `buys a bicycle worth ${wd(x)} with money from a savings account`,
        delta: 0,
        why: `Savings (an asset) falls by ${x} and the bicycle (an asset) rises by ${x}. Liabilities do not change.`,
      },
      {
        text: `spends ${wd(x)} from a savings account on concert tickets that are used up`,
        delta: -x,
        why: `Assets fall by ${x} and nothing owned replaces it. Liabilities do not change, so net worth falls by ${x}.`,
      },
    ];
    const e = pick(r, events);
    const labels = {
      same: "It does not change",
      up: `It increases by ${wd(x)}`,
      down: `It decreases by ${wd(x)}`,
      down2: `It decreases by ${wd(2 * x)}`,
    };
    const ok = e.delta === 0 ? labels.same : labels.down;
    draft = {
      prompt: `A person ${e.text}. How does the person's net worth change?`,
      answer: "",
      hint: `Decide separately what happens to the person's assets and to the person's liabilities when ${wd(x)} changes hands. Then compare the two changes, since net worth is assets minus liabilities.`,
      explanation: [e.why, `Net worth: ${ok.toLowerCase()}.`],
      choices: options(
        ok,
        [
          wrong(
            labels.same,
            "Something changed that is not offset by a matching change. Check what is left after the transaction.",
          ),
          wrong(
            labels.up,
            "Net worth does not go up here. Check what happens to assets and liabilities.",
          ),
          wrong(
            labels.down,
            "Check whether a matching asset or debt change offsets this one.",
          ),
          wrong(
            labels.down2,
            "A change of this size is counted twice. Count the change once.",
          ),
        ].filter((w) => w.label !== ok),
      ),
    };
  }
  return { variant, problem: assemble(meta, seed, r, draft!) };
}

/* ------------------------------------------------------------------ */
/* Comparing incentives                                                */
/* ------------------------------------------------------------------ */

export function incentiveCase(seed: string) {
  checkSeed(seed);
  const meta = byId("incentive-compare");
  const r = random(meta.id, seed);
  const variant = r(0, 3);
  let draft: Draft;
  if (variant === 0) {
    let P = 0,
      a = 0,
      p = 0,
      b = 0,
      sp = 0;
    for (let attempt = 0; attempt < 80; attempt++) {
      P = 20 * r(3, 8);
      a = 5 * r(1, 5);
      p = 5 * r(1, 6);
      b = 5 * r(1, 6);
      sp = (P * p) / 100;
      const s = [a, sp, b].sort((x, y) => y - x);
      if (s[0]! > s[1]!) break;
    }
    const savings = [
      ["The dollar coupon", a],
      ["The percent discount", sp],
      ["The mail-in rebate", b],
    ] as const;
    const best = savings.reduce((m, x) => (x[1] > m[1] ? x : m));
    const label = ([name, s]: readonly [string, number]) =>
      `${name}, for a final cost of ${cd((P - s) * 100)}`;
    const ok = label(best);
    draft = {
      prompt: `A jacket costs ${wd(P)}. Offer A is a coupon for ${wd(a)} off. Offer B is ${p}% off. Offer C is a mail-in rebate: pay the full price, then receive ${wd(b)} back. Only one offer can be used. Which gives the lowest final cost?`,
      answer: "",
      hint: `Find how many dollars each offer saves: the coupon saves ${a}, the rebate returns ${b}, and the percent discount is ${p}% of ${P}. The offer that saves the most gives the lowest final cost.`,
      explanation: [
        `Coupon: saves ${wd(a)}, so the cost is ${P} − ${a} = ${wd(P - a)}.`,
        `Percent discount: ${p}% of ${P} = ${P} × ${p / 100} = ${wd(sp)}, so the cost is ${P} − ${sp} = ${wd(P - sp)}.`,
        `Rebate: ${wd(b)} comes back, so the cost is ${P} − ${b} = ${wd(P - b)}.`,
        `The lowest cost is ${wd(P - best[1])}: ${best[0].toLowerCase()}.`,
      ],
      choices: options(ok, [
        ...savings
          .filter((x) => x[0] !== best[0])
          .map((x) =>
            wrong(
              label(x),
              `This saves ${wd(x[1])}, but another offer saves more. Compare the dollars saved by all three.`,
            ),
          ),
        wrong(
          "All three offers cost the same",
          "Find the dollars saved by each offer; they are not equal.",
        ),
      ]),
    };
  } else if (variant === 1 || variant === 2) {
    const P = 20 * r(3, 8);
    const p = 5 * r(2, 6);
    const a = 5 * r(1, 3);
    const percentFirst = variant === 1;
    const afterPercent = P * (100 - p);
    const correct = percentFirst ? afterPercent - a * 100 : (P - a) * (100 - p);
    const other = percentFirst ? (P - a) * (100 - p) : afterPercent - a * 100;
    const ok = cd(correct);
    const orderText = percentFirst
      ? `The ${p}% discount is taken from the price first, and then the ${wd(a)} coupon is subtracted.`
      : `The ${wd(a)} coupon is subtracted first, and then the ${p}% discount is taken from the reduced price.`;
    draft = {
      prompt: `A jacket costs ${wd(P)}. A shopper uses both ${article(p)} ${p}% discount and a ${wd(a)} coupon. ${orderText} What is the final cost?`,
      answer: "",
      hint: percentFirst
        ? `Do the steps in the stated order. First find ${p}% of ${P} and subtract it. Then subtract the coupon from that new price.`
        : `Do the steps in the stated order. First subtract the coupon from ${P}. Then take ${p}% of that reduced price and subtract it.`,
      explanation: percentFirst
        ? [
            `${p}% of ${P} = ${cd(P * p)}, so the price becomes ${cd(afterPercent)}.`,
            `Subtract the coupon: ${cents(afterPercent)} − ${a} = ${ok}.`,
          ]
        : [
            `After the coupon the price is ${P} − ${a} = ${wd(P - a)}.`,
            `${p}% of ${P - a} = ${cd((P - a) * p)}, so the final cost is ${cents((P - a) * 100)} − ${cents((P - a) * p)} = ${ok}.`,
          ],
      choices: options(ok, [
        wrong(
          cd(other),
          "The order is reversed. A percent discount is taken from the price it is applied to, so the order changes the result.",
        ),
        wrong(
          cd(P * (100 - p)),
          "This uses only the percent discount. The coupon is also used.",
        ),
        wrong(
          cd((P - a) * 100),
          "This uses only the coupon. The percent discount is also used.",
        ),
        wrong(
          cd((P - p - a) * 100),
          "This subtracts the percent as dollars. Find the percent of the price first.",
        ),
        wrong(
          cd(P * (100 - p - a)),
          "This subtracts the coupon dollars as a percent. The coupon is dollars off.",
        ),
        wrong(
          cd(afterPercent + a * 100),
          "The coupon lowers the price; it is subtracted, not added.",
        ),
        wrong(
          cd(afterPercent - a),
          "The coupon is dollars off, so subtract its value in dollars; as cents it is 100 times too small.",
        ),
      ]),
    };
  } else {
    let PA = 0,
      PB = 0,
      p = 0,
      a = 0,
      finalA = 0,
      finalB = 0;
    for (let attempt = 0; attempt < 80; attempt++) {
      PA = 20 * r(4, 9);
      PB = 20 * r(4, 9);
      p = 5 * r(2, 6);
      a = 5 * r(1, 6);
      finalA = PA * (100 - p);
      finalB = (PB - a) * 100;
      if (finalA !== finalB) break;
    }
    const aWins = finalA < finalB;
    const gap = Math.abs(finalA - finalB);
    const label = (store: string, g: number) => `Store ${store}, by ${cd(g)}`;
    const ok = label(aWins ? "A" : "B", gap);
    const naive = Math.abs(PA * p - a * 100);
    draft = {
      prompt: `The same jacket is for sale at two stores. Store A lists it at ${wd(PA)} with ${p}% off. Store B lists it at ${wd(PB)} with a coupon for ${wd(a)} off. Which store charges less, and by how much?`,
      answer: "",
      hint: `Find each store's final price: for Store A subtract ${p}% of ${PA} from ${PA}; for Store B subtract ${a} from ${PB}. Then compare the two final prices.`,
      explanation: [
        `Store A: ${PA} − ${p}% of ${PA} = ${PA} − ${cents(PA * p)} = ${cd(finalA)}.`,
        `Store B: ${PB} − ${a} = ${cd(finalB)}.`,
        `${aWins ? "Store A" : "Store B"} charges less, by ${cents(Math.max(finalA, finalB))} − ${cents(Math.min(finalA, finalB))} = ${cd(gap)}.`,
      ],
      choices: options(
        ok,
        [
          wrong(
            label(aWins ? "B" : "A", gap),
            "The stores are reversed. The lower final price is the one that charges less.",
          ),
          wrong(
            label(aWins ? "A" : "B", naive),
            "This uses the difference between the two discounts, not between the final prices. The listed prices differ too.",
          ),
          wrong(
            label(aWins ? "B" : "A", naive),
            "Compare the final prices, not only the amounts taken off.",
          ),
          wrong(
            label(aWins ? "A" : "B", Math.abs(PA - PB) * 100),
            "This is the difference of the listed prices. Each store's discount changes its price before the comparison.",
          ),
          wrong(
            label(aWins ? "B" : "A", Math.abs(PA - PB) * 100),
            "Compare the final prices after each discount, not the listed prices.",
          ),
          wrong(
            "The stores charge the same",
            "Find both final prices; they are not equal.",
          ),
        ].filter((w) => w.label !== ok),
      ),
    };
  }
  return { variant, problem: assemble(meta, seed, r, draft!) };
}

export function generateFinanceIncomeProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  switch (templateId) {
    case "profit-cost-breakeven":
      return profitCase(seed).problem;
    case "tax-kinds-defined":
      return taxKindCase(seed).problem;
    case "tax-bracket-owed":
      return bracketCase(seed).problem;
    case "payroll-property-tax":
      return payrollPropertyCase(seed).problem;
    case "budget-percent-share":
      return budgetShareCase(seed).problem;
    case "net-worth-statement":
      return netWorthCase(seed).problem;
    case "incentive-compare":
      return incentiveCase(seed).problem;
  }
  throw new Error(`Unknown finance-income template ${templateId}`);
}
