# Appendix A. Glossary

Every proper noun used in this manual, one line each. Alphabetical
within each cluster.

## People and organizations

- **Apple**: maker of iOS, macOS, the App Store, and the
  development teams Corpán submits builds under (team ID
  `F9AV5HKF6N`).
- **Corpora Inc**: the company that ships Corpán; owns the
  `corpora-inc` GitHub organization.
- **Ian**: the canonical narrator voice across most shipped
  narrations; cloned from a 15-second WAV reference.
- **Jeff (Jeffry Everett)**: the project's primary developer
  and author of most of the books in `books/`.
- **Resemble AI**: the company that ships the open-source
  Chatterbox TTS package the pipeline depends on.
- **Skylar Saveland**: the teammate who maintains the
  narration pipeline (`~/projects/ttsctl/`) and reviews PRs.
- **Umanistan**: the GitHub organization that hosts Jeff's
  fork (`Umanistan/encorpora`).

## Products

- **Corpán**: the cross-platform language learning app. Bundle
  id `com.corpora.corpan`.
- **corpora**: the stable platform repo at
  `github.com/corpora-inc/corpora` (a sibling, not in this
  tree).
- **encorpora**: this repository at
  `github.com/corpora-inc/encorpora` ("on Corpora"); the
  experimental lab.
- **encorpora.io**: the project's public website, deployed
  from `web/io/`.

## Packs

- **Earthgate Reader**: a calm, earth-toned audiobook reader.
  Pack id `earthgate_reader`.
- **Hanzipan**: the Mandarin character pack, ships its own
  SQLite of character data.
- **Hover Runner**: a 3D Babylon.js pack themed around the
  Corpán pyramid.
- **Juice Squeeze**: a 3D Babylon.js gameplay pack.
- **Melopán**: a generative music sandbox using Tone.js
  (on the `melopan` branch).
- **Parlometron**: the pass-the-device pronunciation party
  game added in 0.13.x.
- **Pronunciation Coach**: the per-language pronunciation
  drilling pack.
- **Quest-Ear**: a 2D Phaser-based arcade pack.
- **Stargate Reader**: the catalog-reader pack with a
  mid-century-science aesthetic.
- **World Radio**: streams live radio stations worldwide via
  the native `tauri-plugin-radio-stream`.

## Pipelines and tools

- **Babylon.js**: 3D scene graph used by Hover Runner and
  Juice Squeeze.
- **Blender**: CAD backend driven from Python for the
  SVG-to-GLB pipeline.
- **Chatterbox**: the TTS engine (`ChatterboxMultilingualTTS`).
- **CloudFront**: the CDN at `d38iwc9748jekz.cloudfront.net`
  fronting `corpan-prod`.
- **corpan-yt**: the Python click CLI under
  `infra/captures/youtube/` that uploads captures to YouTube.
- **Django**: the CMS framework for the corpus
  (`corpan/dja/`).
- **Phaser**: the 2D game framework Quest-Ear uses.
- **stable-ts**: the Whisper wrapper used for forced alignment.
- **Tailscale**: the tailnet that fronts the Spark.
- **Tauri**: the cross-platform framework (Rust + WebView) the
  Corpán app is built on.
- **Tone.js**: the Web Audio framework Melopán uses.
- **ttsctl**: the narration pipeline tool, lives on the Spark.
- **Vite**: the build tool the React tree and packs use.
- **whisper.cpp**: the C/C++ port of Whisper used on-device.

## Hardware and infrastructure

- **DGX Spark / Spark**: the NVIDIA DGX Spark GB10 GPU
  workstation that runs the narration pipeline.
- **corpan-assets**: the S3 bucket for marketing assets,
  captures, and developer-facing assets.
- **corpan-prod**: the S3 bucket for the production data
  plane (narrations, voices, catalog.json).
- **GB10**: the Blackwell-architecture chip in the DGX Spark.

## Build and platform terms

- **AAB**: Android App Bundle; the Play Store upload format.
- **AAC**: the audio codec used inside the M4A narration
  files.
- **LFS**: Git Large File Storage; tracks `*.sqlite3`,
  `*.png`, `*.epub`, `*.pdf`.
- **LUFS**: integrated loudness unit; pipeline targets -22
  LUFS.
- **OKLCH**: the perceptual color space the design tokens use.
- **WKWebView**: Apple's webview, used by Tauri on iOS and
  macOS.
- **XcodeGen**: the YAML-to-Xcode-project tool the iOS regen
  script drives.

## Files and paths

- **catalog.json**: the master catalog of published
  narrations at `s3://corpan-prod/catalog.json`.
- **CHANGELOG.md**: per-shippable-unit history file (per
  `corpan/CHANGELOGS.md`).
- **CLAUDE.md**: agent-facing architectural notes (at
  `corpan/CLAUDE.md` primarily).
- **manifest.json**: the file at the root of every pack zip.
- **release.sqlite3**: the bundled phrase corpus at
  `corpan/dja/release.sqlite3`.
- **segments.json**: the authored book text format (section 17).
- **audio_manifest_<lang>.json**: the per-language audio
  manifest with word timestamps.
