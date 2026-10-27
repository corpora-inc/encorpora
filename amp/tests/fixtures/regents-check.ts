import assert from "node:assert/strict";
import { generateProblem, gradeAnswer } from "../../src/math/engine";

/** Shared checks for a Regents-sweep template: determinism, exactly one
 * correct choice among distinct labels, no answer leak in prompt or hint,
 * every variant reachable and the engine reaching the template. */
export function checkTemplate(
  id: string,
  opts: {
    variants: string[];
    seeds?: number;
    axes?: Record<string, string[]>;
    hintsMin?: number;
    minHints?: number;
  },
) {
  const seen = new Set<string>();
  const axisSeen: Record<string, Set<string>> = {};
  const hints = new Set<string>();
  const seeds = opts.seeds ?? 400;
  for (let i = 0; i < seeds; i++) {
    const seed = `reg:${i}`;
    const p = generateProblem(id, seed);
    const again = generateProblem(id, seed);
    assert.deepEqual(p, again, `${id} ${seed} deterministic`);
    assert.equal(p.public.templateId, id);
    seen.add(p.variant?.id ?? "");
    for (const [k, v] of Object.entries(p.variant?.axes ?? {}))
      (axisSeen[k] ??= new Set()).add(String(v));
    hints.add(p.hint);
    const r = p.public.response;
    if (r.kind === "figure-choice") {
      const labels = r.options.map((o) => o.label);
      assert.equal(
        new Set(labels).size,
        labels.length,
        `${id} ${seed} distinct`,
      );
      assert.equal(r.options.length, 4);
      assert.equal(r.options.filter((o) => o.id === p.answer).length, 1);
      for (const o of r.options)
        if (o.id !== p.answer)
          assert.ok(p.choiceFeedback?.[o.id]?.length, `${id} ${seed} feedback`);
      assert.equal(gradeAnswer(p, p.answer), true);
    } else if (r.kind === "choice") {
      const labels = r.options.map((o) => o.label);
      assert.equal(
        new Set(labels).size,
        labels.length,
        `${id} ${seed} distinct`,
      );
      assert.equal(r.options.length, 4);
      assert.equal(r.options.filter((o) => o.id === p.answer).length, 1);
      const correct = r.options.find((o) => o.id === p.answer)!.label;
      assert.ok(
        correct.length < 3 || !p.hint.includes(correct),
        `${id} ${seed} hint leaks ${correct}`,
      );
      for (const o of r.options)
        if (o.id !== p.answer)
          assert.ok(p.choiceFeedback?.[o.id]?.length, `${id} ${seed} feedback`);
      assert.equal(gradeAnswer(p, p.answer), true);
      const wrong = r.options.find((o) => o.id !== p.answer)!;
      assert.equal(gradeAnswer(p, wrong.id), false);
    } else {
      assert.equal(gradeAnswer(p, p.answer), true, `${id} ${seed} key`);
    }
    assert.ok(p.explanation.length >= 2);
  }
  for (const v of opts.variants)
    assert.ok(seen.has(v), `${id} variant ${v} unreachable (saw ${[...seen]})`);
  for (const [k, vs] of Object.entries(opts.axes ?? {}))
    for (const v of vs) assert.ok(axisSeen[k]?.has(v), `${id} axis ${k}=${v}`);
  assert.ok(
    hints.size >= (opts.hintsMin ?? opts.minHints ?? 20),
    `${id} hints vary (${hints.size})`,
  );
}
