# Corpan App Shell — Codebase Map (for Journey mode design)

Scope: `corpan/corpan-app/src` on branch `journey`, read 2026-07-03. All paths below are relative to `/home/skyl/encorpora/corpan/corpan-app/src/` unless absolute.

---

## 1. Navigation / routing model

**There is no router.** No react-router, no route tree. The entire shell is a single state machine in `App.tsx`:

- `App.tsx:748` — if `!onboarded` (from settings store) render `<OnboardingEngine/>` (wrapped in `InstallProvider` + `PaywallSheet`), nothing else.
- `App.tsx:764-854` — post-onboarding tree: **`<HomeHub/>` is the always-mounted root** (`components/home/HomeHub.tsx`). Everything else overlays it:
  - `SettingsModal` (local `showSettings` state, `App.tsx:147,774`)
  - `PhrasePackDrawer`, `QuickSettingsSheet`, `TTSSettingsDrawer` — opened via `useDrawerStore` (`store/drawer.ts`, session-only, explicitly "shaped to grow: each drawer gets its own boolean + open/close pair")
  - `PaywallSheet`, `DailyLockOverlay`, `RatingPrompt`, `UpdatePrompt`, `SystemPackInstaller`, `TTSFailureBanner`
  - **The experience overlay** (`App.tsx:796-819`): driven by `activeGame: {id, manifestUrl?, entry?} | null` state.

### Experience launch (two kinds)

- **Content pack** (has `manifestUrl`) → `ContentPackOverlay` → `contentPacks/ContentPackHost.tsx`. The pack's JS bundle is injected as a `<script>` **into the same WebView window** (no iframe; `ContentPackHost.tsx:33-80`). The pack SDK registers itself in `window.CorpanGames` (`packs/sdk/index.js:18`), then the host calls `mount(container, hostApi, initialState)` (`contentPacks/types.ts:754-760`). The `hostApi` (built in `contentPacks/hostApi.ts`, 1263 lines) is the entire pack↔host contract — see §5.
- **Native phrase experience** (`id === "phrase_main"`, no manifestUrl) → `<MainExperience/>` + `PhraseFlipChrome` (`App.tsx:810-817`). Only the native experience gets host-injected chrome (gear + Home buttons, `App.tsx:105-142`); content packs own their chrome entirely.

### Launch chokepoints (single paths, important for Journey)

- `handleLaunchGame(game, entry?)` — `App.tsx:535-551`. Sets `activeGame`, pushes URL param, stamps `useGamesStore.touchLaunch(id)` for Recents.
- `openPhrase()` — `App.tsx:598-604`. Stamps `useRecentNativeStore.touchPhrase()`.
- Deep links: URL query `?game=<id>&gameUrl=...&entryId=&source=&route=` parsed at boot (`App.tsx:165-185`) and on `popstate` (`App.tsx:488-501`); `updateGameParam` pushes state (`App.tsx:516-533`). This is the ONLY URL-addressable surface in the app.

### The window-CustomEvent bus

Cross-boundary communication (host ↔ packs sharing one window) is all `window.dispatchEvent(new CustomEvent(...))`:

| Event | Direction | Purpose |
|---|---|---|
| `corpan:exit` | pack → host | leave experience, back to Home (`App.tsx:553-571`) |
| `corpan:open-settings` | anywhere → host | open full Settings over running pack (`App.tsx:573-579`) |
| `corpan:segment-progress` | reader packs → host | `{bookId, language, segmentsReached, totalSegments}` → progress store (`App.tsx:404-433`) — **the only "results" channel that exists today** |
| `corpan:request-unlock` | pack → host | open Plus paywall (`App.tsx:337-362`) |
| `corpan:daily-locked` | shared gate → host | render DailyLockOverlay at the hard daily cap (`App.tsx:370-389`) |
| `corpan:preinstall-pack`, `corpan:preload-packs` | onboarding → host | quiet installs (`App.tsx:661-672`, `onboarding/graph.ts:105-110`) |
| `corpan:entitlements-changed` | host → packs | Plus flipped active (`App.tsx:459-486`) |
| `corpan:streak-changed` | streak lib → listeners | per-pack streak update (`packs/shared/streak/src/streak.ts`) |
| `corpan:purchase-recorded`, `corpan:subscription-recorded`, `corpan:restore-purchases-requested` | reader ↔ host | IAP mirroring (`App.tsx:301-334`) |

### First-launch landing

Onboarding writes a one-shot `LandingIntent` to `store/landing.ts` (persisted so a cold restart still honors it, cleared on consume). `App.tsx:679-746` consumes it once on the `onboarded` false→true transition (useLayoutEffect to avoid FOUC): `experience`+`razzle` plays the ~5s `PackLaunchTransition` collage and mounts the chosen experience under it; `tour` opens `OnboardingTour`; `home`/`discover` stay on Home. Intent kinds: `home | experience | discover | tour` (`store/landing.ts:14-19`) — **adding `journey` here is a one-line union extension**.

---

## 2. Per-user state inventory (EVERYTHING that persists today)

All zustand stores use the same pattern: `create<T>()(persist((set,get)=>..., { name, storage: createJSONStorage(() => localStorage), partialize, version + migrate }))`. Imperative access outside React via `useXStore.getState()`.

### Zustand stores (localStorage unless noted)

| Key | File | Contents |
|---|---|---|
| `corpan-stacks-v1` (v3) | `store/settings.ts:720-756` | **The core profile.** `stacks` (per-stack: `languages` ordered list, `domains`, `levels` (CEFR A0–C2), `rate`, `textSize`, `showRomanization`, `scrollNavigationEnabled`, `voicePrefs` per lang, `phrasePackIds`, `baseCorpusEnabled`), `activeStackId`, `onboarded`, `onboardingStep`, `hasSeenPacksDiscover`, **`userClass`**, **`ageBand`**, **`goalIntensity`**, **`interests[]`**, `theme`, `preferredEngine` (Android TTS). Mirrors of the active stack are re-derived on hydration (`settings.ts:763-802`). |
| `corpan-progress-v1` | `store/progress.ts` | Per-book reading progress: `byKey["{bookId}::{lang}"] = {segmentsReached (monotonic max), totalSegments?, lastOpenedAt}`. Derived selectors: `booksInFlight()`, `booksFinished()`, **`streakDays()`** (consecutive local days, seeded today-or-yesterday, `progress.ts:92-119`), `segmentsToday()` (approximation, `progress.ts:121-129`). Fed ONLY by `corpan:segment-progress`. "localStorage only. Never sent to a server." |
| `corpan-history-v2` (v3) | `store/history.ts` | Per-stack **phrase navigation history**: `byStack[stackId] = {ids[], sources[], index}` where source = `"base"` or phrase-pack id. Used for back/forward nav and as the anti-repetition `exclude` list to the Rust sampler (`getRecentTuples`, `history.ts:195-215`). **Exposure only — no correctness/results.** |
| `corpan-packs-v1` | `store/games.ts` | Installed content packs: `{id, name, manifestUrl, version, description, imageUrl, source, installedAt, lastLaunchedAt}`. |
| `corpan-recent-native-v1` | `store/recentNative.ts` | `phraseLastLaunchedAt` (Phrase Flip isn't a games-store entry). |
| `corpan-pack-rating-v1` | `store/packRating.ts` | Per-experience `"like" | "dismiss"` from the Home "For you" cycle → ±1 signal ×5 weight in ranking. |
| `corpan-rating` (v3) | `store/rating.ts` | `hasRated` only (manual-only review prompt). |
| `corpan-landing-v1` | `store/landing.ts` | One-shot landing intent (routing, not config). |
| `corpan-entitlements-v1` | `store/entitlements.ts:161` | Durable `lastKnownSubscription` (offline Plus lifeline), `lastVerifiedAt`, `platform`, `iapAvailable`, `subjectId` (anonymous per-install). Live `subscription` + `purchasedProducts` + `entitlementToken` are in-memory only. |
| `corpan-phrase-packs-v1` | `store/phrasePacks.ts` | Registry of installed phrase packs (disk mirror; per-stack *activation* lives in settings `phrasePackIds`). |
| `corpan-catalog-v2` | `store/catalog.ts:185` | Game/pack catalog — **IndexedDB LARGE tier** (not localStorage; it overran the ~5MB budget). |
| `corpan-phrase-pack-catalog-v1` | `store/phrasePackCatalog.ts:133` | Phrase-pack catalog — IndexedDB LARGE tier. |
| `corpan-word-pack-catalog-v1` | `store/wordPackCatalog.ts:128` | Word-pack index — localStorage (tiny). |
| `corpan-update-prompt` | `store/updatePrompt.ts` | Version-nag dismissal state. |

### Raw localStorage (non-zustand)

- `corpan.streak.v1.<packId>` — **per-pack visit streaks** `{current, longest, lastDay}` (`packs/shared/streak/src/streak.ts:14`). Recorded by host at pack-enter; read-only to packs via `hostApi.getStreak()`. Never a gate.
- `corpan:gate:<packId>:<surface>` — **daily quota counters** (gate v2, `packs/shared/monetization/src/quotas.ts:22`). Central registry `QUOTAS` (e.g. `phrase_flips`: 20/local day, `parlometron_daily`: 10 new phrases/day). Resets local midnight; remote-config overridable via `globalThis.__corpanQuotaConfig` (`main.tsx:31`, `util/remoteQuotaConfig.ts`).
- `corpan-streak-enabled` — opt-in flag for the Home `StreakChip` (`components/StreakChip.tsx:5`; streak UI is off by default, "no Duolingo nagging").
- `tip:*` — dismissable tips (e.g. `tip:language-order`).
- `corpan-analytics-disabled` — analytics opt-out. Analytics itself: anonymous, no device/user id, cloud queue + **IndexedDB ring buffer** on device (`util/analytics.ts`), reconciled at boot (`main.tsx:107-150`).
- Pack-private state: each content pack keeps its own localStorage namespace (they share the window). **The host has no unified per-activity results store.**

### What does NOT exist today (gaps Journey must fill)

- **No XP, no points, no levels-of-the-user** (CEFR `levels` is a content *filter*, not a mastery model).
- **No per-item knowledge/SRS state** — history records what was *seen*, never whether the user got it right.
- **No per-experience results** flowing to the host (only readers' `segmentsReached`). Pronunciation scores, game scores, STT scores all die inside packs.
- **No lesson/session/curriculum entities** anywhere (see §6).
- **No daily-goal setting** — `goalIntensity` is captured in onboarding but drives nothing at runtime today (grep confirms it's only written and pitched, never read for pacing).

---

## 3. "For you" ranking (Home recommendations)

Pure, deterministic scoring in `experiences/registry.ts`:

- `ExperienceMeta` per experience: `categories` (read/audio/games/speak/study/wild — same vocabulary as onboarding interests), `goodForClass` (UserClass[]), `order` (cold-start tiebreak), `featuredFor`, `kidFriendly`, `languages` (gate for language-specific packs like Hanzipan) (`registry.ts:20-41`). Local map for 10 built-ins (`registry.ts:51-154`).
- **Catalog-first resolution** (`resolveExperienceMeta`, `registry.ts:185-207`): catalog entries can carry `categories`/`goodForClass`/`recommendOrder`/`featuredFor`/`kidFriendly`/`languages`, so **newly published packs self-configure their ranking OTA without an app release**. Registry is the fallback.
- `scoreExperience` (`registry.ts:241-260`): interests-match ×3 + featuredFor-match ×1 + class-fit ×2 + kid-fit ×2 (non-adult ageBand) + rating ×5 (±1 like/dismiss) − 100 language-mismatch + `(100−order)×0.01` tiebreak.
- `components/home/recommend.ts` assembles candidates = catalog ∪ installed ∪ `phrase_main`, ranks via `rankExperiences`.
- `HomeHub.tsx:149-181` maps ranked metas → cards. Card 0 is the cycling **hero** ("For you") with Try-it/Get, ♥ (like), ✕ (dismiss → cycle) (`HomeHub.tsx:197-218`); the rest render as the "Recommended" carousel; below that Recents, phrase-pack drawer trigger, `PacksSection` (full listing), and a small Plus chip.
- Onboarding's `bestFitExperience` (`onboarding/bestFit.ts`) reuses the SAME ranking to pick the auto-launch experience (launchable + not in `AUTO_LAUNCH_BLOCKLIST` = {corpan_city, teletron}).

---

## 4. Onboarding flow — what we learn about the user

Data-driven decision graph, not a wizard: `ONBOARDING_GRAPH` in `onboarding/graph.ts:121-347`, walked by `OnboardingEngine.tsx`. Node kinds (`onboarding/types.ts`): `adapter` (hosts heavy legacy components via `onboarding/registry.ts`), `question`, `multiQuestion`, `info`, `terminal`. Decisions accumulate in a non-persisted `Draft` and flush at the terminal (`commitDraft`, `graph.ts:46-113`) — Back is non-destructive. **"Adding curricula / program deals later = more nodes, no engine change"** (author's comment, `graph.ts:116-120`) — the graph is explicitly designed for extension.

Flow: `welcome` → `pickPrimary` (**UI/native language**; writes `setLanguages([code])` eagerly + `i18n.changeLanguage`, `components/OnboardingPickPrimary.tsx:42-63`) → `welcomePact` → `forkJourney` (4 journeys) → per-journey calibration → `pickPhrasePacks` (learn path) → `tts` (voice setup) → `interests` multi-select → `whatToStart` → `commit`.

What is captured, where it lands:

| Fact | Captured at | Persisted in |
|---|---|---|
| **Native/UI language** = `languages[0]` | pickPrimary | stack `languages` (settings) |
| **Target language(s)** = `languages[1..]` (ordered) | pickLearning → `LanguageSelectOrder` (drag list; *bottom = UI language*, display reversed, `LanguageSelectOrder.tsx:133,152`) | stack `languages` |
| **userClass**: `learner \| enjoyer \| polyglot \| kid_native` | forkJourney (`graph.ts:131-176`) | settings `userClass` |
| **goalIntensity**: `casual \| daily \| intensive` | derived from journey choice | settings (unused at runtime today) |
| **ageBand**: `under_13 \| teen \| adult \| senior` | childAge node (child journey only; others default adult) | settings `ageBand` |
| **CEFR levels + TTS rate** | calibrateEnjoy / calibrateLearn / childAge ("never studied" → A0 @0.6 … "advanced" → A1–B2 @0.9) | stack `levels`, `rate` |
| **interests[]**: read/audio/games/speak/study/wild | interests multiQuestion (skippable) | settings `interests` |
| **whatToStart**: read/study/playMusic/playGames/surprise | final question | not persisted; drives `resolveLanding` |
| Phrase packs, voice prefs | pickPhrasePacks / tts (written eagerly, not in draft) | stack `phrasePackIds`, `voicePrefs` |

`resolveLanding` (`onboarding/resolveLanding.ts:124-180`) makes the deterministic landing call: read→earthgate_reader (seeded with `DEFAULT_READER_SEED_BOOK = "book_biomes_tropical_rainforest"`), study→phrase_main (or hanzipan if a Chinese target), playMusic→beatlounge, playGames→hover_runner, surprise→random over launchable set; every path falls back to Phrase Flip (always launchable). The chosen pack is quiet-preinstalled the moment the final answer is tapped (`graph.ts:27-43`, `App.tsx:610-659`).

**Not learned:** why they're learning (goal), time budget, prior-knowledge granularity beyond one coarse bucket, literacy in target script, specific topical interests (interests are modality tags, not topics — though phrase pack picks are a weak topical signal).

---

## 5. Where a top-level "Journey" surface plugs in

1. **Routing/shell**: Journey is naturally a third render mode in `App.tsx` — either (a) a new always-available native surface like `phrase_main` (an `activeGame`-style overlay id, launched through a chokepoint like `openPhrase`, `App.tsx:598`), or (b) a sibling/replacement of `HomeHub` as the root (a scrollable feed fits the "always-mounted root, experiences overlay on top" architecture perfectly). URL addressability comes free by extending the `?game=` param scheme or adding `?journey=`. Add `{ kind: "journey" }` to `LandingIntent` (`store/landing.ts:14-19`) so onboarding can land straight into it.
2. **Launching activities from the feed**: reuse the two existing chokepoints. Content-pack steps launch via `handleLaunchGame(game, entry)` where **`PackLaunchEntry` (`contentPacks/types.ts:39-52`) is the existing per-launch addressability seam** (`entryId`, `source`, `route`, `seedBookId`) — the natural place to add an abstract `activity`/`step` payload. Packs receive it as `mount(..., initialState)`. The missing half is the **return channel**: today only readers report back (`corpan:segment-progress`). Journey needs a generalized `corpan:activity-result` event (or a typed `hostApi.reportResult()`), following the exact pattern of the segment-progress listener in `App.tsx:404-433`.
3. **Store**: a new `store/journey.ts` zustand store, `name: "corpan-journey-v1"`, following house pattern (persist + partialize + version/migrate). **Caution**: per-item mastery over ~25k phrases × results will not fit the shared ~5MB localStorage budget — use the IndexedDB LARGE tier like `corpan-catalog-v2` (`store/catalog.ts:185-188`; migration helper exists at `util/storage/migrate.ts`, invoked in `main.tsx:107-124`). Also decide interaction with **stacks**: journey course = (native, target) pair; stacks already encode ordered language lists per profile, and per-stack keying (as history does, `history.ts`) is the established multi-profile pattern.
4. **Experience metadata**: extend `ExperienceMeta`/catalog fields (`experiences/registry.ts`) with journey-capability declarations (e.g. `activityTypes`, supported CEFR span, per-step contract version). The catalog-first `resolveExperienceMeta` seam means **packs can retroactively declare Journey compatibility OTA** — exactly the modularity the mission requires.
5. **i18n**: keys go in `public/locales/en/common.json`; the `npm run check:i18n` build gate requires every one of ~54 locales to carry every `en` key (hard fail). Agents translate directly per repo policy (`corpan/CLAUDE.md`). i18next: http-backend, `load: "currentOnly"`, ns `common` (`i18n.ts`). UI language auto-follows `languages[0]` via `LanguageSynchronizer` (one-way store→i18n; also flips `dir` + Radix DirectionProvider for RTL).
6. **Drawer/quick surfaces**: `store/drawer.ts` is explicitly "shaped to grow" — a Journey settings/roadmap drawer is a 6-line addition.
7. **Gating/monetization**: register a Journey surface row in `packs/shared/monetization/src/quotas.ts` if metered; the DailyLockOverlay + paywall plumbing is already host-owned and event-driven.
8. **Existing per-user signals Journey can consume day one**: `userClass/ageBand/goalIntensity/interests` (settings), stack `levels`+`languages`, `packRating` likes, `progress` (books + streak), per-pack streaks, phrase `history` (exposure), `lastLaunchedAt` recency. What it must create: mastery/SRS state, activity results, session/lesson records, placement.

---

## 6. Existing notions of lesson / session / day

- **Local day** is the only time unit: quota gates reset at local midnight (`quotas.ts` "the DAU lever"); `localDay()` YYYY-MM-DD convention shared by streak lib (`packs/shared/streak/src/streak.ts:20-25`) and gates.
- **DailyLockOverlay** = "you did your N today ✓" accomplishment lock at the hard cap (`App.tsx:163-164, 370-389`) — the closest thing to a "daily session complete" moment, but it's monetization, not pedagogy.
- **Streaks**: (a) app-wide reading streak from `progress.streakDays()` shown in opt-in `StreakChip`; (b) per-pack visit streaks (`corpan.streak.v1.<packId>`), read-only to packs via `hostApi.getStreak()`.
- **No lesson, unit, session, day-plan, curriculum, or placement entity exists anywhere in the shell.** Journey introduces the first.

---

## 7. Tech conventions (follow these)

- **Zustand**: `create<T>()(persist(...))`, `createJSONStorage(() => localStorage)`, `partialize` to persist canonical only, integer `version` + `migrate`, `useXStore.getState()` for imperative access, `.subscribe()` for reactions (`App.tsx:472`), `onFinishHydration` for post-hydrate fixups (`settings.ts:763`). Settings store uses a canonical-stacks + derived-mirrors pattern (`settings.ts:360-379, 471-503`).
- **Persistence tiers**: localStorage for small state; IndexedDB LARGE tier for growable blobs (see `store/catalog.ts:185-188`, `main.tsx:107-124`).
- **Events over imports** for host↔pack: window CustomEvents, feature-detected optional `hostApi` methods ("ADDITIVE + optional" is stated policy, `types.ts:562-565`).
- **Styling**: Tailwind + shadcn/ui (Radix), lucide-react icons, `framer-motion` with one global `MotionConfig` (0.24s, cubic-bezier(0.4,0,0.2,1), respects reduce-motion, `main.tsx:85`). RTL via `dir()` + Tailwind `rtl:` variants + Radix DirectionProvider.
- **i18n**: every user-visible string via `t()` with `defaultValue`; dynamic keys use a loose-typed `t` (`onboarding/types.ts:46`).
- **Analytics**: anonymous, on-device-first (`util/analytics.ts`), named track helpers (`trackOnboardingCompleted`, `trackGateHit`, ...). Init after first paint.
- **Text size**: global `text-<size>` class on `<html>` (`App.tsx:503-514`).
- **Error handling**: every full-screen overlay wrapped in `ErrorBoundary` with a fall-back-to-Home `onError` (`App.tsx:797-804`) — a crash must never strand the user.
- **Changelogs**: per shippable unit, add to `[Unreleased]` with every user-visible change (`corpan/CLAUDE.md`).
