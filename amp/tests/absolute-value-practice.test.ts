import { test } from "node:test";
import assert from "node:assert/strict";
import { absoluteValueTemplates } from "../src/math/absolute-value-practice";
import { generateProblem } from "../src/math/engine";

const seeds = Array.from({ length: 60 }, (_, i) => `abs-${i}`);
const frame = (prompt: string) => prompt.split(/\|/)[0]!.replace(/[−\d]+$/, "");

test("each absolute-value template is deterministic and uses three prompt frames", () => {
  for (const t of absoluteValueTemplates) {
    const problems = seeds.map((s) => generateProblem(t.id, s));
    assert.deepEqual(
      problems.map((p) => p.public.prompt),
      seeds.map((s) => generateProblem(t.id, s).public.prompt),
    );
    assert.equal(
      new Set(problems.map((p) => frame(p.public.prompt))).size,
      3,
      t.id,
    );
  }
});

test("each hint names this problem's equation or inside expression", () => {
  for (const t of absoluteValueTemplates)
    for (const s of seeds) {
      const p = generateProblem(t.id, s),
        equation = /(?:Solve|make|which) (.+?)(?:\. Choose| true\?)/.exec(
          p.public.prompt,
        )![1]!;
      const inside = /\|([^|]+)\|/.exec(equation)![1]!;
      assert.ok(
        p.hint.includes(equation) ||
          p.hint.includes(inside) ||
          t.id.includes("direct"),
        `${t.id}: ${p.hint}`,
      );
      assert.ok(!/no real solutions|all real numbers/i.test(p.hint), p.hint);
    }
});
