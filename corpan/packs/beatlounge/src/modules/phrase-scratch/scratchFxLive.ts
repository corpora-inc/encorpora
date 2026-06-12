/**
 * beatlounge — phrase-SCRATCH live FX-chain MODEL (pure).
 *
 * The scratch master rack is now the FULL, chainable effect pipeline — the SAME
 * canonical rack drums / instruments use (`FxChainView`), driven over the live
 * `ScratchFxBus` instead of the document. Scratch is a hand-driven performance
 * with NO undo history, so the chain lives in local React state; these pure
 * helpers add / remove / reorder / toggle / param-edit it immutably so the
 * add+remove+reorder wiring is testable without React or the audio graph.
 *
 * Every insert reuses the SHARED `EffectNode` shape + the SHARED param defaults
 * (`defaultEffectParams`), so the live nodes (built by `createEffect` on the bus)
 * and the knobs (driven by `EFFECT_SPECS`) can never drift. A freshly-added
 * insert starts ENABLED (DJ-natural — you add the delay and it's live), matching
 * the doc rack's add behavior.
 */

import type { EffectKind, EffectNode } from "../../model/document"
import { newId } from "../../model/ids"
import { defaultEffectParams } from "../../effects/params"

/** A fresh, empty scratch master rack. */
export const emptyScratchChain = (): EffectNode[] => []

/** True if any insert is engaged (drives the rack-open affordance's "on" dot). */
export const chainHasActive = (chain: readonly EffectNode[]): boolean =>
  chain.some((n) => n.enabled)

/** Append a fresh, enabled insert of `kind`; returns a new chain. */
export const addInsert = (
  chain: readonly EffectNode[],
  kind: EffectKind
): EffectNode[] => [
  ...chain,
  { id: newId("scrfx"), kind, enabled: true, params: defaultEffectParams(kind) },
]

/** Remove the insert with `id`; returns a new chain (others untouched). */
export const removeInsert = (
  chain: readonly EffectNode[],
  id: string
): EffectNode[] => chain.filter((n) => n.id !== id)

/**
 * Move the insert with `id` by `dir` (−1 up, +1 down); returns a new chain. A
 * no-op (returns the same array contents) at the ends.
 */
export const moveInsert = (
  chain: readonly EffectNode[],
  id: string,
  dir: -1 | 1
): EffectNode[] => {
  const idx = chain.findIndex((n) => n.id === id)
  if (idx < 0) return [...chain]
  const to = idx + dir
  if (to < 0 || to >= chain.length) return [...chain]
  const next = [...chain]
  const [moved] = next.splice(idx, 1)
  next.splice(to, 0, moved)
  return next
}

/** Toggle ONE insert's bypass; returns a new chain (others untouched). */
export const toggleInsert = (
  chain: readonly EffectNode[],
  id: string
): EffectNode[] =>
  chain.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n))

/**
 * Set one-or-more params on ONE insert; returns a new chain. Unlike a fresh add
 * (which is already enabled), a param edit does NOT force-engage — the power dot
 * stays the user's explicit choice (the doc rack behaves the same).
 */
export const setInsertParams = (
  chain: readonly EffectNode[],
  id: string,
  params: Record<string, number | string>
): EffectNode[] =>
  chain.map((n) =>
    n.id === id ? { ...n, params: { ...n.params, ...params } } : n
  )
