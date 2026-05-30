# Changelog — Corpán (core app)

All notable changes to the Corpán Tauri app are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

### Changed

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
