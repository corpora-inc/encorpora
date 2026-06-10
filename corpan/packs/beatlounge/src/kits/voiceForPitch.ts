/**
 * beatlounge — the MIDI-pitch → VoiceRole router.
 *
 * The drum instrument triggers voices by MIDI pitch (DRUM_PITCH + the drum-pads
 * PAD_BANK). The ORIGINAL drumKit.ts encoded this routing in a big `switch`;
 * here it is the single data table the parametric synth reads. Keeping it pure
 * + exported lets the picker audition "the snare voice of this kit" by role.
 *
 * This table reproduces the original triggerForPitch routing EXACTLY:
 *   36 kick · 38 snare · 37 rim · 39 clap · 42 closedHat · 44 pedalHat ·
 *   46 openHat · 43 loTom · 45 hiTom · 64 conga · 49 crash · 51 ride ·
 *   56 cowbell · 54 tamb · 70 shaker · 75 click(claves).
 * Any unknown pad falls back to a retuned tom (loTom recipe) so it is never
 * silent — matching the original `default` branch.
 */

import type { VoiceRole } from "./types"

/** MIDI pitch → voice role, for every pad the kit knows. */
export const PITCH_TO_ROLE: Readonly<Record<number, VoiceRole>> = {
  36: "kick",
  38: "snare",
  37: "rim",
  39: "clap",
  42: "closedHat",
  44: "pedalHat",
  46: "openHat",
  43: "loTom",
  45: "hiTom",
  64: "conga",
  49: "crash",
  51: "ride",
  56: "cowbell",
  54: "tamb",
  70: "shaker",
  75: "click",
}

/** Role → the canonical MIDI pitch that triggers it (first match). */
export const ROLE_TO_PITCH: Readonly<Record<VoiceRole, number>> = (() => {
  const out: Partial<Record<VoiceRole, number>> = {}
  for (const [pitch, role] of Object.entries(PITCH_TO_ROLE)) {
    if (out[role] === undefined) out[role] = Number(pitch)
  }
  return out as Record<VoiceRole, number>
})()

/** Resolve a MIDI pitch to its voice role (undefined ⇒ unknown pad). */
export const roleForPitch = (pitch: number): VoiceRole | undefined =>
  PITCH_TO_ROLE[pitch]
