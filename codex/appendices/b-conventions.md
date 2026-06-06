# Appendix B. Conventions

File naming, commit messages, PR shape, release notes
discipline. The mechanical rules the codebase follows.

## File naming

- **TypeScript / TSX**: camelCase for files
  (`mainExperience.tsx` was actually shipped as
  `MainExperience.tsx`, capital-first; the convention is
  PascalCase for component files, camelCase for non-component
  modules).
- **Rust**: snake_case for files (`content_packs.rs`,
  `pack_db.rs`).
- **Python**: snake_case for files (`make_release_sqlite.py`,
  `generate_catalog_assets.py`).
- **Kotlin / Swift**: PascalCase matching the class name
  (`SttPlugin.kt`, `SttPlugin.swift`).
- **Shell scripts**: kebab-case (`sync-voices-to-s3.sh`,
  `build-capture.sh`).
- **JSON / YAML**: kebab-case (`tauri.conf.json`, `project.yml`).
- **Markdown**: kebab-case
  (`NARRATION_SYSTEM.md` and `CLAUDE.md` are exceptions, kept
  in all-caps for historical reasons).

## Directory naming

- **Packs**: kebab-case (`hover-runner`, `earthgate-reader`).
- **Plugins**: kebab-case with the `tauri-plugin-` prefix
  (`tauri-plugin-stt`, `tauri-plugin-iap`).
- **Books**: nested by category and series
  (`books/<category>/<series>/<book>/`); each lowest-level
  directory contains a `pack/` subdirectory with the narration
  artifacts.
- **Codex sections**: numbered prefix
  (`01-overview.md`, `02-the-monorepo.md`).

## Commit messages

The convention visible on `upstream/main` (section 03 walks it):

- Squash-merge style: one commit per PR on `main`.
- Title carries the user-visible change: `Corpan 0.12.6`,
  `Pronunciation coach 0.3.5`, `Bump World Radio 0.6.0 world
  map`.
- PR number in parentheses at the end of the title.
- Title length capped roughly at 70 characters.
- Body is optional; when present, names the why and the
  affected units.

In-flight commit messages on feature branches do not need to
follow the squash style; they vanish when the PR squashes. The
convention there is "describe what you just did" in present
tense.

## PR shape

- Targets `corpora-inc/encorpora:main`. The fork's
  `upstream` push URL is disabled (section 03); the PR path
  is the only path.
- Reviewed by Skylar.
- `pr-agent.yml` (section 03) posts a summary and review on
  every open / reopen.
- Per shippable unit touched, the PR appends to that unit's
  `[Unreleased]` changelog block (per
  `corpan/CHANGELOGS.md`).

## Changelog discipline

`corpan/CHANGELOGS.md` is the authoritative doc. Summary:

- **Every shippable unit keeps its own `CHANGELOG.md`**, next
  to its manifest.
- **Format**: Keep a Changelog 1.1.0, strict.
- **Vocabulary**: Added, Changed, Deprecated, Removed, Fixed,
  Security. Use only what fits.
- **Update on every PR.** Append the entry to `[Unreleased]`
  in the same diff as the change. No batching.
- **Promote on version bump.** When the manifest's version
  field changes, promote `[Unreleased]` to a dated heading and
  start a fresh `[Unreleased]` above.
- **Cross-unit changes land in each affected unit's
  changelog.**

## Release notes

- Per-version `RELEASE_NOTES_<version>.md` at the repo root,
  with the user-facing copy in 30+ locales.
- Brand strings (Parlometron, Earthgate, World Radio,
  Whisper, AI This Week) kept in Latin script across all
  locales to match prior releases.
- One block per locale, headline-first.

## Codex section conventions

- Numbered prefix (`NN-title.md`).
- `# NN. Title` header.
- Standard template: What it is / How it fits / Files and
  entry points / How it works / Common operations / Why we
  built it this way / To go deeper.
- No em dashes anywhere. Periods or colons instead.
- No section-sign symbols in prose. Use "Section N" or just
  `N` instead.
- No fullwidth colons or pipes in titles.
- Code samples are honest snippets from the actual files;
  paths and line numbers cited when useful.
- ASCII diagrams sparingly.
- Cross-references by section number, not by hyperlink (the
  Codex is meant to be readable in `less`).

## Git LFS conventions

Per section 03:

- `*.sqlite3`, `*.png`, `*.epub`, `*.pdf` are LFS-tracked.
- `git clone` followed by `git lfs install` and `git lfs pull`
  is the bootstrap.
- Adding a new file with a tracked extension goes through LFS
  automatically.

## Per-pack conventions

Per section 11:

- `manifest.json`, `package.json`, `vite.config.ts`,
  `tsconfig.json`, `index.html`, `src/`, `dist/`, `scripts/`,
  `CHANGELOG.md`.
- Pack `id` and the directory name match (Earthgate's id is
  `earthgate_reader`, the dir is `earthgate-reader` -- the
  underscore-vs-hyphen quirk has a historical reason; new packs
  align both).
- `tts.text` is TTS-only; `text` and `text_markdown` are
  display fields.
- No raw digits in `tts.text`; no dashes in phonetic nudges.

## AWS conventions

Per sections 24 and 25:

- Bucket `corpan-prod` (us-east-2) for the production data
  plane; CloudFront in front.
- Bucket `corpan-assets` (us-east-2) for marketing assets
  and captures.
- AWS profile `corpan-publisher` is the publisher.
- Credentials sourced from `~/Code/corpora/encorpora/.env` or
  from environment variables.
- Publish step writes audio first, then zip, then catalog,
  then invalidates CloudFront.

## Encorpora-specific phrasing

- "Corpán" the product, "Corpora" the company, "encorpora" the
  repo. All three appear; the distinction matters.
- The graduation framing ("experiments here, stable elsewhere")
  is the team's working agreement.
- "Pack" is the small self-contained app loaded at runtime;
  "narration pack" is a per-book zip with audio.
