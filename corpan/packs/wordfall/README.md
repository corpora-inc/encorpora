# Wordfall

A fast, juicy **catch-the-meaning** mini-game, purpose-built as a Journey scroll
interlude. Target-language word tiles rain down; the learner taps the one whose
meaning matches the prompt shown at the top before it hits the floor, and lets
the distractors fall. Catch clean → the combo builds, the tile is spoken, the
next round drops. A 20–45s escalating loop.

Design direction: `corpan/corpan-app/src/journey/docs/PREMIUM_SCROLL.md` (§5,
"Game 3 — Wordfall"). Squared-off premium dark visuals, violet accent, overlay
HUD that never reflows the layout.

## How it plays

- **Prompt** (top): the meaning to match — the native gloss, or the target word
  itself on a single-language immersion stack.
- **Tiles** (falling): one correct target-language surface + distractors.
- **Tap** the correct tile → clean catch (combo up, spoken back). **Wrong tap**
  or **correct tile floored** → the item fails; the round advances.
- Fall speed **escalates** with round progress and the spec's `intensity`.

## Two run shapes, one code path

### Journey interlude (the point)

Launched by the feed with an `ActivitySpec` (`activityType: "wordfall:catch"`).
The pack:

1. Detects the launch (`initialState.activity` **or**
   `hostApi.journey.isActive()`), reads the spec via `getSpec()`.
2. Resolves `spec.itemRefs` → corpus entries (`hostApi.getEntryById`), plays one
   round per spec item, in order — **no menu, no "play again"** while active.
3. Streams `hostApi.journey.reportItem(...)` as each spec tile resolves (buffered
   by the host so a swipe-away loses nothing).
4. Calls **exactly one** `hostApi.journey.reportResult({ specId, score, perItem,
   durationMs, detail })` at the natural end, then dispatches `corpan:exit`.
5. Is swipe-outable at any time — on unmount the pack does **not** synthesize a
   terminal result; an abandon is the host's synthesis job from the buffered
   items (activity-contract §8).

Distractors come from the same host sampler the feed uses
(`hostApi.getRandomEntries`).

### Standalone

Launched with no spec. Samples entries via `hostApi.getRandomEntries()`, frames
the run with a Play card and an endless "Play again" card, and **never reports**.
`npm run dev` mounts a mock host (`src/sdk/mockHostApi.ts`) so it's playable in a
plain browser.

## Interlude conformance checklist (activity-contract §4.2)

- [x] Respects `isActive()` — no menus/level-select/"play again" in interlude mode.
- [x] Consumes `spec.itemRefs` as content (not its own random corpus).
- [x] `reportItem` per resolved spec tile; **exactly one** `reportResult` at the end.
- [x] Mounts fast, no unskippable intro, swipe-outable at any time.
- [x] Self-timeboxes (~30s; `typicalDurationSec: 30`) — host never force-kills.
- [x] Returns a real `score` (0..1 clean-catch rate) for engine grading.
- [x] Single-language stack safe (`SINGLE_LANGUAGE_RULE.md` — immersion mode).
- [x] Honors sound-off (`hostApi.speak` + SFX both gated by the in-pack toggle).

## Build & dev

```bash
npm install
npm run typecheck          # tsc --noEmit
npm run build              # vite lib build → dist/app.js (+ dist/app.css)
npm run dev                # standalone browser dev (mock host)
npm run test:journey       # headless contract instrumentation (node >= 18)
```

The build emits an IIFE that registers `window.CorpanGames.wordfall` — the
underscore/hyphen-free id the installer expects (manifest `id` matches).

## Structure

```
manifest.json              # host contract; declares the wordfall:catch activity
src/main.ts                # registerGame → CorpanGames.wordfall; dev mount
src/Game.ts                # the canvas game (both run shapes)
src/content.ts             # entry → {target, prompt}; distractors; immersion rule
src/audio.ts               # WebAudio SFX (sound-off first-class)
src/styles.css             # squared-off premium dark, violet accent
src/journey/session.ts     # WordfallSession — spec, per-item buffer, terminal result
src/journey/mount.ts       # journey-launch adapter (resolve itemRefs → boot game)
src/sdk/                    # vendored activity contract + host types + mock host
test/journey/instrumentation.spec.mjs  # headless contract test
```

## Files that own the interlude contract

- `src/main.ts` — journey detection + dispatch to `mountJourney`.
- `src/journey/mount.ts` — `getSpec` handling, itemRef resolution, unsupported-spec
  abandon, no-fake-result-on-abandon.
- `src/journey/session.ts` — `reportItem` streaming, one idempotent `reportResult`,
  event-rail fallback.
- `src/Game.ts` — `isActive`-driven menu suppression, per-catch resolution →
  `session.noteResolved`, `corpan:exit` on natural end.
