# 36. Changelog of the System

**Snapshot at 2026-05-29.** This section summarizes architectural
changes to the system over the last 90 days, written from the
perspective of "what shape did the system change into." Per-unit
changelogs (sections 02, 10, 17) carry the granular history;
this section reads the granular history at a different
altitude.

The cutoff is `2026-02-28` to `2026-05-29` against
`upstream/main`. Snapshots like this one rot; treat the entries
as a historical record rather than as live state.

## What it is

A dated, prose-shaped account of the largest architectural
shifts in the last 90 days. Each entry names the change, the
month it landed, the PRs that carried it, and the larger
context.

## How it fits

This section pairs with section 35 (The Near Future): one
records what happened, the other speculates about what
happens next. Together they bracket the static-system view
the rest of the Codex documents.

## Files and entry points

- `upstream/main`'s `git log` for the period
  `2026-02-28..2026-05-29`. The reference command:
  `git log --since='2026-02-28' --until='2026-05-29' --oneline upstream/main`.
- Per-pack `CHANGELOG.md` files for the unit-level
  granularity.
- `corpan/corpan-app/CHANGELOG.md` for the app's per-version
  detail.
- `RELEASE_NOTES_*.md` files at the repo root for the per-
  release user-facing copy.
- `PIPELINE_STATE.md` for Skylar's pipeline-side dated record.

## How it works

The picture, in chronological order from oldest to newest in
the window:

### IAP rewrite for App Review (March 2026)

`#0.11.7 - IAP rewrite for App Review resubmission`
(`7d4076b0`), preceded by several IAP-tightening releases
(`0.11.5`, `0.11.6`). The work was the response to an Apple
review rejection that required restructuring the IAP flow,
hardening the lifecycle around purchase and restore, and
clarifying the receipt-validation path. The plugins involved
were `tauri-plugin-iap` and `tauri-plugin-subscriptions`. The
investment paid off in a successful resubmission and in the
discipline (per the IAP runbook at
`corpan/infra/IAP_SETUP_RUNBOOK.md`) that subsequent IAP
changes are still expected to follow.

### Reader catalog v2 and narrators (March 2026)

`#233 Add Narrators to readers catalog and World Radio pack`
(`6647ed4a`). The catalog model shifted from a flat list of
narrations to a narrator-first shape: a `Character` model
with voice profiles, books they have narrated, languages they
speak. The catalog UI rebuilt around it. This is the change
that gave `@shared/catalog/src/types.ts` (section 13) the
`Character`-and-`BookEntry`-and-`Narration` shape it has
today. Earthgate Reader and Stargate Reader adopted the new
catalog in the same window.

### Analytics hardening for Tauri WKWebView (March 2026)

`#231 Corpan: anon analytics and telemetry for books`
(`d8188690`) plus the follow-up `analytics: harden CORS for
Tauri WKWebView, drop subdivision geo, add generic track()`
(`6e01f026`). The CORS work was the response to Tauri's
WKWebView origin shape being subtly different from a browser's;
the geo-subdivision drop was a privacy-side choice. The result
is that the app emits anonymous analytics with no PII to the
project's analytics endpoint, with the per-event shape
documented for the next person adding a new event.

### Corpus slim and language expansion (early April 2026)

`#232 Corpan Slim corpus to 10k phrases + add 9 languages (he,
sv, fi, nl, sw, no, da, el, ms)` (`c3b16da9`). The bundled
SQLite (section 16) shrank from a long tail of low-quality
phrases to ~10,000 high-quality ones; nine languages joined
(Hebrew, Swedish, Finnish, Dutch, Swahili, Norwegian, Danish,
Greek, Malay). The binary size dropped meaningfully; the
user-visible quality of the random-entry flow rose.

### World Radio (April 2026)

`#237 Corpan World Radio - try native implementation over
browser` (`d0fb4518`), then `#238 Corpan 0.12.0 - World radio
native streams` (`084c97bd`). World Radio is the pack that
streams live radio stations from around the world; the early
implementation used the WebView's built-in HTML5 audio,
which fell over on lock-screen transitions and on background
playback. The native implementation lives in the
`tauri-plugin-radio-stream` plugin and routes through the
device's audio session, which unlocks proper background
playback and lock-screen integration.

### Pronunciation Coach on Android CPU with whisper.cpp (April 2026)

`#250 Almost 0.12.6 - Pronunciation coach on Android CPU,
whisper.cpp` (`c66d5d77`). The Android side of the
pronunciation coach went from the SFSpeechRecognizer-style
fallback to whisper.cpp running on CPU with NEON
optimizations. Quality improved noticeably; the configuration
documented in section 21 dates from here.

### DGX catalog (April 2026)

`#249 DGX catalog` (`c7689860`). The catalog publisher
(section 24's `catalog.json` mechanics) was rewritten to be
driven by the DGX Spark's `ttsctl publish` step rather than
by manual catalog edits. Publishing a new narration became a
single command from the Spark; the catalog stays consistent
without a separate sync.

### Earthgate and Hanzipan polish (April 2026)

`#248 Hanzipan, earthgate touches, controls chapter/title
display earth/star` (`17943fd6`). Hanzipan (the Mandarin
character pack) shipped a polish round; Earthgate Reader
tightened the chapter/title display in the transport bar
(section 15). The "earth/star" reference in the title is to
the dual-reader split: the same chapter-display logic ships
in both Earthgate and Stargate, themed per pack.

### Parlometron (May 2026)

`#252 0.13.0 corpan + PARLOMETRON` (`6cb89abf`),
`#253 Corpan 0.13.X - PARLOMETRON GAME` (`d076f112`),
`#255 parlometron, start >0.13.1 onboarding and phrase pack
architecture` (`ecaa596c`). Parlometron is the
pass-the-device pronunciation party game, layered on top of
the pronunciation coach's STT (section 21) and the phrase
pack architecture that started in this window. The release-
notes copy in `RELEASE_NOTES_0.13.1.md` carries the headline
in 30+ locales: "Parlometron, solo practice plus a pass-the-
device party game (2-8 players), 51 languages, on-device
Whisper scoring."

### Moonshot 15 and Corpan 0.15.10 (mid-to-late May 2026)

`#256 Moonshot 15 plus` (`a8b0bc30`),
`#259 Corpan 0.15.10` (`d820a11f`). The 0.15.x line is the
current shipped one. The "Moonshot 15 plus" PR is the
in-window pack-architecture push (the phrase-pack model that
section 14 covers); the per-version patch releases are the
continued polish.

## How the architectural surface changed

Three larger shifts visible across the window:

- **The catalog became narrator-first.** The shape that
  section 13's `appShell.ts` orchestrates today is the
  artifact of the March catalog v2 rewrite. The
  `Character` / `VoiceProfile` / `BookEntry` model in
  `shared/catalog/src/types.ts` is the catalog's contract.
- **The audio runtime became fully native.** World Radio's
  native streams, the audio-keepalive plugin work, the
  lock-screen integration, the `mediaSessionAnchor` and
  `nativeKeepAlive` modules in `@shared/audio`. The runtime
  no longer relies on the WebView's audio facilities for
  anything load-bearing.
- **The on-device pronunciation surface matured.** The STT
  plugin (sections 04, 05, 21), Parlometron's party-game
  framing, the per-language tuning. From "an experimental
  pack" to "a primary user surface" in 90 days.

## Common operations

1. **Regenerate this section.** From the encorpora repo:
   `git log --since='90 days ago' --pretty=format:'%h %s'
   upstream/main`. Cluster the commits by week and by theme;
   write a paragraph per cluster.
2. **Trace a per-version detail.** Open the relevant
   `CHANGELOG.md` for the unit (the app's at
   `corpan/corpan-app/CHANGELOG.md`, a pack's at
   `corpan/packs/<pack>/CHANGELOG.md`). The PR numbers in
   this section's prose are the bridge.
3. **Audit which architectural choices changed.** Reread the
   "How the architectural surface changed" subsection;
   check each against the corresponding deep-dive section's
   "Why we built it this way." Any drift is the place to
   update.

## Why we built it this way

A 90-day rolling window is the smallest interval over which
the architectural changes are large enough to summarize
prosaically. A weekly snapshot would mostly capture polish;
a yearly snapshot would lose the texture. The 90-day cut is
also a comfortable cadence for the human writing the
section to re-read the previous version and catch what
slipped.

The dated header at the top is the same discipline section
35 uses. A historical record without a date is a claim about
the present that the reader will misread.

The structure (chronological clusters, then "How the
architectural surface changed," then the operations) is the
shape that pays off when the reader comes back six months
later and asks "what was the big shift in April." The
clusters answer that question; the architectural-surface
summary closes the loop.

## To go deeper

- `git log` against `upstream/main` for the granular
  history; PR numbers in this section are the entry points.
- Each per-unit `CHANGELOG.md` for the unit-level
  granularity that this section omits.
- `RELEASE_NOTES_*.md` files at the repo root for the
  user-facing per-release copy in 30+ locales.
- `PIPELINE_STATE.md` for Skylar's narration-pipeline-side
  history during the same window.
- Section 35 for the speculation paired with this section's
  history.
