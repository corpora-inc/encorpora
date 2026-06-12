/**
 * beatlounge — Carnatic: the 72 MELAKARTA ragas (Katapayadi / Bhatkhande
 * exhaustive enumeration), derived programmatically. 12-TET cents.
 *
 * A melakarta is a complete PARENT raga (it can be performed; many janya ragas
 * derive from each). The 72 are a complete COMBINATORIAL system over the 12
 * svara-sthanas:
 *
 *   - Sa (Ṣ) and Pa (P) are fixed.
 *   - The lower tetrachord (Ri, Ga) chooses one of 6 ordered (Ri,Ga) pairs.
 *   - The upper tetrachord (Dha, Ni) chooses one of 6 ordered (Dha,Ni) pairs.
 *   - Ma is shuddha (M1, P4 = 5 semitones) for melas 1–36, prati (M2, A4 = 6)
 *     for melas 37–72.
 *
 * The 6 lower combinations (the "chakra position", 1..6 within a chakra) over
 * the svara positions:
 *   Ri/Ga semitone pairs: (1,2) (1,3) (1,4) (2,3) (2,4) (3,4)
 *     i.e. Ri ∈ {R1=1, R2=2, R3=3}, Ga ∈ {G1=2, G2=3, G3=4} with Ri < Ga and
 *     no overlap conflict — encoded as the 6 valid ordered pairs below.
 *   Dha/Ni semitone pairs: (8,9) (8,10) (8,11) (9,10) (9,11) (10,11)
 *     i.e. Dha ∈ {D1=8, D2=9, D3=10}, Ni ∈ {N1=9, N2=10, N3=11}.
 *
 * Mela number → (Ma half, lower index 0..5, upper index 0..5):
 *   n in 1..72; half = n≤36 ? shuddhaMa : pratiMa
 *   within each half (m = ((n-1) mod 36)):  lower = floor(m/6), upper = m mod 6
 *
 * This reproduces the canonical scale of every mela (e.g. 8 Hanumatodi = Todi
 * thaat, 15 Mayamalavagowla, 22 Kharaharapriya = Dorian/Kafi, 29
 * Dheerashankarabharanam = major/Bilawal, 65 Mechakalyani = Lydian/Kalyan).
 * Names are the standard Asampurna→Sampurna catalog (Govindacharya scheme).
 */

import type { Mode, ModeDegree } from "./types"
import { CENTS_PER_SEMITONE } from "../tuning"

/** The 6 (Ri, Ga) semitone pairs, in chakra order 0..5. */
const LOWER: ReadonlyArray<readonly [number, number]> = [
  [1, 2], // R1 G1
  [1, 3], // R1 G2
  [1, 4], // R1 G3
  [2, 3], // R2 G2
  [2, 4], // R2 G3
  [3, 4], // R3 G3
]
/** Svara name pairs for the lower tetrachord (Ri label, Ga label). */
const LOWER_LABEL: ReadonlyArray<readonly [string, string]> = [
  ["R1", "G1"],
  ["R1", "G2"],
  ["R1", "G3"],
  ["R2", "G2"],
  ["R2", "G3"],
  ["R3", "G3"],
]

/** The 6 (Dha, Ni) semitone pairs, in chakra order 0..5. */
const UPPER: ReadonlyArray<readonly [number, number]> = [
  [8, 9], // D1 N1
  [8, 10], // D1 N2
  [8, 11], // D1 N3
  [9, 10], // D2 N2
  [9, 11], // D2 N3
  [10, 11], // D3 N3
]
const UPPER_LABEL: ReadonlyArray<readonly [string, string]> = [
  ["D1", "N1"],
  ["D1", "N2"],
  ["D1", "N3"],
  ["D2", "N2"],
  ["D2", "N3"],
  ["D3", "N3"],
]

/** The 72 canonical melakarta names, index 0 = mela 1 … index 71 = mela 72. */
const MELA_NAMES: readonly string[] = [
  // chakra Indu (1-6)
  "Kanakangi", "Ratnangi", "Ganamurti", "Vanaspati", "Manavati", "Tanarupi",
  // Netra (7-12)
  "Senavati", "Hanumatodi", "Dhenuka", "Natakapriya", "Kokilapriya", "Rupavati",
  // Agni (13-18)
  "Gayakapriya", "Vakulabharanam", "Mayamalavagowla", "Chakravakam", "Suryakantam", "Hatakambari",
  // Veda (19-24)
  "Jhankaradhwani", "Natabhairavi", "Keeravani", "Kharaharapriya", "Gourimanohari", "Varunapriya",
  // Bana (25-30)
  "Mararanjani", "Charukesi", "Sarasangi", "Harikambhoji", "Dheerashankarabharanam", "Naganandini",
  // Rutu (31-36)
  "Yagapriya", "Ragavardhini", "Gangeyabhushani", "Vagadheeswari", "Shulini", "Chalanata",
  // Rishi (37-42)
  "Salagam", "Jalarnavam", "Jhalavarali", "Navaneetam", "Pavani", "Raghupriya",
  // Vasu (43-48)
  "Gavambhodi", "Bhavapriya", "Shubhapantuvarali", "Shadvidhamargini", "Suvarnangi", "Divyamani",
  // Brahma (49-54)
  "Dhavalambari", "Namanarayani", "Kamavardhini", "Ramapriya", "Gamanashrama", "Vishwambari",
  // Disi (55-60)
  "Shamalangi", "Shanmukhapriya", "Simhendramadhyamam", "Hemavati", "Dharmavati", "Neetimati",
  // Rudra (61-66)
  "Kantamani", "Rishabhapriya", "Latangi", "Vachaspati", "Mechakalyani", "Chitrambari",
  // Aditya (67-72)
  "Sucharitra", "Jyotiswarupini", "Dhatuvardhani", "Nasikabhushani", "Kosalam", "Rasikapriya",
]

/** Build mela n (1..72) as a Mode. */
export const buildMelakarta = (n: number): Mode => {
  if (n < 1 || n > 72 || !Number.isInteger(n)) {
    throw new Error(`melakarta: number must be an integer 1..72, got ${n}`)
  }
  const pratiMa = n > 36
  const m = (n - 1) % 36
  const lowerIdx = Math.floor(m / 6)
  const upperIdx = m % 6
  const [ri, ga] = LOWER[lowerIdx]
  const [dha, ni] = UPPER[upperIdx]
  const maSemi = pratiMa ? 6 : 5
  const maLabel = pratiMa ? "M2" : "M1"
  const [riL, gaL] = LOWER_LABEL[lowerIdx]
  const [dhaL, niL] = UPPER_LABEL[upperIdx]

  const semis: Array<[number, string]> = [
    [0, "S"],
    [ri, riL],
    [ga, gaL],
    [maSemi, maLabel],
    [7, "P"],
    [dha, dhaL],
    [ni, niL],
  ]
  const degrees: ModeDegree[] = semis.map(([s, label]) => ({
    cents: s * CENTS_PER_SEMITONE,
    label,
  }))
  return {
    id: `melakarta.${n}`,
    name: MELA_NAMES[n - 1],
    family: "melakarta",
    melakartaNumber: n,
    degrees,
    notes: `Mela ${n} · ${pratiMa ? "Prati" : "Shuddha"} Madhyama · Sa ${riL} ${gaL} ${maLabel} Pa ${dhaL} ${niL}`,
  }
}

/** All 72 melakartas, mela 1..72. */
export const MELAKARTAS: Mode[] = Array.from({ length: 72 }, (_, i) =>
  buildMelakarta(i + 1)
)
