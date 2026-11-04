import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";
import { templateArchetypes } from "../src/curriculum/template-archetypes";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { layoutScene } from "../src/math/scene";
import type { Element } from "../src/math/scene/spec";
import type { GeneratedProblem } from "../src/math/contracts";

const ids = [
  "multiply-two-digit",
  "quotient-remainder-one-digit",
  "factor-pairs-select",
  "multiples-select",
  "facts-to-twelve",
  "growing-shape-pattern",
] as const;

const factorsOf = (n: number) => {
  const out: number[] = [];
  for (let i = 1; i * i <= n; i++)
    if (n % i === 0) {
      out.push(i);
      if (i * i !== n) out.push(n / i);
    }
  return out.sort((a, b) => a - b);
};

const nums = (text: string) =>
  [...text.matchAll(/\d[\d,]*/g)].map((m) => Number(m[0].replace(/,/g, "")));
const bareThousands = /(?<![\d,])\d{4,}(?!\d)/;
const learnerText = (problem: GeneratedProblem) => {
  const chunks = [problem.public.prompt, problem.hint, ...problem.explanation];
  if (problem.choiceFeedback)
    chunks.push(...Object.values(problem.choiceFeedback));
  const response = problem.public.response;
  if (response.kind === "choice" || response.kind === "multi-select")
    chunks.push(...response.options.map((option) => option.label));
  if (response.kind === "multi-part-choice") {
    for (const blank of response.blanks)
      chunks.push(...blank.options.map((option) => option.label));
    for (const part of response.sentence ?? [])
      if ("text" in part) chunks.push(part.text);
  }
  return chunks.join("\n");
};

test("grade-4 operation types are registered once", () => {
  for (const id of ids) {
    assert.equal(templates.filter((t) => t.id === id).length, 1);
    assert.ok(templateArchetypes[id]?.length, id);
    assert.ok(
      actualFacetMappings.some((m) => m.templateId === id),
      id,
    );
    const problem = generateProblem(id, "lesson");
    assert.ok(
      problemLesson(id, problem.public.seed, problem.public.prompt).method
        .length >= 2,
    );
  }
});

test("two hundred seeds match an independent calculation", () => {
  const seen = Object.fromEntries(
    ids.map((id) => [id, new Set<string>()]),
  ) as Record<(typeof ids)[number], Set<string>>;
  for (const id of ids)
    for (let seed = 0; seed < 200; seed++) {
      const problem = generateProblem(id, `g4:${seed}`);
      assert.deepEqual(problem, generateProblem(id, `g4:${seed}`));
      assert.ok(gradeAnswer(problem, problem.answer), id);
      const prompt = problem.public.prompt;
      assert.equal(bareThousands.test(learnerText(problem)), false, id);
      seen[id].add(problem.variant?.id ?? "");
      if (id === "multiply-two-digit") {
        const [a, b] = nums(prompt);
        assert.equal(Number(problem.answer), a! * b!);
        assert.ok(a! <= 999 && b! <= 999);
        assert.equal(/area model|rows of/.test(prompt), false);
      } else if (id === "facts-to-twelve") {
        const [a, b] = nums(prompt);
        if (prompt.includes("×")) {
          assert.ok(a === 11 || a === 12 || b === 11 || b === 12);
          assert.equal(Number(problem.answer), a! * b!);
        } else {
          assert.ok(b === 11 || b === 12);
          assert.equal(a! % b!, 0);
          assert.equal(Number(problem.answer), a! / b!);
        }
      } else if (id === "growing-shape-pattern") {
        const start = Number(prompt.match(/starts with (\d+)/)![1]);
        const add = Number(prompt.match(/adds (\d+)/)![1]);
        const step = Number(prompt.match(/step (\d+)\?/)![1]);
        assert.ok(step >= 5);
        assert.equal(Number(problem.answer), start! + (step! - 1) * add!);
        const figure = problem.public.figure;
        assert.equal(figure?.kind, "scene");
        if (figure?.kind !== "scene") continue;
        assert.ok((figure.scene.width ?? 360) <= 720);
        assert.ok((figure.scene.maxHeight ?? 320) <= 720);
        assert.equal(
          figure.scene.elements.some((element) => element.type === "lineTable"),
          false,
        );
        for (const shown of [1, 2, 3]) {
          const rows: Element[] = figure.scene.elements.filter(
            (element) =>
              element.type === "array" &&
              Boolean(element.id?.startsWith(`s${shown}r`)),
          );
          assert.equal(rows.length, shown);
          let count = 0;
          for (const row of rows) {
            if (row.type !== "array") continue;
            assert.equal(row.rows, 1);
            assert.ok(row.columns <= 20);
            const index = Number(row.id?.slice(`s${shown}r`.length));
            assert.equal(row.columns, index === 0 ? start : add);
            count += row.columns;
          }
          assert.equal(count, start! + (shown - 1) * add!);
        }
        assert.equal(
          figure.scene.elements.some(
            (element) =>
              element.type === "array" && /^s[4-9]/.test(element.id ?? ""),
          ),
          false,
        );
        const layout = layoutScene(figure.scene);
        assert.deepEqual(layout.dropped, []);
        const tiles = layout.items.filter((item) => item.k === "rect");
        const labels = layout.items.filter((item) => item.k === "text");
        assert.equal(
          tiles.length,
          start! + (start! + add!) + (start! + 2 * add!),
        );
        assert.equal(labels.length, 3);
        for (const label of labels)
          for (const tile of tiles)
            assert.equal(
              label.box.x0 < tile.x + tile.w &&
                tile.x < label.box.x1 &&
                label.box.y0 < tile.y + tile.h &&
                tile.y < label.box.y1,
              false,
              label.plain,
            );
      } else if (id === "quotient-remainder-one-digit") {
        const [dividend, divisor] = nums(prompt);
        assert.ok(
          dividend! >= 100 &&
            dividend! <= 9999 &&
            divisor! >= 2 &&
            divisor! <= 9,
        );
        const q = Math.floor(dividend! / divisor!);
        const rem = dividend! - q * divisor!;
        assert.ok(rem > 0 && rem < divisor!);
        const response = problem.public.response;
        assert.equal(response.kind, "multi-part-choice");
        if (response.kind !== "multi-part-choice") continue;
        const key = JSON.parse(problem.answer) as Record<string, string>;
        const label = (blankId: string) =>
          response.blanks
            .find((b) => b.id === blankId)!
            .options.find((o) => o.id === key[blankId])!
            .label.replace(/,/g, "");
        assert.equal(Number(label("q")), q);
        if (prompt.includes("fraction"))
          assert.equal(Number(label("num")), rem);
        else assert.equal(Number(label("r")), rem);
        assert.equal(q * divisor! + rem, dividend);
      } else if (id === "factor-pairs-select") {
        const n = nums(prompt)[0]!;
        assert.ok(n >= 2 && n <= 144);
        const response = problem.public.response;
        assert.equal(response.kind, "multi-select");
        if (response.kind !== "multi-select") continue;
        const keyed = new Set(JSON.parse(problem.answer) as string[]);
        const selected = response.options
          .filter((o) => keyed.has(o.id))
          .map((o) => Number(o.label))
          .sort((a, b) => a - b);
        assert.deepEqual(selected, factorsOf(n));
        assert.ok(response.options.some((o) => !keyed.has(o.id)));
        assert.equal(
          new Set(response.options.map((o) => o.label)).size,
          response.options.length,
        );
      } else {
        const d = nums(prompt)[0]!;
        const response = problem.public.response;
        assert.equal(response.kind, "multi-select");
        if (response.kind !== "multi-select") continue;
        const keyed = new Set(JSON.parse(problem.answer) as string[]);
        assert.equal(
          new Set(response.options.map((o) => o.label)).size,
          response.options.length,
        );
        for (const option of response.options) {
          const value = Number(option.label);
          const multiple = value % d === 0;
          assert.equal(keyed.has(option.id), multiple, `${value} of ${d}`);
          if (!multiple)
            assert.ok(
              response.options.some(
                (other) =>
                  Math.abs(Number(other.label) - value) === 1 &&
                  keyed.has(other.id),
              ),
            );
        }
      }
    }
  assert.ok(seen["multiply-two-digit"].has("2x2"));
  assert.ok(seen["multiply-two-digit"].has("3x2"));
  assert.ok(seen["multiply-two-digit"].has("square"));
  assert.ok(seen["facts-to-twelve"].has("multiply"));
  assert.ok(seen["facts-to-twelve"].has("divide"));
  assert.ok(seen["factor-pairs-select"].has("to-100"));
  assert.ok(seen["factor-pairs-select"].has("to-144"));
  assert.ok([...seen["quotient-remainder-one-digit"]].length >= 1);
});
