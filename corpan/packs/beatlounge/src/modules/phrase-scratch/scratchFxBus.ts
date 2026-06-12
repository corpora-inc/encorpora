/**
 * beatlounge — phrase-SCRATCH master FX bus.
 *
 * The scratch decks play DIRECTLY on the shared AudioContext (they are not a
 * mixer track). This bus inserts an OPTIONAL effect chain on the scratch MASTER
 * output — between the decks' shared output and `ctx.destination` — so a few
 * high-value DJ effects (filter / delay / reverb / crush) colour BOTH decks at
 * once (the right model for a turntable: one chain on the whole table).
 *
 * The decks connect into a native `input` GainNode (passed to each deck as its
 * `destination`). The chain is the live `Effect`s built by the SHARED
 * `createEffect` factory (same Tone nodes + the same param schemas the fx-rack
 * uses, so a "Filter" here is the EXACT filter there). We bridge the native bus
 * node into the Tone chain with `Tone.connect`/`Tone.disconnect` (Tone shares
 * our AudioContext via `Tone.setContext`). The chain is rebuilt only when an
 * effect is added/removed; toggling/param moves go through the effect's own
 * `update`/`setParam` (no graph rebuild — exactly like the mixer inserts).
 *
 * Gesture-gated like the rest of scratch; `dispose()` frees every node.
 */

import * as Tone from "tone"
import type { Effect } from "../../contracts/engine"
import type { EffectKind, EffectNode } from "../../model/document"
import { createEffect } from "../../effects/createEffect"

/** One live insert on the scratch master: its config node + the built Effect. */
interface LiveInsert {
  node: EffectNode
  fx: Effect
}

export interface ScratchFxBus {
  /** The native node the decks connect into (pass as each deck's destination). */
  readonly input: AudioNode
  /** Rebuild the chain from a fresh ordered list of effect configs. */
  setInserts(nodes: EffectNode[]): void
  /** Re-apply ONE insert's params/enabled to its live node (no rebuild). */
  updateInsert(node: EffectNode): void
  /** Drive ONE param of an insert's live node in real time (knob drag). */
  liveParam(insertId: string, param: string, value: number): void
  /** Free every node + unhook the bridge. Idempotent. */
  dispose(): void
}

/**
 * Build the scratch master FX bus over the shared AudioContext. The input gain
 * is the decks' destination; the wired chain ends at `ctx.destination`.
 */
export const createScratchFxBus = (ctx: AudioContext): ScratchFxBus => {
  // Ensure Tone routes onto OUR context (idempotent; the main graph also sets
  // this — both use host.audioContext()).
  Tone.setContext(ctx)

  const input = ctx.createGain()
  let inserts: LiveInsert[] = []
  let disposed = false

  /** Tear down every audio connection from `input` through the chain. */
  const unwire = () => {
    try {
      input.disconnect()
    } catch {
      /* ignore */
    }
    for (const ins of inserts) {
      try {
        ins.fx.output.disconnect()
      } catch {
        /* ignore */
      }
    }
  }

  /** (Re)connect input → fx[0] → … → fx[n] → destination. */
  const wire = () => {
    let prev: AudioNode | Tone.ToneAudioNode = input
    for (const ins of inserts) {
      Tone.connect(prev, ins.fx.input)
      prev = ins.fx.output
    }
    // Tail → the speakers.
    Tone.connect(prev, ctx.destination)
  }

  const setInserts = (nodes: EffectNode[]) => {
    if (disposed) return
    unwire()
    for (const ins of inserts) ins.fx.dispose()
    inserts = nodes.map((node) => ({ node, fx: createEffect(node) }))
    wire()
  }

  const find = (insertId: string): LiveInsert | undefined =>
    inserts.find((i) => i.node.id === insertId)

  return {
    input,
    setInserts,
    updateInsert(node) {
      if (disposed) return
      const ins = find(node.id)
      if (!ins) return
      ins.node = node
      ins.fx.update(node.params, node.enabled)
    },
    liveParam(insertId, param, value) {
      if (disposed) return
      find(insertId)?.fx.setParam(param, value, Tone.now())
    },
    dispose() {
      if (disposed) return
      disposed = true
      unwire()
      for (const ins of inserts) ins.fx.dispose()
      inserts = []
    },
  }
}

/** The curated DJ insert palette for the scratch rack, in chain order. */
export const SCRATCH_FX_KINDS: readonly EffectKind[] = [
  "filter",
  "delay",
  "reverb",
  "bitcrusher",
]
