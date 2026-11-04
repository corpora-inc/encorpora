import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { generateProblem } from "../src/math/engine";

/**
 * place-shift-value, number-name-numeral and large-number-line-point
 * stored no variant before the wording axis. Digests were taken from
 * this branch before that axis, for seeds replay:0 through replay:199.
 * A bare surface must still emit that problem with no variant id.
 */
const golden = JSON.parse(
  readFileSync(
    new URL(
      "./fixtures/grade4-place-value-surface-replay.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as Record<string, { digest: string; variantId: string | null }[]>;

test("grade-4 place-value wording stays byte-identical on the bare surface", () => {
  assert.deepEqual(Object.keys(golden).sort(), [
    "large-number-line-point",
    "number-name-numeral",
    "place-shift-value",
  ]);
  for (const [id, rows] of Object.entries(golden)) {
    assert.equal(rows.length, 200, id);
    let legacy = 0;
    rows.forEach((row, i) => {
      const seed = `replay:${i}`;
      const now = generateProblem(id, seed);
      assert.deepEqual(generateProblem(id, seed), now, `${id} ${seed}`);
      if (now.variant != null) {
        assert.notEqual(now.variant.id, row.variantId, `${id} ${seed}`);
        return;
      }
      legacy++;
      const digest = createHash("sha256")
        .update(JSON.stringify(now))
        .digest("hex");
      assert.equal(now.variant ?? null, row.variantId, `${id} ${seed}`);
      assert.equal(digest, row.digest, `${id} ${seed}`);
    });
    assert.ok(legacy >= 8, `${id} reaches its stored surface (${legacy})`);
  }
});
