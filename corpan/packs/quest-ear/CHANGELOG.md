# Changelog — Quest Ear pack

"Quest for the All-Hearing Ear" — narrative game pack. Currently
experimental, not yet featured in the discover panel.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.4.0] - 2026-05-29 — The Rat King (NYC Level 1 final boss)
### Added
- **The Rat King final-boss encounter.** Reaching the end of the NYC run now
  arrives at the King's street-level lair — a fixed-arena phase inside the action
  scene. A crowned nutria on a stone throne, flanked by rats and crowned
  lieutenants, who blusters in Latin and attacks with cheese-vomit, a telegraphed
  spin shockwave, and a close-range tail-kick.
- **Sound-as-force combat.** Floating language phrases (Tamil, Cantonese, Greek,
  Sanskrit, Nahuatl, K'iche', and more) pop up mid-fight; grab one (tap / Space)
  to hear it spoken, then hurl it (THROW button / Enter) as a beam of sound that
  shakes the screen, thuds, and breaks the King's health. Dodge his attacks while
  you do. Languages without an offline voice use a playful proxy voice for now.
- **Death beat + progression hook.** The King fades to oblivion on a final Latin
  word and reveals a fragment of the All-Hearing Ear; taking it shows a clue
  toward the next level, then a choice to Return Home or Replay.
- **Save persistence.** New `quest_ear.save` localStorage entry records the
  Level-1 fragment + clue so they survive replays and app restarts.
- **Bundled SFX path** (`src/util/sfx.ts`, modeled on hover-runner): impact thud
  via WebAudio with a synthesized fallback, so the fight is audible before real
  WAVs are added under `src/assets/sfx/`.

## [0.3.5] - 2026-05-26 — touch-responsive replies + fixed-UI taps
### Fixed
- Replies / SMASH / exit / tilt taps now work after the camera scrolls. They were
  `setScrollFactor(0)` + per-object `setInteractive`, whose hit areas are offset by camera
  scroll — so taps missed once you walked. Now a single scene-level `pointerdown` hit-tests
  screen coordinates (the same path that made movement reliable).
### Changed
- Replies are **tap-to-select → tap-again-to-confirm** (with a "tap again to confirm ✓" hint),
  so the default-highlighted option can't be confirmed by accident. Bigger reply rows.
  Keyboard ↑↓ + Enter still works on desktop.

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
