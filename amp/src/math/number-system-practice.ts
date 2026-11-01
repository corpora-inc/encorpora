import { count as plural } from "./agreement";
import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { longDivisionSteps } from "./long-division";

/** Grade 6–7 number system: factors and multiples, division, signed numbers and signed stories. */
export const numberSystemTemplates: readonly TemplateMetadata[] = [
  {
    id: "greatest-common-factor",
    version: 1,
    title: "Greatest common factor",
    skillId: "gcf-lcm",
    gradeBand: "6–8",
    description:
      "Find the greatest common factor of two whole numbers up to 100, bare or as the most identical sets or the largest square tile.",
  },
  {
    id: "least-common-multiple",
    version: 1,
    title: "Least common multiple",
    skillId: "gcf-lcm",
    gradeBand: "6–8",
    description:
      "Find the least common multiple of two whole numbers from 2 to 12, bare or as matching packages or repeating times.",
  },
  {
    id: "gcf-factor-sum",
    version: 1,
    requiredResponseCapability: "single-choice-v1",
    title: "Factor out the greatest common factor",
    skillId: "gcf-lcm",
    gradeBand: "6–8",
    description:
      "Choose the distributive form of a sum of two whole numbers that factors out their greatest common factor.",
  },
  {
    id: "long-division-quotient",
    version: 1,
    title: "Divide with the standard algorithm",
    skillId: "integer-division",
    gradeBand: "6–8",
    description:
      "Divide a whole number of up to five digits by a two-digit divisor with an exact quotient.",
  },
  {
    id: "division-remainder-story",
    version: 1,
    title: "What the remainder means",
    skillId: "integer-division",
    gradeBand: "6–8",
    description:
      "Divide in a story and decide whether the remainder needs one more group, is left out, or is the answer.",
  },
  {
    id: "signed-quantity",
    version: 1,
    title: "Signed numbers for opposite directions",
    skillId: "signed-numbers",
    gradeBand: "6–8",
    description:
      "Write a signed number for a quantity in context, or for the opposite of a given signed quantity.",
  },
  {
    id: "opposite-on-line",
    version: 1,
    title: "Opposites on a number line",
    skillId: "signed-numbers",
    gradeBand: "6–8",
    description:
      "Read an integer marked on a number line and find its opposite or the opposite of its opposite.",
  },
  {
    id: "signed-story",
    version: 1,
    title: "Signed-number stories",
    skillId: "rational-stories",
    gradeBand: "6–8",
    description:
      "Solve multistep temperature, elevation and account-balance stories with signed decimals exactly.",
  },
  {
    id: "signed-jumps",
    version: 1,
    title: "Signed changes as jumps",
    skillId: "rational-stories",
    gradeBand: "6–8",
    description:
      "Add signed changes shown as arrows on a number line, starting from a signed decimal.",
  },
];

type Random = (low: number, high: number) => number;
type Choice = { label: string; correct?: true; feedback?: string };
type Case = {
  prompt: string;
  answer: string;
  explanation: string[];
  tags: string[];
  figure?: SemanticFigure;
  choices?: Choice[];
  /** One teaching step from this problem's givens; defaults to the first explanation step. */
  hint?: string;
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
const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
const list = (items: (string | number)[]) =>
  items.length < 3
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const factorsOf = (n: number) =>
  Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;

/** Exact decimals are integer hundredths; text uses a typographic minus. */
function decimal(h: number, places?: 2) {
  const sign = h < 0 ? "−" : "",
    a = Math.abs(h),
    whole = Math.floor(a / 100),
    cents = a % 100;
  if (places === 2) return `${sign}${whole}.${String(cents).padStart(2, "0")}`;
  if (!cents) return `${sign}${whole}`;
  return `${sign}${whole}.${String(cents).padStart(2, "0").replace(/0$/, "")}`;
}
/** A signed operand inside a sum: negatives in parentheses. */
const operand = (h: number, places?: 2) =>
  h < 0 ? `(${decimal(h, places)})` : decimal(h, places);
/** Plain ASCII answer text that normalizeAnswer reads exactly. */
const answerText = (h: number) => decimal(h).replace("−", "-");
const signed = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
const meters = (h: number) =>
  `${decimal(h)} ${Math.abs(h) === 100 ? "meter" : "meters"}`;
const change = (h: number) => (h < 0 ? decimal(h) : `+${decimal(h)}`);

function gcfCase(r: Random): Case {
  const mode = pick(r, ["bare", "bare", "bare", "sets", "sets", "tiles"]);
  const coprime = mode === "bare" && r(0, 7) === 0;
  let g = 1,
    m = 0,
    n = 0;
  for (;;) {
    g = coprime ? 1 : r(2, 25);
    const low = coprime ? 10 : 1,
      cap = Math.floor(100 / g);
    m = r(low, cap);
    n = r(low, cap);
    // Keep "one number divides the other" to a minority of items.
    if (Math.min(m, n) === 1 && r(0, 2) !== 0) continue;
    if (m !== n && gcd(m, n) === 1 && Math.max(g * m, g * n) >= 12) break;
  }
  const a = g * m,
    b = g * n,
    fa = factorsOf(a),
    fb = factorsOf(b),
    common = fa.filter((d) => b % d === 0);
  const factorSteps = [
    `The factors of ${a} are ${list(fa)}.`,
    `The factors of ${b} are ${list(fb)}.`,
    common.length === 1
      ? `The only common factor is 1.`
      : `The common factors are ${list(common)}. The greatest is ${g}.`,
  ];
  const tags = [
    mode,
    coprime ? "coprime" : Math.min(m, n) === 1 ? "divides" : "proper",
  ];
  if (mode === "sets") {
    const [who, first, second, set] = pick(r, [
      ["A coach", ["ball", "balls"], ["cone", "cones"], ["set", "sets"]],
      [
        "A baker",
        ["muffin", "muffins"],
        ["cookie", "cookies"],
        ["box", "boxes"],
      ],
      [
        "A florist",
        ["rose", "roses"],
        ["tulip", "tulips"],
        ["bouquet", "bouquets"],
      ],
    ] as const);
    const [one, many] = first,
      [setOne, setMany] = set;
    return {
      prompt: `${who} has ${a} ${many} and ${b} ${second[1]} to split into identical ${setMany} with none left over. What is the greatest number of ${setMany} that can be made?`,
      answer: String(g),
      hint: `The number of ${setMany} must divide both ${a} and ${b} with none left over. List the factors of each number and find the greatest one they share.`,
      explanation: [
        `Every ${setOne} gets the same share of each item, so the number of ${setMany} must divide both ${a} and ${b}: it is a common factor.`,
        ...factorSteps,
        `With ${plural(g, setOne, setMany)}, each ${setOne} gets ${a} ÷ ${g} = ${plural(m, one, many)} and ${b} ÷ ${g} = ${plural(n, second[0], second[1])}. The greatest number of ${setMany} is ${g}.`,
      ],
      tags,
    };
  }
  if (mode === "tiles")
    return {
      prompt: `A rectangular floor is ${a} feet by ${b} feet. What is the largest whole number of feet that can be the side of square tiles covering it with no tiles cut?`,
      answer: String(g),
      hint: `A tile side that fits with no cuts divides both ${a} and ${b}. List the factors of each number and find the greatest one they share.`,
      explanation: [
        `Square tiles of side $s$ fit exactly along both edges when $s$ divides both ${a} and ${b}, so $s$ must be a common factor.`,
        ...factorSteps,
        `Tiles with side ${g} feet make ${a} ÷ ${g} = ${plural(m, "tile", "tiles")} along one edge and ${b} ÷ ${g} = ${plural(n, "tile", "tiles")} along the other. The largest side length is ${g} feet.`,
      ],
      tags,
    };
  return {
    prompt: `What is the greatest common factor of ${a} and ${b}?`,
    answer: String(g),
    hint: `List the factors of ${a} and the factors of ${b}, in pairs from 1 up. Find the greatest number on both lists.`,
    explanation: [
      `A factor of a number divides it with no remainder. The greatest common factor of two numbers is the largest number that is a factor of both.`,
      `List each number's factors in pairs from 1 up, so none is missed.`,
      ...factorSteps.slice(0, 2),
      common.length === 1
        ? `The only common factor is 1, so the greatest common factor of ${a} and ${b} is 1.`
        : `The common factors are ${list(common)}, so the greatest common factor of ${a} and ${b} is ${g}.`,
    ],
    tags,
  };
}

function lcmCase(r: Random): Case {
  let a = 0,
    b = 0;
  do {
    a = r(2, 12);
    b = r(2, 12);
  } while (a === b);
  const big = Math.max(a, b),
    small = Math.min(a, b),
    lcm = (a * b) / gcd(a, b),
    multiples = Array.from({ length: lcm / big }, (_, i) => big * (i + 1));
  const mode = pick(r, ["bare", "bare", "packs", "together"]);
  const listing = [
    `A multiple of a number is that number times 1, 2, 3 and so on. Listing the larger number's multiples reaches a shared one fastest.`,
    `Multiples of ${big}: ${list(multiples)}.`,
    multiples.length === 1
      ? `${big} is itself a multiple of ${small}: ${big} = ${small} × ${big / small}.`
      : multiples.length === 2
        ? `${small} does not divide ${big}, but ${lcm} = ${small} × ${lcm / small}.`
        : `${small} divides none of ${multiples.slice(0, -2).join(", ")} or ${multiples.at(-2)}, but ${lcm} = ${small} × ${lcm / small}.`,
  ];
  const tags = [
    mode,
    big % small === 0 ? "divides" : gcd(a, b) === 1 ? "coprime" : "shared",
  ];
  const hint = `List multiples of the larger number, ${big}, in order. Stop at the first one that ${small} also divides.`;
  if (mode === "packs") {
    const [first, second] = pick(r, [
      [
        ["hot dog", "hot dogs"],
        ["bun", "buns"],
      ],
      [
        ["cup", "cups"],
        ["plate", "plates"],
      ],
      [
        ["juice box", "juice boxes"],
        ["granola bar", "granola bars"],
      ],
    ] as const);
    return {
      prompt: `${first[1][0]!.toUpperCase()}${first[1].slice(1)} come in packs of ${a} and ${second[1]} come in packs of ${b}. What is the least number of each you can buy to have equal numbers of ${first[1]} and ${second[1]}?`,
      answer: String(lcm),
      hint,
      explanation: [
        `Whole packs give multiples of ${a} ${first[1]} and multiples of ${b} ${second[1]}. The amounts must be equal, so the number is a common multiple of ${a} and ${b}.`,
        ...listing,
        `The least common multiple is ${lcm}: ${lcm / a} ${lcm / a === 1 ? "pack" : "packs"} of ${first[1]} and ${lcm / b} ${lcm / b === 1 ? "pack" : "packs"} of ${second[1]}. The least number of each is ${lcm}.`,
      ],
      tags,
    };
  }
  if (mode === "together") {
    const [things, verb, unit] = pick(r, [
      ["lights", "flash", "seconds"],
      ["bells", "ring", "minutes"],
    ] as const);
    return {
      prompt:
        `Two ${things} ${verb} together now. One ${verb}es every ${a} ${unit} and the other every ${b} ${unit}. In how many ${unit} will they next ${verb} together?`.replace(
          "ringes",
          "rings",
        ),
      answer: String(lcm),
      hint,
      explanation: [
        `The first ${verb}es at multiples of ${a} ${unit} and the second at multiples of ${b} ${unit}, so they ${verb} together at common multiples.`.replace(
          "ringes",
          "rings",
        ),
        ...listing,
        `The least common multiple is ${lcm}, so they next ${verb} together in ${lcm} ${unit}.`,
      ],
      tags,
    };
  }
  return {
    prompt: `What is the least common multiple of ${a} and ${b}?`,
    answer: String(lcm),
    hint,
    explanation: [
      `The least common multiple of two numbers is the smallest number that is a multiple of both.`,
      ...listing,
      `The first multiple of ${big} that ${small} also divides is ${lcm}, so the least common multiple of ${a} and ${b} is ${lcm}.`,
    ],
    tags,
  };
}

function factorSumCase(r: Random): Case {
  let g = 0,
    m = 0,
    n = 0;
  do {
    g =
      r(0, 3) === 0
        ? pick(r, [2, 3, 5, 7, 11, 13])
        : pick(r, [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20]);
    const cap = Math.floor(100 / g);
    m = r(1, cap);
    n = r(1, cap);
  } while (m === n || gcd(m, n) !== 1 || (g * m < 10 && g * n < 10));
  const a = g * m,
    b = g * n,
    p = factorsOf(g)[1]!,
    d = g / p;
  const form = (k: number, x: number | string, y: number | string) =>
    `${k}(${x} + ${y})`;
  const correct = form(g, m, n);
  const choices: Choice[] = [
    { label: correct, correct: true },
    {
      label: form(d, a / d, b / d),
      feedback:
        d === 1
          ? `1(${a} + ${b}) equals ${a} + ${b}, but 1 is not the greatest common factor: ${a} and ${b} share the factor ${g}.`
          : `${d} is a common factor and ${form(d, a / d, b / d)} equals ${a} + ${b}, but ${a / d} and ${b / d} still share the factor ${p}, so ${d} is not the greatest.`,
    },
    {
      label: form(g, m, b),
      feedback: `${form(g, m, b)} = ${g * m} + ${g * b}, not ${a} + ${b}. Divide both numbers by ${g}, not only ${a}.`,
    },
    {
      label: form(g, a, n),
      feedback: `${form(g, a, n)} = ${g * a} + ${g * n}, not ${a} + ${b}. Divide both numbers by ${g}, not only ${b}.`,
    },
  ];
  return {
    prompt: `Use the distributive property to write ${a} + ${b} as the greatest common factor of ${a} and ${b} times a sum. Which expression is it?`,
    answer: correct,
    hint: `Find the greatest common factor of ${a} and ${b}, then divide each number by it. The quotients go inside the parentheses.`,
    explanation: [
      `The greatest common factor of two numbers is the largest number that divides both with no remainder.`,
      `${a} = ${g} × ${m} and ${b} = ${g} × ${n}. The quotients ${m} and ${n} share no factor greater than 1, so ${g} is the greatest common factor.`,
      `The distributive property says a shared factor can be pulled out of a sum: ${g} × ${m} + ${g} × ${n} = ${g} × (${m} + ${n}).`,
      `Check: ${correct} = ${g} × ${m + n} = ${a + b}, the value of ${a} + ${b}.`,
      `The expression is ${correct}.`,
    ],
    tags: [d === 1 ? "prime-gcf" : "composite-gcf"],
    choices,
  };
}

function longDivisionCase(r: Random): Case {
  const shape = pick(r, ["two", "three", "three", "zero"]);
  const d = r(12, 98);
  let q: number;
  if (shape === "two") q = r(21, 99);
  else if (shape === "three") {
    do q = r(102, 999);
    while (String(q).includes("0"));
  } else q = r(1, 9) * 100 + (r(0, 1) ? r(1, 9) : 10 * r(1, 9));
  const n = d * q,
    context = r(0, 3) === 0;
  const prompt = context
    ? `A school orders ${n} sheets of paper packed equally into ${d} boxes. How many sheets are in each box?`
    : `What is ${n} ÷ ${d}?`;
  const steps = longDivisionSteps(n, d);
  const explanation = [
    `Long division works one place at a time from the left, because each digit of the quotient answers how many times ${d} fits so far.`,
  ];
  explanation.push(
    ...steps.map((s, i) => {
      const lead =
        i === 0
          ? `${s.partial} is the first part of ${n} that is at least ${d}.`
          : `Bring down ${steps[i - 1]!.broughtDown}, making ${s.partial}.`;
      if (s.digit === 0)
        return `${lead} ${s.partial} is less than ${d}, so write 0 in the quotient.`;
      const next =
        s.digit < 9
          ? ` and ${d} × ${s.digit + 1} = ${d * (s.digit + 1)} is more than ${s.partial}`
          : "";
      return `${lead} Try ${d} × ${s.digit} = ${s.product}${next}. Write ${s.digit} in the quotient; ${s.partial} − ${s.product} = ${s.rest}.`;
    }),
  );
  explanation.push(
    `The remainder, what is left after the last subtraction, is 0. Check by multiplying back: ${q} × ${d} = ${n}.`,
    context ? `Each box holds ${q} sheets.` : `So ${n} ÷ ${d} = ${q}.`,
  );
  return {
    prompt,
    answer: String(q),
    hint: `Start with ${steps[0]!.partial}, the first part of ${n} that is at least ${d}. How many times does ${d} go into ${steps[0]!.partial}? Write that digit, multiply, subtract, then bring down the next digit.`,
    explanation,
    tags: [
      shape === "two" ? "two-digit-quotient" : "three-digit-quotient",
      ...(String(q).includes("0") ? ["zero-digit"] : []),
      context ? "context" : "bare",
    ],
  };
}

function remainderCase(r: Random): Case {
  const mode = pick(r, ["up", "down", "left"] as const);
  let d: number, q: number, rest: number, n: number;
  do {
    d = r(12, 60);
    q = r(5, 160);
    rest = r(1, d - 1);
    n = d * q + rest;
  } while (n > 9999);
  const divide = `${n} ÷ ${d} is ${q} with remainder ${rest}, because ${d} × ${q} = ${d * q} and ${n} − ${d * q} = ${rest}.`;
  const hint = `Divide ${n} by ${d}, keeping the remainder. Then decide what the story asks for: the quotient, one more than the quotient, or the remainder.`;
  if (mode === "up") {
    const [prompt, group, groups, item, items, verb] = pick(r, [
      [
        `A school is taking ${n} students on a trip. Each bus holds ${d} students. How many buses are needed to carry every student?`,
        "bus",
        "buses",
        "student",
        "students",
        "carry",
      ],
      [
        `An album holds ${d} photos on each page. How many pages are needed to hold all ${n} photos?`,
        "page",
        "pages",
        "photo",
        "photos",
        "hold",
      ],
    ] as const);
    return {
      prompt,
      answer: String(q + 1),
      hint,
      explanation: [
        divide,
        `The quotient counts full groups, and the remainder counts what is left over.`,
        `${q} full ${groups} ${verb} ${d * q} ${items}, and ${plural(rest, item, items)} would be left out, so one more ${group} is needed: ${q} + 1 = ${q + 1}.`,
        `${q + 1} ${groups} are needed.`,
      ],
      tags: ["up"],
    };
  }
  const [prompt, groupMany, item, items, leftPrompt] = pick(r, [
    [
      `A factory has ${n} bolts and packs them in boxes of ${d}. How many boxes can it fill completely?`,
      "boxes",
      "bolt",
      "bolts",
      `A factory packs ${n} bolts into boxes of ${d}, filling as many boxes as it can. How many bolts are left over?`,
    ],
    [
      `A library has ${n} books to put on shelves that hold ${d} books each. How many shelves can it fill completely?`,
      "shelves",
      "book",
      "books",
      `A library puts ${n} books on shelves that hold ${d} books each, filling as many shelves as it can. How many books are left over?`,
    ],
  ] as const);
  if (mode === "down")
    return {
      prompt,
      answer: String(q),
      hint,
      explanation: [
        divide,
        `The quotient counts full groups, and the remainder counts what is left over.`,
        `The remaining ${plural(rest, item, items)} cannot fill another of the ${groupMany}, so the remainder is not counted.`,
        `${q} ${groupMany} can be filled completely.`,
      ],
      tags: ["down"],
    };
  return {
    prompt: leftPrompt,
    answer: String(rest),
    hint,
    explanation: [
      divide,
      `The quotient counts full groups, and the remainder counts what is left over.`,
      `${q} full ${groupMany} use ${d * q} ${items}. The remainder is what is left: ${n} − ${d * q} = ${rest}.`,
      `${plural(rest, item, items)} ${rest === 1 ? "is" : "are"} left over.`,
    ],
    tags: ["left"],
  };
}

const signedContexts = [
  {
    key: "elevation",
    rule: "Sea level is 0, and heights above sea level are positive.",
    pos: (v: number) => `A hawk flies ${v} feet above sea level.`,
    neg: (v: number) => `A diver swims ${v} feet below sea level.`,
    posThing: "the hawk's height",
    negThing: "the diver's height",
    posWord: "above",
    negWord: "below",
    opposite: [
      (v: number) => `a height of ${v} feet above sea level`,
      (v: number) => `a height of ${v} feet below sea level`,
    ],
    max: 300,
  },
  {
    key: "temperature",
    rule: "Temperatures above zero are positive.",
    pos: (v: number) => `At noon the temperature is ${v} degrees above zero.`,
    neg: (v: number) => `At dawn the temperature is ${v} degrees below zero.`,
    posThing: "the noon temperature",
    negThing: "the dawn temperature",
    posWord: "above",
    negWord: "below",
    opposite: [
      (v: number) => `a temperature ${v} degrees above zero`,
      (v: number) => `a temperature ${v} degrees below zero`,
    ],
    max: 40,
  },
  {
    key: "money",
    rule: "Money added to the account is positive.",
    pos: (v: number) => `Sam deposits ${v} dollars into a bank account.`,
    neg: (v: number) => `Sam withdraws ${v} dollars from a bank account.`,
    posThing: "the change in Sam's balance",
    negThing: "the change in Sam's balance",
    posWord: "deposit",
    negWord: "withdrawal",
    opposite: [
      (v: number) => `a deposit of ${v} dollars`,
      (v: number) => `a withdrawal of ${v} dollars`,
    ],
    max: 500,
  },
  {
    key: "yards",
    rule: "Yards gained are positive.",
    pos: (v: number) => `On one play, a football team gains ${v} yards.`,
    neg: (v: number) => `On one play, a football team loses ${v} yards.`,
    posThing: "the team's change in position on that play",
    negThing: "the team's change in position on that play",
    posWord: "gain",
    negWord: "loss",
    opposite: [
      (v: number) => `a gain of ${v} yards`,
      (v: number) => `a loss of ${v} yards`,
    ],
    max: 30,
  },
  {
    key: "floors",
    rule: "Ground level is 0, and floors above ground are positive.",
    pos: (v: number) => `An office is ${v} floors above ground level.`,
    neg: (v: number) => `A parking level is ${v} floors below ground level.`,
    posThing: "the office's floor",
    negThing: "the parking level's floor",
    posWord: "above",
    negWord: "below",
    opposite: [
      (v: number) => `a floor ${v} levels above ground level`,
      (v: number) => `a floor ${v} levels below ground level`,
    ],
    max: 9,
  },
] as const;

function signedQuantityCase(r: Random): Case {
  const c = pick(r, signedContexts),
    v = r(2, c.max),
    mode = pick(r, ["negative", "negative", "positive", "opposite"] as const);
  if (mode === "opposite") {
    const givenNegative = r(0, 1) === 1;
    const [pos, neg] = c.opposite;
    const given = givenNegative ? neg(v) : pos(v),
      asked = givenNegative ? pos(v) : neg(v),
      value = givenNegative ? -v : v;
    const prompt = `${given[0]!.toUpperCase()}${given.slice(1)} is written as ${signed(value)}. What number represents ${asked}?`;
    return {
      prompt,
      answer: String(-value),
      hint: `${signed(value)} names ${given}. The quantity asked about is the same size, ${v}, in the opposite direction: which sign does that direction get?`,
      explanation: [
        `${given[0]!.toUpperCase()}${given.slice(1)} and ${asked} are opposite quantities: the same size, ${v}, in opposite directions from 0.`,
        `Opposite quantities have opposite signs, because they point opposite ways from 0. The given quantity is ${signed(value)}, so the other is ${signed(-value)}.`,
        `The number is ${signed(-value)}.`,
      ],
      tags: ["opposite", c.key],
    };
  }
  const negative = mode === "negative";
  const prompt = `${negative ? c.neg(v) : c.pos(v)} ${c.rule} What number represents ${negative ? c.negThing : c.posThing}?`;
  return {
    prompt,
    answer: String(negative ? -v : v),
    hint: `${c.rule} Is this quantity of ${v} in the positive direction or the opposite one?`,
    explanation: [
      `${c.rule} The opposite direction is negative: a negative number has a minus sign and is less than 0.`,
      negative
        ? `The quantity is ${v} in the negative direction, ${v} units from 0: ${signed(-v)}.`
        : `The quantity is ${v} in the positive direction, ${v} units from 0: ${v}.`,
      `The number is ${signed(negative ? -v : v)}.`,
    ],
    tags: [negative ? "represent-negative" : "represent-positive", c.key],
  };
}

function oppositeCase(r: Random): Case {
  let a: number;
  do a = r(-9, 9);
  while (a === 0);
  const mode = pick(r, ["opposite", "opposite", "other-side", "double"]);
  const side = a < 0 ? "left" : "right",
    other = a < 0 ? "right" : "left",
    d = Math.abs(a);
  const prompt =
    mode === "double"
      ? "Point $P$ marks a number on the number line. What is the opposite of the opposite of that number?"
      : mode === "other-side"
        ? "Point $R$ (not shown) is the same distance from 0 as point $P$, on the other side of 0. What number is at $R$?"
        : "Point $P$ marks a number on the number line. What is the opposite of that number?";
  const answer = mode === "double" ? a : -a;
  const read = `Each tick is 1 unit. $P$ is ${plural(d, "unit", "units")} to the ${side} of 0, so $P$ is at ${signed(a)}.`;
  const explanation =
    mode === "double"
      ? [
          read,
          `The opposite of ${signed(a)} is ${plural(d, "unit", "units")} to the ${other} of 0: ${signed(-a)}.`,
          `The opposite of ${signed(-a)} is back on the ${side} of 0, ${plural(d, "unit", "units")} away: ${signed(a)}. Taking the opposite twice returns to the start.`,
          `The answer is ${signed(a)}.`,
        ]
      : [
          read,
          `The opposite of a number is the same distance from 0 on the other side of 0.`,
          `${plural(d, "unit", "units")} to the ${other} of 0 is ${signed(-a)}. The answer is ${signed(-a)}.`,
        ];
  return {
    prompt,
    answer: String(answer),
    hint:
      mode === "double"
        ? `$P$ is to the ${side} of 0. Read the number at $P$, take its opposite, then take the opposite of that.`
        : `$P$ is to the ${side} of 0. Count its ticks from 0; the opposite is the same number of ticks on the ${other} side.`,
    explanation,
    tags: [mode, a < 0 ? "negative-point" : "positive-point"],
    figure: {
      kind: "signed-line",
      min: -10,
      max: 10,
      labelEvery: 5,
      points: [{ value: a, label: "P" }],
    },
  };
}

/** Values in hundredths; quarter or half steps unless money. */
const quarters = (r: Random, low: number, high: number) => 25 * r(low, high);

function storyCase(r: Random): Case {
  const kind = pick(r, [
    "temperature",
    "temperature",
    "elevation",
    "account",
    "account",
    "change",
    "change",
  ] as const);
  if (kind === "change") {
    const which = pick(r, ["rise", "change", "apart"] as const);
    let start: number, end: number;
    do {
      start = quarters(r, -60, 60);
      end = quarters(r, -60, 60);
    } while (
      start === end ||
      start === 0 ||
      end === 0 ||
      (which === "rise" && !(start < 0 && end > 0))
    );
    if (which === "apart") {
      const high = 50 * r(10, 160),
        low = -25 * r(4, 160);
      const diff = high - low;
      return {
        prompt: `A hiker stands on a ledge ${meters(high)} above sea level. Directly below, a diver is ${meters(-low)} below sea level. How many meters apart are they vertically?`,
        answer: answerText(diff),
        explanation: [
          `Use sea level as 0, with heights above it positive: the hiker is at ${decimal(high)} and the diver at ${decimal(low)}.`,
          `The vertical distance is the higher value minus the lower value: ${decimal(high)} − ${operand(low)} = ${decimal(high)} + ${decimal(-low)} = ${decimal(diff)}.`,
          `They are ${meters(diff)} apart.`,
        ],
        tags: ["change", "elevation", "positive-answer"],
      };
    }
    const diff = end - start;
    const prompt =
      which === "rise"
        ? `At 5 a.m. the temperature was ${decimal(start)}°C. At 2 p.m. it was ${decimal(end)}°C. By how many degrees did the temperature rise?`
        : `At noon the temperature was ${decimal(start)}°C. At midnight it was ${decimal(end)}°C. What was the change in temperature, in degrees? Give a drop as a negative number.`;
    return {
      prompt,
      answer: answerText(diff),
      explanation: [
        `A change is the later value minus the earlier value: ${decimal(end)} − ${operand(start)}.`,
        start < 0
          ? `Subtracting a negative number adds its opposite: ${decimal(end)} − ${operand(start)} = ${decimal(end)} + ${decimal(-start)} = ${decimal(diff)}.`
          : `${decimal(end)} − ${decimal(start)} = ${decimal(end)} + ${operand(-start)} = ${decimal(diff)}.`,
        which === "rise"
          ? `The temperature rose ${decimal(diff)} degrees.`
          : diff < 0
            ? `The temperature dropped, so the change is negative: ${decimal(diff)} degrees.`
            : `The temperature rose, so the change is positive: ${decimal(diff)} degrees.`,
      ],
      tags: [
        "change",
        "temperature",
        diff < 0 ? "negative-answer" : "positive-answer",
      ],
    };
  }
  if (kind === "account") {
    let start: number, deposit: number, count: number, price: number;
    let end: number;
    do {
      start = -5 * r(100, 1600);
      deposit = 5 * r(400, 3000);
      count = r(2, 5);
      price = 5 * r(100, 800);
      end = start + deposit - count * price;
    } while (end === 0);
    const paid = -count * price;
    return {
      prompt: `A bank account has a balance of ${decimal(start, 2)} dollars. The owner deposits ${decimal(deposit, 2)} dollars, then pays ${count} bills of ${decimal(price, 2)} dollars each from the account. What is the balance now, in dollars?`,
      answer: answerText(end),
      hint: `Start at ${decimal(start, 2)}. A deposit adds; each payment subtracts. The ${count} bills together change the balance by ${count} × (−${decimal(price, 2)}).`,
      explanation: [
        `Deposits add to the balance and payments subtract from it. The balance starts at ${decimal(start, 2)}.`,
        `The ${count} bills change the balance by ${count} × ${operand(-price, 2)} = ${decimal(paid, 2)}.`,
        `${decimal(start, 2)} + ${decimal(deposit, 2)} + ${operand(paid, 2)} = ${decimal(start + deposit, 2)} + ${operand(paid, 2)} = ${decimal(end, 2)}.`,
        `The balance is ${decimal(end, 2)} dollars.`,
      ],
      tags: ["account", end < 0 ? "negative-answer" : "positive-answer"],
    };
  }
  if (kind === "elevation") {
    let depth: number, rise: number, rate: number, minutes: number, end: number;
    do {
      depth = 50 * r(10, 80);
      rise = quarters(r, 4, 40);
      rate = quarters(r, 2, 12);
      minutes = r(2, 5);
      end = -depth + rise - minutes * rate;
    } while (end >= 0 || rise >= depth);
    const fall = -minutes * rate;
    return {
      prompt: `A diver is ${meters(depth)} below sea level. She rises ${meters(rise)}, then descends ${meters(rate)} per minute for ${minutes} minutes. What is her elevation now, in meters?`,
      answer: answerText(end),
      hint: `Sea level is 0, so she starts at ${decimal(-depth)}. Rising adds ${decimal(rise)}; descending ${decimal(rate)} per minute for ${minutes} minutes adds ${minutes} × (−${decimal(rate)}).`,
      explanation: [
        `Use sea level as 0, with up positive and down negative. The diver starts at ${decimal(-depth)}.`,
        `Descending ${meters(rate)} per minute for ${minutes} minutes changes her elevation by ${minutes} × ${operand(-rate)} = ${decimal(fall)}.`,
        `${decimal(-depth)} + ${decimal(rise)} + ${operand(fall)} = ${decimal(-depth + rise)} + ${operand(fall)} = ${decimal(end)}.`,
        `Her elevation is ${decimal(end)} meters, which is ${meters(-end)} below sea level.`,
      ],
      tags: ["elevation", "negative-answer"],
    };
  }
  let start: number, riseBy: number, rate: number, hours: number, end: number;
  do {
    start = quarters(r, -60, 20);
    riseBy = quarters(r, 4, 48);
    rate = quarters(r, 1, 12);
    hours = r(2, 6);
    end = start + riseBy - hours * rate;
  } while (start === 0 || end === 0 || start + riseBy === 0);
  const fall = -hours * rate;
  return {
    prompt: `At 6 a.m. the temperature was ${decimal(start)}°C. By noon it had risen ${decimal(riseBy)}°C. Then it fell ${decimal(rate)}°C each hour for ${hours} hours. What was the temperature then, in °C?`,
    answer: answerText(end),
    hint: `Start at ${decimal(start)}. The rise adds ${decimal(riseBy)}; falling ${decimal(rate)} each hour for ${hours} hours adds ${hours} × (−${decimal(rate)}).`,
    explanation: [
      `Rising is positive and falling is negative. The temperature starts at ${decimal(start)}.`,
      `Falling ${decimal(rate)}°C each hour for ${hours} hours is a change of ${hours} × ${operand(-rate)} = ${decimal(fall)}.`,
      `${decimal(start)} + ${decimal(riseBy)} + ${operand(fall)} = ${decimal(start + riseBy)} + ${operand(fall)} = ${decimal(end)}.`,
      `The temperature was ${decimal(end)}°C.`,
    ],
    tags: ["temperature", end < 0 ? "negative-answer" : "positive-answer"],
  };
}

function jumpsCase(r: Random): Case {
  for (;;) {
    const count = r(2, 3),
      start = 50 * r(-20, 20),
      jumps: number[] = [];
    while (jumps.length < count) {
      const size = 50 * r(1, 16) * (r(0, 1) ? 1 : -1),
        previous = jumps.at(-1);
      // Alternate directions, never retracing the previous arrow exactly.
      if (
        previous !== undefined &&
        (Math.sign(previous) === Math.sign(size) ||
          Math.abs(previous) === Math.abs(size))
      )
        continue;
      jumps.push(size);
    }
    const positions = jumps.reduce(
      (all, j) => [...all, all.at(-1)! + j],
      [start],
    );
    const end = positions.at(-1)!;
    if (start === 0 || end === 0) continue;
    const low = Math.floor((Math.min(0, ...positions) - 100) / 500) * 5,
      high = Math.ceil((Math.max(0, ...positions) + 100) / 500) * 5;
    if (high - low > 30) continue;
    const changes = jumps.map(change);
    const explanation = [
      `Arrows to the right are positive changes and arrows to the left are negative changes. Start at ${decimal(start)}.`,
      ...jumps.map(
        (j, i) =>
          `${i === 0 ? "Add the first change" : i === jumps.length - 1 ? "Add the last change" : "Add the next change"}: ${decimal(positions[i]!)} + ${operand(j)} = ${decimal(positions[i + 1]!)}.`,
      ),
      `The last arrow ends at ${decimal(end)}.`,
    ];
    return {
      prompt: `The arrows start at ${decimal(start)} and show the changes ${list(changes)}, in that order. At what number does the last arrow end?`,
      answer: answerText(end),
      explanation,
      tags: [
        count === 2 ? "two-jumps" : "three-jumps",
        end < 0 ? "negative-answer" : "positive-answer",
      ],
      figure: {
        kind: "signed-line",
        min: low,
        max: high,
        labelEvery: 5,
        points: [],
        start: start / 100,
        jumps: jumps.map((j) => j / 100),
      },
    };
  }
}

const builders: Record<string, (r: Random) => Case> = {
  "greatest-common-factor": gcfCase,
  "least-common-multiple": lcmCase,
  "gcf-factor-sum": factorSumCase,
  "long-division-quotient": longDivisionCase,
  "division-remainder-story": remainderCase,
  "signed-quantity": signedQuantityCase,
  "opposite-on-line": oppositeCase,
  "signed-story": storyCase,
  "signed-jumps": jumpsCase,
};
const labels: Record<string, string> = {
  "greatest-common-factor": "Greatest common factor",
  "least-common-multiple": "Least common multiple",
  "gcf-factor-sum": "Choose one expression",
  "long-division-quotient": "Quotient",
  "division-remainder-story": "Answer",
  "signed-quantity": "Signed number",
  "opposite-on-line": "Number",
  "signed-story": "Exact value",
  "signed-jumps": "Number",
};

export function numberSystemPrintCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const metadata = numberSystemTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown number-system template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed);
  const c = builders[id]!(r);
  const publicId = createHash("sha256")
    .update(JSON.stringify([id, 1, seed]))
    .digest("hex");
  let problem: GeneratedProblem;
  if (c.choices) {
    const choices = [...c.choices];
    // Shuffle semantic choices before assigning position IDs.
    for (let i = choices.length - 1; i > 0; i--) {
      const j = r(0, i);
      [choices[i], choices[j]] = [choices[j]!, choices[i]!];
    }
    let answer = "";
    const choiceFeedback: Record<string, string> = {};
    const options = choices.map((choice, index) => {
      const optionId = `option-${"abcd"[index]}`;
      if (choice.correct) answer = optionId;
      else choiceFeedback[optionId] = choice.feedback!;
      return { id: optionId, label: choice.label };
    });
    problem = {
      public: {
        id: publicId,
        templateId: id,
        templateVersion: 1,
        seed,
        skillId: metadata.skillId,
        prompt: c.prompt,
        response: { kind: "choice", label: labels[id]!, options },
      },
      answer,
      explanation: c.explanation,
      hint: c.hint ?? c.explanation[0]!,
      choiceFeedback,
    };
  } else
    problem = {
      public: {
        id: publicId,
        templateId: id,
        templateVersion: 1,
        seed,
        skillId: metadata.skillId,
        prompt: c.prompt,
        response: { kind: "number", label: labels[id]! },
        ...(c.figure ? { figure: c.figure } : {}),
      },
      answer: c.answer,
      explanation: c.explanation,
      hint: c.hint ?? c.explanation[0]!,
    };
  // Prompt and figure state every given, so together they identify a case.
  return {
    problem,
    tags: c.tags,
    caseKey: JSON.stringify([c.prompt, c.figure ?? null]),
  };
}
export const generateNumberSystemProblem = (
  id: string,
  seed: string,
): GeneratedProblem => numberSystemPrintCase(id, seed).problem;
