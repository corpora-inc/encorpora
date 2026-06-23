/**
 * beatlounge — THE DRUM-KIT CORPUS (data only).
 *
 * A curated repertoire of synthesis-parameter kits across three families that
 * pair with the world-rhythms corpus:
 *   • electronic — 808 / 909 / 707 / techno / house / trap / lo-fi / industrial
 *                  / synthwave
 *   • acoustic   — studio (default) / rock / jazz brushes / orchestral / vintage
 *   • world      — Afro-Cuban / Brazilian batucada / Middle-Eastern / Indian
 *
 * Each kit specifies ONLY the voices it gives a distinct character; unspecified
 * voices inherit the default ("studio") kit via `resolveKit`, so EVERY voice is
 * always defined and no pad is ever silent. All values are plain JSON — the
 * parametric synth (instruments/drumKit.ts) builds Tone voices from them.
 *
 * No samples. No downloads. Pure synthesis parameters, like every other corpus.
 */

import type { KitDef, KitFamily, KitFamilyMeta } from "./types"
import { DEFAULT_KIT } from "./defaultKit"

// MIDI note helpers (kept local so recipes read musically).
const note = {
  A0: 21, C1: 24, D1: 26, E1: 28, G1: 31, A1: 33, B1: 35,
  C2: 36, D2: 38, E2: 40, F2: 41, G2: 43, A2: 45, B2: 47,
  C3: 48, D3: 50, E3: 52, G3: 55, A3: 57,
  C4: 60, E4: 64, G4: 67, A4: 69, C5: 72, E5: 76, A5: 81, C6: 84, E6: 88,
} as const

// ----------------------------------------------------------------- families
export const FAMILY_META: Record<KitFamily, KitFamilyMeta> = {
  electronic: {
    family: "electronic",
    label: "Electronic",
    blurb: "Drum machines & synthetic kits — 808s, 909s, techno, trap, lo-fi.",
  },
  acoustic: {
    family: "acoustic",
    label: "Acoustic",
    blurb: "Modelled real drums — studio, rock, jazz brushes, orchestral.",
  },
  world: {
    family: "world",
    label: "World",
    blurb: "Hand percussion — Afro-Cuban, Brazilian, Middle-Eastern, Indian.",
  },
}

// ================================================================ ELECTRONIC

/** Roland TR-808 — long booming sine kick (deep pitch drop), snappy noise snare,
 *  ticky hats, the famous cowbell, ringy toms. */
const KIT_808: KitDef = {
  id: "tr-808",
  name: "808",
  family: "electronic",
  description: "Deep booming sine kick, snappy snare, ticky hats, that cowbell.",
  voices: {
    kick: {
      source: "membrane",
      baseNote: note.A0,
      pitchDecay: 0.08,
      octaves: 8,
      osc: "sine",
      env: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.9 },
      durationSec: 0.6,
      level: 3,
    },
    snare: {
      source: "noise",
      noise: "white",
      env: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
      filter: { type: "highpass", frequency: 1800 },
      body: {
        baseNote: note.G2, pitchDecay: 0.02, octaves: 2, type: "triangle",
        env: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.04 }, level: -8,
      },
      level: 0,
    },
    closedHat: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.01 },
      filter2: { type: "highpass", frequency: 7000 },
      filter: { type: "bandpass", frequency: 10000, q: 1.6 },
      level: 4,
    },
    openHat: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.2 },
      filter2: { type: "highpass", frequency: 7000 },
      filter: { type: "bandpass", frequency: 10000, q: 1.4 },
      level: 2,
    },
    loTom: {
      source: "membrane", baseNote: note.A1, pitchDecay: 0.12, octaves: 2, osc: "sine",
      env: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.4 }, durationSec: 0.4,
    },
    hiTom: {
      source: "membrane", baseNote: note.D2, pitchDecay: 0.12, octaves: 2, osc: "sine",
      env: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.35 }, durationSec: 0.35,
    },
    conga: {
      source: "membrane", baseNote: note.G2, pitchDecay: 0.1, octaves: 2, osc: "sine",
      env: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.2 }, durationSec: 0.25,
    },
  },
}

/** Roland TR-909 — punchy attack-y kick (less sub than 808), bright noisy snare,
 *  metallic hats & crash. The house/techno standard. */
const KIT_909: KitDef = {
  id: "tr-909",
  name: "909",
  family: "electronic",
  description: "Punchy attack-forward kick, bright snare, sizzly metallic hats.",
  voices: {
    kick: {
      source: "membrane",
      baseNote: note.C1,
      pitchDecay: 0.03,
      octaves: 6,
      osc: "sine",
      env: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.2 },
      durationSec: 0.22,
      level: 4,
    },
    snare: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.06 },
      filter: { type: "highpass", frequency: 1400 },
      body: {
        baseNote: note.E2, pitchDecay: 0.02, octaves: 3, type: "triangle",
        env: { attack: 0.001, decay: 0.11, sustain: 0, release: 0.05 }, level: -5,
      },
      level: 2,
    },
    closedHat: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
      filter2: { type: "highpass", frequency: 6000 },
      filter: { type: "bandpass", frequency: 9000, q: 1.0 },
      level: 5,
    },
    openHat: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.18 },
      filter2: { type: "highpass", frequency: 6000 },
      filter: { type: "bandpass", frequency: 9000, q: 0.9 },
      level: 3,
    },
    crash: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 1.6, sustain: 0, release: 0.8 },
      filter: { type: "highpass", frequency: 4500 }, level: 3, durationSec: 0.6,
    },
    ride: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.2 },
      filter: { type: "bandpass", frequency: 8000, q: 0.8 }, level: 1, durationSec: 0.25,
    },
  },
}

/** Roland TR-707/CR-78 vibe — thin, dry, charming "beatbox" voices: short
 *  blippy kick, papery snare, tight hats, tonal toms. */
const KIT_707: KitDef = {
  id: "tr-707",
  name: "707",
  family: "electronic",
  description: "Thin dry beatbox voices — short blippy kick, papery snare, tight hats.",
  voices: {
    kick: {
      source: "membrane", baseNote: note.D1, pitchDecay: 0.02, octaves: 4, osc: "sine",
      env: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.08 }, durationSec: 0.12,
    },
    snare: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.03 },
      filter: { type: "bandpass", frequency: 2200, q: 0.9 },
      body: {
        baseNote: note.A2, pitchDecay: 0.01, octaves: 2, type: "triangle",
        env: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 }, level: -8,
      },
      level: -1,
    },
    closedHat: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.008 },
      filter2: { type: "highpass", frequency: 8000 },
      filter: { type: "bandpass", frequency: 11000, q: 2.0 }, level: 3,
    },
    loTom: { source: "membrane", baseNote: note.A1, pitchDecay: 0.01, octaves: 2, osc: "square",
      env: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 }, durationSec: 0.12, level: -3 },
    hiTom: { source: "membrane", baseNote: note.E2, pitchDecay: 0.01, octaves: 2, osc: "square",
      env: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.06 }, durationSec: 0.1, level: -3 },
  },
}

/** Techno — hard, dark, tunnel kick + industrial-tinged metals, restrained tops. */
const KIT_TECHNO: KitDef = {
  id: "techno",
  name: "Techno",
  family: "electronic",
  description: "Hard dark tunnel kick, restrained snare, metallic dystopian tops.",
  voices: {
    kick: {
      source: "membrane", baseNote: note.A0, pitchDecay: 0.05, octaves: 6, osc: "sine",
      env: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.3 }, durationSec: 0.32, level: 4,
    },
    snare: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.04 },
      filter: { type: "highpass", frequency: 2400 }, level: -2,
    },
    clap: {
      source: "noise", noise: "pink",
      env: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.03 },
      filter: { type: "bandpass", frequency: 1800, q: 1.0 }, level: 0,
    },
    closedHat: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.012 },
      filter2: { type: "highpass", frequency: 7500 },
      filter: { type: "bandpass", frequency: 11000, q: 1.8 }, level: 2,
    },
    ride: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.3 },
      filter: { type: "bandpass", frequency: 9500, q: 0.9 }, level: -2, durationSec: 0.3,
    },
  },
}

/** House — warm, round, classic four-to-the-floor: soft kick, clap-snare, swung
 *  open hats, with a friendly cowbell. */
const KIT_HOUSE: KitDef = {
  id: "house",
  name: "House",
  family: "electronic",
  description: "Warm round kick, clappy snare, swung open hats — classic 4/4 house.",
  voices: {
    kick: {
      source: "membrane", baseNote: note.C1, pitchDecay: 0.035, octaves: 5, osc: "sine",
      env: { attack: 0.001, decay: 0.34, sustain: 0, release: 0.24 }, durationSec: 0.26, level: 3,
    },
    snare: {
      source: "noise", noise: "pink",
      env: { attack: 0.002, decay: 0.13, sustain: 0, release: 0.05 },
      filter: { type: "bandpass", frequency: 1700, q: 0.8 },
      body: {
        baseNote: note.E2, pitchDecay: 0.02, octaves: 3, type: "triangle",
        env: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.04 }, level: -7,
      }, level: 1,
    },
    openHat: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.16 },
      filter2: { type: "highpass", frequency: 5000 },
      filter: { type: "bandpass", frequency: 8500, q: 1.0 }, level: 3,
    },
  },
}

/** Trap — booming sub-808 kick, sharp rimshot snare, fast machine-gun hats. */
const KIT_TRAP: KitDef = {
  id: "trap",
  name: "Trap",
  family: "electronic",
  description: "Sub-heavy 808 kick, sharp rim snare, crisp fast hi-hats.",
  voices: {
    kick: {
      source: "membrane", baseNote: note.A0, pitchDecay: 0.1, octaves: 8, osc: "sine",
      env: { attack: 0.001, decay: 1.1, sustain: 0, release: 1.0 }, durationSec: 0.7, level: 4,
    },
    snare: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.05 },
      filter: { type: "highpass", frequency: 2000 },
      body: {
        baseNote: note.A2, pitchDecay: 0.02, octaves: 2, type: "triangle",
        env: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.03 }, level: -6,
      }, level: 1,
    },
    closedHat: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.006 },
      filter2: { type: "highpass", frequency: 8000 },
      filter: { type: "bandpass", frequency: 12000, q: 2.2 }, level: 4,
    },
    rim: {
      source: "tonal", baseNote: note.C6, osc: "triangle",
      env: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.015 }, level: -1, durationSec: 0.03,
    },
  },
}

/** Lo-fi / boom-bap — dusty, soft, filtered: thumpy muffled kick, fat dry snare,
 *  closed dark hats. The MPC-tape character. */
const KIT_LOFI: KitDef = {
  id: "lofi",
  name: "Lo-Fi",
  family: "electronic",
  description: "Dusty muffled kick, fat dry snare, dark closed hats — boom-bap tape.",
  voices: {
    kick: {
      source: "membrane", baseNote: note.C1, pitchDecay: 0.04, octaves: 4, osc: "sine",
      env: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.18 }, durationSec: 0.24,
      filter: { type: "lowpass", frequency: 900, q: 0.7 }, level: 2,
    },
    snare: {
      source: "noise", noise: "brown",
      env: { attack: 0.002, decay: 0.16, sustain: 0, release: 0.06 },
      filter: { type: "lowpass", frequency: 3200, q: 0.8 },
      body: {
        baseNote: note.D2, pitchDecay: 0.02, octaves: 3, type: "triangle",
        env: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 }, level: -5,
      }, level: 0,
    },
    closedHat: {
      source: "noise", noise: "pink",
      env: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
      filter2: { type: "highpass", frequency: 3000 },
      filter: { type: "lowpass", frequency: 6500, q: 0.9 }, level: 2,
    },
    openHat: {
      source: "noise", noise: "pink",
      env: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.12 },
      filter2: { type: "highpass", frequency: 3000 },
      filter: { type: "lowpass", frequency: 6500, q: 0.8 }, level: 1,
    },
  },
}

/** Industrial / EBM — clanging metallic kick, gated noise snare, harsh distorted
 *  metals. Cold, mechanical, aggressive. */
const KIT_INDUSTRIAL: KitDef = {
  id: "industrial",
  name: "Industrial",
  family: "electronic",
  description: "Clanging metallic kick, gated noise snare, harsh cold metals.",
  voices: {
    kick: {
      source: "membrane", baseNote: note.G1, pitchDecay: 0.015, octaves: 5, osc: "square",
      env: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.12 }, durationSec: 0.18, level: 2,
    },
    snare: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.08 },
      filter: { type: "bandpass", frequency: 3000, q: 1.6 },
      body: {
        baseNote: note.E2, pitchDecay: 0.005, octaves: 4, type: "square",
        env: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.06 }, level: -3,
      }, level: 1,
    },
    closedHat: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
      filter: { type: "bandpass", frequency: 9000, q: 3.0 }, level: 3,
    },
    crash: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 1.2, sustain: 0, release: 0.6 },
      filter: { type: "bandpass", frequency: 6000, q: 2.4 }, level: 2, durationSec: 0.5,
    },
    rim: {
      source: "tonal", baseNote: note.E6, osc: "square",
      env: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 }, level: -2, durationSec: 0.04,
    },
  },
}

/** Synthwave — gated-reverb-flavoured big snare, round retro kick, bright airy
 *  hats. 80s neon. */
const KIT_SYNTHWAVE: KitDef = {
  id: "synthwave",
  name: "Synthwave",
  family: "electronic",
  description: "Big gated snare, round retro kick, bright airy hats — 80s neon.",
  voices: {
    kick: {
      source: "membrane", baseNote: note.C1, pitchDecay: 0.05, octaves: 5, osc: "sine",
      env: { attack: 0.001, decay: 0.38, sustain: 0, release: 0.26 }, durationSec: 0.3, level: 3,
    },
    snare: {
      source: "noise", noise: "white",
      env: { attack: 0.002, decay: 0.34, sustain: 0, release: 0.22 },
      filter: { type: "bandpass", frequency: 1900, q: 0.7 },
      body: {
        baseNote: note.E2, pitchDecay: 0.02, octaves: 3, type: "triangle",
        env: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.1 }, level: -4,
      }, level: 2,
    },
    closedHat: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 },
      filter2: { type: "highpass", frequency: 6000 },
      filter: { type: "bandpass", frequency: 9500, q: 0.9 }, level: 4,
    },
  },
}

// ================================================================= ACOUSTIC

/** Studio Rock — big punchy acoustic-modelled kit: full kick, fat snare, ride &
 *  crash, real toms. */
const KIT_ROCK: KitDef = {
  id: "rock",
  name: "Studio Rock",
  family: "acoustic",
  description: "Big punchy kick, fat backbeat snare, full toms, crash & ride.",
  voices: {
    kick: {
      source: "membrane", baseNote: note.C2, pitchDecay: 0.025, octaves: 4, osc: "sine",
      env: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 }, durationSec: 0.2, level: 2,
    },
    snare: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.08 },
      filter: { type: "bandpass", frequency: 2000, q: 0.6 },
      body: {
        baseNote: note.D3, pitchDecay: 0.02, octaves: 3, type: "triangle",
        env: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.06 }, level: -3,
      }, level: 1,
    },
    loTom: {
      source: "membrane", baseNote: note.A1, pitchDecay: 0.04, octaves: 3, osc: "sine",
      env: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.35 }, durationSec: 0.35,
    },
    hiTom: {
      source: "membrane", baseNote: note.E2, pitchDecay: 0.04, octaves: 3, osc: "sine",
      env: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.3 }, durationSec: 0.3,
    },
    crash: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 1.5, sustain: 0, release: 0.7 },
      filter: { type: "highpass", frequency: 4800 }, level: 1, durationSec: 0.6,
    },
  },
}

/** Jazz Brushes — soft, intimate, brushed: dry brush-snare swish, light kick,
 *  smooth ride, delicate hats. */
const KIT_JAZZ: KitDef = {
  id: "jazz-brushes",
  name: "Jazz Brushes",
  family: "acoustic",
  description: "Soft brushed snare swish, light kick, smooth ride — intimate jazz.",
  voices: {
    kick: {
      source: "membrane", baseNote: note.C2, pitchDecay: 0.03, octaves: 3, osc: "sine",
      env: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.14 }, durationSec: 0.16, level: -2,
    },
    snare: {
      source: "noise", noise: "pink",
      env: { attack: 0.01, decay: 0.18, sustain: 0, release: 0.1 },
      filter: { type: "bandpass", frequency: 2600, q: 0.5 }, level: -4,
    },
    ride: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.55, sustain: 0, release: 0.3 },
      filter: { type: "bandpass", frequency: 6500, q: 0.6 }, level: -1, durationSec: 0.3,
    },
    closedHat: {
      source: "noise", noise: "pink",
      env: { attack: 0.002, decay: 0.05, sustain: 0, release: 0.02 },
      filter2: { type: "highpass", frequency: 4000 },
      filter: { type: "bandpass", frequency: 7500, q: 0.8 }, level: -2,
    },
    rim: {
      source: "tonal", baseNote: note.A5, osc: "sine",
      env: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 }, level: -6, durationSec: 0.04,
    },
  },
}

/** Orchestral / Concert — deep concert bass drum, tight field snare, timpani-ish
 *  toms, suspended-cymbal crash. */
const KIT_ORCHESTRAL: KitDef = {
  id: "orchestral",
  name: "Orchestral",
  family: "acoustic",
  description: "Concert bass drum, tight field snare, timpani toms, suspended cymbal.",
  voices: {
    kick: {
      source: "membrane", baseNote: note.G1, pitchDecay: 0.05, octaves: 4, osc: "sine",
      env: { attack: 0.002, decay: 0.55, sustain: 0, release: 0.4 }, durationSec: 0.45, level: 2,
    },
    snare: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.05 },
      filter: { type: "bandpass", frequency: 3000, q: 0.9 },
      body: {
        baseNote: note.E3, pitchDecay: 0.01, octaves: 3, type: "triangle",
        env: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.03 }, level: -6,
      }, level: 0,
    },
    loTom: {
      source: "membrane", baseNote: note.G1, pitchDecay: 0.08, octaves: 2, osc: "sine",
      env: { attack: 0.001, decay: 0.7, sustain: 0, release: 0.5 }, durationSec: 0.5,
    },
    hiTom: {
      source: "membrane", baseNote: note.C2, pitchDecay: 0.08, octaves: 2, osc: "sine",
      env: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.42 }, durationSec: 0.42,
    },
    crash: {
      source: "noise", noise: "white",
      env: { attack: 0.02, decay: 1.8, sustain: 0, release: 1.0 },
      filter: { type: "highpass", frequency: 3500 }, level: 0, durationSec: 0.8,
    },
  },
}

/** Vintage 60s — small dry combo kit: cardboard-y kick, ringy small snare, tiny
 *  splashy hats. Mono-record charm. */
const KIT_VINTAGE: KitDef = {
  id: "vintage-60s",
  name: "Vintage 60s",
  family: "acoustic",
  description: "Cardboard kick, ringy small snare, splashy hats — dry combo charm.",
  voices: {
    kick: {
      source: "membrane", baseNote: note.D2, pitchDecay: 0.02, octaves: 3, osc: "sine",
      env: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 }, durationSec: 0.14,
      filter: { type: "lowpass", frequency: 1400, q: 0.7 }, level: -1,
    },
    snare: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.05 },
      filter: { type: "bandpass", frequency: 2400, q: 0.8 },
      body: {
        baseNote: note.G3, pitchDecay: 0.01, octaves: 2, type: "triangle",
        env: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.04 }, level: -4,
      },
      filter2: { type: "lowpass", frequency: 7000, q: 0.6 }, level: -1,
    },
    closedHat: {
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
      filter: { type: "bandpass", frequency: 7000, q: 0.7 }, level: 1,
    },
  },
}

// ==================================================================== WORLD

/** Afro-Cuban — congas, timbales, cowbell, claves front-and-centre. The salsa /
 *  son percussion section. */
const KIT_AFROCUBAN: KitDef = {
  id: "afro-cuban",
  name: "Afro-Cuban",
  family: "world",
  description: "Ringing congas, sharp timbales, the bell & claves — salsa section.",
  voices: {
    conga: {
      source: "membrane", baseNote: note.E3, pitchDecay: 0.02, octaves: 2, osc: "sine",
      env: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.15 }, durationSec: 0.18, level: 1,
    },
    loTom: { // low conga / tumba
      source: "membrane", baseNote: note.A2, pitchDecay: 0.025, octaves: 2, osc: "sine",
      env: { attack: 0.001, decay: 0.38, sustain: 0, release: 0.2 }, durationSec: 0.22,
    },
    hiTom: { // quinto / high timbale
      source: "membrane", baseNote: note.A3, pitchDecay: 0.015, octaves: 2, osc: "triangle",
      env: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.1 }, durationSec: 0.14,
    },
    rim: { // cáscara / clave-stick
      source: "tonal", baseNote: note.C6, osc: "triangle",
      env: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 }, level: -2, durationSec: 0.035,
    },
    click: { // claves — bright, woody, two-tone
      source: "tonal", baseNote: note.C5, osc: "square",
      partials: [
        { frequency: 2500, type: "sine", level: -8 },
      ],
      env: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 }, level: -2, durationSec: 0.05,
    },
    cowbell: {
      source: "tonal", baseNote: 0, osc: "square",
      partials: [
        { frequency: 560, type: "square", level: -5 },
        { frequency: 845, type: "square", level: -7 },
      ],
      filter: { type: "bandpass", frequency: 2700, q: 1.4 },
      env: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.08 }, durationSec: 0.2,
    },
    shaker: { // güiro / maracas
      source: "noise", noise: "white",
      env: { attack: 0.003, decay: 0.06, sustain: 0, release: 0.03 },
      filter: { type: "bandpass", frequency: 7000, q: 1.2 }, level: 1,
    },
  },
}

/** Brazilian Batucada — samba bateria: deep surdo on the kick, snappy caixa, the
 *  tamborim, agogô bells, and a busy shaker. */
const KIT_BATUCADA: KitDef = {
  id: "batucada",
  name: "Batucada",
  family: "world",
  description: "Deep surdo, snappy caixa, tamborim & agogô — samba bateria.",
  voices: {
    kick: { // surdo
      source: "membrane", baseNote: note.G1, pitchDecay: 0.06, octaves: 3, osc: "sine",
      env: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.35 }, durationSec: 0.4, level: 3,
    },
    snare: { // caixa — tight Brazilian snare
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.04 },
      filter: { type: "bandpass", frequency: 3200, q: 0.8 },
      body: {
        baseNote: note.D3, pitchDecay: 0.01, octaves: 2, type: "triangle",
        env: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 }, level: -8,
      }, level: 0,
    },
    rim: { // tamborim
      source: "tonal", baseNote: note.E6, osc: "triangle",
      env: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 }, level: -1, durationSec: 0.035,
    },
    cowbell: { // agogô bell
      source: "tonal", baseNote: 0, osc: "square",
      partials: [
        { frequency: 700, type: "square", level: -5 },
        { frequency: 1050, type: "sine", level: -8 },
      ],
      filter: { type: "bandpass", frequency: 3000, q: 1.6 },
      env: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.06 }, durationSec: 0.16,
    },
    shaker: { // ganzá / chocalho
      source: "noise", noise: "white",
      env: { attack: 0.004, decay: 0.07, sustain: 0, release: 0.03 },
      filter: { type: "bandpass", frequency: 8000, q: 1.0 }, level: 2,
    },
    loTom: { // surdo open / repinique low
      source: "membrane", baseNote: note.A1, pitchDecay: 0.04, octaves: 2, osc: "sine",
      env: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.25 }, durationSec: 0.28,
    },
  },
}

/** Middle-Eastern — doumbek/darbuka dum & tek, riq tambourine, finger cymbals.
 *  The maqam percussion bed. */
const KIT_MIDEAST: KitDef = {
  id: "middle-eastern",
  name: "Middle Eastern",
  family: "world",
  description: "Doumbek dum & tek, riq tambourine, finger cymbals — maqam bed.",
  voices: {
    kick: { // doumbek "dum"
      source: "membrane", baseNote: note.A1, pitchDecay: 0.03, octaves: 3, osc: "sine",
      env: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.16 }, durationSec: 0.2, level: 1,
    },
    loTom: { // darbuka body
      source: "membrane", baseNote: note.D2, pitchDecay: 0.025, octaves: 2, osc: "sine",
      env: { attack: 0.001, decay: 0.26, sustain: 0, release: 0.12 }, durationSec: 0.16,
    },
    hiTom: { // doumbek "tek" — high crisp rim tone
      source: "membrane", baseNote: note.A3, pitchDecay: 0.01, octaves: 2, osc: "triangle",
      env: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.04 }, durationSec: 0.08, level: 1,
    },
    rim: { // tek slap
      source: "tonal", baseNote: note.E6, osc: "triangle",
      env: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.015 }, level: 0, durationSec: 0.03,
    },
    tamb: { // riq
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.11, sustain: 0, release: 0.04 },
      filter: { type: "bandpass", frequency: 7500, q: 1.6 }, level: 2,
    },
    closedHat: { // finger cymbals (sagat) — bright metallic ting
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.1 },
      filter: { type: "bandpass", frequency: 9500, q: 4.0 }, level: 1,
    },
    shaker: {
      source: "noise", noise: "white",
      env: { attack: 0.003, decay: 0.05, sustain: 0, release: 0.02 },
      filter: { type: "bandpass", frequency: 8500, q: 1.4 }, level: 0,
    },
  },
}

/** Indian — tabla-flavoured: bayan (bass) on the kick, dayan (high pitched-tone)
 *  on the toms, with a tight finger snap rim. */
const KIT_INDIAN: KitDef = {
  id: "tabla",
  name: "Tabla",
  family: "world",
  description: "Bayan bass thumb, pitched dayan tones, sharp finger strokes.",
  voices: {
    kick: { // bayan — bass drum with a pitch bend ("ge")
      source: "membrane", baseNote: note.A1, pitchDecay: 0.12, octaves: 3, osc: "sine",
      env: { attack: 0.001, decay: 0.34, sustain: 0, release: 0.2 }, durationSec: 0.22, level: 1,
    },
    hiTom: { // dayan "na/tin" — sharp pitched ring
      source: "membrane", baseNote: note.A3, pitchDecay: 0.008, octaves: 2, osc: "triangle",
      env: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 }, durationSec: 0.12, level: 1,
    },
    loTom: { // dayan "dha" — fuller open tone
      source: "membrane", baseNote: note.E3, pitchDecay: 0.01, octaves: 2, osc: "triangle",
      env: { attack: 0.001, decay: 0.24, sustain: 0, release: 0.12 }, durationSec: 0.16,
    },
    conga: { // tun — resonant mid tone
      source: "membrane", baseNote: note.A2, pitchDecay: 0.015, octaves: 2, osc: "sine",
      env: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.14 }, durationSec: 0.18,
    },
    rim: { // "ti/te" finger stroke
      source: "tonal", baseNote: note.C6, osc: "triangle",
      env: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.012 }, level: -1, durationSec: 0.03,
    },
    snare: { // "tira-kita" dry slap
      source: "noise", noise: "white",
      env: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.025 },
      filter: { type: "bandpass", frequency: 3500, q: 1.0 }, level: -3,
    },
  },
}

// ----------------------------------------------------------------- the corpus
/** THE CORPUS — default first, then by family in picker order. */
export const KITS: readonly KitDef[] = [
  DEFAULT_KIT,
  // electronic
  KIT_808,
  KIT_909,
  KIT_707,
  KIT_TECHNO,
  KIT_HOUSE,
  KIT_TRAP,
  KIT_LOFI,
  KIT_INDUSTRIAL,
  KIT_SYNTHWAVE,
  // acoustic (studio = DEFAULT_KIT, already first)
  KIT_ROCK,
  KIT_JAZZ,
  KIT_ORCHESTRAL,
  KIT_VINTAGE,
  // world
  KIT_AFROCUBAN,
  KIT_BATUCADA,
  KIT_MIDEAST,
  KIT_INDIAN,
]

/** Family display order for the picker. */
export const FAMILY_ORDER: readonly KitFamily[] = ["electronic", "acoustic", "world"]
