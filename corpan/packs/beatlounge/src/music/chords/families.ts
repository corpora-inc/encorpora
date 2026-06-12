/**
 * beatlounge — SYSTEMATIC corpus generators (IP-safe, theory-driven).
 *
 * Each function returns an array of CorpusProgression built from music theory:
 * cadences, turnarounds, modal vamps, blues forms, circle-of-fifths sequences,
 * secondary-dominant chains, modal interchange. We reach a rich ~1000 by
 * COVERING families systematically and spinning common loops through their
 * musically-distinct rotations and seventh-chord colourings — NOT by copying a
 * proprietary database and NOT by attaching any song/artist/album name.
 *
 * Authoring shorthand: `d(degree, quality, roman)`, `c(rootSemitone, …)`.
 */

import { c, d, prog, rotate, slug } from "./build"
import type { CorpusChord, CorpusProgression } from "./types"

// Diatonic triad qualities for the MAJOR scale by degree (I ii iii IV V vi vii°).
const MAJ_TRIAD = ["maj", "min", "min", "maj", "maj", "min", "dim"] as const
const MAJ_SEVENTH = ["maj7", "min7", "min7", "maj7", "dom7", "min7", "m7b5"] as const
const MAJ_ROMAN = ["I", "ii", "iii", "IV", "V", "vi", "vii°"] as const
const MAJ_ROMAN7 = ["Imaj7", "ii7", "iii7", "IVmaj7", "V7", "vi7", "viiø7"] as const

// Diatonic triad qualities for the NATURAL-MINOR scale (i ii° III iv v VI VII).
const MIN_TRIAD = ["min", "dim", "maj", "min", "min", "maj", "maj"] as const
const MIN_SEVENTH = ["min7", "m7b5", "maj7", "min7", "min7", "maj7", "dom7"] as const
const MIN_ROMAN = ["i", "ii°", "III", "iv", "v", "VI", "VII"] as const
const MIN_ROMAN7 = ["i7", "iiø7", "IIImaj7", "iv7", "v7", "VImaj7", "VII7"] as const

/** Major diatonic triad chord for degree (0..6). */
const majT = (deg: number): CorpusChord => d(deg, MAJ_TRIAD[deg], MAJ_ROMAN[deg])
/** Major diatonic seventh chord for degree (0..6). */
const majS = (deg: number): CorpusChord => d(deg, MAJ_SEVENTH[deg], MAJ_ROMAN7[deg])
/** Minor diatonic triad chord for degree (0..6). */
const minT = (deg: number): CorpusChord => d(deg, MIN_TRIAD[deg], MIN_ROMAN[deg])
/** Minor diatonic seventh chord for degree (0..6). */
const minS = (deg: number): CorpusChord => d(deg, MIN_SEVENTH[deg], MIN_ROMAN7[deg])

// ============================================================ 1. CADENCES
/**
 * The full set of diatonic cadences in MAJOR and MINOR, as triads and as
 * sevenths: authentic (V–I), plagal (IV–I), deceptive (V–vi), half (x–V),
 * plus pre-cadential approaches (ii–V, IV–V, ii–V–I, IV–V–I). These are the
 * grammar of common-practice harmony — pure theory, no naming.
 */
export const genCadences = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  // MAJOR cadences (triads + sevenths).
  const majCad: Array<[string, CorpusChord[], string[]]> = [
    ["authentic", [majT(4), majT(0)], ["authentic", "perfect"]],
    ["authentic7", [majS(4), majS(0)], ["authentic", "dominant7"]],
    ["plagal", [majT(3), majT(0)], ["plagal", "amen"]],
    ["plagal7", [majS(3), majS(0)], ["plagal"]],
    ["deceptive", [majT(4), majT(5)], ["deceptive", "interrupted"]],
    ["deceptive7", [majS(4), majT(5)], ["deceptive"]],
    ["half-ii", [majT(1), majT(4)], ["half", "pre-dominant"]],
    ["half-IV", [majT(3), majT(4)], ["half"]],
    ["half-vi", [majT(5), majT(4)], ["half"]],
    ["half-I", [majT(0), majT(4)], ["half"]],
    ["ii-V-I", [majT(1), majT(4), majT(0)], ["authentic", "ii-V-I"]],
    ["ii7-V7-I", [majS(1), majS(4), majS(0)], ["authentic", "ii-V-I", "jazz"]],
    ["IV-V-I", [majT(3), majT(4), majT(0)], ["authentic"]],
    ["IV-V-vi", [majT(3), majT(4), majT(5)], ["deceptive"]],
    ["I-IV-V-I", [majT(0), majT(3), majT(4), majT(0)], ["primary-triads"]],
    ["I-ii-V-I", [majT(0), majT(1), majT(4), majT(0)], ["authentic"]],
    ["IV-iv-I", [majT(3), c(5, "min", "iv"), majT(0)], ["plagal", "minor-plagal", "borrowed"]],
    ["vii-I", [majT(6), majT(0)], ["leading-tone", "authentic"]],
  ]
  for (const [name, degs, tags] of majCad) {
    out.push(prog(`cadence:maj:${name}`, degs, "major", "cadence", ["cadence", "major", ...tags], 4))
  }
  // MINOR cadences (triads + sevenths). Note V is often MAJOR (harmonic minor).
  const Vmaj = c(7, "maj", "V")
  const V7 = c(7, "dom7", "V7")
  const minCad: Array<[string, CorpusChord[], string[]]> = [
    ["authentic", [Vmaj, minT(0)], ["authentic", "perfect"]],
    ["authentic-v", [minT(4), minT(0)], ["authentic", "natural-minor"]],
    ["authentic7", [V7, minS(0)], ["authentic", "dominant7"]],
    ["plagal", [minT(3), minT(0)], ["plagal"]],
    ["deceptive", [Vmaj, minT(5)], ["deceptive"]],
    ["half", [minT(3), Vmaj], ["half", "pre-dominant"]],
    ["iiø-V-i", [minS(1), V7, minS(0)], ["authentic", "ii-V-i", "jazz", "minor-ii-V"]],
    ["iv-V-i", [minT(3), Vmaj, minT(0)], ["authentic"]],
    ["i-iv-V-i", [minT(0), minT(3), Vmaj, minT(0)], ["primary-triads"]],
    ["bVI-V-i", [minT(5), Vmaj, minT(0)], ["authentic", "borrowed"]],
    ["bII-V-i", [c(1, "maj", "bII"), V7, minS(0)], ["authentic", "neapolitan"]],
  ]
  for (const [name, degs, tags] of minCad) {
    out.push(prog(`cadence:min:${name}`, degs, "minor", "cadence", ["cadence", "minor", ...tags], 4))
  }
  return out
}

// ============================================================ 2. POP LOOPS
/**
 * The canonical 4-chord pop/rock loops, each spun through its 4 rotations
 * (every rotation is a genuinely common loop) and offered as triads and as
 * added-colour (sus/7) variants. Key-agnostic Roman numerals only.
 */
export const genPopLoops = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  // Each base is a [degree, quality, roman] in MAJOR unless a chromatic root.
  const bases: Array<[string, CorpusChord[]]> = [
    ["axis", [majT(0), majT(4), majT(5), majT(3)]], // I V vi IV
    ["sensitive", [majT(5), majT(3), majT(0), majT(4)]], // vi IV I V
    ["four-chord-a", [majT(0), majT(5), majT(3), majT(4)]], // I vi IV V (also doo-wop)
    ["four-chord-b", [majT(0), majT(3), majT(5), majT(4)]], // I IV vi V
    ["royal", [majT(0), majT(4), majT(3), majT(4)]], // I V IV V
    ["mixiv", [majT(0), majT(4), majT(1), majT(3)]], // I V ii IV
    ["soft", [majT(0), majT(2), majT(3), majT(4)]], // I iii IV V
    ["mellow", [majT(0), majT(3), majT(1), majT(4)]], // I IV ii V
    ["ascending", [majT(0), majT(1), majT(2), majT(3)]], // I ii iii IV
    ["plagal-pop", [majT(0), majT(3), majT(0), majT(3)]], // I IV I IV vamp
    ["six-four-one-five", [majT(5), majT(3), majT(0), majT(4)]], // vi IV I V
    ["one-five-four", [majT(0), majT(4), majT(3), majT(0)]], // I V IV I
  ]
  for (const [name, base] of bases) {
    for (let r = 0; r < 4; r++) {
      const degs = rotate(base, r)
      out.push(
        prog(
          `pop-loop:${name}:rot${r}:${slug(degs)}`,
          degs,
          "major",
          "pop-loop",
          ["pop", "loop", "4-chord", name, ...(r ? ["rotation"] : [])],
          4
        )
      )
    }
  }
  return out
}

// ============================================================ 3. DOO-WOP
/**
 * The 50s "doo-wop" family: I–vi–IV–V and I–vi–ii–V and their rotations and
 * seventh colourings. A staple common-practice loop — theory, not a song.
 */
export const genDooWop = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  const bases: Array<[string, CorpusChord[]]> = [
    ["classic", [majT(0), majT(5), majT(3), majT(4)]], // I vi IV V
    ["ii-variant", [majT(0), majT(5), majT(1), majT(4)]], // I vi ii V
    ["iii-variant", [majT(0), majT(5), majT(1), majS(4)]], // I vi ii V7
    ["minor-iv", [majT(0), majT(5), c(5, "min", "iv"), majT(4)]], // I vi iv V
  ]
  for (const [name, base] of bases) {
    for (let r = 0; r < 4; r++) {
      const degs = rotate(base, r)
      out.push(
        prog(
          `doo-wop:${name}:rot${r}:${slug(degs)}`,
          degs,
          "major",
          "doo-wop",
          ["doo-wop", "50s", name, ...(r ? ["rotation"] : [])],
          4
        )
      )
    }
  }
  // Eight-bar doo-wop (each chord 2 beats, two laps) as long-form variants.
  out.push(
    prog(
      "doo-wop:eightbar:I-vi-IV-V",
      [majT(0), majT(5), majT(3), majT(4), majT(0), majT(5), majT(3), majT(4)],
      "major",
      "doo-wop",
      ["doo-wop", "50s", "8-bar"],
      4
    )
  )
  return out
}

// ============================================================ 4. JAZZ TURNAROUNDS
/**
 * ii–V–I in major and minor, the standard I–vi–ii–V turnaround and its many
 * substitutions: tritone subs, backdoor ii–V, secondary-dominant turnarounds,
 * and a Coltrane-style major-third cycle. All key-agnostic theory.
 */
export const genJazzTurnarounds = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  const I = majS(0)
  const vi = majS(5)
  const ii = majS(1)
  const V = majS(4)
  const iii = majS(2)
  const VI7 = c(9, "dom7", "VI7")
  const II7 = c(2, "dom7", "II7")
  const III7 = c(4, "dom7", "III7")
  const bII7 = c(1, "dom7", "bII7") // tritone sub of V
  const subII7 = c(8, "dom7", "bVI7") // tritone sub of II7
  const bVII7 = c(10, "dom7", "bVII7") // backdoor dominant

  const turns: Array<[string, CorpusChord[], string[]]> = [
    ["ii-V-I", [ii, V, I], ["ii-V-I", "turnaround"]],
    ["I-vi-ii-V", [I, vi, ii, V], ["turnaround", "rhythm-changes"]],
    ["I-VI7-ii-V", [I, VI7, ii, V], ["turnaround", "secondary-dominant"]],
    ["iii-VI7-ii-V", [iii, VI7, ii, V], ["turnaround"]],
    ["I-bII7-I", [I, bII7, I], ["tritone-sub", "turnaround"]],
    ["ii-bII7-I", [ii, bII7, I], ["tritone-sub", "ii-V-I"]],
    ["I-VI7-II7-V", [I, VI7, II7, V], ["turnaround", "secondary-dominant", "ragtime"]],
    ["backdoor", [ii, bVII7, I], ["backdoor", "ii-V-I"]],
    ["iv-bVII7-I", [c(5, "min7", "iv7"), bVII7, I], ["backdoor", "modal-interchange"]],
    ["I-III7-vi-II7-ii-V", [I, III7, vi, II7, ii, V], ["turnaround", "secondary-dominant"]],
    ["I-subII7-ii-V", [I, subII7, ii, V], ["tritone-sub", "turnaround"]],
    ["coltrane-cycle", [I, c(8, "dom7", "bVI7"), c(8, "maj7", "bVImaj7"), c(4, "dom7", "III7"), c(4, "maj7", "IIImaj7"), V, I], ["coltrane", "major-thirds", "cycle"]],
    ["rhythm-A", [I, vi, ii, V, iii, VI7, ii, V], ["rhythm-changes", "A-section", "turnaround"]],
    ["long-turnaround", [I, c(8, "dom7", "bVI7"), c(3, "dom7", "bIII7"), c(10, "dom7", "bVII7")], ["tritone-sub", "chromatic", "turnaround"]],
  ]
  for (const [name, degs, tags] of turns) {
    out.push(prog(`jazz-turnaround:maj:${name}`, degs, "major", "jazz-turnaround", ["jazz", ...tags], 4))
  }
  // MINOR ii–V–i family.
  const iiø = minS(1)
  const V7m = c(7, "dom7", "V7")
  const im = minS(0)
  const minTurns: Array<[string, CorpusChord[], string[]]> = [
    ["iiø-V-i", [iiø, V7m, im], ["minor-ii-V", "ii-V-i", "turnaround"]],
    ["i-VI7-iiø-V", [im, c(9, "dom7", "VI7"), iiø, V7m], ["turnaround"]],
    ["iiø-bII7-i", [iiø, c(1, "dom7", "bII7"), im], ["tritone-sub", "minor-ii-V"]],
    ["i-iv-bVII-III", [im, minS(3), c(10, "dom7", "bVII7"), majS(2)], ["minor", "modal"]],
  ]
  for (const [name, degs, tags] of minTurns) {
    out.push(prog(`jazz-turnaround:min:${name}`, degs, "minor", "jazz-turnaround", ["jazz", "minor", ...tags], 4))
  }
  return out
}

// ============================================================ 5. BLUES
/**
 * 12-bar and 8-bar blues forms in several common harmonizations, plus a minor
 * blues. Beats are PER-BAR (4 beats/bar) so the form is literally 48 beats for
 * 12 bars. Forms are universal common-practice — no song/artist naming.
 */
export const genBlues = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  const I7 = c(0, "dom7", "I7")
  const IV7 = c(5, "dom7", "IV7")
  const V7 = c(7, "dom7", "V7")
  const I9 = c(0, "dom9", "I9")
  const IV9 = c(5, "dom9", "IV9")
  const ii = majS(1)
  const VI7 = c(9, "dom7", "VI7")
  const bVII7 = c(10, "dom7", "bVII7")

  // 12-bar: one chord per bar, 4 beats each.
  const twelveBar: Array<[string, CorpusChord[], string[]]> = [
    ["basic", [I7, I7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, V7], ["blues-12bar", "shuffle"]],
    ["quick-change", [I7, IV7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, V7], ["blues-12bar", "quick-change"]],
    ["jazz", [I7, IV7, I7, c(7, "min7", "v7"), IV7, c(6, "dim7", "#IVdim7"), I7, VI7, ii, V7, I7, V7], ["blues-12bar", "jazz-blues"]],
    ["bird", [I7, c(9, "min7", "vi7"), c(2, "min7", "ii7"), V7, IV7, c(8, "dom7", "bVI7"), c(2, "min7", "ii7"), V7, c(2, "min7", "ii7"), c(7, "min7", "v7"), I7, V7], ["blues-12bar", "bebop-blues"]],
    ["turnaround-end", [I7, IV7, I7, I7, IV7, IV7, I7, VI7, ii, V7, I7, bVII7], ["blues-12bar"]],
    ["nine-chord", [I9, IV9, I9, I9, IV9, IV9, I9, I9, V7, IV9, I9, V7], ["blues-12bar", "ninth"]],
  ]
  for (const [name, degs, tags] of twelveBar) {
    out.push(prog(`blues:12bar:${name}`, degs, "mixolydian", "blues", ["blues", ...tags], 4))
  }
  // 8-bar blues.
  out.push(prog("blues:8bar:basic", [I7, V7, IV7, IV7, I7, V7, I7, V7], "mixolydian", "blues", ["blues", "blues-8bar"], 4))
  out.push(prog("blues:8bar:alt", [I7, I7, IV7, IV7, I7, V7, I7, I7], "mixolydian", "blues", ["blues", "blues-8bar"], 4))
  // Minor 12-bar blues.
  const i7 = c(0, "min7", "i7")
  const iv7 = c(5, "min7", "iv7")
  const v7m = c(7, "dom7", "V7")
  out.push(
    prog(
      "blues:12bar:minor",
      [i7, i7, i7, i7, iv7, iv7, i7, i7, c(8, "maj7", "bVImaj7"), v7m, i7, v7m],
      "minor",
      "blues",
      ["blues", "blues-12bar", "minor-blues"],
      4
    )
  )
  return out
}

// ============================================================ 6. MODAL VAMPS
/**
 * Two-, three-, and four-chord vamps that establish a MODE: Dorian (i–IV),
 * Mixolydian (I–bVII), Phrygian (i–bII), Aeolian (i–bVI–bVII). The corpus's
 * modal backbone. Mode is carried explicitly so degrees resolve correctly.
 */
export const genModalVamps = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  type V = { id: string; degs: CorpusChord[]; mode: CorpusProgression["mode"]; tags: string[] }
  const vamps: V[] = [
    // Dorian (minor tonic with a MAJOR IV).
    { id: "dorian:i-IV", degs: [d(0, "min", "i"), c(5, "maj", "IV")], mode: "dorian", tags: ["modal", "dorian", "vamp"] },
    { id: "dorian:i7-IV", degs: [d(0, "min7", "i7"), c(5, "dom7", "IV7")], mode: "dorian", tags: ["modal", "dorian", "vamp"] },
    { id: "dorian:i-IV-v-i", degs: [d(0, "min", "i"), c(5, "maj", "IV"), d(4, "min", "v"), d(0, "min", "i")], mode: "dorian", tags: ["modal", "dorian"] },
    { id: "dorian:i-ii-IV", degs: [d(0, "min", "i"), d(1, "min", "ii"), c(5, "maj", "IV")], mode: "dorian", tags: ["modal", "dorian"] },
    // Mixolydian (major tonic with a bVII).
    { id: "mixolydian:I-bVII", degs: [d(0, "maj", "I"), c(10, "maj", "bVII")], mode: "mixolydian", tags: ["modal", "mixolydian", "vamp"] },
    { id: "mixolydian:I-bVII-IV", degs: [d(0, "maj", "I"), c(10, "maj", "bVII"), c(5, "maj", "IV")], mode: "mixolydian", tags: ["modal", "mixolydian", "double-plagal"] },
    { id: "mixolydian:I-v-bVII-IV", degs: [d(0, "maj", "I"), d(4, "min", "v"), c(10, "maj", "bVII"), c(5, "maj", "IV")], mode: "mixolydian", tags: ["modal", "mixolydian"] },
    { id: "mixolydian:I7-bVII", degs: [d(0, "dom7", "I7"), c(10, "dom7", "bVII7")], mode: "mixolydian", tags: ["modal", "mixolydian"] },
    // Phrygian (minor tonic with a bII).
    { id: "phrygian:i-bII", degs: [d(0, "min", "i"), c(1, "maj", "bII")], mode: "phrygian", tags: ["modal", "phrygian", "vamp"] },
    { id: "phrygian:i-bII-i-bvii", degs: [d(0, "min", "i"), c(1, "maj", "bII"), d(0, "min", "i"), c(10, "min", "bvii")], mode: "phrygian", tags: ["modal", "phrygian"] },
    { id: "phrygian:i-bvii-bVI-bII", degs: [d(0, "min", "i"), c(10, "min", "bvii"), c(8, "maj", "bVI"), c(1, "maj", "bII")], mode: "phrygian", tags: ["modal", "phrygian"] },
    // Aeolian / natural minor vamps.
    { id: "aeolian:i-bVI-bVII", degs: [d(0, "min", "i"), c(8, "maj", "bVI"), c(10, "maj", "bVII")], mode: "aeolian", tags: ["modal", "aeolian", "vamp"] },
    { id: "aeolian:i-bVI-bIII-bVII", degs: [d(0, "min", "i"), c(8, "maj", "bVI"), c(3, "maj", "bIII"), c(10, "maj", "bVII")], mode: "aeolian", tags: ["modal", "aeolian", "epic"] },
    { id: "aeolian:i-bVII-bVI-bVII", degs: [d(0, "min", "i"), c(10, "maj", "bVII"), c(8, "maj", "bVI"), c(10, "maj", "bVII")], mode: "aeolian", tags: ["modal", "aeolian"] },
    { id: "aeolian:i-iv-bVII-bIII", degs: [d(0, "min", "i"), d(3, "min", "iv"), c(10, "maj", "bVII"), c(3, "maj", "bIII")], mode: "aeolian", tags: ["modal", "aeolian"] },
    { id: "aeolian:i-bVII-bVI-V", degs: [d(0, "min", "i"), c(10, "maj", "bVII"), c(8, "maj", "bVI"), c(7, "maj", "V")], mode: "aeolian", tags: ["modal", "aeolian", "andalusian"] },
    // Lydian (major tonic with a #IV / II major).
    { id: "lydian:I-II", degs: [d(0, "maj", "I"), c(2, "maj", "II")], mode: "lydian", tags: ["modal", "lydian", "vamp"] },
    { id: "lydian:I-II-V", degs: [d(0, "maj", "I"), c(2, "maj", "II"), d(4, "maj", "V")], mode: "lydian", tags: ["modal", "lydian"] },
  ]
  for (const v of vamps) {
    out.push(prog(`modal-vamp:${v.id}`, v.degs, v.mode, "modal-vamp", v.tags, 4))
  }
  return out
}

// ============================================================ 7. CIRCLE OF FIFTHS
/**
 * Descending-fifths sequences (the strongest root motion in tonal harmony):
 * diatonic circles of varying length in major and minor, as triads and
 * sevenths. Generated by stepping down a fifth (up a fourth) through the
 * diatonic degrees. Pure theory.
 */
export const genCircleOfFifths = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  // Degree order of a full diatonic descending-fifths cycle from I:
  // I IV vii iii vi ii V I  (each a fifth below the last, mod 7).
  const order = [0, 3, 6, 2, 5, 1, 4, 0]
  for (let len = 3; len <= 8; len++) {
    const degsT: CorpusChord[] = order.slice(0, len).map((deg) => majT(deg))
    const degsS: CorpusChord[] = order.slice(0, len).map((deg) => majS(deg))
    out.push(prog(`circle-of-fifths:maj:triads:len${len}`, degsT, "major", "circle-of-fifths", ["circle-of-fifths", "sequence", "major", "descending-fifths"], 4))
    out.push(prog(`circle-of-fifths:maj:sevenths:len${len}`, degsS, "major", "circle-of-fifths", ["circle-of-fifths", "sequence", "major", "sevenths"], 4))
  }
  // Minor descending-fifths (i iv VII III VI ii° V i).
  const minOrder = [0, 3, 6, 2, 5, 1, 4, 0]
  for (let len = 3; len <= 8; len++) {
    const degsT: CorpusChord[] = minOrder.slice(0, len).map((deg) => minT(deg))
    out.push(prog(`circle-of-fifths:min:triads:len${len}`, degsT, "minor", "circle-of-fifths", ["circle-of-fifths", "sequence", "minor", "descending-fifths"], 4))
  }
  return out
}

// ============================================================ 8. SECONDARY DOMINANTS
/**
 * V-of-x chains: each diatonic chord tonicized by its own dominant. We generate
 * the standard "V/x → x" pairs and the chained "V/V → V → I" forms. These are
 * generic functional harmony, no naming.
 */
export const genSecondaryDominants = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  // Targets in MAJOR and the semitone of their dominant's root (a fifth above).
  const targets: Array<[string, CorpusChord, number]> = [
    ["ii", majS(1), 9], // V/ii root = A (9) in C
    ["iii", majS(2), 11], // V/iii root = B (11)
    ["IV", majS(3), 0], // V/IV root = C (0)
    ["V", majS(4), 2], // V/V root = D (2)
    ["vi", majS(5), 4], // V/vi root = E (4)
  ]
  for (const [name, target, vroot] of targets) {
    const secV = c(vroot, "dom7", `V7/${name}`)
    out.push(prog(`secondary-dominant:V7-of-${name}`, [secV, target], "major", "secondary-dominant", ["secondary-dominant", "tonicization", name], 4))
  }
  // Chained tonicizations resolving home.
  out.push(prog("secondary-dominant:V7-V7-I", [c(2, "dom7", "V7/V"), majS(4), majS(0)], "major", "secondary-dominant", ["secondary-dominant", "chain", "V-of-V"], 4))
  out.push(prog("secondary-dominant:VI7-II7-V7-I", [c(9, "dom7", "V7/ii"), c(2, "dom7", "V7/V"), majS(4), majS(0)], "major", "secondary-dominant", ["secondary-dominant", "chain", "ragtime"], 4))
  out.push(prog("secondary-dominant:I-V7ofIV-IV", [majS(0), c(0, "dom7", "V7/IV"), majS(3)], "major", "secondary-dominant", ["secondary-dominant", "tonicization"], 4))
  out.push(prog("secondary-dominant:I-VI7-ii-V7-I", [majS(0), c(9, "dom7", "V7/ii"), majS(1), majS(4), majS(0)], "major", "secondary-dominant", ["secondary-dominant", "turnaround"], 4))
  out.push(prog("secondary-dominant:I-III7-vi-II7-ii-V7-I", [majS(0), c(4, "dom7", "V7/vi"), majS(5), c(2, "dom7", "V7/V"), majS(1), majS(4), majS(0)], "major", "secondary-dominant", ["secondary-dominant", "chain"], 4))
  return out
}

// ============================================================ 9. MODAL INTERCHANGE
/**
 * Borrowed-chord progressions: major-key tonic borrowing from the parallel
 * minor (bVII, bVI, bIII, iv, iiø, bII Neapolitan), and the reverse. Generic
 * harmonic devices, key-agnostic.
 */
export const genModalInterchange = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  const I = majT(0)
  const set: Array<[string, CorpusChord[], string[]]> = [
    ["I-bVII-IV", [I, c(10, "maj", "bVII"), majT(3)], ["borrowed", "bVII"]],
    ["I-bVI-bVII-I", [I, c(8, "maj", "bVI"), c(10, "maj", "bVII"), I], ["borrowed", "bVI", "bVII"]],
    ["I-iv-I", [I, c(5, "min", "iv"), I], ["borrowed", "minor-iv", "minor-plagal"]],
    ["I-bIII-bVII-IV", [I, c(3, "maj", "bIII"), c(10, "maj", "bVII"), majT(3)], ["borrowed", "bIII"]],
    ["I-IV-iv-I", [I, majT(3), c(5, "min", "iv"), I], ["borrowed", "minor-plagal"]],
    ["I-iiø-V-I", [I, d(1, "m7b5", "iiø7"), majS(4), majS(0)], ["borrowed", "iiø"]],
    ["I-bII-I", [I, c(1, "maj", "bII"), I], ["borrowed", "neapolitan"]],
    ["I-V-bVI-bVII", [I, majT(4), c(8, "maj", "bVI"), c(10, "maj", "bVII")], ["borrowed", "bVI", "bVII"]],
    ["I-bVII-bVI-V", [I, c(10, "maj", "bVII"), c(8, "maj", "bVI"), majT(4)], ["borrowed", "descending"]],
    ["I-v-bVI-IV", [I, d(4, "min", "v"), c(8, "maj", "bVI"), majT(3)], ["borrowed", "minor-v"]],
    ["I-bIII-IV-I", [I, c(3, "maj", "bIII"), majT(3), I], ["borrowed", "bIII"]],
  ]
  for (const [name, degs, tags] of set) {
    out.push(prog(`modal-interchange:${name}`, degs, "major", "modal-interchange", ["modal-interchange", ...tags], 4))
  }
  return out
}

// ============================================================ 10. FOLK
/**
 * Folk / singer-songwriter diatonic patterns: primary-triad strums, I–IV–V
 * variants, capo-friendly loops, and the descending I–V/7–vi line. Triadic,
 * diatonic, generic.
 */
export const genFolk = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  const set: Array<[string, CorpusChord[]]> = [
    ["I-IV-V", [majT(0), majT(3), majT(4)]],
    ["I-IV-V-IV", [majT(0), majT(3), majT(4), majT(3)]],
    ["I-V-IV", [majT(0), majT(4), majT(3)]],
    ["I-IV-I-V", [majT(0), majT(3), majT(0), majT(4)]],
    ["I-vi-IV-V", [majT(0), majT(5), majT(3), majT(4)]],
    ["I-V-vi-iii-IV", [majT(0), majT(4), majT(5), majT(2), majT(3)]],
    ["I-iii-vi-IV", [majT(0), majT(2), majT(5), majT(3)]],
    ["I-V6-vi", [majT(0), d(4, "maj", "V/7", 1), majT(5)]], // descending bass line
    ["I-IV-vi-V", [majT(0), majT(3), majT(5), majT(4)]],
    ["ii-IV-I-V", [majT(1), majT(3), majT(0), majT(4)]],
    ["I-IV-ii-V", [majT(0), majT(3), majT(1), majT(4)]],
  ]
  for (const [name, degs] of set) {
    out.push(prog(`folk:${name}`, degs, "major", "folk", ["folk", "diatonic", "acoustic"], 4))
  }
  return out
}

// ============================================================ 11. GOSPEL
/**
 * Gospel colour: the 6–2–5–1 cycle, plagal "amen" with passing dim, and richly
 * extended ii–V–I with added 9/13. Generic harmonic devices.
 */
export const genGospel = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  const set: Array<[string, CorpusChord[], string[]]> = [
    ["vi-ii-V-I", [majS(5), majS(1), majS(4), majS(0)], ["6-2-5-1", "cycle"]],
    ["I-III7-vi-ii-V-I", [majS(0), c(4, "dom7", "III7"), majS(5), majS(1), majS(4), majS(0)], ["gospel", "secondary-dominant"]],
    ["IV-iv-I", [majT(3), c(5, "min", "iv"), majT(0)], ["amen", "minor-plagal"]],
    ["IV-#IVdim-I", [majT(3), c(6, "dim7", "#IVdim7"), majT(0)], ["passing-diminished", "amen"]],
    ["I-IV-#IVdim-I-VI7-ii-V", [majT(0), majT(3), c(6, "dim7", "#IVdim7"), majT(0), c(9, "dom7", "VI7"), majS(1), majS(4)], ["gospel", "passing-diminished"]],
    ["ii9-V13-Imaj9", [d(1, "min9", "ii9"), c(7, "dom13", "V13"), d(0, "maj9", "Imaj9")], ["gospel", "extended", "ii-V-I"]],
    ["I-vi-IV-iv", [majT(0), majT(5), majT(3), c(5, "min", "iv")], ["gospel", "borrowed"]],
  ]
  for (const [name, degs, tags] of set) {
    out.push(prog(`gospel:${name}`, degs, "major", "gospel", ["gospel", ...tags], 4))
  }
  return out
}

// ============================================================ 12. LATIN / BOSSA
/**
 * Bossa nova / Latin: minor ii–V vamps, the descending-bass bossa turnaround,
 * and montuno-style I–IV–V cycles. Extended chords, generic forms.
 */
export const genLatin = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  const set: Array<[string, CorpusChord[], CorpusProgression["mode"], string[]]> = [
    ["bossa:Imaj7-II7-iiø-V7", [majS(0), c(2, "dom7", "II7"), minS(1), c(7, "dom7", "V7")], "major", ["bossa", "latin"]],
    ["bossa:i-iiø-V7-i", [c(0, "min", "i"), minS(1), c(7, "dom7", "V7"), c(0, "min", "i")], "minor", ["bossa", "latin", "minor"]],
    ["bossa:Imaj7-vi7-ii7-V7", [majS(0), majS(5), majS(1), majS(4)], "major", ["bossa", "latin", "turnaround"]],
    ["bossa:descending", [majS(0), c(11, "dom7", "VII7"), majS(5), c(9, "dom7", "VI7")], "major", ["bossa", "latin", "descending"]],
    ["montuno:I-IV-V-IV", [majT(0), majT(3), majT(4), majT(3)], "major", ["latin", "montuno", "salsa"]],
    ["montuno:i-iv-V", [c(0, "min", "i"), c(5, "min", "iv"), c(7, "maj", "V")], "minor", ["latin", "montuno", "minor"]],
    ["latin:ii-V-I-VI7", [majS(1), majS(4), majS(0), c(9, "dom7", "VI7")], "major", ["latin", "turnaround"]],
  ]
  for (const [name, degs, mode, tags] of set) {
    out.push(prog(`latin:${name}`, degs, mode, "latin", ["latin", ...tags], 4))
  }
  return out
}

// ============================================================ 13. POP-PUNK
/**
 * Pop-punk energy: the I–V–vi–IV "anthem" and its rotations as POWER chords,
 * plus minor-key drive loops. Power chords carry no third (quality "five"),
 * which is exactly the genre's voicing.
 */
export const genPopPunk = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  // Anthem in power chords, all 4 rotations.
  const anthem = [c(0, "five", "I5"), c(7, "five", "V5"), c(9, "five", "vi5"), c(5, "five", "IV5")]
  for (let r = 0; r < 4; r++) {
    const degs = rotate(anthem, r)
    out.push(prog(`pop-punk:anthem5:rot${r}`, degs, "major", "pop-punk", ["pop-punk", "power-chords", "anthem", ...(r ? ["rotation"] : [])], 4))
  }
  const more: Array<[string, CorpusChord[], CorpusProgression["mode"], string[]]> = [
    ["I-IV-V-power", [c(0, "five", "I5"), c(5, "five", "IV5"), c(7, "five", "V5")], "major", ["pop-punk", "power-chords"]],
    ["vi-IV-I-V-power", [c(9, "five", "vi5"), c(5, "five", "IV5"), c(0, "five", "I5"), c(7, "five", "V5")], "major", ["pop-punk", "power-chords"]],
    ["i-bVI-bIII-bVII", [c(0, "five", "i5"), c(8, "five", "bVI5"), c(3, "five", "bIII5"), c(10, "five", "bVII5")], "minor", ["pop-punk", "power-chords", "minor"]],
    ["I-V-vi-IV-triads", [majT(0), majT(4), majT(5), majT(3)], "major", ["pop-punk", "anthem"]],
    ["i-bVII-bVI-bVII-power", [c(0, "five", "i5"), c(10, "five", "bVII5"), c(8, "five", "bVI5"), c(10, "five", "bVII5")], "minor", ["pop-punk", "power-chords", "minor"]],
  ]
  for (const [name, degs, mode, tags] of more) {
    out.push(prog(`pop-punk:${name}`, degs, mode, "pop-punk", tags, 4))
  }
  return out
}

// ============================================================ 14. EDM
/**
 * Loop-based EDM: minor four-chord drops and their rotations, sustained 8-beat
 * builds, and sus-flavoured anthemic loops. Modal/minor, generic.
 */
export const genEdm = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  const bases: Array<[string, CorpusChord[], CorpusProgression["mode"]]> = [
    ["minor-drop", [d(0, "min", "i"), c(8, "maj", "bVI"), c(3, "maj", "bIII"), c(10, "maj", "bVII")], "aeolian"],
    ["i-bVII-bVI", [d(0, "min", "i"), c(10, "maj", "bVII"), c(8, "maj", "bVI")], "aeolian"],
    ["vi-IV-I-V", [majT(5), majT(3), majT(0), majT(4)], "major"],
    ["i-bVI-bVII-v", [d(0, "min", "i"), c(8, "maj", "bVI"), c(10, "maj", "bVII"), d(4, "min", "v")], "aeolian"],
    ["sus-anthem", [d(0, "sus2", "Isus2"), c(8, "maj", "bVI"), c(3, "maj", "bIII"), c(10, "sus4", "bVIIsus4")], "aeolian"],
  ]
  for (const [name, base, mode] of bases) {
    out.push(prog(`edm:${name}`, base, mode, "edm", ["edm", "loop", "drop"], 4))
    // Each 4-chord drop also offered in its rotations.
    if (base.length === 4) {
      for (let r = 1; r < 4; r++) {
        const degs = rotate(base, r)
        out.push(prog(`edm:${name}:rot${r}`, degs, mode, "edm", ["edm", "loop", "drop", "rotation"], 4))
      }
    }
  }
  return out
}

// ============================================================ 15. ANDALUSIAN
/**
 * The Andalusian (Phrygian) descending tetrachord i–bVII–bVI–V and its
 * harmonizations, plus the related minor descending-bass line. A canonical
 * flamenco/Spanish device — pure theory, no song naming.
 */
export const genAndalusian = (): CorpusProgression[] => {
  const out: CorpusProgression[] = []
  const i = d(0, "min", "i")
  const bVII = c(10, "maj", "bVII")
  const bVI = c(8, "maj", "bVI")
  const V = c(7, "maj", "V")
  const set: Array<[string, CorpusChord[], string[]]> = [
    ["i-bVII-bVI-V", [i, bVII, bVI, V], ["andalusian", "phrygian-cadence", "flamenco"]],
    ["i-bVII-bVI-V7", [i, bVII, bVI, c(7, "dom7", "V7")], ["andalusian", "flamenco"]],
    ["sevenths", [d(0, "min7", "i7"), c(10, "dom7", "bVII7"), c(8, "maj7", "bVImaj7"), c(7, "dom7", "V7")], ["andalusian", "jazz-flamenco"]],
    ["extended-loop", [i, bVII, bVI, V, i, bVII, bVI, V], ["andalusian", "vamp"]],
    ["with-bII", [i, bVII, bVI, c(1, "maj", "bII")], ["andalusian", "phrygian", "neapolitan"]],
  ]
  for (const [name, degs, tags] of set) {
    out.push(prog(`andalusian:${name}`, degs, "phrygian", "andalusian", ["andalusian", ...tags], 4))
  }
  return out
}
