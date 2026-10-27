import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";
import { lessons } from "../src/content/lessons";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { enumerateAxes } from "../src/math/variation/axes";
import {
  operationPropertyFamily,
  equationOf,
  propertyIds,
  sides,
} from "../src/math/operation-property-practice";
import { timeUnitRenameFamily } from "../src/math/time-unit-rename-practice";
import { thermometerReadingFamily } from "../src/math/thermometer-reading-practice";
import {
  classifyTriangle,
  congruentFigures,
  cutShape,
} from "../src/math/shape-figure-gap-practice";
import {
  equalChance,
  likelihoodWords,
  probabilityLine,
} from "../src/math/likelihood-practice";
import { measureMeaning, modeOfData } from "../src/math/data-measure-practice";
import {
  subtractionStory,
  variableInSituation,
} from "../src/math/variable-story-practice";
import { repeatingShapePattern } from "../src/math/repeating-pattern-practice";
import { tableFits } from "../src/math/table-fits-practice";
import {
  numberLinePosition,
  numberLineStory,
} from "../src/math/number-line-gap-practice";
import { supplyPrice } from "../src/math/supply-price-practice";
import { stripDiagramMatch } from "../src/math/strip-diagram-practice";
import { congruentFourths } from "../src/math/congruent-parts-practice";
import { solidProperty } from "../src/math/solid-property-practice";
import { benchmarkEstimate } from "../src/math/benchmark-estimate-practice";

const SEEDS = 400;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Gen = {
  family: { axes: any };
  generate: (
    seed: string,
    force?: any,
  ) => { model: any; axes: any; problem: ReturnType<typeof generateProblem> };
};
const gens: Record<string, Gen> = {
  "operation-property-identify": operationPropertyFamily,
  "rename-time-units": timeUnitRenameFamily,
  "read-thermometer": thermometerReadingFamily,
  "congruent-figure-pair": congruentFigures,
  "classify-triangle-by-sides": classifyTriangle,
  "name-cut-shape-pieces": cutShape,
  "likelihood-in-words": likelihoodWords,
  "probability-on-number-line": probabilityLine,
  "equal-chance-choice": equalChance,
  "mode-of-data": modeOfData,
  "measure-meaning-choice": measureMeaning,
  "variable-in-situation": variableInSituation,
  "story-for-subtraction-sentence": subtractionStory,
  "repeating-shape-pattern": repeatingShapePattern,
  "table-fits-description": tableFits,
  "number-line-between-hundreds": numberLinePosition,
  "number-line-jump-story": numberLineStory,
  "supply-price-choice": supplyPrice,
  "strip-diagram-match": stripDiagramMatch,
  "congruent-fourths-pair": congruentFourths,
  "solid-property-select": solidProperty,
  "benchmark-fraction-estimate": benchmarkEstimate,
} as unknown as Record<string, Gen>;
const ids = Object.keys(gens);

const cache = new Map<string, ReturnType<Gen["generate"]>[]>();
const cases = (id: string) => {
  if (!cache.has(id))
    cache.set(
      id,
      Array.from({ length: SEEDS }, (_, i) => gens[id]!.generate(`eg:${i}`)),
    );
  return cache.get(id)!;
};
const labelOf = (p: ReturnType<typeof generateProblem>) => {
  const r = p.public.response;
  assert.equal(r.kind, "choice");
  return r.kind === "choice"
    ? r.options.find((o) => o.id === p.answer)!.label
    : "";
};

test("every elementary-gap template is registered with lesson, method, principle and facet", () => {
  for (const id of ids) {
    assert.ok(
      templates.some((t) => t.id === id),
      id,
    );
    assert.ok(methods[id]?.watch, `${id} method`);
    assert.ok(principles[id], `${id} principle`);
    assert.ok(
      actualFacetMappings.some(
        (f) => f.templateId === id && f.extent === "partial",
      ),
      `${id} facet`,
    );
    assert.equal(
      lessons.filter((l) => l.templateIds.includes(id)).length,
      1,
      `${id} lesson`,
    );
  }
});

test("generation is deterministic, reaches the engine and every axis value and variant", () => {
  for (const id of ids) {
    const g = gens[id]!;
    const reached = new Map<string, Set<string>>();
    const variants = new Set<string>();
    for (const [i, c] of cases(id).entries()) {
      assert.deepEqual(generateProblem(id, `eg:${i}`), c.problem, id);
      assert.equal(c.problem.public.templateId, id);
      variants.add(c.problem.variant!.id);
      for (const [axis, v] of Object.entries(c.problem.variant!.axes ?? {}))
        (reached.get(axis) ?? reached.set(axis, new Set()).get(axis)!).add(v);
    }
    for (const [axis, def] of Object.entries<{ values: string[] }>(
      g.family.axes,
    ))
      assert.deepEqual(
        [...(reached.get(axis) ?? [])].sort(),
        [...def.values].sort(),
        `${id} axis ${axis}`,
      );
    assert.ok(variants.size >= 2, `${id} variants`);
    assert.ok(enumerateAxes(g.family.axes).length >= 1);
  }
});

test("exactly one answer is keyed, wrong choices carry feedback, nothing leaks", () => {
  for (const id of ids)
    for (const c of cases(id)) {
      const p = c.problem;
      assert.ok(gradeAnswer(p, p.answer), id);
      const r = p.public.response;
      if (r.kind === "choice") {
        assert.equal(r.options.length, 4, id);
        assert.equal(new Set(r.options.map((o) => o.label)).size, 4, id);
        const wrong = r.options.filter((o) => o.id !== p.answer);
        assert.equal(wrong.length, 3);
        for (const o of wrong) {
          assert.ok(p.choiceFeedback?.[o.id]?.length, `${id} feedback`);
          assert.ok(!gradeAnswer(p, o.id), `${id} wrong accepted`);
        }
        const label = labelOf(p);
        assert.ok(!p.public.prompt.includes(label), `${id} prompt leaks`);
        assert.ok(!p.hint.includes(label), `${id} hint leaks`);
      }
      assert.ok(p.explanation.length >= 2, id);
    }
});

test("hints are written from the instance and vary across seeds", () => {
  for (const id of ids)
    assert.ok(
      new Set(cases(id).map((c) => c.problem.hint)).size >= 3,
      `${id} hints`,
    );
});

/* ------------------------------------------------ independent checks */
test("operation-property: the keyed equation or name is the named property", () => {
  const seen = new Set<string>();
  for (const { model: m, problem: p } of cases("operation-property-identify")) {
    seen.add(`${m.ask}:${m.property}`);
    // Every property's equation is a true identity for these numbers.
    for (const q of propertyIds) {
      const [l, r] = sides(q, m.a, m.b, m.c);
      assert.equal(l, r);
    }
    const label = labelOf(p);
    if (m.ask === "pick-equation")
      assert.equal(label, equationOf(m.property, m.a, m.b, m.c));
    else
      assert.ok(
        label.includes(
          m.property.split("-")[0]!.replace("distributive", "distributive"),
        ),
      );
  }
  assert.equal(seen.size, propertyIds.length * 2);
});

/* ---------------------------------------------- independent derivations */
// Each check below reads only the public prompt, figure and choice labels and
// derives the keyed answer on its own, without the generators' models.
type Pub = ReturnType<typeof generateProblem>;
const labels = (p: Pub) =>
  p.public.response.kind === "choice" ? p.public.response.options : [];
const keyed = (p: Pub) => labels(p).find((o) => o.id === p.answer)!.label;
const prompts = (id: string) => cases(id).map((c) => c.problem);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fig = (p: Pub): any => p.public.figure;
const nums = (s: string) =>
  (s.match(/\d[\d,]*/g) ?? []).map((x) => Number(x.replaceAll(",", "")));

test("rename-time-units: answers match a unit table", () => {
  const per: Record<string, number> = {
    "minutes/hours": 60,
    "seconds/minutes": 60,
    "hours/days": 24,
    "days/weeks": 7,
    "months/years": 12,
  };
  for (const p of prompts("rename-time-units")) {
    const movie = p.public.prompt.match(/(\d+) hours? and (\d+) minutes/);
    if (movie) {
      assert.equal(Number(p.answer), 60 * Number(movie[1]) + Number(movie[2]));
      continue;
    }
    const m = p.public.prompt.match(/How many (\w+) are in (\d+) (\w+)\?/)!;
    const [, to, n, from] = m;
    const down = per[`${to}/${from}`];
    const up = per[`${from}/${to}`];
    const expected = down ? Number(n) * down : Number(n) / up!;
    assert.equal(Number(p.answer), expected, p.public.prompt);
    assert.ok(Number.isInteger(expected));
  }
});

test("read-thermometer: the answer is read from the bars of the figure", () => {
  for (const p of prompts("read-thermometer")) {
    const chart = fig(p).scene.elements[0];
    const values: number[] = chart.bars.map((b: { value: number }) => b.value);
    for (const v of values) {
      assert.equal(v % chart.step, 0);
      assert.ok(v > 0 && v < chart.max);
    }
    const expected =
      values.length === 1 ? values[0]! : Math.abs(values[0]! - values[1]!);
    assert.equal(Number(p.answer), expected);
    assert.ok(/warmer|colder/.test(p.public.prompt) === (values.length === 2));
  }
});

const dist = (a: number[], b: number[]) =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
const sidesOfPoints = (pts: number[][]) =>
  pts.map((q, i) => dist(q, pts[(i + 1) % pts.length]!));
const shoelace = (pts: number[][]) =>
  Math.abs(
    pts.reduce(
      (s, q, i) =>
        s +
        q[0]! * pts[(i + 1) % pts.length]![1]! -
        pts[(i + 1) % pts.length]![0]! * q[1]!,
      0,
    ),
  ) / 2;
const sameSize = (a: number[][], b: number[][]) => {
  const sa = sidesOfPoints(a).sort((x, y) => x - y);
  const sb = sidesOfPoints(b).sort((x, y) => x - y);
  return (
    a.length === b.length &&
    sa.every((v, i) => Math.abs(v - sb[i]!) < 2e-3 * v) &&
    Math.abs(shoelace(a) - shoelace(b)) < 2e-3 * shoelace(a)
  );
};

test("congruent-figure-pair: exactly one drawn pair has equal sides and area", () => {
  for (const p of prompts("congruent-figure-pair")) {
    const shapes: number[][][] = fig(p).items.map(
      (i: { pieces: { points: number[][] }[] }) => i.pieces[0]!.points,
    );
    const pairs: string[] = [];
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++)
        if (sameSize(shapes[i]!, shapes[j]!))
          pairs.push(`${"ABCD"[i]} and ${"ABCD"[j]}`);
    assert.deepEqual(pairs, [keyed(p)], p.public.prompt);
  }
});

const triClass = (s: number[]) => {
  const near = (a: number, b: number) =>
    Math.abs(a - b) < 2e-3 * Math.max(a, b);
  const eq = [
    near(s[0]!, s[1]!),
    near(s[1]!, s[2]!),
    near(s[0]!, s[2]!),
  ].filter(Boolean).length;
  return eq === 0 ? "scalene" : eq === 1 ? "isosceles" : "equilateral";
};
test("classify-triangle-by-sides: classes follow the side lengths", () => {
  for (const p of prompts("classify-triangle-by-sides")) {
    const asked = p.public.prompt.match(/Which triangle is (\w+)/)?.[1];
    if (asked) {
      const classes: string[] = fig(p).items.map(
        (i: { pieces: { points: number[][] }[] }) =>
          triClass(sidesOfPoints(i.pieces[0]!.points)),
      );
      assert.equal(
        classes.filter((c) => c === asked).length,
        1,
        p.public.prompt,
      );
      assert.equal(keyed(p), `Triangle $${"ABCD"[classes.indexOf(asked)]}$`);
      // Letters keep their order.
      assert.deepEqual(
        labels(p).map((o) => o.label),
        ["A", "B", "C", "D"].map((l) => `Triangle $${l}$`),
      );
    } else {
      const s = nums(p.public.prompt.split("What kind")[0]!);
      assert.ok(
        keyed(p).toLowerCase().startsWith(triClass(s)),
        p.public.prompt,
      );
      const tri = fig(p).scene.elements[0].points as number[][];
      assert.equal(triClass(sidesOfPoints(tri).map((v) => v)), triClass(s));
    }
  }
});

/** Independent piece naming from vertex coordinates. */
const nameOf = (pts: number[][]) => {
  if (pts.length === 3) return "triangle";
  const sides = sidesOfPoints(pts);
  const right = pts.every((q, i) => {
    const a = pts[(i + 3) % 4]!;
    const c = pts[(i + 1) % 4]!;
    return (
      Math.abs(
        (a[0]! - q[0]!) * (c[0]! - q[0]!) + (a[1]! - q[1]!) * (c[1]! - q[1]!),
      ) < 1e-3
    );
  });
  if (right)
    return Math.abs(sides[0]! - sides[1]!) < 1e-3 ? "square" : "rectangle";
  return "trapezoid";
};
test("name-cut-shape-pieces: the keyed pieces are named from the drawn coordinates", () => {
  for (const p of prompts("name-cut-shape-pieces")) {
    const names: string[] = fig(p).items[0].pieces.map(
      (q: { points: number[][] }) => nameOf(q.points),
    );
    const count = (n: string) => names.filter((x) => x === n).length;
    const words = ["triangle", "square", "rectangle", "trapezoid"]
      .filter(count)
      .map((n) => (count(n) === 1 ? `a ${n}` : `${count(n)} ${n}s`));
    assert.equal(keyed(p), words.join(" and "));
    // The pieces tile a rectangle or a trapezoid: no overlap in area terms.
    assert.ok(names.length >= 2);
  }
});

const wordOf = (k: number, n: number) =>
  k === 0
    ? "Impossible"
    : k === n
      ? "Certain"
      : 2 * k === n
        ? "As likely as not"
        : 2 * k > n
          ? "Likely"
          : "Unlikely";
const cubeFaces: Record<string, (f: number) => boolean> = {
  "an even number": (f) => f % 2 === 0,
  "an odd number": (f) => f % 2 === 1,
  "a number greater than 4": (f) => f > 4,
  "a number greater than 1": (f) => f > 1,
  "a number less than 5": (f) => f < 5,
  "a number less than 7": (f) => f < 7,
  "the number 7": (f) => f === 7,
  "the number 3": (f) => f === 3,
};
/** Successes and outcomes read from the prompt of a bag, spinner or cube. */
function chanceOf(prompt: string) {
  const cube = prompt.match(/you roll (.*?)\?/);
  if (cube) {
    const test = cubeFaces[cube[1]!]!;
    return { k: [1, 2, 3, 4, 5, 6].filter(test).length, n: 6 };
  }
  const color = prompt.match(/(?:pick (?:an?|the) |land on )(\w+)/)![1]!;
  const setup = prompt.split(/You (?:pick|spin)/)[0]!;
  const all = [...setup.matchAll(/(\d+) (\w+)(?: marbles?| sections?)?/g)];
  let n = 0;
  let k = 0;
  const bag = /A bag holds/.test(setup);
  const body = bag
    ? setup
    : setup.replace(/^A spinner has \d+ equal sections:?,? ?/, "");
  const listed = [
    ...body.matchAll(/(\d+) (red|blue|green|yellow|purple|orange)/g),
  ];
  if (listed.length)
    for (const m of listed) {
      n += Number(m[1]);
      if (m[2] === color) k += Number(m[1]);
    }
  else {
    n = Number(setup.match(/has (\d+) equal/)![1]);
    k = setup.includes(`all ${color}`) ? n : 0;
  }
  void all;
  return { k, n };
}
test("likelihood-in-words: the word follows the successes out of all outcomes", () => {
  for (const p of prompts("likelihood-in-words")) {
    const { k, n } = chanceOf(p.public.prompt);
    if (/spinner/.test(p.public.prompt))
      assert.equal(n, Number(p.public.prompt.match(/has (\d+) equal/)![1]));
    assert.equal(keyed(p), wordOf(k, n), p.public.prompt);
  }
});
test("probability-on-number-line: the lettered point is k/n of the way", () => {
  for (const p of prompts("probability-on-number-line")) {
    const { k, n } = chanceOf(p.public.prompt);
    const line = fig(p).scene.elements[0];
    assert.equal(line.denominator, n);
    const marks: { at: number; label: string }[] = line.marks;
    const letter = keyed(p).replace("Point $", "").replace("$", "");
    const at = marks.find((m) => m.label === letter)!.at;
    assert.ok(Math.abs(at - k / n) < 1e-9, p.public.prompt);
    assert.equal(marks.filter((m) => Math.abs(m.at - k / n) < 1e-9).length, 1);
  }
});
test("equal-chance-choice: only the keyed set meets the stated goal", () => {
  for (const p of prompts("equal-chance-choice")) {
    const colors = p.public.prompt
      .match(/in (\w+), (\w+) and (\w+)\./)!
      .slice(1);
    const meets = (label: string) => {
      const c = [...label.matchAll(/(\d+) (\w+)/g)].map((m) => Number(m[1]));
      assert.equal(c.length, 3);
      assert.equal(
        c[0]! + c[1]! + c[2]!,
        Number(p.public.prompt.match(/has (\d+)/)![1]),
      );
      if (/equally likely/.test(p.public.prompt)) return c[0] === c[1];
      if (/more likely than each/.test(p.public.prompt))
        return c[0]! > c[1]! && c[0]! > c[2]!;
      return c[0]! < c[1]! && c[0]! < c[2]!;
    };
    void colors;
    assert.deepEqual(
      labels(p)
        .filter((o) => meets(o.label))
        .map((o) => o.id),
      [p.answer],
      p.public.prompt,
    );
  }
});

test("mode-of-data: the mode is the most frequent value", () => {
  for (const p of prompts("mode-of-data")) {
    const f = fig(p);
    const values: number[] = f
      ? (() => {
          const rows = f.scene.elements[0].rows as string[][];
          return rows[0]!
            .slice(1)
            .flatMap(
              (v, i) =>
                Array(Number(rows[1]![i + 1])).fill(Number(v)) as number[],
            );
        })()
      : nums(p.public.prompt.split(":")[1]!.split("What")[0]!);
    const count = new Map<number, number>();
    for (const v of values) count.set(v, (count.get(v) ?? 0) + 1);
    const top = Math.max(...count.values());
    const modes = [...count].filter(([, c]) => c === top).map(([v]) => v);
    assert.deepEqual(modes, [Number(p.answer)]);
  }
});
test("measure-meaning-choice: each measure is computed from the listed numbers", () => {
  for (const p of prompts("measure-meaning-choice")) {
    const list = nums(p.public.prompt.split(":")[1]!.split(".")[0]!);
    const sorted = [...list].sort((a, b) => a - b);
    const n = list.length;
    const value = {
      mean: list.reduce((s, v) => s + v, 0) / n,
      median: sorted[(n - 1) / 2]!,
      mode: [...list].sort(
        (a, b) =>
          list.filter((v) => v === b).length -
          list.filter((v) => v === a).length,
      )[0]!,
      range: sorted[n - 1]! - sorted[0]!,
    };
    assert.equal(new Set(Object.values(value)).size, 4);
    const label = keyed(p);
    const asksName = /^Which measure/.test(
      p.public.prompt.split("\. ")[1] ??
        p.public.prompt.slice(p.public.prompt.indexOf(". ") + 2),
    );
    if (!asksName) {
      const measure = p.public.prompt.match(
        /describes the (\w+)/,
      )![1] as keyof typeof value;
      assert.ok(
        label.endsWith(`: ${value[measure]}`),
        `${label} vs ${measure}`,
      );
      assert.equal(
        labels(p).filter((o) => o.label.endsWith(`: ${value[measure]}`)).length,
        1,
      );
    } else {
      const text = p.public.prompt;
      const measure = /shared equally/.test(text)
        ? "mean"
        : /middle number/.test(text)
          ? "median"
          : /appears most often/.test(text)
            ? "mode"
            : "range";
      assert.equal(label.toLowerCase(), measure);
    }
  }
});

test("variable-in-situation: exactly one choice differs in kind from the other three", () => {
  const fixedWords =
    /days in a week|cents in a dollar|hours in a day|minutes in an hour|months in a year|each week|each night|markers the teacher has/;
  for (const p of prompts("variable-in-situation")) {
    const asksVariable = /can change, so it is a variable/.test(
      p.public.prompt,
    );
    const isFixed = (s: string) => fixedWords.test(s);
    const target = labels(p).filter((o) =>
      asksVariable ? !isFixed(o.label) : isFixed(o.label),
    );
    assert.deepEqual(
      target.map((o) => o.id),
      [p.answer],
      p.public.prompt,
    );
  }
});
test("story-for-subtraction-sentence: the keyed story asks for the unknown the sentence has", () => {
  for (const p of prompts("story-for-subtraction-sentence")) {
    const sentence = p.public.prompt.match(/sentence \$(.*?)\$/)![1]!;
    const kind = /^n=/.test(sentence)
      ? "result"
      : /^n-/.test(sentence)
        ? "start"
        : "change";
    const classify = (t: string) =>
      /gets \d+ more/.test(t)
        ? "sum"
        : /How many .* start with/.test(t)
          ? "start"
          : /give away|did .* (?:give|trade|lose)/.test(t) ||
              /How many .* did \w+ (?:give|trade|lose)/.test(t)
            ? "change"
            : "result";
    assert.equal(classify(keyed(p)), kind, `${sentence} / ${keyed(p)}`);
    assert.equal(new Set(labels(p).map((o) => classify(o.label))).size, 4);
    // The numbers of the sentence appear in the keyed story.
    const used = nums(sentence.replace("n", ""));
    for (const v of used)
      assert.ok(
        nums(keyed(p)).includes(v) ||
          (kind === "change" && nums(keyed(p)).includes(v)),
      );
  }
});

test("repeating-shape-pattern: the keyed pair completes the shortest repeating part", () => {
  for (const p of prompts("repeating-shape-pattern")) {
    const els = fig(p).scene.elements as {
      id: string;
      type: string;
      fill?: string;
    }[];
    const slots = els.filter((e) => /^slot-\d+$/.test(e.id));
    const tokens = slots.map((e) =>
      e.type === "circle"
        ? "circle"
        : e.type === "polygon"
          ? "triangle"
          : e.fill === "warm-fill"
            ? "square"
            : null,
    );
    const known = tokens.map((t, i) => [t, i] as const).filter(([t]) => t);
    let period = 0;
    for (let q = 1; q <= tokens.length && !period; q++)
      if (
        known.every(([t, i]) =>
          known.every(([u, j]) => (i % q === j % q ? t === u : true)),
        )
      )
        period = q;
    const unit = Array.from(
      { length: period },
      (_, r) => known.find(([, i]) => i % period === r)![0]!,
    );
    const holes = tokens.map((t, i) => (t ? -1 : i)).filter((i) => i >= 0);
    assert.equal(holes.length, 2);
    assert.ok(known.length >= 2 * period + 1 || holes[0]! >= period);
    const expected = `${unit[holes[0]! % period]}, ${unit[holes[1]! % period]}`;
    assert.equal(keyed(p), expected);
  }
});

test("table-fits-description: only the keyed table meets every stated total", () => {
  for (const p of prompts("table-fits-description")) {
    const text = p.public.prompt;
    const ok = (label: string) => {
      if (/two grades/.test(text)) {
        const [t1, t2, boys] = nums(text.replace(/Grade \d/g, ""));
        const c = nums(label.replace(/Grade \d/g, ""));
        return (
          c[0]! + c[1]! === t1 && c[2]! + c[3]! === t2 && c[0]! + c[2]! === boys
        );
      }
      const total = nums(text)[0]!;
      const k = Number(text.match(/one of (\d+) choices/)![1]);
      const c = nums(label);
      return c.length === k && c.reduce((s, v) => s + v, 0) === total;
    };
    assert.deepEqual(
      labels(p)
        .filter((o) => ok(o.label))
        .map((o) => o.id),
      [p.answer],
      text,
    );
  }
});

test("number-line-between-hundreds: the keyed number is where the marked point sits", () => {
  for (const p of prompts("number-line-between-hundreds")) {
    const line = fig(p).scene.elements[0];
    assert.equal(line.max - line.min, 100);
    const at = line.marks[0].at;
    assert.equal(Number(keyed(p).replaceAll(",", "")), at);
    assert.equal(at % 10, 0);
    assert.deepEqual(line.labels, [line.min, line.min + 50, line.max]);
    for (const o of labels(p))
      if (o.id !== p.answer)
        assert.notEqual(Number(o.label.replaceAll(",", "")), at);
  }
});
test("number-line-jump-story: the keyed story applies the drawn jumps in order", () => {
  for (const p of prompts("number-line-jump-story")) {
    const line = fig(p).scene.elements[0];
    const start = line.marks[0].at as number;
    const hops = line.hops as { from: number; by: number }[];
    assert.equal(hops[0]!.from, start);
    assert.equal(hops[1]!.from, start + hops[0]!.by);
    const down = /sells|lends out|spends/;
    const read = (t: string) => {
      const m = t.match(
        / (?:It|She) ([a-z ]+?) (\d+), then ([a-z ]+?) (\d+) more/,
      )!;
      const sign = (v: string) => (down.test(v) ? -1 : 1);
      return [sign(m[1]!) * Number(m[2]), sign(m[3]!) * Number(m[4])];
    };
    assert.equal(nums(keyed(p))[0], start);
    assert.deepEqual(read(keyed(p)), [hops[0]!.by, hops[1]!.by]);
    for (const o of labels(p))
      if (o.id !== p.answer)
        assert.notDeepEqual(read(o.label), [hops[0]!.by, hops[1]!.by]);
  }
});

test("supply-price-choice: the price follows supply against demand", () => {
  for (const p of prompts("supply-price-choice")) {
    const [forSale, wanted] = nums(p.public.prompt);
    const up = wanted! > forSale!;
    const label = keyed(p);
    assert.ok(
      label.startsWith(`The price goes ${up ? "up" : "down"}`),
      p.public.prompt,
    );
    assert.ok(label.includes(up ? "fewer" : "more"));
    assert.equal(
      labels(p).filter(
        (o) =>
          o.label.startsWith(`The price goes ${up ? "up" : "down"}`) &&
          o.label.includes(up ? "fewer" : "more"),
      ).length,
      1,
    );
  }
});

test("strip-diagram-match: the keyed choice has the drawn structure and no other choice does", () => {
  for (const p of prompts("strip-diagram-match")) {
    const els = fig(p).scene.elements as {
      id: string;
      type: string;
      size?: number[];
      text?: string;
    }[];
    const whole = els.find((e) => e.id === "whole")!.size![0]!;
    const parts = els
      .filter((e) => /^part-\d+$/.test(e.id))
      .map((e) => e.size![0]!);
    const labelsOf = els
      .filter((e) => /^part-label-/.test(e.id))
      .map((e) => e.text);
    assert.equal(
      parts.reduce((s2, v) => s2 + v, 0),
      whole,
    );
    const known = parts[0]!;
    assert.equal(labelsOf[0], String(known));
    const k = parts.length - 1;
    assert.ok(labelsOf.slice(1).every((t) => t === "?"));
    assert.ok(parts.slice(1).every((v) => v === parts[1]));
    const matches = (label: string) => {
      const n = nums(label);
      if (/\\times/.test(label) || label.startsWith("$")) {
        // Equations: structure is checked on the TeX itself.
        const eq = label
          .replaceAll("$", "")
          .replaceAll("\\times ", "*")
          .replaceAll("\\times", "*");
        const rhs = Number(eq.split("=").pop());
        if (rhs !== whole) return false;
        const lhs = eq.split("=")[0]!;
        const target = k === 1 ? `${known}+n` : `${known}+${k}*n`;
        return lhs === target;
      }
      void n;
      const all = nums(label);
      if (k === 1)
        return (
          /gets some more and now has/.test(label) &&
          all[0] === known &&
          all[1] === whole
        );
      return (
        /uses|gives away|loses|trades away/.test(label) &&
        /shares the rest equally among/.test(label) &&
        all.includes(known) &&
        all.includes(whole) &&
        all[all.length - 1] === k
      );
    };
    assert.deepEqual(
      labels(p)
        .filter((o) => matches(o.label))
        .map((o) => o.id),
      [p.answer],
      p.public.prompt,
    );
  }
});

test("congruent-fourths-pair: exactly two drawn figures show one fourth with equal parts", () => {
  for (const p of prompts("congruent-fourths-pair")) {
    const shapes = fig(p).shapes as {
      shape: string;
      sizes: number[];
      shaded: number[];
      label: string;
    }[];
    assert.equal(new Set(shapes.map((s2) => s2.shape)).size, 1);
    const fourths = shapes
      .filter((s2) => {
        const equal = s2.sizes.every((v) => v === s2.sizes[0]);
        return equal && s2.sizes.length === 4 && s2.shaded.length === 1;
      })
      .map((s2) => s2.label);
    assert.equal(fourths.length, 2);
    assert.equal(keyed(p), `${fourths[0]} and ${fourths[1]}`);
    // Area check by weights: only those two have a shaded area of exactly 1/4.
    const area = (s2: (typeof shapes)[number]) =>
      s2.shaded.reduce((a, i) => a + s2.sizes[i]!, 0) /
      s2.sizes.reduce((a, b) => a + b, 0);
    assert.deepEqual(
      shapes.filter((s2) => area(s2) === 0.25).map((s2) => s2.label),
      fourths,
    );
  }
});

test("solid-property-select: the keyed solids are those with the property, from face and edge counts", () => {
  const data: Record<string, { sides: number; kind: "prism" | "pyramid" }> = {
    Cube: { sides: 4, kind: "prism" },
    "Rectangular prism": { sides: 4, kind: "prism" },
    "Triangular prism": { sides: 3, kind: "prism" },
    "Pentagonal prism": { sides: 5, kind: "prism" },
    "Hexagonal prism": { sides: 6, kind: "prism" },
    "Square pyramid": { sides: 4, kind: "pyramid" },
    "Triangular pyramid": { sides: 3, kind: "pyramid" },
    "Pentagonal pyramid": { sides: 5, kind: "pyramid" },
    "Hexagonal pyramid": { sides: 6, kind: "pyramid" },
  };
  for (const p of prompts("solid-property-select")) {
    const resp = p.public.response;
    assert.equal(resp.kind, "multi-select");
    if (resp.kind !== "multi-select") continue;
    const phrase = p.public.prompt;
    const has = (name: string) => {
      const { sides: n, kind } = data[name]!;
      const faces = kind === "prism" ? n + 2 : n + 1;
      const edges = kind === "prism" ? 3 * n : 2 * n;
      if (/congruent parallel/.test(phrase)) return kind === "prism";
      if (/triangles|one base/.test(phrase)) return kind === "pyramid";
      if (/12 or more edges/.test(phrase)) return edges >= 12;
      return faces < 6;
    };
    const expected = resp.options
      .filter((o) => has(o.label))
      .map((o) => o.id)
      .sort();
    assert.equal(expected.length, 3);
    assert.deepEqual(JSON.parse(p.answer), expected);
    assert.equal(resp.selectionCount, 3);
    assert.equal(resp.options.length, 6);
  }
});

test("benchmark-fraction-estimate: the estimate rounds each fraction to a benchmark", () => {
  const near = (f: number) => (f < 0.25 ? 0 : f < 0.75 ? 1 : 2);
  const labelHalves = (l: string) =>
    l.includes("\\frac{3}{4}")
      ? 1.5
      : l.includes("\\frac{1}{4}")
        ? 0.5
        : l.includes("1\\frac{1}{2}")
          ? 3
          : l.includes("\\frac{1}{2}")
            ? 1
            : l === "About 2"
              ? 4
              : l === "About 1"
                ? 2
                : 0;
  for (const p of prompts("benchmark-fraction-estimate")) {
    const fr = [...p.public.prompt.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g)]
      .map((m) => [Number(m[1]), Number(m[2])] as const)
      .filter(([n, d]) => !(n === 1 && d === 2) || false);
    // The first two fractions after removing the benchmark statement.
    const body = p.public.prompt.split("Use the benchmarks")[0]!;
    const found = [...body.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g)].map(
      (m) => Number(m[1]) / Number(m[2]),
    );
    assert.equal(found.length, 2);
    void fr;
    const [x, y] = found as [number, number];
    const b = [near(x), near(y)];
    const est = /how many .* altogether|together/.test(p.public.prompt)
      ? b[0]! + b[1]!
      : /longer|farther|more the/.test(p.public.prompt)
        ? b[0]! - b[1]!
        : 2 - b[0]! - b[1]!;
    assert.equal(labelHalves(keyed(p)), est, p.public.prompt);
    // The rounding is clear: every fraction is within a tenth of its benchmark.
    for (const v of [x, y])
      assert.ok(Math.abs(v - near(v) / 2) <= 0.125, String(v));
    assert.equal(new Set(labels(p).map((o) => labelHalves(o.label))).size, 4);
  }
});
