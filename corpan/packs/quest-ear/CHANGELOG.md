# Changelog — Quest Ear pack

"Quest for the All-Hearing Ear" — narrative game pack. Currently
experimental, not yet featured in the discover panel.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.3.4] - 2026-05-26 — mobile fixes (reliable movement, landscape-first)
### Fixed
- Movement now polls touch pointers each frame against bottom-corner zones (+ multi-touch),
  so hold-to-move is reliable and survives finger drift — the ◀/▶ pads light up when active.
- Hecklers hold off until the player has progressed past the first NPCs (no early pummeling).
- Removed the heavy container safe-area padding (over-shrank the view, esp. landscape-left);
  rely on the FIT letterbox, which already clears the notch at phone aspect ratios.
### Added
- Gentle "rotate to landscape for full screen" hint shown only in portrait (landscape-first).

## [0.3.3] - 2026-05-26 — mobile-playable (touch controls, safe areas)
### Added
- On-screen hold buttons (◀ / ▶) to move; optional tilt-to-move ("Enable Motion",
  iOS permission handled) — both alongside the existing keyboard controls.
- Bigger, finger-friendly exit button.
### Fixed
- Safe-area insets: the mount container is padded by `env(safe-area-inset-*)` so the
  canvas + UI clear the notch / home indicator (iPhone) and camera cutouts (Android).
- Orientation/resize: debounced listeners re-fit the FIT canvas so rotating
  landscape↔portrait no longer crowds the view.
- `touch-action: none` on container + canvas so touches drive the game (no page scroll/zoom).

## [0.3.0] - 2026-05-26 — NPC corpus revival, 51 languages, NYC playground
### Added
- Full NPC corpus system: multilingual vendor encounters with offering + 3-choice
  response panel (accept / decline / arbitrary), proximity re-trigger, riddle NPCs at
  milestone screens, language HUD, and TTS for both NPC dialog and player responses.
- **51-language NPC dialog corpus** (100 encounters) authored + QA'd via `scripts/i18n`
  tooling (sources / per-language translate + review parts / merge / lint / validate).
- Landing page (title, intro, choice) localized to the player's **primary stack language**
  via `src/data/sceneText.json`; start trimmed to a single "Head to the NYC streets".
- Atmosphere: parallax star field, a moon that rises with progress, periodic helicopter
  flybys, and a sky that warms night → moonlit.
- Character fidelity: player face + walk animation; NPC faces, vendor-colored hats, idle bob.
- Taxi ride: accepting a taxi fast-travels you to the next station.
- Godzilla arc: boosted growth; when building-tall, **SMASH** (button / `S`) a building (on a
  cooldown) to reveal a detailed lit dinner interior with a seated family who speak a
  target-language line (`src/data/familyLines.json`, 51 languages).
- Stakes: roving French / German hecklers run in, yell absurdities (TTS, `hecklerLines.ts`),
  and lob projectiles — dodge or take damage (shrink + energy loss, i-frames). Size and energy
  are now coupled; player feet stay anchored to the ground at every size.
- `scripts/pack.mjs` + `pack` / `pack:all`; dev browser harness (`dev.html` + `src/dev-harness.ts`).

## [0.1.0] - 2025-11 — NYC action scene + NPC interactions (#139)
### Added
- Initial NYC action scene.
- NPC interaction scaffolding.

## Older

See `git log corpan/packs/quest-ear/` for the prototype's origin.
