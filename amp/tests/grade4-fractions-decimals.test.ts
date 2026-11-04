import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { generateProblem, type GeneratedProblem } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import { methods } from "../src/content/problem-methods";
import { describeScene } from "../src/math/scene";
import { legacySurface } from "./fixtures/legacy-surface";

const golden = JSON.parse(
  readFileSync(
    new URL("./fixtures/grade4-fraction-decimal-digests.json", import.meta.url),
    "utf8",
  ),
) as Record<string, string[]>;

const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([k, v]) => [k, canonical(v)]),
        )
      : typeof value === "number" && !Number.isInteger(value)
        ? Number(value.toFixed(9))
        : value;

const digest = (problem: GeneratedProblem) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(legacySurface(problem))))
    .digest("hex")
    .slice(0, 16);

const seeds = (n: number, prefix = "g4") =>
  Array.from({ length: n }, (_, i) => `${prefix}:${i}`);

const reduce = (numerator: number, denominator: number) => {
  let a = Math.abs(numerator);
  let b = Math.abs(denominator);
  while (b) [a, b] = [b, a % b];
  const n = numerator / a;
  const d = denominator / a;
  return d === 1 ? String(n) : `${n}/${d}`;
};

type Option = { id: string; label: string };
type Blank = { id: string; options: Option[] };
type SelectResponse = {
  kind: "multi-select";
  selectionCount: number;
  options: Option[];
};
type PartResponse = {
  kind: "multi-part-choice";
  blanks: Blank[];
  sentence?: { text?: string; blank?: string }[];
};
type ChoiceResponse = { kind: "choice"; options: Option[] };

const problemOf = (id: string, seed: string) => {
  const problem = generateProblem(id, seed);
  generatedProblemSchema.parse(problem);
  return problem;
};

const fracs = (label: string) =>
  [...label.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g)].map((m) => ({
    n: Number(m[1]),
    d: Number(m[2]),
  }));

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const sameAmount = (
  parts: { n: number; d: number }[],
  numerator: number,
  denominator: number,
) => {
  let multiple = denominator;
  for (const part of parts) multiple = lcm(multiple, part.d);
  const total = parts.reduce(
    (sum, part) => sum + part.n * (multiple / part.d),
    0,
  );
  return total * denominator === numerator * multiple;
};

const amount = (text: string, denominator: number) => {
  const mixed = text.match(/^(\d+)\\frac\{(\d+)\}\{(\d+)\}$/);
  if (mixed) return Number(mixed[1]) * denominator + Number(mixed[2]);
  const bare = text.match(/^\\frac\{(\d+)\}\{(\d+)\}$/);
  if (bare) return Number(bare[1]);
  const whole = text.match(/^(\d+)$/);
  if (whole) return Number(whole[1]) * denominator;
  throw new Error(`Bad target ${text}`);
};

const chosen = (problem: GeneratedProblem) => {
  const response = problem.public.response as ChoiceResponse;
  return response.options.find((option) => option.id === problem.answer)!;
};

const DENOM_IDS = [
  "like-fraction-missing-part",
  "like-fraction-difference",
  "mixed-fraction-difference",
  "mixed-to-improper-numerator",
  "improper-whole-part",
  "improper-fractional-part",
  "whole-times-fraction",
  "equivalent-numerator",
] as const;

const NEW_IDS = [
  "fraction-decompositions-select",
  "mixed-fraction-sum",
  "like-fraction-sum-story",
  "unit-fraction-multiple-blanks",
  "equivalent-fractions-number-line",
  "compare-fractions-symbol-blanks",
  "compare-decimals-symbol-blanks",
  "decimal-fraction-locate",
  "decimal-place-value-hundredths",
] as const;

test("legacy fraction and decimal surfaces stay byte-identical", () => {
  assert.deepEqual(
    Object.keys(golden).sort(),
    [
      "compare-fractions-reason-blanks",
      "equivalent-numerator",
      "improper-fractional-part",
      "improper-whole-part",
      "like-fraction-difference",
      "like-fraction-missing-part",
      "mixed-fraction-difference",
      "mixed-to-improper-numerator",
      "staar-order-decimals",
      "tenths-as-hundredths",
      "whole-times-fraction",
    ].sort(),
  );
  for (const [id, hashes] of Object.entries(golden)) {
    assert.equal(hashes.length, 200, id);
    let legacy = 0;
    hashes.forEach((expected, i) => {
      const problem = generateProblem(id, `legacy:${i}`);
      const axes = problem.variant?.axes;
      // The golden file freezes the surface from before these axes. Only that
      // legacy value must match. A new axis value is a different problem, and
      // the variant field itself is not part of the digest.
      // compare-fractions-reason-blanks stores the basis in the variant id.
      // The same-whole, plain-sentence draw omits the newer axes.
      const onLegacy =
        id === "compare-fractions-reason-blanks"
          ? axes?.whole == null && axes?.setting == null
          : problem.variant === undefined;
      if (id === "compare-fractions-reason-blanks") assert.ok(problem.variant);
      if (onLegacy) {
        legacy++;
        assert.equal(digest(problem), expected, `${id} legacy:${i}`);
        if (id !== "compare-fractions-reason-blanks")
          assert.equal(problem.variant, undefined, `${id} legacy:${i}`);
      }
    });
    // staar-order-decimals weights thousandths 1 of 5, so 200 seeds land near 30.
    assert.ok(legacy >= 30, `${id} reaches its legacy surface (${legacy})`);
  }
});

test("grade-4 denominator axis reaches 5, 10, 12, 100 and 16", () => {
  const joined = methods["equivalent-numerator"]!.method.join(" ");
  assert.match(joined, /That number over itself is 1/);
  for (const id of DENOM_IDS) {
    const seen = new Set<number>();
    let legacy = 0;
    for (const seed of seeds(800, `den-${id}`)) {
      const problem = generateProblem(id, seed);
      const prompt = problem.public.prompt;
      const expanded = problem.variant !== undefined;
      if (!expanded) legacy++;
      if (id === "equivalent-numerator") {
        const multiplied = prompt.match(
          /(\d+)\/(\d+) × □\/□ = (\d+)\/(\d+)\. What number goes in both boxes\?/,
        );
        if (multiplied) {
          const a = Number(multiplied[1]);
          const b = Number(multiplied[2]);
          const ak = Number(multiplied[3]);
          const bk = Number(multiplied[4]);
          assert.equal(ak / a, bk / b);
          assert.equal(problem.answer, String(ak / a));
          seen.add(b);
          seen.add(bk);
          if (!expanded) assert.ok([2, 3, 4].includes(b));
          continue;
        }
        const renamed = prompt.match(
          /Rename (\d+)\/(\d+) as \?\/(\d+)\. What is the missing numerator\?/,
        );
        assert.ok(renamed, prompt);
        const a = Number(renamed![1]);
        const b = Number(renamed![2]);
        const target = Number(renamed![3]);
        assert.equal(target % b, 0);
        assert.equal(problem.answer, String((a * target) / b));
        seen.add(b);
        seen.add(target);
        if (!expanded) assert.ok([2, 3, 4].includes(b));
        continue;
      }
      let denominator = 0;
      if (id === "like-fraction-missing-part") {
        const m = prompt.match(/^(\d+)\/(\d+) \+ □ = (\d+)\/(\d+)\. /);
        assert.ok(m, prompt);
        denominator = Number(m![2]);
        assert.equal(m![2], m![4]);
        assert.equal(
          problem.answer,
          reduce(Number(m![3]) - Number(m![1]), denominator),
        );
      } else if (id === "like-fraction-difference") {
        const parts = [...prompt.matchAll(/(\d+)\/(\d+)/g)];
        assert.ok(parts.length >= 2, prompt);
        denominator = Number(parts[0]![2]);
        assert.equal(parts[0]![2], parts[1]![2]);
        assert.equal(
          problem.answer,
          reduce(Number(parts[0]![1]) - Number(parts[1]![1]), denominator),
        );
      } else if (id === "mixed-fraction-difference") {
        const m = prompt.match(
          /^Find (\d+) (\d+)\/(\d+) − (\d+) (\d+)\/(\d+)\. Give a fraction or whole number\.$/,
        );
        const story = [...prompt.matchAll(/(\d+) (\d+)\/(\d+)/g)];
        const whole = Number(m?.[1] ?? story[0]?.[1]);
        const a = Number(m?.[2] ?? story[0]?.[2]);
        denominator = Number(m?.[3] ?? story[0]?.[3]);
        const other = Number(m?.[4] ?? story[1]?.[1]);
        const b = Number(m?.[5] ?? story[1]?.[2]);
        assert.equal(denominator, Number(m?.[6] ?? story[1]?.[3]));
        assert.ok(a < b && b < denominator, prompt);
        assert.equal(
          problem.answer,
          reduce((whole - other) * denominator + a - b, denominator),
        );
        if (!expanded) assert.ok([3, 4, 6, 8].includes(denominator));
        if (expanded) assert.notEqual(denominator, 2);
      } else if (id === "mixed-to-improper-numerator") {
        const m = prompt.match(/^Write (\d+) (\d+)\/(\d+) as \?\/(\d+)\. /);
        assert.ok(m, prompt);
        denominator = Number(m![3]);
        assert.equal(
          problem.answer,
          String(Number(m![1]) * denominator + Number(m![2])),
        );
      } else if (
        id === "improper-whole-part" ||
        id === "improper-fractional-part"
      ) {
        const m = prompt.match(/(\d+)\/(\d+)/);
        assert.ok(m, prompt);
        const total = Number(m![1]);
        denominator = Number(m![2]);
        const wholes = Math.floor(total / denominator);
        assert.equal(
          problem.answer,
          id === "improper-whole-part"
            ? String(wholes)
            : reduce(total % denominator, denominator),
        );
      } else {
        const frac = prompt.match(/(\d+)\/(\d+)/);
        const times = problem.explanation
          .join(" ")
          .match(/(\d+) × (\d+) = (\d+)/);
        assert.ok(frac && times, prompt);
        denominator = Number(frac[2]);
        assert.equal(Number(frac[1]), Number(times[2]));
        assert.equal(Number(times[1]) * Number(times[2]), Number(times[3]));
        assert.equal(problem.answer, reduce(Number(times[3]), denominator));
      }
      seen.add(denominator);
      if (!expanded && id !== "mixed-fraction-difference")
        assert.ok(
          [2, 3, 4, 6, 8].includes(denominator),
          `${id} ${denominator}`,
        );
    }
    assert.ok(legacy > 30, `${id} legacy ${legacy}`);
    for (const denominator of [5, 10, 12, 100, 16])
      assert.ok(seen.has(denominator), `${id} reaches ${denominator}`);
  }
});

test("fraction decompositions, mixed sums and join stories", () => {
  let above = 0;
  let regroup = 0;
  const stories = { meter: 0, liter: 0, hour: 0 };
  for (const seed of seeds(400)) {
    const decomposition = problemOf("fraction-decompositions-select", seed);
    const prompt = decomposition.public.prompt;
    assert.match(prompt, /Choose \d+/);
    const response = decomposition.public.response as SelectResponse;
    const figure = decomposition.public.figure;
    assert.equal(figure?.kind, "fraction-strips");
    assert.ok(figure?.kind === "fraction-strips");
    const denominator = figure.kind === "fraction-strips" ? figure.parts : 0;
    const numerator =
      figure.kind === "fraction-strips" ? figure.rows[0]!.selected : 0;
    if (figure.kind === "fraction-strips") {
      assert.equal(figure.parts, denominator);
      assert.equal(figure.rows[0]!.selected, numerator);
    }
    const keyed = new Set(JSON.parse(decomposition.answer) as string[]);
    assert.equal(keyed.size, response.selectionCount);
    assert.match(prompt, new RegExp(`Choose ${keyed.size}`));
    let unit = false;
    let twoDenoms = false;
    for (const option of response.options) {
      const parts = fracs(option.label);
      assert.ok(parts.length >= 1);
      const equals = sameAmount(parts, numerator, denominator);
      assert.equal(keyed.has(option.id), equals);
      if (equals) {
        assert.ok(parts.every((part) => part.d === denominator));
        if (parts.every((part) => part.n === 1) && parts.length === numerator)
          unit = true;
      }
      if (new Set(parts.map((part) => part.d)).size > 1) twoDenoms = true;
    }
    assert.ok(unit, seed);
    assert.ok(twoDenoms, seed);
    if (numerator >= denominator) above++;

    const sum = problemOf("mixed-fraction-sum", seed);
    const mixed = [...sum.public.prompt.matchAll(/(\d+) (\d+)\/(\d+)/g)];
    assert.equal(mixed.length, 2, sum.public.prompt);
    const d = Number(mixed[0]![3]);
    const a = Number(mixed[0]![2]);
    const b = Number(mixed[1]![2]);
    assert.equal(mixed[0]![3], mixed[1]![3]);
    assert.equal(
      sum.answer,
      reduce((Number(mixed[0]![1]) + Number(mixed[1]![1])) * d + a + b, d),
    );
    if (a + b >= d) regroup++;

    const story = problemOf("like-fraction-sum-story", seed);
    const text = story.public.prompt;
    const bits = text.match(/(\d+)\/(\d+)/g);
    assert.ok(bits && bits.length === 2, text);
    const [left, right] = bits!.map((bit) => bit.split("/").map(Number));
    assert.equal(left![1], right![1]);
    assert.ok(left![0]! > 0 && right![0]! > 0);
    assert.ok(left![0]! < left![1]! && right![0]! < right![1]!);
    assert.equal(story.answer, reduce(left![0]! + right![0]!, left![1]!));
    if (left![0]! + right![0]! > left![1]!) stories.meter++;
    else stories.liter++;
    if (/pizza|chapter|garden|poster/.test(text)) stories.hour++;
  }
  assert.ok(above >= 100, `greater than one ${above}`);
  assert.ok(regroup >= 200, `regroup ${regroup}`);
  assert.ok(stories.meter >= 80, `sums past one ${stories.meter}`);
  assert.ok(stories.liter >= 80, `sums within one ${stories.liter}`);
  assert.ok(stories.hour >= 40, `part-of-one contexts ${stories.hour}`);
});

test("unit-fraction multiples and number-line names", () => {
  let commute = 0;
  let pastOne = 0;
  const denoms = new Set<number>();
  for (const seed of seeds(400)) {
    const multiple = problemOf("unit-fraction-multiple-blanks", seed);
    const response = multiple.public.response as PartResponse;
    const sentence = (response.sentence ?? [])
      .map((part) => part.text ?? `{${part.blank}}`)
      .join("");
    const found = sentence.match(
      /\$\\frac\{(\d+)\}\{(\d+)\}=\$ \{copies\} \$\\times\\frac\{1\}\{\2\}\$\n(?:\$\\frac\{(\d+)\}\{\2\}\\times (\d+)=\$|\$(\d+)\\times\\frac\{(\d+)\}\{\2\}=\$) \{pieces\} \$\\times\\frac\{1\}\{\2\}\$/,
    );
    assert.ok(found, sentence);
    const copies = Number(found![1]);
    const denominator = Number(found![2]);
    const group = found![3] ? Number(found![3]) : Number(found![6]);
    const groups = found![3] ? Number(found![4]) : Number(found![5]);
    if (found![3]) commute++;
    const figure = multiple.public.figure;
    assert.equal(figure?.kind, "fraction-strips");
    if (figure?.kind === "fraction-strips") {
      assert.equal(figure.parts, denominator);
      assert.equal(figure.rows[0]!.selected, group);
    }
    const key = JSON.parse(multiple.answer) as Record<string, string>;
    const label = (id: string, choice: string) =>
      response.blanks
        .find((blank) => blank.id === id)!
        .options.find((o) => o.id === choice)!.label;
    assert.equal(label("copies", key.copies!), String(copies));
    assert.equal(label("pieces", key.pieces!), String(groups * group));
    assert.match(sentence, /\\frac\{1\}/);
    assert.match(sentence, /\\times/);

    const names = problemOf("equivalent-fractions-number-line", seed);
    const line = names.public.figure;
    assert.equal(line?.kind, "rational-line");
    assert.match(names.public.prompt, /Choose 3/);
    if (line?.kind === "rational-line") {
      const value = line.points[0]!.numerator / line.denominator;
      if (line.points[0]!.numerator > line.denominator) pastOne++;
      const select = names.public.response as SelectResponse;
      const keyed = new Set(JSON.parse(names.answer) as string[]);
      const trueDenoms = new Set<number>();
      for (const option of select.options) {
        const [part] = fracs(option.label);
        assert.ok(part);
        assert.notEqual(part!.d, 16);
        denoms.add(part!.d);
        const equals = part!.n / part!.d === value;
        assert.equal(keyed.has(option.id), equals);
        if (equals) trueDenoms.add(part!.d);
      }
      assert.equal(trueDenoms.size, 3);
      assert.equal(keyed.size, 3);
    }
  }
  assert.ok(commute >= 80, `commuted ${commute}`);
  assert.ok(pastOne >= 120, `above one ${pastOne}`);
  for (const denominator of [5, 10, 12, 100])
    assert.ok(denoms.has(denominator), `line denom ${denominator}`);
});

test("fraction and decimal comparisons record symbols", () => {
  let equalFractions = 0;
  for (const seed of seeds(400)) {
    const fractions = problemOf("compare-fractions-symbol-blanks", seed);
    const response = fractions.public.response as PartResponse;
    const sentence = (response.sentence ?? [])
      .map((part) => part.text ?? `{${part.blank}}`)
      .join("");
    const parts = fracs(sentence);
    assert.equal(parts.length, 4);
    const key = JSON.parse(fractions.answer) as Record<string, string>;
    const symbol = (blank: string) =>
      response.blanks
        .find((row) => row.id === blank)!
        .options.find((option) => option.id === key[blank])!.label;
    const expect = (
      left: { n: number; d: number },
      right: { n: number; d: number },
    ) => {
      const a = left.n * right.d;
      const b = right.n * left.d;
      return a < b ? "$<$" : a > b ? "$>$" : "$=$";
    };
    assert.equal(symbol("c1"), expect(parts[0]!, parts[1]!));
    assert.equal(symbol("c2"), expect(parts[2]!, parts[3]!));
    if (symbol("c1") === "$=$" || symbol("c2") === "$=$") equalFractions++;
    assert.ok(
      fractions.explanation.some((line) => line.includes("common denominator")),
    );
    const unequal = (
      left: { n: number; d: number },
      right: { n: number; d: number },
    ) => left.n * right.d !== right.n * left.d;
    assert.ok(unequal(parts[0]!, parts[1]!) || unequal(parts[2]!, parts[3]!));

    const decimals = problemOf("compare-decimals-symbol-blanks", seed);
    const rows = decimals.public.response as PartResponse;
    const text = (rows.sentence ?? [])
      .map((part) => part.text ?? `{${part.blank}}`)
      .join("");
    const pairs = [...text.matchAll(/(\d+\.\d+)\s*\{c\d\}\s*(\d+\.\d+)/g)];
    assert.equal(pairs.length, 2);
    const hundredths = (value: string) => {
      const [whole, frac = ""] = value.split(".");
      return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
    };
    const decimalKey = JSON.parse(decimals.answer) as Record<string, string>;
    let trailing = 0;
    pairs.forEach((pair, index) => {
      const left = hundredths(pair[1]!);
      const right = hundredths(pair[2]!);
      const mark = left < right ? "$<$" : left > right ? "$>$" : "$=$";
      const blank = rows.blanks[index]!;
      const label = blank.options.find(
        (option) => option.id === decimalKey[blank.id],
      )!.label;
      assert.equal(label, mark);
      const lengths = [pair[1]!, pair[2]!].map(
        (item) => item.split(".")[1]!.length,
      );
      if (left === right) {
        trailing++;
        assert.deepEqual(lengths.sort(), [1, 2]);
      } else assert.notEqual(lengths[0], lengths[1]);
    });
    assert.equal(trailing, 1);
    assert.match(decimals.answer, /"b"/);
  }
  assert.ok(equalFractions >= 80, `equal fractions ${equalFractions}`);
});

test("different wholes, decimal location, place value, tenths above one, and hundredths order", () => {
  let different = 0;
  let tenths = 0;
  let hundredthsPoints = 0;
  let zeroTenths = 0;
  let showcase = 0;
  let hundredthsOrder = 0;
  let thousandthsOrder = 0;
  for (const seed of seeds(400, "axis")) {
    const reason = generateProblem("compare-fractions-reason-blanks", seed);
    if (reason.public.prompt.includes("different sizes")) {
      different++;
      const response = reason.public.response as PartResponse;
      const key = JSON.parse(reason.answer) as Record<string, string>;
      const label = (id: string) =>
        response.blanks
          .find((blank) => blank.id === id)!
          .options.find((o) => o.id === key[id])!.label;
      assert.equal(label("bigger"), "you cannot tell which is greater");
      assert.equal(label("why"), "can't tell from the fractions");
      const figure = reason.public.figure;
      assert.equal(figure?.kind, "scene");
      if (figure?.kind === "scene") {
        const widths = new Map<number, number>();
        for (const element of figure.scene.elements) {
          if (element.type !== "rect") continue;
          const y = element.at[1]!;
          widths.set(y, (widths.get(y) ?? 0) + element.size[0]!);
        }
        const rows = [...widths.values()];
        assert.ok(rows.length >= 2);
        assert.ok(Math.max(...rows) - Math.min(...rows) > 1);
      }
    }

    const located = problemOf("decimal-fraction-locate", seed);
    const described = describeScene(
      located.public.figure!.kind === "scene"
        ? located.public.figure.scene
        : (null as never),
      false,
    );
    assert.equal(typeof described, "string");
    assert.doesNotMatch(described, /Point [A-D] is at/);
    const line =
      located.public.figure!.kind === "scene"
        ? located.public.figure.scene.elements.find(
            (element) => element.type === "numberLine",
          )
        : undefined;
    assert.ok(line && line.type === "numberLine");
    const fractionPrompt = located.public.prompt.match(/\\frac\{(\d+)\}\{10\}/);
    if (fractionPrompt) {
      tenths++;
      const at = Number(fractionPrompt[1]) / 10;
      const mark = line.marks!.find((item) => Math.abs(item.at - at) < 1e-6);
      assert.ok(mark && typeof mark.label === "string");
      assert.equal(chosen(located).label, `$${mark!.label}$`);
    } else {
      hundredthsPoints++;
      const decimals = [...located.public.prompt.matchAll(/(\d+\.\d{2})/g)];
      const target = decimals[decimals.length - 1]![1]!;
      const mark = line.marks!.find((item) => item.at.toFixed(2) === target);
      assert.ok(mark && typeof mark.label === "string");
      assert.equal(chosen(located).label, `$${mark!.label}$`);
    }

    const place = problemOf("decimal-place-value-hundredths", seed);
    const shown = place.public.prompt.match(/(\d\.\d\d)/)![1]!;
    if (/\d\.0\d/.test(shown)) zeroTenths++;
    const response = place.public.response as PartResponse;
    const sentence = (response.sentence ?? [])
      .map((part) => part.text ?? `{${part.blank}}`)
      .join("");
    const digit = sentence.match(/The digit (\d) is in the/)![1]!;
    assert.notEqual(digit, "0");
    assert.equal(shown.split(digit).length, 2);
    const index = shown.indexOf(digit);
    const name = ["ones", "", "tenths", "hundredths"][index]!;
    const value =
      name === "ones"
        ? digit
        : name === "tenths"
          ? `0.${digit}`
          : `0.0${digit}`;
    const key = JSON.parse(place.answer) as Record<string, string>;
    const picked = (id: string) =>
      response.blanks
        .find((blank) => blank.id === id)!
        .options.find((o) => o.id === key[id])!.label;
    assert.equal(picked("place"), name);
    assert.equal(picked("value"), value);

    const renamed = generateProblem("tenths-as-hundredths", seed);
    if (renamed.variant?.axes?.magnitude !== "above-one") {
      const box = renamed.public.prompt.match(/(\d)\/10 \+ (\d)\/100 = □\/100/);
      const plain = renamed.public.prompt.match(/0\.(\d) = □\/100/);
      const decimal = renamed.public.prompt.match(
        /What is (\d)\/10 \+ (\d)\/100 written as a decimal\?/,
      );
      if (box)
        assert.equal(
          renamed.answer,
          String(Number(box[1]) * 10 + Number(box[2])),
        );
      else if (plain)
        assert.equal(renamed.answer, String(Number(plain[1]) * 10));
      else {
        assert.ok(decimal, renamed.public.prompt);
        assert.equal(renamed.answer, `0.${decimal![1]}${decimal![2]}`);
      }
    } else {
      assert.equal(renamed.variant.axes?.magnitude, "above-one");
      const rename = renamed.public.prompt.match(
        /(\d+) (\d+)\/10 = (\d+) □\/100\. What number belongs in the box\?/,
      );
      const sum = renamed.public.prompt.match(
        /What is (\d+) (\d+)\/10 \+ (\d+)\/100 written as a decimal\?/,
      );
      const back = renamed.public.prompt.match(
        /(\d+)\.(\d)0 = (\d+) □\/100\. What number belongs in the box\?/,
      );
      if (rename) {
        assert.equal(rename[1], rename[3]);
        assert.equal(renamed.answer, String(Number(rename[2]) * 10));
      } else if (sum) {
        assert.equal(renamed.answer, `${sum[1]}.${sum[2]}${sum[3]}`);
        if (renamed.answer === "2.30") showcase++;
      } else {
        assert.ok(back, renamed.public.prompt);
        assert.equal(back![1], back![3]);
        assert.equal(renamed.answer, String(Number(back![2]) * 10));
      }
    }

    const order = generateProblem("staar-order-decimals", seed);
    const values = [...order.public.prompt.matchAll(/\d+\.\d+/g)].map((m) =>
      Number(m[0]),
    );
    assert.ok(values.length >= 4);
    const unique = new Set(values);
    assert.equal(unique.size, values.length);
    const sorted = [...values].sort((a, b) => a - b);
    const label = chosen(order).label;
    if (order.hint.includes("two decimal places")) {
      hundredthsOrder++;
      assert.equal(order.variant?.axes?.places, "hundredths");
    } else {
      thousandthsOrder++;
      assert.match(order.hint, /three decimal places/);
      assert.equal(order.variant, undefined);
    }
    const listed = order.public.prompt.includes("Which list");
    if (listed) {
      const descending = order.public.prompt.includes("greatest to least");
      const expected = descending ? [...sorted].reverse() : sorted;
      const shown = [...label.matchAll(/\d+\.\d+/g)].map((m) => Number(m[0]));
      assert.deepEqual(shown, expected);
    } else {
      const word = /which is (second|third)\?/.exec(order.public.prompt)![1]!;
      assert.equal(Number(label), sorted[word === "second" ? 1 : 2]);
    }
  }
  assert.ok(different >= 80, `different wholes ${different}`);
  assert.ok(
    tenths >= 80 && hundredthsPoints >= 80,
    `${tenths} tenths, ${hundredthsPoints} hundredths`,
  );
  assert.ok(zeroTenths >= 160, `zero tenths ${zeroTenths}`);
  assert.ok(showcase >= 1, "2.30");
  assert.ok(hundredthsOrder >= 250, `hundredths order ${hundredthsOrder}`);
  assert.ok(thousandthsOrder >= 40, `thousandths order ${thousandthsOrder}`);
});

const replay = JSON.parse(
  readFileSync(
    new URL("./fixtures/grade4-fraction-decimal-replay.json", import.meta.url),
    "utf8",
  ),
) as Record<string, { digest: string; variantId: string | null }[]>;

/** The surface origin/main stored for this template: no new axis token. */
const storedSurface = (id: string, problem: GeneratedProblem): boolean => {
  const axes = problem.variant?.axes;
  if (id === "compare-fractions-reason-blanks")
    return axes?.whole == null && axes?.setting == null;
  return problem.variant == null;
};

test("origin/main seeds keep the stored surface and variant id", () => {
  for (const [id, rows] of Object.entries(replay)) {
    assert.ok(rows.length >= 40, id);
    let legacy = 0;
    rows.forEach((row, i) => {
      const now = generateProblem(id, `replay:${i}`);
      if (!storedSurface(id, now)) {
        if (id === "compare-fractions-reason-blanks")
          assert.notEqual(now.variant?.id, row.variantId);
        return;
      }
      legacy++;
      assert.equal(now.variant?.id ?? null, row.variantId, `${id} replay:${i}`);
      assert.equal(digest(now), row.digest, `${id} replay:${i}`);
    });
    assert.ok(legacy >= 4, `${id} reaches the stored surface (${legacy})`);
  }
});
