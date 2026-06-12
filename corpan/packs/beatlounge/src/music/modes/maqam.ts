/**
 * beatlounge — Arabic MAQAM (researched, principled, NON-12-TET cents).
 *
 * A maqam is built from AJNAS (sing. jins): 3–5-note melodic cells stacked,
 * usually a lower jins + an upper jins sharing or adjoining a pivot. The defining
 * feature is NEUTRAL ("half-flat" / three-quarter-tone) intervals that sit
 * BETWEEN the Western chromatic pitches. The founder explicitly REJECTED a
 * blanket 24-TET (50¢-grid) approximation — every neutral degree here is given a
 * researched, principled cents value with the alternative recorded.
 *
 * ── Tuning approach (authoritative for this corpus) ────────────────────────
 * For the neutral (three-quarter-tone) degrees we adopt the JUST/ratio-derived
 * values documented by microtonaltheory.com's "Just Tuning of Arabic Ajnas",
 * cross-checked against Wikipedia (Arabic maqam / Jins) and the Ableton
 * "Arabic Maqam" tuning presets. These are CLOSER to actual Arab practice than
 * the pan-Arab pedagogical 24-TET grid:
 *
 *   - Jins RAST neutral 3rd  = 355¢  (≈ 9/8 then 12/11 step; cf. 27/22 ≈ 355¢).
 *       Alternatives in the literature: Syrian ~347¢ (Ableton Rast 3), 24-TET
 *       grid 350¢, Egyptian/medium-high ~360–366¢, 11/9 ≈ 347¢. Range 342–366¢.
 *   - Jins BAYATI neutral 2nd = 150¢ (≈ 12/11 = 150.6¢). The Bayati E½b sits a
 *       touch LOWER than Rast's; sources give 139–151¢. We use 150¢ (12/11).
 *   - Jins SIKAH tonic-relative neutral 3rd = 355¢ (Sikah is itself rooted on a
 *       half-flat; Abu Shumays catalogs 12 E½b positions — 27/22 ≈ 355¢ adopted).
 *   - Jins SABA: 0, 150 (neutral 2nd 12/11), 294 (m3, ~32/27=294¢ Pythagorean
 *       minor third), 590 (the diminished 4th, ~7/5≈583 / commonly ~590¢ in
 *       practice — Saba's "narrower than a 4th" signature). We use 590¢.
 *
 * The 12-TET-derived degrees (whole tones, the perfect 4th/5th, Hijaz's
 * augmented 2nd) keep their standard cents so chords/Western pivots still align;
 * only the genuinely neutral degrees carry non-100 cents. Because the whole
 * corpus is exact cents, swapping in a regional preset (Egyptian/Syrian/Turkish)
 * later is a data change with ZERO migration.
 *
 * Sources (inline):
 *   - microtonaltheory.com — Just Tuning of Arabic Ajnas / Makams & Maqamat
 *     (Rast 0,204,355,498; Bayati 0,139,267,498; Hijaz 0,128,386,498;
 *      Nahawand 0,204,408,498; Kurd 0,90,408,498; Ajam 0,204,408,498).
 *   - tuning.ableton.com/arabic-maqam — Rast E½b presets 342–356¢; "tuning is
 *     contextual" caveat.
 *   - en.wikipedia.org/wiki/Arabic_maqam, /wiki/Jins — jins inventory + which
 *     degrees are half-flat; 72 heptatonic tone-rows; E½b/B½b most common.
 *   - ethnicmusical.com maqam guide — Rast 1-¾-¾-1, Bayati ¾-¾-1-1 patterns.
 */

import type { Jins, Mode, ModeDegree } from "./types"

// ─────────────────────────────────────────────────────── neutral-tone cents
/** The principled neutral-interval cents this corpus uses (see header). */
export const NEUTRAL = {
  /** Rast / Sikah neutral 3rd above a root (≈ 27/22). 24-TET alt: 350. */
  rastThird: 355,
  /** Bayati neutral 2nd above a root (≈ 12/11 = 150.6¢). 24-TET alt: 150. */
  neutralSecond: 150,
  /** Neutral 6th in a Rast-type upper jins (3rd above the 5th). */
  rastSixth: 355,
  /** Rast neutral 7th = 5th(702) + neutral-3rd(355) − octave-fold ≈ 1057.
   *  We use 1050 (the common B½b, also the 24-TET value). */
  neutralSeventh: 1050,
  /** Saba's narrowed 4th (diminished, "yearning"). ~590¢. */
  sabaFourth: 590,
} as const

// ─────────────────────────────────────────────────────────────────── ajnas
const deg = (cents: number, label: string): ModeDegree => ({ cents, label })

/** Jins Rast (tetrachord): 1 – ¾ – ¾ – 1. C D E½b F. */
export const JINS_RAST: Jins = {
  id: "jins.rast",
  name: "Rast",
  degrees: [deg(0, "Sus"), deg(204, "M2 9/8"), deg(NEUTRAL.rastThird, "neutral 3rd"), deg(498, "P4 4/3")],
}
/** Jins Bayati (tetrachord): ¾ – ¾ – 1. D E½b F G. */
export const JINS_BAYATI: Jins = {
  id: "jins.bayati",
  name: "Bayati",
  degrees: [deg(0, "Sus"), deg(NEUTRAL.neutralSecond, "neutral 2nd"), deg(294, "m3"), deg(498, "P4")],
}
/** Jins Hijaz (tetrachord): ½ – aug2 – ½. D E♭ F♯ G. (augmented 2nd = 296¢ here,
 *  the just Hijaz 14/13–5/4 spelling gives 0,128,386,498.) */
export const JINS_HIJAZ: Jins = {
  id: "jins.hijaz",
  name: "Hijaz",
  degrees: [deg(0, "Sus"), deg(128, "neutral/min 2nd 14/13"), deg(386, "M3 5/4"), deg(498, "P4")],
}
/** Jins Nahawand (tetrachord, minor-like): 1 – ½ – 1. C D E♭ F. */
export const JINS_NAHAWAND: Jins = {
  id: "jins.nahawand",
  name: "Nahawand",
  degrees: [deg(0, "Sus"), deg(204, "M2"), deg(294, "m3"), deg(498, "P4")],
}
/** Jins Kurd (tetrachord, Phrygian-like): ½ – 1 – 1. D E♭ F G. */
export const JINS_KURD: Jins = {
  id: "jins.kurd",
  name: "Kurd",
  degrees: [deg(0, "Sus"), deg(90, "m2 256/243"), deg(294, "m3"), deg(498, "P4")],
}
/** Jins Ajam (pentachord, major-like): 1 – 1 – ½ – 1. B♭ C D E♭ F → 0 2 4 5 7. */
export const JINS_AJAM: Jins = {
  id: "jins.ajam",
  name: "Ajam",
  degrees: [deg(0, "Sus"), deg(204, "M2 9/8"), deg(408, "M3 81/64"), deg(498, "P4"), deg(702, "P5")],
}
/** Jins Sikah (trichord on a half-flat root): neutral 3rd then ½. */
export const JINS_SIKAH: Jins = {
  id: "jins.sikah",
  name: "Sikah",
  degrees: [deg(0, "Sus (½b)"), deg(NEUTRAL.rastThird, "neutral 3rd"), deg(498, "P4")],
}
/** Jins Nikriz (pentachord): 1 – ½ – aug2-ish – ½ … 0 2 3 6 7. */
export const JINS_NIKRIZ: Jins = {
  id: "jins.nikriz",
  name: "Nikriz",
  degrees: [deg(0, "Sus"), deg(204, "M2"), deg(294, "m3"), deg(594, "A4"), deg(702, "P5")],
}
/** Jins Saba (tetrachord, narrowed 4th): ¾ – ¾ – dim. D E½b F G♭. */
export const JINS_SABA: Jins = {
  id: "jins.saba",
  name: "Saba",
  degrees: [deg(0, "Sus"), deg(NEUTRAL.neutralSecond, "neutral 2nd"), deg(294, "m3"), deg(NEUTRAL.sabaFourth, "dim 4th")],
}

export const AJNAS: Jins[] = [
  JINS_RAST, JINS_BAYATI, JINS_HIJAZ, JINS_NAHAWAND, JINS_KURD,
  JINS_AJAM, JINS_SIKAH, JINS_NIKRIZ, JINS_SABA,
]

// ───────────────────────────────────────────────────────────────── maqamat
/**
 * Build a maqam scale by stacking a lower jins (rooted at the tonic) and an
 * upper jins rooted `upperRootCents` above the tonic. The upper jins root (its
 * own degree 0) is dropped if it coincides with the lower jins' top degree
 * (shared pivot); otherwise both are kept (adjoining ajnas).
 */
const buildMaqam = (
  id: string,
  name: string,
  lower: Jins,
  upper: Jins | undefined,
  upperRootCents: number,
  opts: { aliases?: string[]; notes?: string } = {}
): Mode => {
  const degrees: ModeDegree[] = [...lower.degrees]
  if (upper) {
    const lowTop = lower.degrees[lower.degrees.length - 1].cents
    for (const d of upper.degrees) {
      const abs = d.cents + upperRootCents
      // skip the upper root if it duplicates the lower jins' top (shared pivot)
      if (Math.abs(abs - lowTop) < 1e-6) continue
      // the octave (1200¢) is implied, not a distinct in-octave degree
      if (abs >= 1200 - 1e-6) continue
      if (degrees.some((x) => Math.abs(x.cents - abs) < 1e-6)) continue
      degrees.push({ cents: abs, label: d.label })
    }
  }
  degrees.sort((a, b) => a.cents - b.cents)
  return {
    id,
    name,
    family: "maqam",
    degrees,
    aliases: opts.aliases,
    ajnas: upper ? { lower, upper, upperRootCents } : { lower, upperRootCents },
    notes: opts.notes,
  }
}

/**
 * The principal maqamat. Upper-jins root is typically the 5th (702¢) for Rast-
 * family, the 4th (498¢) for Bayati-family — per standard ajnas decomposition.
 */
export const MAQAMAT: Mode[] = [
  // Rast = jins Rast on tonic + jins Rast on the 5th (G A B½b C) → neutral 3rd & 7th.
  buildMaqam("maqam.rast", "Rast", JINS_RAST, JINS_RAST, 702, {
    aliases: ["Maqam Rast"],
    notes: "Lower Rast + upper Rast on the 5th. Degrees 0 204 355 498 702 906 1057. Neutral 3rd 355¢ & neutral 7th ~1057¢. 24-TET alt: 350/1050.",
  }),
  // Bayati = jins Bayati on tonic + jins Nahawand on the 4th (G A B♭ C).
  buildMaqam("maqam.bayati", "Bayati", JINS_BAYATI, JINS_NAHAWAND, 498, {
    aliases: ["Bayat", "Maqam Bayati"],
    notes: "Lower Bayati (neutral 2nd 150¢) + upper Nahawand on the 4th. 0 150 294 498 702 792 996.",
  }),
  // Hijaz = jins Hijaz on tonic + jins Rast on the 4th (or Nahawand variant).
  buildMaqam("maqam.hijaz", "Hijaz", JINS_HIJAZ, JINS_RAST, 498, {
    aliases: ["Hicaz", "Maqam Hijaz"],
    notes: "Lower Hijaz (½, aug2, ½) + upper Rast on the 4th. Aug-2nd colour; upper jins varies by region.",
  }),
  // Hijazkar = Hijaz on tonic + Hijaz on the 5th (symmetric "double Hijaz").
  buildMaqam("maqam.hijazkar", "Hijazkar", JINS_HIJAZ, JINS_HIJAZ, 702, {
    aliases: ["Hijaz Kar", "Shahnaz", "Shadd Araban-family"],
    notes: "Two Hijaz tetrachords (double-harmonic shape). 0 128 386 498 702 830 1088.",
  }),
  // Saba = jins Saba on tonic + jins Hijaz on the (lowered) 3rd region.
  buildMaqam("maqam.saba", "Saba", JINS_SABA, JINS_HIJAZ, 294, {
    aliases: ["Maqam Saba"],
    notes: "Lower Saba (narrowed 4th 590¢) + upper Hijaz from the m3. Signature 'yearning' diminished 4th.",
  }),
  // Sikah / Sigah = jins Sikah on tonic (rooted on a half-flat) + Rast above.
  buildMaqam("maqam.sikah", "Sikah", JINS_SIKAH, JINS_RAST, 498, {
    aliases: ["Sigah", "Segah", "Maqam Sikah"],
    notes: "Rooted on a half-flat (E½b). Sikah trichord + Rast. The neutral degrees define it.",
  }),
  // Huzam = a Sikah-family maqam: Sikah + Hijaz with the characteristic raise.
  buildMaqam("maqam.huzam", "Huzam", JINS_SIKAH, JINS_HIJAZ, 294, {
    aliases: ["Huzzam", "Mukhalif", "Maqam Huzam"],
    notes: "Sikah lower + Hijaz upper (raised colour). Neutral root, augmented-2nd above.",
  }),
  // Nahawand = jins Nahawand on tonic + jins Hijaz on the 5th (≈ harmonic minor).
  buildMaqam("maqam.nahawand", "Nahawand", JINS_NAHAWAND, JINS_HIJAZ, 702, {
    aliases: ["Nahwand", "Maqam Nahawand"],
    notes: "Minor-like; upper Hijaz on the 5th gives the harmonic-minor leading tone. 12-TET-aligned (no neutral tones).",
  }),
  // Kurd = jins Kurd on tonic + jins Kurd/Nahawand on the 5th (≈ Phrygian).
  buildMaqam("maqam.kurd", "Kurd", JINS_KURD, JINS_NAHAWAND, 702, {
    aliases: ["Kurd-i", "Maqam Kurd"],
    notes: "Phrygian-like; 12-TET-aligned (no neutral tones). 0 90 294 498 702 792 996.",
  }),
  // Ajam = jins Ajam (pentachord) on tonic + jins Rast/Ajam on the 5th (≈ major).
  buildMaqam("maqam.ajam", "Ajam", JINS_AJAM, JINS_NAHAWAND, 702, {
    aliases: ["Ajam Ushayran", "Maqam Ajam"],
    notes: "Major-like; 12-TET-aligned. Built on a major pentachord. 0 204 408 498 702 906 996/1110.",
  }),
  // Nikriz = jins Nikriz (pentachord, raised 4th) on tonic + Hijaz/Rast above.
  buildMaqam("maqam.nikriz", "Nikriz", JINS_NIKRIZ, JINS_RAST, 702, {
    aliases: ["Nigriz", "Maqam Nikriz"],
    notes: "Pentachord with a raised 4th (594¢, A4) over a minor 3rd. Nikriz lower + Rast upper.",
  }),
  // Suznak = Rast lower + Hijaz on the 5th (Rast with a Hijaz upper).
  buildMaqam("maqam.suznak", "Suznak", JINS_RAST, JINS_HIJAZ, 702, {
    aliases: ["SuzNak", "Maqam Suznak"],
    notes: "Rast lower (neutral 3rd 355¢) + Hijaz upper on the 5th. A Rast-family maqam with an aug-2nd top.",
  }),
]
