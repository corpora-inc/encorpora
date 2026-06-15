# Changelog — Hover Runner pack

3D fun: lock in correct translations with the All-Hearing Ear and avoid
wrong ones. Reference game pack — also the seed for the pack SDK
patterns. Distributed via the `encorpora.io` catalog.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

### Fixed
- **Daily cap now HARD-enforces.** The gate counted completed phrases but never
  blocked at the cap. After a free user completes the daily limit of phrases the
  post-celebration transition now re-shows the daily-lock overlay
  (`requestDailyLock()`) instead of starting the next round — a hard wall until
  local midnight or subscribe. Initial mount is exempt; subscribers never block.

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
