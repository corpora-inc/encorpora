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
import { CROSSFADE_SEC, startCrossfade } from "./crossfade"

/** An in-flight crossfade: its idempotent teardown + the clearable timer. */
interface PendingFade {
  finalize: () => void
  timer: ReturnType<typeof setTimeout>
}

interface ChainState {
  /** Live effects in order; [] when the chain is empty (direct head→fade). */
  effects: Effect[]
  /** Structural signature the chain was last built from. */
  sig: string
  /** Terminating unity gain (`…lastFx → fade → tail`); the crossfade ramps it. */
  fade: Tone.Gain
  /** The node `head` connects INTO for this chain (effects[0].input, or `fade`
   *  for an empty chain) — lets us targeted-disconnect head→here on teardown. */
  headTarget: Tone.ToneAudioNode
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
  // Latest doc, kept so applyParam can resolve insertId → effect by index.
  let currentDoc: BeatloungeDoc | null = null

  // ----------------------------------------------------------- insert chains
  // In-flight crossfades, keyed by the NEW (now-current) chain they produced.
  // When a newer restructure arrives mid-fade we look the prior one up here,
  // finalize it immediately (deterministic, leak-free), then start fresh.
  const pendingFades = new Map<ChainState, PendingFade>()

  /** Dispose a chain's EFFECTS (its fade gain is disposed separately, after
   *  the crossfade window or in disposeTrack/Bus). Idempotent. */
  const disposeChain = (chain: ChainState) => {
    for (const fx of chain.effects) fx.dispose()
    chain.effects = []
  }

  /** (Re)wire `head → fx[0]…fx[n] → fade → tail` for a fresh set of
   *  EffectNodes. Every chain — including empty — terminates in a unity fade
   *  `Gain` (default 1) so a crossfade can ramp it without touching `tail`. */
  const buildChain = (
    head: Tone.ToneAudioNode,
    tail: Tone.ToneAudioNode,
    inserts: EffectNode[],
    /** Fade gain to START at (1 = audible now; 0 = fading in behind the old). */
    initialFade = 1
  ): ChainState => {
    const effects = inserts.map((node) => createEffect(node))
    const fade = new Tone.Gain(initialFade)
    let cursor: Tone.ToneAudioNode = head
    const headTarget: Tone.ToneAudioNode = effects[0]?.input ?? fade
    for (const fx of effects) {
      cursor.connect(fx.input)
      cursor = fx.output
    }
    cursor.connect(fade)
    fade.connect(tail)
    return { effects, sig: chainSig(inserts), fade, headTarget }
  }

  /**
   * Reconcile a chain in place. Structure unchanged ⇒ just update each effect's
   * params/enabled (fast path, no rebuild). Structure changed ⇒ MAKE-BEFORE-
   * BREAK: build the new chain in parallel off the same `head` (new fade @0),
   * equal-power crossfade old→new over CROSSFADE_SEC, then surgically tear the
   * old chain down. The audio path is never broken, so reordering — even moving
   * a disabled effect — no longer cuts the sound.
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

    // A restructure landed while THIS chain was still fading in: finalize that
    // in-flight teardown now (disposes the old-old chain + its fade — no leak,
    // no stuck-at-partial gain) before we layer a fresh fade on top.
    const inFlight = pendingFades.get(chain)
    if (inFlight) {
      clearTimeout(inFlight.timer)
      inFlight.finalize()
      pendingFades.delete(chain)
    }
    // The current chain may still be mid-ramp from a fade-IN; pin it audible so
    // the new crossfade starts from full level (no doubling, no dip).
    chain.fade.gain.cancelScheduledValues(when0())
    chain.fade.gain.setValueAtTime(1, when0())

    // Build the replacement in PARALLEL off the same head, fading in from 0.
    const next = buildChain(head, tail, inserts, 0)
    const finalizeFade = startCrossfade({
      head,
      tail,
      old: chain,
      next,
      now: when0(),
      disposeChain,
    })
    // Wrap so the registry entry is cleaned up whenever the fade completes
    // (naturally via the timer, or early via the in-flight path above).
    const finalize = () => {
      finalizeFade()
      pendingFades.delete(next)
    }
    const timer = setTimeout(finalize, CROSSFADE_SEC * 1000)
    pendingFades.set(next, { finalize, timer })
    return next
  }

  /** AudioContext clock helper (single read per reconcile pass). */
  const when0 = () => ctx.currentTime

  /** Fully retire a chain when its OWNER (track/bus) is torn down: finalize any
   *  in-flight fade INTO this chain (disposes the old-old chain it superseded),
   *  then dispose this chain's effects + its terminating fade gain. */
  const disposeChainFull = (chain: ChainState) => {
    const inFlight = pendingFades.get(chain)
    if (inFlight) {
      clearTimeout(inFlight.timer)
      inFlight.finalize() // idempotent; clears the registry entry
    }
    disposeChain(chain)
    chain.fade.dispose()
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
    disposeChainFull(n.chain)
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
    disposeChainFull(b.chain)
    b.input.dispose()
    b.gain.dispose()
  }

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  return {
    reconcile(prev, next) {
      currentDoc = next
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

    applyParam(target, value) {
      const when = ctx.currentTime
      const R = 0.02
      switch (target.scope) {
        case "master":
          masterVol.volume.setTargetAtTime(Tone.gainToDb(clamp(value, 0.0001, 1)), when, R)
          break
        case "track": {
          const n = nodes.get(target.trackId)
          if (!n) break
          if (target.param === "volume") n.gain.gain.setTargetAtTime(clamp(value, 0, 1), when, R)
          else n.panner.pan.setTargetAtTime(clamp(value, -1, 1), when, R)
          break
        }
        case "send": {
          const s = nodes.get(target.trackId)?.sends.get(target.sendId)
          if (s) s.gain.gain.setTargetAtTime(clamp(value, 0, 1), when, R)
          break
        }
        case "insert": {
          const n = nodes.get(target.trackId)
          const track = currentDoc?.tracks.find((t) => t.id === target.trackId)
          if (!n || !track) break
          const idx = track.inserts.findIndex((fx) => fx.id === target.insertId)
          if (idx >= 0) n.chain.effects[idx]?.setParam(target.param, value, when)
          break
        }
        case "bus": {
          const b = buses.get(target.busId)
          if (b && target.param === "volume") b.gain.gain.setTargetAtTime(clamp(value, 0, 1), when, R)
          break
        }
        case "instrument":
          nodes.get(target.trackId)?.instrument.setParam(target.param, value, when)
          break
      }
    },

    dispose() {
      for (const n of nodes.values()) disposeTrack(n)
      nodes.clear()
      for (const b of buses.values()) disposeBus(b)
      buses.clear()
      // Belt-and-suspenders: finalize any crossfade still in flight (disposeTrack/
      // disposeBus already retire each owned chain, but a fade timer must never
      // fire after dispose). Idempotent finalize + cleared timers ⇒ no leaks.
      for (const { finalize, timer } of [...pendingFades.values()]) {
        clearTimeout(timer)
        finalize()
      }
      pendingFades.clear()
      masterVol.dispose()
      limiter.dispose()
    },
  }
}
