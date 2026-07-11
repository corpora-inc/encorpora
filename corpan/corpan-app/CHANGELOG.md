# Changelog — Corpán (core app)

All notable changes to the Corpán Tauri app are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

### Added
- **Game interludes in the scroll — drop into a game for one phrase, then keep
  scrolling.** A lightweight pack activity (e.g. Lingo Hero) that drills the
  phrase you're on now shows as a compact "sip" card — a small squared-off
  poster with a Play affordance reading "Quick game · one phrase" — instead of a
  full-height game launch. Tap it, play one round for the injected phrase, and
  the feed grades your result and scrolls straight on. Heavy 3D drop-ins stay a
  full poster + cold mount. A repeated lightweight interlude now warm-mounts
  (its code stays resident between launches) so it opens instantly with no
  loading gap; a pack error can't break the scroll around it. (`InterludePoster`,
  `PackActivityCard` interlude branch, runtime `interlude` flag on packActivity
  cards, `ContentPackHost` warm-mount LRU seam.) New i18n keys
  `journey.interlude.gameCue` / `journey.interlude.readerCue`.
- **Wordfall (game) and Drift (reader) now appear as scheduled interludes in the
  Journey scroll.** The scroll drops in a Wordfall catch-the-meaning spike every
  ~12–18 cards and a Drift micro-story breath every ~20–30 — both drilling the
  phrase you're on now, then scrolling on. The mixer's interlude selection is no
  longer hardcoded to one pack: it picks among whatever interlude-capable packs
  are installed, classified as a game spike or a reader breath by their catalog
  `packType` and keyed by their declared `activities` (a hot combo pulls a
  reader comedown, a cold stretch a game re-ignite; never two interludes
  back-to-back). Both packs auto-install as tiny system packs (no nagging
  prompt). (`journey/interludeRegistry.ts`, mixer `chooseInterlude` +
  `FeedConstraints.interludes`/`combo`, `runtimeWiring` interlude registry,
  `packType` on `CatalogGame`, `web/pages/build.js` forwards manifest
  `activities` + `systemPack` into catalog-v3, `web/data/packs.json` entries.)
  No new i18n keys (reuses the interlude cues above).
- **The Journey feed now feels like a premium object in the hand.** A tactile
  juice pass across the whole scroll: correct answers land with a soft haptic
  and a warmer, felt-mallet chime whose pitch rises as your streak climbs; the
  card-to-card advance gets a hair snappier at high combo and exhales back to
  calm when the streak breaks. A small ambient momentum gauge in the corner
  fills and warms with your run — no shouting number, you read your streak off
  the feel. Celebration bursts are now sparse and refined rather than confetti
  spam. The live-speaking card is elevated: a breathing mic cue, a framed
  waveform surface, and the pronunciation confidence read now resolves in a beat
  after the ✓/✗ and fills with the accent colour on a strong score. Every part
  is reduced-motion and sound-off first-class — the feed is fully understandable
  silent and still, and haptics honour the same setting as sound.
- **Journey is an infinite feed — doom-scroll to fluency.** The lesson feed no
  longer winds down to a "caught up" screen. Once you hit the day's goal, an
  eager learner who keeps going gets fresh, varied cards indefinitely: the next
  units' new words are pulled forward (respecting prerequisites), difficulty
  escalates as you master material, and activities and items rotate so you never
  see the same word or the same exercise twice in a row. Your daily target is now
  a milestone you can blow past, not a wall. The only time the feed ends is when
  there is genuinely no material left to serve. (Spaced repetition is unchanged:
  reviews still come due on schedule and the review-debt brake still protects you
  — only new-word exploration and variety are uncapped for a continuing learner.)
- **Journey is speak-first when Whisper is available.** When on-device speech
  recognition is usable, production and echo moments become live, Whisper-graded
  speaking instead of tap/type: the new-word "listen & echo" debut and a strong
  share of "type what you hear" cards now ask you to say it aloud and are scored
  by Whisper. Installing a Whisper model also visibly increases how often live
  speaking appears in the mix. Fully graceful — if you can't speak right now,
  declining the mic reverts the whole session back to typing, and no card ever
  forces speech with no way out. Some typing practice is always kept for variety.
- **A live mic waveform while you speak.** The pronunciation card now shows a
  small animated waveform driven by your real microphone level, so it reads
  unmistakably as "I'm listening to you now." Hosts without a level signal fall
  back to a gentle breathing animation; respects reduced-motion.
- **A confidence read on spoken answers.** After a graded speaking card, a small
  accuracy percentage appears beside the ✓/✗ — a quick, satisfying read of how
  close your pronunciation was, not just pass/fail.

### Fixed
- **Checkpoints no longer loop forever once you're caught up.** When the day's
  goal was met and nothing was due, the session could serve the same known-item
  practice endlessly and re-show a checkpoint every few cards — tapping
  "Continue" appeared to reload the same screen with no way to finish. A
  checkpoint is now a genuine milestone that never repeats identically and never
  appears twice with no real content between; tapping "Continue" always advances
  into fresh, varied cards (see the infinite-feed change above).
- **The next-card hint no longer looks like a blank drawer.** After a correct
  answer the "swipe up to continue" affordance was a card-coloured sliver pinned
  to the bottom and nudged down 24px, so on gesture-nav phones it read as an
  empty card clipped by the home indicator. It is now a gently bouncing upward
  chevron sitting fully above the safe-area inset — an unmistakable "swipe up"
  cue, never a blank box — and it hides while a card is auto-advancing.
- **A word's meaning shows inline when it is the only extra.** For a word with a
  meaning but no in-context example (e.g. a number like "one"), the enrichment
  card used to be just a lone collapsed "meaning" toggle in an empty-looking box;
  the meaning now expands by default so the card carries real content. Words that
  also have an in-context example keep the tap-to-expand meaning as before.

## [0.20.2] — 2026-07-08

### Added
- **Journey offers the `imagepan` picture pack with one-tap consent (no silent
  download).** When a compatible concept-picture pack is available in the index
  but not yet installed, an understated in-feed offer appears ("Add pictures")
  showing the download size read **dynamically** from the catalog entry
  (`sizeMb`) — ready for the pack to grow to thousands of images. **Install**
  downloads with a progress bar, registers in the installed-data-pack registry,
  and picture exercises begin mid-session (the resolver is invalidated, no
  restart). **Not now** is remembered persistently so the offer never nags. Its
  WebP images serve over the existing `corpan-pack://` scheme. Fully graceful:
  an already-installed pack lights up from the first card with no re-consent,
  and when the index is unreachable / the pack is absent there is no offer and
  no image cards — normal text cards exactly as before.

### Changed
- **imagepan is no longer auto-installed on first Journey open.** The prior
  silent ~1 MB download is replaced by the consent offer above; Journey only
  *recognizes* an imagepan that is already on disk at session start.

### Fixed
- **Journey no longer serves degenerate exercises.** Single-token items (e.g.
  "jam", "ship") could be dealt as a fill-the-gap with no gap or a
  tap-in-order with a single tile. The activity mixer now never assigns
  `cloze`/`word_order` to single-token item kinds, and a runtime safety net
  reroutes any that slip through to a coherent activity instead of rendering a
  broken card.
- **Match-the-pairs never shows the same tile twice.** Two items sharing a
  target surface or a native gloss could produce duplicate tiles that the
  independent column shuffles let sit side by side; columns are now de-duplicated
  before the pair cap.
- **Cloze/word-order render gracefully when context is thin** instead of a bare
  "____" or a one-tile "reorder": they fall back to a reveal-and-continue card.
- **No more blank card after a correct answer, and nothing is clipped by the
  device safe area.** The feed's next-card peek is now a thin affordance sliver
  (never an empty content card) and the feed respects `safe-area-inset`.
- **You can redo a completed exercise.** Scrolling back to a finished card now
  clears its answer so you can try it again; the retry re-grades as an extra rep
  without re-charging quota, streak, or stats.
- **Journey reuses an already-installed Whisper model** instead of offering a
  redundant download. Speech scoring now discovers a usable model already on the
  device (shared with pronunciation-coach) and prepares it, only offering an
  install when nothing usable exists anywhere.
- **STT install progress now shows on Android.** `hostApi.stt.installModel` now
  passes a Tauri `Channel` (`onEvent`) alongside the existing `install_progress`
  plugin listener. Android delivers download progress only through that channel,
  so without it the "Install" button ran the download silently and looked dead.
  iOS keeps using the plugin-event path (the extra arg is ignored there).
- **Declining speech ("Not now") no longer strands you** on a dead speak card —
  the card settles and advances immediately (and remaining speak cards swap to
  the typed fallback for the session).
- **Swipe-to-skip is reliable.** The confirm window was widened and a clear
  "swipe again to skip" hint added, so one confirmed double-swipe advances
  instead of requiring many swipes.
- **Word-explanation packs say which language they explain.** Settings now shows,
  under "Explicaciones en español", a second line naming the explained language
  (e.g. "English words"), read from the pack's `targetLang` metadata — so a
  learner of several languages can tell EN from a future DE pack. No language is
  hardcoded.

### Changed
- **A brand-new learner starts with useful language, not pronunciation drills.**
  The Journey EN launchpad is reordered communicative-first: greetings and
  courtesy (hello, please, thank you, yes, no, how are you…) come first;
  minimal-pair sound contrasts (ship/sheep, jam/yam…) move to a later phonology
  unit. The engine also keeps pronunciation-contrast items from dominating the
  opening feed.
- **Onboarding: the guided Journey now reads as the primary way to learn.** The
  learner-path fork is reframed from "Want a guided path?" (an opt-in) to "How
  do you want to learn {{lang}}?", with **Guided daily path** listed first and
  **Self-paced** second, each with a one-line subtitle.

### Removed
- **Onboarding: dead-code landing presets.** The comfort/level calibration
  screens (enjoy/learn/child) and the polyglot fork option wrote a `landing`
  intent into the draft that nothing read — the final "Where should we begin?"
  question and Journey opt-in always determine the landing. Removed for a single
  source of truth. No behavior change.

## [0.20.1] — 2026-07-07

### Added
- **Journey words in context.** After a word exercise settles, a compact card
  shows that word inside a real corpus phrase (with its translation) plus a
  tap-to-expand meaning/etymology snippet — killing the "see the same word
  translated over and over" feel. For a share of repeats, a met word is
  practiced as fill-the-word-in-a-real-sentence rather than in isolation
  (grading still tracks the word itself).
- **Journey etymology gems gained a usage line.** The rare word-story card now
  shows the word used in a real sentence beneath its origin paragraph.
- **Journey grammar cards show a contrast with your language.** When the course
  carries an L1 contrastive note (e.g. how English adverb placement differs from
  Spanish), it renders beneath the rule for that learner's language.
- **On-device tutor-moment design + prompt foundation.** A tested, framework-free
  prompt builder for an end-of-lesson Qwen3 recap in the target language; the
  live streaming card is specified and deferred (see
  `docs/journey/specs/llm-cards.md`) pending an LLM runtime seam and on-device
  verification.

### Changed
- **Journey speak cards now reach real pronunciation scoring.** When on-device
  speech scoring is supported but the model isn't installed yet, the speak card
  shows an inline install offer (what it is, download size, one-tap install with
  progress) instead of silently swapping to typing. Declining stops speak cards
  for the rest of the session; installing flows straight into hold-to-record
  whisper scoring with per-word feedback.
- **Journey word cards show the learner's own language.** Word exercises now
  resolve a native-language gloss from the course pack (e.g. an ES learner sees
  "ship" paired with "el barco", and choose-the-translation distractors are
  other words' Spanish glosses), instead of an English word matched to itself.
  When a gloss is absent, the card reroutes rather than showing a same-language
  pair.
- **Match-the-pairs cards show several pairs.** A pairs card now presents a set
  of 4–6 items to match (drawn from the unit and neighbouring material), not a
  single trivial pair; each pair is scored on its own.
- **Journey cards flow hands-free.** Answered cards now advance on their own
  after a brief countdown (with a tap-to-pause ring), and Continue on an intro
  or flashcard advances the instant you press it — no more settling on a card
  with nothing happening until you discover the swipe. Swipe still works as a
  manual override and to look back.
- **Flashcard (flip) cards drop the self-rating.** Reveal the answer, hear it,
  and continue — no "did you know it?" buttons.
- **Journey clears the notch and gesture bar.** The top ribbon sits below the
  status bar and content clears the home indicator on edge-to-edge phones; the
  page behind the Journey no longer scrolls under it.
- **Placement result names where you landed.** It shows the concrete unit and
  its level; when you place past the current content it says so honestly and
  starts you at the deepest unit rather than an empty screen.

### Fixed
- **No more fake "correct" on intro cards.** Listen-and-echo intros settle
  neutrally — they never stamp a green check or celebrate a card that was never
  graded.
- **Choose-the-translation and match-pairs never show one language on both
  sides.** If a needed translation face is missing the card falls back to a
  listening form instead of a same-language card, and match-pairs always pairs
  the target with your language.

## [0.20.0] - 2026-07-06

### Added
- **Automated mobile release pipeline — proven end-to-end.**
  `.github/workflows/release-mobile.yml` builds signed iOS + Android on a version
  bump to `main` and ships to TestFlight internal + Play internal testing (no
  manual MacBook/Transporter step). Version bumping via
  `scripts/bump-app-version.mjs`; one-time credential setup in `RELEASE_SETUP.md`.
  0.20.0 is the first release cut this way — both platforms uploaded green.
  Hardened for a real repo checkout: Git-LFS fetch (icons + DB), whisper.cpp
  vendored/built in CI for the STT plugin (iOS XCFramework + Android JNI), CI
  rewrite of the machine-specific `.cargo/config.toml` NDK paths, `buildSrc`
  regeneration, manual iOS signing with an ASC-API-minted profile, a
  profile-pinned `xcodebuild -exportArchive`, jarsigner AAB signing, monotonic
  version codes, `macos-26`/Xcode 26 (iOS 26 SDK), and build/toolchain caching.
- **Journey browser demo harness (dev-only)** — `journey-demo.html` mounts the
  REAL JourneySurface + engine + resolver over the real `journey_en` pack
  content in a plain browser (no Tauri): `scripts/journey-demo/precompute.ts`
  emits `public/journey-demo/course.json` (gitignored), `src/journey/demo/`
  wires JSON-backed ResolverDeps ports, `scripts/journey-demo/verify.ts`
  proves ≥10 cards headless over the JSON.

### Changed
- **Journey W11 round 2 — engine calibration: the §3 mechanism bundle was
  validated and rejected; the tuning surface shipped instead.** The
  CALIBRATION.md round-1 bundle (`DESIRED_RETENTION` 0.85, throttle
  down-target 1.0×capacity, leech 4-lapse/2.5-ratio) was implemented and
  swept against the P-gates: every red gate moves the right way (P1 median
  due 2.10→1.66, P3 review:new 35→14:1, P4 struggle 52.8→48.6%, lapser
  drain 11/12) but none reaches its bound, while P7 strand convergence
  collapses (noise-limited at thinner daily volume) and P10 leech
  containment blows to ~7% vs 3% — so per the no-regression rule the
  behavioral values stay at 0.90 / 1.5 / 6-2. What ships: throttle ratios
  and the strand control law extracted to `constants.ts`
  (`THROTTLE_HARD/DOWN/UP_RATIO`, `STRAND_CONTROL_EXPONENT/MIN/MAX` —
  engine.md §1.1, behavior-preserving), the never-wired
  `STRAND_OVER_WEIGHT` deleted, the sim runner's leech mirror reading the
  real constants, leech/scheduler tests parameterized, and
  `scripts/journey-sim/CALIBRATION.md` §6–§10: full before/after 3-seed
  gate matrix, the sweep table, evidence-backed spec-amendment
  recommendations for P1/P3/P4 (root cause: the §7.1 fixed-ability learner
  makes them unsatisfiable — recommend amending the learner model), P7's
  max-over-days metric, P8's ±0.6 tolerance, and a NEW P11 baseline
  failure (relaxation rate ~0.3 vs 0.2, pre-existing from the W10
  integration era, needs its own workstream).

### Fixed
- **Offline image cache: deflaked the cross-test background-write leak.** A
  prior test's fire-and-forget LRU touch / fill / budget sweep could land in
  the next test's freshly-reset singletons under CPU load and flip a cache hit
  into a miss (a ~1/300 CI flake in the corpan-app test suite). Background work
  is now tracked and drained between cases via `__settleImageCacheForTests()`;
  the production path is unchanged (the tracker is a transparent pass-through).
- **Journey W11 — R10 placement ladder respects the pack's actual b range**
  (the W10 P8 bug). Phase-1 rungs are now the global CEFR ladder span
  clamped to the installed pack's `[minB, maxB]` and re-subdivided evenly (a
  full-span pack reproduces the spec ladder exactly); the "above-content"
  early exit additionally requires a supported estimate (se ≤ 0.7), so
  mid-band learners on a narrow-band pack no longer get routed out of the
  course off two ladder passes with θ̂ pinned above the ceiling. Above-content
  finalize now pins θ̂ to `maxB + margin` (no discriminating items exist
  beyond the ceiling) and returns the last unit's skills as a usable in-pack
  frontier (R10 "end of shipped content") instead of an empty list. Final
  placement θ̂ is a 1PL MAP refit over the full probe transcript (the running
  Elo iterate still drives item selection per engine.md §4.3); golden
  placed-intermediate transcript regenerated under §8.3 with this
  justification. `journey-sim --p8` also instruments the wrong-placement
  self-heal cohort (10% injected over-placements; heal = week-one rewind or
  placement-seeded skill demotion ≤14d). P8 vs the real journey_en pack,
  40 learners × seeds 1/2/3: self-heal 4/4 on every seed, above-ceiling
  2/2·1/1·2/2, in-band ±0.6 accuracy 74%/88%/91% vs the ≥90% bar — at the
  information floor of ≤25 guessable probes (σ ≈ 0.40, unbiased); the
  evidence-backed P8 spec-amendment recommendation is in
  `scripts/journey-sim/CALIBRATION.md`.
- **Journey W12 — catalogs are offline-cache native (D12 phase 2).** The
  three catalog stores (game/reader v3 catalog, phrase-pack catalog,
  word-pack index) now delegate their fetch bodies to the shared
  offline-cache layer (`cachedFetch` + `subscribeJson`): one place owns
  TTLs, ETag/Last-Modified 304 revalidation, IndexedDB persistence,
  singleflight and the never-clobber-on-failure contract. The v3 catalog
  caches the RAW body and filters at read time, so toggling dev-packs
  mode or upgrading the app re-filters instantly with zero network (the
  old force-refetch on devMode change is gone). Store public APIs are
  unchanged. A zustand version-2 migration seeds the offline-cache
  records from the legacy persisted catalogs, so upgraded devices render
  offline cold-start without a refetch (phrase/word seeds keep their
  validators for a 0-byte 304 first poll). The legacy inline
  catalog-refresh loop in App.tsx is retired — the offline-cache triggers
  (startup / foreground / online / jittered interval) own the refresh
  cadence now.
- **Journey W12 — rung-3 distractor top-up is wired.** The resolver's
  random top-up (phrase-kind pathological starvation only) now draws from
  the host's filtered random-entries surface (levels + languageCodes
  scoped to the learner's stack) instead of an empty stub; a missing seam
  or host error degrades to a shortfall report, never a crashed card.
  Top-ups only feed the sampler pool — selection stays on the card PRNG.

### Added
- **Journey W10 — real-pack P8 placement gate** (`journey-sim --p8`). The
  simulation CLI can now run the R10 placement-quality gate against the
  REAL built `journey_en` pack (w6Smoke loader precedent): a cohort scoped
  to the shipped arcs (ability drawn around the pack's content band) is
  placed via the live probe controller; graded on |θ̂ − a| ≤ 0.6 within
  ≤25 items (≥90%) + above-ceiling learners terminating "above-content"
  within the Phase-2 budget. First run (seed 1, 40 learners): **FAIL —
  29/39 in-band (74%)**; dominant mechanism: on this single-band
  (preA1/A0, b ∈ [−3.5, −1.5]) pack the ladder's second rung IS the
  content ceiling, so mid-band learners who pass both low rungs exit
  "above-content" after 2 items with θ̂ pinned at −0.72. Not tuned —
  calibration is W11's lane. The wrong-placement self-heal sub-criterion is
  not instrumented in this mode (reported in the gate detail).
- **Journey W10 — the Journey is live in the app.** `App.tsx` mounts the
  guided feed as a full-screen sibling overlay of HomeHub (the activeGame
  state-machine pattern; the pack overlay stacks above the still-mounted
  feed, exit rides `corpan:journey-exit`). `buildJourneyDeps`
  (runtimeWiring.ts) assembles the production runtime: JIT course-pack
  install from the journey index, the normative CourseGraph loader
  (targetLang from `pack_meta.target_lang`), the real engine over the shared
  local-analytics persistence, resolver over a live HostApi, the
  `journey_daily` gate, `localAnalyticsRecord` (the one `activity_result`
  writer), the single-owner activity session, STT probes off the whisper
  plugin (`stt.isAvailable`/`prepare`, fail-closed — speak_echo degrades to
  listen_type as before), and streak-v2 book-day providers (progress.ts
  `lastOpenedAt` → journey `YYYY-MM-DD` days; the two date formats are
  reconciled in the provider). HomeHub gains the flagship Journey hero card
  (existing `journey.*` locale keys; shown only when a course pack is
  installed or published for the user's target). Onboarding gains the
  journey opt-in + placement-offer nodes (data-driven; "I'm new" pre-declines
  the in-surface probe offer) and a "Follow the Journey" option on the final
  landing question; `LandingIntent` gains `{ kind: "journey" }`. New
  `onboarding.journey.*` copy ships in all 54 locales.
- **Journey W10 — `journey_daily` quota row** (feed-ux §7, R12). The shared
  monetization registry (`packs/shared/monetization/src/quotas.ts`) gains the
  journey gate: packId `corpan_app`, dailyLimit 60 (a provisional default
  pending the operator's free-tier N decision — remote-config overridable
  like every row), softNagEvery 0, unitLabel "cards". NEW-INTAKE-ONLY
  debits: only completed debut cards + pack-anchor launches meter;
  due-review / replay / repair are never metered. `journey_daily` joins the
  `PaywallSurface` union; `createJourneyQuota` now resolves the real
  `createDailyQuota` gate (which owns the `corpan:daily-locked` dispatch)
  and reports the live registry limit.

### Fixed
- **Journey W10 — engine fixes (W4's observations).** (a) `EngineCard.meta`
  now carries `unscored` for presentation-only cards (debut intros, cadence
  faces, offers) — the surface reads the engine flag instead of inferring by
  activityType: unscored cards no longer bump combo/new-count or earn
  "perfect" celebrations. (b) The §5.4 same-type-adjacency invariant now
  covers the BATCH SEAM: the mixer remembers the previous batch's tail type
  and both the type chooser and the adjacency repair avoid it for the next
  batch's head — this was the mechanism behind two adjacent `intro_echo`
  cards. Goldens regenerated (spec-cited: engine.md §5.4 adjacency
  invariant; only card-type/order picks drift, grades/θ untouched). (c) New
  `engine.requestUnitReview(unitId)` (≈25 lines): enqueues a practiced
  unit's seen items as session replays (unmetered, once-per-session,
  existing gap discipline); PathViz's tap-to-review affordance is wired to
  it through the runtime.
- **Journey W10 — seam fixes.** The journey pack-poster card
  (`PackActivityCard`) renders its art through `<OfflineImage>` (cached →
  remote → glyph, R15) and enriches the poster name/artwork from the
  installed-games registry + (localized) catalog entry instead of showing
  the raw provider id. The shared reader shell (`packs/shared/catalog`
  `appShell.ts`) now passes the feature-detected `hostApi.offlineCache?.
  imageSrc` resolver into `createNarratorDetail`, so narrator art resolves
  from the offline cache too.
- **Journey W10 — authoritative targetLang** (item 15, flagged by W3 + W6).
  The CourseGraph loader (`util/journeyPack.ts`) now carries
  `pack_meta.target_lang` on the graph, and the engine's GraphIndex prefers
  it over the courseId derivation — which lowercases BCP-47 region tags
  (`journey_pt_br` → `"pt-br"`, wrong for `pt-BR`). Fixture graphs without
  the field keep the derivation fallback.

### Changed
- **Journey W10 — file re-homes** (1:1, no logic change): the journey meta
  store moved `src/journey/store.ts` → `src/store/journey.ts` (house
  convention keeps stores in `src/store/`), and the capability pop-in trio
  (`CapabilityPopIn.tsx`, `usePhrasePopIn.ts`, `popinBus.ts`) moved
  `src/journey/popin/` → `src/components/capability/` (their spec home,
  capability-modules.md §5). All imports updated.

### Added
- **Journey W10 — boot wiring** (integration). `main.tsx` configures the
  on-device local-analytics recorder with the live active-stack id
  (`configureLocalAnalytics({ getStackId })`, early, before any surface
  records); `App.tsx` registers the offline-cache resource table + installs
  the revalidation triggers once at mount (`registerCoreResources()` +
  `installTriggers()` — coexisting with the legacy inline catalog-refresh
  loop until the phase-2 store migration); dev builds gain the storage
  doctor on `__corpanDebug.storage.*` (`installStorageDoctorDebug()` via
  `util/devDebug.ts`, tree-shaken from production).
- **Journey W10 — pack-facing host seams wired** (integration). `hostApi`
  now carries the three reserved shared seams: `storage`
  (`buildPackStorageApi` — pack-scoped durable KV, storage-analytics.md
  §5.1), `localAnalytics` (`buildPackLocalAnalyticsApi` — namespaced writes +
  own-aggregate reads, §5.2), and `offlineCache`
  (`createOfflineCacheHostApi` — cached image URLs + cache-first JSON, D12).
  Advertised via `__CORPAN_HOST_CAPS.storageKv: 1`, `localAnalytics: 1`, and
  `offlineCache: true` (app-wide in `main.tsx` + the ContentPackHost merge);
  mirrored in the pack SDK typings. The on-device `activity_result` event
  keeps ONE writer: the journey runtime's `submitResult`, the terminal
  handler of `hostApi.journey.reportResult`'s ingest path (documented at the
  seam).
- **Journey W2 — offline-first cache layer + Home covers offline**
  (`docs/journey/specs/offline-cache.md`, D12). Catalog cover art now renders
  offline (cached on device after first sight) — airplane-mode cold start
  shows Home with covers instead of broken/empty images. One shared cache
  module at `src/lib/offlineCache/`: `cachedFetch(resource)` (cache-first
  JSON with policy TTLs, stale-while-revalidate, subscriber notify,
  single-flight coalescing; network failures never clobber the last-good
  record) wrapping the proven `fetchJsonFresh`; an immutable-by-URL image
  cache (fs blobs under `corpan-packs/.offline-cache/img/`, downloaded by
  the new Rust `offline_cache_put` command — reqwest so no CORS, atomic
  tmp+rename, 8 MiB ceiling — served by the existing `corpan-pack://`
  protocol, LRU-evicted at 64 MiB / 512 entries, persisted index + in-memory
  mirror for flash-free warm renders, throttled orphan sweep + `repairImage`
  self-healing); `<OfflineImage>` (cached → remote → glyph fallback, never a
  broken image) now backing HomeHub tiles, pack screenshots, the launch-
  transition collage, and the onboarding tour; `prefetchImages` pre-warms
  covers on every catalog update; `installTriggers()`
  (startup/foreground/online/interval, jittered) ready for the W10 App.tsx
  wiring; the §3.2 per-resource policy table (catalog-v3 RAW-body caching
  with read-time `filterCatalogForApp`, phrase-pack, word-pack, journey
  index — TTL 300 s); `createOfflineCacheHostApi` defines the additive
  `hostApi.offlineCache` seam (W10 wires it into types.ts/hostApi.ts).
  Rust: `offline_cache_{put,delete,list}` registered in `lib.rs`.
- **Journey W4 — the feed surface** (`docs/journey/specs/feed-ux.md`,
  R5/R8/R12/R14/R15 applied). `src/journey/`: `JourneySurface` (z-1050
  overlay sibling, dark/light + RTL, placement-first mount, PathViz overlay,
  `corpan:journey-exit`), `FeedScroller` (3-slot window, framer-motion drag,
  read-only scroll-back over a 20-card ring, double-swipe skip semantics,
  listening-run hands-free pill, per-card-type advance rules), the TEN native
  renderers (registry-driven off `ACTIVITY_TYPES`; params/distractors from
  the W5 resolver's typed builders; one-tokenizer rule; `speak_echo` mounts
  `@shared/capabilities/pronounce` with `startPaused` + the R3 stt envelope
  incl. `flags.sttUnavailable` listen_type degradation), host-owned
  `CelebrationLayer` (4 juice tiers, intensity setting, reduced-motion-aware
  canvas particles, pentatonic chimes that never talk over TTS),
  `CheckpointCard` (equal-weight stop/continue, daily ring, deep-session
  line, quota counter) + boss/arc-gate banners + `WelcomeBackCard` +
  `BlockIntroCard` (the ONLY runtime-synthesized card, R5), `RareCard`
  shimmer wrapper with delight/etymology-gem/time-capsule/pack-poster faces,
  `PlacementFlow` (≤3 framing screens, probe mode, honest R10 above-content
  copy, streak pact card), PathViz P0 arc→unit ribbon, streak v2 (rest-day
  tokens, repair-by-learning, milestones; `corpan-journey-v1` store),
  `runtime.ts` (engine+resolver+activitySession wiring, EngineCard→FeedCard
  1:1 mapping, THE one R12 quota-debit site: completed debuts + pack-anchor
  launches only), capability registry + `CapabilityPopIn`/`usePhrasePopIn`,
  and local-analytics session/card-impression/activity-result events.
  All ~124 journey UI keys shipped in all 54 locales. Tests: runtime/streak/
  advance-rule units + a headless jsdom smoke test driving a full
  JourneySurface session (>= 10 cards) over the W6 fixture pack through the
  real engine + resolver.
- **Journey W11 — engine calibration study, round 1**
  (`scripts/journey-sim/CALIBRATION.md`). Reproduced W3's P1/P3/P4/P7 gate
  failures verbatim (seed 1); landed the constants-matrix sweep driver
  (`scripts/journey-sim/sweep.ts` + `sweeps/`), saturation diagnostics in the
  sim `cli.ts` metrics (`dueCurve`/`finalCapacity`/`modeTotals`) and a
  per-strand signed-deviation readout in the P7 gate line.
  `request_retention` extracted to `engine/constants.ts:DESIRED_RETENTION`
  (engine.md §1.1; value unchanged at 0.90 — no behavior change, golden
  transcripts untouched). A five-point desired-retention sweep shows the flat
  pace knob alone cannot satisfy P1/P3/P4/P7; the mechanism bundle for round 2
  and the spec-amendment fallback are documented in the study.
- **Journey W3 — adaptive engine + simulation harness**
  (`docs/journey/specs/engine.md`). Pure-TS adaptive core at
  `src/journey/engine/`: ts-fsrs 5.4.1 (FSRS-6, config verbatim, deterministic
  fuzz seeded from `fnv1a32(itemId)`), the §4.5 grade-derivation table with
  the R3 typed-detail envelope and R9 aggregate clamps, `applyResult` joining
  grades by `itemRefKey` (R6 — shuffled/subset-safe, un-issued refs dropped),
  derived skill mastery with dirty-seq + day-key memoization, the θ Elo
  scalar, 3-phase adaptive placement with the R10 content ceiling
  (`above-content` early termination) and a transcript-equivalent
  `placeUser()`, the feed mixer (DUE/REPLAY/NEW/REPAIR/TRICKLE/FUN pools,
  flow-mode + debt-brake + strand-balance quota adjustments, R5 lesson-recipe
  slots, unit-boss/arc-gate checkpoint batches with `pass_score` gating and
  REPAIR routing, cadence checkpoints, welcomeBack, seeded rare-card rolls,
  model-residency batching, constraint repair), leech
  flag/suspend/substitute handling, `newPerDay` throttling with the two-stage
  debt brake, jump/legendary gauntlets, an engine-level corruption-recovery
  ladder over the shared local-analytics log, and the `EnginePersistence`
  consumption seam (type-only import; in-memory fakes for tests/sim).
  Simulation harness at `scripts/journey-sim/` runs the §7 P-gates over 7
  synthetic personas against a generated 24-unit fixture course and
  smoke-loads the W6 fixture pack through the in-tree `loadCourseGraph`
  loader (P8 deferred to the real `journey_en` pack per R10).
- **Journey W1 — storage platform + local analytics substrate**
  (`docs/journey/specs/storage-analytics.md`). The quota-safe storage service
  re-homed to `src/lib/storage/` (old `src/util/storage/` paths keep working
  via one-release re-export shims), upgraded to IndexedDB schema v2 (additive
  `docs`/`log` stores) with typed adapters on top: `DocStore<T>` (versioned
  codecs, lazy migrate, corrupt records dropped + counted — never thrown),
  `AppendLog<T>` (O(1) appends, ring caps with hysteresis), `BlobStore`
  (Tauri-fs tier under `corpan-packs/.offline-cache/blob/`, servable via the
  `corpan-pack://` protocol; IndexedDB fallback in web dev), a shared
  `WriteBatcher` (one transaction per flush window; evict-retry then
  memory-mirror degrade), a central namespace registry with budgets, a
  three-level corruption-recovery ladder (record → namespace → database), and
  the Journey engine persistence adapter (`EnginePersistence`).
- **On-device local analytics** (`src/lib/localAnalytics/`): an append-only,
  never-uploaded event log (activity results, sessions, placement, streaks;
  100k-record / 48MB ring) with daily rollups and the aggregation queries the
  Journey engine and personal-records surfaces read (calibration report,
  strand balance, engagement snapshot, personal bests). This is the learner's
  own history — separate from (and invisible to) cloud telemetry. Includes
  host-side builders for pack-scoped storage (2MB / 1,000 keys per pack) and
  pack event recording (5,000/day rate limit), plus a dev-only storage
  doctor (`storageDoctor.report()` + `__corpanDebug.storage` wiring hook).
- New Rust `blob_store_*` commands (read/write/delete/has/stats/prune/
  served_url) backing the FS-BLOB tier; `validate_pack_id` now rejects the
  reserved `.offline-cache` directory so no pack id can ever claim the cache
  subtree.
- **Journey content resolver (`src/journey/content/`, Journey W5).** The seam
  between the engine's scheduled `ItemRef`s and renderable content, per
  `docs/journey/specs/content-resolver.md` (R14). `resolve.ts` resolves all
  seven item kinds against installed sources through a dependency-injected
  `ResolverDeps` port (phrase base+packs, wordpan pair DBs, hanzipan,
  narration-pack segment/audio files, course-pack grammar nodes / phoneme
  overlays / localized strings) into a typed `ResolvedItem` (display `text` vs
  spoken `ttsText`, display-aligned audio word timestamps). Missing content is
  never a blank card: unresolvable refs come back as typed `missing` reasons
  (incl. `preview_truncated` — no paywall surprises inside feed cards) and
  `contentMissingResult()` builds the §3.3 drop envelope
  (`abandoned + flags.contentMissing`). Per-session LRU caches are entry- and
  byte-bounded (shared ~4 MB pool; lazy hanzi stroke JSON kept out of it) with
  `invalidate()` for mid-session pack installs. `distractors.ts` is the ONE
  distractor source for every tappable wrong option: same-skill → near-b →
  random-top-up ladder, validity exclusions (answer/near-answer collisions
  after aggressive normalization, same-translation collisions,
  answer-language-only surfaces, recent-window dedup), deterministic under a
  per-card seeded PRNG, plus `seededShuffle` for match_pairs and the §4.7
  per-renderer needs table as typed param builders. Every SQL string carries
  an explicit LIMIT with a full-page truncation warning (R7 silent Rust cap).
  Test-only golden fixtures (`__fixtures__/`, in-memory `node:sqlite`) cover
  all kinds, all missing reasons, 1,000-case distractor validity properties,
  and determinism. Not yet user-visible: the feed runtime (W4) wires it up.
- **Journey course-pack catalog + install plumbing + CourseGraph loader
  (Journey W6, `docs/journey/specs/course-pack.md`).** Journey course packs
  are data-only SQLite packs (one per target language) on their own
  CloudFront index (`corpan/journey-packs/index.json`) — never in the main
  catalog, never on Home. New `contentPacks/journeyPackCatalog.ts` (typed
  parse, channel/minAppVersion gating, and a `schemaVersion` compatibility
  gate so an old app filters out unreadable course DBs BEFORE download),
  `util/journeyPack.ts` (explicit-packId install, pack_meta post-install
  verification, and the normative PackReader → CourseGraph loader: keyset
  pagination under the Rust 2,000-row silent-truncation cap + a row-count
  hard assertion against `pack_meta` counts — the engine never boots on a
  partial graph), and `store/journeyPacks.ts` (installed-pack registry,
  phrasePacks pattern). `CatalogV3Entry`/`CatalogGame` gain the optional
  `activities` declarations field, forwarded verbatim by
  `filterCatalogForApp` (activity-contract.md §4.3) so the Journey scheduler
  can plan anchor cards for not-yet-installed packs OTA. No UI wiring yet —
  the Journey surface consumes these modules in a later slice.

### Changed
- **Storage migrations M2–M4:** per-book reading progress
  (`corpan-progress-v1`), the word-pack catalog index
  (`corpan-word-pack-catalog-v1`), and per-stack phrase history
  (`corpan-history-v2`, now capped at 500 entries per stack) persist to the
  IndexedDB tier instead of the shared ~5MB localStorage budget. Existing
  data is moved by the idempotent boot migration (sentinel bumped to
  `corpan-storage-migration-v2`); legacy single-stack settings/history blobs
  are deleted after their one-time import, and the analytics
  last-language-by-book map is capped at 100 books.

### Changed
- **Word-explanation packs ship from a dedicated S3 index, not the main
  catalog (#477, #478, #479; supersedes #498's catalog registration).** Word
  packs ("wordpan") are a new kind of artifact that must never appear in the
  in-app catalog (`catalog-v3.json`) or on Home — they are discovered in
  Settings and the Phrase Flip long-press popover, and downloaded from a
  separate CloudFront index (`corpan/word-packs/index.json`), keyed by a
  (native→target) language pair, mirroring the phrase-pack catalog. New
  `contentPacks/wordPackCatalog.ts` (typed parse + channel/minAppVersion gating
  + pair resolver), `store/wordPackCatalog.ts` (5-min-TTL polled store), and
  `hooks/useWordPackCatalog.ts`. A new word-pack section in Settings lists the
  packs that explain words in the user's native language and installs them
  (≈3 MB) from the index `zipUrl`. The Phrase Flip long-press install path now
  resolves the same index `zipUrl` instead of a `packs.json` entry. The
  popover/lookup behaviour and tap-to-speak TTS are unchanged. New
  `wordPacks.*` locale keys (all 54 locales).

  Root-cause fix for the #498 leak: `web/pages/build.js` now excludes
  `packType: "data"` word packs from `catalog-v3.json` (and they stay out of
  the v1 catalog and the public packs page). Previously catalog-v3 included
  every non-`builtin` pack, so `listed: false` did NOT keep the entry off the
  Home picker — that was the bug. The `wordpan_es_en` `packs.json` entry is
  kept ONLY as a back-compat / website-landing route (gated `webListed:false`,
  `v1Listed:false`, `packType:"data"`); it no longer reaches catalog-v3 / Home.
  No published `voiceId` or version floor changed; no in-field client (≤ 0.19.2,
  which predates #498) ever discovered this pack via the catalog.

  GitHub Pages no longer publishes the word-pack zip (the #499 "Package
  Wordpan" + "Copy Wordpan into io/out" steps in `deploy-pages.yml` are
  reverted); the pack ships from S3.

### Added
- **Journey activity contract (W0, contract layer).** The host↔pack seam every
  Journey feed card rides on: new authoritative
  `contentPacks/activityContract.ts` (ItemRef + the one `itemRefKey`/
  `parseItemRef` serialization helper, ActivitySpec/ActivityResult with the
  typed `detail` evidence envelope, the `ACTIVITY_TYPES` native-renderer
  registry, `PackActivityDeclaration`, `JourneyHostApi`) and host-only
  `contentPacks/activitySchemas.ts` (Zod validation at the pack boundary +
  the single-owner activity session: both rails funnel into one ingest,
  per-item dedup by itemRefKey, first-terminal-wins, teardown synthesis from
  buffered per-item evidence — every begun session yields exactly one
  result). `hostApi.journey` typed rail (isActive/getSpec/reportItem/
  reportResult/abandon) plus the `corpan:activity-result` window-event
  fallback rail, both Zod-validated. `PackLaunchEntry.activity` launches a
  pack as an activity provider (spread into `mount(..., initialState)`;
  remount keyed on `specId` identity, not object identity);
  `__CORPAN_HOST_CAPS.journey = 1` advertises the contract version; manifest
  `activities` declares pack-provided activity types. All additive-optional —
  existing packs and standalone launches are unchanged. New dependency:
  `zod` ^4.4.3 (host-boundary validation only; never in the pack-facing SDK
  copy). Contract copies are generated by `node packs/sdk/sync-contract.mjs`
  (`--check` for CI drift).
- **Long-press word explanations in Phrase Flip (#477, #478, #479).** Long-press
  (touch) or right-click / long mouse-press (desktop) any English word in a
  phrase to open a popover explaining what it means, in your native language,
  with an English fallback when the native paragraph is missing — mirroring
  Hanzipan's native-first etymology lookup. The explanations ship as an
  on-demand, data-only content pack (`wordpan_es_en`, es→en first); if it isn't
  installed yet the popover shows a friendly "Install (≈3 MB)" prompt wired to
  the standard content-pack installer. A short tap is unchanged — it still
  speaks the whole phrase (TTS is not regressed). New `wordExplain.*` locale
  keys (all 54 locales). The feature is a no-op for native languages without a
  word pack yet.
- **Paywall pauses the active pack/reader (#436).** When the Corpán Plus
  paywall opens over a running pack or reader, the host now dispatches a generic
  `corpan:host-pause` window event (and `corpan:host-resume` when it closes),
  following the `corpan:host-dispose` convention. This is fired once at the
  paywall store's open/close chokepoint on a genuine closed↔open transition, so
  it never double-fires regardless of which surface triggered it (reader
  end-of-preview, Library "Unlock with Plus", engagement moments). Listeners
  already shipped: hover-runner (#459) pauses its game loop; the shared reader
  shell pauses narration audio (stargate/earthgate); lingo-hero's listener is a
  separate follow-up. No user-facing strings; no locale keys added.
- **PREVIEW badge on dev-mode-only phrase packs.** Phrase-pack cards now show a
  small amber **PREVIEW** pill when `pack.channel === "preview"` — the packs
  revealed only in developer mode. Stable packs stay unbadged. The label is an
  intentional literal (not localized) since it's a technical/dev marker (#468).
- **New "Semi large" text-size option.** Adds a size between Medium and Large
  (`1.1rem`, CSS class `text-semi-large`) to the text-size picker, and makes it
  the default for new profiles so default reading text is a touch larger. New
  `settings.semi-large` locale key added across all locales.

### Changed
- **Voice picker "Select all" is now a toggle.** When every available voice in
  every learning language is already selected, the onboarding/settings voice
  picker button flips to "Deselect all" (with an `X` icon) and clears the
  selection; otherwise it selects all as before. New `settings.deselectAll`
  locale key added across all locales.

### Security
- **Content-pack installer path-traversal hardening (native).** `pack_id` is
  now strictly validated (`validate_pack_id`: `[A-Za-z0-9._-]` only; rejects
  empty, `.`/`..`, path separators, NUL) at the top of every native path that
  interpolates it into a filesystem path — full-pack install
  (`download_and_install`), module install (`install_module`),
  `module_file_exists`, and `get_manifest_url`. A belt-and-suspenders
  canonical-containment check (`assert_within_root`) additionally asserts the
  tmp/staging/final/backup and module destination paths resolve inside the
  `corpan-packs` root before any write/remove. Previously `pack_id` from the
  catalog/module payload was interpolated raw, and the only id check happened
  *after* the paths were built.

### Reliability
- **Download stall watchdog (native).** Pack and module downloads now use a
  shared client with a 30s connect timeout and a 120s per-read (idle/stall)
  timeout instead of a bare `reqwest::Client::new()` that could hang forever on
  a wedged CDN socket. The per-read deadline resets as bytes arrive, so it does
  not break slow-but-progressing multi-GB model-pack downloads — only a stalled
  stream is failed (surfaced via the existing `pack-install-progress` error
  stage).

### Changed
- **Unverified-install visibility (native).** When the catalog provides no
  `expected_sha256`, the installer now logs a clear warning (full pack and
  module) instead of silently skipping integrity. Provided hashes are still
  enforced (mismatch hard-fails); free packs without a sha are not blocked.

## [0.19.2] - 2026-06-19

### Fixed
- **Store-notification reliability (server-side).** The receipt-verify Lambda's
  Apple ASSN and Google RTDN handlers no longer acknowledge a notification with
  HTTP 200 when a transient backend error occurs while processing it (a 200 ACKs
  the message and permanently loses it). A caught processing error — or a Google
  authoritative re-fetch that comes back unverified during a Play API outage —
  now returns a retryable 500 so the store redelivers; no partial work is done
  and the dedupe row is not committed, so the redelivery reprocesses cleanly
  (every write is an idempotent conditional put). Prevents silently dropped
  renewals/refunds/entitlement updates on transient failures.
- **Premium download entitlement gate (server-side).** `/verify-purchase` now
  issues a CloudFront-signed premium-narration download only when the requester
  is actually entitled to that ZIP, not merely because a receipt verified. An
  expired/lapsed subscription is denied (403) instead of getting the full ZIP;
  an active Corpán Plus subscription remains all-access. One-time book downloads
  are bound to the purchased product via the public catalog (the requested pack
  and ZIP path must match the verified product), closing a cross-product hole
  where any valid receipt could sign any premium ZIP. Active Plus subscribers and
  legacy book owners downloading their own content are unaffected.

### Changed
- **Smoother pack-launch transition.** In the first-run launch animation, the
  chosen card no longer snaps to full opacity the instant it climbs to the front
  of the shuffling deck (which abruptly hid the still-advancing shuffle). It now
  rises translucent — so the live shuffle reads through it — and only firms to
  fully solid as it settles dead center.

### Added
- **Phrase packs drawer: "Download all" and an "Available" lens.** The browser
  gains an **Available** filter chip (not-installed packs you can grab without
  paying — free packs plus anything unlocked by an active Plus subscription), so
  the existing **All** chip can stay a mix of installed and not. Every
  price/install chip now carries a live count badge that respects the active
  search + category facets. A sticky **Download all** bar batch-installs every
  installable pack in the current view (so "filter to a category, grab the lot"
  works), showing total count + approximate download size, a live
  "Installing N of M…" progress bar, and a tap-to-retry line if any pack fails.
  New strings localized across all ~54 locales.
- **Onboarding launch animation now ends with a success haptic on iOS.** The
  first-launch razzle already gave a heavy impact when the chosen card lands;
  the completion handoff — when the colour wash finishes and the chosen
  experience boots underneath — now also fires a success notification haptic to
  confirm the selection. Reuses the existing `triggerHaptic` seam
  (`util/haptics.ts`), fires once per completion. Works on both iOS
  (UIImpactFeedbackGenerator) and Android (native Vibrator, with a
  `navigator.vibrate` fallback in the WebView); a safe no-op only on
  unsupported web/desktop.
- **Seamless Corpán Plus narration upgrade after subscribing.** When a user
  subscribes (or restores Plus, or launches already-Plus), the app dispatches a
  `corpan:entitlements-changed` `{plus:true}` signal that the reader/catalog
  layer uses to upgrade installed preview narrations to the full versions in
  place — no manual uninstall/reinstall. The book the user is reading at the
  end-of-preview paywall upgrades first (any connection) and the reader resumes
  straight into the full content; the background sweep of the rest runs only on
  confirmed-unmetered connections (when metering can't be confirmed — e.g. iOS —
  it defers and the just-in-time on-open upgrade covers it); a JIT self-heal
  upgrades any preview opened while Plus. The decoupled trigger
  fires on the inactive→active edge of the live subscription, so every
  activation path is covered without touching the offline-subscriber durability
  logic.

### Fixed
- **Android subscription verification was failing for every subscriber.** The
  `/verify-purchase` call now sends `productType`, and the server verifies
  Google subscriptions via `subscriptionsv2` instead of the one-time-products
  endpoint (which Google rejects for a subscription token). Previously every
  Android subscription — including affiliate/discount code redemptions — failed
  server verification, so no affiliate partner was credited and no entitlement
  token was minted (blocking Plus-gated content downloads). iOS/macOS unaffected.
- **Android Plus full-narration download was verifying as a one-time product.**
  The signed-URL request for the gated full ZIP now sends `productType: "subs"`
  (it authorizes under `corpan.plus`, which carries no `.sub.` marker, so the
  server would otherwise verify it as an in-app product and reject the
  subscription token — "document type is not supported"). The legacy per-book
  download is pinned to `inapp` (unchanged behavior).
- **Store-notification backend hardening (refunds, revocations, dedupe).**
  Apple refunds of a *renewal* now net against the right ledger row; refund/
  revoke no longer keeps extending Plus; store-notification dedupe is committed
  only after the side-effects succeed (so a transient write failure is safely
  reprocessed); Google push notifications fail closed when the OIDC trust isn't
  configured; and refund/revoke reversals now carry the original charge's amount
  and revenue-share so partner payouts are clawed back on refund (previously
  Android refunds left the payout uncredited-back). Server-side only.
- **Phrase packs "Download all" retry no longer becomes a dead tap.** The
  failed-batch retry tracked failures as a global count and re-ran against the
  *current view's* installable packs, so after a failure you could switch to a
  filter/category with nothing installable and still see "tap to retry" while
  the tap did nothing. Failures are now tracked by pack **ID** and retry
  re-installs exactly those packs, resolved from the full catalog independent of
  the active filter/search — and the retry affordance clears automatically once
  every failed pack has installed (here or elsewhere) so it never offers a tap
  that can't act. (`PhrasePackBrowser.tsx`, `resolveFailedPacks.ts`)
- **Reordering a language no longer wobbles the drawer.** Dragging a chip in
  the re-orderable language stack (in the Quick Settings drawer and anywhere
  else the stack appears) is a dnd-kit drag; the enclosing vaul drawer was also
  grabbing the vertical gesture and drifting toward closing. The chips are now
  marked `data-vaul-no-drag`, so the drawer ignores touches that begin on a
  chip while still closing normally from its handle/overlay.
  (`LanguageSelectOrder.tsx`)
- **Quick Settings drawer scrolls across its full width.** The scroll
  container was capped + centered, so on a wide iPad the scrollbar floated in
  from the right and the generous padded sides weren't a scroll surface. The
  full drawer width is now the scroll region (scrollbar flush right, swipe
  anywhere) while the controls stay width-capped and centered via an inner
  wrapper. (`QuickSettingsSheet.tsx`)
- **Installed packs are no longer dev-reloaded, fixing a pack-launch crash on
  `tauri ios dev` over LAN.** A downloaded catalog pack (e.g. beatlounge) is
  served from a `corpan-pack://localhost/…` (iOS/desktop) or
  `http://corpan-pack.localhost/…` (Android) URL — both parse to a `localhost`
  host, so the dev-reload poller wrongly treated every installed pack as a
  hot-reload target. The poller then re-ran the pack's mount while the prior
  React root was still mid-teardown (teardown is deferred to a
  `requestAnimationFrame`), producing "createRoot() on a container that has
  already been passed to createRoot()" + a detached-node `NotFoundError` and a
  failed launch. Dev-reload polling is now scoped to packs actually served from
  the local Vite `/packs` dev middleware in a DEV build; installed
  `corpan-pack://` packs are never polled. Remount is also hardened: `load()`
  now awaits the prior instance's deferred teardown before mounting a fresh one,
  and clears the container before `mount()`, so a reload can never overlap two
  roots. (`contentPacks/devReload.ts`, `ContentPackHost.tsx`.)

## [0.19.1] - 2026-06-18

### Added
- **Phrase Flip now has its own artwork and a card in the "Installed" grid.**
  The built-in core experience was previously only reachable from the For You
  carousel / Recent and showed a bare lucide icon everywhere. It now ships with
  bundled 16:9 card art (`assets/phrase-flip.svg`) and appears as a first-class
  card alongside downloaded packs in Home → Installed (sorted in by name,
  launches via the existing `openPhrase` path, no Remove since it's built in).
  The same art is used in the For You carousel. A `removable` prop on
  `PackCard`/`PackActions` hides the Remove action for built-in experiences.

### Changed
- **Paywall free-trial framing sells the trial instead of reciting it.** A
  `$0.00` introductory price is now correctly recognized as a free trial (it was
  mis-classified as a paid intro price, so the CTA said "Subscribe" and the panel
  read the robotic "$0.00 for 7 days, then …"). The CTA now reads "Start 7-day
  free trial"; the trial panel is centered like the rest of the card, warmer
  ("Free for 7 days" / "Then $99.99/year · cancel anytime. No payment today."),
  and drops the timeline dots. The offer/affiliate code field and its help/status
  text are centered in a narrow column under the CTA (codes are short), and the
  trial panel is hidden when a code redeems (offer code and free trial are
  mutually exclusive). (`SubscriptionOffer.tsx`, `purchase.ts`)
- **iOS offer-code redemption can skip the typing.** When the backend provides a
  prefilled App Store redeem link for a resolved code, we now open *that* (code
  already entered) instead of the empty generic StoreKit redeem sheet.
  (`purchase.ts`)
- **Settings is now premium and continuous with Home.** The header mirrors Home
  — the all-hearing-ear mark + title at the top-left — and the top-right close is
  now a Home button (like Phrase Flip) instead of an X, so flipping Home↔Settings
  feels seamless. Dev Mode moved to the very bottom under a quiet "Developer"
  label and its install form was restyled to the app's squared, premium look. The
  About Corpán section gained a small all-hearing-ear mark at its top and a "Rate
  Corpán" button beside the Corpán Plus block. (`SettingsModal.tsx`)
- **The rating prompt no longer pops up on its own.** The "Enjoying Corpán?" card
  used to auto-appear once a usage counter tripped — including right when a free
  user was bounced out of a pack on hitting their daily quota (the worst moment).
  All auto-triggers were removed (the main-loop utterance counter, the eligibility
  gate, and the `notifyUtterance`/`showRatingPrompt` host-API hooks are now
  no-ops). Rating is manual-only via the new About → "Rate Corpán" button, backed
  by a `promptManualReview()` store action that opens it unconditionally; the
  5-star tap still fires the OS-native review. (`store/rating.ts`,
  `RatingPrompt.tsx`, `MainExperience.tsx`, `hostApi.ts`)
- **Pack updates are surfaced on Home, not behind the Settings gear.** The purple
  "updates available" badge on the gear is gone; instead a premium, minimal CTA
  sits above everything on Home — "You have pack updates" + an "Update all"
  button — shown only when updates exist (no layout jolt otherwise). The update
  logic is now a shared `useUpdateAll` hook reused by both the CTA and the packs
  listing. (`home/HomeHub.tsx`, `home/PacksSection.tsx`, `hooks/useUpdateAll.ts`)
- **Phrase Flip avatar reworked to the house style.** Replaced the earlier
  flip-card SVG with a thin Corpán-orange rounded card frame + purple lucide
  brain on a near-black backdrop, matching the single-color, glowing line-art of
  the other pack marks. (`assets/phrase-flip.svg`)
- **Onboarding finale is now a little fireworks show, not a flat colour blob.**
  The end-of-onboarding razzle used to settle by scaling a single flat disc of
  the pack's accent up over the screen — for EarthGate that read as "just a
  light blue." The chosen card now lights the fuse: staggered shells of sparks
  (pack accent → white-hot → warm gold) burst past it, shockwave rings ripple
  out, and a luminous radial **bloom** (bright core, deep saturated rim) swells
  up from behind the card and washes over to reveal the booted experience. The
  card carries its own glow halo so it reads as the light source. The card's
  arrival is now perfectly smooth — the chosen card rises straight up the center
  of the deck, pinned dead center and upright, calmly growing toward the viewer
  through the shuffling cards (rather than bending in from a side slot), on one
  continuous spring (no keyframe snap, no spring→tween velocity cut). The
  collage→wash handoff mounts at the exact transform the card settled into, so
  it's invisible. The finale runs a touch longer (~8.4s) to breathe. All
  motion is GPU-composited transform/opacity (smooth on Android WebView).
  Reduced motion keeps the calm bloom + glow, no sparks. (`PackLaunchTransition.tsx`)
- **Onboarding welcome copy tightened.** Dropped the "tiny team of enthusiasts"
  row and shortened the cutting-edge / language-honesty text on the welcome pact
  step so it reads faster. (`OnboardingWelcomePact.tsx`)

## [0.19.0] - 2026-06-16

### Changed
- **One unified "About Corpán" list at the bottom of Settings.** The socials
  (moved here from onboarding) and About's own links were two stacked lists in
  clashing styles with a duplicate encorpora.io. They're now a single ordered
  row list — version, then channels (website, YouTube, Instagram, GitHub,
  Free2z) + Share, then Support (report an issue, email) — one consistent style,
  deduped. `SocialsLinks` folded into `About`.
- **Onboarding ends on the final question — no "Aloha"/socials interlude.**
  Picking Read / Study / Play music / Play games / Surprise now commits
  immediately and goes straight into the razzle transition. The Corpán channels
  (YouTube, Instagram, GitHub, Free2z, website) + Share moved to the bottom of
  Settings (extracted into a shared `SocialsLinks` component), their permanent
  home; the Plus pitch already lives at real engagement moments (reader EOF,
  Settings), not as an onboarding step.

### Fixed
- **"Reconfigure stack" replays the full onboarding + landing animation.** The
  razzle landing was a one-shot guarded by a ref that was never re-armed, so
  re-running onboarding from Settings dropped back to Welcome but silently
  skipped the animation. The guard now re-arms whenever onboarding restarts.
- **Razzle no longer crashes the app into a dead, unclickable screen.** The
  chosen card's pop used a 3-keyframe `scale` with a `spring` transition;
  framer-motion only allows two keyframes with a spring and threw an *uncaught*
  invariant at the reveal beat — with no error boundary that tore down the React
  tree, leaving a blank, scrollable, click-dead overlay (you couldn't even
  Exit). The pop wiggle is now a back-eased tween, and both the transition and
  every experience overlay are wrapped in an `ErrorBoundary` that drops you into
  the pack / back to Home instead of stranding you.
- **First-launch animation is longer, lingers, and names the packs.** ~7.5s now:
  a longer shuffle during which the chosen card **rises through the deck** (starts
  behind every shuffling card, climbs to the front and grows as it nears), then
  holds center-stage with its **name** for ~2.6s before the colour wash; collage
  tiles show their names too.
- **Premium wash, not a pixelated colour blob.** The final reveal animated a
  `clip-path` circle (stair-steps / looks pixelated on Android WebView) that also
  rendered *over* the chosen card. It's now a GPU-composited scaling colour disc
  BEHIND the card, with the crisp card zooming on top; the whole overlay then
  dissolves to the booted pack. Games default landing is now **Hover Runner**.
- **No "flash of Home" before the first-launch animation.** The razzle overlay
  faded in from transparent and the onboarding commit ran in a passive effect,
  so Home (or the blank terminal) painted for a frame before the collage. The
  backdrop is now opaque from the first frame and the commit runs in a layout
  effect, so the swap to the animation happens in a single paint.
- **Catalog/network fetches no longer fail under CORS preflight.** The resilient
  catalog fetch sent conditional-GET headers (`If-None-Match` / `If-Modified-
  Since`) on every request; those aren't CORS-safelisted, so they trigger a
  preflight `OPTIONS` the CDN doesn't answer — once an ETag was cached, *every*
  catalog fetch failed (game catalog, phrase-pack catalog, AND the reader
  narration catalog). The game catalog then fell back to the built-in default
  set, which is why a brand-new "Read" user landed in Phrase Flip and the reader
  seed found nothing. Now the conditional headers are sent only on the FIRST
  attempt (304 fast-path where supported); every retry is a plain GET, which
  always works.
- **Onboarding "Read" reliably lands in the reader (not Phrase Flip).**
  `resolveLanding` no longer gates routing on the async-loaded catalog (a cold
  first run hadn't fetched it yet); it routes on a static known-pack set, the
  razzle holds until the chosen pack is installed, and `quietInstall` forces a
  catalog fetch before giving up. The reader seed is now self-sufficient
  (seeds whenever the library is empty), retries the catalog, installs the stack
  languages sequentially (concurrent native installs collided), and falls back
  across languages so it always opens a book.

### Added
- **Onboarding "where should we begin?" + a first-launch razzle-dazzle.** The
  final onboarding step is now a single deterministic question — Read / Study /
  Play music / Play games / Surprise me — that makes the exact landing call
  (Read→Earthgate Reader, Study→Phrase Flip [Chinese→Hanzipan], Music→beatlounge,
  Games→Hover Runner, Surprise→a lightly-random pick across what's launchable).
  The multi-select "What do you want to do?" stays and still powers Home's "For
  you" recommendations. On the way in, a ~5s premium collage of every experience
  shuffles, the chosen one pops to center with a **native haptic**, then its
  colour washes over the screen as the experience boots underneath — only on the
  post-onboarding landing (normal Home→pack launches stay instant). The chosen
  content pack quiet-installs while the question screen + transition play; if it
  isn't ready in time we land in Phrase Flip and it finishes in the background.
  New `tauri-plugin-haptics` (iOS `UIImpactFeedbackGenerator` / Android
  `Vibrator`; `navigator.vibrate` fallback) — needs a native rebuild to fire.
- **Reader "instant wow" seed.** When the landing is a reader (Read → Earthgate),
  the host passes a `seedBookId` on launch (through the existing pack
  `entry`/`initialState` seam). A brand-new user with no books then gets the
  default book (Biomes "Tropical Rainforest") auto-downloaded — free preview
  narrations for their whole stack, primary language first (ready to play),
  rest in the background — so they open into real content and can flip languages
  instantly. (Reader side: `earthgate-reader`/`stargate-reader` 0.7.0.)

### Changed
- **Hanzipan is a study experience, not a game.** Re-classified in the
  recommendation registry (`categories: study, wild`; featured for study) so it
  surfaces under Study (and, for Chinese learners, is the Study landing) and no
  longer appears in the games lane.
- **Soft-nag cadence relaxed 5 → 10.** Every daily-quota surface (phrase-flip,
  hover-runner, juice-squeeze, hanzipan, tutomaton) now nags every 10 instead of
  every 5 — so a free user gets a gentle reminder at 10 and the hard wall at 20,
  rather than feeling poked too early. Parlometron keeps its no-nag model.
  One-line change in the central `quotas.ts` registry.

### Fixed
- **Paywall CTA reflects an entered code.** With a valid discount/redemption
  code the primary button now reads "Redeem code" (routing through the
  offer/redeem path) instead of always "Start Free Trial"; an unknown code keeps
  the trial CTA and shows a gentle, muted inline note ("That code doesn't unlock
  a discount.") rather than a harsh red error. Label is driven by the
  `/code/resolve` result, so it reacts even on a dev build where the native
  purchase can't complete. (Two new EN strings — `code.redeemCode`,
  `code.notApplied` — pending the ×88 localization pass.)
- **No more duplicate pack cards (e.g. ~3 Parlometrons).** `filterCatalogForApp`
  mapped every surviving catalog entry to a card with no de-dup by pack id; the
  published catalog intentionally carries multiple `pronunciation_coach` entries
  (per-platform + a legacy build), and on a host with an unknown platform the
  platform gate was skipped so several passed. The listing now de-dupes by stable
  pack id (preferring the platform-matched entry, then highest version).
- **Offline subscribers are never blocked.** Subscription state used to be
  in-memory only, so a Plus user opening the app offline (no way to live-verify)
  started as non-Plus and could hit a daily wall until they reconnected. The
  entitlement store now persists a durable "last verified Plus" snapshot and
  seeds it onto the live session at launch, so a known subscriber is treated as
  Plus from the first frame — before (and even without) any refresh.
  `refreshEntitlements` only ever downgrades on a DEFINITIVE, ONLINE "not owned"
  from the OS receipt cache (StoreKit `currentEntitlements` / Play
  `queryPurchases`), and even then only after a **48h grace window** past the
  last confirmed verification — to ride out transient store flakiness and
  billing-grace renewals. Anything inconclusive or offline keeps the snapshot.
  We'd rather a fraudulent client keep a stale Plus flag than ever block a real
  subscriber with no signal (the app is open source regardless). New
  `forgetSubscription()` is the only path that clears the durable snapshot.

### Changed
- **Daily-lock headline now affirms the accomplishment.** The shared
  `DailyLockOverlay` title warmed from "Your N {{unit}} for today" to "That's
  your N {{unit}} for today — nicely done", so the cap reads as a small win
  rather than a flat stop. Only the EN `dailyLock.title` changed — the ~50
  locales need a re-gen.
- **Removed the blanket 4 GB RAM floor on the on-device tutor.** The host
  `llm.load` no longer refuses every device under 4 GB total RAM — that gate
  blocked the very low-RAM phones we now serve with smaller Qwen3 sizes. The
  per-model footprint backstop in the LLM plugin (footprint vs total RAM) remains
  the hard, uncatchable-crash guard; the Tutomaton pack disables sizes a device
  can't run. `llm.status()` now also surfaces `totalMemoryMb` for size selection.

### Fixed
- **Phrase-flip daily cap now gates only NEW phrases — review stays free.** At
  the cap, asking for a brand-new phrase (the Random button, or Next/forward
  scroll when you're already on the newest phrase) surfaces the accomplishment
  lock instead of doing nothing, and does not advance. Going back and forward
  through phrases you've already seen is always free and never counted — only a
  genuinely new phrase counts toward the daily limit. After dismissing the lock
  you can still review your seen phrases; only another new-phrase request
  re-shows it. Exiting phrase-flip just goes Home (and dismisses an open lock) —
  never the paywall.
- **Phrase-flip daily wall / nag now actually fires.** Two bugs hid it: (1) the
  host-capability marker (`__CORPAN_HOST_CAPS.dailyLock`) was only set inside
  `ContentPackHost` (content packs), not the core app — now set app-wide at
  startup; and (2) the gate was constructed in render behind a `ref === null`
  guard while the effect cleanup `dispose()`d it, so React StrictMode's
  mount→cleanup→mount left a permanently-disposed gate (every `note()` a no-op —
  no nag/lock no matter how many phrases you flipped). The gate is now built
  inside the effect, so each mount gets a fresh one. (Subscribers never see a wall.)
- **No more double rating prompt.** Exiting an experience fired BOTH the OS
  native review and the in-app "Enjoying Corpán?" card. The in-app card is now
  the single rating surface, and its 5-star button pops the OS-native review
  widget (StoreKit / Play In-App Review) instead of bouncing to the store
  listing; desktop still falls back to the store URL.
- **Catalog fetching can no longer brick the app (the "zombie" bug).** Catalog
  requests had no timeout, so a hung connection (seen on a ChromeOS/ARC
  WebView) left the in-flight flag stuck and blocked every retry — the app sat
  wedged for ~10 minutes and even uninstall/reinstall didn't help (the dead
  connection lives in the shared system WebView, not app storage). Every
  catalog fetch is now timeout-bounded, retried with jittered backoff, and the
  in-flight flag always clears. A failed fetch keeps the cached catalog instead
  of clobbering it with the built-in defaults.
- **Onboarding never traps the user offline.** The "Pick your topics" step
  gated its Continue button on the phrase-pack catalog loading; when that fetch
  failed while online, Continue stayed disabled forever and the user could
  never reach the offline-capable app. Continue is now always enabled — the
  embedded corpus works with zero network.

### Changed
- **Catalogs refresh efficiently at fleet scale.** Background catalog refreshes
  now use a conditional request (ETag / `If-None-Match`), so an unchanged
  catalog comes back as a 0-byte `304` straight off the CDN edge instead of a
  full re-download. The refresh poll is jittered per device and skips while
  hidden/offline, so millions of clients pick up new packs within minutes
  without a synchronized stampede on the catalog hosts.

- **Apple offer-code redemptions now attribute the purchase.** Redeeming an
  affiliate/offer code through the Apple "Redeem Code" sheet delivers its
  transaction asynchronously (StoreKit `Transaction.updates`), which the app
  was not listening for — so the redemption unlocked locally but the partner
  attribution / ledger was never written. The app now wires that event to
  backend verification, carrying the pending resolution token from the redeem,
  mirroring the Android/inline path. Idempotent and best-effort.

## [0.18.1] - 2026-06-15

### Added
- **Corpán Plus paywall, rebuilt.** One universal, dark, immersive paywall is
  used everywhere (Corpán mark, free-trial hero, plan selector, restore),
  replacing the per-pack themed sheets so the upgrade moment is consistent.
- **Daily free quotas across the experiences.** Each experience now has a
  generous daily allowance (e.g. ~20 phrases / 20 tutor messages / 15
  pronunciation rounds). A few soft nudges lead up to it; at the cap a calm
  "you did your N today" lock shows your streak and a countdown to tomorrow,
  with the option to continue now with Plus. Subscribers never see it.
  Backwards-compatible by design: packs ship over-the-air to *older* app
  versions too, so the daily wall only hard-blocks where the host advertises
  it can render the lock overlay (`__CORPAN_HOST_CAPS.dailyLock`, set by
  ≥0.18.1). In an older host the same pack degrades to the dismissible soft
  nag every host already renders — never a frozen, unexplained wall, and no
  pack is version-gated.
- **Affiliate / discount codes.** A single code field (shown after the paywall)
  validates a typed code server-side and applies the matching store offer — the
  Apple offer-redeem sheet on iOS, a Play offer token on Android — never a
  client-side price override. An unknown or unverifiable code never grants
  anything.
- **Onboarding opens your best-fit experience.** After setup the app launches
  the single most-fitting experience for what you told us, instead of dropping
  you onto a full Home to choose from everything at once.
- **Anonymous, opt-in usage analytics.** Aggregate, no-PII events (experience
  opens, paywall views, conversions) buffered on-device and sent only with
  consent, so we can learn what actually helps people learn.
- **Per-pack visit streaks (retention, not a gate).** A new shared module
  `packs/shared/streak` tracks consecutive local days each pack is opened,
  persisted per pack in `localStorage` (`corpan.streak.v1.<packId>`) and
  independent of the global reading-segment streak. The host records a visit at
  the pack-enter boundary (every overlay pack) and on the core phrase-flip
  experience, and exposes the current pack's streak to packs via a new optional
  `hostApi.getStreak()`. A small, dignified `StreakBadge` (squared 8px, subtle
  spark glyph + day count, hidden below 2 days) renders on installed-pack tiles
  on Home and updates live off the `corpan:streak-changed` event. Shown to all
  users, subscribed or not — never paywalls anything.
- The daily-lock overlay now references the pack's visit streak ("{{n}}-day
  streak — come back tomorrow to keep it going" / "come back tomorrow to start a
  streak") and reframes the headline to the accomplishment ("Your N phrases for
  today"). Existing open/close, live countdown, and analytics are unchanged.

### Fixed
- **Core phrase-flip now HARD-enforces the daily cap.** The daily quota counted
  forward advances but never blocked at the limit, so the accomplishment-lock
  overlay showed once and the user kept flipping unbounded. The "next phrase"
  handler now checks `isBlocked()` before advancing: at the cap it re-shows the
  daily-lock overlay (`requestDailyLock()`) and refuses to advance — a free user
  gets exactly the daily limit of forward flips, then a hard wall until local
  midnight or subscribe. The "Random sentence" button is also a forward advance,
  so it is now gated + counted the same way (it previously bypassed the quota
  entirely). Backward review is never gated; subscribers never block.
- **GPU-blur ANRs on budget Android (frosted glass gated by platform).**
  `backdrop-filter: blur` is a per-frame GPU render pass; on the Mali drivers
  common to low-end Android it compiles/runs shaders on the frame critical path,
  blocking the WebView RenderThread and, through it, the main thread — a
  documented "Unresponsive GPU" ANR. The frosted-glass surfaces (home + settings
  sticky headers, the update/rating scrims) now fall back to a solid translucent
  background on Android only, via a new `glass()` helper. iPad / iPhone / macOS /
  Windows keep the blur unchanged (those GPUs render it cheaply), so there is no
  visual change on Apple or desktop.
- **On-device tutor no longer crashes low-RAM Android (OOM → native SIGSEGV).**
  Loading the ~2.5 GB tutor model plus its KV/compute buffers could OOM *inside*
  ggml's CPU matmul, surfacing as an uncatchable native crash in
  `ggml_graph_compute_thread`. `host.llm.load` now refuses on devices below
  ~4 GB total RAM (read from the stt memory oracle), so the pack degrades to
  "no tutor" instead of crashing. iOS/desktop are unaffected.

### Added
- **Native in-app ratings on pack exit.** When you leave a pack the app now
  asks the OS to surface its own review prompt (iOS App Store / Android Play
  In-App Review) via `tauri-plugin-iap`. It is best-effort and fire-and-forget:
  the OS throttles it (iOS shows it at most a few times a year and may show
  nothing), nothing is ever gated on rating, and we never show our own "rate
  us?" modal as a precondition. A soft local backstop (minimum engagement plus
  a long cooldown) keeps us from asking the OS too often.
- **Free-trial / intro-offer framing in the subscription card.** When the
  store attaches an introductory offer to a plan (e.g. a 7-day free trial),
  the subscription card now surfaces it: "{period} free, then {price}/{period}"
  with a calm "No payment due now · cancel anytime" line, a tiny start →
  first-charge timeline, and a "Start Free Trial" CTA. Paid intro offers
  render "{intro price} for {period}, then {recurring}". When no offer is
  configured (or the store is unreachable/offline), the card looks exactly as
  before. Detection is automatic from store data — the trial lights up the
  moment an offer is configured in App Store Connect / Play Console.

### Added
- **Three more languages: Tagalog, Javanese, Sundanese.** Added across the
  app and packs. They now appear on the first onboarding screen labeled in
  their own language (Tagalog, Basa Jawa, Basa Sunda) rather than falling back
  to an unlabeled English row.

### Changed
- **Voice settings open in place.** "Text-to-speech setup" in Settings now
  opens a drawer with the same voice pickers, instead of re-entering the
  onboarding flow. The voice-picker UI is shared between onboarding and
  Settings, so the two never drift.
- **Tighter onboarding language list on small screens.** Nudged the
  language-pick row sizing down at the smallest widths so the longer list
  fits without horizontal overflow on a 320–360px phone; tablet/desktop
  sizing is unchanged.

### Fixed
- **"Open TTS Settings" no longer traps the app.** Opened from Settings, the
  old full-screen voice setup rendered over the open Settings dialog, whose
  pointer-events lock made its Back/Continue unclickable — the only escape was
  to force-quit. It's now a dismissable drawer (scrim, swipe, or ×).
- **Tagalog finds the on-device voice.** We ship Tagalog as `tl`, but Android
  publishes the voice as `fil`/`fil-PH`; a two-way `tl`↔`fil` alias now lets a
  Tagalog stack use that voice instead of falling back to a generic one.

## [0.18.0] - 2026-06-12

### Added
- **beatlounge pack — 0.1.0.** A dark, AI-driven beat lounge ships in the catalog:
  a premium tick-addressed sequencer + harmony engine + ribbon/phrase performance
  that doubles as language practice. Host seams (`hostApi`/`ContentPackHost`) land
  here; the pack is added to the in-app catalog with its one-color line-art avatar.
- **Native-fault crash breadcrumb (Android).** The existing breadcrumb only
  caught Rust panics; a SIGSEGV/SIGABRT/SIGBUS/SIGILL/SIGFPE in a statically
  linked native lib (llama/ggml/whisper) bypassed it and left an unsymbolicated,
  single-frame, wild-PC tombstone in the Play Console we couldn't attribute. An
  async-signal-safe handler now records the signal, the faulting thread name, and
  the fault address to `native-crash-last.json` before chaining to debuggerd (so
  the real tombstone still uploads), runs on an alternate signal stack (survives
  stack-overflow), and is harvested by `take_last_crash_report` on next launch.
  The thread name survives a corrupt PC, so we learn which subsystem faulted.

### Fixed
- **Content-pack teardown ordering — fewer reload black screens.**
  `ContentPackHost` now defers the pack's React-root unmount past the current
  render (`requestAnimationFrame`, not a bare microtask that races the container
  removal) and only clears the pack's injected `<script>`/`<style>` assets AFTER
  that unmount runs — and only the snapshot of the assets that pack injected, so
  a concurrent reload's fresh assets aren't yanked. Teardown is idempotent.
  (Needs an iOS/Android redeploy to ship to devices.)

## [0.17.3] - 2026-06-09

### Fixed

- **Memory: on-device models are now freed when a pack exits.** The LLM (~2.5 GB
  Qwen3 buffer) and the resident Whisper STT model were never released on pack
  teardown, so re-entering an LLM pack (e.g. Tutomaton) leaked memory each time
  and degraded the device until the app was restarted (iOS jetsam kills under
  pressure). `hostApi.dispose()` now frees the LLM and STT models, releases the
  mic/audio session, and idempotently stops any radio/keepalive audio a pack
  left playing.
- **Dialogs can no longer trap the user.** A tall dialog (notably the Corpán
  Plus paywall) on a small screen or with a large system font could overflow the
  viewport with no way to scroll to its dismiss control. The shared dialog now
  caps its height to a safe-area-aware viewport height and scrolls internally,
  with the close control always reachable — every dialog inherits this.
- **Android: the Home scrollbar no longer bleeds through a running pack.** Home
  is a fixed, independently-scrolling layer; on Android WebView its scrollbar
  painted through the opaque pack/experience overlay on top. Home's scroll is now
  frozen while a full-screen experience is open (iOS was unaffected).
- Installed-pack image/font/audio assets now load on Android. Asset URLs were
  hardcoded `corpan-pack://localhost/…` on every platform, but Tauri serves that
  scheme at `http://corpan-pack.localhost/…` on Android/Windows, so `<img>` (e.g.
  a pack logo) and other WebView-resolved assets silently failed there. The
  installed-pack URL is now platform-aware and the native fetch + host gate accept
  both forms; desktop/iOS unchanged.

### Changed

- High-frequency native debug/PERF logging (per-prefill/decode in the LLM plugin,
  pack fetch/install traces) is now gated out of release builds; error logging is
  unchanged (still always visible).
- Introduced shared design tokens in `index.css`: safe-area insets (`--safe-*`),
  a safe-area-aware `--dialog-max-h`, and a `--z-*` layering ladder, so overlays
  and modals stack and inset consistently instead of using ad-hoc magic numbers.
- Responsive density pass: surfaces stay compact on phones but grow roomier at
  `>= md` (iPad/desktop). The phrase-pack browser's filter pills get larger
  touch/click targets and type, and Settings / Quick settings / the phrase-pack
  browser now cap + center their content width instead of stretching edge-to-edge
  on wide screens. Convention documented in `AGENTS.md` §1.1.

## [0.17.1] - 2026-06-07

### Added

- **`hostApi.asr` + `hostApi.models` seam (provider-agnostic dictation +
  on-device model Budget Arbiter).** New optional `asr` (`provider`/`pick`) and
  `models` (`budget`/`fits`/`whatFitsAlongside` + Phase-2 store stubs) slices on
  the host API, mirroring `@shared/asr` + the SDK. `models.budget()` reports
  REAL device memory (from `stt.get_status`) + the resident LLM (from
  `llm.status`), so packs can ask "does an ASR model fit next to the 4B right
  now?". `asr.pick`/`provider` return `null` (→ keyboard floor) until an
  `asr-*` provider plugin registers. Additive + optional — nothing changes for
  existing packs. Part of the 0.17.1 STT overhaul (see
  `docs/STT_MASTERPLAN.md` + `docs/ASR_INTEGRATION_MANIFEST.md`).
- **`hostApi.getRandomEntries` accepts an optional content filter.** In addition
  to the legacy `getRandomEntries(count)`, packs may now call
  `getRandomEntries({ count, domains, levels, languageCodes })` to request a
  themed + level-scaled draw; the filter is forwarded to
  `get_random_entries_with_translations` (which already supports
  `levels`/`domains`/`language_codes` with a relaxation ladder). Additive +
  backward-compatible — existing numeric callers are unchanged. Used by World
  Plaza to bind each minigame's phrases to the NPC + quest at the player's level.

- **Full-document RTL foundation.** The UI language's direction is now mirrored
  onto the `<html>` root (`dir`/`lang`, reactively in `LanguageSynchronizer`) AND
  fed to a Radix `<DirectionProvider>`, so the whole shell — and every Radix
  primitive (Select, Slider, DropdownMenu, Popover, Tabs) — flips as one unit in
  Arabic/Hebrew/Persian/Urdu instead of relying on each component to set its own
  `dir`. Patched the primitives that used hardcoded physical direction: the
  `Switch` thumb (added an `rtl:` translate so it lands on the correct side
  instead of off the edge), the `Select` check indicator (`right-3` → logical
  `end-3`), and the `Dialog` close button (`ml-auto`/`marginRight` → logical
  `ms-auto`/`marginInlineEnd`). Verified the switches/slider/select render
  correctly under `dir="rtl"`.

- **"Honest hello" onboarding interlude (`OnboardingWelcomePact`).** A new screen
  between the primary-language picker and the "What brings you to Corpán?" fork,
  shown once in the user's chosen language. The "Corpán Evolves" welcome sets a
  candid first impression: independent tiny team, ambitious on-device learning,
  raw cutting-edge technology, and an honest admission that we do not speak
  every language we support. It invites native-speaker corrections, new ideas,
  and ambitious learning experiences without framing the user as a bug reporter.
  Wired as an adapter node in the onboarding graph and fully localized across
  all 51 app locales; `{{lang}}` resolves to the chosen language's native name.
  The i18n build gate now also verifies interpolation-token parity so that
  personalized copy cannot silently lose its placeholder in translation.

### Changed

- **Onboarding recommendations now have interest-specific featured picks.**
  Corpan City leads when a user asks for games, while Tutomaton leads for study
  or speaking. The new catalog-driven `featuredFor` signal only applies to
  interests the user explicitly selected, so it does not distort the generic
  cold start; explicit likes and dismissals still outweigh it.

- **Toolchain & framework to latest stable.** React **18.3 → 19.2**, Vite **6 →
  8** (Rolldown bundler — production build ~3× faster), TypeScript **5.6 → 6.0**,
  `@vitejs/plugin-react` 4 → 6, `@types/react`/`react-dom` → 19, Tailwind v4 →
  4.3. No app code changes beyond two type fixes (a React-19 `RefObject<T|null>`
  prop type in `StacksManagerRenamePopover`, a `node` types reference for the
  storage harness) and a Vite-8 config change (`build.rollupOptions.output.
  manualChunks` object → function form; added explicit `esbuild` dep). All key
  libs (Radix, framer-motion, dnd-kit, vaul, lucide) already declared React 19
  peer support. typecheck + production build green.

- **Tighter, consistent top bar.** The home top bar (logo + gear) was puffier
  than it needed to be on phones and fullscreen iPad: it added a flat
  per-platform clearance *on top of* `env(safe-area-inset-top)`, double-counting
  the inset on notched devices. It now uses a single shared flat clearance
  (`getTopBarPaddingTop`) that already clears both the safe-area inset and the
  windowed macOS/Stage-Manager "stoplight" controls. The settings header adopts
  the same top padding and the home bar's slimmer `px-4 md:px-8` gutters, and
  the settings close-X is resized to match the gear (`h-10 w-12`) — so tapping
  the gear ↔ X no longer jumps; the two buttons sit in the exact same spot. The
  settings body content adopts the same `px-4 md:px-8` gutter as the header (was
  the dialog's wider `p-6`), so body rows line up flush under the title/X. The
  settings header also gets the same translucent blur as the home bar
  (`bg-background/80 backdrop-blur`).

### Fixed

- **Tutomaton releases are routed by Corpán host version.** The pack manifest
  already required Corpán 0.17.0 for the expanded LLM sampler contract, but the
  production catalog still advertised the latest artifact to 0.16.x. The
  catalog now routes 0.16.x hosts to pinned Tutomaton 0.3.2 and `>=0.17.0`
  hosts to 0.5.x. New ZIPs ship at immutable versioned URLs; the historical
  `/tutomaton.zip` URL remains permanently pinned to 0.3.2 for old clients with
  cached catalog data. Tutomaton remains excluded from unversioned
  `catalog.json`, and the Pages build rejects catalog entries whose
  compatibility claims are looser than their local manifest.

- **Settings header matches the Home header.** The close-X now grows to `md:h-12`
  like the Home gear (it was fixed at `h-10`, so on tablet/desktop the gear was a
  48×48 square while the X stayed a 40×48 rectangle) — both are now identical at
  every breakpoint and sit in the same spot. Also dropped the settings header's
  `border-b` and the full-screen dialog's base `border`, so the header is clean
  like Home instead of bracketed by top/bottom hairlines.

- **Arabic localization polish + RTL hardening.** After a 1-star Arabic review
  ("غير مفهوم" — "incomprehensible"), we audited the whole Arabic surface with a
  strong-model grader (`dja/eval/ar/`, GPT-5.x via codex). The corpus, TTS, and
  UI text graded strong (medians 5/5), but the grader caught real defects in
  `ar/common.json`: the TTS voice-setup steps named the wrong iOS menu
  (`تسهيلات الاستخدام` → Apple's actual `إمكانية الوصول`, so the enable-voices
  instructions were unfollowable); Norwegian Bokmål had Latin letters welded
  into the Arabic word (`بوكmål` → `بوكمول`); "Visit encorpora.io" had reversed
  word order; the brand name was inconsistently transliterated (`كوربان` →
  `Corpán`); and "stack"/"pack" chrome was rendered three different ways.
  Unified the terminology and localized the remaining English `Packs`/`Stacks`
  labels.

- **Multi-GB model/pack installs no longer OOM/jetsam (stream to disk).** The
  content-pack installer accumulated the *entire* download into an in-memory
  `Vec<u8>`, sha256'd that buffer, then extracted the ZIP from memory. Fine for a
  few-MB phrase pack, fatal for the ~2.5 GB `llm-base-qwen3-4b-v1` GGUF that
  Tutomaton `dependsOn`: buffering it in RAM tripped iOS jetsam. It now streams
  straight to a temp file on disk, hashing incrementally as bytes arrive, and
  extracts from that file (`BufReader<File>`, entry-by-entry) — peak memory stays
  flat regardless of model size, matching how the STT plugin downloads
  Parlometron's whisper models. Both install paths (`download_and_install` and
  the module installer) were fixed. The 0.16.0 `DOWNLOAD_MAX_BYTES` guard
  (hardcoded 1 GiB, which had also rejected these downloads outright with
  "Download exceeded size limit") was raised to 8 GiB. None of this surfaced in
  desktop dev, where the model loads from a local path instead of downloading.
  (`content_packs.rs`.)

- **Text-to-Speech setup: newly installed voices now appear on their own.** The
  redesigned setup screen only refreshed its voice list on mount and on
  `visibilitychange`, so a voice you just installed wouldn't show up until you
  backed out of the screen and returned. The screen now lightly polls the
  installed voices (every 3s while it's open) and refreshes the list only when
  the voice set actually changed — so freshly installed voices surface
  automatically, with zero re-renders in steady state.

## [0.16.2] - 2026-06-04 — Android crash diagnostics + truncated-download guard

### Added

- **Rust-panic crash breadcrumb → on-device analytics (diagnose the
  all-native Android tombstones).** The `panic = "abort"` release build turns
  any Rust panic — in the app OR a statically-linked plugin (corpan-llm, stt,
  …) — into an immediate libc `abort()` with no Java frame, i.e. the
  unsymbolicated, single-`.so` tombstones the Play Console can't attribute. A
  panic hook installed in `setup()` now records the panic's location, message,
  and thread to a `panic-last.json` breadcrumb BEFORE the abort, then chains to
  the default hook. On the next launch `take_last_crash_report` (a new Tauri
  command, harvested in `main.tsx`) records it once as a `rust_panic` analytics
  event. Mirrors the STT plugin's init breadcrumb; best-effort and never
  panics itself. (`src-tauri/src/lib.rs`, `main.tsx`.)
- **Prior STT native-init crashes are recorded into analytics.** The host
  `stt.getStatus()` wrapper now reads the plugin's one-shot
  `priorInitCrash` breadcrumb and records a `stt_init_crash` event, so the
  uncatchable ggml-init SIGSEGV is harvested rather than only logged.
  (`contentPacks/hostApi.ts`, `contentPacks/types.ts`; plugin
  `tauri-plugin-stt` ≥ 0.5.2.)

### Fixed

- **`QuotaExceededError` from the phrase-pack catalog can no longer crash the
  app.** The phrase-pack catalog (and the game/reader/narration catalog) were
  persisted by zustand `persist` directly into the shared ~5 MB localStorage
  budget; under a full catalog, `localStorage.setItem` threw an unhandled
  `QuotaExceededError` (reported at `phrasePackCatalog.ts:36` in production).
  Both stores now persist to a new IndexedDB-backed **LARGE storage tier** via
  a quota-safe shim that evicts + retries + degrades to memory instead of
  throwing. A one-time, idempotent startup migration moves any pre-existing
  localStorage catalog blob into IndexedDB. (`store/phrasePackCatalog.ts`,
  `store/catalog.ts`, `util/storage/**`, `main.tsx`.)

### Added

- **Unified, quota-safe storage service (`util/storage/`).** Two tiers —
  TINY (settings/flags/identity → guarded localStorage) and LARGE (catalogs,
  content blobs, analytics → IndexedDB) — with a namespaced async API
  (`get`/`set`/`getJSON`/`setJSON`/`del`, TTL + schema version), LRU/volatile
  eviction, an in-memory fallback, and a `createLocalStorageShim()` for
  migrating zustand `persist` stores. Writes NEVER throw `QuotaExceededError`
  to callers.
- **Local-first analytics event store + sync seam (`util/storage/eventStore.ts`
  + `util/analytics.ts`).** An on-device, append-only, ring-buffer-capped
  (5 000-event) IndexedDB log. Every tracked event flows through ONE `emit()`
  chokepoint (cloud queue + durable on-device log). New rich capture
  (`trackScreenView`, `trackPackOpen`, `trackChallengeCompleted`, `trackError`)
  and a `syncLocalEvents()` reconcile that batch-uploads to `/v1/events`.
  Privacy unchanged: on-device, no persistent id, same opt-out flag.
- **CORS fix for the analytics Beacon.** The unload path used
  `navigator.sendBeacon`, which always sends credentials and clashed with the
  endpoint's wildcard `Access-Control-Allow-Origin` (the
  "Access-Control-Allow-Credentials" console error). It now prefers a
  `credentials: "omit"` keepalive `fetch` (beacon kept only as a fallback).
  (`packs/shared/analytics/index.ts`.)

- **"You're a Corpanista" / "Thank you for keeping Corpán ad-free and growing"
  now localized in all 50 languages.** The subscriber thank-you on the
  onboarding engagement page used `t("onboarding.engage.subscribedTitle")` and
  `…subscribedDesc`, but those keys were never added to `en/common.json` — so
  i18next fell through to the inline English `defaultValue` in *every* language.
  Added both keys to `en` and all 50 locales (the title reuses each locale's
  already-translated `paywall.thanksTitle`). (`OnboardingFinish.tsx`,
  `public/locales/*/common.json`.)

### Added

- **Localization completeness build gate (`scripts/check-i18n.mjs`, runs in
  `npm run build`; also `npm run check:i18n`).** `en/common.json` is the source
  of truth (it's what `i18next.d.ts` types `t()` against). The check fails the
  build when (1) any statically-written `t("key")` in `src/` is missing from
  `en` — the exact class of bug above, where a key only existed as an inline
  English default — or (2) any locale's key set differs from `en` (missing keys
  that silently fall back to English, or stale keys left after a rename).
  Dynamic `` t(`a.${x}.b`) `` keys are skipped (can't be checked statically).

## [0.16.1] - 2026-06-01 — Tutomaton id fix + catalog-driven experience metadata

### Fixed

- **Android: graceful gate for a missing/disabled System WebView (no more
  startup abort).** On devices where the Android System WebView is missing,
  disabled, or mid-update, wry's startup version probe aborted the process
  from native code before any UI existed (`abort ← wry::webview_version ←
  Wry::init ← Builder::build`); release builds are `panic="abort"`, so it was
  uncatchable and showed only as an opaque crash in Play vitals. A launcher
  trampoline (`LaunchGateActivity`) now verifies a usable WebView via
  `WebViewCompat.getCurrentWebViewPackage()` before MainActivity (and the
  wry/Tauri stack) is created; if none is usable it shows a dialog guiding the
  user to enable/update Android System WebView instead of aborting. The gate
  uses a translucent theme so the normal path renders nothing and forwards
  straight to MainActivity.
- **Tutomaton pack id mismatch.** The Tutomaton pack manifest's `id` was
  `tutomaton-v1` while the catalog entry was published as `tutomaton`; the
  host's pack-install path validates `catalog.id === manifest.id` byte-equal
  and refused to install with "pack id mismatch". The pack-side files
  (manifest.json, src/chat.ts PACK_ID, the in-binary experiences registry
  fallback entry) all now use bare `tutomaton`, matching the catalog and
  every other pack's naming convention. The rebuilt `tutomaton.zip` (174KB
  shell + dist + per-language module.json + prompts; bundles the new
  phrase-pack bridge) ships to `https://encorpora.io/corpan/packs/tutomaton.zip`
  on this release's GH Action.

### Changed

- **Experience metadata moves to the catalog (no app release for routine
  tuning).** The Home recommendation surface now reads `categories`,
  `goodForClass`, `recommendOrder`, `kidFriendly`, `languages`, `tagline`,
  and `taglineLocalized` directly from each `catalog-v3.json` pack entry.
  `corpan-app/src/experiences/registry.ts` keeps its full 9-entry data
  array as a defensive in-binary fallback so the Home picker still renders
  on a first launch without network, but the catalog is the source of truth
  whenever it's reachable (already wired via the existing catalog-first
  `resolveExperienceMeta` lookup in `recommend.ts`). Going forward,
  reshuffling order, hiding an experience during an investigation, or
  rewriting a tagline is a one-line edit to `web/data/packs.json` → GH
  Action redeploys catalog-v3.json → installed apps pick it up on next
  catalog refresh (existing 1-hour TTL).

### Added

- **`CatalogV3Entry.tagline` + `taglineLocalized`.** Catalog entries now
  carry a short Home-recommendation blurb distinct from the longer
  `description` (which appears on landing pages). `taglineLocalized` is a
  `Record<lang, string>` mirroring `nameLocalized` / `descriptionLocalized`.
- **`experiences.tutomaton.{name, blurb}` i18n keys** in
  `corpan-app/public/locales/<lang>/common.json` populated for every shipped
  locale via Gemini Vertex (Flash 2.5, project corpora1). Brand name kept
  as `Tutomaton` for Latin-script locales; transliterated for non-Latin
  (`トゥートマトン`, `توتوماتون`, `Тутоматон`, etc.). These feed the catalog's
  `taglineLocalized` map automatically through the new locales-harvester in
  `web/pages/build.js`.

## [0.16.0] - 2026-05-30 — Home hub, retention + monetization, region-aware voices

### Security

- **content_packs.rs hardening** (release-review HIGH findings, code in 5a6c42cf):
  - `corpan-pack://` `fetch_text`/`fetch_bytes` now sanitize + canonicalize-and-
    contain both URL segments, closing a `..` path-traversal (arbitrary file read
    in the app sandbox).
  - Pack/module downloads cap the Content-Length pre-allocation (16 MiB) and
    enforce a 1 GiB hard ceiling on streamed bytes (OOM-DoS guard).
  - A failed pack upgrade restores the backed-up previous pack instead of leaving
    the user with no pack.

### Changed

- **Paywall can be skinned per reader.** The `corpan:request-unlock` event now
  accepts an optional `theme` ("earthgate" | "stargate"); `PaywallSheet` applies
  a matching accent + background so the end-of-preview paywall feels native to
  the reader it overlays. Unknown/absent theme → the default Corpán treatment.
  The purchase flow (`SubscriptionOffer`) is unchanged.

- **i18n: 0.16.0 delta translated into all 50 locales.** Filled the 144-key gap
  introduced by the Plus paywall, decision-graph onboarding, Home hub,
  experiences carousel, update prompt, install/offline states, phrase-pack
  picker and confident voice picker (`settings.primaryLanguage`,
  `settings.phrasePacks.*`, `onboarding.fork.*` / `calibrate.*` / `interests.*` /
  `voiceGuide.*` / `phrasePacks.*` / `confident.*`, `home.*`, `experiences.*`,
  `paywall.*`, `packs.installStuck*` / `recent` / `openPack` / `updateAvailable`
  / `updateAll` / `phrasePack.install`, `tour.*`, `quickSettings.*`, `update.*`,
  `offline.*`, `socials.instagram.*`, `streak.title`). Refreshed the four
  voice-install strings whose EN copy was reframed
  (`onboarding.openVoiceSettings`, `ttsOsTipIOS`, `ttsOsTipMac`,
  `ttsRescue.engineNotInstalled.detail`). Brand names (Corpán, Corpán Plus,
  Corpanista(s), pack names) and all `{{placeholders}}` preserved across every
  locale; verified zero key gaps and zero placeholder mismatches.
- **Voice-install copy reframed — "unlock your device's best voices".** The TTS
  voice-setup guide, OS tips, and install nudges now frame premium voices as
  capabilities your device already has but the maker left switched off, with
  Corpán as the helpful guide ("let's turn them on; a few taps"). Honest and
  understated, not hype. (`voiceGuide.*`, `ttsOsTip*`, `confident.addBetter` /
  `noVoiceFor`, `ttsRescue.engineNotInstalled`.)
- **TTS setup no longer jerks when voices load.** The screen renders its real
  layout the moment the engine is ready, with per-language skeleton rows that
  fill IN PLACE when `list_voices` resolves — so the async result never changes
  the body height or re-centers the screen. (Replaced the loading-spinner →
  content swap with stable skeletons.)
- **Stable test anchors for scenario coverage (no user-visible change).** Added
  language-agnostic targeting attributes used by the iPad scenario suite:
  `aria-label="Continue"` on the onboarding footer primary (PickLearning,
  PickPhrasePacks, TTSInstructions, MultiQuestionNodeView); `data-lang={code}`
  on each primary-language option (OnboardingPickPrimary);
  `data-testid="hero-cta"` / `data-testid="hero-cycle"` on the Home For-you hero
  CTA + "Show me another" (HomeHub); `data-testid="browse-phrase-packs"`
  (PhrasePackDrawerTrigger); `aria-label="Close settings"` on the Settings close
  button (SettingsModal); `data-testid="quick-full-settings"` on the Quick
  Settings "Full settings" button. Visible text and behavior are unchanged.

- **Voice onboarding — confident, region-aware default.** The TTS voice screen
  now leads with a calm per-language "Your {{lang}} voice" row: the
  auto-picked, region/script-appropriate voice + a big Play-to-test, no grid to
  wade through. Auto-pick is now dialect-aware (`langMatchScore` scores
  region/script matches above wrong-dialect ones) so pt-PT gets a Portugal
  voice, zh-Hant a Taiwan/HK voice, en-GB a UK voice, etc., picking the single
  best top-tier voice by default. Low-quality-only languages show an "Add a
  higher-quality voice" nudge to Settings; missing-voice languages keep the
  install / Apple-feedback CTA. The full per-voice grid (select-all + per-voice
  toggles) moved behind a "Choose voices" disclosure for power users. The
  "Recommended" sparkle moved to the LEFT of the voice name.

### Added

- **Instagram on the "You're all set" page.** The onboarding engagement page now
  links to Instagram (@corpanapp) alongside YouTube/GitHub/Free2Z/website, using
  the same external-open helper and card markup. New localized `socials.instagram.*`
  keys.
- **Guided post-onboarding tour.** After "You're all set", new users step
  through the top-ranked experiences one at a time (icon + name + "what it is" +
  Try it / Maybe later, skippable), landing in their first pick — so nobody's
  dumped on Home not knowing what Earthgate/Parlometron/etc. are. Reached via a
  `{kind:"tour"}` landing intent (`components/tour/OnboardingTour`).
- **Ratings feed the recommendation cycle.** The "For you" hero gains a like
  (♥) and a "not for me" (✕); `store/packRating` persists them and biases
  `scoreExperience` so the cycle leans toward what you like. Anonymous on-device
  analytics added (`trackPackRecommended/Kept/Discarded`, `trackCycleAdvanced`).
- **Addressability groundwork.** A pack can be deep-linked to a specific entry/
  route (`?game=<id>&entryId=<n>&source=&route=`) — parsed into the pack's mount
  `initialState` via `ContentPackOverlay`/`ContentPackHost`.

- **Home is the single content surface; Packs tab retired.** Home now hosts
  everything: the "For you" recommendation, a terse **Recent** row, a one-row
  **Recommended** carousel, **Browse phrase packs**, and a spacious all-packs
  listing (`home/PacksSection`) with per-pack **Update** + "Update all". The
  Settings → Packs tab is gone; Settings is a single pane with a **Corpán Plus**
  row (subscribe/manage/restore) and an **Advanced & Developer** block (the
  7-tap dev unlock + manifest install moved here). `PacksListing` deleted.
- **Quick Settings for the native Phrase Flip experience.** A gear beside the
  Home button on Phrase Flip opens a compact sheet — speed, languages, levels,
  active phrase packs — applied live; "Full settings" opens the full Settings
  over it. This chrome is rendered **only** for the app-owned Phrase Flip (which
  is genuinely stack-driven); content packs are NOT given injected floating
  buttons — each pack owns its own exit and decides for itself whether/how to
  expose stack settings (a pack can opt in via `hostApi.openQuickSettings()`).
  (`QuickSettingsSheet`, `store/drawer` additions.)
- **Monetization by interstitial.** Removed the drab "Unlock everything" card
  from Home (now a tiny self-hiding Plus chip). `openPaywall` is suppressed for
  subscribers / when IAP is unavailable and frequency-caps auto-fired engagement
  surfaces; new `book_finished` interstitial fires when a book is completed.

- **Home "For you" recommendation (Phrase Flip demoted).** The Home hero is now
  a scored recommendation the user can act on ("Try it") or cycle ("Show me
  another"), instead of a hardcoded Phrase Flip star. Ranking scores each
  experience from the onboarding interests + profile against per-experience
  **categories / good-for-class / order**. Phrase Flip is just one ranked
  experience (in the grid unless it genuinely scores highest).
- **Catalog-driven experiences.** Copy (`name`/`description` + localized),
  artwork (`imageUrl`), and recommendation priority (`categories`,
  `goodForClass`, `recommendOrder`, `kidFriendly`) now come from the catalog, so
  new packs self-configure, rank, and localize **without an app release**. The
  in-app `experiences/registry.ts` is the fallback for the built-in phrase
  experience + catalog gaps. See `infra/CATALOG_RECOMMENDATION_FIELDS.md`.

- **Onboarding interests multi-select ("What do you want to do?").** A new
  skippable step (between voice setup and the engagement page, on every journey)
  where users pick what appeals — Read, Listen, Play games, Practice speaking,
  Study & drill, Explore wild stuff. Selections persist to `settings.interests`
  and will drive experience recommendations. New graph node kind
  `multiQuestion` + `MultiQuestionNodeView` (sticky Continue/Skip footer),
  consistent with the rest of the flow.
- **Unified onboarding footers.** Every step with a primary action (pick
  languages, pick topics, voice setup, interests, engagement page) now uses one
  bottom-sticky footer with a single **fixed-width** Continue button — identical
  size and position across screens (no width jump, no button floating with the
  content). Redundant "Skip" links removed: Continue with nothing selected is
  the skip (commits []/installs nothing). The engagement page's "Start
  exploring" moved into the same sticky footer. Multilingual TTS voice sections
  start collapsed + the screen is top-aligned, so landing no longer lurches;
  fixed the wide-iPad left-shift.

- **TTS voice setup: "Add a Premium voice" guide.** Tapping "Open Settings"
  on the text-to-speech step now shows an interstitial modal
  (`VoiceInstallGuideModal`) with the exact tap path (Accessibility → Spoken
  Content → Voices → your language → download Premium/Enhanced) before handing
  off to Settings. Apple blocks deep-linking into Voices from a third-party app
  (every `prefs:`/`settings-navigation:` scheme is rejected, and the official
  `AccessibilitySettings` API has no matching destination — both verified
  on-device), so this is the honest, reliable path. On return the screen
  auto-re-scans installed voices.
- **TTS step (single language) fills the screen.** The voice chooser grows to
  fill the space between the header buttons and Continue (OnboardingShell's new
  `fill` mode) instead of floating mid-screen. Also renamed the misleading
  "Open your device's voice settings" → "Open Settings" and rewrote the
  iOS/macOS tip to the complete Premium-voice download path.

- **In-app update awareness.** New `UpdatePrompt` modal and an "Update
  available → X.Y.Z" line in the About panel notify users when they're
  behind the latest release for their platform. Latest version is sourced
  from Apple's iTunes Lookup API on iOS/macOS and a CDN-hosted
  `app-version.json` (next to `catalog-v2.json`) on Android. Modal is
  dismissable per-version with a "remind me later" backoff; falls back to
  no prompt when the source is unknown or stale, so we never offer an
  update that isn't actually live in the store. See
  `infra/PUBLISHING.md` for the Android publish step.

### Fixed

- **Pack cards: artwork pinned to the bottom with the buttons.** The screenshot
  used to sit right under the description, so cards with longer/shorter blurbs
  had their artwork at different heights. Only the header + description now live
  in the flex-grow region; the screenshot + actions are pinned at the bottom, so
  the asset and buttons stay aligned across a row regardless of description rows.
- **Phrase Flip now shows in Home's "Recent".** As a native experience (not a
  games-store entry) it never carried a `lastLaunchedAt`, so it was missing from
  the Recent row. It now records its own launch time (`store/recentNative`) and
  Home synthesizes a Recent tile for it, sorted in with the packs.
- **No more floating buttons stamped over content packs.** The Home-hub refactor
  briefly overlaid a Quick Settings gear + Home button on top of EVERY running
  pack — including the readers, whose own layouts and exit affordances it
  collided with, and for which Quick Settings does nothing useful (their TTS is
  prerecorded, they show all languages, speed isn't stack-controlled, they don't
  use the phrase corpora). That injected chrome is removed from content packs;
  each pack keeps its own exit (`corpan:exit`). Only the app-owned Phrase Flip
  keeps the tailored gear + Home chrome.
- **"Text-to-speech setup" in Settings no longer dumps you on the Welcome
  screen.** Onboarding became a decision graph (no linear step index), so the old
  `setOnboarded(false); setStep(3)` jump restarted onboarding at Welcome. The
  button now opens the voice configurator (`OnboardingTTSInstructions`) directly
  as a standalone screen over Settings (`corpan:open-tts`).
- **Language-specific experiences no longer mis-rank.** Hanzipan (and any
  catalog pack carrying `languages`) is heavily penalized in the recommendation
  score when none of the user's languages overlap, so it can't top the list for,
  say, an English learner.

## [0.15.10] - 2026-05-28 — Android crash fixes: process-exit teardown, whisper concurrent-init, Chromebook STT

### Fixed

- **Android: process-exit crash cluster (RenderThread/Surface/vendor
  aborts on app close).** On Android, tao terminates the event loop with
  `std::process::exit()`, which runs `__cxa_finalize` — every C++ static
  destructor across `libhwui` / `libgui` / OEM vendor libs — on the loop
  thread while the RenderThread, Mali GPU workers, and vendor singletons
  are still live. That graceful C++ shutdown raced live threads and
  produced a family of native aborts: `HandleUsingDestroyedMutex`
  ("pthread_mutex_lock called on a destroyed mutex") in
  `HardwareBitmapUploader::initialize` and hwui `CommonPool`,
  `RefBase::incStrong` segfaults in `Surface::connect` /
  `eglCreateWindowSurface`, and a crash in a Vivo camera vendor dtor.
  Fixed by intercepting `RunEvent::ExitRequested` and calling
  `api.prevent_exit()` on Android (`src-tauri/src/lib.rs`) — the loop
  never reaches `ControlFlow::Exit`, so `process::exit` (and its
  `__cxa_finalize` teardown) is unreachable on every `onDestroy` path
  (back, swipe-from-recents, OOM kill, config recreate). The OS reclaims
  the process via SIGKILL, which runs no destructors. Complementary:
  the back button now `moveTaskToBack(true)` instead of `finish()`
  (`MainActivity.kt`), keeping the Activity + WebView warm for instant
  resume and avoiding needless teardown/recreate cycles.

### Fixed

- **Parlometron crash on Chromebook (`java.lang.UnsatisfiedLinkError`).**
  `WhisperContext.<clinit>`'s call to `System.loadLibrary("whisper-jni")`
  was unguarded. On x86_64 Chromebooks running Android via ARC, the
  shipped `arm64-v8a` binary (compiled with
  `-march=armv8.2-a+fp16+dotprod`) couldn't be translated by
  `libhoudini`, so the very first reference to `WhisperContext`
  threw an unhandled `UnsatisfiedLinkError` from a coroutine and
  killed the JVM. Subsequent opens of Parlometron crashed
  instantly the same way.

  Plugin `tauri-plugin-stt` bumped 0.5.0 → 0.5.1 with:
  - `WhisperContext` companion `init` wraps `loadLibrary` in
    try/catch, exposes `isAvailable: Boolean` + `unavailableReason:
    String?` for callers.
  - `SttPlugin.installModel`, `prepare`, `isAvailable`, and
    `getStatus` all consult `WhisperContext.isAvailable()` before
    touching any native code. When unavailable, they return a
    structured `STT_UNAVAILABLE` error code instead of crashing.

  Pack-side handling in `pronunciation-coach/src/game.ts` routes
  `STT_UNAVAILABLE` to a clear "speech recognition isn't available
  on this device" screen at boot, on model-switch, and on install,
  instead of cycling through download attempts that would never
  load. Existing iOS / non-Chromebook-Android flows unchanged.

  Followups (separate work): add `x86_64` to the plugin's
  `abiFilters` so Chromebooks + emulators can actually run
  Parlometron once whisper.cpp's ARM-specific build flags are
  gated per-ABI.

## [0.15.6] - 2026-05-21 — Android crash mitigations

### Fixed

- **Android: shrink the libgui `FenceMonitor` race window during WebView
  teardown.** `MainActivity.cleanupWebViews` now calls `webView.onPause()`
  between `loadUrl("about:blank")` and `removeView` / `destroy`, signalling
  the renderer to flush pending GPU work before the Surface/BufferQueue is
  torn down. Mitigates (does not eliminate) the upstream AOSP race that
  reports as "pthread_mutex_lock called on a destroyed mutex" inside
  `FenceMonitor::loop()`.
- **Android: Activity-recreation crash (`assertion failed: previous.is_none()`
  in `ndk_context::initialize_android_context`)**. Affected ~7 users on
  0.13.1 per Play Console. Two-layer fix: (1) vendored fork of
  `ndk-context` 0.1.1 under `src-tauri/vendor/ndk-context/` (wired via
  `[patch.crates-io]`) makes `initialize_android_context` /
  `release_android_context` idempotent, so re-init can never abort the
  process. (2) Expanded `AndroidManifest` `configChanges` to absorb
  `fontWeightAdjustment`, `grammaticalGender`, `colorMode`, and
  `touchscreen` (on top of the `fontScale|density|layoutDirection|
  navigation|mcc|mnc` added in 0.15.x), so the Activity is recreated
  in fewer real-user scenarios in the first place.

## [0.15.5] - 2026-05-21 — Phrase-pack drawer redesign + safe-area sweep

User-visible polish pass on the phrase-pack drawer (the
single most-used pack-management surface) and a code-wide audit of
bottom safe-area handling so cards and CTAs stop sitting under the
Android nav bar / iPad home indicator.

### Changed

- **TTS voice picker redesigned.** Threw out the accordion / scroll-in-scroll /
  `max-h` / fill-grow hacks: the voice screen is now one calm scroll surface with
  the pinned-footer Continue. New premium `VoiceCard` (round Play preview, quality
  bars, gender, a quiet "Recommended" badge on the auto-selected top-tier voices),
  a bare single-language grid (beginner case) vs quiet stacked per-language blocks
  (multi), responsive 1→2→3 columns, dark-mode + RTL aware. Verified on-device.
- **Join the Corpanistas now opens the paywall in onboarding.** `PaywallSheet` is
  mounted during onboarding too (it previously only existed post-commit, so the
  engagement-page CTA appeared to do nothing until "Start exploring").
- **Phrase experience Home button matches the Settings button.** Was a small
  round translucent pill; now rendered with the *same* `<Button>` component and
  props as Home's Settings button, so it's pixel-identical (48×48, 16px icon,
  `rounded-md`, solid `bg-background` + border + `shadow-sm`), aligned to the
  same right offset (`right-4 md:right-8`) and top — top-right, clear of the
  level/domain chips.
- **Phrase-pack drawer — dramatic vertical-density redesign.**
  Phones now open the drawer at 90vh with the title row hidden (the
  search-input placeholder "Search phrase packs" carries identity).
  iPad caps at 80vh with the title kept. Drops shadcn's baked
  `mt-24 + max-h-[80vh]` ceiling via `!important` overrides at the
  call site, leaving the shared primitive untouched.
- **Pill rails — single horizontal-scroll row, no wrapping ever.**
  Category and price filter rows now use a shared inline `PillRail`
  with edge fades, hidden scrollbar, and selected chips pinned to
  the left. Replaces the previous 4–5-line wrapping grid that ate
  half the phone viewport.
- **Installed-pack card action cluster.** Replaced the full-width
  bordered toggle row + standalone Remove button with a compact
  top-right cluster: tappable `● ACTIVE` / `○ INACTIVE` pill (one
  widget for both badge + activate toggle) + 3-dot Radix Popover
  menu containing Remove. Cards are ~70 px shorter on phones.
- **Hero-button height standardization.** All card/panel action
  buttons (Subscribe, Restore Purchases, Developer Packs,
  Get/Update/Open/Remove/Buy in PackActions) unified at
  `!h-11 md:!h-14` (44 px / 56 px). Page-hero CTAs (Browse phrase
  packs, Reconfigure stack, TTS setup) standardized at
  `h-auto px-6 py-6 md:py-8`.
- **`DiscoverPacksPanel` curated set expanded.** Added
  `pronunciation_coach`, `juice_squeeze`, `world_radio` to the
  marquee list and added a top-right "Maybe later" dismiss so
  short-screen users don't have to scroll past every card to skip.
- **Standalone "Restore Purchases" button auto-hides in the
  unsubscribed state.** The subscription card already exposes
  Restore inline; the redundant standalone button is now suppressed
  when the user isn't subscribed. Re-appears in the subscribed
  state for cross-device restore flows.

### Fixed

- **Phrase-pack drawer "Installed" filter never showed installed
  packs.** The `allInstalled` short-circuit was rendering a
  celebration card and hiding the grid even when the user actively
  tapped Installed to manage their packs. Celebration now only
  renders on the truly-unfiltered All view; the grid (with each
  card's Remove menu) renders for every active filter.
- **Bottom safe-area sweep — 5 surfaces.** `env(safe-area-inset-bottom)`
  is unreliable (returns 0 on Android Tauri, undersized inside
  Vaul portals on iPad). Switched to static `pb-16` / `pb-20`
  spacers per the established convention on:
  - `PhrasePackBrowser` (the drawer's scroll area)
  - `OnboardingTTSInstructions` bottom spacer
  - `OnboardingPickPrimary` content wrapper
  - `DiscoverPacksPanel` motion container
  - `OnboardingWelcome` (defensive, content was already centered)
- **Search placeholder text** changed from "Search topics…" to
  "Search phrase packs" in the en locale; pairs with the drawer
  title removal on phones so the placeholder carries identity.
- **Dropped stale "Manage in Stacks" CTA** + the dead
  `corpan:open-stacks-phrase-packs` event (nobody listened).

### Added

- **`corpan-app/AGENTS.md`** — frontend standards doc codifying the
  patterns above (button heights, drawer chrome, pill rails, card
  action area, safe-area handling, i18n locale precedence, etc.)
  so future agents can one-shot to standard.

## [0.15.3] - 2026-05-20 — STT scoring-overlay wire format

Bundles the embedded `tauri-plugin-stt` bump from 0.4.1 → 0.5.0.
Pairs with `pronunciation_coach` 0.7.0 to unlock per-(language,
model) scoring calibration from the pack without native rebuilds.

### Changed
- **Embedded `tauri-plugin-stt` → 0.5.0.** Adds optional
  `scoringParams` field on `startSession` alongside the existing
  `whisperParams`. When absent (every pack that hasn't opted in),
  the native plugin's existing acoustic ramps and gate thresholds
  remain authoritative — fully backwards-compatible. When supplied,
  the pack overlays per-call values for `avgZero`, `avgOne`,
  `minZero`, `minOne`, `textFloor`, and `compressionThreshold`.
  Threaded through Rust models, Swift `STTPlugin`, and Kotlin
  `Scoring`. New Swift log line `Whisper | scoring overlay applied`
  surfaces effective ramp values when an overlay lands.

## [0.15.2] - 2026-05-20 — Never-die sampler + saner default levels

The sampler used to throw `"No entries match the current filters"` (and
freeze the main loop / blank out game packs) whenever a user's filter
combination painted every active source into a zero-count corner. Two
common triggers in production: brand-new users landing on default
`levels: ["A0"]` with phrase packs that don't have A0 entries; and any
user with `levels: ["C2"]` (or any single CEFR level) against a pack
that doesn't cover that edge. Belt + suspenders fix this release.

### Changed
- **Default CEFR levels widened to `["A0", "A1", "A2"]`** for fresh
  stacks (was `["A0"]`, briefly `["A0", "A1"]` mid-cycle). Phrase
  packs lean toward A2 in practice, so a new user with one or two
  starter packs lands on a candidate pool roughly 3× larger than
  before — dramatically reducing back-to-back repeats under tight
  stack configurations. Existing users keep their persisted level
  choices — Zustand `persist` doesn't re-run defaults.
- **Domain filter removed from the Stacks UI.** Phrase packs supersede
  the base-corpus domain axis: instead of toggling "travel" / "work" /
  "food" against the bundled corpus, users pick topical phrase packs
  directly. The `DomainPicker` component is gone; the `domains` field
  stays in the settings store for persisted-state compat but is no
  longer forwarded to the Rust sampler — sampling always sees "all
  domains". Per-entry `entry.domains` chips still render in the main
  experience because they describe the entry, not a filter.
- **Rust filter-relaxation ladder.** When the strict
  `(levels, domains, source_set)` filter yields zero counts across
  every active source, the sampler now silently retries in
  escalating relaxation order:
  1. Strict (caller's filter)
  2. Drop levels — keep domains + active source set
  3. Drop levels and domains — any entry from any active source
  4. Force-include the bundled corpus, ignore all filters — the
     universal floor

  The user sees a fresh entry instead of a freeze. No UI signal — by
  design ("oh you want some C2? .. well we don't have any so here is
  a random selection from your selected packs"). Behavior is
  unchanged for the healthy case: tier 1 hits and returns the same
  entry it did in 0.15.0.
- Both `get_random_entry_with_translations` and
  `get_random_entries_with_translations` route through the ladder,
  including the no-phrase-packs fast path. Every host-bridge caller
  (Parlometron, Juice Squeeze, Hover Runner, Hanzipan) and every
  internal `MainExperience` flow inherits the new resilience
  automatically.

### Fixed
- Game packs no longer die when the active stack has a CEFR level not
  represented in any selected phrase pack — the sampler walks the
  ladder and hands back a real entry.
- `MainExperience` no longer hits an unhandled rejection on
  `"No entries match the current filters"`; that error is now
  effectively unreachable for any state the toggle UI allows.
- Onboarding "Select all" button now correctly displays the pack
  count ("Select all (12)") in every locale. Previously the English
  locale rendered the literal template `{{count}}` because the
  component never passed the count argument. Component now wires the
  count; the 50 other locales have been patched via
  `public/locales/add_select_all_count.py` to append the
  parenthesized `({{count}})` placeholder.
- Catalog browser count chip is now correct: shows the unique-pack
  tally across visible groups instead of double-counting packs that
  appear in multiple categories. Some packs intentionally live in
  more than one group ("Mythology" is both Humanities and World
  cultures) for discoverability — they now count once in the chip
  but still appear in every group they belong to. New pure helper
  `countUniquePacksAcrossGroups` in `hooks/usePhrasePackCatalog.ts`.

### Added (anti-repetition release)
- **Recent-exclude in the sampler.** Every call into
  `get_random_entry_with_translations` /
  `get_random_entries_with_translations` (whether from
  `MainExperience` or the pack-facing `hostApi`) now passes the
  last 10 `(source, entry_id)` tuples from `useHistoryStore` as an
  `exclude` argument. Rust applies per-source `NOT IN (…)` filters
  inside each pack/base query. If the resulting pool is empty across
  every relaxed filter tier, the ladder retries once more with
  `exclude=[]` so anti-repetition can never wedge the loop. Helper
  `getRecentTuples(n)` on the history store; new `ExcludeEntry`
  serde struct on the Rust side (camelCase).
- **Stack phrase-count chip.** A calm "~N phrases match" line above
  the phrase-pack picker in the Stacks settings tab, with a soft
  "Add packs or widen levels for variety" nudge when the matching
  pool drops below 50. Powered by a new read-only Rust command
  `count_entries_for_filter` that reuses existing `count_base_entries`
  + `collect_pack_counts` (and their FilterSig-keyed cache, so
  repeat calls are sub-millisecond). New hook
  `useStackPhraseCount()` debounces filter-axis changes at 250 ms.
  i18n: two new keys (`settings.phrasePacks.stackTotalPhrases` +
  `stackTotalNudge`), translated across all 51 locales via
  `public/locales/add_stack_phrase_count.py`.

### Added (Packs-tab polish)
- **Packs-tab reorder.** SubscriptionOffer → RestorePurchases →
  Recents → Installed → Discover → Developer Tools → phrase-pack
  drawer trigger. Apps/games (and the related Developer Tools)
  reachable in a single scroll; phrase packs no longer crowd the
  top.
- **Phrase-pack browser moved into a Vaul `<Drawer>`.** The bottom
  of the Packs tab now shows a single "Browse phrase packs (N)"
  button — tapping opens a bottom-sheet drawer containing the
  full filter chrome and grid. Solves the page-height-jumping
  problem from in-place filter toggles, and gives the browser
  proper room to breathe (85vh) regardless of how much chrome
  surrounds it. Drawer open state is controllable from the
  Stacks-tab "Browse packs" CTA via a new
  `corpan:open-phrase-pack-drawer` custom event.
- **Category filter pills.** A new multi-select category facet
  inside the drawer, sourced from `catalog.phrasePackGroups`. OR
  within the category facet; AND across text search, price/install
  chip, and categories. Lets a user say "Arts and Sciences, music"
  with three tap+typing actions.
- **Balanced compact card.** `PhrasePackCard compact={true}` keeps
  description (line-clamp-2), level/count/size stat chips, and the
  topic line, but uses tighter padding and smaller fonts. The
  "Active in stack" text label is removed — the toggle widget +
  the card's purple border state communicate it on their own.
- **IAP / Restore / Dev hero widths aligned.** `SubscriptionOffer`,
  `RestorePurchases`, and the dev-unlock card now all use
  `max-w-md md:max-w-xl mx-auto` so they line up consistently on
  iPad and don't stretch into one-line buttons on a wide modal.
- **Buttons grow on iPad.** The shadcn `Button` size variants now
  use a `md:` responsive height bump (sm 32→40, default 36→44, lg
  40→48, icon 36→40). One change in the CVA at
  `components/ui/button.tsx`; every button in the app —
  Stacks-tab pickers, settings rows, IAP/restore/dev cards, the
  new drawer trigger, in-pack drawers, everything — automatically
  gets a 44pt-friendly tap target on tablet+ widths. Phones keep
  the denser sizing.

### Fixed (Android crash on Activity recreation)
- **`WryActivity.onCreate` double-init panic.** Crash signature:
  `tao::platform_impl::platform::ndk_glue::create` →
  `ndk_context::initialize_android_context` → `panic_with_hook` →
  `abort`. Android recreates the Activity on configuration changes
  not declared in `android:configChanges`; when WryActivity gets
  `onCreate` again the native static asserts the context is still
  `None` and aborts the process. The previously-shipped list missed
  `fontScale`, `density`, `layoutDirection`, `navigation`, `mcc`,
  `mnc`. `fontScale` was the common trigger for our users — language
  learners often adjust system font size and would crash on next
  app open. Manifest extended to cover every runtime-mutable config.

### Fixed (Phrase-pack drawer lifted to app root)
- **Stacks-tab scroll regression fixed.** The phrase-pack drawer's
  Vaul `Root` was nested inside the `SettingsModal` overflow-y-auto
  scroll container, and on iOS WKWebView its touch handlers were
  hijacking parent scroll even when the drawer was closed —
  freezing the entire Stacks tab. Moved the drawer to App.tsx
  level as a sibling of `SettingsModal`. New tiny
  `useDrawerStore` (`src/store/drawer.ts`) owns the open state;
  the drawer mount lives in `src/components/packs/PhrasePackDrawer.tsx`.
- **Single shared drawer trigger across both tabs.** New
  `src/components/packs/PhrasePackDrawerTrigger.tsx` is the *one*
  trigger component — same button (icon + "Browse phrase packs
  ({{count}})") dropped into both the Stacks-tab
  `PhrasePackToggleSection` and the Packs-tab `PacksListing`. Owns
  visual treatment, count badge, self-hide logic, and the call into
  the drawer store. Removed: the `onOpenCatalog` prop on
  `PhrasePackToggleSection`, the inline `<Drawer>` block + state +
  CustomEvent `useEffect` listener in `PacksListing`, and the RAF
  + `setTimeout` + dispatch dance in `SettingsModal.onOpenCatalog`.
  All in service of: one drawer, one trigger component, one place
  to open it from. The future main-experience quick-toggle chip
  (NAVIGATION_PLAN 0.16+) will use the same store.
- **"Browse all packs" opens the drawer.** The Stacks-tab CTA
  flips to the Packs tab and dispatches the drawer-open event
  after the Radix Tabs swap settles — landing the user directly
  inside the phrase-pack drawer instead of scrolled to an inline
  section.

### Notes / future-work seed
- `corpan/docs/USER_DATA_DB_PLAN.md` documents the next architectural
  step: a per-user SQLite store (`user_data.db`) for unbounded
  history with indexed lookups. The recent-exclude feature in this
  release uses the last 10 tuples already in localStorage; richer
  features (spaced repetition, archive/dismiss, streaks, word-count
  histograms, cross-pack analytics) need the SQLite shift and are
  targeted for 0.16+.
- `corpan/docs/NAVIGATION_PLAN.md` sketches the 0.16+ Settings /
  Library overhaul: a 3-tab top level (Stacks · Library · App
  settings), a Library sub-nav by content kind (Apps & Games ·
  Books · Phrase packs · Models), and a main-experience phrase-pack
  quick-toggle bottom-sheet drawer (Vaul `<Drawer>` from
  `src/components/ui/drawer.tsx`, currently unused).

## [0.15.0] - 2026-05-19 — Phrase packs, 12-pack onboarding, dedicated catalog

The headline shift: **modular phrase packs**. Corpán's bundled corpus
(510k rows × 51 languages) is now augmentable with topical packs
(Botany, Cooking, Music, Astronomy, Cinema, …) the user installs from
the app. Every existing game pack — Parlometron, Juice Squeeze, Hover
Runner — automatically samples from the user's active phrase packs
through the host bridge: no pack rebuilds required.

The publisher ships new packs to a dedicated CloudFront catalog
(`d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/catalog.json`) with
no PR / app rebuild. End-to-end time-to-production for a new pack is
measured in seconds.

(Skipping 0.14 to align the in-app version with the user-facing
"Moonshot 15" milestone — 0.14 is reserved for any follow-up patch on
the 0.13 line.)

### Added
- **Onboarding "Phrase packs" step** (`OnboardingPickPhrasePacks`).
  Up to 12 cards from the live catalog, ordered as the publisher
  ordered them, with the publisher-curated starter set pre-checked.
  Bulk Select-all / Clear, individual card toggles, friendly empty
  state when offline, never auto-skips past selection. Continue is
  gated while the phrase-pack catalog is still loading on an online
  client so users never stealth-skip past the step. Locked paid
  packs (one-time IAP) are filtered out at install time —
  entitlement gate lives client-side because the CDN zip URLs are
  public.
- **Stacks-tab phrase-pack picker** (`PhrasePackToggleSection`).
  Compact one-line rows, search, filter chips (All / Active /
  Inactive), bulk Select-all / Deselect-all that act on the visible
  subset, per-category sticky group headers with Activate-all /
  Deactivate-all, fixed `max-h-[360px]` scroll container. Designed
  for 1–1000+ packs without overwhelming the settings page. The
  base corpus toggle is pinned at the top, immune to filter state.
- **Packs-tab phrase-pack browser** (`PhrasePackBrowser`). Catalog-
  driven groups + cards with search, filter chips, "Active in
  stack" badges. Distinguishes four states: catalog-empty-offline,
  catalog-with-packs, all-installed (calm "You've got every phrase
  pack" callout with "Manage in Stacks" CTA), and filter-installed-
  but-nothing-installed (CTA resets the filter).
- **Recent packs row** at the top of Settings → Packs. Holds up to
  **8** most recently-launched packs; CSS-only responsive cap picks a
  row-filling subset per breakpoint (5 / 8 / 6 / 6 at lg / md / sm /
  base) so a column never goes orphan. Each tile is one big tap;
  tiny purple dot when an update is available. Driven by a new
  `lastLaunchedAt` field in the games store, stamped at the single
  launch chokepoint in `App.tsx`.
- **Dedicated phrase-pack catalog** (`PhrasePackCatalog` type, parser,
  fetcher) — separate from the v3 game/reader/narration catalog.
  Persisted under `corpan-phrase-pack-catalog-v1` with a 5-minute TTL
  (vs. v3's 1 hour). Publisher writes a fresh `catalog.json` to S3
  with `Cache-Control: public, max-age=300, must-revalidate` and
  every running app sees the new pack within minutes; optional
  CloudFront invalidation for instant propagation.
- **Two-phase weighted phrase-pack sampler** in Rust
  (`phrase_packs.rs`). Per-pack `Connection` pool with LRU cap (no
  ATTACH), cached `COUNT(*)` per filter signature, weighted source
  selection, one indexed query against the chosen pack. Resilient
  to partial install state — uninstalled-pack errors are logged
  and the source is treated as count=0 rather than failing the
  whole call.
- **Host-bridge phrase-pack forwarding**. `hostApi.getRandomEntry`
  / `getRandomEntries` automatically thread the user's
  `phrasePackIds` + `baseCorpusEnabled` into Rust, so every old pack
  (Parlometron, Juice Squeeze, Hover Runner) samples from the
  user's selected phrase packs without a rebuild.
- **History pinned to `(source, entry_id)` tuples** so prev/next
  navigation through a phrase-pack-augmented stream resolves the
  right pack instead of falling through to base.

### Changed
- **Updates section removed.** Installed packs with an available
  update now wear a single purple "Update" badge and their action
  row swaps to `[Update] [Open] [Remove]` — no more duplicate card
  in a separate Updates section. Source of truth is the Installed
  grid.
- **Offline-first UI polish.** Every screen that depends on internet
  now degrades to a calm, consistent `OfflineNotice` instead of stuck
  spinners, dead-disabled buttons, or alarming amber error cards.
  New shared `<OfflineNotice>` component + `useOnlineStatus` hook
  drive the look across `PhrasePackBrowser`, `PacksListing`
  (Discover), `PhrasePackCard`, `PackActions`, `SubscriptionOffer`,
  `RestorePurchases`, and `OnboardingPickPhrasePacks`. Installed
  packs and the 510k bundled phrases keep working — only the
  network-gated affordances are gated.
- `SubscriptionOffer` now distinguishes "offline" from "store
  unreachable": when the device is offline we short-circuit before
  hitting StoreKit / Play Billing and show the offline notice; an
  already-subscribed user still sees the green "subscribed" state
  from the platform's local cache.
- Pack manifest fetches now time out at 15s with a calm error
  message instead of spinning indefinitely on a stalled CDN
  connection.
- Update button on installed pack cards is now correctly gated by
  `isOffline` and shows a "Reconnect to download" hint — previously
  it stayed live and would kick off a doomed download.
- 51-language i18n rollout for every new phrase-pack key — three
  idempotent translation scripts under `public/locales/`
  (`add_phrase_pack_translations.py`,
  `add_b_double_prime_translations.py`,
  `add_stack_picker_translations.py`).

### Fixed
- `InstallProgressDialog` no longer hangs as a spinner when the
  device goes offline mid-install. `useInstallProgress` watches the
  `offline` event, tears down the Tauri progress listener +
  stuck-timeout interval, and flips the dialog to a calm error
  state with a cloud-off glyph, heading, and a Retry button.
  Prevents a late `complete` event arriving over a brief radio
  recovery from overwriting the offline error state.
- Phrase-pack manifest registration rejects manifests whose declared
  `id` doesn't match the directory they were installed into, and
  URL-encodes the pack id when fetching `manifest.json` from the
  in-app `corpan-pack://` scheme. Closes a small spoofing vector
  where a malformed pack zip could register under a different id.
- Sticky group headers in the Stacks-tab phrase-pack picker no
  longer let rows bleed above them while scrolling. The scroll
  container's top padding was creating a strip outside the sticky
  position; removed in favor of per-section internal padding +
  `overscrollBehavior: contain`.

## [0.13.1] - 2026-05-17

The "model swap won't crash your app, and STT events flow
properly" release. Bundles **tauri-plugin-stt 0.4.1** — see that
plugin's CHANGELOG for the full native-side story. Quick summary
of what changed since 0.13.0 hit TestFlight:

### Native plugin work (bundled tauri-plugin-stt 0.3.1 → 0.4.1)
- New `audio_level` event stream (~10 Hz RMS) during recording.
  Powers future VAD / live-transcription / waveform-viz features.
- New `release_audio` command to tear down `AVAudioEngine` /
  `AudioRecord` at pack close. Fixes the iOS mic-indicator-stuck
  issue.
- Audio session policy reversed: release the engine + session
  between recordings instead of keeping warm. Trades back-to-back
  latency for indicator-off + full TTS volume between mic tries.
- `INSUFFICIENT_MEMORY` structured error code from `prepare()`,
  emitted when the memory-headroom gate refuses a load that would
  jetsam-crash the app.
- Composite memory-headroom gate in `prepare()`:
  `malloc_zone_pressure_relief` + 150 ms settle + projected-peak
  check (residentNow + modelSize × 2.0 vs. 85% of total budget).
  Caught the Large→Large jetsam crash that 0.13.0 would have hit.
- `installModel` accepts an optional `downloadUrl` field, letting
  packs ship community / self-quantized model variants from our
  own CDN. First user: the Parlometron pack's `Large q8 ★` entry.

### Host TS work
- `INSUFFICIENT_MEMORY` added to the `SttErrorCode` union and
  `STT_ERROR_CODES` dispatch set in `hostApi.ts`. Packs route the
  new code the same way they route `MODEL_NOT_INSTALLED` /
  `NETWORK` / `LOAD_FAILED`.
- `subscribeAudioLevel` host API wired through `addPluginListener`
  for the new `audio_level` event.
- `releaseAudio` host API wired through.
- `installModel` opts type gains `downloadUrl?: string`.

### Fixed
- **`StatusResult` wire-format gap, twice.** First fix: the Rust
  `StatusResult` struct in `src/models.rs` was missing the
  `available_memory_mb` and `physical_memory_mb` fields the iOS
  and Android plugins emit. Serde silently drops unknown fields,
  so `stt.getStatus().availableMemoryMB` was always `undefined`
  on iOS. Second fix: even after declaring the fields,
  `#[serde(rename_all = "camelCase")]` mangled them to
  `availableMemoryMb` / `physicalMemoryMb` (lowercase `b`)
  because serde treats `_mb` as one word. Explicit
  `#[serde(rename = "availableMemoryMB")]` per field resolves it
  for good. Same trap that bit `whisperParams`, `downloadUrl`,
  and `install_progress` earlier.

### Changed
- **Adaptive vertical placement for the language stack.** Replaces
  the old fixed-center / scroll-if-it-overflows behavior with a
  two-mode layout that switches jump-free as N (or text size)
  grows: *centered* (paddingTop = chipsBottom + 32, paddingBottom
  = navHeight + 32, justify-content: center — the flexbox identity
  reduces to true visual centering between the MetaChips overlay
  and the floating controls card) and *anchored* (stack top pinned
  to ~20% down the scroll area, justify-content: flex-start). The
  switch happens at the seam where both modes agree on the top
  edge, so growing the stack never produces a visual jump.
  `useLayoutEffect` recomputes on mount, on window resize, and on
  Nav-height changes.
- **`OnboardingPickPrimary` is now scrollable.** Wrapped the
  language list in a `h-dvh overflow-y-auto` container with
  `WebkitOverflowScrolling: "touch"` so longer COMING_SOON lists
  don't get clipped on small devices. Body and html are pinned
  to 100 % height in `index.css` so the document itself never
  scrolls (and Android WebView's overlay scrollbar can't paint
  against it).

### Fixed (other)
- Main experience: language stack could hide its last row under
  the floating Nav with no way to scroll to it. Replaced
  `my-auto` flex-centering with `justify-content: safe center`
  on the scroll container and `ResizeObserver`-driven Nav
  height measurement so scrolling reliably reaches the last row.

## [0.13.0] - 2026-05-17

The "Parlometron" release. The pronunciation-coach pack is rebranded
to **Parlometron** and gains a multiplayer mode alongside the
existing solo practice flow. The catalog ID `pronunciation_coach` is
stable so older Corpán builds still see the 0.5.x pack; only this
version (and newer) sees the 0.6.0 pack under its new brand.

### Added
- **Per-call `downloadUrl` plumbing on `installModel`**. The host's
  `installModel` wrapper at `corpan-app/src/contentPacks/hostApi.ts`
  + the matching opts type in `types.ts` now forwards an optional
  `downloadUrl` to the native plugin. Lets packs ship community /
  self-quantized model variants from our own CDN — first use case is
  the Parlometron pack's new `Large q8 ★` entry (full Whisper Large
  v3 at 8-bit precision, ~1.58 GB, quantized from fp16 ourselves
  because upstream `ggerganov/whisper.cpp` doesn't publish one).

### Fixed
- Wire-format gap on `installModel`. The host JS wrapper had been
  silently stripping any field other than `model` from the opts
  payload before invoking the native command — same kind of trap
  the `whisperParams` plumbing hit on the Rust side earlier in
  0.12.x. With this fix the field flows all the way through to
  Swift / Kotlin and on to the actual HTTP download.

### Changed
- App version unified to `0.13.0` across `package.json`,
  `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` (these
  had drifted across 0.12.6/0.12.8 during the Android-only patch
  releases — now back in sync).

## [0.12.8] - 2026-05-15

Android-only rebuild on top of 0.12.6/0.12.7's content. Fixes two
Play Console warnings that surfaced when the new whisper.cpp JNI lib
landed: a 16 KB page-size compatibility gap, and missing native
debug symbols metadata in the AAB.

### Fixed
- 16 KB page size compatibility for `libwhisper-jni.so`. The CMake
  build (NDK 28 + AGP 8.11) was producing 4 KB-aligned segments
  while every other native lib in the AAB (Rust `libcorpan_lib.so`
  across all four ABIs, NDK `libc++_shared.so`) was correctly
  16 KB-aligned via the rustflags block in
  `src-tauri/.cargo/config.toml` from 0.7.8. Added matching
  linker flags to the plugin's CMakeLists.txt
  (`target_link_options ... -Wl,-z,max-page-size=16384`,
  `-Wl,-z,common-page-size=16384`). On Pixel 9 / Android 15+
  16 KB hardware this avoids the bionic 4 KB-emulation shim
  (15-30% slower startup, ~5% more power).
- Native debug symbols actually reach Play Console. AGP release
  config in `gen/android/app/build.gradle.kts` switched from
  `debugSymbolLevel = "FULL"` to `"SYMBOL_TABLE"` after observing
  on 0.12.6 and 0.12.7 that FULL left the AAB's
  `BUNDLE-METADATA/com.android.tools.build.debugsymbols/`
  directory empty under AGP 8.11 + NDK 28 + the universal flavor.
  SYMBOL_TABLE is the format Play actually uses for crash
  symbolication; both formats clear the "you've not uploaded
  debug symbols" warning. Also added a defensive
  `packaging { jniLibs { keepDebugSymbols.clear() } }` to the
  release block so AGP's strip task can actually strip.

### Changed
- Plugin `tauri-plugin-stt` 0.3.0 → 0.3.1 (16 KB fix + carries
  the symbols work from 0.3.0's incomplete release notes).

## [0.12.6] - 2026-05-13

### Added
- `SKAdNetworkItems` entry for Google Ads (`cstr6suwn9.skadnetwork`)
  in iOS `info.properties` (template at `src-tauri/ios/project.yml`),
  authorizing Apple to deliver SKAdNetwork conversion postbacks to
  Google for paid acquisition campaigns. Metadata only; no SDK
  integration. xcodegen regenerates `Info.plist` from the template,
  so the entry round-trips through any future Xcode project rebuild.
- Anonymous, session-scoped main-app analytics. Same privacy
  posture as the existing reader-pack analytics (ephemeral session
  UUID, no persistent identifiers, no IP storage, country-only
  geo via the CDN edge). Events: `session_start`,
  `app_pack_entered`, `app_pack_heartbeat` (30s while a pack is
  open), `app_pack_exited`, `app_language_switched`,
  `app_onboarding_completed`, `app_paid_unlock_viewed`,
  `app_session_summary` (on pagehide). Reuses
  `packs/shared/analytics`; backend Lambda allowlist updated to
  accept `reader_id="corpan-app"`. Build-time kill switch via
  `VITE_ANALYTICS_ENABLED=false`.
- **Settings → Send anonymous usage data** toggle. Default on
  (matching the reader-pack opt-out model). Off disables all
  main-app analytics immediately and clears the local queue.

### Changed
- Release build now ships native debug symbols to Play Console.
  `Cargo.toml` release profile no longer strips the Rust `.so`
  (`strip = false`, `debug = 1`); Gradle's `debugSymbolLevel = "FULL"`
  embeds them in the AAB metadata. APK size on-device is unchanged
  (Gradle still strips before packaging). Future Android native
  crashes will arrive in Play Console pre-symbolicated instead of as
  raw hex offsets.
- Privacy Promise (web/io/app/privacy/page.tsx) rewritten to
  reflect the anonymous usage analytics, the new in-app opt-out,
  and the network paths the app uses (IAP verification, pack
  downloads, optional live-radio streaming). The previous "no
  telemetry, ever" wording was no longer accurate.

## [0.12.5] - 2026-05-07

### Fixed
- **STT plugin upgraded to 0.2.2**, multiple memory-hygiene fixes
  for the model-switch / transcribe path on iPhone. Most impactful
  change: the dual-decode (constrained + free passes) now runs
  **in series** instead of in a concurrent TaskGroup, halving peak
  memory during transcribe with no wall-clock cost (the parallel
  form never gave a real speedup on a shared GPU). Also: runtime
  prepare uses `prewarm: false` (defers CoreML compile to first
  transcribe), and consecutive loads of the same model retry on
  transient mmap failures (sub-second resource race that was
  surfacing as LOAD_FAILED). New memory snapshot logs at every
  load/transcribe boundary make future diagnoses readable. See
  the plugin's own changelog for the full story.

## [0.12.4] - 2026-05-07

### Fixed
- **STT plugin upgraded to 0.2.1**, which fixes a model-switch OOM
  crash on iPhone caused by concurrent WhisperKit allocations. The
  plugin now serializes `prepare()` calls through a chain so two
  loads can never run in parallel; peak memory during a switch is
  bounded by the larger of the two models, not their sum. See the
  plugin's own changelog for the full story. The host-app side
  pulls in the new plugin code automatically — no `hostApi.ts`
  changes — but the iOS bundle has to be rebuilt to ship the Swift
  fix, hence the 0.12.4 bump.

## [0.12.3] - 2026-05-06

### Changed
- **STT plugin upgraded to 0.2.0** — substantial robustness pass on
  the on-device WhisperKit pipeline. The host-app side picks up the
  matching bridge changes:
  - **Structured error codes** (`MODEL_NOT_INSTALLED`, `LOAD_FAILED`,
    `NETWORK`, `IO_FAILED`, `BUSY`, `CANCELLED`,
    `MIC_PERMISSION_DENIED`, etc.) flow through `hostApi.ts` —
    incoming plugin errors now carry `error.code` parsed from the
    `"CODE: description"` string convention. Packs route on code,
    never on message substring.
  - **`stt.listInstalled({ models: [...] })`** — single round-trip
    that returns disk-truth validation state for every requested
    variant. Pronunciation Coach 0.2.0 calls it once on boot
    instead of N×`validateModel`.
  - **`stt.unload()`** — drops the in-memory WhisperKit instance
    without touching disk; available for memory-warning hooks.
  - **CoreML compute-backend fallback to CPU-only on error -14**.
    Affected iPad chips that couldn't compile `large-v3-turbo`
    even with `.cpuAndGPU` now transparently retry with
    `.cpuOnly`. Slower but works on every device we ship to;
    eliminates the Reinstall loop that was a backend bug, not a
    corruption signal.
  - **Atomic install with rollback.** `installModel` stages any
    existing on-disk install aside before WhisperKit downloads new
    files; commits on validation success or rolls back on failure.
    A failed install never corrupts the previously working install.
- **Pronunciation Coach catalog gate raised** to `minAppVersion
  "0.12.3"` — pc 0.2.0 calls `listInstalled` and routes on
  structured error codes, both unavailable in 0.12.2 binaries.

## [0.12.2] - 2026-05-05

### Added
- **Pronunciation Coach 0.1.0** ships as the first iOS-only pack —
  on-device speech-to-text via the new `tauri-plugin-stt` (WhisperKit
  + ANE/GPU compute units, dual decode for honest scoring, per-language
  acoustic ramps, calibration-ready signal mining). Catalog gate is
  `platforms: ["ios"]` + `minOSVersion: "17.0"` + `minAppVersion:
  "0.12.2"` so it never lists for Android, web, or older iPads where
  WhisperKit can't load.
- **Catalog v3 platform / OS gating**: entries now accept
  `platforms?: HostPlatform[]` (one of `ios | android | macos | windows
  | linux`) and `minOSVersion?: string`. `filterCatalogForApp` skips
  packs whose declared platforms don't include the host or whose
  `minOSVersion` exceeds the host's iOS / Android / macOS version.
  Host detection runs through `@tauri-apps/plugin-os` — outside Tauri
  the gates become no-ops so the dev catalog still loads everywhere.
- **13 new languages** added to the bundled experience (now 51 total):
  Nepali (ne), European Portuguese (pt-PT), Croatian (hr), Serbian (sr,
  Cyrillic + Latin romanization), Ukrainian (uk), Bulgarian (bg),
  Romanian (ro), Catalan (ca), Cantonese (yue-Hant-HK, Traditional +
  Jyutping), Czech (cs), Lithuanian (lt), Slovak (sk), Slovenian (sl).
  Each ships with full LLM-translated 10k-phrase corpus, native UI
  i18n in `public/locales/<code>/common.json`, and platform-aware TTS
  voice resolution (e.g. `yue-Hant-HK` → Apple `zh-HK` voices,
  `sr` → Croatian voice fallback when no Serbian voice is installed).
  Nepali ships without Apple TTS support — onboarding's existing
  generic "Send Apple Feedback" path covers it.
- **iOS deployment target raised to 16.0** (WhisperKit requirement).
  Also added `NSMicrophoneUsageDescription` to `ios/project.yml` so it
  survives Xcode project regeneration.

## [0.12.1] - 2026-05-01

### Fixed
- **Android release builds**: World Radio HTTP stations (~75% of catalog)
  failing with `ERROR_CODE_IO_NETWORK_CONNECTION_FAILED`. Fix lives in
  `tauri-plugin-radio-stream` 0.1.1, which now contributes a
  `network_security_config.xml` to the merged manifest. Mirrors the iOS
  ATS exception we already shipped in `src-tauri/ios/project.yml`. No
  changes to `gen/android/`.
- **World Radio error UX (Android)**: player bar no longer flashes-and-hides
  when a station fails. The native plugin now holds the error visible
  through ExoPlayer's post-error `STATE_IDLE` transition, and the message
  is "Couldn't connect to the station" instead of the cryptic "Source error".

iOS code unchanged from 0.12.0 — this release is Android-only in substance.
Ship iOS at 0.12.1 only if you want App Store / Play Store version parity.

## [0.12.0] - 2026-05-01

### Added
- **World Radio: native streaming** via `tauri-plugin-radio-stream` —
  ExoPlayer (Android) / AVPlayer (iOS) running outside the WebView.
  Lock-screen / Control Center transport, ICY metadata, background-resilient
  playback, audio-focus surfacing on Android, lock-screen widget hardened
  on iOS through pause/resume cycles. Pack rebuilt for the new architecture
  ships as World Radio 0.5.0; older app versions stay on World Radio 0.3.x.
- Catalog filter now honors `maxAppVersion` on V3 entries, letting a single
  pack id ship different versions to old vs. new apps (e.g. World Radio
  0.3.x for ≤ 0.11.x, 0.5.x for ≥ 0.12.0).
- First-run **Discover Packs** panel after onboarding — shows curated
  packs (Earthgate Reader, Stargate Reader, Hover Runner, Hanzipan)
  with one-tap install. Persisted dismiss flag (`hasSeenPacksDiscover`)
  so it appears once.
- Contextual **Stacks intro tip** on first visit to Settings → Stacks.
- 9 new languages localized end-to-end (Hebrew with nikkud, Swedish,
  Finnish, Dutch, Swahili, Norwegian, Danish, Greek, Malay) — total
  language coverage now **38**.
- Hebrew + Greek romanization across the corpus.

### Changed
- Slimmed bundled corpus from ~27k to ~10k phrases — heavier curation,
  A1–B2 weighted, ~50 % smaller bundle while covering 31 % more
  languages. Pre-prune snapshot archived to S3 (`corpan-prod` bucket)
  for reversibility.
- Onboarding kept its 3-step shape but received a polish pass: RTL-aware
  arrows everywhere, autonyms in their own scripts on the primary-
  language picker, deduped welcome cloud, header background flows under
  the nav (no lighter band on the TTS step), single-language chip no
  longer presents as removable.
- Onboarding typography decoupled from user's text-size accessibility
  setting via a `.wizard-shell` CSS scope.
- Tip cards (`DismissableTip`) redesigned: bordered purple-tinted card,
  X anchored in the corner, RTL-safe logical margins.
- `InstallProvider` lifted to `App.tsx` so the install-progress dialog
  and launched reader render above any first-run panel.
- Modal stack: Radix Dialog and `ContentPackOverlay` raised to
  `z-[1100]` so dialogs and the launched reader sit above app chrome.

### Fixed
- **True random entry selection.** `get_random_entry_with_translations`
  and the plural variant were using `subsec_nanos() % total` as a PRNG;
  rapid taps clustered within the same nanosecond and collided on the
  same offset, producing the same handful of phrases over and over.
  Replaced with SQLite `ORDER BY RANDOM()` — properly seeded, uniform
  across currently-matching rows.
- Runtime "gaslight" fallback for pruned-entry IDs in user history now
  silently substitutes a same-level random entry instead of erroring.
- `dialects.<code>` localization gap that surfaced raw codes (e.g. "sv")
  instead of translated language names — added entries for the 9 new
  languages across all 38 locales.

## [0.11.8] - 2026-04 — Android TTS onboarding (#230)

### Added
- Android TTS onboarding overhaul: explicit engine probe, auto-recover
  attempt, rescue card UI for diagnosed failures (engine disabled,
  engine missing, voice data missing, engine hung).
- Voice-selection per-language section with samples and previews.

## [0.11.7] - 2026-03 — IAP rewrite for App Review resubmission

### Changed
- Native StoreKit 2 + Play Billing rewrite via `tauri-plugin-iap` to
  pass App Review.

## [0.11.6] - 2026-03 — IAP retry + diagnostics + lifecycle hardening

### Added
- IAP retry surfaces and diagnostics.
- Earthgate Reader 0.5.1 bundled.

### Fixed
- Lifecycle edge cases around backgrounded purchases.

## [0.11.5] - 2026-02 — IAP lifecycle, iOS reader bugs

### Fixed
- Various iOS reader bugs.
- IAP lifecycle in Apple sandbox.

## [0.11.3] - 2026-02 — Books, packs, paid content (#225)

### Added
- Paid-book downloads.
- Subscription management surfaces.
- Books pipeline plumbing.

## [0.10.0] - 2026-01 — Reader pack improvements (#214)

### Added
- Reader-pack delivery improvements end-to-end.

## [0.9.10] - 2025-12 — iPhone finish push (#209)

### Changed
- iPhone polish in service of ship.

## [0.9.9] - 2025-12 (#208)

### Changed
- Continued ship readiness.

## [0.9.8] - 2025-12 — Stargate reader full rollout (#195)

### Added
- Stargate Reader as a fully shipped pack.

## [0.9.7] - 2025-12 — Keep Alive and Upgrades (#192)

### Added
- Audio keep-alive plugin to fix iOS background audio.

## [0.9.6] - 2025-11 — Reform DB loading (#186)

### Changed
- DB loading reform.

## [0.9.5] - 2025-11 (#185)

### Changed
- General improvements.

## [0.9.3] - 2025-11 — Padding flail (#148)

### Fixed
- Padding regressions.

## [0.9.2] - 2025-11 (#147)

### Changed
- Padding adjustments and Hanzipan version sync.

## [0.9.0] - 2025-10 — Packs ship (#142)

### Added
- Packs system shipped end-to-end.

## [0.8.8] - 2025-09 — Fully offline packs (#130)

### Added
- Fully offline pack delivery.

## [0.8.5] - 2025-09 — Add 8 South Asian languages (#122)

### Added
- 8 South Asian languages added.

## Older

For the full history, see `git log corpan/corpan-app/`. Notable older
milestones: GAMETIME (#120, first packs), Bengali + Watashi (0.7.10
#105), Thai (0.7.12 #108), Turkish (0.7.16 #116), Indonesian (0.7.15
#114), A0 level + DB compress (#109), Rating prompt (#103).
