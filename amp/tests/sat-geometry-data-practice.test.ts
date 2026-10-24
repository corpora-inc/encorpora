import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem, templates } from "../src/math/engine";
import { satGeometryDataCase } from "../src/math/sat-geometry-data-practice";
import { lessons } from "../src/content/lessons";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";
import { buildSatCoverage } from "../src/curriculum/sat-coverage";

const expected: Record<string, { skill: string; tags: string[] }> = {
  "trig-context-triangle": {
    skill: "right-triangle-trigonometry",
    tags: [
      "elevation-height",
      "elevation-eye-height",
      "depression-distance",
      "depression-height",
      "ladder-reach",
      "ladder-foot",
      "ladder-length",
      "ramp-angle",
      "shadow-length",
      "shadow-angle",
      "depression-alternate",
      "depression-top",
    ],
  },
  "midpoint-endpoint": {
    skill: "coordinate-distance",
    tags: [
      "midpoint",
      "missing-endpoint",
      "endpoint-sum",
      "circle-center",
      "circle-equation",
    ],
  },
  "space-diagonal": {
    skill: "pythagorean-theorem",
    tags: [
      "box-diagonal",
      "longest-rod",
      "box-edge",
      "cube-diagonal",
      "radical-diagonal",
    ],
  },
  "circle-segment-lengths": {
    skill: "circle-theorems",
    tags: [
      "chords-segment",
      "chords-whole",
      "secants-whole",
      "secants-internal",
      "tangent-secant-whole",
      "tangent-secant-tangent",
      "tangent-secant-chord",
      "tangent-slope",
      "tangent-slope-axis",
    ],
  },
  "frequency-table-center": {
    skill: "mean-median",
    tags: [
      "freq-mean",
      "freq-median",
      "weighted-mean",
      "combine-groups",
      "add-value-mean",
      "remove-value-mean",
      "add-value-effect",
    ],
  },
  "independence-test": {
    skill: "independent-events",
    tags: [
      "independent-group",
      "relation-2x2",
      "expected-both",
      "conditional-meaning",
    ],
  },
};
const ids = Object.keys(expected);
const seeds = Array.from({ length: 400 }, (_, i) => `sgd:${i}`);
const numbers = (text: string) => new Set(text.match(/\d+(?:\.\d+)?/g) ?? []);

test("each family is deterministic, reaches every variant, and has one correct distinct choice", () => {
  for (const id of ids) {
    const seen = new Set<string>();
    for (const seed of seeds) {
      const generated = generateProblem(id, seed);
      assert.deepEqual(generateProblem(id, seed), generated);
      const direct = satGeometryDataCase(id, seed);
      assert.equal(direct.problem.answer, generated.answer);
      const response = generated.public.response;
      assert.equal(response.kind, "choice");
      if (response.kind !== "choice") throw new Error("choice expected");
      assert.equal(generated.public.skillId, expected[id]!.skill);
      const labels = response.options.map((o) => o.label);
      assert.equal(labels.length, 4, `${id} ${seed}`);
      assert.equal(new Set(labels).size, 4, `${id} ${seed} ${labels}`);
      assert.equal(
        response.options.filter((o) => o.id === generated.answer).length,
        1,
      );
      const correct = response.options.find(
        (o) => o.id === generated.answer,
      )!.label;
      assert.ok(
        generated.hint.length > 40 && generated.explanation.length >= 3,
      );
      // Neither the prompt nor the hint states the correct choice: a wordy
      // label must not appear verbatim, and a numeric label must not be a
      // number that the hint introduces beyond the prompt's givens.
      assert.ok(
        !generated.public.prompt.includes(correct) || correct.length < 4,
        `${id} ${seed}: prompt contains ${correct}`,
      );
      assert.ok(!generated.hint.includes(correct) || correct.length < 4);
      // A numeric answer must not be written as "= answer" in the hint.
      const bare = /^\$?(-?\d+(?:\.\d+)?)\b/.exec(correct)?.[1];
      if (
        bare !== undefined &&
        !numbers(generated.public.prompt).has(bare.replace("-", ""))
      )
        assert.ok(
          !new RegExp(`=\\s*${bare.replace(".", "\\.")}(?![\\d.])`).test(
            generated.hint,
          ),
          `${id}: hint states ${correct}`,
        );
      for (const option of response.options)
        if (option.id !== generated.answer)
          assert.ok(
            generated.choiceFeedback?.[option.id],
            `${id}: missing feedback`,
          );
      seen.add(direct.tag);
    }
    assert.deepEqual([...seen].sort(), [...expected[id]!.tags].sort(), id);
  }
});

test("answers agree with an independent recomputation from the stated givens", () => {
  const label = (id: string, seed: string) => {
    const g = generateProblem(id, seed);
    const r = g.public.response;
    if (r.kind !== "choice") throw new Error("choice expected");
    return {
      g,
      correct: r.options.find((o) => o.id === g.answer)!.label,
    };
  };
  const rad = (d: number) => (d * Math.PI) / 180;
  let checked = 0;
  for (const seed of seeds) {
    // Trigonometry: recompute with the stated rounding from the prompt.
    const trig = label("trig-context-triangle", seed);
    const p = trig.g.public.prompt;
    let m;
    if (
      (m =
        /(\d+) feet from the base of a vertical flagpole, the angle of elevation to the top of the pole is (\d+)°/.exec(
          p,
        ))
    ) {
      const v = Number(m[1]) * Math.tan(rad(Number(m[2])));
      assert.equal(trig.correct, `${v.toFixed(1)} feet`);
      checked++;
    } else if (
      (m =
        /cliff (\d+) meters high, the angle of depression to a boat on the level sea is (\d+)°/.exec(
          p,
        ))
    ) {
      assert.equal(
        trig.correct,
        `${(Number(m[1]) / Math.tan(rad(Number(m[2])))).toFixed(1)} meters`,
      );
      checked++;
    } else if (
      (m =
        /A (\d+)-foot ladder leans against a vertical wall and makes a (\d+)° angle with the level ground. How high/.exec(
          p,
        ))
    ) {
      assert.equal(
        trig.correct,
        `${(Number(m[1]) * Math.sin(rad(Number(m[2])))).toFixed(1)} feet`,
      );
      checked++;
    } else if (
      (m = /rises (\d+) feet over a horizontal distance of (\d+) feet/.exec(p))
    ) {
      assert.equal(
        trig.correct,
        `${((Math.atan(Number(m[1]) / Number(m[2])) * 180) / Math.PI).toFixed(1)}°`,
      );
      checked++;
    }
    // Midpoint family: recompute from the two endpoints in the prompt.
    const mid = label("midpoint-endpoint", seed);
    if (
      (m =
        /A\((-?\d+),\\ (-?\d+)\)\$ and \$B\((-?\d+),\\ (-?\d+)\)\$\. What are the coordinates of the midpoint/.exec(
          mid.g.public.prompt,
        ))
    ) {
      const [a, b, c, d] = m.slice(1).map(Number) as [
        number,
        number,
        number,
        number,
      ];
      assert.equal(mid.correct, `$(${(a + c) / 2},\\ ${(b + d) / 2})$`);
      checked++;
    }
    // Box: recompute the diagonal by brute-force search over integers.
    const box = label("space-diagonal", seed);
    if (
      (m = /box is (\d+) (?:\w+) long, (\d+) \w+ wide and (\d+) \w+ tall/.exec(
        box.g.public.prompt,
      ))
    ) {
      const [l, w, h] = m.slice(1).map(Number) as [number, number, number];
      let d = 0;
      while (d * d < l * l + w * w + h * h) d++;
      assert.equal(d * d, l * l + w * w + h * h);
      assert.equal(box.correct, String(d));
      checked++;
    }
    // Chords: AE*EB = CE*ED.
    const circ = label("circle-segment-lengths", seed);
    if (
      (m =
        /AE=(\d+)\$, \$EB=(\d+)\$ and \$CE=(\d+)\$\. What is the length of \$\\overline\{ED\}/.exec(
          circ.g.public.prompt,
        ))
    ) {
      const [a, b, c] = m.slice(1).map(Number) as [number, number, number];
      const e = Array.from({ length: 1000 }, (_, i) => i + 1).find(
        (x) => c * x === a * b,
      )!;
      assert.equal(circ.correct, String(e));
      checked++;
    }
    // Frequency table mean: recompute from the table scene.
    const f = label("frequency-table-center", seed);
    const fig = f.g.public.figure;
    if (
      /What is the mean of the data/.test(f.g.public.prompt) &&
      fig?.kind === "scene"
    ) {
      const rows =
        (fig.scene as any).elements?.[0]?.rows ?? (fig.scene as any).root?.rows;
      if (rows) {
        const n = rows.reduce((a: number, r: any) => a + r.cells[0], 0);
        const t = rows.reduce(
          (a: number, r: any) => a + Number(r.label) * r.cells[0],
          0,
        );
        assert.equal(Number(f.correct), t / n);
        checked++;
      }
    }
  }
  // Independence: brute-force cross-multiplication on the table in the figure.
  for (const seed of seeds) {
    const t = label("independence-test", seed);
    const fig = t.g.public.figure;
    if (fig?.kind !== "scene") continue;
    const rows = (fig.scene as any).elements[0].rows as {
      label: string;
      cells: number[];
    }[];
    const body = rows.slice(0, -1),
      total = rows.at(-1)!.cells;
    if (body.length === 4) {
      const match = body.filter(
        (r) => r.cells[0]! * total[2]! === total[0]! * r.cells[2]!,
      );
      assert.equal(match.length, 1, seed);
      assert.equal(t.correct, match[0]!.label);
      checked++;
    } else {
      const [a, b] = body as [any, any];
      const N = total[2]!,
        joint = a.cells[0],
        rowA = a.cells[2],
        colB = total[0]!;
      const sign = Math.sign(joint * N - rowA * colB);
      const expectedText =
        sign === 0
          ? "$P(A\\mid B)=P(A)$, so the events are independent."
          : `$P(A\\mid B)${sign > 0 ? ">" : "<"}P(A)$, so the events are not independent.`;
      assert.equal(t.correct, expectedText);
      assert.equal(b.cells[2] + rowA, N);
      checked++;
    }
  }
  // Frequency median and the effect of an added value, from the table.
  for (const seed of seeds) {
    const f = label("frequency-table-center", seed);
    const fig = f.g.public.figure;
    if (fig?.kind !== "scene") continue;
    const rows = (fig.scene as any).elements[0].rows as {
      label: string;
      cells: number[];
    }[];
    const xs = rows.flatMap((r) => Array(r.cells[0]).fill(Number(r.label)));
    const med = (v: number[]) => {
      const s = [...v].sort((p, q) => p - q);
      return s.length % 2
        ? s[(s.length - 1) / 2]!
        : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
    };
    const mean = (v: number[]) => v.reduce((p, q) => p + q, 0) / v.length;
    if (/median of the data/.test(f.g.public.prompt)) {
      assert.equal(Number(f.correct), med(xs));
      checked++;
    }
    const added = /new data value of (\d+) is added/.exec(f.g.public.prompt);
    if (added) {
      const ys = [...xs, Number(added[1])];
      const dir = (a: number, b: number) =>
        b > a + 1e-9
          ? "increases"
          : b < a - 1e-9
            ? "decreases"
            : "does not change";
      assert.equal(
        f.correct,
        `The mean ${dir(mean(xs), mean(ys))}; the median ${dir(med(xs), med(ys))}.`,
      );
      checked++;
    }
  }
  assert.ok(checked > 400, `only ${checked} independent checks ran`);
});

test("registration: templates, lessons, methods, principles and SAT rows", () => {
  for (const id of ids) {
    const template = templates.find((t) => t.id === id);
    assert.equal(template?.skillId, expected[id]!.skill);
    assert.equal(template?.requiredResponseCapability, "single-choice-v1");
    assert.ok(
      lessons.some((l) => l.templateIds.includes(id)),
      `${id} lesson`,
    );
    assert.ok(methods[id]?.method.length, `${id} method`);
    assert.ok(principles[id], `${id} principle`);
    const sat = buildSatCoverage();
    assert.ok(
      sat.tasks.some((t) => t.templateIds.includes(id)),
      `${id} SAT row`,
    );
  }
  assert.equal(buildSatCoverage().valid, true);
});
