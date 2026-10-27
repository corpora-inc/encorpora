import test from "node:test";
import assert from "node:assert/strict";
import { texasK2Case, texasK2Templates } from "../src/math/texas-k2-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";

const ids = texasK2Templates.map((t) => t.id);
const expectedVariants: Record<string, string[]> = {
  "coin-name-and-cent-value": [
    "name-coin",
    "picture-of-coin",
    "write-cents-picture",
    "write-cents-name",
  ],
  "solid-bottom-face-shape": [
    "cube",
    "box",
    "triangular prism",
    "square pyramid",
    "triangular pyramid",
    "cylinder",
    "cone",
  ],
  "measurable-attribute-choice": [
    "attribute-of-question",
    "question-for-attribute",
    "decide-what-to-measure",
  ],
  "dot-group-compared-to-number": [
    "more-than-number",
    "fewer-than-number",
    "same-as-number",
    "same-as-group",
  ],
  "story-sentence-match-20": ["sentence-for-story", "story-for-sentence"],
  "story-sentence-match-1000": ["sentence-for-story", "story-for-sentence"],
  "open-number-line-to-120": ["read-point", "locate-number"],
  "open-number-line-to-1000": ["read-point", "locate-number"],
  "eighths-and-parts-beyond-one": [
    "name-share",
    "parts-make-whole",
    "count-in-all",
    "wholes-and-parts",
  ],
  "decompose-flat-shape": ["diagonal", "both-diagonals", "strips", "grid"],
  "unit-size-and-count": ["which-fewer", "predict-count", "why-more"],
  "benchmark-length-estimate": ["repeat-benchmark", "reasonable-estimate"],
  "clock-minute-match": ["read-minute", "match-clock", "minutes-after-hour"],
  "tally-and-t-chart": [
    "read-tally",
    "compare-tally",
    "total-tally",
    "make-t-chart",
  ],
  "early-money-decisions": [
    "earned-income",
    "gift",
    "spending",
    "saving",
    "deposit",
    "withdrawal",
    "savings-total",
    "producer-consumer",
    "production-cost",
  ],
};
const skills: Record<string, string> = {
  "coin-name-and-cent-value": "money-values",
  "solid-bottom-face-shape": "polygon-properties",
  "measurable-attribute-choice": "compare-attributes",
  "dot-group-compared-to-number": "compare-small-groups",
  "story-sentence-match-20": "addition-stories",
  "story-sentence-match-1000": "two-step-stories",
  "open-number-line-to-120": "compare-two-digit",
  "open-number-line-to-1000": "hundreds-place-value",
  "eighths-and-parts-beyond-one": "thirds-and-partitions",
  "decompose-flat-shape": "compose-shapes",
  "unit-size-and-count": "measure-equal-units",
  "benchmark-length-estimate": "ruler-measurement",
  "clock-minute-match": "clock-five-minutes",
  "tally-and-t-chart": "categorical-data",
  "early-money-decisions": "money-values",
};

const options = (g: ReturnType<typeof generateProblem>) => {
  const response = g.public.response;
  assert.equal(response.kind, "choice");
  return response.kind === "choice" ? response.options : [];
};
const correctLabel = (g: ReturnType<typeof generateProblem>) =>
  options(g).find((o) => o.id === g.answer)!.label;
const sceneElements = (g: ReturnType<typeof generateProblem>): any[] => {
  const figure = g.public.figure as any;
  assert.equal(figure.kind, "scene");
  return figure.scene.elements;
};

test("every template is deterministic, reachable through the engine and covers every variant", () => {
  assert.equal(ids.length, 15);
  for (const id of ids) {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const a = texasK2Case(id, `s${seed}`);
      const b = texasK2Case(id, `s${seed}`);
      assert.deepEqual(a.problem, b.problem);
      seen.add(a.variant);
      if (seed < 40) {
        const viaEngine = generateProblem(id, `s${seed}`);
        assert.equal(viaEngine.public.id, a.problem.public.id);
        assert.equal(viaEngine.answer, a.problem.answer);
      }
    }
    assert.deepEqual([...seen].sort(), [...expectedVariants[id]!].sort(), id);
    assert.equal(templates.find((t) => t.id === id)?.skillId, skills[id]);
  }
});

test("choices are distinct, exactly one is correct, each wrong choice has feedback, and the answer never leaks", () => {
  for (const id of ids) {
    for (let seed = 0; seed < 400; seed++) {
      const g = texasK2Case(id, `c${seed}`).problem;
      assert.ok(g.hint.length > 20 && g.explanation.length >= 2, id);
      const opts = options(g);
      assert.ok(opts.length === 3 || opts.length === 4, id);
      assert.equal(new Set(opts.map((o) => o.label)).size, opts.length, id);
      const correct = opts.find((o) => o.id === g.answer)!;
      assert.ok(correct, id);
      for (const o of opts)
        if (o.id !== g.answer)
          assert.ok((g.choiceFeedback?.[o.id] ?? "").length > 10, o.label);
      if (correct.label.length > 1) {
        const text = `${g.public.prompt}\n${g.hint}`;
        const numeric = /^-?[\d,.]+$/.test(correct.label);
        assert.ok(
          numeric
            ? !new RegExp(`(?<![\\d.,])${correct.label}(?![\\d]|[.,]\\d)`).test(
                text,
              )
            : !text.includes(correct.label),
          `${id}: ${correct.label}`,
        );
      }
      // Scene figures never state the answer in a caption or note.
      const figure = g.public.figure as any;
      if (figure?.kind === "scene" && figure.scene.note)
        assert.ok(
          !new RegExp(`(?<![\\d.,])${correct.label}(?![\\d]|[.,]\\d)`).test(
            figure.scene.note,
          ),
          id,
        );
    }
  }
});

test("coins: the named coin has the pictured value and the written value uses the cent symbol", () => {
  const cents: Record<string, number> = {
    penny: 1,
    nickel: 5,
    dime: 10,
    quarter: 25,
  };
  for (let seed = 0; seed < 300; seed++) {
    const { variant, problem } = texasK2Case(
      "coin-name-and-cent-value",
      `k${seed}`,
    );
    const g = generateProblem("coin-name-and-cent-value", `k${seed}`);
    const figure = problem.public.figure as any;
    const label = correctLabel(g);
    if (variant === "name-coin") {
      const item = figure.sets[0].items[0] as string;
      assert.equal(label, item);
      assert.equal(figure.sets[0].items.length, 1);
    } else if (variant === "picture-of-coin") {
      const named = /shows a (\w+)\?/.exec(problem.public.prompt)![1]!;
      const index = "ABC".indexOf(label.replaceAll("$", ""));
      assert.deepEqual(
        figure.sets.map((s: any) => s.label),
        ["A", "B", "C"],
      );
      assert.equal(figure.sets[index].items[0], named);
      assert.equal(
        figure.sets.filter((s: any) => s.items[0] === named).length,
        1,
      );
    } else {
      assert.match(label, /^\d+¢$/);
      const value = Number(label.slice(0, -1));
      if (variant === "write-cents-picture")
        assert.equal(cents[figure.sets[0].items[0]], value);
      else {
        const named = /^A (\w+) is worth/.exec(problem.public.prompt)![1]!;
        assert.equal(cents[named], value);
      }
    }
  }
});

test("solids: the correct shape is the base polygon or ellipse of the pictured solid", () => {
  for (let seed = 0; seed < 300; seed++) {
    const { problem } = texasK2Case("solid-bottom-face-shape", `v${seed}`);
    const g = generateProblem("solid-bottom-face-shape", `v${seed}`);
    const solid = (problem.public.figure as any).solid;
    const base = solid.base;
    const label = correctLabel(g);
    if (base.type === "ellipse") assert.equal(label, "circle");
    else {
      const pts: [number, number][] = base.points;
      const sides = pts.length;
      const lens = pts.map(([x, y], i) => {
        const [u, v] = pts[(i + 1) % sides]!;
        return Math.hypot(u - x, v - y);
      });
      const equal = lens.every((l) => Math.abs(l - lens[0]!) < 0.02);
      if (sides === 3) assert.equal(label, "triangle");
      else if (equal) assert.equal(label, "square");
      else assert.equal(label, "rectangle");
    }
    const labels = options(g).map((o) => o.label);
    // A square is a rectangle: the two are never both offered.
    if (label === "square") assert.ok(!labels.includes("rectangle"));
  }
});

test("dot groups: counts come from the drawn circles and satisfy the stated relation", () => {
  for (let seed = 0; seed < 300; seed++) {
    const { variant, problem } = texasK2Case(
      "dot-group-compared-to-number",
      `d${seed}`,
    );
    const g = generateProblem("dot-group-compared-to-number", `d${seed}`);
    const elements = sceneElements(g);
    const names = elements.filter((e) => e.type === "text").map((e) => e.text);
    const dots = elements
      .filter((e) => e.type === "path")
      .map((e) => e.d.filter((op: any[]) => op[0] === "M").length);
    const countOf: Record<string, number> = Object.fromEntries(
      names.map((n: string, i: number) => [n, dots[i]!]),
    );
    const label = correctLabel(g);
    const hit = (pred: (n: number) => boolean) =>
      Object.entries(countOf).filter(([n, c]) => n !== "Start" && pred(c));
    if (variant === "same-as-group") {
      const same = hit((c) => c === countOf["Start"]);
      assert.deepEqual(
        same.map(([n]) => n),
        [label],
      );
    } else {
      const N = Number(/(\d+)/.exec(problem.public.prompt)![1]);
      const pred =
        variant === "more-than-number"
          ? (c: number) => c > N
          : variant === "fewer-than-number"
            ? (c: number) => c < N
            : (c: number) => c === N;
      assert.deepEqual(
        hit(pred).map(([n]) => n),
        [label],
      );
    }
    assert.ok(Object.values(countOf).every((c) => c >= 0 && c <= 20));
  }
});

/** Independent solver for "a + b = □"-style sentences; returns the box value. */
function boxValue(sentence: string): number {
  const m = /^(□|\d+) ([+−]) (□|\d+) = (□|\d+)$/.exec(sentence);
  assert.ok(m, sentence);
  const [, x, op, y, z] = m;
  const num = (s: string) => Number(s);
  if (z === "□") return op === "+" ? num(x!) + num(y!) : num(x!) - num(y!);
  if (x === "□") return op === "+" ? num(z!) - num(y!) : num(z!) + num(y!);
  return op === "+" ? num(z!) - num(x!) : num(x!) - num(z!);
}
function storyAnswer(text: string): number {
  const nums = [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));
  if (/gets some more/.test(text)) return nums[1]! - nums[0]!;
  if (/gets \d+ more/.test(text)) return nums[0]! + nums[1]!;
  if (/gave away \d+\. Now/.test(text)) return nums[0]! + nums[1]!;
  if (/gives away/.test(text)) return nums[0]! - nums[1]!;
  if (/How many more .* than/.test(text)) return nums[0]! - nums[1]!;
  throw new Error(text);
}
test("story and sentence: the matching choice is the only one whose box value fits the story", () => {
  for (const [id, hi] of [
    ["story-sentence-match-20", 20],
    ["story-sentence-match-1000", 1000],
  ] as const) {
    for (let seed = 0; seed < 400; seed++) {
      const { variant, problem } = texasK2Case(id, `m${seed}`);
      const g = generateProblem(id, `m${seed}`);
      const opts = options(g);
      if (variant === "sentence-for-story") {
        const story = problem.public.prompt.replace(/^.*find\. /, "");
        const answer = storyAnswer(story);
        const fits = opts.filter((o) => boxValue(o.label) === answer);
        assert.deepEqual(
          fits.map((o) => o.id),
          [g.answer],
          problem.public.prompt,
        );
        assert.ok(answer >= 0 && answer <= hi);
      } else {
        const sentence = /matches (.+)\? The box/.exec(
          problem.public.prompt,
        )![1]!;
        const value = boxValue(sentence);
        const fits = opts.filter((o) => storyAnswer(o.label) === value);
        assert.deepEqual(
          fits.map((o) => o.id),
          [g.answer],
          problem.public.prompt,
        );
      }
    }
  }
});

test("number lines: labels, marks and answers agree with the stated numbers", () => {
  for (const [id, hi] of [
    ["open-number-line-to-120", 120],
    ["open-number-line-to-1000", 1000],
  ] as const) {
    for (let seed = 0; seed < 300; seed++) {
      const { variant, problem } = texasK2Case(id, `n${seed}`);
      const g = generateProblem(id, `n${seed}`);
      const line = sceneElements(g).find((e) => e.type === "numberLine");
      assert.ok(line.max <= hi && line.min >= 0);
      assert.equal(line.labels.length, 3);
      for (const m of line.marks)
        assert.equal((m.at - line.min) % line.step, 0, "marks sit on ticks");
      if (variant === "read-point") {
        assert.equal(line.marks.length, 1);
        assert.equal(Number(correctLabel(g)), line.marks[0].at);
      } else {
        const n = Number(/at (\d+) on/.exec(problem.public.prompt)![1]);
        const at = line.marks.filter((m: any) => m.at === n);
        assert.equal(at.length, 1);
        assert.equal(at[0].label, correctLabel(g).replaceAll("$", ""));
        assert.equal(new Set(line.marks.map((m: any) => m.at)).size, 4);
      }
    }
  }
});

test("fractions: the scene's parts and shaded count give the stated answer", () => {
  const names: Record<number, string[]> = {
    2: ["half", "halves"],
    3: ["third", "thirds"],
    4: ["fourth", "fourths"],
    8: ["eighth", "eighths"],
  };
  for (let seed = 0; seed < 400; seed++) {
    const { variant } = texasK2Case("eighths-and-parts-beyond-one", `f${seed}`);
    const g = generateProblem("eighths-and-parts-beyond-one", `f${seed}`);
    const bar = sceneElements(g).find((e) => e.type === "fractionBar").bars[0];
    const label = correctLabel(g);
    const n = names[bar.parts]!;
    const plural = (k: number) => `${k} ${k === 1 ? n[0] : n[1]}`;
    if (variant === "name-share") assert.equal(label, plural(bar.shaded));
    else if (variant === "parts-make-whole")
      assert.equal(label, `${bar.parts}`);
    else if (variant === "count-in-all") assert.equal(label, `${bar.shaded}`);
    else {
      assert.equal(bar.wholes, 2);
      assert.ok(bar.shaded > bar.parts && bar.shaded < 2 * bar.parts);
      assert.equal(label, `1 whole and ${plural(bar.shaded - bar.parts)}`);
    }
    assert.equal(bar.label, false, "the bar never prints the answer");
  }
});

test("decomposed shapes: part count and kind follow from the cut and the shape", () => {
  for (let seed = 0; seed < 300; seed++) {
    const g = generateProblem("decompose-flat-shape", `p${seed}`);
    const s = (g.public.figure as any).shapes[0];
    const label = correctLabel(g);
    const [n, kind] = label.split(" ") as [string, string];
    const parts =
      s.cut === "diagonal"
        ? 2
        : s.cut === "diagonals" || s.cut === "grid"
          ? 4
          : s.sizes.length;
    assert.equal(Number(n), parts);
    const expected =
      s.cut === "diagonal" || s.cut === "diagonals"
        ? "triangles"
        : s.cut === "grid" && s.shape === "square"
          ? "squares"
          : "rectangles";
    assert.equal(kind, expected);
    // A square is a rectangle, so a square grid never offers "rectangles" as a wrong choice.
    if (expected === "squares")
      assert.ok(
        !options(g).some((o) => o.label === `${parts} rectangles`),
        "4 rectangles is also true for 4 squares",
      );
  }
});

test("unit rows: copies times unit length covers the ribbon, and the answer follows the drawn units", () => {
  for (let seed = 0; seed < 300; seed++) {
    const { variant } = texasK2Case("unit-size-and-count", `u${seed}`);
    const g = generateProblem("unit-size-and-count", `u${seed}`);
    const el = sceneElements(g);
    const ribbon = el.find((e) => e.type === "rect")!;
    const rows = new Map<number, any[]>();
    for (const e of el.filter((x) => x.type === "rect").slice(1))
      rows.set(e.at[1], [...(rows.get(e.at[1]) ?? []), e]);
    const lists = [...rows.values()];
    if (variant === "predict-count") {
      const [small, long] = lists as [any[], any[]];
      assert.equal(small.length * small[0].size[0], ribbon.size[0]);
      const k = long[0].size[0] / small[0].size[0];
      assert.equal(Number(correctLabel(g)), small.length / k);
    } else {
      for (const row of lists)
        assert.equal(row.length * row[0].size[0], ribbon.size[0]);
      const [a, b] = lists as [any[], any[]];
      if (variant === "which-fewer") {
        const longer = a[0].size[0] > b[0].size[0] ? "A" : "B";
        assert.equal(correctLabel(g), `Unit $${longer}$, because it is longer`);
      } else {
        const moreIsA = a.length > b.length;
        const prompt = g.public.prompt;
        assert.match(
          prompt,
          new RegExp(`Row \\$${moreIsA ? "A" : "B"}\\$ uses more units`),
        );
        assert.match(correctLabel(g), /is shorter than unit/);
      }
    }
  }
});

test("benchmark estimates repeat the stated length, and reasonable estimates keep their unit", () => {
  for (let seed = 0; seed < 300; seed++) {
    const { variant, problem } = texasK2Case(
      "benchmark-length-estimate",
      `b${seed}`,
    );
    const g = generateProblem("benchmark-length-estimate", `b${seed}`);
    if (variant === "repeat-benchmark") {
      const m =
        /about (\d+) \w+ long\. .* about (\d+) .* long, end to end/.exec(
          problem.public.prompt,
        )!;
      assert.equal(parseInt(correctLabel(g), 10), Number(m[1]) * Number(m[2]));
    } else {
      assert.match(
        correctLabel(g),
        /^\d+ (inches|feet|centimeters|meters|inch|centimeter)$/,
      );
    }
  }
});

test("clocks: the digital time, the minutes after the hour and the matching clock agree with the figure", () => {
  const time = (h: number, m: number) => `${h}:${String(m).padStart(2, "0")}`;
  let nonFive = 0;
  for (let seed = 0; seed < 300; seed++) {
    const { variant, problem } = texasK2Case("clock-minute-match", `t${seed}`);
    const g = generateProblem("clock-minute-match", `t${seed}`);
    const clocks = (problem.public.figure as any).clocks;
    if (variant === "match-clock") {
      const t = /shows (\d+:\d\d)\?/.exec(problem.public.prompt)![1]!;
      const index = "ABC".indexOf(correctLabel(g));
      assert.equal(time(clocks[index].hour, clocks[index].minute), t);
      assert.equal(
        clocks.filter((c: any) => time(c.hour, c.minute) === t).length,
        1,
      );
    } else {
      const { hour, minute } = clocks[0];
      if (minute % 5) nonFive++;
      if (variant === "read-minute")
        assert.equal(correctLabel(g), time(hour, minute));
      else assert.equal(Number(correctLabel(g)), minute);
    }
  }
  assert.ok(nonFive > 40, "most clocks are between five-minute marks");
});

test("tally charts: counts come from the drawn marks", () => {
  for (let seed = 0; seed < 300; seed++) {
    const { variant, problem } = texasK2Case("tally-and-t-chart", `y${seed}`);
    const g = generateProblem("tally-and-t-chart", `y${seed}`);
    if (variant === "make-t-chart") {
      const list = /were: (.+)\. Which/
        .exec(problem.public.prompt)![1]!
        .split(", ");
      const counts = new Map<string, number>();
      for (const w of list) counts.set(w, (counts.get(w) ?? 0) + 1);
      const expected = [...counts]
        .sort()
        .map(([w, n]) => `${w} ${n}`)
        .join(", ");
      const got = correctLabel(g).split(", ").sort().join(", ");
      assert.equal(got, expected);
      continue;
    }
    const el = sceneElements(g);
    const labels = el.filter(
      (e) => e.type === "text" && e.at[0] === 0 && e.at[1] < -1,
    );
    const tally = new Map<string, number>();
    for (const t of labels) {
      const marks = el.filter(
        (e) =>
          e.type === "segment" &&
          Math.min(e.from[0], e.to[0]) > 3.4 &&
          Math.abs((e.from[1] + e.to[1]) / 2 - t.at[1]) < 0.1,
      );
      tally.set(t.text, marks.length);
    }
    const prompt = problem.public.prompt;
    const label = Number(correctLabel(g));
    if (variant === "read-tally") {
      const word = /chose (\w+)\?/.exec(prompt)![1]!;
      assert.equal(label, tally.get(word));
    } else if (variant === "compare-tally") {
      const m = /chose (\w+) than (\w+)\?/.exec(prompt)!;
      assert.equal(label, tally.get(m[1]!)! - tally.get(m[2]!)!);
      assert.ok(label > 0);
    } else {
      assert.equal(
        label,
        [...tally.values()].reduce((a, b) => a + b, 0),
      );
    }
  }
});

test("money decisions: arithmetic is recomputed from the prompt", () => {
  for (let seed = 0; seed < 600; seed++) {
    const { variant, problem } = texasK2Case(
      "early-money-decisions",
      `$${seed}`,
    );
    const g = generateProblem("early-money-decisions", `$${seed}`);
    const p = problem.public.prompt;
    const label = correctLabel(g);
    if (variant === "savings-total") {
      let m = /saves \$(\d+) each week\. .* after (\d+) weeks\?/.exec(p);
      if (m && !/already/.test(p)) {
        assert.equal(label, `$${Number(m[1]) * Number(m[2])}`);
        continue;
      }
      m =
        /already has \$(\d+) saved and saves \$(\d+) more each week\. .* after (\d+) weeks\?/.exec(
          p,
        );
      if (m) {
        assert.equal(label, `$${Number(m[1]) + Number(m[2]) * Number(m[3])}`);
        continue;
      }
      m =
        /account has \$(\d+)\. .* deposit of \$(\d+) and a withdrawal of \$(\d+)\./.exec(
          p,
        )!;
      assert.equal(label, `$${Number(m[1]) + Number(m[2]) - Number(m[3])}`);
    } else if (variant === "production-cost") {
      const parts = [
        ...p.matchAll(
          /(?:(\d+) [a-z ]+? at (\d+)¢ each|1 [a-z ]+? for (\d+)¢)/g,
        ),
      ];
      const total = parts.reduce(
        (s, m) => s + (m[3] ? Number(m[3]) : Number(m[1]) * Number(m[2])),
        0,
      );
      assert.equal(label, `${total}¢`);
    } else if (variant === "producer-consumer") {
      const [first] = /^(\w+) /.exec(p)!.slice(1);
      assert.ok(label.startsWith(`${first} is the producer`));
    }
  }
});

test("each new template has a lesson, a method and a principle", () => {
  for (const id of ids) {
    const lesson = problemLesson(id, "library");
    assert.ok(lesson.intuition && lesson.intuition.length > 40, id);
    assert.ok(lesson.method.length >= 2, id);
    assert.ok(lesson.watch, id);
    assert.ok(lesson.principle, id);
    assert.ok(lesson.example.steps.length >= 2, id);
  }
});
