import { skills } from "../src/curriculum/catalog";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import { generateProblem } from "../src/math/engine";
import { addendStrategiesTemplates } from "../src/math/addend-strategies-practice";

/**
 * Independent checks for turnaround facts, making ten (1.OA.B.3) and equal
 * addends on arrays (2.OA.C.4). Every key is recomputed here from the prompt,
 * the drawn figure and the option text; nothing calls the generator's own
 * helpers.
 */

const ids = addendStrategiesTemplates.map((t) => t.id);
const many = (id: string, n: number, prefix = "addend") =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `${prefix}-${i}`));

/* ---------- reading what the learner sees ---------- */

/** "$4 + 4 - 3$" side → signed numbers. */
function side(text: string): number[] {
  const tokens = text.trim().split(/\s+/);
  const out: number[] = [];
  let sign = 1;
  for (const [i, token] of tokens.entries()) {
    if (i % 2) sign = token === "+" ? 1 : -1;
    else out.push(sign * Number(token));
  }
  assert.ok(out.every(Number.isInteger), text);
  return out;
}
function sentence(label: string): { left: number[]; right: number[] } {
  assert.match(label, /^\$[^$]+\$$/);
  const [l, r] = label.slice(1, -1).split("=");
  return { left: side(l!), right: side(r!) };
}
const total = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const holds = (label: string) => {
  const s = sentence(label);
  return total(s.left) === total(s.right);
};
function options(p: GeneratedProblem) {
  const r = p.public.response;
  assert.ok(r.kind === "choice" || r.kind === "multi-select");
  if (r.kind !== "choice" && r.kind !== "multi-select") throw new Error("kind");
  return r.options;
}
function keyed(p: GeneratedProblem): string[] {
  return p.public.response.kind === "multi-select"
    ? (JSON.parse(p.answer) as string[])
    : [p.answer];
}
function sceneElements(p: GeneratedProblem) {
  const f = p.public.figure;
  if (!f || f.kind !== "scene") throw new Error("scene");
  return f.scene.elements;
}
function arrayOf(elements: { type: string }[]) {
  const arrays = elements.filter((e) => e.type === "array") as unknown as {
    rows: number;
    columns: number;
  }[];
  assert.equal(arrays.length, 1);
  return arrays[0]!;
}
/** Equal addends of a true sentence: [addend, count, total], else null. */
function equalAddends(label: string): [number, number, number] | null {
  const s = sentence(label);
  if (s.right.length !== 1 || s.left.length < 2) return null;
  if (new Set(s.left).size !== 1 || s.left.some((x) => x <= 0)) return null;
  if (total(s.left) !== s.right[0]) return null;
  return [s.left[0]!, s.left.length, s.right[0]!];
}
const countsArray = (label: string, rows: number, columns: number) => {
  const e = equalAddends(label);
  return (
    e !== null &&
    e[2] === rows * columns &&
    ((e[0] === columns && e[1] === rows) || (e[0] === rows && e[1] === columns))
  );
};

/* ---------- contract ---------- */

test("every template validates, is deterministic and stamps its skill", () => {
  for (const t of addendStrategiesTemplates) {
    assert.equal(t.gradeBand, "K–2");
    assert.ok(
      skills.some((s) => s.id === t.skillId),
      t.id,
    );
    for (let i = 0; i < 60; i++) {
      const p = generateProblem(t.id, `contract-${i}`);
      generatedProblemSchema.parse(p);
      assert.deepEqual(generateProblem(t.id, `contract-${i}`), p);
      assert.equal(p.public.skillId, t.skillId);
      const kind = p.public.response.kind;
      const expected: Record<string, string | undefined> = {
        choice: "single-choice-v1",
        "multi-select": "multi-select-v1",
        "figure-choice": "figure-choice-v1",
        number: undefined,
      };
      assert.ok(kind in expected, `${t.id}: ${kind}`);
      assert.equal(t.requiredResponseCapability, expected[kind], t.id);
      assert.ok(p.hint.length > 0 && p.explanation.length >= 2, t.id);
    }
  }
});

/* ---------- 1.OA.B.3 ---------- */

test("turnaround facts: the true sentence is the turnaround and every distractor is false", () => {
  const problems = many("turn-around-fact", 1200);
  const variants = new Map<string, number>();
  let wholeFirst = 0,
    known = 0,
    crossing = 0;
  for (const p of problems) {
    const v = p.variant!.id;
    variants.set(v, (variants.get(v) ?? 0) + 1);
    const opts = options(p);
    assert.equal(opts.length, 3);
    for (const o of opts)
      assert.equal(holds(o.label), o.id === p.answer, o.label);
    const right = opts.find((o) => o.id === p.answer)!;
    if (v === "also-known") {
      known++;
      const m = p.public.prompt.match(/knows \$(\d) \+ (\d) = (\d+)\$/)!;
      const a = Number(m[1]),
        b = Number(m[2]),
        c = Number(m[3]);
      assert.ok(a !== b && a + b === c && c <= 17);
      if (c >= 11) crossing++;
      const s = sentence(right.label);
      if (s.left.length === 1) wholeFirst++;
      const sum = s.left.length === 1 ? s.right : s.left;
      assert.deepEqual(sum, [b, a], "the parts swap places");
      // The sign-swap distractor puts the larger addend first.
      const minus = opts.find((o) => o.label.includes("-"))!;
      assert.equal(sentence(minus.label).left[0], Math.max(a, b));
    } else {
      assert.equal(v, "true-turnaround");
      assert.equal(p.public.figure, undefined);
      const s = sentence(right.label);
      assert.deepEqual(s.right, [...s.left].reverse());
      const turned = opts.find((o) => /^\$\d - \d = \d - \d\$$/.test(o.label))!;
      const [a, b] = sentence(turned.label).left;
      assert.ok(
        a! > -b!,
        "subtraction distractor starts with the larger number",
      );
    }
    assert.equal(
      new Set(Object.keys(p.choiceFeedback!)).size,
      2,
      "feedback for both distractors",
    );
  }
  for (const v of ["also-known", "true-turnaround"])
    assert.ok((variants.get(v) ?? 0) > problems.length * 0.4, v);
  const share = wholeFirst / known;
  assert.ok(share > 0.22 && share < 0.38, `whole-first share ${share}`);
  assert.ok(crossing / known >= 0.6, "most known facts cross ten");
});

test("turned sum: the answer is the known sum and both rows show the same counters", () => {
  for (const p of many("turn-around-sum", 300)) {
    const m = p.public.prompt.match(
      /knows \$(\d) \+ (\d) = (\d+)\$\. What is \$(\d) \+ (\d)\$\?/,
    )!;
    const [a, b, c, x, y] = m.slice(1).map(Number);
    assert.equal(a! + b!, c);
    assert.deepEqual([x, y], [b, a]);
    assert.equal(p.answer, String(x! + y!));
    const els = sceneElements(p);
    const circles = els.filter((e) => e.type === "circle").length;
    const squares = els.filter((e) => e.type === "rect").length;
    assert.equal(circles, 2 * a!);
    assert.equal(squares, 2 * b!);
    const braces = els.filter((e) => e.type === "brace") as {
      label?: string;
    }[];
    assert.deepEqual(
      braces.map((e) => e.label).sort(),
      [String(c), "?"].sort(),
    );
  }
});

const pairsOf = (t: number[]) => [
  [t[0]!, t[1]!],
  [t[0]!, t[2]!],
  [t[1]!, t[2]!],
];
const tens = (t: number[]) => pairsOf(t).filter(([u, v]) => u! + v! === 10);

test("make ten: one pair makes ten, in every position, and distractor sums have none", () => {
  const problems = many("make-ten-grouping", 900);
  const placements = new Map<string, number>();
  const answerSlots = new Map<string, number>();
  let which = 0,
    find = 0;
  for (const p of problems) {
    const opts = options(p);
    const slot = `${p.variant!.id}:${p.answer}`;
    answerSlots.set(slot, (answerSlots.get(slot) ?? 0) + 1);
    if (p.variant!.id === "which-pair-makes-ten") {
      which++;
      const m = p.public.prompt.match(/^Add \$(\d) \+ (\d) \+ (\d)\$/)!;
      const t = m.slice(1).map(Number);
      assert.equal(new Set(t).size, 3);
      assert.ok(total(t) >= 11 && total(t) <= 19);
      assert.equal(tens(t).length, 1);
      const correct = opts.filter(
        (o) => total(side(o.label.slice(1, -1))) === 10,
      );
      assert.equal(correct.length, 1);
      assert.equal(correct[0]!.id, p.answer);
      const at = pairsOf([0, 1, 2]).findIndex(
        ([i, j]) => t[i!]! + t[j!]! === 10,
      );
      placements.set(String(at), (placements.get(String(at)) ?? 0) + 1);
    } else {
      find++;
      assert.equal(p.variant!.id, "find-the-ten");
      assert.equal(opts.length, 4);
      const sets = new Set<string>();
      for (const o of opts) {
        const t = side(o.label.slice(1, -1));
        assert.equal(t.length, 3);
        assert.ok(total(t) <= 20 && t.every((n) => n >= 1 && n <= 9));
        sets.add([...t].sort().join());
        assert.equal(tens(t).length > 0, o.id === p.answer, o.label);
        if (o.id === p.answer) {
          assert.equal(tens(t).length, 1);
          assert.equal(
            new Set(t).size,
            3,
            "5 + 5 belongs to the box items only",
          );
        }
      }
      assert.equal(sets.size, 4);
      const kinds = opts
        .filter((o) => o.id !== p.answer)
        .map((o) => {
          const t = side(o.label.slice(1, -1));
          if (new Set(t).size < 3) return "double";
          return pairsOf(t).some(([u, v]) => u! + v! === 9 || u! + v! === 11)
            ? "near"
            : "none";
        })
        .sort();
      assert.deepEqual(kinds, ["double", "near", "none"]);
    }
  }
  assert.ok(which > 300 && find > 300);
  for (const at of ["0", "1", "2"])
    assert.ok(
      (placements.get(at) ?? 0) >= which * 0.25,
      `pair placement ${at}`,
    );
  // The correct option sits in every slot about equally often.
  assert.equal(answerSlots.size, 7);
  for (const [slot, n] of answerSlots)
    assert.ok(
      n >= (slot.startsWith("which") ? which * 0.25 : find * 0.18),
      `answer slot ${slot}`,
    );
});

test("make-ten step: the box keeps both sums equal and both forms appear", () => {
  const forms = new Map<string, number>();
  let fives = 0;
  const problems = many("make-ten-step", 600);
  for (const p of problems) {
    forms.set(p.variant!.id, (forms.get(p.variant!.id) ?? 0) + 1);
    const eq = p.public.prompt.replace("What goes in the box? ", "");
    const [l, r] = eq.slice(1, -1).split("=");
    const left = side(l!);
    assert.equal(left.length, 3);
    const known = Number(r!.replace("\\square", "").replace("+", "").trim());
    assert.equal(Number(p.answer), total(left) - known);
    assert.equal(tens(left).length, 1);
    if (known !== 10) assert.equal(p.answer, "10");
    if (left.filter((n) => n === 5).length === 2) fives++;
  }
  for (const form of ["box-is-the-rest", "box-is-the-ten"])
    assert.ok((forms.get(form) ?? 0) >= problems.length * 0.4, form);
  assert.ok(fives > 0, "5 + 5 appears in the box items");
});

/* ---------- 2.OA.C.4 ---------- */

test("array totals: rows times columns, every variant and size, and the card hides all but the first row and column", () => {
  const problems = many("array-add-rows-total", 1500);
  const variants = new Map<string, number>();
  const sizes = new Set<string>();
  let oneRow = 0,
    addRows = 0;
  for (const p of problems) {
    const v = p.variant!.id;
    variants.set(v, (variants.get(v) ?? 0) + 1);
    const els = sceneElements(p);
    const { rows, columns } = arrayOf(els);
    sizes.add(`${rows}x${columns}`);
    assert.ok(rows >= 1 && rows <= 5 && columns >= 2 && columns <= 5);
    assert.equal(p.answer, String(rows * columns));
    const texts = els
      .filter((e) => e.type === "text")
      .map((e) => (e as { text: string }).text);
    assert.ok(!texts.includes(p.answer), "the total is never written");
    if (v === "add-rows") {
      addRows++;
      if (rows === 1) oneRow++;
    }
    if (v.startsWith("finish-the-sum")) {
      const frame = p.public.prompt.match(/\$([\d +]+) = \?\$/)![1]!;
      const addends = side(frame);
      assert.equal(new Set(addends).size, 1);
      assert.deepEqual(
        [addends[0], addends.length],
        v === "finish-the-sum" ? [columns, rows] : [rows, columns],
      );
    }
    if (v === "covered") {
      assert.ok(rows >= 3);
      const card = els.find((e) => e.type === "rect") as {
        at: [number, number];
        size: [number, number];
      };
      // Dot (row R from the top, column C) sits at x = C + 0.5, y = rows − R − 0.5.
      for (let R = 0; R < rows; R++)
        for (let C = 0; C < columns; C++) {
          const x = C + 0.5,
            y = rows - R - 0.5;
          const under =
            x > card.at[0] &&
            x < card.at[0] + card.size[0] &&
            y > card.at[1] &&
            y < card.at[1] + card.size[1];
          assert.equal(under, R > 0 && C > 0, `dot ${R},${C}`);
        }
      assert.deepEqual(
        texts.sort(),
        [`${columns} in each row`, `${rows} rows`].sort(),
      );
    }
  }
  for (const v of ["add-rows", "covered"])
    assert.ok((variants.get(v) ?? 0) > problems.length * 0.25, v);
  assert.ok(
    (variants.get("finish-the-sum") ?? 0) +
      (variants.get("finish-the-sum-columns") ?? 0) >
      problems.length * 0.25,
  );
  const share = oneRow / addRows;
  assert.ok(share > 0.05 && share < 0.16, `one-row share ${share}`);
  for (let r = 1; r <= 5; r++)
    for (let c = 2; c <= 5; c++) assert.ok(sizes.has(`${r}x${c}`), `${r}x${c}`);
});

test("choose the equation: exactly one counts the array and the distractors are the named mistakes", () => {
  const slots = new Map<string, number>();
  for (const p of many("equal-addends-match", 600)) {
    const { rows, columns } = arrayOf(sceneElements(p));
    assert.ok(rows >= 2 && columns >= 2 && rows * columns >= 6);
    const opts = options(p);
    assert.equal(opts.length, 4);
    for (const o of opts)
      assert.equal(
        countsArray(o.label, rows, columns),
        o.id === p.answer,
        o.label,
      );
    slots.set(p.answer, (slots.get(p.answer) ?? 0) + 1);
    const right = equalAddends(opts.find((o) => o.id === p.answer)!.label)!;
    assert.deepEqual(right, [columns, rows, rows * columns]);
    const labels = opts.map((o) => o.label);
    assert.ok(labels.includes(`$${rows} + ${columns} = ${rows + columns}$`));
    assert.notEqual(rows + columns, rows * columns);
    // Column orientation is never offered.
    assert.ok(
      !labels.includes(
        `$${Array(columns).fill(rows).join(" + ")} = ${rows * columns}$`,
      ) || rows === columns,
    );
  }
  for (const [slot, n] of slots) assert.ok(n > 600 * 0.17, slot);
});

test("choose the array: exactly one matches, the others are in range and never the turned array", () => {
  for (const p of many("equal-addends-array", 600)) {
    const r = p.public.response;
    assert.equal(r.kind, "figure-choice");
    if (r.kind !== "figure-choice") continue;
    assert.equal(r.noun, "Picture");
    const eq = equalAddends(p.public.prompt.match(/(\$[^$]+\$)\?$/)![1]!)!;
    const [addend, times] = eq;
    const drawn = r.options.map((o) => arrayOf(o.scene.elements));
    assert.equal(new Set(drawn.map((d) => `${d.rows}x${d.columns}`)).size, 4);
    for (const [i, d] of drawn.entries()) {
      assert.ok(d.rows >= 1 && d.rows <= 5 && d.columns >= 1 && d.columns <= 5);
      const match =
        (d.rows === times && d.columns === addend) ||
        (d.rows === addend && d.columns === times);
      assert.equal(match, r.options[i]!.id === p.answer);
      assert.match(
        r.options[i]!.label,
        new RegExp(
          `^An array of ${d.rows} rows? with ${d.columns} dots? in each row\\.$`,
        ),
      );
    }
  }
});

test("select both equations: rows and columns are keyed, the other two are not", () => {
  for (const p of many("equal-addends-select", 400)) {
    const { rows, columns } = arrayOf(sceneElements(p));
    assert.notEqual(rows, columns);
    const r = p.public.response;
    assert.equal(r.kind, "multi-select");
    if (r.kind !== "multi-select") continue;
    assert.equal(r.selectionCount, 2);
    const want = r.options
      .filter((o) => countsArray(o.label, rows, columns))
      .map((o) => o.id)
      .sort();
    assert.deepEqual(keyed(p), want);
    assert.equal(want.length, 2);
  }
});

/* ---------- independent oracle ---------- */

test("the independent oracle reviews 256 seeds of every template and rejects corrupt cases", () => {
  const cases = ids.flatMap((id) =>
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
import addend_strategies_math_oracle as oracle
print(oracle.self_test())
cases = json.load(sys.stdin)
for problem in cases:
    assert oracle.review_problem(problem) == problem['answer']
    assert oracle.solve(problem['public']) == problem['answer']
print({'cases': len(cases)})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, new RegExp(`'cases': ${ids.length * 256}`));
  assert.match(result.stdout, /'mutations': 9/);
});
