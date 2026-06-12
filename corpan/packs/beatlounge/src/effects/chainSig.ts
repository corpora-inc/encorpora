/**
 * beatlounge — pure insert-chain signature helper.
 *
 * The audioGraph rebuilds a track/bus insert chain ONLY when its STRUCTURE
 * (the ordered list of insert ids + kinds) changes; a mere param/enabled edit
 * just calls `effect.update(params, enabled)`. This module isolates that
 * structural-diff decision so it's unit-testable without any Tone nodes.
 */

import type { EffectNode } from "../model/document"

/** A stable signature of a chain's structure: `id:kind|id:kind|…`. */
export const chainSig = (inserts: EffectNode[]): string =>
  inserts.map((fx) => `${fx.id}:${fx.kind}`).join("|")

/** True ⇒ the chain must be torn down and rebuilt (ids/kinds/order changed). */
export const chainStructureChanged = (
  prev: EffectNode[] | undefined,
  next: EffectNode[]
): boolean => chainSig(prev ?? []) !== chainSig(next)
