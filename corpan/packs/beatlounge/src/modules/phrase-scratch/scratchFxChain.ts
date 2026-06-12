/**
 * beatlounge — phrase-SCRATCH FX chain MODEL (pure).
 *
 * The scratch master rack is a FIXED, curated set of DJ inserts (filter, delay,
 * reverb, crush) held in local React state — there is no document coupling
 * (scratch is a live, hand-driven performance with no undo history). These pure
 * helpers build the default chain and apply toggle / param edits immutably so
 * the wiring is testable without React or the audio graph.
 *
 * Every insert reuses the SHARED `EffectNode` shape + the SHARED param defaults,
 * so the live nodes (built by `createEffect` on the bus) and the knobs (driven
 * by `EFFECT_SPECS`) can never drift. Inserts start BYPASSED (enabled:false) so
 * a fresh table is clean until the user dials one in.
 */

import type { EffectNode } from "../../model/document"
import { newId } from "../../model/ids"
import { defaultEffectParams } from "../../effects/params"
import { SCRATCH_FX_KINDS } from "./scratchFxBus"

/** A fresh, fully-bypassed scratch master rack (stable order, stable ids). */
export const defaultScratchChain = (): EffectNode[] =>
  SCRATCH_FX_KINDS.map((kind) => ({
    id: newId("scrfx"),
    kind,
    enabled: false,
    params: defaultEffectParams(kind),
  }))

/** True if any insert is engaged (drives the rack-open affordance's "on" dot). */
export const chainHasActive = (chain: readonly EffectNode[]): boolean =>
  chain.some((n) => n.enabled)

/** Toggle ONE insert's bypass; returns a new chain (others untouched). */
export const toggleInsert = (chain: readonly EffectNode[], id: string): EffectNode[] =>
  chain.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n))

/**
 * Set one-or-more params on ONE insert; returns a new chain. Turning a knob on a
 * bypassed insert also ENGAGES it (enabling on first touch is the DJ-natural move
 * — you grab the filter and it's live), unless `engage` is false.
 */
export const setInsertParams = (
  chain: readonly EffectNode[],
  id: string,
  params: Record<string, number | string>,
  engage = true
): EffectNode[] =>
  chain.map((n) =>
    n.id === id
      ? { ...n, enabled: engage ? true : n.enabled, params: { ...n.params, ...params } }
      : n
  )
