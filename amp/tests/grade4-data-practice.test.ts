import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import { generateProblem, templates } from "../src/math/engine";
import { dotPlotArithmeticFamily } from "../src/math/line-graph-read-practice";
import { generateLinePlotProblem } from "../src/math/line-plot-practice";

const SEEDS = 240;
const EXTRA = new Set([3, 5, 6, 10, 12]);
const WIDTHS = [5, 10, 25, 50, 100];
const STEPS = [5, 10, 25, 50, 100];

type DotElement = {
  type: string;
  denominator?: number;
  decimalPlaces?: number;
  unit?: string;
  blank?: boolean;
  fixedLabels?: boolean;
  min: number;
  max: number;
  groups: { values: number[] }[];
};

function load(id: string, seed: string): GeneratedProblem {
  const problem = generateProblem(id, seed);
  generatedProblemSchema.parse(problem);
  return problem;
}

function dotOf(problem: GeneratedProblem): DotElement {
  assert.equal(problem.public.figure?.kind, "scene");
  if (problem.public.figure?.kind !== "scene") throw new Error("scene");
  const element = problem.public.figure.scene.elements[0] as DotElement;
  assert.equal(element.type, "dotPlot");
  return element;
}

function choiceOf(problem: GeneratedProblem) {
  const response = problem.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice");
  const keyed = response.options.find((o) => o.id === problem.answer);
  assert.ok(keyed, problem.answer);
  return { response, keyed: keyed! };
}

function ticksFrom(element: DotElement): { d: number; ticks: number[] } {
  const d = element.denominator ?? 1;
  const ticks = element.groups[0]!.values.map((value) => {
    const scaled = value * d;
    const nearest = Math.round(scaled);
    assert.ok(Math.abs(scaled - nearest) < 1e-6, `${value} off 1/${d}`);
    return nearest;
  });
  return { d, ticks };
}

function tickLabel(tick: number, d: number): string {
  const whole = Math.floor(tick / d);
  const rest = tick - whole * d;
  if (!rest) return String(whole);
  return `${whole ? `${whole} ` : ""}${rest}/${d}`;
}

function inchLabel(tick: number, d: number): string {
  return `${tickLabel(tick, d)} ${tick <= d ? "inch" : "inches"}`;
}

function halfDelta(d: number): number {
  if (d === 2) return 2;
  if (d % 2 === 1) return Math.max(2, Math.round(d / 2));
  return d / 2;
}

function parseLength(token: string, d: number): number {
  const mixed = token.match(/^(\d+) (\d+)\/(\d+)$/);
  if (mixed) {
    assert.equal(Number(mixed[3]), d);
    return Number(mixed[1]) * d + Number(mixed[2]);
  }
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    assert.equal(Number(frac[2]), d);
    return Number(frac[1]);
  }
  assert.match(token, /^\d+$/);
  return Number(token) * d;
}

function lengthList(prompt: string): string[] {
  const match = prompt.match(/The lengths, in inches, are: ([^.]+)\./);
  assert.ok(match, prompt);
  return match![1]!.split(", ").map((part) => part.trim());
}

test("grade-4 data templates sit on the grade-4 skills", () => {
  const skill = (id: string) => templates.find((t) => t.id === id)?.skillId;
  for (const id of [
    "line-plot-build-slots",
    "line-plot-data-match",
    "line-plot-center-range",
  ])
    assert.equal(skill(id), "fraction-plot-arithmetic");
  assert.equal(skill("frequency-table-grade4"), "frequency-bar-graphs");
  assert.equal(skill("scaled-bar-grade4"), "frequency-bar-graphs");
  assert.equal(
    templates.find((t) => t.id === "scaled-bar-grade4")
      ?.requiredFigureCapability,
    "data-displays-v1",
  );
});

test("line-plot-build-slots counts the list onto a blank plot", () => {
  const denoms = new Set<number>();
  let empty = 0;
  let repeated = 0;
  for (let i = 0; i < SEEDS; i++) {
    const problem = load("line-plot-build-slots", `g4-${i}`);
    const response = problem.public.response;
    assert.equal(response.kind, "multi-part-choice");
    if (response.kind !== "multi-part-choice") continue;
    assert.ok(response.blanks.length >= 4 && response.blanks.length <= 6);
    assert.ok(problem.answer.length < 100);
    assert.match(problem.hint, /^Count the listed lengths/);
    assert.doesNotMatch(problem.hint, /appears \d/);
    const element = dotOf(problem);
    assert.equal(element.blank, true);
    assert.equal(element.fixedLabels, true);
    assert.deepEqual(element.groups[0]!.values, []);
    assert.equal(element.unit, "inches");
    const d = element.denominator!;
    denoms.add(d);
    assert.ok(element.min >= 1 && Number.isInteger(element.min));
    assert.ok(element.max <= 4 && element.max > element.min);
    const listed = lengthList(problem.public.prompt);
    for (const token of listed) assert.ok(parseLength(token, d) >= d, token);
    const key: Record<string, string> = {};
    const counts: number[] = [];
    for (const blank of response.blanks) {
      const count = listed.filter((length) => length === blank.label).length;
      counts.push(count);
      const option = blank.options.find((o) => o.label === String(count));
      assert.ok(option, `${blank.label} count ${count}`);
      key[blank.id] = option!.id;
    }
    assert.equal(
      counts.reduce((a, b) => a + b, 0),
      listed.length,
    );
    assert.equal(problem.answer, JSON.stringify(key));
    assert.ok(counts.includes(0));
    assert.ok(counts.some((c) => c >= 2));
    assert.ok(listed.length >= 8);
    if (counts.includes(0)) empty++;
    if (counts.some((c) => c >= 2)) repeated++;
  }
  assert.equal(empty, SEEDS);
  assert.equal(repeated, SEEDS);
  assert.deepEqual(
    [...denoms].sort((a, b) => a - b),
    [2, 4, 8],
  );
});

test("line-plot-data-match distractors move or drop one mark", () => {
  const denoms = new Set<number>();
  const kinds = new Set<string>();
  for (let i = 0; i < SEEDS; i++) {
    const problem = load("line-plot-data-match", `g4-${i}`);
    const response = problem.public.response;
    assert.equal(response.kind, "figure-choice");
    if (response.kind !== "figure-choice") continue;
    assert.match(problem.hint, /^Match the list/);
    const listed = lengthList(problem.public.prompt);
    const scenes = response.options.map((option) => {
      const element = option.scene.elements[0] as DotElement;
      return ticksFrom(element);
    });
    const d = scenes[0]!.d;
    denoms.add(d);
    assert.ok([2, 4, 8].includes(d));
    for (const token of listed) assert.ok(parseLength(token, d) >= d, token);
    const wanted = listed
      .map((token) => parseLength(token, d))
      .sort((a, b) => a - b);
    const signatures = response.options.map((option) =>
      JSON.stringify(option.scene.elements),
    );
    assert.equal(new Set(signatures).size, response.options.length);
    const correctIndex = response.options.findIndex(
      (o) => o.id === problem.answer,
    );
    assert.ok(correctIndex >= 0);
    assert.deepEqual(
      scenes[correctIndex]!.ticks.slice().sort((a, b) => a - b),
      wanted,
    );
    const maxTick = Math.round(scenes[0]!.ticks.length ? 0 : 0);
    const element = response.options[0]!.scene.elements[0] as DotElement;
    const axisMax = Math.round(element.max * d);
    const half = halfDelta(d);
    assert.ok(half >= 2 && half !== 1);
    const correct = scenes[correctIndex]!.ticks;
    for (let k = 0; k < scenes.length; k++) {
      if (k === correctIndex) continue;
      const wrong = scenes[k]!.ticks;
      if (wrong.length === correct.length - 1) {
        kinds.add("drop");
        continue;
      }
      assert.equal(wrong.length, correct.length);
      const up: number[] = [];
      const down: number[] = [];
      for (let t = 0; t <= axisMax; t++) {
        const delta =
          wrong.filter((x) => x === t).length -
          correct.filter((x) => x === t).length;
        if (delta === 1) up.push(t);
        else if (delta === -1) down.push(t);
        else assert.equal(delta, 0, `seed g4-${i} tick ${t}`);
      }
      assert.equal(up.length, 1);
      assert.equal(down.length, 1);
      const distance = Math.abs(up[0]! - down[0]!);
      assert.ok(distance === 1 || distance === half, `distance ${distance}`);
      kinds.add(distance === 1 ? "one" : "half");
    }
    void maxTick;
  }
  assert.deepEqual([...kinds].sort(), ["drop", "half", "one"]);
  assert.deepEqual(
    [...denoms].sort((a, b) => a - b),
    [2, 4, 8],
  );
});

test("line-plot-center-range covers mode, median and range", () => {
  const denoms = new Set<number>();
  const asks = new Set<string>();
  const situations = new Set<string>();
  const sizes = new Set<number>();
  for (let i = 0; i < SEEDS; i++) {
    const problem = load("line-plot-center-range", `g4-${i}`);
    assert.match(problem.public.prompt, /nearest (half|quarter|eighth) inch/);
    assert.match(problem.public.prompt, /\b(modes?|median|range)\b/);
    assert.doesNotMatch(
      problem.public.prompt,
      /^The line plot shows lengths measured to the nearest/,
    );
    assert.doesNotMatch(
      problem.public.prompt,
      /The lengths, in inches, are|no mode/,
    );
    assert.doesNotMatch(problem.hint, /The lengths, in inches, are|no mode/);
    assert.match(problem.hint, /^Read the marks/);
    const { d, ticks } = ticksFrom(dotOf(problem));
    denoms.add(d);
    sizes.add(ticks.length);
    assert.ok(ticks.length % 2 === 1);
    assert.ok(Math.min(...ticks) >= d);
    assert.ok(Math.max(...ticks) <= 4 * d);
    const labels = choiceOf(problem).response.options.map((o) => o.label);
    const aboutMode = /\bmodes?\b/.test(problem.public.prompt);
    if (!aboutMode)
      assert.ok(!labels.includes("no mode"), problem.public.prompt);
    const freq = new Map<number, number>();
    for (const tick of ticks) freq.set(tick, (freq.get(tick) ?? 0) + 1);
    const heights = [...freq.values()];
    const highest = Math.max(...heights);
    const winners = heights.filter((c) => c === highest).length;
    const situation = heights.every((c) => c === 1)
      ? "none"
      : winners === 1 && highest > 1
        ? "one"
        : winners === 2
          ? "several"
          : "";
    assert.ok(situation, `seed g4-${i}`);
    situations.add(situation);
    const asksInPrompt = [
      aboutMode,
      /\bmedian\b/.test(problem.public.prompt),
      /\brange\b/.test(problem.public.prompt),
    ].filter(Boolean);
    assert.equal(asksInPrompt.length, 1, problem.public.prompt);
    const ask = aboutMode
      ? "mode"
      : /\bmedian\b/.test(problem.public.prompt)
        ? "median"
        : "range";
    asks.add(ask);
    const modes = [...freq.entries()]
      .filter(([, c]) => c === highest)
      .map(([t]) => t)
      .sort((a, b) => a - b);
    const label =
      ask === "mode"
        ? heights.every((c) => c === highest)
          ? "no mode"
          : modes.length === 1
            ? inchLabel(modes[0]!, d)
            : `${inchLabel(modes[0]!, d)} and ${inchLabel(modes[1]!, d)}`
        : ask === "median"
          ? inchLabel(
              ticks.slice().sort((a, b) => a - b)[(ticks.length - 1) / 2]!,
              d,
            )
          : inchLabel(Math.max(...ticks) - Math.min(...ticks), d);
    assert.equal(choiceOf(problem).keyed.label, label);
  }
  assert.deepEqual(
    [...denoms].sort((a, b) => a - b),
    [2, 4, 8],
  );
  assert.deepEqual([...asks].sort(), ["median", "mode", "range"]);
  assert.deepEqual([...situations].sort(), ["none", "one", "several"]);
  assert.ok(sizes.has(5) && sizes.has(7));
});

test("frequency-table-grade4 builds intervals and compares them", () => {
  const widths = new Set<number>();
  let builds = 0;
  let interprets = 0;
  const dash = "\u2013";
  const cell = new RegExp(`(\\d+)${dash}(\\d+): (\\d+)`, "g");
  const row = new RegExp(`(\\d+)${dash}(\\d+) has (\\d+)`, "g");
  for (let i = 0; i < SEEDS; i++) {
    const problem = load("frequency-table-grade4", `g4-${i}`);
    const { response, keyed } = choiceOf(problem);
    const prompt = problem.public.prompt;
    if (prompt.includes("The numbers are:")) {
      builds++;
      assert.doesNotMatch(prompt, /How many more/);
      assert.match(problem.hint, /^Sort the numbers into intervals/);
      const list = prompt.match(/The numbers are: ([0-9, ]+)\./);
      assert.ok(list);
      const numbers = list![1]!.split(", ").map(Number);
      assert.ok(numbers.includes(0));
      const width = Number(
        prompt.match(/The intervals are (\d+) units wide/)![1],
      );
      assert.ok(WIDTHS.includes(width));
      widths.add(width);
      assert.match(prompt, new RegExp(`There are ${numbers.length} `));
      const bounds = [0, 1, 2, 3].map(
        (k) => [k * width, (k + 1) * width - 1] as const,
      );
      const shifted = [
        [0, width],
        [width + 1, 2 * width - 1],
        [2 * width, 3 * width - 1],
        [3 * width, 4 * width - 1],
      ] as const;
      let matches = 0;
      let sawShift = false;
      const trueCounts = bounds.map(
        ([lo, hi]) => numbers.filter((n) => n >= lo && n <= hi).length,
      );
      for (const option of response.options) {
        const parts = [...option.label.matchAll(cell)].map((m) => ({
          lo: Number(m[1]),
          hi: Number(m[2]),
          stated: Number(m[3]),
        }));
        assert.equal(parts.length, 4, option.label);
        const recount = parts.every(
          (part) =>
            numbers.filter((n) => n >= part.lo && n <= part.hi).length ===
            part.stated,
        );
        if (recount) matches++;
        const sameCounts = parts.every(
          (part, k) => part.stated === trueCounts[k],
        );
        const isShifted = parts.every(
          (part, k) => part.lo === shifted[k]![0] && part.hi === shifted[k]![1],
        );
        if (sameCounts && isShifted) sawShift = true;
        if (option.id === problem.answer) {
          assert.ok(recount);
          parts.forEach((part, k) => {
            assert.equal(part.lo, bounds[k]![0]);
            assert.equal(part.hi, bounds[k]![1]);
          });
        }
      }
      assert.equal(matches, 1);
      assert.equal(sawShift, true);
      void keyed;
    } else {
      interprets++;
      assert.match(prompt, /How many more/);
      assert.doesNotMatch(prompt, /The numbers are:/);
      assert.match(
        problem.hint,
        /^Add the counts of the first two intervals, then subtract the count of the last interval/,
      );
      assert.match(problem.hint, /both end values/);
      const rows = [...prompt.matchAll(row)].map((m) => Number(m[3]));
      assert.equal(rows.length, 4);
      const diff = rows[0]! + rows[1]! - rows[3]!;
      assert.equal(Number(keyed.label.match(/^(\d+)/)![1]), diff);
      const width =
        Number(prompt.match(new RegExp(`0${dash}(\\d+) has`))![1]) + 1;
      assert.ok(WIDTHS.includes(width));
      widths.add(width);
    }
  }
  assert.ok(builds > 80 && interprets > 80);
  assert.deepEqual(
    [...widths].sort((a, b) => a - b),
    WIDTHS,
  );
});

test("scaled-bar-grade4 is a two-step reading", () => {
  const steps = new Set<number>();
  const more =
    /How many more (\w+) are in (\w+) and (\w+) together than in (\w+)\?/;
  const fewer =
    /How many fewer (\w+) does (\w+) have than (\w+) and (\w+) together\?/;
  const together =
    /(\w+) and (\w+) together have how many more (\w+) than (\w+)\?/;
  const difference =
    /What is the difference between (\w+) and (\w+) together and (\w+), in (\w+)\?/;
  const scale = /(?:counts as|stands for|counts by) (\d+)/;
  for (let i = 0; i < SEEDS; i++) {
    const problem = load("scaled-bar-grade4", `g4-${i}`);
    assert.equal(problem.public.response.kind, "number");
    assert.equal(problem.choiceFeedback, undefined);
    assert.match(problem.hint, /^Read the bar graph scale/);
    const prompt = problem.public.prompt;
    const stepMatch = prompt.match(scale);
    const moreMatch = prompt.match(more);
    const fewerMatch = prompt.match(fewer);
    const togetherMatch = prompt.match(together);
    const differenceMatch = prompt.match(difference);
    assert.ok(stepMatch, prompt);
    const step = Number(stepMatch![1]);
    let unit: string;
    let names: string[];
    if (moreMatch) {
      unit = moreMatch[1]!;
      names = [moreMatch[2]!, moreMatch[3]!, moreMatch[4]!];
    } else if (fewerMatch) {
      unit = fewerMatch[1]!;
      names = [fewerMatch[3]!, fewerMatch[4]!, fewerMatch[2]!];
    } else if (togetherMatch) {
      unit = togetherMatch[3]!;
      names = [togetherMatch[1]!, togetherMatch[2]!, togetherMatch[4]!];
    } else if (differenceMatch) {
      unit = differenceMatch[4]!;
      names = [differenceMatch[1]!, differenceMatch[2]!, differenceMatch[3]!];
    } else {
      assert.fail(prompt);
    }
    assert.ok(STEPS.includes(step));
    steps.add(step);
    assert.equal(problem.public.figure?.kind, "scaled-bar-graph");
    if (problem.public.figure?.kind !== "scaled-bar-graph") continue;
    const figure = problem.public.figure;
    assert.equal(figure.step, step);
    assert.equal(figure.unit, unit);
    assert.ok(figure.max / figure.step <= 10);
    const grain = step % 2 === 0 ? step / 2 : step;
    const values = new Map(figure.categories.map((c) => [c.label, c.value]));
    assert.equal(figure.categories.length, 4);
    assert.equal(values.size, 4);
    for (const value of values.values()) {
      assert.ok(value > 0 && value % grain === 0 && value <= figure.max);
    }
    for (const name of names) assert.ok(values.has(name));
    const diff =
      values.get(names[0]!)! + values.get(names[1]!)! - values.get(names[2]!)!;
    assert.equal(problem.answer, String(diff));
    assert.ok(diff > 0);
    for (const line of [...problem.explanation, problem.hint])
      assert.doesNotMatch(line, /(?<![\d,])\d{4,}(?!\d)/);
    if (problem.answer !== String(step))
      assert.doesNotMatch(
        prompt,
        new RegExp(`\\b${problem.answer} ${unit}\\b`),
      );
  }
  assert.deepEqual(
    [...steps].sort((a, b) => a - b),
    STEPS,
  );
});

test("hundredths dot plots recompute from the marks", () => {
  const asks = ["total", "range", "missing-value"] as const;
  const amount =
    /^(\d+)(?:\.(\d{2}))? (mile|miles|foot|feet|pound|pounds|inch|inches|book|books|basket|baskets|fish|lap|laps|ticket|tickets)$/;
  const unitsOf = (label: string) => {
    const match = label.match(amount);
    assert.ok(match, label);
    return Number(match![1]) * 100 + (match![2] ? Number(match![2]) : 0);
  };
  for (const ask of asks) {
    let fractional = 0;
    for (let i = 0; i < 24; i++) {
      const problem = dotPlotArithmeticFamily.generate(
        `hundredths-${ask}-${i}`,
        {
          "data-domain": "hundredths",
          ask,
        },
      ).problem;
      generatedProblemSchema.parse(problem);
      const element = dotOf(problem);
      assert.equal(element.denominator, 100);
      assert.equal(element.decimalPlaces, 2);
      assert.ok(
        ["miles", "feet", "pounds", "inches"].includes(element.unit ?? ""),
        element.unit,
      );
      const { ticks } = ticksFrom(element);
      assert.ok(ticks.length >= 3);
      assert.ok(new Set(ticks).size >= 3);
      assert.ok(new Set(ticks).size < ticks.length);
      if (ticks.some((t) => t % 100 !== 0)) fractional++;
      const sum = ticks.reduce((a, b) => a + b, 0);
      const label = choiceOf(problem).keyed.label;
      const prompt = problem.public.prompt;
      if (ask === "total") {
        assert.match(prompt, /in all \d+|total (?:length|weight|height)/);
        assert.equal(unitsOf(label), sum);
      } else if (ask === "range") {
        assert.match(prompt, /difference between the greatest and the least/);
        assert.equal(unitsOf(label), Math.max(...ticks) - Math.min(...ticks));
      } else {
        const unitWord = "mile|miles|foot|feet|pound|pounds|inch|inches";
        const grand =
          prompt.match(
            new RegExp(`(\\d+(?:\\.\\d{2})? (?:${unitWord})) in all`),
          ) ??
          prompt.match(/total length of (\d+(?:\.\d{2})? (?:foot|feet))/) ??
          prompt.match(/weigh (\d+(?:\.\d{2})? pounds?) together/) ??
          prompt.match(/total height of (\d+(?:\.\d{2})? inches)/);
        assert.ok(grand, prompt);
        assert.equal(unitsOf(label), unitsOf(grand![1]!) - sum);
      }
    }
    assert.ok(fractional > 0, ask);
  }
});

test("legacy dot-plot and fourths-eighths line plots replay", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/grade4-data-legacy.json", import.meta.url),
      "utf8",
    ),
  ) as Record<
    string,
    {
      seed: string;
      prompt: string;
      answer: string;
      hint: string;
      explanation: string[];
      response: GeneratedProblem["public"]["response"];
      figure: GeneratedProblem["public"]["figure"];
    }[]
  >;
  const content = (problem: GeneratedProblem) => ({
    prompt: problem.public.prompt,
    answer: problem.answer,
    hint: problem.hint,
    explanation: problem.explanation,
    response: problem.public.response,
    figure: problem.public.figure,
  });
  for (const row of fixture["dot-plot-arithmetic"]!) {
    const problem = dotPlotArithmeticFamily.generate(row.seed, {
      "data-domain": "current",
      story: "classic",
    }).problem;
    assert.deepEqual(content(problem), {
      prompt: row.prompt,
      answer: row.answer,
      hint: row.hint,
      explanation: row.explanation,
      response: row.response,
      figure: row.figure,
    });
  }
  let legacy = 0;
  const seen = new Set<number>();
  let eighths = 0;
  for (const row of fixture["fraction-plot-difference"]!) {
    const problem = generateLinePlotProblem(
      "fraction-plot-difference",
      row.seed,
      { setting: "plain" },
    );
    const denom = problem.variant?.axes?.denominator;
    if (problem.public.figure?.kind === "line-plot")
      seen.add(problem.public.figure.denominator);
    if (denom !== "fourths-eighths") continue;
    legacy++;
    if (
      problem.public.figure?.kind === "line-plot" &&
      problem.public.figure.denominator === 8
    )
      eighths++;
    assert.deepEqual(content(problem), {
      prompt: row.prompt,
      answer: row.answer,
      hint: row.hint,
      explanation: row.explanation,
      response: row.response,
      figure: row.figure,
    });
  }
  assert.ok(legacy > 0, "expected a fourths-eighths legacy seed");
  assert.ok(eighths > 0);
  for (let i = 0; i < SEEDS; i++) {
    const problem = generateProblem("fraction-plot-difference", `extra-${i}`);
    const denom = problem.variant?.axes?.denominator;
    assert.ok(denom);
    if (problem.public.figure?.kind === "line-plot") {
      seen.add(problem.public.figure.denominator);
      assert.ok(problem.public.figure.values.every((v) => v > 0));
      if (denom === "fourths-eighths") {
        assert.equal(problem.public.figure.unit, "inches");
        assert.ok(
          problem.public.figure.denominator === 4 ||
            problem.public.figure.denominator === 8,
        );
      } else {
        assert.notEqual(problem.public.figure.unit, "inches");
        assert.doesNotMatch(problem.public.prompt, /inch/);
      }
    }
  }
  assert.ok(
    [...seen].some((d) => EXTRA.has(d)),
    [...seen].join(","),
  );
  assert.ok(seen.has(8));
});
