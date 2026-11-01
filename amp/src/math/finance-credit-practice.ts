import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { assemble, random } from "./distribution-practice";

/**
 * Personal finance: interest, loans, credit cards and savings plans.
 * Every amount is an integer number of cents. Interest is rounded half-up to
 * the cent, and a draw is rejected whenever a rounding step lands exactly on
 * a half cent, so no correct answer depends on a tie-breaking convention.
 */
type Random = ReturnType<typeof random>;
const meta = (
  id: string,
  title: string,
  skillId: string,
  gradeBand: TemplateMetadata["gradeBand"],
  difficultyOffset: number,
  description: string,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand,
  difficultyOffset,
  requiredResponseCapability: "single-choice-v1",
  description,
});

export const interestCompareYearsTemplate = meta(
  "interest-compare-years",
  "Simple and compound interest side by side",
  "exponential-models",
  "9–12",
  0.05,
  "Compare a simple-interest account with a compound-interest account over several years: the gap after $t$ years, which account holds more, a balance table, and the interest earned in one year, in exact cents.",
);
export const loanTotalCostTemplate = meta(
  "loan-total-cost",
  "Total cost of a loan",
  "linear-models",
  "6–8",
  0.05,
  "Total repaid is payment times months. Find the finance charge, compare two terms or two rates, and find a missing payment or term in years.",
);
export const loanCompareOptionsTemplate = meta(
  "loan-compare-options",
  "Compare borrowing options",
  "linear-models",
  "6–8",
  0.2,
  "Choose the cheaper of two loan offers by total paid, including an upfront fee, and separate the lower monthly payment from the lower total cost.",
);
export const creditCardBalanceTemplate = meta(
  "credit-card-balance",
  "Credit card balance over a few months",
  "percent-change",
  "6–8",
  0.25,
  "Compute a credit card's monthly finance charge from its APR, the new balance after a payment, two- and three-month results and the share of a payment that reduces the debt, in exact cents.",
);
export const creditCostConceptsTemplate = meta(
  "credit-cost-concepts",
  "What credit costs",
  "percent-change",
  "6–8",
  0.2,
  "Give the numeric consequence of a credit choice: APR and monthly rate, paying in full versus the minimum, comparing two cards, credit versus debit, and a statement with a late fee.",
);
export const savingsPlanGrowthTemplate = meta(
  "savings-plan-growth",
  "Saving a goal with regular deposits",
  "linear-models",
  "6–8",
  0.0,
  "Use a starting balance and a regular deposit to find a balance, the months to a goal, the deposit needed, when two plans are equal, who leads, or a later balance from a table.",
);
export const interestTableTypeTemplate = meta(
  "interest-table-type",
  "Tell simple from compound interest in a table",
  "percent-change",
  "6–8",
  0.15,
  "Read two year-end balance tables to tell simple interest from compound interest, extend the simple account, and find one year's interest.",
);
export const financeCreditTemplates: readonly TemplateMetadata[] = [
  interestCompareYearsTemplate,
  loanTotalCostTemplate,
  loanCompareOptionsTemplate,
  creditCardBalanceTemplate,
  creditCostConceptsTemplate,
  savingsPlanGrowthTemplate,
  interestTableTypeTemplate,
];

const group = (n: number) => n.toLocaleString("en-US");
const usd = (c: number) => {
  const k = c % 100;
  const body = `${group(Math.floor(c / 100))}${k ? `.${String(k).padStart(2, "0")}` : ""}`;
  return `${body} ${c === 100 ? "dollar" : "dollars"}`;
};
/** A number for a TeX table cell. */
const cell = (c: number, cents: boolean) =>
  `${group(Math.floor(c / 100)).replace(/,/g, "{,}")}${cents || c % 100 ? `.${String(c % 100).padStart(2, "0")}` : ""}`;
const rdiv = (n: number, d: number) => Math.floor((2 * n + d) / (2 * d));
const tie = (n: number, d: number) => (2 * n) % (2 * d) === d;
const pctText = (x: number) => `${parseFloat(x.toFixed(4))}%`;
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
const mw = (list: [number, string][]): [string, string][] =>
  list.filter(([c]) => c >= 0).map(([c, f]) => [usd(c), f]);
const names = ["Maya", "Jordan", "Sam", "Priya", "Luis", "Amara", "Theo"];

type Draft = {
  prompt: string;
  hint: string;
  explanation: string[];
  correct: string;
  wrong: [string, string][];
};
/** Plain meanings of the money words a worked solution uses, defined at
 * first use: one short sentence each, in the order a learner meets them. */
const creditTerms: [RegExp, string][] = [
  [
    /simple interest|\(simple\)/i,
    "Simple interest is the same amount every year, figured on the first deposit only.",
  ],
  [
    /compound/i,
    "Compound interest is figured on the whole balance, so earlier interest earns interest too.",
  ],
  [
    /finance charge|cost of borrowing/i,
    "The finance charge is the cost of borrowing: everything repaid beyond the amount borrowed.",
  ],
  [
    /\bAPR\b|monthly rate/i,
    "The APR, or annual percentage rate, is the yearly interest rate. The monthly rate is the APR divided by 12.",
  ],
  [
    /interest/i,
    "Interest is extra money: a borrower pays it for using money, and a saver earns it.",
  ],
];
/** A worked solution opens with the meanings of its money words and closes
 * by answering the question in a full sentence. */
function teach(d: Draft): string[] {
  const text = d.explanation.join(" ");
  const terms = creditTerms
    .filter(([word, meaning]) => word.test(text) && !d.prompt.includes(meaning))
    .map(([, meaning]) => meaning)
    .slice(0, 2);
  const last = d.explanation[d.explanation.length - 1]!;
  // A choice that names an offer or plan is already stated by the last step.
  const numeric = /^[\d−-]/.test(d.correct);
  return [
    ...(terms.length ? [terms.join(" ")] : []),
    ...d.explanation,
    ...(numeric && !last.includes(d.correct)
      ? [`So the answer is ${d.correct}.`]
      : []),
  ];
}
function finish(
  m: TemplateMetadata,
  seed: string,
  r: Random,
  d: Draft,
): GeneratedProblem {
  const seen = new Set([d.correct]);
  const wrong: { label: string; feedback: string }[] = [];
  for (const [label, feedback] of d.wrong)
    if (!seen.has(label)) {
      seen.add(label);
      wrong.push({ label, feedback });
    }
  if (wrong.length < 3)
    throw new Error(`Insufficient distinct choices for ${m.id}`);
  return assemble(m, seed, r, {
    prompt: d.prompt,
    answer: "",
    hint: d.hint,
    explanation: teach(d),
    choices: [{ label: d.correct, correct: true }, ...wrong.slice(0, 3)],
  });
}
function checkSeed(seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
}
export type FinanceCase = {
  variant: string;
  /** The integer givens, for independent re-derivation. */
  given: Record<string, number>;
  /** The correct numeric result in cents, or months where the variant says so. */
  value: number;
  problem: GeneratedProblem;
};

// ---------------------------------------------------------------- interest
/** Year-end compound balances in cents with interest rounded each year, or null on a half-cent tie. */
export function compoundBalances(
  principalCents: number,
  pct: number,
  years: number,
): number[] | null {
  const out = [principalCents];
  let b = principalCents;
  for (let y = 1; y <= years; y++) {
    if (tie(b * pct, 100)) return null;
    b += rdiv(b * pct, 100);
    out.push(b);
  }
  return out;
}
export const simpleBalance = (principalCents: number, pct: number, y: number) =>
  principalCents + (principalCents / 100) * pct * y;

const PRINCIPALS = [500, 800, 1000, 1200, 1500, 2000, 2500, 3000, 4000, 5000];
/** Year rows, one column per account, so the table fits a 320 px screen. */
const interestTable = (rows: [string, number[]][], cents: boolean) =>
  `$\\begin{array}{c|${"r".repeat(rows.length)}}\\text{Year}&${rows
    .map(([name]) => `\\text{${name}}`)
    .join("&")}\\\\\\hline ${rows[0]![1]
    .map(
      (_, y) =>
        `${y}&${rows.map(([, values]) => cell(values[y]!, cents)).join("&")}`,
    )
    .join("\\\\")}\\end{array}$`;

export function interestCompareYearsCase(seed: string): FinanceCase {
  checkSeed(seed);
  const m = interestCompareYearsTemplate;
  const r = random(m.id, seed);
  const variant = r(0, 3);
  for (let guard = 0; guard < 500; guard++) {
    const P = pick(r, PRINCIPALS);
    const Pc = P * 100;
    const pct = r(2, 8);
    if (variant === 0) {
      const t = r(2, 6);
      const C = compoundBalances(Pc, pct, t);
      if (!C) continue;
      const S = (y: number) => simpleBalance(Pc, pct, y);
      const diff = C[t]! - S(t);
      const prior = C[t - 1]! - S(t - 1);
      return {
        variant: "gap",
        given: { P, pct, t },
        value: diff,
        problem: finish(m, seed, r, {
          prompt: `Two accounts each start with ${usd(Pc)} and earn ${pct}% interest a year. Account S pays simple interest on the original deposit only. Account C pays compound interest: each year's interest is added to the balance at the end of the year, rounded to the nearest cent, and earns interest the next year. Nothing else is added or withdrawn. After ${t} years, how much more does Account C hold than Account S?`,
          hint: `Account S earns ${usd((Pc * pct) / 100)} every year, the same amount. Find Account C's balance one year at a time, using ${pct}% of the balance at the start of that year, then subtract Account S's balance.`,
          explanation: [
            `Account S earns ${pct}% of ${usd(Pc)} = ${usd((Pc / 100) * pct)} each year, so after ${t} years it holds ${usd(Pc)} + ${t} × ${usd((Pc / 100) * pct)} = ${usd(S(t))}.`,
            `Account C's year-end balances are ${C.slice(1)
              .map(usd)
              .join(
                ", ",
              )}, each found by adding ${pct}% of the previous balance, rounded to the cent.`,
            `The gap is ${usd(C[t]!)} − ${usd(S(t))} = ${usd(diff)}.`,
          ],
          correct: usd(diff),
          wrong: mw([
            [
              C[t]!,
              "That is Account C's whole balance. The question asks for the difference between the two balances.",
            ],
            [
              C[t]! - Pc,
              "That is the interest Account C earned. Subtract the interest Account S earned too.",
            ],
            [
              S(t) - Pc,
              "That is the interest Account S earned. Compare the two balances instead.",
            ],
            [
              prior,
              `That is the gap after ${t - 1} year${t - 1 === 1 ? "" : "s"}. Use all ${t} years.`,
            ],
            [
              C[t]! - S(t - 1),
              `Account S has had ${t} years of interest, not ${t - 1}.`,
            ],
          ]),
        }),
      };
    }
    if (variant === 1) {
      const pctB = r(2, 7);
      const pctA = pctB + pick(r, [-1, 1, 2]);
      const t = r(2, 8);
      const C = compoundBalances(Pc, pctB, t);
      if (!C) continue;
      const A = simpleBalance(Pc, pctA, t);
      if (A === C[t]!) continue;
      const simpleName = r(0, 1) ? "B" : "A";
      const compName = simpleName === "A" ? "B" : "A";
      const [rateS, rateC] = [pctA, pctB];
      const aWins = A > C[t]!;
      const winner = aWins ? simpleName : compName;
      const loser = aWins ? compName : simpleName;
      const diff = Math.abs(A - C[t]!);
      const Cp = compoundBalances(Pc, pctB, t - 1)!;
      const alt = Math.abs(simpleBalance(Pc, pctA, t - 1) - Cp[t - 1]!);
      const lab = (n: string, c: number) => `Account ${n} holds ${usd(c)} more`;
      const cand: [string, string][] = [
        [
          lab(loser, diff),
          "Check which final balance is larger. The other account holds more.",
        ],
        [
          lab(winner, alt),
          `The amount is the gap after ${t - 1} year${t - 1 === 1 ? "" : "s"}. Use the balances after all ${t} years.`,
        ],
        [
          lab(loser, alt),
          "Compare the final balances for the winner, then use all the years for the gap.",
        ],
        [
          lab(winner, C[t]! - Pc),
          "That is the compound account's interest, not the difference between the balances.",
        ],
        [
          lab(loser, A - Pc),
          "That is the simple account's interest, not the difference between the balances.",
        ],
      ];
      return {
        variant: "which-larger",
        given: { P, rateS, rateC, t, simpleIsA: simpleName === "A" ? 1 : 0 },
        value: diff,
        problem: finish(m, seed, r, {
          prompt: `Account ${simpleName} starts with ${usd(Pc)} and pays ${rateS}% simple interest a year. Account ${compName} also starts with ${usd(Pc)} and pays ${rateC}% interest a year, compounded: each year's interest, rounded to the nearest cent, is added to the balance. With no deposits or withdrawals, which account holds more after ${t} years, and by how much?`,
          hint: `Account ${simpleName} adds ${usd((Pc / 100) * rateS)} every year. Build Account ${compName}'s balance year by year at ${rateC}% of the balance at the start of each year, then compare the two balances after ${t} years.`,
          explanation: [
            `Account ${simpleName} earns ${usd((Pc / 100) * rateS)} each year, so it holds ${usd(Pc)} + ${t} × ${usd((Pc / 100) * rateS)} = ${usd(A)}.`,
            `Account ${compName} compounds at ${rateC}%. Its year-end balances are ${C.slice(1).map(usd).join(", ")}, so it holds ${usd(C[t]!)}.`,
            `Account ${winner} holds more. The gap is ${usd(Math.max(A, C[t]!))} − ${usd(Math.min(A, C[t]!))} = ${usd(diff)}.`,
          ],
          correct: lab(winner, diff),
          wrong: cand,
        }),
      };
    }
    if (variant === 2) {
      const t = 4;
      const C = compoundBalances(Pc, pct, t);
      if (!C) continue;
      const S = Array.from({ length: t + 1 }, (_, y) =>
        simpleBalance(Pc, pct, y),
      );
      const compIsA = r(0, 1) === 0;
      const compName = compIsA ? "A" : "B";
      const other = compIsA ? "B" : "A";
      const rows: [string, number[]][] = compIsA
        ? [
            ["Account A", C],
            ["Account B", S],
          ]
        : [
            ["Account A", S],
            ["Account B", C],
          ];
      const cents = true;
      const diff = C[t]! - S[t]!;
      const diff3 = C[3]! - S[3]!;
      const lab = (n: string, c: number) =>
        `Account ${n} earns compound interest; after ${t} years it holds ${usd(c)} more than the other account.`;
      return {
        variant: "table",
        given: { P, pct, t, compoundIsA: compIsA ? 1 : 0 },
        value: diff,
        problem: finish(m, seed, r, {
          prompt: `Both accounts started with ${usd(Pc)} and earn the same yearly rate; nothing is added or withdrawn. One account pays simple interest and one pays compound interest. The table shows year-end balances in dollars. Which statement is true?\n${interestTable(rows, cents)}`,
          hint: `Look at how much each account grows from one year to the next. The account that earns simple interest grows by the same amount every year; find the other account's increases, then compare the year ${t} balances.`,
          explanation: [
            `Account ${other} grows by ${usd((Pc / 100) * pct)} every year, so it earns simple interest.`,
            `Account ${compName} grows by a larger amount each year: ${C.slice(
              1,
            )
              .map((v, i) => usd(v - C[i]!))
              .join(", ")}. It earns compound interest.`,
            `After ${t} years the balances are ${usd(C[t]!)} and ${usd(S[t]!)}, a gap of ${usd(diff)}.`,
          ],
          correct: lab(compName, diff),
          wrong: [
            [
              lab(other, diff),
              `Account ${other} grows by the same amount every year, which is simple interest, not compound.`,
            ],
            [
              lab(compName, diff3),
              `That is the gap after 3 years. Read the year ${t} balances.`,
            ],
            [
              lab(other, diff3),
              "Account " +
                other +
                " grows by the same amount each year, so it is the simple account, and that gap is for year 3.",
            ],
            [
              lab(compName, C[t]! - Pc),
              "That is the compound account's interest, not the difference between the balances.",
            ],
          ],
        }),
      };
    }
    const C = compoundBalances(Pc, pct, 2);
    if (!C) continue;
    const int1 = C[1]! - Pc;
    const int2 = C[2]! - C[1]!;
    const diff = int2 - int1;
    return {
      variant: "year-two",
      given: { P, pct },
      value: diff,
      problem: finish(m, seed, r, {
        prompt: `Account S pays ${pct}% simple interest and Account C pays ${pct}% interest compounded yearly with each year's interest rounded to the nearest cent. Each starts with ${usd(Pc)} and nothing else is added or withdrawn. During year 2, how much more interest does Account C earn than Account S?`,
        hint: `Account S earns the same interest every year, ${pct}% of ${usd(Pc)}. In year 2 Account C earns ${pct}% of its balance at the end of year 1, which includes year 1's interest.`,
        explanation: [
          `Each account earns ${pct}% of ${usd(Pc)} = ${usd(int1)} in year 1. Account S earns ${usd(int1)} in year 2 as well.`,
          `Account C starts year 2 with ${usd(C[1]!)}, so it earns ${pct}% of that, ${usd(int2)}, rounded to the cent.`,
          `The difference is ${usd(int2)} − ${usd(int1)} = ${usd(diff)}, the interest earned on year 1's interest.`,
        ],
        correct: usd(diff),
        wrong: mw([
          [
            int2,
            "That is all of Account C's year-2 interest. Subtract what Account S earns in year 2.",
          ],
          [
            int1,
            "That is one year of interest for either account. Compare year 2 for both.",
          ],
          [C[2]!, "That is Account C's balance, not a difference in interest."],
          [
            int1 * 2,
            "That is two years of simple interest. The question compares only year 2.",
          ],
          [C[2]! - Pc, "That is Account C's interest over both years."],
        ]),
      }),
    };
  }
  throw new Error("No tie-free interest instance");
}

// ------------------------------------------------------------------- loans
/** Nearest whole-dollar monthly payment on an amortized loan; only used to make stated payments realistic. */
const payment = (P: number, apr: number, n: number) => {
  const i = apr / 1200;
  return Math.round((P * i) / (1 - (1 + i) ** -n));
};
const TERMS = [12, 18, 24, 36, 48, 60, 72];
const loanThing = [
  "buy a used car",
  "pay for a roof repair",
  "buy a laptop and software",
  "buy furniture for a new apartment",
  "pay a tuition bill",
];
function oneLoan(r: Random) {
  const P = r(2, 60) * 500;
  const n = pick(r, TERMS);
  const apr = r(3, 14);
  return { P, n, apr, p: payment(P, apr, n) };
}

export function loanTotalCostCase(seed: string): FinanceCase {
  checkSeed(seed);
  const m = loanTotalCostTemplate;
  const r = random(m.id, seed);
  const who = pick(r, names);
  const thing = pick(r, loanThing);
  const variant = r(0, 5);
  const L = oneLoan(r);
  const c = (d: number) => d * 100;
  if (variant === 0) {
    const total = L.p * L.n;
    return {
      variant: "total-repaid",
      given: { P: L.P, n: L.n, p: L.p },
      value: c(total),
      problem: finish(m, seed, r, {
        prompt: `${who} borrows ${usd(c(L.P))} to ${thing}. The loan is repaid with ${L.n} equal monthly payments of ${usd(c(L.p))}. How much does ${who} pay back in all?`,
        hint: `Each of the ${L.n} months, ${who} pays ${usd(c(L.p))}. Total paid is the payment times the number of payments.`,
        explanation: [
          `${L.n} payments of ${usd(c(L.p))} total ${L.n} × ${L.p} = ${group(total)} dollars.`,
          `That is more than the ${usd(c(L.P))} borrowed; the extra, ${usd(c(total - L.P))}, is the cost of borrowing.`,
          `Check: ${group(total)} ÷ ${L.n} = ${L.p}, the monthly payment.`,
        ],
        correct: usd(c(total)),
        wrong: mw([
          [
            c(total - L.P),
            "That is the finance charge, the part paid beyond the amount borrowed. The question asks for everything paid back.",
          ],
          [c(L.p * (L.n - 1)), `There are ${L.n} payments, not ${L.n - 1}.`],
          [
            c(L.P + L.p),
            "Multiply the payment by the number of months; do not add one payment to the loan amount.",
          ],
          [
            c(total + L.P),
            "The amount borrowed is already counted inside the payments. Do not add it again.",
          ],
        ]),
      }),
    };
  }
  if (variant === 1) {
    const total = L.p * L.n;
    const F = total - L.P;
    return {
      variant: "finance-charge",
      given: { P: L.P, n: L.n, p: L.p },
      value: c(F),
      problem: finish(m, seed, r, {
        prompt: `${who} borrows ${usd(c(L.P))} to ${thing} and repays it with ${L.n} monthly payments of ${usd(c(L.p))}. The finance charge is the total repaid minus the amount borrowed. What is the finance charge?`,
        hint: `First find everything ${who} pays: ${L.n} payments of ${usd(c(L.p))}. Then take away the ${usd(c(L.P))} that was borrowed.`,
        explanation: [
          `Total repaid: ${L.n} × ${L.p} = ${group(total)} dollars.`,
          `Finance charge: ${group(total)} − ${group(L.P)} = ${group(F)} dollars.`,
          `Check: ${group(L.P)} + ${group(F)} = ${group(total)}, the total repaid.`,
        ],
        correct: usd(c(F)),
        wrong: mw([
          [
            c(total),
            "That is the total repaid. Subtract the amount borrowed to get the finance charge.",
          ],
          [
            c(total + L.P),
            "Subtract the amount borrowed from the total repaid; do not add it.",
          ],
          [
            c(L.p * (L.n - 1) - L.P),
            `There are ${L.n} payments, not ${L.n - 1}.`,
          ],
          [
            c(L.P - L.p),
            "Multiply the payment by all the months before comparing with the loan amount.",
          ],
        ]),
      }),
    };
  }
  if (variant === 2) {
    let n1: number, n2: number, p1: number, p2: number;
    do {
      n1 = pick(r, [12, 24, 36, 48]);
      n2 = n1 + pick(r, [12, 24]);
      p1 = payment(L.P, L.apr, n1);
      p2 = payment(L.P, L.apr, n2);
    } while (p2 * n2 <= p1 * n1 || p1 === p2);
    const diff = p2 * n2 - p1 * n1;
    return {
      variant: "term-effect",
      given: { P: L.P, n1, p1, n2, p2 },
      value: c(diff),
      problem: finish(m, seed, r, {
        prompt: `${who} can borrow ${usd(c(L.P))} to ${thing} at the same interest rate for two different terms. Over ${n1} months the payment is ${usd(c(p1))}. Over ${n2} months the payment is ${usd(c(p2))}. How much more is the total finance charge for the longer loan?`,
        hint: `For each loan, multiply the payment by its number of months. Both loans borrow ${usd(c(L.P))}, so the difference in finance charges equals the difference in totals repaid.`,
        explanation: [
          `${n1}-month loan: ${n1} × ${p1} = ${group(p1 * n1)} dollars repaid.`,
          `${n2}-month loan: ${n2} × ${p2} = ${group(p2 * n2)} dollars repaid.`,
          `Both borrow ${group(L.P)} dollars, so the longer loan's extra finance charge is ${group(p2 * n2)} − ${group(p1 * n1)} = ${group(diff)} dollars.`,
        ],
        correct: usd(c(diff)),
        wrong: mw([
          [
            c(p1 - p2),
            "That is how much less the longer loan costs each month. Compare the totals over the whole terms.",
          ],
          [
            c(p2 * n2 - L.P),
            "That is the longer loan's whole finance charge. Subtract the shorter loan's finance charge.",
          ],
          [
            c(p1 * n1 - L.P),
            "That is the shorter loan's finance charge, not the difference.",
          ],
          [
            c((n2 - n1) * p2),
            "The extra months are only part of the difference; the shorter loan's payments are larger.",
          ],
        ]),
      }),
    };
  }
  if (variant === 3) {
    let a1: number, a2: number, p1: number, p2: number;
    do {
      a1 = r(3, 8);
      a2 = a1 + r(2, 6);
      p1 = payment(L.P, a1, L.n);
      p2 = payment(L.P, a2, L.n);
    } while (p2 <= p1);
    const diff = (p2 - p1) * L.n;
    return {
      variant: "rate-effect",
      given: { P: L.P, n: L.n, p1, p2 },
      value: c(diff),
      problem: finish(m, seed, r, {
        prompt: `${who} borrows ${usd(c(L.P))} for ${L.n} months. At ${a1}% interest the monthly payment is ${usd(c(p1))}. At ${a2}% interest it is ${usd(c(p2))}. How much more does ${who} repay in total with the ${a2}% loan?`,
        hint: `The loans last the same ${L.n} months. The monthly payments differ by ${usd(c(p2 - p1))}; think about how many times that difference is paid.`,
        explanation: [
          `${a1}% loan: ${L.n} × ${p1} = ${group(L.n * p1)} dollars.`,
          `${a2}% loan: ${L.n} × ${p2} = ${group(L.n * p2)} dollars.`,
          `The ${a2}% loan costs ${group(L.n * p2)} − ${group(L.n * p1)} = ${group(diff)} dollars more.`,
        ],
        correct: usd(c(diff)),
        wrong: mw([
          [
            c(p2 - p1),
            "That is the difference in one monthly payment. Multiply by the number of payments.",
          ],
          [
            c(p2 * L.n - L.P),
            `That is the ${a2}% loan's finance charge, not the difference between the loans.`,
          ],
          [
            c(p2 * L.n),
            `That is the total repaid for the ${a2}% loan. Subtract the total for the ${a1}% loan.`,
          ],
          [
            c((p2 - p1) * Math.floor(L.n / 12)),
            "Payments are monthly. Count the months, not the years.",
          ],
        ]),
      }),
    };
  }
  if (variant === 4) {
    const F = L.p * L.n - L.P;
    return {
      variant: "unknown-payment",
      given: { P: L.P, n: L.n, F },
      value: c(L.p),
      problem: finish(m, seed, r, {
        prompt: `${who} borrows ${usd(c(L.P))} to ${thing} and repays it in ${L.n} equal monthly payments. The finance charge is ${usd(c(F))}. How much is each monthly payment?`,
        hint: `Total repaid is the amount borrowed plus the ${usd(c(F))} finance charge. Equal payments split that total across ${L.n} months.`,
        explanation: [
          `Total repaid = borrowed + finance charge = ${group(L.P)} + ${group(F)} = ${group(L.P + F)} dollars.`,
          `Monthly payment = ${group(L.P + F)} ÷ ${L.n} = ${group(L.p)} dollars.`,
          `Check: ${L.n} × ${L.p} = ${group(L.p * L.n)}.`,
        ],
        correct: usd(c(L.p)),
        wrong: mw([
          [
            c(Math.round(L.P / L.n)),
            "That spreads only the amount borrowed over the months. Add the finance charge first.",
          ],
          [
            c(Math.round(F / L.n)),
            "That spreads only the finance charge. Add the amount borrowed first.",
          ],
          [
            c(Math.round((L.P - F) / L.n)),
            "The finance charge is added to the amount borrowed, not subtracted.",
          ],
          [
            c(L.P + F),
            "That is the total repaid. Divide it by the number of months.",
          ],
          [
            c(Math.round((L.P + F) / (L.n + 1))),
            `There are ${L.n} equal payments.`,
          ],
        ]),
      }),
    };
  }
  const years = r(2, 6);
  const months = years * 12;
  const p = payment(L.P, L.apr, months);
  const total = p * months;
  return {
    variant: "years-term",
    given: { P: L.P, years, p },
    value: c(total),
    problem: finish(m, seed, r, {
      prompt: `${who} borrows ${usd(c(L.P))} to ${thing} for ${years} years and pays ${usd(c(p))} each month. How much does ${who} repay in total?`,
      hint: `The payments are monthly but the loan length is given in years. Find the number of monthly payments in ${years} years first.`,
      explanation: [
        `${years} years × 12 months = ${months} payments.`,
        `Total repaid = ${months} × ${p} = ${group(total)} dollars.`,
        `Check: ${years} years of ${p * 12} dollars a year is ${group(total)} dollars.`,
      ],
      correct: usd(c(total)),
      wrong: mw([
        [
          c(p * years),
          "That counts one payment per year. Payments are monthly.",
        ],
        [
          c(p * 12),
          "That is one year of payments. The loan lasts several years.",
        ],
        [
          c(total - L.P),
          "That is the finance charge. The question asks for the total repaid.",
        ],
        [
          c(p * (months + 12)),
          `A ${years}-year loan has ${months} monthly payments.`,
        ],
      ]),
    }),
  };
}

export function loanCompareOptionsCase(seed: string): FinanceCase {
  checkSeed(seed);
  const m = loanCompareOptionsTemplate;
  const r = random(m.id, seed);
  const who = pick(r, names);
  const variant = r(0, 2);
  const P = r(6, 40) * 500;
  const c = (d: number) => d * 100;
  for (let guard = 0; guard < 500; guard++) {
    const n1 = pick(r, [24, 36, 48, 60]);
    const n2 = pick(r, [24, 36, 48, 60, 72]);
    const a1 = r(3, 9);
    const a2 = r(3, 9);
    const p1 = payment(P, a1, n1);
    const p2 = payment(P, a2, n2);
    const T1 = p1 * n1;
    if (variant === 0) {
      const T2 = p2 * n2;
      if (Math.abs(T1 - T2) < 60 || p1 === p2 || n1 === n2) continue;
      const w = T1 < T2 ? 1 : 2;
      const l = w === 1 ? 2 : 1;
      const diff = Math.abs(T1 - T2);
      const alt = Math.abs(p1 - p2);
      const alt2 = alt * Math.min(n1, n2);
      const lab = (o: number, x: number) =>
        `Offer ${o} costs ${usd(c(x))} less in total`;
      return {
        variant: "cheaper-total",
        given: { P, n1, p1, n2, p2 },
        value: c(diff),
        problem: finish(m, seed, r, {
          prompt: `${who} needs ${usd(c(P))}. Offer 1 is ${a1}% interest with ${n1} monthly payments of ${usd(c(p1))}. Offer 2 is ${a2}% interest with ${n2} monthly payments of ${usd(c(p2))}. Which offer costs less in total, and by how much?`,
          hint: `For each offer, multiply the monthly payment by the number of months to get the total paid. Both offers lend ${usd(c(P))}, so the lower total is the cheaper offer.`,
          explanation: [
            `Offer 1 total: ${n1} × ${p1} = ${group(T1)} dollars. Offer 2 total: ${n2} × ${p2} = ${group(T2)} dollars.`,
            `Offer ${w} is cheaper by ${group(Math.max(T1, T2))} − ${group(Math.min(T1, T2))} = ${group(diff)} dollars. The interest rate alone does not decide it: the number of months matters too.`,
          ],
          correct: lab(w, diff),
          wrong: [
            [
              lab(l, diff),
              `Offer ${l} has the larger total. Compare payment × months for each offer.`,
            ],
            [
              lab(w, alt),
              "That is the difference between monthly payments, not between totals.",
            ],
            [
              lab(l, alt),
              "Compare totals, not monthly payments or rates alone.",
            ],
            [
              lab(w, alt2),
              "That multiplies the payment gap by only the shorter term. Compute each total first.",
            ],
            [
              lab(l, alt2),
              "Compare each offer's total (payment × months) to choose, then subtract.",
            ],
          ],
        }),
      };
    }
    if (variant === 1) {
      const fee = r(2, 12) * 50;
      const T2 = fee + p2 * n2;
      const diff = Math.abs(T1 - T2);
      const noFee = Math.abs(T1 - p2 * n2);
      if (diff < 50 || n1 === n2) continue;
      const flips = p2 * n2 < T1 !== T2 < T1;
      if (r(0, 2) > 0 && !flips) continue;
      const w = T1 < T2 ? 1 : 2;
      const l = w === 1 ? 2 : 1;
      const lab = (o: number, x: number) =>
        `Offer ${o} costs ${usd(c(x))} less overall`;
      return {
        variant: "fee",
        given: { P, n1, p1, n2, p2, fee },
        value: c(diff),
        problem: finish(m, seed, r, {
          prompt: `${who} needs ${usd(c(P))}. Offer 1 has no fee: ${n1} monthly payments of ${usd(c(p1))}. Offer 2 has a ${usd(c(fee))} fee paid at the start, then ${n2} monthly payments of ${usd(c(p2))}. Counting the fee, which offer costs less overall, and by how much?`,
          hint: `Offer 2's cost is its fee plus ${n2} payments of ${usd(c(p2))}. Offer 1's cost is only its payments. Compare the two totals.`,
          explanation: [
            `Offer 1: ${n1} × ${p1} = ${group(T1)} dollars.`,
            `Offer 2: ${fee} + ${n2} × ${p2} = ${fee} + ${group(p2 * n2)} = ${group(T2)} dollars.`,
            `Offer ${w} is cheaper by ${group(diff)} dollars.`,
          ],
          correct: lab(w, diff),
          wrong: [
            [
              lab(l, diff),
              `Offer ${l} has the larger total once the fee is counted.`,
            ],
            [
              lab(w, noFee),
              "That leaves out the fee. Add it to the payments before comparing.",
            ],
            [
              lab(l, noFee),
              "That leaves out the fee, and the cheaper offer changes once it is counted.",
            ],
            [
              lab(w, diff + fee),
              "The fee is counted once in Offer 2's total; do not add it to the difference again.",
            ],
            [
              lab(l, Math.abs(p1 - p2)),
              "Compare whole-loan totals, not single monthly payments.",
            ],
          ],
        }),
      };
    }
    const T2 = p2 * n2;
    if (p1 === p2 || T1 === T2) continue;
    const lowPay = p1 < p2 ? 1 : 2;
    const lowTot = T1 < T2 ? 1 : 2;
    const stm = (a: number, b: number) =>
      a === b
        ? `Offer ${a} has both the lower monthly payment and the lower total cost.`
        : `Offer ${a} has the lower monthly payment, and Offer ${b} has the lower total cost.`;
    const feedback = (a: number, b: number) => {
      if (a !== lowPay && b !== lowTot)
        return `Offer ${lowPay} has the lower payment (${usd(c(Math.min(p1, p2)))}) and Offer ${lowTot} has the lower total. Check both.`;
      if (a !== lowPay)
        return `Compare the monthly payments directly: ${usd(c(p1))} for Offer 1 and ${usd(c(p2))} for Offer 2.`;
      return `Multiply each payment by its months: ${group(T1)} dollars for Offer 1 and ${group(T2)} dollars for Offer 2. The lower payment does not always mean the lower total.`;
    };
    const combos: [number, number][] = [
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
    ];
    return {
      variant: "payment-vs-total",
      given: { P, n1, p1, n2, p2 },
      value: lowPay * 10 + lowTot,
      problem: finish(m, seed, r, {
        prompt: `${who} compares two loans of ${usd(c(P))}. Offer 1 is ${n1} monthly payments of ${usd(c(p1))}. Offer 2 is ${n2} monthly payments of ${usd(c(p2))}. Which statement is true?`,
        hint: `Check the monthly payments first: ${usd(c(p1))} and ${usd(c(p2))}. Then multiply each payment by its number of months to get each total.`,
        explanation: [
          `Monthly payment: Offer ${lowPay} is lower (${usd(c(Math.min(p1, p2)))}).`,
          `Totals: Offer 1's payments add up to ${n1} × ${p1} = ${group(T1)} dollars. Offer 2's add up to ${n2} × ${p2} = ${group(T2)} dollars.`,
          `So Offer ${lowTot} costs less in total.`,
          `${stm(lowPay, lowTot)}`,
        ],
        correct: stm(lowPay, lowTot),
        wrong: combos
          .filter(([a, b]) => !(a === lowPay && b === lowTot))
          .map(([a, b]) => [stm(a, b), feedback(a, b)] as [string, string]),
      }),
    };
  }
  throw new Error("No loan comparison instance");
}

// ------------------------------------------------------------ credit cards
/** Monthly rate in basis points for an APR that is a multiple of 3: APR ÷ 12. */
const monthlyBp = (apr: number) => (apr / 3) * 25;
const APRS = [12, 15, 18, 21, 24, 27];
const charge = (balanceCents: number, bp: number) =>
  rdiv(balanceCents * bp, 10000);
const chargeTie = (balanceCents: number, bp: number) =>
  tie(balanceCents * bp, 10000);

export function creditCardBalanceCase(seed: string): FinanceCase {
  checkSeed(seed);
  const m = creditCardBalanceTemplate;
  const r = random(m.id, seed);
  const variant = r(0, 5);
  const who = pick(r, names);
  for (let guard = 0; guard < 500; guard++) {
    const B = r(600, 4500) * 100 + r(0, 99);
    const apr = pick(r, APRS);
    const bp = monthlyBp(apr);
    const mr = pctText(apr / 12);
    const i1 = charge(B, bp);
    if (chargeTie(B, bp)) continue;
    const intro = `${who}'s credit card has an APR of ${apr}%, so its monthly rate is ${apr}% ÷ 12 = ${mr}. Each month's interest is the monthly rate times the balance at the start of that month, rounded to the nearest cent, and it is added before ${who} pays.`;
    const lo = Math.ceil(i1 / 100) + 10;
    const p = lo + r(0, 60);
    if (p * 100 > B / 2) continue;
    const B1 = B + i1 - p * 100;
    if (variant === 0) {
      const annual = rdiv(B * apr, 100);
      return {
        variant: "first-charge",
        given: { B, apr },
        value: i1,
        problem: finish(m, seed, r, {
          prompt: `${intro} The balance at the start of this month is ${usd(B)}. What is this month's interest, the finance charge?`,
          hint: `The monthly rate is ${mr}, which is ${apr / 12}/100 as a decimal. Multiply it by the starting balance of ${usd(B)}, then round to the nearest cent.`,
          explanation: [
            `Monthly rate: ${apr}% ÷ 12 = ${mr} = ${parseFloat((apr / 1200).toFixed(6))}.`,
            `Interest: ${group(B)} cents × ${parseFloat((apr / 1200).toFixed(6))} = ${parseFloat(((B * apr) / 1200).toFixed(4))} cents, which rounds to ${i1} cents.`,
            `The finance charge is ${usd(i1)}.`,
          ],
          correct: usd(i1),
          wrong: mw([
            [
              annual,
              `That uses the yearly rate ${apr}% for one month. Divide the APR by 12 first.`,
            ],
            [
              i1 * 2,
              "That is two months of interest. The question asks for one month.",
            ],
            [
              i1 * 10,
              "Check the decimal point when converting the percent to a decimal.",
            ],
            [rdiv(i1, 2), `Use the full monthly rate ${mr}.`],
            [
              rdiv(B, 100),
              `One percent of the balance is not the monthly rate here; the rate is ${mr}.`,
            ],
          ]),
        }),
      };
    }
    if (variant === 1) {
      return {
        variant: "new-balance",
        given: { B, apr, p },
        value: B1,
        problem: finish(m, seed, r, {
          prompt: `${intro} The balance at the start of the month is ${usd(B)}. There are no new purchases, and ${who} makes one payment of ${usd(p * 100)}. What is the balance at the end of the month?`,
          hint: `Interest is ${mr} of the starting balance ${usd(B)}. Add that interest to the balance, then subtract the ${usd(p * 100)} payment.`,
          explanation: [
            `Interest: ${mr} of ${usd(B)} = ${usd(i1)}.`,
            `Balance with interest: ${usd(B)} + ${usd(i1)} = ${usd(B + i1)}.`,
            `After the payment: ${usd(B + i1)} − ${usd(p * 100)} = ${usd(B1)}.`,
          ],
          correct: usd(B1),
          wrong: mw([
            [
              B - p * 100,
              "That leaves out the interest. Interest is added to the balance.",
            ],
            [B + i1, "That leaves out the payment."],
            [
              B - p * 100 - i1,
              "Interest increases what is owed; add it, do not subtract it.",
            ],
            [
              B - p * 100 + charge(B - p * 100, bp),
              "Interest is charged on the balance at the start of the month, before the payment.",
            ],
          ]),
        }),
      };
    }
    const i2 = charge(B1, bp);
    if (chargeTie(B1, bp)) continue;
    const B2 = B1 + i2 - p * 100;
    if (variant === 2) {
      return {
        variant: "two-months",
        given: { B, apr, p },
        value: B2,
        problem: finish(m, seed, r, {
          prompt: `${intro} The balance at the start of month 1 is ${usd(B)}. ${who} makes no purchases and pays ${usd(p * 100)} at the end of each of two months. What is the balance after the second payment?`,
          hint: `Do month 1 first: interest on ${usd(B)}, add it, subtract the ${usd(p * 100)} payment. Month 2 starts with that new balance, so its interest is different.`,
          explanation: [
            `Month 1: interest ${usd(i1)}; balance ${usd(B)} + ${usd(i1)} − ${usd(p * 100)} = ${usd(B1)}.`,
            `Month 2: interest is ${mr} of ${usd(B1)} = ${usd(i2)}.`,
            `Balance after the second payment: ${usd(B1)} + ${usd(i2)} − ${usd(p * 100)} = ${usd(B2)}.`,
          ],
          correct: usd(B2),
          wrong: mw([
            [
              B + 2 * i1 - 2 * p * 100,
              "Month 2's interest uses month 2's starting balance, which is smaller than the original balance.",
            ],
            [B - 2 * p * 100, "That leaves out both months' interest."],
            [B1, "That is the balance after only one month."],
            [B + 2 * i1, "That leaves out the payments."],
            [B1 + i2, "That is the balance before the second payment."],
          ]),
        }),
      };
    }
    if (variant === 3) {
      return {
        variant: "payment-split",
        given: { B, apr, p },
        value: p * 100 - i1,
        problem: finish(m, seed, r, {
          prompt: `${intro} The balance at the start of the month is ${usd(B)}, and ${who} pays ${usd(p * 100)}. The part of a payment that is not interest reduces the debt. How much of this payment reduces the debt?`,
          hint: `Find this month's interest on ${usd(B)} at ${mr}. The payment first covers the interest; what is left over lowers the debt.`,
          explanation: [
            `Interest this month: ${mr} of ${usd(B)} = ${usd(i1)}.`,
            `Payment minus interest: ${usd(p * 100)} − ${usd(i1)} = ${usd(p * 100 - i1)}.`,
            `Check: the balance falls from ${usd(B)} to ${usd(B1)}, a drop of ${usd(B - B1)}.`,
          ],
          correct: usd(p * 100 - i1),
          wrong: mw([
            [
              p * 100,
              "Some of the payment goes to interest, so less than the whole payment reduces the debt.",
            ],
            [
              i1,
              "That is the interest. The rest of the payment reduces the debt.",
            ],
            [
              p * 100 + i1,
              "Interest takes from the payment; it does not add to it.",
            ],
            [
              B1,
              "That is the balance at the end of the month, not the amount of debt removed.",
            ],
          ]),
        }),
      };
    }
    if (variant === 4) {
      const i3 = charge(B2, bp);
      if (chargeTie(B2, bp)) continue;
      const total = i1 + i2 + i3;
      return {
        variant: "total-interest-3",
        given: { B, apr, p },
        value: total,
        problem: finish(m, seed, r, {
          prompt: `${intro} The balance at the start of month 1 is ${usd(B)}. ${who} makes no purchases and pays ${usd(p * 100)} at the end of each month for three months. How much interest is charged in all three months?`,
          hint: `Each month's interest uses that month's starting balance. After month 1 the balance is ${usd(B)} plus interest minus ${usd(p * 100)}; use that for month 2, and so on.`,
          explanation: [
            `Month 1: ${usd(i1)} interest; end balance ${usd(B1)}.`,
            `Month 2: ${usd(i2)} interest; end balance ${usd(B2)}.`,
            `Month 3: ${usd(i3)} interest on ${usd(B2)}.`,
            `Total interest: ${usd(i1)} + ${usd(i2)} + ${usd(i3)} = ${usd(total)}.`,
          ],
          correct: usd(total),
          wrong: mw([
            [
              3 * i1,
              "The balance falls each month, so later months charge less interest than month 1.",
            ],
            [i1 + i2, "That is only two months of interest."],
            [i3, "That is only month 3's interest."],
            [B2, "That is the balance after two months, not the interest."],
            [
              i1 + i2 + i3 + i1,
              "Count the interest for three months once each.",
            ],
          ]),
        }),
      };
    }
    const q = p + r(10, 80);
    const mn = p;
    if (q * 100 > B / 2 || q - mn === mn) continue;
    const extra = rdiv((q - mn) * 100 * bp, 10000);
    return {
      variant: "pay-more",
      given: { B, apr, minimum: mn, larger: q },
      value: (q - mn) * 100,
      problem: finish(m, seed, r, {
        prompt: `${intro} The balance at the start of the month is ${usd(B)}. If ${who} pays the ${usd(mn * 100)} minimum, the balance at the end of the month is ${usd(B + i1 - mn * 100)}. How much lower is the end-of-month balance if ${who} pays ${usd(q * 100)} instead?`,
        hint: `Interest is charged on the starting balance ${usd(B)} before any payment, so it is the same under both payments. Compare what is subtracted in each case.`,
        explanation: [
          `With the minimum: ${usd(B)} + ${usd(i1)} − ${usd(mn * 100)} = ${usd(B + i1 - mn * 100)}.`,
          `With ${usd(q * 100)}: ${usd(B)} + ${usd(i1)} − ${usd(q * 100)} = ${usd(B + i1 - q * 100)}.`,
          `The interest is the same in both, so the balance is lower by the extra payment: ${usd(q * 100)} − ${usd(mn * 100)} = ${usd((q - mn) * 100)}.`,
        ],
        correct: usd((q - mn) * 100),
        wrong: mw([
          [
            (q - mn) * 100 + extra,
            "Interest is charged before the payment, on the starting balance, so the extra payment earns no interest this month.",
          ],
          [
            (q - mn) * 100 - extra,
            "Interest is charged before the payment, so the extra payment does not reduce this month's interest.",
          ],
          [
            extra,
            "That is interest on the extra amount. The balance is lower by the extra amount paid.",
          ],
          [
            q * 100,
            "That is the whole larger payment. Compare it with the minimum payment.",
          ],
        ]),
      }),
    };
  }
  throw new Error("No tie-free card instance");
}

export function creditCostConceptsCase(seed: string): FinanceCase {
  checkSeed(seed);
  const m = creditCostConceptsTemplate;
  const r = random(m.id, seed);
  const variant = r(0, 4);
  const who = pick(r, names);
  if (variant === 0) {
    const monthly = pick(r, [1, 1.25, 1.5, 1.75, 2, 2.25]);
    const apr = monthly * 12;
    const forward = r(0, 1) === 0;
    return {
      variant: forward ? "apr-from-monthly" : "monthly-from-apr",
      given: { monthlyQuarterPct: monthly * 4, apr },
      value: forward ? apr : monthly,
      problem: forward
        ? finish(m, seed, r, {
            prompt: `A credit card charges ${pctText(monthly)} of the balance each month. The APR, the annual percentage rate, is the monthly rate times 12 months. What is this card's APR?`,
            hint: `The rate ${pctText(monthly)} is for one month. A year has 12 months, so multiply the monthly rate by 12.`,
            explanation: [
              `APR is the monthly rate × 12: ${pctText(monthly)} × 12 = ${pctText(apr)}.`,
              `Check: twelve months of ${pctText(monthly)} add up to ${pctText(apr)} a year.`,
            ],
            correct: pctText(apr),
            wrong: [
              [
                pctText(monthly),
                "That is the monthly rate. The APR is the rate for a whole year.",
              ],
              [
                pctText(apr / 144),
                "Multiply by 12 to move from a monthly rate to a yearly rate; do not divide.",
              ],
              [
                pctText(monthly + 12),
                "The APR is the monthly rate times 12, not plus 12.",
              ],
              [
                pctText(apr * 12),
                "Multiply by 12 once: twelve months make a year.",
              ],
            ],
          })
        : finish(m, seed, r, {
            prompt: `A credit card has an APR, annual percentage rate, of ${pctText(apr)}. The monthly rate is the APR divided by 12 months. What monthly rate does the card charge on its balance?`,
            hint: `The APR ${pctText(apr)} covers a whole year of 12 months. Divide it by 12 to get one month's rate.`,
            explanation: [
              `Monthly rate = APR ÷ 12 = ${pctText(apr)} ÷ 12 = ${pctText(monthly)}.`,
              `Check: ${pctText(monthly)} × 12 = ${pctText(apr)}, the APR.`,
            ],
            correct: pctText(monthly),
            wrong: [
              [
                pctText(apr),
                "That is the yearly rate. Divide it by 12 for one month.",
              ],
              [
                pctText(apr * 12),
                "Divide the yearly rate by 12; do not multiply.",
              ],
              [pctText(apr - 12), "Divide by 12, not subtract 12."],
              [
                pctText(apr / 100),
                "Dividing by 100 only changes percent into a decimal; divide by 12 to get a monthly rate.",
              ],
            ],
          }),
    };
  }
  for (let guard = 0; guard < 500; guard++) {
    const B = r(300, 3000) * 100 + r(0, 99);
    const apr = pick(r, APRS);
    const bp = monthlyBp(apr);
    const mr = pctText(apr / 12);
    if (variant === 1) {
      const min = r(25, 60);
      const unpaid = B - min * 100;
      if (chargeTie(unpaid, bp)) continue;
      const i = charge(unpaid, bp);
      return {
        variant: "carry-vs-full",
        given: { B, apr, minimum: min },
        value: i,
        problem: finish(m, seed, r, {
          prompt: `${who}'s statement balance is ${usd(B)} on a card with a ${apr}% APR, so the monthly rate is ${mr}. Paying the full balance by the due date costs no interest. If ${who} instead pays only the ${usd(min * 100)} minimum, interest for the month is charged on the unpaid part of the balance, rounded to the nearest cent. How much more interest does ${who} pay by paying only the minimum than by paying in full?`,
          hint: `Paying in full costs 0 interest, so the extra interest is the whole interest charge. The unpaid part is ${usd(B)} minus the ${usd(min * 100)} payment; take ${mr} of that.`,
          explanation: [
            `Unpaid part: ${usd(B)} − ${usd(min * 100)} = ${usd(unpaid)}.`,
            `Interest: ${mr} of ${usd(unpaid)} = ${usd(i)}.`,
            `Paying in full costs ${usd(0)}, so the minimum payment costs ${usd(i)} more.`,
          ],
          correct: usd(i),
          wrong: mw([
            [
              charge(B, bp),
              "Interest is charged on the unpaid part, after the minimum payment, not on the full statement balance.",
            ],
            [
              rdiv(unpaid * apr, 100),
              `${apr}% is a yearly rate. Use the monthly rate ${mr} for one month.`,
            ],
            [
              charge(min * 100, bp),
              "Interest is charged on the unpaid balance, not on the payment.",
            ],
            [
              0,
              "Interest is charged on any part of the balance left unpaid by the due date.",
            ],
          ]),
        }),
      };
    }
    if (variant === 2) {
      const apr2 = apr + pick(r, [3, 6, 9]);
      if (apr2 > 30) continue;
      const bp2 = monthlyBp(apr2);
      if (chargeTie(B, bp) || chargeTie(B, bp2)) continue;
      const i1 = charge(B, bp);
      const i2 = charge(B, bp2);
      // Rounding the gap directly must not give a near-miss answer.
      if (rdiv(B * (bp2 - bp), 10000) !== i2 - i1) continue;
      const diff = i2 - i1;
      return {
        variant: "two-cards",
        given: { B, apr1: apr, apr2 },
        value: diff,
        problem: finish(m, seed, r, {
          prompt: `${who} carries a balance of ${usd(B)} for one month. Card X has a ${apr}% APR and Card Y has a ${apr2}% APR. Each card's monthly rate is its APR ÷ 12, and each month's interest is rounded to the nearest cent. How much less interest does Card X charge for the month?`,
          hint: `Find each card's monthly rate by dividing its APR by 12. Take that percent of ${usd(B)} for each card, round each to the cent, then subtract.`,
          explanation: [
            `Card X: ${pctText(apr / 12)} of ${usd(B)} = ${usd(i1)}.`,
            `Card Y: ${pctText(apr2 / 12)} of ${usd(B)} = ${usd(i2)}.`,
            `Difference: ${usd(i2)} − ${usd(i1)} = ${usd(diff)}.`,
          ],
          correct: usd(diff),
          wrong: mw([
            [i2, "That is Card Y's interest. Subtract Card X's interest."],
            [
              i1,
              "That is Card X's interest. The question asks how much less it charges than Card Y.",
            ],
            [
              rdiv(B * (apr2 - apr), 100),
              "That uses the yearly rate gap for one month. Divide each APR by 12 first.",
            ],
            [
              i2 + i1,
              "Subtract the two interest charges instead of adding them.",
            ],
          ]),
        }),
      };
    }
    if (variant === 3) {
      const item = r(60, 900);
      const itemC = item * 100;
      if (chargeTie(itemC, bp)) continue;
      const i = charge(itemC, bp);
      return {
        variant: "credit-vs-debit",
        given: { item, apr },
        value: i,
        problem: finish(m, seed, r, {
          prompt: `${who} buys an item for ${usd(itemC)}. A debit card takes the price from checking right away and charges no interest. A credit card on which ${who} pays nothing until after the due date adds one month of interest on the price at an APR of ${apr}% (monthly rate ${mr}), rounded to the nearest cent. How much more does the item cost on credit after one month of interest than on debit?`,
          hint: `On debit the item costs ${usd(itemC)}. On credit it costs the same price plus interest. Find one month's interest: ${mr} of ${usd(itemC)}.`,
          explanation: [
            `Interest for one month: ${mr} of ${usd(itemC)} = ${usd(i)}.`,
            `Credit costs ${usd(itemC)} + ${usd(i)} = ${usd(itemC + i)}; debit costs ${usd(itemC)}.`,
            `The extra cost is the interest, ${usd(i)}.`,
          ],
          correct: usd(i),
          wrong: mw([
            [
              itemC + i,
              "That is the total owed on credit. The question asks how much more than the price.",
            ],
            [itemC, "That is the price, which both cards charge."],
            [
              rdiv(itemC * apr, 100),
              `${apr}% is the yearly rate. Use the monthly rate ${mr} for one month.`,
            ],
            [
              i * 12,
              "That is a year of interest. The question is about one month.",
            ],
          ]),
        }),
      };
    }
    const purchases = r(20, 300);
    const fee = pick(r, [25, 29, 35]);
    const pay = r(25, 150);
    if (chargeTie(B, bp)) continue;
    const i = charge(B, bp);
    const nb = B + i + purchases * 100 + fee * 100 - pay * 100;
    if (nb <= 0 || nb === B) continue;
    return {
      variant: "statement",
      given: { B, apr, purchases, fee, pay },
      value: nb,
      problem: finish(m, seed, r, {
        prompt: `${who}'s card statement starts at ${usd(B)}. The APR is ${apr}% (monthly rate ${mr}). During the month, interest is charged on the starting balance, rounded to the nearest cent. ${who} also buys ${usd(purchases * 100)} of items, is charged a ${usd(fee * 100)} late fee, and makes a ${usd(pay * 100)} payment. What is the new balance?`,
        hint: `Start from ${usd(B)}. Add the month's interest (${mr} of ${usd(B)}), the purchases and the late fee, then subtract the payment.`,
        explanation: [
          `Interest: ${mr} of ${usd(B)} = ${usd(i)}.`,
          `Add interest, purchases and fee: ${usd(B)} + ${usd(i)} + ${usd(purchases * 100)} + ${usd(fee * 100)} = ${usd(B + i + purchases * 100 + fee * 100)}.`,
          `Subtract the payment: ${usd(B + i + purchases * 100 + fee * 100)} − ${usd(pay * 100)} = ${usd(nb)}.`,
        ],
        correct: usd(nb),
        wrong: mw([
          [nb - fee * 100, "The late fee is also added to what is owed."],
          [nb - i, "The month's interest is added to what is owed."],
          [nb - purchases * 100, "New purchases are added to what is owed."],
          [
            B + i + purchases * 100 - fee * 100 - pay * 100,
            "A fee is a charge; add it rather than subtracting it.",
          ],
          [nb + 2 * pay * 100, "A payment lowers the balance."],
        ]),
      }),
    };
  }
  throw new Error("No tie-free concept instance");
}

// ------------------------------------------------------------ saving plans
export function savingsPlanGrowthCase(seed: string): FinanceCase {
  checkSeed(seed);
  const m = savingsPlanGrowthTemplate;
  const r = random(m.id, seed);
  const variant = r(0, 5);
  const who = pick(r, names);
  const c = (d: number) => d * 100;
  const S = r(1, 20) * 25;
  let d = pick(r, [10, 15, 20, 25, 30, 40, 50, 60, 75, 80]);
  if (d === S) d += 5;
  if (variant === 0) {
    const n = r(6, 24);
    const total = S + d * n;
    return {
      variant: "balance-after",
      given: { S, d, n },
      value: c(total),
      problem: finish(m, seed, r, {
        prompt: `${who} starts a savings plan with ${usd(c(S))} and deposits ${usd(c(d))} at the end of each month. No interest is counted. How much is in the account after ${n} monthly deposits?`,
        hint: `The ${usd(c(S))} start is added once. The ${usd(c(d))} deposit happens ${n} times; multiply to find the total deposited.`,
        explanation: [
          `Deposits: ${n} × ${d} = ${group(n * d)} dollars.`,
          `Balance: ${S} + ${group(n * d)} = ${group(total)} dollars.`,
        ],
        correct: usd(c(total)),
        wrong: mw([
          [c(n * d), "That leaves out the starting amount."],
          [c(S + d * (n - 1)), `There are ${n} deposits, not ${n - 1}.`],
          [c((S + d) * n), "Add the starting amount once, not once per month."],
          [c(S + d + n), "Multiply the deposit by the number of months."],
        ]),
      }),
    };
  }
  if (variant === 1) {
    const months = r(5, 30);
    const extra = pick(r, [0, 0, 1]);
    const G = S + d * months - (extra ? Math.floor(d / 2) : 0);
    const need = Math.ceil((G - S) / d);
    const floorN = Math.floor((G - S) / d);
    return {
      variant: "months-to-goal",
      given: { S, d, G },
      value: need,
      problem: finish(m, seed, r, {
        prompt: `${who} has ${usd(c(S))} and wants ${usd(c(G))} for a trip. ${who} will deposit ${usd(c(d))} at the end of each month and counts no interest. In how many months will the balance first be at least ${usd(c(G))}? Count whole months.`,
        hint: `${who} still needs ${usd(c(G))} − ${usd(c(S))}. Find how many ${usd(c(d))} deposits are needed to reach at least that, and remember deposits happen in whole months.`,
        explanation: [
          `Still needed: ${G} − ${S} = ${group(G - S)} dollars.`,
          `${group(G - S)} ÷ ${d} = ${parseFloat(((G - S) / d).toFixed(3))}. The balance only grows at month ends, so use the next whole month: ${need}.`,
          `Check: after ${need} deposits ${group(S + d * need)} dollars is at least ${group(G)}.`,
        ],
        correct: `${need} months`,
        wrong: [
          [
            `${floorN} months`,
            "After that many months the balance is still below the goal.",
          ],
          [
            `${Math.ceil(G / d)} months`,
            "The starting amount already counts toward the goal; subtract it first.",
          ],
          [`${need + 1} months`, "One fewer month is already enough."],
          [
            `${Math.max(need - 1, 1)} months`,
            "After that many months the balance is still below the goal.",
          ],
          [
            `${need + 2} months`,
            "A smaller number of months already reaches the goal.",
          ],
        ],
      }),
    };
  }
  if (variant === 2) {
    const n = pick(r, [6, 8, 10, 12, 15, 18, 20, 24]);
    const G = S + d * n;
    return {
      variant: "deposit-needed",
      given: { S, G, n },
      value: c(d),
      problem: finish(m, seed, r, {
        prompt: `${who} has ${usd(c(S))} and wants exactly ${usd(c(G))} in ${n} months, with no interest counted. ${who} will make ${n} equal monthly deposits. How much should each deposit be?`,
        hint: `Subtract the ${usd(c(S))} already saved from the ${usd(c(G))} goal, then share what is left equally among ${n} deposits.`,
        explanation: [
          `Still needed: ${G} − ${S} = ${group(G - S)} dollars.`,
          `Each deposit: ${group(G - S)} ÷ ${n} = ${d} dollars.`,
        ],
        correct: usd(c(d)),
        wrong: mw([
          [
            c(Math.round(G / n)),
            "The starting amount is already saved; subtract it from the goal before dividing.",
          ],
          [c(Math.round((G - S) / (n + 1))), `There are ${n} deposits.`],
          [
            c(Math.round(G - S)),
            "That is the total still needed. Divide it among the deposits.",
          ],
          [
            c(Math.round(S / n)),
            "Divide the amount still needed, not the starting amount.",
          ],
          [
            c(Math.round((G + S) / n)),
            "The starting amount lowers what must be deposited; subtract it.",
          ],
        ]),
      }),
    };
  }
  if (variant === 3) {
    for (;;) {
      const dA = pick(r, [30, 40, 50, 60, 75, 80]);
      const dB = dA - pick(r, [10, 15, 20, 25]);
      if (dB <= 0) continue;
      const k = r(3, 15);
      const SA = r(0, 10) * 25;
      const SB = SA + (dA - dB) * k;
      return {
        variant: "equal-month",
        given: { SA, dA, SB, dB },
        value: k,
        problem: finish(m, seed, r, {
          prompt: `Plan A starts with ${usd(c(SA))} and adds ${usd(c(dA))} each month. Plan B starts with ${usd(c(SB))} and adds ${usd(c(dB))} each month. After how many monthly deposits do the two plans hold the same amount?`,
          hint: `Plan B starts ahead by ${usd(c(SB - SA))}, but Plan A gains ${usd(c(dA - dB))} more each month. Find how many months it takes Plan A to close the gap.`,
          explanation: [
            `Plan B starts ahead. Its lead is ${SB} − ${SA} = ${SB - SA} dollars.`,
            `Each month Plan A adds more, so it gains ${dA} − ${dB} = ${dA - dB} dollars on Plan B.`,
            `Count how many monthly gains of ${dA - dB} close the ${SB - SA}-dollar lead: ${SB - SA} ÷ ${dA - dB} = ${k}.`,
            `Check: A holds ${SA} + ${k} × ${dA} = ${SA + k * dA} dollars and B holds ${SB} + ${k} × ${dB} = ${SB + k * dB} dollars.`,
          ],
          correct: `${k} months`,
          wrong: [
            [`${k + 1} months`, "At that many months Plan A is already ahead."],
            [
              `${Math.max(k - 1, 1)} months`,
              "At that many months Plan B is still ahead.",
            ],
            [
              `${Math.round((SB - SA) / dA) || k + 2} ${Math.round((SB - SA) / dA) === 1 ? "month" : "months"}`,
              "Plan A closes the gap by the difference between the deposits, not by its whole deposit.",
            ],
            [
              `${k * 2} months`,
              "Plan A gains the difference in deposits each month; divide the starting gap by that difference.",
            ],
          ],
        }),
      };
    }
  }
  if (variant === 4) {
    for (;;) {
      const SA = r(0, 12) * 25;
      const SB = r(0, 12) * 25;
      const dA = pick(r, [20, 30, 40, 50, 60]);
      const dB = pick(r, [20, 30, 40, 50, 60]);
      const n = r(6, 24);
      const A = SA + dA * n;
      const B = SB + dB * n;
      if (A === B || SA === SB || dA === dB) continue;
      const w = A > B ? "A" : "B";
      const l = w === "A" ? "B" : "A";
      const diff = Math.abs(A - B);
      const lab = (x: string, v: number) => `Plan ${x} by ${usd(c(v))}`;
      return {
        variant: "who-leads",
        given: { SA, dA, SB, dB, n },
        value: c(diff),
        problem: finish(m, seed, r, {
          prompt: `Plan A starts with ${usd(c(SA))} and adds ${usd(c(dA))} each month. Plan B starts with ${usd(c(SB))} and adds ${usd(c(dB))} each month. After ${n} monthly deposits, which plan holds more, and by how much?`,
          hint: `Compute each plan's balance as the starting amount plus ${n} deposits, then compare. Plan A deposits ${usd(c(dA))} and Plan B deposits ${usd(c(dB))}.`,
          explanation: [
            `Plan A: ${SA} + ${n} × ${dA} = ${group(A)} dollars.`,
            `Plan B: ${SB} + ${n} × ${dB} = ${group(B)} dollars.`,
            `Plan ${w} holds more, by ${group(Math.max(A, B))} − ${group(Math.min(A, B))} = ${group(diff)} dollars.`,
          ],
          correct: lab(w, diff),
          wrong: [
            [
              lab(l, diff),
              `Plan ${l} has the smaller balance after ${n} deposits.`,
            ],
            [
              lab(w, Math.abs(SA - SB)),
              "That is the gap in starting amounts. Include the deposits too.",
            ],
            [
              lab(l, Math.abs(SA - SB)),
              "Compare final balances, not only the starting amounts.",
            ],
            [
              lab(w, Math.abs(dA - dB) * n),
              "That is the gap in deposits only. Include the starting amounts too.",
            ],
            [
              lab(l, Math.abs(dA - dB) * n),
              "Compare final balances including the starting amounts.",
            ],
          ],
        }),
      };
    }
  }
  const b1 = S + d;
  const month = pick(r, [8, 10, 12, 15, 18]);
  const ans = S + d * month;
  return {
    variant: "table-extend",
    given: { S, d, month },
    value: c(ans),
    problem: finish(m, seed, r, {
      prompt: `${who} saves the same amount every month. The table shows the balance in dollars at the end of months 1, 2 and 3. If the pattern continues, what is the balance at the end of month ${month}?\n$\\begin{array}{c|ccc}\\text{Month}&1&2&3\\\\\\hline\\text{Balance}&${[1, 2, 3].map((k) => cell(c(S + d * k), false)).join("&")}\\end{array}$`,
      hint: `Subtract neighbouring balances to find how much is added each month. Then count how many more months are needed after month 3, or work back to the starting amount.`,
      explanation: [
        `Each month adds ${group(S + d * 2)} − ${group(b1)} = ${d} dollars.`,
        `From month 3 to month ${month} is ${month - 3} more months: ${group(S + d * 3)} + ${month - 3} × ${d} = ${group(ans)} dollars.`,
        `Equivalently, the start was ${group(b1)} − ${d} = ${S} dollars, so month ${month} holds ${S} + ${month} × ${d} = ${group(ans)} dollars.`,
      ],
      correct: usd(c(ans)),
      wrong: mw([
        [
          c(b1 * month),
          "The balance grows by a fixed deposit each month, not by multiples of the month-1 balance.",
        ],
        [c(d * month), "That leaves out the starting amount."],
        [
          c(b1 + d * month),
          `Month 1 already includes one deposit; from month 1 to month ${month} there are ${month - 1} more.`,
        ],
        [
          c(S + d * (month - 1)),
          `By month ${month} there have been ${month} deposits.`,
        ],
      ]),
    }),
  };
}

// ------------------------------------------------------ interest in tables
export function interestTableTypeCase(seed: string): FinanceCase {
  checkSeed(seed);
  const m = interestTableTypeTemplate;
  const r = random(m.id, seed);
  const variant = r(0, 1);
  for (let guard = 0; guard < 500; guard++) {
    const P = pick(r, PRINCIPALS);
    const Pc = P * 100;
    const pct = r(3, 10);
    const C = compoundBalances(Pc, pct, 3);
    if (!C) continue;
    const S = [0, 1, 2, 3].map((y) => simpleBalance(Pc, pct, y));
    const compName = r(0, 1) ? "A" : "B";
    const simpName = compName === "A" ? "B" : "A";
    const rows: [string, number[]][] =
      compName === "A"
        ? [
            ["Account A", C],
            ["Account B", S],
          ]
        : [
            ["Account A", S],
            ["Account B", C],
          ];
    const table = interestTable(rows, true);
    const I = (Pc / 100) * pct;
    if (variant === 0) {
      const S10 = simpleBalance(Pc, pct, 10);
      const lab = (n: string, v: number) => `Account ${n}, ${usd(v)}`;
      return {
        variant: "identify-extend",
        given: { P, pct },
        value: S10,
        problem: finish(m, seed, r, {
          prompt: `Both accounts started with ${usd(Pc)} and earn the same yearly rate; nothing is added or withdrawn. One account pays simple interest and one pays compound interest. The table shows year-end balances in dollars. Which account pays simple interest, and what will it hold after 10 years?\n${table}`,
          hint: `Find each account's increase from one year to the next. The simple-interest account's increase never changes. Once you know that amount, count how many years of it to add to the starting ${usd(Pc)}.`,
          explanation: [
            `Account ${simpName} grows by ${usd(I)} every year, so it pays simple interest. Account ${compName} grows by a larger amount each year (${usd(C[1]! - C[0]!)}, ${usd(C[2]! - C[1]!)}, ${usd(C[3]! - C[2]!)}).`,
            `After 10 years the simple account has earned 10 × ${usd(I)} = ${usd(10 * I)}.`,
            `It holds ${usd(Pc)} + ${usd(10 * I)} = ${usd(S10)}.`,
          ],
          correct: lab(simpName, S10),
          wrong: [
            [
              lab(compName, S10),
              `Account ${compName}'s yearly increase keeps growing, so it is the compound account.`,
            ],
            [
              lab(simpName, S[3]! + 10 * I),
              "Year 3 already includes 3 years of interest. Count 10 years from the start.",
            ],
            [
              lab(simpName, 10 * I),
              "That is only the interest. Add the starting amount.",
            ],
            [
              lab(compName, 10 * I),
              "Check which account's yearly increase stays the same, and add the starting amount.",
            ],
          ],
        }),
      };
    }
    const int3 = C[3]! - C[2]!;
    return {
      variant: "interest-in-year",
      given: { P, pct },
      value: int3,
      problem: finish(m, seed, r, {
        prompt: `Both accounts started with ${usd(Pc)} and earn the same yearly rate; nothing is added or withdrawn. One account pays simple interest and one pays compound interest. The table shows year-end balances in dollars. How much interest does the compound-interest account earn during year 3?\n${table}`,
        hint: `First decide which account is compound: its yearly increases are not all equal. Then subtract its year 2 balance from its year 3 balance. The starting ${usd(Pc)} is not interest.`,
        explanation: [
          `Account ${simpName} grows by ${usd(I)} every year (simple). Account ${compName} is the compound account.`,
          `The interest earned during year 3 is how much the balance grew that year.`,
          `Subtract the year 2 balance from the year 3 balance: ${usd(C[3]!)} − ${usd(C[2]!)} = ${usd(int3)}.`,
        ],
        correct: usd(int3),
        wrong: mw([
          [
            C[3]!,
            "That is the balance at the end of year 3. Interest is the increase during the year.",
          ],
          [C[3]! - Pc, "That is the interest earned over all three years."],
          [C[2]! - C[1]!, "That is year 2's interest."],
          [
            I,
            "That is the simple account's yearly interest. The compound account earns more in year 3.",
          ],
        ]),
      }),
    };
  }
  throw new Error("No tie-free table instance");
}

const cases: Record<string, (seed: string) => FinanceCase> = {
  "interest-compare-years": interestCompareYearsCase,
  "loan-total-cost": loanTotalCostCase,
  "loan-compare-options": loanCompareOptionsCase,
  "credit-card-balance": creditCardBalanceCase,
  "credit-cost-concepts": creditCostConceptsCase,
  "savings-plan-growth": savingsPlanGrowthCase,
  "interest-table-type": interestTableTypeCase,
};
export const financeCreditTemplateIds = new Set(Object.keys(cases));
export function generateFinanceCreditProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const make = cases[templateId];
  if (!make) throw new Error(`Unknown finance template ${templateId}`);
  return make(seed).problem;
}
