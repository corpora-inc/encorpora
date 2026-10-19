import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import { angleTemplates } from "../src/math/angle-practice";
import { templateRole } from "../src/learning/placement";
import { layoutScene } from "../src/math/scene";

test("angle problems are deterministic, valid, balanced scenes", () => {
  for (const t of angleTemplates) {
    assert.equal(t.requiredFigureCapability, "scenes-v1");
    const answers = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(t.id, `angle-${i}`);
      assert.deepEqual(p, generateProblem(t.id, `angle-${i}`));
      generatedProblemSchema.parse(p);
      assert.equal(p.public.figure?.kind, "scene");
      answers.set(p.answer, (answers.get(p.answer) ?? 0) + 1);
    }
    for (const [answer, n] of answers)
      assert.ok(n < 120, `${t.id} answers ${answer} ${n} times in 200`);
  }
});

test("a protractor angle is read from the scale at 0 on its first ray", () => {
  for (let i = 0; i < 100; i++) {
    const p = generateProblem("protractor-reading", `scale-${i}`);
    const f = p.public.figure!;
    assert(f.kind === "scene");
    const tool = f.scene.elements.find((e) => e.type === "protractor")!;
    assert(tool.type === "protractor");
    assert.equal(Number(p.answer), Math.abs(tool.rays[1] - tool.rays[0]));
  }
});

test("an unknown part is drawn as ? and never written in the payload", () => {
  for (let i = 0; i < 100; i++) {
    const p = generateProblem("adjacent-angles", `parts-${i}`);
    const f = p.public.figure!;
    assert(f.kind === "scene");
    const plain = layoutScene(f.scene).items.flatMap((d) =>
      d.k === "text" ? [d.plain] : [],
    );
    assert.ok(!plain.includes(`${p.answer}°`), p.public.prompt);
    assert.ok(!JSON.stringify(f).includes(`${p.answer}°`));
  }
});

test("every angle item is a whole assessment item", () => {
  for (const t of angleTemplates)
    assert.equal(templateRole(t.id), "assessment");
});
