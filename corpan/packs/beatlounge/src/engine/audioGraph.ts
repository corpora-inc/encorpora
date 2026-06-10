/**
 * beatlounge — the audio graph + diff-driven reconciler.
 *
 * Per track:
 *   instrument → insert[0]…insert[n] → panner → trackGain → masterVol → Limiter
 * Sends tap POST-FADER (off trackGain) through a per-send gain into a bus input.
 *
 * Per bus:
 *   busInput → insert[0]…insert[n] → busGain(volume/mute) → masterVol
 * Buses may themselves send (post-bus-fader) into other buses.
 *
 * Mute/solo is a derived, ramped GAIN (click-free), never a scheduler branch.
 * reconcile(prev, next) touches ONLY what changed: a single note edit rebuilds
 * nothing; a volume change ramps one gain; an insert PARAM edit just calls
 * `effect.update(params, enabled)`; only an insert STRUCTURE change (ids/kinds/
 * order — see ./chainSig) tears down and rebuilds that one chain.
 */

import * as Tone from "tone"
import type { AudioGraph, Effect, Instrument, ScheduledTrigger } from "../contracts/engine"
import type { Bus, BeatloungeDoc, EffectNode, Normalized, Send, Track } from "../model/document"
import { isTrackAudible } from "../model/document"
import { createInstrument, instrumentKindOf } from "../instruments/createInstrument"
import type { TtsFragmentDeps } from "../instruments/ttsFragment"
import { createEffect } from "../effects/createEffect"
import { chainSig } from "../effects/chainSig"

interface ChainState {
  /** Live effects in order; [] when the chain is empty (direct head→tail). */
  effects: Effect[]
  /** Structural signature the chain was last built from. */
  sig: string
}

interface SendState {
  gain: Tone.Gain
  busId: string
  preFader: boolean
}

interface TrackNodes {
  instrument: Instrument
  /** Head of the insert chain — instrument connects here. */
  chainHead: Tone.Gain
  panner: Tone.Panner
  /** Post-fader node: mute/solo/volume + the send tap point. */
  gain: Tone.Gain
  chain: ChainState
  sends: Map<string, SendState>
  kind: string
}

interface BusNodes {
  /** Where track/bus sends land + the chain head. */
  input: Tone.Gain
  /** Post-fader: bus volume/mute + the send tap point. */
  gain: Tone.Gain
  chain: ChainState
  sends: Map<string, SendState>
}

const RAMP = 0.008 // 8ms — click-free

const targetGain = (doc: BeatloungeDoc, track: Track): number =>
  isTrackAudible(doc, track) ? Math.max(0, Math.min(1, track.volume)) : 0

const busTargetGain = (bus: Bus): number =>
  bus.mute ? 0 : Math.max(0, Math.min(1, bus.volume))

export const createAudioGraph = (
  ctx: AudioContext,
  /** Phrase-sampler deps for ttsFragment tracks; omit for a synth fallback. */
  fragmentDeps?: TtsFragmentDeps
): AudioGraph => {
  // Ensure Tone uses our context so node times line up with the scheduler.
  Tone.setContext(ctx)

  const limiter = new Tone.Limiter(-1).toDestination()
  const masterVol = new Tone.Volume(Tone.gainToDb(0.8)).connect(limiter)

  const nodes = new Map<string, TrackNodes>()
  const buses = new Map<string, BusNodes>()

  // ----------------------------------------------------------- insert chains
  const disposeChain = (chain: ChainState) => {
    for (const fx of chain.effects) fx.dispose()
    chain.effects = []
  }

  /** (Re)wire `head → fx[0]…fx[n] → tail` for a fresh set of EffectNodes. */
  const buildChain = (
    head: Tone.ToneAudioNode,
    tail: Tone.ToneAudioNode,
    inserts: EffectNode[]
  ): ChainState => {
    const effects = inserts.map((node) => createEffect(node))
    let cursor: Tone.ToneAudioNode = head
    for (const fx of effects) {
      cursor.connect(fx.input)
      cursor = fx.output
    }
    cursor.connect(tail)
    return { effects, sig: chainSig(inserts) }
  }

  /**
   * Reconcile a chain in place. Structure unchanged ⇒ just update each effect's
   * params/enabled. Structure changed ⇒ disconnect head/tail, dispose, rebuild.
   */
  const reconcileChain = (
    chain: ChainState,
    head: Tone.ToneAudioNode,
    tail: Tone.ToneAudioNode,
    inserts: EffectNode[]
  ): ChainState => {
    if (chain.sig === chainSig(inserts)) {
      inserts.forEach((node, i) => chain.effects[i]?.update(node.params, node.enabled))
      return chain
    }
    // Structure changed → tear down old wiring + nodes, rebuild from head.
    head.disconnect()
    disposeChain(chain)
    return buildChain(head, tail, inserts)
  }

  // ----------------------------------------------------------- sends
  /** Reconcile a node's sends: add/remove send gains, ramp levels, re-target. */
  const reconcileSends = (
    tap: Tone.ToneAudioNode,
    state: Map<string, SendState>,
    sends: Send[],
    when: number
  ) => {
    const wanted = new Set(sends.map((s) => s.id))
    for (const [id, s] of state) {
      if (!wanted.has(id)) {
        s.gain.disconnect()
        s.gain.dispose()
        state.delete(id)
      }
    }
    for (const send of sends) {
      const target = buses.get(send.busId)
      let s = state.get(send.id)
      if (s && (s.busId !== send.busId || !target)) {
        // Re-target: drop the old wiring; rebuild below.
        s.gain.disconnect()
        s.gain.dispose()
        state.delete(send.id)
        s = undefined
      }
      if (!s) {
        const gain = new Tone.Gain(0)
        tap.connect(gain)
        if (target) gain.connect(target.input)
        s = { gain, busId: send.busId, preFader: !!send.preFader }
        state.set(send.id, s)
      }
      s.gain.gain.cancelScheduledValues(when)
      s.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, send.level)), when, RAMP)
    }
  }

  // ----------------------------------------------------------- tracks
  const build = (track: Track): TrackNodes => {
    const instrument = createInstrument(track.instrument, fragmentDeps)
    const gain = new Tone.Gain(0).connect(masterVol)
    const panner = new Tone.Panner(track.pan).connect(gain)
    const chainHead = new Tone.Gain(1)
    instrument.output.connect(chainHead)
    const chain = buildChain(chainHead, panner, track.inserts)
    void instrument.load({
      resolve: async () => new ArrayBuffer(0),
      url: async () => "",
    })
    return {
      instrument,
      chainHead,
      panner,
      gain,
      chain,
      sends: new Map(),
      kind: instrumentKindOf(track.instrument),
    }
  }

  const disposeTrack = (n: TrackNodes) => {
    for (const s of n.sends.values()) s.gain.dispose()
    n.sends.clear()
    disposeChain(n.chain)
    n.instrument.dispose()
    n.chainHead.dispose()
    n.panner.dispose()
    n.gain.dispose()
  }

  // ----------------------------------------------------------- buses
  const buildBus = (bus: Bus): BusNodes => {
    const gain = new Tone.Gain(0).connect(masterVol)
    const input = new Tone.Gain(1)
    const chain = buildChain(input, gain, bus.inserts)
    return { input, gain, chain, sends: new Map() }
  }

  const disposeBus = (b: BusNodes) => {
    for (const s of b.sends.values()) s.gain.dispose()
    b.sends.clear()
    disposeChain(b.chain)
    b.input.dispose()
    b.gain.dispose()
  }

  return {
    reconcile(prev, next) {
      const when = ctx.currentTime

      // ---- buses first: sends need their targets to exist before wiring ----
      const nextBusIds = new Set(next.buses.map((b) => b.id))
      for (const [id, b] of buses) {
        if (!nextBusIds.has(id)) {
          disposeBus(b)
          buses.delete(id)
        }
      }
      for (const bus of next.buses) {
        let b = buses.get(bus.id)
        if (!b) {
          b = buildBus(bus)
          buses.set(bus.id, b)
        } else {
          b.chain = reconcileChain(b.chain, b.input, b.gain, bus.inserts)
        }
        b.gain.gain.cancelScheduledValues(when)
        b.gain.gain.setTargetAtTime(busTargetGain(bus), when, RAMP)
      }

      // ---- tracks ----
      const nextIds = new Set(next.tracks.map((t) => t.id))
      for (const [id, n] of nodes) {
        if (!nextIds.has(id)) {
          disposeTrack(n)
          nodes.delete(id)
        }
      }

      for (const track of next.tracks) {
        let n = nodes.get(track.id)
        const kind = instrumentKindOf(track.instrument)
        if (n && n.kind !== kind) {
          // Instrument engine changed → rebuild this track only.
          disposeTrack(n)
          nodes.delete(track.id)
          n = undefined
        }
        if (!n) {
          n = build(track)
          nodes.set(track.id, n)
        } else {
          void n.instrument.update(track.instrument)
          n.chain = reconcileChain(n.chain, n.chainHead, n.panner, track.inserts)
        }
        // Always reconcile mute/solo-derived gain + pan (cheap, idempotent).
        n.gain.gain.cancelScheduledValues(when)
        n.gain.gain.setTargetAtTime(targetGain(next, track), when, RAMP)
        n.panner.pan.setTargetAtTime(track.pan, when, RAMP)
      }

      // ---- sends (after every bus input exists) ----
      for (const track of next.tracks) {
        const n = nodes.get(track.id)
        if (n) reconcileSends(n.gain, n.sends, track.sends, when)
      }
      for (const bus of next.buses) {
        const b = buses.get(bus.id)
        if (b) reconcileSends(b.gain, b.sends, bus.sends, when)
      }

      if (!prev || prev.masterVolume !== next.masterVolume) {
        this.setMasterVolume(next.masterVolume)
      }
    },

    dispatch(t: ScheduledTrigger) {
      const n = nodes.get(t.trackId)
      if (n) n.instrument.trigger(t.note, t.when)
    },

    setMasterVolume(v: Normalized) {
      masterVol.volume.value = Tone.gainToDb(Math.max(0.0001, Math.min(1, v)))
    },

    dispose() {
      for (const n of nodes.values()) disposeTrack(n)
      nodes.clear()
      for (const b of buses.values()) disposeBus(b)
      buses.clear()
      masterVol.dispose()
      limiter.dispose()
    },
  }
}
