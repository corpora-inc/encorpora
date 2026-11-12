import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { generateProblem } from "../src/math/engine";
import { asFrozen } from "./fixtures/recorded-version";

/**
 * Instances saved before the grade-4 operation axes.
 *
 * A practice instance is the full problem JSON in amp_instances.content
 * (repository.saveProblem). The attempt row copies that problem's variant
 * onto amp_attempts.outcome, and a workbook result copies it the same way.
 * Replay regenerates from the stored template id and seed. The variant id is
 * an output of that regeneration, so a legacy axis value has to emit the id
 * that was stored, with no new token.
 *
 * The digests were generated from origin/main, before these axes, for seeds
 * replay:0 through replay:199. comparison-amount, full-kits, seats-needed,
 * kit-leftovers, and compatible-number-estimate gained an axis whose legacy
 * value is silent. estimate-reasonableness already recorded its operation
 * axis. Its draw weights changed, so some seeds move between surfaces. A
 * seed that still draws the legacy operation keeps the stored variant id.
 */
const golden = JSON.parse(
  readFileSync(
    new URL("./fixtures/grade4-operation-axes-replay.json", import.meta.url),
    "utf8",
  ),
) as Record<string, { digest: string; variantId: string | null }[]>;

const legacyAxis: Record<string, readonly (readonly [string, string])[]> = {
  "comparison-amount": [
    ["unknown", "larger"],
    ["frame18", "classic"],
  ],
  "full-kits": [
    ["number-domain", "within-55"],
    ["story27", "classic"],
  ],
  "seats-needed": [
    ["number-domain", "within-55"],
    ["telling25", "classic"],
  ],
  "kit-leftovers": [
    ["number-domain", "within-55"],
    ["scene25", "classic"],
  ],
  "compatible-number-estimate": [
    ["bounds", "point"],
    ["cast5", "classic"],
  ],
  "estimate-reasonableness": [
    ["operation", "total-product-quotient"],
    ["telling21", "classic"],
  ],
};

const onLegacy = (
  id: string,
  problem: ReturnType<typeof generateProblem>,
): boolean =>
  legacyAxis[id]!.every(([key, legacy]) => {
    const value = problem.variant?.axes?.[key];
    return value == null || value === legacy;
  });

const digestOf = (problem: ReturnType<typeof generateProblem>): string =>
  createHash("sha256")
    .update(JSON.stringify(asFrozen(problem)))
    .digest("hex");

test("stored operation instances replay byte-identical on the legacy axis value", () => {
  assert.deepEqual(Object.keys(golden).sort(), Object.keys(legacyAxis).sort());
  for (const [id, rows] of Object.entries(golden)) {
    assert.equal(rows.length, 200, id);
    let legacy = 0;
    rows.forEach((row, i) => {
      const seed = `replay:${i}`;
      const now = generateProblem(id, seed);
      assert.deepEqual(generateProblem(id, seed), now, `${id} ${seed}`);
      if (!onLegacy(id, now)) {
        assert.ok(
          legacyAxis[id]!.some(([key, legacyValue]) => {
            const value = now.variant?.axes?.[key];
            return value != null && value !== legacyValue;
          }),
          `${id} ${seed}`,
        );
        return;
      }
      // A weight change can move a seed onto the legacy surface. That seed's
      // stored instance was the other surface, so it is not a legacy replay.
      if (
        id === "estimate-reasonableness" &&
        row.variantId === "decimal-difference"
      )
        return;
      legacy++;
      assert.equal(now.variant?.id ?? null, row.variantId, `${id} ${seed}`);
      assert.equal(digestOf(now), row.digest, `${id} ${seed}`);
    });
    assert.ok(legacy >= 40, `${id} reaches its stored surface (${legacy})`);
    assert.ok(legacy < rows.length, `${id} still draws a newer axis value`);
  }
});
