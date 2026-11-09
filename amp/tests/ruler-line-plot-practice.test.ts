import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import { generateProblem, templates } from "../src/math/engine";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";

/**
 * Checks for the grade-2 ruler and line-plot types (2.MD.A.4, 2.MD.D.9).
 * Lengths are read back from the drawn bars and tick numbers, and line plots
 * from their drawn marks; nothing here calls the generator's own arithmetic.
 */

const IDS = [
  "ruler-length-difference",
  "compare-measured-lengths",
  "ruler-read-nearest-unit",
  "line-plot-choose-for-data",
] as const;
const SKILLS: Record<(typeof IDS)[number], string> = {
  "ruler-length-difference": "ruler-measurement",
  "compare-measured-lengths": "ruler-measurement",
  "ruler-read-nearest-unit": "line-plots",
  "line-plot-choose-for-data": "line-plots",
};
const sample = (id: string, n: number, prefix = "rlp") =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `${prefix}-${i}`));

type El = { type: string; id?: string; [key: string]: unknown };
function elementsOf(p: GeneratedProblem): Map<string, El> {
  const figure = p.public.figure;
  assert.equal(figure?.kind, "scene");
  if (figure?.kind !== "scene") throw new Error("scene");
  return new Map(
    (figure.scene.elements as El[]).flatMap((e) => (e.id ? [[e.id, e]] : [])),
  );
}
/** Tenths are exact in the figure; read them back to one decimal place. */
const tenth = (x: number) => Math.round(x * 10) / 10;
/** The bars on a drawn ruler, read from their rectangles and names. */
function barsOf(els: Map<string, El>, rid: string) {
  const numbers = [...els.keys()]
    .map((k) => new RegExp(`^${rid}-n(\\d+)$`).exec(k))
    .flatMap((m) => (m ? [Number(m[1])] : []));
  for (const k of numbers) {
    const e = els.get(`${rid}-n${k}`)!;
    assert.equal(e.text, String(k));
    assert.equal(tenth((e.at as number[])[0]!), k);
  }
  const length = Math.max(...numbers);
  const bars: { name: string; start: number; end: number }[] = [];
  for (let i = 0; els.has(`${rid}-bar${i}`); i++) {
    const rect = els.get(`${rid}-bar${i}`)!;
    const at = rect.at as number[],
      size = rect.size as number[];
    bars.push({
      name: els.get(`${rid}-name${i}`)!.text as string,
      start: tenth(at[0]!),
      end: tenth(at[0]! + size[0]!),
    });
  }
  for (const b of bars) {
    assert.ok(b.start >= 0 && b.end <= length, `${b.name} on the ruler`);
  }
  return { length, bars, every: Math.min(...numbers.filter((k) => k > 0)) };
}
/** Realistic whole-unit lengths for named things (spec 2.MD.A.4 table). */
const REAL: Record<string, { cm: [number, number]; in: [number, number] }> = {
  crayon: { cm: [8, 10], in: [3, 4] },
  "paper clip": { cm: [3, 4], in: [1, 2] },
  eraser: { cm: [4, 6], in: [2, 2] },
  marker: { cm: [12, 14], in: [5, 5] },
  pencil: { cm: [10, 19], in: [4, 7] },
  straw: { cm: [15, 20], in: [6, 8] },
};
const ANY = new Set(["ribbon", "string", "paper strip", "twig"]);
const share = (n: number, total: number) => n / total;

test("every template is registered, valid, deterministic and documented", () => {
  for (const id of IDS) {
    const meta = templates.find((t) => t.id === id);
    assert.ok(meta, id);
    assert.equal(meta!.skillId, SKILLS[id]);
    assert.equal(meta!.gradeBand, "K–2");
    assert.equal(meta!.requiredFigureCapability, "scenes-v1");
    assert.ok(methods[id]?.watch && principles[id], `${id} lesson text`);
    for (const p of sample(id, 120)) {
      generatedProblemSchema.parse(p);
      assert.deepEqual(generateProblem(id, p.public.seed), p);
      assert.equal(p.public.skillId, SKILLS[id]);
      const kind = p.public.response.kind;
      assert.equal(
        kind,
        id === "compare-measured-lengths"
          ? "multi-part-choice"
          : id === "line-plot-choose-for-data"
            ? "figure-choice"
            : "number",
      );
    }
  }
});

test("how much longer: the answer is the difference of the drawn lengths", () => {
  const seeds = 2000;
  const variants = new Map<string, number>();
  const phrasings = new Map<string, number>();
  let topLonger = 0,
    cm = 0;
  for (const p of sample("ruler-length-difference", seeds)) {
    const variant = p.variant!.id;
    variants.set(variant, (variants.get(variant) ?? 0) + 1);
    const axes = p.variant!.axes!;
    phrasings.set(axes.phrasing!, (phrasings.get(axes.phrasing!) ?? 0) + 1);
    const unit = p.public.prompt.includes("inches") ? "in" : "cm";
    if (unit === "cm") cm++;
    const { length, bars, every } = barsOf(elementsOf(p), "ruler");
    assert.equal(bars.length, 2);
    const [a, b] = bars as [(typeof bars)[0], (typeof bars)[0]];
    const la = a.end - a.start,
      lb = b.end - b.start;
    assert.ok(Number.isInteger(la) && Number.isInteger(lb) && la !== lb);
    const d = Math.abs(la - lb);
    assert.equal(p.answer, String(d));
    if (b.end - b.start > la) topLonger++;
    // Measuring is required whenever the starts differ.
    if (a.start !== b.start) assert.notEqual(Math.abs(a.end - b.end), d);
    if (variant === "a-start-zero") assert.ok(a.start === 0 && b.start === 0);
    if (variant === "b-same-start")
      assert.ok(a.start === b.start && a.start >= 1 && a.start <= 5);
    if (variant === "c-different-starts") assert.notEqual(a.start, b.start);
    if (variant === "d-tape") {
      assert.equal(length, 40);
      assert.equal(every, 5);
      assert.ok(la >= 12 && lb >= 12 && d <= 25);
    } else {
      assert.ok(
        unit === "cm" ? [15, 30].includes(length) : length === 12,
        "ruler length",
      );
      assert.ok(d <= (unit === "cm" ? 12 : 8));
    }
    assert.equal(p.public.response.kind, "number");
    if (p.public.response.kind === "number")
      assert.equal(
        p.public.response.label,
        unit === "cm" ? "centimeters" : "inches",
      );
    // Named things only at realistic lengths; strips in variant A.
    for (const bar of bars) {
      const l = bar.end - bar.start;
      if (variant === "a-start-zero") assert.ok(ANY.has(bar.name), bar.name);
      else if (!ANY.has(bar.name)) {
        const [lo, hi] = REAL[bar.name]![unit];
        assert.ok(l >= lo && l <= hi, `${bar.name} ${l} ${unit}`);
      }
    }
    // The description gives the marks, never a length or a comparison.
    const note =
      p.public.figure?.kind === "scene" ? p.public.figure.scene.note! : "";
    assert.doesNotMatch(note, /longer|shorter|long\b/);
  }
  const target = {
    "a-start-zero": 0.25,
    "b-same-start": 0.25,
    "c-different-starts": 0.35,
    "d-tape": 0.15,
  } as Record<string, number>;
  for (const [v, w] of Object.entries(target))
    assert.ok(
      Math.abs(share(variants.get(v) ?? 0, seeds) - w) <= 0.05,
      `${v}: ${variants.get(v)}`,
    );
  for (const ph of ["longer", "shorter", "need"])
    assert.ok(Math.abs(share(phrasings.get(ph) ?? 0, seeds) - 1 / 3) <= 0.05);
  assert.ok(Math.abs(share(topLonger, seeds) - 0.5) <= 0.05, "longer on top");
  assert.ok(share(cm, seeds) > 0.5 && share(cm, seeds) < 0.7, "both units");
});

test("which is longer, by how much: both parts recomputed from two rulers", () => {
  const seeds = 2000;
  let equal = 0,
    unequal = 0,
    wrongUnit = 0,
    endsOffered = 0,
    longerEndFarther = 0;
  for (const p of sample("compare-measured-lengths", seeds)) {
    const els = elementsOf(p);
    const top = barsOf(els, "ruler0"),
      bottom = barsOf(els, "ruler1");
    const unit = p.public.prompt.includes("inches") ? "inches" : "centimeters";
    assert.equal(top.length, unit === "inches" ? 12 : 30);
    const [a] = top.bars as [(typeof top.bars)[0]];
    const [b] = bottom.bars as [(typeof bottom.bars)[0]];
    assert.deepEqual([a.start, b.start].sort().slice(0, 1), [0]);
    assert.ok(
      Math.max(a.start, b.start) >= 1 && Math.max(a.start, b.start) <= 5,
    );
    const la = a.end - a.start,
      lb = b.end - b.start;
    const d = Math.abs(la - lb);
    const r = p.public.response;
    assert.equal(r.kind, "multi-part-choice");
    if (r.kind !== "multi-part-choice") continue;
    const key = JSON.parse(p.answer) as Record<string, string>;
    const winner =
      la > lb ? a.name : lb > la ? b.name : "They are the same length";
    assert.equal(
      r.blanks[0]!.options.find((o) => o.id === key.longer)!.label,
      winner,
    );
    const amounts = r.blanks[1]!.options.map((o) => {
      const m = /^(\d+) (centimeters?|inch(?:es)?)$/.exec(o.label);
      assert.ok(m, o.label);
      assert.equal(Number(m![1]) === 1, !/s$/.test(m![2]!), o.label);
      return {
        id: o.id,
        n: Number(m![1]),
        unit: m![2]!.startsWith("c") ? "centimeters" : "inches",
      };
    });
    assert.equal(new Set(amounts.map((x) => `${x.n} ${x.unit}`)).size, 4);
    const correct = amounts.filter((x) => x.n === d && x.unit === unit);
    assert.equal(correct.length, 1);
    assert.equal(correct[0]!.id, key.by);
    for (const x of amounts) assert.ok(x.n >= 0 && x.n <= top.length);
    if (amounts.some((x) => x.unit !== unit)) wrongUnit++;
    if (d === 0) {
      equal++;
      assert.equal(amounts.filter((x) => x.n === 0).length, 1);
    } else {
      unequal++;
      const gap = Math.abs(a.end - b.end);
      assert.notEqual(gap, d, "end marks alone never give the difference");
      if (amounts.some((x) => x.n === gap && x.unit === unit)) endsOffered++;
      const longer = la > lb ? a : b,
        shorter = la > lb ? b : a;
      if (longer.end > shorter.end) longerEndFarther++;
    }
  }
  assert.ok(Math.abs(share(equal, seeds) - 0.12) <= 0.03, `equal ${equal}`);
  assert.ok(share(wrongUnit, seeds) >= 0.6, `wrong unit ${wrongUnit}`);
  assert.ok(share(endsOffered, unequal) >= 0.8, `ends ${endsOffered}`);
  const farther = share(longerEndFarther, unequal);
  assert.ok(farther >= 0.4 && farther <= 0.6, `longer end farther ${farther}`);
});

test("nearest whole unit: the rounded drawn length, never a halfway end", () => {
  const seeds = 1500;
  const variants = new Map<string, number>();
  for (const p of sample("ruler-read-nearest-unit", seeds)) {
    const variant = p.variant!.id;
    variants.set(variant, (variants.get(variant) ?? 0) + 1);
    const { length, bars, every } = barsOf(elementsOf(p), "ruler");
    const unit = p.public.prompt.includes("inch") ? "in" : "cm";
    assert.ok(length <= (unit === "cm" ? 15 : 12) && every === 1);
    assert.equal(bars.length, 1);
    const { start, end, name } = bars[0]!;
    assert.ok(p.public.prompt.includes(`Measure the ${name} `));
    const exact = Math.round((end - start) * 10);
    const part = exact % 10;
    assert.notEqual(part, 5);
    assert.ok([0, 2, 3, 7, 8].includes(part), String(part));
    const nearest = Math.floor(exact / 10) + (part > 5 ? 1 : 0);
    assert.equal(p.answer, String(nearest));
    assert.ok(nearest >= 2 && nearest <= (unit === "cm" ? 14 : 11));
    if (variant === "on-tick") assert.ok(start === 0 && part === 0);
    if (variant === "between-ticks") assert.ok(start === 0 && part !== 0);
    if (variant === "nonzero-start") {
      assert.ok(start >= 1 && start <= 5);
      // Reading the end mark gives a different, wrong number.
      assert.notEqual(Math.round(end), nearest);
    }
  }
  const target = {
    "on-tick": 0.25,
    "between-ticks": 0.45,
    "nonzero-start": 0.3,
  };
  for (const [v, w] of Object.entries(target))
    assert.ok(Math.abs(share(variants.get(v) ?? 0, seeds) - w) <= 0.05, v);
});

/** A drawn line plot: its scale numbers and the marks above each one. */
function readPlot(scene: { elements: unknown[] }) {
  const els = new Map(
    (scene.elements as El[]).flatMap((e) => (e.id ? [[e.id, e]] : [])),
  );
  const scale: number[] = [];
  for (let i = 0; els.has(`n${i}`); i++) {
    const e = els.get(`n${i}`)!;
    assert.equal(tenth((e.at as number[])[0]!), i);
    scale.push(Number(e.text));
  }
  const counts = new Map<number, number>(scale.map((v) => [v, 0]));
  const d = (els.get("marks")?.d ?? []) as [string, number, number][];
  for (let k = 0; k < d.length; k += 4) {
    const col = Math.round((d[k]![1] + d[k + 1]![1]) / 2);
    counts.set(scale[col]!, counts.get(scale[col]!)! + 1);
  }
  return { scale, counts };
}
const listOf = (text: string) => text.split(/, | and /).map(Number);

test("line plot choice: one plot shows the data; distractors are the named errors", () => {
  const seeds = 1200;
  const families = new Map<string, number>();
  const slots = new Map<string, number>();
  let several = 0,
    severalEmpty = 0;
  for (const p of sample("line-plot-choose-for-data", seeds)) {
    const family = p.variant!.id;
    families.set(family, (families.get(family) ?? 0) + 1);
    slots.set(p.answer, (slots.get(p.answer) ?? 0) + 1);
    let values: number[];
    const listed = /were (.+)\. Which/.exec(p.public.prompt);
    if (family === "table") {
      assert.ok(!listed);
      const table = elementsOfTable(p);
      values = table.slice(1).map((row) => Number(row[1]));
    } else values = listOf(listed![1]!);
    const n = Number(
      /measured (?:the same .+? )?(\d+) /.exec(p.public.prompt)![1],
    );
    assert.equal(values.length, n);
    assert.ok(
      n >= 5 && n <= (family === "repeated" ? 8 : family === "table" ? 7 : 9),
    );
    assert.notDeepEqual(
      values,
      [...values].sort((x, y) => x - y),
      "unsorted",
    );
    const data = new Map<number, number>();
    for (const v of values) data.set(v, (data.get(v) ?? 0) + 1);
    const tallest = Math.max(...data.values());
    assert.ok(tallest >= 2 && tallest <= 4);
    const lo = Math.min(...values),
      hi = Math.max(...values);
    const unit = p.public.prompt.includes("inch") ? "in" : "cm";
    assert.ok(lo >= 1 && hi <= (unit === "cm" ? 20 : 12));
    const interiorEmpty = Array.from(
      { length: hi - lo - 1 },
      (_, i) => lo + 1 + i,
    ).filter((v) => !data.has(v));
    if (family === "repeated") {
      const center = [...data].sort((x, y) => y[1] - x[1])[0]![0];
      assert.ok([...data.keys()].every((v) => Math.abs(v - center) <= 1));
      assert.equal(
        [...data.values()].filter((c) => c === data.get(center)).length,
        1,
      );
    } else assert.ok(hi - lo + 1 >= 4 && hi - lo + 1 <= 6, "window 4 to 6");
    if (family === "several") {
      several++;
      if (interiorEmpty.length) severalEmpty++;
    }
    const r = p.public.response;
    assert.equal(r.kind, "figure-choice");
    if (r.kind !== "figure-choice") continue;
    assert.equal(r.noun, "Graph");
    const plots = r.options.map((o) => ({ id: o.id, ...readPlot(o.scene) }));
    const keyOf = (pl: (typeof plots)[0]) =>
      JSON.stringify([pl.scale, pl.scale.map((v) => pl.counts.get(v))]);
    assert.equal(new Set(plots.map(keyOf)).size, 4, "four different plots");
    const shows = plots.filter((pl) => {
      const consecutive = pl.scale.every(
        (v, i) => i === 0 || v === pl.scale[i - 1]! + 1,
      );
      const same = [...pl.counts].filter(([, c]) => c > 0);
      return (
        consecutive &&
        pl.scale[0]! <= lo - 1 &&
        pl.scale.at(-1)! >= hi + 1 &&
        same.length === data.size &&
        same.every(([v, c]) => data.get(v) === c)
      );
    });
    assert.equal(shows.length, 1);
    assert.equal(shows[0]!.id, p.answer);
    const key = shows[0]!;
    assert.ok(key.scale.length >= 5 && key.scale.length <= 8, "5 to 8 columns");
    const others = plots.filter((pl) => pl.id !== p.answer);
    const total = (pl: (typeof plots)[0]) =>
      [...pl.counts.values()].reduce((s, c) => s + c, 0);
    // Shift by one: same stacks, every value moved one place.
    assert.ok(
      others.some(
        (pl) =>
          pl.scale.join() === key.scale.join() &&
          [-1, 1].some((k) =>
            [...data].every(([v, c]) => pl.counts.get(v + k) === c),
          ),
      ),
      "a shifted plot",
    );
    // Duplicates dropped: one mark per distinct value.
    assert.ok(
      others.some(
        (pl) =>
          total(pl) === data.size &&
          [...data.keys()].every((v) => pl.counts.get(v) === 1),
      ),
      "a no-duplicates plot",
    );
    const skipped = others.filter((pl) => pl.scale.join() !== key.scale.join());
    if (interiorEmpty.length) {
      assert.equal(skipped.length, 1, "a skipped-scale plot");
      assert.deepEqual(
        skipped[0]!.scale,
        [...data.keys()].sort((x, y) => x - y),
      );
    } else
      assert.equal(
        skipped.length,
        0,
        "skipped scale only with an empty interior value",
      );
    assert.equal(Object.keys(p.choiceFeedback ?? {}).length, 3);
  }
  for (const f of ["several", "repeated", "table"])
    assert.ok((families.get(f) ?? 0) >= 150, f);
  assert.ok(share(severalEmpty, several) >= 0.5, "empty interior values");
  for (const slot of ["option-a", "option-b", "option-c", "option-d"])
    assert.ok(
      Math.abs(share(slots.get(slot) ?? 0, seeds) - 0.25) <= 0.05,
      slot,
    );
});

function elementsOfTable(p: GeneratedProblem): string[][] {
  const figure = p.public.figure;
  if (figure?.kind !== "scene") throw new Error("table");
  const table = figure.scene.elements[0] as unknown as {
    type: string;
    rows: string[][];
  };
  assert.equal(table.type, "lineTable");
  return table.rows;
}

test("hints name the problem's givens and never the answer", () => {
  for (const id of IDS)
    for (const p of sample(id, 40, "hint")) {
      if (p.public.response.kind === "number")
        assert.ok(
          !new RegExp(`\\b${p.answer}\\b`).test(p.hint),
          `${id}: ${p.hint}`,
        );
      if (id === "line-plot-choose-for-data") {
        const n = /measured (?:the same .+? )?(\d+) /.exec(p.public.prompt)![1];
        assert.match(p.hint, new RegExp(`\\b${n} measurements\\b`));
      }
    }
});

test("the independent oracle agrees on 256 seeds of each template", () => {
  const cases = IDS.flatMap((id) =>
    Array.from({ length: 256 }, (_, i) =>
      generateProblem(id, `independent-${i}`),
    ),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import json, sys
sys.path.insert(0, 'scripts')
import ruler_line_plot_math_oracle as oracle
fixtures = oracle.self_test()
cases = json.load(sys.stdin)
for problem in cases:
    assert oracle.review_problem(problem) == problem['answer'], problem['public']['seed']
    assert oracle.solve(problem['public']) == problem['answer'], problem['public']['seed']
print({'cases': len(cases), **fixtures})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'cases': 1024/);
  assert.match(result.stdout, /'mutations': 11/);
});
