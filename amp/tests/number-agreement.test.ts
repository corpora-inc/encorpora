import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, templates } from "../src/math/engine";

// A count of 1 next to a plural verb ("1 were taken out") reads as a typo.
// Sample every template widely and check every learner-facing sentence.
const plural = /(?<![\d.,/])\b1 (?:[a-z]+ )?(?:were|are|have|stayed|remain)\b/;

test("a count of one never takes a plural verb", () => {
  const found = new Set<string>();
  for (const template of templates)
    for (let seed = 0; seed < 300; seed++) {
      const p = generateProblem(template.id, `agreement-${seed}`) as unknown as Record<string, unknown>;
      const text = [p.prompt, p.hint, ...((p.explanation as string[]) ?? [])].join("\n");
      const m = text.match(plural);
      if (m) found.add(`${template.id}: …${text.slice(Math.max(0, m.index! - 30), m.index! + 40)}…`);
    }
  assert.deepEqual([...found], []);
});
