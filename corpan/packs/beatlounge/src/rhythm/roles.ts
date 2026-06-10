/**
 * beatlounge — percussion ROLE → kit pitch mapping.
 *
 * The corpus authors lanes by musical ROLE ("clave", "conga-lo", "surdo"…),
 * but the drum-kit instrument (instruments/drumKit.ts) only synthesises a
 * fixed set of voices addressed by MIDI pitch. This module is the single
 * adapter between the two: it maps every role the corpus uses to the NEAREST
 * available kit pitch, so a rhythm always makes a sound even though the synth
 * kit is smaller than the world's percussion.
 *
 * AVAILABLE KIT VOICES (from drumKit.ts triggerForPitch + DRUM_PITCH + PAD_BANK):
 *   36 kick · 38 snare · 37 rim/sidestick · 39 clap · 42 closed-hat ·
 *   44 pedal-hat · 46 open-hat · 43 lo-tom · 45 hi-tom · 64 conga ·
 *   49 crash · 51 ride · 56 cowbell · 54 tambourine · 70 shaker · 75 claves.
 *
 * Where a role has no dedicated voice (e.g. a high bongo, an agogo bell, a
 * timbale, a surdo), it maps to the closest timbral match and is flagged
 * `approx` so the picker can footnote it and a future sample kit can refine it.
 */

import { DRUM_PITCH } from "../model/document"
import type { Role } from "./types"

/** A kit-voice MIDI pitch the drum synth knows how to trigger. */
export type KitPitch = number

export interface RoleMapping {
  /** The kit pitch this role triggers. */
  pitch: KitPitch
  /** True ⇒ the kit has no dedicated voice; this is the nearest substitute. */
  approx?: boolean
  /** Why this substitution (shown as a footnote when approx). */
  note?: string
}

// Convenience kit-pitch constants (named so the table reads clearly).
const KIT = {
  kick: DRUM_PITCH.kick, // 36
  snare: DRUM_PITCH.snare, // 38
  rim: 37,
  clap: DRUM_PITCH.clap, // 39
  closedHat: DRUM_PITCH.hat, // 42
  pedalHat: 44,
  openHat: 46,
  loTom: 43,
  hiTom: 45,
  conga: 64,
  crash: 49,
  ride: 51,
  cowbell: 56,
  tamb: 54,
  shaker: 70,
  claves: 75,
} as const

/**
 * THE ROLE TABLE. Every role the corpus uses appears here exactly once.
 * Direct voices have no `approx`; substitutions carry `approx + note`.
 */
export const ROLE_MAP: Record<string, RoleMapping> = {
  // ---- drum-kit core (direct) ----
  kick: { pitch: KIT.kick },
  snare: { pitch: KIT.snare },
  "snare-ghost": { pitch: KIT.snare, approx: true, note: "ghost snare → snare voice (softer velocity)" },
  rim: { pitch: KIT.rim },
  sidestick: { pitch: KIT.rim, approx: true, note: "sidestick → rim voice" },
  clap: { pitch: KIT.clap },
  "closed-hat": { pitch: KIT.closedHat },
  "pedal-hat": { pitch: KIT.pedalHat },
  "open-hat": { pitch: KIT.openHat },
  ride: { pitch: KIT.ride },
  "ride-bell": { pitch: KIT.ride, approx: true, note: "ride bell → ride voice" },
  crash: { pitch: KIT.crash },
  "lo-tom": { pitch: KIT.loTom },
  "mid-tom": { pitch: KIT.loTom, approx: true, note: "mid tom → lo-tom voice (between toms)" },
  "hi-tom": { pitch: KIT.hiTom },

  // ---- hand drums (conga family is the kit's one membrane voice) ----
  "conga-hi": { pitch: KIT.conga, approx: true, note: "high conga → conga voice (single tom membrane)" },
  "conga-lo": { pitch: KIT.loTom, approx: true, note: "low conga → lo-tom (darker membrane)" },
  conga: { pitch: KIT.conga },
  "conga-slap": { pitch: KIT.rim, approx: true, note: "conga slap → rim click (sharp transient)" },
  "bongo-hi": { pitch: KIT.hiTom, approx: true, note: "high bongo → hi-tom voice" },
  "bongo-lo": { pitch: KIT.conga, approx: true, note: "low bongo → conga voice" },
  djembe: { pitch: KIT.loTom, approx: true, note: "djembe → lo-tom membrane" },
  "djembe-slap": { pitch: KIT.rim, approx: true, note: "djembe slap → rim click" },
  tabla: { pitch: KIT.hiTom, approx: true, note: "tabla (dayan) → hi-tom" },
  "tabla-bass": { pitch: KIT.loTom, approx: true, note: "tabla (bayan) → lo-tom" },
  doumbek: { pitch: KIT.loTom, approx: true, note: "doumbek 'dum' → lo-tom membrane" },
  "doumbek-tek": { pitch: KIT.hiTom, approx: true, note: "doumbek 'tek' → hi-tom" },
  darbuka: { pitch: KIT.loTom, approx: true, note: "darbuka → lo-tom membrane" },

  // ---- Brazilian / surdo family ----
  surdo: { pitch: KIT.kick, approx: true, note: "surdo (deep) → kick voice" },
  "surdo-hi": { pitch: KIT.loTom, approx: true, note: "surdo (open) → lo-tom" },
  repinique: { pitch: KIT.hiTom, approx: true, note: "repinique → hi-tom" },
  caixa: { pitch: KIT.snare, approx: true, note: "caixa (Brazilian snare) → snare" },
  tamborim: { pitch: KIT.rim, approx: true, note: "tamborim → rim click" },
  cuica: { pitch: KIT.conga, approx: true, note: "cuíca → conga voice (pitched membrane)" },

  // ---- bells / shakers / metals ----
  cowbell: { pitch: KIT.cowbell },
  "cowbell-hi": { pitch: KIT.cowbell, approx: true, note: "high cowbell → cowbell voice" },
  agogo: { pitch: KIT.cowbell, approx: true, note: "agogô bell → cowbell voice" },
  "agogo-lo": { pitch: KIT.cowbell, approx: true, note: "low agogô → cowbell voice" },
  guira: { pitch: KIT.shaker, approx: true, note: "güira scraper → shaker voice" },
  guiro: { pitch: KIT.shaker, approx: true, note: "güiro scraper → shaker voice" },
  cabasa: { pitch: KIT.shaker, approx: true, note: "cabasa → shaker voice" },
  shaker: { pitch: KIT.shaker },
  shekere: { pitch: KIT.shaker, approx: true, note: "shekere → shaker voice" },
  ganza: { pitch: KIT.shaker, approx: true, note: "ganzá → shaker voice" },
  maracas: { pitch: KIT.shaker, approx: true, note: "maracas → shaker voice" },
  tambourine: { pitch: KIT.tamb },
  pandeiro: { pitch: KIT.tamb, approx: true, note: "pandeiro → tambourine voice" },
  riq: { pitch: KIT.tamb, approx: true, note: "riq → tambourine voice" },
  triangle: { pitch: KIT.tamb, approx: true, note: "triangle → tambourine (bright metal)" },
  woodblock: { pitch: KIT.rim, approx: true, note: "woodblock → rim click" },
  cua: { pitch: KIT.rim, approx: true, note: "cuá (bomba shell) → rim click" },
  clave: { pitch: KIT.claves },
  claves: { pitch: KIT.claves },
  timbale: { pitch: KIT.hiTom, approx: true, note: "timbale → hi-tom" },
  "timbale-lo": { pitch: KIT.loTom, approx: true, note: "low timbale → lo-tom" },
  cascara: { pitch: KIT.rim, approx: true, note: "cáscara (timbale shell) → rim click" },
  castanets: { pitch: KIT.rim, approx: true, note: "castanets → rim click" },
  palmas: { pitch: KIT.clap, approx: true, note: "flamenco palmas (claps) → clap voice" },
}

/** The set of distinct kit pitches the kit actually voices (for tests/coverage). */
export const KIT_PITCHES: ReadonlySet<number> = new Set(Object.values(KIT))

/** Resolve a role to its kit pitch; unknown roles fall back to a tom so a hit is
 *  never silent (noisy-not-silent: we warn so the corpus can add the role). */
export const resolveRole = (role: Role): RoleMapping => {
  const m = ROLE_MAP[role]
  if (m) return m
  console.warn(
    `[beatlounge/rhythm] unknown role "${role}" — mapping to lo-tom; add it to roles.ts ROLE_MAP`
  )
  return { pitch: KIT.loTom, approx: true, note: `unknown role "${role}" → lo-tom` }
}

/** Just the pitch (the hot path the engine calls per hit). */
export const pitchForRole = (role: Role): KitPitch => resolveRole(role).pitch
