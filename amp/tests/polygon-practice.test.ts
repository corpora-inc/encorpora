import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import { polygonTemplates } from "../src/math/polygon-practice";
import { templateRole } from "../src/learning/placement";

test("polygon problems are deterministic, valid and balanced", () => {
  for (const t of polygonTemplates) {
    assert.equal(t.requiredFigureCapability, "scenes-v1");
    const answers = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(t.id, `polygon-${i}`);
      assert.deepEqual(p, generateProblem(t.id, `polygon-${i}`));
      generatedProblemSchema.parse(p);
      answers.set(p.answer, (answers.get(p.answer) ?? 0) + 1);
    }
    for (const [answer, n] of answers)
      assert.ok(n < 120, `${t.id} answers ${answer} ${n} times in 200`);
  }
});

test("grade 3 items mark sides and angles; the hierarchy marks parallel sides too", () => {
  const shapes = (id: string, seed: string) => {
    const f = generateProblem(id, seed).public.figure!;
    assert(f.kind === "scene");
    const e = f.scene.elements.find((x) => x.type === "shapes")!;
    assert(e.type === "shapes");
    return e;
  };
  for (let i = 0; i < 50; i++) {
    for (const id of ["classify-quadrilateral", "find-quadrilateral"])
      for (const item of shapes(id, `marks-${i}`).items)
        assert.equal(item.marks, "sides-angles");
    assert.equal(
      shapes("quadrilateral-names", `marks-${i}`).items[0]!.marks,
      "parallel",
    );
  }
});

test("solid parts obey Euler's formula in every explanation", () => {
  const seen = new Map<string, Set<string>>();
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("solid-parts", `solid-${i}`);
    const part = /How many (\w+)/.exec(p.public.prompt)![1]!;
    const kind = /The (.+) has/.exec(p.explanation.at(-1)!)![1]!;
    seen.set(kind, (seen.get(kind) ?? new Set()).add(`${part}=${p.answer}`));
  }
  const counts: Record<string, [number, number, number]> = {
    cube: [6, 12, 8],
    "rectangular prism": [6, 12, 8],
    "triangular prism": [5, 9, 6],
    "square pyramid": [5, 8, 5],
  };
  for (const [kind, parts] of seen) {
    const [f, e, v] = counts[kind]!;
    assert.equal(v - e + f, 2);
    for (const entry of parts)
      assert.ok(
        [`faces=${f}`, `edges=${e}`, `vertices=${v}`].includes(entry),
        `${kind} ${entry}`,
      );
  }
});

test("every polygon item is a whole assessment item", () => {
  for (const t of polygonTemplates)
    assert.equal(templateRole(t.id), "assessment");
});
