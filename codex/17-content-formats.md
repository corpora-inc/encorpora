# 17. Content Formats

## What it is

The packs that ship audiobooks read three JSON files per book. The
**book manifest** (`manifest.json`) identifies the book and points
at the renderer; the **segments file** (`segments.json`) holds the
authored text broken into renderable units; the **audio manifest**
(`audio_manifest_<lang>.json`) maps each segment to a rendered audio
file with per-word timestamps. The three together are the book's
on-disk shape.

These shapes are deliberate JSON, deliberately separate. The
manifest knows about the book as a thing the user installs (id,
title, series, metadata). The segments file knows about the text
as a thing the renderer paints (chapters, paragraphs, block types,
TTS hints). The audio manifest knows about the rendered narration
(file path, duration, word timing). When the reader plays a book,
it loads all three and reconciles them: which segment is the user
on, what does the text say, what audio file plays, where in that
file is the current word.

A fourth format set, the captures pipeline, lives under
`corpan/infra/captures/` and feeds the YouTube channel. Same JSON
discipline, different shape; section 25 covers it.

## How it fits

These formats are the contract between the authoring pipeline and
the runtime. Authoring (sections 19, 20) produces the JSON;
runtime (sections 11-15) consumes it. The two halves never share
a runtime; they share a file shape on disk.

The split between text and audio is the architectural lever the
reading packs depend on. The same `segments.json` is used by
every language (translations live in the text where appropriate,
or in side files). The audio manifest is per-language, because
each language is a separate Chatterbox run with its own forced
alignment. Adding a new language to an existing book is therefore
"render the new audio and drop an `audio_manifest_<new>.json`
next to the existing files"; the segments file does not have to
move.

## Files and entry points

### The format declarations

- `corpan/packs/shared/core/types.ts`: the TypeScript types every
  reader pack imports. Declares `AudioManifest`,
  `ManifestSegment`, `WordTimestamp`, `BookSegment`,
  `SegmentsData`, and `TimelineWord` (the derived per-word
  position the reader uses for highlighting).
- `corpan/packs/shared/data/segmentLoader.ts`: the fetcher.
  `loadSegments(url?)` and `loadAudioManifest(lang, url?)`.
- `corpan/packs/shared/core/timeline.ts`: `buildTimeline(segments,
  audioManifest)` produces the per-word absolute-time view the
  paragraph view highlights against.

### Sample data

- `books/<category>/<series>/<book>/pack/manifest.json`: the
  manifest for a book pack. `corpan/CHANGELOGS.md`'s "Narration
  series" row maps the per-book changelogs alongside.
- `books/<category>/<series>/<book>/pack/segments.json`: the
  text. v2.0.0 supports the standard prose shape, the
  `format: "dialog"` shape (with `speaker_id` per segment), and
  segment-typed shapes (text, image).
- `books/<category>/<series>/<book>/pack/audio_manifest_<lang>.json`:
  one per language the book has been narrated in. Maps each
  segment id (e.g. `"ch10-868"`) to the rendered audio file,
  total duration, and per-word timestamps.
- `books/<category>/<series>/<book>/pack/audio/<lang>/<segment>.m4a`:
  the audio files themselves. **Not** in git;
  `.gitignore`d under `**/pack/audio/`. Served from CloudFront,
  hydrated locally via `corpan/infra/hydrate-audio.sh`.

## How it works

### The book manifest

A book pack's `manifest.json` is the same shape as a regular
pack's (section 11), with two book-specific additions: `type:
"book"` and a `metadata` block:

```jsonc
{
  "id": "book_klondike_joe",
  "name": "Klondike Joe: The Canadian Who Saved a Queen",
  "version": "0.1.0",
  "type": "book",
  "entry": "dist/reader.js",
  "styles": ["dist/reader.css"],
  "entryType": "script",
  "sdkVersion": "0.1.0",
  "metadata": {
    "series": "Fascinating Spies",
    "volume": 1,
    "author": "Corpora",
    "tts": true,
    "estimatedReadTime": "3-4 hours",
    "estimatedListenTime": "2.5-3 hours"
  }
}
```

The `entry` here is a thin reader bundle, not a self-contained app.
For catalog-style books (Earthgate Reader books), the entry is
boilerplate that pulls the pack's `segments.json` and
`audio_manifest_*.json` from sibling URLs and hands them to the
catalog shell. The catalog shell (section 13) picks the
right reader from the user's settings and renders the book.

The `metadata` block is what the catalog UI shows. `series` is the
key the catalog groups by in the browse view; `volume` is the
sort order within a series; `estimatedListenTime` is what the
catalog detail surfaces alongside the play button.

### The segments file

`segments.json` v2.0.0 is the authored text. Each segment is the
unit the reader renders and the unit the audio manifest indexes
into. A sample from a dialog-format book:

```jsonc
{
  "version": "2.0.0",
  "book_id": "ai-this-week-2026-05-13",
  "format": "dialog",
  "total_segments": 62,
  "segments": [
    {
      "id": "ch00-001",
      "chapter": 0,
      "title": "",
      "block_type": "text",
      "speaker_id": "host",
      "text": "Welcome to AI This Week. I am Vindy.",
      "text_markdown": "Welcome to AI This Week. I am Vindy.",
      "tts": {
        "text": "Welcome to AI This Week. I am Vindy.",
        "pause_after_ms": 583,
        "speaker_id": "host",
        "repetition_penalty": 2.0
      }
    },
    {
      "id": "ch00-002",
      "chapter": 0,
      "title": "",
      "block_type": "text",
      "speaker_id": "analyst",
      "text": "Good to be here.",
      "tts": { "text": "Good to be here.", "pause_after_ms": 537, "speaker_id": "analyst" }
    }
    /* ... 60 more segments ... */
  ]
}
```

Each segment carries:

- `id`: stable identifier (`"ch10-868"`-style). Sortable in
  rendered order; the audio manifest keys off the same string.
- `chapter`, `title`: chapter index and (optional) chapter title.
  Used to build the chapter index for the transport bar (section
  15) and the chapter overlay.
- `block_type` (or default text): `"text"` for prose,
  `"image"` for an inline image, and others as needed. The
  reader switches rendering by this field.
- `text`, `text_markdown`: the user-visible string. `text` is
  plain (used for word counts, search); `text_markdown` carries
  any inline formatting the renderer should preserve. Both are
  always English; non-English translations live in adjacent
  per-language files (the books that have them; some books are
  single-language).
- `tts`: the TTS hint block. `text` is the string actually
  spoken (may differ from the displayed text to nudge
  pronunciation; section 20 covers the discipline);
  `pause_after_ms` controls the silence between segments;
  `speaker_id` is the voice id for dialog books; per-segment
  Chatterbox params (e.g. `repetition_penalty`) can be set here.
- `image`, `image_alt`: present when `block_type: "image"`.

The big rule (per the auto-memory and section 20): `tts.text`
is TTS-only; `text` and `text_markdown` are display fields. They
are allowed to differ. Phonetic nudges in `tts.text` should not
use dashes (`"chahpoolinehs"` not `"chah-poo-lee-nehs"`); section
20 covers the discipline.

### The audio manifest

The audio manifest is the per-language render. It is keyed by
segment id and carries the file path, the duration, the
inter-segment pause, and word-level timestamps from forced
alignment:

```jsonc
{
  "segments": {
    "ch10-868": {
      "file": "audio/en/ch10-868.m4a",
      "duration_ms": 13200,
      "pause_after_ms": 800,
      "words": [
        { "word": "La",      "start_ms": 220,  "end_ms": 460  },
        { "word": "Mojarra", "start_ms": 460,  "end_ms": 1100 },
        { "word": "stela",   "start_ms": 1100, "end_ms": 1400 },
        /* ... and so on, one row per word ... */
      ]
    }
    /* ... and so on, one block per segment ... */
  }
}
```

The word-level timestamps come from whisper-cpp forced alignment
(section 21) over the rendered Chatterbox audio (section 20).
Each `word` is the literal token from the rendered text;
`start_ms` and `end_ms` are millisecond offsets within the
segment's audio file.

The `audio_manifest_<lang>.json` naming is deliberate: one file
per language, side by side in the same pack directory. Loading
the English audio for a book is `loadAudioManifest("en", url)`;
loading the Spanish audio is `loadAudioManifest("es", url)`. The
URL is the same except for the suffix.

### The TypeScript types

`corpan/packs/shared/core/types.ts` is the canonical schema in
typed form:

```ts
export type WordTimestamp = {
  word: string
  start_ms: number
  end_ms: number
}

export type ManifestSegment = {
  file: string
  duration_ms: number
  pause_after_ms: number
  words: WordTimestamp[]
}

export type AudioManifest = {
  language: string
  voice: string
  sample_rate: number
  segments: Record<string, ManifestSegment>
}

export type BookSegment = {
  id: string
  part: number
  chapter: number
  title: string
  text?: string
  type?: "image"
  image?: string
  image_alt?: string
  tts: {
    text: string
    pause_after_ms: number
  }
}

export type SegmentsData = {
  version: string
  book_id: string
  total_segments: number
  segments: BookSegment[]
}
```

(The on-the-wire `BookSegment` is a richer superset of this base
type; the dialog format adds `speaker_id`, `text_markdown`,
`block_type`. The base type captures what every reader can rely
on; the optional fields layer on top.)

These types are what the reader imports. Every JSON file that
arrives at the reader either matches one of these shapes or
fails to type-check the consumer that uses it. The contract is
the union of the JSON and the TypeScript.

### Building the timeline

`buildTimeline(segments, audioManifest)` in
`corpan/packs/shared/core/timeline.ts` is the function that
reconciles the two:

```
segments.json:     [seg00, seg01, seg02, ...]   (text, ordered)
audio_manifest:    { seg00: { file, words, ... },
                     seg01: { file, words, ... }, ... }   (audio, keyed)

buildTimeline -> array of TimelineWord:
  [
    { word: "Welcome", absoluteStartMs: 0,    absoluteEndMs: 320, segmentId: "ch00-001", wordIndex: 0 },
    { word: "to",      absoluteStartMs: 320,  absoluteEndMs: 460, segmentId: "ch00-001", wordIndex: 1 },
    ...
    { word: "Good",    absoluteStartMs: 6783, absoluteEndMs: 6960, segmentId: "ch00-003", wordIndex: 0 },
    ...
  ]
```

Each `TimelineWord` carries its absolute time in the entire book
(by accumulating segment durations and pauses), the segment it
belongs to, and its index within that segment. The paragraph
view binds the timeline to the DOM by attaching a span per word
with a data attribute; the audio engine ticks the current
position; `findCurrentWordIndex(timeline, currentMs)` returns the
index; the renderer adds a class to that span. The highlight is
the visible result.

### Why JSON, where we would reach for something else

JSON is the default for two reasons. First, it travels: every
text editor reads it, every language has a parser, every git
diff is readable. Second, it composes: the reader fetches JSON,
parses it with the runtime's built-in JSON, and works against
typed objects. There is no codec to maintain.

The places JSON has been a poor fit and we have reached for
something else:

- The phrase corpus itself: tens of thousands of entries, dozens
  of languages, hundreds of thousands of translations. SQLite is
  the right shape for that (section 16). JSON would be too
  large to ship and too slow to query.
- The audio. M4A and AAC for shipping; WAV for intermediates;
  Opus-in-OGG was tried and was rejected because iOS < 17
  silently fails to decode Opus-in-OGG in Web Audio (section 18).
- The book PDFs. LaTeX source compiles to PDF; the PDF is the
  shipped artifact.

The JSON files in this section are small enough to load fully
into memory at start of book and operate on as plain objects.
That property is the boundary.

## Common operations

1. **Inspect a book's segments.**
   `cat books/<category>/<series>/<book>/pack/segments.json | jq .total_segments`
   tells you how many segments the book has;
   `jq '.segments[0]'` shows the first one's shape.
2. **Inspect an audio manifest.**
   `jq 'keys' books/.../pack/audio_manifest_en.json` lists the
   segment ids that have rendered English audio. Compare against
   `jq '.segments[] | .id' segments.json` to see if any are
   missing.
3. **Render a missing language.** Add the language to the
   pipeline's job list, run the Chatterbox render (section 20),
   confirm whisper alignment (section 21), drop the resulting
   `audio_manifest_<lang>.json` and the audio files into the
   pack's directory. The audio files go to S3 via
   `infra/sync-voices-to-s3.sh` (section 24); the manifest
   travels in the pack zip.
4. **Add a new field to a segment.** Edit the type in
   `corpan/packs/shared/core/types.ts` (use an optional field if
   existing data should still parse). Update the renderer to
   read the new field. Update the authoring pipeline to write
   it. Old books continue to render correctly; new books carry
   the new field.
5. **Inspect a specific word's timing.**
   `jq '.segments["ch10-868"].words[5]' audio_manifest_en.json`
   shows the sixth word in segment `ch10-868`.
6. **Find books that ship a given language.** A small shell
   snippet:
   `find books -name 'audio_manifest_es.json' -print` lists
   every book that has a Spanish audio manifest.

## Why we built it this way

Three files per book is the smallest split that lets each file
have one job. The manifest is for cataloging; the segments are
for rendering; the audio manifest is for playback. Merging any
two would create a file with two reasons to change and two sets
of authors to coordinate.

JSON over a custom binary format is the choice that keeps the
authoring side honest. A pipeline that produces JSON can be
debugged with `jq` and inspected with a text editor; a pipeline
that produces a binary blob needs its own tooling. The cost (a
few megabytes more on disk per language for the audio manifest)
is paid by the network, not by anyone's debugging time.

Per-language audio manifests instead of one polyglot file is
the cheapest expression of the actual update pattern. A book
gains a language one at a time, on its own schedule; the
generated artifact is one file per language; the in-memory
shape is identical regardless. The book's directory is a
self-documenting menu of which languages it has.

The `tts.text` versus `text` split is a hard-won discipline.
Voice models hear differently from how human eyes read; phonetic
nudges that look ugly in print render correctly aloud. Section
20 covers the conventions; the format respects the distinction
by giving them separate fields.

Word-level timestamps in the audio manifest is what makes the
word-highlight feature in Earthgate Reader possible at all. The
choice to forced-align every rendered segment (section 21) is
expensive compared to "just play the file"; the result is the
reader experience that fits "calm" and "synced." Without
word-level data, the highlight would have to estimate, and
estimation is what kicks the reader out of trust.

## To go deeper

- `corpan/packs/shared/core/types.ts` end to end. Five minutes.
- A book pack's `manifest.json`, `segments.json`, and
  `audio_manifest_en.json` side by side, in `jq`, with a coffee.
  Pick a short book (`Three Questions` is canonical).
- `corpan/packs/shared/data/segmentLoader.ts` and
  `corpan/packs/shared/core/timeline.ts` for the consumption
  side.
- Section 18 for the audio production side; sections 20 and 21
  for Chatterbox and Whisper; section 24 for where the audio
  files actually live (S3 and CloudFront).
