import { generateBeforeClauses as generateProblem } from "./helpers/before-clause-variants";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {} from "../src/math/engine";

/**
 * Instances saved before the grade-4 measurement narrative axis.
 *
 * Replay regenerates from the stored template id and seed. The plain value
 * of narrative-b is silent, so those seeds keep the pre-axis problem with
 * no variant. The digests were generated from origin/main, before the axis,
 * for seeds replay:0 through replay:199.
 */
const golden = JSON.parse(
  readFileSync(
    new URL("./fixtures/grade4-measurement-money-replay.json", import.meta.url),
    "utf8",
  ),
) as Record<string, { digest: string; variantId: string | null }[]>;

const digestOf = (problem: ReturnType<typeof generateProblem>): string =>
  createHash("sha256").update(JSON.stringify(problem)).digest("hex");

test("stored measurement problems replay on the plain narrative", () => {
  assert.deepEqual(Object.keys(golden).sort(), [
    "conversion-table-slots",
    "decimal-sum-difference",
    "elapsed-time-intervals",
    "measurement-line-fraction-story",
    "measuring-tool-choice",
    "money-decimal-story",
    "money-model-decimal",
    "unit-rename-larger",
  ]);
  for (const [id, rows] of Object.entries(golden)) {
    assert.equal(rows.length, 200, id);
    let plain = 0;
    rows.forEach((row, i) => {
      const seed = `replay:${i}`;
      const now = generateProblem(id, seed);
      assert.deepEqual(generateProblem(id, seed), now, `${id} ${seed}`);
      assert.equal(row.variantId, null, `${id} ${seed}`);
      if (now.variant != null) {
        assert.equal(now.variant.id, "story", `${id} ${seed}`);
        assert.notEqual(digestOf(now), row.digest, `${id} ${seed}`);
        return;
      }
      plain++;
      assert.equal(digestOf(now), row.digest, `${id} ${seed}`);
    });
    assert.ok(plain >= 8, `${id} reaches its stored surface (${plain})`);
  }
});
