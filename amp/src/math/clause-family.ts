import { createHash } from "node:crypto";
import { generatingVersion } from "./variation/axes";

/**
 * Pick a clause family without touching the template's content RNG.
 *
 * Stored workbooks reprint at the version they were saved with. A family
 * introduced at `since` stays off that path, so the older bytes still match.
 * `generatingVersion()` is null when a generator is called directly; null
 * means the current version and the new families may appear.
 *
 * The first entry whose id is `legacy` is the pre-clause path. Give it
 * enough weight that existing corpus checks still see it.
 */
export function clauseFamily<T extends string>(
  templateId: string,
  seed: string,
  since: number,
  weights: readonly { id: T; weight: number }[],
  legacy: T,
): T {
  const version = generatingVersion();
  if (version != null && version < since) return legacy;
  const total = weights.reduce((sum, row) => sum + row.weight, 0);
  if (total < 1) return legacy;
  let n = draw(templateId, seed, total);
  for (const row of weights) {
    if (n < row.weight) return row.id;
    n -= row.weight;
  }
  return legacy;
}

function draw(templateId: string, seed: string, span: number): number {
  const limit = Math.floor(0x100000000 / span) * span;
  let n: number;
  let counter = 0;
  do {
    n = createHash("sha256")
      .update(JSON.stringify([templateId, "clause-family", seed, counter++]))
      .digest()
      .readUInt32BE(0);
  } while (n >= limit);
  return n % span;
}
