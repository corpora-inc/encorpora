import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  numberSurface,
} from "./chain-kit";
import { draw } from "./elementary-gap-kit";

export const patternRuleChoiceTemplate: TemplateMetadata = {
  id: "pattern-rule-choice",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Find the rule of a number pattern",
  skillId: "rule-patterns",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "From the first five terms of a number pattern, choose the rule that makes it (add a number, multiply by a number, or add an amount that grows by one each time), or choose the listed pattern that follows the same rule as a given one.",
};
export const patternTermTemplate: TemplateMetadata = {
  id: "pattern-term-unknown-rule",
  version: 1,
  title: "Continue a pattern whose rule is not stated",
  skillId: "rule-patterns",
  gradeBand: "3–5",
  difficultyOffset: 0.3,
  description:
    "Find the next term, or the seventh term, of a number pattern from its first four or five terms, where the amount added stays the same or grows or shrinks by one each time, for increasing and decreasing patterns.",
};

type R = (lo: number, hi: number) => number;
type Kind = "add" | "multiply" | "grow";
interface Rule {
  kind: Kind;
  /** Amount added, factor, or the first amount added. */
  p: number;
}
const terms = (start: number, rule: Rule, count: number): number[] => {
  const out = [start];
  for (let i = 1; i < count; i++) {
    const prev = out[i - 1]!;
    out.push(
      rule.kind === "add"
        ? prev + rule.p
        : rule.kind === "multiply"
          ? prev * rule.p
          : prev + rule.p + (i - 1),
    );
  }
  return out;
};
const ruleText = (r: Rule) =>
  r.kind === "add"
    ? `Add ${r.p} each time`
    : r.kind === "multiply"
      ? `Multiply by ${r.p} each time`
      : `Add ${r.p}, then add ${r.p + 1}, then add ${r.p + 2}, and so on`;
/** True when `rule` makes `list` from its first term. */
const fits = (rule: Rule, list: number[]) =>
  terms(list[0]!, rule, list.length).every((v, i) => v === list[i]);

const axes = {
  ask: defineAxis("ask", ["rule-of-terms", "same-rule-pattern"] as const),
  kind: defineAxis("kind", ["add", "multiply", "grow"] as const),
};
interface ChoiceModel {
  ask: "rule-of-terms" | "same-rule-pattern";
  rule: Rule;
  start: number;
  /** The listed pattern and the options' starts for the second form. */
  list: number[];
  options: { rule: Rule; start: number }[];
  correct: number;
}
function randomRule(r: R, kind: Kind): Rule {
  return kind === "add"
    ? { kind, p: r(3, 12) }
    : kind === "multiply"
      ? { kind, p: r(2, 4) }
      : { kind, p: r(1, 4) };
}
function choiceModel(
  r: R,
  a: { ask: ChoiceModel["ask"]; kind: Kind },
): ChoiceModel {
  const rule = randomRule(r, a.kind);
  const start = a.kind === "multiply" ? r(1, 3) : r(2, 40);
  const list = terms(start, rule, 5);
  const others = (["add", "multiply", "grow"] as Kind[]).filter(
    (k) => k !== a.kind,
  );
  const wrongRules: Rule[] = [
    { kind: a.kind, p: rule.p + (a.kind === "multiply" ? 1 : r(1, 2)) },
    {
      kind: a.kind,
      p: Math.max(1, rule.p - (a.kind === "multiply" ? 1 : r(1, 2))),
    },
    ...others.map((k) => randomRule(r, k)),
  ];
  const seen = new Set([`${rule.kind}${rule.p}`]);
  const unique = wrongRules.filter((w) => {
    const key = `${w.kind}${w.p}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.length < 3) throw new Error("Need three retries");
  if (a.ask === "rule-of-terms") {
    const picks = draw(r, unique, 3);
    // No wrong rule may also make the list.
    if (picks.some((w) => fits(w, list))) throw new Error("Need three retries");
    const options = draw(
      r,
      [{ rule, start }, ...picks.map((w) => ({ rule: w, start }))],
      4,
    );
    return {
      ask: a.ask,
      rule,
      start,
      list,
      options,
      correct: options.findIndex((o) => o.rule === rule),
    };
  }
  // Same rule, different starts: four lists, one with the same rule.
  const startOf = () => (a.kind === "multiply" ? r(1, 3) : r(2, 40));
  const picks = draw(r, unique, 3);
  const options = [
    { rule, start: startOf() },
    ...picks.map((w) => ({ rule: w, start: startOf() })),
  ];
  // Every option's list must be different from the shown list and from the others.
  const lists = options.map((o) => terms(o.start, o.rule, 5).join(","));
  if (new Set([...lists, list.join(",")]).size !== 5)
    throw new Error("Need three retries");
  const shuffled = draw(r, options, 4);
  return {
    ask: a.ask,
    rule,
    start,
    list,
    options: shuffled,
    correct: shuffled.findIndex((o) => o.rule === rule),
  };
}
export const patternRuleChoice = chainFamily({
  template: patternRuleChoiceTemplate,
  axes,
  model: choiceModel,
  variant: (m) => `${m.ask}-${m.rule.kind}`,
  render: (m, _a, r) => {
    const shown = m.list.join(", ");
    if (m.ask === "rule-of-terms") {
      const diffs = m.list.slice(1).map((v, i) => v - m.list[i]!);
      return choiceSurface(r, {
        prompt: `A number pattern starts ${shown}. Which rule makes this pattern?`,
        options: m.options.map((o, i) =>
          i === m.correct
            ? { label: ruleText(o.rule), correct: true as const }
            : {
                label: ruleText(o.rule),
                feedback: `Start from ${m.list[0]} and apply "${ruleText(o.rule).toLowerCase()}": you get ${terms(m.list[0]!, o.rule, 5).join(", ")}, not ${shown}.`,
              },
        ),
        hint: `Compare neighbors in ${shown}. Subtract ${m.list[0]} from ${m.list[1]}, then ${m.list[1]} from ${m.list[2]}, and ask whether the change is the same each time, or whether each term is a multiple of the one before.`,
        explanation: [
          m.rule.kind === "multiply"
            ? `Each term is ${m.rule.p} times the one before: ${m.list
                .slice(0, 3)
                .map((v, i, l) => (i ? `${l[i - 1]} × ${m.rule.p} = ${v}` : ""))
                .filter(Boolean)
                .join(", ")}.`
            : `A pattern's rule tells how to get each term from the one before. Subtract neighbors to see the changes: ${diffs.join(", ")}.`,
          m.rule.kind === "grow"
            ? `The change grows by 1 each time, starting with ${m.rule.p}.`
            : m.rule.kind === "add"
              ? `The change is always ${m.rule.p}.`
              : "The terms grow by the same factor each time.",
          `The rule is "${ruleText(m.rule).toLowerCase()}".`,
        ],
      });
    }
    return choiceSurface(r, {
      prompt: `Look at the pattern ${shown}. Which pattern follows the same rule?`,
      options: m.options.map((o, i) => {
        const list = terms(o.start, o.rule, 5).join(", ");
        return i === m.correct
          ? { label: list, correct: true as const }
          : {
              label: list,
              feedback: `This pattern's rule is "${ruleText(o.rule).toLowerCase()}". The pattern ${shown} follows "${ruleText(m.rule).toLowerCase()}".`,
            };
      }),
      hint: `Find the rule of ${shown} first: subtract each term from the next, starting with ${m.list[1]} − ${m.list[0]}, or divide for a multiple. Then check each choice with that rule.`,
      explanation: [
        `A pattern's rule tells how to get each term from the one before. Find it by comparing neighbors, starting with ${m.list[0]} and ${m.list[1]}: subtract them, or divide for a multiple.`,
        `Checking every neighbor, the pattern ${shown} follows "${ruleText(m.rule).toLowerCase()}".`,
        `Two patterns can follow the same rule from different starting numbers.`,
        `The pattern ${terms(m.options[m.correct]!.start, m.rule, 5).join(", ")} follows the same rule, so it is the answer.`,
      ],
    });
  },
});

const signed = (n: number) => (n < 0 ? `−${-n}` : String(n));
/* ---------------------------------------------------- unknown rule, number */
const termAxes = {
  change: defineAxis("change", [
    "constant",
    "differences-grow",
    "differences-shrink",
  ] as const),
  ask: defineAxis("ask", ["next", "seventh"] as const),
};
interface TermModel {
  change: "constant" | "differences-grow" | "differences-shrink";
  ask: "next" | "seventh";
  list: number[];
  answer: number;
  /** The first difference and how the differences change. */
  d1: number;
  step: number;
}
const sequence = (start: number, d1: number, step: number, count: number) => {
  const out = [start];
  let d = d1;
  for (let i = 1; i < count; i++) {
    out.push(out[i - 1]! + d);
    d += step;
  }
  return out;
};
function termModel(
  r: R,
  a: { change: TermModel["change"]; ask: TermModel["ask"] },
): TermModel {
  const decreasing = r(0, 1) === 1;
  const sign = decreasing ? -1 : 1;
  // Differences grow in size ("grow") or shrink in size ("shrink"), by one.
  const step =
    a.change === "constant"
      ? 0
      : a.change === "differences-grow"
        ? sign
        : -sign;
  const mag =
    a.change === "differences-shrink"
      ? r(5, 9)
      : a.change === "constant"
        ? r(3, 12)
        : r(1, 4);
  const d1 = sign * mag;
  const shown = a.ask === "seventh" ? 5 : 4;
  const total = a.ask === "seventh" ? 7 : 5;
  const start = decreasing ? r(60, 120) : r(2, 30);
  const all = sequence(start, d1, step, total);
  if (all.some((v) => v < 1)) throw new Error("Need three retries");
  // Differences of a shrinking pattern must stay the same sign.
  const diffs = all.slice(1).map((v, i) => v - all[i]!);
  if (diffs.some((d) => Math.sign(d) !== sign))
    throw new Error("Need three retries");
  return {
    change: a.change,
    ask: a.ask,
    list: all.slice(0, shown),
    answer: all[total - 1]!,
    d1,
    step,
  };
}
export const patternTerm = chainFamily({
  template: patternTermTemplate,
  axes: termAxes,
  model: termModel,
  variant: (m) => `${m.change}-${m.ask}`,
  render: (m) => {
    const shown = m.list.join(", ");
    const diffs = m.list.slice(1).map((v, i) => v - m.list[i]!);
    const full = sequence(
      m.list[0]!,
      m.d1,
      m.step,
      m.ask === "seventh" ? 7 : 5,
    );
    const tail = full.slice(m.list.length);
    return numberSurface({
      prompt: `A number pattern starts ${shown}. ${m.ask === "next" ? "What is the next number in the pattern?" : "What is the seventh number in the pattern?"}`,
      answer: String(m.answer),
      hint: `Find how the pattern changes: ${m.list[1]} − ${m.list[0]} is ${signed(m.list[1]! - m.list[0]!)}. Do the same for the next neighbors in ${shown} and see whether the change stays the same or changes by one.`,
      explanation: [
        `To find a pattern's rule, subtract each term from the next. The changes between terms are ${diffs.map(signed).join(", ")}.`,
        m.step === 0
          ? `The change is the same every time, ${signed(diffs[0]!)}, so keep adding ${signed(diffs[0]!)}.`
          : `Each change is 1 ${m.step > 0 ? "more" : "less"} than the one before, so the next changes are ${tail.map((v, i) => signed(v - full[m.list.length - 1 + i]!)).join(", ")}.`,
        `Continuing: ${tail.join(", ")}. The ${m.ask === "next" ? "next" : "seventh"} number is ${m.answer}.`,
      ],
    });
  },
});

export const patternRuleTemplates = [
  patternRuleChoiceTemplate,
  patternTermTemplate,
] as const;
export const patternRuleGenerate = dispatch(patternRuleTemplates, {
  "pattern-rule-choice": (seed) => patternRuleChoice.generate(seed).problem,
  "pattern-term-unknown-rule": (seed) => patternTerm.generate(seed).problem,
});
