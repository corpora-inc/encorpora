import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  choiceSurface,
  chainFamily,
  decimalText,
  dispatch,
  gcd,
  money,
  numberSurface,
  pick,
} from "./chain-kit";

export const feePlanTemplate: TemplateMetadata = {
  id: "fee-plan-chain",
  version: 1,
  title: "Fee plans: recover a rate, compare plans or find elapsed time",
  skillId: "linear-equation-modeling",
  gradeBand: "9–12",
  difficultyOffset: 0.5,
  description:
    "Recover the rate for hours beyond a flat-fee allowance from one total and price a new booking, compare the combined monthly and per-event charges of two plans, or find elapsed time from a slow constant decrease.",
};
export const feeRuleTemplate: TemplateMetadata = {
  id: "fee-rule-choice",
  version: 1,
  title: "Choose the rule for a flat fee that covers the first hours",
  skillId: "linear-equation-modeling",
  gradeBand: "9–12",
  difficultyOffset: 0.55,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Choose the equation for a charge with a flat fee covering the first hours and a rate for each additional hour, either from the stated rate or after recovering the rate from one total, in grouped or expanded form.",
};
export const feeBudgetTemplate: TemplateMetadata = {
  id: "fee-budget-inequality",
  version: 1,
  title: "Choose the inequality or solution set for a fee within a budget",
  skillId: "linear-inequalities",
  gradeBand: "9–12",
  difficultyOffset: 0.4,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Write the inequality for a one-time fee plus a per-unit cost that must stay within a budget, or choose its solution set for a whole number of units.",
};

/* ------------------------------------------------------------ fee plans */
const planAxes = {
  amounts: defineAxis("amounts", ["whole", "decimal"] as const),
};
type PlanKind = "extra-rate" | "compare-plans" | "slow-rate";
interface PlanModel {
  kind: PlanKind;
  decimal: boolean;
  /** extra-rate: flat fee (cents), allowance hours, booked hours, total paid (cents), new hours. */
  flat: number;
  allowance: number;
  booked: number;
  total: number;
  next: number;
  rate: number; // cents per extra hour
  /** compare-plans: [monthly, charge, count] per plan (cents), months. */
  a: [number, number, number];
  b: [number, number, number];
  months: number;
  /** slow-rate: start/end in tenths, hours per unit. */
  start: number;
  end: number;
  per: number;
  context: number;
}
const studios = [
  "studio",
  "meeting room",
  "boat rental",
  "practice court",
] as const;
const slow = [
  {
    thing: "A candle",
    unit: "centimeter",
    units: "centimeters",
    time: "hours",
    verb: "burns down",
  },
  {
    thing: "A snow pile",
    unit: "inch",
    units: "inches",
    time: "days",
    verb: "melts down",
  },
  {
    thing: "A water tank",
    unit: "liter",
    units: "liters",
    time: "minutes",
    verb: "drains",
  },
] as const;
const blank = {
  flat: 0,
  allowance: 0,
  booked: 0,
  total: 0,
  next: 0,
  rate: 0,
  a: [0, 0, 0] as [number, number, number],
  b: [0, 0, 0] as [number, number, number],
  months: 0,
  start: 0,
  end: 0,
  per: 0,
  context: 0,
};
function planModel(
  r: (lo: number, hi: number) => number,
  ax: { amounts: "whole" | "decimal" },
): PlanModel {
  const decimal = ax.amounts === "decimal";
  const kind = pick(r, ["extra-rate", "compare-plans", "slow-rate"] as const);
  const unit = decimal ? 25 : 100; // cents granularity
  if (kind === "extra-rate") {
    const allowance = r(2, 4);
    const extra = r(2, 6);
    const rate = unit * r(decimal ? 6 : 3, decimal ? 40 : 12);
    const flat = unit * r(decimal ? 20 : 15, decimal ? 120 : 60);
    const next = allowance + r(extra + 1, extra + 4);
    return {
      ...blank,
      kind,
      decimal,
      flat,
      allowance,
      booked: allowance + extra,
      total: flat + rate * extra,
      next,
      rate,
      context: r(0, studios.length - 1),
    };
  }
  if (kind === "compare-plans") {
    const months = r(6, 12);
    const a: [number, number, number] = [
      unit * r(2, 9),
      unit * r(decimal ? 20 : 15, decimal ? 40 : 35),
      r(2, 6),
    ];
    const b: [number, number, number] = [
      unit * r(5, 14),
      unit * r(decimal ? 10 : 8, decimal ? 30 : 25),
      r(2, 5),
    ];
    const total = (p: [number, number, number]) => months * p[0] + p[1] * p[2];
    if (total(a) === total(b)) throw new Error("Need three retries");
    // Make plan B the costlier one.
    return total(a) < total(b)
      ? { ...blank, kind, decimal, a, b, months }
      : { ...blank, kind, decimal, a: b, b: a, months };
  }
  const per = r(2, 12);
  const end = decimal ? 10 * r(2, 9) + 5 * r(0, 1) : 10 * r(2, 9);
  const start = end + (decimal ? 5 * r(2, 30) : 10 * r(2, 12));
  return {
    ...blank,
    kind,
    decimal,
    start,
    end,
    per,
    context: r(0, slow.length - 1),
  };
}
const dollars = (cents: number) => decimalText(cents, 100);
const planTotal = (p: [number, number, number], months: number) =>
  months * p[0] + p[1] * p[2];
export const feePlan = chainFamily({
  template: feePlanTemplate,
  axes: planAxes,
  model: planModel,
  variant: (m) => m.kind,
  render: (m) => {
    if (m.kind === "extra-rate") {
      const place = studios[m.context]!;
      const extra = m.booked - m.allowance;
      const extraNext = m.next - m.allowance;
      const answerCents = m.flat + m.rate * extraNext;
      return numberSurface({
        prompt: `A ${place} charges a flat fee of ${money(m.flat)} that covers the first ${m.allowance} hours, plus a fixed charge for each hour after that. A booking of ${m.booked} hours costs ${money(m.total)} in all. How many dollars does a booking of ${m.next} hours cost?`,
        answer: dollars(answerCents),
        hint: `Only the hours after the first ${m.allowance} earn the hourly charge. The booking of ${m.booked} hours has ${m.booked} - ${m.allowance} extra hours, and the total beyond the flat fee is ${dollars(m.total)} - ${dollars(m.flat)}. Use those two to find the charge for one extra hour.`,
        explanation: [
          `The flat fee covers the first ${m.allowance} hours, so the booking of ${m.booked} hours has $${m.booked}-${m.allowance}=${extra}$ extra hours.`,
          `The extra hours cost $${dollars(m.total)}-${dollars(m.flat)}=${dollars(m.total - m.flat)}$ dollars, so one extra hour costs $${dollars(m.total - m.flat)}\\div${extra}=${dollars(m.rate)}$ dollars.`,
          `A booking of ${m.next} hours has $${m.next}-${m.allowance}=${extraNext}$ extra hours, costing $${extraNext}\\times${dollars(m.rate)}=${dollars(m.rate * extraNext)}$ dollars.`,
          `Add the flat fee, which every booking pays once: $${dollars(m.flat)}+${dollars(m.rate * extraNext)}=${dollars(answerCents)}$ dollars.`,
          `A booking of ${m.next} hours costs ${dollars(answerCents)} dollars.`,
        ],
        label: "Answer (dollars)",
      });
    }
    if (m.kind === "compare-plans") {
      const ta = planTotal(m.a, m.months);
      const tb = planTotal(m.b, m.months);
      return numberSurface({
        prompt: `Harbor Bank charges ${money(m.a[0])} a month plus ${money(m.a[1])} for each overdraft. Summit Bank charges ${money(m.b[0])} a month plus ${money(m.b[1])} for each overdraft. Over ${m.months} months, a customer has ${m.a[2]} overdrafts at Harbor Bank and ${m.b[2]} overdrafts at Summit Bank. How many more dollars in fees does the customer pay at Summit Bank than at Harbor Bank?`,
        answer: dollars(tb - ta),
        hint: `Find each bank's total separately. For Harbor Bank, the monthly charge of ${money(m.a[0])} repeats ${m.months} times, and the ${m.a[2]} overdraft charges add to that.`,
        explanation: [
          `Harbor Bank: $${m.months}\\times${dollars(m.a[0])}+${m.a[2]}\\times${dollars(m.a[1])}=${dollars(m.months * m.a[0])}+${dollars(m.a[1] * m.a[2])}=${dollars(ta)}$ dollars.`,
          `Summit Bank: $${m.months}\\times${dollars(m.b[0])}+${m.b[2]}\\times${dollars(m.b[1])}=${dollars(m.months * m.b[0])}+${dollars(m.b[1] * m.b[2])}=${dollars(tb)}$ dollars.`,
          `Subtract to compare: $${dollars(tb)}-${dollars(ta)}=${dollars(tb - ta)}$.`,
          `Summit Bank costs ${dollars(tb - ta)} dollar${tb - ta === 100 ? "" : "s"} more.`,
        ],
        label: "Answer (dollars)",
      });
    }
    const c = slow[m.context]!;
    const tenths = (v: number) => decimalText(v, 10);
    const drop = m.start - m.end;
    const time = decimalText(drop * m.per, 10);
    return numberSurface({
      prompt: `${c.thing} ${c.verb} 1 ${c.unit} every ${m.per} ${c.time}. It starts at ${tenths(m.start)} ${c.units} and is measured again when it reaches ${tenths(m.end)} ${c.units}. How many ${c.time} pass?`,
      answer: time,
      hint: `Find how far it dropped first: ${tenths(m.start)} - ${tenths(m.end)}. Each ${c.unit} of drop takes ${m.per} ${c.time}.`,
      explanation: [
        `First find how much it changed: start minus end. The drop is $${tenths(m.start)}-${tenths(m.end)}=${tenths(drop)}$ ${c.units}.`,
        `Each ${c.unit} takes ${m.per} ${c.time}, so the time is $${tenths(drop)}\\times${m.per}=${time}$ ${c.time}.`,
        `${time} ${c.time} pass.`,
      ],
      label: `Answer (${c.time})`,
    });
  },
});

/* --------------------------------------------------------- rule choice */
const ruleAxes = {
  "rule-form": defineAxis("rule-form", ["grouped", "expanded"] as const),
};
interface RuleModel {
  kind: "stated-rate" | "recovered-rate";
  flat: number;
  allowance: number;
  rate: number;
  booked: number; // recovered-rate only
  total: number;
  wrongRate: number;
  context: number;
}
const lcm = (a: number, b: number) => (a * b) / gcd(a, b);
function ruleModel(r: (lo: number, hi: number) => number): RuleModel {
  const kind = pick(r, ["stated-rate", "recovered-rate"] as const);
  const allowance = r(2, 4);
  const flat = 5 * r(2, 12);
  if (kind === "stated-rate")
    return {
      kind,
      flat,
      allowance,
      rate: r(3, 15),
      booked: 0,
      total: 0,
      wrongRate: 0,
      context: r(0, studios.length - 1),
    };
  for (let tries = 0; tries < 200; tries++) {
    const extra = pick(r, [2, 3, 4, 6] as const);
    const booked = allowance + extra;
    const step = lcm(booked, extra) / extra;
    const m = r(1, 4);
    const rate = step * m;
    if (rate < 2 || rate > 20) continue;
    const wrongRate = (rate * extra) / booked;
    if (!Number.isInteger(wrongRate) || wrongRate === rate) continue;
    return {
      kind,
      flat,
      allowance,
      rate,
      booked,
      total: flat + rate * extra,
      wrongRate,
      context: r(0, studios.length - 1),
    };
  }
  throw new Error("Need three retries");
}
const signed = (n: number) => (n < 0 ? `-${-n}` : `+${n}`);
const expanded = (slope: number, intercept: number) =>
  `$C=${slope === 1 ? "" : slope}h${intercept === 0 ? "" : signed(intercept)}$`;
export const feeRule = chainFamily({
  template: feeRuleTemplate,
  axes: ruleAxes,
  model: ruleModel,
  variant: (m) => m.kind,
  render: (m, a, r) => {
    const { flat: F, allowance: h0, rate } = m;
    const grouped = (f: number, k: number, op: "-" | "+" = "-") =>
      `$C=${f}+${k}(h${op}${h0})$`;
    const place = studios[m.context]!;
    const correct =
      a["rule-form"] === "grouped"
        ? grouped(F, rate)
        : expanded(rate, F - rate * h0);
    const pool: [string, string][] =
      a["rule-form"] === "grouped"
        ? [
            [
              `$C=${F}+${rate}h$`,
              `This charges the hourly rate for every hour, including the first ${h0} hours that the flat fee already covers. Use $h-${h0}$ for the extra hours.`,
            ],
            [
              `$C=${rate}(h-${h0})$`,
              `This leaves out the flat fee of ${F} dollars that every booking pays.`,
            ],
            [
              `$C=${F}(h-${h0})+${rate}$`,
              `The flat fee is paid once, and the hourly charge multiplies the extra hours. This swaps the two amounts.`,
            ],
            [
              grouped(F, rate, "+"),
              `The extra hours are the hours beyond ${h0}, so subtract ${h0} from $h$; adding it counts hours that were never booked.`,
            ],
          ]
        : [
            [
              expanded(rate, F),
              `The first ${h0} hours are covered by the flat fee, so only $h-${h0}$ hours earn the rate. Expanding $${rate}(h-${h0})$ moves the intercept to $${F}-${rate * h0}$, not ${F}.`,
            ],
            [
              expanded(rate, -rate * h0),
              `This drops the flat fee of ${F} dollars that every booking pays.`,
            ],
            [
              expanded(F, rate - F * h0),
              `The flat fee is paid once, and the hourly charge multiplies the extra hours. This swaps the two amounts.`,
            ],
            [
              expanded(rate, F + rate * h0),
              `Expanding $${rate}(h-${h0})$ subtracts ${rate * h0}, so the intercept is ${F}-${rate * h0}, not a sum.`,
            ],
          ];
    if (m.kind === "stated-rate")
      return choiceSurface(r, {
        prompt: `A ${place} charges a flat fee of ${F} dollars that covers the first ${h0} hours, plus ${rate} dollars for each hour after that. Which equation gives the total charge $C$, in dollars, for a booking of $h$ hours, where $h$ is at least ${h0}?`,
        options: [
          { label: correct, correct: true },
          ...pool.map(([label, feedback]) => ({ label, feedback })),
        ],
        hint: `The flat fee of ${F} dollars already covers the first ${h0} hours, so only the hours after that earn ${rate} dollars each. Write the number of extra hours in terms of $h$ first.`,
        explanation: [
          `The first ${h0} hours are covered by the flat fee, so the extra hours number $h-${h0}$.`,
          `The extra hours cost ${rate} dollars each: $${rate}(h-${h0})$.`,
          `Add the flat fee, paid once: $C=${F}+${rate}(h-${h0})$${a["rule-form"] === "expanded" ? `, which expands to $C=${rate}h${signed(F - rate * h0)}$` : ""}.`,
          `The rule only makes sense for bookings longer than ${h0} hours, where $h-${h0}$ is not negative.`,
        ],
      });
    const rateFound = rate;
    const extra = m.booked - h0;
    const wrongRule =
      a["rule-form"] === "grouped"
        ? `$C=${F}+${m.wrongRate}(h-${h0})$`
        : expanded(m.wrongRate, F - m.wrongRate * h0);
    return choiceSurface(r, {
      prompt: `A ${place} charges a flat fee of ${F} dollars that covers the first ${h0} hours, plus a fixed charge for each hour after that. A booking of ${m.booked} hours costs ${m.total} dollars in all. Which equation gives the total charge $C$, in dollars, for a booking of $h$ hours, where $h$ is at least ${h0}?`,
      options: [
        { label: correct, correct: true },
        {
          label: wrongRule,
          feedback: `${m.wrongRate} comes from dividing the extra cost by all ${m.booked} hours. Only the ${extra} hours after the first ${h0} earn the hourly charge.`,
        },
        ...pool.slice(0, 3).map(([label, feedback]) => ({ label, feedback })),
      ],
      hint: `The booking of ${m.booked} hours has ${m.booked} - ${h0} hours beyond the flat fee. Subtract the flat fee ${F} from the total ${m.total}, then divide by that number of extra hours to find the hourly charge.`,
      explanation: [
        `The booking has $${m.booked}-${h0}=${extra}$ hours beyond the flat fee.`,
        `The extra hours cost $${m.total}-${F}=${m.total - F}$ dollars, so each costs $${m.total - F}\\div${extra}=${rateFound}$ dollars.`,
        `For $h$ hours, $C=${F}+${rateFound}(h-${h0})$${a["rule-form"] === "expanded" ? `, which expands to $C=${rateFound}h${signed(F - rateFound * h0)}$` : ""}.`,
      ],
    });
  },
});

/* -------------------------------------------------------- budget choice */
const budgetAxes = {
  bound: defineAxis("bound", ["at-most", "under"] as const),
};
interface BudgetModel {
  kind: "write-inequality" | "solution-set";
  fee: number;
  rate: number;
  limit: number; // largest whole count at the boundary
  context: number;
}
const budgetContexts = [
  {
    place: "A banquet hall",
    unit: "guests",
    one: "guest",
    fee: "room fee",
    per: "per guest",
  },
  {
    place: "A party tent",
    unit: "hours",
    one: "hour",
    fee: "setup fee",
    per: "per hour",
  },
  {
    place: "A pottery class",
    unit: "visits",
    one: "visit",
    fee: "registration fee",
    per: "per visit",
  },
] as const;
const rates = [2, 4, 5, 8, 10, 20, 25] as const;
function budgetModel(r: (lo: number, hi: number) => number): BudgetModel {
  const model = {
    kind: pick(r, ["write-inequality", "solution-set"] as const),
    fee: 5 * r(4, 30),
    rate: pick(r, rates),
    limit: r(6, 24),
    context: r(0, budgetContexts.length - 1),
  };
  // A fee at least as large as the rate keeps "forget the fee" different from
  // the true limit for whole-number counts.
  if (model.fee < model.rate) throw new Error("Need three retries");
  return model;
}
export const feeBudget = chainFamily({
  template: feeBudgetTemplate,
  axes: budgetAxes,
  model: budgetModel,
  variant: (m) => m.kind,
  render: (m, a, r) => {
    const c = budgetContexts[m.context]!;
    const budget = m.fee + m.rate * m.limit;
    const strict = a.bound === "under";
    const sym = strict ? "\\lt" : "\\le";
    const flip = strict ? "\\gt" : "\\ge";
    const other = strict ? "\\le" : "\\lt";
    const phrase = strict ? "stay under" : "stay at or under";
    const intro = `${c.place} charges a ${c.fee} of ${m.fee} dollars plus ${m.rate} dollars ${c.per}. The total cost must ${phrase} a budget of ${budget} dollars.`;
    if (m.kind === "write-inequality")
      return choiceSurface(r, {
        prompt: `${intro} Which inequality describes the number of ${c.unit}, $x$, that fit the budget?`,
        options: [
          { label: `$${m.fee}+${m.rate}x${sym}${budget}$`, correct: true },
          {
            label: `$${m.rate}x${sym}${budget}$`,
            feedback: `This leaves out the ${c.fee} of ${m.fee} dollars, which is paid in every case.`,
          },
          {
            label: `$${m.fee}+${m.rate}x${flip}${budget}$`,
            feedback: `The cost must not go past the budget, so the cost side is the smaller side. This reverses the inequality.`,
          },
          {
            label: `$${m.rate}+${m.fee}x${sym}${budget}$`,
            feedback: `The ${c.fee} is paid once and the ${m.rate} dollars is paid for each ${c.one}. This swaps them.`,
          },
          {
            label: `$${m.fee}+${m.rate}x${other}${budget}$`,
            feedback: strict
              ? `Under the budget means the total may not equal it, so the symbol is strict.`
              : `At or under the budget allows the total to equal it, so the symbol includes equality.`,
          },
        ],
        hint: `The cost of $x$ ${c.unit} is the ${c.fee} of ${m.fee} plus ${m.rate} for each of the $x$ ${c.unit}. Write that cost as an expression before you compare it with ${budget}.`,
        explanation: [
          `The cost of $x$ ${c.unit} is the ${c.fee} plus ${m.rate} dollars for each: $${m.fee}+${m.rate}x$.`,
          `The cost must ${phrase} ${budget} dollars, so the cost is ${strict ? "less than" : "less than or equal to"} the budget: $${m.fee}+${m.rate}x${sym}${budget}$.`,
        ],
      });
    const boundaryText = decimalText(budget, m.rate);
    const lateText = decimalText(budget + m.fee, m.rate);
    return choiceSurface(r, {
      prompt: `${intro} Which describes every number of ${c.unit}, $x$, that fits the budget?`,
      options: [
        { label: `$x${sym}${m.limit}$`, correct: true },
        {
          label: `$x${flip}${m.limit}$`,
          feedback: `More ${c.unit} cost more, so the allowed numbers are the ones up to the boundary, not beyond it.`,
        },
        {
          label: `$x${sym}${boundaryText}$`,
          feedback: `Dividing ${budget} by ${m.rate} ignores the ${c.fee} of ${m.fee} dollars. Subtract it from the budget first.`,
        },
        {
          label: `$x${sym}${lateText}$`,
          feedback: `The ${c.fee} uses up part of the budget, so subtract it from ${budget}; adding it raises the limit wrongly.`,
        },
        {
          label: `$x${other}${m.limit}$`,
          feedback: strict
            ? `At ${m.limit} ${c.unit} the total equals the budget, which is not under it, so ${m.limit} is not allowed.`
            : `At ${m.limit} ${c.unit} the total equals the budget, which is allowed, so the boundary is included.`,
        },
      ],
      hint: `Take the ${c.fee} of ${m.fee} dollars out of the ${budget}-dollar budget first. What remains is what ${c.unit} can cost at ${m.rate} dollars ${c.per}.`,
      explanation: [
        `Write the cost condition: $${m.fee}+${m.rate}x${sym}${budget}$.`,
        `Subtract ${m.fee} from both sides: $${m.rate}x${sym}${budget - m.fee}$.`,
        `Divide both sides by ${m.rate}. Dividing by a positive number keeps the inequality sign the same way: $x${sym}${m.limit}$.`,
        `So the number of ${c.unit} must satisfy $x${sym}${m.limit}$.`,
      ],
    });
  },
});

export const feeChainTemplates = [
  feePlanTemplate,
  feeRuleTemplate,
  feeBudgetTemplate,
] as const;
export const feeChainGenerate = dispatch(feeChainTemplates, {
  "fee-plan-chain": (seed) => feePlan.generate(seed).problem,
  "fee-rule-choice": (seed) => feeRule.generate(seed).problem,
  "fee-budget-inequality": (seed) => feeBudget.generate(seed).problem,
});
