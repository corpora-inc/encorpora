import { generateBeforeClauses as generateProblem } from "./helpers/before-clause-variants";
import assert from "node:assert/strict";
import test from "node:test";
import { skills } from "../src/curriculum/catalog";
import { curriculumConnections } from "../src/curriculum/connections";
import { selectionObjectives } from "../src/curriculum/selection";
import type { GeneratedProblem } from "../src/math/contracts";
import { templates } from "../src/math/engine";
import {
  grade4MeasurementMoneyCase,
  grade4MeasurementMoneyTemplates,
} from "../src/math/grade4-measurement-money-practice";
import {
  clockTimePresent,
  toolSituations,
} from "../src/math/grade4-measurement-money-voice";
import { storyNames } from "../src/math/story-kit/names";

const IDS = grade4MeasurementMoneyTemplates.map((t) => t.id);
const LINE_DENOMS = new Set([2, 3, 4, 5, 6, 8, 10, 12]);
const TABLE_FACTOR: Record<string, number> = {
  "feet|inches": 12,
  "kilograms|grams": 1000,
  "hours|minutes": 60,
  "liters|milliliters": 1000,
};
const RENAME_FACTOR: Record<string, number> = {
  "inches|feet": 12,
  "feet|yards": 3,
  "ounces|pounds": 16,
  "cups|quarts": 4,
  "quarts|gallons": 4,
  "minutes|hours": 60,
  "centimeters|meters": 100,
  "millimeters|centimeters": 10,
  "grams|kilograms": 1000,
  "meters|kilometers": 1000,
  "milliliters|liters": 1000,
};
const EXCLUDED = new Set([
  "grams|kilograms",
  "meters|kilometers",
  "milliliters|liters",
]);
const TOOL_LABEL: Record<string, string> = {
  ruler: "ruler",
  balance: "balance",
  thermometer: "thermometer",
  cup: "measuring cup",
  scale: "scale",
};
const TOOLS: [RegExp, string][] = [
  [/length of a book/, "ruler"],
  [/compare the mass of a rock with known masses/, "balance"],
  [/temperature of the room/, "thermometer"],
  [/juice in a pitcher/, "measuring cup"],
  [/weight of a person in pounds/, "scale"],
  ...Object.entries(toolSituations).flatMap(([id, list]) =>
    list.map(
      (item) =>
        [
          new RegExp(item.marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
          TOOL_LABEL[id]!,
        ] as [RegExp, string],
    ),
  ),
];
const MONEY: Record<string, number> = {
  five: 500,
  dollar: 100,
  quarter: 25,
  dime: 10,
  nickel: 5,
  penny: 1,
};

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const centsOf = (text: string) => {
  const match = /^(\d+)\.(\d{1,2})$/.exec(text);
  assert.ok(match, text);
  const frac = match[2]!;
  return Number(match[1]) * 100 + Number(frac) * (frac.length === 1 ? 10 : 1);
};
const dollarsOf = (cents: number) =>
  `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
const fewest = (cents: number) => {
  const best = [0, ...Array.from({ length: cents }, () => 1_000)];
  for (const coin of [1, 5, 10, 25])
    for (let amount = coin; amount <= cents; amount++)
      best[amount] = Math.min(best[amount]!, best[amount - coin]! + 1);
  return best[cents]!;
};
const formatTime = (mins: number) => {
  const t = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(t / 60);
  const minute = t % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${h24 < 12 ? "a.m." : "p.m."}`;
};
const ACTIVITY =
  "art class|sharing time|reading session|cleanup time|soccer practice|stretching|hike|snack break";
const DUR = String.raw`(?:\d+ hours?(?: \d+ minutes?)?|\d+ minutes?)`;
const VERB: Record<string, string> = {
  "art class": "lasts",
  "sharing time": "takes",
  "reading session": "lasts",
  "cleanup time": "takes",
  "soccer practice": "lasts",
  stretching: "takes",
  hike: "lasts",
  "snack break": "takes",
};
const elapsedTwo = new RegExp(
  String.raw`^The clock shows when (?:the )?(${ACTIVITY}) starts, in the (morning|afternoon)\. ((?:The )?(?:${ACTIVITY})) (lasts|takes) (${DUR})\. Then (?:the )?(${ACTIVITY}) (lasts|takes) (${DUR})\. What time does (?:the )?\6 end\?$`,
  "i",
);
const elapsedOne = new RegExp(
  String.raw`^The clock shows when (?:the )?(${ACTIVITY}) starts, in the (morning|afternoon)\. ((?:The )?(?:${ACTIVITY})) (lasts|takes) (${DUR})\. What time does (?:the )?\1 end\?$`,
  "i",
);
const cellNumber = (value: number | string | null) => {
  if (value === null) throw new Error("blank cell");
  if (typeof value === "number") return value;
  assert.match(value, /^\d{1,3}(,\d{3})*$/);
  return Number(value.replaceAll(",", ""));
};
/** Same handfuls the generator may hand over. Keep this list aligned with it. */
const WHOLE_PAYMENTS = new Set([
  100, 200, 500, 600, 700, 1000, 1100, 1200, 1500, 2000, 2100, 2500, 3000,
]);
const spoken = (cents: number) => {
  const whole = Math.floor(cents / 100);
  const extra = cents % 100;
  if (whole === 0) return extra === 1 ? "1 cent" : `${extra} cents`;
  if (extra === 0) return whole === 1 ? "1 dollar" : `${whole} dollars`;
  return `${dollarsOf(cents)} dollars`;
};
const parseSpoken = (text: string) => {
  const decimal = /^(\d+)\.(\d{2}) dollars$/.exec(text);
  if (decimal) {
    const whole = Number(decimal[1]);
    const frac = Number(decimal[2]);
    assert.ok(whole > 0 && frac !== 0, text);
    return whole * 100 + frac;
  }
  const dollars = /^(\d+) dollars?$/.exec(text);
  if (dollars) {
    const n = Number(dollars[1]);
    assert.equal(text, n === 1 ? "1 dollar" : `${n} dollars`);
    return n * 100;
  }
  const cents = /^(\d+) cents?$/.exec(text);
  assert.ok(cents, text);
  const n = Number(cents![1]);
  assert.ok(n > 0 && n < 100, text);
  assert.equal(text, n === 1 ? "1 cent" : `${n} cents`);
  return n;
};
const parseBills = (phrase: string) => {
  if (phrase === "two 1-dollar bills") return [1, 1];
  const two = /^a (\d+)-dollar bill and two 1-dollar bills$/.exec(phrase);
  if (two) return [Number(two[1]), 1, 1];
  const pair = /^a (\d+)-dollar bill and a (\d+)-dollar bill$/.exec(phrase);
  if (pair) return [Number(pair[1]), Number(pair[2])];
  const one = /^a (\d+)-dollar bill$/.exec(phrase);
  assert.ok(one, phrase);
  return [Number(one![1])];
};
const parseTender = (phrase: string) => {
  let billsPhrase = phrase;
  let quarters = 0;
  const quarter = /^(.*) and (a quarter|\d+ quarters)$/.exec(phrase);
  if (quarter) {
    billsPhrase = quarter[1]!;
    quarters =
      quarter[2] === "a quarter" ? 1 : Number(quarter[2]!.split(" ")[0]);
    assert.ok(quarters === 1 || quarters === 2 || quarters === 3, phrase);
  }
  const bills = parseBills(billsPhrase);
  assert.ok(
    bills.every((bill) => [1, 5, 10, 20].includes(bill)),
    phrase,
  );
  return {
    cents: bills.reduce((sum, bill) => sum + bill, 0) * 100 + quarters * 25,
    quarters,
    bills,
  };
};
const nextBill = (cost: number) => {
  const bill = [100, 500, 1000, 2000].find((value) => value > cost);
  assert.ok(bill, String(cost));
  return bill!;
};
const bestWholeChange = (cost: number) => {
  const ceiling = nextBill(cost);
  const options = [...WHOLE_PAYMENTS].filter(
    (pay) => pay > cost && pay <= ceiling,
  );
  assert.ok(options.length > 0, String(cost));
  return Math.min(...options.map((pay) => pay - cost));
};
/** A currency `$` sits in front of a number. An operation inside `$…$` is TeX. */
const currencySign = (text: string) =>
  [...text.matchAll(/\$([^$]+)\$/g)].some(
    (match) => /^\d/.test(match[1]!) && !/[+\-−÷×*=<>]/.test(match[1]!),
  ) || /\$\d/.test(text.replace(/\$[^$]+\$/g, ""));
const assertMoneyWords = (text: string) => {
  assert.equal(currencySign(text), false, text);
  assert.equal(/\b0\.\d{2} dollars\b/.test(text), false, text);
  assert.equal(/\b\d+\.00 dollars\b/.test(text), false, text);
};
const assertTender = (phrase: string, cost: number) => {
  const pay = parseTender(phrase);
  assert.ok(pay.cents > cost, phrase);
  assert.ok(pay.cents <= nextBill(cost), phrase);
  if (pay.quarters === 0) {
    assert.equal(WHOLE_PAYMENTS.has(pay.cents), true, phrase);
    return pay;
  }
  const base = pay.cents - pay.quarters * 25;
  assert.ok(base <= cost, phrase);
  const change = pay.cents - cost;
  const best = bestWholeChange(cost);
  assert.ok(change < best, phrase);
  assert.ok(fewest(change) < fewest(best), phrase);
  return pay;
};
const durationOf = (text: string) => {
  const hours = /^(\d+) hours?(?: (\d+) minutes?)?$/.exec(text);
  if (hours) return Number(hours[1]) * 60 + (hours[2] ? Number(hours[2]) : 0);
  const minutes = /^(\d+) minutes?$/.exec(text);
  assert.ok(minutes, text);
  return Number(minutes[1]);
};

function served(id: string, seed: string) {
  const model = grade4MeasurementMoneyCase(id, seed);
  const problem = generateProblem(id, seed);
  assert.equal(problem.answer, model.problem.answer, `${id} ${seed}`);
  assert.equal(problem.public.prompt, model.problem.public.prompt, id);
  assert.equal(problem.public.skillId, model.problem.public.skillId);
  return { variant: model.variant, problem };
}

function choice(problem: GeneratedProblem) {
  const response = problem.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice");
  return response.options;
}

test("decimal money is one grade-4 skill on the decimals budget", () => {
  const skill = skills.find((s) => s.id === "decimal-money-operations");
  assert.ok(skill);
  assert.equal(skill.gradeBand, "4");
  assert.equal(skill.strand, "decimals");
  assert.deepEqual(
    skills.filter((s) => s.id === "decimal-money-operations"),
    [skill],
  );
  const homes = selectionObjectives.filter((o) =>
    o.skills.includes("decimal-money-operations"),
  );
  assert.equal(homes.length, 1);
  assert.equal(homes[0]!.id, "decimals");
  assert.ok(
    skills
      .find((s) => s.id === "unit-conversion")!
      .facets.some(
        (f) =>
          f.id === "unit-conversion.tables-intervals" &&
          f.status === "implemented",
      ),
  );
  assert.ok(
    skill.facets.some(
      (f) =>
        f.id === "decimal-money-operations.operations" &&
        f.status === "implemented",
    ),
  );
  const links = curriculumConnections.filter(
    (c) =>
      c.from === "decimal-money-operations" ||
      c.to === "decimal-money-operations",
  );
  assert.deepEqual(
    links.map((c) => [c.from, c.to, c.kind, c.templateIds[0]].join("|")).sort(),
    [
      "decimal-money-operations|decimal-arithmetic|extension|decimal-sum-difference",
      "money-values|decimal-money-operations|application|money-model-decimal",
    ],
  );
  for (const meta of grade4MeasurementMoneyTemplates) {
    const registered = templates.find((t) => t.id === meta.id);
    assert.ok(registered, meta.id);
    assert.equal(registered.skillId, meta.skillId);
    assert.equal(
      skills.find((s) => s.id === meta.skillId)!.gradeBand,
      "4",
      meta.id,
    );
  }
});

function readElapsed(text: string): {
  durations: number[];
  period: "morning" | "afternoon";
  written: { hour: number; minute: number } | null;
} {
  const twoMatch = elapsedTwo.exec(text);
  const oneMatch = elapsedOne.exec(text);
  if (twoMatch || oneMatch) {
    assert.equal(Boolean(twoMatch), !oneMatch);
    const match = (twoMatch ?? oneMatch)!;
    const name = match[1]!.toLowerCase();
    assert.equal(match[3]!.toLowerCase().endsWith(name), true);
    assert.equal(match[4]!.toLowerCase(), VERB[name]);
    if (twoMatch) {
      const second = twoMatch[6]!.toLowerCase();
      assert.equal(twoMatch[7]!.toLowerCase(), VERB[second]);
    }
    const durations = [durationOf(twoMatch ? twoMatch[5]! : oneMatch![5]!)];
    if (twoMatch) durations.push(durationOf(twoMatch[8]!));
    return {
      durations,
      period: match[2] === "afternoon" ? "afternoon" : "morning",
      written: null,
    };
  }
  const time = /(?<!\d)(\d{1,2}):(\d{2}) ([ap])\.m\./.exec(text);
  assert.ok(time, text);
  const found = [
    ...text.matchAll(/(\d+) hours?(?: (\d+) minutes?)?|(\d+) minutes?/g),
  ];
  assert.ok(found.length === 1 || found.length === 2, text);
  assert.ok(
    storyNames.some((name) => text.includes(name)),
    text,
  );
  return {
    durations: found.map((part) => durationOf(part[0])),
    period: time[3] === "a" ? "morning" : "afternoon",
    written: { hour: Number(time[1]), minute: Number(time[2]) },
  };
}

test("elapsed time crosses an hour and is read from the clock", () => {
  let noon = 0;
  let two = 0;
  for (let i = 0; i < 200; i++) {
    const { problem } = served("elapsed-time-intervals", `mm-elapsed-${i}`);
    const text = problem.public.prompt;
    assert.equal(/\bThe art takes\b/.test(text), false);
    if (problem.variant != null) {
      const prose = [text, problem.hint, ...problem.explanation].join("\n");
      assert.equal(prose.includes(".."), false, prose);
    }
    const read = readElapsed(text);
    const figure = problem.public.figure;
    assert.ok(figure && figure.kind === "clock");
    if (!figure || figure.kind !== "clock") throw new Error("clock");
    if (read.written) {
      assert.equal(figure.hour, read.written.hour);
      assert.equal(figure.minute, read.written.minute);
      assert.equal(problem.variant?.id, "story");
    } else assert.equal(problem.variant ?? null, null);
    const period = read.period;
    assert.notEqual(period === "morning" && figure.hour === 12, true);
    const hour24 =
      period === "morning"
        ? figure.hour
        : figure.hour === 12
          ? 12
          : figure.hour + 12;
    const start = hour24 * 60 + figure.minute;
    const end = start + read.durations.reduce((sum, part) => sum + part, 0);
    assert.ok(end < 20 * 60);
    assert.notEqual(Math.floor(end / 60), Math.floor(start / 60));
    if (start < 12 * 60 && end >= 12 * 60) noon++;
    if (read.durations.length === 2) two++;
    const label = formatTime(end);
    assert.equal(clockTimePresent(text, label), false);
    const options = choice(problem);
    const hits = options.filter((o) => o.label === label);
    assert.equal(hits.length, 1);
    assert.equal(problem.answer, hits[0]!.id);
    assert.equal(new Set(options.map((o) => o.label)).size, options.length);
    assert.match(
      problem.explanation.join(" "),
      new RegExp(label.replaceAll(".", "\\.")),
    );
  }
  assert.ok(noon >= 40, `noon ${noon}`);
  assert.ok(two >= 40 && two <= 160, `two-step ${two}`);
});

test("conversion tables fill both columns from the first row", () => {
  const pairs = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const { problem } = served("conversion-table-slots", `mm-table-${i}`);
    const match =
      /matches (\w+) with (\w+)\. The first row shows (\d+) (feet|kilograms|hours|liters)/.exec(
        problem.public.prompt,
      );
    assert.ok(match, problem.public.prompt);
    if (problem.variant == null)
      assert.match(
        problem.public.prompt,
        /^The table matches \w+ with \w+\. The first row shows \d+ (?:feet|kilograms|hours|liters)\. Fill in the two blanks\.$/,
      );
    else
      assert.ok(
        storyNames.some((name) => problem.public.prompt.includes(name)),
      );
    const large = match[1]!;
    const small = match[2]!;
    const shown = Number(match[3]);
    assert.equal(match[4], large);
    const factor = TABLE_FACTOR[`${large}|${small}`];
    assert.ok(factor);
    pairs.add(`${large}|${small}`);
    const figure = problem.public.figure;
    assert.ok(figure && figure.kind === "scene");
    if (!figure || figure.kind !== "scene") throw new Error("scene");
    const table = figure.scene.elements[0];
    assert.ok(table && table.type === "table");
    if (!table || table.type !== "table") throw new Error("table");
    assert.deepEqual(table.columns, [large, small]);
    const rows = table.rows;
    assert.equal(rows.length, 3);
    assert.equal(cellNumber(rows[0]!.cells[0] ?? null), shown);
    assert.equal(cellNumber(rows[0]!.cells[1] ?? null), shown * factor!);
    if (shown * factor! >= 1000)
      assert.equal(rows[0]!.cells[1], grouped(shown * factor!));
    const response = problem.public.response;
    assert.equal(response.kind, "multi-part-choice");
    if (response.kind !== "multi-part-choice") throw new Error("parts");
    const key: Record<string, string> = {};
    const filled = new Set<string>();
    for (const blank of response.blanks) {
      const label = /^Row (\d+), (\w+)$/.exec(blank.label);
      assert.ok(label);
      const row = rows[Number(label[1]) - 1]!;
      const word = label[2]!;
      let expected = 0;
      if (word === large) {
        assert.equal(row.cells[0], null);
        const smaller = cellNumber(row.cells[1] ?? null);
        assert.equal(smaller % factor!, 0);
        expected = smaller / factor!;
      } else {
        assert.equal(word, small);
        assert.equal(row.cells[1], null);
        expected = cellNumber(row.cells[0] ?? null) * factor!;
      }
      const shownLabel = grouped(expected);
      const hits = blank.options.filter((o) => o.label === shownLabel);
      assert.equal(hits.length, 1, shownLabel);
      key[blank.id] = hits[0]!.id;
      filled.add(word);
    }
    assert.deepEqual(filled, new Set([large, small]));
    assert.equal(problem.answer, JSON.stringify(key));
  }
  assert.deepEqual([...pairs].sort(), [...Object.keys(TABLE_FACTOR)].sort());
});

test("smaller units rename to a whole number of a larger unit", () => {
  const core = new Set<string>();
  const florida = new Set<string>();
  for (let i = 0; i < 800; i++) {
    const { variant, problem } = served("unit-rename-larger", `mm-rename-${i}`);
    const legacy = /^([\d,]+) (\w+) is how many (\w+)\?$/.exec(
      problem.public.prompt,
    );
    const amountMatch = /([\d,]+) (\w+)\b/.exec(problem.public.prompt);
    const howMany = /[Hh]ow many (\w+)\b/.exec(problem.public.prompt);
    const match =
      legacy ??
      (amountMatch && howMany
        ? [problem.public.prompt, amountMatch[1], amountMatch[2], howMany[1]]
        : null);
    assert.ok(match, problem.public.prompt);
    if (problem.variant == null) assert.ok(legacy);
    else {
      assert.equal(legacy, null);
      assert.ok(
        storyNames.some((name) => problem.public.prompt.includes(name)),
      );
    }
    const amount = Number(match[1]!.replaceAll(",", ""));
    if (amount >= 1000) assert.match(match[1]!, /,/);
    const prose = [
      problem.public.prompt,
      problem.hint,
      ...problem.explanation,
    ].join("\n");
    assert.equal(/(?<![\d,])\d{4,}(?!\d)/.test(prose), false, prose);
    const pair = `${match[2]}|${match[3]}`;
    const factor = RENAME_FACTOR[pair];
    assert.ok(factor, pair);
    assert.equal(amount % factor!, 0);
    const result = amount / factor!;
    assert.equal(problem.answer, String(result));
    assert.notEqual(result, factor);
    assert.match(problem.public.response.kind, /^number$/);
    if (variant.startsWith("florida-")) {
      assert.equal(EXCLUDED.has(pair), false, variant);
      florida.add(pair);
    } else {
      assert.equal(variant.startsWith("core-"), true, variant);
      core.add(pair);
    }
  }
  for (const pair of Object.keys(RENAME_FACTOR)) {
    if (EXCLUDED.has(pair)) assert.equal(core.has(pair), true, pair);
    else assert.equal(florida.has(pair), true, pair);
  }
});

test("a measurement line is read as a grade-4 fraction", () => {
  const denoms = new Set<number>();
  let aboveOne = 0;
  for (let i = 0; i < 200; i++) {
    const { problem } = served(
      "measurement-line-fraction-story",
      `mm-line-${i}`,
    );
    const text = problem.public.prompt;
    if (problem.variant == null)
      assert.equal(text, "How far is the walk from $A$ to $B$, in miles?");
    else {
      assert.ok(text.includes("$A$") && text.includes("$B$"), text);
      assert.match(text, /\bmiles?\b/);
      assert.ok(
        storyNames.some((name) => text.includes(name)),
        text,
      );
    }
    assert.equal(/\d/.test(text), false);
    assert.equal(text.includes("student"), false);
    assert.equal(text.includes("equal steps"), false);
    const figure = problem.public.figure;
    assert.ok(figure && figure.kind === "rational-line");
    if (!figure || figure.kind !== "rational-line") throw new Error("line");
    assert.equal(LINE_DENOMS.has(figure.denominator), true);
    assert.equal(figure.unit, "miles");
    denoms.add(figure.denominator);
    const points = new Map(figure.points.map((p) => [p.label, p.numerator]));
    assert.deepEqual([...points.keys()].sort(), ["A", "B"]);
    const span = points.get("B")! - points.get("A")!;
    assert.ok(span > 0);
    const divisor = gcd(span, figure.denominator);
    const numerator = span / divisor;
    const denominator = figure.denominator / divisor;
    const answer =
      denominator === 1 ? String(numerator) : `${numerator}/${denominator}`;
    assert.equal(problem.answer, answer);
    if (answer.includes("/")) assert.equal(text.includes(answer), false);
    if (span > figure.denominator) aboveOne++;
    assert.equal(problem.public.response.kind, "fraction");
  }
  assert.ok(denoms.size >= 4, [...denoms].join(","));
  assert.ok(aboveOne >= 40, `above one ${aboveOne}`);
});

test("each measuring question has one tool", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const { problem } = served("measuring-tool-choice", `mm-tool-${i}`);
    const hits = TOOLS.filter(([phrase]) => phrase.test(problem.public.prompt));
    assert.equal(hits.length, 1);
    const tool = hits[0]![1];
    seen.add(tool);
    const options = choice(problem);
    const keyed = options.filter((o) => o.label === tool);
    assert.equal(keyed.length, 1);
    assert.equal(problem.answer, keyed[0]!.id);
    assert.equal(new Set(options.map((o) => o.label)).size, 4);
    assert.equal(problem.public.prompt.match(/\d/), null);
  }
  assert.deepEqual(
    [...seen].sort(),
    [...new Set(TOOLS.map(([, tool]) => tool))].sort(),
  );
});

test("decimal sums and differences stay in hundredths", () => {
  let subtraction = 0;
  let unlike = 0;
  for (let i = 0; i < 200; i++) {
    const { problem } = served("decimal-sum-difference", `mm-decimal-${i}`);
    const text = problem.public.prompt;
    const legacy = /^What is \$(\d+\.\d{1,2}) ([+-]) (\d+\.\d{1,2})\$\?$/.exec(
      text,
    );
    const tex = /\$(\d+\.\d{1,2}) ([+-]) (\d+\.\d{1,2})\$/.exec(text);
    let left: string;
    let op: string;
    let right: string;
    if (problem.variant == null) {
      assert.ok(legacy, text);
      left = legacy![1]!;
      op = legacy![2]!;
      right = legacy![3]!;
    } else if (tex) {
      left = tex[1]!;
      op = tex[2]!;
      right = tex[3]!;
    } else {
      const nums = [...text.matchAll(/(\d+\.\d{1,2})/g)].map(
        (part) => part[1]!,
      );
      const spoken = [
        ...text.matchAll(/(\d+\.\d{2} dollars|\d+ dollars?|\d+ cents?)/g),
      ].map((part) => part[1]!);
      if (/how much longer|how much is left/i.test(text)) op = "-";
      else {
        assert.match(text, /total/i);
        op = "+";
      }
      if (nums.length === 2) {
        left = nums[0]!;
        right = nums[1]!;
      } else {
        assert.equal(spoken.length, 2, text);
        left = dollarsOf(parseSpoken(spoken[0]!));
        right = dollarsOf(parseSpoken(spoken[1]!));
      }
    }
    const value =
      op === "+"
        ? centsOf(left) + centsOf(right)
        : centsOf(left) - centsOf(right);
    assert.ok(value >= 0);
    const answer = dollarsOf(value);
    assert.equal(problem.answer, answer);
    assert.equal(
      new RegExp(`(?<![\\d.])${answer.replace(".", "\\.")}(?![\\d])`).test(
        text,
      ),
      false,
    );
    if (op === "-") subtraction++;
    const digits = [left, right].map((n) => n.split(".")[1]!.length);
    if (digits[0] !== digits[1]) unlike++;
    assert.ok(digits.every((n) => n === 1 || n === 2));
  }
  assert.ok(subtraction >= 80, `subtraction ${subtraction}`);
  assert.ok(unlike >= 40, `unlike ${unlike}`);
});

test("money stories cover change, the four operations and the fewest coins", () => {
  const surfaces = new Map<string, number>();
  const enter = String.raw` Enter the amount in dollars and cents, such as 2\.35\.`;
  const amount = String.raw`(\d+\.\d{2} dollars|\d+ dollars?|\d+ cents?)`;
  let wholePay = 0;
  let quarterPay = 0;
  for (let i = 0; i < 200; i++) {
    const { variant, problem } = served("money-decimal-story", `mm-money-${i}`);
    const text = problem.public.prompt;
    const plain = problem.variant == null;
    const prose = [text, problem.hint, ...problem.explanation].join("\n");
    assertMoneyWords(prose);
    let answer = "";
    let surface = "";
    const add = new RegExp(
      String.raw`^A book costs ${amount} and a pen costs ${amount}\. What is the total cost\?${enter}$`,
    ).exec(text);
    const change = new RegExp(
      String.raw`^A snack costs ${amount}\. You pay with (.+)\. How much change do you get back\?${enter}$`,
    ).exec(text);
    const shared = new RegExp(
      String.raw`^Markers cost ${amount} each\. The club buys (\d+) markers, and (\d+) friends split the cost equally\. How much does each friend pay\?${enter}$`,
    ).exec(text);
    const stickers = new RegExp(
      String.raw`^Each sticker costs ${amount}\. You buy (\d+) stickers and pay with (.+)\. How much change do you get back\?${enter}$`,
    ).exec(text);
    const coins = new RegExp(
      String.raw`^You need ${amount} in quarters, dimes, nickels, and pennies\. What is the fewest number of coins that make that amount\?$`,
    ).exec(text);
    if (!plain) {
      if (variant === "add") {
        const costs = [
          ...text.matchAll(
            /costs (\d+\.\d{2} dollars|\d+ dollars?|\d+ cents?)/g,
          ),
        ];
        assert.equal(costs.length, 2, text);
        const left = parseSpoken(costs[0]![1]!);
        const right = parseSpoken(costs[1]![1]!);
        assert.notEqual(left % 100, 0);
        assert.notEqual(right % 100, 0);
        answer = dollarsOf(left + right);
        surface = "add";
      } else if (variant === "change" || variant === "times-change") {
        const costMatch =
          /costs (\d+\.\d{2} dollars|\d+ dollars?|\d+ cents?)/.exec(text);
        const payMatch = /pays? with (.+?)\./.exec(text);
        assert.ok(costMatch && payMatch, text);
        const price = parseSpoken(costMatch![1]!);
        const countMatch = /(\d+) (stickers|pencils|tickets|cookies)/.exec(
          text,
        );
        const cost =
          variant === "times-change" ? Number(countMatch?.[1]) * price : price;
        assert.ok(variant === "change" || countMatch, text);
        const pay = assertTender(payMatch![1]!, cost);
        if (pay.quarters === 0) wholePay++;
        else quarterPay++;
        answer = dollarsOf(pay.cents - cost);
        surface = variant;
      } else if (variant === "times-divide") {
        const priceMatch =
          /costs (\d+\.\d{2} dollars|\d+ dollars?|\d+ cents?)/.exec(text);
        const itemMatch =
          /(\d+) (markers|stickers|erasers|pencils|juice boxes)/.exec(text);
        const friendMatch = /(\d+) friends/.exec(text);
        assert.ok(priceMatch && itemMatch && friendMatch, text);
        assert.match(text, /split/);
        const price = parseSpoken(priceMatch![1]!);
        const items = Number(itemMatch![1]);
        const friends = Number(friendMatch![1]);
        assert.equal((items * price) % friends, 0);
        answer = dollarsOf((items * price) / friends);
        surface = "times-divide";
      } else {
        assert.equal(variant, "fewest");
        assert.match(text, /fewest/);
        const amounts = [
          ...text.matchAll(/(\d+\.\d{2} dollars|\d+ dollars?|\d+ cents?)/g),
        ];
        assert.equal(amounts.length, 1, text);
        const coinsAmount = parseSpoken(amounts[0]![1]!);
        assert.ok(coinsAmount > 0 && coinsAmount < 100);
        answer = String(fewest(coinsAmount));
        surface = "fewest";
      }
      surfaces.set(surface, (surfaces.get(surface) ?? 0) + 1);
      assert.equal(problem.answer, answer);
      assert.equal(problem.public.response.kind, "number");
      continue;
    }
    const matched = [add, change, shared, stickers, coins].filter(Boolean);
    assert.equal(matched.length, 1, text);
    if (add) {
      surface = "add";
      const left = parseSpoken(add[1]!);
      const right = parseSpoken(add[2]!);
      assert.notEqual(left % 100, 0);
      assert.notEqual(right % 100, 0);
      answer = dollarsOf(left + right);
      assert.match(
        problem.explanation.join("\n"),
        new RegExp(spoken(left + right).replaceAll(".", "\\.")),
      );
    } else if (change) {
      surface = "change";
      const cost = parseSpoken(change[1]!);
      const pay = assertTender(change[2]!, cost);
      if (pay.quarters === 0) wholePay++;
      else quarterPay++;
      answer = dollarsOf(pay.cents - cost);
      assert.match(
        problem.explanation.join("\n"),
        new RegExp(spoken(pay.cents - cost).replaceAll(".", "\\.")),
      );
    } else if (shared) {
      surface = "times-divide";
      const price = parseSpoken(shared[1]!);
      const items = Number(shared[2]);
      const friends = Number(shared[3]);
      assert.equal((items * price) % friends, 0);
      answer = dollarsOf((items * price) / friends);
    } else if (stickers) {
      surface = "times-change";
      const price = parseSpoken(stickers[1]!);
      const count = Number(stickers[2]);
      const cost = count * price;
      const pay = assertTender(stickers[3]!, cost);
      if (pay.quarters === 0) wholePay++;
      else quarterPay++;
      answer = dollarsOf(pay.cents - cost);
    } else {
      surface = "fewest";
      const coinsAmount = parseSpoken(coins![1]!);
      assert.ok(coinsAmount > 0 && coinsAmount < 100);
      answer = String(fewest(coinsAmount));
    }
    surfaces.set(surface, (surfaces.get(surface) ?? 0) + 1);
    assert.equal(problem.answer, answer);
    assert.equal(problem.public.response.kind, "number");
  }
  assert.ok((surfaces.get("add") ?? 0) >= 15, `add ${surfaces.get("add")}`);
  assert.ok(
    (surfaces.get("change") ?? 0) >= 15,
    `change ${surfaces.get("change")}`,
  );
  assert.ok(
    (surfaces.get("times-divide") ?? 0) >= 8,
    `times ${surfaces.get("times-divide")}`,
  );
  assert.ok(
    (surfaces.get("times-change") ?? 0) >= 8,
    `times-change ${surfaces.get("times-change")}`,
  );
  assert.ok(
    (surfaces.get("fewest") ?? 0) >= 25,
    `fewest ${surfaces.get("fewest")}`,
  );
  assert.ok(wholePay >= 5, `whole-bill payments ${wholePay}`);
  assert.ok(quarterPay >= 5, `bill-and-quarter payments ${quarterPay}`);
});

test("bills and ten mixed coins total a decimal in dollars", () => {
  let five = 0;
  const dollars = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const { variant, problem } = served("money-model-decimal", `mm-model-${i}`);
    const plainModel =
      /^Set A shows (.+)\. Set B shows the coins\. How much money is there in all\? Enter the amount in dollars and cents, such as 2\.35\.$/.exec(
        problem.public.prompt,
      );
    const billPhrase =
      plainModel?.[1] ??
      [
        "a 5-dollar bill",
        "3 one-dollar bills",
        "2 one-dollar bills",
        "a 1-dollar bill",
      ].find((phrase) => problem.public.prompt.includes(phrase));
    assertMoneyWords(
      [problem.public.prompt, problem.hint, ...problem.explanation].join("\n"),
    );
    assert.ok(billPhrase, problem.public.prompt);
    if (problem.variant == null) assert.ok(plainModel);
    else assert.equal(problem.public.prompt.includes("Set A shows"), false);
    const figure = problem.public.figure;
    assert.ok(figure && figure.kind === "money-sets");
    if (!figure || figure.kind !== "money-sets") throw new Error("money");
    const sets = new Map(figure.sets.map((s) => [s.label, s.items]));
    assert.deepEqual([...sets.keys()].sort(), ["A", "B"]);
    const bills = sets.get("A")!;
    if (billPhrase === "a 5-dollar bill") {
      assert.deepEqual(bills, ["five"]);
      assert.equal(variant, "five-plus-coins");
      five++;
    } else if (billPhrase === "a 1-dollar bill") {
      assert.deepEqual(bills, ["dollar"]);
      assert.equal(variant, "dollars-1");
      dollars.add(1);
    } else {
      const counted = /^(\d+) one-dollar bills$/.exec(billPhrase!);
      assert.ok(counted, billPhrase);
      const count = Number(counted![1]);
      assert.ok(count >= 2);
      assert.deepEqual(
        bills,
        Array.from({ length: count }, () => "dollar"),
      );
      assert.equal(variant, `dollars-${count}`);
      dollars.add(count);
    }
    const coins = sets.get("B")!;
    assert.equal(coins.length, 10);
    for (const name of ["quarter", "dime", "nickel", "penny"])
      assert.ok(coins.includes(name as "penny"), name);
    const total = [...bills, ...coins].reduce(
      (sum, item) => sum + MONEY[item]!,
      0,
    );
    assert.equal(problem.answer, dollarsOf(total));
    assert.match(
      problem.explanation.join("\n"),
      new RegExp(spoken(total).replaceAll(".", "\\.")),
    );
    assert.equal(problem.public.response.kind, "number");
  }
  assert.ok(five >= 15, `five ${five}`);
  assert.deepEqual([...dollars].sort(), [1, 2, 3]);
});

test("contract, hint and texas sample seeds generate", () => {
  const seeds = [
    "contract",
    ...Array.from({ length: 24 }, (_, i) => String(i)),
    ...Array.from({ length: 20 }, (_, i) => `hint-${i}`),
    "texas-sample-a",
    "texas-sample-b",
  ];
  for (const id of IDS)
    for (const seed of seeds) {
      const problem = generateProblem(id, seed);
      assert.equal(problem.public.templateId, id);
      assert.ok(problem.answer.length > 0);
    }
});
