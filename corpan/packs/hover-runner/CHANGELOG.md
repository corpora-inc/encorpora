# Changelog — Hover Runner pack

3D fun: lock in correct translations with the All-Hearing Ear and avoid
wrong ones. Reference game pack — also the seed for the pack SDK
patterns. Distributed via the `encorpora.io` catalog.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

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
