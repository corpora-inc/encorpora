/**
 * beatlounge — SoundFont (SF2/SF3) instrument, backed by spessasynth.
 *
 * spessasynth_lib runs a full General-MIDI / SF2 synthesizer inside an
 * AudioWorklet. We:
 *   1. register the DSP processor module on the raw AudioContext (once),
 *   2. spin up a `WorkletSynthesizer`,
 *   3. load the SF2/SF3 bytes resolved from the `AssetLoader` (the soundfont is
 *      a DOWNLOADABLE asset, never bundled in git — see SOUNDFONTS.md),
 *   4. select the GM program/bank from the config,
 *   5. play notes by scheduling `noteOn`/`noteOff` relative to the AudioContext
 *      clock (the worklet API is real-time, so we wait until `when`).
 *
 * The worklet output node is wrapped behind a `Tone.Gain` so it satisfies the
 * frozen `Instrument` interface and plugs into the same insert chain.
 *
 * FALLBACK: if the worklet/synth can't initialize (no soundfont asset yet, or
 * AudioWorklet unavailable) we keep an audible `Tone.Sampler`-free synth voice
 * so a track is never silent and the rest of the changeset is unblocked.
 */

import * as Tone from "tone"
import { WorkletSynthesizer } from "spessasynth_lib"
// Vite emits the worklet processor as a hashed asset and gives us its URL.
import processorUrl from "spessasynth_lib/dist/spessasynth_processor.min.js?url"
import type { AssetLoader, Instrument, TriggerNote } from "../contracts/engine"
import type { Id, InstrumentConfig, Midi } from "../model/document"

type SoundfontConfig = Extract<InstrumentConfig, { kind: "soundfont" }>
const isSoundfont = (c: InstrumentConfig): c is SoundfontConfig =>
  c.kind === "soundfont"

/** GM-percussion lives on channel 9; we use a single non-drum channel. */
const CHANNEL = 0
const MIDI_FULL_VELOCITY = 127

/** Per-AudioContext guard so the worklet module is only registered once. */
const REGISTERED = new WeakSet<BaseAudioContext>()

const ensureProcessor = async (ctx: BaseAudioContext): Promise<void> => {
  if (REGISTERED.has(ctx)) return
  if (!ctx.audioWorklet) throw new Error("AudioWorklet unavailable")
  await ctx.audioWorklet.addModule(processorUrl)
  REGISTERED.add(ctx)
}

export const createSoundfontInstrument = (config: SoundfontConfig): Instrument => {
  const out = new Tone.Gain(1)

  // Fallback voice (used until/if the soundfont synth is live). Triangle poly
  // so a GM track still makes a reasonable sound with no asset present.
  const fallback = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 },
  }).connect(out)
  fallback.maxPolyphony = 16

  let synth: WorkletSynthesizer | null = null
  let soundfontId: Id = config.soundfontId
  let program = config.program
  let bank = config.bank
  // Scheduled note-offs (worklet API is real-time, not sample-scheduled).
  const pending = new Set<ReturnType<typeof setTimeout>>()

  const rawCtx = (): BaseAudioContext =>
    Tone.getContext().rawContext as unknown as BaseAudioContext

  const applyProgram = () => {
    if (!synth) return
    // bank select (CC0) then program change.
    try {
      synth.controllerChange(CHANNEL, 0, bank & 0x7f)
    } catch {
      /* some banks aren't addressable; program change still applies */
    }
    synth.programChange(CHANNEL, program & 0x7f)
  }

  const initSynth = async (assets: AssetLoader): Promise<void> => {
    const ctx = rawCtx()
    let bytes: ArrayBuffer
    try {
      bytes = await assets.resolve({ soundfontId })
    } catch (err) {
      console.warn(
        `[beatlounge] soundfont: no asset for soundfontId=${soundfontId}; using fallback synth`,
        err
      )
      return
    }
    if (!bytes || bytes.byteLength === 0) {
      console.warn(
        `[beatlounge] soundfont: empty asset for soundfontId=${soundfontId}; using fallback synth`
      )
      return
    }
    try {
      await ensureProcessor(ctx)
      const s = new WorkletSynthesizer(ctx)
      await s.isReady
      await s.soundBankManager.addSoundBank(bytes, "main")
      s.connect(out as unknown as AudioNode)
      synth = s
      applyProgram()
      // Silence the placeholder now that the real engine is live.
      fallback.disconnect()
    } catch (err) {
      console.warn(
        "[beatlounge] soundfont: spessasynth init failed; using fallback synth",
        err
      )
      synth = null
    }
  }

  const triggerFallback = (note: TriggerNote, when: number) => {
    const name = Tone.Frequency(note.pitch, "midi").toNote()
    try {
      fallback.triggerAttackRelease(name, Math.max(0.05, note.durationSec), when, note.velocity)
    } catch {
      /* ignore voice exhaustion */
    }
  }

  const scheduleNote = (pitch: Midi, velocity: number, when: number, durationSec: number) => {
    if (!synth) return
    const ctx = rawCtx()
    const delayMs = Math.max(0, (when - ctx.currentTime) * 1000)
    const vel = Math.round(Math.min(1, Math.max(0, velocity)) * MIDI_FULL_VELOCITY)
    const onId = setTimeout(() => {
      pending.delete(onId)
      synth?.noteOn(CHANNEL, pitch & 0x7f, vel)
      const offId = setTimeout(() => {
        pending.delete(offId)
        synth?.noteOff(CHANNEL, pitch & 0x7f)
      }, Math.max(20, durationSec * 1000))
      pending.add(offId)
    }, delayMs)
    pending.add(onId)
  }

  return {
    output: out,
    trigger(note: TriggerNote, when: number) {
      if (synth) scheduleNote(note.pitch, note.velocity, when, Math.max(0.05, note.durationSec))
      else triggerFallback(note, when)
    },
    update(next: InstrumentConfig) {
      if (!isSoundfont(next)) return
      const sfChanged = next.soundfontId !== soundfontId
      soundfontId = next.soundfontId
      program = next.program
      bank = next.bank
      if (!sfChanged) applyProgram()
      // A soundfont swap requires a fresh load() pass (driven by audioGraph).
    },
    setParam(param: string, value: number) {
      if (!synth) return
      // Map a couple of common targets to MIDI CC for live automation.
      const cc =
        param === "cutoff"
          ? 74 // brightness
          : param === "resonance"
            ? 71
            : param === "expression"
              ? 11
              : -1
      if (cc >= 0) {
        const v = Math.round(Math.min(1, Math.max(0, value)) * MIDI_FULL_VELOCITY)
        try {
          // cc is a valid MIDI CC number; the lib types it as a MIDIController union.
          synth.controllerChange(CHANNEL, cc as Parameters<typeof synth.controllerChange>[1], v)
        } catch {
          /* CC not supported on this bank; ignore */
        }
      }
    },
    async load(assets: AssetLoader) {
      await initSynth(assets)
    },
    dispose() {
      for (const id of pending) clearTimeout(id)
      pending.clear()
      if (synth) {
        try {
          synth.stopAll(true)
          synth.disconnect()
          synth.destroy()
        } catch {
          /* best-effort teardown */
        }
        synth = null
      }
      fallback.dispose()
      out.dispose()
    },
  }
}
