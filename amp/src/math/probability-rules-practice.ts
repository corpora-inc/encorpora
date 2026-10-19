import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { act, lessonStep, step, table, tree, venn } from "./scene/author";
import type { Action, Step } from "./scene/timeline";
import type { Scene } from "./scene/spec";

/** High-school probability rules (S-CP): events as sets, the addition rule,
 * conditional probability and the multiplication rule. Figures are scenes:
 * a Venn diagram, a two-way table or a probability tree. */
type Random = (low: number, high: number) => number;
type Rational = { n: number; d: number };
type Case = {
  prompt: string;
  answer: Rational;
  explanation: string[];
  /** One step for this instance: its own givens and the first move. */
  hint: string;
  tags: string[];
  figure?: Scene;
  count?: string;
};

const scenes = { requiredFigureCapability: "scenes-v1" } as const;
export const probabilityRulesTemplates: readonly TemplateMetadata[] = [
  {
    id: "event-set-count",
    version: 1,
    title: "Unions, intersections and complements",
    skillId: "event-sets",
    gradeBand: "9–12",
    description:
      "Read events written with or, and, not or set symbols as regions of a sample space, and count or find the probability of the outcomes in them.",
    ...scenes,
  },
  {
    id: "addition-rule-probability",
    version: 1,
    title: "The addition rule",
    skillId: "probability-addition",
    gradeBand: "9–12",
    description:
      "Find P(A or B) as P(A) + P(B) − P(A and B), from counts, probabilities or a deck of cards, and solve the rule for the overlap.",
    ...scenes,
  },
  {
    id: "conditional-probability-value",
    version: 1,
    title: "Conditional probability",
    skillId: "conditional-probability",
    gradeBand: "9–12",
    description:
      "Find P(A | B) by restricting the sample space to B: from a two-way table, a Venn diagram, a list of outcomes or P(A and B) ÷ P(B).",
    ...scenes,
  },
  {
    id: "multiplication-rule-probability",
    version: 1,
    title: "The multiplication rule",
    skillId: "probability-multiplication",
    gradeBand: "9–12",
    description:
      "Find P(A and B) as P(A) × P(B | A) for draws without replacement and two-stage trees, and add the paths that make up an event.",
    ...scenes,
  },
];

const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
function q(n: number, d = 1): Rational {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0)
    throw new Error("Expected exact rational arithmetic");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const add = (a: Rational, b: Rational) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Rational, b: Rational) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Rational, b: Rational) => q(a.n * b.n, a.d * b.d);
const div = (a: Rational, b: Rational) => q(a.n * b.d, a.d * b.n);
const one = q(1);
/** A fraction as text: "3/10", or a whole number. */
const frac = (v: Rational) =>
  `${v.n < 0 ? "−" : ""}${Math.abs(v.n)}${v.d === 1 ? "" : `/${v.d}`}`;
/** A terminating decimal as text ("0.15"); other values as fractions. */
function decimal(v: Rational) {
  let d = v.d,
    places = 0;
  for (const p of [2, 5]) while (d % p === 0) d /= p;
  if (d !== 1) return frac(v);
  while ((v.n * 10 ** places) % v.d !== 0) places++;
  return (v.n / v.d).toFixed(places);
}
/** A probability statement as TeX, so P(A and B) = 1/4 is set as one formula
 * (MathText typesets $…$ as written). Words inside P( ) are \text. */
const math = (plain: string) =>
  `$${plain
    .replace(/(\d+)\/(\d+)/g, "\\frac{$1}{$2}")
    .replace(/−/g, "-")
    .replace(/×/g, "\\times")
    .replace(/÷/g, "\\div")
    .replace(/∪/g, "\\cup")
    .replace(/∩/g, "\\cap")
    .replace(/′/g, "'")
    .replace(/ (and|or) /g, " \\text{ $1 } ")
    .replace(/ \| /g, " \\mid ")}$`;
const answerText = (v: Rational) => `${v.n}${v.d === 1 ? "" : `/${v.d}`}`;
/** "a/b", unreduced, then "= reduced" when it differs. */
const ratio = (a: number, b: number) => {
  const v = q(a, b);
  return v.d === b ? `${a}/${b}` : `${a}/${b} = ${frac(v)}`;
};

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return low + (value % span);
  };
}
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
const cap = (text: string) => `${text[0]!.toUpperCase()}${text.slice(1)}`;

// ------------------------------------------------------------ Venn contexts
type Trait = {
  letter: string;
  name: string;
  /** Singular and plural predicates: "takes art", "take art". */
  has: string;
  have: string;
  hasNot: string;
  haveNot: string;
};
type Group = {
  one: string;
  many: string;
  /** "who" for people, "that" for households. */
  who: string;
  /** "take both", "bought both". */
  both: string;
  intro: string;
  a: Trait;
  b: Trait;
};
const groups: readonly Group[] = [
  {
    one: "student",
    many: "students",
    both: "take both",
    who: "who",
    intro: "students in a club",
    a: {
      letter: "A",
      name: "Art",
      has: "takes art",
      have: "take art",
      hasNot: "does not take art",
      haveNot: "do not take art",
    },
    b: {
      letter: "M",
      name: "Music",
      has: "takes music",
      have: "take music",
      hasNot: "does not take music",
      haveNot: "do not take music",
    },
  },
  {
    one: "household",
    many: "households",
    both: "own both",
    who: "that",
    intro: "households on a street",
    a: {
      letter: "D",
      name: "Dog",
      has: "owns a dog",
      have: "own a dog",
      hasNot: "does not own a dog",
      haveNot: "do not own a dog",
    },
    b: {
      letter: "C",
      name: "Cat",
      has: "owns a cat",
      have: "own a cat",
      hasNot: "does not own a cat",
      haveNot: "do not own a cat",
    },
  },
  {
    one: "customer",
    many: "customers",
    both: "bought both",
    who: "who",
    intro: "customers at a café one morning",
    a: {
      letter: "C",
      name: "Coffee",
      has: "bought coffee",
      have: "bought coffee",
      hasNot: "did not buy coffee",
      haveNot: "did not buy coffee",
    },
    b: {
      letter: "P",
      name: "Pastry",
      has: "bought a pastry",
      have: "bought a pastry",
      hasNot: "did not buy a pastry",
      haveNot: "did not buy a pastry",
    },
  },
  {
    one: "member",
    many: "members",
    both: "do both",
    who: "who",
    intro: "members of a gym",
    a: {
      letter: "S",
      name: "Swim",
      has: "swims",
      have: "swim",
      hasNot: "does not swim",
      haveNot: "do not swim",
    },
    b: {
      letter: "Y",
      name: "Yoga",
      has: "does yoga",
      have: "do yoga",
      hasNot: "does not do yoga",
      haveNot: "do not do yoga",
    },
  },
];
type Region = "a" | "ab" | "b" | "none";
type Counts = Record<Region, number>;
/** Events as region sets, written in symbols and in words. */
type SetExpr = {
  key: string;
  regions: Region[];
  symbol: (A: string, B: string) => string;
  words?: (g: Group) => string;
};
const expressions: readonly SetExpr[] = [
  {
    key: "union",
    regions: ["a", "ab", "b"],
    symbol: (A, B) => `${A} ∪ ${B}`,
    words: (g) => `${g.a.have} or ${g.b.have}`,
  },
  {
    key: "intersection",
    regions: ["ab"],
    symbol: (A, B) => `${A} ∩ ${B}`,
    words: (g) => `${g.a.have} and ${g.b.have}`,
  },
  {
    key: "complement",
    regions: ["b", "none"],
    symbol: (A) => `${A}′`,
    words: (g) => g.a.haveNot,
  },
  {
    key: "neither",
    regions: ["none"],
    symbol: (A, B) => `(${A} ∪ ${B})′`,
    words: (g) => `${g.a.haveNot} and ${g.b.haveNot}`,
  },
  {
    key: "only-first",
    regions: ["a"],
    symbol: (A, B) => `${A} ∩ ${B}′`,
    words: (g) => `${g.a.have} but ${g.b.haveNot}`,
  },
  {
    key: "only-second",
    regions: ["b"],
    symbol: (A, B) => `${A}′ ∩ ${B}`,
    words: (g) => `${g.b.have} but ${g.a.haveNot}`,
  },
  {
    key: "union-complement",
    regions: ["a", "ab", "none"],
    symbol: (A, B) => `${A} ∪ ${B}′`,
  },
  {
    key: "not-both",
    regions: ["a", "b", "none"],
    symbol: (A, B) => `(${A} ∩ ${B})′`,
  },
  {
    key: "both-complements",
    regions: ["none"],
    symbol: (A, B) => `${A}′ ∩ ${B}′`,
  },
];
const regionWords = (g: Group): Record<Region, string> => ({
  a: `${g.a.have} but ${g.b.haveNot}`,
  ab: `${g.a.have} and ${g.b.have}`,
  b: `${g.b.have} but ${g.a.haveNot}`,
  none: `${g.a.haveNot} and ${g.b.haveNot}`,
});
const regionNames = (g: Group): Record<Region, string> => ({
  a: `the ${g.a.name}-only region`,
  ab: "the overlap",
  b: `the ${g.b.name}-only region`,
  none: "the region outside both circles",
});
const sum = (counts: Counts, regions: Region[]) =>
  regions.reduce((s, r) => s + counts[r], 0);
const randomCounts = (r: Random): Counts => ({
  a: r(3, 20),
  ab: r(2, 12),
  b: r(3, 20),
  none: r(1, 15),
});
const total = (c: Counts) => c.a + c.ab + c.b + c.none;
const vennOf = (g: Group, n: number) =>
  venn(`${g.a.name} (${g.a.letter})`, `${g.b.name} (${g.b.letter})`, {
    universe: `${n} ${g.many}`,
  }).id("v");

// ---------------------------------------------- numbered sample spaces
type NumberEvent = { text: string; holds: (x: number) => boolean; key: string };
function numberEvents(r: Random, n: number): [NumberEvent, NumberEvent] {
  const prime = (x: number) =>
    x > 1 && Array.from({ length: x - 2 }, (_, i) => i + 2).every((d) => x % d);
  const t = r(Math.ceil(n / 3), Math.floor((2 * n) / 3));
  const all: NumberEvent[] = [
    { key: "even", text: "the number is even", holds: (x) => x % 2 === 0 },
    { key: "odd", text: "the number is odd", holds: (x) => x % 2 === 1 },
    ...[3, 4, 5].map((k) => ({
      key: `multiple-${k}`,
      text: `the number is a multiple of ${k}`,
      holds: (x: number) => x % k === 0,
    })),
    {
      key: "greater",
      text: `the number is greater than ${t}`,
      holds: (x) => x > t,
    },
    { key: "prime", text: "the number is prime", holds: prime },
  ];
  const first = r(0, all.length - 1);
  let second = r(0, all.length - 2);
  if (second >= first) second++;
  return [all[first]!, all[second]!];
}
const listed = (xs: number[]) =>
  xs.length === 0
    ? "no outcomes"
    : xs.length === 1
      ? `only ${xs[0]}`
      : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// ------------------------------------------------------------- event sets
function eventSetCase(r: Random): Case {
  const mode = r(0, 3);
  if (mode === 3) {
    const n = pick(r, [12, 15, 20, 24, 30]);
    const [A, B] = numberEvents(r, n);
    const expr = pick(r, expressions.slice(0, 6));
    const outcomes = range(n).filter((x) => {
      const region: Region = A.holds(x)
        ? B.holds(x)
          ? "ab"
          : "a"
        : B.holds(x)
          ? "b"
          : "none";
      return expr.regions.includes(region);
    });
    const inA = range(n).filter(A.holds),
      inB = range(n).filter(B.holds);
    return {
      prompt: `A whole number from 1 to ${n} is chosen at random. Event A: ${A.text}. Event B: ${B.text}. How many outcomes are in the event ${expr.symbol("A", "B")}?`,
      answer: q(outcomes.length),
      explanation: [
        `A has ${inA.length} ${inA.length === 1 ? "outcome" : "outcomes"}: ${listed(inA)}. B has ${inB.length} ${inB.length === 1 ? "outcome" : "outcomes"}: ${listed(inB)}.`,
        `${expr.symbol("A", "B")} ${meaning(expr.key)}.`,
        `Those outcomes are ${listed(outcomes)}, so the event has ${outcomes.length} ${outcomes.length === 1 ? "outcome" : "outcomes"}.`,
      ],
      hint: `List the numbers 1 to ${n} that make A true and those that make B true. ${expr.symbol("A", "B")} ${meaning(expr.key)}.`,
      tags: ["listed", expr.key],
      count: "Number of outcomes",
    };
  }
  const g = pick(r, groups);
  const counts = randomCounts(r),
    n = total(counts);
  const [A, B] = [g.a.letter, g.b.letter];
  if (mode === 2) {
    // Totals and the overlap are given; a region must be recovered.
    const ask = pick(r, ["a", "b", "none"] as const);
    const nA = counts.a + counts.ab,
      nB = counts.b + counts.ab;
    const words = regionWords(g)[ask];
    const inCircles = nA + nB - counts.ab;
    const figure = vennOf(g, n)
      .totals(nA, nB)
      .regions({ a: null, ab: counts.ab, b: null, none: null })
      .scene({
        title: `Venn diagram of ${n} ${g.many}`,
        steps:
          ask === "none"
            ? [
                ...doubleCount(
                  String(nA),
                  String(nB),
                  String(counts.ab),
                  `${nA} + ${nB} − ${counts.ab} = ${inCircles}`,
                ).slice(0, 3),
                lessonStep(
                  `The rest are outside both circles: ${n} − ${inCircles} = ${counts.none}.`,
                  ...shade(["none"]),
                ),
              ]
            : [
                step(
                  `The ${ask === "a" ? g.a.name : g.b.name} circle holds ${ask === "a" ? nA : nB}, the overlap included.`,
                  ...shade(
                    [ask, "ab"],
                    ask === "a" ? "accent-fill" : "warm-fill",
                  ),
                ),
                step(
                  `Take out the ${counts.ab} in the overlap.`,
                  ...shade(["ab"], "empty"),
                  act.highlight("v.count.ab"),
                ),
                lessonStep(
                  `${cap(ask === "a" ? g.a.name : g.b.name)} only: ${ask === "a" ? nA : nB} − ${counts.ab} = ${counts[ask]}.`,
                  ...shade([ask]),
                ),
              ],
      });
    const explanation =
      ask === "none"
        ? [
            `The ${counts.ab} in the overlap are inside both totals, so the circles hold ${nA} + ${nB} − ${counts.ab} = ${nA + nB - counts.ab} ${g.many} in all.`,
            `The rest are outside both circles: ${n} − ${nA + nB - counts.ab} = ${counts.none}.`,
            `${counts.none} ${counts.none === 1 ? g.one : g.many} ${words}.`,
          ]
        : [
            `The ${ask === "a" ? g.a.name : g.b.name} circle holds ${ask === "a" ? nA : nB} ${g.many} in all, and ${counts.ab} of them are in the overlap.`,
            `${cap(ask === "a" ? g.a.name : g.b.name)} only: ${ask === "a" ? nA : nB} − ${counts.ab} = ${counts[ask]}.`,
            `${counts[ask]} ${counts[ask] === 1 ? g.one : g.many} ${words}.`,
          ];
    return {
      prompt: `Of ${n} ${g.intro}, ${nA} ${g.a.have}, ${nB} ${g.b.have} and ${counts.ab} ${g.both}. How many ${g.many} ${words}?`,
      answer: q(counts[ask]),
      explanation,
      hint:
        ask === "none"
          ? `The ${counts.ab} ${g.who} ${g.both} are inside both totals, ${nA} and ${nB}. Count everyone inside the circles once, then take that from ${n}.`
          : `The ${ask === "a" ? g.a.name : g.b.name} total, ${ask === "a" ? nA : nB}, includes the ${counts.ab} in the overlap. Take the overlap out of that circle.`,
      tags: ["totals", `ask-${ask}`],
      figure,
      count: `Number of ${g.many}`,
    };
  }
  const expr =
    mode === 0 ? pick(r, expressions.slice(0, 6)) : pick(r, expressions);
  const inside = sum(counts, expr.regions);
  const figure = vennOf(g, n)
    .regions(counts)
    .scene({
      title: `Venn diagram of ${n} ${g.many}`,
      steps: [
        step(
          `${expr.symbol(A, B)} ${meaning(expr.key, A, B)}.`,
          ...shade(expr.regions),
        ),
        lessonStep(
          `${expr.regions.length > 1 ? `${expr.regions.map((x) => counts[x]).join(" + ")} = ` : ""}${inside}${mode === 1 ? ` of the ${n} ${g.many}` : ""}.`,
          ...expr.regions.map((x) => act.highlight(`v.count.${x}`)),
        ),
      ],
    });
  const names = regionNames(g);
  const parts = expr.regions.map((x) => `${counts[x]} (${names[x]})`);
  const setup = `Event ${A}: the ${g.one} ${g.a.has}. Event ${B}: the ${g.one} ${g.b.has}.`;
  const regionsText =
    expr.regions.length === 1
      ? `${expr.symbol(A, B)} is ${names[expr.regions[0]!]}.`
      : `${expr.symbol(A, B)} is made of ${expr.regions.length} regions: ${expr.regions
          .map((x) => names[x])
          .join(", ")
          .replace(/, ([^,]*)$/, " and $1")}.`;
  if (mode === 1) {
    // A random member: the event's probability.
    const words = expr.words?.(g);
    return {
      prompt: `The Venn diagram sorts ${n} ${g.intro}. ${setup} One ${g.one} is chosen at random. Find ${math(`P(${expr.symbol(A, B)})`)}.`,
      answer: q(inside, n),
      explanation: [
        `${regionsText.replace(/\.$/, "")}${words ? `: ${g.many} ${g.who} ${words}` : ""}.`,
        parts.length > 1
          ? `Add their counts: ${expr.regions.map((x) => counts[x]).join(" + ")} = ${inside} of the ${n} ${g.many}.`
          : `That region holds ${inside} of the ${n} ${g.many}.`,
        `${math(`P(${expr.symbol(A, B)}) = ${ratio(inside, n)}`)}.`,
      ],
      hint: `The whole sample space is all ${n} ${g.many}. Shade the regions that make ${expr.symbol(A, B)} true, add their counts, and divide by ${n}.`,
      tags: ["probability", expr.key],
      figure,
    };
  }
  const words = expr.words!(g);
  const symbolic = r(0, 1) === 1;
  return {
    prompt: symbolic
      ? `The Venn diagram sorts ${n} ${g.intro}. ${setup} How many ${g.many} are in the event ${expr.symbol(A, B)}?`
      : `The Venn diagram sorts ${n} ${g.intro}. How many ${g.many} ${words}?`,
    answer: q(inside),
    explanation: [
      symbolic
        ? regionsText
        : `${cap(g.many)} ${g.who} ${words} are in ${expr.regions.map((x) => names[x]).join(" and ")}.`,
      expr.regions.length > 1
        ? `Add those counts: ${expr.regions.map((x) => counts[x]).join(" + ")} = ${inside}.`
        : `That region holds ${inside}.`,
      `${inside} ${inside === 1 ? g.one : g.many} ${symbolic ? `${inside === 1 ? "is" : "are"} in ${expr.symbol(A, B)}` : words}.`,
    ],
    hint: symbolic
      ? `${expr.symbol(A, B)} ${meaning(expr.key, A, B)}. Find those regions among the four counts, which add to ${n}.`
      : `Decide which of the four regions hold ${g.many} ${g.who} ${words}; the four counts add to ${n}.`,
    tags: [symbolic ? "symbols" : "words", expr.key],
    figure,
    count: `Number of ${g.many}`,
  };
}
/** What an event in set notation contains, in words, for events A and B. */
function meaning(key: string, A = "A", B = "B") {
  return {
    union: `contains the outcomes in ${A}, in ${B} or in both`,
    intersection: `contains only the outcomes in both ${A} and ${B}`,
    complement: `contains the outcomes not in ${A}`,
    neither: `contains the outcomes in neither ${A} nor ${B}`,
    "only-first": `contains the outcomes in ${A} that are not in ${B}`,
    "only-second": `contains the outcomes in ${B} that are not in ${A}`,
    "union-complement": `contains the outcomes in ${A} or not in ${B}`,
    "not-both": `contains every outcome except those in both ${A} and ${B}`,
    "both-complements": `contains the outcomes outside ${A} and outside ${B}`,
  }[key]!;
}
/** Shade Venn regions from this step on. */
const shade = (
  regions: Region[],
  fill:
    | "gold-fill"
    | "accent-fill"
    | "warm-fill"
    | "gold-strong"
    | "empty" = "gold-fill",
): Action[] => regions.map((r) => act.fill(`v.region.${r}`, fill));
/** The addition-rule walkthrough on a Venn diagram with set totals: the first
 * circle, then the second, so the overlap is shaded twice, then the overlap
 * taken away once. */
function doubleCount(a: string, b: string, ab: string, result: string): Step[] {
  return [
    step(
      `Count the first circle: ${a}.`,
      ...shade(["a", "ab"], "accent-fill"),
      act.highlight("v.set.0"),
    ),
    step(
      `Add the second circle, ${b}. The overlap, ${ab}, is now counted twice.`,
      ...shade(["b"], "warm-fill"),
      ...shade(["ab"], "gold-strong"),
      act.highlight("v.count.ab"),
    ),
    step(
      `Subtract the overlap once: ${a} + ${b} − ${ab}.`,
      ...shade(["a", "ab", "b"], "gold-fill"),
      act.highlight("v.count.ab"),
    ),
    lessonStep(
      `Each outcome in the shaded region is now counted once: ${result}.`,
    ),
  ];
}

// ----------------------------------------------------------------- cards
type CardEvent = {
  text: string;
  /** The cards as a plural noun: "red cards". */
  many: string;
  holds: (rank: number, suit: number) => boolean;
};
const card: Record<string, CardEvent> = {
  heart: { text: "a heart", many: "hearts", holds: (_, s) => s === 0 },
  club: { text: "a club", many: "clubs", holds: (_, s) => s === 2 },
  red: { text: "a red card", many: "red cards", holds: (_, s) => s < 2 },
  black: { text: "a black card", many: "black cards", holds: (_, s) => s >= 2 },
  face: {
    text: "a face card (jack, queen or king)",
    many: "face cards",
    holds: (k) => k >= 11,
  },
  king: { text: "a king", many: "kings", holds: (k) => k === 13 },
  queen: { text: "a queen", many: "queens", holds: (k) => k === 12 },
  ace: { text: "an ace", many: "aces", holds: (k) => k === 1 },
  number: {
    text: "a number card from 2 to 10",
    many: "number cards from 2 to 10",
    holds: (k) => k >= 2 && k <= 10,
  },
};
const deck = Array.from(
  { length: 52 },
  (_, i) => [(i % 13) + 1, Math.floor(i / 13)] as const,
);
const cardCount = (e: CardEvent) =>
  deck.filter(([k, s]) => e.holds(k, s)).length;
const cardPairs = [
  ["heart", "face"],
  ["red", "king"],
  ["club", "ace"],
  ["black", "queen"],
  ["heart", "number"],
  ["face", "club"],
  ["king", "queen"],
  ["heart", "club"],
  ["ace", "face"],
] as const;
const deckIntro =
  "A card is drawn at random from a standard deck of 52 cards (13 cards in each of the four suits: hearts, diamonds, clubs and spades; hearts and diamonds are red)";

// ---------------------------------------------------------- addition rule
/** Probabilities written as decimals or as fractions over one denominator. */
function probabilities(r: Random) {
  const asDecimal = r(0, 1) === 1;
  const d = asDecimal ? 100 : pick(r, [8, 10, 12, 20]);
  const unit = asDecimal ? 5 : 1;
  // P(A and B) < P(A), P(B) and P(A) + P(B) − P(A and B) ≤ 1.
  let ab: number, a: number, b: number;
  do {
    ab = r(1, Math.floor(d / (4 * unit))) * unit;
    a = r(ab / unit + 1, Math.floor((d * 0.7) / unit)) * unit;
    b = r(ab / unit + 1, Math.floor((d * 0.7) / unit)) * unit;
  } while (a + b - ab > d || a + b - ab === d);
  return { a: q(a, d), b: q(b, d), ab: q(ab, d), asDecimal };
}
function additionCase(r: Random): Case {
  const mode = r(0, 3);
  if (mode === 0) {
    const g = pick(r, groups);
    const c = randomCounts(r),
      n = total(c),
      nA = c.a + c.ab,
      nB = c.b + c.ab,
      union = nA + nB - c.ab;
    return {
      prompt: `Of ${n} ${g.intro}, ${nA} ${g.a.have}, ${nB} ${g.b.have} and ${c.ab} ${g.both}. One ${g.one} is chosen at random. What is the probability that the ${g.one} ${g.a.has} or ${g.b.has}?`,
      answer: q(union, n),
      explanation: [
        `Let ${g.a.letter} be “the ${g.one} ${g.a.has}” and ${g.b.letter} be “the ${g.one} ${g.b.has}”. ${math(`P(${g.a.letter}) = ${ratio(nA, n)}`)}, ${math(`P(${g.b.letter}) = ${ratio(nB, n)}`)} and ${math(`P(${g.a.letter} and ${g.b.letter}) = ${ratio(c.ab, n)}`)}.`,
        `Adding ${nA} and ${nB} counts the ${c.ab} ${c.ab === 1 ? g.one : g.many} in the overlap twice, so subtract the overlap once: ${nA} + ${nB} − ${c.ab} = ${union}.`,
        `${math(`P(${g.a.letter} or ${g.b.letter}) = ${ratio(union, n)}`)}.`,
      ],
      hint: `The ${nA} and the ${nB} both include the ${c.ab} ${g.many} ${g.who} ${g.both}. Add the two totals, subtract the overlap once, then divide by ${n}.`,
      tags: ["counts"],
      figure: vennOf(g, n)
        .totals(nA, nB)
        .regions({ a: null, ab: c.ab, b: null })
        .scene({
          title: `Venn diagram of ${n} ${g.many}`,
          steps: doubleCount(
            String(nA),
            String(nB),
            String(c.ab),
            `${union} of the ${n} ${g.many}, so the probability is ${ratio(union, n)}`,
          ),
        }),
    };
  }
  if (mode === 3) {
    const [x, y] = pick(r, cardPairs);
    const A = card[x]!,
      B = card[y]!;
    const nA = cardCount(A),
      nB = cardCount(B),
      both = deck.filter(([k, s]) => A.holds(k, s) && B.holds(k, s)).length,
      union = nA + nB - both;
    return {
      prompt: `${deckIntro}. What is the probability that the card is ${A.text} or ${B.text}?`,
      answer: q(union, 52),
      explanation: [
        `There are ${nA} ${A.many} and ${nB} ${B.many}.`,
        both
          ? `${both} ${both === 1 ? "card is" : "cards are"} both, and ${both === 1 ? "it is" : "they are"} counted in each group, so subtract ${both === 1 ? "it" : "them"} once: ${nA} + ${nB} − ${both} = ${union}.`
          : `No card is both, so the events are mutually exclusive and nothing is counted twice: ${nA} + ${nB} = ${union}.`,
        `The probability is ${ratio(union, 52)}.`,
      ],
      hint: `Count the ${A.many}, then the ${B.many}. Check whether any card is both before you add, and divide by 52.`,
      tags: ["cards", both ? "overlap" : "exclusive"],
    };
  }
  const p = probabilities(r);
  const unionP = sub(add(p.a, p.b), p.ab);
  const show = (v: Rational) => (p.asDecimal ? decimal(v) : frac(v));
  const figure = venn("A", "B", { universe: "S" })
    .id("v")
    .totals(show(p.a), show(p.b))
    .regions({ a: null, ab: show(p.ab), b: null })
    .scene({
      title: "Venn diagram of two events",
      steps: doubleCount(
        show(p.a),
        show(p.b),
        show(p.ab),
        `the probability is ${show(unionP)}`,
      ),
    });
  if (mode === 1)
    return {
      prompt: `For two events $A$ and $B$, ${math(`P(A) = ${show(p.a)}`)}, ${math(`P(B) = ${show(p.b)}`)} and ${math(`P(A and B) = ${show(p.ab)}`)}. Find ${math("P(A or B)")}.`,
      answer: unionP,
      explanation: [
        `${math("P(A) + P(B)")} counts the overlap, ${math(`P(A and B) = ${show(p.ab)}`)}, twice.`,
        `Subtract it once: ${math(`P(A or B) = ${show(p.a)} + ${show(p.b)} − ${show(p.ab)} = ${show(unionP)}`)}.`,
      ],
      hint: `Adding ${show(p.a)} and ${show(p.b)} counts the overlap, ${show(p.ab)}, twice. Subtract it once.`,
      tags: ["formula", p.asDecimal ? "decimal" : "fraction"],
      figure,
    };
  return {
    prompt: `For two events $A$ and $B$, ${math(`P(A or B) = ${show(unionP)}`)}, ${math(`P(A) = ${show(p.a)}`)} and ${math(`P(B) = ${show(p.b)}`)}. Find ${math("P(A and B)")}.`,
    answer: p.ab,
    explanation: [
      `The addition rule says ${math("P(A or B) = P(A) + P(B) − P(A and B)")}, so ${math("P(A and B) = P(A) + P(B) − P(A or B)")}.`,
      `${math(`P(A) + P(B) = ${show(p.a)} + ${show(p.b)} = ${show(add(p.a, p.b))}`)}. That is more than ${math("P(A or B)")} by exactly the overlap counted twice.`,
      `${math(`P(A and B) = ${show(add(p.a, p.b))} − ${show(unionP)} = ${show(p.ab)}`)}.`,
    ],
    hint: `${math(`P(A) + P(B) = ${show(p.a)} + ${show(p.b)}`)} counts the overlap twice, while ${math(`P(A or B) = ${show(unionP)}`)} counts it once. The difference is the overlap.`,
    tags: ["overlap-unknown", p.asDecimal ? "decimal" : "fraction"],
    figure: venn("A", "B", { universe: "S" })
      .id("v")
      .totals(show(p.a), show(p.b))
      .regions({ ab: null })
      .scene({
        title: "Venn diagram of two events",
        steps: [
          step(
            `${math(`P(A) + P(B) = ${show(p.a)} + ${show(p.b)}`)} covers the overlap twice.`,
            ...shade(["a"], "accent-fill"),
            ...shade(["b"], "warm-fill"),
            ...shade(["ab"], "gold-strong"),
          ),
          step(
            `${math(`P(A or B) = ${show(unionP)}`)} covers it once.`,
            ...shade(["a", "ab", "b"], "gold-fill"),
          ),
          lessonStep(
            `The difference is the overlap: ${math(`${show(add(p.a, p.b))} − ${show(unionP)} = ${show(p.ab)}`)}.`,
            act.highlight("v.count.ab"),
          ),
        ],
      }),
  };
}

// ---------------------------------------------------- conditional probability
type Survey = {
  one: string;
  many: string;
  corner: string;
  rows: [string, string];
  /** Predicates for one member and for several. */
  rowIs: [string, string];
  rowAre: [string, string];
  columns: string[];
  colIs: string[];
  colAre: string[];
};
const surveys: readonly Survey[] = [
  {
    one: "student",
    many: "students",
    corner: "Grade",
    rows: ["Grade 9", "Grade 10"],
    rowIs: ["is in grade 9", "is in grade 10"],
    rowAre: ["are in grade 9", "are in grade 10"],
    columns: ["Online", "In person"],
    colIs: ["prefers online classes", "prefers in-person classes"],
    colAre: ["prefer online classes", "prefer in-person classes"],
  },
  {
    one: "visitor",
    many: "visitors",
    corner: "Visitor",
    rows: ["Adult", "Child"],
    rowIs: ["is an adult", "is a child"],
    rowAre: ["are adults", "are children"],
    columns: ["Museum", "Zoo", "Park"],
    colIs: ["chose the museum", "chose the zoo", "chose the park"],
    colAre: ["chose the museum", "chose the zoo", "chose the park"],
  },
  {
    one: "player",
    many: "players",
    corner: "Team",
    rows: ["Juniors", "Seniors"],
    rowIs: ["is a junior", "is a senior"],
    rowAre: ["are juniors", "are seniors"],
    columns: ["Soccer", "Track"],
    colIs: ["plays soccer", "runs track"],
    colAre: ["play soccer", "run track"],
  },
  {
    one: "voter",
    many: "voters",
    corner: "Age",
    rows: ["Under 40", "40 or over"],
    rowIs: ["is under 40", "is 40 or over"],
    rowAre: ["are under 40", "are 40 or over"],
    columns: ["Yes", "No"],
    colIs: ["voted yes", "voted no"],
    colAre: ["voted yes", "voted no"],
  },
];
/** "is in grade 10" → "is also in grade 10"; "voted yes" → "also voted yes". */
const also = (predicate: string) =>
  /^(is|are) /.test(predicate)
    ? predicate.replace(/^(is|are) /, "$1 also ")
    : `also ${predicate}`;
function conditionalCase(r: Random): Case {
  const mode = r(0, 3);
  if (mode === 0) {
    const s = pick(r, surveys);
    const k = s.columns.length;
    const cells = [0, 1].map(() => Array.from({ length: k }, () => r(4, 30)));
    const rowTotals = cells.map((row) => row.reduce((a, b) => a + b, 0));
    const colTotals = s.columns.map((_, j) => cells[0]![j]! + cells[1]![j]!);
    const n = rowTotals[0]! + rowTotals[1]!;
    const ri = r(0, 1),
      cj = r(0, k - 1);
    const byRow = r(0, 1) === 1;
    const totals = r(0, 1) === 1;
    let t = table(totals ? [...s.columns, "Total"] : s.columns, {
      corner: s.corner,
      totalColumn: totals,
    });
    for (const i of [0, 1])
      t = t.row(s.rows[i]!, totals ? [...cells[i]!, rowTotals[i]!] : cells[i]!);
    if (totals) t = t.row("Total", [...colTotals, n], { total: true });
    const given = byRow ? s.rowIs[ri]! : s.colIs[cj]!,
      asked = byRow ? s.colIs[cj]! : s.rowIs[ri]!,
      askedMany = byRow ? s.colAre[cj]! : s.rowAre[ri]!;
    const whole = byRow ? rowTotals[ri]! : colTotals[cj]!;
    const part = cells[ri]![cj]!;
    const line = byRow ? `${s.rows[ri]} row` : `${s.columns[cj]} column`;
    // Conditioning, drawn: the given row or column becomes the sample space,
    // then the cell that is also in the asked event is marked.
    const band = byRow ? `t.band.row.${ri}` : `t.band.column.${cj}`;
    const figure = t
      .id("t")
      .highlight({
        ...(byRow ? { rows: [ri] } : { columns: [cj] }),
        cells: [[ri, cj]],
      })
      .scene({
        title: `Survey of ${s.many}`,
        steps: [
          step(
            `Given that the ${s.one} ${given}: only the ${line} is possible now.`,
            act.appear(band),
          ),
          step(
            `Within it, find the ${s.many} who ${also(askedMany)}.`,
            act.appear(`t.mark.${ri}.${cj}`),
          ),
          lessonStep(
            `${part} of the ${whole} in the ${line}: ${ratio(part, whole)}.`,
            act.highlight(`t.cell.${ri}.${cj}`),
          ),
        ],
      });
    return {
      prompt: `The table shows survey results for a group of ${s.many}. One of these ${s.many} is chosen at random. Given that the ${s.one} ${given}, what is the probability that the ${s.one} ${asked}?`,
      answer: q(part, whole),
      explanation: [
        `“Given that the ${s.one} ${given}” limits the sample space to the ${line}: ${totals ? `${whole} ${s.many}` : `${(byRow ? cells[ri]! : [cells[0]![cj]!, cells[1]![cj]!]).join(" + ")} = ${whole} ${s.many}`}.`,
        `Of those, ${part} ${part === 1 ? `${s.one} ${also(asked)}` : `${s.many} ${also(askedMany)}`}.`,
        `The probability is ${ratio(part, whole)}.`,
      ],
      hint: `Only the ${line} counts now. Find its total${totals ? "" : " by adding its cells"}, then count the ${s.many} in it who ${askedMany}; the whole group of ${n} is no longer the denominator.`,
      tags: [
        "table",
        byRow ? "given-row" : "given-column",
        totals ? "totals" : "no-totals",
      ],
      figure,
    };
  }
  if (mode === 1) {
    const g = pick(r, groups);
    const c = randomCounts(r),
      n = total(c);
    const givenA = r(0, 1) === 1;
    const [G, T] = givenA ? [g.a, g.b] : [g.b, g.a];
    const whole = (givenA ? c.a : c.b) + c.ab;
    return {
      prompt: `The Venn diagram sorts ${n} ${g.intro}. One ${g.one} is chosen at random. Given that the ${g.one} ${G.has}, what is the probability that the ${g.one} ${T.has}?`,
      answer: q(c.ab, whole),
      explanation: [
        `The condition keeps only the ${G.name} circle: ${givenA ? c.a : c.b} + ${c.ab} = ${whole} ${g.many}.`,
        `Inside that circle, the ${c.ab} in the overlap also ${T.have}.`,
        `The probability is ${ratio(c.ab, whole)}.`,
      ],
      hint: `The condition shrinks the sample space from ${n} to the ${G.name} circle alone. Count that circle, then the part of it that is also in ${T.name}.`,
      tags: ["venn", givenA ? "given-first" : "given-second"],
      figure: vennOf(g, n)
        .regions(c)
        .scene({
          title: `Venn diagram of ${n} ${g.many}`,
          steps: [
            step(
              `Given that the ${g.one} ${G.has}: only the ${G.name} circle is possible now.`,
              ...shade(givenA ? ["b", "none"] : ["a", "none"], "empty"),
              ...shade(givenA ? ["a", "ab"] : ["b", "ab"], "accent-fill"),
            ),
            step(
              `Within it, the overlap holds those who also ${T.have}.`,
              ...shade(["ab"], "gold-fill"),
              act.highlight("v.count.ab"),
            ),
            lessonStep(
              `${c.ab} of the ${whole} in the ${G.name} circle: ${ratio(c.ab, whole)}.`,
            ),
          ],
        }),
    };
  }
  if (mode === 2) {
    let n: number,
      A: NumberEvent,
      B: NumberEvent,
      inB: number[],
      both: number[];
    do {
      n = pick(r, [12, 15, 20, 24, 30]);
      [A, B] = numberEvents(r, n);
      inB = range(n).filter(B.holds);
      both = inB.filter(A.holds);
    } while (inB.length < 2);
    return {
      prompt: `A whole number from 1 to ${n} is chosen at random. Given that ${B.text}, what is the probability that ${A.text.replace("the number", "it")}?`,
      answer: q(both.length, inB.length),
      explanation: [
        `The condition leaves ${inB.length} equally likely outcomes: ${listed(inB)}.`,
        both.length === 0
          ? "None of those makes the event true."
          : both.length === 1
            ? `Only ${both[0]} makes the event true.`
            : `${both.length} of those make the event true: ${listed(both)}.`,
        `The probability is ${ratio(both.length, inB.length)}.`,
      ],
      hint: `List the numbers from 1 to ${n} for which ${B.text}. That list is the new sample space; count the ones for which ${A.text}.`,
      tags: ["listed"],
    };
  }
  // From P(A and B) and P(B).
  const asDecimal = r(0, 1) === 1;
  const pB = asDecimal ? q(r(2, 9), 10) : q(r(1, 4), 5);
  const pGiven = asDecimal ? q(r(1, 9), 10) : q(r(1, 3), 4);
  const pAB = mul(pB, pGiven);
  const show = (v: Rational) => (asDecimal ? decimal(v) : frac(v));
  return {
    prompt: `For two events $A$ and $B$, ${math(`P(A and B) = ${show(pAB)}`)} and ${math(`P(B) = ${show(pB)}`)}. Find ${math("P(A | B)")}.`,
    answer: pGiven,
    explanation: [
      `${math("P(A | B)")} is the share of B's probability that also lies in A: ${math("P(A | B) = P(A and B) ÷ P(B)")}.`,
      `${math(`P(A | B) = ${show(pAB)} ÷ ${show(pB)} = ${show(pGiven)}`)}.`,
    ],
    hint: `Given B, the sample space shrinks to B, which has probability ${show(pB)}. Find what share of it the overlap, ${show(pAB)}, is.`,
    tags: ["formula", asDecimal ? "decimal" : "fraction"],
  };
}

// --------------------------------------------------- multiplication rule
type Story = {
  stages: [[string, string], [string, string]];
  intro: (p: string, q1: string, q2: string) => string;
  ask: (i: number, j: number) => string;
  total: string;
};
const stories: readonly Story[] = [
  {
    stages: [
      ["Rain", "No rain"],
      ["Late", "On time"],
    ],
    intro: (p, q1, q2) =>
      `On a school morning, the probability of rain is ${p}. When it rains, the bus is late with probability ${q1}; when it does not rain, the bus is late with probability ${q2}.`,
    ask: (i, j) =>
      `${i ? "it does not rain" : "it rains"} and the bus is ${j ? "on time" : "late"}`,
    total: "the bus is late",
  },
  {
    stages: [
      ["Make", "Miss"],
      ["Make", "Miss"],
    ],
    intro: (p, q1, q2) =>
      `A basketball player makes a first free throw with probability ${p}. After a make, the player makes the second with probability ${q1}; after a miss, with probability ${q2}.`,
    ask: (i, j) =>
      i === j
        ? `the player ${i ? "misses" : "makes"} both free throws`
        : `the player ${i ? "misses" : "makes"} the first free throw and ${j ? "misses" : "makes"} the second`,
    total: "the player makes the second free throw",
  },
  {
    stages: [
      ["Machine A", "Machine B"],
      ["Defective", "Good"],
    ],
    intro: (p, q1, q2) =>
      `A randomly chosen part from a factory comes from machine A with probability ${p} and from machine B otherwise. A part from machine A is defective with probability ${q1}; a part from machine B is defective with probability ${q2}.`,
    ask: (i, j) =>
      `a randomly chosen part comes from machine ${i ? "B" : "A"} and is ${j ? "not defective" : "defective"}`,
    total: "a randomly chosen part is defective",
  },
];
/** Light each path's branches, then its product; lessons reveal the values
 * (and add the paths when there are two). */
function pathSteps(
  paths: [number, number][],
  captions: [string, string],
): Step[] {
  const ink = (target: string): Action => ({
    do: "fill",
    target,
    ink: "accent",
  });
  const leaves = paths.map(([a, b]) => `{tr.leaf.${a}.${b}}`);
  return [
    step(
      captions[0],
      ...paths.map(([a]) => ink(`tr.b1.${a}`)),
      ...paths.map(([a]) => act.highlight(`tr.p1.${a}`)),
    ),
    step(
      captions[1],
      ...paths.map(([a, b]) => ink(`tr.b2.${a}.${b}`)),
      ...paths.map(([a, b]) => act.highlight(`tr.p2.${a}.${b}`)),
    ),
    step(
      paths.length > 1
        ? "Multiply along each path, then add the paths."
        : "Multiply along the path.",
      ...paths.map(([a, b]) => act.highlight(`tr.leaf.${a}.${b}`)),
    ),
    lessonStep(
      paths
        .map(
          ([a, b]) => `{tr.p1.${a}} × {tr.p2.${a}.${b}} = {tr.leaf.${a}.${b}}`,
        )
        .join("; ") +
        (paths.length > 1 ? `. Add: ${leaves.join(" + ")}.` : "."),
      ...paths.map(([a, b]) => act.highlight(`tr.leaf.${a}.${b}`)),
    ),
  ];
}
function multiplicationCase(r: Random): Case {
  const mode = r(0, 3);
  if (mode === 0) {
    const red = r(2, 9),
      blue = r(2, 9),
      n = red + blue;
    const ask = pick(r, [
      "both-red",
      "both-blue",
      "red-blue",
      "different",
    ] as const);
    const path = (x: "R" | "B", y: "R" | "B") => {
      const first = x === "R" ? red : blue;
      const second = (y === "R" ? red : blue) - (x === y ? 1 : 0);
      return { first, second, value: q(first * second, n * (n - 1)) };
    };
    const rr = path("R", "R"),
      bb = path("B", "B"),
      rb = path("R", "B"),
      br = path("B", "R");
    const step = (label: string, p: ReturnType<typeof path>) =>
      `${label}: ${p.first}/${n} × ${p.second}/${n - 1} = ${p.first * p.second}/${n * (n - 1)}`;
    const answer =
      ask === "both-red"
        ? rr.value
        : ask === "both-blue"
          ? bb.value
          : ask === "red-blue"
            ? rb.value
            : add(rb.value, br.value);
    const phrase = {
      "both-red": "both marbles are red",
      "both-blue": "both marbles are blue",
      "red-blue": "the first marble is red and the second is blue",
      different: "the two marbles are different colors",
    }[ask];
    const explanation =
      ask === "different"
        ? [
            `Different colors happens on two paths: red then blue, or blue then red.`,
            `${step("Red then blue", rb)}. ${step("Blue then red", br)}.`,
            `The paths cannot both happen, so add them: ${rb.first * rb.second}/${n * (n - 1)} + ${br.first * br.second}/${n * (n - 1)} = ${ratio(rb.first * rb.second + br.first * br.second, n * (n - 1))}.`,
          ]
        : [
            `The first draw has ${n} marbles. After it, ${n - 1} remain, and the second draw's chances depend on what was taken.`,
            `${ask === "both-red" ? step("Red, then red", rr) : ask === "both-blue" ? step("Blue, then blue", bb) : step("Red, then blue", rb)}.`,
            `The probability is ${frac(answer)}.`,
          ];
    return {
      prompt: `A bag holds ${red} red and ${blue} blue marbles. Two marbles are drawn at random, one after the other, without replacement. What is the probability that ${phrase}?`,
      answer,
      explanation,
      hint:
        ask === "different"
          ? `Red then blue starts with ${red} red out of the ${red + blue}; blue then red starts with ${blue} blue. Find each second draw from the marbles left, multiply along each path, then add the paths.`
          : `The first draw takes one of ${ask === "both-blue" ? `${blue} blue` : `${red} red`} marbles out of ${red + blue}. For the second, one ${ask === "both-blue" ? "blue" : "red"} marble is gone: count again among the marbles left, then multiply the two chances.`,
      tags: ["marbles", ask],
      figure: tree([
        {
          label: "R",
          p: `${red}/${n}`,
          children: [
            { label: "R", p: `${red - 1}/${n - 1}`, derived: true },
            { label: "B", p: `${blue}/${n - 1}`, derived: true },
          ],
        },
        {
          label: "B",
          p: `${blue}/${n}`,
          children: [
            { label: "R", p: `${red}/${n - 1}`, derived: true },
            { label: "B", p: `${blue - 1}/${n - 1}`, derived: true },
          ],
        },
      ])
        .id("tr")
        .products()
        .scene({
          title: "Tree of two draws",
          steps: pathSteps(
            ask === "both-red"
              ? [[0, 0]]
              : ask === "both-blue"
                ? [[1, 1]]
                : ask === "red-blue"
                  ? [[0, 1]]
                  : [
                      [0, 1],
                      [1, 0],
                    ],
            [
              `The first draw is from all ${n} marbles.`,
              `The second draw is from the ${n - 1} left: one marble is gone.`,
            ],
          ),
        }),
    };
  }
  if (mode === 1) {
    const s = pick(r, stories);
    const asDecimal = r(0, 1) === 1;
    const draw = () => (asDecimal ? q(r(1, 9), 10) : q(r(1, 4), 5));
    const p = asDecimal ? q(r(2, 8), 10) : q(r(1, 4), 5);
    const q1 = draw();
    // The second stage depends on the first: its two branches differ.
    let q2 = draw();
    while (q2.n * q1.d === q1.n * q2.d) q2 = draw();
    const show = (v: Rational) => (asDecimal ? decimal(v) : frac(v));
    const total = r(0, 2) === 0;
    const i = r(0, 1),
      j = r(0, 1);
    const first = [p, sub(one, p)],
      second = [
        [q1, sub(one, q1)],
        [q2, sub(one, q2)],
      ];
    const leaf = (a: number, b: number) => mul(first[a]!, second[a]![b]!);
    const answer = total ? add(leaf(0, 0), leaf(1, 0)) : leaf(i, j);
    const paths: [number, number][] = total
      ? [
          [0, 0],
          [1, 0],
        ]
      : [[i, j]];
    const figure = tree(
      [0, 1].map((a) => ({
        label: s.stages[0][a]!,
        p: show(first[a]!),
        derived: a === 1,
        children: [0, 1].map((b) => ({
          label: s.stages[1][b]!,
          p: show(second[a]![b]!),
          derived: b === 1,
        })),
      })),
    )
      .id("tr")
      .products()
      .scene({
        title: "Probability tree",
        steps: pathSteps(paths, [
          `Follow ${paths.map(([a, b]) => `${s.stages[0][a]}, then ${s.stages[1][b]}`).join("; and ")}.`,
          paths.some(([a, b]) => a === 1 || b === 1)
            ? "A branch the story does not state is 1 minus its partner."
            : "Each second branch is a probability given the first.",
        ]),
      });
    const pathText = (a: number, b: number) =>
      `${show(first[a]!)} × ${show(second[a]![b]!)} = ${show(leaf(a, b))}`;
    // A branch the story does not state is 1 minus its partner.
    const complements: string[] = [];
    if (total || i === 1)
      complements.push(
        math(
          `P(\\text{${s.stages[0][1]}}) = 1 − ${show(p)} = ${show(first[1]!)}`,
        ),
      );
    if (!total && j === 1)
      complements.push(
        math(
          `P(\\text{${s.stages[1][1]} after ${s.stages[0][i]}}) = 1 − ${show(i ? q2 : q1)} = ${show(second[i]![1]!)}`,
        ),
      );
    return {
      prompt: `${s.intro(show(p), show(q1), show(q2))} What is the probability that ${total ? s.total : s.ask(i, j)}?`,
      answer,
      explanation: total
        ? [
            `${cap(s.total)} on two paths: ${s.stages[0][0]} then ${s.stages[1][0]}, and ${s.stages[0][1]} then ${s.stages[1][0]}. ${complements[0]}.`,
            `Multiply along each path: ${pathText(0, 0)}, and ${pathText(1, 0)}.`,
            `The paths do not overlap, so add them: ${show(leaf(0, 0))} + ${show(leaf(1, 0))} = ${show(answer)}.`,
          ]
        : [
            `Follow one path: ${s.stages[0][i]}, then ${s.stages[1][j]}.${complements.length ? ` ${complements.join(". ")}.` : ""}`,
            `Multiply the first branch by the second, which is already a probability given the first: ${pathText(i, j)}.`,
            `The probability is ${show(answer)}.`,
          ],
      hint: total
        ? `Two paths end in ${s.stages[1][0]}: one through ${s.stages[0][0]}, with probability ${show(p)}, and one through ${s.stages[0][1]}. Multiply along each path, then add.`
        : `Follow the ${s.stages[0][i]} branch, then its ${s.stages[1][j]} branch${i === 1 || j === 1 ? "; a missing branch is 1 minus its partner" : ""}. Multiply the two probabilities along that path; the first is ${i ? `1 − ${show(p)}` : show(p)}.`,
      tags: [
        "tree",
        total ? "total" : "joint",
        asDecimal ? "decimal" : "fraction",
      ],
      figure,
    };
  }
  if (mode === 2) {
    const draws = [
      {
        key: "hearts",
        text: "both cards are hearts",
        a: 13,
        b: 12,
        first: "hearts",
        second: "hearts",
      },
      {
        key: "aces",
        text: "both cards are aces",
        a: 4,
        b: 3,
        first: "aces",
        second: "aces",
      },
      {
        key: "red",
        text: "both cards are red",
        a: 26,
        b: 25,
        first: "red cards",
        second: "red cards",
      },
      {
        key: "king-queen",
        text: "the first card is a king and the second is a queen",
        a: 4,
        b: 4,
        first: "kings",
        second: "queens",
      },
      {
        key: "face",
        text: "both cards are face cards (jacks, queens or kings)",
        a: 12,
        b: 11,
        first: "face cards",
        second: "face cards",
      },
    ] as const;
    const d = pick(r, draws);
    const answer = q(d.a * d.b, 52 * 51);
    return {
      prompt: `Two cards are drawn at random, one after the other and without replacement, from a standard deck of 52 cards. What is the probability that ${d.text}?`,
      answer,
      explanation: [
        `The first draw: ${d.a} of the 52 cards work, so its probability is ${d.a}/52.`,
        d.b < d.a
          ? `Given that the first worked, ${d.b} of the remaining 51 cards work.`
          : `Given that the first was a king, all ${d.b} queens remain among the 51 cards.`,
        `Multiply: ${d.a}/52 × ${d.b}/51 = ${ratio(d.a * d.b, 52 * 51)}.`,
      ],
      hint: `Count the ${d.first} among all 52 cards. Then count the ${d.second} among the 51 left after the first card is gone, and multiply the two chances.`,
      tags: ["cards", d.key],
    };
  }
  const asDecimal = r(0, 1) === 1;
  const pA = asDecimal ? q(r(2, 9), 10) : q(r(1, 5), 6);
  const pBA = asDecimal ? q(r(1, 9), 10) : q(r(1, 4), 5);
  const show = (v: Rational) => (asDecimal ? decimal(v) : frac(v));
  return {
    prompt: `For two events $A$ and $B$, ${math(`P(A) = ${show(pA)}`)} and ${math(`P(B | A) = ${show(pBA)}`)}. Find ${math("P(A and B)")}.`,
    answer: mul(pA, pBA),
    explanation: [
      `For both to happen, A must happen, and then B must happen given A: ${math("P(A and B) = P(A) × P(B | A)")}.`,
      `${math(`P(A and B) = ${show(pA)} × ${show(pBA)} = ${show(mul(pA, pBA))}`)}.`,
    ],
    hint: `A happens with probability ${show(pA)}; of that, a share ${show(pBA)} also has B. Take that share of ${show(pA)}.`,
    tags: ["formula", asDecimal ? "decimal" : "fraction"],
  };
}

const builders: Record<string, (r: Random) => Case> = {
  "event-set-count": eventSetCase,
  "addition-rule-probability": additionCase,
  "conditional-probability-value": conditionalCase,
  "multiplication-rule-probability": multiplicationCase,
};

export function probabilityRulesCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const metadata = probabilityRulesTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown probability template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const c = builders[id]!(random(id, seed));
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, 1, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      skillId: metadata.skillId,
      prompt: c.prompt,
      response: c.count
        ? { kind: "number", label: c.count }
        : { kind: "fraction", label: "Exact probability" },
      ...(c.figure
        ? { figure: { kind: "scene" as const, scene: c.figure } }
        : {}),
    },
    answer: answerText(c.answer),
    explanation: c.explanation,
    hint: c.hint,
  };
  return {
    problem,
    tags: c.tags,
    caseKey: `${c.prompt}${JSON.stringify(c.figure ?? null)}`,
  };
}
export const generateProbabilityRulesProblem = (
  id: string,
  seed: string,
): GeneratedProblem => probabilityRulesCase(id, seed).problem;
