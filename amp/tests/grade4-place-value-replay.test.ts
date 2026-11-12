import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { generateProblem } from "../src/math/engine";
import { asFrozen } from "./fixtures/recorded-version";

/**
 * Instances saved before the grade-4 place-value axes.
 *
 * A practice instance is the full problem JSON in amp_instances.content
 * (repository.saveProblem). The attempt row copies that problem's variant
 * onto amp_attempts.outcome, and a workbook result copies it the same way.
 * Replay regenerates from the stored template id and seed. The variant id is
 * an output of that regeneration, so a legacy axis value has to emit the id
 * that was stored, with no new token.
 *
 * The digests were generated from origin/main, before these axes, for seeds
 * replay:0 through replay:199. digit-value-ratio moved to the grade-4
 * large-place-value skill; its stored skill id is the only intentional change.
 */
const golden = JSON.parse(
  readFileSync(
    new URL("./fixtures/grade4-place-value-replay.json", import.meta.url),
    "utf8",
  ),
) as Record<string, { digest: string; variantId: string | null }[]>;

const onLegacy = (
  id: string,
  problem: ReturnType<typeof generateProblem>,
): boolean => {
  if (id === "digit-value-ratio") return problem.variant == null;
  if (id === "round-large" || id === "multidigit-digit-value")
    return problem.variant == null;
  if (id === "order-whole-numbers-slots")
    return (
      problem.variant?.axes?.count == null &&
      problem.variant?.axes?.setting == null
    );
  return (
    problem.variant?.axes?.magnitude == null &&
    problem.variant?.axes?.surface == null
  );
};

const digestOf = (
  id: string,
  problem: ReturnType<typeof generateProblem>,
): string => {
  const copy = structuredClone(asFrozen(problem));
  if (id === "digit-value-ratio") copy.public.skillId = "powers-of-ten";
  return createHash("sha256").update(JSON.stringify(copy)).digest("hex");
};

test("stored place-value instances replay byte-identical on the legacy axis value", () => {
  assert.deepEqual(Object.keys(golden).sort(), [
    "compare-symbol-blanks",
    "digit-value-ratio",
    "expanded-whole-slots",
    "multidigit-digit-value",
    "order-whole-numbers-slots",
    "round-large",
  ]);
  for (const [id, rows] of Object.entries(golden)) {
    assert.equal(rows.length, 200, id);
    let legacy = 0;
    rows.forEach((row, i) => {
      const seed = `replay:${i}`;
      const now = generateProblem(id, seed);
      assert.deepEqual(generateProblem(id, seed), now, `${id} ${seed}`);
      if (id === "digit-value-ratio")
        assert.equal(now.public.skillId, "large-place-value", seed);
      if (!onLegacy(id, now)) {
        if (id === "round-large" || id === "multidigit-digit-value")
          assert.notEqual(now.variant!.id, "legacy", `${id} ${seed}`);
        else assert.notEqual(now.variant!.id, row.variantId, `${id} ${seed}`);
        return;
      }
      legacy++;
      assert.equal(now.variant?.id ?? null, row.variantId, `${id} ${seed}`);
      assert.equal(digestOf(id, now), row.digest, `${id} ${seed}`);
    });
    assert.ok(
      // A new wording axis shares the seed with an older axis, so the
      // fully stored surface (every axis legacy) is a smaller slice.
      // Each of those seeds is still checked byte for byte above.
      legacy >=
        ({
          "round-large": 15,
          "digit-value-ratio": 8,
          "order-whole-numbers-slots": 2,
          "compare-symbol-blanks": 8,
          "expanded-whole-slots": 8,
          "multidigit-digit-value": 8,
        }[id] ?? 40),
      `${id} reaches its stored surface (${legacy})`,
    );
  }
});
