// Preset cycles: characteristic combinations of short (2) and long (3) pulses
// from a range of living traditions.
//
// Groupings follow the standard, most commonly taught reading for each dance.
// Several dances share a shape (a 3+2+2 seven is a Lesnoto and a Kalamatianos
// both); we keep the well-known names so a teacher can call the right one up,
// and note the cousins. A few long meters have a genuinely debated internal
// ordering in the literature (the total is not in doubt); those carry a note.
// This is a starting library, meant to be pruned and extended by the author.

import type { Cycle } from "./cycle"

export const PRESETS: Cycle[] = [
  // 5
  {
    id: "paidushko",
    name: "Paidushko",
    groups: [2, 3],
    unit: 16,
    tradition: "Bulgarian",
    notes: "Quick-slow. A slow-quick 3+2 reading is common further south.",
  },
  {
    id: "turk-aksagi",
    name: "Türk Aksağı",
    groups: [2, 3],
    unit: 16,
    tradition: "Turkish",
    notes: "A five-beat aksak usul.",
  },

  // 7
  {
    id: "rachenitsa",
    name: "Rachenitsa",
    groups: [2, 2, 3],
    unit: 16,
    tradition: "Bulgarian",
    notes: "Romanian cousin: Geampara.",
  },
  {
    id: "lesnoto",
    name: "Lesnoto",
    groups: [3, 2, 2],
    unit: 8,
    tradition: "Macedonian / Bulgarian",
    notes: "Also called Pravoto.",
  },
  {
    id: "kalamatianos",
    name: "Kalamatianos",
    groups: [3, 2, 2],
    unit: 8,
    tradition: "Greek",
    notes: "The Greek seven. Same shape as Lesnoto.",
  },
  {
    id: "rupak",
    name: "Rupak tala",
    groups: [3, 2, 2],
    unit: 8,
    tradition: "Hindustani (India)",
    notes: "A 7-matra cycle, 3+2+2. Mapped to pulses by beat count.",
  },

  // 9
  {
    id: "daichovo",
    name: "Daichovo",
    groups: [2, 2, 2, 3],
    unit: 16,
    tradition: "Bulgarian",
    notes: "Macedonian cousin: Devetorka.",
  },
  {
    id: "karsilama",
    name: "Karsilama",
    groups: [2, 2, 2, 3],
    unit: 8,
    tradition: "Turkish / Greek",
    notes: "The rhythm of the tune Rampi Rampi.",
  },
  {
    id: "slip-jig",
    name: "Slip Jig",
    groups: [3, 3, 3],
    unit: 8,
    tradition: "Irish",
    notes: "Three long groups.",
  },

  // 10
  {
    id: "curcuna",
    name: "Curcuna",
    groups: [3, 2, 2, 3],
    unit: 8,
    tradition: "Turkish",
    notes: "A ten-beat usul.",
  },

  // 11
  {
    id: "kopanitsa",
    name: "Kopanitsa",
    groups: [2, 2, 3, 2, 2],
    unit: 16,
    tradition: "Bulgarian",
    notes: "Also called Gankino.",
  },

  // 12
  {
    id: "berance",
    name: "Berance",
    groups: [3, 2, 2, 3, 2],
    unit: 16,
    tradition: "Macedonian",
    notes: "Ordering varies by village; a longer 18/16 reading also exists.",
  },

  // 13
  {
    id: "eleno-mome",
    name: "Eleno Mome",
    groups: [4, 4, 2, 3],
    unit: 16,
    tradition: "Bulgarian",
    notes: "A famously elastic meter; this is one common reading.",
  },
  {
    id: "petrunino",
    name: "Petrunino",
    groups: [2, 2, 2, 2, 2, 3],
    unit: 16,
    tradition: "Bulgarian (Shop)",
    notes: "Five quicks and a slow.",
  },

  // 15
  {
    id: "buchimis",
    name: "Buchimis",
    groups: [2, 2, 2, 2, 3, 2, 2],
    unit: 16,
    tradition: "Bulgarian (Thrace)",
    notes: "The slow sits fifth.",
  },

  // 18
  {
    id: "yove-male-mome",
    name: "Yove Male Mome",
    groups: [3, 2, 2, 2, 2, 3, 2, 2],
    unit: 16,
    tradition: "Bulgarian (Shop)",
    notes: "A Chetvorno seven joined to a Kopanitsa eleven.",
  },

  // 22
  {
    id: "sandansko",
    name: "Sandansko Horo",
    groups: [2, 2, 2, 3, 2, 2, 2, 3, 2, 2],
    unit: 16,
    tradition: "Bulgarian (Pirin)",
    notes: "A nine joined to a thirteen. The internal ordering is debated.",
  },

  // 25
  {
    id: "sedi-donka",
    name: "Sedi Donka",
    groups: [3, 2, 2, 3, 2, 2, 2, 2, 3, 2, 2],
    unit: 16,
    tradition: "Bulgarian (Thrace)",
    notes: "Seven plus seven plus eleven.",
  },
]

export const presetById = (id: string): Cycle | undefined =>
  PRESETS.find((c) => c.id === id)
