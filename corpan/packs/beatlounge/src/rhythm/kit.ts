/**
 * beatlounge — THE FULL KIT, as the drum GENERATOR sees it (role-keyed).
 *
 * The probabilistic beat generator (./generator) spreads a groove over EVERY
 * drum row, not just a groove's two or three signature lanes. "Every drum row"
 * is exactly the set of editable lanes the step-grid renders (step-grid/gridModel
 * `DRUM_LANES`) — kick, snare, rim, clap, the three hats, ride, crash, two toms,
 * conga, cowbell, tamb, shaker, claves. We re-declare that set HERE in pure
 * rhythm-space (role-keyed + pitch) so:
 *
 *   • the generator's per-row weight model (./archetypes, ./weights) attaches to
 *     a stable, ordered list of roles — one weight row per kit voice; and
 *   • this module has NO dependency on the React grid, so the generator stays
 *     pure + unit-testable.
 *
 * KIT_ROLES is the canonical ordered kit. `kitPitches()` is the pitch list the
 * generator scatters across when nothing is selected ("all rows"). A test asserts
 * it stays in lock-step with the grid's DRUM_LANES so a generated hit is never on
 * an invisible row.
 */

import { DRUM_PITCH } from "../model/document"

/** A "family" coarse-grains roles so an archetype + the groove signature can be
 *  assigned per voice without a giant per-role table. */
export type KitFamily =
  | "kick"
  | "snare"
  | "rim"
  | "clap"
  | "hat-closed"
  | "hat-pedal"
  | "hat-open"
  | "ride"
  | "crash"
  | "tom"
  | "conga"
  | "cowbell"
  | "tamb"
  | "shaker"
  | "claves"

/** One canonical kit row: a stable id, its kit pitch, and its archetype family. */
export interface KitRole {
  /** Stable role id (matches the step-grid label intent). */
  id: string
  /** Human label (mirrors DRUM_LANES). */
  label: string
  /** The kit-voice MIDI pitch this row triggers. */
  pitch: number
  /** Which metric archetype + signature mapping this row uses. */
  family: KitFamily
}

/**
 * THE CANONICAL KIT — top→bottom, the SAME pitches + order the step-grid shows
 * (DRUM_LANES). The generator walks this list as its "all rows" when no row is
 * selected, so every press spreads across the WHOLE kit.
 */
export const KIT_ROLES: readonly KitRole[] = [
  { id: "kick", label: "Kick", pitch: DRUM_PITCH.kick, family: "kick" }, // 36
  { id: "snare", label: "Snare", pitch: DRUM_PITCH.snare, family: "snare" }, // 38
  { id: "rim", label: "Rim", pitch: 37, family: "rim" },
  { id: "clap", label: "Clap", pitch: DRUM_PITCH.clap, family: "clap" }, // 39
  { id: "closed-hat", label: "Closed Hat", pitch: DRUM_PITCH.hat, family: "hat-closed" }, // 42
  { id: "pedal-hat", label: "Pedal Hat", pitch: 44, family: "hat-pedal" },
  { id: "open-hat", label: "Open Hat", pitch: 46, family: "hat-open" },
  { id: "ride", label: "Ride", pitch: 51, family: "ride" },
  { id: "crash", label: "Crash", pitch: 49, family: "crash" },
  { id: "hi-tom", label: "Hi Tom", pitch: 45, family: "tom" },
  { id: "lo-tom", label: "Lo Tom", pitch: 43, family: "tom" },
  { id: "conga", label: "Conga", pitch: 64, family: "conga" },
  { id: "cowbell", label: "Cowbell", pitch: 56, family: "cowbell" },
  { id: "tamb", label: "Tamb", pitch: 54, family: "tamb" },
  { id: "shaker", label: "Shaker", pitch: 70, family: "shaker" },
  { id: "claves", label: "Claves", pitch: 75, family: "claves" },
] as const

/** The kit pitches in canonical order (the generator's "all rows"). */
export const kitPitches = (): number[] => KIT_ROLES.map((r) => r.pitch)

/** Map a kit pitch → its KitRole (for routing the groove signature onto a row). */
export const ROLE_BY_PITCH: ReadonlyMap<number, KitRole> = new Map(
  KIT_ROLES.map((r) => [r.pitch, r])
)
