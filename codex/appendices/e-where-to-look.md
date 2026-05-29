# Appendix E. Where to Look

A reverse index. "I want to understand X" maps to "read file Y."

## I want to understand...

### The app

- ...how the app starts: `corpan/corpan-app/src/main.tsx` plus
  `corpan/corpan-app/src-tauri/src/main.rs` plus
  `corpan-app/src-tauri/src/lib.rs`'s `run()`. Sections 04, 06.
- ...the main user loop: `corpan-app/src/components/MainExperience.tsx`.
  Section 06.
- ...what commands the Rust side exposes:
  `corpan-app/src-tauri/src/lib.rs`'s
  `invoke_handler![...]` list. Section 04.
- ...the bundled phrase corpus:
  `corpan/dja/cor/models.py` plus
  `corpan-app/src-tauri/src/db.rs`. Section 16.

### The packs

- ...what a pack looks like on disk:
  `corpan/packs/earthgate-reader/`. Section 11.
- ...the contract between host and pack:
  `corpan/packs/sdk/index.d.ts`. Section 12.
- ...how a pack catalog renders: `corpan/packs/shared/catalog/
  src/appShell.ts`. Section 13.
- ...the cross-pack shared state:
  `corpan/packs/shared/state/`. Section 14.
- ...the transport bar:
  `corpan/packs/shared/ui/transportBar.ts`. Section 15.

### Audio and content

- ...the segments-and-audio-manifest format:
  `corpan/packs/shared/core/types.ts`. Section 17.
- ...how an audiobook plays:
  `corpan/packs/earthgate-reader/src/game.ts`. Section 15.
- ...the mastering chain:
  `corpan/NARRATION_SYSTEM.md` "Audio Mastering Chain" section.
  Section 18.
- ...voice clones and their references:
  `voices/data/README.md` plus `voices/scripts/`. Section 18.

### Pipeline

- ...the Chatterbox call shape:
  `corpan/NARRATION_SYSTEM.md` "TTS Engine" plus
  `~/projects/ttsctl/` (on the Spark). Section 20.
- ...the Whisper alignment:
  `corpan/NARRATION_SYSTEM.md` "Whisper Alignment" section.
  Section 21.
- ...the convergence loop:
  `corpan/NARRATION_SYSTEM.md` "Convergence Loop" section.
  Section 20.
- ...the Spark workflow:
  `corpan/NARRATION_SYSTEM.md` "Hardware" section plus
  `PIPELINE_STATE.md`. Section 22.

### Storage and delivery

- ...the S3 layout:
  `corpan/infra/sync-*-to-s3.sh` scripts plus
  `corpan/NARRATION_SYSTEM.md` "Publishing" section. Section 24.
- ...what catalog.json contains:
  `corpan/infra/CATALOG_NARRATOR_FIELDS.md` plus a live
  `curl https://d38iwc9748jekz.cloudfront.net/catalog.json`.
  Section 24.
- ...the captures pipeline:
  `corpan/infra/captures/CAPTURES.md`. Section 25.
- ...all the places state lives:
  Section 26.

### Platforms

- ...the iOS regen path:
  `corpan/corpan-app/scripts/ios-gen.sh` (referenced in
  `corpan/APP_RELEASE_0_11_3.md`). Section 27.
- ...the Android patch path:
  `corpan/corpan-app/scripts/patch-android.sh`. Section 28.
- ...the Android exit prevention story:
  `corpan-app/src-tauri/src/lib.rs:1314` comment. Section 04.
- ...desktop differences:
  Section 29.

### The repo as a whole

- ...the directory map:
  `DEVELOPMENT.md` at the repo root. Section 02.
- ...the composable Pages architecture:
  `GITHUB_PAGES_SETUP.md` at the repo root. Section 02.
- ...the LFS setup: `GIT_LFS.md` at the repo root. Section 03.
- ...the install-mode model:
  `GAME_INSTALL_SUMMARY.md` at the repo root. Section 10.
- ...the per-unit changelog discipline:
  `corpan/CHANGELOGS.md`. Section 02.
- ...the per-app agent guide:
  `corpan/CLAUDE.md`. Section 33.

### Decisions and history

- ...the per-discovery decision logs:
  `~/projects/ttsctl/changelog/decisions/` (on the Spark).
  Section 22.
- ...the in-flight pipeline state: `PIPELINE_STATE.md` at the
  repo root. Section 22.
- ...the recent 90-day shift: Section 36.
- ...where this is going next: Section 35.

### Conventions

- ...file naming: Appendix B.
- ...glossary of every proper noun: Appendix A.
- ...the most common commands: Appendix C.
- ...books and papers worth reading: Appendix D.

## The starter set

If you have twenty minutes and a specific question, the
single highest-leverage files to read are:

1. `README.md` at the repo root (encorpora's two-paragraph
   identity).
2. `DEVELOPMENT.md` at the repo root (the developer overview).
3. `corpan/CLAUDE.md` (the app's agent guide).
4. `corpan/NARRATION_SYSTEM.md` (the pipeline's authoritative
   doc).
5. `codex/README.md` (this manual's table of contents).

If you have an hour, read the corresponding numbered section
in this Codex for whatever subsystem you are landing in.

If you have a day, read the Codex front to back. The
braiding of reference and education is what each section is
trying to earn; reading them in sequence is the experience the
manual was written for.
