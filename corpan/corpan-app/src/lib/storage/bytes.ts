// src/lib/storage/bytes.ts — one shared byte estimator for eviction/budget
// accounting across tiers. We don't need exactness, just stable ordering.

/** Approximate byte size of a JSON-stringified value. Cheap + good enough
 *  for eviction accounting (we don't need exactness, just ordering). */
export function estimateSize(v: unknown): number {
  try {
    if (typeof v === "string") return v.length * 2
    return JSON.stringify(v).length * 2
  } catch {
    return 0
  }
}
