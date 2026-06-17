/**
 * beatlounge — Hindustani: the 10 THAATS (Bhatkhande system).
 *
 * A thaat is a 7-note parent SCALE used to CLASSIFY ragas (it is not itself
 * performed; many ragas map to one thaat). All 10 are a 7-of-12 selection over
 * the shared 12-svara framework, so in v1 they are 12-TET degree sets — directly
 * analogous to Western modes, which gives correct *note choices* (90% of the
 * perceived value, 100% buildable now).
 *
 * Swaras: Sa Re Ga Ma Pa Dha Ni. Four take two variants:
 *   - Re/Ga/Dha/Ni: komal (flat, lowercase here) vs shuddh (natural).
 *   - Ma: shuddh vs tivra (sharp).
 *   Pa and Sa are immovable (achala).
 *
 * SHRUTI (optional alternate tuning): the older shruti system places the svaras
 * at just-intonation-ish ratios, NOT a 12-TET grid. Each svara below carries an
 * optional `shrutiCents` (the common 5-limit placement) so a future "authentic
 * intonation" toggle can swap it in with no migration. The DEFAULT remains
 * 12-TET. (Full 22-shruti micro-inflection + raga grammar is deferred.)
 */

import type { Mode, ModeDegree } from "./types"
import { CENTS_PER_SEMITONE, centsFromRatio } from "../tuning"

/**
 * The 12 svara positions: semitone offset, display label, and the common
 * just-intonation ("shruti") ratio + its cents. Komal/tivra spelled.
 *  - shuddh Re 9/8, komal re 16/15
 *  - shuddh Ga 5/4, komal ga 6/5
 *  - shuddh Ma 4/3, tivra Ma 45/32
 *  - shuddh Dha 5/3, komal dha 8/5
 *  - shuddh Ni 15/8, komal ni 9/5
 */
interface Svara {
  semi: number
  label: string
  ratio: readonly [number, number]
}

const SVARA: Record<string, Svara> = {
  Sa: { semi: 0, label: "Sa", ratio: [1, 1] },
  re: { semi: 1, label: "re (komal)", ratio: [16, 15] },
  Re: { semi: 2, label: "Re", ratio: [9, 8] },
  ga: { semi: 3, label: "ga (komal)", ratio: [6, 5] },
  Ga: { semi: 4, label: "Ga", ratio: [5, 4] },
  Ma: { semi: 5, label: "Ma", ratio: [4, 3] },
  MA: { semi: 6, label: "Ma (tivra)", ratio: [45, 32] },
  Pa: { semi: 7, label: "Pa", ratio: [3, 2] },
  dha: { semi: 8, label: "dha (komal)", ratio: [8, 5] },
  Dha: { semi: 9, label: "Dha", ratio: [5, 3] },
  ni: { semi: 10, label: "ni (komal)", ratio: [9, 5] },
  Ni: { semi: 11, label: "Ni", ratio: [15, 8] },
}

const degreeOf = (key: string): ModeDegree => {
  const s = SVARA[key]
  return {
    cents: s.semi * CENTS_PER_SEMITONE,
    label: s.label,
    // 12-TET is the default value; the ratio documents the shruti alternate.
    ratio: { num: s.ratio[0], den: s.ratio[1] },
  }
}

/** The shruti (just) cents for a thaat — the optional alternate tuning. */
export const thaatShrutiCents = (svaraKeys: readonly string[]): number[] =>
  svaraKeys.map((k) => {
    const [n, d] = SVARA[k].ratio
    return centsFromRatio(n, d)
  })

interface ThaatSpec {
  id: string
  name: string
  svaras: readonly string[]
  aliases?: string[]
  notes?: string
}

/** The 10 thaats by their komal/shuddh/tivra svara selection. */
const SPECS: ThaatSpec[] = [
  {
    id: "thaat.bilawal",
    name: "Bilawal",
    svaras: ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"], // all shuddh = major
    aliases: ["Bilaval"],
    notes: "All-natural (≈ major). Carnatic equivalent: Dheerashankarabharanam (29).",
  },
  {
    id: "thaat.khamaj",
    name: "Khamaj",
    svaras: ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "ni"], // komal Ni = mixolydian
    notes: "Shuddh except komal Ni (≈ Mixolydian).",
  },
  {
    id: "thaat.kafi",
    name: "Kafi",
    svaras: ["Sa", "Re", "ga", "Ma", "Pa", "Dha", "ni"], // komal Ga, ni = dorian
    notes: "Komal Ga + komal Ni (≈ Dorian).",
  },
  {
    id: "thaat.asavari",
    name: "Asavari",
    svaras: ["Sa", "Re", "ga", "Ma", "Pa", "dha", "ni"], // komal Ga, Dha, Ni = aeolian
    notes: "Komal Ga, Dha, Ni (≈ natural minor / Aeolian).",
  },
  {
    id: "thaat.bhairav",
    name: "Bhairav",
    svaras: ["Sa", "re", "Ga", "Ma", "Pa", "dha", "Ni"], // komal Re, Dha
    aliases: ["double harmonic"],
    notes: "Komal Re + komal Dha (≈ double-harmonic / Byzantine).",
  },
  {
    id: "thaat.bhairavi",
    name: "Bhairavi",
    svaras: ["Sa", "re", "ga", "Ma", "Pa", "dha", "ni"], // all komal movables = phrygian
    notes: "Komal Re, Ga, Dha, Ni (≈ Phrygian).",
  },
  {
    id: "thaat.todi",
    name: "Todi",
    svaras: ["Sa", "re", "ga", "MA", "Pa", "dha", "Ni"], // komal Re Ga Dha, tivra Ma
    notes: "Komal Re, Ga, Dha + tivra Ma.",
  },
  {
    id: "thaat.purvi",
    name: "Purvi",
    svaras: ["Sa", "re", "Ga", "MA", "Pa", "dha", "Ni"], // komal Re Dha, tivra Ma
    notes: "Komal Re, Dha + tivra Ma.",
  },
  {
    id: "thaat.marwa",
    name: "Marwa",
    svaras: ["Sa", "re", "Ga", "MA", "Pa", "Dha", "Ni"], // komal Re, tivra Ma (no Pa emphasis)
    notes: "Komal Re + tivra Ma, shuddh Dha/Ni.",
  },
  {
    id: "thaat.kalyan",
    name: "Kalyan",
    svaras: ["Sa", "Re", "Ga", "MA", "Pa", "Dha", "Ni"], // tivra Ma = lydian
    aliases: ["Yaman", "Kalyani"],
    notes: "Tivra Ma, else all shuddh (≈ Lydian). Carnatic: Mechakalyani (65).",
  },
]

export const THAATS: Mode[] = SPECS.map((s) => ({
  id: s.id,
  name: s.name,
  family: "thaat",
  degrees: s.svaras.map(degreeOf),
  aliases: s.aliases,
  notes: s.notes,
}))

/** Lookup the just/shruti-cents alternate tuning for a thaat id. */
export const THAAT_SHRUTI: Record<string, number[]> = Object.fromEntries(
  SPECS.map((s) => [s.id, thaatShrutiCents(s.svaras)])
)
