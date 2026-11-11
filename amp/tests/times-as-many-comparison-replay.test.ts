import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { generateProblem } from "../src/math/engine";
import { asFrozen } from "./fixtures/recorded-version";

/**
 * times-as-many-comparison before the story19 axis.
 *
 * Seeds replay:0 through replay:199 were generated on this branch before the
 * axis. A classic draw keeps that problem, including a missing variant. A
 * newer story records story19 and may change only the wording.
 * origin/main used skill multiplicative-stories; this branch already serves
 * multiplicative-comparison, so the fixture is the branch surface, not main.
 */
const golden = JSON.parse(
  readFileSync(
    new URL("./fixtures/times-as-many-comparison-replay.json", import.meta.url),
    "utf8",
  ),
) as { digest: string; variantId: string | null }[];

const digestOf = (problem: ReturnType<typeof generateProblem>): string =>
  createHash("sha256")
    .update(JSON.stringify(asFrozen(problem)))
    .digest("hex");

test("times-as-many comparison replays the stored wording on the classic story", () => {
  assert.equal(golden.length, 200);
  let classic = 0;
  golden.forEach((row, i) => {
    const seed = `replay:${i}`;
    const now = generateProblem("times-as-many-comparison", seed);
    assert.deepEqual(generateProblem("times-as-many-comparison", seed), now);
    const story = now.variant?.axes?.story19;
    if (story != null && story !== "classic") return;
    classic++;
    assert.equal(now.variant?.id ?? null, row.variantId, seed);
    assert.equal(digestOf(now), row.digest, seed);
  });
  assert.ok(classic >= 40, `classic surface ${classic}`);
  assert.ok(classic < golden.length, "a newer story is drawn");
});
