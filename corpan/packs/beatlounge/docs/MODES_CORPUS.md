# beatlounge — World-Modes Corpus + Exact Pitch Math

The canonical pitch foundation other modules consume. Two parts:

1. **`src/music/tuning.ts`** — exact cents / ratio / frequency math (pure,
   dependency-free, tested against textbook values).
2. **`src/music/modes/`** — the comprehensive modes corpus (Western, Hindustani
   thaats, Carnatic melakartas, Arabic maqam) as exact cents-above-tonic.

This is **new canonical data**. It deliberately does **not** touch the three
pre-existing divergent scale tables (`harmony.ts`, `ribbonScales.ts`,
`pitch-roll/pitchModel.ts`) — a later harmony-integration round reconciles those
onto this corpus. See `HARMONY_VISION.md` for the architecture this builds toward.

---

## Pitch representation (authoritative)

**Internal pitch = cents-above-tonic, as a REAL (float) number.** This is
effectively "1200-TET granularity" but **lossless**: each cents value is computed
from the EXACT ratio (`cents = 1200 · log2(ratio)`) and stored as a float, so a
Pythagorean 81/64 third or a just 5/4 third is exact to float precision — not
rounded to an integer cent. 12-TET is simply the special case where every value
is a multiple of 100.

MIDI authoring is preserved: `NoteEvent.pitch: Midi` stays the stored/edited
value. The math **detunes at the edge** — see the MIDI→mode bridge below.

### The four load-bearing formulas

```
ratio → cents:            cents = 1200 · log2(ratio)
cents → freq:             freq  = ref · 2^(cents / 1200)
freq  → cents-above-ref:  cents = 1200 · log2(freq / ref)
12-TET semitones → freq:  freq  = ref · 2^(semitones / 12)
```

Reference defaults to `{ hz: 440, midi: 69 }` (A4 = 440) but is configurable
(Baroque A4 = 415, drone-anchored raga/maqam sessions, …).

### Key functions (`tuning.ts`)

| Function | Purpose |
| --- | --- |
| `centsFromRatio(n, d)` / `centsFromRatio(ratio)` | exact cents of a ratio |
| `ratioToCents`, `centsToRatio`, `centsToRatioApprox` | ratio ↔ cents (approx = continued-fraction rationalization) |
| `freqFromCents`, `centsBetween` | frequency ↔ cents |
| `midiToFreq`, `freqToMidi` | reference-aware 12-TET MIDI ↔ Hz (fractional MIDI = microtonal) |
| `equal12` / `pythagorean` / `just` (`TuningSystem`) | tuning as a first-class axis: degree → cents |
| `quantizeToScale(cents, mode)` | snap a continuous pitch onto the nearest mode degree (fret/lock) |
| **`detuneCentsForMidi(midi, mode, tuning, tonicMidi)`** | **the MIDI→mode detune bridge** |
| `freqForMidiInMode(...)` | compose the bridge → exact Hz (the audio edge calls this) |

### The MIDI → maqam detune bridge

`detuneCentsForMidi` is the headline. Given a played **12-TET MIDI note**, the
active `mode` (cents-from-tonic degree set), the `tuning` to intonate it in, and
the tonic MIDI, it returns the **cents offset** to apply so the note lands on the
mode's exact pitch. THIS is what detunes a MIDI piano in real time to maqam:

```
play MIDI E (64) over tonic C (60) in maqam Rast (neutral 3rd = 355¢)
  → 12-TET 400¢ → snap to Rast's 355¢ degree → detune = −45¢
```

In pure 12-TET (`equal12` + a 100¢-multiple mode) the delta is **0** and the
integer authoring path is untouched. `freqForMidiInMode` composes this with
`midiToFreq` to yield the exact playback frequency.

### Verified textbook values (in `tuning.test.ts`)

| Interval | Value |
| --- | --- |
| Octave 2/1 | 1200.000¢ |
| Perfect fifth 3/2 | 701.955¢ |
| Just major third 5/4 | 386.314¢ |
| Pythagorean major third 81/64 | 407.820¢ |
| 12-TET semitone | 100.000¢ |
| Pythagorean comma (3¹²/2¹⁹) | 23.460¢ |
| Syntonic comma (81/80) | 21.506¢ |

---

## The modes corpus (`src/music/modes/`)

### Schema (`types.ts`)

```ts
interface ModeDegree { cents: number; label: string; ratio?: { num; den } }
interface Mode {
  id: string                 // "western.dorian", "thaat.bhairav", "melakarta.15", "maqam.rast"
  name: string
  family: "western" | "thaat" | "melakarta" | "maqam"
  degrees: ModeDegree[]      // ascending cents-above-tonic, one octave, degrees[0]=0¢, octave (1200) excluded
  aliases?, ajnas?, melakartaNumber?, notes?
}
```

Index (`index.ts`): `ALL_MODES`, `MODES_BY_FAMILY`, `MODE_BY_ID`, `getMode(id)`,
`findMode(idOrAliasOrName)`, `toModeCents(mode)` (projection into the
`tuning.ts` `ModeCents` shape), `CORPUS_COUNTS`.

### Coverage

| Family | Count | Notes |
| --- | --- | --- |
| **Western** | 19 | 7 diatonic modes, harmonic + melodic minor (+ Phrygian-dominant / Lydian-dominant / Altered modes), major/minor pentatonic, blues, whole-tone, octatonic H-W + W-H, chromatic. All 12-TET. |
| **Hindustani thaats** | 10 | Bilawal, Khamaj, Kafi, Asavari, Bhairav, Bhairavi, Todi, Purvi, Marwa, Kalyan. 12-TET default; each svara also carries its just/shruti ratio (optional alternate tuning via `THAAT_SHRUTI`). |
| **Carnatic melakartas** | 72 | The full combinatorial system, derived programmatically (lower Ri/Ga pair × upper Dha/Ni pair × shuddha/prati Ma), with the canonical Govindacharya names. 12-TET. |
| **Arabic maqam** | 12 | Rast, Bayati, Hijaz, Hijazkar, Saba, Sikah, Huzam, Nahawand, Kurd, Ajam, Nikriz, Suznak — each with its ajnas decomposition. Researched NON-12-TET neutral tones. |

### Thaats — 12-TET now, shruti later

Each thaat is a 7-of-12 svara selection (`Sa Re Ga Ma Pa Dha Ni`, with
komal/shuddh/tivra variants). The default is 12-TET. Every svara also records its
common just-intonation ratio, so `THAAT_SHRUTI[id]` gives the alternate
shruti-tuned cents with **zero migration**. Full 22-shruti micro-inflection and
raga grammar (aroha/avaroha, pakad, vadi/samvadi, gamaka) are **deferred** — a
thaat here is a *pitch set*, not a *grammar*.

### Melakartas — the 72 derived programmatically

```
mela n (1..72):
  prati Ma (M2, 600¢) if n > 36 else shuddha Ma (M1, 500¢)
  m = (n-1) mod 36;  lower = floor(m/6);  upper = m mod 6
  lower (Ri,Ga) ∈ [(1,2)(1,3)(1,4)(2,3)(2,4)(3,4)] semitones
  upper (Dha,Ni) ∈ [(8,9)(8,10)(8,11)(9,10)(9,11)(10,11)] semitones
  scale = Sa + Ri + Ga + Ma + Pa(700) + Dha + Ni
```

Reference melas verified in tests: 8 Hanumatodi, 15 Mayamalavagowla, 22
Kharaharapriya (Dorian), 29 Dheerashankarabharanam (major), 65 Mechakalyani
(Lydian).

---

## Maqam tuning approach + sources (the researched, non-12-TET part)

The founder explicitly **rejected a blanket 24-TET (50¢-grid) approximation**.
Every neutral (three-quarter-tone) degree below carries a **researched,
principled cents value**, with the alternative recorded. Maqamat are built from
**ajnas** (jins = 3–5-note melodic cells) — a lower jins on the tonic + an upper
jins (usually on the 4th or 5th). Each `Mode` carries its `ajnas` decomposition.

### Neutral-interval cents (the non-12-TET values)

| Degree | Cents used | Derivation | Alternatives in the literature |
| --- | --- | --- | --- |
| Rast / Sikah **neutral 3rd** | **355¢** | ≈ 27/22 (≈ 9/8 then 12/11 step) | Syrian ~347¢, 24-TET grid 350¢, Egyptian ~360–366¢, 11/9 ≈ 347¢ (range 342–366¢) |
| Bayati / Saba **neutral 2nd** | **150¢** | 12/11 = 150.6¢ | sources give 139–151¢; Bayati's E½b sits slightly lower than Rast's |
| Rast **neutral 7th** | **1057¢** | 5th (702) + neutral 3rd (355) | 24-TET grid 1050¢ |
| Saba **narrowed 4th** | **590¢** | diminished 4th (~7/5 ≈ 583; ~590 in practice) | Saba's "yearning" signature interval |
| Hijaz **(½, aug-2, ½)** | 0, 128, 386, 498 | just Hijaz 14/13 → 5/4 → 4/3 | upper jins varies by region |

12-TET-derived degrees (whole tones, the perfect 4th/5th, Hijaz's augmented 2nd)
keep their standard cents so chords and Western pivots still align — only the
genuinely neutral degrees carry non-100 cents. Because the whole corpus is exact
cents, swapping in a regional preset (Egyptian / Syrian / Turkish) later is a
data change with **zero migration**. Nahawand, Kurd, and Ajam are fully
12-TET-aligned (no neutral tones — they're minor-/Phrygian-/major-like).

### Sources

- **microtonaltheory.com — "Just Tuning of Arabic Ajnas" / "Makams & Maqamat"**:
  Rast `[0, 204, 355, 498]`, Bayati `[0, 139, 267, 498]`, Hijaz `[0, 128, 386,
  498]`, Nahawand `[0, 204, 408, 498]`, Kurd `[0, 90, 408, 498]`, Ajam `[0, 204,
  408, 498]`; documents the regional variation in the neutral third.
- **tuning.ableton.com/arabic-maqam — Maqam tuning presets**: Rast E½b presets
  range 342–356¢ (Rast 1 = 342, Syrian Rast 3 = 347, Rast 5–6 = 350–351); the
  "tuning is contextual / arbitrary" caveat.
- **Wikipedia — _Arabic maqam_ / _Jins_**: the jins inventory (Rast, Bayati,
  Hijaz, Nahawand, Kurd, Ajam, Saba, Sikah, Nikriz) and which degrees are
  half-flat; the 72 heptatonic tone-rows; "most-used half-flats are E♭, B♭."
- **ethnicmusical.com — maqam beginner's guide**: Rast `1–¾–¾–1`, Bayati
  `¾–¾–1–1` interval patterns; Hijaz augmented 2nd; Saba's diminished colour.

### Honesty

Real maqam intonation is **regional and performer-dependent** (Syrian vs
Egyptian vs Turkish differ; Turkish makam uses a comma-based 53-EDO-ish system
entirely). The values here are a **principled, teachable choice** grounded in the
just-tuning literature, not a claim of one true tuning. The cents representation
is exactly what lets us sharpen or regionalize later without migrating any data.

---

## Deferred (explicitly out of scope this round)

- Shruti exactness / 22-shruti micro-inflection (ratios are recorded; not the
  default).
- Raga / makam **grammar** — aroha-avaroha asymmetry, pakad, vadi/samvadi,
  gamaka, seyir. This corpus is a *pitch-set* corpus, not a melodic-grammar
  engine.
- Reconciling the three legacy scale tables onto this corpus (harmony-integration
  round).
- Regional maqam presets (Egyptian / Syrian / Turkish) as selectable tunings.
