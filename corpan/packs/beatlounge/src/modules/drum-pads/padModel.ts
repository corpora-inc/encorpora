/**
 * beatlounge — derive the drum-pad bank from a drumSampler InstrumentTrack.
 *
 * A pad bank is a fixed set of lanes (one MIDI pitch each), laid out as a 4×4
 * grid (or 4×2 on a narrow phone). The first lanes are the canonical kit
 * (kick / snare / hat / clap from DRUM_PITCH); the rest are extra GM-ish pads
 * so there's room to grow. Each pad reports its hit count + whether it fires on
 * the current step (for the playhead glow) — all pure, so layout + the
 * step-record decision are unit-testable.
 */

import type { BeatloungeDoc, InstrumentTrack, Midi } from "../../model/document"
import { DRUM_PITCH } from "../../model/document"
import { stepsInLoop, tickForStep } from "../../model/timing"

export interface PadDef {
  pitch: Midi
  label: string
}

/**
 * The 16-pad bank. First four are the kit from DRUM_PITCH; the remainder are
 * extra GM-ish percussion so the bank has headroom. Order = left→right,
 * top→bottom (row-major), bottom row is the canonical kit on a 4×4.
 */
export const PAD_BANK: PadDef[] = [
  { pitch: 49, label: "Crash" },
  { pitch: 51, label: "Ride" },
  { pitch: 43, label: "Lo Tom" },
  { pitch: 45, label: "Hi Tom" },
  { pitch: 46, label: "Open Hat" },
  { pitch: 44, label: "Pedal Hat" },
  { pitch: 37, label: "Rim" },
  { pitch: 56, label: "Cowbell" },
  { pitch: 54, label: "Tamb" },
  { pitch: 70, label: "Shaker" },
  { pitch: 75, label: "Claves" },
  { pitch: 64, label: "Conga" },
  { pitch: DRUM_PITCH.kick, label: "Kick" },
  { pitch: DRUM_PITCH.snare, label: "Snare" },
  { pitch: DRUM_PITCH.hat, label: "Hat" },
  { pitch: DRUM_PITCH.clap, label: "Clap" },
] as const

export interface PadState extends PadDef {
  /** Hits this pad has in the loop. */
  count: number
  /** True ⇒ this pad has a hit on the live playhead step (glow). */
  liveHit: boolean
}

export interface PadView {
  pads: PadState[]
  steps: number
}

/**
 * Build the pad states for the current doc. `playStep` (-1 when stopped) lights
 * pads whose lane has a hit on that step.
 */
export const buildPadView = (
  doc: BeatloungeDoc,
  track: InstrumentTrack,
  playStep = -1
): PadView => {
  const steps = stepsInLoop(doc.loopLengthTicks, track.grid)
  const liveTick = playStep >= 0 ? tickForStep(playStep, track.grid) : -1

  const counts = new Map<number, number>()
  const liveHits = new Set<number>()
  for (const n of track.notes) {
    counts.set(n.pitch, (counts.get(n.pitch) ?? 0) + 1)
    if (liveTick >= 0 && n.tick === liveTick) liveHits.add(n.pitch)
  }

  const pads: PadState[] = PAD_BANK.map((p) => ({
    ...p,
    count: counts.get(p.pitch) ?? 0,
    liveHit: liveHits.has(p.pitch),
  }))

  return { pads, steps }
}

/**
 * The number of pads shown for a form factor. Phone shows a 4×2 (8) bank so the
 * hit targets stay comfortable; tablet/desktop show the full 4×4 (16).
 */
export const visiblePadCount = (form: "phone" | "tablet" | "desktop"): number =>
  form === "phone" ? 8 : 16

/**
 * Step-record placement: when recording, a pad tap writes a hit at the step the
 * playhead is on (or step 0 when stopped). Returns the step to toggle, clamped
 * into the loop. Pure so the record decision is testable without the engine.
 */
export const recordStep = (playStep: number, steps: number): number => {
  if (steps <= 0) return 0
  if (playStep < 0) return 0
  return ((playStep % steps) + steps) % steps
}
