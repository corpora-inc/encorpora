/**
 * beatlounge — TURKISH makam (Arel-Ezgi-Uzdilek), exact cents.
 *
 * Turkish art music is a DIFFERENT tuning system from Arabic maqam: the AEU
 * theory divides the octave into 53 Holdrian commas (1 comma = 1200/53 ≈
 * 22.6415¢), on a Pythagorean basis (whole tone = 9 commas ≈ 203.8¢). So the
 * "same" makam sounds different from its Arabic namesake — Turkish Rast's 3rd is
 * ≈384.9¢ (a near-major third), NOT the Arabic half-flat ~350¢. Hence a SEPARATE
 * family, not a school overlay on maqam (a 24-EDO grid can't express commas).
 *
 * ── Sources ───────────────────────────────────────────────────────────────
 * 1 comma = 1200/53 and the accidental sizes (bakiye 4c/90.6¢, küçük mücennep
 * 5c/113.2¢, büyük mücennep 8c/181.1¢, tanini 9c/203.8¢) per Wikipedia "Holdrian
 * comma" (Turkish-makam table) + "Turkish makam". Per-makam comma sequences (each
 * summing to 53) from Wikipedia per-makam articles + microtonaltheory.com
 * "Turkish makams" + tsalo.fi Greek/Turkish scales; Rast segah quoted as 384.91¢
 * (Wikipedia "Rast (Turkish makam)"). Cents = commas × 22.6415, rounded to 0.1.
 */

import type { Mode, ModeDegree } from "./types"

const INTERVAL = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7", "8"]

/** Label a cents value by its nearest 12-TET interval, marking microtonal ones. */
const degreesFromCents = (cents: readonly number[]): ModeDegree[] =>
  cents.map((c) => {
    const semi = Math.round(c / 100)
    const base = INTERVAL[semi] ?? String(semi)
    const dev = Math.round(c - semi * 100)
    return { cents: c, label: Math.abs(dev) > 6 ? `${base}${dev > 0 ? "+" : "-"}` : base }
  })

interface Spec {
  id: string
  name: string
  cents: readonly number[]
  aliases?: string[]
  notes?: string
}

const SPECS: Spec[] = [
  {
    id: "turkish.rast",
    name: "Rast",
    cents: [0, 203.8, 384.9, 498.1, 701.9, 905.7, 1086.8],
    notes: "The 'mother makam'. Segah (3rd) ≈ 17 commas / 384.9¢ — a near-major 3rd, NOT the Arabic half-flat. Rast pentachord + Rast tetrachord.",
  },
  {
    id: "turkish.mahur",
    name: "Mahur",
    cents: [0, 203.8, 407.5, 498.1, 701.9, 905.7, 1109.4],
    notes: "Pythagorean major (3rd 407.5¢, 7th 1109.4¢) — the clean contrast to Rast's comma-flat 3rd.",
  },
  {
    id: "turkish.buselik",
    name: "Buselik",
    cents: [0, 203.8, 294.3, 498.1, 701.9, 792.5, 996.2],
    notes: "Pythagorean natural minor (Buselik pentachord + Kürdi tetrachord).",
  },
  {
    id: "turkish.nihavend",
    name: "Nihavend",
    cents: [0, 203.8, 294.3, 498.1, 701.9, 792.5, 996.2],
    notes: "≈ Western minor; same ascending set as Buselik, differs by seyir (descending) — among the most-used makamlar.",
  },
  {
    id: "turkish.ussak",
    name: "Uşşak",
    cents: [0, 181.1, 294.3, 498.1, 701.9, 792.5, 996.2],
    aliases: ["Ussak"],
    notes: "A fundamental makam. 2nd degree = 8 commas / 181.1¢ (the famous 'Uşşak second'; often bent lower in practice).",
  },
  {
    id: "turkish.huseyni",
    name: "Hüseyni",
    cents: [0, 181.1, 294.3, 498.1, 701.9, 883.0, 996.2],
    aliases: ["Huseyni"],
    notes: "The great folk makam; shares Uşşak's lower tetrachord but the 6th sits at 39 commas / 883¢.",
  },
  {
    id: "turkish.kurdi",
    name: "Kürdi",
    cents: [0, 90.6, 294.3, 498.1, 701.9, 792.5, 996.2],
    aliases: ["Kurdi"],
    notes: "Phrygian-like; 2nd degree = 4-comma bakiye / 90.6¢ (a true Pythagorean semitone), audibly distinct from Uşşak's neutral 2nd.",
  },
  {
    id: "turkish.hicaz",
    name: "Hicaz",
    cents: [0, 113.2, 384.9, 498.1, 701.9, 792.5, 996.2],
    aliases: ["Hijaz"],
    notes: "Ubiquitous. Hicaz tetrachord (5-12-5, aug 2nd ≈ 271.7¢) + a Phrygian-ish upper → minor 6th (792.5¢) & minor 7th, matching the standard A B♭ C♯ D E F G scale.",
  },
  {
    id: "turkish.saba",
    name: "Saba",
    cents: [0, 181.1, 294.3, 408.0, 679.2, 792.5, 996.2],
    notes: "Signature NARROWED 4th — the Saba perde (18 commas / 408¢) sits BELOW the perfect 4th (498), not above. Upper Hicaz-pentachord → Acem 6th (792.5). The mournful crushed-4th sound.",
  },
  {
    id: "turkish.segah",
    name: "Segah",
    cents: [0, 113.2, 317.0, 520.8, 701.9, 815.1, 1018.9],
    aliases: ["Sigah"],
    notes: "Tonic IS the segah perde (a comma-flat note); half-flat tonic and 5th showcase the comma system.",
  },
]

export const TURKISH_MAKAMLAR: Mode[] = SPECS.map((s) => ({
  id: s.id,
  name: s.name,
  family: "turkish",
  degrees: degreesFromCents(s.cents),
  aliases: s.aliases,
  notes: s.notes,
}))
