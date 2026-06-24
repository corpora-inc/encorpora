# Changelog — Hover Runner pack

3D fun: lock in correct translations with the All-Hearing Ear and avoid
wrong ones. Reference game pack — also the seed for the pack SDK
patterns. Distributed via the `encorpora.io` catalog.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

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
