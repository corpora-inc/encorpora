import test from "node:test";
import assert from "node:assert/strict";
import {
  bestDisplayCase,
  circleGraphCase,
  dataDisplayStateTemplates,
  frequencyTableCase,
  returnClaimCase,
  stemLeafConstructCase,
} from "../src/math/data-display-state-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";

const ids = dataDisplayStateTemplates.map((t) => t.id);
const SEEDS = 400;

/** Whole-token containment: "20" is not found inside "120". */
function mentions(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w.])${escaped}(?![\\w])`).test(text);
}

function choices(templateId: string, seed: string) {
  const generated = generateProblem(templateId, seed);
  const response = generated.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice expected");
  return { generated, options: response.options };
}

test("every template is deterministic with four distinct choices, one correct and an unleaked hint", () => {
  for (const id of ids) {
    for (let seed = 0; seed < SEEDS; seed++) {
      const { generated, options } = choices(id, `s:${seed}`);
      const again = generateProblem(id, `s:${seed}`);
      assert.deepEqual(again.public, generated.public);
      assert.equal(again.answer, generated.answer);
      assert.equal(options.length, 4, `${id} ${seed}`);
      assert.equal(
        new Set(options.map((o) => o.label)).size,
        4,
        `${id} ${seed}`,
      );
      const correct = options.filter((o) => o.id === generated.answer);
      assert.equal(correct.length, 1);
      assert.ok(
        !mentions(generated.public.prompt, correct[0]!.label) ||
          id === "frequency-table-build" ||
          id === "circle-graph-read",
        `${id} prompt ${seed}`,
      );
      // A bare count may equal a number the hint legitimately names (a value, a total).
      if (!/^\d+$/.test(correct[0]!.label))
        assert.ok(
          !mentions(generated.hint, correct[0]!.label),
          `${id} hint ${seed}: ${generated.hint} / ${correct[0]!.label}`,
        );
      for (const o of options)
        if (o.id !== generated.answer)
          assert.ok(generated.choiceFeedback?.[o.id], `${id} feedback ${seed}`);
    }
  }
});

test("the engine reaches every template under its skill", () => {
  for (const id of ids) {
    const meta = templates.find((t) => t.id === id);
    assert.ok(meta, id);
    assert.equal(generateProblem(id, "reach").public.skillId, meta!.skillId);
  }
});

function parsePlot(label: string) {
  return label
    .replaceAll("\u00a0", " ")
    .split("; ")
    .map((row) => {
      const [stem, leaves = ""] = row.split(" |");
      return {
        stem: Number(stem),
        leaves: leaves.trim() ? leaves.trim().split(" ").map(Number) : [],
      };
    });
}

test("stem-and-leaf plot: exactly one choice is the ordered, complete plot of the data", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = stemLeafConstructCase(`s:${seed}`);
    seen.add(`v${c.variant}`);
    const { generated, options } = choices("stem-leaf-construct", `s:${seed}`);
    if (c.variant === 5) {
      // The key: the labelled meaning must be the value the stem and leaf make.
      const decimal = /\.\d/.test(
        options.find((o) => o.id === generated.answer)!.label,
      );
      const label = options.find((o) => o.id === generated.answer)!.label;
      const m = /\$(\d+)\\mid (\d)\$ means \$([\d.]+)\$/.exec(label)!;
      assert.ok(m, label);
      assert.equal(
        Number(m[3]),
        decimal
          ? Number(m[1]) + Number(m[2]) / 10
          : Number(m[1]) * 10 + Number(m[2]),
      );
      continue;
    }
    // Independent derivation from the numbers in the prompt.
    const listed = /: ([\d., ]+)\. Which stem/
      .exec(generated.public.prompt)![1]!
      .split(", ");
    const decimal = listed.some((x) => x.includes("."));
    const values = listed.map((x) =>
      Math.round(Number(x) * (decimal ? 10 : 1)),
    );
    seen.add(decimal ? "decimal" : "whole");
    const matches = options.filter((o) => {
      const rows = parsePlot(o.label);
      const flat = rows.flatMap((row) =>
        row.leaves.map((l) => row.stem * 10 + l),
      );
      const ordered = rows.every((row) =>
        row.leaves.every((l, i) => i === 0 || row.leaves[i - 1]! <= l),
      );
      const sorted = [...values].sort((a, b) => a - b);
      const stems = rows.map((row) => row.stem);
      const contiguous = stems.every(
        (s, i) => i === 0 || s === stems[i - 1]! + 1,
      );
      return (
        ordered &&
        contiguous &&
        stems[0] === Math.floor(sorted[0]! / 10) &&
        stems.at(-1) === Math.floor(sorted.at(-1)! / 10) &&
        JSON.stringify(flat) === JSON.stringify(sorted)
      );
    });
    assert.equal(matches.length, 1, `${seed}: ${generated.public.prompt}`);
    assert.equal(matches[0]!.id, generated.answer);
    if (rowsHaveEmpty(options.find((o) => o.id === generated.answer)!.label))
      seen.add("empty-stem");
    if (new Set(values).size < values.length) seen.add("repeat");
    if (values.some((v) => v < 10)) seen.add("stem-zero");
  }
  for (const key of [
    "v0",
    "v1",
    "v2",
    "v3",
    "v4",
    "v5",
    "decimal",
    "whole",
    "empty-stem",
    "repeat",
    "stem-zero",
  ])
    assert.ok(seen.has(key), key);
});
const rowsHaveEmpty = (label: string) =>
  parsePlot(label).some((r) => r.leaves.length === 0);

test("frequency table: the choice matches an independent count of the data", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = frequencyTableCase(`s:${seed}`);
    seen.add(`v${c.variant}`);
    const { generated, options } = choices(
      "frequency-table-build",
      `s:${seed}`,
    );
    const label = options.find((o) => o.id === generated.answer)!.label;
    const values = c.values;
    if (c.variant === 0 || c.variant === 4) {
      const count = Number(label);
      if (c.variant === 0) {
        const v = Number(/exactly (\d+) /.exec(generated.public.prompt)![1]);
        assert.equal(count, values.filter((x) => x === v).length);
      } else {
        const [a, b] = /interval (\d+)–(\d+)\?/
          .exec(generated.public.prompt)!
          .slice(1)
          .map(Number) as [number, number];
        assert.equal(count, values.filter((x) => x >= a && x <= b).length);
        if (values.some((x) => x === a) && values.some((x) => x === b))
          seen.add("both-ends");
      }
      continue;
    }
    const rows = label.split(", ").map((x) => x.split(": "));
    let sum = 0;
    for (const [name, f] of rows) {
      const m = /^(\d+)–(\d+)$/.exec(name!);
      const lo = m ? Number(m[1]) : Number(name);
      const hi = m ? Number(m[2]) : Number(name);
      assert.equal(
        Number(f),
        values.filter((x) => x >= lo && x <= hi).length,
        `${seed} ${label}`,
      );
      if (Number(f) === 0) seen.add("zero-row");
      sum += Number(f);
    }
    assert.equal(sum, values.length);
    if (c.variant === 2) {
      const fig = generated.public.figure;
      assert.equal(fig?.kind, "line-plot");
      if (fig?.kind === "line-plot")
        assert.deepEqual([...fig.values].sort(), [...values].sort());
    }
  }
  for (const key of [
    "v0",
    "v1",
    "v2",
    "v3",
    "v4",
    "v5",
    "zero-row",
    "both-ends",
  ])
    assert.ok(seen.has(key), key);
});

test("circle graph: percent, angle and count agree with an independent computation", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = circleGraphCase(`s:${seed}`);
    seen.add(`v${c.variant}`);
    const { generated, options } = choices("circle-graph-read", `s:${seed}`);
    const label = options.find((o) => o.id === generated.answer)!.label;
    const figure = generated.public.figure;
    assert.equal(figure?.kind, "scene");
    const prompt = generated.public.prompt;
    const value = Number(label.replace(/[%°]/g, ""));
    assert.ok(c.percents.reduce((a, b) => a + b, 0) === 100);
    if (c.variant === 0 || c.variant === 4)
      assert.ok(c.percents.map((p) => (p * c.N) / 100).includes(value));
    if (c.variant === 1 || c.variant === 3)
      assert.ok(c.percents.includes(value));
    if (c.variant === 2)
      assert.ok(c.percents.map((p) => p * 3.6).includes(value));
    if (c.variant === 5) assert.ok(prompt.includes("How many more"));
    if (c.variant === 6) {
      assert.equal(value % 18, 0);
      assert.ok(c.percents.at(-1)! * 3.6 === value);
    }
    assert.ok(Number.isInteger(value));
  }
  for (let v = 0; v < 7; v++) assert.ok(seen.has(`v${v}`), `v${v}`);
});

test("best display: each situation has exactly one defensible display among the choices", () => {
  const seen = new Set<string>();
  const banned: Record<string, string[]> = {
    circle: ["bar"],
    bar: ["circle", "histogram"],
    line: ["bar", "scatter"],
    histogram: ["bar", "dotstem"],
    scatter: ["line", "bar"],
    dotstem: ["histogram", "bar"],
  };
  const scenarios = new Set<string>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = bestDisplayCase(`s:${seed}`);
    seen.add(c.answer);
    scenarios.add(`${c.answer}${c.index}`);
    for (const d of c.shown.slice(1))
      assert.ok(!banned[c.answer]!.includes(d), `${c.answer} with ${d}`);
    assert.equal(new Set(c.shown).size, 4);
  }
  assert.equal(seen.size, 6);
  assert.equal(scenarios.size, 24);
});

test("return claim: the correct choice is the independently computed simple yearly rate", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < SEEDS; seed++) {
    const c = returnClaimCase(`s:${seed}`);
    seen.add(`v${c.variant}`);
    const { generated, options } = choices("return-claim-check", `s:${seed}`);
    const prompt = generated.public.prompt;
    const label = options.find((o) => o.id === generated.answer)!.label;
    const money = [...prompt.matchAll(/(\d+) dollars/g)].map((m) =>
      Number(m[1]),
    );
    if (c.variant >= 2 && c.variant <= 4) {
      const claim = Number(/returns (\d+)% per year/.exec(prompt)![1]);
      const [p, f] = money as [number, number];
      const months = /after (\d+) months/.exec(prompt);
      const years = /after (\d+) years/.exec(prompt);
      const annual = months
        ? ((f - p) / p) * 100 * (12 / Number(months[1]))
        : (((f - p) / p) * 100) / Number(years![1]);
      const m = /^([\d.]+)% per year: the claim is (.+)$/.exec(label)!;
      assert.ok(
        Math.abs(Number(m[1]) - annual) < 1e-9,
        `${prompt} -> ${label}`,
      );
      assert.equal(
        m[2],
        claim === annual ? "accurate" : claim > annual ? "too high" : "too low",
      );
      seen.add(m[2]!);
    } else if (c.variant === 0 || c.variant === 1) {
      const times = [...prompt.matchAll(/in (\d+) years?\./g)].map((x) =>
        Number(x[1]),
      );
      assert.equal(times.length, 2);
      const rates = [0, 1].map((i) => {
        const t = times[i]!;
        return ((money[2 * i + 1]! - money[2 * i]!) / money[2 * i]! / t) * 100;
      });
      const best = rates[0]! > rates[1]! ? "A" : "B";
      assert.ok(label.startsWith(`$${best}$: `), `${prompt} -> ${label}`);
    } else {
      const m = Number(/pays (\d+)% a month/.exec(prompt)![1]);
      const y = Number(/pays (\d+)% a year/.exec(prompt)![1]);
      assert.equal(
        label,
        `${m}% per month is ${12 * m}% per year, ${12 * m > y ? "higher" : "lower"} than ${y}% per year`,
      );
    }
  }
  for (const key of [
    "v0",
    "v1",
    "v2",
    "v3",
    "v4",
    "v5",
    "accurate",
    "too high",
    "too low",
  ])
    assert.ok(seen.has(key), key);
});

test("each template has a bound lesson with method, watch and principle", () => {
  for (const id of ids) {
    const lesson = problemLesson(id, "library");
    assert.ok(lesson.intuition);
    assert.ok(lesson.method.length >= 3);
    assert.ok(lesson.watch);
    assert.ok(lesson.principle);
    assert.ok(lesson.example.steps.length >= 2, id);
  }
});
