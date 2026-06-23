# Corpán 0.16.0 — Directed Experience Refactor (overnight progress)

Branch: `moonshot-15-plus-v2`. Plan: `~/.claude/plans/quizzical-conjuring-comet.md`.
This logs what an overnight autonomous session built. tsc is green throughout.
No commits made (user handles git). No production catalog/CDN mutated.

## ✅ Phase 0 — HostApi write surface (DONE, verified by tsc)
- `contentPacks/types.ts`: `StackConfig` += `phrasePackIds`/`baseCorpusEnabled`/
  `scrollNavigationEnabled`; new `StackConfigPatch`, `HostHistoryApi`,
  `HostPhrasePacksApi`, `HostInstalledPhrasePack`. `HostApi` += `setStackConfig`,
  `history`, `notifyUtterance`, `phrasePacks` (all optional).
- `contentPacks/hostApi.ts`: snapshot/slice extended; **`isSameStackSlice` now
  includes phrasePackIds/baseCorpusEnabled** (fixes the stale-roll-on-pack-toggle
  bug); implemented the new surface (pure JS store mutation, no Rust boundary).
- `packs/sdk/index.d.ts` + `index.js`: mirrored types + working mock impls.
- `contentPacks/catalog.ts`: v3 `systemPack` now parsed + carried through
  `filterCatalogForApp` (was dropped) — needed for the phrase pack later.

## ✅ Phase 1 — Onboarding decision graph (DONE, verified ON-DEVICE)
New `src/onboarding/`: `types.ts`, `graph.ts`, `useOnboardingGraph.ts`,
`useApplyLang.ts`, `OnboardingEngine.tsx`, `QuestionNodeView.tsx`,
`InfoNodeView.tsx`, `registry.ts`. New `src/store/landing.ts` (one-shot intent).
- Replaced the hardcoded 7-step wizard with a string-id decision graph
  (`welcome → pickPrimary → forkJourney → [calibration] → [pickLearning] →
  [pickPhrasePacks] → tts → plusPitch → finish → commit`). Back = node-id stack.
- Journeys: **enjoy / learn / polyglot / child**, each with an experiential
  calibration ("how comfortable…" / "have you studied…") that maps to
  `levels`+`rate` — never asks the user for numbers. Full mapping in `graph.ts`.
- Existing screens adapted as graph "adapter" nodes via optional
  `onAdvance?/onBack?` props (fallback to legacy `setStep`, so they still work
  standalone): Welcome, PickPrimary, PickLearning, TTS, PlusPitch, Finish,
  PickPhrasePacks. **Phrase-pack preload restored** for learn/polyglot.
- `useApplyLang` extracted from PickPrimary (shared race-guarded i18n setter +
  `detectPreferredLang`). PickPrimary refactored to use it.
- Deleted `OnboardingWizard.tsx` + `OnboardingUserClass.tsx`.
- i18n: added `onboarding.fork.*` / `onboarding.calibrate.*` / `settingUp` to
  `en/common.json`. **TODO: run the 50-locale translate** (English falls back
  meanwhile — non-en UIs show English fork/calibration text until then). See
  "Open items".
- **Verified on iPad (dark)**: Welcome → PickPrimary → fork ("What brings you to
  Corpán?", `{{lang}}`→English) → calibration ("How comfortable reading
  English?") → tts → plusPitch ("Join the Corpanistas") → finish → commit.
  Result committed to the active stack: enjoy/native → `levels:[A0..C2]`,
  `rate:1.0`, `languages:[en]`, `landing:{home,library}`, `userClass:enjoyer`.

## ✅ Phase 2 — Home hub + nav rewrite (DONE, verified ON-DEVICE)
New `src/components/home/`: `HomeHub.tsx` + `recommend.ts`.
- **Home hub is now the post-onboarding root** (replaced hard-mounted
  MainExperience). Chrome (ear+Corpán lockup, StreakChip, Settings+update-badge),
  a purple **"Continue learning"** phrase hero, a personalized **"For you"** shelf
  (`recommend.ts`, by userClass, Get/Open), and the full **Library**
  (`PacksListing` — subscription offer, installed Update/Open/Remove, available).
- **`corpan:exit` now returns to Home** (was: opened Settings→Packs — the headline
  bug). App.tsx render is now: `!onboarded` → engine; else HomeHub, with an
  overlay on top when `activeGame` set.
- **Native/pack overlay seam**: `activeGame.manifestUrl` present → `ContentPackOverlay`
  (pack); absent → MainExperience rendered as a full-screen native overlay with a
  Home button. `openPhrase()` launches the phrase experience this way.
- **Landing-intent consumer** in App.tsx (runs once on onboarded transition):
  `{experience, phrase_main}` → openPhrase; `{experience, packId}` → launch if
  installed; `{home|discover}` → stay on Home. `?game=` deep-link wins.
- Removed `DiscoverPacksPanel` (deleted) + `hasSeenPacksDiscover` read from
  MainExperience. **Verified on-device**: Home renders (hero + For you + Library);
  tap hero → native phrase overlay (`?game=phrase_main`, Home button, phrase nav);
  tap Home → returns to Home (`game` param cleared). tsc + `npm run build` green.
- **Left intentionally** (de-risk): SettingsModal still has its Packs tab
  (redundant with the Home Library now, but harmless). Worth removing later.

## ✨ Polish round (post-feedback, verified on-device)
Addressed direct feedback on the first Home cut:
- **iPad no longer cramped.** Home widened to `max-w-5xl` with a responsive
  **experiences grid** (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`) — fills the
  width instead of a narrow center column.
- **Phrase drill reframed.** It was a generic "Continue learning" + AI-sparkle
  CTA that just opened the flipper. Now it's a **named experience — "Phrase
  Flip"** (working name, one constant `PHRASE_NAME` in HomeHub; rename freely)
  with a **Brain** icon (the "brains" feel), presented as the featured card
  above a grid of **peer** experiences (Parlometron, Earthgate/Stargate readers,
  World Radio, games) — each with its own identity icon, Open/Get inline.
- **Pack management** stays in Settings → Packs (Home = launch, Settings =
  manage) — resolves the earlier cramped PacksListing-on-Home.
- **Fixed**: the phrase overlay's Home button overlapped the level/domain
  MetaChips — moved to the top-right (chips own top-left).
- Added gentle `fade-in` entrances to Home + the experience overlays.
- **Verified on-device (iPad landscape, vw 1376)**: Home fills width; Earthgate
  launches from the grid (full audiobook reader); `corpan:exit` returns to Home
  for a real pack (not just native). Screenshots `/tmp/home4.png`, `/tmp/reader.png`.

## ✅ Single-language stacks (every pack works with ONE language)
New rule (immersion / native practice / kids): no pack requires a target
language. `languages[0]`=primary/native, `[1..]`=targets; one-language stack =
that language is the content. Doc: `packs/SINGLE_LANGUAGE_RULE.md`.
- **pronunciation-coach (Parlometron)** — removed the "Set up at least one
  target language" gate (solo + multiplayer); `pickTranslations` short-circuits
  at `length ≤ 1` to practice `languages[0]`. Built clean.
- **hover-runner** — was degenerate (translation-match → phrase-to-itself).
  Redesigned to **listening-match**: phrase is spoken (`hostApi.speak`), written
  form hidden during play, gates carry the correct text among same-language
  distractors, revealed on a correct match. Built clean.
- **juice-squeeze / quest-ear / earthgate / stargate / world-radio / hanzipan /
  Phrase Flip** — already work with one language (verified by inspection).
- **PENDING on-device QA**: Parlometron + hover-runner are installed from the
  catalog, so the device won't pick up the locally-rebuilt `dist` until those
  packs are redeployed/reinstalled. Code + builds are done; the on-device
  confirm needs a pack redeploy (or a dev sideload of the rebuilt dist).

## ✅ Home polish round 2 (post-feedback)
- iPad width fixed (4-col experiences grid); phrase drill reframed as named
  "Phrase Flip" (Brain icon) among peers; Home-button/MetaChips collision fixed.
- **Subscription "Unlock everything"** now spans the grid width on Home
  (added optional `wrapperClassName` to `SubscriptionOffer`; capped elsewhere).

## ⛔ Phase 3 — Phrase drill as a pack (DEFERRED — deliberate)
NOT done tonight, on purpose. The phrase experience already runs as a native
experience launched from Home (the UX-level goal). Pack-ifying it is pure OTA
plumbing — **invisible** to users, **high-risk** to do blind (it's the core
loop). The enabling Phase-0 HostApi surface is already shipped, so it's ready to
execute *with on-device QA*. Plan §Phase 3 has the full sequence (build
`packs/phrase/`, bundle in-app, keep MainExperience as load-failure fallback,
flip shell, then prod-publish — the prod catalog/flip stay human-gated).

## Dev infra added this session
- `scripts/dev/ipad/{cdp.sh, ipad_cdp.py (fixed), screenshot.py (new), doctor.sh}`
  — full CDP control + pixel screenshots over the running tunneld. `doctor.sh`
  verifies the whole pipeline.
- `src/util/devKeepAwake.ts` — DEV-only screen wake lock (wired in `main.tsx`),
  keeps the iPad awake for the debug loop. No-op in production.

## Status: Phases 0–2 DONE, tsc + `npm run build` GREEN, verified on-device.
The device was reset to a clean Welcome so you can experience the new flow from
the top. Try: Welcome → pick a primary → "What brings you to Corpán?" → a
journey → calibration → … → Home. Then launch the phrase hero and tap Home.

## Open items / morning QA checklist
- [ ] **Translate the new keys** into ~50 locales: the keys are added to
      `public/locales/translate_corpan_plus_keys.py` (`EN_FLAT`); run it with
      Vertex creds (`--apply`). Until then non-en UIs show English fork/
      calibration/home text via i18next fallback (works, just not localized).
- [ ] Walk learn-with-a-real-target (add a 2nd language in PickLearning →
      calibrateLearn should interpolate that target, not the primary), polyglot,
      and child journeys end-to-end on-device.
- [ ] Verify a non-Latin / RTL primary once translations land (spoof
      `navigator.language` via `scripts/dev/ipad/cdp.sh`, or change OS language).
- [ ] Verify exiting a real **pack** (not just native phrase) returns to Home —
      same unified `corpan:exit` handler, but confirm with e.g. Hover Runner.
- [ ] Decide: remove the now-redundant Settings → Packs tab (Library lives on
      Home now).
- [ ] Phase 3 when ready (see above) — with on-device QA, prod parts human-gated.

## How to drive/verify (the pipeline built earlier)
`bash scripts/dev/ipad/doctor.sh` → all green. `scripts/dev/ipad/cdp.sh
eval|click` drives the live WebView; `scripts/dev/ipad/screenshot.py x.png` for
pixels. Frontend hot-reloads through the running `npm run tauri ios dev`; after
edits, `cdp.sh eval "(()=>{location.reload();return 1})()"`.
