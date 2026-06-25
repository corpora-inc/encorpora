/**
 * beatlounge — PERSIAN dastgāh (radif), exact cents.
 *
 * Persian classical music is organized into dastgāh-hā (modal systems), each a
 * scale plus a characteristic melodic path. Its hallmark is the NEUTRAL pitches
 * notated with koron (≈ −60¢) and sori (≈ +40¢) accidentals — but these are
 * notation conventions: the actual neutral-second sizes are FLEXIBLE (≈125–170¢)
 * and differ per dastgāh and degree. So, like maqam, we store each dastgāh as an
 * explicit cents-above-tonic table (NOT a global koron/sori offset on 12-TET).
 *
 * ── Source (authoritative for this corpus) ────────────────────────────────
 * The cents are from the Mahmud Karimi Radif + Hormoz Farhat ("The Dastgah
 * Concept in Persian Music"), as tabulated in Abdoli, ISMIR 2011, Table 1
 * (archives.ismir.net/ismir2011/paper/000063.pdf). koron/sori cents per LilyPond
 * (lilypond.org persian-classical-music: koron −60¢, sori +40¢); the flexible
 * neutral seconds (135/165¢) per Farhat via tuning.ableton.com/persian-radif.
 *
 * Nava shares Shur's scale and Rast-Panjgah shares Mahur's — they differ by mode
 * function (tonic / shâhed emphasis), not interval content. The 5 āvāz (Abu-Ata,
 * Bayat-e Tork, Afshari, Dashti from Shur; Esfahan from Homayun) are deferred —
 * they reuse a parent scale with a different shâhed, which needs the (future)
 * melodic-path layer, not new cents.
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
    id: "persian.shur",
    name: "Shur",
    cents: [0, 149, 300, 500, 702, 783, 985],
    aliases: ["Šur", "Dastgah-e Shur"],
    notes: "The most prominent dastgāh; parent of Abu-Ata / Bayat-e Tork / Afshari / Dashti. 2nd degree is a koron (149¢). Karimi/Farhat.",
  },
  {
    id: "persian.mahur",
    name: "Mahur",
    cents: [0, 208, 397, 497, 702, 891, 994],
    aliases: ["Dastgah-e Mahur"],
    notes: "Bright, major-like (near-Pythagorean) — the least microtonal dastgāh. Shares its tuning with Rast-Panjgah.",
  },
  {
    id: "persian.homayun",
    name: "Homayun",
    cents: [0, 100, 398, 502, 715, 800, 990],
    aliases: ["Dastgah-e Homayun"],
    notes: "Solemn / dramatic; parent of āvāz-e Esfahan. Tonic conventionally sits on a koron.",
  },
  {
    id: "persian.segah",
    name: "Segah",
    cents: [0, 198, 352, 495, 707, 826, 1013],
    aliases: ["Sehgah", "Dastgah-e Segah"],
    notes: "Rooted on a koron (neutral) degree; 3rd ~352¢, koron 6th 826¢. Iconic and beloved.",
  },
  {
    id: "persian.chahargah",
    name: "Chahargah",
    cents: [0, 134, 397, 497, 634, 888, 994],
    aliases: ["Dastgah-e Chahargah"],
    notes: "The most dramatically 'Persian' sounding — the double-koron signature (2nd 134¢ & 6th 888¢).",
  },
  {
    id: "persian.nava",
    name: "Nava",
    cents: [0, 149, 300, 500, 702, 783, 985],
    aliases: ["Dastgah-e Nava"],
    notes: "Shares Shur's scale material; a distinct mode (different shâhed / tonic emphasis).",
  },
  {
    id: "persian.rastPanjgah",
    name: "Rast-Panjgah",
    cents: [0, 208, 397, 497, 702, 891, 994],
    aliases: ["Rast Panjgah", "Dastgah-e Rast-Panjgah"],
    notes: "Shares Mahur's tuning; a distinct mode.",
  },
]

export const PERSIAN_DASTGAH: Mode[] = SPECS.map((s) => ({
  id: s.id,
  name: s.name,
  family: "persian",
  degrees: degreesFromCents(s.cents),
  aliases: s.aliases,
  notes: s.notes,
}))
