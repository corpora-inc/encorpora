# Drift

A calm, serial, reactive **micro-story reader** for Corpán — the down-tempo
"comedown" beat between hot exercise cards in the Journey scroll (Premium
Scroll §2.3 / §5 "Reader A — Drift").

Drift shows a few lines of **target-language** prose that a quiet parallax scene
reacts to (a light rises, a lantern kindles, snow starts) as each beat is read.
Tap any word to reveal its gloss in your native language. Narration (with
word-by-word highlighting) is optional and user-initiated, so a sound-off learner
is never surprised by audio. A read is ~20–40 seconds.

## Pair-agnostic + multilingual (no hardcoded language pair)

Drift never ships baked prose (that would pin one language pair and break for
the other ~49 target languages). A "scene" is a **mood + a list of content
slots** (`src/content/stories.ts`); each slot is filled at mount time from the
learner's *own* corpus via `hostApi`, so the prose that appears is always in the
learner's real target language:

- Target + native codes come from `getStackConfig().languages` (`[0]` native,
  `[1]` target), or from the Journey spec's `targetLang` / `nativeLang`
  (`src/content/compose.ts` `resolveLangs`). On a single-language immersion
  stack, `nativeLang` is `null` and Drift degrades to target-only (no gloss).
- Beats are composed from corpus entries (`getRandomEntries` / `getEntryById`),
  each entry providing its own target line **and** native gloss. Words tokenize
  into tappable spans, each carrying its gloss (`compose.ts`).

## Interlude conformance (Journey activity contract §4.2)

- **Respects `isActive()` / consumes the spec** — `src/main.ts` `resolveSpec`
  reads `initialState.activity` (belt) or `hostApi.journey.getSpec()`
  (suspenders). When a spec supplies `phrase` `itemRefs`, those become the
  story's first beats so a Drift can *feature the learner's current
  word/phrase* (`compose.ts` `composeStory`).
- **Unscored completion** — a reader is not graded. On finish
  (`src/game.ts` `finish()`) Drift calls
  `journey.reportResult({ specId, score: 1, perItem: [], durationMs })` then
  dispatches `corpan:exit`. Idempotent (guarded by `finished`).
- **Swipe-outable** — no unskippable intro; `dispose()` stops speech, clears
  timers, and removes the DOM. A host unmount synthesizes an abandoned result
  from buffered items (Drift buffers none — a reader reports one terminal
  completion).
- **Self-timeboxes** — `typicalDurationSec: 30`; the scene is 2–3 beats.

## Standalone behavior

Outside Journey (`isActive()` false, no spec), Drift just reads: it composes a
scene from `getRandomEntries`, no result is reported, and "Done" / `corpan:exit`
simply dismisses the pack. Open `index.html` via `npm run dev`; append
`?journey=1` to simulate an interlude launch (mock host stashes emissions on
`window.__corpanMockJourney`).

## Build

```bash
npm install
npm run build      # → dist/app.js (IIFE) + dist/app.css; registers CorpanGames.drift
npm run typecheck
npm run pack:all   # build + zip (drift.zip = manifest.json + dist/)
```

Self-contained: no `@shared/*` aliases, no runtime deps. The Journey activity
contract is vendored at `src/sdk/activityContract.ts` (synced from
`corpan-app/src/contentPacks/activityContract.ts`).

## Wiring into the catalog (app-side owner — NOT done here)

This pack ships only `manifest.json` + `dist/`. To make Drift installable and
schedulable, the app-side owner must:

1. Add a catalog entry for `drift` (id, version, zip URL) and mirror the
   `manifest.activities[]` declaration (`drift:read`, `itemKinds: ["phrase"]`,
   `requiredHostApis: ["journey"]`, `strands: ["mfi","fd"]`,
   `typicalDurationSec: 30`) onto the catalog entry so the engine can schedule
   an anchor card OTA.
2. Deploy the pack zip via the code/game-pack path (`deploy-pages.yml` on a push
   to `main` touching `corpan/packs/**`) — agents do **not** hand-upload zips.
3. Let the feed mixer spend a reader-interlude slot on `drift:read` (Premium
   Scroll §4.3: reading/comprehension → reader interlude, preferred after a hot
   combo as a comedown), passing a spec with the current `phrase` itemRefs.
