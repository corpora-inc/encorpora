import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";

type Random = (low: number, high: number) => number;
type Rational = { n: number; d: number };
type Case = {
  prompt: string;
  answer: Rational;
  explanation: string[];
  /** One step for this instance: its own counts and the first move. */
  hint: string;
  tags: string[];
};

export const combinatoricsTemplates: readonly TemplateMetadata[] = [
  {
    id: "counting-principle",
    version: 1,
    title: "Count with the multiplication principle",
    skillId: "compound-probability",
    gradeBand: "6–8",
    description:
      "Count the outcomes of a sequence of independent choices by multiplying the number of options at each stage.",
  },
  {
    id: "permutation-count",
    version: 1,
    title: "Count ordered arrangements",
    skillId: "permutations-combinations",
    gradeBand: "9–12",
    description:
      "Count ordered selections without repetition as a product of decreasing factors.",
  },
  {
    id: "combination-count",
    version: 1,
    title: "Count unordered selections",
    skillId: "permutations-combinations",
    gradeBand: "9–12",
    description:
      "Count selections in which order does not matter by dividing ordered selections by the number of orders of each group.",
  },
  {
    id: "combination-probability",
    version: 1,
    title: "Probability by counting selections",
    skillId: "permutations-combinations",
    gradeBand: "9–12",
    description:
      "Find the probability of a random selection as favorable groups divided by all equally likely groups.",
  },
  {
    id: "independent-events-probability",
    version: 1,
    title: "Independent events",
    skillId: "independent-events",
    gradeBand: "9–12",
    description:
      "Multiply probabilities of independent events and use complements for neither and at least one.",
  },
  {
    id: "expected-value",
    version: 1,
    title: "Expected value",
    skillId: "expected-value",
    gradeBand: "9–12",
    description:
      "Weight each payoff by its probability and add, subtracting a fixed cost for an expected net gain.",
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
/** Plain fraction text with a typographic minus; the print typesetter renders it. */
const shown = (v: Rational) =>
  `${v.n < 0 ? "−" : ""}${Math.abs(v.n)}${v.d === 1 ? "" : `/${v.d}`}`;
const answerText = (v: Rational) => `${v.n}${v.d === 1 ? "" : `/${v.d}`}`;
const raw = (n: number, d: number) => `${n}/${d}`;
const times = (factors: number[]) => factors.join(" × ");
const falling = (n: number, r: number) =>
  Array.from({ length: r }, (_, i) => n - i);
const product = (factors: number[]) => factors.reduce((a, b) => a * b, 1);
function choose(n: number, r: number) {
  return product(falling(n, r)) / product(falling(r, r));
}
/** Words for the count of a group size, so a sentence never starts with a digit. */
const words = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];
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
const cap = (text: string) => `${text[0]!.toUpperCase()}${text.slice(1)}`;
const count = (n: number) => (n <= 10 ? words[n]! : String(n));
const list = (items: string[]) =>
  items.length < 3
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

const menus = [
  {
    key: "lunch",
    intro: "A café's lunch special has",
    one: "lunch special",
    whole: "lunch specials",
    stages: [
      ["sandwich", "sandwiches"],
      ["soup", "soups"],
      ["drink", "drinks"],
      ["dessert", "desserts"],
    ],
  },
  {
    key: "outfit",
    intro: "An outfit has",
    one: "outfit",
    whole: "outfits",
    stages: [
      ["shirt", "shirts"],
      ["pair of pants", "pairs of pants"],
      ["pair of shoes", "pairs of shoes"],
      ["hat", "hats"],
    ],
  },
  {
    key: "pizza",
    intro: "A pizza order has",
    one: "pizza order",
    whole: "pizza orders",
    stages: [
      ["crust", "crusts"],
      ["sauce", "sauces"],
      ["cheese", "cheeses"],
      ["topping", "toppings"],
    ],
  },
] as const;
const towns = ["Ash", "Birch", "Cedar", "Dale", "Elm"];

function countingCase(r: Random): Case {
  const mode = r(0, 4);
  if (mode === 4) {
    const k = r(2, 4),
      digits = r(0, 2) === 0,
      n = digits ? 10 : r(3, 9),
      symbols = digits
        ? "one of the 10 digits 0 through 9, and digits may repeat"
        : `one of the ${n} letters A through ${String.fromCharCode(64 + n)}, and letters may repeat`;
    const total = n ** k;
    return {
      prompt: `A code has ${k} positions. Each position is ${symbols}. How many different codes are possible?`,
      answer: q(total),
      explanation: [
        `Each of the ${k} positions is a separate stage with ${n} options. Repeats are allowed, so earlier positions do not reduce the options for later ones.`,
        `Every option for one position can follow every arrangement of the earlier positions, so multiply ${k} factors of ${n}: ${times(Array(k).fill(n))} = ${total}.`,
        `There are ${total} different codes.`,
      ],
      hint: `Each of the ${k} positions can be any of the ${n} ${digits ? "digits" : "letters"}, and repeats are allowed, so no position loses an option. Multiply ${k} factors of ${n}.`,
      tags: [`stages-${k}`, "repetition", digits ? "digits" : "letters"],
    };
  }
  const k = r(2, 4),
    counts = Array.from({ length: k }, () => r(2, 8));
  const total = product(counts);
  const explanation: string[] = [];
  let prompt: string, unit: string, key: string, hint: string;
  if (mode === 3) {
    const path = towns.slice(0, k + 1);
    prompt = `A trip goes from ${path[0]} to ${path[k]}, passing through ${list(path.slice(1, k))}${k > 2 ? " in that order" : ""}. ${list(counts.map((c, i) => `${i ? "" : "There are "}${c} roads from ${path[i]} to ${path[i + 1]}`))}. How many different routes are possible?`;
    unit = "routes";
    key = "route";
    hint = `Each of the ${counts[0]} roads from ${path[0]} to ${path[1]} can be followed by any road on the next leg. Multiply the road counts of all ${k} legs.`;
    explanation.push(
      `A route chooses one road for each of the ${k} legs of the trip. Any road on one leg can be followed by any road on the next.`,
    );
    let running = counts[0]!;
    for (let i = 1; i < k; i++) {
      explanation.push(
        `Each of the ${running} ways to reach ${path[i]} continues along any of the ${counts[i]} roads to ${path[i + 1]}: ${running} × ${counts[i]} = ${running * counts[i]!}.`,
      );
      running *= counts[i]!;
    }
  } else {
    const menu = menus[mode]!;
    const stages = menu.stages.slice(0, k);
    prompt = `${menu.intro} ${list(stages.map(([one]) => `one ${one}`))}. There are ${list(counts.map((c, i) => `${c} ${stages[i]![1]}`))} to choose from. How many different ${menu.whole} are possible?`;
    unit = menu.whole;
    key = menu.key;
    hint = `Any of the ${counts[0]} ${stages[0]![1]} can go with any of the ${counts[1]} ${stages[1]![1]}${k > 2 ? ", and so on through every stage" : ""}. Multiply the counts: ${times(counts)}.`;
    explanation.push(
      `Every ${menu.one} combines one choice from each of ${k} stages, and every choice at one stage can be combined with every choice at the others.`,
    );
    let running = counts[0]!;
    for (let i = 1; i < k; i++) {
      explanation.push(
        `Each of the ${running} ${i === 1 ? `${stages[0]![1]}` : "choices so far"} can go with any of the ${counts[i]} ${stages[i]![1]}: ${running} × ${counts[i]} = ${running * counts[i]!}.`,
      );
      running *= counts[i]!;
    }
  }
  explanation.push(
    `All together: ${times(counts)} = ${total}. There are ${total} different ${unit}.`,
  );
  return {
    prompt,
    answer: q(total),
    explanation,
    hint,
    tags: [`stages-${k}`, "distinct-stages", key],
  };
}

const offices = ["president", "vice president", "secretary", "treasurer"];
const places = ["first", "second", "third"];
function permutationCase(r: Random): Case {
  const mode = r(0, 3);
  let n: number,
    k: number,
    prompt: string,
    reason: string,
    positions: string,
    hint: string;
  if (mode === 0) {
    n = r(5, 12);
    k = r(2, 4);
    const slots = offices.slice(0, k);
    prompt = `A club with ${n} members will choose ${list(slots.map((s) => `a ${s}`))}. No member can hold more than one office. In how many different ways can the offices be filled?`;
    reason =
      "Order matters: swapping two members between offices gives a different result.";
    hint = `Order matters here. The ${slots[0]} can be any of the ${n} members; then how many members are left for the ${slots[1]}?`;
    positions = `The ${slots[0]} can be any of the ${n} members. After that, ${n - 1} members remain for the ${slots[1]}${slots
      .slice(2)
      .map((s, i) => `, then ${n - 2 - i} for the ${s}`)
      .join("")}.`;
  } else if (mode === 1) {
    n = r(4, 10);
    k = r(2, 3);
    prompt = `${cap(count(n))} runners finish a race with no ties. In how many different ways can ${list(places.slice(0, k))} places be awarded?`;
    reason =
      "Order matters: the same runners in different places give a different result.";
    hint = `Order matters here. First place can go to any of the ${n} runners; then how many runners are left for second place?`;
    positions = `First place can go to any of the ${n} runners. After that, ${n - 1} runners remain for second place${k > 2 ? `, then ${n - 2} for third place` : ""}.`;
  } else if (mode === 2) {
    n = r(3, 8);
    k = n;
    prompt = `In how many different orders can ${n} different books be arranged in a row on a shelf?`;
    reason =
      "Order matters: the same books in a different left-to-right order form a different arrangement.";
    hint = `The leftmost spot can hold any of the ${n} books, and each later spot has one book fewer. Multiply down to 1.`;
    positions = `The leftmost position can hold any of the ${n} books. Each later position has one fewer book left, down to 1 book for the last position.`;
  } else {
    n = r(4, 9);
    k = Math.min(r(2, 4), n - 1);
    prompt = `${cap(count(k))} of ${n} different photos will be hung in a row of ${k} frames, from left to right. How many different arrangements are possible?`;
    reason =
      "Order matters: the same photos in different frames give a different arrangement, and no photo can fill two frames.";
    hint = `The first frame can hold any of the ${n} photos, and each of the other frames has one photo fewer. Multiply ${k} decreasing factors.`;
    positions = `The first frame can hold any of the ${n} photos. Each later frame has one fewer photo left, so the ${k} frames have ${list(falling(n, k).map(String))} options.`;
  }
  const factors = falling(n, k),
    total = product(factors);
  return {
    prompt,
    answer: q(total),
    explanation: [
      reason,
      positions,
      `Multiply the numbers of options: ${times(factors)} = ${total}.`,
      mode === 2
        ? `This product of every whole number from ${n} down to 1 is written ${n}! and read “${n} factorial”. There are ${total} orders.`
        : `This is the product of ${k} decreasing factors starting at ${n}. There are ${total} ways.`,
    ],
    hint,
    tags: [
      ["offices", "race", "shelf", "frames"][mode]!,
      k === n ? "full-arrangement" : "partial-arrangement",
      `length-${k}`,
    ],
  };
}

function combinationCase(r: Random): Case {
  const mode = r(0, 3);
  let n: number, k: number, prompt: string, item: string, group: string;
  if (mode === 3) {
    n = r(4, 15);
    k = 2;
    prompt = `At a meeting, each of ${n} people shakes hands once with every other person. How many handshakes take place?`;
    item = "people";
    group = "handshake";
  } else {
    n = r(5, 14);
    k = r(2, 5);
    if (k >= n) k = n - 1;
    item = ["students", "toppings", "books"][mode]!;
    group = ["committee", "topping combination", "set of books"][mode]!;
    prompt =
      mode === 0
        ? `A teacher will choose ${k} students from a group of ${n} to form a committee. Every committee member has the same role. How many different committees are possible?`
        : mode === 1
          ? `A pizza will have exactly ${k} different toppings chosen from ${n} available toppings. The order in which toppings are chosen does not matter. How many different topping combinations are possible?`
          : `Maya will pack ${k} of her ${n} different books for a trip. How many different sets of ${k} books can she pack?`;
  }
  const ordered = falling(n, k),
    orders = falling(k, k),
    top = product(ordered),
    bottom = product(orders),
    total = top / bottom;
  return {
    prompt,
    answer: q(total),
    explanation: [
      mode === 3
        ? "A handshake joins 2 people, and it is the same handshake whichever person is named first. Order does not matter."
        : `Order does not matter: choosing the same ${k} ${item} in a different order gives the same ${group}.`,
      `First count ordered selections: ${times(ordered)} = ${top}.`,
      `Each ${group} appears once for every order of its ${k} ${mode === 3 ? "people" : item}: ${times(orders)} = ${bottom} times.`,
      `Divide to count each ${group} once: ${top} ÷ ${bottom} = ${total}.`,
    ],
    hint: `Order does not matter. Count ordered picks of ${k} from ${n} first, ${times(ordered)}; each ${group} is counted once for every order of its ${k} ${mode === 3 ? "people" : item}.`,
    tags: [
      ["committee", "toppings", "books", "handshakes"][mode]!,
      `size-${k}`,
    ],
  };
}

/** Text for an unordered count, with the arithmetic that justifies it. */
function groups(n: number, k: number, what: string) {
  if (k === 0)
    return `There is exactly 1 way to choose none of the ${n} ${what}.`;
  const top = product(falling(n, k)),
    bottom = product(falling(k, k)),
    value = top / bottom;
  if (k === n)
    return `There is exactly 1 way to choose ${n === 2 ? "both" : `all ${n}`} ${what}.`;
  return k === 1
    ? `There are ${n} ways to choose 1 of the ${n} ${what}.`
    : `Choose ${k} of the ${n} ${what}: (${times(falling(n, k))}) ÷ (${times(falling(k, k))}) = ${top} ÷ ${bottom} = ${value} ways.`;
}
function selectionCase(r: Random): Case {
  const club = r(0, 1) === 1,
    a = r(2, 8),
    b = r(2, 8),
    size = Math.min(r(2, 4), a + b - 1),
    low = Math.max(0, size - b),
    high = Math.min(a, size),
    k = r(low, high);
  const [first, second, thing] = club
    ? ["juniors", "seniors", "members"]
    : ["red marbles", "blue marbles", "marbles"];
  const quality = club ? "juniors" : "red";
  const condition =
    k === size
      ? `${size === 2 ? "both" : `all ${size}`} are ${quality}`
      : k === 0
        ? `none of them ${club ? "is a junior" : "is red"}`
        : `exactly ${k} ${club ? (k === 1 ? "is a junior" : "are juniors") : k === 1 ? "is red" : "are red"}`;
  const prompt = club
    ? `A club has ${a} juniors and ${b} seniors. A committee of ${size} members is chosen at random, so every group of ${size} members is equally likely. What is the probability that ${condition}?`
    : `A bag holds ${a} red marbles and ${b} blue marbles. ${words[size]![0]!.toUpperCase()}${words[size]!.slice(1)} marbles are drawn at random at the same time, so every set of ${size} marbles is equally likely. What is the probability that ${condition}?`;
  const all = choose(a + b, size),
    favorable = choose(a, k) * choose(b, size - k),
    answer = q(favorable, all);
  const explanation = [
    `Order does not matter, and every group of ${size} is equally likely. The probability is the number of favorable groups divided by the number of all groups.`,
    `Count all groups. ${groups(a + b, size, thing)}`,
    `Count favorable groups. ${[
      ...(k > 0 ? [groups(a, k, first)] : []),
      ...(size - k > 0 ? [groups(b, size - k, second)] : []),
    ].join(" ")}`,
  ];
  if (k > 0 && size - k > 0)
    explanation.push(
      `Each choice of ${first} can be combined with each choice of ${second}: ${choose(a, k)} × ${choose(b, size - k)} = ${favorable} favorable groups.`,
    );
  explanation.push(
    answer.d === all
      ? `The probability is ${raw(favorable, all)}.`
      : `The probability is ${raw(favorable, all)} = ${shown(answer)}.`,
  );
  return {
    prompt,
    answer,
    explanation,
    hint: `Every group of ${size} is equally likely. Count all groups of ${size} from the ${a + b} ${thing}, then count the groups where ${condition}.`,
    tags: [
      club ? "club" : "marbles",
      k === size ? "all" : k === 0 ? "none" : "mixed",
      `size-${size}`,
      answer.d === all ? "already-reduced" : "reduce",
    ],
  };
}

type Device = {
  name: string;
  intro: string;
  outcomes: (number | string)[];
};
type Event = {
  text: string;
  not: string;
  holds: (x: number | string) => boolean;
  outcomes: string;
};
function numericEvent(r: Random, device: Device): Event {
  const m = device.outcomes.length,
    verb = device.name === "cube" ? "shows" : "lands on",
    negative = device.name === "cube" ? "does not show" : "does not land on";
  const options = [
    "even",
    "odd",
    "greater",
    "less",
    ...(m >= 3 ? ["multiple"] : []),
    "exact",
  ];
  const kind = options[r(0, options.length - 1)]!;
  let phrase: string, holds: (x: number) => boolean;
  if (kind === "even") [phrase, holds] = ["an even number", (x) => x % 2 === 0];
  else if (kind === "odd")
    [phrase, holds] = ["an odd number", (x) => x % 2 === 1];
  else if (kind === "greater") {
    const t = r(1, m - 1);
    [phrase, holds] = [`a number greater than ${t}`, (x) => x > t];
  } else if (kind === "less") {
    const t = r(2, m);
    [phrase, holds] = [`a number less than ${t}`, (x) => x < t];
  } else if (kind === "multiple")
    [phrase, holds] = ["a multiple of 3", (x) => x % 3 === 0];
  else {
    const t = r(1, m);
    [phrase, holds] = [`${t === 8 ? "an" : "a"} ${t}`, (x) => x === t];
  }
  const favorable = (device.outcomes as number[]).filter(holds);
  return {
    text: `the ${device.name} ${verb} ${phrase}`,
    not: `the ${device.name} ${negative} ${phrase}`,
    holds: (x) => holds(x as number),
    outcomes: list(favorable.map(String)),
  };
}
function independentCase(r: Random): Case {
  const cube: Device = {
    name: "cube",
    intro: "A fair number cube with faces numbered 1 through 6 is rolled",
    outcomes: [1, 2, 3, 4, 5, 6],
  };
  const sections = r(3, 10);
  const spinner: Device = {
    name: "spinner",
    intro: `a spinner with ${sections} equal sections numbered 1 through ${sections} is spun`,
    outcomes: Array.from({ length: sections }, (_, i) => i + 1),
  };
  const coin: Device = {
    name: "coin",
    intro: "a fair coin is tossed",
    outcomes: ["heads", "tails"],
  };
  const pair = r(0, 2);
  const [one, two] =
    pair === 0 ? [cube, spinner] : pair === 1 ? [cube, coin] : [spinner, coin];
  const firstIntro =
    one === cube
      ? one.intro
      : `A spinner with ${sections} equal sections numbered 1 through ${sections} is spun`;
  const A = numericEvent(r, one);
  const side = r(0, 1) ? "heads" : "tails";
  const B: Event =
    two === coin
      ? {
          text: `the coin lands ${side} up`,
          not: `the coin does not land ${side} up`,
          holds: (x) => x === side,
          outcomes: side,
        }
      : numericEvent(r, two);
  const question = r(0, 2);
  const countA = one.outcomes.filter(A.holds).length,
    countB = two.outcomes.filter(B.holds).length,
    m = one.outcomes.length,
    n = two.outcomes.length;
  const pA = q(countA, m),
    pB = q(countB, n),
    notA = q(m - countA, m),
    notB = q(n - countB, n);
  const both = q(pA.n * pB.n, pA.d * pB.d),
    neither = q(notA.n * notB.n, notA.d * notB.d),
    atLeast = q(neither.d - neither.n, neither.d);
  const ask =
    question === 0
      ? `${A.text} and ${B.text}`
      : question === 1
        ? `${A.not} and ${B.not}`
        : `at least one of these happens: ${A.text}; ${B.text}`;
  const prompt = `${firstIntro}, and ${two === coin ? coin.intro : spinner.intro}. The two results are independent. What is the probability that ${ask}?`;
  const fraction = (count: number, total: number, value: Rational) =>
    value.d === total
      ? raw(count, total)
      : `${raw(count, total)} = ${shown(value)}`;
  const describe = (
    event: Event,
    count: number,
    total: number,
    value: Rational,
  ) =>
    `${cap(event.text)} for ${count} of the ${total} equally likely outcomes: ${event.outcomes}. Its probability is ${fraction(count, total, value)}.`;
  const explanation = [describe(A, countA, m, pA), describe(B, countB, n, pB)];
  const productText = (x: Rational, y: Rational, z: Rational) => {
    const unreduced = raw(x.n * y.n, x.d * y.d);
    return `${shown(x)} × ${shown(y)} = ${unreduced}${unreduced === shown(z) ? "" : ` = ${shown(z)}`}`;
  };
  let answer: Rational;
  if (question === 0) {
    answer = both;
    explanation.push(
      `Independent means one result does not change the probabilities of the other, so multiply: ${productText(pA, pB, both)}.`,
      `Check by counting pairs: there are ${m} × ${n} = ${m * n} equally likely pairs of results, and ${countA} × ${countB} = ${countA * countB} of them ${countA * countB === 1 ? "is" : "are"} favorable, giving ${fraction(countA * countB, m * n, both)}.`,
    );
  } else {
    explanation.push(
      `Each event fails with probability 1 minus its probability: 1 − ${shown(pA)} = ${shown(notA)} and 1 − ${shown(pB)} = ${shown(notB)}.`,
      `The complements are also independent, so the probability that neither event happens is ${productText(notA, notB, neither)}.`,
    );
    if (question === 1) answer = neither;
    else {
      answer = atLeast;
      explanation.push(
        `At least one happens exactly when it is not true that neither happens. Subtract from 1: 1 − ${shown(neither)} = ${shown(atLeast)}.`,
      );
    }
  }
  explanation.push(`The probability is ${shown(answer)}.`);
  const counts = `The ${one.name} has ${m} equally likely results and the ${two.name} has ${n}.`;
  const hint =
    question === 0
      ? `${counts} Find the probability that ${A.text}, and that ${B.text}; independent results multiply.`
      : question === 1
        ? `${counts} Find the probability that ${A.not}, and that ${B.not}; independent results multiply.`
        : `${counts} “At least one” is everything except “neither”: find the probability that neither happens, then subtract it from 1.`;
  return {
    prompt,
    answer,
    explanation,
    hint,
    tags: [
      ["both", "neither", "at-least-one"][question]!,
      ["cube-spinner", "cube-coin", "spinner-coin"][pair]!,
      answer.d === 1 ? "integer-answer" : "fraction-answer",
    ],
  };
}

function expectedCase(r: Random): Case {
  const n = [4, 5, 6, 8, 10, 12][r(0, 5)]!,
    groupsCount = r(2, 3),
    net = r(0, 1) === 1,
    unit = net ? "tokens" : "points";
  const values = new Set<number>();
  while (values.size < groupsCount) values.add(r(1, 20));
  const prizes = [...values].sort((a, b) => b - a);
  // Sections with a positive prize form a random composition; the rest award 0.
  const zero = r(0, 1) ? 0 : r(1, n - groupsCount),
    awarded = n - zero,
    cuts = new Set<number>();
  while (cuts.size < groupsCount - 1) cuts.add(r(1, awarded - 1));
  const bounds = [0, ...[...cuts].sort((a, b) => a - b), awarded];
  const counts = prizes.map((_, i) => bounds[i + 1]! - bounds[i]!);
  const totalPoints = prizes.reduce((s, v, i) => s + v * counts[i]!, 0),
    payout = q(totalPoints, n);
  // A cost near the expected payout makes gains, losses and break-even games all occur.
  const near = Math.floor(totalPoints / n),
    cost = net ? r(Math.max(1, near - 2), near + 3) : 0;
  const amount = (v: number) => `${v} ${v === 1 ? unit.slice(0, -1) : unit}`;
  const clauses = prizes.map(
    (v, i) =>
      `${counts[i]} ${counts[i] === 1 ? "section awards" : "sections award"} ${amount(v)}`,
  );
  if (zero)
    clauses.push(
      `the other ${zero} ${zero === 1 ? "section awards" : "sections award"} 0 ${unit}`,
    );
  const spinner = `${n} equal sections: ${list(clauses)}`;
  const prompt = net
    ? `A game costs ${amount(cost)} to play. The player spins a spinner that has ${spinner}. What is the expected net gain, in tokens, from one play? Give a loss as a negative number.`
    : `A spinner has ${spinner}. What is the expected number of points from one spin?`;
  const all = [...prizes, ...(zero ? [0] : [])],
    allCounts = [...counts, ...(zero ? [zero] : [])];
  const answer = q(totalPoints - cost * n, n);
  const products = all
      .map((v, i) => `${v} × ${raw(allCounts[i]!, n)}`)
      .join(" + "),
    terms = all.map((v, i) => raw(v * allCounts[i]!, n)).join(" + ");
  const explanation = [
    `Each of the ${n} equal sections has probability ${raw(1, n)}. The probabilities are: ${all.map((v, i) => `${amount(v)}, ${raw(allCounts[i]!, n)}`).join("; ")}.`,
    `Multiply each payoff by its probability and add: ${products} = ${terms} = ${raw(totalPoints, n)}${payout.d === n ? "" : ` = ${shown(payout)}`}.`,
  ];
  if (net)
    explanation.push(
      `The cost of ${amount(cost)} is paid on every play, so subtract it once from the expected payout: ${shown(payout)} − ${cost} = ${shown(answer)}.`,
      answer.n < 0
        ? `The expected net gain is ${shown(answer)} ${-answer.n <= answer.d ? "token" : "tokens"}. Over many plays, a player loses ${shown(q(-answer.n, answer.d))} ${-answer.n <= answer.d ? "token" : "tokens"} per play on average.`
        : answer.n === 0
          ? "The expected net gain is 0 tokens. Over many plays, gains and losses balance on average."
          : `The expected net gain is ${shown(answer)} ${answer.n <= answer.d ? "token" : "tokens"}. Over many plays, the average gain per play approaches this value.`,
    );
  else
    explanation.push(
      `The expected value is ${shown(answer)} ${answer.n <= answer.d ? "point" : "points"}. Over many spins, the average number of points per spin approaches this value.`,
    );
  return {
    prompt,
    answer,
    explanation,
    hint: `Each of the ${n} equal sections has probability 1/${n}. Multiply each payoff by its probability and add${net ? `, then subtract the cost of ${amount(cost)} once` : ""}.`,
    tags: [
      net ? "net" : "payout",
      ...(net
        ? [answer.n < 0 ? "negative" : answer.n === 0 ? "zero" : "positive"]
        : []),
      zero ? "zero-sections" : "no-zero-sections",
      `groups-${groupsCount}`,
      answer.d === 1 ? "integer-answer" : "fraction-answer",
    ],
  };
}

const builders: Record<string, (r: Random) => Case> = {
  "counting-principle": countingCase,
  "permutation-count": permutationCase,
  "combination-count": combinationCase,
  "combination-probability": selectionCase,
  "independent-events-probability": independentCase,
  "expected-value": expectedCase,
};
const countingTemplates = new Set([
  "counting-principle",
  "permutation-count",
  "combination-count",
]);
const labels: Record<string, string> = {
  "counting-principle": "Number of possibilities",
  "permutation-count": "Number of ways",
  "combination-count": "Number of groups",
  "combination-probability": "Exact probability",
  "independent-events-probability": "Exact probability",
  "expected-value": "Exact expected value",
};

export function combinatoricsPrintCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const metadata = combinatoricsTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown combinatorics template ${id}`);
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
      response: {
        kind: countingTemplates.has(id) ? "number" : "fraction",
        label: labels[id]!,
      },
    },
    answer: answerText(c.answer),
    explanation: c.explanation,
    hint: c.hint,
  };
  // The prompt states every given, so equal prompts are the same case.
  return { problem, tags: c.tags, caseKey: c.prompt };
}
export const generateCombinatoricsProblem = (
  id: string,
  seed: string,
): GeneratedProblem => combinatoricsPrintCase(id, seed).problem;
