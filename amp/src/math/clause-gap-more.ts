import type { SemanticFigure } from "./contracts.js";
import type { ClauseCtx } from "./clause-gap-kit.js";
import { multiSelect, problem, shuffle, singleChoice, slots } from "./clause-gap-kit.js";

const moneySkill = "money-values";

function centsOf(items: readonly string[]): number {
  const value: Record<string, number> = {
    penny: 1,
    nickel: 5,
    dime: 10,
    quarter: 25,
    dollar: 100,
  };
  return items.reduce((sum, item) => sum + value[item]!, 0);
}

function dollar(cents: number): string {
  return `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function moneyFigure(
  items: ("penny" | "nickel" | "dime" | "quarter" | "dollar" | "five")[],
): SemanticFigure {
  return { kind: "money-sets", sets: [{ items }] };
}

/** Bills and coins worth T cents, 101–299, not a whole dollar. */
function purse(
  r: ClauseCtx["r"],
  smallCents: boolean,
): ("penny" | "nickel" | "dime" | "quarter" | "dollar")[] {
  for (let i = 0; i < 40; i++) {
    const dollars = r(1, 2);
    const cents = smallCents ? r(1, 9) : r(0, 1) === 0 ? 10 * r(1, 9) : r(10, 99);
    if (cents === 0 || cents % 100 === 0) continue;
    const items: ("penny" | "nickel" | "dime" | "quarter" | "dollar")[] = Array.from(
      { length: dollars },
      () => "dollar",
    );
    let left = cents;
    const coins = ["quarter", "dime", "nickel", "penny"] as const;
    for (const coin of coins) {
      const worth = { quarter: 25, dime: 10, nickel: 5, penny: 1 }[coin];
      const n = Math.min(coin === "quarter" ? 3 : 4, Math.floor(left / worth));
      for (let k = 0; k < n; k++) items.push(coin);
      left -= n * worth;
    }
    if (left === 0 && centsOf(items) === dollars * 100 + cents) return items;
  }
  return ["dollar", "nickel", "penny"];
}

function writeSymbols(ctx: ClauseCtx) {
  const { r } = ctx;
  const form = (["picture", "both", "rename"] as const)[r(0, 2)]!;
  if (form === "both") {
    const coins: ("penny" | "nickel" | "dime" | "quarter" | "dollar")[] = [];
    let left = 5 * r(1, 19);
    if (r(0, 1) === 0) left = r(1, 4) + 5 * r(0, 18);
    const order = ["quarter", "dime", "nickel", "penny"] as const;
    const worth: Record<string, number> = { quarter: 25, dime: 10, nickel: 5, penny: 1 };
    for (const coin of order) {
      const n = Math.min(4, Math.floor(left / worth[coin]!));
      for (let k = 0; k < n; k++) coins.push(coin);
      left -= n * worth[coin]!;
    }
    const total = centsOf(coins);
    const built = multiSelect(
      r,
      [
        { label: `${total}¢`, correct: true },
        { label: `$0.${String(total).padStart(2, "0")}`, correct: true },
        { label: `0.${String(total).padStart(2, "0")}¢` },
        { label: `$${total}` },
        { label: `¢${total}` },
      ],
      "Select every correct way to write the amount",
    );
    return problem({
      id: ctx.id,
      seed: ctx.seed,
      task: ctx.task,
      skillId: moneySkill,
      prompt: "These coins are worth one amount. Select every way that writes it correctly.",
      figure: moneyFigure(coins),
      response: built.response,
      answer: built.answer,
      hint: `Count the coins in cents first. ${total} cents can be written with ¢ or as part of a dollar.`,
      explanation: [
        `The coins are worth ${total} cents.`,
        `${total} cents is also ${total} hundredths of a dollar.`,
        `¢ follows a count of cents. $ leads a decimal with two places: $0.${String(total).padStart(2, "0")}.`,
      ],
    });
  }
  if (form === "rename") {
    if (r(0, 1) === 0) {
      const cents = r(101, 999);
      const key = dollar(cents);
      const onePlace = `$${Math.floor(cents / 100)}.${cents % 100}`;
      const choice = singleChoice(r, [
        { label: key, correct: true },
        { label: `$${cents}`, feedback: `${cents} cents is not ${cents} dollars.` },
        { label: `${key.slice(1)}¢`, feedback: "¢ follows a count of cents, not a dollar decimal." },
        {
          label: onePlace === key ? `$${cents}¢` : onePlace,
          feedback: onePlace === key ? "Do not use both symbols at once." : "Cents always use two places.",
        },
      ]);
      // The one-place form can equal the key when cents are 10–99 and we wrote them without a pad... we used unpadded in the last label only when it differs.
      return problem({
        id: ctx.id,
        seed: ctx.seed,
        task: ctx.task,
        skillId: moneySkill,
        prompt: `Dev saved ${cents} cents. How is that written with the dollar sign?`,
        response: choice.response,
        answer: choice.answer,
        choiceFeedback: choice.choiceFeedback,
        hint: `${cents} cents: every 100 cents is one dollar. What is left over is the cents.`,
        explanation: [
          `${cents} cents is ${Math.floor(cents / 100)} dollars and ${cents % 100} cents.`,
          `The dollar sign goes in front, and the cents use two places: ${key}.`,
        ],
      });
    }
    const cents = 5 * r(1, 19);
    const choice = singleChoice(r, [
      { label: `${cents}¢`, correct: true },
      { label: `${cents / 10}¢`, feedback: "The zero in the cents places still counts." },
      { label: `${cents * 10}¢`, feedback: "Hundredths of a dollar are cents, not tenths times ten again." },
      { label: `0.${String(cents).padStart(2, "0")}¢`, feedback: "¢ does not hang on a dollar decimal." },
    ]);
    return problem({
      id: ctx.id,
      seed: ctx.seed,
      task: ctx.task,
      skillId: moneySkill,
      prompt: `A sticker costs $0.${String(cents).padStart(2, "0")}. How many cents is that?`,
      response: choice.response,
      answer: choice.answer,
      choiceFeedback: choice.choiceFeedback,
      hint: `The two places after the point in $0.${String(cents).padStart(2, "0")} are cents.`,
      explanation: [
        `Hundredths of a dollar are cents.`,
        `$0.${String(cents).padStart(2, "0")} is ${cents} cents: ${cents}¢.`,
      ],
    });
  }
  const items = purse(r, r(0, 1) === 0);
  const total = centsOf(items);
  const key = dollar(total);
  const cents = total % 100;
  const hybrid = cents >= 10 && cents % 10 !== 0 ? `${key}¢` : `$${Math.floor(total / 100)}.${cents}`;
  const choice = singleChoice(r, [
    { label: key, correct: true },
    { label: `$${total}`, feedback: `${total} cents is not ${total} dollars.` },
    { label: `${key.slice(1)}¢`, feedback: "¢ follows a count of cents, never a decimal." },
    {
      label: hybrid === key ? `$${total}¢` : hybrid,
      feedback: cents < 10 ? "Cents always use two places." : "Do not use both symbols at once.",
    },
  ]);
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: moneySkill,
    prompt: "How much money is shown? Choose the amount written with the dollar sign.",
    figure: moneyFigure(items),
    response: choice.response,
    answer: choice.answer,
    choiceFeedback: choice.choiceFeedback,
    hint: "Count the cents first, then trade each 100 cents for one dollar. The dollar sign goes in front.",
    explanation: [
      `The money is worth ${total} cents.`,
      `Every 100 cents is a dollar: ${key}.`,
      "Cents always use two places after the point.",
    ],
  });
}

const ribbonColors = ["red", "blue", "green", "yellow", "purple", "orange"] as const;

function fullOrder(ctx: ClauseCtx) {
  const { r } = ctx;
  const [shortest, middle, longest] = shuffle(r, ribbonColors).slice(0, 3) as [
    string,
    string,
    string,
  ];
  const first =
    r(0, 1) === 0
      ? `The ${longest} ribbon is longer than the ${middle} ribbon.`
      : `The ${middle} ribbon is shorter than the ${longest} ribbon.`;
  const second =
    r(0, 1) === 0
      ? `The ${middle} ribbon is longer than the ${shortest} ribbon.`
      : `The ${shortest} ribbon is shorter than the ${middle} ribbon.`;
  const sentences = r(0, 1) === 0 ? [first, second] : [second, first];
  const colors = shuffle(r, [shortest, middle, longest]);
  const built = slots(
    r,
    [
      { id: "short", label: "Shortest", options: colors, correct: shortest },
      { id: "mid", label: "Middle", options: colors, correct: middle },
      { id: "long", label: "Longest", options: colors, correct: longest },
    ],
    "Put the ribbons in order",
  );
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: "measure-equal-units",
    prompt: `${sentences[0]} ${sentences[1]} Put the ribbons in order from shortest to longest.`,
    response: built.response,
    answer: built.answer,
    hint: `The ${middle} ribbon is in both sentences, so it is the middle length. Shortest goes first.`,
    explanation: [
      `${middle} sits in both sentences, so it is the middle.`,
      `${longest} is longer than ${middle}, so ${longest} is last.`,
      `${shortest} is shorter than ${middle}, so ${shortest} is first.`,
      `From shortest to longest: ${shortest}, ${middle}, ${longest}.`,
    ],
  });
}

function braces(ctx: ClauseCtx) {
  const { r } = ctx;
  let factor = 3, outer = 40, times = 2, left = 7, right = 5, value = 48;
  for (let i = 0; i < 40; i++) {
    left = r(2, 12);
    right = r(2, 12);
    times = r(2, 6);
    const bracket = times * (left + right);
    outer = r(Math.max(20, bracket), Math.min(100, bracket + 80));
    if (outer < bracket) continue;
    factor = r(2, 9);
    const brace = outer - bracket;
    value = factor * brace;
    if (value <= 1000 && value !== factor * outer - times * (left + right)) break;
    // The flattened wrong method must not equal the key. If it does, keep looking.
    if (value <= 1000 && factor * outer - bracket !== value) break;
  }
  const expression = `${factor}\\times{${outer}-[${times}\\times(${left}+${right})]}`;
  return problem({
    id: ctx.id,
    seed: ctx.seed,
    task: ctx.task,
    skillId: "numerical-expressions",
    prompt: `Evaluate $${expression}$.`,
    response: { kind: "number", label: "Value" },
    answer: String(value),
    hint: `Parentheses, brackets and braces all mean the same thing: make this one number. Start at (${left}+${right}).`,
    explanation: [
      "Parentheses, brackets and braces all mean the same thing: make this one number. Three shapes so you can see which group is inside which.",
      `(${left}+${right}) is ${left + right}.`,
      `[${times}\\times${left + right}] is ${times * (left + right)}.`,
      `\\{${outer}-${times * (left + right)}\\} is ${outer - times * (left + right)}.`,
      `${factor}\\times${outer - times * (left + right)} = ${value}. Innermost group first, then out one shape at a time.`,
    ],
  });
}

export function buildMoreClause(ctx: ClauseCtx) {
  switch (`${ctx.id}:${ctx.task}`) {
    case "money-total-dollars:write-with-symbols":
      return writeSymbols(ctx);
    case "order-lengths:full-order":
      return fullOrder(ctx);
    case "staar-nested-grouping:brace-nesting":
      return braces(ctx);
    default:
      throw new Error(`No more clause ${ctx.id}:${ctx.task}`);
  }
}
