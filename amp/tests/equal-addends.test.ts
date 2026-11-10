import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { clientCanDraw, generatedProblemSchema } from "../src/math/contracts";
import {
  generateProblem,
  generateProblemFor,
  gradeAnswer,
  isValidResponse,
  templates,
} from "../src/math/engine";
import {
  equalAddendsGuessChance,
  equalAddendsResponseSchema,
  equalAddendsFeedback,
  gradeEqualAddends,
  normalizeEqualAddends,
  type EqualAddendsResponse,
  type EqualAddendsAnswer,
} from "../src/math/equal-addends";
import { equalAddendsVariants } from "../src/math/equal-addends-practice";
import { guessChanceOf, problemGuessChance } from "../src/math/guess-chance";
import { problemLesson } from "../src/content/problem-lessons";
import { PrintExerciseBody } from "../src/content/print-exercise";

const config = {
  mode: "given" as const,
  orientation: "either" as const,
  rows: 3,
  columns: 4,
};
const r: EqualAddendsResponse = {
  ...config,
  kind: "equal-addends",
  label: "Build the sum",
  thing: "apple",
  maxAddends: 5,
  guessChance: equalAddendsGuessChance(config),
};
const answer: EqualAddendsAnswer = {
  rows: 3,
  columns: 4,
  addends: [4, 4, 4],
  total: 12,
};
const key = JSON.stringify(answer);
const raw = (change: Partial<EqualAddendsAnswer>) =>
  JSON.stringify({ ...answer, ...change });

test("exact grading accepts both orientations only when permitted, including square and 5-by-5 arrays", () => {
  for (let rows = 2; rows <= 5; rows++)
    for (let columns = 2; columns <= 5; columns++)
      for (const orientation of ["rows", "columns", "either"] as const) {
        const response = { ...r, rows, columns, orientation };
        const row = JSON.stringify({
          rows,
          columns,
          addends: Array(rows).fill(columns),
          total: rows * columns,
        });
        const col = JSON.stringify({
          rows,
          columns,
          addends: Array(columns).fill(rows),
          total: rows * columns,
        });
        assert.equal(
          gradeEqualAddends(response, row, row),
          orientation !== "columns" || rows === columns,
        );
        assert.equal(
          gradeEqualAddends(response, row, col),
          orientation !== "rows" || rows === columns,
        );
      }
  for (const [change, feedback] of [
    [{ addends: [4, 3, 4] }, "Each row has 4, so each addend is 4."],
    [{ addends: [4, 4] }, "There are 3 rows, so use 3 addends."],
    [{ addends: [4] }, "There are 3 rows, so use 3 addends."],
    [{ total: 11 }, "Add one row at a time: 4, 8, 12."],
    [
      { addends: [3, 3, 3], total: 9 },
      "There are 4 columns, so use 4 addends.",
    ],
  ] as const) {
    const attempt = raw(change as Partial<EqualAddendsAnswer>);
    assert.ok(normalizeEqualAddends(r, attempt));
    assert.equal(gradeEqualAddends(r, key, attempt), false);
    assert.deepEqual(equalAddendsFeedback(r, key, attempt), [feedback]);
  }
  const build = {
    ...r,
    mode: "build" as const,
    rows: undefined,
    columns: undefined,
  };
  assert.equal(
    gradeEqualAddends(
      build,
      key,
      raw({ rows: 4, columns: 3, addends: [3, 3, 3, 3] }),
    ),
    false,
  );
  assert.deepEqual(equalAddendsFeedback(build, key, raw({ rows: 4 })), [
    "Build 3 rows of 4 to match the story.",
  ]);
});

test("schemas reject malformed input and hidden changes to given dimensions, preserving valid mistakes", () => {
  equalAddendsResponseSchema.parse(r);
  assert.equal(
    equalAddendsResponseSchema.safeParse({ ...r, guessChance: 0 }).success,
    false,
  );
  assert.equal(
    equalAddendsResponseSchema.safeParse({ ...r, mode: "build" }).success,
    false,
  );
  for (const attempt of [
    "null",
    "[]",
    "{}",
    raw({ rows: 4 }),
    raw({ columns: 3 }),
    raw({ addends: [] }),
    raw({ addends: [4, 4, 4, 4, 4, 4] }),
    raw({ addends: [1.5, 1.5] }),
    raw({ addends: [0, 4] }),
    raw({ total: -1 }),
    raw({ total: 100 }),
    raw({ total: 2.5 }),
    key.replace("12", "null"),
    key.slice(0, -1) + ',"extra":true}',
    key.replace("[4,4,4]", "[null,4,4]"),
  ])
    assert.equal(normalizeEqualAddends(r, attempt), null, attempt);
  assert.equal(
    normalizeEqualAddends(
      r,
      JSON.stringify({ total: 12, addends: [4, 4, 4], columns: 4, rows: 3 }),
    ),
    key,
  );
});

test("declared guess chance counts every reachable complete tile sequence, board and total", () => {
  // Independent enumeration of the reachable UI: one value and 1..5 repeats.
  let sequences = 0,
    wins = 0;
  const visit = (values: number[]) => {
    if (values.length && values.every((n) => n === values[0])) {
      sequences++;
      if (
        (values.length === 3 && values.every((n) => n === 4)) ||
        (values.length === 4 && values.every((n) => n === 3))
      )
        wins++;
    }
    if (values.length === 5) return;
    for (let n = 1; n <= 5; n++) visit([...values, n]);
  };
  visit([]);
  assert.equal(sequences, 25);
  assert.equal(r.guessChance, wins / (sequences * 100));
  assert.equal(
    equalAddendsGuessChance({ ...config, mode: "build" }),
    wins / (sequences * 100 * 25),
  );
});

test("2000 seeds are deterministic, cover every size and variant, and match a separate arithmetic oracle", () => {
  const cases = Array.from({ length: 2000 }, (_, i) =>
    generateProblem("array-equal-addends-equation", `equal-${i}`),
  );
  const seen = new Map<string, number>(),
    sizes = new Set<string>(),
    things = new Set<string>();
  const template = templates.find(
    (t) => t.id === "array-equal-addends-equation",
  )!;
  assert.ok(
    clientCanDraw(template, {
      responseCapabilities: ["equal-addends-v1"],
      figureCapabilities: [],
    }),
  );
  assert.ok(
    clientCanDraw(template, {
      responseCapabilities: ["single-choice-v1"],
      figureCapabilities: ["scenes-v1"],
    }),
  );
  assert.equal(
    clientCanDraw(template, {
      responseCapabilities: ["single-choice-v1"],
      figureCapabilities: [],
    }),
    false,
  );
  for (const p of cases) {
    generatedProblemSchema.parse(p);
    assert.deepEqual(generateProblem(p.public.templateId, p.public.seed), p);
    assert.ok(gradeAnswer(p, p.answer));
    assert.ok(isValidResponse(p.public, p.answer));
    const a = JSON.parse(p.answer) as EqualAddendsAnswer,
      response = p.public.response as EqualAddendsResponse;
    seen.set(p.variant!.id, (seen.get(p.variant!.id) ?? 0) + 1);
    sizes.add(`${a.rows}x${a.columns}`);
    things.add(response.thing);
    assert.ok(
      problemGuessChance(p) > 0 &&
        problemGuessChance(p) <= response.guessChance,
    );
    assert.ok(guessChanceOf(p.public.templateId) >= problemGuessChance(p));
    assert.doesNotMatch(
      JSON.stringify(p.public),
      /"answer"|"addends"|"total"|walkthrough/,
    );
    if (response.mode === "build") assert.equal(response.rows, undefined);
    const fallback = generateProblemFor(
      p.public.templateId,
      p.public.seed,
      ["scenes-v1"],
      undefined,
      ["single-choice-v1"],
    );
    generatedProblemSchema.parse(fallback);
    assert.equal(fallback.public.response.kind, "choice");
    if (fallback.public.response.kind !== "choice") throw new Error("fallback");
    assert.equal(
      new Set(fallback.public.response.options.map((o) => o.label)).size,
      4,
    );
    const valid = fallback.public.response.options.filter((o) => {
      const [left, total] = o.label.replaceAll("$", "").split(" = ");
      const nums = left!.split(" + ").map(Number);
      return (
        Number(total) === a.total &&
        ((response.orientation !== "columns" &&
          nums.length === a.rows &&
          nums.every((n) => n === a.columns)) ||
          (nums.length === a.columns && nums.every((n) => n === a.rows)))
      );
    });
    assert.deepEqual(
      valid.map((o) => o.id),
      [fallback.answer],
    );
  }
  for (const v of equalAddendsVariants) assert.ok(seen.get(v)! >= 50);
  assert.equal(sizes.size, 16);
  assert.equal(things.size, 6);
  const oracle = spawnSync(
    "python3",
    ["scripts/equal_addends_math_oracle.py"],
    {
      input: cases.map((p) => JSON.stringify(p)).join("\n"),
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(oracle.status, 0, oracle.stderr + oracle.stdout);
  assert.match(oracle.stdout, /2000 arrays and 8000 corrupted keys/);
  const routing = spawnSync(
    "python3",
    [
      "-c",
      "import runpy,sys; sys.path.insert(0,'scripts'); m=runpy.run_path('scripts/independent-math-review.py'); assert 'array-equal-addends-equation' in m['FAMILY_ORACLE_FOR']",
    ],
    { encoding: "utf8" },
  );
  assert.equal(routing.status, 0, routing.stderr);
});

test("lessons avoid the active array in either orientation; print draws objects and a writable sentence", () => {
  for (let i = 0; i < 20; i++) {
    const p = generateProblem("array-equal-addends-equation", `lesson-${i}`);
    const a = JSON.parse(p.answer) as EqualAddendsAnswer;
    const lesson = problemLesson(
      p.public.templateId,
      p.public.seed,
      p.public.prompt,
      p.public.response,
      p,
    );
    assert.doesNotMatch(JSON.stringify(lesson), /\\"addends\\"/);
    assert.doesNotMatch(
      lesson.example.answer,
      new RegExp(
        `^(${a.rows} rows of ${a.columns}|${a.columns} rows of ${a.rows})\\.`,
      ),
    );
    for (const solutions of [false, true]) {
      const html = renderToStaticMarkup(
        createElement(PrintExerciseBody, { problem: p, number: 1, solutions }),
      );
      assert.doesNotMatch(html, /&quot;addends&quot;/);
      if (!solutions) assert.match(html, /Addition sentence/);
      else assert.match(html, /svg/);
    }
  }
});
