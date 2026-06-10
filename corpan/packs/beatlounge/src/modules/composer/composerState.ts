/**
 * beatlounge — composer module state + the pure "compose to the synth" bridge.
 *
 * Keeps the React view thin: this module owns the seed lifecycle (jam / re-roll
 * / evolve) and the single function that turns the current composer settings
 * into a `setNotes` (+ loop-size) command list for the bound synth track. It is
 * pure over (progression-or-template, key, mode, feel, density, seed) so it is
 * unit-testable without React and matches the deterministic-composer contract.
 */

import type { Command } from "../../model/command"
import type { Id } from "../../model/document"
import type { ScaleName } from "../../music/harmony"
import { parseNoteName, SCALE_NAMES } from "../../music/harmony"
import { parseProgression, renderProgression, type Progression } from "../../music/progression"
import { renderTemplate, TEMPLATE_NAMES } from "../../music/templates"
import { jam, progressionTicks, evolveSeed, type JamFeel } from "../../music/jam"

export const COMPOSER_KEYS = [
  "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B",
] as const
export type ComposerKey = (typeof COMPOSER_KEYS)[number]

export const COMPOSER_MODES: readonly ScaleName[] = SCALE_NAMES
export const COMPOSER_FEELS: readonly JamFeel[] = ["melody", "arp", "chords", "bass"]
export { TEMPLATE_NAMES }

export interface ComposerSettings {
  /** Raw progression notation (the power-user path). Empty ⇒ use `template`. */
  text: string
  /** Named template used when `text` is empty. */
  template: string
  key: ComposerKey
  mode: ScaleName
  feel: JamFeel
  density: number
  seed: number
}

export const defaultComposerSettings = (): ComposerSettings => ({
  text: "",
  template: "pop",
  key: "C",
  mode: "major",
  feel: "melody",
  density: 0.55,
  seed: 1,
})

/** Map a feel to a register (octave anchor) so each part sits where it belongs. */
export const registerForFeel = (feel: JamFeel): number =>
  feel === "bass" ? 48 : feel === "chords" ? 57 : 62

/** Resolve the key letter to a pitch class (default C). */
export const keyPc = (key: string): number => {
  const pc = parseNoteName(key)
  return pc == null ? 0 : pc
}

/**
 * Resolve the CURRENT progression from the settings: the typed notation if any
 * (and it parses to ≥1 chord), else the named template rendered in key/mode.
 * This is what both the readout and the composer read — one source of truth.
 */
export const resolveProgression = (s: ComposerSettings): Progression => {
  const typed = s.text.trim()
  if (typed) {
    const p = parseProgression(typed)
    if (p.chords.length > 0) return p
  }
  return renderTemplate(s.template, keyPc(s.key), s.mode)
}

/** A canonical notation string for the current settings (for the readout). */
export const progressionNotation = (s: ComposerSettings): string =>
  renderProgression(resolveProgression(s))

/**
 * Compose the current settings onto `trackId`: size the loop to the progression
 * and replace the track's notes with the generated jam. Pure + deterministic
 * for a given seed. Returns the commands the caller applies in one undo step.
 */
export const composeCommands = (
  s: ComposerSettings,
  trackId: Id
): { commands: Command[]; noteCount: number; chordCount: number } => {
  const prog = resolveProgression(s)
  if (prog.chords.length === 0) return { commands: [], noteCount: 0, chordCount: 0 }
  const notes = jam(prog, {
    feel: s.feel,
    density: s.density,
    register: registerForFeel(s.feel),
    seed: s.seed || 1,
    velocity: 0.72,
  })
  const loopTicks = progressionTicks(prog)
  return {
    commands: [
      { t: "setLoopLength", ticks: loopTicks },
      { t: "setNotes", trackId, notes },
    ],
    noteCount: notes.length,
    chordCount: prog.chords.length,
  }
}

/** A fresh random seed for "re-roll" (unrelated new material). */
export const rollSeed = (): number => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1

/** "Evolve" — a small related step from the current seed (varied but coherent). */
export const nextEvolveSeed = (seed: number): number => evolveSeed(seed)

/** True if `name` is a known template. */
export const isTemplate = (name: string): boolean => TEMPLATE_NAMES.includes(name)
