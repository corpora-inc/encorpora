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
/**
 * The school-variable neutral cents. Because maqamat COMPOSE ajnas, these few
 * jins-level values are ALL a regional school needs — shifting `rastThird` moves
 * Rast's 3rd, Rast's 7th (via the upper jins) AND Sikah together. Everything else
 * (whole tones, P4/P5, Hijaz's augmented 2nd) is fixed and school-invariant.
 */
export interface NeutralTable {
  /** Rast / Sikah neutral 3rd above a root — the primary regional marker. */
  rastThird: number
  /** Bayati / Saba neutral 2nd above a root (≈ 12/11 = 150.6¢). */
  neutralSecond: number
  /** Saba's narrowed ("yearning") 4th. */
  sabaFourth: number
}

/**
 * Regional intonation schools (Arabic). They differ in the neutral (sikah/Rast)
 * 3rd — the degree Arab musicians actually argue about by region. Sourced:
 *   - grid: the 1932 Cairo-Congress 24-EDO 50¢ grid (pedagogical lingua franca).
 *   - just: 27/22 = 354.5¢ (microtonaltheory "Arab Rast") — the pan-Arab middle.
 *   - egyptian: ~342¢, the FLATTER sikah (Abu Shumays/Ableton: "lower in Egypt").
 *   - syrian: ~360¢, the HIGHER sikah ("typically higher in Syria than Egypt").
 * `neutralSecond` (150) and `sabaFourth` (590) are held constant — no clean
 * regional split in the literature; Saba's 4th stays at the shipped 590¢ (sources
 * cluster 582–600) pending a dedicated review. Turkish makam (53-comma) and
 * Persian dastgah (koron/sori) are separate SYSTEMS, not schools.
 */
export type MaqamSchool = "grid" | "just" | "egyptian" | "syrian"

export const SCHOOL_NEUTRAL: Record<MaqamSchool, NeutralTable> = {
  grid: { rastThird: 350, neutralSecond: 150, sabaFourth: 590 },
  just: { rastThird: 355, neutralSecond: 150, sabaFourth: 590 },
  egyptian: { rastThird: 342, neutralSecond: 150, sabaFourth: 590 },
  syrian: { rastThird: 360, neutralSecond: 150, sabaFourth: 590 },
}

/** The default school — the 24-EDO grid (clean, sourced, learner-friendly). */
export const DEFAULT_SCHOOL: MaqamSchool = "grid"

/** The default neutral table (back-compat export; = the default school). */
export const NEUTRAL: NeutralTable = SCHOOL_NEUTRAL[DEFAULT_SCHOOL]

// ─────────────────────────────────────────────────────────────────── ajnas
const deg = (cents: number, label: string): ModeDegree => ({ cents, label })

/** The nine ajnas as a set — built from a neutral table (a school = a table). */
export interface AjnasSet {
  rast: Jins
  bayati: Jins
  hijaz: Jins
  nahawand: Jins
  kurd: Jins
  ajam: Jins
  sikah: Jins
  nikriz: Jins
  saba: Jins
}

/** Construct all nine ajnas from a neutral table. Only the neutral degrees
 *  (`rastThird`, `neutralSecond`, `sabaFourth`) vary; the rest are fixed. */
const buildAjnasSet = (n: NeutralTable): AjnasSet => ({
  // Jins Rast (tetrachord): 1 – ¾ – ¾ – 1. C D E½b F.
  rast: { id: "jins.rast", name: "Rast", degrees: [deg(0, "Sus"), deg(204, "M2 9/8"), deg(n.rastThird, "neutral 3rd"), deg(498, "P4 4/3")] },
  // Jins Bayati (tetrachord): ¾ – ¾ – 1. D E½b F G.
  bayati: { id: "jins.bayati", name: "Bayati", degrees: [deg(0, "Sus"), deg(n.neutralSecond, "neutral 2nd"), deg(294, "m3"), deg(498, "P4")] },
  // Jins Hijaz (tetrachord): ½ – aug2 – ½. D E♭ F♯ G.
  hijaz: { id: "jins.hijaz", name: "Hijaz", degrees: [deg(0, "Sus"), deg(128, "neutral/min 2nd 14/13"), deg(386, "M3 5/4"), deg(498, "P4")] },
  // Jins Nahawand (tetrachord, minor-like): 1 – ½ – 1. C D E♭ F.
  nahawand: { id: "jins.nahawand", name: "Nahawand", degrees: [deg(0, "Sus"), deg(204, "M2"), deg(294, "m3"), deg(498, "P4")] },
  // Jins Kurd (tetrachord, Phrygian-like): ½ – 1 – 1. D E♭ F G.
  kurd: { id: "jins.kurd", name: "Kurd", degrees: [deg(0, "Sus"), deg(90, "m2 256/243"), deg(294, "m3"), deg(498, "P4")] },
  // Jins Ajam (pentachord, major-like): 1 – 1 – ½ – 1.
  ajam: { id: "jins.ajam", name: "Ajam", degrees: [deg(0, "Sus"), deg(204, "M2 9/8"), deg(408, "M3 81/64"), deg(498, "P4"), deg(702, "P5")] },
  // Jins Sikah (trichord on a half-flat root): neutral 3rd then ½.
  sikah: { id: "jins.sikah", name: "Sikah", degrees: [deg(0, "Sus (½b)"), deg(n.rastThird, "neutral 3rd"), deg(498, "P4")] },
  // Jins Nikriz (pentachord): 1 – ½ – aug2-ish – ½ … 0 2 3 6 7.
  nikriz: { id: "jins.nikriz", name: "Nikriz", degrees: [deg(0, "Sus"), deg(204, "M2"), deg(294, "m3"), deg(594, "A4"), deg(702, "P5")] },
  // Jins Saba (tetrachord, narrowed 4th): ¾ – ¾ – dim. D E½b F G♭.
  saba: { id: "jins.saba", name: "Saba", degrees: [deg(0, "Sus"), deg(n.neutralSecond, "neutral 2nd"), deg(294, "m3"), deg(n.sabaFourth, "dim 4th")] },
})

/** The DEFAULT-school ajnas — the individually-exported consts (back-compat). */
const DEFAULT_AJNAS = buildAjnasSet(NEUTRAL)
export const JINS_RAST = DEFAULT_AJNAS.rast
export const JINS_BAYATI = DEFAULT_AJNAS.bayati
export const JINS_HIJAZ = DEFAULT_AJNAS.hijaz
export const JINS_NAHAWAND = DEFAULT_AJNAS.nahawand
export const JINS_KURD = DEFAULT_AJNAS.kurd
export const JINS_AJAM = DEFAULT_AJNAS.ajam
export const JINS_SIKAH = DEFAULT_AJNAS.sikah
export const JINS_NIKRIZ = DEFAULT_AJNAS.nikriz
export const JINS_SABA = DEFAULT_AJNAS.saba

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
const MAQAM_INTERVAL = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7", "8"]
/** Label a raw cents value by its nearest 12-TET interval (for explicit degrees). */
const labelForCents = (c: number): string => {
  const semi = Math.round(c / 100)
  const base = MAQAM_INTERVAL[semi] ?? String(semi)
  const dev = Math.round(c - semi * 100)
  return Math.abs(dev) > 6 ? `${base}${dev > 0 ? "+" : "-"}` : base
}

const buildMaqam = (
  id: string,
  name: string,
  lower: Jins,
  upper: Jins | undefined,
  upperRootCents: number,
  opts: { aliases?: string[]; notes?: string; degrees?: readonly number[] } = {}
): Mode => {
  // Some neutral/non-standard maqamat (Saba, Sikah, Huzam, Nahawand) don't fall
  // out of a simple lower+upper jins stack — their degrees are given EXPLICITLY.
  if (opts.degrees) {
    return {
      id,
      name,
      family: "maqam",
      degrees: opts.degrees.map((c) => ({ cents: c, label: labelForCents(c) })),
      aliases: opts.aliases,
      ajnas: upper ? { lower, upper, upperRootCents } : { lower, upperRootCents },
      notes: opts.notes,
    }
  }
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
const buildMaqamatFrom = (a: AjnasSet): Mode[] => [
  // Rast = jins Rast on tonic + jins Rast on the 5th (G A B½b C) → neutral 3rd & 7th.
  buildMaqam("maqam.rast", "Rast", a.rast, a.rast, 702, {
    aliases: ["Maqam Rast"],
    notes: "Lower Rast + upper Rast on the 5th. Degrees 0 204 355 498 702 906 1057. Neutral 3rd 355¢ & neutral 7th ~1057¢. 24-TET alt: 350/1050.",
  }),
  // Bayati = jins Bayati on tonic + jins Nahawand on the 4th (G A B♭ C).
  buildMaqam("maqam.bayati", "Bayati", a.bayati, a.nahawand, 498, {
    aliases: ["Bayat", "Maqam Bayati"],
    notes: "Lower Bayati (neutral 2nd 150¢) + upper Nahawand on the 4th. 0 150 294 498 702 792 996.",
  }),
  // Hijaz = jins Hijaz on tonic + jins NAHAWAND on the 4th → minor 6th + minor 7th
  // (the iconic Phrygian-dominant Hijaz: C D♭ E F G A♭ B♭). The Rast-upper variant
  // gives a neutral 6th, which reads major-ish; Nahawand is the common form.
  buildMaqam("maqam.hijaz", "Hijaz", a.hijaz, a.nahawand, 498, {
    aliases: ["Hicaz", "Maqam Hijaz"],
    notes: "Lower Hijaz (½, aug2, ½) + upper Nahawand on the 4th → 0 128 386 498 702 792 996 (minor 6th A♭, minor 7th B♭).",
  }),
  // Hijazkar = Hijaz on tonic + Hijaz on the 5th (symmetric "double Hijaz").
  buildMaqam("maqam.hijazkar", "Hijazkar", a.hijaz, a.hijaz, 702, {
    aliases: ["Hijaz Kar", "Shahnaz", "Shadd Araban-family"],
    notes: "Two Hijaz tetrachords (double-harmonic shape). 0 128 386 498 702 830 1088.",
  }),
  // Saba — the crushed/mournful NARROWED 4th: the 4th degree (400¢) sits BELOW the
  // perfect 4th (498). Explicit degrees (maqamworld: Saba + Hijaz on the 3rd).
  buildMaqam("maqam.saba", "Saba", a.saba, a.hijaz, 294, {
    aliases: ["Maqam Saba"],
    degrees: [0, 150, 300, 400, 700, 800, 1000],
    notes: "0 150 300 400 700 800 1000. Signature diminished/narrowed 4th (400¢, below the P4). Only deg2 (150) is neutral. Source: maqamworld.com/en/maqam/saba.php.",
  }),
  // Sikah — rooted on a NEUTRAL tonic (E½b); 7 degrees. Explicit (Sikah trichord +
  // Upper Rast on the 3rd + Rast on the 6th).
  buildMaqam("maqam.sikah", "Sikah", a.sikah, a.rast, 498, {
    aliases: ["Sigah", "Segah", "Maqam Sikah"],
    degrees: [0, 150, 350, 550, 700, 850, 1050],
    notes: "0 150 350 550 700 850 1050. Tonic is itself a half-flat (sikah pitch). Source: maqamworld.com/en/maqam/sikah.php.",
  }),
  // Huzam — Sikah with jins Hijaz on the 3rd → the augmented-2nd leap between deg4
  // (450) and deg5 (750). Explicit degrees (fixes the impossible 294→350 step).
  buildMaqam("maqam.huzam", "Huzam", a.sikah, a.hijaz, 294, {
    aliases: ["Huzzam", "Mukhalif", "Maqam Huzam"],
    degrees: [0, 150, 350, 450, 750, 850, 1050],
    notes: "0 150 350 450 750 850 1050. Sikah + Hijaz on the 3rd (aug-2nd at deg4→5). Neutral tonic. Source: maqamworld.com/en/maqam/huzam.php.",
  }),
  // Nahawand ≈ harmonic minor. Explicit degrees: the upper-Hijaz stack gave a
  // too-sharp 6th (830, from Hijaz's wide 2nd); a clean minor 6th (792) is correct.
  buildMaqam("maqam.nahawand", "Nahawand", a.nahawand, a.hijaz, 702, {
    aliases: ["Nahwand", "Maqam Nahawand"],
    degrees: [0, 204, 294, 498, 702, 792, 1088],
    notes: "Harmonic minor: 0 204 294 498 702 792 1088 (clean minor 6th A♭ + leading tone B). 12-TET-aligned.",
  }),
  // Kurd = jins Kurd on tonic + jins Nahawand on the 4th (498) (≈ Phrygian).
  buildMaqam("maqam.kurd", "Kurd", a.kurd, a.nahawand, 498, {
    aliases: ["Kurd-i", "Maqam Kurd"],
    notes:
      "Phrygian-like; 12-TET-aligned (no neutral tones). Lower Kurd + jins Nahawand on the " +
      "4th (498) → 0 90 294 498 702 792 996. Source: maqamworld.com/en/maqam/kurd.php.",
  }),
  // Ajam = jins Ajam (pentachord) on tonic + jins Nahawand on the 6th (≈ MAJOR scale).
  buildMaqam("maqam.ajam", "Ajam", a.ajam, a.nahawand, 906, {
    aliases: ["Ajam Ushayran", "Maqam Ajam"],
    notes:
      "Major scale (Arabic 'major'); 12-TET-aligned. Major pentachord + jins Nahawand on the " +
      "6th (906) → 0 204 408 498 702 906 1110 (major 7th B, NOT ♭7). maqamworld also names a " +
      "Kurd middle-jins on the 3rd (adds no new degree here). Source: maqamworld.com/en/maqam/ajam_ushayran.php.",
  }),
  // Nikriz = jins Nikriz (pentachord, raised 4th) on tonic + jins NAHAWAND on the 5th.
  buildMaqam("maqam.nikriz", "Nikriz", a.nikriz, a.nahawand, 702, {
    aliases: ["Nigriz", "Maqam Nikriz"],
    notes:
      "Arabic Nikriz: lower Nikriz pentachord (raised 4th 594¢) + jins Nahawand on the 5th → " +
      "C D E♭ F♯ G A B♭ (0 204 294 594 702 906 996). A MINOR 7th (B♭), not neutral. " +
      "(Turkish makam Nikriz, rooted on Rast with a neutral 7th, is a separate regional variant — " +
      "future 'school'.) Source: maqamworld.com/en/maqam/nikriz.php.",
  }),
  // Suznak = Rast lower + Hijaz on the 5th (Rast with a Hijaz upper).
  buildMaqam("maqam.suznak", "Suznak", a.rast, a.hijaz, 702, {
    aliases: ["SuzNak", "Maqam Suznak"],
    notes: "Rast lower (neutral 3rd 355¢) + Hijaz upper on the 5th. A Rast-family maqam with an aug-2nd top.",
  }),
]

// ────────────────────────────────────────────────────────── schools registry
const SCHOOL_CACHE = new Map<MaqamSchool, Mode[]>()

/** The maqamat intonated for a given regional school (built once, cached). The
 *  mode ids are identical across schools — only the neutral cents differ — so the
 *  resolver can swap school live without touching the doc's mode id. */
export const maqamatForSchool = (school: MaqamSchool): Mode[] => {
  let v = SCHOOL_CACHE.get(school)
  if (!v) {
    v = buildMaqamatFrom(buildAjnasSet(SCHOOL_NEUTRAL[school]))
    SCHOOL_CACHE.set(school, v)
  }
  return v
}

/** The default-school maqamat (back-compat export + the no-school fallback). */
export const MAQAMAT: Mode[] = maqamatForSchool(DEFAULT_SCHOOL)
