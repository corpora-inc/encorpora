# Changelog — Hover Runner pack

3D fun: lock in correct translations with the All-Hearing Ear and avoid
wrong ones. Reference game pack — also the seed for the pack SDK
patterns. Distributed via the `encorpora.io` catalog.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.3.6] - 2026-06-24 — delta-timed, stackable screen shake (#438 PR-6)

### Changed
- **Screen shake is now frame-rate independent and stacks on rapid hits
  (#438 PR-6).** The fail/wrong-answer camera shake was driven by a separate
  `setInterval(16ms)` and early-returned while a shake was already running.
  Two problems on a premium bar:
  - *Not frame-rate independent.* On a 120Hz iPad the timer still ticked every
    ~16ms while the frame rendered every ~8ms, so the camera only jittered on
    alternate frames; on a janky frame the offset overshot. The shake now
    advances on the render loop's clamped `dt` (`updateScreenShake(dt)` in the
    `runRenderLoop` callback), so it reads identically at 60/90/120fps.
  - *Dropped stacked hits.* `if (shakeActive) return` meant a second fail in
    quick succession produced no extra feedback. Shake is now an `energy`
    scalar that decays exponentially (`exp(dt)`, ~90ms half-life); each trigger
    ADDS energy (capped at 2× the single-hit kick) so consecutive fails
    compound the jolt instead of being ignored.
  Decays cleanly to exact rest even while paused. Pure render-side change — no
  gameplay, audio, translation, or paywall-contract impact. Covered by a new
  `particles.test.ts` regression suite (frame-rate independence + stacking,
  both asserted via Monte-Carlo energy proxies, run green 3×).

## [0.3.5] - 2026-06-23 — iOS audio unlock + premium post-process re-tune + revived velocity effects + paywall pause

### Fixed
- **iOS/iPad music & SFX no longer stuck silent (#437).** On iOS the
  `AudioContext` is created `suspended` and re-suspended whenever the app/tab is
  backgrounded — even when the game itself was never paused — so audio could
  sit silent forever. We now resume it on the first user gesture (already wired
  via `sfx.unlock()` on the wake-lock pointerdown) **and** on every
  `visibilitychange → visible` (new `sfx.resume()` in `audio.ts`, called from
  `onVisibilityChange` in `game.ts`). Resuming a running context is a no-op, so
  Android/desktop are unaffected. Same root-cause fix that shipped for Lingo
  Hero (#439). Stays fully offline. (iPad has no haptics but does have audio.)

### Changed
- **Post-process re-tune for premium glow + legible glyphs (#438 PR-4).** Now
  that `game.ts` reads `POST_PROCESSING` from `core/visualConfig.ts` (the live
  source of truth since #458), tuned the values there:
  - **Bloom:** threshold `0.9 → 0.7`, weight `0.99 → 0.45`. The old pairing let
    almost nothing cross the threshold, so the visible glow was entirely the
    GlowLayer; bloom now actually halos the bright neon emissives (road center
    line, avatar ring, electric arcs) without blowing out.
  - **Chromatic aberration:** amount `15 → 5`. 15 smeared red/blue fringes onto
    every glyph edge — bad in a text game. 5 keeps a tasteful peripheral lens
    tint while restoring glyph legibility.
  - **Sharpen:** edgeAmount `0.2 → 0.3` (crisp glyph edges).
  - **Film grain:** intensity `3 → 2` (subtle filmic texture, doesn't fight the
    text).
  These are taste calls — operator reviews on device.
- **Particle visibility bumped to a tasteful, profile-minded level (#438 PR-5).**
  Emit rates that had been slashed near-invisible are restored: ambient dust
  `8 → 16`, starfield `10 → 18`, energy-field wisps `8 → 14`.

### Added
- **Revived speed-lines velocity-feel (#438 PR-5).** `updateSpeedLines()` was
  exported but never called, so the effect was dead. It's now driven every
  frame from the render loop, keyed to the live phrase speed
  (`getPhraseSpeed()` normalized over baseline..max into a 0..1 multiplier), so
  streaks stay calm at slow speed and ramp up as the game speeds up. Emit-rate
  floor raised so the streaks read even at the slow end.
- **Host pause/resume listeners for the paywall (#436).** Added `window`
  listeners for `corpan:host-pause` (stop the RAF update advance via the
  existing `paused` gate + suspend the `AudioContext`) and `corpan:host-resume`
  (resume audio + restart the update advance), dispatched by core-app when it
  overlays the paywall. Reuses the same `setPaused` path the settings drawer
  uses; both listeners are torn down on dispose.

### Preserved
- Gameplay, scoring, translations, i18n, offline behavior, native haptics
  (0.3.3), the #458 dead-code/config-truth cleanup, and frame-rate-independent
  motion are all unchanged.

## [0.3.4] - 2026-06-24 — Dead-code removal + post-process config is the single source of truth

### Removed
- **Three unreachable avatar variants in `hoverboard.ts`** (`neon` /
  `crystal-wave` / `solar-flare`). They were built every time the hoverboard
  was created but never selectable — the skin map in `game.ts` only ever calls
  `hoverboard.setVariant(...)` with `variantId` ∈ {`corpan`, `desert`,
  `glacier`}. Grep-confirmed zero references to the removed variant ids before
  deleting; the shared helpers they used (`createEmissivePbr`, `scaleColor`,
  `MeshBuilder`) are still used by the live variants. (The unrelated `neon`
  *env-prop* skin in `game.ts`, which maps to `variantId: "corpan"`, is
  untouched.)
- **Never-imported `createAvatarAura` / `updateAvatarAura` exports in
  `systems/particles.ts`.** Grep-confirmed zero importers across the pack.

### Changed
- **`POST_PROCESSING` in `core/visualConfig.ts` is now the single source of
  truth for the render pipeline, and `game.ts` reads from it.** Previously
  `game.ts` set bloom/sharpen/grain/chromatic/vignette with inline literals
  that had drifted from the (never-imported) `visualConfig` constants. The
  config was reconciled to `game.ts`'s **current live values** (so the rendered
  output is byte-for-byte identical) and `game.ts` now reads those constants.
  Values brought into the config to match what renders today: `bloom.weight`
  `0.01 → 0.99`, `sharpen.edgeAmount` `1.5 → 0.2`, `grain.intensity` `2 → 3`;
  all other post-process values already matched. **No visual change** — this is
  a pure value-preserving config-truth reconciliation. (`vignetteCameraFov`
  stays inline in `game.ts` because it reads the live `camera.fov`.)

## [0.3.3] - 2026-06-23 — Native haptics

### Added
- **Native haptics across 8 gameplay events.** Adds `src/haptics.ts`, a small
  singleton (`triggerHaptic(style)`) that copies the juice-squeeze pattern —
  direct `plugin:haptics|impact` IPC into the host's Tauri webview (no host
  rebuild needed on Corpán 0.19.0+) with a `navigator.vibrate` fallback. Off
  device / desktop / mock → silent no-op. Wired triggers: correct hit →
  `success`; wrong hit → `heavy`; missed correct phrase → `warning`; dodged a
  wrong answer → `light`; combo milestone (every 5) / level-up → `medium`;
  daily-cap lock → `heavy`; lane/row change (touch + keyboard) → `selection`
  (debounced, gated); settings/menu drawer open → `light`. New
  `hapticsEnabled` setting in `tuningStore` (defaults ON for touch/coarse-pointer
  devices, OFF on desktop) gates all of it, ready for a future settings toggle.
  No gameplay, scoring, audio, or translation changes.

## [0.3.2] - 2026-06-23 — Scorecard scales up on tablet/large viewports

### Changed
- **Scorecard HUD (top-left) now scales up on bigger screens.** Card height,
  score font, stat font, and stat-icon sizes are now `clamp()`-keyed to `vmin`
  instead of fixed pixels, so the card grows smoothly across phone → tablet →
  desktop. Previously the card was pinned at phone size (48px / score 22px /
  stat 12px) with media queries that only ever shrank it for small/landscape
  screens — on iPad it stayed tiny while the scene had room to spare (#435,
  #438 row #22). The phone floor is unchanged and the existing small-screen
  shrink breakpoints still pin it tight on cramped/landscape phones; on
  tablet/desktop the card now reads premium-sized (height up to 76px, score up
  to 38px). CSS-only — no layout/JS change. The hamburger stays a shared 48px,
  so the scorecard intentionally grows a touch more on big screens.

### Added
- **Status HUD shows today's phrase quota + days-in-a-row streak.** The top-left
  readout now lays out four numbers in a compact 2-column grid: 🔥 visit streak
  (consecutive local days, via `hostApi.getStreak`) and ⚡ today's phrases toward
  the daily cap (`done/limit`) on top, score + combo streak beneath. Both new
  readouts are icon+number (no new translated strings); the quota hides for
  subscribers (unlimited) and the streak hides until day one.

## [0.3.1] - 2026-06-16 — Daily-cap enforcement + Babylon 9

### Fixed
- **Daily cap now HARD-enforces — including on remount.** The gate counted
  completed phrases but never blocked at the cap. `startNewRound()` now checks
  `isBlocked()` before building a round, covering BOTH the post-celebration next
  round AND the initial mount — every round generates a fresh phrase (no
  restore), so a capped free user could previously mint one by exiting and
  re-entering. At the cap it re-shows the daily-lock overlay
  (`requestDailyLock()`) instead — a hard wall until local midnight or subscribe.
  Subscribers never block.

### Changed
- Upgraded Babylon.js **6.48 → 9.11** (latest stable). Modular import
  paths held with no source changes; 16/16 tests green, build clean.

## [0.3.0] - 2026-05-19 — Motion permission overlay + safer state plumbing

### Added
- **iOS Motion Permission overlay** — a one-shot full-screen prompt
  with a single big "Enable Motion" button. iOS WebKit's
  `DeviceOrientationEvent.requestPermission()` must be dispatched
  inside a fresh user-activation; every other listener in our
  canvas pointerdown chain (audio.unlock, Babylon pointer wiring)
  consumed the gesture before our call could land. The dedicated
  overlay button is the only reliable gesture surface on iOS.
  Lives under `src/ui/motionPermissionOverlay.ts` with a test in
  `motionPermissionOverlay.test.ts`. Only shown when motion is
  supported AND the user's setting is still on (we never re-prompt
  someone who opted out).
- Tilt state machine (`off` / `pending` / `waiting` / `active` /
  `denied` / `error`) drives both the overlay and a tilt status
  badge in the drawer.

### Changed
- Motion-control plumbing factored into a `MotionControl` interface
  that the settings drawer subscribes to for live state.

### Fixed
- **Display section title** no longer blanks on Reset Defaults.
  `settingsDrawer.rerender()` used a fixed switch on the built-in
  section ids and returned `""` for any extra section (the Display
  section is contributed by `game.ts`). It now falls back to the
  section's construction-time title; per-language refresh of extra
  section titles remains the owner's responsibility.
- **Skin picker** no longer disappears after a UI language change.
  The displaySection re-render used to look the panel back up via
  `root.querySelector(".skin-panel")` — but the drawer wipes the
  section's `innerHTML` first, detaching the panel. We now hold a
  direct `skinPanelEl` reference that survives detachment.
- **Motion permission overlay** is now properly disposed when the
  tilt state lands at `waiting` / `active` / `off`. Previously we
  just nulled the reference and left the DOM + button listeners
  mounted.
- **Permission request promise** uses a monotonic sequence number;
  late `granted` resolutions are dropped if the user has since
  hit Disable / dismissed the overlay. Prevents tilt from being
  re-enabled against the user's wish.
- **`DeviceOrientationEvent` access** is now read through
  `globalThis` and guarded; unsupported browsers no longer throw
  a `ReferenceError` before our existing try/catch can catch it.

## [0.2.0] - 2026-05-19
### Added
- Full pack localization: every user-facing string ships in all 51
  Corpán languages. Locales live in `src/locales/<lang>.json` and the
  active language tracks `stackConfig.languages[0]` via
  `hostApi.onStackConfigChange` — switching the host's UI language
  re-renders the HUD, drawer, skin picker, and tilt button live.
- `manifest.json` now carries `nameLocalized` and `descriptionLocalized`
  maps (51 entries each) so the catalog can render localized pack
  metadata when the publishing pipeline picks them up.
- New tooling under `corpan/tools/pack-i18n/`:
  `codex_ui_translate.py` (parallel codex translator for key→value UI
  string maps) and `merge_manifest_localized.py` (folds translated
  metadata into a pack's manifest).
- Shared settings primitives extracted from stargate-reader:
  `createToggleRow` and `createAdvancedSection` in
  `@shared/ui/settingsRows` are now the canonical building blocks for
  any pack injecting custom drawer sections.

### Changed
- Settings UI rewritten on top of the canonical bottom command drawer
  (`@shared/ui/createCommandDrawer`). The right-side accordion popover,
  gear FAB, and backdrop overlay are gone; tapping the menu icon now
  opens the standard sheet with Display / Audio / Gameplay / Advanced
  Gameplay sections in the same visual language as stargate-reader.
- The drawer SDK gained two pack-friendly options: a `screens` filter
  (game packs pass `["now-playing"]` to hide the Library/Browse tabs)
  and an `onClose` callback (used to unpause the game when the drawer
  is dismissed).
- Audio decode and playback failures now log to console with context
  (`[hover-runner] sfx decode failed`, etc.) instead of being silently
  swallowed.

## [0.1.0] - 2026-04 (#233 — Narrators in catalog)
### Added
- Featured in the new Discover Packs first-run panel.

## [0.1.0] - 2026-02 (Corpán 0.11.x #226)
### Changed
- Reader-performance and books-on-web work landed across packs.

## Older

The Hover Runner pack is the longest-running game in the catalog. Its
genesis is in `Corpan: Pack polish and details 0.9.x` (#144) and the
earlier `Corpan - packs almost there!` (#143). See
`git log corpan/packs/hover-runner/` for full detail.
