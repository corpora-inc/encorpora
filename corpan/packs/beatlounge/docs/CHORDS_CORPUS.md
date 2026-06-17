# beatlounge — Chord-Progressions Corpus

A key-AGNOSTIC, 12-TET, IP-safe library of ~1000 chord progressions plus a pure
API to resolve them to MIDI, voice them, transpose them, and emit
tick-addressed chord events. Lives in `src/music/chords/`. It does **not** touch
the document model, audio, or UI — it is a foundation the harmony engine /
composer / piano-roll consume in a later round.

## Why this is IP-safe (and why that's the point)

Chord **progressions** — sequences of chords / Roman numerals — are not
copyrightable. This corpus leans into that: it is generated **entirely from
music theory** (cadences, turnarounds, modal interchange, secondary dominants,
common pop/jazz/folk/blues patterns) and a **systematic enumeration of the
finite diatonic loop space**. It is NOT scraped from any proprietary
compilation.

Strict guardrails, enforced by a test (`IP-SAFE: no entry text mentions a
song/artist/album marker`):

- **No song titles, artist names, or album references** appear anywhere — not in
  ids, tags, or Roman-numeral labels.
- Entries are described by **theory tags only** (e.g. `ii-V-I`, `tritone-sub`,
  `andalusian`, `doo-wop`, `blues-12bar`), never "the [X] progression".
- Everything is **key-agnostic** (relative to a key), so an entry is a generic
  harmonic object, not a fixed-pitch copy of any recording.

## Schema (`types.ts`)

### `CorpusChord` — a key-agnostic chord

```ts
interface CorpusChord {
  degree?: number          // 0-based diatonic scale degree (I=0 … vii=6)
  accidental?: number      // chromatic shift of the diatonic root, in semitones
  rootSemitone?: number    // OR the root directly as semitones above tonic (0..11)
  quality: CorpusChordQuality
  inversion?: number       // 0=root position, 1=first, … (slash voicing)
  roman: string            // display label, e.g. "ii7", "V7", "bVII", "I/3"
}
```

Root resolution order: `rootSemitone` (explicit chromatic root — used for bVII,
bIII, bII Neapolitan, tritone subs, secondary dominants) wins; otherwise the
diatonic `degree` against the progression's `mode`, plus optional `accidental`.

### `CorpusProgression`

```ts
interface CorpusProgression {
  id: string                          // stable, non-naming, e.g. "pop-loop:axis:rot0:I-V-vi-IV"
  degrees: CorpusChord[]
  perChordBeats: number | number[]    // uniform or per-chord (a beat = a quarter note)
  mode: KeyMode                       // key context the degrees read against
  family: ProgressionFamily           // coarse bucket
  tags: string[]                      // searchable theory descriptors
  meter?: [number, number]            // default [4,4]
}
```

`KeyMode`: `major | minor | dorian | phrygian | lydian | mixolydian | aeolian |
harmonicMinor`.

## Chord-quality coverage (`qualities.ts`)

Each quality resolves to an ascending semitone set from the root (root = 0):

| triads | sevenths | sixths/extensions | colour |
|---|---|---|---|
| maj, min, dim, aug | maj7, min7, dom7, dim7 | maj6, min6, six9 | add9 |
| sus2, sus4, five (power) | m7b5, minMaj7 | dom9, maj9, min9 | altered (7alt) |
| | | dom11, min11, dom13, maj13 | |

All strictly 12-TET. Dominant-11 omits the clashing 3rd by convention.

## Tag taxonomy & organization

The corpus is partitioned into 15 **families** (coarse bucket) and tagged with
fine-grained, searchable **theory tags**.

| Family | What it covers |
|---|---|
| `cadence` | authentic / plagal / deceptive / half cadences, major & minor, triads & sevenths, pre-cadential approaches |
| `pop-loop` | canonical 4-chord pop/rock loops + all rotations + **the systematic diatonic-loop bank** (3/4/5-chord tonic-anchored loops) |
| `doo-wop` | 50s I–vi–IV–V family + rotations + 8-bar |
| `jazz-turnaround` | ii–V–I (major/minor), I–vi–ii–V, tritone subs, backdoor, Coltrane cycle, rhythm-changes A + **seventh-colour diatonic loops** |
| `blues` | 12-bar (basic, quick-change, jazz, bebop, ninth), 8-bar, minor blues |
| `modal-vamp` | Dorian, Mixolydian, Phrygian, Aeolian, Lydian vamps |
| `circle-of-fifths` | descending-fifths sequences (len 3–8), major & minor, triads & sevenths |
| `secondary-dominant` | V/x → x pairs + tonicization chains |
| `modal-interchange` | borrowed chords (bVII, bVI, bIII, iv, iiø, bII Neapolitan) |
| `folk` | diatonic singer-songwriter / primary-triad patterns |
| `gospel` | 6–2–5–1, passing-diminished "amen", extended ii–V–I |
| `latin` | bossa / montuno / Latin turnarounds |
| `pop-punk` | I–V–vi–IV anthem + rotations as power chords, minor drive loops |
| `edm` | minor four-chord drops + rotations, sus anthems |
| `andalusian` | Phrygian descending-tetrachord (flamenco) family |

Representative tags: `cadence`, `authentic`, `plagal`, `deceptive`, `half`,
`ii-V-I`, `turnaround`, `tritone-sub`, `backdoor`, `coltrane`,
`secondary-dominant`, `circle-of-fifths`, `descending-fifths`,
`modal-interchange`, `borrowed`, `neapolitan`, `modal`, `dorian`, `mixolydian`,
`phrygian`, `aeolian`, `lydian`, `blues-12bar`, `blues-8bar`, `minor-blues`,
`doo-wop`, `andalusian`, `flamenco`, `gospel`, `power-chords`, `diatonic`,
`loop`, `systematic`, `rotation`.

## How ~1000 is reached (generation approach)

1. **Hand-authored theory families** (`families.ts`) — the curated, named-by-
   theory progressions for each family above.
2. **Systematic diatonic-loop enumeration** (`combinatorial.ts`) — the founder's
   "finite soup of possibilities": every tonic-anchored diatonic loop of length
   3, 4, and 5, in major and minor, with a no-immediate-repeat rule and a
   "return chord" constraint (the loop must close on V/IV/ii/vii° so it lands
   convincingly on repeat). Length-5 is capped so it complements rather than
   swamps the common shorter loops.
3. **Seventh-chord colourings** of the 4-chord diatonic loops (jazz/neo-soul).

All generation is deterministic (fixed degree order) → stable ids and counts.
Everything is de-duplicated by id at assembly time. Current count: **~994**.

## Public API (`index.ts`)

```ts
// Lookup / listing
getProgression(id)            // CorpusProgression | undefined
listByFamily(family)          // CorpusProgression[]
listByTag(tag) / listByTags(tags)
allTags() / familyCounts()
CORPUS, CORPUS_IDS            // frozen

// Resolution & voicing (pure, 12-TET)
chordToMidi(chord, keyRoot, octave?, mode?)   // → MIDI note numbers
chordPcs(chord, keyRoot, mode)                // → pitch-class set
voiceChord(chord, keyRoot, { octave, mode, style: "close"|"drop2", maxVoices })
applyInversion(notes, inv)
midiForPc(pc, octave)

// Transposition (key-agnostic: just rebind the key root)
transposeToKey(progression, keyRoot)          // → KeyedProgression

// Tick-addressed events (aligned to the document PPQ = 960)
progressionToChordEvents(prog, { keyRoot, octave, style, maxVoices, ppq })
  // → ChordEvent[] { index, chord, startTick, durationTicks, notes, roman }
progressionBeats(prog) / beatsForChord(prog, i)

// Seeded random (mulberry32 — pack-standard, deterministic)
randomProgression(rngOrSeed, { family, tags, modes, where })
makeRng(seed)
```

## Tests (`chords.test.ts`)

- Chord→interval correctness for **every** quality (and ascending/root-anchored).
- Degree→pitch-class resolution (major & minor diatonic, chromatic `rootSemitone`,
  `accidental`).
- MIDI placement, inversions, close/drop2 voicing, `maxVoices` capping.
- Transposition: the same progression voices in any key (every note shifts by the
  exact interval); canonical ii–V–I & cadence expand to the **right pitch-class
  sets**.
- Tick-addressed events: contiguous, PPQ-aligned, custom-ppq, per-chord beats
  (12-bar blues = 48 beats).
- Seeded-random determinism + filtering.
- Freshness/sanity: ~1000 entries, all ids unique, every entry well-formed, every
  entry resolves to valid 0..127 MIDI, every family covered, rich tag taxonomy,
  and the **IP-safety guard** (no naming markers).
